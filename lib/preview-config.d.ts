/**
 * meow-vision 预览配置 —— preview.json 读写。
 *
 * 与 vision.json(视觉模型)平级、互不破坏。存预览功能的三个可配置项：
 *   - libName   : 团队 UI 库包名(如 @sky/sky-ui)。空 = 不引库(纯 HTML demo 可用),组件预览必填。
 *   - port      : dev server 端口;冲突时自动 +1。
 *   - previewDir: 预览脚手架 .preview 的生成位置;空 = 工作区根。
 */
/** 预览配置。 */
export interface PreviewConfig {
    /** 团队 UI 库包名;空串表示不引库。 */
    libName: string;
    /** dev server 端口(1-65535)。 */
    port: number;
    /** .preview 脚手架生成位置;空串 = 工作区根。 */
    previewDir: string;
}
/** 默认端口(避开 vite 默认 5173 / 常见 3000/8080)。 */
export declare const DEFAULT_PREVIEW_PORT = 4173;
/**
 * 读取预览配置;文件缺失/损坏/字段非法 → 回落默认值(不会 undefined)。
 * 与 loadVisionConfig 不同:预览有一组可用的默认值(空库名 + 4173 + 空目录)。
 */
export declare function loadPreviewConfig(fileName?: string): PreviewConfig;
/**
 * 保存预览配置(覆盖写)。
 * @param config 规范化后的预览配置
 * @param fileName 配置文件相对插件根的名字;缺省 'preview.json'
 */
export declare function savePreviewConfig(config: PreviewConfig, fileName?: string): void;
