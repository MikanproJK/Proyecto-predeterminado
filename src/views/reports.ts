/* Reportes: resumen del período, cartera por cliente y rentabilidad por préstamo */

import {
  state,
  loanViews,
  portfolioSummary,
  accountBalances,
  client as getClient,
} from '../lib/store.js';
import {
  money,
  num,
  round2,
  sum,
  pct,
  clamp,
  todayISO,
  addDaysISO,
  addMonthsISO,
  formatDate,
  monthlySeries,
  transactionsSummary,
  computeLoan,
  loanStateMeta,
  interestSummary,
} from '../finance.js';
import {
  icon,
  esc,
  avatar,
  badge,
  emptyState,
  tabs,
  segmented,
  barChart,
  areaChart,
  donutChart,
  legend,
  progressBar,
} from '../lib/ui.js';
import type { ChartPoint, DonutSegment } from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import * as actions from '../actions.js';
import type {
  AccountWithBalance,
  Client,
  Loan,
  LoanView,
  MonthlyBucket,
  Payment,
  PortfolioSummary,
  Transaction,
  TransactionsSummary,
  ViewContext,
} from '../types.js';

interface ReportFilters {
  range: string;
  tab: string;
}

interface RangeBounds {
  from: string;
  to: string;
  label: string;
}

interface PeriodAllocation {
  late: number;
  charges: number;
  interest: number;
  capital: number;
  applied: number;
}

interface ReportClientRow {
  client: Client | null;
  loans: number;
  principal: number;
  paid: number;
  balance: number;
  late: number;
  overdue: number;
  lastPayment: string | null;
}

interface ReportData {
  bounds: RangeBounds;
  today: string;
  views: LoanView[];
  activeViews: LoanView[];
  portfolio: PortfolioSummary;
  accounts: AccountWithBalance[];
  cash: number;
  payments: Payment[];
  paymentTotal: number;
  paymentAverage: number;
  transactions: Transaction[];
  cashSummary: TransactionsSummary;
  newLoans: Loan[];
  disbursed: number;
  allocation: PeriodAllocation;
  profit: number;
  cashSeries: MonthlyBucket[];
  collectionPoints: ChartPoint[];
  clientRows: ReportClientRow[];
  loanRows: LoanView[];
  composition: DonutSegment[];
  expenseSegments: DonutSegment[];
  incomeSegments: DonutSegment[];
  net: number;
  margin: number;
  coverage: number;
}

const filters: ReportFilters = { range: 'month', tab: 'overview' };
const CATEGORY_COLORS = ['var(--primary)', 'var(--accent)', 'var(--info)', 'var(--warning)', 'var(--danger)', 'var(--success)'];

function rangeBounds(range: string): RangeBounds {
  const today = todayISO();
  const monthStart = `${today.slice(0, 8)}01`;
  switch (range) {
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

/* Reparte los pagos del período en mora, cargos, interés y capital usando el
   mismo motor que el resto de la aplicación. Se compara el acumulado al final
   del rango contra el acumulado al día anterior al inicio. */
function periodAllocation(from: string, to: string): PeriodAllocation {
  const asOf = to || todayISO();
  const before = from ? addDaysISO(from, -1) : null;
  const totals = { late: 0, charges: 0, interest: 0, capital: 0, applied: 0 };

  for (const loan of state.db.loans) {
    const loanPayments = state.db.payments.filter((p) => p.loanId === loan.id);
    const upTo = loanPayments.filter((p) => !to || p.date <= to);
    const after = computeLoan(loan, upTo, asOf);
    const previous = before
      ? computeLoan(loan, loanPayments.filter((p) => p.date <= before), before)
      : null;
    const prev = previous ? previous.totals : { paidLate: 0, paidCharges: 0, paidInterest: 0, paidCapital: 0, applied: 0 };
    totals.late += after.totals.paidLate - prev.paidLate;
    totals.charges += after.totals.paidCharges - prev.paidCharges;
    totals.interest += after.totals.paidInterest - prev.paidInterest;
    totals.capital += after.totals.paidCapital - prev.paidCapital;
    totals.applied += after.totals.applied - prev.applied;
  }

  return {
    late: round2(totals.late),
    charges: round2(totals.charges),
    interest: round2(totals.interest),
    capital: round2(totals.capital),
    applied: round2(totals.applied),
  };
}

function categorySegments(transactions: readonly Transaction[], type: string): DonutSegment[] {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const key = tx.category || (type === 'income' ? 'Otro ingreso' : 'Otro egreso');
    map.set(key, round2((map.get(key) || 0) + num(tx.amount)));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], index) => ({ label, value, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }));
}

