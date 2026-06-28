import { randomUUID } from "node:crypto";
import { db, file as fileTable, eq, and } from "@repo/database";
import type { FileStore, StoredFile } from "./file-store.js";

/** FileStore backed by the `file` table, scoped to one project. */
export class DbFileStore implements FileStore {
  constructor(private readonly projectId: string) {}

  async list(): Promise<StoredFile[]> {
    const rows = await db
      .select({ path: fileTable.path, content: fileTable.content })
      .from(fileTable)
      .where(eq(fileTable.projectId, this.projectId))
      .orderBy(fileTable.path);
    return rows;
  }

  async get(path: string): Promise<string | null> {
    const rows = await db
      .select({ content: fileTable.content })
      .from(fileTable)
      .where(and(eq(fileTable.projectId, this.projectId), eq(fileTable.path, path)));
    return rows[0]?.content ?? null;
  }

  async put(path: string, content: string): Promise<void> {
    const now = new Date();
    await db
      .insert(fileTable)
      .values({ id: randomUUID(), projectId: this.projectId, path, content, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [fileTable.projectId, fileTable.path],
        set: { content, updatedAt: now },
      });
  }

  async remove(path: string): Promise<boolean> {
    const deleted = await db
      .delete(fileTable)
      .where(and(eq(fileTable.projectId, this.projectId), eq(fileTable.path, path)))
      .returning({ id: fileTable.id });
    return deleted.length > 0;
  }
}
