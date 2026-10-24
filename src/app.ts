/* Arranque de la aplicación, navegación, temas y búsqueda global */

import {
  state,
  init,
  subscribe,
  loanViews,
  portfolioSummary,
  accountBalances,
  flushSave,
} from './lib/store.js';
import { icon, logoSVG, esc, badge } from './lib/ui.js';
import { themeMeta, THEMES } from './lib/themes.js';
import { navigate, currentPath } from './lib/nav.js';
import * as actions from './actions.js';
import * as dashboardView from './views/dashboard.js';
import * as clientsView from './views/clients.js';
import * as loansView from './views/loans.js';
import * as paymentsView from './views/payments.js';
import * as financeView from './views/finance.js';
import * as reportsView from './views/reports.js';
import * as settingsView from './views/settings.js';
import { loanStateMeta, todayISO, money, addDaysISO } from './finance.js';
import type { AppInfo, RouteName, ThemeId, ViewModule } from './types.js';

interface QuickAction {
  label: string;
  icon: string;
  action: string;
}

interface RouteMeta {
  title: string;
  eyebrow: string;
  icon: string;
  nav: string;
  quick: QuickAction;
}

interface NavItem {
  route: RouteName;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SearchItem {
  group: string;
  label: string;
  sub?: string;
  icon: string;
  tag?: { text: string; tone: string } | null;
  run: () => void;
}

interface QuickSearchItem extends SearchItem {
  keywords: string;
}

const ROUTES: Record<string, RouteMeta> = {
  dashboard: {
    title: 'Panel',
    eyebrow: 'Resumen general',
    icon: 'dashboard',
    nav: 'dashboard',
    quick: { label: 'Nuevo préstamo', icon: 'plus', action: 'new-loan' },
  },
  clients: {
    title: 'Clientes',
    eyebrow: 'Directorio y seguimiento',
    icon: 'users',
    nav: 'clients',
    quick: { label: 'Nuevo cliente', icon: 'user-plus', action: 'new-client' },
  },
  client: {
    title: 'Cliente',
    eyebrow: 'Ficha del cliente',
    icon: 'user',
    nav: 'clients',
    quick: { label: 'Nuevo préstamo', icon: 'plus', action: 'new-loan' },
  },
  loans: {
    title: 'Préstamos',
    eyebrow: 'Cartera de créditos',
    icon: 'credit-card',
    nav: 'loans',
    quick: { label: 'Nuevo préstamo', icon: 'plus', action: 'new-loan' },
  },
  loan: {
    title: 'Préstamo',
    eyebrow: 'Detalle del crédito',
    icon: 'file-text',
    nav: 'loans',
    quick: { label: 'Registrar pago', icon: 'receipt', action: 'new-payment' },
  },
  payments: {
    title: 'Cobros',
    eyebrow: 'Pagos recibidos',
    icon: 'receipt',
    nav: 'payments',
    quick: { label: 'Registrar pago', icon: 'plus', action: 'new-payment' },
  },
  finance: {
    title: 'Finanzas',
    eyebrow: 'Caja y movimientos',
    icon: 'wallet',
    nav: 'finance',
    quick: { label: 'Nuevo movimiento', icon: 'plus', action: 'new-movement' },
  },
  reports: {
    title: 'Reportes',
    eyebrow: 'Análisis del negocio',
    icon: 'chart',
    nav: 'reports',
    quick: { label: 'Imprimir reporte', icon: 'print', action: 'print-report' },
  },
  settings: {
    title: 'Configuración',
    eyebrow: 'Preferencias y datos',
    icon: 'settings',
    nav: 'settings',
    quick: { label: 'Guardar respaldo', icon: 'download', action: 'backup' },
  },
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { route: 'dashboard', label: 'Panel', icon: 'dashboard' },
      { route: 'clients', label: 'Clientes', icon: 'users' },
      { route: 'loans', label: 'Préstamos', icon: 'credit-card' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { route: 'payments', label: 'Cobros', icon: 'receipt' },
      { route: 'finance', label: 'Movimientos', icon: 'wallet' },
      { route: 'reports', label: 'Reportes', icon: 'chart' },
    ],
  },
  {
    label: 'Sistema',
    items: [{ route: 'settings', label: 'Configuración', icon: 'settings' }],
  },
];

const NAV_ORDER: RouteName[] = ['dashboard', 'clients', 'loans', 'payments', 'finance', 'reports', 'settings'];

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

let routeName: RouteName = 'dashboard';
let routeId: string | null = null;
let lastKey: string | null = null;
let appInfo: AppInfo | null = null;
let themePopoverOpen = false;

/* ---------- apariencia ---------- */

