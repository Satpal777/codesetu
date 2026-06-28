import { randomUUID } from "node:crypto";
import { db, message as messageTable, eq } from "@repo/database";

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  parts: unknown[] | null;
  createdAt: Date;
}

export async function loadHistory(projectId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(messageTable)
    .where(eq(messageTable.projectId, projectId))
    .orderBy(messageTable.createdAt);
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    parts: (r.parts as unknown[] | null) ?? null,
    createdAt: r.createdAt,
  }));
}

export async function appendMessage(
  projectId: string,
  role: string,
  content: string,
  parts: unknown[] = [],
): Promise<ChatMessage> {
  const row = {
    id: randomUUID(),
    projectId,
    role,
    content,
    parts,
    createdAt: new Date(),
  };
  await db.insert(messageTable).values(row);
  return { id: row.id, role, content, parts, createdAt: row.createdAt };
}
