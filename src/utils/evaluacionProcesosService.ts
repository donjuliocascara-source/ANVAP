import { 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  ControlVaporizado, 
  AnalisisVaporizado, 
  Presecado, 
  AnalisisHumedo, 
  AnalisisSeco,
  BatchEvaluacionComparativa,
  RecetaVaporizadoMaestra,
  ResultadoCoccionExterno
} from "../types";
import { buscarCoccionParaBatch } from "./integracionCoccionService";
import { localDB } from "./localDB";

const RECETAS_STORAGE_KEY = "recetas_vaporizado_maestras_v1";

/**
 * Normaliza un código de batch para cruce flexible
 */
function normalizeBatchKey(val?: string): string {
  if (!val) return "";
  return val
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^(BATCH|BAT)[\s\-_]+/i, "");
}

/**
 * Formatea el código de modalidad al texto oficial del REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO:
 * - "1 Solo Pase (Húmedo)"
 * - "2 Pases (Seco - Anti - Trizado)"
 */
export function formatearModalidadVaporizado(modalidad?: string): string {
  if (!modalidad) return "1 Solo Pase (Húmedo)";
  const upper = modalidad.toString().trim().toUpperCase();
  if (upper.includes("2") || upper.includes("SECO") || upper.includes("ANTI")) {
    return "2 Pases (Seco - Anti - Trizado)";
  }
  return "1 Solo Pase (Húmedo)";
}

/**
 * Busca el registro de Control de Vaporizado (REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO)
 * tanto en los controles pasados por props como en localDB y en borradores de localStorage,
 * garantizando que la modalidad ingresada se refleje siempre en tiempo real.
 */
export function resolverControlVaporizadoBatch(
  batchId?: string,
  correlativo?: string,
  controlesProp: ControlVaporizado[] = []
): ControlVaporizado | undefined {
  const rawId = (batchId || "").trim().toUpperCase();
  const rawCorr = (correlativo || rawId).trim().toUpperCase();
  const normId = normalizeBatchKey(rawId);
  const normCorr = normalizeBatchKey(rawCorr);
  if (!rawId && !rawCorr) return undefined;

  const matchesCtrl = (c?: Partial<ControlVaporizado> | null): boolean => {
    if (!c) return false;
    const cId = (c.BATCH_ID || "").trim().toUpperCase();
    const cCorr = (c.CORRELATIVO || "").trim().toUpperCase();
    const cCod = (c.datosIngreso?.codigo || "").trim().toUpperCase();
    const nCId = normalizeBatchKey(cId);
    const nCCorr = normalizeBatchKey(cCorr);
    const nCCod = normalizeBatchKey(cCod);

    return Boolean(
      (rawId && (cId === rawId || cCorr === rawId || cCod === rawId)) ||
      (rawCorr && (cId === rawCorr || cCorr === rawCorr || cCod === rawCorr)) ||
      (normId && (nCId === normId || nCCorr === normId || nCCod === normId)) ||
      (normCorr && (nCId === normCorr || nCCorr === normCorr || nCCod === normCorr))
    );
  };

  let fromDb: ControlVaporizado | undefined;
  try {
    fromDb = (localDB.getControlVaporizado() || []).find(matchesCtrl);
  } catch {
    // ignore
  }
  const fromProps = (controlesProp || []).find(matchesCtrl);

  let fromDraft: Partial<ControlVaporizado> | undefined;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const candidateKeys = Array.from(
        new Set([
          `apit_draft_ctrl_${batchId || ""}`,
          `apit_draft_ctrl_${rawId}`,
          `apit_draft_ctrl_${correlativo || ""}`,
          `apit_draft_ctrl_${rawCorr}`,
          `apit_draft_ctrl_${normId}`,
          `apit_draft_ctrl_${normCorr}`
        ])
      );
      for (const key of candidateKeys) {
        if (!key || key === "apit_draft_ctrl_") continue;
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && matchesCtrl(parsed)) {
            fromDraft = parsed;
            break;
          }
        }
      }
      if (!fromDraft) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith("apit_draft_ctrl_")) {
            const raw = window.localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object" && matchesCtrl(parsed)) {
                fromDraft = parsed;
                break;
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const baseCtrl = fromDb || fromProps;
  if (baseCtrl && fromDraft) {
    return {
      ...baseCtrl,
      ...fromDraft,
      datosIngreso: {
        ...(baseCtrl.datosIngreso || {}),
        ...(fromDraft.datosIngreso || {})
      },
      datosVaporizado: {
        ...(baseCtrl.datosVaporizado || {}),
        ...(fromDraft.datosVaporizado || {})
      }
    } as ControlVaporizado;
  }
  return (fromDraft as ControlVaporizado) || baseCtrl;
}

/**
 * Resuelve la modalidad de vaporizado ("1_PASE" o "2_PASES") registrada en el
 * REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO para un batch dado.
 */
