-- Melhorias vindas do CobraFirme: fiado, consentimento LGPD, empresa/PIX e status da venda.
alter table clientes add column if not exists observacao text not null default '';
alter table clientes add column if not exists consentimento_whatsapp boolean not null default false;

alter table vendas add column if not exists tipo text not null default 'parcelado';
alter table vendas add column if not exists status text not null default 'aberta';

update vendas
set tipo = 'a_vista', status = 'quitada'
where entrada = valor_total;

update vendas
set status = 'parcial'
where status = 'aberta' and entrada > 0 and entrada < valor_total;

alter table parcelas alter column data_vencimento drop not null;

create table if not exists empresa (
  user_id    text primary key,
  nome       text not null default '',
  pix_chave  text not null default '',
  pix_nome   text not null default '',
  ton_padrao text not null default 'amigavel'
);
