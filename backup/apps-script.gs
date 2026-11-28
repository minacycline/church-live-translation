// Church App Backup (Google Apps Script, runs on Google's servers, no PC needed).
// Every night it saves to Drive (Qik Backups / Church App Backups):
//   church-repo-<Day>.zip            the app from GitHub (main branch)
//   church-server-<Day>.json         every Cloudflare worker (code, bindings, cron, secret NAMES) and all saved server data (KV)
//   worker-<name>.js                 the newest code of each Cloudflare worker, ready to paste back
// The GitHub Action "Backup to Drive" also posts the full git history here; it is saved as church-repo-history-<Day>.bundle.
// Secret values (keys, passcode) are never saved; only their names are listed.
// If a night fails twice, a bell row goes on the Qik dashboard.

var FOLDER_ID = '10VUirA595YeGlXe4xYRenWa3vU-XtiXo';
var BELL_SHEET = '1eAFNENi84U8AvDd6wXJnZVwNqErg7F-Csi-Fpreuh8Q';
var REPO = 'minacycline/church-live-translation';
var TZ = 'America/New_York';
var SKIP_VALUE_PREFIXES = ['adm:sec:', 'adm:fail:', 'adm:rv:'];
var CF = 'https://api.cloudflare.com/client/v4';

function props_() { return PropertiesService.getScriptProperties(); }
function day_() { return Utilities.formatDate(new Date(), TZ, 'EEE'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

// ---------- saving files ----------
function saveBlob_(name, blob, description) {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var it = folder.getFilesByName(name);
  blob.setName(name);
  if (it.hasNext()) {
    var f = it.next();
    var out = Drive.Files.update({ description: description }, f.getId(), blob, { fields: 'id,name,size' });
    return { id: out.id, bytes: Number(out.size) };
  }
  var g = folder.createFile(blob);
  g.setDescription(description);
  return { id: g.getId(), bytes: g.getSize() };
}

// ---------- nightly ----------
function nightly() { return run_(false); }

function run_(quiet) {
  var p = props_();
  if (p.getProperty('doneDate') === today_()) return 'already done today';
  var errors = [];
  var res = {};
  try { res.zip = saveRepoZip_(); } catch (e) { errors.push('repo zip: ' + e.message); }
  try { res.server = saveCloudflare_(); } catch (e) { errors.push('Cloudflare: ' + e.message); }
  var status = JSON.parse(p.getProperty('status') || '{}');
  status.lastRun = new Date().toISOString();
  if (res.zip) status.zip = res.zip;
  if (res.server) status.server = res.server;
  status.lastErrors = errors;
  p.setProperty('status', JSON.stringify(status));
  if (!errors.length) { p.setProperty('doneDate', today_()); return 'ok'; }
  if (quiet) throw new Error(errors.join(' | '));
  var tries = Number(p.getProperty('failTries_' + today_()) || 0) + 1;
  p.setProperty('failTries_' + today_(), String(tries));
  if (tries >= 2) bell_('Church app backup failed last night', errors.join(' | '));
  throw new Error(errors.join(' | '));
}

function saveRepoZip_() {
  var r = UrlFetchApp.fetch('https://codeload.github.com/' + REPO + '/zip/refs/heads/main', { muteHttpExceptions: true, followRedirects: true });
  if (r.getResponseCode() !== 200) throw new Error('GitHub answered ' + r.getResponseCode());
  var blob = r.getBlob().setContentType('application/zip');
  if (blob.getBytes().length < 1000000) throw new Error('zip too small: ' + blob.getBytes().length + ' bytes');
  var out = saveBlob_('church-repo-' + day_() + '.zip', blob, 'Church live translation app: GitHub main branch, nightly weekday copy');
  out.at = new Date().toISOString();
  return out;
}

function cf_(path, opt) {
  var token = props_().getProperty('cfToken');
  if (!token) throw new Error('no Cloudflare token saved yet');
  opt = opt || {};
  var o = { method: opt.method || 'get', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } };
  if (opt.body) { o.contentType = 'application/json'; o.payload = JSON.stringify(opt.body); }
  var r = UrlFetchApp.fetch(CF + path, o);
  var code = r.getResponseCode();
  if (opt.raw) { if (code !== 200) throw new Error(path + ' answered ' + code); return r.getContentText(); }
  var j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) { throw new Error(path + ' answered ' + code + ' (not JSON)'); }
  if (code !== 200 || j.success === false) throw new Error(path + ' answered ' + code + ' ' + JSON.stringify(j.errors || '').slice(0, 200));
  return j;
}

// Cloudflare sends module workers wrapped as a form upload; keep only the code so the file can be pasted back as is.
function plainCode_(t) {
  if (t.indexOf('--') !== 0) return t;
  var nl = t.indexOf('\n'); var boundary = t.slice(0, nl).replace(/\r$/, '');
  var start = t.indexOf('\r\n\r\n'); if (start < 0) start = t.indexOf('\n\n'); else start += 4;
  var end = t.indexOf(boundary, start); if (end < 0) end = t.length;
  return t.slice(start, end).replace(/\r?\n$/, '');
}

