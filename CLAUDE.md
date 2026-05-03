# Orange App — Dev

## Project Overview

**Orange App** is a web-based business management SPA (Single Page Application) built for Venezuelan small businesses. It manages sales, inventory, purchases, clients, suppliers, employees, and stores, with dual-currency support (USD / Bolívares via BCV exchange rate).

- **Version in dev:** 2.4 (folder: `Orange_App_2.4/`)
- **Language:** Español (UI and code comments)
- **Stack:** Vanilla JS (ES Modules) + Firebase

## Architecture

```
Orange_App_2.4/
├── index.html          # Single entry point, loads app.js as module
├── css/style.css       # All styles, dark/light theme via data-theme attr
├── js/
│   ├── app.js          # Router — hash-based SPA (#login, #dashboard, etc.)
│   ├── utils.js        # Shared helpers: showNotification, toTitleCase, holiday utils
│   ├── services/
│   │   └── firebase.js # Firebase init — exports auth, db, firebaseConfig
│   └── views/          # One file per route/feature
│       ├── login.js
│       ├── register.js
│       ├── config.js
│       ├── dashboard.js    # Main shell with sidebar nav + all sub-views
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
├── limpiar_datos.html  # Admin utility: wipe employees/shifts (danger tool)
├── reset_bcv.html      # Admin utility: reset BCV rate
└── run_dev.ps1         # PowerShell HTTP server on port 8088 (Windows)
```

## Tech Stack

- **Frontend:** Vanilla JS (ES Modules, no bundler/build step)
- **Backend/DB:** Firebase 10.10.0 — Firestore + Firebase Auth
- **Maps:** Leaflet 1.9.4
- **Phone input:** intl-tel-input 17.0.8
- **Fonts:** Google Fonts — Inter

## Routing

Hash-based SPA router in `app.js`. Routes map directly to render functions:
- `#login` → `renderLogin()`
- `#dashboard` → `renderDashboard()` (contains nested navigation for all business modules)
- Sub-views like stores, employees, reports are rendered inside `renderDashboard()`

## Firebase / Data Model

- Firebase project: `app-ventas-db`
- Top-level collection: `businesses/{businessId}/...`
- Auth: Firebase Auth (email/password)
- User role stored in `localStorage` as `userRole` (`admin` / `employee`)
- Business context stored in `localStorage`: `businessId`, `storeId`, `storeName`

## BCV Rate (Exchange Rate)

- Scraped/fetched daily and stored in `businesses/{businessId}/bcv_history/{date}`
- Cached in `localStorage` as `bcvRate` + `bcvDate`
- Critical for all price calculations (products stored in USD, displayed in Bs.)

## Local Development

Run a local HTTP server (required for ES modules):

```powershell
# Windows PowerShell
.\run_dev.ps1        # serves on http://localhost:8088
```

On macOS/Linux use Python or any static server:
```bash
python3 -m http.server 8088
# or
npx serve .
```

## Key Patterns

- Views are pure JS functions that create and return DOM elements (no framework)
- All DOM manipulation is imperative (`document.createElement`, `innerHTML`)
- State is local to each view function's closure
- `sessionStorage` is used to preserve cart state when navigating away mid-sale
- Notifications via `showNotification(msg, type)` from `utils.js`
- Theme toggle: `localStorage.getItem('theme')` → sets `data-theme` on `<html>`

## Conventions

- All user-facing text is in **Spanish**
- Number formatting: `de-DE` locale (comma as decimal separator) for amounts
- Date formatting: ISO strings split at `T` for Firestore keys
- File-level imports use CDN URLs for Firebase SDK (no npm)
