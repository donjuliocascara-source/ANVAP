import {
  BatchVaporizado,
  BatchLote,
  Lote,
  AnalisisHumedo,
  Presecado,
  RegistroHumedad,
  ControlVaporizado,
  SacaBigBagItem,
  RegistroSacasDescarga
} from "../types";
import { compareLoteCodes } from "./formatLoteCode";
import { localDB } from "./localDB";
import { cargarProgramacionesOficiales } from "./programacionBatchOficialService";
import { cloudSyncService } from "../services/cloudSyncService";

const STORAGE_KEY_SACAS_DESCARGA = "apit_sacas_descarga_v1";
export const PORCENTAJE_TOLERANCIA_DESCARGA = 2; // ± 2% del peso ingresado (kg)
export const TOLERANCIA_DESCARGA_KG = 500;
export const HUMEDAD_OBJETIVO_DESCARGA_PCT = 12;

export interface DetalleLoteIngresoDescarga {
  loteId: string;
  sacos: number;
  pesoKg: number;
  humedadIngreso: number;
  fuenteHumedad: string;
  cliente?: string;
  variedad?: string;
}

export interface DatosBaseDescargaBatch {
  batchId: string;
  correlativo: string;
  pesoIngresoKg: number;
  humedadPromedioIngreso: number;
  pesoProyectadoKg: number;
  toleranciaKg: number;
  rangoMinimoAceptableKg: number;
  rangoMaximoAceptableKg: number;
  lotesDetalle: DetalleLoteIngresoDescarga[];
}

/**
 * Calcula el valor del rango permitido (± 2% del peso ingresado en kg)
 */
export function calcularToleranciaDescargaKg(pesoIngresoKg: number): number {
  const peso = Number(pesoIngresoKg) || 0;
  if (peso <= 0) return 0;
  return Number(((peso * PORCENTAJE_TOLERANCIA_DESCARGA) / 100).toFixed(2));
}

/**
 * Calcula el PESO PROYECTADO (kg) según la fórmula oficial:
 * PESO PROYECTADO (kg) = ((100 - humedad promedio de los analisis de ingreso) / (100 - 12)) * (Peso de ingreso)
 */
export function calcularPesoProyectadoDescarga(
  pesoIngresoKg: number,
  humedadPromedioIngreso: number
): number {
  const peso = Number(pesoIngresoKg) || 0;
  const hum = Number(humedadPromedioIngreso) || 0;
  if (peso <= 0) return 0;
  const factor = (100 - hum) / (100 - HUMEDAD_OBJETIVO_DESCARGA_PCT);
  return Number((factor * peso).toFixed(2));
}

export interface ParsedCantidadSacas {
  rawInput: string;
  cantidadValida: boolean;
  totalDecimal: number;
  totalSacasHabilitar: number; // Siempre ceil si hay fracción: ej. 28 1/4 -> 29, 28 1/2 -> 29, 28 3/4 -> 29
  enteras: number;
  fraccionStr?: string; // "1/4", "1/2", "3/4", etc.
  fraccionDecimal?: number;
  esFraccionaria: boolean;
  descripcionHumana: string;
  etiquetaVisual: string;
}

/**
 * Parsea la entrada del usuario de cantidad de sacas Big Bag.
 * Si se ingresa una fracción como "28 1/4", "28 1/2" o "28 3/4", calcula 28 sacas completas + 1 parcial,
 * habilitando 29 sacas para sus respectivos registros de pesaje en balanza.
 */
