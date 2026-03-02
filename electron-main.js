import { app, BrowserWindow, globalShortcut, screen, ipcMain, clipboard } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { SnapshotManager } from './src/workspace/SnapshotManager.js';
import { WindowTracker } from './src/workspace/WindowTracker.js';
import { TerminalManager } from './src/workspace/TerminalManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow;
let isVisible = true;

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
});
