import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Phone, Loader2 } from "lucide-react";
import { checkCallPermissions, enableCallingAPI, manageCall } from "@/lib/profile.functions";
import { toast } from "sonner";

interface CallButtonProps {
  phoneId: string;
  recipientPhone: string;
  contactName?: string | null;
  disabled?: boolean;
}

export function CallButton({
  phoneId,
  recipientPhone,
  contactName,
  disabled = false,
}: CallButtonProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  const checkPerms = useServerFn(checkCallPermissions);
  const enableCallingFn = useServerFn(enableCallingAPI);
  const manageCallFn = useServerFn(manageCall);

  const handleCall = async () => {
    setIsChecking(true);
    try {
      // Verificar permissões de chamada
      let permResult = await checkPerms({
        data: {
          phoneId,
          recipientPhone,
        },
      });

      // Se a Calling API não estiver habilitada no número, tenta habilitar automaticamente via API da Meta
      if (
        !permResult.ok &&
        typeof permResult.error === "string" &&
        permResult.error.toLowerCase().includes("calling api not enabled")
      ) {
        toast.info("Habilitando Calling API no seu número WhatsApp na Meta...");
        const enableRes = await enableCallingFn({ data: { phoneId } });
        if (enableRes.ok) {
          toast.success("Calling API habilitada com sucesso no número!");
          // Retenta a verificação de permissões
          permResult = await checkPerms({
            data: {
              phoneId,
              recipientPhone,
            },
          });
        }
      }

      if (!permResult.ok) {
        toast.error(permResult.error || "Erro ao verificar permissões");
        return;
      }

      const permissionStatus = permResult.data?.data?.[0]?.status;
      
      if (permissionStatus !== "granted") {
        toast.error("Sem permissão para ligar: O cliente ainda não autorizou chamadas para este número.");
        return;
      }

      // Iniciar chamada
      setIsCalling(true);
      
      const callResult = await manageCallFn({
        data: {
          phoneId,
          action: "connect",
          to: recipientPhone,
        },
      });

      if (!callResult.ok) {
        toast.error(callResult.error || "Erro ao iniciar chamada");
        return;
      }

      toast.success(`Chamando ${contactName || recipientPhone}...`);

    } catch (error: any) {
      console.error("[CALL] Erro ao iniciar chamada:", error);
      toast.error(error?.message || "Falha ao iniciar chamada.");
    } finally {
      setIsChecking(false);
      setIsCalling(false);
    }
  };

  return (
    <Button
      onClick={handleCall}
      disabled={disabled || isChecking || isCalling}
      size="sm"
      variant="outline"
    >
      {isChecking || isCalling ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Phone className="h-4 w-4 mr-2" />
      )}
      Ligar
    </Button>
  );
}