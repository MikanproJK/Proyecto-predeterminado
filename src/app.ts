/* Arranque de la aplicación y conexión entre módulos */

import { state, init, subscribe, flushSave } from './lib/store.js';
import { logoSVG } from './lib/ui.js';
import { setAppInfo } from './lib/app-info.js';
import { applyAppearance } from './lib/appearance.js';
import { renderSidebar, updateSaveIndicator } from './lib/sidebar.js';
import { renderThemeMenu } from './lib/theme-menu.js';
import { renderCurrent, handleQuickAction } from './lib/view-host.js';
import { openPalette } from './lib/palette.js';
import { installShortcuts } from './lib/shortcuts.js';
import { parseRoute } from './lib/router.js';
import * as actions from './actions.js';

function onRouteChange(): void {
  const { changed } = parseRoute();
  renderCurrent();
  if (changed) {
    const root = document.getElementById('view-root');
    if (root) root.scrollTop = 0;
  }
}

async function boot(): Promise<void> {
  const bootLogo = document.getElementById('boot-logo');
  const titlebarLogo = document.getElementById('titlebar-logo');
  const sidebarLogo = document.getElementById('sidebar-logo');
  if (bootLogo) bootLogo.innerHTML = logoSVG(62, 'boot');
  if (titlebarLogo) titlebarLogo.innerHTML = logoSVG(26, 'tb');
  if (sidebarLogo) sidebarLogo.innerHTML = logoSVG(40, 'side');

  try {
    await init();
    setAppInfo(await window.api.info());
  } catch (err) {
    console.error('[app] no se pudo iniciar', err);
  }

  parseRoute();
  renderThemeMenu();
  renderSidebar();
  applyAppearance();
  renderCurrent();

  document.getElementById('search-trigger')?.addEventListener('click', () => openPalette());
  document.getElementById('quick-action')?.addEventListener('click', handleQuickAction);
  installShortcuts();

  subscribe((type) => {
    if (type === 'save-error') {
      updateSaveIndicator();
      return;
    }
    applyAppearance();
    renderSidebar();
    renderCurrent();
    flushSave().then(updateSaveIndicator);
  });

  flushSave().then(updateSaveIndicator);

  window.addEventListener('hashchange', onRouteChange);
  window.addEventListener('app:refresh', renderCurrent);

  window.addEventListener('beforeunload', () => {
    flushSave();
  });

  setTimeout(() => {
    document.getElementById('boot')?.classList.add('is-hidden');
  }, 260);

  if (state.db.settings.firstRun) {
    setTimeout(() => actions.showWelcome(), 700);
  }
}

boot();
