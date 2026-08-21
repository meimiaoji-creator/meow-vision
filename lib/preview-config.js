/**
 * meow-vision 预览配置 —— preview.json 读写。
 *
 * 与 vision.json(视觉模型)平级、互不破坏。存预览功能的三个可配置项：
 *   - libName   : 团队 UI 库包名(如 @sky/sky-ui)。空 = 不引库(纯 HTML demo 可用),组件预览必填。
 *   - port      : dev server 端口;冲突时自动 +1。
 *   - previewDir: 预览脚手架 .preview 的生成位置;空 = 工作区根。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
/** 默认端口(避开 vite 默认 5173 / 常见 3000/8080)。 */
export const DEFAULT_PREVIEW_PORT = 4173;
/** preview.json 的持久化文件名(插件根相对)。 */
const DEFAULT_FILE = 'preview.json';
/** 插件根目录:lib/preview-config.js 的上一级。 */
function pluginRoot() {
    return fileURLToPath(new URL('../', import.meta.url));
}
/** 解析配置文件路径;带路径前缀的名字走相对 import.meta.url,否则相对插件根。 */
function configFile(fileName) {
    return fileName.includes('/') || fileName.includes('\\') || fileName.startsWith('.')
        ? fileURLToPath(new URL(fileName, import.meta.url))
        : pluginRoot() + fileName;
}
/**
 * 读取预览配置;文件缺失/损坏/字段非法 → 回落默认值(不会 undefined)。
 * 与 loadVisionConfig 不同:预览有一组可用的默认值(空库名 + 4173 + 空目录)。
 */
export function loadPreviewConfig(fileName = DEFAULT_FILE) {
    try {
        const raw = JSON.parse(readFileSync(configFile(fileName), 'utf8'));
        const libName = typeof raw.libName === 'string' ? raw.libName.trim() : '';
        const port = typeof raw.port === 'number' && Number.isInteger(raw.port)
            && raw.port > 0 && raw.port < 65536
            ? raw.port
            : DEFAULT_PREVIEW_PORT;
        const previewDir = typeof raw.previewDir === 'string' ? raw.previewDir.trim() : '';
        return { libName, port, previewDir };
    }
    catch {
        return { libName: '', port: DEFAULT_PREVIEW_PORT, previewDir: '' };
    }
}
/**
 * 保存预览配置(覆盖写)。
 * @param config 规范化后的预览配置
 * @param fileName 配置文件相对插件根的名字;缺省 'preview.json'
 */
export function savePreviewConfig(config, fileName = DEFAULT_FILE) {
    writeFileSync(configFile(fileName), JSON.stringify(config, null, 2), 'utf8');
}
