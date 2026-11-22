/* 소리(PCM)를 mp3 로 바꾸는 일꾼. 화면이 멈추지 않게 따로 돈다 */
importScripts('vendor/lame.min.js');

onmessage = e => {
  const { l, r, sr, kbps } = e.data;
  const ch = r ? 2 : 1;
  const enc = new lamejs.Mp3Encoder(ch, sr, kbps || 192);
  const n = l.length, block = 1152 * 32;
  const L = new Int16Array(block), R = new Int16Array(block);
  const parts = [];
  let size = 0, lastPct = -1;
  const to16 = (src, dst, from, len) => {
    for (let i = 0; i < len; i++) {
      const v = Math.max(-1, Math.min(1, src[from + i]));
      dst[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
  };
  for (let i = 0; i < n; i += block) {
    const len = Math.min(block, n - i);
    to16(l, L, i, len);
    if (r) to16(r, R, i, len);
    const buf = r ? enc.encodeBuffer(L.subarray(0, len), R.subarray(0, len)) : enc.encodeBuffer(L.subarray(0, len));
    if (buf.length) { parts.push(new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length))); size += buf.length; }
    const pct = Math.floor((i / n) * 100);
    if (pct !== lastPct) { lastPct = pct; postMessage({ p: pct / 100 }); }
  }
  const end = enc.flush();
  if (end.length) { parts.push(new Uint8Array(end.buffer.slice(end.byteOffset, end.byteOffset + end.length))); size += end.length; }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  postMessage({ mp3: out }, [out.buffer]);
};