function collect(): ReportData {
  const bounds = rangeBounds(filters.range);
  const today = todayISO();
  const views = loanViews();
  const activeViews = views.filter((loan) => loan.state !== 'cancelled');
  const portfolio = portfolioSummary(views);
  const accounts = accountBalances();
  const cash = round2(sum(accounts, (account) => account.balance));

  const inRange = (date: string): boolean => (!bounds.from || date >= bounds.from) && (!bounds.to || date <= bounds.to);

  const payments = state.db.payments.filter((payment) => inRange(payment.date));
  const paymentTotal = round2(sum(payments, (payment) => payment.amount));
  const paymentAverage = payments.length ? round2(paymentTotal / payments.length) : 0;

  const transactions = state.db.transactions.filter((tx) => tx.type !== 'transfer' && inRange(tx.date));
  const cashSummary = transactionsSummary(transactions);

  const newLoans = state.db.loans.filter((loan) => inRange(loan.startDate));
  const disbursed = round2(sum(newLoans, (loan) => loan.principal));

  const allocation = periodAllocation(bounds.from, bounds.to);
  const profit = round2(allocation.interest + allocation.late + allocation.charges);

  const months = filters.range === 'year' ? 12 : 6;
  const cashSeries = monthlySeries(
    state.db.transactions.filter((tx) => tx.type !== 'transfer'),
    { months, typePick: (tx) => tx.type },
  );
  const collectionSeries = monthlySeries(state.db.payments, { months });
  const collectionPoints = collectionSeries.map((bucket) => ({ label: bucket.label, value: bucket.income }));

  const clientMap = new Map<string, ReportClientRow>();
  for (const loan of activeViews) {
    const current = clientMap.get(loan.clientId) || {
      client: getClient(loan.clientId),
      loans: 0,
      principal: 0,
      paid: 0,
      balance: 0,
      late: 0,
      overdue: 0,
      lastPayment: null,
    };
    current.loans += 1;
    current.principal = round2(current.principal + loan.totals.principal);
    current.paid = round2(current.paid + loan.totals.paid);
    current.balance = round2(current.balance + loan.totals.balance);
    current.late = round2(current.late + loan.totals.lateDue);
    if (loan.state === 'overdue') current.overdue += 1;
    if (loan.totals.lastPaymentDate && (!current.lastPayment || loan.totals.lastPaymentDate > current.lastPayment)) {
      current.lastPayment = loan.totals.lastPaymentDate;
    }
    clientMap.set(loan.clientId, current);
  }
  const clientRows = [...clientMap.values()].sort((a, b) => b.balance - a.balance);

  const loanRows = activeViews
    .slice()
    .sort((a, b) => b.totals.balance - a.totals.balance || a.code.localeCompare(b.code));

  const remainingCapital = round2(sum(activeViews, (loan) => loan.totals.remainingCapital));
  const remainingInterest = round2(sum(activeViews, (loan) => loan.totals.remainingInterest));
  const composition = [
    { label: 'Capital pendiente', value: remainingCapital, color: 'var(--primary)' },
    { label: 'Interés por cobrar', value: remainingInterest, color: 'var(--info)' },
    { label: 'Mora acumulada', value: portfolio.lateDue, color: 'var(--danger)' },
  ].filter((segment) => segment.value > 0);

  const expenseSegments = categorySegments(transactions, 'expense');
  const incomeSegments = categorySegments(transactions, 'income');
  const net = round2(cashSummary.income - cashSummary.expense);
  const margin = cashSummary.income > 0 ? clamp(net / cashSummary.income, -1, 1) : 0;
  const coverage = portfolio.outstanding > 0 ? clamp(portfolio.outstandingCapital / portfolio.outstanding, 0, 1) : 0;

  return {
    bounds,
    today,
    views,
    activeViews,
    portfolio,
    accounts,
    cash,
    payments,
    paymentTotal,
    paymentAverage,
    transactions,
    cashSummary,
    newLoans,
    disbursed,
    allocation,
    profit,
    cashSeries,
    collectionPoints,
    clientRows,
    loanRows,
    composition,
    expenseSegments,
    incomeSegments,
    net,
    margin,
    coverage,
  };
}

