import { Lote, AnalisisHumedo, Presecado } from "../types";
import { LoteProgramacionFila, PromediosBatchCalidad, extraerDatosCalidadLote } from "./programacionBatchOficialService";

export interface CriterioParametro {
  clave: string;
  nombre: string;
  unidad: string;
  toleranciaDesvPermitida: number;
  descripcion: string;
  esCritico: boolean;
}

export interface CriteriosUnionLotesConfig {
  toleranciaHumedad: number;       // P(H) - Desviación permitida (default: 1.5)
  toleranciaTotalTrizado: number;  // T.T - Desviación permitida (default: 2.0)
  toleranciaQuebradoInt: number;   // Q.I - Desviación permitida (default: 2.0)
  toleranciaQuebradoBlanco: number;// Q.B - Desviación permitida (default: 2.5)
  toleranciaBlancuraInt: number;   // BL.INT - Desviación permitida (default: 2.0)
  toleranciaBlancuraBlanco: number;// BL.BLANCO - Desviación permitida (default: 3.0)
  toleranciaTrizadoParcial: number;// T.P - Desviación permitida (default: 1.5)
  toleranciaTizaPuntilla: number;  // T.PUN - Desviación permitida (default: 2.0)
  toleranciaManchado: number;      // M - Desviación permitida (default: 1.0)
  toleranciaTrizado: number;       // TRIZ - Desviación permitida (default: 1.5)
  toleranciaDesvHumedad: number;   // DESV - Desviación permitida (default: 1.0)
  toleranciaImpurezas: number;     // Impurezas - Desviación permitida (default: 1.0)
  exigirMismoCliente: boolean;     // Obligatorio: todos los lotes de un solo cliente
  exigirMismaVariedad: boolean;    // Recomendado: misma variedad
  ultimaActualizacion?: string;
  actualizadoPor?: string;
}

export const CRITERIOS_UNION_DEFAULT: CriteriosUnionLotesConfig = {
  toleranciaHumedad: 1.5,
  toleranciaTotalTrizado: 2.0,
  toleranciaQuebradoInt: 2.0,
  toleranciaQuebradoBlanco: 2.5,
  toleranciaBlancuraInt: 2.0,
  toleranciaBlancuraBlanco: 3.0,
  toleranciaTrizadoParcial: 1.5,
  toleranciaTizaPuntilla: 2.0,
  toleranciaManchado: 1.0,
  toleranciaTrizado: 1.5,
  toleranciaDesvHumedad: 1.0,
  toleranciaImpurezas: 1.0,
  exigirMismoCliente: true,
  exigirMismaVariedad: true,
  ultimaActualizacion: "2026-08-19 08:00:00",
  actualizadoPor: "Jefatura de Planta / Control de Calidad"
};

const STORAGE_KEY_CRITERIOS = "molino_criterios_union_lotes_v1";

export function obtenerCriteriosUnionGuardados(): CriteriosUnionLotesConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRITERIOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...CRITERIOS_UNION_DEFAULT, ...parsed };
    }
  } catch (e) {
    console.warn("Error leyendo criterios de unión de lotes:", e);
  }
  return { ...CRITERIOS_UNION_DEFAULT };
}

export function guardarCriteriosUnion(cfg: CriteriosUnionLotesConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CRITERIOS, JSON.stringify(cfg));
  } catch (e) {
    console.error("Error guardando criterios de unión de lotes:", e);
  }
}

export interface DetalleDesviacionParametro {
  parametro: string;
  label: string;
  unidad: string;
  promedioBatch: number;
  valorLote: number;
  desviacionAbsoluta: number;
  toleranciaPermitida: number;
  excede: boolean;
}

export interface EvaluacionLoteEnMezcla {
  loteId: string;
  cliente: string;
  variedad: string;
  esMismoCliente: boolean;
  esMismaVariedad: boolean;
  desviaciones: DetalleDesviacionParametro[];
  cantidadExcesos: number;
  esHomogeneo: boolean;
  alertaMensaje?: string;
}

export interface DesviacionParametroBatch {
  parametro: string;
  nombre: string;
  unidad: string;
  promedioBatch: number;
  desviacionMaximaObservada: number;
  toleranciaPermitida: number;
  cumple: boolean;
  lotePeorDesv?: string;
}

