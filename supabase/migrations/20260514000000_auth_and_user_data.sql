-- NOVO app: public profile + key/value cloud sync with RLS

-- ---------------------------------------------------------------------------
-- public.users (profile linked to auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  state text,
  is_ohio boolean not null default false
);

comment on table public.users is 'App user profile; id matches auth.users';

-- ---------------------------------------------------------------------------
-- public.user_data (one row per localStorage key per user)
-- ---------------------------------------------------------------------------
create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  data_key text not null,
  data_value text,
  updated_at timestamptz not null default now(),
  unique (user_id, data_key)
);

create index if not exists user_data_user_id_idx on public.user_data (user_id);

-- ---------------------------------------------------------------------------
-- Trigger: create public.users when a new auth user is created
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep email in sync if it changes in auth
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute procedure public.handle_user_email_update();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.user_data enable row level security;

-- public.users policies
drop policy if exists "Users select own profile" on public.users;
create policy "Users select own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.users;
create policy "Users insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- public.user_data policies
drop policy if exists "Users select own data" on public.user_data;
create policy "Users select own data"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own data" on public.user_data;
create policy "Users insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own data" on public.user_data;
create policy "Users update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own data" on public.user_data;
create policy "Users delete own data"
  on public.user_data for delete
  using (auth.uid() = user_id);