export function parsearCantidadSacasEntrada(input: string | number | undefined | null): ParsedCantidadSacas {
  if (input === undefined || input === null) {
    return {
      rawInput: "",
      cantidadValida: false,
      totalDecimal: 0,
      totalSacasHabilitar: 0,
      enteras: 0,
      esFraccionaria: false,
      descripcionHumana: "",
      etiquetaVisual: ""
    };
  }

  const rawStr = String(input).trim();
  if (!rawStr) {
    return {
      rawInput: "",
      cantidadValida: false,
      totalDecimal: 0,
      totalSacasHabilitar: 0,
      enteras: 0,
      esFraccionaria: false,
      descripcionHumana: "",
      etiquetaVisual: ""
    };
  }

  // Normalizar caracteres tipográficos y términos coloquiales en planta
  const normalized = rawStr
    .toLowerCase()
    .replace(/¼/g, " 1/4")
    .replace(/½/g, " 1/2")
    .replace(/¾/g, " 3/4")
    .replace(/⅓/g, " 1/3")
    .replace(/⅔/g, " 2/3")
    .replace(/⅛/g, " 1/8")
    .replace(/⅜/g, " 3/8")
    .replace(/⅝/g, " 5/8")
    .replace(/⅞/g, " 7/8")
    .replace(/\b(y\s+medio|y\s+media|con\s+medio|con\s+media)\b/g, " 1/2")
    .replace(/\b(y\s+un\s+cuarto|con\s+un\s+cuarto)\b/g, " 1/4")
    .replace(/\b(y\s+tres\s+cuartos|con\s+tres\s+cuartos)\b/g, " 3/4")
    .replace(/\s+/g, " ")
    .trim();

  // Caso 1: Mixto con espacio o suma: ej. "28 1/4", "28 1/2", "28 3/4", "28 + 1/2"
  const mixedFractionMatch = normalized.match(/^(\d+)[\s\+\-]+(\d+)\s*\/\s*(\d+)$/);
  if (mixedFractionMatch) {
    const enteras = parseInt(mixedFractionMatch[1], 10);
    const num = parseInt(mixedFractionMatch[2], 10);
    const den = parseInt(mixedFractionMatch[3], 10);
    if (den > 0 && enteras >= 0) {
      const fraccionDecimal = num / den;
      const totalDecimal = enteras + fraccionDecimal;
      const totalSacasHabilitar = Math.ceil(totalDecimal);
      const fraccionStr = `${num}/${den}`;
      const sim = fraccionStr === "1/2" ? "½" : fraccionStr === "1/4" ? "¼" : fraccionStr === "3/4" ? "¾" : fraccionStr;
      const etiquetaVisual = `${enteras} ${sim}`;
      return {
        rawInput: rawStr,
        cantidadValida: true,
        totalDecimal,
        totalSacasHabilitar,
        enteras,
        fraccionStr,
        fraccionDecimal,
        esFraccionaria: totalSacasHabilitar > enteras,
        descripcionHumana: `${enteras} sacas completas + 1 saca parcial de ${fraccionStr} (${totalSacasHabilitar} sacas para registrar pesos)`,
        etiquetaVisual
      };
    }
  }

  // Caso 2: Fracción sola: ej. "1/4", "1/2", "3/4"
  const pureFractionMatch = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (pureFractionMatch) {
    const num = parseInt(pureFractionMatch[1], 10);
    const den = parseInt(pureFractionMatch[2], 10);
    if (den > 0) {
      const fraccionDecimal = num / den;
      const totalDecimal = fraccionDecimal;
      const totalSacasHabilitar = Math.ceil(totalDecimal); // 1
      const fraccionStr = `${num}/${den}`;
      const sim = fraccionStr === "1/2" ? "½" : fraccionStr === "1/4" ? "¼" : fraccionStr === "3/4" ? "¾" : fraccionStr;
      return {
        rawInput: rawStr,
        cantidadValida: true,
        totalDecimal,
        totalSacasHabilitar,
        enteras: 0,
        fraccionStr,
        fraccionDecimal,
        esFraccionaria: true,
        descripcionHumana: `1 saca parcial de ${fraccionStr}`,
        etiquetaVisual: sim
      };
    }
  }

  // Caso 3: Decimal con coma o punto: ej. "28.5", "28,5", "28.25", "28.75"
  const decimalMatch = normalized.match(/^(\d+)[.,](\d+)$/);
  if (decimalMatch) {
    const enteras = parseInt(decimalMatch[1], 10);
    const decFraction = parseFloat(`0.${decimalMatch[2]}`);
    if (!isNaN(decFraction) && decFraction > 0) {
      const totalDecimal = enteras + decFraction;
      const totalSacasHabilitar = Math.ceil(totalDecimal);
      let fraccionStr = `${decimalMatch[2]}/100`;
      let etiquetaVisual = `${enteras}.${decimalMatch[2]}`;
      if (Math.abs(decFraction - 0.5) < 0.001) {
        fraccionStr = "1/2";
        etiquetaVisual = `${enteras} ½`;
      } else if (Math.abs(decFraction - 0.25) < 0.001) {
        fraccionStr = "1/4";
        etiquetaVisual = `${enteras} ¼`;
      } else if (Math.abs(decFraction - 0.75) < 0.001) {
        fraccionStr = "3/4";
        etiquetaVisual = `${enteras} ¾`;
      }
      return {
        rawInput: rawStr,
        cantidadValida: true,
        totalDecimal,
        totalSacasHabilitar,
        enteras,
        fraccionStr,
        fraccionDecimal: decFraction,
        esFraccionaria: true,
        descripcionHumana: `${enteras} sacas completas + 1 saca parcial de ${fraccionStr} (${totalSacasHabilitar} sacas para registrar pesos)`,
        etiquetaVisual
      };
    }
  }

  // Caso 4: Entero estándar: ej. "28" o "29"
  const integerMatch = normalized.match(/^(\d+)$/);
  if (integerMatch) {
    const enteras = parseInt(integerMatch[1], 10);
    if (enteras > 0) {
      return {
        rawInput: rawStr,
        cantidadValida: true,
        totalDecimal: enteras,
        totalSacasHabilitar: enteras,
        enteras,
        fraccionStr: undefined,
        fraccionDecimal: 0,
        esFraccionaria: false,
        descripcionHumana: `${enteras} sacas completas`,
        etiquetaVisual: String(enteras)
      };
    }
  }

  return {
    rawInput: rawStr,
    cantidadValida: false,
    totalDecimal: 0,
    totalSacasHabilitar: 0,
    enteras: 0,
    esFraccionaria: false,
    descripcionHumana: "Formato no reconocido. Ingrese un entero (ej. 28) o fracción (ej. 28 1/4, 28 1/2, 28 3/4).",
    etiquetaVisual: rawStr
  };
}

