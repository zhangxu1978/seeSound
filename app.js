// 全局变量
let audioContext, analyser, source;
let videoElement, audioElement;
let videoCanvas, effectCanvas, videoCtx, effectCtx;
let isPlaying = false;
let animationId;
let particles = [];
let dataArray, bufferLength;
let currentFile = null;
let isVideo = false;
let apiBaseUrl = 'http://localhost:3200';

// 背景图片相关
let bgImage = null;
let bgImageFile = null;
let useBgImage = false;

// 动画设置
let effectSettings = {
    type: 'particles',
    colors: 'purple',
    sensitivity: 1,
    opacity: 0.9,
    position: 'fullscreen',
    // 柱状图设置
    barDirection: 'up',
    barCount: 64,
    barWidth: 8,
    barGap: 0.2,
    barRadius: 4,
    mirrorEffect: true,
    gradientDirection: 'vertical',
    // 波形设置
    waveOrigin: 'center',
    amplitude: 1,
    frequency: 2,
    lineWidth: 3,
    waveLines: 1,
    glowEffect: true,
    // 变形设置
    transformType: 'none',
    transformIntensity: 30,
    transformSpeed: 1
};

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

// 初始化
async function init() {
    videoCanvas = document.getElementById('videoCanvas');
    effectCanvas = document.getElementById('effectCanvas');
    videoCtx = videoCanvas.getContext('2d');
    effectCtx = effectCanvas.getContext('2d');

    videoElement = document.getElementById('videoElement');
    audioElement = document.getElementById('audioElement');

    await loadConfig();
    bindEvents();
    setupDragResize();
    initParticles();
    updateSettingsVisibility();
}

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        apiBaseUrl = config.apiBaseUrl;
    } catch (e) {
        console.warn('使用默认配置', e);
    }
}

// 绑定事件
function bindEvents() {
    // 文件上传
    document.getElementById('fileUpload').addEventListener('click', () => {
        document.getElementById('mediaFile').click();
    });
    document.getElementById('mediaFile').addEventListener('change', handleFileSelect);

    // 背景图片上传
    document.getElementById('bgUpload').addEventListener('click', () => {
        document.getElementById('bgImageFile').click();
    });
    document.getElementById('bgImageFile').addEventListener('change', handleBgImageSelect);
    document.getElementById('removeBgBtn').addEventListener('click', removeBgImage);

    // 播放控制
    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('progressBar').addEventListener('click', seekVideo);
    document.getElementById('exportBtn').addEventListener('click', exportVideo);

    // 配置管理
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('loadConfigBtn').addEventListener('click', () => {
        document.getElementById('configFile').click();
    });
    document.getElementById('configFile').addEventListener('change', loadConfig);

    // 效果类型
    document.getElementById('effectType').addEventListener('change', (e) => {
        effectSettings.type = e.target.value;
        updateSettingsVisibility();
        initParticles();
    });

    // 颜色选择
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            effectSettings.colors = opt.dataset.colors;
        });
    });

    // 滑块绑定
    bindSlider('sensitivity', 'sensitivityValue', 'sensitivity');
    bindSlider('opacity', 'opacityValue', 'opacity');

    // 柱状图设置
    bindSlider('barCount', 'barCountValue', 'barCount', true);
    bindSlider('barWidth', 'barWidthValue', 'barWidth', true);
    bindSlider('barGap', 'barGapValue', 'barGap');
    bindSlider('barRadius', 'barRadiusValue', 'barRadius', true);
    document.getElementById('barDirection').addEventListener('change', (e) => effectSettings.barDirection = e.target.value);
    document.getElementById('gradientDirection').addEventListener('change', (e) => effectSettings.gradientDirection = e.target.value);
    document.getElementById('mirrorEffect').addEventListener('change', (e) => effectSettings.mirrorEffect = e.target.checked);

    // 波形设置
    document.getElementById('waveOrigin').addEventListener('change', (e) => effectSettings.waveOrigin = e.target.value);
    bindSlider('amplitude', 'amplitudeValue', 'amplitude');
    bindSlider('frequency', 'frequencyValue', 'frequency');
    bindSlider('lineWidth', 'lineWidthValue', 'lineWidth');
    bindSlider('waveLines', 'waveLinesValue', 'waveLines', true);
    document.getElementById('glowEffect').addEventListener('change', (e) => effectSettings.glowEffect = e.target.checked);

    // 变形设置
    document.getElementById('transformType').addEventListener('change', (e) => effectSettings.transformType = e.target.value);
    bindSlider('transformIntensity', 'transformIntensityValue', 'transformIntensity', true);
    bindSlider('transformSpeed', 'transformSpeedValue', 'transformSpeed');

    // 位置预设
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            effectSettings.position = btn.dataset.position;
            applyPositionPreset(effectSettings.position);
        });
    });
}

