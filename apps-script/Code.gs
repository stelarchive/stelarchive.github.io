/* ══════════════════════════════════════════════════════════
   스텔라이브 아카이브 — 서버 역할을 하는 Apps Script
   README 의 "3. Apps Script" 순서대로 붙여넣고 배포한다.
   ══════════════════════════════════════════════════════════ */

/* ① config.js 의 googleClientId 와 같은 값 */
const CLIENT_ID = '305499200154-8mh7k0jr3fhlf773nsml7gu8q9c7i9so.apps.googleusercontent.com';

/* ② 관리자 구글 계정 — 여기 있는 사람만 관리자 페이지에서 저장·삭제할 수 있다 */
const ADMIN_EMAILS = [
  '33_37@kbs.hs.kr',
  '33_11@kbs.hs.kr',
  '33_43@kbs.hs.kr',
  '33_26@kbs.hs.kr',
  '34_61@kbs.hs.kr',
  '32_50@kbs.hs.kr',
  // 'friend@gmail.com',   ← 관리자를 늘리려면 이렇게 한 줄씩
];

/* ③ 사이트 주소 — 처음 setup 할 때 site.json 을 여기서 받아온다 */
const SITE_URL = 'https://stelarchive.github.io/';

/* ④ 파일을 모을 드라이브 폴더 id — 비워 두면 내 드라이브에 '스텔라이브 아카이브' 폴더를 새로 만든다.
      공유 드라이브를 쓰려면 그 주소 끝의 id 를 넣는다 (drive.google.com/drive/folders/여기) */
const ROOT_FOLDER_ID = '0ANOOm7FkHIauUk9PVA';

/* 아래는 고칠 필요 없음 ─────────────────────────────────── */

const ROOT_NAME   = '스텔라이브 아카이브';
const GROUP_DIR   = '단체';
const DUO_DIR     = '합방';
const ALL_DIR     = '전체';
const SYS_DIR     = '_사이트';
const KINDS = { cover: '커버곡', original: '오리곡', album: '앨범', clip: '클립', shorts: '쇼츠', fanart: '팬아트', meme: '짤' };
const GROUP_KINDS = ['cover', 'original', 'album', 'clip'];
const MAX_UPLOAD_GB = 2; // 사이트에서 한 번에 올릴 수 있는 파일 크기
const CACHE_TTL = 21600; // 드라이브 목록 캐시 (초) — warmCache 가 10분마다 새로 채운다

const props = PropertiesService.getScriptProperties();

/* ─── 처음 한 번 실행 ─── */
function setup() {
  let root;
  if (ROOT_FOLDER_ID) root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  else if (props.getProperty('ROOT_ID')) root = DriveApp.getFolderById(props.getProperty('ROOT_ID'));
  else root = DriveApp.createFolder(ROOT_NAME);
  props.setProperty('ROOT_ID', root.getId());
  // 공유 드라이브 맨 위는 링크 공유를 못 건다 — 파일마다 따로 건다
  try { root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { Logger.log('폴더 링크 공유는 건너뜀: ' + e.message); }
  checkPublicSharing_(root);

  if (!props.getProperty('SHEET_ID')) {
    const ss = SpreadsheetApp.create('스텔라이브 아카이브 데이터');
    ss.getSheets()[0].setName('links').appendRow(['id', 'kind', 'title', 'url', 'members', 'group', 'byEmail', 'byName', 'at', 'alt']);
    ss.insertSheet('favorites').appendRow(['email', 'ids', 'at']);
    DriveApp.getFileById(ss.getId()).moveTo(sysFolder_());
    props.setProperty('SHEET_ID', ss.getId());
  }

  if (!props.getProperty('SITE_FILE_ID')) {
    // 사이트(GitHub Pages)가 아직 안 켜져 있으면 리포지토리 원본에서 받는다
    let json = '{}';
    for (const url of [SITE_URL + 'data/site.json', 'https://raw.githubusercontent.com/stelarchive/stelarchive.github.io/main/data/site.json']) {
      try {
        const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (res.getResponseCode() === 200 && res.getContentText().trim().startsWith('{')) { json = res.getContentText(); break; }
      } catch (e) {}
    }
    if (json === '{}') throw new Error('site.json 을 받아오지 못했다. SITE_URL 을 확인하자');
    const f = sysFolder_().createFile('site.json', json, 'application/json');
    props.setProperty('SITE_FILE_ID', f.getId());
  }
  ensureFolders_(readSite_());
  installWarm();
  Logger.log('완료: ' + root.getUrl());
}

/* ─── 요청 받기 ─── */
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'bootstrap';
  try {
    if (action === 'bootstrap') return out_({ ok: true, site: readSite_(), items: allItems_() });
    // 사이트 설정은 금방 오니 먼저 보내고, 드라이브 목록은 따로 받는다
    if (action === 'site') return out_({ ok: true, site: readSite_() });
    if (action === 'items') return out_({ ok: true, items: allItems_() });
    if (action === 'comments') return out_({ ok: true, comments: commentsFor_(String(e.parameter.item || '')) });
    if (action === 'commentCounts') return out_({ ok: true, counts: commentCounts_() });
    if (action === 'schedule') return out_({ ok: true, events: scheduleFor_(String(e.parameter.month || '')) });
    if (action === 'storage') return out_(Object.assign({ ok: true }, storage_()));
    return out_({ ok: false, error: '모르는 요청' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: '잘못된 요청' }); }
  try {
    const user = verify_(body.idToken);
    const fn = ACTIONS[body.action];
    if (!fn) return out_({ ok: false, error: '모르는 요청' });
    return out_(Object.assign({ ok: true }, fn(body, user)));
  } catch (err) { return out_({ ok: false, error: err.message || String(err) }); }
}

