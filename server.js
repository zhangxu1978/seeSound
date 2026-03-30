const express = require('express');
const multer = require('multer');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { createCanvas } = require('canvas');
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
    warm: { hue: 30, sat: 90, light: 60 }
};

// 生成可视化帧 - 优化内存使用版本
async function generateVisualizationFrames(inputPath, settings, taskId, outputDir) {
    const framesDir = path.join(outputDir, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });

    // 获取视频信息
    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });

    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    
    const width = settings.resolution === 'original' ? videoStream?.width || 1280 : 
                  settings.resolution === '1080' ? 1920 :
                  settings.resolution === '720' ? 1280 : 854;
    const height = settings.resolution === 'original' ? videoStream?.height || 720 :
                   settings.resolution === '1080' ? 1080 :
                   settings.resolution === '720' ? 720 : 480;
    const fps = videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 30;

    // 分析音频数据
    const task = exportTasks.get(taskId);
    task.message = '正在分析音频...';
    
    const analyzer = new AudioAnalyzer();
    const frameData = await analyzer.analyzeFullAudio(inputPath, fps);
    const totalFrames = frameData.length;

    task.metadata = { width, height, fps, duration: analyzer.duration, totalFrames };

    // 初始化粒子
    const particles = [];
    const particleCount = settings.particleCount || 150;
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: Math.random() * 3 + 1,
            life: Math.random(),
            maxLife: 0.5 + Math.random() * 0.5
        });
    }

    // 使用流式写入避免内存溢出
    // 批量处理，每批处理完后强制垃圾回收
    const batchSize = 30; // 每批处理的帧数
    
    return new Promise((resolve, reject) => {
        const processBatch = async (startIdx) => {
            try {
                // 为每批创建新的 canvas，处理完后释放
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');
                
                // 关键：确保画布背景透明
                ctx.fillStyle = 'rgba(0, 0, 0, 0)';
                ctx.fillRect(0, 0, width, height);

                const endIdx = Math.min(startIdx + batchSize, totalFrames);
                
                for (let frameIndex = startIdx; frameIndex < endIdx; frameIndex++) {
                    const frameInfo = frameData[frameIndex];
                    const time = frameInfo.time;
                    const energy = {
                        bass: frameInfo.bass * settings.sensitivity,
                        mid: frameInfo.mid * settings.sensitivity,
                        treble: frameInfo.treble * settings.sensitivity,
                        average: frameInfo.average * settings.sensitivity,
                        spectrum: frameInfo.spectrum || new Array(128).fill(128)
                    };

                    // 清空画布 - 使用透明背景
                    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
                    ctx.fillRect(0, 0, width, height);

                    // 获取叠加层位置
                    const overlay = settings.overlayRect || { x: 0, y: 0, width, height };
                    const scaleX = width / (videoStream?.width || width);
                    const scaleY = height / (videoStream?.height || height);
                    
                    // 计算特效区域（相对于整个画布）
                    const overlayX = (overlay.x - 20) * scaleX;
                    const overlayY = (overlay.y - 20) * scaleY;
                    const overlayW = overlay.width * scaleX;
                    const overlayH = overlay.height * scaleY;

                    // 保存上下文并裁剪到叠加层区域
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(overlayX, overlayY, overlayW, overlayH);
                    ctx.clip();

                    // 绘制特效 - 只绘制在叠加层区域内
                    const theme = colorThemes[settings.colors] || colorThemes.purple;
                    drawEffect(ctx, overlayX, overlayY, overlayW, overlayH, energy, time, theme, settings.type, particles, settings);

                    ctx.restore();

                    // 保存帧 - 使用 PNG 保留透明通道
                    const buffer = canvas.toBuffer('image/png');
                    const framePath = path.join(framesDir, `frame_${frameIndex.toString().padStart(6, '0')}.png`);
                    fs.writeFileSync(framePath, buffer);
                    
                    // 更新进度
                    if (frameIndex % 30 === 0 || frameIndex === totalFrames - 1) {
                        task.progress = Math.floor((frameIndex / totalFrames) * 50);
                        task.message = `生成帧 ${frameIndex}/${totalFrames}`;
                    }
                }
                
                // 释放 canvas 引用，帮助垃圾回收
                canvas.width = 0;
                canvas.height = 0;
                
                // 处理下一批或完成
                if (endIdx < totalFrames) {
                    // 给事件循环一个喘息的机会，让垃圾回收器运行
                    setImmediate(() => processBatch(endIdx));
                } else {
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
            drawParticles(ctx, centerX, centerY, w, h, energy, time, theme, particles);
            break;
        case 'spectrum':
            drawSpectrum(ctx, x, y, w, h, energy, theme, settings);
            break;
        case 'wave':
            drawWave(ctx, x, y, w, h, energy, time, theme, settings);
            break;
        case 'circular':
            drawCircular(ctx, centerX, centerY, w, h, energy, time, theme);
            break;
        case 'particles-up':
            drawParticlesUp(ctx, x, y, w, h, energy, time, theme, particles);
            break;
        default:
            drawParticles(ctx, centerX, centerY, w, h, energy, time, theme, particles);
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
function drawParticles(ctx, centerX, centerY, w, h, energy, time, theme, particles) {
    particles.forEach((p, i) => {
        const speedMultiplier = 1 + energy.bass * 3;
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            p.x += (dx / dist) * energy.bass * 2;
            p.y += (dy / dist) * energy.bass * 2;
        }

        const hue = (theme.hue + time * 30 + i * 2) % 360;
        const size = p.size * (1 + energy.mid * 2);
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${0.5 + energy.average * 0.5})`;
        ctx.fill();
    });

    const pulseSize = Math.min(w, h) * 0.1 + energy.bass * Math.min(w, h) * 0.2;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseSize);
    gradient.addColorStop(0, `hsla(${theme.hue}, ${theme.sat}%, ${theme.light}%, ${energy.bass * 0.5})`);
    gradient.addColorStop(1, 'transparent');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

// 粒子上升效果
function drawParticlesUp(ctx, x, y, w, h, energy, time, theme, particles) {
    particles.forEach((p, i) => {
        p.life += 0.01;
        if (p.life > p.maxLife) {
            p.life = 0;
            p.x = x + Math.random() * w;
            p.y = y + h + 10;
        }

        const speed = (1 + energy.bass * 5) * (1 + p.size / 3);
        p.y -= speed;
        p.x += Math.sin(time * 3 + i) * 0.5;

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * (0.3 + energy.average * 0.7);
        const hue = (theme.hue + (p.y - y) / h * 60) % 360;
        const size = p.size * (1 + energy.mid * 2);

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        ctx.fill();
    });
}

// 频谱效果 - 增强版
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

    for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * energy.spectrum.length);
        const value = energy.spectrum[dataIndex] || 0;
        const barHeight = (value / 255) * h * 0.8 * energy.average;

        const hue = (theme.hue + (i / barCount) * 60) % 360;
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
}

// 波形效果 - 增强版
function drawWave(ctx, x, y, w, h, energy, time, theme, settings) {
    const origin = settings.waveOrigin || 'center';
    const amplitude = settings.amplitude || 1;
    const frequency = settings.frequency || 2;
    const lineWidth = settings.lineWidth || 3;
    const lines = settings.waveLines || 1;
    const glow = settings.glowEffect !== false;

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
            const dataIndex = Math.floor(t * energy.spectrum.length);
            const v = ((energy.spectrum[dataIndex] || 128) / 128) - 1;

            let px, py;
            const waveHeight = h * 0.3 * amplitude * (1 + energy.bass);

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
function drawCircular(ctx, centerX, centerY, w, h, energy, time, theme) {
    const radius = Math.min(w, h) * 0.35;
    const bars = 60;

    ctx.beginPath();
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        // 模拟频谱数据
        const amp = (Math.sin(i * 0.5 + time * 3) * 0.5 + 0.5) * radius * 0.3 * (1 + energy.bass);
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

    const centerPulse = radius * 0.2 + energy.bass * radius * 0.3;
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
                '[1:v]format=rgba[fx];',
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
                '[0:v]scale=' + width + ':' + height + ':force_original_aspect_ratio=decrease,pad=' + width + ':' + height + ':(ow-iw)/2:(oh-ih)/2[bg];',
                // 特效帧格式转换
                '[2:v]format=rgba[fx];',
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

        const settings = JSON.parse(req.body.settings || '{}');
        const taskId = uuidv4();
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
                task.message = '生成可视化帧...';
                const { framesDir, fps, width, height } = await generateVisualizationFrames(
                    videoFile.path, settings, taskId, outputDir
                );

                // 2. 合并视频 - 将透明特效帧叠加到原视频或背景图上
                const outputFilename = `exported_${Date.now()}.mp4`;
                const outputPath = path.join(exportsDir, outputFilename);
                
                if (settings.useBgImage && task.bgImagePath) {
                    // 使用背景图作为基底
                    await mergeWithBackground(task.bgImagePath, videoFile.path, framesDir, fps, width, height, outputPath, taskId);
                } else {
                    // 使用原视频作为基底
                    await mergeVideoWithEffect(videoFile.path, framesDir, fps, width, height, outputPath, taskId);
                }

                // 3. 清理临时文件
                task.outputPath = outputPath;
                task.outputUrl = `/exports/${outputFilename}`;
                
                // 清理
                fs.rmSync(outputDir, { recursive: true, force: true });
                fs.unlinkSync(videoFile.path);
                if (task.bgImagePath) {
                    fs.unlinkSync(task.bgImagePath);
                }

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
    const task = exportTasks.get(req.params.taskId);
    if (!task) {
        return res.status(404).json({ error: '任务不存在' });
    }
    res.json(task);
});

// 下载导出的视频
app.get('/api/export/download/:taskId', (req, res) => {
    const task = exportTasks.get(req.params.taskId);
    if (!task || task.status !== 'completed') {
        return res.status(404).json({ error: '视频不存在或未完成' });
    }

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
