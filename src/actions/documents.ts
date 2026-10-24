/* Recibos, contratos e impresión */

import { state, paymentsFor } from '../lib/store.js';
import { money, num, round2, computeLoan, formatDate, FREQUENCIES, AMORTIZATIONS, RATE_TYPES, LATE_FEE_TYPES } from '../finance.js';
import { openModal, toast, esc, icon } from '../lib/ui.js';

import type { LoanView, Payment } from '../types.js';
import { T } from './shared.js';

/* ============================================================
   RECIBOS
   ============================================================ */

interface PaymentAllocationSummary {
  loan: LoanView;
  late: number;
  charges: number;
  interest: number;
  capital: number;
  balance: number;
  mora: number;
}

function paymentAllocation(payment: Payment): PaymentAllocationSummary | null {
  const loan = state.db.loans.find((l) => l.id === payment.loanId);
  if (!loan) return null;
  const all = paymentsFor(payment.loanId);
  const withAll = computeLoan(loan, all, T());
  const without = computeLoan(
    loan,
    all.filter((p) => p.id !== payment.id),
    T(),
  );
  return {
    loan: withAll,
    late: round2(withAll.totals.paidLate - without.totals.paidLate),
    charges: round2(withAll.totals.paidCharges - without.totals.paidCharges),
    interest: round2(withAll.totals.paidInterest - without.totals.paidInterest),
    capital: round2(withAll.totals.paidCapital - without.totals.paidCapital),
    balance: withAll.totals.balance,
    mora: withAll.totals.lateDue,
  };
}

function receiptMarkup(payment: Payment, { preview = false }: { preview?: boolean } = {}): string {
  const settings = state.db.settings;
  const client = state.db.clients.find((c) => c.id === payment.clientId);
  const allocation = paymentAllocation(payment);
  const loan = allocation?.loan;
  const account = state.db.accounts.find((a) => a.id === payment.accountId);
  const company = settings.company || 'Mi Financiera';

  return `<div class="receipt">
    <div class="receipt-head">
      <div>
        <h1>${esc(company)}</h1>
        <p>${esc(settings.owner || 'Gestión de préstamos y finanzas')}</p>
      </div>
      <div class="receipt-number">
        RECIBO DE PAGO
        <strong>${esc(payment.receipt)}</strong>
        <span>${formatDate(payment.date, 'long')}</span>
      </div>
    </div>
    <div class="receipt-grid">
      <div><span>Cliente</span><strong>${esc(client?.name || '—')}</strong></div>
      <div><span>Documento</span><strong>${esc(client?.doc || '—')}</strong></div>
      <div><span>Préstamo</span><strong>${esc(loan?.code || '—')}</strong></div>
      <div><span>Método de pago</span><strong>${esc(payment.method || '—')}</strong></div>
      <div><span>Cuenta</span><strong>${esc(account?.name || '—')}</strong></div>
      <div><span>Registrado</span><strong>${formatDate(payment.date, 'medium')}</strong></div>
    </div>
    <table>
      <thead>
        <tr><th>Concepto</th><th style="text-align:right">Monto</th></tr>
      </thead>
      <tbody>
        ${allocation?.late ? `<tr><td>Mora acumulada</td><td class="num">${money(allocation.late)}</td></tr>` : ''}
        ${allocation?.charges ? `<tr><td>Cargo / comisión</td><td class="num">${money(allocation.charges)}</td></tr>` : ''}
        ${allocation?.interest ? `<tr><td>Intereses</td><td class="num">${money(allocation.interest)}</td></tr>` : ''}
        ${allocation?.capital ? `<tr><td>Abono a capital</td><td class="num">${money(allocation.capital)}</td></tr>` : ''}
        <tr><td>Saldo pendiente después del pago</td><td class="num">${money(allocation?.balance || 0)}</td></tr>
      </tbody>
    </table>
    <div class="receipt-total">
      <span>Total recibido</span>
      <strong>${money(payment.amount)}</strong>
    </div>
    ${payment.note ? `<div class="receipt-note">Nota: ${esc(payment.note)}</div>` : ''}
    <div class="receipt-note">${preview ? 'Documento de vista previa. ' : ''}Conserve este comprobante como constancia del pago. La mora mostrada corresponde a la fecha de emisión.</div>
    <div class="receipt-foot">
      <div class="receipt-sign">Firma del cliente</div>
      <div class="receipt-sign">Firma autorizada</div>
    </div>
  </div>`;
}

export function openReceipt(paymentId: string): void {
  const payment = state.db.payments.find((p) => p.id === paymentId);
  if (!payment) {
    toast('No se encontró el pago.', 'error');
    return;
  }
  const modal = openModal({
    title: `Recibo ${payment.receipt}`,
    subtitle: 'Vista previa lista para imprimir o guardar como PDF.',
    size: 'lg',
    body: `<div class="receipt-preview">${receiptMarkup(payment, { preview: true })}</div>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cerrar</button>
      <button class="btn btn-primary" type="button" data-print-receipt>${icon('print', 16)} Imprimir recibo</button>`,
  });
  modal.root.querySelector<HTMLElement>('[data-print-receipt]')!.addEventListener('click', () => {
    printHTML(receiptMarkup(payment), `Recibo ${payment.receipt}`);
  });
}

