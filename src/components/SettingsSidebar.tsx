import {
  KeyRound,
  Database,
  QrCode,
  Settings,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MetaIcon, WhatsAppIcon } from "@/components/brand-icons";
import { SettingsNavItem, SettingsNavSection } from "@/components/layout/settings-nav-item";

export function SettingsSidebar({
  activeSection,
  setActiveSection,
  isAdmin,
  form,
}: {
  activeSection: string | null;
  setActiveSection: (section: string) => void;
  isAdmin: boolean;
  form: any;
}) {
  return (
    <nav className="space-y-4" aria-label="Seções de configuração">
      <SettingsNavSection title="Conexões & APIs" icon={KeyRound}>
        <SettingsNavItem
          active={activeSection === "meta"}
          onClick={() => setActiveSection("meta")}
          icon={MetaIcon}
          iconWrapperClassName="bg-[#0064E0]/10 text-[#0064E0]"
          title="Conexão Meta"
          description="Configurações de aplicativo, credenciais e webhook da Meta."
          badge={
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] border-none font-semibold",
                form.hasAccessToken
                  ? "bg-success/15 text-success hover:bg-success/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {form.hasAccessToken ? "Configurado" : "Pendente"}
            </Badge>
          }
        />
        <SettingsNavItem
          active={activeSection === "waba"}
          onClick={() => setActiveSection("waba")}
          icon={WhatsAppIcon}
          iconWrapperClassName="bg-[#25D366]/10 text-[#25D366]"
          title="WhatsApp (WABA)"
          description="Gerenciamento de instâncias, templates e permissões de chamadas."
          badge={
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] border-none font-semibold",
                form.whatsapp_phone_number_id
                  ? "bg-success/15 text-success hover:bg-success/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {form.whatsapp_phone_number_id ? "Configurado" : "Pendente"}
            </Badge>
          }
        />
      </SettingsNavSection>

      <SettingsNavSection title="Integrações & Extra" icon={Database}>
        <SettingsNavItem
          active={activeSection === "crm"}
          onClick={() => setActiveSection("crm")}
          icon={Database}
          title="Integrações CRM"
          description="Conexão com plataformas externas e Webhook de Entrada."
        />
        <SettingsNavItem
          active={activeSection === "qrcodes"}
          onClick={() => setActiveSection("qrcodes")}
          icon={QrCode}
          title="QR Codes"
          description="Gerador de links e QR Codes de conversa rápida."
        />
      </SettingsNavSection>

      <SettingsNavSection title="Configurações Gerais" icon={Settings}>
        <SettingsNavItem
          active={activeSection === "advanced"}
          onClick={() => setActiveSection("advanced")}
          icon={Settings}
          title="Ferramentas Avançadas"
          description="Sandbox avançada, logs e comandos do sistema."
        />
        <SettingsNavItem
          active={activeSection === "general"}
          onClick={() => setActiveSection("general")}
          icon={Monitor}
          title="Geral & Legal"
          description="Termos de uso, políticas de privacidade e tags globais."
        />
        {isAdmin && (
          <SettingsNavItem
            active={activeSection === "admin"}
            onClick={() => setActiveSection("admin")}
            icon={ShieldCheck}
            title="Administração"
            description="Configurações globais do servidor, auditoria e backups."
          />
        )}
      </SettingsNavSection>
    </nav>
  );
}
