import { extractText } from "@/lib/qmr-engine";

/* =========================================================
   Google Drive: pull a procedure/requirement file's text from a Drive link.

   OAuth uses Google Identity Services (a browser token client) to get a
   read-only Drive access token; the token then fetches the file via the Drive
   REST API. Google Docs are exported as text/plain; other files (docx/pdf) are
   downloaded and run through the same extractText used for local uploads.

   parseDriveId and driveFetchText are pure/injectable and unit-tested against a
   mock. requestDriveToken needs a real Google client id and cannot be exercised
   without live credentials.
   ========================================================= */

/** Pull a Drive file id out of the common Drive/Docs URL forms (or a bare id). */
export function parseDriveId(url: string): string | null {
  const s = String(url || "").trim();
  let m = s.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = s.match(/^([a-zA-Z0-9_-]{20,})$/);
  if (m) return m[1];
  return null;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DOC = "application/vnd.google-apps.document";

/** Fetch a Drive file's text with an access token. `apiBase` is for tests. */
export async function driveFetchText(
  token: string,
  fileId: string,
  opts?: { apiBase?: string },
): Promise<string> {
  const base = opts?.apiBase || DRIVE_API;
  const auth = { Authorization: "Bearer " + token };

  const metaRes = await fetch(base + "/files/" + fileId + "?fields=name,mimeType", { headers: auth });
  if (!metaRes.ok) throw new Error("Drive metadata HTTP " + metaRes.status);
  const { name, mimeType } = (await metaRes.json()) as { name?: string; mimeType?: string };

  if (mimeType === GOOGLE_DOC) {
    const ex = await fetch(base + "/files/" + fileId + "/export?mimeType=text/plain", { headers: auth });
    if (!ex.ok) throw new Error("Drive export HTTP " + ex.status);
    return (await ex.text()).trim();
  }

  const dl = await fetch(base + "/files/" + fileId + "?alt=media", { headers: auth });
  if (!dl.ok) throw new Error("Drive download HTTP " + dl.status);
  const blob = await dl.blob();
  const file = new File([blob], name || "drive-file", { type: mimeType || "" });
  return extractText(file);
}

/* ---- Google Identity Services token flow (browser-only) ---- */

interface TokenClient {
  requestAccessToken: () => void;
}
interface GoogleGis {
  accounts?: {
    oauth2?: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: { access_token?: string; error?: string }) => void;
      }) => TokenClient;
    };
  };
}

function loadGis(): Promise<void> {
  const g = (window as unknown as { google?: GoogleGis }).google;
  if (g?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(s);
  });
}

/** Request a read-only Drive access token via the Google token client. */
export async function requestDriveToken(clientId: string): Promise<string> {
  if (!clientId) throw new Error("Set a Google OAuth client id in Settings.");
  await loadGis();
  const g = (window as unknown as { google?: GoogleGis }).google;
  const oauth2 = g?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google Identity Services unavailable.");
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (resp) => {
        if (resp.error || !resp.access_token) reject(new Error(resp.error || "No access token returned."));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}
