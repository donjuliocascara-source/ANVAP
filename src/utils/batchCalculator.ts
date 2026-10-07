import { Lote, BatchLote } from "../types";

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
