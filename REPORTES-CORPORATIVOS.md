# Guía de Desarrollo: Reportes Corporativos

Esta es la guía para desarrollar un nuevo módulo llamado **REPORTES CORPORATIVOS**.

## 1. Cierre de Caja Diario (Por Tienda y por Empleado)
- **1.1** Total vendido por método de pago (revisa `### Métodos de Pago Soportados` en el archivo `CONTEXT.md`).
- **1.2** Número de transacciones.
- **1.3** Ticket o venta promedio.
- **1.4** Productos vendidos con cantidad y monto.
- **1.5** Nombre del vendedor responsable del turno.

## 2. Registro de cada Venta
- **2.1** Fecha y hora exacta.
- **2.2** Empleado que realizó la venta.
- **2.3** Cliente.
- **2.4** Productos vendidos + Cantidad + Precio Unitario + Precio Total.
- **2.5** Método de pago.

## 3. Reportes Semestrales
- **3.1** Comparativo de ventas por tienda.
- **3.2** Días de la semana con mayor y menor venta.
- **3.3** Empleado con más ventas acumuladas.
- **3.4** Productos más y menos vendidos.

## 4. Reportes Mensuales
### 4.1 Ranking de Productos
- **4.1.1** Top 10 productos más vendidos por unidades.
- **4.1.2** Top 10 productos más vendidos por monto generado.
- **4.1.3** Productos con cero o baja rotación.

### 4.2 Ranking de Clientes
- **4.2.1** Top 10 clientes por frecuencia de compra.
- **4.2.2** Top 10 clientes por monto total gastado.
- **4.2.3** Clientes nuevos vs clientes recurrentes.

### 4.3 Ranking de Empleados
- **4.3.1** Ventas totales por empleado (unidades & monto).
- **4.3.2** Ticket o factura promedio por empleado.
- **4.3.3** Días trabajados vs ventas generadas.

### 4.4 Rendimiento por Tienda
- **4.4.1** Tienda o Sucursal con más volumen de venta.
- **4.4.2** Tienda con mayor ticket o factura promedio.
- **4.4.3** Comparativo mes a mes.

### 4.5 Calendario de Ventas
- **4.5.1** Mapa de calor del mes, qué días se vende más.
- **4.5.2** Horas pico del día.

## 5. Reportes de Producción / Inventario
- **5.1** Productos e Insumos que se agotan más rápido.
- **5.2** Alerta cuando un producto llegue a stock mínimo.
- **5.3** Proyección de cuánto producir el próximo mes basado en el historial de ventas.
- **5.4** Costo vs precio de venta vs porcentaje de ganancia real obtenida.
