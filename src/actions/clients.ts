/* Acciones de clientes */

import { state, addClient, updateClient, deleteClient } from '../lib/store.js';
import { addMonthsISO } from '../finance.js';
import { openModal, confirmDialog, toast, field, switchField, readForm, icon } from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import type { Client, ClientInput } from '../types.js';
import { T } from './shared.js';

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
