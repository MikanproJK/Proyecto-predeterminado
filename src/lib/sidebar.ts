/* Barra lateral, resumen de cuentas e indicador de guardado */

import { state, loanViews, portfolioSummary, accountBalances } from './store.js';
import { icon, esc } from './ui.js';
import { money, addDaysISO, todayISO } from '../finance.js';
import { navigate } from './nav.js';
import { NAV_GROUPS, ROUTES } from './routes.js';
import { currentRouteName } from './router.js';
import { getAppInfo } from './app-info.js';

export function renderSidebar(): void {
  const nav = document.getElementById('sidebar-nav');
  const company = document.getElementById('sidebar-company');
  if (!nav || !company) return;
  company.textContent = state.db.settings.company || 'Mi Financiera';

  const routeName = currentRouteName();
  const overdueCount = loanViews().filter((l) => l.state === 'overdue').length;
  const dueSoon = loanViews().filter((l) => {
    const next = l.totals.nextDueDate;
    return next && next <= addDaysISO(todayISO(), 3) && l.state !== 'paid' && l.state !== 'cancelled';
  }).length;

  nav.innerHTML = NAV_GROUPS.map(
    (group) => `<div class="nav-group-label">${esc(group.label)}</div>
      ${group.items
        .map((item) => {
          const active = ROUTES[routeName]?.nav === item.route;
          let navBadge = '';
          if (item.route === 'loans' && overdueCount) navBadge = `<span class="nav-badge">${overdueCount}</span>`;
          if (item.route === 'payments' && dueSoon && !overdueCount) {
            navBadge = `<span class="nav-badge" style="background:var(--warning)">${dueSoon}</span>`;
          }
          return `<button type="button" class="nav-item ${active ? 'is-active' : ''}" data-route="${item.route}">
            ${icon(item.icon, 18)}<span>${esc(item.label)}</span>${navBadge}
          </button>`;
        })
        .join('')}`,
  ).join('');

  nav.querySelectorAll<HTMLElement>('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.route || ''));
  });

  const foot = document.getElementById('sidebar-foot');
  if (!foot) return;
  const balances = accountBalances();
  const cash = balances.reduce((acc, a) => acc + a.balance, 0);
  const portfolio = portfolioSummary(loanViews());
  foot.innerHTML = `<div class="sidebar-summary">
      <span>Disponible en cuentas</span>
      <strong>${money(cash)}</strong>
      <small>${money(portfolio.outstanding)} por cobrar</small>
    </div>
    <div class="sidebar-meta">
      <span>Préstamos Pro</span>
      <span>v${esc(getAppInfo()?.version || '1.0.0')}</span>
    </div>`;

  const titlebarActions = document.getElementById('titlebar-actions');
  if (!titlebarActions) return;
  titlebarActions.innerHTML = `<span class="save-indicator" id="save-indicator">
    <i class="dot"></i><span>Datos locales</span>
  </span>`;
  updateSaveIndicator();
}

export function updateSaveIndicator(): void {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.toggle('is-saving', !!state.saving);
  const label = el.querySelector('span');
  if (!label) return;
  if (state.saveError) {
    label.textContent = 'Error al guardar';
  } else if (state.saving) {
    label.textContent = 'Guardando…';
  } else if (state.lastSavedAt) {
    label.textContent = `Guardado ${state.lastSavedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    label.textContent = 'Datos locales';
  }
}
