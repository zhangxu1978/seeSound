const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const { createCanvas } = require('canvas');
const fetch = require('node-fetch');
const AudioAnalyzer = require('./audio-analyzer');

const config = require('./config');

const app = express();
const PORT = config.port;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/exports', express.static('exports'));

// 确保目录存在
const uploadsDir = path.join(__dirname, 'uploads');
const exportsDir = path.join(__dirname, 'exports');
const tempDir = path.join(__dirname, 'temp');

[uploadsDir, exportsDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 存储任务状态
const exportTasks = new Map();

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// 多文件上传配置
const multiUpload = upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'bgImage', maxCount: 1 }
]);

// 颜色主题
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

// 生成可视化帧 - 流式处理版本，最小化内存使用
async function generateVisualizationFrames(inputPath, settings, taskId, outputDir) {
    const framesDir = path.join(outputDir, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });

    console.log(`[${taskId}] 🔍 获取视频元数据...`);

    // 获取视频信息
    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });

    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    
    let width, height;
    if (settings.useBgImage && settings.bgImageWidth && settings.bgImageHeight) {
        width = settings.bgImageWidth;
        height = settings.bgImageHeight;
    } else {
        width = settings.resolution === 'original' ? videoStream?.width || 1280 : 
                settings.resolution === '1080' ? 1920 :
                settings.resolution === '720' ? 1280 : 854;
        height = settings.resolution === 'original' ? videoStream?.height || 720 :
                 settings.resolution === '1080' ? 1080 :
                 settings.resolution === '720' ? 720 : 480;
    }
    const fps = 30;

    console.log(`[${taskId}] 📐 视频尺寸: ${width}x${height}, 帧率: ${fps}`);

    // 分析音频数据 - 流式处理
    const task = exportTasks.get(taskId);
    task.message = '正在分析音频...';
    
    const analyzer = new AudioAnalyzer();
    console.log(`[${taskId}] 🎵 提取音频数据...`);
    // 只提取音频数据，不预计算所有帧
    try {
        await analyzer.extractAudioData(inputPath);
        console.log(`[${taskId}] ✅ 音频提取完成，时长: ${analyzer.duration.toFixed(2)}秒`);
    } catch (err) {
        console.warn(`[${taskId}] ⚠️ 音频提取失败，使用模拟数据:`, err.message);
        analyzer.duration = 60;
    }
    
    const totalFrames = Math.floor(analyzer.duration * fps);
    task.metadata = { width, height, fps, duration: analyzer.duration, totalFrames };
    console.log(`[${taskId}] 🖼️ 待生成帧数: ${totalFrames}`);

    // 计算特效区域大小用于粒子初始化
    const overlay = settings.overlayRect || { x: 0, y: 0, width, height };
    const scaleFactor = settings.scaleFactor || 1;
    const canvasW = settings.canvasWidth || width;
    const canvasH = settings.canvasHeight || height;
    const exportScaleX = width / canvasW;
    const exportScaleY = height / canvasH;
    const effectWidth = overlay.width * scaleFactor * exportScaleX;
    const effectHeight = overlay.height * scaleFactor * exportScaleY;

    // 初始化粒子 - 使用特效区域大小
    const particles = [];
    const particleCount = settings.particleCount || 150;
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * effectWidth,
            y: Math.random() * effectHeight,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: Math.random() * 3 + 1,
            life: Math.random(),
            maxLife: 0.5 + Math.random() * 0.5
        });
    }
    console.log(`[${taskId}] 🔧 粒子初始化: effectWidth=${effectWidth.toFixed(0)}, effectHeight=${effectHeight.toFixed(0)}`);

    // 流式处理：逐帧生成，不缓存所有帧数据
    const batchSize = 10; // 减小批次大小
    
    return new Promise((resolve, reject) => {
        const processBatch = async (startIdx) => {
            try {
                // 为每批创建新的 canvas
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');

                const endIdx = Math.min(startIdx + batchSize, totalFrames);
                
                for (let frameIndex = startIdx; frameIndex < endIdx; frameIndex++) {
                    const time = frameIndex / fps;
                    const frameEnergy = analyzer.getSpectrumAtTime(time);
                    
                    const sensitivity = settings.sensitivity || settings.sensitivvity || 1;
                    
                    const spectrumData = frameEnergy.spectrum && frameEnergy.spectrum.length > 0 
                        ? frameEnergy.spectrum.slice(0, 128) 
                        : new Array(128).fill(128);
                    
                    // 计算与前端一致的 average 值
                    let total = 0;
                    for (let i = 0; i < spectrumData.length; i++) {
                        total += spectrumData[i];
                    }
                    const average = (total / spectrumData.length / 255) * sensitivity;
                    
                    const energy = {
                        bass: frameEnergy.bass * sensitivity,
                        mid: frameEnergy.mid * sensitivity,
                        treble: frameEnergy.treble * sensitivity,
                        average: average,
                        spectrum: spectrumData
                    };
                    
                    // 第一帧输出能量值用于调试
                    if (frameIndex === 0) {
                        console.log(`[${taskId}] 🎨 能量数据: bass=${energy.bass.toFixed(2)}, mid=${energy.mid.toFixed(2)}, treble=${energy.treble.toFixed(2)}`);
                        console.log(`[${taskId}] 🎨 spectrum前10个值: [${energy.spectrum.slice(0, 10).map(v => v.toFixed(0)).join(', ')}]`);
                        console.log(`[${taskId}] 🎨 spectrum长度: ${energy.spectrum.length}, 最大值: ${Math.max(...energy.spectrum)}, 最小值: ${Math.min(...energy.spectrum)}`);
                    }

                    // 正确清除画布
                    ctx.clearRect(0, 0, width, height);

                    const overlay = settings.overlayRect || { x: 0, y: 0, width, height };
                    
                    // 计算导出时的坐标转换
                    // overlay 是 CSS 像素坐标，需要转换为导出尺寸坐标
                    // scaleFactor = videoCanvas像素 / CSS显示像素
                    // 然后如果导出尺寸与 videoCanvas 尺寸不同，需要额外缩放
                    const scaleFactor = settings.scaleFactor || 1;
                    const canvasW = settings.canvasWidth || width;
                    const canvasH = settings.canvasHeight || height;
                    const exportScaleX = width / canvasW;
                    const exportScaleY = height / canvasH;
                    
                    // 只在第一帧输出调试信息
                    if (frameIndex === 0) {
                        console.log(`[${taskId}] 🔧 叠加层设置(CSS): x=${overlay.x}, y=${overlay.y}, w=${overlay.width}, h=${overlay.height}`);
                        console.log(`[${taskId}] 🔧 videoCanvas尺寸: ${canvasW}x${canvasH}, 导出尺寸: ${width}x${height}`);
                        console.log(`[${taskId}] 🔧 scaleFactor=${scaleFactor}, exportScale=${exportScaleX}x${exportScaleY}`);
                    }
                    
                    // CSS像素 -> videoCanvas像素 -> 导出尺寸像素
                    const overlayX = overlay.x * scaleFactor * exportScaleX;
                    const overlayY = overlay.y * scaleFactor * exportScaleY;
                    const overlayW = overlay.width * scaleFactor * exportScaleX;
                    const overlayH = overlay.height * scaleFactor * exportScaleY;

                    // 保存上下文并裁剪到叠加层区域
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(overlayX, overlayY, overlayW, overlayH);
                    ctx.clip();

                    // 绘制特效 - 只绘制在叠加层区域内
                    const theme = colorThemes[settings.colors] || colorThemes.purple;
                    
                    // 第一帧输出调试信息
                    if (frameIndex === 0) {
                        console.log(`[${taskId}] 🔍 settings.type = "${settings.type}"`);
                        console.log(`[${taskId}] 🔍 settings.colors = "${settings.colors}"`);
                        console.log(`[${taskId}] 🔍 theme = ${JSON.stringify(theme)}`);
                        console.log(`[${taskId}] 🔍 particles.length = ${particles.length}`);
                        console.log(`[${taskId}] 🎨 能量数据: bass=${energy.bass.toFixed(2)}, mid=${energy.mid.toFixed(2)}, treble=${energy.treble.toFixed(2)}`);
                        console.log(`[${taskId}] 🎨 特效区域: x=${overlayX}, y=${overlayY}, w=${overlayW}, h=${overlayH}`);
                    }
                    
                    drawEffect(ctx, overlayX, overlayY, overlayW, overlayH, energy, time, theme, settings.type, particles, settings);

                    ctx.restore();

                    // 保存帧 - 使用 PNG 保留透明通道
                    const buffer = canvas.toBuffer('image/png');
                    const framePath = path.join(framesDir, `frame_${frameIndex.toString().padStart(6, '0')}.png`);
                    fs.writeFileSync(framePath, buffer);
                    
                    // 更新进度
                    if (frameIndex % 30 === 0 || frameIndex === totalFrames - 1) {
                        const progress = Math.floor((frameIndex / totalFrames) * 50);
                        task.progress = progress;
                        task.message = `生成帧 ${frameIndex}/${totalFrames}`;
                        console.log(`[${taskId}] 📝 帧生成进度: ${frameIndex}/${totalFrames} (${progress}%)`);
                    }
                }
                
                // 释放 canvas 引用
                canvas.width = 0;
                canvas.height = 0;
                
                // 处理下一批或完成
                if (endIdx < totalFrames) {
                    // 给事件循环喘息机会
                    setImmediate(() => processBatch(endIdx));
                } else {
                    // 清理音频数据释放内存
                    analyzer.audioData = null;
                    resolve({ framesDir, fps, width, height });
                }
            } catch (err) {
                reject(err);
            }
        };

        processBatch(0);
    });
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

