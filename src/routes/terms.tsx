import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  Ban,
  RefreshCw,
  CreditCard,
  Gavel,
  Mail,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SeoHead } from "@/components/seo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço — VW2 Conversas" },
      {
        name: "description",
        content:
          "Termos de Serviço da VW2 Conversas. Leia as regras e condições de uso da nossa plataforma.",
      },
      { property: "og:title", content: "Termos de Serviço — VW2 Conversas" },
      {
        property: "og:description",
        content: "Regras e condições de uso da plataforma VW2 Conversas.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Termos de Serviço"
        description="Termos de Serviço da VW2 Conversas. Leia as regras e condições de uso da nossa plataforma."
        canonical="https://vw2conversas.com.br/terms"
      />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-semibold">VW2 Conversas</span>
          </div>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl font-semibold">Termos de Serviço</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <Card className="mt-8 space-y-6 p-8">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">1. Aceitação dos Termos</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ao acessar e utilizar a plataforma VW2 Conversas, você concorda integralmente com
              estes Termos de Serviço, bem como com nossa{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              . Se não concordar com qualquer parte destes termos, você não deve usar nossos
              serviços.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">2. Descrição do Serviço</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A VW2 Conversas é uma plataforma de gerenciamento e disparo de mensagens via WhatsApp
              Cloud API oficial da Meta. Nossos serviços incluem:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Criação e gestão de contatos e listas de distribuição.</li>
              <li>Configuração de templates de mensagens aprovados pela Meta.</li>
              <li>Agendamento e envio de campanhas de mensagens.</li>
              <li>Recebimento e processamento de webhooks de status de entrega.</li>
              <li>Geração de relatórios e estatísticas de envio.</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Você é responsável por ter uma conta de WhatsApp Business aprovada pela Meta e por
              manter suas credenciais de acesso válidas e seguras.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">3. Conta do Usuário</h2>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Você deve ter pelo menos 18 anos para usar a plataforma.</li>
              <li>
                É proibido criar contas usando informações falsas ou de terceiros sem autorização.
              </li>
              <li>
                Você é responsável por manter a confidencialidade de sua senha e credenciais de
                acesso.
              </li>
              <li>Notifique-nos imediatamente sobre qualquer uso não autorizado da sua conta.</li>
              <li>
                Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">4. Uso Proibido</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              É expressamente proibido utilizar a plataforma para:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Enviar spam, mensagens não solicitadas ou em massa sem consentimento dos
                destinatários.
              </li>
              <li>
                Transmitir conteúdo ilegal, difamatório, ameaçador, obsceno ou que viole direitos de
                terceiros.
              </li>
              <li>
                Usar a plataforma para atividades fraudulentas, phishing ou engenharia social.
              </li>
              <li>Enviar mensagens que violem as Políticas Comerciais do WhatsApp ou da Meta.</li>
              <li>
                Tentar acessar, modificar ou interferir nos sistemas da plataforma de forma não
                autorizada.
              </li>
              <li>Compartilhar credenciais de acesso da Meta com terceiros não autorizados.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">5. Pagamentos e Reembolsos</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A VW2 Conversas pode oferecer planos pagos no futuro. Quando isso ocorrer:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Os valores e condições de pagamento serão claramente informados no momento da
                contratação.
              </li>
              <li>Cobranças serão feitas conforme o plano escolhido (mensal, anual, etc.).</li>
              <li>
                Você pode cancelar sua assinatura a qualquer momento, com efeito ao final do período
                pago.
              </li>
              <li>
                Reembolsos serão analisados caso a caso, respeitando o Código de Defesa do
                Consumidor.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">
                6. Limitação de Responsabilidade
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A VW2 Conversas atua como intermediadora tecnológica entre você e a WhatsApp Cloud API
              da Meta. Não somos responsáveis por:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Falhas de entrega de mensagens causadas pela Meta, pelo destinatário ou por
                problemas de rede.
              </li>
              <li>Bloqueios ou suspensões de número de telefone impostos pela Meta.</li>
              <li>Perdas de dados decorrentes de falhas técnicas fora do nosso controle direto.</li>
              <li>Danos indiretos, lucros cessantes ou perdas de oportunidade de negócio.</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Nossa responsabilidade total, em qualquer hipótese, está limitada ao valor pago por
              você nos últimos 12 meses de uso da plataforma.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">7. Modificações nos Termos</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Podemos atualizar estes Termos de Serviço periodicamente. Alterações materiais serão
              notificadas com pelo menos 15 dias de antecedência. O uso continuado da plataforma
              após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">8. Rescisão</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Podemos suspender ou encerrar sua conta imediatamente, sem aviso prévio, caso
              identifiquemos violação destes termos, uso indevido da plataforma ou atividades que
              possam comprometer a segurança ou reputação do serviço. Você pode encerrar sua conta a
              qualquer momento através das configurações ou solicitando a{" "}
              <Link to="/data-deletion" className="text-primary hover:underline">
                exclusão dos seus dados
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">9. Lei Aplicável</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Estes Termos de Serviço são regidos pelas leis da República Federativa do Brasil.
              Quaisquer disputas serão resolvidas no foro da cidade de São Paulo, SP, com exclusão
              de qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">10. Contato</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Para dúvidas sobre estes Termos de Serviço, entre em contato pelo e-mail:{" "}
              <a href="mailto:legal@vw2conversas.com.br" className="text-primary hover:underline">
                legal@vw2conversas.com.br
              </a>
            </p>
          </section>
        </Card>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t py-6 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Política de Privacidade
          </Link>
          <span className="text-border">|</span>
          <Link to="/data-deletion" className="hover:text-foreground">
            Exclusão de Dados
          </Link>
          <span className="text-border">|</span>
          <Link to="/login" className="hover:text-foreground">
            Login
          </Link>
        </footer>
      </main>
    </div>
  );
}
