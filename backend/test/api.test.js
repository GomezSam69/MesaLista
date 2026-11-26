/*
 * Pruebas de integración de la API de MesaLista.
 * Requisitos: MySQL con mesalista.sql cargado y la API corriendo (npm run dev).
 * Ejecutar:   npm test        (usa API_URL=http://localhost:4000/api por defecto)
 * Los registros que crean llevan el prefijo "TEST_" y quedan en la BD, porque los pedidos
 * conservan trazabilidad y no se pueden borrar. Se pueden eliminar recargando mesalista.sql.
 */
import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API_URL || 'http://localhost:4000/api';
const RUN = Date.now().toString().slice(-7);

async function call(method, path, body) {
  const r = await fetch(API + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const get = p => call('GET', p), post = (p, b) => call('POST', p, b), put = (p, b) => call('PUT', p, b);
const patch = (p, b) => call('PATCH', p, b), del = p => call('DELETE', p);
const today = () => new Date().toLocaleDateString('en-CA');

const ctx = {}; // datos creados para las pruebas

before(async () => {
  const h = await get('/health').catch(() => null);
  assert.ok(h && h.status === 200, `La API no responde en ${API}. Inicie el backend (npm run dev) antes de las pruebas.`);
  ctx.cat = (await post('/categorias', { nombre: `TEST_Cat_${RUN}` })).body;
  ctx.plato1 = (await post('/platos', { id_categoria: ctx.cat.id_categoria, nombre: `TEST_Plato1_${RUN}`, precio: 10000 })).body;
  ctx.plato2 = (await post('/platos', { id_categoria: ctx.cat.id_categoria, nombre: `TEST_Plato2_${RUN}`, precio: 5000 })).body;
  ctx.mesa = (await post('/mesas', { numero: `T${RUN}`, capacidad: 4 })).body;
  ctx.emp = (await post('/empleados', { nombre: `TEST_Emp_${RUN}`, cargo: 'Mesero' })).body;
  ctx.cli = (await post('/clientes', { nombre: `TEST_Cli_${RUN}`, correo: `t${RUN}@mail.com` })).body;
});

describe('Validaciones (POST y PUT)', () => {
  test('precio negativo se rechaza al crear', async () => {
    const r = await post('/platos', { id_categoria: ctx.cat.id_categoria, nombre: 'X', precio: -1 });
    assert.equal(r.status, 400); assert.match(r.body.message, /negativo/);
  });
  test('precio negativo se rechaza al actualizar', async () => {
    const r = await put(`/platos/${ctx.plato1.id_plato}`, { precio: -5 });
    assert.equal(r.status, 400);
  });
  test('capacidad 0 se rechaza', async () => {
    assert.equal((await post('/mesas', { numero: `Z${RUN}`, capacidad: 0 })).status, 400);
    assert.equal((await put(`/mesas/${ctx.mesa.id_mesa}`, { capacidad: 0 })).status, 400);
  });
  test('estado de mesa y de reserva inválidos', async () => {
    assert.equal((await put(`/mesas/${ctx.mesa.id_mesa}`, { estado: 'roto' })).status, 400);
    const r = await post('/reservas', { id_cliente: ctx.cli.id_cliente, id_mesa: ctx.mesa.id_mesa, fecha_hora: '2030-01-01T20:00', personas: 2, estado: 'x' });
    assert.equal(r.status, 400);
  });
  test('personas inválidas en reserva', async () => {
    const r = await post('/reservas', { id_cliente: ctx.cli.id_cliente, id_mesa: ctx.mesa.id_mesa, fecha_hora: '2030-01-01T20:00', personas: 0 });
    assert.equal(r.status, 400);
  });
  test('correo inválido', async () => {
    assert.equal((await post('/empleados', { nombre: 'A', cargo: 'B', correo: 'mal' })).status, 400);
  });
  test('referencias inexistentes', async () => {
    assert.equal((await post('/platos', { id_categoria: 999999, nombre: 'X', precio: 1 })).status, 400);
    assert.equal((await post('/reservas', { id_cliente: 999999, id_mesa: ctx.mesa.id_mesa, fecha_hora: '2030-01-01T20:00', personas: 2 })).status, 400);
    assert.equal((await post('/pedidos', { id_mesa: 999999, id_empleado: ctx.emp.id_empleado, detalles: [{ id_plato: ctx.plato1.id_plato, cantidad: 1 }] })).status, 400);
  });
  test('JSON inválido y ruta inexistente', async () => {
    const r = await fetch(API + '/platos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{mal' });
    assert.equal(r.status, 400);
    assert.equal((await get('/no-existe')).status, 404);
  });
  test('registro duplicado devuelve 409', async () => {
    assert.equal((await post('/mesas', { numero: ctx.mesa.numero, capacidad: 2 })).status, 409);
  });
});

describe('Reservas: fecha y filtros', () => {
  test('la fecha y hora se guardan sin desfase y se filtran', async () => {
    const c = await post('/reservas', { id_cliente: ctx.cli.id_cliente, id_mesa: ctx.mesa.id_mesa, fecha_hora: '2030-05-20T20:30', personas: 3 });
    assert.equal(c.status, 201);
    assert.equal(c.body.fecha_hora, '2030-05-20 20:30:00');
    const l = await get(`/reservas?fecha=2030-05-20&estado=pendiente&id_mesa=${ctx.mesa.id_mesa}`);
    assert.equal(l.body.length, 1);
    assert.equal((await put(`/reservas/${c.body.id_reserva}`, { estado: 'confirmada' })).body.estado, 'confirmada');
    ctx.reserva = c.body;
  });
});

describe('Pedidos: flujo completo', () => {
  test('crear pedido calcula el total en el servidor', async () => {
    const r = await post('/pedidos', {
      id_mesa: ctx.mesa.id_mesa, id_empleado: ctx.emp.id_empleado, id_cliente: ctx.cli.id_cliente,
      total: 1, // el total enviado por el cliente se ignora
      detalles: [{ id_plato: ctx.plato1.id_plato, cantidad: 2 }, { id_plato: ctx.plato2.id_plato, cantidad: 1 }, { id_plato: ctx.plato1.id_plato, cantidad: 1 }]
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.total, 35000);           // 3×10000 + 1×5000
    assert.equal(r.body.detalles.length, 2);     // plato repetido se agrupa
    assert.equal(r.body.estado, 'pendiente');
    ctx.pedido = r.body;
  });
  test('cantidades y platos inválidos', async () => {
    const base = { id_mesa: ctx.mesa.id_mesa, id_empleado: ctx.emp.id_empleado };
    assert.equal((await post('/pedidos', { ...base, detalles: [{ id_plato: ctx.plato1.id_plato, cantidad: 0 }] })).status, 400);
    assert.equal((await post('/pedidos', { ...base, detalles: [{ id_plato: ctx.plato1.id_plato, cantidad: 1.5 }] })).status, 400);
    assert.equal((await post('/pedidos', { ...base, detalles: [{ id_plato: 999999, cantidad: 1 }] })).status, 400);
    assert.equal((await post('/pedidos', { ...base, detalles: [] })).status, 400);
  });
  test('modificar pedido pendiente conserva precio histórico', async () => {
    await put(`/platos/${ctx.plato1.id_plato}`, { precio: 99999 }); // el menú cambia de precio
    const r = await put(`/pedidos/${ctx.pedido.id_pedido}`, { detalles: [{ id_plato: ctx.plato1.id_plato, cantidad: 1 }, { id_plato: ctx.plato2.id_plato, cantidad: 2 }] });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 20000);           // 10000 (precio original) + 2×5000
    await put(`/platos/${ctx.plato1.id_plato}`, { precio: 10000 });
  });
  test('plato no disponible no se puede agregar', async () => {
    const p = (await post('/platos', { id_categoria: ctx.cat.id_categoria, nombre: `TEST_Off_${RUN}`, precio: 1, disponible: false })).body;
    const r = await post('/pedidos', { id_mesa: ctx.mesa.id_mesa, id_empleado: ctx.emp.id_empleado, detalles: [{ id_plato: p.id_plato, cantidad: 1 }] });
    assert.equal(r.status, 400); assert.match(r.body.message, /disponible/);
  });
  test('mesa fuera de servicio y empleado inactivo se rechazan', async () => {
    const m = (await post('/mesas', { numero: `F${RUN}`, capacidad: 2, estado: 'fuera de servicio' })).body;
    const e = (await post('/empleados', { nombre: `TEST_Inact_${RUN}`, cargo: 'X', activo: false })).body;
    const d = [{ id_plato: ctx.plato2.id_plato, cantidad: 1 }];
    assert.equal((await post('/pedidos', { id_mesa: m.id_mesa, id_empleado: ctx.emp.id_empleado, detalles: d })).status, 400);
    assert.equal((await post('/pedidos', { id_mesa: ctx.mesa.id_mesa, id_empleado: e.id_empleado, detalles: d })).status, 400);
  });
  test('total por mesa suma pedidos no anulados', async () => {
    const r = await get(`/mesas/${ctx.mesa.id_mesa}/total?fecha=${today()}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 20000);
    assert.equal(r.body.cantidad_pedidos, 1);
    const t = (await get(`/mesas/totales?fecha=${today()}`)).body.find(m => m.id_mesa === ctx.mesa.id_mesa);
    assert.equal(t.total, 20000);
  });
  test('filtros por fecha, mesa y estado', async () => {
    const ok = await get(`/pedidos?fecha=${today()}&id_mesa=${ctx.mesa.id_mesa}&estado=pendiente`);
    assert.ok(ok.body.some(p => p.id_pedido === ctx.pedido.id_pedido));
    const no = await get(`/pedidos?id_mesa=${ctx.mesa.id_mesa}&estado=entregado`);
    assert.equal(no.body.length, 0);
    assert.equal((await get('/pedidos?estado=zzz')).status, 400);
  });
  test('no se puede saltar ni retroceder de estado', async () => {
    const id = ctx.pedido.id_pedido;
    assert.equal((await patch(`/pedidos/${id}/estado`, { estado: 'entregado' })).status, 409);
    assert.equal((await patch(`/pedidos/${id}/estado`, { estado: 'en cocina' })).status, 200);
    assert.equal((await put(`/pedidos/${id}`, { id_cliente: null })).status, 409);       // ya no es editable
    assert.equal((await patch(`/pedidos/${id}/estado`, { estado: 'pendiente' })).status, 409);
    assert.equal((await patch(`/pedidos/${id}/estado`, { estado: 'entregado' })).status, 200);
    assert.equal((await patch(`/pedidos/${id}/estado`, { estado: 'anulado' })).status, 409); // entregado no se anula
    assert.equal((await del(`/pedidos/${id}`)).status, 409);
  });
  test('anular un pedido pendiente lo excluye del total', async () => {
    const p = (await post('/pedidos', { id_mesa: ctx.mesa.id_mesa, id_empleado: ctx.emp.id_empleado, detalles: [{ id_plato: ctx.plato2.id_plato, cantidad: 4 }] })).body;
    assert.equal((await get(`/mesas/${ctx.mesa.id_mesa}/total?fecha=${today()}`)).body.total, 40000);
    assert.equal((await del(`/pedidos/${p.id_pedido}`)).status, 200);
    assert.equal((await get(`/pedidos/${p.id_pedido}`)).body.estado, 'anulado');
    assert.equal((await get(`/mesas/${ctx.mesa.id_mesa}/total?fecha=${today()}`)).body.total, 20000);
  });
});

describe('Integridad: eliminaciones bloqueadas', () => {
  test('categoría con platos', async () => {
    const r = await del(`/categorias/${ctx.cat.id_categoria}`);
    assert.equal(r.status, 409); assert.match(r.body.message, /plato/);
    const det = await get(`/categorias/${ctx.cat.id_categoria}`);
    assert.ok(det.body.platos.length >= 2);
  });
  test('plato usado en pedidos', async () => assert.equal((await del(`/platos/${ctx.plato1.id_plato}`)).status, 409));
  test('mesa con pedidos o reservas', async () => assert.equal((await del(`/mesas/${ctx.mesa.id_mesa}`)).status, 409));
  test('empleado con pedidos', async () => assert.equal((await del(`/empleados/${ctx.emp.id_empleado}`)).status, 409));
  test('cliente con reservas o pedidos', async () => assert.equal((await del(`/clientes/${ctx.cli.id_cliente}`)).status, 409));
  test('registros sin relaciones sí se eliminan y luego dan 404', async () => {
    const c = (await post('/categorias', { nombre: `TEST_Libre_${RUN}` })).body;
    assert.equal((await del(`/categorias/${c.id_categoria}`)).status, 200);
    assert.equal((await get(`/categorias/${c.id_categoria}`)).status, 404);
  });
  test('una reserva se puede cancelar y eliminar', async () => {
    assert.equal((await put(`/reservas/${ctx.reserva.id_reserva}`, { estado: 'cancelada' })).status, 200);
    assert.equal((await del(`/reservas/${ctx.reserva.id_reserva}`)).status, 200);
  });
});