// Run by hand to make a fresh copy now (ignores the once-a-day mark).
function backupNow() { props_().deleteProperty('doneDate'); return run_(true); }

function saveCloudflare_() {
  var dump = { savedAt: new Date().toISOString(), note: 'Secret VALUES are not here, only their names. Values to paste back: see the RESTORE read me.', accounts: [] };
  var accounts = cf_('/accounts?per_page=50').result;
  var workerCount = 0, keyCount = 0;
  accounts.forEach(function (acc) {
    var A = { id: acc.id, name: acc.name, workers: [], kv: [] };
    var sub = {};
    try { sub = cf_('/accounts/' + acc.id + '/workers/subdomain').result; } catch (e) { sub = { error: e.message }; }
    A.workersSubdomain = sub;
    var scripts = cf_('/accounts/' + acc.id + '/workers/scripts').result || [];
    scripts.forEach(function (s) {
      var w = { name: s.id, created_on: s.created_on, modified_on: s.modified_on, compatibility_date: s.compatibility_date, usage_model: s.usage_model };
      var base = '/accounts/' + acc.id + '/workers/scripts/' + encodeURIComponent(s.id);
      try { w.code = plainCode_(cf_(base + '/content/v2', { raw: true })); } catch (e) { w.codeError = e.message; }
      try { w.settings = cf_(base + '/settings').result; } catch (e) { w.settingsError = e.message; }
      try { w.schedules = cf_(base + '/schedules').result; } catch (e) { w.schedulesError = e.message; }
      try { w.secretNames = (cf_(base + '/secrets').result || []).map(function (x) { return x.name; }); } catch (e) { w.secretNamesError = e.message; }
      if (w.code) saveBlob_('worker-' + s.id + '.js', Utilities.newBlob(w.code, 'text/javascript'), 'Newest code of the Cloudflare worker ' + s.id + ' (saved nightly)');
      A.workers.push(w); workerCount++;
    });
    var spaces = cf_('/accounts/' + acc.id + '/storage/kv/namespaces?per_page=100').result || [];
    spaces.forEach(function (ns) {
      var N = { id: ns.id, title: ns.title, keys: [], valuesNotSaved: [] };
      var nb = '/accounts/' + acc.id + '/storage/kv/namespaces/' + ns.id;
      var cursor = '', all = [];
      do {
        var page = cf_(nb + '/keys?limit=1000' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
        all = all.concat(page.result || []);
        cursor = (page.result_info && page.result_info.cursor) || '';
      } while (cursor);
      var want = all.filter(function (k) { return !SKIP_VALUE_PREFIXES.some(function (p) { return k.name.indexOf(p) === 0; }); });
      all.forEach(function (k) { if (want.indexOf(k) < 0) N.valuesNotSaved.push(k.name); });
      var token = props_().getProperty('cfToken');
      for (var i = 0; i < want.length; i += 20) {
        var chunk = want.slice(i, i + 20);
        var reqs = chunk.map(function (k) {
          return { url: CF + nb + '/values/' + encodeURIComponent(k.name), muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } };
        });
        var rs = UrlFetchApp.fetchAll(reqs);
        rs.forEach(function (r, x) {
          var k = chunk[x];
          var e = { name: k.name };
          if (k.expiration) e.expiration = k.expiration;
          if (k.metadata) e.metadata = k.metadata;
          if (r.getResponseCode() === 200) e.value = r.getContentText(); else e.error = 'answered ' + r.getResponseCode();
          N.keys.push(e);
        });
      }
      keyCount += N.keys.length;
      A.kv.push(N);
    });
    dump.accounts.push(A);
  });
  var json = JSON.stringify(dump, null, 1);
  var out = saveBlob_('church-server-' + day_() + '.json', Utilities.newBlob(json, 'application/json'), 'Church app Cloudflare workers and saved server data (no secret values), nightly weekday copy');
  out.at = new Date().toISOString(); out.workers = workerCount; out.kvKeys = keyCount;
  return out;
}

