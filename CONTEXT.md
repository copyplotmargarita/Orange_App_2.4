# Orange App 2.4 — Contexto del Proyecto

> Este archivo es la fuente de verdad para cualquier IA o desarrollador que trabaje en este proyecto.
> Léelo completo antes de hacer cualquier cambio. Mantenlo actualizado.

---

## ¿Qué es Orange App?

Aplicación web de gestión empresarial (SPA) para pequeñas empresas venezolanas. Maneja:

- Ventas con carrito
- Inventario y productos
- Compras a proveedores
- Clientes y proveedores
- Cuentas por Cobrar
- Conciliación
- Empleados y turnos
- Tiendas (multi-sucursal)
- Reportes
- Tasa BCV (dólar / bolívares) actualizada diariamente

**Versión activa:** 2.4  
**Idioma de la UI y comentarios:** Español  

---

## Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend | Vanilla JS con ES Modules (sin bundler, sin framework) |
| Base de datos | Firebase Firestore |
| Autenticación | Firebase Auth (email/password) |
| Estilos | CSS puro (`style.css`), temas claro/oscuro |
| Mapas | Leaflet 1.9.4 |
| Teléfonos | intl-tel-input 17.0.8 |
| Fuentes | Google Fonts — Inter |
| Firebase SDK | v10.10.0 via CDN (sin npm) |

---

## Estructura de Archivos

```
Orange_App_2.4/
├── index.html              # Único punto de entrada
├── CONTEXT.md              # Este archivo
├── css/
│   └── style.css           # Todos los estilos, temas via data-theme
├── js/
│   ├── app.js              # Router hash-based (#login, #dashboard, etc.)
│   ├── utils.js            # Helpers compartidos
│   ├── services/
│   │   └── firebase.js     # Inicialización Firebase — exporta auth, db
│   └── views/              # Un archivo por módulo/ruta
│       ├── login.js
│       ├── register.js
│       ├── config.js
│       ├── dashboard.js    # Shell principal con sidebar y sub-vistas
│       ├── sales.js
│       ├── purchases.js
│       ├── products.js
│       ├── inventory.js
│       ├── clients.js
│       ├── suppliers.js
│       ├── employees.js
│       ├── stores.js
│       ├── storeReceive.js
│       ├── reports.js
│       ├── receivables.js  # Cuentas por cobrar
│       └── maintenance.js
├── limpiar_datos.html      # Herramienta admin: borrar empleados/turnos
├── reset_bcv.html          # Herramienta admin: resetear tasa BCV
└── run_dev.ps1             # Servidor local Windows — puerto 8088
```

---

## Arquitectura y Patrones

### Routing
- Router hash-based en `app.js`
- Cada ruta llama a una función `render*()`
- Sub-vistas se renderizan dentro de `renderDashboard()`

### Vistas
- Cada vista es una función JS pura que crea y retorna nodos DOM
- Sin frameworks — todo con `document.createElement` e `innerHTML`
- El estado vive en el closure de cada función de vista

### Firebase / Modelo de datos
- Proyecto Firebase: `app-ventas-db`
- Colección raíz: `businesses/{businessId}/...`
- Rol del usuario en `localStorage` como `userRole` (`admin` / `employee`)
- Contexto de negocio en `localStorage`: `businessId`, `storeId`, `storeName`

### Tasa BCV
- Se obtiene diariamente y se guarda en `businesses/{businessId}/bcv_history/{fecha}`
- Cache en `localStorage`: `bcvRate` + `bcvDate`
- Los precios se almacenan en USD y se muestran en Bs.

### Storage del navegador
- `localStorage`: tema, rol, sesión de negocio, tasa BCV
- `sessionStorage`: estado del carrito de ventas (se preserva al navegar)

---

## Convenciones de Código

