
// 服务器端字幕处理模块
const fs = require('fs');
const path = require('path');
const { registerFont } = require('canvas');
const { fontDir } = require('./config');

// 解析 SRT 字幕
function parseSRT(content) {
    const subtitles = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length < 3) continue;

        const indexLine = lines[0].trim();
        const timeLine = lines[1].trim();
        const textLines = lines.slice(2);

        const index = parseInt(indexLine);
        if (isNaN(index)) continue;

        const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
        if (!timeMatch) continue;

        const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
        const text = textLines.join('\n').replace(/<[^>]+>/g, '').trim();

        subtitles.push({ index, startTime, endTime, text });
    }

    return subtitles.sort((a, b) => a.startTime - b.startTime);
}

// 获取当前字幕
function getCurrentSubtitleServer(currentTime, subtitles) {
    if (!subtitles || subtitles.length === 0) return null;

    for (let i = 0; i < subtitles.length; i++) {
        const sub = subtitles[i];
        if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
            const prevSub = i > 0 ? subtitles[i - 1] : null;
            const nextSub = i < subtitles.length - 1 ? subtitles[i + 1] : null;
            return { current: sub, prev: prevSub, next: nextSub, index: i };
        }
    }
    return null;
}

// 注册字幕字体
function registerSubtitleFont(subtitleSettings) {
    if (!subtitleSettings || !subtitleSettings.fontFamily) return null;

    const fontFamily = subtitleSettings.fontFamily;
    const isCustomFont = fontFamily.endsWith('.ttf') || fontFamily.endsWith('.otf');

    if (isCustomFont) {
        try {
            const fontPath = path.join(fontDir, fontFamily);
            if (fs.existsSync(fontPath)) {
                const registeredName = fontFamily.replace('.ttf', '').replace('.otf', '');
                registerFont(fontPath, { family: registeredName });
                console.log(`✅ 字幕字体注册成功: ${fontFamily}`);
                return registeredName;
            }
        } catch (err) {
            console.warn(`⚠️ 字幕字体注册失败:`, err.message);
        }
    }
    return fontFamily;
}

// 绘制字幕文本
function drawServerSubtitleText(ctx, text, x, y, fontSize, color, strokeColor, strokeWidth, fontFamily) {
    if (strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

// 绘制滚动字幕
function drawServerScrollingSubtitles(ctx, subData, x, y, fontSize, color, strokeColor, strokeWidth, fontFamily) {
    const lineHeight = fontSize * 1.5;
    const startY = y - lineHeight;

    ctx.globalAlpha = 0.5;
    if (subData.prev) {
        drawServerSubtitleText(ctx, subData.prev.text, x, startY, fontSize * 0.8, color, strokeColor, strokeWidth, fontFamily);
    }

    ctx.globalAlpha = 1.0;
    drawServerSubtitleText(ctx, '▶ ' + subData.current.text, x, startY + lineHeight, fontSize, color, strokeColor, strokeWidth, fontFamily);

    ctx.globalAlpha = 0.5;
    if (subData.next) {
        drawServerSubtitleText(ctx, subData.next.text, x, startY + lineHeight * 2, fontSize * 0.8, color, strokeColor, strokeWidth, fontFamily);
    }

    ctx.globalAlpha = 1.0;
}

// 绘制淡入字幕
function drawServerFadeinSubtitles(ctx, subData, x, y, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const chars = subData.current.text.split('');
    const visibleChars = Math.floor(chars.length * progress);

    ctx.globalAlpha = 0.3 + progress * 0.7;
    const text = chars.slice(0, visibleChars).join('');
    drawServerSubtitleText(ctx, text, x, y, fontSize, color, strokeColor, strokeWidth, fontFamily);
    ctx.globalAlpha = 1.0;
}

// 绘制卡拉OK字幕
function drawServerKaraokeSubtitles(ctx, subData, x, y, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const text = subData.current.text;
    const chars = text.split('');
    const highlightIndex = Math.floor(chars.length * progress);

    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let offsetX = -ctx.measureText(text).width / 2;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const charWidth = ctx.measureText(char).width;

        if (i < highlightIndex) {
            ctx.fillStyle = '#ffdd00';
            if (strokeWidth > 0) {
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = strokeWidth * 2;
                ctx.strokeText(char, x + offsetX + charWidth / 2, y);
            }
            ctx.fillText(char, x + offsetX + charWidth / 2, y);
        } else {
            ctx.fillStyle = color;
            if (strokeWidth > 0) {
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth * 2;
                ctx.strokeText(char, x + offsetX + charWidth / 2, y);
            }
            ctx.fillText(char, x + offsetX + charWidth / 2, y);
        }

        offsetX += charWidth;
    }
}

// 绘制弹出字幕
function drawServerPopSubtitles(ctx, subData, x, y, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    let scale = 1;
    let alpha = 1;

    if (progress < 0.1) {
        scale = 0.5 + progress * 5;
        alpha = progress * 10;
    } else if (progress > 0.8) {
        alpha = (1 - progress) * 5;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const text = subData.current.text;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0);
    }

    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);

    ctx.restore();
}

// 绘制打字机字幕
function drawServerTypewriterSubtitles(ctx, subData, x, y, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const chars = subData.current.text.split('');
    const visibleChars = Math.floor(chars.length * progress);
    let text = chars.slice(0, visibleChars).join('');

    if (visibleChars < chars.length && Math.floor(currentTime * 10) % 2 === 0) {
        text += '▌';
    }

    drawServerSubtitleText(ctx, text, x, y, fontSize, color, strokeColor, strokeWidth, fontFamily);
}

// 主字幕绘制函数
function drawServerSubtitles(ctx, width, height, currentTime, subtitleSettings, subtitles) {
    const subData = getCurrentSubtitleServer(currentTime, subtitles);
    if (!subData) return;

    const fontSize = subtitleSettings.fontSize || 36;
    const posX = width * (subtitleSettings.position?.x || 0.5);
    const posY = height * (subtitleSettings.position?.y || 0.85);
    const color = subtitleSettings.color || '#ffffff';
    const strokeColor = subtitleSettings.strokeColor || '#000000';
    const strokeWidth = subtitleSettings.strokeWidth || 2;
    const effect = subtitleSettings.effect || 'scrolling';
    const fontFamily = subtitleSettings.fontFamily?.replace('.ttf', '').replace('.otf', '') || 'sans-serif';

    ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (effect) {
        case 'scrolling':
            drawServerScrollingSubtitles(ctx, subData, posX, posY, fontSize, color, strokeColor, strokeWidth, fontFamily);
            break;
        case 'fadein':
            drawServerFadeinSubtitles(ctx, subData, posX, posY, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily);
            break;
        case 'karaoke':
            drawServerKaraokeSubtitles(ctx, subData, posX, posY, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily);
            break;
        case 'pop':
            drawServerPopSubtitles(ctx, subData, posX, posY, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily);
            break;
        case 'typewriter':
            drawServerTypewriterSubtitles(ctx, subData, posX, posY, fontSize, currentTime, color, strokeColor, strokeWidth, fontFamily);
            break;
        default:
            drawServerScrollingSubtitles(ctx, subData, posX, posY, fontSize, color, strokeColor, strokeWidth, fontFamily);
    }
}

module.exports = {
    parseSRT,
    getCurrentSubtitleServer,
    registerSubtitleFont,
    drawServerSubtitles
};

