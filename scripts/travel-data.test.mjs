import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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