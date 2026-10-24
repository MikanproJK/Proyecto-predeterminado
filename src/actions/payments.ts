/* Acciones de cobros y pagos */

import { state, addPayment, updatePayment, deletePayment, paymentsFor } from '../lib/store.js';
import { money, num, round2, computeLoan, simulatePayment, formatDate, PAYMENT_METHODS, loanStateMeta, nextInstallment } from '../finance.js';
import { openModal, confirmDialog, toast, field, switchField, readForm, esc, icon, avatar } from '../lib/ui.js';

import type { LoanView, Payment, PaymentInput, PaymentPatch } from '../types.js';
import { T, currency, accountOptions, loanOptions } from './shared.js';
import { openReceipt } from './documents.js';

/* ============================================================
   PAGOS
   ============================================================ */

export interface OpenPaymentModalOptions {
  loanId?: string | null;
  clientId?: string | null;
}

export function openPaymentModal({ loanId = null, clientId = null }: OpenPaymentModalOptions = {}): void {
  const loans = loanOptions(loanId, clientId);
  if (!loans.length) {
    toast('No hay préstamos activos para registrar pagos.', 'warning');
    return;
  }
  const initialLoanId = loanId || loans[0].value;
  const initialView = computeLoan(
    state.db.loans.find((l) => l.id === initialLoanId)!,
    paymentsFor(initialLoanId),
    T(),
  );
  const suggested = initialView.totals.nextDueAmount || initialView.totals.balance;

  const modal = openModal({
    title: 'Registrar pago',
    subtitle: 'El pago se aplica primero a la mora, luego a intereses y finalmente a capital.',
    size: 'lg',
    body: `<form id="payment-form" autocomplete="off">
      <div class="form-grid">
        <div class="span-2">
          ${field({ label: 'Préstamo', name: 'loanId', value: initialLoanId, options: loans, required: true })}
        </div>
        <div class="span-2" id="payment-loan-summary"></div>
        ${field({ label: 'Monto recibido', name: 'amount', type: 'number', value: round2(suggested), min: '0.01', suffix: currency(), required: true, autofocus: true })}
        ${field({ label: 'Fecha del pago', name: 'date', type: 'date', value: T(), required: true })}
        ${field({ label: 'Método', name: 'method', value: 'Efectivo', options: PAYMENT_METHODS })}
        ${field({ label: 'Cuenta de destino', name: 'accountId', value: state.db.settings.defaultAccountId, options: accountOptions(state.db.settings.defaultAccountId) })}
        ${field({ label: 'Nota', name: 'note', type: 'textarea', value: '', rows: 2, className: 'span-2', placeholder: 'Observaciones del cobro (opcional)' })}
      </div>
      <div class="quick-amounts">
        <button type="button" class="chip" data-quick-amount="next">Cuota + mora</button>
        <button type="button" class="chip" data-quick-amount="interest">Solo interés</button>
        <button type="button" class="chip" data-quick-amount="full">Saldo total</button>
      </div>
      <div id="payment-preview" class="mt-2"></div>
      ${switchField({ label: 'Registrar ingreso en caja', name: 'registerTransaction', checked: true, hint: 'Se creará un ingreso en la cuenta seleccionada.' })}
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn-outline" type="button" data-save-receipt>${icon('print', 16)} Guardar y ver recibo</button>
      <button class="btn btn-primary" type="submit" form="payment-form">${icon('check', 16)} Guardar pago</button>`,
  });

  const form = modal.body.querySelector<HTMLFormElement>('#payment-form')!;
  const loanSelect = form.querySelector<HTMLSelectElement>('[name="loanId"]')!;
  const amountInput = form.querySelector<HTMLInputElement>('[name="amount"]')!;
  const dateInput = form.querySelector<HTMLInputElement>('[name="date"]')!;
  const summaryEl = modal.body.querySelector<HTMLElement>('#payment-loan-summary')!;
  const previewEl = modal.body.querySelector<HTMLElement>('#payment-preview')!;

  const currentLoan = (): LoanView => computeLoan(
    state.db.loans.find((l) => l.id === loanSelect.value)!,
    paymentsFor(loanSelect.value),
    T(),
  );

  const refreshSummary = (): void => {
    const view = currentLoan();
    if (!view) return;
    const client = state.db.clients.find((c) => c.id === view.clientId);
    const next = nextInstallment(view);
    summaryEl.innerHTML = `<div class="payment-loan-summary">
      <div class="row-inline" style="gap:11px">
        ${avatar(client?.name || '?', 36)}
        <div class="cell-stack" style="flex:1">
          <strong>${esc(client?.name || 'Cliente')} <span class="badge badge--${loanStateMeta(view.state).tone}">${esc(loanStateMeta(view.state).label)}</span></strong>
          <span>${esc(view.code)} · ${view.installments} cuotas · ${money(view.totals.balance)} pendiente</span>
        </div>
      </div>
      <div class="payment-loan-metrics">
        <div><span>Saldo</span><strong>${money(view.totals.balance)}</strong></div>
        <div><span>Mora</span><strong class="${view.totals.lateDue > 0 ? 'money--danger' : ''}">${money(view.totals.lateDue)}</strong></div>
        <div><span>Próxima cuota</span><strong>${next ? money(next.remaining) : '—'}</strong></div>
        <div><span>Vence</span><strong>${next ? formatDate(next.dueDate, 'short') : '—'}</strong></div>
      </div>
    </div>`;
  };

  const refreshPreview = (): void => {
    const view = currentLoan();
    if (!view) return;
    const amount = num(amountInput.value);
    if (!(amount > 0)) {
      previewEl.innerHTML = '';
      return;
    }
    const date = dateInput.value || T();
    const asOf = date > T() ? date : T();
    const simulation = simulatePayment(
      state.db.loans.find((l) => l.id === loanSelect.value)!,
      paymentsFor(loanSelect.value),
      { id: 'preview', loanId: loanSelect.value, date, amount, createdAt: new Date().toISOString() },
      asOf,
    );
    const alloc = simulation.applied;
    previewEl.innerHTML = `<div class="payment-summary">
      <div class="payment-summary-row"><span>${icon('alert', 14)} Mora</span><strong>${money(alloc.late)}</strong></div>
      ${alloc.charges > 0 ? `<div class="payment-summary-row"><span>${icon('receipt', 14)} Cargo inicial</span><strong>${money(alloc.charges)}</strong></div>` : ''}
      <div class="payment-summary-row"><span>${icon('percent', 14)} Interés</span><strong>${money(alloc.interest)}</strong></div>
      <div class="payment-summary-row"><span>${icon('coins', 14)} Capital</span><strong>${money(alloc.capital)}</strong></div>
      ${simulation.credit > 0 ? `<div class="payment-summary-row payment-summary-row--muted"><span>${icon('sparkles', 14)} A favor del cliente</span><strong>${money(simulation.credit)}</strong></div>` : ''}
      <div class="payment-summary-row payment-summary-row--total"><span>Saldo después del pago</span><strong>${money(simulation.after.balance)}</strong></div>
    </div>`;
  };

  const applyQuickAmount = (kind: string): void => {
    const view = currentLoan();
    if (!view) return;
    if (kind === 'full') amountInput.value = String(round2(view.totals.balance));
    else if (kind === 'next') amountInput.value = String(round2(view.totals.nextDueAmount || view.totals.balance));
    else {
      const next = nextInstallment(view);
      amountInput.value = String(round2((next ? next.interest : view.totals.remainingInterest) + (next?.lateDue || 0)));
    }
    refreshPreview();
  };

  form.querySelectorAll<HTMLElement>('[data-quick-amount]').forEach((chip) => {
    chip.addEventListener('click', () => applyQuickAmount(chip.dataset.quickAmount || 'next'));
  });

  const syncLoanDefaults = (): void => {
    const view = currentLoan();
    if (!view) return;
    amountInput.value = String(round2(view.totals.nextDueAmount || view.totals.balance));
    refreshSummary();
    refreshPreview();
  };

  loanSelect.addEventListener('change', syncLoanDefaults);
  amountInput.addEventListener('input', refreshPreview);
  dateInput.addEventListener('change', refreshPreview);

  refreshSummary();
  refreshPreview();

  let withReceipt = false;
  modal.root.querySelector<HTMLElement>('[data-save-receipt]')!.addEventListener('click', () => {
    withReceipt = true;
    form.requestSubmit();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const data = readForm(form);
      const payment = addPayment({
        ...data,
        amount: num(data.amount),
        loanId: loanSelect.value,
        registerTransaction: data.registerTransaction !== false,
      } as unknown as PaymentInput);
      toast(`Pago de ${money(payment.amount)} registrado · ${payment.receipt}`, 'success', 'Cobro guardado');
      modal.close();
      if (withReceipt) {
        setTimeout(() => openReceipt(payment.id), 220);
      }
    } catch (err) {
      toast(err.message || 'No se pudo registrar el pago.', 'error');
    }
  });
}

