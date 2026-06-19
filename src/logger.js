import { BUILD_INFO } from './build-constants.js';

function write(method, args) {
  if (typeof console?.[method] === 'function') {
    console[method]('[ComicDownloader]', ...args);
  }
}

export const logger = {
  debug(...args) {
    if (BUILD_INFO.isDev) {
      write('log', args);
    }
  },
  info(...args) {
    write('log', args);
  },
  warn(...args) {
    write('warn', args);
  },
  error(...args) {
    write('error', args);
  }
};
