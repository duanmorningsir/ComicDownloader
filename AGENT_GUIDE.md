# Agent Guide

本文件面向接手本仓库的 agent，用于快速理解项目结构、关键代码入口、常见修改流程与当前已知注意事项。

## 项目目标

这是一个 Tampermonkey 油猴脚本项目，用于在支持的网站上下载漫画并生成 PDF。

当前支持的核心能力：

- 章节页单章下载
- 目录页批量下载
- 三种 PDF 模式：长图、翻页、滚动
- 浏览器本地调试版与正式发布版双产物构建

## 仓库结构

- `src/index.js`
  - 主业务文件
  - 包含：
    - GM 运行时兼容包装
    - 站点适配器基类和各站点适配器
    - UI 逻辑
    - 单章下载与批量下载逻辑
    - PDF 生成逻辑
    - 初始化入口
- `src/state.js`
  - 统一管理运行时状态
  - 包含批量下载状态、章节进度、PDF 进度、阶段枚举
- `src/logger.js`
  - 日志封装
  - `dev` 版日志更详细
- `src/build-constants.js`
  - 构建时注入的常量
  - 如当前是否是 `dev` 构建
- `scripts/build.mjs`
  - userscript 构建脚本
  - 负责生成 metadata header 和 `prod/dev` 产物
- `dist/comic-downloader.user.js`
  - 正式发布产物
  - 不要手动修改
- `dist/comic-downloader.dev.user.js`
  - 浏览器本地调试产物
  - 不要手动修改
- `README.md`
  - 用户说明 + 基本开发说明
- `Test/README.md`
  - 手工测试记录占位

## 关键代码入口

### 1. 站点适配器

位置：

- `src/index.js` 中的 `class SiteAdapter`
- `src/index.js` 中的各 `*Adapter`

当前已有适配器：

- `RumanhuaAdapter`
- `RumanhuaPCAdapter`
- `RumanhuaOrgAdapter`
- `RumanhuaMobileNewAdapter`
- `MangaparkAdapter`
- `ManwakuAdapter`

站点分发入口：

- `src/index.js` 中 `getSiteAdapter()`

新增网站适配时，通常需要：

1. 新增一个继承 `SiteAdapter` 的类
2. 在 `getSiteAdapter()` 中注册域名分支
3. 在 `scripts/build.mjs` 的 `matches` 数组中补上对应站点

一个站点适配器通常至少实现：

- `isChapterPage()`
- `isDirectoryPage()`
- `getChapterLinks()`
- `getChapterName()`
- `getImageElements()`
- `getImageUrl()`

如果一章分多页，还要考虑：

- `hasMultiplePages()`
- `getPageUrls()`

### 2. 运行时状态

位置：

- `src/state.js`

关键点：

- 所有批量下载与阶段判断统一走 `comicDownloaderRuntimeState`
- 下载阶段枚举在 `DOWNLOAD_PHASE`

当前阶段：

- `idle`
- `pending`
- `downloading`
- `downloaded`
- `pdf_generating`
- `saved`
- `failed`
- `cancelled`

批量流程只应把 `saved` 当成成功终态。

### 3. GM 接口包装

位置：

- `src/index.js` 顶部

当前约定：

- 原生接口固定从 `globalThis.GM_getValue` / `globalThis.GM_setValue` 读取
- 业务侧统一使用 `gmGetValue()` / `gmSetValue()`

不要再把 `GM_getValue` / `GM_setValue` 重新声明成同名局部常量。
此前已经踩过一次坑：打包后会出现类似 `GM_getValue2 before initialization` 的时序错误。

### 4. 下载器主流程

位置：

- `src/index.js` 中 `class ComicDownloader`

重点方法：

- `handleDownload()`
- `downloadComic()`
- `downloadImagesFromUrls()`
- `downloadImages()`
- `downloadImage()`
- `generatePDF()`
- `handleDownloadSelected()`
- `waitForBatchChapterResult()`

这部分是最容易引入回归的区域。

## 当前实现约定

### 单一真源

- 只修改 `src/`
- 不手改 `dist/`

### 构建命令

- `npm run build`
  - 生成正式版
- `npm run build:dev`
  - 生成调试版
- `npm run watch`
  - 监听源码改动并重建调试版
- `npm run check`
  - 执行构建烟测

注意：

- 当前环境里的 `esbuild` 通过 `scripts/build.mjs` 的 fallback 加载
- 某些机器上 `npm` 或 `esbuild` 可能需要提升权限才能跑构建

## 浏览器调试方式

优先使用：

- `dist/comic-downloader.dev.user.js`

调试辅助：

- `window.__comicDownloaderDebug`

可用于查看：

- 当前构建信息
- 当前运行时状态
- 当前适配器名称
- UI 下载状态

调试建议：

1. 一次只启用一个脚本版本
2. 出现失败时优先看控制台第一条真正报错
3. 先区分是“脚本没加载成功”还是“点击后业务逻辑失败”

## 修改代码的推荐流程

### 新增网站适配

1. 运行 `npm run build:dev`
2. 在 Tampermonkey 里加载 `dist/comic-downloader.dev.user.js`
3. 打开目标网站，确认：
   - 哪个 URL 是目录页
   - 哪个 URL 是章节页
   - 章节列表 DOM 选择器
   - 图片节点选择器
   - 真实图片 URL 是 `src`、`data-src` 还是别的属性
4. 在 `src/index.js` 新增适配器
5. 在 `getSiteAdapter()` 注册
6. 在 `scripts/build.mjs` 补 `@match`
7. 运行 `npm run check`
8. 再运行 `npm run build:dev`
9. 回到浏览器手测单章、批量、三种 PDF 模式
10. 确认后运行 `npm run build`

### 修下载失败问题

优先排查：

1. 是否是脚本加载期错误
2. 是否是适配器没识别页面
3. 是否是图片 URL 提取错了
4. 是否是批量状态机判断错了
5. 是否是 PDF 生成阶段卡住

应优先看的位置：

- `ComicDownloader.handleDownload()`
- `downloadComic()`
- `downloadImage()`
- `generatePDF()`
- `waitForBatchChapterResult()`

## 已知坑点

### 1. 不要同名覆盖 GM 接口

错误做法：

- `const GM_getValue = ...`
- `const GM_setValue = ...`

这会在打包后带来初始化时序问题。

### 2. 批量下载成功终态必须是 `saved`

不要再把失败章节写成 `complete`。

### 3. 单张坏图不能卡死整章

图片尺寸探测、PDF 写入、图片下载都必须允许失败后跳过并继续。

### 4. `dist/` 是产物，不是源码

不要直接在 `dist/` 修 bug，否则下次构建会被覆盖。

## 如果需要继续重构

当前 `src/index.js` 仍然偏大。后续如果继续整理，优先顺序建议是：

1. 把各站点适配器拆到 `src/adapters/`
2. 把 UI 拆到 `src/ui/`
3. 把下载/PDF 逻辑拆到 `src/downloader/`

但在没有测试补齐之前，拆分时要小步提交，避免同时改结构和行为。
