import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Utensils, Tags, Armchair, ClipboardList, Users, CalendarDays, UserRound, ChefHat, Menu, X } from 'lucide-react';
import { request } from './api.js';
import { money } from './utils.js';
import Logo from './components/Logo.jsx';
import CrudModule from './components/CrudModule.jsx';
import Pedidos from './components/Pedidos.jsx';

const modules = [
  { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { key: 'platos', label: 'Platos', icon: Utensils },
  { key: 'categorias', label: 'Categorías', icon: Tags },
  { key: 'mesas', label: 'Mesas', icon: Armchair },
  { key: 'pedidos', label: 'Pedidos', icon: ClipboardList },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'reservas', label: 'Reservas', icon: CalendarDays },
  { key: 'empleados', label: 'Empleados', icon: UserRound }
];
const LOOKUP_NAMES = ['categorias', 'clientes', 'mesas', 'empleados', 'platos'];

function Stat({ icon: Icon, label, value, tint }) {
  return <div className="stat-card"><div className={'stat-icon ' + tint}><Icon size={21} /></div><div><span>{label}</span><strong>{value}</strong></div><div className="stat-decoration" /></div>;
}

function Dashboard({ setActive, notify }) {
  const [stats, setStats] = useState({});
  useEffect(() => { request('/dashboard').then(setStats).catch(e => notify('error', e.message)); }, [notify]);
  return (
    <>
      <div className="welcome"><div><div className="eyebrow">PANEL DE CONTROL</div><h1>¡Bienvenido a MesaLista!</h1><p>Administra tu restaurante desde un solo lugar.</p></div>
        <div className="date-chip">{new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
      <div className="stats-grid">
        <Stat icon={Utensils} label="Platos registrados" value={stats.platos ?? '—'} tint="blue" />
        <Stat icon={Armchair} label="Mesas disponibles" value={stats.mesas ?? '—'} tint="teal" />
        <Stat icon={ClipboardList} label="Pedidos activos" value={stats.pedidos ?? '—'} tint="orange" />
        <Stat icon={ChefHat} label="Ventas de hoy" value={money(stats.ventas)} tint="purple" />
      </div>
      <div className="dashboard-grid">
        <div className="panel quick-panel"><div className="panel-heading"><div><h3>Accesos rápidos</h3><p>Accede a los módulos principales</p></div></div>
          <div className="quick-grid">{modules.filter(m => m.key !== 'dashboard').map(m => <button key={m.key} className="quick-link" onClick={() => setActive(m.key)}><m.icon /><span>{m.label}</span><b>→</b></button>)}</div></div>
        <div className="panel info-panel"><div className="panel-heading"><div><h3>Flujo de pedidos</h3><p>Estados del servicio</p></div></div>
          <div className="flow">
            <div><span className="flow-number one">01</span><section><b>Pendiente</b><small>Pedido registrado</small></section></div><div className="flow-line" />
            <div><span className="flow-number two">02</span><section><b>En cocina</b><small>En preparación</small></section></div><div className="flow-line" />
            <div><span className="flow-number three">03</span><section><b>Entregado</b><small>Servicio completado</small></section></div>
          </div></div>
      </div>
      <div className="footer-note">MesaLista · Organización, control y buen servicio.</div>
    </>
  );
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState(null);   // { type: 'ok' | 'error', text }
  const [lookups, setLookups] = useState({});
  const [online, setOnline] = useState(true);

  const notify = useCallback((type, text) => setNotice({ type, text }), []);
  useEffect(() => { if (notice?.type === 'ok') { const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); } }, [notice]);

  const reloadLookups = useCallback(async () => {
    const res = await Promise.all(LOOKUP_NAMES.map(n => request('/' + n).catch(() => null)));
    setOnline(res.every(r => r !== null));
    setLookups(Object.fromEntries(LOOKUP_NAMES.map((n, i) => [n, res[i] || []])));
  }, []);
  useEffect(() => { reloadLookups(); }, [reloadLookups]);

  const title = modules.find(m => m.key === active)?.label || 'Resumen';
  const go = key => { setActive(key); setMobile(false); setNotice(null); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'show' : ''}`}>
        <div className="brand"><Logo /><div><b>MesaLista</b><small>GESTIÓN RESTAURANTE</small></div><button className="mobile-close" onClick={() => setMobile(false)}><X /></button></div>
        <div className="nav-caption">MENÚ PRINCIPAL</div>
        <nav>{modules.map(m => <button key={m.key} className={active === m.key ? 'nav-item active' : 'nav-item'} onClick={() => go(m.key)}><m.icon size={18} /><span>{m.label}</span>{m.key === 'pedidos' && <i />}</button>)}</nav>
        <div className="sidebar-bottom"><div className={'status-dot' + (online ? '' : ' off')} /> {online ? 'Sistema conectado' : 'Sin conexión con la API'} <small>v1.1.0</small></div>
      </aside>
      <main className="main">
        <header className="topbar"><button className="hamburger" onClick={() => setMobile(true)}><Menu /></button><div className="crumb">MesaLista <span>/</span> {title}</div>
          <div className="top-right"><span className="online"><i className={online ? '' : 'off'} /> {online ? 'En línea' : 'Sin conexión'}</span><div className="avatar">ML</div></div></header>
        <section className="content">
          {notice && <div className={'notice ' + notice.type} role="alert" onClick={() => setNotice(null)}>{notice.text}<button>×</button></div>}
          {active === 'dashboard' ? <Dashboard setActive={go} notify={notify} />
            : active === 'pedidos' ? <Pedidos lookups={lookups} notify={notify} reloadLookups={reloadLookups} />
            : <CrudModule key={active} name={active} lookups={lookups} notify={notify} reloadLookups={reloadLookups} />}
        </section>
      </main>
    </div>
  );
}
