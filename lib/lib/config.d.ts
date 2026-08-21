/**
 * meow-vision 配置 —— vision.json 读写。
 *
 * 视觉模型配置只存 `provider` + `model` 两个 id（指向 dsh 已配置的 provider route + 模型 id），
 * API key / base_url / 重试全部由 dsh 的 LLM 栈接管，插件不落任何密钥。
 * 文件放在插件根目录（vision.json，随 dist 分发、可编辑），与 meow-skill 的 server.json 同款模式。
 */
/** 视觉模型配置：dsh provider route + 模型 id。 */
export interface VisionConfig {
    /** dsh 已注册的 provider route（如 pi-ai 下的某个 route id）。 */
    provider: string;
    /** 该 provider 下的模型 id。 */
    model: string;
}
/**
 * 读取视觉模型配置。
 * @param fileName 配置文件相对插件根的名字；缺省 'vision.json'
 * @returns 完整配置；文件缺失 / JSON 损坏 / provider 或 model 为空 → undefined（未配置）
 */
export declare function loadVisionConfig(fileName?: string): VisionConfig | undefined;
/**
 * 保存视觉模型配置（覆盖写）。
 * @param config 非空的 provider + model
 * @param fileName 配置文件相对插件根的名字；缺省 'vision.json'
 */
export declare function saveVisionConfig(config: VisionConfig, fileName?: string): void;
