import { NextResponse } from "next/server";
import { hub } from "@/lib/hub";

export const dynamic = "force-dynamic";

export async function POST() {
  hub.reset();
  return NextResponse.json({ ok: true });
}
