/**
 * Utilidad canónica para normalización y formateo de códigos de lote al estándar industrial C0_____
 * Ejemplo: 6986 -> C06986, 8432 -> C08432, CO8432 -> C08432, C8432 -> C08432, 8428 -> C08428
 */
export function formatLoteCode(input?: any): string {
  if (input === undefined || input === null) return "";
  let raw = String(input).trim().toUpperCase();
  if (!raw || raw === "0" || raw === "C00" || raw === "NULL" || raw === "UNDEFINED" || raw === "NAN") return "";

  // 1. Quitar caracteres invisibles y limpiar espacios
  raw = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

  // 2. Si empieza con prefijos de lote tipo LOT-, LT-, LOTE-, L-
  if (/^(LOT|LT|LOTE|L)[_\-\s]*(\d+.*)$/i.test(raw)) {
    const match = raw.match(/^(LOT|LT|LOTE|L)[_\-\s]*(\d+.*)$/i);
    if (match && match[2]) {
      const rest = match[2].trim();
      const numPart = rest.replace(/^0+/, "") || rest;
      return `C0${numPart}`;
    }
  }

  // 3. Si tiene C, CO o C0 seguido de separadores y dígitos: ej: C-8432, C0-8432, CO-8432, C 8432, C.8432
  if (/^C[0OÓ]?[_\-\s\.]+(\d+.*)$/i.test(raw)) {
    const match = raw.match(/^C[0OÓ]?[_\-\s\.]+(\d+.*)$/i);
    if (match && match[1]) {
      const num = match[1].replace(/^0+/, "") || match[1];
      return `C0${num}`;
    }
  }

  // 4. Si empieza con CO (letra O mayúscula o con tilde) seguido de dígitos: ej. CO8432 -> C08432, CO8428 -> C08428
  if (/^C[OÓ]+(\d+.*)$/i.test(raw)) {
    const match = raw.match(/^C[OÓ]+(\d+.*)$/i);
    if (match && match[1]) {
      const num = match[1].replace(/^0+/, "") || match[1];
      return `C0${num}`;
    }
  }

  // 5. Si empieza con C0 seguido de dígitos (incluyendo posibles ceros extra como C008432):
  if (/^C0+(\d+.*)$/i.test(raw)) {
    const match = raw.match(/^C0+(\d+.*)$/i);
    if (match && match[1]) {
      return `C0${match[1]}`;
    }
  }

  // 6. Si empieza con C seguido directamente de dígitos: C8432 -> C08432
  if (/^C(\d+.*)$/i.test(raw)) {
    const match = raw.match(/^C(\d+.*)$/i);
    if (match && match[1]) {
      const num = match[1].replace(/^0+/, "") || match[1];
      return `C0${num}`;
    }
  }

  // 7. Si es puramente numérico (ej. 6986, 8432, 8428, 08432, 2026):
  if (/^\d+$/.test(raw)) {
    const num = raw.replace(/^0+/, "") || raw;
    return `C0${num}`;
  }

  // 8. Limpiar caracteres de separación y re-evaluar
  const clean = raw.replace(/[\s\-_]+/g, "");
  if (/^C[OÓ]\d+/i.test(clean)) {
    const num = clean.slice(2).replace(/^0+/, "") || clean.slice(2);
    return `C0${num}`;
  }
  if (/^C0\d+/i.test(clean)) {
    return clean;
  }
  if (/^C\d+/i.test(clean)) {
    const num = clean.slice(1).replace(/^0+/, "") || clean.slice(1);
    return `C0${num}`;
  }

  // 9. Si contiene un número de 3 a 6 dígitos al final
  const matchTrailing = raw.match(/\d{3,6}$/);
  if (matchTrailing) {
    return `C0${matchTrailing[0]}`;
  }

  return raw;
}

export const sanitizeLoteCode = formatLoteCode;

export function compareLoteCodes(a?: any, b?: any): boolean {
  const normA = formatLoteCode(a);
  const normB = formatLoteCode(b);
  if (!normA || !normB) return false;
  return normA === normB;
}
