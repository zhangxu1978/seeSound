
// 服务器端特效绘制模块
const { colorThemes } = require('./config');

// 存储历史高度值用于平滑处理
const spectrumHistory = new Map();

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

// 应用画布变形
function applyTransform(ctx, w, h, time, settings) {
    const cx = w / 2;
    const cy = h / 2;
    const intensity = (settings.transformIntensity || 30) / 100;
    const speed = settings.transformSpeed || 1;
    const type = settings.transformType || 'none';

    if (type === 'none') return;

    ctx.save();

    switch (type) {
        case 'wave':
            ctx.translate(cx, cy);
            ctx.transform(1, 0, Math.sin(time * speed * 2) * intensity * 0.3, 1, 0, 0);
            ctx.translate(-cx, -cy);
            break;
        case 'spiral':
            ctx.translate(cx, cy);
            ctx.rotate(time * speed * 0.5 * intensity);
            ctx.scale(1 + Math.sin(time * speed) * intensity * 0.1, 1);
            ctx.translate(-cx, -cy);
            break;
        case 'bulge':
            ctx.translate(cx, cy);
            ctx.scale(1 + intensity * 0.3, 1 + intensity * 0.3);
            ctx.translate(-cx, -cy);
            break;
        case 'pinch':
            ctx.translate(cx, cy);
            ctx.scale(1 - intensity * 0.2, 1 - intensity * 0.2);
            ctx.translate(-cx, -cy);
            break;
        case 'swirl':
            ctx.translate(cx, cy);
            ctx.rotate(Math.sin(time * speed) * intensity);
            ctx.translate(-cx, -cy);
            break;
        case 'ripple':
            const scale = 1 + Math.sin(time * speed * 3) * intensity * 0.1;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            break;
    }
}

