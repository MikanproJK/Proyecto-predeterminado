/* Panel principal */

import {
  state,
  loanViews,
  portfolioSummary,
  accountBalances,
  client as getClient,
} from '../lib/store.js';
import {
  money,
  sum,
  round2,
  todayISO,
  addDaysISO,
  daysBetween,
  formatDate,
  loanStateMeta,
  monthlySeries,
  transactionsSummary,
  pct,
  clamp,
} from '../finance.js';
import {
  icon,
  esc,
  avatar,
  badge,
  statCard,
  emptyState,
  barChart,
  donutChart,
  legend,
} from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import * as actions from '../actions.js';
import type { ViewContext } from '../types.js';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function daysPhrase(days: number): string {
  if (days === 0) return 'vence hoy';
  if (days === 1) return 'mañana';
  if (days < 0) return `${Math.abs(days)} días de atraso`;
  return `en ${days} días`;
}

export function render(root: HTMLElement, ctx: ViewContext): void {
  const today = todayISO();
  const views = loanViews();
  const summary = portfolioSummary(views);
  const activeViews = views.filter((loan) => loan.state !== 'cancelled');
  const accounts = accountBalances();
  const cash = round2(sum(accounts, (account) => account.balance));
  const monthStart = `${today.slice(0, 8)}01`;
  const monthPayments = state.db.payments.filter((p) => p.date >= monthStart && p.date <= today);
  const collectedMonth = round2(sum(monthPayments, (p) => p.amount));
  const tx = state.db.transactions.filter((t) => t.type !== 'transfer');
  const monthTx = transactionsSummary(tx, monthStart, today);
  const cashSeries = monthlySeries(tx, { months: 6, typePick: (t) => t.type });
  const hasData =
    state.db.loans.length || state.db.clients.length || state.db.payments.length || state.db.transactions.length;

  const remainingCapital = round2(sum(activeViews, (loan) => loan.totals.remainingCapital));
  const remainingInterest = round2(sum(activeViews, (loan) => loan.totals.remainingInterest));
  const mora = summary.lateDue;
  const totalComposition = round2(remainingCapital + remainingInterest + mora);
  const overdueShare = summary.outstanding > 0 ? clamp(summary.overdueAmount / summary.outstanding, 0, 1) : 0;

  const upcoming = [];
  for (const loan of activeViews) {
    const next = loan.rows.find((row) => row.remaining > 0.004);
    if (!next) continue;
    const days = daysBetween(today, next.dueDate);
    if (days >= -60 && days <= 14) {
      upcoming.push({
        loan,
        client: getClient(loan.clientId),
        row: next,
        days,
      });
    }
  }
  upcoming.sort((a, b) => a.row.dueDate.localeCompare(b.row.dueDate));

  const recentPayments = [...state.db.payments]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 5);

  const overdueByClient = new Map();
  for (const loan of activeViews) {
    if (loan.state !== 'overdue') continue;
    const key = loan.clientId;
    const current = overdueByClient.get(key) || {
      client: getClient(key),
      total: 0,
      maxDays: 0,
      loans: 0,
      mora: 0,
    };
    current.total = round2(current.total + loan.totals.overdueAmount);
    current.mora = round2(current.mora + loan.totals.lateDue);
    current.maxDays = Math.max(current.maxDays, loan.totals.overdueDays || 0);
    current.loans += 1;
    overdueByClient.set(key, current);
  }
  const overdueClients = [...overdueByClient.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const nextDueToday = upcoming.filter((item) => item.days <= 0 && item.days >= -60);
  const recentMovements = [...state.db.transactions]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);

  const compositionSegments = [
    { label: 'Capital pendiente', value: remainingCapital, color: 'var(--primary)' },
    { label: 'Interés por cobrar', value: remainingInterest, color: 'var(--info)' },
    { label: 'Mora acumulada', value: mora, color: 'var(--danger)' },
  ].filter((segment) => segment.value > 0);

  const hero = `<section class="hero">
    <div class="hero-copy">
      <span class="hero-eyebrow">${esc(formatDate(today, 'long'))}</span>
      <h2>${greeting()}, ${esc(state.db.settings.owner || 'bienvenido')}</h2>
      <p>${hasData ? 'Este es el pulso de tu cartera y tus finanzas. Todo lo importante, en un solo lugar.' : 'Empieza a administrar tus préstamos con planes flexibles, cobros claros y finanzas integradas.'}</p>
      <div class="hero-metric">
        <div><span>Cartera activa</span><strong>${money(summary.outstandingCapital)}</strong></div>
        <div><span>Por cobrar</span><strong>${money(summary.outstanding)}</strong></div>
        <div><span>Cobrado este mes</span><strong>${money(collectedMonth)}</strong></div>
        <div><span>Disponible en cuentas</span><strong>${money(cash)}</strong></div>
      </div>
    </div>
    <div class="hero-actions">
      <button class="btn btn-primary" type="button" data-action="new-loan">${icon('plus', 16)} Nuevo préstamo</button>
      <button class="btn" type="button" data-action="new-payment">${icon('receipt', 16)} Registrar pago</button>
    </div>
  </section>`;

  if (!hasData) {
    root.innerHTML = `<div class="page">${hero}
      <section class="card">
        <div class="card-body" style="padding:34px 26px">
          <div class="empty" style="padding:8px 0 18px">
            <span class="empty-icon" style="width:62px;height:62px;border-radius:19px">${icon('sparkles', 32)}</span>
            <strong style="font-size:1.08rem">Tu panel está listo</strong>
            <p style="max-width:460px">Crea tu primer cliente y préstamo, o carga una cartera de ejemplo para explorar cómo funciona todo el sistema.</p>
            <div class="row-inline" style="margin-top:16px;gap:9px;flex-wrap:wrap;justify-content:center">
              <button class="btn btn-primary btn-lg" type="button" data-action="new-client">${icon('user-plus', 17)} Crear primer cliente</button>
              <button class="btn btn-outline btn-lg" type="button" data-action="demo">${icon('sparkles', 17)} Cargar datos de ejemplo</button>
            </div>
          </div>
          <div class="quick-grid" style="max-width:660px;margin:6px auto 0">
            <div class="quick-action" style="cursor:default">${icon('percent', 18)}<span>Interés por porcentaje o monto fijo</span></div>
            <div class="quick-action" style="cursor:default">${icon('sliders', 18)}<span>Cuota fija, abono fijo, global o solo interés</span></div>
            <div class="quick-action" style="cursor:default">${icon('alert', 18)}<span>Mora automática por días de atraso</span></div>
            <div class="quick-action" style="cursor:default">${icon('wallet', 18)}<span>Caja, bancos y billeteras integradas</span></div>
          </div>
        </div>
      </section>
    </div>`;
    bindActions(root, ctx);
    return;
  }

  const statCards = [
    statCard({
      label: 'Capital en cartera',
      value: money(summary.outstandingCapital),
      hint: `${summary.activeCount} préstamo${summary.activeCount === 1 ? '' : 's'} al día · ${summary.overdueCount} en mora`,
      iconName: 'coins',
      tone: 'primary',
      badgeHtml: badge(`${summary.count} activos`, 'primary'),
    }),
    statCard({
      label: 'Total por cobrar',
      value: money(summary.outstanding),
      hint: `Interés pendiente ${money(remainingInterest)}`,
      iconName: 'trending-up',
      tone: 'accent',
      badgeHtml: badge('Cartera', 'info'),
    }),
    statCard({
      label: 'Cobrado este mes',
      value: money(collectedMonth),
      hint: `${monthPayments.length} pago${monthPayments.length === 1 ? '' : 's'} · egresos ${money(monthTx.expense)}`,
      iconName: 'receipt',
      tone: 'success',
      badgeHtml: badge('Este mes', 'success'),
    }),
    statCard({
      label: 'Mora acumulada',
      value: money(mora),
      hint: overdueShare > 0 ? `${pct(overdueShare * 100, 1)} de la cartera en atraso` : 'Sin atrasos: cartera saludable',
      iconName: 'alert',
      tone: mora > 0 ? 'danger' : 'success',
      badgeHtml: badge(
        mora > 0 ? `${summary.overdueCount} en mora` : 'Al día',
        mora > 0 ? 'danger' : 'success',
        { dot: true },
      ),
    }),
  ].join('');

  const cashflowCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Flujo de caja</h3>
        <span class="card-sub">Ingresos y egresos de los últimos 6 meses</span>
      </div>
      <div class="chart-legend">
        <span><i class="swatch swatch--income"></i> Ingresos</span>
        <span><i class="swatch swatch--expense"></i> Egresos</span>
      </div>
    </div>
    <div class="card-body">${barChart(cashSeries, { height: 226 })}</div>
  </section>`;

  const compositionCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Composición por cobrar</h3>
        <span class="card-sub">Capital, interés y mora pendientes</span>
      </div>
      ${badge(`${activeViews.filter((l) => l.state !== 'paid').length} créditos`, 'muted')}
    </div>
    <div class="card-body">
      ${
        totalComposition > 0
          ? `<div class="chart-flex">
              ${donutChart(compositionSegments, {
                size: 176,
                thickness: 17,
                centerLabel: 'por cobrar',
                centerValue: money(totalComposition),
              })}
              <div class="stack" style="gap:14px;flex:1;min-width:140px">
                ${legend(
                  compositionSegments.map((segment) => ({
                    ...segment,
                    value: money(segment.value),
                  })),
                )}
                <div class="alert ${mora > 0 ? 'alert--danger' : 'alert--success'}">
                  ${icon(mora > 0 ? 'alert' : 'shield', 15)}
                  <span>${mora > 0 ? `Hay <strong>${money(mora)}</strong> de mora pendiente de cobro.` : 'La cartera no registra atrasos.'}</span>
                </div>
              </div>
            </div>`
          : emptyState({ title: 'Sin saldos pendientes', text: 'Todos los créditos están al día o cancelados.', iconName: 'check-circle', compact: true })
      }
    </div>
  </section>`;

  const upcomingCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Próximos vencimientos</h3>
        <span class="card-sub">Cuotas de los próximos 14 días y atrasos recientes</span>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-go="loans">Ver cartera ${icon('chevron-right', 14)}</button>
    </div>
    <div class="card-body card-body--tight">
      ${
        upcoming.length
          ? `<div class="list">
              ${upcoming
                .slice(0, 6)
                .map((item) => {
                  const overdue = item.days < 0;
                  return `<div class="list-item list-item--clickable" data-loan="${item.loan.id}">
                    ${avatar(item.client?.name || '?', 36)}
                    <div class="list-main">
                      <span class="list-title">${esc(item.client?.name || 'Cliente')} ${badge(item.loan.code, 'muted')}</span>
                      <span class="list-sub">Cuota ${item.row.n} de ${item.loan.installments} · ${overdue ? `<span class="money--danger">${daysPhrase(item.days)}</span>` : daysPhrase(item.days)}</span>
                    </div>
                    <div class="list-side">
                      <strong>${money(item.row.remaining)}</strong>
                      <span>${formatDate(item.row.dueDate, 'short')}</span>
                    </div>
                  </div>`;
                })
                .join('')}
            </div>`
          : emptyState({
              title: 'Sin vencimientos cercanos',
              text: 'No hay cuotas programadas para los próximos 14 días.',
              iconName: 'calendar',
              compact: true,
            })
      }
    </div>
    ${
      nextDueToday.length
        ? `<div class="card-foot"><span>${icon('alert', 14)} ${nextDueToday.length} cuota${nextDueToday.length === 1 ? '' : 's'} vencida${nextDueToday.length === 1 ? '' : 's'} o para hoy</span><button class="link-btn" type="button" data-go="loans">Revisar</button></div>`
        : ''
    }
  </section>`;

  const recentCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Cobros recientes</h3>
        <span class="card-sub">Últimos pagos registrados</span>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-go="payments">Ver todos ${icon('chevron-right', 14)}</button>
    </div>
    <div class="card-body card-body--tight">
      ${
        recentPayments.length
          ? `<div class="list">
              ${recentPayments
                .map((payment) => {
                  const client = getClient(payment.clientId);
                  const loan = views.find((l) => l.id === payment.loanId);
                  return `<div class="list-item list-item--clickable" data-receipt="${payment.id}">
                    <span class="list-icon list-icon--income">${icon('arrow-down-left', 16)}</span>
                    <div class="list-main">
                      <span class="list-title">${esc(client?.name || 'Cliente')}</span>
                      <span class="list-sub">${esc(payment.receipt)} · ${esc(payment.method)} · ${formatDate(payment.date, 'short')}</span>
                    </div>
                    <div class="list-side">
                      <strong class="money--income">${money(payment.amount)}</strong>
                      <span>${esc(loan?.code || '')}</span>
                    </div>
                  </div>`;
                })
                .join('')}
            </div>`
          : emptyState({ title: 'Aún no hay cobros', text: 'Registra tu primer pago desde un préstamo.', iconName: 'receipt', compact: true })
      }
    </div>
  </section>`;

  const overdueCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Clientes con mora</h3>
        <span class="card-sub">Prioriza los cobros con mayor atraso</span>
      </div>
      ${badge(overdueClients.length ? `${overdueClients.length} por atender` : 'Todo al día', overdueClients.length ? 'danger' : 'success', { dot: true })}
    </div>
    <div class="card-body card-body--tight">
      ${
        overdueClients.length
          ? `<div class="list">
              ${overdueClients
                .map(
                  (item) => `<div class="list-item list-item--clickable" data-client="${item.client?.id || ''}">
                    ${avatar(item.client?.name || '?', 36)}
                    <div class="list-main">
                      <span class="list-title">${esc(item.client?.name || 'Cliente')} ${item.maxDays > 0 ? badge(`${item.maxDays} días`, 'danger') : ''}</span>
                      <span class="list-sub">${item.loans} préstamo${item.loans === 1 ? '' : 's'} en mora · ${money(item.mora)} de mora</span>
                    </div>
                    <div class="list-side">
                      <strong class="money--danger">${money(item.total)}</strong>
                      <span>por cobrar</span>
                    </div>
                  </div>`,
                )
                .join('')}
            </div>`
          : emptyState({ title: 'Cartera sin atrasos', text: 'Todos tus clientes están al día. Buen trabajo.', iconName: 'shield', compact: true })
      }
    </div>
  </section>`;

  const quickCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Accesos rápidos</h3>
        <span class="card-sub">Las acciones más frecuentes</span>
      </div>
    </div>
    <div class="card-body">
      <div class="quick-grid">
        <button class="quick-action" type="button" data-action="new-loan">${icon('plus', 18)} Nuevo préstamo</button>
        <button class="quick-action" type="button" data-action="new-client">${icon('user-plus', 18)} Nuevo cliente</button>
        <button class="quick-action" type="button" data-action="new-payment">${icon('receipt', 18)} Registrar pago</button>
        <button class="quick-action" type="button" data-action="new-movement">${icon('wallet', 18)} Movimiento</button>
      </div>
      <div class="divider"></div>
      <div class="inline-metrics">
        <div class="inline-metric"><span>Utilidad cobrada</span><strong class="money--income">${money(summary.paidInterest + summary.paidLate)}</strong></div>
        <div class="inline-metric"><span>Pagos recibidos</span><strong>${state.db.payments.length}</strong></div>
        <div class="inline-metric"><span>Clientes</span><strong>${state.db.clients.length}</strong></div>
      </div>
    </div>
  </section>`;

  const movementsCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Movimientos recientes</h3>
        <span class="card-sub">Últimos movimientos de caja</span>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-go="finance">Ver finanzas ${icon('chevron-right', 14)}</button>
    </div>
    <div class="card-body card-body--tight">
      ${
        recentMovements.length
          ? `<div class="list">
              ${recentMovements
                .map((movement) => {
                  const isIncome = movement.type === 'income';
                  return `<div class="list-item">
                    <span class="list-icon ${isIncome ? 'list-icon--income' : 'list-icon--expense'}">${icon(isIncome ? 'arrow-up-right' : 'arrow-down-left', 16)}</span>
                    <div class="list-main">
                      <span class="list-title">${esc(movement.description || movement.category)}</span>
                      <span class="list-sub">${esc(movement.category)} · ${formatDate(movement.date, 'short')}</span>
                    </div>
                    <div class="list-side">
                      <strong class="${isIncome ? 'money--income' : 'money--expense'}">${isIncome ? '+' : '−'}${money(movement.amount)}</strong>
                    </div>
                  </div>`;
                })
                .join('')}
            </div>`
          : emptyState({ title: 'Sin movimientos', text: 'Registra ingresos y egresos para verlos aquí.', iconName: 'wallet', compact: true })
      }
    </div>
  </section>`;

  root.innerHTML = `<div class="page">
    ${hero}
    <div class="stat-grid mb-2">${statCards}</div>
    <div class="grid grid-main mb-2">${cashflowCard}${compositionCard}</div>
    <div class="grid grid-2 mb-2">${upcomingCard}${recentCard}</div>
    <div class="grid grid-main">${overdueCard}<div class="stack">${quickCard}${movementsCard}</div></div>
  </div>`;

  bindActions(root, ctx);
}

function bindActions(root: HTMLElement, ctx: ViewContext): void {
  root.querySelectorAll<HTMLElement>('[data-go]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      navigate(btn.dataset.go || 'dashboard');
    });
  });
  root.querySelectorAll<HTMLElement>('[data-loan]').forEach((el) => {
    el.addEventListener('click', () => navigate(`loan/${el.dataset.loan}`));
  });
  root.querySelectorAll<HTMLElement>('[data-client]').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.client) navigate(`client/${el.dataset.client}`);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-receipt]').forEach((el) => {
    el.addEventListener('click', () => actions.openReceipt(el.dataset.receipt || ''));
  });
  root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      switch (el.dataset.action) {
        case 'new-loan':
          actions.openLoanForm();
          break;
        case 'new-client':
          actions.openClientForm();
          break;
        case 'new-payment':
          actions.openPaymentModal();
          break;
        case 'new-movement':
          actions.openTransactionModal();
          break;
        case 'demo':
          actions.loadDemoFlow({ confirm: false });
          break;
        default:
          break;
      }
    });
  });
}
