import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { resolveEffectiveUserId } from "@/lib/chat-helpers";
import {
  assumeInstagramAttendance,
  getInstagramAttentionView,
  resumeInstagramAutomation,
} from "@/lib/instagram/attention.server";

const phoneInput = z.object({
  contactPhone: z.string().trim().min(5),
});

export const getInstagramAttention = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) => phoneInput.parse(data))
  .handler(async ({ data, context }) => {
    const tenantId = await resolveEffectiveUserId(context.userId);
    return getInstagramAttentionView(tenantId, data.contactPhone);
  });

export const assumeInstagramHumanAttendance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) => phoneInput.parse(data))
  .handler(async ({ data, context }) => {
    const tenantId = await resolveEffectiveUserId(context.userId);
    await assumeInstagramAttendance({
      tenantId,
      actorUserId: context.userId,
      contactPhone: data.contactPhone,
    });
    return getInstagramAttentionView(tenantId, data.contactPhone);
  });

export const resumeInstagramAutomationAttendance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) => phoneInput.parse(data))
  .handler(async ({ data, context }) => {
    const tenantId = await resolveEffectiveUserId(context.userId);
    await resumeInstagramAutomation({
      tenantId,
      actorUserId: context.userId,
      contactPhone: data.contactPhone,
    });
    return getInstagramAttentionView(tenantId, data.contactPhone);
  });
