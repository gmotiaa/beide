-- Cloud backup of per-workspace chat transcripts (write-through from the
-- renderer's saveSnapshot). Owner-only via RLS; the workspace is identified
-- by a client-side hash of its root path, so paths never reach the server.

create table if not exists public.chat_sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_key text not null,
  id text not null,
  title text not null default 'New chat',
  mode text not null default 'agent',
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_key, id),
  constraint chat_sessions_id_len check (char_length(id) <= 128),
  constraint chat_sessions_key_len check (char_length(workspace_key) <= 64),
  constraint chat_sessions_title_len check (char_length(title) <= 200)
);

alter table public.chat_sessions enable row level security;

drop policy if exists chat_sessions_own on public.chat_sessions;
create policy chat_sessions_own on public.chat_sessions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.chat_sessions from public, anon;
grant select, insert, update, delete on table public.chat_sessions to authenticated;
