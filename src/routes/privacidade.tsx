import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-desk px-5 py-10 text-ink">
      <article className="w-full max-w-lg space-y-4 rounded-[2rem] border border-line bg-bg p-6 text-sm leading-relaxed">
        <h1 className="text-3xl font-bold text-primary">Privacidade</h1>
        <p>O CobraJá guarda a conta de quem vende (nome, e-mail e senha) e a carteira dessa conta: clientes, WhatsApp, produtos, vendas e parcelas.</p>
        <p>A senha não fica em texto aberto. O e-mail de confirmação e o de nova senha só saem quando o servidor tem o envio configurado (Resend). Sem isso, o app avisa e não exige o link.</p>
        <p>No aparelho, a carteira também fica salva para funcionar sem internet. Quando a conexão volta, ela é enviada para o banco da conta. Não vendemos esses dados.</p>
        <p>Em Conta, “Apagar conta e dados” remove a conta e a carteira do banco. O que ficou só neste aparelho some ao sair ou ao apagar a conta neste navegador.</p>
        <p>Para publicar na Play Store, esta página precisa estar no ar em HTTPS, no mesmo endereço do app.</p>
        <Link to="/" className="block text-center text-sm font-semibold text-primary">Voltar ao CobraJá</Link>
      </article>
    </main>
  );
}
