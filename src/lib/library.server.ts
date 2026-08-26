// Server-only helpers for building the professor library with AI.
// Never import this from a component or a *.functions.ts module scope.

export type AICandidate = {
  name: string;
  title: string;
  institution: string;
  field: string;
  location: string;
  tier: "high" | "medium" | "low";
  research_hook: string;
};

export type AIVerified = AICandidate & {
  email: string;
  verification_source: string;
  confidence: "high" | "medium" | "low";
};

export class GatewayBlockedError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GatewayBlockedError";
  }
}

async function callGateway(apiKey: string, body: unknown) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error("[library callGateway] gateway error", resp.status, text);
    if (resp.status === 402 || resp.status === 403) {
      throw new GatewayBlockedError(resp.status, "AI budget exhausted or blocked");
    }
    if (resp.status === 429) throw new Error("rate_limited");
    throw new Error(`gateway_error_${resp.status}`);
  }
  const json = await resp.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("unparseable_ai_response");
  }
}

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

/**
 * Two-pass find-then-verify for one (subfield, state) slice of the library.
 * Pass 1 uses the cheap model, pass 2 keeps the accurate model.
 */
export async function generateProfessors(opts: {
  apiKey: string;
  searchTerm: string;
  state: string;
  count?: number;
}): Promise<AIVerified[]> {
  const count = opts.count ?? 12;

  const findSystem = `You are a research assistant compiling a directory of real, currently-active university PROFESSORS that a high-school student could email about assisting with their research.

RULES:
1. Only currently-active faculty (assistant/associate/full professors or research lecturers) at accredited universities. Never industry, executives, private-practice physicians, or non-academic staff.
2. Only professors at universities located in the given US state.
3. Strongly prefer SMALLER, less-selective, regional, or teaching-oriented universities where professors are more likely to respond to a high-schooler. Include top-20/Ivy-tier sparingly.
4. For each professor include a "research_hook": ONE concise, specific sentence describing their actual current research topic (mention the specific subject, not the broad field).
5. Assign a tier per professor:
   - "high"  = small regional/teaching schools, lecturers, junior faculty — best odds of a reply.
   - "medium"= mid-tier universities, established faculty at less-competitive research schools.
   - "low"   = top-20/Ivy-tier or highly prominent professors — unlikely to reply.
   Weight the mix toward "high" and "medium".
6. Do NOT include email addresses in this pass — that is a separate step.`;

  const findUser = `Subfield: ${opts.searchTerm}
US state: ${opts.state}
Return up to ${count + 5} candidate professors at universities in ${opts.state}. Better to return fewer real people than to pad the list.`;

  const findParsed = (await callGateway(opts.apiKey, {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: findSystem },
      { role: "user", content: findUser },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "candidates_response", strict: true, schema: findSchema },
    },
  })) as { candidates?: AICandidate[] };

  const candidates = (findParsed.candidates ?? []).filter((c) => c && c.name && c.institution);
  if (!candidates.length) return [];

  const verifySystem = `You are verifying institutional email addresses for a list of university professors.

STRICT RULES:
1. For each candidate, return the professor's institutional email address ONLY if you are confident it is the exact address published on the university's public faculty directory or the professor's personal/lab page.
2. NEVER construct an email by guessing a pattern like "firstname.lastname@school.edu". If you have not specifically seen the exact address published, DROP that professor.
3. In "verification_source" name the specific published source: e.g. "Rowan University Political Science faculty directory". A generic "university website" is NOT acceptable and must be dropped.
4. Set "confidence" to "high" only if you are certain. If any doubt, drop the professor.
5. Return ONLY high-confidence verified professors. Better 3 verified than 10 guessed.
6. Preserve name, title, institution, field, location, tier, and research_hook exactly as given.`;

  const verifyUser = `Candidates to verify:
${JSON.stringify(candidates, null, 2)}

Return only candidates whose institutional email you can verify against a specific named public source.`;

  const verifyParsed = (await callGateway(opts.apiKey, {
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
  return (verifyParsed.verified ?? [])
    .filter(
      (c) =>
        c && c.email && c.name && c.confidence === "high" &&
        c.verification_source && c.verification_source.length > 5,
    )
    .map((c) => ({ ...c, email: c.email.toLowerCase().trim() }))
    .filter((c) => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email);
    });
}
