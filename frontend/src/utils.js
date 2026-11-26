export const money = n =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0));

// La API entrega "AAAA-MM-DD HH:mm:ss" (sin zona horaria); aquí se evita new Date() para no desplazar horas.
export const toInputDateTime = s => (s ? String(s).replace(' ', 'T').slice(0, 16) : '');

export const fmtDateTime = s => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—';
};

export const todayISO = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local
export const slug = s => String(s ?? '').replaceAll(' ', '-');
