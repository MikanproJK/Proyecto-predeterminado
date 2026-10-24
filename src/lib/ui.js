/* Utilidades de interfaz: modales, avisos, gráficos y componentes HTML */

import { icon, logoSVG } from './icons.js';
import { money, num, round2 } from '../finance.js';

export { icon, logoSVG };

let chartSeq = 0;

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function nl2br(value) {
  return esc(value).replace(/\r?\n/g, '<br />');
}

export function debounce(fn, wait = 250) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  return wrapped;
}

export function hashString(text) {
  let hash = 0;
  for (let i = 0; i < String(text).length; i += 1) {
    hash = (hash * 31 + String(text).charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function initial(name) {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export function avatar(name, size = 38, extra = '') {
  const hue = hashString(name) % 360;
  return `<span class="avatar ${extra}" style="--av-size:${size}px;--av-hue:${hue}" title="${esc(name)}">${esc(initial(name))}</span>`;
}

const TONES = ['success', 'danger', 'warning', 'info', 'primary', 'muted'];

export function badge(text, tone = 'muted', { dot = false, className = '' } = {}) {
  const safeTone = TONES.includes(tone) ? tone : 'muted';
  return `<span class="badge badge--${safeTone} ${className}">${dot ? '<i class="dot"></i>' : ''}${esc(text)}</span>`;
}

export function progressBar(value, tone = 'primary', { thin = false, label = '' } = {}) {
  const pct = Math.max(0, Math.min(100, num(value) * 100));
  return `<div class="progress ${thin ? 'progress--thin' : ''}" role="progressbar" aria-valuenow="${round2(pct)}" aria-valuemin="0" aria-valuemax="100" title="${esc(label || `${pct.toFixed(0)}%`)}">
    <span class="progress-fill progress-fill--${esc(tone)}" style="width:${pct.toFixed(2)}%"></span>
  </div>`;
}

export function emptyState({ title = 'Sin datos', text = '', iconName = 'sparkles', action = '', compact = false } = {}) {
  return `<div class="empty ${compact ? 'empty--compact' : ''}">
    <span class="empty-icon">${icon(iconName, compact ? 22 : 30)}</span>
    <strong>${esc(title)}</strong>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${action || ''}
  </div>`;
}

export function statCard({ label, value, hint = '', iconName = 'chart', tone = 'primary', badgeHtml = '', extraClass = '' }) {
  return `<article class="stat stat--${esc(tone)} ${extraClass}">
    <div class="stat-top">
      <span class="stat-icon">${icon(iconName, 19)}</span>
      ${badgeHtml}
    </div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${esc(label)}</div>
    ${hint ? `<div class="stat-hint">${hint}</div>` : ''}
  </article>`;
}

export function tabs(items, active) {
  return `<div class="tabs" role="tablist">
    ${items
      .map(
        (item) =>
          `<button class="tab ${item.value === active ? 'is-active' : ''}" role="tab" data-tab="${esc(item.value)}" type="button">
            ${item.icon ? icon(item.icon, 16) : ''}<span>${esc(item.label)}</span>
            ${item.count !== undefined ? `<span class="tab-count">${esc(item.count)}</span>` : ''}
          </button>`,
      )
      .join('')}
  </div>`;
}

export function segmented(items, active, name = 'seg') {
  return `<div class="segmented" data-segmented="${esc(name)}">
    ${items
      .map(
        (item) =>
          `<button type="button" class="segmented-item ${item.value === active ? 'is-active' : ''}" data-value="${esc(item.value)}">
            ${item.icon ? icon(item.icon, 15) : ''}${esc(item.label)}
          </button>`,
      )
      .join('')}
  </div>`;
}

export function pagination({ page, totalPages, total, label = 'registros' }) {
  if (totalPages <= 1) {
    return `<div class="table-foot"><span>${total} ${esc(label)}</span></div>`;
  }
  return `<div class="table-foot">
    <span>${total} ${esc(label)}</span>
    <div class="pagination">
      <button class="btn btn-icon btn-ghost" type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${icon('chevron-left', 16)}</button>
      <span>Página ${page} de ${totalPages}</span>
      <button class="btn btn-icon btn-ghost" type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>${icon('chevron-right', 16)}</button>
    </div>
  </div>`;
}

/* ---------- gráficos ---------- */

function axisLabel(value) {
  const n = num(value);
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${round2(n / 1000000)}M`;
  if (abs >= 1000) return `${round2(n / 1000)}k`;
  return String(round2(n));
}

function niceMax(value) {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function barChart(series, { height = 220, compact = true } = {}) {
  const W = 700;
  const H = height;
  const pad = { top: 18, right: 10, bottom: 30, left: 44 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => [num(s.income), num(s.expense)])));
  const groupW = innerW / Math.max(1, series.length);
  const barW = Math.min(22, Math.max(7, groupW * 0.24));

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = pad.top + innerH * (1 - f);
      return `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" class="chart-grid" />
        <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" class="chart-axis">${axisLabel(max * f)}</text>`;
    })
    .join('');

  const bars = series
    .map((item, index) => {
      const center = pad.left + groupW * index + groupW / 2;
      const incomeH = Math.max(2, (num(item.income) / max) * innerH);
      const expenseH = Math.max(2, (num(item.expense) / max) * innerH);
      const x1 = center - barW - 3;
      const x2 = center + 3;
      const active = num(item.income) + num(item.expense) > 0;
      return `<g class="chart-group">
        <rect x="${x1}" y="${pad.top + innerH - incomeH}" width="${barW}" height="${incomeH}" rx="5" class="chart-bar chart-bar--income" opacity="${active ? 1 : 0.25}">
          <title>${esc(item.label)} · Ingresos ${money(item.income)}</title>
        </rect>
        <rect x="${x2}" y="${pad.top + innerH - expenseH}" width="${barW}" height="${expenseH}" rx="5" class="chart-bar chart-bar--expense" opacity="${active ? 1 : 0.25}">
          <title>${esc(item.label)} · Egresos ${money(item.expense)}</title>
        </rect>
        <text x="${center}" y="${H - 10}" text-anchor="middle" class="chart-axis chart-axis--x">${esc(item.label)}</text>
      </g>`;
    })
    .join('');

  return `<div class="chart chart--bars">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart-svg" style="height:${H}px">
      ${grid}
      ${bars}
    </svg>
  </div>`;
}

export function areaChart(points, { height = 200, tone = 'primary' } = {}) {
  const W = 700;
  const H = height;
  const pad = { top: 16, right: 14, bottom: 26, left: 42 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...points.map((p) => num(p.value))));
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const coords = points.map((p, i) => ({
    x: pad.left + step * i,
    y: pad.top + innerH - (num(p.value) / max) * innerH,
    ...p,
  }));

  let path = '';
  coords.forEach((pt, i) => {
    if (i === 0) {
      path += `M ${pt.x} ${pt.y}`;
    } else {
      const prev = coords[i - 1];
      const cx = (prev.x + pt.x) / 2;
      path += ` C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }
  });
  const area = coords.length
    ? `${path} L ${coords[coords.length - 1].x} ${pad.top + innerH} L ${coords[0].x} ${pad.top + innerH} Z`
    : '';
  const gradId = `area-${(chartSeq += 1)}`;

  const grid = [0, 0.5, 1]
    .map((f) => {
      const y = pad.top + innerH * (1 - f);
      return `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" class="chart-grid" />
        <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" class="chart-axis">${axisLabel(max * f)}</text>`;
    })
    .join('');

  const dots = coords
    .map(
      (pt) =>
        `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" class="chart-dot chart-dot--${esc(tone)}">
          <title>${esc(pt.label)} · ${money(pt.value)}</title>
        </circle>`,
    )
    .join('');

  const labels = coords
    .map((pt, i) =>
      i % Math.ceil(coords.length / 6) === 0 || i === coords.length - 1
        ? `<text x="${pt.x}" y="${H - 8}" text-anchor="middle" class="chart-axis chart-axis--x">${esc(pt.label)}</text>`
        : '',
    )
    .join('');

  return `<div class="chart chart--area">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart-svg" style="height:${H}px">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" class="area-stop-start" />
          <stop offset="100%" class="area-stop-end" />
        </linearGradient>
      </defs>
      ${grid}
      ${area ? `<path d="${area}" fill="url(#${gradId})" class="chart-area chart-area--${esc(tone)}" />` : ''}
      ${path ? `<path d="${path}" class="chart-line chart-line--${esc(tone)}" fill="none" />` : ''}
      ${dots}
      ${labels}
    </svg>
  </div>`;
}

export function donutChart(segments, { size = 168, thickness = 16, centerLabel = '', centerValue = '' } = {}) {
  const total = segments.reduce((acc, s) => acc + num(s.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const rings = segments
    .map((segment) => {
      const value = num(segment.value);
      if (value <= 0) return '';
      const length = (value / total) * circumference;
      const dash = `${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`;
      const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none"
        stroke="${esc(segment.color)}" stroke-width="${thickness}" stroke-linecap="round"
        stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" class="donut-seg">
        <title>${esc(segment.label)} · ${money(value)}</title>
      </circle>`;
      offset += length;
      return el;
    })
    .join('');

  return `<div class="donut-wrap" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}" />
      ${rings}
    </svg>
    <div class="donut-center">
      <strong>${centerValue}</strong>
      <span>${esc(centerLabel)}</span>
    </div>
  </div>`;
}

export function legend(items) {
  return `<ul class="legend">
    ${items
      .map(
        (item) => `<li>
          <span class="legend-dot" style="background:${esc(item.color)}"></span>
          <span class="legend-label">${esc(item.label)}</span>
          <span class="legend-value">${item.value !== undefined ? esc(item.value) : ''}</span>
        </li>`,
      )
      .join('')}
  </ul>`;
}

export function sparkline(values, tone = 'primary', width = 108, height = 34) {
  const vals = values.map(num);
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const step = vals.length > 1 ? width / (vals.length - 1) : width;
  const points = vals.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / range) * (height - 6)).toFixed(1)}`).join(' ');
  return `<svg class="sparkline sparkline--${esc(tone)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
    <polyline points="${points}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

/* ---------- modales ---------- */

const modalStack = [];

function syncBodyLock() {
  document.documentElement.classList.toggle('has-modal', modalStack.length > 0);
}

export function closeAllModals() {
  while (modalStack.length) modalStack[modalStack.length - 1].close();
}

export function openModal({
  title = '',
  subtitle = '',
  body = '',
  footer = '',
  size = 'md',
  className = '',
  closeOnBackdrop = true,
  onMount = null,
  onClose = null,
  headerExtra = '',
} = {}) {
  const root = document.getElementById('overlay-root');
  const previouslyFocused = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal--${esc(size)} ${esc(className)}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">
        <div class="modal-heading">
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        <div class="modal-head-tools">
          ${headerExtra}
          <button class="btn btn-icon btn-ghost modal-close" type="button" aria-label="Cerrar">${icon('x', 18)}</button>
        </div>
      </header>
      <div class="modal-body"></div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;

  const bodyEl = backdrop.querySelector('.modal-body');
  if (body instanceof Node) bodyEl.append(body);
  else bodyEl.innerHTML = body;
  if (footer instanceof Node) {
    const footEl = backdrop.querySelector('.modal-foot');
    footEl.innerHTML = '';
    footEl.append(footer);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.add('is-closing');
    const remove = () => {
      backdrop.remove();
      const idx = modalStack.findIndex((m) => m.close === close);
      if (idx >= 0) modalStack.splice(idx, 1);
      syncBodyLock();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try {
          previouslyFocused.focus();
        } catch {
          /* ignore */
        }
      }
      if (typeof onClose === 'function') onClose();
    };
    setTimeout(remove, 160);
  };

  modalStack.push({ close, backdrop });
  root.append(backdrop);
  syncBodyLock();

  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('mousedown', (event) => {
    if (closeOnBackdrop && event.target === backdrop) close();
  });
  backdrop.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));

  // Fuerza un reflow para que la transición de entrada se ejecute incluso si
  // requestAnimationFrame está limitado (ventana oculta o en segundo plano).
  void backdrop.offsetWidth;
  backdrop.classList.add('is-open');
  const focusable =
    bodyEl.querySelector('[autofocus]') ||
    bodyEl.querySelector('input:not([type="hidden"]), select, textarea, button');
  if (focusable) focusable.focus({ preventScroll: true });

  if (typeof onMount === 'function') onMount({ root: backdrop, body: bodyEl, close });

  return { root: backdrop, body: bodyEl, close };
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalStack.length) {
    event.preventDefault();
    modalStack[modalStack.length - 1].close();
  }
});

export function confirmDialog({
  title = '¿Confirmas esta acción?',
  message = '',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  detail = '',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value, close) => {
      if (settled) return;
      settled = true;
      resolve(value);
      close();
    };
    const modal = openModal({
      title,
      size: 'sm',
      className: 'modal--confirm',
      body: `<p class="confirm-text">${message}</p>${detail ? `<div class="confirm-detail">${detail}</div>` : ''}`,
      footer: `<button class="btn btn-ghost" type="button" data-cancel>${esc(cancelLabel)}</button>
        <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" type="button" data-confirm>${esc(confirmLabel)}</button>`,
      onClose: () => finish(false, () => {}),
    });
    modal.root.querySelector('[data-cancel]').addEventListener('click', () => finish(false, modal.close));
    modal.root.querySelector('[data-confirm]').addEventListener('click', () => finish(true, modal.close));
  });
}

