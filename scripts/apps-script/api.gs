// Cole no mesmo projeto do Apps Script (Extensões > Apps Script), em um arquivo separado.
// Publica a planilha como Web App protegido por senha: o site pede os dados aqui, sem chave de API.
// POST <url>/exec?endpoint=viagens ou ?endpoint=viagem&viagem=<nome>, com corpo {"senha": "<MD5 da senha>"}.
//
// Passos: 1) Configurações do projeto > Propriedades do script > adicione SENHA com uma frase longa.
// 2) Implantar > Nova implantação > Tipo "App da Web" > Executar como "Eu" > Acesso "Qualquer pessoa".
// 3) Copie a URL terminada em /exec. Ao mudar este código, crie uma nova versão da implantação.

const EPOCA_SHEETS = Date.UTC(1899, 11, 30);
const ARQUIVO = /\.(pdf|png|jpe?g|webp)$/i;
const CACHE_SEGUNDOS = 600;

function doGet() {
  return resposta({ erro: 'Use POST.' });
}

function doPost(e) {
  const iniciado = Date.now();
  let enviada = '';
  try {
    enviada = String(JSON.parse(e.postData.contents).senha || '').toLowerCase();
  } catch (err) {
    // corpo inválido: tratado como senha vazia
  }

  const senha = PropertiesService.getScriptProperties().getProperty('SENHA');
  if (!senha || !iguais(enviada, md5(senha))) {
    Utilities.sleep(2000); // dificulta tentativas em série
    return resposta({ erro: 'senha' });
  }
  const endpoint = e.parameter && e.parameter.endpoint;
  const viagem = String((e.parameter && e.parameter.viagem) || '').trim();
  if (endpoint !== 'viagens' && endpoint !== 'viagem') return resposta({ erro: 'Endpoint inválido.' });
  if (endpoint === 'viagem' && !viagem) return resposta({ erro: 'Informe a viagem.' });
  const metricas = { endpoint, abasEmCache: 0, chipsEmCache: false, driveMs: 0 };
  const abas = lerAbas(endpoint, viagem, metricas);
  metricas.totalMs = Date.now() - iniciado;
  console.log(JSON.stringify({ evento: 'travel-hunt-desempenho', ...metricas }));
  return resposta({ atualizadoEm: new Date().toISOString(), abas });
}

function md5(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, texto, Utilities.Charset.UTF_8)
    .map((b) => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'))
    .join('');
}

function resposta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

// Compara sem parar no primeiro caractere diferente.
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function chaveCache(tipo, valor) {
  return `travel-hunt:v1:${tipo}:${md5(JSON.stringify(valor))}`;
}

function lerCache(chave) {
  try {
    const valor = CacheService.getScriptCache().get(chave);
    return valor === null ? null : JSON.parse(valor);
  } catch (e) {
    return null;
  }
}

function salvarCache(chave, valor) {
  try {
    CacheService.getScriptCache().put(chave, JSON.stringify(valor), CACHE_SEGUNDOS);
  } catch (e) {}
}

function lerValores(ss, sheets, fuso, metricas) {
  if (!sheets.length) return {};
  const valores = {};
  const pendentes = sheets.filter((sheet) => {
    if (!/^(locals|coordenadas|currency)/i.test(sheet.getName().trim())) return true;
    const cached = lerCache(chaveCache('aba', [ss.getId(), sheet.getName()]));
    if (!Array.isArray(cached) || !cached.every(Array.isArray)) return true;
    metricas.abasEmCache++;
    valores[sheet.getName()] = cached;
    return false;
  });
  if (!pendentes.length) return valores;
  let lidas;
  try {
    const ranges = pendentes.map((sheet) => `'${sheet.getName().replace(/'/g, "''")}'`);
    const result = Sheets.Spreadsheets.Values.batchGet(ss.getId(), {
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    });
    if (!result.valueRanges || result.valueRanges.length !== pendentes.length) throw new Error('Resposta incompleta do Sheets.');
    lidas = Object.fromEntries(pendentes.map((sheet, index) => [sheet.getName(), result.valueRanges[index].values || []]));
  } catch (e) {
    metricas.leituraAlternativa = true;
    lidas = Object.fromEntries(pendentes.map((sheet) => [sheet.getName(), sheet.getDataRange().getValues()]));
  }
  pendentes.forEach((sheet) => {
    const nome = sheet.getName();
    valores[nome] = lidas[nome].map((row) => row.map((cell) => cell instanceof Date ? serial(cell, fuso) : cell));
    if (/^(locals|coordenadas|currency)/i.test(nome.trim())) salvarCache(chaveCache('aba', [ss.getId(), nome]), valores[nome]);
  });
  return valores;
}

