/**
 * meow_preview 核心 —— 渲染一个页面(HTML / 路由 demo / URL)并 headless 截图。
 *
 * 三个动作：
 *   1. 脚手架(一次性)：在项目工作区生成零依赖的 .preview Vite 工程(复用宿主项目 node_modules)；
 *   2. dev server(常驻)：spawn 宿主项目的 vite,端口就绪探针,HMR 生效,插件卸载时 kill；
 *   3. headless 截图(每次)：Edge(→Chrome 兜底) --headless=new --screenshot,临时 PNG → saveImage。
 *
 * 零运行时 @deepseek-ai/* 值导入(本项目既定约定)：只用 ctx 服务 + node 内置 + type-only 类型。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { PreviewConfig } from './preview-config.js';
/** 截图附件的规范元数据(与 read_image 的 ImageReadValue.image 同构;headless 截图恒为 PNG)。 */
export interface PreviewImageValue {
    attachmentId: string;
    mediaType: 'image/png';
    bytes: number;
    width: number;
    height: number;
    name?: string;
}
/** 预览结果(成功 = 返回截图附件 + 落盘路径;失败 = 文本信息)。 */
export type PreviewOutcome = {
    ok: true;
    /** 实际渲染的 URL。 */
    target: string;
    /** 落盘的截图 png 绝对路径(.preview/shots/),可给用户看 / 按路径复用(meow_vision / read_image)。 */
    path: string;
    image: PreviewImageValue;
} | {
    ok: false;
    message: string;
};
/** meow_preview 工具参数(已归一化)。 */
export interface PreviewRequest {
    target: string;
    width: number;
    height: number;
    waitMs: number;
}
/** 触发预览的最小执行上下文(只取我们用到的字段,避免强依赖 dsh-tools 类型)。 */
export interface PreviewExec {
    signal: AbortSignal;
    agent?: unknown;
}
/** 预览管理器:持有常驻 dev server,负责脚手架/dev server/截图编排。 */
export declare class PreviewManager {
    private readonly ctx;
    private server;
    constructor(ctx: Context);
    /** 停掉常驻 dev server。 */
    stop(): void;
    /** 解析 .preview 的宿主项目根:previewDir 配置 → 会话工作区 → process.cwd()。 */
    private projectRoot;
    /** 确保 dev server 就绪,返回端口。 */
    private ensureDevServer;
    /** 轮询端口就绪或进程退出,最长 30s(首次冷启动 + 大库预构建可能较慢)。 */
    private waitReady;
    /**
     * 主入口:解析 target → 渲染 URL → headless 截图 → 存附件。
     */
    run(config: PreviewConfig, exec: PreviewExec, request: PreviewRequest): Promise<PreviewOutcome>;
}
/** 由成功结果重建 ImageAttachmentRef(render 用)。 */
export declare function refFromPreviewImage(image: PreviewImageValue): ImageAttachmentRef;
/** 由成功结果生成模型可见的信封文本(仿 read_image;带落盘路径)。 */
export declare function formatPreviewOutput(target: string, path: string, image: Pick<PreviewImageValue, 'mediaType' | 'bytes' | 'width' | 'height'>): string;
