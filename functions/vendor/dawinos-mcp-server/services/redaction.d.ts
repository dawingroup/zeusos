/**
 * Lightweight redaction helpers for MCP tool inputs/outputs that may contain
 * sensitive information (emails, phone numbers, long numeric identifiers).
 */
export declare function redactSensitiveText(input: string): string;
export declare function redactMessageArray(messages: Array<{
    role: 'user' | 'assistant';
    content: string;
}>): Array<{
    role: 'user' | 'assistant';
    content: string;
}>;
//# sourceMappingURL=redaction.d.ts.map