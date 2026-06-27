/**
 * Deterministic mockup renderer. Turns a structured layout spec (produced by the
 * `design` stage) into a Geist-styled SVG "poster" — a faithful, on-brand preview
 * of how the screen will look. No image model, no hallucinated UI, no deps.
 *
 * The same spec also seeds the future piece-by-piece build assembly, so this image
 * always matches what gets built.
 */

export interface MockupSection {
  type: string;
  title?: string | null;
  subtitle?: string | null;
  items?: string[] | null;
  cta?: string | null;
}

export interface MockupSpec {
  screen: string;
  theme?: "light" | "dark";
  sections: MockupSection[];
}

const C = {
  bg: "#ffffff",
  surface: "#fafafa",
  border: "#eaeaea",
  text: "#171717",
  sub: "#8f8f8f",
  faint: "#ebebeb",
  accent: "#006bff",
  accentText: "#ffffff",
  chip: "#f2f2f2",
  chipText: "#4d4d4d",
};

const W = 880;
const PAD = 56;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(s: string, n: number): string {
  const t = (s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function rect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string): string {
  const s = stroke ? ` stroke="${stroke}" stroke-width="1"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${s}/>`;
}

function txt(
  x: number,
  y: number,
  s: string,
  size: number,
  fill: string,
  opts: { anchor?: "start" | "middle" | "end"; weight?: number } = {},
): string {
  const anchor = opts.anchor ?? "start";
  const weight = opts.weight ?? 400;
  return `<text x="${x}" y="${y}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
}

function button(cx: number, y: number, label: string): string {
  const w = Math.max(96, label.length * 9 + 32);
  const x = cx - w / 2;
  return (
    rect(x, y, w, 40, 6, C.accent) +
    txt(cx, y + 25, clip(label, 22), 14, C.accentText, { anchor: "middle", weight: 500 })
  );
}

/** Each renderer returns its drawn body plus the vertical space it consumed. */
function renderSection(sec: MockupSection, y: number): { body: string; h: number } {
  const cx = W / 2;
  const inner = W - PAD * 2;
  const title = sec.title ? clip(sec.title, 48) : "";
  const sub = sec.subtitle ? clip(sec.subtitle, 80) : "";
  const items = (sec.items ?? []).map((i) => clip(i, 18));

  switch (sec.type) {
    case "navbar": {
      const h = 60;
      let b = rect(0, y, W, h, 0, C.bg) + `<line x1="0" y1="${y + h}" x2="${W}" y2="${y + h}" stroke="${C.border}"/>`;
      b += rect(PAD, y + 20, 22, 22, 5, C.text);
      const links = items.slice(0, 4);
      links.forEach((l, i) => {
        b += txt(W - PAD - i * 96, y + 36, l, 13, C.sub, { anchor: "end" });
      });
      return { body: b, h };
    }
    case "hero": {
      const h = 240;
      let b = rect(0, y, W, h, 0, C.bg);
      b += txt(cx, y + 96, title || "Headline", 38, C.text, { anchor: "middle", weight: 600 });
      if (sub) b += txt(cx, y + 132, sub, 16, C.sub, { anchor: "middle" });
      b += button(cx, y + 160, sec.cta || "Get Started");
      return { body: b, h };
    }
    case "form": {
      const h = 180;
      let b = rect(0, y, W, h, 0, C.surface) + `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.border}"/>`;
      if (title) b += txt(cx, y + 56, title, 22, C.text, { anchor: "middle", weight: 600 });
      const fw = 360;
      b += rect(cx - fw / 2, y + 84, fw - 120, 40, 6, C.bg, C.border);
      b += rect(cx + fw / 2 - 108, y + 84, 108, 40, 6, C.accent);
      b += txt(cx + fw / 2 - 54, y + 109, clip(sec.cta || "Submit", 12), 13, C.accentText, { anchor: "middle", weight: 500 });
      return { body: b, h };
    }
    case "features": {
      const h = 200;
      let b = rect(0, y, W, h, 0, C.bg);
      if (title) b += txt(cx, y + 48, title, 22, C.text, { anchor: "middle", weight: 600 });
      const cards = items.length ? items.slice(0, 3) : ["Feature", "Feature", "Feature"];
      const gap = 20;
      const cw = (inner - gap * (cards.length - 1)) / cards.length;
      cards.forEach((c, i) => {
        const x = PAD + i * (cw + gap);
        b += rect(x, y + 76, cw, 96, 10, C.surface, C.border);
        b += rect(x + 20, y + 96, 28, 28, 6, C.accent);
        b += txt(x + 20, y + 148, c, 14, C.text, { weight: 500 });
      });
      return { body: b, h };
    }
    case "gallery": {
      const h = 200;
      let b = rect(0, y, W, h, 0, C.bg);
      if (title) b += txt(cx, y + 48, title, 22, C.text, { anchor: "middle", weight: 600 });
      const n = Math.min(Math.max(items.length || 3, 2), 4);
      const gap = 20;
      const cw = (inner - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        b += rect(PAD + i * (cw + gap), y + 72, cw, 100, 10, C.faint, C.border);
      }
      return { body: b, h };
    }
    case "list": {
      const rows = items.length ? items.slice(0, 4) : ["Item one", "Item two", "Item three"];
      const h = 56 + rows.length * 52;
      let b = rect(0, y, W, h, 0, C.bg);
      if (title) b += txt(PAD, y + 40, title, 22, C.text, { weight: 600 });
      rows.forEach((r, i) => {
        const ry = y + 56 + i * 52;
        b += rect(PAD, ry, inner, 44, 8, C.surface, C.border);
        b += rect(PAD + 14, ry + 12, 20, 20, 5, C.faint);
        b += txt(PAD + 48, ry + 28, r, 14, C.text);
      });
      return { body: b, h };
    }
    case "cta": {
      const h = 150;
      let b = rect(0, y, W, h, 0, "#f0f7ff") + `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.border}"/>`;
      b += txt(cx, y + 64, title || "Ready to start?", 24, C.text, { anchor: "middle", weight: 600 });
      b += button(cx, y + 84, sec.cta || "Get Started");
      return { body: b, h };
    }
    case "footer": {
      const h = 76;
      let b = rect(0, y, W, h, 0, C.surface) + `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.border}"/>`;
      const links = items.length ? items.slice(0, 4) : ["About", "Contact", "Privacy"];
      links.forEach((l, i) => {
        b += txt(PAD + i * 110, y + 44, l, 13, C.sub);
      });
      return { body: b, h };
    }
    default: {
      // content / unknown
      const h = 170;
      let b = rect(0, y, W, h, 0, C.bg);
      if (title) b += txt(PAD, y + 48, title, 22, C.text, { weight: 600 });
      const lines = sub ? 2 : 3;
      for (let i = 0; i < lines; i++) {
        b += rect(PAD, y + 76 + i * 22, inner - (i === lines - 1 ? 200 : 0), 10, 5, C.faint);
      }
      return { body: b, h };
    }
  }
}

export function renderMockupSvg(spec: MockupSpec): string {
  const sections = (spec.sections ?? []).slice(0, 7);
  let y = 0;
  let body = "";
  for (const sec of sections) {
    const { body: sb, h } = renderSection(sec, y);
    body += sb;
    y += h;
  }
  const H = Math.max(y, 200);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(spec.screen || "Design preview")}">` +
    rect(0, 0, W, H, 0, C.bg) +
    body +
    rect(0.5, 0.5, W - 1, H - 1, 0, "none", C.border) +
    `</svg>`
  );
}
