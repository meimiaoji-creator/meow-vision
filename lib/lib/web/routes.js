/**
 * meow-vision Web 路由 —— /api/meow-vision/* 三条路由。
 *
 *   - GET  /api/meow-vision/config      读当前视觉模型配置（未配置 → config: null）
 *   - POST /api/meow-vision/config      写视觉模型配置（body { provider, model } → vision.json）
 *   - GET  /api/meow-vision/candidates  视觉模型候选列表（dsh 已配置模型里过滤多模态）
 *
 * 约束（与 meow-file-view / meow-dsh-task 一致）：
 *   - 不抢 `registerFallback`，只用 prefix 命名路由；
 *   - 同源（http://127.0.0.1:3080），无 CORS；
 *   - 零 dsh 源码改动；`ctx.webServer` 类型经 `@deepseek-ai/dsh-host-webserver` 的
 *     module augmentation 提供（`import type {}` 仅为加载声明，运行时无此 import）。
 */
import { loadVisionConfig, saveVisionConfig } from '../config.js';
import { listVisionCandidates } from '../candidates.js';
import { DEFAULT_PREVIEW_PORT, loadPreviewConfig, savePreviewConfig } from '../preview-config.js';
const API_PREFIX = '/api/meow-vision';
function sendJson(res, status, json) {
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(JSON.stringify(json));
}
/** 读请求体并 JSON.parse；空体 → undefined，非法 JSON → reject。 */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk.toString('utf8'); });
        req.on('end', () => {
            try {
                resolve(data.trim() === '' ? undefined : JSON.parse(data));
            }
            catch {
                reject(new Error('请求体不是合法 JSON'));
            }
        });
        req.on('error', reject);
    });
}
/** /api/meow-vision/* 统一分发。 */
async function handleApi(req, res, ctx) {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;
    try {
        // ---- 读配置 ----
        if (req.method === 'GET' && path === `${API_PREFIX}/config`) {
            sendJson(res, 200, { config: loadVisionConfig() ?? null });
            return;
        }
        // ---- 写配置 ----
        if (req.method === 'POST' && path === `${API_PREFIX}/config`) {
            const body = (await readJsonBody(req));
            const provider = typeof body?.provider === 'string' ? body.provider.trim() : '';
            const model = typeof body?.model === 'string' ? body.model.trim() : '';
            if (!provider || !model) {
                sendJson(res, 400, { error: 'provider 和 model 不能为空' });
                return;
            }
            saveVisionConfig({ provider, model });
            sendJson(res, 200, { ok: true });
            return;
        }
        // ---- 视觉候选 ----
        if (req.method === 'GET' && path === `${API_PREFIX}/candidates`) {
            const candidates = await listVisionCandidates(ctx);
            sendJson(res, 200, { candidates });
            return;
        }
        // ---- 预览配置(读) ----
        if (req.method === 'GET' && path === `${API_PREFIX}/preview-config`) {
            sendJson(res, 200, { config: loadPreviewConfig() });
            return;
        }
        // ---- 预览配置(写) ----
        if (req.method === 'POST' && path === `${API_PREFIX}/preview-config`) {
            const body = (await readJsonBody(req));
            const libName = typeof body?.libName === 'string' ? body.libName.trim() : '';
            const previewDir = typeof body?.previewDir === 'string' ? body.previewDir.trim() : '';
            const port = typeof body?.port === 'number' && Number.isInteger(body.port)
                && body.port > 0 && body.port < 65536
                ? body.port
                : DEFAULT_PREVIEW_PORT;
            savePreviewConfig({ libName, port, previewDir });
            sendJson(res, 200, { ok: true });
            return;
        }
        sendJson(res, 404, { error: 'Not Found' });
    }
    catch (error) {
        console.error('[meow-vision/api] 内部错误:', error);
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
}
/**
 * 注册 Web 路由（/api/meow-vision/*）。
 * @param ctx Cordis 上下文（webServer 服务由 web profile 提供）
 */
export function registerWebRoutes(ctx) {
    ctx.webServer.register({
        kind: 'prefix',
        path: API_PREFIX,
        handler: (req, res) => void handleApi(req, res, ctx),
    });
}
