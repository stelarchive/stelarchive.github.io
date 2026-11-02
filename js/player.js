/* 아래에 붙어있는 노래 플레이어.
   유튜브는 IFrame API, 드라이브 mp4 는 <video> 로 틀어서 끝나면 다음 곡으로 넘어간다. */

/* ─── 받아 둔 노래 ───
   드라이브 곡은 조금씩 끊어 받으면 약한 와이파이에서 중간에 멈춘다.
   그래서 한 번에 끝까지 받아서 틀고, 받은 곡은 브라우저 저장소에 넣어 둔다(다음엔 바로 · 인터넷 없이도).
   오래 안 들은 곡부터 지워서 LIMIT 를 넘지 않게 한다 */
const SongStore = {
  name: 'stl-songs-v1',
  LIMIT: 1.5e9,
  index: store.get('songIdx', {}),
  ok: typeof caches !== 'undefined',
  has(id) { return !!this.index[id]; },
  count() { return Object.keys(this.index).length; },
  bytes() { return Object.values(this.index).reduce((a, x) => a + (x.size || 0), 0); },
  save() { store.set('songIdx', this.index); },
  async get(id) {
    if (!this.ok || !this.index[id]) return null;
    try {
      const r = await (await caches.open(this.name)).match('/song/' + id);
      if (!r) { delete this.index[id]; this.save(); return null; }
      this.index[id].at = Date.now();
      this.save();
      return URL.createObjectURL(await r.blob());
    } catch { return null; }
  },
  async put(id, blob) {
    if (!this.ok) return;
    try {
      const c = await caches.open(this.name);
      await c.put('/song/' + id, new Response(blob, { headers: { 'content-type': blob.type || 'video/mp4' } }));
      this.index[id] = { size: blob.size, at: Date.now() };
      const keep = new Set([Player.current()?.id, id]);
      const old = Object.entries(this.index).sort((a, b) => a[1].at - b[1].at);
      let total = this.bytes();
      for (const [k, v] of old) {
        if (total <= this.LIMIT) break;
        if (keep.has(k)) continue;
        await c.delete('/song/' + k);
        delete this.index[k];
        total -= v.size || 0;
      }
      this.save();
    } catch {}
  },
  async clear() {
    if (this.ok) await caches.delete(this.name).catch(() => {});
    this.index = {};
    this.save();
  },
};
// 파일 하나를 끝까지 받는다. onProgress(0~1). 너무 크면(max) 'big' 으로 멈춘다
async function downloadFile(url, onProgress, signal, max = 400e6) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const total = +r.headers.get('content-length') || 0;
  if (total > max) { r.body?.cancel(); throw new Error('big'); }
  if (!r.body || !total) return r.blob();
  const reader = r.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress?.(got / total);
  }
  return new Blob(parts, { type: r.headers.get('content-type') || 'video/mp4' });
}

/* ─── 음량 맞추기 ───
   유튜브는 곡마다 음량을 알아서 맞춰 준다(약 -14 LUFS). 드라이브 파일은 원본 그대로라 대개 더 크다.
   받아 둔 파일의 소리 크기를 한 번 재서(LUFS, 사람 귀 기준) 기억해 두고, 유튜브와 같은 크기가 되도록 줄여서 튼다.
   아직 안 잰 곡은 지금까지 잰 곡들의 보통 값으로 틀다가, 재고 나면 살짝 맞춘다 */
