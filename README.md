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
- **Actualizaciones**: la versión instalada comprueba si hay versiones nuevas al iniciar y cada seis horas. Desde **Configuración → Actualizaciones** puedes buscar, descargar y reiniciar para instalar sin perder tus datos.

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
| `npm run package` | Compila y genera el instalador oficial de Windows en `release/`. |
| `npm run dist` | Verifica tipos, ejecuta las pruebas y genera el instalador. |
| `npm run dist:dir` | Genera solo la carpeta desempaquetada, sin instalador. |
| `npm run release` | Compila, prueba y publica el instalador en GitHub Releases. |
| `npm run icon` | Regenera `build/icon.png` y `build/icon.ico`. |

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
updater.ts             Comprobación, descarga e instalación de actualizaciones
electron-builder.yml   Empaquetado NSIS y publicación en GitHub Releases
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
  copy-assets.mjs      Copia HTML, CSS y package.json al renderer compilado
  make-icon.mjs        Genera el icono PNG/ICO de la aplicación
build/
  icon.ico             Icono del instalador y de la ventana
  icon.png             Icono en alta resolución
dist/                  Salida de compilación (generada, no versionada)
release/               Instaladores y metadatos de actualización (generados, no versionados)
```

La interfaz está separada por responsabilidades: `app.ts` solo arranca y conecta módulos; `lib/router.ts` conserva la ruta activa; `lib/view-host.ts` decide qué vista renderizar; y cada acción de negocio vive en su archivo dentro de `src/actions/`. `src/actions.ts` mantiene las exportaciones anteriores para que las vistas no dependan de la ubicación interna de cada acción.

La compilación usa tres configuraciones:

- `tsconfig.main.json` — `main.ts`, `preload.ts` y `updater.ts` en CommonJS/Node16 hacia `dist/main`.
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

El proyecto se empaqueta con `electron-builder`. La configuración vive en `electron-builder.yml` y el icono en `build/icon.ico`.

El canal oficial de releases es público:

**https://github.com/MikanproJK/Proyecto-predeterminado/releases**

La versión 1.0.0 ya está publicada allí con el instalador, `latest.yml` y el blockmap.

### Crear el instalador

```bash
npm run dist
```

El comando verifica los tipos, ejecuta las pruebas y genera:

| Archivo | Descripción |
| --- | --- |
| `release/Prestamos-Pro-1.0.0-x64-setup.exe` | Instalador NSIS para Windows x64. |
| `release/latest.yml` | Metadatos que consulta el actualizador. |
| `release/Prestamos-Pro-1.0.0-x64-setup.exe.blockmap` | Descarga diferencial de actualizaciones. |

El instalador es por usuario (no requiere administrador), permite elegir la carpeta de instalación y crea accesos directos en el escritorio y el menú Inicio. Los datos se guardan en `%APPDATA%\Préstamos Pro` y se conservan al actualizar o desinstalar.

Para probar el empaquetado sin generar el instalador:

```bash
npm run dist:dir
```

### Actualizaciones automáticas

La aplicación usa `electron-updater` con GitHub Releases:

- Al iniciar (unos segundos después) y cada seis horas comprueba si hay una versión nueva.
- En **Configuración → Actualizaciones** puedes buscar manualmente, ver las notas de la versión, descargar y reiniciar para instalar.
- La descarga y la instalación siempre requieren tu confirmación.
- Los datos, temas y preferencias no se modifican durante la actualización.
- La búsqueda de actualizaciones solo funciona en la versión instalada; `npm start` y la carpeta `win-unpacked` muestran el aviso correspondiente.

### Publicar una versión

Requisitos:

1. El repositorio `MikanproJK/Proyecto-predeterminado` es **público**. `electron-updater` consulta `latest.yml` sin credenciales; si el repositorio fuera privado, la comprobación devolvería 404.
2. Un token de GitHub con permiso sobre el repositorio, expuesto como `GH_TOKEN`.

Pasos:

```bash
# 1. Subir la versión (crea commit y etiqueta)
npm version patch

# 2. Publicar el commit y el tag en GitHub
git push origin master --follow-tags

# 3. Configurar el token en la sesión de PowerShell
$env:GH_TOKEN = "ghp_..."

# 4. Compilar, probar y publicar
npm run release
```

Si prefieres controlar el commit manualmente:

```bash
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "Version 1.0.1"
git tag -a v1.0.1 -m "Version 1.0.1"
git push origin master --follow-tags
npm run release
```

`npm run release` crea la release en GitHub y sube el instalador, `latest.yml` y el `.blockmap`. La versión publicada debe ser mayor que la instalada (por ejemplo, `1.0.1` sobre `1.0.0`) para que la actualización aparezca. Sube siempre el tag antes de publicar: la release queda asociada a ese commit y la app lo usa como referencia de versión.

> Los instaladores sin firma de código pueden mostrar una advertencia de SmartScreen. Para distribución pública se recomienda configurar un certificado de firma en `electron-builder.yml`.

Para otras plataformas, añade los objetivos correspondientes en `electron-builder.yml` y ejecuta `electron-builder --mac` o `electron-builder --linux`.