function lerAbas(endpoint, viagem, metricas) {
  const inicioLeitura = Date.now();
  const ss = SpreadsheetApp.getActive();
  const fuso = ss.getSpreadsheetTimeZone();
  const sheets = ss.getSheets().filter((sheet) => endpoint !== 'viagens' || sheet.getName().trim().toLowerCase().startsWith('travels'));
  const valores = lerValores(ss, sheets, fuso, metricas);
  metricas.leituraMs = Date.now() - inicioLeitura;
  const inicioFiltro = Date.now();
  const selecionadas = {};
  sheets.forEach((sheet) => {
    const nome = sheet.getName();
    const rows = valores[nome];
    const header = rows[0] || [];
    const viagemColumn = header.findIndex((column) => String(column).trim().toLowerCase() === 'viagem');
    const nomeColumn = nome.trim().toLowerCase().startsWith('travels')
      ? header.findIndex((column) => String(column).trim().toLowerCase() === 'nome') : -1;
    const filterColumn = viagemColumn >= 0 ? viagemColumn : nomeColumn;
    const requerFiltro = ['travels', 'activities', 'money', 'fly', 'hotel', 'food', 'transport']
      .some((prefixo) => nome.trim().toLowerCase().startsWith(prefixo));
    const filler = new Set(['viagem', 'id', 'cod. atividade', 'cod. reserva', 'cod ref', 'reservado (ticket/valor)']);
    selecionadas[nome] = rows.map((row, index) => ({ row, index })).filter(({ row, index }) => {
      if (index === 0) return true;
      if (endpoint === 'viagem' && (filterColumn >= 0 || requerFiltro) &&
          (filterColumn < 0 || String(row[filterColumn] || '').trim() !== viagem)) return false;
      return row.some((value, column) => !filler.has(String(header[column] || '').trim().toLowerCase()) && value !== '' && value !== null && value !== undefined);
    });
  });
  if (endpoint === 'viagem') {
    const moneyName = Object.keys(selecionadas).find((name) => name.trim().toLowerCase().startsWith('money'));
    const reserveName = Object.keys(selecionadas).find((name) => name.trim().toLowerCase().startsWith('valuereserve'));
    if (reserveName) {
      const money = selecionadas[moneyName] || [];
      const reserves = selecionadas[reserveName];
      const referenceColumn = (money[0]?.row || []).findIndex((column) => String(column).trim().toLowerCase() === 'reserva de valor');
      const assetColumn = (reserves[0]?.row || []).findIndex((column) => String(column).trim().toLowerCase() === 'ativo');
      if (referenceColumn >= 0 && assetColumn >= 0) {
        const assets = new Set(money.slice(1).flatMap(({ row }) => String(row[referenceColumn] || '').split(',').map((asset) => asset.trim().toUpperCase()).filter(Boolean)));
        selecionadas[reserveName] = [reserves[0], ...reserves.slice(1).filter(({ row }) => assets.has(String(row[assetColumn] || '').trim().toUpperCase()))];
      } else {
        selecionadas[reserveName] = reserves.slice(0, 1);
      }
    }
  }
  const ranges = [];
  Object.keys(selecionadas).forEach((nome) => {
    const columns = new Map();
    selecionadas[nome].slice(1).forEach(({ row, index }) => row.forEach((value, column) => {
      if (typeof value !== 'string' || !value.trim()) return;
      const bounds = columns.get(column) || [index, index];
      bounds[1] = index;
      columns.set(column, bounds);
    }));
    columns.forEach(([first, last], column) => {
      let numero = column + 1;
      let letra = '';
      while (numero > 0) {
        numero--;
        letra = String.fromCharCode(65 + numero % 26) + letra;
        numero = Math.floor(numero / 26);
      }
      ranges.push(`'${nome.replace(/'/g, "''")}'!${letra}${first + 1}:${letra}${last + 1}`);
    });
  });
  metricas.filtroMs = Date.now() - inicioFiltro;
  const inicioChips = Date.now();
  const assinatura = Object.keys(selecionadas).map((nome) => [nome, selecionadas[nome].map(({ row, index }) => [index, row.map((value) => typeof value === 'string' ? value : null)])]);
  const chaveLinks = chaveCache('chips', [ss.getId(), ranges, assinatura]);
  let links = lerCache(chaveLinks);
  metricas.chipsEmCache = !!links;
  if (!links || typeof links !== 'object' || Array.isArray(links)) {
    links = ranges.length ? linksDosChips(ss, false, ranges) : {};
    if (ranges.length && links !== null) salvarCache(chaveLinks, links);
  }
  links = links || {};
  metricas.chipsMs = Date.now() - inicioChips;
  const inicioConversao = Date.now();
  const linkPorNome = {};
  const abas = {};
  Object.keys(selecionadas).forEach((nome) => {
    abas[nome] = selecionadas[nome].map(({ row, index }) => row.map((celula, column) => {
      const uri = links[nome] && links[nome][index] && links[nome][index][column];
      if (uri) return uri;
      if (typeof celula === 'string' && ARQUIVO.test(celula.trim())) return urlDoArquivo(celula.trim(), ss.getId(), linkPorNome, metricas);
      return celula instanceof Date ? serial(celula, fuso) : celula;
    }));
  });
  metricas.conversaoMs = Date.now() - inicioConversao;
  return abas;
}