const ACTIONS = {
  whoami(b, u) { return { user: u }; },

  upload(b, u) {
    if (!KINDS[b.kind]) throw new Error('종류가 이상하다');
    const site = readSite_();
    const members = cleanMembers_(b.members, site);
    if (!members.length && !b.group) throw new Error('멤버를 하나 이상 골라야 한다');
    const folder = targetFolder_(site, b.kind, members, b.group);
    const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mimeType || 'application/octet-stream', b.filename || 'file');
    const file = folder.createFile(blob);
    sharePublic_(file);
    const meta = { title: (b.title || '').trim(), members: members, group: b.group || '', byEmail: u.email, byName: u.name };
    if (/^https?:\/\//.test(String(b.url || ''))) meta.url = String(b.url).trim();
    file.setDescription(JSON.stringify(meta));
    const item = fileItem_(file, b.kind, meta, site);
    editCache_(list => [item].concat(list));
    return { item: item };
  },

  /* 큰 파일: 서버(이 계정)가 드라이브에 "올릴 자리"를 열어 주고, 브라우저가 파일을 그 자리로 바로 보낸다.
     Apps Script 를 거치지 않으니 35MB 제한이 없다 (MAX_UPLOAD_GB 까지). 다 올린 뒤 finishUpload 로 정보를 적는다 */
  startUpload(b, u) {
    if (!KINDS[b.kind]) throw new Error('종류가 이상하다');
    const size = Number(b.size) || 0;
    if (!size || size > MAX_UPLOAD_GB * 1e9) throw new Error(MAX_UPLOAD_GB + 'GB 까지만 올릴 수 있다');
    const origin = String(b.origin || '');
    if (!/^https:\/\/stelarchive\.github\.io$|^http:\/\/localhost(:\d+)?$/.test(origin)) throw new Error('이 사이트에서만 올릴 수 있다');
    const site = readSite_();
    const members = cleanMembers_(b.members, site);
    if (!members.length && !b.group) throw new Error('멤버를 하나 이상 골라야 한다');
    const folder = targetFolder_(site, b.kind, members, b.group);
    const mime = b.mimeType || 'application/octet-stream';
    const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id', {
      method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size), Origin: origin },
      payload: JSON.stringify({ name: String(b.filename || 'file').slice(0, 200), parents: [folder.getId()], mimeType: mime }),
    });
    const loc = res.getHeaders().Location || res.getHeaders().location;
    if (res.getResponseCode() !== 200 || !loc) throw new Error('올릴 자리를 못 열었다 (' + res.getResponseCode() + ')');
    return { uploadUrl: loc };
  },
  finishUpload(b, u) {
    const file = DriveApp.getFileById(String(b.id || ''));
    if (file.getDescription()) throw new Error('이미 정리된 파일이다');
    if (Date.now() - file.getDateCreated().getTime() > 6 * 3600e3) throw new Error('너무 오래된 파일이다');
    const site = readSite_();
    const members = cleanMembers_(b.members, site);
    const meta = { title: (b.title || '').trim(), members: members, group: b.group || '', byEmail: u.email, byName: u.name };
    if (/^https?:\/\//.test(String(b.url || ''))) meta.url = String(b.url).trim();
    sharePublic_(file);
    file.setDescription(JSON.stringify(meta));
    const item = fileItem_(file, b.kind, meta, site);
    editCache_(list => [item].concat(list));
    CacheService.getScriptCache().remove('storage');
    return { item: item };
  },

  addLink(b, u) {
    if (!KINDS[b.kind]) throw new Error('종류가 이상하다');
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//.test(url)) throw new Error('링크가 이상하다');
    const site = readSite_();
    const members = cleanMembers_(b.members, site);
    if (!members.length && !b.group) throw new Error('멤버를 하나 이상 골라야 한다');
    const id = 'l_' + Utilities.getUuid().slice(0, 12);
    const at = new Date().toISOString();
    const alt = String(b.alt || '').trim(); // 같은 노래의 드라이브 파일 (유튜브가 막힌 곳에서 대신 튼다)
    const row = [id, b.kind, (b.title || '').trim(), url, JSON.stringify(members), b.group || '', u.email, u.name, at, alt];
    sheet_('links').appendRow(row);
    const item = linkItem_(row);
    editCache_(list => [item].concat(list));
    return { item: item };
  },

  remove(b, u) {
    const admin = isAdmin_(u);
    if (String(b.id).indexOf('l_') === 0) {
      const sh = sheet_('links');
      const rows = sh.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] !== b.id) continue;
        if (!admin && rows[i][6] !== u.email) throw new Error('자기가 올린 것만 지울 수 있다');
        sh.deleteRow(i + 1);
      }
    } else {
      const file = DriveApp.getFileById(b.id);
      const meta = parseMeta_(file.getDescription());
      if (!admin && meta.byEmail !== u.email) throw new Error('자기가 올린 것만 지울 수 있다');
      file.setTrashed(true);
    }
    editCache_(list => list.filter(x => x.id !== b.id));
    return {};
  },

  rename(b, u) {
    const title = String(b.title || '').trim().slice(0, 300);
    if (!title) throw new Error('제목이 비어 있다');
    const admin = isAdmin_(u);
    if (String(b.id).indexOf('l_') === 0) {
      const sh = sheet_('links');
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] !== b.id) continue;
        if (!admin && rows[i][6] !== u.email) throw new Error('자기가 올린 것만 고칠 수 있다');
        sh.getRange(i + 1, 3).setValue(title);
      }
    } else {
      const file = DriveApp.getFileById(b.id);
      const meta = parseMeta_(file.getDescription());
      if (!admin && meta.byEmail !== u.email) throw new Error('자기가 올린 것만 고칠 수 있다');
      meta.title = title;
      file.setDescription(JSON.stringify(meta));
    }
    editCache_(list => list.map(x => (x.id === b.id ? Object.assign(x, { title: title }) : x)));
    return {};
  },

  // 방송 일정: 로그인하면 누구나 넣고, 모두가 본다. 넣은 사람(과 관리자)만 지운다
  addSchedule(b, u) {
    const date = String(b.date || ''), time = String(b.time || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('날짜가 이상하다');
    if (time && !/^\d{2}:\d{2}$/.test(time)) throw new Error('시간이 이상하다');
    const site = readSite_();
    if (!site.members.some(m => m.id === b.member)) throw new Error('멤버를 골라야 한다');
    const type = ['live', 'plan', 'off', 'song', 'etc'].indexOf(b.type) >= 0 ? b.type : 'etc';
    const url = /^https?:\/\//.test(String(b.url || '')) ? String(b.url).slice(0, 300) : '';
    const row = ['sc_' + Utilities.getUuid().slice(0, 12), date, time, b.member, type, String(b.title || '').trim().slice(0, 80), url, u.email, u.name, new Date().toISOString()];
    schSheet_().appendRow(row);
    CacheService.getScriptCache().remove('sch_' + date.slice(0, 7));
    return { event: schRow_(row) };
  },
  removeSchedule(b, u) {
    const sh = schSheet_();
    const hit = sh.getRange('A:A').createTextFinder(String(b.id || '')).matchEntireCell(true).findNext();
    if (!hit) return {};
    const r = sh.getRange(hit.getRow(), 1, 1, 10).getValues()[0];
    if (!isAdmin_(u) && r[7] !== u.email) throw new Error('자기가 넣은 일정만 지울 수 있다');
    sh.deleteRow(hit.getRow());
    CacheService.getScriptCache().remove('sch_' + schRow_(r).date.slice(0, 7));
    return {};
  },

  // 내 일정: 본인만 보는 개인 일정
  getMyEvents(b, u) {
    const sh = mySheet_();
    return { events: sh.getRange('B:B').createTextFinder(u.email).matchEntireCell(true).findAll().map(r => myRow_(sh.getRange(r.getRow(), 1, 1, 5).getValues()[0])) };
  },
  addMyEvent(b, u) {
    const date = String(b.date || '');
    const title = String(b.title || '').trim().slice(0, 100);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) throw new Error('날짜와 내용을 넣자');
    const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#7c6cf0';
    const row = ['my_' + Utilities.getUuid().slice(0, 12), u.email, date, title, color];
    mySheet_().appendRow(row);
    return { event: myRow_(row) };
  },
  removeMyEvent(b, u) {
    const sh = mySheet_();
    const hit = sh.getRange('A:A').createTextFinder(String(b.id || '')).matchEntireCell(true).findNext();
    if (!hit) return {};
    if (sh.getRange(hit.getRow(), 2).getValue() !== u.email) throw new Error('내 일정만 지울 수 있다');
    sh.deleteRow(hit.getRow());
    return {};
  },

  // 출석: 하루 한 번 (한국 날짜 기준)
  checkIn(b, u) {
    const today = kstToday_();
    const sh = attSheet_();
    const dates = attDates_(sh, u.email);
    if (dates.indexOf(today) < 0) { sh.appendRow([u.email, u.name, today]); dates.push(today); }
    return { dates: dates, today: today };
  },
  getAttendance(b, u) { return { dates: attDates_(attSheet_(), u.email), today: kstToday_() }; },
  // 관리자: 계정마다 출석 일수 · 연속 · 처음/마지막 출석
  attendanceAll(b, u) {
    needAdmin_(u);
    const today = kstToday_(), by = {};
    attSheet_().getDataRange().getValues().slice(1).forEach(r => {
      if (!r[0]) return;
      const d = r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Seoul', 'yyyy-MM-dd') : String(r[2]);
      const p = by[r[0]] || (by[r[0]] = { email: r[0], name: r[1] || r[0], dates: {} });
      p.name = r[1] || p.name;
      p.dates[d] = 1;
    });
    const dayStr = t => Utilities.formatDate(new Date(t), 'UTC', 'yyyy-MM-dd');
    const people = Object.keys(by).map(k => {
      const p = by[k], ds = Object.keys(p.dates).sort();
      let n = 0, t = new Date(today + 'T00:00:00Z').getTime();
      if (!p.dates[today]) t -= 864e5;
      while (p.dates[dayStr(t)]) { n++; t -= 864e5; }
      return { email: p.email, name: p.name, days: ds.length, first: ds[0], last: ds[ds.length - 1], today: !!p.dates[today], streak: n };
    });
    return { people: people, today: today };
  },

  // 댓글: 구글 로그인한 사람만. 500자까지
  addComment(b, u) {
    const text = String(b.text || '').trim().slice(0, 500);
    const item = String(b.item || '').trim();
    if (!text) throw new Error('댓글이 비어 있다');
    if (!item) throw new Error('어디에 다는 댓글인지 모르겠다');
    const row = ['c_' + Utilities.getUuid().slice(0, 12), item, u.email, u.name, text, new Date().toISOString()];
    commentsSheet_().appendRow(row);
    CacheService.getScriptCache().remove('ccounts');
    return { comment: commentOut_(row) };
  },
  removeComment(b, u) {
    const sh = commentsSheet_();
    const rows = sh.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] !== b.id) continue;
      if (!isAdmin_(u) && rows[i][2] !== u.email) throw new Error('자기가 쓴 댓글만 지울 수 있다');
      sh.deleteRow(i + 1);
    }
    CacheService.getScriptCache().remove('ccounts');
    return {};
  },

  getFavorites(b, u) {
    const row = favRow_(u.email);
    return { ids: row ? JSON.parse(row.values[1] || '[]') : [] };
  },

  setFavorites(b, u) {
    const ids = (b.ids || []).map(String).slice(0, 5000);
    const sh = sheet_('favorites');
    const row = favRow_(u.email);
    const vals = [u.email, JSON.stringify(ids), new Date().toISOString()];
    if (row) sh.getRange(row.index, 1, 1, 3).setValues([vals]);
    else sh.appendRow(vals);
    return {};
  },

  /* ── 관리자 ── */
  saveSite(b, u) {
    needAdmin_(u);
    const site = b.site;
    if (!site || !Array.isArray(site.members) || !Array.isArray(site.groups)) throw new Error('사이트 데이터가 이상하다');
    const file = DriveApp.getFileById(props.getProperty('SITE_FILE_ID'));
    const before = file.getBlob().getDataAsString();
    backupSite_(before, u);
    file.setContent(JSON.stringify(site, null, 2));
    // 멤버·기수 구성이 바뀐 때만 폴더를 손보고 목록을 새로 읽는다 (글자·그림만 바꾸면 바로 끝난다)
    const shape = x => JSON.stringify([(x.members || []).map(m => [m.id, m.name, m.group]), (x.groups || []).map(g => [g.id, g.label])]);
    let old = {};
    try { old = JSON.parse(before || '{}'); } catch (e) {}
    if (shape(old) !== shape(site)) { ensureFolders_(site); clearCache_(); }
    return { site: site };
  },

  uploadImage(b, u) {
    needAdmin_(u);
    const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mimeType || 'image/png', b.filename || 'image');
    const file = subFolder_(sysFolder_(), '이미지').createFile(blob);
    sharePublic_(file);
    return { id: file.getId() };
  },

  refresh(b, u) { needAdmin_(u); clearCache_(); return { items: allItems_() }; },

  /* 저장할 때마다 남는 이전 버전 (드라이브 _사이트/백업) */
  listBackups(b, u) {
    needAdmin_(u);
    const out = [];
    const it = backupFolder_().getFiles();
    while (it.hasNext()) { const f = it.next(); out.push({ id: f.getId(), name: f.getName(), at: f.getDateCreated().toISOString() }); }
    out.sort((x, y) => (y.at > x.at ? 1 : -1));
    return { backups: out.slice(0, 60) };
  },
  getBackup(b, u) {
    needAdmin_(u);
    const f = DriveApp.getFileById(b.id);
    if (f.getParents().next().getId() !== backupFolder_().getId()) throw new Error('백업 파일이 아니다');
    return { site: JSON.parse(f.getBlob().getDataAsString()) };
  },
};