export function printHTML(html: string, title = 'Documento'): void {
  let sheet = document.getElementById('print-sheet')!;
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'print-sheet';
    sheet.className = 'print-sheet';
    document.body.append(sheet);
  }
  sheet.innerHTML = html;
  document.title = title;
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      sheet.innerHTML = '';
    }, 600);
  }, 120);
}

/* ============================================================
   CONTRATO
   ============================================================ */

export function openContract(loanId: string): void {
  const loan = computeLoan(
    state.db.loans.find((l) => l.id === loanId)!,
    paymentsFor(loanId),
    T(),
  );
  if (!loan) return;
  const client = state.db.clients.find((c) => c.id === loan.clientId);
  const settings = state.db.settings;
  const html = `<div class="receipt">
    <div class="receipt-head">
      <div>
        <h1>${esc(settings.company || 'Mi Financiera')}</h1>
        <p>${esc(settings.owner || 'Gestión de préstamos')}</p>
      </div>
      <div class="receipt-number">CONTRATO DE PRÉSTAMO<strong>${esc(loan.code)}</strong><span>${formatDate(T(), 'long')}</span></div>
    </div>
    <p style="font-size:12px;line-height:1.7;color:#333">
      Entre <strong>${esc(settings.company || 'la entidad')}</strong>, en adelante “el acreedor”, y
      <strong>${esc(client?.name || '—')}</strong>, documento ${esc(client?.doc || '—')}, en adelante “el deudor”,
      se celebra el presente contrato de préstamo bajo las condiciones descritas a continuación.
    </p>
    <div class="receipt-grid" style="margin-top:18px">
      <div><span>Capital entregado</span><strong>${money(loan.totals.principal)}</strong></div>
      <div><span>Total a pagar</span><strong>${money(loan.totals.toPay)}</strong></div>
      <div><span>Tasa de interés</span><strong>${num(loan.interestRate)}% ${esc(RATE_TYPES.find((r) => r.value === loan.rateType)?.label || '')}</strong></div>
      <div><span>Sistema</span><strong>${esc(AMORTIZATIONS.find((a) => a.value === loan.amortization)?.label || '')}</strong></div>
      <div><span>Frecuencia</span><strong>${esc(FREQUENCIES.find((f) => f.value === loan.frequency)?.label || '')}</strong></div>
      <div><span>Número de cuotas</span><strong>${loan.installments}</strong></div>
      <div><span>Primer vencimiento</span><strong>${formatDate(loan.firstDueDate, 'medium')}</strong></div>
      <div><span>Mora</span><strong>${esc(LATE_FEE_TYPES.find((l) => l.value === loan.lateFeeType)?.label || 'Sin mora')}${loan.lateFeeType !== 'none' ? ` · ${num(loan.lateFeeValue)}` : ''}</strong></div>
      <div><span>Garantía</span><strong>${esc(loan.guarantee || 'Ninguna')}</strong></div>
      <div><span>Cuenta de desembolso</span><strong>${esc(state.db.accounts.find((a) => a.id === loan.accountId)?.name || '—')}</strong></div>
    </div>
    <h3 style="font-size:13px;margin:20px 0 4px">Plan de pagos</h3>
    <table>
      <thead><tr><th>#</th><th>Vencimiento</th><th style="text-align:right">Cuota</th><th style="text-align:right">Capital</th><th style="text-align:right">Interés</th><th style="text-align:right">Saldo</th></tr></thead>
      <tbody>
        ${loan.rows
          .map(
            (row) => `<tr>
              <td>${row.n}</td>
              <td>${formatDate(row.dueDate, 'short')}</td>
              <td class="num">${money(row.amount)}</td>
              <td class="num">${money(row.capital)}</td>
              <td class="num">${money(row.interest)}</td>
              <td class="num">${money(row.balance)}</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
    ${loan.notes ? `<div class="receipt-note">Observaciones: ${esc(loan.notes)}</div>` : ''}
    <div class="receipt-note">El deudor se compromete a realizar los pagos en las fechas indicadas. El incumplimiento genera la mora pactada. Ambas partes firman de conformidad.</div>
    <div class="receipt-foot">
      <div class="receipt-sign">${esc(client?.name || 'El deudor')}</div>
      <div class="receipt-sign">${esc(settings.owner || 'El acreedor')}</div>
    </div>
  </div>`;

  const modal = openModal({
    title: `Contrato ${loan.code}`,
    subtitle: 'Documento con el plan de pagos completo.',
    size: 'lg',
    body: `<div class="receipt-preview">${html}</div>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cerrar</button>
      <button class="btn btn-primary" type="button" data-print-contract>${icon('print', 16)} Imprimir contrato</button>`,
  });
  modal.root.querySelector<HTMLElement>('[data-print-contract]')!.addEventListener('click', () => {
    printHTML(html, `Contrato ${loan.code}`);
  });
}