/* ---------- bloques de interfaz ---------- */

function summaryStrip(data: ReportData): string {
  return `<div class="summary-strip mb-2">
    <div><span>Cobrado · ${esc(data.bounds.label)}</span><strong class="money--income">${money(data.paymentTotal)}</strong></div>
    <div><span>Interés + mora cobrados</span><strong class="money--income">${money(data.profit)}</strong></div>
    <div><span>Capital recuperado</span><strong>${money(data.allocation.capital)}</strong></div>
    <div><span>Egresos de caja</span><strong class="money--expense">${money(data.cashSummary.expense)}</strong></div>
    <div><span>Cartera por cobrar</span><strong>${money(data.portfolio.outstanding)}</strong></div>
    <div><span>Mora pendiente</span><strong class="${data.portfolio.lateDue > 0 ? 'money--danger' : ''}">${money(data.portfolio.lateDue)}</strong></div>
  </div>`;
}

function overviewTab(data: ReportData): string {
  const hasMovements = data.cashSeries.some((bucket) => bucket.income > 0 || bucket.expense > 0);
  const hasCollections = data.collectionPoints.some((point) => point.value > 0);

  const cashflowCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Flujo de caja mensual</h3>
        <span class="card-sub">Ingresos y egresos de los últimos ${data.cashSeries.length} meses</span>
      </div>
      <div class="chart-legend">
        <span><i class="swatch swatch--income"></i> Ingresos</span>
        <span><i class="swatch swatch--expense"></i> Egresos</span>
      </div>
    </div>
    <div class="card-body">
      ${hasMovements
        ? barChart(data.cashSeries, { height: 236 })
        : emptyState({ title: 'Sin movimientos en el período', text: 'Registra cobros o egresos para ver el flujo de caja.', iconName: 'wallet', compact: true })}
    </div>
  </section>`;

  const compositionCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Composición de la cartera</h3>
        <span class="card-sub">Capital, interés y mora pendientes</span>
      </div>
      ${badge(`${data.activeViews.filter((loan) => loan.state !== 'paid').length} créditos`, 'muted')}
    </div>
    <div class="card-body">
      ${data.composition.length
        ? `<div class="chart-flex">
            ${donutChart(data.composition, {
              size: 172,
              thickness: 17,
              centerLabel: 'por cobrar',
              centerValue: money(data.portfolio.outstanding),
            })}
            <div class="stack" style="gap:12px;flex:1;min-width:140px">
              ${legend(data.composition.map((segment) => ({ ...segment, value: money(segment.value) })))}
              <div class="alert ${data.portfolio.lateDue > 0 ? 'alert--danger' : 'alert--success'}">
                ${icon(data.portfolio.lateDue > 0 ? 'alert' : 'shield', 15)}
                <span>${data.portfolio.lateDue > 0
                  ? `Hay <strong>${money(data.portfolio.lateDue)}</strong> de mora pendiente.`
                  : 'La cartera no registra atrasos.'}</span>
              </div>
            </div>
          </div>`
        : emptyState({ title: 'Sin saldos pendientes', text: 'Todos los créditos están pagados o cancelados.', iconName: 'check-circle', compact: true })}
    </div>
  </section>`;

  const collectionsCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Tendencia de cobranza</h3>
        <span class="card-sub">Pagos recibidos por mes · ${data.payments.length} en el período</span>
      </div>
      ${badge(money(data.paymentTotal), 'success')}
    </div>
    <div class="card-body">
      ${hasCollections
        ? areaChart(data.collectionPoints, { height: 196, tone: 'success' })
        : emptyState({ title: 'Sin cobros registrados', text: 'Los pagos aparecerán aquí agrupados por mes.', iconName: 'receipt', compact: true })}
    </div>
  </section>`;

  const expensesCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Egresos por categoría</h3>
        <span class="card-sub">${esc(data.bounds.label)} · ${money(data.cashSummary.expense)}</span>
      </div>
    </div>
    <div class="card-body">
      ${data.expenseSegments.length
        ? `<div class="chart-flex">
            ${donutChart(data.expenseSegments, {
              size: 156,
              thickness: 15,
              centerLabel: 'egresos',
              centerValue: money(data.cashSummary.expense),
            })}
            <div style="flex:1;min-width:150px">
              ${legend(data.expenseSegments.map((segment) => ({ ...segment, value: money(segment.value) })))}
            </div>
          </div>`
        : emptyState({ title: 'Sin egresos', text: 'No hay salidas de caja en el período seleccionado.', iconName: 'trending-down', compact: true })}
    </div>
  </section>`;

  const topClients = data.clientRows.slice(0, 6);
  const topCard = `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Mayores saldos por cliente</h3>
        <span class="card-sub">Ordenado por saldo pendiente</span>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-tab-jump="portfolio">Ver cartera ${icon('chevron-right', 14)}</button>
    </div>
    <div class="card-body card-body--tight">
      ${topClients.length
        ? `<div class="list">
            ${topClients.map((row) => `<div class="list-item list-item--clickable" data-client="${row.client?.id || ''}">
              ${avatar(row.client?.name || '?', 36)}
              <div class="list-main">
                <span class="list-title">${esc(row.client?.name || 'Cliente')} ${row.overdue ? badge(`${row.overdue} en mora`, 'danger') : ''}</span>
                <span class="list-sub">${row.loans} préstamo${row.loans === 1 ? '' : 's'} · ${money(row.paid)} pagado</span>
              </div>
              <div class="list-side">
                <strong>${money(row.balance)}</strong>
                <span>${row.late > 0 ? money(row.late) + ' mora' : 'sin mora'}</span>
              </div>
            </div>`).join('')}
          </div>`
        : emptyState({ title: 'Aún no hay cartera', text: 'Crea un préstamo para empezar a analizar tus clientes.', iconName: 'users', compact: true })}
    </div>
  </section>`;

  return `<div class="grid grid-main mb-2">${cashflowCard}${compositionCard}</div>
    <div class="grid grid-2 mb-2">${collectionsCard}${expensesCard}</div>
    ${topCard}`;
}