export interface EvaluacionUnionBatchResult {
  esCompatible: boolean;
  bloqueadoPorCliente: boolean;
  bloqueadoPorVariedad?: boolean;
  bloqueadoPorDesviaciones?: boolean;
  motivoBloqueo?: string;
  mismoCliente: boolean;
  clienteComun?: string;
  mismaVariedad: boolean;
  variedadComun?: string;
  variedadValida: boolean;
  totalLotes: number;
  lotesEvaluados: EvaluacionLoteEnMezcla[];
  resumenParametros: {
    parametro: string;
    label: string;
    unidad: string;
    promedio: number;
    maxDesviacion: number;
    tolerancia: number;
    cumple: boolean;
    lotePeorDesv?: string;
  }[];
  desviacionesPorParametro: DesviacionParametroBatch[];
  alertas: string[];
  recomendacionOperativa: string;
}

/**
 * Genera el listado predeterminado de desviaciones de parámetros para visualización homogénea
 */
export function generarDesviacionesDefecto(cfg: CriteriosUnionLotesConfig = CRITERIOS_UNION_DEFAULT): DesviacionParametroBatch[] {
  return [
    { parametro: "PH", nombre: "Humedad P(H)", unidad: "%", promedioBatch: 14.0, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaHumedad, cumple: true },
    { parametro: "DESV", nombre: "Desv. Humedad", unidad: "%", promedioBatch: 1.0, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaDesvHumedad, cumple: true },
    { parametro: "TT", nombre: "Total Trizado (T.T)", unidad: "%", promedioBatch: 1.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTotalTrizado, cumple: true },
    { parametro: "QI", nombre: "Quebrado Int. (Q.I)", unidad: "%", promedioBatch: 7.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaQuebradoInt, cumple: true },
    { parametro: "QB", nombre: "Quebrado Bl. (Q.B)", unidad: "%", promedioBatch: 15.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaQuebradoBlanco, cumple: true },
    { parametro: "BL_INT", nombre: "Blancura Int.", unidad: "°", promedioBatch: 21.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaBlancuraInt, cumple: true },
    { parametro: "BL_BLANCO", nombre: "Blancura de Pulido", unidad: "°", promedioBatch: 39.0, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaBlancuraBlanco, cumple: true },
    { parametro: "TP", nombre: "Triz. Parcial (T.P)", unidad: "%", promedioBatch: 2.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTrizadoParcial, cumple: true },
    { parametro: "TPUN", nombre: "Tiza Puntilla", unidad: "%", promedioBatch: 4.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTizaPuntilla, cumple: true },
    { parametro: "M", nombre: "Manchado (M)", unidad: "%", promedioBatch: 0.8, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaManchado, cumple: true },
    { parametro: "TRIZ", nombre: "Trizado (TZ)", unidad: "%", promedioBatch: 1.8, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTrizado, cumple: true }
  ];
}

/**
 * Evalúa la compatibilidad de una lista de lotes que se quieren unir en un Batch:
 * 1. Valida que pertenezcan a UN SOLO CLIENTE (estricto).
 * 2. Valida que pertenezcan a la MISMA VARIEDAD (salvo marcado explícito como 'MEZCLA').
 * 3. Calcula promedios ponderados.
 * 4. Compara cada lote individual contra el promedio ponderado en cada defecto.
 * 5. Valida que la desviación no exceda la tolerancia permitida (Uniformidad de parámetros).
 */