// 绘制特效
function drawEffect(ctx, x, y, w, h, energy, time, theme, type, particles, settings) {
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    // 应用变形
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

// 频谱效果 - 增强版
// 存储历史高度值用于平滑处理
const spectrumHistory = new Map();

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

    // 获取或初始化历史数据
    const historyKey = `${settings.barCount}-${settings.barDirection}`;
    if (!spectrumHistory.has(historyKey)) {
        spectrumHistory.set(historyKey, new Array(barCount).fill(0));
    }
    const history = spectrumHistory.get(historyKey);

    for (let i = 0; i < barCount; i++) {
        // 计算相对位置（0-1）
        const normalizedPos = i / (barCount - 1);

        // 对称映射：两边对应低频，中间对应中高频（能量较强区域）
        // 使用抛物线形状：中间 = 中高频，两边 = 低频
        const distFromCenter = Math.abs(normalizedPos - 0.5) * 2; // 0~1, 0是中间，1是两边
        const frequencyPos = 0.1 + distFromCenter * 0.5; // 中间对应0.1（中高频），两边对应0.6（低频）
        const dataIndex = Math.floor(frequencyPos * spectrumData.length);
        const value = spectrumData[dataIndex] || 0;
        
        // 计算能量值
        const targetHeight = Math.max(10, (value / 255) * h * 0.8 * (energy.average || 1));
        
        // 平滑处理：使用历史值的加权平均
        const smoothingFactor = 0.6; // 0-1，越大越平滑
        const currentHeight = history[i];
        const smoothedHeight = currentHeight * (1 - smoothingFactor) + targetHeight * smoothingFactor;
        const barHeight = Math.max(10, smoothedHeight);
        
        // 更新历史值
        history[i] = barHeight;

        // 统一颜色主题
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

        // 创建渐变
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

        // 镜像效果
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

    // 更新历史数据
    spectrumHistory.set(historyKey, history);
}

// 波形效果 - 增强版
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

    // 确定起始位置
    let startX, startY;
    switch (origin) {
        case 'center':
            startX = x;
            startY = y + h / 2;
            break;
        case 'left':
            startX = x;
            startY = y + h / 2;
            break;
        case 'right':
            startX = x + w;
            startY = y + h / 2;
            break;
        case 'top':
            startX = x + w / 2;
            startY = y;
            break;
        case 'bottom':
            startX = x + w / 2;
            startY = y + h;
            break;
    }

    // 绘制多条波形线
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
                // 水平波形
                px = origin === 'right' ? x + w - t * w : x + t * w;
                const offset = Math.sin(t * Math.PI * frequency * 2 + time * 3) * waveHeight * 0.3;
                py = y + h / 2 + v * waveHeight + offset + line * 10;
            } else {
                // 垂直波形
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

// 合并视频和特效 - 使用 overlay 将特效帧叠加到原视频上
async function mergeVideoWithEffect(inputPath, framesDir, fps, width, height, outputPath, taskId) {
    return new Promise((resolve, reject) => {
        const task = exportTasks.get(taskId);
        
        // 构建 FFmpeg 命令
        // 输入0: 原视频, 输入1: 特效帧序列（带透明通道的PNG）
        // 使用 overlay 滤镜将特效叠加到视频上
        const command = ffmpeg()
            .input(inputPath)
            .input(path.join(framesDir, 'frame_%06d.png'))
            .inputFPS(fps)
            .inputOptions([
                '-thread_queue_size 512'
            ])
            .complexFilter([
                // 将特效帧叠加到原视频上
                // 格式转换确保透明度正确处理
                '[1:v]format=rgba[fx]',
                '[0:v][fx]overlay=0:0:format=auto:repeatlast=0[output]'
            ])
            .outputOptions([
                '-map [output]',
                '-map 0:a?',  // 保留原视频音频
                '-c:v libx264',
                '-preset medium',
                '-crf 23',
                '-pix_fmt yuv420p',
                '-c:a aac',
                '-b:a 192k',
                '-movflags +faststart',
                '-shortest',
                '-vsync cfr'
            ])
            .size(`${width}x${height}`)
            .output(outputPath);

        command
            .on('start', (cmd) => {
                console.log('FFmpeg 命令:', cmd);
                task.message = '正在合成视频...';
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    task.progress = 50 + Math.floor(progress.percent * 0.5);
                    task.message = `合成进度: ${Math.floor(progress.percent)}%`;
                }
            })
            .on('end', () => {
                task.progress = 100;
                task.status = 'completed';
                task.message = '导出完成';
                console.log('视频导出完成:', outputPath);
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('FFmpeg 错误:', err);
                console.error('FFmpeg stderr:', stderr);
                task.status = 'failed';
                task.error = err.message;
                reject(err);
            })
            .run();
    });
}

