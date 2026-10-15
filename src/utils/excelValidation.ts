/**
 * Capa de validación de tipos de datos para sincronización e importación de Excel/CSV
 * Verifica tipos (fechas, números, porcentajes), valores requeridos y límites de rango.
 */

import { formatLoteCode } from "./formatLoteCode";

export type FieldDataType = "string" | "number" | "date" | "percentage";

export interface FieldValidationRule {
  key: string;
  label: string;
  type: FieldDataType;
  required?: boolean;
  min?: number;
  max?: number;
  integerOnly?: boolean;
  description?: string;
  example?: string;
}

export const FIELD_VALIDATION_RULES: Record<string, FieldValidationRule> = {
  // Lote y Recepción
  LOTE_ID: {
    key: "LOTE_ID",
    label: "Código de Lote",
    type: "string",
    required: true,
    description: "Identificador único obligatorio",
    example: "6964, C02026, L-01"
  },
  CLIENTE: {
    key: "CLIENTE",
    label: "Cliente / Productor",
    type: "string",
    description: "Nombre del cliente",
    example: "Agroindustrial Norte"
  },
  VARIEDAD: {
    key: "VARIEDAD",
    label: "Variedad de Arroz",
    type: "string",
    description: "Variedad de arroz",
    example: "Tinajones Extra, IR-43"
  },
  SACOS: {
    key: "SACOS",
    label: "Cantidad de Sacos",
    type: "number",
    integerOnly: true,
    min: 0,
    max: 100000,
    description: "Número de sacos (entero positivo)",
    example: "700, 620"
  },
  PESO_KG: {
    key: "PESO_KG",
    label: "Peso Neto (Kg)",
    type: "number",
    min: 0,
    max: 1000000,
    description: "Kilogramos totales netos",
    example: "35000, 31000"
  },
  FECHA: {
    key: "FECHA",
    label: "Fecha de Ingreso",
    type: "date",
    description: "Fecha en formato válido",
    example: "2026-09-24, 24/09/2026"
  },
  UBICACION: {
    key: "UBICACION",
    label: "Ubicación / Silo",
    type: "string",
    description: "Silo o tolva",
    example: "Silo 01"
  },
  ZONA: {
    key: "ZONA",
    label: "Zona / Origen",
    type: "string",
    description: "Procedencia",
    example: "Valle Chancay"
  },
  OBSERVACIONES: {
    key: "OBSERVACIONES",
    label: "Observaciones",
    type: "string",
    description: "Notas",
    example: "Grano húmedo"
  },

  // Humedad
  HUM: {
    key: "HUM",
    label: "Humedad Promedio (%)",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Porcentaje de humedad (típico 10% - 35%)",
    example: "13.8, 14.5"
  },
  DESVIACION: {
    key: "DESVIACION",
    label: "Desviación Estándar (D.)",
    type: "number",
    min: 0,
    max: 20,
    description: "Dispersión entre caladas",
    example: "0.35, 0.40"
  },
  HUM_MAX: {
    key: "HUM_MAX",
    label: "Humedad Máxima (%)",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Calada más húmeda",
    example: "23.8, 26.2"
  },
  HUM_MIN: {
    key: "HUM_MIN",
    label: "Humedad Mínima (%)",
    type: "percentage",
    min: 0,
    max: 100,
    description: "Calada más seca",
    example: "16.5, 24.1"
  },

  // Análisis Físico
  RI: {
    key: "RI",
    label: "Rendimiento Integral (RI %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "78.5"
  },
  RB: {
    key: "RB",
    label: "Rendimiento Blanco (RB %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "69.0"
  },
  RM: {
    key: "RM",
    label: "Rendimiento Masa (RM %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "9.5"
  },
  QI: {
    key: "QI",
    label: "Quebrado Integral (QI %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "12.0"
  },
  QB: {
    key: "QB",
    label: "Quebrado Blanco (QB %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "14.0"
  },
  ENTERO: {
    key: "ENTERO",
    label: "Grano Entero (%)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "55.0"
  },
  TT: {
    key: "TT",
    label: "Total Trizado / Tiza (TT %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "1.2"
  },
  TP: {
    key: "TP",
    label: "Punto Negro (TP %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "0.5"
  },
  M: {
    key: "M",
    label: "Granos Manchados (M %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "0.4"
  },
  TZ: {
    key: "TZ",
    label: "Trizado (TZ %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "2.1"
  },
  GR: {
    key: "GR",
    label: "Granos Rojos (GR %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "0.2"
  },
  GI: {
    key: "GI",
    label: "Grano Inmaduro (GI %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "1.6"
  },
  GV: {
    key: "GV",
    label: "Grano Verde (GV %)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "3.8"
  },
  BLI: {
    key: "BLI",
    label: "Blancura Integral (BLI)",
    type: "number",
    min: 0,
    max: 100,
    example: "23.5"
  },
  BLP: {
    key: "BLP",
    label: "Blancura Pulido (BLP)",
    type: "number",
    min: 0,
    max: 100,
    example: "42.0"
  },
  IMPUREZAS: {
    key: "IMPUREZAS",
    label: "Impurezas (%)",
    type: "percentage",
    min: 0,
    max: 100,
    example: "0.5"
  }
};

