
// 视频导出模块

let lastTime = 0;
let connectedElements = new WeakSet();

// 初始化音频上下文
function initAudioContext() {
    if (!seesound.audioContext) {
        seesound.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        seesound.analyser = seesound.audioContext.createAnalyser();
        seesound.analyser.fftSize = 256;
        seesound.analyser.smoothingTimeConstant = 0.8;
        seesound.bufferLength = seesound.analyser.frequencyBinCount;
        seesound.dataArray = new Uint8Array(seesound.bufferLength);
    }
}

// 连接音频源
function connectAudioSource(element) {
    if (connectedElements.has(element)) {
        return;
    }
    
    if (seesound.source) {
        try {
            seesound.source.disconnect();
        } catch (e) {
            console.warn('断开音频源失败:', e);
        }
    }
    
    try {
        seesound.source = seesound.audioContext.createMediaElementSource(element);
        seesound.source.connect(seesound.analyser);
        seesound.analyser.connect(seesound.audioContext.destination);
        connectedElements.add(element);
    } catch (e) {
        console.error('创建音频源失败:', e);
    }
}

// 设置画布大小
function setupCanvasSize(width, height) {
    const container = document.getElementById('previewContainer');
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;
    
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const canvasWidth = width * scale;
    const canvasHeight = height * scale;

    seesound.videoCanvas.width = width;
    seesound.videoCanvas.height = height;
    seesound.videoCanvas.style.width = canvasWidth + 'px';
    seesound.videoCanvas.style.height = canvasHeight + 'px';

    seesound.effectCanvas.width = width;
    seesound.effectCanvas.height = height;

    if (seesound.effectLayer) {
        seesound.effectLayer.style.width = canvasWidth + 'px';
        seesound.effectLayer.style.height = canvasHeight + 'px';
        seesound.effectLayer.style.left = '20px';
        seesound.effectLayer.style.top = '20px';
    }
    
    if (seesound.subtitleLayer) {
        seesound.subtitleLayer.style.width = canvasWidth + 'px';
        seesound.subtitleLayer.style.height = canvasHeight + 'px';
        seesound.subtitleLayer.style.left = '20px';
        seesound.subtitleLayer.style.top = '20px';
    }
    
    if (seesound.textLayer) {
        seesound.textLayer.style.width = canvasWidth + 'px';
        seesound.textLayer.style.height = canvasHeight + 'px';
        seesound.textLayer.style.left = '20px';
        seesound.textLayer.style.top = '20px';
    }
    
    if (seesound.subtitleCanvas) {
        seesound.subtitleCanvas.width = width;
        seesound.subtitleCanvas.height = height;
    }
    
    if (seesound.textLayerCanvas) {
        seesound.textLayerCanvas.width = width;
        seesound.textLayerCanvas.height = height;
    }
}

// 应用位置预设
function applyPositionPreset(layerType, position) {
    let layer;
    if (layerType === 'effect') {
        layer = seesound.effectLayer;
    } else if (layerType === 'subtitle') {
        layer = seesound.subtitleLayer;
    } else if (layerType === 'text') {
        layer = seesound.textLayer;
    }
    
    if (!layer) return;

    const canvasWidth = parseInt(seesound.videoCanvas.style.width) || 1280;
    const canvasHeight = parseInt(seesound.videoCanvas.style.height) || 720;

    const positions = {
        'fullscreen': { width: canvasWidth, height: canvasHeight, left: 0, top: 0 },
        'bottom': { width: canvasWidth, height: canvasHeight * 0.25, left: 0, top: canvasHeight * 0.75 },
        'top': { width: canvasWidth, height: canvasHeight * 0.25, left: 0, top: 0 },
        'center': { width: canvasWidth * 0.6, height: canvasHeight * 0.4, left: canvasWidth * 0.2, top: canvasHeight * 0.3 },
        'left': { width: canvasWidth * 0.3, height: canvasHeight, left: 0, top: 0 },
        'right': { width: canvasWidth * 0.3, height: canvasHeight, left: canvasWidth * 0.7, top: 0 }
    };

    const pos = positions[position];
    if (pos) {
        layer.style.width = pos.width + 'px';
        layer.style.height = pos.height + 'px';
        layer.style.left = pos.left + 'px';
        layer.style.top = pos.top + 'px';
    }
}

// 拖拽调整大小功能已移至 events.js 中的 bindLayerDragEvents()

