/**
 * meow-vision 候选列表 —— 从 dsh 已配置的模型里筛出视觉（多模态）模型。
 *
 * 浏览器半拿不到 `inputModalities`（前端 wire 结构只有 id/name/reasoning），
 * 多模态判定只在 host 侧 ctx.llm。所以候选列表由 node 半算好，经
 * `/api/meow-vision/candidates` 暴露给设置 tab。
 */
/**
 * 列出视觉模型候选：遍历 dsh 已配置的 configurable providers，
 * 对每个 provider 拉模型目录，过滤 `inputModalities` 含 `'image'` 的模型。
 * 单个 provider 拉模型失败（未配置 / 无网）跳过，不阻断整体。
 */
export async function listVisionCandidates(ctx) {
    const providers = ctx.llm.listConfigurableProviders();
    const out = [];
    for (const entry of providers) {
        let models;
        try {
            models = await ctx.llm.listModels(entry.provider);
        }
        catch {
            continue;
        }
        for (const model of models) {
            if (model.inputModalities?.includes('image')) {
                out.push({
                    provider: entry.provider,
                    providerName: entry.displayName,
                    model: model.id,
                    modelName: model.name,
                });
            }
        }
    }
    return out;
}
