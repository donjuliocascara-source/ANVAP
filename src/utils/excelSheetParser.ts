import * as XLSX from "xlsx";
import { normalizeKey, getFieldVal, parseNumericVal } from "./localDB";
import { validateDateValue } from "./excelValidation";
import { formatLoteCode } from "./formatLoteCode";

/**
 * Esquema exacto de las 44 columnas del archivo Excel del usuario:
 * Columna 1: Fecha de recepcion
 * Columna 2: Ubicacion
 * Columna 3: Codigo
 * Columna 4: Cliente
 * Columna 5: Sacos
 * Columna 6: Peso (kg)
 * Columna 7 a 25: Muestras de humedades (19 caladas: M1 a M19)
 * Columna 26: Humedad promedio
 * Columna 27: Desviacion
 * Columna 28: Humedad maxima
 * Columna 29: Humedad minima
 * Columna 30: Variedad de arroz
 * Columna 31: Rendimiento integral
 * Columna 32: Rendimiento blanco
 * Columna 33: Quebrado integral
 * Columna 34: Quebrado en blanco
 * Columna 35: Tiza total
 * Columna 36: Tiza parcial
 * Columna 37: Mancha
 * Columna 38: Trizado
 * Columna 39: Grano rojo
 * Columna 40: Grano inmaduro
 * Columna 41: Grano verde
 * Columna 42: Blancura integral
 * Columna 43: Blancura pulido
 * Columna 44: Observaciones
 */
