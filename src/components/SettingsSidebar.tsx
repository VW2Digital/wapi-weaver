import React from 'react';
import { KeyRound, Phone, MessageSquare, Facebook, Database, QrCode, Settings, Monitor, ShieldCheck, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function SettingsSidebar({ activeSection, setActiveSection, isAdmin, form }: {
  activeSection: string | null;
  setActiveSection: (section: string) => void;
  isAdmin: boolean;
  form: any;
}) {
  return (
    <div className="space-y-3">
      {/* CONEXÕES & APIS */}
      <div className="space-y-3">
        <h4 className="px-3 text-xs font-bold tracking-wider text-muted-foreground/75 uppercase flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Conexões & APIs
        </h4>
        <div className="flex flex-col gap-1 mt-2">
          {/* Conexão Meta */}
          <button
            onClick={() => setActiveSection('meta')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-semibold text-sm text-foreground">Conexão Meta</h5>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] border-none font-semibold",
                      form.whatsapp_access_token ? "bg-success/15 text-success hover:bg-success/20" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {form.whatsapp_access_token ? 'Configurado' : 'Pendente'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configurações de aplicativo, credenciais e webhook da Meta.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* WhatsApp WABA */}
          <button
            onClick={() => setActiveSection('waba')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="font-semibold text-sm text-foreground">WhatsApp (WABA)</h5>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] border-none font-semibold",
                      form.whatsapp_phone_number_id ? "bg-success/15 text-success hover:bg-success/20" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {form.whatsapp_phone_number_id ? 'Configurado' : 'Pendente'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gerenciamento de instâncias, templates e permissões de chamadas.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Instagram */}
          <button
            onClick={() => setActiveSection('instagram')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h5 className="font-semibold text-sm text-foreground">Instagram</h5>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Integração de mensagens diretas e automação para Instagram.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Facebook */}
          <button
            onClick={() => setActiveSection('facebook')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-100 transition-transform">
                <Facebook className="h-5 w-5" />
              </div>
              <div>
                <h5 className="font-semibold text-sm text-foreground">Facebook</h5>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conexão de páginas para atendimento via Facebook Messenger.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* INTEGRAÇÕES & EXTRA */}
      <div className="space-y-3">
        <h4 className="px-3 text-xs font-bold tracking-wider text-muted-foreground/75 uppercase flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" /> Integrações & Extra
        </h4>
        <div className="flex flex-col gap-1 mt-2">
          {/* CRM */}
          <button
            onClick={() => setActiveSection('crm')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h5 className="font-semibold text-sm text-foreground">Integrações CRM</h5>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conexão com plataformas externas e Webhook de Entrada.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* QR Codes */}
          <button
            onClick={() => setActiveSection('qrcodes')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h5 className="font-semibold text-sm text-foreground">QR Codes</h5>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gerador de links e QR Codes de conversa rápida.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* CONFIGURAÇÕES GERAIS */}
      <div className="space-y-3">
        <h4 className="px-3 text-xs font-bold tracking-wider text-muted-foreground/75 uppercase flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5" /> Configurações Gerais
        </h4>
        <div className="flex flex-col gap-1 mt-2">
          {/* Ferramentas Avançadas */}
          <button
            onClick={() => setActiveSection('advanced')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h5 className="font-semibold text-sm text-foreground">Ferramentas Avançadas</h5>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sandbox avançada, logs e comandos do sistema.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Geral & Legal */}
          <button
            onClick={() => setActiveSection('general')}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <h5 className="font-semibold text-sm text-foreground">Geral & Legal</h5>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Termos de uso, políticas de privacidade e tags globais.
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Administração */}
          {isAdmin && (
            <button
              onClick={() => setActiveSection('admin')}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-semibold text-sm text-foreground">Administração</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configurações globais do servidor, auditoria e backups.
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
