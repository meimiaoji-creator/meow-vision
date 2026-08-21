/**
 * meow-vision 配置 —— vision.json 读写。
 *
 * 视觉模型配置只存 `provider` + `model` 两个 id（指向 dsh 已配置的 provider route + 模型 id），
 * API key / base_url / 重试全部由 dsh 的 LLM 栈接管，插件不落任何密钥。
 * 文件放在插件根目录（vision.json，随 dist 分发、可编辑），与 meow-skill 的 server.json 同款模式。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
/** vision.json 的持久化文件名（插件根相对）。 */
const DEFAULT_FILE = 'vision.json';
/** 插件根目录：lib/config.js 的上一级。 */
function pluginRoot() {
    return fileURLToPath(new URL('../', import.meta.url));
}
/** 解析配置文件路径；带路径前缀的名字走相对 import.meta.url，否则相对插件根。 */
function configFile(fileName) {
    return fileName.includes('/') || fileName.includes('\\') || fileName.startsWith('.')
        ? fileURLToPath(new URL(fileName, import.meta.url))
        : pluginRoot() + fileName;
}
/**
 * 读取视觉模型配置。
 * @param fileName 配置文件相对插件根的名字；缺省 'vision.json'
 * @returns 完整配置；文件缺失 / JSON 损坏 / provider 或 model 为空 → undefined（未配置）
 */
export function loadVisionConfig(fileName = DEFAULT_FILE) {
    try {
        const raw = JSON.parse(readFileSync(configFile(fileName), 'utf8'));
        const provider = typeof raw.provider === 'string' ? raw.provider.trim() : '';
        const model = typeof raw.model === 'string' ? raw.model.trim() : '';
        if (!provider || !model)
            return undefined;
        return { provider, model };
    }
    catch {
        return undefined;
    }
}
/**
 * 保存视觉模型配置（覆盖写）。
 * @param config 非空的 provider + model
 * @param fileName 配置文件相对插件根的名字；缺省 'vision.json'
 */
export function saveVisionConfig(config, fileName = DEFAULT_FILE) {
    writeFileSync(configFile(fileName), JSON.stringify(config, null, 2), 'utf8');
}
