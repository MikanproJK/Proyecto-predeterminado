/* Atajos de teclado globales */

import { navigate } from './nav.js';
import { NAV_ORDER } from './routes.js';
import { currentRouteId, currentRouteName } from './router.js';
import { openPalette } from './palette.js';
import * as actions from '../actions.js';

function modalIsOpen(): boolean {
  return !!document.querySelector('.modal-backdrop');
}

export function installShortcuts(): void {
  document.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const routeName = currentRouteName();
    const routeId = currentRouteId();

    if (mod && key === 'k') {
      event.preventDefault();
      if (!modalIsOpen()) openPalette();
      return;
    }
    if (document.getElementById('palette-backdrop')) return;
    if (mod && key === 'n' && !event.shiftKey) {
      event.preventDefault();
      if (!modalIsOpen()) actions.openLoanForm({ clientId: routeName === 'client' ? routeId ?? undefined : undefined });
      return;
    }
    if (mod && event.shiftKey && key === 'n') {
      event.preventDefault();
      if (!modalIsOpen()) actions.openClientForm();
      return;
    }
    if (mod && key === 'p') {
      event.preventDefault();
      if (!modalIsOpen()) {
        actions.openPaymentModal({
          loanId: routeName === 'loan' ? routeId ?? undefined : undefined,
          clientId: routeName === 'client' ? routeId ?? undefined : undefined,
        });
      }
      return;
    }
    if (mod && /^[1-7]$/.test(key)) {
      event.preventDefault();
      navigate(NAV_ORDER[Number(key) - 1]);
    }
  });
}
