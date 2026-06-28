import { describe, it, expect } from "vitest";
import { InMemoryFileStore } from "./file-store.js";
import { ProjectFS, FileError } from "./project-fs.js";

function fs() {
  return new ProjectFS(new InMemoryFileStore());
}

describe("ProjectFS path validation", () => {
  it("rejects absolute paths", async () => {
    await expect(fs().writeFile("/etc/passwd", "x")).rejects.toBeInstanceOf(FileError);
  });
  it("rejects parent traversal", async () => {
    await expect(fs().writeFile("../secrets.txt", "x")).rejects.toBeInstanceOf(FileError);
  });
  it("rejects backslashes", async () => {
    await expect(fs().writeFile("a\\b.txt", "x")).rejects.toBeInstanceOf(FileError);
  });
  it("accepts a normal nested path", async () => {
    const f = fs();
    await f.writeFile("css/styles.css", "body{}");
    expect(await f.readFile("css/styles.css")).toBe("body{}");
  });
});

describe("ProjectFS editFile", () => {
  it("replaces the first exact occurrence", async () => {
    const f = fs();
    await f.writeFile("index.html", "<h1>Old</h1>");
    await f.editFile("index.html", "Old", "New");
    expect(await f.readFile("index.html")).toBe("<h1>New</h1>");
  });
  it("throws when the file is missing", async () => {
    await expect(fs().editFile("nope.html", "a", "b")).rejects.toBeInstanceOf(FileError);
  });
  it("throws when oldStr is not found", async () => {
    const f = fs();
    await f.writeFile("a.txt", "hello");
    await expect(f.editFile("a.txt", "xyz", "b")).rejects.toBeInstanceOf(FileError);
  });
  it("throws when oldStr appears more than once (ambiguous)", async () => {
    const f = fs();
    await f.writeFile("a.txt", "x x");
    await expect(f.editFile("a.txt", "x", "y")).rejects.toBeInstanceOf(FileError);
  });
});

describe("ProjectFS readFile/deleteFile", () => {
  it("readFile throws on missing", async () => {
    await expect(fs().readFile("missing.txt")).rejects.toBeInstanceOf(FileError);
  });
  it("deleteFile removes an existing file", async () => {
    const f = fs();
    await f.writeFile("a.txt", "1");
    await f.deleteFile("a.txt");
    await expect(f.readFile("a.txt")).rejects.toBeInstanceOf(FileError);
  });
  it("deleteFile throws on missing", async () => {
    await expect(fs().deleteFile("missing.txt")).rejects.toBeInstanceOf(FileError);
  });
});
