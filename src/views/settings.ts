/* Configuración: apariencia, negocio, valores por defecto y datos */

import { state, updateSettings } from '../lib/store.js';
import { num, money, LATE_FEE_TYPES } from '../finance.js';
import {
  icon,
  esc,
  badge,
  field,
  switchField,
  segmented,
  confirmDialog,
  toast,
} from '../lib/ui.js';
import { THEMES, DENSITIES, LOCALES, themeMeta } from '../lib/themes.js';
import { CURRENCY_OPTIONS, currencyLabel, currencyMeta } from '../lib/currencies.js';
import * as actions from '../actions.js';
import type { Density, Settings, SettingsPatch, ThemeId, UpdateStatus, ViewContext } from '../types.js';

function appearanceCard(settings: Settings) {
  return `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Apariencia</h3>
        <span class="card-sub">Elige el tema, la densidad y el tamaño del texto</span>
      </div>
      ${badge(themeMeta(settings.theme).name, 'primary')}
    </div>
    <div class="card-body">
      <div class="theme-grid">
        ${THEMES.map((theme) => {
          const active = theme.id === settings.theme;
          return `<button class="theme-card ${active ? 'is-active' : ''}" type="button" data-theme-id="${theme.id}">
            <span class="theme-card-preview" style="background:${theme.swatch}">
              <i style="background:${theme.colors[0]}"></i>
              <i style="background:${theme.colors[1]}"></i>
              <i style="background:${theme.colors[2]}"></i>
            </span>
            <span class="theme-card-main">
              <strong>${esc(theme.name)}</strong>
              <span>${esc(theme.hint)}</span>
            </span>
            <span class="theme-card-check">${active ? icon('check', 15) : ''}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="divider"></div>

      <div class="form-grid">
        <div class="field">
          <span class="field-label">Densidad de la interfaz</span>
          ${segmented(DENSITIES, settings.density, 'density')}
          <span class="field-hint">Compacta muestra más información en el mismo espacio.</span>
        </div>
        <div class="field">
          <span class="field-label">Escala de texto</span>
          <div class="scale-row">
            <input type="range" id="font-scale" min="0.85" max="1.2" step="0.05" value="${num(settings.fontScale) || 1}" aria-label="Escala de texto" />
            <strong id="font-scale-value">${Math.round((num(settings.fontScale) || 1) * 100)}%</strong>
          </div>
          <span class="field-hint">Ajusta el tamaño general de la tipografía sin cambiar el diseño.</span>
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn btn-outline btn-sm" type="button" data-reset-appearance>${icon('rotate-ccw', 15)} Restablecer apariencia</button>
      </div>
    </div>
  </section>`;
}

function businessCard(settings: Settings) {
  const accountOptions = state.db.accounts.map((account) => ({ value: account.id, label: account.name }));
  const meta = currencyMeta(settings.currency);
  return `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Negocio y moneda</h3>
        <span class="card-sub">Estos datos aparecen en recibos, contratos y reportes</span>
      </div>
    </div>
    <div class="card-body">
      <div class="form-grid" id="settings-business">
        ${field({ label: 'Nombre del negocio', name: 'company', value: settings.company || '', placeholder: 'Mi Financiera', required: true })}
        ${field({ label: 'Responsable', name: 'owner', value: settings.owner || '', placeholder: 'Tu nombre' })}
        ${field({ label: 'Moneda', name: 'currency', value: meta.code, options: CURRENCY_OPTIONS })}
        ${field({ label: 'Formato regional', name: 'locale', value: settings.locale, options: LOCALES })}
        ${field({ label: 'Cuenta predeterminada', name: 'defaultAccountId', value: settings.defaultAccountId, options: accountOptions, className: 'span-2' })}
        <div class="currency-preview span-2">
          <div class="currency-preview-main">
            <span class="currency-preview-label">Vista previa</span>
            <strong class="currency-preview-value">${money(1234567.89)}</strong>
          </div>
          <div class="currency-preview-meta">
            <span>${esc(currencyLabel(meta.code))}</span>
            <span>${meta.decimals === 0 ? 'Sin decimales' : `${meta.decimals} decimales`} · símbolo ${esc(meta.symbol)}</span>
          </div>
        </div>
      </div>
      <div class="form-note form-note--info mt-2">
        ${icon('info', 16)}
        <div>Cambiar la moneda o el formato regional actualiza los símbolos y decimales de toda la aplicación. Los valores guardados no se convierten.</div>
      </div>
    </div>
  </section>`;
}

function loanDefaultsCard(settings: Settings) {
  const meta = currencyMeta(settings.currency);
  const lateIsPercent = String(settings.lateFeeType || '').startsWith('percent');
  const lateStep = lateIsPercent || meta.decimals > 0 ? '0.01' : '1';
  return `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Valores por defecto de préstamos</h3>
        <span class="card-sub">Se aplican al crear un crédito nuevo</span>
      </div>
    </div>
    <div class="card-body">
      <div class="form-grid" id="settings-loans">
        ${field({ label: 'Cálculo de mora', name: 'lateFeeType', value: settings.lateFeeType || 'none', options: LATE_FEE_TYPES })}
        ${field({ label: 'Valor de la mora', name: 'lateFeeValue', type: 'number', value: settings.lateFeeValue ?? 0, min: '0', step: lateStep, suffix: lateIsPercent ? '%' : meta.symbol })}
        ${field({ label: 'Días de gracia', name: 'graceDays', type: 'number', value: settings.graceDays ?? 0, min: '0', step: '1' })}
      </div>
      <div class="divider"></div>
      ${switchField({
        label: 'Registrar movimientos automáticos en caja',
        name: 'autoTransactions',
        checked: settings.autoTransactions !== false,
        hint: 'Cada desembolso genera un egreso y cada cobro genera un ingreso en la cuenta elegida.',
      })}
    </div>
  </section>`;
}

function dataCard() {
  return `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Datos y respaldos</h3>
        <span class="card-sub">Toda la información se guarda localmente en tu equipo</span>
      </div>
    </div>
    <div class="card-body">
      <div class="inline-metrics mb-2">
        <div class="inline-metric"><span>Clientes</span><strong>${state.db.clients.length}</strong></div>
        <div class="inline-metric"><span>Préstamos</span><strong>${state.db.loans.length}</strong></div>
        <div class="inline-metric"><span>Pagos</span><strong>${state.db.payments.length}</strong></div>
        <div class="inline-metric"><span>Movimientos</span><strong>${state.db.transactions.length}</strong></div>
        <div class="inline-metric"><span>Cuentas</span><strong>${state.db.accounts.length}</strong></div>
      </div>

      <div class="data-path">
        <span>${icon('folder', 15)} Archivo de datos</span>
        <code id="data-path">Calculando…</code>
      </div>

      <div class="settings-actions">
        <button class="btn btn-primary btn-sm" type="button" data-action="backup">${icon('download', 15)} Guardar respaldo</button>
        <button class="btn btn-outline btn-sm" type="button" data-action="restore">${icon('upload', 15)} Restaurar respaldo</button>
        <button class="btn btn-ghost btn-sm" type="button" data-action="folder">${icon('folder', 15)} Abrir carpeta</button>
      </div>

      <div class="divider"></div>

      <div class="danger-zone">
        <h4>Zona de riesgo</h4>
        <p>Cargar la demostración o borrar los datos reemplaza la información actual. Guarda un respaldo antes de continuar.</p>
        <div class="row-inline" style="gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" type="button" data-action="demo">${icon('sparkles', 15)} Cargar datos de ejemplo</button>
          <button class="btn btn-danger-soft btn-sm" type="button" data-action="clear">${icon('trash', 15)} Borrar todos los datos</button>
        </div>
      </div>
    </div>
  </section>`;
}

function shortcutsCard() {
  const rows = [
    ['Búsqueda rápida', 'Ctrl K'],
    ['Nuevo préstamo', 'Ctrl N'],
    ['Nuevo cliente', 'Ctrl Shift N'],
    ['Registrar pago', 'Ctrl P'],
    ['Navegar secciones', 'Ctrl 1…7'],
    ['Cerrar modal', 'Esc'],
  ];
  return `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Atajos de teclado</h3>
        <span class="card-sub">Para trabajar más rápido</span>
      </div>
    </div>
    <div class="card-body">
      ${rows.map(([label, keys]) => `<div class="kbd-row"><span>${esc(label)}</span><span>${keys.split(' ').map((key) => `<kbd>${esc(key)}</kbd>`).join(' ')}</span></div>`).join('')}
    </div>
  </section>`;
}

function aboutCard(settings: Settings) {
  return `<section class="card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Acerca de Préstamos Pro</h3>
        <span class="card-sub">Aplicación de escritorio para gestión de créditos</span>
      </div>
      ${badge('v1.0.0', 'muted', { className: 'about-version-badge' })}
    </div>
    <div class="card-body">
      <div class="about-list">
        <div class="about-row"><span>Versión</span><strong data-about="version">1.0.0</strong></div>
        <div class="about-row"><span>Electron</span><strong data-about="electron">—</strong></div>
        <div class="about-row"><span>Plataforma</span><strong data-about="platform">—</strong></div>
        <div class="about-row"><span>Moneda</span><strong>${esc(currencyLabel(settings.currency))} (${esc(currencyMeta(settings.currency).symbol)})</strong></div>
        <div class="about-row"><span>Última actualización</span><strong>${esc(String(settings.updatedAt || state.db.updatedAt || '').slice(0, 10) || '—')}</strong></div>
      </div>
      <div class="settings-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="relaunch">${icon('refresh', 15)} Reiniciar aplicación</button>
      </div>
      <div class="form-note mt-2">
        ${icon('shield', 16)}
        <div>Tus datos permanecen en este equipo. No se envía información a servicios externos.</div>
      </div>
    </div>
  </section>`;
}

function updateCard() {
  return `<section class="card" id="update-card">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Actualizaciones</h3>
        <span class="card-sub">Descarga las mejoras publicadas en GitHub Releases</span>
      </div>
      <span class="badge badge--muted" data-update="badge">Consultando</span>
    </div>
    <div class="card-body">
      <div class="about-list">
        <div class="about-row"><span>Versión instalada</span><strong data-update="current">—</strong></div>
        <div class="about-row"><span>Estado</span><strong data-update="status">Consultando…</strong></div>
        <div class="about-row" data-update-row="latest" hidden><span>Nueva versión</span><strong data-update="latest">—</strong></div>
        <div class="about-row" data-update-row="checked" hidden><span>Última comprobación</span><strong data-update="checked">—</strong></div>
      </div>

      <div class="update-progress" data-update="progress-wrap" hidden>
        <div class="progress"><span class="progress-fill" data-update="progress-bar" style="width:0%"></span></div>
        <span class="update-progress-label" data-update="progress-label">0%</span>
      </div>

      <div class="form-note form-note--info mt-2" data-update="notes-wrap" hidden>
        ${icon('sparkles', 16)}
        <div class="update-notes" data-update="notes"></div>
      </div>

      <div class="settings-actions">
        <button class="btn btn-primary btn-sm" type="button" data-update-action="check">${icon('refresh', 15)} Buscar actualizaciones</button>
        <button class="btn btn-primary btn-sm" type="button" data-update-action="download" hidden>${icon('download', 15)} Descargar actualización</button>
        <button class="btn btn-primary btn-sm" type="button" data-update-action="install" hidden>${icon('check', 15)} Reiniciar e instalar</button>
      </div>

      <div class="form-note mt-2">
        ${icon('shield', 16)}
        <div>La aplicación comprueba si hay versiones nuevas al iniciar y cada seis horas. La descarga y la instalación solo ocurren cuando tú lo confirmas, y tus datos no se modifican.</div>
      </div>
    </div>
  </section>`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 || value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function tipsCard() {
  return `<section class="card card--accent">
    <div class="card-head">
      <div class="card-heading">
        <h3 class="card-title">Buenas prácticas</h3>
        <span class="card-sub">Pequeños hábitos que mantienen tus finanzas claras</span>
      </div>
    </div>
    <div class="card-body">
      <div class="stack" style="gap:10px">
        <div class="welcome-item" style="border:none;background:transparent;padding:0">
          <span>${icon('download', 17)}</span>
          <div><strong>Respalda con frecuencia</strong><p>Guarda una copia JSON al cerrar cada jornada de trabajo.</p></div>
        </div>
        <div class="welcome-item" style="border:none;background:transparent;padding:0">
          <span>${icon('receipt', 17)}</span>
          <div><strong>Registra los pagos el mismo día</strong><p>La mora y los saldos se recalculan automáticamente con cada cobro.</p></div>
        </div>
        <div class="welcome-item" style="border:none;background:transparent;padding:0">
          <span>${icon('alert', 17)}</span>
          <div><strong>Revisa la mora pendiente</strong><p>El panel y los reportes priorizan los créditos con atraso.</p></div>
        </div>
      </div>
    </div>
  </section>`;
}

let detachUpdateStatus: (() => void) | null = null;

export function render(root: HTMLElement, _ctx: ViewContext): void {
  detachUpdateStatus?.();
  detachUpdateStatus = null;
  const settings = state.db.settings;

  root.innerHTML = `<div class="page">
    <div class="settings-grid">
      <div class="stack" style="gap:16px">
        ${appearanceCard(settings)}
        ${businessCard(settings)}
        ${loanDefaultsCard(settings)}
        ${dataCard()}
      </div>
      <div class="stack" style="gap:16px">
        ${shortcutsCard()}
        ${aboutCard(settings)}
        ${updateCard()}
        ${tipsCard()}
      </div>
    </div>
  </div>`;

  /* Apariencia */
  root.querySelectorAll<HTMLElement>('[data-theme-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateSettings({ theme: (btn.dataset.themeId || 'aurora') as ThemeId });
    });
  });
  root.querySelectorAll<HTMLElement>('[data-segmented="density"] [data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateSettings({ density: (btn.dataset.value || 'comfortable') as Density });
    });
  });

  const scale = root.querySelector<HTMLInputElement>('#font-scale')!;
  if (scale) {
    scale.addEventListener('input', () => {
      const value = Number(scale.value) || 1;
      document.documentElement.style.setProperty('--font-scale', String(value));
      const label = root.querySelector<HTMLElement>('#font-scale-value');
      if (label) label.textContent = `${Math.round(value * 100)}%`;
    });
    scale.addEventListener('change', () => {
      updateSettings({ fontScale: Number(scale.value) || 1 });
    });
  }

  root.querySelector<HTMLElement>('[data-reset-appearance]')!?.addEventListener('click', () => {
    updateSettings({ theme: 'aurora', density: 'comfortable', fontScale: 1 });
    toast('Apariencia restablecida.', 'success');
  });

  /* Preferencias del negocio y valores por defecto */
  const settingsInputs = [
    ...Array.from(root.querySelectorAll<HTMLInputElement>('#settings-business [name], #settings-loans [name]')),
    root.querySelector<HTMLInputElement>('[name="autoTransactions"]'),
  ].filter((input): input is HTMLInputElement => input !== null);

  settingsInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const name = input.name;
      if (!name) return;
      let value: string | number | boolean = input.type === 'checkbox' ? input.checked : input.value;
      if (['lateFeeValue', 'graceDays'].includes(name)) value = num(value);
      if (name === 'company' && !String(value).trim()) {
        toast('El nombre del negocio no puede quedar vacío.', 'warning');
        input.value = settings.company || 'Mi Financiera';
        return;
      }
      updateSettings({ [name]: value } as SettingsPatch);
      if (name === 'currency') {
        toast(`Moneda actualizada a ${currencyLabel(String(value))}. Los importes no se convierten.`, 'info');
      } else if (name === 'company' || name === 'owner' || name === 'locale') {
        toast('Preferencia guardada.', 'success');
      }
    });
  });

  /* Datos */
  root.querySelectorAll<HTMLElement>('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      try {
        if (action === 'backup') await actions.backupData();
        else if (action === 'restore') await actions.restoreData();
        else if (action === 'demo') await actions.loadDemoFlow();
        else if (action === 'clear') await actions.clearDataFlow();
        else if (action === 'folder') {
          await window.api.openFolder();
          toast('Carpeta de datos abierta.', 'info');
        } else if (action === 'relaunch') {
          const ok = await confirmDialog({
            title: 'Reiniciar aplicación',
            message: 'La ventana se cerrará y volverá a abrir con los mismos datos.',
            confirmLabel: 'Reiniciar',
            tone: 'primary',
          });
          if (ok) await window.api.relaunch();
        }
      } catch (err) {
        toast(err.message || 'No se pudo completar la acción.', 'error');
      }
    });
  });

  /* Actualizaciones */
  const updateSection = root.querySelector<HTMLElement>('#update-card');
  if (updateSection) {
    const updateEl = <T extends HTMLElement>(selector: string) => updateSection.querySelector<T>(selector);
    const setUpdateText = (selector: string, value: string) => {
      const el = updateEl<HTMLElement>(selector);
      if (el) el.textContent = value;
    };
    const setUpdateHidden = (selector: string, hidden: boolean) => {
      const el = updateEl<HTMLElement>(selector);
      if (el) el.hidden = hidden;
    };

    const badgeEl = updateEl<HTMLElement>('[data-update="badge"]');
    const progressWrap = updateEl<HTMLElement>('[data-update="progress-wrap"]');
    const progressBar = updateEl<HTMLElement>('[data-update="progress-bar"]');
    const notesWrap = updateEl<HTMLElement>('[data-update="notes-wrap"]');
    const checkBtn = updateEl<HTMLButtonElement>('[data-update-action="check"]');
    const downloadBtn = updateEl<HTMLButtonElement>('[data-update-action="download"]');
    const installBtn = updateEl<HTMLButtonElement>('[data-update-action="install"]');

    const toneFor = (phase: UpdateStatus['phase']): string => {
      if (phase === 'available') return 'primary';
      if (phase === 'downloading') return 'warning';
      if (phase === 'downloaded' || phase === 'up-to-date') return 'success';
      if (phase === 'error') return 'danger';
      if (phase === 'unsupported') return 'muted';
      return 'info';
    };

    const labelFor = (phase: UpdateStatus['phase']): string => {
      const labels: Record<UpdateStatus['phase'], string> = {
        idle: 'Listo',
        checking: 'Buscando',
        available: 'Disponible',
        downloading: 'Descargando',
        downloaded: 'Lista',
        'up-to-date': 'Al día',
        error: 'Error',
        unsupported: 'No disponible',
      };
      return labels[phase] || 'Listo';
    };

    const paintUpdate = (status: UpdateStatus) => {
      const version = status.currentVersion ? `v${status.currentVersion}` : '—';
      setUpdateText('[data-update="current"]', version);
      setUpdateText('[data-update="status"]', status.message || 'Sin novedades.');
      if (badgeEl) {
        badgeEl.className = `badge badge--${toneFor(status.phase)}`;
        badgeEl.textContent = labelFor(status.phase);
      }

      const showLatest =
        Boolean(status.version) &&
        ['available', 'downloading', 'downloaded'].includes(status.phase);
      setUpdateHidden('[data-update-row="latest"]', !showLatest);
      if (showLatest) setUpdateText('[data-update="latest"]', `v${status.version}`);

      const checked = status.checkedAt ? new Date(status.checkedAt) : null;
      const hasChecked = Boolean(checked && !Number.isNaN(checked.getTime()));
      setUpdateHidden('[data-update-row="checked"]', !hasChecked);
      if (hasChecked && checked) {
        setUpdateText(
          '[data-update="checked"]',
          checked.toLocaleString(settings.locale || 'es-419', { dateStyle: 'short', timeStyle: 'short' }),
        );
      }

      const showProgress = status.phase === 'downloading' || status.phase === 'downloaded';
      if (progressWrap) progressWrap.hidden = !showProgress;
      const percent = status.phase === 'downloaded' ? 100 : Math.max(0, Math.min(100, status.progress));
      if (progressBar) progressBar.style.width = `${percent}%`;
      const transferred = formatBytes(status.transferred);
      const total = formatBytes(status.total);
      const detail = transferred && total ? ` · ${transferred} de ${total}` : '';
      setUpdateText('[data-update="progress-label"]', `${percent}%${detail}`);

      const notes = status.releaseNotes.trim();
      const showNotes =
        Boolean(notes) && ['available', 'downloading', 'downloaded'].includes(status.phase);
      if (notesWrap) notesWrap.hidden = !showNotes;
      if (showNotes) setUpdateText('[data-update="notes"]', notes);

      if (checkBtn) checkBtn.disabled = !status.canCheck;
      if (downloadBtn) downloadBtn.hidden = !status.canDownload;
      if (installBtn) installBtn.hidden = !status.canInstall;
    };

    checkBtn?.addEventListener('click', async () => {
      checkBtn.disabled = true;
      try {
        const status = await window.api.checkForUpdates();
        paintUpdate(status);
        if (status.phase === 'up-to-date') toast('Ya tienes la última versión.', 'success');
        else if (status.phase === 'available') toast(`Nueva versión ${status.version} disponible.`, 'info');
        else if (status.phase === 'unsupported') toast(status.message, 'info');
        else if (status.phase === 'error') toast(status.message, 'error');
      } catch (err) {
        toast(err.message || 'No se pudo buscar actualizaciones.', 'error');
      }
    });

    downloadBtn?.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      try {
        const status = await window.api.downloadUpdate();
        paintUpdate(status);
        if (status.phase === 'error') toast(status.message, 'error');
      } catch (err) {
        toast(err.message || 'No se pudo descargar la actualización.', 'error');
      } finally {
        downloadBtn.disabled = false;
      }
    });

    installBtn?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Instalar actualización',
        message:
          'La aplicación se cerrará para instalar la nueva versión y volverá a abrir. Tus datos se conservan.',
        confirmLabel: 'Reiniciar e instalar',
        tone: 'primary',
      });
      if (!ok) return;
      try {
        const started = await window.api.installUpdate();
        if (!started) toast('La actualización todavía no está lista.', 'warning');
      } catch (err) {
        toast(err.message || 'No se pudo instalar la actualización.', 'error');
      }
    });

    if (window.api?.onUpdateStatus) {
      detachUpdateStatus = window.api.onUpdateStatus((status) => paintUpdate(status));
    }
    window.api?.updateStatus?.()
      .then((status) => paintUpdate(status))
      .catch(() => setUpdateText('[data-update="status"]', 'No se pudo consultar el estado.'));
  }

  /* Información del sistema */
  window.api?.info?.()
    .then((info) => {
      if (!info) return;
      const pathEl = document.getElementById('data-path')!;
      if (pathEl) pathEl.textContent = info.dataFile || '-';
      const versionEl = document.querySelector<HTMLElement>('[data-about="version"]')!;
      if (versionEl) versionEl.textContent = info.version || '—';
      const badgeEl = document.querySelector<HTMLElement>('.about-version-badge');
      if (badgeEl && info.version) badgeEl.textContent = `v${info.version}`;
      const electronEl = document.querySelector<HTMLElement>('[data-about="electron"]')!;
      if (electronEl) electronEl.textContent = info.electron || '—';
      const platformEl = document.querySelector<HTMLElement>('[data-about="platform"]')!;
      if (platformEl) platformEl.textContent = info.platform || '—';
    })
    .catch(() => {
      const pathEl = document.getElementById('data-path')!;
      if (pathEl) pathEl.textContent = 'No disponible';
    });
}
