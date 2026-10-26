import { AnalisisHumedo, Lote, Presecado } from "../types";
import { formatLoteCode } from "./formatLoteCode";
import { getDeletedLotesTombstones, isV200BatchReference } from "./localDB";

export interface LoteProgramacionFila {
  loteId: string;
  cliente: string;
  variedad: string;
  sacos: number;
  peso: number;
  sacProg: number;
  pesoProg: number;
  ph: number; // Humedad
  desv: number; // Desviación de humedad
  blInt: number; // Blancura Integral
  blBlanco: number; // Blancura de Pulido (B. PULIDO)
  qi: number; // Quebrado Integral
  qb: number; // Quebrado Blanco
  tt: number; // Total Trizado / Tizón
  tp: number; // Trizado Parcial / Puntilla
  tpun: number; // Tiza / Puntilla
  m: number; // Manchado
  triz: number; // Trizado
  condicion: "APTO" | "OBSERVADO" | "NO APTO";
  tipoServicio?: TipoServicioProgramacion;
}

export type TipoServicioProgramacion = 
  | "VAPORIZADO Y SECADO EN APIT"
  | "VAPORIZADO EN APIT Y SECADO EN GINSAC"
  | "VAPORIZADO EN APIT Y SECADO EN PAMPA"
  | "SECADO EN APIT";

export interface TipoServicioInfo {
  id: TipoServicioProgramacion;
  label: string;
  descripcion: string;
  vaporizado: string;
  secado: string;
  badgeClass: string;
  colorBorder: string;
  iconTag: string;
}

export const TIPOS_SERVICIO_PROGRAMACION: TipoServicioInfo[] = [
  {
    id: "VAPORIZADO Y SECADO EN APIT",
    label: "VAPORIZADO Y SECADO EN APIT",
    descripcion: "Proceso completo en línea industrial APIT (Autoclave APIT + Secadora APIT).",
    vaporizado: "APIT",
    secado: "APIT",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    colorBorder: "border-amber-500",
    iconTag: "⚡"
  },
  {
    id: "VAPORIZADO EN APIT Y SECADO EN GINSAC",
    label: "VAPORIZADO EN APIT Y SECADO EN GINSAC",
    descripcion: "Vaporizado en Autoclave APIT y secado derivado a línea industrial GINSAC.",
    vaporizado: "APIT",
    secado: "GINSAC",
    badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
    colorBorder: "border-cyan-500",
    iconTag: "🏭"
  },
  {
    id: "VAPORIZADO EN APIT Y SECADO EN PAMPA",
    label: "VAPORIZADO EN APIT Y SECADO EN PAMPA",
    descripcion: "Vaporizado en APIT y secado natural / extendido en Pampa para lotes especiales.",
    vaporizado: "APIT",
    secado: "PAMPA",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    colorBorder: "border-emerald-500",
    iconTag: "🌾"
  },
  {
    id: "SECADO EN APIT",
    label: "SECADO EN APIT",
    descripcion: "Solo servicio de secado en torre industrial APIT (sin etapa de vaporizado).",
    vaporizado: "NO_APLICA",
    secado: "APIT",
    badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/50",
    colorBorder: "border-indigo-500",
    iconTag: "☀️"
  }
];

export interface PromediosBatchCalidad {
  ph: number;
  desv: number;
  blInt: number;
  blBlanco: number;
  qi: number;
  qb: number;
  tt: number;
  tp: number;
  tpun: number;
  m: number;
  triz: number;
  condicion: "APTO" | "OBSERVADO" | "NO APTO";
}

export interface ParametrosOperativosBatch {
  presionBar: number; // DE. (ej: 0.35, 0.45, 0.50)
  velExclusa: number; // V. EXCL. (ej: 4, 6)
  tiempoReposoMin: number; // T. REPOSO (ej: 60, 40)
  tempSecadoC: number; // TEMP. SECADO (ej: 75, 80)
  justificacion?: string;
  // Soporte oficial de Planta para 1° y 2° Pase de Inyección de Vapor
  modalidadPases?: "1_PASE" | "2_PASES";
  presionPase1?: number;
  presionPase2?: number;
  tiempoReposoPase1?: number; // min
  tiempoReposoPase2?: number; // min
  velExclusaPase1?: number;
  velExclusaPase2?: number;
}

export interface ProgramacionBatchOficial {
  id: string;
  caso: string; // ej: "CASO 1", "CASO 2"
  fecha: string; // ej: "2026-08-18"
  turno: "DIA" | "NOCHE";
  batch: string; // ej: "V350", "V351", "V352"
  tipoServicio?: TipoServicioProgramacion;
  filasLote: LoteProgramacionFila[];
  clientePrincipal: string;
  variedadPrincipal: string;
  totalSacosProg: number;
  pesoTotalKg: number;
  promedios: PromediosBatchCalidad;
  parametrosRecomendadosIA: ParametrosOperativosBatch;
  parametrosDeterminados: ParametrosOperativosBatch;
  observacion: string;
  estado: "PROGRAMADO" | "EN PROCESO" | "VAPORIZADO" | "FINALIZADO" | "OBSERVADO";
  updatedAt?: string;
  originalBatch?: string;
  originalId?: string;
}

const STORAGE_KEY_PROGRAMACIONES_OFICIALES = "molino_programaciones_batch_oficiales_v4";

/**
 * Extrae o estima los valores de calidad de un lote cruzando con análisis húmedo y presecado
 */
