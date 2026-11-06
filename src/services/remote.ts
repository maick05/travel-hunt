import { md5 } from 'js-md5';

import type { SheetRows } from '@/features/travel/schema';

/** Build publicado: os dados vêm do Web App do Apps Script, protegido por senha. */
const SCRIPT_URL = process.env.EXPO_PUBLIC_SCRIPT_URL ?? '';
export const USE_REMOTE = Boolean(SCRIPT_URL);

const STORAGE_KEY = 'travel-hunt:senha-md5';
const EDIT_STORAGE_KEY = 'travel-hunt:edicao-md5';
const WRONG_PASSWORD = 'Senha incorreta.';

type Tabs = Record<string, SheetRows>;

// As credenciais recebidas já são hashes MD5.
let hash: string | null = null;
let editHash: string | null = null;
let prefetched: { tabs: Tabs; fetchedAt: number } | null = null;

async function request(senhaMd5: string, endpoint: 'viagens' | 'viagem', viagem?: string): Promise<Tabs> {
  // text/plain evita o preflight de CORS, que o Apps Script não responde.
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('endpoint', endpoint);
  if (viagem) url.searchParams.set('viagem', viagem);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ senha: senhaMd5 }),
  });
  if (!res.ok) throw new Error(`Erro ao acessar os dados (${res.status})`);

  const json = (await res.json()) as { erro?: string; abas?: Tabs };
  if (json.erro === 'senha') throw new Error(WRONG_PASSWORD);
  if (!json.abas) throw new Error(json.erro ?? 'Resposta inesperada do servidor.');
  return json.abas;
}

async function open(senhaMd5: string): Promise<void> {
  prefetched = { tabs: await request(senhaMd5, 'viagens'), fetchedAt: Date.now() };
  hash = senhaMd5;
  localStorage.setItem(STORAGE_KEY, senhaMd5);
}

export async function unlock(senha: string, role = ''): Promise<void> {
  const senhaMd5 = validarHash(senha);
  const roleMd5 = role.trim() ? validarHash(role) : '';
  await open(senhaMd5);
  if (roleMd5) await enableEditing(roleMd5);
}

export async function enableEditing(role: string): Promise<void> {
  const candidate = validarHash(role);
  await editRequest('validar-edicao', candidate);
  editHash = candidate;
  localStorage.setItem(EDIT_STORAGE_KEY, candidate);
}

function validarHash(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized)) throw new Error('Informe um hash MD5 válido.');
  return normalized;
}

export function canEdit(): boolean {
  return Boolean(editHash);
}

type EditCell = { valor: string | number | boolean; formula: boolean };
export type EditSheet = { nome: string; id: number; cabecalho: string[]; linhas: { numero: number; versao: string; cells: EditCell[] }[] };

async function editRequest(endpoint: string, role: string, payload: object = {}): Promise<{ erro?: string; abas?: EditSheet[] }> {
  if (!hash) throw new Error('Dados bloqueados.');
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('endpoint', endpoint);
  const res = await fetch(url.toString(), {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ senha: hash, role, ...payload }),
  });
  if (!res.ok) throw new Error(`Erro ao acessar os dados (${res.status})`);
  const result = await res.json() as { erro?: string; abas?: EditSheet[] };
  if (result.erro) throw new Error(result.erro === 'role' ? 'Credencial de edição incorreta.' : result.erro);
  return result;
}

export async function restoreEditing(): Promise<boolean> {
  const saved = localStorage.getItem(EDIT_STORAGE_KEY);
  if (!saved) return false;
  try {
    await editRequest('validar-edicao', saved);
    editHash = saved;
    return true;
  } catch {
    localStorage.removeItem(EDIT_STORAGE_KEY);
    editHash = null;
    return false;
  }
}

export async function editingSheets(): Promise<EditSheet[]> {
  if (!editHash) throw new Error('Edição não autorizada.');
  const result = await editRequest('dados-edicao', editHash);
  if (!result.abas) throw new Error('Resposta inesperada do servidor.');
  return result.abas;
}

export async function saveCell(payload: { aba: number; linha: number; coluna: number; versao: string; valor: string | number | boolean }): Promise<void> {
  if (!editHash) throw new Error('Edição não autorizada.');
  await editRequest('editar', editHash, payload);
  prefetched = null;
}

/** Abre com o MD5 recebido em `?apiKey=` na URL do site e tira o parâmetro do endereço. */
export async function unlockFromUrl(): Promise<boolean> {
  const url = new URL(window.location.href);
  const senhaMd5 = url.searchParams.get('apiKey')?.toLowerCase();
  const roleMd5 = url.searchParams.get('role');
  if (!senhaMd5 && roleMd5 === null) return false;

  url.searchParams.delete('apiKey');
  url.searchParams.delete('role');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);

  if (roleMd5 !== null) {
    editHash = null;
    localStorage.removeItem(EDIT_STORAGE_KEY);
  }
  try {
    if (senhaMd5) {
      if (!/^[0-9a-f]{32}$/.test(senhaMd5)) return false;
      await open(senhaMd5);
    } else if (!await unlockStored()) {
      return false;
    }
    if (roleMd5 !== null) {
      try { await enableEditing(roleMd5); } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

/** Usa o hash já validado e guardado neste navegador, sem consultar o servidor. */
export async function unlockStored(): Promise<boolean> {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;
  hash = saved;
  return true;
}

export function remoteCacheScope(): string {
  if (!hash) throw new Error('Dados bloqueados.');
  return md5(`${SCRIPT_URL}:${hash}`);
}

export async function fetchRemoteTabs(endpoint: 'viagens' | 'viagem', viagem?: string): Promise<{ tabs: Tabs; fetchedAt: number }> {
  if (!hash) throw new Error('Dados bloqueados.');
  if (endpoint === 'viagem' && !viagem?.trim()) throw new Error('Informe a viagem.');
  if (endpoint === 'viagens' && prefetched) {
    const cached = prefetched;
    prefetched = null;
    if (Date.now() >= cached.fetchedAt && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) return cached;
  }
  try {
    const tabs = await request(hash, endpoint, viagem);
    return { tabs, fetchedAt: Date.now() };
  } catch (e) {
    // A senha mudou no servidor: esquece o hash e volta para a tela de senha.
    if ((e as Error).message === WRONG_PASSWORD) {
      localStorage.removeItem(STORAGE_KEY);
      hash = null;
      window.location.reload();
    }
    throw e;
  }
}