// O valor de um chip de arquivo do Drive é só o nome; o link vem do serviço avançado "Google Sheets API"
// (Serviços > + > Google Sheets API). Sem ele, os chips continuam devolvendo só o nome.
function linksDosChips(ss, mostrarErro, ranges) {
  const out = {};
  try {
    const options = {
      includeGridData: true,
      fields: 'sheets(properties/title,data(startRow,startColumn,rowData/values/chipRuns))',
    };
    if (ranges) options.ranges = ranges;
    const grade = Sheets.Spreadsheets.get(ss.getId(), options);
    (grade.sheets || []).forEach((s) => {
      const mapa = {};
      (s.data || []).forEach((grade) => (grade.rowData || []).forEach((linha, r) =>
        (linha.values || []).forEach((cel, c) => {
          const run = (cel.chipRuns || []).find(
            (x) => x.chip && x.chip.richLinkProperties && x.chip.richLinkProperties.uri,
          );
          if (run) {
            const row = (grade.startRow || 0) + r;
            const column = (grade.startColumn || 0) + c;
            mapa[row] = mapa[row] || {};
            mapa[row][column] = run.chip.richLinkProperties.uri;
          }
        }),
      ));
      out[s.properties.title] = mapa;
    });
  } catch (e) {
    if (mostrarErro) throw e;
    return null;
  }
  return out;
}

// Alternativa sem o serviço avançado: o valor da célula é o nome do arquivo, então procuramos no Drive por ele.
// Usa o primeiro arquivo com esse nome que a sua conta enxerga; se não achar, devolve o nome.
function urlDoArquivo(nome, spreadsheetId, linkPorNome, metricas) {
  if (!(nome in linkPorNome)) {
    const chave = chaveCache('arquivo', [spreadsheetId, nome]);
    const cached = lerCache(chave);
    if (typeof cached === 'string' && cached) {
      linkPorNome[nome] = cached;
      return cached;
    }
    const inicio = Date.now();
    try {
      const arquivos = DriveApp.getFilesByName(nome);
      linkPorNome[nome] = arquivos.hasNext() ? arquivos.next().getUrl() : nome;
      if (linkPorNome[nome] !== nome) salvarCache(chave, linkPorNome[nome]);
    } catch (e) {
      linkPorNome[nome] = nome;
    } finally {
      metricas.driveMs += Date.now() - inicio;
    }
  }
  return linkPorNome[nome];
}

// Execute no editor para conferir: mostra os links de chips achados (ou o erro, se o serviço não estiver ativo).
function testarLinks() {
  const links = linksDosChips(SpreadsheetApp.getActive(), true);
  Logger.log(JSON.stringify(links));
}

// Execute no editor: pede a autorização do Drive (obrigatória) e mostra o que foi achado para cada arquivo.
function testarArquivos() {
  SpreadsheetApp.getActive()
    .getSheets()
    .forEach((sheet) =>
      sheet.getDataRange().getValues().forEach((linha) =>
        linha.forEach((celula) => {
          if (typeof celula !== 'string' || !ARQUIVO.test(celula.trim())) return;
          const arquivos = DriveApp.getFilesByName(celula.trim());
          Logger.log(celula.trim() + ' -> ' + (arquivos.hasNext() ? arquivos.next().getUrl() : 'NÃO ENCONTRADO'));
        }),
      ),
    );
}

// Data/hora -> número serial do Sheets (dias desde 30/12/1899), como a API entrega.
function serial(data, fuso) {
  const p = Utilities.formatDate(data, fuso, 'yyyy-MM-dd-HH-mm-ss').split('-').map(Number);
  return (Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]) - EPOCA_SHEETS) / 86400000;
}
