const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const pixelRatio = window.devicePixelRatio || 1;

const margin = 40;
const peakLimit = 0.2;
const maxStep = 40;

const fastTyping = 120;
const slowTyping = 600;
const roughest = 1.1;
const softest = 0.4;
const momentum = 0.6;

const smoothness = 2;
const sampleSpacing = 2;

const buildDelay = 5000;
const drawTime = 2000;
const fadeTime = 1000;

const lineCount = 14;
const lineDelay = 120;
const lineDraw = 800;
const warp = 1;

const stageTime = drawTime + lineCount * lineDelay + lineDraw;
const treeTime = 1500;
const minTreeSize = 12;
const maxTreeSize = 60;
const minBranchDepth = 3;
const maxBranchDepth = 5;
const skyTime = 1500;

const starCount = 70;
const starSeed = 7;

const dayColors = { background: "#fff", ink: "#222" };
const nightColors = { background: "#0c0e14", ink: "#d6dbe6" };

const ranges = [
  { shift: 2, lift: 160, scale: 0.5, alpha: 0.35, sink: 60 },
  { shift: 1, lift: 80, scale: 0.75, alpha: 0.6, sink: 40 },
  { shift: 0, lift: 0, scale: 1, alpha: 1, sink: 0 }
];

// State: values that change while the page runs
let keys = [];
let rhythm = [];
let lastKeyTime = null;
let timer = null;
let buildStart = null;
let colors = dayColors;

let screenWidth = 0;
let screenHeight = 0;
let topY = 0;
let startY = 0;
let groundY = 0;


// Startup: listen for keys and resizing, then paint the empty background
window.addEventListener("keydown", handleKeyPress);
window.addEventListener("resize", handleResize);

setUpScreen();
updateColors();
clearCanvas();

// Screen: size the canvas to the window, sharp on high-density screens
function setUpScreen() {
  screenWidth = innerWidth;
  screenHeight = innerHeight;

  canvas.width = screenWidth * pixelRatio;
  canvas.height = screenHeight * pixelRatio;
  canvas.style.width = screenWidth + "px";
  canvas.style.height = screenHeight + "px";
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  topY = screenHeight * peakLimit;
  startY = screenHeight - margin;
  groundY = screenHeight - margin;
}

function handleResize() {
  setUpScreen();
  redraw();
}

function redraw() {
  if (!hasBuildStarted()) {
    drawTypingScreen();
    return;
  }

  const buildTime = getBuildTime(performance.now());
  const buildFinished = buildTime >= getTotalBuildTime();

  if (buildFinished) {
    drawScene(0, buildTime);
  }
}

// Typing: store each key, measure the rhythm, restart the countdown to the build
function handleKeyPress(event) {
  if (hasBuildStarted()) {
    startOver();
  }

  const code = keyToCode(event.key);
  keys.push(code);

  const roughness = measureRoughness();
  rhythm.push(roughness);

  drawTypingScreen();
  restartBuildTimer();
}

function hasBuildStarted() {
  return buildStart !== null;
}

function startOver() {
  keys = [];
  rhythm = [];
  lastKeyTime = null;
  buildStart = null;
}

function keyToCode(key) {
  const charCode = key.charCodeAt(0);
  const randomCode = Math.floor(Math.random() * charCode);

  return randomCode;
}

function measureRoughness() {
  const now = performance.now();
  const isFirstKey = lastKeyTime === null;
  const pause = now - lastKeyTime;

  lastKeyTime = now;

  if (isFirstKey) {
    return 1;
  }

  return pauseToRoughness(pause);
}

function pauseToRoughness(pause) {
  const slowness = clamp01((pause - fastTyping) / (slowTyping - fastTyping));
  const difference = softest - roughest;

  return roughest + difference * slowness;
}

function restartBuildTimer() {
  clearTimeout(timer);
  timer = setTimeout(startBuild, buildDelay);
}

function startBuild() {
  buildStart = performance.now();
  requestAnimationFrame(animate);
}


// Animation: the frame loop and the build timeline
function animate(now) {
  if (!hasBuildStarted()) {
    return;
  }

  const buildTime = getBuildTime(now);
  const spikeOpacity = getSpikeOpacity(buildTime);

  drawScene(spikeOpacity, buildTime);

  if (buildTime < getTotalBuildTime()) {
    requestAnimationFrame(animate);
  }
}

function getBuildTime(now) {
  const elapsed = now - buildStart;

  return Math.max(0, elapsed);
}

function getSpikeOpacity(buildTime) {
  const fadeProgress = clamp01((buildTime - drawTime) / fadeTime);

  return 1 - fadeProgress;
}

function getTotalBuildTime() {
  const allRangesTime = ranges.length * stageTime;

  return allRangesTime + treeTime + skyTime;
}


