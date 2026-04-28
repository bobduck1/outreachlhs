import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ─── CREATOR ACCESS ───────────────────────────────────────────────────────────
// The plaintext passcode is NEVER stored in source. We store only its SHA-256
// hash and compare hashes at unlock time. To rotate the passcode, generate a
// new SHA-256 hash (hex) of your chosen string and paste it below.
//
// Current passcode hash (default: "akhil-reachout-2025" — change this!):
const CREATOR_PASSCODE_SHA256 =
  "40dd30e7f41df5fc92c5c349b11bd160ae62fe31f2f4a44d07e5006cb884d873";

// Brute-force protection: lock out after N failed attempts within the window.
const MAX_UNLOCK_ATTEMPTS = 5;
const UNLOCK_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');`;

const css = `
  ${FONTS}
  .ro-scope {
    --bg: #f5f0e8; --surface: #ede8df; --surface2: #e3ddd3; --border: #cdc7bc;
    --text: #1a1714; --muted: #8a847a; --red: #c0392b; --green: #1d7a4a;
    --blue: #1a4f7a; --orange: #c45e1a;
  }
  .ro-scope * { box-sizing: border-box; }
  .ro-wrap { display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans', sans-serif; }
  .ro-header { background: var(--text); color: var(--bg); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .ro-logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.5rem; letter-spacing: -1px; }
  .ro-logo span { color: #c8f064; }
  .ro-sub { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; color: rgba(245,240,232,0.45); letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .ro-hstats { display: flex; gap: 20px; }
  .ro-hstat { text-align: right; font-family: 'IBM Plex Mono', monospace; }
  .ro-hstat-num { font-size: 1.3rem; font-weight: 500; color: #c8f064; display: block; line-height: 1; }
  .ro-hstat-lbl { font-size: 0.58rem; color: rgba(245,240,232,0.4); text-transform: uppercase; letter-spacing: 1px; }
  .ro-main { display: grid; grid-template-columns: 340px 1fr; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .ro-main { grid-template-columns: 1fr; } }
  .ro-sidebar { background: var(--surface); border-right: 2px solid var(--border); display: flex; flex-direction: column; }
  .ro-sec { padding: 18px 20px; border-bottom: 1px solid var(--border); }
  .ro-sec-lbl { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .ro-sec-lbl::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .ro-cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .ro-cat-btn { background: var(--bg); border: 2px solid var(--border); border-radius: 8px; padding: 10px 9px; cursor: pointer; text-align: left; transition: all 0.15s; font-family: 'IBM Plex Sans', sans-serif; }
  .ro-cat-btn:hover { border-color: var(--text); background: var(--surface2); }
  .ro-cat-btn.active { background: var(--text); border-color: var(--text); color: var(--bg); }
  .ro-cat-icon { font-size: 1.2rem; display: block; margin-bottom: 3px; }
  .ro-cat-name { font-size: 0.72rem; font-weight: 600; display: block; line-height: 1.2; }
  .ro-cat-sub { font-size: 0.58rem; color: var(--muted); margin-top: 1px; font-family: 'IBM Plex Mono', monospace; }
  .ro-cat-btn.active .ro-cat-sub { color: rgba(245,240,232,0.5); }
  .ro-cat-count { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; color: var(--muted); margin-top: 2px; }
  .ro-cat-btn.active .ro-cat-count { color: rgba(245,240,232,0.6); }
  .ro-fg { margin-bottom: 12px; }
  .ro-lbl { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .ro-inp, .ro-sel, .ro-ta { width: 100%; background: var(--bg); border: 1.5px solid var(--border); color: var(--text); padding: 8px 11px; border-radius: 6px; font-family: 'IBM Plex Sans', sans-serif; font-size: 0.83rem; outline: none; transition: border-color 0.15s; }
  .ro-inp:focus, .ro-sel:focus, .ro-ta:focus { border-color: var(--text); }
  .ro-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .ro-btn { display: inline-flex; align-items: center; gap: 5px; padding: 9px 16px; border-radius: 6px; border: 2px solid transparent; font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; font-weight: 500; cursor: pointer; letter-spacing: 0.3px; text-transform: uppercase; transition: all 0.15s; white-space: nowrap; }
  .ro-btn-dark { background: var(--text); color: var(--bg); border-color: var(--text); }
  .ro-btn-dark:hover:not(:disabled) { background: #3a3531; }
  .ro-btn-dark:disabled { background: var(--border); color: var(--muted); border-color: var(--border); cursor: not-allowed; }
  .ro-btn-outline { background: transparent; color: var(--text); border-color: var(--border); }
  .ro-btn-outline:hover { border-color: var(--text); }
  .ro-btn-red { background: transparent; color: var(--red); border-color: #e8c0bc; }
  .ro-btn-red:hover { background: #fdf5f4; }
  .ro-btn-green { background: var(--green); color: white; border-color: var(--green); }
  .ro-btn-green:hover:not(:disabled) { background: #165c37; }
  .ro-btn-green:disabled { background: var(--border); color: var(--muted); border-color: var(--border); cursor: not-allowed; }
  .ro-btn-full { width: 100%; justify-content: center; }
  .ro-btn-row { display: flex; gap: 7px; flex-wrap: wrap; }
  .ro-content { display: flex; flex-direction: column; min-height: 0; }
  .ro-tabs { display: flex; background: var(--surface); border-bottom: 2px solid var(--border); padding: 0 28px; flex-shrink: 0; overflow-x: auto; }
  .ro-tab { padding: 14px 18px; font-family: 'IBM Plex Mono', monospace; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; color: var(--muted); border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s; white-space: nowrap; }
  .ro-tab:hover { color: var(--text); }
  .ro-tab.active { color: var(--text); border-bottom-color: var(--text); font-weight: 500; }
  .ro-qbadge { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; background: #1a1714; color: #c8f064; padding: 1px 6px; border-radius: 10px; margin-left: 4px; }
  .ro-panel { display: flex; flex-direction: column; flex: 1; padding: 24px 28px; }
  .ro-notice { background: #fff8e8; border: 1.5px solid #e8d89a; border-radius: 8px; padding: 11px 14px; font-size: 0.76rem; color: #7a6a1a; line-height: 1.5; margin-bottom: 18px; }
  .ro-notice strong { color: #5a4a00; }
  .ro-empty { text-align: center; padding: 44px 20px; color: var(--muted); border: 2px dashed var(--border); border-radius: 12px; }
  .ro-empty-icon { font-size: 2.2rem; display: block; margin-bottom: 10px; }
  .ro-empty-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.95rem; color: var(--text); margin-bottom: 5px; }
  .ro-empty-sub { font-size: 0.8rem; line-height: 1.5; }
  .ro-results-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
  .ro-results-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.95rem; }
  .ro-results-grid { display: flex; flex-direction: column; gap: 9px; }
  .ro-card { background: var(--surface); border: 2px solid var(--border); border-radius: 10px; padding: 14px 18px; display: flex; align-items: flex-start; gap: 14px; transition: border-color 0.15s; }
  .ro-card:hover { border-color: #aaa9a0; }
  .ro-card.selected { border-color: var(--text); background: var(--surface2); }
  .ro-check { width: 20px; height: 20px; border: 2px solid var(--border); border-radius: 4px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; transition: all 0.15s; margin-top: 2px; }
  .ro-card.selected .ro-check { background: var(--text); border-color: var(--text); color: var(--bg); }
  .ro-card-info { flex: 1; min-width: 0; }
  .ro-card-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.92rem; margin-bottom: 2px; }
  .ro-card-inst { font-size: 0.76rem; color: var(--muted); margin-bottom: 4px; }
  .ro-card-email { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: var(--blue); background: #eef3f8; padding: 2px 8px; border-radius: 4px; display: inline-block; word-break: break-all; }
  .ro-card-detail { font-size: 0.73rem; color: var(--muted); margin-top: 6px; line-height: 1.4; font-style: italic; }
  .ro-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; flex-shrink: 0; }
  .ro-cat-tag { font-family: 'IBM Plex Mono', monospace; font-size: 0.56rem; padding: 2px 6px; border-radius: 3px; background: var(--surface2); color: var(--muted); text-transform: uppercase; }
  .ro-stats-row { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .ro-stat-card { background: var(--surface); border: 2px solid var(--border); border-radius: 8px; padding: 12px 16px; flex: 1; min-width: 80px; }
  .ro-stat-num { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.6rem; display: block; line-height: 1; margin-bottom: 3px; }
  .ro-stat-lbl { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .s-green .ro-stat-num { color: var(--green); }
  .s-orange .ro-stat-num { color: var(--orange); }
  .ro-qlist { display: flex; flex-direction: column; gap: 7px; }
  .ro-qcard { background: var(--surface); border: 2px solid var(--border); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-left: 4px solid var(--border); flex-wrap: wrap; }
  .ro-qcard.st-pending { border-left-color: var(--muted); }
  .ro-qcard.st-done { border-left-color: var(--green); }
  .ro-qcard.st-sent { border-left-color: var(--blue); opacity: 0.85; }
  .ro-qcard-info { flex: 1; min-width: 200px; }
  .ro-qcard-name { font-weight: 600; font-size: 0.88rem; }
  .ro-qcard-email { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; color: var(--muted); margin-top: 2px; word-break: break-all; }
  .ro-qcard-status { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; white-space: nowrap; }
  .st-pending .ro-qcard-status { color: var(--muted); }
  .st-done .ro-qcard-status { color: var(--green); }
  .st-sent .ro-qcard-status { color: var(--blue); }
  .ro-sent-check { background: transparent; border: 2px solid var(--border); width: 22px; height: 22px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.75rem; transition: all 0.15s; padding: 0; color: var(--muted); }
  .ro-sent-check:hover { border-color: var(--blue); color: var(--blue); }
  .ro-sent-check.checked { background: var(--blue); border-color: var(--blue); color: white; }
  .ro-qcard-remove { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 1.1rem; padding: 2px 5px; border-radius: 4px; line-height: 1; }
  .ro-qcard-remove:hover { color: var(--red); }
  .ro-mailto-btn { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; color: var(--blue); background: #eef3f8; border: 1px solid #c8d8e8; border-radius: 4px; padding: 5px 10px; cursor: pointer; text-decoration: none; display: inline-block; }
  .ro-mailto-btn:hover { background: #dde8f0; }
  .ro-upload { border: 2px dashed var(--border); border-radius: 8px; padding: 14px; text-align: center; background: var(--bg); }
  .ro-upload p { font-size: 0.72rem; color: var(--muted); margin: 6px 0 0; line-height: 1.4; }
  .ro-upload input { display: none; }
  .ro-upload label { cursor: pointer; display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; color: var(--text); text-transform: uppercase; letter-spacing: 1px; padding: 7px 14px; border: 1.5px solid var(--text); border-radius: 6px; }
  .ro-upload label:hover { background: var(--text); color: var(--bg); }
`;

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
const CATS: Record<string, { icon: string; name: string; sub: string; label: string; matches: string[] }> = {
  all:         { icon: "🌐", name: "All Contacts",     sub: "Show everyone",            label: "Contact",              matches: [] },
  polisci:     { icon: "🏛️", name: "Political Science", sub: "Professors & researchers", label: "Political Science Professor", matches: ["poli sci", "political"] },
  law:         { icon: "⚖️", name: "Law / Legal",       sub: "Attorneys & professors",   label: "Attorney / Law Professor",    matches: ["law"] },
  stem:        { icon: "🔬", name: "STEM Research",     sub: "Lab & university research", label: "STEM Researcher",            matches: ["stem"] },
  premed:      { icon: "🏥", name: "Pre-Med / Medical", sub: "Shadowing & medicine",     label: "Physician / Medical Researcher", matches: ["pre-med", "premed", "medical"] },
  business:    { icon: "💼", name: "Business / Finance",sub: "Local professionals",       label: "Business Professional",      matches: ["business", "finance"] },
  research:    { icon: "📊", name: "Think Tanks",       sub: "Policy & research orgs",    label: "Policy Researcher",          matches: ["think tank", "policy"] },
  engineering: { icon: "⚙️", name: "Engineering",       sub: "Firms & professors",        label: "Engineer",                   matches: ["engineering"] },
  nonprofit:   { icon: "🤝", name: "Nonprofit / Civic", sub: "Orgs & advocacy",           label: "Nonprofit Leader",           matches: ["nonprofit", "civic"] },
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Contact = {
  id: string;
  name: string;
  email: string;
  field: string;
  institution: string;
  title: string;
  category: string;
  location: string;
};

type FormState = {
  name: string;
  school: string;
  grade: string;
  email: string;
  phone: string;
  location: string;
  resume: string;          // extracted text from PDF
  resumeFileName: string;  // original filename, for display
  interests: string;       // free-text interests (used for personalized matches)
  search: string;
};

type QueueItem = Contact & { qid: string; status: "pending" | "done" | "sent"; catKey: string; sentAt?: string };

// ─── CSV PARSE (handles quoted fields) ────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(v => v && v.trim().length)).map(r => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

function rowToContact(r: Record<string, string>, idx: number): Contact | null {
  const name = r.name || r.Name;
  const email = r.email || r.Email;
  if (!name || !email) return null;
  return {
    id: `${email}-${idx}`,
    name,
    email,
    field: r.field || r.Field || "",
    institution: r.institution || r.Institution || "",
    title: r.title || r.Title || "",
    category: r.category || r.Category || "",
    location: r.location || r.Location || "",
  };
}

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────
function categoryKeyForContact(c: Contact): string {
  const cat = (c.category || "").toLowerCase();
  for (const [key, def] of Object.entries(CATS)) {
    if (key === "all") continue;
    if (def.matches.some(m => cat.includes(m))) return key;
  }
  return "polisci";
}

function buildSubject(contact: Contact, catKey: string, school: string): string {
  const map: Record<string, string> = {
    polisci:     `High School Student Seeking Research Opportunity in ${contact.field || "Political Science"}`,
    law:         `${school} Student Seeking Legal Shadowing Opportunity`,
    stem:        `High School Student Seeking Research Opportunity in ${contact.field || "STEM"}`,
    premed:      `High School Student Seeking Medical Shadowing Opportunity`,
    business:    `High School Student Seeking Shadowing / Informational Interview`,
    research:    `High School Student Seeking Research Involvement Opportunity`,
    engineering: `High School Student Seeking Shadowing Opportunity in ${contact.field || "Engineering"}`,
    nonprofit:   `High School Student Seeking Volunteer / Shadowing Opportunity`,
  };
  return map[catKey] || `High School Student Seeking Opportunity in ${contact.field || "Your Field"}`;
}

// Pull a short, lightly-referenced "experience" snippet out of the resume.
// We grab the first plausible bullet/role line so the email can lightly cite
// real experience without dumping the whole resume.
function pickExperienceSnippet(resume: string): string {
  const text = resume.trim();
  if (!text) return "";
  // Split into lines; prefer ones that look like roles/bullets and aren't headers.
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const blacklist = /^(resume|curriculum vitae|education|experience|skills|projects|contact|objective|summary)$/i;
  const candidates = lines.filter(l =>
    l.length >= 25 && l.length <= 220 && !blacklist.test(l)
  );
  const pick = candidates[0] || lines.find(l => l.length > 20) || "";
  // Strip trailing punctuation/dates noise, lower-case the leading verb if shouty.
  return pick.replace(/\s+/g, " ").replace(/[•●▪–—-]\s*/g, "").trim();
}

function buildBody(contact: Contact, catKey: string, info: FormState): string {
  const { name, school, grade, email, phone, location, resume, interests } = info;
  const titleRaw = (contact.title || "").toLowerCase();
  let sal = "Mr.";
  if (titleRaw.includes("professor") || titleRaw.includes("prof")) sal = "Professor";
  else if (titleRaw.includes("dr") || titleRaw.includes("dean")) sal = "Dr.";
  else if (["polisci", "stem", "research"].includes(catKey)) sal = "Professor";
  const lastName = contact.name.split(" ").slice(-1)[0];

  // Field-of-interest phrasing per category — used only if the student didn't
  // type their own interests. We NEVER reference anything from the resume.
  const fieldPhrase: Record<string, string> = {
    polisci:     contact.field || "American politics, political behavior, and public policy",
    law:         contact.field || "the practice of law and the legal system",
    stem:        contact.field || "scientific research",
    premed:      contact.field || "medicine and clinical practice",
    business:    contact.field || "business and finance",
    research:    contact.field || "public policy research",
    engineering: contact.field || "engineering",
    nonprofit:   contact.field || "civic engagement and social impact",
  };
  const studentInterest = interests.trim() || fieldPhrase[catKey] || (contact.field || "your field");

  // Ask line per category.
  const asks: Record<string, string> = {
    polisci:     `I am reaching out to ask if there is any way I could contribute to your research in a small, supporting capacity. I am willing to assist with background research, literature review, or document organization, whatever would be most helpful.`,
    law:         `I am reaching out to ask if there is any possibility of briefly shadowing your work, even for a day or two. I am not seeking payment and would work entirely around your schedule.`,
    stem:        `I am reaching out to ask if there is any way I could contribute to your research in a small, supporting capacity. I am willing to assist with literature review, data organization, or lab preparation, whatever would be most helpful.`,
    premed:      `I am reaching out to ask if there is any possibility of briefly shadowing your practice, even for a day or two. I am not seeking payment and would work entirely around your schedule.`,
    business:    `I am reaching out to ask if there is any possibility of a brief shadowing experience or informational conversation about your work.`,
    research:    `I am reaching out to ask if there is any way I could contribute to your organization's research in a small, supporting capacity. I am willing to assist with background research, literature review, or any supporting tasks.`,
    engineering: `I am reaching out to ask if there is any possibility of briefly shadowing your work, or contributing to any ongoing projects in a small way.`,
    nonprofit:   `I am reaching out to ask if there is any opportunity to volunteer, shadow, or contribute to your organization's work in a small way.`,
  };
  const ask = asks[catKey] || asks.polisci;

  // Paragraph 2: reference what they actually do at their institution.
  const profileLine = (() => {
    const article = (contact.title && /^[aeiou]/i.test(contact.title)) ? "an" : "a";
    if (contact.title && contact.institution) {
      return `I came across your profile at ${contact.institution} as ${article} ${contact.title}, and I was drawn to the department's strong emphasis on ${contact.field || "your area of work"}.`;
    }
    if (contact.institution) {
      return `I came across your work at ${contact.institution}, and I was drawn to the department's strong emphasis on ${contact.field || "your area of work"}.`;
    }
    if (contact.title) {
      return `I came across your work as ${contact.title}, and I was drawn to your focus on ${contact.field || "your area of work"}.`;
    }
    return `I came across your work, and I was drawn to your focus on ${contact.field || "your area of work"}.`;
  })();

  // Connector sentence for paragraph 2 — generic, never references resume.
  const connector = `The intersection of ${studentInterest}, which sits at the heart of how we understand the world around us, is something I think about constantly as a high school student navigating an overwhelming information environment.`;

  // Resume attachment line — only if a resume PDF was uploaded.
  const resumeAttachLine = resume.trim()
    ? ` I have attached my resume for your reference.`
    : ``;

  const opener = `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a strong interest in ${studentInterest}.`;
  const para2 = `${profileLine} ${connector}`;
  const para3 = `${ask}${resumeAttachLine}`;

  const body = [
    `Dear ${sal} ${lastName},`,
    opener,
    para2,
    para3,
    `I understand this is an unusual request coming from a high school student, and I deeply appreciate any time you can spare. Even brief guidance about how to prepare for this kind of work would be meaningful to me.`,
    `Thank you very much for your consideration.`,
    `Sincerely,`,
    `${name}`,
    `${email}${phone ? ` || ${phone}` : ""}`,
  ].join("\n\n");

  // If a resume was uploaded, remind the student to attach it before sending.
  return resume.trim()
    ? `${body}\n\n[Reminder to ${name}: attach your resume PDF in Gmail before sending.]`
    : body;
}

// ─── PERSONALIZED MATCH SCORING ───────────────────────────────────────────────
// Score a contact against the student's resume + interests to surface the most
// relevant people first. Pure keyword overlap — no model required.
const STOPWORDS = new Set([
  "the","a","an","and","or","of","for","to","in","on","at","is","are","was","were",
  "i","my","me","with","by","this","that","it","as","be","been","have","has","had",
  "from","about","into","over","than","then","also","new","high","school","student",
  "university","college","class","grade","year","work","using","used","using",
]);
function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
}
function scoreContact(c: Contact, studentTokens: Set<string>): number {
  if (!studentTokens.size) return 0;
  const haystack = `${c.field} ${c.title} ${c.institution} ${c.category}`.toLowerCase();
  const haystackTokens = tokenize(haystack);
  let score = 0;
  const seen = new Set<string>();
  for (const t of haystackTokens) {
    if (studentTokens.has(t) && !seen.has(t)) {
      seen.add(t);
      // Field matches are most meaningful — weight them higher.
      score += c.field.toLowerCase().includes(t) ? 3 : 1;
    }
  }
  return score;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  form: "reachout.form.v1",
  extra: "reachout.extra.v1",
  queue: "reachout.queue.v1",
};

