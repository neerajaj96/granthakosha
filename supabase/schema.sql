-- GranthaKosha Supabase schema (M6). Run in the Supabase SQL editor.
-- One narrow table holds every (store, id) record as JSONB, so the
-- StorageAdapter contract (scriptures/passages/commentaries/kv) maps 1:1.

create table if not exists public.granthakosha_records (
  store text not null check (store in ('scriptures','passages','commentaries','kv')),
  id text not null,
  body jsonb not null,
  updated_at bigint not null default 0,
  primary key (store, id)
);

create index if not exists gk_records_store_idx on public.granthakosha_records (store);
create index if not exists gk_records_updated_idx on public.granthakosha_records (updated_at desc);

alter table public.granthakosha_records enable row level security;

-- Read: world-readable (public corpus mirrors the offline-first bundle).
drop policy if exists "public read" on public.granthakosha_records;
create policy "public read" on public.granthakosha_records
  for select using (true);

-- Write: authenticated users whose JWT app_metadata.role is editor/admin.
-- Set via Auth Hooks or dashboard: {"role": "editor"}.
drop policy if exists "editors write" on public.granthakosha_records;
create policy "editors write" on public.granthakosha_records
  for insert with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('editor', 'admin')
  );
drop policy if exists "editors update" on public.granthakosha_records;
create policy "editors update" on public.granthakosha_records
  for update using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('editor', 'admin')
  );

-- Delete: admin only (corpus is append-mostly; deletes never sync-push).
drop policy if exists "admins delete" on public.granthakosha_records;
create policy "admins delete" on public.granthakosha_records
  for delete using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
