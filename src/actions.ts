/* Acciones compartidas: formularios, confirmaciones, recibos e impresión */

import {
  state,
  addClient,
  updateClient,
  deleteClient,
  addLoan,
  updateLoan,
  deleteLoan,
  cancelLoan,
  reactivateLoan,
  addPayment,
  updatePayment,
  deletePayment,
  addTransaction,
  addTransfer,
  updateTransaction,
  deleteTransaction,
  addAccount,
  updateAccount,
  deleteAccount,
  updateSettings,
  paymentsFor,
  accountBalances,
  loadDemo,
  clearData,
  replaceDB,
} from './lib/store.js';
import {
  money,
  num,
  round2,
  todayISO,
  addDaysISO,
  addMonthsISO,
  computeLoan,
  simulatePayment,
  formatDate,
  periodRate,
  FREQUENCIES,
  AMORTIZATIONS,
  RATE_TYPES,
  LATE_FEE_TYPES,
  PAYMENT_METHODS,
  loanStateMeta,
  nextInstallment,
  toCSV,
} from './finance.js';
import {
  openModal,
  confirmDialog,
  toast,
  field,
  switchField,
  readForm,
  esc,
  icon,
  avatar,
  badge,
} from './lib/ui.js';
import { navigate } from './lib/nav.js';
import type {
  Account,
  AccountInput,
  Amortization,
  Client,
  ClientInput,
  Frequency,
  Loan,
  LoanInput,
  LoanPatch,
  LoanTerms,
  LoanView,
  Payment,
  PaymentInput,
  PaymentPatch,
  RateType,
  Transaction,
  TransactionInput,
  TransactionPatch,
  TransferInput,
} from './types.js';

const T = () => todayISO();

interface SelectOption {
  value: string;
  label: string;
}

function currency(): string {
  return state.db.settings.currency || 'USD';
}

function accountOptions(
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

function clientOptions(selected?: string | null): SelectOption[] {
  const list = [...state.db.clients].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return list.map((client) => ({
    value: client.id,
    label: `${client.name}${client.type === 'temporary' ? ' · temporal' : ''}${client.active === false ? ' · inactivo' : ''}`,
  }));
}

function loanOptions(selected?: string | null, clientId?: string | null): SelectOption[] {
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

function defaultFirstDue(
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

/* ============================================================
   CLIENTES
   ============================================================ */

export interface OpenClientFormOptions {
  clientId?: string | null;
  onSaved?: ((client: Client) => void) | null;
}

export function openClientForm({ clientId = null, onSaved = null }: OpenClientFormOptions = {}): void {
  const existing = clientId ? state.db.clients.find((c) => c.id === clientId) : null;
  const modal = openModal({
    title: existing ? 'Editar cliente' : 'Nuevo cliente',
    subtitle: existing
      ? 'Actualiza los datos de contacto y seguimiento.'
      : 'Registra clientes regulares o temporales sin límites.',
    size: 'lg',
    body: `<form id="client-form" class="form-grid" autocomplete="off">
      <div class="form-section" style="grid-column:1/-1">
        <div class="form-section-title">${icon('user', 14)} Datos personales</div>
        <div class="form-grid">
          ${field({ label: 'Nombre completo', name: 'name', value: existing?.name || '', placeholder: 'Ej. Ana Torres', required: true, autofocus: true })}
          ${field({ label: 'Documento / identificación', name: 'doc', value: existing?.doc || '', placeholder: 'V-00.000.000' })}
          ${field({ label: 'Teléfono', name: 'phone', value: existing?.phone || '', placeholder: '+00 000 000 0000' })}
          ${field({ label: 'Correo electrónico', name: 'email', type: 'email', value: existing?.email || '', placeholder: 'cliente@correo.com' })}
          ${field({ label: 'Dirección', name: 'address', value: existing?.address || '', placeholder: 'Calle, número, ciudad', className: 'span-2' })}
        </div>
      </div>
      <div class="form-section" style="grid-column:1/-1">
        <div class="form-section-title">${icon('sliders', 14)} Clasificación</div>
        <div class="form-grid">
          ${field({
            label: 'Tipo de cliente',
            name: 'type',
            value: existing?.type || 'regular',
            options: [
              { value: 'regular', label: 'Regular' },
              { value: 'temporary', label: 'Temporal' },
            ],
            hint: 'Los clientes temporales pueden tener una fecha de referencia.',
          })}
          <div data-expiry class="${existing?.type === 'temporary' ? '' : 'hidden'}">
            ${field({ label: 'Vigencia de referencia', name: 'expiresAt', type: 'date', value: existing?.expiresAt || addMonthsISO(T(), 1) })}
          </div>
          ${switchField({
            label: 'Cliente activo',
            name: 'active',
            checked: existing ? existing.active !== false : true,
            hint: 'Desactiva clientes que ya no operan contigo.',
          })}
        </div>
        ${field({ label: 'Notas internas', name: 'notes', type: 'textarea', value: existing?.notes || '', placeholder: 'Referencias, condiciones especiales, historial…', className: 'mt-1' })}
      </div>
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="client-form">${icon('check', 16)} ${existing ? 'Guardar cambios' : 'Crear cliente'}</button>`,
  });

  const form = modal.body.querySelector<HTMLFormElement>('#client-form')!;
  const typeSelect = form.querySelector<HTMLSelectElement>('[name="type"]')!;
  const expiryWrap = form.querySelector<HTMLElement>('[data-expiry]')!;
  const syncType = () => expiryWrap.classList.toggle('hidden', typeSelect.value !== 'temporary');
  typeSelect.addEventListener('change', syncType);
  syncType();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const data = readForm(form);
      let saved: Client;
      if (existing) {
        saved = updateClient(existing.id, data as unknown as Partial<ClientInput>);
        toast('Cliente actualizado.', 'success');
      } else {
        saved = addClient(data as unknown as ClientInput);
        toast(`${saved.name} se registró correctamente.`, 'success', 'Cliente creado');
      }
      modal.close();
      if (typeof onSaved === 'function') setTimeout(() => onSaved(saved), 190);
    } catch (err) {
      toast(err.message || 'No se pudo guardar el cliente.', 'error');
    }
  });
}

