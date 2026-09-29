# Crisp Mind

> **Your thought graphs, natively woven.**  
> Local-first, Obsidian-native mind mapping engine with bi-directional Markdown and knowledge graph integration.

Part of the **Crisp Series** for Obsidian by [letschips](https://github.com/letschips).

[![Obsidian](https://img.shields.io/badge/Obsidian-v1.6.0%2B-blue.svg)](https://obsidian.md)
[![Platform](https://img.shields.io/badge/Platform-Desktop%20Only-lightgrey.svg)](manifest.json)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Crisp Suite](https://img.shields.io/badge/Crisp-Suite-orange.svg)](https://github.com/letschips)

---

## ✨ Features / 核心特性

- 🧠 **Obsidian-Native Editorial Aesthetic**: 100% 同步 Obsidian 系统与主题 CSS 变量（明暗自适应、重绘保护），拒绝厚重外来前端框架依赖，零运行时依赖。
- 📐 **6 Multi-Dimensional Layouts**:
  - **逻辑结构图 (Logical Structure)**: 经典左右单向与双向结构推演。
  - **思维导图 (Mind Map)**: 核心主题居中，分支智能双向辐射。
  - **组织结构图 (Organization Structure)**: 自顶向下树状分层结构。
  - **目录组织图 (Catalog Organization)**: 纵向大纲缩进层级。
  - **时间轴 (Timeline)**: 里程碑节点上下交替错落，直观呈现阶段规划与演进历史。
  - **鱼骨图 / 因果图 (Fishbone / Ishikawa)**: 工业级根因分析图，斜骨与支骨按标签高度留出间距，自带鱼头指示。
- 🎨 **6 Crisp Curated Palettes**: 内置 `Crisp Obsidian`（跟随当前主题）、`Crisp Cupertino`（灰蓝）、`Crisp Mono Editorial`（当代编辑排版）、`Crisp Nord`（极光深暗）、`Crisp Amber Warm`（羊皮纸暖色）、`Crisp Paper`（纸感画布）。
- 🌈 **Branch Colors & Tapered Lines**: 根分支按当前配色获得稳定区分色，后代延续同一色相并逐层柔化；连接线从父节点向子节点收窄，屏幕与 SVG / PNG / PDF 导出使用相同渲染。
- ✅ **Task Progress**: `[ ]` / `[x]` 节点待办继续写入 Markdown；父节点折叠控件外圈汇总所有后代待办完成度，折叠时仍可查看，并提供辅助标签读数。
- 🔎 **Node Search & Branch Focus**: 按文字搜索节点并显示所属路径；聚焦某个分支时可以只查看相关结构，不影响原始折叠状态，并可从顶部快速返回全图。
- 🎬 **Presentation Mode**: 将节点保存为讲解顺序，逐步平移、缩放并突出当前节点；每一步支持仅自己可见的备注，播放时用方向键切换、Esc 退出。
- 🎛️ **Node Style & Notes**: 节点可单独设置形状、填充、文字、边框、字号、字重与对齐；备注随 `.mind.md` 保存，并在画布和大纲显示标记。
- 🕸️ **Relations, Boundaries & Summaries**: 支持跨分支关系箭头、分支边界和阶段概要，随 SVG、PNG、PDF 导出，删除节点时自动清理失效引用。
- 🧭 **Multi-Select & Outline Sidebar**: 使用 `⌘ / Ctrl + 点击` 追加选择，`Shift + 点击` 选择可见范围；大纲侧栏与画布选择、折叠和定位保持同步。
- ⌨️ **Fluid Keyboard-First Workflow**: 全键盘高频流转，`Tab` 插入子主题、`Enter` 插入同级主题、`Space` 就地编辑、`Delete` 删除分支、`Cmd/Ctrl + Z / Shift + Z` 极速撤销与重做。
- 🏝️ **Floating Pill & Node Island**: 极简悬浮胶囊工具栏集成布局、配色、批量折叠 / 展开、高保真导出与原生操作指南；节点浮岛快速添加待办与双链，节点右键菜单可打开双链到右侧分屏，或将分支提炼为独立笔记。
- 📤 **High-Fidelity Multi-Format Export**:
  - **矢量 SVG**: 精准计算全局包围盒，原生支持深浅主题背景与高精度矢量曲线。
  - **2x 高清 PNG**: Retina 级超清位图渲染，自动采用纯净背景，便于分享至社交媒体与排版平台。
  - **高清 PDF**: 生成符合 PDF-1.4 格式的标准 PDF 文档（2x 高清光栅化封装，非矢量），保留真实排版与清晰度，适合长效打印与归档交流。
- 🔗 **Markdown Outline & Bi-Directional Linking**: 采用 `.mind.md` 混合存储架构，前半部分为纯文本大纲，尾部隔离数据存储。原生支持 Obsidian 全局搜索、快捷切换（Quick Switcher）与反向链接网络。
- 🛡️ **Local-First & Snapshot Protection**: 导图解析、节点测量、布局运算与导出渲染全部在本地完成，笔记内容不出设备；保存前自动写入快照防丢，每个导图保留最近 30 份。
- 🔑 **Crisp Authorization**: 基于 Ed25519 非对称公钥密码学本地验签。全家桶授权覆盖全部插件；启动时自动扫描仓库内其它 Crisp 插件，采用其中第一个确实包含 Crisp Mind 权限的授权，作用于其它插件的单款授权不会被误继承。

---

## 🚀 Quick Start / 快速开始

1. 打开命令面板 (`Cmd/Ctrl + P`)，输入并运行：
   - `Crisp Mind: 新建思维导图`：快速创建新的 `.mind.md` 文件并进入导图视图。
   - `Crisp Mind: 以思维导图视图打开当前大纲笔记`：将库内任意现有大纲转为思维导图伴随视图。
2. 在文件列表中右键任意 `.mind.md` 文件，选择 **用 Crisp Mind 打开**。
3. 点击画布底部浮动工具栏最右侧的 **帮助图标 (`?`)**，即可查看完整快捷键与操作手势。

---

## ⌨️ Shortcuts / 常用快捷键

| 操作 | 快捷键 / 方法 |
| :--- | :--- |
| **新建子主题** | `Tab` 或 点击节点浮岛「子主题」 |
| **新建同级主题** | `Enter` |
| **编辑文本** | 双击节点 或 选中后按 `Space` |
| **节点内换行** | 编辑文本时按 `Cmd/Ctrl + Enter`；`Enter` 确认，`Esc` 取消 |
| **删除节点及子分支** | `Delete` / `Backspace` |
| **折叠 / 展开分支** | 节点旁的折叠圆标 / 子节点数量圆标，或按 `F`（只读预览中同样可用） |
| **全部收起 / 全部展开** | 点击底部工具栏的对应图标 |
| **搜索 / 聚焦分支** | 点击工具栏搜索图标，输入节点文字后选择结果；未选中节点时按 `Esc` 返回全图 |
| **演示模式** | 点击工具栏演示图标编排步骤；播放时使用方向键切换，`Esc` 退出 |
| **多选节点** | `Cmd/Ctrl + 点击` 追加或移除；`Shift + 点击` 选择可见范围 |
| **节点样式与备注** | 选择节点后使用右侧检查器，或右键节点打开 |
| **大纲侧栏** | 点击工具栏大纲按钮；输入关键词筛选，点击节点定位，点击箭头折叠 |
| **关系 / 边界 / 概要** | 选中两个节点建立关系；右键节点添加边界或概要 |
| **撤销 / 重做** | `Cmd/Ctrl + Z` / `Cmd/Ctrl + Shift + Z` |
| **画布平移与缩放** | 鼠标滚轮平移，`Cmd/Ctrl + 滚轮` 或触控板捏合缩放 |
| **适应画布居中** | 点击浮动工具栏左端的缩放百分比徽标，或右侧「适应画布」按钮 |

---

## 📦 Installation / 安装方式

> **平台要求**：Crisp Mind 目前仅支持**桌面端**（Windows / macOS / Linux），暂不支持 iOS 与 Android。

### 方法一：通过 BRAT 安装 (推荐)
1. 安装并启用社区插件 **[Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat)**。
2. 进入 Obsidian **设置 → BRAT → Add Beta plugin**。
3. 填入 `letschips/crisp-mind` 并点击 **Add Plugin**。
4. 在“第三方插件”列表中启用 **Crisp Mind**。

### 方法二：手动安装
1. 从 [GitHub Releases](https://github.com/letschips/crisp-mind/releases) 下载最新的 `main.js`、`manifest.json` 与 `styles.css`。
2. 在您的 Obsidian 库插件目录中创建文件夹：
   `<VaultFolder>/.obsidian/plugins/crisp-mind/`
3. 将下载的 3 个文件复制到该文件夹下。
4. 在 Obsidian 设置中重新加载插件并启用 **Crisp Mind**。

---

## ⚙️ Activation / 授权激活

Crisp Mind 是 **Crisp 插件套件** 的成员之一。
- 未激活时可打开并只读预览 `.mind.md`、搜索和大纲导航；新建、编辑、保存、样式备注、关系边界概要、布局主题、演示与导出需要有效授权。
- 若您已在同一设备中激活过其它 Crisp 插件（如 Crisp Pulse、Crisp Focus、Crisp Visual 等），Crisp Mind 启动时会**自动继承**其中一个授权，无需重复配置。
- 继承只采用**确实包含 Crisp Mind 权限**的授权：全家桶授权一定可用；仅授权其它单款插件的授权码不会被继承，此时需单独激活 Crisp Mind。
- 您也可以进入 **设置 → Crisp Mind** 手动输入激活码进行验证。

---

## 🔒 Privacy & Local-First Policy / 隐私与本地优先政策

- **纯本地处理**：所有思维导图解析、节点测量、布局运算与导出渲染均在您的本地设备运行，没有任何笔记内容、大纲或附件上传云端。
- **透明密码学校验**：授权校验采用 Ed25519 非对称签名在本地完成。仅当库内已存在激活码时，插件加载、激活或手动验证会向官方授权接口 `license.letschips.xyz` 发送一次轻量设备核验请求，内容仅含授权码、设备标识与插件 ID，超时 2.5 秒。断网或核验不可达时自动回退到本地签名校验，不影响离线使用与冷启动。

---

## 📄 License

[Crisp Proprietary License](LICENSE) © 2026 [letschips](https://github.com/letschips). All rights reserved.
