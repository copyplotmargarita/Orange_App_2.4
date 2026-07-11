Necesito que al acceder desde un dispositivo móvil el MODULO VENTAS sea totalmente responsivo y la vista sea fraccionada en varias vistas para completar el flujo.
1.	Primera Vista (Inicio Venta)
a.	Dropdown para seleccionar OPERACION (Venta, Presupuesto, Pedido) el valor inicial debe ser Venta
b.	Dropdown para seleccionar TIPO DE PRECIO (Detal, Mayor, Especial) el valor inicial debe ser Detal
c.	Dropdown para seleccionar ESTADO DE OPERACION (Contado, Abono, Crédito) el valor inicial debe ser Contado)
d.	Dropdown para seleccionar TIPO DE VENTA (Detal o Mayor) el valor inicial debe ser Detal
e.	Botón Siguiente
2.	Segunda vista (Productos)
a.	En el encabezado debe tener una barra de búsqueda predictiva de productos (debe ser fija, nos desplazarse)
b.	Galeria de productos, cada tarjeta debe mostrar
i.	Nombre del producto
ii.	Existencia
iii.	Precio en dólares
iv.	Precio en Bolívares
c.	Al hacer tab sobre un producto (seleccionar) en la galería debe desplegarse un input que contenga
i.	Nombre del producto seleccionado
ii.	Unidad de venta (Caja, Paquete, Unidad)
iii.	Textbox para colocar la cantidad en números
iv.	Botones de Cancelar y Aceptar (al seleccionar Aceptar debe enviar el producto al carrito)
d.	En el pie de pantalla (fijado) debe mostrar Total $, Total Bs.  y el botón de Ir a Carrito (deben ser fijos, nos desplazarse)
3.	Tercera Vista (Carrito)
a.	Lista de productos agregados al carrito, cada fila debe contener
i.	Nombre del producto
ii.	Cantidad (al hacer clic puede editarse)
iii.	Precio en dólares
iv.	Sub-total (Cantidad x Precio en dólares)
v.	En el pie de pantalla (fijado) debe mostrar Total $, Total Bs.  y el botón de Continuar (deben ser fijos, nos desplazarse)
4.	Cuarta Vista (Finalizar)
a.	Textbox para seleccionar Cliente, debe tener integrada búsqueda predictiva en Clientes, al colocar las primeras letras del nombre o los primeros números del documento de identidad debe mostrar los registros que coincidan, además debe tener la opción de Agregar Cliente que al seleccionarla debe navegar al formulario de Nuevo Cliente
b.	Dropdown para seleccionar la moneda (Bolivares, Dolares) deben ser botones de selección
c.	Al seleccionar Bolívares debe desplegar el dropdown de Método (Punto de Venta, Pago Movil, Bio Pago, Efectivo, Transferencia) deben ser botones de selección
d.	Al seleccionar Pago Movil, Transferencia debe desplegarse un textbox de Referencia (captura números)
e.	Al seleccionar Dólares debe desplegar el dropdown de Método (Efectivo, Zelle, Binance, PayPal) deben ser botones de selección
f.	Al seleccionar Zelle, Binance, PayPal debe desplegarse un textbox de Referencia (captura números)
g.	Textbox Monto, este textbox debe ser dinámico no editable, al seleccionar Moneda Bolívares debe mostrar el Total en Bs, al seleccionar Moneda Dólares debe mostrar el Total $
h.	Botón de Agregar Pago, debe mostrarse solo después de seleccionar Moneda y Método, al hacer clic crea una fila con el detalle del pago
i.	Debe aceptar múltiples pagos en múltiples monedas y ser interactivo con los montos y las operaciones
j.	En caso de existir vuelto se deben desplegar 2 textbox dinámicos que muestren el vuelto en Bolívares o en Dólares, solo uno podrá mostrar la información depende cual seleccione el usuario, el monto debe ser editable
k.	Botón de Registrar Vuelto, al seleccionarlo se crea una fila con el detalle de la operación
l.	Debe aceptar múltiples vueltos en múltiples monedas y ser interactivo con los montos y las operaciones
m.	En el pie de pantalla (fijado) debe mostrar Total $, Total Bs.  y el botón de Finalizar (deben ser fijos, nos desplazarse)


Toda la documentación de como deseo las vistas y el flujo en la carpeta C:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\RESPONSIVE
