// ==UserScript==
// @name         网页漫画下载为pdf格式 [dev]
// @namespace    http://tampermonkey.net/
// @version      3.2.1-dev
// @description  将网页漫画下载为pdf方便阅读，目前仅适用于如漫画(http://www.rumanhua1.com/)、漫蛙库(https://manwaku.cc/)等漫画网站
// @author       MornLight
// @match        http://m.rumanhua1.com/*
// @match        http://m.rumanhua2.com/*
// @match        http://www.rumanhua1.com/*
// @match        http://www.rumanhua2.com/*
// @match        https://www.rumanhua.org/*
// @match        https://m.rumanhua.org/*
// @match        https://mangapark.net/*
// @match        https://www.mwdd.cc/*
// @match        https://www.mwhh.cc/*
// @match        https://www.mhtmh.org/*
// @match        https://www.mwai.cc/*
// @match        https://www.mwku.cc/*
// @match        https://www.mwrr.cc/*
// @match        https://www.manwaku.com/*
// @match        https://www.mwbu.cc/*
// @match        https://www.mwdu.cc/*
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

window.__COMIC_DOWNLOADER_BUILD__ = {"target":"dev","isDev":true,"version":"3.2.1-dev"};
(() => {
  // src/build-constants.js
  var BUILD_INFO = {
    target: true ? "dev" : "prod",
    version: true ? "3.2.1-dev" : "0.0.0",
    isDev: true ? true : false
  };

  // src/logger.js
  function write(method, args) {
    if (typeof console?.[method] === "function") {
      console[method]("[ComicDownloader]", ...args);
    }
  }
  var logger = {
    debug(...args) {
      if (BUILD_INFO.isDev) {
        write("log", args);
      }
    },
    info(...args) {
      write("log", args);
    },
    warn(...args) {
      write("warn", args);
    },
    error(...args) {
      write("error", args);
    }
  };

  // src/state.js
  var STORAGE_KEY = "comicDownloaderRuntimeState";
  var DOWNLOAD_PHASE = Object.freeze({
    IDLE: "idle",
    PENDING: "pending",
    DOWNLOADING: "downloading",
    DOWNLOADED: "downloaded",
    PDF_GENERATING: "pdf_generating",
    SAVED: "saved",
    FAILED: "failed",
    CANCELLED: "cancelled"
  });
  function createDefaultState() {
    return {
      version: 1,
      batch: {
        enabled: false,
        autoDownload: false,
        cancelRequested: false,
        sessionId: "",
        pdfMode: "longpage"
      },
      session: {
        sessionId: "",
        phase: DOWNLOAD_PHASE.IDLE,
        chapterName: "",
        chapterIndex: 0,
        chapterCount: 0,
        currentImage: 0,
        totalImages: 0,
        currentPDFPage: 0,
        totalPDFPages: 0,
        errorMessage: "",
        updatedAt: 0
      }
    };
  }
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  function mergeState(base, incoming) {
    return {
      ...base,
      ...incoming,
      batch: {
        ...base.batch,
        ...incoming?.batch || {}
      },
      session: {
        ...base.session,
        ...incoming?.session || {}
      }
    };
  }
  function readRuntimeState() {
    const defaults = createDefaultState();
    const stored = GM_getValue(STORAGE_KEY, null);
    if (!stored || typeof stored !== "object") {
      return defaults;
    }
    return mergeState(defaults, stored);
  }
  function ensureRuntimeState() {
    const stored = GM_getValue(STORAGE_KEY, null);
    if (!stored || typeof stored !== "object") {
      const defaults = createDefaultState();
      GM_setValue(STORAGE_KEY, defaults);
      return defaults;
    }
    const next = mergeState(createDefaultState(), stored);
    GM_setValue(STORAGE_KEY, next);
    return next;
  }
  function writeRuntimeState(updater) {
    const current = readRuntimeState();
    const next = typeof updater === "function" ? updater(clone(current)) : mergeState(current, updater);
    GM_setValue(STORAGE_KEY, next);
    return next;
  }
  function updateBatchState(patch) {
    return writeRuntimeState((state) => {
      state.batch = {
        ...state.batch,
        ...patch
      };
      state.session.updatedAt = Date.now();
      return state;
    });
  }
  function updateSessionState(patch) {
    return writeRuntimeState((state) => {
      state.session = {
        ...state.session,
        ...patch,
        updatedAt: Date.now()
      };
      return state;
    });
  }
  function setSessionPhase(phase, patch = {}) {
    return updateSessionState({
      ...patch,
      phase
    });
  }
  function resetSessionState(extraSession = {}) {
    return writeRuntimeState((state) => {
      const defaults = createDefaultState();
      state.session = {
        ...defaults.session,
        ...extraSession,
        updatedAt: Date.now()
      };
      return state;
    });
  }
  function getBatchState() {
    return readRuntimeState().batch;
  }
  function getSessionState() {
    return readRuntimeState().session;
  }
  function createDebugSnapshot() {
    const state = readRuntimeState();
    return Object.freeze({
      batch: { ...state.batch },
      session: { ...state.session }
    });
  }

  // src/index.js
  (function() {
    "use strict";
    const RUNTIME_KEY_MAP = {
      cancelBatchDownload: {
        get: () => getBatchState().cancelRequested,
        set: (value) => updateBatchState({ cancelRequested: !!value })
      },
      currentChapterName: {
        get: () => getSessionState().chapterName,
        set: (value) => updateSessionState({ chapterName: value || "" })
      },
      currentImage: {
        get: () => getSessionState().currentImage,
        set: (value) => updateSessionState({ currentImage: Number(value) || 0 })
      },
      totalImages: {
        get: () => getSessionState().totalImages,
        set: (value) => updateSessionState({ totalImages: Number(value) || 0 })
      },
      currentPDFPage: {
        get: () => getSessionState().currentPDFPage,
        set: (value) => updateSessionState({ currentPDFPage: Number(value) || 0 })
      },
      totalPDFPages: {
        get: () => getSessionState().totalPDFPages,
        set: (value) => updateSessionState({ totalPDFPages: Number(value) || 0 })
      },
      sessionId: {
        get: () => getBatchState().sessionId,
        set: (value) => {
          const nextValue = value || "";
          updateBatchState({ sessionId: nextValue });
          updateSessionState({ sessionId: nextValue });
        }
      },
      autoDownload: {
        get: () => getBatchState().autoDownload,
        set: (value) => updateBatchState({ autoDownload: !!value })
      },
      isBatchDownload: {
        get: () => getBatchState().enabled,
        set: (value) => updateBatchState({ enabled: !!value })
      },
      pdfMode: {
        get: () => getBatchState().pdfMode,
        set: (value) => updateBatchState({ pdfMode: value || "longpage" })
      },
      downloadStatus: {
        get: () => getSessionState().phase,
        set: (value) => {
          const legacyPhaseMap = {
            pending: DOWNLOAD_PHASE.PENDING,
            downloading: DOWNLOAD_PHASE.DOWNLOADING,
            complete: DOWNLOAD_PHASE.DOWNLOADED,
            failed: DOWNLOAD_PHASE.FAILED,
            cancelled: DOWNLOAD_PHASE.CANCELLED
          };
          const phase = Object.values(DOWNLOAD_PHASE).includes(value) ? value : legacyPhaseMap[value] || DOWNLOAD_PHASE.IDLE;
          setSessionPhase(phase);
        }
      },
      pdfGenerationComplete: {
        get: () => getSessionState().phase === DOWNLOAD_PHASE.SAVED,
        set: (value) => {
          if (value) {
            setSessionPhase(DOWNLOAD_PHASE.SAVED);
          }
        }
      },
      lastImageCount: {
        get: () => getSessionState().currentImage,
        set: () => {
          return;
        }
      }
    };
    const nativeGMGetValue = globalThis.GM_getValue.bind(globalThis);
    const nativeGMSetValue = globalThis.GM_setValue.bind(globalThis);
    function gmGetValue(key, defaultValue) {
      const mapping = RUNTIME_KEY_MAP[key];
      if (mapping) {
        const value = mapping.get();
        return value === void 0 ? defaultValue : value;
      }
      return nativeGMGetValue(key, defaultValue);
    }
    function gmSetValue(key, value) {
      const mapping = RUNTIME_KEY_MAP[key];
      if (mapping) {
        mapping.set(value);
        return value;
      }
      return nativeGMSetValue(key, value);
    }
    ensureRuntimeState();
    function exposeDebugState() {
      if (!BUILD_INFO.isDev) {
        return;
      }
      Object.defineProperty(window, "__comicDownloaderDebug", {
        configurable: true,
        enumerable: false,
        get() {
          const snapshot = createDebugSnapshot();
          return Object.freeze({
            build: BUILD_INFO,
            runtime: snapshot,
            getAdapterName: () => window.comicDownloader?.adapter?.constructor?.name || null,
            getUiMode: () => ({
              pdfMode: window.comicDownloader?.ui?.pdfMode || null,
              isDownloading: !!window.comicDownloader?.isDownloading
            })
          });
        }
      });
    }
    exposeDebugState();
    function disableImageLoading() {
      console.log("🚫 批量下载模式：禁用图片实际加载");
      if (!document.getElementById("batch-download-no-images")) {
        const style = document.createElement("style");
        style.id = "batch-download-no-images";
        style.textContent = `
            img { 
                content: url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") !important;
            }
        `;
        document.head.appendChild(style);
      }
    }
    function enableImageLoading() {
      console.log("✓ 恢复图片加载");
      const style = document.getElementById("batch-download-no-images");
      if (style) {
        style.remove();
      }
    }
    const STYLES = {
      container: {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: "9999",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        backgroundColor: "#f8fafc",
        padding: "20px",
        borderRadius: "18px",
        boxShadow: "0 4px 24px 0 rgba(60,60,100,0.13)",
        maxHeight: "80vh",
        overflowY: "auto",
        minWidth: "260px",
        border: "1px solid #e0e6ef",
        boxSizing: "border-box",
        "@media (max-width: 768px)": {
          bottom: "8px",
          right: "8px",
          left: "8px",
          minWidth: "auto",
          width: "calc(100% - 16px)",
          padding: "8px",
          gap: "6px",
          borderRadius: "10px"
        },
        backdropFilter: "blur(10px)",
        transition: "all 0.3s ease"
      },
      button: {
        padding: "8px 0",
        color: "#fff",
        border: "none",
        // 确保没有黑框
        borderRadius: "12px",
        cursor: "pointer",
        backgroundColor: "#4CAF50",
        boxShadow: "0 1px 4px 0 rgba(76,175,80,0.08)",
        fontWeight: "bold",
        fontSize: "15px",
        letterSpacing: "0.5px",
        margin: "4px 0",
        outline: "none",
        width: "100%",
        minHeight: "36px",
        background: "linear-gradient(45deg, #4CAF50, #45a049)",
        transition: "all 0.3s ease",
        ":hover": {
          background: "linear-gradient(45deg, #45a049, #4CAF50)",
          transform: "translateY(-2px)",
          boxShadow: "0 4px 15px rgba(76,175,80,0.3)"
        },
        "@media (max-width: 768px)": {
          padding: "6px 0",
          // 统一padding
          fontSize: "13px",
          borderRadius: "8px",
          margin: "3px 0",
          // 统一margin
          minHeight: "28px",
          // 统一高度
          fontWeight: "bold"
        }
      },
      cancelButton: {
        backgroundColor: "#f44336",
        fontWeight: "bold",
        fontSize: "15px",
        borderRadius: "12px",
        boxShadow: "0 1px 4px 0 rgba(244,67,54,0.08)",
        margin: "4px 0",
        width: "100%",
        minHeight: "36px",
        border: "none",
        // 添加这行，移除黑框
        padding: "8px 0",
        // 添加这行，统一padding
        color: "#fff",
        cursor: "pointer",
        transition: "all 0.3s ease",
        ":hover": {
          background: "linear-gradient(45deg, #e53935, #f44336)",
          transform: "translateY(-2px)",
          boxShadow: "0 4px 15px rgba(244,67,54,0.3)"
        },
        "@media (max-width: 768px)": {
          fontSize: "13px",
          borderRadius: "8px",
          margin: "3px 0",
          minHeight: "28px",
          padding: "6px 0"
          // 移动端padding
        },
        background: "linear-gradient(45deg, #f44336, #e53935)"
      },
      buttonGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "center",
        marginBottom: "10px",
        width: "100%"
      },
      progressContainer: {
        display: "none",
        background: "rgba(245,247,250,0.85)",
        borderRadius: "10px",
        padding: "8px 0",
        margin: "4px 0",
        boxShadow: "0 1px 4px 0 rgba(60,60,100,0.06)",
        "@media (max-width: 768px)": {
          width: "100%",
          padding: "6px 0",
          borderRadius: "7px"
        },
        backdropFilter: "blur(5px)",
        border: "1px solid rgba(255,255,255,0.1)"
      },
      infoText: {
        color: "#4a5568",
        fontSize: "15px",
        textAlign: "center",
        marginBottom: "10px",
        fontWeight: "500",
        letterSpacing: "0.5px",
        "@media (max-width: 768px)": {
          fontSize: "12px",
          marginBottom: "5px"
        }
      },
      chapterListContainer: {
        marginTop: "10px",
        display: "none",
        maxHeight: "50vh",
        overflowY: "auto",
        paddingRight: "18px",
        boxSizing: "border-box",
        "@media (max-width: 768px)": {
          maxHeight: "60vh",
          paddingRight: "0"
        }
      },
      modeSelector: {
        width: "100%",
        padding: "10px 0",
        marginBottom: "10px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        "@media (max-width: 768px)": {
          padding: "8px 0",
          marginBottom: "8px"
        }
      },
      modeSelectorSelect: {
        flex: "1",
        padding: "8px 12px",
        fontSize: "13px",
        fontWeight: "bold",
        border: "2px solid #4CAF50",
        borderRadius: "8px",
        backgroundColor: "#fff",
        color: "#4CAF50",
        cursor: "pointer",
        transition: "all 0.3s ease",
        "@media (max-width: 768px)": {
          padding: "6px 8px",
          fontSize: "12px"
        }
      }
    };
    function applyResponsiveStyles(element, styles) {
      Object.assign(element.style, styles);
      if (window.innerWidth <= 768) {
        const mobileStyles = styles["@media (max-width: 768px)"];
        if (mobileStyles) {
          Object.assign(element.style, mobileStyles);
        }
      }
    }
    class SiteAdapter {
      isChapterPage() {
        throw new Error("必须实现 isChapterPage 方法");
      }
      isDirectoryPage() {
        throw new Error("必须实现 isDirectoryPage 方法");
      }
      getChapterLinks() {
        throw new Error("必须实现 getChapterLinks 方法");
      }
      getChapterName() {
        throw new Error("必须实现 getChapterName 方法");
      }
      getImageElements() {
        throw new Error("必须实现 getImageElements 方法");
      }
      getImageUrl(imgElement) {
        throw new Error("必须实现 getImageUrl 方法");
      }
      // ✅ 新增：检查当前页面是否有分页
      hasMultiplePages() {
        return false;
      }
      // ✅ 新增：获取所有分页URL（包括当前页）
      getPageUrls() {
        return [window.location.href];
      }
      // ✅ 新增：从指定URL获取图片URL列表（用于后台加载分页）
      async fetchImageUrlsFromPage(pageUrl) {
        console.log(`后台加载分页: ${pageUrl}`);
        return new Promise((resolve, reject) => {
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          document.body.appendChild(iframe);
          let timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error("分页加载超时"));
          }, 3e4);
          const cleanup = () => {
            clearTimeout(timeoutId);
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          };
          iframe.onload = async () => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              await new Promise((wait) => setTimeout(wait, 2e3));
              const imageElements = iframeDoc.querySelectorAll(this.getImageSelector());
              console.log(`分页找到 ${imageElements.length} 张图片`);
              const imageUrls = [];
              for (let img of imageElements) {
                const url = this.getImageUrlFromElement(img);
                if (url) {
                  imageUrls.push(url);
                }
              }
              cleanup();
              resolve(imageUrls);
            } catch (error) {
              cleanup();
              reject(error);
            }
          };
          iframe.onerror = () => {
            cleanup();
            reject(new Error("分页加载失败"));
          };
          iframe.src = pageUrl;
        });
      }
      // ✅ 新增：获取图片选择器（子类可覆盖）
      getImageSelector() {
        return "img";
      }
      // ✅ 新增：从元素获取图片URL（复用 getImageUrl 逻辑）
      getImageUrlFromElement(imgElement) {
        return this.getImageUrl(imgElement);
      }
    }
    class RumanhuaAdapter extends SiteAdapter {
      isChapterPage() {
        const url = window.location.href;
        const chapterPagePattern = /http:\/\/m\.rumanhua(1|2)\.com\/[^\/]+\/[^\/]+\.html/;
        return chapterPagePattern.test(url);
      }
      isDirectoryPage() {
        const url = window.location.href;
        const directoryPagePattern = /http:\/\/m\.rumanhua(1|2)\.com\/[^\/]+\/?$/;
        return directoryPagePattern.test(url);
      }
      async getChapterLinks() {
        const waitForChapterList = () => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkForList = () => {
              const selectors = [
                ".cartoon-box .chaplist-box ul",
                ".chaplist-box ul",
                ".chapterlistload ul",
                ".chapter-list ul",
                ".chapterlist ul"
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
                reject(new Error("未找到章节列表"));
                return;
              }
              setTimeout(checkForList, 500);
            };
            checkForList();
          });
        };
        try {
          const chapterListElement = await waitForChapterList();
          const chapterElements = chapterListElement.querySelectorAll("a");
          const baseUrl = window.location.origin;
          const links = Array.from(chapterElements).map((element) => {
            const href = element.getAttribute("href");
            const url = href.startsWith("http") ? href : baseUrl + href;
            const name = element.textContent.trim();
            return { url, name };
          });
          return links;
        } catch (error) {
          throw error;
        }
      }
      getChapterName() {
        const chapterNameElement = document.querySelector(".chaphead-name h1");
        return chapterNameElement ? chapterNameElement.textContent.trim() : "未知章节";
      }
      getImageElements() {
        return document.querySelectorAll(".chapter-img-box img");
      }
      getImageUrl(imgElement) {
        if (!imgElement) return null;
        const src = imgElement.src || imgElement.dataset.src;
        if (!src) return null;
        let imageUrl = src.includes("/static/images/load.gif") ? imgElement.dataset.src : src;
        if (imageUrl.startsWith("blob:")) {
          return imageUrl;
        }
        if (imageUrl.startsWith("http:")) {
          imageUrl = imageUrl.replace("http:", "https:");
        }
        return imageUrl;
      }
    }
    class RumanhuaPCAdapter extends SiteAdapter {
      isChapterPage() {
        const url = window.location.href;
        const chapterPagePattern = /http:\/\/www\.rumanhua(1|2)\.com\/[^\/]+\/[^\/]+\.html/;
        return chapterPagePattern.test(url);
      }
      isDirectoryPage() {
        const url = window.location.href;
        const directoryPagePattern = /http:\/\/www\.rumanhua(1|2)\.com\/[^\/]+\/?$/;
        return directoryPagePattern.test(url) && !this.isChapterPage();
      }
      async getChapterLinks() {
        const waitForChapterList = () => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkForList = () => {
              const selectors = [
                ".chapterlistload ul",
                ".cartoon-box .chaplist-box ul",
                ".chaplist-box ul",
                ".chapter-list ul",
                ".chapterlist ul",
                ".chapterlistload ul li a"
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
                reject(new Error("未找到章节列表"));
                return;
              }
              setTimeout(checkForList, 500);
            };
            checkForList();
          });
        };
        try {
          const chapterListElement = await waitForChapterList();
          const chapterElements = chapterListElement.querySelectorAll("a");
          const baseUrl = window.location.origin;
          const links = Array.from(chapterElements).map((element) => {
            const href = element.getAttribute("href");
            const url = href.startsWith("http") ? href : baseUrl + href;
            const name = element.textContent.trim();
            return { url, name };
          });
          return links;
        } catch (error) {
          console.error("获取章节列表失败:", error);
          return [];
        }
      }
      getChapterName() {
        const chapterName = document.querySelector(".headwrap .chaptername_title")?.textContent || "未知章节";
        return chapterName;
      }
      getImageElements() {
        return document.querySelectorAll("div.chapter-img-box img");
      }
      getImageUrl(imgElement) {
        if (!imgElement) return null;
        const src = imgElement.src || imgElement.dataset.src;
        if (!src) return null;
        let imageUrl = src.includes("/static/images/load.gif") ? imgElement.dataset.src : src;
        if (imageUrl.startsWith("blob:")) {
          return imageUrl;
        }
        if (imageUrl.startsWith("http:")) {
          imageUrl = imageUrl.replace("http:", "https:");
        }
        return imageUrl;
      }
    }
    class RumanhuaOrgAdapter extends SiteAdapter {
      isChapterPage() {
        const url = window.location.href;
        const chapterPagePattern = /https:\/\/www\.rumanhua\.org\/show\/[^\/]+\.html/;
        return chapterPagePattern.test(url);
      }
      isDirectoryPage() {
        const url = window.location.href;
        return url.includes("https://www.rumanhua.org") && !this.isChapterPage();
      }
      async getChapterLinks() {
        const waitForChapterList = () => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkForList = () => {
              const selectors = [
                "div.list a.ib",
                ".chapterlistload ul",
                ".cartoon-box .chaplist-box ul",
                ".chaplist-box ul",
                ".chapter-list ul",
                ".chapterlist ul",
                ".chapterlistload ul li a"
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
                reject(new Error("未找到章节列表"));
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
          const links = Array.from(chapterElements).map((element) => {
            const href = element.getAttribute("href");
            const url = href.startsWith("http") ? href : baseUrl + href;
            const name = element.textContent.trim();
            return { url, name };
          });
          return links;
        } catch (error) {
          console.error("获取章节列表失败:", error);
          return [];
        }
      }
      getChapterName() {
        const title = document.querySelector("title")?.textContent || "未知章节";
        const match = title.match(/-\s*(.+?)\s*在线阅读/);
        return match ? match[1] : title;
      }
      getImageElements() {
        return document.querySelectorAll("ul.comic-contain li img");
      }
      getImageUrl(imgElement) {
        if (!imgElement) return null;
        const src = imgElement.dataset.src || imgElement.src;
        if (!src) return null;
        let imageUrl = src;
        if (imageUrl.startsWith("blob:")) {
          return imageUrl;
        }
        if (imageUrl.startsWith("http:")) {
          imageUrl = imageUrl.replace("http:", "https:");
        }
        return imageUrl;
      }
    }
    class RumanhuaMobileNewAdapter extends SiteAdapter {
      isChapterPage() {
        const url = window.location.href;
        const chapterPagePattern = /https:\/\/m\.rumanhua\.org\/show\/[^\/]+\.html/;
        return chapterPagePattern.test(url);
      }
      isDirectoryPage() {
        const url = window.location.href;
        const directoryPagePattern = /https:\/\/m\.rumanhua\.org\/news\/\d+/;
        return directoryPagePattern.test(url);
      }
      async getChapterLinks() {
        const waitForChapterList = () => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkForList = () => {
              const selectors = [
                "ul.chapterList li a",
                ".chapterList a",
                "ul.am-thumbnails li a",
                ".chapter-list a"
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
                reject(new Error("未找到章节列表"));
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
          const links = Array.from(chapterElements).map((element) => {
            const href = element.getAttribute("href");
            const url = href.startsWith("http") ? href : baseUrl + href;
            const name = element.textContent.trim();
            return { url, name };
          });
          return links;
        } catch (error) {
          console.error("获取章节列表失败:", error);
          return [];
        }
      }
      getChapterName() {
        const titleSpan = document.querySelector("span#title");
        if (titleSpan) {
          const name = titleSpan.textContent.trim();
          console.log("获取章节名称:", name);
          return name;
        }
      }
      getImageElements() {
        const selectors = [
          "div.reader-img img",
          "div.comic-contain img",
          'div[class*="comic"] img',
          "div.chapter-img-box img",
          "img[data-src]",
          "img.lazy"
        ];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`使用选择器: ${selector}, 找到 ${elements.length} 张图片`);
            return elements;
          }
        }
        console.warn("使用备用选择器获取图片");
        return document.querySelectorAll('img[src]:not([src*="logo"]):not([src*="icon"])');
      }
      getImageUrl(imgElement) {
        if (!imgElement) return null;
        let imageUrl = imgElement.dataset.src || imgElement.src;
        if (!imageUrl) return null;
        if (imageUrl.includes("placeholder") || imageUrl.includes("loading")) {
          return null;
        }
        if (imageUrl.startsWith("blob:")) {
          return imageUrl;
        }
        if (imageUrl.startsWith("http:")) {
          imageUrl = imageUrl.replace("http:", "https:");
        }
        if (imageUrl.startsWith("//")) {
          imageUrl = "https:" + imageUrl;
        } else if (imageUrl.startsWith("/") && !imageUrl.startsWith("//")) {
          imageUrl = window.location.origin + imageUrl;
        }
        return imageUrl;
      }
    }
    class MangaparkAdapter extends SiteAdapter {
      isChapterPage() {
        const chapterPagePattern = /https:\/\/mangapark\.net\/title\/+[^\/]+\/+[^\/]/;
        return chapterPagePattern.test(window.location.href);
      }
      isDirectoryPage() {
        const url = window.location.href;
        return url.includes("https://mangapark.net/title/") && !this.isChapterPage();
      }
      async getChapterLinks() {
        const waitForChapterList = () => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkForList = () => {
              const selectors = [
                'div[data-name="chapter-list"] div.scrollable-panel div.group div.px-2 > div.space-x-1 a'
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
                reject(new Error("未找到章节列表"));
                return;
              }
              setTimeout(checkForList, 500);
            };
            checkForList();
          });
        };
        try {
          const chapterElements = await waitForChapterList();
          const links = Array.from(chapterElements).map((element) => {
            const href = element.getAttribute("href");
            const url = href.startsWith("http") ? href : "https://mangapark.net" + href;
            const name = element.textContent.trim();
            return { url, name };
          });
          return links.reverse();
        } catch (error) {
          console.error("获取章节列表失败:", error);
          return [];
        }
      }
      getChapterName() {
        const selectors = [
          "div.text-base-content h6.text-lg span"
        ];
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.textContent.trim();
          }
        }
        const urlParts = window.location.pathname.split("/");
        const chapterPart = urlParts[urlParts.length - 1];
        return chapterPart.replace(/-\d+-/, " ").replace(/-/g, " ");
      }
      getImageElements() {
        return document.querySelectorAll('div[data-name="image-show"] img, div[data-name="image-item"] img');
      }
      getImageUrl(imgElement) {
        if (!imgElement) return null;
        const src = imgElement.dataset.src || imgElement.dataset.url || imgElement.src;
        if (src) {
          let imageUrl = src;
          if (imageUrl.startsWith("//")) {
            imageUrl = "https:" + imageUrl;
          } else if (imageUrl.startsWith("/")) {
            imageUrl = "https://mangapark.net" + imageUrl;
          }
          if (imageUrl.startsWith("blob:")) {
            return imageUrl;
          }
          return imageUrl;
        }
      }
    }
    class ManwakuAdapter extends SiteAdapter {
      isChapterPage() {
        const url = window.location.href;
        const chapterPagePattern = /https?:\/\/(www\.)?(mwdd|mwhh|mhtmh|mwai|mwku|mwrr|manwaku|mwbu|mwdu)\.(cc|org|com)\/comic\/\d+\/\d+\/?$/;
        return chapterPagePattern.test(url);
      }
      isDirectoryPage() {
        const url = window.location.href;
        const directoryPagePattern = /https?:\/\/(www\.)?(mwdd|mwhh|mhtmh|mwai|mwku|mwrr|manwaku|mwbu|mwdu)\.(cc|org|com)\/comic\/\d+\/?$/;
        return directoryPagePattern.test(url) && !this.isChapterPage();
      }
      async getChapterLinks() {
        const waitForChapterList = () => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            const checkForList = () => {
              const selectors = [
                "div.chapter-grid a.chapter-item",
                "div#chapter-grid-container a.chapter-item",
                ".chapter-grid a.chapter-item",
                "a.chapter-item"
              ];
              for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                  console.log(`找到 ${elements.length} 个章节链接，使用选择器: ${selector}`);
                  resolve(elements);
                  return;
                }
              }
              attempts++;
              if (attempts >= maxAttempts) {
                reject(new Error("未找到章节列表"));
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
          const links = Array.from(chapterElements).map((element) => {
            const href = element.getAttribute("href");
            const url = href.startsWith("http") ? href : baseUrl + href;
            let name = element.getAttribute("data-title");
            if (!name) {
              const nameEl = element.querySelector(".chapter-name");
              name = nameEl ? nameEl.textContent.trim() : "未知章节";
            }
            return { url, name };
          });
          console.log(`获取到 ${links.length} 个章节`);
          return links;
        } catch (error) {
          console.error("获取章节列表失败:", error);
          return [];
        }
      }
      // ✅ 实现：检查是否有分页
      hasMultiplePages() {
        const titleSpan = document.querySelector("span.basetitle#current-title");
        if (titleSpan) {
          const name = titleSpan.textContent.trim();
          return /\(第\d+\/\d+页\)/.test(name);
        }
        return false;
      }
      // ✅ 实现：获取所有分页URL
      getPageUrls() {
        const titleSpan = document.querySelector("span.basetitle#current-title");
        if (!titleSpan) {
          return [window.location.href];
        }
        const name = titleSpan.textContent.trim();
        const match = name.match(/\(第(\d+)\/(\d+)页\)/);
        if (!match) {
          return [window.location.href];
        }
        const totalPages = parseInt(match[2]);
        const baseUrl = window.location.href.split("_")[0];
        const pageUrls = [];
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1) {
            pageUrls.push(baseUrl);
          } else {
            pageUrls.push(`${baseUrl}_${i}`);
          }
        }
        console.log(`检测到 ${totalPages} 个分页:`, pageUrls);
        return pageUrls;
      }
      // ✅ 实现：图片选择器
      getImageSelector() {
        return "article.epContent figure.cImg img, figure.cImg img";
      }
      getChapterName() {
        const titleSpan = document.querySelector("span.basetitle#current-title");
        if (titleSpan) {
          const name = titleSpan.textContent.trim();
          return name.replace(/\s*\(第\d+\/\d+页\)/, "");
        }
        const title = document.querySelector("title")?.textContent || "未知章节";
        return title;
      }
      getImageElements() {
        const selectors = [
          "article.epContent figure.cImg img",
          "div#showimgcontent figure.cImg img",
          "figure.cImg img"
        ];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`使用选择器: ${selector}, 找到 ${elements.length} 张图片`);
            return elements;
          }
        }
        console.warn("使用备用选择器获取图片");
        return document.querySelectorAll("img");
      }
      getImageUrl(imgElement) {
        if (!imgElement) return null;
        let imageUrl = imgElement.src;
        if (imageUrl && imageUrl.includes("loading.gif")) {
          console.log("检测到占位图，使用 dataset.src:", imgElement.dataset.src);
          imageUrl = imgElement.dataset.src;
        }
        if (!imageUrl) {
          imageUrl = imgElement.dataset.src;
        }
        if (!imageUrl) return null;
        if (imageUrl.includes("placeholder") || imageUrl.includes("loading")) {
          return null;
        }
        if (imageUrl.startsWith("blob:")) {
          return imageUrl;
        }
        if (imageUrl.startsWith("http:")) {
          imageUrl = imageUrl.replace("http:", "https:");
        }
        if (imageUrl.startsWith("//")) {
          imageUrl = "https:" + imageUrl;
        } else if (imageUrl.startsWith("/") && !imageUrl.startsWith("//")) {
          imageUrl = window.location.origin + imageUrl;
        }
        console.log("获取的图片URL:", imageUrl);
        return imageUrl;
      }
    }
    function getSiteAdapter() {
      const url = window.location.href;
      switch (true) {
        case (url.includes("http://www.rumanhua1.com/") || url.includes("http://www.rumanhua2.com/")):
          return new RumanhuaPCAdapter();
        case (url.includes("http://m.rumanhua1.com/") || url.includes("http://m.rumanhua2.com/")):
          return new RumanhuaAdapter();
        case url.includes("https://www.rumanhua.org/"):
          return new RumanhuaOrgAdapter();
        case url.includes("https://m.rumanhua.org/"):
          return new RumanhuaMobileNewAdapter();
        case url.includes("https://mangapark.net/"):
          return new MangaparkAdapter();
        case (url.includes("mwdd.cc") || url.includes("mwhh.cc") || url.includes("mhtmh.org") || url.includes("mwai.cc") || url.includes("mwku.cc") || url.includes("mwrr.cc") || url.includes("manwaku.com") || url.includes("mwbu.cc") || url.includes("mwdu.cc")):
          return new ManwakuAdapter();
        default:
          throw new Error("不支持的页面格式");
      }
    }
    class DownloaderUI {
      constructor(totalPages, onDownload, onCancel) {
        this.totalPages = totalPages;
        this.onDownload = onDownload;
        this.onCancel = onCancel;
        this.currentPage = 0;
        this.pdfMode = "normal";
        this.createUI();
      }
      createUI() {
        this.container = this.createContainer();
        document.body.appendChild(this.container);
        this.infoText = this.createElement("div", STYLES.infoText, `本章节共 ${this.totalPages} 页`);
        this.container.appendChild(this.infoText);
        this.modeSelector = this.createModeSelector();
        this.container.appendChild(this.modeSelector);
        this.downloadButton = this.createButton("下载本章节", () => this.onDownload(1, this.totalPages));
        this.cancelButton = this.createButton("取消下载", () => {
          this.onCancel();
          this.infoText.textContent = "下载已取消";
          setTimeout(() => {
            this.infoText.textContent = `本章节共 ${this.totalPages} 页`;
          }, 2e3);
        }, true);
        this.cancelButton.style.display = "none";
        this.progressContainer = this.createElement("div", {
          display: "none",
          marginTop: "10px",
          padding: "6px",
          backgroundColor: "rgba(245,247,250,0.9)",
          borderRadius: "8px",
          "@media (max-width: 768px)": {
            padding: "4px"
          }
        });
        this.progressBar = document.createElement("progress");
        this.progressBar.max = this.totalPages;
        this.progressBar.value = 0;
        this.progressBar.style.width = "100%";
        this.progressBar.style.height = "4px";
        this.progressBar.style.borderRadius = "2px";
        this.progressBar.style.border = "none";
        this.progressBar.style.backgroundColor = "#e0e0e0";
        this.progressText = this.createElement("div", {
          marginTop: "6px",
          fontSize: "12px",
          color: "#333",
          "@media (max-width: 768px)": {
            fontSize: "11px",
            marginTop: "4px"
          }
        });
        this.progressContainer.appendChild(this.progressBar);
        this.progressContainer.appendChild(this.progressText);
        this.container.appendChild(this.downloadButton);
        this.container.appendChild(this.cancelButton);
        this.container.appendChild(this.progressContainer);
        window.addEventListener("resize", () => {
          this.updateResponsiveStyles();
        });
      }
      setLoading(isLoading, showCancel = false) {
        this.downloadButton.disabled = isLoading;
        this.downloadButton.style.backgroundColor = isLoading ? "#999" : "#4CAF50";
        this.downloadButton.style.cursor = isLoading ? "not-allowed" : "pointer";
        this.downloadButton.textContent = isLoading ? "下载中..." : "下载本章节";
        if (isLoading) {
          this.downloadButton.style.display = "none";
          this.cancelButton.style.display = showCancel ? "block" : "none";
          this.progressContainer.style.display = "none";
          this.infoText.style.display = "block";
          this.modeSelector.style.setProperty("display", "none", "important");
        } else {
          this.downloadButton.style.display = "block";
          this.cancelButton.style.display = "none";
          this.progressContainer.style.display = "none";
          this.infoText.style.display = "block";
          this.modeSelector.style.setProperty("display", "flex", "important");
        }
      }
      updateProgress(currentPage) {
        this.currentPage = currentPage;
        this.progressBar.value = currentPage;
        const percent = (currentPage / this.totalPages * 100).toFixed(1);
        this.infoText.textContent = `📥 下载中... ${currentPage}/${this.totalPages}`;
        this.infoText.style.display = "block";
        this.infoText.style.color = "#2196F3";
      }
      createModeSelector() {
        const container = this.createElement("div", STYLES.modeSelector);
        const select = document.createElement("select");
        Object.assign(select.style, STYLES.modeSelectorSelect);
        const modes = [
          { id: "longpage", label: "长图模式" },
          { id: "normal", label: "翻页模式" },
          { id: "scroll", label: "滚动模式" }
        ];
        modes.forEach((mode) => {
          const option = document.createElement("option");
          option.value = mode.id;
          option.textContent = mode.label;
          if (mode.id === "longpage") {
            option.selected = true;
            this.pdfMode = "longpage";
          }
          select.appendChild(option);
        });
        select.addEventListener("change", (e) => {
          this.pdfMode = e.target.value;
          console.log(`切换到模式: ${this.pdfMode}`);
        });
        container.appendChild(select);
        return container;
      }
      createButton(text, onClick, isCancel = false) {
        const button = document.createElement("button");
        Object.assign(button.style, STYLES.button);
        if (isCancel) {
          Object.assign(button.style, STYLES.cancelButton);
        }
        button.textContent = text;
        button.addEventListener("click", onClick);
        this.container.appendChild(button);
        return button;
      }
      createContainer() {
        const container = document.createElement("div");
        Object.assign(container.style, STYLES.container);
        return container;
      }
      updateResponsiveStyles() {
      }
      // 修改 createElement 方法
      createElement(type, styles, textContent = "") {
        const element = document.createElement(type);
        if (type === "input" && styles.type) {
          element.type = styles.type;
          delete styles.type;
        }
        if (typeof styles === "string") {
          element.className = styles;
        } else {
          applyResponsiveStyles(element, styles);
        }
        if (textContent) element.textContent = textContent;
        return element;
      }
    }
    class ChapterSelectorUI {
      constructor({ adapter, onDownloadSelected, ontoggleScrollMode, onCancel, onProgress, onLoading, onComplete, onError }) {
        this.adapter = adapter;
        this.onDownloadSelected = onDownloadSelected;
        this.ontoggleScrollMode = ontoggleScrollMode;
        this.onCancel = onCancel;
        this.onProgress = onProgress;
        this.onLoading = onLoading;
        this.onComplete = onComplete;
        this.onError = onError;
        this.selectedChapters = /* @__PURE__ */ new Set();
        this.isSelectionMode = false;
        this.pdfMode = "normal";
        this.selectionStart = null;
        this.selectionEnd = null;
        this.isDownloading = false;
        this.createUI();
      }
      createUI() {
        this.container = this.createElement("div", {
          ...STYLES.container,
          "@media (min-width: 769px)": {
            width: "300px",
            right: "20px",
            left: "auto"
          }
        });
        document.body.appendChild(this.container);
        this.screen1 = this.createElement("div", { display: "flex", flexDirection: "column" });
        this.chooseChapterButton = this.createElement("button", {
          width: "100%",
          padding: "12px 8px",
          fontSize: "14px",
          fontWeight: "bold",
          color: "#fff",
          backgroundColor: "#2196F3",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: "0 2px 4px rgba(33,150,243,0.2)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          marginBottom: "10px"
        });
        this.chooseChapterButtonText = document.createElement("span");
        this.chooseChapterButtonText.textContent = "📂 选择章节";
        this.chooseChapterButton.appendChild(this.chooseChapterButtonText);
        this.chooseChapterButton.addEventListener("click", () => this.switchScreen("selection"));
        this.screen1.appendChild(this.chooseChapterButton);
        this.container.appendChild(this.screen1);
        this.screen2 = this.createElement("div", { display: "none", flexDirection: "column" });
        this.topBar = this.createElement("div", {
          display: "flex",
          flexDirection: "row",
          gap: "10px",
          width: "100%",
          marginBottom: "10px",
          alignItems: "center",
          justifyContent: "space-between"
        });
        this.backButton = this.createElement("button", {
          padding: "6px 8px",
          fontSize: "20px",
          color: "#555",
          backgroundColor: "#f5f5f5",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: "6px",
          cursor: "pointer",
          minWidth: "36px",
          minHeight: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: "0"
        });
        this.backButton.textContent = "←";
        this.backButtonHoverEnter = () => {
          if (!this.isDownloading) {
            this.backButton.style.backgroundColor = "#e0e0e0";
            this.backButton.style.color = "#000";
          }
        };
        this.backButtonHoverLeave = () => {
          this.backButton.style.backgroundColor = "#f5f5f5";
          this.backButton.style.color = "#555";
        };
        this.backButton.addEventListener("mouseenter", this.backButtonHoverEnter);
        this.backButton.addEventListener("mouseleave", this.backButtonHoverLeave);
        this.backButton.addEventListener("click", () => {
          if (this.isDownloading) {
            this.cancelDownload();
          } else {
            this.switchScreen("initial");
            this.onCancel && this.onCancel();
          }
        });
        this.topBar.appendChild(this.backButton);
        this.modeSelector = this.createChapterModeSelector();
        this.topBar.appendChild(this.modeSelector);
        this.screen2.appendChild(this.topBar);
        this.selectButton = this.createElement("button", {
          width: "100%",
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: "bold",
          color: "#fff",
          backgroundColor: "#4CAF50",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(76,175,80,0.2)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          marginBottom: "10px"
        });
        this.selectButtonText = document.createElement("span");
        this.selectButtonText.textContent = "📥 下载选中章节";
        this.selectButton.appendChild(this.selectButtonText);
        this.selectButton.addEventListener("click", () => {
          if (this.selectedChapters.size > 0) {
            this.onDownloadSelected && this.onDownloadSelected(Array.from(this.selectedChapters));
          }
        });
        this.screen2.appendChild(this.selectButton);
        this.chapterListContainer = this.createElement("div", {
          maxHeight: "50vh",
          overflowY: "auto",
          paddingRight: "4px",
          boxSizing: "border-box"
        });
        this.chapterListContainer.classList.add("comic-downloader-chapter-list");
        this.screen2.appendChild(this.chapterListContainer);
        this.container.appendChild(this.screen2);
        this.screen3 = this.createElement("div", { display: "none", flexDirection: "column" });
        this.buttonContainer = this.createElement("div", {
          display: "flex",
          flexDirection: "row",
          gap: "10px",
          width: "100%",
          marginBottom: "10px"
        });
        this.downloadButton = this.createElement("button", {
          flex: "1",
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: "bold",
          color: "#fff",
          backgroundColor: "#4CAF50",
          border: "none",
          borderRadius: "8px",
          cursor: "not-allowed",
          boxShadow: "0 2px 4px rgba(76,175,80,0.2)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          minHeight: "44px"
        });
        this.downloadButtonText = document.createElement("span");
        this.downloadButtonText.textContent = "下载中...";
        this.downloadButton.appendChild(this.downloadButtonText);
        this.buttonContainer.appendChild(this.downloadButton);
        this.cancelButton = this.createElement("button", {
          width: "auto",
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: "bold",
          color: "#fff",
          backgroundColor: "#9e9e9e",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(158,158,158,0.2)",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "44px",
          whiteSpace: "nowrap"
        });
        this.cancelButtonText = document.createElement("span");
        this.cancelButtonText.textContent = "取消下载";
        this.cancelButton.appendChild(this.cancelButtonText);
        this.cancelButton.addEventListener("click", () => this.cancelDownload());
        this.buttonContainer.appendChild(this.cancelButton);
        this.screen3.appendChild(this.buttonContainer);
        this.progressInfoContainer = this.createElement("div", {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "12px"
        });
        this.screen3.appendChild(this.progressInfoContainer);
        this.container.appendChild(this.screen3);
      }
      // ============ 屏幕切换方法 ============
      switchScreen(screenName) {
        console.log(`切换到屏幕: ${screenName}`);
        this.screen1.style.display = "none";
        this.screen2.style.display = "none";
        this.screen3.style.display = "none";
        if (screenName === "initial") {
          this.isSelectionMode = false;
          this.screen1.style.display = "flex";
        } else if (screenName === "selection") {
          this.isSelectionMode = true;
          if (this.chapterListContainer.children.length === 0) {
            this.initChapterList();
          }
          this.screen2.style.display = "flex";
        } else if (screenName === "downloading") {
          this.isDownloading = true;
          this.screen3.style.display = "flex";
        }
      }
      cancelDownload() {
        console.log("用户取消批量下载");
        gmSetValue("cancelBatchDownload", true);
        this.isDownloading = false;
        this.switchScreen("selection");
        this.selectButton.disabled = false;
        this.selectButton.style.backgroundColor = "#4CAF50";
        this.selectButton.style.cursor = "pointer";
        const originalText = this.selectButtonText.textContent;
        this.selectButtonText.textContent = "⏸️ 下载已取消";
        this.selectButton.style.backgroundColor = "#ff9800";
        setTimeout(() => {
          this.selectButtonText.textContent = originalText;
          this.selectButton.style.backgroundColor = "#4CAF50";
        }, 2e3);
      }
      async initChapterList() {
        const previousScrollTop = this.chapterListContainer.scrollTop || 0;
        this.chapterListContainer.innerHTML = "";
        this.selectedChapters = /* @__PURE__ */ new Set();
        this.selectionStart = null;
        this.selectionEnd = null;
        try {
          const chapterLinks = await this.adapter.getChapterLinks();
          if (!chapterLinks || chapterLinks.length === 0) {
            return;
          }
          const controlsContainer = this.createElement("div", {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            gap: "8px",
            position: "sticky",
            top: "0",
            backgroundColor: "rgba(255,255,255,0.9)",
            padding: "5px 0",
            zIndex: "1",
            // ✅ 添加阴影，让sticky效果更明显
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          });
          const chapterCountLabel = this.createElement("span", {
            fontSize: "12px",
            color: "#666",
            alignSelf: "center"
          }, `共 ${chapterLinks.length} 章`);
          const buttonsContainer = this.createElement("div", {
            display: "flex",
            gap: "5px"
          });
          const selectAllBtn = this.createElement("button", {
            padding: "3px 10px",
            fontSize: "12px",
            backgroundColor: "#4caf50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold"
          }, "全选章节");
          selectAllBtn.addEventListener("click", () => {
            const scrollTop = this.chapterListContainer.scrollTop;
            this.selectedChapters = new Set(chapterLinks.map((_, i) => i));
            this.selectionStart = 0;
            this.selectionEnd = chapterLinks.length - 1;
            this.updateChapterSelectionUI();
            this.selectButtonText.textContent = `下载 (${this.selectedChapters.size})`;
            this.chapterListContainer.scrollTop = scrollTop;
          });
          const deselectAllBtn = this.createElement("button", {
            padding: "3px 10px",
            fontSize: "12px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold"
          }, "清除选择");
          deselectAllBtn.addEventListener("click", () => {
            const scrollTop = this.chapterListContainer.scrollTop;
            this.selectedChapters.clear();
            this.selectionStart = null;
            this.selectionEnd = null;
            this.updateChapterSelectionUI();
            this.selectButtonText.textContent = "选择下载";
            this.chapterListContainer.scrollTop = scrollTop;
          });
          const refreshBtn = this.createElement("button", {
            padding: "3px 10px",
            fontSize: "12px",
            backgroundColor: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold"
          }, "刷新列表");
          refreshBtn.addEventListener("click", () => this.refreshChapterList());
          buttonsContainer.appendChild(selectAllBtn);
          buttonsContainer.appendChild(deselectAllBtn);
          buttonsContainer.appendChild(refreshBtn);
          controlsContainer.appendChild(chapterCountLabel);
          controlsContainer.appendChild(buttonsContainer);
          this.chapterListContainer.appendChild(controlsContainer);
          chapterLinks.forEach((chapter, index) => {
            const chapterItem = this.createElement("div", {
              padding: "10px 12px",
              marginBottom: "8px",
              borderRadius: "8px",
              background: "#f5f7fa",
              cursor: "pointer",
              transition: "background 0.2s, color 0.2s",
              fontSize: "15px",
              fontWeight: "500",
              userSelect: "none",
              border: "1px solid #e0e6ef",
              // ✅ 添加触摸反馈
              "@media (max-width: 768px)": {
                padding: "12px",
                fontSize: "14px",
                touchAction: "manipulation"
                // 优化触摸体验
              }
            });
            chapterItem.textContent = chapter.name;
            chapterItem.addEventListener("touchstart", () => {
              chapterItem.style.transform = "scale(0.98)";
            });
            chapterItem.addEventListener("touchend", () => {
              chapterItem.style.transform = "scale(1)";
            });
            chapterItem.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.handleChapterClick(index, chapterLinks.length);
            });
            chapterItem.classList.add("chapter-item");
            this.chapterListContainer.appendChild(chapterItem);
          });
          this.updateChapterSelectionUI();
          if (previousScrollTop > 0) {
            this.chapterListContainer.scrollTop = previousScrollTop;
          }
        } catch (error) {
          console.error("初始化章节列表失败:", error);
        }
      }
      handleChapterClick(index, total) {
        console.log(`处理章节点击: index=${index}, total=${total}`);
        const scrollTop = this.chapterListContainer.scrollTop;
        if (!this.isSelectionMode) {
          this.isSelectionMode = true;
          this.cancelSelectionButton.style.display = "block";
          this.selectButton.textContent = "下载选中章节";
          this.modeSelector.style.display = "flex";
          console.log("进入选择模式（不重新初始化列表）");
        }
        if (this.selectionStart === null) {
          this.selectionStart = index;
          this.selectedChapters = /* @__PURE__ */ new Set([index]);
        } else if (this.selectionEnd === null) {
          this.selectionEnd = index;
          const [start, end] = [this.selectionStart, this.selectionEnd].sort((a, b) => a - b);
          this.selectedChapters = /* @__PURE__ */ new Set();
          for (let i = start; i <= end; i++) {
            this.selectedChapters.add(i);
          }
        } else {
          this.selectionStart = index;
          this.selectionEnd = null;
          this.selectedChapters = /* @__PURE__ */ new Set([index]);
        }
        this.updateChapterSelectionUI();
        this.chapterListContainer.scrollTop = scrollTop;
        if (this.selectedChapters.size > 0) {
          this.selectButtonText.textContent = `下载 (${this.selectedChapters.size})`;
        } else {
          this.selectButtonText.textContent = "选择下载";
        }
      }
      updateChapterSelectionUI() {
        console.log("更新章节选择UI");
        const items = this.chapterListContainer.querySelectorAll(".chapter-item");
        items.forEach((item, idx) => {
          if (this.selectedChapters.has(idx)) {
            item.style.background = "#2196f3";
            item.style.color = "#fff";
            item.style.fontWeight = "bold";
          } else {
            item.style.background = "#f5f7fa";
            item.style.color = "#222";
            item.style.fontWeight = "500";
          }
        });
      }
      refreshChapterList() {
        this.initChapterList();
      }
      createChapterModeSelector() {
        const container = this.createElement("div", {
          flex: "1",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          "@media (max-width: 768px)": {
            flex: "1 1 100%"
          }
        });
        const select = document.createElement("select");
        Object.assign(select.style, {
          flex: "1",
          padding: "6px 10px",
          fontSize: "13px",
          fontWeight: "500",
          border: "1px solid #ddd",
          borderRadius: "6px",
          backgroundColor: "#fff",
          color: "#333",
          cursor: "pointer",
          transition: "all 0.2s ease",
          outline: "none"
        });
        select.addEventListener("mouseenter", () => {
          select.style.borderColor = "#4CAF50";
          select.style.boxShadow = "0 0 0 2px rgba(76, 175, 80, 0.1)";
        });
        select.addEventListener("mouseleave", () => {
          select.style.borderColor = "#ddd";
          select.style.boxShadow = "none";
        });
        const modes = [
          { id: "longpage", label: "📜 长图模式" },
          { id: "normal", label: "📄 翻页模式" },
          { id: "scroll", label: "📱 滚动模式" }
        ];
        modes.forEach((mode) => {
          const option = document.createElement("option");
          option.value = mode.id;
          option.textContent = mode.label;
          if (mode.id === "longpage") {
            option.selected = true;
            this.pdfMode = "longpage";
          }
          select.appendChild(option);
        });
        select.addEventListener("change", (e) => {
          this.pdfMode = e.target.value;
          console.log(`切换到模式: ${this.pdfMode}`);
        });
        container.appendChild(select);
        return container;
      }
      createElement(type, styles, textContent = "") {
        const element = document.createElement(type);
        if (type === "input" && styles.type) {
          element.type = styles.type;
          delete styles.type;
        }
        if (typeof styles === "string") {
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
          this.switchScreen("downloading");
          this.progressInfoContainer.innerHTML = "";
          this.chapterProgressText = this.createElement("div", {
            fontSize: "14px",
            color: "#2196F3",
            fontWeight: "bold",
            marginBottom: "8px"
          }, "📖 章节进度: 0/0");
          this.currentChapterText = this.createElement("div", {
            fontSize: "13px",
            color: "#555",
            marginBottom: "8px",
            wordBreak: "break-word"
          }, "📕 当前章节: --");
          this.imageProgressText = this.createElement("div", {
            fontSize: "14px",
            color: "#FF9800",
            fontWeight: "bold",
            marginBottom: "8px"
          }, "📥 准备下载...");
          this.pdfProgressText = this.createElement("div", {
            fontSize: "14px",
            color: "#673AB7",
            fontWeight: "bold"
          }, "📄 等待下载完成...");
          this.progressInfoContainer.appendChild(this.chapterProgressText);
          this.progressInfoContainer.appendChild(this.currentChapterText);
          this.progressInfoContainer.appendChild(this.imageProgressText);
          this.progressInfoContainer.appendChild(this.pdfProgressText);
          this.startProgressSync();
        } else {
          this.switchScreen("selection");
          if (this.progressInfoContainer) {
            this.progressInfoContainer.innerHTML = "";
          }
          this.stopProgressSync();
        }
      }
      // 添加实时进度同步方法
      startProgressSync() {
        if (this.progressSyncInterval) {
          clearInterval(this.progressSyncInterval);
        }
        let lastLogTime = 0;
        this.progressSyncInterval = setInterval(() => {
          try {
            const currentChapter = gmGetValue("currentChapterName", "");
            const currentImage = gmGetValue("currentImage", 0);
            const totalImages = gmGetValue("totalImages", 0);
            const downloadStatus = gmGetValue("downloadStatus", "");
            const pdfGenerationComplete = gmGetValue("pdfGenerationComplete", false);
            const currentPDFPage = gmGetValue("currentPDFPage", 0);
            const totalPDFPages = gmGetValue("totalPDFPages", 0);
            const buttonText = this.selectButton.textContent;
            let currentChapterNum = 0;
            let totalChapters = 0;
            const match = buttonText.match(/第\s*(\d+)\s*\/\s*(\d+)\s*章/);
            if (match) {
              currentChapterNum = parseInt(match[1]);
              totalChapters = parseInt(match[2]);
            }
            if (currentChapterNum > 0 && totalChapters > 0) {
              this.selectButton.textContent = `正在下载第 ${currentChapterNum}/${totalChapters} 章`;
            }
            if (this.chapterProgressText && currentChapterNum > 0 && totalChapters > 0) {
              this.chapterProgressText.textContent = `📖 章节进度: ${currentChapterNum}/${totalChapters}`;
            }
            if (this.currentChapterText) {
              if (currentChapter) {
                const displayName = currentChapter.length > 20 ? currentChapter.substring(0, 20) + "..." : currentChapter;
                this.currentChapterText.textContent = `📕 当前章节: ${displayName}`;
              } else {
                this.currentChapterText.textContent = `📕 当前章节: --`;
              }
            }
            if (this.imageProgressText) {
              if (totalImages > 0) {
                this.imageProgressText.textContent = `📥 下载中: ${currentImage}/${totalImages}`;
                this.imageProgressText.style.color = "#FF9800";
              } else {
                this.imageProgressText.textContent = `📥 准备下载...`;
                this.imageProgressText.style.color = "#999";
              }
            }
            if (this.pdfProgressText) {
              if (currentImage >= totalImages && totalImages > 0) {
                if (pdfGenerationComplete) {
                  this.pdfProgressText.textContent = `📄 PDF已生成完成！`;
                  this.pdfProgressText.style.color = "#4CAF50";
                } else if (currentPDFPage > 0 && totalPDFPages > 0) {
                  this.pdfProgressText.textContent = `📄 正在生成PDF... ${currentPDFPage}/${totalPDFPages}`;
                  this.pdfProgressText.style.color = "#FF9800";
                } else {
                  this.pdfProgressText.textContent = `📄 准备生成PDF...`;
                  this.pdfProgressText.style.color = "#FF9800";
                }
              } else if (totalImages > 0) {
                this.pdfProgressText.textContent = `📄 等待下载完成...`;
                this.pdfProgressText.style.color = "#999";
              } else {
                this.pdfProgressText.textContent = `📄 准备生成PDF...`;
                this.pdfProgressText.style.color = "#999";
              }
            }
            const now = Date.now();
            if (now - lastLogTime > 5e3) {
              if (currentChapterNum > 0) {
                console.log(`📊 进度同步: 章节${currentChapterNum}/${totalChapters}, 图片${currentImage}/${totalImages}, PDF${currentPDFPage}/${totalPDFPages}`);
              }
              lastLogTime = now;
            }
          } catch (error) {
            console.error("进度同步出错:", error);
          }
        }, 300);
      }
      // 停止实时进度同步
      stopProgressSync() {
        if (this.progressSyncInterval) {
          clearInterval(this.progressSyncInterval);
          this.progressSyncInterval = null;
        }
      }
      // 修改 updateProgress 方法，使其更清晰地显示下载进度
      updateProgress(current, total, currentChapter = "", currentImage = 0, totalImages = 0) {
        if (this.selectButton) {
          this.selectButton.textContent = `正在下载第 ${current}/${total} 章`;
        }
      }
    }
    class ComicDownloader {
      constructor() {
        try {
          console.log("开始创建ComicDownloader实例...");
          this.adapter = getSiteAdapter();
          this.pdfMode = gmGetValue("pdfMode", "longpage");
          this.isDownloading = false;
          this.abortController = null;
          this.activeRequests = /* @__PURE__ */ new Set();
          this.downloadConcurrency = 4;
          this.ui = null;
          this.initPromise = null;
          if (this.adapter.isChapterPage()) {
            console.log("当前是章节页面");
            this.initPromise = this.waitForImagesAndInit();
          } else if (this.adapter.isDirectoryPage()) {
            console.log("当前是目录页面");
            this.ui = new ChapterSelectorUI({
              adapter: this.adapter,
              onDownloadSelected: this.handleDownloadSelected.bind(this),
              onToggleScrollMode: (isScroll) => {
              },
              onCancel: () => {
              },
              onProgress: (current, total) => this.ui.updateProgress(current, total),
              onLoading: (isLoading, total) => this.ui.setLoading(isLoading, total),
              onComplete: () => {
              },
              onError: (err) => this.ui.showError && this.ui.showError(err)
            });
          }
        } catch (error) {
          console.error("初始化失败:", error);
        }
      }
      // 添加等待UI初始化的方法
      async ensureUIReady() {
        if (this.initPromise) {
          await this.initPromise;
        }
        if (!this.ui) {
          throw new Error("UI初始化失败");
        }
      }
      registerRequestHandle(handle) {
        if (!handle || typeof handle.abort !== "function") {
          return () => {
          };
        }
        this.activeRequests.add(handle);
        return () => {
          this.activeRequests.delete(handle);
        };
      }
      abortActiveRequests() {
        for (const handle of Array.from(this.activeRequests)) {
          try {
            handle.abort();
          } catch (error) {
            logger.warn("终止图片请求失败", error);
          }
        }
        this.activeRequests.clear();
      }
      isAbortError(error) {
        return error?.name === "AbortError" || error?.message === "AbortError";
      }
      assertNotAborted() {
        if (this.abortController?.signal.aborted) {
          throw new Error("AbortError");
        }
      }
      updateImageProgress(current, total) {
        gmSetValue("currentImage", current);
        if (typeof total === "number" && total > 0) {
          gmSetValue("totalImages", total);
        }
        if (this.ui?.infoText && total > 0) {
          this.ui.infoText.textContent = `📥 下载中... ${current}/${total}`;
          this.ui.infoText.style.color = "#2196F3";
        }
      }
      updatePdfProgress(current, total) {
        gmSetValue("currentPDFPage", current);
        gmSetValue("totalPDFPages", total);
        if (this.ui?.infoText && total > 0) {
          this.ui.infoText.textContent = `📄 正在生成PDF... ${current}/${total}`;
          this.ui.infoText.style.color = "#FF9800";
        }
      }
      async runWithConcurrency(taskFactories, concurrency) {
        const queue = taskFactories.slice();
        const workers = [];
        const workerCount = Math.min(concurrency, queue.length || 1);
        for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
          workers.push((async () => {
            while (queue.length > 0) {
              this.assertNotAborted();
              const nextTask = queue.shift();
              if (!nextTask) {
                return;
              }
              await nextTask();
            }
          })());
        }
        await Promise.all(workers);
      }
      // 在 ComicDownloader 类中，修改 waitForImagesAndInit 方法：
      async waitForImagesAndInit() {
        const maxAttempts = 12;
        let attempts = 0;
        let imageElements = null;
        console.log("开始等待图片元素加载...");
        const isBatchMode = gmGetValue("autoDownload", false);
        while (attempts < maxAttempts) {
          imageElements = this.adapter.getImageElements();
          const currentCount = imageElements.length;
          console.log(`[等待图片] 第 ${attempts + 1}/${maxAttempts} 次检查,找到 ${currentCount} 张图片`);
          if (isBatchMode && currentCount > 0 && attempts >= 3) {
            const firstImg = imageElements[0];
            const imgUrl = this.adapter.getImageUrl(firstImg);
            if (imgUrl && !imgUrl.includes("loading") && !imgUrl.includes("placeholder")) {
              console.log(`✓ 批量模式:找到 ${currentCount} 张有效图片,开始下载`);
              break;
            } else {
              console.log(`⚠️ 检测到占位图，继续等待... URL: ${imgUrl}`);
            }
          }
          if (!isBatchMode && currentCount > 0 && attempts >= 3) {
            console.log(`✓ 单页模式:图片加载稳定,共 ${currentCount} 张`);
            break;
          }
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        this.totalPages = imageElements.length;
        this.chapterName = this.adapter.getChapterName();
        console.log("图片元素数量:", this.totalPages);
        console.log("章节名称:", this.chapterName);
        if (this.totalPages > 0) {
          console.log(`✓ 找到 ${this.totalPages} 页图片`);
          this.ui = new DownloaderUI(this.totalPages, this.handleDownload.bind(this), this.handleCancel.bind(this));
          if (this.isScrollMode) {
            this.ui.isScrollMode = true;
            this.ui.scrollModeButton.textContent = "切换普通模式";
            this.ui.scrollModeButton.style.backgroundColor = "#4CAF50";
          }
        } else {
          console.log("⚠️ 未找到图片元素");
          this.ui = new DownloaderUI(0, this.handleDownload.bind(this), this.handleCancel.bind(this));
        }
      }
      async handleDownload() {
        await this.ensureUIReady();
        if (this.isDownloading) {
          this.ui.infoText.textContent = "⚠️ 当前正在下载,请稍后再试";
          this.ui.infoText.style.display = "block";
          this.ui.infoText.style.color = "#ff9800";
          setTimeout(() => {
            this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
            this.ui.infoText.style.color = "#4a5568";
          }, 2e3);
          return;
        }
        try {
          this.isDownloading = true;
          this.abortController = new AbortController();
          this.activeRequests.clear();
          this.ui.setLoading(true, true);
          this.pdfMode = this.ui.pdfMode || "longpage";
          updateBatchState({ pdfMode: this.pdfMode });
          resetSessionState({
            sessionId: getBatchState().sessionId || "",
            chapterName: this.chapterName,
            totalImages: this.totalPages,
            phase: DOWNLOAD_PHASE.PENDING
          });
          console.log("开始下载漫画...");
          await this.downloadComic();
          this.ui.infoText.textContent = "✓ 下载完成!";
          this.ui.infoText.style.display = "block";
          this.ui.infoText.style.color = "#4CAF50";
          console.log("✓ 整个下载流程结束");
          setTimeout(() => {
            this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
            this.ui.infoText.style.color = "#4a5568";
          }, 3e3);
        } catch (error) {
          if (this.isAbortError(error)) {
            setSessionPhase(DOWNLOAD_PHASE.CANCELLED);
            console.log("下载已被用户取消");
            this.ui.infoText.textContent = "下载已取消";
            this.ui.infoText.style.display = "block";
            this.ui.infoText.style.color = "#ff9800";
            setTimeout(() => {
              this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
              this.ui.infoText.style.color = "#4a5568";
            }, 2e3);
          } else {
            setSessionPhase(DOWNLOAD_PHASE.FAILED, {
              errorMessage: error?.message || "下载失败"
            });
            this.handleError(error, "下载失败");
            this.ui.infoText.textContent = "❌ 下载失败,请重试";
            this.ui.infoText.style.display = "block";
            this.ui.infoText.style.color = "#f44336";
            setTimeout(() => {
              this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
              this.ui.infoText.style.color = "#4a5568";
            }, 3e3);
          }
        } finally {
          this.abortActiveRequests();
          this.isDownloading = false;
          this.abortController = null;
          this.ui.setLoading(false, false);
        }
      }
      handleCancel() {
        if (!this.ui) {
          console.warn("UI还未初始化，无法取消下载");
          return;
        }
        if (this.abortController) {
          console.log("用户点击取消下载");
          this.abortController.abort();
          this.abortActiveRequests();
          setSessionPhase(DOWNLOAD_PHASE.CANCELLED);
          this.isDownloading = false;
          this.ui.setLoading(false, false);
          this.ui.infoText.textContent = "下载已取消";
          this.ui.infoText.style.display = "block";
          this.ui.infoText.style.color = "#ff9800";
          setTimeout(() => {
            this.ui.infoText.textContent = `本章节共 ${this.totalPages} 页`;
            this.ui.infoText.style.color = "#4a5568";
          }, 2e3);
        }
      }
      // 修改 downloadComic 方法
      // 1. 在 downloadComic 中添加状态设置
      async downloadComic() {
        console.log("开始下载漫画...");
        this.ui.infoText.textContent = "📥 下载中...";
        this.ui.infoText.style.display = "block";
        this.ui.infoText.style.color = "#2196F3";
        setSessionPhase(DOWNLOAD_PHASE.DOWNLOADING, {
          chapterName: this.chapterName,
          currentImage: 0,
          totalImages: 0,
          currentPDFPage: 0,
          totalPDFPages: 0,
          errorMessage: ""
        });
        let allImages = [];
        if (this.adapter.hasMultiplePages()) {
          const pageUrls = this.adapter.getPageUrls();
          console.log(`检测到分页章节，共 ${pageUrls.length} 页`);
          const allImageUrls = [];
          for (let i = 0; i < pageUrls.length; i++) {
            const pageUrl = pageUrls[i];
            const pageNum = i + 1;
            console.log(`处理第 ${pageNum}/${pageUrls.length} 分页: ${pageUrl}`);
            try {
              let imageUrls;
              if (pageUrl === window.location.href) {
                console.log(`第 ${pageNum} 页是当前页，直接获取图片URL`);
                const imageElements = this.adapter.getImageElements();
                imageUrls = Array.from(imageElements).map((img) => this.adapter.getImageUrl(img)).filter((url) => url);
              } else {
                console.log(`第 ${pageNum} 页需要后台加载`);
                imageUrls = await this.adapter.fetchImageUrlsFromPage(pageUrl);
              }
              console.log(`✓ 第 ${pageNum} 分页获取到 ${imageUrls.length} 张图片URL`);
              allImageUrls.push(...imageUrls);
            } catch (error) {
              console.error(`第 ${pageNum} 分页处理失败:`, error);
            }
          }
          console.log(`✓ 所有分页URL收集完成，共 ${allImageUrls.length} 张图片`);
          gmSetValue("totalImages", allImageUrls.length);
          allImages = await this.downloadImagesFromUrls(allImageUrls);
        } else {
          allImages = await this.downloadImages(1, this.totalPages);
        }
        console.log("所有图片下载完成，开始生成PDF...");
        setSessionPhase(DOWNLOAD_PHASE.DOWNLOADED, {
          currentImage: allImages.length,
          totalImages: allImages.length
        });
        this.ui.infoText.textContent = "📄 正在生成PDF...";
        this.ui.infoText.style.color = "#FF9800";
        await this.generatePDF(allImages);
      }
      async downloadImagesFromUrls(imageUrls) {
        console.log(`开始下载 ${imageUrls.length} 张图片`);
        gmSetValue("totalImages", imageUrls.length);
        const downloadResults = new Array(imageUrls.length).fill(null);
        let completedCount = 0;
        const tasks = imageUrls.map((imgUrl, index) => async () => {
          this.assertNotAborted();
          const pageNumber = index + 1;
          try {
            downloadResults[index] = await this.downloadImage(imgUrl);
            completedCount += 1;
            this.updateImageProgress(completedCount, imageUrls.length);
            logger.debug(`第 ${pageNumber} 张下载完成`);
          } catch (error) {
            if (this.isAbortError(error)) {
              throw error;
            }
            completedCount += 1;
            this.updateImageProgress(completedCount, imageUrls.length);
            logger.warn(`第 ${pageNumber} 张下载失败，已跳过`, error);
          }
        });
        await this.runWithConcurrency(tasks, this.downloadConcurrency);
        return downloadResults.filter((img) => Boolean(img));
      }
      async downloadImages(start, end) {
        console.log(`开始下载图片 ${start} 到 ${end}`);
        const imageElements = Array.from(this.adapter.getImageElements()).map((element, index) => ({
          element,
          pageNumber: index + 1
        })).filter((item) => item.pageNumber >= start && item.pageNumber <= end);
        gmSetValue("totalImages", imageElements.length);
        const downloadResults = new Array(imageElements.length).fill(null);
        let completedCount = 0;
        const tasks = imageElements.map((item, index) => async () => {
          const imgUrl = this.adapter.getImageUrl(item.element);
          if (!imgUrl) {
            completedCount += 1;
            this.updateImageProgress(completedCount, imageElements.length);
            logger.warn(`第 ${item.pageNumber} 页图片URL无效，已跳过`);
            return;
          }
          try {
            downloadResults[index] = await this.downloadImage(imgUrl);
            completedCount += 1;
            this.updateImageProgress(completedCount, imageElements.length);
          } catch (error) {
            if (this.isAbortError(error)) {
              throw error;
            }
            completedCount += 1;
            this.updateImageProgress(completedCount, imageElements.length);
            logger.warn(`第 ${item.pageNumber} 页下载失败，已跳过`, error);
          }
        });
        await this.runWithConcurrency(tasks, this.downloadConcurrency);
        return downloadResults.filter((img) => Boolean(img));
      }
      downloadImage(imgUrl) {
        return new Promise((resolve, reject) => {
          if (this.abortController?.signal.aborted) {
            reject(new Error("AbortError"));
            return;
          }
          console.log(`开始下载图片: ${imgUrl}`);
          let finished = false;
          const finish = (callback) => (value) => {
            if (finished) {
              return;
            }
            finished = true;
            unregister();
            callback(value);
          };
          const requestHandle = GM_xmlhttpRequest({
            method: "GET",
            url: imgUrl,
            responseType: "blob",
            headers: {
              "Referer": window.location.href,
              "User-Agent": navigator.userAgent
            },
            onload: (response) => {
              if (this.abortController?.signal.aborted) {
                finish(reject)(new Error("AbortError"));
                return;
              }
              if (response.status === 200) {
                this.handleImageResponse(response, finish(resolve), finish(reject));
              } else {
                console.error(`图片下载失败，状态码: ${response.status}`);
                finish(reject)(new Error(`HTTP ${response.status}`));
              }
            },
            onerror: (error) => {
              console.error("图片下载出错:", error);
              finish(reject)(error);
            },
            ontimeout: () => {
              console.error("图片下载超时");
              finish(reject)(new Error("下载超时"));
            },
            timeout: 3e4
            // 30秒超时
          });
          const unregister = this.registerRequestHandle(requestHandle);
        });
      }
      handleImageResponse(response, resolve, reject) {
        try {
          const blob = response.response;
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(blob);
        } catch (error) {
          reject(error);
        }
      }
      async generatePDF(images) {
        console.log("开始生成PDF...");
        this.ui.infoText.textContent = "📄 正在生成PDF...";
        this.ui.infoText.style.display = "block";
        this.ui.infoText.style.color = "#FF9800";
        if (!images.length) {
          throw new Error("没有有效图片可供生成PDF");
        }
        setSessionPhase(DOWNLOAD_PHASE.PDF_GENERATING, {
          currentPDFPage: 0,
          totalPDFPages: 0
        });
        const pdf = new jspdf.jsPDF();
        const sizes = await this.getImageSizes(images);
        const validItems = images.map((imgData, index) => ({
          imgData,
          size: sizes[index],
          index
        })).filter((item) => item.size && item.size.width > 0 && item.size.height > 0);
        if (!validItems.length) {
          throw new Error("没有可用的图片尺寸信息");
        }
        const validImages = validItems.map((item) => item.imgData);
        const validSizes = validItems.map((item) => item.size);
        console.log("获取图片尺寸完成");
        const mode = this.ui.pdfMode || "longpage";
        console.log(`使用模式: ${mode}`);
        if (mode === "scroll") {
          console.log("使用滚动阅读模式生成PDF");
          await this.generateScrollModePDF(pdf, validImages, validSizes);
        } else if (mode === "longpage") {
          console.log("使用长图模式生成PDF");
          await this.generateLongPagePDF(pdf, validImages, validSizes);
        } else {
          console.log("使用翻页模式生成PDF");
          for (let i = 0; i < validImages.length; i++) {
            const added = await this.addImageToPdf(pdf, validImages[i], i, validSizes[i]);
            this.updatePdfProgress(i + 1, validImages.length);
            if (added) {
              console.log(`已添加第 ${i + 1} 页到PDF`);
            }
          }
        }
        console.log("PDF生成完成，准备保存文件");
        this.ui.infoText.textContent = "💾 正在保存...";
        this.ui.infoText.style.color = "#673AB7";
        await this.savePDFWithWait(`${this.chapterName}.pdf`, pdf);
        console.log(`文件保存完成: ${this.chapterName}.pdf`);
        setSessionPhase(DOWNLOAD_PHASE.SAVED, {
          currentPDFPage: getSessionState().totalPDFPages || validImages.length,
          totalPDFPages: getSessionState().totalPDFPages || validImages.length
        });
        console.log("✓ PDF已真正保存，标志已设置");
      }
      // ✅ 新增：确保 PDF 下载完全完成的方法
      async savePDFWithWait(filename, pdf) {
        return new Promise((resolve, reject) => {
          try {
            const pdfBlob = pdf.output("blob");
            const fileSize = pdfBlob.size;
            const blobUrl = URL.createObjectURL(pdfBlob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            link.style.display = "none";
            document.body.appendChild(link);
            console.log(`准备下载PDF: ${filename}, 大小: ${(fileSize / 1024).toFixed(2)}KB`);
            link.click();
            console.log("✓ 已触发浏览器下载");
            let waitTime = 500;
            if (fileSize > 10 * 1024 * 1024) {
              waitTime = 3e3;
            } else if (fileSize > 5 * 1024 * 1024) {
              waitTime = 2e3;
            } else if (fileSize > 1 * 1024 * 1024) {
              waitTime = 1500;
            }
            console.log(`PDF大小: ${(fileSize / 1024).toFixed(2)}KB，等待${waitTime}ms确保下载完成...`);
            setTimeout(() => {
              try {
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
                console.log("✓ 资源清理完成");
              } catch (e) {
                console.error("资源清理出错:", e);
              }
              console.log("✓ PDF保存流程完全结束，返回");
              resolve();
            }, waitTime);
          } catch (error) {
            console.error("PDF保存失败:", error);
            reject(error);
          }
        });
      }
      async generateScrollModePDF(pdf, images, sizes) {
        console.log("开始生成滚动阅读模式PDF...");
        const A4_WIDTH = 210;
        const A4_HEIGHT = 297;
        const validIndices = [];
        for (let i = 0; i < images.length; i++) {
          if (images[i] && images[i] !== "null" && images[i] !== "undefined") {
            validIndices.push(i);
          } else {
            console.warn(`第 ${i + 1} 张图片数据无效，已跳过`);
          }
        }
        if (validIndices.length === 0) {
          throw new Error("没有有效的图片可以生成PDF");
        }
        console.log(`有效图片数量: ${validIndices.length}/${images.length}`);
        pdf.deletePage(1);
        let currentPageImages = [];
        let currentPageHeight = 0;
        let totalPDFPages = 0;
        let processedImages = 0;
        for (let i = 0; i < validIndices.length; i++) {
          const idx = validIndices[i];
          const scaleFactor = A4_WIDTH / sizes[idx].width;
          const scaledHeight = sizes[idx].height * scaleFactor;
          if (currentPageHeight + scaledHeight > A4_HEIGHT && currentPageImages.length > 0) {
            totalPDFPages++;
            await this.addScrollPageToPDF(pdf, currentPageImages, A4_WIDTH, currentPageHeight);
            processedImages += currentPageImages.length;
            gmSetValue("currentPDFPage", processedImages);
            gmSetValue("totalPDFPages", validIndices.length);
            this.ui.infoText.textContent = `📄 正在生成PDF... ${processedImages}/${validIndices.length}`;
            console.log(`✓ 已生成第 ${totalPDFPages} 页PDF (包含 ${currentPageImages.length} 张图片)`);
            currentPageImages = [];
            currentPageHeight = 0;
          }
          currentPageImages.push({
            data: images[idx],
            width: A4_WIDTH,
            height: scaledHeight,
            index: idx
          });
          currentPageHeight += scaledHeight;
        }
        if (currentPageImages.length > 0) {
          totalPDFPages++;
          await this.addScrollPageToPDF(pdf, currentPageImages, A4_WIDTH, currentPageHeight);
          processedImages += currentPageImages.length;
          gmSetValue("currentPDFPage", processedImages);
          gmSetValue("totalPDFPages", validIndices.length);
          console.log(`✓ 已生成第 ${totalPDFPages} 页PDF (包含 ${currentPageImages.length} 张图片)`);
        }
        console.log(`✓ 滚动阅读模式PDF生成完成，共 ${totalPDFPages} 页`);
      }
      async addScrollPageToPDF(pdf, pageImages, pageWidth, pageHeight) {
        pdf.addPage([pageWidth, pageHeight], "portrait");
        let currentY = 0;
        for (let i = 0; i < pageImages.length; i++) {
          const imgData = pageImages[i];
          await new Promise((resolve, reject) => {
            const img = new Image();
            let isResolved = false;
            const cleanup = () => {
              img.onload = null;
              img.onerror = null;
              img.src = "";
            };
            img.onload = () => {
              if (isResolved) return;
              isResolved = true;
              try {
                pdf.addImage(
                  imgData.data,
                  "JPEG",
                  0,
                  currentY,
                  imgData.width,
                  imgData.height,
                  `image${imgData.index}`,
                  "FAST"
                );
                currentY += imgData.height;
                cleanup();
                setTimeout(resolve, 10);
              } catch (error) {
                console.error(`添加第 ${imgData.index + 1} 张图片失败:`, error);
                cleanup();
                reject(error);
              }
            };
            img.onerror = () => {
              if (isResolved) return;
              isResolved = true;
              console.warn(`第 ${imgData.index + 1} 张图片加载失败`);
              cleanup();
              resolve();
            };
            setTimeout(() => {
              if (!isResolved) {
                isResolved = true;
                console.warn(`第 ${imgData.index + 1} 张图片加载超时`);
                cleanup();
                resolve();
              }
            }, 5e3);
            img.src = imgData.data;
          });
        }
      }
      async getImageSizes(images) {
        return Promise.all(images.map((imgData, index) => {
          return new Promise((resolve) => {
            const img = new Image();
            let settled = false;
            const cleanup = () => {
              img.onload = null;
              img.onerror = null;
              img.src = "";
            };
            const finish = (value) => {
              if (settled) {
                return;
              }
              settled = true;
              cleanup();
              resolve(value);
            };
            img.onload = () => finish({ width: img.width, height: img.height });
            img.onerror = () => {
              logger.warn(`第 ${index + 1} 张图片尺寸探测失败，已跳过`);
              finish(null);
            };
            setTimeout(() => {
              logger.warn(`第 ${index + 1} 张图片尺寸探测超时，已跳过`);
              finish(null);
            }, 1e4);
            img.src = imgData;
          });
        }));
      }
      async addImageToPdf(pdf, imgData, index, size) {
        return new Promise((resolve) => {
          const img = new Image();
          let settled = false;
          const cleanup = () => {
            img.onload = null;
            img.onerror = null;
            img.src = "";
          };
          const finish = (result) => {
            if (settled) {
              return;
            }
            settled = true;
            cleanup();
            resolve(result);
          };
          img.onload = () => {
            if (index > 0) {
              pdf.addPage();
            }
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
            try {
              pdf.addImage(imgData, "JPEG", 0, 0, finalWidth, finalHeight);
              console.log(`已添加第 ${index + 1} 页到PDF，尺寸: ${finalWidth}x${finalHeight}`);
              finish(true);
            } catch (error) {
              logger.warn(`第 ${index + 1} 页写入PDF失败，已跳过`, error);
              finish(false);
            }
          };
          img.onerror = () => {
            logger.warn(`第 ${index + 1} 页图片写入前加载失败，已跳过`);
            finish(false);
          };
          setTimeout(() => {
            logger.warn(`第 ${index + 1} 页图片写入前加载超时，已跳过`);
            finish(false);
          }, 1e4);
          img.src = imgData;
        });
      }
      // 新增：长图模式PDF生成
      async generateLongPagePDF(pdf, images, sizes) {
        console.log("开始生成长图PDF（分页模式）...");
        const A4_width = 210;
        const MAX_PAGE_HEIGHT = 5e3;
        const validIndices = [];
        for (let i = 0; i < images.length; i++) {
          if (images[i] && images[i] !== "null" && images[i] !== "undefined") {
            validIndices.push(i);
          } else {
            console.warn(`第 ${i + 1} 张图片数据无效，已跳过`);
          }
        }
        if (validIndices.length === 0) {
          throw new Error("没有有效的图片可以生成PDF");
        }
        console.log(`有效图片数量: ${validIndices.length}/${images.length}`);
        const pages = [];
        let currentPage = {
          images: [],
          indices: [],
          totalHeight: 0
        };
        for (const idx of validIndices) {
          const scaleFactor = A4_width / sizes[idx].width;
          const scaledHeight = sizes[idx].height * scaleFactor;
          if (currentPage.totalHeight + scaledHeight >= MAX_PAGE_HEIGHT && currentPage.images.length > 0) {
            pages.push(currentPage);
            console.log(`页面 ${pages.length}: 包含 ${currentPage.images.length} 张图片，总高度 ${currentPage.totalHeight.toFixed(2)}mm`);
            currentPage = {
              images: [],
              indices: [],
              totalHeight: 0
            };
          }
          currentPage.images.push(images[idx]);
          currentPage.indices.push(idx);
          currentPage.totalHeight += scaledHeight;
          if (currentPage.totalHeight >= MAX_PAGE_HEIGHT && validIndices.indexOf(idx) < validIndices.length - 1) {
            if (currentPage.images.length > 1) {
              const lastImg = currentPage.images.pop();
              const lastIdx = currentPage.indices.pop();
              currentPage.totalHeight -= scaledHeight;
              pages.push(currentPage);
              console.log(`页面 ${pages.length}: 包含 ${currentPage.images.length} 张图片，总高度 ${currentPage.totalHeight.toFixed(2)}mm`);
              currentPage = {
                images: [lastImg],
                indices: [lastIdx],
                totalHeight: scaledHeight
              };
            }
          }
        }
        if (currentPage.images.length > 0) {
          pages.push(currentPage);
          console.log(`页面 ${pages.length}: 包含 ${currentPage.images.length} 张图片，总高度 ${currentPage.totalHeight.toFixed(2)}mm`);
        }
        console.log(`总共分为 ${pages.length} 页`);
        pdf.deletePage(1);
        let totalProcessed = 0;
        for (let pageNum = 0; pageNum < pages.length; pageNum++) {
          const page = pages[pageNum];
          console.log(`开始处理第 ${pageNum + 1}/${pages.length} 页PDF...`);
          const safePageHeight = Math.min(page.totalHeight, 14e3);
          if (page.totalHeight > 14e3) {
            console.warn(`警告：第 ${pageNum + 1} 页高度 ${page.totalHeight.toFixed(2)}mm 超过限制，已截断为 14000mm`);
          }
          pdf.addPage([A4_width, safePageHeight], "portrait");
          let currentY = 0;
          for (let i = 0; i < page.images.length; i++) {
            const imgIdx = page.indices[i];
            const imgData = page.images[i];
            await new Promise((resolve, reject) => {
              const img = new Image();
              let isResolved = false;
              const cleanup = () => {
                img.onload = null;
                img.onerror = null;
              };
              img.onload = () => {
                if (isResolved) return;
                isResolved = true;
                try {
                  const scaleFactor = A4_width / sizes[imgIdx].width;
                  const scaledHeight = sizes[imgIdx].height * scaleFactor;
                  pdf.addImage(imgData, "JPEG", 0, currentY, A4_width, scaledHeight, `longimg${imgIdx}`, "FAST");
                  currentY += scaledHeight;
                  console.log(`长图模式：已添加第 ${imgIdx + 1} 张图片到第 ${pageNum + 1} 页，当前Y坐标: ${currentY.toFixed(2)}mm`);
                  cleanup();
                  setTimeout(resolve, 10);
                } catch (error) {
                  console.error(`添加第 ${imgIdx + 1} 张图片失败:`, error);
                  cleanup();
                  reject(error);
                }
              };
              img.onerror = () => {
                if (isResolved) return;
                isResolved = true;
                console.error(`第 ${imgIdx + 1} 张图片加载失败，跳过该图片`);
                cleanup();
                resolve();
              };
              setTimeout(() => {
                if (!isResolved) {
                  isResolved = true;
                  console.error(`第 ${imgIdx + 1} 张图片加载超时，跳过该图片`);
                  cleanup();
                  resolve();
                }
              }, 1e4);
              img.src = imgData;
            });
            totalProcessed++;
            const pdfProgress = totalProcessed;
            const totalImages = validIndices.length;
            gmSetValue("currentPDFPage", pdfProgress);
            gmSetValue("totalPDFPages", totalImages);
            if (this.ui && this.ui.infoText) {
              this.ui.infoText.textContent = `📄 正在生成PDF... ${pdfProgress}/${totalImages}`;
            }
          }
          console.log(`第 ${pageNum + 1}/${pages.length} 页PDF处理完成，最终高度: ${currentY.toFixed(2)}mm`);
          if (pageNum < pages.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
        console.log("所有页面处理完成");
      }
      handleError(error, message = "下载失败") {
        console.error(message, error);
      }
      beginBatchChapterSession({ sessionId, chapterName, chapterIndex, chapterCount, pdfMode }) {
        updateBatchState({
          enabled: true,
          autoDownload: true,
          cancelRequested: false,
          sessionId,
          pdfMode
        });
        resetSessionState({
          sessionId,
          phase: DOWNLOAD_PHASE.PENDING,
          chapterName,
          chapterIndex,
          chapterCount,
          currentImage: 0,
          totalImages: 0,
          currentPDFPage: 0,
          totalPDFPages: 0,
          errorMessage: ""
        });
      }
      clearBatchSessionState() {
        updateBatchState({
          autoDownload: false,
          sessionId: "",
          cancelRequested: false
        });
        resetSessionState();
      }
      async waitForBatchChapterResult({ chapterIndex, chapterCount, chapterName }) {
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const hardTimeoutMs = 10 * 60 * 1e3;
          const pollInterval = 500;
          let lastImage = -1;
          let lastPdf = -1;
          const timer = setInterval(() => {
            try {
              const batchState = getBatchState();
              const sessionState = getSessionState();
              if (batchState.cancelRequested) {
                clearInterval(timer);
                reject(new Error("用户取消下载"));
                return;
              }
              if (sessionState.currentImage !== lastImage || sessionState.currentPDFPage !== lastPdf) {
                lastImage = sessionState.currentImage;
                lastPdf = sessionState.currentPDFPage;
                this.ui.updateProgress(
                  chapterIndex,
                  chapterCount,
                  chapterName,
                  sessionState.currentImage,
                  sessionState.totalImages
                );
              }
              if (sessionState.phase === DOWNLOAD_PHASE.SAVED) {
                clearInterval(timer);
                resolve(sessionState);
                return;
              }
              if (sessionState.phase === DOWNLOAD_PHASE.FAILED) {
                clearInterval(timer);
                reject(new Error(sessionState.errorMessage || "章节下载失败"));
                return;
              }
              if (sessionState.phase === DOWNLOAD_PHASE.CANCELLED) {
                clearInterval(timer);
                reject(new Error("用户取消下载"));
                return;
              }
              if (Date.now() - startTime > hardTimeoutMs) {
                clearInterval(timer);
                reject(new Error("紧急超时"));
              }
            } catch (error) {
              clearInterval(timer);
              reject(error);
            }
          }, pollInterval);
        });
      }
      // 添加处理选中章节下载的方法
      async handleDownloadSelected() {
        console.log("开始处理选中章节下载...");
        const selectedChapters = this.ui.selectedChapters;
        if (selectedChapters.size === 0) {
          console.log("未选择任何章节");
          this.ui.selectButton.textContent = "⚠️ 请选择至少一个章节";
          this.ui.selectButton.style.backgroundColor = "#ff9800";
          setTimeout(() => {
            this.ui.selectButton.textContent = "选择章节下载";
            this.ui.selectButton.style.backgroundColor = "#4CAF50";
          }, 2e3);
          return;
        }
        try {
          const chapterLinks = await this.adapter.getChapterLinks();
          const selectedChapterUrls = Array.from(selectedChapters).map((index) => chapterLinks[index].url);
          const chapterCount = selectedChapterUrls.length;
          console.log(`准备批量下载 ${chapterCount} 个章节`);
          updateBatchState({
            enabled: true,
            autoDownload: false,
            cancelRequested: false
          });
          this.ui.setLoading(true, chapterCount);
          const pdfMode = this.ui.pdfMode || "longpage";
          const batchSessionId = Date.now().toString();
          gmSetValue("pdfMode", pdfMode);
          console.log(`设置PDF模式: ${pdfMode}`);
          console.log(`创建批量下载会话: ${batchSessionId}`);
          const failedChapters = [];
          const cancelledChapters = [];
          let currentTab = null;
          for (let i = 0; i < selectedChapterUrls.length; i++) {
            if (getBatchState().cancelRequested) {
              console.log("检测到取消标志，停止批量下载");
              cancelledChapters.push(...selectedChapterUrls.slice(i).map((url2, idx) => {
                return chapterLinks[Array.from(selectedChapters)[i + idx]].name;
              }));
              if (currentTab) {
                console.log("关闭当前标签页...");
                try {
                  currentTab.close();
                  console.log("标签页已关闭");
                } catch (e) {
                  console.log("标签页关闭失败:", e);
                }
                currentTab = null;
              }
              break;
            }
            const url = selectedChapterUrls[i];
            const chapterName = chapterLinks[Array.from(selectedChapters)[i]].name;
            console.log(`准备下载第 ${i + 1}/${chapterCount} 个章节: ${chapterName}`);
            this.ui.updateProgress(i, chapterCount, chapterName, 0, 0);
            try {
              const sessionId = `${batchSessionId}_${i}`;
              this.beginBatchChapterSession({
                sessionId,
                chapterName,
                chapterIndex: i + 1,
                chapterCount,
                pdfMode
              });
              console.log(`设置下载状态为: pending，会话ID: ${sessionId}`);
              if (currentTab) {
                try {
                  currentTab.close();
                  console.log("已关闭上个标签页");
                } catch (e) {
                  console.log("上个标签页关闭失败:", e);
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
              currentTab = GM_openInTab(url, {
                active: false,
                insert: true,
                setParent: true
              });
              console.log(`已打开标签页: ${url}`);
              await this.waitForBatchChapterResult({
                chapterIndex: i + 1,
                chapterCount,
                chapterName
              });
              this.ui.updateProgress(i + 1, chapterCount);
              if (i < chapterCount - 1) {
                console.log(`等待2秒后下载下一个章节...`);
                await new Promise((resolve) => setTimeout(resolve, 2e3));
              }
            } catch (error) {
              if (error.message === "用户取消下载") {
                console.log("用户取消下载,跳出循环");
                cancelledChapters.push(chapterName);
                break;
              }
              console.error(`✗ 第 ${i + 1} 个章节下载失败: ${chapterName}`, error);
              failedChapters.push(chapterName);
              await new Promise((resolve) => setTimeout(resolve, 500));
            } finally {
              this.clearBatchSessionState();
            }
          }
          if (currentTab) {
            console.log("关闭最后一个标签页...");
            try {
              currentTab.close();
              console.log("最后一个标签页已关闭");
            } catch (e) {
              console.log("最后一个标签页关闭失败:", e);
            }
          }
          updateBatchState({
            enabled: false,
            autoDownload: false,
            sessionId: "",
            cancelRequested: false
          });
          resetSessionState();
          this.ui.setLoading(false);
          console.log("批量下载流程结束");
          const successCount = chapterCount - failedChapters.length - cancelledChapters.length;
          if (cancelledChapters.length > 0) {
            this.ui.selectButton.textContent = `⏸️ 已取消 (完成${successCount}/${chapterCount})`;
            this.ui.selectButton.style.backgroundColor = "#ff9800";
            console.log(`批量下载已取消
✓ 已完成: ${successCount}个
✗ 失败: ${failedChapters.length}个
⊗ 已取消: ${cancelledChapters.length}个`);
            if (failedChapters.length > 0) {
              console.warn("失败章节:", failedChapters.join(", "));
            }
          } else if (failedChapters.length === 0) {
            this.ui.selectButton.textContent = `🎉 全部完成! (${chapterCount}个章节)`;
            this.ui.selectButton.style.backgroundColor = "#4CAF50";
            console.log(`✓ 批量下载全部完成! 共${chapterCount}个章节`);
          } else {
            this.ui.selectButton.textContent = `⚠️ 部分完成 (${successCount}/${chapterCount})`;
            this.ui.selectButton.style.backgroundColor = "#ff9800";
            console.warn(`下载完成! 成功: ${successCount}个, 失败: ${failedChapters.length}个`);
            console.warn("失败章节:", failedChapters.join(", "));
          }
          this.ui.selectButton.disabled = true;
          setTimeout(() => {
            this.ui.selectButton.textContent = "选择章节下载";
            this.ui.selectButton.style.backgroundColor = "#4CAF50";
            this.ui.selectButton.disabled = false;
          }, 5e3);
        } catch (error) {
          console.error("批量下载失败:", error);
          updateBatchState({
            enabled: false,
            autoDownload: false,
            sessionId: "",
            cancelRequested: false
          });
          resetSessionState();
          this.ui.setLoading(false);
          this.ui.selectButton.textContent = "❌ 下载失败,请重试";
          this.ui.selectButton.style.backgroundColor = "#f44336";
          setTimeout(() => {
            this.ui.selectButton.textContent = "选择章节下载";
            this.ui.selectButton.style.backgroundColor = "#4CAF50";
          }, 3e3);
        }
      }
    }
    function addScrollbarStyles() {
      if (document.getElementById("comic-downloader-scrollbar-styles")) {
        return;
      }
      const styleSheet = document.createElement("style");
      styleSheet.id = "comic-downloader-scrollbar-styles";
      styleSheet.textContent = `
        /* 自定义滚动条样式 */
        .comic-downloader-chapter-list::-webkit-scrollbar {
            width: 8px;
        }
        
        .comic-downloader-chapter-list::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.05);
            border-radius: 4px;
        }
        
        .comic-downloader-chapter-list::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.2);
            border-radius: 4px;
            transition: background 0.2s;
        }
        
        .comic-downloader-chapter-list::-webkit-scrollbar-thumb:hover {
            background: rgba(0,0,0,0.4);
        }
        
        /* Firefox */
        .comic-downloader-chapter-list {
            scrollbar-width: thin;
            scrollbar-color: rgba(0,0,0,0.2) rgba(0,0,0,0.05);
        }
    `;
      document.head.appendChild(styleSheet);
    }
    function initialize() {
      console.log("开始初始化下载器...");
      addScrollbarStyles();
      const isBatchDownload = gmGetValue("isBatchDownload", false);
      const autoDownload = gmGetValue("autoDownload", false);
      if (isBatchDownload && autoDownload) {
        console.log("🚫 批量下载模式：禁用图片加载");
        disableImageLoading();
      }
      try {
        window.comicDownloader = new ComicDownloader();
        const sessionId = gmGetValue("sessionId", "");
        const currentTime = Date.now();
        console.log("自动下载标志:", autoDownload);
        console.log("会话ID:", sessionId);
        if (autoDownload && sessionId && window.comicDownloader.adapter.isChapterPage() && currentTime - parseInt(sessionId.split("_")[0]) < 3e5) {
          console.log("检测到批量下载流程，准备自动下载");
          window.comicDownloader.isScrollMode = gmGetValue("isScrollMode", false);
          window.comicDownloader.ensureUIReady().then(() => {
            setTimeout(async () => {
              try {
                console.log("等待页面初始化完成，开始自动下载...");
                await window.comicDownloader.handleDownload();
                console.log("自动下载完成");
                if (isBatchDownload) {
                  enableImageLoading();
                }
              } catch (error) {
                console.error("自动下载失败:", error);
                if (!window.comicDownloader.isAbortError(error)) {
                  setSessionPhase(DOWNLOAD_PHASE.FAILED, {
                    errorMessage: error?.message || "自动下载失败"
                  });
                }
                if (isBatchDownload) {
                  enableImageLoading();
                }
              }
            }, 2e3);
          }).catch((error) => {
            console.error("UI初始化失败:", error);
            setSessionPhase(DOWNLOAD_PHASE.FAILED, {
              errorMessage: error?.message || "UI初始化失败"
            });
            updateBatchState({
              autoDownload: false
            });
            if (isBatchDownload) {
              enableImageLoading();
            }
          });
        } else {
          if (autoDownload) {
            console.log("清除自动下载标志");
            updateBatchState({
              autoDownload: false,
              sessionId: "",
              enabled: false
            });
          }
        }
        if (window.comicDownloader.ui) {
          console.log("UI已初始化");
          if (window.comicDownloader.adapter.isDirectoryPage()) {
            console.log("当前是目录页面");
            window.comicDownloader.ui.chapterListContainer.style.display = "block";
          }
        } else {
          console.log("等待章节页面UI初始化...");
        }
      } catch (error) {
        console.error("初始化失败:", error);
      }
    }
    if (document.readyState === "complete") {
      console.log("页面已加载完成，立即初始化");
      initialize();
    } else {
      console.log("等待页面加载完成...");
      window.addEventListener("load", () => {
        console.log("页面加载完成，开始初始化");
        initialize();
      });
    }
  })();
})();