export function extraerDatosCalidadLote(
  lote: Lote,
  analisisH?: AnalisisHumedo,
  presec?: Presecado
): Partial<LoteProgramacionFila> {
  const hum = Number(analisisH?.HUMEDADES ?? lote.HUM ?? 14.0);
  const desv = Number(analisisH?.OTROS ?? 1.2);
  const blInt = Number(analisisH?.["B.INTEGRAL"] ?? presec?.["B.INTEGRAL"] ?? 21.5);
  const blBlanco = Number(analisisH?.["B. PULIDO"] ?? presec?.["B. PULIDO"] ?? 39.0);
  const qi = Number(analisisH?.QI ?? presec?.QI ?? 7.5);
  const qb = Number(analisisH?.QB ?? presec?.QB ?? 15.5);
  const tt = Number(analisisH?.TT ?? presec?.TT ?? 1.5);
  const tp = Number(analisisH?.TP ?? presec?.TP ?? 2.5);
  const tpun = Number(analisisH?.["T. PUNT."] ?? presec?.["T. PUNT."] ?? 4.5);
  const m = Number(analisisH?.M ?? presec?.M ?? 0.8);
  const triz = Number(analisisH?.TZ ?? presec?.TZ ?? 1.8);

  const condicion: "APTO" | "OBSERVADO" | "NO APTO" = 
    hum > 26 ? "OBSERVADO" : "APTO";

  const variedadExtraida = (
    lote.VARIEDAD ||
    (lote as any).variedad ||
    (analisisH as any)?.VARIEDAD ||
    (analisisH as any)?.variedad ||
    (presec as any)?.VARIEDAD ||
    (presec as any)?.variedad ||
    "TINAJONES"
  ).toString().trim().toUpperCase();

  const clienteExtraido = (
    lote.CLIENTE ||
    (lote as any).cliente ||
    (analisisH as any)?.CLIENTE ||
    (presec as any)?.CLIENTE ||
    "Sin Cliente"
  ).toString().trim();

  return {
    loteId: lote.LOTE_ID,
    cliente: clienteExtraido,
    variedad: variedadExtraida,
    sacos: lote.SACOS || 100,
    peso: lote.PESO_KG || (lote.SACOS ? lote.SACOS * 50 : 8000),
    sacProg: lote.SACOS || 100,
    pesoProg: lote.PESO_KG || (lote.SACOS ? lote.SACOS * 50 : 8000),
    ph: Number(hum.toFixed(1)),
    desv: Number(desv.toFixed(1)),
    blInt: Number(blInt.toFixed(1)),
    blBlanco: Number(blBlanco.toFixed(1)),
    qi: Number(qi.toFixed(1)),
    qb: Number(qb.toFixed(1)),
    tt: Number(tt.toFixed(1)),
    tp: Number(tp.toFixed(1)),
    tpun: Number(tpun.toFixed(1)),
    m: Number(m.toFixed(1)),
    triz: Number(triz.toFixed(1)),
    condicion
  };
}

/**
 * Calcula los promedios ponderados por peso programado de todas las variables
 */
export function calcularPromediosPonderadosBatch(filas: LoteProgramacionFila[]): {
  totalSacosProg: number;
  pesoTotalKg: number;
  promedios: PromediosBatchCalidad;
} {
  if (!filas || filas.length === 0) {
    return {
      totalSacosProg: 0,
      pesoTotalKg: 0,
      promedios: {
        ph: 0,
        desv: 0,
        blInt: 0,
        blBlanco: 0,
        qi: 0,
        qb: 0,
        tt: 0,
        tp: 0,
        tpun: 0,
        m: 0,
        triz: 0,
        condicion: "APTO"
      }
    };
  }

  let totalSacos = 0;
  let totalPeso = 0;

  let sumPH = 0;
  let sumDesv = 0;
  let sumBlInt = 0;
  let sumBlBlanco = 0;
  let sumQI = 0;
  let sumQB = 0;
  let sumTT = 0;
  let sumTP = 0;
  let sumTPUN = 0;
  let sumM = 0;
  let sumTRIZ = 0;
  let hayObservados = false;
  let hayNoAptos = false;

  for (const fila of filas) {
    const p = fila.pesoProg > 0 ? fila.pesoProg : (fila.sacProg * 50);
    const s = fila.sacProg;

    totalSacos += s;
    totalPeso += p;

    sumPH += (fila.ph * p);
    sumDesv += (fila.desv * p);
    sumBlInt += (fila.blInt * p);
    sumBlBlanco += (fila.blBlanco * p);
    sumQI += (fila.qi * p);
    sumQB += (fila.qb * p);
    sumTT += (fila.tt * p);
    sumTP += (fila.tp * p);
    sumTPUN += (fila.tpun * p);
    sumM += (fila.m * p);
    sumTRIZ += (fila.triz * p);

    if (fila.condicion === "OBSERVADO") hayObservados = true;
    if (fila.condicion === "NO APTO") hayNoAptos = true;
  }

  const pesoDiv = totalPeso > 0 ? totalPeso : 1;

  const condicionFinal: "APTO" | "OBSERVADO" | "NO APTO" = 
    hayNoAptos ? "NO APTO" : hayObservados ? "OBSERVADO" : "APTO";

  return {
    totalSacosProg: totalSacos,
    pesoTotalKg: totalPeso,
    promedios: {
      ph: Number((sumPH / pesoDiv).toFixed(1)),
      desv: Number((sumDesv / pesoDiv).toFixed(1)),
      blInt: Number((sumBlInt / pesoDiv).toFixed(1)),
      blBlanco: Number((sumBlBlanco / pesoDiv).toFixed(1)),
      qi: Number((sumQI / pesoDiv).toFixed(1)),
      qb: Number((sumQB / pesoDiv).toFixed(1)),
      tt: Number((sumTT / pesoDiv).toFixed(1)),
      tp: Number((sumTP / pesoDiv).toFixed(1)),
      tpun: Number((sumTPUN / pesoDiv).toFixed(1)),
      m: Number((sumM / pesoDiv).toFixed(1)),
      triz: Number((sumTRIZ / pesoDiv).toFixed(1)),
      condicion: condicionFinal
    }
  };
}

