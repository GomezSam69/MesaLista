import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import pool from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = m => new HttpError(400, m);
const notFound = m => new HttpError(404, m);
const conflict = m => new HttpError(409, m);

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const MESA_ESTADOS = ['disponible', 'ocupada', 'fuera de servicio'];
const RESERVA_ESTADOS = ['pendiente', 'confirmada', 'cancelada', 'atendida'];
const PEDIDO_ESTADOS = ['pendiente', 'en cocina', 'entregado', 'anulado'];
// Un pedido solo avanza (pendiente → en cocina → entregado) o se anula antes de entregarse.
const TRANSICIONES = {
  'pendiente': ['en cocina', 'anulado'],
  'en cocina': ['entregado', 'anulado'],
  'entregado': [],
  'anulado': []
};

const isBlank = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const toId = (value, label = 'identificador') => {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || Number(s) <= 0) throw bad(`El ${label} no es válido`);
  return Number(s);
};
const toBool = v => {
  if (v === true || v === 1 || v === '1' || v === 'true') return 1;
  if (v === false || v === 0 || v === '0' || v === 'false') return 0;
  throw bad('Valor booleano no válido');
};
const toMoney = (v, label) => {
  const n = Number(v);
  if (isBlank(v) || !Number.isFinite(n)) throw bad(`${label} debe ser un número`);
  if (n < 0) throw bad(`${label} no puede ser negativo`);
  return Math.round(n * 100) / 100;
};
const toPositiveInt = (v, label) => {
  const n = Number(v);
  if (isBlank(v) || !Number.isInteger(n) || n <= 0) throw bad(`${label} debe ser un número entero mayor que cero`);
  return n;
};
// Acepta "YYYY-MM-DDTHH:mm[:ss]" o "YYYY-MM-DD HH:mm[:ss]" y devuelve "YYYY-MM-DD HH:mm:ss"
const toDateTime = v => {
  const m = String(v ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/);
  if (!m) throw bad('La fecha y hora no tienen un formato válido');
  const out = `${m[1]} ${m[2]}${m[3] || ':00'}`;
  if (Number.isNaN(Date.parse(out.replace(' ', 'T')))) throw bad('La fecha y hora no son válidas');
  return out;
};
const toDate = (v, label = 'La fecha') => {
  const m = String(v ?? '').trim().match(/^\d{4}-\d{2}-\d{2}$/);
  if (!m || Number.isNaN(Date.parse(v))) throw bad(`${label} debe tener el formato AAAA-MM-DD`);
  return v;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function count(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return Number(row.n);
}
async function mustExist(table, idCol, id, message, conn = pool) {
  const [rows] = await conn.query(`SELECT * FROM ${table} WHERE ${idCol}=?`, [id]);
  if (!rows.length) throw bad(message);
  return rows[0];
}
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

/* ------------------------------------------------------------------ */
/* Definición de los recursos CRUD genéricos                           */
/* ------------------------------------------------------------------ */
const resources = {
  categorias: {
    table: 'categorias', id: 'id_categoria', label: 'categoría',
    fields: ['nombre', 'descripcion', 'activa'], required: ['nombre'], bools: ['activa'],
    select: `SELECT c.*, (SELECT COUNT(*) FROM platos p WHERE p.id_categoria=c.id_categoria) AS total_platos FROM categorias c`,
    alias: 'c',
    filters: {}
  },
  platos: {
    table: 'platos', id: 'id_plato', label: 'plato',
    fields: ['id_categoria', 'nombre', 'descripcion', 'precio', 'disponible'],
    required: ['id_categoria', 'nombre', 'precio'], bools: ['disponible'],
    select: `SELECT p.*, c.nombre AS categoria FROM platos p JOIN categorias c ON c.id_categoria=p.id_categoria`,
    alias: 'p',
    filters: {
      id_categoria: v => ['p.id_categoria = ?', toId(v, 'id_categoria')],
      disponible: v => ['p.disponible = ?', toBool(v)],
      q: v => ['(p.nombre LIKE ? OR p.descripcion LIKE ?)', `%${v}%`, `%${v}%`]
    }
  },
  mesas: {
    table: 'mesas', id: 'id_mesa', label: 'mesa',
    fields: ['numero', 'capacidad', 'estado'], required: ['numero', 'capacidad'], bools: [],
    select: `SELECT m.* FROM mesas m`, alias: 'm',
    filters: {
      estado: v => ['m.estado = ?', v],
      q: v => ['m.numero LIKE ?', `%${v}%`]
    }
  },
  empleados: {
    table: 'empleados', id: 'id_empleado', label: 'empleado',
    fields: ['nombre', 'telefono', 'correo', 'cargo', 'activo'], required: ['nombre', 'cargo'], bools: ['activo'],
    select: `SELECT e.* FROM empleados e`, alias: 'e',
    filters: {
      activo: v => ['e.activo = ?', toBool(v)],
      q: v => ['(e.nombre LIKE ? OR e.cargo LIKE ? OR e.correo LIKE ?)', `%${v}%`, `%${v}%`, `%${v}%`]
    }
  },
  clientes: {
    table: 'clientes', id: 'id_cliente', label: 'cliente',
    fields: ['nombre', 'telefono', 'correo'], required: ['nombre'], bools: [],
    select: `SELECT c.* FROM clientes c`, alias: 'c',
    filters: {
      q: v => ['(c.nombre LIKE ? OR c.telefono LIKE ? OR c.correo LIKE ?)', `%${v}%`, `%${v}%`, `%${v}%`]
    }
  },
  reservas: {
    table: 'reservas', id: 'id_reserva', label: 'reserva',
    fields: ['id_cliente', 'id_mesa', 'fecha_hora', 'personas', 'estado'],
    required: ['id_cliente', 'id_mesa', 'fecha_hora', 'personas'], bools: [],
    select: `SELECT r.*, c.nombre AS cliente, m.numero AS mesa FROM reservas r
             JOIN clientes c ON c.id_cliente=r.id_cliente JOIN mesas m ON m.id_mesa=r.id_mesa`,
    alias: 'r',
    orderBy: 'r.fecha_hora DESC',
    filters: {
      fecha: v => ['DATE(r.fecha_hora) = ?', toDate(v)],
      estado: v => ['r.estado = ?', v],
      id_mesa: v => ['r.id_mesa = ?', toId(v, 'id_mesa')],
      id_cliente: v => ['r.id_cliente = ?', toId(v, 'id_cliente')],
      q: v => ['c.nombre LIKE ?', `%${v}%`]
    }
  }
};

/** Valida y normaliza el cuerpo. `partial` = true en PUT (solo se validan los campos enviados). */
async function prepare(path, cfg, body, partial) {
  const data = {};
  for (const k of cfg.fields) if (body[k] !== undefined) data[k] = body[k];

  for (const k of cfg.required) {
    if (partial && data[k] === undefined) continue;
    if (isBlank(data[k])) throw bad(`El campo ${k} es obligatorio`);
  }
  for (const k of Object.keys(data)) {
    if (typeof data[k] === 'string') data[k] = data[k].trim();
    if (data[k] === '' && !cfg.required.includes(k)) data[k] = null;
    if (cfg.bools.includes(k)) data[k] = toBool(data[k]);
  }

  switch (path) {
    case 'platos':
      if (data.precio !== undefined) data.precio = toMoney(data.precio, 'El precio');
      if (data.id_categoria !== undefined) {
        data.id_categoria = toId(data.id_categoria, 'id_categoria');
        await mustExist('categorias', 'id_categoria', data.id_categoria, 'La categoría seleccionada no existe');
      }
      break;
    case 'mesas':
      if (data.capacidad !== undefined) data.capacidad = toPositiveInt(data.capacidad, 'La capacidad');
      if (data.estado !== undefined && !MESA_ESTADOS.includes(data.estado))
        throw bad(`Estado de mesa no válido. Use: ${MESA_ESTADOS.join(', ')}`);
      break;
    case 'empleados':
    case 'clientes':
      if (data.correo && !EMAIL.test(data.correo)) throw bad('El correo electrónico no es válido');
      break;
    case 'reservas':
      if (data.personas !== undefined) data.personas = toPositiveInt(data.personas, 'La cantidad de personas');
      if (data.fecha_hora !== undefined) data.fecha_hora = toDateTime(data.fecha_hora);
      if (data.estado !== undefined && !RESERVA_ESTADOS.includes(data.estado))
        throw bad(`Estado de reserva no válido. Use: ${RESERVA_ESTADOS.join(', ')}`);
      if (data.id_cliente !== undefined) {
        data.id_cliente = toId(data.id_cliente, 'id_cliente');
        await mustExist('clientes', 'id_cliente', data.id_cliente, 'El cliente seleccionado no existe');
      }
      if (data.id_mesa !== undefined) {
        data.id_mesa = toId(data.id_mesa, 'id_mesa');
        await mustExist('mesas', 'id_mesa', data.id_mesa, 'La mesa seleccionada no existe');
      }
      break;
  }
  return data;
}

/** Reglas de integridad antes de eliminar (el PDF, secciones 6 y 10). */
const deleteGuards = {
  categorias: async id => {
    const n = await count('SELECT COUNT(*) AS n FROM platos WHERE id_categoria=?', [id]);
    if (n) throw conflict(`No se puede eliminar la categoría: tiene ${plural(n, 'plato asociado', 'platos asociados')}. Reasigne o elimine primero esos platos.`);
  },
  platos: async id => {
    const n = await count('SELECT COUNT(DISTINCT id_pedido) AS n FROM detalle_pedido WHERE id_plato=?', [id]);
    if (n) throw conflict(`No se puede eliminar el plato: aparece en ${plural(n, 'pedido', 'pedidos')}. Márquelo como no disponible para retirarlo del menú.`);
  },
  mesas: async id => {
    const p = await count('SELECT COUNT(*) AS n FROM pedidos WHERE id_mesa=?', [id]);
    const r = await count('SELECT COUNT(*) AS n FROM reservas WHERE id_mesa=?', [id]);
    if (p || r) {
      const partes = [];
      if (p) partes.push(plural(p, 'pedido', 'pedidos'));
      if (r) partes.push(plural(r, 'reserva', 'reservas'));
      throw conflict(`No se puede eliminar la mesa: tiene registros vinculados (${partes.join(' y ')}). Puede marcarla como fuera de servicio.`);
    }
  },
  empleados: async id => {
    const n = await count('SELECT COUNT(*) AS n FROM pedidos WHERE id_empleado=?', [id]);
    if (n) throw conflict(`No se puede eliminar el empleado: registró ${plural(n, 'pedido', 'pedidos')}. Desactívelo (Activo = No) para conservar el historial.`);
  },
  clientes: async id => {
    const r = await count('SELECT COUNT(*) AS n FROM reservas WHERE id_cliente=?', [id]);
    const p = await count('SELECT COUNT(*) AS n FROM pedidos WHERE id_cliente=?', [id]);
    if (r || p) {
      const partes = [];
      if (r) partes.push(plural(r, 'reserva', 'reservas'));
      if (p) partes.push(plural(p, 'pedido', 'pedidos'));
      throw conflict(`No se puede eliminar el cliente: tiene registros que deben conservarse (${partes.join(' y ')}).`);
    }
  }
};

/* ------------------------------------------------------------------ */
/* Rutas                                                               */
/* ------------------------------------------------------------------ */
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'MesaLista' }));

