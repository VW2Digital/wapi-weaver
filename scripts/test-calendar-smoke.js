import {
  createCalendarEventForUser,
  getCalendarEventsByRangeForUser,
  getCalendarEventByIdForUser,
  updateCalendarEventForUser,
  cancelCalendarEventForUser,
  deleteCalendarEventForUser,
  checkCalendarConflictForUser,
  checkCalendarAvailabilityForUser,
  findNextAvailableCalendarSlots,
} from "../src/lib/services/calendar.service.js";
import { executeDsAgentCalendarTool } from "../src/lib/ds-agent-tools.server.js";
import db from "../src/lib/db.js";

async function runCalendarSmokeTest() {
  console.log("==================================================");
  console.log("  INICIANDO SMOKE TEST: AGENDA & DS AGENTS TOOLS");
  console.log("==================================================");

  const tenantA = "smoke-test-tenant-a-" + Date.now();
  const tenantB = "smoke-test-tenant-b-" + Date.now();

  try {
    // Insert mock users & agent for foreign keys if required
    await db.query(
      `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?), (?, ?, ?)`,
      [tenantA, `tenantA_${Date.now()}@test.com`, "hash", tenantB, `tenantB_${Date.now()}@test.com`, "hash"],
    );

    const agentId = "smoke-agent-" + Date.now();
    await db.query(
      `INSERT INTO ds_agents (id, tenant_id, name, provider, model) VALUES (?, ?, ?, ?, ?)`,
      [agentId, tenantA, "Agente Vendas Teste", "gemini", "gemini-2.5-flash"],
    );

    // 1. CREATE EVENT
    console.log("\n[1/10] Testando createCalendarEventForUser...");
    const createRes = await createCalendarEventForUser(tenantA, {
      title: "Reunião de Demonstração Teste",
      description: "Teste automatizado da agenda",
      start_at: "2026-11-10T14:00:00.000Z",
      end_at: "2026-11-10T15:00:00.000Z",
      event_type: "demonstracao",
      status: "agendado",
      color: "#7C3AED",
    });

    const eventId = createRes.event.id;
    console.log("✓ Evento criado com sucesso. ID:", eventId);

    // 2. GET BY ID
    console.log("\n[2/10] Testando getCalendarEventByIdForUser...");
    const fetched = await getCalendarEventByIdForUser(tenantA, eventId);
    if (!fetched || fetched.title !== "Reunião de Demonstração Teste") {
      throw new Error("Falha ao obter evento por ID");
    }
    console.log("✓ Evento obtido por ID com sucesso");

    // 3. RANGE QUERY
    console.log("\n[3/10] Testando getCalendarEventsByRangeForUser...");
    const rangeEvents = await getCalendarEventsByRangeForUser(
      tenantA,
      "2026-11-10 00:00:00",
      "2026-11-10 23:59:59",
    );
    if (rangeEvents.length === 0) {
      throw new Error("Falha no range query - nenhum evento encontrado");
    }
    console.log(`✓ Range query retornou ${rangeEvents.length} evento(s)`);

    // 4. CONFLICT CHECK
    console.log("\n[4/10] Testando checkCalendarConflictForUser...");
    const conflictRes = await checkCalendarConflictForUser(
      tenantA,
      "2026-11-10T14:30:00.000Z",
      "2026-11-10T15:30:00.000Z",
    );
    if (!conflictRes.hasConflict) {
      throw new Error("Falha no teste de conflito: deveria identificar sobreposição!");
    }
    console.log("✓ Conflito identificado com sucesso");

    // 5. UPDATE EVENT
    console.log("\n[5/10] Testando updateCalendarEventForUser...");
    await updateCalendarEventForUser(tenantA, eventId, {
      title: "Reunião Atualizada Teste",
      status: "confirmado",
    });
    const updated = await getCalendarEventByIdForUser(tenantA, eventId);
    if (updated.title !== "Reunião Atualizada Teste" || updated.status !== "confirmado") {
      throw new Error("Falha na atualização do evento");
    }
    console.log("✓ Evento atualizado com sucesso");

    // 6. CANCEL EVENT & CONFLICT RETEST
    console.log("\n[6/10] Testando cancelCalendarEventForUser (status = cancelled)...");
    await cancelCalendarEventForUser(tenantA, eventId);
    const cancelled = await getCalendarEventByIdForUser(tenantA, eventId);
    if (cancelled.status !== "cancelled") {
      throw new Error("Falha no cancelamento do evento");
    }

    const conflictAfterCancel = await checkCalendarConflictForUser(
      tenantA,
      "2026-11-10T14:30:00.000Z",
      "2026-11-10T15:30:00.000Z",
    );
    if (conflictAfterCancel.hasConflict) {
      throw new Error("Evento cancelado não deveria gerar conflito de horário!");
    }
    console.log("✓ Evento cancelado não bloqueia mais o horário");

    // 7. SOFT DELETE
    console.log("\n[7/10] Testando deleteCalendarEventForUser (soft delete)...");
    await deleteCalendarEventForUser(tenantA, eventId);
    const deletedFetch = await getCalendarEventByIdForUser(tenantA, eventId);
    if (deletedFetch !== null) {
      throw new Error("Evento deletado ainda é retornado na busca normal!");
    }
    console.log("✓ Soft delete confirmado (deleted_at IS NOT NULL)");

    // 8. MULTI-TENANT ISOLATION
    console.log("\n[8/10] Testando Isolamento Multi-Tenant...");
    const tenantAEventRes = await createCalendarEventForUser(tenantA, {
      title: "Segredo do Tenant A",
      start_at: "2026-11-12T10:00:00.000Z",
      end_at: "2026-11-12T11:00:00.000Z",
    });
    const tenantAEventId = tenantAEventRes.event.id;

    const accessFromTenantB = await getCalendarEventByIdForUser(tenantB, tenantAEventId);
    if (accessFromTenantB !== null) {
      throw new Error("VIOLAÇÃO DE MULTI-TENANT: Tenant B conseguiu acessar evento do Tenant A!");
    }
    console.log("✓ Isolamento Multi-Tenant estrito confirmado");

    // 9. DS AGENT TOOLS
    console.log("\n[9/10] Testando Execução das Ferramentas dos DS Agents...");
    // Create busy event
    await createCalendarEventForUser(tenantA, {
      title: "Reunião Ocupada DS Agent",
      start_at: "2026-11-15T14:00:00.000Z",
      end_at: "2026-11-15T15:00:00.000Z",
      ds_agent_id: agentId,
    });

    // Check availability
    const availToolRes = await executeDsAgentCalendarTool(
      agentId,
      tenantA,
      "calendar_check_availability",
      { date: "2026-11-15", start_time: "14:00", end_time: "15:00" },
    );
    if (availToolRes.available !== false || availToolRes.alternatives.length === 0) {
      throw new Error("Falha na tool calendar_check_availability: deveria retornar disponível=false e alternativas!");
    }
    console.log("✓ Tool calendar_check_availability retornou alternativas disponíveis:", availToolRes.alternatives.length);

    // Create event via tool
    const agentCreateRes = await executeDsAgentCalendarTool(
      agentId,
      tenantA,
      "calendar_create_event",
      {
        title: "Agendamento via DS Agent",
        start_at: "2026-11-15T16:00:00.000Z",
        end_at: "2026-11-15T17:00:00.000Z",
      },
    );
    if (!agentCreateRes.ok || agentCreateRes.event.created_by_type !== "ds_agent") {
      throw new Error("Falha na tool calendar_create_event: created_by_type incorreto!");
    }
    console.log("✓ Tool calendar_create_event executada com sucesso");

    // List events via tool
    const agentListRes = await executeDsAgentCalendarTool(
      agentId,
      tenantA,
      "calendar_list_events",
      { date: "2026-11-15 00:00:00" },
    );
    if (!agentListRes.ok || agentListRes.count === 0) {
      throw new Error("Falha na tool calendar_list_events!");
    }
    console.log(`✓ Tool calendar_list_events listou ${agentListRes.count} eventos`);

    // Get event via tool
    const agentGetRes = await executeDsAgentCalendarTool(
      agentId,
      tenantA,
      "calendar_get_event",
      { event_id: agentCreateRes.event.id },
    );
    if (!agentGetRes.ok || !agentGetRes.event) {
      throw new Error("Falha na tool calendar_get_event!");
    }
    console.log("✓ Tool calendar_get_event executada com sucesso");

    // Cancel event via tool
    const agentCancelRes = await executeDsAgentCalendarTool(
      agentId,
      tenantA,
      "calendar_cancel_event",
      { event_id: agentCreateRes.event.id },
    );
    if (!agentCancelRes.ok) {
      throw new Error("Falha na tool calendar_cancel_event!");
    }
    console.log("✓ Tool calendar_cancel_event executada com sucesso");

    // 10. CLEANUP
    console.log("\n[10/10] Efetuando Limpeza dos dados temporários do teste...");
    await db.query("DELETE FROM calendar_events WHERE tenant_id IN (?, ?)", [tenantA, tenantB]);
    await db.query("DELETE FROM ds_agents WHERE tenant_id IN (?, ?)", [tenantA, tenantB]);
    await db.query("DELETE FROM users WHERE id IN (?, ?)", [tenantA, tenantB]);
    console.log("✓ Limpeza de teste concluída");

    console.log("\n==================================================");
    console.log("   TODOS OS TESTES DA AGENDA PASSARAM COM SUCESSO!");
    console.log("==================================================");
  } catch (err) {
    console.error("\n❌ ERRO NO SMOKE TEST DA AGENDA:", err);
    // Clean up if possible
    try {
      await db.query("DELETE FROM calendar_events WHERE tenant_id IN (?, ?)", [tenantA, tenantB]);
      await db.query("DELETE FROM ds_agents WHERE tenant_id IN (?, ?)", [tenantA, tenantB]);
      await db.query("DELETE FROM users WHERE id IN (?, ?)", [tenantA, tenantB]);
    } catch {}
    process.exit(1);
  }
}

runCalendarSmokeTest();
