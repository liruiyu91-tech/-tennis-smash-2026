// 由 tools/import-art.js 生成：已接入游戏的美术图片（assets/art/*.webp）。没有的图用程序生成的默认图。
const ART = new Set([]);
const artUrl = name => ART.has(name) ? `assets/art/${name}.webp` : null;
