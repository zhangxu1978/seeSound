// 事件绑定模块

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
        seesound.subtitleSettings.enabled = e.target.checked;
        initSubtitlePreview();
    });

    document.getElementById('exportSubtitleBtn')?.addEventListener('click', () => {
        if (seesound.subtitleSettings.subtitles && seesound.subtitleSettings.subtitles.length > 0) {
            const srtContent = seesound.subtitleSettings.subtitles.map((sub, idx) => {
                const startHrs = Math.floor(sub.startTime / 3600).toString().padStart(2, '0');
                const startMins = Math.floor((sub.startTime % 3600) / 60).toString().padStart(2, '0');
                const startSecs = Math.floor(sub.startTime % 60).toString().padStart(2, '0');
                const startMs = Math.floor((sub.startTime % 1) * 1000).toString().padStart(3, '0');
                const endHrs = Math.floor(sub.endTime / 3600).toString().padStart(2, '0');
                const endMins = Math.floor((sub.endTime % 3600) / 60).toString().padStart(2, '0');
                const endSecs = Math.floor(sub.endTime % 60).toString().padStart(2, '0');
                const endMs = Math.floor((sub.endTime % 1) * 1000).toString().padStart(3, '0');
                return `${idx + 1}\n${startHrs}:${startMins}:${startSecs},${startMs} --> ${endHrs}:${endMins}:${endSecs},${endMs}\n${sub.text}`;
            }).join('\n\n');
            const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = seesound.subtitleSettings.srtFile ? seesound.subtitleSettings.srtFile.name.replace('.srt', '_edited.srt') : 'subtitles_edited.srt';
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    document.getElementById('batchLinkSubtitleBtn')?.addEventListener('click', () => {
        if (seesound.subtitles && seesound.subtitles.length > 1) {
            for (let i = 0; i < seesound.subtitles.length - 1; i++) {
                seesound.subtitles[i].endTime = seesound.subtitles[i + 1].startTime;
            }
            seesound.subtitleSettings.subtitles = [...seesound.subtitles];
            renderSubtitleList();
            updateSubtitlePreview();
        }
    });

    document.getElementById('subtitleFont')?.addEventListener('change', (e) => {
        seesound.subtitleSettings.fontFamily = e.target.value;
        loadSubtitleFont(seesound.subtitleSettings.fontFamily).then(() => {
            initSubtitlePreview();
        });
    });

    document.getElementById('subtitleFontSize')?.addEventListener('input', (e) => {
        seesound.subtitleSettings.fontSize = parseInt(e.target.value);
        document.getElementById('subtitleFontSizeValue').textContent = e.target.value;
        initSubtitlePreview();
    });

    document.getElementById('subtitleEffect')?.addEventListener('change', (e) => {
        seesound.subtitleSettings.effect = e.target.value;
        initSubtitlePreview();
    });

    document.getElementById('subtitleStrokeWidth')?.addEventListener('input', (e) => {
        seesound.subtitleSettings.strokeWidth = parseInt(e.target.value);
        document.getElementById('subtitleStrokeWidthValue').textContent = e.target.value;
    });

    document.querySelectorAll('.color-option[data-subcolor]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-subcolor]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.subtitleSettings.color = opt.dataset.subcolor;
        });
    });

    document.querySelectorAll('.color-option[data-stroke]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-stroke]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.subtitleSettings.strokeColor = opt.dataset.stroke;
        });
    });

    document.getElementById('srtUpload')?.addEventListener('click', () => {
        document.getElementById('srtFile').click();
    });

    document.getElementById('srtFile')?.addEventListener('change', handleSrtFileSelect);
}

