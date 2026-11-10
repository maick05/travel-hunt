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
const { dateInput, dateSerial, editFieldType, findEditItem } = require('../src/features/travel/edit-values.ts');
const { sampleRows } = require('../src/features/travel/sample-data.ts');

test('edição converte datas e reconhece tipos do esquema', () => {
  assert.equal(dateInput(dateSerial('2027-02-28 15:32:45')), '2027-02-28 15:32:45');
  assert.equal(dateSerial('2027-02-30'), null);
  assert.equal(dateSerial('2027-01-01 25:00'), null);
  assert.equal(editFieldType('Money 💴', 'Valor'), 'number');
  assert.equal(editFieldType('Activities 🚶', 'Início'), 'date');
  assert.equal(editFieldType('Activities 🚶', 'Reservado (Ticket/Valor)'), 'boolean');
});
const { hasReserveAsset } = require('../src/features/travel/reserves.ts');
const { billToBRL } = require('../src/features/travel/format.ts');
const { mealCostsByType, moneyBreakdown, originalMoneyBreakdown } = require('../src/features/travel/costs.ts');
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
const { CACHE_DURATION, getQuote, quoteRequest, quoteUnavailableReason, reserveResult, sheetQuote } = require('../src/features/travel/quotes.ts');
Module._load = originalLoad;

const travelStorage = new Map();
let scope = 'source-a';
let travelCalls = [];
Module._load = function (id, ...args) {
  if (id === '@react-native-async-storage/async-storage') return { __esModule: true, default: {
    getItem: async (key) => travelStorage.get(key) ?? null,
    setItem: async (key, value) => travelStorage.set(key, value),
  } };
  if (id === '@/config/env') return { env: {}, isSheetsConfigured: false };
  if (id === '@/services/remote') return {
    USE_REMOTE: true,
    remoteCacheScope: () => scope,
    fetchRemoteTabs: async (endpoint, trip) => {
      travelCalls.push([endpoint, trip]);
      return { tabs: { 'Travels 🧳': [['Nome', 'Data Inicial'], ['Viagem B', 46600], ['Sem data', ''], ['Viagem A', 46500]] }, fetchedAt: Date.now() };
    },
  };
  if (id === '@/services/sheets/client') return { pickTabs: (tabs) => [tabs['Travels 🧳']] };
  return originalLoad.call(this, id, ...args);
};
const { loadTravels, loadTravelData, TRAVEL_CACHE_DURATION } = require('../src/features/travel/repository.ts');
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

