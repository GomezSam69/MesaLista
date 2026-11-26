const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function request(url, options = {}) {
  let r;
  try {
    r = await fetch(API + url, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifique que la API esté en ejecución.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || 'No fue posible completar la operación');
  return data;
}

// Construye "?a=1&b=2" omitiendo los valores vacíos
export const qs = obj => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
};
