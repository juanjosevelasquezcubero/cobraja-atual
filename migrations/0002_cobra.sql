create table if not exists cobra_customers (
  id text primary key,
  user_id text not null,
  name text not null,
  whatsapp text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);
create index if not exists cobra_customers_user_idx on cobra_customers (user_id);

create table if not exists cobra_products (
  id text primary key,
  user_id text not null,
  name text not null,
  price_cents integer not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text
);
create index if not exists cobra_products_user_idx on cobra_products (user_id);

create table if not exists cobra_sales (
  id text primary key,
  user_id text not null,
  customer_id text not null,
  customer_name text not null,
  product_name text not null,
  total_cents integer not null,
  down_cents integer not null,
  sale_date text not null,
  created_at text not null
);
create index if not exists cobra_sales_user_idx on cobra_sales (user_id);

create table if not exists cobra_installments (
  id text primary key,
  user_id text not null,
  sale_id text not null,
  number integer not null,
  value_cents integer not null,
  due_date text not null,
  status text not null,
  paid_at text
);
create index if not exists cobra_installments_user_idx on cobra_installments (user_id);
create index if not exists cobra_installments_sale_idx on cobra_installments (sale_id);

create table if not exists cobra_ops (
  id text primary key,
  user_id text not null,
  applied_at text not null
);
create index if not exists cobra_ops_user_idx on cobra_ops (user_id);