/* ─── 공개 링크 ───
   학교 · 회사 계정은 '링크가 있는 모든 사용자' 공유를 관리자가 막아 둔 경우가 있다. 막혀 있으면 사이트 방문자가 파일을 못 본다 */
function sharePublic_(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { throw new Error('이 드라이브는 "링크가 있는 모든 사용자" 공유가 막혀 있다. 학교 관리자 설정을 확인하자 (' + e.message + ')'); }
}
function checkPublicSharing_(root) {
  const f = root.createFile('공개 공유 시험.txt', '지워도 된다');
  try {
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const ok = f.getSharingAccess() === DriveApp.Access.ANYONE_WITH_LINK;
    Logger.log(ok ? '✅ 공개 링크 공유가 된다' : '❌ 공개 링크 공유가 막혀 있다 — 방문자가 파일을 못 본다');
  } catch (e) {
    Logger.log('❌ 공개 링크 공유가 막혀 있다 — 방문자가 파일을 못 본다: ' + e.message);
  } finally { f.setTrashed(true); }
}

/* ─── 로그인 확인 ─── */
function verify_(token) {
  if (!token) throw new Error('로그인이 필요하다');
  const cache = CacheService.getScriptCache();
  const key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  const hit = cache.get(key);
  if (hit) { const u = JSON.parse(hit); u.admin = isAdmin_(u); return u; } // 관리자 목록은 매번 새로 본다 (추가한 사람이 바로 되게)
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('로그인이 만료됐다. 다시 로그인하자');
  const info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('다른 사이트의 로그인이다');
  const user = { email: info.email, name: info.name || info.email.split('@')[0], picture: info.picture || '' };
  user.admin = isAdmin_(user);
  const ttl = Math.max(60, Math.min(3000, Number(info.exp) - Math.floor(Date.now() / 1000) - 60));
  cache.put(key, JSON.stringify(user), ttl);
  return user;
}
function isAdmin_(u) { return ADMIN_EMAILS.map(s => s.toLowerCase()).indexOf(String(u.email).toLowerCase()) >= 0; }
function needAdmin_(u) { if (!isAdmin_(u)) throw new Error('관리자만 할 수 있다'); }

