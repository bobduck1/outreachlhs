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
      .select("contact_email, sent_at")
      .eq("user_id", context.userId)
      .order("sent_at", { ascending: false });
    if (error) {
      console.error("[listMyActivity] failed", error);
      throw new Error("Could not load your activity. Please try again.");
    }
    return data ?? [];
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


// ─── AI contact search ────────────────────────────────────────────────────────
const SearchInput = z.object({
  field: z.string().min(1).max(120),
  category: z.string().max(80).default(""),
  location: z.string().max(200).default(""),
  interests: z.string().max(2000).default(""),
  count: z.number().int().min(1).max(15).default(10),
});

type AICandidate = {
  name: string;
  email: string;
  title: string;
  institution: string;
  field: string;
  location: string;
  tier: "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
};

type AICandidate = {
  name: string;
  email: string;
  title: string;
  institution: string;
  field: string;
  location: string;
  confidence: "high" | "medium" | "low";
};

export const searchContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    // Get emails to exclude: current user's sent + globally cooled-down.
    // We pass the excludes into the AI prompt so it doesn't waste slots on them.
    const { data: mySent } = await context.supabase
      .from("contact_activity")
      .select("contact_email")
      .eq("user_id", context.userId);
    const excludedEmails = new Set((mySent ?? []).map((r: any) => r.contact_email.toLowerCase()));

    const systemPrompt = `You are a research assistant helping a high-school student find real professors and professionals to email for research/mentorship opportunities.

CRITICAL RULES:
1. Only include a contact if you are 100% confident their email address is real and correct. If you are not certain the exact email is correct, DO NOT include that person. It is much better to return 3 verified contacts than 10 guesses.
2. Prefer institutional emails (.edu for professors, or clearly-listed public professional emails). Never guess a pattern like firstname.lastname@university.edu unless you have specifically seen that exact address published.
3. Focus on people currently active in the field.
4. Do not include contacts whose emails appear in the excluded list.
5. If you cannot find enough verified contacts, return fewer — quality over quantity.

Return JSON with a "contacts" array. Each item:
- name: full name
- email: verified institutional email (lowercase)
- title: e.g. "Professor of Political Science", "Attorney"
- institution: university, firm, hospital, etc.
- field: their specialty in one short phrase
- location: "City, State" (US) if known, else ""
- confidence: always "high" (you only return high-confidence entries)`;

    const userPrompt = `Field: ${data.field}
${data.location ? `Preferred location: ${data.location}\n` : ""}${data.interests ? `Student's specific interests: ${data.interests}\n` : ""}Excluded emails (already contacted by this student, do not include): ${[...excludedEmails].slice(0, 200).join(", ") || "(none)"}

Return up to ${data.count} real, verified contacts matching this criteria.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contacts_response",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                contacts: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      email: { type: "string" },
                      title: { type: "string" },
                      institution: { type: "string" },
                      field: { type: "string" },
                      location: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["name", "email", "title", "institution", "field", "location", "confidence"],
                  },
                },
              },
              required: ["contacts"],
            },
          },
        },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      if (resp.status === 429) throw new Error("Search rate-limited. Try again in a moment.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits to the workspace.");
      throw new Error(`AI search failed [${resp.status}]: ${body.slice(0, 200)}`);
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { contacts?: AICandidate[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned unparseable response.");
    }

    // Only keep high-confidence, filter excluded, dedupe by email.
    const seen = new Set<string>();
    const clean = (parsed.contacts ?? [])
      .filter((c) => c && c.email && c.name && c.confidence === "high")
      .map((c) => ({ ...c, email: c.email.toLowerCase().trim() }))
      .filter((c) => {
        if (excludedEmails.has(c.email)) return false;
        if (seen.has(c.email)) return false;
        seen.add(c.email);
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email);
      });

    if (!clean.length) {
      return { contacts: [], cooldownCount: 0 };
    }

    // Upsert into shared contacts table via admin client. Direct authenticated
    // inserts are disallowed to prevent users from planting fake contacts.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = clean.map((c) => ({
      email: c.email,
      name: c.name,
      title: c.title || "",
      institution: c.institution || "",
      field: c.field || data.field,
      category: data.field,
      location: c.location || "",
      source: "ai",
    }));

    const { data: upserted, error: upsertErr } = await supabaseAdmin
      .from("contacts")
      .upsert(rows, { onConflict: "email" })
      .select("*");
    if (upsertErr) {
      console.error("[searchContacts] contacts upsert failed", upsertErr);
      throw new Error("Could not save search results. Please try again.");
    }

    // Filter out contacts on cooldown for other users. Cooldown = 2+ other users
    // sent to this email in the last 30 days. Uses admin client because it must
    // read across all users' activity, which per-user RLS forbids.

    const emails = (upserted ?? []).map((c: any) => c.email);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activity } = await supabaseAdmin
      .from("contact_activity")
      .select("contact_email, user_id")
      .in("contact_email", emails)
      .gte("sent_at", cutoff);
    const otherUserCount = new Map<string, Set<string>>();
    for (const a of activity ?? []) {
      if (a.user_id === context.userId) continue;
      if (!otherUserCount.has(a.contact_email)) otherUserCount.set(a.contact_email, new Set());
      otherUserCount.get(a.contact_email)!.add(a.user_id);
    }

    const results: ContactRow[] = [];
    let cooldownCount = 0;
    for (const c of upserted ?? []) {
      if ((otherUserCount.get(c.email)?.size ?? 0) >= 2) {
        cooldownCount++;
        continue;
      }
      results.push({
        id: c.id,
        email: c.email,
        name: c.name,
        title: c.title ?? "",
        institution: c.institution ?? "",
        field: c.field ?? "",
        category: c.category ?? "",
        location: c.location ?? "",
      });
    }

    return { contacts: results, cooldownCount };
  });
