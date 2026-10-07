import { Lote } from "../types";

export type CategoriaLote = "PENDIENTE" | "EN_PROCESO" | "PROCESADO";

// Definición estricta de los estados que componen cada categoría operativa
// NOTA CRÍTICA: Todo lote que se programe ('PROGRAMADO', 'EN PROCESO', etc.) sale de la lista de pendientes.
export const ESTADOS_PENDIENTES = [
  "INGRESADO",
  "ANALIZADO",
  "APTO",
  "OBSERVADO",
  "EN_COLA",
  "RECEPCIONADO",
  "POR_ANALIZAR"
] as const;

export const ESTADOS_EN_PROCESO = [
  "PROGRAMADO",
  "EN PROCESO",
  "EN_PROCESO",
  "VAPORIZADO",
  "EN REPOSO",
  "EN SECADO",
  "EN EJECUCION",
  "MACERACION",
  "SECADO",
  "PARCIALMENTE PROCESADO"
] as const;

export const ESTADOS_PROCESADOS = [
  "ANALISIS_FINAL",
  "EVALUADO",
  "CERRADO",
  "TERMINADO",
  "PROCESADO",
  "FINALIZADO",
  "ARCHIVADO"
] as const;

/**
 * Determina la categoría macro de un lote basado en su estado operativo
 */
export function obtenerCategoriaLote(estado?: string): CategoriaLote {
  if (!estado) return "PENDIENTE";
  const estNormalizado = estado.trim().toUpperCase();

  if (ESTADOS_EN_PROCESO.some(e => e === estNormalizado)) {
    return "EN_PROCESO";
  }

  if (ESTADOS_PROCESADOS.some(e => e === estNormalizado)) {
    return "PROCESADO";
  }

  // Por defecto, cualquier lote nuevo, analizado, programado o en observación es PENDIENTE
  return "PENDIENTE";
}

/**
 * Retorna si un lote está pendiente de procesar (en tolva/silo esperando vaporizado/molienda)
 */
export function esLotePendiente(loteOrEstado: Lote | string | undefined): boolean {
  const estado = typeof loteOrEstado === "object" ? loteOrEstado?.ESTADO_LOTE : loteOrEstado;
  return obtenerCategoriaLote(estado) === "PENDIENTE";
}

/**
 * Retorna si un lote está activamente en proceso
 */
export function esLoteEnProceso(loteOrEstado: Lote | string | undefined): boolean {
  const estado = typeof loteOrEstado === "object" ? loteOrEstado?.ESTADO_LOTE : loteOrEstado;
  return obtenerCategoriaLote(estado) === "EN_PROCESO";
}

/**
 * Retorna si un lote ya fue procesado
 */
export function esLoteProcesado(loteOrEstado: Lote | string | undefined): boolean {
  const estado = typeof loteOrEstado === "object" ? loteOrEstado?.ESTADO_LOTE : loteOrEstado;
  return obtenerCategoriaLote(estado) === "PROCESADO";
}

/**
 * Clasifica una lista de lotes en las 3 categorías operativas
 */
export function clasificarLotes(lotes: Lote[] = []) {
  const pendientes = lotes.filter(l => esLotePendiente(l));
  const enProceso = lotes.filter(l => esLoteEnProceso(l));
  const procesados = lotes.filter(l => esLoteProcesado(l));

  const totalSacosPendientes = pendientes.reduce((acc, l) => acc + (l.SACOS || 0), 0);
  const totalTnPendientes = Number((pendientes.reduce((acc, l) => acc + (l.PESO_KG || (l.SACOS ? l.SACOS * 50 : 0)), 0) / 1000).toFixed(1));

  const totalSacosEnProceso = enProceso.reduce((acc, l) => acc + (l.SACOS || 0), 0);
  const totalTnEnProceso = Number((enProceso.reduce((acc, l) => acc + (l.PESO_KG || (l.SACOS ? l.SACOS * 50 : 0)), 0) / 1000).toFixed(1));

  const totalSacosProcesados = procesados.reduce((acc, l) => acc + (l.SACOS || 0), 0);
  const totalTnProcesados = Number((procesados.reduce((acc, l) => acc + (l.PESO_KG || (l.SACOS ? l.SACOS * 50 : 0)), 0) / 1000).toFixed(1));

  return {
    pendientes,
    enProceso,
    procesados,
    total: lotes.length,
    totales: {
      pendientes: { cantidad: pendientes.length, sacos: totalSacosPendientes, tn: totalTnPendientes },
      enProceso: { cantidad: enProceso.length, sacos: totalSacosEnProceso, tn: totalTnEnProceso },
      procesados: { cantidad: procesados.length, sacos: totalSacosProcesados, tn: totalTnProcesados }
    }
  };
}