/**
 * Convierte un número serial de fecha de Excel (ej: 44927) a fecha ISO YYYY-MM-DD
 */
export function excelSerialDateToISO(serial: number): string | null {
  if (typeof serial !== "number" || isNaN(serial) || serial < 1000 || serial > 100000) {
    return null;
  }
  // Excel epoch: 1899-12-30 (con corrección de bisiesto de Lotus 1-2-3)
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

/**
 * Validador de fechas estricto pero tolerante a formatos de Excel
 */
export function validateDateValue(raw: unknown): {
  isValid: boolean;
  error?: string;
  isoDate?: string;
} {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { isValid: true };
  }

  // 1. Instancia nativa de Date
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) {
      return { isValid: false, error: "Objeto de fecha inválido" };
    }
    return { isValid: true, isoDate: raw.toISOString().split("T")[0] };
  }

  // 2. Número serial de Excel (ej: 45194 -> ~2023)
  if (typeof raw === "number") {
    const iso = excelSerialDateToISO(raw);
    if (iso) {
      return { isValid: true, isoDate: iso };
    }
    return { isValid: false, error: `Número ${raw} no corresponde a una fecha válida de Excel` };
  }

  const str = String(raw).trim();

  // Si es un número en string que podría ser serial de Excel (ej: "44927" o "44927.5")
  if (!isNaN(Number(str)) && Number(str) >= 1000 && Number(str) <= 100000) {
    const num = Number(str);
    const iso = excelSerialDateToISO(num);
    if (iso) return { isValid: true, isoDate: iso };
  }

  // Detección de errores típicos de Excel
  if (str.startsWith("#") || str.toUpperCase() === "N/A" || str.toUpperCase() === "NULL") {
    return { isValid: false, error: `Valor con error en celda: "${str}"` };
  }

  // 3. Formatos con guiones, barras o puntos: YYYY-MM-DD, YYYY/MM/DD o YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return { isValid: true, isoDate: `${year}-${pad(month)}-${pad(day)}` };
    }
    return { isValid: false, error: `Día o mes fuera de rango en fecha: "${str}"` };
  }

  // 4. Formatos latinos: DD/MM/YYYY, DD-MM-YYYY o DD.MM.YYYY
  const latMatch = str.match(/^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})/);
  if (latMatch) {
    const day = parseInt(latMatch[1], 10);
    const month = parseInt(latMatch[2], 10);
    let year = parseInt(latMatch[3], 10);
    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return { isValid: true, isoDate: `${year}-${pad(month)}-${pad(day)}` };
    }
    return { isValid: false, error: `Fecha inválida o fuera de rango: "${str}"` };
  }

  // Intento de parseo nativo Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1990 && parsed.getFullYear() <= 2100) {
    return { isValid: true, isoDate: parsed.toISOString().split("T")[0] };
  }

  return {
    isValid: false,
    error: `Formato de fecha no reconocido: "${str.slice(0, 20)}". Usa AAAA-MM-DD o DD/MM/AAAA.`
  };
}

/**
 * Validador y extractor de números y porcentajes
 */
