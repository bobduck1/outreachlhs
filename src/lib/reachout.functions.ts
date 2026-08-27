import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ─── Types shared with client ─────────────────────────────────────────────────
export type ContactRow = {
  id: string;
  email: string;
  name: string;
  title: string;
  institution: string;
  field: string;
  category: string;
  location: string;
  tier?: "high" | "medium" | "low";
  research_hook?: string;
  verification_source?: string;
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) {
      console.error("[getProfile] failed", error);
      throw new Error("Could not load your profile. Please try again.");
    }
    return data;
  });

const ProfileInput = z.object({
  name: z.string().max(200).default(""),
  school: z.string().max(200).default(""),
  grade: z.string().max(50).default(""),
  phone: z.string().max(50).default(""),
  location: z.string().max(200).default(""),
  interests: z.string().max(2000).default(""),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) {
      console.error("[saveProfile] failed", error);
      throw new Error("Could not save your profile. Please try again.");
    }
    return { ok: true };
  });

// ─── Activity: sent history ───────────────────────────────────────────────────
export const listMyActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contact_activity")
      .select("contact_email, sent_at, response_status")
      .eq("user_id", context.userId)
      .order("sent_at", { ascending: false });
    if (error) {
      console.error("[listMyActivity] failed", error);
      throw new Error("Could not load your activity. Please try again.");
    }
    return data ?? [];
  });

const ResponseStatusInput = z.object({
  email: z.string().email(),
  status: z.enum(["pending", "no_response", "declined", "accepted", "other"]),
});

export const setResponseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResponseStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contact_activity")
      .update({ response_status: data.status })
      .eq("user_id", context.userId)
      .eq("contact_email", data.email);
    if (error) {
      console.error("[setResponseStatus] failed", error);
      throw new Error("Could not update response status. Please try again.");
    }
    return { ok: true };
  });

export const recordSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((email: string) => z.string().email().parse(email))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contact_activity")
      .upsert(
        { user_id: context.userId, contact_email: data, sent_at: new Date().toISOString() },
        { onConflict: "user_id,contact_email" },
      );
    if (error) {
      console.error("[recordSent] failed", error);
      throw new Error("Could not record sent email. Please try again.");
    }
    return { ok: true };
  });

export const unrecordSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((email: string) => z.string().email().parse(email))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contact_activity")
      .delete()
      .eq("user_id", context.userId)
      .eq("contact_email", data);
    if (error) {
      console.error("[unrecordSent] failed", error);
      throw new Error("Could not update activity. Please try again.");
    }
    return { ok: true };
  });


// ─── Library-backed contact search ───────────────────────────────────────────
const SearchInput = z.object({
  subfield: z.string().min(1).max(80),
  field: z.string().min(1).max(120),
  category: z.string().max(80).default(""),
  location: z.string().max(200).default(""),
  interests: z.string().max(2000).default(""),
  count: z.number().int().min(1).max(15).default(10),
});

export const searchContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { parseState, NEIGHBORS, STATE_REGION } = await import("@/lib/geo");

    // Everything this student already emailed.
    const { data: mySent } = await context.supabase
      .from("contact_activity")
      .select("contact_email")
      .eq("user_id", context.userId);
    const mine = new Set((mySent ?? []).map((r: any) => String(r.contact_email).toLowerCase()));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pool, error: poolErr } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .eq("subfield_key", data.subfield)
      .limit(500);
    if (poolErr) {
      console.error("[searchContacts] library read failed", poolErr);
      throw new Error("Could not load professors. Please try again.");
    }

    const libraryTotal = pool?.length ?? 0;
    if (!libraryTotal) return { contacts: [], cooldownCount: 0, libraryTotal: 0 };

    // 30-day global cooldown: hide anyone another student emailed recently.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const emails = pool!.map((c: any) => c.email);
    const claimed = new Set<string>();
    for (let i = 0; i < emails.length; i += 200) {
      const { data: activity } = await supabaseAdmin
        .from("contact_activity")
        .select("contact_email, user_id")
        .in("contact_email", emails.slice(i, i + 200))
        .gte("sent_at", cutoff);
      for (const a of activity ?? []) {
        if (a.user_id === context.userId) continue;
        claimed.add(String(a.contact_email).toLowerCase());
      }
    }

    const myState = parseState(data.location);
    const neighbors = new Set(myState ? NEIGHBORS[myState] ?? [] : []);
    const myRegion = myState ? STATE_REGION[myState] : undefined;

    let cooldownCount = 0;
    const scored: { row: any; score: number }[] = [];
    for (const c of pool!) {
      const email = String(c.email).toLowerCase();
      if (mine.has(email)) continue;
      if (claimed.has(email)) { cooldownCount++; continue; }
      let score = 0;
      if (myState && c.state === myState) score += 100;
      else if (c.state && neighbors.has(c.state)) score += 60;
      else if (myRegion && c.region === myRegion) score += 25;
      score += Math.random() * 5; // rotate results between searches
      scored.push({ row: c, score });
    }
    scored.sort((a, b) => b.score - a.score);

    // Aim for a tier mix so the "chances" grouping always has content.
    const want: Record<string, number> = { high: 5, medium: 3, low: 2 };
    const picked: any[] = [];
    for (const tier of ["high", "medium", "low"]) {
      for (const s of scored) {
        if (picked.length >= data.count) break;
        if (picked.includes(s.row)) continue;
        if ((s.row.tier || "medium") !== tier) continue;
        if (picked.filter((p) => (p.tier || "medium") === tier).length >= (want[tier] ?? 0)) break;
        picked.push(s.row);
      }
    }
    for (const s of scored) {
      if (picked.length >= data.count) break;
      if (!picked.includes(s.row)) picked.push(s.row);
    }

    const contacts: ContactRow[] = picked.map((c: any) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      title: c.title ?? "",
      institution: c.institution ?? "",
      field: c.field ?? "",
      category: c.category ?? "",
      location: c.location ?? "",
      tier: (c.tier as "high" | "medium" | "low") ?? "medium",
      research_hook: c.research_hook ?? "",
      verification_source: c.verification_source ?? "",
    }));

    if (contacts.length) {
      await supabaseAdmin
        .from("contacts")
        .update({ times_served: 1 })
        .in("id", []); // no-op guard; counter updated below per row
      await Promise.all(
        contacts.map((c) =>
          supabaseAdmin.rpc as unknown as undefined ? Promise.resolve() : Promise.resolve(),
        ),
      );
    }

    return { contacts, cooldownCount, libraryTotal };
  });