/* ─── 사이트 데이터 ─── */
function readSite_() {
  return JSON.parse(DriveApp.getFileById(props.getProperty('SITE_FILE_ID')).getBlob().getDataAsString() || '{}');
}

/* ─── 백업 ─── 최근 BACKUP_KEEP 개만 남긴다 */
const BACKUP_KEEP = 60;
function backupFolder_() { return subFolder_(sysFolder_(), '백업'); }
function backupSite_(json, u) {
  if (!json || json === '{}') return;
  const stamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH-mm-ss');
  const folder = backupFolder_();
  folder.createFile(`site ${stamp} (${u.name}).json`, json, 'application/json');
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  files.slice(BACKUP_KEEP).forEach(f => f.setTrashed(true));
}

/* ─── 폴더 ─── */
function root_() { return DriveApp.getFolderById(props.getProperty('ROOT_ID')); }
function sysFolder_() { return subFolder_(root_(), SYS_DIR); }
function subFolder_(parent, name, tag) {
  // tag(멤버 id 등)를 폴더 설명에 적어두면, 이름이 바뀌어도 같은 폴더를 찾아 이름만 고친다
  if (tag) {
    const it = parent.getFolders();
    while (it.hasNext()) {
      const f = it.next();
      if (f.getDescription() === tag) { if (f.getName() !== name) f.setName(name); return f; }
    }
  }
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) { const f = it.next(); if (tag) f.setDescription(tag); return f; }
  const f = parent.createFolder(name);
  if (tag) f.setDescription(tag);
  return f;
}
function ensureFolders_(site) {
  const root = root_();
  (site.members || []).forEach(m => {
    const mf = subFolder_(root, m.name, 'member:' + m.id);
    Object.keys(KINDS).forEach(k => subFolder_(mf, KINDS[k]));
  });
  const gf = subFolder_(root, GROUP_DIR);
  const dirs = [[ALL_DIR, 'group:all'], [DUO_DIR, 'group:duo']].concat((site.groups || []).map(g => [g.label, 'group:' + g.id]));
  dirs.forEach(d => {
    const f = subFolder_(gf, d[0], d[1]);
    GROUP_KINDS.forEach(k => subFolder_(f, KINDS[k]));
  });
}
function targetFolder_(site, kind, members, group) {
  const root = root_();
  if (group || members.length >= 2) {
    const g = (site.groups || []).filter(x => x.id === group)[0];
    const dir = group === 'all' ? [ALL_DIR, 'group:all'] : g ? [g.label, 'group:' + g.id] : [DUO_DIR, 'group:duo'];
    return subFolder_(subFolder_(subFolder_(root, GROUP_DIR), dir[0], dir[1]), KINDS[kind]);
  }
  const m = site.members.filter(x => x.id === members[0])[0];
  return subFolder_(subFolder_(root, m.name, 'member:' + m.id), KINDS[kind]);
}
function cleanMembers_(list, site) {
  const ids = (site.members || []).map(m => m.id);
  return (list || []).filter(id => ids.indexOf(id) >= 0);
}

