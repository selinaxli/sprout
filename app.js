// ===== Sprout — tiny focus timer =====
// Three states drive everything: "idle" → "running" → "finished".

const bar          = document.getElementById('bar');
const taskInput    = document.getElementById('task-input');
const minutesInput = document.getElementById('minutes-input');
const startBtn     = document.getElementById('start-btn');
const stopBtn      = document.getElementById('stop-btn');
const taskName     = document.getElementById('task-name');
const pie          = document.getElementById('pie');
const timeLeftEl   = document.getElementById('time-left');
const plantSvg     = document.getElementById('plant-svg');
const cat          = document.getElementById('cat');
const yesBtn       = document.getElementById('yes-btn');
const noBtn        = document.getElementById('no-btn');
const finishBtns   = document.getElementById('finish-buttons');
const addtimeBtns  = document.getElementById('addtime-buttons');
const cancelBtn    = document.getElementById('cancel-btn');

const H = { base: 92, finish: 124, finishAdd: 158 };
const inElectron = !!window.sprout;
if (!inElectron) document.body.classList.add('in-browser');

function resizeWindow(px) { if (window.sprout) window.sprout.resize(px); }

// ----- timer state -----
let durationMs = 0;
let endAt = 0;
let tickId = null;
let catTimer = null;

function setState(s) {
  bar.dataset.state = s;
  if (s === 'idle' || s === 'running') resizeWindow(H.base);
  if (s === 'finished') resizeWindow(H.finish);
}

// ===== start =====
function start() {
  const task = (taskInput.value || '').trim() || 'Focus';
  let mins = parseInt(minutesInput.value, 10);
  if (!Number.isFinite(mins) || mins < 1) mins = 1;
  if (mins > 180) mins = 180;
  taskName.textContent = task;
  durationMs = mins * 60000;
  endAt = Date.now() + durationMs;
  currentPlant = pickPlant();
  try { localStorage.setItem('sprout.minutes', String(mins)); } catch (e) {}
  setState('running');
  startTick();
  scheduleCat();
}

// ===== tick =====
function startTick() { stopTick(); tick(); tickId = setInterval(tick, 200); }
function stopTick()  { if (tickId) { clearInterval(tickId); tickId = null; } }

function tick() {
  const remaining = Math.max(0, endAt - Date.now());
  const frac = durationMs > 0 ? remaining / durationMs : 0;
  pie.style.setProperty('--frac', frac.toFixed(4));
  pie.style.setProperty('--ring', ringColor(frac));
  timeLeftEl.textContent = formatTime(remaining);
  drawPlant(1 - frac);
  if (remaining <= 0) finish();
}