// Scene: paint one full frame (background, sky, ranges, spikes)
function drawTypingScreen() {
  const fullOpacity = 1;
  const notBuilding = -1;

  drawScene(fullOpacity, notBuilding);
}

function drawScene(spikeOpacity, buildTime) {
  const spikePoints = buildPoints(keys, rhythm);

  updateColors();
  clearCanvas();

  if (spikePoints.length < 2) {
    return;
  }

  const isBuilding = buildTime >= 0;

  if (isBuilding) {
    drawSky(buildTime);
    drawAllRanges(buildTime);
  }

  drawSpikes(spikePoints, spikeOpacity);
}

function updateColors() {
  const hours = getHoursOfDay(new Date());
  const daytime = isDaytime(hours);

  colors = daytime ? dayColors : nightColors;
  ctx.strokeStyle = colors.ink;
}

function clearCanvas() {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, screenWidth, screenHeight);
}

function drawSpikes(points, opacity) {
  ctx.lineWidth = 1;
  ctx.globalAlpha = opacity;

  ctx.beginPath();
  for (const point of points) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();

  ctx.globalAlpha = 1;
}


// Sky: stars at night, based on the real clock
function drawSky(buildTime) {
  const opacity = getSkyProgress(buildTime);
  const hours = getHoursOfDay(new Date());
  const daytime = isDaytime(hours);

  if (opacity === 0 || daytime) {
    return;
  }

  ctx.globalAlpha = opacity;
  drawStars();
  ctx.globalAlpha = 1;
}

function getSkyProgress(buildTime) {
  const skyStart = ranges.length * stageTime + treeTime;

  return clamp01((buildTime - skyStart) / skyTime);
}

function getHoursOfDay(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return hours + minutes / 60;
}

function isDaytime(hours) {
  return hours >= 6 && hours < 18;
}

