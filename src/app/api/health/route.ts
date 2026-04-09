import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    storage: "indexeddb",
    message: "Using client-side IndexedDB storage" 
  });
}
