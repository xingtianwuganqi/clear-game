/**
 * 生成极小的本地 WAV 音效，避免依赖外部音频资源。
 * 用法：node tools/gen-audio.js
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.resolve(__dirname, '..', 'miniprogram', 'audio');
const SAMPLE_RATE = 22050;

function writeWav(name, duration, frequencyAt, waveform) {
  const samples = Math.floor(SAMPLE_RATE * duration);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    const t = i / SAMPLE_RATE;
    const progress = i / samples;
    const freq = frequencyAt(progress);
    const phase = 2 * Math.PI * freq * t;
    let value = waveform === 'triangle'
      ? (2 / Math.PI) * Math.asin(Math.sin(phase))
      : Math.sin(phase);
    const attack = Math.min(1, progress / 0.05);
    const release = Math.pow(1 - progress, 2.2);
    const envelope = attack * release;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * envelope * 9000))), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.concat([header, data]));
}

fs.mkdirSync(OUT, { recursive: true });
writeWav('good', 0.16, (p) => 620 + 280 * p, 'sine');
writeWav('bad', 0.2, (p) => 230 - 130 * p, 'triangle');
writeWav('clear', 0.42, (p) => 660 + 520 * p, 'sine');
writeWav('hint', 0.16, (p) => 520 + 260 * p, 'sine');
writeWav('stage', 0.22, (p) => 390 + 250 * p, 'sine');
console.log('audio written to ' + OUT);
