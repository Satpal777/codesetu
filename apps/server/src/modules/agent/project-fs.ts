import type { FileStore, StoredFile } from "./file-store.js";

export class FileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileError";
  }
}

/** Reject anything that isn't a safe, POSIX-relative project path. */
function assertSafePath(path: string): void {
  if (!path || path.trim() === "") throw new FileError("Path must not be empty.");
  if (path.includes("\\")) throw new FileError(`Path must use "/" not "\\": ${path}`);
  if (path.startsWith("/")) throw new FileError(`Path must be relative (no leading "/"): ${path}`);
  if (path.split("/").some((seg) => seg === "..")) {
    throw new FileError(`Path must not contain "..": ${path}`);
  }
}

export class ProjectFS {
  constructor(private readonly store: FileStore) {}

  listFiles(): Promise<StoredFile[]> {
    return this.store.list();
  }

  async readFile(path: string): Promise<string> {
    assertSafePath(path);
    const content = await this.store.get(path);
    if (content === null) throw new FileError(`File not found: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    assertSafePath(path);
    await this.store.put(path, content);
  }

  async editFile(path: string, oldStr: string, newStr: string): Promise<void> {
    assertSafePath(path);
    const content = await this.store.get(path);
    if (content === null) throw new FileError(`Cannot edit — file not found: ${path}`);
    const first = content.indexOf(oldStr);
    if (first === -1) {
      throw new FileError(`Text to replace was not found in ${path}.`);
    }
    if (content.indexOf(oldStr, first + oldStr.length) !== -1) {
      throw new FileError(
        `Text to replace appears more than once in ${path}; include more surrounding context to make it unique.`,
      );
    }
    await this.store.put(path, content.slice(0, first) + newStr + content.slice(first + oldStr.length));
  }

  async deleteFile(path: string): Promise<void> {
    assertSafePath(path);
    const existed = await this.store.remove(path);
    if (!existed) throw new FileError(`Cannot delete — file not found: ${path}`);
  }
}