export function openPaymentEdit(payment: Payment): void {
  const loan = state.db.loans.find((l) => l.id === payment.loanId);
  const client = state.db.clients.find((c) => c.id === payment.clientId);
  const modal = openModal({
    title: `Editar pago ${payment.receipt}`,
    subtitle: 'Cambiar el monto o la fecha recalcula la aplicación sobre las cuotas.',
    size: 'md',
    body: `<div class="form-note form-note--info">${icon('info', 16)}<div>${esc(loan?.code || '')} · ${esc(client?.name || '')}</div></div>
      <form id="payment-edit" class="form-grid mt-2" autocomplete="off">
        ${field({ label: 'Monto', name: 'amount', type: 'number', value: payment.amount, min: '0.01', suffix: currency(), required: true })}
        ${field({ label: 'Fecha', name: 'date', type: 'date', value: payment.date, required: true })}
        ${field({ label: 'Método', name: 'method', value: payment.method, options: PAYMENT_METHODS })}
        ${field({ label: 'Cuenta', name: 'accountId', value: payment.accountId, options: accountOptions(payment.accountId) })}
        ${field({ label: 'Nota', name: 'note', type: 'textarea', value: payment.note || '', rows: 2, className: 'span-2' })}
      </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="payment-edit">${icon('check', 16)} Guardar cambios</button>`,
  });
  const form = modal.body.querySelector<HTMLFormElement>('#payment-edit')!;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      updatePayment(payment.id, readForm(form) as unknown as PaymentPatch);
      toast('Pago actualizado.', 'success');
      modal.close();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

export async function deletePaymentFlow(payment: Payment): Promise<void> {
  const ok = await confirmDialog({
    title: 'Eliminar pago',
    message: `¿Eliminar el pago ${payment.receipt} por ${money(payment.amount)}?`,
    detail: 'El saldo del préstamo y el ingreso vinculado en caja se recalcularán automáticamente.',
    confirmLabel: 'Eliminar pago',
  });
  if (!ok) return;
  try {
    deletePayment(payment.id);
    toast('Pago eliminado.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}
