export interface StoredFile {
  path: string;
  content: string;
}

/** Minimal storage contract the agent's file tools depend on. */
export interface FileStore {
  list(): Promise<StoredFile[]>;
  get(path: string): Promise<string | null>;
  put(path: string, content: string): Promise<void>;
  remove(path: string): Promise<boolean>;
}

/** In-memory FileStore for tests and ephemeral use. */
export class InMemoryFileStore implements FileStore {
  private files = new Map<string, string>();

  async list(): Promise<StoredFile[]> {
    return [...this.files.entries()]
      .map(([path, content]) => ({ path, content }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async get(path: string): Promise<string | null> {
    return this.files.has(path) ? this.files.get(path)! : null;
  }

  async put(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async remove(path: string): Promise<boolean> {
    return this.files.delete(path);
  }
}
