# Plan de Reestructuración y Refactorización: Orange App

Este documento detalla el diagnóstico del proyecto y el plan de acción para mejorar la estabilidad, limpieza y mantenibilidad del sistema Orange App.

## 1. Diagnóstico Técnico

### 1.1 Infraestructura y Repositorio
*   **Anidación Duplicada:** Existe una carpeta `Orange_App_2.4/` interna que duplica el contenido.
*   **Archivos Pesados:** Presencia de archivos `.zip` y `.pdf` rastreados por Git (deberían estar en `.gitignore`).
*   **Clutter en Raíz:** Archivos de mantenimiento (`reset_bcv.html`, `limpiar_datos.html`) mezclados con el código fuente.

### 1.2 Arquitectura de Código
*   **Inline Styles:** El diseño está fuertemente acoplado al JavaScript.
*   **Manejo de Estado:** Uso de variables globales (`window.xxx`) para comunicación entre vistas.
*   **Acoplamiento de Datos:** Las vistas manejan directamente la lógica de Firebase.

---

## 2. Lineamientos de Trabajo (Workflow del Usuario)

Para mantener la esencia y calidad del proyecto, se deben seguir estos principios en cada cambio:
*   **Estética Premium:** Mantener el diseño "WOW" con colores vibrantes, modo oscuro y bordes redondeados.
*   **Micro-animaciones:** Los cambios de estado y transiciones deben ser fluidos.
*   **Precisión Financiera:** El manejo de tasas BCV, redondeos y abonos auditables es intocable.
*   **Gestión de Unidades:** Mantener la flexibilidad de unidades de recepción (Cajas, Bultos, Kilos).
*   **Backups Rigurosos:** Realizar respaldos en ZIP y Google Drive antes de cambios mayores.

---

## 3. Fases de Ejecución

### Fase 1: Limpieza de Infraestructura
- [x] **Eliminar duplicidad:** Mover el contenido de la carpeta interna a la raíz y eliminar la carpeta vacía. (Completado en rama `reconexion`)
- [x] **Saneamiento de Git:** Untrack de archivos `.zip` y carpetas de assets, moviéndolos a `.gitignore`.
- [x] **Reorganización de Directorios:**
    *   `/docs`: Para manuales y guías.
    *   `/tools`: Para scripts de limpieza, reseteo y ejecución local.
    *   `/assets`: Para imágenes y logos. (Pendiente crear carpeta de assets de UI)

### Fase 2: Refactorización de Estilos (CSS Externo)
- [ ] **Creación de `css/components.css`**: Extraer estilos comunes de botones, tarjetas y formularios.
- [ ] **Limpieza de Vistas**: Sustituir estilos inline en los archivos `.js` por clases CSS.

### Fase 3: Capa de Servicios y Estado
- [ ] **Manejador de Estado**: Implementar un objeto `AppStore` centralizado para eliminar el uso de `window`.
- [ ] **Servicios Firebase**: Crear `js/services/firebase.js` para centralizar las llamadas a la base de datos.

---

## 4. Verificación
*   Cada fase se completará en una rama específica.
*   Se realizará una prueba de humo (Smoke Test) de todo el flujo (Login -> Compra -> Pago -> Inventario) después de cada fase.

---

## 5. Log de Cambios y Progreso

### 5.1 Rama: `reconexion` (Mayo 2026)
**Objetivo:** Restaurar el acceso a GitHub Pages y limpiar la estructura base.

*   **[COMPLETADO] Aplanamiento del Repositorio:**
    *   Se eliminó la carpeta redundante `Orange_App_2.4/`.
    *   Todo el código fuente (`index.html`, `js/`, `css/`) reside ahora exclusivamente en la raíz.
    *   Se movió `CONTEXT.md` a la raíz para mejor visibilidad.
*   **[COMPLETADO] Automatización de Despliegue (CI/CD):**
    *   Se implementó un flujo de trabajo de GitHub Actions (`.github/workflows/static.yml`) para despliegue automático de HTML estático.
    *   Este método sustituye al constructor interno de GitHub Pages, proporcionando mayor control y logs de errores.
*   **[COMPLETADO] Saneamiento Inicial:**
    *   Se eliminaron archivos de respaldo pesados (`.zip`) del historial activo de Git para reducir el tamaño del repositorio.
    *   Se sincronizó la rama `main` con estas mejoras estructurales.

---
*Última actualización: 04-Mayo-2026*