/**
 * Metadatos visuales y descriptivos para cada categoría
 */
export function obtenerMetaCategoria(cat: CategoriaLote) {
  switch (cat) {
    case "PENDIENTE":
      return {
        id: "PENDIENTE",
        label: "Pendientes de Procesar",
        shortLabel: "Pendientes",
        badgeColor: "bg-amber-950/80 text-amber-300 border-amber-800/80",
        pillActiveColor: "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20",
        indicatorColor: "bg-amber-400",
        borderColor: "border-amber-700/60",
        cardBg: "bg-amber-950/20 border-amber-900/40",
        descripcion: "Lotes en tolva/silo esperando programación y vaporizado. Son los únicos sujetos a Priorización."
      };
    case "EN_PROCESO":
      return {
        id: "EN_PROCESO",
        label: "En Proceso",
        shortLabel: "En Proceso",
        badgeColor: "bg-orange-950/80 text-orange-300 border-orange-800/80",
        pillActiveColor: "bg-orange-500 text-slate-950 shadow-lg shadow-orange-500/20",
        indicatorColor: "bg-orange-400 animate-pulse",
        borderColor: "border-orange-700/60",
        cardBg: "bg-orange-950/20 border-orange-900/40",
        descripcion: "Lotes activos en autoclave, fase de inyección de vapor, reposo térmico o secado columnar."
      };
    case "PROCESADO":
      return {
        id: "PROCESADO",
        label: "Lotes Procesados",
        shortLabel: "Procesados",
        badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
        pillActiveColor: "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20",
        indicatorColor: "bg-emerald-400",
        borderColor: "border-emerald-700/60",
        cardBg: "bg-emerald-950/20 border-emerald-900/40",
        descripcion: "Lotes con ciclo industrial completado, análisis seco final registrado y evaluación de índice de éxito."
      };
  }
}

export interface BloqueoEliminacionInfo {
  bloqueado: boolean;
  motivo: string;
  detalle?: string;
  tipoBloqueo?: "PROGRAMADO" | "EN_PROCESO" | "PROCESADO";
}

/**
 * REGLA ESTRICTA DE OPERACIÓN:
 * Si un lote ya tiene programación o está en proceso (o procesado), NO se debe permitir su eliminación.
 * Solo se pueden eliminar lotes en recepción/pendientes que no hayan sido programados ni ingresados al proceso operativo.
 */