export const EXCEL_44_COLUMNS_SPEC = [
  { col: 1, key: "FECHA", label: "Fecha de recepcion", synonyms: ["FECHA DE RECEPCION", "FECHA DE RECEPCIÓN", "FECHA RECEPCION", "FECHA RECEPCIÓN", "FECHA DE INGRESO", "FECHA_INGRESO", "FECHA", "FECHA INGRESO", "FECHA RECEP", "DATE"] },
  { col: 2, key: "UBICACION", label: "Ubicacion", synonyms: ["UBICACION", "UBICACIÓN", "SILO", "TOLVA", "ALMACEN", "ALMACÉN", "ZONA ACOPIO", "DESTINO"] },
  { col: 3, key: "CODIGO", label: "Codigo", synonyms: ["CODIGO", "CÓDIGO", "LOTE", "LOTE_ID", "LOTE ID", "COD", "CÓD", "ID", "TICKET", "FICHA", "NRO LOTE", "N° LOTE", "CODIGO DE LOTE"] },
  { col: 4, key: "CLIENTE", label: "Cliente", synonyms: ["CLIENTE / AGRICULTOR / PRODUCTOR", "CLIENTE/AGRICULTOR/PRODUCTOR", "CLIENTE", "PRODUCTOR", "AGRICULTOR", "PROVEEDOR", "SEÑOR", "NOMBRE", "CLIENTE / PRODUCTOR", "CLIENTE/PRODUCTOR", "RAZON SOCIAL", "RAZÓN SOCIAL", "DUEÑO", "DUENO", "TITULAR"] },
  { col: 5, key: "SACOS", label: "Sacos", synonyms: ["SACOS", "SACO", "CANTIDAD", "CANTIDAD DE SACOS", "CANTIDAD SACOS", "BULTOS", "BOLSAS", "NRO SACOS", "N° SACOS"] },
  { col: 6, key: "PESO_KG", label: "Peso (kg)", synonyms: ["PESO (KG)", "PESO (Kg)", "PESO(KG)", "PESO (kg)", "PESO NETO (KG)", "PESO NETO(KG)", "PESO_KG", "PESO EN KG", "PESO KG", "PESO", "KILOS", "TOTAL_KG"] },
  // 7 a 25: Muestras de humedades
  { col: 26, key: "HUM", label: "Humedad promedio", synonyms: ["HUMEDAD PROMEDIO", "HUMEDAD_PROMEDIO", "PROM. H", "PROM H", "PROM_H", "HUM. M", "HUMEDAD", "HUMEDADES", "H. PROMEDIO", "HUM PROM", "%H", "PROM.", "HUMEDAD %", "H%", "H.PROM", "H"] },
  { col: 27, key: "DESVIACION", label: "Desviacion", synonyms: ["DESVIACION", "DESVIACIÓN", "D.", "DESV", "D", "DESV.", "STD", "DS", "DESVIACION ESTANDAR"] },
  { col: 28, key: "HUM_MAX", label: "Humedad maxima", synonyms: ["HUM. MAX", "HUM.MAX", "HUM MAX", "HUMEDAD MAXIMA", "HUMEDAD MÁXIMA", "H. MAX", "MAX", "MAXIMA", "MÁXIMA"] },
  { col: 29, key: "HUM_MIN", label: "Humedad minima", synonyms: ["HUM.MIN", "HUM. MIN", "HUM MIN", "HUMEDAD MINIMA", "HUMEDAD MÍNIMA", "H. MIN", "MIN", "MINIMA", "MÍNIMA"] },
  { col: 30, key: "VARIEDAD", label: "Variedad de arroz", synonyms: ["VARIEDAD DE ARROZ", "VARIEDAD DEL ARROZ", "VARIEDAD", "VARIEDA", "VARIEDAD ARROZ", "VAR", "TIPO ARROZ", "TIPO DE ARROZ", "TIPO", "VARIEDADES", "PRODUCTO", "CLASE", "ESPECIE"] },
  { col: 31, key: "RI", label: "Rendimiento integral", synonyms: ["R. INTEGRAL", "R INTEGRAL", "RENDIMIENTO INTEGRAL", "RI", "R.I.", "R.I", "%RI", "R_I", "REND. INTEGRAL"] },
  { col: 32, key: "RB", label: "Rendimiento blanco", synonyms: ["R. BLANCO", "R BLANCO", "RENDIMIENTO BLANCO", "RB", "R.B.", "R.B", "%RB", "R_B", "REND. BLANCO"] },
  { col: 33, key: "QI", label: "Quebrado integral", synonyms: ["QUEBRADO INTEGRAL", "QI", "Q.I.", "Q.I", "%QI", "Q_I", "QUEB. INTEGRAL"] },
  { col: 34, key: "QB", label: "Quebrado en blanco", synonyms: ["QUEBRADO EN BLANCO", "QUEBRADO BLANCO", "QB", "Q.B.", "Q.B", "%QB", "Q_B", "QUEB. BLANCO"] },
  { col: 35, key: "TT", label: "Tiza total", synonyms: ["TIZA. TOTAL", "TIZA.TOTAL", "TIZA TOTAL", "TOTAL TRIZADO", "TT", "%TT", "T_T", "T.T.", "T.T", "TIZADO TOTAL"] },
  { col: 36, key: "TP", label: "Tiza parcial", synonyms: ["TIZA. PARCIAL", "TIZA.PARCIAL", "TIZA PARCIAL", "TIZADO PARCIAL", "TP", "T. PUNT.", "T_PUNT", "PUNTO NEGRO", "PUNTOS", "%TP", "T_P", "T.P."] },
  { col: 37, key: "M", label: "Mancha", synonyms: ["MANCHA", "MANCHADO", "MANCHADOS", "M", "%M", "GRANOS MANCHADOS"] },
  { col: 38, key: "TZ", label: "Trizado", synonyms: ["TRIZADO", "TRIZADOS", "TZ", "%TZ", "T_Z", "T.Z."] },
  { col: 39, key: "GR", label: "Grano rojo", synonyms: ["GRANO ROJO", "GRANOS ROJOS", "ROJO", "ROJOS", "GR", "%GR", "G_R", "G.R."] },
  { col: 40, key: "GI", label: "Grano inmaduro", synonyms: ["GRANO INM", "GRANO INM.", "GRANO.INM", "GRANO INMADURO", "GRANOS INMADUROS", "INMADURO", "YESOSO", "GI", "G.I.", "%GI", "G_I", "INM"] },
  { col: 41, key: "GV", label: "Grano verde", synonyms: ["GRANO . VERDE", "GRANO. VERDE", "GRANO.VERDE", "GRANO VERDE", "GRANOS VERDES", "VERDE", "VERDES", "GV", "G.V.", "%GV", "G_V"] },
  { col: 42, key: "BLI", label: "Blancura integral", synonyms: ["BL. INTEGRAL", "BL.INTEGRAL", "BL INTEGRAL", "BLANCURA INTEGRAL", "B.INTEGRAL", "B. INTEGRAL", "B_INTEGRAL", "BLI", "BL", "KETT", "BLANCURA"] },
  { col: 43, label: "Blancura pulido", key: "BLP", synonyms: ["BL.PULID.", "BL.PULID", "BL. PULID.", "BLANCURA PULIDO", "B. PULIDO", "B.PULIDO", "B_PULIDO", "BLP"] },
  { col: 44, key: "OBSERVACIONES", label: "Observaciones", synonyms: ["OBSERVACIONES", "OBSERVACION", "OBSERVACIÓN", "OBSERVACION POR LOTE", "OBSERVACIÓN POR LOTE", "OBSERVACIONES POR LOTE", "OBS", "OBS.", "NOTA", "NOTAS", "DETALLE", "COMENTARIOS", "COMENTARIO"] }
];

