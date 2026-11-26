import React from 'react';
import { LOOKUPS } from '../config.js';

// Campo de formulario genérico según el tipo declarado en config.js
export default function Field({ field, value, onChange, lookups }) {
  const [key, label, type] = field;
  const set = v => onChange(key, v);
  const required = type !== 'boolean' && !['descripcion', 'telefono', 'correo'].includes(key);
  let control;
  if (type === 'boolean') {
    control = <select value={value ? '1' : '0'} onChange={e => set(e.target.value === '1')}><option value="1">Sí</option><option value="0">No</option></select>;
  } else if (type.startsWith('select:')) {
    control = <select value={value ?? ''} onChange={e => set(e.target.value)}>{type.slice(7).split(',').map(x => <option key={x}>{x}</option>)}</select>;
  } else if (type.startsWith('lookup:')) {
    const name = type.slice(7), lk = LOOKUPS[name];
    control = (
      <select required value={value ?? ''} onChange={e => set(e.target.value)}>
        <option value="">Seleccionar...</option>
        {(lookups[name] || []).map(r => <option key={r[lk.id]} value={r[lk.id]}>{lk.label(r)}</option>)}
      </select>
    );
  } else {
    const num = type === 'number';
    control = (
      <input required={required} type={type} value={value ?? ''} onChange={e => set(e.target.value)}
        min={num ? (key === 'precio' ? '0' : '1') : undefined} step={num ? (key === 'precio' ? '100' : '1') : undefined} />
    );
  }
  return <label className={key === 'descripcion' ? 'full' : ''}>{label}{control}</label>;
}

export function FilterBar({ defs, values, onChange, lookups, onClear }) {
  if (!defs.length) return null;
  return (
    <div className="filter-bar">
      {defs.map(([key, label, type]) => (
        <label key={key}>{label}
          {type === 'date' ? <input type="date" value={values[key] || ''} onChange={e => onChange(key, e.target.value)} />
            : <select value={values[key] ?? ''} onChange={e => onChange(key, e.target.value)}>
                <option value="">Todos</option>
                {type === 'bool' && <><option value="1">Sí</option><option value="0">No</option></>}
                {type.startsWith('select:') && type.slice(7).split(',').map(x => <option key={x}>{x}</option>)}
                {type.startsWith('lookup:') && (lookups[type.slice(7)] || []).map(r => {
                  const lk = LOOKUPS[type.slice(7)];
                  return <option key={r[lk.id]} value={r[lk.id]}>{lk.label(r)}</option>;
                })}
              </select>}
        </label>
      ))}
      <button type="button" className="secondary-btn" onClick={onClear}>Limpiar filtros</button>
    </div>
  );
}
