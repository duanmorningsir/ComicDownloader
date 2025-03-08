对于油猴代码的测试，也就是开发代码时的本地调试，网上也有不少资料。这里附上本代码的调试时的关键步骤。
1. 在油猴脚本新建一个空的本地脚本，用于连接本地开发的代码。
2. 内容设置为如下，关键是修改@require的路径为本地测试代码的路径。
```js

// ==UserScript==
// @name         网页漫画下载为pdf格式-test
// @namespace    http://tampermonkey.net/
// @version      1.0.0

// @description  将网页漫画下载为pdf方便阅读，目前仅适用于如漫画
// @author       MornLight
// @match        https://m.rumanhua.com/*
// @match        https://www.rumanhua.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @connect *
// @require      file:///D:\Documents\AAAA代码\油猴脚本\ComicDownloader\test.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @run-at       document-end
// @license      MIT
// @supportURL   https://github.com/duanmorningsir/ComicDownloader
// ==/UserScript==

// 使用说明：
// 1. @name: 脚本名称，用于在油猴扩展中识别
// 2. @namespace: 命名空间，用于避免命名冲突
// 3. @version: 脚本版本号
// 4. @description: 脚本功能描述
// 5. @author: 作者信息
// 6. @match: 指定脚本在哪些网站上运行，支持通配符
// 7. @icon: 脚本图标
// 8. @grant: 申请使用油猴API权限
//    - GM_xmlhttpRequest: 跨域请求
//    - GM_openInTab: 新标签页打开
//    - GM_setValue/GM_getValue: 数据存储
// 9. @connect: 允许跨域连接的域名，*表示允许所有
// 10. @require: 依赖的外部脚本
// 11. @run-at: 脚本运行时机
// 12. @license: 开源协议类型
// 13. @supportURL: 支持页面地址，通常是项目仓库
```



