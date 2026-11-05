import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./apps-script/api.gs', import.meta.url), 'utf8');

function service(changeRows = () => {}) {
  const rows = {
    'Travels 🧳': [['Nome', 'Data Inicial'], ['Viagem A', 46596], ['Viagem B', 46423]],
    'Money 💴': [['Viagem', 'Reserva de Valor'], ['Viagem A', 'COP, U1BE34'], ['Viagem B', 'BNO']],
    'Activities 🚶': [['Atividade', 'Viagem'], ['Museu', 'Viagem A'], ['Praça', 'Viagem B'], ['', 'Viagem A']],
    'ValueReserve 🏦': [['Ativo', 'Quantidade Ativo'], ['COP', 5000], ['U1BE34', 1], ['BNO', 1]],
    'Currency 🪙': [['Sigla'], ['R$'], ['COP$']],
  };
  changeRows(rows);
  const reads = [];
  const sheets = Object.entries(rows).map(([name, values]) => ({
    getName: () => name,
    getDataRange: () => ({ getValues: () => { reads.push(name); return values; } }),
  }));
  const spreadsheet = { getSheets: () => sheets, getSpreadsheetTimeZone: () => 'UTC', getId: () => 'id' };
  const context = vm.createContext({
    SpreadsheetApp: { getActive: () => spreadsheet },
    Sheets: { Spreadsheets: { get: () => ({ sheets: [] }) } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'senha' }) },
    Utilities: { sleep: () => {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(source, context);
  context.md5 = () => 'hash';
  const post = (parameter, senha = 'hash') => context.doPost({ parameter, postData: { contents: JSON.stringify({ senha }) } });
  return { post, reads };
}

test('endpoint de viagens consulta somente a aba de viagens', () => {
  const { post, reads } = service();
  const result = post({ endpoint: 'viagens' });
  assert.deepEqual(Object.keys(result.abas), ['Travels 🧳']);
  assert.equal(result.abas['Travels 🧳'].length, 3);
  assert.deepEqual(reads, ['Travels 🧳']);
});

test('detalhes exigem viagem e filtram linhas e reservas vinculadas', () => {
  const { post } = service();
  assert.equal(post({ endpoint: 'viagem' }).erro, 'Informe a viagem.');
  assert.equal(post({ endpoint: 'viagens' }, 'errada').erro, 'senha');
  const abas = post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas;
  assert.deepEqual(abas['Travels 🧳'].map((row) => row[0]), ['Nome', 'Viagem A']);
  assert.deepEqual(abas['Money 💴'].map((row) => row[0]), ['Viagem', 'Viagem A']);
  assert.deepEqual(abas['ValueReserve 🏦'].map((row) => row[0]), ['Ativo', 'COP', 'U1BE34']);
  assert.equal(abas['Currency 🪙'].length, 3);
  const other = post({ endpoint: 'viagem', viagem: 'Viagem B' }).abas;
  assert.deepEqual(other['ValueReserve 🏦'].map((row) => row[0]), ['Ativo', 'BNO']);
  assert.deepEqual(other['Activities 🚶'].map((row) => row[0]), ['Atividade', 'Praça']);
  assert.equal(post({ endpoint: 'outro' }).erro, 'Endpoint inválido.');
});

test('reservas sem coluna de vínculo ou sem despesas não são compartilhadas', () => {
  const missingColumn = service((rows) => { rows['Money 💴'][0][1] = 'Outra coluna'; });
  assert.equal(missingColumn.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas['ValueReserve 🏦'].length, 1);
  const missingMoney = service((rows) => { delete rows['Money 💴']; });
  assert.equal(missingMoney.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas['ValueReserve 🏦'].length, 1);
});

test('abas específicas sem coluna de viagem não retornam linhas de outras viagens', () => {
  const missingColumn = service((rows) => { rows['Activities 🚶'][0][1] = 'Outra coluna'; });
  assert.equal(missingColumn.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas['Activities 🚶'].length, 1);
  const missingName = service((rows) => { rows['Travels 🧳'][0][0] = 'Outro nome'; });
  assert.equal(missingName.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas['Travels 🧳'].length, 1);
});