export function verificarBloqueoEliminacionLote(
  loteOrId: Lote | string | undefined,
  contexto?: {
    lote?: Lote;
    lotes?: Lote[];
    batchLotes?: { BATCH_ID: string; LOTE_ID: string }[];
    batches?: any[];
    programaciones?: any[];
  }
): BloqueoEliminacionInfo {
  if (!loteOrId) {
    return { bloqueado: false, motivo: "" };
  }

  let loteObj: Lote | undefined;
  let loteId = "";

  if (typeof loteOrId === "object") {
    loteObj = loteOrId;
    loteId = (loteOrId.LOTE_ID || "").trim();
  } else {
    loteId = (loteOrId || "").trim();
    if (contexto?.lotes) {
      loteObj = contexto.lotes.find(l => (l.LOTE_ID || "").trim().toUpperCase() === loteId.toUpperCase());
    }
  }

  if (contexto?.lote && !loteObj) {
    loteObj = contexto.lote;
  }

  const cleanId = loteId.trim().toUpperCase();

  // 1. Revisar estado directo del Lote
  if (loteObj) {
    const estadoRaw = (loteObj.ESTADO_LOTE || (loteObj as any).ESTADO || "").trim().toUpperCase();
    
    if (estadoRaw === "PROGRAMADO") {
      return {
        bloqueado: true,
        tipoBloqueo: "PROGRAMADO",
        motivo: "El lote ya tiene programación asignada",
        detalle: "Estado: PROGRAMADO. Los lotes programados no pueden ser eliminados."
      };
    }

    if (ESTADOS_EN_PROCESO.some(e => e === estadoRaw)) {
      return {
        bloqueado: true,
        tipoBloqueo: "EN_PROCESO",
        motivo: "El lote se encuentra actualmente en proceso operativo",
        detalle: `Estado operativo: ${estadoRaw}. No se permite eliminar lotes en ejecución.`
      };
    }

    if (ESTADOS_PROCESADOS.some(e => e === estadoRaw)) {
      return {
        bloqueado: true,
        tipoBloqueo: "PROCESADO",
        motivo: "El lote ya completó su ciclo de procesamiento en planta",
        detalle: `Estado: ${estadoRaw}. Los lotes procesados forman parte del historial y no se pueden eliminar.`
      };
    }

    const loteBatchId = (loteObj as any)?.BATCH_ID || (loteObj as any)?.batchId;
    if (loteBatchId && typeof loteBatchId === "string" && loteBatchId.trim().length > 0) {
      return {
        bloqueado: true,
        tipoBloqueo: "PROGRAMADO",
        motivo: `El lote está vinculado al Batch ${loteBatchId}`,
        detalle: `Asignado al Batch ${loteBatchId}.`
      };
    }
  }

  // 2. Revisar si está en Programaciones Oficiales (vía contexto o localStorage)
  let progs: any[] = contexto?.programaciones || [];
  if (progs.length === 0 && typeof window !== "undefined" && window.localStorage) {
    try {
      const saved = localStorage.getItem("programaciones_batch_oficial_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) progs = parsed;
      }
    } catch {
      // ignore
    }
  }

  if (Array.isArray(progs) && progs.length > 0) {
    for (const prog of progs) {
      if (prog && Array.isArray(prog.filasLote)) {
        const match = prog.filasLote.find((f: any) => (f?.loteId || "").trim().toUpperCase() === cleanId);
        if (match) {
          return {
            bloqueado: true,
            tipoBloqueo: "PROGRAMADO",
            motivo: `El lote está incluido en la programación oficial del Batch ${prog.batch || prog.id}`,
            detalle: `Programación: ${prog.batch || prog.id} (${prog.fecha || "Fecha no especificada"}).`
          };
        }
      }
      if (prog && Array.isArray(prog.lotes)) {
        const match = prog.lotes.find((l: any) => (l?.LOTE_ID || l?.loteId || "").trim().toUpperCase() === cleanId);
        if (match) {
          return {
            bloqueado: true,
            tipoBloqueo: "PROGRAMADO",
            motivo: `El lote está asignado a la programación del Batch ${prog.batch || prog.id}`,
            detalle: `Batch ${prog.batch || prog.id}.`
          };
        }
      }
    }
  }

  // 3. Revisar en batchLotes (vía contexto o localDB si está guardado en localStorage)
  let bLotes = contexto?.batchLotes || [];
  if (bLotes.length === 0 && typeof window !== "undefined" && window.localStorage) {
    try {
      const savedDb = localStorage.getItem("arroz_apit_local_db_v2");
      if (savedDb) {
        const parsed = JSON.parse(savedDb);
        if (Array.isArray(parsed?.batchLotes)) {
          bLotes = parsed.batchLotes;
        }
      }
    } catch {
      // ignore
    }
  }

  if (Array.isArray(bLotes) && bLotes.length > 0) {
    const match = bLotes.find((bl: any) => (bl?.LOTE_ID || "").trim().toUpperCase() === cleanId);
    if (match) {
      return {
        bloqueado: true,
        tipoBloqueo: "PROGRAMADO",
        motivo: `El lote está asignado al Batch ${match.BATCH_ID}`,
        detalle: `Asignado en Batch ${match.BATCH_ID}.`
      };
    }
  }

  return {
    bloqueado: false,
    motivo: ""
  };
}
