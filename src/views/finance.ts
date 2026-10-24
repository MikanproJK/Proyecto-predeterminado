/* Finanzas: caja, movimientos, cuentas y categorías */

import {
  state,
  accountBalances,
  addCategory,
  removeCategory,
} from '../lib/store.js';
import {
  money,
  round2,
  sum,
  formatDate,
  todayISO,
  addDaysISO,
  addMonthsISO,
  transactionsSummary,
} from '../finance.js';
import {
  icon,
  esc,
  badge,
  emptyState,
  tabs,
  pagination,
  confirmDialog,
  toast,
} from '../lib/ui.js';
import * as actions from '../actions.js';
import type { ViewContext } from '../types.js';

interface FinanceFilters {
  tab: string;
  query: string;
  type: string;
  account: string;
  range: string;
  page: number;
}

interface RangeBounds {
  from: string;
  to: string;
  label: string;
}

const filters: FinanceFilters = { tab: 'movements', query: '', type: 'all', account: 'all', range: 'month', page: 1 };
const PAGE_SIZE = 14;

function rangeBounds(range: string): RangeBounds {
  const today = todayISO();
  const monthStart = `${today.slice(0, 8)}01`;
  switch (range) {
    case 'week':
      return { from: addDaysISO(today, -6), to: today, label: 'Últimos 7 días' };
    case 'prev': {
      const start = addMonthsISO(monthStart, -1);
      const end = addDaysISO(monthStart, -1);
      return { from: start, to: end, label: 'Mes anterior' };
    }
    case '90':
      return { from: addDaysISO(today, -89), to: today, label: 'Últimos 90 días' };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today, label: 'Este año' };
    case 'all':
      return { from: '', to: '', label: 'Todo el historial' };
    case 'month':
    default:
      return { from: monthStart, to: today, label: 'Este mes' };
  }
}

const ACCOUNT_ICONS: Record<string, string> = { cash: 'cash', bank: 'bank', wallet: 'wallet', card: 'credit-card', other: 'wallet' };
const ACCOUNT_LABELS: Record<string, string> = { cash: 'Efectivo', bank: 'Banco', wallet: 'Billetera', card: 'Tarjeta', other: 'Otra' };