// 合并背景图、音频和特效
async function mergeWithBackground(bgImagePath, audioPath, framesDir, fps, width, height, outputPath, taskId) {
    return new Promise((resolve, reject) => {
        const task = exportTasks.get(taskId);
        
        // 构建 FFmpeg 命令
        // 输入0: 背景图, 输入1: 音频, 输入2: 特效帧序列
        // 背景图循环播放，特效叠加，音频作为音轨
        const command = ffmpeg()
            .input(bgImagePath)
            .inputOptions(['-loop 1'])  // 背景图循环
            .input(audioPath)
            .input(path.join(framesDir, 'frame_%06d.png'))
            .inputFPS(fps)
            .inputOptions([
                '-thread_queue_size 512'
            ])
            .complexFilter([
                // 将背景图缩放到目标尺寸
                '[0:v]scale=' + width + ':' + height + ':force_original_aspect_ratio=decrease,pad=' + width + ':' + height + ':(ow-iw)/2:(oh-ih)/2[bg]',
                // 特效帧格式转换
                '[2:v]format=rgba[fx]',
                // 特效叠加到背景图上
                '[bg][fx]overlay=0:0:format=auto:repeatlast=0[output]'
            ])
            .outputOptions([
                '-map [output]',
                '-map 1:a?',  // 使用音频文件的音轨
                '-c:v libx264',
                '-preset medium',
                '-crf 23',
                '-pix_fmt yuv420p',
                '-c:a aac',
                '-b:a 192k',
                '-movflags +faststart',
                '-shortest',  // 以最短的输入为准（音频长度）
                '-vsync cfr'
            ])
            .output(outputPath);

        command
            .on('start', (cmd) => {
                console.log('FFmpeg 命令:', cmd);
                task.message = '正在合成视频（使用背景图）...';
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    task.progress = 50 + Math.floor(progress.percent * 0.5);
                    task.message = `合成进度: ${Math.floor(progress.percent)}%`;
                }
            })
            .on('end', () => {
                task.progress = 100;
                task.status = 'completed';
                task.message = '导出完成';
                console.log('视频导出完成（背景图模式）:', outputPath);
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('FFmpeg 错误:', err);
                console.error('FFmpeg stderr:', stderr);
                task.status = 'failed';
                task.error = err.message;
                reject(err);
            })
            .run();
    });
}