// 绑定滑块
function bindSlider(id, valueId, settingKey, isInt = false) {
    const slider = document.getElementById(id);
    const display = document.getElementById(valueId);
    slider.addEventListener('input', (e) => {
        const value = isInt ? parseInt(e.target.value) : parseFloat(e.target.value);
        effectSettings[settingKey] = value;
        display.textContent = value;
    });
}

// 更新设置面板可见性
function updateSettingsVisibility() {
    const spectrumPanel = document.getElementById('spectrumSettings');
    const wavePanel = document.getElementById('waveSettings');

    spectrumPanel.style.display = effectSettings.type === 'spectrum' ? 'block' : 'none';
    wavePanel.style.display = effectSettings.type === 'wave' ? 'block' : 'none';
}

// 初始化音频上下文
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    currentFile = file;
    const url = URL.createObjectURL(file);
    isVideo = file.type.startsWith('video/');

    document.getElementById('filename').textContent = file.name;
    document.getElementById('fileDetails').textContent = 
        `${isVideo ? '视频' : '音频'} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    document.getElementById('fileInfo').style.display = 'block';

    initAudioContext();

    if (isVideo) {
        videoElement.src = url;
        videoElement.load();
        videoElement.onloadedmetadata = () => {
            setupCanvasSize(videoElement.videoWidth, videoElement.videoHeight);
            videoElement.play();
            isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
            document.getElementById('overlayContainer').style.display = 'block';
            connectAudioSource(videoElement);
            animate();
        };
    } else {
        audioElement.src = url;
        audioElement.load();
        setupCanvasSize(1280, 720);
        document.getElementById('overlayContainer').style.display = 'block';
        audioElement.oncanplay = () => {
            audioElement.play();
            isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
            connectAudioSource(audioElement);
            animate();
        };
    }

    document.getElementById('exportBtn').disabled = false;
}

// 连接音频源
let connectedElements = new WeakSet();

function connectAudioSource(element) {
    if (connectedElements.has(element)) {
        return;
    }
    
    if (source) {
        try {
            source.disconnect();
        } catch (e) {
            console.warn('断开音频源失败:', e);
        }
    }
    
    try {
        source = audioContext.createMediaElementSource(element);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
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

    videoCanvas.width = width;
    videoCanvas.height = height;
    videoCanvas.style.width = canvasWidth + 'px';
    videoCanvas.style.height = canvasHeight + 'px';

    const overlay = document.getElementById('overlayContainer');
    overlay.style.width = canvasWidth + 'px';
    overlay.style.height = canvasHeight + 'px';
    overlay.style.left = '20px';
    overlay.style.top = '20px';

    effectCanvas.width = width;
    effectCanvas.height = height;
}

// 应用位置预设
function applyPositionPreset(position) {
    const overlay = document.getElementById('overlayContainer');
    const canvasWidth = parseInt(videoCanvas.style.width);
    const canvasHeight = parseInt(videoCanvas.style.height);

    const positions = {
        'fullscreen': { width: canvasWidth, height: canvasHeight, left: 20, top: 20 },
        'bottom': { width: canvasWidth, height: canvasHeight * 0.25, left: 20, top: 20 + canvasHeight * 0.75 },
        'top': { width: canvasWidth, height: canvasHeight * 0.25, left: 20, top: 20 },
        'center': { width: canvasWidth * 0.6, height: canvasHeight * 0.4, left: 20 + canvasWidth * 0.2, top: 20 + canvasHeight * 0.3 },
        'left': { width: canvasWidth * 0.3, height: canvasHeight, left: 20, top: 20 },
        'right': { width: canvasWidth * 0.3, height: canvasHeight, left: 20 + canvasWidth * 0.7, top: 20 }
    };

    const pos = positions[position];
    if (pos) {
        overlay.style.width = pos.width + 'px';
        overlay.style.height = pos.height + 'px';
        overlay.style.left = pos.left + 'px';
        overlay.style.top = pos.top + 'px';
    }
}

// 拖拽调整大小
function setupDragResize() {
    const overlay = document.getElementById('overlayContainer');
    const handle = overlay.querySelector('.resize-handle');
    let isDragging = false, isResizing = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    overlay.addEventListener('mousedown', (e) => {
        if (e.target === handle) {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(overlay.style.width);
            startHeight = parseInt(overlay.style.height);
            overlay.classList.add('resizing');
        } else {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(overlay.style.left) || 0;
            startTop = parseInt(overlay.style.top) || 0;
        }
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isResizing) {
            const newWidth = Math.max(100, startWidth + e.clientX - startX);
            const newHeight = Math.max(100, startHeight + e.clientY - startY);
            overlay.style.width = newWidth + 'px';
            overlay.style.height = newHeight + 'px';
            
            const scaleX = videoCanvas.width / parseInt(videoCanvas.style.width);
            const scaleY = videoCanvas.height / parseInt(videoCanvas.style.height);
            effectCanvas.width = newWidth * scaleX;
            effectCanvas.height = newHeight * scaleY;
        } else if (isDragging) {
            overlay.style.left = (startLeft + e.clientX - startX) + 'px';
            overlay.style.top = (startTop + e.clientY - startY) + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        overlay.classList.remove('resizing');
    });
}

// 播放控制
function togglePlay() {
    const element = isVideo ? videoElement : audioElement;
    if (!element.src) return;

    if (isPlaying) {
        element.pause();
        document.getElementById('playBtn').textContent = '▶';
    } else {
        element.play();
        document.getElementById('playBtn').textContent = '⏸';
    }
    isPlaying = !isPlaying;
}

// 进度条控制
function seekVideo(e) {
    const element = isVideo ? videoElement : audioElement;
    if (!element.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    element.currentTime = percent * element.duration;
}

// 初始化粒子
function initParticles() {
    particles = [];
    const count = 150;
    
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * effectCanvas.width,
            y: Math.random() * effectCanvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: Math.random() * 3 + 1,
            life: Math.random(),
            maxLife: 0.5 + Math.random() * 0.5
        });
    }
}

// 获取音频能量
function getAudioEnergy() {
    if (!analyser) return { bass: 0, mid: 0, treble: 0, average: 0, data: new Uint8Array(128) };

    analyser.getByteFrequencyData(dataArray);

    let bass = 0, mid = 0, treble = 0;
    const bassEnd = Math.floor(bufferLength * 0.1);
    const midEnd = Math.floor(bufferLength * 0.5);

    for (let i = 0; i < bassEnd; i++) bass += dataArray[i];
    for (let i = bassEnd; i < midEnd; i++) mid += dataArray[i];
    for (let i = midEnd; i < bufferLength; i++) treble += dataArray[i];

    const sensitivity = effectSettings.sensitivity;
    bass = (bass / bassEnd / 255) * sensitivity;
    mid = (mid / (midEnd - bassEnd) / 255) * sensitivity;
    treble = (treble / (bufferLength - midEnd) / 255) * sensitivity;

    let average = 0;
    for (let i = 0; i < bufferLength; i++) average += dataArray[i];
    average = (average / bufferLength / 255) * sensitivity;

    return { bass, mid, treble, average, data: dataArray };
}

// 动画循环
function animate() {
    animationId = requestAnimationFrame(animate);

    const element = isVideo ? videoElement : audioElement;
    
    // 绘制视频或背景
    videoCtx.fillStyle = '#0a0a0a';
    videoCtx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);

    // 优先使用背景图，其次使用视频帧
    if (useBgImage && bgImage && bgImage.complete) {
        videoCtx.drawImage(bgImage, 0, 0, videoCanvas.width, videoCanvas.height);
    } else if (isVideo && element.videoWidth) {
        videoCtx.drawImage(element, 0, 0, videoCanvas.width, videoCanvas.height);
    }

    // 更新时间和进度
    if (element.duration) {
        const current = formatTime(element.currentTime);
        const total = formatTime(element.duration);
        document.getElementById('timeDisplay').textContent = `${current} / ${total}`;
        document.getElementById('progressFill').style.width = 
            (element.currentTime / element.duration * 100) + '%';
    }

    // 绘制特效
    const energy = getAudioEnergy();
    const time = Date.now() * 0.001;
    const theme = colorThemes[effectSettings.colors];

    effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);

    // 应用变形
    if (effectSettings.transformType !== 'none') {
        applyTransform(effectCtx, time);
    }

    switch (effectSettings.type) {
        case 'particles':
            drawParticles(energy, time, theme);
            break;
        case 'spectrum':
            drawSpectrum(energy, theme);
            break;
        case 'wave':
            drawWave(energy, time, theme);
            break;
        case 'circular':
            drawCircular(energy, time, theme);
            break;
        case 'particles-up':
            drawParticlesUp(energy, time, theme);
            break;
    }

    // 恢复上下文
    if (effectSettings.transformType !== 'none') {
        effectCtx.restore();
    }
}

// 应用画布变形
function applyTransform(ctx, time) {
    const w = effectCanvas.width;
    const h = effectCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const intensity = effectSettings.transformIntensity / 100;
    const speed = effectSettings.transformSpeed;

    ctx.save();

    switch (effectSettings.transformType) {
        case 'wave':
            // 波浪扭曲
            const waveOffset = Math.sin(time * speed) * intensity * 50;
            ctx.translate(cx, cy);
            ctx.transform(1, 0, Math.sin(time * speed * 2) * intensity * 0.3, 1, 0, 0);
            ctx.translate(-cx, -cy);
            break;

        case 'spiral':
            // 螺旋扭曲
            const angle = time * speed * 0.5 * intensity;
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.scale(1 + Math.sin(time * speed) * intensity * 0.1, 1);
            ctx.translate(-cx, -cy);
            break;

        case 'bulge':
            // 凸透镜效果 - 通过缩放实现
            ctx.translate(cx, cy);
            ctx.scale(1 + intensity * 0.3, 1 + intensity * 0.3);
            ctx.translate(-cx, -cy);
            break;

        case 'pinch':
            // 凹透镜效果
            ctx.translate(cx, cy);
            ctx.scale(1 - intensity * 0.2, 1 - intensity * 0.2);
            ctx.translate(-cx, -cy);
            break;

        case 'swirl':
            // 漩涡效果
            ctx.translate(cx, cy);
            ctx.rotate(Math.sin(time * speed) * intensity);
            ctx.translate(-cx, -cy);
            break;

        case 'ripple':
            // 水波纹效果
            const scale = 1 + Math.sin(time * speed * 3) * intensity * 0.1;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            break;
    }
}

// 粒子效果
function drawParticles(energy, time, theme) {
    const centerX = effectCanvas.width / 2;
    const centerY = effectCanvas.height / 2;

    particles.forEach((p, i) => {
        const speedMultiplier = 1 + energy.bass * 3;
        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < 0 || p.x > effectCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > effectCanvas.height) p.vy *= -1;

        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            p.x += (dx / dist) * energy.bass * 2;
            p.y += (dy / dist) * energy.bass * 2;
        }

        const hue = (theme.hue + time * 30 + i * 2) % 360;
        const size = p.size * (1 + energy.mid * 2);
        
        effectCtx.beginPath();
        effectCtx.arc(p.x, p.y, size, 0, Math.PI * 2);
        effectCtx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${0.5 + energy.average * 0.5})`;
        effectCtx.fill();
    });

    const pulseSize = Math.min(effectCanvas.width, effectCanvas.height) * 0.1 + energy.bass * 100;
    const gradient = effectCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseSize);
    gradient.addColorStop(0, `hsla(${theme.hue}, ${theme.sat}%, ${theme.light}%, ${energy.bass * 0.5})`);
    gradient.addColorStop(1, 'transparent');
    
    effectCtx.beginPath();
    effectCtx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
    effectCtx.fillStyle = gradient;
    effectCtx.fill();
}

