import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabase } from './lib/supabase';
import { pullRemoteToLocalStorage } from './services/cloudSync';
import { runVersionMigration } from './services/versionMigration';

const migrationResult = runVersionMigration();
if (migrationResult === 'migrated') {
  window.location.reload();
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