// API 路由

// 导出视频
app.post('/api/export', multiUpload, async (req, res) => {
    try {
        const videoFile = req.files?.video?.[0];
        const bgImageFile = req.files?.bgImage?.[0];

        if (!videoFile) {
            return res.status(400).json({ error: '没有上传视频文件' });
        }

        console.log('\n========== 收到导出请求 ==========');
        console.log(`📹 视频文件: ${videoFile.originalname} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)`);
        if (bgImageFile) {
            console.log(`🖼️  背景图: ${bgImageFile.originalname}`);
        }

        const settings = JSON.parse(req.body.settings || '{}');
        console.log(`⚙️  设置: ${JSON.stringify(settings)}`);
        
        if (settings.bgImageWidth && settings.bgImageHeight) {
            console.log(`🖼️  背景图尺寸: ${settings.bgImageWidth}x${settings.bgImageHeight}`);
        }

        const taskId = uuidv4();
        console.log(`🔑 任务ID: ${taskId}`);

        const outputDir = path.join(tempDir, taskId);
        fs.mkdirSync(outputDir, { recursive: true });

        // 创建任务
        exportTasks.set(taskId, {
            id: taskId,
            status: 'processing',
            progress: 0,
            message: '开始处理...',
            inputPath: videoFile.path,
            bgImagePath: bgImageFile ? bgImageFile.path : null,
            outputDir,
            settings
        });

        res.json({ taskId });

        // 异步处理
        setImmediate(async () => {
            try {
                const task = exportTasks.get(taskId);
                
                // 1. 生成可视化帧（透明背景）
                console.log(`\n[${taskId}] 🎨 开始生成可视化帧...`);
                task.message = '生成可视化帧...';
                const { framesDir, fps, width, height } = await generateVisualizationFrames(
                    videoFile.path, settings, taskId, outputDir
                );
                console.log(`[${taskId}] ✅ 可视化帧生成完成 (${width}x${height} @ ${fps}fps)`);

                // 2. 合并视频 - 将透明特效帧叠加到原视频或背景图上
                const outputFilename = `exported_${Date.now()}.mp4`;
                const outputPath = path.join(exportsDir, outputFilename);
                
                console.log(`[${taskId}] 🎬 开始合并视频...`);
                if (settings.useBgImage && task.bgImagePath) {
                    // 使用背景图作为基底
                    await mergeWithBackground(task.bgImagePath, videoFile.path, framesDir, fps, width, height, outputPath, taskId);
                } else {
                    // 使用原视频作为基底
                    await mergeVideoWithEffect(videoFile.path, framesDir, fps, width, height, outputPath, taskId);
                }
                console.log(`[${taskId}] ✅ 视频合并完成`);

                // 3. 清理临时文件
                task.outputPath = outputPath;
                task.outputUrl = `/exports/${outputFilename}`;
                
                console.log(`[${taskId}] 🧹 清理临时文件...`);
                // 清理
                fs.rmSync(outputDir, { recursive: true, force: true });
                fs.unlinkSync(videoFile.path);
                if (task.bgImagePath) {
                    fs.unlinkSync(task.bgImagePath);
                }
                console.log(`[${taskId}] ✅ 导出完成! 输出: ${outputFilename}`);
                console.log(`[${taskId}] ========== 导出任务结束 ==========\n`);

            } catch (error) {
                console.error('导出错误:', error);
                const task = exportTasks.get(taskId);
                if (task) {
                    task.status = 'failed';
                    task.error = error.message;
                }
            }
        });

    } catch (error) {
        console.error('API 错误:', error);
        res.status(500).json({ error: error.message });
    }
});

