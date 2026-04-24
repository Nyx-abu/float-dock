import { app, BrowserWindow, globalShortcut, screen, ipcMain, clipboard, nativeImage } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { SnapshotManager } from './src/workspace/SnapshotManager.js';
import { WindowTracker } from './src/workspace/WindowTracker.js';
import { TerminalManager } from './src/workspace/TerminalManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Clipboard History Manager ────────────────────────────────────────────────

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const URL_RE = /^(https?:\/\/|ftp:\/\/|www\.)\S+/i;
const MAX_HISTORY = 200;

/**
 * Build a Windows CF_HDROP clipboard buffer.
 * Structure: DROPFILES header (20 bytes) + UTF-16LE null-separated path list + double-null.
 *
 * typedef struct _DROPFILES {
 *   DWORD pFiles;  // offset to file list = 20
 *   POINT pt;      // drop point (ignored, set to 0,0)
 *   BOOL  fNC;     // non-client drop (false = 0)
 *   BOOL  fWide;   // Unicode paths (true = 1)
 * } DROPFILES;
 */
function buildCFHDROP(filePaths) {
  const header = Buffer.alloc(20);
  header.writeUInt32LE(20, 0);  // pFiles: file list starts right after header
  header.writeUInt32LE(0,  4);  // pt.x
  header.writeUInt32LE(0,  8);  // pt.y
  header.writeUInt32LE(0, 12);  // fNC = false
  header.writeUInt32LE(1, 16);  // fWide = true → UTF-16LE paths
  // Null-separated paths + double-null terminator, UTF-16LE
  const pathStr = filePaths.join('\0') + '\0\0';
  const pathBuf = Buffer.from(pathStr, 'ucs2');
  return Buffer.concat([header, pathBuf]);
}

class ClipboardHistoryManager {
  constructor(userDataPath) {
    this.historyFile = path.join(userDataPath, 'clipboard-history.json');
    this.imagesDir = path.join(userDataPath, 'clipboard-images');
    this.history = [];
    this._lastHash = null;
    this._pollInterval = null;
    this._win = null;
    this._ensureDirs();
    this._load();
  }

  _ensureDirs() {
    fs.mkdirSync(this.imagesDir, { recursive: true });
  }

