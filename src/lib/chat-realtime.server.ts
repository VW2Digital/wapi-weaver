"use server";

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { redis } from "./cache";

const REDIS_CHANNEL = "bliv:chat:realtime:v1";
const LOCAL_EVENT = "chat-event";

export interface ChatRealtimeEvent {
  id?: string;
  type:
    | "message.queued"
    | "message.sent"
    | "message.failed"
    | "message.retry"
    | "message.received"
    | "message.status"
    | "call.signal";
  tenant_id: string;
  contact_phone?: string | null;
  message_id?: string | null;
  provider_message_id?: string | null;
  status?: string | null;
  call_id?: string | null;
  call_event?: string | null;
  sdp?: string | null;
  sdp_type?: string | null;
  occurred_at?: string;
}

interface RealtimeGlobalState {
  emitter: EventEmitter;
  instanceId: string;
  subscriberStarted: boolean;
}

const globalRealtime = globalThis as typeof globalThis & {
  __blivChatRealtime?: RealtimeGlobalState;
};

const state = globalRealtime.__blivChatRealtime ?? {
  emitter: new EventEmitter(),
  instanceId: `${process.pid}-${randomUUID()}`,
  subscriberStarted: false,
};

state.emitter.setMaxListeners(0);
globalRealtime.__blivChatRealtime = state;

function emitLocally(event: ChatRealtimeEvent) {
  state.emitter.emit(LOCAL_EVENT, event);
}

function startRedisSubscriber() {
  if (state.subscriberStarted) return;
  state.subscriberStarted = true;

  const subscriber = redis.duplicate({ enableOfflineQueue: true });
  subscriber.on("message", (_channel, rawMessage) => {
    try {
      const envelope = JSON.parse(rawMessage) as {
        source?: string;
        event?: ChatRealtimeEvent;
      };
      if (!envelope.event || envelope.source === state.instanceId) return;
      emitLocally(envelope.event);
    } catch (error) {
      console.warn("[Chat Realtime] Evento Redis inválido ignorado.", error);
    }
  });
  subscriber.on("error", (error) => {
    console.warn("[Chat Realtime] Redis subscriber indisponível; polling segue ativo.", error);
  });
  void subscriber.subscribe(REDIS_CHANNEL).catch((error) => {
    state.subscriberStarted = false;
    console.warn("[Chat Realtime] Não foi possível assinar o canal Redis.", error);
    subscriber.disconnect();
  });
}

export function subscribeToChatRealtimeEvents(
  listener: (event: ChatRealtimeEvent) => void,
): () => void {
  startRedisSubscriber();
  state.emitter.on(LOCAL_EVENT, listener);
  return () => state.emitter.off(LOCAL_EVENT, listener);
}

export async function publishChatRealtimeEvent(
  input: ChatRealtimeEvent,
): Promise<ChatRealtimeEvent> {
  const event: ChatRealtimeEvent = {
    ...input,
    id: input.id || randomUUID(),
    occurred_at: input.occurred_at || new Date().toISOString(),
  };

  emitLocally(event);
  try {
    await redis.publish(REDIS_CHANNEL, JSON.stringify({ source: state.instanceId, event }));
  } catch (error) {
    console.warn(
      "[Chat Realtime] Redis indisponível; evento entregue apenas nesta instância.",
      error,
    );
  }
  return event;
}
