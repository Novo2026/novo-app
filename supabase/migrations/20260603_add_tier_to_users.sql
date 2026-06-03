-- Add tier fields to public.users table
alter table public.users
  add column if not exists tier text not null default 'free',
  add column if not exists access_code text,
  add column if not exists tier_activated_at timestamptz,
  add column if not exists tier_expires_at timestamptz;

comment on column public.users.tier is 'free or pro';
comment on column public.users.access_code is 'The code used to activate pro';
comment on column public.users.tier_activated_at is 'When pro was activated';
comment on column public.users.tier_expires_at is 'When pro expires, null = permanent';
