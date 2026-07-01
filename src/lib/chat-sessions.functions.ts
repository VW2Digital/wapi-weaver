import crypto from "crypto";
import db from "./db";

export async function startChatSession(userId: string, contactId: string, status: string = 'aguardando') {
  const sessionId = crypto.randomUUID();
  // Check if there is already an active session (not closed)
  const existing: any[] = await db.query(
    "SELECT id FROM chat_sessions WHERE user_id = ? AND contact_id = ? AND closed_at IS NULL ORDER BY started_at DESC LIMIT 1",
    [userId, contactId]
  ) as any[];

  if (existing.length > 0) {
    // If there is an active session, just update its status if needed
    await db.query(
      "UPDATE chat_sessions SET status = ? WHERE id = ?",
      [status, existing[0].id]
    );
    return existing[0].id;
  }

  // Otherwise, create a new one
  await db.query(
    "INSERT INTO chat_sessions (id, user_id, contact_id, status) VALUES (?, ?, ?, ?)",
    [sessionId, userId, contactId, status]
  );
  return sessionId;
}

export async function answerChatSession(userId: string, contactId: string) {
  // Find the active session that hasn't been answered yet
  const existing: any[] = await db.query(
    "SELECT id, answered_at FROM chat_sessions WHERE user_id = ? AND contact_id = ? AND closed_at IS NULL ORDER BY started_at DESC LIMIT 1",
    [userId, contactId]
  ) as any[];

  if (existing.length > 0) {
    const session = existing[0];
    if (!session.answered_at) {
      await db.query(
        "UPDATE chat_sessions SET status = 'aberto', answered_at = CURRENT_TIMESTAMP WHERE id = ?",
        [session.id]
      );
    } else {
      await db.query(
        "UPDATE chat_sessions SET status = 'aberto' WHERE id = ?",
        [session.id]
      );
    }
    return session.id;
  } else {
    // If there's no active session, create one as already answered
    const sessionId = crypto.randomUUID();
    await db.query(
      "INSERT INTO chat_sessions (id, user_id, contact_id, status, answered_at) VALUES (?, ?, ?, 'aberto', CURRENT_TIMESTAMP)",
      [sessionId, userId, contactId]
    );
    return sessionId;
  }
}

export async function closeChatSession(userId: string, contactId: string) {
  // Find the active session and close it
  const existing: any[] = await db.query(
    "SELECT id FROM chat_sessions WHERE user_id = ? AND contact_id = ? AND closed_at IS NULL ORDER BY started_at DESC LIMIT 1",
    [userId, contactId]
  ) as any[];

  if (existing.length > 0) {
    await db.query(
      "UPDATE chat_sessions SET status = 'fechado', closed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [existing[0].id]
    );
    return existing[0].id;
  }
  return null;
}