/* ─── 목록 ─── */
function allItems_() {
  const cached = cacheGet_('items');
  if (cached) return JSON.parse(cached);
  return buildItems_();
}
function buildItems_() {
  const site = readSite_();
  const items = driveItems_(site).concat(linkItems_());
  items.sort((a, b) => (b.at > a.at ? 1 : -1));
  cachePut_('items', JSON.stringify(items), CACHE_TTL);
  return items;
}

function driveItems_(site) {
  const out = [];
  const kindByName = {};
  Object.keys(KINDS).forEach(k => { kindByName[KINDS[k]] = k; });
  const memberByTag = {}, memberByName = {};
  (site.members || []).forEach(m => { memberByTag['member:' + m.id] = m.id; memberByName[m.name] = m.id; });
  const groupByTag = { 'group:all': 'all', 'group:duo': '' }, groupByName = { [ALL_DIR]: 'all', [DUO_DIR]: '' };
  (site.groups || []).forEach(g => { groupByTag['group:' + g.id] = g.id; groupByName[g.label] = g.id; });

  const scanKinds = (folder, base) => {
    const it = folder.getFolders();
    while (it.hasNext()) {
      const kf = it.next();
      const kind = kindByName[kf.getName()];
      if (!kind) continue;
      const files = kf.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        // 드라이브에 직접 넣은 파일: 링크 공유를 켜고(안 켜면 사이트에서 직접 재생이 안 된다) 폴더 기준 정보를 적어 둔다 — 한 번만
        if (!file.getDescription()) adopt_(file, base);
        const meta = parseMeta_(file.getDescription());
        if (!meta.members || !meta.members.length) meta.members = base.members;
        if (meta.group === undefined) meta.group = base.group;
        out.push(fileItem_(file, kind, meta, site));
      }
    }
  };

  const it = root_().getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const name = f.getName();
    if (name === SYS_DIR) continue;
    if (name === GROUP_DIR) {
      const git = f.getFolders();
      while (git.hasNext()) {
        const gf = git.next();
        const gid = groupByTag[gf.getDescription()] !== undefined ? groupByTag[gf.getDescription()] : groupByName[gf.getName()];
        if (gid === undefined) continue;
        const gMembers = gid && gid !== 'all' ? site.members.filter(m => m.group === gid).map(m => m.id) : [];
        scanKinds(gf, { members: gMembers, group: gid });
      }
      continue;
    }
    const mid = memberByTag[f.getDescription()] || memberByName[name];
    if (mid) scanKinds(f, { members: [mid], group: '' });
  }
  return out;
}

function fileItem_(file, kind, meta, site) {
  const name = file.getName();
  return {
    id: file.getId(),
    kind: kind,
    title: meta.title || name.replace(/\.[^.]+$/, ''),
    src: 'drive',
    url: meta.url || '',
    mime: file.getMimeType(),
    size: file.getSize(),
    members: meta.members || [],
    group: meta.group || '',
    by: meta.byName || '',
    byEmail: meta.byEmail || '',
    at: file.getDateCreated().toISOString(),
  };
}

function linkItems_() {
  const rows = sheet_('links').getDataRange().getValues();
  return rows.slice(1).filter(r => r[0]).map(linkItem_);
}
function linkItem_(r) {
  let members = [];
  try { members = JSON.parse(r[4] || '[]'); } catch (e) {}
  return {
    id: r[0], kind: r[1], title: String(r[2] || ''), src: 'link', url: r[3],
    members: members, group: r[5] || '', by: r[7] || '', byEmail: r[6] || '',
    at: r[8] instanceof Date ? r[8].toISOString() : String(r[8] || ''),
    alt: r[9] || '',
  };
}

