import { contextBridge, ipcRenderer } from 'electron';
import type { Database, ElectronApi, OverlayColors, SaveTextPayload } from './src/types.js' with { 'resolution-mode': 'import' };

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
};

contextBridge.exposeInMainWorld('api', api);
