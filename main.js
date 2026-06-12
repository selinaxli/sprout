const { app, BrowserWindow, ipcMain, screen, nativeImage, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

let win;

// Persist the user's chosen width between launches.
const PREFS_PATH = path.join(app.getPath('userData'), 'prefs.json');
function _loadWidth() {
  try { return JSON.parse(fs.readFileSync(PREFS_PATH, 'utf8')).width || 500; } catch { return 500; }
}
function _saveWidth(w) {
  try { fs.writeFileSync(PREFS_PATH, JSON.stringify({ width: w })); } catch { /* ignore */ }
}

// Show the sprout in the Dock (and as the app icon) instead of the Electron logo.
app.name = 'Sprout';
const ICON = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));

// Default size. Height grows for the finish card then shrinks back.
// Width is user-adjustable by dragging the right edge.
const BAR_WIDTH  = 500;   // wider default so the task input isn't cramped
const BAR_HEIGHT = 92;
const MIN_WIDTH  = 340;
const MAX_WIDTH  = 820;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  // Remember the last width the user set (falls back to BAR_WIDTH)
  const savedWidth = _loadWidth();

  win = new BrowserWindow({
    width:  savedWidth,
    height: BAR_HEIGHT,
    minWidth:  MIN_WIDTH,
    maxWidth:  MAX_WIDTH,
    minHeight: BAR_HEIGHT,
    // Start near the top-center of the screen.
    x: Math.round(workArea.x + (workArea.width - savedWidth) / 2),
    y: Math.round(workArea.y + 40),
    frame: false,                 // no title bar — just our little bar
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,              // user can drag the right edge to resize
    movable: true,
    fullscreenable: false,
    maximizable: false,
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Float above all normal windows.
  win.setAlwaysOnTop(true, 'floating');
  // Show on every Space / desktop so it's always with you.
  // skipTransformProcessType keeps the app a normal Dock app — without it,
  // macOS demotes the process to "accessory" (no running dot, no Dock Quit).
  // Tradeoff: the bar doesn't float over native-fullscreen apps.
  win.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true });

  // Save width whenever the user finishes resizing (debounced — the resize
  // event fires continuously while dragging, no need to write a file each tick).
  let saveTimer = null;
  win.on('resize', () => {
    const [w, h] = win.getSize();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => _saveWidth(w), 300);
    // Keep height locked to whatever state the bar is in — only width changes.
    const [x, y] = win.getPosition();
    if (h !== win._lockedHeight) win.setBounds({ x, y, width: w, height: win._lockedHeight || BAR_HEIGHT }, false);
  });
  win._lockedHeight = BAR_HEIGHT;

  win.loadFile('index.html');
}

// Renderer asks to grow/shrink the window (e.g. for the finish card),
// keeping the top-left corner anchored so it expands downward.
ipcMain.on('resize-window', (_event, height) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  const [w] = win.getSize();
  const h = Math.round(height);
  win._lockedHeight = h;
  win.setBounds({ x, y, width: w, height: h }, false);
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    // Be a first-class Dock app (regular, not accessory) so we get the running
    // indicator dot — counteracts the always-on-top / all-Spaces panel behavior.
    app.setActivationPolicy('regular');
    // Minimal app menu: menu bar reads "Sprout" with the standard Quit ⌘Q,
    // plus Edit so copy/paste shortcuts work in the task input.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Sprout', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
      { role: 'editMenu' },
    ]));
    if (app.dock && !ICON.isEmpty()) app.dock.setIcon(ICON);
    // Right-click Dock menu, like any normal Mac app — guarantees a Quit option.
    if (app.dock) {
      app.dock.setMenu(Menu.buildFromTemplate([
        { label: 'Show Sprout', click: () => { if (win) { win.show(); win.focus(); } else createWindow(); } },
        { type: 'separator' },
        { label: 'Quit Sprout', click: () => app.quit() },
      ]));
    }
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// On macOS apps usually stay running, but for a tiny utility we quit
// when its window closes.
app.on('window-all-closed', () => app.quit());
