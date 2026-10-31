import type { SheetRows } from '@/features/travel/schema';

/** Build publicado: os dados vêm de public/data.enc.json, criptografado, em vez da API do Google. */
export const USE_SNAPSHOT = process.env.EXPO_PUBLIC_USE_SNAPSHOT === '1';

const STORAGE_KEY = 'travel-hunt:senha';

type Snapshot = { updatedAt: string; tabs: Record<string, SheetRows> };
type EncryptedBlob = { v: number; iter: number; salt: string; iv: string; data: string };

let current: Snapshot | null = null;

const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function fetchBlob(): Promise<EncryptedBlob> {
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  for (const url of [`${base}/data.enc.json`, '/data.enc.json']) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as EncryptedBlob;
    } catch {
      // tenta o próximo endereço
    }
  }
  throw new Error('Não foi possível carregar os dados.');
}

export async function unlock(password: string): Promise<void> {
  const blob = await fetchBlob();
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(blob.salt), iterations: blob.iter, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(blob.iv) }, key, fromBase64(blob.data));
  } catch {
    throw new Error('Senha incorreta.');
  }
  current = JSON.parse(new TextDecoder().decode(plain)) as Snapshot;
  localStorage.setItem(STORAGE_KEY, password);
}

/** Tenta abrir com a senha lembrada neste navegador. */
export async function unlockStored(): Promise<boolean> {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;
  try {
    await unlock(saved);
    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

export function snapshotTabs(): Record<string, SheetRows> {
  if (!current) throw new Error('Dados bloqueados.');
  return current.tabs;
}
