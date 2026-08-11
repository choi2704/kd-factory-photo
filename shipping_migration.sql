-- 출고관리 기능 추가용 SQL
-- Supabase > SQL Editor에서 한 번만 실행하세요.

alter table public.production_orders
  add column if not exists ship_date date;

alter table public.production_orders
  add column if not exists delivery_details text;

create index if not exists production_orders_ship_date_idx
  on public.production_orders (ship_date);
