/* Cobros: historial de pagos recibidos */

import { state, loanViews, client as getClient } from '../lib/store.js';
import {
  money,
  num,
  round2,
  sum,
  formatDate,
  todayISO,
  addDaysISO,
  addMonthsISO,
  PAYMENT_METHODS,
} from '../finance.js';
import {
  icon,
  esc,
  avatar,
  badge,
  emptyState,
  pagination,
} from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import * as actions from '../actions.js';
import type { ViewContext } from '../types.js';

interface PaymentsFilters {
  query: string;
  range: string;
  method: string;
  page: number;
}

interface RangeBounds {
  from: string;
  to: string;
  label: string;
}

const filters: PaymentsFilters = { query: '', range: 'month', method: 'all', page: 1 };
const PAGE_SIZE = 12;

function rangeBounds(range: string): RangeBounds {
  const today = todayISO();
  const monthStart = `${today.slice(0, 8)}01`;
  switch (range) {
    case 'today':
      return { from: today, to: today, label: 'Hoy' };
    case 'week':
      return { from: addDaysISO(today, -6), to: today, label: 'Últimos 7 días' };
    case 'prev': {
      const start = addMonthsISO(monthStart, -1);
      const end = addDaysISO(monthStart, -1);
      return { from: start, to: end, label: 'Mes anterior' };
    }
    case '90':
      return { from: addDaysISO(today, -89), to: today, label: 'Últimos 90 días' };
    case 'all':
      return { from: '', to: '', label: 'Todo el historial' };
    case 'month':
    default:
      return { from: monthStart, to: today, label: 'Este mes' };
  }
}

