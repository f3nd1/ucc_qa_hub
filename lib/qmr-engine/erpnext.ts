/* =========================================================
   ERPNext REST — STUB (Phase 1)

   The original tool reads Quality Monitoring Records from ERPNext and
   writes edited fields back. Crucially, write-back fetches the fresh
   document first and merges only the edited fields by row name, never
   overwriting the whole record blindly (see CLAUDE.md). That behaviour
   is ported when this is wired in a later phase. Phase 1 does not need
   live ERPNext.
   ========================================================= */

export const ERPNEXT_STUB_MESSAGE = "ERPNext read/write-back is wired in a later phase.";

export async function apiList(): Promise<never> {
  throw new Error(ERPNEXT_STUB_MESSAGE);
}

export async function apiGet(_name: string): Promise<never> {
  throw new Error(ERPNEXT_STUB_MESSAGE);
}

export async function writeBack(): Promise<never> {
  throw new Error(ERPNEXT_STUB_MESSAGE);
}
