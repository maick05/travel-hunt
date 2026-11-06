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
  const sheets = Object.entries(rows).map(([name, values], index) => ({
    getName: () => name,
    getSheetId: () => index + 1,
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    getDataRange: () => ({ getValues: () => { reads.push(name); return values; }, getFormulas: () => values.map((row) => row.map((cell) => typeof cell === 'string' && cell.startsWith('=') ? cell : '')) }),
    getRange: (row, column, _height, width = 1) => ({
      getValues: () => [values[row - 1].slice(column - 1, column - 1 + width)],
      getFormulas: () => [values[row - 1].slice(column - 1, column - 1 + width).map((cell) => typeof cell === 'string' && cell.startsWith('=') ? cell : '')],
      setValue: (value) => { values[row - 1][column - 1] = value; },
    }),
  }));
  const spreadsheet = { getSheets: () => sheets, getSpreadsheetTimeZone: () => 'UTC', getId: () => 'id' };
  const context = vm.createContext({
    SpreadsheetApp: { getActive: () => spreadsheet, flush: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => {
      if (options.cacheFailure) throw new Error('indisponível');
      return {
      get: (key) => { const entry = cache.get(key); return entry && entry.expires > time ? entry.value : null; },
      put: (key, value, ttl) => cache.set(key, { value, expires: time + ttl * 1000 }),
      remove: (key) => cache.delete(key),
      };
    } },
    DriveApp: { getFilesByName: (name) => {
      driveCalls++;
      if (options.driveFailure && driveCalls === 1) throw new Error('indisponível');
      return { hasNext: () => true, next: () => ({ getUrl: () => `https://example.test/${name}` }) };
    } },
    console: { log: (message) => logs.push(JSON.parse(message)) },
    Sheets: { Spreadsheets: {
      batchUpdate: ({ requests }) => {
        for (const { updateCells } of requests) {
          const sheet = sheets.find((item) => item.getSheetId() === updateCells.start.sheetId);
          const entry = updateCells.rows[0].values[0].userEnteredValue;
          sheet.getRange(updateCells.start.rowIndex + 1, updateCells.start.columnIndex + 1).setValue(entry.numberValue ?? entry.boolValue ?? entry.stringValue);
        }
      },
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
    PropertiesService: { getScriptProperties: () => ({ getProperty: (name) => name === 'SENHA' ? 'senha' : options.role }) },
    Utilities: { sleep: () => {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(source, context);
  context.md5 = (text) => text === 'senha' ? 'hash' : createHash('md5').update(text).digest('hex');
  const post = (parameter, senha = 'hash', role, extra = {}) => context.doPost({ parameter, postData: { contents: JSON.stringify({ senha, role, ...extra }) } });
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

test('validação de edição exige as duas credenciais e uma role configurada', () => {
  const instance = service(() => {}, false, [], { role: 'editor' });
  const role = createHash('md5').update('editor').digest('hex');
  assert.equal(instance.post({ endpoint: 'validar-edicao' }, 'errada', role).erro, 'senha');
  assert.equal(instance.post({ endpoint: 'validar-edicao' }, 'hash').erro, 'role');
  assert.equal(instance.post({ endpoint: 'validar-edicao' }, 'hash', 'incorreta').erro, 'role');
  assert.equal(instance.post({ endpoint: 'validar-edicao' }, 'hash', role).edicao, true);
  assert.equal(service().post({ endpoint: 'validar-edicao' }, 'hash', role).erro, 'role');
  assert.deepEqual(instance.reads, []);
});

test('edição valida credenciais, conflito e fórmulas antes de alterar uma célula', () => {
  const instance = service((rows) => { rows['Activities 🚶'][0].push('Calculado'); rows['Activities 🚶'][1].push('=TODAY()'); }, false, [], { role: 'editor' });
  const role = createHash('md5').update('editor').digest('hex');
  const data = instance.post({ endpoint: 'dados-edicao' }, 'hash', role);
  const sheet = data.abas.find((item) => item.nome === 'Activities 🚶');
  const version = sheet.linhas[0].versao;
  const request = { aba: sheet.id, linha: 2, coluna: 1, versao: version, valor: 'Novo passeio' };
  assert.equal(instance.post({ endpoint: 'editar' }, 'hash', 'errada', request).erro, 'role');
  assert.equal(instance.post({ endpoint: 'dados-edicao' }, 'hash', 'errada').erro, 'role');
  assert.equal(instance.post({ endpoint: 'editar' }, 'errada', role, request).erro, 'senha');
  assert.equal(instance.post({ endpoint: 'editar' }, 'hash', role, { ...request, valor: '=1+1' }).erro, 'Alteração inválida.');
  assert.equal(instance.post({ endpoint: 'editar' }, 'hash', role, { ...request, coluna: 3 }).erro, 'Células com fórmula não podem ser alteradas.');
  assert.match(instance.post({ endpoint: 'editar' }, 'hash', role, { ...request, coluna: 2 }).erro, /identificação da viagem/);
  assert.equal(instance.post({ endpoint: 'editar' }, 'hash', role, request).alterado, true);
  assert.equal(instance.rows['Activities 🚶'][1][0], 'Novo passeio');
  assert.match(instance.post({ endpoint: 'editar' }, 'hash', role, request).erro, /alterada/);
  assert.equal(instance.rows['Activities 🚶'][1][2], '=TODAY()');
});

test('edição protege nome e identificação da viagem', () => {
  const instance = service((rows) => { rows['Travels 🧳'][0].push('ID'); rows['Travels 🧳'][1].push('123'); }, false, [], { role: 'editor' });
  const role = createHash('md5').update('editor').digest('hex');
  const sheet = instance.post({ endpoint: 'dados-edicao' }, 'hash', role).abas[0];
  for (const coluna of [1, 3]) {
    assert.match(instance.post({ endpoint: 'editar' }, 'hash', role, { aba: sheet.id, linha: 2, coluna, versao: sheet.linhas[0].versao, valor: 'outro' }).erro, /identificação da viagem/);
  }
});

test('edição detecta alteração no cabeçalho e invalida cache da aba compartilhada', () => {
  const instance = service(() => {}, true, [], { role: 'editor' });
  const role = createHash('md5').update('editor').digest('hex');
  instance.post({ endpoint: 'viagem', viagem: 'Viagem A' });
  const sheet = instance.post({ endpoint: 'dados-edicao' }, 'hash', role).abas.find((item) => item.nome === 'Currency 🪙');
  const request = { aba: sheet.id, linha: 2, coluna: 1, versao: sheet.linhas[0].versao, valor: 'BRL' };
  instance.rows['Currency 🪙'][0][0] = 'Código';
  assert.match(instance.post({ endpoint: 'editar' }, 'hash', role, request).erro, /alterada/);
  instance.rows['Currency 🪙'][0][0] = 'Sigla';
  assert.equal(instance.post({ endpoint: 'editar' }, 'hash', role, request).alterado, true);
  assert.equal(instance.post({ endpoint: 'viagem', viagem: 'Viagem A' }).abas['Currency 🪙'][1][0], 'BRL');
});

test('edição conjunta valida todos os campos antes de gravar', () => {
  const instance = service((rows) => { rows['Activities 🚶'][0].push('Status'); rows['Activities 🚶'][1].push('Pendente'); }, false, [], { role: 'editor' });
  const role = createHash('md5').update('editor').digest('hex');
  const sheet = instance.post({ endpoint: 'dados-edicao' }, 'hash', role).abas.find((item) => item.nome === 'Activities 🚶');
  const request = { aba: sheet.id, linha: 2, versao: sheet.linhas[0].versao, alteracoes: [{ coluna: 1, valor: 'Novo' }, { coluna: 2, valor: 'Outra viagem' }] };
  assert.match(instance.post({ endpoint: 'editar' }, 'hash', role, request).erro, /identificação da viagem/);
  assert.equal(instance.rows['Activities 🚶'][1][0], 'Museu');
  request.alteracoes[1] = { coluna: 3, valor: 'Confirmado' };
  assert.equal(instance.post({ endpoint: 'editar' }, 'hash', role, request).alterado, true);
  assert.deepEqual(instance.rows['Activities 🚶'][1], ['Novo', 'Viagem A', 'Confirmado']);
  assert.match(instance.post({ endpoint: 'editar' }, 'hash', role, request).erro, /alterada/);
});

test('dados originais para edição exigem role e preservam valores antes da conversão', () => {
  const instance = service((rows) => { rows['Activities 🚶'][1][0] = 'museu.pdf'; }, true, [], { role: 'editor' });
  const role = createHash('md5').update('editor').digest('hex');
  const params = { endpoint: 'viagem', viagem: 'Viagem A' };
  assert.equal(instance.post(params, 'hash', 'errada', { edicao: true }).origens, undefined);
  const result = instance.post(params, 'hash', role, { edicao: true });
  assert.equal(result.abas['Activities 🚶'][1][0], 'https://example.test/museu.pdf');
  assert.equal(result.origens['Activities 🚶'][1][0], 'museu.pdf');
});