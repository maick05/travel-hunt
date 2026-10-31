import type { SheetRows } from '@/features/travel/schema';

/** Build publicado: os dados vêm do Web App do Apps Script, protegido por senha. */
const SCRIPT_URL = process.env.EXPO_PUBLIC_SCRIPT_URL ?? '';
export const USE_REMOTE = Boolean(SCRIPT_URL);

const STORAGE_KEY = 'travel-hunt:senha';

type Tabs = Record<string, SheetRows>;

let password: string | null = null;
let prefetched: Tabs | null = null;

async function request(senha: string): Promise<Tabs> {
  // text/plain evita o preflight de CORS, que o Apps Script não responde.
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ senha }),
  });
  if (!res.ok) throw new Error(`Erro ao acessar os dados (${res.status})`);

  const json = (await res.json()) as { erro?: string; abas?: Tabs };
  if (json.erro === 'senha') throw new Error('Senha incorreta.');
  if (!json.abas) throw new Error(json.erro ?? 'Resposta inesperada do servidor.');
  return json.abas;
}

export async function unlock(senha: string): Promise<void> {
  prefetched = await request(senha);
  password = senha;
  localStorage.setItem(STORAGE_KEY, senha);
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

/** Dados atuais da planilha; a primeira chamada reaproveita a resposta que abriu a tela de senha. */
export async function fetchRemoteTabs(): Promise<Tabs> {
  if (!password) throw new Error('Dados bloqueados.');
  if (prefetched) {
    const tabs = prefetched;
    prefetched = null;
    return tabs;
  }
  return request(password);
}