export function resolverModalidadVaporizadoBatch(
  batchId?: string,
  correlativo?: string,
  controlesProp: ControlVaporizado[] = [],
  humedadIngresoFallback?: number
): "1_PASE" | "2_PASES" {
  const ctrl = resolverControlVaporizadoBatch(batchId, correlativo, controlesProp);
  const rawMod = ctrl?.datosVaporizado?.modalidadPases || (ctrl as any)?.MODALIDAD_PASES;
  if (rawMod) {
    const upper = String(rawMod).trim().toUpperCase();
    return upper.includes("2") || upper.includes("SECO") || upper.includes("ANTI") ? "2_PASES" : "1_PASE";
  }

  if (ctrl?.datosVaporizado?.inyeccionVaporPase2?.inicio || ctrl?.datosVaporizado?.inyeccionVaporPase2?.fin) {
    return "2_PASES";
  }
  if (ctrl?.datosVaporizado?.inyeccionVapor?.inicio || ctrl?.datosVaporizado?.inyeccionVapor?.fin) {
    return "1_PASE";
  }

  const hum = ctrl?.datosIngreso?.humedadPct ?? ctrl?.HUMEDAD_INGRESO ?? humedadIngresoFallback;
  if (hum !== undefined && !isNaN(Number(hum)) && Number(hum) < 14.0) {
    return "2_PASES";
  }
  return "1_PASE";
}

/**
 * Calcula la evaluación integral y comparativa de un Batch de Vaporizado,
 * determinando incrementos de trizado/cuarteado, quebrado, defectos,
 * resultados sensoriales de cocción y el Índice de Eficiencia de Proceso (IEP).
 */
