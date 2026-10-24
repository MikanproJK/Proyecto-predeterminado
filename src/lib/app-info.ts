/* Información de la aplicación expuesta por el proceso principal */

import type { AppInfo } from '../types.js';

let appInfo: AppInfo | null = null;

export function setAppInfo(info: AppInfo | null): void {
  appInfo = info;
}

export function getAppInfo(): AppInfo | null {
  return appInfo;
}
