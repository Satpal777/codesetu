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

/**
 * Preview seam. Phase 1 serves files directly from the file store via the
 * preview route, so the URL is just the server path. Later phases can return
 * a sandbox URL (E2B/Daytona) without changing callers.
 */
export interface Runtime {
  previewPath(projectId: string): string;
}

export const localRuntime: Runtime = {
  previewPath: (projectId) => `/api/projects/${projectId}/preview/`,
};
