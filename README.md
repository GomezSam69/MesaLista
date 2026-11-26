# MesaLista

Sistema web de gestión operativa para restaurantes. Proyecto integrador de Optativa I y Base de Datos II.

## Tecnologías
- React + Vite
- Node.js + Express
- MySQL 8+
- mysql2, dotenv, cors

## Requisitos
Node.js 18+ y MySQL 8+ instalados.

## 1. Crear la base de datos
En MySQL Workbench o consola, ejecutar el archivo `database/mesalista.sql`.
El script crea la base `mesalista_db`, sus tablas y datos de demostración.

## 2. Configurar el backend
```bash
cd backend
cp .env.example .env
```
Editar `.env` con las credenciales locales de MySQL. Luego:
```bash
npm install
npm run dev
```
API disponible en `http://localhost:4000`. Comprobación: `http://localhost:4000/api/health`.

## 3. Configurar el frontend
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```
Abrir la URL que indique Vite (normalmente `http://localhost:5173`).

## Módulos incluidos
Platos, categorías, mesas, pedidos, clientes, reservas y empleados. Clientes y reservas son entidades separadas en la base de datos y en la API, como recomienda el documento, y se presentan agrupadas funcionalmente en el menú.

## Reglas de negocio implementadas
- **Pedidos:** estados `pendiente → en cocina → entregado`; solo se puede anular antes de entregar (`anulado`, conserva trazabilidad). No se retrocede de estado.
- Un pedido solo se **modifica** mientras está `pendiente`. Los platos ya incluidos conservan su precio histórico; el total siempre lo calcula el servidor.
- No se toman pedidos en mesas `fuera de servicio` ni con empleados inactivos; los platos deben existir y estar disponibles.
- **Validaciones** (POST y PUT): precio ≥ 0, capacidad y personas enteros > 0, cantidades enteras > 0, estados válidos, correos válidos, fechas válidas y referencias existentes (400 con mensaje claro).
- **Eliminaciones (409 con explicación):** categoría con platos; plato usado en pedidos (se sugiere marcarlo no disponible); mesa con pedidos o reservas; empleado con pedidos (se sugiere desactivarlo); cliente con reservas o pedidos.
- **Total por mesa:** suma de pedidos no anulados. Por defecto, los del día.

## Endpoints
Cada recurso (`platos`, `categorias`, `mesas`, `empleados`, `clientes`, `reservas`) dispone de `GET /api/:recurso`, `GET /api/:recurso/:id`, `POST`, `PUT /:id` y `DELETE /:id`.

| Endpoint | Función |
|---|---|
| `GET /api/categorias/:id` | Categoría con sus platos asociados |
| `GET /api/platos?id_categoria=&disponible=&q=` | Filtros de platos |
| `GET /api/mesas?estado=&q=` | Filtros de mesas |
| `GET /api/mesas/totales?fecha=` &#124; `?desde=&hasta=` &#124; `?todo=1` | Total y cantidad de pedidos por mesa |
| `GET /api/mesas/:id/total` | Total de una mesa con desglose por estado y sus pedidos |
| `GET /api/pedidos?fecha=&desde=&hasta=&id_mesa=&estado=&id_empleado=` | Pedidos filtrados |
| `GET /api/pedidos/:id` | Pedido con detalles |
| `POST /api/pedidos` | Crear `{id_mesa, id_empleado, id_cliente?, detalles:[{id_plato,cantidad}]}` |
| `PUT /api/pedidos/:id` | Modificar mesa/cliente/platos (solo pendientes) |
| `PATCH /api/pedidos/:id/estado` | Avanzar estado |
| `DELETE /api/pedidos/:id` | Anular |
| `GET /api/reservas?fecha=&estado=&id_mesa=&id_cliente=&q=` | Filtros de reservas |
| `GET /api/clientes?q=` · `GET /api/empleados?activo=&q=` | Búsqueda |
| `GET /api/dashboard` | Resumen |

## Puntos que el documento no define (decisiones del equipo)
Revisar con el docente antes de entregar: ver el resumen de decisiones entregado junto con esta versión.

## Pruebas y documentación
- `cd backend && npm test`: 26 pruebas de integración de la API (requiere MySQL y la API corriendo). Dejan registros `TEST_`; recargue `mesalista.sql` sobre una base vacía para limpiarlos.
- `docs/PRUEBAS.md`: casos de prueba y resultados.
- `docs/diagrama_er.png` / `.svg` / `.mmd`: diagrama entidad-relación generado desde el esquema SQL.
- `CLAUDE.md`: contexto del proyecto para quien trabaje con Claude.

## Nota académica
Antes de entregar, el equipo debe adjuntar las capturas de `docs/PRUEBAS.md` y comparar `docs/diagrama_er.png` con la figura 1 del PDF.