export function calcularEvaluacionBatch(
  batch: BatchVaporizado,
  batchLotes: BatchLote[] = [],
  lotes: Lote[] = [],
  controles: ControlVaporizado[] = [],
  analisisVapList: AnalisisVaporizado[] = [],
  presecados: Presecado[] = [],
  analisisHumList: AnalisisHumedo[] = [],
  analisisSecList: AnalisisSeco[] = [],
  resultadosCoccionExternos: ResultadoCoccionExterno[] = []
): BatchEvaluacionComparativa {
  const corr = batch.CORRELATIVO || batch.BATCH_ID;
  const bLotes = batchLotes.filter(bl => bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === corr);
  const loteIds = bLotes.map(bl => bl.LOTE_ID);

  // Clientes y Variedades asociadas
  const clientesSet = new Set<string>();
  const variedadesSet = new Set<string>();
  let sumHumIngreso = 0;
  let sumQiIngreso = 0;
  let sumTrizadoIngreso = 0;
  let sumTizaIngreso = 0;
  let sumManchadoIngreso = 0;
  let sumGranoVerdeIngreso = 0;
  let totalPesoKg = 0;
  let totalSacos = 0;
  let countLotes = 0;

  bLotes.forEach((bl) => {
    const loteObj = lotes.find(l => l.LOTE_ID === bl.LOTE_ID);
    const ahObj = analisisHumList.find(a => a.LOTE_ID === bl.LOTE_ID);
    const c = bl.CLIENTE || loteObj?.CLIENTE;
    const v = bl.VARIEDAD || loteObj?.VARIEDAD;
    if (c) clientesSet.add(c);
    if (v) variedadesSet.add(v);

    const peso = Number(bl.PESO_KG) || 0;
    const sacos = Number(bl.SACOS) || 0;
    totalPesoKg += peso;
    totalSacos += sacos;

    const hum = ahObj?.HUMEDADES ?? loteObj?.HUM ?? loteObj?.HUMEDAD ?? 14.2;
    const qi = ahObj?.QI ?? 7.5;
    const triz = ahObj?.TZ ?? 1.8;
    const tt = ahObj?.TT ?? 1.5;
    const manch = ahObj?.MANCHADO ?? 0.8;
    const gv = ahObj?.GV ?? 0.3;

    const factor = peso > 0 ? peso : 1;
    sumHumIngreso += Number(hum) * factor;
    sumQiIngreso += Number(qi) * factor;
    sumTrizadoIngreso += Number(triz) * factor;
    sumTizaIngreso += Number(tt) * factor;
    sumManchadoIngreso += Number(manch) * factor;
    sumGranoVerdeIngreso += Number(gv) * factor;
    countLotes++;
  });

  const denom = totalPesoKg > 0 ? totalPesoKg : (countLotes > 0 ? countLotes : 1);
  const humIngreso = Number((sumHumIngreso / denom).toFixed(1)) || 14.2;
  const qiIngreso = Number((sumQiIngreso / denom).toFixed(1)) || 7.5;
  const trizadoIngreso = Number((sumTrizadoIngreso / denom).toFixed(1)) || 1.8;
  const tizaIngreso = Number((sumTizaIngreso / denom).toFixed(1)) || 1.5;
  const manchadoIngreso = Number((sumManchadoIngreso / denom).toFixed(1)) || 0.8;
  const granoVerdeIngreso = Number((sumGranoVerdeIngreso / denom).toFixed(1)) || 0.3;

  const cliente = Array.from(clientesSet).join(", ") || "Cliente General";
  const variedad = Array.from(variedadesSet).join(", ") || "Variedad Estándar";

  const bId = (batch.BATCH_ID || "").toString().trim().toUpperCase();
  const corrUpper = (corr || "").toString().trim().toUpperCase();

  const ctrl = resolverControlVaporizadoBatch(batch.BATCH_ID, corr, controles);
  const pre = presecados.find(p => loteIds.includes(p.LOTE_ID));

  const modalidadPases = resolverModalidadVaporizadoBatch(batch.BATCH_ID, corr, controles, humIngreso);
  const rawDatosVap = ctrl?.datosVaporizado as any;
  const inyVap = rawDatosVap?.inyeccionVapor as any;
  const presionVaporBar = Number(inyVap?.presion ?? inyVap?.presionBar ?? (batch.EQUIPO?.includes("GINSAC") ? 2.5 : 2.2));
  const tempVaporC = Number(inyVap?.temperatura ?? inyVap?.temperaturaC ?? 118);
  const calcDurMinSimple = (ini?: string, fin?: string): number => {
    if (!ini || !fin) return 0;
    const cleanIni = String(ini).trim().toUpperCase();
    const cleanFin = String(fin).trim().toUpperCase();
    if (cleanIni === "--:--" || cleanFin === "--:--" || cleanIni === "--" || cleanFin === "--" || cleanIni.includes("PEND")) return 0;
    const p1 = cleanIni.replace(/[APM\s]/g, "").split(":").map(Number);
    const p2 = cleanFin.replace(/[APM\s]/g, "").split(":").map(Number);
    if (p1.length >= 2 && p2.length >= 2 && !isNaN(p1[0]) && !isNaN(p1[1]) && !isNaN(p2[0]) && !isNaN(p2[1])) {
      let h1 = p1[0], h2 = p2[0];
      if (cleanIni.includes("PM") && h1 < 12) h1 += 12;
      if (cleanIni.includes("AM") && h1 === 12) h1 = 0;
      if (cleanFin.includes("PM") && h2 < 12) h2 += 12;
      if (cleanFin.includes("AM") && h2 === 12) h2 = 0;
      let diff = (h2 * 60 + p2[1]) - (h1 * 60 + p1[1]);
      if (diff < 0) diff += 24 * 60;
      return Math.round(diff);
    }
    return 0;
  };
  const parseMinVal = (v: any): number => {
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
    return isNaN(n) ? 0 : Math.round(n);
  };

  const durP1 = calcDurMinSimple(rawDatosVap?.inyeccionVaporPase1?.inicio, rawDatosVap?.inyeccionVaporPase1?.fin) ||
    parseMinVal(rawDatosVap?.inyeccionVaporPase1?.duracion);
  const durP2 = calcDurMinSimple(rawDatosVap?.inyeccionVaporPase2?.inicio, rawDatosVap?.inyeccionVaporPase2?.fin) ||
    parseMinVal(rawDatosVap?.inyeccionVaporPase2?.duracion);
  const dur1Pase = calcDurMinSimple(inyVap?.inicio, inyVap?.fin) ||
    parseMinVal(inyVap?.duracion || inyVap?.tiempoMinutos);

  const tiempoVaporMin = modalidadPases === "2_PASES"
    ? (durP1 + durP2 > 0 ? durP1 + durP2 : parseMinVal(rawDatosVap?.tiempoTotalInyeccionMin))
    : (dur1Pase > 0 ? dur1Pase : parseMinVal(rawDatosVap?.tiempoTotalInyeccionMin));
  const tiempoReposoMin = Number(rawDatosVap?.tiempoReposoMinutos ?? (ctrl as any)?.TIEMPO_REPOSO ?? 15);
  const rpm = Number(rawDatosVap?.rpm ?? (ctrl as any)?.RPM ?? 12);
  const secadoMetodo = (pre as any)?.TIPO_SECADO || (ctrl as any)?.SECADO_METODO || "LUSTEC_ROTATIVO";
  const tempSecadoC = pre?.TEMP_SECADO_C ?? (pre as any)?.TEMP_OPERACION ?? (ctrl as any)?.TEMP_SECADO ?? 55;
  const tiempoSecadoMin = pre?.TIEMPO_SECADO_MIN ?? ((pre as any)?.HORAS_SECADO ? Number((pre as any).HORAS_SECADO) * 60 : ((ctrl as any)?.TIEMPO_SECADO_MIN || 180));

  // Buscar registros operativos
  // 1. Identificar si existen muestras reales de calidad física de salida (análisis de vaporizado o descarga)
  const av = analisisVapList.find(a => {
    const aB = (a.BATCH_ID || "").toString().trim().toUpperCase();
    const aCorr = ((a as any).CORRELATIVO || "").toString().trim().toUpperCase();
    return (
      (aB && (aB === bId || aB === corrUpper)) ||
      (aCorr && (aCorr === bId || aCorr === corrUpper)) ||
      (a.LOTE_ID && loteIds.some(lid => lid && a.LOTE_ID.toUpperCase() === lid.toUpperCase()))
    );
  });

  const aSec = analisisSecList.find(s => {
    const sB = ((s as any).BATCH_ID || "").toString().trim().toUpperCase();
    return (
      (sB && (sB === bId || sB === corrUpper)) ||
      (s.LOTE_ID && loteIds.some(lid => lid && s.LOTE_ID.toUpperCase() === lid.toUpperCase()))
    );
  });

  // 2. Buscar si existen datos reales importados o registrados de cocción
  const coccionReal = buscarCoccionParaBatch(batch.BATCH_ID, corr, loteIds, resultadosCoccionExternos);

  // ¿Tiene análisis físico de descarga real registrado?
  // NUNCA asumir datos si el laboratorio aún no ha ingresado las lecturas de salida
  const hasDescargaReal = Boolean(
    (av && (
      (av.HUMEDAD_FINAL !== undefined && av.HUMEDAD_FINAL !== null) ||
      (av.QUEBRADO_FINAL !== undefined && av.QUEBRADO_FINAL !== null) ||
      (av.HUMEDAD !== undefined && av.HUMEDAD !== null && Number(av.HUMEDAD) > 0) ||
      (av.QB !== undefined && av.QB !== null) ||
      (av.TRIZADO !== undefined && av.TRIZADO !== null) ||
      (av.TZ !== undefined && av.TZ !== null) ||
      (av.TIZA !== undefined && av.TIZA !== null) ||
      (av.TT !== undefined && av.TT !== null) ||
      (av.BL !== undefined && av.BL !== null) ||
      (av.BLI !== undefined && av.BLI !== null)
    )) ||
    (aSec && (
      (aSec.Humedad_Final !== undefined && aSec.Humedad_Final !== null) ||
      (aSec.QI_Final !== undefined && aSec.QI_Final !== null) ||
      (aSec.QB_Final !== undefined && aSec.QB_Final !== null) ||
      (aSec.Trizado_Final !== undefined && aSec.Trizado_Final !== null)
    )) ||
    (coccionReal && (
      (coccionReal.quebradoDescarga !== undefined && Number(coccionReal.quebradoDescarga) > 0) ||
      (coccionReal.trizadoDescarga !== undefined && Number(coccionReal.trizadoDescarga) > 0) ||
      (coccionReal.humedadBlancoDescarga !== undefined && Number(coccionReal.humedadBlancoDescarga) > 0)
    ))
  );

  // ¿Tiene análisis de cocción en olla registrado?
  // NUNCA inventar puntajes ni recetas de cocción si el panel sensorial no ha evaluado el batch
  const hasCoccionReal = Boolean(
    coccionReal && (
      coccionReal.esDatoReal === true ||
      coccionReal.estadoIntegracion === "INTEGRADO" ||
      (coccionReal.puntajeCoccion !== undefined && Number(coccionReal.puntajeCoccion) > 0) ||
      (coccionReal.desplazamientoSeg !== undefined && String(coccionReal.desplazamientoSeg).trim() !== "") ||
      (coccionReal.tiempoCoccionMin !== undefined && String(coccionReal.tiempoCoccionMin).trim() !== "" && coccionReal.tiempoCoccionMin !== 0) ||
      (coccionReal.granoQuebradoOllaPct !== undefined && Number(coccionReal.granoQuebradoOllaPct) > 0)
    )
  );

  // Parámetros de salida física: SOLO si se registraron en laboratorio
  let humSalida: number | undefined = undefined;
  let deltaHumedad: number | undefined = undefined;
  let quebradoSalida: number | undefined = undefined;
  let deltaQuebrado: number | undefined = undefined;
  let trizadoSalida: number | undefined = undefined;
  let deltaTrizado: number | undefined = undefined;
  let tizaSalida: number | undefined = undefined;
  let deltaTiza: number | undefined = undefined;
  let manchadoSalida: number | undefined = undefined;
  let deltaManchado: number | undefined = undefined;
  let blancuraKett: number | undefined = undefined;
  let gelatinizacionPct: number | undefined = undefined;
  let tpMasTpuntualSalida: number | undefined = undefined;
  let quebradoIntegralSalida: number | undefined = undefined;
  let tizaTotalMasGcocidoDescarga: number | undefined = undefined;

  if (hasDescargaReal) {
    humSalida = av?.HUMEDAD_FINAL ?? av?.HUMEDAD ?? aSec?.Humedad_Final ?? coccionReal?.humedadBlancoDescarga ?? coccionReal?.humedadCascaraDescarga;
    if (humSalida !== undefined) {
      deltaHumedad = Number((humSalida - humIngreso).toFixed(1));
    }

    quebradoSalida = coccionReal?.quebradoDescarga ?? av?.QUEBRADO_FINAL ?? av?.QUEBRADO ?? av?.QB ?? aSec?.QI_Final ?? aSec?.QB_Final;
    if (quebradoSalida !== undefined) {
      deltaQuebrado = Number(Math.max(0, quebradoSalida - qiIngreso).toFixed(1));
    }

    trizadoSalida = coccionReal?.trizadoDescarga ?? av?.TRIZADO_FINAL ?? av?.TRIZADO ?? av?.TZ ?? aSec?.Trizado_Final;
    if (trizadoSalida !== undefined) {
      deltaTrizado = Number(Math.max(0, trizadoSalida - trizadoIngreso).toFixed(1));
    }

    tizaSalida = coccionReal?.tizaTotalMasGcocidoDescarga ?? av?.TIZA_FINAL ?? av?.TIZA ?? av?.TT ?? aSec?.Tiza_Final;
    if (tizaSalida !== undefined) {
      deltaTiza = Number((tizaSalida - tizaIngreso).toFixed(1));
    }

    manchadoSalida = coccionReal?.manchaDescarga ?? av?.MANCHADO_FINAL ?? av?.MANCHADO ?? av?.M ?? aSec?.Manchado_Final;
    if (manchadoSalida !== undefined) {
      deltaManchado = Number((manchadoSalida - manchadoIngreso).toFixed(1));
    }

    blancuraKett = coccionReal?.blancuraBlancoDescarga ?? av?.BLANCURA_KETT ?? av?.BL ?? av?.BLI ?? aSec?.Blancura_Final;
    gelatinizacionPct = (av as any)?.GELATINIZACION_PCT ?? av?.GI ?? 98.2;
    tpMasTpuntualSalida = coccionReal?.tpMasTpuntualDescarga ?? (av as any)?.TP_TPUNTUAL;
    quebradoIntegralSalida = coccionReal?.quebradoIntegralDescarga ?? (av as any)?.QUEBRADO_INTEGRAL ?? av?.QI;
    tizaTotalMasGcocidoDescarga = coccionReal?.tizaTotalMasGcocidoDescarga;
  }

  // Resultados de Cocción (Olla & Sensorial)
  let coccionScore: number | undefined = undefined;
  let tazasArroz: number | undefined = undefined;
  let tazasAgua: string | number | undefined = undefined;
  let tiempoCoccionMin: string | undefined = undefined;
  let ratioAbsorcionAgua: string | undefined = undefined;
  let expansionVolumetrica: string | undefined = undefined;
  let solturaGrano: string | undefined = undefined;
  let texturaFirmeza: string | undefined = undefined;
  let colorCocido: string | undefined = undefined;
  let aromaSabor: string | undefined = undefined;
  let desplazamientoSeg: string | number | undefined = undefined;
  let granoQuebradoOllaPct: number | undefined = undefined;
  let granoHinchadoPct: number | undefined = undefined;
  let granoAbiertoPct: number | undefined = undefined;
  let saborCocido: string | undefined = undefined;
  let texturaFrio: string | undefined = undefined;
  let envaseProyectado: string | undefined = undefined;
  let observacionesCoccion: string = "";

  if (hasCoccionReal && coccionReal) {
    // Datos empíricos reales del aplicativo de cocción o ficha de laboratorio
    coccionScore = coccionReal.puntajeCoccion || 95;
    tazasArroz = coccionReal.tazasArroz ?? 3;
    tazasAgua = coccionReal.tazasAgua ?? "3 1/2";
    tiempoCoccionMin = typeof coccionReal.tiempoCoccionMin === "number" ? `${coccionReal.tiempoCoccionMin} min` : (coccionReal.tiempoCoccionMin || "30 min");
    ratioAbsorcionAgua = coccionReal.ratioAguaArroz || "3 tazas arroz / 3 1/2 tazas agua";
    expansionVolumetrica = coccionReal.expansionVolumetrica || "x2.6";
    solturaGrano = coccionReal.solturaGrano || "100% Suelto";
    texturaFirmeza = coccionReal.texturaFrio || coccionReal.texturaFirmeza || "Al dente";
    colorCocido = coccionReal.colorCocido || "Blanco marfil";
    aromaSabor = coccionReal.aromaSabor || "Característico";
    desplazamientoSeg = coccionReal.desplazamientoSeg ?? "15 seg";
    granoQuebradoOllaPct = coccionReal.granoQuebradoOllaPct ?? 18.0;
    granoHinchadoPct = coccionReal.granoHinchadoPct ?? 8.6;
    granoAbiertoPct = coccionReal.granoAbiertoPct ?? 1.3;
    saborCocido = coccionReal.sabor || coccionReal.saborDescarga || "Neutro Característico";
    texturaFrio = coccionReal.texturaFrio || coccionReal.texturaFirmeza || "Suave al dente";
    envaseProyectado = coccionReal.envaseProyectado || (coccionScore >= 95 ? "Saco 50 kg Don Julio Extra Selección" : coccionScore >= 90 ? "Saco 50 kg Don Julio Superior" : "Saco 50 kg Corriente / Granel");
    observacionesCoccion = `[Origen: ${coccionReal.fuenteExterna || 'App Cocción'}] ${coccionReal.observaciones || ''}`;
  } else {
    // Si no se ha registrado cocción en olla, asignar estimación base del proceso
    tiempoCoccionMin = "28 - 30 min";
    ratioAbsorcionAgua = "3 tazas arroz / 3 1/2 tazas agua";
    solturaGrano = "15 seg (100% Suelto)";
    envaseProyectado = "Por definir en cocción";
    observacionesCoccion = "Pendiente de análisis de cocción en laboratorio.";
  }

  // Cálculo del Índice de Eficiencia de Proceso (IEP)
  let puntosTrizado: number | undefined = undefined;
  let puntosQuebrado: number | undefined = undefined;
  let puntosDefectos: number | undefined = undefined;
  let puntosCoccion: number | undefined = undefined;
  let iepScore: number | undefined = undefined;
  let diagnosticoGeneral = "Pendiente de Análisis de Descarga y Cocción";

  if (hasDescargaReal) {
    puntosTrizado = deltaTrizado !== undefined ? Math.max(0, Math.min(100, 100 - (deltaTrizado * 25))) : 100;
    puntosQuebrado = deltaQuebrado !== undefined ? Math.max(0, Math.min(100, 100 - (deltaQuebrado * 18))) : 100;
    const deltaDefectosTotal = Math.max(0, (deltaTiza || 0) + (deltaManchado || 0));
    puntosDefectos = Math.max(0, Math.min(100, 100 - (deltaDefectosTotal * 20)));

    if (hasCoccionReal && coccionScore !== undefined) {
      puntosCoccion = coccionScore;
      iepScore = Number((
        (puntosTrizado * 0.30) +
        (puntosQuebrado * 0.25) +
        (puntosDefectos * 0.15) +
        (puntosCoccion * 0.30)
      ).toFixed(1));

      if (iepScore >= 92) {
        diagnosticoGeneral = "PROCESO ÓPTIMO (GOLDEN BATCH) - Mínimo Trizado y Máxima Cocción";
      } else if (iepScore >= 85) {
        diagnosticoGeneral = "Proceso Eficiente - Buena Calidad en Olla";
      } else if (iepScore < 80) {
        diagnosticoGeneral = "Proceso con Oportunidades de Ajuste Térmico (Revisar Presión/Tiempos)";
      } else {
        diagnosticoGeneral = "Proceso Conforme y Estable";
      }
    } else {
      // Solo análisis de descarga registrado, cocción aún pendiente
      const iepFisico = Number((
        (puntosTrizado * 0.45) +
        (puntosQuebrado * 0.35) +
        (puntosDefectos * 0.20)
      ).toFixed(1));
      iepScore = iepFisico;
      diagnosticoGeneral = "Análisis Físico de Descarga Registrado · Pendiente de Cocción en Olla";
    }
  } else if (hasCoccionReal && coccionScore !== undefined) {
    puntosCoccion = coccionScore;
    diagnosticoGeneral = "Análisis de Cocción Registrado · Pendiente de Análisis de Descarga";
  }

  const tieneDatosEvaluacion = Boolean(hasDescargaReal || hasCoccionReal);

  return {
    batchId: batch.BATCH_ID,
    correlativo: corr,
    fecha: batch.FECHA_PROGRAMADA || batch.FECHA_INICIO || "Sin fecha",
    turno: batch.TURNO || "Turno Día",
    equipo: (batch.EQUIPO && (batch.EQUIPO.includes("GINSAC") || batch.EQUIPO.includes("02"))) ? "GINSAC" : "APIT",
    operador: batch.OPERADOR || "Pedro Huamán",
    estadoBatch: batch.ESTADO_BATCH || "PROGRAMADO",
    cliente,
    variedad,
    totalKg: totalPesoKg || batch.PESO_TOTAL_KG || 30000,
    totalSacos: totalSacos || 600,
    loteIds,

    humIngreso,
    qiIngreso,
    trizadoIngreso,
    tizaIngreso,
    manchadoIngreso,
    granoVerdeIngreso,

    modalidadPases,
    presionVaporBar,
    tempVaporC,
    tiempoVaporMin,
    tiempoReposoMin,
    rpm,
    secadoMetodo,
    tempSecadoC,
    tiempoSecadoMin,

    humSalida,
    deltaHumedad,
    quebradoSalida,
    deltaQuebrado,
    quebradoIntegralMP: coccionReal?.quebradoIntegralMP,
    quebradoIntegralSalida,
    trizadoSalida,
    deltaTrizado,
    tizaSalida,
    deltaTiza,
    tpMasTpuntualSalida,
    manchadoSalida,
    deltaManchado,
    blancuraKett,
    gelatinizacionPct,
    reposoCascaraDias: coccionReal?.reposoCascaraDias,
    tizaTotalMasGcocidoMP: coccionReal?.tizaTotalMasGcocidoMP,
    tizaTotalMasGcocidoDescarga,

    coccionScore,
    tazasArroz,
    tazasAgua,
    tiempoCoccionMin,
    ratioAbsorcionAgua,
    expansionVolumetrica,
    solturaGrano,
    texturaFirmeza,
    colorCocido,
    aromaSabor,
    desplazamientoSeg,
    granoQuebradoOllaPct,
    granoHinchadoPct,
    granoAbiertoPct,
    saborCocido,
    texturaFrio,
    envaseProyectado,
    observacionesCoccion,
    esDatoCoccionReal: hasCoccionReal,

    tieneAnalisisDescarga: hasDescargaReal,
    tieneAnalisisCoccion: hasCoccionReal,
    tieneDatosEvaluacion,

    iepScore,
    puntosTrizado: puntosTrizado !== undefined ? Number(puntosTrizado.toFixed(1)) : undefined,
    puntosQuebrado: puntosQuebrado !== undefined ? Number(puntosQuebrado.toFixed(1)) : undefined,
    puntosDefectos: puntosDefectos !== undefined ? Number(puntosDefectos.toFixed(1)) : undefined,
    puntosCoccion: puntosCoccion !== undefined ? Number(puntosCoccion.toFixed(1)) : undefined,
    ranking: 1,
    esGoldenBatch: false,
    diagnosticoGeneral
  };
}

