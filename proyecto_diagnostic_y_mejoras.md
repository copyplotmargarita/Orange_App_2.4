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
- [ ] **Eliminar duplicidad:** Mover el contenido de la carpeta interna a la raíz y eliminar la carpeta vacía.
- [ ] **Saneamiento de Git:** Untrack de archivos `.zip` y carpetas de assets, moviéndolos a `.gitignore`.
- [ ] **Reorganización de Directorios:**
    *   `/docs`: Para manuales y guías.
    *   `/tools`: Para scripts de limpieza y reseteo.
    *   `/assets`: Para imágenes y logos.

### Fase 2: Refactorización de Estilos (CSS Externo)
- [ ] **Creación de `css/components.css`**: Extraer estilos comunes de botones, tarjetas y formularios.
- [ ] **Limpieza de Vistas**: Sustituir estilos inline en los archivos `.js` por clases CSS.

### Fase 3: Capa de Servicios y Estado
- [ ] **Manejador de Estado**: Implementar un objeto `AppStore` centralizado para eliminar el uso de `window`.
- [ ] **Servicios Firebase**: Crear `js/services/firebase.js` para centralizar las llamadas a la base de datos.

---

## 5. Registro de Mejoras Recientes (04/05/2026)

### 5.1 Módulo de Ventas y Presupuestos
*   **Ciclo de Vida de Presupuestos:** Implementación del flujo `PRESUPUESTO -> FACTURADO`. Los presupuestos ahora se pueden convertir en ventas reales con un clic, marcando el documento original como procesado para evitar duplicidad.
*   **Gestión de Documentos (PDF/Web):** Creación de un visualizador de documentos profesional. Genera tanto **Facturas de Venta** como **Presupuestos**, con diseño optimizado para compartir vía WhatsApp o imprimir.
*   **Integridad de Datos:**
    *   Sincronización automática de inventario post-venta (reload reactivo).
    *   Corrección de errores de duplicidad de registros.
    *   Validación de stock negativo con alertas visuales dinámicas.
*   **Refinamiento UI/UX:**
    *   Simetría y estandarización de botones de acción en el historial.
    *   Filtros inteligentes en "Ventas del Día" (Todos / Solo Ventas / Solo Presupuestos).
    *   Reinicio automático de configuración (Venta/Detal) tras cada operación.
    *   Bloqueo visual de secciones de pago en modo presupuesto.

### 5.2 Estabilidad Técnica
*   Importación de servicios faltantes (`updateDoc`) y optimización de transacciones Firestore.
*   Limpieza de logs de error en consola y manejo de excepciones en el flujo de caja.

---

## 6. Próximos Pasos (Sugeridos para Dasaev)
1.  **Migración CSS**: Los estilos inyectados hoy en el visualizador de documentos podrían moverse a un archivo `css/printing.css`.
2.  **Reportes Mensuales**: Evaluar la integración de los nuevos estados de presupuesto en el panel de estadísticas general.
