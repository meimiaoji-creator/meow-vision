/**
 * meow-vision 候选列表 —— 从 dsh 已配置的模型里筛出视觉（多模态）模型。
 *
 * 浏览器半拿不到 `inputModalities`（前端 wire 结构只有 id/name/reasoning），
 * 多模态判定只在 host 侧 ctx.llm。所以候选列表由 node 半算好，经
 * `/api/meow-vision/candidates` 暴露给设置 tab。
 */
import type { Context } from '@deepseek-ai/cordis';
/** 一个可选的视觉模型候选。 */
export interface VisionCandidate {
    /** dsh provider route id。 */
    provider: string;
    /** provider 显示名（如 pi-ai 下的 route displayName）。 */
    providerName?: string;
    /** 模型 id。 */
    model: string;
    /** 模型显示名。 */
    modelName?: string;
}
/**
 * 列出视觉模型候选：遍历 dsh 已配置的 configurable providers，
 * 对每个 provider 拉模型目录，过滤 `inputModalities` 含 `'image'` 的模型。
 * 单个 provider 拉模型失败（未配置 / 无网）跳过，不阻断整体。
 */
export declare function listVisionCandidates(ctx: Context): Promise<VisionCandidate[]>;
