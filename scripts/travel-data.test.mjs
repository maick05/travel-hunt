import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};

const { parseTable, parseTables } = require('../src/features/travel/parse.ts');
const { schemas } = require('../src/features/travel/schema.ts');
const { sampleRows } = require('../src/features/travel/sample-data.ts');
const { hasReserveAsset } = require('../src/features/travel/reserves.ts');
const { billToBRL } = require('../src/features/travel/format.ts');
const { mealCostsByType } = require('../src/features/travel/costs.ts');
const { registerCoords } = require('../src/features/travel/places.ts');
const { buildMap, itineraryActivities } = require('../src/features/travel/map-data.ts');
const quoteStorage = new Map();
const storage = {
  getItem: async (key) => quoteStorage.get(key) ?? null,
  setItem: async (key, value) => quoteStorage.set(key, value),
};
const originalLoad = Module._load;
Module._load = function (id, ...args) {
  if (id === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
  return originalLoad.call(this, id, ...args);
};
const { CACHE_DURATION, getQuote, quoteRequest, reserveResult } = require('../src/features/travel/quotes.ts');
Module._load = originalLoad;

test('despesas reconhecem referências e ativos múltiplos independentemente da ordem', () => {
  const bills = parseTable([
    ['Viagem', 'Reserva de Valor', 'Ref.', 'Descrição do item'],
    ['Viagem', ' PTR4, BNO, , ptr4 ', 5, 'Ônibus'],
    ['Viagem', '', '', ''],
  ], schemas.bills.fields);
  assert.equal(bills.length, 1);
  assert.equal(bills[0].reference, '5');
  assert.deepEqual(bills[0].valueReserve, ['PTR4', 'BNO', 'ptr4']);
  assert.equal(hasReserveAsset(bills[0].valueReserve, 'bno'), true);
  assert.equal(hasReserveAsset(bills[0].valueReserve, 'PTR'), false);
  assert.equal(hasReserveAsset(bills[0].valueReserve, ''), false);
  assert.equal(parseTable([['Referência', 'Tipo'], [7, 'Atividade']], schemas.bills.fields)[0].reference, '7');
});

test('checkbox pré-preenchido não cria atividades vazias', () => {
  const activities = parseTable([
    ['Cod. Atividade', 'Reservado (Ticket/Valor)', 'Data Reserva Possível', 'Motivo Aguardo da Reserva', 'Atividade', 'Viagem'],
    [1, false, 46447, 'Aguardando', 'Ônibus', 'Viagem'],
    [2, true, '', '', 'Hotel', 'Viagem'],
    [3, false, '', '', '', 'Viagem'],
  ], schemas.activities.fields);
  assert.equal(activities.length, 2);
  assert.equal(activities[0].reserved, false);
  assert.equal(activities[1].reserved, true);
  assert.equal(activities[0].reservationWaitReason, 'Aguardando');
  assert.equal(new Date(activities[0].reservationAvailableDate).toISOString().slice(0, 10), '2027-03-01');
});

test('dados de exemplo mantêm vínculos e reservas separados dos totais', () => {
  const tables = parseTables(sampleRows);
  const bill = tables.bills.find((item) => item.description === 'Uber');
  assert.equal(bill.reference, '2');
  assert.equal(tables.valueReserves.filter((reserve) => hasReserveAsset(bill.valueReserve, reserve.asset)).length, 2);
  assert.equal(tables.valueReserves[0].assetDescription, 'Ativo exemplo 1');
  const total = tables.bills.reduce((sum, item) => sum + (billToBRL(item, tables.currencies) ?? 0), 0);
  assert.ok(Math.abs(total - 5431.375) < 0.001);
});

test('ponto inicial permanece no mapa sem ocultar uma volta posterior', () => {
  const data = parseTables(sampleRows);
  const origin = 'https://maps.app.goo.gl/origem';
  const destination = 'https://maps.app.goo.gl/destino';
  registerCoords([
    { link: origin, name: 'Torres', lat: -29.3, lng: -49.7 },
    { link: destination, name: 'Tubarão', lat: -28.5, lng: -49 },
  ]);
  const template = data.activities[0];
  data.activities = [
    { ...template, title: 'Embarque', place: origin, category: 'Traslado', start: 1000 },
    { ...template, title: 'Chegada', place: destination, category: 'Traslado', start: 2000 },
    { ...template, title: 'Retorno', place: origin, category: 'Passeio', start: 3000 },
  ];
  data.flights = [];
  data.transports = [{ ...data.transports[0], from: origin, to: destination, departure: 1000, arrival: 2000 }];
  assert.deepEqual(itineraryActivities(data).map((activity) => activity.title), ['Chegada', 'Retorno']);
  assert.ok(buildMap(data).points.some((point) => point.emoji === '🚩' && point.items.some((item) => item.title === 'Início da viagem')));
  data.transports = [];
  assert.equal(itineraryActivities(data).length, 3);
});

test('despesas de comida são agrupadas pelo tipo de refeição sem duplicar referências', () => {
  const data = parseTables(sampleRows);
  const mealBill = data.bills.find((bill) => bill.type === 'Comida');
  data.meals.push({ ...data.meals.find((meal) => meal.code === mealBill.reference) });
  data.bills.push({ ...mealBill, reference: '999', amount: 10, currency: 'R$', usedRate: null });
  const totals = mealCostsByType(data);
  assert.ok(Math.abs(totals.get('Almoço') - billToBRL(mealBill, data.currencies)) < 0.001);
  assert.equal(totals.get('Sem refeição vinculada'), 10);
  assert.equal(totals.size, 2);
});

test('resultado de reserva compara valores na mesma moeda e exige dados suficientes', () => {
  const data = parseTables(sampleRows);
  const reserve = { ...data.valueReserves[0], asset: 'EUR', quantity: 10, value: 60, usedRate: 6, currency: 'R$' };
  assert.deepEqual(quoteRequest(reserve, data.currencies), { kind: 'currency', symbol: 'EUR', currency: 'BRL' });
  const quote = { price: 7, currency: 'BRL', marketTime: 1, fetchedAt: 1 };
  assert.deepEqual(reserveResult(reserve, quote), { current: 70, difference: 10 });
  assert.deepEqual(reserveResult({ ...reserve, value: null, usedRate: 8 }, quote), { current: 70, difference: -10 });
  assert.equal(reserveResult({ ...reserve, quantity: null }, quote), null);
  assert.equal(reserveResult({ ...reserve, value: null, usedRate: null }, quote), null);
  assert.equal(reserveResult({ ...reserve, currency: 'USD' }, quote), null);
  assert.deepEqual(quoteRequest({ ...reserve, asset: 'PETR4' }, data.currencies), { kind: 'stock', symbol: 'PETR4', currency: 'BRL' });
  assert.equal(quoteRequest({ ...reserve, asset: 'PETR4', currency: 'USD' }, data.currencies), null);
  assert.equal(quoteRequest({ ...reserve, asset: 'ATIVO1' }, data.currencies), null);
});

test('cache de cotação dura 12 horas e não armazena respostas inválidas', async () => {
  quoteStorage.clear();
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 1700000000000;
  let calls = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ EURBRL: { code: 'EUR', codein: 'BRL', bid: '6.5', timestamp: '1699999000' } }) };
  };
  try {
    const request = { kind: 'currency', symbol: 'EUR', currency: 'BRL' };
    const first = await getQuote(request);
    assert.equal(first.price, 6.5);
    now += CACHE_DURATION - 1;
    assert.deepEqual(await getQuote(request), first);
    assert.equal(calls, 1);
    now++;
    assert.equal((await getQuote(request)).fetchedAt, now);
    assert.equal(calls, 2);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ USDBRL: { code: 'USD', codein: 'BRL', bid: '0', timestamp: '1699999000' } }) });
    await assert.rejects(getQuote({ kind: 'currency', symbol: 'USD', currency: 'BRL' }));
    assert.equal(quoteStorage.size, 1);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    quoteStorage.clear();
  }
});