// 播放控制
function togglePlay() {
    const element = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
    if (!element.src) return;

    if (seesound.isPlaying) {
        element.pause();
        document.getElementById('playBtn').textContent = '▶';
    } else {
        element.play();
        document.getElementById('playBtn').textContent = '⏸';
    }
    seesound.isPlaying = !seesound.isPlaying;
}

// 进度条控制
function seekVideo(e) {
    const element = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
    if (!element.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    element.currentTime = percent * element.duration;
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    seesound.currentFile = file;
    const url = URL.createObjectURL(file);
    seesound.isVideo = file.type.startsWith('video/');

    document.getElementById('filename').textContent = file.name;
    document.getElementById('fileDetails').textContent = 
        `${seesound.isVideo ? '视频' : '音频'} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    document.getElementById('fileInfo').style.display = 'block';

    initAudioContext();

    if (seesound.isVideo) {
        seesound.videoElement.src = url;
        seesound.videoElement.load();
        seesound.videoElement.onloadedmetadata = () => {
            setupCanvasSize(seesound.videoElement.videoWidth, seesound.videoElement.videoHeight);
            seesound.videoElement.play();
            seesound.isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
            if (seesound.effectLayer) seesound.effectLayer.style.display = 'block';
            connectAudioSource(seesound.videoElement);
            animate();
        };
    } else {
        seesound.audioElement.src = url;
        seesound.audioElement.load();
        setupCanvasSize(1280, 720);
        if (seesound.effectLayer) seesound.effectLayer.style.display = 'block';
        seesound.audioElement.oncanplay = () => {
            seesound.audioElement.play();
            seesound.isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
            connectAudioSource(seesound.audioElement);
            animate();
        };
    }

    document.getElementById('exportBtn').disabled = false;
}

// 处理背景图片选择
function handleBgImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    seesound.bgImageFile = file;
    const url = URL.createObjectURL(file);

    seesound.bgImage = new Image();
    seesound.bgImage.onload = () => {
        seesound.useBgImage = true;

        document.getElementById('bgFilename').textContent = file.name;
        document.getElementById('bgFileDetails').textContent = `${seesound.bgImage.width}×${seesound.bgImage.height} · ${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('bgFileInfo').style.display = 'block';

        setupCanvasSize(seesound.bgImage.width, seesound.bgImage.height);

        if (seesound.effectLayer) seesound.effectLayer.style.display = 'block';

        if (!seesound.animationId) {
            animate();
        }

        if (seesound.currentFile && !seesound.isPlaying) {
            if (seesound.isVideo) {
                seesound.videoElement.play();
            } else {
                seesound.audioElement.play();
            }
            seesound.isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
        }
    };
    seesound.bgImage.src = url;
}

// 移除背景图片
function removeBgImage() {
    seesound.bgImage = null;
    seesound.bgImageFile = null;
    seesound.useBgImage = false;

    document.getElementById('bgImageFile').value = '';
    document.getElementById('bgFileInfo').style.display = 'none';

    if (seesound.currentFile) {
        if (seesound.isVideo && seesound.videoElement.videoWidth) {
            setupCanvasSize(seesound.videoElement.videoWidth, seesound.videoElement.videoHeight);
        } else {
            setupCanvasSize(1280, 720);
        }
    }
}

// 保存配置
function saveConfig() {
    const config = {
        effectSettings: {
            type: seesound.effectSettings.type,
            colors: seesound.effectSettings.colors,
            sensitivity: seesound.effectSettings.sensitivity,
            opacity: seesound.effectSettings.opacity,
            barDirection: seesound.effectSettings.barDirection,
            barCount: seesound.effectSettings.barCount,
            barWidth: seesound.effectSettings.barWidth,
            barGap: seesound.effectSettings.barGap,
            barRadius: seesound.effectSettings.barRadius,
            mirrorEffect: seesound.effectSettings.mirrorEffect,
            gradientDirection: seesound.effectSettings.gradientDirection,
            barBrick: seesound.effectSettings.barBrick,
            waveOrigin: seesound.effectSettings.waveOrigin,
            amplitude: seesound.effectSettings.amplitude,
            frequency: seesound.effectSettings.frequency,
            lineWidth: seesound.effectSettings.lineWidth,
            waveLines: seesound.effectSettings.waveLines,
            glowEffect: seesound.effectSettings.glowEffect,
            transformType: seesound.effectSettings.transformType,
            transformIntensity: seesound.effectSettings.transformIntensity,
            transformSpeed: seesound.effectSettings.transformSpeed,
            position: seesound.effectSettings.position
        },
        overlayPosition: {
            width: seesound.effectLayer ? seesound.effectLayer.style.width : '100%',
            height: seesound.effectLayer ? seesound.effectLayer.style.height : '100%',
            left: seesound.effectLayer ? seesound.effectLayer.style.left : '0px',
            top: seesound.effectLayer ? seesound.effectLayer.style.top : '0px'
        }
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seesound-config.json';
    a.click();
    URL.revokeObjectURL(url);
}

// 载入配置文件
function loadConfigFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const config = JSON.parse(event.target.result);

            if (config.effectSettings) {
                Object.assign(seesound.effectSettings, config.effectSettings);

                document.getElementById('effectType').value = seesound.effectSettings.type;
                document.getElementById('sensitivity').value = seesound.effectSettings.sensitivity;
                document.getElementById('sensitivityValue').textContent = seesound.effectSettings.sensitivity;
                document.getElementById('opacity').value = seesound.effectSettings.opacity;
                document.getElementById('opacityValue').textContent = seesound.effectSettings.opacity;

                document.getElementById('barDirection').value = seesound.effectSettings.barDirection;
                document.getElementById('barCount').value = seesound.effectSettings.barCount;
                document.getElementById('barCountValue').textContent = seesound.effectSettings.barCount;
                document.getElementById('barWidth').value = seesound.effectSettings.barWidth;
                document.getElementById('barWidthValue').textContent = seesound.effectSettings.barWidth;
                document.getElementById('barGap').value = seesound.effectSettings.barGap;
                document.getElementById('barGapValue').textContent = seesound.effectSettings.barGap;
                document.getElementById('barRadius').value = seesound.effectSettings.barRadius;
                document.getElementById('barRadiusValue').textContent = seesound.effectSettings.barRadius;
                document.getElementById('mirrorEffect').checked = seesound.effectSettings.mirrorEffect;
                document.getElementById('gradientDirection').value = seesound.effectSettings.gradientDirection;
                if (typeof seesound.effectSettings.barBrick !== 'undefined') {
                    document.getElementById('barBrick').checked = seesound.effectSettings.barBrick;
                }

                document.getElementById('waveOrigin').value = seesound.effectSettings.waveOrigin;
                document.getElementById('amplitude').value = seesound.effectSettings.amplitude;
                document.getElementById('amplitudeValue').textContent = seesound.effectSettings.amplitude;
                document.getElementById('frequency').value = seesound.effectSettings.frequency;
                document.getElementById('frequencyValue').textContent = seesound.effectSettings.frequency;
                document.getElementById('lineWidth').value = seesound.effectSettings.lineWidth;
                document.getElementById('lineWidthValue').textContent = seesound.effectSettings.lineWidth;
                document.getElementById('waveLines').value = seesound.effectSettings.waveLines;
                document.getElementById('waveLinesValue').textContent = seesound.effectSettings.waveLines;
                document.getElementById('glowEffect').checked = seesound.effectSettings.glowEffect;

                document.getElementById('transformType').value = seesound.effectSettings.transformType;
                document.getElementById('transformIntensity').value = seesound.effectSettings.transformIntensity;
                document.getElementById('transformIntensityValue').textContent = seesound.effectSettings.transformIntensity;
                document.getElementById('transformSpeed').value = seesound.effectSettings.transformSpeed;
                document.getElementById('transformSpeedValue').textContent = seesound.effectSettings.transformSpeed;

                updateSettingsVisibility();

                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                    if (opt.dataset.colors === seesound.effectSettings.colors) {
                        opt.classList.add('active');
                    }
                });

                document.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.position === seesound.effectSettings.position) {
                        btn.classList.add('active');
                    }
                });

                applyPositionPreset(seesound.effectSettings.position);
            }

            if (config.overlayPosition && seesound.effectLayer) {
                const effectLayer = seesound.effectLayer;
                if (config.overlayPosition.width) effectLayer.style.width = config.overlayPosition.width;
                if (config.overlayPosition.height) effectLayer.style.height = config.overlayPosition.height;
                if (config.overlayPosition.left) effectLayer.style.left = config.overlayPosition.left;
                if (config.overlayPosition.top) effectLayer.style.top = config.overlayPosition.top;
            }

            initParticles();
        } catch (err) {
            alert('配置文件格式错误');
            console.error(err);
        }
    };
    reader.readAsText(file);
    document.getElementById('configFile').value = '';
}