/**
 * Evalúa el balance de masa de las Sacas Big Bag de descarga frente al Peso Proyectado (± 2% del Peso de Ingreso)
 */
export function evaluarBalanceSacasDescarga(params: {
  batchId: string;
  correlativo?: string;
  cantidadSacasTexto?: string;
  sacas: SacaBigBagItem[];
  pesoIngresoKg: number;
  humedadPromedioIngreso: number;
  alarmaAceptada?: boolean;
  sustentoObservacionAlarma?: string;
  aceptadoPor?: string;
  fechaAceptacionAlarma?: string;
  observaciones?: string;
  fotoFichaPesosUrl?: string;
  fotoFichaNombre?: string;
  fotoFichaFecha?: string;
  actualizadoPor?: string;
}): RegistroSacasDescarga {
  const sacasLimpias: SacaBigBagItem[] = (params.sacas || []).map((s, idx) => ({
    id: s.id || `SACA-${idx + 1}-${Date.now()}`,
    numero: idx + 1,
    codigoSaca: s.codigoSaca || `BIG BAG #${String(idx + 1).padStart(2, "0")}`,
    pesoKg: Number(s.pesoKg) || 0,
    horaPesaje: s.horaPesaje || "",
    observacion: s.observacion || "",
    esParcial: Boolean(s.esParcial || s.codigoSaca?.includes("PARCIAL")),
    fraccionTexto: s.fraccionTexto || (s.codigoSaca?.includes("PARCIAL") ? s.codigoSaca.match(/PARCIAL\s*([^)]+)/i)?.[1]?.trim() : undefined)
  }));

  const sacasConPeso = sacasLimpias.filter((s) => s.pesoKg > 0);
  const pesoRealDescargaKg = Number(
    sacasLimpias.reduce((sum, s) => sum + (Number(s.pesoKg) || 0), 0).toFixed(2)
  );

  const pesoIngresoKg = Number(params.pesoIngresoKg) || 0;
  const humedadPromedioIngreso = Number(Number(params.humedadPromedioIngreso || 0).toFixed(2));
  const pesoProyectadoKg = calcularPesoProyectadoDescarga(pesoIngresoKg, humedadPromedioIngreso);

  const diferenciaKg = Number((pesoRealDescargaKg - pesoProyectadoKg).toFixed(2));
  const toleranciaKg = calcularToleranciaDescargaKg(pesoIngresoKg);

  let estadoComparacion: "SIN_REGISTRO" | "CONFORME" | "FALTANTE" | "EXCESO" = "SIN_REGISTRO";
  let cumpleTolerancia = false;

  if (sacasConPeso.length > 0 && pesoRealDescargaKg > 0) {
    if (Math.abs(diferenciaKg) <= toleranciaKg) {
      estadoComparacion = "CONFORME";
      cumpleTolerancia = true;
    } else if (diferenciaKg < -toleranciaKg) {
      estadoComparacion = "FALTANTE";
      cumpleTolerancia = false;
    } else {
      estadoComparacion = "EXCESO";
      cumpleTolerancia = false;
    }
  }

  const fueraDeRango = estadoComparacion === "FALTANTE" || estadoComparacion === "EXCESO";
  const sustentoLimpio = (params.sustentoObservacionAlarma || "").trim();
  const alarmaAceptada = Boolean(fueraDeRango && params.alarmaAceptada && sustentoLimpio.length > 0);
  const alarmaActiva = Boolean(fueraDeRango && !alarmaAceptada);

  // Si no se proveyó cantidadSacasTexto pero hay una saca parcial, deducir etiqueta
  let cantidadSacasTexto = params.cantidadSacasTexto?.trim();
  if (!cantidadSacasTexto && sacasLimpias.length > 0) {
    const lastSaca = sacasLimpias[sacasLimpias.length - 1];
    if (lastSaca.esParcial && lastSaca.fraccionTexto) {
      cantidadSacasTexto = `${sacasLimpias.length - 1} ${lastSaca.fraccionTexto}`;
    } else {
      cantidadSacasTexto = String(sacasLimpias.length);
    }
  }

  return {
    batchId: params.batchId,
    correlativo: params.correlativo || params.batchId,
    cantidadSacasTexto,
    sacas: sacasLimpias,
    pesoIngresoKg,
    humedadPromedioIngreso,
    pesoProyectadoKg,
    pesoRealDescargaKg,
    diferenciaKg,
    toleranciaKg,
    cumpleTolerancia,
    estadoComparacion,
    alarmaActiva,
    alarmaAceptada,
    sustentoObservacionAlarma: sustentoLimpio || undefined,
    aceptadoPor: alarmaAceptada ? params.aceptadoPor || params.actualizadoPor || "Supervisor Planta" : undefined,
    fechaAceptacionAlarma: alarmaAceptada ? params.fechaAceptacionAlarma || new Date().toLocaleString("es-PE") : undefined,
    observaciones: params.observaciones || "",
    fotoFichaPesosUrl: params.fotoFichaPesosUrl || undefined,
    fotoFichaNombre: params.fotoFichaNombre || undefined,
    fotoFichaFecha: params.fotoFichaFecha || undefined,
    actualizadoPor: params.actualizadoPor || "Operador Balanza",
    fechaActualizacion: new Date().toISOString()
  };
}

