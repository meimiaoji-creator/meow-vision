/**
 * meow-vision —— dsh 插件入口（node 半）。
 *
 * 给文本模型（非多模态）补一双眼睛：
 *   1. 设置弹窗「视觉」tab 选一个视觉模型（browser 半，见 src/client），配置写入插件根 vision.json；
 *   2. `meow_vision` 工具：非多模态模型调用它时，由配置的视觉模型识别图片并返回文字描述。
 *
 * node 半做三件事：
 *   - 注册 Web 路由（ctx.webServer）：/api/meow-vision/config（读写配置）+ /api/meow-vision/candidates（候选列表）；
 *   - 注册 `meow_vision` 工具（ctx.tools，执行 = 复用 dsh 的 ctx.llm.stream 直接调视觉模型，不发起子 agent）；
 *   - 注入 systemPrompt hint：告诉模型何时该用 meow_vision。
 *
 * 零 dsh 源码改动；与 dsh-meow-skill / meow-file-view / meow-dsh-task 平级共存，互不影响。
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { registerWebRoutes } from './web/routes.js';
import { loadVisionConfig } from './config.js';
import { runVisionModel } from './vision.js';
import { PreviewManager, formatPreviewOutput, refFromPreviewImage } from './preview.js';
import { loadPreviewConfig } from './preview-config.js';
/** 插件名（Cordis 行 id 之外的插件标识）。 */
export const name = 'meow-vision';
/** 需要的服务：web 路由 + 工具注册表 + 系统提示词 + 模型/附件/文件系统。
 *   llm / attachments / fs 必须在 inject 里声明，否则 cordis 的属性访问守卫
 *   （cannot get property "llm" without inject）会在运行时抛错。 */
export const inject = ['webServer', 'tools', 'systemPrompt', 'llm', 'attachments', 'fs'];
/**
 * 判断当前主模型是否多模态（能否直接看图）。
 * 复用 dsh read_image 的门禁逻辑（assertImageCapableRoute）：
 * 从 exec.agent 的会话请求头解析 provider/model，再查 ctx.llm.resolveModelInfo 的 inputModalities。
 * 解析失败按"不能看图"处理（继续走 meow_vision）。
 */
