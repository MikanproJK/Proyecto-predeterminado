/* Utilidades compartidas por las acciones */

import { state, paymentsFor } from '../lib/store.js';
import { currencyMeta, roundToCurrency } from '../lib/currencies.js';
import { money, num, addDaysISO, addMonthsISO, computeLoan, todayISO } from '../finance.js';

export interface SelectOption {
  value: string;
  label: string;
}

export const T = (): string => todayISO();

export function currency(): string {
  return currencyMeta(state.db.settings.currency).symbol;
}

/** Paso de los campos monetarios según los decimales de la moneda. */
export function currencyStep(): string {
  return currencyMeta(state.db.settings.currency).decimals === 0 ? '1' : '0.01';
}

/** Valor mínimo de los campos monetarios según los decimales de la moneda. */
export function currencyMin(): string {
  return currencyMeta(state.db.settings.currency).decimals === 0 ? '1' : '0.01';
}

/** Redondea un importe a los decimales que usa la moneda activa. */
export function currencyRound(value: unknown): number {
  return roundToCurrency(num(value), state.db.settings.currency);
}

export function accountOptions(
  selected: string | null | undefined,
  { includeEmpty = false }: { includeEmpty?: boolean } = {},
): SelectOption[] {
  const options = state.db.accounts.map((account) => ({ value: account.id, label: account.name }));
  if (includeEmpty) options.unshift({ value: '', label: 'Sin cuenta' });
  if (!options.some((option) => option.value === selected) && options.length) {
    options[0].value = selected || options[0].value;
  }
  return options;
}

export function clientOptions(selected?: string | null): SelectOption[] {
  const list = [...state.db.clients].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return list.map((client) => ({
    value: client.id,
    label: `${client.name}${client.type === 'temporary' ? ' · temporal' : ''}${client.active === false ? ' · inactivo' : ''}`,
  }));
}

export function loanOptions(selected?: string | null, clientId?: string | null): SelectOption[] {
  const loans = state.db.loans
    .filter((loan) => loan.status !== 'cancelled' && (!clientId || loan.clientId === clientId))
    .map((loan) => computeLoan(loan, paymentsFor(loan.id), T()))
    .sort((a, b) => {
      const priority = (state: string) => (state === 'overdue' ? 0 : state === 'active' ? 1 : 2);
      return priority(a.state) - priority(b.state) || String(a.code).localeCompare(String(b.code));
    });
  return loans.map((loan) => {
    const client = state.db.clients.find((c) => c.id === loan.clientId);
    return {
      value: loan.id,
      label: `${loan.code} · ${client ? client.name : 'Cliente'} · ${money(loan.totals.balance)}`,
    };
  });
}

export function defaultFirstDue(
  frequency: string,
  startDate: string | null | undefined,
  customDays: number | string | null | undefined,
): string {
  const start = startDate || T();
  switch (frequency) {
    case 'daily':
      return addDaysISO(start, 1);
    case 'weekly':
      return addDaysISO(start, 7);
    case 'biweekly':
      return addDaysISO(start, 15);
    case 'custom':
      return addDaysISO(start, Math.max(1, Math.round(num(customDays) || 15)));
    case 'monthly':
    default:
      return addMonthsISO(start, 1);
  }
}
