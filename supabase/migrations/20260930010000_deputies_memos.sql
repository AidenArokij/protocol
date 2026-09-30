-- Deputies (ticket 16) and faction memos (ticket 17), on the roles of ticket 15.
-- A faction is a server and an organisation; a player belongs to the one their card says (chosen by themselves
-- for now, Q16 — approval by the leader is ticket 19). Its leader sees its players' cards and makes deputies of
-- them; the leader and the deputies write memos that its players read until they run out.

-- What the signed-in player is in a faction: its leader, a deputy, or one of its players by their card.
create or replace function public.leads(at_server text, at_organization text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from roles where user_id = auth.uid() and server = at_server and organization = at_organization and role = 'leader');
$$;

create or replace function public.writes_memos(at_server text, at_organization text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from roles where user_id = auth.uid() and server = at_server and organization = at_organization);
$$;

create or replace function public.member_of(at_server text, at_organization text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and server = at_server and organization = at_organization);
$$;

-- The leader reads the cards of their faction's players, and their roles.
drop policy if exists "profiles: the leader reads their faction" on public.profiles;
create policy "profiles: the leader reads their faction" on public.profiles for select to authenticated
  using ((select public.leads(server, organization)));
drop policy if exists "roles: the leader reads their faction" on public.roles;
create policy "roles: the leader reads their faction" on public.roles for select to authenticated
  using ((select public.leads(server, organization)));

-- The leader makes a player of their faction a deputy, or takes it back; a leader is never made a deputy.
create or replace function public.set_deputy(player uuid, deputy boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  place record;
begin
  select server, organization into place from profiles where user_id = player;
  if not found or place.server is null or place.organization is null or not leads(place.server, place.organization) then
    raise exception 'not the leader of this player''s faction';
  end if;
  if deputy then
    insert into roles (user_id, server, organization, role, granted_by)
    values (player, place.server, place.organization, 'deputy', auth.uid())
    on conflict (user_id, server, organization) do nothing;
  else
    delete from roles where user_id = player and server = place.server and organization = place.organization and role = 'deputy';
  end if;
end;
$$;
revoke all on function public.set_deputy(uuid, boolean) from public, anon;
grant execute on function public.set_deputy(uuid, boolean) to authenticated;
grant execute on function public.leads(text, text) to authenticated;
grant execute on function public.writes_memos(text, text) to authenticated;
grant execute on function public.member_of(text, text) to authenticated;

create table if not exists public.memos (
  id bigint generated always as identity primary key,
  server text not null check (char_length(server) <= 30),
  organization text not null check (char_length(organization) <= 30),
  author uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '' check (char_length(author_name) <= 80),
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  until timestamptz not null,
  check (until > created_at and until <= created_at + interval '32 days')
);
create index if not exists memos_faction on public.memos (server, organization, until desc);

alter table public.memos enable row level security;

drop policy if exists "memos: the faction reads" on public.memos;
drop policy if exists "memos: the leader and deputies write" on public.memos;
drop policy if exists "memos: the author or the leader removes" on public.memos;
create policy "memos: the faction reads" on public.memos for select to authenticated
  using ((select public.member_of(server, organization)) or (select public.writes_memos(server, organization)) or (select public.is_admin()));
create policy "memos: the leader and deputies write" on public.memos for insert to authenticated
  with check ((select auth.uid()) = author and (select public.writes_memos(server, organization)));
create policy "memos: the author or the leader removes" on public.memos for delete to authenticated
  using ((select auth.uid()) = author or (select public.leads(server, organization)) or (select public.is_admin()));
