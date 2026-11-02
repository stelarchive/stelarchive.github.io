/* 보는 사람용 화면 — #/ 주소로 페이지를 바꾼다
   #/              홈 (배너 · 캘린더 · 기수별 멤버 · 졸업 · 맨 아래)
   #/m/id/탭        멤버 프로필
   #/group/기수/탭   단체 · 합방
   #/listen        노래 듣기
   #/calendar      캘린더
   #/stars         별표
   #/about         소개 · 2차 창작 가이드라인 */

const view = $('#view');
const state = { calMonth: null, calPick: null, listenKinds: new Set(['cover', 'original', 'album']), search: '', guideOpen: 1, feedWho: { shorts: '' }, feedType: '' };

// 프로필 탭 순서는 홈/단체와 다르다 (팬아트·짤을 앞으로)
const PROFILE_TABS = ['cover', 'fanart', 'meme', 'clip', 'shorts', 'original', 'album'];

/* ─── 공통 조각 ─── */
// 편집 모드에서 멤버·기수 정보(이름, 소개…)를 그 자리에서 고칠 수 있게 표시한다
const ef = (path, value, ph = '') => EDIT
  ? `<span class="ed-t" data-field="${esc(path)}" data-ph="${esc(ph)}">${esc(value || '')}</span>`
  : esc(value || '');
const pad2 = n => String(n).padStart(2, '0');
const memberNames = it => it.members.map(id => Data.member(id)?.name).filter(Boolean);
// 올린 사람(또는 관리자)만 고치고 지울 수 있다
const canDelete = it => !!Auth.user && (Auth.user.admin || (!!it.byEmail && Auth.user.email === it.byEmail));
const ownBtns = it => canDelete(it) ? `<button type="button" class="icon-btn sm" data-rename="${esc(it.id)}" aria-label="${esc(t('list.rename'))}" title="${esc(t('list.rename'))}">${ICON.pencil}</button><button type="button" class="icon-btn sm" data-del="${esc(it.id)}" aria-label="${esc(t('list.delete'))}">${ICON.trash}</button>` : '';
const active = () => Data.site.members.filter(m => !m.graduated);
const graduates = () => Data.site.members.filter(m => m.graduated);
const genNo = g => pad2(Data.site.groups.indexOf(g));

function linkBtns(m) {
  const L = { ...(m.links || {}), namu: namuLink(m) };
  const i = Data.site.members.indexOf(m);
  // data-link: 편집 모드에서 누르면 그 링크 주소를 바로 고친다
  const one = (k, title) => `<a class="lk ${L[k] ? '' : 'off'}" href="${esc(L[k] || '#')}" target="_blank" rel="noopener" title="${title}" aria-label="${esc(m.name)} ${title}" data-link="members.${i}.links.${k}">${ICON[k]}</a>`;
  return one('chzzk', t('link.chzzk')) + one('x', t('link.x')) + one('youtube', t('link.youtube')) + (L.namu || EDIT ? one('namu', t('link.namu')) : '');
}

function starBtn(it) {
  const on = Favs.has(it.id);
  return `<button type="button" class="star ${on ? 'on' : ''}" data-fav="${esc(it.id)}" aria-label="${esc(t('list.star'))}" aria-pressed="${on}">${on ? ICON.star : ICON.starO}</button>`;
}

function emptyBox(text, kind, members, group) {
  return `<div class="empty">
    <div class="empty-star">${ICON.sparkle}</div>
    <p>${text}</p>
    <button type="button" class="btn sm line" data-upload='${esc(JSON.stringify({ kind, members, group }))}'>${esc(t('list.first'))}</button>
  </div>`;
}

/* 노래 목록 */
function songList(items, label) {
  if (!items.length) return '';
  return `<ol class="songs" data-label="${esc(label || '')}">${items.map((it, i) => `
    <li class="song ${Player.current()?.id === it.id ? 'now' : ''}" data-play="${esc(it.id)}">
      <span class="s-n">${pad2(i + 1)}</span>
      <span class="s-th" style="--c:${esc(Data.member(it.members[0])?.color || '')}">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy" decoding="async">` : `<b class="s-ph">♪</b>`}${it.playable ? `<i>${ICON.play}</i>` : ''}</span>
      <span class="s-t"><b>${esc(it.title)}</b><small>${esc(memberNames(it).join(' · '))}${it.group && Data.group(it.group) ? ` · ${esc(t('list.groupTag', { label: Data.group(it.group).label }))}` : it.group === 'all' ? ` · ${esc(t('list.allTag'))}` : ''}</small></span>
      <span class="srcs">${it.ytId ? `<span>${esc(t('list.srcYt'))}</span>` : ''}${it.hasDrive ? `<span>${esc(t('list.srcDrive'))}</span>` : ''}</span>
      <span class="s-x">
        ${starBtn(it)}
        <a class="icon-btn sm" href="${esc(it.open)}" target="_blank" rel="noopener" aria-label="${esc(t('list.open'))}" title="${esc(t('list.open'))}">${ICON.ext}</a>
        ${ownBtns(it)}
      </span>
      <span class="playc">${ICON.play}</span>
    </li>`).join('')}</ol>`;
}

function clipGrid(items, who = '') {
  if (!items.length) return '';
  return `<div class="clips">${items.map(it => `
    <article class="clip" ${feedPlayable(it) ? `data-feedwho="shorts:${esc(who)}" data-go="#/shorts/${esc(it.id)}"` : `data-view-item="${esc(it.id)}"`}>
      <div class="c-th">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy" decoding="async">` : it.link?.type === 'chzzk' ? ICON.chzzk : it.link?.type === 'x' ? ICON.x : ICON.video}</div>
      <div class="c-meta"><b>${esc(it.title || t('list.clipTitle'))}</b><small>${esc(memberNames(it).join(' · '))}${it.by ? ` · ${esc(it.by)}` : ''}</small></div>
      <div class="c-x">${starBtn(it)}${ownBtns(it)}</div>
    </article>`).join('')}</div>`;
}

function imageGrid(items) {
  if (!items.length) return '';
  return `<div class="masonry">${items.map(it => `
    <figure class="art" data-view-item="${esc(it.id)}">
      ${it.thumb ? `<img src="${esc(it.thumb)}" alt="${esc(it.title)}" loading="lazy">` : `<div class="art-link">${it.link?.type === 'x' ? ICON.x : ICON.ext}<span>${esc(it.title || t('list.linkView'))}</span></div>`}
      <figcaption><span>${esc(it.title)}${it.by ? ` · ${esc(it.by)}` : ''}</span>${starBtn(it)}${ownBtns(it)}</figcaption>
    </figure>`).join('')}</div>`;
}

function itemsBlock(kind, items, label, ctx = {}) {
  if (!items.length) return emptyBox(esc(t('list.empty', { kind: KIND[kind]?.name || '' })), kind, ctx.members, ctx.group);
  if (KIND[kind]?.music) return `
    <div class="list-head">
      <span>${esc(t('list.count', { n: items.length }))}</span><span class="grow"></span>
      <button type="button" class="btn sm" data-playall data-shuffle="1">${ICON.shuffle} ${esc(t('list.shuffle'))}</button>
      <button type="button" class="btn sm solid" data-playall>${ICON.play} ${esc(t('list.playAll'))}</button>
    </div>` + songList(items, label);
  if (KIND[kind]?.image) return imageGrid(items);
  if (kind === 'shorts') return shortsGrid(items, ctx.members?.length === 1 ? ctx.members[0] : '');
  return clipGrid(items, ctx.members?.length === 1 ? ctx.members[0] : '');
}

/* ─── 쇼츠 · 클립 피드 ───
   영상이 한 화면에 하나씩. 스크롤 · 스와이프 · ↑↓ 로 넘기고, 화면에 들어온 것만 튼다.
   쇼츠는 세로(9:16), 클립(2~3분짜리)은 가로(16:9) */
// 쇼츠 화면 하나에 쇼츠(세로)와 클립(가로)을 같이 둔다
const FEEDS = {
  shorts: { kinds: ['shorts', 'clip'], big: 'shorts.big' },
};
const ytVert = id => `https://i.ytimg.com/vi/${id}/oardefault.jpg`;
const ytWide = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const feedPlayable = it => !!(it.ytId || it.media || it.link?.type === 'chzzk');
function shortThumb(it, vertical = true) {
  if (it.ytId) return vertical
    ? `<img src="${ytVert(it.ytId)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${ytWide(it.ytId)}'">`
    : `<img src="${ytWide(it.ytId)}" alt="" loading="lazy">`;
  if (it.thumb) return `<img src="${esc(it.thumb)}" alt="" loading="lazy">`;
  return `<span class="sh-ph">${it.link?.type === 'chzzk' ? ICON.chzzk : ICON.video}</span>`;
}
// 멤버 페이지 쇼츠 탭: 세로 썸네일 칸. 누르면 쇼츠 화면에서 그 영상부터
function shortsGrid(items, who) {
  return `<div class="sh-grid">${items.map(it => `<a class="sh-tile" href="#/shorts/${esc(it.id)}" data-feedwho="shorts:${esc(who)}">
    ${shortThumb(it)}<span class="sh-tt">${esc(it.title || '')}</span></a>`).join('')}</div>`;
}
function feedList(f) {
  const who = state.feedWho[f], type = state.feedType;
  return Data.items.filter(i => FEEDS[f].kinds.includes(i.kind) && feedPlayable(i) && (!type || i.kind === type) && (!who || i.members.includes(who)))
    .sort((a, b) => (b.at > a.at ? 1 : -1));
}
// 피드 영상 한 칸
function feedItemHtml(it) {
      const ms = it.members.map(id => Data.member(id)).filter(Boolean);
      const fav = Favs.has(it.id);
      const vertical = it.kind === 'shorts';
      return `<section class="sh-item ${vertical ? '' : 'wide'}" data-sh="${esc(it.id)}">
        <div class="sh-card" style="--c:${esc(ms[0]?.color || 'var(--accent)')}">
          <div class="sh-media">${shortThumb(it, vertical)}<div class="sh-play" aria-hidden="true">${ICON.play}</div></div>
          <div class="sh-info">
            <div class="sh-who">${ms.map(m => `<a href="#/m/${esc(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av')}<b>${esc(m.name)}</b></a>`).join('')}</div>
            <p>${esc(it.title || '')}</p>
            ${it.by ? `<small>by ${esc(it.by)}</small>` : ''}
          </div>
        </div>
        <div class="sh-acts">
          <button type="button" class="star ${fav ? 'on' : ''}" data-fav="${esc(it.id)}" aria-pressed="${fav}" aria-label="${esc(t('list.star'))}">${fav ? ICON.star : ICON.starO}</button>
          <button type="button" class="icon-btn sh-cm" data-cm="${esc(it.id)}" aria-label="${esc(t('cm.title'))}" title="${esc(t('cm.title'))}">${ICON.comment}<small data-cmcount="${esc(it.id)}">${Comments.counts[it.id] || ''}</small></button>
          <a class="icon-btn" href="${esc(it.open || it.url)}" target="_blank" rel="noopener" aria-label="${esc(t('list.open'))}" title="${esc(t('list.open'))}">${ICON.ext}</a>
          <button type="button" class="icon-btn" data-shcopy="shorts/${esc(it.id)}" aria-label="${esc(t('shorts.copy'))}" title="${esc(t('shorts.copy'))}">${ICON.copy}</button>
          ${ownBtns(it).replace(/icon-btn sm/g, 'icon-btn')}
        </div>
      </section>`;
}

function renderFeed(f, startId) {
  const F = FEEDS[f];
  const all = Data.items.filter(i => F.kinds.includes(i.kind) && feedPlayable(i));
  const nType = k => all.filter(i => i.kind === k).length;
  const who = Data.site.members.filter(m => all.some(i => i.members.includes(m.id)));
  if (state.feedWho[f] && !who.some(m => m.id === state.feedWho[f])) state.feedWho[f] = '';
  const cur = state.feedWho[f];
  const list = feedList(f);
  view.innerHTML = `
    <header class="sh-top">
      <span class="big">${esc(t(F.big))}</span>
      <div class="sh-chips">
        <button type="button" class="chip ${cur || state.feedType ? '' : 'on'}" data-feedfilter="${f}:">${esc(t('shorts.all'))} <small>${all.length}</small></button>
        ${['shorts', 'clip'].map(k => `<button type="button" class="chip ${state.feedType === k ? 'on' : ''}" data-feedtype="${k}">${esc(KIND[k].name)} <small>${nType(k)}</small></button>`).join('')}
        <span class="sh-sep" aria-hidden="true"></span>
        ${who.map(m => `<button type="button" class="chip ${cur === m.id ? 'on' : ''}" data-feedfilter="${f}:${esc(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av')}${esc(m.name)}</button>`).join('')}
      </div>
      <button type="button" class="btn sm solid" data-upload='${esc(JSON.stringify({ kind: state.feedType || 'shorts', members: cur ? [cur] : [] }))}'>${esc(t('shorts.upload'))}</button>
    </header>
    ${list.length ? `<div class="sh-feed" id="shFeed" data-feed="${f}">${list.map(feedItemHtml).join('')}</div>
    <div class="sh-nav"><button type="button" class="icon-btn" data-shnav="-1" aria-label="이전">${ICON.chevR.replace('M9 5l7 7-7 7', 'M5 15l7-7 7 7')}</button><button type="button" class="icon-btn" data-shnav="1" aria-label="다음">${ICON.chevR.replace('M9 5l7 7-7 7', 'M5 9l7 7 7-7')}</button></div>`
    : emptyBox(esc(t('shorts.empty')), state.feedType || 'shorts', cur ? [cur] : [])}`;
  Feed.list = list;
  Feed.start(f, startId);
  Comments.loadCounts();
}
const Feed = {
  io: null, cur: null, f: '',
  start(f, startId) {
    this.io?.disconnect();
    this.cur = null;
    this.f = f;
    const feed = $('#shFeed');
    if (!feed) return;
    const first = startId && feed.querySelector(`[data-sh="${CSS.escape(startId)}"]`);
    if (first) feed.scrollTop = first.offsetTop - feed.offsetTop;
    this.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) this.show(e.target); }), { root: feed, threshold: 0.6 });
    $$('.sh-item', feed).forEach(el => { el.dataset.seen = '1'; this.io.observe(el); });
  },
  live(it) {
    const loop = it.kind === 'shorts'; // 쇼츠는 반복, 클립은 한 번
    if (it.hasDrive && (!it.ytId || Player.prefer === 'drive')) return `<video class="sh-live" src="${esc(Player.fileUrl(it))}" autoplay ${loop ? 'loop' : ''} playsinline controls></video>`;
    if (it.ytId) return `<iframe class="sh-live" src="https://www.youtube.com/embed/${esc(it.ytId)}?autoplay=1&playsinline=1&rel=0&modestbranding=1${loop ? `&loop=1&playlist=${esc(it.ytId)}` : ''}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${esc(it.title || '')}"></iframe>`;
    if (it.link?.type === 'chzzk') return `<iframe class="sh-live" src="https://chzzk.naver.com/embed/clip/${esc(it.link.id)}" allow="autoplay; fullscreen" allowfullscreen title="${esc(it.title || '')}"></iframe>`;
    if (it.directUrl) return `<video class="sh-live" src="${esc(it.directUrl)}" autoplay ${loop ? 'loop' : ''} playsinline controls></video>`;
    return '';
  },
  // 끝까지 오면 다시 섞어서 이어 붙인다 (끝없이 내리기)
  list: [],
  more() {
    const feed = $('#shFeed');
    if (!feed || this.list.length < 2) return;
    const ids = this.list.map(i => i.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const last = feed.lastElementChild?.dataset.sh;
    if (ids[0] === last) ids.push(ids.shift()); // 같은 영상이 바로 이어지지 않게
    feed.insertAdjacentHTML('beforeend', ids.map(id => feedItemHtml(Data.item(id))).join(''));
    $$('.sh-item:not([data-seen])', feed).forEach(el => { el.dataset.seen = '1'; this.io.observe(el); });
    Comments.paintCounts();
  },
  show(sec) {
    if (this.cur === sec) return;
    if (!sec.nextElementSibling) this.more();
    if (this.cur) this.unmount(this.cur);
    this.cur = sec;
    const it = Data.item(sec.dataset.sh);
    if (!it) return;
    if (Player.playing) Player.toggle(false); // 노래는 잠깐 멈춘다
    $('.sh-media', sec).insertAdjacentHTML('beforeend', this.live(it));
    history.replaceState(null, '', `#/shorts/${it.id}`);
    if (Comments.openId) Comments.open(it.id); // 댓글 창이 열려 있으면 지금 영상 것으로
  },
  unmount(sec) { $$('.sh-live', sec).forEach(el => el.remove()); },
  step(d) {
    const feed = $('#shFeed');
    if (feed) feed.scrollBy({ top: d * feed.clientHeight, behavior: 'smooth' });
  },
  stop() { this.io?.disconnect(); this.io = null; this.cur = null; },
};

