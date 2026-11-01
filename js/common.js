/* 사이트와 관리자 페이지가 같이 쓰는 것들: 데이터, 서버 요청, 로그인, 별표 */

const CFG = window.CONFIG || {};
const LIVE = !!CFG.scriptUrl;

const KINDS = [
  { id: 'cover',    name: '커버곡', music: true  },
  { id: 'original', name: '오리곡', music: true  },
  { id: 'album',    name: '앨범',   music: true  },
  { id: 'clip',     name: '클립',   music: false },
  { id: 'shorts',   name: '쇼츠',   music: false },
  { id: 'fanart',   name: '팬아트', music: false, image: true },
  { id: 'meme',     name: '짤',     music: false, image: true },
];
const KIND = Object.fromEntries(KINDS.map(k => [k.id, k]));
const GROUP_KINDS = ['cover', 'original', 'album', 'clip'];

/* ─── 작은 도구 ─── */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('stl.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('stl.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('stl.' + k); } catch {} },
};

// sticky: 끝날 때까지 띄워 둔다 (지우는 중 같은 것)
function toast(msg, bad, sticky) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.append(t); }
  t.textContent = typeof stripMarks === 'function' ? stripMarks(msg) : msg;
  t.className = 'show' + (bad ? ' bad' : '') + (sticky ? ' busy' : '');
  clearTimeout(toast._t);
  if (!sticky) toast._t = setTimeout(() => (t.className = ''), 2600);
}

/* 저장 공간 — 서버에서 아카이브가 쓰는 용량과 계정 남은 용량을 받아 온다 (10분 기억) */
const Quota = {
  data: null, p: null,
  load() {
    if (!LIVE) return Promise.resolve(null);
    return (this.p ||= fetch(CFG.scriptUrl + '?action=storage').then(r => r.json()).then(r => (this.data = r.ok ? r : null)).catch(() => null)
      .finally(() => setTimeout(() => (this.p = null), 600e3)));
  },
  text() {
    const d = this.data;
    if (!d) return '';
    const parts = [`아카이브 파일 ${d.files}개 · ${fmtBytes(d.bytes)}`];
    if (d.limit > 0) parts.push(`남은 공간 ${fmtBytes(Math.max(0, d.limit - d.used))} / ${fmtBytes(d.limit)}`);
    else parts.push('학교 공용 저장소 사용 중');
    return parts.join(' · ');
  },
};
function fmtBytes(n) {
  n = +n || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'TB';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'GB';
  if (n >= 1e6) return Math.round(n / 1e6) + 'MB';
  return Math.round(n / 1e3) + 'KB';
}

