-- Roles (ticket 15; 16 and 17 build on it): the author as the admin, the leaders of a faction on a server,
-- the players' requests to be one. A signed-in player publishes a card of theirs — their name, the game name and
-- the position they gave, their server and faction — so the admin can find them (and, with ticket 16, their
-- leader can list them). Everyone reads and writes only their own, the admin everything.

-- The admin: the owner adds themselves once, by their account's id (Authentication → Users):
--   insert into public.admins (user_id) values ('<your id>');
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  game_name text check (char_length(game_name) <= 40),
  position text check (char_length(position) <= 60),
  server text check (char_length(server) <= 30),
  organization text check (char_length(organization) <= 30),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  server text not null,
  organization text not null,
  role text not null check (role in ('leader', 'deputy')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, server, organization)
);

create table if not exists public.leader_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  server text not null check (char_length(server) <= 30),
  organization text not null check (char_length(organization) <= 30),
  note text check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
-- One request waiting at a time.
create unique index if not exists leader_requests_one_pending on public.leader_requests (user_id) where status = 'pending';

alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.leader_requests enable row level security;

drop policy if exists "admins: own row" on public.admins;
create policy "admins: own row" on public.admins for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "profiles: read own or admin" on public.profiles;
drop policy if exists "profiles: add own" on public.profiles;
drop policy if exists "profiles: change own" on public.profiles;
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "profiles: add own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: change own" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "roles: read own or admin" on public.roles;
drop policy if exists "roles: admin gives" on public.roles;
drop policy if exists "roles: admin changes" on public.roles;
drop policy if exists "roles: admin takes" on public.roles;
create policy "roles: read own or admin" on public.roles for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "roles: admin gives" on public.roles for insert to authenticated with check ((select public.is_admin()));
create policy "roles: admin changes" on public.roles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "roles: admin takes" on public.roles for delete to authenticated using ((select public.is_admin()));

drop policy if exists "requests: read own or admin" on public.leader_requests;
drop policy if exists "requests: add own" on public.leader_requests;
create policy "requests: read own or admin" on public.leader_requests for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "requests: add own" on public.leader_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and decided_at is null);

-- The admin answers a request: approved, the player becomes the leader of that faction on that server.
create or replace function public.decide_leader_request(request_id bigint, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  request leader_requests;
begin
  if not is_admin() then
    raise exception 'not an admin';
  end if;
  select * into request from leader_requests where id = request_id and status = 'pending' for update;
  if not found then
    return;
  end if;
  update leader_requests set status = case when approve then 'approved' else 'rejected' end, decided_at = now()
    where id = request_id;
  if approve then
    insert into roles (user_id, server, organization, role, granted_by)
    values (request.user_id, request.server, request.organization, 'leader', auth.uid())
    on conflict (user_id, server, organization) do update set role = 'leader', granted_by = auth.uid(), granted_at = now();
  end if;
end;
$$;

revoke all on function public.decide_leader_request(bigint, boolean) from public, anon;
grant execute on function public.decide_leader_request(bigint, boolean) to authenticated;
grant execute on function public.is_admin() to authenticated;
