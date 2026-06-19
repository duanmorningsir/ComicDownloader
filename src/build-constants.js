export const BUILD_INFO = {
  target: typeof __BUILD_TARGET__ !== 'undefined' ? __BUILD_TARGET__ : 'prod',
  version: typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0',
  isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : false
};