/* ─── 이미지·영상 주소 ─── */
const driveId = s => {
  if (!s) return '';
  const m = String(s).match(/(?:\/d\/|[?&]id=|\/folders\/)([\w-]{20,})/);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(s) ? s : '';
};
// 관리자가 넣은 이미지: 드라이브 id 이거나 일반 주소
const imgUrl = (s, w = 800) => {
  if (!s) return '';
  const id = driveId(s);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${w}` : s;
};

function parseLink(url) {
  const u = String(url || '');
  let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/)))
    return { type: 'youtube', id: m[1] };
  if ((m = u.match(/chzzk\.naver\.com\/(?:embed\/)?clips?\/([\w-]+)/))) return { type: 'chzzk', id: m[1] };
  if ((m = u.match(/chzzk\.naver\.com\/video\/(\d+)/))) return { type: 'chzzkVideo', id: m[1] };
  if (/(?:x|twitter)\.com\//.test(u)) return { type: 'x' };
  if ((m = driveId(u)) && /drive\.google|docs\.google/.test(u)) return { type: 'drive', id: m };
  if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(u)) return { type: 'image' };
  if (/\.(mp4|webm|mp3|m4a|ogg)(\?|$)/i.test(u)) return { type: 'media' };
  return { type: 'link' };
}

// 아이템 하나를 화면에서 쓰기 좋게 풀어둔다.
// 노래 하나에 유튜브(ytId)와 드라이브 파일(driveId)이 둘 다 붙을 수 있다 — 플레이어가 골라서 튼다.
function enrich(it) {
  if (it._ok) return it;
  const driveThumb = id => `https://drive.google.com/thumbnail?id=${id}&sz=w480`;
  const mediaKind = () => (KIND[it.kind]?.music || it.kind === 'clip' ? 'video' : '');
  if (it.src === 'drive') {
    it.driveId = it.id;
    it.media = /^(video|audio)\//.test(it.mime || '') ? (it.mime.startsWith('audio') ? 'audio' : 'video') : '';
    it.isImage = /^image\//.test(it.mime || '');
    it.thumb = driveThumb(it.id);
    it.open = `https://drive.google.com/file/d/${it.id}/view`;
    const p = it.url ? parseLink(it.url) : null;
    if (p?.type === 'youtube') { it.ytId = p.id; it.thumb = `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg`; it.ytUrl = it.url; }
  } else {
    const p = parseLink(it.url);
    it.link = p;
    it.open = it.url;
    if (p.type === 'youtube') { it.ytId = p.id; it.thumb = `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg`; it.ytUrl = it.url; }
    if (p.type === 'drive') { it.driveId = p.id; it.thumb = driveThumb(p.id); it.media = mediaKind(); it.isImage = KIND[it.kind]?.image; }
    if (p.type === 'image') { it.isImage = true; it.thumb = it.url; }
    if (p.type === 'media') { it.media = /\.(mp3|m4a|ogg)/i.test(it.url) ? 'audio' : 'video'; it.directUrl = it.url; }
    const alt = driveId(it.alt);
    if (alt && !it.driveId) { it.driveId = alt; it.media ||= mediaKind(); it.thumb ||= driveThumb(alt); }
  }
  it.hasDrive = !!(it.driveId && it.media);
  it.playable = !!(it.ytId || it.media);
  it._ok = true;
  return it;
}

/* ─── 테마 ─── 밤하늘 · 라벤더 · 하양, 고른 것은 이 브라우저에 기억 */
const THEMES = [
  { id: 'dark', name: '밤하늘' },
  { id: 'lavender', name: '라벤더' },
  { id: 'white', name: '하양' },
];
const Theme = {
  get() { return store.get('theme', 'dark'); },
  // 누른 동그라미 자리에서 새 테마가 부드러운 원으로 번지며 바뀐다 (View Transitions 지원 브라우저)
  set(id, from) {
    if (id === document.documentElement.dataset.theme) return;
    const apply = () => {
      store.set('theme', id);
      document.documentElement.dataset.theme = id;
      $$('[data-theme-pick]').forEach(b => b.setAttribute('aria-pressed', b.dataset.themePick === id));
      window.dispatchEvent(new Event('themechange'));
    };
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || still) return apply();
    const r = from?.getBoundingClientRect?.();
    const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2;
    const root = document.documentElement.style;
    root.setProperty('--vt-x', x + 'px');
    root.setProperty('--vt-y', y + 'px');
    root.setProperty('--vt-end', Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 240 + 'px');
    document.startViewTransition(apply);
  },
  dots() {
    const cur = this.get();
    return `<span class="dots" role="group" aria-label="테마">${THEMES.map(t =>
      `<button type="button" class="dot dot-${t.id}" data-theme-pick="${t.id}" aria-pressed="${t.id === cur}" aria-label="${t.name} 테마" title="${t.name}"></button>`).join('')}</span>`;
  },
};
document.documentElement.dataset.theme = Theme.get();
document.addEventListener('click', e => {
  const b = e.target.closest('[data-theme-pick]');
  if (b) Theme.set(b.dataset.themePick, b);
});

