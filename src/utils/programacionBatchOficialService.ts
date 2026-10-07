import { AnalisisHumedo, Lote, Presecado } from "../types";

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
}

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
  batch: string; // ej: "V200", "V201", "V202-1", "V202-2"
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
}

const STORAGE_KEY_PROGRAMACIONES_OFICIALES = "molino_programaciones_batch_oficiales_v3";

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

  return {
    loteId: lote.LOTE_ID,
    cliente: lote.CLIENTE || "Sin Cliente",
    variedad: lote.VARIEDAD || "TINAJONES",
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
  const loteObj = lotes.find(l => (l.LOTE_ID || "").trim().toUpperCase() === cleanId);
  const originalSacos = Number(loteObj?.SACOS) || 0;
  const originalPesoKg = Number(loteObj?.PESO_KG) || (originalSacos * 50);

  // Registro de uso por batch (evitar contar dos veces el mismo batch en programaciones y batchLotes)
  const usageByBatch = new Map<string, { batch: string; sacos: number; pesoKg: number }>();

  const currentCode = (currentBatchCode || "").trim().toUpperCase();
  const currentProgId = (currentEditingProgId || "").trim();

  // 1. Recorrer programaciones oficiales existentes
  for (const prog of programaciones) {
    const progCode = (prog.batch || prog.id || "").trim().toUpperCase();
    const isCurrent = (currentProgId && prog.id === currentProgId) || (currentCode && progCode === currentCode);
    if (isCurrent) continue;

    if (Array.isArray(prog.filasLote)) {
      for (const f of prog.filasLote) {
        if ((f.loteId || "").trim().toUpperCase() === cleanId) {
          const sac = Number(f.sacProg ?? f.sacos) || 0;
          const pes = Number(f.pesoProg ?? f.peso) || (sac * 50);
          usageByBatch.set(progCode, { batch: progCode, sacos: sac, pesoKg: pes });
        }
      }
    }
  }

  // 2. Recorrer batches/batchLotes (evitando duplicar lo que ya esté en programaciones)
  for (const bl of batchLotes) {
    if ((bl.LOTE_ID || "").trim().toUpperCase() === cleanId) {
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
 * Genera el siguiente correlativo oficial de Batch (ej: V200, V201, V202...)
 */
export function generarSiguienteCorrelativoV(existentes: string[] = []): string {
  let maxNum = 199;
  for (const item of existentes) {
    const match = (item || "").match(/V(\d+)/i);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `V${maxNum + 1}`;
}

/**
 * Casos iniciales modelo exactamente extraídos de las 2 imágenes del usuario
 */
export const PROGRAMACIONES_INICIALES_MODELO: ProgramacionBatchOficial[] = [];

export function cargarProgramacionesOficiales(): ProgramacionBatchOficial[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PROGRAMACIONES_OFICIALES);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(p => {
            const id = (p?.id || "").trim();
            return id !== "PROG-BATCH-200" && id !== "PROG-BATCH-201";
          })
          .map(p => {
            // Garantizar consistencia para C08434 en V200
            const b = (p.batch || p.id || "").toUpperCase();
            if (Array.isArray(p.filasLote)) {
              p.filasLote.forEach((f: any) => {
                if ((f.loteId || "").toUpperCase() === "C08434") {
                  if (b.includes("V200-1")) {
                    f.sacProg = 90;
                    f.sacos = 90;
                    f.pesoProg = 4500;
                    f.peso = 4500;
                  } else if (b.includes("V200-2")) {
                    f.sacProg = 333;
                    f.sacos = 333;
                    f.pesoProg = 16650;
                    f.peso = 16650;
                  } else if (b.includes("V200-3")) {
                    f.sacProg = 30;
                    f.sacos = 30;
                    f.pesoProg = 1500;
                    f.peso = 1500;
                  }
                }
              });
            }
            return p;
          });
      }
    }
  } catch (e) {
    console.warn("Error cargando programaciones oficiales desde localStorage", e);
  }
  return [];
}