function favRow_(email) {
  const rows = sheet_('favorites').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] === email) return { index: i + 1, values: rows[i] };
  return null;
}

/* ─── 도구 ─── */
function sheet_(name) { return SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getSheetByName(name); }
function parseMeta_(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// CacheService 는 값 하나에 100KB 까지라 잘라서 넣는다
function cachePut_(key, str, ttl) {
  const cache = CacheService.getScriptCache();
  const size = 90000, n = Math.ceil(str.length / size);
  if (n > 50) return;
  const map = { [key + '_n']: String(n) };
  for (let i = 0; i < n; i++) map[key + '_' + i] = str.substr(i * size, size);
  cache.putAll(map, ttl);
}
function cacheGet_(key) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key + '_n'));
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const got = cache.getAll(keys);
  if (keys.some(k => got[k] == null)) return null;
  return keys.map(k => got[k]).join('');
}
function clearCache_() { CacheService.getScriptCache().remove('items_n'); }
// 올리기·지우기·제목 고치기는 목록을 통째로 다시 읽지 않고 받아 둔 목록만 고친다
function editCache_(fn) {
  const cached = cacheGet_('items');
  if (!cached) return;
  cachePut_('items', JSON.stringify(fn(JSON.parse(cached))), CACHE_TTL);
}

/* 드라이브 목록을 10분마다 미리 읽어 둔다 — 파일이 많아도 사이트가 바로 뜨게.
   setup() 이 걸어 두고, 따로 돌려도 된다 (여러 번 돌려도 하나만 걸린다) */
function warmCache() { buildItems_(); } // 다 읽은 뒤에 갈아 끼우니 읽는 동안에도 사이트는 빠르다
function installWarm() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'warmCache').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('warmCache').timeBased().everyMinutes(10).create();
  warmCache();
  Logger.log('10분마다 목록 미리 읽기를 걸었다');
}

/* ─── 예전 「노래」·「팬아트」 폴더 정리 (한 번만 돌린다) ───
   moveOldPreview() 로 어디로 갈지 기록만 먼저 보고, moveOld() 로 실제로 옮긴다.
   시간이 모자라 멈추면 moveOld() 를 다시 누르면 남은 것부터 이어서 한다. */
const OLD_DIRS = [['노래', 'cover'], ['팬아트', 'fanart']];
const OLD_EXTRA = { '1P5O9ZU9Kyr-AQXKVXVjBPzwIngvvMSs_': { kind: 'fanart', members: ['meri'] } }; // 맨 위에 있던 메리 팬아트 영상
const NAME_ALIASES = {
  gangzi: ['강지'],
  yuni: ['아야츠노 유니', 'Ayatsuno Yuni'],
  huya: ['사키하네 후야', '사키히네 후야', 'Sakihane Huya', '후야'],
  hina: ['시라유키 히나', 'Shirayuki Hina'],
  mashiro: ['네네코 마시로', 'Neneko Mashiro', '마시로'],
  lize: ['아카네 리제', 'Akane Lize', '리제'],
  tabi: ['아라하시 타비', 'Arahashi Tabi', '타비'],
  shibuki: ['텐코 시부키', 'Tenko Shibuki', '시부키'],
  rin: ['아오쿠모 린', 'Aokumo Rin'],
  nana: ['하나코 나나', 'Hanako Nana'],
  riko: ['유즈하 리코', 'Yuzuha Riko', '리코'],
  toa: ['시즈키 토아', 'Shizuki Toa'],
  rang: ['코가네 랑', '코카네 랑', 'Cogane Rang', 'Kogane Rang'],
  hiyori: ['하나요 히요리', 'Hanayo Hiyori', '히요리'],
  meri: ['토키노 메리', 'Tokino Mary', 'Tokino Meri'],
  kanna: ['아이리 칸나', 'Airi Kanna', '藍璃かんな', '칸나'],
};
const GROUP_WORDS = [['gen1', /everys|에브리스/i], ['gen2', /universe|유니버스/i], ['gen3', /clich[ée]|클리셰/i], ['gen4', /abyss|어비스/i], ['all', /stel\s*live|스텔라이브/i]];

function moveOldPreview() { moveOld_(true); }
function moveOld() { moveOld_(false); }

