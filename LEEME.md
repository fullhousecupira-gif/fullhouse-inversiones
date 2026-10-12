# 🏢 FullHouse Inversiones C.A - Sistema de Control de Inventario y Punto de Venta (POS)

Sistema completo de gestión comercial y control de existencias para PC con **almacenamiento 100% local**, cálculo dual en **Dólares ($ USD)** y **Bolívares (Bs.)**, y sincronización automática de la tasa oficial del **Banco Central de Venezuela (BCV)**.

---

## 🚀 ¿Cómo iniciar la aplicación?

Tiene tres formas súper sencillas de abrir el sistema:

1. **Doble clic en `Iniciar_FullHouse.vbs` (Recomendado)**:
   - Abre la aplicación directamente en modo ventana de escritorio sin mostrar ventanas negras de consola.
2. **Doble clic en `Iniciar_FullHouse.bat`**:
   - Inicia la aplicación en modo ventana independiente en Microsoft Edge / Chrome.
3. **Doble clic en `index.html`**:
   - Abre el sistema directamente en su navegador web favorito.
4. *(Opcional)* **Doble clic en `Iniciar_Servidor_Red.bat`**:
   - Inicia un mini-servidor local para acceder a la aplicación desde otras computadoras o teléfonos conectados a su red Wi-Fi en `http://localhost:8080`.

---

## 🔐 Control de Acceso y Roles (Inicio de Sesión y Supabase en la Nube)

El sistema cuenta con un control de inicio de sesión con roles diferenciados e integración opcional en la nube con **Supabase (100% Gratuito)**:

1. **👑 Administrador**:
   - **Acceso Total**: Visualización de Métricas & Totales, Gestión de Inventario & Precios, Categorías, Entradas y Salidas de Stock, Historial de Ventas, Gestión de Vendedores/Usuarios y Respaldos & Configuración.
   - Posibilidad de crear nuevos vendedores y administradores, fijar claves de acceso y **bloquear o desbloquear usuarios en tiempo real** con un solo clic (`🔒 Bloquear` / `🔓 Desbloquear`).
   - Modificación y configuración de credenciales de Supabase en la nube.
   - *Usuario por defecto*: `admin` | *Contraseña*: `123`

2. **🛒 Vendedor**:
   - **Acceso Restringido**: Únicamente puede utilizar el área de **Punto de Venta (POS)** para registrar ventas y cobrar.
   - Todas las demás pestañas (métricas, inventario, entradas/salidas, ventas, usuarios, respaldos) quedan completamente ocultas y bloqueadas.
   - Al iniciar sesión, el campo **"Vendedor Responsable"** en el Punto de Venta se **selecciona automáticamente con su nombre y queda bloqueado**, garantizando que cada venta quede atribuida obligatoriamente al vendedor que tiene la sesión abierta.
   - Si el administrador bloquea a un vendedor desde su teléfono o PC, la sesión del vendedor se cierra de inmediato en tiempo real y no podrá ingresar.
   - *Usuarios de prueba por defecto*:
     - Carlos Mendoza: usuario `carlos` | *Contraseña*: `123`
     - Mariana Silva: usuario `mariana` | *Contraseña*: `123`

3. **☁️ Sincronización en la Nube con Supabase**:
   - Permite que el Administrador gestione vendedores desde cualquier dispositivo (teléfono, tablet, laptop) y los cambios se reflejen inmediatamente en la caja.
   - **Resiliencia Offline**: Si se va el internet en el local, el sistema continúa funcionando perfectamente gracias a la caché local segura en IndexedDB.

4. **🚪 Cierre de Sesión**:
   - En la esquina superior derecha del encabezado se muestra el usuario conectado, su rol y el botón **"🚪 Salir"** para cerrar la sesión actual y regresar a la pantalla de ingreso.

---

## 📋 Módulos y Funcionalidades Incluidas

### 1. 🛒 Punto de Venta (POS / Caja Rápida)
- Búsqueda instantánea de productos por nombre o código de barras.
- Filtros rápidos por categorías.
- Carrito interactivo con control de existencias en tiempo real (evita vender más de lo que hay en inventario).
- Selector obligatorio de **Vendedor responsable** por cada venta.
- Registro de método de pago: *Dólares Efectivo, Pago Móvil, Punto de Venta Bs., Zelle, Efectivo Bs., Transferencia, Mixto y **Abono / A Crédito***.
- **Ventas con Abono / A Crédito**:
  - Permite ingresar el monto que el cliente abona al momento (en $ o Bs.).
  - Calcula en tiempo real: **Total a Pagar**, **Monto Abonado** y **Falta por Pagar (Saldo Pendiente)**.
  - Guarda la **fecha y hora exacta de venta**, cliente y teléfono de contacto.
  - En el historial de ventas permite pulsar **"➕ Abonar"** para registrar nuevos pagos parciales hasta saldar la cuenta por completo.
