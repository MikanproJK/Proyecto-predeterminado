/* ============================================================
   Motor financiero de Préstamos Pro
   Cálculos puros: sin DOM, sin estado global (excepto formato).
   ============================================================ */

import type {
  Account,
  Amortization,
  BadgeTone,
  Frequency,
  ISODate,
  InstallmentState,
  InterestMode,
  LateFeeType,
  Loan,
  LoanId,
  LoanScheduleRow,
  LoanState,
  LoanTerms,
  LoanTotals,
  LoanView,
  MonthlyBucket,
  PaymentLike,
  PaymentMethod,
  PaymentSimulation,
  PortfolioSummary,
  RateType,
  ScheduleRow,
  TransactionLike,
  TransactionsSummary,
} from './types.js';
import { currencyMeta, DEFAULT_CURRENCY } from './lib/currencies.js';
import type { CurrencyMeta } from './lib/currencies.js';

const DAY_MS = 86400000;

/* ---------- utilidades numéricas ---------- */

export function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number.parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round2(value: unknown): number {
  const n = num(value);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sum<T>(
  list: readonly T[] | null | undefined,
  pick: (item: T) => unknown = (item) => item,
): number {
  return (list || []).reduce((acc, item) => acc + num(pick(item)), 0);
}

export function uid(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

/* ---------- fechas (ISO yyyy-mm-dd, sin problemas de zona horaria) ---------- */

export function toISO(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(date: Date = new Date()): string {
  return toISO(date);
}

export function isoToDate(iso?: string | null): Date {
  if (!iso) return new Date(NaN);
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysISO(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + Number(days || 0));
  return toISO(d);
}

export function addMonthsISO(iso: string, months: number): string {
  const d = isoToDate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(months || 0));
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

export function daysBetween(fromISO: string, toISOValue: string): number {
  const a = isoToDate(fromISO);
  const b = isoToDate(toISOValue);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

export function monthKey(iso?: string | null): string {
  return String(iso || '').slice(0, 7);
}

export function maxISO(a: string, b: string): string {
  return String(a || '') >= String(b || '') ? a : b;
}

/* ---------- formato ---------- */

interface FormatConfig {
  currency?: string;
  locale?: string;
}

interface MoneyFormatter {
  key: string;
  meta: CurrencyMeta;
  decimal: Intl.NumberFormat;
}

let FORMAT: Required<FormatConfig> = { currency: DEFAULT_CURRENCY, locale: 'es-419' };
let moneyFmt: MoneyFormatter | null = null;
const compactFmts = new Map<string, Intl.NumberFormat>();
const numberFmts = new Map<string, Intl.NumberFormat>();

export function configureFormat({ currency, locale }: FormatConfig = {}): void {
  if (currency) FORMAT.currency = currency;
  if (locale) FORMAT.locale = locale;
  moneyFmt = null;
  compactFmts.clear();
  numberFmts.clear();
}

export function getFormat(): Required<FormatConfig> {
  return { ...FORMAT };
}

function buildMoney(): MoneyFormatter {
  const meta = currencyMeta(FORMAT.currency);
  const locale = FORMAT.locale || 'es-419';
  const key = `${meta.code}|${locale}|${meta.decimals}`;
  if (moneyFmt?.key === key) return moneyFmt;
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
    useGrouping: true,
  };
  let decimal: Intl.NumberFormat;
  try {
    decimal = new Intl.NumberFormat(locale, options);
  } catch {
    decimal = new Intl.NumberFormat('es-419', options);
  }
  moneyFmt = { key, meta, decimal };
  return moneyFmt;
}

function buildCompact(digits: number): Intl.NumberFormat {
  const locale = FORMAT.locale || 'es-419';
  const key = `${locale}|${digits}`;
  const cached = compactFmts.get(key);
  if (cached) return cached;
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  };
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(locale, options);
  } catch {
    fmt = new Intl.NumberFormat('es-419', options);
  }
  compactFmts.set(key, fmt);
  return fmt;
}

export function money(value: unknown, { sign = false, compact = false }: { sign?: boolean; compact?: boolean } = {}): string {
  const n = num(value);
  const { meta, decimal } = buildMoney();
  const negative = n < 0;
  const abs = Math.abs(n);
  let body: string;
  if (compact && abs >= 1000000) {
    const scaled = abs / 1000000;
    const digits = scaled >= 100 ? 0 : 1;
    body = `${buildCompact(digits).format(scaled)}M`;
  } else {
    body = decimal.format(abs);
  }
  const prefix = negative ? '-' : sign && n > 0 ? '+' : '';
  return `${prefix}${meta.symbol}${body}`;
}

export function number(value: unknown, digits = 0): string {
  const locale = FORMAT.locale || 'es-419';
  const min = Math.max(0, Math.round(digits));
  const key = `${locale}|${min}`;
  let fmt = numberFmts.get(key);
  if (!fmt) {
    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: min,
      maximumFractionDigits: min,
    };
    try {
      fmt = new Intl.NumberFormat(locale, options);
    } catch {
      fmt = new Intl.NumberFormat('es-419', options);
    }
    numberFmts.set(key, fmt);
  }
  return fmt.format(num(value));
}

