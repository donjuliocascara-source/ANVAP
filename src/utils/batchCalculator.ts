import { Lote, BatchLote, BatchVaporizado, RegistroHumedad, AnalisisHumedo } from "../types";
import { compareLoteCodes } from "./formatLoteCode";

export interface BatchItemInput {
  loteId: string;
  sacos: number;
  pesoKg: number;
  variedad?: string;
  cliente?: string;
  humedad?: number;
}

export interface VariedadBreakdown {
  variedad: string;
  sacos: number;
  pesoKg: number;
  pesoTn: number;
  porcentaje: number;
}

export interface ClienteBreakdown {
  cliente: string;
  sacos: number;
  pesoKg: number;
  pesoTn: number;
  porcentaje: number;
}

export type EstadoCargaPayload = "VACIO" | "SUBUTILIZADO" | "OPTIMO" | "SOBRECARGA";

export interface BatchPayloadSummary {
  totalSacos: number;
  totalPesoKg: number;
  totalPesoTn: number;
  capacidadAutoclaveTn: number;
  capacidadAutoclaveKg: number;
  porcentajeCarga: number;
  capacidadRemanenteTn: number;
  capacidadRemanenteKg: number;
  estadoCarga: EstadoCargaPayload;
  humedadPromedioPonderada: number;
  variedades: VariedadBreakdown[];
  clientes: ClienteBreakdown[];
  lotesCount: number;
  esSobrecarga: boolean;
  diferenciaCapacidadTn: number; // Positive if space left, negative if overload
  recomendacionOperativa: string;
}

/**
 * Calculates automatic sum of weights, sack count, payload percentage, 
 * weighted moisture, and breakdown for any list of assigned lots in a batch.
 */
