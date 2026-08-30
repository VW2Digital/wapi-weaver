import { describe, expect, test } from "@jest/globals";
import { BullMQWhatsAppQueue, BullMQInstagramQueue } from "@/lib/omnichannel-next/infrastructure/bullmq";
import { FakeBullMQQueue } from "./test-fixtures";
import type { OutboundJob } from "@/lib/omnichannel-next/application/outbox/outbound-job";

const waJob: OutboundJob = {
  id: "j-wa-1",
  tenantId: "t1",
  messageId: "m-wa-1",
  conversationId: "conv-wa-1",
  channelConnectionId: "channel-wa-1",
  provider: "whatsapp",
  recipient: "contact-wa-1",
  message: { type: "text", text: "oi" },
  attempt: 0,
  createdAt: new Date().toISOString(),
};

const igJob: OutboundJob = {
  id: "j-ig-1",
  tenantId: "t1",
  messageId: "m-ig-1",
  conversationId: "conv-ig-1",
  channelConnectionId: "channel-ig-1",
  provider: "instagram",
  recipient: "contact-ig-1",
  message: { type: "text", text: "oi" },
  attempt: 0,
  createdAt: new Date().toISOString(),
};

describe("BullMQWhatsAppQueue", () => {
  test("enqueues a whatsapp job with safe payload", async () => {
    const fake = new FakeBullMQQueue();
    const queue = new BullMQWhatsAppQueue(fake);

    await queue.enqueue(waJob);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].name).toBe("outbound");
    expect(fake.calls[0].opts?.jobId).toBe(waJob.id);
    const data = fake.calls[0].data as OutboundJob;
    expect(data.provider).toBe("whatsapp");
    expect(data).not.toHaveProperty("accessToken");
    expect(data).not.toHaveProperty("appSecret");
  });

  test("rejects an instagram job", async () => {
    const fake = new FakeBullMQQueue();
    const queue = new BullMQWhatsAppQueue(fake);

    await expect(queue.enqueue(igJob)).rejects.toThrow(/cannot receive/);
  });

  test("surfaces queue failures", async () => {
    const fake = new FakeBullMQQueue();
    fake.shouldThrow = true;
    const queue = new BullMQWhatsAppQueue(fake);

    await expect(queue.enqueue(waJob)).rejects.toThrow("BullMQ add failed");
  });
});

describe("BullMQInstagramQueue", () => {
  test("enqueues an instagram job", async () => {
    const fake = new FakeBullMQQueue();
    const queue = new BullMQInstagramQueue(fake);

    await queue.enqueue(igJob);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].opts?.jobId).toBe(igJob.id);
    const data = fake.calls[0].data as OutboundJob;
    expect(data.provider).toBe("instagram");
  });

  test("rejects a whatsapp job", async () => {
    const fake = new FakeBullMQQueue();
    const queue = new BullMQInstagramQueue(fake);

    await expect(queue.enqueue(waJob)).rejects.toThrow(/cannot receive/);
  });
});
