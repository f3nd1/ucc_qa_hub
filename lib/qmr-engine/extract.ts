/* =========================================================
   FILE TEXT EXTRACTION (docx via mammoth, pdf via pdf.js)

   Ported from qmr-workbench.html so GD4 requirements and procedures can be
   uploaded as Word/PDF rather than pasted. The heavy libraries are loaded
   with dynamic import() INSIDE the function, so they never enter the server
   bundle or the main client chunk; they load only when a file is extracted.
   Browser-only (uses File / ArrayBuffer).
   ========================================================= */

export const EXTRACT_SUPPORTED = ".docx, .pdf, .txt, .md";

export async function extractText(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return (await file.text()).trim();
  }

  if (name.endsWith(".docx")) {
    const mod = await import("mammoth");
    // mammoth is CommonJS; webpack applies its browser overrides automatically.
    const mammoth = (mod as unknown as { default?: unknown }).default ?? mod;
    const buf = await file.arrayBuffer();
    const res = await (mammoth as { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> })
      .extractRawText({ arrayBuffer: buf });
    return (res.value || "").trim();
  }

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    // The worker is copied to public/ on postinstall and served same-origin
    // (no CDN, works offline). Webpack cannot bundle it (import.meta in .mjs).
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const out: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      out.push(
        tc.items
          .map((it) => ("str" in it ? (it as { str: string }).str : ""))
          .join(" "),
      );
    }
    return out.join("\n\n").trim();
  }

  throw new Error("Unsupported file type. Use .docx, .pdf, .txt or .md.");
}
