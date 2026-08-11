
-- Supabase SQL Editor에서 한 번 실행하세요.

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  phone text,
  address text,
  items text not null,
  memo text,
  status text not null default 'working' check (status in ('working','done')),
  photo_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.production_orders enable row level security;

drop policy if exists "public read orders" on public.production_orders;
drop policy if exists "public insert orders" on public.production_orders;
drop policy if exists "public update orders" on public.production_orders;
drop policy if exists "public delete orders" on public.production_orders;

create policy "public read orders"
on public.production_orders for select
to anon using (true);

create policy "public insert orders"
on public.production_orders for insert
to anon with check (true);

create policy "public update orders"
on public.production_orders for update
to anon using (true) with check (true);

create policy "public delete orders"
on public.production_orders for delete
to anon using (true);

-- Storage 버킷은 Dashboard > Storage에서
-- completion-photos 이름으로 Public bucket 생성 후 아래 정책 실행

drop policy if exists "public upload completion photos" on storage.objects;
drop policy if exists "public read completion photos" on storage.objects;

create policy "public upload completion photos"
on storage.objects for insert
to anon
with check (bucket_id = 'completion-photos');

create policy "public read completion photos"
on storage.objects for select
to anon
using (bucket_id = 'completion-photos');

-- 실시간 반영
alter publication supabase_realtime add table public.production_orders;
