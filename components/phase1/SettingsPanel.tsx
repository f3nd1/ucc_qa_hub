import { useState } from "react";
import type { ReactNode } from "react";
import type { Settings } from "@/lib/qmr-engine";
import { erpApiList } from "@/lib/qmr-engine";
import { supabaseTest } from "@/lib/store/supabaseSync";
import { chatModels, fetchOpenAIModels } from "@/lib/integrations/openai";
import { requestDriveToken } from "@/lib/integrations/googleDrive";

const labelStyle: React.CSSProperties = { display: "block", fontWeight: 500, fontSize: 11.5, color: "var(--navy)", marginBottom: 3 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "6px 7px",
  fontSize: 12.5,
  background: "#fff",
  fontFamily: "inherit",
};
const hint: React.CSSProperties = { fontSize: 11.5, color: "var(--muted)", marginTop: 3 };
const testBtn: React.CSSProperties = {
  border: "1px solid var(--navy)",
  background: "#fff",
  color: "var(--navy)",
  borderRadius: 4,
  padding: "5px 10px",
  fontSize: 11.5,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

type TestKey = "openai" | "erp" | "supabase" | "google";
type Status = { ok: boolean; msg: string };

function Section({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <div style={{ borderTop: first ? "none" : "1px solid var(--border-light)", paddingTop: first ? 0 : 14, marginTop: first ? 0 : 16 }}>
      <h4 style={{ color: "var(--navy)", fontSize: 12.5, margin: "0 0 10px" }}>{title}</h4>
      {children}
    </div>
  );
}

function StatusLine({ s }: { s?: Status }) {
  if (!s) return null;
  return (
    <div style={{ fontSize: 11.5, marginTop: 5, color: s.ok ? "var(--ok)" : "var(--err)" }}>
      {s.ok ? "✓ " : "✕ "}
      {s.msg}
    </div>
  );
}

/** Grouped, sectioned settings with per-integration connection tests and an
    OpenAI model picker. Used both as a flat page and as a 3D-office window. */
export function SettingsPanel({ settings, onSave }: { settings: Settings; onSave: (patch: Settings) => void; onClose?: () => void }) {
  const [key, setKey] = useState(settings.openaiKey || "");
  const [model, setModel] = useState(settings.openaiModel || "gpt-4o-mini");
  const [selfCheck, setSelfCheck] = useState(settings.selfCheck ?? true);
  const [reviewer, setReviewer] = useState(settings.reviewer || "");
  const [erpUrl, setErpUrl] = useState(settings.erpUrl || "");
  const [erpToken, setErpToken] = useState(settings.erpToken || "");
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || "");
  const [supabaseKey, setSupabaseKey] = useState(settings.supabaseKey || "");
  const [googleClientId, setGoogleClientId] = useState(settings.googleClientId || "");

  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<Partial<Record<TestKey, Status>>>({});
  const [busy, setBusy] = useState<TestKey | "">("");

  const setS = (k: TestKey, ok: boolean, msg: string) => setStatus((s) => ({ ...s, [k]: { ok, msg } }));

  async function testOpenAI() {
    setBusy("openai");
    try {
      const ids = await fetchOpenAIModels(key);
      const chat = chatModels(ids);
      setModels(chat);
      setS("openai", true, "Key works. " + chat.length + " models available — pick from the dropdowns below.");
    } catch (e) {
      setS("openai", false, (e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function testErp() {
    setBusy("erp");
    try {
      const recs = await erpApiList({ url: erpUrl, token: erpToken });
      setS("erp", true, "Connected. " + recs.length + " record(s) visible.");
    } catch (e) {
      setS("erp", false, (e as Error).message + " (check URL, token, CORS)");
    } finally {
      setBusy("");
    }
  }
  async function testSupabase() {
    setBusy("supabase");
    try {
      await supabaseTest({ url: supabaseUrl, key: supabaseKey });
      setS("supabase", true, "Connected. qmr_project table reachable.");
    } catch (e) {
      setS("supabase", false, (e as Error).message + " (run the migration SQL first?)");
    } finally {
      setBusy("");
    }
  }
  async function testGoogle() {
    setBusy("google");
    try {
      await requestDriveToken(googleClientId);
      setS("google", true, "Signed in — Drive access granted.");
    } catch (e) {
      setS("google", false, (e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function save() {
    onSave({
      openaiKey: key.trim(),
      openaiModel: model.trim(),
      selfCheck,
      reviewer: reviewer.trim(),
      erpUrl: erpUrl.trim(),
      erpToken: erpToken.trim(),
      supabaseUrl: supabaseUrl.trim(),
      supabaseKey: supabaseKey.trim(),
      googleClientId: googleClientId.trim(),
    });
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Section title="OpenAI" first>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>API key</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} type="password" placeholder="sk-..." value={key} onChange={(e) => setKey(e.target.value)} />
            <button style={testBtn} onClick={testOpenAI} disabled={busy === "openai"}>
              {busy === "openai" ? "Testing…" : "Test & fetch models"}
            </button>
          </div>
          <div style={hint}>Stored in this browser only. Use a spend-capped, scoped key. Not needed for the demo or the refuse rule.</div>
          <StatusLine s={status.openai} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Model (used for drafting and harmonising)</label>
          {models.length > 0 ? (
            <select style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)}>
              {!models.includes(model) && <option value={model}>{model}</option>}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
          )}
          <div style={hint}>
            {models.length > 0
              ? "Pick from the " + models.length + " models on your account."
              : "Test the key above to pick from your account's models, or type one directly."}
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 12.5 }}>
            <input type="checkbox" checked={selfCheck} onChange={(e) => setSelfCheck(e.target.checked)} style={{ marginRight: 6 }} />
            Self-check pass (AI reviews and corrects its own draft)
          </label>
        </div>
      </Section>

      <Section title="Reviewer">
        <label style={labelStyle}>Your name (recorded on sign-off)</label>
        <input style={inputStyle} value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
      </Section>

      <Section title="ERPNext">
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Base URL</label>
          <input style={inputStyle} value={erpUrl} onChange={(e) => setErpUrl(e.target.value)} placeholder="https://your-site.example.com" />
        </div>
        <label style={labelStyle}>API key : secret</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} type="password" value={erpToken} onChange={(e) => setErpToken(e.target.value)} placeholder="key:secret" />
          <button style={testBtn} onClick={testErp} disabled={busy === "erp"}>
            {busy === "erp" ? "Testing…" : "Test connection"}
          </button>
        </div>
        <div style={hint}>
          Sent as <span style={{ fontFamily: "var(--mono)" }}>Authorization: token key:secret</span>. If CORS blocks calls, host the app same-origin with ERPNext.
        </div>
        <StatusLine s={status.erp} />
      </Section>

      <Section title="Supabase">
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Project URL</label>
          <input style={inputStyle} value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
        </div>
        <label style={labelStyle}>Anon key</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} type="password" value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} placeholder="eyJhbGciOi…" />
          <button style={testBtn} onClick={testSupabase} disabled={busy === "supabase"}>
            {busy === "supabase" ? "Testing…" : "Test connection"}
          </button>
        </div>
        <div style={hint}>
          Run the migration SQL first (Export menu). Sync stores the whole project as one row in <span style={{ fontFamily: "var(--mono)" }}>qmr_project</span>.
        </div>
        <StatusLine s={status.supabase} />
      </Section>

      <Section title="Google Drive">
        <label style={labelStyle}>OAuth client id</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inputStyle} value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
          <button style={testBtn} onClick={testGoogle} disabled={busy === "google"}>
            {busy === "google" ? "…" : "Test sign-in"}
          </button>
        </div>
        <div style={hint}>Enables “Pull from Drive” in the criterion library (read-only Drive access).</div>
        <StatusLine s={status.google} />
      </Section>

      <div style={{ marginTop: 18 }}>
        <button
          onClick={save}
          style={{ background: "var(--navy)", color: "#fff", border: "none", borderRadius: 4, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          Save settings
        </button>
      </div>
    </div>
  );
}
