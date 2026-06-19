const STORAGE_KEY = 'comicDownloaderRuntimeState';

export const DOWNLOAD_PHASE = Object.freeze({
  IDLE: 'idle',
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  DOWNLOADED: 'downloaded',
  PDF_GENERATING: 'pdf_generating',
  SAVED: 'saved',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

function createDefaultState() {
  return {
    version: 1,
    batch: {
      enabled: false,
      autoDownload: false,
      cancelRequested: false,
      sessionId: '',
      pdfMode: 'longpage'
    },
    session: {
      sessionId: '',
      phase: DOWNLOAD_PHASE.IDLE,
      chapterName: '',
      chapterIndex: 0,
      chapterCount: 0,
      currentImage: 0,
      totalImages: 0,
      currentPDFPage: 0,
      totalPDFPages: 0,
      errorMessage: '',
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
      ...(incoming?.batch || {})
    },
    session: {
      ...base.session,
      ...(incoming?.session || {})
    }
  };
}

export function readRuntimeState() {
  const defaults = createDefaultState();
  const stored = GM_getValue(STORAGE_KEY, null);
  if (!stored || typeof stored !== 'object') {
    return defaults;
  }
  return mergeState(defaults, stored);
}

export function ensureRuntimeState() {
  const stored = GM_getValue(STORAGE_KEY, null);
  if (!stored || typeof stored !== 'object') {
    const defaults = createDefaultState();
    GM_setValue(STORAGE_KEY, defaults);
    return defaults;
  }
  const next = mergeState(createDefaultState(), stored);
  GM_setValue(STORAGE_KEY, next);
  return next;
}

export function writeRuntimeState(updater) {
  const current = readRuntimeState();
  const next = typeof updater === 'function' ? updater(clone(current)) : mergeState(current, updater);
  GM_setValue(STORAGE_KEY, next);
  return next;
}

export function updateBatchState(patch) {
  return writeRuntimeState((state) => {
    state.batch = {
      ...state.batch,
      ...patch
    };
    state.session.updatedAt = Date.now();
    return state;
  });
}

export function updateSessionState(patch) {
  return writeRuntimeState((state) => {
    state.session = {
      ...state.session,
      ...patch,
      updatedAt: Date.now()
    };
    return state;
  });
}

export function setSessionPhase(phase, patch = {}) {
  return updateSessionState({
    ...patch,
    phase
  });
}

export function resetSessionState(extraSession = {}) {
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

export function resetRuntimeState() {
  const next = createDefaultState();
  GM_setValue(STORAGE_KEY, next);
  return next;
}

export function getBatchState() {
  return readRuntimeState().batch;
}

export function getSessionState() {
  return readRuntimeState().session;
}

export function createDebugSnapshot() {
  const state = readRuntimeState();
  return Object.freeze({
    batch: { ...state.batch },
    session: { ...state.session }
  });
}
