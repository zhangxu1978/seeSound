// 文字层处理模块

// 绘制文字层
function drawTextLayer() {
    const ctx = seesound.textLayerCtx;
    const w = seesound.textLayerCanvas.width;
    const h = seesound.textLayerCanvas.height;
    
    if (!ctx || !w || !h) return;
    
    ctx.clearRect(0, 0, w, h);
    
    const settings = seesound.textLayerSettings;
    
    if (!settings.text || settings.text.trim() === '') return;
    
    ctx.font = `${settings.fontSize}px ${settings.fontFamily}`;
    ctx.fillStyle = settings.color;
    ctx.strokeStyle = settings.strokeColor;
    ctx.lineWidth = settings.strokeWidth;
    ctx.lineJoin = 'round';
    
    let x, y;
    
    switch (settings.align) {
        case 'left':
            x = 20;
            ctx.textAlign = 'left';
            break;
        case 'right':
            x = w - 20;
            ctx.textAlign = 'right';
            break;
        case 'center':
        default:
            x = w / 2;
            ctx.textAlign = 'center';
            break;
    }
    
    y = h / 2 + settings.fontSize / 3;
    
    if (settings.strokeWidth > 0) {
        ctx.strokeText(settings.text, x, y);
    }
    ctx.fillText(settings.text, x, y);
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