function applyAppearance(): void {
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

/* ---------- barra lateral ---------- */

function renderSidebar(): void {
  const nav = document.getElementById('sidebar-nav');
  const company = document.getElementById('sidebar-company');
  if (!nav || !company) return;
  company.textContent = state.db.settings.company || 'Mi Financiera';

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
      <span>v${esc(appInfo?.version || '1.0.0')}</span>
    </div>`;

  const titlebarActions = document.getElementById('titlebar-actions');
  if (!titlebarActions) return;
  titlebarActions.innerHTML = `<span class="save-indicator" id="save-indicator">
    <i class="dot"></i><span>Datos locales</span>
  </span>`;
  updateSaveIndicator();
}

function updateSaveIndicator(): void {
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

/* ---------- menú de temas ---------- */

function renderThemeMenu(): void {
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

function markThemeSelection(): void {
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

/* ---------- render principal ---------- */

function setTopbar(): void {
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

function renderCurrent(): void {
  const root = document.getElementById('view-root');
  if (!root) return;
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

function handleQuickAction(): void {
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

/* ---------- enrutado ---------- */

function parseRoute(): void {
  const [rawRoute, ...rest] = currentPath().split('/');
  const name = rawRoute || 'dashboard';
  routeName = (ROUTES[name] ? name : 'dashboard') as RouteName;
  routeId = rest.length ? decodeURIComponent(rest.join('/')) : null;
}

function onRouteChange(): void {
  const previousRoute = routeName;
  const previousId = routeId;
  parseRoute();
  renderCurrent();
  if (previousRoute !== routeName || previousId !== routeId) {
    const root = document.getElementById('view-root');
    if (root) root.scrollTop = 0;
  }
}

/* ---------- búsqueda global ---------- */

function openPalette(initial = ''): void {
  if (document.getElementById('palette-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'palette-backdrop';
  backdrop.id = 'palette-backdrop';
  backdrop.innerHTML = `<div class="palette" role="dialog" aria-modal="true" aria-label="Búsqueda rápida">
    <div class="palette-input">
      ${icon('search', 19)}
      <input id="palette-input" type="text" placeholder="Buscar clientes, préstamos, acciones…" autocomplete="off" spellcheck="false" />
      <kbd>Esc</kbd>
    </div>
    <div class="palette-results" id="palette-results"></div>
    <div class="palette-foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
      <span><kbd>Enter</kbd> abrir</span>
      <span><kbd>Esc</kbd> cerrar</span>
    </div>
  </div>`;
  document.body.append(backdrop);
  void backdrop.offsetWidth;
  backdrop.classList.add('is-open');

  const input = backdrop.querySelector('#palette-input') as HTMLInputElement;
  const results = backdrop.querySelector('#palette-results') as HTMLElement;
  let items: SearchItem[] = [];
  let activeIndex = 0;

  const close = (): void => {
    backdrop.classList.remove('is-open');
    setTimeout(() => backdrop.remove(), 160);
  };

  const runItem = (item: SearchItem): void => {
    close();
    setTimeout(() => item.run(), 60);
  };

  const renderResults = (): void => {
    const query = input.value.trim().toLowerCase();
    items = buildSearchItems(query);
    if (!items.length) {
      results.innerHTML = `<div class="empty empty--compact"><span class="empty-icon">${icon('search', 20)}</span><strong>Sin resultados</strong><p>Prueba con otro nombre, código o acción.</p></div>`;
      return;
    }
    let html = '';
    let group = '';
    let index = 0;
    for (const item of items) {
      if (item.group !== group) {
        group = item.group;
        html += `<div class="palette-group">${esc(group)}</div>`;
      }
      const currentIndex = index;
      html += `<button type="button" class="palette-item ${currentIndex === activeIndex ? 'is-active' : ''}" data-index="${currentIndex}">
        ${icon(item.icon, 17)}
        <span class="palette-item-main">
          <strong>${esc(item.label)}</strong>
          <span>${esc(item.sub || '')}</span>
        </span>
        ${item.tag ? badge(item.tag.text, item.tag.tone) : ''}
      </button>`;
      index += 1;
    }
    results.innerHTML = html;
    results.querySelectorAll<HTMLElement>('[data-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = items[Number(btn.dataset.index)];
        if (item) runItem(item);
      });
      btn.addEventListener('mousemove', () => {
        activeIndex = Number(btn.dataset.index);
        results.querySelectorAll<HTMLElement>('.palette-item').forEach((el) => {
          el.classList.toggle('is-active', Number(el.dataset.index) === activeIndex);
        });
      });
    });
    const activeEl = results.querySelector('.palette-item.is-active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', () => {
    activeIndex = 0;
    renderResults();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(items.length - 1, activeIndex + 1);
      renderResults();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      renderResults();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) runItem(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });
  renderResults();
  setTimeout(() => input.focus(), 30);
  if (initial) {
    input.value = initial;
    renderResults();
  }
}

function buildSearchItems(query: string): SearchItem[] {
  const q = query.trim().toLowerCase();
  const match = (...fields: unknown[]): boolean =>
    !q || fields.some((f) => String(f || '').toLowerCase().includes(q));
  const results: SearchItem[] = [];

  const quickActions: QuickSearchItem[] = [
    {
      group: 'Acciones',
      label: 'Nuevo préstamo',
      sub: 'Crear crédito y generar plan de pagos',
      icon: 'plus',
      run: () => actions.openLoanForm(),
      keywords: 'prestamo credito nuevo',
    },
    {
      group: 'Acciones',
      label: 'Nuevo cliente',
      sub: 'Registrar cliente regular o temporal',
      icon: 'user-plus',
      run: () => actions.openClientForm(),
      keywords: 'cliente persona nuevo temporal',
    },
    {
      group: 'Acciones',
      label: 'Registrar pago',
      sub: 'Cobrar una cuota o abono',
      icon: 'receipt',
      run: () => actions.openPaymentModal(),
      keywords: 'pago cobro abono cuota',
    },
    {
      group: 'Acciones',
      label: 'Nuevo movimiento',
      sub: 'Ingreso, egreso o transferencia',
      icon: 'wallet',
      run: () => actions.openTransactionModal(),
      keywords: 'ingreso egreso gasto transferencia finanzas',
    },
    {
      group: 'Acciones',
      label: 'Guardar respaldo',
      sub: 'Exportar todos los datos en JSON',
      icon: 'download',
      run: () => actions.backupData(),
      keywords: 'backup respaldo exportar copia',
    },
  ].filter((item) => match(item.label, item.sub, item.keywords));

  for (const item of quickActions) results.push(item);

  const pages = NAV_ORDER.map((route) => ROUTES[route]).filter(
    (meta) => meta && match(meta.title, meta.eyebrow),
  );
  for (const meta of pages) {
    const route = NAV_ORDER.find((r) => ROUTES[r] === meta);
    results.push({
      group: 'Secciones',
      label: meta.title,
      sub: meta.eyebrow,
      icon: meta.icon,
      run: () => navigate(route || 'dashboard'),
    });
  }

  if (q) {
    const clients = state.db.clients
      .filter((c) => match(c.name, c.phone, c.email, c.doc, c.address))
      .slice(0, 6);
    for (const client of clients) {
      const stats = loanViews().filter((l) => l.clientId === client.id && l.state !== 'cancelled');
      results.push({
        group: 'Clientes',
        label: client.name,
        sub: [client.phone, client.doc, client.type === 'temporary' ? 'Cliente temporal' : '']
          .filter(Boolean)
          .join(' · '),
        icon: 'user',
        tag: stats.some((l) => l.state === 'overdue')
          ? { text: 'En mora', tone: 'danger' }
          : stats.length
            ? { text: `${stats.length} préstamo${stats.length > 1 ? 's' : ''}`, tone: 'primary' }
            : null,
        run: () => navigate(`client/${client.id}`),
      });
    }

    const loans = loanViews()
      .filter((loan) => {
        const client = state.db.clients.find((c) => c.id === loan.clientId);
        return match(loan.code, client?.name, loan.notes);
      })
      .slice(0, 6);
    for (const loan of loans) {
      const client = state.db.clients.find((c) => c.id === loan.clientId);
      results.push({
        group: 'Préstamos',
        label: `${loan.code} · ${client?.name || 'Cliente'}`,
        sub: `${money(loan.totals.balance)} pendiente · ${loan.installments} cuotas`,
        icon: 'credit-card',
        tag: { text: loanStateMeta(loan.state).label, tone: loanStateMeta(loan.state).tone },
        run: () => navigate(`loan/${loan.id}`),
      });
    }
  }

  return results;
}

/* ---------- atajos ---------- */

function modalIsOpen(): boolean {
  return !!document.querySelector('.modal-backdrop');
}

document.addEventListener('keydown', (event) => {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (mod && key === 'k') {
    event.preventDefault();
    if (!modalIsOpen()) openPalette();
    return;
  }
  if (document.getElementById('palette-backdrop')) return;
  if (mod && key === 'n' && !event.shiftKey) {
    event.preventDefault();
    if (!modalIsOpen()) actions.openLoanForm({ clientId: routeName === 'client' ? routeId ?? undefined : undefined });
    return;
  }
  if (mod && event.shiftKey && key === 'n') {
    event.preventDefault();
    if (!modalIsOpen()) actions.openClientForm();
    return;
  }
  if (mod && key === 'p') {
    event.preventDefault();
    if (!modalIsOpen()) {
      actions.openPaymentModal({
        loanId: routeName === 'loan' ? routeId ?? undefined : undefined,
        clientId: routeName === 'client' ? routeId ?? undefined : undefined,
      });
    }
    return;
  }
  if (mod && /^[1-7]$/.test(key)) {
    event.preventDefault();
    navigate(NAV_ORDER[Number(key) - 1]);
  }
});

/* ---------- arranque ---------- */

async function boot(): Promise<void> {
  const bootLogo = document.getElementById('boot-logo');
  const titlebarLogo = document.getElementById('titlebar-logo');
  const sidebarLogo = document.getElementById('sidebar-logo');
  if (bootLogo) bootLogo.innerHTML = logoSVG(62, 'boot');
  if (titlebarLogo) titlebarLogo.innerHTML = logoSVG(26, 'tb');
  if (sidebarLogo) sidebarLogo.innerHTML = logoSVG(40, 'side');

  try {
    await init();
    appInfo = await window.api.info();
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
