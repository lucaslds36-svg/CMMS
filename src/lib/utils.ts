import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateString;
  }
}

export function calculateLeadTime(reqDate: string, remDate: string) {
  if (!reqDate || !remDate) return 0;
  const start = new Date(reqDate);
  const end = new Date(remDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateDaysRemaining(remDate: string) {
  if (!remDate) return 0;
  const end = new Date(remDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
