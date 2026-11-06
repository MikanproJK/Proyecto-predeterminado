/* Genera el icono de la aplicación (PNG + ICO) sin dependencias externas. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');

const GRADIENT = [
  { at: 0, color: [0x6d, 0x8b, 0xff] },
  { at: 0.55, color: [0x5b, 0x6c, 0xf9] },
  { at: 1, color: [0x9a, 0x5c, 0xf5] },
];

const BARS = [
  { x: 14, y1: 20.5, y2: 32.5, width: 4.2, alpha: 0.72 },
  { x: 24, y1: 15.5, y2: 32.5, width: 4.2, alpha: 1 },
  { x: 34, y1: 24.5, y2: 32.5, width: 4.2, alpha: 0.86 },
];

const DIAGONAL = { x1: 13, y1: 14.2, x2: 34, y2: 9.6, width: 2.4, alpha: 0.55 };

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function gradientAt(t) {
  const value = clamp(t);
  for (let i = 1; i < GRADIENT.length; i += 1) {
    const prev = GRADIENT[i - 1];
    const next = GRADIENT[i];
    if (value <= next.at) {
      const local = (value - prev.at) / (next.at - prev.at || 1);
      return [
        mix(prev.color[0], next.color[0], local),
        mix(prev.color[1], next.color[1], local),
        mix(prev.color[2], next.color[2], local),
      ];
    }
  }
  return GRADIENT[GRADIENT.length - 1].color;
}

function capsuleCoverage(px, py, x1, y1, x2, y2, width) {
  const radius = width / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq);
  const nearestX = x1 + dx * t;
  const nearestY = y1 + dy * t;
  const distance = Math.hypot(px - nearestX, py - nearestY);
  return clamp(radius + 0.5 - distance);
}

function roundedRectCoverage(px, py, size, radius) {
  const half = size / 2;
  const qx = Math.abs(px - half) - (half - radius);
  const qy = Math.abs(py - half) - (half - radius);
  const distance =
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  return clamp(0.5 - distance);
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 48;
  const radius = 14 * scale;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const mask = roundedRectCoverage(x + 0.5, y + 0.5, size, radius);
      if (mask <= 0) continue;

      const t = ((x + y) / size - 0.1667) / 1.6667;
      const [r, g, b] = gradientAt(t);

      let red = r;
      let green = g;
      let blue = b;

      for (const bar of BARS) {
        const coverage =
          capsuleCoverage(
            x + 0.5,
            y + 0.5,
            bar.x * scale,
            bar.y1 * scale,
            bar.x * scale,
            bar.y2 * scale,
            bar.width * scale,
          ) * bar.alpha;
        if (coverage > 0) {
          red = mix(red, 255, coverage);
          green = mix(green, 255, coverage);
          blue = mix(blue, 255, coverage);
        }
      }

      const diagonal =
        capsuleCoverage(
          x + 0.5,
          y + 0.5,
          DIAGONAL.x1 * scale,
          DIAGONAL.y1 * scale,
          DIAGONAL.x2 * scale,
          DIAGONAL.y2 * scale,
          DIAGONAL.width * scale,
        ) * DIAGONAL.alpha;
      if (diagonal > 0) {
        red = mix(red, 255, diagonal);
        green = mix(green, 255, diagonal);
        blue = mix(blue, 255, diagonal);
      }

      pixels[offset] = Math.round(red);
      pixels[offset + 1] = Math.round(green);
      pixels[offset + 2] = Math.round(blue);
      pixels[offset + 3] = Math.round(mask * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(png, size) {
  const directory = Buffer.alloc(6 + 16);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(1, 4);
  directory[6] = size >= 256 ? 0 : size;
  directory[7] = size >= 256 ? 0 : size;
  directory[8] = 0;
  directory[9] = 0;
  directory.writeUInt16LE(1, 10);
  directory.writeUInt16LE(32, 12);
  directory.writeUInt32LE(png.length, 14);
  directory.writeUInt32LE(22, 18);
  return Buffer.concat([directory, png]);
}

mkdirSync(buildDir, { recursive: true });

const png512 = encodePng(512, renderIcon(512));
const png256 = encodePng(256, renderIcon(256));
writeFileSync(path.join(buildDir, 'icon.png'), png512);
writeFileSync(path.join(buildDir, 'icon.ico'), encodeIco(png256, 256));
console.log('Iconos generados en build/icon.png y build/icon.ico');
