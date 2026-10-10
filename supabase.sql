-- ============================================================
-- База цен в Сербии — схема БД для Supabase (Postgres)
-- Как применить: Supabase → SQL Editor → вставить этот файл → Run.
-- Файл идемпотентный: повторный запуск не сломает данные.
-- ============================================================

-- ---------- Расширение для gen_random_uuid() ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- Таблица products — база цен
-- ============================================================
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text,
  category    text,
  store       text not null,
  price_rsd   numeric(10,2) not null,
  comment     text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- Таблица shopping_list — общий список покупок
-- ============================================================
create table if not exists public.shopping_list (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  is_done     boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- Таблица stores — подсказки магазинов для автокомплита
-- ============================================================
create table if not exists public.stores (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- Таблица categories — подсказки категорий
-- ============================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- Триггер автообновления products.updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- RLS-политики
-- ============================================================
alter table public.products       enable row level security;
alter table public.shopping_list  enable row level security;
alter table public.stores         enable row level security;
alter table public.categories     enable row level security;

-- ---------- products ----------
-- ВНИМАНИЕ (осознанный компромисс для мини-проекта):
-- доступ на запись открыт роли anon. Защита редактирования —
-- только клиентский пароль в admin.html, это НЕ настоящая
-- безопасность. Для реальной защиты нужен Supabase Auth +
-- политики по auth.uid()/ролям.
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to anon, authenticated using (true);

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to anon, authenticated with check (true);

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to anon, authenticated using (true) with check (true);

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to anon, authenticated using (true);

-- ---------- shopping_list ----------
-- Общий список: любой может читать и менять.
drop policy if exists shopping_select on public.shopping_list;
create policy shopping_select on public.shopping_list
  for select to anon, authenticated using (true);

drop policy if exists shopping_insert on public.shopping_list;
create policy shopping_insert on public.shopping_list
  for insert to anon, authenticated with check (true);

drop policy if exists shopping_update on public.shopping_list;
create policy shopping_update on public.shopping_list
  for update to anon, authenticated using (true) with check (true);

drop policy if exists shopping_delete on public.shopping_list;
create policy shopping_delete on public.shopping_list
  for delete to anon, authenticated using (true);

-- ---------- stores ----------
drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores
  for select to anon, authenticated using (true);

drop policy if exists stores_insert on public.stores;
create policy stores_insert on public.stores
  for insert to anon, authenticated with check (true);

drop policy if exists stores_delete on public.stores;
create policy stores_delete on public.stores
  for delete to anon, authenticated using (true);

-- ---------- categories ----------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to anon, authenticated using (true);

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to anon, authenticated with check (true);

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to anon, authenticated using (true);

-- ============================================================
-- Стартовые подсказки магазинов Сербии (необязательно)
-- ============================================================
insert into public.stores (name) values
  ('Maxi'), ('Idea'), ('Univerexport'), ('Lidl'), ('Dis'), ('Roda'),
  ('Shop&Go'), ('Aman'), ('Mercator'), ('Tempo')
on conflict (name) do nothing;

-- ============================================================
-- Стартовые категории (необязательно)
-- ============================================================
insert into public.categories (name) values
  ('Молочное'), ('Мясо и рыба'), ('Овощи и фрукты'), ('Хлеб'),
  ('Бакалея'), ('Напитки'), ('Сладкое'), ('Заморозка'),
  ('Бытовая химия'), ('Гигиена'), ('Другое')
on conflict (name) do nothing;
