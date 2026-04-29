
// 初始化模块

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        seesound.apiBaseUrl = config.apiBaseUrl;
    } catch (e) {
        console.warn('使用默认配置', e);
    }
}

function initLayerContainers() {
    seesound.effectLayer = document.getElementById('effectLayer');
    seesound.subtitleLayer = document.getElementById('subtitleLayer');
    seesound.textLayer = document.getElementById('textLayer');
    
    seesound.textLayerCanvas = document.getElementById('textLayerCanvas');
    if (seesound.textLayerCanvas) {
        seesound.textLayerCtx = seesound.textLayerCanvas.getContext('2d');
    }
    
    seesound.subtitleCanvas = document.getElementById('subtitleCanvas');
    if (seesound.subtitleCanvas) {
        seesound.subtitleCtx = seesound.subtitleCanvas.getContext('2d');
    }
    
    bindLayerEvents();
}

function updateLayerVisibility() {
    if (seesound.effectLayer) {
        seesound.effectLayer.style.display = seesound.effectLayerSettings.visible ? 'block' : 'none';
    }
    if (seesound.subtitleLayer) {
        seesound.subtitleLayer.style.display = seesound.subtitleLayerSettings.visible ? 'block' : 'none';
    }
    if (seesound.textLayer) {
        seesound.textLayer.style.display = seesound.textLayerSettings.visible ? 'block' : 'none';
    }
}

async function init() {
    seesound.videoCanvas = document.getElementById('videoCanvas');
    seesound.effectCanvas = document.getElementById('effectCanvas');
    seesound.videoCtx = seesound.videoCanvas.getContext('2d');
    seesound.effectCtx = seesound.effectCanvas.getContext('2d');

    seesound.videoElement = document.getElementById('videoElement');
    seesound.audioElement = document.getElementById('audioElement');

    initLayerContainers();

    await loadConfig();
    bindEvents();
    initParticles();
    updateSettingsVisibility();
    bindSubtitleEvents();
    await loadAllSubtitleFonts();
    initSubtitlePreview();
}

