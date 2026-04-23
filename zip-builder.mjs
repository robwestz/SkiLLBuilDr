const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let crcTable;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") return textEncoder.encode(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return textEncoder.encode(String(value ?? ""));
}

function normalizeName(name) {
  return String(name || "file.txt")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.+/g, ".")
    || "file.txt";
}

function dosDateTime(inputDate = new Date()) {
  const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosDate, dosTime };
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

export function buildZip(files, { comment = "" } = {}) {
  const normalized = files.map((file) => {
    const name = normalizeName(file.name);
    const nameBytes = textEncoder.encode(name);
    const data = toUint8Array(file.content);
    const { dosDate, dosTime } = dosDateTime(file.mtime);
    return {
      name,
      nameBytes,
      data,
      crc: crc32(data),
      dosDate,
      dosTime,
    };
  });

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  normalized.forEach((file) => {
    const localHeader = new Uint8Array(30 + file.nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0x0800);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, file.dosTime);
    writeU16(localView, 12, file.dosDate);
    writeU32(localView, 14, file.crc);
    writeU32(localView, 18, file.data.length);
    writeU32(localView, 22, file.data.length);
    writeU16(localView, 26, file.nameBytes.length);
    writeU16(localView, 28, 0);
    localHeader.set(file.nameBytes, 30);
    localParts.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + file.nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 0x0314);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0x0800);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, file.dosTime);
    writeU16(centralView, 14, file.dosDate);
    writeU32(centralView, 16, file.crc);
    writeU32(centralView, 20, file.data.length);
    writeU32(centralView, 24, file.data.length);
    writeU16(centralView, 28, file.nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    centralHeader.set(file.nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const commentBytes = textEncoder.encode(comment);
  const endRecord = new Uint8Array(22 + commentBytes.length);
  const endView = new DataView(endRecord.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, normalized.length);
  writeU16(endView, 10, normalized.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, centralOffset);
  writeU16(endView, 20, commentBytes.length);
  endRecord.set(commentBytes, 22);

  const totalSize =
    localParts.reduce((sum, part) => sum + part.length, 0) +
    centralSize +
    endRecord.length;
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  [...localParts, ...centralParts, endRecord].forEach((part) => {
    output.set(part, cursor);
    cursor += part.length;
  });
  return output;
}

export function parseStoreZip(bytes) {
  const data = toUint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const files = [];
  let offset = 0;
  while (offset + 4 <= data.length && view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const fileBytes = data.slice(dataStart, dataStart + compressedSize);
    const name = textDecoder.decode(data.slice(nameStart, nameStart + nameLength));
    files.push({ name, data: fileBytes, flags, method });
    offset = dataStart + compressedSize;
  }
  return files;
}
