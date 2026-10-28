import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import Today from './pages/Today';
import Briefing from './pages/Briefing';
import Review from './pages/Review';
import Execute from './pages/Execute';
import Checkout from './pages/Checkout';
import History from './pages/History';
import WodDetail from './pages/WodDetail';
import Import from './pages/Import';
import Library from './pages/Library';
import ExerciseDetail from './pages/ExerciseDetail';
import Equipment from './pages/Equipment';
import Progress from './pages/Progress';
import CalendarPage from './pages/Calendar';
import Official from './pages/Official';
import Data from './pages/Data';
import More from './pages/More';

const NAV = [
  { to: '/', label: 'Hoje', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { to: '/treinar', label: 'Treinar', icon: 'M4 12h16M2 9v6M22 9v6M6 7v10M18 7v10' },
  { to: '/historico', label: 'Histórico', icon: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/evolucao', label: 'Evolução', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { to: '/mais', label: 'Mais', icon: 'M4 6h16M4 12h16M4 18h16' },
];

function BottomNav() {
  const active = useLiveQuery(() => db.session.get('active'), []);
  const loc = useLocation();
  if (loc.pathname.startsWith('/executar')) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink-900/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {active && (
        <NavLink to="/executar" className="block bg-petrol-600 px-4 py-2 text-center text-sm font-semibold text-ink-950">
          Treino em andamento — toque para continuar
        </NavLink>
      )}
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${isActive ? 'text-petrol-300' : 'text-bone-400'}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={n.icon} /></svg>
            {n.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/treinar" element={<Briefing />} />
        <Route path="/revisar/:id" element={<Review />} />
        <Route path="/executar" element={<Execute />} />
        <Route path="/checkout/:id" element={<Checkout />} />
        <Route path="/historico" element={<History />} />
        <Route path="/historico/wod/:id" element={<WodDetail />} />
        <Route path="/importar" element={<Import />} />
        <Route path="/biblioteca" element={<Library />} />
        <Route path="/biblioteca/:id" element={<ExerciseDetail />} />
        <Route path="/equipamentos" element={<Equipment />} />
        <Route path="/evolucao" element={<Progress />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/fontes" element={<Official />} />
        <Route path="/dados" element={<Data />} />
        <Route path="/mais" element={<More />} />
        <Route path="*" element={<Today />} />
      </Routes>
      <BottomNav />
    </>
  );
}
