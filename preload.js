'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('db:load'),
  save: (data) => ipcRenderer.invoke('db:save', data),
  dataPath: () => ipcRenderer.invoke('db:path'),
  openFolder: () => ipcRenderer.invoke('db:open-folder'),
  backup: () => ipcRenderer.invoke('db:backup'),
  restore: () => ipcRenderer.invoke('db:restore'),
  saveText: (payload) => ipcRenderer.invoke('file:save-text', payload),
  setOverlay: (colors) => ipcRenderer.invoke('window:overlay', colors),
  info: () => ipcRenderer.invoke('app:info'),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
});
