import { useState } from "react";
import type { Settings } from "@/lib/qmr-engine";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 500,
  fontSize: 11.5,
  color: "var(--navy)",
  marginBottom: 3,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "6px 7px",
  fontSize: 12.5,
  background: "#fff",
  fontFamily: "inherit",
};

/** Minimal settings for Phase 1: the browser-key OpenAI pattern + reviewer. */
export function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (patch: Settings) => void;
  onClose: () => void;
}) {
  const [key, setKey] = useState(settings.openaiKey || "");
  const [model, setModel] = useState(settings.openaiModel || "gpt-4o-mini");
  const [finalModel, setFinalModel] = useState(settings.finalModel || "gpt-4o");
  const [selfCheck, setSelfCheck] = useState(settings.selfCheck ?? true);
  const [reviewer, setReviewer] = useState(settings.reviewer || "");
  const [erpUrl, setErpUrl] = useState(settings.erpUrl || "");
  const [erpToken, setErpToken] = useState(settings.erpToken || "");
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || "");
  const [supabaseKey, setSupabaseKey] = useState(settings.supabaseKey || "");
  const [googleClientId, setGoogleClientId] = useState(settings.googleClientId || "");

  return (
    <div
      style={{
        border: "1px solid var(--border-light)",
        borderRadius: 8,
        background: "#fff",
        padding: 16,
        marginBottom: 18,
        maxWidth: 620,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, color: "var(--navy)", fontSize: 14 }}>Settings</h3>
        <button
          onClick={onClose}
          style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 18, color: "var(--muted)", cursor: "pointer" }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>OpenAI API key</label>
        <input
          style={inputStyle}
          type="password"
          placeholder="sk-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
          Stored in this browser only. Use a spend-capped, scoped key. Not needed to load the demo or to
          see the refuse rule.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Bulk model (fast, cheap)</label>
          <input style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Final model (stronger)</label>
          <input style={inputStyle} value={finalModel} onChange={(e) => setFinalModel(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12.5 }}>
          <input
            type="checkbox"
            checked={selfCheck}
            onChange={(e) => setSelfCheck(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Self-check pass (AI reviews and corrects its own draft)
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Your name (recorded on sign-off)</label>
        <input style={inputStyle} value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>ERPNext base URL</label>
        <input style={inputStyle} value={erpUrl} onChange={(e) => setErpUrl(e.target.value)} placeholder="https://your-site.example.com" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>ERPNext API key : secret</label>
        <input
          style={inputStyle}
          type="password"
          value={erpToken}
          onChange={(e) => setErpToken(e.target.value)}
          placeholder="key:secret"
        />
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
          Sent as <span style={{ fontFamily: "var(--mono)" }}>Authorization: token key:secret</span>. If CORS
          blocks calls, host the app same-origin with ERPNext.
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Supabase project URL</label>
        <input style={inputStyle} value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Supabase anon key</label>
        <input
          style={inputStyle}
          type="password"
          value={supabaseKey}
          onChange={(e) => setSupabaseKey(e.target.value)}
          placeholder="eyJhbGciOi…"
        />
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
          Run the migration SQL first (Export menu). Sync stores the whole project as one row in{" "}
          <span style={{ fontFamily: "var(--mono)" }}>qmr_project</span>.
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Google OAuth client id (Drive)</label>
        <input style={inputStyle} value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
          Enables “Pull from Drive” in the criterion library (read-only Drive access).
        </div>
      </div>

      <button
        onClick={() =>
          onSave({
            openaiKey: key.trim(),
            openaiModel: model.trim(),
            finalModel: finalModel.trim(),
            selfCheck,
            reviewer: reviewer.trim(),
            erpUrl: erpUrl.trim(),
            erpToken: erpToken.trim(),
            supabaseUrl: supabaseUrl.trim(),
            supabaseKey: supabaseKey.trim(),
            googleClientId: googleClientId.trim(),
          })
        }
        style={{
          background: "var(--navy)",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "7px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Save settings
      </button>
    </div>
  );
}
