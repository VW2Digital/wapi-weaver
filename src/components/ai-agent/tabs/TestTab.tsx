import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { sendTestMessage } from "@/lib/ds-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Bot, User, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "model";
  content: string;
}

export function TestTab({ agentId, agentData }: { agentId: string | null; agentData: any }) {
  const sendMessageFn = useServerFn(sendTestMessage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial welcome message
    if (agentData?.name) {
      setMessages([
        {
          role: "model",
          content: `Olá! Sou o agente **${agentData.name}**. Como posso ajudar você hoje?`,
        },
      ]);
    }
  }, [agentData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: async (text: string) => {
      const response = await sendMessageFn({
        data: {
          agent_id: agentId!,
          message: text,
          history: messages,
        },
      });
      return response as Message;
    },
    onSuccess: (reply) => {
      if (reply) {
        setMessages((prev) => [...prev, reply]);
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao obter resposta do agente.");
      setMessages((prev) => [
        ...prev,
        { role: "model", content: "⚠️ Ocorreu um erro ao processar a mensagem." },
      ]);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMut.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    sendMut.mutate(trimmed);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "model",
        content: `Chat reiniciado. Como posso ajudar você hoje?`,
      },
    ]);
  };

  if (!agentId) return <div className="p-12 text-center text-muted-foreground">Salve o agente primeiro.</div>;

  return (
    <div className="flex h-[550px] max-w-4xl mx-auto flex-col border rounded-lg overflow-hidden bg-background">
      {/* Simulator Header */}
      <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-sm">Simulador de Conversa</h4>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={clearChat} title="Limpar conversa">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-muted/5">
        {messages.map((msg, i) => {
          const isModel = msg.role === "model";
          return (
            <div
              key={i}
              className={`flex items-start gap-2.5 max-w-[85%] ${
                isModel ? "self-start" : "self-end flex-row-reverse"
              }`}
            >
              <div
                className={`p-2 rounded-full shrink-0 ${
                  isModel ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {isModel ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap ${
                  isModel
                    ? "bg-background text-foreground border"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        {sendMut.isPending && (
          <div className="flex items-start gap-2.5 max-w-[80%] self-start">
            <div className="p-2 bg-primary/10 text-primary rounded-full shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-background text-foreground border rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Agente pensando...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input controls */}
      <div className="p-3 border-t bg-background flex gap-2">
        <Input
          placeholder="Digite sua mensagem de teste..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={sendMut.isPending}
        />
        <Button onClick={handleSend} disabled={!input.trim() || sendMut.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