- Todo texto visible al usuario va en **español**
- Formato de números: locale `de-DE` (coma como separador decimal) — ej: `1.234,56`
- Formato de fechas: strings ISO divididos en `T` para claves de Firestore
- Imports de Firebase usan URLs de CDN, no npm
- Notificaciones siempre via `showNotification(msg, type)` de `utils.js`
- Tema: `localStorage.getItem('theme')` → aplica `data-theme` en `<html>`

### Tarjeta Tipo
- **Borde de color a la izquierda:** Opcional (se usa para identificar módulos específicos). Borde de `4px` sólido con el color representativo del módulo (ejemplo: `var(--primary)` en Clientes).
- **Texto principal:** Etiqueta `<h3>`. Tamaño de fuente: `1rem` a `1.1rem`. Color coincidente con el borde izquierdo (ejemplo: `var(--primary)`). Debe incluir propiedades de truncado (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`) para mantenerse en una sola línea.
- **Textos secundarios:** Etiquetas `<p>`. Tamaño de fuente: `0.85rem` (o clases `text-sm` / `text-xs`). Color: `var(--text-muted)` (gris suave). Se debe usar un emoji representativo al inicio (ejemplos: 📞 para teléfono, 📍 para dirección, 💼 para cargo, 🏷️ para estado). También deben usar truncado de texto si la información es muy larga.
- **Tamaños:** Alto automático (`auto`), adaptado al contenido con `padding: 1rem`. Largo (Ancho) dinámico determinado por el Grid.
- **Grid:** Contenedor con `display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem;`.

### Métodos de Pago Soportados

| Método | Moneda | Solicitar Nro. de Referencia |
|---|---|---|
| Bs. Efectivo | Bolívares | No |
| Pago Móvil | Bolívares | Sí |
| Punto de Venta | Bolívares | No |
| BioPago | Bolívares | No |
| Transferencia | Bolívares | Sí |
| Binance | Dólares | Sí |
| Dólares en Efectivo | Dólares | No |
| Paypal | Dólares | Sí |
| Zelle | Dólares | Sí |

#### Reglas de Interfaz para Pagos:
- Si **Moneda = Bolívares**, se debe mostrar el campo **Monto Bs ***.
- Si **Moneda = Dólares**, se debe mostrar el campo **Monto $ ***.
- Si **Solicitar Nro. de Referencia = Sí**, se debe mostrar el campo **Número de Referencia ***.

#### ⌨️ Regla de Formateo de Montos en Entradas (Inputs)
Para garantizar la uniformidad y evitar errores humanos al ingresar dinero en cualquier módulo de cobro o pago:
- **Formato Visual Obligatorio:** Todo monto ingresado debe mostrarse con separador de miles por punto `.` y separador de decimales por coma `,` (Ejemplo: `1.015,36`).
- **Comportamiento en Tiempo Real (Estilo ATM/Cajero):** El usuario solo debe teclear los números de corrido. El sistema debe ir empujando los dígitos de derecha a izquierda, colocando automáticamente la coma para los últimos dos dígitos (centavos) y los puntos para los miles en tiempo real.
- **Procesamiento de Datos:** Antes de realizar cálculos matemáticos o guardar el dato en la base de datos, el sistema debe limpiar la máscara visual (remover puntos y cambiar la coma por un punto decimal estándar de programación) para manejarlo como un número flotante válido (Ejemplo: `1015.36`).

### Encabezado de Vista

- **Regla General:** Absolutamente todas las vistas del sistema (tanto las principales de cada módulo como las sub-vistas de detalle o formularios) deben incluir obligatoriamente un botón de retorno en su cabecera.
- **Comportamiento del Botón Volver:**
  - En **sub-vistas** (ej. detalle de proveedor, carga de pago): El botón debe regresar a la lista o vista inmediatamente anterior del módulo.
  - En **vistas principales** (ej. listado general de Cuentas por Pagar): El botón debe regresar al Dashboard principal o al menú central de la aplicación.
    - **Nota Técnica de Enrutamiento:** Dado que el sistema no cambia el hash de la URL al navegar entre módulos dentro del Dashboard (se mantiene en `#dashboard`), cambiar el hash por código no surtirá efecto si ya estás en él. La forma correcta y segura de regresar al inicio es simulando un clic en el logo de la barra lateral (ID `navHome`):
      ```javascript
      document.getElementById('navHome')?.click();
      ```
    - **Despliegue de Barra Lateral (Automático):** Al regresar al Dashboard desde una vista principal, se debe verificar si la barra lateral está contraída (esto se sabe si el texto del elemento `toggleIcon` es `▶`). Si está cerrada, se debe simular un clic en `sidebarToggle` para desplegarla automáticamente y facilitar la navegación:
      ```javascript
      const toggleIcon = document.getElementById('toggleIcon');
      if (toggleIcon && toggleIcon.innerText === '▶') {
          document.getElementById('sidebarToggle')?.click();
      }
      ```
- **Configuración de Estilos y Medidas del Encabezado:**
  - **Contenedor cabecera:** Etiqueta `div` con `display: flex`, alineación vertical centrada (`align-items: center`), separación (`gap`) de `1rem` (16px) y un margen inferior de `1.5rem`. Debe incluir la clase `flex-stack-mobile`.
  - **Botón de Retorno:** Clase `btn btn-outline`. 
    - **Medidas:** Alto fijo de `38px` y ancho automático (`width: auto`).
    - **Fuentes y Relleno:** Tamaño de fuente de `0.85rem` y relleno (`padding`) de `0.5rem 1rem`.
    - **Texto estándar:** `← Volver`.
  - **Título de la Vista:** Etiqueta `<h2>`.
    - **Medidas:** Tamaño de fuente de `1.5rem` (aproximadamente `24px`), peso de fuente `800` (negrita intensa).
    - **Color:** Debe usar el color representativo del tema del módulo (ejemplo: `var(--primary)` o `var(--danger)`). Se ubica al lado derecho del botón de retorno.
    - **Emoji / Icono (En vistas principales):** El título debe incluir obligatoriamente el mismo emoji que se muestra en la barra lateral del Dashboard (ejemplo: `👥` para Clientes, `🏭` para Proveedores) para mantener la relación visual. Debe ir al inicio del texto del título.
  - **Botón de Acción Principal (+ Crear [Algo]) (Si aplica o es necesario):**
    - **Uso:** En las vistas principales que requieran la creación de un nuevo registro.
    - **Clase Base:** `btn btn-primary`.
    - **Medidas:** Ancho fijo de `180px` y alto fijo de `42px`.
    - **Estilos:** `font-weight: 700`, `border-radius: 12px`, `display: inline-flex`, `align-items: center`, `justify-content: center`.
    - **Ubicación:** `margin-left: auto` para empujarlo al extremo derecho del contenedor flex.

### Modelo Base Para Formulario

**1. Estructura y Contenedor del Formulario:**
- **Ancho máximo:** `max-width: 500px`.
- **Alineación:** Centrado horizontalmente en la pantalla (`margin: 0 auto`).
- **Diseño visual:** Usa la clase `card` con un relleno interno (`padding`) de `2rem` (32px).
- **Borde superior distintivo:** `border-top: 4px solid var(--color-modulo);` (el color varía según el módulo).
- **Disposición interna:** Los campos se apilan verticalmente mediante un contenedor con `display: flex; flex-direction: column; gap: 0.35rem;`.

**2. Separaciones (Gaps):**
- **Entre Label (Etiqueta) y Textbox (Input):** `margin-bottom: 2px !important;`.
- **Entre el final de un campo y el inicio del siguiente:** Determinado por el `gap: 0.35rem;` del contenedor.
- **Regla de Oro:** Queda estrictamente prohibido aplicar márgenes individuales (`margin-top` o `margin-bottom`) a los contenedores de los campos (`.form-group`). Toda separación vertical debe depender exclusivamente del `gap` del contenedor flex.

**3. Textbox (Inputs) y Dropdowns (Selects):**
- **Dimensiones:** Alto fijo de `40px` y ancho del `100%` del espacio disponible.
- **Estilos visuales:**
  - Borde redondeado: `border-radius: 10px;`.
  - Borde estándar: `border: 1px solid var(--border);`.
  - Fondo: `background: var(--surface);`.
  - Color de texto: `color: var(--text-main);`.
  - Relleno lateral: `padding: 0 1rem;`.
- **Fuentes:** Tamaño de `0.9rem` y familia `'Inter', sans-serif`.
- **Efecto Focus:** `border-color: var(--primary); box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);`.

**4. Configuraciones Especiales de Dropdowns:**
- **Documento (Cédula o RIF):**
  - Grupo combinado en una sola línea con `display: flex; gap: 0;`.
  - **Select:** Ancho de `80px`, sin borde derecho (`border-right: none`) y redondeado solo a la izquierda (`border-radius: var(--radius-md) 0 0 var(--radius-md);`).
  - **Input:** Redondeado solo a la derecha (`border-radius: 0 var(--radius-md) var(--radius-md) 0;`).

**5. Textos y Etiquetas (Labels):**
- **Labels:** En mayúsculas (`text-transform: uppercase`), tamaño `0.75rem`, peso `800` (negrita), color `var(--text-muted)` y espaciado de letras de `0.5px`.
- **Títulos principales del formulario:** Tamaño `1.75rem`, peso `800` y espaciado de letras comprimido (`letter-spacing: -0.5px`).

**6. Botones de Acción (Cancelar y Aceptar):**
- **Contenedor:** `display: flex; gap: 1rem; margin-top: 2rem;`.
- **Botón Cancelar:** Clase `btn btn-outline`. Alto de `50px`, peso `700` y `flex: 1`.
- **Botón Aceptar:** Clase `btn btn-primary`. Alto de `50px`, peso `700` y `flex: 1`.

**7. Formularios Complejos (Múltiples Secciones):**
- Si un formulario requiere dividirse por temas (ej. Identidad, Unidades, Costos), **cada sección debe ser una tarjeta (`.card`) independiente** y colocarse como elementos hermanos en el HTML.
- **PROHIBIDO:** Anidar una tarjeta dentro de otra. Cada tarjeta debe cerrarse al 100% antes de abrir la siguiente.
- El contenedor que agrupa a todas las tarjetas del formulario debe apilarlas usando `display: flex; flex-direction: column; gap: 1.5rem;` para que la separación entre bloques sea limpia y constante.

### Sub-Vista: Ficha

Esta sub-vista de detalle debe seguir un diseño ultra-compacto y altamente estilizado para mostrar la información principal de la entidad y sus accesos directos.

**1. Estructura y Contenedor Principal:**
- **Ancho máximo:** `max-width: 500px`.
- **Alineación:** Centrado horizontalmente en la pantalla (`margin: 0 auto`).
- **Diseño de Secciones:** Cada bloque de información debe usar la clase `card` con un relleno interno (`padding`) de `1.5rem`.
- **Borde Decorativo Uniforme (Obligatorio):** Absolutamente cada tarjeta/sección de esta vista debe incluir un borde superior de acento de **`4px solid`** con el color propio del módulo (ejemplos: `var(--primary)` para Clientes, `var(--warning)` para Proveedores). Este borde debe ir al inicio (en la parte superior) de cada tarjeta para mantener la uniformidad visual en toda la ficha y debe coincidir con el color usado en la vista de lista del módulo.

**2. Cabecera de la Sub-Vista:**
- Sigue la regla general de **Encabezado de Vista** con el botón `← Volver` (38px de alto, width auto) y el título `Ficha de [Módulo]` (ejemplo: `Ficha de Cliente`).

**3. Bloque de Identificación y Acciones Rápidas (Compacto):**
- **Disposición:** Elementos en columna centrados (`display: flex; flex-direction: column; align-items: center; text-align: center;`).
- **Nombre / Título Principal:** Etiqueta `<h3>` con `font-size: 1.3rem`, `font-weight: 800` y el color propio del módulo. Margen inferior mínimo (`0.1rem`).
- **ID / Código:** Fuente monoespaciada, `font-size: 0.8rem` y color del módulo. Margen inferior de `1rem`.
- **Fila de Botones de Acción (Estilizados):**
  - Contenedor con `display: flex; justify-content: center; gap: 0.75rem;`.
  - Botones circulares perfectos: `height: 38px; width: 38px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center;`.
  - Estilo visual uniforme: Clase `btn btn-outline`. Fondo transparente (`background: transparent`), borde y texto del color del módulo.
  - Contenido: Únicamente el emoji representativo (📞, 💬, 📧, 📍) centrado.

**4. Sección de Datos (Formulario Compacto):**
- **Disposición:** Los campos del formulario se apilan verticalmente mediante un contenedor con `display: flex; flex-direction: column; gap: 0.25rem;` (espaciado reducido al mínimo para máxima compresión visual).
- **Textbox (Inputs):**
  - Todos los campos de texto deben ser etiquetas `<input>` estándar con un alto fijo de `40px` para garantizar uniformidad geométrica.
  - No se deben usar etiquetas `<textarea>` para evitar que rompan la altura de la cuadrícula y cambien la fuente por defecto.
  - Tipografía: `font-size: 0.85rem` y regla explícita `font-family: inherit` en todos los inputs para garantizar la misma fuente sans-serif en todo el formulario.

---

## Buenas Prácticas

### Al escribir código
- No usar frameworks ni librerías nuevas sin discutirlo primero
- No introducir npm ni bundlers — el proyecto corre sin build step
- Mantener cada vista en su propio archivo en `views/`
- No duplicar lógica — si algo se usa en 2+ vistas, va a `utils.js`
- Comentarios en español

### Al trabajar con Firebase
- Nunca hardcodear `businessId` — siempre leer de `localStorage`
- Siempre verificar que el usuario esté autenticado antes de queries
- Usar transacciones Firestore cuando se modifiquen múltiples documentos juntos

### Al modificar estilos
- Todos los estilos van en `style.css` — no estilos inline salvo casos dinámicos
- Respetar las variables CSS de tema claro/oscuro
- Probar siempre en ambos temas

---

## Flujo de Trabajo Git

### Ramas
```
main                        ← producción, código estable
├── feature/dasaev-*        ← ramas de Dasaev
└── feature/dax-*           ← ramas de Dax
```

### Flujo diario
```bash
# Antes de empezar
git checkout main
git pull origin main
git checkout feature/mi-rama
git merge main

# Mientras trabajas
git add -A
git commit -m "módulo: descripción breve"
git push

# Al terminar una funcionalidad
git checkout main
git merge feature/mi-rama
git push origin main
```

### Formato de commits
```
ventas: agrego filtro por fecha
inventario: corrijo cálculo de stock
dashboard: mejoro layout sidebar móvil
```

### Reglas
- Nunca commitear directamente a `main`
- Siempre hacer `pull` antes de empezar a trabajar
- Commits pequeños y frecuentes
- Avisar al otro dev antes de mergear a `dev`

---

## Equipo

| Dev | Herramienta IA | Ramas |
|---|---|---|
| Dasaev | Claude (Claude Code) | `feature/dasaev-*` |
| Dax | Antigravity (Gemini) | `feature/dax-*` |

---

## Cómo correr localmente

**Windows (Dax):**
```powershell
.\run_dev.ps1
# Abre http://localhost:8088
```

**macOS (Dasaev):**
```bash
python3 -m http.server 8088
# Abre http://localhost:8088
```

---

## Herramientas Admin (usar con cuidado)

| Archivo | Función |
|---|---|
| `limpiar_datos.html` | Borra empleados y turnos — irreversible |
| `reset_bcv.html` | Resetea la tasa BCV almacenada |
