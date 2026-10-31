# CobraJá

Carteira do vendedor: clientes, produtos, vendas à vista ou parceladas, saldo e cobrança no WhatsApp. Funciona sem internet e envia para a conta quando a rede volta.

Cores: laranja e branco.

## Como continuar amanhã

Abra este projeto e rode o preview. O código desta versão já está aqui. Não precisa reconstruir o app.

```bash
npm run dev
```

Abre em `http://127.0.0.1:8080`.

Conta de teste na prévia entra direto. Confirmação de e-mail só liga quando o servidor tiver a Resend configurada.

## O que já funciona

- Cadastro de cliente (nome + WhatsApp com DDD) e edição.
- Cadastro e exclusão de produto, e edição.
- Venda à vista ou em até 24 parcelas. Valores em centavos.
- Saldo, atraso, “vence hoje” e botão Recebi (na home e no cliente).
- Mensagem de cobrança no WhatsApp.
- Offline: grava no aparelho e envia a fila quando a internet volta.
- Conta com e-mail e senha, Google e X.
- Esqueci a senha (`/redefinir`) e confirmar e-mail (`/verificar`).
- Apagar conta e dados (Conta → digitar APAGAR).
- Página de privacidade (`/privacidade`).
- Banco: clientes, produtos, vendas, parcelas e fila de operações, por usuário.
- Carteira grande desce em partes. Operações já aplicadas saem depois de 14 dias.
- Limite por conta: 20 mil clientes, 20 mil produtos, 50 mil vendas.

## O que falta

Faça nesta ordem. O item de cima trava o de baixo.

1. **Banco de verdade.** Publicar com `DATABASE_URL` do Neon (modo pooler). A prévia usa banco temporário e some ao reiniciar. Ligar backup no painel do Neon.
2. **E-mail.** Conta na Resend, domínio confirmado, variáveis `RESEND_API_KEY` e `RESET_EMAIL_FROM`. Sem isso, “Esqueci a senha” e “confirme o e-mail” não enviam. Com as variáveis, o cadastro exige abrir o link antes de entrar.
3. **Play Store.** Site no ar em HTTPS, pacote Android (AAB) com Trusted Web Activity, conta Google Play (US$ 25), política em `/privacidade`, ficha de segurança dos dados, ícone e capturas.
4. **Não fazer agora.** App nativo em React Native. A primeira versão da loja pode ser o site embrulhado.

## Variáveis

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Postgres (Neon). Sem ela, a prévia usa banco local temporário. |
| `RESEND_API_KEY` | Envio de e-mail. Sem ela, a conta entra sem confirmar o e-mail. |
| `RESET_EMAIL_FROM` | Remetente, ex.: `CobraJá <senha@seudominio.com>`. |
| `BETTER_AUTH_URL` | Endereço público do app, quando publicado. |
| `BETTER_AUTH_SECRET` | Segredo da sessão, quando publicado. |

## Onde mexer

| Assunto | Arquivo |
|---|---|
| Telas | `src/components/cobra-app.tsx` |
| Regras e dinheiro | `src/lib/cobra/logic.ts` |
| Gravação no aparelho | `src/lib/cobra/local.ts` |
| Envio ao banco | `src/lib/cobra/functions.ts` |
| Tabelas | `migrations/0002_cobra.sql` e `migrations/0003_scale.sql` |
| Senha e e-mail | `src/lib/auth/password-reset.server.ts` |
| Apagar conta | `src/lib/cobra/wipe.server.ts` |
| Páginas | `src/routes/login.tsx`, `redefinir.tsx`, `verificar.tsx`, `privacidade.tsx` |
