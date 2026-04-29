
// 服务器配置模块
const path = require('path');

// 颜色主题 - 与前端保持一致
const colorThemes = {
    purple: { hue: 240, sat: 70, light: 60 },
    pink: { hue: 320, sat: 80, light: 65 },
    blue: { hue: 200, sat: 90, light: 60 },
    green: { hue: 150, sat: 70, light: 55 },
    warm: { hue: 30, sat: 90, light: 60 },
    white: { hue: 0, sat: 0, light: 95 },
    black: { hue: 0, sat: 0, light: 20 },
    gold: { hue: 45, sat: 100, light: 60 }
};

// 目录路径
const uploadsDir = path.join(__dirname, '../uploads');
const exportsDir = path.join(__dirname, '../exports');
const tempDir = path.join(__dirname, '../temp');
const fontDir = path.join(__dirname, '../font');

module.exports = {
    colorThemes,
    uploadsDir,
    exportsDir,
    tempDir,
    fontDir
};