// ---------- full git history from the GitHub Action ----------
function doPost(e) {
  var out = { ok: false };
  try {
    var b64 = (e && e.postData && e.postData.contents) || '';
    var bytes = Utilities.base64Decode(b64.replace(/\s+/g, ''));
    var head = Utilities.newBlob(bytes.slice(0, 20000)).getDataAsString('ISO-8859-1');
    var m = head.match(/^([0-9a-f]{40}) refs\/(?:heads|remotes\/origin)\/main$/m);
    if (!/^# v[23] git bundle\n/.test(head)) out.why = 'not a git bundle';
    else if (!m) out.why = 'no main branch in bundle';
    else if (bytes.length < 1000000) out.why = 'bundle too small';
    else {
      var r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/commits/' + m[1], { muteHttpExceptions: true, headers: { Accept: 'application/vnd.github+json' } });
      var sha = r.getResponseCode() === 200 ? JSON.parse(r.getContentText()).sha : '';
      if (sha !== m[1]) out.why = 'main commit not found on GitHub';
      else {
        var saved = saveBlob_('church-repo-history-' + day_() + '.bundle', Utilities.newBlob(bytes, 'application/octet-stream'), 'Church live translation app: full git history (git clone <this file>), weekday copy');
        out = { ok: true, sha: sha, bytes: saved.bytes, file: 'church-repo-history-' + day_() + '.bundle' };
        var p = props_(); var st = JSON.parse(p.getProperty('status') || '{}');
        st.bundle = { at: new Date().toISOString(), sha: sha, bytes: saved.bytes, id: saved.id };
        p.setProperty('status', JSON.stringify(st));
      }
    }
  } catch (err) { out.why = 'error: ' + String(err.message || err).slice(0, 200); }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- the small page: status, and the one-time Cloudflare token box ----------
function doGet() {
  var st = JSON.parse(props_().getProperty('status') || '{}');
  var has = !!props_().getProperty('cfToken');
  var html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;max-width:560px;margin:24px auto;padding:0 16px">' +
    '<h2>Church app backup</h2>' +
    '<p>Cloudflare token: <b>' + (has ? 'saved' : 'not saved yet') + '</b></p>' +
    '<p>Last nightly run: ' + (st.lastRun || 'none yet') + (st.lastErrors && st.lastErrors.length ? '<br><span style="color:#b42318">Problem: ' + st.lastErrors.join(' | ') + '</span>' : '') + '</p>' +
    '<p>App zip: ' + (st.zip ? st.zip.at + ' (' + st.zip.bytes + ' bytes)' : 'none yet') + '<br>Server data: ' + (st.server ? st.server.at + ' (' + st.server.workers + ' workers, ' + st.server.kvKeys + ' saved items)' : 'none yet') + '<br>Full history: ' + (st.bundle ? st.bundle.at + ' (' + st.bundle.bytes + ' bytes)' : 'none yet') + '</p>' +
    '<h3>' + (has ? 'Replace' : 'Paste') + ' the Cloudflare token</h3>' +
    '<p>Read-only token from Cloudflare (Workers Scripts Read, Workers KV Storage Read). It is checked with Cloudflare before it is saved.</p>' +
    '<input id="t" type="password" style="width:100%;padding:10px;font-size:16px" placeholder="Paste token here">' +
    '<p><button style="padding:10px 18px;font-size:16px" onclick="var b=this;b.disabled=true;b.textContent=\'Checking...\';google.script.run.withSuccessHandler(function(m){document.getElementById(\'m\').textContent=m;b.disabled=false;b.textContent=\'Save\'}).saveToken(document.getElementById(\'t\').value)">Save</button></p><p id="m"></p></body>';
  return HtmlService.createHtmlOutput(html).setTitle('Church app backup').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Saves a Cloudflare token only if Cloudflare says it is active and it can read the same account as before.
function saveToken(token) {
  token = String(token || '').trim();
  if (!/^[A-Za-z0-9_\-]{30,80}$/.test(token)) return 'That does not look like a Cloudflare token.';
  var v = UrlFetchApp.fetch(CF + '/user/tokens/verify', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
  var vj = {}; try { vj = JSON.parse(v.getContentText()); } catch (e) {}
  if (!(vj.result && vj.result.status === 'active')) return 'Cloudflare says this token is not active.';
  var a = UrlFetchApp.fetch(CF + '/accounts', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
  var aj = {}; try { aj = JSON.parse(a.getContentText()); } catch (e) {}
  var ids = (aj.result || []).map(function (x) { return x.id; });
  if (!ids.length) return 'This token cannot see any Cloudflare account.';
  var p = props_();
  var known = p.getProperty('cfAccount');
  if (known && ids.indexOf(known) < 0) return 'This token belongs to a different Cloudflare account. Not saved.';
  p.setProperty('cfToken', token);
  p.setProperty('cfAccount', known || ids[0]);
  return 'Saved. The first full backup runs within a few minutes.';
}

// ---------- bell ----------
function bell_(title, summary) {
  var id = 'n-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmm') + '-churchbackup-gas';
  SpreadsheetApp.openById(BELL_SHEET).getSheetByName('Sheet1').appendRow([id, new Date().toISOString(), title, String(summary).slice(0, 500), 'Google Apps Script "Church App Backup" (owner info@)', 'Church app backup (Google)', 'issue', '']);
}

// ---------- one-time setup: nightly at 2 AM and a 5 AM catch-up ----------
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('nightly').timeBased().atHour(2).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('nightly').timeBased().atHour(5).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('firstRunAfterToken').timeBased().everyMinutes(5).create();
  return 'triggers set';
}

// Runs every 5 minutes only until the first full backup has been made, then removes itself.
function firstRunAfterToken() {
  var p = props_();
  if (!p.getProperty('cfToken')) return;
  try { run_(true); } catch (e) { return; }
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'firstRunAfterToken') ScriptApp.deleteTrigger(t); });
}