export function render(root: HTMLElement, ctx: ViewContext): void {
  const searchEl = document.activeElement as HTMLInputElement | null;
  const restoreSearch = !!searchEl && searchEl.id === 'finance-search';
  const caret = restoreSearch && searchEl ? searchEl.selectionStart : null;

  const bounds = rangeBounds(filters.range);
  const accounts = accountBalances();
  const balance = round2(sum(accounts, (account) => account.balance));
  const rangeTx = state.db.transactions.filter((t) => {
    if (bounds.from && t.date < bounds.from) return false;
    if (bounds.to && t.date > bounds.to) return false;
    return true;
  });
  const summary = transactionsSummary(rangeTx);

  const accountName = (id: string | null | undefined): string => state.db.accounts.find((a) => a.id === id)?.name || '—';
  const accountOptionsHtml = state.db.accounts
    .map((account) => `<option value="${esc(account.id)}" ${filters.account === account.id ? 'selected' : ''}>${esc(account.name)}</option>`)
    .join('');

  const filtered = () => {
    const query = filters.query.trim().toLowerCase();
    return state.db.transactions
      .filter((tx) => {
        if (bounds.from && tx.date < bounds.from) return false;
        if (bounds.to && tx.date > bounds.to) return false;
        if (filters.type !== 'all' && tx.type !== filters.type) return false;
        if (filters.account !== 'all' && tx.accountId !== filters.account && tx.toAccountId !== filters.account) return false;
        if (!query) return true;
        return [tx.description, tx.category, tx.type, accountName(tx.accountId), accountName(tx.toAccountId), String(tx.amount)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  };

  const list = filtered();
  const listIncome = round2(sum(list.filter((t) => t.type === 'income'), (t) => t.amount));
  const listExpense = round2(sum(list.filter((t) => t.type === 'expense'), (t) => t.amount));

  const accountCards = accounts
    .map(
      (account) => `<article class="account-card">
        <span class="account-icon account-icon--${esc(account.type || 'other')}">${icon(ACCOUNT_ICONS[account.type] || 'wallet', 18)}</span>
        <div class="account-main">
          <strong>${esc(account.name)}</strong>
          <span>${esc(ACCOUNT_LABELS[account.type] || 'Cuenta')} · inicial ${money(account.openingBalance)}</span>
        </div>
        <div class="account-balance">${money(account.balance)}</div>
        <div class="cell-actions" style="opacity:1">
          <button class="btn btn-icon btn-ghost btn-sm" type="button" data-account-edit="${account.id}" title="Editar cuenta">${icon('edit', 14)}</button>
          <button class="btn btn-icon btn-ghost btn-sm" type="button" data-account-delete="${account.id}" title="Eliminar cuenta">${icon('trash', 14)}</button>
        </div>
      </article>`,
    )
    .join('');

  const accountStrip = `<div class="account-strip mb-2">
    ${accountCards}
    <button class="account-add" type="button" data-account-new>${icon('plus', 17)}<span>Nueva cuenta</span></button>
  </div>`;

  const movementsHtml = `<div class="card">
    <div class="card-head" style="padding-bottom:14px">
      <div class="card-heading">
        <h3 class="card-title">Movimientos de caja</h3>
        <span class="card-sub">${esc(bounds.label)} · ${list.length} movimiento${list.length === 1 ? '' : 's'}</span>
      </div>
      <div class="row-inline" style="gap:14px">
        <span class="inline-metric"><span>Ingresos</span><strong class="money--income">${money(listIncome)}</strong></span>
        <span class="inline-metric"><span>Egresos</span><strong class="money--expense">${money(listExpense)}</strong></span>
        <span class="inline-metric"><span>Neto</span><strong>${money(round2(listIncome - listExpense))}</strong></span>
      </div>
    </div>
    <div class="toolbar" style="padding:0 20px">
      <div class="search-box">
        ${icon('search', 17)}
        <input type="search" id="finance-search" placeholder="Buscar movimiento, categoría, monto…" value="${esc(filters.query)}" autocomplete="off" />
      </div>
      <div class="chip-row" id="finance-chips">
        ${[
          ['all', 'Todos'],
          ['income', 'Ingresos'],
          ['expense', 'Egresos'],
          ['transfer', 'Transferencias'],
        ]
          .map(
            ([value, label]) =>
              `<button type="button" class="chip ${filters.type === value ? 'is-active' : ''}" data-type="${value}">${label}</button>`,
          )
          .join('')}
      </div>
      <select class="select-inline" id="finance-account">
        <option value="all">Todas las cuentas</option>
        ${accountOptionsHtml}
      </select>
      <select class="select-inline" id="finance-range">
        ${[
          ['month', 'Este mes'],
          ['prev', 'Mes anterior'],
          ['week', 'Últimos 7 días'],
          ['90', 'Últimos 90 días'],
          ['year', 'Este año'],
          ['all', 'Todo'],
        ]
          .map(([value, label]) => `<option value="${value}" ${filters.range === value ? 'selected' : ''}>${label}</option>`)
          .join('')}
      </select>
    </div>
    ${
      list.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Fecha</th><th>Movimiento</th><th>Cuenta</th><th>Tipo</th><th class="num">Monto</th><th></th></tr></thead>
            <tbody>
              ${list
                .slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE)
                .map((tx) => {
                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';
                  const typeBadge = isTransfer
                    ? badge('Transferencia', 'info')
                    : isIncome
                      ? badge('Ingreso', 'success')
                      : badge('Egreso', 'danger');
                  return `<tr>
                    <td><div class="cell-stack"><strong>${formatDate(tx.date, 'medium')}</strong><span>${esc(tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '')}</span></div></td>
                    <td><div class="cell-main">
                      <span class="list-icon ${isTransfer ? 'list-icon--info' : isIncome ? 'list-icon--income' : 'list-icon--expense'}" style="width:30px;height:30px;border-radius:9px">${icon(isTransfer ? 'refresh' : isIncome ? 'arrow-up-right' : 'arrow-down-left', 15)}</span>
                      <div class="cell-stack"><strong>${esc(tx.description || tx.category)}</strong><span>${esc(tx.category)}${tx.auto ? ' · automático' : ''}</span></div>
                    </div></td>
                    <td>${isTransfer ? `${esc(accountName(tx.accountId))} <span class="muted">→</span> ${esc(accountName(tx.toAccountId))}` : esc(accountName(tx.accountId))}</td>
                    <td>${typeBadge}</td>
                    <td class="num money ${isTransfer ? '' : isIncome ? 'money--income' : 'money--expense'}">${isTransfer ? '' : isIncome ? '+' : '−'}${money(tx.amount)}</td>
                    <td><div class="cell-actions">
                      ${
                        tx.auto
                          ? `<span class="tag" title="Vinculado a un pago o préstamo">${icon('lock', 12)} Auto</span>`
                          : `<button class="btn btn-icon btn-ghost btn-sm" type="button" data-tx-edit="${tx.id}" title="Editar">${icon('edit', 15)}</button>
                             <button class="btn btn-icon btn-ghost btn-sm" type="button" data-tx-delete="${tx.id}" title="Eliminar">${icon('trash', 15)}</button>`
                      }
                    </div></td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table></div>
          ${pagination({ page: filters.page, totalPages: Math.ceil(list.length / PAGE_SIZE), total: list.length, label: 'movimientos' })}`
        : `<div class="card-body">${emptyState({
            title: 'Sin movimientos',
            text: 'Registra un ingreso, un egreso o una transferencia para comenzar.',
            iconName: 'wallet',
            action: `<button class="btn btn-primary" type="button" data-new-tx>${icon('plus', 16)} Nuevo movimiento</button>`,
          })}</div>`
    }
  </div>`;

  const categoriesHtml = (kind: 'income' | 'expense'): string => {
    const items = state.db.categories[kind] || [];
    return `<div class="cat-column">
      <h4>${kind === 'income' ? 'Categorías de ingreso' : 'Categorías de egreso'}</h4>
      <div class="cat-list">
        ${items
          .map((cat) => {
            const usage = state.db.transactions.filter((t) => t.category === cat).length;
            return `<div class="cat-item">
              <span>${esc(cat)}</span>
              <span class="cat-count">${usage}</span>
              <button class="btn btn-icon btn-ghost btn-sm" type="button" data-cat-remove="${esc(cat)}" data-kind="${kind}" title="Quitar categoría">${icon('x', 12)}</button>
            </div>`;
          })
          .join('')}
      </div>
      <form class="cat-add" data-cat-form="${kind}">
        <input class="input" name="name" placeholder="Nueva categoría" autocomplete="off" />
        <button class="btn btn-soft btn-sm" type="submit">${icon('plus', 14)}</button>
      </form>
    </div>`;
  };

  const accountsHtml = `<div class="grid grid-main">
    <section class="card">
      <div class="card-head">
        <div class="card-heading">
          <h3 class="card-title">Cuentas</h3>
          <span class="card-sub">Saldos calculados con todos los movimientos</span>
        </div>
        <button class="btn btn-soft btn-sm" type="button" data-account-new>${icon('plus', 14)} Nueva cuenta</button>
      </div>
      <div class="card-body">
        <div class="stack" style="gap:9px">
          ${accounts
            .map(
              (account) => `<div class="account-card">
                <span class="account-icon account-icon--${esc(account.type || 'other')}">${icon(ACCOUNT_ICONS[account.type] || 'wallet', 18)}</span>
                <div class="account-main">
                  <strong>${esc(account.name)}</strong>
                  <span>${esc(ACCOUNT_LABELS[account.type] || 'Cuenta')} · saldo inicial ${money(account.openingBalance)}</span>
                </div>
                <div class="account-balance">${money(account.balance)}</div>
                <div class="cell-actions" style="opacity:1">
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-account-edit="${account.id}" title="Editar">${icon('edit', 14)}</button>
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-account-delete="${account.id}" title="Eliminar">${icon('trash', 14)}</button>
                </div>
              </div>`,
            )
            .join('')}
        </div>
        <div class="divider"></div>
        <div class="summary-strip" style="box-shadow:none">
          <div><span>Balance total</span><strong>${money(balance)}</strong></div>
          <div><span>Cuentas</span><strong>${accounts.length}</strong></div>
          <div><span>Movimientos</span><strong>${state.db.transactions.length}</strong></div>
        </div>
      </div>
    </section>
    <section class="card">
      <div class="card-head">
        <div class="card-heading">
          <h3 class="card-title">Categorías</h3>
          <span class="card-sub">Organiza tus ingresos y egresos</span>
        </div>
      </div>
      <div class="card-body">
        <div class="cat-columns">
          ${categoriesHtml('income')}
          ${categoriesHtml('expense')}
        </div>
      </div>
    </section>
  </div>`;

  root.innerHTML = `<div class="page">
    <div class="summary-strip mb-2">
      <div><span>Balance total</span><strong>${money(balance)}</strong></div>
      <div><span>Ingresos · ${esc(bounds.label)}</span><strong class="money--income">${money(summary.income)}</strong></div>
      <div><span>Egresos · ${esc(bounds.label)}</span><strong class="money--expense">${money(summary.expense)}</strong></div>
      <div><span>Resultado</span><strong class="${summary.net >= 0 ? 'money--income' : 'money--expense'}">${money(summary.net)}</strong></div>
    </div>

    ${accountStrip}

    <div class="row-inline justify-between mb-2" style="flex-wrap:wrap;gap:10px">
      ${tabs(
        [
          { value: 'movements', label: 'Movimientos', icon: 'wallet' },
          { value: 'accounts', label: 'Cuentas y categorías', icon: 'bank' },
        ],
        filters.tab,
      )}
      <div class="row-inline" style="gap:8px">
        <button class="btn btn-outline btn-sm" type="button" data-transfer>${icon('refresh', 15)} Transferir</button>
        <button class="btn btn-primary" type="button" data-new-tx>${icon('plus', 16)} Nuevo movimiento</button>
      </div>
    </div>

    ${filters.tab === 'accounts' ? accountsHtml : movementsHtml}
  </div>`;

  root.querySelectorAll<HTMLElement>('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      filters.tab = tab.dataset.tab || 'movements';
      render(root, ctx);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-new-tx]').forEach((btn) => btn.addEventListener('click', () => actions.openTransactionModal()));
  root.querySelector<HTMLElement>('[data-transfer]')!.addEventListener('click', () => actions.openTransactionModal({ type: 'transfer' }));
  root.querySelectorAll<HTMLElement>('[data-account-new]').forEach((btn) => btn.addEventListener('click', () => actions.openAccountForm()));
  root.querySelectorAll<HTMLElement>('[data-account-edit]').forEach((btn) => {
    btn.addEventListener('click', () => actions.openAccountForm({ accountId: btn.dataset.accountEdit }));
  });
  root.querySelectorAll<HTMLElement>('[data-account-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const account = state.db.accounts.find((a) => a.id === btn.dataset.accountDelete);
      if (account) actions.deleteAccountFlow(account);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-tx-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = state.db.transactions.find((t) => t.id === btn.dataset.txEdit);
      if (tx) actions.openTransactionEdit(tx);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-tx-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = state.db.transactions.find((t) => t.id === btn.dataset.txDelete);
      if (tx) actions.deleteTransactionFlow(tx);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-cat-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Quitar categoría',
        message: `¿Quitar “${btn.dataset.catRemove}” de la lista?`,
        detail: 'Los movimientos existentes conservarán su categoría actual.',
        confirmLabel: 'Quitar',
      });
      if (ok) {
        removeCategory(btn.dataset.kind || 'expense', btn.dataset.catRemove || '');
        toast('Categoría eliminada.', 'success');
      }
    });
  });
  root.querySelectorAll<HTMLElement>('[data-cat-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector<HTMLInputElement>('[name="name"]')!;
      try {
        addCategory(form.dataset.catForm || 'expense', input.value);
        toast('Categoría agregada.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  if (filters.tab === 'movements') {
    const search = root.querySelector<HTMLInputElement>('#finance-search')!;
    if (search) {
      search.addEventListener('input', (event) => {
        filters.query = (event.target as HTMLInputElement).value;
        filters.page = 1;
        render(root, ctx);
      });
    }
    root.querySelectorAll<HTMLElement>('[data-type]').forEach((chip) => {
      chip.addEventListener('click', () => {
        filters.type = chip.dataset.type || 'all';
        filters.page = 1;
        render(root, ctx);
      });
    });
    root.querySelector<HTMLSelectElement>('#finance-account')!.addEventListener('change', (event) => {
      filters.account = (event.target as HTMLSelectElement).value;
      filters.page = 1;
      render(root, ctx);
    });
    root.querySelector<HTMLSelectElement>('#finance-range')!.addEventListener('change', (event) => {
      filters.range = (event.target as HTMLSelectElement).value;
      filters.page = 1;
      render(root, ctx);
    });
    root.querySelectorAll<HTMLElement>('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filters.page = Math.max(1, Number(btn.dataset.page));
        render(root, ctx);
      });
    });
    if (restoreSearch && caret !== null) {
      const el = root.querySelector<HTMLInputElement>('#finance-search')!;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    }
  }
}
