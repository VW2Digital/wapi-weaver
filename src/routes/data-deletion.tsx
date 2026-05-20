import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Trash2, AlertTriangle, Clock, CheckCircle, Database, Mail, Shield, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Exclusão de Dados do Usuário — ZapDispatch" },
      { name: "description", content: "Solicite a exclusão completa da sua conta e dados pessoais da plataforma ZapDispatch." },
      { property: "og:title", content: "Exclusão de Dados do Usuário — ZapDispatch" },
      { property: "og:description", content: "Solicite a exclusão da sua conta e dados pessoais da ZapDispatch." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  const [requested, setRequested] = useState(false);

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
        <h1 className="font-display text-3xl font-semibold">Exclusão de Dados do Usuário</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você tem o direito de solicitar a exclusão completa da sua conta e de todos os seus dados pessoais.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                O que será excluído
              </CardTitle>
              <CardDescription>Dados removidos permanentemente</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  Perfil de usuário (nome, e-mail, telefone)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  Configurações da conta e credenciais da Meta
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  Contatos importados e listas de distribuição
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  Campanhas, templates e agendamentos
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  Logs de envio e relatórios de mensagens
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                O que não será excluído
              </CardTitle>
              <CardDescription>Dados mantidos por obrigação legal</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Registros fiscais e contábeis (5 anos, conforme lei)
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Logs de segurança e auditoria (2 anos)
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Dados anonimizados para estatísticas
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 space-y-6 p-8">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">Prazos</h2>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li><strong>Processamento:</strong> sua solicitação será processada em até 15 dias úteis.</li>
              <li><strong>Confirmação:</strong> você receberá um e-mail confirmando a exclusão assim que for concluída.</li>
              <li><strong>Logs técnicos:</strong> registros de segurança e auditoria são excluídos automaticamente após 2 anos.</li>
              <li><strong>Retenção fiscal:</strong> dados contábeis são mantidos por 5 anos conforme exigência legal.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="font-display text-xl font-semibold">Consequências da Exclusão</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A exclusão é <strong>irreversível</strong>. Após confirmada:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Sua conta será permanentemente encerrada e não poderá ser reativada.</li>
              <li>Todos os contatos, listas, campanhas e templates serão perdidos sem possibilidade de recuperação.</li>
              <li>Seus números de telefone configurados na Meta não serão afetados, pois são gerenciados diretamente pela Meta.</li>
              <li>Histórico de pagamentos, se houver, será mantido anonimizado para fins fiscais.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h2 className="font-display text-xl font-semibold">Como Solicitar</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Você pode solicitar a exclusão de duas formas:
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Pelo painel (logado):</strong> acesse Configurações → Conta → Excluir conta e confirme sua senha.
                A exclusão será iniciada automaticamente.
              </li>
              <li>
                <strong>Por e-mail:</strong> envie um pedido de exclusão para{" "}
                <a href="mailto:privacidade@zapdispatch.com.br" className="text-primary hover:underline">privacidade@zapdispatch.com.br</a>{" "}
                com o assunto "Solicitação de exclusão de dados". Inclua o e-mail cadastrado na conta para agilizar o processo.
              </li>
            </ol>
          </section>
        </Card>

        <Card className="mt-8 p-8">
          {!requested ? (
            <div className="text-center">
              <Trash2 className="mx-auto h-10 w-10 text-destructive" />
              <h2 className="mt-4 font-display text-xl font-semibold">Solicitar Exclusão por E-mail</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ao clicar abaixo, abriremos seu cliente de e-mail com um modelo de solicitação pronto.
                Você só precisa adicionar o e-mail da sua conta e enviar.
              </p>
              <Button
                className="mt-6"
                variant="destructive"
                onClick={() => {
                  const subject = encodeURIComponent("Solicitação de exclusão de dados - ZapDispatch");
                  const body = encodeURIComponent(
                    `Olá,\n\n` +
                    `Solicito a exclusão completa da minha conta e de todos os meus dados pessoais da plataforma ZapDispatch, conforme previsto na LGPD.\n\n` +
                    `E-mail da conta: [adicione aqui]\n\n` +
                    `Motivo (opcional): \n\n` +
                    `Atenciosamente,`
                  );
                  window.location.href = `mailto:privacidade@zapdispatch.com.br?subject=${subject}&body=${body}`;
                  setRequested(true);
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Abrir E-mail de Solicitação
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
              <h2 className="mt-4 font-display text-xl font-semibold">Solicitação Enviada</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Obrigado. Assim que recebermos sua solicitação por e-mail, processaremos a exclusão em até 15 dias úteis.
                Você receberá uma confirmação no e-mail informado.
              </p>
              <Button className="mt-6" variant="outline" onClick={() => setRequested(false)}>
                Enviar novamente
              </Button>
            </div>
          )}
        </Card>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t py-6 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Política de Privacidade</Link>
          <span className="text-border">|</span>
          <Link to="/terms" className="hover:text-foreground">Termos de Serviço</Link>
          <span className="text-border">|</span>
          <Link to="/login" className="hover:text-foreground">Login</Link>
        </footer>
      </main>
    </div>
  );
}
