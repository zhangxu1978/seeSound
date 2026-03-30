const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

/**
 * 音频分析器 - 从视频/音频文件中提取音频数据用于可视化
 */
class AudioAnalyzer {
    constructor() {
        this.audioData = null;
        this.duration = 0;
        this.sampleRate = 44100;
    }

    /**
     * 从视频/音频文件中提取音频数据
     * @param {string} inputPath - 输入文件路径
     * @returns {Promise<Object>} - 音频数据
     */
    async extractAudioData(inputPath) {
        const tempDir = path.join(__dirname, 'temp');
        const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`);

        return new Promise((resolve, reject) => {
            // 首先提取音频为 WAV 格式
            ffmpeg(inputPath)
                .noVideo()
                .audioCodec('pcm_s16le')
                .audioChannels(1)
                .audioFrequency(44100)
                .output(audioPath)
                .on('end', () => {
                    // 读取音频数据
                    this.parseWavFile(audioPath)
                        .then(data => {
                            // 清理临时文件
                            fs.unlinkSync(audioPath);
                            this.audioData = data;
                            resolve(data);
                        })
                        .catch(reject);
                })
                .on('error', reject)
                .run();
        });
    }

    /**
     * 解析 WAV 文件
     */
    async parseWavFile(wavPath) {
        const buffer = fs.readFileSync(wavPath);
        
        // 读取 WAV 头信息
        const sampleRate = buffer.readUInt32LE(24);
        const dataOffset = 44; // 标准 WAV 头大小
        const dataLength = buffer.length - dataOffset;
        
        // 读取音频样本 (16-bit PCM)
        const samples = [];
        for (let i = dataOffset; i < buffer.length; i += 2) {
            const sample = buffer.readInt16LE(i);
            samples.push(sample / 32768); // 归一化到 -1 到 1
        }

        this.sampleRate = sampleRate;
        this.duration = samples.length / sampleRate;

        return {
            samples,
            sampleRate,
            duration: this.duration
        };
    }

    /**
     * 获取指定时间的频谱数据
     * @param {number} time - 时间（秒）
     * @param {number} fftSize - FFT 大小
     * @returns {Object} - 频谱能量数据
     */
    getSpectrumAtTime(time, fftSize = 256) {
        if (!this.audioData) {
            return this.getMockSpectrum(time);
        }

        const sampleIndex = Math.floor(time * this.sampleRate);
        const startIndex = Math.max(0, sampleIndex - fftSize / 2);
        const endIndex = Math.min(this.audioData.samples.length, startIndex + fftSize);

        const window = this.audioData.samples.slice(startIndex, endIndex);
        const windowed = this.applyHannWindow(window, fftSize);
        const spectrum = this.fft(windowed);
        
        return this.calculateEnergy(spectrum);
    }

    /**
     * 应用汉宁窗
     */
    applyHannWindow(samples, size) {
        const windowed = [];
        for (let i = 0; i < samples.length; i++) {
            const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
            windowed.push(samples[i] * hann);
        }
        // 补齐到 size
        while (windowed.length < size) {
            windowed.push(0);
        }
        return windowed;
    }

    /**
     * 简化的 FFT 实现
     */
    fft(samples) {
        const n = samples.length;
        
        // 基例：返回带 real/imag/magnitude 的对象
        if (n <= 1) {
            const val = samples[0];
            if (typeof val === 'number') {
                return [{ real: val, imag: 0, magnitude: Math.abs(val) }];
            }
            return samples;
        }

        // Cooley-Tukey FFT 算法
        const even = [];
        const odd = [];
        for (let i = 0; i < n; i++) {
            if (i % 2 === 0) even.push(samples[i]);
            else odd.push(samples[i]);
        }

        const evenFFT = this.fft(even);
        const oddFFT = this.fft(odd);

        const result = new Array(n);
        for (let k = 0; k < n / 2; k++) {
            const angle = -2 * Math.PI * k / n;
            const twiddle = {
                real: Math.cos(angle),
                imag: Math.sin(angle)
            };
            
            const oddReal = oddFFT[k] ? (oddFFT[k].real !== undefined ? oddFFT[k].real : oddFFT[k]) : 0;
            const oddImag = oddFFT[k] ? (oddFFT[k].imag !== undefined ? oddFFT[k].imag : 0) : 0;
            
            const tReal = twiddle.real * oddReal - twiddle.imag * oddImag;
            const tImag = twiddle.real * oddImag + twiddle.imag * oddReal;

            const evenReal = evenFFT[k] ? (evenFFT[k].real !== undefined ? evenFFT[k].real : evenFFT[k]) : 0;
            const evenImag = evenFFT[k] ? (evenFFT[k].imag !== undefined ? evenFFT[k].imag : 0) : 0;

            result[k] = {
                real: evenReal + tReal,
                imag: evenImag + tImag,
                magnitude: Math.sqrt(Math.pow(evenReal + tReal, 2) + Math.pow(evenImag + tImag, 2))
            };
            result[k + n / 2] = {
                real: evenReal - tReal,
                imag: evenImag - tImag,
                magnitude: Math.sqrt(Math.pow(evenReal - tReal, 2) + Math.pow(evenImag - tImag, 2))
            };
        }

        return result;
    }

    /**
     * 计算各频段能量
     */
    calculateEnergy(spectrum) {
        const bassEnd = Math.floor(spectrum.length * 0.1);
        const midEnd = Math.floor(spectrum.length * 0.5);

        let bass = 0, mid = 0, treble = 0, total = 0;
        const magnitudes = [];

        for (let i = 0; i < spectrum.length; i++) {
            const mag = spectrum[i].magnitude || spectrum[i];
            magnitudes.push(mag);
            
            const normalized = mag / spectrum.length;
            
            if (i < bassEnd) bass += normalized;
            else if (i < midEnd) mid += normalized;
            else treble += normalized;
            
            total += normalized;
        }

        const maxMag = Math.max(...magnitudes, 1);
        const spectrumValues = magnitudes.map(mag => 
            Math.min(255, Math.floor((mag / maxMag) * 255))
        );

        const amplify = 50;
        bass = Math.min(1, bass / bassEnd * amplify);
        mid = Math.min(1, mid / (midEnd - bassEnd) * amplify);
        treble = Math.min(1, treble / (spectrum.length - midEnd) * amplify);
        const average = Math.min(1, total / spectrum.length * amplify);

        return { bass, mid, treble, average, spectrum: spectrumValues };
    }

    /**
     * 获取模拟频谱（用于测试）
     */
    getMockSpectrum(time) {
        const beat = Math.sin(time * 10) * 0.5 + 0.5;
        const spectrum = [];
        for (let i = 0; i < 64; i++) {
            const freq = (i / 64);
            const value = (Math.sin(time * 5 + i * 0.3) * 0.5 + 0.5) * 
                          (Math.sin(time * 10 + freq * 10) * 0.3 + 0.7) * 
                          (1 - freq * 0.5) * beat;
            spectrum.push(Math.floor(value * 255));
        }
        return {
            bass: beat * 0.8,
            mid: Math.sin(time * 15) * 0.3 + 0.3,
            treble: Math.sin(time * 25) * 0.2 + 0.2,
            average: beat * 0.5,
            spectrum
        };
    }

    /**
     * 预分析整个音频文件
     * @param {string} inputPath - 输入文件路径
     * @param {number} fps - 帧率
     * @returns {Promise<Array>} - 每帧的频谱数据
     */
    async analyzeFullAudio(inputPath, fps = 30) {
        try {
            await this.extractAudioData(inputPath);
        } catch (err) {
            console.warn('音频提取失败，使用模拟数据:', err.message);
            this.duration = 60; // 默认60秒
        }

        const totalFrames = Math.floor(this.duration * fps);
        const frameData = [];

        for (let i = 0; i < totalFrames; i++) {
            const time = i / fps;
            const energy = this.getSpectrumAtTime(time);
            // 只存储必要的数据，减少内存占用
            frameData.push({
                frame: i,
                time,
                bass: energy.bass,
                mid: energy.mid,
                treble: energy.treble,
                average: energy.average,
                spectrum: energy.spectrum ? energy.spectrum.slice(0, 128) : new Array(128).fill(128) // 限制频谱数据长度
            });
        }

        return frameData;
    }

    /**
     * 获取指定帧的频谱数据（用于流式处理）
     * @param {number} frameIndex - 帧索引
     * @param {number} fps - 帧率
     * @returns {Object} - 频谱能量数据
     */
    getFrameData(frameIndex, fps = 30) {
        const time = frameIndex / fps;
        const energy = this.getSpectrumAtTime(time);
        return {
            frame: frameIndex,
            time,
            bass: energy.bass,
            mid: energy.mid,
            treble: energy.treble,
            average: energy.average,
            spectrum: energy.spectrum ? energy.spectrum.slice(0, 128) : new Array(128).fill(128)
        };
    }
}

module.exports = AudioAnalyzer;