export interface ErrorValidacionSacosLote {
  loteId: string;
  sacProg: number;
  sacosIngreso: number;
  pesoProg: number;
  pesoIngreso: number;
  mensaje: string;
}

/**
 * REGLA ESTRICTA DE PLANTA:
 * Calcula el saldo disponible real (en sacos y kg) de un lote para un batch/programación específico,
 * descontando lo consumido/programado en TODOS los demás batches y programaciones oficiales.
 */
export function calcularSaldoDisponibleLoteParaBatch(
  loteId: string,
  lotes: any[] = [],
  programaciones: ProgramacionBatchOficial[] = [],
  batches: any[] = [],
  batchLotes: any[] = [],
  currentEditingProgId?: string | null,
  currentBatchCode?: string | null
): {
  originalSacos: number;
  originalPesoKg: number;
  sacosUsadosEnOtros: number;
  pesoUsadoEnOtros: number;
  sacosDisponibles: number;
  pesoDisponibleKg: number;
  detalleUso: { batch: string; sacos: number; pesoKg: number }[];
} {
  if (!loteId) {
    return {
      originalSacos: 0,
      originalPesoKg: 0,
      sacosUsadosEnOtros: 0,
      pesoUsadoEnOtros: 0,
      sacosDisponibles: 0,
      pesoDisponibleKg: 0,
      detalleUso: []
    };
  }

  const cleanId = loteId.trim().toUpperCase();
  const normId = formatLoteCode(loteId);
  const matchesId = (candidate?: string) => {
    if (!candidate) return false;
    const cUpper = candidate.toString().trim().toUpperCase();
    if (cUpper === cleanId) return true;
    const cNorm = formatLoteCode(cUpper);
    return Boolean(normId && cNorm && normId === cNorm);
  };

  const loteObj = lotes.find(l => matchesId(l?.LOTE_ID || l?.loteId || l?.id));
  const rawSacos = Number(loteObj?.SACOS ?? loteObj?.CANT_SACOS ?? (loteObj as any)?.["Sacos"]) || 0;
  const rawPeso = Number(loteObj?.PESO_KG ?? loteObj?.PESO_NETO ?? (loteObj as any)?.["Peso (kg)"]) || 0;
  const originalSacos = rawSacos > 0 ? rawSacos : (rawPeso > 0 ? Math.max(1, Math.round(rawPeso / 50)) : 0);
  const originalPesoKg = rawPeso > 0 ? rawPeso : (originalSacos * 50);

  // Registro de uso por batch (evitar contar dos veces el mismo batch en programaciones y batchLotes)
  const usageByBatch = new Map<string, { batch: string; sacos: number; pesoKg: number }>();

  const currentCode = (currentBatchCode || "").trim().toUpperCase();
  const currentProgId = (currentEditingProgId || "").trim();

  // 1. Recorrer programaciones oficiales existentes
  for (const prog of programaciones) {
    if (!prog) continue;
    const progCode = (prog.batch || prog.id || "").trim().toUpperCase();
    const isCurrent = (currentProgId && prog.id === currentProgId) || (currentCode && progCode === currentCode);
    if (isCurrent) continue;

    if (Array.isArray(prog.filasLote)) {
      for (const f of prog.filasLote) {
        if (matchesId(f?.loteId || (f as any)?.LOTE_ID)) {
          const sac = Number(f.sacProg ?? f.sacos) || 0;
          const pes = Number(f.pesoProg ?? f.peso) || (sac * 50);
          usageByBatch.set(progCode, { batch: progCode, sacos: sac, pesoKg: pes });
        }
      }
    }
  }

  // 2. Recorrer batches/batchLotes (evitando duplicar lo que ya esté en programaciones)
  for (const bl of batchLotes) {
    if (matchesId(bl?.LOTE_ID || bl?.loteId)) {
      const bObj = batches.find(b => b.BATCH_ID === bl.BATCH_ID || b.CORRELATIVO === bl.BATCH_ID);
      const bCode = (bObj?.CORRELATIVO || bl.BATCH_ID || "").trim().toUpperCase();
      const isCurrent = (currentCode && bCode === currentCode) || (currentProgId && bl.BATCH_ID === currentProgId);
      if (isCurrent) continue;

      if (!usageByBatch.has(bCode)) {
        const sac = Number(bl.SACOS) || 0;
        const pes = Number(bl.PESO_KG) || (sac * 50);
        usageByBatch.set(bCode, { batch: bCode, sacos: sac, pesoKg: pes });
      }
    }
  }

  let sacosUsadosEnOtros = 0;
  let pesoUsadoEnOtros = 0;
  const detalleUso: { batch: string; sacos: number; pesoKg: number }[] = [];

  for (const item of usageByBatch.values()) {
    sacosUsadosEnOtros += item.sacos;
    pesoUsadoEnOtros += item.pesoKg;
    detalleUso.push(item);
  }

  const sacosDisponibles = Math.max(0, originalSacos - sacosUsadosEnOtros);
  const pesoDisponibleKg = Math.max(0, originalPesoKg - pesoUsadoEnOtros);

  return {
    originalSacos,
    originalPesoKg,
    sacosUsadosEnOtros,
    pesoUsadoEnOtros,
    sacosDisponibles,
    pesoDisponibleKg,
    detalleUso
  };
}

/**
 * REGLA ESTRICTA DE PLANTA:
 * La cantidad de sacos programados no puede exceder al saldo disponible (sacos pendientes reales) del lote.
 * El peso programado no puede exceder al saldo de peso disponible.
 */
