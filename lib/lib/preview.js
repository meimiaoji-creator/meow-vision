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
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
/** 渲染截图的视口上限,防模型传离谱尺寸。 */
const MAX_DIMENSION = 4000;
// ---------------------------------------------------------------------------
// 脚手架模板(固定,生成后仅当配置的库包名变化才重写;demos/ 永不覆盖)
// ---------------------------------------------------------------------------
const SCAFFOLD_META = '.meow-preview-meta.json';
const INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>meow preview</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;
const VITE_CONFIG_JS = `// 由 meow-vision 插件生成。端口由插件运行时 --port 指定。
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    open: false,
  },
})
`;
const ROUTER_JS = `// 由 meow-vision 插件生成。demos/ 下每个 <name>.vue 自动成为 /demos/<name> 路由。
import { createRouter, createWebHistory } from 'vue-router'

const demos = import.meta.glob('./demos/*.vue', { eager: true })

const routes = Object.entries(demos).map(([path, mod]) => {
  const name = path.split('/').pop().replace(/\\.vue$/, '')
  return { path: '/demos/' + name, name, component: mod.default }
})

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...routes,
    { path: '/', redirect: routes[0] ? routes[0].path : '/none' },
    {
      path: '/none',
      component: { template: '<p style="color:#999">尚无 demo —— 请在 .preview/src/demos/ 写一个 &lt;name&gt;.vue</p>' },
    },
  ],
})
`;
const APP_VUE = `<template>
  <div class="mv-page"><router-view /></div>
</template>

<style>
body { margin: 0; background: #f5f6f7; }
.mv-page { padding: 40px; min-height: 100vh; box-sizing: border-box; }
</style>
`;
/** 按库包名渲染 main.js(库特定模板;未知库给通用模板)。 */
function renderMainJs(libName) {
    const lines = [
        '// 由 meow-vision 插件生成。配置里的库包名变化会重新生成本文件。',
        "import { createApp } from 'vue'",
    ];
    const uses = [];
    if (libName !== '') {
        const tpl = libTemplate(libName);
        lines.push(tpl.importLine);
        for (const styleLine of tpl.styleLines)
            lines.push(styleLine);
        uses.push(tpl.useLine);
    }
    lines.push("import App from './App.vue'");
    lines.push("import { router } from './router'");
    lines.push('');
    lines.push('const app = createApp(App)');
    for (const useLine of uses)
        lines.push(useLine);
    lines.push('app.use(router)');
    lines.push("app.mount('#app')");
    return lines.join('\n') + '\n';
}
/** 已知库的接入模板;未知库给通用模板 + TODO 提示(可改生成的 main.js)。 */
function libTemplate(libName) {
    if (libName === '@sky/sky-ui') {
        return {
            importLine: "import SkyUI from '@sky/sky-ui'",
            styleLines: [
                "import '@sky/sky-ui/dist/sky.min.css'",
                "import '@sky/sky-ui/icon/iconfont/iconfont.css'",
            ],
            useLine: 'app.use(SkyUI)',
        };
    }
    return {
        importLine: `import Lib from '${libName}'`,
        styleLines: ['// TODO: 按该库的样式引入约定补样式 import,或直接改本文件'],
        useLine: 'app.use(Lib)',
    };
}
/** 生成/复用脚手架。demos/ 永不覆盖;插件侧文件仅当库包名变化才重写。 */
function ensureScaffold(dir, config) {
    const metaFile = join(dir, SCAFFOLD_META);
    if (existsSync(join(dir, 'package.json'))) {
        try {
            const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
            if (meta.libName === config.libName)
                return; // 配置没变 → 复用(保留模型改过的文件)
        }
        catch {
            // meta 缺失 → 重写插件侧文件
        }
    }
    mkdirSync(join(dir, 'src', 'demos'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'meow-preview', private: true, type: 'module' }, null, 2), 'utf8');
    writeFileSync(join(dir, 'index.html'), INDEX_HTML, 'utf8');
    writeFileSync(join(dir, 'vite.config.js'), VITE_CONFIG_JS, 'utf8');
    writeFileSync(join(dir, 'src', 'main.js'), renderMainJs(config.libName), 'utf8');
    writeFileSync(join(dir, 'src', 'router.js'), ROUTER_JS, 'utf8');
    writeFileSync(join(dir, 'src', 'App.vue'), APP_VUE, 'utf8');
    writeFileSync(metaFile, JSON.stringify({ libName: config.libName }, null, 2), 'utf8');
}
// ---------------------------------------------------------------------------
// dev server 管理
// ---------------------------------------------------------------------------
/** 从工具执行上下文提取会话工作区 cwd(结构性访问,不依赖 dsh-tools 类型)。 */
function workspaceCwdOf(exec) {
    const agent = exec.agent;
    return agent?.session?.header?.cwd;
}
/** TCP 端口探活。 */
function portUp(port, timeoutMs = 1200) {
    return new Promise((resolve) => {
        const sock = net.connect({ host: '127.0.0.1', port });
        let done = false;
        const finish = (value) => {
            if (done)
                return;
            done = true;
            sock.destroy();
            resolve(value);
        };
        sock.once('connect', () => finish(true));
        sock.once('error', () => finish(false));
        sock.setTimeout(timeoutMs, () => finish(false));
    });
}
/** 预览管理器:持有常驻 dev server,负责脚手架/dev server/截图编排。 */
export class PreviewManager {
    ctx;
    server;
    constructor(ctx) {
        this.ctx = ctx;
        // dev server 的停靠在 apply() 返回的 disposer 里调用(插件卸载时 kill)。
    }
    /** 停掉常驻 dev server。 */
    stop() {
        if (this.server === undefined)
            return;
        try {
            this.server.proc.kill();
        }
        catch {
            // 进程已退出
        }
        this.server = undefined;
    }
    /** 解析 .preview 的宿主项目根:previewDir 配置 → 会话工作区 → process.cwd()。 */
    projectRoot(config, exec) {
        const workspace = workspaceCwdOf(exec);
        return config.previewDir.trim() !== '' ? config.previewDir.trim() : (workspace ?? process.cwd());
    }
    /** 确保 dev server 就绪,返回端口。 */
    async ensureDevServer(config, projectRoot) {
        const scaffoldDir = join(projectRoot, '.preview');
        ensureScaffold(scaffoldDir, config);
        const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
        if (!existsSync(viteBin)) {
            throw new Error(`未在项目 node_modules 找到 vite(${viteBin})。预览要求宿主项目是 Vite+Vue3 工程。`);
        }
        // 复用已在跑且端口活的实例
        if (this.server !== undefined && this.server.dir === scaffoldDir && await portUp(this.server.port)) {
            return this.server.port;
        }
        this.stop();
        // 从配置端口起找空闲端口;strictPort 防抢占
        for (let i = 0; i < 20; i++) {
            const port = config.port + i;
            if (await portUp(port))
                continue;
            const proc = spawn(process.execPath, [
                viteBin,
                '--port', String(port),
                '--strictPort',
            ], { cwd: scaffoldDir, stdio: 'ignore' });
            // 子进程退出 → 清状态,下次调用重新拉起
            proc.once('exit', () => {
                if (this.server?.proc === proc)
                    this.server = undefined;
            });
            this.server = { proc, port, dir: scaffoldDir };
            if (await this.waitReady(proc, port))
                return port;
            this.stop(); // 启动失败(如端口竞争)→ 下个端口重试
        }
        throw new Error('无法启动预览 dev server(连续端口均失败)。');
    }
    /** 轮询端口就绪或进程退出,最长 30s(首次冷启动 + 大库预构建可能较慢)。 */
    waitReady(proc, port, timeoutMs = 30000) {
        const deadline = Date.now() + timeoutMs;
        return new Promise((resolve) => {
            const timer = setInterval(() => {
                void (async () => {
                    if (proc.exitCode !== null || Date.now() > deadline) {
                        clearInterval(timer);
                        resolve(false);
                        return;
                    }
                    if (await portUp(port)) {
                        clearInterval(timer);
                        resolve(true);
                    }
                })();
            }, 300);
        });
    }
    /**
     * 主入口:解析 target → 渲染 URL → headless 截图 → 存附件。
     */
    async run(config, exec, request) {
        const { signal } = exec;
        let url;
        try {
            if (/^https?:\/\//i.test(request.target)) {
                url = request.target;
            }
            else if (/^demos\//.test(request.target)) {
                if (config.libName === '') {
                    return { ok: false, message: 'target 为 demos/ 路由但未配置团队库包名(libName)。请在设置 → meow-vision → 预览配置 里填库包名,组件 demo 才能 import。' };
                }
                const port = await this.ensureDevServer(config, this.projectRoot(config, exec));
                url = `http://127.0.0.1:${port}/${request.target}`;
            }
            else {
                // 本地文件(纯 HTML 快速预览)
                const fsTarget = await this.ctx.fs.resolve(request.target, { signal });
                const osPath = this.ctx.fs.processPath(fsTarget);
                url = 'file:///' + osPath.replace(/\\/g, '/');
            }
        }
        catch (error) {
            return { ok: false, message: errorMessage(error) };
        }
        try {
            const data = await screenshot(url, request.width, request.height, request.waitMs, signal);
            const name = (basename(url).split('?')[0] || 'preview').replace(/[^a-z0-9-_.]/gi, '_').slice(0, 40);
            // 落盘:截图持久化到 .preview/shots/,供用户查看 / 按路径复用(meow_vision / read_image)。
            const shotPath = persistShot(join(this.projectRoot(config, exec), '.preview', 'shots'), name, data);
            const ref = await this.ctx.attachments.saveImage({ data, mediaType: 'image/png', name });
            return {
                ok: true,
                target: url,
                path: shotPath,
                image: {
                    attachmentId: ref.attachmentId,
                    mediaType: 'image/png',
                    bytes: ref.bytes,
                    width: ref.width,
                    height: ref.height,
                    ...(ref.name === undefined ? {} : { name: ref.name }),
                },
            };
        }
        catch (error) {
            return { ok: false, message: errorMessage(error) };
        }
    }
}
// ---------------------------------------------------------------------------
// headless 截图
// ---------------------------------------------------------------------------
/** 探测可用浏览器:Edge 优先(系统自带),Chrome 兜底。 */
function findBrowser() {
    const envs = [
        process.env['PROGRAMFILES(X86)'],
        process.env.PROGRAMFILES,
    ].filter((v) => typeof v === 'string');
    const hardcoded = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const candidates = [
        ...envs.map(e => `${e}\\Microsoft\\Edge\\Application\\msedge.exe`),
        ...envs.map(e => `${e}\\Google\\Chrome\\Application\\chrome.exe`),
        ...hardcoded,
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return undefined;
}
/** headless 截图:返回 PNG 字节。 */
async function screenshot(url, width, height, waitMs, signal) {
    const browser = findBrowser();
    if (browser === undefined) {
        throw new Error('未检测到 Edge/Chrome,无法截图预览。请安装 Edge 或 Chrome。');
    }
    const w = clampDimension(width, 1000);
    const h = clampDimension(height, 800);
    const budget = Math.max(800, Math.min(15000, waitMs > 0 ? waitMs : 3000));
    const out = join(tmpdir(), `meow-preview-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`);
    const args = [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        `--window-size=${w},${h}`,
        `--virtual-time-budget=${budget}`,
        `--screenshot=${out}`,
        url,
    ];
    await runBrowser(browser, args, signal);
    try {
        return readFileSync(out);
    }
    finally {
        rmSync(out, { force: true });
    }
}
function clampDimension(value, fallback) {
    return Number.isInteger(value) && value > 0 && value <= MAX_DIMENSION ? value : fallback;
}
/** 跑浏览器进程;尊重 signal 中断。 */
function runBrowser(bin, args, signal) {
    return new Promise((resolve, reject) => {
        const child = spawn(bin, args, { stdio: 'ignore' });
        const onAbort = () => {
            try {
                child.kill();
            }
            catch { /* 已退出 */ }
        };
        if (signal.aborted) {
            onAbort();
            reject(new Error('预览已中断'));
            return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
        child.once('error', (error) => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
        });
        child.once('close', (code) => {
            signal.removeEventListener('abort', onAbort);
            if (code === 0)
                resolve();
            else
                reject(new Error(`headless 截图进程退出码 ${code}`));
        });
    });
}
/** 安全提取 Error 消息。 */
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
/** 截图落盘到 .preview/shots/<name>-<ts>.png;顺带清理超龄截图,防无限堆积。 */
function persistShot(dir, name, data) {
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${name}-${Date.now()}.png`);
    writeFileSync(file, data);
    pruneShots(dir, 24 * 60 * 60 * 1000); // 只留 24h 内
    return file;
}
/** 删除目录下超过 maxAgeMs 的截图文件(单文件失败忽略,目录不存在忽略)。 */
function pruneShots(dir, maxAgeMs) {
    try {
        const now = Date.now();
        for (const entry of readdirSync(dir)) {
            const file = join(dir, entry);
            try {
                if (statSync(file).mtimeMs < now - maxAgeMs)
                    rmSync(file, { force: true });
            }
            catch {
                // 单个文件清理失败 → 忽略
            }
        }
    }
    catch {
        // 目录不存在 → 忽略
    }
}
/** 由成功结果重建 ImageAttachmentRef(render 用)。 */
export function refFromPreviewImage(image) {
    return {
        attachmentId: image.attachmentId,
        mediaType: image.mediaType,
        bytes: image.bytes,
        width: image.width,
        height: image.height,
        ...(image.name === undefined ? {} : { name: image.name }),
    };
}
/** 由成功结果生成模型可见的信封文本(仿 read_image;带落盘路径)。 */
export function formatPreviewOutput(target, path, image) {
    return `<target>${target}</target>
<path>${path}</path>
<type>image</type>
<content>
${image.mediaType} image, ${image.width}x${image.height} px, ${image.bytes} bytes
</content>`;
}
