export const LEGAL_CONTENT_FALLBACK_TEXT = {
  "privacy-policy": "<p>Privacy policy content appears here.</p>",
  "terms-of-services": "<p>Terms of Service content appears here.</p>",
  "cookies-settings": "<p>Cookie settings content appears here.</p>",
} as const

export type LegalContentFallbackSlug =
  keyof typeof LEGAL_CONTENT_FALLBACK_TEXT
