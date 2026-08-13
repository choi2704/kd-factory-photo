-- 화물 배차관리 기능 추가
-- Supabase > SQL Editor에서 한 번만 실행하세요.

alter table public.production_orders
  add column if not exists dispatch_status text not null default 'waiting',
  add column if not exists dispatch_vehicle text,
  add column if not exists dispatch_driver text,
  add column if not exists dispatch_driver_phone text,
  add column if not exists dispatch_fee integer,
  add column if not exists dispatch_memo text,
  add column if not exists dispatch_receipt_url text;

create index if not exists production_orders_dispatch_status_idx
  on public.production_orders (dispatch_status);
