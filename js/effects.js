
// 特效绘制模块

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
function drawParticles(ctx, w, h, energy, time, theme) {
    const sensitivity = seesound.effectSettings.sensitivity;
    
    seesound.particles.forEach((p, i) => {
        const speedMult = 1 + energy.bass * 3 * sensitivity;
        p.x += p.vx * speedMult;
        p.y += p.vy * speedMult;

        if (p.x < 0 || p.x > w) {
            p.vx *= -1;
            p.x = Math.max(0, Math.min(w, p.x));
        }
        if (p.y < 0 || p.y > h) {
            p.vy *= -1;
            p.y = Math.max(0, Math.min(h, p.y));
        }

        const size = p.size * (1 + energy.average);
        const alpha = 0.6 + 0.4 * energy.average;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        
        const hue = (theme.hue + i * 3 + time * 20) % 360;
        ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        ctx.fill();
        
        ctx.shadowBlur = size * 3 * energy.average;
        ctx.shadowColor = ctx.fillStyle;
    });
    
    ctx.shadowBlur = 0;
}

// 粒子上升效果
function drawParticlesUp(ctx, w, h, energy, time, theme) {
    const sensitivity = seesound.effectSettings.sensitivity;
    
    seesound.particles.forEach((p, i) => {
        p.vy = -1 - energy.bass * 5 * sensitivity;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) {
            p.y = h + 10;
            p.x = Math.random() * w;
        }

        const size = p.size * (1 + energy.average);
        const alpha = 0.5 + 0.5 * (1 - p.y / h);
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        
        const hue = (theme.hue + i * 3 + time * 20) % 360;
        ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        ctx.fill();
        
        ctx.shadowBlur = size * 2 * energy.average;
        ctx.shadowColor = ctx.fillStyle;
    });
    
    ctx.shadowBlur = 0;
}