function ringColor(frac) {
  const t = Math.max(0, Math.min(1, 1 - frac));
  const green = [108, 194, 142], yellow = [244, 197, 66];
  const c = green.map((v, i) => Math.round(v + (yellow[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ===== finish =====
function finish() {
  stopTick(); stopCat();
  pie.style.setProperty('--frac', 0);
  pie.style.setProperty('--ring', ringColor(0));
  timeLeftEl.textContent = '0:00';
  drawPlant(1);
  playChime();
  finishBtns.classList.remove('hidden');
  addtimeBtns.classList.add('hidden');
  setState('finished');
}

function onYes() { burstConfetti(); playChime(true); setTimeout(reset, 2400); }

function onNotYet() {
  finishBtns.classList.add('hidden');
  addtimeBtns.classList.remove('hidden');
  resizeWindow(H.finishAdd);
}

function addTime(mins) {
  durationMs += mins * 60000;
  endAt = Date.now() + mins * 60000;
  setState('running');
  startTick();
  scheduleCat();
}

function reset() {
  stopTick(); stopCat();
  durationMs = 0; endAt = 0;
  finishBtns.classList.remove('hidden');
  addtimeBtns.classList.add('hidden');
  setState('idle');
  taskInput.focus();
}

// ===== stop confirm =====
let confirmEl = null;
function askStop() {
  if (confirmEl) return;
  confirmEl = document.createElement('div');
  confirmEl.className = 'stop-confirm';
  confirmEl.innerHTML = `
    <span>Stop this task?</span>
    <button class="btn btn-soft no-drag" data-yes>Stop</button>
    <button class="btn btn-ghost no-drag" data-no>Keep going</button>`;
  document.querySelector('.card').appendChild(confirmEl);
  confirmEl.querySelector('[data-yes]').onclick = () => { dismissStop(); reset(); };
  confirmEl.querySelector('[data-no]').onclick = dismissStop;
}
function dismissStop() { if (confirmEl) { confirmEl.remove(); confirmEl = null; } }

// ===== plant =====
function pickPlant() {
  const list = window.SPROUT_PLANTS.list;
  return list[Math.floor(Math.random() * list.length)];
}
let currentPlant = pickPlant();
function drawPlant(p) {
  p = Math.max(0, Math.min(1, p));
  plantSvg.innerHTML = window.SPROUT_PLANTS.pot + currentPlant.draw(p);
}

// ===== cat — lazy full sequence: walk in → sit → look → meow → stand → stretch → walk off =====
//
// Each visit is slightly different:
//   • random palette
//   • random direction (from left or from right)
//   • random look/sit duration (±30%)
//   • randomly skips the stretch ~30% of the time
//   • meow variant is random (chosen from the MEOW_VARIANTS pool the user approved)
//
// Visits happen every 5–7 minutes of task time.

let catPhase = [];   // active phase timeouts for the current visit

// Animation timings (ms). These are deliberately slow/lazy.
const T = {
  walkIn:   9000,   // stroll from edge to centre
  settle:    500,   // tiny pause before sitting
  sit:       700,   // sit-down transition (SVG swap + CSS ease)
  look:     2800,   // default look duration (randomised ±30%)
  stand:     600,   // stand-up transition
  stretch:  1800,   // hold the stretch pose
  walkOut:  9000,   // stroll off the far edge
};

// How long one full visit takes (ms) — used to avoid scheduling when there
// isn't enough time left on the timer.
function visitDuration(doStretch) {
  return T.walkIn + T.settle + T.sit + T.look + T.stand +
         (doStretch ? T.stretch : 0) + T.walkOut + 2000;
}

function scheduleCat() {
  stopCat();
  // First visit: 5–7 minutes into the task.
  const delay = 300000 + Math.random() * 120000;
  catTimer = setTimeout(runCatIfTime, delay);
}

function runCatIfTime() {
  // Only run if there's enough time left for the full sequence.
  const remaining = Math.max(0, endAt - Date.now());
  const doStretch = Math.random() > 0.3;
  if (remaining > visitDuration(doStretch)) {
    runCat(doStretch);
  }
  // Schedule the next potential visit (5–7 mins after this one ends).
  const nextDelay = 300000 + Math.random() * 120000;
  catTimer = setTimeout(runCatIfTime, nextDelay);
}

function runCat(doStretch) {
  const palettes = window.SPROUT_CATS.palettes;
  const pal = palettes[Math.floor(Math.random() * palettes.length)];
  const fromRight = Math.random() > 0.5;
  const lookMs = Math.round(T.look * (0.7 + Math.random() * 0.6));
  const catW = 62; // px width of the cat element (matches CSS .cat width)

  // --- helper: update SVG + class atomically ---
  function setPose(buildFn, className) {
    cat.innerHTML = buildFn(pal);
    cat.className = 'cat ' + className;
    if (fromRight) cat.style.transform = 'scaleX(-1)';
  }

  // Reset cat to off-screen start position
  cat.className = 'cat';
  cat.style.transition = 'none';
  cat.style.transform = fromRight ? 'scaleX(-1)' : 'scaleX(1)';
  cat.style.opacity = '0';
  cat.style.left = fromRight ? `calc(100% + ${catW}px)` : `-${catW + 8}px`;
  void cat.offsetWidth; // force reflow

  // ── Phase 1: Walk in to the centre ──
  setPose(window.SPROUT_CATS.buildWalking, 'walking');
  cat.style.transition = `left ${T.walkIn}ms linear, opacity 0.5s ease`;
  cat.style.opacity = '1';
  cat.style.left = `calc(50% - ${catW / 2}px)`;

  // Play a soft meow as it arrives
  catPhase.push(setTimeout(() => playMeow(), T.walkIn * 0.6));

  // ── Phase 2: Settle & sit ──
  let t = T.walkIn + T.settle;
  catPhase.push(setTimeout(() => {
    cat.style.transition = `opacity 0.35s ease, transform ${T.sit}ms ease`;
    setPose(window.SPROUT_CATS.buildSitting, 'sitting');
  }, t));

  // ── Phase 3: Look at the user (head already facing forward in sit pose) ──
  t += T.sit + 200;
  // Meow again partway through the look
  catPhase.push(setTimeout(() => playMeow(), t + lookMs * 0.45));

  // ── Phase 4: Stand up ──
  t += lookMs;
  catPhase.push(setTimeout(() => {
    setPose(window.SPROUT_CATS.buildWalking, 'walking');
  }, t));

  // ── Phase 5 (optional): Stretch ──
  t += T.stand + 300;
  if (doStretch) {
    catPhase.push(setTimeout(() => {
      cat.style.transition = `opacity 0.35s ease`;
      setPose(window.SPROUT_CATS.buildStretching, 'stretching');
    }, t));
    t += T.stretch;
    // Back to walking pose after stretch
    catPhase.push(setTimeout(() => {
      setPose(window.SPROUT_CATS.buildWalking, 'walking');
    }, t));
    t += 400;
  }

  // ── Phase 6: Walk off ──
  catPhase.push(setTimeout(() => {
    cat.style.transition = `left ${T.walkOut}ms linear, opacity 0.5s ease`;
    cat.style.left = fromRight ? `-${catW + 8}px` : `calc(100% + ${catW}px)`;
    setTimeout(() => { cat.style.opacity = '0'; }, T.walkOut - 500);
  }, t));

  // ── Tidy up ──
  catPhase.push(setTimeout(() => {
    cat.className = 'cat';
    cat.style.opacity = '0';
    cat.style.transform = 'scaleX(1)';
  }, t + T.walkOut + 200));
}

function stopCat() {
  if (catTimer) { clearTimeout(catTimer); catTimer = null; }
  catPhase.forEach(clearTimeout);
  catPhase = [];
  cat.className = 'cat';
  cat.style.opacity = '0';
  cat.style.transform = 'scaleX(1)';
}

// ===== confetti =====
const confettiCanvas = document.getElementById('confetti');
const cctx = confettiCanvas.getContext('2d');
let confettiPieces = [];
let confettiRAF = null;
const CONFETTI_COLORS = ['#6cc28e', '#f7a7c1', '#f6c453', '#8ec5e8', '#c4a7e7', '#ffffff'];

function burstConfetti() {
  const rect = confettiCanvas.getBoundingClientRect();
  confettiCanvas.width = rect.width;
  confettiCanvas.height = rect.height;
  for (let i = 0; i < 90; i++) {
    confettiPieces.push({
      x: rect.width / 2 + (Math.random() - 0.5) * 60,
      y: rect.height / 2,
      vx: (Math.random() - 0.5) * 7,
      vy: -4 - Math.random() * 6,
      g: 0.18 + Math.random() * 0.1,
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
      life: 0,
    });
  }
  if (!confettiRAF) confettiRAF = requestAnimationFrame(drawConfetti);
}

function drawConfetti() {
  cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiPieces.forEach(p => {
    p.life++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot);
    cctx.globalAlpha = Math.max(0, 1 - p.life / 120);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    cctx.restore();
  });
  confettiPieces = confettiPieces.filter(p => p.life < 120 && p.y < confettiCanvas.height + 20);
  if (confettiPieces.length > 0) { confettiRAF = requestAnimationFrame(drawConfetti); }
  else { cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); confettiRAF = null; }
}

// ===== sounds =====
let audioCtx = null;
function _ac() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playChime(bright = false) {
  if (muted) return;
  try {
    const ac = _ac(), now = ac.currentTime;
    const notes = bright ? [659.25, 783.99, 987.77] : [587.33, 880.0];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = now + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain).connect(ac.destination);
      osc.start(t); osc.stop(t + 1.2);
    });
  } catch (e) {}
}

