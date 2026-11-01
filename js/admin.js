/* 관리자 페이지 — 사이트의 모든 부분: 배너, 기수, 멤버, 일정, 글자, 테마 색, About, 올라온 것 */

let draft = null;      // 고치는 중인 사이트 데이터
let dirty = false;
let pickedMember = null;
let isAdmin = false;

const pane = $('#pane');
const clone = o => JSON.parse(JSON.stringify(o));
const slug = s => String(s).trim().toLowerCase().replace(/[^\w가-힣-]+/g, '-').replace(/^-|-$/g, '') || 'id' + Date.now().toString(36);

function markDirty() {
  dirty = true;
  store.set('editDraft', draft);
  $('#dirty').textContent = '저장 안 한 변경이 있다';
}
addEventListener('beforeunload', e => { if (dirty) e.preventDefault(); });

/* ─── 들어오기 ─── */
let gated;
async function gate(user) {
  paintLogin(user);
  const key = (user?.email || '') + '|' + !!window.google;
  if (gated === key) return;
  gated = key;
  const g = $('#gate');
  if (!LIVE) {
    isAdmin = true;
    g.innerHTML = `<p><b>미리보기 모드</b> — 서버가 아직 연결 안 돼서, 여기서 고친 뒤 <b>site.json 내려받기</b>로 받아<br>리포지토리의 <code>data/site.json</code> 에 덮어쓰면 반영된다.</p>`;
    return open();
  }
  if (!user) {
    g.hidden = false; $('#app').hidden = true; $('#savebar').hidden = true;
    g.innerHTML = `<h2>관리자 로그인</h2><p class="muted">Apps Script 의 ADMIN_EMAILS 에 넣은 구글 계정으로 로그인한다</p><div id="login2"></div>`;
    Auth.renderButton($('#login2'));
    return;
  }
  g.innerHTML = '<p class="muted">확인하는 중…</p>';
  try {
    const { user: u } = await api('whoami');
    isAdmin = u.admin;
  } catch (e) { g.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  if (!isAdmin) { g.innerHTML = `<p>${esc(user.email)} 은(는) 관리자가 아니다.</p>`; return; }
  g.hidden = true;
  open();
}

function open() {
  if (!draft) draft = store.get('editDraft') || clone(Data.site);
  applySiteStyle(draft);
  applyKindNames();
  $('#app').hidden = false;
  $('#savebar').hidden = false;
  $('#dlJson').hidden = LIVE;
  route();
}

function paintLogin(user) {
  const el = $('#login');
  if (user) {
    el.innerHTML = `<div class="me">${user.picture ? `<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<span>${esc(user.email)}</span><button class="tiny" id="logout">로그아웃</button></div>`;
    $('#logout').onclick = () => Auth.logout();
  } else Auth.renderButton(el);
}

/* ─── 탭 ─── */
function route() {
  if (!draft) return;
  const tab = location.hash.slice(1) || 'site';
  $$('#admTabs a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + tab));
  pane.onclick = pane.oninput = pane.onchange = null;
  ({ site: paneSite, groups: paneGroups, members: paneMembers, events: paneEvents, texts: paneTexts, colors: paneColors, about: paneAbout, content: paneContent, attend: paneAttend }[tab] || paneSite)();
}
addEventListener('hashchange', route);

/* 이미지 칸: 주소/드라이브 id 를 직접 넣거나, 파일을 골라 드라이브에 올린다 */
function imgField(label, value, key, shape) {
  if (value && typeof value === 'object') {
    const n = layersOf(value).layers.length;
    return `<div class="field"><span>${label}</span>
      <div class="imgf">
        <span class="prev ${shape === true ? 'wide' : shape || ''}" style="background-image:url('${esc(imgUrl(firstSrc(value), 400))}')"></span>
        <p class="muted sm" style="flex:1">그림 ${n}장을 겹쳐 놓았다. 위치·순서는 <a href="./?edit#/" style="text-decoration:underline">사이트에서 보며 고치기</a>에서 바꾼다.</p>
        <button type="button" class="btn sm" data-layreset="${esc(key)}">한 장으로 되돌리기</button>
      </div></div>`;
  }
  return `<label class="field"><span>${label} <em>주소나 드라이브 링크, 또는 파일 올리기</em></span>
    <div class="imgf">
      <span class="prev ${shape === true ? 'wide' : shape || ''}" style="background-image:url('${esc(imgUrl(value, 400))}')"></span>
      <input type="text" data-k="${key}" value="${esc(value || '')}" placeholder="https://… 또는 드라이브 링크">
      <label class="btn sm">올리기<input type="file" accept="image/*" data-img="${key}" hidden></label>
    </div></label>`;
}

// data-k="a.b.c" 칸을 고치면 대상 객체의 그 경로에 바로 넣는다
function bindInputs(target) {
  pane.oninput = e => {
    const el = e.target;
    if (!el.dataset.k) return;
    const path = el.dataset.k.split('.');
    let o = target();
    while (path.length > 1) { const k = path.shift(); o = o[k] ||= {}; }
    o[path[0]] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.closest('.imgf')) el.closest('.imgf').querySelector('.prev').style.backgroundImage = `url('${imgUrl(el.value, 400)}')`;
    markDirty();
  };
  pane.onchange = async e => {
    const el = e.target;
    if ('repaint' in el.dataset) { if (el.type === 'checkbox') pane.oninput(e); return route(); }
    if (!el.dataset.img) return;
    const f = el.files[0];
    if (!f) return;
    if (!LIVE) return toast('미리보기 모드에서는 주소를 직접 넣자', true);
    const input = el.closest('.imgf').querySelector('input[type=text]');
    try {
      toast('올리는 중…');
      const { id } = await api('uploadImage', { filename: f.name, mimeType: f.type, data: await fileToBase64(f) });
      input.value = id;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      toast('올렸다');
    } catch (err) { toast(err.message, true); }
  };
}

// 겹친 그림을 첫 장 하나로 되돌린다
pane.addEventListener('click', e => {
  const b = e.target.closest('[data-layreset]');
  if (!b || !confirm('겹친 그림을 첫 장 하나만 남길까?')) return;
  const path = b.dataset.layreset.split('.');
  let o = draft;
  while (path.length > 1) o = o[path.shift()];
  o[path[0]] = firstSrc(o[path[0]]);
  markDirty();
  route();
});

/* ─── 사이트 ─── */
function paneSite() {
  draft.banner ||= {};
  draft.images ||= {};
  pane.innerHTML = `
    <div class="editor">
      <p class="quota-box" id="adQuota">${esc(Quota.text() || (LIVE ? '저장 공간 불러오는 중…' : '서버를 연결하면 저장 공간이 보인다'))}</p>
      <h2>이미지</h2>
      <p class="muted sm">사이트에 나오는 그림 전부. 주소나 드라이브 링크를 넣거나 "올리기"로 올린다. 비워 두면 기본 그림이 나온다. 글자는 "글자" 탭에 있다.</p>
      ${imgField('배너 (홈 맨 위 · 첫 화면 오른쪽, 가로로 긴 그림)', draft.banner.image, 'banner.image', true)}
      ${IMAGE_SLOTS.map(([k, label]) => imgField(label, draft.images[k], `images.${k}`, k === 'drawer' || k === 'footer' || k === 'intro' || k === 'profileBg' ? true : '')).join('')}
      <h2 style="margin-top:18px">링크 · 연락처</h2>
      <div class="row">
        <label class="field"><span>팬 카페 주소 <em>배너의 로고 동그라미를 누르면 여기로 간다</em></span><input type="url" data-k="fanCafe" value="${esc(draft.fanCafe || '')}" placeholder="https://cafe.naver.com/…"></label>
        <label class="field"><span>삭제 요청 연락처 <em>About 페이지에 나온다</em></span><input type="email" data-k="contact" value="${esc(draft.contact || '')}"></label>
      </div>
    </div>`;
  bindInputs(() => draft);
  Quota.load().then(() => { const el = $('#adQuota'); if (el && Quota.text()) el.textContent = Quota.text(); });
}

/* ─── 기수 ─── */
function paneGroups() {
  pane.innerHTML = `
    <div class="editor">
      <h2>기수 · 유닛</h2>
      <p class="muted sm">순서대로 홈에 나온다. id 는 바꾸지 말자 (멤버와 연결돼 있다).</p>
      ${draft.groups.map((g, i) => `
        <div class="row">
          <label class="field" style="flex:0 0 110px"><span>id</span><input value="${esc(g.id)}" disabled></label>
          <label class="field"><span>기수</span><input data-k="groups.${i}.label" value="${esc(g.label)}"></label>
          <label class="field"><span>이름</span><input data-k="groups.${i}.name" value="${esc(g.name)}"></label>
          <label class="field" style="flex:0 0 80px"><span>색</span><input type="color" data-k="groups.${i}.color" value="${esc(g.color)}"></label>
          <button class="icon-btn" data-gup="${i}" title="위로">↑</button>
          <button class="icon-btn" data-gdel="${i}" title="지우기">${ICON.trash}</button>
        </div>`).join('')}
      <div><button class="btn sm" id="gAdd">＋ 기수 추가</button></div>
    </div>`;
  bindInputs(() => draft);
  $('#gAdd').onclick = () => {
    const n = draft.groups.length;
    draft.groups.push({ id: 'gen' + n + '_' + Date.now().toString(36).slice(-3), label: n + '기', name: 'NEW', color: '#9fb4ff' });
    markDirty(); route();
  };
  pane.onclick = e => {
    const up = e.target.closest('[data-gup]'), del = e.target.closest('[data-gdel]');
    if (up) { const i = +up.dataset.gup; if (i > 0) { [draft.groups[i - 1], draft.groups[i]] = [draft.groups[i], draft.groups[i - 1]]; markDirty(); route(); } }
    if (del) {
      const g = draft.groups[+del.dataset.gdel];
      if (draft.members.some(m => m.group === g.id)) return toast('이 기수에 멤버가 있어서 못 지운다', true);
      if (confirm(`${g.label} ${g.name} 지울까?`)) { draft.groups.splice(+del.dataset.gdel, 1); markDirty(); route(); }
    }
  };
}

/* ─── 멤버 ─── */
function paneMembers() {
  const ms = draft.members;
  if (!pickedMember || !ms.find(m => m.id === pickedMember)) pickedMember = ms[0]?.id;
  const i = ms.findIndex(m => m.id === pickedMember);
  const m = ms[i];
  pane.innerHTML = `
    <div class="two">
      <div class="mlist">
        ${ms.map(x => `<div class="mrow ${x.id === pickedMember ? 'on' : ''}" data-pick="${esc(x.id)}" style="--c:${esc(x.color)}">
          ${avatarHtml(x, 'av')}<b>${esc(x.name)}</b><small>${x.graduated ? '졸업' : esc(draft.groups.find(g => g.id === x.group)?.label || '')}</small></div>`).join('')}
        <button class="btn sm" id="mAdd">＋ 멤버 추가</button>
      </div>
      ${m ? `<div class="editor">
        <div class="row">
          <label class="field"><span>이름 (목차·카드에 나오는 것)</span><input data-k="members.${i}.name" value="${esc(m.name)}" data-repaint></label>
          <label class="field"><span>풀네임</span><input data-k="members.${i}.fullName" value="${esc(m.fullName || '')}"></label>
        </div>
        <div class="row">
          <label class="field"><span>영문 이름 <em>프로필 큰 글씨 · 카드</em></span><input data-k="members.${i}.en" value="${esc(m.en || '')}" placeholder="Yuni"></label>
          <label class="field"><span>영문 풀네임 <em>첫 단어가 프로필 왼쪽 세로 띠에</em></span><input data-k="members.${i}.enFull" value="${esc(m.enFull || '')}" placeholder="Ayatsuno Yuni"></label>
          <label class="check"><input type="checkbox" data-k="members.${i}.graduated" data-repaint ${m.graduated ? 'checked' : ''}>졸업 멤버 (홈 맨 아래 GRADUATION 으로)</label>
        </div>
        <div class="row">
          <label class="field"><span>기수</span><select data-k="members.${i}.group" data-repaint>${draft.groups.map(g => `<option value="${esc(g.id)}" ${g.id === m.group ? 'selected' : ''}>${esc(g.label)} ${esc(g.name)}</option>`).join('')}</select></label>
          <label class="field" style="flex:0 0 90px"><span>대표 색</span><input type="color" data-k="members.${i}.color" value="${esc(m.color)}"></label>
          <label class="field"><span>생일 <em>MM-DD</em></span><input data-k="members.${i}.birthday" value="${esc(m.birthday || '')}" placeholder="03-14" pattern="\\d{2}-\\d{2}"></label>
          <label class="field"><span>데뷔일</span><input type="date" data-k="members.${i}.debut" value="${esc(m.debut || '')}"></label>
        </div>
        ${imgField('프로필 사진 (카드·동그라미)', m.avatar, `members.${i}.avatar`)}
        ${imgField('전신 일러스트 (프로필 왼쪽 큰 그림 · 배경 투명 PNG 추천)', m.art, `members.${i}.art`, 'tall')}
        ${imgField('전신 일러스트 뒤 배경 (비우면 사이트 기본 배경)', m.artBg, `members.${i}.artBg`, true)}
        <div class="row">
          ${[['species', '종족'], ['age', '나이'], ['mbti', 'MBTI'], ['height', '신장'], ['oshi', '오시마크'], ['fanName', '팬네임']].map(([k, l]) => `<label class="field"><span>${l}</span><input data-k="members.${i}.${k}" value="${esc(m[k] || '')}"></label>`).join('')}
        </div>
        <label class="field"><span>소개 <em>Summary — 두세 줄이 가장 예쁘다</em></span><textarea data-k="members.${i}.bio">${esc(m.bio || '')}</textarea></label>
        <div class="row">
          <label class="field"><span>치지직</span><input type="url" data-k="members.${i}.links.chzzk" value="${esc(m.links?.chzzk || '')}" placeholder="https://chzzk.naver.com/…"></label>
          <label class="field"><span>X</span><input type="url" data-k="members.${i}.links.x" value="${esc(m.links?.x || '')}" placeholder="https://x.com/…"></label>
          <label class="field"><span>유튜브</span><input type="url" data-k="members.${i}.links.youtube" value="${esc(m.links?.youtube || '')}" placeholder="https://youtube.com/@…"></label>
          <label class="field"><span>나무위키 <em>비우면 정식 이름 문서로 간다</em></span><input type="url" data-k="members.${i}.links.namu" value="${esc(m.links?.namu || '')}" placeholder="https://namu.wiki/w/…"></label>
        </div>
        <div class="row">
          <button class="btn sm" data-mmove="-1">↑ 위로</button>
          <button class="btn sm" data-mmove="1">↓ 아래로</button>
          <span class="grow"></span>
          <button class="btn sm danger" data-mdel>${ICON.trash} 멤버 지우기</button>
        </div>
        <p class="muted sm">id: ${esc(m.id)} · 저장하면 드라이브에 이 멤버 폴더(커버곡·오리곡…)가 자동으로 생긴다. 이름을 바꿔도 폴더는 따라온다.</p>
      </div>` : ''}
    </div>`;
  bindInputs(() => draft);
  pane.onclick = e => {
    const p = e.target.closest('[data-pick]');
    if (p) { pickedMember = p.dataset.pick; return route(); }
    const mv = e.target.closest('[data-mmove]');
    if (mv) {
      const j = i + +mv.dataset.mmove;
      if (j >= 0 && j < ms.length) { [ms[i], ms[j]] = [ms[j], ms[i]]; markDirty(); route(); }
    }
    if (e.target.closest('[data-mdel]') && confirm(`${m.name} 지울까? (드라이브 폴더와 올라온 파일은 그대로 남는다)`)) {
      ms.splice(i, 1); markDirty(); route();
    }
  };
  $('#mAdd').onclick = () => {
    const name = prompt('새 멤버 이름');
    if (!name) return;
    const id = prompt('영문 id (주소에 쓰이고, 나중에 못 바꾼다)', slug(name));
    if (!id || ms.some(x => x.id === id)) return toast('id 가 비었거나 이미 있다', true);
    ms.push({ id: slug(id), name, fullName: '', en: '', enFull: '', graduated: false, art: '', artBg: '', quote: '', group: draft.groups[draft.groups.length - 1]?.id || '', color: '#9fb4ff', avatar: '', banner: '', bio: '', birthday: '', debut: '', links: { chzzk: '', x: '', youtube: '' } });
    pickedMember = slug(id);
    markDirty(); route();
  };
}

/* ─── 일정 ─── */
const TYPES = { event: '이벤트', broadcast: '방송', release: '발매', etc: '기타' };
function paneEvents() {
  draft.events.sort((a, b) => (a.date < b.date ? -1 : 1));
  pane.innerHTML = `
    <div class="editor">
      <h2>일정</h2>
      <p class="muted sm">생일·데뷔 기념일은 멤버 정보에서 자동으로 들어간다. 여기는 그 외 이벤트.</p>
      <div><button class="btn sm" id="eAdd">＋ 일정 추가</button></div>
      ${draft.events.map((ev, i) => `
        <div class="row" style="padding:14px;background:var(--bg);border:1px solid var(--line)">
          <label class="field" style="flex:0 0 150px"><span>시작</span><input type="date" data-k="events.${i}.date" value="${esc(ev.date)}"></label>
          <label class="field" style="flex:0 0 150px"><span>끝 <em>하루면 비움</em></span><input type="date" data-k="events.${i}.end" value="${esc(ev.end || '')}"></label>
          <label class="field" style="flex:0 0 110px"><span>종류</span><select data-k="events.${i}.type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${ev.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field" style="flex:2 1 220px"><span>제목</span><input data-k="events.${i}.title" value="${esc(ev.title)}"></label>
          <label class="field" style="flex:2 1 220px"><span>링크</span><input type="url" data-k="events.${i}.url" value="${esc(ev.url || '')}"></label>
          <div class="field" style="flex:1 1 100%"><span>관련 멤버</span><div class="chips">
            ${draft.members.map(m => `<button type="button" class="chip ${ev.members?.includes(m.id) ? 'on' : ''}" data-em="${i}:${esc(m.id)}" style="--c:${esc(m.color)}">${avatarHtml(m, 'av xs')}${esc(m.name)}</button>`).join('')}
          </div></div>
          <button class="btn sm danger" data-edel="${i}">${ICON.trash} 지우기</button>
        </div>`).join('')}
    </div>`;
  bindInputs(() => draft);
  $('#eAdd').onclick = () => {
    const d = new Date();
    draft.events.unshift({ id: 'e' + Date.now().toString(36), date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, end: '', type: 'event', title: '새 일정', url: '', members: [] });
    markDirty(); route();
  };
  pane.onclick = e => {
    const em = e.target.closest('[data-em]');
    if (em) {
      const [i, id] = em.dataset.em.split(':');
      const ev = draft.events[+i];
      ev.members ||= [];
      ev.members.includes(id) ? ev.members.splice(ev.members.indexOf(id), 1) : ev.members.push(id);
      em.classList.toggle('on'); markDirty();
    }
    const del = e.target.closest('[data-edel]');
    if (del && confirm('이 일정 지울까?')) { draft.events.splice(+del.dataset.edel, 1); markDirty(); route(); }
  };
}

/* ─── 출석 ─── 구글 계정마다 며칠 출석했는지 (관리자만) */
let attRows = null, attSort = 'days', attQ = '';
async function paneAttend() {
  pane.innerHTML = `<div class="editor"><div class="row">
      <h2 style="margin-right:auto">출석 <small class="muted" id="attCount"></small></h2>
      <input id="aq" placeholder="이름 · 이메일" value="${esc(attQ)}" style="padding:10px 12px;background:var(--bg);border:1px solid var(--line2);min-width:220px">
      <select id="asort" style="padding:10px 12px;background:var(--bg);border:1px solid var(--line2)">
        <option value="days" ${attSort === 'days' ? 'selected' : ''}>출석 많은 순</option>
        <option value="last" ${attSort === 'last' ? 'selected' : ''}>최근 출석 순</option>
        <option value="streak" ${attSort === 'streak' ? 'selected' : ''}>연속 출석 순</option>
      </select>
      ${LIVE ? '<button class="btn sm" id="areload">새로 읽기</button>' : ''}
    </div>
    <p class="muted sm">로그인한 사람이 캘린더에서 「오늘 출석하기」를 누른 기록이다. 날짜는 한국 시간 기준.</p>
    <div id="arows"><p class="muted">불러오는 중…</p></div></div>`;
  const paint = () => {
    const box = $('#arows');
    if (!box) return;
    if (!attRows) return;
    const q = attQ.toLowerCase().replace(/\s+/g, '');
    const rows = attRows.filter(r => !q || (r.name + r.email).toLowerCase().replace(/\s+/g, '').includes(q))
      .sort((a, b) => attSort === 'last' ? (b.last > a.last ? 1 : -1) : (b[attSort] - a[attSort]) || (b.last > a.last ? 1 : -1));
    $('#attCount').textContent = `${attRows.length}명 · 오늘 ${attRows.filter(r => r.today).length}명`;
    box.innerHTML = rows.length ? `<div style="overflow-x:auto"><table class="ctable">
      <tr><th>#</th><th>이름</th><th>구글 계정</th><th>출석</th><th>연속</th><th>마지막 출석</th><th>처음 출석</th></tr>
      ${rows.map((r, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(r.name)}</td><td class="muted">${esc(r.email)}</td>
        <td><b>${r.days}</b>일</td><td>${r.streak ? r.streak + '일' : '-'}</td><td>${esc(r.last)}${r.today ? ' <small style="color:#d64552">오늘</small>' : ''}</td><td class="muted">${esc(r.first)}</td></tr>`).join('')}
    </table></div>` : `<p class="muted" style="text-align:center;padding:40px 0">${attRows.length ? '찾는 사람이 없다' : '아직 출석한 사람이 없다'}</p>`;
  };
  $('#aq').oninput = e => { attQ = e.target.value; paint(); };
  $('#asort').onchange = e => { attSort = e.target.value; paint(); };
  const load = async () => {
    try {
      if (LIVE) attRows = (await api('attendanceAll')).people;
      else {
        const all = store.get('demoAttend', {}), today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
        attRows = Object.entries(all).map(([email, ds]) => { ds = [...ds].sort(); return { email, name: email.split('@')[0], days: ds.length, first: ds[0], last: ds[ds.length - 1], today: ds.includes(today), streak: 0 }; });
      }
    } catch (e) { $('#arows').innerHTML = `<p>${esc(e.message)}</p>`; return; }
    paint();
  };
  if ($('#areload')) $('#areload').onclick = () => { attRows = null; $('#arows').innerHTML = '<p class="muted">불러오는 중…</p>'; load(); };
  if (attRows) paint(); else load();
}

/* ─── 올라온 것 ─── */
let contentFilter = '';
// 검색 칸은 그대로 두고 표만 바꾼다 (한글 조합이 끊기지 않게)
function contentRows() {
  const q = contentFilter.toLowerCase().replace(/\s+/g, '');
  const items = Data.items.filter(i => !q || (i.title + i.by + i.members.join('') + i.members.map(id => Data.member(id)?.name || '').join('')).toLowerCase().replace(/\s+/g, '').includes(q));
  return `<div style="overflow-x:auto"><table class="ctable">
        <tr><th></th><th>제목</th><th>종류</th><th>멤버</th><th>올린 사람</th><th>날짜</th><th></th></tr>
        ${items.map(it => `<tr>
          <td><span class="s-th" style="display:block;width:56px;background-image:url('${esc(it.thumb || '')}')"></span></td>
          <td class="t"><a href="${esc(it.open)}" target="_blank" rel="noopener">${esc(it.title)}</a></td>
          <td>${KIND[it.kind]?.name || it.kind}</td>
          <td>${esc(it.members.map(id => Data.member(id)?.name || id).join(', '))}${it.group ? ` <small class="muted">(${esc(Data.group(it.group)?.label || it.group)})</small>` : ''}</td>
          <td>${esc(it.by || '-')}</td>
          <td class="muted">${fmtDate(it.at)}</td>
          <td><button class="icon-btn sm" data-cdel="${esc(it.id)}" title="지우기">${ICON.trash}</button></td>
        </tr>`).join('')}
      </table></div>
      ${items.length ? '' : `<p class="muted" style="text-align:center;padding:40px 0">${Data.items.length ? '찾는 게 없다' : '아직 올라온 게 없다. 사이트에서 올리면 여기에 모인다.'}</p>`}`;
}
function paneContent() {
  pane.innerHTML = `
    <div class="editor">
      <div class="row">
        <h2 style="margin-right:auto">올라온 것 <small class="muted">${Data.items.length}개</small></h2>
        <input id="cq" placeholder="제목 · 올린 사람 · 멤버" value="${esc(contentFilter)}" style="padding:10px 12px;background:var(--bg);border:1px solid var(--line2);min-width:240px">
        ${LIVE ? '<button class="btn sm" id="refresh">드라이브 다시 읽기</button>' : ''}
      </div>
      <p class="muted sm">드라이브 폴더에 직접 넣은 파일은 10분 안에 저절로 나타난다. 바로 보고 싶으면 "드라이브 다시 읽기".</p>
      <div id="crows">${contentRows()}</div>
    </div>`;
  const cq = $('#cq');
  cq.oninput = () => { contentFilter = cq.value; $('#crows').innerHTML = contentRows(); };
  pane.oninput = null;
  if ($('#refresh')) $('#refresh').onclick = async () => {
    try { toast('읽는 중…'); const { items } = await api('refresh'); Data.set(Data.site, items); paneContent(); toast('다시 읽었다'); }
    catch (e) { toast(e.message, true); }
  };
  pane.onclick = async e => {
    const d = e.target.closest('[data-cdel]');
    if (!d) return;
    const it = Data.item(d.dataset.cdel);
    if (!confirm(`"${it.title}" 지울까? ${it.src === 'drive' ? '(드라이브 휴지통으로 간다)' : ''}`)) return;
    try {
      if (LIVE) await api('remove', { id: it.id });
      else store.set('demoItems', store.get('demoItems', []).filter(x => x.id !== it.id));
      Data.items = Data.items.filter(x => x.id !== it.id);
      paneContent(); toast('지웠다');
    } catch (err) { toast(err.message, true); }
  };
}

/* ─── 글자 ─── 사이트에 나오는 글자 전부. 비워 두면 기본값 */
let textFilter = '';
function paneTexts() {
  draft.texts ||= {};
  const q = textFilter.trim().toLowerCase();
  pane.innerHTML = `
    <div class="editor">
      <div class="row" style="align-items:center">
        <h2 style="margin-right:auto">글자</h2>
        <input id="tq" placeholder="찾기 (예: 노래, ENTER)" value="${esc(textFilter)}" style="padding:10px 12px;background:var(--bg);border:1px solid var(--line2);min-width:260px">
      </div>
      <p class="muted sm">비워 두면 회색 글씨(기본값)가 나온다. <b>{name}</b> 같은 중괄호는 화면에서 실제 값으로 바뀌는 자리라 그대로 둔다. <b>**굵게**</b> 쓸 수 있는 칸도 있다.</p>
      ${TEXT_SECTIONS.map(sec => {
        const items = sec.items.filter(([k, label, def]) => !q || (label + k + def + (draft.texts[k] || '')).toLowerCase().includes(q));
        if (!items.length) return '';
        return `<h3 class="ko" style="font-size:20px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">${esc(sec.name)}</h3>
          ${items.map(([k, label, def, multi]) => `<label class="field"><span>${esc(label)} <em>${esc(k)}</em></span>
            ${multi
              ? `<textarea data-tk="${esc(k)}" placeholder="${esc(def)}" rows="3">${esc(draft.texts[k] || '')}</textarea>`
              : `<input data-tk="${esc(k)}" placeholder="${esc(def)}" value="${esc(draft.texts[k] || '')}">`}
          </label>`).join('')}`;
      }).join('')}
    </div>`;
  pane.oninput = e => {
    const el = e.target;
    if (el.id === 'tq') { textFilter = el.value; paneTexts(); const n = $('#tq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); return; }
    if (!el.dataset.tk) return;
    if (el.value) draft.texts[el.dataset.tk] = el.value; else delete draft.texts[el.dataset.tk];
    markDirty();
  };
}

/* ─── 테마 색 ─── */
const THEME_DEFAULTS = {
  dark: { bg: '#070820', fg: '#f3f0ff', dim: '#b9b2e6', accent: '#cfc6ff', panel: '#11123a', wall: '#1a1650', wallFg: '#f3f0ff', btn: '#cfc6ff', btnFg: '#070820' },
  lavender: { bg: '#ebe7ff', fg: '#1d1850', dim: '#423c7c', accent: '#5b4fd6', panel: '#f6f4ff', wall: '#5e50cf', wallFg: '#ffffff', btn: '#5e50cf', btnFg: '#ffffff' },
  white: { bg: '#fcfbff', fg: '#16143a', dim: '#46427a', accent: '#5b4fd6', panel: '#f4f2fb', wall: '#5e50cf', wallFg: '#ffffff', btn: '#5e50cf', btnFg: '#ffffff' },
};
const COLOR_LABELS = { bg: '바탕', fg: '글자', dim: '흐린 글자', accent: '강조', panel: '카드 바탕', wall: '왼쪽 벽 · 목차', wallFg: '벽 위 글자', btn: '버튼', btnFg: '버튼 글자' };
function paneColors() {
  draft.themeColors ||= {};
  pane.innerHTML = `
    <div class="editor">
      <h2>테마 색</h2>
      <p class="muted sm">바꾸면 이 화면에 바로 보인다. 오른쪽 위 동그라미로 테마를 바꿔 가며 확인하자.</p>
      ${THEMES.map(th => {
        const cur = { ...THEME_DEFAULTS[th.id], ...(draft.themeColors[th.id] || {}) };
        return `<h3 class="ko" style="font-size:20px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">${esc(th.name)}</h3>
          <div class="row">${Object.keys(COLOR_LABELS).map(k => `<label class="field" style="flex:0 0 120px"><span>${COLOR_LABELS[k]}</span><input type="color" data-k="themeColors.${th.id}.${k}" value="${esc(cur[k])}"></label>`).join('')}</div>
          <div><button type="button" class="btn sm" data-reset-theme="${th.id}">${esc(th.name)} 기본 색으로</button></div>`;
      }).join('')}
    </div>`;
  bindInputs(() => draft);
  const base = pane.oninput;
  pane.oninput = e => { base(e); applySiteStyle(draft); };
  pane.onclick = e => {
    const r = e.target.closest('[data-reset-theme]');
    if (r) { delete draft.themeColors[r.dataset.resetTheme]; applySiteStyle(draft); markDirty(); route(); }
  };
}

/* ─── About ─── 소개 칸, 주의한 점, 가이드라인 본문 */
function paneAbout() {
  const D = window.ABOUT_DEFAULT;
  draft.about ||= {};
  draft.about.facts ||= clone(D.facts);
  draft.about.cares ||= clone(D.cares);
  draft.about.chapters ||= clone(D.chapters);
  const A = draft.about;
  pane.innerHTML = `
    <div class="editor">
      <h2>About</h2>
      <p class="muted sm">소개 글과 제목들은 "글자" 탭에 있다. 여기는 목록과 가이드라인 본문이다.</p>

      <h3 class="ko" style="font-size:20px;margin-top:10px">소개 옆 칸</h3>
      ${A.facts.map((f, i) => `<div class="row">
        <label class="field" style="flex:1 1 200px"><span>제목</span><input data-k="about.facts.${i}.0" value="${esc(f[0])}"></label>
        <label class="field" style="flex:3 1 360px"><span>내용</span><input data-k="about.facts.${i}.1" value="${esc(f[1])}"></label>
        <button type="button" class="icon-btn" data-adel="facts.${i}" aria-label="지우기">${ICON.trash}</button></div>`).join('')}
      <div><button type="button" class="btn sm" data-aadd="facts">＋ 칸 추가</button></div>

      <h3 class="ko" style="font-size:20px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">이 사이트가 주의한 점</h3>
      ${A.cares.map((c, i) => `<div class="row">
        <label class="field" style="flex:1 1 200px"><span>제목</span><input data-k="about.cares.${i}.0" value="${esc(c[0])}"></label>
        <label class="field" style="flex:3 1 360px"><span>내용</span><textarea data-k="about.cares.${i}.1" rows="2">${esc(c[1])}</textarea></label>
        <label class="field" style="flex:1 1 160px"><span>근거 조항</span><input data-k="about.cares.${i}.2" value="${esc(c[2] || '')}"></label>
        <button type="button" class="icon-btn" data-adel="cares.${i}" aria-label="지우기">${ICON.trash}</button></div>`).join('')}
      <div><button type="button" class="btn sm" data-aadd="cares">＋ 항목 추가</button></div>

      <h3 class="ko" style="font-size:20px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">2차 창작 가이드라인 본문</h3>
      <p class="muted sm">빈 줄로 문단을 나눈다. <b>1.</b> 로 시작하면 번호 항목, 앞에 띄어쓰기를 두고 <b>a.</b> 로 시작하면 하위 항목, <b>[라벨](https://주소)</b> 한 줄은 버튼이 된다.</p>
      ${A.chapters.map((ch, i) => `<div style="border:1px solid var(--line);padding:16px;display:flex;flex-direction:column;gap:10px">
        <div class="row">
          <label class="field"><span>${String(i).padStart(2, '0')} 장 제목</span><input data-k="about.chapters.${i}.title" value="${esc(ch.title)}"></label>
          <label class="field"><span>영문</span><input data-k="about.chapters.${i}.en" value="${esc(ch.en || '')}"></label>
          <button type="button" class="icon-btn" data-aup="${i}" aria-label="위로">↑</button>
          <button type="button" class="icon-btn" data-adel="chapters.${i}" aria-label="지우기">${ICON.trash}</button>
        </div>
        <label class="field"><span>본문</span><textarea data-k="about.chapters.${i}.body" rows="12" style="font-family:var(--gothic);line-height:1.7">${esc(ch.body)}</textarea></label>
      </div>`).join('')}
      <div class="row"><button type="button" class="btn sm" data-aadd="chapters">＋ 장 추가</button><span class="grow"></span><button type="button" class="btn sm danger" id="aboutReset">About 전체를 기본값으로</button></div>
    </div>`;
  bindInputs(() => draft);
  pane.onclick = e => {
    const add = e.target.closest('[data-aadd]'), del = e.target.closest('[data-adel]'), up = e.target.closest('[data-aup]');
    if (add) {
      const k = add.dataset.aadd;
      A[k].push(k === 'facts' ? ['', ''] : k === 'cares' ? ['', '', ''] : { title: '새 장', en: '', body: '' });
      markDirty(); route();
    }
    if (del) {
      const [k, i] = del.dataset.adel.split('.');
      if (confirm('지울까?')) { A[k].splice(+i, 1); markDirty(); route(); }
    }
    if (up) { const i = +up.dataset.aup; if (i > 0) { [A.chapters[i - 1], A.chapters[i]] = [A.chapters[i], A.chapters[i - 1]]; markDirty(); route(); } }
    if (e.target.id === 'aboutReset' && confirm('About 의 목록과 가이드라인을 처음 내용으로 되돌릴까?')) { delete draft.about; markDirty(); route(); }
  };
}

/* ─── 저장 ─── */
$('#saveBtn').onclick = async () => {
  if (!LIVE) return downloadJson();
  try {
    $('#saveBtn').disabled = true;
    $('#dirty').textContent = '저장하는 중… (드라이브 폴더도 맞추느라 조금 걸린다)';
    Backups.add('저장 (자세한 설정)', draft);
    const { site } = await api('saveSite', { site: draft });
    Data.set(site, Data.items);
    store.set('cache', { site, items: Data.items.map(({ _ok, ...x }) => x) });
    store.del('editDraft');
    dirty = false;
    $('#dirty').textContent = '';
    toast('저장했다 ✦');
  } catch (e) {
    $('#dirty').textContent = e.message;
  } finally { $('#saveBtn').disabled = false; }
};
$('#dlJson').onclick = downloadJson;
function downloadJson() {
  Backups.add('내려받기 (자세한 설정)', draft);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
  a.download = 'site.json';
  a.click();
  dirty = false;
  $('#dirty').textContent = '받은 파일을 data/site.json 에 덮어쓰자';
}

/* ─── 시작 ─── */
starfield($('#sky'));
$('#admDots').innerHTML = Theme.dots();
Data.load().then(() => {
  Auth.on(u => gate(u));
  Auth.init();
});
