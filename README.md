# meow-vision

> **dsh-plugin** for DeepSeek Harness（DSH）：给文本模型补一双眼睛，给多模态模型补一对"看 UI 渲染"的眼睛。

[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/meimiaoji-creator/meow-vision)

`meow-vision` 提供两个工具：
<img width="1920" height="868" alt="image" src="https://github.com/user-attachments/assets/0d4b98bb-aa8f-42cc-ab12-eb5fe2c770f3" />
<img width="1920" height="869" alt="image_17871299533278" src="https://github.com/user-attachments/assets/11f14eb7-cb89-4c0f-bdad-20576522f709" />


1. **`meow_vision`** — 当你正在用的模型**不能直接看图**时（非多模态会话），调用它，由你预先在设置里指定的视觉模型识别图片并返回文字描述。
2. **`meow_preview`** — 渲染一个页面（本地 Vue demo、URL、HTML 文件）并把截图**作为图片**返回给当前模型，让多模态模型能"看见"组件真实渲染效果（样式/边距/布局），方便迭代 UI 组件写法。

零 dsh 源码改动；与 dsh-meow-skill / meow-file-view / meow-dsh-task 平级共存，互不影响。

---

## 安装

通过 dsh 官方插件管理器安装（profile = web）：

```bash
dsh 插件 --profile web add meow-vision
```

如果你想直接装 GitHub 仓库的 main 分支：

```bash
dsh 插件 --profile web add github:meimiaoji-creator/meow-vision
```

安装完成后，重启 dsh 即可在设置弹窗看到 **meow-vision** 配置 tab，模型工具列表里也会多出 `meow_vision` 和 `meow_preview` 两个工具。

---

## 功能一：`meow_vision` —— 给纯文本模型补一双眼睛

### 适用场景

当前模型无法直接处理图片（`read_image` 工具会被 dsh 的多模态门禁拒绝），但你又需要把一张图（截图、UI 设计稿、报错截图）喂给模型"看"。

### 配置

1. 打开 dsh 设置 → **meow-vision** tab → **视觉模型** 区块。
2. 从候选列表里选一个**多模态模型**作为视觉模型（候选列表自动从 dsh 已配置的模型里过滤 `inputModalities` 含 `image` 的）。
3. 保存。配置会写入插件根目录的 `vision.json`。

### 用法

模型（即使是文本模型）会自动调用：

```text
调用 meow_vision(image_path="/path/to/screenshot.png", question="这个报错的堆栈含义是什么？")
```

模型会收到该图的文字描述，然后继续推理。

> 主模型本身就是多模态时，`meow_vision` 会自动提示模型改用 `read_image` 直接看图，避免绕道。

---

## 功能二：`meow_preview` —— 给多模态模型补"看见 UI 渲染"的眼睛

### 适用场景

团队 UI 库组件的真实渲染样式（padding、margin、hover、disabled 等）往往和文档描述对不上。让多模态模型自己"截图看一眼"是最快的迭代方式。

### 配置

在同一个 **meow-vision** tab → **预览配置** 区块填：

| 字段 | 含义 | 示例 |
|---|---|---|
| `libName` | 团队 UI 库的 npm 包名（用于 `demos/<名字>` 时定位 dev server） | `@sky/sky-ui` |
| `port` | dev server 端口（默认 4173） | `4173` |
| `.preview 目录` | 你的 Vue demo 工作目录绝对路径 | `/Users/you/work/my-lib/.preview` |

### 用法（推荐写法：demos/<名字>）

在 `.preview/src/demos/` 写一个**最小** Vue demo（**只渲染一个组件**，显式设置要研究的 props/slots；库组件已全局注册，直接写 `<组件名>` 即可）：

```vue
<!-- .preview/src/demos/button-basic.vue -->
<template>
  <Button size="small" disabled>禁用小号按钮</Button>
</template>
```

然后让模型调用：

```text
调用 meow_preview(target="demos/button-basic")
```

返回的是截图图片（自动喂给当前多模态模型的视觉通道），模型能直接"看见"组件真实样式，然后按需调整 props/slots，再 `meow_preview` 迭代。

### 其他 target 形式

| 形式 | 用途 |
|---|---|
| `demos/button-basic` | 预览 `.preview/src/demos/button-basic.vue`（推荐，最稳） |
| `https://example.com/page` | 截图任意公网 URL |
| `file:///path/to/index.html` | 截图本地静态 HTML |

### 强制规则

- **禁止**整页布局、**禁止**多组件同框、**禁止**业务数据/路由/状态管理/外部接口请求。
- 这是研究**单个组件行为**的简单预览，不是整页预览。
- 截图保存在 `.preview/shots/<name>.png`，可再用 `read_image` 或 `meow_vision` 复用。

---

## 工具输出示例

### `meow_vision`

输入：

