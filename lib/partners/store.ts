import { randomBytes } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  PARTNER_COMMISSION_RATE,
  PARTNER_SLOT_IDS,
  type PartnerSlotId,
} from "@/lib/partners/constants";
import { isPartnerSlotId, normalizePartnerCode } from "@/lib/partners/codes";
import { getSiteUrl } from "@/lib/site";

export type PartnerSlotRow = {
  id: PartnerSlotId;
  code: PartnerSlotId;
  accessToken: string;
  email: string | null;
  channelName: string | null;
  channelUrl: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PartnerStats = {
  partner: PartnerSlotRow;
  referralLink: string;
  signupCount: number;
  paidConversionCount: number;
  totalAmountKrw: number;
  totalAmountUsd: number;
  commissionKrw: number;
  commissionUsd: number;
  recentCommissions: Array<{
    orderId: string;
    appUserId: string;
    planId: string | null;
    billingInterval: string | null;
    amountKrw: number;
    amountUsd: number;
    commissionKrw: number;
    commissionUsd: number;
    createdAt: string;
  }>;
};

type SlotDbRow = {
  id: string;
  code: string;
  access_token: string;
  email: string | null;
  channel_name: string | null;
  channel_url: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function mapSlot(row: SlotDbRow): PartnerSlotRow {
  return {
    id: row.id as PartnerSlotId,
    code: row.code as PartnerSlotId,
    accessToken: row.access_token,
    email: row.email,
    channelName: row.channel_name,
    channelUrl: row.channel_url,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function newAccessToken(): string {
  return `pt_${randomBytes(24).toString("hex")}`;
}

function referralLinkFor(code: PartnerSlotId): string {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/?ref=${encodeURIComponent(code)}`;
}

/** Ensure all 10 empty slots exist (idempotent). */
export async function ensurePartnerSlotsSeeded(): Promise<void> {
  const sb = createSupabaseServiceClient();
  if (!sb) return;

  const { data, error } = await sb
    .from("partner_slots")
    .select("id")
    .in("id", [...PARTNER_SLOT_IDS]);

  if (error) {
    console.warn("[partners] list slots failed", error.message);
    return;
  }

  const have = new Set((data ?? []).map((r) => r.id as string));
  const missing = PARTNER_SLOT_IDS.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  const rows = missing.map((id) => ({
    id,
    code: id,
    access_token: newAccessToken(),
    active: true,
  }));

  const { error: upsertErr } = await sb.from("partner_slots").upsert(rows, {
    onConflict: "id",
    ignoreDuplicates: true,
  });
  if (upsertErr) {
    console.warn("[partners] seed failed", upsertErr.message);
  }
}

export async function listPartnerSlots(): Promise<PartnerSlotRow[]> {
  const sb = createSupabaseServiceClient();
  if (!sb) return [];
  await ensurePartnerSlotsSeeded();

  const { data, error } = await sb
    .from("partner_slots")
    .select("*")
    .order("id", { ascending: true });

  if (error || !data) {
    console.warn("[partners] list failed", error?.message);
    return [];
  }
  return (data as SlotDbRow[])
    .filter((r) => isPartnerSlotId(r.id))
    .map(mapSlot);
}

export async function getPartnerByCode(
  code: string
): Promise<PartnerSlotRow | null> {
  const normalized = normalizePartnerCode(code);
  if (!normalized) return null;
  const sb = createSupabaseServiceClient();
  if (!sb) return null;
  await ensurePartnerSlotsSeeded();

  const { data, error } = await sb
    .from("partner_slots")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as SlotDbRow;
  if (!row.active) return null;
  return mapSlot(row);
}

export async function getPartnerByAccessToken(
  token: string
): Promise<PartnerSlotRow | null> {
  const trimmed = token?.trim();
  if (!trimmed || trimmed.length < 16) return null;
  const sb = createSupabaseServiceClient();
  if (!sb) return null;
  await ensurePartnerSlotsSeeded();

  const { data, error } = await sb
    .from("partner_slots")
    .select("*")
    .eq("access_token", trimmed)
    .maybeSingle();

  if (error || !data) return null;
  return mapSlot(data as SlotDbRow);
}

export async function updatePartnerSlot(
  id: PartnerSlotId,
  patch: {
    email?: string | null;
    channelName?: string | null;
    channelUrl?: string | null;
    notes?: string | null;
    active?: boolean;
    rotateAccessToken?: boolean;
  }
): Promise<PartnerSlotRow | null> {
  const sb = createSupabaseServiceClient();
  if (!sb) return null;
  await ensurePartnerSlotsSeeded();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.email !== undefined) {
    payload.email = patch.email?.trim() || null;
  }
  if (patch.channelName !== undefined) {
    payload.channel_name = patch.channelName?.trim() || null;
  }
  if (patch.channelUrl !== undefined) {
    payload.channel_url = patch.channelUrl?.trim() || null;
  }
  if (patch.notes !== undefined) {
    payload.notes = patch.notes?.trim() || null;
  }
  if (typeof patch.active === "boolean") {
    payload.active = patch.active;
  }
  if (patch.rotateAccessToken) {
    payload.access_token = newAccessToken();
  }

  const { data, error } = await sb
    .from("partner_slots")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.warn("[partners] update failed", error?.message);
    return null;
  }
  return mapSlot(data as SlotDbRow);
}

/**
 * Attribute a newly registered user to a partner (first-touch wins).
 * Returns true when a new referral row was written.
 */
export async function attributePartnerReferral(input: {
  partnerCode: string | null | undefined;
  appUserId: string;
  email?: string | null;
  supabaseUserId?: string | null;
}): Promise<{ ok: boolean; partnerId: PartnerSlotId | null }> {
  const partnerId = normalizePartnerCode(input.partnerCode);
  if (!partnerId || !input.appUserId.trim()) {
    return { ok: false, partnerId: null };
  }

  const partner = await getPartnerByCode(partnerId);
  if (!partner || !partner.active) {
    return { ok: false, partnerId: null };
  }

  const sb = createSupabaseServiceClient();
  if (!sb) return { ok: false, partnerId: null };

  const { error } = await sb.from("partner_referrals").upsert(
    {
      partner_id: partnerId,
      app_user_id: input.appUserId,
      supabase_user_id: input.supabaseUserId || null,
      email: input.email ?? null,
      attributed_at: new Date().toISOString(),
    },
    {
      onConflict: "app_user_id",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.warn("[partners] attribute failed", error.message);
    return { ok: false, partnerId: null };
  }
  return { ok: true, partnerId };
}

export async function getReferralPartnerIdForUser(
  appUserId: string
): Promise<PartnerSlotId | null> {
  const sb = createSupabaseServiceClient();
  if (!sb || !appUserId) return null;

  const { data, error } = await sb
    .from("partner_referrals")
    .select("partner_id")
    .eq("app_user_id", appUserId)
    .maybeSingle();

  if (error || !data?.partner_id) return null;
  return normalizePartnerCode(data.partner_id as string);
}

function roundMoney(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Record 10% commission for a paid subscription order (idempotent on order_id).
 */
export async function recordPartnerCommission(input: {
  orderId: string;
  appUserId: string;
  planId?: string | null;
  billingInterval?: string | null;
  amountKrw?: number | null;
  amountUsd?: number | null;
  partnerCodeHint?: string | null;
}): Promise<boolean> {
  const sb = createSupabaseServiceClient();
  if (!sb) return false;

  let partnerId =
    (await getReferralPartnerIdForUser(input.appUserId)) ||
    normalizePartnerCode(input.partnerCodeHint);
  if (!partnerId) return false;

  const partner = await getPartnerByCode(partnerId);
  if (!partner || !partner.active) return false;

  const amountKrw = Math.max(0, Math.round(Number(input.amountKrw) || 0));
  const amountUsd = Math.max(0, roundMoney(Number(input.amountUsd) || 0));
  const commissionKrw = Math.round(amountKrw * PARTNER_COMMISSION_RATE);
  const commissionUsd = roundMoney(amountUsd * PARTNER_COMMISSION_RATE);

  const { error } = await sb.from("partner_commissions").upsert(
    {
      partner_id: partnerId,
      app_user_id: input.appUserId,
      order_id: input.orderId,
      plan_id: input.planId ?? null,
      billing_interval: input.billingInterval ?? null,
      amount_krw: amountKrw,
      amount_usd: amountUsd,
      commission_krw: commissionKrw,
      commission_usd: commissionUsd,
      created_at: new Date().toISOString(),
    },
    { onConflict: "order_id", ignoreDuplicates: true }
  );

  if (error) {
    console.warn("[partners] commission failed", error.message);
    return false;
  }
  return true;
}

export async function getPartnerStats(
  partner: PartnerSlotRow
): Promise<PartnerStats> {
  const empty: PartnerStats = {
    partner,
    referralLink: referralLinkFor(partner.code),
    signupCount: 0,
    paidConversionCount: 0,
    totalAmountKrw: 0,
    totalAmountUsd: 0,
    commissionKrw: 0,
    commissionUsd: 0,
    recentCommissions: [],
  };

  const sb = createSupabaseServiceClient();
  if (!sb) return empty;

  const [refs, commissions] = await Promise.all([
    sb
      .from("partner_referrals")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partner.id),
    sb
      .from("partner_commissions")
      .select("*")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false }),
  ]);

  const signupCount = refs.count ?? 0;
  const rows = (commissions.data ?? []) as Array<{
    order_id: string;
    app_user_id: string;
    plan_id: string | null;
    billing_interval: string | null;
    amount_krw: number;
    amount_usd: number | string;
    commission_krw: number;
    commission_usd: number | string;
    created_at: string;
  }>;

  const paidUsers = new Set(rows.map((r) => r.app_user_id));
  let totalAmountKrw = 0;
  let totalAmountUsd = 0;
  let commissionKrw = 0;
  let commissionUsd = 0;

  for (const r of rows) {
    totalAmountKrw += Number(r.amount_krw) || 0;
    totalAmountUsd += Number(r.amount_usd) || 0;
    commissionKrw += Number(r.commission_krw) || 0;
    commissionUsd += Number(r.commission_usd) || 0;
  }

  return {
    partner,
    referralLink: referralLinkFor(partner.code),
    signupCount,
    paidConversionCount: paidUsers.size,
    totalAmountKrw,
    totalAmountUsd: roundMoney(totalAmountUsd),
    commissionKrw,
    commissionUsd: roundMoney(commissionUsd),
    recentCommissions: rows.slice(0, 50).map((r) => ({
      orderId: r.order_id,
      appUserId: r.app_user_id,
      planId: r.plan_id,
      billingInterval: r.billing_interval,
      amountKrw: Number(r.amount_krw) || 0,
      amountUsd: Number(r.amount_usd) || 0,
      commissionKrw: Number(r.commission_krw) || 0,
      commissionUsd: Number(r.commission_usd) || 0,
      createdAt: r.created_at,
    })),
  };
}

export async function listAllPartnerStats(): Promise<PartnerStats[]> {
  const slots = await listPartnerSlots();
  return Promise.all(slots.map((s) => getPartnerStats(s)));
}