/* ---------- avisos ---------- */

export function toast(message, tone = 'success', title = '') {
  const root = document.getElementById('toast-root');
  const item = document.createElement('div');
  const iconName = tone === 'error' ? 'x-circle' : tone === 'warning' ? 'alert' : tone === 'info' ? 'info' : 'check-circle';
  item.className = `toast toast--${tone}`;
  item.innerHTML = `<span class="toast-icon">${icon(iconName, 18)}</span>
    <div class="toast-text">${title ? `<strong>${esc(title)}</strong>` : ''}<span>${esc(message)}</span></div>
    <button class="toast-close" type="button" aria-label="Cerrar">${icon('x', 14)}</button>`;
  root.append(item);
  void item.offsetWidth;
  item.classList.add('is-visible');
  const remove = () => {
    item.classList.remove('is-visible');
    setTimeout(() => item.remove(), 220);
  };
  item.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, 4200);
}

/* ---------- formularios ---------- */

export function readForm(form) {
  const data = {};
  form.querySelectorAll('input[name], select[name], textarea[name]').forEach((field) => {
    if (field.type === 'checkbox') data[field.name] = field.checked;
    else if (field.type === 'number') data[field.name] = field.value === '' ? null : Number(field.value);
    else if (field.multiple) data[field.name] = Array.from(field.selectedOptions).map((o) => o.value);
    else data[field.name] = field.value.trim();
  });
  return data;
}

