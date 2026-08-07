export function logError(scope: string, error: unknown, details?: string) {
  if (details) {
    console.error(`[${scope}] ${details}`, error)
    return
  }

  console.error(`[${scope}]`, error)
}
