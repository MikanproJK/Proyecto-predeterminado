/* Bienvenida inicial */

import { updateSettings } from '../lib/store.js';
import { openModal, icon } from '../lib/ui.js';
import { navigate } from '../lib/nav.js';
import { openClientForm } from './clients.js';
import { loadDemoFlow } from './settings.js';

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
        <div><strong>Préstamos a tu medida</strong><p>Interés por porcentaje o monto fijo; cuota fija, interés global o solo interés.</p></div>
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