// 粒子上升效果
function drawParticlesUp(energy, time, theme) {
    particles.forEach((p, i) => {
        p.life += 0.01;
        if (p.life > p.maxLife) {
            p.life = 0;
            p.x = Math.random() * effectCanvas.width;
            p.y = effectCanvas.height + 10;
        }

        const speed = (1 + energy.bass * 5) * (1 + p.size / 3);
        p.y -= speed;
        p.x += Math.sin(time * 3 + i) * 0.5;

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * (0.3 + energy.average * 0.7);
        const hue = (theme.hue + p.y / effectCanvas.height * 60) % 360;
        const size = p.size * (1 + energy.mid * 2);

        effectCtx.beginPath();
        effectCtx.arc(p.x, p.y, size, 0, Math.PI * 2);
        effectCtx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        effectCtx.fill();
    });
}

// 频谱效果 - 增强版
function drawSpectrum(energy, theme) {
    const w = effectCanvas.width;
    const h = effectCanvas.height;
    const barCount = effectSettings.barCount;
    const barWidth = effectSettings.barWidth;
    const gap = effectSettings.barGap;
    const radius = effectSettings.barRadius;
    const direction = effectSettings.barDirection;
    const mirror = effectSettings.mirrorEffect;

    const totalBarWidth = barWidth + gap * barWidth;
    const totalWidth = barCount * totalBarWidth;
    const startX = (w - totalWidth) / 2;

    for (let i = 0; i < barCount; i++) {
        // 获取频谱数据
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = energy.data[dataIndex] || 0;
        const barHeight = (value / 255) * h * 0.8 * energy.average;

        const hue = (theme.hue + (i / barCount) * 60) % 360;
        const x = startX + i * totalBarWidth;

        // 根据方向绘制
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

        // 创建渐变
        let gradient;
        if (effectSettings.gradientDirection === 'vertical') {
            gradient = effectCtx.createLinearGradient(bx, by, bx, by + bh);
        } else if (effectSettings.gradientDirection === 'horizontal') {
            gradient = effectCtx.createLinearGradient(bx, by, bx + bw, by);
        } else {
            gradient = effectCtx.createRadialGradient(bx + bw/2, by + bh/2, 0, bx + bw/2, by + bh/2, Math.max(bw, bh));
        }

        gradient.addColorStop(0, `hsl(${hue}, ${theme.sat}%, ${theme.light + 20}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${theme.sat}%, ${theme.light - 20}%)`);

        // 绘制圆角矩形
        effectCtx.fillStyle = gradient;
        roundRect(effectCtx, bx, by, bw, bh, radius);
        effectCtx.fill();

        // 镜像效果
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
            roundRect(effectCtx, mx, my, bw, bh, radius);
            effectCtx.fill();
        }
    }
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

