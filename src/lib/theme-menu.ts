/* Selector de temas de la barra superior */

import { state } from './store.js';
import { icon, esc } from './ui.js';
import { THEMES, themeMeta } from './themes.js';
import { navigate } from './nav.js';
import * as actions from '../actions.js';
import type { ThemeId } from '../types.js';

let themePopoverOpen = false;

export function renderThemeMenu(): void {
  const wrap = document.getElementById('theme-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<button class="theme-btn" id="theme-btn" type="button" title="Cambiar tema" aria-label="Cambiar tema">
      ${icon('palette', 19)}
    </button>
    <div class="theme-popover" id="theme-popover">
      <h4>Apariencia</h4>
      <div class="theme-list">
        ${THEMES.map(
          (theme) => `<button type="button" class="theme-option" data-theme-option="${theme.id}">
            <span class="theme-swatch" style="background:${theme.swatch}"></span>
            <span>${esc(theme.name)}</span>
            ${icon('check', 14, 'theme-check')}
          </button>`,
        ).join('')}
      </div>
      <div class="theme-footer">
        <span>${esc(themeMeta(state.db.settings.theme).hint)}</span>
        <button type="button" class="link-btn" data-theme-settings>Ajustes</button>
      </div>
    </div>`;

  const btn = wrap.querySelector('#theme-btn') as HTMLElement;
  const popover = wrap.querySelector('#theme-popover') as HTMLElement;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    themePopoverOpen = !themePopoverOpen;
    popover.classList.toggle('is-open', themePopoverOpen);
    markThemeSelection();
  });
  wrap.querySelectorAll<HTMLElement>('[data-theme-option]').forEach((option) => {
    option.addEventListener('click', () => {
      state.db.settings.theme = (option.dataset.themeOption || 'aurora') as ThemeId;
      actions.persistSettings();
      markThemeSelection();
    });
  });
  wrap.querySelector('[data-theme-settings]')!.addEventListener('click', () => {
    themePopoverOpen = false;
    popover.classList.remove('is-open');
    navigate('settings');
  });
  markThemeSelection();
}

export function markThemeSelection(): void {
  const current = state.db.settings.theme;
  document.querySelectorAll<HTMLElement>('[data-theme-option]').forEach((option) => {
    const active = option.dataset.themeOption === current;
    option.classList.toggle('is-active', active);
    const check = option.querySelector<HTMLElement>('.theme-check');
    if (check) check.style.visibility = active ? 'visible' : 'hidden';
  });
}

document.addEventListener('click', () => {
  if (!themePopoverOpen) return;
  themePopoverOpen = false;
  document.getElementById('theme-popover')?.classList.remove('is-open');
});