// 粒子效果
function drawParticles(ctx, x, y, w, h, energy, time, theme, particles, settings) {
    const sensitivity = settings.sensitivity || 1;

    particles.forEach((p, i) => {
        const speedMultiplier = 1 + energy.bass * 3 * sensitivity;
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < 0 || p.x > w) {
            p.vx *= -1;
            p.x = Math.max(0, Math.min(w, p.x));
        }
        if (p.y < 0 || p.y > h) {
            p.vy *= -1;
            p.y = Math.max(0, Math.min(h, p.y));
        }

        const dx = w / 2 - p.x;
        const dy = h / 2 - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            p.x += (dx / dist) * energy.bass * 2 * sensitivity;
            p.y += (dy / dist) * energy.bass * 2 * sensitivity;
        }

        const hue = (theme.hue + time * 30 + i * 2) % 360;
        const size = p.size * (1 + energy.mid * 2 * sensitivity);

        ctx.beginPath();
        ctx.arc(x + p.x, y + p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${0.5 + energy.average * 0.5})`;
        ctx.fill();
    });

    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const pulseSize = Math.min(w, h) * 0.1 + energy.bass * Math.min(w, h) * 0.2 * sensitivity;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseSize);
    gradient.addColorStop(0, `hsla(${theme.hue}, ${theme.sat}%, ${theme.light}%, ${energy.bass * 0.5})`);
    gradient.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

// 粒子上升效果
function drawParticlesUp(ctx, x, y, w, h, energy, time, theme, particles, settings) {
    const sensitivity = settings.sensitivity || 1;

    particles.forEach((p, i) => {
        p.life += 0.01;
        if (p.life > p.maxLife) {
            p.life = 0;
            p.x = Math.random() * w;
            p.y = h + 10;
        }

        const speed = (1 + energy.bass * 5 * sensitivity) * (1 + p.size / 3);
        p.y -= speed;
        p.x += Math.sin(time * 3 + i) * 0.5;

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * (0.3 + energy.average * 0.7);
        const hue = (theme.hue + p.y / h * 60) % 360;
        const size = p.size * (1 + energy.mid * 2 * sensitivity);

        ctx.beginPath();
        ctx.arc(x + p.x, y + p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        ctx.fill();
    });
}

// 频谱效果
function drawSpectrum(ctx, x, y, w, h, energy, theme, settings) {
    const barCount = settings.barCount || 64;
    const barWidth = settings.barWidth || 8;
    const gap = settings.barGap || 0.2;
    const radius = settings.barRadius || 4;
    const direction = settings.barDirection || 'up';
    const mirror = settings.mirrorEffect !== false;
    const gradientDir = settings.gradientDirection || 'vertical';

    const totalBarWidth = barWidth + gap * barWidth;
    const totalWidth = barCount * totalBarWidth;
    const startX = x + (w - totalWidth) / 2;

    const spectrumData = energy.spectrum && energy.spectrum.length > 0 
        ? energy.spectrum 
        : energy.data && energy.data.length > 0
        ? energy.data
        : new Array(128).fill(0);

    // 获取或初始化历史数据 - 使用任务ID作为前缀
    const historyKey = `${settings.taskId || 'default'}-${barCount}-${direction}`;
    if (!spectrumHistory.has(historyKey)) {
        spectrumHistory.set(historyKey, new Array(barCount).fill(0));
    }
    const history = spectrumHistory.get(historyKey);

    for (let i = 0; i < barCount; i++) {
        // 计算相对位置
        const normalizedPos = i / (barCount - 1);
        const distFromCenter = Math.abs(normalizedPos - 0.5) * 2;
        const frequencyPos = 0.1 + distFromCenter * 0.5;
        const dataIndex = Math.floor(frequencyPos * spectrumData.length);
        const value = spectrumData[dataIndex] || 0;

        const targetHeight = Math.max(10, (value / 255) * h * 0.8 * (energy.average || 1));
        const smoothingFactor = 0.6;
        const currentHeight = history[i];
        const smoothedHeight = currentHeight * (1 - smoothingFactor) + targetHeight * smoothingFactor;
        const barHeight = Math.max(10, smoothedHeight);
        history[i] = barHeight;

        const hue = theme.hue;
        const bx = startX + i * totalBarWidth;

        let barX, barY, barW, barH;

        switch (direction) {
            case 'up':
                barX = bx;
                barY = y + h - barHeight;
                barW = barWidth;
                barH = barHeight;
                break;
            case 'down':
                barX = bx;
                barY = y;
                barW = barWidth;
                barH = barHeight;
                break;
            case 'left':
                barX = x + w - barHeight;
                barY = bx;
                barW = barHeight;
                barH = barWidth;
                break;
            case 'right':
                barX = x;
                barY = bx;
                barW = barHeight;
                barH = barWidth;
                break;
            case 'center':
                barX = bx;
                barY = y + (h - barHeight) / 2;
                barW = barWidth;
                barH = barHeight;
                break;
        }

        let gradient;
        if (gradientDir === 'vertical') {
            gradient = ctx.createLinearGradient(barX, barY, barX, barY + barH);
        } else if (gradientDir === 'horizontal') {
            gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        } else {
            gradient = ctx.createRadialGradient(barX + barW/2, barY + barH/2, 0, barX + barW/2, barY + barH/2, Math.max(barW, barH));
        }

        gradient.addColorStop(0, `hsl(${hue}, ${theme.sat}%, ${theme.light + 20}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${theme.sat}%, ${theme.light - 20}%)`);

        ctx.fillStyle = gradient;
        roundRect(ctx, barX, barY, barW, barH, radius);
        ctx.fill();

        if (mirror) {
            let mx, my;
            switch (direction) {
                case 'up':
                case 'down':
                    mx = barX;
                    my = y + h - barY - barH;
                    break;
                case 'left':
                case 'right':
                    mx = x + w - barX - barW;
                    my = barY;
                    break;
                case 'center':
                    mx = barX;
                    my = y + h - barY - barH;
                    break;
            }
            roundRect(ctx, mx, my, barW, barH, radius);
            ctx.fill();
        }
    }

    spectrumHistory.set(historyKey, history);
}

// 波形效果
function drawWave(ctx, x, y, w, h, energy, time, theme, settings) {
    const origin = settings.waveOrigin || 'center';
    const amplitude = settings.amplitude || 1;
    const frequency = settings.frequency || 2;
    const lineWidth = settings.lineWidth || 3;
    const lines = settings.waveLines || 1;
    const glow = settings.glowEffect !== false;
    const sensitivity = settings.sensitivity || 1;

    const spectrumData = energy.spectrum && energy.spectrum.length > 0 
        ? energy.spectrum 
        : new Array(128).fill(128);

    for (let line = 0; line < lines; line++) {
        const hue = (theme.hue + line * 30 + time * 20) % 360;
        const alpha = 1 - (line * 0.2);

        ctx.lineWidth = Math.max(0.5, lineWidth - line * 0.5);
        ctx.strokeStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;

        if (glow) {
            ctx.shadowBlur = Math.max(5, 15 - line * 3);
            ctx.shadowColor = ctx.strokeStyle;
        }

        ctx.beginPath();

        const points = 200;
        for (let i = 0; i < points; i++) {
            const t = i / points;
            const dataIndex = Math.floor(t * spectrumData.length);
            const v = ((spectrumData[dataIndex] || 128) / 128) - 1;

            let px, py;
            const waveHeight = h * 0.3 * amplitude * sensitivity * (1 + energy.bass);

            if (origin === 'center' || origin === 'left' || origin === 'right') {
                px = origin === 'right' ? x + w - t * w : x + t * w;
                const offset = Math.sin(t * Math.PI * frequency * 2 + time * 3) * waveHeight * 0.3;
                py = y + h / 2 + v * waveHeight + offset + line * 10;
            } else {
                py = origin === 'bottom' ? y + h - t * h : y + t * h;
                const offset = Math.sin(t * Math.PI * frequency * 2 + time * 3) * waveHeight * 0.3;
                px = x + w / 2 + v * waveHeight + offset + line * 10;
            }

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }

        ctx.stroke();
    }

    ctx.shadowBlur = 0;
}

// 环形效果
function drawCircular(ctx, x, y, w, h, energy, time, theme, settings) {
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const sensitivity = settings.sensitivity || 1;
    const radius = Math.min(w, h) * 0.35;
    const bars = 60;

    const spectrumData = energy.spectrum && energy.spectrum.length > 0
        ? energy.spectrum
        : new Array(64).fill(128);

    ctx.beginPath();
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const dataIndex = Math.floor((i / bars) * spectrumData.length);
        const value = spectrumData[dataIndex] || 128;
        const normalizedValue = value / 255;
        const amp = normalizedValue * radius * 0.5 * sensitivity * (1 + energy.bass);
        const r = radius + amp;
        const px = centerX + Math.cos(angle) * r;
        const py = centerY + Math.sin(angle) * r;

        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();

    const hue = (theme.hue + time * 30) % 360;
    ctx.strokeStyle = `hsl(${hue}, ${theme.sat}%, ${theme.light}%)`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.stroke();

    const centerPulse = radius * 0.2 + energy.bass * radius * 0.3 * sensitivity;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerPulse, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${0.3 + energy.average * 0.4})`;
    ctx.fill();

    ctx.shadowBlur = 0;
}

// 主特效绘制函数
function drawEffect(ctx, x, y, w, h, energy, time, theme, type, particles, settings) {
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    applyTransform(ctx, w, h, time, settings);

    switch (type) {
        case 'particles':
            drawParticles(ctx, x, y, w, h, energy, time, theme, particles, settings);
            break;
        case 'spectrum':
            drawSpectrum(ctx, x, y, w, h, energy, theme, settings);
            break;
        case 'wave':
            drawWave(ctx, x, y, w, h, energy, time, theme, settings);
            break;
        case 'circular':
            drawCircular(ctx, x, y, w, h, energy, time, theme, settings);
            break;
        case 'particles-up':
            drawParticlesUp(ctx, x, y, w, h, energy, time, theme, particles, settings);
            break;
        default:
            drawParticles(ctx, x, y, w, h, energy, time, theme, particles, settings);
    }

    ctx.restore();
}

module.exports = {
    drawEffect,
    roundRect,
    colorThemes
};

