let originalImage = null;
let referenceColors = [
    [139, 92, 246], // بنفش پیش‌فرض
    [6, 182, 212]   // آبی پیش‌فرض
];

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const thresholdInput = document.getElementById('threshold');
const downloadWebpBtn = document.getElementById('downloadWebpBtn');
const previewCanvas = document.getElementById('previewCanvas');
const colorPicker = document.getElementById('colorPicker');
const addColorBtn = document.getElementById('addColorBtn');
const paletteContainer = document.getElementById('paletteContainer');

// رندر اولیه پالت مرجع
renderPalette();

// مدیریت آپلود
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
            dropZone.querySelector('span').innerHTML = `✅ فایل آماده: ${file.name}`;
            processImage();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// افزودن رنگ دستی
addColorBtn.addEventListener('click', () => {
    const hex = colorPicker.value;
    const r = parseInt(hex.substr(1,2), 16);
    const g = parseInt(hex.substr(3,2), 16);
    const b = parseInt(hex.substr(5,2), 16);
    referenceColors.push([r, g, b]);
    renderPalette();
    if (originalImage) processImage();
});

// کلیک رو بوم برای برداشتن رنگ از تصویر
previewCanvas.addEventListener('click', (e) => {
    if (!originalImage) return;
    const rect = previewCanvas.getBoundingClientRect();
    const scaleX = previewCanvas.width / rect.width;
    const scaleY = previewCanvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = previewCanvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] > 125) { // اگر شفاف نبود
        referenceColors.push([pixel[0], pixel[1], pixel[2]]);
        renderPalette();
        processImage();
    }
});

function renderPalette() {
    paletteContainer.innerHTML = '';
    referenceColors.forEach((rgb, index) => {
        const hex = "#" + rgb.map(x => x.toString(16).padStart(2, '0')).join('');
        const chip = document.createElement('div');
        chip.className = 'color-chip';
        chip.innerHTML = `
            <div class="color-dot" style="background:${hex}"></div>
            <span>${hex.toUpperCase()}</span>
            <button class="delete-chip" onclick="removeColor(${index})">×</button>
        `;
        paletteContainer.appendChild(chip);
    });
}

window.removeColor = function(index) {
    if (referenceColors.length <= 1) {
        alert("حداقل یک رنگ مرجع باید وجود داشته باشد!");
        return;
    }
    referenceColors.splice(index, 1);
    renderPalette();
    if (originalImage) processImage();
}

thresholdInput.addEventListener('input', () => {
    document.getElementById('thresholdVal').textContent = thresholdInput.value;
    if (originalImage) processImage();
});

// هسته اصلی مپ کردن رنگ‌ها به رنگ‌های مرجع انتخابی
function processImage() {
    if (!originalImage) return;

    const threshold = parseInt(thresholdInput.value);
    const width = originalImage.width;
    const height = originalImage.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 0, 0);
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    const newPixels = new Uint8ClampedArray(pixels.length);

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];

        if (a < 125) {
            newPixels[i+3] = 0; // شفاف
        } else {
            let closestRef = referenceColors[0];
            let minDist = Infinity;

            for (const ref of referenceColors) {
                const dist = Math.sqrt((r - ref[0])**2 + (g - ref[1])**2 + (b - ref[2])**2);
                if (dist < minDist) {
                    minDist = dist;
                    closestRef = ref;
                }
            }

            // اگر فاصله کمتر از آستانه بود، تبدیلش کن به رنگ مرجع، وگرنه بذار رنگ خودش بمونه
            if (minDist <= threshold) {
                newPixels[i] = closestRef[0];
                newPixels[i+1] = closestRef[1];
                newPixels[i+2] = closestRef[2];
            } else {
                newPixels[i] = r;
                newPixels[i+1] = g;
                newPixels[i+2] = b;
            }
            newPixels[i+3] = 255;
        }
    }

    // نمایش روی بوم
    previewCanvas.width = width;
    previewCanvas.height = height;
    const pCtx = previewCanvas.getContext('2d');
    const newImgData = new ImageData(newPixels, width, height);
    pCtx.putImageData(newImgData, 0, 0);

    downloadWebpBtn.disabled = false;
}

// دانلود WebP
downloadWebpBtn.addEventListener('click', () => {
    previewCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cleaned_icon.webp';
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/webp', 1.0);
});