export function pct(value: unknown, digits = 0): string {
  return `${num(value).toFixed(digits)}%`;
}

export type DateVariant = 'medium' | 'long' | 'short' | 'month';

export function formatDate(iso?: string | null, variant: DateVariant = 'medium'): string {
  if (!iso) return '—';
  const d = isoToDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const opts: Intl.DateTimeFormatOptions =
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

export function monthLabel(key: string, variant: Intl.DateTimeFormatOptions['month'] = 'short'): string {
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

export function daysLabel(days: unknown): string {
  const n = Math.round(num(days));
  if (n === 0) return 'hoy';
  if (n === 1) return '1 día';
  if (n === -1) return 'hace 1 día';
  return n > 0 ? `${n} días` : `hace ${Math.abs(n)} días`;
}

/* ---------- frecuencias y tasas ---------- */

export interface FrequencyMeta {
  value: Frequency;
  label: string;
  unit: string;
  days: number;
  months?: number;
}

export interface AmortizationMeta {
  value: Amortization;
  label: string;
  hint: string;
}

export interface RateTypeMeta {
  value: RateType;
  label: string;
}

export interface LateFeeTypeMeta {
  value: LateFeeType;
  label: string;
}

export const FREQUENCIES: readonly FrequencyMeta[] = [
  { value: 'daily', label: 'Diario', unit: 'día', days: 1 },
  { value: 'weekly', label: 'Semanal', unit: 'semana', days: 7 },
  { value: 'biweekly', label: 'Quincenal', unit: 'quincena', days: 15 },
  { value: 'monthly', label: 'Mensual', unit: 'mes', months: 1, days: 30 },
  { value: 'custom', label: 'Personalizado', unit: 'período', days: 15 },
];

export const AMORTIZATIONS: readonly AmortizationMeta[] = [
  { value: 'fixed', label: 'Cuota fija', hint: 'Cuotas iguales (sistema francés)' },
  { value: 'declining', label: 'Abono fijo a capital', hint: 'Capital constante, cuota decreciente' },
  { value: 'flat', label: 'Interés global', hint: 'Interés fijo sobre el capital inicial' },
  { value: 'bullet', label: 'Solo interés', hint: 'Intereses periódicos y capital al final' },
];

export const RATE_TYPES: readonly RateTypeMeta[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
  { value: 'period', label: 'Por cuota' },
];

export interface InterestModeMeta {
  value: InterestMode;
  label: string;
  short: string;
  hint: string;
}

export const INTEREST_MODES: readonly InterestModeMeta[] = [
  {
    value: 'percent',
    label: 'Porcentaje',
    short: 'Tasa de interés',
    hint: 'Se calcula un porcentaje sobre el capital o el saldo, según la base de la tasa.',
  },
  {
    value: 'fixed_total',
    label: 'Monto fijo total',
    short: 'Interés total',
    hint: 'Un monto exacto de interés para todo el préstamo. Se reparte entre las cuotas.',
  },
  {
    value: 'fixed_installment',
    label: 'Monto fijo por cuota',
    short: 'Interés por cuota',
    hint: 'El mismo monto de interés se suma a cada cuota del plan.',
  },
  {
    value: 'fixed_period',
    label: 'Monto fijo por período',
    short: 'Interés por período',
    hint: 'El monto se cobra en cada período mientras exista saldo pendiente.',
  },
];

export function interestModeMeta(value?: string | null): InterestModeMeta {
  return INTEREST_MODES.find((mode) => mode.value === value) || INTEREST_MODES[0];
}

export function interestModeOf(loan: LoanTerms): InterestMode {
  const mode = loan.interestMode;
  return mode === 'fixed_total' || mode === 'fixed_installment' || mode === 'fixed_period' ? mode : 'percent';
}

export function isFixedInterest(loan: LoanTerms): boolean {
  return interestModeOf(loan) !== 'percent';
}

/** Texto corto y consistente para mostrar el interés pactado en listados y documentos. */
export function interestSummary(loan: LoanTerms): string {
  const mode = interestModeOf(loan);
  if (mode === 'percent') {
    const base = RATE_TYPES.find((rate) => rate.value === loan.rateType)?.label || 'Mensual';
    return `${num(loan.interestRate)}% ${base.toLowerCase()}`;
  }
  const amount = money(num(loan.fixedInterest));
  if (mode === 'fixed_total') return `Interés total ${amount}`;
  if (mode === 'fixed_installment') return `${amount} por cuota`;
  return `${amount} por período`;
}

export const LATE_FEE_TYPES: readonly LateFeeTypeMeta[] = [
  { value: 'none', label: 'Sin mora' },
  { value: 'percent_daily', label: '% diario sobre saldo' },
  { value: 'percent_monthly', label: '% mensual sobre saldo' },
  { value: 'fixed_daily', label: 'Monto fijo por día' },
  { value: 'fixed_once', label: 'Monto fijo por cuota vencida' },
];

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'Efectivo',
  'Transferencia',
  'Tarjeta',
  'Depósito',
  'Billetera digital',
  'Cheque',
  'Otro',
];

export function frequencyMeta(value?: string | null): FrequencyMeta {
  return FREQUENCIES.find((f) => f.value === value) || FREQUENCIES[3];
}

export function periodDays(loan: LoanTerms): number {
  const meta = frequencyMeta(loan.frequency);
  if (meta.months) return 30;
  if (loan.frequency === 'custom') return Math.max(1, Math.round(num(loan.customDays) || 15));
  return meta.days;
}

export function periodRate(loan: LoanTerms): number {
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

export function dueDateFor(loan: LoanTerms, firstDueDate: string | undefined, index: number): string {
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
 * Reparte un interés total fijo entre los períodos respetando la forma del
 * método de amortización. La suma siempre coincide exactamente con el monto.
 */
function distributeFixedInterest(
  total: number,
  principal: number,
  periods: number,
  method: Amortization,
): number[] {
  const safeTotal = round2(Math.max(0, total));
  if (safeTotal <= 0) return Array.from({ length: periods }, () => 0);

  const weights: number[] = [];
  if (method === 'flat' || method === 'bullet') {
    for (let k = 0; k < periods; k += 1) weights.push(1);
  } else {
    // Interés decreciente: proporcional al saldo con abono constante a capital.
    let balance = principal;
    const capital = principal / periods;
    for (let k = 0; k < periods; k += 1) {
      weights.push(Math.max(0, balance));
      balance -= capital;
    }
  }

  const weightSum = weights.reduce((acc, value) => acc + value, 0) || 1;
  const plan: number[] = [];
  let remaining = safeTotal;
  for (let k = 0; k < periods; k += 1) {
    if (k === periods - 1) {
      plan.push(round2(remaining));
    } else {
      const value = round2((safeTotal * weights[k]) / weightSum);
      plan.push(value);
      remaining = round2(remaining - value);
    }
  }
  return plan;
}

export class LoanCalculator {
  periodDays(loan: LoanTerms): number {
    return periodDays(loan);
  }

  periodRate(loan: LoanTerms): number {
    return periodRate(loan);
  }

  dueDateFor(loan: LoanTerms, firstDueDate: string | undefined, index: number): string {
    return dueDateFor(loan, firstDueDate, index);
  }

  /**
   * Genera el plan de pagos teórico del préstamo.
   * Devuelve filas con capital, interés, cargo inicial, cuota y saldo.
   */
  buildSchedule(loan: LoanTerms): ScheduleRow[] {
    const periods = Math.max(1, Math.round(num(loan.installments) || 1));
    const principal = round2(num(loan.principal));
    const mode = interestModeOf(loan);
    const rate = mode === 'percent' ? periodRate(loan) : 0;
    const method = loan.amortization || 'fixed';
    const first = loan.firstDueDate || loan.startDate || todayISO();
    const extraCharge = round2(num(loan.fees));
    const grace = Math.max(0, Math.round(num(loan.graceDays)));

    const fixedAmount = round2(Math.max(0, num(loan.fixedInterest)));
    const totalFixedInterest =
      mode === 'fixed_total'
        ? fixedAmount
        : mode === 'fixed_installment' || mode === 'fixed_period'
          ? round2(fixedAmount * periods)
          : 0;

    let interestPlan: number[] | null = null;
    if (mode === 'fixed_total') {
      interestPlan = distributeFixedInterest(totalFixedInterest, principal, periods, method);
    } else if (mode === 'fixed_installment' || mode === 'fixed_period') {
      interestPlan = Array.from({ length: periods }, () => fixedAmount);
    }

    const rows: ScheduleRow[] = [];
    let balance = principal;
    const fixedPayment = rate > 0 ? (principal * rate) / (1 - Math.pow(1 + rate, -periods)) : principal / periods;
    const fixedCapital = principal / periods;
    const fixedTotalPayment = interestPlan ? round2((principal + totalFixedInterest) / periods) : 0;

    for (let k = 1; k <= periods; k += 1) {
      let interest = 0;
      let capital = 0;

      if (interestPlan) {
        interest = interestPlan[k - 1];
        // El interés por período solo se cobra mientras quede saldo pendiente.
        if (mode === 'fixed_period' && balance <= 0.004) interest = 0;

        if (method === 'bullet') {
          capital = k === periods ? round2(balance) : 0;
        } else if (method === 'fixed') {
          capital = k === periods ? round2(balance) : round2(fixedTotalPayment - interest);
        } else {
          capital = k === periods ? round2(balance) : round2(fixedCapital);
        }
      } else if (method === 'bullet') {
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

  private lateFeeFor(base: number, fromISO: string, toISOValue: string, loan: LoanTerms): number {
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
  compute(loan: LoanTerms, payments: readonly PaymentLike[] = [], asOf: string = todayISO()): LoanView {
    const asOfDate = asOf || todayISO();
    const rows: LoanScheduleRow[] = this.buildSchedule(loan).map((row) => ({
      ...row,
      paidInterest: 0,
      paidCapital: 0,
      paidCharge: 0,
      latePaid: 0,
      lateUnpaid: 0,
      feeSettledTo: null,
      fixedFeeCharged: false,
      remaining: row.amount,
      paid: 0,
      lateDue: 0,
      state: 'pending' as InstallmentState,
      overdueDays: 0,
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
            const fee = this.lateFeeFor(remaining, start, when, loan);
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
      const remaining = round2(row.amount - row.paidInterest - row.paidCapital - row.paidCharge);
      row.remaining = remaining;
      row.paid = round2(row.paidInterest + row.paidCapital + row.paidCharge);
      row.lateDue = 0;

      if (remaining > 0.004) {
        if (lateType2 !== 'none' && lateType2 !== 'fixed_once') {
          const start = row.feeSettledTo || row.graceUntil || row.dueDate;
          if (daysBetween(start, asOfDate) > 0) {
            row.lateDue = this.lateFeeFor(remaining, start, asOfDate, loan);
          }
        } else if (lateType2 === 'fixed_once') {
          if (!row.fixedFeeCharged && daysBetween(row.graceUntil, asOfDate) > 0) {
            row.lateDue = round2(num(loan.lateFeeValue));
          }
        }
      }
      row.lateDue = round2(row.lateDue + row.lateUnpaid);

      if (remaining <= 0.004 && row.lateDue <= 0.004) row.state = 'paid';
      else if (row.dueDate < asOfDate) {
        row.state = remaining <= 0.004 ? 'late' : row.paid > 0.004 ? 'partial_overdue' : 'overdue';
      } else if (row.paid > 0.004) row.state = 'partial';
      else row.state = 'pending';

      row.overdueDays = remaining > 0.004 ? Math.max(0, daysBetween(row.dueDate, asOfDate) - grace) : 0;
    }

    const totals: LoanTotals = {
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
      applied: 0,
      credit: 0,
      totalPaid: 0,
      balance: 0,
      payoff: 0,
      overdueCount: 0,
      overdueAmount: 0,
      overdueDays: 0,
      nextDueDate: null,
      nextDueAmount: 0,
      progress: 0,
      lastPaymentDate: null,
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
    totals.lastPaymentDate = list.length ? list[list.length - 1].date || null : null;

    let state: LoanState = 'active';
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
    return view as LoanView;
  }

  simulate(
    loan: LoanTerms,
    payments: readonly PaymentLike[],
    hypothetical: PaymentLike,
    asOf?: string,
  ): PaymentSimulation {
    const base = this.compute(loan, payments, asOf);
    const withPayment = this.compute(loan, [...payments, hypothetical], asOf);
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

  portfolio(loanViews: readonly LoanView[]): PortfolioSummary {
    const active = loanViews.filter((l) => l.state !== 'cancelled');
    const total: PortfolioSummary = {
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
      progress: 0,
    };
    total.progress = total.toPay > 0 ? total.paid / total.toPay : 0;
    return total;
  }

  accountBalance(account: Pick<Account, 'id' | 'openingBalance'>, transactions: readonly TransactionLike[]): number {
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

  transactionsSummary(
    transactions: readonly TransactionLike[],
    fromISO?: string | null,
    toISOValue?: string | null,
  ): TransactionsSummary {
    const list = (transactions || []).filter(
      (t) =>
        (!fromISO || String(t.date || '') >= fromISO) &&
        (!toISOValue || String(t.date || '') <= toISOValue),
    );
    const income = round2(sum(list.filter((t) => t.type === 'income'), (t) => t.amount));
    const expense = round2(sum(list.filter((t) => t.type === 'expense'), (t) => t.amount));
    return { income, expense, net: round2(income - expense), count: list.length, list };
  }

  monthlySeries<T>(
    items: readonly T[],
    {
      months = 6,
      datePick = (x: T) => (x as { date?: string }).date || '',
      amountPick = (x: T) => (x as { amount?: number }).amount || 0,
      typePick = null,
      asOf = todayISO(),
    }: MonthlySeriesOptions<T> = {},
  ): MonthlyBucket[] {
    const anchor = isoToDate(asOf);
    const buckets: MonthlyBucket[] = [];
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

  nextInstallment(loanView: LoanView): LoanScheduleRow | null {
    return loanView.rows.find((r) => r.remaining > 0.004) || null;
  }
}

export interface MonthlySeriesOptions<T> {
  months?: number;
  datePick?: (item: T) => string;
  amountPick?: (item: T) => number;
  typePick?: ((item: T) => string) | null;
  asOf?: string;
}

export const loanCalculator = new LoanCalculator();

/* ---------- API funcional (compatibilidad con el resto de la aplicación) ---------- */

export function buildSchedule(loan: LoanTerms): ScheduleRow[] {
  return loanCalculator.buildSchedule(loan);
}

export function computeLoan(loan: LoanTerms, payments: readonly PaymentLike[] = [], asOf: string = todayISO()): LoanView {
  return loanCalculator.compute(loan, payments, asOf);
}

export const LOAN_STATES: Record<LoanState, { label: string; tone: BadgeTone }> = {
  active: { label: 'Al día', tone: 'success' },
  overdue: { label: 'En mora', tone: 'danger' },
  paid: { label: 'Pagado', tone: 'info' },
  cancelled: { label: 'Cancelado', tone: 'muted' },
  draft: { label: 'Borrador', tone: 'muted' },
};

export function loanStateMeta(state?: LoanState | string | null): { label: string; tone: BadgeTone } {
  return LOAN_STATES[(state || 'active') as LoanState] || LOAN_STATES.active;
}

/* ---------- simulación de pago (vista previa antes de guardar) ---------- */

export function simulatePayment(
  loan: LoanTerms,
  payments: readonly PaymentLike[],
  hypothetical: PaymentLike,
  asOf?: string,
): PaymentSimulation {
  return loanCalculator.simulate(loan, payments, hypothetical, asOf);
}

/* ---------- agregados ---------- */

export function buildLoanViews(
  loans: readonly Loan[],
  payments: readonly PaymentLike[],
  asOf: string = todayISO(),
): LoanView[] {
  const byLoan = new Map<LoanId, PaymentLike[]>();
  for (const payment of payments || []) {
    if (!payment.loanId) continue;
    if (!byLoan.has(payment.loanId)) byLoan.set(payment.loanId, []);
    byLoan.get(payment.loanId)!.push(payment);
  }
  return (loans || []).map((loan) => computeLoan(loan, byLoan.get(loan.id) || [], asOf));
}

export function portfolioSummary(loanViews: readonly LoanView[]): PortfolioSummary {
  return loanCalculator.portfolio(loanViews);
}

export function accountBalance(
  account: Pick<Account, 'id' | 'openingBalance'>,
  transactions: readonly TransactionLike[],
): number {
  return loanCalculator.accountBalance(account, transactions);
}

export function transactionsSummary(
  transactions: readonly TransactionLike[],
  fromISO?: string | null,
  toISOValue?: string | null,
): TransactionsSummary {
  return loanCalculator.transactionsSummary(transactions, fromISO, toISOValue);
}

export function monthlySeries<T>(
  items: readonly T[],
  options: MonthlySeriesOptions<T> = {},
): MonthlyBucket[] {
  return loanCalculator.monthlySeries(items, options);
}

export function daysLateLabel(dueISO: string, asOf: string = todayISO()): string {
  const days = Math.max(0, daysBetween(dueISO, asOf));
  if (days === 0) return 'vence hoy';
  if (days === 1) return '1 día de atraso';
  return `${days} días de atraso`;
}

export function nextInstallment(loanView: LoanView): LoanScheduleRow | null {
  return loanCalculator.nextInstallment(loanView);
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCSV(
  headers: readonly unknown[],
  rows: readonly (readonly unknown[])[],
  separator = ';',
): string {
  const head = headers.map(csvEscape).join(separator);
  const body = rows
    .map((row) => row.map((cell) => csvEscape(typeof cell === 'number' ? round2(cell) : cell)).join(separator))
    .join('\r\n');
  return `\uFEFF${head}\r\n${body}`;
}
