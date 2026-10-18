/**
 * Adds Excel list validations to a SheetJS-generated XLSX workbook.
 * SheetJS Community Edition writes workbook cells but does not currently expose
 * dependable worksheet data-validation writing, so we patch the OOXML sheet part.
 * Uses the browser's native Compression Streams API (supported by current Chromium).
 */
export interface XlsxListValidation {
  range: string;
  name: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function u16(view: DataView, offset: number): number { return view.getUint16(offset, true); }
function u32(view: DataView, offset: number): number { return view.getUint32(offset, true); }
function put16(view: DataView, offset: number, value: number): void { view.setUint16(offset, value, true); }
function put32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value >>> 0, true); }

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function transformRawDeflate(bytes: Uint8Array, mode: 'compress' | 'decompress'): Promise<Uint8Array> {
  const StreamCtor: any = mode === 'compress' ? (globalThis as any).CompressionStream : (globalThis as any).DecompressionStream;
  if (!StreamCtor) throw new Error('This browser does not support ZIP compression streams.');
  const stream = new StreamCtor('deflate-raw');
  const blob = new Blob([bytes as any]);
  const transformed = blob.stream().pipeThrough(stream);
  return new Uint8Array(await new Response(transformed).arrayBuffer());
}

function locateEocd(view: DataView): number {
  const lowerBound = Math.max(0, view.byteLength - 22 - 65535);
  for (let offset = view.byteLength - 22; offset >= lowerBound; offset--) {
    if (u32(view, offset) === 0x06054B50) return offset;
  }
  throw new Error('Could not read the XLSX ZIP directory.');
}

