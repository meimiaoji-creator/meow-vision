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
import type { Context } from '@deepseek-ai/cordis';
/**
 * 注册 Web 路由（/api/meow-vision/*）。
 * @param ctx Cordis 上下文（webServer 服务由 web profile 提供）
 */
export declare function registerWebRoutes(ctx: Context): void;
