/* Clientes: directorio y ficha detallada */

import { state, loanViews, clientStats, clientLoans, client as getClient } from '../lib/store.js';
import {
  money,
  round2,
  sum,
  formatDate,
  loanStateMeta,
  todayISO,
  daysBetween,
} from '../finance.js';
import {
  icon,
  esc,
  avatar,
  badge,
  emptyState,
  progressBar,
  segmented,
  field,
} from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import * as actions from '../actions.js';
import type { Client, LoanScheduleRow, LoanView, ViewContext } from '../types.js';

interface ClientFilters {
  query: string;
  type: string;
  mode: string;
}

const filters: ClientFilters = { query: '', type: 'all', mode: 'cards' };

export function render(root: HTMLElement, ctx: ViewContext): void {
  if (ctx.id) {
    renderDetail(root, ctx);
    return;
  }

  const allViews = loanViews();
  const clients = [...state.db.clients].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const summarize = (client: Client) => {
    const loans = allViews.filter((loan) => loan.clientId === client.id);
    const active = loans.filter((loan) => ['active', 'overdue'].includes(loan.state));
    return {
      loans,
      active,
      overdue: loans.some((loan) => loan.state === 'overdue'),
      balance: round2(sum(loans.filter((loan) => loan.state !== 'cancelled'), (loan) => loan.totals.balance)),
      mora: round2(sum(loans, (loan) => loan.totals.lateDue)),
      principal: round2(sum(loans, (loan) => loan.totals.principal)),
    };
  };

  const rows = clients.map((client) => ({ ...client, summary: summarize(client) }));

  const counts = {
    all: rows.length,
    regular: rows.filter((c) => c.type !== 'temporary').length,
    temporary: rows.filter((c) => c.type === 'temporary').length,
    overdue: rows.filter((c) => c.summary.overdue).length,
    inactive: rows.filter((c) => c.active === false).length,
  };

  const chipItems = [
    { value: 'all', label: 'Todos', count: counts.all },
    { value: 'regular', label: 'Regulares', count: counts.regular },
    { value: 'temporary', label: 'Temporales', count: counts.temporary },
    { value: 'overdue', label: 'En mora', count: counts.overdue },
    { value: 'inactive', label: 'Inactivos', count: counts.inactive },
  ];

  const filtered = () => {
    const query = filters.query.trim().toLowerCase();
    return rows.filter((client) => {
      if (filters.type === 'regular' && client.type === 'temporary') return false;
      if (filters.type === 'temporary' && client.type !== 'temporary') return false;
      if (filters.type === 'overdue' && !client.summary.overdue) return false;
      if (filters.type === 'inactive' && client.active !== false) return false;
      if (filters.type !== 'inactive' && filters.type !== 'all' && client.active === false) {
        /* los inactivos solo aparecen en su propio filtro */
        return false;
      }
      if (!query) return true;
      return [client.name, client.phone, client.email, client.doc, client.address, client.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  };

  root.innerHTML = `<div class="page">
    <div class="stat-grid mb-2">
      <article class="stat stat--primary">
        <div class="stat-top"><span class="stat-icon">${icon('users', 19)}</span>${badge('Directorio', 'primary')}</div>
        <div class="stat-value">${counts.all}</div>
        <div class="stat-label">Clientes registrados</div>
        <div class="stat-hint">${counts.regular} regulares · ${counts.temporary} temporales</div>
      </article>
      <article class="stat stat--success">
        <div class="stat-top"><span class="stat-icon">${icon('user', 19)}</span>${badge('Activos', 'success', { dot: true })}</div>
        <div class="stat-value">${rows.filter((c) => c.active !== false).length}</div>
        <div class="stat-label">Clientes activos</div>
        <div class="stat-hint">${counts.inactive} inactivos en el directorio</div>
      </article>
      <article class="stat stat--danger">
        <div class="stat-top"><span class="stat-icon">${icon('alert', 19)}</span>${badge('Atención', 'danger')}</div>
        <div class="stat-value">${counts.overdue}</div>
        <div class="stat-label">Clientes con mora</div>
        <div class="stat-hint">${money(round2(sum(rows, (c) => c.summary.mora)))} de mora acumulada</div>
      </article>
      <article class="stat stat--accent">
        <div class="stat-top"><span class="stat-icon">${icon('coins', 19)}</span>${badge('Cartera', 'info')}</div>
        <div class="stat-value">${money(round2(sum(rows, (c) => c.summary.balance)))}</div>
        <div class="stat-label">Saldo en cartera</div>
        <div class="stat-hint">${money(round2(sum(rows, (c) => c.summary.principal)))} prestados en total</div>
      </article>
    </div>

    <div class="toolbar">
      <div class="search-box">
        ${icon('search', 17)}
        <input type="search" id="client-search" placeholder="Buscar por nombre, teléfono, documento…" value="${esc(filters.query)}" autocomplete="off" />
      </div>
      <div class="chip-row" id="client-chips">
        ${chipItems
          .map(
            (item) => `<button type="button" class="chip ${filters.type === item.value ? 'is-active' : ''}" data-chip="${item.value}">
              ${esc(item.label)} <span class="chip-count">${item.count}</span>
            </button>`,
          )
          .join('')}
      </div>
      <div class="toolbar-spacer"></div>
      ${segmented(
        [
          { value: 'cards', label: 'Tarjetas', icon: 'dashboard' },
          { value: 'table', label: 'Tabla', icon: 'file-text' },
        ],
        filters.mode,
        'client-mode',
      )}
      <button class="btn btn-primary" type="button" data-new-client>${icon('user-plus', 16)} Nuevo cliente</button>
    </div>

    <div id="clients-content"></div>
  </div>`;

  const content = root.querySelector<HTMLElement>('#clients-content')!;

  const paint = (): void => {
    const list = filtered();
    if (!state.db.clients.length) {
      content.innerHTML = `<div class="card"><div class="card-body">${emptyState({
        title: 'Tu directorio está vacío',
        text: 'Registra tu primer cliente, sea regular o temporal, para comenzar a otorgar préstamos.',
        iconName: 'users',
        action: `<button class="btn btn-primary" type="button" data-new-client>${icon('user-plus', 16)} Registrar primer cliente</button>`,
      })}</div></div>`;
    } else if (!list.length) {
      content.innerHTML = `<div class="card"><div class="card-body">${emptyState({
        title: 'Sin resultados',
        text: 'No encontramos clientes con ese filtro o búsqueda.',
        iconName: 'search',
        action: `<button class="btn btn-outline" type="button" data-clear-filters>Limpiar filtros</button>`,
      })}</div></div>`;
    } else if (filters.mode === 'table') {
      content.innerHTML = `<div class="card"><div class="table-wrap"><table class="table">
        <thead><tr>
          <th>Cliente</th><th>Contacto</th><th>Tipo</th><th class="num">Préstamos</th><th class="num">Saldo</th><th class="num">Mora</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>
          ${list
            .map(
              (client) => `<tr class="is-clickable" data-client="${client.id}">
                <td><div class="cell-main">${avatar(client.name, 32)}<div class="cell-stack"><strong>${esc(client.name)}</strong><span>${esc(client.doc || 'Sin documento')}</span></div></div></td>
                <td><div class="cell-stack"><span>${esc(client.phone || '—')}</span><span>${esc(client.email || '')}</span></div></td>
                <td>${client.type === 'temporary' ? badge('Temporal', 'warning') : badge('Regular', 'muted')}</td>
                <td class="num">${client.summary.active.length} <span class="muted">/ ${client.summary.loans.length}</span></td>
                <td class="num money">${money(client.summary.balance)}</td>
                <td class="num money ${client.summary.mora > 0 ? 'money--danger' : 'money--muted'}">${money(client.summary.mora)}</td>
                <td>${client.active === false ? badge('Inactivo', 'muted') : client.summary.overdue ? badge('En mora', 'danger', { dot: true }) : badge('Al día', 'success', { dot: true })}</td>
                <td><div class="cell-actions">
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-loan-new="${client.id}" title="Nuevo préstamo">${icon('plus', 15)}</button>
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-edit="${client.id}" title="Editar cliente">${icon('edit', 15)}</button>
                </div></td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table></div>
      <div class="table-foot"><span>${list.length} cliente${list.length === 1 ? '' : 's'}</span><span>Haz clic en una fila para ver la ficha</span></div>
      </div>`;
    } else {
      content.innerHTML = `<div class="client-grid">
        ${list
          .map(
            (client) => `<article class="client-card" data-client="${client.id}">
              <div class="client-card-head">
                ${avatar(client.name, 42)}
                <div class="client-card-name">
                  <strong>${esc(client.name)}</strong>
                  <span>${esc(client.phone || client.email || 'Sin contacto registrado')}</span>
                </div>
                <div class="flex flex-col gap-1 items-end">
                  ${client.type === 'temporary' ? badge('Temporal', 'warning') : badge('Regular', 'muted')}
                  ${client.active === false ? badge('Inactivo', 'muted') : ''}
                </div>
              </div>
              <div class="client-card-stats">
                <div><span>Préstamos activos</span><strong>${client.summary.active.length} <small class="muted">de ${client.summary.loans.length}</small></strong></div>
                <div><span>Saldo pendiente</span><strong>${money(client.summary.balance)}</strong></div>
              </div>
              <div class="loan-card-foot">
                <span>${client.summary.overdue ? badge(client.summary.mora > 0 ? `Mora ${money(client.summary.mora)}` : 'En mora', 'danger', { dot: true }) : client.summary.loans.length ? badge('Al día', 'success', { dot: true }) : badge('Sin préstamos', 'muted')}</span>
                <span class="row-inline" style="gap:4px">Ver ficha ${icon('chevron-right', 13)}</span>
              </div>
            </article>`,
          )
          .join('')}
      </div>
      <div class="table-foot" style="padding:12px 2px 0"><span>${list.length} cliente${list.length === 1 ? '' : 's'} mostrados</span><span></span></div>`;
    }
    bindContent(content);
  };

  const syncChips = (): void => {
    root.querySelectorAll<HTMLElement>('[data-chip]').forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.chip === filters.type);
    });
  };

  root.querySelector<HTMLInputElement>('#client-search')!.addEventListener('input', (event) => {
    filters.query = (event.target as HTMLInputElement).value;
    paint();
  });
  root.querySelectorAll<HTMLElement>('[data-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      filters.type = chip.dataset.chip || 'all';
      syncChips();
      paint();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-segmented="client-mode"] [data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.mode = btn.dataset.value || 'cards';
      root.querySelectorAll<HTMLElement>('[data-segmented="client-mode"] [data-value]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.value === filters.mode);
      });
      paint();
    });
  });
  root.querySelector<HTMLElement>('[data-new-client]')!.addEventListener('click', () => actions.openClientForm());
  paint();

  function bindContent(scope: HTMLElement): void {
    scope.querySelectorAll<HTMLElement>('[data-client]').forEach((el) => {
      el.addEventListener('click', () => navigate(`client/${el.dataset.client || ''}`));
    });
    scope.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        actions.openClientForm({ clientId: el.dataset.edit });
      });
    });
    scope.querySelectorAll<HTMLElement>('[data-loan-new]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        actions.openLoanForm({ clientId: el.dataset.loanNew });
      });
    });
    scope.querySelectorAll<HTMLElement>('[data-new-client]').forEach((el) => {
      el.addEventListener('click', () => actions.openClientForm());
    });
    scope.querySelectorAll<HTMLElement>('[data-clear-filters]').forEach((el) => {
      el.addEventListener('click', () => {
        filters.query = '';
        filters.type = 'all';
        const input = root.querySelector<HTMLInputElement>('#client-search')!;
        if (input) input.value = '';
        syncChips();
        paint();
      });
    });
  }
}

/* ============================================================
   Ficha del cliente
   ============================================================ */

function renderDetail(root: HTMLElement, ctx: ViewContext): void {
  const client = getClient(ctx.id);
  if (!client) {
    root.innerHTML = `<div class="page"><div class="card"><div class="card-body">${emptyState({
      title: 'Cliente no encontrado',
      text: 'Es posible que haya sido eliminado.',
      iconName: 'user',
      action: `<button class="btn btn-primary" type="button" data-back>${icon('arrow-left', 16)} Volver a clientes</button>`,
    })}</div></div></div>`;
    root.querySelector<HTMLElement>('[data-back]')!.addEventListener('click', () => navigate('clients'));
    return;
  }

  const stats = clientStats(client.id);
  const loans = clientLoans(client.id).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const payments = state.db.payments
    .filter((p) => p.clientId === client.id)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const overdue = loans.filter((loan) => loan.state === 'overdue');
  const activeLoans = loans.filter((loan) => ['active', 'overdue'].includes(loan.state));
  const nextDue = activeLoans
    .map((loan) => ({ loan, row: loan.rows.find((row) => row.remaining > 0.004) }))
    .filter((item): item is { loan: LoanView; row: LoanScheduleRow } => !!item.row)
    .sort((a, b) => String(a.row.dueDate).localeCompare(String(b.row.dueDate)))[0];

  root.innerHTML = `<div class="page">
    <div class="row-inline mb-2">
      <button class="btn btn-ghost btn-sm" type="button" data-back>${icon('arrow-left', 15)} Clientes</button>
    </div>

    <section class="card mb-2">
      <div class="detail-head">
        <div class="detail-head-main">
          ${avatar(client.name, 58, 'avatar--lg')}
          <div class="detail-head-text">
            <h2>${esc(client.name)}
              ${client.type === 'temporary' ? badge('Temporal', 'warning') : badge('Regular', 'muted')}
              ${client.active === false ? badge('Inactivo', 'muted') : ''}
            </h2>
            <p>
              ${client.phone ? `${icon('message', 13)} ${esc(client.phone)}` : ''}
              ${client.email ? ` · ${esc(client.email)}` : ''}
              ${client.doc ? ` · ${esc(client.doc)}` : ''}
            </p>
            <p>${icon('calendar', 13)} Cliente desde ${formatDate(client.createdAt?.slice(0, 10), 'medium')}${client.expiresAt ? ` · referencia hasta ${formatDate(client.expiresAt, 'medium')}` : ''}</p>
          </div>
        </div>
        <div class="detail-head-actions">
          <button class="btn btn-primary" type="button" data-new-loan>${icon('plus', 16)} Nuevo préstamo</button>
          <button class="btn btn-outline" type="button" data-new-payment ${activeLoans.length ? '' : 'disabled'}>${icon('receipt', 16)} Registrar pago</button>
          <button class="btn btn-outline btn-icon" type="button" data-edit title="Editar cliente">${icon('edit', 16)}</button>
          <button class="btn btn-ghost btn-icon" type="button" data-delete title="Eliminar cliente">${icon('trash', 16)}</button>
        </div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><span>Total prestado</span><strong>${money(stats.principal)}</strong></div>
        <div class="detail-stat"><span>Saldo pendiente</span><strong>${money(stats.balance)}</strong></div>
        <div class="detail-stat"><span>Total pagado</span><strong class="money--income">${money(stats.paid)}</strong></div>
        <div class="detail-stat"><span>Mora</span><strong class="${stats.lateDue > 0 ? 'money--danger' : ''}">${money(stats.lateDue)}</strong></div>
        <div class="detail-stat"><span>Último pago</span><strong>${stats.lastPayment ? formatDate(stats.lastPayment, 'medium') : '—'}</strong></div>
      </div>
    </section>

    <div class="grid grid-main mb-2">
      <section class="card">
        <div class="card-head">
          <div class="card-heading">
            <h3 class="card-title">Préstamos del cliente</h3>
            <span class="card-sub">${loans.length} crédito${loans.length === 1 ? '' : 's'} · ${activeLoans.length} activo${activeLoans.length === 1 ? '' : 's'}</span>
          </div>
          <button class="btn btn-soft btn-sm" type="button" data-new-loan>${icon('plus', 14)} Nuevo</button>
        </div>
        <div class="card-body card-body--tight">
          ${
            loans.length
              ? `<div class="list">
                  ${loans
                    .map((loan) => {
                      const next = loan.rows.find((row) => row.remaining > 0.004);
                      return `<div class="list-item list-item--clickable" data-loan="${loan.id}">
                        <span class="list-icon list-icon--${loan.state === 'overdue' ? 'late' : loan.state === 'paid' ? 'income' : 'primary'}">${icon('credit-card', 16)}</span>
                        <div class="list-main">
                          <span class="list-title">${esc(loan.code)} ${badge(loanStateMeta(loan.state).label, loanStateMeta(loan.state).tone, { dot: true })}</span>
                          <span class="list-sub">${money(loan.totals.principal)} · ${loan.installments} cuotas · ${next ? `próxima ${formatDate(next.dueDate, 'short')}` : 'completado'}</span>
                          <div style="margin-top:5px;max-width:240px">${progressBar(loan.totals.progress, loan.state === 'overdue' ? 'danger' : loan.state === 'paid' ? 'success' : 'primary', { thin: true, label: `${Math.round(loan.totals.progress * 100)}% pagado` })}</div>
                        </div>
                        <div class="list-side">
                          <strong>${money(loan.totals.balance)}</strong>
                          <span>${loan.state === 'overdue' ? `${loan.totals.overdueDays} días` : 'saldo'}</span>
                        </div>
                      </div>`;
                    })
                    .join('')}
                </div>`
              : emptyState({
                  title: 'Sin préstamos',
                  text: 'Este cliente aún no tiene créditos registrados.',
                  iconName: 'credit-card',
                  action: `<button class="btn btn-primary btn-sm" type="button" data-new-loan>${icon('plus', 15)} Crear préstamo</button>`,
                })
          }
        </div>
      </section>

      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div class="card-heading">
              <h3 class="card-title">Información</h3>
              <span class="card-sub">Datos de contacto y seguimiento</span>
            </div>
            <button class="btn btn-icon btn-ghost btn-sm" type="button" data-edit title="Editar">${icon('edit', 15)}</button>
          </div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-item"><span>Teléfono</span><strong>${esc(client.phone || '—')}</strong></div>
              <div class="info-item"><span>Correo</span><strong>${esc(client.email || '—')}</strong></div>
              <div class="info-item"><span>Documento</span><strong>${esc(client.doc || '—')}</strong></div>
              <div class="info-item"><span>Tipo</span><strong>${client.type === 'temporary' ? 'Temporal' : 'Regular'}</strong></div>
              <div class="info-item" style="grid-column:1/-1"><span>Dirección</span><strong>${esc(client.address || '—')}</strong></div>
            </div>
            ${client.notes ? `<div class="divider"></div><div class="info-item"><span>Notas</span><strong style="font-weight:450;line-height:1.55">${esc(client.notes)}</strong></div>` : ''}
          </div>
        </section>

        ${
          overdue.length
            ? `<section class="card"><div class="card-body">
                <div class="alert alert--danger">${icon('alert', 16)}<div><strong>${overdue.length} préstamo${overdue.length === 1 ? '' : 's'} en mora.</strong><br />${money(stats.lateDue)} de mora acumulada. ${nextDue ? `La próxima cuota vence el ${formatDate(nextDue.row.dueDate, 'medium')}.` : ''}</div></div>
              </div></section>`
            : `<section class="card"><div class="card-body">
                <div class="alert alert--success">${icon('shield', 16)}<div><strong>Cliente al día.</strong><br />${nextDue ? `Próximo vencimiento: ${formatDate(nextDue.row.dueDate, 'medium')} por ${money(nextDue.row.remaining)}.` : 'Sin cuotas pendientes.'}</div></div>
              </div></section>`
        }
      </div>
    </div>

    <section class="card">
      <div class="card-head">
        <div class="card-heading">
          <h3 class="card-title">Historial de pagos</h3>
          <span class="card-sub">${payments.length} pago${payments.length === 1 ? '' : 's'} · ${money(round2(sum(payments, (p) => p.amount)))} cobrados</span>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-all-payments>Ver todos ${icon('chevron-right', 14)}</button>
      </div>
      ${
        payments.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Recibo</th><th>Fecha</th><th>Préstamo</th><th class="num">Monto</th><th>Método</th><th>Nota</th><th></th></tr></thead>
              <tbody>
                ${payments
                  .slice(0, 8)
                  .map((payment) => {
                    const loan = loans.find((l) => l.id === payment.loanId);
                    return `<tr>
                      <td class="cell-strong">${esc(payment.receipt)}</td>
                      <td>${formatDate(payment.date, 'medium')}</td>
                      <td>${esc(loan?.code || '—')}</td>
                      <td class="num money money--income">${money(payment.amount)}</td>
                      <td>${esc(payment.method || '—')}</td>
                      <td class="muted" style="max-width:220px">${esc(payment.note || '—')}</td>
                      <td><div class="cell-actions"><button class="btn btn-icon btn-ghost btn-sm" type="button" data-receipt="${payment.id}" title="Ver recibo">${icon('eye', 15)}</button></div></td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table></div>`
          : `<div class="card-body">${emptyState({ title: 'Sin pagos registrados', text: 'Los cobros de este cliente aparecerán aquí.', iconName: 'receipt', compact: true })}</div>`
      }
    </section>
  </div>`;

  root.querySelector<HTMLElement>('[data-back]')!.addEventListener('click', () => navigate('clients'));
  root.querySelectorAll<HTMLElement>('[data-new-loan]').forEach((btn) => btn.addEventListener('click', () => actions.openLoanForm({ clientId: client.id })));
  root.querySelector<HTMLElement>('[data-edit]')!.addEventListener('click', () => actions.openClientForm({ clientId: client.id }));
  root.querySelector<HTMLElement>('[data-delete]')!.addEventListener('click', () => actions.deleteClientFlow(client));
  root.querySelector<HTMLElement>('[data-all-payments]')!.addEventListener('click', () => navigate('payments'));
  const payBtn = root.querySelector<HTMLElement>('[data-new-payment]')!;
  if (payBtn) {
    payBtn.addEventListener('click', () => actions.openPaymentModal({ clientId: client.id }));
  }
  root.querySelectorAll<HTMLElement>('[data-loan]').forEach((el) => el.addEventListener('click', () => navigate(`loan/${el.dataset.loan || ''}`)));
  root.querySelectorAll<HTMLElement>('[data-receipt]').forEach((el) => el.addEventListener('click', () => actions.openReceipt(el.dataset.receipt || '')));
}
