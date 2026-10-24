/* Aplicación del tema, densidad y escala de texto */

import { state } from './store.js';
import { themeMeta } from './themes.js';

export function applyAppearance(): void {
  const settings = state.db.settings;
  const theme = themeMeta(settings.theme);
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.dataset.density = settings.density === 'compact' ? 'compact' : 'comfortable';
  document.documentElement.style.setProperty('--font-scale', String(settings.fontScale || 1));
  document.documentElement.style.setProperty('--titlebar-h', '46px');
  if (window.api?.setOverlay) {
    window.api.setOverlay({ color: theme.bg, symbolColor: theme.ink }).catch(() => {});
  }
  document.title = `${settings.company || 'Préstamos Pro'} · Préstamos Pro`;
}