// 频谱效果
function drawSpectrum(ctx, w, h, energy, theme) {
    const { effectSettings, brickPositions, bufferLength, dataArray } = seesound;
    const barCount = effectSettings.barCount;
    const barWidth = effectSettings.barWidth;
    const gap = effectSettings.barGap;
    const radius = effectSettings.barRadius;
    const direction = effectSettings.barDirection;
    const mirror = effectSettings.mirrorEffect;
    const useBrick = effectSettings.barBrick;

    const totalBarWidth = barWidth + gap * barWidth;
    const totalWidth = barCount * totalBarWidth;
    const startX = (w - totalWidth) / 2;

    const brickH = Math.max(4, Math.round(barWidth * 0.6));
    const brickW = barWidth;
    const brickFallSpeed = 1.5;

    if (useBrick && brickPositions.length !== barCount) {
        seesound.brickPositions = new Array(barCount).fill(0);
    }

    for (let i = 0; i < barCount; i++) {
        const normalizedPos = i / (barCount - 1);
        const distFromCenter = Math.abs(normalizedPos - 0.5) * 2;
        const frequencyPos = 0.1 + distFromCenter * 0.5;
        const dataIdx = Math.floor(frequencyPos * bufferLength);
        const value = dataArray ? dataArray[dataIdx] : 0;

        const barHeight = Math.max(10, (value / 255) * h * 0.8 * energy.average);
        const hue = theme.hue;
        const x = startX + i * totalBarWidth;

        let bx, by, bw, bh;

        switch (direction) {
            case 'up':
                bx = x;
                by = h - barHeight;
                bw = barWidth;
                bh = barHeight;
                break;
            case 'down':
                bx = x;
                by = 0;
                bw = barWidth;
                bh = barHeight;
                break;
            case 'left':
                bx = w - barHeight;
                by = x;
                bw = barHeight;
                bh = barWidth;
                break;
            case 'right':
                bx = 0;
                by = x;
                bw = barHeight;
                bh = barWidth;
                break;
            case 'center':
                bx = x;
                by = (h - barHeight) / 2;
                bw = barWidth;
                bh = barHeight;
                break;
        }

        let gradient;
        if (effectSettings.gradientDirection === 'vertical') {
            gradient = ctx.createLinearGradient(bx, by, bx, by + bh);
        } else if (effectSettings.gradientDirection === 'horizontal') {
            gradient = ctx.createLinearGradient(bx, by, bx + bw, by);
        } else {
            gradient = ctx.createRadialGradient(bx + bw/2, by + bh/2, 0, bx + bw/2, by + bh/2, Math.max(bw, bh));
        }

        gradient.addColorStop(0, `hsl(${hue}, ${theme.sat}%, ${theme.light + 20}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${theme.sat}%, ${theme.light - 20}%)`);

        ctx.fillStyle = gradient;
        roundRect(ctx, bx, by, bw, bh, radius);
        ctx.fill();

        if (mirror) {
            let mx, my;
            switch (direction) {
                case 'up':
                case 'down':
                    mx = bx;
                    my = h - by - bh;
                    break;
                case 'left':
                case 'right':
                    mx = w - bx - bw;
                    my = by;
                    break;
                case 'center':
                    mx = bx;
                    my = h - by - bh;
                    break;
            }
            roundRect(ctx, mx, my, bw, bh, radius);
            ctx.fill();
        }

        if (useBrick && (direction === 'up' || direction === 'down' || direction === 'center')) {
            const currentH = barHeight;

            if (currentH >= seesound.brickPositions[i]) {
                seesound.brickPositions[i] = currentH;
            } else {
                seesound.brickPositions[i] = Math.max(currentH, seesound.brickPositions[i] - brickFallSpeed);
            }

            const brickHeight = seesound.brickPositions[i];
            let brx, bry;
            const gap2 = 2;

            if (direction === 'up') {
                brx = bx;
                bry = h - brickHeight - brickH - gap2;
            } else if (direction === 'down') {
                brx = bx;
                bry = brickHeight + gap2;
            } else {
                brx = bx;
                bry = (h - brickHeight) / 2 - brickH - gap2;
            }

            const brickColor = `hsl(${hue}, ${theme.sat}%, ${Math.min(theme.light + 35, 95)}%)`;
            ctx.fillStyle = brickColor;
            roundRect(ctx, brx, bry, brickW, brickH, Math.min(2, radius));
            ctx.fill();

            if (mirror) {
                let mbrx, mbry;
                if (direction === 'up') {
                    mbrx = bx;
                    mbry = brickHeight + gap2;
                } else if (direction === 'down') {
                    mbrx = bx;
                    mbry = h - brickHeight - brickH - gap2;
                } else {
                    mbrx = bx;
                    mbry = h - bry - brickH;
                }
                ctx.fillStyle = brickColor;
                roundRect(ctx, mbrx, mbry, brickW, brickH, Math.min(2, radius));
                ctx.fill();
            }
        }
    }
}

