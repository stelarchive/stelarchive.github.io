/* ─── 별표한 노래를 mp3 로 한 번에 받기 ───
   드라이브에 파일이 있는 곡만 된다 (유튜브만 있는 곡은 받을 수 없다).
   파일을 받아서(이미 받아 둔 곡은 저장소에서) 소리만 꺼내 mp3 로 바꾸고, 제목 · 멤버 이름을 넣어
   플레이리스트(m3u)와 함께 zip 하나로 묶어 준다. 전부 이 브라우저 안에서만 한다 */
const StarDL = {
  MAX: 150e6, // 이보다 큰 파일(1시간짜리 같은 것)은 풀면 메모리가 모자라서 건너뛴다
  busy: false, ctl: null,

  split(items) {
    const ok = [], no = [];
    items.forEach(it => ((it.hasDrive || it.directUrl) && it.media ? ok : no).push(it));
    return { ok, no };
  },

  loadLibs() {
    const one = (src, test) => test() ? Promise.resolve() : new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('lib'));
      document.head.append(s);
    });
    return one('js/vendor/jszip.min.js', () => typeof JSZip !== 'undefined');
  },

  async fileOf(it, signal) {
    const saved = await SongStore.get(it.id);
    if (saved) { const b = await fetch(saved).then(r => r.blob()); URL.revokeObjectURL(saved); return b; }
    const url = Player.fileUrl(it);
    if (!url) throw new Error('no file');
    const b = await downloadFile(url, p => this.paint({ step: 'get', p }), signal, this.MAX);
    SongStore.put(it.id, b);
    return b;
  },

  // 파일 → 소리 → mp3
  async toMp3(blob) {
    if (/audio\/mpeg/.test(blob.type)) return new Uint8Array(await blob.arrayBuffer()); // 원래 mp3 면 그대로
    const audio = await new OfflineAudioContext(2, 44100, 44100).decodeAudioData(await blob.arrayBuffer());
    const l = audio.getChannelData(0).slice();
    const r = audio.numberOfChannels > 1 ? audio.getChannelData(1).slice() : null;
    return new Promise((res, rej) => {
      const w = new Worker('js/mp3worker.js');
      const stop = () => { w.terminate(); rej(new DOMException('stop', 'AbortError')); };
      this.ctl.signal.addEventListener('abort', stop, { once: true });
      w.onmessage = e => {
        if (e.data.mp3) { w.terminate(); this.ctl.signal.removeEventListener('abort', stop); res(e.data.mp3); }
        else this.paint({ step: 'enc', p: e.data.p });
      };
      w.onerror = e => { w.terminate(); rej(new Error(e.message || 'encode')); };
      w.postMessage({ l, r, sr: audio.sampleRate, kbps: 192 }, r ? [l.buffer, r.buffer] : [l.buffer]);
    });
  },

  // ID3v2.3 태그: 제목 · 가수 · 앨범
  id3(title, artist, album) {
    const frame = (id, text) => {
      const body = [1, 0xff, 0xfe]; // UTF-16 + BOM
      for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); body.push(c & 0xff, c >> 8); }
      const n = body.length;
      return [...id].map(c => c.charCodeAt(0)).concat([n >>> 24 & 0xff, n >>> 16 & 0xff, n >>> 8 & 0xff, n & 0xff, 0, 0], body);
    };
    const frames = [].concat(frame('TIT2', title), artist ? frame('TPE1', artist) : [], frame('TALB', album));
    const n = frames.length;
    return new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, n >> 21 & 0x7f, n >> 14 & 0x7f, n >> 7 & 0x7f, n & 0x7f].concat(frames));
  },

  safe(s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'song'; },

  async run(items) {
    if (this.busy) return;
    const { ok, no } = this.split(items);
    if (!ok.length) return toast(tRaw('dl.none'), true);
    this.busy = true;
    this.ctl = new AbortController();
    this.list = ok; this.i = 0; this.skipped = [];
    this.paint({ step: 'start' });
    try {
      await this.loadLibs();
      const zip = new JSZip(), m3u = ['#EXTM3U'], used = new Set();
      const album = tRaw('dl.album');
      for (this.i = 0; this.i < ok.length; this.i++) {
        const it = ok[this.i];
        if (this.ctl.signal.aborted) throw new DOMException('stop', 'AbortError');
        this.paint({ step: 'get', p: 0 });
        try {
          const blob = await this.fileOf(it, this.ctl.signal);
          if (blob.size > this.MAX) throw new Error('big');
          const mp3 = await this.toMp3(blob);
          const artist = it.members.map(id => Data.member(id)?.name).filter(Boolean).join(', ');
          let name = this.safe(`${String(this.i + 1).padStart(2, '0')} ${it.title}`);
          while (used.has(name)) name += '_';
          used.add(name);
          zip.file(name + '.mp3', new Blob([this.id3(it.title || name, artist, album), mp3]), { binary: true, compression: 'STORE' });
          m3u.push(`#EXTINF:-1,${artist ? artist + ' - ' : ''}${it.title}`, name + '.mp3');
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          this.skipped.push(it.title);
        }
      }
      if (m3u.length === 1) throw new Error('empty');
      zip.file('playlist.m3u8', m3u.join('\r\n') + '\r\n');
      this.paint({ step: 'zip' });
      const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const d = new Date();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = `stellive-stars-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.zip`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
      this.done(tRaw('dl.done', { n: m3u.length / 2 | 0 }) + (this.skipped.length ? ' ' + tRaw('dl.skipped', { n: this.skipped.length }) : ''));
    } catch (e) {
      this.done(e.name === 'AbortError' ? tRaw('dl.stopped') : tRaw('dl.fail'), e.name !== 'AbortError');
    }
  },
  stop() { this.ctl?.abort(); },
  done(msg, bad) {
    this.busy = false;
    $('#dlBox')?.remove();
    toast(msg, bad);
    if (this.skipped?.length) console.info('[mp3 받기] 건너뛴 곡:', this.skipped);
  },

  paint(s) {
    let box = $('#dlBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dlBox';
      box.innerHTML = `<div class="dl-t"></div><div class="dl-s"></div><div class="dl-bar"><i></i></div><button type="button" class="btn sm" data-dlstop>${esc(tRaw('dl.stop'))}</button>`;
      document.body.append(box);
    }
    const it = this.list?.[this.i];
    const n = this.list?.length || 0;
    const step = s.step === 'get' ? tRaw('dl.get') : s.step === 'enc' ? tRaw('dl.enc') : s.step === 'zip' ? tRaw('dl.zip') : tRaw('dl.prep');
    const frac = s.step === 'zip' ? 1 : n ? (this.i + (s.step === 'enc' ? 0.3 + 0.7 * (s.p || 0) : 0.3 * (s.p || 0))) / n : 0;
    $('.dl-t', box).textContent = s.step === 'zip' ? step : `${Math.min(this.i + 1, n)} / ${n} · ${step}`;
    $('.dl-s', box).textContent = s.step === 'zip' ? '' : it?.title || '';
    $('.dl-bar i', box).style.width = Math.round(frac * 100) + '%';
  },
};
document.addEventListener('click', e => { if (e.target.closest('[data-dlstop]')) StarDL.stop(); });
