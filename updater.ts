/* ============================================================
   Actualizaciones automáticas (electron-updater)
   Comprueba, descarga e instala versiones publicadas en GitHub Releases.
   ============================================================ */

import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import type { UpdatePhase, UpdateStatus } from './src/types.js' with { 'resolution-mode': 'import' };

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 15 * 1000;

let current: UpdateStatus = buildStatus('idle');

function buildStatus(phase: UpdatePhase, patch: Partial<UpdateStatus> = {}): UpdateStatus {
  const packaged = app.isPackaged;
  const base: UpdateStatus = {
    phase,
    currentVersion: app.getVersion(),
    version: null,
    releaseNotes: '',
    releaseDate: null,
    progress: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    message: phase === 'idle' ? 'Comprueba si hay una versión nueva.' : '',
    canCheck: packaged && phase !== 'checking' && phase !== 'downloading' && phase !== 'downloaded',
    canDownload: packaged && phase === 'available',
    canInstall: packaged && phase === 'downloaded',
    checkedAt: null,
  };
  return { ...base, ...patch };
}

function publish(phase: UpdatePhase, patch: Partial<UpdateStatus> = {}): UpdateStatus {
  const carried: Partial<UpdateStatus> = { ...current };
  delete carried.canCheck;
  delete carried.canDownload;
  delete carried.canInstall;
  current = buildStatus(phase, { ...carried, ...patch, phase });
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', current);
  }
  return current;
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err || 'Error desconocido');
}

function friendlyError(err: unknown): string {
  const raw = messageOf(err);
  if (/\b404\b/.test(raw)) {
    return 'No se encontró el repositorio de actualizaciones. Verifica que sea público y que tenga una versión publicada.';
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|net::/i.test(raw)) {
    return 'No hay conexión con el servidor de actualizaciones. Revisa tu conexión a internet.';
  }
  if (/token|authentication|unauthorized|\b401\b|\b403\b/i.test(raw)) {
    return 'El repositorio de actualizaciones no es accesible. Configura un repositorio público o un token de lectura.';
  }
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
}

function releaseNotesOf(info: UpdateInfo): string {
  const notes = info.releaseNotes;
  if (!notes) return '';
  if (typeof notes === 'string') return stripHtml(notes);
  return notes
    .map((entry) => `${entry.version ? `v${entry.version}\n` : ''}${stripHtml(entry.note || '')}`)
    .join('\n\n')
    .trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function setProgress(progress: ProgressInfo): void {
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
  publish('downloading', {
    progress: percent,
    bytesPerSecond: progress.bytesPerSecond || 0,
    transferred: progress.transferred || 0,
    total: progress.total || 0,
    message: `Descargando actualización… ${percent}%`,
  });
}

export function initUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    publish('checking', { message: 'Buscando actualizaciones…' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    publish('available', {
      version: info.version,
      releaseNotes: releaseNotesOf(info),
      releaseDate: info.releaseDate || null,
      checkedAt: new Date().toISOString(),
      message: `La versión ${info.version} está disponible.`,
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    publish('up-to-date', {
      version: info.version || current.currentVersion,
      checkedAt: new Date().toISOString(),
      message: 'Ya tienes la última versión disponible.',
    });
  });

  autoUpdater.on('download-progress', setProgress);

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    publish('downloaded', {
      version: info.version,
      releaseNotes: releaseNotesOf(info),
      releaseDate: info.releaseDate || null,
      progress: 100,
      message: 'Actualización descargada. Reinicia la aplicación para instalarla.',
    });
  });

  autoUpdater.on('error', (err: Error) => {
    publish('error', {
      message: `No se pudo actualizar: ${friendlyError(err)}`,
      checkedAt: new Date().toISOString(),
    });
  });

  if (!app.isPackaged) {
    current = buildStatus('unsupported', {
      message: 'Las actualizaciones solo están disponibles en la versión instalada.',
    });
  }
}

export function getUpdateStatus(): UpdateStatus {
  return current;
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    return publish('unsupported', {
      message: 'Las actualizaciones solo están disponibles en la versión instalada.',
    });
  }
  if (current.phase === 'checking' || current.phase === 'downloading') return current;

  publish('checking', {
    message: 'Buscando actualizaciones…',
    progress: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    checkedAt: current.checkedAt,
  });

  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    publish('error', {
      message: `No se pudo buscar actualizaciones: ${friendlyError(err)}`,
      checkedAt: new Date().toISOString(),
    });
  }
  return current;
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (!app.isPackaged || current.phase !== 'available') return current;

  publish('downloading', {
    progress: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    message: 'Iniciando descarga…',
  });

  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    publish('error', {
      message: `No se pudo descargar la actualización: ${friendlyError(err)}`,
      checkedAt: new Date().toISOString(),
    });
  }
  return current;
}

export function installUpdate(): boolean {
  if (!app.isPackaged || current.phase !== 'downloaded') return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
}

export function registerUpdateIpc(): void {
  ipcMain.handle('update:status', () => getUpdateStatus());
  ipcMain.handle('update:check', () => checkForUpdates());
  ipcMain.handle('update:download', () => downloadUpdate());
  ipcMain.handle('update:install', () => installUpdate());
}

export function scheduleUpdateChecks(): void {
  if (!app.isPackaged) return;

  const first = setTimeout(() => {
    void checkForUpdates();
  }, FIRST_CHECK_DELAY_MS);
  first.unref?.();

  const interval = setInterval(() => {
    if (current.phase === 'idle' || current.phase === 'up-to-date' || current.phase === 'error') {
      void checkForUpdates();
    }
  }, CHECK_INTERVAL_MS);
  interval.unref?.();
}
