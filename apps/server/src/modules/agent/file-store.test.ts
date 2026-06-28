import { describe, it, expect } from "vitest";
import { InMemoryFileStore } from "./file-store.js";

describe("InMemoryFileStore", () => {
  it("puts and gets a file", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("index.html", "<h1>Hi</h1>");
    expect(await fs.get("index.html")).toBe("<h1>Hi</h1>");
  });

  it("returns null for a missing file", async () => {
    const fs = new InMemoryFileStore();
    expect(await fs.get("nope.css")).toBeNull();
  });

  it("overwrites on a second put", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("a.txt", "one");
    await fs.put("a.txt", "two");
    expect(await fs.get("a.txt")).toBe("two");
  });

  it("lists files sorted by path", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("b.css", "b");
    await fs.put("a.html", "a");
    expect((await fs.list()).map((f) => f.path)).toEqual(["a.html", "b.css"]);
  });

  it("removes a file and reports whether it existed", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("x.js", "x");
    expect(await fs.remove("x.js")).toBe(true);
    expect(await fs.remove("x.js")).toBe(false);
    expect(await fs.get("x.js")).toBeNull();
  });
});