/* ─── 댓글 ───
   구글 로그인한 사람만 쓴다. 자기 댓글(과 관리자)은 지울 수 있다. 서버가 없으면 이 브라우저에만 저장(미리보기) */
const Comments = {
  counts: {}, openId: '', list: [], busy: false,
  async loadCounts() {
    try {
      if (LIVE) {
        const r = await fetch(CFG.scriptUrl + '?action=commentCounts').then(r => r.json());
        if (r.ok) this.counts = r.counts || {};
      } else {
        this.counts = {};
        store.get('demoComments', []).forEach(c => (this.counts[c.item] = (this.counts[c.item] || 0) + 1));
      }
    } catch (e) {}
    this.paintCounts();
  },
  paintCounts() { $$('[data-cmcount]').forEach(el => (el.textContent = this.counts[el.dataset.cmcount] || '')); },
  async fetch(item) {
    if (!LIVE) return store.get('demoComments', []).filter(c => c.item === item);
    const r = await fetch(CFG.scriptUrl + '?action=comments&item=' + encodeURIComponent(item)).then(r => r.json());
    if (!r.ok) throw new Error(r.error);
    return r.comments || [];
  },
  async open(item) {
    this.openId = item;
    const box = $('#cmPanel');
    box.hidden = false;
    document.body.classList.add('cm-open');
    this.list = null;
    this.paint();
    try { this.list = await this.fetch(item); } catch (e) { this.list = []; toast(e.message, true); }
    if (this.openId === item) this.paint();
  },
  close() { this.openId = ''; $('#cmPanel').hidden = true; document.body.classList.remove('cm-open'); },
  mine(c) {
    if (!Auth.user) return false;
    if (Auth.user.admin) return true;
    return c.email ? c.email === Auth.user.email : c.hash && c.hash === this.myHash;
  },
  paint() {
    const it = Data.item(this.openId);
    const box = $('#cmPanel');
    const L = this.list;
    box.innerHTML = `
      <div class="cm-h"><b>${esc(t('cm.title'))}</b><small>${L ? L.length : ''}</small><span class="grow"></span><button type="button" class="icon-btn" data-cmclose aria-label="닫기">${ICON.close}</button></div>
      ${it ? `<p class="cm-of">${esc(it.title || '')}</p>` : ''}
      <ol class="cm-list">${L == null ? `<li class="cm-empty">${esc(t('cm.loading'))}</li>` : L.length ? L.map(c => `
        <li><span class="cm-av">${esc((c.name || '?').slice(0, 1))}</span>
          <div><div class="cm-meta"><b>${esc(c.name || '')}</b><small>${esc(ago(c.at))}</small>${this.mine(c) ? `<button type="button" class="cm-del" data-cmdel="${esc(c.id)}">${esc(t('list.delete'))}</button>` : ''}</div>
          <p>${esc(c.text)}</p></div></li>`).join('') : `<li class="cm-empty">${esc(t('cm.empty'))}</li>`}</ol>
      ${Auth.user ? `<form class="cm-form" id="cmForm"><textarea id="cmText" maxlength="500" rows="2" placeholder="${esc(t('cm.placeholder'))}"></textarea><button type="submit" class="btn sm solid">${esc(t('cm.send'))}</button></form>`
        : `<div class="cm-login"><p>${esc(t('cm.login'))}</p><div id="cmLogin"></div></div>`}`;
    if (!Auth.user) Auth.renderButton($('#cmLogin'));
    const list = $('.cm-list', box);
    list.scrollTop = list.scrollHeight;
  },
  async send(text) {
    text = text.trim();
    if (!text || this.busy) return;
    this.busy = true;
    try {
      let c;
      if (LIVE) c = (await api('addComment', { item: this.openId, text })).comment;
      else {
        c = { id: 'c' + Date.now(), item: this.openId, name: Auth.user?.name || '나', email: Auth.user?.email || '', text, at: new Date().toISOString() };
        store.set('demoComments', [...store.get('demoComments', []), c]);
      }
      this.list = [...(this.list || []), c];
      this.counts[this.openId] = (this.counts[this.openId] || 0) + 1;
      this.paint();
      this.paintCounts();
    } catch (e) { toast(e.message, true); } finally { this.busy = false; }
  },
  async remove(id) {
    if (!confirm(tRaw('cm.confirmDelete'))) return;
    toast(tRaw('upload.deleting'), false, true);
    $$(`[data-cmdel="${CSS.escape(id)}"]`).forEach(b => b.closest('li')?.classList.add('deleting'));
    try {
      if (LIVE) await api('removeComment', { id });
      else store.set('demoComments', store.get('demoComments', []).filter(c => c.id !== id));
      this.list = this.list.filter(c => c.id !== id);
      this.counts[this.openId] = Math.max(0, (this.counts[this.openId] || 1) - 1);
      this.paint();
      this.paintCounts();
      toast(tRaw('upload.deleted'));
    } catch (e) { toast(e.message, true); }
  },
};
// 썸네일이 안 열리면 깨진 그림 대신 멤버 색 바탕 + 기호로 보여 준다
document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName !== 'IMG' || /oardefault/.test(img.src)) return; // 쇼츠 세로 썸네일은 가로 썸네일로 한 번 더 시도한다
  const box = img.closest('.s-th, .c-th, .sh-media, .sh-tile, .art');
  if (!box) return;
  img.remove();
  box.classList.add('img-broken');
}, true);

document.addEventListener('submit', e => {
  if (e.target.id === 'schForm') {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    Sched.add({ date: f.date, time: f.time || '', member: f.member, type: f.type || 'live', title: (f.title || '').trim(), url: (f.url || '').trim() });
    return;
  }
  if (e.target.id === 'myForm') { e.preventDefault(); MyCal.add($('#myDate').value, $('#myTitle').value, $('input[name=myColor]:checked')?.value || MY_COLORS[0]); return; }
  if (e.target.id !== 'cmForm') return;
  e.preventDefault();
  Comments.send($('#cmText').value);
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'cmText' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); Comments.send(e.target.value); }
});
// 댓글 주인 확인용: 서버는 이메일 대신 해시만 보낸다
Auth.on(async user => {
  Comments.myHash = '';
  if (user?.email && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.email.toLowerCase()));
    Comments.myHash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  if (Comments.openId) Comments.paint();
});
function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (!(s >= 0)) return '';
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  if (s < 86400 * 30) return Math.floor(s / 86400) + '일 전';
  return fmtDate(iso);
}

/* ─── 홈 ─── */
function renderHome() {
  const s = Data.site, b = s.banner || {};
  const bimg = layersOf(b.image).layers.length;
  const songs = Data.items.filter(i => KIND[i.kind]?.music).length;
  const others = Data.items.length - songs;
  view.innerHTML = `
    <section class="banner ${bimg ? 'has-img' : ''}" data-ei="banner.image">
      ${layersHtml(b.image)}
      <div class="bn-in">
        <div class="bn-t">
          <span class="sc">${esc(t('home.kicker'))}</span>
          <h1>${esc(t('home.title'))}</h1>
          <p>${th('home.sub')}</p>
        </div>
        <div class="bn-stats">
          <div><b>${songs}</b><small>${esc(t('home.songs'))}</small></div>
          <div><b>${others}</b><small>${esc(t('home.others'))}</small></div>
          ${s.fanCafe ? `<a class="cafe" href="${esc(s.fanCafe)}" target="_blank" rel="noopener" aria-label="${esc(t('home.cafe'))}" title="${esc(t('home.cafe'))}"><img src="${esc(siteImg('cafe', 200))}" alt="" data-ei="images.cafe"></a>` : ''}
        </div>
      </div>
    </section>

    <section id="cal">${calendarHtml()}</section>

    ${s.groups.map(g => {
      const ms = active().filter(m => m.group === g.id);
      if (!ms.length) return '';
      return `<section class="gen" style="--g:${esc(g.color)}">
        <div class="gen-h"><b>${genNo(g)}</b><i class="it">${ef(`groups.${s.groups.indexOf(g)}.name`, g.name)}</i><span>${ef(`groups.${s.groups.indexOf(g)}.label`, g.label)}</span></div>
        <div class="gen-cards">${ms.map(m => memberCard(m)).join('')}</div>
      </section>`;
    }).join('')}

    ${graduates().length ? `<section class="gen">
      <div class="gen-h"><span class="grad-t">${esc(t('home.graduation'))}</span><span>${esc(t('home.graduationKo'))}</span></div>
      <div class="gen-cards">${graduates().map(m => memberCard(m, true)).join('')}</div>
    </section>` : ''}

    ${footerHtml()}`;
}

function memberCard(m, grad) {
  const img = layersOf(m.avatar).layers.length;
  return `<div class="mcard ${grad ? 'grad' : ''}" style="--c:${esc(m.color)}">
    <a class="mc-img ${img ? 'has-img' : ''}" data-ei="members.${Data.site.members.indexOf(m)}.avatar" href="#/m/${esc(m.id)}" aria-label="${esc(m.name)} 프로필">
      ${img ? layersHtml(m.avatar, { oy: 0 }) : `<span class="mc-ini">${esc(m.name.slice(0, 1))}</span>`}
      <span class="mc-en">${esc((m.en || '').toUpperCase())}</span>
    </a>
    <a class="mc-cap" href="#/m/${esc(m.id)}"><b>${ef(`members.${Data.site.members.indexOf(m)}.name`, m.name)}</b><i>${ef(`members.${Data.site.members.indexOf(m)}.en`, m.en)}</i></a>
    ${grad ? '' : `<div class="mc-links">${linkBtns(m)}</div>`}
  </div>`;
}

function footerHtml() {
  const fl = layersHtml(Data.site.images?.footer);
  return `<footer class="foot" data-ei="images.footer">
    ${fl ? fl + '<div class="scrim" aria-hidden="true"></div>' : ''}
    <div class="foot-in">
      <div class="foot-top">
        <div class="foot-brand">
          <div><img src="${esc(siteImg('logo', 200))}" alt="" data-ei="images.logo" data-pos="logo.footer">${esc(t('brand.name'))} <i>${esc(t('brand.sub'))}</i></div>
          <p>${th('footer.note')}</p>
        </div>
        <nav aria-label="${esc(t('footer.archive'))}"><span class="kk">${esc(t('footer.archive'))}</span><a href="#/listen">${esc(t('nav.listen'))}</a><a href="#/shorts">${esc(t('nav.shorts'))}</a><a href="#/group">${esc(t('nav.group'))}</a><a href="#/stars">${esc(t('nav.stars'))}</a></nav>
        <nav aria-label="${esc(t('footer.contribute'))}"><span class="kk">${esc(t('footer.contribute'))}</span><a href="#" data-upload="{}">${esc(t('upload.title'))}</a><a href="#/about">About · ${esc(t('nav.about'))}</a><a href="admin.html">${esc(t('footer.admin'))}</a><a href="privacy.html">${esc(t('footer.privacy'))}</a></nav>
        <nav aria-label="${esc(t('footer.official'))}"><span class="kk">${esc(t('footer.official'))}</span><a href="https://stellive.me" target="_blank" rel="noopener">${esc(t('footer.officialSite'))}</a></nav>
      </div>
      <div class="foot-bot">
        <span>${Auth.user ? esc(t('footer.loginOn', { name: Auth.user.name })) : esc(t('footer.loginOff'))}</span>
        ${Theme.dots()}
        <a href="#top" data-top>${esc(t('footer.top'))} ${ICON.chevR.replace('M9 5l7 7-7 7', 'M5 15l7-7 7 7')}</a>
      </div>
    </div>
  </footer>`;
}

/* ─── 캘린더 ─── */
const eventType = type => t('event.' + (['birthday', 'debut', 'event', 'broadcast', 'release', 'etc', 'mine'].includes(type) ? type : 'event'));
const listOf = key => tRaw(key).split(',').map(x => x.trim());