// 波形效果
function drawWave(ctx, w, h, energy, time, theme) {
    const { effectSettings, dataArray, bufferLength } = seesound;
    const origin = effectSettings.waveOrigin;
    const amplitude = effectSettings.amplitude;
    const frequency = effectSettings.frequency;
    const lineWidth = effectSettings.lineWidth;
    const lines = effectSettings.waveLines;
    const glow = effectSettings.glowEffect;
    const sensitivity = effectSettings.sensitivity;

    let startX, startY;
    switch (origin) {
        case 'center':
        case 'left':
        case 'right':
            startX = 0;
            startY = h / 2;
            break;
        case 'top':
        case 'bottom':
            startX = w / 2;
            startY = 0;
            break;
    }

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
            const dataIdx = Math.floor(t * bufferLength);
            const v = (dataArray ? (dataArray[dataIdx] / 128) - 1 : 0);

            let px, py;
            const waveHeight = h * 0.3 * amplitude * sensitivity * (1 + energy.bass);

            if (origin === 'center' || origin === 'left' || origin === 'right') {
                px = origin === 'right' ? w - t * w : t * w;
                const offset = Math.sin(t * Math.PI * frequency * 2 + time * 3) * waveHeight * 0.3;
                py = h / 2 + v * waveHeight + offset + line * 10;
            } else {
                py = origin === 'bottom' ? h - t * h : t * h;
                const offset = Math.sin(t * Math.PI * frequency * 2 + time * 3) * waveHeight * 0.3;
                px = w / 2 + v * waveHeight + offset + line * 10;
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
function drawCircular(ctx, w, h, energy, time, theme) {
    const { effectSettings, dataArray, bufferLength } = seesound;
    const centerX = w / 2;
    const centerY = h / 2;
    const sensitivity = effectSettings.sensitivity;
    const radius = Math.min(w, h) * 0.35;
    const bars = 60;

    const spectrumData = dataArray || new Array(bufferLength).fill(128);

    ctx.beginPath();
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const dataIdx = Math.floor((i / bars) * spectrumData.length);
        const value = spectrumData[dataIdx];
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

// 绘制特效到画布
function drawEffectToCanvas(time) {
    const ctx = seesound.effectCtx;
    const w = seesound.effectCanvas.width;
    const h = seesound.effectCanvas.height;
    const theme = seesound.colorThemes[seesound.effectSettings.colors] || seesound.colorThemes.purple;

    ctx.clearRect(0, 0, w, h);

    let bass = 0, mid = 0, treble = 0, total = 0;
    if (seesound.dataArray && seesound.dataArray.length > 0) {
        const bassCount = Math.floor(seesound.bufferLength * 0.2);
        const midCount = Math.floor(seesound.bufferLength * 0.5);

        for (let i = 0; i < seesound.bufferLength; i++) {
            total += seesound.dataArray[i];
            if (i < bassCount) bass += seesound.dataArray[i];
            else if (i < midCount) mid += seesound.dataArray[i];
            else treble += seesound.dataArray[i];
        }

        bass = bass / bassCount / 255;
        mid = mid / (midCount - bassCount) / 255;
        treble = treble / (seesound.bufferLength - midCount) / 255;
        total = total / seesound.bufferLength / 255;
    }

    const energy = {
        bass: bass * seesound.effectSettings.sensitivity,
        mid: mid * seesound.effectSettings.sensitivity,
        treble: treble * seesound.effectSettings.sensitivity,
        average: total * seesound.effectSettings.sensitivity,
        data: seesound.dataArray || new Uint8Array(seesound.bufferLength).fill(128)
    };

    const t = time / 1000;

    applyTransform(ctx, w, h, t, seesound.effectSettings);

    switch (seesound.effectSettings.type) {
        case 'none':
            break;
        case 'particles':
            drawParticles(ctx, w, h, energy, t, theme);
            break;
        case 'spectrum':
            drawSpectrum(ctx, w, h, energy, theme);
            break;
        case 'wave':
            drawWave(ctx, w, h, energy, t, theme);
            break;
        case 'circular':
            drawCircular(ctx, w, h, energy, t, theme);
            break;
        case 'particles-up':
            drawParticlesUp(ctx, w, h, energy, t, theme);
            break;
    }

    const mediaElement = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
    const currentTime = mediaElement?.currentTime || 0;
    drawSubtitles(ctx, w, h, currentTime, energy);

    ctx.restore();
}

// 初始化粒子
function initParticles() {
    seesound.particles = [];
    const count = seesound.effectSettings.particleCount || 150;
    for (let i = 0; i < count; i++) {
        seesound.particles.push({
            x: Math.random() * seesound.effectCanvas.width,
            y: Math.random() * seesound.effectCanvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: Math.random() * 3 + 1,
            life: Math.random(),
            maxLife: 0.5 + Math.random() * 0.5
        });
    }
}

