import { createFileRoute } from "@tanstack/react-router";
import { generateProfessors, GatewayBlockedError } from "@/lib/library.server";
import { STATE_REGION } from "@/lib/geo";

const BATCH_SIZE = 3;
const LEASE_MINUTES = 15;

async function run(): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return Response.json({ ok: false, error: "missing_api_key" }, { status: 500 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();

  // ── Paused-state guard ──────────────────────────────────────────────────
  const { data: lock } = await supabaseAdmin
    .from("library_lock")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (lock?.paused) {
    // While paused, allow at most one probe job per run to detect recovery.
    return await processBatch(supabaseAdmin, apiKey, 1, true);
  }

  // ── Single-flight lease ─────────────────────────────────────────────────
  const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
  const { data: leased } = await supabaseAdmin
    .from("library_lock")
    .update({ lease_until: leaseUntil, updated_at: now.toISOString() })
    .eq("id", 1)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("id");

  if (!leased || leased.length === 0) {
    return Response.json({ ok: true, skipped: "already_running" });
  }

  try {
    return await processBatch(supabaseAdmin, apiKey, BATCH_SIZE, false);
  } finally {
    await supabaseAdmin
      .from("library_lock")
      .update({ lease_until: null, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }
}

async function processBatch(
  supabaseAdmin: any,
  apiKey: string,
  batchSize: number,
  probeMode: boolean,
): Promise<Response> {
  const { data: jobs, error: jobsErr } = await supabaseAdmin
    .from("library_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (jobsErr) {
    console.error("[build-library] could not read jobs", jobsErr);
    return Response.json({ ok: false, error: "jobs_read_failed" }, { status: 500 });
  }
  if (!jobs?.length) return Response.json({ ok: true, processed: 0, note: "queue_empty" });

  let processed = 0;
  let added = 0;

  for (const job of jobs) {
    try {
      const verified = await generateProfessors({
        apiKey,
        searchTerm: job.search_term,
        state: job.state,
      });

      if (verified.length) {
        const rows = verified.map((c) => ({
          email: c.email,
          name: c.name,
          title: c.title || "",
          institution: c.institution || "",
          field: c.field || job.search_term,
          category: job.category || "",
          location: c.location || job.state,
          source: "library",
          tier: c.tier || "medium",
          research_hook: c.research_hook || "",
          verification_source: c.verification_source || "",
          state: job.state,
          region: STATE_REGION[job.state] ?? "",
          subfield_key: job.subfield_key,
          last_verified_at: new Date().toISOString(),
        }));
        const { error: upErr } = await supabaseAdmin
          .from("contacts")
          .upsert(rows, { onConflict: "email" });
        if (upErr) throw new Error(`upsert_failed: ${upErr.message}`);
        added += rows.length;
      }

      await supabaseAdmin
        .from("library_jobs")
        .update({
          status: "done",
          professors_added: verified.length,
          attempts: (job.attempts ?? 0) + 1,
          last_error: "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      processed++;

      if (probeMode) {
        // Probe succeeded — clear the pause and let the next run resume batches.
        await supabaseAdmin
          .from("library_lock")
          .update({ paused: false, pause_reason: "", updated_at: new Date().toISOString() })
          .eq("id", 1);
        break;
      }
    } catch (err: any) {
      if (err instanceof GatewayBlockedError) {
        console.error("[build-library] halting: AI budget blocked", err.status);
        await supabaseAdmin
          .from("library_lock")
          .update({
            paused: true,
            pause_reason: `ai_blocked_${err.status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1);
        return Response.json({ ok: false, paused: true, reason: `ai_blocked_${err.status}`, processed, added });
      }

      const attempts = (job.attempts ?? 0) + 1;
      console.error("[build-library] job failed", job.id, err?.message);
      await supabaseAdmin
        .from("library_jobs")
        .update({
          status: attempts >= 3 ? "failed" : "pending",
          attempts,
          last_error: String(err?.message ?? err).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (String(err?.message) === "rate_limited") break;
    }
  }

  return Response.json({ ok: true, processed, added, probeMode });
}

export const Route = createFileRoute("/api/public/build-library")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        return run();
      },
    },
  },
});
