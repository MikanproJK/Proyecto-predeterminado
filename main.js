'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const SRC_DIR = path.join(__dirname, 'src');
const IS_DEV = process.argv.includes('--dev');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
    },
  },
]);

let mainWindow = null;
let lastOverlay = { color: '#f3f5fb', symbolColor: '#3b4252' };

function dataFilePath() {
  return path.join(app.getPath('userData'), 'prestamos-data.json');
}

function emptyDatabase() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      company: 'Mi Financiera',
      owner: '',
      currency: 'USD',
      locale: 'es-419',
      theme: 'aurora',
      density: 'comfortable',
      fontScale: 1,
      autoTransactions: true,
      defaultAccountId: null,
      lateFeeType: 'percent_daily',
      lateFeeValue: 1,
      graceDays: 0,
      paymentOrder: 'late_interest_principal',
      firstRun: true,
    },
    clients: [],
    loans: [],
    payments: [],
    accounts: [],
    transactions: [],
    categories: {
      income: ['Cobro de cuota', 'Interés', 'Comisión', 'Otro ingreso'],
      expense: ['Préstamo otorgado', 'Operativo', 'Personal', 'Servicios', 'Retiro', 'Otro egreso'],
    },
  };
}

function normalizeDatabase(raw) {
  const base = emptyDatabase();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const db = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    categories: { ...base.categories, ...(raw.categories || {}) },
  };
  for (const key of ['clients', 'loans', 'payments', 'accounts', 'transactions']) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  if (!db.accounts.length) {
    db.accounts = [
      { id: 'acc_cash', name: 'Caja', type: 'cash', openingBalance: 0, color: '#4f8cff' },
      { id: 'acc_bank', name: 'Banco', type: 'bank', openingBalance: 0, color: '#2fbf8f' },
    ];
  }
  if (!db.settings.defaultAccountId) db.settings.defaultAccountId = db.accounts[0].id;
  return db;
}

async function readDatabase() {
  try {
    const text = await fsp.readFile(dataFilePath(), 'utf8');
    return normalizeDatabase(JSON.parse(text));
  } catch (err) {
    if (err.code === 'ENOENT') return emptyDatabase();
    console.error('[db] no se pudo leer, se crea una base nueva:', err);
    return emptyDatabase();
  }
}

async function writeDatabase(data) {
  const db = normalizeDatabase(data);
  db.updatedAt = new Date().toISOString();
  const target = dataFilePath();
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fsp.rename(tmp, target);
  return db;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1060,
    minHeight: 680,
    show: false,
    backgroundColor: lastOverlay.color,
    title: 'Préstamos Pro',
    titleBarStyle: 'hidden',
    titleBarOverlay:
      process.platform === 'win32' || process.platform === 'linux'
        ? { color: lastOverlay.color, symbolColor: lastOverlay.symbolColor, height: 46 }
        : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://bundle/')) event.preventDefault();
  });

  await mainWindow.loadURL('app://bundle/index.html');
  if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function registerProtocol() {
  protocol.handle('app', (request) => {
    try {
      const url = new URL(request.url);
      let relative = decodeURIComponent(url.pathname);
      if (!relative || relative === '/') relative = '/index.html';
      const resolved = path.normalize(path.join(SRC_DIR, relative));
      if (!resolved.startsWith(SRC_DIR)) {
        return new Response('Acceso denegado', { status: 403 });
      }
      return net.fetch(pathToFileURL(resolved).toString());
    } catch (err) {
      console.error('[protocol]', err);
      return new Response('No encontrado', { status: 404 });
    }
  });
}

function registerIpc() {
  ipcMain.handle('db:load', () => readDatabase());
  ipcMain.handle('db:save', async (_event, data) => {
    const saved = await writeDatabase(data);
    return { ok: true, updatedAt: saved.updatedAt, path: dataFilePath() };
  });
  ipcMain.handle('db:path', () => dataFilePath());
  ipcMain.handle('db:open-folder', () => {
    shell.showItemInFolder(dataFilePath());
    return true;
  });

  ipcMain.handle('db:backup', async () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Guardar respaldo',
      defaultPath: path.join(app.getPath('documents'), `prestamos-respaldo-${stamp}.json`),
      filters: [{ name: 'Respaldo JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    const data = await readDatabase();
    await fsp.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle('db:restore', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Restaurar respaldo',
      properties: ['openFile'],
      filters: [{ name: 'Respaldo JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    const text = await fsp.readFile(result.filePaths[0], 'utf8');
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.clients) || !Array.isArray(parsed.loans)) {
      throw new Error('El archivo no parece ser un respaldo válido de Préstamos Pro.');
    }
    const saved = await writeDatabase(parsed);
    return { ok: true, data: saved, path: result.filePaths[0] };
  });

  ipcMain.handle('file:save-text', async (_event, { title, defaultName, content, filters }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: title || 'Guardar archivo',
      defaultPath: path.join(app.getPath('documents'), defaultName || 'export.csv'),
      filters: filters || [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Texto', extensions: ['txt'] },
      ],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await fsp.writeFile(result.filePath, content, 'utf8');
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle('window:overlay', (_event, colors) => {
    if (!colors) return false;
    lastOverlay = {
      color: colors.color || lastOverlay.color,
      symbolColor: colors.symbolColor || lastOverlay.symbolColor,
    };
    if (mainWindow && process.platform !== 'darwin' && mainWindow.setTitleBarOverlay) {
      mainWindow.setTitleBarOverlay({ ...lastOverlay, height: 46 });
    }
    if (mainWindow) mainWindow.setBackgroundColor(lastOverlay.color);
    return true;
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    dataFile: dataFilePath(),
  }));

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    registerProtocol();
    registerIpc();
    await createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
