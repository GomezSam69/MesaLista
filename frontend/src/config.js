import { money } from './utils.js';

export const MESA_ESTADOS = ['disponible', 'ocupada', 'fuera de servicio'];
export const RESERVA_ESTADOS = ['pendiente', 'confirmada', 'cancelada', 'atendida'];
export const PEDIDO_ESTADOS = ['pendiente', 'en cocina', 'entregado', 'anulado'];

// Listas de apoyo que se cargan una vez y alimentan los <select>
export const LOOKUPS = {
  categorias: { id: 'id_categoria', label: r => r.nombre },
  clientes: { id: 'id_cliente', label: r => r.nombre },
  mesas: { id: 'id_mesa', label: r => `Mesa ${r.numero} (${r.capacidad} pers.)` },
  empleados: { id: 'id_empleado', label: r => `${r.nombre} · ${r.cargo}` },
  platos: { id: 'id_plato', label: r => `${r.nombre} — ${money(r.precio)}` }
};

/*
 * fields:  [clave, etiqueta, tipo]  tipo: text | email | number | datetime-local | boolean | select:a,b | lookup:nombre
 * columns: [clave, etiqueta, formato] formato: money | bool | datetime | pill | (texto)
 * filters: filtros que se envían a la API (query string)
 */
export const MODULES = {
  platos: {
    title: 'Platos', singular: 'plato', id: 'id_plato',
    fields: [['nombre', 'Nombre', 'text'], ['descripcion', 'Descripción', 'text'], ['id_categoria', 'Categoría', 'lookup:categorias'], ['precio', 'Precio (COP)', 'number'], ['disponible', 'Disponible', 'boolean']],
    columns: [['nombre', 'Nombre'], ['descripcion', 'Descripción'], ['categoria', 'Categoría'], ['precio', 'Precio', 'money'], ['disponible', 'Disponible', 'bool']],
    filters: [['id_categoria', 'Categoría', 'lookup:categorias'], ['disponible', 'Disponibilidad', 'bool']]
  },
  categorias: {
    title: 'Categorías', singular: 'categoría', id: 'id_categoria',
    fields: [['nombre', 'Nombre', 'text'], ['descripcion', 'Descripción', 'text'], ['activa', 'Activa', 'boolean']],
    columns: [['nombre', 'Nombre'], ['descripcion', 'Descripción'], ['total_platos', 'Platos asociados'], ['activa', 'Activa', 'bool']],
    filters: []
  },
  mesas: {
    title: 'Mesas', singular: 'mesa', id: 'id_mesa',
    fields: [['numero', 'Número / código', 'text'], ['capacidad', 'Capacidad', 'number'], ['estado', 'Estado', 'select:' + MESA_ESTADOS.join(',')]],
    columns: [['numero', 'Mesa'], ['capacidad', 'Capacidad'], ['estado', 'Estado', 'pill']],
    filters: [['estado', 'Estado', 'select:' + MESA_ESTADOS.join(',')]]
  },
  empleados: {
    title: 'Empleados', singular: 'empleado', id: 'id_empleado',
    fields: [['nombre', 'Nombre', 'text'], ['telefono', 'Teléfono', 'text'], ['correo', 'Correo', 'email'], ['cargo', 'Cargo', 'text'], ['activo', 'Activo', 'boolean']],
    columns: [['nombre', 'Nombre'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['cargo', 'Cargo'], ['activo', 'Activo', 'bool']],
    filters: [['activo', 'Estado laboral', 'bool']]
  },
  clientes: {
    title: 'Clientes', singular: 'cliente', id: 'id_cliente',
    fields: [['nombre', 'Nombre', 'text'], ['telefono', 'Teléfono', 'text'], ['correo', 'Correo', 'email']],
    columns: [['nombre', 'Nombre'], ['telefono', 'Teléfono'], ['correo', 'Correo']],
    filters: []
  },
  reservas: {
    title: 'Reservas', singular: 'reserva', id: 'id_reserva',
    fields: [['id_cliente', 'Cliente', 'lookup:clientes'], ['id_mesa', 'Mesa', 'lookup:mesas'], ['fecha_hora', 'Fecha y hora', 'datetime-local'], ['personas', 'Personas', 'number'], ['estado', 'Estado', 'select:' + RESERVA_ESTADOS.join(',')]],
    columns: [['cliente', 'Cliente'], ['mesa', 'Mesa'], ['fecha_hora', 'Fecha y hora', 'datetime'], ['personas', 'Personas'], ['estado', 'Estado', 'pill']],
    filters: [['fecha', 'Fecha', 'date'], ['estado', 'Estado', 'select:' + RESERVA_ESTADOS.join(',')], ['id_mesa', 'Mesa', 'lookup:mesas']]
  }
};
