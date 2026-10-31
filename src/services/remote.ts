import { md5 } from 'js-md5';

import type { SheetRows } from '@/features/travel/schema';

/** Build publicado: os dados vêm do Web App do Apps Script, protegido por senha. */
const SCRIPT_URL = process.env.EXPO_PUBLIC_SCRIPT_URL ?? '';
export const USE_REMOTE = Boolean(SCRIPT_URL);

const STORAGE_KEY = 'travel-hunt:senha-md5';

type Tabs = Record<string, SheetRows>;

// Só o hash MD5 da senha circula e fica guardado; a senha digitada não é armazenada.
let hash: string | null = null;
let prefetched: Tabs | null = null;

async function request(senhaMd5: string): Promise<Tabs> {
  // text/plain evita o preflight de CORS, que o Apps Script não responde.
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ apiKey: senhaMd5 }),
  });
  if (!res.ok) throw new Error(`Erro ao acessar os dados (${res.status})`);

  const json = (await res.json()) as { erro?: string; abas?: Tabs };
  if (json.erro === 'senha') throw new Error('Senha incorreta.');
  if (!json.abas) throw new Error(json.erro ?? 'Resposta inesperada do servidor.');
  return json.abas;
}

async function open(senhaMd5: string): Promise<void> {
  prefetched = await request(senhaMd5);
  hash = senhaMd5;
  localStorage.setItem(STORAGE_KEY, senhaMd5);
}

export function unlock(senha: string): Promise<void> {
  return open(md5(senha));
}

/** Abre com o MD5 recebido em `?apiKey=` na URL do site e tira o parâmetro do endereço. */
export async function unlockFromUrl(): Promise<boolean> {
  const url = new URL(window.location.href);
  const senhaMd5 = url.searchParams.get('apiKey')?.toLowerCase();
  if (!senhaMd5) return false;

  url.searchParams.delete('apiKey');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);

  if (!/^[0-9a-f]{32}$/.test(senhaMd5)) return false;
  try {
    await open(senhaMd5);
    return true;
  } catch {
    return false;
  }
}

/** Tenta abrir com o hash lembrado neste navegador. */
export async function unlockStored(): Promise<boolean> {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;
  try {
    await open(saved);
    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

/** Dados atuais da planilha; a primeira chamada reaproveita a resposta que abriu a tela de senha. */
export async function fetchRemoteTabs(): Promise<Tabs> {
  if (!hash) throw new Error('Dados bloqueados.');
  if (prefetched) {
    const tabs = prefetched;
    prefetched = null;
    return tabs;
  }
  return request(hash);
}