/** Add validations to the named worksheet in a standard, non-ZIP64 XLSX archive. */
export async function addXlsxListValidations(
  input: ArrayBuffer | Uint8Array,
  targetSheetPath: string,
  validations: XlsxListValidation[],
): Promise<Uint8Array> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = locateEocd(view);
  const entryCount = u16(view, eocdOffset + 10);
  const centralOffset = u32(view, eocdOffset + 16);
  const entries: Array<{ name: string; localBytes: Uint8Array; centralBytes: Uint8Array; replacement?: Uint8Array }> = [];
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index++) {
    if (u32(view, cursor) !== 0x02014B50) throw new Error('Invalid XLSX central-directory entry.');
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const centralLength = 46 + nameLength + extraLength + commentLength;
    const centralBytes = bytes.slice(cursor, cursor + centralLength);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localOffset = u32(view, cursor + 42);
    if (u32(view, localOffset) !== 0x04034B50) throw new Error('Invalid XLSX local file record.');
    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const compressedSize = u32(view, cursor + 20);
    const flags = u16(view, cursor + 8);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + compressedSize;
    let descriptorLength = 0;
    if ((flags & 0x0008) !== 0) {
      descriptorLength = u32(view, dataEnd) === 0x08074B50 ? 16 : 12;
    }
    const localBytes = bytes.slice(localOffset, dataEnd + descriptorLength);
    entries.push({ name, localBytes, centralBytes });
    cursor += centralLength;
  }

  const target = entries.find((entry) => entry.name === targetSheetPath);
  if (!target) throw new Error(`Could not find ${targetSheetPath} in the XLSX workbook.`);

  // Re-read the original target sheet's local header and compressed payload.
  const targetCentralView = new DataView(target.centralBytes.buffer, target.centralBytes.byteOffset, target.centralBytes.byteLength);
  const targetFlags = u16(targetCentralView, 8);
  const targetMethod = u16(targetCentralView, 10);
  const targetCompressedSize = u32(targetCentralView, 20);
  const targetUncompressedSize = u32(targetCentralView, 24);
  const targetLocalOffset = u32(targetCentralView, 42);
  const localNameLength = u16(view, targetLocalOffset + 26);
  const localExtraLength = u16(view, targetLocalOffset + 28);
  const payloadOffset = targetLocalOffset + 30 + localNameLength + localExtraLength;
  const payload = bytes.slice(payloadOffset, payloadOffset + targetCompressedSize);
  let xmlBytes: Uint8Array;
  if (targetMethod === 0) xmlBytes = payload;
  else if (targetMethod === 8) xmlBytes = await transformRawDeflate(payload, 'decompress');
  else throw new Error(`Unsupported XLSX compression method ${targetMethod}.`);
  if (xmlBytes.length !== targetUncompressedSize) throw new Error('XLSX worksheet decompression did not match its declared size.');

  let xml = decoder.decode(xmlBytes);
  const validationXml = `<dataValidations count="${validations.length}">${validations.map(({ range, name }) =>
    `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Choose an allowed value" error="Select a value from the LISTS sheet dropdown." sqref="${range}"><formula1>${name}</formula1></dataValidation>`
  ).join('')}</dataValidations>`;
  const existing = xml.indexOf('<dataValidations');
  if (existing >= 0) {
    const existingEnd = xml.indexOf('</dataValidations>', existing);
    if (existingEnd >= 0) xml = xml.slice(0, existing) + validationXml + xml.slice(existingEnd + '</dataValidations>'.length);
    else throw new Error('Malformed existing worksheet data validations.');
  } else {
    const anchors = ['<hyperlinks', '<pageMargins', '<pageSetup', '<headerFooter', '<rowBreaks', '<colBreaks', '<customProperties', '<cellWatches', '<ignoredErrors', '<drawing', '<legacyDrawing', '<tableParts', '<extLst', '</worksheet>'];
    const insertion = anchors.map((anchor) => xml.indexOf(anchor)).filter((position) => position >= 0).sort((a, b) => a - b)[0];
    if (insertion === undefined) throw new Error('Could not find a valid insertion point in the XLSX worksheet.');
    xml = xml.slice(0, insertion) + validationXml + xml.slice(insertion);
  }

  const newXmlBytes = encoder.encode(xml);
  const newCompressed = await transformRawDeflate(newXmlBytes, 'compress');
  const newCrc = crc32(newXmlBytes);
  const localName = target.localBytes.slice(30, 30 + localNameLength);
  const localExtra = target.localBytes.slice(30 + localNameLength, 30 + localNameLength + localExtraLength);
  const newLocalHeader = target.localBytes.slice(0, 30);
  const newLocalView = new DataView(newLocalHeader.buffer, newLocalHeader.byteOffset, newLocalHeader.byteLength);
  put16(newLocalView, 6, targetFlags & ~0x0008);
  put16(newLocalView, 8, 8);
  put32(newLocalView, 14, newCrc);
  put32(newLocalView, 18, newCompressed.length);
  put32(newLocalView, 22, newXmlBytes.length);
  target.replacement = concat([newLocalHeader, localName, localExtra, newCompressed]);

  // Rebuild local records and the central directory while preserving all other
  // compressed payloads verbatim; only the target worksheet is recompressed.
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localCursor = 0;
  for (const entry of entries) {
    const localPart = entry.replacement || entry.localBytes;
    localParts.push(localPart);
    const centralPart = entry.centralBytes.slice();
    const centralView = new DataView(centralPart.buffer, centralPart.byteOffset, centralPart.byteLength);
    put32(centralView, 42, localCursor);
    if (entry === target) {
      put16(centralView, 8, targetFlags & ~0x0008);
      put16(centralView, 10, 8);
      put32(centralView, 16, newCrc);
      put32(centralView, 20, newCompressed.length);
      put32(centralView, 24, newXmlBytes.length);
    }
    centralParts.push(centralPart);
    localCursor += localPart.length;
  }

  const centralBytesLength = centralParts.reduce((sum, part) => sum + part.length, 0);
  const originalEocd = bytes.slice(eocdOffset);
  const eocd = originalEocd.slice();
  const eocdView = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength);
  put32(eocdView, 12, centralBytesLength);
  put32(eocdView, 16, localCursor);
  return concat([...localParts, ...centralParts, eocd]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