// 波形效果 - 增强版
function drawWave(energy, time, theme) {
    analyser.getByteTimeDomainData(dataArray);

    const w = effectCanvas.width;
    const h = effectCanvas.height;
    const origin = effectSettings.waveOrigin;
    const amplitude = effectSettings.amplitude;
    const frequency = effectSettings.frequency;
    const lineWidth = effectSettings.lineWidth;
    const lines = effectSettings.waveLines;
    const glow = effectSettings.glowEffect;

    // 确定起始位置
    let startX, startY, angle;
    switch (origin) {
        case 'center':
            startX = 0;
            startY = h / 2;
            angle = 0;
            break;
        case 'left':
            startX = 0;
            startY = h / 2;
            angle = 0;
            break;
        case 'right':
            startX = w;
            startY = h / 2;
            angle = Math.PI;
            break;
        case 'top':
            startX = w / 2;
            startY = 0;
            angle = Math.PI / 2;
            break;
        case 'bottom':
            startX = w / 2;
            startY = h;
            angle = -Math.PI / 2;
            break;
    }

    // 绘制多条波形线
    for (let line = 0; line < lines; line++) {
        const hue = (theme.hue + line * 30 + time * 20) % 360;
        const alpha = 1 - (line * 0.2);
        
        effectCtx.lineWidth = lineWidth - line * 0.5;
        effectCtx.strokeStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        
        if (glow) {
            effectCtx.shadowBlur = 15 - line * 3;
            effectCtx.shadowColor = effectCtx.strokeStyle;
        }

        effectCtx.beginPath();

        const points = 200;
        for (let i = 0; i < points; i++) {
            const t = i / points;
            const dataIndex = Math.floor(t * bufferLength);
            const v = (dataArray[dataIndex] || 128) / 128 - 1;

            let x, y;
            const waveHeight = h * 0.3 * amplitude * (1 + energy.bass);

            if (origin === 'center' || origin === 'left' || origin === 'right') {
                // 水平波形
                x = origin === 'right' ? w - t * w : t * w;
                const offset = Math.sin(t * Math.PI * frequency * 2 + time * 3) * waveHeight * 0.3;
                y = h / 2 + v * waveHeight + offset + line * 10;
            } else {
                // 垂直波形
                y = origin === 'bottom' ? h - t * h : t * h;
                const offset = Math.sin(t * Math.PI * frequency * 2 + time * 3) * waveHeight * 0.3;
                x = w / 2 + v * waveHeight + offset + line * 10;
            }

            if (i === 0) {
                effectCtx.moveTo(x, y);
            } else {
                effectCtx.lineTo(x, y);
            }
        }

        effectCtx.stroke();
    }

    effectCtx.shadowBlur = 0;
}