async function currentModelCanSee(ctx, exec) {
    const agent = exec.agent;
    const routed = agent?.session.requestHeader()?.config;
    const provider = routed?.provider ?? agent?.options.provider;
    const model = routed?.model ?? agent?.options.model;
    if (!provider || !model)
        return false;
    try {
        const info = await ctx.llm.resolveModelInfo(provider, model, exec.signal);
        return info.inputModalities?.includes('image') ?? false;
    }
    catch {
        return false;
    }
}
/** 注册 meow_vision 工具：非多模态模型看图。 */
function registerVisionTool(ctx, visionConfigFile) {
    ctx.tools.register(defineTool({
        name: 'meow_vision',
        description: '用配置的视觉模型识别一张图片并返回文字描述。当当前模型无法直接查看图片(png/jpeg/webp/gif)内容时调用。image_path 为图片文件路径,question 为可选问题。',
        parameters: {
            image_path: { type: 'string', required: true, description: '图片文件路径(png/jpeg/webp/gif)' },
            question: { type: 'string', description: '想从图片中知道的特定问题;留空则返回完整描述' },
        },
        output: {
            schema: { type: 'string' },
            render: (_args, value) => [{ type: 'text', text: value }],
        },
        async execute(args, exec) {
            const config = loadVisionConfig(visionConfigFile);
            if (config === undefined) {
                return 'meow_vision 未配置视觉模型。请在左下角设置 →「视觉」tab 里选择一个视觉模型后再试。';
            }
            // 主模型已多模态？它自己能看图，提示直接用 read_image（避免绕道视觉模型）。
            if (await currentModelCanSee(ctx, exec)) {
                return '当前模型支持直接看图：请改用 read_image 工具查看该图片，而不是 meow_vision。';
            }
            const outcome = await runVisionModel(ctx, config, args.image_path, args.question, exec.signal);
            return outcome.ok ? outcome.text : `meow_vision 失败: ${outcome.message}`;
        },
    }));
}
/** meow_preview 成功结果的模型可见块(text 信封 + image 块,仿 read_image)。 */
function previewContent(value) {
    return [
        { type: 'text', text: formatPreviewOutput(value.target, value.path, value.image) },
        { type: 'image', attachment: refFromPreviewImage(value.image) },
    ];
}
/** 注册 meow_preview 工具：渲染页面并返回截图图片(给多模态模型研究组件渲染)。 */
function registerPreviewTool(ctx, manager) {
    ctx.tools.register(defineTool({
        name: 'meow_preview',
        description: '渲染并截图一个页面,返回截图图片 + 落盘路径。用于研究团队 UI 库组件的实际渲染效果(样式/边距/布局)。target 传 demos/<名字>(预览 .preview/src/demos/ 下的 Vue demo,需先在设置里配置 libName)、或 http(s):// URL、或本地 .html 文件路径。截图会保存到 .preview/shots/ 下的 png,path 字段给出路径,可再喂给 read_image / meow_vision 复用。这是简单预览,只适合渲染单个简单组件,不是整页预览。',
        parameters: {
            target: { type: 'string', required: true, description: '预览地址:demos/<名字>(推荐) / http(s):// URL / 本地 .html 文件路径' },
            width: { type: 'integer', description: '视口宽 px,默认 1000' },
            height: { type: 'integer', description: '视口高 px,默认 800' },
            wait_ms: { type: 'integer', description: '额外渲染等待 ms,默认 3000(给 CDN/字体加载留时间)' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    target: { type: 'string', required: true },
                    path: { type: 'string', required: true, description: '落盘的截图 png 绝对路径(.preview/shots/)' },
                    image: {
                        type: 'object',
                        additionalProperties: false,
                        required: true,
                        properties: {
                            attachmentId: { type: 'string', required: true },
                            mediaType: { type: 'string', enum: ['image/png'], required: true },
                            bytes: { type: 'integer', required: true },
                            width: { type: 'integer', required: true },
                            height: { type: 'integer', required: true },
                            name: { type: 'string' },
                        },
                    },
                },
            },
            render: (_args, value) => previewContent(value),
        },
        isConcurrencySafe: () => false,
        async execute(args, exec) {
            if (args.target.trim().length === 0)
                throw new Error('target 不能为空');
            // 返回的是截图图片,要求当前模型能看图(与 read_image 同款门禁)。
            if (!(await currentModelCanSee(ctx, exec))) {
                throw new Error('meow_preview 返回的是截图图片,当前模型不支持看图。请切换到多模态模型,或用 meow_vision 描述图片。');
            }
            const config = loadPreviewConfig();
            const outcome = await manager.run(config, exec, {
                target: args.target.trim(),
                width: args.width ?? 1000,
                height: args.height ?? 800,
                waitMs: args.wait_ms ?? 0,
            });
            if (!outcome.ok)
                throw new Error(outcome.message);
            return { target: outcome.target, path: outcome.path, image: outcome.image };
        },
    }));
}
/** 注入系统提示词 hint：告诉模型何时该用 meow_vision。 */
function registerHint(ctx) {
    ctx.systemPrompt.section({
        name: 'meow-vision:hint',
        order: 150,
        text: '需要查看 png/jpeg/webp/gif 图片内容、而当前模型无法直接看图时，'
            + '调用 `meow_vision`（image_path 传图片路径，可带 question）。你会收到该图的文字描述。',
    });
}
/** 注入 meow_preview 的 demo 规范：让模型写可预测的最小组件 demo。 */
function registerPreviewHint(ctx) {
    ctx.systemPrompt.section({
        name: 'meow-preview:demo-note',
        order: 150,
        text: '【meow_preview】研究团队 UI 库组件的实际渲染效果(样式/边距/布局)时,写一个最小 demo 并预览:'
            + '1) 在 .preview/src/demos/ 写一个 kebab-case.vue,只渲染【一个】组件,显式设置要研究的 props/slots'
            + '(库组件已全局注册,直接写 <组件名> 即可);'
            + '2) 调用 meow_preview,target 填 demos/<名字>,你会收到实际渲染的截图;'
            + '3) 看截图调整组件写法,再预览迭代。'
            + '禁止:整页布局、多组件、业务数据、路由/状态管理、外部接口请求。这是研究单个组件行为的简单预览,不是整页预览。',
    });
}
/**
 * 插件入口：注册路由 + 工具 + 系统提示。
 * @param ctx    Cordis 上下文（webServer / tools / systemPrompt 服务）
 * @param config 插件配置（cordis.patch.yml config 字段；无配置时 Cordis 传 null，统一兜底空对象）
 */
export async function apply(ctx, config = {}) {
    const visionConfigFile = config?.visionConfigFile;
    const previewManager = new PreviewManager(ctx);
    registerWebRoutes(ctx);
    registerVisionTool(ctx, visionConfigFile);
    registerPreviewTool(ctx, previewManager);
    registerHint(ctx);
    registerPreviewHint(ctx);
    ctx.logger.info('[meow-vision] 已加载：设置 tab「meow-vision」+ meow_vision / meow_preview 工具 + /api/meow-vision/*');
    // disposer:插件卸载时 kill 常驻 dev server。
    return () => previewManager.stop();
}
