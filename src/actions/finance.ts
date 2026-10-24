/* Acciones de finanzas y cuentas */

import { state, addTransaction, addTransfer, updateTransaction, deleteTransaction, addAccount, updateAccount, deleteAccount } from '../lib/store.js';
import { money, num } from '../finance.js';
import { openModal, confirmDialog, toast, field, readForm, esc, icon } from '../lib/ui.js';

import type { Account, AccountInput, Transaction, TransactionInput, TransactionPatch, TransferInput } from '../types.js';
import { T, currency, accountOptions } from './shared.js';

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
