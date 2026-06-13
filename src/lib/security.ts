const MAX_TEXT = 500;
const controlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(input: unknown, maxLength = MAX_TEXT): string {
  return String(input ?? '')
    .replace(controlChars, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}

export function isValidEventType(value: unknown): value is 'view' | 'favorite' | 'unfavorite' | 'comment' {
  return value === 'view' || value === 'favorite' || value === 'unfavorite' || value === 'comment';
}

export function isValidSchoolId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 500;
}