export function evaluarCompatibilidadBatch(
  filas: LoteProgramacionFila[],
  cfg: CriteriosUnionLotesConfig = obtenerCriteriosUnionGuardados()
): EvaluacionUnionBatchResult {
  if (!filas || filas.length === 0) {
    return {
      esCompatible: true,
      bloqueadoPorCliente: false,
      bloqueadoPorVariedad: false,
      bloqueadoPorDesviaciones: false,
      mismoCliente: true,
      mismaVariedad: true,
      variedadValida: true,
      totalLotes: 0,
      lotesEvaluados: [],
      resumenParametros: [],
      desviacionesPorParametro: generarDesviacionesDefecto(cfg),
      alertas: [],
      recomendacionOperativa: "Agregue al menos un lote para iniciar la validación de mezcla y homogeneidad."
    };
  }

  // 1. REGLA ESTRICTA DE UN SOLO CLIENTE
  const clientes = Array.from(new Set(filas.map(f => (f.cliente || "").trim())));
  const mismoCliente = clientes.length <= 1;
  const clienteComun = mismoCliente ? clientes[0] : undefined;

  // 2. Misma Variedad (Salvo que esté descrita explícitamente como MEZCLA)
  const esVariedadMezcla = (v: string) => {
    const norm = (v || "").trim().toUpperCase();
    return norm.includes("MEZCLA") || norm.includes("MIX");
  };

  const variedades = Array.from(new Set(filas.map(f => (f.variedad || "").trim())));
  const mismaVariedad = variedades.length <= 1;
  const variedadComun = mismaVariedad ? variedades[0] : undefined;

  // Validar si las variedades son compatibles:
  // Son válidas si son todas idénticas O si todos los lotes que difieren tienen la variedad marcada como MEZCLA
  const variedadValida = mismaVariedad || filas.every(f => {
    const v = (f.variedad || "").trim().toUpperCase();
    const firstVar = (variedades[0] || "").trim().toUpperCase();
    return v === firstVar || esVariedadMezcla(v) || esVariedadMezcla(firstVar);
  });

  let bloqueadoPorCliente = false;
  let bloqueadoPorVariedad = false;
  let motivoBloqueo: string | undefined = undefined;

  if (cfg.exigirMismoCliente && !mismoCliente) {
    bloqueadoPorCliente = true;
    motivoBloqueo = `REGLA DE CLIENTE ÚNICO NO CUMPLIDA: Todos los lotes del batch deben pertenecer a un solo cliente. Clientes detectados: ${clientes.join(", ")}.`;
  } else if (cfg.exigirMismaVariedad && !variedadValida) {
    bloqueadoPorVariedad = true;
    motivoBloqueo = `REGLA DE VARIEDAD NO CUMPLIDA: No se permite guardar lotes con diferentes variedades (${variedades.join(", ")}), a menos que el campo 'Variedad' esté explícitamente marcado como 'MEZCLA'.`;
  }

  // Si solo hay 1 lote, es compatible consigo mismo salvo conflicto previo
  if (filas.length === 1) {
    const f = filas[0];
    const singleLotDesv: DesviacionParametroBatch[] = [
      { parametro: "PH", nombre: "Humedad P(H)", unidad: "%", promedioBatch: f.ph || 14.0, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaHumedad, cumple: true },
      { parametro: "DESV", nombre: "Desv. Humedad", unidad: "%", promedioBatch: f.desv || 1.0, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaDesvHumedad, cumple: true },
      { parametro: "TT", nombre: "Total Trizado (T.T)", unidad: "%", promedioBatch: f.tt || 1.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTotalTrizado, cumple: true },
      { parametro: "QI", nombre: "Quebrado Int. (Q.I)", unidad: "%", promedioBatch: f.qi || 7.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaQuebradoInt, cumple: true },
      { parametro: "QB", nombre: "Quebrado Bl. (Q.B)", unidad: "%", promedioBatch: f.qb || 15.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaQuebradoBlanco, cumple: true },
      { parametro: "BL_INT", nombre: "Blancura Int.", unidad: "°", promedioBatch: f.blInt || 21.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaBlancuraInt, cumple: true },
      { parametro: "BL_BLANCO", nombre: "Blancura de Pulido", unidad: "°", promedioBatch: f.blBlanco || 39.0, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaBlancuraBlanco, cumple: true },
      { parametro: "TP", nombre: "Triz. Parcial (T.P)", unidad: "%", promedioBatch: f.tp || 2.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTrizadoParcial, cumple: true },
      { parametro: "TPUN", nombre: "Tiza Puntilla", unidad: "%", promedioBatch: f.tpun || 4.5, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTizaPuntilla, cumple: true },
      { parametro: "M", nombre: "Manchado (M)", unidad: "%", promedioBatch: f.m || 0.8, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaManchado, cumple: true },
      { parametro: "TRIZ", nombre: "Trizado (TZ)", unidad: "%", promedioBatch: f.triz || 1.8, desviacionMaximaObservada: 0, toleranciaPermitida: cfg.toleranciaTrizado, cumple: true }
    ];

    return {
      esCompatible: !bloqueadoPorCliente && !bloqueadoPorVariedad,
      bloqueadoPorCliente,
      bloqueadoPorVariedad,
      bloqueadoPorDesviaciones: false,
      motivoBloqueo,
      mismoCliente: true,
      clienteComun: f.cliente,
      mismaVariedad: true,
      variedadComun: f.variedad,
      variedadValida: true,
      totalLotes: 1,
      lotesEvaluados: [{
        loteId: f.loteId,
        cliente: f.cliente,
        variedad: f.variedad,
        esMismoCliente: true,
        esMismaVariedad: true,
        desviaciones: [],
        cantidadExcesos: 0,
        esHomogeneo: true
      }],
      resumenParametros: [],
      desviacionesPorParametro: singleLotDesv,
      alertas: motivoBloqueo ? [motivoBloqueo] : [],
      recomendacionOperativa: "Lote único seleccionado. Al agregar lotes adicionales, solo se admitirán del mismo cliente y con desviaciones dentro del rango permitido."
    };
  }

  // 3. Calcular Promedios Ponderados por Peso
  let totalPeso = 0;
  let sumPH = 0;
  let sumTT = 0;
  let sumQI = 0;
  let sumQB = 0;
  let sumBlInt = 0;
  let sumBlBlanco = 0;
  let sumTP = 0;
  let sumTPUN = 0;
  let sumM = 0;
  let sumTRIZ = 0;
  let sumDesv = 0;

  for (const f of filas) {
    const p = f.pesoProg > 0 ? f.pesoProg : (f.sacProg > 0 ? f.sacProg * 50 : 1000);
    totalPeso += p;
    sumPH += (f.ph * p);
    sumTT += (f.tt * p);
    sumQI += (f.qi * p);
    sumQB += (f.qb * p);
    sumBlInt += (f.blInt * p);
    sumBlBlanco += (f.blBlanco * p);
    sumTP += (f.tp * p);
    sumTPUN += (f.tpun * p);
    sumM += (f.m * p);
    sumTRIZ += (f.triz * p);
    sumDesv += (f.desv * p);
  }

  const pDiv = totalPeso > 0 ? totalPeso : 1;
  const avg = {
    ph: Number((sumPH / pDiv).toFixed(2)),
    tt: Number((sumTT / pDiv).toFixed(2)),
    qi: Number((sumQI / pDiv).toFixed(2)),
    qb: Number((sumQB / pDiv).toFixed(2)),
    blInt: Number((sumBlInt / pDiv).toFixed(2)),
    blBlanco: Number((sumBlBlanco / pDiv).toFixed(2)),
    tp: Number((sumTP / pDiv).toFixed(2)),
    tpun: Number((sumTPUN / pDiv).toFixed(2)),
    m: Number((sumM / pDiv).toFixed(2)),
    triz: Number((sumTRIZ / pDiv).toFixed(2)),
    desv: Number((sumDesv / pDiv).toFixed(2))
  };

  const listaDefiniciones: {
    param: string;
    label: string;
    unidad: string;
    avgVal: number;
    tol: number;
    extractor: (f: LoteProgramacionFila) => number;
  }[] = [
    { param: "ph", label: "Humedad P(H)", unidad: "%", avgVal: avg.ph, tol: cfg.toleranciaHumedad, extractor: f => f.ph },
    { param: "tt", label: "Total Trizado (T.T)", unidad: "%", avgVal: avg.tt, tol: cfg.toleranciaTotalTrizado, extractor: f => f.tt },
    { param: "qi", label: "Quebrado Integral (Q.I)", unidad: "%", avgVal: avg.qi, tol: cfg.toleranciaQuebradoInt, extractor: f => f.qi },
    { param: "qb", label: "Quebrado Blanco (Q.B)", unidad: "%", avgVal: avg.qb, tol: cfg.toleranciaQuebradoBlanco, extractor: f => f.qb },
    { param: "blInt", label: "Blancura Integral", unidad: "°", avgVal: avg.blInt, tol: cfg.toleranciaBlancuraInt, extractor: f => f.blInt },
    { param: "blBlanco", label: "Blancura de Pulido (B. PULIDO)", unidad: "°", avgVal: avg.blBlanco, tol: cfg.toleranciaBlancuraBlanco, extractor: f => f.blBlanco },
    { param: "tp", label: "Trizado Parcial (T.P)", unidad: "%", avgVal: avg.tp, tol: cfg.toleranciaTrizadoParcial, extractor: f => f.tp },
    { param: "tpun", label: "Tiza / Puntilla (T.PUN)", unidad: "%", avgVal: avg.tpun, tol: cfg.toleranciaTizaPuntilla, extractor: f => f.tpun },
    { param: "m", label: "Manchado (M)", unidad: "%", avgVal: avg.m, tol: cfg.toleranciaManchado, extractor: f => f.m },
    { param: "triz", label: "Trizado (TRIZ)", unidad: "%", avgVal: avg.triz, tol: cfg.toleranciaTrizado, extractor: f => f.triz },
    { param: "desv", label: "Desv. Humedad (DESV)", unidad: "pp", avgVal: avg.desv, tol: cfg.toleranciaDesvHumedad, extractor: f => f.desv }
  ];

  const alertas: string[] = [];
  if (motivoBloqueo) {
    alertas.push(motivoBloqueo);
  }

  const lotesEvaluados: EvaluacionLoteEnMezcla[] = [];
  const maxDesvMap = new Map<string, { maxD: number; loteId: string }>();

  for (const fila of filas) {
    const isSameCli = clienteComun ? fila.cliente?.trim().toLowerCase() === clienteComun.toLowerCase() : true;
    const isSameVar = variedadComun ? fila.variedad?.trim().toLowerCase() === variedadComun.toLowerCase() : true;

    const desviaciones: DetalleDesviacionParametro[] = [];
    let cantidadExcesos = 0;

    for (const def of listaDefiniciones) {
      const vLote = Number(def.extractor(fila));
      const desvAbs = Number(Math.abs(vLote - def.avgVal).toFixed(2));
      const excede = desvAbs > def.tol;

      if (excede) {
        cantidadExcesos++;
        alertas.push(`Lote ${fila.loteId}: Desviación de ${def.label} (${vLote}${def.unidad}) respecto al promedio del batch (${def.avgVal}${def.unidad}) es de ${desvAbs}${def.unidad}, superando la tolerancia permitida de ±${def.tol}${def.unidad}.`);
      }

      const currMax = maxDesvMap.get(def.param) || { maxD: 0, loteId: fila.loteId };
      if (desvAbs > currMax.maxD) {
        maxDesvMap.set(def.param, { maxD: desvAbs, loteId: fila.loteId });
      }

      desviaciones.push({
        parametro: def.param,
        label: def.label,
        unidad: def.unidad,
        promedioBatch: def.avgVal,
        valorLote: vLote,
        desviacionAbsoluta: desvAbs,
        toleranciaPermitida: def.tol,
        excede
      });
    }

    lotesEvaluados.push({
      loteId: fila.loteId,
      cliente: fila.cliente,
      variedad: fila.variedad,
      esMismoCliente: isSameCli,
      esMismaVariedad: isSameVar,
      desviaciones,
      cantidadExcesos,
      esHomogeneo: cantidadExcesos === 0 && isSameCli && variedadValida,
      alertaMensaje: cantidadExcesos > 0 ? `${cantidadExcesos} parámetro(s) superan la desviación permitida` : undefined
    });
  }

  const resumenParametros = listaDefiniciones.map(def => {
    const rec = maxDesvMap.get(def.param) || { maxD: 0, loteId: "" };
    return {
      parametro: def.param,
      label: def.label,
      unidad: def.unidad,
      promedio: def.avgVal,
      maxDesviacion: rec.maxD,
      tolerancia: def.tol,
      cumple: rec.maxD <= def.tol,
      lotePeorDesv: rec.loteId
    };
  });

  const tieneExcesoDesviacion = resumenParametros.some(r => !r.cumple);
  let bloqueadoPorDesviaciones = false;

  if (tieneExcesoDesviacion) {
    bloqueadoPorDesviaciones = true;
    const paramsExcedidos = resumenParametros.filter(r => !r.cumple).map(r => `${r.label} (Desv. Máx: ${r.maxDesviacion}${r.unidad} > Tol: ±${r.tolerancia}${r.unidad})`).join("; ");
    if (!motivoBloqueo) {
      motivoBloqueo = `INCUMPLIMIENTO DE UNIFORMIDAD: Los siguientes parámetros exceden la desviación permitida respecto al promedio: ${paramsExcedidos}.`;
    }
  }

  const esCompatible = !bloqueadoPorCliente && !bloqueadoPorVariedad && !tieneExcesoDesviacion;

  let recomendacionOperativa = "";
  if (bloqueadoPorCliente) {
    recomendacionOperativa = "⛔ BLOQUEADO: Los lotes pertenecen a clientes diferentes. Separe los lotes por cliente único.";
  } else if (bloqueadoPorVariedad) {
    recomendacionOperativa = "⛔ BLOQUEADO: Variedades distintas no permitidas. Solo se permite si la variedad está catalogada como MEZCLA.";
  } else if (tieneExcesoDesviacion) {
    const paramsExcedidos = resumenParametros.filter(r => !r.cumple).map(r => r.label).join(", ");
    recomendacionOperativa = `⛔ HETEROGENEIDAD NO CONFORME: Existen desviaciones superiores a la tolerancia en: ${paramsExcedidos}. Debe unificar los parámetros según las desviaciones permitidas antes de confirmar.`;
  } else {
    recomendacionOperativa = `✅ MEZCLA HOMOGÉNEA Y CONFORME: Todos los lotes pertenecen a "${clienteComun}", variedad conforme y todas las desviaciones cumplen las tolerancias de planta.`;
  }

  const desviacionesPorParametro: DesviacionParametroBatch[] = resumenParametros.map(r => ({
    parametro: r.parametro,
    nombre: r.label,
    unidad: r.unidad,
    promedioBatch: r.promedio,
    desviacionMaximaObservada: r.maxDesviacion,
    toleranciaPermitida: r.tolerancia,
    cumple: r.cumple,
    lotePeorDesv: r.lotePeorDesv
  }));

  return {
    esCompatible,
    bloqueadoPorCliente,
    bloqueadoPorVariedad,
    bloqueadoPorDesviaciones,
    motivoBloqueo,
    mismoCliente,
    clienteComun,
    mismaVariedad,
    variedadComun,
    variedadValida,
    totalLotes: filas.length,
    lotesEvaluados,
    resumenParametros,
    desviacionesPorParametro,
    alertas,
    recomendacionOperativa
  };
}

