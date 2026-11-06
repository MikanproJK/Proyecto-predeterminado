import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  Database,
  ElectronApi,
  OverlayColors,
  SaveTextPayload,
  UpdateStatus,
} from './src/types.js' with { 'resolution-mode': 'import' };

const api: ElectronApi = {
  load: () => ipcRenderer.invoke('db:load'),
  save: (data: Database) => ipcRenderer.invoke('db:save', data),
  dataPath: () => ipcRenderer.invoke('db:path'),
  openFolder: () => ipcRenderer.invoke('db:open-folder'),
  backup: () => ipcRenderer.invoke('db:backup'),
  restore: () => ipcRenderer.invoke('db:restore'),
  saveText: (payload: SaveTextPayload) => ipcRenderer.invoke('file:save-text', payload),
  setOverlay: (colors: OverlayColors) => ipcRenderer.invoke('window:overlay', colors),
  info: () => ipcRenderer.invoke('app:info'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  updateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (listener: (status: UpdateStatus) => void) => {
    const handler = (_event: IpcRendererEvent, status: UpdateStatus) => listener(status);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