function moveOld_(dry) {
  const site = readSite_();
  const root = root_();
  const start = Date.now();
  const left = [], log = [];
  const place = (file, baseKind, folderText) => {
    const p = classifyOld_(file.getName(), folderText, baseKind, site, OLD_EXTRA[file.getId()]);
    if (!p) return null;
    // 팬아트는 여럿이 나와도 첫 멤버 폴더에 둔다 (설명에 멤버를 다 적어서 각자 페이지에 다 뜬다)
    p.folder = p.kind === 'fanart' && !p.group ? targetFolder_(site, p.kind, p.members.slice(0, 1), '') : targetFolder_(site, p.kind, p.members, p.group);
    return p;
  };
  const handle = (file, baseKind, path) => {
    if (Date.now() - start > 5 * 60 * 1000) throw new Error('시간이 모자라 멈췄다. moveOld 를 한 번 더 돌리면 이어서 한다');
    const p = place(file, baseKind, path);
    if (!p) { left.push(path + '/' + file.getName()); return; }
    log.push(KINDS[p.kind] + ' ← ' + p.title + '  [' + (p.group || p.members.join(',')) + ']');
    if (dry) return;
    const old = parseMeta_(file.getDescription());
    file.setDescription(JSON.stringify({ title: p.title, members: p.members, group: p.group, byName: old.byName || '', byEmail: old.byEmail || '' }));
    try { sharePublic_(file); } catch (e) { Logger.log('공유 실패: ' + file.getName()); }
    file.moveTo(p.folder);
  };
  const walk = (folder, baseKind, path) => {
    const files = folder.getFiles();
    while (files.hasNext()) handle(files.next(), baseKind, path);
    const subs = folder.getFolders();
    while (subs.hasNext()) { const f = subs.next(); walk(f, baseKind, path + '/' + f.getName()); }
  };
  try {
    OLD_DIRS.forEach(d => { const it = root.getFoldersByName(d[0]); while (it.hasNext()) walk(it.next(), d[1], d[0]); });
    Object.keys(OLD_EXTRA).forEach(id => {
      const f = DriveApp.getFileById(id);
      const parent = f.getParents();
      if (parent.hasNext() && parent.next().getId() === root.getId()) handle(f, OLD_EXTRA[id].kind, '');
    });
  } finally {
    if (!dry) clearCache_();
    Logger.log((dry ? '[미리보기] ' : '') + log.length + '개 ' + (dry ? '옮길 예정' : '옮김') + '\n' + log.join('\n'));
    if (left.length) Logger.log('멤버를 못 찾아서 그대로 둔 것 ' + left.length + '개 (직접 옮기거나 사이트에서 올리면 된다)\n' + left.join('\n'));
  }
}

function classifyOld_(name, folderText, baseKind, site, extra) {
  const order = (site.members || []).map(m => m.id);
  const findMembers = text => {
    const low = text.toLowerCase();
    return order.filter(id => (NAME_ALIASES[id] || []).some(a => low.indexOf(a.toLowerCase()) >= 0));
  };
  const named = extra ? extra.members : findMembers(name);
  let members = named.length ? named : findMembers(folderText);
  let group = '';
  if (!extra && !named.length) {
    // 파일 이름에 멤버가 없고 기수 / 스텔라이브 이름이 있으면 단체곡으로 본다
    const g = GROUP_WORDS.filter(w => w[1].test(name))[0];
    if (g) { group = g[0]; members = g[0] === 'all' ? [] : site.members.filter(m => m.group === g[0]).map(m => m.id); }
  }
  if (!members.length && !group) return null;
  let kind = extra ? extra.kind : baseKind;
  if (kind === 'cover' && !/cover|커버|mashup|매쉬업|메들리|medley/i.test(name)) kind = 'original';
  const title = name.replace(/\.[^.]+$/, '').replace(/_MP3( \(\d+\))?$/i, '').trim();
  return { kind: kind, members: members, group: group, title: title };
}

/* ─── 댓글 ─── 스프레드시트 comments 시트: id, item, email, name, text, at
   이메일은 밖으로 내보내지 않고, 주인 확인용 해시만 보낸다 */
function commentsSheet_() {
  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  return ss.getSheetByName('comments') || (() => { const sh = ss.insertSheet('comments'); sh.appendRow(['id', 'item', 'email', 'name', 'text', 'at']); return sh; })();
}
function emailHash_(email) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(email || '').toLowerCase(), Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function commentOut_(r) {
  return { id: r[0], item: r[1], hash: emailHash_(r[2]), name: r[3], text: r[4], at: r[5] instanceof Date ? r[5].toISOString() : String(r[5] || '') };
}
function commentsFor_(item) {
  if (!item) return [];
  return commentsSheet_().getDataRange().getValues().slice(1).filter(r => r[1] === item).map(commentOut_);
}
function commentCounts_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('ccounts');
  if (hit) return JSON.parse(hit);
  const out = {};
  commentsSheet_().getDataRange().getValues().slice(1).forEach(r => { if (r[1]) out[r[1]] = (out[r[1]] || 0) + 1; });
  cache.put('ccounts', JSON.stringify(out), 600);
  return out;
}

/* ─── 저장 공간 ─── 아카이브 파일이 쓰는 양 + 이 계정의 남은 공간 (학교 계정은 공용이라 0 이면 '공용') */
function storage_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('storage');
  if (hit) return JSON.parse(hit);
  const files = allItems_().filter(i => i.src === 'drive');
  const out = { files: files.length, bytes: files.reduce((a, i) => a + (i.size || 0), 0), used: 0, limit: 0 };
  try { out.used = DriveApp.getStorageUsed(); out.limit = DriveApp.getStorageLimit(); } catch (e) {}
  cache.put('storage', JSON.stringify(out), 600);
  return out;
}

/* ─── 출석 ─── 스프레드시트 attendance 시트: email, name, date(yyyy-MM-dd, 한국 시간) */
function kstToday_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); }
function attSheet_() {
  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  return ss.getSheetByName('attendance') || (() => { const sh = ss.insertSheet('attendance'); sh.appendRow(['email', 'name', 'date']); sh.getRange('C:C').setNumberFormat('@'); return sh; })();
}
function attDates_(sh, email) {
  const hits = sh.getRange('A:A').createTextFinder(email).matchEntireCell(true).findAll();
  return hits.map(r => {
    const v = sh.getRange(r.getRow(), 3).getValue();
    return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd') : String(v);
  });
}

