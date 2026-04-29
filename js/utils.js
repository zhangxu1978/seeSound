// 工具函数

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 绘制圆角矩形
function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// 缓动函数 - easeOutQuad
function easeOutQuad(t) {
    return t * (2 - t);
}

// 绑定滑块
function bindSlider(id, valueId, settingKey, isInt = false) {
    const slider = document.getElementById(id);
    const display = document.getElementById(valueId);
    slider.addEventListener('input', (e) => {
        const value = isInt ? parseInt(e.target.value) : parseFloat(e.target.value);
        seesound.effectSettings[settingKey] = value;
        display.textContent = value;
    });
}

// 从状态中访问的辅助函数
function getState() {
    return seesound;
}

// 更新设置面板可见性
function updateSettingsVisibility() {
    const spectrumPanel = document.getElementById('spectrumSettings');
    const wavePanel = document.getElementById('waveSettings');

    spectrumPanel.style.display = seesound.effectSettings.type === 'spectrum' ? 'block' : 'none';
    wavePanel.style.display = seesound.effectSettings.type === 'wave' ? 'block' : 'none';
}