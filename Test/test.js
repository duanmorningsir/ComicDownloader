// ==UserScript==
// @name         网页漫画下载为pdf格式
// @namespace    http://tampermonkey.net/
// @version      2.4.1
// @description  将网页漫画下载为pdf方便阅读，目前仅适用于如漫画[http://www.rumanhua1.com/]
// @author       MornLight
// @match        http://m.rumanhua1.com/*
// @match        http://www.rumanhua1.com/*
// @match        https://www.rumanhua.org/*
// @match        https://mangapark.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @run-at       document-end
// @license      MIT
// @supportURL   https://github.com/duanmorningsir/ComicDownloader
// ==/UserScript==


(function () {
    'use strict';

    // 1. 样式配置
    const STYLES = {
        container: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '9999',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '18px',
            boxShadow: '0 4px 24px 0 rgba(60,60,100,0.13)',
            maxHeight: '80vh',
            overflowY: 'auto',
            minWidth: '260px',
            border: '1px solid #e0e6ef',
            boxSizing: 'border-box',
            '@media (max-width: 768px)': {
                bottom: '8px',
                right: '8px',
                left: '8px',
                minWidth: 'auto',
                width: 'calc(100% - 16px)',
                padding: '8px',
                gap: '6px',
                borderRadius: '10px',
            },
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
        },
        button: {
            padding: '8px 0',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            boxShadow: '0 1px 4px 0 rgba(76,175,80,0.08)',
            fontWeight: 'bold',
            fontSize: '15px',
            letterSpacing: '0.5px',
            transition: 'background 0.2s, box-shadow 0.15s, transform 0.08s',
            margin: '4px 0',
            outline: 'none',
            width: '100%',
            minHeight: '36px',
            ':hover': {
                backgroundColor: '#43e97b',
                boxShadow: '0 2px 8px 0 rgba(67,233,123,0.18)',
                transform: 'translateY(-1px) scale(1.02)'
            },
            '@media (max-width: 768px)': {
                padding: '6px 0',
                fontSize: '13px',
                borderRadius: '8px',
                margin: '3px 0',
                minHeight: '28px',
            },
            background: 'linear-gradient(45deg, #4CAF50, #45a049)',
            transition: 'all 0.3s ease',
            ':hover': {
                background: 'linear-gradient(45deg, #45a049, #4CAF50)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 15px rgba(76,175,80,0.3)'
            }
        },
        cancelButton: {
            backgroundColor: '#f44336',
            fontWeight: 'bold',
            fontSize: '15px',
            borderRadius: '12px',
            boxShadow: '0 1px 4px 0 rgba(244,67,54,0.08)',
            margin: '4px 0',
            width: '100%',
            minHeight: '36px',
            ':hover': {
                backgroundColor: '#ff7e5f',
                boxShadow: '0 2px 8px 0 rgba(255,126,95,0.18)',
                transform: 'translateY(-1px) scale(1.02)'
            },
            '@media (max-width: 768px)': {
                fontSize: '13px',
                borderRadius: '8px',
                margin: '3px 0',
                minHeight: '28px',
            },
            background: 'linear-gradient(45deg, #f44336, #e53935)',
            ':hover': {
                background: 'linear-gradient(45deg, #e53935, #f44336)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 15px rgba(244,67,54,0.3)'
            }
        },
        buttonGroup: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '10px',
            width: '100%',
        },
        progressContainer: {
            display: 'none',
            background: 'rgba(245,247,250,0.85)',
            borderRadius: '10px',
            padding: '8px 0 2px 0',
            margin: '4px 0',
            boxShadow: '0 1px 4px 0 rgba(60,60,100,0.06)',
            '@media (max-width: 768px)': {
                width: '100%',
                padding: '4px 0 1px 0',
                borderRadius: '7px',
            },
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(255,255,255,0.1)'
        },
        infoText: {
            color: '#4a5568',
            fontSize: '15px',
            textAlign: 'center',
            marginBottom: '10px',
            fontWeight: '500',
            letterSpacing: '0.5px',
            '@media (max-width: 768px)': {
                fontSize: '12px',
                marginBottom: '5px',
            }
        },
        chapterListContainer: {
            marginTop: '10px',
            display: 'none',
            maxHeight: '50vh',
            overflowY: 'auto',
            paddingRight: '18px',
            boxSizing: 'border-box',
            '@media (max-width: 768px)': {
                maxHeight: '60vh',
                paddingRight: '0',
            }
        }
    };

    // 添加响应式样式应用函数
    function applyResponsiveStyles(element, styles) {
        Object.assign(element.style, styles);

        // 检查是否是移动设备
        if (window.innerWidth <= 768) {
            const mobileStyles = styles['@media (max-width: 768px)'];
            if (mobileStyles) {
                Object.assign(element.style, mobileStyles);
            }
        }
    }

    // 2. 站点适配器相关代码
    class SiteAdapter {
        isChapterPage() {
            throw new Error('必须实现 isChapterPage 方法');
        }

        isDirectoryPage() {
            throw new Error('必须实现 isDirectoryPage 方法');
        }
        getChapterLinks() {
            throw new Error('必须实现 getChapterLinks 方法');
        }
        getChapterName() { throw new Error('必须实现 getChapterName 方法'); }
        getImageElements() { throw new Error('必须实现 getImageElements 方法'); }
        getImageUrl(imgElement) { throw new Error('必须实现 getImageUrl 方法'); }
    }

    class RumanhuaAdapter extends SiteAdapter {
        isChapterPage() {
            const url = window.location.href;
            const chapterPagePattern = /http:\/\/m\.rumanhua1\.com\/[^\/]+\/[^\/]+\.html/;
            return chapterPagePattern.test(url);
        }

        isDirectoryPage() {
            const url = window.location.href;
            const directoryPagePattern = /http:\/\/m\.rumanhua1\.com\/[^\/]+\/?$/;
            return directoryPagePattern.test(url);
        }

        async getChapterLinks() {
            const waitForChapterList = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 10;

                    const checkForList = () => {
                        const selectors = [
                            '.cartoon-box .chaplist-box ul',
                            '.chaplist-box ul',
                            '.chapterlistload ul',
                            '.chapter-list ul',
                            '.chapterlist ul'
                        ];

                        for (const selector of selectors) {
                            const element = document.querySelector(selector);
                            if (element) {
                                resolve(element);
                                return;
                            }
                        }

                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error('未找到章节列表'));
                            return;
                        }

                        setTimeout(checkForList, 500);
                    };

                    checkForList();
                });
            };

            try {
                const chapterListElement = await waitForChapterList();
                const chapterElements = chapterListElement.querySelectorAll('a');
                const baseUrl = window.location.origin;
                const links = Array.from(chapterElements).map(element => {
                    const href = element.getAttribute('href');
                    const url = href.startsWith('http') ? href : baseUrl + href;
                    const name = element.textContent.trim();
                    return { url, name };
                });
                return links;
            } catch (error) {
                throw error;
            }
        }

        getChapterName() {
            const chapterNameElement = document.querySelector('.chaphead-name h1');
            return chapterNameElement ? chapterNameElement.textContent.trim() : '未知章节';
        }

        getImageElements() {
            return document.querySelectorAll('.chapter-img-box img');
        }

        getImageUrl(imgElement) {
            if (!imgElement) return null;

            const src = imgElement.src || imgElement.dataset.src;
            if (!src) return null;

            let imageUrl = src.includes('/static/images/load.gif') ? imgElement.dataset.src : src;

            if (imageUrl.startsWith('blob:')) {
                return imageUrl;
            }

            if (imageUrl.startsWith('http:')) {
                imageUrl = imageUrl.replace('http:', 'https:');
            }

            return imageUrl;
        }
    }

    class RumanhuaPCAdapter extends SiteAdapter {
        isChapterPage() {
            const url = window.location.href;
            const chapterPagePattern = /http:\/\/www\.rumanhua1\.com\/[^\/]+\/[^\/]+\.html/;
            return chapterPagePattern.test(url);
        }

        isDirectoryPage() {
            const url = window.location.href;
            return url.includes('www.rumanhua1.com/') && !this.isChapterPage();
        }

        async getChapterLinks() {
            const waitForChapterList = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 10;

                    const checkForList = () => {
                        const selectors = [
                            '.chapterlistload ul',
                            '.cartoon-box .chaplist-box ul',
                            '.chaplist-box ul',
                            '.chapter-list ul',
                            '.chapterlist ul',
                            '.chapterlistload ul li a'
                        ];
                        for (const selector of selectors) {
                            const element = document.querySelector(selector);
                            if (element) {
                                resolve(element);
                                return;
                            }
                        }
                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error('未找到章节列表'));
                            return;
                        }
                        setTimeout(checkForList, 500);
                    };
                    checkForList();
                });
            };

            try {
                const chapterListElement = await waitForChapterList();
                const chapterElements = chapterListElement.querySelectorAll('a');
                const baseUrl = window.location.origin;
                const links = Array.from(chapterElements).map(element => {
                    const href = element.getAttribute('href');
                    const url = href.startsWith('http') ? href : baseUrl + href;
                    const name = element.textContent.trim();
                    return { url, name };
                });
                return links;
            } catch (error) {
                console.error('获取章节列表失败:', error);
                return [];
            }
        }

        getChapterName() {
            const chapterName = document.querySelector('.headwrap .chaptername_title')?.textContent || '未知章节';
            return chapterName;
        }

        getImageElements() {
            return document.querySelectorAll('div.chapter-img-box img');
        }

        getImageUrl(imgElement) {
            if (!imgElement) return null;

            const src = imgElement.src || imgElement.dataset.src;
            if (!src) return null;

            let imageUrl = src.includes('/static/images/load.gif') ? imgElement.dataset.src : src;

            if (imageUrl.startsWith('blob:')) {
                return imageUrl;
            }

            if (imageUrl.startsWith('http:')) {
                imageUrl = imageUrl.replace('http:', 'https:');
            }

            return imageUrl;
        }
    }

    class RumanhuaOrgAdapter extends SiteAdapter {
        isChapterPage() {
            const url = window.location.href;
            // 修改正则表达式以匹配实际的链接格式: https://www.rumanhua.org/show/xxx.html
            const chapterPagePattern = /https:\/\/www\.rumanhua\.org\/show\/[^\/]+\.html/;
            return chapterPagePattern.test(url);
        }

        isDirectoryPage() {
            const url = window.location.href;
            return url.includes('https://www.rumanhua.org') && !this.isChapterPage();
        }

        async getChapterLinks() {
            const waitForChapterList = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 10;

                    const checkForList = () => {
                        // 修改选择器以匹配新的HTML结构
                        const selectors = [
                            'div.list a.ib',
                            '.chapterlistload ul',
                            '.cartoon-box .chaplist-box ul',
                            '.chaplist-box ul',
                            '.chapter-list ul',
                            '.chapterlist ul',
                            '.chapterlistload ul li a'
                        ];
                        for (const selector of selectors) {
                            const elements = document.querySelectorAll(selector);
                            if (elements.length > 0) {
                                resolve(elements);
                                return;
                            }
                        }
                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error('未找到章节列表'));
                            return;
                        }
                        setTimeout(checkForList, 500);
                    };
                    checkForList();
                });
            };

            try {
                const chapterElements = await waitForChapterList();
                const baseUrl = window.location.origin;
                const links = Array.from(chapterElements).map(element => {
                    const href = element.getAttribute('href');
                    const url = href.startsWith('http') ? href : baseUrl + href;
                    const name = element.textContent.trim();
                    return { url, name };
                });
                return links;
            } catch (error) {
                console.error('获取章节列表失败:', error);
                return [];
            }
        }

        getChapterName() {
            // 从<title>标签中提取章节名称
            const title = document.querySelector('title')?.textContent || '未知章节';
            // 提取标题中的章节部分，例如从"龙战在野漫画-第9话 相伴左右在线阅读-如漫画"中提取"第9话 相伴左右"
            const match = title.match(/-\s*(.+?)\s*在线阅读/);
            return match ? match[1] : title;
        }

        getImageElements() {
            // 修改为根据新的图片结构获取图片元素
            return document.querySelectorAll('ul.comic-contain li img');
        }

        getImageUrl(imgElement) {
            if (!imgElement) return null;

            // 优先使用data-src属性，如果没有则使用src属性
            const src = imgElement.dataset.src || imgElement.src;
            if (!src) return null;

            // 处理图片URL
            let imageUrl = src;

            if (imageUrl.startsWith('blob:')) {
                return imageUrl;
            }

            if (imageUrl.startsWith('http:')) {
                imageUrl = imageUrl.replace('http:', 'https:');
            }

            return imageUrl;
        }
    }

    // 添加Mangapark适配器
    class MangaparkAdapter extends SiteAdapter {
        isChapterPage() {
            // 匹配 https://mangapark.net/title/357480-en-the-31st-piece-turns-the-tables/9864935-chapter-85-season-3-start 类型URL
            const chapterPagePattern = /https:\/\/mangapark\.net\/title\/+[^\/]+\/+[^\/]/;
            return chapterPagePattern.test(window.location.href);
        }

        isDirectoryPage() {
            // 目录页匹配 /title/ 开头但不包含 /chapter- 的URL
            const url = window.location.href;
            return url.includes('https://mangapark.net/title/') && !this.isChapterPage();
        }

        async getChapterLinks() {
            const waitForChapterList = () => {
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 10;

                    const checkForList = () => {
                        // Mangapark的章节列表选择器
                        const selectors = [
                            'div[data-name="chapter-list"] div.scrollable-panel div.group div.px-2 > div.space-x-1 a',
                        ];

                        for (const selector of selectors) {
                            const elements = document.querySelectorAll(selector);
                            if (elements.length > 0) {
                                resolve(elements);
                                return;
                            }
                        }

                        attempts++;
                        if (attempts >= maxAttempts) {
                            reject(new Error('未找到章节列表'));
                            return;
                        }

                        setTimeout(checkForList, 500);
                    };

                    checkForList();
                });
            };

            try {
                const chapterElements = await waitForChapterList();
                const links = Array.from(chapterElements).map(element => {
                    const href = element.getAttribute('href');
                    // 确保URL是完整的
                    const url = href.startsWith('http') ? href : 'https://mangapark.net' + href;
                    const name = element.textContent.trim();
                    return { url, name };
                });
                // 按照章节顺序排序
                return links.reverse(); // Mangapark列表通常是倒序的
            } catch (error) {
                console.error('获取章节列表失败:', error);
                return [];
            }
        }

        getChapterName() {
            // 尝试多种选择器获取章节名
            const selectors = [
                'div.text-base-content h6.text-lg span'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    return element.textContent.trim();
                }
            }

            // 如果找不到，从URL中提取
            const urlParts = window.location.pathname.split('/');
            const chapterPart = urlParts[urlParts.length - 1];
            return chapterPart.replace(/-\d+-/, ' ').replace(/-/g, ' ');
        }

        getImageElements() {
            // 查找所有带有background-image属性的div元素
            return document.querySelectorAll('div[data-name="image-show"] img, div[data-name="image-item"] img');
        }

        getImageUrl(imgElement) {
            if (!imgElement) return null;

            // 优先使用data-src或data-url属性，然后是src
            const src = imgElement.dataset.src || imgElement.dataset.url || imgElement.src;
            if (src) {
                let imageUrl = src;

                // 处理相对URL
                if (imageUrl.startsWith('//')) {
                    imageUrl = 'https:' + imageUrl;
                } else if (imageUrl.startsWith('/')) {
                    imageUrl = 'https://mangapark.net' + imageUrl;
                }

                if (imageUrl.startsWith('blob:')) {
                    return imageUrl;
                }

                return imageUrl;
            }
        }
    }

    // 3. 获取适配器的工厂函数
    function getSiteAdapter() {
        const url = window.location.href;
        switch (true) {
            case url.includes('http://www.rumanhua1.com/'):
                return new RumanhuaPCAdapter();
            case url.includes('http://m.rumanhua1.com/'):
                return new RumanhuaAdapter();
            case url.includes('https://www.rumanhua.org/'):
                return new RumanhuaOrgAdapter();
            // 添加Mangapark网站支持
            case url.includes('https://mangapark.net/'):
                return new MangaparkAdapter();
            default:
                throw new Error('不支持的页面格式');
        }
    }

    // 4. UI类
    // 4.1 普通下载器UI
    class DownloaderUI {
        constructor(totalPages, onDownload, onCancel) {
            this.totalPages = totalPages;
            this.onDownload = onDownload;
            this.onCancel = onCancel;
            this.currentPage = 0;
            this.createUI();
        }

        createUI() {
            const container = this.createContainer();

            // 添加页数信息
            this.infoText = this.createElement('div', STYLES.infoText, `本章节共 ${this.totalPages} 页`);
            container.appendChild(this.infoText);

            // 添加长图模式切换按钮
            this.longPageModeButton = this.createElement('button', {
                ...STYLES.button,
                backgroundColor: '#2196F3',
                marginBottom: '10px'
            }, '切换长图模式');
            this.longPageModeButton.addEventListener('click', () => this.toggleLongPageMode());
            container.appendChild(this.longPageModeButton);

            this.downloadButton = this.createButton('下载本章节', () => this.onDownload(1, this.totalPages));

            this.cancelButton = this.createButton('取消下载', () => {
                this.onCancel();
                this.infoText.textContent = '下载已取消';
                setTimeout(() => {
                    this.infoText.textContent = `本章节共 ${this.totalPages} 页`;
                }, 2000);
            }, true);

            // 默认隐藏取消按钮
            this.cancelButton.style.display = 'none';

            // 创建进度容器
            this.progressContainer = this.createElement('div', STYLES.progressContainer);
            this.progressBar = this.createProgressBar();
            this.progressText = this.createElement('span', {
                marginLeft: '10px',
                '@media (max-width: 768px)': {
                    fontSize: '12px',
                    marginLeft: '5px'
                }
            });
            this.progressContainer.appendChild(this.progressBar);
            this.progressContainer.appendChild(this.progressText);

            container.appendChild(this.downloadButton);
            container.appendChild(this.cancelButton);
            container.appendChild(this.progressContainer);
            document.body.appendChild(container);

            // 添加窗口大小变化监听
            window.addEventListener('resize', () => {
                this.updateResponsiveStyles();
            });
        }

        setLoading(isLoading, showCancel = false) {
            this.downloadButton.disabled = isLoading;
            this.downloadButton.style.backgroundColor = isLoading ? '#999' : '#4CAF50';
            this.downloadButton.style.cursor = isLoading ? 'not-allowed' : 'pointer';
            this.downloadButton.textContent = isLoading ? '下载中...' : '下载本章节';

            // 修复按钮显示逻辑
            if (isLoading) {
                this.downloadButton.style.display = 'none';
                this.cancelButton.style.display = showCancel ? 'block' : 'none';
                this.progressContainer.style.display = 'block';
                this.infoText.style.display = 'none';
                this.longPageModeButton.style.display = 'none'; // 下载时隐藏长图模式按钮
            } else {
                this.downloadButton.style.display = 'block';
                this.cancelButton.style.display = 'none';
                this.progressContainer.style.display = 'none';
                this.infoText.style.display = 'block';
                this.longPageModeButton.style.display = 'block';
            }
        }


        updateProgress(currentPage) {
            this.currentPage = currentPage;
            this.progressBar.value = currentPage;
            const percent = ((currentPage / this.totalPages) * 100).toFixed(2);
            this.progressText.textContent = `${currentPage}/${this.totalPages} (${percent}%)`;
        }

        createButton(text, onClick, isCancel = false) {
            const button = document.createElement('button');
            Object.assign(button.style, STYLES.button); // 应用基础按钮样式
            if (isCancel) {
                Object.assign(button.style, STYLES.cancelButton); // 如果是取消按钮，额外应用取消按钮样式
            }
            button.textContent = text;
            button.addEventListener('click', onClick);
            return button;
        }

        createContainer() {
            const container = document.createElement('div');
            Object.assign(container.style, STYLES.container);
            return container;
        }

        createProgressBar() {
            const progressBar = document.createElement('progress');
            progressBar.max = this.totalPages;
            progressBar.value = 0;
            progressBar.style.width = '100%';
            return progressBar;
        }

        toggleLongPageMode() {
            this.isLongPageMode = !this.isLongPageMode;
            this.longPageModeButton.textContent = this.isLongPageMode ? '切换普通模式' : '切换长图模式';
            this.longPageModeButton.style.backgroundColor = this.isLongPageMode ? '#4CAF50' : '#2196F3';
        }

        // 添加响应式样式更新方法
        updateResponsiveStyles() {
            const elements = {
                container: this.container,
                infoText: this.infoText,
                longPageModeButton: this.longPageModeButton,
                downloadButton: this.downloadButton,
                cancelButton: this.cancelButton,
                progressContainer: this.progressContainer,
                progressText: this.progressText
            };

            for (const [key, element] of Object.entries(elements)) {
                if (element && STYLES[key]) {
                    applyResponsiveStyles(element, STYLES[key]);
                }
            }
        }

        // 修改 createElement 方法
        createElement(type, styles, textContent = '') {
            const element = document.createElement(type);
            if (type === 'input' && styles.type) {
                element.type = styles.type;
                delete styles.type;
            }
            if (typeof styles === 'string') {
                element.className = styles;
            } else {
                applyResponsiveStyles(element, styles);
            }
            if (textContent) element.textContent = textContent;
            return element;
        }
    }

    // 4.2 章节选择器UI
    class ChapterSelectorUI {
        constructor({ adapter, onDownloadSelected, onToggleLongPageMode, onCancel, onProgress, onLoading, onComplete, onError }) {
            this.adapter = adapter;
            this.onDownloadSelected = onDownloadSelected;
            this.onToggleLongPageMode = onToggleLongPageMode;
            this.onCancel = onCancel;
            this.onProgress = onProgress;
            this.onLoading = onLoading;
            this.onComplete = onComplete;
            this.onError = onError;
            this.selectedChapters = new Set();
            this.isSelectionMode = false;
            this.isLongPageMode = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.isDownloading = false; // 添加下载状态标志
            this.createUI();
            this.chapterListContainer.style.display = 'block';
            this.initChapterList();
        }

        createUI() {
            // 创建容器
            this.container = this.createElement('div', {
                ...STYLES.container,
                '@media (min-width: 769px)': {
                    width: '300px',
                    right: '20px',
                    left: 'auto'
                }
            });
            document.body.appendChild(this.container);

            // 创建【选择章节下载】按钮
            this.selectButton = this.createElement('button', {
                ...STYLES.button,
                position: 'sticky',
                top: '0',
                zIndex: '10',
                width: '100%',
                marginBottom: '10px',
                fontWeight: 'bold',
                '@media (max-width: 768px)': {
                    padding: '12px',
                    fontSize: '14px'
                }
            }, '选择章节下载');
            this.selectButton.addEventListener('click', () => {
                if (this.isSelectionMode) {
                    if (this.selectedChapters.size > 0) {
                        this.onDownloadSelected && this.onDownloadSelected(Array.from(this.selectedChapters));
                    }
                } else {
                    this.toggleSelectionMode();
                }
            });


            // 添加长图模式切换按钮
            this.longPageModeButton = this.createElement('button', {
                ...STYLES.button,
                backgroundColor: '#2196F3',
                position: 'sticky',
                top: '40px',
                zIndex: '10',
                width: '100%',
                marginBottom: '10px',
                '@media (max-width: 768px)': {
                    top: '50px',
                    padding: '12px',
                    fontSize: '14px'
                }
            }, '切换长图模式');
            this.longPageModeButton.addEventListener('click', () => {
                this.isLongPageMode = !this.isLongPageMode;
                this.longPageModeButton.textContent = this.isLongPageMode ? '切换普通模式' : '切换长图模式';
                this.longPageModeButton.style.backgroundColor = this.isLongPageMode ? '#4CAF50' : '#2196F3';
                this.onToggleLongPageMode && this.onToggleLongPageMode(this.isLongPageMode);
            });

            // 添加取消按钮
            this.cancelSelectionButton = this.createElement('button', {
                ...STYLES.cancelButton,
                position: 'sticky',
                top: '80px',
                zIndex: '10',
                width: '100%',
                marginBottom: '10px',
                display: 'none',
                '@media (max-width: 768px)': {
                    top: '90px',
                    padding: '12px',
                    fontSize: '14px'
                }
            }, '返回');
            this.cancelSelectionButton.addEventListener('click', () => {
                if (this.isDownloading) {
                    // 如果正在下载，取消下载
                    this.cancelDownload();
                } else {
                    // 否则，退出选择模式
                    this.cancelSelectionMode();
                    this.onCancel && this.onCancel();
                }
            });


            // 创建按钮组容器并添加按钮
            this.buttonGroup = this.createElement('div', STYLES.buttonGroup);
            this.buttonGroup.appendChild(this.selectButton);
            this.buttonGroup.appendChild(this.longPageModeButton);
            this.buttonGroup.appendChild(this.cancelSelectionButton);
            this.container.appendChild(this.buttonGroup);

            // 创建章节列表容器
            this.chapterListContainer = this.createElement('div', {
                ...STYLES.chapterListContainer,
                display: 'block' // 确保章节列表容器默认显示
            });
            this.container.appendChild(this.chapterListContainer);

            // 添加进度显示区域
            this.progressContainer = this.createElement('div', {
                marginTop: '10px',
                display: 'none',
                position: 'sticky',
                bottom: '0',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '5px 0',
                zIndex: '2',
                '@media (max-width: 768px)': {
                    padding: '8px 0'
                }
            });

            this.progressText = this.createElement('div', {
                marginBottom: '5px',
                fontSize: '14px',
                color: '#666',
                '@media (max-width: 768px)': {
                    fontSize: '12px',
                    marginBottom: '3px'
                }
            });

            this.progressBar = document.createElement('progress');
            this.progressBar.style.width = '100%';

            this.progressContainer.appendChild(this.progressText);
            this.progressContainer.appendChild(this.progressBar);
            this.container.appendChild(this.progressContainer);

            // 添加窗口大小变化监听
            window.addEventListener('resize', () => {
                this.updateResponsiveStyles();
            });
        }

        toggleSelectionMode() {
            console.log('toggleSelectionMode 被调用');
            this.isSelectionMode = !this.isSelectionMode;

            if (this.isSelectionMode) {
                console.log('进入选择模式，准备初始化章节列表');
                this.initChapterList();
                this.chapterListContainer.style.display = 'block';
                this.cancelSelectionButton.style.display = 'block';
                this.selectButton.textContent = '下载选中章节';
                this.longPageModeButton.style.display = 'block'; // 确保长图按钮显示
            } else {
                console.log('退出选择模式，检查是否有选中章节');
                if (this.selectedChapters.size > 0) {
                    console.log(`开始下载 ${this.selectedChapters.size} 个选中章节`);
                    // 不立即隐藏,等下载开始后由setLoading控制
                    this.onDownloadSelected();
                } else {
                    console.log('无选中章节，返回初始状态');
                    this.chapterListContainer.style.display = 'none';
                    this.cancelSelectionButton.style.display = 'none';
                    this.selectButton.textContent = '选择章节下载';
                }
            }
        }

        cancelSelectionMode() {
            this.isSelectionMode = false;
            this.chapterListContainer.style.display = 'none';
            this.cancelSelectionButton.style.display = 'none';
            this.selectButton.textContent = '选择章节下载';
            this.selectedChapters.clear();
            this.selectionStart = null;
            this.selectionEnd = null;
            this.updateChapterSelectionUI();
        }
        cancelDownload() {
            if (confirm('确定要取消当前的批量下载吗？')) {
                console.log('用户取消批量下载');

                // 设置取消标志
                GM_setValue('cancelBatchDownload', true);

                // 重置UI状态
                this.isDownloading = false;
                this.setLoading(false);

                // 显示取消提示
                this.selectButton.textContent = '下载已取消';
                this.selectButton.style.backgroundColor = '#ff9800';
                this.selectButton.disabled = true;

                setTimeout(() => {
                    this.selectButton.textContent = '选择章节下载';
                    this.selectButton.style.backgroundColor = '#4CAF50';
                    this.selectButton.disabled = false;
                }, 2000);
            }
        }

        async initChapterList() {
            this.chapterListContainer.innerHTML = '';
            this.selectedChapters = new Set();
            this.selectionStart = null;
            this.selectionEnd = null;

            try {
                const chapterLinks = await this.adapter.getChapterLinks();
                if (!chapterLinks || chapterLinks.length === 0) {
                    return;
                }

                // 操作区
                const controlsContainer = this.createElement('div', {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                    gap: '8px',
                    position: 'sticky',
                    top: '0',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    padding: '5px 0',
                    zIndex: '1'
                });

                const chapterCountLabel = this.createElement('span', {
                    fontSize: '12px',
                    color: '#666',
                    alignSelf: 'center'
                }, `共 ${chapterLinks.length} 章`);

                const buttonsContainer = this.createElement('div', {
                    display: 'flex',
                    gap: '5px'
                });

                // 全选按钮
                const selectAllBtn = this.createElement('button', {
                    padding: '3px 10px',
                    fontSize: '12px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }, '全选章节');

                selectAllBtn.addEventListener('click', () => {
                    this.selectedChapters = new Set(chapterLinks.map((_, i) => i));
                    this.selectionStart = 0;
                    this.selectionEnd = chapterLinks.length - 1;
                    this.updateChapterSelectionUI();
                    this.selectButton.textContent = `下载选中章节 (${this.selectedChapters.size})`;
                });

                // 清除选择按钮
                const deselectAllBtn = this.createElement('button', {
                    padding: '3px 10px',
                    fontSize: '12px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }, '清除选择');

                deselectAllBtn.addEventListener('click', () => {
                    this.selectedChapters.clear();
                    this.selectionStart = null;
                    this.selectionEnd = null;
                    this.updateChapterSelectionUI();
                    this.selectButton.textContent = '下载选中章节';
                });

                // 刷新按钮
                const refreshBtn = this.createElement('button', {
                    padding: '3px 10px',
                    fontSize: '12px',
                    backgroundColor: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }, '刷新列表');

                refreshBtn.addEventListener('click', () => this.refreshChapterList());

                buttonsContainer.appendChild(selectAllBtn);
                buttonsContainer.appendChild(deselectAllBtn);
                buttonsContainer.appendChild(refreshBtn);
                controlsContainer.appendChild(chapterCountLabel);
                controlsContainer.appendChild(buttonsContainer);
                this.chapterListContainer.appendChild(controlsContainer);

                // 章节列表
                chapterLinks.forEach((chapter, index) => {
                    const chapterItem = this.createElement('div', {
                        padding: '10px 12px',
                        marginBottom: '8px',
                        borderRadius: '8px',
                        background: '#f5f7fa',
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s',
                        fontSize: '15px',
                        fontWeight: '500',
                        userSelect: 'none',
                        border: '1px solid #e0e6ef',
                    });
                    chapterItem.textContent = chapter.name;
                    chapterItem.addEventListener('click', () => this.handleChapterClick(index, chapterLinks.length));
                    chapterItem.classList.add('chapter-item');
                    this.chapterListContainer.appendChild(chapterItem);
                });

                this.updateChapterSelectionUI();
            } catch (error) {
                console.error('初始化章节列表失败:', error);
            }
        }

        handleChapterClick(index, total) {
            console.log(`处理章节点击: index=${index}, total=${total}`);
            if (!this.isSelectionMode) {
                this.toggleSelectionMode();
            }

            if (this.selectionStart === null) {
                // 第一次点击，设置起始点
                this.selectionStart = index;
                this.selectedChapters = new Set([index]);
            } else if (this.selectionEnd === null) {
                // 第二次点击，设置结束点并选择区间
                this.selectionEnd = index;
                const [start, end] = [this.selectionStart, this.selectionEnd].sort((a, b) => a - b);
                this.selectedChapters = new Set();
                for (let i = start; i <= end; i++) {
                    this.selectedChapters.add(i);
                }
            } else {
                // 第三次点击，开始新的选择
                this.selectionStart = index;
                this.selectionEnd = null;
                this.selectedChapters = new Set([index]);
            }

            this.updateChapterSelectionUI();
            if (this.selectedChapters.size > 0) {
                this.selectButton.textContent = `下载选中章节 (${this.selectedChapters.size})`;
            } else {
                this.selectButton.textContent = '下载选中章节';
            }
        }

        updateChapterSelectionUI() {
            console.log('更新章节选择UI');
            const items = this.chapterListContainer.querySelectorAll('.chapter-item');
            items.forEach((item, idx) => {
                if (this.selectedChapters.has(idx)) {
                    item.style.background = '#2196f3';
                    item.style.color = '#fff';
                } else {
                    item.style.background = '#f5f7fa';
                    item.style.color = '#222';
                }
            });
        }

        refreshChapterList() {
            this.initChapterList();
        }

        toggleLongPageMode() {
            this.isLongPageMode = !this.isLongPageMode;
            this.longPageModeButton.textContent = this.isLongPageMode ? '切换普通模式' : '切换长图模式';
            this.longPageModeButton.style.backgroundColor = this.isLongPageMode ? '#4CAF50' : '#2196F3';
        }

        createElement(type, styles, textContent = '') {
            const element = document.createElement(type);
            if (type === 'input' && styles.type) {
                element.type = styles.type;
                delete styles.type;
            }
            if (typeof styles === 'string') {
                element.className = styles;
            } else {
                applyResponsiveStyles(element, styles);
            }
            if (textContent) element.textContent = textContent;
            return element;
        }

        // 添加 setLoading 方法
        setLoading(isLoading, totalChapters = 0) {
            console.log(`设置加载状态: isLoading=${isLoading}, totalChapters=${totalChapters}`);
            this.isDownloading = isLoading;

            if (isLoading) {
                // 下载中状态
                this.selectButton.disabled = true;
                this.selectButton.style.backgroundColor = '#999';
                this.selectButton.style.cursor = 'not-allowed';
                this.selectButton.textContent = '下载中...';

                this.longPageModeButton.style.display = 'none';
                // 取消按钮改为显示"取消下载"
                this.cancelSelectionButton.style.display = 'block';
                this.cancelSelectionButton.textContent = '取消下载';
                this.cancelSelectionButton.style.backgroundColor = '#f44336';

                this.chapterListContainer.style.display = 'none';
                this.progressContainer.style.display = 'block';

                if (this.progressBar) {
                    this.progressBar.max = totalChapters;
                    this.progressBar.value = 0;
                }
                if (this.progressText) {
                    this.progressText.textContent = `准备下载 ${totalChapters} 个章节...`;
                }
            } else {
                // 恢复初始状态
                this.selectButton.disabled = false;
                this.selectButton.style.backgroundColor = '#4CAF50';
                this.selectButton.style.cursor = 'pointer';
                this.selectButton.textContent = '选择章节下载';

                this.longPageModeButton.style.display = 'block';
                this.cancelSelectionButton.style.display = 'none';
                this.cancelSelectionButton.textContent = '返回'; // 恢复默认文本

                this.chapterListContainer.style.display = 'none';
                this.progressContainer.style.display = 'none';

                // 重置选择状态
                this.isSelectionMode = false;
                this.selectedChapters.clear();
                this.selectionStart = null;
                this.selectionEnd = null;
            }
        }

        // 添加 updateProgress 方法
        updateProgress(current, total, currentChapter = '', currentImage = 0, totalImages = 0) {
            console.log(`更新进度: current=${current}, total=${total}`);
            if (this.progressBar) {
                this.progressBar.value = current;
                const percent = ((current / total) * 100).toFixed(1);

                if (this.progressText) {
                    let progressHTML = `
                <div style="text-align: center; line-height: 1.6; padding: 8px;">
                    <div style="font-size: 16px; font-weight: bold; color: #4CAF50;">
                        正在下载第 ${current}/${total} 个章节
                    </div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">
                        进度: ${percent}%
                    </div>
            `;

                    // 如果有当前章节的图片信息,显示出来
                    if (currentChapter && totalImages > 0) {
                        progressHTML += `
                    <div style="font-size: 12px; color: #999; margin-top: 5px;">
                        ${currentChapter}: ${currentImage}/${totalImages} 张图片
                    </div>
                `;
                    }

                    progressHTML += `</div>`;
                    this.progressText.innerHTML = progressHTML;
                }

                // 更新按钮文本
                if (this.selectButton) {
                    this.selectButton.textContent = `下载中... (${current}/${total})`;
                }
            }
        }
    }

    class ComicDownloader {
        constructor() {
            try {
                console.log('开始创建ComicDownloader实例...');
                this.adapter = getSiteAdapter();
                this.isLongPageMode = GM_getValue('isLongPageMode', false);
                this.isDownloading = false;
                this.abortController = null;

                if (this.adapter.isChapterPage()) {
                    console.log('当前是章节页面');
                    const imageElements = this.adapter.getImageElements();
                    this.totalPages = imageElements.length;
                    this.chapterName = this.adapter.getChapterName();

                    console.log('图片元素数量:', this.totalPages);
                    console.log('章节名称:', this.chapterName);
                    console.log('图片元素列表:', imageElements);

                    if (this.totalPages > 0) {
                        console.log(`找到 ${this.totalPages} 页图片`);
                        this.ui = new DownloaderUI(this.totalPages, this.handleDownload.bind(this), this.handleCancel.bind(this));
                        if (this.isLongPageMode) {
                            this.ui.isLongPageMode = true;
                            this.ui.longPageModeButton.textContent = '切换普通模式';
                            this.ui.longPageModeButton.style.backgroundColor = '#4CAF50';
                        }
                    } else {
                        console.log('未找到图片元素');
                        // 即使没有找到图片也创建UI，让用户知道脚本已运行
                        this.ui = new DownloaderUI(0, this.handleDownload.bind(this), this.handleCancel.bind(this));
                    }
                } else if (this.adapter.isDirectoryPage()) {
                    console.log('当前是目录页面');
                    this.ui = new ChapterSelectorUI({
                        adapter: this.adapter,
                        onDownloadSelected: this.handleDownloadSelected.bind(this),
                        onToggleLongPageMode: (isLong) => { this.isLongPageMode = isLong; },
                        onCancel: () => { },
                        onProgress: (current, total) => this.ui.updateProgress(current, total),
                        onLoading: (isLoading, total) => this.ui.setLoading(isLoading, total),
                        onComplete: () => { },
                        onError: (err) => this.ui.showError && this.ui.showError(err)
                    });
                    // 确保UI立即显示
                    if (this.ui && this.ui.container) {
                        this.ui.container.style.display = 'flex';
                        this.ui.chapterListContainer.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('初始化失败:', error);
            }
        }

        async handleDownload() {
            if (this.isDownloading) {
                alert('当前正在下载,请稍后再试');
                return;
            }

            try {
                this.isDownloading = true;
                this.abortController = new AbortController();
                this.ui.setLoading(true, true); // 显示取消按钮
                this.isLongPageMode = this.ui.isLongPageMode;
                await this.downloadComic();

                // 下载成功提示
                this.ui.infoText.textContent = '下载完成!';
                this.ui.infoText.style.display = 'block';
                setTimeout(() => {
                    this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
                }, 3000);

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('下载已取消');
                    // 取消时不显示alert,已经在handleCancel中处理
                } else {
                    this.handleError(error, '下载失败');
                    // 显示错误信息
                    this.ui.infoText.textContent = '下载失败,请重试';
                    this.ui.infoText.style.display = 'block';
                    this.ui.infoText.style.color = '#f44336';
                    setTimeout(() => {
                        this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
                        this.ui.infoText.style.color = '#4a5568';
                    }, 3000);
                }
            } finally {
                this.isDownloading = false;
                this.abortController = null;
                this.ui.setLoading(false, false);
            }
        }

        handleCancel() {
            if (this.abortController) {
                this.abortController.abort();
                this.isDownloading = false;
                this.ui.setLoading(false, false);

                // 显示取消消息
                this.ui.infoText.textContent = '下载已取消';
                this.ui.infoText.style.display = 'block';
                this.ui.infoText.style.color = '#ff9800';

                setTimeout(() => {
                    this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
                    this.ui.infoText.style.color = '#4a5568';
                }, 2000);
            }
        }

        async downloadComic() {
            console.log('开始下载漫画...');
            const images = await this.downloadImages(1, this.totalPages);
            console.log('所有图片下载完成，开始生成PDF...');
            await this.generatePDF(images);
            console.log('PDF生成完成，准备保存...');
        }

        async downloadImages(start, end) {
            console.log(`开始下载图片 ${start} 到 ${end}`);
            const imageElements = this.adapter.getImageElements();
            const downloadResults = new Array(end - start + 1);
            const downloadPromises = [];

            // 存储总图片数,供目录页面读取
            GM_setValue('totalImages', end - start + 1);

            for (let i = 0; i < imageElements.length; i++) {
                const pageNumber = i + 1;
                if (pageNumber >= start && pageNumber <= end) {
                    this.addDownloadPromise(imageElements[i], pageNumber, start, downloadResults, downloadPromises);
                }
            }

            console.log(`总共需要下载 ${downloadPromises.length} 张图片`);
            await Promise.all(downloadPromises);
            console.log('所有图片下载任务已完成');
            return downloadResults;
        }

        addDownloadPromise(element, pageNumber, start, downloadResults, downloadPromises) {
            const imgUrl = this.adapter.getImageUrl(element);
            if (imgUrl) {
                console.log(`添加第 ${pageNumber} 页图片下载任务: ${imgUrl}`);
                const arrayIndex = pageNumber - start;
                downloadPromises.push(
                    this.downloadImage(imgUrl)
                        .then(imgData => {
                            downloadResults[arrayIndex] = imgData;
                            this.ui.updateProgress(pageNumber);

                            // 更新当前下载的图片数,供目录页面读取
                            GM_setValue('currentImage', pageNumber);

                            console.log(`第 ${pageNumber} 页下载完成`);
                        })
                        .catch(error => {
                            console.error(`第 ${pageNumber} 页下载失败:`, error);
                            downloadResults[arrayIndex] = null;

                            // 即使失败也更新进度
                            GM_setValue('currentImage', pageNumber);
                        })
                );
            } else {
                console.warn(`第 ${pageNumber} 页图片URL无效`);
            }
        }
        downloadImage(imgUrl) {
            return new Promise((resolve, reject) => {
                // 检查是否被取消
                if (this.abortController && this.abortController.signal.aborted) {
                    reject(new Error('AbortError'));
                    return;
                }

                console.log(`开始下载图片: ${imgUrl}`);

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: imgUrl,
                    responseType: 'blob',
                    headers: {
                        'Referer': window.location.href,
                        'User-Agent': navigator.userAgent
                    },
                    onload: (response) => {
                        if (this.abortController && this.abortController.signal.aborted) {
                            reject(new Error('AbortError'));
                            return;
                        }

                        if (response.status === 200) {
                            this.handleImageResponse(response, resolve, reject);
                        } else {
                            console.error(`图片下载失败，状态码: ${response.status}`);
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: (error) => {
                        console.error('图片下载出错:', error);
                        reject(error);
                    },
                    ontimeout: () => {
                        console.error('图片下载超时');
                        reject(new Error('下载超时'));
                    },
                    timeout: 30000 // 30秒超时
                });
            });
        }

        handleImageResponse(response, resolve, reject) {
            try {
                const blob = response.response;
                const reader = new FileReader();
                reader.onload = event => resolve(event.target.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(blob);
            } catch (error) {
                reject(error);
            }
        }

        async generatePDF(images) {
            console.log('开始生成PDF...');
            const pdf = new jspdf.jsPDF();
            const sizes = await this.getImageSizes(images);
            console.log('获取图片尺寸完成');

            if (this.isLongPageMode) {
                console.log('使用长图模式生成PDF');
                // 长图模式：将所有图片垂直拼接
                await this.generateLongPagePDF(pdf, images, sizes);
            } else {
                console.log('使用普通模式生成PDF');
                // 普通模式：每页一张图片
                for (let i = 0; i < images.length; i++) {
                    await this.addImageToPdf(pdf, images[i], i, sizes[i]);
                    this.ui.updateProgress(i + 1);
                    console.log(`已添加第 ${i + 1} 页到PDF`);
                }
            }

            console.log('PDF生成完成，准备保存文件');
            pdf.save(`${this.chapterName}.pdf`);
            console.log(`文件保存完成: ${this.chapterName}.pdf`);
        }

        async generateLongPagePDF(pdf, images, sizes) {
            console.log('开始生成长图PDF（分页模式）...');
            const A4_width = 210;
            const MAX_PAGE_HEIGHT = 20000; // 单页最大高度（20米），可根据需要调整

            // 先过滤掉无效的图片
            const validIndices = [];
            for (let i = 0; i < images.length; i++) {
                if (images[i] && images[i] !== 'null' && images[i] !== 'undefined') {
                    validIndices.push(i);
                } else {
                    console.warn(`第 ${i + 1} 张图片数据无效，已跳过`);
                }
            }

            if (validIndices.length === 0) {
                throw new Error('没有有效的图片可以生成PDF');
            }

            console.log(`有效图片数量: ${validIndices.length}/${images.length}`);

            // 按高度分组图片到不同页面
            const pages = [];
            let currentPage = {
                images: [],
                indices: [],
                totalHeight: 0
            };

            for (const idx of validIndices) {
                const scaleFactor = A4_width / sizes[idx].width;
                const scaledHeight = sizes[idx].height * scaleFactor;

                // 如果当前页面加上这张图片会超过最大高度，且当前页面不为空
                if (currentPage.totalHeight + scaledHeight > MAX_PAGE_HEIGHT && currentPage.images.length > 0) {
                    // 保存当前页面
                    pages.push(currentPage);
                    console.log(`页面 ${pages.length}: 包含 ${currentPage.images.length} 张图片，总高度 ${currentPage.totalHeight.toFixed(2)}mm`);

                    // 创建新页面
                    currentPage = {
                        images: [],
                        indices: [],
                        totalHeight: 0
                    };
                }

                // 将图片添加到当前页面
                currentPage.images.push(images[idx]);
                currentPage.indices.push(idx);
                currentPage.totalHeight += scaledHeight;
            }

            // 添加最后一页
            if (currentPage.images.length > 0) {
                pages.push(currentPage);
                console.log(`页面 ${pages.length}: 包含 ${currentPage.images.length} 张图片，总高度 ${currentPage.totalHeight.toFixed(2)}mm`);
            }

            console.log(`总共分为 ${pages.length} 页`);

            // 删除默认创建的第一页
            pdf.deletePage(1);

            // 为每一页生成PDF
            let totalProcessed = 0;
            for (let pageNum = 0; pageNum < pages.length; pageNum++) {
                const page = pages[pageNum];
                console.log(`开始处理第 ${pageNum + 1}/${pages.length} 页PDF...`);

                // 创建新页面
                pdf.addPage([A4_width, page.totalHeight], 'portrait');

                // 在当前页面垂直拼接图片
                let currentY = 0;
                for (let i = 0; i < page.images.length; i++) {
                    const imgIdx = page.indices[i];

                    await new Promise((resolve, reject) => {
                        const img = new Image();
                        let isResolved = false;

                        const cleanup = () => {
                            img.onload = null;
                            img.onerror = null;
                            img.src = '';
                        };

                        img.onload = () => {
                            if (isResolved) return;
                            isResolved = true;

                            try {
                                const scaleFactor = A4_width / sizes[imgIdx].width;
                                const scaledHeight = sizes[imgIdx].height * scaleFactor;

                                console.log(`页面${pageNum + 1} - 添加第 ${i + 1}/${page.images.length} 张图片:`, {
                                    原始尺寸: `${sizes[imgIdx].width}x${sizes[imgIdx].height}`,
                                    缩放后尺寸: `${A4_width}x${scaledHeight.toFixed(2)}`,
                                    Y坐标: currentY.toFixed(2)
                                });

                                // 添加图片到 PDF
                                pdf.addImage(
                                    page.images[i],
                                    'JPEG',
                                    0,
                                    currentY,
                                    A4_width,
                                    scaledHeight,
                                    `page${pageNum}_image${i}`, // 唯一别名
                                    'FAST'
                                );

                                currentY += scaledHeight;
                                totalProcessed++;
                                this.ui.updateProgress(totalProcessed);

                                cleanup();

                                // 添加小延迟
                                setTimeout(resolve, 10);
                            } catch (error) {
                                console.error(`页面${pageNum + 1} - 添加第 ${i + 1} 张图片失败:`, error);
                                cleanup();
                                reject(error);
                            }
                        };

                        img.onerror = (error) => {
                            if (isResolved) return;
                            isResolved = true;

                            console.error(`页面${pageNum + 1} - 加载第 ${i + 1} 张图片失败:`, error);
                            totalProcessed++;
                            this.ui.updateProgress(totalProcessed);
                            cleanup();
                            resolve();
                        };

                        // 设置超时保护
                        setTimeout(() => {
                            if (!isResolved) {
                                console.warn(`页面${pageNum + 1} - 第 ${i + 1} 张图片加载超时`);
                                isResolved = true;
                                cleanup();
                                resolve();
                            }
                        }, 5000);

                        img.src = page.images[i];
                    });
                }

                console.log(`第 ${pageNum + 1}/${pages.length} 页PDF处理完成，最终高度: ${currentY.toFixed(2)}mm`);

                // 每页处理完后暂停一下
                if (pageNum < pages.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log('所有页面处理完成');
        }
        async getImageSizes(images) {
            return Promise.all(images.map(imgData => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.src = imgData;
                    img.onload = () => resolve({ width: img.width, height: img.height });
                });
            }));
        }

        async addImageToPdf(pdf, imgData, index, size) {
            return new Promise(resolve => {
                const img = new Image();
                img.src = imgData;
                img.onload = () => {
                    if (index > 0) pdf.addPage();

                    const A4_width = 210;
                    const A4_height = 297;
                    const scaleFactor = A4_width / size.width;
                    let finalWidth = A4_width;
                    let finalHeight = size.height * scaleFactor;

                    if (finalHeight > A4_height) {
                        finalHeight = A4_height;
                        finalWidth = size.width * (A4_height / size.height);
                    }

                    pdf.internal.pageSize.width = finalWidth;
                    pdf.internal.pageSize.height = finalHeight;
                    pdf.addImage(imgData, 'JPEG', 0, 0, finalWidth, finalHeight);
                    console.log(`已添加第 ${index + 1} 页到PDF，尺寸: ${finalWidth}x${finalHeight}`);
                    resolve();
                };
            });
        }

        handleError(error, message = '下载失败') {
            console.error(message, error);
            alert(`${message}，请查看控制台了解详情`);
        }

        // 添加处理选中章节下载的方法
        async handleDownloadSelected() {
            console.log('开始处理选中章节下载...');
            const selectedChapters = this.ui.selectedChapters;
            if (selectedChapters.size === 0) {
                console.log('未选择任何章节');
                this.ui.selectButton.textContent = '⚠️ 请选择至少一个章节';
                this.ui.selectButton.style.backgroundColor = '#ff9800';
                setTimeout(() => {
                    this.ui.selectButton.textContent = '选择章节下载';
                    this.ui.selectButton.style.backgroundColor = '#4CAF50';
                }, 2000);
                return;
            }

            try {
                const chapterLinks = await this.adapter.getChapterLinks();
                const selectedChapterUrls = Array.from(selectedChapters).map(index => chapterLinks[index].url);
                const chapterCount = selectedChapterUrls.length;

                console.log(`准备批量下载 ${chapterCount} 个章节`);

                // 清除取消标志
                GM_setValue('cancelBatchDownload', false);

                this.ui.setLoading(true, chapterCount);
                this.isLongPageMode = this.ui.isLongPageMode;

                const batchSessionId = Date.now().toString();
                GM_setValue('isLongPageMode', this.isLongPageMode);
                console.log(`创建批量下载会话: ${batchSessionId}`);

                // 存储下载失败的章节
                const failedChapters = [];
                const cancelledChapters = [];

                for (let i = 0; i < selectedChapterUrls.length; i++) {
                    // 检查是否被取消
                    if (GM_getValue('cancelBatchDownload', false)) {
                        console.log('检测到取消标志，停止批量下载');
                        cancelledChapters.push(...selectedChapterUrls.slice(i).map((url, idx) => {
                            return chapterLinks[Array.from(selectedChapters)[i + idx]].name;
                        }));
                        break;
                    }

                    const url = selectedChapterUrls[i];
                    const chapterName = chapterLinks[Array.from(selectedChapters)[i]].name;

                    console.log(`准备下载第 ${i + 1}/${chapterCount} 个章节: ${chapterName}`);

                    // 更新进度 - 显示正在下载哪个章节
                    this.ui.updateProgress(i, chapterCount, chapterName, 0, 0);

                    try {
                        GM_setValue('autoDownload', true);
                        GM_setValue('sessionId', Date.now().toString());
                        GM_setValue('downloadStatus', 'pending');
                        GM_setValue('currentChapterName', chapterName);

                        const tab = GM_openInTab(url, {
                            active: false,
                            insert: true,
                            setParent: true
                        });

                        // 等待下载完成,同时监听图片下载进度
                        await new Promise((resolve, reject) => {
                            const maxWaitTime = 120000;
                            const startTime = Date.now();
                            let resolved = false;

                            const checkStatus = () => {
                                if (resolved) return;

                                // 检查是否被取消
                                if (GM_getValue('cancelBatchDownload', false)) {
                                    resolved = true;
                                    GM_setValue('downloadStatus', '');
                                    GM_setValue('currentImage', 0);
                                    GM_setValue('totalImages', 0);
                                    console.log('下载被用户取消');
                                    reject(new Error('用户取消下载'));
                                    return;
                                }

                                const status = GM_getValue('downloadStatus', '');
                                const elapsedTime = Date.now() - startTime;

                                // 获取当前图片下载进度
                                const currentImage = GM_getValue('currentImage', 0);
                                const totalImages = GM_getValue('totalImages', 0);

                                // 实时更新图片进度
                                if (totalImages > 0) {
                                    this.ui.updateProgress(i, chapterCount, chapterName, currentImage, totalImages);
                                }

                                if (status === 'complete') {
                                    resolved = true;
                                    GM_setValue('downloadStatus', '');
                                    GM_setValue('currentImage', 0);
                                    GM_setValue('totalImages', 0);
                                    console.log(`✓ 第 ${i + 1} 个章节下载完成: ${chapterName}`);
                                    resolve();
                                } else if (elapsedTime > maxWaitTime) {
                                    resolved = true;
                                    GM_setValue('downloadStatus', '');
                                    GM_setValue('currentImage', 0);
                                    GM_setValue('totalImages', 0);
                                    console.warn(`✗ 第 ${i + 1} 个章节下载超时: ${chapterName}`);
                                    failedChapters.push(chapterName);
                                    reject(new Error('下载超时'));
                                }
                            };

                            const checkInterval = setInterval(() => {
                                checkStatus();
                                if (resolved) {
                                    clearInterval(checkInterval);
                                }
                            }, 500);
                        });

                        setTimeout(() => {
                            try {
                                tab.close();
                            } catch (e) {
                                console.log('标签页可能已关闭');
                            }
                        }, 1000);

                        // 更新为完成状态
                        this.ui.updateProgress(i + 1, chapterCount);

                        if (i < chapterCount - 1) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }

                    } catch (error) {
                        if (error.message === '用户取消下载') {
                            console.log('用户取消下载，跳出循环');
                            cancelledChapters.push(chapterName);
                            break;
                        }
                        console.error(`✗ 第 ${i + 1} 个章节下载失败: ${chapterName}`, error);
                        failedChapters.push(chapterName);
                    }
                }

                // 清除批量下载标志
                GM_setValue('autoDownload', false);
                GM_setValue('sessionId', '');
                GM_setValue('currentChapterName', '');
                GM_setValue('cancelBatchDownload', false);

                this.ui.setLoading(false);
                console.log('批量下载流程结束');

                // 显示完成统计
                const successCount = chapterCount - failedChapters.length - cancelledChapters.length;

                if (cancelledChapters.length > 0) {
                    this.ui.selectButton.textContent = `已取消 (完成${successCount}个)`;
                    this.ui.selectButton.style.backgroundColor = '#ff9800';

                    let message = `批量下载已取消\n\n`;
                    message += `✓ 已完成: ${successCount}个\n`;
                    if (failedChapters.length > 0) {
                        message += `✗ 失败: ${failedChapters.length}个\n`;
                    }
                    message += `⊗ 已取消: ${cancelledChapters.length}个`;

                    alert(message);
                } else if (failedChapters.length === 0) {
                    this.ui.selectButton.textContent = `🎉 全部完成! (${chapterCount}个章节)`;
                    this.ui.selectButton.style.backgroundColor = '#4CAF50';
                } else {
                    alert(`下载完成!\n成功: ${successCount}个\n失败: ${failedChapters.length}个\n\n失败章节:\n${failedChapters.join('\n')}`);
                    this.ui.selectButton.textContent = `⚠️ 部分完成 (失败${failedChapters.length}个)`;
                    this.ui.selectButton.style.backgroundColor = '#ff9800';
                }

                this.ui.selectButton.disabled = true;

                setTimeout(() => {
                    this.ui.selectButton.textContent = '选择章节下载';
                    this.ui.selectButton.style.backgroundColor = '#4CAF50';
                    this.ui.selectButton.disabled = false;
                }, 5000);

            } catch (error) {
                console.error('批量下载失败:', error);
                GM_setValue('autoDownload', false);
                GM_setValue('sessionId', '');
                GM_setValue('cancelBatchDownload', false);

                this.ui.setLoading(false);
                this.ui.selectButton.textContent = '❌ 下载失败,请重试';
                this.ui.selectButton.style.backgroundColor = '#f44336';
                setTimeout(() => {
                    this.ui.selectButton.textContent = '选择章节下载';
                    this.ui.selectButton.style.backgroundColor = '#4CAF50';
                }, 3000);
            }
        }
    }

    // 6. 初始化
    function initialize() {
        console.log('开始初始化下载器...');
        try {
            // 创建下载器实例
            window.comicDownloader = new ComicDownloader();

            // 检查是否需要自动下载
            const autoDownload = GM_getValue('autoDownload', false);
            const sessionId = GM_getValue('sessionId', '');
            const currentTime = Date.now();

            console.log('自动下载标志:', autoDownload);
            console.log('会话ID:', sessionId);

            // 只有在批量下载流程中才自动下载
            // 判断条件：1. autoDownload为true 2. sessionId存在且未过期(5分钟内)
            if (autoDownload &&
                sessionId &&
                window.comicDownloader.adapter.isChapterPage() &&
                (currentTime - parseInt(sessionId)) < 300000) { // 5分钟内有效

                console.log('检测到批量下载流程，准备自动下载');

                // 读取长图模式状态
                window.comicDownloader.isLongPageMode = GM_getValue('isLongPageMode', false);

                setTimeout(async () => {
                    try {
                        console.log('开始自动下载...');
                        await window.comicDownloader.handleDownload();
                        console.log('自动下载完成，设置状态为 complete');
                        GM_setValue('downloadStatus', 'complete');
                    } catch (error) {
                        console.error('自动下载失败:', error);
                        GM_setValue('downloadStatus', 'complete');
                    }
                }, 2000);
            } else {
                // 清除过期的自动下载标志
                if (autoDownload) {
                    console.log('清除自动下载标志（非批量下载或已过期）');
                    GM_setValue('autoDownload', false);
                    GM_setValue('sessionId', '');
                }
            }

            // 确保UI显示
            if (window.comicDownloader.ui) {
                console.log('UI已初始化');
                if (window.comicDownloader.adapter.isDirectoryPage()) {
                    console.log('当前是目录页面');
                    window.comicDownloader.ui.chapterListContainer.style.display = 'block';
                }
            } else {
                console.error('UI初始化失败');
            }
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    // 确保在页面完全加载后再初始化
    if (document.readyState === 'complete') {
        console.log('页面已加载完成，立即初始化');
        initialize();
    } else {
        console.log('等待页面加载完成...');
        window.addEventListener('load', () => {
            console.log('页面加载完成，开始初始化');
            initialize();
        });
    }
})();