```json
{ "image_path": "/tmp/screenshot.png", "question": "界面上的错误码是什么？" }
```

输出：

```text
界面上的错误码是 ERR_NETWORK_TIMEOUT，出现在右下角的 Toast 提示里……
```

### `meow_preview`

输入：

```json
{ "target": "demos/button-basic", "width": 800, "height": 400 }
```

输出（多模态模型看到的是图片 + 文字信封）：

```text
target: demos/button-basic
path: /Users/you/work/my-lib/.preview/shots/button-basic.png
+ [截图图片已附上]
```

---

## 系统提示词注入

插件会向 dsh 的 `systemPrompt` 注册两段 hint（order=150）：

1. `meow-vision:hint` — 告诉文本模型何时该用 `meow_vision`。
2. `meow-preview:demo-note` — 告诉多模态模型写 `meow_preview` demo 的最简规范。

无需手动配置，apply() 时自动注入。

---

## 权限与运行时行为

透明地列出来本插件安装后**会做什么 / 不会做什么**，方便你评估是否安装。

### 会做

- **写文件**
  - `<插件根>/vision.json`：保存你在设置 tab 选中的视觉模型 `{ provider, model }`
  - `<你配置的 .preview 目录>/shots/*.png`：`meow_preview` 工具生成的截图产物
  - `<你配置的 .preview 目录>/src/demos/<name>.vue`：模型按 demo 规范写的 Vue 文件
- **启动 1 个常驻 dev server**：仅当 `meow_preview` 被首次调用时拉起你配置的团队 UI 库 dev server（默认 `localhost:4173`），插件卸载时自动 kill
- **注册 Web 路由**（仅同源，DSH 进程内）
  - `GET  /api/meow-vision/config`     — 读视觉模型配置
  - `POST /api/meow-vision/config`     — 写视觉模型配置
  - `GET  /api/meow-vision/candidates` — 候选视觉模型列表
- **调用 DSH 已注入的服务**
  - `ctx.tools.register`：注册 `meow_vision` / `meow_preview` 两个工具
  - `ctx.systemPrompt.section`：注入两段 hint（order=150）
  - `ctx.webServer.use`：注册上面 3 条路由
  - `ctx.llm.resolveModelInfo`：探测当前主模型多模态能力（决定走 `meow_vision` 还是提示用 `read_image`）
  - `ctx.llm.stream`：复用 DSH 已配的视觉模型流式调用，**不发起任何第三方 API 请求**，不发起子 agent
  - `ctx.fs` / `ctx.attachments`：读写本地文件、把截图以 attachment 形式喂给当前模型
- **设置弹窗注入**：在 DSH 设置弹窗加一个名为 `meow-vision` 的 section tab（视觉模型 + 预览配置）

### 不会做

- ❌ **不读聊天记录 / 会话历史 / 用户上传的其他附件**
- ❌ **不读其他插件的配置或状态**
- ❌ **不调用任何 DSH 之外的第三方 API**（视觉模型完全复用你 DSH 已配的 provider/model）
- ❌ **不修改 DSH 源码**，纯 Cordis 插件
- ❌ **不持久化任何用户隐私**：vision.json 只存你选的 `{provider, model}`，不含 API key
- ❌ **不向外发请求**：无 telemetry、无 analytics、无远程上报

---

## 兼容性

| 项目 | 要求 |
|---|---|
| **DSH profile** | 仅 `web`（依赖 `webServer` 服务 + settings tab 注入） |
| **DSH runtime** | `@deepseek-ai/cordis ^0.1.0`（peerDependencies） |
| **DSH client 注入** | `@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-settings` |
| **Node 半 inject** | `webServer / tools / systemPrompt / llm / attachments / fs` |
| **运行平台** | Node 18+，ESM only（`"type": "module"`） |
| **视觉模型** | DSH 已配置的多模态模型中任选一个（用户自选；候选列表自动过滤 `inputModalities` 含 `image` 的） |
| **meow_preview dev server** | 你团队的 Vue 组件库 demo 项目（默认端口 4173，需支持 `demos/<name>.vue` 路由） |
| **浏览器** | 现代浏览器（支持同源 fetch + React 18 hooks）；无 IE / 老 Safari 兼容承诺 |

### 已知不兼容

- ❌ TUI / CLI profile（依赖 web profile）
- � 旧版 DSH rc 之前的 cordis API（需要 `^0.1.0`）
- ❌ `meow_preview` 对非 Vue 库的 demo（如 React 组件库）需要你自行改写 dev server 入口

---

## 开发

```bash
# 安装依赖
npm install

# 编译（产出 lib/）
npm run build   # 或你自己的 tsc 编译命令

# 本地链路调试：把插件根目录软链到 dsh 的插件目录
# 或用：
dsh 插件 --profile web add link:./   # 本地路径安装
```

---

## License

[MIT](./LICENSE) © meimiaoji-creator