export function validarSacosYPesoLotesProgramacion(
  filas: LoteProgramacionFila[],
  lotes: any[] = [],
  programaciones: ProgramacionBatchOficial[] = [],
  batches: any[] = [],
  batchLotes: any[] = [],
  currentEditingProgId?: string | null,
  currentBatchCode?: string | null
): {
  valido: boolean;
  errores: ErrorValidacionSacosLote[];
} {
  const errores: ErrorValidacionSacosLote[] = [];

  for (const fila of filas) {
    if (lotes && lotes.length > 0) {
      const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
        fila.loteId,
        lotes,
        programaciones,
        batches,
        batchLotes,
        currentEditingProgId,
        currentBatchCode
      );

      const maxSacos = saldoInfo.sacosDisponibles;
      const maxPeso = saldoInfo.pesoDisponibleKg;

      if (fila.sacProg > maxSacos) {
        const detalleStr = saldoInfo.detalleUso.length > 0 
          ? ` (ya se registraron ${saldoInfo.detalleUso.map(u => `${u.sacos} en ${u.batch}`).join(", ")})` 
          : "";
        errores.push({
          loteId: fila.loteId,
          sacProg: fila.sacProg,
          sacosIngreso: maxSacos,
          pesoProg: fila.pesoProg,
          pesoIngreso: maxPeso,
          mensaje: `No se puede colocar ${fila.sacProg} sacos del lote ${fila.loteId} porque solo quedan ${maxSacos} sacos disponibles${detalleStr}.`
        });
      } else if (maxPeso > 0 && fila.pesoProg > maxPeso + 0.1) {
        errores.push({
          loteId: fila.loteId,
          sacProg: fila.sacProg,
          sacosIngreso: maxSacos,
          pesoProg: fila.pesoProg,
          pesoIngreso: maxPeso,
          mensaje: `El peso programado (${fila.pesoProg.toLocaleString()} kg) excede el saldo disponible (${maxPeso.toLocaleString()} kg) del lote ${fila.loteId}.`
        });
      }
    } else {
      const maxSacos = fila.sacos > 0 ? fila.sacos : 0;
      const maxPeso = fila.peso > 0 ? fila.peso : (maxSacos * 50);

      if (maxSacos > 0 && fila.sacProg > maxSacos) {
        errores.push({
          loteId: fila.loteId,
          sacProg: fila.sacProg,
          sacosIngreso: maxSacos,
          pesoProg: fila.pesoProg,
          pesoIngreso: maxPeso,
          mensaje: `La cantidad de sacos programados (${fila.sacProg}) no puede exceder a la cantidad disponible (${maxSacos}) del lote ${fila.loteId}.`
        });
      } else if (maxPeso > 0 && fila.pesoProg > maxPeso + 0.1) {
        errores.push({
          loteId: fila.loteId,
          sacProg: fila.sacProg,
          sacosIngreso: maxSacos,
          pesoProg: fila.pesoProg,
          pesoIngreso: maxPeso,
          mensaje: `El peso programado (${fila.pesoProg.toLocaleString()} kg) no puede exceder al peso disponible (${maxPeso.toLocaleString()} kg) del lote ${fila.loteId}.`
        });
      }
    }
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * REGLAS TÉCNICAS OFICIALES DE LA PLANTA:
 * 1. PRESIÓN (bar): según Variedad y Humedad Promedio P(H)
 * 2. VELOCIDAD DE ESCLUSA: según Presión (a mayor presión, mayor velocidad de esclusa)
 * 3. TIEMPO EN REPOSO: según Blancura Integral, Blancura Pulido, Humedad, Temp inicial y Añejamiento
 * 4. TEMPERATURA DE SECADO (°C): según Humedad y Variedad
 */
export function recomendarParametrosOperativos(
  promedios: PromediosBatchCalidad,
  variedad: string = "TINAJONES"
): ParametrosOperativosBatch {
  const ph = promedios.ph;
  const blInt = promedios.blInt;
  const blBlanco = promedios.blBlanco;
  const varUpper = (variedad || "").toUpperCase();

  let presionBar = 0.45;
  let velExclusa = 6;
  let tiempoReposoMin = 40;
  let tempSecadoC = 80;
  const justificaciones: string[] = [];

  // 1. DETERMINACIÓN DE PRESIÓN (bar)
  if (ph < 14.5) {
    presionBar = 0.35;
    justificaciones.push(`Humedad baja (${ph}%) requiere presión suave (0.35 bar) para evitar sobrecocción.`);
  } else if (ph >= 14.5 && ph <= 16.5) {
    if (varUpper.includes("TINAJONES")) {
      presionBar = 0.40;
    } else {
      presionBar = 0.45;
    }
    justificaciones.push(`Humedad estándar (${ph}%) en variedad ${variedad} opera a presión balanceada (${presionBar} bar).`);
  } else if (ph > 16.5) {
    presionBar = 0.50;
    justificaciones.push(`Humedad alta (${ph}%) requiere mayor presión de vapor (${presionBar} bar) para penetración homogénea.`);
  }

  // 2. DETERMINACIÓN DE VELOCIDAD DE ESCLUSA (RPM / Hz)
  // Regla: A mayor presión, mayor velocidad de esclusa
  if (presionBar <= 0.38) {
    velExclusa = 4;
    justificaciones.push(`Presión suave de ${presionBar} bar se sincroniza con velocidad de esclusa 4.`);
  } else if (presionBar <= 0.45) {
    velExclusa = 6;
    justificaciones.push(`Presión estándar de ${presionBar} bar opera con velocidad de esclusa 6.`);
  } else {
    velExclusa = 6;
    justificaciones.push(`Presión de ${presionBar} bar opera a velocidad de esclusa 6.`);
  }

  // 3. DETERMINACIÓN DE TIEMPO DE REPOSO (minutos)
  // Regla: Se toma en cuenta Bl. Integral, Bl. Pulido, Humedad, Añejamiento
  if (ph < 14.5 || blBlanco >= 38.5) {
    tiempoReposoMin = 60;
    justificaciones.push(`Blancura alta (${blBlanco}) y humedad baja requieren reposo extendido de 60 min para hidratación uniforme.`);
  } else {
    tiempoReposoMin = 40;
    justificaciones.push(`Condición estándar de blancura (${blInt} Int / ${blBlanco} Pul) y humedad (${ph}%) establece reposo de 40 min.`);
  }

  // 4. TEMPERATURA DE SECADO (°C)
  if (ph < 14.5) {
    tempSecadoC = 75;
  } else {
    tempSecadoC = 80;
  }

  // 5. DETERMINACIÓN DE MODALIDAD Y PARÁMETROS DE 1° Y 2° PASE
  // Regla técnica de planta:
  // Lotes con humedad baja (< 14.5%) o riesgo de trizado elevado (> 1.8%) se benefician de DOBLE PASE
  // (1° Acondicionamiento suave para evitar choque térmico ➔ 2° Cocción/Gelatinización uniforme).
  const modalidadPases: "1_PASE" | "2_PASES" = (ph < 14.5 || (promedios.triz ?? 0) > 1.8) ? "2_PASES" : "1_PASE";

  // Parámetros calculados para 1° Pase (Precalentamiento / Acondicionamiento gradual)
  const presionPase1 = presionBar <= 0.35 ? Number(presionBar.toFixed(2)) : Number((presionBar - 0.05).toFixed(2));
  const tiempoReposoPase1 = 10; // 10 min de relax térmico
  const velExclusaPase1 = velExclusa;

  // Parámetros calculados para 2° Pase (Cocción y gelatinización principal)
  const presionPase2 = presionBar;
  const tiempoReposoPase2 = tiempoReposoMin;
  const velExclusaPase2 = velExclusa;

  if (modalidadPases === "2_PASES") {
    justificaciones.push(`Humedad baja o trizado sugiere DOBLE PASE: 1° Pase (${presionPase1} bar / ${tiempoReposoPase1} min) + 2° Pase (${presionPase2} bar / ${tiempoReposoPase2} min).`);
  }

  return {
    presionBar,
    velExclusa,
    tiempoReposoMin,
    tempSecadoC,
    modalidadPases,
    presionPase1,
    presionPase2,
    tiempoReposoPase1,
    tiempoReposoPase2,
    velExclusaPase1,
    velExclusaPase2,
    justificacion: justificaciones.join(" ")
  };
}

/**
 * Genera el siguiente correlativo oficial de Batch
 */
export function generarSiguienteCorrelativoV(existentes: string[] = []): string {
  let maxNum = 200;
  for (const item of existentes) {
    const match = (item || "").match(/V(\d+)/i);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n !== 200 && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `V${maxNum + 1}`;
}

/**
 * Extrae el número secuencial de un identificador de Batch / Caso.
 * Ignora códigos de vaporizado puros (ej: V350, V-01) y sufijos de parte (ej: PARTE 2).
 */
export function extraerNumeroBatch(val?: string | number | null): number | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;

  // Ignorar códigos de autoclave/vaporizado puros como V350, V-01, V350-2
  if (/^V\s*[-_]?\s*\d+(?:\s*-\s*\d+)?$/i.test(s)) {
    return null;
  }

  // Si tiene anotaciones heredadas tipo "1 (PARTE 2)", representaba correlativo progresivo (1 + 1 = 2)
  const matchConParte = s.match(/(\d+)\s*\(?PARTE\s*(\d+)\)?/i);
  if (matchConParte) {
    const base = parseInt(matchConParte[1], 10);
    const parte = parseInt(matchConParte[2], 10);
    if (!isNaN(base) && !isNaN(parte) && parte > 1) {
      return base + (parte - 1);
    }
  }

  // Quitar anotaciones como "(PARTE 2)" para no confundir la parte con el número de batch
  const sinParte = s.replace(/\(?PARTE\s*\d+\)?/gi, "").trim();

  // Buscar coincidencia con prefijos típicos: BATCH 2, CASO 2, BACTH 02, o solo número
  const matchPrefijo = sinParte.match(/(?:BATCH|BACTH|CASO|B|#)?\s*(\d+)/i);
  if (matchPrefijo) {
    const num = parseInt(matchPrefijo[1], 10);
    if (!isNaN(num) && num > 0 && num < 100000) {
      return num;
    }
  }

  const matchCualquiera = sinParte.match(/(\d+)/);
  if (matchCualquiera) {
    const num = parseInt(matchCualquiera[1], 10);
    if (!isNaN(num) && num > 0 && num < 100000) {
      return num;
    }
  }

  return null;
}

/**
 * Genera el siguiente número progresivo de BATCH (ej. Batch 1 -> Batch 2 -> Batch 3...)
 * siguiendo de forma progresiva con el anterior y considerando el máximo de todos los batches existentes.
 */
export function generarSiguienteNombreBatch(
  existentesCasos: string[] = [],
  ultimoCaso?: string,
  _codigoVaporizadoSiguiente?: string
): string {
  let maxNum = 0;

  const registrar = (val?: string | number | null) => {
    const n = extraerNumeroBatch(val);
    if (n !== null && n > maxNum) {
      maxNum = n;
    }
  };

  // 1. Escanear todos los casos existentes provistos
  if (Array.isArray(existentesCasos)) {
    for (const item of existentesCasos) {
      registrar(item);
    }
  }

  // 2. Escanear último caso si fue provisto
  if (ultimoCaso) {
    registrar(ultimoCaso);
  }

  // 3. Fallback inteligente y exhaustivo sobre almacenamiento local
  if (typeof window !== "undefined" && window.localStorage) {
    for (const k of [STORAGE_KEY_PROGRAMACIONES_OFICIALES, "molino_programaciones_batch_oficiales_v3", "programaciones_batch_oficial_v1"]) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: any) => {
              registrar(p?.caso);
              registrar(p?.id);
            });
          }
        }
      } catch {
        // ignore
      }
    }

    try {
      const rawDb = localStorage.getItem("arroz_apit_local_db_v9_clean");
      if (rawDb) {
        const parsedDb = JSON.parse(rawDb);
        if (Array.isArray(parsedDb?.batchesVaporizado)) {
          parsedDb.batchesVaporizado.forEach((b: any) => {
            registrar(b?.CASO);
            registrar(b?.NOMBRE_LOTE);
            registrar(b?.BATCH_ID);
          });
        }
      }
    } catch {
      // ignore
    }
  }

  if (maxNum > 0) {
    return String(maxNum + 1);
  }

  return "1";
}