/**
 * Evalúa si un lote candidato es apto para unirse a un batch en construcción
 */
export function evaluarCandidatoParaBatch(
  candidato: Lote,
  analisisH?: AnalisisHumedo,
  presec?: Presecado,
  filasActuales: LoteProgramacionFila[] = [],
  cfg: CriteriosUnionLotesConfig = obtenerCriteriosUnionGuardados()
): {
  esApto: boolean;
  esMismoCliente: boolean;
  motivoRechazo?: string;
  clienteEsperado?: string;
  desviacionesMax?: number;
  parametrosCriticosExcedidos: string[];
} {
  const candidatoData = extraerDatosCalidadLote(candidato, analisisH, presec);
  const clienteCandidato = (candidato.CLIENTE || "").trim();

  if (filasActuales.length === 0) {
    return {
      esApto: true,
      esMismoCliente: true,
      parametrosCriticosExcedidos: []
    };
  }

  const clienteBatch = (filasActuales[0].cliente || "").trim();
  const esMismoCliente = clienteCandidato.toLowerCase() === clienteBatch.toLowerCase();

  if (cfg.exigirMismoCliente && !esMismoCliente) {
    return {
      esApto: false,
      esMismoCliente: false,
      clienteEsperado: clienteBatch,
      motivoRechazo: `Cliente diferente. El batch actual pertenece a "${clienteBatch}" y este lote es de "${clienteCandidato}".`,
      parametrosCriticosExcedidos: ["CLIENTE_DIFERENTE"]
    };
  }

  const variedadBatch = (filasActuales[0].variedad || "").trim();
  const variedadCandidato = (candidato.VARIEDAD || "").trim();
  const esMismaVariedad = variedadBatch.toLowerCase() === variedadCandidato.toLowerCase();
  const algunaEsMezcla = variedadBatch.toLowerCase().includes("mezcla") || variedadBatch.toLowerCase().includes("mix") ||
                         variedadCandidato.toLowerCase().includes("mezcla") || variedadCandidato.toLowerCase().includes("mix");

  if (cfg.exigirMismaVariedad && !esMismaVariedad && !algunaEsMezcla) {
    return {
      esApto: false,
      esMismoCliente,
      clienteEsperado: clienteBatch,
      motivoRechazo: `Variedad diferente ("${variedadCandidato}" vs "${variedadBatch}"). Solo se permite unir variedades distintas si están descritas como MEZCLA.`,
      parametrosCriticosExcedidos: ["VARIEDAD_DISTINTA"]
    };
  }

  // Evaluar simulación uniendo este lote
  const filaSimulada: LoteProgramacionFila = {
    loteId: candidato.LOTE_ID,
    cliente: clienteCandidato,
    variedad: candidato.VARIEDAD || "TINAJONES",
    sacos: candidato.SACOS || 100,
    peso: candidato.PESO_KG || 5000,
    sacProg: candidato.SACOS || 100,
    pesoProg: candidato.PESO_KG || 5000,
    ph: candidatoData.ph || 14.0,
    desv: candidatoData.desv || 1.2,
    blInt: candidatoData.blInt || 21.5,
    blBlanco: candidatoData.blBlanco || 39.0,
    qi: candidatoData.qi || 7.5,
    qb: candidatoData.qb || 15.5,
    tt: candidatoData.tt || 1.5,
    tp: candidatoData.tp || 2.5,
    tpun: candidatoData.tpun || 4.5,
    m: candidatoData.m || 0.8,
    triz: candidatoData.triz || 1.8,
    condicion: candidatoData.condicion || "APTO"
  };

  const resultadoSim = evaluarCompatibilidadBatch([...filasActuales, filaSimulada], cfg);
  const excedidos = resultadoSim.resumenParametros.filter(r => !r.cumple).map(r => r.label);

  return {
    esApto: resultadoSim.esCompatible,
    esMismoCliente,
    clienteEsperado: clienteBatch,
    motivoRechazo: excedidos.length > 0 ? `Desviación excedida en: ${excedidos.join(", ")}` : undefined,
    desviacionesMax: Math.max(...resultadoSim.resumenParametros.map(r => r.maxDesviacion), 0),
    parametrosCriticosExcedidos: excedidos
  };
}

