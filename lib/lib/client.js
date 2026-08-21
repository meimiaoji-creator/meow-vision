window.__ModuleLoader__.load({
	id: "meow-vision",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/VisionModelSection.tsx
		/**
		* meow-vision 配置 tab(设置弹窗「meow-vision」section)。
		*
		* 两块配置,数据全部经 node 半同源 /api/meow-vision/* 获取/保存:
		*   1. 视觉模型:meow_vision 工具用的视觉模型(provider + model);
		*   2. 预览配置:meow_preview 工具用的库包名 / 端口 / .preview 位置。
		*
		* 浏览器半零本地文件读取、零 dsh wire 依赖,只走同源 fetch(与 meow-file-view 的浏览器半一致)。
		*/
		/** 组合值分隔符(provider/model id 里不会出现)。 */
		const SEP = "::";
		/** 同源 fetch + 解析 JSON(失败抛错)。 */
		async function fetchJson(url, init) {
			const res = await fetch(url, init);
			const data = await res.json();
			if (!res.ok) {
				const message = data.error;
				throw new Error(typeof message === "string" ? message : `请求失败 (${res.status})`);
			}
			return data;
		}
		/**
		* meow-vision 配置 tab:视觉模型 + 预览配置。
		*/
		function VisionModelSection(_props) {
			const [candidates, setCandidates] = (0, react.useState)([]);
			const [provider, setProvider] = (0, react.useState)("");
			const [model, setModel] = (0, react.useState)("");
			const [pvLib, setPvLib] = (0, react.useState)("");
			const [pvPort, setPvPort] = (0, react.useState)(4173);
			const [pvDir, setPvDir] = (0, react.useState)("");
			const [status, setStatus] = (0, react.useState)("loading");
			const [saving, setSaving] = (0, react.useState)(false);
			const [message, setMessage] = (0, react.useState)(null);
			const [pvSaving, setPvSaving] = (0, react.useState)(false);
			const [pvMessage, setPvMessage] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let cancelled = false;
				Promise.all([
					fetchJson("/api/meow-vision/candidates"),
					fetchJson("/api/meow-vision/config"),
					fetchJson("/api/meow-vision/preview-config")
				]).then(([cand, cfg, pv]) => {
					if (cancelled) return;
					setCandidates(cand.candidates ?? []);
					const current = cfg.config;
					setProvider(current?.provider ?? "");
					setModel(current?.model ?? "");
					setPvLib(pv.config.libName ?? "");
					setPvPort(pv.config.port ?? 4173);
					setPvDir(pv.config.previewDir ?? "");
					setStatus("ready");
				}).catch(() => {
					if (!cancelled) setStatus("error");
				});
				return () => {
					cancelled = true;
				};
			}, []);
			/** 保存视觉模型选择到 vision.json。 */
			async function saveVision() {
				if (!provider || !model) {
					setMessage("请先选择一个视觉模型");
					return;
				}
				setSaving(true);
				setMessage(null);
				try {
					await fetchJson("/api/meow-vision/config", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							provider,
							model
						})
					});
					setMessage("已保存 ✓");
				} catch (error) {
					setMessage(error instanceof Error ? error.message : "保存失败");
				} finally {
					setSaving(false);
				}
			}
			/** 保存预览配置到 preview.json。 */
			async function savePreview() {
				setPvSaving(true);
				setPvMessage(null);
				try {
					await fetchJson("/api/meow-vision/preview-config", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							libName: pvLib,
							port: pvPort,
							previewDir: pvDir
						})
					});
					setPvMessage("已保存 ✓");
				} catch (error) {
					setPvMessage(error instanceof Error ? error.message : "保存失败");
				} finally {
					setPvSaving(false);
				}
			}
			const groups = /* @__PURE__ */ new Map();
			for (const c of candidates) {
				const list = groups.get(c.provider) ?? [];
				list.push(c);
				groups.set(c.provider, list);
			}
			const currentValue = provider && model ? `${provider}${SEP}${model}` : "";
			if (status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "加载中…" });
			if (status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "加载失败：无法访问 /api/meow-vision/*（插件 node 半未加载？）" });
			const inputStyle = {
				padding: "6px 8px",
				minWidth: "280px"
			};
			const rowStyle = {
				display: "flex",
				alignItems: "center",
				gap: "12px"
			};
			const labelStyle = {
				display: "flex",
				flexDirection: "column",
				gap: "4px"
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "24px",
					maxWidth: "560px"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: "12px"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							style: {
								margin: 0,
								fontSize: "15px"
							},
							children: "视觉模型（meow_vision）"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: { margin: 0 },
							children: [
								"为 ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "meow_vision" }),
								" 工具选择视觉模型。非多模态模型调用 ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "meow_vision" }),
								" 看图时， 由所选视觉模型识别图片并返回文字描述。"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: labelStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "视觉模型" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									value: currentValue,
									onChange: (e) => {
										const v = e.target.value;
										if (!v) {
											setProvider("");
											setModel("");
											return;
										}
										const [p, m] = v.split(SEP);
										setProvider(p);
										setModel(m);
									},
									style: inputStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: "（未选择）"
									}), [...groups.entries()].map(([p, list]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
										label: list[0]?.providerName ?? p,
										children: list.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: `${c.provider}${SEP}${c.model}`,
											children: c.modelName ?? c.model
										}, `${c.provider}${SEP}${c.model}`))
									}, p))]
								}),
								candidates.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { color: "#b45309" },
									children: "未找到视觉模型。请先在 设置 → 模型 里添加一个支持图片输入的 provider / 模型。"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => void saveVision(),
								disabled: saving || candidates.length === 0,
								style: { padding: "6px 16px" },
								children: saving ? "保存中…" : "保存"
							}), message !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: message })]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: "12px"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							style: {
								margin: 0,
								fontSize: "15px"
							},
							children: "预览配置（meow_preview）"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: { margin: 0 },
							children: [
								"为 ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: "meow_preview" }),
								" 配置预览工程。模型写一个 Vue demo 后渲染截图，研究组件实际渲染效果。"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: labelStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "团队 UI 库包名（libName）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: pvLib,
								placeholder: "如 @sky/sky-ui（留空则组件 demo 无法 import）",
								onChange: (e) => setPvLib(e.target.value),
								style: inputStyle
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: labelStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "预览端口" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								value: pvPort,
								min: 1,
								max: 65535,
								onChange: (e) => setPvPort(Number(e.target.value)),
								style: {
									padding: "6px 8px",
									width: "140px"
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: labelStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: ".preview 生成位置（留空 = 工作区根）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: pvDir,
								placeholder: "留空则生成到会话工作区根目录",
								onChange: (e) => setPvDir(e.target.value),
								style: inputStyle
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => void savePreview(),
								disabled: pvSaving,
								style: { padding: "6px 16px" },
								children: pvSaving ? "保存中…" : "保存"
							}), pvMessage !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: pvMessage })]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** 插件名（cordis 诊断标签；loader 条目名仍为包名 meow-vision）。 */
		const name = "meow-vision-client";
		/** 需要的服务：`slots`（SlotRegistry，由 @deepseek-ai/dsh-client-runtime 提供）。 */
		const inject = ["slots"];
		/**
		* 客户端插件体：注册设置弹窗「视觉」section（slot 注入，随插件卸载自动回收）。
		* @param ctx - 客户端根上下文（含 ctx.slots / ctx.effect 等 cordis 核心面）。
		*/
		function apply(ctx) {
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "meow-vision",
				order: 40,
				label: () => "meow-vision"
			}, VisionModelSection));
		}
		//#endregion
		exports.VisionModelSection = VisionModelSection;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map