test('atividades leem empresa, link e reserva nos cabeçalhos novos e antigos', () => {
  const [activity] = parseTable([
    ['Atividade', 'Empresa', 'Link', 'Res', 'Obs'],
    ['Bagagem', 'Lockers y Consignas', 'https://example.com', 'https://example.com/reserva', 'Observação'],
  ], schemas.activities.fields);
  assert.equal(activity.company, 'Lockers y Consignas');
  assert.equal(activity.link, 'https://example.com');
  assert.equal(activity.voucher, 'https://example.com/reserva');
  assert.equal(activity.notes, 'Observação');
  assert.equal(parseTable([['Atividade', 'Reserva'], ['Passeio', 'https://example.com/voucher']], schemas.activities.fields)[0].voucher, 'https://example.com/voucher');
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

test('gráficos financeiros agrupam em reais e filtram moeda e pagamento', () => {
  const data = parseTables(sampleRows);
  const bill = data.bills[0];
  data.bills = [
    { ...bill, currency: 'EUR', paymentMethod: 'Cartão', amount: 10, usedRate: 6 },
    { ...bill, currency: 'EUR', paymentMethod: 'Dinheiro', amount: 5, usedRate: 6 },
    { ...bill, currency: 'USD', paymentMethod: 'Cartão', amount: 10, usedRate: 5 },
    { ...bill, currency: '', paymentMethod: '', amount: 10, usedRate: null },
    { ...bill, currency: 'EUR', paymentMethod: 'Cartão', amount: 4, usedRate: 0 },
  ];
  assert.deepEqual([...moneyBreakdown(data, 'currency', null)], [['EUR', 90], ['USD', 50], ['Sem moeda', 0]]);
  assert.deepEqual([...moneyBreakdown(data, 'currency', 'Cartão')], [['EUR', 60], ['USD', 50]]);
  assert.deepEqual([...moneyBreakdown(data, 'paymentMethod', 'EUR')], [['Cartão', 60], ['Dinheiro', 30]]);
  assert.deepEqual([...moneyBreakdown(data, 'paymentMethod', '')], [['Sem meio de pagamento', 0]]);
  assert.equal(moneyBreakdown(data, 'currency', 'Inexistente').size, 0);
});

test('valores originais são agrupados por moeda e meio de pagamento sem conversão', () => {
  const data = parseTables(sampleRows);
  const bill = data.bills[0];
  data.bills = [
    { ...bill, currency: 'EUR', paymentMethod: 'Cartão', amount: 10, usedRate: 6 },
    { ...bill, currency: 'EUR', paymentMethod: 'Cartão', amount: 4, usedRate: 0 },
    { ...bill, currency: 'EUR', paymentMethod: 'Dinheiro', amount: 5, usedRate: null },
    { ...bill, currency: 'USD', paymentMethod: 'Cartão', amount: 8, usedRate: null },
    { ...bill, currency: '', paymentMethod: '', amount: 3, usedRate: null },
    { ...bill, currency: 'EUR', paymentMethod: 'Dinheiro', amount: null, usedRate: 6 },
  ];
  const entries = (result) => [...result].map(([currency, payments]) => [currency, [...payments]]);
  assert.deepEqual(entries(originalMoneyBreakdown(data, null, null)), [
    ['EUR', [['Cartão', 14], ['Dinheiro', 5]]],
    ['USD', [['Cartão', 8]]],
    ['', [['Sem meio de pagamento', 3]]],
  ]);
  assert.deepEqual(entries(originalMoneyBreakdown(data, null, 'Cartão')), [['EUR', [['Cartão', 14]]], ['USD', [['Cartão', 8]]]]);
  assert.deepEqual(entries(originalMoneyBreakdown(data, 'EUR', null)), [['EUR', [['Cartão', 14], ['Dinheiro', 5]]]]);
  assert.deepEqual(entries(originalMoneyBreakdown(data, '', '')), [['', [['Sem meio de pagamento', 3]]]]);
  assert.equal(originalMoneyBreakdown(data, 'GBP', null).size, 0);
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

test('transporte interno não gera rota, mas mantém os pontos e outros trajetos', () => {
  const data = parseTables(sampleRows);
  const origin = 'https://maps.app.goo.gl/inicio';
  const internal = 'https://maps.app.goo.gl/interno';
  const destination = 'https://maps.app.goo.gl/fim';
  registerCoords([
    { link: origin, name: 'Início', lat: 41.38, lng: 2.17 },
    { link: internal, name: 'Interno', lat: 41.39, lng: 2.18 },
    { link: destination, name: 'Destino', lat: 41.40, lng: 2.19 },
  ]);
  data.locals = [{ ...data.locals[0], name: 'Barcelona', link: origin }];
  const activity = data.activities[0];
  data.activities = [
    { ...activity, title: 'Início', place: origin, transportMode: '', transportRef: '' },
    { ...activity, title: 'Interno', place: internal, transportMode: ' INTERNO ', transportRef: '' },
    { ...activity, title: 'Destino', place: destination, transportMode: 'A pé', transportRef: '' },
  ];
  const transport = data.transports[0];
  data.transports = [
    { ...transport, from: origin, to: internal, mode: 'Interno' },
    { ...transport, from: origin, to: destination, mode: 'Ônibus' },
  ];
  data.flights = [];
  const map = buildMap(data);
  assert.ok(map.points.some((point) => point.items.some((item) => item.title === 'Interno')));
  assert.equal(map.legs.length, 2);
  assert.deepEqual(map.legs.map((leg) => leg.kind), ['foot', 'road']);
  assert.deepEqual(map.legs[0].from, [41.39, 2.18]);
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
  assert.deepEqual(quoteRequest({ ...reserve, asset: 'U1BE34' }, data.currencies), { kind: 'stock', symbol: 'U1BE34', currency: 'BRL' });
  const currencies = [...data.currencies, { symbol: 'COP$', sign: '$', name: 'Peso colombiano', type: 'Fiduciária', rateBRL: 0.001 }];
  assert.deepEqual(quoteRequest({ ...reserve, asset: 'COP', type: 'Investimento' }, currencies), { kind: 'currency', symbol: 'COP', currency: 'BRL' });
  assert.equal(quoteRequest({ ...reserve, asset: 'PETR4', currency: 'USD' }, data.currencies), null);
  assert.equal(quoteRequest({ ...reserve, asset: 'ATIVO1' }, data.currencies), null);
  assert.match(quoteUnavailableReason({ ...reserve, asset: '120% CDI', type: 'Caixinha CDI' }), /CDI/);
  assert.match(quoteUnavailableReason({ ...reserve, asset: 'BNO', type: 'ETFs', currency: 'USD' }), /ETF em moeda estrangeira/);
});

test('cotação atual é lida da planilha sem substituir a cotação usada', () => {
  const rows = [
    ['Ativo', 'Quantidade Ativo', 'Valor Reservado', 'Cotação Usada', 'Moeda', 'Cotação Atual'],
    ['BNO', 2, 100, 50, 'USD', 62.53],
    ['U1BE34', 1, 97.43, 97.43, 'R$', 93],
    ['COP', 5000, 8.77, 0.0017, 'R$', 0.001709362],
    ['120% CDI', 970, 970, 1, 'R$', 'Não aplicável'],
    ['USD', 15, 84.32, 5.47, 'R$', ''],
  ];
  const reserves = parseTable(rows, schemas.valueReserves.fields);
  assert.equal(reserves[0].usedRate, 50);
  assert.deepEqual(sheetQuote(reserves[0]), { price: 62.53, currency: 'USD' });
  const result = reserveResult(reserves[0], sheetQuote(reserves[0]));
  assert.equal(result.current, 125.06);
  assert.ok(Math.abs(result.difference - 25.06) < 0.00001);
  assert.equal(sheetQuote(reserves[1]).price, 93);
  assert.equal(sheetQuote(reserves[2]).price, 0.001709362);
  assert.equal(sheetQuote(reserves[3]), null);
  assert.equal(sheetQuote(reserves[4]), null);
  assert.equal(sheetQuote({ ...reserves[0], currentRate: 0 }), null);
  assert.equal(sheetQuote({ ...reserves[0], currentRate: Infinity }), null);
  assert.equal(sheetQuote({ ...reserves[0], currency: '' }), null);
  assert.equal(sheetQuote(parseTable([['Ativo', 'Moeda'], ['BNO', 'USD']], schemas.valueReserves.fields)[0]), null);
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
    globalThis.fetch = async () => ({ ok: false, status: 401 });
    await assert.rejects(getQuote({ kind: 'stock', symbol: 'U1BE34', currency: 'BRL' }), /acesso autorizado/);
    assert.equal(quoteStorage.size, 1);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    quoteStorage.clear();
  }
});

test('atividades aceitam o cabeçalho Obs da planilha', () => {
  const rows = [['Atividade', 'Viagem', 'Obs'], ['Passeio', 'Viagem A', 'Chegar cedo']];
  assert.equal(parseTable(rows, schemas.activities.fields)[0].notes, 'Chegar cedo');
});

test('lista usa cache isolado por origem por exatamente 24 horas', async () => {
  travelStorage.clear();
  travelCalls = [];
  scope = 'source-a';
  const originalNow = Date.now;
  let now = 1700000000000;
  Date.now = () => now;
  try {
    const first = await loadTravels();
    assert.equal(first.travels[0].name, 'Viagem A');
    assert.deepEqual(first.travels.map((travel) => travel.name), ['Viagem A', 'Viagem B', 'Sem data']);
    now += TRAVEL_CACHE_DURATION - 1;
    assert.deepEqual(await loadTravels(), first);
    assert.equal(travelCalls.length, 1);
    scope = 'source-b';
    await loadTravels();
    assert.equal(travelCalls.length, 2);
    scope = 'source-a';
    now++;
    assert.equal((await loadTravels()).fetchedAt, now);
    assert.equal(travelCalls.length, 3);
    travelStorage.set('travel-hunt:travels:v1:source-a', '{');
    await loadTravels();
    assert.equal(travelCalls.length, 4);
    await assert.rejects(loadTravelData('  '), /Informe a viagem/);
    assert.equal(travelCalls.length, 4);
  } finally {
    Date.now = originalNow;
    travelStorage.clear();
  }
});

test('cliente remoto usa rotas distintas e codifica a viagem', async () => {
  const originalUrl = process.env.EXPO_PUBLIC_SCRIPT_URL;
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  process.env.EXPO_PUBLIC_SCRIPT_URL = 'https://example.test/exec';
  globalThis.localStorage = { setItem: () => {}, getItem: () => null, removeItem: () => {} };
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok: true, json: async () => ({ abas: { 'Travels 🧳': [['Nome'], ['São Paulo & Rio']] } }) };
  };
  try {
    const remote = require('../src/services/remote.ts');
    const senha = '0123456789abcdef0123456789abcdef';
    const role = 'abcdef0123456789abcdef0123456789';
    await assert.rejects(remote.unlock('senha de teste'), /hash MD5 válido/);
    await remote.unlock(senha.toUpperCase());
    assert.equal(requests[0].url.searchParams.get('endpoint'), 'viagens');
    assert.equal(requests[0].url.searchParams.has('senha'), false);
    const first = await remote.fetchRemoteTabs('viagens');
    assert.equal(first.tabs['Travels 🧳'][1][0], 'São Paulo & Rio');
    assert.equal(requests.length, 1);
    await assert.rejects(remote.fetchRemoteTabs('viagem', ' '), /Informe a viagem/);
    await remote.fetchRemoteTabs('viagem', 'São Paulo & Rio');
    assert.equal(requests[1].url.searchParams.get('endpoint'), 'viagem');
    assert.equal(requests[1].url.searchParams.get('viagem'), 'São Paulo & Rio');
    assert.equal(requests[1].options.headers['Content-Type'], 'text/plain;charset=utf-8');
    assert.equal(JSON.parse(requests[1].options.body).senha, senha);
    await remote.enableEditing(role.toUpperCase());
    assert.equal(requests[2].url.searchParams.get('endpoint'), 'validar-edicao');
    assert.deepEqual(JSON.parse(requests[2].options.body), { senha, role });
    await remote.fetchRemoteTabs('viagem', 'São Paulo & Rio');
    assert.deepEqual(JSON.parse(requests[3].options.body), { senha, role, edicao: true });
    const change = { aba: 1, linha: 2, versao: 'version', alteracoes: [{ coluna: 2, valor: 'Novo' }, { coluna: 3, valor: 12 }] };
    await remote.saveItem(change);
    assert.equal(requests[4].url.searchParams.get('endpoint'), 'editar');
    assert.deepEqual(JSON.parse(requests[4].options.body), { senha, role, ...change });
    await assert.rejects(remote.enableEditing('role inválida'), /hash MD5 válido/);
  } finally {
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SCRIPT_URL;
    else process.env.EXPO_PUBLIC_SCRIPT_URL = originalUrl;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  }
});

test('entrada pela URL aceita hashes e remove as credenciais do endereço', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  const saved = new Map();
  const requests = [];
  let cleaned = '';
  let rejectRole = false;
  const senha = '0123456789abcdef0123456789abcdef';
  const role = 'abcdef0123456789abcdef0123456789';
  globalThis.localStorage = { setItem: (key, value) => saved.set(key, value), getItem: (key) => saved.get(key) ?? null, removeItem: (key) => saved.delete(key) };
  globalThis.window = { location: { href: `https://example.test/?apiKey=${senha}&role=${role}&view=1` }, history: { replaceState: (_state, _title, url) => { cleaned = url; } } };
  globalThis.fetch = async (url, options) => {
    requests.push({ endpoint: new URL(url).searchParams.get('endpoint'), body: JSON.parse(options.body) });
    return { ok: true, json: async () => rejectRole ? { erro: 'role' } : { abas: {}, edicao: true } };
  };
  try {
    const remote = require('../src/services/remote.ts');
    assert.equal(await remote.unlockFromUrl(), true);
    assert.equal(cleaned, '/?view=1');
    assert.deepEqual(requests, [{ endpoint: 'viagens', body: { senha } }, { endpoint: 'validar-edicao', body: { senha, role } }]);
    assert.equal(saved.get('travel-hunt:senha-md5'), senha);
    assert.equal(saved.get('travel-hunt:edicao-md5'), role);
    assert.equal(remote.canEdit(), true);
    globalThis.window.location.href = 'https://example.test/?role=invalida';
    assert.equal(await remote.unlockFromUrl(), true);
    assert.equal(cleaned, '/');
    assert.equal(remote.canEdit(), false);
    assert.equal(saved.has('travel-hunt:edicao-md5'), false);
    globalThis.window.location.href = `https://example.test/?role=${role}`;
    assert.equal(await remote.unlockFromUrl(), true);
    assert.equal(remote.canEdit(), true);
    rejectRole = true;
    assert.equal(await remote.unlockFromUrl(), true);
    assert.equal(remote.canEdit(), false);
    assert.equal(saved.has('travel-hunt:edicao-md5'), false);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    globalThis.window = originalWindow;
  }
});

