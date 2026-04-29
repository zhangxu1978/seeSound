// 文字层处理模块

async function loadTextLayerFont(fontFamily) {
    if (seesound.loadedFonts.has(fontFamily)) {
        return;
    }

    try {
        const fontPath = `/font/${fontFamily}`;
        const font = new FontFace('textlayer-font', `url(${fontPath})`);
        await font.load();
        document.fonts.add(font);
        seesound.loadedFonts.add(fontFamily);
        console.log(`文字层字体加载成功: ${fontFamily}`);
    } catch (err) {
        console.warn(`文字层字体加载失败: ${fontFamily}`, err);
    }
}

function isCustomFont(fontFamily) {
    return fontFamily.endsWith('.ttf') || fontFamily.endsWith('.otf');
}

function getTextLayerFontFamily() {
    const fontFamily = seesound.textLayerSettings.fontFamily;
    if (!fontFamily) return 'Microsoft YaHei';

    if (isCustomFont(fontFamily)) {
        return seesound.loadedFonts.has(fontFamily) ? 'textlayer-font' : 'Microsoft YaHei';
    }

    return fontFamily;
}

// 绘制文字层
function drawTextLayer() {
    const ctx = seesound.textLayerCtx;
    const w = seesound.textLayerCanvas.width;
    const h = seesound.textLayerCanvas.height;
    
    if (!ctx || !w || !h) return;
    
    ctx.clearRect(0, 0, w, h);
    
    const settings = seesound.textLayerSettings;
    
    if (!settings.text || settings.text.trim() === '') return;

    const fontFamily = getTextLayerFontFamily();
    ctx.font = `${settings.fontSize}px "${fontFamily}", sans-serif`;
    ctx.fillStyle = settings.color;
    ctx.strokeStyle = settings.strokeColor;
    ctx.lineWidth = settings.strokeWidth;
    ctx.lineJoin = 'round';
    
    const lines = settings.text.split('\n');
    const lineHeight = settings.fontSize * 1.5;
    const totalHeight = lines.length * lineHeight;
    
    let x, startY;
    
    switch (settings.align) {
        case 'left':
            x = 20;
            ctx.textAlign = 'left';
            startY = (h - totalHeight) / 2 + settings.fontSize;
            break;
        case 'right':
            x = w - 20;
            ctx.textAlign = 'right';
            startY = (h - totalHeight) / 2 + settings.fontSize;
            break;
        case 'center':
        default:
            x = w / 2;
            ctx.textAlign = 'center';
            startY = (h - totalHeight) / 2 + settings.fontSize;
            break;
    }
    
    lines.forEach((line, index) => {
        const y = startY + index * lineHeight;
        if (settings.strokeWidth > 0) {
            ctx.strokeText(line, x, y);
        }
        ctx.fillText(line, x, y);
    });
}

// 更新文字层画布大小
function updateTextLayerSize(width, height) {
    if (seesound.textLayerCanvas) {
        seesound.textLayerCanvas.width = width;
        seesound.textLayerCanvas.height = height;
    }
}

// 更新字幕层画布大小
function updateSubtitleLayerSize(width, height) {
    if (seesound.subtitleCanvas) {
        seesound.subtitleCanvas.width = width;
        seesound.subtitleCanvas.height = height;
    }
}

// 更新所有层的画布大小
function updateAllLayerSizes() {
    if (!seesound.videoCanvas) return;
    
    const videoWidth = seesound.videoCanvas.width;
    const videoHeight = seesound.videoCanvas.height;
    
    if (seesound.effectLayer) {
        seesound.effectLayer.style.width = `${videoWidth}px`;
        seesound.effectLayer.style.height = `${videoHeight}px`;
        seesound.effectLayer.style.left = '0px';
        seesound.effectLayer.style.top = '0px';
    }
    
    if (seesound.subtitleLayer) {
        seesound.subtitleLayer.style.width = `${videoWidth}px`;
        seesound.subtitleLayer.style.height = `${videoHeight}px`;
        seesound.subtitleLayer.style.left = '0px';
        seesound.subtitleLayer.style.top = '0px';
    }
    
    if (seesound.textLayer) {
        seesound.textLayer.style.width = `${videoWidth}px`;
        seesound.textLayer.style.height = `${videoHeight}px`;
        seesound.textLayer.style.left = '0px';
        seesound.textLayer.style.top = '0px';
    }
    
    updateSubtitleLayerSize(videoWidth, videoHeight);
    updateTextLayerSize(videoWidth, videoHeight);
}