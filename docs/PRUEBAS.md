# MesaLista · Documentación de pruebas

**Versión probada:** v1.1 · **Entorno:** Windows, Node v24.22.0, XAMPP con MariaDB 10.4.32, API en `localhost:4000`.
**Cómo repetirlas:** con MySQL y la API corriendo, en `backend` ejecutar `npm test`. Las pruebas crean registros con prefijo `TEST_` (los pedidos no se pueden borrar por trazabilidad); se limpian recargando `database/mesalista.sql` sobre una base vacía.

## 1. Pruebas automatizadas de la API (`backend/test/api.test.js`)
Resultado de la última ejecución: **26 casos, 26 aprobados, 0 fallidos** (repetida dos veces seguidas con el mismo resultado).

| # | Área | Caso | Resultado esperado | Estado |
|---|---|---|---|---|
| 1 | Validación | Crear plato con precio negativo | 400 "El precio no puede ser negativo" | ✅ |
| 2 | Validación | Actualizar plato con precio negativo | 400 | ✅ |
| 3 | Validación | Mesa con capacidad 0 (crear y actualizar) | 400 | ✅ |
| 4 | Validación | Estado inválido de mesa y de reserva | 400 | ✅ |
| 5 | Validación | Reserva con 0 personas | 400 | ✅ |
| 6 | Validación | Empleado con correo mal formado | 400 | ✅ |
| 7 | Referencias | Plato con categoría inexistente; reserva con cliente inexistente; pedido con mesa inexistente | 400 | ✅ |
| 8 | Robustez | JSON inválido; ruta inexistente | 400; 404 | ✅ |
| 9 | Integridad | Mesa con número duplicado | 409 | ✅ |
| 10 | Reservas | Guardar `2030-05-20T20:30` y consultarlo | Se conserva `2030-05-20 20:30:00` (sin desfase); filtra por fecha, estado y mesa | ✅ |
| 11 | Pedidos | Crear pedido con total falso enviado por el cliente | El servidor calcula el total (35 000); agrupa platos repetidos; estado `pendiente` | ✅ |
| 12 | Pedidos | Cantidad 0, cantidad decimal, plato inexistente, pedido sin platos | 400 | ✅ |
| 13 | Pedidos | Modificar pedido tras cambiar el precio del plato | Conserva el precio histórico (total 20 000) | ✅ |
| 14 | Pedidos | Agregar un plato no disponible | 400 | ✅ |
| 15 | Pedidos | Mesa fuera de servicio; empleado inactivo | 400 | ✅ |
| 16 | Total por mesa | `GET /mesas/:id/total` y `/mesas/totales` | Suma de pedidos no anulados del día | ✅ |
| 17 | Filtros | Pedidos por fecha, mesa y estado; estado inválido | Filtra correctamente; 400 | ✅ |
| 18 | Estados | Saltar (`pendiente→entregado`), retroceder, editar fuera de `pendiente`, anular un entregado | 409 en cada caso; avances válidos 200 | ✅ |
| 19 | Estados | Anular un pedido pendiente | Pasa a `anulado` y sale del total de la mesa | ✅ |
| 20 | Eliminación | Categoría con platos | 409 con mensaje; `GET /categorias/:id` lista sus platos | ✅ |
| 21 | Eliminación | Plato usado en un pedido | 409 | ✅ |
| 22 | Eliminación | Mesa con pedidos o reservas | 409 | ✅ |
| 23 | Eliminación | Empleado con pedidos | 409 | ✅ |
| 24 | Eliminación | Cliente con reservas o pedidos | 409 | ✅ |
| 25 | Eliminación | Categoría sin relaciones | 200 y luego 404 | ✅ |
| 26 | Reservas | Cancelar y eliminar una reserva | 200 | ✅ |

## 2. Pruebas manuales de la interfaz
Hechas en navegador (Chromium) contra la API real. **El equipo debe repetirlas en sus equipos y adjuntar capturas.**

| # | Pantalla | Pasos | Resultado esperado | Estado | Captura |
|---|---|---|---|---|---|
| M1 | Resumen | Abrir la app | Tarjetas con datos reales; "Sistema conectado" | ✅ | _pendiente_ |
| M2 | Pedidos | Nuevo pedido con 2 platos, cantidad 3 en uno | Total estimado correcto; aviso verde al guardar | ✅ | _pendiente_ |
| M3 | Pedidos | Pulsar → en un pedido pendiente | Pasa a "en cocina"; el total por mesa se actualiza | ✅ | _pendiente_ |
| M4 | Pedidos | Pedido "en cocina" | No muestra el botón Editar | ✅ | _pendiente_ |
| M5 | Pedidos | Filtrar por estado | La lista muestra solo ese estado | ✅ | _pendiente_ |
| M6 | Pedidos | Ver detalle | Muestra platos, precios, subtotales y total | ✅ | _pendiente_ |
| M7 | Reservas | Editar una reserva | La fecha y hora aparecen cargadas (antes quedaban vacías) | ✅ | _pendiente_ |
| M8 | Categorías | Eliminar una con platos | Aviso **rojo** con el motivo | ✅ | _pendiente_ |
| M9 | Todos | Crear, editar y eliminar en Platos, Mesas, Clientes y Empleados | Operación reflejada en la tabla y en la BD | ⬜ sin ejecutar | _pendiente_ |
| M10 | Responsive | Abrir en ancho de celular (menú hamburguesa) | Se usa sin desbordes | ⬜ sin ejecutar | _pendiente_ |


