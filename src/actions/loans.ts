/* Acciones de préstamos */

import { state, addLoan, updateLoan, deleteLoan, cancelLoan, reactivateLoan } from '../lib/store.js';
import { money, num, computeLoan, formatDate, periodRate, FREQUENCIES, AMORTIZATIONS, RATE_TYPES, LATE_FEE_TYPES } from '../finance.js';
import { openModal, confirmDialog, toast, field, switchField, readForm, esc, icon } from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import type { Amortization, Frequency, LoanInput, LoanPatch, LoanTerms, LoanView, RateType } from '../types.js';
import { T, currency, accountOptions, clientOptions, defaultFirstDue } from './shared.js';
import { openClientForm } from './clients.js';

/* ============================================================
   PRÉSTAMOS
   ============================================================ */

export interface OpenLoanFormOptions {
  loanId?: string | null;
  clientId?: string | null;
  initial?: Partial<LoanInput> | null;
}

export function openLoanForm({ loanId = null, clientId = null, initial = null }: OpenLoanFormOptions = {}): void {
  const existing = loanId ? state.db.loans.find((l) => l.id === loanId) : null;
  if (!state.db.clients.length) {
    openModal({
      title: 'Primero registra un cliente',
      subtitle: 'Todo préstamo necesita un titular.',
      size: 'sm',
      body: `<div class="empty">
        <span class="empty-icon">${icon('user-plus', 28)}</span>
        <strong>Aún no hay clientes</strong>
        <p>Crea el primer cliente para poder otorgar préstamos.</p>
      </div>`,
      footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
        <button class="btn btn-primary" type="button" data-new-client>${icon('user-plus', 16)} Crear cliente</button>`,
      onMount: ({ root, close }) => {
        root.querySelector<HTMLElement>('[data-new-client]')!.addEventListener('click', () => {
          close();
          setTimeout(() => openClientForm({ onSaved: (client) => openLoanForm({ clientId: client.id }) }), 200);
        });
      },
    });
    return;
  }

  const hasPayments = existing ? state.db.payments.some((p) => p.loanId === existing.id) : false;
  const settings = state.db.settings;
  const draft = {
    clientId: existing?.clientId || clientId || state.db.clients[0].id,
    principal: existing?.principal ?? initial?.principal ?? 1000,
    interestRate: existing?.interestRate ?? initial?.interestRate ?? 5,
    rateType: existing?.rateType || 'monthly',
    amortization: existing?.amortization || 'fixed',
    frequency: existing?.frequency || 'monthly',
    customDays: existing?.customDays || 15,
    installments: existing?.installments ?? 12,
    startDate: existing?.startDate || T(),
    firstDueDate: existing?.firstDueDate || defaultFirstDue(existing?.frequency || 'monthly', T(), 15),
    lateFeeType: existing?.lateFeeType || settings.lateFeeType || 'percent_daily',
    lateFeeValue: existing?.lateFeeValue ?? settings.lateFeeValue ?? 1,
    graceDays: existing?.graceDays ?? settings.graceDays ?? 0,
    fees: existing?.fees ?? 0,
    notes: existing?.notes || '',
    guarantee: existing?.guarantee || '',
    accountId: existing?.accountId || settings.defaultAccountId,
    registerDisbursement: true,
    ...(initial || {}),
  };

  const lateFeeSuffix = () => (String(draft.lateFeeType).startsWith('percent') ? '%' : currency());

  const clientSelectOptions = clientOptions(draft.clientId);
  const feeOptions = LATE_FEE_TYPES.map((option) => ({ value: option.value, label: option.label }));

  const basicForm = `<form id="loan-form" autocomplete="off">
    <div class="form-section">
      <div class="form-section-title">${icon('user', 14)} Titular y desembolso</div>
      <div class="form-grid">
        <div class="field span-2">
          <span class="field-label">Cliente <em>*</em></span>
          <div class="client-pick">
            <select class="input" name="clientId" required>
              ${clientSelectOptions.map((opt) => `<option value="${esc(opt.value)}" ${opt.value === draft.clientId ? 'selected' : ''}>${esc(opt.label)}</option>`).join('')}
            </select>
            <button class="btn btn-outline btn-sm" type="button" data-add-client>${icon('user-plus', 15)} Nuevo</button>
          </div>
        </div>
        ${field({ label: 'Monto del capital', name: 'principal', type: 'number', value: draft.principal, min: '0.01', suffix: currency(), required: true })}
        ${field({ label: 'Cuenta de desembolso', name: 'accountId', value: draft.accountId, options: accountOptions(draft.accountId) })}
        ${field({ label: 'Fecha de entrega', name: 'startDate', type: 'date', value: draft.startDate, required: true })}
        ${field({ label: 'Primer vencimiento', name: 'firstDueDate', type: 'date', value: draft.firstDueDate, required: true, hint: 'Se calcula automáticamente según la frecuencia.' })}
      </div>
      ${existing ? '' : `<div style="margin-top:4px">${switchField({ label: 'Registrar salida de caja', name: 'registerDisbursement', checked: true, hint: 'Crea un egreso automático por el capital entregado.' })}</div>`}
    </div>

    <div class="form-section">
      <div class="form-section-title">${icon('percent', 14)} Condiciones del crédito</div>
      <div class="form-grid form-grid--3">
        ${field({ label: 'Tasa de interés', name: 'interestRate', type: 'number', value: draft.interestRate, min: '0', step: '0.01', suffix: '%', required: true })}
        ${field({ label: 'Base de la tasa', name: 'rateType', value: draft.rateType, options: RATE_TYPES })}
        ${field({ label: 'Número de cuotas', name: 'installments', type: 'number', value: draft.installments, min: '1', step: '1', required: true })}
        ${field({ label: 'Sistema de amortización', name: 'amortization', value: draft.amortization, options: AMORTIZATIONS, className: 'span-2' })}
        ${field({ label: 'Frecuencia de pago', name: 'frequency', value: draft.frequency, options: FREQUENCIES })}
        <div data-custom-days class="${draft.frequency === 'custom' ? '' : 'hidden'}">
          ${field({ label: 'Días entre cuotas', name: 'customDays', type: 'number', value: draft.customDays, min: '1', step: '1' })}
        </div>
        ${field({ label: 'Cargo o comisión inicial', name: 'fees', type: 'number', value: draft.fees, min: '0', suffix: currency(), hint: 'Se suma a la primera cuota.' })}
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-title">${icon('alert-circle', 14)} Mora y garantía</div>
      <div class="form-grid">
        ${field({ label: 'Cálculo de mora', name: 'lateFeeType', value: draft.lateFeeType, options: feeOptions })}
        <div data-late-value class="${draft.lateFeeType === 'none' ? 'hidden' : ''}">
          ${field({ label: 'Valor de la mora', name: 'lateFeeValue', type: 'number', value: draft.lateFeeValue, min: '0', step: '0.01', suffix: lateFeeSuffix() })}
        </div>
        ${field({ label: 'Días de gracia', name: 'graceDays', type: 'number', value: draft.graceDays, min: '0', step: '1' })}
        ${field({ label: 'Garantía', name: 'guarantee', value: draft.guarantee, placeholder: 'Ej. vehículo, mercancía, aval…' })}
        ${field({ label: 'Notas del préstamo', name: 'notes', type: 'textarea', value: draft.notes, className: 'span-2', rows: 2, placeholder: 'Condiciones especiales, acuerdos verbales, referencias…' })}
      </div>
    </div>
  </form>`;

  const editForm = `<form id="loan-form" autocomplete="off">
    <div class="form-note">${icon('info', 16)}<div><strong>Este préstamo ya tiene pagos registrados.</strong> Para preservar la coherencia del plan de pagos solo puedes editar condiciones de mora, garantía y notas. Para cambiar el monto o los plazos, elimina los pagos o crea un nuevo préstamo.</div></div>
    <div class="form-grid" style="margin-top:16px">
      ${field({ label: 'Cálculo de mora', name: 'lateFeeType', value: draft.lateFeeType, options: feeOptions })}
      <div data-late-value class="${draft.lateFeeType === 'none' ? 'hidden' : ''}">
        ${field({ label: 'Valor de la mora', name: 'lateFeeValue', type: 'number', value: draft.lateFeeValue, min: '0', step: '0.01', suffix: lateFeeSuffix() })}
      </div>
      ${field({ label: 'Días de gracia', name: 'graceDays', type: 'number', value: draft.graceDays, min: '0', step: '1' })}
      ${field({ label: 'Garantía', name: 'guarantee', value: draft.guarantee })}
      ${field({ label: 'Notas', name: 'notes', type: 'textarea', value: draft.notes, className: 'span-2', rows: 3 })}
    </div>
  </form>`;

  const modal = openModal({
    title: existing ? `Editar ${existing.code}` : 'Nuevo préstamo',
    subtitle: existing ? 'Ajusta las condiciones del crédito.' : 'Define el monto, los intereses y el plan de pagos a tu medida.',
    size: 'xl',
    body: `<div class="loan-form-layout">
      <div>${hasPayments ? editForm : basicForm}</div>
      ${hasPayments ? '' : `<aside class="loan-form-preview"><div class="calc-panel" id="loan-preview"></div></aside>`}
    </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="loan-form">${icon('check', 16)} ${existing ? 'Guardar cambios' : 'Crear préstamo'}</button>`,
  });

  const form = modal.body.querySelector<HTMLFormElement>('#loan-form')!;
  const previewEl = modal.body.querySelector<HTMLElement>('#loan-preview');
  const freqSelect = form.querySelector<HTMLSelectElement>('[name="frequency"]')!;
  const customWrap = form.querySelector<HTMLElement>('[data-custom-days]');
  const lateSelect = form.querySelector<HTMLSelectElement>('[name="lateFeeType"]')!;
  const lateWrap = form.querySelector<HTMLElement>('[data-late-value]')!;
  const startInput = form.querySelector<HTMLInputElement>('[name="startDate"]')!;
  const firstDueInput = form.querySelector<HTMLInputElement>('[name="firstDueDate"]')!;
  let firstDueTouched = false;

  const syncConditional = () => {
    if (customWrap) customWrap.classList.toggle('hidden', freqSelect.value !== 'custom');
    lateWrap.classList.toggle('hidden', lateSelect.value === 'none');
    const suffix = form.querySelector<HTMLElement>('[data-late-value] .input-affix--suffix')!;
    if (suffix) suffix.textContent = String(lateSelect.value).startsWith('percent') ? '%' : currency();
  };

  const refreshPreview = (): void => {
    if (!previewEl) return;
    const data = readForm(form);
    const temp: LoanTerms = {
      id: 'preview',
      principal: num(data.principal),
      interestRate: num(data.interestRate),
      rateType: data.rateType as RateType,
      amortization: data.amortization as Amortization,
      frequency: data.frequency as Frequency,
      customDays: num(data.customDays) || 15,
      installments: Math.max(1, Math.round(num(data.installments) || 1)),
      startDate: String(data.startDate || T()),
      firstDueDate: String(data.firstDueDate || data.startDate || T()),
      fees: num(data.fees),
      graceDays: 0,
      lateFeeType: 'none',
      status: 'active',
    };
    if (!(temp.principal > 0) || !(num(temp.installments) > 0)) {
      previewEl.innerHTML = `<h4>Vista previa</h4><div class="chart-empty" style="height:120px">Completa el monto y las cuotas</div>`;
      return;
    }
    const view = computeLoan(temp, [], T());
    const rate = periodRate(temp) * 100;
    const first = view.rows[0];
    const last = view.rows[view.rows.length - 1];
    const totalInterest = view.totals.interest;
    const client = state.db.clients.find((c) => c.id === data.clientId);
    const freq = FREQUENCIES.find((f) => f.value === data.frequency);
    const warning =
      data.firstDueDate && data.startDate && String(data.firstDueDate) < String(data.startDate)
        ? 'El primer vencimiento es anterior a la fecha de entrega.'
        : '';

    previewEl.innerHTML = `
      <h4>Vista previa del plan</h4>
      <div class="calc-main">
        <span>${first ? 'Primera cuota' : 'Cuota estimada'}</span>
        <strong>${first ? money(first.amount) : '—'}</strong>
        <span style="font-size:.68rem;color:var(--text-mute)">${esc(client?.name || 'Sin cliente')} · ${view.installments} cuotas ${esc(freq?.label?.toLowerCase() || '')}</span>
      </div>
      <div class="calc-rows">
        <div class="calc-row"><span>Capital</span><strong>${money(temp.principal)}</strong></div>
        <div class="calc-row"><span>Intereses totales</span><strong>${money(totalInterest)}</strong></div>
        ${num(temp.fees) > 0 ? `<div class="calc-row"><span>Cargo inicial</span><strong>${money(temp.fees)}</strong></div>` : ''}
        <div class="calc-row calc-row--total"><span>Total a pagar</span><strong>${money(view.totals.toPay)}</strong></div>
        <div class="calc-row"><span>Tasa por período</span><strong>${rate.toFixed(2)}%</strong></div>
        <div class="calc-row"><span>Último vencimiento</span><strong>${last ? formatDate(last.dueDate, 'medium') : '—'}</strong></div>
      </div>
      <div class="preview-schedule">
        ${view.rows.slice(0, 5).map((row) => `<div class="preview-schedule-row"><span>#${row.n} · ${formatDate(row.dueDate, 'short')}</span><b>${money(row.amount)}</b></div>`).join('')}
        ${view.rows.length > 5 ? `<div class="preview-schedule-more">+ ${view.rows.length - 5} cuotas más</div>` : ''}
      </div>
      ${warning ? `<div class="calc-alert">${icon('alert', 13)} ${esc(warning)}</div>` : ''}
      ${temp.interestRate === 0 ? `<div class="calc-alert" style="color:var(--info)">${icon('info', 13)} Préstamo sin intereses.</div>` : ''}
    `;
  };

  if (!hasPayments) {
    form.addEventListener('input', () => {
      syncConditional();
      refreshPreview();
    });
    form.addEventListener('change', () => {
      syncConditional();
      refreshPreview();
    });
    firstDueInput.addEventListener('change', () => {
      firstDueTouched = true;
    });
    const autoFirstDue = (): void => {
      if (firstDueTouched) return;
      const data = readForm(form);
      firstDueInput.value = defaultFirstDue(
        freqSelect.value,
        data.startDate ? String(data.startDate) : '',
        data.customDays as number | string | null | undefined,
      );
      refreshPreview();
    };
    freqSelect.addEventListener('change', autoFirstDue);
    startInput.addEventListener('change', autoFirstDue);
    const customDaysInput = form.querySelector<HTMLInputElement>('[name="customDays"]')!;
    if (customDaysInput) customDaysInput.addEventListener('change', autoFirstDue);
    syncConditional();
    refreshPreview();

    const addClientBtn = form.querySelector<HTMLElement>('[data-add-client]')!;
    if (addClientBtn) {
      addClientBtn.addEventListener('click', () => {
        const currentDraft = readForm(form);
        modal.close();
        setTimeout(
          () =>
            openClientForm({
              onSaved: (client) =>
                openLoanForm({ initial: { ...currentDraft, clientId: client.id } as unknown as Partial<LoanInput> }),
            }),
          200,
        );
      });
    }
  } else {
    syncConditional();
    form.addEventListener('change', syncConditional);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const data = readForm(form);
      if (existing) {
        const patch = hasPayments
          ? {
              lateFeeType: data.lateFeeType,
              lateFeeValue: num(data.lateFeeValue),
              graceDays: num(data.graceDays),
              guarantee: data.guarantee,
              notes: data.notes,
            }
          : {
              ...data,
              principal: num(data.principal),
              interestRate: num(data.interestRate),
              installments: num(data.installments),
              customDays: num(data.customDays) || 15,
              fees: num(data.fees),
              lateFeeValue: num(data.lateFeeValue),
              graceDays: num(data.graceDays),
            };
        updateLoan(existing.id, patch as unknown as LoanPatch);
        toast('Préstamo actualizado.', 'success');
        modal.close();
      } else {
        const created = addLoan({
          ...data,
          principal: num(data.principal),
          interestRate: num(data.interestRate),
          installments: num(data.installments),
          customDays: num(data.customDays) || 15,
          fees: num(data.fees),
          lateFeeValue: num(data.lateFeeValue),
          graceDays: num(data.graceDays),
        } as unknown as LoanInput);
        toast(`${created.code} creado con ${created.installments} cuotas.`, 'success', 'Préstamo otorgado');
        modal.close();
        setTimeout(() => navigate(`loan/${created.id}`), 180);
      }
    } catch (err) {
      toast(err.message || 'No se pudo guardar el préstamo.', 'error');
    }
  });
}

export async function deleteLoanFlow(loan: LoanView): Promise<void> {
  const client = state.db.clients.find((c) => c.id === loan.clientId);
  const paymentCount = state.db.payments.filter((p) => p.loanId === loan.id).length;
  const ok = await confirmDialog({
    title: `Eliminar ${loan.code}`,
    message: `Se eliminará el préstamo de ${client ? client.name : 'este cliente'} y todo su historial.`,
    detail: `${paymentCount} pago(s) registrado(s) y los movimientos de caja vinculados también se eliminarán. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar definitivamente',
  });
  if (!ok) return;
  try {
    deleteLoan(loan.id);
    toast('Préstamo eliminado.', 'success');
    navigate('loans');
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function cancelLoanFlow(loan: LoanView): ReturnType<typeof openModal> {
  const modal = openModal({
    title: `Cancelar ${loan.code}`,
    subtitle: 'El préstamo dejará de generar mora y saldrá de la cartera activa.',
    size: 'sm',
    body: `<div class="form-note">${icon('alert', 16)}<div>Los pagos ya registrados se conservan. Puedes reactivar el préstamo después si fue un error.</div></div>
      <div style="margin-top:14px">
        ${field({ label: 'Motivo de la cancelación', name: 'reason', type: 'textarea', placeholder: 'Ej. refinanciado, condonado, acuerdo con el cliente…', rows: 3 })}
      </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Volver</button>
      <button class="btn btn-danger" type="button" data-confirm-cancel>Cancelar préstamo</button>`,
    onMount: ({ root, close }) => {
      root.querySelector<HTMLElement>('[data-confirm-cancel]')!.addEventListener('click', () => {
        const reason = root.querySelector<HTMLTextAreaElement>('[name="reason"]')!.value;
        cancelLoan(loan.id, reason);
        toast('Préstamo cancelado.', 'success');
        close();
      });
    },
  });
  return modal;
}

export function reactivateLoanFlow(loan: LoanView): void {
  reactivateLoan(loan.id);
  toast('Préstamo reactivado.', 'success');
}
