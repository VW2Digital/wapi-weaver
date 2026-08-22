import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";
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
  direction: string;
  event: string;
  from: string;
  to: string;
  timestamp: string;
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
  chatSessionId?: string;
  contactId?: string;
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

  const { data: existingCall } = await db
    .from("whatsapp_calls")
    .select("*")
    .eq("whatsapp_call_id", whatsappCallId)
    .maybeSingle();

  if (existingCall) {
    // Atualizar chamada existente
    const { data: updatedCall } = await db
      .from("whatsapp_calls")
      .update({
        status,
        updated_at: now,
        ...(status === "active" && { answered_at: now }),
        ...(status === "ended" || status === "rejected" || status === "failed" ? { ended_at: now } : {}),
      })
      .eq("whatsapp_call_id", whatsappCallId)
      .select()
      .single();

    return updatedCall as WhatsAppCall;
  }

  // Criar nova chamada
  const { data: newCall } = await db
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
      started_at: status === "active" ? now : null,
      answered_at: status === "active" ? now : null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  return newCall as WhatsAppCall;
}

/**
 * Obtém uma chamada pelo WhatsApp Call ID
 */
export async function getCallByWhatsAppId(whatsappCallId: string): Promise<WhatsAppCall | null> {
  const { data } = await db
    .from("whatsapp_calls")
    .select("*")
    .eq("whatsapp_call_id", whatsappCallId)
    .maybeSingle();

  return data as WhatsAppCall | null;
}

/**
 * Lista chamadas de um tenant
 */
export async function listCallsByTenant(tenantId: string, limit = 50): Promise<WhatsAppCall[]> {
  const { data } = await db
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
  const updateData: any = {
    status,
    updated_at: now,
  };

  if (status === "active") {
    updateData.answered_at = now;
  } else if (status === "ended" || status === "rejected" || status === "failed") {
    updateData.ended_at = now;
  }

  await db
    .from("whatsapp_calls")
    .update(updateData)
    .eq("whatsapp_call_id", whatsappCallId);
}

/**
 * Verifica se existe uma chamada ativa para um tenant
 */
export async function hasActiveCall(tenantId: string): Promise<boolean> {
  const { data } = await db
    .from("whatsapp_calls")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["incoming", "connecting", "ringing", "active"])
    .maybeSingle();

  return !!data;
}