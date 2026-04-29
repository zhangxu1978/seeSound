
// GPU 加速检测模块
const { exec } = require('child_process');

// 全局缓存
let gpuEncoderCache = null;

// 检测可用的 GPU 编码器
function detectGPUEncoder() {
    return new Promise((resolve) => {
        exec('ffmpeg -hide_banner -encoders 2>/dev/null | grep -E "h264_nvenc|h264_qsv|h264_amf|h264_videotoolbox"', (err, stdout) => {
            if (err || !stdout) {
                console.log('💡 未检测到 GPU 编码器，将使用 CPU 编码 (libx264)');
                resolve({ available: false, encoder: null });
                return;
            }
            
            const encoders = stdout.toString();
            let encoder = null;
            let gpuType = null;
            
            if (encoders.includes('h264_nvenc')) {
                encoder = 'h264_nvenc';
                gpuType = 'NVIDIA';
            } else if (encoders.includes('h264_qsv')) {
                encoder = 'h264_qsv';
                gpuType = 'Intel Quick Sync';
            } else if (encoders.includes('h264_amf')) {
                encoder = 'h264_amf';
                gpuType = 'AMD';
            } else if (encoders.includes('h264_videotoolbox')) {
                encoder = 'h264_videotoolbox';
                gpuType = 'Apple VideoToolbox';
            }
            
            if (encoder) {
                console.log(`🎮 检测到 GPU 加速: ${gpuType} (${encoder})`);
                resolve({ available: true, encoder, gpuType });
            } else {
                console.log('💡 未检测到 GPU 编码器，将使用 CPU 编码 (libx264)');
                resolve({ available: false, encoder: null });
            }
        });
    });
}

// 获取编码器配置（带缓存）
async function getEncoderConfig() {
    if (!gpuEncoderCache) {
        gpuEncoderCache = await detectGPUEncoder();
    }
    return gpuEncoderCache;
}

// 获取编码器的 FFmpeg 参数
function getEncoderOptions(encoder) {
    const options = {
        'h264_nvenc': ['-preset p4', '-tune hq', '-cq 23'],
        'h264_qsv': ['-preset medium', '-qscale:v 23'],
        'h264_amf': ['-preset quality', '-qscale:v 23'],
        'h264_videotoolbox': ['-preset quality', '-qscale:v 23'],
        'libx264': ['-preset medium', '-crf 23']
    };
    return options[encoder] || options['libx264'];
}

module.exports = {
    detectGPUEncoder,
    getEncoderConfig,
    getEncoderOptions
};

