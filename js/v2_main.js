// V2 页面专属逻辑 - 黑胶唱片可视化

// V2 页面状态
const v2State = {
    // 背景设置
    bgBlur: 10,
    bgDarkness: 40,
    
    // Logo设置
    logoImage: null,
    logoSize: 60,
    
    // 黑胶唱片设置
    coverImage: null,
    vinylSize: 180,
    rotationSpeed: 1,
    rotationAngle: 0,
    
    // 歌词设置
    lyrics: [],
    lyricFontSize: 32,
    lyricColor: '#ffffff',
    lyricStrokeColor: '#000000',
    lyricStrokeWidth: 2,
    lyricOffsetY: 0,
    
    // 文字内容
    dateGenre: '2024 | 流行',
    title: '歌曲标题 - 可编辑',
    artist: '歌手名 - 可编辑',
    original: '原唱占位',
    style: '风格占位',
    producer: '制作人占位',
    
    // 波形设置
    waveColor: 'orange',
    waveHeight: 60,
    waveBars: 64,
    waveOffsetY: 0
};

// 波形颜色主题
const waveColorThemes = {
    orange: { start: '#ff6b6b', end: '#ffa500' },
    purple: { start: '#667eea', end: '#764ba2' },
    blue: { start: '#4facfe', end: '#00f2fe' },
    green: { start: '#43e97b', end: '#38f9d7' },
    pink: { start: '#fa709a', end: '#fee140' },
    white: { start: '#ffffff', end: '#e0e0e0' }
};

// 初始化页面
function initV2() {
    setupCanvas();
    bindEvents();
    animate();
}

// 设置画布
function setupCanvas() {
    seesound.videoCanvas = document.getElementById('videoCanvas');
    seesound.videoCtx = seesound.videoCanvas.getContext('2d');
    
    // 获取视频和音频元素
    seesound.videoElement = document.getElementById('videoElement');
    seesound.audioElement = document.getElementById('audioElement');
    
    // 设置默认画布大小
    seesound.videoCanvas.width = 1280;
    seesound.videoCanvas.height = 720;
    
    // 初始化音频上下文
    if (!seesound.audioContext) {
        seesound.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        seesound.analyser = seesound.audioContext.createAnalyser();
        seesound.analyser.fftSize = 256;
        seesound.analyser.smoothingTimeConstant = 0.8;
        seesound.bufferLength = seesound.analyser.frequencyBinCount;
        seesound.dataArray = new Uint8Array(seesound.bufferLength);
    }
}

