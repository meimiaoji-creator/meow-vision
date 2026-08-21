# meow-vision

> **dsh-plugin** for DeepSeek Harness（DSH）：给文本模型补一双眼睛，给多模态模型补一对"看 UI 渲染"的眼睛。

`meow-vision` 提供两个工具：

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

## 依赖与 peer

- `peerDependencies: @deepseek-ai/cordis ^0.1.0`
- `client.inject: @deepseek-ai/dsh-client-runtime, @deepseek-ai/dsh-client-ui-settings`
- `client.platform: web`（强依赖 web profile 形态）
- Node 半需要的 inject：`webServer / tools / systemPrompt / llm / attachments / fs`

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
