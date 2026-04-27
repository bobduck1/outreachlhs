import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ─── CREATOR ACCESS ───────────────────────────────────────────────────────────
// Change this passcode to whatever you want. Anyone who enters it gets the
// "creator" role in their browser (stored in localStorage) and can upload CSVs.
const CREATOR_PASSCODE = "akhil-reachout-2025";

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
  .ro-qcard-info { flex: 1; min-width: 200px; }
  .ro-qcard-name { font-weight: 600; font-size: 0.88rem; }
  .ro-qcard-email { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; color: var(--muted); margin-top: 2px; word-break: break-all; }
  .ro-qcard-status { font-family: 'IBM Plex Mono', monospace; font-size: 0.66rem; white-space: nowrap; }
  .st-pending .ro-qcard-status { color: var(--muted); }
  .st-done .ro-qcard-status { color: var(--green); }
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
  search: string;
};

type QueueItem = Contact & { qid: string; status: "pending" | "done"; catKey: string };

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

function buildBody(contact: Contact, catKey: string, info: FormState): string {
  const { name, school, grade, email, phone, location, resume } = info;
  const titleRaw = (contact.title || "").toLowerCase();
  let sal = "Mr.";
  if (titleRaw.includes("professor") || titleRaw.includes("prof")) sal = "Professor";
  else if (titleRaw.includes("dr") || titleRaw.includes("dean")) sal = "Dr.";
  else if (["polisci", "stem", "research"].includes(catKey)) sal = "Professor";
  const lastName = contact.name.split(" ").slice(-1)[0];

  const openers: Record<string, string> = {
    polisci:     `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a strong interest in ${contact.field || "political science and public policy"} and a long-term goal of attending law school.`,
    law:         `My name is ${name}, and I am a ${grade} at ${school} in ${location}. I am writing to ask if there is any possibility of briefly shadowing at ${contact.institution || "your office"}.`,
    stem:        `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a strong interest in ${contact.field || "scientific research"} and a long-term goal of pursuing research in college.`,
    premed:      `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a strong interest in medicine and a long-term goal of attending medical school.`,
    business:    `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a growing interest in ${contact.field || "business and finance"} and a long-term goal of studying business or economics in college.`,
    research:    `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a strong interest in public policy research and a long-term goal of pursuing political science and law in college.`,
    engineering: `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a strong interest in ${contact.field || "engineering"} and a long-term goal of studying engineering in college.`,
    nonprofit:   `My name is ${name}, and I am a ${grade} at ${school} in ${location}, with a strong interest in civic engagement and social impact.`,
  };

  const asks: Record<string, string> = {
    polisci:     `I am reaching out to ask if there is any way I could contribute to your research in a small, supporting capacity — literature review, data organization, or background research, whatever would be most helpful.`,
    law:         `I have a serious long-term interest in law school and am looking to get my first real exposure to legal practice before college. I am not seeking payment and would work entirely around your schedule.`,
    stem:        `I am reaching out to ask if there is any way I could contribute to your research in a supporting capacity — literature review, data organization, lab preparation, or any other tasks.`,
    premed:      `I am reaching out to ask if there is any possibility of briefly shadowing your practice, even for a day or two. I am not seeking payment and would work entirely around your schedule.`,
    business:    `I am reaching out to ask if there is any possibility of a brief shadowing experience or informational conversation about your work.`,
    research:    `I am reaching out to ask if there is any way I could contribute to your organization's research in a small, supporting capacity — background research, literature review, or any supporting tasks.`,
    engineering: `I am reaching out to ask if there is any possibility of briefly shadowing your work, or contributing to any ongoing projects in a small way.`,
    nonprofit:   `I am reaching out to ask if there is any opportunity to volunteer, shadow, or contribute to your organization's work in a small way.`,
  };

  const opener = openers[catKey] || openers.polisci;
  const ask = asks[catKey] || asks.polisci;
  const interest = contact.field
    ? `Your work on ${contact.field}${contact.institution ? ` at ${contact.institution}` : ""} aligns directly with what I hope to study and pursue.`
    : `I came across your work${contact.institution ? ` at ${contact.institution}` : ""} and found it genuinely compelling.`;

  const resumeLine = resume.trim()
    ? `\n\nA brief summary of my background:\n${resume.trim()}`
    : `\n\nI would be glad to share my resume at your convenience.`;

  return `Dear ${sal} ${lastName},\n\n${opener}\n\n${interest}\n\n${ask}${resumeLine}\n\nI understand this is an unusual request from a high school student, and I deeply appreciate any time you can spare. Even brief guidance about how to prepare for this kind of work would be meaningful to me.\n\nThank you very much for your consideration.\n\nSincerely,\n${name}\n${email} | ${phone}`;
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
  search: "",
};

