import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import DOMPurify from 'dompurify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtTime(s: number): string {
  const safeS = Math.max(0, Math.floor(s));
  const m = Math.floor(safeS / 60);
  const sec = safeS % 60;
  return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
}

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty);
}

export function truncateContext(text: string, maxChars: number = 6000): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n... [Context truncated to maximum length]';
}