/* ─── 데이터 ─── */
const Data = {
  site: null,
  items: [],
  listeners: [],
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn()); },

  async load() {
    // 1) 지난번 받아둔 것 → 바로 그림  2) 서버(없으면 site.json) → 다시 그림
    const cached = store.get('cache');
    if (cached && LIVE) { this.set(cached.site, cached.items); }
    try {
      if (LIVE) {
        // 사이트 설정(빠름)과 드라이브 목록(파일이 많으면 느림)을 따로 받아서, 온 것부터 그린다
        const get = a => fetch(CFG.scriptUrl + '?action=' + a).then(r => r.json());
        const itemsP = get('items');
        const s = await get('site');
        if (!s.ok) { // 예전 서버 코드면 한 번에 받는다
          const res = await get('bootstrap');
          if (!res.ok) throw new Error(res.error);
          this.set(res.site, res.items);
          store.set('cache', { site: res.site, items: res.items });
          return;
        }
        let items = cached?.items || [];
        this.set(s.site, items);
        store.set('cache', { site: s.site, items });
        const r = await itemsP;
        if (!r.ok) throw new Error(r.error);
        this.set(s.site, r.items);
        store.set('cache', { site: s.site, items: r.items });
      } else {
        const site = await fetch('data/site.json', { cache: 'no-cache' }).then(r => r.json());
        this.set(site, store.get('demoItems', []));
      }
    } catch (e) {
      console.error(e);
      if (!this.site) {
        const site = await fetch('data/site.json').then(r => r.json()).catch(() => ({ groups: [], members: [], events: [] }));
        this.set(site, []);
      }
      toast('서버에서 목록을 못 받아왔다', true);
    }
  },

  set(site, items) {
    site.groups ||= []; site.members ||= []; site.events ||= []; site.banner ||= {};
    this.site = site;
    this.items = (items || []).map(enrich);
    audioThumbs(this.items, site);
    this.emit();
  },

  member(id) { return this.site.members.find(m => m.id === id); },
  group(id) { return this.site.groups.find(g => g.id === id); },
  membersOf(gid) { return this.site.members.filter(m => m.group === gid); },
  item(id) { return this.items.find(i => i.id === id); },

  // 멤버 페이지: 그 멤버가 들어간 것 전부 (단체 것 포함)
  forMember(mid, kind) {
    return this.items.filter(i => (!kind || i.kind === kind) && i.members.includes(mid));
  },
  // 단체: 기수 단체곡이거나, 멤버가 두 명 이상인 것
  isGroupItem(i) { return !!i.group || i.members.length >= 2; },
};

/* mp3 같은 소리 파일은 드라이브 썸네일이 없다.
   보는 사람이 노래 듣기 화면에서 고른 대로(이 브라우저에 기억) 그 멤버 팬아트 중 하나(들어올 때마다 랜덤) 또는 프로필 사진을 표지로 쓴다 */
function audioThumbs(items, site) {
  const arts = {};
  items.forEach(i => { if (i.kind === 'fanart' && i.thumb) i.members.forEach(m => (arts[m] ||= []).push(i.thumb)); });
  items.forEach(it => {
    if (it.media !== 'audio' || it.ytId) return;
    const mid = it.members[0] || site.members.find(m => m.group === it.group)?.id;
    const m = site.members.find(x => x.id === mid);
    const prof = m && firstSrc(m.avatar) ? imgUrl(firstSrc(m.avatar), 640) : '';
    const pool = arts[mid] || [];
    it.thumb = store.get('audioCover', 'fanart') === 'fanart' && pool.length ? pool[Math.floor(Math.random() * pool.length)] : prof;
  });
}

/* 영상 썸네일이 어둡고 무채색(검정·회색)인지 본다 — 그러면 노래 창 배경을 영상 색 대신 원래 테마 색으로 둔다.
   작은 썸네일 한 장을 24×24 로 줄여서 보고, 결과는 이 브라우저에 기억해서 다음엔 다시 안 본다.
   그림을 읽을 수 없으면(다른 사이트가 막으면) 그냥 원래처럼 영상 색을 쓴다 */
