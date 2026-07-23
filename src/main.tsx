import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabase } from './lib/supabase';
import { pullRemoteToLocalStorage } from './services/cloudSync';
import { runVersionMigration } from './services/versionMigration';

function showVersionUpdateNoticeThenReload(): void {
  const notice = document.createElement('div');
  notice.setAttribute('role', 'status');
  notice.textContent = 'Updating NOVO to the latest version…';
  notice.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(15,23,42,0.72)',
    'color:#fff',
    'font:500 15px/1.4 system-ui,sans-serif',
    'letter-spacing:0.01em',
    'padding:1.5rem',
    'text-align:center',
  ].join(';');
  document.body.appendChild(notice);
  window.setTimeout(() => {
    window.location.reload();
  }, 1600);
}

const migrationResult = runVersionMigration();
if (migrationResult === 'migrated') {
  showVersionUpdateNoticeThenReload();
} else {
  bootstrapApp();
}

async function bootstrapApp() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user?.id) {
    try {
      await pullRemoteToLocalStorage(session.user.id);
    } catch (err) {
      console.error('NOVO cloud restore failed:', err);
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
