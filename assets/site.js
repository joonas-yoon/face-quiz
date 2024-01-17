let mainCanvas;
let context;
let currentImg;

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
  fileElement.addEventListener('change', (evt) => {
    if (!isModelLoaded) {
      window.alert('Model not loaded yet');
      return;
    }
    openImage(evt, async (dataURL) => {
      currentImg = await faceapi.fetchImage(dataURL);
      landmarks = await faceapi.detectFaceLandmarks(currentImg);
      redraw();
    });
  });
  inputContainer.addEventListener('click', (evt) => {
    evt.preventDefault();
    fileElement.click();
  });
};

function redraw() {
  mainCanvas = faceapi.createCanvasFromMedia(currentImg);
  mainCanvas.className = 'uploaded';
  context = mainCanvas.getContext('2d');
  const container = document.getElementById('faceContainer');
  console.log(mainCanvas);
  container.innerHTML = '';
  container.appendChild(mainCanvas);
  // left eye
  clipAndCopyImage(
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
  clipAndCopyImage(landmarks.positions.slice(29, 36), 640, 0, 640, 640);
  // mouth
  clipAndCopyImage(landmarks.positions.slice(48, 68), 0, 640, 1920, 800);
}

function clipAndCopyImage(points, dx, dy, dw, dh) {
  const outputCanvas = document.getElementById('quiz');
  const boundingBox = getBoundingBox(points);
  console.log('bb', boundingBox);
  const ctx = outputCanvas.getContext('2d');
  const image = new Image();
  image.src = mainCanvas.toDataURL();
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
  await faceapi.loadFaceLandmarkModel(
    'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights/'
  );
}

function openImage(file, callback) {
  const input = file.target;
  const reader = new FileReader();
  reader.onload = function () {
    const dataURL = reader.result;
    callback(dataURL);
  };
  reader.readAsDataURL(input.files[0]);
}