// 层事件绑定
function bindLayerEvents() {
    document.getElementById('effectLayerVisible')?.addEventListener('change', (e) => {
        seesound.effectLayerSettings.visible = e.target.checked;
        updateLayerVisibility();
    });
    
    document.getElementById('subtitleLayerVisible')?.addEventListener('change', (e) => {
        seesound.subtitleLayerSettings.visible = e.target.checked;
        updateLayerVisibility();
    });
    
    document.getElementById('textLayerVisible')?.addEventListener('change', (e) => {
        seesound.textLayerSettings.visible = e.target.checked;
        updateLayerVisibility();
    });
    
    document.getElementById('textLayerContent')?.addEventListener('input', (e) => {
        seesound.textLayerSettings.text = e.target.value;
    });
    
    document.getElementById('textLayerFontSize')?.addEventListener('input', (e) => {
        seesound.textLayerSettings.fontSize = parseInt(e.target.value);
        document.getElementById('textLayerFontSizeValue').textContent = e.target.value;
    });
    
    document.getElementById('textLayerStrokeWidth')?.addEventListener('input', (e) => {
        seesound.textLayerSettings.strokeWidth = parseInt(e.target.value);
        document.getElementById('textLayerStrokeWidthValue').textContent = e.target.value;
    });
    
    document.getElementById('textLayerAlign')?.addEventListener('change', (e) => {
        seesound.textLayerSettings.align = e.target.value;
    });
    
    document.querySelectorAll('.color-option[data-textcolor]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-textcolor]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.textLayerSettings.color = opt.dataset.textcolor;
        });
    });
    
    document.querySelectorAll('.color-option[data-textstroke]').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option[data-textstroke]').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.textLayerSettings.strokeColor = opt.dataset.textstroke;
        });
    });
    
    bindLayerDragEvents();
}

function bindLayerDragEvents() {
    const layers = document.querySelectorAll('.layer-container');
    
    layers.forEach(layer => {
        layer.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle')) return;
            
            e.preventDefault();
            seesound.currentDraggingLayer = layer;
            
            const rect = layer.getBoundingClientRect();
            const containerRect = document.getElementById('previewContainer').getBoundingClientRect();
            
            seesound.dragStartPos = { x: e.clientX, y: e.clientY };
            seesound.dragOffset = { 
                x: e.clientX - rect.left, 
                y: e.clientY - rect.top 
            };
            
            layers.forEach(l => l.classList.remove('selected'));
            layer.classList.add('selected');
        });
        
        const resizeHandle = layer.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                seesound.currentResizingLayer = layer;
                
                const rect = layer.getBoundingClientRect();
                seesound.resizeStartSize = { width: rect.width, height: rect.height };
                seesound.dragStartPos = { x: e.clientX, y: e.clientY };
            });
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (seesound.currentDraggingLayer) {
            e.preventDefault();
            const containerRect = document.getElementById('previewContainer').getBoundingClientRect();
            
            const newX = e.clientX - containerRect.left - seesound.dragOffset.x;
            const newY = e.clientY - containerRect.top - seesound.dragOffset.y;
            
            const maxX = containerRect.width - seesound.currentDraggingLayer.offsetWidth;
            const maxY = containerRect.height - seesound.currentDraggingLayer.offsetHeight;
            
            const boundedX = Math.max(0, Math.min(newX, maxX));
            const boundedY = Math.max(0, Math.min(newY, maxY));
            
            seesound.currentDraggingLayer.style.left = `${boundedX}px`;
            seesound.currentDraggingLayer.style.top = `${boundedY}px`;
            
            const layerType = seesound.currentDraggingLayer.dataset.layer;
            if (layerType === 'effect') {
                seesound.effectLayerSettings.x = (boundedX / containerRect.width) * 100;
                seesound.effectLayerSettings.y = (boundedY / containerRect.height) * 100;
            } else if (layerType === 'subtitle') {
                seesound.subtitleLayerSettings.x = (boundedX / containerRect.width) * 100;
                seesound.subtitleLayerSettings.y = (boundedY / containerRect.height) * 100;
            } else if (layerType === 'text') {
                seesound.textLayerSettings.x = (boundedX / containerRect.width) * 100;
                seesound.textLayerSettings.y = (boundedY / containerRect.height) * 100;
            }
        } else if (seesound.currentResizingLayer) {
            e.preventDefault();
            
            const deltaX = e.clientX - seesound.dragStartPos.x;
            const deltaY = e.clientY - seesound.dragStartPos.y;
            
            const newWidth = Math.max(100, seesound.resizeStartSize.width + deltaX);
            const newHeight = Math.max(100, seesound.resizeStartSize.height + deltaY);
            
            const containerRect = document.getElementById('previewContainer').getBoundingClientRect();
            const maxWidth = containerRect.width - seesound.currentResizingLayer.offsetLeft;
            const maxHeight = containerRect.height - seesound.currentResizingLayer.offsetTop;
            
            const boundedWidth = Math.min(newWidth, maxWidth);
            const boundedHeight = Math.min(newHeight, maxHeight);
            
            seesound.currentResizingLayer.style.width = `${boundedWidth}px`;
            seesound.currentResizingLayer.style.height = `${boundedHeight}px`;
            
            const layerType = seesound.currentResizingLayer.dataset.layer;
            if (layerType === 'effect') {
                seesound.effectLayerSettings.width = (boundedWidth / containerRect.width) * 100;
                seesound.effectLayerSettings.height = (boundedHeight / containerRect.height) * 100;
            } else if (layerType === 'subtitle') {
                seesound.subtitleLayerSettings.width = (boundedWidth / containerRect.width) * 100;
                seesound.subtitleLayerSettings.height = (boundedHeight / containerRect.height) * 100;
            } else if (layerType === 'text') {
                seesound.textLayerSettings.width = (boundedWidth / containerRect.width) * 100;
                seesound.textLayerSettings.height = (boundedHeight / containerRect.height) * 100;
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (seesound.currentDraggingLayer) {
            seesound.currentDraggingLayer = null;
        }
        if (seesound.currentResizingLayer) {
            seesound.currentResizingLayer.classList.remove('resizing');
            seesound.currentResizingLayer = null;
        }
    });
}

