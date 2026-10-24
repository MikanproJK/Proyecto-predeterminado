/* ============================================================
   Motor financiero de Préstamos Pro
   Cálculos puros: sin DOM, sin estado global (excepto formato).
   ============================================================ */

const DAY_MS = 86400000;

/* ---------- utilidades numéricas ---------- */

export function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number.parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round2(value) {
  const n = num(value);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function sum(list, pick = (x) => x) {
  return (list || []).reduce((acc, item) => acc + num(pick(item)), 0);
}

export function uid(prefix = 'id') {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

/* ---------- fechas (ISO yyyy-mm-dd, sin problemas de zona horaria) ---------- */

export function toISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(date = new Date()) {
  return toISO(date);
}

export function isoToDate(iso) {
  if (!iso) return new Date(NaN);
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysISO(iso, days) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + Number(days || 0));
  return toISO(d);
}

export function addMonthsISO(iso, months) {
  const d = isoToDate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(months || 0));
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

export function daysBetween(fromISO, toISOValue) {
  const a = isoToDate(fromISO);
  const b = isoToDate(toISOValue);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

export function monthKey(iso) {
  return String(iso || '').slice(0, 7);
}

export function maxISO(a, b) {
  return String(a || '') >= String(b || '') ? a : b;
}

/* ---------- formato ---------- */

let FORMAT = { currency: 'USD', locale: 'es-419' };
let moneyFmt = null;
let numFmt = null;

export function configureFormat({ currency, locale } = {}) {
  if (currency) FORMAT.currency = currency;
  if (locale) FORMAT.locale = locale;
  moneyFmt = null;
  numFmt = null;
}

export function getFormat() {
  return { ...FORMAT };
}

function buildMoney() {
  if (moneyFmt) return moneyFmt;
  try {
    moneyFmt = new Intl.NumberFormat(FORMAT.locale || 'es-419', {
      style: 'currency',
      currency: FORMAT.currency || 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    moneyFmt = new Intl.NumberFormat('es-419', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  }
  return moneyFmt;
}

export function money(value, { sign = false, compact = false } = {}) {
  const n = num(value);
  if (compact && Math.abs(n) >= 1000000) {
    const f = buildMoney().format(n / 1000000);
    return `${f.replace(/\d{3}.*?(?=\D|$)/, '')}M`;
  }
  const text = buildMoney().format(n);
  if (sign && n > 0) return `+${text}`;
  return text;
}

export function number(value, digits = 0) {
  if (!numFmt) {
    numFmt = new Intl.NumberFormat(FORMAT.locale || 'es-419', {
      minimumFractionDigits: digits,
      maximumFractionDigits: Math.max(digits, 2),
    });
  }
  return numFmt.format(num(value));
}

export function pct(value, digits = 0) {
  return `${num(value).toFixed(digits)}%`;
}

export function formatDate(iso, variant = 'medium') {
  if (!iso) return '—';
  const d = isoToDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const opts =
    variant === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : variant === 'short'
        ? { day: '2-digit', month: 'short' }
        : variant === 'month'
          ? { month: 'short', year: 'numeric' }
          : { day: '2-digit', month: 'short', year: 'numeric' };
  try {
    return new Intl.DateTimeFormat(FORMAT.locale || 'es-419', opts).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function monthLabel(key, variant = 'short') {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return key || '—';
  const d = new Date(y, m - 1, 1, 12);
  try {
    return new Intl.DateTimeFormat(FORMAT.locale || 'es-419', {
      month: variant,
      year: '2-digit',
    }).format(d);
  } catch {
    return key;
  }
}

export function daysLabel(days) {
  const n = Math.round(num(days));
  if (n === 0) return 'hoy';
  if (n === 1) return '1 día';
  if (n === -1) return 'hace 1 día';
  return n > 0 ? `${n} días` : `hace ${Math.abs(n)} días`;
}

/* ---------- frecuencias y tasas ---------- */

export const FREQUENCIES = [
  { value: 'daily', label: 'Diario', unit: 'día', days: 1 },
  { value: 'weekly', label: 'Semanal', unit: 'semana', days: 7 },
  { value: 'biweekly', label: 'Quincenal', unit: 'quincena', days: 15 },
  { value: 'monthly', label: 'Mensual', unit: 'mes', months: 1 },
  { value: 'custom', label: 'Personalizado', unit: 'período', days: 15 },
];

export const AMORTIZATIONS = [
  { value: 'fixed', label: 'Cuota fija', hint: 'Cuotas iguales (sistema francés)' },
  { value: 'declining', label: 'Abono fijo a capital', hint: 'Capital constante, cuota decreciente' },
  { value: 'flat', label: 'Interés global', hint: 'Interés fijo sobre el capital inicial' },
  { value: 'bullet', label: 'Solo interés', hint: 'Intereses periódicos y capital al final' },
];

export const RATE_TYPES = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
  { value: 'period', label: 'Por cuota' },
];

export const LATE_FEE_TYPES = [
  { value: 'none', label: 'Sin mora' },
  { value: 'percent_daily', label: '% diario sobre saldo' },
  { value: 'percent_monthly', label: '% mensual sobre saldo' },
  { value: 'fixed_daily', label: 'Monto fijo por día' },
  { value: 'fixed_once', label: 'Monto fijo por cuota vencida' },
];

export const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Tarjeta',
  'Depósito',
  'Billetera digital',
  'Cheque',
  'Otro',
];

export function frequencyMeta(value) {
  return FREQUENCIES.find((f) => f.value === value) || FREQUENCIES[3];
}

export function periodDays(loan) {
  const meta = frequencyMeta(loan.frequency);
  if (meta.months) return 30;
  if (loan.frequency === 'custom') return Math.max(1, Math.round(num(loan.customDays) || 15));
  return meta.days;
}

export function periodRate(loan) {
  const rate = num(loan.interestRate) / 100;
  const days = periodDays(loan);
  switch (loan.rateType) {
    case 'annual':
      return rate * (days / 365);
    case 'period':
      return rate;
    case 'monthly':
    default:
      return rate * (days / 30);
  }
}

export function dueDateFor(loan, firstDueDate, index) {
  const base = firstDueDate || loan.firstDueDate || loan.startDate || todayISO();
  switch (loan.frequency) {
    case 'monthly':
      return addMonthsISO(base, index);
    case 'daily':
    case 'weekly':
    case 'biweekly':
      return addDaysISO(base, periodDays(loan) * index);
    case 'custom':
    default:
      return addDaysISO(base, periodDays(loan) * index);
  }
}

/* ---------- cronograma ---------- */

/**
 * Genera el plan de pagos teórico del préstamo.
 * Devuelve filas con capital, interés, cargo inicial, cuota y saldo.
 */
export function buildSchedule(loan) {
  const periods = Math.max(1, Math.round(num(loan.installments) || 1));
  const principal = round2(num(loan.principal));
  const rate = periodRate(loan);
  const method = loan.amortization || 'fixed';
  const first = loan.firstDueDate || loan.startDate || todayISO();
  const extraCharge = round2(num(loan.fees));
  const grace = Math.max(0, Math.round(num(loan.graceDays)));

  const rows = [];
  let balance = principal;
  const fixedPayment = rate > 0 ? (principal * rate) / (1 - Math.pow(1 + rate, -periods)) : principal / periods;
  const fixedCapital = principal / periods;

  for (let k = 1; k <= periods; k += 1) {
    let interest = 0;
    let capital = 0;

    if (method === 'bullet') {
      interest = round2(balance * rate);
      capital = k === periods ? round2(balance) : 0;
    } else if (method === 'flat') {
      interest = round2(principal * rate);
      capital = k === periods ? round2(balance) : round2(fixedCapital);
    } else if (method === 'declining') {
      interest = round2(balance * rate);
      capital = k === periods ? round2(balance) : round2(fixedCapital);
    } else {
      interest = round2(balance * rate);
      capital = k === periods ? round2(balance) : round2(fixedPayment - interest);
    }

    if (capital > balance) capital = round2(balance);
    if (capital < 0) capital = 0;
    if (k === periods) capital = round2(balance);

    const charge = k === 1 ? extraCharge : 0;
    const amount = round2(capital + interest + charge);
    balance = round2(balance - capital);

    rows.push({
      n: k,
      dueDate: dueDateFor(loan, first, k - 1),
      capital: round2(capital),
      interest: round2(interest),
      charge: round2(charge),
      amount,
      balance,
      graceUntil: addDaysISO(dueDateFor(loan, first, k - 1), grace),
    });
  }

  return rows;
}

function lateFeeFor(base, fromISO, toISOValue, loan) {
  if (base <= 0.004) return 0;
  const days = daysBetween(fromISO, toISOValue);
  if (days <= 0) return 0;
  const value = num(loan.lateFeeValue);
  if (value <= 0) return 0;
  switch (loan.lateFeeType) {
    case 'percent_daily':
      return round2((base * value * days) / 100);
    case 'percent_monthly':
      return round2((base * value * days) / 100 / 30);
    case 'fixed_daily':
      return round2(value * days);
    default:
      return 0;
  }
}

/**
 * Calcula el estado real del préstamo aplicando los pagos en orden cronológico.
 */
export function computeLoan(loan, payments = [], asOf = todayISO()) {
  const asOfDate = asOf || todayISO();
  const rows = buildSchedule(loan).map((row) => ({
    ...row,
    paidInterest: 0,
    paidCapital: 0,
    paidCharge: 0,
    latePaid: 0,
    lateUnpaid: 0,
    feeSettledTo: null,
    fixedFeeCharged: false,
  }));

  const list = (payments || [])
    .filter((p) => p && (!p.loanId || p.loanId === loan.id))
    .slice()
    .sort((a, b) => {
      const byDate = String(a.date || '').localeCompare(String(b.date || ''));
      if (byDate !== 0) return byDate;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

  const lateType = loan.lateFeeType || 'none';
  const grace = Math.max(0, Math.round(num(loan.graceDays)));
  let totalPaidInput = 0;

  for (const payment of list) {
    let available = round2(num(payment.amount));
    totalPaidInput = round2(totalPaidInput + available);
    if (available <= 0) continue;
    const when = payment.date && payment.date < asOfDate ? payment.date : asOfDate;

    for (const row of rows) {
      if (available <= 0.004) break;
      const remaining = round2(row.amount - row.paidInterest - row.paidCapital - row.paidCharge);
      if (remaining <= 0.004) continue;

      /* 1. mora acumulada desde el último corte */
      if (lateType !== 'none') {
        const start = row.feeSettledTo || row.graceUntil || row.dueDate;
        if (lateType === 'fixed_once') {
          if (!row.fixedFeeCharged && daysBetween(row.graceUntil, when) > 0) {
            const fee = round2(num(loan.lateFeeValue));
            const paid = Math.min(available, fee);
            row.latePaid = round2(row.latePaid + paid);
            row.lateUnpaid = round2(row.lateUnpaid + fee - paid);
            available = round2(available - paid);
            row.fixedFeeCharged = true;
          }
        } else if (daysBetween(start, when) > 0) {
          const fee = lateFeeFor(remaining, start, when, loan);
          if (fee > 0) {
            const paid = Math.min(available, fee);
            row.latePaid = round2(row.latePaid + paid);
            row.lateUnpaid = round2(row.lateUnpaid + fee - paid);
            available = round2(available - paid);
            row.feeSettledTo = when;
          }
        }
      }

      if (available <= 0.004) break;

      /* 2. cargo inicial (comisión) */
      const chargeLeft = round2(row.charge - row.paidCharge);
      if (chargeLeft > 0) {
        const paid = Math.min(available, chargeLeft);
        row.paidCharge = round2(row.paidCharge + paid);
        available = round2(available - paid);
      }

      /* 3. interés */
      const interestLeft = round2(row.interest - row.paidInterest);
      if (interestLeft > 0 && available > 0.004) {
        const paid = Math.min(available, interestLeft);
        row.paidInterest = round2(row.paidInterest + paid);
        available = round2(available - paid);
      }

      /* 4. capital */
      const capitalLeft = round2(row.capital - row.paidCapital);
      if (capitalLeft > 0 && available > 0.004) {
        const paid = Math.min(available, capitalLeft);
        row.paidCapital = round2(row.paidCapital + paid);
        available = round2(available - paid);
      }
    }
  }

  /* vista a la fecha de corte: mora devengada y estado de cada cuota */
  const lateType2 = lateType;
  for (const row of rows) {
    const remaining = round2(
      row.amount - row.paidInterest - row.paidCapital - row.paidCharge,
    );
    row.remaining = remaining;
    row.paid = round2(row.paidInterest + row.paidCapital + row.paidCharge);
    row.lateDue = 0;

    if (remaining > 0.004) {
      if (lateType2 !== 'none' && lateType2 !== 'fixed_once') {
        const start = row.feeSettledTo || row.graceUntil || row.dueDate;
        if (daysBetween(start, asOfDate) > 0) {
          row.lateDue = lateFeeFor(remaining, start, asOfDate, loan);
        }
      } else if (lateType2 === 'fixed_once') {
        if (!row.fixedFeeCharged && daysBetween(row.graceUntil, asOfDate) > 0) {
          row.lateDue = round2(num(loan.lateFeeValue));
        }
      }
    }
    row.lateDue = round2(row.lateDue + row.lateUnpaid);

    if (remaining <= 0.004 && row.lateDue <= 0.004) row.state = 'paid';
    else if (row.dueDate < asOfDate) row.state = remaining <= 0.004 ? 'late' : row.paid > 0.004 ? 'partial_overdue' : 'overdue';
    else if (row.paid > 0.004) row.state = 'partial';
    else row.state = 'pending';

    row.overdueDays =
      remaining > 0.004 ? Math.max(0, daysBetween(row.dueDate, asOfDate) - grace) : 0;
  }

  const totals = {
    principal: round2(sum(rows, (r) => r.capital)),
    interest: round2(sum(rows, (r) => r.interest)),
    charges: round2(sum(rows, (r) => r.charge)),
    toPay: round2(sum(rows, (r) => r.amount)),
    paidCapital: round2(sum(rows, (r) => r.paidCapital)),
    paidInterest: round2(sum(rows, (r) => r.paidInterest)),
    paidCharges: round2(sum(rows, (r) => r.paidCharge)),
    paidLate: round2(sum(rows, (r) => r.latePaid)),
    paid: round2(sum(rows, (r) => r.paid)),
    remaining: round2(sum(rows, (r) => r.remaining)),
    remainingCapital: round2(sum(rows, (r) => r.capital - r.paidCapital)),
    remainingInterest: round2(sum(rows, (r) => r.interest - r.paidInterest)),
    lateDue: round2(sum(rows, (r) => r.lateDue)),
  };
  totals.applied = round2(totals.paid + totals.paidLate);
  totals.credit = round2(Math.max(0, totalPaidInput - totals.applied));
  totals.totalPaid = totalPaidInput;
  totals.balance = round2(totals.remaining + totals.lateDue);
  totals.payoff = totals.balance;

  const overdueRows = rows.filter((r) => r.remaining > 0.004 && r.dueDate < asOfDate);
  totals.overdueCount = overdueRows.length;
  totals.overdueAmount = round2(sum(overdueRows, (r) => r.remaining) + totals.lateDue);
  totals.overdueDays = overdueRows.length
    ? Math.max(...overdueRows.map((r) => Math.max(0, daysBetween(r.dueDate, asOfDate) - grace)))
    : 0;

  const nextRow = rows.find((r) => r.remaining > 0.004);
  totals.nextDueDate = nextRow ? nextRow.dueDate : null;
  totals.nextDueAmount = nextRow ? round2(nextRow.remaining + (nextRow.lateDue || 0)) : 0;
  totals.progress = totals.toPay > 0 ? clamp(totals.paid / totals.toPay, 0, 1) : 0;
  totals.lastPaymentDate = list.length ? list[list.length - 1].date : null;

  let state = 'active';
  if (loan.status === 'cancelled') state = 'cancelled';
  else if (totals.remaining <= 0.01 && totals.lateDue <= 0.01) state = 'paid';
  else if (overdueRows.length > 0 || totals.lateDue > 0.01) state = 'overdue';
  else if (loan.status === 'draft') state = 'draft';

  const view = {
    ...loan,
    rows,
    totals,
    state,
    paidRatio: totals.progress,
    paymentsCount: list.length,
  };
  return view;
}

export const LOAN_STATES = {
  active: { label: 'Al día', tone: 'success' },
  overdue: { label: 'En mora', tone: 'danger' },
  paid: { label: 'Pagado', tone: 'info' },
  cancelled: { label: 'Cancelado', tone: 'muted' },
  draft: { label: 'Borrador', tone: 'muted' },
};

export function loanStateMeta(state) {
  return LOAN_STATES[state] || LOAN_STATES.active;
}

/* ---------- simulación de pago (vista previa antes de guardar) ---------- */

export function simulatePayment(loan, payments, hypothetical, asOf) {
  const base = computeLoan(loan, payments, asOf);
  const withPayment = computeLoan(loan, [...payments, hypothetical], asOf);
  return {
    before: base.totals,
    after: withPayment.totals,
    applied: {
      late: round2(withPayment.totals.paidLate - base.totals.paidLate),
      charges: round2(withPayment.totals.paidCharges - base.totals.paidCharges),
      interest: round2(withPayment.totals.paidInterest - base.totals.paidInterest),
      capital: round2(withPayment.totals.paidCapital - base.totals.paidCapital),
    },
    credit: withPayment.totals.credit,
    loan: withPayment,
  };
}

/* ---------- agregados ---------- */

export function buildLoanViews(loans, payments, asOf = todayISO()) {
  const byLoan = new Map();
  for (const payment of payments || []) {
    if (!byLoan.has(payment.loanId)) byLoan.set(payment.loanId, []);
    byLoan.get(payment.loanId).push(payment);
  }
  return (loans || []).map((loan) => computeLoan(loan, byLoan.get(loan.id) || [], asOf));
}

export function portfolioSummary(loanViews) {
  const active = loanViews.filter((l) => l.state !== 'cancelled');
  const total = {
    count: active.length,
    activeCount: active.filter((l) => l.state === 'active').length,
    overdueCount: active.filter((l) => l.state === 'overdue').length,
    paidCount: active.filter((l) => l.state === 'paid').length,
    principal: round2(sum(active, (l) => l.totals.principal)),
    outstanding: round2(sum(active, (l) => l.totals.balance)),
    outstandingCapital: round2(sum(active, (l) => l.totals.remainingCapital)),
    lateDue: round2(sum(active, (l) => l.totals.lateDue)),
    toPay: round2(sum(active, (l) => l.totals.toPay)),
    paid: round2(sum(active, (l) => l.totals.paid)),
    paidInterest: round2(sum(active, (l) => l.totals.paidInterest)),
    paidLate: round2(sum(active, (l) => l.totals.paidLate)),
    overdueAmount: round2(sum(active, (l) => l.totals.overdueAmount)),
  };
  total.progress = total.toPay > 0 ? total.paid / total.toPay : 0;
  return total;
}

export function accountBalance(account, transactions) {
  let balance = num(account.openingBalance);
  for (const t of transactions || []) {
    const amount = num(t.amount);
    if (t.type === 'income' && t.accountId === account.id) balance += amount;
    else if (t.type === 'expense' && t.accountId === account.id) balance -= amount;
    else if (t.type === 'transfer') {
      if (t.accountId === account.id) balance -= amount;
      if (t.toAccountId === account.id) balance += amount;
    }
  }
  return round2(balance);
}

export function transactionsSummary(transactions, fromISO, toISOValue) {
  const list = (transactions || []).filter(
    (t) => (!fromISO || t.date >= fromISO) && (!toISOValue || t.date <= toISOValue),
  );
  const income = round2(sum(list.filter((t) => t.type === 'income'), (t) => t.amount));
  const expense = round2(sum(list.filter((t) => t.type === 'expense'), (t) => t.amount));
  return { income, expense, net: round2(income - expense), count: list.length, list };
}

export function monthlySeries(items, { months = 6, datePick = (x) => x.date, amountPick = (x) => x.amount, typePick = null, asOf = todayISO() } = {}) {
  const anchor = isoToDate(asOf);
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1, 12);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: monthLabel(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`),
      income: 0,
      expense: 0,
    });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const item of items || []) {
    const key = monthKey(datePick(item));
    const bucket = map.get(key);
    if (!bucket) continue;
    const amount = num(amountPick(item));
    const type = typePick ? typePick(item) : 'income';
    if (type === 'expense') bucket.expense = round2(bucket.expense + amount);
    else bucket.income = round2(bucket.income + amount);
  }
  return buckets;
}

export function daysLateLabel(dueISO, asOf = todayISO()) {
  const days = Math.max(0, daysBetween(dueISO, asOf));
  if (days === 0) return 'vence hoy';
  if (days === 1) return '1 día de atraso';
  return `${days} días de atraso`;
}

export function nextInstallment(loanView) {
  return loanView.rows.find((r) => r.remaining > 0.004) || null;
}

export function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCSV(headers, rows, separator = ';') {
  const head = headers.map(csvEscape).join(separator);
  const body = rows
    .map((row) => row.map((cell) => csvEscape(typeof cell === 'number' ? round2(cell) : cell)).join(separator))
    .join('\r\n');
  return `\uFEFF${head}\r\n${body}`;
}