// Real cat meow pool — approved by Selina.
// Preloaded so the first play is instant.
const MEOW_FILES = [
  'assets/meows/processed/c_dragon_sfx_clean.wav',
  'assets/meows/processed/e_dragon_cute_clean.wav',
  'assets/meows/processed/b_garage_clean.wav',
  'assets/meows/processed/b_garage_cute.wav',
  'assets/meows/processed/d_dragon_meow_cute.wav',
];
const _meows = MEOW_FILES.map(src => {
  const a = new Audio(src);
  a.preload = 'auto';
  a.volume = 0.72;
  return a;
});

function playMeow() {
  if (muted) return;
  try {
    const a = _meows[Math.floor(Math.random() * _meows.length)];
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (e) {}
}

// ===== settings =====
let muted = false;
function loadSettings() {
  try {
    muted = localStorage.getItem('sprout.muted') === '1';
    const m = parseInt(localStorage.getItem('sprout.minutes'), 10);
    if (Number.isFinite(m) && m >= 1) minutesInput.value = m;
  } catch (e) {}
  applyMuteUI();
}
function applyMuteUI() {
  bar.classList.toggle('muted', muted);
  // Update both mute buttons (idle-row and running-row)
  document.querySelectorAll('.mute-btn').forEach(b => {
    b.querySelector('.mute-icon').textContent = muted ? '🔇' : '🔊';
    b.title = muted ? 'Sounds off — click to unmute' : 'Mute sounds';
  });
}
function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('sprout.muted', muted ? '1' : '0'); } catch (e) {}
  applyMuteUI();
}

// ===== wire up =====
document.querySelectorAll('.mute-btn').forEach(b => b.addEventListener('click', toggleMute));
startBtn.addEventListener('click', start);
taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
minutesInput.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
stopBtn.addEventListener('click', askStop);
yesBtn.addEventListener('click', onYes);
noBtn.addEventListener('click', onNotYet);
cancelBtn.addEventListener('click', reset);
addtimeBtns.querySelectorAll('[data-add]').forEach(b =>
  b.addEventListener('click', () => addTime(parseInt(b.dataset.add, 10))));

loadSettings();
drawPlant(0);
setState('idle');
