import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { isPartnerSlotId } from "@/lib/partners/codes";
import type { PartnerSlotId } from "@/lib/partners/constants";
import {
  listAllPartnerStats,
  updatePartnerSlot,
} from "@/lib/partners/store";
import { PARTNER_COMMISSION_RATE } from "@/lib/partners/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stats = await listAllPartnerStats();
  return NextResponse.json({
    ok: true,
    commissionRate: PARTNER_COMMISSION_RATE,
    partners: stats,
  });
}

type PatchBody = {
  id?: string;
  email?: string | null;
  channelName?: string | null;
  channelUrl?: string | null;
  notes?: string | null;
  active?: boolean;
  rotateAccessToken?: boolean;
};

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!isPartnerSlotId(id)) {
    return NextResponse.json({ error: "invalid_partner_id" }, { status: 400 });
  }

  const updated = await updatePartnerSlot(id as PartnerSlotId, {
    email: body.email,
    channelName: body.channelName,
    channelUrl: body.channelUrl,
    notes: body.notes,
    active: body.active,
    rotateAccessToken: body.rotateAccessToken === true,
  });

  if (!updated) {
    return NextResponse.json(
      { error: "update_failed_or_supabase_unavailable" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, partner: updated });
}
