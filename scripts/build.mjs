import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const distDir = path.join(rootDir, 'dist');
const requireFromRoot = createRequire(import.meta.url);

async function loadEsbuild() {
  const fallbackPaths = [
    'esbuild',
    'D:/Windows software/Nodejs/node_global/node_modules/vite/node_modules/esbuild/lib/main.js'
  ];

  for (const specifier of fallbackPaths) {
    try {
      const resolved = specifier.endsWith('.js')
        ? pathToFileURL(specifier).href
        : requireFromRoot.resolve(specifier);
      return await import(resolved);
    } catch (error) {
      // Try the next candidate.
    }
  }

  throw new Error('Unable to locate esbuild. Install it locally or provide an accessible fallback path.');
}

const target = process.argv[2] || 'prod';
const args = new Set(process.argv.slice(3));
const isWatch = args.has('--watch');
const isCheck = args.has('--check');
const isDev = target === 'dev';

if (!['prod', 'dev'].includes(target)) {
  throw new Error(`Unknown build target: ${target}`);
}

const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
const version = packageJson.version;
const { build, context } = await loadEsbuild();

const metadata = {
  name: isDev ? '网页漫画下载为pdf格式 [dev]' : '网页漫画下载为pdf格式',
  namespace: 'http://tampermonkey.net/',
  version: isDev ? `${version}-dev` : version,
  description: '将网页漫画下载为pdf方便阅读，目前仅适用于如漫画(http://www.rumanhua1.com/)、漫蛙库(https://manwaku.cc/)等漫画网站',
  author: 'MornLight',
  matches: [
    'http://m.rumanhua1.com/*',
    'http://m.rumanhua2.com/*',
    'http://www.rumanhua1.com/*',
    'http://www.rumanhua2.com/*',
    'https://www.rumanhua.org/*',
    'https://m.rumanhua.org/*',
    'https://mangapark.net/*',
    'https://www.mwdd.cc/*',
    'https://www.mwhh.cc/*',
    'https://www.mhtmh.org/*',
    'https://www.mwai.cc/*',
    'https://www.mwku.cc/*',
    'https://www.mwrr.cc/*',
    'https://www.manwaku.com/*',
    'https://www.mwbu.cc/*',
    'https://www.mwdu.cc/*'
  ],
  icon: 'https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org',
  grants: ['GM_xmlhttpRequest', 'GM_openInTab', 'GM_setValue', 'GM_getValue'],
  connect: ['*'],
  require: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'],
  runAt: 'document-end',
  license: 'MIT',
  supportURL: 'https://github.com/duanmorningsir/ComicDownloader'
};

function buildBanner(meta) {
  const lines = [
    '// ==UserScript==',
    `// @name         ${meta.name}`,
    `// @namespace    ${meta.namespace}`,
    `// @version      ${meta.version}`,
    `// @description  ${meta.description}`,
    `// @author       ${meta.author}`,
    ...meta.matches.map((item) => `// @match        ${item}`),
    `// @icon         ${meta.icon}`,
    ...meta.grants.map((item) => `// @grant        ${item}`),
    ...meta.connect.map((item) => `// @connect      ${item}`),
    ...meta.require.map((item) => `// @require      ${item}`),
    `// @run-at       ${meta.runAt}`,
    `// @license      ${meta.license}`,
    `// @supportURL   ${meta.supportURL}`,
    '// ==/UserScript=='
  ];

  return `${lines.join('\n')}\n\n`;
}

async function ensureDist() {
  await fs.mkdir(distDir, { recursive: true });
}

const outfile = path.join(distDir, isDev ? 'comic-downloader.dev.user.js' : 'comic-downloader.user.js');

const options = {
  entryPoints: [path.join(rootDir, 'src', 'index.js')],
  outfile,
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  charset: 'utf8',
  banner: {
    js: `${buildBanner(metadata)}window.__COMIC_DOWNLOADER_BUILD__ = ${JSON.stringify({
      target,
      isDev,
      version: metadata.version
    })};`
  },
  define: {
    __DEV__: JSON.stringify(isDev),
    __VERSION__: JSON.stringify(metadata.version),
    __BUILD_TARGET__: JSON.stringify(target)
  },
  logLevel: 'info'
};

await ensureDist();

if (isCheck) {
  await build({ ...options, write: false });
  console.log(`[check] ${target} build passed`);
} else if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log(`[watch] ${target} -> ${outfile}`);
} else {
  await build(options);
  console.log(`[build] ${target} -> ${outfile}`);
}
