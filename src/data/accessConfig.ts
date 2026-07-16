import type { AccessAccount } from './types';

export const PRIMARY_ADMIN_EMAIL = 'khaitri15@gmail.com';

export const INITIAL_ACCESS_ACCOUNTS: AccessAccount[] = [
  { email: PRIMARY_ADMIN_EMAIL, role: 'admin', active: true },
  { email: 'henrynguyenfw@gmail.com', role: 'editor', active: true },
  { email: 'trinkse61538@gmail.com', role: 'editor', active: true },
  { email: 'airbnbjvilla1225@gmail.com', role: 'editor', active: true },
  { email: 'nathantran7@hotmail.com', role: 'editor', active: true },
];

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