export function render(root: HTMLElement, ctx: ViewContext): void {
  const bounds = rangeBounds(filters.range);
  const all = [...state.db.payments].sort(
    (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  );

  const filtered = () => {
    const query = filters.query.trim().toLowerCase();
    return all.filter((payment) => {
      if (bounds.from && payment.date < bounds.from) return false;
      if (bounds.to && payment.date > bounds.to) return false;
      if (filters.method !== 'all' && payment.method !== filters.method) return false;
      if (!query) return true;
      const client = getClient(payment.clientId);
      const loan = state.db.loans.find((l) => l.id === payment.loanId);
      return [payment.receipt, payment.note, payment.method, client?.name, loan?.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  };

  const list = filtered();
  const total = round2(sum(list, (p) => p.amount));
  const average = list.length ? round2(total / list.length) : 0;
  const methods = [...new Set(all.map((p) => p.method).filter(Boolean))];

  root.innerHTML = `<div class="page">
    <div class="summary-strip mb-2">
      <div><span>Cobrado · ${esc(bounds.label)}</span><strong class="money--income">${money(total)}</strong></div>
      <div><span>Pagos registrados</span><strong>${list.length}</strong></div>
      <div><span>Promedio por pago</span><strong>${money(average)}</strong></div>
      <div><span>Total histórico</span><strong>${money(round2(sum(all, (p) => p.amount)))}</strong></div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        ${icon('search', 17)}
        <input type="search" id="payment-search" placeholder="Buscar recibo, cliente o préstamo…" value="${esc(filters.query)}" autocomplete="off" />
      </div>
      <select class="select-inline" id="payment-range" aria-label="Período">
        ${[
          ['today', 'Hoy'],
          ['week', 'Últimos 7 días'],
          ['month', 'Este mes'],
          ['prev', 'Mes anterior'],
          ['90', 'Últimos 90 días'],
          ['all', 'Todo el historial'],
        ]
          .map(([value, label]) => `<option value="${value}" ${filters.range === value ? 'selected' : ''}>${label}</option>`)
          .join('')}
      </select>
      <select class="select-inline" id="payment-method" aria-label="Método">
        <option value="all">Todos los métodos</option>
        ${methods.map((method) => `<option value="${esc(method)}" ${filters.method === method ? 'selected' : ''}>${esc(method)}</option>`).join('')}
      </select>
      <div class="toolbar-spacer"></div>
      <button class="btn btn-outline btn-sm" type="button" data-export>${icon('download', 15)} Exportar</button>
      <button class="btn btn-primary" type="button" data-new-payment>${icon('plus', 16)} Registrar pago</button>
    </div>

    <div class="card">
      ${
        list.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr>
                <th>Recibo</th><th>Fecha</th><th>Cliente</th><th>Préstamo</th><th class="num">Monto</th><th>Método</th><th>Cuenta</th><th></th>
              </tr></thead>
              <tbody>
                ${list
                  .slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE)
                  .map((payment) => {
                    const client = getClient(payment.clientId);
                    const loan = state.db.loans.find((l) => l.id === payment.loanId);
                    const account = state.db.accounts.find((a) => a.id === payment.accountId);
                    return `<tr>
                      <td><div class="cell-stack"><strong>${esc(payment.receipt)}</strong><span>${formatDate(payment.date, 'short')}</span></div></td>
                      <td>${formatDate(payment.date, 'medium')}</td>
                      <td><div class="cell-main">${avatar(client?.name || '?', 30)}<div class="cell-stack"><strong>${esc(client?.name || '—')}</strong><span>${esc(client?.phone || '')}</span></div></div></td>
                      <td><button class="link-btn" type="button" data-loan="${loan?.id || ''}">${esc(loan?.code || '—')}</button></td>
                      <td class="num money money--income">${money(payment.amount)}</td>
                      <td>${badge(payment.method || '—', 'muted')}</td>
                      <td>${esc(account?.name || '—')}</td>
                      <td><div class="cell-actions">
                        <button class="btn btn-icon btn-ghost btn-sm" type="button" data-receipt="${payment.id}" title="Ver recibo">${icon('eye', 15)}</button>
                        <button class="btn btn-icon btn-ghost btn-sm" type="button" data-edit="${payment.id}" title="Editar pago">${icon('edit', 15)}</button>
                        <button class="btn btn-icon btn-ghost btn-sm" type="button" data-delete="${payment.id}" title="Eliminar pago">${icon('trash', 15)}</button>
                      </div></td>
                    </tr>`;
                  })
                  .join('')}
              </tbody>
            </table></div>
            ${pagination({ page: filters.page, totalPages: Math.ceil(list.length / PAGE_SIZE), total: list.length, label: 'pagos' })}`
          : `<div class="card-body">${emptyState({
              title: all.length ? 'Sin pagos en este período' : 'Aún no hay cobros registrados',
              text: all.length
                ? 'Cambia el rango de fechas o el método de pago para ver más resultados.'
                : 'Cuando registres un pago desde un préstamo, aparecerá aquí con su recibo.',
              iconName: 'receipt',
              action: `<button class="btn btn-primary" type="button" data-new-payment>${icon('plus', 16)} Registrar pago</button>`,
            })}</div>`
      }
    </div>
  </div>`;

  const paint = (): void => render(root, ctx);

  root.querySelector<HTMLInputElement>('#payment-search')!.addEventListener('input', (event) => {
    filters.query = (event.target as HTMLInputElement).value;
    filters.page = 1;
    paint();
  });
  root.querySelector<HTMLSelectElement>('#payment-range')!.addEventListener('change', (event) => {
    filters.range = (event.target as HTMLSelectElement).value;
    filters.page = 1;
    paint();
  });
  root.querySelector<HTMLSelectElement>('#payment-method')!.addEventListener('change', (event) => {
    filters.method = (event.target as HTMLSelectElement).value;
    filters.page = 1;
    paint();
  });
  root.querySelectorAll<HTMLElement>('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.page = Math.max(1, Number(btn.dataset.page));
      paint();
    });
  });
  root.querySelector<HTMLElement>('[data-new-payment]')!.addEventListener('click', () => actions.openPaymentModal());
  root.querySelector<HTMLElement>('[data-export]')!.addEventListener('click', () => {
    actions.exportCSV({
      filename: 'cobros.csv',
      title: 'Exportar cobros',
      headers: ['Recibo', 'Fecha', 'Cliente', 'Préstamo', 'Monto', 'Método', 'Cuenta', 'Nota'],
      rows: list.map((payment) => {
        const client = getClient(payment.clientId);
        const loan = state.db.loans.find((l) => l.id === payment.loanId);
        const account = state.db.accounts.find((a) => a.id === payment.accountId);
        return [payment.receipt, payment.date, client?.name || '', loan?.code || '', payment.amount, payment.method || '', account?.name || '', payment.note || ''];
      }),
    });
  });
  root.querySelectorAll<HTMLElement>('[data-receipt]').forEach((btn) => btn.addEventListener('click', () => actions.openReceipt(btn.dataset.receipt || '')));
  root.querySelectorAll<HTMLElement>('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payment = state.db.payments.find((p) => p.id === btn.dataset.edit);
      if (payment) actions.openPaymentEdit(payment);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payment = state.db.payments.find((p) => p.id === btn.dataset.delete);
      if (payment) actions.deletePaymentFlow(payment);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-loan]').forEach((btn) => {
    if (btn.dataset.loan) btn.addEventListener('click', () => navigate(`loan/${btn.dataset.loan}`));
  });
}
