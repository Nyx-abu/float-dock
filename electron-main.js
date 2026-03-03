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
      // Check image first
      const img = clipboard.readImage();
      if (!img.isEmpty()) {
        const pngData = img.toPNG();
        const hash = this._hash(pngData.toString('base64').slice(0, 256));
        if (hash !== this._lastHash) {
          this._lastHash = hash;
          const filename = `${Date.now()}.png`;
          const imgPath = path.join(this.imagesDir, filename);
          fs.writeFileSync(imgPath, pngData);
          // Store a compact base64 thumbnail (resize via slice trick — store full path)
          const dataUrl = `data:image/png;base64,${pngData.toString('base64')}`;
          this._push({ type: 'image', content: imgPath, preview: dataUrl });
        }
        return;
      }

      // Check for file paths (Windows clipboard file drop)
      try {
        const rawFiles = clipboard.readBuffer('FileNameW');
        if (rawFiles && rawFiles.length > 0) {
          const text = rawFiles.toString('ucs2').replace(/\0/g, '').trim();
          if (text) {
            const hash = this._hash(text);
            if (hash !== this._lastHash) {
              this._lastHash = hash;
              const files = text.split('\n').map(f => f.trim()).filter(Boolean);
              this._push({ type: 'file', content: text, preview: files[0] || text });
            }
            return;
          }
        }
      } catch (_) { /* not a file — continue */ }

      // Text content
      const text = clipboard.readText();
      if (!text) return;
      const hash = this._hash(text);
      if (hash === this._lastHash) return;
      this._lastHash = hash;

      const type = this._detectType(text);
      this._push({ type, content: text, preview: text });

    } catch (e) {
      // Clipboard can throw during certain OS states
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

    // Notify renderer
    if (this._win && !this._win.isDestroyed()) {
      this._win.webContents.send('clipboard:newItem', item);
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
    if (!item) return false;
    if (item.type === 'image') {
      try {
        const data = fs.readFileSync(item.content);
        clipboard.writeImage(nativeImage.createFromBuffer(data));
      } catch (_) { }
    } else {
      clipboard.writeText(item.content);
      // After writing, update hash so monitor doesn't re-add
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
    x: screenWidth - 500,
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

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const currentBounds = mainWindow.getBounds();
  const targetHeight = expanded ? 620 : 80;
  const margin = 20;

  const width = currentBounds.width;
  const x = Math.round(screenWidth - width - margin);
  const y = Math.round(screenHeight - targetHeight - margin);

  isDockExpanded = !!expanded;

  mainWindow.setBounds({ x, y, width, height: targetHeight });
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
