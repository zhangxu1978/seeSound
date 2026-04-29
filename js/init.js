
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

async function init() {
    seesound.videoCanvas = document.getElementById('videoCanvas');
    seesound.effectCanvas = document.getElementById('effectCanvas');
    seesound.videoCtx = seesound.videoCanvas.getContext('2d');
    seesound.effectCtx = seesound.effectCanvas.getContext('2d');

    seesound.videoElement = document.getElementById('videoElement');
    seesound.audioElement = document.getElementById('audioElement');

    seesound.subtitleCanvas = document.getElementById('subtitlePreviewCanvas');
    if (seesound.subtitleCanvas) {
        seesound.subtitleCtx = seesound.subtitleCanvas.getContext('2d');
    }

    await loadConfig();
    bindEvents();
    setupDragResize();
    initParticles();
    updateSettingsVisibility();
    bindSubtitleEvents();
    await loadAllSubtitleFonts();
    initSubtitlePreview();
}

