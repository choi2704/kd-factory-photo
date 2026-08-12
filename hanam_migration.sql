-- 하남 사무실 이동 체크 기능 추가
-- Supabase > SQL Editor에서 한 번만 실행하세요.

alter table public.production_orders
  add column if not exists hanam_office boolean not null default false;
