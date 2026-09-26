import { describe, expect, test } from "@jest/globals";
import { parseWhatsAppCallPermissionsResponse } from "../../src/lib/profile.functions";

describe("call_permissions da Meta", () => {
  test("reconhece permissão temporária e ações oficiais", () => {
    const parsed = parseWhatsAppCallPermissionsResponse({
      messaging_product: "whatsapp",
      permission: { status: "temporary", expiration_time: 1745343479 },
      actions: [
        {
          action_name: "send_call_permission_request",
          can_perform_action: true,
        },
        {
          action_name: "start_call",
          can_perform_action: true,
        },
      ],
    });
    expect(parsed.is_granted).toBe(true);
    expect(parsed.status).toBe("temporary");
    expect(parsed.can_start_call).toBe(true);
  });

  test("no_permission não autoriza ligar", () => {
    const parsed = parseWhatsAppCallPermissionsResponse({
      permission: { status: "no_permission" },
      actions: [
        {
          action_name: "start_call",
          can_perform_action: false,
        },
        {
          action_name: "send_call_permission_request",
          can_perform_action: true,
        },
      ],
    });
    expect(parsed.is_granted).toBe(false);
    expect(parsed.can_start_call).toBe(false);
    expect(parsed.can_send_request).toBe(true);
  });

  test("permissão permanente sem expiration", () => {
    const parsed = parseWhatsAppCallPermissionsResponse({
      permission: { status: "permanent" },
      actions: [{ action_name: "start_call", can_perform_action: true }],
    });
    expect(parsed.is_granted).toBe(true);
    expect(parsed.status).toBe("permanent");
  });
});
