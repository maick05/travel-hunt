import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Currency, Tables } from './schema';

type ValueReserve = Tables['valueReserves'][number];

export const CACHE_DURATION = 12 * 60 * 60 * 1000;
const CACHE_PREFIX = 'travel-hunt:quote:v1:';

export type Quote = {
  price: number;
  currency: string;
  marketTime: number;
  fetchedAt: number;
};

type QuoteRequest = { kind: 'currency' | 'stock'; symbol: string; currency: string };

function currencyCode(value: string): string {
  const code = value.trim().toUpperCase();
  return code === 'R$' ? 'BRL' : code;
}

export function quoteRequest(reserve: ValueReserve, currencies: Currency[]): QuoteRequest | null {
  const symbol = reserve.asset.trim().toUpperCase();
  const currency = currencyCode(reserve.currency);
  const assetCurrency = currencies.find((item) => currencyCode(item.symbol) === symbol);
  const assetType = (assetCurrency?.type || reserve.type).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const isCurrency = ['fiduciaria', 'moeda', 'criptomoeda', 'cripto'].includes(assetType);
  if (isCurrency && /^[A-Z]{3}$/.test(symbol) && /^[A-Z]{3}$/.test(currency) && symbol !== currency) {
    return { kind: 'currency', symbol, currency };
  }
  if (currency === 'BRL' && /^[A-Z]{4}\d{1,2}$/.test(symbol)) {
    return { kind: 'stock', symbol, currency };
  }
  return null;
}

export function reserveResult(reserve: ValueReserve, quote: Quote): { current: number; difference: number } | null {
  if (reserve.quantity === null || !Number.isFinite(reserve.quantity) || reserve.quantity < 0 || currencyCode(reserve.currency) !== quote.currency) return null;
  const original = reserve.value ?? (reserve.usedRate === null ? null : reserve.quantity * reserve.usedRate);
  if (original === null || !Number.isFinite(original)) return null;
  const current = reserve.quantity * quote.price;
  return { current, difference: current - original };
}

export async function getQuote(request: QuoteRequest): Promise<Quote> {
  const key = `${CACHE_PREFIX}${request.kind}:${request.symbol}:${request.currency}`;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const cached = JSON.parse(stored) as Quote;
      if (Number.isFinite(cached.price) && cached.price > 0 && cached.currency === request.currency &&
          Number.isFinite(cached.marketTime) && cached.marketTime > 0 && Number.isFinite(new Date(cached.marketTime).getTime()) && Number.isFinite(cached.fetchedAt) &&
          cached.fetchedAt <= Date.now() && Date.now() - cached.fetchedAt < CACHE_DURATION) return cached;
    }
  } catch {}

  let price: number;
  let marketTime: number;
  if (request.kind === 'currency') {
    const response = await fetch(`https://economia.awesomeapi.com.br/json/last/${request.symbol}-${request.currency}`);
    if (!response.ok) throw new Error('Cotação indisponível');
    const data = await response.json();
    const result = data[`${request.symbol}${request.currency}`];
    if (result?.code !== request.symbol || result?.codein !== request.currency) throw new Error('Cotação inválida');
    price = Number(result.bid);
    marketTime = Number(result.timestamp) * 1000;
  } else {
    const response = await fetch(`https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(request.symbol)}`);
    if (!response.ok) throw new Error('Cotação indisponível');
    const data = await response.json();
    const result = data.results?.[0];
    if (result?.requestedSymbol !== request.symbol || result?.symbol !== request.symbol || result?.changed || result?.data?.currency !== request.currency) throw new Error('Cotação inválida');
    price = Number(result.data.regularMarketPrice);
    marketTime = Date.parse(result.data.regularMarketTime);
  }
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(marketTime) || marketTime <= 0 || !Number.isFinite(new Date(marketTime).getTime())) throw new Error('Cotação inválida');
  const quote = { price, currency: request.currency, marketTime, fetchedAt: Date.now() };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(quote));
  } catch {}
  return quote;
}