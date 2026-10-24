/* Paleta de búsqueda global y acciones rápidas */

import { state, loanViews } from './store.js';
import { icon, esc, badge } from './ui.js';
import { money, loanStateMeta } from '../finance.js';
import { navigate } from './nav.js';
import { NAV_ORDER, ROUTES } from './routes.js';
import * as actions from '../actions.js';

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

export function openPalette(initial = ''): void {
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