const DEFAULT_FORM: FormState = {
  name: "",
  school: "",
  grade: "sophomore",
  email: "",
  phone: "",
  location: "Livingston, NJ",
  resume: "",
  resumeFileName: "",
  interests: "",
  search: "",
};

export default function ReachOut() {
  const [cat, setCat] = useState<string>("all");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [tab, setTab] = useState<"discover" | "queue" | "sent" | "log">("discover");
  const [baseContacts, setBaseContacts] = useState<Contact[]>([]);
  const [extraContacts, setExtraContacts] = useState<Contact[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<{ ts: string; msg: string; type: string }[]>([
    { ts: new Date().toLocaleTimeString(), msg: "ReachOut initialized.", type: "info" },
  ]);
  const logRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const resumeRef = useRef<HTMLInputElement | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [personalized, setPersonalized] = useState(false);

  const addLog = useCallback((msg: string, type = "info") => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { ts, msg, type }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }, []);

  // Load saved form, extra contacts, queue, creator flag
  useEffect(() => {
    try {
      const f = localStorage.getItem(STORAGE_KEYS.form);
      if (f) setForm({ ...DEFAULT_FORM, ...JSON.parse(f) });
      const e = localStorage.getItem(STORAGE_KEYS.extra);
      if (e) setExtraContacts(JSON.parse(e));
      const q = localStorage.getItem(STORAGE_KEYS.queue);
      if (q) setQueue(JSON.parse(q));
      if (localStorage.getItem("reachout.creator.session")) setIsCreator(true);
    } catch {}
  }, []);

  // ── CREATOR UNLOCK (hash-compared, rate-limited) ────────────────────────────
  function getLockoutRemainingMs(): number {
    try {
      const raw = localStorage.getItem("reachout.creator.lockout");
      if (!raw) return 0;
      const { until } = JSON.parse(raw) as { until: number };
      return Math.max(0, until - Date.now());
    } catch { return 0; }
  }
  function recordFailedAttempt() {
    try {
      const raw = localStorage.getItem("reachout.creator.attempts");
      const now = Date.now();
      const arr: number[] = raw ? JSON.parse(raw) : [];
      const recent = arr.filter(t => now - t < UNLOCK_LOCKOUT_MS);
      recent.push(now);
      localStorage.setItem("reachout.creator.attempts", JSON.stringify(recent));
      if (recent.length >= MAX_UNLOCK_ATTEMPTS) {
        localStorage.setItem(
          "reachout.creator.lockout",
          JSON.stringify({ until: now + UNLOCK_LOCKOUT_MS })
        );
      }
    } catch {}
  }
  function clearAttempts() {
    try {
      localStorage.removeItem("reachout.creator.attempts");
      localStorage.removeItem("reachout.creator.lockout");
    } catch {}
  }
  async function tryUnlock() {
    const remaining = getLockoutRemainingMs();
    if (remaining > 0) {
      addLog(`Locked out. Try again in ${Math.ceil(remaining / 1000)}s.`, "err");
      return;
    }
    if (!unlockInput.trim()) return;
    setUnlocking(true);
    try {
      const hashed = await sha256Hex(unlockInput.trim());
      // Constant-time-ish compare (length is fixed for SHA-256 hex).
      let match = hashed.length === CREATOR_PASSCODE_SHA256.length;
      for (let i = 0; i < hashed.length; i++) {
        if (hashed[i] !== CREATOR_PASSCODE_SHA256[i]) match = false;
      }
      if (match) {
        // Store an opaque session token, NOT the passcode. Token is regenerated each unlock.
        const token = crypto.getRandomValues(new Uint8Array(16));
        const tokenHex = Array.from(token).map(b => b.toString(16).padStart(2, "0")).join("");
        localStorage.setItem("reachout.creator.session", tokenHex);
        clearAttempts();
        setIsCreator(true);
        setShowUnlock(false);
        setUnlockInput("");
        addLog("Creator mode unlocked. CSV upload available.", "ok");
      } else {
        recordFailedAttempt();
        const left = MAX_UNLOCK_ATTEMPTS - JSON.parse(localStorage.getItem("reachout.creator.attempts") || "[]").length;
        addLog(left > 0 ? `Incorrect passcode. ${left} attempt(s) left.` : "Too many failed attempts. Locked for 5 minutes.", "err");
      }
    } finally {
      setUnlocking(false);
    }
  }
  function lockCreator() {
    localStorage.removeItem("reachout.creator.session");
    setIsCreator(false);
    addLog("Creator mode locked.", "warn");
  }

  // ── RESUME PDF EXTRACTION (client-side via pdfjs) ───────────────────────────
  async function onUploadResume(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { addLog("Resume must be under 5MB.", "err"); e.target.value = ""; return; }
    setParsingResume(true);
    addLog(`Reading ${file.name}…`, "info");
    try {
      const buf = await file.arrayBuffer();
      // Lazy-load pdfjs only when needed (it's heavy)
      const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
        text += pageText + "\n";
      }
      const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
      if (!cleaned) { addLog("No text could be extracted (is the PDF a scan?).", "warn"); }
      setForm(f => ({ ...f, resume: cleaned, resumeFileName: file.name }));
      addLog(`Resume parsed: ${cleaned.length} characters from ${file.name}.`, "ok");
    } catch (err) {
      addLog(`Resume parse failed: ${(err as Error).message}`, "err");
    } finally {
      setParsingResume(false);
      e.target.value = "";
    }
  }
  function clearResume() {
    setForm(f => ({ ...f, resume: "", resumeFileName: "" }));
    addLog("Resume cleared.", "warn");
  }


  // Persist
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.form, JSON.stringify(form)); } catch {} }, [form]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.extra, JSON.stringify(extraContacts)); } catch {} }, [extraContacts]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue)); } catch {} }, [queue]);

  // Load base CSV from /data/contacts.csv
  useEffect(() => {
    fetch("/data/contacts.csv")
      .then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(text => {
        const rows = parseCSV(text);
        const list: Contact[] = [];
        rows.forEach((r, i) => { const c = rowToContact(r, i); if (c) list.push(c); });
        setBaseContacts(list);
        addLog(`Loaded ${list.length} contacts from database.`, "ok");
      })
      .catch(err => addLog(`Failed to load contacts: ${err.message}`, "err"))
      .finally(() => setLoading(false));
  }, [addLog]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const allContacts = useMemo(() => {
    // dedupe by email (extra overrides base)
    const map = new Map<string, Contact>();
    baseContacts.forEach(c => map.set(c.email.toLowerCase(), c));
    extraContacts.forEach(c => map.set(c.email.toLowerCase(), c));
    return Array.from(map.values());
  }, [baseContacts, extraContacts]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: allContacts.length };
    Object.entries(CATS).forEach(([k, def]) => {
      if (k === "all") return;
      out[k] = allContacts.filter(c => def.matches.some(m => c.category.toLowerCase().includes(m))).length;
    });
    return out;
  }, [allContacts]);

  // Tokens drawn from resume + interests for personalized ranking.
  const studentTokens = useMemo(() => {
    const set = new Set<string>();
    tokenize(form.resume).forEach(t => set.add(t));
    // Interests get a stronger weight by adding them twice in spirit — but since
    // we use a set, instead we'll bias by re-checking interests inside the
    // ranker below via a second pass. For now, just include them.
    tokenize(form.interests).forEach(t => set.add(t));
    return set;
  }, [form.resume, form.interests]);

  const canPersonalize = studentTokens.size >= 3; // need a meaningful signal

  const filtered = useMemo(() => {
    const def = CATS[cat];
    let list = allContacts;
    if (cat !== "all") {
      list = list.filter(c => def.matches.some(m => c.category.toLowerCase().includes(m)));
    }
    const loc = form.location.trim().toLowerCase();
    if (loc) {
      const stateMatch = loc.match(/\b([a-z]{2})\b$/i);
      if (stateMatch) {
        const code = stateMatch[1].toUpperCase();
        list = list.filter(c => c.location.toUpperCase().includes(code));
      }
    }
    const q = form.search.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.field.toLowerCase().includes(q) ||
        c.institution.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      );
    }
    if (personalized && canPersonalize) {
      const interestTokens = new Set(tokenize(form.interests));
      const scored = list
        .map(c => {
          let s = scoreContact(c, studentTokens);
          // Extra weight if a token came from explicit interests.
          for (const t of interestTokens) {
            if (`${c.field} ${c.title} ${c.institution}`.toLowerCase().includes(t)) s += 2;
          }
          return { c, s };
        })
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 25);
      return scored.map(x => x.c);
    }
    return list;
  }, [allContacts, cat, form.location, form.search, personalized, canPersonalize, studentTokens, form.interests]);

  // Queue helpers
  function addToQueue(contact: Contact) {
    if (queue.some(q => q.email.toLowerCase() === contact.email.toLowerCase())) return;
    const catKey = categoryKeyForContact(contact);
    setQueue(q => [...q, { ...contact, status: "pending", qid: `${Date.now()}-${Math.random()}`, catKey }]);
    addLog(`Queued: ${contact.name} <${contact.email}>`, "ok");
  }
  function toggleSelect(c: Contact) {
    const existing = queue.find(q => q.email.toLowerCase() === c.email.toLowerCase());
    if (existing) {
      if (existing.status === "sent") {
        addLog(`${c.name} is already marked as sent — uncheck them in the Sent tab to re-add.`, "warn");
        return;
      }
      setQueue(q => q.filter(x => x.email.toLowerCase() !== c.email.toLowerCase()));
      addLog(`Removed from queue: ${c.name}`, "warn");
    } else {
      addToQueue(c);
    }
  }
  function addAllVisible() {
    const toAdd = filtered.filter(r => !queue.some(q => q.email.toLowerCase() === r.email.toLowerCase()));
    if (!toAdd.length) return;
    setQueue(q => [
      ...q,
      ...toAdd.map(r => ({ ...r, status: "pending" as const, qid: `${Date.now()}-${Math.random()}-${r.id}`, catKey: categoryKeyForContact(r) })),
    ]);
    addLog(`Added ${toAdd.length} contacts to queue.`, "ok");
  }
  function removeFromQueue(qid: string) {
    const c = queue.find(q => q.qid === qid);
    setQueue(q => q.filter(x => x.qid !== qid));
    if (c) addLog(`Removed: ${c.name}`, "warn");
  }
  function clearQueue() {
    if (!queue.length) return;
    if (!confirm("Clear the entire queue (does not affect Sent tab)?")) return;
    // Only clear non-sent items so the "already-emailed" record is preserved.
    setQueue(q => q.filter(x => x.status === "sent"));
    addLog("Queue cleared (sent items preserved).", "warn");
  }

  // Mark a single queue item as sent (or unmark it).
  function markSent(qid: string) {
    setQueue(q => q.map(x => x.qid === qid ? { ...x, status: "sent", sentAt: new Date().toISOString() } : x));
    const c = queue.find(x => x.qid === qid);
    if (c) addLog(`Marked sent: ${c.name}`, "ok");
  }
  function unmarkSent(qid: string) {
    setQueue(q => q.map(x => x.qid === qid ? { ...x, status: "pending", sentAt: undefined } : x));
    const c = queue.find(x => x.qid === qid);
    if (c) addLog(`Re-opened: ${c.name} (back to pending)`, "warn");
  }
  function markAllSent() {
    const toMark = queue.filter(c => c.status !== "sent");
    if (!toMark.length) return;
    if (!confirm(`Mark all ${toMark.length} queued contact(s) as sent? They'll move to the Sent tab and won't be re-emailed.`)) return;
    const now = new Date().toISOString();
    setQueue(q => q.map(x => x.status === "sent" ? x : { ...x, status: "sent", sentAt: now }));
    addLog(`Marked ${toMark.length} contact(s) as sent.`, "ok");
  }

  // Gmail compose URL — opens a new draft directly in Gmail web (per-user; whoever's signed in)
  function gmailComposeURL(contact: QueueItem): string {
    const subject = buildSubject(contact, contact.catKey, form.school);
    const body = buildBody(contact, contact.catKey, form);
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: contact.email,
      su: subject,
      body,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }

  function openGmailDraft(contact: QueueItem) {
    const url = gmailComposeURL(contact);
    // Use window.top to bust out of any iframe (e.g. Lovable preview), since
    // mail.google.com sends X-Frame-Options: DENY and refuses to load in frames.
    const target = (window.top || window);
    const win = target.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      addLog(`Popup blocked for ${contact.name}. Allow popups or use the "Copy link" button.`, "err");
      return;
    }
    setQueue(q => q.map(x => x.qid === contact.qid ? { ...x, status: "done" } : x));
    addLog(`Opened Gmail draft for ${contact.name}`, "ok");
  }

  async function copyDraftURL(contact: QueueItem) {
    try {
      await navigator.clipboard.writeText(gmailComposeURL(contact));
      addLog(`Gmail link copied for ${contact.name}. Paste into a new browser tab.`, "ok");
    } catch {
      addLog("Could not copy to clipboard.", "err");
    }
  }

  function openAllDrafts() {
    const pending = queue.filter(c => c.status === "pending");
    if (!pending.length) return;
    if (!confirm(`Open ${pending.length} Gmail draft(s) in new tabs? (Allow popups for this site.)`)) return;
    pending.forEach((c, i) => {
      setTimeout(() => openGmailDraft(c), i * 500);
    });
  }

  // CSV upload — append/replace extra contacts
  function onUploadCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const rows = parseCSV(text);
        if (!rows.length) { addLog("CSV had no rows.", "warn"); return; }
        const required = ["name", "email"];
        const headers = Object.keys(rows[0]).map(h => h.toLowerCase());
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length) { addLog(`CSV missing required column(s): ${missing.join(", ")}`, "err"); return; }
        const newOnes: Contact[] = [];
        rows.forEach((r, i) => { const c = rowToContact(r, i); if (c) newOnes.push(c); });
        setExtraContacts(prev => {
          const map = new Map<string, Contact>();
          prev.forEach(c => map.set(c.email.toLowerCase(), c));
          newOnes.forEach(c => map.set(c.email.toLowerCase(), c));
          return Array.from(map.values());
        });
        addLog(`Imported ${newOnes.length} contacts from ${file.name}.`, "ok");
      } catch (err) {
        addLog(`Import failed: ${(err as Error).message}`, "err");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function clearExtras() {
    if (!extraContacts.length) return;
    if (!confirm(`Remove all ${extraContacts.length} uploaded contacts?`)) return;
    setExtraContacts([]);
    addLog("Cleared uploaded contacts.", "warn");
  }

  const qSent = queue.filter(c => c.status === "sent").length;
  const qDone = queue.filter(c => c.status === "done").length;
  const qPending = queue.filter(c => c.status === "pending").length;
  const activeQueue = queue.filter(c => c.status !== "sent");
  const sentQueue = queue.filter(c => c.status === "sent");
  const formReady = form.name.trim() && form.school.trim() && form.email.trim();

  return (
    <div className="ro-scope">
      <style>{css}</style>
      <div className="ro-wrap">
        <div className="ro-header">
          <div>
            <div className="ro-logo">Reach<span>Out</span></div>
            <div className="ro-sub">High School Outreach Engine</div>
          </div>
          <div className="ro-hstats">
            <div className="ro-hstat"><span className="ro-hstat-num">{allContacts.length}</span><span className="ro-hstat-lbl">Contacts</span></div>
            <div className="ro-hstat"><span className="ro-hstat-num">{activeQueue.length}</span><span className="ro-hstat-lbl">Queued</span></div>
            <div className="ro-hstat"><span className="ro-hstat-num">{qSent}</span><span className="ro-hstat-lbl">Sent</span></div>
          </div>
        </div>

        <div className="ro-main">
          {/* SIDEBAR */}
          <div className="ro-sidebar">
            <div className="ro-sec">
              <div className="ro-sec-lbl">Field</div>
              <div className="ro-cat-grid">
                {Object.entries(CATS).map(([k, v]) => (
                  <button key={k} className={`ro-cat-btn${cat === k ? " active" : ""}`} onClick={() => setCat(k)}>
                    <span className="ro-cat-icon">{v.icon}</span>
                    <span className="ro-cat-name">{v.name}</span>
                    <span className="ro-cat-count">{counts[k] ?? 0} contacts</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ro-sec">
              <div className="ro-sec-lbl">Your Info</div>
              <div className="ro-fg"><label className="ro-lbl">Your Name *</label><input className="ro-inp" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Jane Doe" /></div>
              <div className="ro-fg"><label className="ro-lbl">Your School *</label><input className="ro-inp" value={form.school} onChange={e => setField("school", e.target.value)} placeholder="Livingston High School" /></div>
              <div className="ro-row2">
                <div className="ro-fg">
                  <label className="ro-lbl">Grade</label>
                  <select className="ro-sel" value={form.grade} onChange={e => setField("grade", e.target.value)}>
                    <option>freshman</option><option>sophomore</option><option>junior</option><option>senior</option>
                  </select>
                </div>
                <div className="ro-fg"><label className="ro-lbl">Your Email *</label><input className="ro-inp" type="email" value={form.email} onChange={e => setField("email", e.target.value)} placeholder="you@gmail.com" /></div>
              </div>
              <div className="ro-fg"><label className="ro-lbl">Your Phone</label><input className="ro-inp" value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="(555) 555-5555" /></div>
              <div className="ro-fg">
                <label className="ro-lbl">Resume (PDF)</label>
                <div className="ro-upload">
                  <label htmlFor="ro-resume">{parsingResume ? "⏳ Reading…" : (form.resumeFileName ? "🔄 Replace PDF" : "📄 Upload Resume PDF")}</label>
                  <input ref={resumeRef} id="ro-resume" type="file" accept="application/pdf,.pdf" onChange={onUploadResume} disabled={parsingResume} />
                  {form.resumeFileName ? (
                    <p style={{ marginTop: 8 }}>
                      <strong style={{ color: "var(--text)" }}>{form.resumeFileName}</strong><br />
                      {form.resume.length} characters extracted
                      <button onClick={clearResume} className="ro-btn ro-btn-red" style={{ marginLeft: 8, padding: "3px 8px", fontSize: "0.55rem" }}>Remove</button>
                    </p>
                  ) : (
                    <p>Text is extracted automatically and added to your email body. Max 5MB. Scanned image PDFs won't extract.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="ro-sec">
              <div className="ro-sec-lbl">Filters</div>
              <div className="ro-fg"><label className="ro-lbl">Location (e.g. NJ)</label><input className="ro-inp" value={form.location} onChange={e => setField("location", e.target.value)} placeholder="Livingston, NJ" /></div>
              <div className="ro-fg"><label className="ro-lbl">Keyword Search</label><input className="ro-inp" value={form.search} onChange={e => setField("search", e.target.value)} placeholder="constitutional, oncology, AI..." /></div>
              <div className="ro-fg">
                <label className="ro-lbl">Your Interests (for personalized matches)</label>
                <textarea className="ro-ta" rows={2} value={form.interests} onChange={e => setField("interests", e.target.value)} placeholder="e.g. constitutional law, voting behavior, media's role in politics" />
              </div>
            </div>

          </div>

          {/* CONTENT */}
          <div className="ro-content">
            <div className="ro-tabs">
              {(["discover", "queue", "sent", "log"] as const).map(t => (
                <div key={t} className={`ro-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                  {t === "queue"
                    ? <>Draft Queue <span className="ro-qbadge">{activeQueue.length}</span></>
                    : t === "sent"
                    ? <>Sent <span className="ro-qbadge">{qSent}</span></>
                    : t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>

            {tab === "discover" && (
              <div className="ro-panel">
                {!formReady && (
                  <div className="ro-notice">
                    <strong>Before generating drafts:</strong> Fill in your name, school, and email in the sidebar. Drafts use that info to personalize each message.
                  </div>
                )}
                {loading ? (
                  <div className="ro-empty"><span className="ro-empty-icon">⏳</span><div className="ro-empty-title">Loading contacts…</div></div>
                ) : filtered.length === 0 ? (
                  <div className="ro-empty">
                    <span className="ro-empty-icon">{CATS[cat].icon}</span>
                    <div className="ro-empty-title">No contacts match</div>
                    <div className="ro-empty-sub">Try a different field, clear your location filter, or upload more contacts via CSV.</div>
                  </div>
                ) : (
                  <>
                    <div className="ro-results-header">
                      <div className="ro-results-title">
                        {filtered.length} {personalized && canPersonalize ? "personalized match" : `${CATS[cat].name} contact`}{filtered.length === 1 ? "" : "s"}
                        {personalized && canPersonalize && <span style={{ marginLeft: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--green)", textTransform: "uppercase" }}>★ ranked by your resume</span>}
                      </div>
                      <div className="ro-btn-row">
                        <button
                          className={`ro-btn ${personalized ? "ro-btn-green" : "ro-btn-outline"}`}
                          onClick={() => {
                            if (!canPersonalize) {
                              addLog("Add your resume PDF and/or interests to enable personalized matches.", "warn");
                              return;
                            }
                            setPersonalized(p => !p);
                          }}
                          title={canPersonalize ? "Rank contacts by your resume + interests" : "Upload a resume or fill in interests first"}
                        >
                          {personalized ? "★ Personalized ON" : "★ Show Personalized Matches"}
                        </button>
                        <button className="ro-btn ro-btn-dark" onClick={addAllVisible} disabled={!formReady}>+ Add All to Queue</button>
                      </div>
                    </div>
                    <div className="ro-results-grid">
                      {filtered.map(r => {
                        const inQ = queue.some(q => q.email.toLowerCase() === r.email.toLowerCase());
                        return (
                          <div key={r.id} className={`ro-card${inQ ? " selected" : ""}`}>
                            <div className="ro-check" onClick={() => formReady && toggleSelect(r)}>{inQ ? "✓" : ""}</div>
                            <div className="ro-card-info">
                              <div className="ro-card-name">{r.name}</div>
                              <div className="ro-card-inst">
                                {r.title}{r.title && r.institution ? " · " : ""}{r.institution}
                              </div>
                              <div className="ro-card-email">{r.email}</div>
                              {r.field && <div className="ro-card-detail">{r.field}{r.location ? ` — ${r.location}` : ""}</div>}
                            </div>
                            <div className="ro-card-right">
                              <span className="ro-cat-tag">{r.category || "general"}</span>
                              {!inQ
                                ? <button className="ro-btn ro-btn-outline" style={{ padding: "5px 11px", fontSize: "0.62rem" }} onClick={() => addToQueue(r)} disabled={!formReady}>+ Queue</button>
                                : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--green)" }}>In queue</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "queue" && (
              <div className="ro-panel">
                <div className="ro-stats-row">
                  <div className="ro-stat-card"><span className="ro-stat-num">{queue.length}</span><span className="ro-stat-lbl">In Queue</span></div>
                  <div className="ro-stat-card s-green"><span className="ro-stat-num">{qDone}</span><span className="ro-stat-lbl">Drafted</span></div>
                  <div className="ro-stat-card s-orange"><span className="ro-stat-num">{qPending}</span><span className="ro-stat-lbl">Pending</span></div>
                </div>
                <div className="ro-btn-row" style={{ marginBottom: 18 }}>
                  <button className="ro-btn ro-btn-green" onClick={openAllDrafts} disabled={qPending === 0 || !formReady}>
                    ✉️ Open All in Gmail ({qPending})
                  </button>
                  <button className="ro-btn ro-btn-red" onClick={clearQueue}>Clear Queue</button>
                </div>
                <div className="ro-notice">
                  <strong>How drafts work:</strong> Click <em>Open in Gmail</em> to launch a new Gmail compose window with the recipient, subject, and personalized body pre-filled — make sure you're signed into the Gmail account you want to send from. Review and click Send (or close the tab to save as a draft).
                  <br /><br />
                  <strong>If Gmail says "refused to connect":</strong> you're viewing this app inside a preview frame. Open the published site in its own tab, or use the <em>Copy link</em> button and paste it into a fresh browser tab.
                </div>
                {queue.length === 0 ? (
                  <div className="ro-empty">
                    <span className="ro-empty-icon">📋</span>
                    <div className="ro-empty-title">Queue is empty</div>
                    <div className="ro-empty-sub">Browse the Discover tab and add contacts.</div>
                  </div>
                ) : (
                  <div className="ro-qlist">
                    {queue.map(c => (
                      <div key={c.qid} className={`ro-qcard st-${c.status}`}>
                        <div className="ro-qcard-info">
                          <div className="ro-qcard-name">{c.name} <span className="ro-cat-tag">{c.catKey}</span></div>
                          <div className="ro-qcard-email">{c.email}</div>
                        </div>
                        <button className="ro-mailto-btn" type="button" onClick={() => openGmailDraft(c)}>
                          Open in Gmail ↗
                        </button>
                        <button className="ro-mailto-btn" type="button" onClick={() => copyDraftURL(c)} style={{ background: "var(--surface2)", color: "var(--text)", borderColor: "var(--border)" }}>
                          Copy link
                        </button>
                        <span className="ro-qcard-status">{c.status === "done" ? "✓ drafted" : "— pending"}</span>
                        <button className="ro-qcard-remove" onClick={() => removeFromQueue(c.qid)} title="Remove">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "log" && (
              <div className="ro-panel">
                <div ref={logRef} style={{ background: "var(--text)", color: "#c8f064", borderRadius: 8, padding: "14px 18px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", lineHeight: 1.8, flex: 1, overflowY: "auto", maxHeight: 600 }}>
                  {logs.map((l, i) => {
                    const color = l.type === "err" ? "#f06464" : l.type === "ok" ? "#64f0a0" : l.type === "warn" ? "#f0c864" : "#c8f064";
                    return <div key={i} style={{ color }}>[{l.ts}] {l.msg}</div>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