export async function deleteClientFlow(client: Client): Promise<void> {
  const loans = state.db.loans.filter((l) => l.clientId === client.id);
  const ok = await confirmDialog({
    title: 'Eliminar cliente',
    message: `¿Deseas eliminar a ${client.name} del directorio?`,
    detail: loans.length
      ? `Este cliente tiene ${loans.length} préstamo(s). Debes eliminarlos o reasignarlos antes de borrar el cliente.`
      : 'Esta acción no se puede deshacer. Los pagos históricos no se verán afectados porque no existen.',
    confirmLabel: loans.length ? 'Entendido' : 'Eliminar cliente',
    tone: loans.length ? 'primary' : 'danger',
  });
  if (!ok || loans.length) return;
  try {
    deleteClient(client.id);
    toast('Cliente eliminado.', 'success');
    navigate('clients');
  } catch (err) {
    toast(err.message, 'error');
  }
}

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

/* ============================================================
   FINANZAS
   ============================================================ */

export function openTransactionModal({ type = 'expense' }: { type?: string } = {}): void {
  const categories = state.db.categories;
  const modal = openModal({
    title: 'Nuevo movimiento',
    subtitle: 'Registra ingresos, egresos o transferencias entre cuentas.',
    size: 'md',
    body: `<form id="tx-form" autocomplete="off">
      <div class="segmented tx-type-toggle" data-tx-type>
        <button type="button" class="segmented-item ${type === 'income' ? 'is-active' : ''}" data-value="income">${icon('arrow-up-right', 15)} Ingreso</button>
        <button type="button" class="segmented-item ${type === 'expense' ? 'is-active' : ''}" data-value="expense">${icon('arrow-down-left', 15)} Egreso</button>
        <button type="button" class="segmented-item" data-value="transfer">${icon('refresh', 15)} Transferencia</button>
      </div>
      <input type="hidden" name="type" value="${esc(type)}" />
      <div class="form-grid mt-2">
        ${field({ label: 'Monto', name: 'amount', type: 'number', min: '0.01', value: '', suffix: currency(), required: true, autofocus: true })}
        ${field({ label: 'Fecha', name: 'date', type: 'date', value: T(), required: true })}
        <div class="span-2" data-category-wrap>
          ${field({ label: 'Categoría', name: 'category', value: type === 'income' ? 'Otro ingreso' : 'Operativo', list: true })}
        </div>
        <div class="span-2" data-account-wrap>
          ${field({ label: 'Cuenta', name: 'accountId', value: state.db.settings.defaultAccountId, options: accountOptions(state.db.settings.defaultAccountId) })}
        </div>
        <div class="span-2 hidden" data-to-account-wrap>
          ${field({ label: 'Cuenta destino', name: 'toAccountId', value: state.db.accounts[1]?.id || state.db.accounts[0]?.id, options: accountOptions(state.db.accounts[1]?.id || state.db.accounts[0]?.id) })}
        </div>
        ${field({ label: 'Descripción', name: 'description', type: 'textarea', rows: 2, className: 'span-2', placeholder: 'Detalle del movimiento' })}
      </div>
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="tx-form">${icon('check', 16)} Guardar movimiento</button>`,
  });

  const form = modal.body.querySelector<HTMLFormElement>('#tx-form')!;
  const typeInput = form.querySelector<HTMLInputElement>('[name="type"]')!;
  const categoryWrap = form.querySelector<HTMLElement>('[data-category-wrap]')!;
  const accountWrap = form.querySelector<HTMLElement>('[data-account-wrap]')!;
  const toAccountWrap = form.querySelector<HTMLElement>('[data-to-account-wrap]')!;
  const categoryInput = form.querySelector<HTMLInputElement>('[name="category"]')!;
  const descriptionInput = form.querySelector<HTMLTextAreaElement>('[name="description"]')!;
  const amountInput = form.querySelector<HTMLInputElement>('[name="amount"]')!;

  /* datalist para categorías existentes */
  const datalist = document.createElement('datalist');
  datalist.id = 'tx-categories';
  form.append(datalist);
  categoryInput.setAttribute('list', 'tx-categories');

  const fillCategories = (): void => {
    const kind = typeInput.value === 'income' ? 'income' : 'expense';
    datalist.innerHTML = categories[kind].map((cat) => `<option value="${esc(cat)}"></option>`).join('');
    categoryInput.value = categories[kind][0] || '';
  };

  const syncType = (next: string): void => {
    typeInput.value = next;
    form.querySelectorAll<HTMLElement>('[data-tx-type] [data-value]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === next);
    });
    const isTransfer = next === 'transfer';
    categoryWrap.classList.toggle('hidden', isTransfer);
    toAccountWrap.classList.toggle('hidden', !isTransfer);
    accountWrap.classList.toggle('hidden', false);
    fillCategories();
    if (isTransfer) {
      descriptionInput.placeholder = 'Motivo de la transferencia';
      if (!descriptionInput.value) descriptionInput.value = 'Transferencia entre cuentas';
    } else {
      descriptionInput.placeholder = 'Detalle del movimiento';
    }
  };

  form.querySelectorAll<HTMLElement>('[data-tx-type] [data-value]').forEach((btn) => {
    btn.addEventListener('click', () => syncType(btn.dataset.value || 'expense'));
  });
  fillCategories();
  syncType(type);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const data = readForm(form);
      if (data.type === 'transfer') {
        addTransfer({ ...data, amount: num(data.amount) } as unknown as TransferInput);
        toast('Transferencia registrada.', 'success');
      } else {
        addTransaction({ ...data, amount: num(data.amount) } as unknown as TransactionInput);
        toast(data.type === 'income' ? 'Ingreso registrado.' : 'Egreso registrado.', 'success');
      }
      modal.close();
    } catch (err) {
      toast(err.message || 'No se pudo guardar el movimiento.', 'error');
    }
  });
}

