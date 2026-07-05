/* =========================================================
   FILE TEXT EXTRACTION — STUB (Phase 1)

   The original tool extracts text from .docx (mammoth) and .pdf
   (pdf.js) so GD4 requirements and procedures can be uploaded rather
   than pasted. Phase 1 only needs to prove one activity drafts and
   refuses, so this is stubbed. It will be wired (with mammoth +
   pdfjs-dist) in a later phase.
   ========================================================= */

export const EXTRACT_STUB_MESSAGE = "File extraction (docx/pdf) is wired in a later phase.";

export async function extractText(_file: File): Promise<string> {
  throw new Error(EXTRACT_STUB_MESSAGE);
}
