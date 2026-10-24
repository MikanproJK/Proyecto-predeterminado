/* Ajustes, respaldo y datos */

import { state, updateSettings, loadDemo, clearData, replaceDB } from '../lib/store.js';
import { toCSV } from '../finance.js';
import { confirmDialog, toast } from '../lib/ui.js';
import { navigate } from '../lib/nav.js';

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
