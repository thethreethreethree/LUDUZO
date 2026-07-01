// Document kinds — mirrors the document_kind enum in migration 0004.
export const DOCUMENT_KINDS = ["waiver", "contract", "policy"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
