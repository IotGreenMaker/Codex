import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ArchiveBody = {
  fileName?: string;
  content?: string;
};

const archiveDir = path.join(process.cwd(), "gbuddy-data");

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ArchiveBody;
    if (!body.fileName || !body.content) {
      return NextResponse.json({ ok: false, error: "Missing fileName or content." }, { status: 400 });
    }

    await mkdir(archiveDir, { recursive: true });
    const targetPath = path.join(archiveDir, body.fileName);
    await writeFile(targetPath, body.content, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to archive export." },
      { status: 500 }
    );
  }
}