const Loud = {
  TARGET: -14,
  on: store.get('normVol', true),
  map: store.get('loud', {}), // 곡 id → LUFS
  jobs: [], busy: false,
  set(v) { this.on = v; store.set('normVol', v); Player.applyVol(true); },
  gainOf(L) { return Math.min(1, Math.pow(10, (this.TARGET - L) / 20)); },
  gain(id) {
    if (!this.on) return 1;
    if (this.map[id] != null) return this.gainOf(this.map[id]);
    const g = Object.values(this.map).map(L => this.gainOf(L)).sort((a, b) => a - b);
    return g.length ? g[g.length >> 1] : 0.6;
  },
  known(id) { return this.map[id] != null; },
  measure(id, blob) {
    if (!id || !blob || this.known(id) || this.jobs.some(j => j.id === id) || typeof OfflineAudioContext === 'undefined') return;
    if (blob.size > 300e6) return;
    this.jobs.push({ id, blob });
    this.run();
  },
  async run() {
    if (this.busy) return;
    this.busy = true;
    while (this.jobs.length) {
      const { id, blob } = this.jobs.shift();
      try {
        const L = await this.analyze(blob);
        if (isFinite(L)) {
          this.map[id] = Math.round(L * 10) / 10;
          store.set('loud', this.map);
          if (Player.current()?.id === id) Player.applyVol();
        }
      } catch {}
    }
    this.busy = false;
  },
  // ITU BS.1770 방식: K-가중 필터 → 400ms 구간 → -70 / -10 게이트
  async analyze(blob) {
    const SR = 22050;
    const audio = await new OfflineAudioContext(2, SR, SR).decodeAudioData(await blob.arrayBuffer());
    const ch = Math.min(2, audio.numberOfChannels);
    const off = new OfflineAudioContext(ch, audio.length, audio.sampleRate);
    const src = off.createBufferSource();
    src.buffer = audio;
    const shelf = off.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 1500; shelf.gain.value = 4;
    const hp = off.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
    src.connect(shelf).connect(hp).connect(off.destination);
    src.start();
    const out = await off.startRendering();
    const data = Array.from({ length: ch }, (_, i) => out.getChannelData(i));
    const step = Math.round(out.sampleRate * 0.1), n = out.length;
    // 100ms 조각마다 제곱합 → 4조각씩 묶어 400ms 구간
    const seg = [];
    for (let s = 0; s + step <= n; s += step) {
      let sum = 0;
      for (const d of data) for (let i = s; i < s + step; i++) sum += d[i] * d[i];
      seg.push(sum / step);
    }
    const blocks = [];
    for (let i = 0; i + 4 <= seg.length; i++) blocks.push((seg[i] + seg[i + 1] + seg[i + 2] + seg[i + 3]) / 4);
    const lk = z => -0.691 + 10 * Math.log10(z);
    const abs = blocks.filter(z => z > 0 && lk(z) > -70);
    if (!abs.length) return NaN;
    const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const g = abs.filter(z => lk(z) > rel);
    return lk(g.reduce((a, b) => a + b, 0) / g.length);
  },
};

