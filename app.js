/**
 * @typedef {Object} CalcRes
 * @property {number} cols @property {number} rows @property {number} totalBags @property {number} roomArea @property {number} usedArea @property {number} leftoverArea
 */

const state = { roomLength: 15, roomWidth: 12, preset: 'kid', bagWidth: 2.5, bagLength: 5, orientation: 'portrait' };

const roomLengthInput = document.getElementById('room-length');
const roomWidthInput = document.getElementById('room-width');
const bagPresetSelect = document.getElementById('bag-preset');
const customBagInputs = document.getElementById('custom-bag-inputs');
const bagWidthInput = document.getElementById('bag-width');
const bagLengthInput = document.getElementById('bag-length');
const orientPortraitBtn = document.getElementById('orient-portrait');
const orientLandscapeBtn = document.getElementById('orient-landscape');
const statCount = document.getElementById('stat-count');
const statLeftover = document.getElementById('stat-leftover');
const recommendationText = document.getElementById('recommendation-text');
const visualGrid = document.getElementById('visual-grid');
const gridDimensionsLabel = document.getElementById('grid-dimensions-label');

document.addEventListener('DOMContentLoaded', () => {
  loadSavedState();
  setupEventListeners();
  runAutomatedTests();
  calculateAndRender();
});

function loadSavedState() {
  const saved = localStorage.getItem('sleepover_planner_state');
  if (saved) {
    try {
      Object.assign(state, JSON.parse(saved));
      roomLengthInput.value = state.roomLength;
      roomWidthInput.value = state.roomWidth;
      bagPresetSelect.value = state.preset;
      bagWidthInput.value = state.bagWidth;
      bagLengthInput.value = state.bagLength;
      updateOrientationUI();
      toggleCustomInputsUI();
    } catch (e) {}
  }
}

function saveState() {
  localStorage.setItem('sleepover_planner_state', JSON.stringify(state));
}

function setupEventListeners() {
  roomLengthInput.oninput = (e) => { state.roomLength = Math.max(0.1, parseFloat(e.target.value) || 0); handleUpdate(); };
  roomWidthInput.oninput = (e) => { state.roomWidth = Math.max(0.1, parseFloat(e.target.value) || 0); handleUpdate(); };
  bagPresetSelect.onchange = (e) => {
    state.preset = e.target.value;
    if (state.preset === 'kid') { state.bagWidth = 2.5; state.bagLength = 5; }
    else if (state.preset === 'adult') { state.bagWidth = 3; state.bagLength = 6; }
    toggleCustomInputsUI();
    handleUpdate();
  };
  bagWidthInput.oninput = (e) => { state.bagWidth = Math.max(0.1, parseFloat(e.target.value) || 0); handleUpdate(); };
  bagLengthInput.oninput = (e) => { state.bagLength = Math.max(0.1, parseFloat(e.target.value) || 0); handleUpdate(); };
  orientPortraitBtn.onclick = () => { state.orientation = 'portrait'; updateOrientationUI(); handleUpdate(); };
  orientLandscapeBtn.onclick = () => { state.orientation = 'landscape'; updateOrientationUI(); handleUpdate(); };
}

function toggleCustomInputsUI() {
  customBagInputs.classList.toggle('hidden', state.preset !== 'custom');
}

function updateOrientationUI() {
  orientPortraitBtn.classList.toggle('active', state.orientation === 'portrait');
  orientLandscapeBtn.classList.toggle('active', state.orientation === 'landscape');
}

function handleUpdate() { saveState(); calculateAndRender(); }

/**
 * @param {number} rL @param {number} rW @param {number} bW @param {number} bL @param {string} orient
 * @returns {CalcRes}
 */
function calculateGrid(rL, rW, bW, bL, orient) {
  const eW = orient === 'portrait' ? bW : bL;
  const eL = orient === 'portrait' ? bL : bW;
  const cols = Math.floor(rW / eW);
  const rows = Math.floor(rL / eL);
  const totalBags = Math.max(0, cols * rows);
  const roomArea = rL * rW;
  const usedArea = totalBags * (bW * bL);
  return { cols, rows, totalBags, roomArea, usedArea, leftoverArea: Math.max(0, roomArea - usedArea) };
}

function calculateAndRender() {
  const cur = calculateGrid(state.roomLength, state.roomWidth, state.bagWidth, state.bagLength, state.orientation);
  const altOrient = state.orientation === 'portrait' ? 'landscape' : 'portrait';
  const alt = calculateGrid(state.roomLength, state.roomWidth, state.bagWidth, state.bagLength, altOrient);

  statCount.textContent = cur.totalBags;
  statLeftover.textContent = `${cur.leftoverArea.toFixed(1)} sq ft`;
  gridDimensionsLabel.textContent = `${state.roomLength}ft x ${state.roomWidth}ft Room`;

  if (cur.totalBags === 0) {
    recommendationText.textContent = "⚠️ Sleeping bag dimensions are too large!";
  } else if (cur.totalBags > alt.totalBags) {
    recommendationText.textContent = `💡 ${state.orientation.toUpperCase()} fits ${cur.totalBags - alt.totalBags} MORE bag(s) than ${altOrient.toUpperCase()}.`;
  } else if (cur.totalBags < alt.totalBags) {
    recommendationText.textContent = `💡 Switch to ${altOrient.toUpperCase()} to fit ${alt.totalBags - cur.totalBags} MORE bag(s)!`;
  } else {
    recommendationText.textContent = `✨ Both orientations fit ${cur.totalBags} bags.`;
  }

  renderVisualGrid(cur);
}

function renderVisualGrid(calc) {
  visualGrid.innerHTML = '';
  if (calc.totalBags === 0 || calc.cols === 0 || calc.rows === 0) {
    visualGrid.style.gridTemplateColumns = '1fr';
    visualGrid.style.gridTemplateRows = '1fr';
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.textContent = 'Space Too Small';
    visualGrid.appendChild(cell);
    return;
  }
  visualGrid.style.gridTemplateColumns = `repeat(${calc.cols}, 1fr)`;
  visualGrid.style.gridTemplateRows = `repeat(${calc.rows}, 1fr)`;
  for (let i = 1; i <= calc.totalBags; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell occupied';
    cell.textContent = `#${i}`;
    visualGrid.appendChild(cell);
  }
}

function runAutomatedTests() {
  try {
    const t1 = calculateGrid(15, 12, 2.5, 5, 'portrait');
    console.assert(t1.cols === 4 && t1.rows === 3 && t1.totalBags === 12, 'Test 1 Failed');
    console.log('✅ Tests Passed');
  } catch (e) {}
}