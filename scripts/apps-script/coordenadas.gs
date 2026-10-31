// Cole em Extens\u00f5es > Apps Script. Mant\u00e9m a aba "Coordenadas" (Link | Nome | Latitude | Longitude)
// a partir dos links do Google Maps digitados em qualquer outra aba. Rode `instalarGatilho` uma vez.
const ABA_COORDENADAS = 'Coordenadas';
const CABECALHO = ['Link', 'Nome', 'Latitude', 'Longitude'];
const LINK_MAPS = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)\S*$/i;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Locais')
    .addItem('Atualizar coordenadas', 'atualizarTudo')
    .addItem('Instalar gatilho de edi\u00e7\u00e3o', 'instalarGatilho')
    .addToUi();
}

// onEdit simples n\u00e3o pode chamar UrlFetchApp; por isso o gatilho \u00e9 instal\u00e1vel (pede autoriza\u00e7\u00e3o uma vez).
function instalarGatilho() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'aoEditar')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('aoEditar').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  SpreadsheetApp.getActive().toast('Gatilho instalado.');
}

function aoEditar(e) {
  const sheet = e.range.getSheet();
  if (ehAbaCoordenadas(sheet)) return;

  const rich = e.range.getRichTextValues();
  const values = e.range.getValues();
  const links = [];
  values.forEach((row, r) =>
    row.forEach((cell, c) => {
      const texto = String(cell).trim();
      const url = LINK_MAPS.test(texto) ? texto : rich[r][c].getLinkUrl();
      if (url && LINK_MAPS.test(url.trim())) links.push(url.trim());
    }),
  );
  if (links.length) registrar(links);
}

function atualizarTudo() {
  const links = [];
  SpreadsheetApp.getActive()
    .getSheets()
    .filter((s) => !ehAbaCoordenadas(s))
    .forEach((s) =>
      s.getDataRange().getValues().forEach((row) =>
        row.forEach((cell) => {
          const texto = String(cell).trim();
          if (LINK_MAPS.test(texto)) links.push(texto);
        }),
      ),
    );
  registrar(links);
  SpreadsheetApp.getActive().toast('Coordenadas atualizadas.');
}

function ehAbaCoordenadas(sheet) {
  return sheet.getName().trim().toLowerCase().indexOf(ABA_COORDENADAS.toLowerCase()) === 0;
}

function abaCoordenadas() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheets().find(ehAbaCoordenadas);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_COORDENADAS);
    sheet.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]);
  }
  return sheet;
}

function registrar(links) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = abaCoordenadas();
    const existentes = new Set(sheet.getDataRange().getValues().slice(1).map((r) => String(r[0]).trim()));

    [...new Set(links)]
      .filter((link) => !existentes.has(link))
      .forEach((link) => {
        const lugar = extrair(urlFinal(link));
        if (lugar) sheet.appendRow([link, lugar.nome, lugar.lat, lugar.lng]);
      });
  } finally {
    lock.releaseLock();
  }
}

// Segue os redirecionamentos \u00e0 m\u00e3o: o Apps Script n\u00e3o exp\u00f5e a URL final.
function urlFinal(url) {
  for (let i = 0; i < 6; i++) {
    const res = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true });
    const code = res.getResponseCode();
    const headers = res.getHeaders();
    const destino = headers['Location'] || headers['location'];
    if (code < 300 || code >= 400 || !destino) return url;
    url = destino;
  }
  return url;
}

// `!3d\u2026!4d\u2026` \u00e9 o ponto exato do lugar; `@lat,lng` \u00e9 s\u00f3 o centro da tela.
function extrair(url) {
  const m =
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url) || /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url);
  if (!m) return null;
  const n = /\/maps\/place\/([^/@?]+)/.exec(url);
  return { nome: n ? decodeURIComponent(n[1].replace(/\+/g, ' ')) : '', lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}
