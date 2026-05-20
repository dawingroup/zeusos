/**
 * Lightweight redaction helpers for MCP tool inputs/outputs that may contain
 * sensitive information (emails, phone numbers, long numeric identifiers).
 */
export function redactSensitiveText(input: string): string {
  if (!input) return input;
  return input
    // Emails
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    // Phone-like numbers (supports +country and separators)
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[redacted-phone]')
    // Long digit sequences (TIN/reference/account-like)
    .replace(/\b\d{8,}\b/g, '[redacted-number]');
}

export function redactMessageArray(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: redactSensitiveText(m.content),
  }));
}