// 动画主循环
function animate(time = 0) {
    seesound.animationId = requestAnimationFrame(animate);

    seesound.videoCtx.clearRect(0, 0, seesound.videoCanvas.width, seesound.videoCanvas.height);

    if (seesound.useBgImage && seesound.bgImage) {
        seesound.videoCtx.drawImage(seesound.bgImage, 0, 0, seesound.videoCanvas.width, seesound.videoCanvas.height);
    } else if (seesound.isVideo) {
        try {
            seesound.videoCtx.drawImage(seesound.videoElement, 0, 0, seesound.videoCanvas.width, seesound.videoCanvas.height);
        } catch (e) {
        }
    } else {
        seesound.videoCtx.fillStyle = '#0d0d1a';
        seesound.videoCtx.fillRect(0, 0, seesound.videoCanvas.width, seesound.videoCanvas.height);
    }

    if (seesound.analyser) {
        seesound.analyser.getByteFrequencyData(seesound.dataArray);
    }

    drawEffectToCanvas(time);

    const mediaElement = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
    const currentTime = mediaElement?.currentTime || 0;
    
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
    
    drawSubtitleLayer(currentTime, energy);
    drawTextLayer();

    if (mediaElement.duration) {
        const percent = (mediaElement.currentTime / mediaElement.duration) * 100;
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('timeDisplay').textContent = 
            `${formatTime(mediaElement.currentTime)} / ${formatTime(mediaElement.duration)}`;
    }
}

