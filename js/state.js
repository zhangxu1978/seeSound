
// 全局状态和配置

// 全局变量
let audioContext, analyser, source;
let videoElement, audioElement;
let videoCanvas, effectCanvas, videoCtx, effectCtx;
let isPlaying = false;
let animationId;
let particles = [];
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
const subtitleSettings = {
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
const subtitleScrollState = {
    isAnimating: false,
    animationStartTime: 0,
    animationDuration: 0.5,
    prevSubIndex: -1,
    prevPrevText: '',
    prevCurrentText: '',
    prevNextText: ''
};

// 特效设置
const effectSettings = {
    type: 'particles',
    colors: 'purple',
    sensitivity: 1,
    opacity: 0.9,
    position: 'fullscreen',
    barDirection: 'up',
    barCount: 64,
    barWidth: 8,
    barGap: 0.2,
    barRadius: 4,
    mirrorEffect: true,
    gradientDirection: 'vertical',
    barBrick: false,
    waveOrigin: 'center',
    amplitude: 1,
    frequency: 2,
    lineWidth: 3,
    waveLines: 1,
    glowEffect: true,
    transformType: 'none',
    transformIntensity: 30,
    transformSpeed: 1
};

// 层容器元素
let effectLayer, subtitleLayer, textLayer;
let textLayerCanvas, textLayerCtx;

// 层设置
const effectLayerSettings = {
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100
};

const subtitleLayerSettings = {
    visible: true,
    x: 0,
    y: 0,
    width: 50,
    height: 50
};

const textLayerSettings = {
    visible: true,
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    text: '自定义文字',
    fontSize: 48,
    fontFamily: 'Microsoft YaHei',
    color: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 2,
    align: 'center'
};

// 层拖拽状态
let currentDraggingLayer = null;
let currentResizingLayer = null;
let dragStartPos = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };
let resizeStartSize = { width: 0, height: 0 };

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

// 字体列表
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

// 导出所有状态和配置
window.seesound = {
    audioContext, analyser, source,
    videoElement, audioElement,
    videoCanvas, effectCanvas, videoCtx, effectCtx,
    isPlaying, animationId, particles, brickPositions,
    dataArray, bufferLength, currentFile, isVideo, apiBaseUrl,
    bgImage, bgImageFile, useBgImage,
    subtitleSettings, subtitleCanvas, subtitleCtx,
    subtitleDragOffset, isSubtitleDragging, loadedFonts, subtitles,
    subtitleScrollState, effectSettings, colorThemes, FONT_LIST,
    // 层相关
    effectLayer, subtitleLayer, textLayer,
    textLayerCanvas, textLayerCtx,
    effectLayerSettings, subtitleLayerSettings, textLayerSettings,
    currentDraggingLayer, currentResizingLayer,
    dragStartPos, dragOffset, resizeStartSize
};

