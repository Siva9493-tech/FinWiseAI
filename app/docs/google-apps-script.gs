/**
 * FinWise AI — Google Apps Script backend (cloud database for /history).
 *
 * Deploy this as a Web App to give FinWise AI a Google Sheets database:
 *
 *   1. Create a new Google Sheet. Note its URL.
 *   2. Extensions → Apps Script. Delete the default code and paste this file.
 *   3. (Optional) Set a shared secret: Project Settings → Script Properties →
 *      add property  SCRIPT_TOKEN  with a random value. Put the SAME value in
 *      your app's .env as GOOGLE_SCRIPT_TOKEN.
 *   4. Deploy → New deployment → type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   5. Copy the Web App /exec URL into your app's .env as GOOGLE_SCRIPT_URL.
 *
 * The app NEVER exposes this URL to the browser — it is read server-side only
 * (src/services/googleSheets.ts) and called from the /api/history endpoint.
 *
 * Endpoints:
 *   GET  ?token=…            → { records: [...] }   (newest first)
 *   POST { action:"save", record:{…}, token? }  → { ok:true }  (upsert by id)
 */

var SHEET_NAME = 'FinWiseRecords';

// Column order in the sheet. `record` holds the full JSON snapshot.
var HEADERS = [
  'id',
  'timestamp',
  'name',
  'age',
  'employment',
  'income',
  'loanAmount',
  'loanPurpose',
  'creditScore',
  'monthlyEMI',
  'loanEligibilityResult',
  'creditAnalysis',
  'emiCalculation',
  'aiAdviceSummary',
  'device',
  'version',
  'record',
];

function doGet(e) {
  if (!checkToken(e)) return unauthorized();
  try {
    var records = readAll();
    return jsonOutput({ records: records });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function doPost(e) {
  if (!checkToken(e)) return unauthorized();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'save' && body.record) {
      upsert(body.record);
      return jsonOutput({ ok: true });
    }
    return jsonOutput({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

/* -------------------------------------------------------------------------- */

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function rowFromRecord(record) {
  return HEADERS.map(function (key) {
    if (key === 'record') return JSON.stringify(record);
    var value = record[key];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  });
}

/** Insert a new record or overwrite the existing row with the same id. */
function upsert(record) {
  var sheet = getSheet();
  var id = String(record.id || '');
  if (!id) throw new Error('record.id is required');

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 1, 1, HEADERS.length).setValues([rowFromRecord(record)]);
      return;
    }
  }
  sheet.appendRow(rowFromRecord(record));
}

/** Read every record back as clean JSON, newest first. */
function readAll() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var recordCol = HEADERS.indexOf('record');
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var raw = data[i][recordCol];
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch (err) {
      // Skip corrupt rows rather than failing the whole read.
    }
  }
  out.sort(function (a, b) {
    return String(b.timestamp).localeCompare(String(a.timestamp));
  });
  return out;
}

/* ---- Auth + output helpers ------------------------------------------------ */

function checkToken(e) {
  var expected = PropertiesService.getScriptProperties().getProperty('SCRIPT_TOKEN');
  if (!expected) return true; // token not configured → open (dev)
  var provided = (e && e.parameter && e.parameter.token) || '';
  return provided === expected;
}

function unauthorized() {
  return jsonOutput({ ok: false, error: 'Unauthorized' });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
