// Cole no mesmo projeto do Apps Script (Extensões > Apps Script), em um arquivo separado.
// Publica a planilha como Web App protegido por senha: o site pede os dados aqui, sem chave de API.
// A chamada é POST <url>/exec com corpo {"senha": "<MD5 da senha em hexadecimal minúsculo>"}.
//
// Passos: 1) Configurações do projeto > Propriedades do script > adicione SENHA com uma frase longa.
// 2) Implantar > Nova implantação > Tipo "App da Web" > Executar como "Eu" > Acesso "Qualquer pessoa".
// 3) Copie a URL terminada em /exec. Ao mudar este código, crie uma nova versão da implantação.

const EPOCA_SHEETS = Date.UTC(1899, 11, 30);
const ARQUIVO = /\.(pdf|png|jpe?g|webp)$/i;
const linkPorNome = {};

function doGet() {
  return resposta({ erro: 'Use POST.' });
}

function doPost(e) {
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
  return resposta({ atualizadoEm: new Date().toISOString(), abas: lerAbas() });
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

function lerAbas() {
  const ss = SpreadsheetApp.getActive();
  const fuso = ss.getSpreadsheetTimeZone();
  const links = linksDosChips(ss);
  const abas = {};
  ss.getSheets().forEach((sheet) => {
    const nome = sheet.getName();
    abas[nome] = sheet
      .getDataRange()
      .getValues()
      .map((linha, r) =>
        linha.map((celula, c) => {
          const uri = links[nome] && links[nome][r] && links[nome][r][c];
          if (uri) return uri; // chip de arquivo: devolve o link em vez do nome
          if (typeof celula === 'string' && ARQUIVO.test(celula.trim())) return urlDoArquivo(celula.trim());
          return celula instanceof Date ? serial(celula, fuso) : celula;
        }),
      );
  });
  return abas;
}

// O valor de um chip de arquivo do Drive é só o nome; o link vem do serviço avançado "Google Sheets API"
// (Serviços > + > Google Sheets API). Sem ele, os chips continuam devolvendo só o nome.
function linksDosChips(ss, mostrarErro) {
  const out = {};
  try {
    const grade = Sheets.Spreadsheets.get(ss.getId(), {
      includeGridData: true,
      fields: 'sheets(properties/title,data/rowData/values/chipRuns)',
    });
    (grade.sheets || []).forEach((s) => {
      const mapa = {};
      const linhas = (s.data && s.data[0] && s.data[0].rowData) || [];
      linhas.forEach((linha, r) =>
        (linha.values || []).forEach((cel, c) => {
          const run = (cel.chipRuns || []).find(
            (x) => x.chip && x.chip.richLinkProperties && x.chip.richLinkProperties.uri,
          );
          if (run) {
            mapa[r] = mapa[r] || {};
            mapa[r][c] = run.chip.richLinkProperties.uri;
          }
        }),
      );
      out[s.properties.title] = mapa;
    });
  } catch (e) {
    if (mostrarErro) throw e;
    // serviço não ativado ou sem permissão: segue sem os links
  }
  return out;
}

// Alternativa sem o serviço avançado: o valor da célula é o nome do arquivo, então procuramos no Drive por ele.
// Usa o primeiro arquivo com esse nome que a sua conta enxerga; se não achar, devolve o nome.
function urlDoArquivo(nome) {
  if (!(nome in linkPorNome)) {
    try {
      const arquivos = DriveApp.getFilesByName(nome);
      linkPorNome[nome] = arquivos.hasNext() ? arquivos.next().getUrl() : nome;
    } catch (e) {
      linkPorNome[nome] = nome;
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