/**
 * Calcula el siguiente número secuencial de Batch a partir de las listas de programaciones y batches.
 */
export function calcularSiguienteNumeroBatch(
  programaciones?: ProgramacionBatchOficial[],
  batches?: any[]
): string {
  const casos: string[] = [];
  if (Array.isArray(programaciones)) {
    programaciones.forEach(p => {
      if (p?.caso) casos.push(String(p.caso));
    });
  }
  if (Array.isArray(batches)) {
    batches.forEach(b => {
      if (b?.CASO) casos.push(String(b.CASO));
      if (b?.NOMBRE_LOTE) casos.push(String(b.NOMBRE_LOTE));
      if (b?.BATCH_ID) casos.push(String(b.BATCH_ID));
    });
  }
  return generarSiguienteNombreBatch(casos);
}

/**
 * Casos iniciales modelo exactamente extraídos de las 2 imágenes del usuario
 */
export const PROGRAMACIONES_INICIALES_MODELO: ProgramacionBatchOficial[] = [];

export function cargarProgramacionesOficiales(): ProgramacionBatchOficial[] {
  try {
    const pMap = new Map<string, ProgramacionBatchOficial>();
    const addProg = (p: any) => {
      if (!p) return;
      const id = (p.id || "").toString().trim();
      if (id === "PROG-BATCH-200" || id === "PROG-BATCH-201") return;
      if (isV200BatchReference(p.batch) || isV200BatchReference(p.id) || isV200BatchReference(p.caso)) return;
      const key = (p.batch || p.id || "").toString().trim().toUpperCase().replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "");
      if (!key || isV200BatchReference(key)) return;
      const existing = pMap.get(key);
      if (!existing) {
        pMap.set(key, p);
      } else {
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const pTime = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
        if (existingTime >= pTime) {
          pMap.set(key, { ...p, ...existing });
        } else {
          pMap.set(key, { ...existing, ...p });
        }
      }
    };

    for (const kName of [STORAGE_KEY_PROGRAMACIONES_OFICIALES, "molino_programaciones_batch_oficiales_v3", "programaciones_batch_oficial_v1"]) {
      const saved = localStorage.getItem(kName);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) parsed.forEach(addProg);
        } catch {
          // ignore
        }
      }
    }

    const closedBatchCodes = new Set<string>();
    const closedLoteCodes = new Set<string>();
    const existingLoteCodes = new Set<string>();
    let hasLoadedDbLotes = false;

    const rawDb = localStorage.getItem("arroz_apit_local_db_v9_clean");
    if (rawDb) {
      try {
        const parsedDb = JSON.parse(rawDb);
        const addClosedCode = (code?: string) => {
          if (!code) return;
          const raw = code.toString().trim().toUpperCase();
          closedBatchCodes.add(raw);
          const norm = raw.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
          if (norm) closedBatchCodes.add(`NORM_${norm}`);
        };

        if (Array.isArray(parsedDb?.batchesVaporizado)) {
          parsedDb.batchesVaporizado.forEach((b: any) => {
            const est = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
            if (est === "CERRADO" || est === "VAPORIZADO" || est === "COMPLETADO" || Boolean(b?.cerroCompletamente)) {
              addClosedCode(b?.BATCH_ID);
              addClosedCode(b?.CORRELATIVO);
            }
          });
        }
        if (Array.isArray(parsedDb?.controlVaporizado)) {
          parsedDb.controlVaporizado.forEach((c: any) => {
            const est = (c?.ESTADO_PROCESO || "").toString().trim().toUpperCase();
            if (Boolean(c?.liquidado) || Boolean(c?.cerroCompletamente) || est === "LIQUIDADO" || est === "VAPORIZADO" || est === "CERRADO" || est === "FINALIZADO") {
              addClosedCode(c?.BATCH_ID);
              addClosedCode(c?.CORRELATIVO);
            }
          });
        }
        if (Array.isArray(parsedDb?.lotes)) {
          hasLoadedDbLotes = true;
          parsedDb.lotes.forEach((l: any) => {
            const norm = formatLoteCode(l?.LOTE_ID);
            if (norm) existingLoteCodes.add(norm);
            const est = (l?.ESTADO_LOTE || "").toString().trim().toUpperCase();
            if (est === "CERRADO" || est === "VAPORIZADO") {
              if (norm) closedLoteCodes.add(norm);
            }
          });
        }
        if (Array.isArray(parsedDb?.programacionesOficiales)) {
          parsedDb.programacionesOficiales.forEach(addProg);
        }
      } catch {
        // ignore
      }
    }

    const tombstones = getDeletedLotesTombstones();
    const isExcludedLote = (rawCode?: string) => {
      if (!rawCode) return false;
      const norm = formatLoteCode(rawCode);
      if (!norm) return false;
      // Excluir si el lote fue explícitamente eliminado o si ya cerró/vaporizó
      if (tombstones.has(norm) || closedLoteCodes.has(norm)) return true;
      return false;
    };

    const isClosedBatchProg = (p: ProgramacionBatchOficial) => {
      const pEst = (p?.estado || "").toString().trim().toUpperCase();
      if (pEst === "CERRADO" || pEst === "VAPORIZADO" || pEst === "COMPLETADO") return true;
      const bCode = (p?.batch || "").toString().trim().toUpperCase();
      const pId = (p?.id || "").toString().trim().toUpperCase();
      if (bCode && closedBatchCodes.has(bCode)) return true;
      if (pId && closedBatchCodes.has(pId)) return true;
      const normB = bCode.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
      const normP = pId.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
      if (normB && closedBatchCodes.has(`NORM_${normB}`)) return true;
      if (normP && closedBatchCodes.has(`NORM_${normP}`)) return true;
      return false;
    };

    // Mantener siempre todas las programaciones y lotes subidos
    const filtradas = Array.from(pMap.values())
      .filter(p => !isClosedBatchProg(p) && !isV200BatchReference(p?.batch) && !isV200BatchReference(p?.id))
      .map(p => {
        if (Array.isArray(p.filasLote)) {
          p.filasLote = p.filasLote.filter((f: any) => !isExcludedLote(f?.loteId || f?.LOTE_ID));
        }
        if (Array.isArray((p as any).lotes)) {
          (p as any).lotes = (p as any).lotes.filter((l: any) => !isExcludedLote(typeof l === "string" ? l : (l?.LOTE_ID || l?.loteId)));
        }
        return p;
      });

    return ordenarProgramacionesDeArribaHaciaAbajo(filtradas);
  } catch (e) {
    console.warn("Error cargando programaciones oficiales desde localStorage", e);
  }
  return [];
}