  _load() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const raw = fs.readFileSync(this.historyFile, 'utf8');
        this.history = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[ClipboardHistory] Load error:', e.message);
      this.history = [];
    }
  }

  _save() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2), 'utf8');
    } catch (e) {
      console.warn('[ClipboardHistory] Save error:', e.message);
    }
  }

  _hash(str) {
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  _detectType(text) {
    if (HEX_COLOR_RE.test(text.trim())) return 'color';
    if (URL_RE.test(text.trim())) return 'link';
    return 'text';
  }

  _poll() {
    try {
      const formats = clipboard.availableFormats();

      // ── 1. Files — always try CF_HDROP directly (availableFormats returns MIME types,
      //    NOT Windows format names, so we can't gate on format strings) ──
      try {
        const rawFiles = clipboard.readBuffer('CF_HDROP');
        if (rawFiles && rawFiles.length > 20) {
          const pFiles = rawFiles.readUInt32LE(0);
          const fWide  = rawFiles.readUInt32LE(16);
          const pathBuf = rawFiles.slice(pFiles);
          const raw = fWide ? pathBuf.toString('ucs2') : pathBuf.toString('ascii');
          const paths = raw.split('\0').map(p => p.trim()).filter(Boolean);
          if (paths.length > 0) {
            const key = paths.join('\n');
            const hash = this._hash(key);
            if (hash !== this._lastHash) {
              this._push({ type: 'file', content: key, paths, preview: paths[0] });
              this._lastHash = hash;
            }
            return;
          }
        }
      } catch (_) { /* no CF_HDROP data — continue */ }

      // ── 2. Images — check MIME types from availableFormats ──
      if (formats.some(f => f.startsWith('image/'))) {
        const img = clipboard.readImage();
        if (!img.isEmpty()) {
          const pngData = img.toPNG();
          const hash = this._hash(pngData.toString('base64').slice(0, 256));
          if (hash !== this._lastHash) {
            try {
              const filename = `${Date.now()}.png`;
              const imgPath = path.join(this.imagesDir, filename);
              fs.writeFileSync(imgPath, pngData);

              let preview;
              try {
                const { width } = img.getSize();
                const thumbImg = width > 300 ? img.resize({ width: 300 }) : img;
                preview = `data:image/png;base64,${thumbImg.toPNG().toString('base64')}`;
              } catch (_) {
                preview = `data:image/png;base64,${pngData.toString('base64')}`;
              }

              this._push({ type: 'image', content: imgPath, preview });
              this._lastHash = hash;
            } catch (e) {
              console.warn('[ClipboardHistory] Image capture error:', e.message);
            }
          }
          return;
        }
      }

      // ── 3. Text / Links / Colors ──
      const text = clipboard.readText();
      if (!text) return;
      const hash = this._hash(text);
      if (hash === this._lastHash) return;
      this._lastHash = hash;

      const type = this._detectType(text);
      this._push({ type, content: text, preview: text });

    } catch (e) {
      console.warn('[ClipboardHistory] Poll error:', e.message);
    }
  }

  _push(partial) {
    const item = {
      id: crypto.randomUUID(),
      type: partial.type,
      content: partial.content,
      preview: partial.preview,
      timestamp: new Date().toISOString(),
    };

    // Deduplicate against most recent same-type item
    const recent = this.history.find(h => h.type === item.type && h.content === item.content);
    if (recent) {
      // Bubble to top with new timestamp instead of duplicating
      this.history = this.history.filter(h => h.id !== recent.id);
      recent.timestamp = item.timestamp;
      this.history.unshift(recent);
    } else {
      this.history.unshift(item);
      if (this.history.length > MAX_HISTORY) {
        const removed = this.history.splice(MAX_HISTORY);
        // Clean up orphaned image files
        for (const old of removed) {
          if (old.type === 'image' && old.content && fs.existsSync(old.content)) {
            fs.unlink(old.content, () => { });
          }
        }
      }
    }

    this._save();

    // ── Notify renderer ──────────────────────────────────────────────
    if (this._win && !this._win.isDestroyed()) {
      // IMPORTANT: send `recent` in the dedup path, NOT `item`.
      // If we sent `item` (new UUID) the renderer would store a different id
      // than what this.history holds, making copyItem(id) fail silently.
      const toSend = recent ?? item;
      this._win.webContents.send('clipboard:newItem', toSend);
    }
  }

  start(win) {
    this._win = win;
    if (this._pollInterval) return;
    // Seed hash from current clipboard so we don't immediately re-add existing content
    try {
      const img = clipboard.readImage();
      if (!img.isEmpty()) {
        const pngData = img.toPNG();
        this._lastHash = this._hash(pngData.toString('base64').slice(0, 256));
      } else {
        const text = clipboard.readText();
        if (text) this._lastHash = this._hash(text);
      }
    } catch (_) { }
    this._pollInterval = setInterval(() => this._poll(), 500);
  }

  stop() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  getHistory() { return this.history; }

  deleteItem(id) {
    const item = this.history.find(h => h.id === id);
    if (item && item.type === 'image' && item.content && fs.existsSync(item.content)) {
      fs.unlink(item.content, () => { });
    }
    this.history = this.history.filter(h => h.id !== id);
    this._save();
  }

  clearAll() {
    for (const item of this.history) {
      if (item.type === 'image' && item.content && fs.existsSync(item.content)) {
        fs.unlink(item.content, () => { });
      }
    }
    this.history = [];
    this._save();
  }

  copyItem(id) {
    const item = this.history.find(h => h.id === id);
    if (!item) {
      console.warn('[ClipboardHistory] copyItem: id not found:', id);
      return false;
    }

    if (item.type === 'image') {
      try {
        // Primary: read from the saved PNG file
        const data = fs.readFileSync(item.content);
        const img  = nativeImage.createFromBuffer(data);
        clipboard.writeImage(img);
        this._lastHash = this._hash(img.toPNG().toString('base64').slice(0, 256));
      } catch (_) {
        // Fallback: recreate from the preview thumbnail stored in memory
        try {
          const b64 = item.preview.replace(/^data:image\/png;base64,/, '');
          const img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'));
          clipboard.writeImage(img);
          this._lastHash = this._hash(img.toPNG().toString('base64').slice(0, 256));
        } catch (e2) {
          console.warn('[ClipboardHistory] copyItem image fallback error:', e2.message);
          return false;
        }
      }

    } else if (item.type === 'file') {
      // Prefer the stored paths array; fall back to parsing the content string
      const paths = Array.isArray(item.paths) && item.paths.length
        ? item.paths
        : item.content.split('\n').map(f => f.trim()).filter(Boolean);

      let written = false;
      try {
        // Primary: CF_HDROP (required for Windows Explorer file paste)
        const buf = buildCFHDROP(paths);
        clipboard.writeBuffer('CF_HDROP', buf);
        written = true;
      } catch (e1) {
        console.warn('[ClipboardHistory] CF_HDROP write error:', e1.message);
      }

      if (!written) {
        try {
          // Secondary: FileNameW (works in some apps but not Explorer)
          const buf = Buffer.from(paths.join('\0') + '\0\0', 'ucs2');
          clipboard.writeBuffer('FileNameW', buf);
          written = true;
        } catch (e2) {
          console.warn('[ClipboardHistory] FileNameW write error:', e2.message);
        }
      }

      if (!written) return false; // do not fall back to text for files
      this._lastHash = this._hash(item.content);

    } else {
      clipboard.writeText(item.content);
      this._lastHash = this._hash(item.content);
    }

    return true;
  }
}

