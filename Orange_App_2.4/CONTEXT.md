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