/**
 * Extrae clave numérica de secuencia de un correlativo de Batch
 * para distribuir la programación de arriba hacia abajo (el primer lote/batch a procesar arriba y va bajando).
 */
export function parseBatchSequenceKey(batchStr?: string, casoStr?: string): { mainNum: number; subNum: number } {
  const raw = (batchStr || "").toString().trim().toUpperCase();
  const vMatch = raw.match(/V\s*(\d+)(?:\s*-\s*(\d+))?/i);
  if (vMatch) {
    return {
      mainNum: parseInt(vMatch[1], 10),
      subNum: vMatch[2] ? parseInt(vMatch[2], 10) : 0
    };
  }
  const numMatch = raw.match(/(\d+)(?:\s*-\s*(\d+))?$/);
  if (numMatch) {
    return {
      mainNum: parseInt(numMatch[1], 10),
      subNum: numMatch[2] ? parseInt(numMatch[2], 10) : 0
    };
  }
  const casoMatch = (casoStr || "").toString().match(/(\d+)/);
  return {
    mainNum: casoMatch ? parseInt(casoMatch[1], 10) : 999999,
    subNum: 0
  };
}

/**
 * Ordena las programaciones de arriba hacia abajo:
 * El primer batch/lote a procesar va arriba (menor correlativo / fecha más temprana / Turno Día antes de Noche)
 * y va bajando progresivamente.
 */