export default function ReachOut() {
  const [cat, setCat] = useState<string>("all");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [tab, setTab] = useState<"discover" | "queue" | "log">("discover");
  const [baseContacts, setBaseContacts] = useState<Contact[]>([]);
  const [extraContacts, setExtraContacts] = useState<Contact[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<{ ts: string; msg: string; type: string }[]>([
    { ts: new Date().toLocaleTimeString(), msg: "ReachOut initialized.", type: "info" },
  ]);
  const logRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const addLog = useCallback((msg: string, type = "info") => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { ts, msg, type }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }, []);

  // Load saved form, extra contacts, queue
  useEffect(() => {
    try {
      const f = localStorage.getItem(STORAGE_KEYS.form);
      if (f) setForm({ ...DEFAULT_FORM, ...JSON.parse(f) });
      const e = localStorage.getItem(STORAGE_KEYS.extra);
      if (e) setExtraContacts(JSON.parse(e));
      const q = localStorage.getItem(STORAGE_KEYS.queue);
      if (q) setQueue(JSON.parse(q));
    } catch {}
  }, []);

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

  const filtered = useMemo(() => {
    const def = CATS[cat];
    let list = allContacts;
    if (cat !== "all") {
      list = list.filter(c => def.matches.some(m => c.category.toLowerCase().includes(m)));
    }
    const loc = form.location.trim().toLowerCase();
    if (loc) {
      // soft location filter — keep matches but rank them; for now filter only if state code is given
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
    return list;
  }, [allContacts, cat, form.location, form.search]);

  // Queue helpers
  function addToQueue(contact: Contact) {
    if (queue.some(q => q.email.toLowerCase() === contact.email.toLowerCase())) return;
    const catKey = categoryKeyForContact(contact);
    setQueue(q => [...q, { ...contact, status: "pending", qid: `${Date.now()}-${Math.random()}`, catKey }]);
    addLog(`Queued: ${contact.name} <${contact.email}>`, "ok");
  }
  function toggleSelect(c: Contact) {
    if (queue.some(q => q.email.toLowerCase() === c.email.toLowerCase())) {
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
    if (!confirm("Clear the entire queue?")) return;
    setQueue([]);
    addLog("Queue cleared.", "warn");
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
    window.open(gmailComposeURL(contact), "_blank", "noopener,noreferrer");
    setQueue(q => q.map(x => x.qid === contact.qid ? { ...x, status: "done" } : x));
    addLog(`Opened Gmail draft for ${contact.name}`, "ok");
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

  const qDone = queue.filter(c => c.status === "done").length;
  const qPending = queue.filter(c => c.status === "pending").length;
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
            <div className="ro-hstat"><span className="ro-hstat-num">{queue.length}</span><span className="ro-hstat-lbl">Queued</span></div>
            <div className="ro-hstat"><span className="ro-hstat-num">{qDone}</span><span className="ro-hstat-lbl">Drafted</span></div>
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
              <div className="ro-fg"><label className="ro-lbl">Resume Summary (optional)</label><textarea className="ro-inp" rows={4} value={form.resume} onChange={e => setField("resume", e.target.value)} placeholder="Paste a 3-5 line summary of your resume / key experiences. This will be included in the email." style={{ resize: "vertical", minHeight: 80, lineHeight: 1.5 }} /></div>
            </div>

            <div className="ro-sec">
              <div className="ro-sec-lbl">Filters</div>
              <div className="ro-fg"><label className="ro-lbl">Location (e.g. NJ)</label><input className="ro-inp" value={form.location} onChange={e => setField("location", e.target.value)} placeholder="Livingston, NJ" /></div>
              <div className="ro-fg"><label className="ro-lbl">Keyword Search</label><input className="ro-inp" value={form.search} onChange={e => setField("search", e.target.value)} placeholder="constitutional, oncology, AI..." /></div>
            </div>

            <div className="ro-sec">
              <div className="ro-sec-lbl">Add Contacts</div>
              <div className="ro-upload">
                <label htmlFor="ro-csv">📤 Upload CSV</label>
                <input ref={fileRef} id="ro-csv" type="file" accept=".csv,text/csv" onChange={onUploadCSV} />
                <p>Required columns: <code>name, email</code>. Optional: <code>field, institution, title, category, location</code>.</p>
              </div>
              {extraContacts.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  <span>{extraContacts.length} uploaded</span>
                  <button className="ro-btn ro-btn-red" style={{ padding: "5px 10px", fontSize: "0.6rem" }} onClick={clearExtras}>Clear</button>
                </div>
              )}
            </div>
          </div>

          {/* CONTENT */}
          <div className="ro-content">
            <div className="ro-tabs">
              {(["discover", "queue", "log"] as const).map(t => (
                <div key={t} className={`ro-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                  {t === "queue" ? <>Draft Queue <span className="ro-qbadge">{queue.length}</span></> : t.charAt(0).toUpperCase() + t.slice(1)}
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
                      <div className="ro-results-title">{filtered.length} {CATS[cat].name} contact{filtered.length === 1 ? "" : "s"}</div>
                      <button className="ro-btn ro-btn-dark" onClick={addAllVisible} disabled={!formReady}>+ Add All to Queue</button>
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
                  <strong>How drafts work:</strong> Clicking <em>Open in Gmail</em> opens a new Gmail compose window in your browser with the recipient, subject, and full personalized body pre-filled. Make sure you're signed into the Gmail account you want to send from. Review and click Send — or close to save as a draft.
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
                        <a className="ro-mailto-btn" href={gmailComposeURL(c)} target="_blank" rel="noopener noreferrer" onClick={() => setQueue(q => q.map(x => x.qid === c.qid ? { ...x, status: "done" } : x))}>
                          Open in Gmail ↗
                        </a>
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
