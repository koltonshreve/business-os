// ─── /api/icon ────────────────────────────────────────────────────────────────
// Returns a PWA-compatible PNG icon at the requested size.
// Usage: /api/icon?size=192  or  /api/icon?size=512
// Used in public/manifest.json for installable PWA icons.

import type { NextApiRequest, NextApiResponse } from 'next';

// Minimal PNG writer (no external deps)
// Builds a valid PNG with a single solid color + an SVG-style grid overlay.
function makePng(size: number): Buffer {
  const width  = size;
  const height = size;

  // RGBA pixel data — indigo (#4f46e5) background with a simple 2x2 grid of white squares
  const data = Buffer.alloc(width * height * 4);

  // Background color: indigo #4f46e5
  const bg = [0x4f, 0x46, 0xe5, 0xff];
  // Square color: white semi-transparent
  const sq = [0xff, 0xff, 0xff, 0xe0];

  const pad  = Math.round(size * 0.10);  // 10% padding
  const gap  = Math.round(size * 0.04);  // gap between squares
  const inner = size - pad * 2;
  const sqSize = Math.round((inner - gap) / 2);

  // Positions: top-left, top-right, bottom-left, bottom-right
  const positions = [
    { x: pad,           y: pad },
    { x: pad + sqSize + gap, y: pad },
    { x: pad,           y: pad + sqSize + gap },
    { x: pad + sqSize + gap, y: pad + sqSize + gap },
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      let color = bg;
      for (const pos of positions) {
        if (x >= pos.x && x < pos.x + sqSize && y >= pos.y && y < pos.y + sqSize) {
          color = sq;
          break;
        }
      }
      data[idx]     = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3];
    }
  }

  return encodePng(width, height, data);
}

// Pure-Node PNG encoder (RFC 2083 compliant minimal subset)
function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const { createDeflate } = require('zlib') as typeof import('zlib');
  const { deflateSync }   = require('zlib') as typeof import('zlib');

  // Build raw image data (filter byte 0 before each row)
  const rowSize = width * 4;
  const filtered = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (rowSize + 1)] = 0; // None filter
    rgba.copy(filtered, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }
  const compressed = deflateSync(filtered, { level: 6 });

  const chunks: Buffer[] = [];

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 6;  // RGBA color type
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT
  chunks.push(makeChunk('IDAT', compressed));

  // IEND
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type: string, data: Buffer): Buffer {
  const { createHash } = require('crypto') as typeof import('crypto');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

// CRC32 (used by PNG)
function crc32(buf: Buffer): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crcTable: Uint32Array | null = null;
function makeCrcTable(): Uint32Array {
  if (_crcTable) return _crcTable;
  _crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    _crcTable[i] = c >>> 0;
  }
  return _crcTable;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawSize = parseInt(String(req.query.size ?? '192'), 10);
  const size = [16, 32, 48, 64, 96, 128, 192, 256, 512].includes(rawSize) ? rawSize : 192;

  const png = makePng(size);

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Length', png.length);
  res.end(png);
}
