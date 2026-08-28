import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/refund")({
  head: () => ({
    meta: [
      { title: "Política de Reembolso — AssetsForge" },
      {
        name: "description",
        content:
          "Política de reembolso da AssetsForge: garantia de 30 dias, processada pela Paddle.",
      },
      { property: "og:title", content: "Política de Reembolso — AssetsForge" },
      {
        property: "og:description",
        content: "Garantia de reembolso de 30 dias, processada pela Paddle.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Política de Reembolso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: agosto de 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-base font-semibold">Garantia de 30 dias</h2>
          <p className="mt-2">
            Oferecemos uma garantia de reembolso de <strong>30 dias</strong>. Se não estiver
            satisfeito com a sua compra ou assinatura da AssetsForge, pode pedir o reembolso
            integral no prazo de 30 dias a contar da data da compra.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Como pedir um reembolso</h2>
          <p className="mt-2">
            Os pagamentos e reembolsos são processados pelo nosso parceiro de pagamentos, a{" "}
            <strong>Paddle</strong>, que atua como Merchant of Record. Para pedir um reembolso:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              visite{" "}
              <a
                href="https://paddle.net"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                paddle.net
              </a>{" "}
              e siga as instruções de apoio ao comprador; ou
            </li>
            <li>
              contacte o suporte da AssetsForge em{" "}
              <a href="mailto:juninhorosa11@gmail.com" className="text-primary underline">
                juninhorosa11@gmail.com
              </a>{" "}
              indicando o email da conta e a data da compra.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Cancelamento da assinatura</h2>
          <p className="mt-2">
            Pode cancelar a renovação da assinatura a qualquer momento. O acesso mantém-se ativo
            até ao fim do período já pago. O cancelamento pode ser feito através da Paddle
            (paddle.net) ou contactando o nosso suporte.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Referência</h2>
          <p className="mt-2">
            Para mais detalhes sobre o tratamento de reembolsos, consulte a{" "}
            <a
              href="https://www.paddle.com/legal/refund-policy"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Política de Reembolso da Paddle
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        <Link to="/" className="text-primary underline">
          ← Voltar à página inicial
        </Link>
      </p>
    </main>
  );
}
