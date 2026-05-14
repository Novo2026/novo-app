import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://txxgvxuuoftqmlrwtplm.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGd2eHV1b2Z0cW1scnd0cGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTA5NzksImV4cCI6MjA5NDM2Njk3OX0.aRKrphpZRuH607FmBFGctWgBET7n5Iix-oCv7iOO1S0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
