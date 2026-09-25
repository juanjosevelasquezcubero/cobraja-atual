-- CobraJá: clientes, vendas e parcelas por vendedor
create table if not exists clientes (
  id         serial primary key,
  user_id    text not null,
  nome       text not null,
  whatsapp   text not null,
  created_at timestamptz not null default now()
);
create index if not exists clientes_user_id_idx on clientes (user_id);
create index if not exists clientes_user_nome_idx on clientes (user_id, nome);

create table if not exists vendas (
  id           serial primary key,
  user_id      text not null,
  cliente_id   integer not null references clientes(id) on delete cascade,
  produto      text not null,
  valor_total  numeric(12,2) not null,
  entrada      numeric(12,2) not null default 0,
  data_venda   date not null default current_date
);
create index if not exists vendas_user_id_idx on vendas (user_id);
create index if not exists vendas_cliente_id_idx on vendas (cliente_id);

create table if not exists parcelas (
  id               serial primary key,
  user_id          text not null,
  venda_id         integer not null references vendas(id) on delete cascade,
  numero           integer not null,
  valor            numeric(12,2) not null,
  data_vencimento  date not null,
  status           text not null default 'PENDENTE',
  data_pagamento   date
);
create index if not exists parcelas_user_id_idx on parcelas (user_id);
create index if not exists parcelas_venda_id_idx on parcelas (venda_id);
create index if not exists parcelas_user_status_venc_idx on parcelas (user_id, status, data_vencimento);