// 浏览器录制导出
async function exportVideoBrowser() {
    if (!seesound.currentFile) return;

    const progressEl = document.getElementById('exportProgress');
    const progressBar = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressText');
    const exportBtn = document.getElementById('exportBtn');

    progressEl.classList.add('active');
    exportBtn.disabled = true;

    if (!window.MediaRecorder) {
        progressText.textContent = '浏览器不支持录制，使用传统导出';
        await exportVideoServer();
        return;
    }

    try {
        progressText.textContent = '准备录制...';
        progressBar.style.width = '5%';

        const mediaElement = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
        const wasPlaying = seesound.isPlaying;

        mediaElement.pause();
        mediaElement.currentTime = 0;
        seesound.isPlaying = false;
        document.getElementById('playBtn').textContent = '▶';

        if (!seesound.audioContext) initAudioContext();

        const effectLayer = seesound.effectLayer;
        const effectLayerRect = effectLayer ? effectLayer.getBoundingClientRect() : null;
        const canvasRect = seesound.videoCanvas.getBoundingClientRect();

        const scaleX = seesound.videoCanvas.width / canvasRect.width;
        const scaleY = seesound.videoCanvas.height / canvasRect.height;
        const effectLayerX = effectLayerRect ? (effectLayerRect.left - canvasRect.left) * scaleX : 0;
        const effectLayerY = effectLayerRect ? (effectLayerRect.top - canvasRect.top) * scaleY : 0;
        const effectLayerW = effectLayerRect ? effectLayerRect.width * scaleX : seesound.videoCanvas.width;
        const effectLayerH = effectLayerRect ? effectLayerRect.height * scaleY : seesound.videoCanvas.height;

        let audioStream;
        try {
            const dest = seesound.audioContext.createMediaStreamDestination();
            if (seesound.source) seesound.source.connect(dest);
            seesound.analyser.connect(dest);
            audioStream = dest.stream;
        } catch (e) {
            console.warn('音频录制可能有问题:', e);
        }

        const videoStream = seesound.videoCanvas.captureStream(30);

        let combinedStream;
        if (audioStream) {
            combinedStream = new MediaStream([
                ...videoStream.getVideoTracks(),
                ...audioStream.getAudioTracks()
            ]);
        } else {
            combinedStream = videoStream;
        }

        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        let selectedMimeType = '';
        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                selectedMimeType = type;
                break;
            }
        }

        const recorder = new MediaRecorder(combinedStream, {
            mimeType: selectedMimeType,
            videoBitsPerSecond: 8 * 1024 * 1024
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        const duration = mediaElement.duration;
        progressText.textContent = `录制中 (0/${formatTime(duration)})...`;
        progressBar.style.width = '10%';

        let startTime = null;
        let progressInterval = null;
        let recordingActive = false;

        const originalAnimationId = seesound.animationId;
        if (originalAnimationId) {
            cancelAnimationFrame(originalAnimationId);
        }

        const origEffectW = seesound.effectCanvas.width;
        const origEffectH = seesound.effectCanvas.height;

        function drawVideoWithEffects(time) {
            const ctx = seesound.videoCtx;
            const w = seesound.videoCanvas.width;
            const h = seesound.videoCanvas.height;

            ctx.clearRect(0, 0, w, h);

            if (seesound.useBgImage && seesound.bgImage) {
                ctx.drawImage(seesound.bgImage, 0, 0, w, h);
            } else if (seesound.isVideo) {
                try {
                    ctx.drawImage(seesound.videoElement, 0, 0, w, h);
                } catch (e) {}
            } else {
                ctx.fillStyle = '#0d0d1a';
                ctx.fillRect(0, 0, w, h);
            }

            if (seesound.analyser) {
                seesound.analyser.getByteFrequencyData(seesound.dataArray);
            }

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

            ctx.save();
            ctx.beginPath();
            ctx.rect(effectLayerX, effectLayerY, effectLayerW, effectLayerH);
            ctx.clip();

            seesound.effectCanvas.width = effectLayerW;
            seesound.effectCanvas.height = effectLayerH;
            seesound.effectCtx.clearRect(0, 0, effectLayerW, effectLayerH);

            drawEffectToCanvas(time);

            ctx.drawImage(seesound.effectCanvas, effectLayerX, effectLayerY, effectLayerW, effectLayerH);

            seesound.effectCanvas.width = origEffectW;
            seesound.effectCanvas.height = origEffectH;

            ctx.restore();

            const currentTime = (Date.now() - startTime) * 0.001;
            drawSubtitleLayer(currentTime, energy);
            drawTextLayer();

            if (seesound.subtitleCanvas) {
                ctx.drawImage(seesound.subtitleCanvas, 0, 0, w, h);
            }
            if (seesound.textLayerCanvas) {
                ctx.drawImage(seesound.textLayerCanvas, 0, 0, w, h);
            }
        }

        let recordingAnimationId = null;

        function recordingLoop() {
            if (!recordingActive) return;

            const currentTime = (Date.now() - startTime) * 0.001;
            drawVideoWithEffects(currentTime * 1000);

            recordingAnimationId = requestAnimationFrame(recordingLoop);
        }

        recorder.onstart = () => {
            startTime = Date.now();
            recordingActive = true;
            mediaElement.play();
            seesound.isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';

            progressInterval = setInterval(() => {
                if (!recordingActive) return;
                const elapsed = (Date.now() - startTime) / 1000;
                const percent = Math.min(95, 10 + (elapsed / duration) * 85);
                progressBar.style.width = percent + '%';
                progressText.textContent = `录制中 (${formatTime(elapsed)}/${formatTime(duration)})...`;
            }, 100);

            requestAnimationFrame(recordingLoop);
        };

        recorder.onstop = () => {
            clearInterval(progressInterval);
            recordingActive = false;

            if (recordingAnimationId) {
                cancelAnimationFrame(recordingAnimationId);
            }

            if (originalAnimationId) {
                animate();
            }

            progressText.textContent = '正在处理...';
            progressBar.style.width = '96%';

            const blob = new Blob(chunks, { type: selectedMimeType || 'video/webm' });

            if (blob.size === 0) {
                progressText.textContent = '录制失败，文件为空';
                exportBtn.disabled = false;
                return;
            }

            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `seesound-export-${Date.now()}.webm`;
            a.click();

            progressBar.style.width = '100%';
            progressText.textContent = '导出完成！';

            setTimeout(() => {
                progressEl.classList.remove('active');
                exportBtn.disabled = false;
                URL.revokeObjectURL(url);
            }, 3000);

            if (wasPlaying) {
                mediaElement.play();
                seesound.isPlaying = true;
                document.getElementById('playBtn').textContent = '⏸';
            }
        };

        mediaElement.onended = () => {
            recordingActive = false;
            recorder.stop();
            seesound.isPlaying = false;
            document.getElementById('playBtn').textContent = '▶';
        };

        recorder.start(100);

    } catch (error) {
        console.error('录制失败:', error);
        progressText.textContent = '录制失败，使用传统导出...';
        await new Promise(r => setTimeout(r, 1000));
        await exportVideoServer();
    }
}