export function validateNumberValue(
  raw: unknown,
  rule?: {
    min?: number;
    max?: number;
    integerOnly?: boolean;
    isPercentage?: boolean;
    fieldName?: string;
  }
): {
  isValid: boolean;
  error?: string;
  warning?: string;
  parsedNumber?: number;
} {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { isValid: true };
  }

  let num: number;

  if (typeof raw === "number") {
    if (isNaN(raw) || !isFinite(raw)) {
      return { isValid: false, error: "Valor numérico no finito o NaN" };
    }
    num = raw;
  } else {
    const str = String(raw).trim();

    // Detección de errores típicos de Excel
    if (str.startsWith("#") || str.toUpperCase() === "N/A" || str.toUpperCase() === "ERROR") {
      return { isValid: false, error: `Error en celda de origen: "${str}"` };
    }

    // Limpieza de formato: quita "%", "$", "S/.", espacios
    let cleanStr = str
      .replace(/[%$€\s]/g, "")
      .replace(/S\/\.?/gi, "");

    // Manejo de separadores decimales/miles:
    // Caso especial: agrupaciones de puntos en decimales de Excel (ej: "2.453.772.606" -> 2.453772606 o "994.987.437" -> 0.994987437)
    const dotCount = (cleanStr.match(/\./g) || []).length;
    if (dotCount >= 2 && !cleanStr.includes(",")) {
      const parts = cleanStr.split(".");
      if (parts.length >= 3) {
        const firstNum = parseInt(parts[0], 10);
        if (rule?.fieldName === "DESVIACION" || (rule?.max !== undefined && rule.max <= 20) || firstNum < 20) {
          cleanStr = `${parts[0]}.${parts.slice(1).join("")}`;
        } else if (firstNum >= 900 && firstNum < 1000) {
          cleanStr = `0.${parts.join("")}`;
        }
      }
    }

    // Caso "1.250,50" -> "1250.50"
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleanStr)) {
      cleanStr = cleanStr.replace(/\./g, "").replace(",", ".");
    }
    // Caso "1,250.50" -> "1250.50"
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleanStr)) {
      cleanStr = cleanStr.replace(/,/g, "");
    }
    // Caso con coma decimal simple "13,8" -> "13.8"
    else if (/^-?\d+,\d+$/.test(cleanStr)) {
      cleanStr = cleanStr.replace(",", ".");
    }

    // Verificar si contiene texto no numérico residual
    if (!/^-?\d+(\.\d+)?$/.test(cleanStr)) {
      return {
        isValid: false,
        error: `Texto no numérico: "${str.length > 15 ? str.slice(0, 15) + "..." : str}". Se esperaba un número.`
      };
    }

    num = parseFloat(cleanStr);
    if (isNaN(num) || !isFinite(num)) {
      return { isValid: false, error: `No se pudo convertir "${str}" a número` };
    }
  }

  // Validar si requiere ser entero
  if (rule?.integerOnly && !Number.isInteger(num)) {
    return {
      isValid: false,
      error: `Debe ser un número entero sin decimales (encontrado: ${num})`
    };
  }

  // Validar rangos mínimos
  if (rule?.min !== undefined && num < rule.min) {
    return {
      isValid: false,
      error: `Valor (${num}) no puede ser menor al mínimo permitido (${rule.min})`
    };
  }

  // Validar rangos máximos
  if (rule?.max !== undefined && num > rule.max) {
    return {
      isValid: false,
      error: `Valor (${num}) supera el máximo permitido (${rule.max})`
    };
  }

  // Plausibilidad en arroz (Warnings no bloqueantes pero útiles)
  let warning: string | undefined = undefined;
  if (rule?.fieldName === "HUM") {
    if (num > 35) {
      warning = `Humedad de ${num}% es inusualmente alta para grano de arroz`;
    } else if (num < 8) {
      warning = `Humedad de ${num}% es inusualmente baja para grano de arroz`;
    }
  }

  return { isValid: true, parsedNumber: num, warning };
}

export interface CellValidationError {
  fieldKey: string;
  excelCol: string;
  rawValue: any;
  error: string;
  type: "date" | "number" | "required" | "range";
}

export interface CellValidationWarning {
  fieldKey: string;
  excelCol: string;
  rawValue: any;
  warning: string;
}

export interface RowValidationResult {
  rowIndex: number;
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  cellErrors: Record<string, CellValidationError>;
  cellWarnings: Record<string, CellValidationWarning>;
  cleanedRow: Record<string, any>;
}

export interface SheetValidationReport {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  totalErrors: number;
  totalWarnings: number;
  dateErrorsCount: number;
  numberErrorsCount: number;
  requiredErrorsCount: number;
  errorsByColumn: Record<string, number>;
  rowValidations: RowValidationResult[];
}

/**
 * Valida un conjunto de filas transformadas contrastándolas con el mapeo de columnas del sistema
 */
