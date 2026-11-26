import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Pencil, Eye, Ban, ArrowRight, X, Trash2 } from 'lucide-react';
import { request, qs } from '../api.js';
import { PEDIDO_ESTADOS } from '../config.js';
import { money, fmtDateTime, todayISO, slug } from '../utils.js';

const SIGUIENTE = { 'pendiente': 'en cocina', 'en cocina': 'entregado' };

const Pill = ({ estado }) => <span className={'pill ' + slug(estado)}>{estado}</span>;

/* ------------------------- Total por mesa ------------------------- */
function TotalesMesa({ refreshKey, mesaSel, onSelect }) {
  const [fecha, setFecha] = useState(todayISO());
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    request('/mesas/totales' + qs({ fecha })).then(d => { if (vivo) { setData(d); setError(''); } })
      .catch(e => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [fecha, refreshKey]);
  const suma = data.reduce((a, m) => a + Number(m.total), 0);
  return (
    <div className="panel totals-panel">
      <div className="panel-heading">
        <div><h3>Total por mesa</h3><p>Suma de pedidos no anulados del día · {money(suma)} en total</p></div>
        <input type="date" className="date-input" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>
      {error ? <div className="empty">{error}</div> : (
        <div className="totals-grid">
          {data.map(m => (
            <button key={m.id_mesa} className={'total-card' + (String(mesaSel) === String(m.id_mesa) ? ' selected' : '')}
              onClick={() => onSelect(String(mesaSel) === String(m.id_mesa) ? '' : String(m.id_mesa))}
              title="Filtrar pedidos de esta mesa">
              <span>Mesa {m.numero}</span>
              <strong>{money(m.total)}</strong>
              <small>{m.pedidos} {m.pedidos === 1 ? 'pedido' : 'pedidos'}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Detalle ------------------------- */
function DetalleModal({ pedido, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div><div className="eyebrow">PEDIDO #{pedido.id_pedido}</div><h2>Mesa {pedido.mesa}</h2></div>
          <button type="button" className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <dl className="meta">
          <div><dt>Estado</dt><dd><Pill estado={pedido.estado} /></dd></div>
          <div><dt>Fecha</dt><dd>{fmtDateTime(pedido.fecha_hora)}</dd></div>
          <div><dt>Atendió</dt><dd>{pedido.empleado}</dd></div>
          <div><dt>Cliente</dt><dd>{pedido.cliente || '—'}</dd></div>
        </dl>
        <div className="table-wrap"><table>
          <thead><tr><th>Plato</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
          <tbody>{pedido.detalles.map(d => (
            <tr key={d.id_detalle}><td>{d.plato}</td><td>{d.cantidad}</td><td>{money(d.precio_unitario)}</td><td>{money(d.subtotal)}</td></tr>
          ))}</tbody>
        </table></div>
        <div className="order-total"><span>Total</span><strong>{money(pedido.total)}</strong></div>
      </div>
    </div>
  );
}

/* ------------------------- Formulario crear / editar ------------------------- */
function PedidoForm({ pedido, lookups, notify, onClose, onSaved }) {
  const editing = !!pedido;
  const [head, setHead] = useState({
    id_mesa: pedido?.id_mesa ?? '', id_empleado: pedido?.id_empleado ?? '', id_cliente: pedido?.id_cliente ?? ''
  });
  const [lines, setLines] = useState(
    pedido ? pedido.detalles.map(d => ({ id_plato: d.id_plato, cantidad: d.cantidad, precio: d.precio_unitario }))
      : [{ id_plato: '', cantidad: 1 }]);
  const [saving, setSaving] = useState(false);

  const platos = lookups.platos || [];
  const mapa = useMemo(() => Object.fromEntries(platos.map(p => [p.id_plato, p])), [platos]);
  const enPedido = new Set(lines.map(l => Number(l.id_plato)));
  const opcionesPlato = platos.filter(p => p.disponible || (editing && pedido.detalles.some(d => d.id_plato === p.id_plato)));
  const precioDe = l => l.precio ?? mapa[l.id_plato]?.precio ?? 0;
  const total = lines.reduce((a, l) => a + (l.id_plato ? precioDe(l) * (Number(l.cantidad) || 0) : 0), 0);

  const setLine = (i, patch) => setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));

  const submit = async e => {
    e.preventDefault();
    const detalles = lines.filter(l => l.id_plato).map(l => ({ id_plato: Number(l.id_plato), cantidad: Number(l.cantidad) }));
    if (!detalles.length) return notify('error', 'Agregue al menos un plato al pedido');
    const payload = {
      id_mesa: Number(head.id_mesa), id_empleado: Number(head.id_empleado),
      id_cliente: head.id_cliente ? Number(head.id_cliente) : null, detalles
    };
    setSaving(true);
    try {
      await request('/pedidos' + (editing ? '/' + pedido.id_pedido : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      notify('ok', editing ? 'Pedido actualizado' : 'Pedido registrado');
      onSaved();
    } catch (err) { notify('error', err.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="modal wide" onSubmit={submit}>
        <div className="modal-head">
          <div><div className="eyebrow">{editing ? `EDITAR PEDIDO #${pedido.id_pedido}` : 'NUEVO'}</div><h2>{editing ? 'Modificar pedido' : 'Registrar pedido'}</h2></div>
          <button type="button" className="icon-btn" onClick={onClose}><X /></button>
        </div>
        <div className="form-grid">
          <label>Mesa
            <select required value={head.id_mesa} onChange={e => setHead({ ...head, id_mesa: e.target.value })}>
              <option value="">Seleccionar...</option>
              {(lookups.mesas || []).filter(m => m.estado !== 'fuera de servicio' || m.id_mesa === head.id_mesa)
                .map(m => <option key={m.id_mesa} value={m.id_mesa}>Mesa {m.numero} · {m.estado}</option>)}
            </select>
          </label>
          <label>Empleado
            <select required value={head.id_empleado} onChange={e => setHead({ ...head, id_empleado: e.target.value })}>
              <option value="">Seleccionar...</option>
              {(lookups.empleados || []).filter(x => x.activo || x.id_empleado === head.id_empleado)
                .map(x => <option key={x.id_empleado} value={x.id_empleado}>{x.nombre} · {x.cargo}</option>)}
            </select>
          </label>
          <label className="full">Cliente (opcional)
            <select value={head.id_cliente ?? ''} onChange={e => setHead({ ...head, id_cliente: e.target.value })}>
              <option value="">Sin cliente</option>
              {(lookups.clientes || []).map(c => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>)}
            </select>
          </label>
        </div>

        <div className="lines-title">Platos del pedido</div>
        <div className="lines">
          {lines.map((l, i) => (
            <div className="line-row" key={i}>
              <select value={l.id_plato} onChange={e => setLine(i, { id_plato: e.target.value, precio: undefined })}>
                <option value="">Seleccionar plato...</option>
                {opcionesPlato.map(p => (
                  <option key={p.id_plato} value={p.id_plato} disabled={enPedido.has(p.id_plato) && Number(l.id_plato) !== p.id_plato}>
                    {p.nombre} — {money(p.precio)}
                  </option>
                ))}
              </select>
              <input type="number" min="1" step="1" value={l.cantidad} onChange={e => setLine(i, { cantidad: e.target.value })} aria-label="Cantidad" />
              <span className="line-sub">{money(l.id_plato ? precioDe(l) * (Number(l.cantidad) || 0) : 0)}</span>
              <button type="button" className="action-btn danger" title="Quitar plato" disabled={lines.length === 1}
                onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="secondary-btn" onClick={() => setLines(ls => [...ls, { id_plato: '', cantidad: 1 }])}><Plus size={13} /> Agregar plato</button>

        <div className="order-total"><span>Total estimado</span><strong>{money(total)}</strong></div>
        <p className="hint">El total definitivo lo calcula el servidor con los precios vigentes (los platos ya incluidos conservan su precio original).</p>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button>
          <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar pedido'}</button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------- Módulo ------------------------- */
export default function Pedidos({ lookups, notify, reloadLookups }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fecha: '', id_mesa: '', estado: '' });
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(null);    // { pedido|null }
  const [detalle, setDetalle] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await request('/pedidos' + qs(filters))); }
    catch (e) { notify('error', e.message); }
    finally { setLoading(false); }
  }, [filters, notify]);
  useEffect(() => { load(); }, [load, tick]);

  const refresh = () => { setTick(t => t + 1); reloadLookups(); };
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const abrirDetalle = async id => { try { setDetalle(await request('/pedidos/' + id)); } catch (e) { notify('error', e.message); } };
  const abrirEditar = async id => { try { setForm({ pedido: await request('/pedidos/' + id) }); } catch (e) { notify('error', e.message); } };

  const avanzar = async (p, estado) => {
    try { await request(`/pedidos/${p.id_pedido}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }); notify('ok', `Pedido #${p.id_pedido}: ${estado}`); refresh(); }
    catch (e) { notify('error', e.message); }
  };
  const anular = async p => {
    if (!confirm(`¿Anular el pedido #${p.id_pedido}? Se conserva en el historial.`)) return;
    avanzar(p, 'anulado');
  };

  const sinFiltros = !filters.fecha && !filters.id_mesa && !filters.estado;
  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow">ADMINISTRACIÓN</div><h1>Pedidos</h1><p>Registra pedidos, sigue su estado y consulta el total de cada mesa.</p></div>
        <button className="primary-btn" onClick={() => setForm({ pedido: null })}><Plus size={17} /> Nuevo pedido</button>
      </div>

      <TotalesMesa refreshKey={tick} mesaSel={filters.id_mesa} onSelect={v => setFilter('id_mesa', v)} />

      <div className="panel table-panel">
        <div className="table-toolbar">
          <div><h3>Listado de pedidos</h3><p>{rows.length} registros encontrados</p></div>
          <button className="icon-btn" onClick={refresh} title="Actualizar"><RefreshCw size={17} /></button>
        </div>
        <div className="filter-bar">
          <label>Fecha<input type="date" value={filters.fecha} onChange={e => setFilter('fecha', e.target.value)} /></label>
          <label>Mesa
            <select value={filters.id_mesa} onChange={e => setFilter('id_mesa', e.target.value)}>
              <option value="">Todas</option>
              {(lookups.mesas || []).map(m => <option key={m.id_mesa} value={m.id_mesa}>Mesa {m.numero}</option>)}
            </select>
          </label>
          <label>Estado
            <select value={filters.estado} onChange={e => setFilter('estado', e.target.value)}>
              <option value="">Todos</option>
              {PEDIDO_ESTADOS.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <button type="button" className="secondary-btn" disabled={sinFiltros} onClick={() => setFilters({ fecha: '', id_mesa: '', estado: '' })}>Limpiar filtros</button>
        </div>

        {loading ? <div className="empty">Cargando información...</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Mesa</th><th>Empleado</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead>
              <tbody>{rows.map(p => (
                <tr key={p.id_pedido}>
                  <td>{p.id_pedido}</td><td>{p.mesa}</td><td>{p.empleado}</td><td>{p.cliente || '—'}</td>
                  <td>{fmtDateTime(p.fecha_hora)}</td><td><Pill estado={p.estado} /></td><td>{money(p.total)}</td>
                  <td><div className="row-actions">
                    <button className="action-btn" title="Ver detalle" onClick={() => abrirDetalle(p.id_pedido)}><Eye size={16} /></button>
                    {SIGUIENTE[p.estado] && <button className="action-btn advance" title={`Pasar a "${SIGUIENTE[p.estado]}"`} onClick={() => avanzar(p, SIGUIENTE[p.estado])}><ArrowRight size={16} /></button>}
                    {p.estado === 'pendiente' && <button className="action-btn" title="Editar" onClick={() => abrirEditar(p.id_pedido)}><Pencil size={16} /></button>}
                    {SIGUIENTE[p.estado] && <button className="action-btn danger" title="Anular" onClick={() => anular(p)}><Ban size={16} /></button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            {!rows.length && <div className="empty">No hay pedidos para mostrar.</div>}
          </div>
        )}
      </div>

      {form && <PedidoForm pedido={form.pedido} lookups={lookups} notify={notify} onClose={() => setForm(null)}
        onSaved={() => { setForm(null); refresh(); }} />}
      {detalle && <DetalleModal pedido={detalle} onClose={() => setDetalle(null)} />}
    </>
  );
}
