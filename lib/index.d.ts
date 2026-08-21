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
import type { Context } from '@deepseek-ai/cordis';
/** 插件名（Cordis 行 id 之外的插件标识）。 */
export declare const name = "meow-vision";
/** 需要的服务：web 路由 + 工具注册表 + 系统提示词 + 模型/附件/文件系统。
 *   llm / attachments / fs 必须在 inject 里声明，否则 cordis 的属性访问守卫
 *   （cannot get property "llm" without inject）会在运行时抛错。 */
export declare const inject: string[];
/** 插件行配置。 */
export interface VisionPluginConfig {
    /** vision.json 的相对路径（相对插件根）；缺省 'vision.json'。 */
    visionConfigFile?: string;
}
/**
 * 插件入口：注册路由 + 工具 + 系统提示。
 * @param ctx    Cordis 上下文（webServer / tools / systemPrompt 服务）
 * @param config 插件配置（cordis.patch.yml config 字段；无配置时 Cordis 传 null，统一兜底空对象）
 */
export declare function apply(ctx: Context, config?: Partial<VisionPluginConfig> | null): Promise<() => void>;