// 绑定事件
function bindEvents() {
    document.getElementById('fileUpload').addEventListener('click', () => {
        document.getElementById('mediaFile').click();
    });
    document.getElementById('mediaFile').addEventListener('change', handleFileSelect);

    document.getElementById('bgUpload').addEventListener('click', () => {
        document.getElementById('bgImageFile').click();
    });
    document.getElementById('bgImageFile').addEventListener('change', handleBgImageSelect);
    document.getElementById('removeBgBtn').addEventListener('click', removeBgImage);

    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('progressBar').addEventListener('click', seekVideo);
    document.getElementById('exportBtn').addEventListener('click', exportVideo);

    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('loadConfigBtn').addEventListener('click', () => {
        document.getElementById('configFile').click();
    });
    document.getElementById('configFile').addEventListener('change', loadConfigFile);

    document.getElementById('effectType').addEventListener('change', (e) => {
        seesound.effectSettings.type = e.target.value;
        updateSettingsVisibility();
        initParticles();
    });

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            seesound.effectSettings.colors = opt.dataset.colors;
        });
    });

    bindSlider('sensitivity', 'sensitivityValue', 'sensitivity');
    bindSlider('opacity', 'opacityValue', 'opacity');

    bindSlider('barCount', 'barCountValue', 'barCount', true);
    bindSlider('barWidth', 'barWidthValue', 'barWidth', true);
    bindSlider('barGap', 'barGapValue', 'barGap');
    bindSlider('barRadius', 'barRadiusValue', 'barRadius', true);
    document.getElementById('barDirection').addEventListener('change', (e) => seesound.effectSettings.barDirection = e.target.value);
    document.getElementById('gradientDirection').addEventListener('change', (e) => seesound.effectSettings.gradientDirection = e.target.value);
    document.getElementById('mirrorEffect').addEventListener('change', (e) => seesound.effectSettings.mirrorEffect = e.target.checked);
    document.getElementById('barBrick').addEventListener('change', (e) => {
        seesound.effectSettings.barBrick = e.target.checked;
        seesound.brickPositions = [];
    });

    document.getElementById('waveOrigin').addEventListener('change', (e) => seesound.effectSettings.waveOrigin = e.target.value);
    bindSlider('amplitude', 'amplitudeValue', 'amplitude');
    bindSlider('frequency', 'frequencyValue', 'frequency');
    bindSlider('lineWidth', 'lineWidthValue', 'lineWidth');
    bindSlider('waveLines', 'waveLinesValue', 'waveLines', true);
    document.getElementById('glowEffect').addEventListener('change', (e) => seesound.effectSettings.glowEffect = e.target.checked);

    document.getElementById('transformType').addEventListener('change', (e) => seesound.effectSettings.transformType = e.target.value);
    bindSlider('transformIntensity', 'transformIntensityValue', 'transformIntensity', true);
    bindSlider('transformSpeed', 'transformSpeedValue', 'transformSpeed');

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            seesound.effectSettings.position = btn.dataset.position;
            applyPositionPreset(seesound.effectSettings.position);
        });
    });
}