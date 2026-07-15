-- Per-user daily Ask NOVO / NovoChat message usage tracking

create table if not exists public.novo_chat_daily_usage (
  user_id uuid not null references public.users (id) on delete cascade,
  usage_date date not null,
  message_count integer not null default 0 check (message_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

comment on table public.novo_chat_daily_usage is
  'Tracks Ask NOVO messages per user per UTC day for cost/abuse caps';

alter table public.novo_chat_daily_usage enable row level security;

-- Users can read their own usage (optional UI); writes go through the RPC below.
drop policy if exists "Users select own chat usage" on public.novo_chat_daily_usage;
create policy "Users select own chat usage"
  on public.novo_chat_daily_usage for select
  using (auth.uid() = user_id);

-- Atomically consume one message against the daily cap.
-- Returns { ok, count, limit } or { ok: false, error: 'limit_exceeded'|'unauthenticated', ... }.
create or replace function public.try_consume_novo_chat_message(p_daily_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d date := (timezone('utc', now()))::date;
  new_count integer;
  current_count integer;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if p_daily_limit is null or p_daily_limit < 1 then
    p_daily_limit := 100;
  end if;

  insert into public.novo_chat_daily_usage (user_id, usage_date, message_count, updated_at)
  values (uid, d, 1, now())
  on conflict (user_id, usage_date)
  do update
    set message_count = public.novo_chat_daily_usage.message_count + 1,
        updated_at = now()
  where public.novo_chat_daily_usage.message_count < p_daily_limit
  returning message_count into new_count;

  if new_count is not null then
    return jsonb_build_object(
      'ok', true,
      'count', new_count,
      'limit', p_daily_limit
    );
  end if;

  select message_count into current_count
  from public.novo_chat_daily_usage
  where user_id = uid and usage_date = d;

  return jsonb_build_object(
    'ok', false,
    'error', 'limit_exceeded',
    'count', coalesce(current_count, p_daily_limit),
    'limit', p_daily_limit
  );
end;
$$;

revoke all on function public.try_consume_novo_chat_message(integer) from public;
grant execute on function public.try_consume_novo_chat_message(integer) to authenticated;
grant execute on function public.try_consume_novo_chat_message(integer) to service_role;
