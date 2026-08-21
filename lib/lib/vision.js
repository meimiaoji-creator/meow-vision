/**
 * meow-vision 核心 —— 用配置的视觉模型识别一张图片，返回文字描述。
 *
 * 执行链路（与 dsh 自带 `read_image` 同构，但方向相反）：
 *   read_image：读图 → 存附件 → 把 image 块塞回主模型上下文；
 *   本模块：     读图 → 存附件 → 把 image 块发给【配置的视觉模型】→ 拿回文本。
 *
 * 视觉调用复用 dsh 自己的 LLM 栈（ctx.llm.stream），图片编码/凭据/base_url/重试全部由 dsh 接管；
 * 插件只记 provider + model 两个 id，不落密钥、不实现自定义 HTTP。
 * node 半零运行时 `@deepseek-ai/*` 值导入（本项目既定约定）：只用 ctx 服务，消息对象手工构造。
 */
import { basename } from 'node:path';
/**
 * 视觉 prompt 模板 —— 输出契约的核心。
 * 逼视觉模型产出"忠实、聚焦问题、无前缀注释"的纯描述文本，恰好是主模型能直接消费的感知数据。
 */
export const VISION_SYSTEM_PROMPT = 'You are a vision subsystem of a text-only coding agent. '
    + 'Describe the image faithfully and completely. '
    + 'If a question is provided, answer it precisely based on what is visible in the image. '
    + 'Output ONLY the answer text — no preamble, no commentary, no suggestions.';
/** 扩展名 → 图片媒体类型（与 dsh read_image 的判定一致）。 */
const IMAGE_EXT = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
};
/** 按文件扩展名识别图片媒体类型；不支持 → undefined。 */
export function mediaTypeForPath(path) {
    const dot = path.lastIndexOf('.');
    if (dot < 0)
        return undefined;
    return IMAGE_EXT[path.slice(dot).toLowerCase()];
}
/** 消息 deep-freeze（等价 dsh 的 freezeMessage 语义，避免引入运行时值导入）。 */
function deepFreeze(value) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) {
            deepFreeze(value[key]);
        }
    }
    return value;
}
/** 安全提取 Error 消息。 */
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * 用配置的视觉模型识别一张图片。
 * @param ctx       Cordis 上下文（ctx.fs / ctx.attachments / ctx.llm）
 * @param config    视觉模型配置（provider + model）
 * @param imagePath 图片文件路径（png/jpeg/webp/gif）
 * @param question  可选问题；留空则返回完整描述
 * @param signal    取消信号（透传 exec.signal，主 agent 中断时中止视觉调用）
 */
export async function runVisionModel(ctx, config, imagePath, question, signal) {
    // 1) 读图片字节（沿用 ctx.fs + 附件上限，与 read_image 同构）。
    let target;
    try {
        target = await ctx.fs.resolve(imagePath, { signal });
    }
    catch (error) {
        return { ok: false, reason: 'error', message: `图片路径无法解析(${imagePath}): ${errorMessage(error)}` };
    }
    const byteCap = ctx.attachments.imageLimits.maxImageBytes;
    let bytes;
    try {
        bytes = await ctx.fs.readBytes(target, signal, byteCap);
    }
    catch (error) {
        return { ok: false, reason: 'error', message: `读取图片失败(${imagePath}): ${errorMessage(error)}` };
    }
    // 2) 判媒体类型（扩展名）。
    const mediaType = mediaTypeForPath(imagePath);
    if (mediaType === undefined) {
        return {
            ok: false,
            reason: 'error',
            message: `不支持的图片类型: ${imagePath}（仅支持 png/jpeg/webp/gif）`,
        };
    }
    // 3) 存为附件，拿 ImageAttachmentRef。
    let ref;
    try {
        ref = await ctx.attachments.saveImage({ data: bytes, mediaType, name: basename(imagePath) });
    }
    catch (error) {
        return { ok: false, reason: 'error', message: `图片附件处理失败: ${errorMessage(error)}` };
    }
    // 4) 构造一次用户消息（text + image），发给配置的视觉模型。
    const message = deepFreeze({
        id: crypto.randomUUID(),
        role: 'user',
        content: [
            { type: 'text', text: question?.trim() || 'Describe this image in detail.' },
            { type: 'image', attachment: ref },
        ],
        source: { kind: 'plugin', plugin: 'meow-vision' },
    });
    // 5) 单次往返调用（maxTokens 上限，防视觉模型啰嗦）。
    const chunks = ctx.llm.stream({
        provider: config.provider,
        model: config.model,
        system: VISION_SYSTEM_PROMPT,
        messages: [message],
        maxTokens: 2048,
        signal,
    });
    // 6) 收集文本（等价 BlockAssembler 的 text-delta 累积 + finish 判定）。
    let text = '';
    for await (const chunk of chunks) {
        if (chunk.type === 'text-delta') {
            text += chunk.text;
        }
        else if (chunk.type === 'finish') {
            if (chunk.reason.kind === 'error') {
                const failure = chunk.reason.failure;
                return { ok: false, reason: 'error', message: `视觉模型调用失败: ${failure?.message ?? '未知错误'}` };
            }
            if (chunk.reason.kind === 'aborted') {
                return { ok: false, reason: 'aborted', message: '视觉模型调用被中断' };
            }
        }
    }
    const result = text.trim();
    if (result === '')
        return { ok: false, reason: 'error', message: '视觉模型未返回任何文本' };
    return { ok: true, text: result };
}