let clipboardHistory = null;
function getClipboardHistory() {
  if (!clipboardHistory) {
    clipboardHistory = new ClipboardHistoryManager(app.getPath('userData'));
  }
  return clipboardHistory;
}

let mainWindow;
let isVisible = true;
let isDockExpanded = false;

/** @type {SnapshotManager | null} */
let snapshotManager = null;
const windowTracker = new WindowTracker();
const terminalManager = new TerminalManager();

function getSnapshotManager() {
  if (!snapshotManager) {
    const workspaceDir = path.join(app.getPath('userData'), 'workspaces');
    console.log('[Workspace] Base directory:', workspaceDir);
    snapshotManager = new SnapshotManager(workspaceDir);
  }
  return snapshotManager;
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 480,
    height: 80,
    // Default: horizontally centered, slightly above the bottom taskbar
    x: Math.round(screenWidth / 2 - 240),
    y: screenHeight - 120,
    // important for clean overlay on Windows
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devPort = process.env.VITE_PORT || '5173';
  const indexPath = isDevelopment
    ? `http://localhost:${devPort}`
    : `file://${path.join(__dirname, 'dist', 'index.html')}`;

  mainWindow.loadURL(indexPath);
  mainWindow.show();

  // Start clipboard history monitoring
  getClipboardHistory().start(mainWindow);

  if (isDevelopment) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function getCurrentDockLayoutSnapshot() {
  // TODO: integrate with your real dock state (position, width, active tab)
  return {
    position: 'right',
    width: 480,
    activeTabId: 'workspaces',
    openWidgets: ['workspaces'],
  };
}

function getCurrentTerminalSnapshots() {
  // If you track terminals in-app, return them here. For now, snapshot is empty.
  return [];
}

// Notification handler - send to renderer to display
ipcMain.handle('notify', (event, { title, body }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('show-notification', { title, body });
  }
  return { success: true };
});

// ─── Clipboard History IPC ────────────────────────────────────────────────────
ipcMain.handle('clipboard:getHistory', () => {
  return getClipboardHistory().getHistory();
});

ipcMain.handle('clipboard:deleteItem', (_event, { id }) => {
  getClipboardHistory().deleteItem(id);
  return { ok: true };
});

ipcMain.handle('clipboard:clearAll', () => {
  getClipboardHistory().clearAll();
  return { ok: true };
});

ipcMain.handle('clipboard:copyItem', (_event, { id }) => {
  return getClipboardHistory().copyItem(id);
});