// 查询导出状态
app.get('/api/export/status/:taskId', (req, res) => {
    const taskId = req.params.taskId;

    const task = exportTasks.get(taskId);
    if (!task) {
        console.log(`❌ 任务不存在: ${taskId}`);
        return res.status(404).json({ error: '任务不存在' });
    }
   res.json(task);
});

// 下载导出的视频
app.get('/api/export/download/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    console.log(`📥 下载请求: ${taskId}`);
    const task = exportTasks.get(taskId);
    if (!task || task.status !== 'completed') {
        console.log(`❌ 下载失败: 视频不存在或未完成`);
        return res.status(404).json({ error: '视频不存在或未完成' });
    }
    console.log(`📥 开始下载: ${task.outputPath}`);
    res.download(task.outputPath, 'visualized_video.mp4');
});

// 获取导出列表
app.get('/api/exports', (req, res) => {
    const exports = Array.from(exportTasks.values())
        .filter(t => t.status === 'completed')
        .map(t => ({
            id: t.id,
            status: t.status,
            url: t.outputUrl,
            createdAt: t.createdAt
        }));
    res.json(exports);
});

// 外部程序导出接口 - 支持直接文件上传
const externalUpload = upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]);

app.post('/api/export-external', externalUpload, async (req, res) => {
    try {
        const audioFile = req.files?.audio?.[0];
        const imageFile = req.files?.image?.[0];
        const configName = req.body.configName;

        if (!audioFile) {
            return res.status(400).json({ error: '缺少音频文件' });
        }

        if (!imageFile) {
            return res.status(400).json({ error: '缺少图片文件' });
        }

        if (!configName) {
            return res.status(400).json({ error: '缺少配置文件名参数' });
        }

        console.log('\n========== 收到外部导出请求 ==========');
        console.log(`🎵 音频文件: ${audioFile.originalname} (${(audioFile.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`🖼️  图片文件: ${imageFile.originalname} (${(imageFile.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`⚙️  配置文件名: ${configName}`);

        // 自动补全配置文件路径
        const configPath = path.join(__dirname, 'sound', 'config', `${configName}.json`);
        console.log(`📁 配置文件路径: ${configPath}`);

        // 读取配置文件
        let settings;
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            settings = JSON.parse(configContent);
            console.log(`✅ 配置文件读取成功`);
        } catch (error) {
            console.error('读取配置文件失败:', error);
            // 清理上传的文件
            fs.unlinkSync(audioFile.path);
            fs.unlinkSync(imageFile.path);
            return res.status(400).json({ error: '读取配置文件失败: ' + error.message });
        }

        const taskId = uuidv4();
        console.log(`🔑 任务ID: ${taskId}`);

        const outputDir = path.join(tempDir, taskId);
        fs.mkdirSync(outputDir, { recursive: true });

        // 使用上传的文件路径
        const audioPath = audioFile.path;
        const imagePath = imageFile.path;

        // 创建任务
        exportTasks.set(taskId, {
            id: taskId,
            status: 'processing',
            progress: 0,
            message: '开始处理...',
            inputPath: audioPath,
            bgImagePath: imagePath,
            outputDir,
            settings,
            createdAt: new Date().toISOString()
        });

        res.json({ taskId });

        // 异步处理
        setImmediate(async () => {
            try {
                const task = exportTasks.get(taskId);
                
                // 1. 生成可视化帧（透明背景）
                console.log(`\n[${taskId}] 🎨 开始生成可视化帧...`);
                task.message = '生成可视化帧...';
                const { framesDir, fps, width, height } = await generateVisualizationFrames(
                    audioPath, settings, taskId, outputDir
                );
                console.log(`[${taskId}] ✅ 可视化帧生成完成 (${width}x${height} @ ${fps}fps)`);

                // 2. 合并视频 - 使用背景图作为基底
                const outputFilename = `exported_${Date.now()}.mp4`;
                const outputPath = path.join(exportsDir, outputFilename);
                
                console.log(`[${taskId}] 🎬 开始合并视频...`);
                await mergeWithBackground(imagePath, audioPath, framesDir, fps, width, height, outputPath, taskId);
                console.log(`[${taskId}] ✅ 视频合并完成`);

                // 3. 清理临时文件
                task.outputPath = outputPath;
                task.outputUrl = `/exports/${outputFilename}`;
                task.status = 'completed';
                
                console.log(`[${taskId}] 🧹 清理临时文件...`);
                // 清理
                fs.rmSync(outputDir, { recursive: true, force: true });
                fs.unlinkSync(audioPath);
                fs.unlinkSync(imagePath);
                console.log(`[${taskId}] ✅ 导出完成! 输出: ${outputFilename}`);
                console.log(`[${taskId}] ========== 导出任务结束 ==========\n`);

            } catch (error) {
                console.error('导出错误:', error);
                const task = exportTasks.get(taskId);
                if (task) {
                    task.status = 'failed';
                    task.error = error.message;
                }
                // 清理临时目录和上传的文件
                fs.rmSync(outputDir, { recursive: true, force: true });
                try {
                    fs.unlinkSync(audioPath);
                    fs.unlinkSync(imagePath);
                } catch (e) {
                    // 忽略清理错误
                }
            }
        });

    } catch (error) {
        console.error('API 错误:', error);
        res.status(500).json({ error: error.message });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 客户端配置
app.get('/api/config', (req, res) => {
    res.json({
        apiBaseUrl: config.apiBaseUrl
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🎬 音视频可视化服务器运行在 http://localhost:${PORT}`);
    console.log(`📁 导出文件目录: ${exportsDir}`);
});

module.exports = app;