// 绑定事件
function bindEvents() {
    // 媒体文件上传
    document.getElementById('mediaFile').addEventListener('change', handleMediaFileSelect);
    document.getElementById('fileUpload').addEventListener('click', () => document.getElementById('mediaFile').click());
    
    // 歌词文件上传
    document.getElementById('lyricFile').addEventListener('change', handleLyricFileSelect);
    document.getElementById('lyricUpload').addEventListener('click', () => document.getElementById('lyricFile').click());
    
    // 背景图片上传
    document.getElementById('bgImageFile').addEventListener('change', handleBgImageSelect);
    document.getElementById('bgUpload').addEventListener('click', () => document.getElementById('bgImageFile').click());
    document.getElementById('removeBgBtn').addEventListener('click', removeBgImage);
    
    // Logo上传
    document.getElementById('logoFile').addEventListener('change', handleLogoSelect);
    document.getElementById('logoUpload').addEventListener('click', () => document.getElementById('logoFile').click());
    document.getElementById('removeLogoBtn').addEventListener('click', removeLogo);
    
    // 封面上传
    document.getElementById('coverFile').addEventListener('change', handleCoverSelect);
    document.getElementById('coverUpload').addEventListener('click', () => document.getElementById('coverFile').click());
    document.getElementById('removeCoverBtn').addEventListener('click', removeCover);
    
    // 播放控制
    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('progressBar').addEventListener('click', seekVideo);
    
    // 设置控件
    document.getElementById('bgBlur').addEventListener('input', (e) => {
        v2State.bgBlur = parseInt(e.target.value);
        document.getElementById('bgBlurValue').textContent = v2State.bgBlur;
    });
    
    document.getElementById('bgDarkness').addEventListener('input', (e) => {
        v2State.bgDarkness = parseInt(e.target.value);
        document.getElementById('bgDarknessValue').textContent = v2State.bgDarkness;
    });
    
    document.getElementById('logoSize').addEventListener('input', (e) => {
        v2State.logoSize = parseInt(e.target.value);
        document.getElementById('logoSizeValue').textContent = v2State.logoSize;
    });
    
    document.getElementById('vinylSize').addEventListener('input', (e) => {
        v2State.vinylSize = parseInt(e.target.value);
        document.getElementById('vinylSizeValue').textContent = v2State.vinylSize;
    });
    
    document.getElementById('rotationSpeed').addEventListener('input', (e) => {
        v2State.rotationSpeed = parseFloat(e.target.value);
        document.getElementById('rotationSpeedValue').textContent = v2State.rotationSpeed;
    });
    
    document.getElementById('lyricFontSize').addEventListener('input', (e) => {
        v2State.lyricFontSize = parseInt(e.target.value);
        document.getElementById('lyricFontSizeValue').textContent = v2State.lyricFontSize;
    });
    
    document.getElementById('lyricStrokeWidth').addEventListener('input', (e) => {
        v2State.lyricStrokeWidth = parseInt(e.target.value);
        document.getElementById('lyricStrokeWidthValue').textContent = v2State.lyricStrokeWidth;
    });
    
    document.getElementById('waveHeight').addEventListener('input', (e) => {
        v2State.waveHeight = parseInt(e.target.value);
        document.getElementById('waveHeightValue').textContent = v2State.waveHeight;
    });
    
    document.getElementById('waveBars').addEventListener('input', (e) => {
        v2State.waveBars = parseInt(e.target.value);
        document.getElementById('waveBarsValue').textContent = v2State.waveBars;
    });
    
    document.getElementById('waveOffsetY').addEventListener('input', (e) => {
        v2State.waveOffsetY = parseInt(e.target.value);
        document.getElementById('waveOffsetYValue').textContent = v2State.waveOffsetY;
    });
    
    document.getElementById('lyricOffsetY').addEventListener('input', (e) => {
        v2State.lyricOffsetY = parseInt(e.target.value);
        document.getElementById('lyricOffsetYValue').textContent = v2State.lyricOffsetY;
    });
    
    // 歌词颜色选择
    document.querySelectorAll('.color-option[data-color]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-color]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            v2State.lyricColor = opt.dataset.color;
        });
    });
    
    // 描边颜色选择
    document.querySelectorAll('.color-option[data-stroke]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-stroke]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            v2State.lyricStrokeColor = opt.dataset.stroke;
        });
    });
    
    // 波形颜色选择
    document.querySelectorAll('.color-option[data-wavecolor]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-wavecolor]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            v2State.waveColor = opt.dataset.wavecolor;
        });
    });
    
    // 文字内容输入
    document.getElementById('textDateGenre').addEventListener('input', (e) => {
        v2State.dateGenre = e.target.value;
    });
    
    document.getElementById('textTitle').addEventListener('input', (e) => {
        v2State.title = e.target.value;
    });
    
    document.getElementById('textArtist').addEventListener('input', (e) => {
        v2State.artist = e.target.value;
    });
    
    document.getElementById('textOriginal').addEventListener('input', (e) => {
        v2State.original = e.target.value;
    });
    
    document.getElementById('textStyle').addEventListener('input', (e) => {
        v2State.style = e.target.value;
    });
    
    document.getElementById('textProducer').addEventListener('input', (e) => {
        v2State.producer = e.target.value;
    });
    
    // 导出按钮
    document.getElementById('exportBtn').addEventListener('click', exportVideoV2);
}

