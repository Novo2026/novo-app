import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabase } from './lib/supabase';
import { pullRemoteToLocalStorage } from './services/cloudSync';

async function restoreCloudDataBeforeApp() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  try {
    await pullRemoteToLocalStorage(session.user.id);
  } catch (err) {
    console.error('NOVO cloud restore failed:', err);
  }
}

restoreCloudDataBeforeApp().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
