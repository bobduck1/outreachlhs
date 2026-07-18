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
  title: string;
  institution: string;
  field: string;
  location: string;
  tier: "high" | "medium" | "low";
  research_hook: string;
};

type AIVerified = AICandidate & {
  email: string;
  verification_source: string;
  confidence: "high" | "medium" | "low";
};

async function callGateway(apiKey: string, body: unknown) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error("[callGateway] AI gateway error", resp.status, text);
    if (resp.status === 429) throw new Error("Search rate-limited. Try again in a moment.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits to the workspace.");
    throw new Error("AI search failed. Please try again.");
  }
  const json = await resp.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("AI returned unparseable response.");
  }
}

export const searchContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { data: mySent } = await context.supabase
      .from("contact_activity")
      .select("contact_email")
      .eq("user_id", context.userId);
    const excludedEmails = new Set((mySent ?? []).map((r: any) => r.contact_email.toLowerCase()));

    // ═══ PASS 1: FIND candidates (no emails yet) ═══
    const findSystem = `You are a research assistant helping a high-school student find real, currently-active university PROFESSORS to email about assisting with their research.

RULES:
1. Only currently-active faculty (assistant/associate/full professors or research lecturers) at accredited universities. Never industry, executives, private-practice physicians, or non-academic staff.
2. Strongly prefer professors at universities within reasonable driving distance of the student's location. Only expand the radius if you cannot find enough nearby.
3. Strongly prefer SMALLER, less-selective, regional, or teaching-oriented universities where professors are more likely to respond to a high-schooler. Include top-20/Ivy-tier sparingly.
4. For each professor include a "research_hook": ONE concise, specific sentence describing their actual current research topic (not generic — mention the specific subject, e.g. "voter behavior in Latin American democracies" rather than "political science"). This will be used to personalize the outreach email.
5. Assign a tier per professor:
   - "high"  = small regional/teaching schools, lecturers, junior faculty — best odds of a reply.
   - "medium"= mid-tier universities, established faculty at less-competitive research schools.
   - "low"   = top-20/Ivy-tier or highly prominent professors — unlikely to reply.
   Weight the mix toward "high" and "medium".
6. Do NOT include email addresses in this pass — that is a separate step.`;

    const findUser = `Subfield: ${data.field}
${data.category ? `Broader area: ${data.category}\n` : ""}${data.location ? `Student location (find professors close to here): ${data.location}\n` : ""}${data.interests ? `Student's specific interests: ${data.interests}\n` : ""}
Return up to ${data.count * 2} candidate professors. Better to return fewer real people than to pad the list.`;

    const findSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        candidates: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              title: { type: "string" },
              institution: { type: "string" },
              field: { type: "string" },
              location: { type: "string" },
              tier: { type: "string", enum: ["high", "medium", "low"] },
              research_hook: { type: "string" },
            },
            required: ["name", "title", "institution", "field", "location", "tier", "research_hook"],
          },
        },
      },
      required: ["candidates"],
    };

    const findParsed = (await callGateway(apiKey, {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: findSystem },
        { role: "user", content: findUser },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "candidates_response", strict: true, schema: findSchema },
      },
    })) as { candidates?: AICandidate[] };

    const candidates = (findParsed.candidates ?? []).filter(
      (c) => c && c.name && c.institution,
    );
    if (!candidates.length) return { contacts: [], cooldownCount: 0 };

    // ═══ PASS 2: VERIFY institutional emails ═══
    const verifySystem = `You are verifying institutional email addresses for a list of university professors.

STRICT RULES:
1. For each candidate, return the professor's institutional email address ONLY if you are confident it is the exact address published on the university's public faculty directory or the professor's personal/lab page.
2. NEVER construct an email by guessing a pattern like "firstname.lastname@school.edu" or "flast@school.edu". If you have not specifically seen the exact address published, DROP that professor from the response.
3. In "verification_source" name the specific published source you are drawing from: e.g. "Rowan University Political Science faculty directory", "Ramapo College faculty profile page", "professor's lab website at TCNJ". Be specific — a generic "university website" is NOT acceptable and must be dropped.
4. Set "confidence" to "high" only if you are certain. If any doubt, drop the professor rather than lowering confidence.
5. Return ONLY high-confidence verified professors. It is much better to return 3 verified professors than 10 with guessed addresses.
6. Do not return professors whose emails appear in the excluded list.
7. Preserve name, title, institution, field, location, tier, and research_hook exactly as given.`;

    const verifyUser = `Candidates to verify:
${JSON.stringify(candidates, null, 2)}

Excluded emails (already contacted; drop any candidate whose verified email is in this list): ${[...excludedEmails].slice(0, 200).join(", ") || "(none)"}

Return only candidates whose institutional email you can verify against a specific named public source. Aim for the highest-quality ${data.count} you can confidently verify — fewer is fine.`;

    const verifySchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        verified: {
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
              tier: { type: "string", enum: ["high", "medium", "low"] },
              research_hook: { type: "string" },
              verification_source: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: [
              "name", "email", "title", "institution", "field", "location",
              "tier", "research_hook", "verification_source", "confidence",
            ],
          },
        },
      },
      required: ["verified"],
    };

    const verifyParsed = (await callGateway(apiKey, {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: verifySystem },
        { role: "user", content: verifyUser },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "verified_response", strict: true, schema: verifySchema },
      },
    })) as { verified?: AIVerified[] };

    const seen = new Set<string>();
    const clean = (verifyParsed.verified ?? [])
      .filter((c) => c && c.email && c.name && c.confidence === "high" && c.verification_source && c.verification_source.length > 5)
      .map((c) => ({ ...c, email: c.email.toLowerCase().trim() }))
      .filter((c) => {
        if (excludedEmails.has(c.email)) return false;
        if (seen.has(c.email)) return false;
        seen.add(c.email);
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email);
      })
      .slice(0, data.count);

    if (!clean.length) return { contacts: [], cooldownCount: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const metaByEmail = new Map<string, AIVerified>();
    for (const c of clean) metaByEmail.set(c.email, c);

    const rows = clean.map((c) => ({
      email: c.email,
      name: c.name,
      title: c.title || "",
      institution: c.institution || "",
      field: c.field || data.field,
      category: data.category || data.field,
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
      const meta = metaByEmail.get(c.email);
      results.push({
        id: c.id,
        email: c.email,
        name: c.name,
        title: c.title ?? "",
        institution: c.institution ?? "",
        field: c.field ?? "",
        category: c.category ?? "",
        location: c.location ?? "",
        tier: meta?.tier ?? "medium",
        research_hook: meta?.research_hook,
        verification_source: meta?.verification_source,
      });
    }

    return { contacts: results, cooldownCount };
  });