/**
 * Resuelve automáticamente el Peso de Ingreso y la Humedad Promedio de los Análisis de Ingreso
 * para un Batch específico a partir de sus lotes asignados y análisis de recepción.
 */
export function resolverDatosIngresoBatchParaDescarga(options: {
  batchId: string;
  correlativo?: string;
  batch?: BatchVaporizado | null;
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  analisisHumList?: AnalisisHumedo[];
  humedades?: RegistroHumedad[];
  presecados?: Presecado[];
  controles?: ControlVaporizado[];
  programaciones?: any[];
}): DatosBaseDescargaBatch {
  const bId = (options.batchId || options.batch?.BATCH_ID || "").toString().trim();
  const corr = (options.correlativo || options.batch?.CORRELATIVO || bId).toString().trim();
  const bIdUpper = bId.toUpperCase();
  const corrUpper = corr.toUpperCase();

  const allBatches = localDB.getBatches() || [];
  const batchRef =
    options.batch ||
    allBatches.find((b) => {
      const idU = (b.BATCH_ID || "").toString().trim().toUpperCase();
      const corrU = (b.CORRELATIVO || "").toString().trim().toUpperCase();
      return (
        (bIdUpper && (idU === bIdUpper || corrU === bIdUpper)) ||
        (corrUpper && (idU === corrUpper || corrU === corrUpper))
      );
    }) ||
    null;

  const allBatchLotes = options.batchLotes || localDB.getBatchLotes() || [];
  const allLotes = options.lotes || localDB.getLotes() || [];
  const allAnalisisHum = options.analisisHumList || localDB.getState().analisisHumedo || [];
  const allHumedades = options.humedades || localDB.getState().registroHumedad || [];
  const allPresecados = options.presecados || localDB.getState().presecado || [];
  const allControles = options.controles || localDB.getControlVaporizado() || [];
  const allProgs =
    options.programaciones && options.programaciones.length > 0
      ? options.programaciones
      : cargarProgramacionesOficiales();

  const progMatch = (allProgs || []).find((p: any) => {
    const pB = (p?.batch || p?.id || "").toString().trim().toUpperCase();
    return (bIdUpper && pB === bIdUpper) || (corrUpper && pB === corrUpper);
  });

  const ctrlMatch = (allControles || []).find((c) => {
    const cB = (c.BATCH_ID || "").toString().trim().toUpperCase();
    const cC = (c.CORRELATIVO || "").toString().trim().toUpperCase();
    const cCod = (c.datosIngreso?.codigo || "").toString().trim().toUpperCase();
    return (
      (bIdUpper && (cB === bIdUpper || cC === bIdUpper || cCod === bIdUpper)) ||
      (corrUpper && (cB === corrUpper || cC === corrUpper || cCod === corrUpper))
    );
  });

  let bls = allBatchLotes.filter((bl) => {
    const blB = (bl.BATCH_ID || "").toString().trim().toUpperCase();
    return (bIdUpper && blB === bIdUpper) || (corrUpper && blB === corrUpper);
  });

  if (bls.length === 0 && batchRef) {
    const rawLotesList: string[] =
      Array.isArray(batchRef.LOTES_UNION) && batchRef.LOTES_UNION.length > 0
        ? batchRef.LOTES_UNION
        : Array.isArray((batchRef as any).lotes) && (batchRef as any).lotes.length > 0
        ? (batchRef as any).lotes
        : typeof (batchRef as any).lote === "string" && (batchRef as any).lote.trim()
        ? [(batchRef as any).lote.trim()]
        : [];

    if (rawLotesList.length > 0) {
      bls = rawLotesList.map((lid, idx) => {
        const matchedL = allLotes.find((l) => l.LOTE_ID === lid || compareLoteCodes(l.LOTE_ID, lid));
        return {
          BATCH_LOTE_ID: `${bId}-BL-${idx + 1}`,
          BATCH_ID: bId,
          LOTE_ID: matchedL?.LOTE_ID || lid,
          SACOS: matchedL?.SACOS || 0,
          PESO_KG: matchedL?.PESO_KG || 0,
          ORDEN: idx + 1,
          ESTADO: matchedL?.ESTADO_LOTE || "PROGRAMADO",
          CLIENTE: matchedL?.CLIENTE || batchRef.CLIENTE,
          VARIEDAD: matchedL?.VARIEDAD || batchRef.VARIEDAD,
          OBSERVACIONES: ""
        } as BatchLote;
      });
    }
  }

  if (bls.length === 0 && progMatch && Array.isArray(progMatch.filasLote) && progMatch.filasLote.length > 0) {
    bls = progMatch.filasLote.map((f: any, idx: number) => ({
      BATCH_LOTE_ID: `BL-${bId}-${f.loteId || f.LOTE_ID || idx}`,
      BATCH_ID: bId,
      LOTE_ID: f.loteId || f.LOTE_ID || "",
      SACOS: Number(f.sacProg ?? f.sacos ?? 0),
      PESO_KG: Number(f.pesoProg ?? f.peso ?? 0),
      ORDEN: idx + 1,
      ESTADO: "PROGRAMADO",
      CLIENTE: f.cliente || progMatch.clientePrincipal,
      VARIEDAD: f.variedad || progMatch.variedadPrincipal,
      OBSERVACIONES: ""
    }));
  } else if (
    bls.length === 0 &&
    batchRef &&
    Array.isArray((batchRef as any).filasLote) &&
    (batchRef as any).filasLote.length > 0
  ) {
    bls = (batchRef as any).filasLote.map((f: any, idx: number) => ({
      BATCH_LOTE_ID: `BL-${bId}-${f.loteId || f.LOTE_ID || idx}`,
      BATCH_ID: bId,
      LOTE_ID: f.loteId || f.LOTE_ID || "",
      SACOS: Number(f.sacProg ?? f.sacos ?? 0),
      PESO_KG: Number(f.pesoProg ?? f.peso ?? 0),
      ORDEN: idx + 1,
      ESTADO: "PROGRAMADO",
      CLIENTE: f.cliente || batchRef?.CLIENTE,
      VARIEDAD: f.variedad || batchRef?.VARIEDAD,
      OBSERVACIONES: ""
    }));
  }

  let totalPesoLotesKg = 0;
  let sumHumPonderada = 0;
  let lotesConHumCount = 0;

  const lotesDetalle: DetalleLoteIngresoDescarga[] = bls
    .map((bl) => {
      const lid = (bl.LOTE_ID || "").toString().trim();
      if (!lid) return null;

      const lot = allLotes.find((l) => l.LOTE_ID === lid || compareLoteCodes(l.LOTE_ID, lid));
      const ahObj = allAnalisisHum.find(
        (a) => a.LOTE_ID === lid || compareLoteCodes(a.LOTE_ID, lid)
      );
      const regHumLote = allHumedades.filter(
        (h) => h.LOTE_ID === lid || compareLoteCodes(h.LOTE_ID, lid)
      );
      const preLote = allPresecados.filter(
        (p) => p.LOTE_ID === lid || compareLoteCodes(p.LOTE_ID, lid)
      );
      const progFila = Array.isArray(progMatch?.filasLote)
        ? progMatch.filasLote.find((f: any) => compareLoteCodes(f.loteId || f.LOTE_ID, lid))
        : undefined;

      const sacosIngresados =
        bl.SACOS && bl.SACOS > 0
          ? Number(bl.SACOS)
          : Number(progFila?.sacProg || progFila?.sacos || lot?.SACOS || (bl.PESO_KG ? Math.round(Number(bl.PESO_KG) / 50) : 0));

      const pesoKg =
        bl.PESO_KG && bl.PESO_KG > 0
          ? Number(bl.PESO_KG)
          : Number(progFila?.pesoProg || progFila?.peso || lot?.PESO_KG || sacosIngresados * 50 || 0);

      let humLote: number | undefined =
        lot?.HUM !== undefined && Number(lot.HUM) > 0
          ? Number(lot.HUM)
          : lot?.HUMEDAD !== undefined && Number(lot.HUMEDAD) > 0
          ? Number(lot.HUMEDAD)
          : ahObj?.HUMEDADES !== undefined && Number(ahObj.HUMEDADES) > 0
          ? Number(ahObj.HUMEDADES)
          : undefined;

      let fuente = "Análisis de Ingreso del Lote";

      if (humLote === undefined && regHumLote.length > 0) {
        const val = Number(regHumLote[0]["H. PROMEDIO"] ?? regHumLote[0]["PROM. GENERAL"]);
        if (!isNaN(val) && val > 0) {
          humLote = val;
          fuente = "Registro Humedad de Ingreso";
        }
      }
      if (humLote === undefined && preLote.length > 0) {
        const val = Number(preLote[0].Humedad);
        if (!isNaN(val) && val > 0) {
          humLote = val;
          fuente = "Análisis Presecado";
        }
      }
      if (humLote === undefined && progFila?.ph !== undefined && Number(progFila.ph) > 0) {
        humLote = Number(progFila.ph);
        fuente = "Programación del Batch";
      }

      const humFinalLote = humLote !== undefined && !isNaN(humLote) ? Number(humLote.toFixed(1)) : 14.5;

      totalPesoLotesKg += pesoKg;
      if (humLote !== undefined && !isNaN(humLote)) {
        sumHumPonderada += humLote * (pesoKg > 0 ? pesoKg : 1);
        lotesConHumCount++;
      }

      return {
        loteId: lot?.LOTE_ID || lid,
        sacos: sacosIngresados,
        pesoKg,
        humedadIngreso: humFinalLote,
        fuenteHumedad: fuente,
        cliente: lot?.CLIENTE || bl.CLIENTE || batchRef?.CLIENTE,
        variedad: lot?.VARIEDAD || bl.VARIEDAD || batchRef?.VARIEDAD
      };
    })
    .filter(Boolean) as DetalleLoteIngresoDescarga[];

  // Peso de ingreso fijo del batch (mismo criterio que en la pestaña BATCHES)
  const pesoIngresoKg = Number(
    batchRef?.PESO_TOTAL_KG ||
      (batchRef?.TON_PROCESADAS
        ? batchRef.TON_PROCESADAS * 1000
        : batchRef?.TON_PROGRAMADAS
        ? batchRef.TON_PROGRAMADAS * 1000
        : totalPesoLotesKg > 0
        ? totalPesoLotesKg
        : ctrlMatch?.datosIngreso?.pesoKg ||
          ctrlMatch?.datosIngreso?.pesoTotalKg ||
          progMatch?.pesoTotalKg ||
          18000)
  );

  // Humedad promedio fija del batch (mismo criterio que en la pestaña BATCHES)
  let humedadPromedioIngreso = 14.5;
  if (totalPesoLotesKg > 0 && sumHumPonderada > 0) {
    humedadPromedioIngreso = Number((sumHumPonderada / totalPesoLotesKg).toFixed(1));
  } else if (lotesConHumCount > 0) {
    humedadPromedioIngreso = Number((sumHumPonderada / lotesConHumCount).toFixed(1));
  } else if ((batchRef as any)?.HUMEDAD_PROMEDIO !== undefined && Number((batchRef as any).HUMEDAD_PROMEDIO) > 0) {
    humedadPromedioIngreso = Number(Number((batchRef as any).HUMEDAD_PROMEDIO).toFixed(1));
  } else if (progMatch?.promedios?.ph && Number(progMatch.promedios.ph) > 0) {
    humedadPromedioIngreso = Number(Number(progMatch.promedios.ph).toFixed(1));
  } else if (ctrlMatch?.datosIngreso?.humedadPct && Number(ctrlMatch.datosIngreso.humedadPct) > 0) {
    humedadPromedioIngreso = Number(Number(ctrlMatch.datosIngreso.humedadPct).toFixed(1));
  } else if (ctrlMatch?.HUMEDAD_INGRESO && Number(ctrlMatch.HUMEDAD_INGRESO) > 0) {
    humedadPromedioIngreso = Number(Number(ctrlMatch.HUMEDAD_INGRESO).toFixed(1));
  }

  const pesoProyectadoKg = calcularPesoProyectadoDescarga(pesoIngresoKg, humedadPromedioIngreso);
  const toleranciaKg = calcularToleranciaDescargaKg(pesoIngresoKg);

  return {
    batchId: bId || corr,
    correlativo: corr || bId,
    pesoIngresoKg,
    humedadPromedioIngreso,
    pesoProyectadoKg,
    toleranciaKg,
    rangoMinimoAceptableKg: Number(Math.max(0, pesoProyectadoKg - toleranciaKg).toFixed(2)),
    rangoMaximoAceptableKg: Number((pesoProyectadoKg + toleranciaKg).toFixed(2)),
    lotesDetalle
  };
}