function portfolioTab(data: ReportData): string {
  const total = data.clientRows.reduce(
    (acc, row) => ({
      loans: acc.loans + row.loans,
      principal: round2(acc.principal + row.principal),
      paid: round2(acc.paid + row.paid),
      balance: round2(acc.balance + row.balance),
      late: round2(acc.late + row.late),
    }),
    { loans: 0, principal: 0, paid: 0, balance: 0, late: 0 },
  );

  return `<div class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Cartera por cliente</h3>
        <span class="card-sub">${data.clientRows.length} cliente${data.clientRows.length === 1 ? '' : 's'} con créditos activos</span>
      </div>
      <div class="row-inline" style="gap:8px">
        ${badge(`${data.portfolio.overdueCount} en mora`, data.portfolio.overdueCount ? 'danger' : 'success', { dot: true })}
        <button class="btn btn-outline btn-sm" type="button" data-export="portfolio">${icon('download', 15)} Exportar CSV</button>
      </div>
    </div>
    ${data.clientRows.length
      ? `<div class="table-wrap table-scroll"><table class="table">
          <thead><tr>
            <th>Cliente</th><th>Tipo</th><th class="num">Préstamos</th><th class="num">Capital</th>
            <th class="num">Pagado</th><th class="num">Saldo</th><th class="num">Mora</th><th>Último pago</th><th>Estado</th>
          </tr></thead>
          <tbody>
            ${data.clientRows.map((row) => `<tr class="is-clickable" data-client="${row.client?.id || ''}">
              <td><div class="cell-main">${avatar(row.client?.name || '?', 30)}<div class="cell-stack"><strong>${esc(row.client?.name || 'Cliente')}</strong><span>${esc(row.client?.phone || row.client?.doc || '')}</span></div></div></td>
              <td>${row.client?.type === 'temporary' ? badge('Temporal', 'warning') : badge('Regular', 'muted')}</td>
              <td class="num">${row.loans}</td>
              <td class="num money">${money(row.principal)}</td>
              <td class="num money money--income">${money(row.paid)}</td>
              <td class="num money">${money(row.balance)}</td>
              <td class="num money ${row.late > 0 ? 'money--danger' : 'money--muted'}">${money(row.late)}</td>
              <td>${row.lastPayment ? formatDate(row.lastPayment, 'short') : '<span class="muted">—</span>'}</td>
              <td>${row.overdue ? badge(`${row.overdue} en mora`, 'danger', { dot: true }) : badge('Al día', 'success', { dot: true })}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="table-foot">
          <span>${total.loans} préstamo${total.loans === 1 ? '' : 's'} · ${data.clientRows.length} clientes</span>
          <span>${money(total.balance)} por cobrar · ${money(total.late)} de mora</span>
        </div>`
      : `<div class="card-body">${emptyState({
          title: 'Sin cartera activa',
          text: 'Cuando otorgues préstamos, aquí verás el resumen por cliente.',
          iconName: 'users',
          action: `<button class="btn btn-primary" type="button" data-new-loan>${icon('plus', 16)} Nuevo préstamo</button>`,
        })}</div>`}
  </div>`;
}

function profitabilityTab(data: ReportData): string {
  const total = data.loanRows.reduce(
    (acc, loan) => ({
      principal: round2(acc.principal + loan.totals.principal),
      expectedInterest: round2(acc.expectedInterest + loan.totals.interest),
      interest: round2(acc.interest + loan.totals.paidInterest),
      late: round2(acc.late + loan.totals.paidLate),
      collected: round2(acc.collected + loan.totals.paid + loan.totals.paidLate),
      balance: round2(acc.balance + loan.totals.balance),
    }),
    { principal: 0, expectedInterest: 0, interest: 0, late: 0, collected: 0, balance: 0 },
  );

  return `<div class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Rentabilidad por préstamo</h3>
        <span class="card-sub">Interés y mora efectivamente cobrados · ${data.loanRows.length} crédito${data.loanRows.length === 1 ? '' : 's'}</span>
      </div>
      <div class="row-inline" style="gap:8px">
        ${badge(`Utilidad ${money(round2(data.allocation.interest + data.allocation.late))}`, 'success')}
        <button class="btn btn-outline btn-sm" type="button" data-export="profitability">${icon('download', 15)} Exportar CSV</button>
      </div>
    </div>
    ${data.loanRows.length
      ? `<div class="table-wrap table-scroll"><table class="table">
          <thead><tr>
            <th>Préstamo</th><th>Cliente</th><th class="num">Capital</th><th class="num">Interés esperado</th>
            <th class="num">Interés cobrado</th><th class="num">Mora cobrada</th><th class="num">Total cobrado</th>
            <th class="num">Saldo</th><th>Avance</th><th>Estado</th>
          </tr></thead>
          <tbody>
            ${data.loanRows.map((loan) => {
              const stateMeta = loanStateMeta(loan.state);
              return `<tr class="is-clickable" data-loan="${loan.id}">
                <td><div class="cell-stack"><strong>${esc(loan.code)}</strong><span>${loan.installments} cuotas · ${esc(interestSummary(loan))}</span></div></td>
                <td>${esc(getClient(loan.clientId)?.name || '—')}</td>
                <td class="num money">${money(loan.totals.principal)}</td>
                <td class="num money">${money(loan.totals.interest)}</td>
                <td class="num money money--income">${money(loan.totals.paidInterest)}</td>
                <td class="num money ${loan.totals.paidLate > 0 ? 'money--warning' : 'money--muted'}">${money(loan.totals.paidLate)}</td>
                <td class="num money">${money(round2(loan.totals.paid + loan.totals.paidLate))}</td>
                <td class="num money">${money(loan.totals.balance)}</td>
                <td style="min-width:110px">${progressBar(loan.totals.progress, loan.state === 'overdue' ? 'danger' : loan.state === 'paid' ? 'success' : 'primary', { thin: true })}<span class="tiny muted">${pct(loan.totals.progress * 100, 0)}</span></td>
                <td>${badge(stateMeta.label, stateMeta.tone, { dot: true })}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
        <div class="table-foot">
          <span>Capital ${money(total.principal)} · interés esperado ${money(total.expectedInterest)}</span>
          <span>Cobrado ${money(total.collected)} · saldo ${money(total.balance)}</span>
        </div>`
      : `<div class="card-body">${emptyState({
          title: 'Sin préstamos registrados',
          text: 'Crea un crédito para analizar su rentabilidad.',
          iconName: 'credit-card',
          action: `<button class="btn btn-primary" type="button" data-new-loan>${icon('plus', 16)} Nuevo préstamo</button>`,
        })}</div>`}
  </div>`;
}

function reportBody(data: ReportData): string {
  if (filters.tab === 'portfolio') return portfolioTab(data);
  if (filters.tab === 'profitability') return profitabilityTab(data);
  return overviewTab(data);
}

/* ---------- exportaciones ---------- */

function exportReport(kind: string, data: ReportData): void {
  if (kind === 'portfolio') {
    actions.exportCSV({
      filename: 'cartera-clientes.csv',
      title: 'Exportar cartera por cliente',
      headers: ['Cliente', 'Tipo', 'Préstamos', 'Capital', 'Pagado', 'Saldo', 'Mora', 'Último pago', 'Estado'],
      rows: data.clientRows.map((row) => [
        row.client?.name || '',
        row.client?.type === 'temporary' ? 'Temporal' : 'Regular',
        row.loans,
        row.principal,
        row.paid,
        row.balance,
        row.late,
        row.lastPayment || '',
        row.overdue ? 'En mora' : 'Al día',
      ]),
    });
    return;
  }

  if (kind === 'profitability') {
    actions.exportCSV({
      filename: 'rentabilidad-prestamos.csv',
      title: 'Exportar rentabilidad por préstamo',
      headers: ['Préstamo', 'Cliente', 'Capital', 'Interés esperado', 'Interés cobrado', 'Mora cobrada', 'Total cobrado', 'Saldo', 'Avance %', 'Estado'],
      rows: data.loanRows.map((loan) => [
        loan.code,
        getClient(loan.clientId)?.name || '',
        loan.totals.principal,
        loan.totals.interest,
        loan.totals.paidInterest,
        loan.totals.paidLate,
        round2(loan.totals.paid + loan.totals.paidLate),
        loan.totals.balance,
        round2(loan.totals.progress * 100),
        loanStateMeta(loan.state).label,
      ]),
    });
    return;
  }

  actions.exportCSV({
    filename: 'flujo-caja-mensual.csv',
    title: 'Exportar flujo de caja',
    headers: ['Mes', 'Ingresos', 'Egresos', 'Neto'],
    rows: data.cashSeries.map((bucket) => [bucket.label, bucket.income, bucket.expense, round2(bucket.income - bucket.expense)]),
  });
}

/* ---------- impresión ---------- */

function printReport(): void {
  const data = collect();
  const settings = state.db.settings;
  const company = settings.company || 'Mi Financiera';
  const generated = new Date().toLocaleString(settings.locale || 'es-419', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const summaryRows = [
    ['Cobrado en el período', money(data.paymentTotal)],
    ['Interés + mora cobrados', money(data.profit)],
    ['Capital recuperado', money(data.allocation.capital)],
    ['Ingresos de caja', money(data.cashSummary.income)],
    ['Egresos de caja', money(data.cashSummary.expense)],
    ['Resultado de caja', money(data.net)],
    ['Cartera por cobrar', money(data.portfolio.outstanding)],
    ['Mora pendiente', money(data.portfolio.lateDue)],
    ['Nuevos préstamos', `${data.newLoans.length} · ${money(data.disbursed)}`],
  ];

  const html = `<div class="receipt">
    <div class="receipt-head">
      <div>
        <h1>${esc(company)}</h1>
        <p>${esc(settings.owner || 'Gestión de préstamos y finanzas')}</p>
        <p>Reporte de cartera y finanzas</p>
      </div>
      <div class="receipt-number">
        REPORTE DEL PERÍODO
        <strong>${esc(data.bounds.label)}</strong>
        <span>${generated}</span>
      </div>
    </div>

    <div class="receipt-grid">
      ${summaryRows.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
    </div>

    <h3 style="font-size:13px;margin:20px 0 4px">Flujo de caja mensual</h3>
    <table>
      <thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Neto</th></tr></thead>
      <tbody>
        ${data.cashSeries.map((bucket) => `<tr>
          <td>${esc(bucket.label)}</td>
          <td class="num">${money(bucket.income)}</td>
          <td class="num">${money(bucket.expense)}</td>
          <td class="num">${money(round2(bucket.income - bucket.expense))}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:20px 0 4px">Cartera por cliente</h3>
    <table>
      <thead><tr><th>Cliente</th><th class="num">Préstamos</th><th class="num">Capital</th><th class="num">Pagado</th><th class="num">Saldo</th><th class="num">Mora</th></tr></thead>
      <tbody>
        ${data.clientRows.length
          ? data.clientRows.map((row) => `<tr>
              <td>${esc(row.client?.name || '—')}</td>
              <td class="num">${row.loans}</td>
              <td class="num">${money(row.principal)}</td>
              <td class="num">${money(row.paid)}</td>
              <td class="num">${money(row.balance)}</td>
              <td class="num">${money(row.late)}</td>
            </tr>`).join('')
          : '<tr><td colspan="6">Sin cartera activa.</td></tr>'}
      </tbody>
    </table>

    <h3 style="font-size:13px;margin:20px 0 4px">Rentabilidad por préstamo</h3>
    <table>
      <thead><tr><th>Préstamo</th><th>Cliente</th><th class="num">Capital</th><th class="num">Interés cobrado</th><th class="num">Mora cobrada</th><th class="num">Saldo</th><th>Estado</th></tr></thead>
      <tbody>
        ${data.loanRows.length
          ? data.loanRows.map((loan) => `<tr>
              <td>${esc(loan.code)}</td>
              <td>${esc(getClient(loan.clientId)?.name || '—')}</td>
              <td class="num">${money(loan.totals.principal)}</td>
              <td class="num">${money(loan.totals.paidInterest)}</td>
              <td class="num">${money(loan.totals.paidLate)}</td>
              <td class="num">${money(loan.totals.balance)}</td>
              <td>${esc(loanStateMeta(loan.state).label)}</td>
            </tr>`).join('')
          : '<tr><td colspan="7">Sin préstamos registrados.</td></tr>'}
      </tbody>
    </table>

    <div class="receipt-note">Documento generado por Préstamos Pro. Las cifras de cartera corresponden a la fecha de emisión y pueden variar con nuevos pagos o movimientos.</div>
    <div class="receipt-foot">
      <div class="receipt-sign">Preparado por</div>
      <div class="receipt-sign">Revisado por</div>
    </div>
  </div>`;

  actions.printHTML(html, `Reporte · ${data.bounds.label}`);
}

/* ---------- vista ---------- */

export function render(root: HTMLElement, _ctx: ViewContext): void {
  const data = collect();
  const hasAnyData = state.db.loans.length || state.db.payments.length || state.db.transactions.length;

  root.innerHTML = `<div class="page">
    <div class="toolbar report-toolbar">
      <div class="report-range">
        ${segmented(
          [
            { value: 'month', label: 'Este mes' },
            { value: 'prev', label: 'Mes anterior' },
            { value: '90', label: '90 días' },
            { value: 'year', label: 'Este año' },
            { value: 'all', label: 'Todo' },
          ],
          filters.range,
          'range',
        )}
      </div>
      <div class="toolbar-spacer"></div>
      <span class="report-period">${icon('calendar', 15)} ${esc(data.bounds.label)}${data.bounds.from ? ` · ${formatDate(data.bounds.from, 'short')} — ${formatDate(data.bounds.to, 'short')}` : ''}</span>
      <button class="btn btn-outline btn-sm" type="button" data-export="overview">${icon('download', 15)} CSV</button>
      <button class="btn btn-primary btn-sm" type="button" data-print>${icon('print', 15)} Imprimir reporte</button>
    </div>

    ${summaryStrip(data)}

    <div class="row-inline justify-between mb-2" style="flex-wrap:wrap;gap:10px">
      ${tabs(
        [
          { value: 'overview', label: 'Resumen', icon: 'chart' },
          { value: 'portfolio', label: 'Cartera', icon: 'users' },
          { value: 'profitability', label: 'Rentabilidad', icon: 'trending-up' },
        ],
        filters.tab,
      )}
      <div class="inline-metrics">
        <div class="inline-metric"><span>Cobros del período</span><strong>${data.payments.length}</strong></div>
        <div class="inline-metric"><span>Promedio por cobro</span><strong>${money(data.paymentAverage)}</strong></div>
        <div class="inline-metric"><span>Resultado de caja</span><strong class="${data.net >= 0 ? 'money--income' : 'money--expense'}">${money(data.net)}</strong></div>
      </div>
    </div>

    ${hasAnyData
      ? reportBody(data)
      : `<section class="card"><div class="card-body">${emptyState({
          title: 'Todavía no hay datos para reportar',
          text: 'Registra clientes, préstamos y movimientos para obtener análisis de cartera, cobranza y rentabilidad.',
          iconName: 'chart',
          action: `<div class="row-inline" style="gap:8px;flex-wrap:wrap;justify-content:center">
            <button class="btn btn-primary" type="button" data-new-loan>${icon('plus', 16)} Nuevo préstamo</button>
            <button class="btn btn-outline" type="button" data-demo>${icon('sparkles', 16)} Cargar datos de ejemplo</button>
          </div>`,
        })}</div></section>`}

    <div class="report-note">
      ${icon('info', 14)}
      <span>La utilidad del período corresponde a intereses, mora y cargos efectivamente cobrados. La cartera y la mora pendiente se calculan a la fecha de hoy.</span>
    </div>
  </div>`;

  root.querySelectorAll<HTMLElement>('[data-segmented="range"] [data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.range = btn.dataset.value || 'month';
      render(root, _ctx);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      filters.tab = tab.dataset.tab || 'overview';
      render(root, _ctx);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-tab-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.tab = btn.dataset.tabJump || 'overview';
      render(root, _ctx);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () => exportReport(btn.dataset.export || 'overview', data));
  });
  root.querySelector<HTMLElement>('[data-print]')!.addEventListener('click', printReport);
  root.querySelectorAll<HTMLElement>('[data-new-loan]').forEach((btn) => btn.addEventListener('click', () => actions.openLoanForm()));
  root.querySelectorAll<HTMLElement>('[data-demo]').forEach((btn) => btn.addEventListener('click', () => actions.loadDemoFlow({ confirm: false })));
  root.querySelectorAll<HTMLElement>('[data-client]').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.client) navigate(`client/${el.dataset.client}`);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-loan]').forEach((el) => {
    el.addEventListener('click', () => navigate(`loan/${el.dataset.loan || ''}`));
  });
}

/* La barra superior puede solicitar la impresión desde cualquier sección. */
window.addEventListener('report:print', printReport);
