// ==UserScript==
// @name         网页漫画下载为pdf格式
// @namespace    http://tampermonkey.net/
// @version      1.7.2
// @description  将网页漫画下载为pdf方便阅读，目前仅适用于如漫画(电脑版)[https://m.rumanhua.com/]、(手机版)[https://www.rumanhua.com/]
// @author       MornLight
// @match        https://m.rumanhua.com/*
// @match        https://www.rumanhua.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org
// @grant        GM_xmlhttpRequest
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
            zIndex: '1000',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '15px',
            borderRadius: '5px',
            boxShadow: '0 0 10px rgba(0,0,0,0.1)'
        },
        button: {
            padding: '10px',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50'
        },
        checkbox: {
            marginLeft: '10px',
            cursor: 'pointer'
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
            const chapterPagePattern = /https:\/\/m\.rumanhua\.com\/[^\/]+\/[^\/]+\.html/;
            return chapterPagePattern.test(url);
        }

        isDirectoryPage() {
            const url = window.location.href;
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
            const chapterPagePattern = /https:\/\/www\.rumanhua\.com\/[^\/]+\/[^\/]+\.html/;
            return chapterPagePattern.test(url);
        }

        isDirectoryPage() {
            const url = window.location.href;
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
            this.onCancel = onCancel; // 新增取消回调
            this.currentPage = 0;
            this.createUI();
        }

        createUI() {
            const container = this.createContainer();
            this.downloadButton = this.createButton('下载本章节', () => this.onDownload(1, this.totalPages));
            this.cancelButton = this.createButton('取消下载', () => this.onCancel()); // 新增取消按钮
            this.progressBar = this.createProgressBar();
            this.progressText = this.createElement('span', { marginLeft: '10px' });

            container.appendChild(this.downloadButton);
            container.appendChild(this.cancelButton); // 添加取消按钮
            container.appendChild(this.progressBar);
            container.appendChild(this.progressText);
            document.body.appendChild(container);

            this.cancelButton.style.display = 'none'; // 初始隐藏取消按钮
        }

        createContainer() {
            return this.createElement('div', STYLES.container);
        }

        createButton(text, onClick, isCancel = false) {
            const button = document.createElement('button');
            Object.assign(button.style, isCancel ? STYLES.cancelButton : STYLES.button); // 根据类型应用样式
            button.textContent = text;
            button.addEventListener('click', onClick);
            return button;
        }

        createProgressBar() {
            const progressBar = this.createElement('progress', { width: '100%' });
            progressBar.value = 0;
            progressBar.max = this.totalPages;
            return progressBar;
        }

        createElement(type, styles, textContent = '') {
            const element = document.createElement(type);
            Object.assign(element.style, styles);
            if (textContent) element.textContent = textContent;
            return element;
        }

        setLoading(isLoading, showCancel = false) {
            this.downloadButton.disabled = isLoading;
            this.downloadButton.textContent = isLoading ? '下载中...' : '下载本章节';
            this.cancelButton.style.display = showCancel ? 'inline-block' : 'none'; // 控制取消按钮显示
        }


        updateProgress(currentPage) {
            this.currentPage = currentPage;
            this.progressBar.value = currentPage;
            const percent = ((currentPage / this.totalPages) * 100).toFixed(2);
            this.progressText.textContent = `${currentPage}/${this.totalPages} (${percent}%)`;
        }
    }

    // 4.2 章节选择器UI
    class ChapterSelectorUI {
        constructor(onDownloadSelected) {
            this.onDownloadSelected = onDownloadSelected; // 下载选中章节的回调
            this.selectedChapters = new Set(); // 存储选中的章节
            this.isSelectionMode = false; // 是否处于选择模式
            this.createUI();
        }

        createUI() {
            // 创建容器
            this.container = this.createElement('div', STYLES.container);
            document.body.appendChild(this.container);

            // 创建【选择章节下载】按钮
            this.selectButton = this.createElement('button', STYLES.button, '选择章节下载');
            this.selectButton.addEventListener('click', () => this.toggleSelectionMode());
            this.container.appendChild(this.selectButton);

            // 创建章节列表容器
            this.chapterListContainer = this.createElement('div', { marginTop: '10px', display: 'none' });
            this.container.appendChild(this.chapterListContainer);

            // 初始化章节列表
            this.initChapterList();
        }

        initChapterList() {
            const chapterListElement = document.querySelector('.chapterlistload ul');
            if (!chapterListElement) {
                console.error('未找到章节列表');
                return;
            }

            const chapterElements = chapterListElement.querySelectorAll('a');
            chapterElements.forEach((chapterElement, index) => {
                const chapterItem = this.createElement('div', { display: 'flex', alignItems: 'center', marginBottom: '5px' });

                // 章节名称
                const chapterName = this.createElement('span', { flex: 1 }, chapterElement.textContent.trim());
                chapterItem.appendChild(chapterName);

                // 复选框
                const checkbox = this.createElement('input', { type: 'checkbox', marginLeft: '10px' });
                checkbox.addEventListener('change', () => this.toggleChapterSelection(index));
                chapterItem.appendChild(checkbox);

                this.chapterListContainer.appendChild(chapterItem);
            });
        }

        toggleSelectionMode() {
            this.isSelectionMode = !this.isSelectionMode;
            this.chapterListContainer.style.display = this.isSelectionMode ? 'block' : 'none';
            this.selectButton.textContent = this.isSelectionMode ? '下载选中章节' : '选择章节下载';
        }

        toggleChapterSelection(index) {
            if (this.selectedChapters.has(index)) {
                this.selectedChapters.delete(index);
            } else {
                this.selectedChapters.add(index);
            }

            // 更新按钮文本
            if (this.selectedChapters.size > 0) {
                this.selectButton.textContent = `下载选中章节 (${this.selectedChapters.size})`;
            } else {
                this.selectButton.textContent = '下载选中章节';
            }
        }

        createElement(type, styles, textContent = '') {
            const element = document.createElement(type);
            Object.assign(element.style, styles);
            if (textContent) element.textContent = textContent;
            return element;
        }
    }

    // 5. 下载器类
    class ComicDownloader {
        constructor() {
            this.adapter = getSiteAdapter();

            // 判断当前页面类型
            if (this.adapter.isChapterPage()) {
                // 具体章节页面：初始化下载功能
                this.totalPages = this.adapter.getImageElements().length;
                this.chapterName = this.adapter.getChapterName();
                this.ui = new DownloaderUI(this.totalPages, this.handleDownload.bind(this), this.handleCancel.bind(this));
            } else if (this.adapter.isDirectoryPage()) {
                // 目录页面：初始化章节选择功能
                this.ui = new ChapterSelectorUI(this.handleDownloadSelected.bind(this));
            } else {
                console.log('当前页面不支持下载功能');
            }
        }

        // 处理下载选中章节
        async handleDownloadSelected() {
            const selectedChapters = this.ui.selectedChapters;
            if (selectedChapters.size === 0) {
                alert('请选择至少一个章节');
                return;
            }

            try {
                // 获取章节链接
                const chapterLinks = this.adapter.getChapterLinks();
                const selectedChapterUrls = Array.from(selectedChapters).map(index => chapterLinks[index]);

                // 后台加载章节内容并提取图片数据
                for (const url of selectedChapterUrls) {
                    try {
                        const html = await this.loadChapterHtml(url);
                        const imageUrls = this.extractImageUrlsFromHtml(html);

                        // 复用现有的下载和生成 PDF 代码
                        const images = await this.downloadImages(imageUrls);
                        await this.generatePDF(images);
                    } catch (error) {
                        console.error(`章节加载失败: ${url}`, error);
                        alert(`章节加载失败: ${url}，请查看控制台了解详情`);
                    }
                }

                alert('选中章节下载完成');
            } catch (error) {
                console.error('下载失败:', error);
                alert('下载失败，请查看控制台了解详情');
            }
        }
        // 获取章节链接
        getChapterLinks() {
            const chapterListElement = document.querySelector('.chapterlistload ul');
            if (!chapterListElement) {
                throw new Error('未找到章节列表');
            }

            const chapterElements = chapterListElement.querySelectorAll('a');
            return Array.from(chapterElements).map(element => element.href);
        }
        // 后台加载章节 HTML 内容
        loadChapterHtml(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: response => resolve(response.responseText),
                    onerror: error => reject(error)
                });
            });
        }

        // 从 HTML 中提取图片 URL
        extractImageUrlsFromHtml(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const imageElements = doc.querySelectorAll('div.chapter-img-box img');
            return Array.from(imageElements).map(img => img.src || img.dataset.src);
        }

        // 下载图片并生成 PDF
        async downloadImages(imageUrls) {
            const images = [];
            for (const url of imageUrls) {
                try {
                    const imageData = await this.downloadImage(url);
                    images.push(imageData);
                } catch (error) {
                    console.error(`图片下载失败: ${url}`, error);
                }
            }

            // 生成 PDF
            await this.generatePDF(images);
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
                const abortSignal = this.abortController?.signal; // 绑定中断信号
                if (abortSignal?.aborted) {
                    reject(new DOMException('下载已取消', 'AbortError'));
                    return;
                }

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    signal: abortSignal, // 绑定中断信号
                    onload: response => this.handleImageResponse(response, resolve, reject),
                    onerror: error => reject(error),
                    onabort: () => reject(new DOMException('下载已取消', 'AbortError'))
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
    new ComicDownloader();
})();