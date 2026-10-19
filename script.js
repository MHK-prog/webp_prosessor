let originalImage = null;
let processedData = null;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const downloadWebpBtn = document.getElementById('downloadWebpBtn');
const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');

// آپدیت متن اسلایدرها
['maxColors', 'threshold', 'alphaValInput', 'cellSize'].forEach(id => {
    const input = document.getElementById(id);
    const span = document.getElementById(id + 'Val') || document.getElementById('alphaVal');
    input.addEventListener('input', () => span.textContent = input.value);
});

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#38bdf8'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#475569'; });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) loadImage(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) loadImage(e.target.files[0]);
});

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            originalImage = img;
            processBtn.disabled = false;
            dropZone.querySelector('span').innerHTML = `✅ فایل آماده: ${file.name}`;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

processBtn.addEventListener('click', () => {
    if (!originalImage) return;

    const maxColors = parseInt(document.getElementById('maxColors').value);
    const threshold = parseInt(document.getElementById('threshold').value);
    const alphaCutoff = parseInt(document.getElementById('alphaValInput').value);
    const cellSize = parseInt(document.getElementById('cellSize').value);

    // ۱. خواندن پیکسل‌ها از طریق Canvas
    const canvas = document.createElement('canvas');
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    // ۲. استخراج رنگ‌های مات و شمارش فرکانس
    const colorCounts = {};
    const width = canvas.width;
    const height = canvas.height;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
        if (a >= alphaCutoff) {
            const key = `${r},${g},${b}`;
            colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
    }

    // مرتب‌سازی بر اساس تکرار
    const sortedColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(item => item[0].split(',').map(Number));

    // ۳. پالت پویا با اعمال threshold و maxColors
    const palette = [];
    for (const color of sortedColors) {
        if (palette.length >= maxColors) break;
        if (palette.length === 0) {
            palette.push(color);
        } else {
            let minDist = Infinity;
            for (const p of palette) {
                const dist = Math.sqrt((color[0]-p[0])**2 + (color[1]-p[1])**2 + (color[2]-p[2])**2);
                if (dist < minDist) minDist = dist;
            }
            if (minDist > threshold) {
                palette.push(color);
            }
        }
    }

    // ۴. نگاشت پیکسل‌ها به نزدیک‌ترین رنگ پالت
    const newPixels = new Uint8ClampedArray(pixels.length);
    const finalRgbaMatrix = [];

    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2], a = pixels[idx+3];

            if (a < alphaCutoff) {
                newPixels[idx] = 0; newPixels[idx+1] = 0; newPixels[idx+2] = 0; newPixels[idx+3] = 0;
                row.push([0, 0, 0, 0]);
            } else {
                let closestColor = palette[0];
                let minSubDist = Infinity;
                for (const p of palette) {
                    const dist = Math.sqrt((r-p[0])**2 + (g-p[1])**2 + (b-p[2])**2);
                    if (dist < minSubDist) {
                        minSubDist = dist;
                        closestColor = p;
                    }
                }
                newPixels[idx] = closestColor[0];
                newPixels[idx+1] = closestColor[1];
                newPixels[idx+2] = closestColor[2];
                newPixels[idx+3] = 255;
                row.push([closestColor[0], closestColor[1], closestColor[2], 255]);
            }
        }
        finalRgbaMatrix.push(row);
    }

    processedData = { width, height, newPixels, palette, finalRgbaMatrix, cellSize };

    // ۵. نمایش خروجی‌ها در صفحه
    renderOutput();
});

function renderOutput() {
    const { width, height, newPixels, palette, finalRgbaMatrix, cellSize } = processedData;

    // رندر روی Canvas پیش‌نمایش
    const previewCanvas = document.getElementById('previewCanvas');
    previewCanvas.width = width;
    previewCanvas.height = height;
    const pCtx = previewCanvas.getContext('2d');
    const newImgData = new ImageData(newPixels, width, height);
    pCtx.putImageData(newImgData, 0, 0);

    // رندر جدول HTML
    const container = document.getElementById('htmlTableContainer');
    let tableHtml = '<table>';
    for (let y = 0; y < height; y++) {
        tableHtml += '<tr>';
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = finalRgbaMatrix[y][x];
            if (a === 0) {
                tableHtml += `<td class="checkerboard" style="width:${cellSize}px;height:${cellSize}px;"></td>`;
            } else {
                tableHtml += `<td style="background:rgb(${r},${g},${b});width:${cellSize}px;height:${cellSize}px;"></td>`;
            }
        }
        tableHtml += '</tr>';
    }
    tableHtml += '</table>';
    container.innerHTML = tableHtml;

    // اطلاعات بار
    document.getElementById('infoBar').textContent = `ابعاد: ${width}×${height} | تعداد رنگ پالت نهایی: ${palette.length}`;
    
    // فعال‌سازی دکمه‌های دانلود
    document.getElementById('outputCard').style.display = 'block';
    downloadWebpBtn.disabled = false;
    downloadHtmlBtn.disabled = false;
}

// دانلود WebP
downloadWebpBtn.addEventListener('click', () => {
    if (!processedData) return;
    const canvas = document.createElement('canvas');
    canvas.width = processedData.width;
    canvas.height = processedData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(processedData.newPixels, processedData.width, processedData.height), 0, 0);

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'optimized_icon.webp';
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/webp', 1.0);
});

// دانلود HTML کامل
downloadHtmlBtn.addEventListener('click', () => {
    if (!processedData) return;
    const { width, height, palette, finalRgbaMatrix, cellSize } = processedData;

    let htmlContent = `<!doctype html>
<html dir="rtl" lang="fa">
<head>
    <meta charset="utf-8">
    <title>Icon Matrix Output</title>
    <style>
        body { font-family: monospace; background: #f6f6f6; padding: 16px; text-align: center; }
        .info { margin-bottom: 12px; font-weight: bold; color: #333; }
        table { border-collapse: collapse; margin: 0 auto; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        td { padding: 0; border: 1px solid rgba(0,0,0,0.03); }
        .t { background: linear-gradient(45deg,#ccc 25%,transparent 25%), linear-gradient(-45deg,#ccc 25%,transparent 25%), linear-gradient(45deg,transparent 75%,#ccc 75%), linear-gradient(-45deg,transparent 75%,#ccc 75%); background-size: ${cellSize}px ${cellSize}px; }
    </style>
</head>
<body>
    <div class="info">ابعاد: ${width}×${height} | تعداد رنگ پالت: ${palette.length}</div>
    <table>`;

    for (let y = 0; y < height; y++) {
        htmlContent += '<tr>';
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = finalRgbaMatrix[y][x];
            if (a === 0) {
                htmlContent += `<td class="t" style="width:${cellSize}px;height:${cellSize}px;"></td>`;
            } else {
                htmlContent += `<td style="background:rgb(${r},${g},${b});width:${cellSize}px;height:${cellSize}px;"></td>`;
            }
        }
        htmlContent += '</tr>';
    }

    htmlContent += `</table></body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output_icon.html';
    a.click();
    URL.revokeObjectURL(url);
});