/* ---- Total por mesa (se registra ANTES del CRUD genérico de mesas) ---- */
// Por defecto cuenta los pedidos del día; el PDF no define "cuenta cerrada", ver README.
function rangoFechas(q, col = 'p.fecha_hora') {
  const where = ["p.estado <> 'anulado'"];
  const params = [];
  if (q.fecha) { where.push(`DATE(${col}) = ?`); params.push(toDate(q.fecha)); }
  if (q.desde) { where.push(`DATE(${col}) >= ?`); params.push(toDate(q.desde, 'La fecha "desde"')); }
  if (q.hasta) { where.push(`DATE(${col}) <= ?`); params.push(toDate(q.hasta, 'La fecha "hasta"')); }
  if (!q.fecha && !q.desde && !q.hasta && !['1', 'true'].includes(String(q.todo))) where.push(`DATE(${col}) = CURDATE()`);
  return { where, params };
}

app.get('/api/mesas/totales', asyncHandler(async (req, res) => {
  const { where, params } = rangoFechas(req.query);
  const [rows] = await pool.query(
    `SELECT m.id_mesa, m.numero, m.capacidad, m.estado,
            COUNT(p.id_pedido) AS pedidos, COALESCE(SUM(p.total),0) AS total
     FROM mesas m LEFT JOIN pedidos p ON p.id_mesa=m.id_mesa AND ${where.join(' AND ')}
     GROUP BY m.id_mesa, m.numero, m.capacidad, m.estado ORDER BY m.numero`, params);
  res.json(rows);
}));

