import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { db } from './db/db';
import { ensureSeeded } from './db/repo';
import './index.css';

const HOSTED = !!import.meta.env.VITE_HOSTED;

if (!HOSTED) {
  import('virtual:pwa-register').then((m) => m.registerSW({ immediate: true })).catch(() => { /* sem service worker */ });
}

function StorageBlocked() {
  return (
    <div className="mx-auto max-w-xl p-6 text-bone-100">
      <h1 className="h1">CG Performance</h1>
      <p className="mt-3">Este navegador não permitiu salvar dados neste site (janela anônima ou armazenamento bloqueado).</p>
      <p className="mt-2 text-bone-400">Abra o link numa janela normal do Chrome, Safari ou Edge e tente de novo. Seus treinos ficam salvos só neste aparelho.</p>
    </div>
  );
}

async function boot() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  try {
    await db.open();
  } catch (e) {
    console.error('IndexedDB indisponível', e);
    root.render(<StorageBlocked />);
    return;
  }
  await ensureSeeded().catch((e) => console.error('Falha ao preparar dados iniciais', e));
  // Na versão hospedada o endereço da página não é "/", então a navegação fica em memória.
  const Router = HOSTED ? MemoryRouter : BrowserRouter;
  root.render(
    <React.StrictMode>
      <Router>
        <App />
      </Router>
    </React.StrictMode>,
  );
}

void boot();