/* ─── 내 일정 ─── 스프레드시트 myEvents 시트: id, email, date, title, color */
function mySheet_() {
  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  return ss.getSheetByName('myEvents') || (() => { const sh = ss.insertSheet('myEvents'); sh.appendRow(['id', 'email', 'date', 'title', 'color']); sh.getRange('C:C').setNumberFormat('@'); return sh; })();
}
function myRow_(r) {
  return { id: r[0], date: r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Seoul', 'yyyy-MM-dd') : String(r[2]), title: String(r[3]), color: String(r[4] || '#7c6cf0') };
}

/* 드라이브에 직접 넣은 파일을 사이트 파일로 받아들인다 */
function adopt_(file, base) {
  try { sharePublic_(file); } catch (e) { Logger.log('공유 실패: ' + file.getName() + ' — ' + e.message); return; }
  try {
    file.setDescription(JSON.stringify({ title: file.getName().replace(/\.[^.]+$/, '').replace(/_MP3( \(\d+\))?$/i, ''), members: base.members, group: base.group, byName: '', byEmail: '' }));
  } catch (e) {}
}

/* 이미 들어 있는 파일 중 공유가 꺼진 것을 한 번에 켠다 (편집기에서 한 번 돌리면 된다) */
function fixSharing() {
  let n = 0;
  const walk = f => {
    const fs = f.getFiles();
    while (fs.hasNext()) {
      const file = fs.next();
      try { if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) { sharePublic_(file); n++; } } catch (e) {}
    }
    const ds = f.getFolders();
    while (ds.hasNext()) { const d = ds.next(); if (d.getName() !== SYS_DIR) walk(d); }
  };
  walk(root_());
  clearCache_();
  Logger.log('공유를 켠 파일: ' + n + '개');
}

/* ─── 방송 일정 ─── 스프레드시트 schedule 시트: id, date, time, member, type, title, url, email, name, at */
function schSheet_() {
  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  return ss.getSheetByName('schedule') || (() => { const sh = ss.insertSheet('schedule'); sh.appendRow(['id', 'date', 'time', 'member', 'type', 'title', 'url', 'email', 'name', 'at']); sh.getRange('B:C').setNumberFormat('@'); return sh; })();
}
function schRow_(r) {
  const d = v => v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd') : String(v);
  const tm = v => v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'HH:mm') : String(v || '');
  return { id: r[0], date: d(r[1]), time: tm(r[2]), member: r[3], type: r[4], title: String(r[5] || ''), url: String(r[6] || ''), by: String(r[8] || ''), hash: emailHash_(r[7]) };
}
function scheduleFor_(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const cache = CacheService.getScriptCache(), hit = cache.get('sch_' + month);
  if (hit) return JSON.parse(hit);
  const out = schSheet_().getDataRange().getValues().slice(1).map(schRow_).filter(e => e.date.indexOf(month) === 0);
  cache.put('sch_' + month, JSON.stringify(out), 300);
  return out;
}

/* ─── stellight.fans 조사 (한 번만 돌려 보는 용도) ───
   그 사이트가 방송 일정 데이터를 어디서 받아오는지 찾는다. 결과 로그를 복사해서 보내 주면 된다 */
function probeStellight() {
  const base = 'https://stellight.fans/';
  const get = u => { try { const r = UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: true }); return { code: r.getResponseCode(), text: r.getContentText() }; } catch (e) { return { code: 0, text: String(e) }; } };
  const home = get(base);
  Logger.log('홈: ' + home.code + ' · ' + home.text.length + '자');
  const scripts = (home.text.match(/<script[^>]+src="([^"]+)"/g) || []).map(s => s.match(/src="([^"]+)"/)[1]).map(s => s.startsWith('http') ? s : base + s.replace(/^\//, ''));
  Logger.log('스크립트: ' + scripts.join(' , '));
  const found = {};
  scripts.slice(0, 8).forEach(u => {
    const js = get(u).text;
    (js.match(/https?:\/\/[A-Za-z0-9.\-]+(?:\/[A-Za-z0-9_\-./?=&%]*)?/g) || []).forEach(x => { if (!/w3\.org|reactjs|github\.com\/facebook|mozilla/.test(x)) found[x] = 1; });
    ['firebase', 'firestore', 'supabase', 'projectId', 'apiKey', 'schedule', 'spreadsheets', 'sheets.googleapis', '/api/'].forEach(k => {
      let i = js.indexOf(k), n = 0;
      while (i >= 0 && n < 3) { Logger.log(k + ' ▸ ' + js.slice(Math.max(0, i - 80), i + 120).replace(/\s+/g, ' ')); i = js.indexOf(k, i + 1); n++; }
    });
  });
  Logger.log('주소들:\n' + Object.keys(found).slice(0, 80).join('\n'));
}

/* stellight.fans 조사 2: API 주소 끝부분을 찾고, 그럴듯한 주소들을 실제로 불러 본다 */
function probeStellight2() {
  const get = u => { try { const r = UrlFetchApp.fetch(u, { muteHttpExceptions: true, headers: { Accept: 'application/json' } }); return { code: r.getResponseCode(), text: r.getContentText() }; } catch (e) { return { code: 0, text: String(e) }; } };
  const js = get('https://stellight.fans/assets/index-D5lgs5Cd.js').text;
  const paths = {};
  // $axios.get("/..."), .get(`/...`), "/schedules" 같은 글자를 모은다
  (js.match(/\.(?:get|post)\(\s*["'`]\/[^"'`]{1,80}["'`]/g) || []).forEach(s => paths[s] = 1);
  (js.match(/["'`]\/(?:schedules?|streams?|members?|talents?|events?|calendar)[^"'`]{0,60}["'`]/gi) || []).forEach(s => paths[s] = 1);
  Logger.log('찾은 주소 조각:\n' + Object.keys(paths).slice(0, 60).join('\n'));
  ['schedules', 'schedule', 'schedules?page=1', 'members', 'streamers', 'talents', 'events'].forEach(p => {
    const r = get('https://stellight.fans/api/v1/' + p);
    Logger.log('/api/v1/' + p + ' → ' + r.code + ' · ' + r.text.slice(0, 700).replace(/\s+/g, ' '));
  });
}