/**
 * Normaliza una celda extraída
 */
function cellVal(arr: any[], index: number): any {
  if (!arr || index < 0 || index >= arr.length) return undefined;
  const v = arr[index];
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
}

/**
 * Busca el índice de una columna en headerRow que coincida con los sinónimos dados
 */
export function findColIndexInHeader(headerRow: string[] | undefined, synonyms: string[]): number {
  if (!headerRow || headerRow.length === 0) return -1;
  const synNorms = synonyms.map(normalizeKey).filter(s => s.length > 0);

  // 1. Coincidencia exacta de clave normalizada
  for (let i = 0; i < headerRow.length; i++) {
    const hNorm = normalizeKey(headerRow[i]);
    if (hNorm && synNorms.includes(hNorm)) return i;
  }

  // 2. Coincidencia por inclusión (para sinónimos con longitud >= 3)
  for (let i = 0; i < headerRow.length; i++) {
    const hNorm = normalizeKey(headerRow[i]);
    if (!hNorm) continue;
    for (const s of synNorms) {
      if (s.length >= 3 && (hNorm === s || hNorm.includes(s) || s.includes(hNorm))) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Normaliza una fila siguiendo la distribución exacta de 44 columnas del usuario.
 * Funciona tanto si la fila es un Array posicional como si es un Objeto con nombres de columna o claves XLSX (__EMPTY...).
 */
export function normalize44ColumnRow(row: any, headerRow?: string[]): Record<string, any> {
  const isArr = Array.isArray(row);
  const arr = isArr ? row : null;
  const obj = (!isArr && typeof row === "object" && row !== null) ? row : {};

  // Helper para buscar por coincidencia en headerRow, posición 0-indexed de la columna del usuario, o sinónimos en obj
  const getVal = (colIndex: number, synonyms: string[]): any => {
    // 1. Si tenemos headerRow, buscar la columna exacta por nombre/sinónimo en headerRow
    if (headerRow && headerRow.length > 0) {
      const foundIdx = findColIndexInHeader(headerRow, synonyms);
      if (foundIdx >= 0) {
        if (arr) {
          const v = cellVal(arr, foundIdx);
          if (v !== undefined) return v;
        }
        if (headerRow[foundIdx] && obj[headerRow[foundIdx]] !== undefined && obj[headerRow[foundIdx]] !== null && String(obj[headerRow[foundIdx]]).trim() !== "") {
          return obj[headerRow[foundIdx]];
        }
      }
    }

    // 2. Si viene como array (o no se encontró por nombre en header), probar la posición exacta 0-indexed (columna del usuario)
    if (arr) {
      const v = cellVal(arr, colIndex);
      if (v !== undefined) return v;
    }

    // 3. Buscar en obj por los sinónimos textuales normalizados
    const fromSynonyms = getFieldVal(obj, synonyms);
    if (fromSynonyms !== undefined) return fromSynonyms;

    // 4. Buscar en obj por claves XLSX posicionales (__EMPTY, __EMPTY_1, ...) o índice numérico
    const emptyKey = colIndex === 0 ? "__EMPTY" : `__EMPTY_${colIndex}`;
    if (obj[emptyKey] !== undefined && obj[emptyKey] !== null && String(obj[emptyKey]).trim() !== "") {
      return obj[emptyKey];
    }
    if (obj[colIndex] !== undefined && obj[colIndex] !== null && String(obj[colIndex]).trim() !== "") {
      return obj[colIndex];
    }
    if (obj[String(colIndex)] !== undefined && obj[String(colIndex)] !== null && String(obj[String(colIndex)]).trim() !== "") {
      return obj[String(colIndex)];
    }

    // 5. Fallback por orden de valores en Object.values(obj)
    const vals = Object.values(obj);
    if (vals.length > colIndex && vals[colIndex] !== undefined && vals[colIndex] !== null && String(vals[colIndex]).trim() !== "") {
      return vals[colIndex];
    }

    return undefined;
  };

  // Helper para combinar sinónimos de la especificación oficial con sinónimos posicionales adicionales
  const getColSynonyms = (key: string, extra: string[] = []): string[] => {
    const found = EXCEL_44_COLUMNS_SPEC.find(s => s.key === key);
    return Array.from(new Set([...(found ? found.synonyms : []), ...extra]));
  };

  // --- 1. Fecha de recepcion (Columna 1, índice 0) ---
  const rawFecha = getVal(0, getColSynonyms("FECHA", ["FECHA_ANALISIS", "DATE", "F. INGRESO", "F. RECEPCION", "FECHA RECEP", "COLUMNA 1", "COL 1"]));
  let finalFecha = "";
  if (rawFecha !== undefined && rawFecha !== null && String(rawFecha).trim() !== "") {
    const vDate = validateDateValue(rawFecha);
    finalFecha = vDate.isoDate || String(rawFecha).trim();
  }

  // --- 2. Ubicacion (Columna 2, índice 1) ---
  const rawUbi = getVal(1, getColSynonyms("UBICACION", ["COLUMNA 2", "COL 2"]));
  const finalUbi = rawUbi ? String(rawUbi).trim() : "";

  // --- 3. Codigo (Columna 3, índice 2) ---
  const rawCodigo = getVal(2, getColSynonyms("CODIGO", ["COLUMNA 3", "COL 3"]));
  let finalCodigo = rawCodigo ? String(rawCodigo).trim() : "";
  if (!finalCodigo || finalCodigo === "0") {
    // Si no se encontró por encabezado o posición fija, buscar en las primeras 5 celdas un número de 3 a 6 dígitos
    if (arr) {
      for (let i = 0; i < Math.min(arr.length, 6); i++) {
        const strVal = String(arr[i] || "").trim();
        if (/^\d{3,6}$/.test(strVal) && parseInt(strVal, 10) > 100) {
          if (i === 1 || i === 2 || i === 3) {
            finalCodigo = strVal;
            break;
          }
        } else if (/^C0?\d{3,6}$/i.test(strVal) || /^C[OÓ]\d{3,6}$/i.test(strVal)) {
          finalCodigo = strVal.toUpperCase();
          break;
        }
      }
    }
  }

  // Normalizar estrictamente al estándar C0_____ (ej: 6986 -> C06986, 8432 -> C08432, CO8432 -> C08432)
  finalCodigo = formatLoteCode(finalCodigo) || finalCodigo;

  // --- 4. Cliente (Columna 4, índice 3) ---
  const rawCliente = getVal(3, getColSynonyms("CLIENTE", ["COLUMNA 4", "COL 4"]));
  const finalCliente = rawCliente ? String(rawCliente).trim().toUpperCase() : "";

  // --- 5. Sacos (Columna 5, índice 4) ---
  const rawSacos = getVal(4, getColSynonyms("SACOS", ["COLUMNA 5", "COL 5"]));
  const finalSacos = parseNumericVal(rawSacos) || 0;

  // --- 6. Peso (kg) (Columna 6, índice 5) ---
  const rawPeso = getVal(5, getColSynonyms("PESO_KG", ["COLUMNA 6", "COL 6"]));
  const rawPesoTn = getVal(5, ["PESO (TN)", "PESO TN", "TN"]);
  const parsedP = parseNumericVal(rawPeso);
  const parsedPTn = parseNumericVal(rawPesoTn);
  const finalPeso = (parsedP !== undefined && parsedP > 0) ? parsedP : (parsedPTn !== undefined && parsedPTn > 0 ? parsedPTn * 1000 : 0);

  // --- 7 a 25. Muestras de humedades (19 caladas: índices 6 a 24) ---
  const caladasRecord: Record<string, number> = {};
  let caladasSum = 0;
  let caladasCount = 0;

  for (let k = 1; k <= 19; k++) {
    const colIdx = 5 + k; // Columna 7 -> colIdx 6 (k=1) hasta Columna 25 -> colIdx 24 (k=19)
    const rawM = getVal(colIdx, [`M${k}`, `H${k}`, `m${k}`, `h${k}`, `C${k}`, `CALADA ${k}`, `CALADA_${k}`, `MUESTRA ${k}`, `MUESTRA_${k}`]);
    const parsedM = parseNumericVal(rawM);
    if (parsedM !== undefined && parsedM > 0) {
      const valNum = Number(parsedM.toFixed(2));
      caladasRecord[`M${k}`] = valNum;
      caladasSum += valNum;
      caladasCount++;
    }
  }

  // --- 26. Humedad promedio (Columna 26, índice 25) ---
  const rawHumProm = getVal(25, getColSynonyms("HUM", ["COLUMNA 26", "COL 26"]));
  const parsedHumProm = parseNumericVal(rawHumProm);
  const finalHum = parsedHumProm !== undefined ? parsedHumProm : (caladasCount > 0 ? Number((caladasSum / caladasCount).toFixed(2)) : undefined);

  // --- 27. Desviacion (Columna 27, índice 26) ---
  const rawDesv = getVal(26, getColSynonyms("DESVIACION", ["COLUMNA 27", "COL 27"]));
  let finalDesv = parseNumericVal(rawDesv);
  if (finalDesv !== undefined && finalDesv > 20) {
    // Si viene formateado con puntos agrupados de Excel regional (ej: "2.453.772.606" o "994.987.437")
    const strD = String(rawDesv).trim();
    const parts = strD.split(".");
    if (parts.length >= 3) {
      if (parseInt(parts[0], 10) < 50) {
        finalDesv = Number(parseFloat(`${parts[0]}.${parts.slice(1).join("")}`).toFixed(2));
      } else if (parseInt(parts[0], 10) >= 900) {
        finalDesv = Number(parseFloat(`0.${parts.join("")}`).toFixed(2));
      }
    }
  }
  // Si la desviación no se pudo extraer o excede el límite y hay caladas registradas, calcular la desviación estándar muestral exacta
  if ((finalDesv === undefined || finalDesv > 20) && caladasCount > 1) {
    const mean = caladasSum / caladasCount;
    const variance = Object.values(caladasRecord).reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (caladasCount - 1);
    finalDesv = Number(Math.sqrt(variance).toFixed(2));
  }

  // --- 28. Humedad maxima (Columna 28, índice 27) ---
  const rawHumMax = getVal(27, getColSynonyms("HUM_MAX", ["COLUMNA 28", "COL 28"]));
  const finalHumMax = parseNumericVal(rawHumMax);

  // --- 29. Humedad minima (Columna 29, índice 28) ---
  const rawHumMin = getVal(28, getColSynonyms("HUM_MIN", ["COLUMNA 29", "COL 29"]));
  const finalHumMin = parseNumericVal(rawHumMin);

  // --- 30. Variedad de arroz (Columna 30, índice 29) ---
  const rawVar = getVal(29, getColSynonyms("VARIEDAD", ["COLUMNA 30", "COL 30"]));
  const finalVar = rawVar ? String(rawVar).trim() : "";

  // --- 31. Rendimiento integral (Columna 31, índice 30) ---
  const rawRi = getVal(30, getColSynonyms("RI", ["COLUMNA 31", "COL 31"]));
  const finalRi = parseNumericVal(rawRi);

  // --- 32. Rendimiento blanco (Columna 32, índice 31) ---
  const rawRb = getVal(31, getColSynonyms("RB", ["COLUMNA 32", "COL 32"]));
  const finalRb = parseNumericVal(rawRb);

  // --- 33. Quebrado integral (Columna 33, índice 32) ---
  const rawQi = getVal(32, getColSynonyms("QI", ["COLUMNA 33", "COL 33"]));
  const finalQi = parseNumericVal(rawQi);

  // --- 34. Quebrado en blanco (Columna 34, índice 33) ---
  const rawQb = getVal(33, getColSynonyms("QB", ["COLUMNA 34", "COL 34"]));
  const finalQb = parseNumericVal(rawQb);

  // Cálculos automáticos de remoción y entero si aplican
  const queb = finalQb !== undefined && finalQb > 0 ? finalQb : (finalQi || 0);
  const finalRm = (finalRi !== undefined && finalRb !== undefined && finalRi > 0 && finalRb > 0)
    ? Number((finalRi - finalRb).toFixed(2))
    : undefined;
  const finalEntero = (finalRb !== undefined && finalRb > 0 && queb > 0)
    ? Number((finalRb - queb).toFixed(2))
    : finalRb;

  // --- 35. Tiza total (Columna 35, índice 34) ---
  const rawTt = getVal(34, getColSynonyms("TT", ["COLUMNA 35", "COL 35"]));
  const finalTt = parseNumericVal(rawTt);

  // --- 36. Tiza parcial (Columna 36, índice 35) ---
  const rawTp = getVal(35, getColSynonyms("TP", ["COLUMNA 36", "COL 36"]));
  const finalTp = parseNumericVal(rawTp);

  // --- 37. Mancha (Columna 37, índice 36) ---
  const rawM = getVal(36, getColSynonyms("M", ["COLUMNA 37", "COL 37"]));
  const finalM = parseNumericVal(rawM);

  // --- 38. Trizado (Columna 38, índice 37) ---
  const rawTz = getVal(37, getColSynonyms("TZ", ["COLUMNA 38", "COL 38"]));
  const finalTz = parseNumericVal(rawTz);

  // --- 39. Grano rojo (Columna 39, índice 38) ---
  const rawGr = getVal(38, getColSynonyms("GR", ["COLUMNA 39", "COL 39"]));
  const finalGr = parseNumericVal(rawGr);

  // --- 40. Grano inmaduro (Columna 40, índice 39) ---
  const rawGi = getVal(39, getColSynonyms("GI", ["COLUMNA 40", "COL 40"]));
  const finalGi = parseNumericVal(rawGi);

  // --- 41. Grano verde (Columna 41, índice 40) ---
  const rawGv = getVal(40, getColSynonyms("GV", ["COLUMNA 41", "COL 41"]));
  const finalGv = parseNumericVal(rawGv);

  // --- 42. Blancura integral (Columna 42, índice 41) ---
  const rawBli = getVal(41, getColSynonyms("BLI", ["COLUMNA 42", "COL 42"]));
  const finalBli = parseNumericVal(rawBli);

  // --- 43. Blancura pulido (Columna 43, índice 42) ---
  const rawBlp = getVal(42, getColSynonyms("BLP", ["COLUMNA 43", "COL 43"]));
  const finalBlp = parseNumericVal(rawBlp);

  // --- 44. Observaciones (Columna 44, índice 43) ---
  const rawObs = getVal(43, getColSynonyms("OBSERVACIONES", ["COLUMNA 44", "COL 44"]));
  const finalObs = rawObs ? String(rawObs).trim() : "";

  // Preservar cualquier otra propiedad existente en el objeto original
  const baseObj = obj || {};

  return {
    ...baseObj,
    ...caladasRecord,
    caladas: caladasRecord,

    // Claves estándar requeridas por el sistema
    LOTE_ID: finalCodigo,
    CODIGO: finalCodigo,
    CLIENTE: finalCliente,
    FECHA_INGRESO: finalFecha,
    FECHA: finalFecha,
    UBICACION: finalUbi,
    SACOS: finalSacos > 0 ? finalSacos : undefined,
    PESO_KG: finalPeso > 0 ? finalPeso : undefined,
    VARIEDAD: finalVar,
    HUM: finalHum,
    DESV: finalDesv,
    DESVIACION: finalDesv,
    HUM_MAX: finalHumMax,
    HUM_MIN: finalHumMin,
    RI: finalRi,
    RB: finalRb,
    RM: finalRm,
    QI: finalQi,
    QB: finalQb,
    ENTERO: finalEntero,
    TT: finalTt,
    TP: finalTp,
    M: finalM,
    MANCHADO: finalM,
    TZ: finalTz,
    GR: finalGr,
    GI: finalGi,
    GV: finalGv,
    BLI: finalBli,
    "B.INTEGRAL": finalBli,
    BLP: finalBlp,
    "B. PULIDO": finalBlp,
    OBSERVACIONES: finalObs,

    // Claves literales en español de la distribución del usuario
    "Fecha de recepcion": finalFecha,
    "Ubicacion": finalUbi,
    "Codigo": finalCodigo,
    "Cliente": finalCliente,
    "Sacos": finalSacos,
    "Peso (kg)": finalPeso,
    "Humedad promedio": finalHum,
    "Desviacion": finalDesv,
    "Humedad maxima": finalHumMax,
    "Humedad minima": finalHumMin,
    "Variedad de arroz": finalVar,
    "Rendimiento integral": finalRi,
    "Rendimiento blanco": finalRb,
    "Quebrado integral": finalQi,
    "Quebrado en blanco": finalQb,
    "Tiza total": finalTt,
    "Tiza parcial": finalTp,
    "Mancha": finalM,
    "Trizado": finalTz,
    "Grano rojo": finalGr,
    "Grano inmaduro": finalGi,
    "Grano verde": finalGv,
    "Blancura integral": finalBli,
    "Blancura pulido": finalBlp,
    "Observaciones": finalObs
  };
}

/**
 * Cuenta cuántas palabras clave de encabezado coinciden en una fila
 */
function countHeaderMatches(row: any[]): number {
  if (!Array.isArray(row)) return 0;
  const keywords = [
    "FECHA", "RECEPCION", "RECEPCIÓN", "UBICACION", "UBICACIÓN",
    "CODIGO", "CÓDIGO", "LOTE", "CLIENTE", "PRODUCTOR", "AGRICULTOR",
    "SACO", "SACOS", "PESO", "KILOS", "HUMEDAD", "MUESTRAS", "CALADA",
    "DESVIACION", "VARIEDAD", "RENDIMIENTO", "QUEBRADO", "TIZA",
    "MANCHA", "TRIZADO", "BLANCURA", "OBSERVACION", "OBSERVACIONES"
  ];
  let matches = 0;
  for (const cell of row) {
    if (!cell) continue;
    const str = normalizeKey(String(cell));
    if (keywords.some(kw => str.includes(normalizeKey(kw)))) {
      matches++;
    }
  }
  return matches;
}

/**
 * Verifica si una fila corresponde a encabezados de texto
 */
function isHeaderRow(row: any[]): boolean {
  return countHeaderMatches(row) >= 2;
}

/**
 * Verifica si una fila corresponde a subencabezados de muestras (M1..M19) inmediatamente bajo el encabezado
 */
function isSubHeaderRow(row: any[]): boolean {
  if (!Array.isArray(row)) return false;

  // Si la fila contiene palabras de texto largas (ej: nombres de cliente, variedades, etc.), es una fila de datos
  const hasTextWords = row.some(cell => {
    const s = String(cell || "").trim();
    if (/^[MHC]\d+$/i.test(s) || /^COL\s*\d+$/i.test(s) || /^CALADA/i.test(s)) return false;
    return /[A-Za-zÁ-Úá-ú]{4,}/.test(s);
  });
  if (hasTextWords) return false;

  // Si contiene un código de lote numérico (3 a 6 dígitos), es una fila de datos
  const hasLoteCode = row.some(cell => {
    const s = String(cell || "").trim();
    return /^\d{3,6}$/.test(s) && parseInt(s, 10) > 100;
  });
  if (hasLoteCode) return false;

  let sampleMarkers = 0;
  for (const cell of row) {
    if (!cell) continue;
    const s = String(cell).trim().toUpperCase();
    if (/^M\d+$/.test(s) || /^H\d+$/.test(s) || /^C\d+$/.test(s) || /^CALADA\s*\d+$/.test(s)) {
      sampleMarkers++;
    }
  }
  return sampleMarkers >= 3;
}

/**
 * Palabras clave que indican filas de pie de página, totales o firmas
 */
const FOOTER_KEYWORDS = [
  "TOTAL", "TOTALES", "PROMEDIO", "SUMA", "SUBTOTAL", "MIN", "MAX", 
  "DESVIACION", "DESVIACIÓN", "FIRMA", "RESPONSABLE", "ELABORADO", 
  "REVISADO", "APROBADO", "V°B°", "VB", "NOTA", "NOTAS", 
  "OBSERVACIONES GENERALES", "OBSERVACION GENERAL"
];

function isFooterOrSummaryText(text: string): boolean {
  if (!text) return false;
  const upper = text.trim().toUpperCase();
  return FOOTER_KEYWORDS.some(k => upper === k || upper.startsWith(`${k}:`) || upper.startsWith(`${k} `));
}

/**
 * Analiza una hoja de Excel (.xlsx, .xls) localizando inteligentemente la fila real de datos
 * y normalizando cada fila con la distribución exacta de 44 columnas.
 */
export function parseSheetToRows(sheet: XLSX.WorkSheet): any[] {
  if (!sheet) return [];
  const rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  if (!rawGrid || rawGrid.length === 0) return [];

  // 1. Detectar inteligentemente la mejor fila de encabezados en las primeras 25 filas (la de mayor coincidencia)
  let bestHeaderIdx = -1;
  let maxMatches = 0;

  for (let rIdx = 0; rIdx < Math.min(rawGrid.length, 25); rIdx++) {
    const matches = countHeaderMatches(rawGrid[rIdx]);
    if (matches > maxMatches) {
      maxMatches = matches;
      bestHeaderIdx = rIdx;
    }
  }

  let dataStartIdx = 0;
  let headerRow: string[] | undefined = undefined;

  if (bestHeaderIdx >= 0 && maxMatches >= 2) {
    headerRow = rawGrid[bestHeaderIdx].map(c => String(c || "").trim());
    dataStartIdx = bestHeaderIdx + 1;
    // Si la siguiente fila inmediata es un sub-encabezado de etiquetas (ej. M1..M19 sin datos), saltarla también
    if (dataStartIdx < rawGrid.length && isSubHeaderRow(rawGrid[dataStartIdx])) {
      dataStartIdx++;
    }
  } else {
    // Si no hay fila de encabezados textuales, los datos empiezan en la fila 0
    dataStartIdx = 0;
  }

  const resultRows: any[] = [];

  for (let rIdx = dataStartIdx; rIdx < rawGrid.length; rIdx++) {
    const row = rawGrid[rIdx];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Verificar que la fila tenga al menos 2 celdas con contenido real
    const nonEmptyCells = row.filter(c => c !== undefined && c !== null && String(c).trim() !== "");
    if (nonEmptyCells.length < 2) continue;

    // Verificar si por error es un encabezado repetido en saltos de página (debe tener >= 4 nombres de columnas y ningún código numérico)
    const hasRowCode = row.some(c => {
      const s = String(c || "").trim();
      return /^\d{3,6}$/.test(s) && parseInt(s, 10) > 100;
    });
    if (!hasRowCode && countHeaderMatches(row) >= 4) continue;

    // Normalizar la fila con la estructura completa de 44 columnas
    const normalized = normalize44ColumnRow(row, headerRow);

    const rawCodeStr = String(normalized.CODIGO || normalized.LOTE_ID || "").trim();
    const codigoStr = formatLoteCode(rawCodeStr) || rawCodeStr.toUpperCase();
    const clienteStr = String(normalized.CLIENTE || "").trim().toUpperCase();

    if (codigoStr) {
      normalized.CODIGO = codigoStr;
      normalized.LOTE_ID = codigoStr;
      normalized["Codigo"] = codigoStr;
    }

    // Si la fila tiene un código de lote numérico real o estructurado (ej. C06986, C08432), es una fila de datos válida y NO es pie de página
    const isRealLoteCode = (/^C0\d+$/i.test(codigoStr)) || (/^\d{3,6}$/.test(rawCodeStr) && parseInt(rawCodeStr, 10) > 100);

    if (!isRealLoteCode) {
      if (isFooterOrSummaryText(codigoStr) || isFooterOrSummaryText(clienteStr)) {
        continue;
      }
      const firstColsText = row.slice(0, 4).map(c => String(c || "").trim().toUpperCase()).join(" ");
      if (isFooterOrSummaryText(firstColsText)) {
        continue;
      }
    }

    // Una fila de datos válida debe tener al menos:
    // a) Un código de lote reconocible
    // ó b) Un cliente con datos operativos (sacos, peso, fecha o variedad)
    const hasLoteCode = isRealLoteCode || (codigoStr !== "" && codigoStr !== "0" && !isFooterOrSummaryText(codigoStr));
    const hasClienteWithData = clienteStr !== "" && !isFooterOrSummaryText(clienteStr) && (
      (normalized.SACOS && normalized.SACOS > 0) || 
      (normalized.PESO_KG && normalized.PESO_KG > 0) ||
      (normalized.FECHA && normalized.FECHA !== "") ||
      (normalized.VARIEDAD && normalized.VARIEDAD !== "") ||
      (normalized.HUM !== undefined && normalized.HUM > 0)
    );

    if (!hasLoteCode && !hasClienteWithData) {
      // Fila vacía, separador o nota al pie
      continue;
    }

    resultRows.push(normalized);
  }

  if (resultRows.length > 0) return resultRows;

  // Fallback estándar en caso de estructura no tabular
  const fallback = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return fallback
    .map(f => normalize44ColumnRow(f))
    .filter(norm => {
      const code = formatLoteCode(norm.CODIGO || norm.LOTE_ID) || String(norm.CODIGO || norm.LOTE_ID || "").trim().toUpperCase();
      const cli = String(norm.CLIENTE || "").trim().toUpperCase();
      if (code) {
        norm.CODIGO = code;
        norm.LOTE_ID = code;
        norm["Codigo"] = code;
      }
      return (code !== "" && code !== "0" && !isFooterOrSummaryText(code)) || (cli !== "" && !isFooterOrSummaryText(cli));
    });
}
