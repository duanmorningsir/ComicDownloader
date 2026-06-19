# Test

此目录用于手工测试记录、站点样例与调试说明。

- `dist/comic-downloader.dev.user.js`：浏览器本地调试入口
- `dist/comic-downloader.user.js`：正式发布产物

请不要再在这里维护业务代码副本。

### 开发与调试

仓库现已改为单一源码维护：

- `src/`：唯一业务源码
- `dist/comic-downloader.user.js`：正式发布产物
- `dist/comic-downloader.dev.user.js`：浏览器手工调试产物

#### 文件结构与说明

- `src/index.js`：主业务文件，包含站点适配器、UI、单章节下载、批量下载、PDF 生成和初始化入口
- `src/state.js`：运行时状态管理，负责批量下载阶段、章节进度、PDF 进度等共享状态
- `src/logger.js`：日志封装，`dev` 版日志更详细
- `src/build-constants.js`：构建时注入的常量，例如当前是否为 `dev` 版本
- `scripts/build.mjs`：构建脚本，负责把源码打包成 userscript，并生成 `prod/dev` 两个产物
- `package.json`：项目命令入口，常用命令包括 `build`、`build:dev`、`watch`、`check`
- `dist/comic-downloader.user.js`：正式发布产物，不要手动修改
- `dist/comic-downloader.dev.user.js`：浏览器本地调试产物，不要手动修改
- `Test/README.md`：手工测试记录、站点样例和调试说明

#### 适配新网站时改哪里

如果要支持新网站，主要改这两个位置：

1. 在 `src/index.js` 里新增一个站点适配器类
2. 在 `src/index.js` 的 `getSiteAdapter()` 中注册新域名

一个新适配器通常需要实现这些方法：

- `isChapterPage()`：判断当前是否为章节页
- `isDirectoryPage()`：判断当前是否为目录页
- `getChapterLinks()`：从目录页提取章节链接
- `getChapterName()`：获取章节名
- `getImageElements()`：获取当前章节页中的图片节点
- `getImageUrl()`：从图片节点中拿到真实图片地址

如果该网站一章分多页，还要额外实现：

- `hasMultiplePages()`
- `getPageUrls()`

如果新增了域名，还要在 `scripts/build.mjs` 的 `matches` 中补上对应 `@match`，否则油猴脚本不会在该站点生效。

常用命令：

1. `npm run build`：生成正式版脚本
2. `npm run build:dev`：生成调试版脚本
3. `npm run watch`：监听源码改动并重建调试版
4. `npm run check`：执行构建烟测

调试建议：

1. 浏览器里只启用一个版本，不要同时启用 `prod` 和 `dev`
2. 日常站点调试优先使用 `dist/comic-downloader.dev.user.js`
3. `dev` 版会暴露 `window.__comicDownloaderDebug`，可在控制台查看当前构建信息、运行时状态、适配器名称和下载阶段

#### 修改代码的推荐流程

1. 先运行 `npm run build:dev`
2. 在浏览器里加载 `dist/comic-downloader.dev.user.js`
3. 打开目标网站，先确认目录页、章节页和真实图片 URL 的获取方式
4. 在 `src/index.js` 中新增或修改适配器
5. 如有新域名，同时更新 `scripts/build.mjs` 里的 `matches`
6. 运行 `npm run check`
7. 再运行 `npm run build:dev`，回到浏览器手测
8. 确认没问题后运行 `npm run build` 生成正式版
