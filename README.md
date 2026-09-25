# CobraJá

Cadastro de clientes, vendas à vista, parceladas e fiado, saldo e cobrança pelo WhatsApp.

Versão **web** em TypeScript e React. Não é React Native.

## O que o vendedor faz

1. Entra na conta
2. Cadastra o cliente e marca se ele autorizou cobrança no WhatsApp
3. Lança a venda: parcelado, à vista ou fiado
4. Vê o que vence hoje, o atrasado, o recebido no mês e os maiores devedores
5. Em Conta, grava o nome da loja, a chave PIX e o tom da mensagem (amigável, firme ou formal)
6. Cobra pelo WhatsApp com a mensagem pronta. Sem autorização, o app não abre o link

## Stack

- TypeScript
- React 19
- TanStack Start / Router
- Tailwind CSS
- PostgreSQL (Neon quando `DATABASE_URL` está definida)

## Como rodar

```bash
npm install
npm run dev
```

O servidor sobe na porta **8080**.

Em produção, defina `DATABASE_URL` com a URL do Neon/Postgres. Não coloque senha nem token neste repositório.

## Outras versões

- [cobraja-web](https://github.com/juanjosevelasquezcubero/cobraja-web) — versão web anterior
- [cobraja](https://github.com/juanjosevelasquezcubero/cobraja) — HTML, CSS e JavaScript
- [cobra-firme](https://github.com/juanjosevelasquezcubero/cobra-firme) — Python e Django
- [cobrafirme](https://github.com/juanjosevelasquezcubero/cobrafirme) — React Native (privado)
