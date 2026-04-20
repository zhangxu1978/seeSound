// 全局变量
let audioContext, analyser, source;
let videoElement, audioElement;
let videoCanvas, effectCanvas, videoCtx, effectCtx;
let isPlaying = false;
let animationId;
let particles = [];
// 砖块吸附：记录每根柱子顶部砖块的当前 Y 位置（用于"向上"方向）
// brickPositions[i] = 砖块当前高度（与柱子同单位：px 高度值）
let brickPositions = [];
let dataArray, bufferLength;
let currentFile = null;
let isVideo = false;
let apiBaseUrl = 'http://localhost:3200';

// 背景图片相关
let bgImage = null;
let bgImageFile = null;
let useBgImage = false;

// 字幕相关
let subtitleSettings = {
    enabled: false,
    srtFile: null,
    subtitles: [],
    fontFamily: '杨任东竹石体-Regular.ttf',
    fontSize: 36,
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 2,
    effect: 'scrolling',
    position: { x: 0.5, y: 0.85 }
};

let subtitleCanvas, subtitleCtx;
let subtitleDragOffset = { x: 0, y: 0 };
let isSubtitleDragging = false;
let loadedFonts = new Set();
let subtitles = [];

// 字幕滚动动画状态
let subtitleScrollState = {
    isAnimating: false,
    animationStartTime: 0,
    animationDuration: 0.6,  // 动画持续时间（秒）
    prevSubIndex: -1,        // 动画开始前的字幕索引
    prevPrevText: '',         // 动画开始前的上一句
    prevCurrentText: '',      // 动画开始前的当前句
    prevNextText: ''          // 动画开始前的下一句
};

const FONT_LIST = [
    '杨任东竹石体-Regular.ttf',
    '站酷快乐体2016修订版.ttf',
    '手书体.ttf',
    '濑户字体setofont.ttf',
    '优设标题黑.ttf',
    '包图小白体.ttf',
    '庞门正道粗书体-正式版.ttf',
    'ZCOOL Addict Italic 01.ttf',
    'SetoFont-1.ttf',
    '胡晓波骚包体.otf'
];

async function loadSubtitleFont(fontFamily) {
    if (loadedFonts.has(fontFamily)) {
        return;
    }

    try {
        const fontPath = `/font/${fontFamily}`;
        const font = new FontFace('subtitle-font', `url(${fontPath})`);
        await font.load();
        document.fonts.add(font);
        loadedFonts.add(fontFamily);
        console.log(`字体加载成功: ${fontFamily}`);
    } catch (err) {
        console.warn(`字体加载失败: ${fontFamily}`, err);
    }
}

async function loadAllSubtitleFonts() {
    const promises = FONT_LIST.map(font => loadSubtitleFont(font));
    await Promise.all(promises);
}

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
    barBrick: false,
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

    subtitleCanvas = document.getElementById('subtitlePreviewCanvas');
    if (subtitleCanvas) {
        subtitleCtx = subtitleCanvas.getContext('2d');
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
    document.getElementById('configFile').addEventListener('change', loadConfigFile);

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
    document.getElementById('barBrick').addEventListener('change', (e) => {
        effectSettings.barBrick = e.target.checked;
        // 重置砖块状态
        brickPositions = [];
    });

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

// 字幕事件绑定
function bindSubtitleEvents() {
    const modal = document.getElementById('subtitleModal');
    const subtitleBtn = document.getElementById('subtitleBtn');
    const closeBtn = document.getElementById('closeSubtitleModal');
    const applyBtn = document.getElementById('applySubtitleBtn');

    if (subtitleBtn) {
        subtitleBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            applySubtitleSettings();
            modal.style.display = 'none';
        });
    }

    document.getElementById('subtitleEnabled')?.addEventListener('change', (e) => {
        subtitleSettings.enabled = e.target.checked;
        initSubtitlePreview();
    });

    document.getElementById('exportSubtitleBtn')?.addEventListener('click', () => {
        if (subtitleSettings.subtitles && subtitleSettings.subtitles.length > 0) {
            const srtContent = subtitlesToSRT(subtitleSettings.subtitles);
            const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = subtitleSettings.srtFile ? subtitleSettings.srtFile.name.replace('.srt', '_edited.srt') : 'subtitles_edited.srt';
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    document.getElementById('subtitleFont')?.addEventListener('change', (e) => {
        subtitleSettings.fontFamily = e.target.value;
        loadSubtitleFont(subtitleSettings.fontFamily).then(() => {
            initSubtitlePreview();
        });
    });

    document.getElementById('subtitleFontSize')?.addEventListener('input', (e) => {
        subtitleSettings.fontSize = parseInt(e.target.value);
        document.getElementById('subtitleFontSizeValue').textContent = e.target.value;
        initSubtitlePreview();
    });

    document.getElementById('subtitleEffect')?.addEventListener('change', (e) => {
        subtitleSettings.effect = e.target.value;
        initSubtitlePreview();
    });

    document.getElementById('subtitleStrokeWidth')?.addEventListener('input', (e) => {
        subtitleSettings.strokeWidth = parseInt(e.target.value);
        document.getElementById('subtitleStrokeWidthValue').textContent = e.target.value;
    });

    document.querySelectorAll('.color-option[data-subcolor]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-subcolor]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            subtitleSettings.color = opt.dataset.subcolor;
        });
    });

    document.querySelectorAll('.color-option[data-stroke]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-stroke]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            subtitleSettings.strokeColor = opt.dataset.stroke;
        });
    });

    document.getElementById('srtUpload')?.addEventListener('click', () => {
        document.getElementById('srtFile').click();
    });

    document.getElementById('srtFile')?.addEventListener('change', handleSrtFileSelect);
}

function handleSrtFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    subtitleSettings.srtFile = file;
    document.getElementById('srtFilename').textContent = file.name;
    document.getElementById('srtFileInfo').style.display = 'block';

    const reader = new FileReader();
    reader.onload = (event) => {
        subtitles = parseSRT(event.target.result);
        subtitleSettings.subtitles = subtitles;
        console.log('字幕加载成功，共', subtitles.length, '条');
        renderSubtitleList();
        initSubtitlePreview();
    };
    reader.readAsText(file);
}

function parseSRT(content) {
    const subtitles = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length < 3) continue;

        const indexLine = lines[0].trim();
        const timeLine = lines[1].trim();
        const textLines = lines.slice(2);

        const index = parseInt(indexLine);
        if (isNaN(index)) continue;

        const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
        if (!timeMatch) continue;

        const startTime = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
        const endTime = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
        const text = textLines.join('\n').replace(/<[^>]+>/g, '').trim();

        subtitles.push({ index, startTime, endTime, text });
    }

    return subtitles.sort((a, b) => a.startTime - b.startTime);
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${hrs}:${mins}:${secs},${ms}`;
}

function subtitlesToSRT(subtitleArray) {
    if (!subtitleArray || subtitleArray.length === 0) return '';
    
    return subtitleArray.map((sub, idx) => {
        return `${idx + 1}\n${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n${sub.text}\n`;
    }).join('\n');
}

function renderSubtitleList() {
    const container = document.getElementById('subtitleList');
    const title = document.getElementById('subtitleListTitle');
    const listContainer = document.getElementById('subtitleListContainer');
    
    if (!subtitles || subtitles.length === 0) {
        title.style.display = 'none';
        listContainer.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    
    title.style.display = 'block';
    listContainer.style.display = 'block';
    
    container.innerHTML = subtitles.map((sub, idx) => `
        <div class="subtitle-item" data-index="${idx}" style="padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 6px; display: flex; gap: 8px; align-items: center;">
                <input type="text" class="subtitle-start-time-input" data-idx="${idx}" value="${sub.startTime}" style="width: 80px; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 6px; color: #fff; font-size: 11px;">
                →
                <input type="text" class="subtitle-end-time-input" data-idx="${idx}" value="${sub.endTime}" style="width: 80px; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px 6px; color: #fff; font-size: 11px;">
            </div>
            <div style="display: flex; gap: 8px;">
                <input type="text" class="subtitle-text-input" data-idx="${idx}" 
                       value="${sub.text.replace(/"/g, '&quot;')}" 
                       style="flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 6px 10px; color: #fff; font-size: 13px;">
                <button class="link-subtitle-btn" data-idx="${idx}"
                        style="background: #4a90d9; border: none; color: #fff; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="连接下一字幕">
                    →
                </button>
                <button class="delete-subtitle-btn" data-idx="${idx}" 
                        style="background: #ff4444; border: none; color: #fff; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    ×
                </button>
            </div>
        </div>
    `).join('');
    
    container.querySelectorAll('.subtitle-text-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (subtitles[idx]) {
                subtitles[idx].text = e.target.value;
                subtitleSettings.subtitles = [...subtitles];
                updateSubtitlePreview();
            }
        });
    });

    container.querySelectorAll('.subtitle-start-time-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const value = parseFloat(e.target.value);
            if (subtitles[idx] && !isNaN(value)) {
                subtitles[idx].startTime = value;
                subtitleSettings.subtitles = [...subtitles];
                updateSubtitlePreview();
            }
        });
    });

    container.querySelectorAll('.subtitle-end-time-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const value = parseFloat(e.target.value);
            if (subtitles[idx] && !isNaN(value)) {
                subtitles[idx].endTime = value;
                subtitleSettings.subtitles = [...subtitles];
                updateSubtitlePreview();
            }
        });
    });
    
    container.querySelectorAll('.delete-subtitle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            subtitles.splice(idx, 1);
            subtitles = subtitles.map((sub, i) => ({ ...sub, index: i + 1 }));
            subtitleSettings.subtitles = [...subtitles];
            renderSubtitleList();
            updateSubtitlePreview();
        });
    });

    container.querySelectorAll('.link-subtitle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            if (idx < subtitles.length - 1) {
                subtitles[idx].endTime = subtitles[idx + 1].startTime;
                subtitleSettings.subtitles = [...subtitles];
                renderSubtitleList();
                updateSubtitlePreview();
            }
        });
    });
}

function applySubtitleSettings() {
    console.log('字幕设置已应用:', subtitleSettings);
}

function initSubtitlePreview() {
    if (!subtitleCanvas || !subtitleCtx) return;

    subtitleCtx.clearRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);

    if (!subtitleSettings.enabled || subtitleSettings.subtitles.length === 0) {
        subtitleCtx.fillStyle = '#666';
        subtitleCtx.font = '16px sans-serif';
        subtitleCtx.textAlign = 'center';
        subtitleCtx.fillText('上传字幕文件并启用后可预览', subtitleCanvas.width / 2, subtitleCanvas.height / 2);
        return;
    }

    subtitleCtx.fillStyle = '#0d0d1a';
    subtitleCtx.fillRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);

    const demoLines = ['上一行动歌词', '▶ 正在演唱的歌词', '下一行动歌词'];
    const previewFontSize = Math.min(subtitleSettings.fontSize * 0.5, 24);
    drawSubtitleText(subtitleCtx, demoLines.join('\n'), subtitleCanvas.width / 2, subtitleCanvas.height / 2 + 12, previewFontSize, true);
}

function updateSubtitlePreview() {
    initSubtitlePreview();
}

function getCurrentSubtitle(currentTime) {
    if (!subtitleSettings.subtitles || subtitleSettings.subtitles.length === 0) return null;

    for (let i = 0; i < subtitleSettings.subtitles.length; i++) {
        const sub = subtitleSettings.subtitles[i];
        if (currentTime >= sub.startTime && currentTime <= sub.endTime) {
            const prevSub = i > 0 ? subtitleSettings.subtitles[i - 1] : null;
            const nextSub = i < subtitleSettings.subtitles.length - 1 ? subtitleSettings.subtitles[i + 1] : null;
            return { current: sub, prev: prevSub, next: nextSub, index: i };
        }
    }
    return null;
}

function drawSubtitles(ctx, width, height, currentTime, energy) {
    if (!subtitleSettings.enabled || subtitleSettings.subtitles.length === 0) return;

    const subData = getCurrentSubtitle(currentTime);
    if (!subData) return;

    const fontSize = subtitleSettings.fontSize;
    const posX = width * subtitleSettings.position.x;
    const posY = height * subtitleSettings.position.y;

    switch (subtitleSettings.effect) {
        case 'scrolling':
            drawScrollingSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'fadein':
            drawFadeinSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'karaoke':
            drawKaraokeSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'pop':
            drawPopSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        case 'typewriter':
            drawTypewriterSubtitles(ctx, subData, posX, posY, fontSize, currentTime);
            break;
        default:
            drawScrollingSubtitles(ctx, subData, posX, posY, fontSize);
    }
}

function isCustomFont(fontFamily) {
    return fontFamily.endsWith('.ttf') || fontFamily.endsWith('.otf');
}

function getSubtitleFontFamily() {
    const fontFamily = subtitleSettings.fontFamily;
    if (!fontFamily) return 'sans-serif';
    
    if (isCustomFont(fontFamily)) {
        return loadedFonts.has(fontFamily) ? 'subtitle-font' : 'sans-serif';
    }
    
    return fontFamily;
}

function drawSubtitleText(ctx, text, x, y, fontSize, isPreview = false) {
    const fontFamily = getSubtitleFontFamily();
    ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (subtitleSettings.strokeWidth > 0) {
        ctx.strokeStyle = subtitleSettings.strokeColor;
        ctx.lineWidth = subtitleSettings.strokeWidth * (isPreview ? 1 : 2);
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
    }

    ctx.fillStyle = subtitleSettings.color;
    ctx.fillText(text, x, y);
}

// 缓动函数 - easeOutQuad（快出慢入）
function easeOutQuad(t) {
    return t * (2 - t);
}

function drawScrollingSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const lineHeight = fontSize * 1.5;
    const startY = y - lineHeight;  // 第一行Y坐标（当前句应显示的位置）

    // 当前字幕内容
    const currentPrevText = subData.prev ? subData.prev.text : '';
    const currentCurrentText = subData.current.text;
    const currentNextText = subData.next ? subData.next.text : '';

    // 首次进入，初始化状态
    if (subtitleScrollState.prevSubIndex === -1) {
        subtitleScrollState.prevSubIndex = subData.index;
        subtitleScrollState.isAnimating = false;
        subtitleScrollState.prevPrevText = currentPrevText;  // 初始化用于下次动画
    }

    // 检测字幕切换 - 当字幕索引变化时开始新动画
    if (subData.index !== subtitleScrollState.prevSubIndex) {
        // 开始新的滚动动画
        subtitleScrollState.isAnimating = true;
        subtitleScrollState.animationStartTime = currentTime;

        // 记录动画开始前的字幕内容（用于动画过程）
        subtitleScrollState.prevPrevText = subtitleScrollState.prevPrevText || currentPrevText;
        subtitleScrollState.prevCurrentText = currentCurrentText;
        subtitleScrollState.prevNextText = currentNextText;

        // 更新索引为新字幕的索引（注意：这是新的 prev 当前句）
        subtitleScrollState.prevSubIndex = subData.index;
    }

    if (subtitleScrollState.isAnimating) {
        // 计算动画进度
        const elapsed = currentTime - subtitleScrollState.animationStartTime;
        const progress = Math.min(1, elapsed / subtitleScrollState.animationDuration);
        const easedProgress = easeOutQuad(progress);  // 使用缓动函数

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // === 第一行：动画前的上一句（向上淡出） ===
        const row1OffsetY = -lineHeight * easedProgress;  // 向上移动
        const row1Alpha = Math.max(0, 0.5 * (1 - easedProgress * 1.5));  // 快速淡出

        if (subtitleScrollState.prevPrevText && row1Alpha > 0.01) {
            ctx.globalAlpha = row1Alpha;
            drawSubtitleText(ctx, subtitleScrollState.prevPrevText, x, startY + row1OffsetY, fontSize * 0.8);
        }

        // === 第二行：动画前的当前句（向上移动到焦点位置） ===
        const row2OffsetY = lineHeight * (1 - easedProgress);  // 从当前位置移动到焦点位置
        const row2Alpha = 1.0;

        ctx.globalAlpha = row2Alpha;
        drawSubtitleText(ctx, '▶ ' + subtitleScrollState.prevCurrentText, x, startY + row2OffsetY, fontSize);

        // === 第三行：下一句（淡入移入） ===
        const row3OffsetY = lineHeight * (2 - easedProgress);  // 从下方移入
        const row3Alpha = Math.min(0.5, easedProgress * 1.2);  // 渐显

        if (currentNextText && row3Alpha > 0.01) {
            ctx.globalAlpha = row3Alpha;
            drawSubtitleText(ctx, currentNextText, x, startY + row3OffsetY, fontSize * 0.8);
        }

        ctx.restore();

        // 动画结束
        if (progress >= 1) {
            subtitleScrollState.isAnimating = false;
            // 更新 prevPrevText 为新的 prev（用于下次动画）
            subtitleScrollState.prevPrevText = currentPrevText;
        }
    } else {
        // 非动画状态：静态显示三行字幕
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 第一行（上一句）- 淡化显示
        ctx.globalAlpha = 0.5;
        if (currentPrevText) {
            drawSubtitleText(ctx, currentPrevText, x, startY, fontSize * 0.8);
        }

        // 第二行（当前句）- 焦点显示
        ctx.globalAlpha = 1.0;
        drawSubtitleText(ctx, '▶ ' + currentCurrentText, x, startY + lineHeight, fontSize);

        // 第三行（下一句）- 淡化显示
        ctx.globalAlpha = 0.5;
        if (currentNextText) {
            drawSubtitleText(ctx, currentNextText, x, startY + lineHeight * 2, fontSize * 0.8);
        }

        ctx.restore();
    }

    ctx.globalAlpha = 1.0;
}

function drawFadeinSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const chars = subData.current.text.split('');
    const visibleChars = Math.floor(chars.length * progress);

    ctx.globalAlpha = 0.3 + progress * 0.7;
    const text = chars.slice(0, visibleChars).join('');
    drawSubtitleText(ctx, text, x, y, fontSize);
    ctx.globalAlpha = 1.0;
}

function drawKaraokeSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const text = subData.current.text;
    const chars = text.split('');
    const highlightIndex = Math.floor(chars.length * progress);

    ctx.font = `${fontSize}px "${getSubtitleFontFamily()}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let offsetX = -ctx.measureText(text).width / 2;
    const lineHeight = fontSize * 1.2;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const charWidth = ctx.measureText(char).width;

        if (i < highlightIndex) {
            ctx.fillStyle = '#ffdd00';
            if (subtitleSettings.strokeWidth > 0) {
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = subtitleSettings.strokeWidth * 2;
                ctx.strokeText(char, x + offsetX + charWidth / 2, y);
            }
            ctx.fillText(char, x + offsetX + charWidth / 2, y);
        } else {
            ctx.fillStyle = subtitleSettings.color;
            if (subtitleSettings.strokeWidth > 0) {
                ctx.strokeStyle = subtitleSettings.strokeColor;
                ctx.lineWidth = subtitleSettings.strokeWidth * 2;
                ctx.strokeText(char, x + offsetX + charWidth / 2, y);
            }
            ctx.fillText(char, x + offsetX + charWidth / 2, y);
        }

        offsetX += charWidth;
    }
}

function drawPopSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    let scale = 1;
    let alpha = 1;

    if (progress < 0.1) {
        scale = 0.5 + progress * 5;
        alpha = progress * 10;
    } else if (progress > 0.8) {
        alpha = (1 - progress) * 5;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const text = subData.current.text;
    ctx.font = `${fontSize}px "${getSubtitleFontFamily()}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (subtitleSettings.strokeWidth > 0) {
        ctx.strokeStyle = subtitleSettings.strokeColor;
        ctx.lineWidth = subtitleSettings.strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0);
    }

    ctx.fillStyle = subtitleSettings.color;
    ctx.fillText(text, 0, 0);

    ctx.restore();
}

function drawTypewriterSubtitles(ctx, subData, x, y, fontSize, currentTime) {
    const duration = subData.current.endTime - subData.current.startTime;
    const elapsed = currentTime - subData.current.startTime;
    const progress = Math.min(1, elapsed / duration);

    const chars = subData.current.text.split('');
    const visibleChars = Math.floor(chars.length * progress);
    let text = chars.slice(0, visibleChars).join('');

    if (visibleChars < chars.length && Math.floor(currentTime * 10) % 2 === 0) {
        text += '▌';
    }

    drawSubtitleText(ctx, text, x, y, fontSize);
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

    // 检测鼠标是否在调整手柄区域
    function isMouseOverHandle(e) {
        const handleRect = handle.getBoundingClientRect();
        // 增加可点击区域，向外扩展8px
        const extendedRect = {
            left: handleRect.left - 8,
            top: handleRect.top - 8,
            right: handleRect.right + 8,
            bottom: handleRect.bottom + 8
        };
        return e.clientX >= extendedRect.left && e.clientX <= extendedRect.right &&
               e.clientY >= extendedRect.top && e.clientY <= extendedRect.bottom;
    }

    // 鼠标移动时更新光标
    overlay.addEventListener('mousemove', (e) => {
        if (isMouseOverHandle(e)) {
            overlay.style.cursor = 'nwse-resize';
        } else {
            overlay.style.cursor = 'move';
        }
    });

    overlay.addEventListener('mousedown', (e) => {
        if (isMouseOverHandle(e)) {
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

    // 鼠标离开时恢复默认光标
    overlay.addEventListener('mouseleave', () => {
        overlay.style.cursor = 'move';
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
    const count = effectSettings.particleCount || 150;
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

// 动画主循环
let lastTime = 0;
function animate(time = 0) {
    animationId = requestAnimationFrame(animate);

    // 绘制视频/背景
    videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

    if (useBgImage && bgImage) {
        videoCtx.drawImage(bgImage, 0, 0, videoCanvas.width, videoCanvas.height);
    } else if (isVideo) {
        try {
            videoCtx.drawImage(videoElement, 0, 0, videoCanvas.width, videoCanvas.height);
        } catch (e) {
            // 视频还没准备好
        }
    } else {
        // 纯音频模式，黑色背景
        videoCtx.fillStyle = '#0d0d1a';
        videoCtx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
    }

    // 获取音频数据
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
    }

    // 绘制特效
    drawEffectToCanvas(time);

    // 更新进度条
    const element = isVideo ? videoElement : audioElement;
    if (element.duration) {
        const percent = (element.currentTime / element.duration) * 100;
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('timeDisplay').textContent = 
            `${formatTime(element.currentTime)} / ${formatTime(element.duration)}`;
    }
}

// 绘制特效到画布
function drawEffectToCanvas(time) {
    const ctx = effectCtx;
    const w = effectCanvas.width;
    const h = effectCanvas.height;
    const theme = colorThemes[effectSettings.colors] || colorThemes.purple;

    // 清除
    ctx.clearRect(0, 0, w, h);

    // 获取音频数据
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
    }

    // 计算能量
    let bass = 0, mid = 0, treble = 0, total = 0;
    if (dataArray && dataArray.length > 0) {
        const bassCount = Math.floor(bufferLength * 0.2);
        const midCount = Math.floor(bufferLength * 0.5);

        for (let i = 0; i < bufferLength; i++) {
            total += dataArray[i];
            if (i < bassCount) bass += dataArray[i];
            else if (i < midCount) mid += dataArray[i];
            else treble += dataArray[i];
        }

        bass = bass / bassCount / 255;
        mid = mid / (midCount - bassCount) / 255;
        treble = treble / (bufferLength - midCount) / 255;
        total = total / bufferLength / 255;
    }

    const energy = {
        bass: bass * effectSettings.sensitivity,
        mid: mid * effectSettings.sensitivity,
        treble: treble * effectSettings.sensitivity,
        average: total * effectSettings.sensitivity,
        data: dataArray || new Uint8Array(bufferLength).fill(128)
    };

    const t = time / 1000;

    // 应用变形
    applyTransform(ctx, w, h, t, effectSettings);

    // 根据类型绘制
    switch (effectSettings.type) {
        case 'none':
            // 无效果，不绘制任何内容
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

    // 绘制字幕
    const element = isVideo ? videoElement : audioElement;
    const currentTime = element?.currentTime || 0;
    drawSubtitles(ctx, w, h, currentTime, energy);

    ctx.restore();
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
function drawParticles(ctx, w, h, energy, time, theme) {
    const sensitivity = effectSettings.sensitivity;
    
    particles.forEach((p, i) => {
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

        // 粒子大小随能量变化
        const size = p.size * (1 + energy.average);
        const alpha = 0.6 + 0.4 * energy.average;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        
        const hue = (theme.hue + i * 3 + time * 20) % 360;
        ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        ctx.fill();
        
        // 发光
        ctx.shadowBlur = size * 3 * energy.average;
        ctx.shadowColor = ctx.fillStyle;
    });
    
    ctx.shadowBlur = 0;
}

// 粒子上升效果
function drawParticlesUp(ctx, w, h, energy, time, theme) {
    const sensitivity = effectSettings.sensitivity;
    
    particles.forEach((p, i) => {
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

// 频谱效果 - 增强版
function drawSpectrum(ctx, w, h, energy, theme) {
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

    // 砖块尺寸
    const brickH = Math.max(4, Math.round(barWidth * 0.6));
    const brickW = barWidth;
    // 砖块下落速度（每帧减少的高度值）
    const brickFallSpeed = 1.5;

    // 初始化砖块数组
    if (useBrick && brickPositions.length !== barCount) {
        brickPositions = new Array(barCount).fill(0);
    }

    for (let i = 0; i < barCount; i++) {
        // 计算相对位置（0-1）
        const normalizedPos = i / (barCount - 1);

        // 对称映射：两边对应低频，中间对应中高频（能量较强区域）
        // 使用抛物线形状：中间 = 中高频，两边 = 低频
        const distFromCenter = Math.abs(normalizedPos - 0.5) * 2; // 0~1, 0是中间，1是两边
        const frequencyPos = 0.1 + distFromCenter * 0.5; // 中间对应0.1（中高频），两边对应0.6（低频）
        const dataIndex = Math.floor(frequencyPos * bufferLength);
        const value = energy.data[dataIndex] || 0;

        // 计算能量值
        const barHeight = Math.max(10, (value / 255) * h * 0.8 * energy.average);

        // 统一颜色主题
        const hue = theme.hue;
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
            gradient = ctx.createLinearGradient(bx, by, bx, by + bh);
        } else if (effectSettings.gradientDirection === 'horizontal') {
            gradient = ctx.createLinearGradient(bx, by, bx + bw, by);
        } else {
            gradient = ctx.createRadialGradient(bx + bw/2, by + bh/2, 0, bx + bw/2, by + bh/2, Math.max(bw, bh));
        }

        gradient.addColorStop(0, `hsl(${hue}, ${theme.sat}%, ${theme.light + 20}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${theme.sat}%, ${theme.light - 20}%)`);

        // 绘制圆角矩形
        ctx.fillStyle = gradient;
        roundRect(ctx, bx, by, bw, bh, radius);
        ctx.fill();

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
            roundRect(ctx, mx, my, bw, bh, radius);
            ctx.fill();
        }

        // ---- 砖块吸附逻辑（仅支持 up/down/center 方向） ----
        if (useBrick && (direction === 'up' || direction === 'down' || direction === 'center')) {
            // 当前柱子高度
            const currentH = barHeight;

            // 如果柱子上升，砖块被顶上去（贴着柱子顶部）
            if (currentH >= brickPositions[i]) {
                brickPositions[i] = currentH;
            } else {
                // 柱子下落，砖块缓慢下落
                brickPositions[i] = Math.max(currentH, brickPositions[i] - brickFallSpeed);
            }

            const brickHeight = brickPositions[i];

            // 根据方向确定砖块位置
            let brx, bry;
            const gap2 = 2; // 砖块与柱子顶端的间距（像素）

            if (direction === 'up') {
                brx = bx;
                bry = h - brickHeight - brickH - gap2;
            } else if (direction === 'down') {
                brx = bx;
                bry = brickHeight + gap2;
            } else { // center
                // 上方砖块
                brx = bx;
                bry = (h - brickHeight) / 2 - brickH - gap2;
            }

            // 绘制砖块（亮色，无渐变）
            const brickColor = `hsl(${hue}, ${theme.sat}%, ${Math.min(theme.light + 35, 95)}%)`;
            ctx.fillStyle = brickColor;
            roundRect(ctx, brx, bry, brickW, brickH, Math.min(2, radius));
            ctx.fill();

            // 镜像砖块（跟随对应方向的镜像柱子）
            if (mirror) {
                let mbrx, mbry;
                if (direction === 'up') {
                    // 镜像柱子从顶部向下，砖块贴在镜像柱子的底端下方
                    mbrx = bx;
                    mbry = brickHeight + gap2; // 对应 down 方向砖块位置
                } else if (direction === 'down') {
                    // 镜像柱子从底部向上，砖块贴在镜像柱子顶端上方
                    mbrx = bx;
                    mbry = h - brickHeight - brickH - gap2;
                } else {
                    // center 方向：下方砖块（关于画布中心对称）
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

// 波形效果
function drawWave(ctx, w, h, energy, time, theme) {
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
        
        ctx.lineWidth = lineWidth - line * 0.5;
        ctx.strokeStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${alpha})`;
        
        if (glow) {
            ctx.shadowBlur = 15 - line * 3;
            ctx.shadowColor = ctx.strokeStyle;
        }

        ctx.beginPath();

        const points = 200;
        for (let i = 0; i < points; i++) {
            const t = i / points;
            const dataIndex = Math.floor(t * bufferLength);
            const v = (energy.data[dataIndex] || 128) / 128 - 1;

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
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    ctx.shadowBlur = 0;
}

// 环形效果
function drawCircular(ctx, w, h, energy, time, theme) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) * 0.35;

    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
        const angle = (i / bufferLength) * Math.PI * 2 - Math.PI / 2;
        const amp = (energy.data[i] / 255) * radius * 0.5 * (1 + energy.bass);
        const r = radius + amp;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
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
    ctx.arc(cx, cy, centerPulse, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, ${theme.sat}%, ${theme.light}%, ${0.3 + energy.average * 0.4})`;
    ctx.fill();

    ctx.shadowBlur = 0;
}

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 浏览器录制导出
async function exportVideoBrowser() {
    if (!currentFile) return;

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

        const mediaElement = isVideo ? videoElement : audioElement;
        const wasPlaying = isPlaying;

        // 暂停当前播放并重置
        mediaElement.pause();
        mediaElement.currentTime = 0;
        isPlaying = false;
        document.getElementById('playBtn').textContent = '▶';

        if (!audioContext) initAudioContext();

        // 获取特效层的位置和尺寸信息
        const overlay = document.getElementById('overlayContainer');
        const overlayRect = overlay.getBoundingClientRect();
        const canvasRect = videoCanvas.getBoundingClientRect();

        // 计算特效层相对于 videoCanvas 的缩放和位置
        const scaleX = videoCanvas.width / canvasRect.width;
        const scaleY = videoCanvas.height / canvasRect.height;
        const overlayX = (overlayRect.left - canvasRect.left) * scaleX;
        const overlayY = (overlayRect.top - canvasRect.top) * scaleY;
        const overlayW = overlayRect.width * scaleX;
        const overlayH = overlayRect.height * scaleY;

        // 创建音频流
        let audioStream;
        try {
            const dest = audioContext.createMediaStreamDestination();
            if (source) source.connect(dest);
            analyser.connect(dest);
            audioStream = dest.stream;
        } catch (e) {
            console.warn('音频录制可能有问题:', e);
        }

        // 使用 videoCanvas 创建视频流（在录制期间我们将重写绘制逻辑）
        const videoStream = videoCanvas.captureStream(30);

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

        // 保存原始的动画循环
        const originalAnimationId = animationId;

        // 停止原始动画循环
        if (originalAnimationId) {
            cancelAnimationFrame(originalAnimationId);
        }

        // 临时保存 effectCanvas 的尺寸
        const origEffectW = effectCanvas.width;
        const origEffectH = effectCanvas.height;

        // 用于临时绘制特效的函数（直接画到 videoCanvas）
        function drawVideoWithEffects(time) {
            const ctx = videoCtx;
            const w = videoCanvas.width;
            const h = videoCanvas.height;

            // 绘制视频/背景
            ctx.clearRect(0, 0, w, h);

            if (useBgImage && bgImage) {
                ctx.drawImage(bgImage, 0, 0, w, h);
            } else if (isVideo) {
                try {
                    ctx.drawImage(videoElement, 0, 0, w, h);
                } catch (e) {}
            } else {
                ctx.fillStyle = '#0d0d1a';
                ctx.fillRect(0, 0, w, h);
            }

            // 获取音频数据
            if (analyser) {
                analyser.getByteFrequencyData(dataArray);
            }

            // 保存状态并设置特效裁剪区域
            ctx.save();
            ctx.beginPath();
            ctx.rect(overlayX, overlayY, overlayW, overlayH);
            ctx.clip();

            // 临时修改 effectCanvas 尺寸
            effectCanvas.width = overlayW;
            effectCanvas.height = overlayH;
            effectCtx.clearRect(0, 0, overlayW, overlayH);

            // 绘制特效到 effectCanvas
            drawEffectToCanvas(time);

            // 将特效绘制到 videoCanvas
            ctx.drawImage(effectCanvas, overlayX, overlayY, overlayW, overlayH);

            // 恢复 effectCanvas 尺寸
            effectCanvas.width = origEffectW;
            effectCanvas.height = origEffectH;

            ctx.restore();
        }

        // 录制用的动画循环
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
            isPlaying = true;
            document.getElementById('playBtn').textContent = '⏸';

            progressInterval = setInterval(() => {
                if (!recordingActive) return;
                const elapsed = (Date.now() - startTime) / 1000;
                const percent = Math.min(95, 10 + (elapsed / duration) * 85);
                progressBar.style.width = percent + '%';
                progressText.textContent = `录制中 (${formatTime(elapsed)}/${formatTime(duration)})...`;
            }, 100);

            // 启动录制循环
            requestAnimationFrame(recordingLoop);
        };

        recorder.onstop = () => {
            clearInterval(progressInterval);
            recordingActive = false;

            if (recordingAnimationId) {
                cancelAnimationFrame(recordingAnimationId);
            }

            // 恢复原始动画循环
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
                isPlaying = true;
                document.getElementById('playBtn').textContent = '⏸';
            }
        };

        // 监听媒体结束
        mediaElement.onended = () => {
            recordingActive = false;
            recorder.stop();
            isPlaying = false;
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
    if (!currentFile) return;

    const progressEl = document.getElementById('exportProgress');
    const progressBar = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressText');
    const exportBtn = document.getElementById('exportBtn');

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
            bgImageHeight: bgImage ? bgImage.height : null,
            subtitle: subtitleSettings.enabled ? {
                fontFamily: subtitleSettings.fontFamily,
                fontSize: subtitleSettings.fontSize,
                color: subtitleSettings.color,
                strokeColor: subtitleSettings.strokeColor,
                strokeWidth: subtitleSettings.strokeWidth,
                effect: subtitleSettings.effect,
                position: subtitleSettings.position,
                subtitles: subtitleSettings.subtitles
            } : null
        };

        const formData = new FormData();
        formData.append('video', currentFile);
        formData.append('settings', JSON.stringify(settings));

        // 如果有背景图，也上传
        if (useBgImage && bgImageFile) {
            formData.append('bgImage', bgImageFile);
        }

        // 如果有字幕，上传编辑后的字幕内容
        if (subtitleSettings.enabled && subtitleSettings.subtitles && subtitleSettings.subtitles.length > 0) {
            const srtContent = subtitlesToSRT(subtitleSettings.subtitles);
            const srtBlob = new Blob([srtContent], { type: 'text/plain' });
            const srtFileName = subtitleSettings.srtFile ? subtitleSettings.srtFile.name : 'subtitles.srt';
            formData.append('subtitle', srtBlob, srtFileName);
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
            barBrick: effectSettings.barBrick,
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

// 载入配置文件
function loadConfigFile(e) {
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
                if (typeof effectSettings.barBrick !== 'undefined') {
                    document.getElementById('barBrick').checked = effectSettings.barBrick;
                }

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

                // 应用位置预设
                applyPositionPreset(effectSettings.position);
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

// 启动
init();
