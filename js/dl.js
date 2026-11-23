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

  async fileOf(it, signal, max = this.MAX) {
    const saved = await SongStore.get(it.id);
    if (saved) { const b = await fetch(saved).then(r => r.blob()); URL.revokeObjectURL(saved); return b; }
    const url = Player.fileUrl(it);
    if (!url) throw new Error('no file');
    return downloadFile(url, p => this.paint({ step: 'get', p }), signal, max); // 한꺼번에 받을 땐 노래 저장소에 안 넣는다 (디스크 · 메모리 아끼기)
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

  // 원본 파일 확장자
  extOf(blob, it) {
    const t = blob.type || '';
    if (/mpeg/.test(t)) return 'mp3';
    if (/audio\/mp4|m4a/.test(t)) return 'm4a';
    if (/webm/.test(t)) return 'webm';
    if (/quicktime/.test(t)) return 'mov';
    if (/ogg/.test(t)) return 'ogg';
    if (/wav/.test(t)) return 'wav';
    return it.media === 'audio' ? 'mp3' : 'mp4';
  },
  // 곡마다 부른 멤버 이름 · 고유 색 (오프라인 플레이어가 배경 색을 칠할 때 쓴다)
  people(it) {
    const ms = it.members.map(id => Data.member(id)).filter(Boolean);
    let colors = [...new Set(ms.map(m => m.color).filter(Boolean))];
    if (!colors.length && it.group && it.group !== 'all') colors = [Data.group(it.group)?.color].filter(Boolean);
    return { artists: ms.map(m => m.name), colors };
  },

  /* 저장할 곳
     크롬 · 크롬북: 고른 폴더에 한 곡씩 바로 쓴다 → 메모리를 한 곡만큼만 쓴다 (26곡 · 몇 GB 여도 안 멈춘다)
     폴더 저장이 안 되는 브라우저: 400MB 씩 나눠 zip 여러 개로 받는다 */
  PART: 400e6,
  async sink(fmt) {
    const d = new Date(), stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    const base = `stellive-stars-${fmt === 'mp4' ? 'mp4-' : ''}${stamp}`;
    if (window.showDirectoryPicker) {
      const root = await showDirectoryPicker({ id: 'stl-stars', mode: 'readwrite', startIn: 'music' });
      let dir, name = base, n = 1;
      for (;;) { // 같은 이름 폴더가 있으면 -2, -3 …
        try { await root.getDirectoryHandle(name); name = `${base}-${++n}`; }
        catch { dir = await root.getDirectoryHandle(name, { create: true }); break; }
      }
      return {
        folder: name,
        async put(file, blob) {
          const h = await dir.getFileHandle(file, { create: true });
          const w = await h.createWritable();
          try { await w.write(blob); await w.close(); } catch (e) { await w.abort?.().catch(() => {}); throw e; }
        },
        async finish(m3u, meta) { await this.put('playlist.m3u8', new Blob([m3u])); await this.put('stellive.json', new Blob([meta])); return 1; },
      };
    }
    await this.loadLibs();
    const self = this;
    let zip = new JSZip(), size = 0, part = 0, files = [];
    const save = async (m3uOf, metaOf) => {
      part++;
      zip.file('playlist.m3u8', m3uOf(files));
      zip.file('stellive.json', metaOf(files));
      self.paint({ step: 'zip' });
      const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = `${base}-${part}.zip`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
      zip = new JSZip(); size = 0; files = [];
    };
    return {
      async put(file, blob, m3uOf, metaOf) {
        if (files.length && size + blob.size > self.PART) await save(m3uOf, metaOf);
        zip.file(file, blob, { binary: true, compression: 'STORE' });
        size += blob.size; files.push(file);
      },
      async finish(m3uAll, metaAll, m3uOf, metaOf) { if (files.length) await save(m3uOf, metaOf); return part; },
    };
  },

  // fmt: 'mp3' (소리만 mp3 로 바꿈) | 'mp4' (원본 파일 그대로 · 영상 포함)
  async run(items, fmt = 'mp3') {
    if (this.busy) return;
    this.fmt = fmt;
    const { ok } = this.split(items);
    if (!ok.length) return toast(tRaw('dl.none'), true);
    let out;
    // 폴더 고르기 창은 버튼을 누른 바로 그때 열어야 한다 (다른 걸 기다리면 브라우저가 막는다)
    try { out = await this.sink(fmt); }
    catch (e) { if (e.name !== 'AbortError') toast(tRaw('dl.fail'), true); return; }
    this.busy = true;
    this.ctl = new AbortController();
    this.list = ok; this.i = 0; this.skipped = [];
    this.paint({ step: 'start' });
    try {
      const used = new Set(), tracks = [];
      const album = tRaw('dl.album');
      const line = t => `#EXTINF:-1,${t.artists.length ? t.artists.join(', ') + ' - ' : ''}${t.title}\r\n${t.file}`;
      const m3uOf = files => '#EXTM3U\r\n' + tracks.filter(t => !files || files.includes(t.file)).map(line).join('\r\n') + '\r\n';
      const metaOf = files => JSON.stringify({ v: 1, made: new Date().toISOString(), tracks: tracks.filter(t => !files || files.includes(t.file)) }, null, 1);
      for (this.i = 0; this.i < ok.length; this.i++) {
        const it = ok[this.i];
        if (this.ctl.signal.aborted) throw new DOMException('stop', 'AbortError');
        this.paint({ step: 'get', p: 0 });
        let pushed = false;
        try {
          const max = fmt === 'mp4' ? 400e6 : this.MAX;
          let blob = await this.fileOf(it, this.ctl.signal, max);
          if (blob.size > max) throw new Error('big');
          const who = this.people(it);
          let name = this.safe(`${String(this.i + 1).padStart(2, '0')} ${it.title}`);
          while (used.has(name)) name += '_';
          used.add(name);
          let file;
          if (fmt === 'mp4') file = name + '.' + this.extOf(blob, it);
          else {
            const mp3 = await this.toMp3(blob);
            file = name + '.mp3';
            blob = new Blob([this.id3(it.title || name, who.artists.join(', '), album), mp3], { type: 'audio/mpeg' });
          }
          this.paint({ step: 'save' });
          tracks.push({ file, title: it.title, artists: who.artists, colors: who.colors });
          pushed = true;
          await out.put(file, blob, m3uOf, metaOf);
          blob = null;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          if (pushed) tracks.pop();
          console.warn('[받기] 건너뜀:', it.title, e);
          this.skipped.push(it.title);
        }
      }
      if (!tracks.length) throw new Error('empty');
      const parts = await out.finish(m3uOf(), metaOf(), m3uOf, metaOf);
      const n = tracks.length;
      const msg = out.folder ? tRaw('dl.doneFolder', { n, folder: out.folder }) : parts > 1 ? tRaw('dl.doneParts', { n, parts }) : tRaw('dl.done', { n });
      this.done(msg + (this.skipped.length ? ' ' + tRaw('dl.skipped', { n: this.skipped.length }) : ''));
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
    const step = s.step === 'get' ? tRaw('dl.get') : s.step === 'enc' ? tRaw('dl.enc') : s.step === 'zip' ? tRaw('dl.zip') : s.step === 'save' ? tRaw('dl.save') : tRaw('dl.prep');
    const frac = s.step === 'zip' ? 1 : s.step === 'save' ? (this.i + 1) / n : n ? (this.i + (s.step === 'enc' ? 0.3 + 0.7 * (s.p || 0) : 0.3 * (s.p || 0))) / n : 0;
    $('.dl-t', box).textContent = s.step === 'zip' ? step : `${Math.min(this.i + 1, n)} / ${n} · ${step}`;
    $('.dl-s', box).textContent = s.step === 'zip' ? '' : it?.title || '';
    $('.dl-bar i', box).style.width = Math.round(frac * 100) + '%';
  },
};
document.addEventListener('click', e => { if (e.target.closest('[data-dlstop]')) StarDL.stop(); });
