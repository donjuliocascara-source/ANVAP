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

    // Sacos del lote
    const sacosLote = Number(loteObj?.SACOS) || Number(blMatch?.SACOS) || Number(filaProgMatch?.sacProg) || Number(filaProgMatch?.sacos) || 0;

    // Peso en Kg del lote
    const pesoKgLote = Number(loteObj?.PESO_KG) || Number(blMatch?.PESO_KG) || Number(filaProgMatch?.pesoProg) || Number(filaProgMatch?.peso) || (sacosLote > 0 ? sacosLote * 50 : 0);

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
  let pesoTotalKgFinal = (targetBatch?.PESO_TOTAL_KG && targetBatch.PESO_TOTAL_KG > 0)
    ? targetBatch.PESO_TOTAL_KG
    : (pesoSumLotes > 0
      ? pesoSumLotes
      : ((targetBatch as any)?.TOTAL_PESO_KG 
        || (targetBatch?.TON_PROCESADAS ? targetBatch.TON_PROCESADAS * 1000 : 0) 
        || (targetBatch?.TON_PROGRAMADAS ? targetBatch.TON_PROGRAMADAS * 1000 : 0) 
        || (targetBatch?.CAPACIDAD_PROGRAMADA_TN ? targetBatch.CAPACIDAD_PROGRAMADA_TN * 1000 : 0)
        || (progMatch?.pesoTotalKg || 0)));

  // 7. Calcular N° SACOS
  const sacosSumLotes = lotesCalculados.reduce((sum, l) => sum + (l.sacos || 0), 0);
  let sacosNumeroFinal = (targetBatch?.TOTAL_SACOS && targetBatch.TOTAL_SACOS > 0)
    ? targetBatch.TOTAL_SACOS
    : (sacosSumLotes > 0
      ? sacosSumLotes
      : ((targetBatch as any)?.SACOS 
        || (progMatch?.totalSacosProg || 0)));

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