export function field({
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  hint = '',
  required = false,
  step = '0.01',
  min = '',
  max = '',
  options = null,
  rows = 3,
  className = '',
  autofocus = false,
  disabled = false,
  prefix = '',
  suffix = '',
} = {}) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  const common = `id="${id}" name="${esc(name)}" class="input" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''} ${
    autofocus ? 'autofocus' : ''
  }`;
  let control = '';
  if (options) {
    control = `<select ${common}>
      ${options
        .map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lab = typeof opt === 'string' ? opt : opt.label;
          return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${esc(lab)}</option>`;
        })
        .join('')}
    </select>`;
  } else if (type === 'textarea') {
    control = `<textarea ${common} rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
  } else {
    control = `<input ${common} type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}"
      ${type === 'number' ? `step="${esc(step)}" ${min !== '' ? `min="${esc(min)}"` : ''} ${max !== '' ? `max="${esc(max)}"` : ''}` : ''} />`;
  }
  return `<label class="field ${esc(className)}" for="${id}">
    <span class="field-label">${esc(label)}${required ? '<em>*</em>' : ''}</span>
    <span class="input-wrap ${prefix ? 'has-prefix' : ''} ${suffix ? 'has-suffix' : ''}">
      ${prefix ? `<span class="input-affix input-affix--prefix">${esc(prefix)}</span>` : ''}
      ${control}
      ${suffix ? `<span class="input-affix input-affix--suffix">${esc(suffix)}</span>` : ''}
    </span>
    ${hint ? `<span class="field-hint">${hint}</span>` : ''}
  </label>`;
}

export function switchField({ label, name, checked = false, hint = '' }) {
  return `<label class="switch-field">
    <span class="switch-copy"><strong>${esc(label)}</strong>${hint ? `<span>${esc(hint)}</span>` : ''}</span>
    <span class="switch"><input type="checkbox" name="${esc(name)}" ${checked ? 'checked' : ''} /><i></i></span>
  </label>`;
}

export function toastIcon(tone) {
  return tone === 'error' ? 'x-circle' : 'check-circle';
}