export function ordenarProgramacionesDeArribaHaciaAbajo(
  progs: ProgramacionBatchOficial[],
  prioridadMap?: Map<string, { posicion?: number }>
): ProgramacionBatchOficial[] {
  if (!Array.isArray(progs)) return [];
  return [...progs]
    .map(p => {
      if (prioridadMap && Array.isArray(p.filasLote) && p.filasLote.length > 1) {
        const filasOrdenadas = [...p.filasLote].sort((a, b) => {
          const posA = prioridadMap.get((a.loteId || "").trim().toLowerCase())?.posicion ?? 999999;
          const posB = prioridadMap.get((b.loteId || "").trim().toLowerCase())?.posicion ?? 999999;
          return posA - posB;
        });
        return { ...p, filasLote: filasOrdenadas };
      }
      return p;
    })
    .sort((a, b) => {
      const keyA = parseBatchSequenceKey(a.batch || a.id, a.caso);
      const keyB = parseBatchSequenceKey(b.batch || b.id, b.caso);
      if (keyA.mainNum !== keyB.mainNum) {
        return keyA.mainNum - keyB.mainNum;
      }
      if (keyA.subNum !== keyB.subNum) {
        return keyA.subNum - keyB.subNum;
      }
      const fechaCmp = (a.fecha || "").localeCompare(b.fecha || "");
      if (fechaCmp !== 0) return fechaCmp;
      const turnoA = a.turno === "DIA" ? 0 : 1;
      const turnoB = b.turno === "DIA" ? 0 : 1;
      if (turnoA !== turnoB) return turnoA - turnoB;
      return (a.caso || "").localeCompare(b.caso || "", undefined, { numeric: true });
    });
}

export function guardarProgramacionesOficiales(progs: ProgramacionBatchOficial[]): void {
  try {
    const sinV200 = (progs || []).filter(p => !isV200BatchReference(p?.batch) && !isV200BatchReference(p?.id));
    const ordenadas = ordenarProgramacionesDeArribaHaciaAbajo(sinV200);
    const serialized = JSON.stringify(ordenadas);
    localStorage.setItem(STORAGE_KEY_PROGRAMACIONES_OFICIALES, serialized);
    localStorage.setItem("molino_programaciones_batch_oficiales_v3", serialized);
    localStorage.setItem("programaciones_batch_oficial_v1", serialized);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: ordenadas }));
    }
  } catch (e) {
    console.error("Error guardando programaciones oficiales", e);
  }
}

/**
 * REGLA ESTRICTA: LOS LOTES NO SE PUEDEN REPETIR EN BATCHES INDEPENDIENTES
 * Verifica si un lote ya está asignado en alguna programación oficial o batch activo.
 * Permite que los saldos/sobrantes de lotes pertenecientes a un grupo de unión
 * puedan fraccionarse y continuar asignándose a los sub-batches del mismo proceso macro.
 */
