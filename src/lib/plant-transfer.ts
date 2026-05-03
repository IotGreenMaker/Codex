import type { PlantProfile } from "@/lib/types";
import { generateUUID } from "@/lib/uuid";

export const GBUDDY_SCHEMA_VERSION = "1.2.0";

export type GbuddyPlantExport = {
  app: "gbuddy";
  schemaVersion: string;
  exportedAt: string;
  plant: PlantProfile;
};

function toIsoOrNow(value: unknown): string {
  const date = new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function sanitizePlantName(name: string): string {
  return (name || "plant")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getExportFileName(plant: PlantProfile): string {
  const plantName = sanitizePlantName(plant.strainName);
  const startedDate = toIsoOrNow(plant.startedAt).slice(0, 10);
  return `gbuddy-${plantName}-${startedDate}.html`;
}

export function buildThemedPlantExport(plant: PlantProfile): GbuddyPlantExport {
  return {
    app: "gbuddy",
    schemaVersion: GBUDDY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    plant
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSummaryRows(plant: PlantProfile): string {
  const rows: Array<{ label: string; value: string | number }> = [
    { label: "Plant Name", value: plant.strainName },
    { label: "Stage", value: plant.stage },
    { label: "Date Started", value: toIsoOrNow(plant.startedAt).slice(0, 10) },
    { label: "Watering Logs", value: plant.wateringData?.length ?? 0 },
    { label: "Climate Logs", value: plant.climateData?.length ?? 0 },
    { label: "Notes", value: plant.notes?.length ?? 0 }
  ];

  return rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(String(row.value))}</td></tr>`
    )
    .join("");
}

export function buildThemedPlantExportHtml(payload: GbuddyPlantExport, logoSrc = "g-icon.png"): string {
  const serializedPayload = JSON.stringify(payload, null, 2);
  const title = `${payload.plant.strainName} - G-Buddy Export`;
  const summaryRows = buildSummaryRows(payload.plant);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --bg:#0a0b15; --glass:rgba(20,25,40,.58); --lime:#c6ff7f; --limeSoft:rgba(198,255,127,.15); --purple:#b48cff; --text:#e8ffe0; --muted:#b7c9bf; }
    * { box-sizing:border-box; }
    body { margin:0; font-family: "Space Grotesk", system-ui, sans-serif; color:var(--text); background:
      radial-gradient(circle at 18% 16%, rgba(57,255,20,.19), transparent 36%),
      radial-gradient(circle at 84% 12%, rgba(180,140,255,.21), transparent 38%),
      radial-gradient(circle at 72% 88%, rgba(93,210,255,.18), transparent 34%),
      var(--bg); min-height:100vh; }
    .wrap { max-width:980px; margin:24px auto; padding:16px; }
    .card { background:var(--glass); border:1px solid var(--limeSoft); border-radius:22px; padding:18px; backdrop-filter: blur(12px); box-shadow:0 0 28px rgba(180,140,255,.12); }
    .head { display:flex; align-items:center; gap:12px; }
    .logo { width:48px; height:48px; border-radius:14px; border:1px solid var(--limeSoft); background:rgba(0,0,0,.22); padding:6px; }
    h1 { margin:0; font-size:1.35rem; }
    .tag { color:var(--muted); margin-top:2px; font-size:.92rem; }
    .grid { display:grid; grid-template-columns:1fr; gap:16px; margin-top:14px; }
    table { width:100%; border-collapse:collapse; }
    th,td { padding:10px; border-bottom:1px solid rgba(198,255,127,.16); text-align:left; }
    th { width:180px; color:var(--muted); font-weight:600; }
    .meta { margin-top:10px; color:var(--muted); font-size:.86rem; }
    details { margin-top:16px; }
    summary { cursor:pointer; color:var(--lime); }
    pre { margin-top:10px; background:rgba(0,0,0,.32); border:1px solid rgba(198,255,127,.12); border-radius:12px; padding:12px; overflow:auto; color:#dffff2; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <div class="head">
        <img class="logo" src="${escapeHtml(logoSrc)}" alt="G-Buddy Logo" />
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p class="tag">Plant export view</p>
        </div>
      </div>
      <div class="grid">
        <table aria-label="Plant summary">
          <tbody>
            ${summaryRows}
          </tbody>
        </table>
      </div>
      <p class="meta">Exported: ${escapeHtml(payload.exportedAt)} | Schema: ${escapeHtml(payload.schemaVersion)}</p>
      <details>
        <summary>Show raw JSON payload</summary>
        <pre>${escapeHtml(serializedPayload)}</pre>
      </details>
    </section>
  </main>
  <script id="gbuddy-export-data" type="application/json">${escapeHtml(serializedPayload)}</script>
</body>
</html>`;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeImportedPlant(rawPlant: any): PlantProfile {
  const normalizedPlant: PlantProfile = {
    ...rawPlant,
    id: generateUUID(),
    strainName: typeof rawPlant?.strainName === "string" ? rawPlant.strainName : "Imported Plant",
    startedAt: toIsoOrNow(rawPlant?.startedAt),
    bloomStartedAt: rawPlant?.bloomStartedAt ? toIsoOrNow(rawPlant.bloomStartedAt) : undefined,
    vegStartedAt: rawPlant?.vegStartedAt ? toIsoOrNow(rawPlant.vegStartedAt) : undefined,
    seedlingStartedAt: rawPlant?.seedlingStartedAt ? toIsoOrNow(rawPlant.seedlingStartedAt) : undefined,
    lastWateredAt: toIsoOrNow(rawPlant?.lastWateredAt),
    wateringData: ensureArray<any>(rawPlant?.wateringData).map((entry) => ({
      ...entry,
      id: generateUUID(),
      timestamp: toIsoOrNow(entry?.timestamp)
    })),
    climateData: ensureArray<any>(rawPlant?.climateData).map((entry) => ({
      ...entry,
      id: generateUUID(),
      timestamp: toIsoOrNow(entry?.timestamp)
    })),
    notes: ensureArray<any>(rawPlant?.notes).map((entry) => ({
      ...entry,
      id: generateUUID(),
      timestamp: toIsoOrNow(entry?.timestamp)
    }))
  };

  return normalizedPlant;
}

function isValidGbuddyExport(payload: any): payload is GbuddyPlantExport {
  return (
    payload &&
    payload.app === "gbuddy" &&
    typeof payload.schemaVersion === "string" &&
    payload.plant &&
    typeof payload.plant === "object"
  );
}

export function parseImportedPlantJson(jsonText: string): PlantProfile {
  const trimmed = jsonText.trim();
  let parsed: unknown;
  if (trimmed.startsWith("<")) {
    const match = trimmed.match(
      /<script[^>]*id=["']gbuddy-export-data["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!match?.[1]) {
      throw new Error("Invalid Gbuddy export HTML file.");
    }
    const jsonPayload = match[1]
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    parsed = JSON.parse(jsonPayload) as unknown;
  } else {
    parsed = JSON.parse(jsonText) as unknown;
  }
  if (!isValidGbuddyExport(parsed)) {
    throw new Error("Invalid Gbuddy JSON file.");
  }
  return normalizeImportedPlant(parsed.plant);
}
