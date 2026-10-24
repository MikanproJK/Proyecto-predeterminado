/* Configuración de rutas, navegación y metadatos de cada sección */

import type { RouteName } from '../types.js';

export interface QuickAction {
  label: string;
  icon: string;
  action: string;
}

export interface RouteMeta {
  title: string;
  eyebrow: string;
  icon: string;
  nav: string;
  quick: QuickAction;
}

export interface NavItem {
  route: RouteName;
  label: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ROUTES: Record<string, RouteMeta> = {
  dashboard: {
    title: 'Panel',
    eyebrow: 'Resumen general',
    icon: 'dashboard',
    nav: 'dashboard',
    quick: { label: 'Nuevo préstamo', icon: 'plus', action: 'new-loan' },
  },
  clients: {
    title: 'Clientes',
    eyebrow: 'Directorio y seguimiento',
    icon: 'users',
    nav: 'clients',
    quick: { label: 'Nuevo cliente', icon: 'user-plus', action: 'new-client' },
  },
  client: {
    title: 'Cliente',
    eyebrow: 'Ficha del cliente',
    icon: 'user',
    nav: 'clients',
    quick: { label: 'Nuevo préstamo', icon: 'plus', action: 'new-loan' },
  },
  loans: {
    title: 'Préstamos',
    eyebrow: 'Cartera de créditos',
    icon: 'credit-card',
    nav: 'loans',
    quick: { label: 'Nuevo préstamo', icon: 'plus', action: 'new-loan' },
  },
  loan: {
    title: 'Préstamo',
    eyebrow: 'Detalle del crédito',
    icon: 'file-text',
    nav: 'loans',
    quick: { label: 'Registrar pago', icon: 'receipt', action: 'new-payment' },
  },
  payments: {
    title: 'Cobros',
    eyebrow: 'Pagos recibidos',
    icon: 'receipt',
    nav: 'payments',
    quick: { label: 'Registrar pago', icon: 'plus', action: 'new-payment' },
  },
  finance: {
    title: 'Finanzas',
    eyebrow: 'Caja y movimientos',
    icon: 'wallet',
    nav: 'finance',
    quick: { label: 'Nuevo movimiento', icon: 'plus', action: 'new-movement' },
  },
  reports: {
    title: 'Reportes',
    eyebrow: 'Análisis del negocio',
    icon: 'chart',
    nav: 'reports',
    quick: { label: 'Imprimir reporte', icon: 'print', action: 'print-report' },
  },
  settings: {
    title: 'Configuración',
    eyebrow: 'Preferencias y datos',
    icon: 'settings',
    nav: 'settings',
    quick: { label: 'Guardar respaldo', icon: 'download', action: 'backup' },
  },
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { route: 'dashboard', label: 'Panel', icon: 'dashboard' },
      { route: 'clients', label: 'Clientes', icon: 'users' },
      { route: 'loans', label: 'Préstamos', icon: 'credit-card' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { route: 'payments', label: 'Cobros', icon: 'receipt' },
      { route: 'finance', label: 'Movimientos', icon: 'wallet' },
      { route: 'reports', label: 'Reportes', icon: 'chart' },
    ],
  },
  {
    label: 'Sistema',
    items: [{ route: 'settings', label: 'Configuración', icon: 'settings' }],
  },
];

export const NAV_ORDER: RouteName[] = [
  'dashboard',
  'clients',
  'loans',
  'payments',
  'finance',
  'reports',
  'settings',
];
