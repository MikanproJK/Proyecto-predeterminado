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
- **Monedas reales**: cada moneda usa su propio símbolo y cantidad de decimales. USD (`US$`) y CLP (`$`, sin decimales) están priorizados; también se admiten EUR, MXN, COP, ARS, PEN, UYU, BOB, PYG, BRL, DOP, GTQ, HNL, NIO, CRC, PAB, VES, CAD, GBP, AUD, CHF, JPY, CNY, INR, RUB y ZAR. La moneda es global para toda la aplicación y los importes guardados no se convierten al cambiarla.
- **Búsqueda global** y paleta de comandos con `Ctrl+K`.
- **Documentos**: contrato de préstamo y recibo de pago listos para imprimir o guardar como PDF.

## Requisitos

- Node.js 22.12 o superior.
- Windows, macOS o Linux.
- Electron 45 y TypeScript 7 (se instalan con las dependencias del proyecto).

## Ejecutar

```bash
npm install
npm start
```

`npm start` compila el proyecto (`npm run build`) y abre la aplicación. El código fuente está en TypeScript y se emite a `dist/`:

- `dist/main/` — proceso principal y preload (CommonJS).
- `dist/renderer/` — interfaz, módulos ESM y recursos estáticos.

La ventana principal usa un protocolo interno `app://bundle/` y no necesita servidor web ni bundler.

### Comandos

| Comando | Descripción |
| --- | --- |
| `npm start` | Compila y abre la aplicación. |
| `npm run dev` | Compila y abre con las herramientas de desarrollo. |
| `npm run build` | Limpia `dist/`, compila main/renderer y copia los recursos. |
| `npm run typecheck` | Verifica los tipos de main, renderer y pruebas sin emitir archivos. |
| `npm test` | Ejecuta la suite del motor financiero con `tsx`. |

Para abrir las herramientas de desarrollo:

```bash
npm run dev
```

## Pruebas

```bash
npm test
```

La suite (`tests/finance.test.ts`) valida el motor financiero: utilidades numéricas y de fechas, conversión de tasas, los cuatro sistemas de amortización, aplicación de pagos, mora, días de gracia, agregados de cartera, series mensuales y exportación CSV. Se ejecuta directamente sobre el TypeScript con `tsx`.

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
main.ts                Proceso principal de Electron, protocolo app://, IPC y persistencia
preload.ts             Puente seguro entre el renderer y Electron
src/
  index.html           Shell de la aplicación
  styles.css           Sistema visual, temas y estilos de todos los componentes
  types.ts             Tipos de dominio, IPC y contratos compartidos
  app.ts               Arranque de la aplicación y conexión entre módulos
  actions.ts           Punto de entrada que reexporta las acciones por dominio
  actions/
    shared.ts          Utilidades comunes de formularios y selectores
    clients.ts         Alta, edición y eliminación de clientes
    loans.ts           Formularios, cancelación y reactivación de préstamos
    payments.ts        Registro, edición y eliminación de cobros
    documents.ts       Recibos, contratos e impresión
    finance.ts         Movimientos, transferencias y cuentas
    settings.ts        Ajustes, respaldo, restauración y exportación CSV
    welcome.ts         Bienvenida y carga inicial de datos
  finance.ts           Motor financiero puro (clase LoanCalculator) y utilidades de formato
  seed.ts              Datos de demostración
  lib/
    routes.ts          Rutas, metadatos y grupos de navegación
    router.ts          Ruta activa y lectura del hash
    appearance.ts      Tema, densidad y escala de texto
    sidebar.ts         Barra lateral, resumen de cuentas e indicador de guardado
    theme-menu.ts      Selector de temas
    palette.ts         Búsqueda global y acciones rápidas
    shortcuts.ts       Atajos de teclado
    view-host.ts       Registro de vistas y renderizado de la sección activa
    app-info.ts        Información de versión expuesta por Electron
    store.ts           Estado, persistencia (StoreRepository, SaveQueue) y reglas de negocio
    nav.ts             Navegación por hash
    icons.ts           Iconografía SVG
    ui.ts              Componentes de interfaz reutilizables
    themes.ts          Definición de los siete temas
    currencies.ts      Registro de monedas, símbolos y decimales
  views/               Panel, clientes, préstamos, cobros, finanzas, reportes y configuración
tests/
  finance.test.ts      Pruebas del motor financiero
scripts/
  clean.mjs            Limpia dist/
  copy-assets.mjs      Copia HTML, CSS e imágenes al renderer compilado
dist/                  Salida de compilación (generada, no versionada)
```

La interfaz está separada por responsabilidades: `app.ts` solo arranca y conecta módulos; `lib/router.ts` conserva la ruta activa; `lib/view-host.ts` decide qué vista renderizar; y cada acción de negocio vive en su archivo dentro de `src/actions/`. `src/actions.ts` mantiene las exportaciones anteriores para que las vistas no dependan de la ubicación interna de cada acción.

La compilación usa tres configuraciones:

- `tsconfig.main.json` — `main.ts` y `preload.ts` en CommonJS/Node16 hacia `dist/main`.
- `tsconfig.renderer.json` — `src/**/*.ts` en ESM hacia `dist/renderer`.
- `tsconfig.test.json` — verificación de tipos de las pruebas.

`src/package.json` declara el directorio del renderer como ESM para que los módulos compilados se resuelvan correctamente. Los recursos estáticos (`index.html`, `styles.css`, imágenes y `src/package.json`) se copian con `scripts/copy-assets.mjs`.

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