function eventsOn(y, mo, d) {
  const iso = `${y}-${pad2(mo + 1)}-${pad2(d)}`, md = iso.slice(5), out = [];
  for (const m of Data.site.members) {
    if (m.graduated) continue;
    if (m.birthday && m.birthday.slice(-5) === md) out.push({ type: 'birthday', title: t('event.birthdayTitle', { name: m.name }), color: m.color, member: m });
    if (m.debut && m.debut.slice(5) === md && +m.debut.slice(0, 4) < y) out.push({ type: 'debut', title: t('event.debutTitle', { name: m.name, n: y - +m.debut.slice(0, 4) }), color: m.color });
  }
  for (const e of Data.site.events) {
    if (e.date <= iso && iso <= (e.end || e.date)) out.push({ type: e.type || 'event', title: e.title, color: Data.member(e.members?.[0])?.color, url: e.url });
  }
  // 내 일정: 로그인한 본인에게만 보인다
  for (const e of MyCal.list) if (e.date === iso) out.push({ type: 'mine', title: e.title, color: e.color, id: e.id });
  return out;
}

// 생일 칸: 그 멤버 프로필 사진이 오른쪽에서 번져 나오고, 색종이가 떠다니고, 아래에 Happy Birthday · 이름
function birthdayArt(bds) {
  const m = bds[0].member;
  const img = m && firstSrc(m.avatar) ? imgUrl(firstSrc(m.avatar), 400) : '';
  return `${img ? `<span class="bd-img" style="background-image:url(&quot;${esc(img)}&quot;)" aria-hidden="true"></span>` : ''}
    <span class="bd-conf" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <i class="bd-sp" aria-hidden="true">${ICON.sparkle}</i>
    <span class="bd-cap"><em>${esc(t('cal.happy'))}</em><b>${bds.map(b => esc(b.member?.name || '')).join(' · ')}</b></span>`;
}

