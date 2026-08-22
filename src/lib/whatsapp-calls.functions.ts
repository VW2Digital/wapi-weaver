import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";
import { dbAdmin } from "@/integrations/mysql/client.server";
import db from "@/lib/db";

// Tipos para chamadas WhatsApp
export type CallDirection = "inbound" | "outbound";
export type CallStatus = "incoming" | "connecting" | "ringing" | "active" | "rejected" | "ended" | "failed";

export interface WhatsAppCall {
  id: string;
  tenant_id: string;
  chat_session_id: string | null;
  contact_id: string | null;
  phone_number_id: string;
  whatsapp_call_id: string;
  direction: CallDirection;
  status: CallStatus;
  started_at: Date | null;
  answered_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CallWebhookEvent {
  id: string;
  direction?: string;
  event: string;
  from?: string;
  to?: string;
  timestamp?: string;
  from_user_id?: string;
  session?: {
    sdp?: string;
    sdp_type?: string;
  };
}

/**
 * Salva ou atualiza uma chamada no banco de dados
 */
export async function saveCall(params: {
  tenantId: string;
  chatSessionId?: string | null;
  contactId?: string | null;
  phoneNumberId: string;
  whatsappCallId: string;
  direction: CallDirection;
  status: CallStatus;
}): Promise<WhatsAppCall> {
  const {
    tenantId,
    chatSessionId = null,
    contactId = null,
    phoneNumberId,
    whatsappCallId,
    direction,
    status,
  } = params;

  const id = randomUUID();
  const now = new Date();

  const { data: existingCall } = await dbAdmin
    .from("whatsapp_calls")
    .select("*")
    .eq("whatsapp_call_id", whatsappCallId)
    .maybeSingle();

  if (existingCall) {
    const updateData: Record<string, any> = {
      status,
      updated_at: now,
    };
    if (chatSessionId && !existingCall.chat_session_id) {
      updateData.chat_session_id = chatSessionId;
    }
    if (contactId && !existingCall.contact_id) {
      updateData.contact_id = contactId;
    }
    if (status === "active") {
      updateData.answered_at = now;
    }
    if (status === "ended" || status === "rejected" || status === "failed") {
      updateData.ended_at = now;
      if (existingCall.started_at) {
        const start = new Date(existingCall.started_at).getTime();
        const duration = Math.max(0, Math.floor((now.getTime() - start) / 1000));
        updateData.duration_seconds = duration;
      }
    }

    const { data: updatedCall } = await dbAdmin
      .from("whatsapp_calls")
      .update(updateData)
      .eq("whatsapp_call_id", whatsappCallId)
      .select()
      .single();

    return (updatedCall || existingCall) as WhatsAppCall;
  }

  // Criar nova chamada
  const { data: newCall } = await dbAdmin
    .from("whatsapp_calls")
    .insert({
      id,
      tenant_id: tenantId,
      chat_session_id: chatSessionId,
      contact_id: contactId,
      phone_number_id: phoneNumberId,
      whatsapp_call_id: whatsappCallId,
      direction,
      status,
      started_at: now,
      answered_at: status === "active" ? now : null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  return (newCall || {
    id,
    tenant_id: tenantId,
    chat_session_id: chatSessionId,
    contact_id: contactId,
    phone_number_id: phoneNumberId,
    whatsapp_call_id: whatsappCallId,
    direction,
    status,
    started_at: now,
    answered_at: status === "active" ? now : null,
    ended_at: null,
    duration_seconds: null,
    created_at: now,
    updated_at: now,
  }) as WhatsAppCall;
}

/**
 * Obtém uma chamada pelo WhatsApp Call ID
 */
export async function getCallByWhatsAppId(whatsappCallId: string): Promise<WhatsAppCall | null> {
  const { data } = await dbAdmin
    .from("whatsapp_calls")
    .select("*")
    .eq("whatsapp_call_id", whatsappCallId)
    .maybeSingle();

  return (data || null) as WhatsAppCall | null;
}

/**
 * Lista chamadas de um tenant
 */
export async function listCallsByTenant(tenantId: string, limit = 50): Promise<WhatsAppCall[]> {
  const { data } = await dbAdmin
    .from("whatsapp_calls")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as WhatsAppCall[];
}

/**
 * Atualiza o status de uma chamada
 */
export async function updateCallStatus(whatsappCallId: string, status: CallStatus): Promise<void> {
  const now = new Date();
  const updateData: Record<string, any> = {
    status,
    updated_at: now,
  };

  if (status === "active") {
    updateData.answered_at = now;
  } else if (status === "ended" || status === "rejected" || status === "failed") {
    updateData.ended_at = now;
  }

  await dbAdmin
    .from("whatsapp_calls")
    .update(updateData)
    .eq("whatsapp_call_id", whatsappCallId);
}

/**
 * Verifica se existe uma chamada ativa para um tenant
 */
export async function hasActiveCall(tenantId: string): Promise<boolean> {
  const { data } = await dbAdmin
    .from("whatsapp_calls")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["incoming", "connecting", "ringing", "active"])
    .maybeSingle();

  return !!data;
}