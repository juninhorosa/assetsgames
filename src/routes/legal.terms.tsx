import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Termos e Condições — AssetsForge" },
      {
        name: "description",
        content:
          "Termos e Condições de uso do AssetsForge, o gerador de assets 2D e 3D para jogos.",
      },
      { property: "og:title", content: "Termos e Condições — AssetsForge" },
      {
        property: "og:description",
        content: "Condições de uso, propriedade intelectual e pagamentos do AssetsForge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Termos e Condições</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: agosto de 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-base font-semibold">1. Identificação do vendedor</h2>
          <p className="mt-2">
            Estes Termos e Condições regem o uso do serviço <strong>AssetsForge</strong> (doravante
            "AssetsForge", "nós" ou "o serviço"). Ao utilizar o serviço, celebra um contrato
            diretamente com a AssetsForge. Ao continuar a utilizar o serviço, concorda com estes
            termos. Se não concordar, não utilize o serviço.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">2. Descrição do serviço</h2>
          <p className="mt-2">
            A AssetsForge é uma plataforma de geração de assets visuais para videojogos (sprites,
            sprite sheets animadas, texturas PBR, elementos de UI e modelos 2.5D/3D), com
            exportação para Unity, Unreal Engine e Godot, incluindo acesso via API e MCP.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">3. Conta e credenciais</h2>
          <p className="mt-2">
            O utilizador deve fornecer informações verdadeiras, manter a confidencialidade das
            suas credenciais e API keys, e é responsável por toda a atividade realizada na sua
            conta. Confirma que tem idade legal para celebrar contratos ou autoridade para vincular
            a organização que representa.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">4. Licença de uso</h2>
          <p className="mt-2">
            Concedemos uma licença limitada, não exclusiva e não transferível para usar o serviço
            dentro do plano contratado. Não é permitido fazer engenharia reversa, revender ou
            redistribuir o serviço em si, nem contornar limites técnicos, de créditos ou de quota.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">5. Uso aceitável e uso proibido</h2>
          <p className="mt-2">O utilizador não deve utilizar o serviço para:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>fins ilegais, fraude ou spam;</li>
            <li>violar direitos de propriedade intelectual de terceiros;</li>
            <li>
              gerar conteúdo ilegal, discurso de ódio, deepfakes de pessoas reais sem consentimento
              ou malware;
            </li>
            <li>
              interferir com a segurança do serviço (probing, scraping abusivo, injeção de código);
            </li>
            <li>contornar mecanismos anti-abuso, incluindo a criação de múltiplas contas.</li>
          </ul>
          <p className="mt-2">
            O utilizador é responsável pelos seus prompts, pelo uso que faz dos conteúdos gerados,
            por verificar a sua adequação e por garantir que detém os direitos sobre qualquer
            conteúdo que envie como referência.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">6. Propriedade intelectual</h2>
          <p className="mt-2">
            A AssetsForge detém todos os direitos sobre o serviço, incluindo software,
            documentação e marca. Os assets gerados a partir dos seus prompts podem ser utilizados
            pelo utilizador nos seus projetos, incluindo fins comerciais, dentro do plano
            contratado. Reclamações de titulares de direitos podem ser enviadas ao nosso suporte;
            conteúdo infrator pode ser removido e a infração repetida pode levar à suspensão da
            conta.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">7. Conteúdo gerado por IA</h2>
          <p className="mt-2">
            Os resultados gerados por inteligência artificial podem conter imprecisões ou
            semelhanças não intencionais com obras existentes. Reservamo-nos o direito de moderar,
            filtrar ou recusar gerações e de remover conteúdo que viole estes termos.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">8. Pagamentos, assinaturas e Paddle (Merchant of Record)</h2>
          <p className="mt-2">
            Our order process is conducted by our online reseller Paddle.com. Paddle.com is the
            Merchant of Record for all our orders. Paddle provides all customer service inquiries
            and handles returns.
          </p>
          <p className="mt-2">
            Os termos de pagamento, faturação, impostos, renovação, cancelamento e reembolso são
            regidos pelos{" "}
            <a
              href="https://www.paddle.com/legal/checkout-buyer-terms"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Termos do Comprador da Paddle
            </a>
            . As assinaturas renovam-se automaticamente até serem canceladas; o cancelamento pode
            ser feito a qualquer momento através da Paddle.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">9. Disponibilidade do serviço</h2>
          <p className="mt-2">
            Não garantimos funcionamento ininterrupto ou livre de erros. O serviço é fornecido
            "tal como está", sem garantias implícitas de comercialização ou adequação a um fim
            específico, na máxima extensão permitida por lei.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">10. Limitação de responsabilidade</h2>
          <p className="mt-2">
            Na máxima extensão permitida por lei, a responsabilidade agregada da AssetsForge está
            limitada aos valores pagos pelo utilizador nos 12 meses anteriores ao evento, e
            excluímos responsabilidade por danos indiretos, consequenciais ou perda de lucros,
            dados ou goodwill. Nada nestes termos exclui responsabilidade que não possa ser
            excluída por lei (incluindo fraude, morte ou danos pessoais).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">11. Suspensão e rescisão</h2>
          <p className="mt-2">
            Podemos suspender ou terminar o acesso em caso de violação material destes termos,
            falta de pagamento, risco de segurança ou fraude, ou violações repetidas das políticas
            de uso. Após a rescisão, o acesso aos assets armazenados pode ser removido após um
            período razoável para exportação.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">12. Disposições gerais</h2>
          <p className="mt-2">
            Não somos responsáveis por falhas causadas por eventos fora do nosso controlo razoável.
            O utilizador não pode ceder este contrato sem consentimento; a AssetsForge pode cedê-lo
            no contexto de fusão ou aquisição. Podemos atualizar estes termos com aviso prévio
            razoável; o uso continuado constitui aceitação.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">13. Contacto</h2>
          <p className="mt-2">
            Para questões sobre estes termos, contacte o suporte da AssetsForge através do email{" "}
            <a href="mailto:juninhorosa11@gmail.com" className="text-primary underline">
              juninhorosa11@gmail.com
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