export function calculateBatchPayloadSummary(
  items: BatchItemInput[],
  capacidadAutoclaveTn: number = 35.0
): BatchPayloadSummary {
  const capacidadTn = Math.max(1, capacidadAutoclaveTn || 35.0);
  const capacidadKg = capacidadTn * 1000;

  if (!items || items.length === 0) {
    return {
      totalSacos: 0,
      totalPesoKg: 0,
      totalPesoTn: 0,
      capacidadAutoclaveTn: capacidadTn,
      capacidadAutoclaveKg: capacidadKg,
      porcentajeCarga: 0,
      capacidadRemanenteTn: capacidadTn,
      capacidadRemanenteKg: capacidadKg,
      estadoCarga: "VACIO",
      humedadPromedioPonderada: 0,
      variedades: [],
      clientes: [],
      lotesCount: 0,
      esSobrecarga: false,
      diferenciaCapacidadTn: capacidadTn,
      recomendacionOperativa: "Seleccione uno o más lotes para calcular el balance de carga útil del autoclave."
    };
  }

  let totalSacos = 0;
  let totalPesoKg = 0;
  let sumaPonderadaHumedad = 0;

  const variedadMap = new Map<string, { sacos: number; pesoKg: number }>();
  const clienteMap = new Map<string, { sacos: number; pesoKg: number }>();

  for (const item of items) {
    const sacos = Number(item.sacos) || 0;
    const pesoKg = Number(item.pesoKg) > 0 ? Number(item.pesoKg) : sacos * 50;
    const humedad = Number(item.humedad) || 14.0;
    const variedad = item.variedad?.trim() || "Variedad no especificada";
    const cliente = item.cliente?.trim() || "Cliente no especificado";

    totalSacos += sacos;
    totalPesoKg += pesoKg;
    sumaPonderadaHumedad += (pesoKg * humedad);

    // Accumulate Variedad
    const vCurr = variedadMap.get(variedad) || { sacos: 0, pesoKg: 0 };
    variedadMap.set(variedad, {
      sacos: vCurr.sacos + sacos,
      pesoKg: vCurr.pesoKg + pesoKg
    });

    // Accumulate Cliente
    const cCurr = clienteMap.get(cliente) || { sacos: 0, pesoKg: 0 };
    clienteMap.set(cliente, {
      sacos: cCurr.sacos + sacos,
      pesoKg: cCurr.pesoKg + pesoKg
    });
  }

  const totalPesoTn = Number((totalPesoKg / 1000).toFixed(2));
  const porcentajeCarga = Number(((totalPesoTn / capacidadTn) * 100).toFixed(1));
  const capacidadRemanenteTn = Number((capacidadTn - totalPesoTn).toFixed(2));
  const capacidadRemanenteKg = Number((capacidadKg - totalPesoKg).toFixed(0));
  const humedadPromedioPonderada = totalPesoKg > 0 
    ? Number((sumaPonderadaHumedad / totalPesoKg).toFixed(2)) 
    : 0;

  let estadoCarga: EstadoCargaPayload = "OPTIMO";
  let esSobrecarga = false;
  let recomendacionOperativa = "";

  if (totalPesoKg === 0) {
    estadoCarga = "VACIO";
    recomendacionOperativa = "Batch sin carga asignada.";
  } else if (porcentajeCarga > 100) {
    estadoCarga = "SOBRECARGA";
    esSobrecarga = true;
    const excesoTn = Math.abs(capacidadRemanenteTn);
    recomendacionOperativa = `⚠️ ALERTA DE SEGURIDAD: Exceso de ${excesoTn} TN sobre la capacidad nominal del autoclave (${capacidadTn} TN). Reduzca sacos para evitar mala penetración de vapor y riesgo de sobrepresión.`;
  } else if (porcentajeCarga < 85) {
    estadoCarga = "SUBUTILIZADO";
    recomendacionOperativa = `Holgura disponible: ${capacidadRemanenteTn} TN (${Math.round(capacidadRemanenteKg / 50)} sacos aprox.) para alcanzar capacidad nominal. Se recomienda completar la carga para optimizar el consumo de vapor.`;
  } else {
    estadoCarga = "OPTIMO";
    recomendacionOperativa = `Carga balanceada óptima (${porcentajeCarga}% de capacidad). Homogeneidad de vaporizado y eficiencia energética garantizadas.`;
  }

  // Build Variedad Breakdown
  const variedades: VariedadBreakdown[] = Array.from(variedadMap.entries()).map(([variedad, val]) => ({
    variedad,
    sacos: val.sacos,
    pesoKg: val.pesoKg,
    pesoTn: Number((val.pesoKg / 1000).toFixed(2)),
    porcentaje: totalPesoKg > 0 ? Number(((val.pesoKg / totalPesoKg) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.pesoKg - a.pesoKg);

  // Build Cliente Breakdown
  const clientes: ClienteBreakdown[] = Array.from(clienteMap.entries()).map(([cliente, val]) => ({
    cliente,
    sacos: val.sacos,
    pesoKg: val.pesoKg,
    pesoTn: Number((val.pesoKg / 1000).toFixed(2)),
    porcentaje: totalPesoKg > 0 ? Number(((val.pesoKg / totalPesoKg) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.pesoKg - a.pesoKg);

  return {
    totalSacos,
    totalPesoKg,
    totalPesoTn,
    capacidadAutoclaveTn: capacidadTn,
    capacidadAutoclaveKg: capacidadKg,
    porcentajeCarga,
    capacidadRemanenteTn,
    capacidadRemanenteKg,
    estadoCarga,
    humedadPromedioPonderada,
    variedades,
    clientes,
    lotesCount: items.length,
    esSobrecarga,
    diferenciaCapacidadTn: capacidadRemanenteTn,
    recomendacionOperativa
  };
}

/**
 * Helper to compute summary directly from existing BATCH_LOTES records and Lotes master catalog
 */
export function calculateBatchPayloadFromBatchLotes(
  batchLotes: BatchLote[],
  lotes: Lote[],
  capacidadAutoclaveTn: number = 35.0
): BatchPayloadSummary {
  const items: BatchItemInput[] = batchLotes.map((bl) => {
    const lot = lotes.find((l) => l.LOTE_ID === bl.LOTE_ID);
    return {
      loteId: bl.LOTE_ID,
      sacos: bl.SACOS || 0,
      pesoKg: bl.PESO_KG || (bl.SACOS * 50) || 0,
      variedad: lot?.VARIEDAD || "Tinajones Extra",
      cliente: lot?.CLIENTE || "Agrícola",
      humedad: lot?.HUM || 14.2
    };
  });

  return calculateBatchPayloadSummary(items, capacidadAutoclaveTn);
}

export interface ValoresIngresoBatch {
  codigo: string;
  cliente: string;
  procedencia: string;
  pesoTotalKg: number;
  pesoKg: number;
  pesoTn: string;
  numSacos: string;
  numSacosNumero: number;
  variedad: string;
  humedadPct: number | undefined;
}

/**
 * Extrae y calcula de manera fidedigna los 7 valores oficiales de ingreso para el
 * REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO directamente desde cada BATCH
 * y sus lotes correspondientes registrados en LOTES MP:
 * - CLIENTE
 * - PROCEDENCIA
 * - PESO TOTAL
 * - Nº SACOS
 * - PESO (KG)
 * - VARIEDAD
 * - % HUMEDAD
 */
export function obtenerValoresIngresoBatchDesdeLotes(params: {
  targetBatch?: BatchVaporizado | null;
  batchCode?: string;
  allLotes: Lote[];
  allBatchLotes?: BatchLote[];
  allHumedades?: RegistroHumedad[];
  allAnalisisHumedo?: AnalisisHumedo[];
  allProgramaciones?: any[];
}): ValoresIngresoBatch {
  const {
    targetBatch,
    batchCode = "",
    allLotes = [],
    allBatchLotes = [],
    allHumedades = [],
    allAnalisisHumedo = [],
    allProgramaciones = []
  } = params;

  const rawCode = (batchCode || targetBatch?.CORRELATIVO || targetBatch?.BATCH_ID || "").trim();
  const cleanBatchCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // 1. Buscar programación oficial correspondiente si existe
  const progMatch = allProgramaciones.find((p: any) => {
    const pB = (p.batch || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const pId = (p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cleanBatchCode && (pB === cleanBatchCode || pId === cleanBatchCode);
  });

  // 2. Extraer todos los IDs de lotes asignados al Batch
  const loteIdsSet = new Set<string>();

  // A. De batchLotes
  allBatchLotes.forEach((bl) => {
    const blB = (bl.BATCH_ID || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanBatchCode && blB === cleanBatchCode && bl.LOTE_ID) {
      loteIdsSet.add(bl.LOTE_ID);
    }
  });

  // B. De LOTES_UNION
  if (targetBatch?.LOTES_UNION && Array.isArray(targetBatch.LOTES_UNION)) {
    targetBatch.LOTES_UNION.forEach((lid) => {
      if (lid) loteIdsSet.add(lid);
    });
  }

  // C. De LOTE_ID directo en el batch
  if (targetBatch?.LOTE_ID) {
    loteIdsSet.add(targetBatch.LOTE_ID);
  }

  // D. De filasLote en batch o programacion
  const filasProg = (targetBatch as any)?.filasLote || progMatch?.filasLote;
  if (Array.isArray(filasProg)) {
    filasProg.forEach((f: any) => {
      const lid = f?.loteId || f?.LOTE_ID;
      if (lid) loteIdsSet.add(lid);
    });
  }

  // E. De lotesAsignados en batch
  const lotesAsignados = (targetBatch as any)?.lotesAsignados;
  if (Array.isArray(lotesAsignados)) {
    lotesAsignados.forEach((l: any) => {
      const lid = typeof l === "string" ? l : (l?.LOTE_ID || l?.loteId);
      if (lid) loteIdsSet.add(lid);
    });
  }

  // 3. Jalar los datos exactos que se ingresaron en LOTES MP para cada lote asignado
  interface LoteCalculado {
    loteId: string;
    cliente: string;
    procedencia: string;
    variedad: string;
    sacos: number;
    pesoKg: number;
    humedad?: number;
  }

  const lotesCalculados: LoteCalculado[] = [];
  const placeholderClientes = ["CLIENTE GENERAL", "MOLINO SAN PEDRO S.A.C.", "Cliente de Producción", "Sin cliente", ""];
  const placeholderProcedencias = ["Tolva de Alimentación", "Tolvas de Recepción", ""];

  loteIdsSet.forEach((lid) => {
    const loteObj = allLotes.find((l) => compareLoteCodes(l.LOTE_ID, lid) || l.LOTE_ID === lid);
    const humReg = allHumedades.find((h) => compareLoteCodes(h.LOTE_ID, lid) || h.LOTE_ID === lid);
    const ahReg = allAnalisisHumedo.find((a) => compareLoteCodes(a.LOTE_ID, lid) || a.LOTE_ID === lid);
    const blMatch = allBatchLotes.find((bl) => {
      const blB = (bl.BATCH_ID || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      return cleanBatchCode && blB === cleanBatchCode && (compareLoteCodes(bl.LOTE_ID, lid) || bl.LOTE_ID === lid);
    });
    const filaProgMatch = Array.isArray(filasProg)
      ? filasProg.find((f: any) => compareLoteCodes(f?.loteId || f?.LOTE_ID, lid))
      : undefined;

    // Cliente del lote
    const clienteLote = (loteObj?.CLIENTE || blMatch?.CLIENTE || filaProgMatch?.cliente || "").trim();

    // Procedencia del lote (priorizar PROCEDENCIA, UBICACIÓN o ZONA de LOTES MP)
    const procedenciaLote = (loteObj?.PROCEDENCIA || loteObj?.UBICACION || loteObj?.ZONA || (blMatch as any)?.UBICACION || filaProgMatch?.ubicacion || "").trim();

    // Variedad del lote
    const variedadLote = (loteObj?.VARIEDAD || blMatch?.VARIEDAD || filaProgMatch?.variedad || "").trim();

    // Sacos del lote asignados a este batch (prioridad: fila de programación o batchLotes, luego lote maestro)
    const progSacos = Number(filaProgMatch?.sacProg) || Number(filaProgMatch?.sacos) || 0;
    const blSacos = Number(blMatch?.SACOS) || 0;
    const sacosLote = progSacos > 0 ? progSacos : (blSacos > 0 ? blSacos : (Number(loteObj?.SACOS) || 0));

    // Peso en Kg del lote para este batch (calculado en base al peso unitario real del lote = PESO_KG / SACOS)
    const unitWeight = (loteObj?.PESO_KG && loteObj?.SACOS && Number(loteObj.SACOS) > 0)
      ? (Number(loteObj.PESO_KG) / Number(loteObj.SACOS))
      : 50;
    const progPeso = Number(filaProgMatch?.pesoProg) || Number(filaProgMatch?.peso) || 0;
    const blPeso = Number(blMatch?.PESO_KG) || 0;
    const isErroneous50FallbackProg = progPeso > 0 && progSacos > 0 && Math.abs(progPeso - progSacos * 50) <= 2 && unitWeight > 60;
    const isErroneous50FallbackBL = blPeso > 0 && blSacos > 0 && Math.abs(blPeso - blSacos * 50) <= 2 && unitWeight > 60;

    const pesoKgLote = (progPeso > 0 && !isErroneous50FallbackProg)
      ? progPeso
      : (blPeso > 0 && !isErroneous50FallbackBL
        ? blPeso
        : (sacosLote > 0 ? Math.round(sacosLote * unitWeight) : (Number(loteObj?.PESO_KG) || 0)));

    // Humedad del lote (de Lote MP, registro de caladas o análisis húmedo)
    const humRaw = loteObj?.HUM ?? loteObj?.HUMEDAD ?? humReg?.["H. PROMEDIO"] ?? ahReg?.HUMEDADES ?? filaProgMatch?.ph;
    const humedadLote = humRaw !== undefined && !isNaN(Number(humRaw)) ? Number(humRaw) : undefined;

    lotesCalculados.push({
      loteId: lid,
      cliente: clienteLote,
      procedencia: procedenciaLote,
      variedad: variedadLote,
      sacos: sacosLote,
      pesoKg: pesoKgLote,
      humedad: humedadLote
    });
  });

  // 4. Calcular CLIENTE
  const clientesUnicos = Array.from(new Set(
    lotesCalculados
      .map((l) => l.cliente)
      .filter((c) => c && !placeholderClientes.includes(c))
  ));
  let clienteFinal = clientesUnicos.join(", ");
  if (!clienteFinal) {
    if (targetBatch?.CLIENTE && !placeholderClientes.includes(targetBatch.CLIENTE.trim())) {
      clienteFinal = targetBatch.CLIENTE.trim();
    } else if (progMatch?.clientePrincipal && !placeholderClientes.includes(progMatch.clientePrincipal.trim())) {
      clienteFinal = progMatch.clientePrincipal.trim();
    } else {
      clienteFinal = targetBatch?.CLIENTE || "CLIENTE GENERAL";
    }
  }

  // 5. Calcular PROCEDENCIA
  const procedenciasUnicas = Array.from(new Set(
    lotesCalculados
      .map((l) => l.procedencia)
      .filter((p) => p && !placeholderProcedencias.includes(p))
  ));
  let procedenciaFinal = procedenciasUnicas.join(", ");
  if (!procedenciaFinal) {
    const batchProc = ((targetBatch as any)?.PROCEDENCIA || (targetBatch as any)?.UBICACION || (targetBatch as any)?.SILO || (targetBatch as any)?.ZONA || (targetBatch as any)?.ORIGEN || progMatch?.ubicacion || "").trim();
    procedenciaFinal = (batchProc && !placeholderProcedencias.includes(batchProc)) ? batchProc : "";
  }

  // 6. Calcular PESO TOTAL y PESO (KG)
  const pesoSumLotes = lotesCalculados.reduce((sum, l) => sum + (l.pesoKg || 0), 0);
  const progPesoKg = Number(progMatch?.pesoTotalKg || 0);
  let pesoTotalKgFinal = pesoSumLotes > 0
    ? pesoSumLotes
    : (progPesoKg > 0
      ? progPesoKg
      : ((targetBatch?.PESO_TOTAL_KG && targetBatch.PESO_TOTAL_KG > 0 && targetBatch.PESO_TOTAL_KG !== 18000)
        ? targetBatch.PESO_TOTAL_KG
        : ((targetBatch as any)?.TOTAL_PESO_KG 
          || (targetBatch?.TON_PROCESADAS ? targetBatch.TON_PROCESADAS * 1000 : 0) 
          || (targetBatch?.TON_PROGRAMADAS ? targetBatch.TON_PROGRAMADAS * 1000 : 0) 
          || (targetBatch?.CAPACIDAD_PROGRAMADA_TN ? targetBatch.CAPACIDAD_PROGRAMADA_TN * 1000 : 0)
          || (targetBatch?.PESO_TOTAL_KG || 0))));

  // 7. Calcular N° SACOS
  const sacosSumLotes = lotesCalculados.reduce((sum, l) => sum + (l.sacos || 0), 0);
  const progSacosNum = Number(progMatch?.totalSacosProg || 0);
  let sacosNumeroFinal = sacosSumLotes > 0
    ? sacosSumLotes
    : (progSacosNum > 0
      ? progSacosNum
      : ((targetBatch?.TOTAL_SACOS && targetBatch.TOTAL_SACOS > 0 && targetBatch.TOTAL_SACOS !== 360)
        ? targetBatch.TOTAL_SACOS
        : ((targetBatch as any)?.SACOS || 0)));

  if (sacosNumeroFinal <= 0 && pesoTotalKgFinal > 0) {
    sacosNumeroFinal = Math.round(pesoTotalKgFinal / 50);
  }
  const numSacosFinal = sacosNumeroFinal > 0 ? `${sacosNumeroFinal} SACOS` : "";

  // 8. Calcular VARIEDAD
  const variedadesUnicas = Array.from(new Set(
    lotesCalculados
      .map((l) => l.variedad)
      .filter((v) => v && v.trim().length > 0)
  ));
  let variedadFinal = variedadesUnicas.join(", ");
  if (!variedadFinal) {
    variedadFinal = targetBatch?.VARIEDAD?.trim() || progMatch?.variedadPrincipal?.trim() || "";
  }

  // 9. Calcular % HUMEDAD PONDERADA
  let sumHumPond = 0;
  let sumPesoHum = 0;
  let sumHumSimple = 0;
  let countHum = 0;

  lotesCalculados.forEach((l) => {
    if (l.humedad !== undefined && !isNaN(l.humedad) && l.humedad > 0) {
      const w = l.pesoKg > 0 ? l.pesoKg : 1;
      sumHumPond += l.humedad * w;
      sumPesoHum += w;
      sumHumSimple += l.humedad;
      countHum++;
    }
  });

  let humedadFinal: number | undefined = undefined;
  if (sumPesoHum > 0) {
    humedadFinal = Number((sumHumPond / sumPesoHum).toFixed(1));
  } else if (countHum > 0) {
    humedadFinal = Number((sumHumSimple / countHum).toFixed(1));
  } else if (targetBatch?.HUMEDAD_PROMEDIO !== undefined && targetBatch.HUMEDAD_PROMEDIO > 0) {
    humedadFinal = Number(targetBatch.HUMEDAD_PROMEDIO.toFixed(1));
  } else if ((targetBatch as any)?.HUMEDAD !== undefined && (targetBatch as any).HUMEDAD > 0) {
    humedadFinal = Number(Number((targetBatch as any).HUMEDAD).toFixed(1));
  } else if ((targetBatch as any)?.HUM !== undefined && (targetBatch as any).HUM > 0) {
    humedadFinal = Number(Number((targetBatch as any).HUM).toFixed(1));
  } else if (progMatch?.promedios?.ph !== undefined) {
    humedadFinal = Number(progMatch.promedios.ph.toFixed(1));
  }

  const pesoTn = (pesoTotalKgFinal / 1000).toFixed(1);

  return {
    codigo: rawCode || cleanBatchCode,
    cliente: clienteFinal,
    procedencia: procedenciaFinal,
    pesoTotalKg: pesoTotalKgFinal,
    pesoKg: pesoTotalKgFinal,
    pesoTn,
    numSacos: numSacosFinal,
    numSacosNumero: sacosNumeroFinal,
    variedad: variedadFinal,
    humedadPct: humedadFinal
  };
}

export interface ResultadoTiempoBateriaSilos {
  horaMenor: string;
  horaMayor: string;
  tiempoTotalMin: number;
  duracionFormateada: string;
  detallesHoras: string[];
}

/**
 * Normaliza y parsea una cadena de hora a minutos del día (0-1439).
 * Soporta formatos 24h ("14:30"), 12h con AM/PM ("2:30 PM", "11:00 AM"), y texto sucio ("14:30 ").
 */
export const parseTimeToMinutes = (t: string): number | null => {
  if (!t || typeof t !== "string") return null;
  const clean = t.trim().toUpperCase();
  if (
    clean === "--:--" ||
    clean === "-:--" ||
    clean === "--" ||
    clean === "-" ||
    clean.includes("PEND") ||
    clean.includes("SIN")
  ) {
    return null;
  }
  const isPM = clean.includes("PM");
  const isAM = clean.includes("AM");
  const timeOnly = clean.replace(/[APM\s]/g, "");
  const parts = timeOnly.split(":").map((p) => parseInt(p, 10));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    let hours = parts[0];
    const minutes = parts[1];
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  return null;
};

/**
 * Calcula la duración lógica en minutos entre dos horas de un paso de proceso.
 * Soporta formato 12 horas en la tarde ingresado sin sufijo "PM" (ej: 11:30 a 01:15 => 105 min en lugar de 825 min)
 * y cruce de medianoche en turnos nocturnos (ej: 22:30 a 01:15 => 165 min).
 */
export function calcDurationBetween(inicio?: string, fin?: string): number {
  if (!inicio || !fin) return 0;
  const start = parseTimeToMinutes(inicio);
  const end = parseTimeToMinutes(fin);
  if (start === null || end === null) return 0;

  if (end >= start) {
    return end - start;
  }

  // Si end < start:
  // Podría ser formato 12 horas en la tarde sin PM (ej. inicio 11:30, fin 01:15 => 13:15, diff = 105 min)
  const diff12h = (end + 720) - start;
  const diff24h = (end + 1440) - start;

  if (diff12h >= 0 && diff12h <= 720 && start >= 360) {
    return Math.round(diff12h);
  }

  return Math.round(diff24h);
}

/**
 * Helper para extraer minutos numéricos de strings como "45 min", "120", etc.
 */
export function parseDurationMinutes(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.max(0, Math.round(val));
  const str = String(val).trim();
  if (
    str === "--" ||
    str === "-" ||
    str === "--:--" ||
    str.toLowerCase().includes("sin") ||
    str.toLowerCase().includes("pend")
  ) {
    return 0;
  }
  const num = parseFloat(str.replace(/[^\d.]/g, ""));
  return isNaN(num) ? 0 : Math.max(0, Math.round(num));
}

/**
 * En "Batería de Enfriamiento y Reposo (Silos 1 al 5)", el tiempo total debe contabilizar
 * el transcurso real de la operación simultánea de la batería (desde el inicio del primer silo cargado
 * hasta el término de la descarga del último silo), evitando sumar tiempos en serie que exagerarían
 * el tiempo real de planta.
 */
export function calcularTiempoBateriaSilosSimultaneo(silos?: any[]): ResultadoTiempoBateriaSilos {
  if (!silos || !Array.isArray(silos) || silos.length === 0) {
    return {
      horaMenor: "",
      horaMayor: "",
      tiempoTotalMin: 0,
      duracionFormateada: "0 min",
      detallesHoras: []
    };
  }

  interface SiloDataPoint {
    raw: string;
    mins: number;
    siloNumber: number;
    type: "start" | "end" | "middle";
  }

  const rawTimesList: SiloDataPoint[] = [];
  const siloDurations: number[] = [];

  silos.forEach((s, idx) => {
    if (!s) return;
    const siloNum = s.siloNumber || idx + 1;

    // Duraciones directas por silo
    const tLlenado = parseDurationMinutes(s.exclusa?.tiempoLlenado);
    const tReposo = parseDurationMinutes(s.descarga?.tiempoReposo || s.descarga?.reposo);
    const tDescarga = parseDurationMinutes(s.descarga?.tiempoDescarga || s.descarga?.tiempo);
    const totalDurs = tLlenado + tReposo + tDescarga;
    if (totalDurs > 0) {
      siloDurations.push(totalDurs);
    }

    // Horas de inicio candidatas
    const startCandidates = [
      s.exclusa?.inicio,
      s.tiempoLlenadoInicio,
      s.horaInicio
    ];
    startCandidates.forEach((cand) => {
      if (cand && typeof cand === "string") {
        const mins = parseTimeToMinutes(cand);
        if (mins !== null) {
          rawTimesList.push({ raw: cand.trim(), mins, siloNumber: siloNum, type: "start" });
        }
      }
    });

    // Horas intermedias
    const middleCandidates = [
      s.exclusa?.fin,
      s.tiempoLlenadoFin,
      s.descarga?.inicio,
      s.tiempoDescargaInicio,
      s.tiempoReposoInicio,
      s.tiempoReposoFin
    ];
    middleCandidates.forEach((cand) => {
      if (cand && typeof cand === "string") {
        const mins = parseTimeToMinutes(cand);
        if (mins !== null) {
          rawTimesList.push({ raw: cand.trim(), mins, siloNumber: siloNum, type: "middle" });
        }
      }
    });

    // Horas de término candidatas
    const endCandidates = [
      s.descarga?.fin,
      s.tiempoDescargaFin,
      s.horaFin
    ];
    endCandidates.forEach((cand) => {
      if (cand && typeof cand === "string") {
        const mins = parseTimeToMinutes(cand);
        if (mins !== null) {
          rawTimesList.push({ raw: cand.trim(), mins, siloNumber: siloNum, type: "end" });
        }
      }
    });
  });

  // Si no hay horas reloj registradas, pero hay duraciones ingresadas
  if (rawTimesList.length === 0) {
    if (siloDurations.length > 0) {
      const maxDuration = Math.max(...siloDurations);
      return {
        horaMenor: "",
        horaMayor: "",
        tiempoTotalMin: maxDuration,
        duracionFormateada: `${maxDuration} min`,
        detallesHoras: []
      };
    }
    return {
      horaMenor: "",
      horaMayor: "",
      tiempoTotalMin: 0,
      duracionFormateada: "0 min",
      detallesHoras: []
    };
  }

  if (rawTimesList.length === 1) {
    const single = rawTimesList[0];
    const fallbackDur = siloDurations.length > 0 ? Math.max(...siloDurations) : 0;
    return {
      horaMenor: single.raw,
      horaMayor: single.raw,
      tiempoTotalMin: fallbackDur,
      duracionFormateada: `${fallbackDur} min`,
      detallesHoras: [single.raw]
    };
  }

  // Establecer el Ancla de Inicio cronológico de la Batería:
  // Preferimos la hora de inicio del primer silo con registro (típicamente Silo 1 o el menor número de silo)
  const startPoints = rawTimesList.filter(p => p.type === "start");
  let anchorPoint: SiloDataPoint;
  if (startPoints.length > 0) {
    startPoints.sort((a, b) => a.siloNumber - b.siloNumber);
    anchorPoint = startPoints[0];
  } else {
    anchorPoint = rawTimesList[0];
  }

  const anchorMin = anchorPoint.mins;

  // Normalizar toda la lista de horas a una línea de tiempo continua relativa al ancla:
  // Resuelve tanto cruce de medianoche nocturno como formatos de 12 horas en la tarde ingresados sin "PM".
  const timelinePoints = rawTimesList.map(p => {
    let timelineMin = p.mins;
    if (timelineMin < anchorMin) {
      const diff12 = (timelineMin + 720) - anchorMin;
      if (diff12 >= 0 && diff12 <= 720 && anchorMin >= 360) {
        // Horas de la tarde (1:00 PM - 11:00 PM) ingresadas en formato 12h
        timelineMin = timelineMin + 720;
      } else {
        // Cruce de medianoche en turno nocturno
        timelineMin = timelineMin + 1440;
      }
    }
    return {
      ...p,
      timelineMin
    };
  });

  timelinePoints.sort((a, b) => a.timelineMin - b.timelineMin);

  const minPoint = timelinePoints[0];
  const maxPoint = timelinePoints[timelinePoints.length - 1];

  let diffMin = maxPoint.timelineMin - minPoint.timelineMin;

  // Salvaguarda: si todas las horas son iguales o diff es 0, usar duración de silos si existe
  if (diffMin === 0 && siloDurations.length > 0) {
    diffMin = Math.max(...siloDurations);
  }

  return {
    horaMenor: minPoint.raw,
    horaMayor: maxPoint.raw,
    tiempoTotalMin: diffMin,
    duracionFormateada: `${diffMin} min`,
    detallesHoras: rawTimesList.map((r) => r.raw)
  };
}
