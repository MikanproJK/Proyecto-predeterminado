# Préstamos Pro

Aplicación de escritorio para administrar una cartera de préstamos, los clientes, los cobros y las finanzas del negocio. Funciona sin conexión y guarda todos los datos en un archivo JSON local.

## Funcionalidad

- **Panel general** con cartera, capital, cobros del mes, mora, vencimientos, composición de la deuda, actividad reciente y clientes en atraso.
- **Clientes** regulares y temporales, con contacto, documento, vigencia, notas, estado activo/inactivo y ficha completa con historial de préstamos y pagos.
- **Préstamos** con monto, tasa, base de tasa, frecuencia, número de cuotas, cargo inicial, mora, días de gracia, garantía, notas y cuenta de desembolso.
- **Motor financiero** con cuatro sistemas de amortización:
  - Cuota fija (sistema francés).
  - Abono fijo a capital (capital constante, cuota decreciente).
  - Interés global (interés plano por período).
  - Solo interés / pago único al final (bullet).
- **Tasas** mensuales, anuales o por período, y frecuencias diaria, semanal, quincenal, mensual o personalizada.
- **Mora** fija diaria, porcentaje diario sobre saldo, porcentaje diario sobre cuota, porcentaje único o monto único, con días de gracia.
- **Pagos** aplicados en orden cronológico: mora → cargos → interés → capital. El excedente queda a favor del cliente.
- **Cobros** con recibos imprimibles, edición, eliminación y creación automática del ingreso en caja.
- **Finanzas** con cuentas (efectivo, banco, billetera, tarjeta), ingresos, egresos, transferencias y categorías personalizables. Los movimientos generados por préstamos y pagos quedan vinculados y no se editan por separado.
- **Reportes** por período: resumen, flujo de caja, cobranza, cartera, composición, gastos por categoría, mejores clientes, rentabilidad por préstamo y exportación CSV / impresión.
- **Configuración**: siete temas suaves (Aurora, Océano, Bosque, Arena, Rosa, Medianoche y Noir), densidad, escala de texto, datos del negocio, moneda, formato regional, valores por defecto de préstamos, respaldo, restauración y datos de demostración.
- **Búsqueda global** y paleta de comandos con `Ctrl+K`.
- **Documentos**: contrato de préstamo y recibo de pago listos para imprimir o guardar como PDF.

## Requisitos

- Node.js 22.12 o superior.
- Windows, macOS o Linux.
- Electron 45 (se instala con las dependencias del proyecto).

## Ejecutar

```bash
npm install
npm start
```

Para abrir las herramientas de desarrollo:

```bash
npm start -- --dev
```

La ventana principal usa un protocolo interno `app://bundle/` y no necesita servidor web ni proceso de compilación.

## Pruebas

```bash
npm test
```

La suite valida el motor financiero: utilidades numéricas y de fechas, conversión de tasas, los cuatro sistemas de amortización, aplicación de pagos, mora, días de gracia, agregados de cartera, series mensuales y exportación CSV.

## Datos y respaldo

La base de datos se guarda en:

| Sistema | Ruta |
| --- | --- |
| Windows | `%APPDATA%\Préstamos Pro\prestamos-data.json` |
| macOS | `~/Library/Application Support/Préstamos Pro/prestamos-data.json` |
| Linux | `~/.config/Préstamos Pro/prestamos-data.json` |

Desde **Configuración → Datos** puedes:

- Guardar un respaldo JSON.
- Restaurar un respaldo.
- Abrir la carpeta de datos.
- Cargar el conjunto de datos de demostración.
- Borrar los datos y empezar de cero.
- Reiniciar la aplicación.

El archivo se escribe de forma atómica (archivo temporal + reemplazo) y la interfaz muestra el estado de guardado en la barra superior.

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl+K` | Búsqueda global / paleta de comandos |
| `Ctrl+N` | Nuevo préstamo |
| `Ctrl+Shift+N` | Nuevo cliente |
| `Ctrl+P` | Registrar pago |
| `Ctrl+1` … `Ctrl+7` | Navegar entre secciones |
| `Esc` | Cerrar modal o paleta |

## Estructura del proyecto

```
main.js              Proceso principal de Electron, protocolo app://, IPC y persistencia
preload.js           Puente seguro entre el renderer y Electron
src/
  index.html         Shell de la aplicación
  styles.css         Sistema visual, temas y estilos de todos los componentes
  app.js             Arranque, rutas, temas, barra superior y paleta de comandos
  actions.js         Formularios, modales, recibos, contratos, respaldos y exportaciones
  finance.js         Motor financiero puro y utilidades de formato
  seed.js            Datos de demostración
  lib/               Estado, navegación, iconos, UI y temas
  views/             Panel, clientes, préstamos, cobros, finanzas, reportes y configuración
tests/
  finance.test.mjs   Pruebas del motor financiero
```

`src/package.json` declara el directorio como ESM para que Node pueda importar `finance.js` en las pruebas.

## Seguridad

- `contextIsolation` activado.
- `nodeIntegration` desactivado.
- Renderer en sandbox.
- Solo el preload expone las operaciones necesarias mediante IPC.
- La navegación externa se bloquea y los enlaces HTTP(S) se abren en el navegador del sistema.
- Los datos nunca salen del equipo.

## Distribución

El proyecto se ejecuta directamente con Electron. Para generar un instalador se puede integrar `electron-builder` o `electron-forge`; la aplicación ya incluye `productName`, versión y punto de entrada en `package.json`.

Ejemplo con `electron-builder`:

```bash
npm install --save-dev electron-builder
npx electron-builder --win
```

Para otras plataformas, cambia `--win` por `--mac` o `--linux`. Antes de distribuir, revisa el nombre del producto, el icono y la configuración de firma de código.
