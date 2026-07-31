import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Trash2, Sparkles, Bot, AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface MessageItem {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
}

interface TabTestChatProps {
  agentName: string;
  agentId: string;
  onSendTestMessage: (message: string) => Promise<{ reply: string }>;
}

export function TabTestChat({ agentName, agentId, onSendTestMessage }: TabTestChatProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsgText = inputText.trim();
    setInputText("");

    const userMessage: MessageItem = {
      id: String(Date.now()),
      sender: "user",
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await onSendTestMessage(userMsgText);
      const agentMessage: MessageItem = {
        id: String(Date.now() + 1),
        sender: "agent",
        text: res.reply || "Resposta simulada recebida com sucesso.",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      const errorMessage: MessageItem = {
        id: String(Date.now() + 1),
        sender: "agent",
        text: "Ocorreu um erro ao simular a resposta do agente.",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-[620px] shadow-md overflow-hidden">
      {/* Test Chat Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold text-foreground flex items-center gap-2">
              {agentName || "DS Agente"}
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                Ambiente de Teste
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">Respostas simuladas e fictícias (sem custo de tokens)</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMessages([])}
          className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Limpar Chat
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            <div className="rounded-full bg-muted border border-border p-4 text-primary mb-3">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h4 className="text-base font-display font-semibold text-foreground">Envie uma mensagem para testar o agente</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              As respostas são simuladas e fictícias. Utilize este ambiente para validar o comportamento e persona do seu agente antes de publicar.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.sender === "agent" && (
                <div className="rounded-full bg-primary/10 text-primary h-8 w-8 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.sender === "user"
                    ? "bg-primary text-primary-foreground font-medium rounded-tr-none shadow-sm"
                    : "bg-card border border-border text-foreground rounded-tl-none shadow-sm"
                }`}
              >
                <p>{m.text}</p>
                <span
                  className={`block text-[10px] mt-1 text-right ${
                    m.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {m.timestamp}
                </span>
              </div>

              {m.sender === "user" && (
                <div className="rounded-full bg-muted text-muted-foreground h-8 w-8 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 text-primary h-8 w-8 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 animate-pulse" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-card border border-border px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
              Agente simulado pensando na resposta...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer Input Area & Warning */}
      <div className="border-t border-border bg-card p-4 space-y-2">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            placeholder="Digite uma mensagem para testar..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="bg-brand-gradient text-white font-semibold shadow-md hover:opacity-95"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-500 font-medium pt-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Ambiente de teste — respostas simuladas e fictícias</span>
        </div>
      </div>
    </div>
  );
}
