let mainCanvas;
let context;
let currentImg;

window.onload = async () => {
  console.log("window onload");
  const btnUpload = document.getElementById("btnUpload");
  const btnView = document.getElementById("btnView");
  const spinner = document.getElementById("spinner");
  const fileElement = document.getElementById("upload_file");

  let isModelLoaded = false;
  addSpinner(spinner);
  setLoading(true);
  {
    await loadModel();
    console.log("model loaded");
    setLoading(false);
  }

  fileElement.addEventListener("change", async (evt) => {
    const imgFile = evt.target.files[0];
    currentImg = await faceapi.bufferToImage(imgFile);

    const options = getFaceDetectorOptions();
    const faces = await faceapi.detectAllFaces(currentImg, options);

    redraw(faces);
    setLoading(false);
  });

  btnUpload.addEventListener("click", (evt) => {
    setLoading(true);
    fileElement.click();
  });

  btnView.addEventListener("click", (evt) => {
    const body = document.body;
    const attr = "data-hide";
    if (body.hasAttribute(attr)) {
      body.removeAttribute(attr);
    } else {
      body.setAttribute(attr, true);
    }
  });

  function setLoading(enable) {
    if (enable) {
      isModelLoaded = false;
      btnUpload.setAttribute("data-loading", true);
    } else {
      isModelLoaded = true;
      btnUpload.removeAttribute("data-loading");
    }
  }
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
  for (const { x, y } of points) {
    drawCircle(ctx, x, y, color);
  }
}

async function redraw(faces) {
  const background = document.getElementById("background");

  mainCanvas = faceapi.createCanvasFromMedia(currentImg);
  renderToBackground();

  context = mainCanvas.getContext("2d");
  const container = document.getElementById("faceContainer");
  console.log(mainCanvas);
  container.innerHTML = "";
  container.appendChild(mainCanvas);
  const outputContainer = document.getElementById("outputContainer");
  outputContainer.innerHTML = "";
  console.log("faces", faces);
  outputContainer.setAttribute("faces", (faces || []).length);

  const tempCanvas = document.createElement("canvas");
  // document.body.appendChild(tempCanvas);

  for (const face of faces) {
    const cw = mainCanvas.width,
      ch = mainCanvas.height;
    const { x, y, width, height } = face.relativeBox;
    const [left, top, oWidth, oHeight] = [
      x * cw,
      y * ch,
      width * cw,
      height * ch,
    ];
    console.log(x, y, width, height);
    // draw box
    const oldWidth = context.lineWidth;
    const lineWidth = recalculateLineWidth(mainCanvas);
    /*
    context.beginPath();
    context.rect(left, top, oWidth, oHeight);
    context.strokeStyle = '#0000ff';
    context.lineWidth = lineWidth;
    context.stroke();
    context.closePath();
    context.lineWidth = oldWidth;
    */

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

    // const faceline = [...landmarks.positions.slice(0, 16)];
    // const tiltRadian = getTiltRoation(faceline[0], faceline[15]);
    const leftEyeMost = landmarks.positions[36];
    const rightEyeMost = landmarks.positions[45];
    const tiltRadian = getTiltRoation(leftEyeMost, rightEyeMost);

    // draw rotation corrected box
    context.save();
    context.beginPath();
    context.translate(left + oWidth / 2, top + oHeight / 2);
    context.rotate(tiltRadian);
    context.translate(-(oWidth / 2), -(oHeight / 2));
    context.rect(0, 0, oWidth, oHeight);
    context.strokeStyle = "#ff0000";
    context.lineWidth = lineWidth;
    context.stroke();
    context.closePath();
    context.lineWidth = oldWidth;
    context.restore();

    // rotate image on temp canvas
    const tctx = tempCanvas.getContext("2d");
    // drawPoints(tctx, [...landmarks.positions.slice(0, 16)], "#f0f000aa");
    // drawPoints(tctx, [landmarks.positions[16]], "#f03000aa");
    const [tw, th] = [tempCanvas.width, tempCanvas.height];
    tctx.clearRect(0, 0, tw, th);
    tctx.save();
    tctx.translate(tw / 2, th / 2);
    tctx.rotate(-tiltRadian);
    tctx.translate(-tw / 2, -th / 2);
    const pad = Math.ceil(Math.max(tw, th) * 0.2);
    const [sx, sy, sw, sh] = [
      left - pad,
      top - pad,
      oWidth + 2 * pad,
      oHeight + 2 * pad,
    ];

    const [dx, dy, dw, dh] = [-pad, -pad, tw + 2 * pad, th + 2 * pad];
    tctx.drawImage(currentImg, sx, sy, sw, sh, dx, dy, dw, dh);
    tctx.restore();

    // find landmark again from rotated and clipped picture
    const rotatedImage = new Image();
    rotatedImage.src = tempCanvas.toDataURL();
    const finalLandmarks = await faceapi.detectFaceLandmarks(rotatedImage);

    // draw
    // drawLandmarks(tempCanvas, finalLandmarks);
    const outCanvas = createPuzzle(tempCanvas, finalLandmarks);
    outCanvas.className = "output";
    outputContainer.appendChild(outCanvas);

    delete tempCanvas;
  }

  renderToBackground();

  function renderToBackground() {
    background.style.backgroundImage = `url(${mainCanvas.toDataURL()})`;
  }
}

function getTiltRoation(point1, point2) {
  let x1 = point1.x;
  let y1 = point1.y;
  let x2 = point2.x;
  let y2 = point2.y;
  let _m = (y2 - y1) / (x2 - x1);
  let rad = Math.atan(_m);
  return rad;
}

function clipImage(image, outCanvas, x, y, width, height) {
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext("2d");
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  const img = new Image();
  img.src = outCanvas.toDataURL();
  return img;
}

function clipAndCopyImage(inputCanvas, outputCanvas, points, dx, dy, dw, dh) {
  const boundingBox = getBoundingBox(points);
  console.log("bb", boundingBox);
  const ctx = outputCanvas.getContext("2d");
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

function recalculateLineWidth(canvas) {
  const { width, height } = canvas;
  const size = Math.min(width, height);
  return size / 100;
}

function canvasToImage(canvas) {
  const image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

function createPuzzle(inputCanvas, landmarks) {
  const outputCanvas = document.createElement("canvas");
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
  const context = canvas.getContext("2d");
  drawPoints(context, [...landmarks.positions.slice(17, 22)], "#0000ff88");
  drawPoints(context, [...landmarks.positions.slice(22, 27)], "#00ff0088");
  drawPoints(context, [...landmarks.positions.slice(36, 42)], "#ff000088");
  drawPoints(context, [...landmarks.positions.slice(42, 48)], "#00ffff88");
  drawPoints(context, [...landmarks.positions.slice(29, 36)], "#ff00ff88");
  drawPoints(context, [...landmarks.positions.slice(48, 68)], "#ffff0088");
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
  for ({ _x, _y } of points) {
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
    "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/";
  await faceapi.loadFaceLandmarkModel(url);
  await faceapi.loadSsdMobilenetv1Model(url);
}

const SSD_MOBILENETV1 = "ssd_mobilenetv1";
const TINY_FACE_DETECTOR = "tiny_face_detector";

let selectedFaceDetector = SSD_MOBILENETV1;

// ssd_mobilenetv1 options
let minConfidence = 0.5;

// tiny_face_detector options
let inputSize = 512;
let scoreThreshold = 0.5;

function getFaceDetectorOptions() {
  return selectedFaceDetector === SSD_MOBILENETV1
    ? new faceapi.SsdMobilenetv1Options({ minConfidence })
    : new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
}