// Workspace Snapshot IPC
ipcMain.handle('workspace:save', async (_event, { name }) => {
  console.log('[IPC] workspace:save', name);

  const apps = await windowTracker.captureAppSnapshotsAsync();
  const terminals = getCurrentTerminalSnapshots();
  const dockLayout = getCurrentDockLayoutSnapshot();

  const snapshot = {
    name,
    createdAt: new Date().toISOString(),
    apps,
    terminals,
    dockLayout,
  };

  const manager = getSnapshotManager();
  await manager.saveSnapshot(name, snapshot);
  return snapshot;
});

ipcMain.handle('workspace:list', async () => {
  console.log('[IPC] workspace:list');
  const manager = getSnapshotManager();
  const snapshots = await manager.listSnapshots();
  return snapshots;
});

ipcMain.handle('workspace:restore', async (event, { name }) => {
  console.log('[IPC] workspace:restore', name);
  const manager = getSnapshotManager();
  const snapshot = await manager.loadSnapshot(name);
  if (!snapshot) throw new Error(`Workspace "${name}" not found`);

  await windowTracker.restoreFromSnapshots(snapshot.apps || []);
  terminalManager.restoreTerminals(snapshot.terminals || []);

  // Notify renderer to restore dock layout
  event.sender.send('workspace:dockLayoutRestore', snapshot.dockLayout || null);

  return { ok: true };
});

ipcMain.handle('workspace:delete', async (_event, { name }) => {
  console.log('[IPC] workspace:delete', name);
  const manager = getSnapshotManager();
  await manager.deleteSnapshot(name);
  return { ok: true };
});

// Apply dock layout (position + width) from renderer restore
ipcMain.handle('dock:applyLayout', async (_event, { layout }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
  if (!layout) return { ok: false };

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const margin = 20;
  const height = mainWindow.getBounds().height || 80;
  const width = Math.max(260, Math.min(Number(layout.width || 480), screenWidth - margin * 2));

  let x = mainWindow.getBounds().x;
  let y = mainWindow.getBounds().y;

  switch (layout.position) {
    case 'left':
      x = margin;
      y = Math.round(screenHeight - height - margin);
      break;
    case 'top':
      x = Math.round(screenWidth - width - margin);
      y = margin;
      break;
    case 'bottom':
      x = Math.round(screenWidth - width - margin);
      y = Math.round(screenHeight - height - margin);
      break;
    case 'right':
    default:
      x = Math.round(screenWidth - width - margin);
      y = Math.round(screenHeight - height - margin);
      break;
  }

  mainWindow.setBounds({ x, y, width, height });
  return { ok: true };
});

// Expand/collapse dock window height for workspace UI
ipcMain.handle('dock:setExpanded', async (_event, { expanded }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };

  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const currentBounds = mainWindow.getBounds();
  const targetHeight = expanded ? 620 : 80;

  // Anchor to the dock's current bottom edge so it stays wherever the user left it.
  // Growing/shrinking happens upward; the bottom of the dock doesn't move.
  const currentBottom = currentBounds.y + currentBounds.height;
  const x = currentBounds.x;
  // Clamp so the window doesn't go off the top of the screen
  const y = Math.max(0, Math.min(currentBottom - targetHeight, screenHeight - targetHeight));

  isDockExpanded = !!expanded;

  mainWindow.setBounds({ x, y, width: currentBounds.width, height: targetHeight });
  return { ok: true, expanded: isDockExpanded };
});

// IPC Handlers for Clipboard
ipcMain.handle('clipboard:copy', async (event, text) => {
  try {
    if (typeof text !== 'string' || text.length > 1000000) {
      throw new Error('Invalid clipboard content');
    }
    clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    console.error('Clipboard error:', error);
    throw error;
  }
});

function toggleWindowVisibility() {
  if (isVisible) {
    mainWindow.hide();
    isVisible = false;
  } else {
    mainWindow.show();
    isVisible = true;
  }
}

app.on('ready', () => {
  createWindow();

  // Register Ctrl + Shift + D to toggle visibility
  globalShortcut.register('Control+Shift+D', () => {
    toggleWindowVisibility();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (clipboardHistory) clipboardHistory.stop();
});
