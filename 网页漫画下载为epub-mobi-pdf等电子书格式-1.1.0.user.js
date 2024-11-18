// ==UserScript==
// @name         网页漫画下载为epub/mobi/pdf等电子书格式
// @namespace    http://tampermonkey.net/
// @version      1.5.2
// @description  将网页漫画下载下来方便导入墨水屏电子书进行阅读，目前仅适用于如漫画(https://m.rumanhua.com/)
// @author       MornLight
// @match        https://m.rumanhua.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @run-at       document-end
// @license      MIT
// @supportURL   https://github.com/duanmorningsir/ComicDownloader
// ==/UserScript==

(function () {
    'use strict';

    // 样式配置
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
        input: {
            width: '120px',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            textAlign: 'center',
            fontSize: '14px'
        },
        button: {
            padding: '10px',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
        }
    };

    class ComicDownloader {
        constructor() {
            this.totalPages = document.querySelectorAll('div.chapter-img-box').length;
            this.chapterName = this.getChapterName();
            this.ui = new DownloaderUI(this.totalPages, this.handleDownload.bind(this));
        }

        getChapterName() {
            const chapterNameElement = document.querySelector('.chaphead-name h1');
            return chapterNameElement ? chapterNameElement.textContent.trim() : '未知章节';
        }

        async handleDownload(startPage, endPage) {
            try {
                this.ui.setLoading(true);
                await this.downloadComic(startPage, endPage);
                // alert(`漫画《${this.chapterName}》第${startPage}至${endPage}页下载完成！`);
            } catch (error) {
                console.error('下载失败:', error);
                alert('下载失败，请查看控制台了解详情');
            } finally {
                this.ui.setLoading(false);
            }
        }

        async downloadComic(startPage, endPage) {
            const start = startPage || 1;
            const end = endPage || this.totalPages;

            if (!this.validatePageRange(start, end)) {
                throw new Error(`请输入有效的页数范围！(1-${this.totalPages})`);
            }

            const images = await this.downloadImages(start, end);
            await this.generatePDF(images, start, end);
        }

        validatePageRange(start, end) {
            return !(start > end || start < 1 || end > this.totalPages);
        }

        async downloadImages(start, end) {
            const chapterImgBoxes = document.querySelectorAll('div.chapter-img-box');
            const downloadResults = new Array(end - start + 1);
            const downloadPromises = [];

            for (let i = 0; i < chapterImgBoxes.length; i++) {
                const box = chapterImgBoxes[i];
                const pageNumber = i + 1;

                if (pageNumber >= start && pageNumber <= end) {
                    const img = box.querySelector('img');
                    // 获取实际图片URL：优先使用src（已加载的图片），否则使用data-src（未加载的图片）
                    const imgUrl = img?.src?.includes('/static/images/load.gif') ? img?.dataset?.src : img?.src;

                    if (imgUrl) {
                        const arrayIndex = pageNumber - start;
                        downloadPromises.push(
                            this.downloadImage(imgUrl)
                                .then(imgData => {
                                    downloadResults[arrayIndex] = imgData;
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

        async generatePDF(images, start, end) {
            const pdf = new jspdf.jsPDF();

            images.forEach((imgData, index) => {
                // 先创建新页面，再添加图片
                if (imgData) {  // 添加空值检查
                    if (index > 0) {  // 除了第一页，其他页面都需要先创建新页面
                        pdf.addPage();
                    }
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
                }
            });

            const fileName = end === this.totalPages && start === 1
                ? `${this.chapterName}_全部.pdf`
                : `${this.chapterName}_${start}-${end}.pdf`;
            pdf.save(fileName);
        }
    }

    class DownloaderUI {
        constructor(totalPages, onDownload) {
            this.totalPages = totalPages;
            this.onDownload = onDownload;
            this.createUI();
        }

        createUI() {
            const container = this.createContainer();
            const { startInput, endInput } = this.createInputs();
            const { downloadButton, downloadAllButton } = this.createButtons(startInput, endInput);

            container.append(startInput, endInput, downloadButton, downloadAllButton);
            document.body.appendChild(container);

            this.downloadButton = downloadButton;
            this.downloadAllButton = downloadAllButton;
        }

        createContainer() {
            const container = document.createElement('div');
            Object.assign(container.style, STYLES.container);
            return container;
        }

        createInputs() {
            const startInput = document.createElement('input');
            const endInput = document.createElement('input');

            Object.assign(startInput.style, STYLES.input);
            Object.assign(endInput.style, STYLES.input);

            startInput.type = 'number';
            endInput.type = 'number';
            startInput.placeholder = `起始页(1-${this.totalPages})`;
            endInput.placeholder = `结束页(1-${this.totalPages})`;
            startInput.min = 1;
            endInput.min = 1;
            startInput.max = this.totalPages;
            endInput.max = this.totalPages;

            // 添加标题提示
            startInput.title = `请输入1-${this.totalPages}之间的数字`;
            endInput.title = `请输入1-${this.totalPages}之间的数字`;

            // 添加输入验证
            const validateInput = (input) => {
                const value = parseInt(input.value);
                if (value < 1) input.value = 1;
                if (value > this.totalPages) input.value = this.totalPages;
            };

            startInput.addEventListener('change', () => validateInput(startInput));
            endInput.addEventListener('change', () => validateInput(endInput));

            return { startInput, endInput };
        }

        createButtons(startInput, endInput) {
            const downloadButton = document.createElement('button');
            const downloadAllButton = document.createElement('button');

            Object.assign(downloadButton.style, STYLES.button);
            Object.assign(downloadAllButton.style, STYLES.button);

            downloadButton.style.backgroundColor = '#4CAF50';
            downloadAllButton.style.backgroundColor = '#2196F3';

            downloadButton.textContent = '下载指定范围漫画';
            downloadAllButton.textContent = '下载整个章节';

            downloadButton.addEventListener('click', () => {
                const start = parseInt(startInput.value) || 1;
                const end = parseInt(endInput.value) || this.totalPages;
                this.onDownload(start, end);
            });

            downloadAllButton.addEventListener('click', () => {
                this.onDownload(1, this.totalPages);
            });

            return { downloadButton, downloadAllButton };
        }

        setLoading(isLoading) {
            this.downloadButton.disabled = isLoading;
            this.downloadAllButton.disabled = isLoading;
            this.downloadButton.textContent = isLoading ? '下载中...' : '下载指定范围漫画';
            this.downloadAllButton.textContent = isLoading ? '下载中...' : '下载整个章节';
        }
    }

    // 初始化下载器
    new ComicDownloader();
})();