- **Descuento automático de stock**: al procesar la venta, se rebajan las unidades exactas de cada artículo vendido y se genera un movimiento de salida.
- Emisión inmediata de **Ticket de Venta digital e imprimible** con el desglose del abono, saldo pendiente y fechas.
- Efectos de sonido de escaneo y caja registradora sintetizados localmente (sin requerir internet).

### 2. 📊 Métricas & Totales en Tiempo Real
- **Totales diarios**: cuánto se vendió hoy en $ y en Bs., junto con la cantidad de transacciones.
- **Totales semanales**: ventas acumuladas de la semana en curso.
- **Totales mensuales**: ventas acumuladas del mes actual.
- Alerta visual en tiempo real de artículos con **Bajo Stock** o **Agotados**.
- **Gráfico de tendencias** de los últimos 7 días.
- Ranking de rendimiento de vendedores del mes.

### 3. 📦 Inventario & Modificación de Precios
- Catálogo general con stock disponible, stock mínimo, costo de compra y precios de venta.
- **🏷️ Gestión Completa de Categorías**:
  - Módulo interactivo para **crear nuevas categorías**, **modificar/editar existentes** o **eliminar categorías**.
  - Especialmente adaptado para tiendas de **Televisores, Cocinas, Muebles, Neveras, Aires Acondicionados, Licuadoras, Lavadoras, etc.**
  - Incluye selector de iconos y emojis (📺, 🍳, 🛋️, ❄️, 💨, 🍹, 🧺).
  - **Actualización en cascada**: si cambia el nombre de una categoría (ej. de "Aires" a "Aires Acondicionados"), el sistema renombra automáticamente todos los productos asignados para que no se desvinculen.
  - **Borrado seguro**: si elimina una categoría con artículos, estos se reasignan a la categoría "General" para que no se pierdan.
  - Botón **"🔄 Cargar Categorías de Tienda"** para preconfigurar todas las categorías recomendadas con un solo clic.
- **Modificación rápida de precios**: cambie el precio en dólares ($) y el sistema calculará automáticamente el precio en bolívares según la tasa BCV (o viceversa).
- Creación y edición completa de productos con selector directo de categoría y botón de acceso rápido para crear categorías nuevas.
- Eliminación de productos obsoletos con confirmación de seguridad.
- Alertas por colores: *Verde (Disponible), Amarillo (Bajo Stock), Rojo (Agotado)*.
- Exportación del inventario completo a archivo **Excel / CSV**.

### 4. 🔄 Entradas y Salidas de Inventario
- Registro manual de **Entradas (+)** por compra a distribuidores, reposición o devoluciones.
- Registro manual de **Salidas (-)** por mermas, productos dañados o consumo interno.
- **Ajustes de inventario** tras realizar conteo físico en tienda.
- Historial de auditoría completo con fecha, hora, responsable y observaciones.
- Exportación de movimientos a **Excel / CSV**.

### 5. 📑 Historial Detallado de Ventas
- Registro de cada venta con fecha exacta, hora, vendedor que vendió, cliente, artículos y montos.
- Filtros por:
  - Hoy
  - Esta Semana
  - Este Mes
  - Todas las ventas
  - Por Vendedor específico
  - Buscador por número de ticket o producto
- Reimpresión de tickets anteriores.
- **Anulación de ventas**: si anula una venta, el sistema **reintegra automáticamente las cantidades vendidas al stock del inventario**.
- Exportación del histórico de ventas a **Excel / CSV**.

### 6. 👥 Equipo de Vendedores
- Registro y edición de vendedores y cajeros.
- Monitoreo del total facturado en $ y Bs. por cada vendedor en el mes.
- Cantidad de artículos vendidos y promedio por ticket.

### 7. 💵 Tasa Oficial del Banco Central de Venezuela (BCV)
- Consulta y sincronización en tiempo real con un solo clic (`🔄`) desde servidores CDN oficiales con datos actualizados del BCV.
- Cálculo dual automático e instantáneo de todos los precios del catálogo, carrito y tickets en $ y Bs.
- **Sin manipulación manual**: la tasa se mantiene 100% fiel a la oficial del Banco Central de Venezuela.
- **Soporte Offline**: si se cae la conexión a internet, el sistema conserva la última tasa oficial registrada sin interrumpir las ventas.

### 8. 💾 Almacenamiento Local y Respaldos (Sin depender de la nube)
- Todos los datos se guardan en el disco duro de su computadora mediante **IndexedDB**.
- Botón **"Descargar Copia de Seguridad Completa (JSON)"**: genere respaldos periódicos para guardar en un pendrive.
- Botón **"Cargar y Restaurar Respaldo"**: recupere toda su información en cualquier equipo al instante.

---

*Desarrollado para FullHouse Inversiones C.A - Octubre 2026*
