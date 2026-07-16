import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getProfile,
  saveProfile,
  listMyActivity,
  recordSent,
  unrecordSent,
  searchContacts,
  type ContactRow,
} from "@/lib/reachout.functions";

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
  .ro-header { background: var(--text); color: var(--bg); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 20px; flex-wrap: wrap; }
  .ro-logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.5rem; letter-spacing: -1px; }
  .ro-logo span { color: #c8f064; }
  .ro-sub { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; color: rgba(245,240,232,0.45); letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .ro-hstats { display: flex; gap: 20px; align-items: center; }
  .ro-hstat { text-align: right; font-family: 'IBM Plex Mono', monospace; }
  .ro-hstat-num { font-size: 1.3rem; font-weight: 500; color: #c8f064; display: block; line-height: 1; }
  .ro-hstat-lbl { font-size: 0.58rem; color: rgba(245,240,232,0.4); text-transform: uppercase; letter-spacing: 1px; }
  .ro-user { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; color: rgba(245,240,232,0.7); }
  .ro-signout { background: transparent; border: 1px solid rgba(245,240,232,0.3); color: rgba(245,240,232,0.8); padding: 5px 10px; border-radius: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; }
  .ro-signout:hover { background: rgba(245,240,232,0.1); }
  .ro-main { display: grid; grid-template-columns: 340px 1fr; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .ro-main { grid-template-columns: 1fr; } }
  .ro-sidebar { background: var(--surface); border-right: 2px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; }
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
type SubCat = { key: string; name: string; searchTerm: string };
type MainCat = { icon: string; name: string; subs: SubCat[] };

const CATS: Record<string, MainCat> = {
  stem: {
    icon: "🔬",
    name: "STEM",
    subs: [
      { key: "biology",       name: "Biology",              searchTerm: "biology" },
      { key: "biochem",       name: "Biochemistry",         searchTerm: "biochemistry" },
      { key: "chemistry",     name: "Chemistry",            searchTerm: "chemistry" },
      { key: "physics",       name: "Physics",              searchTerm: "physics" },
      { key: "cs",            name: "Computer Science",     searchTerm: "computer science" },
      { key: "mech-eng",      name: "Mechanical Engineering", searchTerm: "mechanical engineering" },
      { key: "elec-eng",      name: "Electrical Engineering", searchTerm: "electrical engineering" },
      { key: "civil-eng",     name: "Civil Engineering",    searchTerm: "civil engineering" },
      { key: "bio-eng",       name: "Biomedical Engineering", searchTerm: "biomedical engineering" },
      { key: "environmental", name: "Environmental Science", searchTerm: "environmental science" },
      { key: "neuro",         name: "Neuroscience",         searchTerm: "neuroscience" },
      { key: "math",          name: "Mathematics",          searchTerm: "mathematics" },
      { key: "stats",         name: "Statistics / Data Sci", searchTerm: "statistics or data science" },
      { key: "premed",        name: "Pre-Med / Medical Research", searchTerm: "medical school faculty doing clinical or biomedical research" },
    ],
  },
  business: {
    icon: "💼",
    name: "Business",
    subs: [
      { key: "finance",        name: "Finance",           searchTerm: "finance" },
      { key: "economics",      name: "Economics",         searchTerm: "economics" },
      { key: "marketing",      name: "Marketing",         searchTerm: "marketing" },
      { key: "management",     name: "Management",        searchTerm: "management" },
      { key: "entrepreneur",   name: "Entrepreneurship",  searchTerm: "entrepreneurship" },
      { key: "accounting",     name: "Accounting",        searchTerm: "accounting" },
      { key: "operations",     name: "Operations / Supply Chain", searchTerm: "operations management or supply chain" },
    ],
  },
  humanities: {
    icon: "🏛️",
    name: "Humanities",
    subs: [
      { key: "polisci",     name: "Political Science", searchTerm: "political science" },
      { key: "history",     name: "History",           searchTerm: "history" },
      { key: "philosophy",  name: "Philosophy",        searchTerm: "philosophy" },
      { key: "english",     name: "English / Literature", searchTerm: "english literature" },
      { key: "sociology",   name: "Sociology",         searchTerm: "sociology" },
      { key: "psychology",  name: "Psychology",        searchTerm: "psychology" },
      { key: "anthropology", name: "Anthropology",     searchTerm: "anthropology" },
      { key: "law",         name: "Law / Legal Studies", searchTerm: "law or legal studies (law school professors)" },
      { key: "linguistics", name: "Linguistics",       searchTerm: "linguistics" },
      { key: "religion",    name: "Religious Studies", searchTerm: "religious studies" },
    ],
  },
};

const SUB_LOOKUP: Record<string, { mainKey: string; sub: SubCat }> = {};
for (const [mk, m] of Object.entries(CATS)) for (const s of m.subs) SUB_LOOKUP[s.key] = { mainKey: mk, sub: s };

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Contact = ContactRow;

type FormState = {
  name: string;
  school: string;
  grade: string;
  email: string;      // student's own email (from auth)
  phone: string;
  location: string;
  resume: string;
  resumeFileName: string;
  interests: string;
};

type QueueItem = Contact & { qid: string; status: "pending" | "done" | "sent"; catKey: string; sentAt?: string };

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────
function buildSubject(contact: Contact, subKey: string): string {
  const sub = SUB_LOOKUP[subKey]?.sub;
  const fieldName = sub?.name || contact.field || "your field";
  return `High School Student Seeking Research Opportunity in ${fieldName}`;
}

function buildBody(contact: Contact, subKey: string, info: FormState): string {
  const { name, school, grade, email, phone, location, resume, interests } = info;
  const titleRaw = (contact.title || "").toLowerCase();

  let sal = "Professor";
  if (titleRaw.includes("dr") && !titleRaw.includes("professor") && !titleRaw.includes("prof")) sal = "Dr.";
  const lastName = contact.name.split(" ").slice(-1)[0];

  const sub = SUB_LOOKUP[subKey]?.sub;
  const fieldPhrase = contact.field || sub?.name || "your area of work";
  const studentInterest = interests.trim() || fieldPhrase;

  // Research-assist ask for EVERYONE — no shadowing.
  const ask = `I am reaching out to ask if there is any way I could contribute to your research in a small, supporting capacity. I am willing to assist with background research, literature review, data organization, or any supporting tasks — whatever would be most helpful.`;

  const profileLine = contact.title && contact.institution
    ? `I came across your profile at ${contact.institution} as ${contact.title}, and I was drawn to the department's strong emphasis on ${fieldPhrase}.`
    : contact.institution
    ? `I came across your work at ${contact.institution}, and I was drawn to its strong emphasis on ${fieldPhrase}.`
    : `I came across your work in ${fieldPhrase}, and I was drawn to your focus in this area.`;

  const hook = contact.research_hook?.trim();
  const hookLine = hook
    ? ` I was especially interested in your work on ${hook.replace(/\.$/, "")}, which struck me as exactly the kind of question I would love to think more carefully about.`
    : "";

  const connector = `The intersection of ${studentInterest}, which sits at the heart of how we understand the world around us, is something I think about constantly as a high school student navigating an overwhelming information environment.`;

  const resumeAttachLine = resume.trim() ? ` I have attached my resume for your reference.` : ``;

  const opener = `My name is ${name}, and I am a ${grade || "high school student"}${school ? ` at ${school}` : ""}${location ? ` in ${location}` : ""}, with a strong interest in ${studentInterest}.`;

  const body = [
    `Dear ${sal} ${lastName},`,
    opener,
    `${profileLine}${hookLine} ${connector}`,
    `${ask}${resumeAttachLine}`,
    `I understand this is an unusual request coming from a high school student, and I deeply appreciate any time you can spare. Even brief guidance about how to prepare for this kind of work would be meaningful to me.`,
    `Thank you very much for your consideration.`,
    `Sincerely,`,
    `${name}`,
    `${email}${phone ? ` | ${phone}` : ""}`,
  ].join("\n\n");

  return resume.trim() ? `${body}\n\n[Reminder to ${name}: attach your resume PDF in Gmail before sending.]` : body;
}


// ─── COMPONENT ────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  queue: "reachout.queue.v2",
  resume: "reachout.resume.v2",
};

const DEFAULT_FORM: FormState = {
  name: "", school: "", grade: "sophomore", email: "", phone: "",
  location: "", resume: "", resumeFileName: "", interests: "",
};

export default function ReachOut() {
  const { user } = useAuth();
  const [mainCat, setMainCat] = useState<string>("humanities");
  const [cat, setCat] = useState<string>("polisci"); // subcategory key
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [tab, setTab] = useState<"discover" | "queue" | "sent" | "log">("discover");
  const [results, setResults] = useState<Contact[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [lastSearchInfo, setLastSearchInfo] = useState<{ cat: string; cooldownCount: number } | null>(null);
  const [logs, setLogs] = useState<{ ts: string; msg: string; type: string }[]>([
    { ts: new Date().toLocaleTimeString(), msg: "ReachOut initialized.", type: "info" },
  ]);
  const logRef = useRef<HTMLDivElement | null>(null);
  const resumeRef = useRef<HTMLInputElement | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const addLog = useCallback((msg: string, type = "info") => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { ts, msg, type }]);
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 50);
  }, []);

  // Load queue + resume from localStorage (queue is UI state; sent history is DB)
  useEffect(() => {
    try {
      const q = localStorage.getItem(STORAGE_KEYS.queue);
      if (q) setQueue(JSON.parse(q));
      const r = localStorage.getItem(STORAGE_KEYS.resume);
      if (r) {
        const parsed = JSON.parse(r);
        setForm(f => ({ ...f, resume: parsed.resume || "", resumeFileName: parsed.resumeFileName || "" }));
      }
    } catch {}
  }, []);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue)); } catch {} }, [queue]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.resume, JSON.stringify({ resume: form.resume, resumeFileName: form.resumeFileName })); } catch {}
  }, [form.resume, form.resumeFileName]);

  // Load profile + activity from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = await getProfile();
        if (p) {
          setForm(f => ({
            ...f,
            name: p.name || "",
            school: p.school || "",
            grade: p.grade || "sophomore",
            phone: p.phone || "",
            location: p.location || "",
            interests: p.interests || "",
            email: user.email || "",
          }));
        } else {
          setForm(f => ({ ...f, email: user.email || "" }));
        }
        const acts = await listMyActivity();
        setSentEmails(new Set(acts.map((a: any) => a.contact_email.toLowerCase())));
        addLog(`Signed in as ${user.email}. Loaded ${acts.length} sent record(s).`, "ok");
      } catch (e: any) {
        addLog(`Failed to load profile: ${e.message}`, "err");
      }
    })();
  }, [user, addLog]);

  // Debounced profile save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSavingProfile(true);
      try {
        await saveProfile({ data: {
          name: form.name, school: form.school, grade: form.grade,
          phone: form.phone, location: form.location, interests: form.interests,
        }});
      } catch {}
      setSavingProfile(false);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [form.name, form.school, form.grade, form.phone, form.location, form.interests, user]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  // ── RESUME PDF EXTRACTION ─────────────────────────────────────────────────
  async function onUploadResume(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { addLog("Resume must be under 5MB.", "err"); e.target.value = ""; return; }
    setParsingResume(true);
    addLog(`Reading ${file.name}…`, "info");
    try {
      const buf = await file.arrayBuffer();
      const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ") + "\n";
      }
      const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
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

  // ── AI SEARCH ─────────────────────────────────────────────────────────────
  async function runSearch() {
    if (!user) return;
    const lookup = SUB_LOOKUP[cat];
    if (!lookup) { addLog("Pick a subcategory first.", "warn"); return; }
    setSearching(true);
    addLog(`Searching for ${lookup.sub.name} professors…`, "info");
    try {
      const res = await searchContacts({ data: {
        field: lookup.sub.searchTerm,
        category: CATS[lookup.mainKey].name,
        location: form.location,
        interests: form.interests,
        count: 10,
      }});
      setResults(res.contacts);
      setLastSearchInfo({ cat, cooldownCount: res.cooldownCount });
      addLog(`Found ${res.contacts.length} professor(s)${res.cooldownCount ? ` (${res.cooldownCount} hidden — currently claimed by other students)` : ""}.`, res.contacts.length ? "ok" : "warn");
    } catch (e: any) {
      addLog(`Search failed: ${e.message}`, "err");
    } finally {
      setSearching(false);
    }
  }

  // Filter out already-sent contacts from results
  const visibleResults = useMemo(() => {
    return results.filter(c => !sentEmails.has(c.email.toLowerCase()));
  }, [results, sentEmails]);

  // Queue helpers
  function addToQueue(contact: Contact) {
    if (queue.some(q => q.email.toLowerCase() === contact.email.toLowerCase())) return;
    setQueue(q => [...q, { ...contact, status: "pending", qid: `${Date.now()}-${Math.random()}`, catKey: cat }]);
    addLog(`Queued: ${contact.name}`, "ok");
  }
  function toggleSelect(c: Contact) {
    const existing = queue.find(q => q.email.toLowerCase() === c.email.toLowerCase());
    if (existing) {
      if (existing.status === "sent") return;
      setQueue(q => q.filter(x => x.email.toLowerCase() !== c.email.toLowerCase()));
      addLog(`Removed: ${c.name}`, "warn");
    } else {
      addToQueue(c);
    }
  }
  function addAllVisible() {
    const toAdd = visibleResults.filter(r => !queue.some(q => q.email.toLowerCase() === r.email.toLowerCase()));
    if (!toAdd.length) return;
    setQueue(q => [
      ...q,
      ...toAdd.map(r => ({ ...r, status: "pending" as const, qid: `${Date.now()}-${Math.random()}-${r.id}`, catKey: cat })),
    ]);
    addLog(`Added ${toAdd.length} to queue.`, "ok");
  }
  function removeFromQueue(qid: string) {
    setQueue(q => q.filter(x => x.qid !== qid));
  }
  function clearQueue() {
    if (!queue.length) return;
    if (!confirm("Clear the entire queue?")) return;
    setQueue(q => q.filter(x => x.status === "sent"));
  }

  async function markSent(qid: string) {
    const c = queue.find(x => x.qid === qid);
    if (!c) return;
    try {
      await recordSent({ data: c.email });
      setSentEmails(s => new Set([...s, c.email.toLowerCase()]));
      setQueue(q => q.map(x => x.qid === qid ? { ...x, status: "sent", sentAt: new Date().toISOString() } : x));
      addLog(`Marked sent: ${c.name}`, "ok");
    } catch (e: any) {
      addLog(`Failed to record: ${e.message}`, "err");
    }
  }
  async function unmarkSent(qid: string) {
    const c = queue.find(x => x.qid === qid);
    if (!c) return;
    try {
      await unrecordSent({ data: c.email });
      setSentEmails(s => { const n = new Set(s); n.delete(c.email.toLowerCase()); return n; });
      setQueue(q => q.map(x => x.qid === qid ? { ...x, status: "pending", sentAt: undefined } : x));
      addLog(`Re-opened: ${c.name}`, "warn");
    } catch (e: any) {
      addLog(`Failed: ${e.message}`, "err");
    }
  }
  async function markAllSent() {
    const toMark = queue.filter(c => c.status !== "sent");
    if (!toMark.length) return;
    if (!confirm(`Mark all ${toMark.length} queued contact(s) as sent?`)) return;
    let ok = 0;
    for (const c of toMark) {
      try { await recordSent({ data: c.email }); ok++; } catch {}
    }
    setSentEmails(s => new Set([...s, ...toMark.map(c => c.email.toLowerCase())]));
    const now = new Date().toISOString();
    setQueue(q => q.map(x => x.status === "sent" ? x : { ...x, status: "sent", sentAt: now }));
    addLog(`Marked ${ok} contact(s) as sent.`, "ok");
  }

  function gmailComposeURL(contact: QueueItem): string {
    const subject = buildSubject(contact, contact.catKey);
    const body = buildBody(contact, contact.catKey, form);
    const params = new URLSearchParams({ view: "cm", fs: "1", to: contact.email, su: subject, body });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }
  function openGmailDraft(contact: QueueItem) {
    const url = gmailComposeURL(contact);
    const target = (window.top || window);
    const win = target.open(url, "_blank", "noopener,noreferrer");
    if (!win) { addLog(`Popup blocked for ${contact.name}. Use Copy link.`, "err"); return; }
    setQueue(q => q.map(x => x.qid === contact.qid ? { ...x, status: "done" } : x));
    addLog(`Opened Gmail draft for ${contact.name}`, "ok");
  }
  async function copyDraftURL(contact: QueueItem) {
    try { await navigator.clipboard.writeText(gmailComposeURL(contact)); addLog(`Copied Gmail link for ${contact.name}.`, "ok"); }
    catch { addLog("Could not copy.", "err"); }
  }
  function openAllDrafts() {
    const pending = queue.filter(c => c.status === "pending");
    if (!pending.length) return;
    if (!confirm(`Open ${pending.length} Gmail draft(s) in new tabs?`)) return;
    pending.forEach((c, i) => setTimeout(() => openGmailDraft(c), i * 500));
  }

  async function signOut() {
    await supabase.auth.signOut();
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
            <div className="ro-hstat"><span className="ro-hstat-num">{activeQueue.length}</span><span className="ro-hstat-lbl">Queued</span></div>
            <div className="ro-hstat"><span className="ro-hstat-num">{sentEmails.size}</span><span className="ro-hstat-lbl">Sent</span></div>
            <div className="ro-user">{user?.email}</div>
            <button className="ro-signout" onClick={signOut}>Sign out</button>
          </div>
        </div>

        <div className="ro-main">
          {/* SIDEBAR */}
          <div className="ro-sidebar">
            <div className="ro-sec">
              <div className="ro-sec-lbl">Area</div>
              <div className="ro-cat-grid">
                {Object.entries(CATS).map(([k, v]) => (
                  <button
                    key={k}
                    className={`ro-cat-btn${mainCat === k ? " active" : ""}`}
                    onClick={() => {
                      setMainCat(k);
                      setCat(v.subs[0].key);
                    }}
                  >
                    <span className="ro-cat-icon">{v.icon}</span>
                    <span className="ro-cat-name">{v.name}</span>
                  </button>
                ))}
              </div>
              <div className="ro-fg" style={{ marginTop: 14 }}>
                <label className="ro-lbl">Subfield</label>
                <select className="ro-sel" value={cat} onChange={e => setCat(e.target.value)}>
                  {CATS[mainCat].subs.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                </select>
              </div>
            </div>


            <div className="ro-sec">
              <div className="ro-sec-lbl">Your Info {savingProfile && <span style={{ fontSize: "0.55rem", color: "var(--muted)", marginLeft: "auto" }}>saving…</span>}</div>
              <div className="ro-fg"><label className="ro-lbl">Your Name *</label><input className="ro-inp" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Jane Doe" /></div>
              <div className="ro-fg"><label className="ro-lbl">Your School *</label><input className="ro-inp" value={form.school} onChange={e => setField("school", e.target.value)} placeholder="Livingston High School" /></div>
              <div className="ro-row2">
                <div className="ro-fg">
                  <label className="ro-lbl">Grade</label>
                  <select className="ro-sel" value={form.grade} onChange={e => setField("grade", e.target.value)}>
                    <option>freshman</option><option>sophomore</option><option>junior</option><option>senior</option>
                  </select>
                </div>
                <div className="ro-fg"><label className="ro-lbl">Your Phone</label><input className="ro-inp" value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="(555) 555-5555" /></div>
              </div>
              <div className="ro-fg">
                <label className="ro-lbl">Resume (PDF)</label>
                <div className="ro-upload">
                  <label htmlFor="ro-resume">{parsingResume ? "⏳ Reading…" : (form.resumeFileName ? "🔄 Replace PDF" : "📄 Upload Resume PDF")}</label>
                  <input ref={resumeRef} id="ro-resume" type="file" accept="application/pdf,.pdf" onChange={onUploadResume} disabled={parsingResume} />
                  {form.resumeFileName ? (
                    <p style={{ marginTop: 8 }}>
                      <strong style={{ color: "var(--text)" }}>{form.resumeFileName}</strong>
                      <button onClick={clearResume} className="ro-btn ro-btn-red" style={{ marginLeft: 8, padding: "3px 8px", fontSize: "0.55rem" }}>Remove</button>
                    </p>
                  ) : (
                    <p>If added, your email will include a line noting the attachment. Max 5MB.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="ro-sec">
              <div className="ro-sec-lbl">Search</div>
              <div className="ro-fg"><label className="ro-lbl">Location (e.g. Livingston, NJ)</label><input className="ro-inp" value={form.location} onChange={e => setField("location", e.target.value)} placeholder="Livingston, NJ" /></div>
              <div className="ro-fg">
                <label className="ro-lbl">Your Interests (helps personalize search)</label>
                <textarea className="ro-ta" rows={3} value={form.interests} onChange={e => setField("interests", e.target.value)} placeholder="e.g. constitutional law, voting behavior, media's role in politics" />
              </div>
              <button className="ro-btn ro-btn-dark ro-btn-full" onClick={runSearch} disabled={searching || !user}>
                {searching ? "🔍 Searching…" : `🔍 Find ${SUB_LOOKUP[cat]?.sub.name || "matching"} Contacts`}
              </button>
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
                    ? <>Sent <span className="ro-qbadge">{sentEmails.size}</span></>
                    : t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>

            {tab === "discover" && (
              <div className="ro-panel">
                {!formReady && (
                  <div className="ro-notice">
                    <strong>Before generating drafts:</strong> Fill in your name and school in the sidebar. Your email uses that info.
                  </div>
                )}
                {searching ? (
                  <div className="ro-empty"><span className="ro-empty-icon">🔍</span><div className="ro-empty-title">Searching…</div><div className="ro-empty-sub">Finding verified professors in {SUB_LOOKUP[cat]?.sub.name || cat}.</div></div>
                ) : results.length === 0 ? (
                  <div className="ro-empty">
                    <span className="ro-empty-icon">{CATS[mainCat].icon}</span>
                    <div className="ro-empty-title">Ready to search</div>
                    <div className="ro-empty-sub">Pick a subfield, add your interests & location, then click <strong>Find Professors</strong>. AI only returns emails it's 100% confident about.</div>
                  </div>
                ) : visibleResults.length === 0 ? (
                  <div className="ro-empty">
                    <span className="ro-empty-icon">✉️</span>
                    <div className="ro-empty-title">All results already emailed</div>
                    <div className="ro-empty-sub">Click Find Professors again to search for more.</div>
                  </div>
                ) : (
                  <>
                    <div className="ro-notice" style={{ background: "rgba(255,180,50,0.08)", borderColor: "rgba(255,180,50,0.35)" }}>
                      <strong>📅 Send timing:</strong> Schedule these emails for weekday mornings between 8&nbsp;AM and 12&nbsp;PM in the professor's local time. <strong>Never send on weekends</strong> — response rates drop sharply.
                    </div>
                    <div className="ro-results-header">
                      <div className="ro-results-title">
                        {visibleResults.length} {SUB_LOOKUP[lastSearchInfo?.cat || cat]?.sub.name || "matching"} professor{visibleResults.length === 1 ? "" : "s"}
                        {lastSearchInfo && lastSearchInfo.cooldownCount > 0 && (
                          <span style={{ marginLeft: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--orange)", textTransform: "uppercase" }}>
                            {lastSearchInfo.cooldownCount} on cooldown
                          </span>
                        )}
                      </div>
                      <div className="ro-btn-row">
                        <button className="ro-btn ro-btn-outline" onClick={runSearch} disabled={searching}>🔄 Search Again</button>
                        <button className="ro-btn ro-btn-dark" onClick={addAllVisible} disabled={!formReady}>+ Add All to Queue</button>
                      </div>
                    </div>
                    {(["high", "medium", "low"] as const).map(tier => {
                      const tierResults = visibleResults.filter(r => (r.tier || "medium") === tier);
                      if (!tierResults.length) return null;
                      const meta = tier === "high"
                        ? { label: "Higher chance", color: "var(--green)", note: "Smaller / regional schools, junior faculty" }
                        : tier === "medium"
                        ? { label: "Medium chance", color: "var(--orange)", note: "Mid-tier universities" }
                        : { label: "Lower chance", color: "var(--red, #b23a3a)", note: "Top-ranked / very selective schools" };
                      return (
                        <div key={tier} style={{ marginTop: 18 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: meta.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {meta.label} · {tierResults.length}
                            </span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "var(--muted)" }}>{meta.note}</span>
                          </div>
                          <div className="ro-results-grid">
                            {tierResults.map(r => {
                              const existing = queue.find(q => q.email.toLowerCase() === r.email.toLowerCase());
                              const inQ = !!existing && existing.status !== "sent";
                              return (
                                <div key={r.id} className={`ro-card${inQ ? " selected" : ""}`}>
                                  <div className="ro-check" onClick={() => formReady && toggleSelect(r)}>{inQ ? "✓" : ""}</div>
                                  <div className="ro-card-info">
                                    <div className="ro-card-name">{r.name}</div>
                                    <div className="ro-card-inst">{r.title}{r.title && r.institution ? " · " : ""}{r.institution}</div>
                                    <div className="ro-card-email">{r.email}</div>
                                    {r.field && <div className="ro-card-detail">{r.field}{r.location ? ` — ${r.location}` : ""}</div>}
                                  </div>
                                  <div className="ro-card-right">
                                    <span className="ro-cat-tag" style={{ borderColor: meta.color, color: meta.color }}>{meta.label}</span>
                                    {!inQ
                                      ? <button className="ro-btn ro-btn-outline" style={{ padding: "5px 11px", fontSize: "0.62rem" }} onClick={() => addToQueue(r)} disabled={!formReady}>+ Queue</button>
                                      : <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--green)" }}>In queue</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}


            {tab === "queue" && (
              <div className="ro-panel">
                <div className="ro-stats-row">
                  <div className="ro-stat-card"><span className="ro-stat-num">{activeQueue.length}</span><span className="ro-stat-lbl">In Queue</span></div>
                  <div className="ro-stat-card s-green"><span className="ro-stat-num">{qDone}</span><span className="ro-stat-lbl">Drafted</span></div>
                  <div className="ro-stat-card s-orange"><span className="ro-stat-num">{qPending}</span><span className="ro-stat-lbl">Pending</span></div>
                </div>
                <div className="ro-btn-row" style={{ marginBottom: 18 }}>
                  <button className="ro-btn ro-btn-green" onClick={openAllDrafts} disabled={qPending === 0 || !formReady}>
                    ✉️ Open All in Gmail ({qPending})
                  </button>
                  <button className="ro-btn ro-btn-dark" onClick={markAllSent} disabled={activeQueue.length === 0}>
                    ✓ Mark All as Sent ({activeQueue.length})
                  </button>
                  <button className="ro-btn ro-btn-red" onClick={clearQueue}>Clear Queue</button>
                </div>
                <div className="ro-notice">
                  <strong>How it works:</strong> Click <em>Open in Gmail</em> to launch a pre-filled draft. After you send it, click the <strong>○</strong> to mark them as sent — they'll be hidden from future searches. If 2+ students email the same contact, they're hidden globally for 30 days.
                </div>
                {activeQueue.length === 0 ? (
                  <div className="ro-empty">
                    <span className="ro-empty-icon">📋</span>
                    <div className="ro-empty-title">Queue is empty</div>
                    <div className="ro-empty-sub">Search Discover and add contacts.</div>
                  </div>
                ) : (
                  <div className="ro-qlist">
                    {activeQueue.map(c => (
                      <div key={c.qid} className={`ro-qcard st-${c.status}`}>
                        <button type="button" className="ro-sent-check" onClick={() => markSent(c.qid)} title="Mark as sent">○</button>
                        <div className="ro-qcard-info">
                          <div className="ro-qcard-name">{c.name} <span className="ro-cat-tag">{c.catKey}</span></div>
                          <div className="ro-qcard-email">{c.email}</div>
                        </div>
                        <button className="ro-mailto-btn" type="button" onClick={() => openGmailDraft(c)}>Open in Gmail ↗</button>
                        <button className="ro-mailto-btn" type="button" onClick={() => copyDraftURL(c)} style={{ background: "var(--surface2)", color: "var(--text)", borderColor: "var(--border)" }}>Copy link</button>
                        <span className="ro-qcard-status">{c.status === "done" ? "✓ drafted" : "— pending"}</span>
                        <button className="ro-qcard-remove" onClick={() => removeFromQueue(c.qid)} title="Remove">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "sent" && (
              <div className="ro-panel">
                <div className="ro-stats-row">
                  <div className="ro-stat-card s-green"><span className="ro-stat-num">{sentEmails.size}</span><span className="ro-stat-lbl">Already Emailed</span></div>
                </div>
                <div className="ro-notice">
                  These contacts are hidden from future searches. They stay in your account so you never re-email the same person. If 2 students email the same contact, they're hidden from other students for 30 days.
                </div>
                {sentQueue.length === 0 ? (
                  <div className="ro-empty">
                    <span className="ro-empty-icon">✉️</span>
                    <div className="ro-empty-title">No emails marked sent yet</div>
                    <div className="ro-empty-sub">Mark contacts as sent from the Draft Queue.</div>
                  </div>
                ) : (
                  <div className="ro-qlist">
                    {sentQueue.map(c => (
                      <div key={c.qid} className="ro-qcard st-sent">
                        <button type="button" className="ro-sent-check checked" onClick={() => unmarkSent(c.qid)} title="Un-mark sent">✓</button>
                        <div className="ro-qcard-info">
                          <div className="ro-qcard-name">{c.name} <span className="ro-cat-tag">{c.catKey}</span></div>
                          <div className="ro-qcard-email">{c.email}</div>
                        </div>
                        <span className="ro-qcard-status">✓ sent{c.sentAt ? ` · ${new Date(c.sentAt).toLocaleDateString()}` : ""}</span>
                        <button className="ro-qcard-remove" onClick={() => removeFromQueue(c.qid)} title="Remove from queue view">×</button>
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