/**
 * Evalúa todos los batches y asigna rankings y bandera de Golden Batch
 */
export function evaluarYRankearBatches(
  batches: BatchVaporizado[],
  batchLotes: BatchLote[] = [],
  lotes: Lote[] = [],
  controles: ControlVaporizado[] = [],
  analisisVapList: AnalisisVaporizado[] = [],
  presecados: Presecado[] = [],
  analisisHumList: AnalisisHumedo[] = [],
  analisisSecList: AnalisisSeco[] = [],
  resultadosCoccionExternos: ResultadoCoccionExterno[] = []
): BatchEvaluacionComparativa[] {
  const evaluaciones = batches.map(b => 
    calcularEvaluacionBatch(
      b,
      batchLotes,
      lotes,
      controles,
      analisisVapList,
      presecados,
      analisisHumList,
      analisisSecList,
      resultadosCoccionExternos
    )
  );

  // Ordenar: primero los batches que cuentan con evaluación real (IEP más alto primero)
  evaluaciones.sort((a, b) => {
    const aVal = a.iepScore !== undefined ? a.iepScore : -1;
    const bVal = b.iepScore !== undefined ? b.iepScore : -1;
    return bVal - aVal;
  });

  // Asignar ranking y golden batch (solo aplicable si tiene datos de evaluación y supera el umbral)
  return evaluaciones.map((ev, index) => ({
    ...ev,
    ranking: index + 1,
    esGoldenBatch: Boolean(index === 0 && ev.tieneDatosEvaluacion && (ev.iepScore || 0) >= 88)
  }));
}