export function openTransactionEdit(tx: Transaction): void {
  const modal = openModal({
    title: 'Editar movimiento',
    size: 'md',
    body: `<form id="tx-edit" class="form-grid" autocomplete="off">
      ${field({ label: 'Monto', name: 'amount', type: 'number', value: tx.amount, min: '0.01', suffix: currency(), required: true })}
      ${field({ label: 'Fecha', name: 'date', type: 'date', value: tx.date, required: true })}
      ${field({ label: 'Categoría', name: 'category', value: tx.category })}
      ${field({ label: 'Cuenta', name: 'accountId', value: tx.accountId, options: accountOptions(tx.accountId) })}
      ${field({ label: 'Descripción', name: 'description', type: 'textarea', value: tx.description || '', rows: 2, className: 'span-2' })}
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="tx-edit">${icon('check', 16)} Guardar</button>`,
  });
  const form = modal.body.querySelector<HTMLFormElement>('#tx-edit')!;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const data = readForm(form);
      updateTransaction(tx.id, { ...data, amount: num(data.amount) } as unknown as TransactionPatch);
      toast('Movimiento actualizado.', 'success');
      modal.close();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

export async function deleteTransactionFlow(tx: Transaction): Promise<void> {
  const ok = await confirmDialog({
    title: 'Eliminar movimiento',
    message: `¿Eliminar “${tx.description || tx.category}” por ${money(tx.amount)}?`,
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  try {
    deleteTransaction(tx.id);
    toast('Movimiento eliminado.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function openAccountForm({ accountId = null }: { accountId?: string | null } = {}): void {
  const account = accountId ? state.db.accounts.find((a) => a.id === accountId) : null;
  const modal = openModal({
    title: account ? 'Editar cuenta' : 'Nueva cuenta',
    subtitle: 'Las cuentas representan caja, bancos, billeteras o tarjetas.',
    size: 'sm',
    body: `<form id="account-form" class="form-grid" autocomplete="off">
      ${field({ label: 'Nombre de la cuenta', name: 'name', value: account?.name || '', placeholder: 'Ej. Caja principal', required: true, autofocus: true, className: 'span-2' })}
      ${field({
        label: 'Tipo',
        name: 'type',
        value: account?.type || 'cash',
        options: [
          { value: 'cash', label: 'Efectivo / caja' },
          { value: 'bank', label: 'Cuenta bancaria' },
          { value: 'wallet', label: 'Billetera digital' },
          { value: 'card', label: 'Tarjeta' },
          { value: 'other', label: 'Otra' },
        ],
      })}
      ${field({ label: 'Saldo inicial', name: 'openingBalance', type: 'number', value: account?.openingBalance ?? 0, step: '0.01', suffix: currency() })}
      ${field({ label: 'Color de referencia', name: 'color', type: 'color', value: account?.color || '#4f6ef7', className: 'span-2' })}
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-close>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="account-form">${icon('check', 16)} ${account ? 'Guardar' : 'Crear cuenta'}</button>`,
  });
  const form = modal.body.querySelector<HTMLFormElement>('#account-form')!;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const data = readForm(form);
      if (account) updateAccount(account.id, data as unknown as Partial<AccountInput>);
      else addAccount(data as unknown as AccountInput);
      toast(account ? 'Cuenta actualizada.' : 'Cuenta creada.', 'success');
      modal.close();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

export async function deleteAccountFlow(account: Account): Promise<void> {
  const ok = await confirmDialog({
    title: 'Eliminar cuenta',
    message: `¿Eliminar la cuenta “${account.name}”?`,
    detail: 'Solo puedes eliminar cuentas sin movimientos asociados.',
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  try {
    deleteAccount(account.id);
    toast('Cuenta eliminada.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ============================================================
   AJUSTES, RESPALDO Y DATOS
   ============================================================ */

export function persistSettings(): void {
  updateSettings({});
}

export async function backupData(): Promise<void> {
  try {
    const result = await window.api.backup();
    if (result.ok) toast('Respaldo guardado correctamente.', 'success', 'Copia de seguridad');
    else if (!result.canceled) toast('No se pudo guardar el respaldo.', 'error');
  } catch (err) {
    toast(err.message || 'Error al guardar el respaldo.', 'error');
  }
}

export async function restoreData(): Promise<void> {
  const ok = await confirmDialog({
    title: 'Restaurar respaldo',
    message: 'Se reemplazarán todos los datos actuales por el contenido del archivo.',
    detail: 'Recomendamos guardar un respaldo antes de continuar. Esta acción no se puede deshacer.',
    confirmLabel: 'Seleccionar archivo',
    tone: 'danger',
  });
  if (!ok) return;
  try {
    const result = await window.api.restore();
    if (result.canceled) return;
    await replaceDB(result.data);
    toast('Datos restaurados correctamente.', 'success');
    navigate('dashboard');
  } catch (err) {
    toast(err.message || 'No se pudo restaurar el respaldo.', 'error');
  }
}

export async function loadDemoFlow({ confirm = true }: { confirm?: boolean } = {}): Promise<void> {
  const hasData = state.db.clients.length || state.db.loans.length;
  if (confirm && hasData) {
    const ok = await confirmDialog({
      title: 'Cargar datos de ejemplo',
      message: 'Se reemplazarán los datos actuales por una cartera de demostración.',
      detail: 'Incluye clientes, préstamos, pagos y movimientos de caja. Guarda un respaldo si quieres conservar tu información.',
      confirmLabel: 'Cargar demostración',
      tone: 'danger',
    });
    if (!ok) return;
  }
  await loadDemo();
  toast('Datos de ejemplo cargados.', 'success', 'Listo para explorar');
  navigate('dashboard');
}

export async function clearDataFlow(): Promise<void> {
  const ok = await confirmDialog({
    title: 'Borrar todos los datos',
    message: 'Se eliminarán clientes, préstamos, pagos y movimientos de caja.',
    detail: 'Las preferencias de la aplicación se conservan. Esta acción no se puede deshacer.',
    confirmLabel: 'Borrar todo',
  });
  if (!ok) return;
  await clearData();
  toast('Base de datos vaciada.', 'success');
  navigate('dashboard');
}

export interface ExportCsvOptions {
  filename?: string;
  headers: readonly unknown[];
  rows: readonly (readonly unknown[])[];
  title?: string;
}

export async function exportCSV({ filename, headers, rows, title }: ExportCsvOptions): Promise<void> {
  try {
    const content = toCSV(headers, rows);
    const result = await window.api.saveText({
      title: title || 'Exportar CSV',
      defaultName: filename || 'export.csv',
      content,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.ok) toast('Archivo exportado.', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo exportar.', 'error');
  }
}

/* ============================================================
   BIENVENIDA
   ============================================================ */

export function showWelcome(): void {
  const modal = openModal({
    title: 'Bienvenido a Préstamos Pro',
    subtitle: 'Tu centro de control para préstamos, clientes y finanzas.',
    size: 'lg',
    body: `<div class="welcome-hero">
      <div class="welcome-icon">${icon('sparkles', 30)}</div>
      <div>
        <h3>Todo listo para empezar</h3>
        <p>Administra clientes regulares y temporales, diseña planes de pago flexibles, controla la mora y mantén tus finanzas en orden.</p>
      </div>
    </div>
    <div class="welcome-grid">
      <div class="welcome-item">
        <span>${icon('credit-card', 18)}</span>
        <div><strong>Préstamos a tu medida</strong><p>Interés mensual, anual o por cuota; cuota fija, interés global o solo interés.</p></div>
      </div>
      <div class="welcome-item">
        <span>${icon('users', 18)}</span>
        <div><strong>Clientes temporales</strong><p>Registra personas sin historial y dales seguimiento como a cualquier cliente.</p></div>
      </div>
      <div class="welcome-item">
        <span>${icon('wallet', 18)}</span>
        <div><strong>Finanzas integradas</strong><p>Cada desembolso y cada cobro se refleja automáticamente en tu caja.</p></div>
      </div>
      <div class="welcome-item">
        <span>${icon('palette', 18)}</span>
        <div><strong>Siete temas suaves</strong><p>Elige la apariencia que prefieras desde el botón de paleta.</p></div>
      </div>
    </div>
    <div class="form-note form-note--info">${icon('info', 16)}<div>Puedes empezar con una cartera de demostración para explorar todas las funciones, o crear tus propios registros desde cero.</div></div>`,
    footer: `<button class="btn btn-outline" type="button" data-empty-start>${icon('file-text', 16)} Empezar desde cero</button>
      <button class="btn btn-primary" type="button" data-demo-start>${icon('sparkles', 16)} Cargar datos de ejemplo</button>`,
  });
  modal.root.querySelector<HTMLElement>('[data-empty-start]')!.addEventListener('click', () => {
    updateSettings({ firstRun: false });
    modal.close();
    navigate('clients');
    setTimeout(() => openClientForm(), 250);
  });
  modal.root.querySelector<HTMLElement>('[data-demo-start]')!.addEventListener('click', async () => {
    modal.close();
    updateSettings({ firstRun: false });
    await loadDemoFlow({ confirm: false });
  });
}
