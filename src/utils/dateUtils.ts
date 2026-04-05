import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export function formatDate(iso: string, pattern = 'MMM d, yyyy'): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, pattern) : '';
}

export function formatDateTime(iso: string): string {
  return formatDate(iso, 'MMM d, yyyy • h:mm a');
}

export function relativeTime(iso: string): string {
  const date = parseISO(iso);
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '';
}

export function toISO(date = new Date()): string {
  return date.toISOString();
}