// 环形效果
function drawCircular(energy, time, theme) {
    const cx = effectCanvas.width / 2;
    const cy = effectCanvas.height / 2;
    const radius = Math.min(cx, cy) * 0.35;

    effectCtx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
        const angle = (i / bufferLength) * Math.PI * 2 - Math.PI / 2;
        const amp = (energy.data[i] / 255) * radius * 0.5 * (1 + energy.bass);
        const r = radius + amp;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) {
            effectCtx.moveTo(x, y);
        } else {
            effectCtx.lineTo(x, y);
        }
    }
    effectCtx.closePath();
    
    const hue = (theme.hue + time * 30) % 360;
    effectCtx.strokeStyle = `hsl(${hue}, ${theme.sat}%, ${theme.light}%)`;
    effectCtx.lineWidth = 3;
    effectCtx.shadowBlur = 20;
    effectCtx.shadowColor = effectCtx.strokeStyle;
    effectCtx.stroke();

    const centerPulse = radius * 0.2 + energy.bass * radius * 0.3;
    effectCtx.beginPath();
    effectCtx.arc(cx, cy, centerPulse, 0, Math.PI * 2);
    effectCtx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${0.3 + energy.average * 0.4})`;
    effectCtx.fill();

    effectCtx.shadowBlur = 0;
}

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 导出视频
async function exportVideo() {
    if (!currentFile) return;

    const progressEl = document.getElementById('exportProgress');
    const progressBar = document.getElementById('exportProgressBar');
    const progressText = document.getElementById('progressText');
    const exportBtn = document.getElementById('exportBtn');

    progressEl.classList.add('active');
    exportBtn.disabled = true;
    progressText.textContent = '准备导出...';
    progressBar.style.width = '0%';

    try {
        const settings = {
            ...effectSettings,
            resolution: document.getElementById('resolution').value,
            quality: document.getElementById('quality').value,
            canvasWidth: videoCanvas.width,
            canvasHeight: videoCanvas.height,
            overlayRect: {
                x: (parseInt(document.getElementById('overlayContainer').style.left) || 0) - 20,
                y: (parseInt(document.getElementById('overlayContainer').style.top) || 0) - 20,
                width: parseInt(document.getElementById('overlayContainer').style.width) || videoCanvas.width,
                height: parseInt(document.getElementById('overlayContainer').style.height) || videoCanvas.height
            },
            scaleFactor: videoCanvas.width / parseInt(videoCanvas.style.width || videoCanvas.width)
        };

        const formData = new FormData();
        formData.append('video', currentFile);
        formData.append('settings', JSON.stringify(settings));

        progressText.textContent = '正在上传...';
        progressBar.style.width = '20%';

        const response = await fetch(`${apiBaseUrl}/api/export`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('导出失败: ' + response.statusText);

        const { taskId } = await response.json();

        const checkProgress = setInterval(async () => {
            const statusRes = await fetch(`${apiBaseUrl}/api/export/status/${taskId}`);
            const status = await statusRes.json();

            if (status.progress) {
                progressBar.style.width = (20 + status.progress * 0.8) + '%';
                progressText.textContent = status.message || '处理中...';
            }

            if (status.status === 'completed') {
                clearInterval(checkProgress);
                progressText.textContent = '导出完成！';
                progressBar.style.width = '100%';
                window.open(`${apiBaseUrl}/api/export/download/${taskId}`, '_blank');
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

// 处理背景图片选择
function handleBgImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    bgImageFile = file;
    const url = URL.createObjectURL(file);

    // 加载图片获取尺寸
    bgImage = new Image();
    bgImage.onload = () => {
        useBgImage = true;

        // 更新UI
        document.getElementById('bgFilename').textContent = file.name;
        document.getElementById('bgFileDetails').textContent = `${bgImage.width}×${bgImage.height} · ${(file.size / 1024).toFixed(1)} KB`;
        document.getElementById('bgFileInfo').style.display = 'block';

        // 调整画布大小为背景图尺寸
        setupCanvasSize(bgImage.width, bgImage.height);

        // 显示叠加层
        document.getElementById('overlayContainer').style.display = 'block';

        // 启动动画循环（如果还没启动）
        if (!animationId) {
            animate();
        }

        // 如果有音频/视频，继续播放
        if (currentFile && !isPlaying) {
            if (isVideo) {
                videoElement.play();
            } else {
                audioElement.play();
            }
            isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
        }
    };
    bgImage.src = url;
}

// 移除背景图片
function removeBgImage() {
    bgImage = null;
    bgImageFile = null;
    useBgImage = false;

    document.getElementById('bgImageFile').value = '';
    document.getElementById('bgFileInfo').style.display = 'none';

    // 恢复画布大小为视频/音频默认尺寸
    if (currentFile) {
        if (isVideo && videoElement.videoWidth) {
            setupCanvasSize(videoElement.videoWidth, videoElement.videoHeight);
        } else {
            setupCanvasSize(1280, 720);
        }
    }
}

// 保存配置
function saveConfig() {
    const config = {
        effectSettings: {
            type: effectSettings.type,
            colors: effectSettings.colors,
            sensitivity: effectSettings.sensitivity,
            opacity: effectSettings.opacity,
            barDirection: effectSettings.barDirection,
            barCount: effectSettings.barCount,
            barWidth: effectSettings.barWidth,
            barGap: effectSettings.barGap,
            barRadius: effectSettings.barRadius,
            mirrorEffect: effectSettings.mirrorEffect,
            gradientDirection: effectSettings.gradientDirection,
            waveOrigin: effectSettings.waveOrigin,
            amplitude: effectSettings.amplitude,
            frequency: effectSettings.frequency,
            lineWidth: effectSettings.lineWidth,
            waveLines: effectSettings.waveLines,
            glowEffect: effectSettings.glowEffect,
            transformType: effectSettings.transformType,
            transformIntensity: effectSettings.transformIntensity,
            transformSpeed: effectSettings.transformSpeed,
            position: effectSettings.position
        },
        overlayPosition: {
            width: document.getElementById('overlayContainer').style.width,
            height: document.getElementById('overlayContainer').style.height,
            left: document.getElementById('overlayContainer').style.left,
            top: document.getElementById('overlayContainer').style.top
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

// 载入配置
function loadConfig(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const config = JSON.parse(event.target.result);

            if (config.effectSettings) {
                Object.assign(effectSettings, config.effectSettings);

                document.getElementById('effectType').value = effectSettings.type;
                document.getElementById('sensitivity').value = effectSettings.sensitivity;
                document.getElementById('sensitivityValue').textContent = effectSettings.sensitivity;
                document.getElementById('opacity').value = effectSettings.opacity;
                document.getElementById('opacityValue').textContent = effectSettings.opacity;

                document.getElementById('barDirection').value = effectSettings.barDirection;
                document.getElementById('barCount').value = effectSettings.barCount;
                document.getElementById('barCountValue').textContent = effectSettings.barCount;
                document.getElementById('barWidth').value = effectSettings.barWidth;
                document.getElementById('barWidthValue').textContent = effectSettings.barWidth;
                document.getElementById('barGap').value = effectSettings.barGap;
                document.getElementById('barGapValue').textContent = effectSettings.barGap;
                document.getElementById('barRadius').value = effectSettings.barRadius;
                document.getElementById('barRadiusValue').textContent = effectSettings.barRadius;
                document.getElementById('mirrorEffect').checked = effectSettings.mirrorEffect;
                document.getElementById('gradientDirection').value = effectSettings.gradientDirection;

                document.getElementById('waveOrigin').value = effectSettings.waveOrigin;
                document.getElementById('amplitude').value = effectSettings.amplitude;
                document.getElementById('amplitudeValue').textContent = effectSettings.amplitude;
                document.getElementById('frequency').value = effectSettings.frequency;
                document.getElementById('frequencyValue').textContent = effectSettings.frequency;
                document.getElementById('lineWidth').value = effectSettings.lineWidth;
                document.getElementById('lineWidthValue').textContent = effectSettings.lineWidth;
                document.getElementById('waveLines').value = effectSettings.waveLines;
                document.getElementById('waveLinesValue').textContent = effectSettings.waveLines;
                document.getElementById('glowEffect').checked = effectSettings.glowEffect;

                document.getElementById('transformType').value = effectSettings.transformType;
                document.getElementById('transformIntensity').value = effectSettings.transformIntensity;
                document.getElementById('transformIntensityValue').textContent = effectSettings.transformIntensity;
                document.getElementById('transformSpeed').value = effectSettings.transformSpeed;
                document.getElementById('transformSpeedValue').textContent = effectSettings.transformSpeed;

                updateSettingsVisibility();

                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                    if (opt.dataset.colors === effectSettings.colors) {
                        opt.classList.add('active');
                    }
                });

                document.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.position === effectSettings.position) {
                        btn.classList.add('active');
                    }
                });
            }

            if (config.overlayPosition) {
                const overlay = document.getElementById('overlayContainer');
                if (config.overlayPosition.width) overlay.style.width = config.overlayPosition.width;
                if (config.overlayPosition.height) overlay.style.height = config.overlayPosition.height;
                if (config.overlayPosition.left) overlay.style.left = config.overlayPosition.left;
                if (config.overlayPosition.top) overlay.style.top = config.overlayPosition.top;
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



// 导出视频（支持背景图）
async function exportVideo() {
    if (!currentFile) return;

    const progressEl = document.getElementById('exportProgress');
    const progressBar = document.getElementById('exportProgressBar');
    const progressText = document.getElementById('progressText');
    const exportBtn = document.getElementById('exportBtn');

    progressEl.classList.add('active');
    exportBtn.disabled = true;
    progressText.textContent = '准备导出...';
    progressBar.style.width = '0%';

    try {
        const settings = {
            ...effectSettings,
            resolution: document.getElementById('resolution').value,
            quality: document.getElementById('quality').value,
            canvasWidth: videoCanvas.width,
            canvasHeight: videoCanvas.height,
            overlayRect: {
                x: (parseInt(document.getElementById('overlayContainer').style.left) || 0) - 20,
                y: (parseInt(document.getElementById('overlayContainer').style.top) || 0) - 20,
                width: parseInt(document.getElementById('overlayContainer').style.width) || videoCanvas.width,
                height: parseInt(document.getElementById('overlayContainer').style.height) || videoCanvas.height
            },
            scaleFactor: videoCanvas.width / parseInt(videoCanvas.style.width || videoCanvas.width),
            useBgImage: useBgImage,
            bgImageWidth: bgImage ? bgImage.width : null,
            bgImageHeight: bgImage ? bgImage.height : null
        };

        const formData = new FormData();
        formData.append('video', currentFile);
        formData.append('settings', JSON.stringify(settings));

        // 如果有背景图，也上传
        if (useBgImage && bgImageFile) {
            formData.append('bgImage', bgImageFile);
        }

        progressText.textContent = '正在上传...';
        progressBar.style.width = '20%';

        const response = await fetch(`${apiBaseUrl}/api/export`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('导出失败: ' + response.statusText);

        const { taskId } = await response.json();

        const checkProgress = setInterval(async () => {
            const statusRes = await fetch(`${apiBaseUrl}/api/export/status/${taskId}`);
            const status = await statusRes.json();

            if (status.progress) {
                progressBar.style.width = (20 + status.progress * 0.8) + '%';
                progressText.textContent = status.message || '处理中...';
            }

            if (status.status === 'completed') {
                clearInterval(checkProgress);
                progressText.textContent = '导出完成！';
                progressBar.style.width = '100%';
                window.open(`${apiBaseUrl}/api/export/download/${taskId}`, '_blank');
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
};

// 启动
init();
