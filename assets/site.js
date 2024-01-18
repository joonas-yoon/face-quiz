let mainCanvas;
let context;
let currentImg;
let faces;

window.onload = async () => {
  console.log('window onload');
  const inputContainer = document.getElementById('inputContainer');
  const spinner = document.getElementById('spinner');
  const fileElement = document.getElementById('upload_file');
  let isModelLoaded = false;
  addSpinner(spinner);
  {
    await loadModel();
    console.log('model loaded');
    spinner.style.display = 'none';
    isModelLoaded = true;
  }
  fileElement.addEventListener('change', async (evt) => {
    if (!isModelLoaded) {
      window.alert('Model not loaded yet');
      return;
    }

    const imgFile = evt.target.files[0];
    currentImg = await faceapi.bufferToImage(imgFile);

    const options = getFaceDetectorOptions();
    faces = await faceapi.detectAllFaces(currentImg, options);

    redraw();
  });
  inputContainer.addEventListener('click', (evt) => {
    evt.preventDefault();
    fileElement.click();
  });
};

function drawCircle(ctx, x, y, color) {
  ctx.beginPath();
  ctx.fillStyle = color;
  const rad = 8;
  ctx.arc(x + rad / 2, y + rad / 2, rad, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.fill();
}

function drawPoints(ctx, points, color) {
  console.log(points);
  for (const {x, y} of points) {
    drawCircle(ctx, x, y, color);
  }
}

async function redraw() {
  mainCanvas = faceapi.createCanvasFromMedia(currentImg);
  mainCanvas.className = 'uploaded';
  context = mainCanvas.getContext('2d');
  const container = document.getElementById('faceContainer');
  console.log(mainCanvas);
  container.innerHTML = '';
  container.appendChild(mainCanvas);
  const outputContainer = document.getElementById('outputContainer');
  outputContainer.innerHTML = '';

  const tempCanvas = document.createElement('canvas');
  // document.body.appendChild(tempCanvas);

  for (const face of faces) {
    const cw = mainCanvas.width,
      ch = mainCanvas.height;
    const {x, y, width, height} = face.relativeBox;
    const [left, top, oWidth, oHeight] = [
      x * cw,
      y * ch,
      width * cw,
      height * ch,
    ];
    console.log(x, y, width, height);
    // draw box
    const oldWidth = context.lineWidth;
    context.beginPath();
    context.rect(left, top, oWidth, oHeight);
    context.strokeStyle = '#0000ff';
    context.lineWidth = 2;
    context.stroke();
    context.closePath();
    context.lineWidth = oldWidth;

    // clip image by box
    const clippedImage = clipImage(
      currentImg,
      tempCanvas,
      left,
      top,
      oWidth,
      oHeight
    );

    // detect landmarks
    const landmarks = await faceapi.detectFaceLandmarks(clippedImage);

    // draw
    // drawLandmarks(tempCanvas, landmarks);
    const outCanvas = createPuzzle(tempCanvas, landmarks);
    outCanvas.className = 'output';
    outputContainer.appendChild(outCanvas);
  }
}

function clipImage(image, outCanvas, x, y, width, height) {
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  const img = new Image();
  img.src = outCanvas.toDataURL();
  return img;
}

function clipAndCopyImage(inputCanvas, outputCanvas, points, dx, dy, dw, dh) {
  const boundingBox = getBoundingBox(points);
  console.log('bb', boundingBox);
  const ctx = outputCanvas.getContext('2d');
  const image = new Image();
  image.src = inputCanvas.toDataURL();
  const padding = 5;
  const bound = keepAspectBound(
    boundingBox.left - padding,
    boundingBox.top - padding,
    boundingBox.width + 2 * padding,
    boundingBox.height + 2 * padding,
    dw,
    dh
  );
  image.onload = function () {
    ctx.drawImage(
      image,
      bound.x,
      bound.y,
      bound.width,
      bound.height,
      dx,
      dy,
      dw,
      dh
    );
  };
}

function canvasToImage(canvas) {
  const image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

function createPuzzle(inputCanvas, landmarks) {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = 1920;
  outputCanvas.height = 1280;
  // left eye
  clipAndCopyImage(
    inputCanvas,
    outputCanvas,
    [
      // ...landmarks.positions.slice(17, 22), // eyebrow
      ...landmarks.positions.slice(36, 42),
    ],
    0,
    0,
    640,
    640
  );
  // right eye
  clipAndCopyImage(
    inputCanvas,
    outputCanvas,
    [
      // ...landmarks.positions.slice(22, 27), // eyebrow
      ...landmarks.positions.slice(42, 48),
    ],
    1280,
    0,
    640,
    640
  );
  // nose
  clipAndCopyImage(
    inputCanvas,
    outputCanvas,
    landmarks.positions.slice(29, 36),
    640,
    0,
    640,
    640
  );
  // mouth
  clipAndCopyImage(
    inputCanvas,
    outputCanvas,
    landmarks.positions.slice(48, 68),
    0,
    640,
    1920,
    800
  );
  return outputCanvas;
}

function drawLandmarks(canvas, landmarks) {
  const context = canvas.getContext('2d');
  drawPoints(context, [...landmarks.positions.slice(17, 22)], '#0000ff88');
  drawPoints(context, [...landmarks.positions.slice(22, 27)], '#00ff0088');
  drawPoints(context, [...landmarks.positions.slice(36, 42)], '#ff000088');
  drawPoints(context, [...landmarks.positions.slice(42, 48)], '#00ffff88');
  drawPoints(context, [...landmarks.positions.slice(29, 36)], '#ff00ff88');
  drawPoints(context, [...landmarks.positions.slice(48, 68)], '#ffff0088');
}

function keepAspectBound(sx, sy, sw, sh, dw, dh) {
  const ratio = dh / dw;
  return {
    x: sx,
    y: sy,
    width: sw,
    height: sw * ratio,
  };
}

function getBoundingBox(points) {
  let top = Infinity,
    left = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for ({_x, _y} of points) {
    top = Math.min(top, _y);
    bottom = Math.max(bottom, _y);
    left = Math.min(left, _x);
    right = Math.max(right, _x);
  }
  return {
    top,
    left,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

async function loadModel() {
  const url =
    'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/';
  await faceapi.loadFaceLandmarkModel(url);
  await faceapi.loadSsdMobilenetv1Model(url);
}

const SSD_MOBILENETV1 = 'ssd_mobilenetv1';
const TINY_FACE_DETECTOR = 'tiny_face_detector';

let selectedFaceDetector = SSD_MOBILENETV1;

// ssd_mobilenetv1 options
let minConfidence = 0.5;

// tiny_face_detector options
let inputSize = 512;
let scoreThreshold = 0.5;

function getFaceDetectorOptions() {
  return selectedFaceDetector === SSD_MOBILENETV1
    ? new faceapi.SsdMobilenetv1Options({minConfidence})
    : new faceapi.TinyFaceDetectorOptions({inputSize, scoreThreshold});
}
