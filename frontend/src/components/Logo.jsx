import React from 'react';

// Mesa vista desde arriba (círculo + 4 sillas) con marca de verificación. Azul oscuro base, verde azulado de acento.
export default function Logo({ size = 42 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="MesaLista">
      <rect width="48" height="48" rx="12" fill="#0F6B78" />
      <g fill="#F4A261">
        <circle cx="24" cy="6.5" r="3" /><circle cx="24" cy="41.5" r="3" />
        <circle cx="6.5" cy="24" r="3" /><circle cx="41.5" cy="24" r="3" />
      </g>
      <circle cx="24" cy="24" r="12.5" fill="#F7F5EF" />
      <path d="M18.5 24.5l4.2 4.2 7-8.2" fill="none" stroke="#17365D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
