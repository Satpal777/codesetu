import { Daytona } from "@daytona/sdk";
import { db, project as projectTable, eq } from "@repo/database";
import { DbFileStore } from "./db-file-store.js";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
};

/** Map a file path to a Content-Type for the preview server. */
export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

export interface Runtime {
  previewPath(projectId: string): Promise<string>;
}

export const localRuntime: Runtime = {
  previewPath: async (projectId) => `/api/projects/${projectId}/preview/`,
};

export class DaytonaRuntime implements Runtime {
  private daytona: Daytona;

  // Caching signed URLs and file sync states to eliminate REST roundtrips on iframe load
  private static signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
  private static lastSyncCache = new Map<string, number>();

  constructor() {
    this.daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY || "",
      apiUrl: process.env.DAYTONA_API_URL || "https://api.daytona.io",
      target: process.env.DAYTONA_TARGET || undefined,
    });
  }

  async previewPath(projectId: string): Promise<string> {
    const sandboxName = projectId;

    // Check last update time from DB
    const project = await db
      .select({ updatedAt: projectTable.updatedAt })
      .from(projectTable)
      .where(eq(projectTable.id, projectId));
    const lastUpdated = project[0] ? new Date(project[0].updatedAt).getTime() : Date.now();

    const cached = DaytonaRuntime.signedUrlCache.get(projectId);
    const lastSync = DaytonaRuntime.lastSyncCache.get(projectId);

    const isUrlValid = cached && cached.expiresAt > Date.now() + 300 * 1000; // valid for at least 5 more minutes

    // If files are synced and URL is cached & fresh, return it instantly (0ms REST latency)
    if (isUrlValid && lastSync && lastSync >= lastUpdated) {
      return cached.url;
    }

    let sandbox;
    try {
      sandbox = await this.daytona.get(sandboxName);
    } catch {
      sandbox = await this.daytona.create({
        name: sandboxName,
        language: "typescript",
      });
    }

    // Ensure sandbox is started
    await sandbox.start();

    // Sync files only if they changed since last sync
    if (!lastSync || lastSync < lastUpdated) {
      const fileStore = new DbFileStore(projectId);
      const files = await fileStore.list();
      const uploads = files.map((file) => ({
        source: Buffer.from(file.content),
        destination: file.path,
      }));
      if (uploads.length > 0) {
        await sandbox.fs.uploadFiles(uploads);
      }

      // Detect project stack and execute startup scripts dynamically on port 8080
      const hasDockerfile = files.some((f) => f.path === "Dockerfile" || f.path.endsWith("Dockerfile"));
      const hasPackageJson = files.some((f) => f.path === "package.json" || f.path.endsWith("package.json"));
      const hasPython = files.some((f) => f.path === "requirements.txt" || f.path === "app.py" || f.path === "main.py" || f.path.endsWith(".py"));

      if (hasDockerfile) {
        // Build and run custom Dockerfile in background
        await sandbox.process.executeCommand(
          'nohup sh -c "docker build -t app . && (docker stop app-run || true) && (docker rm app-run || true) && docker run -d -p 8080:8080 --name app-run app" > /tmp/docker-build.log 2>&1 &'
        );
      } else if (hasPackageJson) {
        // Start Node.js setup & server background execution
        await sandbox.process.executeCommand(
          'PORT=8080 nohup sh -c "npm install && (npm run dev -- --port 8080 --host 0.0.0.0 || npm start || node server.js || node app.js)" > /tmp/server.log 2>&1 &'
        );
      } else if (hasPython) {
        // Start Python setup & server background execution
        await sandbox.process.executeCommand(
          'PORT=8080 nohup sh -c "if [ -f requirements.txt ]; then pip install -r requirements.txt; fi && (python app.py --port 8080 || python main.py --port 8080 || uvicorn main:app --port 8080 --host 0.0.0.0 || python -m http.server 8080)" > /tmp/server.log 2>&1 &'
        );
      } else {
        // Default static http-server execution
        const checkServer = await sandbox.process.executeCommand('pgrep -f "http-server"');
        if (checkServer.exitCode !== 0) {
          await sandbox.process.executeCommand('nohup npx -y http-server -p 8080 > /tmp/http-server.log 2>&1 &');
        }
      }

      DaytonaRuntime.lastSyncCache.set(projectId, Date.now());
    }

    // Generate signed preview link (valid for 1 hour)
    const signed = await sandbox.getSignedPreviewUrl(8080, 3600);
    const expiresAt = Date.now() + 3600 * 1000;
    DaytonaRuntime.signedUrlCache.set(projectId, { url: signed.url, expiresAt });

    return signed.url;
  }
}

let daytona: DaytonaRuntime | null = null;

/** Get the active runtime depending on environment configuration. */
export function getRuntime(): Runtime {
  if (process.env.DAYTONA_API_KEY) {
    if (!daytona) daytona = new DaytonaRuntime();
    return daytona;
  }
  return localRuntime;
}

/**
 * Destroys the Daytona sandbox named by projectId.
 * Errors are swallowed — sandbox may never have been created.
 */
export async function destroySandbox(projectId: string): Promise<void> {
  const client = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY || "",
    apiUrl: process.env.DAYTONA_API_URL || "https://api.daytona.io",
    target: process.env.DAYTONA_TARGET || undefined,
  });
  try {
    const sandbox = await client.get(projectId);
    await client.delete(sandbox);
  } catch (err) {
    console.warn(`[destroySandbox] Could not delete sandbox for project ${projectId}:`, err);
  }
}