export function guardarProgramacionesOficiales(progs: ProgramacionBatchOficial[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROGRAMACIONES_OFICIALES, JSON.stringify(progs));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: progs }));
    }
  } catch (e) {
    console.error("Error guardando programaciones oficiales", e);
  }
}

/**
 * REGLA ESTRICTA: LOS LOTES NO SE PUEDEN REPETIR EN BATCHES INDEPENDIENTES
 * Verifica si un lote ya está asignado en alguna programación oficial o batch activo.
 * Permite que los saldos/sobrantes de lotes pertenecientes a un grupo de unión
 * (como C08434 en V200) puedan fraccionarse y continuar asignándose a los sub-batches
 * del mismo proceso macro (V200-1, V200-2, V200-3).
 */
export function obtenerInfoLoteEnBatches(
  loteId: string,
  programaciones: ProgramacionBatchOficial[] = [],
  batches: any[] = [],
  currentEditingProgId?: string | null,
  currentEditingBatchCode?: string | null,
  currentParentProcess?: string | null
): {
  estaProgramado: boolean;
  batchCodigo?: string;
  caso?: string;
  fecha?: string;
  esMismoBatch: boolean;
  esMismoProcesoUnion?: boolean;
} {
  if (!loteId) return { estaProgramado: false, esMismoBatch: false };
  const cleanId = loteId.trim().toLowerCase();

  const currentMacro = currentParentProcess || (currentEditingBatchCode ? currentEditingBatchCode.split("-")[0] : null);

  // 1. Revisar en programaciones oficiales
  for (const prog of programaciones) {
    const esMismo = (currentEditingProgId && prog.id === currentEditingProgId) ||
                    (currentEditingBatchCode && prog.batch === currentEditingBatchCode);

    if (prog.filasLote && prog.filasLote.some(f => (f.loteId || "").trim().toLowerCase() === cleanId)) {
      const progMacro = prog.batch ? prog.batch.split("-")[0] : null;
      const esMismoProceso = currentMacro && progMacro && currentMacro.toUpperCase() === progMacro.toUpperCase();

      if (esMismo || esMismoProceso) {
        return {
          estaProgramado: false,
          batchCodigo: prog.batch || "V200",
          caso: prog.caso || "CASO",
          fecha: prog.fecha,
          esMismoBatch: Boolean(esMismo),
          esMismoProcesoUnion: true
        };
      }

      return {
        estaProgramado: true,
        batchCodigo: prog.batch || "V200",
        caso: prog.caso || "CASO",
        fecha: prog.fecha,
        esMismoBatch: Boolean(esMismo)
      };
    }
  }

  // 2. Revisar en batches generales
  for (const b of batches) {
    const batchId = b.BATCH_ID || b.CORRELATIVO;
    const esMismo = (currentEditingBatchCode && (b.CORRELATIVO === currentEditingBatchCode || b.BATCH_ID === currentEditingBatchCode));
    const batchMacro = b.PROCESO_PADRE || (b.CORRELATIVO ? b.CORRELATIVO.split("-")[0] : null);
    const esMismoProceso = currentMacro && batchMacro && currentMacro.toUpperCase() === batchMacro.toUpperCase();
    const esLoteUnionDelGrupo = Array.isArray(b.LOTES_UNION) && b.LOTES_UNION.some((lid: string) => (lid || "").trim().toLowerCase() === cleanId);

    const hasLot = (b.lotes && Array.isArray(b.lotes) && b.lotes.some((l: any) => ((l.LOTE_ID || l.loteId || "")).trim().toLowerCase() === cleanId)) ||
                   (esLoteUnionDelGrupo && (b.CORRELATIVO === currentEditingBatchCode || b.BATCH_ID === currentEditingBatchCode));

    if (hasLot) {
      if (esMismo || esMismoProceso) {
        return {
          estaProgramado: false,
          batchCodigo: b.CORRELATIVO || b.BATCH_ID,
          caso: b.EQUIPO || "Sub-Batch de Unión",
          fecha: b.FECHA_PROGRAMADA,
          esMismoBatch: Boolean(esMismo),
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


