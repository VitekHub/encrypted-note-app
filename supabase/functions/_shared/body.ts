/** Safely parses a JSON request body, returning null on any failure. */
export async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  return (await req.json().catch(() => null)) as Record<string, unknown> | null
}

/** Reads a string field from a parsed body, defaulting to '' when absent. */
export function str(body: Record<string, unknown> | null, key: string): string {
  const value = body?.[key]
  return typeof value === 'string' ? value : ''
}
