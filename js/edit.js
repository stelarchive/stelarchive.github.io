/* 사이트를 그대로 보면서 고치는 편집 모드 — index.html?edit
   글자를 누르면 그 자리에서 고치고, 그림을 누르면 바꾸는 창이 뜬다.
   고친 내용은 이 브라우저에 임시로 남고(stl.editDraft), 저장하거나 site.json 으로 내려받는다.
   목록으로 고치는 게 편한 것(생일·링크·일정·테마 색 등)은 admin.html#site 의 "자세한 설정". */

(() => {
  if (!EDIT) return;

  const IMG_LABELS = {
    'banner.image': '배너', 'images.logo': '로고', 'images.intro': '첫 화면 오른쪽 그림', 'images.crest': '왼쪽 벽 문양',
    'images.cafe': '팬 카페 버튼', 'images.drawer': '목차 배경', 'images.footer': '맨 아래 배경',
  };
  const MULTI = new Set(TEXT_SECTIONS.flatMap(s => s.items.filter(i => i[3]).map(i => i[0])));
  const LONG_FIELDS = /\.(bio)$/;
  let changes = 0;

  /* ── 경로로 값 읽고 쓰기: "members.3.bio" ── */
  const getPath = (o, path) => path.split('.').reduce((x, k) => x?.[k], o);
  function setPath(o, path, v) {
    const ks = path.split('.');
    const last = ks.pop();
    for (const k of ks) o = o[k] ||= {};
    if (v === '' || v == null) delete o[last]; else o[last] = v;
  }

  /* ── 멤버 링크 (치지직 · X · 유튜브 · 나무위키): 아이콘이나 버튼을 누르면 주소를 묻는다 ── */
  function editLink(path) {
    const [, i, , k] = path.split('.');
    const m = Data.site.members[+i];
    const label = { chzzk: '치지직', x: 'X', youtube: '유튜브', namu: '나무위키' }[k] || k;
    const cur = getPath(Data.site, path) || '';
    const v = prompt(`${m?.name || ''} ${label} 주소를 넣자 (비우면 지운다${k === 'namu' ? ' — 나무위키는 비우면 정식 이름 문서로 간다' : ''})`, cur);
    if (v === null) return;
    const u = v.trim();
    if (u && !/^https?:\/\//.test(u)) { toast('https:// 로 시작하는 주소를 넣자', true); return; }
    setPath(Data.site, path, u);
    touch();
    refresh();
  }

  /* ── 임시 저장 ── */
  let beforeEdit = null; // 이번에 고치기 시작하기 전 상태 (처음 고칠 때 백업으로 남긴다)
  function touch() {
    if (beforeEdit) { Backups.add('고치기 시작 전', JSON.parse(beforeEdit)); beforeEdit = null; }
    changes++;
    store.set('editDraft', Data.site);
    paintBar();
  }
  function refresh() {
    applySiteStyle(Data.site);
    applyKindNames();
    fillTexts();
    renderDrawer();
    route(true);
    if (Intro.isOpen()) Intro.show();
    convert(document.body);
  }

  /* ── 표시 → 고칠 수 있는 칸 ── */
  const SKIP = new Set(['OPTION', 'TEXTAREA', 'TITLE', 'SCRIPT', 'STYLE']);
  function convert(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 3) return;
    // 속성에 묻은 표시는 지운다 (aria-label, title, placeholder …)
    if (root.nodeType === 1) {
      [root, ...root.querySelectorAll('*')].forEach(el => {
        for (const a of el.attributes) if (a.value.includes('')) el.setAttribute(a.name, stripMarks(a.value));
      });
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = root.nodeType === 3 ? root : walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.includes('')) nodes.push(n);
    for (const n of nodes) {
      if (!n.parentNode) continue;
      if (SKIP.has(n.parentNode.nodeName) || n.parentNode.closest?.('.ed-t')) { n.nodeValue = stripMarks(n.nodeValue); continue; }
      const frag = document.createDocumentFragment();
      let last = 0;
      const v = n.nodeValue;
      v.replace(MARK, (m, key, text, at) => {
        if (at > last) frag.append(stripMarks(v.slice(last, at)));
        const sp = document.createElement('span');
        sp.className = 'ed-t';
        sp.dataset.tk = key;
        sp.textContent = text;
        frag.append(sp);
        last = at + m.length;
      });
      if (last < v.length) frag.append(stripMarks(v.slice(last)));
      n.replaceWith(frag);
    }
  }
  new MutationObserver(list => {
    for (const r of list) r.addedNodes.forEach(convert);
  }).observe(document.body, { childList: true, subtree: true });

  /* ── 글자 고치기 ── */
  function rawTemplate(key) {
    const c = Data.site.texts?.[key];
    return c != null && c !== '' ? c : TEXT_DEFAULT[key] ?? '';
  }
  function startEdit(sp) {
    if (sp.isContentEditable) return;
    const key = sp.dataset.tk, field = sp.dataset.field;
    sp.dataset.before = sp.innerText;
    // {name} 같은 자리가 있는 글자는 원래 틀을 보여 주고 고친다
    if (key && /\{\w+\}/.test(rawTemplate(key))) sp.textContent = rawTemplate(key);
    if (key && MULTI.has(key)) sp.innerText = rawTemplate(key);
    sp.contentEditable = 'plaintext-only' in document.body ? 'plaintext-only' : 'true';
    sp.spellcheck = false;
    sp.focus();
    const r = document.createRange();
    r.selectNodeContents(sp);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    const multi = (key && MULTI.has(key)) || (field && LONG_FIELDS.test(field));
    const onKey = e => {
      if (e.key === 'Enter' && !(multi && e.shiftKey)) { e.preventDefault(); sp.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); sp.dataset.cancel = '1'; sp.blur(); }
      e.stopPropagation();
    };
    sp.addEventListener('keydown', onKey);
    sp.addEventListener('blur', () => {
      sp.removeEventListener('keydown', onKey);
      sp.contentEditable = 'false';
      if (sp.dataset.cancel) { delete sp.dataset.cancel; refresh(); return; }
      const v = sp.innerText.replace(/ /g, ' ').replace(/\n+$/, '').trim();
      if (key) {
        Data.site.texts ||= {};
        if (v === '' || v === TEXT_DEFAULT[key]) delete Data.site.texts[key]; else Data.site.texts[key] = v;
      } else if (field) {
        if (/\.(name)$/.test(field) && !v) { toast('이름은 비울 수 없다', true); refresh(); return; }
        setPath(Data.site, field, v);
      }
      if (v !== sp.dataset.before) touch();
      refresh();
    }, { once: true });
  }

  /* ── 그림 바꾸기 ── */
  const pop = document.createElement('div');
  pop.id = 'imgpop';
  pop.hidden = true;
  document.body.append(pop);
  function labelFor(path) {
    if (IMG_LABELS[path]) return IMG_LABELS[path];
    const m = path.match(/^members\.(\d+)\.(\w+)$/);
    if (m) return `${Data.site.members[+m[1]]?.name || ''} ${{ avatar: '프로필 사진', art: '전신 일러스트', artBg: '그림 뒤 배경' }[m[2]] || ''}`;
    return path;
  }
  function openImg(path, anchor) {
    const cur = firstSrc(getPath(Data.site, path)) || '';
    const r = anchor.getBoundingClientRect();
    pop.innerHTML = `
      <b>${esc(labelFor(path))}</b>
      <span class="ip-prev" style="background-image:url('${esc(imgUrl(cur, 400))}')"></span>
      <label class="field"><span>주소 또는 드라이브 링크</span><input id="ipUrl" type="url" value="${esc(cur)}" placeholder="https://…"></label>
      <div class="ip-row">
        <label class="btn sm">파일 올리기<input type="file" accept="image/*" id="ipFile" hidden></label>
        <button type="button" class="btn sm" id="ipClear">기본으로</button>
        <span class="grow"></span>
        <button type="button" class="btn sm" id="ipClose">닫기</button>
        <button type="button" class="btn sm solid" id="ipOk">적용</button>
      </div>
      ${/^members\.\d+\.art$/.test(path) ? `<button type="button" class="tiny" id="ipBg">그림 뒤 배경 바꾸기</button>` : ''}
      ${anchor.closest('[data-pos]') ? `<button type="button" class="btn sm" id="ipPos">✥ 이 자리에서 위치 · 크기 옮기기</button>` : ''}`;
    pop.hidden = false;
    const w = 360, top = Math.min(innerHeight - 320, Math.max(12, r.top + 12)), left = Math.min(innerWidth - w - 12, Math.max(12, r.left + 12));
    Object.assign(pop.style, { top: top + 'px', left: left + 'px', width: w + 'px' });
    const url = $('#ipUrl');
    url.addEventListener('input', () => { $('.ip-prev', pop).style.backgroundImage = `url('${imgUrl(url.value, 400)}')`; });
    url.focus();
    const apply = v => { setPath(Data.site, path, v); touch(); refresh(); pop.hidden = true; };
    $('#ipOk').onclick = () => apply(url.value.trim());
    $('#ipClear').onclick = () => apply('');
    $('#ipClose').onclick = () => (pop.hidden = true);
    if ($('#ipBg')) $('#ipBg').onclick = () => openImg(path.replace(/\.art$/, '.artBg'), anchor);
    if ($('#ipPos')) $('#ipPos').onclick = () => { pop.hidden = true; Pos.open(anchor.closest('[data-pos]').dataset.pos); };
    url.onkeydown = e => { if (e.key === 'Enter') apply(url.value.trim()); if (e.key === 'Escape') pop.hidden = true; };
    $('#ipFile').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      if (!LIVE) return toast('파일 올리기는 구글을 연결한 뒤에 된다. 지금은 주소를 넣자', true);
      try {
        toast('올리는 중…');
        const { id } = await api('uploadImage', { filename: f.name, mimeType: f.type, data: await fileToBase64(f) });
        apply(id);
        toast('올렸다');
      } catch (err) { toast(err.message, true); }
    };
  }


  /* ── 그림 겹 편집기 ──
     영역을 누르면 오른쪽에 판이 뜬다. 영역 안에서 끌면 고른 그림이 움직인다. */
  const SINGLE = new Set(['images.logo', 'images.cafe', 'images.crest']);
  const DEFS = { art: { fit: 'contain', oy: 100 }, avatar: { oy: 0 } };
  const panel = document.createElement('aside');
  panel.id = 'laypanel';
  panel.hidden = true;
  document.body.append(panel);

  const Lay = {
    path: null, sel: 0,
    def() { const k = this.path.split('.').pop(); return DEFS[k] || {}; },
    data() {
      // 주소 하나로 저장돼 있던 것도 겹 구조로 바꿔서 다룬다
      const cur = getPath(Data.site, this.path);
      const v = layersOf(cur, this.def());
      return v;
    },
    save(v) {
      setPath(Data.site, this.path, v.layers.length ? { layers: v.layers, overflow: v.overflow } : '');
      touch();
    },
    region() {
      return [...document.querySelectorAll(`[data-ei="${CSS.escape(this.path)}"]`)].find(el => el.offsetParent || el.id === 'drawer') || null;
    },
    open(path) {
      Pos.close();
      this.path = path;
      this.sel = 0;
      // 첫 화면 오른쪽 그림이 비어 있으면 배너를 쓰고 있으므로, 고치기 시작할 때 복사해 둔다
      if (path === 'images.intro' && !layersOf(getPath(Data.site, path)).layers.length && Data.site.banner?.image) {
        setPath(Data.site, path, JSON.parse(JSON.stringify(layersOf(Data.site.banner.image))));
      }
      document.body.classList.add('lay-editing');
      if (path === 'images.drawer') Menu.openDrawer(false);
      this.paint();
    },
    close() {
      this.path = null;
      document.body.classList.remove('lay-editing');
      $$('.lay-target').forEach(el => el.classList.remove('lay-target'));
      panel.hidden = true;
    },
    rerender() {
      refresh();
      if (this.path === 'images.drawer') Menu.openDrawer(false);
      this.mark();
    },
    mark() {
      $$('.lay-target').forEach(el => el.classList.remove('lay-target'));
      const r = this.region();
      if (!r) return;
      r.classList.add('lay-target');
      $$('.lays .lay', r).forEach((img, i) => img.classList.toggle('lay-sel', i === this.sel));
    },
    paint() {
      const v = this.data();
      const L = v.layers[this.sel];
      panel.hidden = false;
      panel.innerHTML = `
        <div class="lp-h"><b>${esc(labelFor(this.path))}</b><button type="button" class="icon-btn sm" data-lp="close" aria-label="닫기">${ICON.close}</button></div>
        <label class="lp-sw"><input type="checkbox" data-lp="overflow" ${v.overflow ? 'checked' : ''}> 영역 밖으로 나가도 보이기</label>
        <ol class="lp-list">${v.layers.map((l, i) => `
          <li class="${i === this.sel ? 'on' : ''}" data-lp-sel="${i}">
            <span class="lp-th" style="background-image:url('${esc(imgUrl(l.src, 200))}')"></span>
            <span class="lp-n">${i + 1}. ${l.fit === 'free' ? '자유 그림' : '채우는 그림'}</span>
            <button type="button" class="icon-btn sm" data-lp="up" data-i="${i}" aria-label="뒤로 보내기" title="뒤로">↑</button>
            <button type="button" class="icon-btn sm" data-lp="down" data-i="${i}" aria-label="앞으로 가져오기" title="앞으로">↓</button>
            <button type="button" class="icon-btn sm" data-lp="del" data-i="${i}" aria-label="지우기">${ICON.trash}</button>
          </li>`).join('') || '<li class="lp-empty">아직 그림이 없다. 아래에서 넣자</li>'}</ol>
        ${L ? `
          <div class="lp-sec">
            <p class="lp-hint">영역 안에서 <b>끌면</b> ${L.fit === 'free' ? '그림이 움직인다' : '보이는 부분이 움직인다'}.</p>
            ${L.fit === 'free' ? `
              <label class="lp-rg"><span>크기</span><input type="range" min="3" max="200" step="1" value="${L.w ?? 40}" data-lp="w"><em>${Math.round(L.w ?? 40)}%</em></label>
              <label class="lp-rg"><span>회전</span><input type="range" min="-180" max="180" step="1" value="${L.r ?? 0}" data-lp="r"><em>${Math.round(L.r ?? 0)}°</em></label>
            ` : `
              <div class="lp-seg"><button type="button" data-lp="fit" data-v="cover" aria-pressed="${L.fit !== 'contain'}">꽉 채우기</button><button type="button" data-lp="fit" data-v="contain" aria-pressed="${L.fit === 'contain'}">전부 보이기</button></div>
              <label class="lp-rg"><span>확대</span><input type="range" min="1" max="4" step="0.01" value="${L.zoom ?? 1}" data-lp="zoom"><em>${(+(L.zoom ?? 1)).toFixed(2)}×</em></label>
            `}
            <div class="lp-row">
              <button type="button" class="btn sm" data-lp="center">위치 처음으로</button>
              <button type="button" class="btn sm" data-lp="mode">${L.fit === 'free' ? '채우는 그림으로' : '자유 그림으로'}</button>
            </div>
            <label class="field"><span>이 그림 주소</span><input type="url" value="${esc(L.src)}" data-lp="src"></label>
          </div>` : ''}
        <div class="lp-sec">
          <b class="lp-k">그림 넣기</b>
          <label class="field"><span>주소 또는 드라이브 링크</span><input type="url" id="lpAdd" placeholder="https://…"></label>
          <div class="lp-row">
            <button type="button" class="btn sm solid" data-lp="add">${v.layers.length ? '위에 겹쳐 넣기' : '넣기'}</button>
            <label class="btn sm">파일 올리기<input type="file" accept="image/*" data-lp="file" hidden></label>
          </div>
        </div>
        <button type="button" class="btn sm" data-lp="close" style="align-self:flex-end">다 했다</button>`;
      this.mark();
    },
    update(fn, repaint = true) {
      const v = this.data();
      fn(v, v.layers[this.sel]);
      this.save(v);
      this.rerender();
      if (repaint) this.paint();
    },
    add(src) {
      if (!src) return;
      this.update(v => {
        v.layers.push(v.layers.length ? { src, fit: 'free', x: 50, y: 50, w: 40, r: 0 } : { src, fit: this.def().fit || 'cover', ox: 50, oy: this.def().oy ?? 50, zoom: 1 });
        this.sel = v.layers.length - 1;
      });
    },
  };

  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-lp], [data-lp-sel]');
    if (!b) return;
    if (b.dataset.lpSel != null && !e.target.closest('button')) { Lay.sel = +b.dataset.lpSel; return Lay.paint(); }
    const a = b.dataset.lp, i = +b.dataset.i;
    if (a === 'close') return Lay.close();
    if (a === 'del' && confirm('이 그림을 지울까?')) Lay.update(v => { v.layers.splice(i, 1); Lay.sel = Math.max(0, Math.min(Lay.sel, v.layers.length - 1)); });
    if (a === 'up' && i > 0) Lay.update(v => { [v.layers[i - 1], v.layers[i]] = [v.layers[i], v.layers[i - 1]]; Lay.sel = i - 1; });
    if (a === 'down') Lay.update(v => { if (i < v.layers.length - 1) { [v.layers[i + 1], v.layers[i]] = [v.layers[i], v.layers[i + 1]]; Lay.sel = i + 1; } });
    if (a === 'fit') Lay.update((v, L) => { L.fit = b.dataset.v; });
    if (a === 'center') Lay.update((v, L) => { if (L.fit === 'free') Object.assign(L, { x: 50, y: 50, r: 0 }); else Object.assign(L, { ox: 50, oy: Lay.def().oy ?? 50, zoom: 1 }); });
    if (a === 'mode') Lay.update((v, L) => {
      if (L.fit === 'free') { Object.assign(L, { fit: 'cover', ox: 50, oy: 50, zoom: 1 }); delete L.x; delete L.y; delete L.w; delete L.r; }
      else { Object.assign(L, { fit: 'free', x: 50, y: 50, w: 50, r: 0 }); delete L.ox; delete L.oy; delete L.zoom; }
    });
    if (a === 'add') { Lay.add($('#lpAdd').value.trim()); }
  });
  panel.addEventListener('change', async e => {
    const el = e.target, a = el.dataset.lp;
    if (a === 'overflow') Lay.update(v => { v.overflow = el.checked; });
    if (a === 'src' && el.value.trim()) Lay.update((v, L) => { L.src = el.value.trim(); });
    if (a === 'file') {
      const f = el.files[0];
      if (!f) return;
      if (!LIVE) return toast('파일 올리기는 구글을 연결한 뒤에 된다. 지금은 주소를 넣자', true);
      try { toast('올리는 중…'); const { id } = await api('uploadImage', { filename: f.name, mimeType: f.type, data: await fileToBase64(f) }); Lay.add(id); toast('올렸다'); }
      catch (err) { toast(err.message, true); }
    }
  });
  // 슬라이더: 끄는 동안은 그림만 바로 바꾸고, 손을 떼면 저장
  panel.addEventListener('input', e => {
    const el = e.target, a = el.dataset.lp;
    if (!['w', 'r', 'zoom'].includes(a)) return;
    const v = Lay.data(), L = v.layers[Lay.sel];
    L[a] = +el.value;
    el.nextElementSibling.textContent = a === 'zoom' ? (+el.value).toFixed(2) + '×' : Math.round(el.value) + (a === 'r' ? '°' : '%');
    const img = $$('.lays .lay', Lay.region() || document)[Lay.sel];
    if (img) img.style.cssText = layerStyle(L);
    setPath(Data.site, Lay.path, { layers: v.layers, overflow: v.overflow });
  });
  panel.addEventListener('change', e => { if (['w', 'r', 'zoom'].includes(e.target.dataset.lp)) { touch(); Lay.rerender(); } });

  // 누르기 시작한 곳을 기억한다 — 판·영역·도구 막대에서 시작한 누르기는 '바깥 누르기'가 아니다
  document.addEventListener('pointerdown', e => {
    Lay.downInside = !!e.target.closest('#laypanel, #editbar, .lay-target');
  }, true);
  // 영역 안에서 끌기
  document.addEventListener('pointerdown', e => {
    if (!Lay.path || e.button !== 0) return;
    const region = Lay.region();
    if (!region || !region.contains(e.target) || e.target.closest('#laypanel')) return;
    const v = Lay.data();
    // 자유 그림을 누르면 그 그림을 고른다
    const imgs = $$('.lays .lay', region);
    // 자유 그림만 눌러서 고른다. 채우는 그림 위를 누르면 지금 고른 그림을 끈다
    const hit = e.target.classList?.contains('free') ? imgs.indexOf(e.target) : -1;
    if (hit >= 0 && hit !== Lay.sel) { Lay.sel = hit; Lay.paint(); }
    const L = v.layers[Lay.sel];
    if (!L) return;
    e.preventDefault();
    const box = region.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, L: { ...L } };
    const img = imgs[Lay.sel];
    const move = ev => {
      const dx = (ev.clientX - start.x) / box.width * 100, dy = (ev.clientY - start.y) / box.height * 100;
      const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
      if (L.fit === 'free') {
        L.x = v.overflow ? start.L.x + dx : clamp(start.L.x + dx, 0, 100);
        L.y = v.overflow ? start.L.y + dy : clamp(start.L.y + dy, 0, 100);
      } else {
        const k = 1 / Math.max(1, L.zoom || 1);
        L.ox = clamp((start.L.ox ?? 50) - dx * k, 0, 100);
        L.oy = clamp((start.L.oy ?? 50) - dy * k, 0, 100);
      }
      if (img) img.style.cssText = layerStyle(L);
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      Lay.save(v);
      // 끌기를 끝낸 손은 바깥에서 떼도 '바깥 누르기'로 치지 않는다
      Lay.justDragged = true;
      setTimeout(() => { Lay.justDragged = false; }, 0);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }, true);
  // 영역과 판 바깥을 누르면 끝
  document.addEventListener('click', e => {
    if (!Lay.path || !e.target.isConnected || Lay.justDragged || Lay.downInside) return; // 판을 다시 그리느라 떨어져 나간 버튼은 바깥이 아니다
    if (e.target.closest('#laypanel, #editbar, .lay-target')) return;
    Lay.close();
  });
  addEventListener('hashchange', () => Lay.close());


  /* ── 자리 옮기기 (로고 · 벽 문양) ──
     그 자리에 있는 그림을 끌어서 옮기고, 판에서 크기 · 회전을 바꾼다. 자리마다 따로 저장된다 */
  const Pos = {
    key: null,
    get() { return { dx: 0, dy: 0, s: 1, r: 0, ...(Data.site.positions?.[this.key] || {}) }; },
    put(p) {
      Data.site.positions ||= {};
      const clean = p.dx || p.dy || p.r || p.s !== 1;
      if (clean) Data.site.positions[this.key] = { dx: Math.round(p.dx), dy: Math.round(p.dy), s: +(+p.s).toFixed(2), r: Math.round(p.r) };
      else delete Data.site.positions[this.key];
      applyPositions();
    },
    els() { return $$(`[data-pos="${CSS.escape(this.key)}"]`); },
    open(key) {
      Lay.close();
      this.key = key;
      document.body.classList.add('pos-editing');
      if (key === 'logo.drawer') Menu.openDrawer(false);
      this.paint();
    },
    close() {
      if (!this.key) return;
      this.key = null;
      document.body.classList.remove('pos-editing');
      $$('.pos-target').forEach(el => el.classList.remove('pos-target'));
      panel.hidden = true;
    },
    paint() {
      const p = this.get();
      this.els().forEach(el => el.classList.add('pos-target'));
      panel.hidden = false;
      panel.innerHTML = `
        <div class="lp-h"><b>${esc(POS_LABELS[this.key] || this.key)}</b><button type="button" class="icon-btn sm" data-ps="close" aria-label="닫기">${ICON.close}</button></div>
        <p class="lp-hint">테두리가 생긴 그림을 <b>끌면</b> 자리가 옮겨진다. 이 자리에서만 바뀌고 다른 곳의 같은 그림은 그대로다.</p>
        <label class="lp-rg"><span>크기</span><input type="range" min="0.2" max="4" step="0.01" value="${p.s}" data-ps="s"><em>${(+p.s).toFixed(2)}×</em></label>
        <label class="lp-rg"><span>회전</span><input type="range" min="-180" max="180" step="1" value="${p.r}" data-ps="r"><em>${Math.round(p.r)}°</em></label>
        <p class="lp-hint">가로 ${Math.round(p.dx)}px · 세로 ${Math.round(p.dy)}px 옮김</p>
        <div class="lp-row"><button type="button" class="btn sm" data-ps="reset">처음 자리로</button><span class="grow"></span><button type="button" class="btn sm solid" data-ps="close">다 했다</button></div>`;
    },
  };
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-ps]');
    if (!b || !Pos.key) return;
    if (b.dataset.ps === 'close') Pos.close();
    if (b.dataset.ps === 'reset') { Pos.put({ dx: 0, dy: 0, s: 1, r: 0 }); touch(); Pos.paint(); }
  });
  panel.addEventListener('input', e => {
    const k = e.target.dataset.ps;
    if (!Pos.key || (k !== 's' && k !== 'r')) return;
    const p = Pos.get();
    p[k] = +e.target.value;
    e.target.nextElementSibling.textContent = k === 's' ? (+p.s).toFixed(2) + '×' : Math.round(p.r) + '°';
    Pos.put(p);
  });
  panel.addEventListener('change', e => { if (Pos.key && (e.target.dataset.ps === 's' || e.target.dataset.ps === 'r')) touch(); });
  document.addEventListener('pointerdown', e => {
    if (!Pos.key || e.button !== 0) return;
    const el = e.target.closest(`[data-pos="${CSS.escape(Pos.key)}"]`);
    if (!el) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, p: Pos.get() };
    const move = ev => { Pos.put({ ...start.p, dx: start.p.dx + ev.clientX - start.x, dy: start.p.dy + ev.clientY - start.y }); };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      touch();
      Pos.paint();
      Pos.justDragged = true;
      setTimeout(() => { Pos.justDragged = false; }, 0);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }, true);
  document.addEventListener('click', e => {
    if (!Pos.key) return;
    if (e.target.closest('#laypanel, #editbar')) return; // 판과 도구 막대 버튼은 그대로 작동
    if (e.target.closest(`[data-pos="${CSS.escape(Pos.key)}"]`)) { e.preventDefault(); e.stopImmediatePropagation(); return; } // 옮기는 그림은 눌러도 이동·그림 창 없음
    if (Pos.justDragged || !e.target.isConnected) return;
    Pos.close();
  }, true);
  addEventListener('hashchange', () => Pos.close());

  /* ── 판을 창처럼: 제목 줄을 끌면 판이 옮겨지고, 다음에 열 때도 그 자리에 뜬다 ── */
  const placePanel = (x, y) => {
    x = Math.min(Math.max(8, x), innerWidth - Math.max(panel.offsetWidth, 200) - 8);
    y = Math.min(Math.max(8, y), innerHeight - 160);
    Object.assign(panel.style, { left: x + 'px', top: y + 'px', right: 'auto', maxHeight: `calc(100vh - ${y}px - 16px - var(--player))` });
  };
  const savedPanel = store.get('panelPos');
  if (savedPanel) placePanel(savedPanel[0], savedPanel[1]);
  panel.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.target.closest('.lp-h') || e.target.closest('button')) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    panel.classList.add('moving');
    const move = ev => placePanel(ev.clientX - ox, ev.clientY - oy);
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      panel.classList.remove('moving');
      store.set('panelPos', [parseFloat(panel.style.left), parseFloat(panel.style.top)]);
      // 판 밖에서 손을 떼도 '바깥 누르기'로 닫히지 않게
      Lay.justDragged = Pos.justDragged = true;
      setTimeout(() => { Lay.justDragged = Pos.justDragged = false; }, 0);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
  addEventListener('resize', () => { if (panel.style.left) placePanel(parseFloat(panel.style.left), parseFloat(panel.style.top)); });

  /* ── 백업 창 ── */
  const BackupWin = {
    el: null,
    open() {
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.className = 'modal';
        this.el.id = 'backupWin';
        document.body.append(this.el);
        this.el.addEventListener('click', e => this.click(e));
        this.el.addEventListener('change', e => this.load(e));
      }
      this.el.hidden = false;
      this.paint();
    },
    async paint() {
      const list = Backups.list();
      const fmt = iso => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
      this.el.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true" aria-label="백업">
          <button type="button" class="icon-btn close" data-bk="close" aria-label="닫기">${ICON.close}</button>
          <h2><span class="sc">Backup</span>백업</h2>
          <p class="hint">고치기 시작하기 전, 저장 · 내려받기 할 때마다 이 브라우저에 자동으로 남는다 (최근 ${Backups.max}개). 되살리면 지금 화면이 그 상태로 바뀌고, 저장해야 사이트에 반영된다.</p>
          <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn sm" data-bk="now">지금 상태 백업</button>
            <button type="button" class="btn sm" data-bk="dlnow">지금 상태를 파일로 받기</button>
            <label class="btn sm">백업 파일 불러오기<input type="file" accept="application/json,.json" data-bk="file" hidden></label>
          </div>
          <ol class="bk-list">${list.map((b, i) => `<li>
            <span><b>${esc(b.label)}</b><small>${fmt(b.at)} · ${(b.json.length / 1024).toFixed(1)}KB</small></span>
            <button type="button" class="btn sm" data-bk="dl" data-i="${i}">파일</button>
            <button type="button" class="btn sm solid" data-bk="restore" data-i="${i}">되살리기</button>
            <button type="button" class="icon-btn sm" data-bk="del" data-i="${i}" aria-label="지우기">${ICON.trash}</button>
          </li>`).join('') || '<li class="muted">아직 백업이 없다</li>'}</ol>
          ${LIVE ? `<h3 class="ko" style="font-size:18px">드라이브 백업 <small class="muted">저장할 때마다 서버에 남는 이전 버전</small></h3><ol class="bk-list" id="bkServer"><li class="muted">불러오는 중…</li></ol>` : ''}
        </div>`;
      if (LIVE) {
        try {
          const { backups } = await api('listBackups');
          $('#bkServer').innerHTML = backups.map(b => `<li><span><b>${esc(b.name)}</b><small>${fmt(b.at)}</small></span><button type="button" class="btn sm solid" data-bk="srestore" data-id="${esc(b.id)}">되살리기</button></li>`).join('') || '<li class="muted">아직 없다</li>';
        } catch (err) { $('#bkServer').innerHTML = `<li class="muted">${esc(err.message)}</li>`; }
      }
    },
    use(site, label) {
      if (!site || !Array.isArray(site.members) || !Array.isArray(site.groups)) return toast('사이트 데이터가 아니다', true);
      if (!confirm(`'${label}' 상태로 되살릴까? 지금 상태는 먼저 백업해 둔다.`)) return;
      Backups.add('되살리기 전', Data.site);
      Data.set(JSON.parse(JSON.stringify(site)), Data.items);
      touch();
      refresh();
      this.el.hidden = true;
      toast('되살렸다. 마음에 들면 저장하자');
    },
    async click(e) {
      const b = e.target.closest('[data-bk]');
      if (e.target === this.el) this.el.hidden = true;
      if (!b) return;
      const a = b.dataset.bk, i = +b.dataset.i, list = Backups.list();
      if (a === 'close') this.el.hidden = true;
      if (a === 'now') { Backups.add('직접 백업', Data.site); this.paint(); toast('백업했다'); }
      if (a === 'dlnow') Backups.download(Data.site);
      if (a === 'dl') Backups.download(JSON.parse(list[i].json), `stellive-backup-${list[i].at.slice(0, 16).replace(/[:T]/g, '-')}.json`);
      if (a === 'restore') this.use(JSON.parse(list[i].json), list[i].label);
      if (a === 'del' && confirm('이 백업을 지울까?')) { Backups.remove(i); this.paint(); }
      if (a === 'srestore') {
        try { const { site } = await api('getBackup', { id: b.dataset.id }); this.use(site, '드라이브 백업'); }
        catch (err) { toast(err.message, true); }
      }
    },
    load(e) {
      const f = e.target.files?.[0];
      if (e.target.dataset.bk !== 'file' || !f) return;
      f.text().then(txt => { try { this.use(JSON.parse(txt), f.name); } catch { toast('읽을 수 없는 파일이다', true); } });
    },
  };

  /* ── 누르기: 고치기 모드에서는 글자·그림을 고친다 ── */
  document.addEventListener('click', e => {
    if (!document.body.classList.contains('editing')) return;
    if (e.target.closest('#editbar, #imgpop, #laypanel')) return;
    // 다른 걸 고치러 가면 그림 겹 판은 닫는다
    if (Lay.path && !Lay.downInside && !Lay.justDragged && e.target.isConnected && !e.target.closest('.lay-target')) Lay.close();
    if (Lay.path && e.target.closest('.lay-target')) { e.preventDefault(); e.stopPropagation(); return; }
    const lk = e.target.closest('[data-link]');
    if (lk) { e.preventDefault(); e.stopPropagation(); editLink(lk.dataset.link); return; }
    const sp = e.target.closest('.ed-t');
    if (sp) { e.preventDefault(); e.stopPropagation(); startEdit(sp); return; }
    const im = e.target.closest('[data-ei]');
    if (im) {
      const inner = e.target.closest('a, button, input, label, select, textarea, [data-play], [data-view-item]');
      if (!inner || inner === im || !im.contains(inner)) {
        e.preventDefault(); e.stopPropagation();
        if (Lay.path && im.dataset.ei === Lay.path) return; // 편집 중인 영역 안을 누른 건 끌기
        SINGLE.has(im.dataset.ei) ? openImg(im.dataset.ei, im) : Lay.open(im.dataset.ei);
        return;
      }
    }
    if (!e.target.closest('#imgpop')) pop.hidden = true;
  }, true);

  /* ── 아래 도구 막대 ── */
  const bar = document.createElement('div');
  bar.id = 'editbar';
  document.body.append(bar);
  document.body.classList.add('edit-on', 'editing');

  function pages() {
    const ms = Data.site?.members || [];
    return [['#/', '홈'], ['#/calendar', '캘린더'], ['#/schedule', '방송 일정'], ['#/listen', '노래 듣기'], ['#/group', '단체 · 합방'], ['#/stars', '별표'], ['#/shorts', '쇼츠 · 클립'], ['#/play', '노래 창'], ['#/about', 'About'],
      ...ms.map(m => [`#/m/${m.id}`, `멤버 · ${m.name}`])];
  }
  function paintBar() {
    const editing = document.body.classList.contains('editing');
    const cur = location.hash || '#/';
    bar.innerHTML = `
      <span class="eb-k">✎ 편집</span>
      <div class="seg" role="group" aria-label="모드">
        <button type="button" data-eb="edit" aria-pressed="${editing}">고치기</button>
        <button type="button" data-eb="browse" aria-pressed="${!editing}">둘러보기</button>
      </div>
      <select data-eb="page" aria-label="페이지">${pages().map(([h, n]) => `<option value="${esc(h)}" ${cur.startsWith(h) && (h !== '#/' || cur === '#/' || cur === '#') ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <button type="button" class="btn sm" data-eb="intro">첫 화면</button>
      <a class="btn sm" href="admin.html#site">자세한 설정</a>
      <span class="eb-st">${changes ? `저장 안 한 변경 ${changes}` : store.get('editDraft') ? '임시로 고친 내용이 있다' : ''}</span>
      <button type="button" class="btn sm" data-eb="backup">백업</button>
      <button type="button" class="btn sm" data-eb="reset">되돌리기</button>
      <button type="button" class="btn sm solid" data-eb="save">${LIVE ? '저장' : 'site.json 내려받기'}</button>
      <a class="btn sm" href="./" title="편집 끝내기">나가기</a>`;
  }
  bar.addEventListener('click', async e => {
    const b = e.target.closest('[data-eb]');
    if (!b) return;
    const a = b.dataset.eb;
    if (a === 'edit' || a === 'browse') { document.body.classList.toggle('editing', a === 'edit'); pop.hidden = true; Lay.close(); Pos.close(); paintBar(); }
    if (a === 'intro') Intro.show();
    if (a === 'backup') BackupWin.open();
    if (a === 'reset') {
      if (!confirm('고친 내용을 전부 버리고 저장된 상태로 되돌릴까?')) return;
      store.del('editDraft');
      location.reload();
    }
    if (a === 'save') {
      const site = JSON.parse(JSON.stringify(Data.site));
      Backups.add(LIVE ? '저장' : '내려받기', site);
      if (!LIVE) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([JSON.stringify(site, null, 2)], { type: 'application/json' }));
        link.download = 'site.json';
        link.click();
        changes = 0;
        toast('내려받았다. 리포지토리의 data/site.json 에 덮어쓰면 반영된다');
        return paintBar();
      }
      try {
        b.disabled = true;
        toast('저장하는 중…');
        await api('saveSite', { site });
        store.del('editDraft');
        changes = 0;
        toast('저장했다 ✦');
      } catch (err) { toast(err.message, true); } finally { b.disabled = false; paintBar(); }
    }
  });
  bar.addEventListener('change', e => { if (e.target.dataset.eb === 'page') location.hash = e.target.value; });
  addEventListener('hashchange', paintBar);
  addEventListener('beforeunload', e => { if (changes && !LIVE) e.preventDefault(); });

  // 임시로 고친 내용이 있으면 그걸로 보여 준다
  window.dataReady.then(() => {
    const draft = store.get('editDraft');
    if (draft) Data.set(draft, Data.items);
    beforeEdit = JSON.stringify(Data.site);
    convert(document.body);
    paintBar();
  });
  paintBar();
})();
