import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Shield, Clock, Trash2, Server, Cookie, Users, Mail, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — ZapDispatch" },
      { name: "description", content: "Política de Privacidade da ZapDispatch. Saiba como coletamos, usamos e protegemos seus dados." },
      { property: "og:title", content: "Política de Privacidade — ZapDispatch" },
      { property: "og:description", content: "Saiba como a ZapDispatch coleta, usa e protege seus dados pessoais." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-semibold">ZapDispatch</span>
          </div>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl font-semibold">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <Card className="mt-8 space-y-6 p-8">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">1. Introdução</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A ZapDispatch valoriza a sua privacidade. Esta Política de Privacidade descreve como coletamos,
              usamos, armazenamos e protegemos suas informações pessoais ao utilizar nossa plataforma de disparo
              de mensagens via WhatsApp Cloud API. Ao usar nossos serviços, você concorda com as práticas descritas aqui.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">2. Dados que Coletamos</h2>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li><strong>Informações de conta:</strong> nome, e-mail, telefone e dados de autenticação fornecidos durante o cadastro.</li>
              <li><strong>Configurações do WhatsApp:</strong> token de acesso e ID do número de telefone da Meta que você configura em nossa plataforma.</li>
              <li><strong>Contatos:</strong> nomes e números de telefone importados ou sincronizados manualmente por você.</li>
              <li><strong>Dados de uso:</strong> logs de envio, status de entrega, campanhas criadas e interações com a plataforma.</li>
              <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e logs de acesso.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">3. Como Usamos seus Dados</h2>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Fornecer, operar e manter a plataforma ZapDispatch funcionando corretamente.</li>
              <li>Processar e enviar mensagens via WhatsApp Cloud API conforme suas configurações de campanha.</li>
              <li>Enviar notificações importantes sobre sua conta, campanhas ou alterações nos serviços.</li>
              <li>Melhorar nossos serviços, corrigir bugs e desenvolver novas funcionalidades com base no uso.</li>
              <li>Cumprir obrigações legais e regulatórias, incluindo LGPD e outras legislações aplicáveis.</li>
              <li>Prevenir fraudes, abusos e atividades ilegais na plataforma.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">4. Cookies e Tecnologias Similares</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Utilizamos cookies essenciais para manter sua sessão de login e garantir a segurança da plataforma.
              Não utilizamos cookies de rastreamento para publicidade. Você pode gerenciar cookies nas configurações
              do seu navegador, mas isso pode afetar a funcionalidade da plataforma.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">5. Compartilhamento de Dados</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Não vendemos seus dados pessoais. Compartilhamos informações apenas com:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li><strong>Meta (Facebook):</strong> necessário para o funcionamento da WhatsApp Cloud API — números de destino e conteúdo de mensagens são processados pela Meta.</li>
              <li><strong>Provedores de infraestrutura:</strong> serviços de hospedagem e banco de dados que mantêm a plataforma operacional.</li>
              <li><strong>Autoridades competentes:</strong> quando exigido por lei, ordem judicial ou regulador.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">6. Retenção de Dados</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Mantemos seus dados pessoais pelo tempo necessário para cumprir os propósitos descritos nesta política,
              ou pelo período exigido por lei. Logs de envio de mensagens são retidos por até 2 anos para fins de
              auditoria e conformidade. Após o encerramento da conta, seus dados são excluídos ou anonimizados
              conforme descrito em nossa <Link to="/data-deletion" className="text-primary hover:underline">Política de Exclusão de Dados</Link>.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">7. Segurança</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia em
              trânsito (TLS), controle de acesso baseado em função (RLS), autenticação segura e monitoramento contínuo.
              Apesar dos nossos esforços, nenhum sistema é 100% seguro. Em caso de violação de dados, notificaremos
              os usuários e autoridades conforme exigido por lei.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">8. Seus Direitos (LGPD)</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem os seguintes direitos:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Acessar seus dados pessoais armazenados.</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
              <li>Solicitar a exclusão dos seus dados pessoais.</li>
              <li>Revogar seu consentimento para o processamento de dados.</li>
              <li>Solicitar a portabilidade dos dados para outro serviço.</li>
              <li>Opor-se ao processamento de dados em determinadas circunstâncias.</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Para exercer esses direitos, acesse as <Link to="/data-deletion" className="text-primary hover:underline">Configurações de Exclusão de Dados</Link> ou entre em contato conosco.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">9. Exclusão de Dados</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Você pode solicitar a exclusão completa da sua conta e todos os dados associados a qualquer momento.
              Consulte nossa página dedicada de <Link to="/data-deletion" className="text-primary hover:underline">Exclusão de Dados do Usuário</Link> para mais detalhes sobre o processo e os prazos.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">10. Contato</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Se tiver dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados, entre em contato pelo e-mail:{" "}
              <a href="mailto:privacidade@zapdispatch.com.br" className="text-primary hover:underline">privacidade@zapdispatch.com.br</a>
            </p>
          </section>
        </Card>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t py-6 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">Termos de Serviço</Link>
          <span className="text-border">|</span>
          <Link to="/data-deletion" className="hover:text-foreground">Exclusão de Dados</Link>
          <span className="text-border">|</span>
          <Link to="/login" className="hover:text-foreground">Login</Link>
        </footer>
      </main>
    </div>
  );
}