export function validateImportDataset(
  rawRows: any[],
  columnMapping: Record<string, string>
): SheetValidationReport {
  const rowValidations: RowValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let dateErrorsCount = 0;
  let numberErrorsCount = 0;
  let requiredErrorsCount = 0;
  const errorsByColumn: Record<string, number> = {};

  rawRows.forEach((row, rowIndex) => {
    const cellErrors: Record<string, CellValidationError> = {};
    const cellWarnings: Record<string, CellValidationWarning> = {};
    const cleanedRow: Record<string, any> = { ...row };

    // 1. Validar campo obligatorio LOTE_ID
    const loteCol = columnMapping["LOTE_ID"];
    const rawLoteVal = loteCol && row[loteCol] !== undefined ? row[loteCol] : (row.LOTE_ID || row.CODIGO || row.LOTE);
    const loteStr = formatLoteCode(rawLoteVal);

    if (!loteStr || loteStr === "0" || loteStr.toLowerCase() === "null" || loteStr.toLowerCase() === "undefined") {
      const err: CellValidationError = {
        fieldKey: "LOTE_ID",
        excelCol: loteCol || "LOTE_ID",
        rawValue: rawLoteVal,
        error: "Código de lote obligatorio no encontrado o vacío en esta fila",
        type: "required"
      };
      cellErrors["LOTE_ID"] = err;
      requiredErrorsCount++;
      totalErrors++;
      errorsByColumn["LOTE_ID"] = (errorsByColumn["LOTE_ID"] || 0) + 1;
    } else {
      cleanedRow["LOTE_ID"] = loteStr;
      cleanedRow["CODIGO"] = loteStr;
    }

    // 2. Validar el resto de campos mapeados
    Object.entries(columnMapping).forEach(([sysKey, excelCol]) => {
      if (sysKey === "LOTE_ID") return; // Ya validado
      if (!excelCol || row[excelCol] === undefined) return;

      const rawVal = row[excelCol];
      const rule = FIELD_VALIDATION_RULES[sysKey];
      if (!rule) {
        cleanedRow[sysKey] = rawVal;
        return;
      }

      // Validar tipo Fecha
      if (rule.type === "date") {
        const dateRes = validateDateValue(rawVal);
        if (!dateRes.isValid) {
          const err: CellValidationError = {
            fieldKey: sysKey,
            excelCol,
            rawValue: rawVal,
            error: dateRes.error || "Fecha no válida",
            type: "date"
          };
          cellErrors[sysKey] = err;
          dateErrorsCount++;
          totalErrors++;
          errorsByColumn[sysKey] = (errorsByColumn[sysKey] || 0) + 1;
        } else if (dateRes.isoDate) {
          cleanedRow[sysKey] = dateRes.isoDate;
        }
      } 
      // Validar tipo Número / Porcentaje
      else if (rule.type === "number" || rule.type === "percentage") {
        const numRes = validateNumberValue(rawVal, {
          min: rule.min,
          max: rule.max,
          integerOnly: rule.integerOnly,
          isPercentage: rule.type === "percentage",
          fieldName: sysKey
        });

        if (!numRes.isValid) {
          const err: CellValidationError = {
            fieldKey: sysKey,
            excelCol,
            rawValue: rawVal,
            error: numRes.error || "Número no válido",
            type: "number"
          };
          cellErrors[sysKey] = err;
          numberErrorsCount++;
          totalErrors++;
          errorsByColumn[sysKey] = (errorsByColumn[sysKey] || 0) + 1;
        } else {
          if (numRes.parsedNumber !== undefined) {
            cleanedRow[sysKey] = numRes.parsedNumber;
          }
          if (numRes.warning) {
            cellWarnings[sysKey] = {
              fieldKey: sysKey,
              excelCol,
              rawValue: rawVal,
              warning: numRes.warning
            };
            totalWarnings++;
          }
        }
      } else {
        // String o genérico
        cleanedRow[sysKey] = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : "";
      }
    });

    const hasErrors = Object.keys(cellErrors).length > 0;
    const hasWarnings = Object.keys(cellWarnings).length > 0;

    rowValidations.push({
      rowIndex,
      isValid: !hasErrors,
      hasErrors,
      hasWarnings,
      cellErrors,
      cellWarnings,
      cleanedRow
    });
  });

  const invalidRowsCount = rowValidations.filter((r) => r.hasErrors).length;
  const validRowsCount = rawRows.length - invalidRowsCount;

  return {
    totalRows: rawRows.length,
    validRowsCount,
    invalidRowsCount,
    totalErrors,
    totalWarnings,
    dateErrorsCount,
    numberErrorsCount,
    requiredErrorsCount,
    errorsByColumn,
    rowValidations
  };
}