export function obtenerInfoLoteEnBatches(
  loteId: string,
  programaciones: ProgramacionBatchOficial[] = [],
  batches: any[] = [],
  currentEditingProgId?: string | null,
  currentEditingBatchCode?: string | null,
  currentParentProcess?: string | null,
  originalBatchCode?: string | null,
  lotes?: any[],
  batchLotes?: any[]
): {
  estaProgramado: boolean;
  batchCodigo?: string;
  caso?: string;
  fecha?: string;
  esMismoBatch: boolean;
  esMismoProcesoUnion?: boolean;
  tieneSaldoDisponible?: boolean;
  sacosDisponibles?: number;
  pesoDisponibleKg?: number;
} {
  if (!loteId) return { estaProgramado: false, esMismoBatch: false };
  const cleanId = loteId.trim().toLowerCase();
  const normId = formatLoteCode(loteId);
  const matchesId = (candidate?: string) => {
    if (!candidate) return false;
    const cClean = candidate.toString().trim().toLowerCase();
    if (cClean === cleanId) return true;
    const cNorm = formatLoteCode(candidate);
    return Boolean(normId && cNorm && normId === cNorm);
  };

  // REGLA CRÍTICA DE PLANTA:
  // Si se ha procesado o programado solo una parte de un lote (ej. C08427),
  // la otra parte (saldo remanente de sacos y kg) DEBE QUEDAR DISPONIBLE
  // para seguir programándose o uniéndose con otros lotes.
  if (Array.isArray(lotes) && lotes.length > 0) {
    const saldoInfo = calcularSaldoDisponibleLoteParaBatch(
      loteId,
      lotes,
      programaciones,
      batches,
      batchLotes || [],
      currentEditingProgId,
      currentEditingBatchCode
    );

    if (saldoInfo.sacosDisponibles > 0) {
      return {
        estaProgramado: false,
        tieneSaldoDisponible: true,
        sacosDisponibles: saldoInfo.sacosDisponibles,
        pesoDisponibleKg: saldoInfo.pesoDisponibleKg,
        batchCodigo: saldoInfo.detalleUso[0]?.batch || "",
        caso: `Saldo remanente disponible (${saldoInfo.sacosDisponibles} sacos / ${(saldoInfo.pesoDisponibleKg / 1000).toFixed(1)} TN)`,
        esMismoBatch: false,
        esMismoProcesoUnion: true
      };
    }
  }

  const currentMacro = currentParentProcess || (currentEditingBatchCode ? currentEditingBatchCode.split("-")[0] : null);

  // 1. Revisar en programaciones oficiales
  for (const prog of programaciones) {
    if (!prog || isV200BatchReference(prog.batch) || isV200BatchReference(prog.id)) continue;
    const esMismo = (currentEditingProgId && prog.id === currentEditingProgId) ||
                    (originalBatchCode && prog.batch === originalBatchCode) ||
                    (currentEditingBatchCode && prog.batch === currentEditingBatchCode);

    const inFilas = Array.isArray(prog.filasLote) && prog.filasLote.some(f => matchesId(f?.loteId || (f as any)?.LOTE_ID));
    const inLotes = Array.isArray((prog as any).lotes) && (prog as any).lotes.some((l: any) => matchesId(l?.LOTE_ID || l?.loteId || l));

    if (inFilas || inLotes) {
      const progMacro = prog.batch ? prog.batch.split("-")[0] : null;
      const esMismoProceso = currentMacro && progMacro && currentMacro.toUpperCase() === progMacro.toUpperCase();

      if (esMismo || esMismoProceso) {
        return {
          estaProgramado: false,
          batchCodigo: prog.batch || "",
          caso: prog.caso || "CASO",
          fecha: prog.fecha,
          esMismoBatch: true,
          esMismoProcesoUnion: true
        };
      }

      return {
        estaProgramado: true,
        batchCodigo: prog.batch || "",
        caso: prog.caso || "CASO",
        fecha: prog.fecha,
        esMismoBatch: false
      };
    }
  }

  // 2. Revisar en batches generales
  for (const b of batches) {
    if (!b) continue;
    const esMismo = Boolean(
      (currentEditingProgId && (b.ID === currentEditingProgId || b.BATCH_ID === currentEditingProgId)) ||
      (originalBatchCode && (b.CORRELATIVO === originalBatchCode || b.BATCH_ID === originalBatchCode)) ||
      (currentEditingBatchCode && (b.CORRELATIVO === currentEditingBatchCode || b.BATCH_ID === currentEditingBatchCode))
    );
    const batchMacro = b.PROCESO_PADRE || (b.CORRELATIVO ? b.CORRELATIVO.split("-")[0] : null);
    const esMismoProceso = currentMacro && batchMacro && currentMacro.toUpperCase() === batchMacro.toUpperCase();
    const esLoteUnionDelGrupo = Array.isArray(b.LOTES_UNION) && b.LOTES_UNION.some((lid: any) => matchesId(typeof lid === "string" ? lid : lid?.LOTE_ID));

    const assignedList = b.lotes || b.LOTES_ASIGNADOS || b.lotesAsignados || [];
    const hasLot =
      (Array.isArray(assignedList) && assignedList.some((l: any) => matchesId(typeof l === "string" ? l : (l?.LOTE_ID || l?.loteId)))) ||
      matchesId(b.LOTE_ID) ||
      esLoteUnionDelGrupo;

    if (hasLot) {
      if (esMismo || esMismoProceso) {
        return {
          estaProgramado: false,
          batchCodigo: b.CORRELATIVO || b.BATCH_ID,
          caso: b.EQUIPO || "Sub-Batch de Unión",
          fecha: b.FECHA_PROGRAMADA,
          esMismoBatch: true,
          esMismoProcesoUnion: true
        };
      }

      // Si el lote tiene saldo pendiente no procesado y es del mismo macro-proceso
      return {
        estaProgramado: !esMismoProceso,
        batchCodigo: b.CORRELATIVO || b.BATCH_ID,
        caso: b.EQUIPO || "Batch Activo",
        fecha: b.FECHA_PROGRAMADA,
        esMismoBatch: Boolean(esMismo),
        esMismoProcesoUnion: Boolean(esMismoProceso)
      };
    }
  }

  return { estaProgramado: false, esMismoBatch: false };
}


