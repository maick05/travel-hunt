import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./apps-script/api.gs', import.meta.url), 'utf8');

function service(changeRows = () => {}, useBatch = false, chipSheets = [], options = {}) {
  const rows = {
    'Travels 🧳': [['Nome', 'Data Inicial'], ['Viagem A', 46596], ['Viagem B', 46423]],
    'Money 💴': [['Viagem', 'Reserva de Valor'], ['Viagem A', 'COP, U1BE34'], ['Viagem B', 'BNO']],
    'Activities 🚶': [['Atividade', 'Viagem'], ['Museu', 'Viagem A'], ['Praça', 'Viagem B'], ['', 'Viagem A']],
    'ValueReserve 🏦': [['Ativo', 'Quantidade Ativo'], ['COP', 5000], ['U1BE34', 1], ['BNO', 1]],
    'Currency 🪙': [['Sigla'], ['R$'], ['COP$']],
  };
  changeRows(rows);
  const reads = [];
  const chipRequests = [];
  const batchRequests = [];
  const logs = [];
  const cache = new Map();
  let time = 0;
  let chipFailures = options.chipFailures || 0;
  let driveCalls = 0;
  const sheets = Object.entries(rows).map(([name, values]) => ({
    getName: () => name,
    getDataRange: () => ({ getValues: () => { reads.push(name); return values; } }),
  }));
  const spreadsheet = { getSheets: () => sheets, getSpreadsheetTimeZone: () => 'UTC', getId: () => 'id' };
  const context = vm.createContext({
    SpreadsheetApp: { getActive: () => spreadsheet },
    CacheService: { getScriptCache: () => {
      if (options.cacheFailure) throw new Error('indisponível');
      return {
      get: (key) => { const entry = cache.get(key); return entry && entry.expires > time ? entry.value : null; },
      put: (key, value, ttl) => cache.set(key, { value, expires: time + ttl * 1000 }),
      };
    } },
    DriveApp: { getFilesByName: (name) => {
      driveCalls++;
      if (options.driveFailure && driveCalls === 1) throw new Error('indisponível');
      return { hasNext: () => true, next: () => ({ getUrl: () => `https://example.test/${name}` }) };
    } },
    console: { log: (message) => logs.push(JSON.parse(message)) },
    Sheets: { Spreadsheets: {
      get: (_id, params) => {
        chipRequests.push(params);
        if (chipFailures > 0) { chipFailures--; throw new Error('indisponível'); }
        return { sheets: chipSheets };
      },
      ...(useBatch ? { Values: { batchGet: (_id, options) => {
        reads.push('batch');
        batchRequests.push(options.ranges);
        return { valueRanges: options.ranges.map((range) => ({ values: rows[range.slice(1, -1).replace(/''/g, "'")] })) };
      } } } : {}),
    } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'senha' }) },
    Utilities: { sleep: () => {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(source, context);
  context.md5 = (text) => text === 'senha' ? 'hash' : createHash('md5').update(text).digest('hex');
  const post = (parameter, senha = 'hash') => context.doPost({ parameter, postData: { contents: JSON.stringify({ senha }) } });
  return { post, reads, rows, chipRequests, batchRequests, logs, advance: (milliseconds) => { time += milliseconds; }, getDriveCalls: () => driveCalls };
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

test('leitura em lote mantém o resultado e evita leituras individuais', () => {
  const batched = service(() => {}, true);
  const fallback = service();
  assert.deepEqual(batched.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas, fallback.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas);
  assert.deepEqual(batched.reads, ['batch']);
});

test('chips em faixas descontínuas mantêm a linha e coluna originais', () => {
  const chip = (uri) => ({ chipRuns: [{ chip: { richLinkProperties: { uri } } }] });
  const instance = service((rows) => {
    rows['Activities 🚶'] = [['Atividade', 'Viagem', 'Reserva'], ['Outro', 'Viagem B', 'outro.pdf'], ['Museu', 'Viagem A', 'Reserva'], ['', 'Viagem A', '']];
  }, true, [{ properties: { title: 'Activities 🚶' }, data: [
    { startRow: 2, startColumn: 2, rowData: [{ values: [chip('https://example.test/museu')] }] },
  ] }]);
  const result = instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  assert.deepEqual(result.abas['Activities 🚶'], [['Atividade', 'Viagem', 'Reserva'], ['Museu', 'Viagem A', 'https://example.test/museu']]);
  assert.ok(instance.chipRequests[0].ranges.includes("'Activities 🚶'!C3:C3"));
  assert.ok(!instance.chipRequests[0].ranges.includes("'Activities 🚶'!C2:C3"));
});

test('cache expira em 10 minutos e mantém despesas e cotações atuais', () => {
  const instance = service((rows) => { rows['ValueReserve 🏦'][0].push('Cotação Atual'); rows['ValueReserve 🏦'][1].push(2); }, true);
  const first = instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  instance.rows['Currency 🪙'][1][0] = 'BRL';
  instance.rows['ValueReserve 🏦'][1][2] = 3;
  const second = instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  assert.equal(first.abas['Currency 🪙'][1][0], 'R$');
  assert.equal(second.abas['Currency 🪙'][1][0], 'R$');
  assert.equal(second.abas['ValueReserve 🏦'][1][2], 3);
  assert.ok(instance.batchRequests[0].includes("'Currency 🪙'"));
  assert.ok(!instance.batchRequests[1].includes("'Currency 🪙'"));
  assert.equal(instance.logs[1].abasEmCache, 1);
  assert.equal(instance.logs[1].chipsEmCache, true);
  assert.ok(!JSON.stringify(instance.logs).includes('Viagem A'));
  instance.advance(600000);
  assert.equal(instance.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas['Currency 🪙'][1][0], 'BRL');
});

test('locais e coordenadas são compartilhados até o cache expirar', () => {
  const instance = service((rows) => {
    rows['Locals 🌍'] = [['Local'], ['Cidade']];
    rows['Coordenadas 📍'] = [['Nome'], ['Lugar']];
  }, true);
  instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  instance.rows['Locals 🌍'][1][0] = 'Nova cidade';
  instance.rows['Coordenadas 📍'][1][0] = 'Novo lugar';
  const cached = instance.post({ endpoint: 'viagem', viagem: 'Viagem B' }).abas;
  assert.equal(cached['Locals 🌍'][1][0], 'Cidade');
  assert.equal(cached['Coordenadas 📍'][1][0], 'Lugar');
  instance.advance(600000);
  const refreshed = instance.post({ endpoint: 'viagem', viagem: 'Viagem B' }).abas;
  assert.equal(refreshed['Locals 🌍'][1][0], 'Nova cidade');
  assert.equal(refreshed['Coordenadas 📍'][1][0], 'Novo lugar');
});

test('erros temporários na leitura de chips e arquivos não são guardados no cache', () => {
  const instance = service((rows) => { rows['Activities 🚶'][1][0] = 'museu.pdf'; }, true, [], { chipFailures: 1, driveFailure: true });
  const first = instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  const second = instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  assert.equal(first.abas['Activities 🚶'][1][0], 'museu.pdf');
  assert.equal(second.abas['Activities 🚶'][1][0], 'https://example.test/museu.pdf');
  assert.equal(instance.chipRequests.length, 2);
  assert.equal(instance.getDriveCalls(), 2);
});

test('cache não mistura viagens nem dispensa autenticação', () => {
  const chip = (uri) => ({ chipRuns: [{ chip: { richLinkProperties: { uri } } }] });
  const instance = service((rows) => {
    rows['Activities 🚶'] = [['Atividade', 'Viagem', 'Reserva'], ['Museu', 'Viagem A', 'A'], ['Praça', 'Viagem B', 'B']];
  }, true, [{ properties: { title: 'Activities 🚶' }, data: [
    { startRow: 1, startColumn: 2, rowData: [{ values: [chip('https://example.test/a')] }, { values: [chip('https://example.test/b')] }] },
  ] }]);
  assert.equal(instance.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas['Activities 🚶'][1][2], 'https://example.test/a');
  assert.equal(instance.post({ endpoint: 'viagem', viagem: 'Viagem B' }).abas['Activities 🚶'][1][2], 'https://example.test/b');
  const reads = instance.reads.length;
  assert.equal(instance.post({ endpoint: 'viagem', viagem: 'Viagem A' }, 'errada').erro, 'senha');
  assert.equal(instance.reads.length, reads);
});

test('serviço continua funcionando quando o cache está indisponível', () => {
  const instance = service(() => {}, true, [], { cacheFailure: true });
  const first = instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  assert.deepEqual(instance.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas, first.abas);
  assert.equal(instance.chipRequests.length, 2);
  assert.ok(instance.batchRequests[1].includes("'Currency 🪙'"));
});