app.get('/api/mesas/:id/total', asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const [[mesa]] = await pool.query('SELECT * FROM mesas WHERE id_mesa=?', [id]);
  if (!mesa) throw notFound('Mesa no encontrada');
  const { where, params } = rangoFechas(req.query);
  const [pedidos] = await pool.query(
    `SELECT p.id_pedido, p.fecha_hora, p.estado, p.total FROM pedidos p
     WHERE p.id_mesa=? AND ${where.join(' AND ')} ORDER BY p.fecha_hora DESC`, [id, ...params]);
  const por_estado = {};
  let total = 0;
  for (const p of pedidos) {
    por_estado[p.estado] ??= { pedidos: 0, total: 0 };
    por_estado[p.estado].pedidos += 1;
    por_estado[p.estado].total += Number(p.total);
    total += Number(p.total);
  }
  res.json({ id_mesa: mesa.id_mesa, numero: mesa.numero, total, cantidad_pedidos: pedidos.length, por_estado, pedidos });
}));

/* ---- CRUD genérico ---- */
for (const [path, cfg] of Object.entries(resources)) {
  app.get(`/api/${path}`, asyncHandler(async (req, res) => {
    const where = [], params = [];
    for (const [name, build] of Object.entries(cfg.filters)) {
      const v = req.query[name];
      if (isBlank(v)) continue;
      const [clause, ...p] = build(String(v).trim());
      where.push(clause); params.push(...p);
    }
    const order = cfg.orderBy || `${cfg.alias}.${cfg.id} DESC`;
    const [rows] = await pool.query(`${cfg.select}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`, params);
    res.json(rows);
  }));

  app.get(`/api/${path}/:id`, asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const [rows] = await pool.query(`${cfg.select} WHERE ${cfg.alias}.${cfg.id}=?`, [id]);
    if (!rows.length) throw notFound('Registro no encontrado');
    const row = rows[0];
    // "Ver los platos asociados" a una categoría
    if (path === 'categorias') {
      const [platos] = await pool.query('SELECT id_plato, nombre, precio, disponible FROM platos WHERE id_categoria=? ORDER BY nombre', [id]);
      row.platos = platos;
    }
    res.json(row);
  }));

  app.post(`/api/${path}`, asyncHandler(async (req, res) => {
    const data = await prepare(path, cfg, req.body ?? {}, false);
    const keys = Object.keys(data);
    const [result] = await pool.query(`INSERT INTO ${cfg.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(k => data[k]));
    const [rows] = await pool.query(`${cfg.select} WHERE ${cfg.alias}.${cfg.id}=?`, [result.insertId]);
    res.status(201).json(rows[0]);
  }));

  app.put(`/api/${path}/:id`, asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const data = await prepare(path, cfg, req.body ?? {}, true);
    const keys = Object.keys(data);
    if (!keys.length) throw bad('No hay campos para actualizar');
    const [result] = await pool.query(`UPDATE ${cfg.table} SET ${keys.map(k => `${k}=?`).join(',')} WHERE ${cfg.id}=?`, [...keys.map(k => data[k]), id]);
    if (!result.affectedRows) throw notFound('Registro no encontrado');
    const [rows] = await pool.query(`${cfg.select} WHERE ${cfg.alias}.${cfg.id}=?`, [id]);
    res.json(rows[0]);
  }));

  app.delete(`/api/${path}/:id`, asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const [exists] = await pool.query(`SELECT 1 FROM ${cfg.table} WHERE ${cfg.id}=?`, [id]);
    if (!exists.length) throw notFound('Registro no encontrado');
    if (deleteGuards[path]) await deleteGuards[path](id);
    await pool.query(`DELETE FROM ${cfg.table} WHERE ${cfg.id}=?`, [id]);
    res.json({ message: 'Registro eliminado' });
  }));
}

/* ---- Pedidos ---- */
const PEDIDO_SELECT = `SELECT p.*, m.numero AS mesa, e.nombre AS empleado, c.nombre AS cliente
  FROM pedidos p JOIN mesas m ON p.id_mesa=m.id_mesa
  JOIN empleados e ON p.id_empleado=e.id_empleado
  LEFT JOIN clientes c ON p.id_cliente=c.id_cliente`;

async function loadPedido(id, conn = pool) {
  const [rows] = await conn.query(`${PEDIDO_SELECT} WHERE p.id_pedido=?`, [id]);
  if (!rows.length) throw notFound('Pedido no encontrado');
  const [detalles] = await conn.query(
    `SELECT d.*, pl.nombre AS plato FROM detalle_pedido d JOIN platos pl ON d.id_plato=pl.id_plato
     WHERE d.id_pedido=? ORDER BY d.id_detalle`, [id]);
  return { ...rows[0], detalles };
}

/** Valida las líneas del pedido. `previos` (Map id_plato → precio) conserva el precio histórico al editar. */
async function buildDetalles(conn, detalles, previos = new Map()) {
  if (!Array.isArray(detalles) || !detalles.length) throw bad('El pedido debe tener al menos un plato');
  const merged = new Map();
  for (const item of detalles) {
    const id_plato = toId(item?.id_plato, 'id_plato');
    const cantidad = toPositiveInt(item?.cantidad, 'La cantidad');
    merged.set(id_plato, (merged.get(id_plato) || 0) + cantidad);
  }
  const lines = [];
  let total = 0;
  for (const [id_plato, cantidad] of merged) {
    const [rows] = await conn.query('SELECT nombre, precio, disponible FROM platos WHERE id_plato=?', [id_plato]);
    if (!rows.length) throw bad(`El plato ${id_plato} no existe`);
    const yaEstaba = previos.has(id_plato);
    if (!yaEstaba && !rows[0].disponible) throw bad(`El plato "${rows[0].nombre}" no está disponible`);
    const precio = yaEstaba ? previos.get(id_plato) : Number(rows[0].precio);
    const subtotal = Math.round(precio * cantidad * 100) / 100;
    total += subtotal;
    lines.push([id_plato, cantidad, precio, subtotal]);
  }
  return { lines, total: Math.round(total * 100) / 100 };
}

async function validarMesaEmpleadoCliente({ id_mesa, id_empleado, id_cliente }, conn) {
  if (id_mesa !== undefined) {
    const mesa = await mustExist('mesas', 'id_mesa', id_mesa, 'La mesa seleccionada no existe', conn);
    if (mesa.estado === 'fuera de servicio') throw bad(`La mesa ${mesa.numero} está fuera de servicio`);
  }
  if (id_empleado !== undefined) {
    const emp = await mustExist('empleados', 'id_empleado', id_empleado, 'El empleado seleccionado no existe', conn);
    if (!emp.activo) throw bad(`El empleado ${emp.nombre} está inactivo`);
  }
  if (id_cliente !== undefined && id_cliente !== null)
    await mustExist('clientes', 'id_cliente', id_cliente, 'El cliente seleccionado no existe', conn);
}

app.get('/api/pedidos', asyncHandler(async (req, res) => {
  const q = req.query, where = [], params = [];
  if (!isBlank(q.fecha)) { where.push('DATE(p.fecha_hora)=?'); params.push(toDate(q.fecha)); }
  if (!isBlank(q.desde)) { where.push('DATE(p.fecha_hora)>=?'); params.push(toDate(q.desde, 'La fecha "desde"')); }
  if (!isBlank(q.hasta)) { where.push('DATE(p.fecha_hora)<=?'); params.push(toDate(q.hasta, 'La fecha "hasta"')); }
  const mesa = q.id_mesa ?? q.mesa;
  if (!isBlank(mesa)) { where.push('p.id_mesa=?'); params.push(toId(mesa, 'id_mesa')); }
  if (!isBlank(q.estado)) {
    if (!PEDIDO_ESTADOS.includes(q.estado)) throw bad(`Estado no válido. Use: ${PEDIDO_ESTADOS.join(', ')}`);
    where.push('p.estado=?'); params.push(q.estado);
  }
  if (!isBlank(q.id_empleado)) { where.push('p.id_empleado=?'); params.push(toId(q.id_empleado, 'id_empleado')); }
  const [rows] = await pool.query(`${PEDIDO_SELECT}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY p.fecha_hora DESC, p.id_pedido DESC`, params);
  res.json(rows);
}));

app.get('/api/pedidos/:id', asyncHandler(async (req, res) => {
  res.json(await loadPedido(toId(req.params.id)));
}));

app.post('/api/pedidos', asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  if (isBlank(body.id_mesa) || isBlank(body.id_empleado)) throw bad('La mesa y el empleado son obligatorios');
  const id_mesa = toId(body.id_mesa, 'id_mesa');
  const id_empleado = toId(body.id_empleado, 'id_empleado');
  const id_cliente = isBlank(body.id_cliente) ? null : toId(body.id_cliente, 'id_cliente');

  const conn = await pool.getConnection();
  try {
    await validarMesaEmpleadoCliente({ id_mesa, id_empleado, id_cliente }, conn);
    await conn.beginTransaction();
    const { lines, total } = await buildDetalles(conn, body.detalles);
    const [p] = await conn.query('INSERT INTO pedidos(id_mesa,id_empleado,id_cliente,total) VALUES(?,?,?,?)', [id_mesa, id_empleado, id_cliente, total]);
    for (const l of lines)
      await conn.query('INSERT INTO detalle_pedido(id_pedido,id_plato,cantidad,precio_unitario,subtotal) VALUES(?,?,?,?,?)', [p.insertId, ...l]);
    await conn.commit();
    res.status(201).json(await loadPedido(p.insertId, conn));
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// Modificar un pedido: mesa, cliente y/o platos. Solo mientras está "pendiente".
app.put('/api/pedidos/:id', asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const body = req.body ?? {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[pedido]] = await conn.query('SELECT * FROM pedidos WHERE id_pedido=? FOR UPDATE', [id]);
    if (!pedido) throw notFound('Pedido no encontrado');
    if (pedido.estado !== 'pendiente')
      throw conflict(`Solo se pueden modificar pedidos pendientes (este está "${pedido.estado}")`);

    const cambios = {};
    if (body.id_mesa !== undefined) cambios.id_mesa = toId(body.id_mesa, 'id_mesa');
    if (body.id_empleado !== undefined) cambios.id_empleado = toId(body.id_empleado, 'id_empleado');
    if (body.id_cliente !== undefined) cambios.id_cliente = isBlank(body.id_cliente) ? null : toId(body.id_cliente, 'id_cliente');
    await validarMesaEmpleadoCliente(cambios, conn);

    if (body.detalles !== undefined) {
      const [previos] = await conn.query('SELECT id_plato, precio_unitario FROM detalle_pedido WHERE id_pedido=?', [id]);
      const mapa = new Map(previos.map(r => [r.id_plato, Number(r.precio_unitario)]));
      const { lines, total } = await buildDetalles(conn, body.detalles, mapa);
      await conn.query('DELETE FROM detalle_pedido WHERE id_pedido=?', [id]);
      for (const l of lines)
        await conn.query('INSERT INTO detalle_pedido(id_pedido,id_plato,cantidad,precio_unitario,subtotal) VALUES(?,?,?,?,?)', [id, ...l]);
      cambios.total = total;
    }
    const keys = Object.keys(cambios);
    if (!keys.length) throw bad('No hay campos para actualizar');
    await conn.query(`UPDATE pedidos SET ${keys.map(k => `${k}=?`).join(',')} WHERE id_pedido=?`, [...keys.map(k => cambios[k]), id]);
    await conn.commit();
    res.json(await loadPedido(id, conn));
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

async function cambiarEstado(id, estado) {
  if (!PEDIDO_ESTADOS.includes(estado)) throw bad(`Estado no válido. Use: ${PEDIDO_ESTADOS.join(', ')}`);
  const [[pedido]] = await pool.query('SELECT estado FROM pedidos WHERE id_pedido=?', [id]);
  if (!pedido) throw notFound('Pedido no encontrado');
  if (!TRANSICIONES[pedido.estado].includes(estado)) {
    const sig = TRANSICIONES[pedido.estado];
    throw conflict(`No se puede pasar de "${pedido.estado}" a "${estado}".` +
      (sig.length ? ` Estados permitidos: ${sig.join(', ')}.` : ' El pedido ya está cerrado.'));
  }
  await pool.query('UPDATE pedidos SET estado=? WHERE id_pedido=?', [estado, id]);
}

app.patch('/api/pedidos/:id/estado', asyncHandler(async (req, res) => {
  await cambiarEstado(toId(req.params.id), req.body?.estado);
  res.json({ message: 'Estado actualizado', pedido: await loadPedido(toId(req.params.id)) });
}));

// "Eliminar" un pedido = anularlo (se conserva la trazabilidad).
app.delete('/api/pedidos/:id', asyncHandler(async (req, res) => {
  await cambiarEstado(toId(req.params.id), 'anulado');
  res.json({ message: 'Pedido anulado para conservar trazabilidad' });
}));

/* ---- Resumen ---- */
app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const platos = await count('SELECT COUNT(*) AS n FROM platos');
  const mesas = await count("SELECT COUNT(*) AS n FROM mesas WHERE estado='disponible'");
  const pedidos = await count("SELECT COUNT(*) AS n FROM pedidos WHERE estado IN ('pendiente','en cocina')");
  const [[{ ventas }]] = await pool.query("SELECT COALESCE(SUM(total),0) AS ventas FROM pedidos WHERE estado<>'anulado' AND DATE(fecha_hora)=CURDATE()");
  res.json({ platos, mesas, pedidos, ventas: Number(ventas) });
}));

/* ---- Errores ---- */
app.use('/api', (req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'El cuerpo de la solicitud no es un JSON válido' });
  console.error(err);
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'La relación seleccionada no existe.' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ message: 'No se puede eliminar: existen registros relacionados.' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ya existe un registro con ese dato único.' });
  if (['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_CONSTRAINT_FAILED', 'WARN_DATA_TRUNCATED', 'ER_TRUNCATED_WRONG_VALUE', 'ER_DATA_TOO_LONG', 'ER_WARN_DATA_OUT_OF_RANGE'].includes(err.code))
    return res.status(400).json({ message: 'Alguno de los valores enviados no es válido.' });
  res.status(500).json({ message: 'Error interno del servidor' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`MesaLista API ejecutándose en http://localhost:${port}`));