/**
 * Busca lotes semejantes y compatibles del mismo cliente en los lotes disponibles
 */
export function buscarLotesSemejantesMismoCliente(
  loteReferencia: LoteProgramacionFila,
  lotesDisponibles: Lote[],
  analisisHumedos: AnalisisHumedo[],
  presecados: Presecado[],
  lotesYaEnBatch: string[] = [],
  cfg: CriteriosUnionLotesConfig = obtenerCriteriosUnionGuardados()
): {
  lote: Lote;
  analisisH?: AnalisisHumedo;
  presec?: Presecado;
  scoreSimilitud: number; // 0 a 100 (100 = idéntico)
  porcentajeSimilitud: number;
  humedad: number;
  tt: number;
  esCompatible: boolean;
  diferenciaHumedad: number;
  diferenciaTotalTrizado: number;
  diferenciaQuebrado: number;
  parametrosDesviados: string[];
}[] {
  const clienteRef = (loteReferencia.cliente || "").trim().toLowerCase();
  const variedadRef = (loteReferencia.variedad || "").trim().toLowerCase();
  const refEsMezcla = variedadRef.includes("mezcla") || variedadRef.includes("mix");

  const candidatos = lotesDisponibles.filter(l => {
    if (lotesYaEnBatch.includes(l.LOTE_ID)) return false;
    if (l.LOTE_ID === loteReferencia.loteId) return false;
    const cliLote = (l.CLIENTE || "").trim().toLowerCase();
    // REGLA 1: Solo del mismo cliente
    if (cliLote !== clienteRef) return false;

    // REGLA 2: Misma variedad salvo que sea mezcla
    if (cfg.exigirMismaVariedad) {
      const varLote = (l.VARIEDAD || "").trim().toLowerCase();
      const loteEsMezcla = varLote.includes("mezcla") || varLote.includes("mix");
      if (varLote !== variedadRef && !refEsMezcla && !loteEsMezcla) {
        return false;
      }
    }

    return true;
  });

  const resultados = candidatos.map(l => {
    const ah = analisisHumedos.find(a => a.LOTE_ID === l.LOTE_ID);
    const ps = presecados.find(p => p.LOTE_ID === l.LOTE_ID);
    const data = extraerDatosCalidadLote(l, ah, ps);

    const difHum = Number(Math.abs((data.ph || 14.0) - loteReferencia.ph).toFixed(2));
    const difTT = Number(Math.abs((data.tt || 1.5) - loteReferencia.tt).toFixed(2));
    const difQI = Number(Math.abs((data.qi || 7.5) - loteReferencia.qi).toFixed(2));
    const difQB = Number(Math.abs((data.qb || 15.5) - loteReferencia.qb).toFixed(2));
    const difBlInt = Number(Math.abs((data.blInt || 21.5) - loteReferencia.blInt).toFixed(2));
    const difM = Number(Math.abs((data.m || 0.8) - loteReferencia.m).toFixed(2));

    const paramsDesviados: string[] = [];
    if (difHum > cfg.toleranciaHumedad) paramsDesviados.push(`Humedad (Δ=${difHum} > ${cfg.toleranciaHumedad})`);
    if (difTT > cfg.toleranciaTotalTrizado) paramsDesviados.push(`T.T (Δ=${difTT} > ${cfg.toleranciaTotalTrizado})`);
    if (difQI > cfg.toleranciaQuebradoInt) paramsDesviados.push(`Q.I (Δ=${difQI} > ${cfg.toleranciaQuebradoInt})`);
    if (difQB > cfg.toleranciaQuebradoBlanco) paramsDesviados.push(`Q.B (Δ=${difQB} > ${cfg.toleranciaQuebradoBlanco})`);
    if (difBlInt > cfg.toleranciaBlancuraInt) paramsDesviados.push(`Bl. Int (Δ=${difBlInt} > ${cfg.toleranciaBlancuraInt})`);
    if (difM > cfg.toleranciaManchado) paramsDesviados.push(`Mancha (Δ=${difM} > ${cfg.toleranciaManchado})`);

    // Calcular score de similitud (0 a 100)
    // Penalización por diferencia de parámetros normalizada
    const penHum = Math.min(40, (difHum / cfg.toleranciaHumedad) * 20);
    const penTT = Math.min(25, (difTT / cfg.toleranciaTotalTrizado) * 15);
    const penQ = Math.min(20, (difQI / cfg.toleranciaQuebradoInt) * 10);
    const penBl = Math.min(15, (difBlInt / cfg.toleranciaBlancuraInt) * 10);

    const score = Math.max(0, Number((100 - penHum - penTT - penQ - penBl).toFixed(1)));

    return {
      lote: l,
      analisisH: ah,
      presec: ps,
      scoreSimilitud: score,
      porcentajeSimilitud: score,
      humedad: Number(data.ph || 14.0),
      tt: Number(data.tt || 1.5),
      esCompatible: paramsDesviados.length === 0,
      diferenciaHumedad: difHum,
      diferenciaTotalTrizado: difTT,
      diferenciaQuebrado: difQI,
      parametrosDesviados: paramsDesviados
    };
  });

  // Ordenar por mayor score de similitud
  return resultados.sort((a, b) => b.scoreSimilitud - a.scoreSimilitud);
}