/* ─── 출석 체크 ───
   로그인한 사람이 하루 한 번 캘린더에서 누르면 그날 칸에 도장이 찍힌다. 서버가 없으면 이 브라우저에만(미리보기) */
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const Attend = {
  dates: new Set(), today: kstToday(), loaded: '', busy: false, justNow: false,
  async load() {
    const who = Auth.user?.email || '';
    if (this.loaded === who) return;
    this.loaded = who;
    this.dates = new Set();
    if (!who) return this.paint();
    try {
      if (LIVE) { const r = await api('getAttendance'); this.dates = new Set(r.dates); this.today = r.today; }
      else this.dates = new Set(store.get('demoAttend', {})[who] || []);
    } catch (e) {}
    this.paint();
  },
  async check() {
    if (!Auth.user || this.busy) return;
    this.busy = true;
    this.paint();
    try {
      if (LIVE) { const r = await api('checkIn'); this.dates = new Set(r.dates); this.today = r.today; }
      else {
        const all = store.get('demoAttend', {});
        all[Auth.user.email] = [...new Set([...(all[Auth.user.email] || []), kstToday()])];
        store.set('demoAttend', all);
        this.dates = new Set(all[Auth.user.email]);
      }
      this.justNow = true;
      toast(tRaw('att.done', { n: this.dates.size }));
    } catch (e) { toast(e.message, true); }
    this.busy = false;
    this.paint();
    setTimeout(() => (this.justNow = false), 1500);
  },
  streak() {
    let n = 0, d = new Date(this.today + 'T00:00:00Z');
    if (!this.dates.has(this.today)) d.setUTCDate(d.getUTCDate() - 1); // 오늘 아직이면 어제까지 이어진 것
    while (this.dates.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  },
  paint() { if (/^#\/?(calendar)?$/.test(location.hash) || location.hash === '') route(true); },
};
Auth.on(() => Attend.load());

/* ─── 내 일정 ─── 구글 로그인한 사람이 캘린더를 개인 달력처럼 쓴다. 본인에게만 보인다 */
const MY_COLORS = ['#7c6cf0', '#ff6f8e', '#3fa7e0', '#4fd6a0', '#f3b343'];
const MyCal = {
  list: [], loaded: '', form: false, busy: false,
  async load() {
    const who = Auth.user?.email || '';
    if (this.loaded === who) return;
    this.loaded = who;
    this.list = [];
    if (who) {
      try {
        if (LIVE) this.list = (await api('getMyEvents')).events || [];
        else this.list = store.get('demoMyCal', {})[who] || [];
      } catch (e) {}
    }
    repaintCal();
  },
  saveDemo() { const all = store.get('demoMyCal', {}); all[Auth.user.email] = this.list; store.set('demoMyCal', all); },
  async add(date, title, color) {
    title = title.trim().slice(0, 100);
    if (!date || !title || this.busy) return;
    this.busy = true;
    try {
      let e;
      if (LIVE) e = (await api('addMyEvent', { date, title, color })).event;
      else { e = { id: 'me' + Date.now(), date, title, color }; }
      this.list.push(e);
      if (!LIVE) this.saveDemo();
      this.form = false;
      const [y, m, d] = date.split('-').map(Number);
      state.calMonth = [y, m - 1];
      state.calPick = `${y}-${m - 1}-${d}`;
      toast(tRaw('my.added'));
    } catch (e) { toast(e.message, true); }
    this.busy = false;
    repaintCal();
  },
  async remove(id) {
    if (!confirm(tRaw('my.confirmDelete'))) return;
    toast(tRaw('upload.deleting'), false, true);
    try {
      if (LIVE) await api('removeMyEvent', { id });
      this.list = this.list.filter(e => e.id !== id);
      if (!LIVE) this.saveDemo();
      toast(tRaw('upload.deleted'));
    } catch (e) { toast(e.message, true); }
    repaintCal();
  },
};
Auth.on(() => MyCal.load());
Auth.on(() => { if (location.hash.startsWith('#/schedule')) paintSchedule(); });
function repaintCal() {
  const box = $('#cal');
  if (!box) return;
  box.innerHTML = calendarHtml(location.hash.startsWith('#/calendar'));
  if ($('#attLogin')) Auth.renderButton($('#attLogin'));
}
function myCalHtml() {
  if (!Auth.user) return '';
  if (!MyCal.form) return `<button type="button" class="btn sm line my-add" data-myform>${ICON.plus} ${esc(t('my.add'))}</button>`;
  const [py, pm, pd] = state.calPick ? state.calPick.split('-').map(Number) : [];
  const def = state.calPick ? `${py}-${pad2(pm + 1)}-${pad2(pd)}` : kstToday();
  return `<form class="my-form" id="myForm">
    <div class="my-row"><input type="date" id="myDate" value="${def}" required><button type="button" class="icon-btn sm" data-myform aria-label="닫기">${ICON.close}</button></div>
    <input id="myTitle" maxlength="100" placeholder="${esc(t('my.placeholder'))}" required>
    <div class="my-row">${MY_COLORS.map((c, i) => `<label class="my-c" style="--c:${c}"><input type="radio" name="myColor" value="${c}" ${i ? '' : 'checked'}><span></span></label>`).join('')}
      <button type="submit" class="btn sm solid" ${MyCal.busy ? 'disabled' : ''}>${esc(t('my.save'))}</button></div>
    <small>${esc(t('my.private'))}</small>
  </form>`;
}

function attendHtml() {
  if (!Auth.user) return `<div class="att"><p>${esc(t('att.login'))}</p><div id="attLogin"></div></div>`;
  const done = Attend.dates.has(Attend.today);
  return `<div class="att ${done ? 'done' : ''}">
    <div class="att-n"><b>${Attend.dates.size}</b><span>${esc(t('att.days'))}</span>${Attend.streak() > 1 ? `<small>${esc(t('att.streak', { n: Attend.streak() }))}</small>` : ''}</div>
    ${done ? `<span class="att-ok">${ICON.sparkle} ${esc(t('att.today'))}</span>`
      : `<button type="button" class="btn solid att-btn" data-attend ${Attend.busy ? 'disabled' : ''}>${esc(Attend.busy ? t('att.checking') : t('att.button'))}</button>`}
  </div>`;
}

function calendarHtml(big) {
  const now = new Date();
  const [y, mo] = state.calMonth || [now.getFullYear(), now.getMonth()];
  const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="cd blank"></div>';
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${mo}-${d}`, ev = eventsOn(y, mo, d);
    // 생일인 날은 그 멤버 색으로 칸을 물들이고, 프로필 사진과 반짝이를 올린다
    const bd = ev.find(e => e.type === 'birthday');
    cells += `<button type="button" class="cd ${todayKey === key ? 'today' : ''} ${state.calPick === key ? 'pick' : ''} ${bd ? 'bday' : ''}" ${bd ? `style="--c:${esc(bd.color || 'var(--accent)')}"` : ''} data-day="${key}" aria-label="${mo + 1}월 ${d}일${ev.length ? ' 일정 ' + ev.length + '개' : ''}">
      ${bd ? birthdayArt(ev.filter(e => e.type === 'birthday')) : ''}
      <span class="n">${d}</span>
      ${Attend.dates.has(`${y}-${pad2(mo + 1)}-${pad2(d)}`) ? `<i class="stamp ${Attend.justNow && `${y}-${pad2(mo + 1)}-${pad2(d)}` === Attend.today ? 'pop' : ''}" aria-label="${esc(tRaw('att.stamp'))}">${esc(t('att.stamp'))}</i>` : ''}
      ${(bd ? ev.filter(e => e.type !== 'birthday') : ev).slice(0, 2).map(e => `<span class="ev ${e.type === 'mine' ? 'ev-mine' : ''}" ${e.color ? `style="--c:${esc(e.color)}"` : ''}>${esc(e.title)}</span>`).join('')}
      ${(bd ? ev.filter(e => e.type !== 'birthday').length : ev.length) > 2 ? `<span class="ev more">+${ev.length - 2}</span>` : ''}
    </button>`;
  }
  let list = [];
  if (state.calPick) {
    const [py, pm, pd] = state.calPick.split('-').map(Number);
    list = eventsOn(py, pm, pd).map(e => ({ ...e, d: new Date(py, pm, pd) }));
  } else {
    for (let i = 0; i < 60; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      eventsOn(dt.getFullYear(), dt.getMonth(), dt.getDate()).forEach(e => list.push({ ...e, d: dt }));
    }
  }
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dday = d => { const n = Math.round((d - t0) / 864e5); return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`; };
  return `<div class="cal ${big ? 'cal-big' : ''}">
    <div class="cal-side">
      <span class="kk">${esc(t('cal.kicker'))}</span>
      <span class="cal-month">${mo + 1}</span>
      <span class="cal-ym">${esc(listOf('cal.months')[mo] || mo + 1)}, ${y}</span>
      <div class="cal-nav">
        <button type="button" class="icon-btn" data-cal="-1" aria-label="이전 달">${ICON.chevL}</button>
        <button type="button" class="icon-btn" data-cal="1" aria-label="다음 달">${ICON.chevR}</button>
        <button type="button" class="btn sm line" data-cal="0">${esc(t('cal.today'))}</button>
      </div>
      <a class="btn solid sch-btn" href="#/schedule">${ICON.play.replace('M7 4.5v15l13-7.5z', 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4').replace('fill="currentColor"', 'fill="none" stroke="currentColor" stroke-width="2"')} ${esc(t('sch.link'))}</a>
      ${attendHtml()}
      ${myCalHtml()}
      <h3>${state.calPick ? esc(t('cal.monthDay', { m: +state.calPick.split('-')[1] + 1, d: state.calPick.split('-')[2] })) : esc(t('cal.upcoming'))}</h3>
      ${list.length ? `<ul class="up-list">${list.map(e => `<li class="${e.type === 'birthday' ? 'up-bd' : e.type === 'mine' ? 'up-mine' : ''}" style="${e.color ? `--c:${esc(e.color)}` : ''}">
        <span class="d">${state.calPick ? `${e.d.getMonth() + 1}/${e.d.getDate()}` : dday(e.d)}</span>
        ${e.type === 'birthday' ? avatarHtml(e.member, 'av') : ''}
        <span class="t"><em>${esc(eventType(e.type))} · ${e.d.getMonth() + 1}/${e.d.getDate()}</em>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}</span>
        ${e.type === 'mine' ? `<button type="button" class="my-del" data-mydel="${esc(e.id)}" aria-label="${esc(t('list.delete'))}">${ICON.close}</button>` : ''}
      </li>`).join('')}</ul>` : `<p class="muted">${esc(t('cal.none'))}</p>`}
    </div>
    <div class="cal-main">
      <div class="cal-dow">${listOf('cal.days').slice(0, 7).map(x => `<span>${esc(x)}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>
  </div>`;
}

/* ─── 멤버 프로필 (캐릭터 인포 가로형) ─── */
// 프로필 정보 칸: 종족 · 나이 · MBTI · 신장 · 오시마크 · 팬네임 · 생일 · 데뷔 (빈 칸은 숨긴다, 편집 모드에서는 다 보인다)
const SPEC_FIELDS = [['species', 'Species'], ['age', 'Age'], ['mbti', 'MBTI'], ['height', 'Height'], ['oshi', 'Oshi mark'], ['fanName', 'Fan name']];
function specHtml(m, mp, bd) {
  const cells = SPEC_FIELDS.filter(([k]) => m[k] || EDIT).map(([k, en]) =>
    `<div><dt>${esc(t('profile.' + k))}${k === 'mbti' ? '' : ` <i>${en}</i>`}</dt><dd class="${k === 'oshi' ? 'oshi' : ''}">${ef(`${mp}.${k}`, m[k], '—')}</dd></div>`);
  if (bd) cells.push(`<div><dt>${esc(t('profile.birthday'))} <i>Birthday</i></dt><dd>${esc(t('profile.month', { m: bd[0], d: bd[1] }))}</dd></div>`);
  if (m.debut) cells.push(`<div><dt>${esc(t('profile.debut'))} <i>Debut</i></dt><dd>${fmtDate(m.debut)}</dd></div>`);
  return cells.length ? `<dl class="spec">${cells.join('')}</dl>` : '';
}

function renderMember(id, tab) {
  const m = Data.member(id);
  if (!m) return renderNotFound();
  const g = Data.group(m.group);
  const order = [...active(), ...graduates()];
  const i = order.indexOf(m), prev = order[(i - 1 + order.length) % order.length], next = order[(i + 1) % order.length];
  const counts = Object.fromEntries(KINDS.map(k => [k.id, Data.forMember(id, k.id).length]));
  tab = PROFILE_TABS.includes(tab) ? tab : 'cover';
  const items = Data.forMember(id, tab);
  const artV = layersOf(m.art).layers.length ? m.art : m.avatar;
  const art = layersOf(artV).layers.length;
  const mi = Data.site.members.indexOf(m), mp = `members.${mi}`;
  const family = ((m.enFull || m.en || m.name).split(' ')[0] || '').toUpperCase();
  const bd = m.birthday ? m.birthday.slice(-5).split('-').map(Number) : null;
  // 팬아트가 4개보다 많으면 들어올 때마다 랜덤으로 4개 (같은 페이지 안에서 탭을 바꿀 때는 그대로)
  const allArt = Data.forMember(id, 'fanart');
  const keep = fanPick[id]?.filter(x => allArt.some(a => a.id === x));
  if (pageFresh || !keep || keep.length < Math.min(4, allArt.length)) {
    const ids = allArt.map(a => a.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    fanPick[id] = ids.slice(0, 4);
  }
  const fanarts = fanPick[id].map(x => allArt.find(a => a.id === x));
  const sameGen = order.filter(x => x.group === m.group && !!x.graduated === !!m.graduated);

  view.innerHTML = `
    <nav class="pf-nav">
      <a href="#/">${ICON.chevL} ${esc(t('profile.back'))}</a>
      <span>${m.graduated ? esc(t('profile.navGrad')) : g ? `${genNo(g)} · ${esc(g.name.toUpperCase())} — ${sameGen.indexOf(m) + 1} / ${sameGen.length}` : ''}</span>
      <a href="#/m/${esc(next.id)}" title="${esc(prev.name)} ← → ${esc(next.name)}">${esc((next.en || next.name).toUpperCase())} ${ICON.chevR}</a>
    </nav>

    <article class="pf-card" style="--c:${esc(m.color)}">
      <div class="pf-left">
        <div class="pf-strip" aria-hidden="true"><span>${esc(family)}</span></div>
        <div class="pf-art" data-ei="${mp}.art" ${firstSrc(m.artBg) || siteImg('profileBg') ? `style="background:url('${esc(imgUrl(firstSrc(m.artBg), 1600) || siteImg('profileBg'))}') center / cover"` : ''}>
          ${art ? layersHtml(artV, { fit: 'contain', oy: 100 }) : `<span class="ph" aria-hidden="true">${esc(m.name.slice(0, 1))}</span>`}
          <span class="ci" aria-hidden="true">${th('profile.ci')}</span>
        </div>
      </div>
      <div class="pf-right">
        <div class="pf-info">
          <div>
            <h1 class="pf-name">${EDIT ? ef(`${mp}.en`, m.en, 'English name') : esc(m.en || m.name)}</h1>
            <div class="pf-unit"><i>${esc(t('profile.unitLine', { unit: m.graduated ? t('profile.gradUnit') : g?.name || '' }))}</i></div>
          </div>
          <div class="pf-ko">
            <b>${EDIT ? ef(`${mp}.fullName`, m.fullName, '풀네임') : esc(m.fullName || m.name)}</b>
            <span class="sw" aria-hidden="true"><span style="background:var(--c)"></span><span style="background:color-mix(in srgb, var(--c) 55%, #6d6fd8)"></span><span style="background:color-mix(in srgb, var(--c) 30%, #2b2b78)"></span></span>
            <div class="tag"><span><b>${esc(t('profile.unit'))}</b>${m.graduated ? esc(t('profile.graduated')) : `${esc(g?.label || '')} ${esc((g?.name || '').toUpperCase())}`}</span></div>
          </div>
          ${specHtml(m, mp, bd)}
          ${m.bio || EDIT ? `<div class="summary"><h3>${esc(t('profile.summary'))}</h3><p>${ef(`${mp}.bio`, m.bio, '소개를 쓴다')}</p></div>` : ''}
          <div class="pf-links">
            ${['chzzk', 'x', 'youtube', 'namu'].map(k => { const u = k === 'namu' ? namuLink(m) : m.links?.[k]; return u || EDIT ? `<a class="btn sm ${u ? '' : 'off'}" href="${esc(u || '#')}" target="_blank" rel="noopener" data-link="${mp}.links.${k}">${ICON[k]} ${esc(stripMarks(t('link.' + k)))}</a>` : ''; }).join('')}
            <button type="button" class="btn sm solid" data-playmember="${esc(m.id)}">${ICON.play} ${esc(t('profile.playAll'))}</button>
          </div>
        </div>
        <div class="mini">
          ${[0, 1, 2, 3].map(n => fanarts[n]
            ? `<button type="button" data-view-item="${esc(fanarts[n].id)}" style="background-image:url('${esc(fanarts[n].thumb || '')}')" aria-label="${esc(fanarts[n].title)}">${fanarts[n].thumb ? '' : fanarts[n].link?.type === 'x' ? ICON.x : ICON.ext}</button>`
            : `<button type="button" data-upload='${esc(JSON.stringify({ kind: 'fanart', members: [m.id] }))}' aria-label="${esc(t('profile.addFanart'))}">${esc(t('profile.addFanart'))}</button>`).join('')}
        </div>
      </div>
    </article>

    <nav class="tabs" aria-label="종류">
      ${PROFILE_TABS.map(k => `<a href="#/m/${esc(m.id)}/${k}" class="${tab === k ? 'on' : ''}" ${tab === k ? 'aria-current="page"' : ''}><span class="ko">${esc(KIND[k].name)}</span><i>${esc(KIND[k].en)}</i>${counts[k] ? `<small>${counts[k]}</small>` : ''}</a>`).join('')}
    </nav>
    <div>
      <div class="list-tools"><button type="button" class="btn sm line" data-upload='${esc(JSON.stringify({ kind: tab, members: [m.id] }))}'>${esc(t('list.add', { kind: KIND[tab].name }))}</button></div>
      <div style="margin-top:72px">${itemsBlock(tab, items, `${m.name} ${KIND[tab].name}`, { members: [m.id] })}</div>
    </div>`;
}

/* ─── 단체 · 합방 ─── */
// 단체 화면 팬아트 탭: 멤버 구분 없이 전부 섞어서 (들어올 때마다 새로 섞는다)
const GROUP_TABS = [...GROUP_KINDS, 'fanart'];
const fanMix = {};
function groupFanart(gid) {
  let list = Data.items.filter(i => i.kind === 'fanart');
  if (gid === 'duo') list = list.filter(i => i.members.length >= 2);
  else if (gid !== 'all') { const ids = Data.membersOf(gid).map(m => m.id); list = list.filter(i => i.group === gid || i.members.some(x => ids.includes(x))); }
  const key = gid, ids = list.map(i => i.id);
  if (pageFresh || !fanMix[key] || fanMix[key].length !== ids.length || ids.some(x => !fanMix[key].includes(x))) {
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    fanMix[key] = ids;
  }
  return fanMix[key].map(id => list.find(i => i.id === id));
}

function renderGroup(gid, tab) {
  tab = GROUP_TABS.includes(tab) ? tab : 'cover';
  gid = gid || 'all';
  const groups = Data.site.groups.filter(g => Data.membersOf(g.id).length > 1);
  let pool = Data.items.filter(i => Data.isGroupItem(i));
  if (gid === 'duo') pool = pool.filter(i => !i.group && i.members.length >= 2);
  else if (gid !== 'all') {
    const ids = Data.membersOf(gid).map(m => m.id);
    pool = pool.filter(i => i.group === gid || (!i.group && i.members.length >= 2 && i.members.every(x => ids.includes(x))));
  }
  const fans = groupFanart(gid);
  const items = tab === 'fanart' ? fans : pool.filter(i => i.kind === tab);
  const g = Data.group(gid);
  view.innerHTML = `
    <header class="page-h"><span class="big">${esc(t('group.big'))}</span><span class="ko">${esc(t('group.ko'))}</span></header>
    <nav class="pills" aria-label="기수">
      <a href="#/group/all/${tab}" class="${gid === 'all' ? 'on' : ''}"><b>${esc(t('group.all'))}</b></a>
      ${groups.map(x => `<a href="#/group/${x.id}/${tab}" class="${gid === x.id ? 'on' : ''}"><b>${genNo(x)}</b><i>${esc(x.name)}</i></a>`).join('')}
      <a href="#/group/duo/${tab}" class="${gid === 'duo' ? 'on' : ''}"><b>${esc(t('group.duo'))}</b><i>${esc(t('group.duoKo'))}</i></a>
    </nav>
    <nav class="tabs" aria-label="종류">${GROUP_TABS.map(k => `<a href="#/group/${gid}/${k}" class="${tab === k ? 'on' : ''}"><span class="ko">${esc(KIND[k].name)}</span><i>${esc(KIND[k].en)}</i><small>${(k === 'fanart' ? fans.length : pool.filter(i => i.kind === k).length) || ''}</small></a>`).join('')}</nav>
    <div>
      <div class="list-tools"><button type="button" class="btn sm line" data-upload='${esc(JSON.stringify({ kind: tab, group: g ? g.id : gid === 'all' ? 'all' : '', members: [] }))}'>${esc(t('list.add', { kind: KIND[tab].name }))}</button></div>
      <div style="margin-top:72px">${itemsBlock(tab, items, `${g ? g.label : gid === 'duo' ? t('group.duoKo') : t('group.ko')} ${KIND[tab].name}`, { group: g?.id, members: [] })}</div>
    </div>`;
}

/* ─── 노래 듣기 ─── */
function renderListen() {
  const music = Data.items.filter(i => state.listenKinds.has(i.kind) && i.playable);
  const shown = searchSongs(music);
  const favs = music.filter(i => Favs.has(i.id));
  view.innerHTML = `
    <header class="page-h"><span class="big">${esc(t('listen.big'))}</span><span class="ko">${esc(t('listen.ko'))}</span><p>${esc(t('listen.desc'))}</p></header>
    <div class="chips">
      ${KINDS.filter(k => k.music).map(k => `<button type="button" class="chip ${state.listenKinds.has(k.id) ? 'on' : ''}" data-lk="${k.id}" aria-pressed="${state.listenKinds.has(k.id)}">${k.name}</button>`).join('')}
      <span class="grow"></span>
      <span class="chip-k">${esc(t('listen.preferNote'))}</span>
      <button type="button" class="chip ${Player.prefer === 'drive' ? 'on' : ''}" data-prefer aria-pressed="${Player.prefer === 'drive'}">${esc(t('listen.prefer'))}</button>
      <button type="button" class="chip ${Player.full ? 'on' : ''}" data-fulldl aria-pressed="${Player.full}" title="${esc(tRaw('listen.fullTitle'))}">${esc(t('listen.full'))}</button>
      <button type="button" class="chip ${Loud.on ? 'on' : ''}" data-normvol aria-pressed="${Loud.on}" title="${esc(tRaw('listen.normTitle'))}">${esc(t('listen.norm'))}</button>
      <span class="chip-k">${esc(t('listen.coverNote'))}</span>
      ${['fanart', 'profile'].map(v => `<button type="button" class="chip ${store.get('audioCover', 'fanart') === v ? 'on' : ''}" data-cover="${v}" aria-pressed="${store.get('audioCover', 'fanart') === v}">${esc(t(v === 'fanart' ? 'listen.coverFanart' : 'listen.coverProfile'))}</button>`).join('')}
    </div>
    <div class="modes">
      <button type="button" class="mode" data-mode="random"><span class="bd">01</span><span class="ko">${esc(t('listen.random'))}</span><small>${esc(t('list.count', { n: music.length }))}</small></button>
      <button type="button" class="mode" data-mode="stars"><span class="bd">02</span><span class="ko">${esc(t('listen.stars'))}</span><small>${esc(t('list.count', { n: favs.length }))} · ${esc(Auth.user ? t('listen.account') : t('listen.device'))}</small></button>
      <button type="button" class="mode" data-mode="newest"><span class="bd">03</span><span class="ko">${esc(t('listen.newest'))}</span><small>${esc(t('listen.newestDesc'))}</small></button>
    </div>
    <section style="display:flex;flex-direction:column;gap:20px">
      <div class="sec-h"><span class="kk">${esc(t('listen.membersK'))}</span><span class="ko">${esc(t('listen.members'))}</span></div>
      <div class="mgrid">${active().map(m => {
        const n = music.filter(i => i.members.includes(m.id)).length;
        return `<button type="button" class="mpick" data-playmember="${esc(m.id)}" style="--c:${esc(m.color)}" ${n ? '' : 'disabled'}>${avatarHtml(m, 'av md')}<b>${esc(m.name)}</b><small>${esc(t('list.count', { n }))}</small></button>`;
      }).join('')}</div>
      <div class="sec-h" style="margin-top:20px"><span class="kk">${esc(t('listen.unitsK'))}</span><span class="ko">${esc(t('listen.units'))}</span></div>
      <div class="mgrid">${Data.site.groups.map(g => {
        const ids = Data.membersOf(g.id).map(m => m.id);
        const n = music.filter(i => i.group === g.id || i.members.some(x => ids.includes(x))).length;
        return `<button type="button" class="mpick grp" data-playgroup="${esc(g.id)}" style="--c:${esc(g.color)}" ${n ? '' : 'disabled'}><span class="bd">${genNo(g)}</span><i>${esc(g.name)}</i><small>${esc(t('list.count', { n }))}</small></button>`;
      }).join('')}</div>
    </section>
    <section>
      <input class="search" id="songSearch" placeholder="${esc(t('listen.search'))}" value="${esc(state.search)}" aria-label="${esc(t('listen.search'))}">
      ${SongStore.count() ? `<p class="saved-note">${esc(t('listen.saved', { n: SongStore.count(), mb: Math.round(SongStore.bytes() / 1e6) }))} <button type="button" class="chip-btn" data-clearsongs>${esc(t('listen.clear'))}</button></p>` : ''}
      <div id="songResults">${songResults(shown)}</div>
    </section>`;
  // 검색 칸은 그대로 두고 결과만 바꾼다 — 칸을 다시 그리면 한글 조합이 끊겨 ㅎㅏㄴ 처럼 쳐진다
  const inp = $('#songSearch');
  inp.addEventListener('input', () => {
    state.search = inp.value;
    $('#songResults').innerHTML = songResults(searchSongs(music));
  });
}
function searchSongs(music) {
  const q = state.search.trim().toLowerCase().replace(/\s+/g, '');
  if (!q) return music;
  return music.filter(i => (i.title + memberNames(i).join('') + (i.members.map(id => Data.member(id)?.fullName || '').join(''))).toLowerCase().replace(/\s+/g, '').includes(q));
}
function songResults(shown) {
  return shown.length ? songList(shown, t('listen.ko')) : emptyBox(esc(t('list.empty', { kind: t('stars.music') })), 'cover', []);
}

/* ─── 별표 · 캘린더 ─── */
function renderStars() {
  const items = Data.items.filter(i => Favs.has(i.id));
  const music = items.filter(i => KIND[i.kind]?.music), clips = items.filter(i => i.kind === 'clip'), arts = items.filter(i => KIND[i.kind]?.image);
  view.innerHTML = `
    <header class="page-h"><span class="big">${esc(t('stars.big'))}</span><span class="ko">${esc(t('stars.ko'))}</span><p>${Auth.user ? esc(t('stars.login', { name: Auth.user.name })) : esc(t('stars.local'))}</p></header>
    ${items.length ? '' : `<div class="empty"><div class="empty-star">${ICON.sparkle}</div><p>${esc(t('stars.empty'))}</p></div>`}
    ${music.length ? `<section><div class="sec-h"><span class="ko">${esc(t('stars.music'))}</span></div>${itemsBlock('cover', music, t('stars.ko'))}</section>` : ''}
    ${clips.length ? `<section><div class="sec-h" style="margin-bottom:16px"><span class="ko">${esc(t('stars.clips'))}</span></div>${clipGrid(clips)}</section>` : ''}
    ${arts.length ? `<section><div class="sec-h" style="margin-bottom:16px"><span class="ko">${esc(t('stars.arts'))}</span></div>${imageGrid(arts)}</section>` : ''}`;
}

function renderCalendarPage() {
  view.innerHTML = `
    <header class="page-h"><span class="big">${esc(t('cal.big'))}</span><span class="ko">${esc(t('cal.ko'))}</span><p>${esc(t('cal.desc'))}</p></header>
    <section id="cal">${calendarHtml(true)}</section>`;
}

/* ─── 방송 일정 ───
   멤버별 방송 · 휴방 일정을 모두가 같이 채우는 달력. 구글 로그인하면 누구나 넣고, 넣은 사람(과 관리자)만 지운다 */
const SCH_TYPES = ['live', 'plan', 'off', 'song', 'etc'];
const Sched = {
  months: {}, // 'yyyy-mm' → [{id, date, time, member, type, title, url, by, hash}]
  month: null, pick: '', who: '', form: false, busy: false,
  view: store.get('schView', 'week'), week: null, // 주 보기: 그 주 일요일 'yyyy-mm-dd'
  key(y, m) { return `${y}-${pad2(m + 1)}`; },
  async load(y, m, force) {
    const k = this.key(y, m);
    if (this.months[k] && !force) return;
    try {
      if (LIVE) { const r = await fetch(CFG.scriptUrl + '?action=schedule&month=' + k).then(r => r.json()); this.months[k] = r.ok ? r.events : []; }
      else this.months[k] = store.get('demoSched', []).filter(e => e.date.startsWith(k));
    } catch (e) { this.months[k] = []; }
    if (location.hash.startsWith('#/schedule')) paintSchedule();
  },
  list(y, m) { return this.months[this.key(y, m)] || []; },
  label(e) { return e.title || tRaw('sch.type.' + (SCH_TYPES.includes(e.type) ? e.type : 'etc')); },
  mine(e) { return !!Auth.user && (Auth.user.admin || (e.email ? e.email === Auth.user.email : e.hash === Comments.myHash)); },
  async add(f) {
    if (this.busy) return;
    this.busy = true;
    paintSchedule();
    try {
      let e;
      if (LIVE) e = (await api('addSchedule', f)).event;
      else {
        e = { id: 's' + Date.now(), ...f, by: Auth.user?.name || '나', email: Auth.user?.email || '' };
        store.set('demoSched', [...store.get('demoSched', []), e]);
      }
      const k = e.date.slice(0, 7);
      (this.months[k] ||= []).push(e);
      this.pick = e.date;
      this.form = false;
      toast(tRaw('sch.added'));
    } catch (err) { toast(err.message, true); }
    this.busy = false;
    paintSchedule();
  },
  async remove(id) {
    if (!confirm(tRaw('sch.confirmDelete'))) return;
    toast(tRaw('upload.deleting'), false, true);
    try {
      if (LIVE) await api('removeSchedule', { id });
      else store.set('demoSched', store.get('demoSched', []).filter(e => e.id !== id));
      for (const k in this.months) this.months[k] = this.months[k].filter(e => e.id !== id);
      toast(tRaw('upload.deleted'));
    } catch (err) { toast(err.message, true); }
    paintSchedule();
  },
};
const memberMark = m => m ? avatarHtml(m, 'av sch-av') : `<span class="sch-mk">✦</span>`;
// 일정을 누르면: 따로 넣은 링크가 있으면 거기로, 없으면 그 멤버 치지직 채널로
function schItem(e, full) {
  const m = Data.member(e.member);
  const c = m?.color || 'var(--accent)';
  const text = (e.time ? e.time + ' ' : '') + Sched.label(e);
  const href = e.url || m?.links?.chzzk || '';
  const tag = href ? `a href="${esc(href)}" target="_blank" rel="noopener"` : 'span';
  return `<${tag} class="sch-ev ${e.time ? 'timed' : 'allday'}" style="--c:${esc(c)}" title="${esc((m?.name || '') + ' · ' + text + (e.by ? ' · ' + e.by : '') + (href ? ' · ' + tRaw('sch.go') : ''))}">${memberMark(m)}<span class="sch-tx">${esc(text)}</span>${full ? schDel(e) : ''}</${href ? 'a' : 'span'}>`;
}
const schDel = e => e.src !== 'sl' && Sched.mine(e) ? `<button type="button" class="sch-del" data-schdel="${esc(e.id)}" aria-label="${esc(t('list.delete'))}">${ICON.close}</button>` : '';
const schSort = (a, b) => (!!b.time - !!a.time) || String(a.time).localeCompare(String(b.time)) || String(a.member).localeCompare(String(b.member));

function renderSchedule() {
  view.innerHTML = `
    <header class="page-h"><span class="big">${esc(t('sch.big'))}</span><span class="ko">${esc(t('sch.ko'))}</span><p>${esc(t('sch.desc'))}</p></header>
    <section id="sched"></section>
    <p class="sch-src">${th('sch.source')}</p>`;
  paintSchedule();
}
// 날짜 계산 도우미 (한국 날짜 문자열 기준)
const isoAdd = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoSunday = iso => isoAdd(iso, -new Date(iso + 'T00:00:00Z').getUTCDay());
function paintSchedule() {
  const box = $('#sched');
  if (!box) return;
  const today = kstToday();
  const week = Sched.view === 'week';
  let isoDays, title, lead = 0;
  if (week) {
    const start = Sched.week || isoSunday(today);
    isoDays = Array.from({ length: 7 }, (_, i) => isoAdd(start, i));
    const [a, z] = [isoDays[0], isoDays[6]];
    title = a.slice(0, 7) === z.slice(0, 7) ? tRaw('sch.weekT', { m: +a.slice(5, 7), a: +a.slice(8), b: +z.slice(8) }) : tRaw('sch.weekT2', { m: +a.slice(5, 7), a: +a.slice(8), m2: +z.slice(5, 7), b: +z.slice(8) });
  } else {
    const now = new Date();
    const [y, mo] = Sched.month || [now.getFullYear(), now.getMonth()];
    lead = new Date(y, mo, 1).getDay();
    isoDays = Array.from({ length: new Date(y, mo + 1, 0).getDate() }, (_, i) => `${y}-${pad2(mo + 1)}-${pad2(i + 1)}`);
    title = tRaw('sch.month', { y, m: mo + 1 });
  }
  // 걸친 달을 다 불러온다
  [...new Set(isoDays.map(d => d.slice(0, 7)))].forEach(k => Sched.load(+k.slice(0, 4), +k.slice(5) - 1));
  const byDay = {};
  isoDays.forEach(d => (byDay[d] = []));
  Object.values(Sched.months).flat().forEach(e => { if (byDay[e.date] && (!Sched.who || e.member === Sched.who)) byDay[e.date].push(e); });
  const MAX = week ? 99 : 6;
  const dows = listOf('cal.days').slice(0, 7);
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="sch-cd blank"></div>';
  isoDays.forEach((iso, i) => {
    const ev = byDay[iso].sort(schSort);
    cells += `<div class="sch-cd ${iso === today ? 'today' : ''} ${Sched.pick === iso ? 'pick' : ''}" data-schday="${iso}">
      <span class="n">${+iso.slice(8)}</span>
      ${ev.slice(0, MAX).map(e => schItem(e)).join('')}
      ${ev.length > MAX ? `<span class="sch-more">+${ev.length - MAX}</span>` : ''}
      ${week && !ev.length ? `<span class="sch-empty">—</span>` : ''}
    </div>`;
  });
  const pickEv = Sched.pick ? (byDay[Sched.pick] || Object.values(Sched.months).flat().filter(e => e.date === Sched.pick && (!Sched.who || e.member === Sched.who))).sort(schSort) : [];
  const ms = active();
  box.innerHTML = `
    <div class="sch-bar">
      <button type="button" class="icon-btn" data-schmon="-1" aria-label="이전">${ICON.chevL}</button>
      <b class="sch-title">${esc(title)}</b>
      <button type="button" class="icon-btn" data-schmon="1" aria-label="다음">${ICON.chevR}</button>
      <button type="button" class="btn sm line" data-schmon="0">${esc(t('cal.today'))}</button>
      <div class="sch-views"><button type="button" class="${week ? 'on' : ''}" data-schview="week">${esc(t('sch.week'))}</button><button type="button" class="${week ? '' : 'on'}" data-schview="month">${esc(t('sch.monthV'))}</button></div>
      <div class="sch-chips">
        <button type="button" class="chip ${Sched.who ? '' : 'on'}" data-schwho="">${esc(t('shorts.all'))}</button>
        ${ms.map(m => `<button type="button" class="chip ${Sched.who === m.id ? 'on' : ''}" data-schwho="${esc(m.id)}" style="--c:${esc(m.color)}">${memberMark(m)}${esc(m.name)}</button>`).join('')}
      </div>
      ${Auth.user ? `<button type="button" class="btn sm solid" data-schform>${ICON.plus} ${esc(t('sch.add'))}</button>` : `<span class="sch-login">${esc(t('sch.login'))} <span id="schLogin"></span></span>`}
    </div>
    ${Sched.form && Auth.user ? schForm() : ''}
    <div class="sch-wrap ${Sched.pick ? 'with-day' : ''}">
      <div class="sch-cal ${week ? 'sch-week' : ''}">
        <div class="sch-dow">${(week ? isoDays.map((d, i) => `${dows[i]} <b>${+d.slice(5, 7)}/${+d.slice(8)}</b>`) : dows).map(x => `<span>${week ? x : esc(x)}</span>`).join('')}</div>
        <div class="sch-grid">${cells}</div>
      </div>
      ${Sched.pick ? `<aside class="sch-day">
        <div class="sch-day-h"><b>${esc(t('cal.monthDay', { m: +Sched.pick.slice(5, 7), d: +Sched.pick.slice(8) }))}</b>
          ${Auth.user ? `<button type="button" class="btn sm line" data-schform="${Sched.pick}">${ICON.plus} ${esc(t('sch.addHere'))}</button>` : ''}
          <button type="button" class="icon-btn sm" data-schday="${Sched.pick}" aria-label="닫기">${ICON.close}</button></div>
        <div class="sch-day-list">${pickEv.length ? pickEv.map(e => `<div class="sch-row">${schItem(e, true)}<small>${esc(Data.member(e.member)?.name || '')}${e.by ? ' · ' + esc(e.by) : ''}</small></div>`).join('') : `<p class="muted">${esc(t('sch.none'))}</p>`}</div>
      </aside>` : ''}
    </div>`;
  if ($('#schLogin')) Auth.renderButton($('#schLogin'));
}
function schForm() {
  const ms = Data.site.members.filter(m => !m.graduated);
  const date = Sched.formDate || Sched.pick || kstToday();
  return `<form class="sch-form" id="schForm">
    <label><span>${esc(t('sch.f.date'))}</span><input type="date" name="date" value="${date}" required></label>
    <label><span>${esc(t('sch.f.time'))}</span><input type="time" name="time"></label>
    <label><span>${esc(t('sch.f.member'))}</span><select name="member" required>${ms.map(m => `<option value="${esc(m.id)}" ${Sched.who === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
    <div class="sch-types"><span>${esc(t('sch.f.type'))}</span>${SCH_TYPES.map((k, i) => `<label class="chip-r"><input type="radio" name="type" value="${k}" ${i ? '' : 'checked'}><span>${esc(t('sch.type.' + k))}</span></label>`).join('')}</div>
    <label class="grow"><span>${esc(t('sch.f.title'))}</span><input name="title" maxlength="80" placeholder="${esc(t('sch.f.titlePh'))}"></label>
    <label class="grow"><span>${esc(t('sch.f.url'))}</span><input name="url" type="url" placeholder="${esc(t('sch.f.urlPh'))}"></label>
    <div class="sch-form-btns"><button type="button" class="btn sm line" data-schform>${esc(t('sch.cancel'))}</button><button type="submit" class="btn sm solid" ${Sched.busy ? 'disabled' : ''}>${esc(t('sch.save'))}</button></div>
  </form>`;
}

/* ─── 노래 창 ─── */
function renderPlay() {
  const it = Player.current();
  if (!it) {
    view.innerHTML = `<header class="page-h"><span class="big">${esc(t('np.k'))}</span><span class="ko">${esc(t('np.ko'))}</span><p>${esc(t('np.empty'))}</p></header>
      <div><a class="btn solid" href="#/listen">${ICON.play} ${esc(t('np.go'))}</a></div>`;
    return;
  }
  const g = it.group && Data.group(it.group);
  const who = it.members.map(id => Data.member(id)).filter(Boolean);
  const q = Player.queue;
  const fav = Favs.has(it.id);
  view.innerHTML = `
    <section class="np">
      <div class="np-main">
        <div class="np-slot" id="npSlot"></div>
        <div class="np-under">
          <a href="#" data-np-back>${ICON.chevL} ${esc(t('np.back'))}</a>
          <button type="button" data-np-mini>${esc(t('np.mini'))}</button>
        </div>
      </div>
      <aside class="np-side">
        <span class="kk">${esc(t('np.k'))} · ${esc(t('np.of', { n: String(Player.idx + 1).padStart(2, '0'), total: String(q.length).padStart(2, '0') }))}</span>
        <h1 class="np-title">${esc(it.title || '(제목 없음)')}</h1>
        <div class="np-who">
          ${who.map(m => `<a href="#/m/${esc(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av')}<b>${esc(m.name)}</b></a>`).join('')}
          ${g ? `<a href="#/group/${esc(g.id)}" class="np-g" style="--c:${esc(g.color || 'var(--accent)')}"><i>${esc(g.name)}</i></a>` : ''}
        </div>
        <div class="np-meta">
          <span>${esc(KIND[it.kind]?.name || '')}</span>
          <span data-np-src>${Player.source === 'drive' ? 'Drive' : 'YouTube'}</span>
          ${Player.label ? `<span>${esc(Player.label)}</span>` : ''}
        </div>
        <div class="np-acts">
          <button type="button" class="icon-btn ${fav ? 'on' : ''}" data-fav="${esc(it.id)}" aria-pressed="${fav}" aria-label="${esc(t('np.fav'))}">${fav ? ICON.star : ICON.starO}</button>
          ${it.url ? `<a class="btn line" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(t('np.src'))} ${ICON.ext}</a>` : ''}
          ${ownBtns(it).replace(/icon-btn sm/g, 'icon-btn')}
        </div>
        <div class="np-q-h"><span class="kk">${esc(t('np.nextK'))}</span><b>${esc(t('np.next'))}</b><small>${esc(t('list.count', { n: q.length }))}</small></div>
        <ol class="np-q">${q.map((x, i) => `
          <li data-npq="${i}" class="${i === Player.idx ? 'now' : ''}">
            <span class="q-n">${i === Player.idx ? ICON.play : i + 1}</span>
            <span class="np-qt"><b>${esc(x.title)}</b><small>${esc(memberNames(x).join(' · '))}</small></span>
          </li>`).join('')}</ol>
      </aside>
    </section>`;
  // 지금 곡이 목록 위쪽에 보이게
  const now = $('.np-q .now'), ol = $('.np-q');
  if (now) ol.scrollTop += now.getBoundingClientRect().top - ol.getBoundingClientRect().top - 8;
}
// 노래 창 배경: 지금 곡 썸네일을 크게 흐려 깔아서 영상 색이 화면 전체에 번지게 한다.
// 이미 받아 둔 작은 썸네일 한 장만 쓰니 느려지지 않는다. 곡이 바뀌면 두 겹을 엇갈려 스르륵 바꾼다
const Glow = {
  key: '',
  // 노래 창 배경은 부른 멤버의 고유 색으로 화면 전체를 물들인다. 여러 명이면 그 색들을 섞는다
  set(colors) {
    const box = $('#npGlow');
    colors = (colors || []).filter(Boolean);
    box.classList.toggle('on', colors.length > 0);
    const key = colors.join(',');
    if (!colors.length || key === this.key) return;
    this.key = key;
    const [a, b] = $$('i', box);
    const next = a.classList.contains('show') ? b : a, prev = next === a ? b : a;
    next.style.backgroundImage = glowPaint(colors);
    next.classList.add('show');
    prev.classList.remove('show');
  },
};
function glowPaint(cs) {
  const mix = (c, n) => `color-mix(in srgb, ${c} ${n}%, transparent)`;
  if (cs.length === 1) {
    const c = cs[0];
    return `radial-gradient(60% 70% at 32% 40%, ${mix(c, 95)}, transparent 75%), radial-gradient(55% 60% at 80% 72%, ${mix(c, 80)}, transparent 75%), linear-gradient(160deg, ${mix(c, 55)}, ${mix(c, 35)})`;
  }
  // 여럿: 색마다 다른 자리에서 번지고, 바탕은 그 색들을 비스듬히 잇는다
  const spots = [[25, 30], [78, 28], [70, 78], [22, 76], [50, 50], [90, 52], [10, 50]];
  const blobs = cs.slice(0, 7).map((c, i) => `radial-gradient(48% 55% at ${spots[i][0]}% ${spots[i][1]}%, ${mix(c, 90)}, transparent 72%)`);
  return [...blobs, `linear-gradient(120deg, ${cs.map(c => mix(c, 45)).join(', ')})`].join(', ');
}

// 노래 창 배경 색: 부른 멤버 색 → 없으면 기수 색 → 전체 단체곡이면 사이트 색
function playGlow() {
  const it = Player.current();
  if (!it) return Glow.set([]);
  let cs = [...new Set(it.members.map(id => Data.member(id)?.color).filter(Boolean))];
  if (!cs.length && it.group && it.group !== 'all') cs = [Data.group(it.group)?.color].filter(Boolean);
  if (!cs.length) cs = ['var(--accent)'];
  Glow.set(cs);
}

// 곡이 바뀌면 노래 창을 다시 그린다
Player.onChange(() => { if (location.hash.startsWith('#/play')) route(true); });

// 맨 아래 줄은 모든 화면에 붙인다
function ensureFoot() {
  if (!view.querySelector(':scope > .foot')) view.insertAdjacentHTML('beforeend', footerHtml());
}

function renderNotFound() {
  view.innerHTML = `<div class="empty"><div class="empty-star">${ICON.sparkle}</div><p>${esc(t('notFound'))}</p><a class="btn line" href="#/">${esc(t('nav.home'))}</a></div>`;
}

/* ─── About ─── */
const aboutData = () => {
  const a = Data.site.about || {};
  const d = window.ABOUT_DEFAULT;
  return { facts: a.facts?.length ? a.facts : d.facts, cares: a.cares?.length ? a.cares : d.cares, chapters: a.chapters?.length ? a.chapters : d.chapters };
};

// 가이드라인 본문(글자) → 블록들. 빈 줄 = 문단 끝, "1. " = 번호 항목, "   a. " = 하위 항목, [라벨](주소) = 버튼
function parseGuide(body) {
  const blocks = [];
  let cur = null;
  for (const raw of String(body || '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { cur = null; continue; }
    let m;
    if ((m = line.match(/^\[(.+)\]\((https?:\/\/\S+)\)$/))) { blocks.push({ type: 'link', label: m[1], url: m[2] }); cur = null; continue; }
    if ((m = line.match(/^\s+([a-z])\.\s+(.*)$/)) && cur && (cur.type === 'item' || cur.type === 'sub')) {
      const item = cur.type === 'item' ? cur : cur.parent;
      cur = { type: 'sub', n: m[1], text: m[2], parent: item };
      item.subs.push(cur);
      continue;
    }
    if ((m = line.match(/^(\d+)\.\s+(.*)$/))) { cur = { type: 'item', n: m[1], text: m[2], subs: [] }; blocks.push(cur); continue; }
    if (cur && cur.type !== 'link') { cur.text += '\n' + line.trim(); continue; }
    cur = { type: 'p', text: line.trim() };
    blocks.push(cur);
  }
  return blocks;
}

function renderAbout() {
  const A = aboutData();
  view.innerHTML = `
    <section class="about-top">
      <div>
        <span class="page-h" style="margin:0"><span class="big">${esc(t('about.big'))}</span></span>
        <span class="ko" style="font-size:30px;font-weight:700">${esc(t('about.ko'))}</span>
        <p class="lead">${th('about.lead')}</p>
      </div>
      <div class="facts">${A.facts.map((f, i) => `<div><span class="bd">${pad2(i + 1)}</span><div><b>${esc(f[0])}</b><p>${esc(f[1])}</p></div></div>`).join('')}</div>
    </section>

    <section>
      <div class="sec-h" style="margin-bottom:24px"><span class="kk">${esc(t('about.promiseKicker'))}</span><span class="ko">${esc(t('about.promise'))}</span><span class="note">${esc(t('about.promiseNote'))}</span></div>
      <div class="cares">${A.cares.map((c, i) => `<div><span class="bd">${pad2(i + 1)}</span><div><b>${esc(c[0])}</b><p>${esc(c[1])}</p>${c[2] ? `<small>${esc(c[2])}</small>` : ''}</div></div>`).join('')}</div>
      <p class="contact">${esc(t('about.contact'))} ${Data.site.contact ? `<a href="mailto:${esc(Data.site.contact)}">${esc(Data.site.contact)}</a>` : ''}</p>
    </section>

    <section class="guide" id="guide">
      <nav class="g-toc" aria-label="${esc(t('about.guide'))}">
        <span class="kk">${esc(t('about.guideKicker'))}</span>
        <span class="ko">${esc(t('about.guide'))}</span>
        ${A.chapters.map((ch, i) => `<button type="button" data-guide="${i}" aria-current="${state.guideOpen === i}"><span class="bd">${pad2(i)}</span><span class="ko">${esc(ch.title)}</span></button>`).join('')}
        <p>${th('about.source')}</p>
      </nav>
      <div class="g-body">${A.chapters.map((ch, i) => {
        const open = state.guideOpen === i;
        return `<article class="g-ch" id="g${i}">
          <button type="button" data-guide="${i}" aria-expanded="${open}">
            <span class="bd">${pad2(i)}</span>
            <span><span class="ko">${esc(ch.title)}</span><i>${esc(ch.en || '')}</i></span>
            <span class="sign" aria-hidden="true">${open ? '−' : '+'}</span>
          </button>
          ${open ? `<div class="g-in">${parseGuide(ch.body).map(b =>
            b.type === 'p' ? `<p>${esc(b.text)}</p>`
            : b.type === 'link' ? `<a class="btn solid" style="align-self:flex-start" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)} ${ICON.ext}</a>`
            : `<div class="g-item"><span class="bd">${b.n}</span><div><p>${esc(b.text)}</p>${b.subs.map(sb => `<div class="g-sub"><i>${sb.n}</i><p>${esc(sb.text)}</p></div>`).join('')}</div></div>`
          ).join('')}</div>` : ''}
        </article>`;
      }).join('')}</div>
    </section>
    ${footerHtml()}`;
}

/* ─── 목차 ─── */
const NAV = [
  ['#/', 'nav.home', 'nav.homeEn'], ['#/calendar', 'nav.calendar', 'nav.calendarEn'], ['#/schedule', 'nav.schedule', 'nav.scheduleEn'], ['#/listen', 'nav.listen', 'nav.listenEn'], ['#/shorts', 'nav.shorts', 'nav.shortsEn'],
  ['#/group', 'nav.group', 'nav.groupEn'], ['#/stars', 'nav.stars', 'nav.starsEn'], ['#/about', 'nav.about', 'nav.aboutEn'],
];
function renderDrawer() {
  const block = (no, name, ms, color) => ms.length ? `<div class="dr-g" style="--g:${esc(color || '#fff')}">
    <div class="dr-gh"><b>${no}</b><i>${esc(name)}</i></div>
    <div class="dr-ms">${ms.map(m => `<a class="dr-m" href="#/m/${esc(m.id)}" data-nav="m-${esc(m.id)}" style="--c:${esc(m.color)}">${esc(m.name)}</a>`).join('')}</div>
  </div>` : '';
  $('#drawer').dataset.ei = 'images.drawer';
  $('#drawer').innerHTML = `
    <div class="dr-head">
      <img src="${esc(siteImg('logo', 200))}" alt="" data-ei="images.logo" data-pos="logo.drawer">
      <div><b>${esc(t('brand.name'))}</b><small>${esc(t('nav.title'))}</small></div>
      <button type="button" class="icon-btn" data-drawer-close aria-label="목차 닫기">${ICON.close}</button>
    </div>
    <nav class="dr-nav">${NAV.map(([href, ko, en], i) => `<a href="${href}" data-href="${href}"><span class="no">${pad2(i + 1)}</span><span class="ko">${esc(t(ko))}</span><span class="en">${esc(t(en))}</span></a>`).join('')}</nav>
    <div class="dr-k">${esc(t('nav.members'))}</div>
    <div class="dr-gens">
      ${Data.site.groups.map(g => block(genNo(g), g.name, active().filter(m => m.group === g.id), g.color)).join('')}
      ${block('✦', t('nav.graduation'), graduates(), '#cfc6ff')}
    </div>
    <div class="dr-foot">
      <div class="row">${Theme.dots()}<span class="grow"></span><button type="button" class="btn sm line" data-intro>${esc(t('nav.intro'))}</button></div>
      <div class="row"><button type="button" class="btn sm solid" data-upload="{}">${esc(t('nav.upload'))}</button><div id="login"></div></div>
    </div>`;
  const dl = layersHtml(Data.site.images?.drawer);
  if (dl) $('#drawer').insertAdjacentHTML('afterbegin', dl + '<div class="scrim" aria-hidden="true"></div>');
  $('#tbLinks').innerHTML = NAV.map(([href, , en]) => `<a href="${href}" data-href="${href}">${esc(t(en))}</a>`).join('');
  paintLogin(Auth.user);
  markNav();
  applyPositions($('#drawer'));
}

function markNav() {
  const [, page, id] = location.hash.split('/');
  const href = '#/' + (page && page !== 'm' ? page : page === 'm' ? '__' : '');
  $$('[data-href]').forEach(a => a.classList.toggle('on', a.dataset.href === href));
  $$('#drawer [data-nav]').forEach(a => a.classList.toggle('on', page === 'm' && a.dataset.nav === 'm-' + id));
}

// data-t="키" 가 붙은 곳에 글자를 채운다
function fillTexts(root = document) {
  $$('[data-t]', root).forEach(el => { el.innerHTML = th(el.dataset.t); });
  $$('[data-tp]', root).forEach(el => { el.placeholder = tRaw(el.dataset.tp); });
  $$('[data-img]', root).forEach(el => { el.src = siteImg(el.dataset.img, 400); });
  if (root === document) {
    document.title = tRaw('meta.title');
    $('meta[name=description]')?.setAttribute('content', tRaw('meta.description'));
  }
  applyPositions(root);
  const fav = $('link[rel=icon]');
  if (fav) fav.href = siteImg('logo', 128);
}

/* ─── 가장자리 메뉴 ─── */
const Menu = {
  hover: matchMedia('(hover: hover) and (min-width: 821px)'),
  openDrawer(byHover) { $('#drawer').classList.add('open'); this.byHover = byHover; $('#indexTab').setAttribute('aria-expanded', 'true'); },
  closeDrawer() { $('#drawer').classList.remove('open'); $('#indexTab').setAttribute('aria-expanded', 'false'); },
  setTop(open) { $('#topbar').classList.toggle('open', open); $('#topBtn').setAttribute('aria-expanded', open); },
  init() {
    $('#edgeLeft').addEventListener('mouseenter', () => this.openDrawer(true));
    $('#indexTab').addEventListener('mouseenter', () => { if (this.hover.matches) this.openDrawer(true); });
    $('#drawer').addEventListener('mouseleave', () => { if (this.byHover) this.closeDrawer(); });
    // 목차 끝까지 굴려도 뒤의 페이지는 따라 내려가지 않는다
    $('#drawer').addEventListener('wheel', e => {
      const d = $('#drawer');
      const atTop = d.scrollTop <= 0, atEnd = d.scrollTop + d.clientHeight >= d.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atEnd)) e.preventDefault();
    }, { passive: false });
    $('#indexTab').addEventListener('click', () => ($('#drawer').classList.contains('open') ? this.closeDrawer() : this.openDrawer(false)));
    $('#menuBtn').addEventListener('click', () => this.openDrawer(false));
    $('#topBtn').addEventListener('click', () => this.setTop(!$('#topbar').classList.contains('open')));
    document.addEventListener('click', e => {
      if (e.target.closest('[data-drawer-close]')) return this.closeDrawer();
      if ($('#drawer').classList.contains('open') && !e.target.closest('#drawer, #indexTab, #menuBtn, #edgeLeft')) this.closeDrawer();
      if ($('#topbar').classList.contains('open') && !e.target.closest('#topbar, #topBtn')) this.setTop(false);
    });
  },
};

/* ─── 첫 화면 ─── */
const Intro = {
  today: () => new Date().toISOString().slice(0, 10),
  shouldShow() { return store.get('introSkip') !== this.today(); },
  isOpen() { return !$('#intro').hidden && !$('#intro').classList.contains('leaving'); },
  show() {
    this.paint();
    $('#skipToday').checked = store.get('introSkip') === this.today();
    const el = $('#intro');
    el.classList.remove('leaving');
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    Menu.closeDrawer();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) $('#introOrbit')?.pauseAnimations?.();
  },
  // 그림·글자만 다시 채운다 (서버에서 사이트 설정이 늦게 와도 열린 채로 바뀐다)
  paint() {
    const introV = layersOf(Data.site?.images?.intro).layers.length ? Data.site.images.intro : Data.site?.banner?.image;
    const img = layersOf(introV).layers.length;
    const crest = Data.site?.images?.crest ? siteImg('crest', 800) : '';
    $('#introCrestImg').hidden = !crest;
    $('#introCrestSvg').style.display = crest ? 'none' : '';
    if (crest) $('#introCrestImg').src = crest;
    const sky = $('#introSky');
    sky.innerHTML = layersHtml(introV);
    sky.classList.toggle('has-img', !!img);
    fillTexts($('#intro'));
    $('#introDots').innerHTML = Theme.dots();
  },
  // 왼쪽으로 천천히 밀려나며 사라진다
  hide() {
    if (!this.isOpen()) return;
    if ($('#skipToday').checked) store.set('introSkip', this.today()); else store.del('introSkip');
    const el = $('#intro');
    el.classList.add('leaving');
    document.body.style.overflow = '';
    setTimeout(() => { if (el.classList.contains('leaving')) el.hidden = true; }, 1400);
  },
};

/* ─── 주소 바뀔 때 ─── */
let lastPage = '';
let pageFresh = true; // 다른 페이지에서 막 들어왔는지
const fanPick = {};
function route(keepScroll) {
  if (!Data.site) return;
  const [, page, a, b] = location.hash.split('/');
  // 커버곡·오리곡 같은 탭만 바뀐 거면 맨 위로 올리지 않는다
  const pageKey = `${page || ''}/${page === 'm' ? a : ''}`;
  if (pageKey === lastPage) keepScroll = true;
  pageFresh = pageKey !== lastPage;
  lastPage = pageKey;
  view.classList.toggle('about-v', page === 'about');
  view.classList.toggle('play-v', page === 'play');
  view.classList.toggle('shorts-v', page === 'shorts' || page === 'clips');
  if (page !== 'shorts' && page !== 'clips') { Feed.stop(); Comments.close(); }
  if (page !== 'play') Player.leavePage();
  // 노래 창과 멤버 페이지는 그 멤버 고유색으로 화면을 물들인다
  if (page === 'm') { const mm = Data.member(decodeURIComponent(a || '')); Glow.set(mm ? [mm.color] : []); }
  else if (page !== 'play') Glow.set([]);
  if (!page) renderHome();
  else if (page === 'm') renderMember(decodeURIComponent(a || ''), b);
  else if (page === 'group') renderGroup(a, b);
  else if (page === 'listen') renderListen();
  else if (page === 'calendar') renderCalendarPage();
  else if (page === 'schedule') renderSchedule();
  else if (page === 'stars') renderStars();
  else if (page === 'about') renderAbout();
  else if (page === 'play') renderPlay();
  else if (page === 'shorts' || page === 'clips') renderFeed('shorts', decodeURIComponent(a || '')); // 예전 #/clips 주소도 여기로
  else renderNotFound();
  ensureFoot();
  if (page === 'play' && $('#npSlot')) Player.enterPage($('#npSlot'));
  if (page === 'play') playGlow();
  markNav();
  applyPositions(view);
  if ($('#attLogin')) Auth.renderButton($('#attLogin'));
  Menu.closeDrawer();
  Menu.setTop(false);
  if (!keepScroll) window.scrollTo(0, 0);
}

/* ─── 클릭 처리 ─── */
document.addEventListener('click', e => {
  const tg = e.target;
  let el;
  if ((el = tg.closest('[data-fav]'))) { e.stopPropagation(); Favs.toggle(el.dataset.fav); return; }
  if ((el = tg.closest('[data-del]'))) { e.stopPropagation(); deleteItem(el.dataset.del); return; }
  if ((el = tg.closest('[data-rename]'))) { e.stopPropagation(); renameItem(el.dataset.rename); return; }
  if ((el = tg.closest('[data-upload]'))) { e.preventDefault(); openUpload(JSON.parse(el.dataset.upload || '{}')); return; }
  if (tg.closest('[data-top]')) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if ((el = tg.closest('[data-play]'))) {
    if (tg.closest('a')) return;
    const list = el.closest('.songs');
    const items = $$('[data-play]', list).map(x => Data.item(x.dataset.play)).filter(Boolean);
    const it = Data.item(el.dataset.play);
    if (!it.playable) return openViewer(it);
    Player.play(items, it.id, list.dataset.label);
    return;
  }
  if ((el = tg.closest('[data-playall]'))) {
    const list = el.closest('.list-head').nextElementSibling;
    const items = $$('[data-play]', list).map(x => Data.item(x.dataset.play)).filter(Boolean);
    if (el.dataset.shuffle) { Player.shuffle = true; Player.paintModes(); }
    Player.play(items, null, list.dataset.label);
    return;
  }
  if ((el = tg.closest('[data-playmember]'))) {
    const m = Data.member(el.dataset.playmember);
    const kinds = location.hash.startsWith('#/listen') ? state.listenKinds : new Set(['cover', 'original', 'album']);
    Player.play(Data.items.filter(i => kinds.has(i.kind) && i.members.includes(m.id)), null, t('listen.memberQueue', { name: m.name }));
    return;
  }
  if ((el = tg.closest('[data-playgroup]'))) {
    const g = Data.group(el.dataset.playgroup), ids = Data.membersOf(g.id).map(m => m.id);
    Player.play(Data.items.filter(i => state.listenKinds.has(i.kind) && (i.group === g.id || i.members.some(x => ids.includes(x)))), null, t('listen.unitQueue', { label: g.label }));
    return;
  }
  if ((el = tg.closest('[data-mode]'))) {
    const music = Data.items.filter(i => state.listenKinds.has(i.kind) && i.playable);
    const mode = el.dataset.mode;
    if (mode === 'random') { Player.shuffle = true; Player.paintModes(); Player.play(music, null, t('listen.random')); }
    if (mode === 'stars') {
      const favs = music.filter(i => Favs.has(i.id));
      if (!favs.length) return toast(tRaw('stars.none'));
      Player.play(favs, null, t('listen.stars'));
    }
    if (mode === 'newest') { Player.shuffle = false; Player.paintModes(); Player.play(music, null, t('listen.newest')); }
    return;
  }
  if ((el = tg.closest('[data-cover]'))) {
    store.set('audioCover', el.dataset.cover);
    audioThumbs(Data.items, Data.site);
    Player.refreshCover();
    renderListen(); ensureFoot(); return;
  }
  if (tg.closest('[data-attend]')) { Attend.check(); return; }
  if ((el = tg.closest('[data-schmon]'))) {
    const d = +el.dataset.schmon, now = new Date();
    if (Sched.view === 'week') Sched.week = d ? isoAdd(Sched.week || isoSunday(kstToday()), 7 * d) : null;
    else {
      let [y, m] = Sched.month || [now.getFullYear(), now.getMonth()];
      if (!d) [y, m] = [now.getFullYear(), now.getMonth()]; else { m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } }
      Sched.month = [y, m];
    }
    Sched.pick = ''; paintSchedule(); return;
  }
  if ((el = tg.closest('[data-schview]'))) {
    Sched.view = el.dataset.schview; store.set('schView', Sched.view);
    // 보던 날짜 근처로 맞춘다
    if (Sched.view === 'week' && Sched.month) { const [y, m] = Sched.month; Sched.week = isoSunday(`${y}-${pad2(m + 1)}-01`); }
    if (Sched.view === 'month' && Sched.week) Sched.month = [+Sched.week.slice(0, 4), +Sched.week.slice(5, 7) - 1];
    Sched.pick = ''; paintSchedule(); return;
  }
  if ((el = tg.closest('[data-schwho]'))) { Sched.who = el.dataset.schwho; paintSchedule(); return; }
  if ((el = tg.closest('[data-schform]'))) { Sched.form = !Sched.form || !!el.dataset.schform; Sched.formDate = el.dataset.schform || ''; paintSchedule(); if (Sched.form) $('#schForm')?.scrollIntoView({ block: 'nearest' }); return; }
  if ((el = tg.closest('[data-schdel]'))) { e.preventDefault(); Sched.remove(el.dataset.schdel); return; }
  if ((el = tg.closest('[data-schday]')) && !tg.closest('a')) { Sched.pick = Sched.pick === el.dataset.schday ? '' : el.dataset.schday; paintSchedule(); return; }
  if (tg.closest('[data-myform]')) { MyCal.form = !MyCal.form; repaintCal(); if (MyCal.form) $('#myTitle')?.focus(); return; }
  if ((el = tg.closest('[data-mydel]'))) { MyCal.remove(el.dataset.mydel); return; }
  if (tg.closest('[data-normvol]')) { Loud.set(!Loud.on); renderListen(); ensureFoot(); return; }
  if (tg.closest('[data-fulldl]')) { Player.setFull(!Player.full); renderListen(); ensureFoot(); return; }
  if (tg.closest('[data-clearsongs]')) { if (confirm(tRaw('listen.clearConfirm'))) SongStore.clear().then(() => { renderListen(); ensureFoot(); }); return; }
  if (tg.closest('[data-prefer]')) { Player.setPrefer(Player.prefer === 'drive' ? 'youtube' : 'drive'); renderListen(); ensureFoot(); return; }
  if ((el = tg.closest('[data-npq]'))) { Player.go(+el.dataset.npq); return; }
  if (tg.closest('[data-np-back]')) { e.preventDefault(); Player.togglePage(); return; }
  if (tg.closest('[data-np-mini]')) { Player.pageFrom = 'mini'; Player.togglePage(); return; }
  if ((el = tg.closest('[data-lk]'))) {
    const k = el.dataset.lk;
    state.listenKinds.has(k) ? state.listenKinds.delete(k) : state.listenKinds.add(k);
    if (!state.listenKinds.size) state.listenKinds.add(k);
    renderListen(); return ensureFoot();
  }
  if (tg.closest('[data-intro]')) { Intro.show(); return; }
  if ((el = tg.closest('[data-guide]'))) {
    const i = +el.dataset.guide;
    const fromToc = !!el.closest('.g-toc');
    state.guideOpen = fromToc ? i : state.guideOpen === i ? -1 : i;
    route(true);
    if (fromToc) $('#g' + i)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if ((el = tg.closest('[data-view-item]'))) { openViewer(Data.item(el.dataset.viewItem)); return; }
  if ((el = tg.closest('[data-cal]'))) {
    const now = new Date();
    const [y, mo] = state.calMonth || [now.getFullYear(), now.getMonth()];
    const d = +el.dataset.cal;
    state.calMonth = d ? [new Date(y, mo + d).getFullYear(), new Date(y, mo + d).getMonth()] : null;
    state.calPick = null;
    $('#cal').innerHTML = calendarHtml(location.hash.startsWith('#/calendar'));
    return;
  }
  if ((el = tg.closest('[data-day]'))) {
    state.calPick = state.calPick === el.dataset.day ? null : el.dataset.day;
    $('#cal').innerHTML = calendarHtml(location.hash.startsWith('#/calendar'));
    return;
  }
  if ((el = tg.closest('[data-feedfilter]'))) { const [f, w] = el.dataset.feedfilter.split(':'); state.feedWho[f] = w; if (!w) state.feedType = ''; renderFeed(f); ensureFoot(); return; }
  if ((el = tg.closest('[data-feedtype]'))) { state.feedType = state.feedType === el.dataset.feedtype ? '' : el.dataset.feedtype; renderFeed('shorts'); ensureFoot(); return; }
  if ((el = tg.closest('[data-shnav]'))) { Feed.step(+el.dataset.shnav); return; }
  if ((el = tg.closest('[data-feedwho]'))) { const [, w] = el.dataset.feedwho.split(':'); state.feedWho.shorts = w; state.feedType = ''; if (el.dataset.go) location.hash = el.dataset.go; return; } // 링크는 그대로 따라간다
  if ((el = tg.closest('[data-shcopy]'))) {
    const url = location.origin + location.pathname + '#/' + el.dataset.shcopy;
    navigator.clipboard?.writeText(url).then(() => toast(tRaw('shorts.copied')), () => prompt('', url));
    return;
  }
  if ((el = tg.closest('[data-cm]'))) { Comments.openId === el.dataset.cm ? Comments.close() : Comments.open(el.dataset.cm); return; }
  if (tg.closest('[data-cmclose]')) { Comments.close(); return; }
  if ((el = tg.closest('[data-cmdel]'))) { Comments.remove(el.dataset.cmdel); return; }
  if (tg.closest('[data-close]') || tg.classList.contains('modal')) closeModals();
});

document.addEventListener('keydown', e => {
  if (document.activeElement?.isContentEditable) return;
  if (Intro.isOpen()) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); Intro.hide(); } return; }
  if (e.key === 'Escape') { closeModals(); Menu.closeDrawer(); Menu.setTop(false); }
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && $('#shFeed') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); Feed.step(e.key === 'ArrowDown' ? 1 : -1); }
  if (e.key === ' ' && !Player.bar.hidden && !/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(document.activeElement.tagName)) { e.preventDefault(); Player.toggle(); }
});

/* ─── 보기 창 ─── */
function openViewer(it) {
  if (!it) return;
  const body = $('#viewer .viewer-body');
  let html;
  if (it.isImage && it.driveId) html = `<img class="big-img" src="https://drive.google.com/thumbnail?id=${it.driveId}&sz=w2000" alt="">`;
  else if (it.isImage) html = `<img class="big-img" src="${esc(it.url)}" alt="">`;
  else if (it.ytId && !(Player.prefer === 'drive' && it.hasDrive)) html = `<div class="ratio"><iframe src="https://www.youtube.com/embed/${it.ytId}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${esc(it.title)}"></iframe></div>`;
  else if (it.link?.type === 'chzzk') html = `<div class="ratio"><iframe src="https://chzzk.naver.com/embed/clip/${esc(it.link.id)}" allow="autoplay; fullscreen" allowfullscreen title="${esc(it.title)}"></iframe></div>`;
  else if (it.driveId && it.media && CFG.driveApiKey) html = `<video class="big-vid" controls autoplay playsinline src="https://www.googleapis.com/drive/v3/files/${it.driveId}?alt=media&key=${CFG.driveApiKey}"></video>`;
  else if (it.driveId) html = `<div class="ratio"><iframe src="https://drive.google.com/file/d/${it.driveId}/preview" allow="autoplay" allowfullscreen title="${esc(it.title)}"></iframe></div>`;
  else if (it.directUrl) html = `<video class="big-vid" controls autoplay playsinline src="${esc(it.directUrl)}"></video>`;
  else if (it.link?.type === 'x') html = `<div class="x-embed"><blockquote class="twitter-tweet" data-theme="${Theme.get() === 'dark' ? 'dark' : 'light'}" data-lang="ko"><a href="${esc(it.url.replace('//x.com', '//twitter.com'))}"></a></blockquote></div>`;
  else html = `<div class="empty"><p>${esc(t('viewer.cant'))}</p></div>`;
  body.innerHTML = html;
  $('#viewer .viewer-foot').innerHTML = `
    <div><b>${esc(it.title)}</b><small>${esc(memberNames(it).join(' · '))}${it.by ? ` · ${esc(t('viewer.by', { name: it.by }))}` : ''}</small></div>
    <span class="grow"></span>${starBtn(it)}
    <a class="btn sm" href="${esc(it.open)}" target="_blank" rel="noopener">${ICON.ext} ${esc(t('list.open'))}</a>`;
  $('#viewer').hidden = false;
  if (it.link?.type === 'x') loadX().then(() => window.twttr?.widgets?.load(body));
  if (Player.playing && (it.ytId || it.media || it.link?.type === 'chzzk')) Player.toggle(false);
}
function loadX() {
  return (loadX.p ||= new Promise(ok => {
    const s = document.createElement('script');
    s.src = 'https://platform.twitter.com/widgets.js';
    s.onload = ok; s.onerror = ok;
    document.head.append(s);
  }));
}
function closeModals() {
  $$('.modal').forEach(m => (m.hidden = true));
  $('#viewer .viewer-body').innerHTML = '';
  $('#queue').classList.remove('open');
}

/* ─── 올리기 ─── */
const up = { kind: 'cover', members: new Set() };

// 쇼츠와 클립은 올리기에서 하나로 고르고, 올릴 때 링크(유튜브 /shorts/)나 영상 비율(세로면 쇼츠)로 알아서 나눈다
const isVideoKind = k => k === 'clip' || k === 'shorts';
function guessShortsFromUrl(u) { return /youtube\.com\/shorts\//i.test(u || ''); }
function videoIsVertical(file) {
  return new Promise(ok => {
    if (!/^video\//.test(file.type)) return ok(false);
    const v = document.createElement('video'), u = URL.createObjectURL(file);
    const done = r => { URL.revokeObjectURL(u); ok(r); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => done(v.videoHeight > v.videoWidth);
    v.onerror = () => done(false);
    setTimeout(() => done(false), 4000);
    v.src = u;
  });
}
async function pickVideoKind(url, file) {
  if (guessShortsFromUrl(url)) return 'shorts';
  if (file && (await videoIsVertical(file))) return 'shorts';
  return 'clip';
}

function openUpload(pre = {}) {
  up.kind = pre.kind || up.kind;
  if (up.kind === 'shorts') up.kind = 'clip'; // 고르는 칸은 「쇼츠 · 클립」 하나
  up.members = new Set(pre.members || []);
  if (!up.members.size) {
    const [, page, id] = location.hash.split('/');
    if (page === 'm') up.members.add(id);
  }
  $('#upKind').innerHTML = KINDS.filter(k => k.id !== 'shorts').map(k => `<button type="button" class="chip ${k.id === up.kind ? 'on' : ''}" data-uk="${k.id}" aria-pressed="${k.id === up.kind}">${k.id === 'clip' ? esc(t('upload.videoKind')) : k.name}</button>`).join('');
  $('#upMembers').innerHTML = Data.site.members.map(m => `<button type="button" class="chip ${up.members.has(m.id) ? 'on' : ''}" data-um="${esc(m.id)}" aria-pressed="${up.members.has(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av')}${esc(m.name)}</button>`).join('');
  $('#upGroup').innerHTML = `<option value="">${esc(t('upload.groupNo'))}</option><option value="all">${esc(t('upload.groupAll'))}</option>` +
    Data.site.groups.map(g => `<option value="${esc(g.id)}">${esc(g.label)} ${esc(g.name)}</option>`).join('');
  $('#upGroup').value = pre.group || '';
  ['#upTitle', '#upUrl', '#upAlt', '#upFile'].forEach(s => ($(s).value = ''));
  $('#upStatus').textContent = '';
  fillTexts($('#upload'));
  $('#upHint').textContent = !LIVE ? tRaw('upload.demo') : Auth.user ? tRaw('upload.as', { name: Auth.user.name }) : tRaw('upload.login');
  $('#upload').hidden = false;
  $('#upQuota').textContent = Quota.text();
  Quota.load().then(() => { $('#upQuota').textContent = Quota.text(); });
}

$('#upload').addEventListener('click', e => {
  const k = e.target.closest('[data-uk]'), mm = e.target.closest('[data-um]');
  if (k) { up.kind = k.dataset.uk; $$('#upKind .chip').forEach(c => { c.classList.toggle('on', c === k); c.setAttribute('aria-pressed', c === k); }); }
  if (mm) { const id = mm.dataset.um; up.members.has(id) ? up.members.delete(id) : up.members.add(id); mm.classList.toggle('on'); mm.setAttribute('aria-pressed', up.members.has(id)); }
});
$('#upFile').addEventListener('change', () => {
  const f = $('#upFile').files[0];
  $('.drop-txt').textContent = f ? `${f.name} · ${(f.size / 1048576).toFixed(1)}MB` : tRaw('upload.drop');
  if (f && !$('#upTitle').value) $('#upTitle').value = f.name.replace(/\.[^.]+$/, '');
});

$('#upload form').addEventListener('submit', async e => {
  e.preventDefault();
  const status = $('#upStatus');
  const members = [...up.members], group = $('#upGroup').value, title = $('#upTitle').value.trim();
  const url = $('#upUrl').value.trim(), alt = $('#upAlt').value.trim(), f = $('#upFile').files[0];
  if (!members.length && !group) return (status.textContent = tRaw('upload.errMember'));
  if (!url && !alt && !f) return (status.textContent = tRaw('upload.errNone'));
  const btn = $('#upSubmit');
  try {
    btn.disabled = true;
    let item;
    const kind = isVideoKind(up.kind) ? await pickVideoKind(url || alt, f) : up.kind;
    if (f) {
      if (f.size > 2e9) throw new Error(tRaw('upload.errSize', { mb: 2000 }));
      if (!LIVE) throw new Error(tRaw('upload.errDemo'));
      status.textContent = tRaw('upload.uploadingP', { p: 0 });
      try {
        item = (await uploadToDrive(f, { kind, title, members, group, url }, p => { status.textContent = tRaw('upload.uploadingP', { p: Math.round(p * 100) }); })).item;
      } catch (err) {
        // 바로 올리기가 안 되는 경우(예전 서버 등) 작은 파일은 예전 방식으로
        if (f.size > 35 * 1048576 || /까지만|사이트에서만|멤버/.test(err.message)) throw err;
        status.textContent = tRaw('upload.reading');
        const data = await fileToBase64(f);
        status.textContent = tRaw('upload.uploading');
        item = (await api('upload', { kind, title, members, group, filename: f.name, mimeType: f.type, data, url })).item;
      }
    } else {
      const main = url || alt, second = url ? alt : '';
      if (!/^https?:\/\//.test(main) || (second && !/^https?:\/\//.test(second))) throw new Error(tRaw('upload.errLink'));
      if (!LIVE) {
        item = { id: 'l_' + Date.now(), kind, title: title || main, src: 'link', url: main, alt: second, members, group, by: '나', at: new Date().toISOString() };
        store.set('demoItems', [item, ...store.get('demoItems', [])]);
      } else {
        status.textContent = tRaw('upload.sending');
        item = (await api('addLink', { kind, title, url: main, alt: second, members, group })).item;
      }
    }
    Data.items.unshift(enrich(item));
    store.set('cache', { site: Data.site, items: Data.items.map(({ _ok, ...x }) => x) });
    $('#upload').hidden = true;
    toast(isVideoKind(kind) ? tRaw('upload.doneAs', { kind: KIND[kind].name }) : tRaw('upload.done'));
    route(true);
  } catch (err) {
    status.textContent = err.message;
  } finally { btn.disabled = false; }
});

async function renameItem(id) {
  const it = Data.item(id);
  if (!it) return;
  const title = prompt(tRaw('list.renamePrompt'), it.title || '');
  if (title === null || !title.trim() || title.trim() === it.title) return;
  try {
    if (!LIVE) store.set('demoItems', store.get('demoItems', []).map(x => (x.id === id ? { ...x, title: title.trim() } : x)));
    else { toast(tRaw('upload.saving'), false, true); await api('rename', { id, title: title.trim() }); }
    it.title = title.trim();
    if (Player.current()?.id === id) Player.paintNow(it);
    Player.paintQueue();
    toast(tRaw('list.renamed'));
    route(true);
  } catch (e) { toast(e.message, true); }
}

async function deleteItem(id) {
  if (!confirm(tRaw('upload.confirmDelete'))) return;
  // 서버가 지우는 데 몇 초 걸리니 바로 "지우는 중"을 띄우고, 그 칸은 흐리게 해서 못 누르게
  toast(tRaw('upload.deleting'), false, true);
  const rows = $$(`[data-del="${CSS.escape(id)}"]`).map(b => b.closest('.song, .clip, .art, .sh-item, li, .np-acts') || b);
  rows.forEach(el => el.classList.add('deleting'));
  try {
    if (!LIVE) store.set('demoItems', store.get('demoItems', []).filter(x => x.id !== id));
    else await api('remove', { id });
    Data.items = Data.items.filter(i => i.id !== id);
    toast(tRaw('upload.deleted'));
    Quota.p = null;
    route(true);
  } catch (e) {
    rows.forEach(el => el.classList.remove('deleting'));
    toast(e.message, true);
  }
}

/* ─── 시작 ─── */
function paintLogin(user) {
  const el = $('#login');
  if (!el) return;
  if (user) {
    el.innerHTML = `<div class="me">${user.picture ? `<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<span>${esc(user.name)}</span><button type="button" class="tiny" id="logout">${esc(t('login.logout'))}</button></div>`;
    $('#logout').onclick = () => Auth.logout();
  } else Auth.renderButton(el);
}

Auth.on(user => { paintLogin(user); if (user) Favs.sync(); if (Data.site) route(true); });
Favs.on(() => {
  $$('[data-fav]').forEach(b => { const on = Favs.has(b.dataset.fav); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = on ? ICON.star : ICON.starO; });
  if (location.hash.startsWith('#/stars')) route(true);
});
Data.on(() => { applySiteStyle(Data.site); applyKindNames(); fillTexts(); renderDrawer(); route(true); if (Intro.isOpen()) Intro.paint(); });
addEventListener('hashchange', () => route());

$('#cornerDots').innerHTML = Theme.dots();
$('#introBtn').addEventListener('click', () => Intro.show());
$('#enterBtn').addEventListener('click', () => Intro.hide());
$('#intro').addEventListener('wheel', e => { if (e.deltaY > 30 && !EDIT) Intro.hide(); }, { passive: true });
addEventListener('themechange', () => { $('#cornerDots').innerHTML = Theme.dots(); });

starfield($('#sky'));
Menu.init();
Player.init();
$('[data-p="shuffle"]').innerHTML = ICON.shuffle;
$('[data-p="prev"]').innerHTML = ICON.prev;
$('[data-p="next"]').innerHTML = ICON.next;
$('[data-p="repeat"]').innerHTML = ICON.repeat;
$('[data-p="hide"]').innerHTML = ICON.video;
$('[data-p="queue"]').innerHTML = ICON.menu;
$('[data-p="close"]').innerHTML = ICON.chevR.replace('M9 5l7 7-7 7', 'M5 9l7 7 7-7');
$('.icon-btn[data-p="page"]').innerHTML = ICON.expand;
$('.icon-btn[data-p="page"]').title = tRaw('player.open');
$$('.close').forEach(b => (b.innerHTML = ICON.close));
Player.setPlaying(false);
Player.paintModes();
Player.paintPrefer();
Auth.init();
// 첫 화면은 서버를 기다리지 않고 바로 띄운다
if (!EDIT && !location.hash.slice(2) && Intro.shouldShow()) Intro.show();
window.dataReady = Data.load();
