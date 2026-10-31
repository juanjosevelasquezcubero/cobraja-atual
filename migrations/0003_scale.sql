create index if not exists cobra_ops_applied_idx on cobra_ops (applied_at);
create index if not exists cobra_customers_user_id_idx on cobra_customers (user_id, id);
create index if not exists cobra_products_user_id_idx on cobra_products (user_id, id);
create index if not exists cobra_sales_user_id_idx on cobra_sales (user_id, id);
create index if not exists cobra_installments_user_id_idx on cobra_installments (user_id, id);
