// ==UserScript==
// @name         网页漫画下载为pdf格式
// @namespace    http://tampermonkey.net/
// @version      2.3.0
// @description  将网页漫画下载为pdf方便阅读，目前仅适用于如漫画[http://www.rumanhua1.com/]
// @author       MornLight
// @match        http://m.rumanhua1.com/*
// @match        http://www.rumanhua1.com/*
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
            }
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
            }
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
            return url.includes('www.rumanhua1.com') && !this.isChapterPage();
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

    // 3. 获取适配器的工厂函数
    function getSiteAdapter() {
        const url = window.location.href;
        switch (true) {
            case url.includes('http://www.rumanhua1.com/'):
                return new RumanhuaPCAdapter();
            case url.includes('http://m.rumanhua1.com/'):
                return new RumanhuaAdapter();
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
            this.downloadButton.style.display = isLoading ? 'none' : 'block'; // 修改：控制下载按钮显示
            this.cancelButton.style.display = showCancel ? 'block' : 'none';
            this.progressContainer.style.display = isLoading ? 'block' : 'none';
            this.infoText.style.display = isLoading ? 'none' : 'block';
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
                this.cancelSelectionMode();
                this.onCancel && this.onCancel();
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
            } else {
                console.log('退出选择模式，检查是否有选中章节');
                if (this.selectedChapters.size > 0) {
                    console.log(`开始下载 ${this.selectedChapters.size} 个选中章节`);
                    this.chapterListContainer.style.display = 'none';
                    this.cancelSelectionButton.style.display = 'none';
                    // 调用下载处理函数
                    this.onDownloadSelected();
                } else {
                    console.log('无选中章节，返回选择模式');
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
            this.selectButton.disabled = isLoading;
            this.selectButton.style.backgroundColor = isLoading ? '#999' : '#4CAF50';
            this.selectButton.style.cursor = isLoading ? 'not-allowed' : 'pointer';
            this.longPageModeButton.style.display = isLoading ? 'none' : 'block';

            if (isLoading) {
                this.selectButton.textContent = '下载中...';
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
                this.selectButton.textContent = '选择章节下载';
                this.progressContainer.style.display = 'none';
            }
        }

        // 添加 updateProgress 方法
        updateProgress(current, total) {
            console.log(`更新进度: current=${current}, total=${total}`);
            if (this.progressBar) {
                this.progressBar.value = current;
                const percent = ((current / total) * 100).toFixed(2);
                if (this.progressText) {
                    this.progressText.textContent = `下载进度: ${current}/${total} (${percent}%)`;
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
                    }
                } else if (this.adapter.isDirectoryPage()) {
                    console.log('当前是目录页面');
                    this.ui = new ChapterSelectorUI({
                        adapter: this.adapter,
                        onDownloadSelected: this.handleDownloadSelected.bind(this),
                        onToggleLongPageMode: (isLong) => { this.isLongPageMode = isLong; },
                        onCancel: () => {},
                        onProgress: (current, total) => this.ui.updateProgress(current, total),
                        onLoading: (isLoading, total) => this.ui.setLoading(isLoading, total),
                        onComplete: () => {},
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
                alert('当前正在下载，请稍后再试');
                return;
            }

            try {
                this.isDownloading = true;
                this.abortController = new AbortController();
                this.ui.setLoading(true, true);
                // 传递长图模式状态
                this.isLongPageMode = this.ui.isLongPageMode;
                await this.downloadComic();
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('下载已取消');
                    alert('下载已取消');
                } else {
                    this.handleError(error, '下载失败');
                }
            } finally {
                this.isDownloading = false;
                this.abortController = null;
                this.ui.setLoading(false, false);
            }
        }

        handleCancel() {
            if (this.abortController) {
                this.abortController.abort(); // 中断下载
                this.isDownloading = false; // 重置下载状态
                this.ui.setLoading(false, false); // 重置UI状态
                // 显示取消消息，然后恢复下载按钮
                setTimeout(() => {
                    this.ui.downloadButton.style.display = 'block';
                    this.ui.downloadButton.disabled = false;
                }, 2000);
            }
        }

        async downloadComic() {
            const images = await this.downloadImages(1, this.totalPages);
            await this.generatePDF(images);
        }

        async downloadImages(start, end) {
            const imageElements = this.adapter.getImageElements();
            const downloadResults = new Array(end - start + 1);
            const downloadPromises = [];

            for (let i = 0; i < imageElements.length; i++) {
                const pageNumber = i + 1;
                if (pageNumber >= start && pageNumber <= end) {
                    this.addDownloadPromise(imageElements[i], pageNumber, start, downloadResults, downloadPromises);
                }
            }

            await Promise.all(downloadPromises);
            return downloadResults;
        }

        addDownloadPromise(element, pageNumber, start, downloadResults, downloadPromises) {
            const imgUrl = this.adapter.getImageUrl(element);
            if (imgUrl) {
                const arrayIndex = pageNumber - start;
                downloadPromises.push(
                    this.downloadImage(imgUrl)
                        .then(imgData => {
                            downloadResults[arrayIndex] = imgData;
                            this.ui.updateProgress(pageNumber);
                        })
                        .catch(error => {
                            console.error(`第 ${pageNumber} 页下载失败:`, error);
                            downloadResults[arrayIndex] = null;
                        })
                );
            }
        }

        downloadImage(url) {
            return new Promise((resolve, reject) => {
                if (this.abortController?.signal?.aborted) {
                    reject(new DOMException('下载已取消', 'AbortError'));
                    return;
                }

                const request = GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    onload: response => this.handleImageResponse(response, resolve, reject),
                    onerror: error => reject(error)
                });

                // 监听中断信号
                this.abortController?.signal?.addEventListener('abort', () => {
                    request.abort();  // 中断请求
                    reject(new DOMException('下载已取消', 'AbortError'));
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
            const pdf = new jspdf.jsPDF();
            const sizes = await this.getImageSizes(images);

            if (this.isLongPageMode) {
                // 长图模式：将所有图片垂直拼接
                await this.generateLongPagePDF(pdf, images, sizes);
            } else {
                // 普通模式：每页一张图片
                for (let i = 0; i < images.length; i++) {
                    await this.addImageToPdf(pdf, images[i], i, sizes[i]);
                    this.ui.updateProgress(i + 1);
                }
            }

            pdf.save(`${this.chapterName}.pdf`);
        }

        async generateLongPagePDF(pdf, images, sizes) {
            // 计算所有图片的总高度
            const A4_width = 210;
            let totalHeight = 0;
            let maxWidth = 0;

            // 计算缩放比例和总高度
            for (let i = 0; i < sizes.length; i++) {
                const scaleFactor = A4_width / sizes[i].width;
                const scaledHeight = sizes[i].height * scaleFactor;
                totalHeight += scaledHeight;
                maxWidth = Math.max(maxWidth, sizes[i].width * scaleFactor);
            }

            // 设置PDF页面大小
            pdf.internal.pageSize.width = A4_width;
            pdf.internal.pageSize.height = totalHeight;

            // 垂直拼接所有图片
            let currentY = 0;
            for (let i = 0; i < images.length; i++) {
                const img = new Image();
                img.src = images[i];

                await new Promise(resolve => {
                    img.onload = () => {
                        const scaleFactor = A4_width / sizes[i].width;
                        const scaledHeight = sizes[i].height * scaleFactor;

                        pdf.addImage(
                            images[i],
                            'JPEG',
                            0,
                            currentY,
                            A4_width,
                            scaledHeight
                        );

                        currentY += scaledHeight;
                        this.ui.updateProgress(i + 1);
                        resolve();
                    };
                });
            }
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
                this.ui.selectButton.textContent = '请选择至少一个章节';
                setTimeout(() => {
                    this.ui.selectButton.textContent = '选择章节下载';
                }, 2000);
                return;
            }

            try {
                const chapterLinks = await this.adapter.getChapterLinks();
                const selectedChapterUrls = Array.from(selectedChapters).map(index => chapterLinks[index].url);

                this.ui.setLoading(true, selectedChapterUrls.length);
                this.isLongPageMode = this.ui.isLongPageMode;

                for (let i = 0; i < selectedChapterUrls.length; i++) {
                    const url = selectedChapterUrls[i];
                    try {
                        const sessionId = Date.now().toString();
                        GM_setValue('autoDownload', true);
                        GM_setValue('sessionId', sessionId);
                        GM_setValue('downloadStatus', 'pending');
                        GM_setValue('isLongPageMode', this.isLongPageMode);

                        const tab = GM_openInTab(url, {
                            active: true,
                            insert: true,
                            setParent: true
                        });

                        await new Promise((resolve, reject) => {
                            const maxRetries = 3;
                            let retryCount = 0;
                            let timeout;

                            const checkStatus = () => {
                                const status = GM_getValue('downloadStatus', '');
                                if (status === 'complete') {
                                    clearTimeout(timeout);
                                    GM_setValue('downloadStatus', '');
                                    GM_setValue('autoDownload', false);
                                    resolve();
                                    return true;
                                }
                                return false;
                            };

                            const startCheck = () => {
                                timeout = setTimeout(() => {
                                    if (!checkStatus() && retryCount < maxRetries) {
                                        retryCount++;
                                        tab.activate();
                                        startCheck();
                                    } else if (retryCount >= maxRetries) {
                                        GM_setValue('downloadStatus', '');
                                        reject(new Error('下载超时，已达到最大重试次数'));
                                    }
                                }, 30000);
                            };

                            startCheck();

                            const checkInterval = setInterval(() => {
                                if (checkStatus()) {
                                    clearInterval(checkInterval);
                                }
                            }, 1000);
                        });

                        tab.close();
                        this.ui.updateProgress(i + 1, selectedChapterUrls.length);
                    } catch (error) {
                        console.error(`章节下载失败: ${url}`, error);
                    }
                }

                this.ui.setLoading(false);
                this.ui.selectButton.textContent = '下载完成！';
                setTimeout(() => {
                    this.ui.selectButton.textContent = '选择章节下载';
                }, 3000);
            } catch (error) {
                console.error('批量下载失败:', error);
                this.ui.setLoading(false);
                this.ui.selectButton.textContent = '下载失败，请查看控制台';
                setTimeout(() => {
                    this.ui.selectButton.textContent = '选择章节下载';
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
            console.log('自动下载标志:', autoDownload);

            // 如果是章节页面且需要自动下载
            if (autoDownload && window.comicDownloader.adapter.isChapterPage()) {
                console.log('检测到是从目录页面打开的章节页面，准备自动下载');
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