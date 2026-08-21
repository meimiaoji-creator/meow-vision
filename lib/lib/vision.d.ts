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
import type { Context } from '@deepseek-ai/cordis';
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { VisionConfig } from './config.js';
/**
 * 视觉 prompt 模板 —— 输出契约的核心。
 * 逼视觉模型产出"忠实、聚焦问题、无前缀注释"的纯描述文本，恰好是主模型能直接消费的感知数据。
 */
export declare const VISION_SYSTEM_PROMPT: string;
/** 按文件扩展名识别图片媒体类型；不支持 → undefined。 */
export declare function mediaTypeForPath(path: string): ImageMediaType | undefined;
/** 视觉调用的结果。 */
export type VisionOutcome = {
    ok: true;
    text: string;
} | {
    ok: false;
    reason: 'error' | 'aborted';
    message: string;
};
/**
 * 用配置的视觉模型识别一张图片。
 * @param ctx       Cordis 上下文（ctx.fs / ctx.attachments / ctx.llm）
 * @param config    视觉模型配置（provider + model）
 * @param imagePath 图片文件路径（png/jpeg/webp/gif）
 * @param question  可选问题；留空则返回完整描述
 * @param signal    取消信号（透传 exec.signal，主 agent 中断时中止视觉调用）
 */
export declare function runVisionModel(ctx: Context, config: VisionConfig, imagePath: string, question: string | undefined, signal: AbortSignal): Promise<VisionOutcome>;