const Player = {
  queue: [], idx: -1, label: '', shuffle: false, repeat: 'all',
  kind: '', // 'yt' | 'video' | 'frame'
  yt: null, ytReady: null, playing: false, view: 'mini', netTries: 0, lastPos: 0,

  init() {
    this.bar = $('#player');
    this.stage = $('#stage');
    this.video = $('#stage video');
    this.frame = $('#stage iframe');
    this.video.addEventListener('ended', () => this.ended());
    this.video.addEventListener('play', () => this.setPlaying(true));
    this.video.addEventListener('pause', () => this.setPlaying(false));
    this.video.addEventListener('error', () => {
      const it = this.current();
      if (!it || this.kind !== 'video' || !this.video.getAttribute('src')) return;
      // 와이파이가 잠깐 끊긴 거면 다른 곳으로 넘기지 말고 끊긴 자리부터 다시 받는다 (3번까지)
      if (this.video.error?.code === 2 && this.netTries < 3) {
        this.netTries++;
        const src = this.video.getAttribute('src'), at = this.lastPos || 0;
        setTimeout(() => {
          if (this.current() !== it) return;
          this.video.addEventListener('loadedmetadata', () => { this.video.currentTime = at; }, { once: true });
          this.video.src = src;
          this.video.play().catch(() => {});
        }, 1500 * this.netTries);
        return;
      }
      if (it.ytId && !this.tried.has('youtube')) return this.failover(tRaw('player.driveError'));
      if (it.driveId) { this.showFrame(it); toast(tRaw('player.frame')); }
    });

    this.bar.addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const a = b.dataset.p;
      if (a === 'toggle') this.toggle();
      if (a === 'next') this.next();
      if (a === 'prev') this.prev();
      if (a === 'shuffle') { this.shuffle = !this.shuffle; this.paintModes(); }
      if (a === 'repeat') { this.repeat = { all: 'one', one: 'off', off: 'all' }[this.repeat]; this.paintModes(); }
      if (a === 'fav') { const it = this.current(); if (it) Favs.toggle(it.id); }
      if (a === 'view') this.setView(this.view === 'big' ? 'mini' : 'big');
      if (a === 'hide') this.setView(this.view === 'hidden' ? 'mini' : 'hidden');
      if (a === 'queue') $('#queue').classList.toggle('open');
      if (a === 'prefer') this.setPrefer(this.prefer === 'drive' ? 'youtube' : 'drive');
      if (a === 'page') this.togglePage();
      if (a === 'close') this.close();
    });
    $('#stage').addEventListener('click', e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      if (b.dataset.s === 'page') this.togglePage();
      else this.setView(b.dataset.s);
    });
    // 노래 창에서는 영상 창을 페이지 안의 자리에 맞춰 놓는다
    this.slotWatch = new ResizeObserver(() => this.place());
    addEventListener('resize', () => this.place());
    $('#queue').addEventListener('click', e => {
      const r = e.target.closest('[data-qi]');
      if (r) this.go(+r.dataset.qi);
    });

    const seek = $('#pSeek');
    seek.addEventListener('input', () => {
      const d = this.duration();
      if (d) this.seekTo((seek.value / 1000) * d);
    });
    setInterval(() => this.tick(), 500);
    Favs.on(() => this.paintFav());

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('play', () => this.toggle(true));
      navigator.mediaSession.setActionHandler('pause', () => this.toggle(false));
    }
  },

  /* 목록 통째로 넘겨서 재생 시작 */
  play(items, startId, label) {
    const list = items.filter(i => i.playable);
    if (!list.length) { toast(tRaw('player.noSongs')); return; }
    this.queue = list;
    this.label = stripMarks(label || '');
    let i = startId ? list.findIndex(x => x.id === startId) : 0;
    if (i < 0) i = 0;
    if (this.shuffle && !startId) i = Math.floor(Math.random() * list.length);
    this.bar.hidden = false;
    document.body.classList.add('has-player');
    if (this.view === 'hidden') this.setView('mini');
    this.go(i);
    this.paintQueue();
  },

  current() { return this.queue[this.idx]; },

  // mp3 는 영상 대신 표지 그림
  paintCover(it, src) {
    const audio = src === 'drive' && it.media === 'audio';
    this.stage.dataset.audio = audio ? '1' : '';
    if (audio) {
      const bg = it.thumb ? `url(&quot;${esc(it.thumb)}&quot;)` : 'none';
      const col = esc(Data.member(it.members[0])?.color || '#2a2860');
      $('.stage-cover', this.stage).innerHTML = `<span class="sc-bg" style="background-color:${col};background-image:${bg}"></span>${it.thumb ? `<img class="sc-img" src="${esc(it.thumb)}" alt="">` : `<span class="sc-t">${esc(it.title || '')}</span>`}`;
    }
  },
  // 표지 설정을 바꾸면 지금 곡에도 바로
  refreshCover() {
    const it = this.current();
    if (!it) return;
    this.paintCover(it, this.source);
    this.paintNow(it);
  },

  /* 노래를 끄고 아래 바 · 영상 창을 내린다 */
  close() {
    this.loading?.ctl.abort();
    this.loading = null;
    if (location.hash.startsWith('#/play')) location.hash = '#/listen';
    this.leavePage();
    this.stopOthers('');
    this.setPlaying(false);
    this.queue = []; this.idx = -1;
    this.bar.classList.add('leaving');
    $('#queue').classList.remove('open');
    setTimeout(() => {
      this.bar.classList.remove('leaving');
      this.bar.hidden = true;
      document.body.classList.remove('has-player');
      $$('.song.now').forEach(el => el.classList.remove('now'));
    }, 250);
  },

  /* 어느 쪽으로 틀지: 'youtube' 먼저 / 'drive' 먼저 (학교처럼 유튜브가 막힌 곳이면 drive) */
  prefer: store.get('prefer', 'youtube'),
  setPrefer(p) {
    this.prefer = p;
    store.set('prefer', p);
    this.paintPrefer();
  },

  go(i) {
    if (!this.queue.length) return;
    this.idx = (i + this.queue.length) % this.queue.length;
    const it = this.current();
    this.tried = new Set();
    this.nextIdx = null;
    this.netTries = 0;
    this.lastPos = 0;
    this.paintNow(it);
    this.paintQueue();
    this.changes.forEach(fn => fn(it));
    // 이미 받아 둔 곡은 유튜브보다 먼저 (인터넷이 필요 없다)
    const local = it.hasDrive && (SongStore.has(it.id) || this.pre.has(it.id));
    this.playSource(it, (this.prefer === 'drive' || local) && it.hasDrive ? 'drive' : it.ytId ? 'youtube' : 'drive');
  },

  playSource(it, src) {
    this.loading?.ctl.abort();
    this.loading = null;
    this.tried.add(src);
    this.paintCover(it, src);
    this.source = src;
    this.paintSource();
    $$('[data-np-src]').forEach(el => (el.textContent = src === 'youtube' ? 'YouTube' : 'Drive'));
    if (src === 'youtube') return this.playYT(it);
    if (this.pre.has(it.id)) return this.playVideo(this.pre.get(it.id)); // 미리 받아 둔 곡
    const url = this.fileUrl(it);
    if (url) return this.playFull(it, url);
    if (it.driveId) return this.showFrame(it);
  },

  /* 끊김 없이: 저장소에 있으면 바로 튼다.
     없으면 바로 실시간으로 틀기 시작하고(기다리지 않게), 뒤에서 파일을 끝까지 받아서
     다 받아지면 같은 자리에서 받은 파일로 갈아탄다 → 그 뒤로는 와이파이가 끊겨도 안 멈춘다.
     받은 곡은 저장해 두니 다음부터는 처음부터 바로 */
  full: store.get('fullDl', true),
  setFull(v) { this.full = v; store.set('fullDl', v); },
  loading: null, // { it, p, ctl }
  async playFull(it, url) {
    this.loading?.ctl.abort();
    this.loading = null;
    const saved = await SongStore.get(it.id);
    if (this.current() !== it) return;
    if (saved) {
      this.keep(it.id, saved);
      this.paintSource();
      if (!Loud.known(it.id)) fetch(saved).then(r => r.blob()).then(b => Loud.measure(it.id, b)).catch(() => {});
      return this.playVideo(saved);
    }
    this.playVideo(url);
    if (!this.full) return;
    const ctl = new AbortController();
    const job = (this.loading = { it, p: 0, ctl });
    try {
      const blob = await downloadFile(url, p => { job.p = p; this.paintSource(); }, ctl.signal);
      SongStore.put(it.id, blob);
      Loud.measure(it.id, blob);
      if (this.current() !== it || this.kind !== 'video') return;
      this.loading = null;
      const u = URL.createObjectURL(blob);
      this.keep(it.id, u);
      this.swapTo(u);
      this.paintSource();
      this.paintQueue();
    } catch (e) {
      if (this.loading === job) this.loading = null;
      this.paintSource();
    }
  },
  // 듣던 자리 그대로 받은 파일로 갈아탄다
  swapTo(u) {
    const v = this.video, at = v.currentTime || this.lastPos || 0, wasPlaying = !v.paused || this.playing;
    v.addEventListener('loadedmetadata', () => { v.currentTime = at; if (wasPlaying) v.play().catch(() => {}); }, { once: true });
    v.src = u;
  },

  // 지금 소스가 안 되면 다른 소스로, 그것도 안 되면 다음 곡으로
  failover(why) {
    const it = this.current();
    if (!it) return;
    const other = this.source === 'youtube' ? 'drive' : 'youtube';
    const ok = other === 'youtube' ? !!it.ytId : it.hasDrive || !!it.directUrl;
    if (ok && !this.tried.has(other)) {
      toast(tRaw('player.switch', { why, to: other === 'drive' ? tRaw('player.toDrive') : tRaw('player.toYt') }));
      return this.playSource(it, other);
    }
    toast(tRaw('player.skip', { why }));
    setTimeout(() => { if (this.current() === it) this.next(true); }, 1200);
  },

  next(auto) {
    if (!this.queue.length) return;
    if (auto && this.repeat === 'one') return this.go(this.idx);
    if (this.shuffle && this.queue.length > 1) return this.go(this.shuffleNext());
    if (auto && this.repeat === 'off' && this.idx === this.queue.length - 1) return this.setPlaying(false);
    this.go(this.idx + 1);
  },
  // 랜덤이어도 다음 곡을 미리 정해 둔다 (그래야 미리 받을 수 있다)
  shuffleNext() {
    if (this.nextIdx == null || this.nextIdx === this.idx || this.nextIdx >= this.queue.length) {
      let n; do n = Math.floor(Math.random() * this.queue.length); while (n === this.idx);
      this.nextIdx = n;
    }
    return this.nextIdx;
  },
  peekNext() {
    if (!this.queue.length) return -1;
    if (this.repeat === 'one') return this.idx;
    if (this.shuffle && this.queue.length > 1) return this.shuffleNext();
    if (this.repeat === 'off' && this.idx === this.queue.length - 1) return -1;
    return (this.idx + 1) % this.queue.length;
  },

  /* ── 다음 곡 미리 받기 ──
     학교 와이파이처럼 약한 곳에서도 끊기지 않게, 지금 곡이 다 받아진 뒤 다음 곡 드라이브 파일을 통째로 받아 둔다.
     받아 둔 곡은 인터넷이 끊겨도 처음부터 끝까지 나온다. 유튜브로 트는 곡은 미리 받을 수 없다 */
  pre: new Map(), // 곡 id → 받아 둔 파일 주소(blob:)
  preJob: null,
  fileUrl(it) {
    if (it.directUrl) return it.directUrl;
    if (it.driveId && CFG.driveApiKey) return `https://www.googleapis.com/drive/v3/files/${it.driveId}?alt=media&key=${CFG.driveApiKey}`;
    return '';
  },
  prefetchNext() {
    const n = this.peekNext();
    const it = n >= 0 ? this.queue[n] : null;
    if (!it || it === this.current() || this.pre.has(it.id) || SongStore.has(it.id) || this.preJob?.id === it.id) return;
    if (!it.hasDrive && !it.directUrl) return;
    if (it.ytId && this.prefer !== 'drive') return;
    const url = this.fileUrl(it);
    if (!url) return;
    this.preJob?.ctl.abort();
    const ctl = new AbortController();
    const job = (this.preJob = { id: it.id, ctl });
    downloadFile(url, null, ctl.signal)
      .then(blob => { SongStore.put(it.id, blob); Loud.measure(it.id, blob); this.keep(it.id, URL.createObjectURL(blob)); job.done = true; this.paintQueue(); })
      .catch(() => { job.failed = true; });
  },
  // 지금 곡과 다음 곡 것만 남기고 나머지는 메모리에서 비운다
  keep(id, url) {
    this.pre.set(id, url);
    const keepIds = new Set([this.current()?.id, this.queue[this.peekNext()]?.id, id]);
    for (const [k, u] of this.pre) if (!keepIds.has(k)) { URL.revokeObjectURL(u); this.pre.delete(k); }
  },
  // 지금 곡이 다 받아졌으면(유튜브는 몇 초 지나면) 다음 곡을 받기 시작한다
  maybePrefetch() {
    if (!this.playing || this.loading || (this.preJob && !this.preJob.failed && !this.preJob.done)) return; // 지금 곡을 다 받은 뒤에 다음 곡
    if (this.kind === 'video') {
      const v = this.video, d = v.duration;
      const local = (v.getAttribute('src') || '').startsWith('blob:');
      const full = local || (d && v.buffered.length && v.buffered.end(v.buffered.length - 1) >= d - 1);
      if (!full) return;
    } else if (this.position() < 5) return;
    this.prefetchNext();
  },

  prev() {
    if (this.position() > 4) return this.seekTo(0);
    this.go(this.idx - 1);
  },
  ended() { this.next(true); },

  /* ── 유튜브 ── */
  // 유튜브가 막힌 네트워크에서는 스크립트가 안 오므로 8초 기다리고 포기한다
  loadYT() {
    if (this.ytReady) return this.ytReady;
    this.ytReady = new Promise((ok, bad) => {
      window.onYouTubeIframeAPIReady = ok;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => bad(new Error('blocked'));
      document.head.append(s);
      setTimeout(() => bad(new Error('timeout')), 8000);
    });
    this.ytReady.catch(() => { this.ytReady = null; });
    return this.ytReady;
  },
  async playYT(it) {
    this.stopOthers('yt');
    try { await this.loadYT(); }
    catch { if (this.current() === it) this.failover(tRaw('player.ytBlocked')); return; }
    if (this.current() !== it) return;
    if (!this.yt) {
      this.yt = await new Promise(ok => {
        const p = new YT.Player('ytHost', {
          videoId: it.ytId,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => { p.playVideo(); ok(p); },
            onStateChange: e => {
              if (e.data === YT.PlayerState.ENDED) this.ended();
              if (e.data === YT.PlayerState.PLAYING) this.setPlaying(true);
              if (e.data === YT.PlayerState.PAUSED) this.setPlaying(false);
            },
            onError: () => this.failover(tRaw('player.ytError')),
          },
        });
      });
    } else this.yt.loadVideoById(it.ytId);
  },

  /* ── 드라이브 / 직접 주소 ── */
  playVideo(src) {
    this.stopOthers('video');
    // 첫 장면이 나오기 전엔 썸네일을 보여 준다 (mp3 는 표지가 따로 덮는다)
    const it = this.current();
    if (it?.thumb && Tone.known(it) !== true) this.video.poster = it.thumb; else this.video.removeAttribute('poster');
    this.video.src = src;
    this.applyVol(true);
    this.video.play().catch(() => {});
  },
  // 드라이브 곡 음량을 유튜브에 맞춘다. now=false 면 1초 동안 천천히 바꾼다
  applyVol(now) {
    const v = this.video, it = this.current();
    const want = it ? Loud.gain(it.id) : 1;
    clearInterval(this._volT);
    if (now) { v.volume = want; return; }
    const from = v.volume, t0 = performance.now();
    this._volT = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 1000);
      v.volume = from + (want - from) * k;
      if (k >= 1) clearInterval(this._volT);
    }, 50);
  },
  showFrame(it) {
    this.stopOthers('frame');
    this.frame.src = `https://drive.google.com/file/d/${it.driveId}/preview`;
    this.setPlaying(true);
    if (!this._warned) { this._warned = true; toast(tRaw('player.frameNote')); }
  },

  stopOthers(keep) {
    this.kind = keep;
    this.stage.dataset.kind = keep;
    if (keep !== 'yt' && this.yt) this.yt.stopVideo();
    if (keep !== 'video') { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
    if (keep !== 'frame') this.frame.src = 'about:blank';
  },

  toggle(force) {
    const want = force ?? !this.playing;
    if (this.kind === 'yt' && this.yt) want ? this.yt.playVideo() : this.yt.pauseVideo();
    if (this.kind === 'video') want ? this.video.play() : this.video.pause();
  },
  position() {
    if (this.kind === 'yt' && this.yt?.getCurrentTime) return this.yt.getCurrentTime() || 0;
    if (this.kind === 'video') return this.video.currentTime || 0;
    return 0;
  },
  duration() {
    if (this.kind === 'yt' && this.yt?.getDuration) return this.yt.getDuration() || 0;
    if (this.kind === 'video') return isFinite(this.video.duration) ? this.video.duration : 0;
    return 0;
  },
  seekTo(t) {
    if (this.kind === 'yt' && this.yt) this.yt.seekTo(t, true);
    if (this.kind === 'video') this.video.currentTime = t;
  },

  /* ── 노래 창 (#/play) ── */
  changes: [],
  onChange(fn) { this.changes.push(fn); },
  togglePage() {
    if (location.hash.startsWith('#/play')) history.length > 1 ? history.back() : (location.hash = '#/listen');
    else location.hash = '#/play';
  },
  enterPage(slot) {
    if (this.view !== 'page') this.pageFrom = this.view;
    this.slot = slot;
    this.slotWatch.disconnect();
    this.slotWatch.observe(slot);
    this.setView('page');
    this.place();
  },
  leavePage() {
    if (this.view !== 'page') return;
    this.slotWatch.disconnect();
    this.slot = null;
    ['left', 'top', 'width'].forEach(k => (this.stage.style[k] = ''));
    this.setView(this.pageFrom && this.pageFrom !== 'page' ? this.pageFrom : 'mini');
  },
  place() {
    if (this.view !== 'page' || !this.slot?.isConnected) return;
    const r = this.slot.getBoundingClientRect();
    Object.assign(this.stage.style, { left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', width: r.width + 'px' });
  },

  setView(v) {
    this.view = v;
    this.stage.dataset.view = v;
    $('[data-p="hide"]', this.bar).classList.toggle('on', v !== 'hidden');
    $('[data-p="page"].icon-btn', this.bar).classList.toggle('on', v === 'page');
  },
  setPlaying(p) {
    this.playing = p;
    $('[data-p="toggle"]', this.bar).innerHTML = p ? ICON.pause : ICON.play;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused';
  },

  tick() {
    if (this.bar.hidden) return;
    const d = this.duration(), p = this.position();
    const f = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    $('#pTime').textContent = d ? `${f(p)} / ${f(d)}` : '';
    if (document.activeElement !== $('#pSeek')) $('#pSeek').value = d ? Math.round((p / d) * 1000) : 0;
    if (p > 0) this.lastPos = p;
    this.maybePrefetch();
  },

  /* ── 그리기 ── */
  paintNow(it) {
    const names = it.members.map(id => Data.member(id)?.name).filter(Boolean).join(' · ');
    $('#pThumb').style.backgroundImage = it.thumb ? `url("${it.thumb}")` : '';
    $('#pTitle').textContent = it.title || '(제목 없음)';
    $('#pSub').textContent = [names, this.label].filter(Boolean).join('  ·  ');
    this.paintFav();
    if ('mediaSession' in navigator)
      navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: names, album: 'STELLIVE', artwork: it.thumb ? [{ src: it.thumb, sizes: '480x360' }] : [] });
  },
  paintPrefer() {
    const b = $('[data-p="prefer"]', this.bar);
    if (!b) return;
    b.textContent = this.prefer === 'drive' ? tRaw('player.preferDrive') : tRaw('player.preferYt');
    b.title = tRaw('player.preferTitle');
  },
  paintSource() {
    const el = $('#pSrc');
    const local = this.current() && (this.pre.has(this.current().id) || SongStore.has(this.current().id)) && this.source !== 'youtube';
    const pct = this.loading && this.loading.it === this.current() ? ` · ${tRaw('player.loading', { p: Math.round(this.loading.p * 100) })}` : '';
    if (el) el.textContent = this.source === 'youtube' ? 'YouTube' : local ? 'Drive ✓' : 'Drive' + pct;
    if (el) el.title = local ? tRaw('player.local') : '';
  },
  paintFav() {
    const it = this.current();
    const b = $('[data-p="fav"]', this.bar);
    const on = it && Favs.has(it.id);
    b.innerHTML = on ? ICON.star : ICON.starO;
    b.classList.toggle('on', !!on);
  },
  paintModes() {
    $('[data-p="shuffle"]', this.bar).classList.toggle('on', this.shuffle);
    const r = $('[data-p="repeat"]', this.bar);
    r.classList.toggle('on', this.repeat !== 'off');
    r.dataset.one = this.repeat === 'one' ? '1' : '';
    r.title = { all: '전체 반복', one: '한 곡 반복', off: '반복 안 함' }[this.repeat];
  },
  paintQueue() {
    $('#queue .q-head span').textContent = this.label ? `${this.label} · ${this.queue.length}곡` : `${this.queue.length}곡`;
    $('#queue ol').innerHTML = this.queue.map((it, i) => `
      <li data-qi="${i}" class="${i === this.idx ? 'now' : ''}">
        <span class="q-n">${i === this.idx ? ICON.play : i + 1}</span>
        <span class="q-t">${esc(it.title)}</span>
        <span class="q-m">${esc(it.members.map(id => Data.member(id)?.name).filter(Boolean).join(' · '))}${this.pre.has(it.id) || SongStore.has(it.id) ? ` · ✓ ${esc(tRaw('player.ready'))}` : ''}</span>
      </li>`).join('');
  },
};
