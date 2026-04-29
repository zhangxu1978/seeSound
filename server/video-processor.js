
// 视频处理模块
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { createCanvas } = require('canvas');
const AudioAnalyzer = require('../audio-analyzer');
const { colorThemes } = require('./config');
const { getEncoderConfig, getEncoderOptions } = require('./gpu-detector');
const { drawEffect } = require('./effects');
const { drawServerSubtitles, registerSubtitleFont } = require('./subtitles');

// 生成可视化帧
async function generateVisualizationFrames(inputPath, settings, taskId, outputDir, subtitleData) {
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

    // 分析音频数据
    const analyzer = new AudioAnalyzer();
    console.log(`[${taskId}] 🎵 提取音频数据...`);
    try {
        await analyzer.extractAudioData(inputPath);
        console.log(`[${taskId}] ✅ 音频提取完成, 时长: ${analyzer.duration.toFixed(2)}秒`);
    } catch (err) {
        console.warn(`[${taskId}] ⚠️ 音频提取失败, 使用模拟数据:`, err.message);
        analyzer.duration = 60;
    }

    const totalFrames = Math.floor(analyzer.duration * fps);
    console.log(`[${taskId}] 🖼️ 待生成帧数: ${totalFrames}`);

    // 计算特效区域大小用于粒子初始化
    let overlay = settings.overlayRect;

    // 如果没有overlayRect但有position设置，根据position计算overlayRect
    if (!overlay && settings.position) {
        const positions = {
            'fullscreen': { x: 0, y: 0, width: width, height: height },
            'bottom': { x: 0, y: height * 0.75, width: width, height: height * 0.25 },
            'top': { x: 0, y: 0, width: width, height: height * 0.25 },
            'center': { x: width * 0.2, y: height * 0.3, width: width * 0.6, height: height * 0.4 },
            'left': { x: 0, y: 0, width: width * 0.3, height: height },
            'right': { x: width * 0.7, y: 0, width: width * 0.3, height: height }
        };
        overlay = positions[settings.position] || { x: 0, y: 0, width, height };
    } else if (!overlay) {
        // 默认全屏
        overlay = { x: 0, y: 0, width, height };
    }

    const scaleFactor = settings.scaleFactor || 1;
    const canvasW = settings.canvasWidth || width;
    const canvasH = settings.canvasHeight || height;
    const exportScaleX = width / canvasW;
    const exportScaleY = height / canvasH;
    const effectWidth = overlay.width * scaleFactor * exportScaleX;
    const effectHeight = overlay.height * scaleFactor * exportScaleY;

    // 初始化粒子
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
    console.log(`[${taskId}] ✨ 粒子初始化: effectWidth=${effectWidth.toFixed(0)}, effectHeight=${effectHeight.toFixed(0)}`);

    // 注册字幕字体
    let registeredFontName = null;
    if (settings.subtitle) {
        registeredFontName = registerSubtitleFont(settings.subtitle);
    }

    // 流式处理：逐帧生成
    const batchSize = 30;

    return new Promise((resolve, reject) => {
        const processBatch = async (startIdx) => {
            try {
                const canvas = createCanvas(width, height);
                const ctx = canvas.getContext('2d');

                const endIdx = Math.min(startIdx + batchSize, totalFrames);

                for (let frameIndex = startIdx; frameIndex < endIdx; frameIndex++) {
                    const time = frameIndex / fps;
                    const frameEnergy = analyzer.getSpectrumAtTime(time);

                    const sensitivity = settings.sensitivity || settings.sensitivty || 1;

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

                    // 使用前面计算好的overlay
                    const overlayX = overlay.x;
                    const overlayY = overlay.y;
                    const overlayW = overlay.width;
                    const overlayH = overlay.height;

                    // 只在第一帧输出调试信息
                    if (frameIndex === 0) {
                        console.log(`[${taskId}] 🔧 叠加层设置: x=${overlay.x}, y=${overlay.y}, w=${overlay.width}, h=${overlay.height}`);
                        console.log(`[${taskId}] 🔧 videoCanvas尺寸: ${canvasW}x${canvasH}, 导出尺寸: ${width}x${height}`);
                        console.log(`[${taskId}] 🔧 scaleFactor=${scaleFactor}, exportScale=${exportScaleX}x${exportScaleY}`);
                        console.log(`[${taskId}] 🔍 settings.type = "${settings.type}"`);
                        console.log(`[${taskId}] 🔍 settings.colors = "${settings.colors}"`);
                    }

                    // 保存上下文并裁剪到叠加层区域
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(overlayX, overlayY, overlayW, overlayH);
                    ctx.clip();

                    const theme = colorThemes[settings.colors] || colorThemes.purple;

                    // 传递 taskId 到 settings
                    const settingsWithTaskId = { ...settings, taskId };
                    drawEffect(ctx, overlayX, overlayY, overlayW, overlayH, energy, time, theme, settings.type, particles, settingsWithTaskId);

                    ctx.restore();

                    // 绘制字幕
                    if (settings.subtitle && subtitleData && subtitleData.length > 0) {
                        drawServerSubtitles(ctx, width, height, time, settings.subtitle, subtitleData);
                    }

                    // 保存帧
                    const buffer = canvas.toBuffer('image/png');
                    const framePath = path.join(framesDir, `frame_${frameIndex.toString().padStart(6, '0')}.png`);
                    fs.writeFileSync(framePath, buffer);

                    // 更新进度
                    if (frameIndex % 30 === 0 || frameIndex === totalFrames - 1) {
                        const progress = Math.floor((frameIndex / totalFrames) * 50);
                        console.log(`[${taskId}] 📝 帧生成进度: ${frameIndex}/${totalFrames} (${progress}%)`);
                    }
                }

                // 释放 canvas 引用
                canvas.width = 0;
                canvas.height = 0;

                if (endIdx < totalFrames) {
                    setImmediate(() => processBatch(endIdx));
                } else {
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

// 合并视频和特效
async function mergeVideoWithEffect(inputPath, framesDir, fps, width, height, outputPath, taskId) {
    const gpuConfig = await getEncoderConfig();
    const useGPU = gpuConfig.available;
    const encoder = gpuConfig.encoder || 'libx264';
    const gpuOptions = getEncoderOptions(encoder);

    console.log(`[${taskId}] 🎬 开始合并视频...`);
    if (useGPU) {
        console.log(`[${taskId}] 🎮 使用 ${gpuConfig.gpuType} GPU 加速编码`);
    }

    return new Promise((resolve, reject) => {
        const command = ffmpeg()
            .input(inputPath)
            .input(path.join(framesDir, 'frame_%06d.png'))
            .inputFPS(fps)
            .inputOptions(['-thread_queue_size 512'])
            .complexFilter([
                '[1:v]format=rgba[fx]',
                '[0:v][fx]overlay=0:0:format=auto:repeatlast=0[output]'
            ])
            .outputOptions([
                '-map [output]',
                '-map 0:a?',
                `-c:v ${encoder}`,
                ...gpuOptions,
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
                console.log(`[${taskId}] FFmpeg 命令:`, cmd);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    const progressVal = 50 + Math.floor(progress.percent * 0.5);
                    console.log(`[${taskId}] 🎬 合成进度: ${progressVal}%`);
                }
            })
            .on('end', () => {
                console.log(`[${taskId}] ✅ 视频导出完成: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                console.error(`[${taskId}] FFmpeg 错误:`, err);
                console.error(`[${taskId}] FFmpeg stderr:`, stderr);
                reject(err);
            })
            .run();
    });
}

// 合并背景图、音频和特效
async function mergeWithBackground(bgImagePath, audioPath, framesDir, fps, width, height, outputPath, taskId) {
    const gpuConfig = await getEncoderConfig();
    const useGPU = gpuConfig.available;
    const encoder = gpuConfig.encoder || 'libx264';
    const gpuOptions = getEncoderOptions(encoder);

    console.log(`[${taskId}] 🎬 开始合并视频(背景图模式)...`);
    if (useGPU) {
        console.log(`[${taskId}] 🎮 使用 ${gpuConfig.gpuType} GPU 加速编码`);
    }

    return new Promise((resolve, reject) => {
        const command = ffmpeg()
            .input(bgImagePath)
            .inputOptions(['-loop 1'])
            .input(audioPath)
            .input(path.join(framesDir, 'frame_%06d.png'))
            .inputFPS(fps)
            .inputOptions(['-thread_queue_size 512'])
            .complexFilter([
                `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[bg]`,
                '[2:v]format=rgba[fx]',
                '[bg][fx]overlay=0:0:format=auto:repeatlast=0[output]'
            ])
            .outputOptions([
                '-map [output]',
                '-map 1:a?',
                `-c:v ${encoder}`,
                ...gpuOptions,
                '-pix_fmt yuv420p',
                '-c:a aac',
                '-b:a 192k',
                '-movflags +faststart',
                '-shortest',
                '-vsync cfr'
            ])
            .output(outputPath);

        command
            .on('start', (cmd) => {
                console.log(`[${taskId}] FFmpeg 命令:`, cmd);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    const progressVal = 50 + Math.floor(progress.percent * 0.5);
                    console.log(`[${taskId}] 🎬 合成进度: ${progressVal}%`);
                }
            })
            .on('end', () => {
                console.log(`[${taskId}] ✅ 视频导出完成(背景图模式): ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err, stdout, stderr) => {
                console.error(`[${taskId}] FFmpeg 错误:`, err);
                console.error(`[${taskId}] FFmpeg stderr:`, stderr);
                reject(err);
            })
            .run();
    });
}

module.exports = {
    generateVisualizationFrames,
    mergeVideoWithEffect,
    mergeWithBackground
};

