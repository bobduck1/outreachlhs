import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8", fontFamily: "'IBM Plex Mono', monospace", color: "#8a847a" }}>
        Loading…
      </div>
    );
  }

  if (!session) return <AuthForm />;
  return <>{children}</>;
}

function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMsg("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f0e8",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'IBM Plex Sans', sans-serif",
      color: "#1a1714",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');`}</style>
      <div style={{ maxWidth: 400, width: "100%", background: "#ede8df", border: "2px solid #cdc7bc", borderRadius: 14, padding: 32 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.8rem", letterSpacing: "-1px", marginBottom: 4 }}>
          Reach<span style={{ color: "#5a8a2a" }}>Out</span>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "#8a847a", textTransform: "uppercase", letterSpacing: 2, marginBottom: 24 }}>
          {mode === "signup" ? "Create your account" : "Sign in to your account"}
        </div>
        <form onSubmit={onSubmit}>
          <label style={lbl}>Email</label>
          <input style={inp} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          <label style={{ ...lbl, marginTop: 14 }}>Password</label>
          <input style={inp} type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
          {err && <div style={errStyle}>{err}</div>}
          {msg && <div style={okStyle}>{msg}</div>}
          <button type="submit" disabled={busy} style={btn}>
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: "0.78rem", textAlign: "center", color: "#8a847a" }}>
          {mode === "signup" ? "Have an account? " : "New here? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); setMsg(null); }}
            style={{ background: "none", border: "none", color: "#1a4f7a", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: "inherit" }}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </div>
        <div style={{ marginTop: 20, padding: 12, background: "#f5f0e8", borderRadius: 8, fontSize: "0.72rem", color: "#5a5450", lineHeight: 1.5 }}>
          Your account tracks which contacts you've emailed so you never see them twice — and prevents the whole school from spamming the same professor.
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "#8a847a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 };
const inp: React.CSSProperties = { width: "100%", background: "#f5f0e8", border: "1.5px solid #cdc7bc", color: "#1a1714", padding: "10px 12px", borderRadius: 6, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "0.9rem", outline: "none" };
const btn: React.CSSProperties = { marginTop: 20, width: "100%", background: "#1a1714", color: "#f5f0e8", border: "none", padding: "12px", borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", fontWeight: 500 };
const errStyle: React.CSSProperties = { marginTop: 12, padding: "8px 12px", background: "#fdf5f4", border: "1px solid #e8c0bc", borderRadius: 6, color: "#c0392b", fontSize: "0.78rem" };
const okStyle: React.CSSProperties = { marginTop: 12, padding: "8px 12px", background: "#f0f9f4", border: "1px solid #b8d8c6", borderRadius: 6, color: "#1d7a4a", fontSize: "0.78rem" };
