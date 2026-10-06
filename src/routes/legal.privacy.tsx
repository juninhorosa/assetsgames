import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — AssetsForge" },
      {
        name: "description",
        content:
          "Como a AssetsForge recolhe, usa e protege os seus dados pessoais, incluindo a partilha com a Paddle como Merchant of Record.",
      },
      { property: "og:title", content: "Política de Privacidade — AssetsForge" },
      {
        property: "og:description",
        content: "Dados recolhidos, finalidades, direitos e partilha com a Paddle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: agosto de 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-base font-semibold">1. Responsável pelo tratamento</h2>
          <p className="mt-2">
            A <strong>AssetsForge</strong> é a responsável pelo tratamento (data controller) dos
            dados pessoais recolhidos através deste serviço. Contacto:{" "}
            <a href="mailto:juninhorosa11@gmail.com" className="text-primary underline">
              juninhorosa11@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">2. Dados que recolhemos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Conta:</strong> nome, endereço de email e credenciais de autenticação
              (incluindo identificadores de login social, ex. Google);
            </li>
            <li>
              <strong>Uso do serviço:</strong> prompts, assets gerados, projetos, histórico de
              gerações, consumo de créditos e registos de API;
            </li>
            <li>
              <strong>Suporte:</strong> mensagens e pedidos que nos envia;
            </li>
            <li>
              <strong>Telemetria e segurança:</strong> endereço IP, identificadores de dispositivo
              e fingerprint técnico (para prevenção de abuso e contas múltiplas), registos de
              acesso e de auditoria administrativa.
            </li>
          </ul>
          <p className="mt-2">
            Os dados de pagamento são recolhidos e tratados diretamente pela Paddle, não pela
            AssetsForge.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">3. Finalidades e bases legais</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Prestação do serviço</strong> (execução de contrato): criação de conta,
              geração e armazenamento de assets, gestão de créditos e planos;
            </li>
            <li>
              <strong>Segurança e prevenção de fraude</strong> (interesse legítimo): deteção de
              contas duplicadas, abuso de trial e proteção da plataforma;
            </li>
            <li>
              <strong>Melhoria do produto</strong> (interesse legítimo): análise agregada de uso;
            </li>
            <li>
              <strong>Suporte ao cliente</strong> (execução de contrato / interesse legítimo);
            </li>
            <li>
              <strong>Obrigações legais</strong>: conservação de registos exigidos por lei.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">4. Partilha de dados</h2>
          <p className="mt-2">Partilhamos dados com as seguintes categorias de destinatários:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Merchant of Record (Paddle):</strong> para venda do produto, gestão de
              assinaturas, processamento de pagamentos, conformidade fiscal e faturação;
            </li>
            <li>
              <strong>Prestadores de serviços / subprocessadores:</strong> alojamento, base de
              dados, autenticação, análise e ferramentas de suporte;
            </li>
            <li>
              <strong>Assessores profissionais:</strong> jurídicos e contabilísticos, quando
              necessário;
            </li>
            <li>
              <strong>Autoridades:</strong> quando exigido por lei.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">5. Transferências internacionais</h2>
          <p className="mt-2">
            Os dados podem ser tratados fora do seu país, incluindo fora da UE/EEE e do Reino
            Unido. Nesses casos aplicamos salvaguardas adequadas, como cláusulas contratuais-tipo
            (SCCs) ou decisões de adequação.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">6. Retenção</h2>
          <p className="mt-2">
            Conservamos os dados enquanto a conta estiver ativa e pelo período necessário para
            cumprir obrigações legais, resolver disputas e fazer cumprir contratos. Quando deixarem
            de ser necessários, os dados são eliminados ou anonimizados.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">7. Os seus direitos</h2>
          <p className="mt-2">
            Nos termos do RGPD e legislação aplicável, tem direito a: aceder, retificar e apagar os
            seus dados; restringir ou opor-se ao tratamento; portabilidade dos dados; retirar
            consentimento (quando aplicável); e apresentar reclamação junto da autoridade de
            controlo (em Portugal, a CNPD). Respondemos aos pedidos no prazo de 1 mês. Para exercer
            os seus direitos, contacte{" "}
            <a href="mailto:juninhorosa11@gmail.com" className="text-primary underline">
              juninhorosa11@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">8. Segurança</h2>
          <p className="mt-2">
            Aplicamos medidas técnicas e organizativas adequadas, incluindo encriptação em
            trânsito, controlos de acesso e isolamento de dados por utilizador (row-level
            security).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">9. Cookies</h2>
          <p className="mt-2">
            Utilizamos cookies e armazenamento local estritamente necessários ao funcionamento do
            serviço (sessão de autenticação e preferências). Não utilizamos cookies de marketing de
            terceiros. Pode gerir cookies nas definições do seu navegador.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">10. Alterações</h2>
          <p className="mt-2">
            Podemos atualizar esta política periodicamente. A versão em vigor estará sempre
            disponível nesta página, com a data da última atualização.
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