/**
 * Función adaptadora para evaluar la compatibilidad de una lista de lotes en un proceso de unión
 * a partir de filas o datos crudos de lote.
 */
export function evaluarUnionLotesEnBatch(
  lotesFilas: any[],
  cfg: CriteriosUnionLotesConfig = obtenerCriteriosUnionGuardados()
): EvaluacionUnionBatchResult {
  const filasAdaptadas: LoteProgramacionFila[] = (lotesFilas || []).map(item => ({
    loteId: item.loteId || item.LOTE_ID || "LOTE",
    cliente: item.cliente || item.CLIENTE || "Cliente General",
    variedad: item.variedad || item.VARIEDAD || "VALOR",
    sacos: Number(item.sacos || item.SACOS || 300),
    peso: Number(item.pesoKg || item.PESO_KG || 15000),
    sacProg: Number(item.sacos || item.SACOS || 300),
    pesoProg: Number(item.pesoKg || item.PESO_KG || 15000),
    ph: Number(item.hum ?? item.ph ?? item.HUM ?? 14.0),
    desv: Number(item.desv ?? item.DESV ?? 1.2),
    blInt: Number(item.bli ?? item.blInt ?? 21.5),
    blBlanco: Number(item.blp ?? item.blBlanco ?? 39.0),
    qi: Number(item.qi ?? item.QI ?? 7.5),
    qb: Number(item.qb ?? item.QB ?? 15.5),
    tt: Number(item.tt ?? item.TT ?? 1.5),
    tp: Number(item.tp ?? item.TP ?? 2.5),
    tpun: Number(item.tpun ?? 4.5),
    m: Number(item.m ?? item.M ?? 0.8),
    triz: Number(item.tz ?? item.triz ?? 1.8),
    condicion: "APTO"
  }));

  const res = evaluarCompatibilidadBatch(filasAdaptadas, cfg);

  // Asegurar que soporte parametro 'humedad' además de 'PH' para el visor del modal
  const desvExtra = [...res.desviacionesPorParametro];
  const itemPH = desvExtra.find(d => d.parametro === "PH");
  if (itemPH && !desvExtra.some(d => d.parametro === "humedad")) {
    desvExtra.push({ ...itemPH, parametro: "humedad" });
  }

  return {
    ...res,
    desviacionesPorParametro: desvExtra
  };
}

