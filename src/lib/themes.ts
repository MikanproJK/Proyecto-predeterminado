import type { Density, ThemeId, ThemeMode } from '../types.js';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  hint: string;
  mode: ThemeMode;
  bg: string;
  ink: string;
  swatch: string;
  colors: [string, string, string];
}

export interface OptionMeta<T extends string = string> {
  value: T;
  label: string;
}

export const THEMES: readonly ThemeMeta[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    hint: 'Luz suave',
    mode: 'light',
    bg: '#eef2fb',
    ink: '#1b2437',
    swatch: 'linear-gradient(135deg, #e4ecff, #f0e8ff)',
    colors: ['#4f6ef7', '#8b5cf6', '#eef2fb'],
  },
  {
    id: 'ocean',
    name: 'Océano',
    hint: 'Fresco y sereno',
    mode: 'light',
    bg: '#e9f4f7',
    ink: '#12303a',
    swatch: 'linear-gradient(135deg, #cdeff5, #dcf5ea)',
    colors: ['#0f8ea8', '#2fa07a', '#e9f4f7'],
  },
  {
    id: 'forest',
    name: 'Bosque',
    hint: 'Natural y cálido',
    mode: 'light',
    bg: '#eef5ee',
    ink: '#1b2f22',
    swatch: 'linear-gradient(135deg, #d8ecd9, #f0f5e5)',
    colors: ['#2f8f5b', '#7d9a3f', '#eef5ee'],
  },
  {
    id: 'sand',
    name: 'Arena',
    hint: 'Cálido y neutro',
    mode: 'light',
    bg: '#f6f0e6',
    ink: '#3a3025',
    swatch: 'linear-gradient(135deg, #f1e4d1, #f8efe2)',
    colors: ['#b06a3b', '#96772f', '#f6f0e6'],
  },
  {
    id: 'rose',
    name: 'Rosa',
    hint: 'Delicado y moderno',
    mode: 'light',
    bg: '#fbeef3',
    ink: '#3a2531',
    swatch: 'linear-gradient(135deg, #f9dceb, #f0e4ff)',
    colors: ['#d0548a', '#9a6ad4', '#fbeef3'],
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    hint: 'Oscuro y profundo',
    mode: 'dark',
    bg: '#0d1220',
    ink: '#e9eefc',
    swatch: 'linear-gradient(135deg, #131b2d, #221c3a)',
    colors: ['#7d94ff', '#b18cff', '#131b2d'],
  },
  {
    id: 'noir',
    name: 'Noir',
    hint: 'Oscuro cálido',
    mode: 'dark',
    bg: '#17161a',
    ink: '#f2ecf0',
    swatch: 'linear-gradient(135deg, #262126, #38302a)',
    colors: ['#e7b768', '#d98b5f', '#17161a'],
  },
];

export function themeMeta(id?: string | null): ThemeMeta {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}

export const DENSITIES: readonly OptionMeta<Density>[] = [
  { value: 'comfortable', label: 'Cómoda' },
  { value: 'compact', label: 'Compacta' },
];

export const LOCALES: readonly OptionMeta[] = [
  { value: 'es-419', label: 'Español (Latinoamérica)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'es-CL', label: 'Español (Chile)' },
  { value: 'es-PE', label: 'Español (Perú)' },
  { value: 'es-VE', label: 'Español (Venezuela)' },
  { value: 'es-DO', label: 'Español (Rep. Dominicana)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'en-US', label: 'English (United States)' },
];