test('edição encontra item único e protege vínculo e fórmulas', () => {
  const header = ['Cod. Atividade', 'Atividade', 'Viagem', 'Observações', 'Início'];
  const values = ['1', 'Museu', 'Viagem A', 'nota', 46500];
  const item = parseTable([header, values], schemas.activities.fields, [header, values])[0];
  const row = { numero: 2, versao: 'versao', cells: values.map((valor, index) => ({ valor, formula: index === 3 })) };
  const sheet = { id: 1, nome: 'Activities 🚶', cabecalho: header, linhas: [row] };
  const found = findEditItem([sheet], 'activities', item);
  assert.equal(found.row.numero, 2);
  assert.deepEqual(found.fields.map((field) => field.key), ['code', 'start', 'title']);
  assert.throws(() => findEditItem([{ ...sheet, linhas: [row, { ...row, numero: 3 }] }], 'activities', item), /segurança/);
  assert.throws(() => findEditItem([{ ...sheet, linhas: [{ ...row, cells: row.cells.map((cell, index) => index === 1 ? { ...cell, valor: 'Alterada' } : cell) }] }], 'activities', item), /segurança/);
  assert.throws(() => findEditItem([sheet], 'activities', { ...item }), /desatualizados/);
  const travelHeader = ['Nome', 'Data Inicial', 'ID'];
  const travelValues = ['Viagem A', 46500, 'id'];
  const travel = parseTable([travelHeader, travelValues], schemas.travels.fields, [travelHeader, travelValues])[0];
  const travelSheet = { id: 2, nome: 'Travels 🧳', cabecalho: travelHeader, linhas: [{ numero: 2, versao: 'v', cells: travelValues.map((valor) => ({ valor, formula: false })) }] };
  assert.deepEqual(findEditItem([travelSheet], 'travels', travel).fields.map((field) => field.key), ['startDate']);
  const linkHeader = ['Atividade', 'Viagem', 'Reserva'];
  const original = ['Museu', 'Viagem A', 'bilhete.pdf'];
  const shown = ['Museu', 'Viagem A', 'https://example.test/bilhete.pdf'];
  const linked = parseTable([linkHeader, shown], schemas.activities.fields, [linkHeader, original])[0];
  const linkedSheet = { id: 3, nome: 'Activities', cabecalho: linkHeader, linhas: [
    { numero: 2, versao: 'v', cells: ['Museu', 'Viagem A', 'outro.pdf'].map((valor) => ({ valor, formula: false })) },
    { numero: 3, versao: 'v', cells: original.map((valor) => ({ valor, formula: false })) },
  ] };
  assert.equal(findEditItem([linkedSheet], 'activities', linked).row.numero, 3);
});