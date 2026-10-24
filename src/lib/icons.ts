/* Iconos SVG inline (trazo, 24x24) */

const P: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'user-plus': '<path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/>',
  wallet: '<path d="M20 7H6a2 2 0 0 1 0-4h12a1 1 0 0 1 1 1v3"/><path d="M3 5v13a3 3 0 0 0 3 3h14a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H6"/><circle cx="16" cy="13.5" r="1.4" fill="currentColor" stroke="none"/>',
  'credit-card': '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19"/><path d="M6 15h3"/>',
  receipt: '<path d="M5 3h14a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
  'trending-up': '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  'trending-down': '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.09A1.7 1.7 0 0 0 10 3.05V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  alert: '<path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  'arrow-down-left': '<path d="M17 7 7 17"/><path d="M16 17H7V8"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  bank: '<path d="m3 10 9-6 9 6"/><path d="M5 10v9"/><path d="M9.5 10v9"/><path d="M14.5 10v9"/><path d="M19 10v9"/><path d="M3 21h18"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5h.01"/><path d="M18 14.5h.01"/>',
  coins: '<circle cx="9" cy="9" r="6"/><path d="M15.3 4.3a6 6 0 0 1 0 15.4"/><path d="M12.7 19.7A6 6 0 0 0 21 9"/>',
  sparkles: '<path d="m12 3 1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z"/><path d="M19 14.5 20 17l2.5 1-2.5 1-1 2.5-1-2.5L15.5 18l2.5-1Z"/><path d="M5 15.5 5.8 17.5 7.8 18.3 5.8 19.1 5 21.1 4.2 19.1 2.2 18.3 4.2 17.5Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 15h12v6H6Z"/>',
  filter: '<path d="M4 5h16l-6.4 7.5V20l-3.2-1.6v-5.9Z"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 4v5h-5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-1.4-1.4-2-1.4-3.2 0-.9.7-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-3.9-4-7-9-7Z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.5" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="6.3" r="1.2" fill="currentColor" stroke="none"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',
  shield: '<path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  percent: '<path d="m19 5-14 14"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  sliders: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/>',
  'file-text': '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  gauge: '<path d="M3.5 18a9 9 0 1 1 17 0"/><path d="m12 14 4-4"/><circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  message: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.2-4.2A8 8 0 1 1 21 12Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  'external-link': '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  save: '<path d="M5 3h11l3 3v15H5Z"/><path d="M8 3v6h7V3"/><rect x="8" y="13" width="8" height="5"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
};

export function icon(name: string, size: number | string = 18, extraClass = ''): string {
  const path = P[name] || P.info;
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function logoSVG(size: number | string = 28, id = 'lg'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="logo-grad-${id}" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop stop-color="#6d8bff"/>
        <stop offset="0.55" stop-color="#5b6cf9"/>
        <stop offset="1" stop-color="#9a5cf5"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#logo-grad-${id})"/>
    <path d="M14 32.5V20.5" stroke="white" stroke-width="4.2" stroke-linecap="round" opacity="0.72"/>
    <path d="M24 32.5V15.5" stroke="white" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M34 32.5V24.5" stroke="white" stroke-width="4.2" stroke-linecap="round" opacity="0.86"/>
    <path d="M13 14.2 34 9.6" stroke="white" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
  </svg>`;
}