/**
 * Lee el mapa local de todos los registros de Sacas de Descarga guardados
 */
function loadLocalSacasMap(): Record<string, RegistroSacasDescarga> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SACAS_DESCARGA);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalSacasMap(map: Record<string, RegistroSacasDescarga>) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_SACAS_DESCARGA, JSON.stringify(map));
  } catch (e) {
    console.warn("Error guardando sacas de descarga en localStorage:", e);
  }
}

/**
 * Obtiene el Registro de Sacas de Descarga de un Batch (desde localStorage, ControlVaporizado o BatchVaporizado)
 * Siempre toma el Peso de Ingreso y Humedad Promedio fijos del Batch solicitado.
 */
export function obtenerRegistroSacasDescargaBatch(
  batchId: string,
  correlativo?: string,
  datosBase?: DatosBaseDescargaBatch,
  batchObj?: BatchVaporizado | null,
  ctrlObj?: Partial<ControlVaporizado> | null
): RegistroSacasDescarga {
  const bKey = (batchId || "").trim().toUpperCase();
  const cKey = (correlativo || batchId || "").trim().toUpperCase();

  const resolvedBase =
    datosBase ||
    resolverDatosIngresoBatchParaDescarga({
      batchId,
      correlativo,
      batch: batchObj
    });

  const map = loadLocalSacasMap();
  const fromLocal = (bKey && map[bKey]) || (cKey && map[cKey]);

  const fromCtrl =
    ctrlObj?.registroSacasDescarga ||
    (Array.isArray(ctrlObj?.sacasDescarga) && ctrlObj!.sacasDescarga!.length > 0
      ? {
          sacas: ctrlObj!.sacasDescarga!
        }
      : null);

  const fromBatch =
    batchObj?.REGISTRO_SACAS_DESCARGA ||
    (Array.isArray(batchObj?.SACAS_DESCARGA) && batchObj!.SACAS_DESCARGA!.length > 0
      ? {
          sacas: batchObj!.SACAS_DESCARGA!
        }
      : null);

  const source: any = fromLocal || fromCtrl || fromBatch;

  // Valor fijo del Batch solicitado: siempre se toma de resolvedBase
  const pesoIngresoKg = resolvedBase.pesoIngresoKg;
  const humedadPromedioIngreso = resolvedBase.humedadPromedioIngreso;

  return evaluarBalanceSacasDescarga({
    batchId: batchId || correlativo || "",
    correlativo: correlativo || batchId || "",
    cantidadSacasTexto: source?.cantidadSacasTexto || batchObj?.CANTIDAD_SACAS_TEXTO || undefined,
    sacas: Array.isArray(source?.sacas) ? source.sacas : [],
    pesoIngresoKg,
    humedadPromedioIngreso,
    alarmaAceptada: source?.alarmaAceptada ?? batchObj?.ALARMA_PESO_DESCARGA_ACEPTADA ?? false,
    sustentoObservacionAlarma:
      source?.sustentoObservacionAlarma || batchObj?.SUSTENTO_ALARMA_PESO_DESCARGA || undefined,
    aceptadoPor: source?.aceptadoPor || undefined,
    fechaAceptacionAlarma: source?.fechaAceptacionAlarma || undefined,
    observaciones: source?.observaciones || "",
    fotoFichaPesosUrl: source?.fotoFichaPesosUrl || undefined,
    fotoFichaNombre: source?.fotoFichaNombre || undefined,
    fotoFichaFecha: source?.fotoFichaFecha || undefined,
    actualizadoPor: source?.actualizadoPor || "Operador Balanza"
  });
}