function drawStars() {
  const random = seeded(starSeed);
  const skyHeight = screenHeight * 0.6;

  ctx.fillStyle = colors.ink;

  for (let i = 0; i < starCount; i++) {
    const x = margin + random() * (screenWidth - margin * 2);
    const y = random() * skyHeight;
    const size = 0.5 + random() * 1.2;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}


// Mountain ranges: build and draw each layer, back to front
function drawAllRanges(buildTime) {
  const treeProgress = getTreeProgress(buildTime);

  for (let i = 0; i < ranges.length; i++) {
    const rangeTime = getRangeTime(i, buildTime);

    drawRange(ranges[i], i, rangeTime, treeProgress);
  }
}

function getRangeTime(index, buildTime) {
  const positionFromFront = ranges.length - 1 - index;
  const startTime = positionFromFront * stageTime;

  return buildTime - startTime;
}

function getTreeProgress(buildTime) {
  const treesStart = ranges.length * stageTime;

  return clamp01((buildTime - treesStart) / treeTime);
}

function drawRange(range, index, rangeTime, treeProgress) {
  if (rangeTime < 0) {
    return;
  }

  const rangeKeys = shiftKeys(range.shift);
  const ground = groundY - range.lift;
  const maxHeight = (groundY - topY) * range.scale;

  const top = buildRangeTop(rangeKeys, range, ground);
  const spacingCurve = buildSpacingCurve(rangeKeys);
  const treeSeed = getTreeSeed(index);

  hideRangesBehind(top, ground);

  ctx.globalAlpha = range.alpha;

  drawThinLines(top, spacingCurve, maxHeight, ground, rangeTime);
  drawTrees(top, ground, range.scale, treeSeed, treeProgress);
  drawTopLine(top, ground, rangeTime);

  ctx.globalAlpha = 1;
}

function shiftKeys(shift) {
  const shifted = [];

  for (const code of keys) {
    shifted.push(code + shift);
  }

  return shifted;
}

function buildRangeTop(rangeKeys, range, ground) {
  const points = buildPoints(rangeKeys, rhythm);
  const frontHeights = curve(points);
  const rangeHeights = [];

  for (const y of frontHeights) {
    rangeHeights.push(placeInRange(y, range, ground));
  }

  return rangeHeights;
}

function placeInRange(y, range, ground) {
  const heightAboveGround = groundY - y;
  const scaledHeight = heightAboveGround * range.scale;
  const sunkHeight = scaledHeight - range.sink;

  return ground - sunkHeight;
}

function buildSpacingCurve(rangeKeys) {
  const reversedKeys = [...rangeKeys].reverse();
  const reversedRhythm = [...rhythm].reverse();
  const points = buildPoints(reversedKeys, reversedRhythm);

  return curve(points);
}

function getTreeSeed(index) {
  let sum = 0;

  for (const code of keys) {
    sum = sum + code;
  }

  return sum + index * 1000;
}

function hideRangesBehind(top, ground) {
  const lastX = sampleToX(top.length - 1);

  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.background;

  ctx.beginPath();
  ctx.moveTo(margin, screenHeight);
  for (let j = 0; j < top.length; j++) {
    const y = Math.min(top[j], ground);
    ctx.lineTo(sampleToX(j), y);
  }
  ctx.lineTo(lastX, screenHeight);
  ctx.fill();
}

function drawTopLine(top, ground, rangeTime) {
  const progress = clamp01(rangeTime / drawTime);
  const stopAtGround = false;

  ctx.lineWidth = 2;
  drawLine(top, progress, ground, stopAtGround);
}


// Lines: the thin layered lines inside each mountain, and drawing any line of heights
function drawThinLines(top, spacingCurve, maxHeight, ground, rangeTime) {
  const stopAtGround = true;

  ctx.lineWidth = 1;

  for (let k = 1; k <= lineCount; k++) {
    const progress = getThinLineProgress(k, rangeTime);

    if (progress === 0) {
      continue;
    }

    const heights = buildThinLine(top, spacingCurve, maxHeight, k);
    drawLine(heights, progress, ground, stopAtGround);
  }
}

function getThinLineProgress(k, rangeTime) {
  const timeSinceStart = rangeTime - drawTime - k * lineDelay;

  return clamp01(timeSinceStart / lineDraw);
}

function buildThinLine(top, spacingCurve, maxHeight, k) {
  const span = screenHeight - margin - topY;
  const heights = [];

  for (let j = 0; j < top.length; j++) {
    const bend = getBend(spacingCurve[j], span);
    const share = Math.pow(k / lineCount, bend);
    const depth = maxHeight * share;

    heights.push(top[j] + depth);
  }

  return heights;
}

function getBend(spacingHeight, span) {
  const position = (spacingHeight - topY) / span * 2 - 1;

  return Math.pow(2, position * warp);
}

function drawLine(heights, progress, ground, stopAtGround) {
  const visibleCount = Math.floor(heights.length * progress);
  let previousWasUnderground = true;

  ctx.beginPath();

  for (let j = 0; j < visibleCount; j++) {
    const x = sampleToX(j);
    const isUnderground = heights[j] > ground;
    const y = isUnderground ? ground : heights[j];

    const isFirstPoint = j === 0;
    const staysUnderground = stopAtGround && isUnderground && previousWasUnderground;

    if (isFirstPoint || staysUnderground) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    previousWasUnderground = isUnderground;
  }

  ctx.stroke();
}


// Trees: place branching trees of different sizes on flat ground
function drawTrees(top, ground, scale, seed, progress) {
  const random = seeded(seed);
  const visibleCount = Math.floor(top.length * progress);

  let j = Math.floor(random() * 20);

  while (j < top.length) {
    const sizeRoll = random();
    const size = getTreeSize(sizeRoll) * scale;
    const depth = getBranchDepth(sizeRoll);
    const wantsTree = random() < 0.6;
    const shapeSeed = Math.floor(random() * 100000);

    const isFlat = isFlatAround(top, j, size, ground);
    const isVisible = j < visibleCount;

    if (wantsTree && isFlat && isVisible) {
      drawTree(sampleToX(j), ground, size, depth, shapeSeed);
    }

    const gap = 8 + Math.floor(random() * 30);
    j = j + gap;
  }
}

function isFlatAround(top, center, size, ground) {
  const halfWidth = Math.ceil(size * 0.15);

  for (let s = center - halfWidth; s <= center + halfWidth; s++) {
    const outsideLine = s < 0 || s >= top.length;

    if (outsideLine) {
      return false;
    }

    const aboveGround = top[s] < ground;

    if (aboveGround) {
      return false;
    }
  }

  return true;
}

function getTreeSize(roll) {
  const sizeRange = maxTreeSize - minTreeSize;
  const mostlySmall = roll * roll;

  return minTreeSize + sizeRange * mostlySmall;
}

function getBranchDepth(roll) {
  const depthRange = maxBranchDepth - minBranchDepth;

  return minBranchDepth + Math.round(depthRange * roll);
}

function drawTree(x, ground, size, depth, shapeSeed) {
  const random = seeded(shapeSeed);
  const straightUp = -Math.PI / 2;
  const trunkLength = size * 0.35;

  drawBranch(x, ground, straightUp, trunkLength, depth, random);
}

function drawBranch(x, y, angle, length, depth, random) {
  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  if (depth === 0) {
    return;
  }

  const spread = 0.35 + random() * 0.25;
  const shrink = 0.65 + random() * 0.1;
  const childLength = length * shrink;

  drawBranch(endX, endY, angle - spread, childLength, depth - 1, random);
  drawBranch(endX, endY, angle + spread, childLength, depth - 1, random);
}

function seeded(seed) {
  let current = seed;

  return function nextRandom() {
    current = (current * 9301 + 49297) % 233280;

    return current / 233280;
  };
}


// Curve: turn the jagged points into a smooth list of heights
function curve(points) {
  const softPoints = smooth(points, smoothness);
  const turningPoints = getTurningPoints(softPoints);

  return sampleCurve(turningPoints);
}

function smooth(points, radius) {
  const smoothed = [];

  for (let i = 0; i < points.length; i++) {
    const averageY = averageHeightAround(points, i, radius);

    smoothed.push({ x: points[i].x, y: averageY });
  }

  return smoothed;
}

function averageHeightAround(points, center, radius) {
  let sum = 0;
  let count = 0;

  for (let j = center - radius; j <= center + radius; j++) {
    const outsideList = j < 0 || j >= points.length;

    if (outsideList) {
      continue;
    }

    sum = sum + points[j].y;
    count = count + 1;
  }

  return sum / count;
}

function getTurningPoints(points) {
  const first = points[0];
  const last = points[points.length - 1];
  const extremes = findExtremes(points);

  return [first, ...extremes, last];
}

function findExtremes(points) {
  const extremes = [];
  let direction = 0;
  let flatStart = 0;

  for (let i = 1; i < points.length; i++) {
    const change = points[i].y - points[i - 1].y;

    if (change === 0) {
      continue;
    }

    const newDirection = Math.sign(change);
    const directionFlipped = direction !== 0 && newDirection !== direction;

    if (directionFlipped) {
      const turningPoint = makeTurningPoint(points, flatStart, i - 1, direction);
      extremes.push(turningPoint);
    }

    direction = newDirection;
    flatStart = i;
  }

  return extremes;
}

function makeTurningPoint(points, firstIndex, lastIndex, directionBefore) {
  const middleX = (points[firstIndex].x + points[lastIndex].x) / 2;
  const y = points[lastIndex].y;
  const wasGoingUp = directionBefore < 0;
  const type = wasGoingUp ? "peak" : "valley";

  return { x: middleX, y: y, type: type };
}

function sampleCurve(turningPoints) {
  const heights = [];
  const startX = turningPoints[0].x;
  const endX = turningPoints[turningPoints.length - 1].x;

  let segment = 0;

  for (let x = startX; x <= endX; x += sampleSpacing) {
    while (x > turningPoints[segment + 1].x) {
      segment = segment + 1;
    }

    const from = turningPoints[segment];
    const to = turningPoints[segment + 1];

    heights.push(easeBetween(from, to, x));
  }

  return heights;
}

function easeBetween(from, to, x) {
  const progress = (x - from.x) / (to.x - from.x);
  const distance = to.y - from.y;
  const curveShape = 1 - Math.cos(Math.PI * progress);

  return from.y + distance * curveShape / 2;
}


// Points: turn key codes into the jagged spike line
function buildPoints(list, roughness) {
  const area = getDrawingArea();
  const stepX = getStepX(area, list.length);
  const points = [];

  let y = getStartHeight();
  let velocity = 0;

  for (let i = 0; i < list.length; i++) {
    const code = list[i];

    const baseMove = keyToMove(code);
    const move = baseMove * roughness[i];
    velocity = blendWithPrevious(velocity, move);

    const wantedY = y + velocity;
    y = keepInsideLimits(wantedY, area);

    const hitLimit = y !== wantedY;

    if (hitLimit) {
      velocity = 0;
    }

    const x = area.left + i * stepX;
    points.push({ x: x, y: y });
  }

  return points;
}

function blendWithPrevious(previousMove, newMove) {
  const keptFromBefore = previousMove * momentum;
  const takenFromNew = newMove * (1 - momentum);

  return keptFromBefore + takenFromNew;
}

function getDrawingArea() {
  const left = margin;
  const right = screenWidth - margin;
  const upperLimit = topY;
  const lowerLimit = screenHeight - margin;

  return {
    left: left,
    right: right,
    upperLimit: upperLimit,
    lowerLimit: lowerLimit
  };
}

function getStepX(area, pointCount) {
  const width = area.right - area.left;
  const gaps = Math.max(1, pointCount - 1);

  return width / gaps;
}

function getStartHeight() {
  return startY;
}

function keyToMove(code) {
  const level = code % 5;
  const direction = level - 2;
  const stepSize = maxStep / 2;
  const move = direction * stepSize;

  return move;
}

function keepInsideLimits(y, area) {
  if (y < area.upperLimit) {
    return area.upperLimit;
  }

  if (y > area.lowerLimit) {
    return area.lowerLimit;
  }

  return y;
}


// Helpers
function clamp01(value) {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function sampleToX(index) {
  return margin + index * sampleSpacing;
}
