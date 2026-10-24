/* Préstamos: cartera y detalle del crédito */

import { state, loanViews, portfolioSummary, paymentsFor, client as getClient } from '../lib/store.js';
import {
  money,
  num,
  round2,
  sum,
  formatDate,
  loanStateMeta,
  todayISO,
  daysBetween,
  FREQUENCIES,
  AMORTIZATIONS,
  RATE_TYPES,
  LATE_FEE_TYPES,
} from '../finance.js';
import {
  icon,
  esc,
  avatar,
  badge,
  emptyState,
  progressBar,
  segmented,
} from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import * as actions from '../actions.js';

const filters = { query: '', state: 'all', mode: 'cards' };

function stateLabel(row) {
  switch (row.state) {
    case 'paid':
      return ['Pagada', 'success'];
    case 'overdue':
      return ['Vencida', 'danger'];
    case 'partial_overdue':
      return ['Abono parcial', 'warning'];
    case 'partial':
      return ['Abonada', 'warning'];
    case 'late':
      return ['Mora pendiente', 'danger'];
    default:
      return ['Pendiente', 'muted'];
  }
}

function nextRow(loan) {
  return loan.rows.find((row) => row.remaining > 0.004) || null;
}

export function render(root, ctx) {
  if (ctx.id) {
    renderDetail(root, ctx);
    return;
  }

  const views = loanViews();
  const summary = portfolioSummary(views);
  const counts = {
    all: views.length,
    active: views.filter((l) => l.state === 'active').length,
    overdue: views.filter((l) => l.state === 'overdue').length,
    paid: views.filter((l) => l.state === 'paid').length,
    cancelled: views.filter((l) => l.state === 'cancelled').length,
  };

  const filtered = () => {
    const query = filters.query.trim().toLowerCase();
    return views
      .filter((loan) => {
        if (filters.state !== 'all' && loan.state !== filters.state) return false;
        if (!query) return true;
        const client = getClient(loan.clientId);
        return [loan.code, client?.name, loan.notes, loan.guarantee]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const rank = (state) => (state === 'overdue' ? 0 : state === 'active' ? 1 : state === 'paid' ? 2 : 3);
        return rank(a.state) - rank(b.state) || String(b.startDate).localeCompare(String(a.startDate));
      });
  };

  const chips = [
    { value: 'all', label: 'Todos', count: counts.all },
    { value: 'active', label: 'Al día', count: counts.active },
    { value: 'overdue', label: 'En mora', count: counts.overdue },
    { value: 'paid', label: 'Pagados', count: counts.paid },
    { value: 'cancelled', label: 'Cancelados', count: counts.cancelled },
  ];

  root.innerHTML = `<div class="page">
    <div class="summary-strip mb-2">
      <div><span>Cartera por cobrar</span><strong>${money(summary.outstanding)}</strong></div>
      <div><span>Capital prestado</span><strong>${money(summary.principal)}</strong></div>
      <div><span>Total cobrado</span><strong class="money--income">${money(summary.paid)}</strong></div>
      <div><span>Mora acumulada</span><strong class="${summary.lateDue > 0 ? 'money--danger' : ''}">${money(summary.lateDue)}</strong></div>
      <div><span>Créditos activos</span><strong>${summary.activeCount + summary.overdueCount}</strong></div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        ${icon('search', 17)}
        <input type="search" id="loan-search" placeholder="Buscar por código, cliente o nota…" value="${esc(filters.query)}" autocomplete="off" />
      </div>
      <div class="chip-row" id="loan-chips">
        ${chips
          .map(
            (chip) => `<button type="button" class="chip ${filters.state === chip.value ? 'is-active' : ''}" data-chip="${chip.value}">
              ${esc(chip.label)} <span class="chip-count">${chip.count}</span>
            </button>`,
          )
          .join('')}
      </div>
      <div class="toolbar-spacer"></div>
      <div class="toolbar-group">
        ${segmented(
          [
            { value: 'cards', label: 'Tarjetas', icon: 'dashboard' },
            { value: 'table', label: 'Tabla', icon: 'file-text' },
          ],
          filters.mode,
          'loan-mode',
        )}
        <button class="btn btn-outline btn-sm" type="button" data-export>${icon('download', 15)} Exportar</button>
        <button class="btn btn-primary" type="button" data-new-loan>${icon('plus', 16)} Nuevo préstamo</button>
      </div>
    </div>

    <div id="loans-content"></div>
  </div>`;

  const content = root.querySelector('#loans-content');

  const paint = () => {
    const list = filtered();
    if (!state.db.loans.length) {
      content.innerHTML = `<div class="card"><div class="card-body">${emptyState({
        title: 'Aún no hay préstamos',
        text: 'Crea tu primer crédito y genera automáticamente el plan de pagos con la modalidad que prefieras.',
        iconName: 'credit-card',
        action: `<button class="btn btn-primary" type="button" data-new-loan>${icon('plus', 16)} Crear préstamo</button>`,
      })}</div></div>`;
    } else if (!list.length) {
      content.innerHTML = `<div class="card"><div class="card-body">${emptyState({
        title: 'Sin préstamos con ese filtro',
        text: 'Prueba con otro estado o término de búsqueda.',
        iconName: 'filter',
        action: `<button class="btn btn-outline" type="button" data-clear>Limpiar filtros</button>`,
      })}</div></div>`;
    } else if (filters.mode === 'table') {
      content.innerHTML = `<div class="card"><div class="table-wrap"><table class="table">
        <thead><tr>
          <th>Préstamo</th><th>Cliente</th><th class="num">Capital</th><th class="num">Saldo</th><th class="num">Mora</th><th>Próximo vencimiento</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>
          ${list
            .map((loan) => {
              const client = getClient(loan.clientId);
              const next = nextRow(loan);
              return `<tr class="is-clickable" data-loan="${loan.id}">
                <td><div class="cell-stack"><strong>${esc(loan.code)}</strong><span>${loan.installments} cuotas · ${esc(FREQUENCIES.find((f) => f.value === loan.frequency)?.label || '')}</span></div></td>
                <td><div class="cell-main">${avatar(client?.name || '?', 30)}<span class="cell-strong">${esc(client?.name || '—')}</span></div></td>
                <td class="num money">${money(loan.totals.principal)}</td>
                <td class="num money">${money(loan.totals.balance)}</td>
                <td class="num money ${loan.totals.lateDue > 0 ? 'money--danger' : 'money--muted'}">${money(loan.totals.lateDue)}</td>
                <td>${next ? `${formatDate(next.dueDate, 'medium')}<div class="tiny muted">${money(next.remaining)}</div>` : '<span class="muted">—</span>'}</td>
                <td>${badge(loanStateMeta(loan.state).label, loanStateMeta(loan.state).tone, { dot: true })}</td>
                <td><div class="cell-actions">
                  ${['active', 'overdue'].includes(loan.state) ? `<button class="btn btn-icon btn-ghost btn-sm" type="button" data-pay="${loan.id}" title="Registrar pago">${icon('receipt', 15)}</button>` : ''}
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-edit="${loan.id}" title="Editar">${icon('edit', 15)}</button>
                </div></td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table></div>
      <div class="table-foot"><span>${list.length} préstamo${list.length === 1 ? '' : 's'}</span><span>${money(round2(sum(list, (l) => l.totals.balance)))} por cobrar</span></div>
      </div>`;
    } else {
      content.innerHTML = `<div class="loan-grid">
        ${list
          .map((loan) => {
            const client = getClient(loan.clientId);
            const next = nextRow(loan);
            const overdue = loan.state === 'overdue';
            return `<article class="loan-card" data-loan="${loan.id}">
              <div class="loan-card-head">
                <div class="loan-card-client">
                  ${avatar(client?.name || '?', 38)}
                  <div style="min-width:0">
                    <strong>${esc(client?.name || 'Cliente')}</strong>
                    <span>${esc(loan.code)} · ${loan.installments} cuotas</span>
                  </div>
                </div>
                ${badge(loanStateMeta(loan.state).label, loanStateMeta(loan.state).tone, { dot: true })}
              </div>
              <div class="loan-card-amount">
                <strong>${money(loan.totals.balance)}</strong>
                <span>saldo de ${money(loan.totals.toPay)}</span>
              </div>
              ${progressBar(loan.totals.progress, overdue ? 'danger' : loan.state === 'paid' ? 'success' : 'primary', {
                thin: true,
                label: `${Math.round(loan.totals.progress * 100)}% pagado`,
              })}
              <div class="loan-card-meta">
                <span>${next ? `Cuota ${money(next.remaining)}` : 'Crédito completado'}</span>
                <span>${next ? formatDate(next.dueDate, 'medium') : '—'}</span>
              </div>
              <div class="loan-card-foot">
                <span>${loan.totals.lateDue > 0 ? badge(`Mora ${money(loan.totals.lateDue)}`, 'danger', { dot: true }) : overdue ? badge('En mora', 'danger', { dot: true }) : badge('Sin mora', 'success')}</span>
                <span>${esc(FREQUENCIES.find((f) => f.value === loan.frequency)?.label || '')} · ${num(loan.interestRate)}%</span>
              </div>
            </article>`;
          })
          .join('')}
      </div>
      <div class="table-foot" style="padding:12px 2px 0"><span>${list.length} préstamo${list.length === 1 ? '' : 's'} mostrados</span><span>${money(round2(sum(list, (l) => l.totals.balance)))} por cobrar</span></div>`;
    }
    bindContent(content);
  };

  const syncChips = () => {
    root.querySelectorAll('[data-chip]').forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.chip === filters.state);
    });
  };

  root.querySelector('#loan-search').addEventListener('input', (event) => {
    filters.query = event.target.value;
    paint();
  });
  root.querySelectorAll('[data-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      filters.state = chip.dataset.chip;
      syncChips();
      paint();
    });
  });
  root.querySelectorAll('[data-segmented="loan-mode"] [data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.mode = btn.dataset.value;
      root.querySelectorAll('[data-segmented="loan-mode"] [data-value]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.value === filters.mode);
      });
      paint();
    });
  });
  root.querySelector('[data-new-loan]').addEventListener('click', () => actions.openLoanForm());
  root.querySelector('[data-export]').addEventListener('click', () => {
    const rows = filtered().map((loan) => {
      const client = getClient(loan.clientId);
      return [
        loan.code,
        client?.name || '',
        loan.principal,
        loan.totals.balance,
        loan.totals.lateDue,
        loan.installments,
        loanStateMeta(loan.state).label,
        loan.startDate,
        loan.totals.nextDueDate || '',
      ];
    });
    actions.exportCSV({
      filename: 'prestamos.csv',
      title: 'Exportar cartera de préstamos',
      headers: ['Código', 'Cliente', 'Capital', 'Saldo', 'Mora', 'Cuotas', 'Estado', 'Fecha inicio', 'Próximo vencimiento'],
      rows,
    });
  });
  paint();

  function bindContent(scope) {
    scope.querySelectorAll('[data-loan]').forEach((el) => {
      el.addEventListener('click', () => navigate(`loan/${el.dataset.loan}`));
    });
    scope.querySelectorAll('[data-new-loan]').forEach((el) => el.addEventListener('click', () => actions.openLoanForm()));
    scope.querySelectorAll('[data-pay]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        actions.openPaymentModal({ loanId: el.dataset.pay });
      });
    });
    scope.querySelectorAll('[data-edit]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        actions.openLoanForm({ loanId: el.dataset.edit });
      });
    });
    scope.querySelectorAll('[data-clear]').forEach((el) => {
      el.addEventListener('click', () => {
        filters.query = '';
        filters.state = 'all';
        const input = root.querySelector('#loan-search');
        if (input) input.value = '';
        syncChips();
        paint();
      });
    });
  }
}

/* ============================================================
   Detalle del préstamo
   ============================================================ */

function renderDetail(root, ctx) {
  const loan = loanViews().find((item) => item.id === ctx.id);
  if (!loan) {
    root.innerHTML = `<div class="page"><div class="card"><div class="card-body">${emptyState({
      title: 'Préstamo no encontrado',
      text: 'Puede haber sido eliminado o el enlace es incorrecto.',
      iconName: 'credit-card',
      action: `<button class="btn btn-primary" type="button" data-back>${icon('arrow-left', 16)} Volver a préstamos</button>`,
    })}</div></div></div>`;
    root.querySelector('[data-back]').addEventListener('click', () => navigate('loans'));
    return;
  }

  const client = getClient(loan.clientId);
  const payments = paymentsFor(loan.id);
  const next = nextRow(loan);
  const freq = FREQUENCIES.find((f) => f.value === loan.frequency);
  const amort = AMORTIZATIONS.find((a) => a.value === loan.amortization);
  const rateBase = RATE_TYPES.find((r) => r.value === loan.rateType);
  const lateType = LATE_FEE_TYPES.find((l) => l.value === loan.lateFeeType);
  const account = state.db.accounts.find((a) => a.id === loan.accountId);
  const isCancelled = loan.state === 'cancelled';
  const active = ['active', 'overdue'].includes(loan.state);
  const status = loanStateMeta(loan.state);

  const scheduleRows = loan.rows
    .map((row) => {
      const [label, tone] = stateLabel(row);
      const overdue = row.state === 'overdue' || row.state === 'partial_overdue' || row.state === 'late';
      return `<tr class="${overdue ? 'row-warn' : ''}">
        <td class="cell-strong">${row.n}</td>
        <td>${formatDate(row.dueDate, 'medium')}${row.overdueDays > 0 ? `<div class="tiny money--danger">${row.overdueDays} días de atraso</div>` : ''}</td>
        <td class="num money">${money(row.amount)}</td>
        <td class="num money ${row.paid > 0 ? 'money--income' : 'money--muted'}">${money(row.paid)}</td>
        <td class="num">${money(row.capital)}</td>
        <td class="num">${money(row.interest)}</td>
        <td class="num ${row.lateDue > 0 ? 'money--danger' : 'money--muted'}">${money(row.lateDue)}</td>
        <td>${badge(label, tone)}</td>
      </tr>`;
    })
    .join('');

  const paymentsMarkup = payments.length
    ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Recibo</th><th>Fecha</th><th class="num">Monto</th><th>Método</th><th>Cuenta</th><th>Nota</th><th></th></tr></thead>
        <tbody>
          ${payments
            .map((payment) => {
              const payAccount = state.db.accounts.find((a) => a.id === payment.accountId);
              return `<tr>
                <td class="cell-strong">${esc(payment.receipt)}</td>
                <td>${formatDate(payment.date, 'medium')}</td>
                <td class="num money money--income">${money(payment.amount)}</td>
                <td>${esc(payment.method || '—')}</td>
                <td>${esc(payAccount?.name || '—')}</td>
                <td class="muted" style="max-width:200px">${esc(payment.note || '—')}</td>
                <td><div class="cell-actions">
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-receipt="${payment.id}" title="Ver recibo">${icon('eye', 15)}</button>
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-pay-edit="${payment.id}" title="Editar pago">${icon('edit', 15)}</button>
                  <button class="btn btn-icon btn-ghost btn-sm" type="button" data-pay-delete="${payment.id}" title="Eliminar pago">${icon('trash', 15)}</button>
                </div></td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table></div>`
    : `<div class="card-body">${emptyState({
        title: 'Sin pagos registrados',
        text: 'Registra el primer cobro para comenzar a amortizar el crédito.',
        iconName: 'receipt',
        compact: true,
        action: active ? `<button class="btn btn-primary btn-sm" type="button" data-pay>${icon('receipt', 15)} Registrar pago</button>` : '',
      })}</div>`;

  root.innerHTML = `<div class="page">
    <div class="row-inline mb-2">
      <button class="btn btn-ghost btn-sm" type="button" data-back>${icon('arrow-left', 15)} Préstamos</button>
    </div>

    <section class="card mb-2">
      <div class="detail-head">
        <div class="detail-head-main">
          ${avatar(client?.name || '?', 54, 'avatar--lg')}
          <div class="detail-head-text">
            <h2>${esc(loan.code)} ${badge(status.label, status.tone, { dot: true })}
              ${loan.totals.lateDue > 0 ? badge(`Mora ${money(loan.totals.lateDue)}`, 'danger') : ''}
            </h2>
            <p>
              <button class="link-btn" type="button" data-client>${esc(client?.name || 'Cliente')}</button>
              · ${esc(freq?.label || '')} · ${esc(amort?.label || '')} · ${num(loan.interestRate)}% ${esc(rateBase?.label?.toLowerCase() || '')}
            </p>
            <p>${icon('calendar', 13)} Entregado ${formatDate(loan.startDate, 'medium')} · ${loan.installments} cuotas de ${money(loan.rows[0]?.amount || 0)}</p>
          </div>
        </div>
        <div class="detail-head-actions">
          ${active ? `<button class="btn btn-primary" type="button" data-pay>${icon('receipt', 16)} Registrar pago</button>` : ''}
          <button class="btn btn-outline" type="button" data-edit>${icon('edit', 16)} Editar</button>
          <button class="btn btn-outline" type="button" data-contract>${icon('file-text', 16)} Contrato</button>
          ${
            isCancelled
              ? `<button class="btn btn-ghost btn-icon" type="button" data-reactivate title="Reactivar préstamo">${icon('rotate-ccw', 16)}</button>`
              : `<button class="btn btn-ghost btn-icon" type="button" data-cancel title="Cancelar préstamo">${icon('x-circle', 16)}</button>`
          }
          <button class="btn btn-ghost btn-icon" type="button" data-delete title="Eliminar préstamo">${icon('trash', 16)}</button>
        </div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><span>Capital</span><strong>${money(loan.totals.principal)}</strong></div>
        <div class="detail-stat"><span>Total a pagar</span><strong>${money(loan.totals.toPay)}</strong></div>
        <div class="detail-stat"><span>Pagado</span><strong class="money--income">${money(loan.totals.paid)}</strong></div>
        <div class="detail-stat"><span>Saldo pendiente</span><strong>${money(loan.totals.remaining)}</strong></div>
        <div class="detail-stat"><span>Mora</span><strong class="${loan.totals.lateDue > 0 ? 'money--danger' : ''}">${money(loan.totals.lateDue)}</strong></div>
        <div class="detail-stat"><span>Avance</span><strong>${Math.round(loan.totals.progress * 100)}%</strong></div>
      </div>
    </section>

    ${
      loan.totals.balance > 0.01 && !isCancelled
        ? `<section class="payoff-panel mb-2">
            <div>
              <span>Saldo para cancelar hoy</span>
              <strong>${money(loan.totals.balance)}</strong>
              <div class="payoff-breakdown" style="margin-top:6px">
                <span>Capital <b>${money(loan.totals.remainingCapital)}</b></span>
                <span>Interés <b>${money(loan.totals.remainingInterest)}</b></span>
                <span>Mora <b>${money(loan.totals.lateDue)}</b></span>
                ${loan.totals.credit > 0 ? `<span>A favor <b>${money(loan.totals.credit)}</b></span>` : ''}
              </div>
            </div>
            <div class="row-inline" style="gap:8px">
              <button class="btn btn-primary" type="button" data-pay>${icon('receipt', 16)} Cobrar ahora</button>
            </div>
          </section>`
        : ''
    }

    <div class="grid grid-main mb-2">
      <section class="card">
        <div class="card-head">
          <div class="card-heading">
            <h3 class="card-title">Plan de pagos</h3>
            <span class="card-sub">${loan.rows.filter((r) => r.state === 'paid').length} de ${loan.rows.length} cuotas pagadas · ${money(loan.totals.paid)} cobrados</span>
          </div>
          <div class="row-inline" style="gap:4px">
            <button class="btn btn-ghost btn-sm" type="button" data-export-schedule>${icon('download', 14)} CSV</button>
            <button class="btn btn-ghost btn-sm" type="button" data-contract>${icon('print', 14)} Imprimir</button>
          </div>
        </div>
        <div class="card-body" style="padding-top:12px">
          ${progressBar(loan.totals.progress, loan.state === 'overdue' ? 'danger' : loan.state === 'paid' ? 'success' : 'primary', {
            label: `${Math.round(loan.totals.progress * 100)}% del total pagado`,
          })}
        </div>
        <div class="table-wrap table-scroll">
          <table class="table">
            <thead><tr>
              <th>#</th><th>Vencimiento</th><th class="num">Cuota</th><th class="num">Pagado</th><th class="num">Capital</th><th class="num">Interés</th><th class="num">Mora</th><th>Estado</th>
            </tr></thead>
            <tbody>${scheduleRows}</tbody>
          </table>
        </div>
        <div class="table-foot">
          <span>${loan.rows.length} cuotas · ${esc(freq?.label || '')}</span>
          <span>${next ? `Próximo vencimiento ${formatDate(next.dueDate, 'medium')}` : 'Plan completado'}</span>
        </div>
      </section>

      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div class="card-heading">
              <h3 class="card-title">Condiciones</h3>
              <span class="card-sub">Términos del crédito</span>
            </div>
          </div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-item"><span>Tasa</span><strong>${num(loan.interestRate)}% ${esc(rateBase?.label?.toLowerCase() || '')}</strong></div>
              <div class="info-item"><span>Sistema</span><strong>${esc(amort?.label || '—')}</strong></div>
              <div class="info-item"><span>Frecuencia</span><strong>${esc(freq?.label || '—')}</strong></div>
              <div class="info-item"><span>Cuotas</span><strong>${loan.installments}</strong></div>
              <div class="info-item"><span>Primer vencimiento</span><strong>${formatDate(loan.firstDueDate, 'medium')}</strong></div>
              <div class="info-item"><span>Último vencimiento</span><strong>${formatDate(loan.rows[loan.rows.length - 1]?.dueDate, 'medium')}</strong></div>
              <div class="info-item"><span>Mora</span><strong>${loan.lateFeeType === 'none' ? 'Sin mora' : `${esc(lateType?.label || '')} · ${num(loan.lateFeeValue)}${String(loan.lateFeeType).startsWith('percent') ? '%' : ''}`}</strong></div>
              <div class="info-item"><span>Días de gracia</span><strong>${loan.graceDays || 0}</strong></div>
              <div class="info-item"><span>Cargo inicial</span><strong>${money(loan.fees)}</strong></div>
              <div class="info-item"><span>Cuenta</span><strong>${esc(account?.name || '—')}</strong></div>
              <div class="info-item" style="grid-column:1/-1"><span>Garantía</span><strong>${esc(loan.guarantee || 'Ninguna')}</strong></div>
            </div>
            ${loan.notes ? `<div class="divider"></div><div class="info-item"><span>Notas</span><strong style="font-weight:450;line-height:1.55">${esc(loan.notes)}</strong></div>` : ''}
            ${loan.cancelReason ? `<div class="divider"></div><div class="alert alert--danger">${icon('x-circle', 15)}<div><strong>Cancelado.</strong> ${esc(loan.cancelReason)}</div></div>` : ''}
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div class="card-heading">
              <h3 class="card-title">Resumen financiero</h3>
              <span class="card-sub">Intereses y mora del crédito</span>
            </div>
          </div>
          <div class="card-body">
            <div class="calc-rows">
              <div class="calc-row"><span>Capital entregado</span><strong>${money(loan.totals.principal)}</strong></div>
              <div class="calc-row"><span>Interés generado</span><strong>${money(loan.totals.interest)}</strong></div>
              <div class="calc-row"><span>Interés cobrado</span><strong class="money--income">${money(loan.totals.paidInterest)}</strong></div>
              <div class="calc-row"><span>Mora cobrada</span><strong class="money--income">${money(loan.totals.paidLate)}</strong></div>
              <div class="calc-row"><span>Cargos</span><strong>${money(loan.totals.charges)}</strong></div>
              <div class="calc-row calc-row--total"><span>Total cobrado</span><strong>${money(loan.totals.paid + loan.totals.paidLate)}</strong></div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <section class="card">
      <div class="card-head">
        <div class="card-heading">
          <h3 class="card-title">Pagos registrados</h3>
          <span class="card-sub">${payments.length} pago${payments.length === 1 ? '' : 's'} · ${money(round2(sum(payments, (p) => p.amount)))}</span>
        </div>
        ${active ? `<button class="btn btn-soft btn-sm" type="button" data-pay>${icon('plus', 14)} Registrar pago</button>` : ''}
      </div>
      ${paymentsMarkup}
    </section>
  </div>`;

  root.querySelector('[data-back]').addEventListener('click', () => navigate('loans'));
  root.querySelector('[data-client]')?.addEventListener('click', () => navigate(`client/${loan.clientId}`));
  root.querySelectorAll('[data-pay]').forEach((btn) => btn.addEventListener('click', () => actions.openPaymentModal({ loanId: loan.id })));
  root.querySelector('[data-edit]').addEventListener('click', () => actions.openLoanForm({ loanId: loan.id }));
  root.querySelectorAll('[data-contract]').forEach((btn) => btn.addEventListener('click', () => actions.openContract(loan.id)));
  root.querySelector('[data-delete]').addEventListener('click', () => actions.deleteLoanFlow(loan));
  root.querySelector('[data-cancel]')?.addEventListener('click', () => actions.cancelLoanFlow(loan));
  root.querySelector('[data-reactivate]')?.addEventListener('click', () => actions.reactivateLoanFlow(loan));
  root.querySelector('[data-export-schedule]').addEventListener('click', () => {
    actions.exportCSV({
      filename: `${loan.code}-plan-de-pagos.csv`,
      title: 'Exportar plan de pagos',
      headers: ['Cuota', 'Vencimiento', 'Cuota total', 'Capital', 'Interés', 'Mora', 'Pagado', 'Estado'],
      rows: loan.rows.map((row) => [
        row.n,
        row.dueDate,
        row.amount,
        row.capital,
        row.interest,
        row.lateDue,
        row.paid,
        stateLabel(row)[0],
      ]),
    });
  });
  root.querySelectorAll('[data-receipt]').forEach((btn) => btn.addEventListener('click', () => actions.openReceipt(btn.dataset.receipt)));
  root.querySelectorAll('[data-pay-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payment = state.db.payments.find((p) => p.id === btn.dataset.payEdit);
      if (payment) actions.openPaymentEdit(payment);
    });
  });
  root.querySelectorAll('[data-pay-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payment = state.db.payments.find((p) => p.id === btn.dataset.payDelete);
      if (payment) actions.deletePaymentFlow(payment);
    });
  });
}