/**
 * Guarda y sincroniza el Registro de Sacas de Descarga en localStorage, localDB y Firestore
 */
export function guardarRegistroSacasDescargaBatch(
  registro: RegistroSacasDescarga,
  usuario: string = "Operador Balanza"
): RegistroSacasDescarga {
  const evaluado = evaluarBalanceSacasDescarga({
    batchId: registro.batchId,
    correlativo: registro.correlativo,
    cantidadSacasTexto: registro.cantidadSacasTexto,
    sacas: registro.sacas,
    pesoIngresoKg: registro.pesoIngresoKg,
    humedadPromedioIngreso: registro.humedadPromedioIngreso,
    alarmaAceptada: registro.alarmaAceptada,
    sustentoObservacionAlarma: registro.sustentoObservacionAlarma,
    aceptadoPor: registro.aceptadoPor,
    fechaAceptacionAlarma: registro.fechaAceptacionAlarma,
    observaciones: registro.observaciones,
    fotoFichaPesosUrl: registro.fotoFichaPesosUrl,
    fotoFichaNombre: registro.fotoFichaNombre,
    fotoFichaFecha: registro.fotoFichaFecha,
    actualizadoPor: usuario
  });

  const bKey = (evaluado.batchId || "").trim().toUpperCase();
  const cKey = (evaluado.correlativo || evaluado.batchId || "").trim().toUpperCase();

  // 1. Guardar en localStorage dedicado
  const map = loadLocalSacasMap();
  if (bKey) map[bKey] = evaluado;
  if (cKey) map[cKey] = evaluado;
  saveLocalSacasMap(map);

  // 2. Actualizar BatchVaporizado en localDB y Firestore
  try {
    const batches = localDB.getBatches() || [];
    const targetBatch = batches.find((b) => {
      const idU = (b.BATCH_ID || "").trim().toUpperCase();
      const corrU = (b.CORRELATIVO || "").trim().toUpperCase();
      return (bKey && (idU === bKey || corrU === bKey)) || (cKey && (idU === cKey || corrU === cKey));
    });

    if (targetBatch) {
      const updatedBatch = localDB.updateBatch(
        targetBatch.BATCH_ID,
        {
          SACAS_DESCARGA: evaluado.sacas,
          REGISTRO_SACAS_DESCARGA: evaluado,
          CANTIDAD_SACAS_TEXTO: evaluado.cantidadSacasTexto,
          PESO_REAL_DESCARGA_KG: evaluado.pesoRealDescargaKg,
          PESO_PROYECTADO_DESCARGA_KG: evaluado.pesoProyectadoKg,
          DIFERENCIA_DESCARGA_KG: evaluado.diferenciaKg,
          CUMPLE_TOLERANCIA_DESCARGA: evaluado.cumpleTolerancia,
          ALARMA_PESO_DESCARGA_ACTIVA: evaluado.alarmaActiva,
          ALARMA_PESO_DESCARGA_ACEPTADA: evaluado.alarmaAceptada,
          SUSTENTO_ALARMA_PESO_DESCARGA: evaluado.sustentoObservacionAlarma || ""
        },
        usuario
      );
      if (updatedBatch) {
        cloudSyncService.syncBatch(updatedBatch).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Aviso sincronizando sacas de descarga en Batch:", err);
  }

  // 3. Actualizar ControlVaporizado en localDB y Firestore si existe
  try {
    const controles = localDB.getControlVaporizado() || [];
    const targetCtrl = controles.find((c) => {
      const idU = (c.BATCH_ID || "").trim().toUpperCase();
      const corrU = (c.CORRELATIVO || c.datosIngreso?.codigo || "").trim().toUpperCase();
      return (bKey && (idU === bKey || corrU === bKey)) || (cKey && (idU === cKey || corrU === cKey));
    });

    if (targetCtrl) {
      const savedRes = localDB.saveControlVaporizado(
        {
          ...targetCtrl,
          sacasDescarga: evaluado.sacas,
          registroSacasDescarga: evaluado
        },
        usuario
      );
      const savedCtrl = savedRes?.control || savedRes;
      if (savedCtrl) {
        cloudSyncService.syncControl(savedCtrl).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Aviso sincronizando sacas de descarga en ControlVaporizado:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sacas-descarga-updated", {
        detail: evaluado
      })
    );
  }

  return evaluado;
}

/**
 * Sustenta la observación de desviación de peso proyectado y acepta el lote/batch para retirar su alarma
 */
export function sustentarYAceptarAlarmaSacasDescarga(params: {
  batchId: string;
  correlativo?: string;
  sustento: string;
  usuario?: string;
  batch?: BatchVaporizado | null;
  ctrl?: Partial<ControlVaporizado> | null;
}): RegistroSacasDescarga {
  const actual = obtenerRegistroSacasDescargaBatch(
    params.batchId,
    params.correlativo,
    undefined,
    params.batch,
    params.ctrl
  );
  const sustentoLimpio = (params.sustento || "").trim();
  const usuarioFinal = params.usuario || "Supervisor Planta";
  const fechaStr = new Date().toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  return guardarRegistroSacasDescargaBatch(
    {
      ...actual,
      alarmaAceptada: sustentoLimpio.length > 0,
      alarmaActiva: sustentoLimpio.length === 0,
      sustentoObservacionAlarma: sustentoLimpio,
      aceptadoPor: usuarioFinal,
      fechaAceptacionAlarma: fechaStr,
      observaciones: sustentoLimpio || actual.observaciones
    },
    usuarioFinal
  );
}