// 传统服务器导出
async function exportVideoServer() {
    if (!seesound.currentFile) return;

    const progressEl = document.getElementById('exportProgress');
    const progressBar = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressText');
    const exportBtn = document.getElementById('exportBtn');

    try {
        const config = {
            ...seesound.effectSettings,
            resolution: document.getElementById('resolution').value,
            quality: document.getElementById('quality').value,
            canvasWidth: seesound.videoCanvas.width,
            canvasHeight: seesound.videoCanvas.height,
            overlayRect: {
                x: seesound.effectLayer ? (parseInt(seesound.effectLayer.style.left) || 0) : 0,
                y: seesound.effectLayer ? (parseInt(seesound.effectLayer.style.top) || 0) : 0,
                width: seesound.effectLayer ? (parseInt(seesound.effectLayer.style.width) || seesound.videoCanvas.width) : seesound.videoCanvas.width,
                height: seesound.effectLayer ? (parseInt(seesound.effectLayer.style.height) || seesound.videoCanvas.height) : seesound.videoCanvas.height
            },
            scaleFactor: seesound.videoCanvas.width / parseInt(seesound.videoCanvas.style.width || seesound.videoCanvas.width),
            useBgImage: seesound.useBgImage,
            bgImageWidth: seesound.bgImage ? seesound.bgImage.width : null,
            bgImageHeight: seesound.bgImage ? seesound.bgImage.height : null,
            subtitle: seesound.subtitleSettings.enabled ? {
                fontFamily: seesound.subtitleSettings.fontFamily,
                fontSize: seesound.subtitleSettings.fontSize,
                color: seesound.subtitleSettings.color,
                strokeColor: seesound.subtitleSettings.strokeColor,
                strokeWidth: seesound.subtitleSettings.strokeWidth,
                effect: seesound.subtitleSettings.effect,
                position: seesound.subtitleSettings.position,
                subtitles: seesound.subtitleSettings.subtitles
            } : null
        };

        const formData = new FormData();
        formData.append('video', seesound.currentFile);
        formData.append('settings', JSON.stringify(config));

        if (seesound.useBgImage && seesound.bgImageFile) {
            formData.append('bgImage', seesound.bgImageFile);
        }

        if (seesound.subtitleSettings.enabled && seesound.subtitleSettings.subtitles && seesound.subtitleSettings.subtitles.length > 0) {
            const srtContent = subtitlesToSRT(seesound.subtitleSettings.subtitles);
            const srtBlob = new Blob([srtContent], { type: 'text/plain' });
            const srtFileName = seesound.subtitleSettings.srtFile ? seesound.subtitleSettings.srtFile.name : 'subtitles.srt';
            formData.append('subtitle', srtBlob, srtFileName);
        }

        progressText.textContent = '正在上传...';
        progressBar.style.width = '20%';

        const response = await fetch(`${seesound.apiBaseUrl}/api/export`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('导出失败: ' + response.statusText);

        const { taskId } = await response.json();

        const checkProgress = setInterval(async () => {
            const statusRes = await fetch(`${seesound.apiBaseUrl}/api/export/status/${taskId}`);
            const status = await statusRes.json();

            if (status.progress) {
                progressBar.style.width = (20 + status.progress * 0.8) + '%';
                progressText.textContent = status.message || '处理中...';
            }

            if (status.status === 'completed') {
                clearInterval(checkProgress);
                progressText.textContent = '导出完成！';
                progressBar.style.width = '100%';
                window.open(`${seesound.apiBaseUrl}/api/export/download/${taskId}`, '_blank');
                setTimeout(() => {
                    progressEl.classList.remove('active');
                    exportBtn.disabled = false;
                }, 3000);
            } else if (status.status === 'failed') {
                clearInterval(checkProgress);
                progressText.textContent = '导出失败: ' + status.error;
                exportBtn.disabled = false;
            }
        }, 1000);

    } catch (error) {
        progressText.textContent = '错误: ' + error.message;
        exportBtn.disabled = false;
    }
}

// 主导出函数
async function exportVideo() {
    const mode = document.getElementById('exportMode').value;
    if (mode === 'browser') {
        await exportVideoBrowser();
    } else {
        await exportVideoServer();
    }
}

