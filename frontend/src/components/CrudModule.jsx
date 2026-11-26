import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, Trash2, Pencil, X } from 'lucide-react';
import { request, qs } from '../api.js';
import { MODULES } from '../config.js';
import { money, fmtDateTime, toInputDateTime, slug } from '../utils.js';
import Field, { FilterBar } from './Field.jsx';

const NUMERIC = ['precio', 'capacidad', 'personas', 'id_categoria', 'id_cliente', 'id_mesa'];

function defaultsFor(cfg) {
  const d = {};
  for (const [key, , type] of cfg.fields) {
    if (type === 'boolean') d[key] = true;
    else if (type.startsWith('select:')) d[key] = type.slice(7).split(',')[0];
  }
  return d;
}

function renderCell(row, [key, , fmt]) {
  const v = row[key];
  if (fmt === 'money') return money(v);
  if (fmt === 'bool') return v ? 'Sí' : 'No';
  if (fmt === 'datetime') return fmtDateTime(v);
  if (fmt === 'pill') return <span className={'pill ' + slug(v)}>{v}</span>;
  return v ?? '—';
}

export default function CrudModule({ name, lookups, notify, reloadLookups }) {
  const cfg = MODULES[name];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { editing: row|null, form }

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await request('/' + name + qs(filters))); }
    catch (e) { notify('error', e.message); }
    finally { setLoading(false); }
  }, [name, filters, notify]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(t)) : rows;
  }, [rows, search]);

  const openNew = () => setModal({ editing: null, form: defaultsFor(cfg) });
  const openEdit = row => {
    const form = { ...row };
    for (const [key, , type] of cfg.fields) {
      if (type === 'boolean') form[key] = !!row[key];
      if (type === 'datetime-local') form[key] = toInputDateTime(row[key]);
    }
    setModal({ editing: row, form });
  };
  const setField = (k, v) => setModal(m => ({ ...m, form: { ...m.form, [k]: v } }));

  const save = async e => {
    e.preventDefault();
    const payload = {};
    for (const [key] of cfg.fields) {
      let v = modal.form[key];
      if (NUMERIC.includes(key) && v !== '' && v != null) v = Number(v);
      payload[key] = v;
    }
    try {
      const url = '/' + name + (modal.editing ? '/' + modal.editing[cfg.id] : '');
      await request(url, { method: modal.editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setModal(null);
      notify('ok', 'Registro guardado correctamente');
      load(); reloadLookups();
    } catch (err) { notify('error', err.message); }
  };

  const remove = async row => {
    if (!confirm(`¿Está seguro de eliminar este ${cfg.singular}?`)) return;
    try {
      await request('/' + name + '/' + row[cfg.id], { method: 'DELETE' });
      notify('ok', 'Registro eliminado');
      load(); reloadLookups();
    } catch (err) { notify('error', err.message); } // p. ej. "tiene 3 platos asociados"
  };

  const lower = cfg.title.toLowerCase();
  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow">ADMINISTRACIÓN</div><h1>{cfg.title}</h1><p>Gestiona y consulta la información de {lower}.</p></div>
        <button className="primary-btn" onClick={openNew}><Plus size={17} /> Nuevo registro</button>
      </div>

      <div className="panel table-panel">
        <div className="table-toolbar">
          <div><h3>Listado de {lower}</h3><p>{visible.length} registros encontrados</p></div>
          <div className="toolbar-actions">
            <div className="search-box"><Search size={17} /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <button className="icon-btn" onClick={load} title="Actualizar"><RefreshCw size={17} /></button>
          </div>
        </div>
        <FilterBar defs={cfg.filters} values={filters} lookups={lookups}
          onChange={(k, v) => setFilters(f => ({ ...f, [k]: v }))} onClear={() => setFilters({})} />

        {loading ? <div className="empty">Cargando información...</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr>{cfg.columns.map(c => <th key={c[0]}>{c[1]}</th>)}<th>Acciones</th></tr></thead>
              <tbody>
                {visible.map(row => (
                  <tr key={row[cfg.id]}>
                    {cfg.columns.map(c => <td key={c[0]}>{renderCell(row, c)}</td>)}
                    <td><div className="row-actions">
                      <button className="action-btn" onClick={() => openEdit(row)} title="Editar"><Pencil size={16} /></button>
                      <button className="action-btn danger" onClick={() => remove(row)} title="Eliminar"><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && <div className="empty">No hay registros para mostrar.</div>}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(null)}>
          <form className="modal" onSubmit={save}>
            <div className="modal-head">
              <div><div className="eyebrow">{modal.editing ? 'ACTUALIZAR' : 'NUEVO'}</div><h2>{modal.editing ? 'Editar' : 'Registrar'} {cfg.singular}</h2></div>
              <button type="button" className="icon-btn" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="form-grid">
              {cfg.fields.map(f => <Field key={f[0]} field={f} value={modal.form[f[0]]} onChange={setField} lookups={lookups} />)}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="primary-btn" type="submit">Guardar registro</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