// 处理媒体文件选择
function handleMediaFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    seesound.currentFile = file;
    const url = URL.createObjectURL(file);
    seesound.isVideo = file.type.startsWith('video/');

    document.getElementById('filename').textContent = file.name;
    document.getElementById('fileDetails').textContent = 
        `${seesound.isVideo ? '视频' : '音频'} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    document.getElementById('fileInfo').style.display = 'block';

    if (seesound.isVideo) {
        seesound.videoElement.src = url;
        seesound.videoElement.load();
        seesound.videoElement.onloadedmetadata = () => {
            seesound.videoCanvas.width = seesound.videoElement.videoWidth;
            seesound.videoCanvas.height = seesound.videoElement.videoHeight;
            seesound.videoElement.play();
            seesound.isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
            connectAudioSource(seesound.videoElement);
        };
    } else {
        seesound.audioElement.src = url;
        seesound.audioElement.load();
        seesound.audioElement.oncanplay = () => {
            seesound.audioElement.play();
            seesound.isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';
            connectAudioSource(seesound.audioElement);
        };
    }

    document.getElementById('exportBtn').disabled = false;
}

// 处理歌词文件选择
function handleLyricFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target.result;
        if (file.name.endsWith('.lrc')) {
            v2State.lyrics = parseLRC(content);
        } else {
            v2State.lyrics = parseSRT(content);
        }
        
        document.getElementById('lyricFilename').textContent = file.name;
        document.getElementById('lyricFileInfo').style.display = 'block';
    };
    reader.readAsText(file);
}

// 解析 LRC 歌词
function parseLRC(content) {
    const lyrics = [];
    const lines = content.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    
    lines.forEach(line => {
        let match;
        const times = [];
        while ((match = timeRegex.exec(line)) !== null) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = parseInt(match[3]) * (match[3].length === 2 ? 10 : 1);
            times.push(minutes * 60 + seconds + milliseconds / 1000);
        }
        
        const text = line.replace(/\[.*?\]/g, '').trim();
        if (text && times.length > 0) {
            times.forEach(time => {
                lyrics.push({ time, text });
            });
        }
    });
    
    return lyrics.sort((a, b) => a.time - b.time);
}

// 解析 SRT 歌词
function parseSRT(content) {
    const lyrics = [];
    const blocks = content.split(/\n\n+/);
    
    blocks.forEach(block => {
        const lines = block.trim().split('\n');
        if (lines.length >= 3) {
            const timeLine = lines[1];
            const timeParts = timeLine.split(' --> ');
            if (timeParts.length === 2) {
                const startTime = parseSRTTime(timeParts[0]);
                const text = lines.slice(2).join('\n').trim();
                if (text) {
                    lyrics.push({ time: startTime, text });
                }
            }
        }
    });
    
    return lyrics.sort((a, b) => a.time - b.time);
}

// 解析 SRT 时间格式
function parseSRTTime(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split(',');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1]);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
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
        document.getElementById('bgFileInfo').style.display = 'block';
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
}

// 处理 Logo 选择
function handleLogoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    v2State.logoImage = new Image();
    v2State.logoImage.onload = () => {
        document.getElementById('logoFilename').textContent = file.name;
        document.getElementById('logoFileInfo').style.display = 'block';
    };
    v2State.logoImage.src = url;
}

// 移除 Logo
function removeLogo() {
    v2State.logoImage = null;
    document.getElementById('logoFile').value = '';
    document.getElementById('logoFileInfo').style.display = 'none';
}

// 处理封面选择
function handleCoverSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    v2State.coverImage = new Image();
    v2State.coverImage.onload = () => {
        document.getElementById('coverFilename').textContent = file.name;
        document.getElementById('coverFileInfo').style.display = 'block';
    };
    v2State.coverImage.src = url;
}

// 移除封面
function removeCover() {
    v2State.coverImage = null;
    document.getElementById('coverFile').value = '';
    document.getElementById('coverFileInfo').style.display = 'none';
}

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

// 进度条控制 - 修复：正确处理点击事件
function seekVideo(e) {
    const element = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
    if (!element || !element.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    element.currentTime = Math.min(percent * element.duration, element.duration);
}

// 连接音频源
function connectAudioSource(element) {
    if (!seesound.audioContext) {
        seesound.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        seesound.analyser = seesound.audioContext.createAnalyser();
        seesound.analyser.fftSize = 256;
        seesound.analyser.smoothingTimeConstant = 0.8;
        seesound.bufferLength = seesound.analyser.frequencyBinCount;
        seesound.dataArray = new Uint8Array(seesound.bufferLength);
    }

    if (seesound.sourceElement === element) {
        return;
    }

    if (seesound.source) {
        try {
            seesound.source.disconnect();
        } catch (e) {}
    }

    try {
        seesound.sourceElement = element;
        seesound.source = seesound.audioContext.createMediaElementSource(element);
        seesound.source.connect(seesound.analyser);
        seesound.analyser.connect(seesound.audioContext.destination);
    } catch (e) {
        console.error('创建音频源失败:', e);
    }
}

// 绘制黑胶唱片
function drawVinylRecord(ctx, centerX, centerY, radius, rotationAngle, coverImage) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle);
    
    // 唱片外圈阴影
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    
    // 唱片主体
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    
    // 唱片纹理线条
    ctx.shadowBlur = 0;
    for (let i = 0; i < 120; i++) {
        const r = radius * 0.12 + (radius * 0.76 * i / 120);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        const alpha = 0.015 + (i / 120) * 0.02;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
    }
    
    // 唱片标签区域
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
    const labelGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.38);
    labelGradient.addColorStop(0, '#e8c872');
    labelGradient.addColorStop(1, '#c9a227');
    ctx.fillStyle = labelGradient;
    ctx.fill();
    
    // 标签边框
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 封面图片
    if (coverImage) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.32, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(coverImage, -radius * 0.32, -radius * 0.32, radius * 0.64, radius * 0.64);
        ctx.restore();
    } else {
        // 默认封面占位
        ctx.font = `${radius * 0.08}px Arial`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('[单曲封面在此', 0, -radius * 0.05);
        ctx.fillText('处放置图片]', 0, radius * 0.08);
    }
    
    // 唱片中心孔
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    
    ctx.restore();
}

// 绘制滚动歌词
function drawScrollingLyrics(ctx, lyrics, currentTime, x, y, width) {
    const adjustedY = y + v2State.lyricOffsetY;
    if (!lyrics || lyrics.length === 0) {
        ctx.font = `${v2State.lyricFontSize}px 杨任东竹石体-Regular, Microsoft YaHei`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillText('[一句话歌词金句 - 可编辑]', x + width / 2, adjustedY);
        return;
    }
    
    const currentLyric = findCurrentLyric(lyrics, currentTime);
    if (!currentLyric) return;
    
    ctx.font = `${v2State.lyricFontSize}px 杨任东竹石体-Regular, Microsoft YaHei`;
    ctx.textAlign = 'center';
    
    let displayText = currentLyric.text;
    const textWidth = ctx.measureText(displayText).width;
    if (textWidth > width * 0.9) {
        displayText = displayText + '　';
        while (ctx.measureText(displayText).width < width * 0.9) {
            displayText = displayText + currentLyric.text + '　';
        }
        const totalWidth = ctx.measureText(displayText).width;
        const scrollSpeed = 50;
        const progress = (currentTime * 1000) % (totalWidth + width);
        const offsetX = -progress + width / 2;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 10, adjustedY - v2State.lyricFontSize, width + 20, v2State.lyricFontSize * 1.5);
        ctx.clip();
        
        ctx.strokeStyle = v2State.lyricStrokeColor;
        ctx.lineWidth = v2State.lyricStrokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(displayText, x + offsetX, adjustedY);
        
        ctx.fillStyle = v2State.lyricColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = v2State.lyricColor;
        ctx.fillText(displayText, x + offsetX, adjustedY);
        ctx.shadowBlur = 0;
        
        ctx.restore();
    } else {
        ctx.strokeStyle = v2State.lyricStrokeColor;
        ctx.lineWidth = v2State.lyricStrokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(displayText, x + width / 2, adjustedY);
        
        ctx.fillStyle = v2State.lyricColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = v2State.lyricColor;
        ctx.fillText(displayText, x + width / 2, adjustedY);
        ctx.shadowBlur = 0;
    }
}

// 查找当前歌词
function findCurrentLyric(lyrics, currentTime) {
    for (let i = lyrics.length - 1; i >= 0; i--) {
        if (lyrics[i].time <= currentTime) {
            return lyrics[i];
        }
    }
    return null;
}

// 绘制时间进度条
function drawTimeline(ctx, x, y, width, height, currentTime, duration) {
    const progress = Math.min(currentTime / duration, 1);
    
    // 进度条背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y, width, height);
    
    // 进度填充
    const gradient = ctx.createLinearGradient(x, y, x + width * progress, y);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width * progress, height);
    
    // 进度条边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // 时间文字
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(currentTime), x, y - 8);
    
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(duration), x + width, y - 8);
}

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 绘制音频波形
function drawAudioWave(ctx, x, y, width, height, dataArray, barCount) {
    if (!dataArray || dataArray.length === 0) {
        // 静态波形占位
        for (let i = 0; i < barCount; i++) {
            const barWidth = width / barCount * 0.7;
            const gap = width / barCount * 0.3;
            const barHeight = height * 0.3 + Math.random() * height * 0.4;
            const bx = x + i * (width / barCount) + gap / 2;
            
            const gradient = ctx.createLinearGradient(bx, y + height - barHeight, bx, y + height);
            const theme = waveColorThemes[v2State.waveColor] || waveColorThemes.orange;
            gradient.addColorStop(0, theme.start);
            gradient.addColorStop(1, theme.end);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(bx, y + height - barHeight, barWidth, barHeight);
        }
        return;
    }
    
    const theme = waveColorThemes[v2State.waveColor] || waveColorThemes.orange;
    const barWidth = width / barCount * 0.7;
    const gap = width / barCount * 0.3;
    
    for (let i = 0; i < barCount; i++) {
        const dataIdx = Math.floor((i / barCount) * dataArray.length);
        const value = dataArray[dataIdx] / 255;
        const barHeight = value * height * 0.8 + height * 0.1;
        const bx = x + i * (width / barCount) + gap / 2;
        
        const gradient = ctx.createLinearGradient(bx, y + height - barHeight, bx, y + height);
        gradient.addColorStop(0, theme.start);
        gradient.addColorStop(1, theme.end);
        
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 8;
        ctx.shadowColor = theme.start;
        ctx.fillRect(bx, y + height - barHeight, barWidth, barHeight);
        ctx.shadowBlur = 0;
    }
    
    // 发光底部线
    ctx.fillStyle = `${theme.start}33`;
    ctx.fillRect(x, y + height - 2, width, 4);
}

// 绘制 Logo
function drawLogo(ctx, x, y, size, logoImage) {
    if (!logoImage) return;
    ctx.drawImage(logoImage, x, y, size, size);
}

// 主绘制函数
function draw(time) {
    const ctx = seesound.videoCtx;
    const w = seesound.videoCanvas.width;
    const h = seesound.videoCanvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, w, h);
    
    // 绘制背景
    drawBackground(ctx, w, h);
    
    // 绘制 Logo
    drawLogo(ctx, 40, 40, v2State.logoSize, v2State.logoImage);
    
    // 绘制日期/流派
    ctx.font = '16px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(v2State.dateGenre, 40, 120);
    
    // 绘制歌曲标题
    ctx.font = 'bold 36px Microsoft YaHei';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(v2State.title, 40, 170);
    
    // 绘制歌手名
    ctx.font = '24px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(v2State.artist, 40, 210);
    
    // 绘制黑胶唱片
    const vinylCenterX = w * 0.22;
    const vinylCenterY = h * 0.58;
    const vinylRadius = v2State.vinylSize;
    
    if (seesound.isPlaying) {
        v2State.rotationAngle += 0.02 * v2State.rotationSpeed;
    }
    drawVinylRecord(ctx, vinylCenterX, vinylCenterY, vinylRadius, v2State.rotationAngle, v2State.coverImage);
    
    // 绘制时间进度条（唱片下方）
    const timelineY = vinylCenterY + vinylRadius + 30;
    const timelineWidth = vinylRadius * 1.8;
    const timelineX = vinylCenterX - timelineWidth / 2;
    
    const mediaElement = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
    const currentTime = mediaElement?.currentTime || 0;
    const duration = mediaElement?.duration || 300;
    
    drawTimeline(ctx, timelineX, timelineY, timelineWidth, 6, currentTime, duration);
    
    // 绘制时间文字说明
    ctx.font = '12px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('片段播放中:', vinylCenterX, timelineY + 28);
    
    // 绘制歌词区域
    const lyricX = w * 0.45;
    const lyricY = h * 0.35;
    const lyricWidth = w * 0.5;
    drawScrollingLyrics(ctx, v2State.lyrics, currentTime, lyricX, lyricY, lyricWidth);
    
    // 绘制右侧信息（原唱、风格、制作人）
    const infoY = h * 0.65;
    const infoX = w - 180;
    ctx.font = '14px Microsoft YaHei';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(`原唱: ${v2State.original}`, infoX, infoY);
    ctx.fillText(`风格: ${v2State.style}`, infoX, infoY + 25);
    ctx.fillText(`制作人: ${v2State.producer}`, infoX, infoY + 50);
    
    // 绘制音频波形
    const waveX = w * 0.4;
    const waveY = h - 80 - v2State.waveOffsetY;
    const waveWidth = w * 0.55;
    const waveHeight = v2State.waveHeight;
    
    if (seesound.analyser) {
        seesound.analyser.getByteFrequencyData(seesound.dataArray);
    }
    drawAudioWave(ctx, waveX, waveY, waveWidth, waveHeight, seesound.dataArray, v2State.waveBars);
    
    // 更新进度条显示
    if (mediaElement && mediaElement.duration) {
        const percent = (mediaElement.currentTime / mediaElement.duration) * 100;
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('timeDisplay').textContent = 
            `${formatTime(mediaElement.currentTime)} / ${formatTime(mediaElement.duration)}`;
    }
}

// 绘制背景
function drawBackground(ctx, w, h) {
    // 默认背景
    const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);
    
    // 如果有背景图片
    if (seesound.useBgImage && seesound.bgImage) {
        // 创建离屏画布处理模糊
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 绘制背景图
        tempCtx.drawImage(seesound.bgImage, 0, 0, w, h);
        
        // 应用模糊效果
        if (v2State.bgBlur > 0) {
            tempCtx.filter = `blur(${v2State.bgBlur}px)`;
            tempCtx.drawImage(tempCanvas, 0, 0);
            tempCtx.filter = 'none';
        }
        
        // 绘制到主画布
        ctx.drawImage(tempCanvas, 0, 0);
    }
    
    // 添加暗色遮罩
    ctx.fillStyle = `rgba(0, 0, 0, ${v2State.bgDarkness / 100})`;
    ctx.fillRect(0, 0, w, h);
}

// 动画循环
function animate() {
    seesound.animationId = requestAnimationFrame(animate);
    draw();
}

// V2 导出视频
async function exportVideoV2() {
    const mode = document.getElementById('exportMode').value;
    
    if (mode === 'browser') {
        await exportVideoBrowserV2();
    } else {
        await exportVideoServerV2();
    }
}

// 浏览器录制导出 V2 - 修复版本
async function exportVideoBrowserV2() {
    console.log('[EXPORT_V2] ====== 开始导出 ======');
    if (!seesound.currentFile) {
        console.error('[EXPORT_V2] 没有加载文件!');
        return;
    }

    const progressEl = document.getElementById('exportProgress');
    const progressBar = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressText');
    const exportBtn = document.getElementById('exportBtn');

    progressEl.classList.add('active');
    exportBtn.disabled = true;

    if (!window.MediaRecorder) {
        console.error('[EXPORT_V2] 浏览器不支持MediaRecorder!');
        progressText.textContent = '浏览器不支持录制，使用传统导出';
        await exportVideoServerV2();
        return;
    }
    console.log('[EXPORT_V2] MediaRecorder可用');

    try {
        progressText.textContent = '准备录制...';
        progressBar.style.width = '5%';

        const mediaElement = seesound.isVideo ? seesound.videoElement : seesound.audioElement;
        console.log('[EXPORT_V2] mediaElement:', mediaElement.tagName, 'src:', mediaElement.src ? '有' : '无');
        console.log('[EXPORT_V2] seesound.isVideo:', seesound.isVideo);
        console.log('[EXPORT_V2] mediaElement.duration:', mediaElement.duration);
        console.log('[EXPORT_V2] mediaElement.readyState:', mediaElement.readyState);

        const wasPlaying = seesound.isPlaying;
        console.log('[EXPORT_V2] wasPlaying:', wasPlaying);

        console.log('[EXPORT_V2] 暂停并重置媒体元素');
        mediaElement.pause();
        console.log('[EXPORT_V2] mediaElement.pause()后 - paused:', mediaElement.paused, 'ended:', mediaElement.ended, 'currentTime:', mediaElement.currentTime);
        
        mediaElement.currentTime = 0;
        console.log('[EXPORT_V2] 设置currentTime=0后 - currentTime:', mediaElement.currentTime);
        
        seesound.isPlaying = false;
        document.getElementById('playBtn').textContent = '▶';
        v2State.rotationAngle = 0;

        console.log('[EXPORT_V2] ====== 初始化音频上下文 ======');
        if (!seesound.audioContext) {
            console.log('[EXPORT_V2] 创建新的audioContext');
            seesound.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            seesound.analyser = seesound.audioContext.createAnalyser();
            seesound.analyser.fftSize = 256;
            seesound.dataArray = new Uint8Array(seesound.analyser.frequencyBinCount);
        }
        console.log('[EXPORT_V2] audioContext状态:', seesound.audioContext.state);
        console.log('[EXPORT_V2] audioContext.sampleRate:', seesound.audioContext.sampleRate);
        console.log('[EXPORT_V2] seesound.source:', seesound.source ? '有' : '无');
        console.log('[EXPORT_V2] seesound.analyser:', seesound.analyser ? '有' : '无');
        console.log('[EXPORT_V2] seesound.sourceElement:', seesound.sourceElement ? seesound.sourceElement.tagName : '无');
        
        if (seesound.audioContext.state === 'suspended') {
            console.log('[EXPORT_V2] audioContext被暂停，恢复中...');
            await seesound.audioContext.resume();
            console.log('[EXPORT_V2] audioContext已恢复, 状态:', seesound.audioContext.state);
        }

        let audioContext = seesound.audioContext;
        let source = seesound.source;
        let analyser = seesound.analyser;

        let audioStream = null;
        console.log('[EXPORT_V2] ====== 创建音频流 ======');
        try {
            console.log('[EXPORT_V2] 创建MediaStreamDestination');
            const dest = audioContext.createMediaStreamDestination();
            console.log('[EXPORT_V2] dest.stream:', dest.stream ? '有音频轨道' : '无');
            console.log('[EXPORT_V2] dest.stream.getAudioTracks().length:', dest.stream.getAudioTracks().length);
            
            if (source) {
                console.log('[EXPORT_V2] 断开source当前连接');
                try { source.disconnect(); } catch (e) { console.warn('[EXPORT_V2] source.disconnect失败:', e); }
                console.log('[EXPORT_V2] 连接source -> analyser');
                source.connect(analyser);
            } else {
                console.warn('[EXPORT_V2] source为空，跳过连接');
            }
            
            console.log('[EXPORT_V2] 断开analyser当前连接');
            try { analyser.disconnect(); } catch (e) { console.warn('[EXPORT_V2] analyser.disconnect失败:', e); }
            
            console.log('[EXPORT_V2] 连接analyser -> dest');
            analyser.connect(dest);
            console.log('[EXPORT_V2] 连接analyser -> destination(扬声器)');
            analyser.connect(audioContext.destination);
            
            audioStream = dest.stream;
            console.log('[EXPORT_V2] audioStream创建成功, 音频轨道数:', audioStream.getAudioTracks().length);
        } catch (e) {
            console.error('[EXPORT_V2] 音频流创建失败:', e);
            console.warn('[EXPORT_V2] 音频录制可能有问题:', e);
        }

        console.log('[EXPORT_V2] ====== 创建视频流 ======');
        const videoStream = seesound.videoCanvas.captureStream(30);
        console.log('[EXPORT_V2] videoStream视频轨道数:', videoStream.getVideoTracks().length);

        let combinedStream;
        if (audioStream) {
            console.log('[EXPORT_V2] 合并视频流和音频流');
            combinedStream = new MediaStream([
                ...videoStream.getVideoTracks(),
                ...audioStream.getAudioTracks()
            ]);
        } else {
            console.warn('[EXPORT_V2] audioStream为空，只使用视频流');
            combinedStream = videoStream;
        }
        console.log('[EXPORT_V2] combinedStream总轨道数:', combinedStream.getTracks().length);
        console.log('[EXPORT_V2] combinedStream视频轨道:', combinedStream.getVideoTracks().length);
        console.log('[EXPORT_V2] combinedStream音频轨道:', combinedStream.getAudioTracks().length);

        const mimeTypes = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];
        let selectedMimeType = '';
        console.log('[EXPORT_V2] ====== 选择MIME类型 ======');
        for (const type of mimeTypes) {
            const supported = MediaRecorder.isTypeSupported(type);
            console.log('[EXPORT_V2] 支持', type, ':', supported);
            if (supported && !selectedMimeType) {
                selectedMimeType = type;
            }
        }
        console.log('[EXPORT_V2] 最终选择的MIME:', selectedMimeType || '无(使用默认)');

        const recorder = new MediaRecorder(combinedStream, {
            mimeType: selectedMimeType || undefined,
            videoBitsPerSecond: 8 * 1024 * 1024
        });
        console.log('[EXPORT_V2] MediaRecorder创建完成, state:', recorder.state);

        const chunks = [];
        console.log('[EXPORT_V2] chunks数组初始长度:', chunks.length);
        
        recorder.ondataavailable = (e) => {
            console.log('[EXPORT_V2] ondataavailable - 数据大小:', e.data.size);
            if (e.data.size > 0) {
                chunks.push(e.data);
                console.log('[EXPORT_V2] chunks数组当前长度:', chunks.length);
            }
        };
        
        let recordingAnimationId = null;
        let recorderStarted = false;
        let startHandlerExecuted = false;

        recorder.onstart = () => {
            console.log('[EXPORT_V2] ====== recorder.onstart 触发 ======');
            console.log('[EXPORT_V2] recorder.state:', recorder.state);
            console.log('[EXPORT_V2] startHandlerExecuted:', startHandlerExecuted);
            
            if (startHandlerExecuted) {
                console.log('[EXPORT_V2] onstart已被执行，跳过');
                return;
            }
            startHandlerExecuted = true;
            recorderStarted = true;
            recordingActive = true;
            console.log('[EXPORT_V2] recordingActive设为true');
            
            console.log('[EXPORT_V2] mediaElement.play()前 - paused:', mediaElement.paused, 'ended:', mediaElement.ended, 'currentTime:', mediaElement.currentTime);
            const playPromise = mediaElement.play();
            if (playPromise) {
                playPromise.then(() => {
                    console.log('[EXPORT_V2] mediaElement.play()成功');
                }).catch(err => {
                    console.error('[EXPORT_V2] mediaElement.play()失败:', err);
                });
            }
            console.log('[EXPORT_V2] mediaElement.play()调用完成');
            seesound.isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';

            progressInterval = setInterval(() => {
                if (!recordingActive) {
                    console.log('[EXPORT_V2] progressInterval检测到recordingActive=false');
                    return;
                }
                const elapsed = mediaElement.currentTime;
                console.log('[EXPORT_V2] elapsed:', elapsed, 'duration:', duration);
                const percent = Math.min(95, 10 + (elapsed / duration) * 85);
                progressBar.style.width = percent + '%';
                progressText.textContent = `录制中 (${formatTime(elapsed)}/${formatTime(duration)})...`;
            }, 100);

            requestAnimationFrame(recordingLoop);
        };
        
        recorder.onstop = () => {
            console.log('[EXPORT_V2] ====== recorder.onstop 触发 ======');
            console.log('[EXPORT_V2] recorder.state:', recorder.state);
            console.log('[EXPORT_V2] chunks数组最终长度:', chunks.length);
        };
        
        recorder.onerror = (e) => {
            console.error('[EXPORT_V2] recorder.onerror:', e);
        };

        const duration = mediaElement.duration;
        console.log('[EXPORT_V2] 媒体时长:', duration);
        progressText.textContent = `录制中 (0/${formatTime(duration)})...`;
        progressBar.style.width = '10%';

        let progressInterval = null;
        let recordingActive = false;
        console.log('[EXPORT_V2] ====== 开始录制前检查 ======');
        console.log('[EXPORT_V2] seesound.animationId:', seesound.animationId);

        const originalAnimationId = seesound.animationId;
        if (originalAnimationId) {
            console.log('[EXPORT_V2] 取消原始动画');
            cancelAnimationFrame(originalAnimationId);
        }

        function recordingLoop() {
            if (!recordingActive) {
                console.log('[EXPORT_V2] recordingLoop退出: recordingActive=false');
                return;
            }

            const currentTime = mediaElement.currentTime;
            v2State.rotationAngle += 0.02 * v2State.rotationSpeed;
            
            const ctx = seesound.videoCtx;
            const w = seesound.videoCanvas.width;
            const h = seesound.videoCanvas.height;
            
            if (seesound.analyser) {
                seesound.analyser.getByteFrequencyData(seesound.dataArray);
            }
            
            drawBackground(ctx, w, h);
            drawLogo(ctx, 40, 40, v2State.logoSize, v2State.logoImage);
            
            ctx.font = '16px Microsoft YaHei';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'left';
            ctx.fillText(v2State.dateGenre, 40, 120);
            
            ctx.font = 'bold 36px Microsoft YaHei';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(v2State.title, 40, 170);
            
            ctx.font = '24px Microsoft YaHei';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(v2State.artist, 40, 210);
            
            const vinylCenterX = w * 0.22;
            const vinylCenterY = h * 0.58;
            drawVinylRecord(ctx, vinylCenterX, vinylCenterY, v2State.vinylSize, v2State.rotationAngle, v2State.coverImage);
            
            const timelineY = vinylCenterY + v2State.vinylSize + 30;
            const timelineWidth = v2State.vinylSize * 1.8;
            const timelineX = vinylCenterX - timelineWidth / 2;
            drawTimeline(ctx, timelineX, timelineY, timelineWidth, 6, currentTime, duration);
            
            ctx.font = '12px Microsoft YaHei';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'center';
            ctx.fillText('片段播放中:', vinylCenterX, timelineY + 28);
            
            const lyricX = w * 0.45;
            const lyricY = h * 0.35;
            const lyricWidth = w * 0.5;
            drawScrollingLyrics(ctx, v2State.lyrics, currentTime, lyricX, lyricY, lyricWidth);
            
            const infoY = h * 0.65;
            const infoX = w - 180;
            ctx.font = '14px Microsoft YaHei';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'right';
            ctx.fillText(`原唱: ${v2State.original}`, infoX, infoY);
            ctx.fillText(`风格: ${v2State.style}`, infoX, infoY + 25);
            ctx.fillText(`制作人: ${v2State.producer}`, infoX, infoY + 50);
            
            const waveX = w * 0.4;
            const waveY = h - 80 - v2State.waveOffsetY;
            const waveWidth = w * 0.55;
            drawAudioWave(ctx, waveX, waveY, waveWidth, v2State.waveHeight, seesound.dataArray, v2State.waveBars);

            recordingAnimationId = requestAnimationFrame(recordingLoop);
        }

        recorder.onstop = () => {
            console.log('[EXPORT_V2] ====== recorder.onstop 触发 ======');
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

            console.log('[EXPORT_V2] chunks数组:', chunks.length, '个');
            const blob = new Blob(chunks, { type: selectedMimeType || 'video/webm' });
            console.log('[EXPORT_V2] 生成blob, 大小:', blob.size);

            if (blob.size === 0) {
                console.error('[EXPORT_V2] 录制失败，文件为空!');
                progressText.textContent = '录制失败，文件为空';
                exportBtn.disabled = false;
                return;
            }

            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `seesound-v2-export-${Date.now()}.webm`;
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
            console.log('[EXPORT_V2] ====== mediaElement.onended 触发 ======');
            console.log('[EXPORT_V2] recordingActive:', recordingActive);
            console.log('[EXPORT_V2] recorderStarted:', recorderStarted);
            console.log('[EXPORT_V2] recorder.state:', recorder.state);
            console.log('[EXPORT_V2] mediaElement.currentTime:', mediaElement.currentTime);
            console.log('[EXPORT_V2] mediaElement.duration:', mediaElement.duration);
            
            if (!recorderStarted) {
                console.log('[EXPORT_V2] 忽略onended: recorder还未真正开始');
                return;
            }
            
            recordingActive = false;
            recorder.stop();
            seesound.isPlaying = false;
            document.getElementById('playBtn').textContent = '▶';
        };

        console.log('[EXPORT_V2] ====== 开始录制 ======');
        console.log('[EXPORT_V2] 调用recorder.start(100)');
        recorder.start(100);
        console.log('[EXPORT_V2] recorder.start()已调用, recorder.state:', recorder.state);
        
        console.log('[EXPORT_V2] 使用setTimeout作为后备启动录制');
        setTimeout(() => {
            console.log('[EXPORT_V2] setTimeout回调 - recorder.state:', recorder.state);
            if (recorder.state === 'recording' && !recorderStarted) {
                console.log('[EXPORT_V2] 手动触发录制开始（后备）');
                recorderStarted = true;
                recordingActive = true;
                console.log('[EXPORT_V2] recordingActive设为true');
                
                console.log('[EXPORT_V2] mediaElement.play()前 - paused:', mediaElement.paused, 'ended:', mediaElement.ended, 'currentTime:', mediaElement.currentTime);
                mediaElement.play().then(() => {
                    console.log('[EXPORT_V2] mediaElement.play()成功');
                }).catch(err => {
                    console.error('[EXPORT_V2] mediaElement.play()失败:', err);
                });
                seesound.isPlaying = true;
                document.getElementById('playBtn').textContent = '⏸';

                progressInterval = setInterval(() => {
                    if (!recordingActive) return;
                    const elapsed = mediaElement.currentTime;
                    const percent = Math.min(95, 10 + (elapsed / duration) * 85);
                    progressBar.style.width = percent + '%';
                    progressText.textContent = `录制中 (${formatTime(elapsed)}/${formatTime(duration)})...`;
                }, 100);

                requestAnimationFrame(recordingLoop);
            }
        }, 200);

    } catch (error) {
        console.error('[EXPORT_V2] 录制失败:', error);
        progressText.textContent = '录制失败，使用传统导出...';
        await new Promise(r => setTimeout(r, 1000));
        await exportVideoServerV2();
    }
}

// 传统服务器导出 V2
async function exportVideoServerV2() {
    alert('服务器导出功能需要启动后端服务，请使用浏览器录制模式');
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('exportProgress').classList.remove('active');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initV2);
