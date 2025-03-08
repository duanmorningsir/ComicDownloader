// ==UserScript==
// @name         网页漫画下载为pdf格式
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  将网页漫画下载为pdf方便阅读，目前仅适用于如漫画(电脑版)[https://m.rumanhua.com/]、(手机版)[https://www.rumanhua.com/]
// @author       MornLight
// @match        https://m.rumanhua.com/*
// @match        https://www.rumanhua.com/*
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
            zIndex: '9999', // 提高 z-index 确保在最上层
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)', // 增加不透明度
            padding: '15px',
            borderRadius: '5px',
            boxShadow: '0 0 10px rgba(0,0,0,0.2)', // 增强阴影
            maxHeight: '80vh',
            overflowY: 'auto',
            minWidth: '250px' // 确保最小宽度
        },
        button: {
            padding: '10px',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            transition: 'background-color 0.3s'
        },
        cancelButton: {
            backgroundColor: '#f44336',
            display: 'none'
        },
        progressContainer: {
            display: 'none'
        },
        infoText: {
            color: '#666',
            fontSize: '14px',
            textAlign: 'center',
            marginBottom: '8px'
        }
    };

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
            // 恢复原来的匹配模式
            const chapterPagePattern = /https:\/\/m\.rumanhua\.com\/[^\/]+\/[^\/]+\.html/;
            return chapterPagePattern.test(url);
        }

        isDirectoryPage() {
            const url = window.location.href;
            // 恢复原来的匹配模式
            const directoryPagePattern = /https:\/\/m\.rumanhua\.com\/[^\/]+\/?$/;
            return directoryPagePattern.test(url);
        }
        getChapterLinks() {
            const chapterListElement = document.querySelector('.chapterlistload ul');
            if (!chapterListElement) {
                throw new Error('未找到章节列表');
            }

            const chapterElements = chapterListElement.querySelectorAll('a');
            return Array.from(chapterElements).map(element => element.href);
        }
        getChapterName() {
            const chapterNameElement = document.querySelector('.chaphead-name h1');
            return chapterNameElement ? chapterNameElement.textContent.trim() : '未知章节';
        }

        getImageElements() {
            return document.querySelectorAll('div.chapter-img-box');
        }

        getImageUrl(imgElement) {
            const img = imgElement.querySelector('img');
            return img?.src?.includes('/static/images/load.gif') ? img?.dataset?.src : img?.src;
        }
    }

    class RumanhuaPCAdapter extends SiteAdapter {
        isChapterPage() {
            const url = window.location.href;
            // 恢复原来的匹配模式
            const chapterPagePattern = /https:\/\/www\.rumanhua\.com\/[^\/]+\/[^\/]+\.html/;
            return chapterPagePattern.test(url);
        }

        isDirectoryPage() {
            const url = window.location.href;
            // 恢复原来的匹配模式
            const directoryPagePattern = /https:\/\/www\.rumanhua\.com\/[^\/]+\/?$/;
            return directoryPagePattern.test(url);
        }
        getChapterLinks() {
            const chapterListElement = document.querySelector('.chapterlistload ul');
            if (!chapterListElement) {
                throw new Error('未找到章节列表');
            }

            const chapterElements = chapterListElement.querySelectorAll('a');
            return Array.from(chapterElements).map(element => element.href);
        }

        getChapterName() {
            const chapterName = document.querySelector('.headwrap .chaptername_title')?.textContent || '未知章节';
            return chapterName;
        }

        getImageElements() {
            return document.querySelectorAll('div.chapter-img-box');
        }

        getImageUrl(imgElement) {
            const img = imgElement.querySelector('img');
            return img?.src?.includes('/static/images/load.gif') ? img?.dataset?.src : img?.src;
        }
    }

    // 3. 获取适配器的工厂函数
    function getSiteAdapter() {
        const url = window.location.href;

        switch (true) {
            case url.includes('https://www.rumanhua.com/'):
                return new RumanhuaPCAdapter();
            case url.includes('https://m.rumanhua.com/'):
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

        // 添加 createElement 方法
        createElement(type, styles, textContent = '') {
            const element = document.createElement(type);
            if (type === 'input' && styles.type) {
                element.type = styles.type;
                delete styles.type;
            }
            if (typeof styles === 'string') {
                element.className = styles;
            } else {
                Object.assign(element.style, styles);
            }
            if (textContent) element.textContent = textContent;
            return element;
        }

        createUI() {
            const container = this.createContainer();
            
            // 添加页数信息
            this.infoText = this.createElement('div', STYLES.infoText, `本章节共 ${this.totalPages} 页`);
            container.appendChild(this.infoText);

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
            this.progressText = this.createElement('span', { marginLeft: '10px' });
            this.progressContainer.appendChild(this.progressBar);
            this.progressContainer.appendChild(this.progressText);

            container.appendChild(this.downloadButton);
            container.appendChild(this.cancelButton);
            container.appendChild(this.progressContainer);
            document.body.appendChild(container);
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
    }

    // 4.2 章节选择器UI
        class ChapterSelectorUI {
            constructor(onDownloadSelected) {
                this.onDownloadSelected = onDownloadSelected;
                this.selectedChapters = new Set();
                this.isSelectionMode = false;
                this.createUI();
                // 移除这行，不在构造函数中初始化章节列表
                // this.initChapterList(); 
            }
            
            // 添加 createElement 方法
            createElement(type, styles, textContent = '') {
                const element = document.createElement(type);
                if (type === 'input' && styles.type) {
                    element.type = styles.type;
                    delete styles.type;
                }
                if (typeof styles === 'string') {
                    element.className = styles;
                } else {
                    Object.assign(element.style, styles);
                }
                if (textContent) element.textContent = textContent;
                return element;
            }
            
            createUI() {
                // 创建容器
                this.container = this.createElement('div', STYLES.container);
                document.body.appendChild(this.container);
        
                // 创建【选择章节下载】按钮 - 修改样式确保可见
                this.selectButton = this.createElement('button', {
                    padding: '10px',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: '#4CAF50',
                    transition: 'background-color 0.3s',
                    position: 'sticky',
                    top: '0',
                    zIndex: '10',
                    width: '100%',
                    marginBottom: '10px',
                    fontWeight: 'bold'
                }, '选择章节下载');
                this.selectButton.addEventListener('click', () => this.toggleSelectionMode());
                this.container.appendChild(this.selectButton);
                
                // 添加取消按钮 - 初始状态为隐藏
                this.cancelSelectionButton = this.createElement('button', {
                    padding: '8px',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    backgroundColor: '#f44336',
                    transition: 'background-color 0.3s',
                    position: 'sticky',
                    top: '40px',
                    zIndex: '10',
                    width: '100%',
                    marginBottom: '10px',
                    display: 'none'
                }, '返回');  // 修改文本为"返回"
                this.cancelSelectionButton.addEventListener('click', () => this.cancelSelectionMode());
                this.container.appendChild(this.cancelSelectionButton);
        
                // 创建章节列表容器 - 添加滚动条
                this.chapterListContainer = this.createElement('div', { 
                    marginTop: '10px', 
                    display: 'none',
                    maxHeight: '50vh',
                    overflowY: 'auto',
                    paddingRight: '5px'
                });
                this.container.appendChild(this.chapterListContainer);
        
                // 添加进度显示区域 - 固定在底部
                this.progressContainer = this.createElement('div', { 
                    marginTop: '10px',
                    display: 'none',
                    position: 'sticky',
                    bottom: '0',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '5px 0',
                    zIndex: '2'
                });
                
                this.progressText = this.createElement('div', {
                    marginBottom: '5px',
                    fontSize: '14px',
                    color: '#666'
                });
                
                this.progressBar = document.createElement('progress');
                this.progressBar.style.width = '100%';
                
                this.progressContainer.appendChild(this.progressText);
                this.progressContainer.appendChild(this.progressBar);
                this.container.appendChild(this.progressContainer);
            }
            
            initChapterList() {
                // 清空现有章节列表
                this.chapterListContainer.innerHTML = '';
                this.selectedChapters.clear();
                
                const chapterListElement = document.querySelector('.chapterlistload ul');
                if (!chapterListElement) {
                    console.error('未找到章节列表');
                    return;
                }
        
                const chapterElements = chapterListElement.querySelectorAll('a');
                console.log(`找到 ${chapterElements.length} 个章节`);
                
                // 添加简单的控制区
                const controlsContainer = this.createElement('div', { 
                    display: 'flex', 
                    justifyContent: 'space-between',  // 修改为两端对齐
                    marginBottom: '10px',
                    position: 'sticky',
                    top: '0',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '5px 0',
                    zIndex: '1'
                });
                
                // 添加章节数量显示
                const chapterCountLabel = this.createElement('span', {
                    fontSize: '12px',
                    color: '#666',
                    alignSelf: 'center'
                }, `共 ${chapterElements.length} 章`);
                
                // 创建按钮容器，用于放置多个按钮
                const buttonsContainer = this.createElement('div', {
                    display: 'flex',
                    gap: '5px'
                });
                
                // 添加刷新按钮
                const refreshBtn = this.createElement('button', {
                    padding: '3px 8px',
                    fontSize: '12px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                }, '刷新列表');
                
                refreshBtn.addEventListener('click', () => this.refreshChapterList());
                
                // 修改为"清除选择"按钮
                const deselectAllBtn = this.createElement('button', {
                    padding: '3px 8px',
                    fontSize: '12px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                }, '清除选择');
                
                deselectAllBtn.addEventListener('click', () => this.deselectAll());
                
                // 将按钮添加到按钮容器
                buttonsContainer.appendChild(refreshBtn);
                buttonsContainer.appendChild(deselectAllBtn);
                
                // 将章节数量和按钮容器添加到控制区
                controlsContainer.appendChild(chapterCountLabel);
                controlsContainer.appendChild(buttonsContainer);
                this.chapterListContainer.appendChild(controlsContainer);
                
                // 添加章节列表
                chapterElements.forEach((chapterElement, index) => {
                    const chapterItem = this.createElement('div', { display: 'flex', alignItems: 'center', marginBottom: '5px' });
        
                    // 章节名称
                    const chapterName = this.createElement('span', { flex: 1 }, chapterElement.textContent.trim());
                    chapterItem.appendChild(chapterName);
        
                    // 复选框
                    const checkbox = this.createElement('input', { type: 'checkbox', marginLeft: '10px' });
                    checkbox.addEventListener('change', () => this.toggleChapterSelection(index, checkbox));
                    chapterItem.appendChild(checkbox);
        
                    this.chapterListContainer.appendChild(chapterItem);
                });
            }
            
            // 添加取消选择模式的方法
            cancelSelectionMode() {
                this.isSelectionMode = false;
                this.chapterListContainer.style.display = 'none';
                this.cancelSelectionButton.style.display = 'none';
                this.selectButton.textContent = '选择章节下载';
                this.selectedChapters.clear();
            }
            
            // 保留取消全选方法
            deselectAll() {
                const checkboxes = this.chapterListContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
                this.selectedChapters.clear();
                this.selectButton.textContent = '选择章节下载';
            }
            
            // 移除 selectAll、selectPrevious5Chapters、selectNext5Chapters 方法
            selectAll(count) {
                const checkboxes = this.chapterListContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach((checkbox, index) => {
                    // 跳过第一行的控制按钮
                    if (index > 0) {
                        checkbox.checked = true;
                        this.selectedChapters.add(index - 1); // 减1是因为索引从0开始
                    }
                });
                this.selectButton.textContent = `下载选中章节 (${count})`;
            }
            
            // 添加取消全选方法
            // 添加取消全选方法
            deselectAll() {
                const checkboxes = this.chapterListContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
                this.selectedChapters.clear();
                this.selectButton.textContent = '下载选中章节';
            }
            
            // 添加刷新章节列表的方法
            refreshChapterList() {
                console.log('刷新章节列表');
                // 保存当前选中的章节
                const selectedChapters = new Set(this.selectedChapters);
                
                // 重新初始化章节列表
                this.initChapterList();
                
                // 尝试恢复之前选中的章节（如果它们仍然存在）
                const checkboxes = this.chapterListContainer.querySelectorAll('input[type="checkbox"]');
                const maxIndex = checkboxes.length - 1;
                
                selectedChapters.forEach(index => {
                    if (index <= maxIndex) {
                        // 跳过控制区域，所以索引需要+1
                        const checkbox = checkboxes[index + 1];
                        if (checkbox) {
                            checkbox.checked = true;
                            this.selectedChapters.add(index);
                        }
                    }
                });
                
                // 更新按钮文本
                if (this.selectedChapters.size > 0) {
                    this.selectButton.textContent = `下载选中章节 (${this.selectedChapters.size})`;
                } else {
                    this.selectButton.textContent = '下载选中章节';
                }
                
                // 显示刷新成功提示
                const chapterCountLabel = this.chapterListContainer.querySelector('span');
                const originalText = chapterCountLabel.textContent;
                chapterCountLabel.textContent = '刷新成功！';
                setTimeout(() => {
                    chapterCountLabel.textContent = originalText;
                }, 1500);
            }
            
            // 修改切换选择方法，添加checkbox参数
            toggleChapterSelection(index, checkbox) {
                if (this.selectedChapters.has(index)) {
                    this.selectedChapters.delete(index);
                    if (checkbox) checkbox.checked = false;
                } else {
                    this.selectedChapters.add(index);
                    if (checkbox) checkbox.checked = true;
                }
        
                // 更新按钮文本
                if (this.selectedChapters.size > 0) {
                    this.selectButton.textContent = `下载选中章节 (${this.selectedChapters.size})`;
                } else {
                    this.selectButton.textContent = '下载选中章节';
                }
            }
            
            // 添加 toggleSelectionMode 方法
            toggleSelectionMode() {
                console.log('切换选择模式，当前状态:', this.isSelectionMode);
                this.isSelectionMode = !this.isSelectionMode;
                
                if (this.isSelectionMode) {
                    // 每次进入选择模式时重新获取章节列表
                    console.log('进入选择模式，初始化章节列表');
                    this.initChapterList();
                    this.chapterListContainer.style.display = 'block';
                    this.cancelSelectionButton.style.display = 'block'; // 显示取消按钮
                    this.selectButton.textContent = '下载选中章节';
                } else if (this.selectedChapters.size > 0) {
                    // 当退出选择模式且有选中的章节时，触发下载
                    console.log('退出选择模式，开始下载选中章节');
                    this.chapterListContainer.style.display = 'none';
                    this.cancelSelectionButton.style.display = 'none'; // 隐藏取消按钮
                    this.onDownloadSelected();
                } else {
                    // 没有选中章节时只隐藏列表
                    console.log('退出选择模式，无选中章节');
                    this.chapterListContainer.style.display = 'none';
                    this.cancelSelectionButton.style.display = 'none'; // 隐藏取消按钮
                    this.selectButton.textContent = '选择章节下载';
                }
            }
        
            // 添加 setLoading 方法
            setLoading(isLoading, totalChapters = 0) {
                this.selectButton.disabled = isLoading;
                this.selectButton.style.backgroundColor = isLoading ? '#999' : '#4CAF50';
                this.selectButton.style.cursor = isLoading ? 'not-allowed' : 'pointer';
                
                if (isLoading) {
                    this.selectButton.textContent = '下载中...';
                    this.chapterListContainer.style.display = 'none';
                    this.progressContainer.style.display = 'block';
                    
                    // 设置进度条最大值
                    this.progressBar.max = totalChapters;
                    this.progressBar.value = 0;
                    this.progressText.textContent = `准备下载 ${totalChapters} 个章节...`;
                } else {
                    this.selectButton.textContent = '选择章节下载';
                    this.progressContainer.style.display = 'none';
                }
            }
            
            // 添加更新进度的方法
            updateProgress(current, total) {
                if (this.progressBar) {
                    this.progressBar.value = current;
                    const percent = ((current / total) * 100).toFixed(2);
                    this.progressText.textContent = `下载进度: ${current}/${total} (${percent}%)`;
                }
            }
            
            // ... 其他方法保持不变 ...
        }

    // 5. 下载器类
    class ComicDownloader {
        constructor() {
            this.adapter = getSiteAdapter();
            console.log('当前页面URL:', window.location.href); // 添加调试信息

            // 判断当前页面类型
            if (this.adapter.isChapterPage()) {
                console.log('检测到章节页面'); // 添加调试信息
                const imageElements = this.adapter.getImageElements();
                console.log('找到图片元素数量:', imageElements.length); // 添加调试信息
                
                // 具体章节页面：初始化下载功能
                this.totalPages = imageElements.length;
                this.chapterName = this.adapter.getChapterName();
                console.log('章节名称:', this.chapterName); // 添加调试信息
                
                if (this.totalPages > 0) {
                    this.ui = new DownloaderUI(this.totalPages, this.handleDownload.bind(this), this.handleCancel.bind(this));
                } else {
                    console.error('未找到图片元素');
                }
            } else if (this.adapter.isDirectoryPage()) {
                console.log('检测到目录页面'); // 添加调试信息
                this.ui = new ChapterSelectorUI(this.handleDownloadSelected.bind(this));
            } else {
                console.log('当前页面不支持下载功能');
            }
        }

        // 处理下载选中章节
        // 在 ComicDownloader 类中添加新方法
        async loadChapterHtml(url) {
            return new Promise((resolve, reject) => {
                const tab = GM_openInTab(url, { active: false, insert: true });
                
                // 创建一个消息监听器
                const messageHandler = function(event) {
                    if (event.data.type === 'chapterData' && event.data.url === url) {
                        window.removeEventListener('message', messageHandler);
                        tab.close();
                        resolve(event.data.html);
                    }
                };
                
                window.addEventListener('message', messageHandler);
                
                // 5秒后超时
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    tab.close();
                    reject(new Error('加载章节超时'));
                }, 5000);
            });
        }

        async handleDownloadSelected() {
            const selectedChapters = this.ui.selectedChapters;
            if (selectedChapters.size === 0) {
                this.ui.selectButton.textContent = '请选择至少一个章节';
                setTimeout(() => {
                    this.ui.selectButton.textContent = '选择章节下载';
                }, 2000);
                return;
            }

            try {
                const chapterLinks = this.adapter.getChapterLinks();
                const selectedChapterUrls = Array.from(selectedChapters).map(index => chapterLinks[index]);
                
                this.ui.setLoading(true, selectedChapterUrls.length);
                
                for (let i = 0; i < selectedChapterUrls.length; i++) {
                    const url = selectedChapterUrls[i];
                    try {
                        console.log(`开始下载章节 ${i+1}/${selectedChapterUrls.length}: ${url}`);
                        
                        const sessionId = Date.now().toString();
                        GM_setValue('autoDownload', true);
                        GM_setValue('sessionId', sessionId);
                        GM_setValue('downloadStatus', 'pending');
                        
                        // 修改：使用 active: true 打开标签页
                        const tab = GM_openInTab(url, { 
                            active: true,  // 修改为 true，确保标签页处于活动状态
                            insert: true,
                            setParent: true
                        });

                        // 等待下载完成，增加重试机制
                        await new Promise((resolve, reject) => {
                            const maxRetries = 3;  // 最大重试次数
                            let retryCount = 0;
                            let timeout;
                            
                            const checkStatus = () => {
                                const status = GM_getValue('downloadStatus', '');
                                console.log(`检查下载状态: ${status}, 重试次数: ${retryCount}`);
                                
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
                                        console.log(`下载超时，尝试重试 ${retryCount + 1}/${maxRetries}`);
                                        retryCount++;
                                        // 重新激活标签页
                                        tab.activate();
                                        startCheck();
                                    } else if (retryCount >= maxRetries) {
                                        GM_setValue('downloadStatus', '');
                                        reject(new Error('下载超时，已达到最大重试次数'));
                                    }
                                }, 30000); // 30秒超时
                            };

                            // 开始检查
                            startCheck();
                            
                            // 定期检查状态
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

        // 从文档中提取图片URL
        extractImageUrlsFromDoc(doc) {
            const imageElements = doc.querySelectorAll('div.chapter-img-box img');
            return Array.from(imageElements).map(img => img.src || img.dataset.src);
        }

        // 下载单个章节的所有图片
        async downloadChapterImages(imageUrls) {
            const images = [];
            for (const url of imageUrls) {
                try {
                    const imageData = await this.downloadImage(url);
                    images.push(imageData);
                } catch (error) {
                    console.error(`图片下载失败: ${url}`, error);
                }
            }
            return images;
        }
        async handleDownload() {
            if (this.isDownloading) {
                alert('当前正在下载，请稍后再试');
                return;
            }

            try {
                this.isDownloading = true;
                this.abortController = new AbortController(); // 初始化 AbortController
                this.ui.setLoading(true, true); // 显示取消按钮
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
                this.abortController = null; // 清理 AbortController
                this.ui.setLoading(false, false); // 隐藏取消按钮
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

            for (let i = 0; i < images.length; i++) {
                await this.addImageToPdf(pdf, images[i], i, sizes[i]);
                this.ui.updateProgress(i + 1);
            }

            pdf.save(`${this.chapterName}.pdf`);
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
                
                // 延迟一段时间后自动开始下载
                setTimeout(async () => {
                    try {
                        console.log('开始自动下载...');
                        await window.comicDownloader.handleDownload();
                        console.log('自动下载完成，设置状态为 complete');
                        
                        // 设置下载完成状态
                        GM_setValue('downloadStatus', 'complete');
                    } catch (error) {
                        console.error('自动下载失败:', error);
                        // 即使失败也设置完成状态，避免父窗口一直等待
                        GM_setValue('downloadStatus', 'complete');
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    // 确保在页面完全加载后再初始化
    if (document.readyState === 'complete') {
        initialize();
    } else {
        window.addEventListener('load', initialize);
    }
})();