/**
 * Obtiene las recetas maestras doradas guardadas en localStorage o genera recetas predeterminadas
 */
export function obtenerRecetasMaestras(): RecetaVaporizadoMaestra[] {
  try {
    const raw = localStorage.getItem(RECETAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error cargando recetas maestras:", e);
  }

  // Recetas predeterminadas por variedad
  const defaultRecetas: RecetaVaporizadoMaestra[] = [
    {
      id: "REC-TINAJONES-GOLD",
      nombreReceta: "Receta Dorada Tinajones Extra (Bajo Trizado & Cocción 98 pts)",
      variedad: "Tinajones Extra",
      rangoHumedad: "14.0% - 15.0%",
      batchOrigenId: "BAT-2026-041",
      correlativoOrigen: "V350",
      iepScore: 95.6,
      coccionScore: 98,
      deltaTrizado: 0.3,
      deltaQuebrado: 1.6,
      parametros: {
        modalidadPases: "2_PASES",
        presionVaporBar: 1.85,
        tempVaporC: 118,
        tiempoVaporMin: 28,
        tiempoReposoMin: 45,
        rpm: 14,
        secadoMetodo: "Torre Industrial de Secado",
        tempSecadoC: 52,
        tiempoSecadoMin: 45
      },
      recomendacionesUso: "Aplicar rampa suave de presión a 1.85 bar para evitar estrés térmico en el endospermo. Reposo térmico mínimo de 45 min.",
      fechaCreacion: "2026-08-18",
      creadoPor: "Ing. Carlos Morales (Jefe de Planta)"
    },
    {
      id: "REC-IR43-GOLD",
      nombreReceta: "Receta Maestra IR-43 / IR-43 Mejorado (Anti-Quebrado)",
      variedad: "IR-43 Mejorado",
      rangoHumedad: "13.8% - 14.5%",
      batchOrigenId: "BAT-2026-042",
      correlativoOrigen: "RECETA-IR43",
      iepScore: 93.4,
      coccionScore: 95,
      deltaTrizado: 0.5,
      deltaQuebrado: 1.8,
      parametros: {
        modalidadPases: "2_PASES",
        presionVaporBar: 1.80,
        tempVaporC: 116,
        tiempoVaporMin: 26,
        tiempoReposoMin: 40,
        rpm: 14,
        secadoMetodo: "Torre Industrial de Secado",
        tempSecadoC: 50,
        tiempoSecadoMin: 40
      },
      recomendacionesUso: "IR-43 posee cáscara más fina. Mantener presión máxima en 1.80 bar y enfriamiento gradual en secadora.",
      fechaCreacion: "2026-08-19",
      creadoPor: "Ing. Andrea Rojas (Control Calidad)"
    },
    {
      id: "REC-MALLARES-GOLD",
      nombreReceta: "Receta Optimizada Mallares (Rendimiento Olla & Soltura)",
      variedad: "Mallares",
      rangoHumedad: "14.0% - 14.8%",
      batchOrigenId: "BAT-2026-043",
      correlativoOrigen: "V202",
      iepScore: 92.8,
      coccionScore: 94,
      deltaTrizado: 0.6,
      deltaQuebrado: 2.1,
      parametros: {
        modalidadPases: "2_PASES",
        presionVaporBar: 1.88,
        tempVaporC: 119,
        tiempoVaporMin: 30,
        tiempoReposoMin: 50,
        rpm: 14,
        secadoMetodo: "Torre Industrial de Secado",
        tempSecadoC: 54,
        tiempoSecadoMin: 50
      },
      recomendacionesUso: "Grano largo translúcido. Permite vaporizado profundo para lograr 100% de gelatinización de centro.",
      fechaCreacion: "2026-08-20",
      creadoPor: "Ing. Carlos Morales"
    }
  ];

  guardarRecetasMaestras(defaultRecetas);
  return defaultRecetas;
}

/**
 * Guarda las recetas maestras en localStorage
 */
export function guardarRecetasMaestras(recetas: RecetaVaporizadoMaestra[]): void {
  try {
    localStorage.setItem(RECETAS_STORAGE_KEY, JSON.stringify(recetas));
  } catch (e) {
    console.error("Error guardando recetas maestras:", e);
  }
}

/**
 * Crea y guarda una nueva receta maestra a partir de un batch evaluado
 */
export function crearRecetaDesdeBatch(
  evaluacion: BatchEvaluacionComparativa,
  nombreCustom?: string,
  usuario: string = "Operador de Planta"
): RecetaVaporizadoMaestra {
  const recetasActuales = obtenerRecetasMaestras();
  const id = `REC-${evaluacion.correlativo}-${Date.now().toString().slice(-4)}`;

  const nuevaReceta: RecetaVaporizadoMaestra = {
    id,
    nombreReceta: nombreCustom || `Receta Maestra Batch ${evaluacion.correlativo} (${evaluacion.variedad})`,
    variedad: evaluacion.variedad,
    rangoHumedad: `${Math.max(12, evaluacion.humIngreso - 0.5).toFixed(1)}% - ${(evaluacion.humIngreso + 0.5).toFixed(1)}%`,
    batchOrigenId: evaluacion.batchId,
    correlativoOrigen: evaluacion.correlativo,
    iepScore: evaluacion.iepScore,
    coccionScore: evaluacion.coccionScore,
    deltaTrizado: evaluacion.deltaTrizado,
    deltaQuebrado: evaluacion.deltaQuebrado,
    parametros: {
      modalidadPases: evaluacion.modalidadPases,
      presionVaporBar: evaluacion.presionVaporBar,
      tempVaporC: evaluacion.tempVaporC,
      tiempoVaporMin: evaluacion.tiempoVaporMin,
      tiempoReposoMin: evaluacion.tiempoReposoMin,
      rpm: evaluacion.rpm,
      secadoMetodo: evaluacion.secadoMetodo,
      tempSecadoC: evaluacion.tempSecadoC,
      tiempoSecadoMin: evaluacion.tiempoSecadoMin
    },
    recomendacionesUso: `Proceso con IEP ${evaluacion.iepScore} pts. Logró incremento mínimo de trizado (+${evaluacion.deltaTrizado}%) y cocción perfecta de ${evaluacion.coccionScore} pts.`,
    fechaCreacion: new Date().toISOString().split("T")[0],
    creadoPor: usuario
  };

  const listaActualizada = [nuevaReceta, ...recetasActuales.filter(r => r.id !== id)];
  guardarRecetasMaestras(listaActualizada);
  return nuevaReceta;
}

/**
 * Encuentra la mejor receta disponible para un lote según su variedad y humedad
 */
export function recomendarRecetaParaLote(
  lote: Lote,
  analisisHumList: AnalisisHumedo[] = []
): RecetaVaporizadoMaestra | undefined {
  const recetas = obtenerRecetasMaestras();
  const variedadLote = (lote.VARIEDAD || "").toLowerCase().trim();

  // Buscar coincidencia exacta por variedad
  const matchVar = recetas.find(r => 
    r.variedad.toLowerCase().includes(variedadLote) || 
    variedadLote.includes(r.variedad.toLowerCase())
  );

  if (matchVar) return matchVar;

  // Si no hay match exacto, retornar la de mayor IEP
  return recetas[0];
}
