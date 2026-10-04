do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'password_hash') then
    create schema if not exists legacy;
    alter table if exists public.records set schema legacy;
    alter table if exists public.user_settings set schema legacy;
    alter table if exists public.sessions set schema legacy;
    alter table public.users set schema legacy;
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  auth_hash text not null,
  recovery_hash text not null,
  wrapped_key text not null,
  wrapped_key_recovery text not null,
  kdf jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists sessions_user_id on sessions(user_id);

create table if not exists records (
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  id text not null,
  data jsonb not null,
  primary key (user_id, kind, id)
);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  data jsonb not null
);

alter table users drop column if exists failed_logins;
alter table users drop column if exists locked_until;

create table if not exists attempts (
  scope text not null,
  key text not null,
  failures integer not null,
  window_start timestamptz not null,
  primary key (scope, key)
);