const Tone = {
  cache: store.get('tone', {}),
  known(it) { return this.cache[it.id]; },
  async dull(it) {
    if (it.id in this.cache) return this.cache[it.id];
    const src = await this.src(it);
    if (!src) return false;
    const v = await new Promise(ok => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = 24;
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0, 24, 24);
          const d = x.getImageData(0, 0, 24, 24).data;
          let l = 0, s = 0;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
            l += 0.2126 * r + 0.7152 * g + 0.0722 * b;
            s += Math.max(r, g, b) - Math.min(r, g, b);
          }
          ok({ l: l / (d.length / 4), s: s / (d.length / 4) });
        } catch { ok(null); }
      };
      img.onerror = () => ok(null);
      setTimeout(() => ok(null), 5000);
      img.src = src;
    });
    if (!v) return false;
    const dull = v.l < 0.14 || (v.s < 0.12 && v.l < 0.6);
    this.cache[it.id] = dull;
    const keys = Object.keys(this.cache);
    if (keys.length > 2000) keys.slice(0, 500).forEach(k => delete this.cache[k]);
    store.set('tone', this.cache);
    return dull;
  },
  async src(it) {
    if (it.ytId) return `https://i.ytimg.com/vi/${it.ytId}/mqdefault.jpg`;
    if (it.driveId && CFG.driveApiKey) {
      try {
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${it.driveId}?fields=thumbnailLink&supportsAllDrives=true&key=${CFG.driveApiKey}`).then(r => r.json());
        return r.thumbnailLink || '';
      } catch { return ''; }
    }
    return /^https?:/.test(it.thumb || '') ? it.thumb : '';
  },
};

// 나무위키: 따로 적은 주소가 없으면 정식 이름(예: 아오쿠모 린) 문서로 간다
const namuLink = m => m.links?.namu || (m.fullName ? 'https://namu.wiki/w/' + encodeURIComponent(m.fullName) : '');

/* ─── 서버 요청 ─── */
async function api(action, payload = {}) {
  if (!LIVE) throw new Error('아직 서버(Apps Script)가 연결되지 않았다. README 를 보자');
  const token = await Auth.fresh();
  if (!token) throw new Error('먼저 구글 로그인을 하자');
  // text/plain 으로 보내야 Apps Script 가 CORS 사전 요청 없이 받는다
  const res = await fetch(CFG.scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, idToken: token, ...payload }),
  }).then(r => r.json());
  if (!res.ok) {
    if (/로그인/.test(res.error)) Auth.logout(true);
    throw new Error(res.error);
  }
  return res;
}

function fileToBase64(file) {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = bad;
    r.readAsDataURL(file);
  });
}

/* ─── 구글 로그인 ─── */
const Auth = {
  user: null,
  listeners: [],
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn(this.user)); },

  init() {
    const saved = store.get('auth');
    if (saved && saved.exp * 1000 > Date.now() + 60e3) { this.user = saved; setTimeout(() => this.checkAdmin(), 0); }
    else store.del('auth');
    if (!CFG.googleClientId) { this.emit(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      google.accounts.id.initialize({
        client_id: CFG.googleClientId,
        callback: r => this.receive(r.credential),
        auto_select: true,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
        itp_support: true,
      });
      this.emit();
      // 전에 로그인했던 사람은 들어오자마자 자동으로 다시 로그인한다
      if (!this.user && store.get('wasLoggedIn')) this.silent();
      this.schedule();
    };
    document.head.append(s);
    this.emit();
  },

  receive(credential) {
    const p = JSON.parse(decodeURIComponent(escape(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))));
    const admin = this.user?.email === p.email && this.user?.admin;
    this.user = { token: credential, email: p.email, name: p.name || p.email, picture: p.picture || '', exp: p.exp, admin };
    store.set('auth', this.user);
    store.set('wasLoggedIn', true);
    this.waiters?.forEach(fn => fn());
    this.waiters = [];
    this.schedule();
    this.emit();
    this.checkAdmin();
  },
  // 관리자면 남이 올린 것도 고치고 지울 수 있게 표시해 둔다 (들어올 때마다 서버에 다시 물어본다)
  checkAdmin() {
    if (!LIVE || !this.user) return;
    const email = this.user.email;
    api('whoami').then(r => {
      if (this.user?.email !== email || !!r.user?.admin === !!this.user.admin) return;
      this.user.admin = !!r.user?.admin;
      store.set('auth', this.user);
      this.emit();
    }).catch(() => {});
  },

  token() {
    if (this.user && this.user.exp * 1000 < Date.now() + 30e3) this.logout(true);
    return this.user?.token || '';
  },
  // 구글 로그인 표시는 1시간마다 만료된다 → 만료 전에 조용히 새로 받는다 (창이 안 뜨고 자동으로)
  silent() {
    if (!window.google?.accounts?.id) return;
    try { google.accounts.id.prompt(); } catch (e) {}
  },
  schedule() {
    clearTimeout(this._refresh);
    if (!this.user) return;
    const wait = this.user.exp * 1000 - Date.now() - 5 * 60e3;
    this._refresh = setTimeout(() => this.silent(), Math.max(10e3, wait));
  },
  // 요청 전에: 곧 만료면 새로 받을 때까지 잠깐 기다린다
  async fresh() {
    if (this.user && this.user.exp * 1000 > Date.now() + 60e3) return this.user.token;
    if (!store.get('wasLoggedIn') || !window.google?.accounts?.id) return this.token();
    this.silent();
    await new Promise(ok => { (this.waiters ||= []).push(ok); setTimeout(ok, 6000); });
    return this.token();
  },

  renderButton(el) {
    if (!window.google?.accounts?.id) {
      el.innerHTML = `<button class="btn sm" disabled title="config.js 에 googleClientId 를 넣어야 한다">${esc(typeof tRaw === 'function' ? tRaw('login.button') : '구글 로그인')}</button>`;
      return;
    }
    el.innerHTML = '';
    google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin', locale: 'ko' });
  },

  logout(expired) {
    this.user = null;
    store.del('auth');
    clearTimeout(this._refresh);
    if (expired && store.get('wasLoggedIn')) { this.emit(); this.silent(); return; } // 만료: 조용히 다시 로그인
    store.del('wasLoggedIn');
    if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    if (expired) toast('로그인이 만료됐다. 다시 로그인하자', true);
    this.emit();
  },
};

/* ─── 별표 ─── 로그인하면 구글 계정에, 아니면 이 브라우저에 */
const Favs = {
  ids: new Set(store.get('favs', [])),
  listeners: [],
  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn()); },
  has(id) { return this.ids.has(id); },
  toggle(id) {
    this.ids.has(id) ? this.ids.delete(id) : this.ids.add(id);
    this.save();
    this.emit();
    return this.ids.has(id);
  },
  save() {
    store.set('favs', [...this.ids]);
    if (!Auth.user || !LIVE) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => api('setFavorites', { ids: [...this.ids] }).catch(e => toast(e.message, true)), 800);
  },
  async sync() {
    if (!Auth.user || !LIVE) return;
    try {
      const { ids } = await api('getFavorites');
      const before = this.ids.size;
      ids.forEach(id => this.ids.add(id));
      store.set('favs', [...this.ids]);
      if (this.ids.size !== ids.length) this.save(); // 이 기기에만 있던 별표를 계정에 합친다
      if (this.ids.size !== before) this.emit();
    } catch (e) { console.warn(e); }
  },
};

/* ─── 아이콘 ─── */
const ICON = {
  chzzk: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 4h14l-8 7h7L5 20l5-7H5z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 4h4.5v16H6zm7.5 0H18v16h-4.5z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 5v14l10-7zm11 0h3v14h-3z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 5v14L9 12zM5 5h3v14H5z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5c.5 4.8 2.7 8 9.5 9.5-6.8 1.5-9 4.7-9.5 9.5-.5-4.8-2.7-8-9.5-9.5 6.8-1.5 9-4.7 9.5-9.5z"/></svg>',
  starO: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M12 2.5c.5 4.8 2.7 8 9.5 9.5-6.8 1.5-9 4.7-9.5 9.5-.5-4.8-2.7-8-9.5-9.5 6.8-1.5 9-4.7 9.5-9.5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  video: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 6h13v12H3zM16 10l5-3v10l-5-3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  chevL: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>',
  comment: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 5h16v11H9l-5 4z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  namu: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5c-3.6 0-6.5 2.7-6.5 6 0 .9.2 1.7.6 2.5A4.3 4.3 0 0 0 4 14.6c0 2.4 2 4.3 4.5 4.3H11V22h2v-3.1h2.5c2.5 0 4.5-1.9 4.5-4.3a4.3 4.3 0 0 0-2.1-3.6c.4-.8.6-1.6.6-2.5 0-3.3-2.9-6-6.5-6z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1c.6 6.3 4.7 10.4 11 11-6.3.6-10.4 4.7-11 11-.6-6.3-4.7-10.4-11-11C7.3 11.4 11.4 7.3 12 1z"/></svg>',
};

/* ─── 우주 배경 ─── */
function starfield(canvas) {
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars = [], w, h, dpr;
  // 별 색은 테마마다 다르다 (밤하늘: 흰 별, 하양: 연보라 별)
  let rgb = '255,255,255', tint = '200,190,255';
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    rgb = cs.getPropertyValue('--star').trim() || rgb;
    tint = cs.getPropertyValue('--star2').trim() || tint;
    if (still) draw(0);
  };
  addEventListener('themechange', readColors);
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    const n = Math.round((innerWidth * innerHeight) / 2600);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() ** 3 * 1.4 + 0.3) * dpr,
      a: Math.random() * 0.7 + 0.2,
      s: Math.random() * 0.002 + 0.0006,
      p: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.18 ? 260 : Math.random() < 0.3 ? 210 : 0,
    }));
  };
  const draw = t => {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = still ? s.a : s.a * (0.55 + 0.45 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(${s.hue ? tint : rgb},${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    if (!still) requestAnimationFrame(draw);
  };
  addEventListener('resize', () => { resize(); if (still) draw(0); });
  resize();
  readColors();
  requestAnimationFrame(draw);
}

/* 멤버 동그라미/카드에 쓰는 그림 (이미지가 없으면 색 + 이름 첫 글자) */
function avatarHtml(m, cls = 'av') {
  if (!m) return '';
  const img = imgUrl(typeof firstSrc === 'function' ? firstSrc(m.avatar) : m.avatar, 400);
  return img
    ? `<span class="${cls}" style="--c:${esc(m.color)}"><img src="${esc(img)}" alt="" loading="lazy"></span>`
    : `<span class="${cls} ph" style="--c:${esc(m.color)}">${esc(m.name.slice(0, 1))}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* 관리자가 바꾼 테마 색을 덮어쓴다 — site.themeColors = { dark: { bg, fg, accent, wall }, ... } */
const THEME_VARS = { bg: '--bg', fg: '--fg', dim: '--dim', accent: '--accent', panel: '--panel', wall: '--wall', wallFg: '--wall-fg', btn: '--btn', btnFg: '--btn-fg' };
function applySiteStyle(site) {
  let el = document.getElementById('siteStyle');
  if (!el) { el = document.createElement('style'); el.id = 'siteStyle'; document.head.append(el); }
  const tc = site?.themeColors || {};
  el.textContent = Object.entries(tc).map(([theme, vals]) => {
    const decl = Object.entries(vals || {}).filter(([k, v]) => THEME_VARS[k] && /^#[0-9a-f]{3,8}$/i.test(v)).map(([k, v]) => `${THEME_VARS[k]}:${v}`).join(';');
    return decl ? `[data-theme="${theme}"]{${decl}}` : '';
  }).join('\n');
  window.dispatchEvent(new Event('themechange'));
}

/* ─── 백업 ─── 이 브라우저에 사이트 데이터 사본을 최근 30개까지 남긴다 */
const Backups = {
  max: 30,
  list() { return store.get('backups', []); },
  add(label, site) {
    const json = JSON.stringify(site);
    const list = this.list();
    if (list[0]?.json === json) return; // 바로 앞과 같으면 또 남기지 않는다
    list.unshift({ at: new Date().toISOString(), label, json });
    while (list.length > this.max) list.pop();
    try { store.set('backups', list); } catch { list.splice(10); store.set('backups', list); }
  },
  remove(i) { const l = this.list(); l.splice(i, 1); store.set('backups', l); },
  download(site, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(site, null, 2)], { type: 'application/json' }));
    a.download = name || `stellive-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
  },
};
