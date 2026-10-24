/* Registro de vistas y renderizado de la sección activa */

import { state } from './store.js';
import { icon, esc } from './ui.js';
import { navigate } from './nav.js';
import { ROUTES } from './routes.js';
import { currentRouteId, currentRouteName } from './router.js';
import { applyAppearance } from './appearance.js';
import { markThemeSelection } from './theme-menu.js';
import * as actions from '../actions.js';
import * as dashboardView from '../views/dashboard.js';
import * as clientsView from '../views/clients.js';
import * as loansView from '../views/loans.js';
import * as paymentsView from '../views/payments.js';
import * as financeView from '../views/finance.js';
import * as reportsView from '../views/reports.js';
import * as settingsView from '../views/settings.js';
import type { RouteName, ViewModule } from '../types.js';

const views: Record<RouteName, ViewModule> = {
  dashboard: dashboardView,
  clients: clientsView,
  client: clientsView,
  loans: loansView,
  loan: loansView,
  payments: paymentsView,
  finance: financeView,
  reports: reportsView,
  settings: settingsView,
};

let lastKey: string | null = null;

function setTopbar(): void {
  const routeName = currentRouteName();
  const routeId = currentRouteId();
  const meta = ROUTES[routeName] || ROUTES.dashboard;
  const titleEl = document.getElementById('page-title');
  const eyebrowEl = document.getElementById('page-eyebrow');
  if (!titleEl || !eyebrowEl) return;
  let title = meta.title;
  let eyebrow = meta.eyebrow;

  if (routeName === 'client') {
    const client = state.db.clients.find((c) => c.id === routeId);
    title = client ? client.name : 'Cliente no encontrado';
    eyebrow = 'Ficha del cliente';
  } else if (routeName === 'loan') {
    const loan = state.db.loans.find((l) => l.id === routeId);
    const client = loan ? state.db.clients.find((c) => c.id === loan.clientId) : null;
    title = loan ? loan.code : 'Préstamo no encontrado';
    eyebrow = client ? `${client.name} · detalle del crédito` : 'Detalle del crédito';
  }

  titleEl.textContent = title;
  eyebrowEl.textContent = eyebrow;

  const quick = document.getElementById('quick-action');
  if (!quick) return;
  quick.innerHTML = `${icon(meta.quick.icon, 16)}<span>${esc(meta.quick.label)}</span>`;
  quick.dataset.quickAction = meta.quick.action;

  document.querySelectorAll<HTMLElement>('.nav-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.route === meta.nav);
  });
}

export function renderCurrent(): void {
  const root = document.getElementById('view-root');
  if (!root) return;
  const routeName = currentRouteName();
  const routeId = currentRouteId();
  setTopbar();
  const view = views[routeName] || views.dashboard;
  const key = `${routeName}/${routeId || ''}`;
  const sameView = key === lastKey;
  const scrollTop = sameView ? root.scrollTop : 0;

  try {
    root.innerHTML = '';
    view.render(root, { id: routeId, navigate });
    if (sameView) root.scrollTop = scrollTop;
    else root.scrollTop = 0;
  } catch (err) {
    console.error('[app] error al renderizar', err);
    const message = err instanceof Error ? err.message : 'Error inesperado';
    root.innerHTML = `<div class="page"><div class="card"><div class="card-body">
      <div class="empty">
        <span class="empty-icon">${icon('alert', 28)}</span>
        <strong>No se pudo mostrar esta sección</strong>
        <p>${esc(message)}</p>
        <button class="btn btn-primary" type="button" onclick="location.reload()">${icon('refresh', 16)} Recargar</button>
      </div></div></div></div>`;
  }
  lastKey = key;
  applyAppearance();
  markThemeSelection();
}

export function handleQuickAction(): void {
  const routeName = currentRouteName();
  const routeId = currentRouteId();
  const button = document.getElementById('quick-action');
  if (!button) return;
  const action = button.dataset.quickAction;
  switch (action) {
    case 'new-client':
      actions.openClientForm();
      break;
    case 'new-payment':
      actions.openPaymentModal({
        loanId: routeName === 'loan' ? routeId ?? undefined : undefined,
        clientId: routeName === 'client' ? routeId ?? undefined : undefined,
      });
      break;
    case 'new-movement':
      actions.openTransactionModal();
      break;
    case 'print-report':
      window.dispatchEvent(new CustomEvent('report:print'));
      break;
    case 'backup':
      actions.backupData();
      break;
    case 'new-loan':
    default:
      actions.openLoanForm({ clientId: routeName === 'client' ? routeId ?? undefined : undefined });
      break;
  }
}
