// ==UserScript==
// @name         网页漫画下载为pdf格式
// @namespace    http://tampermonkey.net/
// @version      1.7

// @description  将网页漫画下载下来方便导入墨水屏电子书进行阅读，目前仅适用于如漫画(https://m.rumanhua.com/)
// @author       MornLight
// @match        https://m.rumanhua.com/*
// @match        https://www.rumanhua.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org
// @grant        GM_xmlhttpRequest
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
        }
    };

    // 2. 站点适配器相关代码
    class SiteAdapter {
        constructor() {
            if (this.constructor === SiteAdapter) {
                throw new Error('不能直接实例化抽象类');
            }
        }

        getChapterName() { throw new Error('必须实现 getChapterName 方法'); }
        getImageElements() { throw new Error('必须实现 getImageElements 方法'); }
        getImageUrl(imgElement) { throw new Error('必须实现 getImageUrl 方法'); }
    }

    class RumanhuaAdapter extends SiteAdapter {
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
    class DownloaderUI {
        constructor(totalPages, onDownload) {
            this.totalPages = totalPages;
            this.onDownload = onDownload;
            this.currentPage = 0;
            this.createUI();
        }

        createUI() {
            const container = this.createContainer();
            const downloadButton = this.createButton();
            const progressBar = this.createProgressBar();

            container.appendChild(downloadButton);
            container.appendChild(progressBar);
            document.body.appendChild(container);

            this.downloadButton = downloadButton;
            this.progressBar = progressBar;
            this.progressText = document.createElement('span');
            this.progressText.style.marginLeft = '10px';
            container.appendChild(this.progressText);
        }

        createContainer() {
            const container = document.createElement('div');
            Object.assign(container.style, STYLES.container);
            return container;
        }

        createButton() {
            const downloadButton = document.createElement('button');
            Object.assign(downloadButton.style, STYLES.button);
            downloadButton.textContent = '下载本章节';

            downloadButton.addEventListener('click', () => {
                this.onDownload(1, this.totalPages);
            });

            return downloadButton;
        }

        createProgressBar() {
            const progressBar = document.createElement('progress');
            progressBar.value = 0;
            progressBar.max = this.totalPages;
            progressBar.style.width = '100%';
            return progressBar;
        }

        setLoading(isLoading) {
            this.downloadButton.disabled = isLoading;
            this.downloadButton.textContent = isLoading ? '下载中...' : '下载本章节';
        }

        updateProgress(currentPage) {
            this.currentPage = currentPage;
            this.progressBar.value = currentPage;
            this.progressText.textContent = `${currentPage}/${this.totalPages}`;
        }
    }

    // 5. 下载器类
    class ComicDownloader {
        constructor() {
            this.adapter = getSiteAdapter();
            this.totalPages = this.adapter.getImageElements().length;
            this.chapterName = this.adapter.getChapterName();
            this.ui = new DownloaderUI(this.totalPages, this.handleDownload.bind(this));
        }

        async handleDownload() {
            try {
                this.ui.setLoading(true);
                await this.downloadComic();
            } catch (error) {
                console.error('下载失败:', error);
                alert('下载失败，请查看控制台了解详情');
            } finally {
                this.ui.setLoading(false);
            }
        }

        async downloadComic() {
            const images = await this.downloadImages(1, this.totalPages);
            await this.generatePDF(images);
        }

        validatePageRange(start, end) {
            return !(start > end || start < 1 || end > this.totalPages);
        }

        async downloadImages(start, end) {
            const imageElements = this.adapter.getImageElements();
            const downloadResults = new Array(end - start + 1);
            const downloadPromises = [];

            for (let i = 0; i < imageElements.length; i++) {
                const element = imageElements[i];
                const pageNumber = i + 1;

                if (pageNumber >= start && pageNumber <= end) {
                    const imgUrl = this.adapter.getImageUrl(element);

                    if (imgUrl) {
                        const arrayIndex = pageNumber - start;
                        downloadPromises.push(
                            this.downloadImage(imgUrl)
                                .then(imgData => {
                                    downloadResults[arrayIndex] = imgData;
                                    this.ui.updateProgress(pageNumber); // 更新进度
                                })
                                .catch(error => {
                                    console.error(`第 ${pageNumber} 页下载失败:`, error);
                                    downloadResults[arrayIndex] = null;
                                })
                        );
                    }
                }
            }

            await Promise.all(downloadPromises);
            return downloadResults;
        }

        downloadImage(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'blob',
                    onload: response => this.handleImageResponse(response, resolve, reject),
                    onerror: error => reject(error)
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

            // 存储所有图片的尺寸
            const imageSizes = [];

            // 获取所有图片的尺寸
            const getImageSize = (imgData) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.src = imgData;
                    img.onload = () => {
                        resolve({ width: img.width, height: img.height });
                    };
                });
            };

            // 获取所有图片的尺寸
            const sizes = await Promise.all(images.map(getImageSize));

            // 找到最大宽度和高度
            let maxWidth = 0;
            let maxHeight = 0;
            let A4_width = 210;
            sizes.forEach(size => {
                if (size.width > maxWidth) maxWidth = A4_width;
                if (size.height > maxHeight) maxHeight = size.height / size.width * A4_width;
            });

            // 设置 PDF 页面的尺寸为最大尺寸
            const setPageSize = () => {
                pdf.setProperties({
                    orientation: maxWidth > maxHeight ? 'landscape' : 'portrait'
                });
                pdf.internal.pageSize.width = maxWidth;
                pdf.internal.pageSize.height = maxHeight;
            };

            setPageSize(); // 初始设置页面尺寸

            // 添加图片到 PDF 页面
            const addImageToPdf = (imgData, index) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.src = imgData;
                    img.onload = () => {
                        if (index > 0) {
                            pdf.addPage();
                            setPageSize(); // 重新设置页面尺寸
                        }
                        pdf.addImage(imgData, 'JPEG', 0, 0, maxWidth, maxHeight);
                        resolve();
                    };
                });
            };

            // 按顺序添加所有图片
            for (let i = 0; i < images.length; i++) {
                await addImageToPdf(images[i], i);
                this.ui.updateProgress(i + 1); // 更新进度
            }

            // 保存 PDF 文件
            pdf.save(`${this.chapterName}.pdf`);
        }
    }

    // 6. 初始化
    new ComicDownloader();
})();

