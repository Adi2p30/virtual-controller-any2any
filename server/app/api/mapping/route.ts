// Read/update the input mapping. The monitor UI edits it here; the bridge
// fetches it to know what each control should do on the target machine.

import { NextRequest, NextResponse } from "next/server";
import { getMapping, saveMapping, KEY_OPTIONS, Mapping } from "@/lib/mapping";

export const dynamic = "force-dynamic";

const cors = { "Access-Control-Allow-Origin": "*" };

export async function GET() {
  const mapping = await getMapping();
  return NextResponse.json({ mapping, keyOptions: KEY_OPTIONS }, { headers: cors });
}

export async function POST(req: NextRequest) {
  let patch: Partial<Mapping>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: cors });
  }
  const mapping = await saveMapping(patch);
  return NextResponse.json({ ok: true, mapping }, { headers: cors });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      ...cors,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
