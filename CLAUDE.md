# MesaLista · Contexto para Claude

Proyecto integrador (Optativa I y Base de Datos II, UCP). Aplicación web para gestionar restaurantes: platos, categorías, mesas, pedidos, clientes/reservas y empleados. Fuera de alcance: contabilidad completa y pagos electrónicos. Fuente de verdad de requisitos: `Proyecto_MesaLista.pdf`.

## Arquitectura (no cambiar)
```
React + Vite (:5173)  →  API Express (:4000)  →  MySQL (:3306, mesalista_db)
```
- `database/mesalista.sql`: esquema y datos de ejemplo. Debe seguir siendo idempotente. **Todo cambio de BD se hace aquí.**
- `backend/src/server.js`: API REST, validaciones y reglas de negocio. `db.js`: conexión (`dateStrings: true`, no quitarlo: evita desfases de hora).
- `frontend/src/config.js`: campos, columnas y filtros de cada módulo. `components/CrudModule.jsx`: CRUD genérico. `components/Pedidos.jsx`: pedidos y total por mesa. `api.js`, `utils.js`: utilidades.
- Docs: `docs/diagrama_er.*` (ER), `docs/PRUEBAS.md` (casos de prueba).

## Cómo correr
1. Iniciar MySQL (XAMPP) e importar `database/mesalista.sql`.
2. `cd backend` → copiar `.env.example` a `.env` (clave vacía en XAMPP) → `npm install` → `npm run dev`.
3. `cd frontend` → `npm install` → `npm run dev`.
4. Pruebas de la API (con la API corriendo): `cd backend && npm test`.
5. Antes de subir cambios: `npm run build` en `frontend` y `npm test` en `backend`.

## Reglas de negocio vigentes
- Pedido: `pendiente → en cocina → entregado`; se anula (`anulado`) solo antes de entregar; no se retrocede. Solo se edita en `pendiente`.
- El total lo calcula el servidor; el precio queda en `detalle_pedido.precio_unitario` (histórico). Al editar, los platos ya incluidos conservan su precio.
- No se toman pedidos en mesas `fuera de servicio` ni con empleados inactivos; platos deben existir y estar disponibles.
- Validar en POST y PUT: precio ≥ 0, capacidad/personas/cantidad enteros > 0, estados válidos, correo válido, referencias existentes.
- Eliminaciones bloqueadas con 409 y mensaje: categoría con platos; plato usado en pedidos; mesa con pedidos/reservas; empleado con pedidos; cliente con reservas/pedidos.
- Total por mesa: suma de pedidos no anulados; por defecto los del día (`?todo=1`, `?fecha=`, `?desde=&hasta=`).

## Decisiones NO definidas por el PDF (confirmar con el docente antes de cambiarlas)
Total por mesa = del día; edición solo en pendiente; no anular entregados; plato/empleado con historial se desactivan en vez de borrarse; mesa no cambia a `ocupada` automáticamente; sin login/roles; sin validación de cruces de horario ni capacidad en reservas.

## Identidad visual (respetar)
Azul oscuro `#17365D`, verde azulado `#0F6B78`, marfil `#F7F5EF`, naranja suave `#F4A261`, gris carbón `#343A40`. Tipografía Inter (o Arial/sans-serif).

## Convenciones
- Interfaz y mensajes de error en español.
- No subir `.env` ni `node_modules`. No agregar dependencias sin necesidad.
- Trabajar en ramas (`feature/...`) y abrir Pull Request; no commitear directo a `main`.
- Cambios de reglas o endpoints: actualizar `README.md`, este archivo y `docs/PRUEBAS.md`.
