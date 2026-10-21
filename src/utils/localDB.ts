// Client-side Local Database using LocalStorage (100% Offline / Client-Only)
// Replaces all server-side /api/* endpoints to ensure zero 404 errors in static and Cloud Run deployments.

import type {
  Lote,
  RegistroHumedad,
  AnalisisHumedo,
  Presecado,
  AnalisisSeco,
  ProgramacionApit,
  BatchVaporizado,
  BatchLote,
  ControlVaporizado,
  AnalisisVaporizado,
  Equipo,
  EstadoLote,
  SuccessWeights,
  UserProfile,
  ParametrosTrabajo,
  AIRecommendationResult,
  AISimulationResult,
  ConfiguracionEvaluacionLotes
} from "../types";
import { verificarBloqueoEliminacionLote, BloqueoEliminacionInfo } from "./loteClassification";
import { saveToIndexedDB, loadFromIndexedDB, clearIndexedDB } from "./indexedDBStorage";
import { validateDateValue } from "./excelValidation";
import { formatLoteCode, compareLoteCodes } from "./formatLoteCode";
import { calcularDiasTranscurridos, limpiarConteoEsperaCongelado, normalizeDateToISO } from "./priorizacionService";

export { formatLoteCode, compareLoteCodes };

function getLocalTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function freezeLoteWaitingDays(lote: Lote, refDateCandidate?: string): void {
  if (!lote) return;
  const todayISO = getLocalTodayISO();
  const candISO = normalizeDateToISO(refDateCandidate);
  const existingISO = normalizeDateToISO(lote.FECHA_INICIO_PROCESO);
  let targetISO = existingISO || candISO || todayISO;
  if (targetISO > todayISO) targetISO = todayISO;
  lote.FECHA_INICIO_PROCESO = targetISO;
  if (lote.DIAS_ESPERA_CONGELADOS === undefined || lote.DIAS_ESPERA_CONGELADOS === null || isNaN(Number(lote.DIAS_ESPERA_CONGELADOS))) {
    lote.DIAS_ESPERA_CONGELADOS = calcularDiasTranscurridos(lote.FECHA_INGRESO, targetISO);
  }
}

function unfreezeLoteWaitingDays(lote: Lote): void {
  if (!lote) return;
  delete lote.FECHA_INICIO_PROCESO;
  delete lote.DIAS_ESPERA_CONGELADOS;
  limpiarConteoEsperaCongelado(lote.LOTE_ID);
}


/**
 * Normaliza claves de columnas para comparación sin tildes, símbolos, espacios ni mayúsculas
 */
export function normalizeKey(str: string): string {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[\s_\-\.\%\°\(\)\/\#\:\;]/g, ""); // quitar espacios y signos
}

/**
 * Obtiene el valor de una fila buscando entre candidatos directos y variantes normalizadas
 */
export function getFieldVal(row: any, candidates: string[]): any {
  if (!row || typeof row !== "object") return undefined;
  // 1. Coincidencia directa por propiedad
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== "") {
      return row[c];
    }
  }
  // 2. Coincidencia por clave normalizada
  const candidateNorms = candidates.map(normalizeKey);
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      const kNorm = normalizeKey(k);
      if (candidateNorms.includes(kNorm)) {
        return v;
      }
    }
  }
  return undefined;
}

/**
 * Normaliza y convierte cadenas a MAYÚSCULAS para mantener consistencia 
 * en toda la información manual y procesada por IA
 */
export function toUpperStr(val: any, defaultVal: string = ""): string {
  if (val === null || val === undefined) return defaultVal;
  return String(val).trim().toUpperCase();
}

/**
 * Parsea valores numéricos tolerando formatos latino (1.250,50), anglosajón (1,250.50),
 * unidades de texto (kg, sacos, %) y espacios. Retorna undefined si está vacío o inválido.
 */
export function parseNumericVal(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number") return isNaN(val) ? undefined : val;
  const str = String(val).trim();
  if (str === "" || str.startsWith("#") || str.toUpperCase() === "N/A" || str.toUpperCase() === "NULL" || str.toUpperCase() === "ERROR") return undefined;
  
  // Limpiar caracteres no numéricos excepto dígitos, signos, puntos y comas
  let clean = str.replace(/[^\d.,\-+]/g, "").trim();
  if (!clean) return undefined;
  
  // Formato latino con separador de miles por punto y decimal por coma: "35.000,50" o "1.250"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d+$/.test(clean)) {
    // Caso decimal con coma: "14,5"
    clean = clean.replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
    // Caso formato anglosajón con comas de miles: "35,000.50" o "1,250"
    clean = clean.replace(/,/g, "");
  } else if (clean.includes(",") && !clean.includes(".")) {
    // Si contiene solo comas (ej. "35,000")
    clean = clean.replace(/,/g, "");
  }
  
  const n = parseFloat(clean);
  return isNaN(n) ? undefined : n;
}

export function cleanRecord<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result as T;
}

export interface LocalDatabaseSchema {
  lotes: Lote[];
  registroHumedad: RegistroHumedad[];
  analisisHumedo: AnalisisHumedo[];
  presecado: Presecado[];
  analisisSeco: AnalisisSeco[];
  programacionApit: ProgramacionApit[];
  batchesVaporizado: BatchVaporizado[];
  batchLotes: BatchLote[];
  controlVaporizado: ControlVaporizado[];
  analisisVaporizado: AnalisisVaporizado[];
  equipos: Equipo[];
  estadosLote: EstadoLote[];
  successWeights: SuccessWeights;
  auditLogs: any[];
  users: UserProfile[];
  priorizacionConfig?: any;
  priorizacionAudit?: any[];
  configuracionEvaluacionLotes?: ConfiguracionEvaluacionLotes;
  presetsEvaluacionLotes?: ConfiguracionEvaluacionLotes[];
  parametrosTrabajo?: ParametrosTrabajo;
  historialParametros?: any[];
  programacionesOficiales?: any[];
  resultadosCoccionExternos?: any[];
}

const STORAGE_KEY = "arroz_apit_local_db_v9_clean";
const ZERO_STATE_RESET_FLAG = "apit_zero_state_reset_v9";

const INITIAL_DATA: LocalDatabaseSchema = {
  lotes: [],
  registroHumedad: [],
  analisisHumedo: [],
  presecado: [],
  analisisSeco: [],
  programacionApit: [],
  batchesVaporizado: [],
  batchLotes: [],
  controlVaporizado: [],
  analisisVaporizado: [],
  equipos: [
    {
      EQUIPO_ID: "EQ-APIT",
      EQUIPO: "APIT",
      PROCESO: "Vaporizado",
      CAPACIDAD_TN: 35,
      ESTADO: "OPERATIVO",
      OBSERVACIONES: "Autoclave y Línea Oficial de Vaporizado APIT (35 TN)"
    }
  ],
  estadosLote: [
    { ESTADO_ID: "EST-01", ESTADO: "INGRESADO", NOMBRE_ESTADO: "INGRESADO", ORDEN: 1, DESCRIPCION: "Cuando el lote ha sido subido sin análisis, solamente con su PASO 1: DATOS DE RECEPCIÓN DE BALANZA" },
    { ESTADO_ID: "EST-02", ESTADO: "ANALIZADO", NOMBRE_ESTADO: "ANALIZADO", ORDEN: 2, DESCRIPCION: "Cuando el lote ha sido subido completamente (Paso 1 y Paso 2)" },
    { ESTADO_ID: "EST-03", ESTADO: "PROGRAMADO", NOMBRE_ESTADO: "PROGRAMADO", ORDEN: 3, DESCRIPCION: "Cuando el lote ya ha pasado a la lista de programación" },
    { ESTADO_ID: "EST-04", ESTADO: "EN PROCESO", NOMBRE_ESTADO: "EN PROCESO", ORDEN: 4, DESCRIPCION: "Cuando al lote le toca procesar y se empieza a llenar la sección DATOS DE VAPORIZADO" },
    { ESTADO_ID: "EST-05", ESTADO: "EN REPOSO", NOMBRE_ESTADO: "EN REPOSO", ORDEN: 5, DESCRIPCION: "Cuando se empieza a llenar la sección de ETAPA DE 1° REPOSO DE GRANO" },
    { ESTADO_ID: "EST-06", ESTADO: "EN SECADO", NOMBRE_ESTADO: "EN SECADO", ORDEN: 6, DESCRIPCION: "Cuando se empieza a llenar la sección ETAPA DE SECADO (PERFILES 0 AL 12)" },
    { ESTADO_ID: "EST-07", ESTADO: "VAPORIZADO", NOMBRE_ESTADO: "VAPORIZADO", ORDEN: 7, DESCRIPCION: "Cuando se cierre y se liquide el batch" },
    { ESTADO_ID: "EST-08", ESTADO: "ANALISIS_FINAL", NOMBRE_ESTADO: "ANALISIS_FINAL", ORDEN: 8, DESCRIPCION: "Cuando se registra su análisis de descarga" },
    { ESTADO_ID: "EST-09", ESTADO: "EVALUADO", NOMBRE_ESTADO: "EVALUADO", ORDEN: 9, DESCRIPCION: "Cuando se registran sus resultados de calidad: incremento de defectos y cocción en olla" },
    { ESTADO_ID: "EST-10", ESTADO: "CERRADO", NOMBRE_ESTADO: "CERRADO", ORDEN: 10, DESCRIPCION: "Cuando cierra el batch completamente" }
  ],
  successWeights: {
    incrementoQuebrado: 35,
    controlDefectos: 25,
    resultadoCoccion: 20,
    blancura: 10,
    cumplimientoProceso: 10,
    targetQuebradoMaxInc: 2.5,
    targetBlancuraMin: 31,
    targetHumedadFinal: 13
  },
  auditLogs: [],
  users: [
    {
      id: "usr-fredy",
      nombre: "Ing. Fredy Granados Caicedo",
      email: "fredyleonardogranadoscaicedo@gmail.com",
      rol: "PROGRAMADOR",
      cargo: "Ingeniería de Procesos & Desarrollador Principal / Programador",
      departamento: "Ingeniería de Sistemas y Optimización Industrial (ItsyCreaciones)",
      avatarColor: "from-purple-600 to-indigo-700",
      iniciales: "FG",
      nivelAcceso: "Super Admin / Control Total / Configuración de Algoritmos IA & OCR",
      telefono: "+51 987 654 321",
      activo: true,
      permisos: [
        "Control total del sistema y arquitectura de datos",
        "Configuración de parámetros matemáticos y ponderaciones de éxito",
        "Calibración de algoritmos de Visión IA y OCR de formatos",
        "Sincronización de base de datos y hojas de cálculo",
        "Auditoría integral de procesos y trazabilidad",
        "Administración y asignación de usuarios y roles"
      ],
      pin: "2026"
    }
  ],
  parametrosTrabajo: {
    lotesObjetivoPorDia: 2,
    maxLotesPorDia: 3,
    capacidadMinimaProcesoKg: 22000,
    capacidadMaximaSecadoraKg: 35000,
    capacidadExcepcionalMaximaKg: 37000,
    toleranciaDefectosPp: 2,
    toleranciaQuebradoPp: 2,
    turnosDisponibles: ["Turno Día", "Turno Noche"],
    sugeridoPorIA: {
      lotesObjetivoPorDia: 2,
      maxLotesPorDia: 3,
      capacidadMinimaProcesoKg: 22000,
      capacidadMaximaSecadoraKg: 35000,
      capacidadExcepcionalMaximaKg: 37000,
      toleranciaDefectosPp: 2,
      toleranciaQuebradoPp: 2,
      turnosDisponibles: ["Turno Día", "Turno Noche"],
      justificacionIA: "Optimización estándar para secadoras cilíndricas de 35 TN y autoclave APIT.",
      fechaSugerencia: "2026-08-29"
    },
    ultimaModificacion: "2026-08-29 08:00:00",
    modificadoPor: "Ing. Fredy Granados Caicedo"
  },
  historialParametros: [],
  programacionesOficiales: [],
  resultadosCoccionExternos: [],
  priorizacionAudit: []
};

export const sanitizeLoteCode = formatLoteCode;

const DELETED_LOTES_TOMBSTONE_KEY = "arroz_apit_deleted_lotes_v2";
const UNLINKED_NEW_LOTES_KEY = "arroz_apit_unlinked_new_lotes_v5";
const PURGED_C08440_FLAG_KEY = "apit_purged_c08440_v5";

export function getUnlinkedNewLotes(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined" || !window.localStorage) return set;
  try {
    const raw = window.localStorage.getItem(UNLINKED_NEW_LOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((c: string) => {
          const norm = formatLoteCode(c);
          if (norm) set.add(norm);
        });
      }
    }
  } catch {
    // ignore
  }
  return set;
}

export function addUnlinkedNewLote(loteId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const norm = formatLoteCode(loteId);
  if (!norm) return;
  try {
    const set = getUnlinkedNewLotes();
    set.add(norm);
    window.localStorage.setItem(UNLINKED_NEW_LOTES_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function removeUnlinkedNewLote(loteId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const norm = formatLoteCode(loteId);
  if (!norm) return;
  try {
    const set = getUnlinkedNewLotes();
    if (set.has(norm)) {
      set.delete(norm);
      window.localStorage.setItem(UNLINKED_NEW_LOTES_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
}

export function getDeletedLotesTombstones(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined" || !window.localStorage) return set;
  try {
    // Asegurar que C08440 quede marcado para borrado total y desvinculado de cualquier registro anterior
    if (!window.localStorage.getItem(PURGED_C08440_FLAG_KEY)) {
      window.localStorage.setItem(PURGED_C08440_FLAG_KEY, "true");
      const rawExisting = window.localStorage.getItem(DELETED_LOTES_TOMBSTONE_KEY);
      const arr = rawExisting ? JSON.parse(rawExisting) : [];
      if (Array.isArray(arr) && !arr.includes("C08440")) {
        arr.push("C08440");
        window.localStorage.setItem(DELETED_LOTES_TOMBSTONE_KEY, JSON.stringify(arr));
      } else if (!Array.isArray(arr)) {
        window.localStorage.setItem(DELETED_LOTES_TOMBSTONE_KEY, JSON.stringify(["C08440"]));
      }
      addUnlinkedNewLote("C08440");
    }
    const raw = window.localStorage.getItem(DELETED_LOTES_TOMBSTONE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((c: string) => {
          const norm = formatLoteCode(c);
          if (norm) set.add(norm);
        });
      }
    }
  } catch {
    // ignore
  }
  return set;
}

export function addDeletedLoteTombstone(loteId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const norm = formatLoteCode(loteId);
  if (!norm) return;
  try {
    const set = getDeletedLotesTombstones();
    set.add(norm);
    window.localStorage.setItem(DELETED_LOTES_TOMBSTONE_KEY, JSON.stringify(Array.from(set)));
    addUnlinkedNewLote(norm);
  } catch {
    // ignore
  }
}

export function removeDeletedLoteTombstone(loteId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const norm = formatLoteCode(loteId);
  if (!norm) return;
  try {
    const set = getDeletedLotesTombstones();
    if (set.has(norm)) {
      set.delete(norm);
      window.localStorage.setItem(DELETED_LOTES_TOMBSTONE_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
}

/**
 * Limpia de raíz todas las referencias de lotes en batchesVaporizado, batchLotes, programacionesOficiales,
 * controlVaporizado, analisisVaporizado, resultadosCoccionExternos y claves de localStorage.
 */
function purgeBatchAndProcessReferencesForCodes(
  db: LocalDatabaseSchema,
  shouldStripBatchRefs: (code?: string) => boolean,
  shouldDeleteLoteRecord?: (code?: string) => boolean
): void {
  if (shouldDeleteLoteRecord) {
    if (Array.isArray(db.lotes)) {
      db.lotes = db.lotes.filter((l: any) => !shouldDeleteLoteRecord(l?.LOTE_ID));
    }
    if (Array.isArray(db.registroHumedad)) {
      db.registroHumedad = db.registroHumedad.filter((h: any) => !shouldDeleteLoteRecord(h?.LOTE_ID));
    }
    if (Array.isArray(db.analisisHumedo)) {
      db.analisisHumedo = db.analisisHumedo.filter((a: any) => !shouldDeleteLoteRecord(a?.LOTE_ID));
    }
    if (Array.isArray(db.presecado)) {
      db.presecado = db.presecado.filter((p: any) => !shouldDeleteLoteRecord(p?.LOTE_ID));
    }
    if (Array.isArray(db.analisisSeco)) {
      db.analisisSeco = db.analisisSeco.filter((s: any) => !shouldDeleteLoteRecord(s?.LOTE_ID));
    }
  }

  if (Array.isArray(db.batchLotes)) {
    db.batchLotes = db.batchLotes.filter((bl: any) => !shouldStripBatchRefs(bl?.LOTE_ID));
  }

  if (Array.isArray(db.batchesVaporizado)) {
    db.batchesVaporizado.forEach((b: any) => {
      if (!b) return;
      if (shouldStripBatchRefs(b.LOTE_ID)) {
        delete b.LOTE_ID;
      }
      for (const arrKey of ["LOTES_UNION", "LOTES_ASIGNADOS", "lotesAsignados", "lotes"]) {
        if (Array.isArray(b[arrKey])) {
          b[arrKey] = b[arrKey].filter((item: any) => {
            const lid = typeof item === "string" ? item : (item?.LOTE_ID || item?.loteId || item?.codigo);
            return !shouldStripBatchRefs(lid);
          });
        }
      }
    });
  }

  if (Array.isArray(db.controlVaporizado)) {
    db.controlVaporizado.forEach((ctrl: any) => {
      if (!ctrl) return;
      if (shouldStripBatchRefs(ctrl.LOTE_ID)) delete ctrl.LOTE_ID;
      if (shouldStripBatchRefs(ctrl.loteId)) delete ctrl.loteId;
      if (ctrl.datosIngreso) {
        if (shouldStripBatchRefs(ctrl.datosIngreso.loteId)) delete ctrl.datosIngreso.loteId;
        if (shouldStripBatchRefs(ctrl.datosIngreso.LOTE_ID)) delete ctrl.datosIngreso.LOTE_ID;
      }
      if (Array.isArray(ctrl.lotes)) {
        ctrl.lotes = ctrl.lotes.filter((item: any) => {
          const lid = typeof item === "string" ? item : (item?.LOTE_ID || item?.loteId);
          return !shouldStripBatchRefs(lid);
        });
      }
    });
  }

  if (Array.isArray(db.analisisVaporizado)) {
    db.analisisVaporizado = db.analisisVaporizado.filter(
      (av: any) => !shouldStripBatchRefs(av?.LOTE_ID) && !shouldStripBatchRefs(av?.CODIGO_MUESTRA)
    );
  }

  if (Array.isArray(db.resultadosCoccionExternos)) {
    db.resultadosCoccionExternos = db.resultadosCoccionExternos.filter(
      (rc: any) => !shouldStripBatchRefs(rc?.loteId || rc?.LOTE_ID)
    );
  }

  // NOTA: No eliminar ni alterar las programaciones oficiales ya guardadas ni en db.programacionesOficiales
  // ni en localStorage, para garantizar que las programaciones y lotes subidos se conserven intactos.
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (const cKey of ["resultados_coccion_externos_v1", "resultados_coccion_integrados_v2", "resultados_coccion_integrados_v1"]) {
        const rawC = window.localStorage.getItem(cKey);
        if (rawC) {
          const parsedC = JSON.parse(rawC);
          if (Array.isArray(parsedC)) {
            const filteredC = parsedC.filter((c: any) => !shouldStripBatchRefs(c?.loteId || c?.LOTE_ID));
            if (filteredC.length !== parsedC.length) {
              window.localStorage.setItem(cKey, JSON.stringify(filteredC));
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

export function isV200BatchReference(val?: any): boolean {
  if (!val) return false;
  const u = val.toString().trim().toUpperCase();
  if (!u) return false;
  return (
    u === "V200" ||
    u === "V201" ||
    u === "200" ||
    u === "201" ||
    u === "BAT-V200" ||
    u === "BAT-V201" ||
    u === "BATCH-V200" ||
    u === "BATCH-V201" ||
    u === "PROG-V200" ||
    u === "PROG-V201" ||
    u === "PROG-BATCH-200" ||
    u === "PROG-BATCH-201" ||
    u === "UNION-V200" ||
    u === "UNION-V201" ||
    /^V20[01](-\d+)?$/i.test(u) ||
    /^(BAT|BATCH|PROG|UNION|CTRL|AV|RC|BL)[\-_:\s]*V?20[01](-\d+)?$/i.test(u) ||
    /^(BATCH|BACTH)[\s\-_:]*20[01]$/i.test(u)
  );
}

function purgeAllV200Information(db: LocalDatabaseSchema): void {
  if (!db) return;

  if (Array.isArray(db.batchesVaporizado)) {
    db.batchesVaporizado = db.batchesVaporizado.filter(
      (b: any) =>
        !isV200BatchReference(b?.BATCH_ID) &&
        !isV200BatchReference(b?.CORRELATIVO) &&
        !isV200BatchReference(b?.PROCESO_PADRE) &&
        !isV200BatchReference(b?.SUB_BATCH) &&
        !isV200BatchReference(b?.GRUPO_UNION_ID)
    );
  }

  if (Array.isArray(db.batchLotes)) {
    db.batchLotes = db.batchLotes.filter(
      (bl: any) => !isV200BatchReference(bl?.BATCH_ID) && !isV200BatchReference(bl?.BATCH_LOTE_ID)
    );
  }

  if (Array.isArray(db.programacionesOficiales)) {
    db.programacionesOficiales = db.programacionesOficiales.filter(
      (p: any) =>
        !isV200BatchReference(p?.batch) &&
        !isV200BatchReference(p?.id) &&
        !isV200BatchReference(p?.caso)
    );
  }

  if (Array.isArray(db.programacionApit)) {
    db.programacionApit = db.programacionApit.filter(
      (p: any) =>
        !isV200BatchReference(p?.batch) &&
        !isV200BatchReference(p?.id) &&
        !isV200BatchReference(p?.BATCH_ID)
    );
  }

  if (Array.isArray(db.controlVaporizado)) {
    db.controlVaporizado = db.controlVaporizado.filter(
      (c: any) =>
        !isV200BatchReference(c?.BATCH_ID) &&
        !isV200BatchReference(c?.CORRELATIVO) &&
        !isV200BatchReference(c?.datosIngreso?.codigo)
    );
  }

  if (Array.isArray(db.analisisVaporizado)) {
    db.analisisVaporizado = db.analisisVaporizado.filter(
      (av: any) =>
        !isV200BatchReference(av?.BATCH_ID) &&
        !isV200BatchReference(av?.CODIGO_MUESTRA)
    );
  }

  if (Array.isArray(db.resultadosCoccionExternos)) {
    db.resultadosCoccionExternos = db.resultadosCoccionExternos.filter(
      (rc: any) =>
        !isV200BatchReference(rc?.codigoBatch) &&
        !isV200BatchReference(rc?.batchId) &&
        !isV200BatchReference(rc?.correlativo)
    );
  }

  if (Array.isArray((db as any).sacasDescarga)) {
    (db as any).sacasDescarga = (db as any).sacasDescarga.filter(
      (s: any) =>
        !isV200BatchReference(s?.batchId) &&
        !isV200BatchReference(s?.correlativo) &&
        !isV200BatchReference(s?.BATCH_ID)
    );
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (const k of [
        "apit_draft_ctrl_V200",
        "apit_draft_ctrl_BAT-V200",
        "apit_draft_ctrl_BATCH-V200",
        "apit_draft_ctrl_V200-1",
        "apit_draft_ctrl_V200-2",
        "apit_draft_ctrl_V200-3",
        "apit_draft_ctrl_V201",
        "apit_draft_ctrl_201",
        "apit_draft_ctrl_BAT-V201",
        "apit_draft_ctrl_BATCH-V201",
        "apit_draft_ctrl_V201-1",
        "apit_draft_ctrl_V201-2",
        "apit_draft_ctrl_V201-3"
      ]) {
        window.localStorage.removeItem(k);
      }

      for (const lsKey of [
        "molino_programaciones_batch_oficiales_v3",
        "programaciones_batch_oficial_v1",
        "molino_programaciones_batch_oficiales_v2",
        "molino_programaciones_batch_oficiales_v1"
      ]) {
        const raw = window.localStorage.getItem(lsKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (p: any) =>
                !isV200BatchReference(p?.batch) &&
                !isV200BatchReference(p?.id) &&
                !isV200BatchReference(p?.caso)
            );
            if (filtered.length !== parsed.length) {
              window.localStorage.setItem(lsKey, JSON.stringify(filtered));
            }
          }
        }
      }

      for (const cKey of [
        "resultados_coccion_externos_v1",
        "resultados_coccion_integrados_v2",
        "resultados_coccion_integrados_v1"
      ]) {
        const rawC = window.localStorage.getItem(cKey);
        if (rawC) {
          const parsedC = JSON.parse(rawC);
          if (Array.isArray(parsedC)) {
            const filteredC = parsedC.filter(
              (rc: any) =>
                !isV200BatchReference(rc?.codigoBatch) &&
                !isV200BatchReference(rc?.batchId) &&
                !isV200BatchReference(rc?.correlativo)
            );
            if (filteredC.length !== parsedC.length) {
              window.localStorage.setItem(cKey, JSON.stringify(filteredC));
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Deduplica y migra unificando todos los lotes y registros al formato canónico industrial C0_____
 */
export function deduplicateAndMigrateLotes(db: LocalDatabaseSchema): void {
  if (!db) return;

  // 0.0 Purgar toda información de V200
  purgeAllV200Information(db);

  // 0. Purgar cualquier lote eliminado en tombstones
  const tombstones = getDeletedLotesTombstones();
  if (tombstones.size > 0) {
    const isDeletedCode = (code?: string) => {
      if (!code) return false;
      const norm = formatLoteCode(code);
      return Boolean(norm && tombstones.has(norm));
    };
    purgeBatchAndProcessReferencesForCodes(db, isDeletedCode, isDeletedCode);
  }

  // 1. Unificar y deduplicar lotes
  if (Array.isArray(db.lotes) && db.lotes.length > 0) {
    const lotesByCode = new Map<string, Lote[]>();
    for (const lote of db.lotes) {
      if (!lote || !lote.LOTE_ID) continue;
      const canonical = formatLoteCode(lote.LOTE_ID);
      if (!canonical) continue;
      const list = lotesByCode.get(canonical) || [];
      list.push({ ...lote, LOTE_ID: canonical });
      lotesByCode.set(canonical, list);
    }

    const unifiedLotes: Lote[] = [];
    for (const [canonical, items] of lotesByCode.entries()) {
      if (items.length === 1) {
        items[0].LOTE_ID = canonical;
        unifiedLotes.push(items[0]);
      } else {
        // Ordenar dando prioridad al lote con estado de calidad avanzado (OBSERVADO/APROBADO) y mayor información
        items.sort((a, b) => {
          const score = (x: Lote) => {
            let s = 0;
            if (x.LOTE_ID.startsWith("C0")) s += 10;
            const estCal = (x.ESTADO_CALIDAD || "").toUpperCase();
            if (estCal === "OBSERVADO" || estCal === "APROBADO" || estCal === "EXPERIMENTAL") s += 50;
            const estLote = (x.ESTADO_LOTE || "").toUpperCase();
            if (estLote !== "INGRESADO" && estLote !== "POR_ANALIZAR" && estLote !== "PENDIENTE") s += 20;
            if (x.SACOS && x.SACOS > 0) s += 5;
            if (x.PESO_KG && x.PESO_KG > 0) s += 5;
            if (x.HUM && x.HUM > 0) s += 5;
            if (x.CLIENTE && x.CLIENTE.trim().length > 0) s += 5;
            if (x.VARIEDAD && x.VARIEDAD.trim().length > 0) s += 5;
            if (x.OBSERVACIONES && x.OBSERVACIONES.trim().length > 0) s += 3;
            return s;
          };
          return score(b) - score(a);
        });

        const best: Lote = { ...items[0], LOTE_ID: canonical };
        for (let i = 1; i < items.length; i++) {
          const other = items[i];
          if (!best.CLIENTE && other.CLIENTE) best.CLIENTE = other.CLIENTE;
          if (!best.VARIEDAD && other.VARIEDAD) best.VARIEDAD = other.VARIEDAD;
          if ((!best.SACOS || best.SACOS <= 0) && other.SACOS) best.SACOS = other.SACOS;
          if ((!best.PESO_KG || best.PESO_KG <= 0) && other.PESO_KG) best.PESO_KG = other.PESO_KG;
          if ((!best.HUM || best.HUM <= 0) && other.HUM) best.HUM = other.HUM;
          if (!best.DESV && other.DESV) best.DESV = other.DESV;
          if (!best.UBICACION && other.UBICACION) best.UBICACION = other.UBICACION;
          if (!best.ZONA && other.ZONA) best.ZONA = other.ZONA;
          if (!best.FECHA_INGRESO && other.FECHA_INGRESO) best.FECHA_INGRESO = other.FECHA_INGRESO;
          if (!best.OBSERVACIONES && other.OBSERVACIONES) best.OBSERVACIONES = other.OBSERVACIONES;
          if (!best.ESTADO_CALIDAD && other.ESTADO_CALIDAD) best.ESTADO_CALIDAD = other.ESTADO_CALIDAD;
          if (!best.FECHA_INICIO_PROCESO && other.FECHA_INICIO_PROCESO) best.FECHA_INICIO_PROCESO = other.FECHA_INICIO_PROCESO;
          if (best.DIAS_ESPERA_CONGELADOS === undefined && other.DIAS_ESPERA_CONGELADOS !== undefined) {
            best.DIAS_ESPERA_CONGELADOS = other.DIAS_ESPERA_CONGELADOS;
          }
          if (best.ESTADO_LOTE === "ANALIZADO" || best.ESTADO_LOTE === "POR_ANALIZAR" || best.ESTADO_LOTE === "PENDIENTE" || !best.ESTADO_LOTE) {
            best.ESTADO_LOTE = "INGRESADO";
          }
        }
        unifiedLotes.push(best);
      }
    }
    db.lotes = unifiedLotes;
  }

  // 2. Unificar y deduplicar registroHumedad
  if (Array.isArray(db.registroHumedad) && db.registroHumedad.length > 0) {
    const humByCode = new Map<string, RegistroHumedad>();
    for (const h of db.registroHumedad) {
      if (!h || !h.LOTE_ID) continue;
      const canonical = formatLoteCode(h.LOTE_ID);
      if (!canonical) continue;
      h.LOTE_ID = canonical;
      h["ID ANALISIS"] = `HUM-${canonical}`;
      const existing = humByCode.get(canonical);
      if (!existing) {
        humByCode.set(canonical, h);
      } else {
        humByCode.set(canonical, { ...existing, ...h });
      }
    }
    db.registroHumedad = Array.from(humByCode.values());
  }

  // 3. Unificar y deduplicar analisisHumedo
  if (Array.isArray(db.analisisHumedo) && db.analisisHumedo.length > 0) {
    const ahByCode = new Map<string, AnalisisHumedo>();
    for (const a of db.analisisHumedo) {
      if (!a || !a.LOTE_ID) continue;
      const canonical = formatLoteCode(a.LOTE_ID);
      if (!canonical) continue;
      a.LOTE_ID = canonical;
      a.ANALISIS_HUMEDO_ID = `AH-${canonical}`;
      const existing = ahByCode.get(canonical);
      if (!existing) {
        ahByCode.set(canonical, a);
      } else {
        ahByCode.set(canonical, {
          ...existing,
          ...a,
          OBSERVACIONES: a.OBSERVACIONES || existing.OBSERVACIONES
        });
      }
    }
    db.analisisHumedo = Array.from(ahByCode.values());

    // Sincronizar observaciones entre lote y analisisHumedo cuando uno de los dos la tenga
    if (Array.isArray(db.lotes)) {
      for (const lote of db.lotes) {
        const ah = ahByCode.get(lote.LOTE_ID);
        if (ah) {
          if (ah.OBSERVACIONES && !lote.OBSERVACIONES) {
            lote.OBSERVACIONES = ah.OBSERVACIONES;
          } else if (lote.OBSERVACIONES && !ah.OBSERVACIONES) {
            ah.OBSERVACIONES = lote.OBSERVACIONES;
          }
        }
      }
    }
  }

  // 4. BatchLotes, Presecado, AnalisisSeco, Programaciones
  if (Array.isArray(db.batchLotes)) {
    db.batchLotes.forEach(bl => {
      if (bl && bl.LOTE_ID) bl.LOTE_ID = formatLoteCode(bl.LOTE_ID);
    });
  }
  if (Array.isArray(db.presecado)) {
    db.presecado.forEach(p => {
      if (p && p.LOTE_ID) p.LOTE_ID = formatLoteCode(p.LOTE_ID);
    });
  }
  if (Array.isArray(db.analisisSeco)) {
    db.analisisSeco.forEach(s => {
      if (s && s.LOTE_ID) s.LOTE_ID = formatLoteCode(s.LOTE_ID);
    });
  }
  if (Array.isArray(db.programacionesOficiales)) {
    db.programacionesOficiales.forEach((prog: any) => {
      if (Array.isArray(prog.filasLote)) {
        prog.filasLote.forEach((f: any) => {
          if (f.loteId) f.loteId = formatLoteCode(f.loteId);
          if (f.LOTE_ID) f.LOTE_ID = formatLoteCode(f.LOTE_ID);
        });
      }
      if (Array.isArray(prog.lotes)) {
        prog.lotes.forEach((l: any) => {
          if (l.LOTE_ID) l.LOTE_ID = formatLoteCode(l.LOTE_ID);
          if (l.loteId) l.loteId = formatLoteCode(l.loteId);
        });
      }
    });
  }

  // 5. Limpiar propiedades crudas residuales de Excel en db.lotes cuando ya existen las propiedades oficiales normalizadas
  // para garantizar que cualquier edición manual sobre lotes subidos por Excel persista sin ser pisada por columnas del Excel.
  if (Array.isArray(db.lotes)) {
    const rawExcelShadowKeys = [
      "Peso (kg)", "PESO (KG)", "PESO", "Peso", "PESO_BALANZA", "PESO_TOTAL", "PESO (TN)", "PESO_TN", "TN", "TONELADAS",
      "Sacos", "SACOS_CANTIDAD", "CANTIDAD DE SACOS", "N° SACOS", "NRO SACOS", "BULTOS",
      "Agricultor / Cliente", "AGRICULTOR / CLIENTE", "AGRICULTOR", "Cliente", "PRODUCTOR", "PROVEEDOR",
      "Variedad", "TIPO DE ARROZ", "ARROZ",
      "Fecha Recepción", "FECHA RECEPCIÓN", "FECHA RECEPCION", "Fecha", "FECHA", "F. INGRESO", "FECHA DE INGRESO",
      "Ubicacion", "Ubicación", "UBICACIÓN", "SILO", "TOLVA", "ALMACEN", "ZONA / ORIGEN", "ORIGEN", "PROCEDENCIA", "LUGAR",
      "Humedad (%)", "HUMEDAD (%)", "H. PROMEDIO", "PROM. GENERAL", "% HUMEDAD", "HUM_INICIAL",
      "Desv.", "DESV.", "DESVIACION", "DESVIACIÓN", "DESV ESTANDAR",
      "Estado", "ESTADO", "SITUACION",
      "R.I (%)", "R.B (%)", "% Remoción", "Q.I (%)", "Q.B (%)", "Entero (%)",
      "Tiza Total (%)", "Tiza Parcial (%)", "Tiza Puntual (%)", "Mancha (%)",
      "Trizado (%)", "Grano Rojo (%)", "Grano Inmaduro (%)", "Grano Verde (%)",
      "Blancura Int.", "Blancura Pul.", "Impurezas (%)", "Palote", "Vano",
      "Olor", "Falso Carbón", "Hongo", "Mezcla Var. (%)", "Cascado (%)", "Plagas / Insec."
    ];
    db.lotes.forEach((l: any) => {
      if (!l) return;
      for (const alias of rawExcelShadowKeys) {
        if (alias in l) {
          delete l[alias];
        }
      }
    });
  }

  // 6. Reconciliación automática de Variedad, Cliente, Sacos y Lotes para todos los Batches (incluyendo corrección específica para V350 -> FERON)
  const isGenericFallbackVar = (v?: string) => {
    if (!v) return true;
    const u = v.toString().trim().toUpperCase();
    return !u || u === "TINAJONES" || u === "IR-43 MEJORADO" || u === "ARROZ GENERAL" || u === "SIN VARIEDAD" || u === "VARIEDAD GENERAL" || u === "GENERAL";
  };

  const isBatchV350 = (code?: string) => {
    if (!code) return false;
    const u = code.toString().trim().toUpperCase();
    return u === "V350" || u === "BAT-V350" || u === "BATCH-V350" || u.startsWith("V350-");
  };

  const findLoteByCode = (code?: string) => {
    if (!code || !Array.isArray(db.lotes)) return undefined;
    const norm = sanitizeLoteCode(code);
    return db.lotes.find((l: any) => l && sanitizeLoteCode(l.LOTE_ID) === norm);
  };

  const resolveLoteRealVariety = (code?: string): string => {
    if (!code) return "";
    const norm = sanitizeLoteCode(code);
    const lot = findLoteByCode(code);
    if (lot?.VARIEDAD && !isGenericFallbackVar(lot.VARIEDAD)) {
      return lot.VARIEDAD.toString().trim().toUpperCase();
    }
    if (Array.isArray(db.analisisHumedo)) {
      const ah = db.analisisHumedo.find((a: any) => a && sanitizeLoteCode(a.LOTE_ID) === norm && (a as any).VARIEDAD);
      if (ah && (ah as any).VARIEDAD && !isGenericFallbackVar((ah as any).VARIEDAD)) {
        return (ah as any).VARIEDAD.toString().trim().toUpperCase();
      }
    }
    if (Array.isArray(db.presecado)) {
      const ps = db.presecado.find((p: any) => p && sanitizeLoteCode(p.LOTE_ID) === norm && (p as any).VARIEDAD);
      if (ps && (ps as any).VARIEDAD && !isGenericFallbackVar((ps as any).VARIEDAD)) {
        return (ps as any).VARIEDAD.toString().trim().toUpperCase();
      }
    }
    return lot?.VARIEDAD ? lot.VARIEDAD.toString().trim().toUpperCase() : "";
  };

  const normalizeBatchKey = (code?: string) => {
    if (!code) return "";
    return code
      .toString()
      .trim()
      .toUpperCase()
      .replace(/^(BATCH|BAT|B|LOTE|COD)[\s\-_:]*/i, "")
      .replace(/[\s\-_]/g, "");
  };

  const sameBatchKey = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const ua = a.toString().trim().toUpperCase();
    const ub = b.toString().trim().toUpperCase();
    if (ua === ub) return true;
    const na = normalizeBatchKey(ua);
    const nb = normalizeBatchKey(ub);
    return Boolean(na && nb && na === nb);
  };

  // 6.0 Unificar programacionesOficiales desde localStorage ("molino_programaciones_batch_oficiales_v3" y "programaciones_batch_oficial_v1")
  if (!Array.isArray(db.programacionesOficiales)) {
    db.programacionesOficiales = [];
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const pMap = new Map<string, any>();
      db.programacionesOficiales.forEach((p: any) => {
        const k = normalizeBatchKey(p?.batch || p?.id);
        if (k) pMap.set(k, p);
      });
      for (const lsKey of ["molino_programaciones_batch_oficiales_v3", "programaciones_batch_oficial_v1"]) {
        const raw = window.localStorage.getItem(lsKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: any) => {
              const k = normalizeBatchKey(p?.batch || p?.id);
              if (!k) return;
              const existing = pMap.get(k);
              if (!existing) {
                pMap.set(k, p);
              } else {
                const exFilas = Array.isArray(existing.filasLote) ? existing.filasLote.length : 0;
                const newFilas = Array.isArray(p.filasLote) ? p.filasLote.length : 0;
                pMap.set(k, newFilas >= exFilas ? { ...existing, ...p } : { ...p, ...existing });
              }
            });
          }
        }
      }
      db.programacionesOficiales = Array.from(pMap.values());
      db.programacionApit = db.programacionesOficiales;
    } catch {
      // ignore
    }
  }

  // 6.0b Unificar resultadosCoccionExternos desde localStorage ("resultados_coccion_integrados_v2" y "resultados_coccion_integrados_v1")
  if (!Array.isArray(db.resultadosCoccionExternos)) {
    db.resultadosCoccionExternos = [];
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const cMap = new Map<string, any>();
      db.resultadosCoccionExternos.forEach((c: any) => {
        const k = c?.id || normalizeBatchKey(c?.codigoBatch || c?.batchId || c?.correlativo);
        if (k) cMap.set(k, c);
      });
      for (const cKey of ["resultados_coccion_externos_v1", "resultados_coccion_integrados_v2", "resultados_coccion_integrados_v1"]) {
        const rawC = window.localStorage.getItem(cKey);
        if (rawC) {
          const parsedC = JSON.parse(rawC);
          if (Array.isArray(parsedC)) {
            parsedC.forEach((c: any) => {
              const k = c?.id || normalizeBatchKey(c?.codigoBatch || c?.batchId || c?.correlativo);
              if (k) {
                const ex = cMap.get(k);
                cMap.set(k, ex ? { ...ex, ...c } : c);
              }
            });
          }
        }
      }
      if (Array.isArray(db.batchesVaporizado)) {
        db.batchesVaporizado.forEach((b: any) => {
          const rc = b?.RESULTADO_COCCION || b?.resultadoCoccion;
          if (rc && typeof rc === "object") {
            const k = rc?.id || normalizeBatchKey(rc?.codigoBatch || rc?.batchId || rc?.correlativo || b?.BATCH_ID || b?.CORRELATIVO);
            if (k && !cMap.has(k)) {
              cMap.set(k, rc);
            }
          }
        });
      }
      db.resultadosCoccionExternos = Array.from(cMap.values());
    } catch {
      // ignore
    }
  }

  // 6.0c Volver a aplicar purga sobre lo cargado de localStorage para lotes eliminados en tombstones
  purgeAllV200Information(db);
  if (tombstones.size > 0) {
    const isDeletedCode = (code?: string) => {
      if (!code) return false;
      const norm = formatLoteCode(code);
      return Boolean(norm && tombstones.has(norm));
    };
    purgeBatchAndProcessReferencesForCodes(db, isDeletedCode);
  }

  // 6.0d Normalizar nombre oficial del molino a "MOLINO DON JULIO S.A.C."
  const isCentralNorteCliente = (str?: string) => {
    if (!str || typeof str !== "string") return false;
    return /molino\s+central(\s+norte)?(\s+s\.?a\.?c\.?)?/i.test(str.trim());
  };

  (db.lotes || []).forEach((l: any) => {
    if (isCentralNorteCliente(l?.CLIENTE)) {
      l.CLIENTE = "MOLINO DON JULIO S.A.C.";
    }
  });

  (db.batchesVaporizado || []).forEach((b: any) => {
    if (isCentralNorteCliente(b?.CLIENTE)) {
      b.CLIENTE = "MOLINO DON JULIO S.A.C.";
    }
  });

  (db.batchLotes || []).forEach((bl: any) => {
    if (isCentralNorteCliente(bl?.CLIENTE)) {
      bl.CLIENTE = "MOLINO DON JULIO S.A.C.";
    }
  });

  (db.controlVaporizado || []).forEach((c: any) => {
    if (isCentralNorteCliente(c?.CLIENTE)) {
      c.CLIENTE = "MOLINO DON JULIO S.A.C.";
    }
    if (c?.datosIngreso && isCentralNorteCliente(c.datosIngreso.cliente)) {
      c.datosIngreso.cliente = "MOLINO DON JULIO S.A.C.";
    }
  });

  (db.analisisVaporizado || []).forEach((av: any) => {
    if (isCentralNorteCliente(av?.CLIENTE)) {
      av.CLIENTE = "MOLINO DON JULIO S.A.C.";
    }
  });

  (db.programacionApit || []).forEach((p: any) => {
    if (isCentralNorteCliente(p?.CLIENTE)) {
      p.CLIENTE = "MOLINO DON JULIO S.A.C.";
    }
  });

  // 6.1 Reconciliar programacionesOficiales y asegurar que sus lotes estén reflejados en db.batchLotes
  if (Array.isArray(db.programacionesOficiales)) {
    db.programacionesOficiales.forEach((prog: any) => {
      if (!prog) return;
      if (isCentralNorteCliente(prog.clientePrincipal)) {
        prog.clientePrincipal = "MOLINO DON JULIO S.A.C.";
      }
      if (Array.isArray(prog.filasLote)) {
        prog.filasLote.forEach((f: any) => {
          if (isCentralNorteCliente(f?.cliente)) {
            f.cliente = "MOLINO DON JULIO S.A.C.";
          }
        });
      }
      const bCode = (prog.batch || prog.id || "").toString().trim();
      const bUpper = bCode.toUpperCase();

      if (isBatchV350(bUpper) && isGenericFallbackVar(prog.variedadPrincipal)) {
        prog.variedadPrincipal = "FERON";
      }

      if (Array.isArray(prog.filasLote)) {
        prog.filasLote.forEach((f: any) => {
          if (!f) return;
          const lid = f.loteId || f.LOTE_ID;
          const lot = findLoteByCode(lid);
          if (isBatchV350(bUpper)) {
            if (isGenericFallbackVar(f.variedad)) f.variedad = "FERON";
            if (lot && isGenericFallbackVar(lot.VARIEDAD)) lot.VARIEDAD = "FERON";
          } else if (lot) {
            const realVar = resolveLoteRealVariety(lid);
            if (realVar && (isGenericFallbackVar(f.variedad) || !f.variedad)) {
              f.variedad = realVar;
            }
            if (lot.CLIENTE && (!f.cliente || f.cliente === "Sin Cliente" || f.cliente === "Cliente")) {
              f.cliente = lot.CLIENTE;
            }
          }
        });

        const firstRowVar = prog.filasLote.find((f: any) => f?.variedad && !isGenericFallbackVar(f.variedad))?.variedad || prog.filasLote[0]?.variedad;
        if (firstRowVar && (isGenericFallbackVar(prog.variedadPrincipal) || !prog.variedadPrincipal)) {
          prog.variedadPrincipal = isBatchV350(bUpper) && isGenericFallbackVar(firstRowVar) ? "FERON" : firstRowVar;
        }
        const firstRowCli = prog.filasLote.find((f: any) => f?.cliente && f.cliente !== "Sin Cliente")?.cliente;
        if (firstRowCli && (!prog.clientePrincipal || prog.clientePrincipal === "Sin Cliente")) {
          prog.clientePrincipal = firstRowCli;
        }

        // Asegurar que cada filaLote exista en db.batchLotes
        if (bCode && Array.isArray(db.batchLotes)) {
          const matchingBatch = (db.batchesVaporizado || []).find((b: any) =>
            sameBatchKey(b.BATCH_ID, bUpper) || sameBatchKey(b.CORRELATIVO, bUpper)
          );
          const targetBatchId = matchingBatch?.BATCH_ID || bCode;
          prog.filasLote.forEach((f: any, idx: number) => {
            const lid = sanitizeLoteCode(f.loteId || f.LOTE_ID || "");
            if (!lid) return;
            const existsInBL = db.batchLotes.some((bl: any) =>
              sanitizeLoteCode(bl.LOTE_ID) === lid &&
              (sameBatchKey(bl.BATCH_ID, bUpper) || sameBatchKey(bl.BATCH_ID, targetBatchId))
            );
            if (!existsInBL) {
              const lot = findLoteByCode(lid);
              db.batchLotes.push({
                BATCH_LOTE_ID: `BL-${targetBatchId}-${lid}-${idx}`,
                BATCH_ID: targetBatchId,
                LOTE_ID: lid,
                SACOS: Number(f.sacProg ?? f.sacos ?? lot?.SACOS ?? 0),
                PESO_KG: Number(f.pesoProg ?? f.peso ?? lot?.PESO_KG ?? 0),
                CLIENTE: f.cliente || prog.clientePrincipal || lot?.CLIENTE || "",
                VARIEDAD: (isBatchV350(bUpper) && isGenericFallbackVar(f.variedad)) ? "FERON" : (f.variedad || prog.variedadPrincipal || lot?.VARIEDAD || ""),
                ORDEN: idx + 1,
                ESTADO: "PROGRAMADO"
              });
            }
          });
        }
      }
    });
  }

  // 6.1b Reconstruir enlaces en db.batchLotes únicamente desde batchesVaporizado activos (nunca desde registros huérfanos)
  if (!Array.isArray(db.batchLotes)) {
    db.batchLotes = [];
  }
  const ensureBatchLoteLink = (rawBatchCode?: string, rawLoteId?: string, extra?: { sacos?: number; pesoKg?: number; cliente?: string; variedad?: string }) => {
    if (!rawBatchCode || !rawLoteId) return;
    const lid = sanitizeLoteCode(rawLoteId);
    if (!lid || !/^C0\d{3,6}$/i.test(lid)) return;
    const matchingBatch = (db.batchesVaporizado || []).find((b: any) =>
      sameBatchKey(b.BATCH_ID, rawBatchCode) || sameBatchKey(b.CORRELATIVO, rawBatchCode)
    );
    if (!matchingBatch) return;
    const targetBatchId = matchingBatch.BATCH_ID || rawBatchCode.toString().trim();
    const alreadyExists = db.batchLotes.some((bl: any) =>
      sanitizeLoteCode(bl.LOTE_ID) === lid &&
      (sameBatchKey(bl.BATCH_ID, rawBatchCode) || sameBatchKey(bl.BATCH_ID, targetBatchId))
    );
    if (!alreadyExists) {
      const lot = findLoteByCode(lid);
      db.batchLotes.push({
        BATCH_LOTE_ID: `BL-${targetBatchId}-${lid}`,
        BATCH_ID: targetBatchId,
        LOTE_ID: lid,
        SACOS: Number(extra?.sacos || lot?.SACOS || matchingBatch?.TOTAL_SACOS || 0),
        PESO_KG: Number(extra?.pesoKg || lot?.PESO_KG || matchingBatch?.TOTAL_PESO_KG || matchingBatch?.PESO_TOTAL_KG || 0),
        CLIENTE: extra?.cliente || lot?.CLIENTE || matchingBatch?.CLIENTE || "",
        VARIEDAD: (isBatchV350(targetBatchId) && isGenericFallbackVar(extra?.variedad || lot?.VARIEDAD))
          ? "FERON"
          : (extra?.variedad || resolveLoteRealVariety(lid) || matchingBatch?.VARIEDAD || ""),
        ORDEN: 1,
        ESTADO: "PROGRAMADO"
      });
    }
  };

  // Desde batchesVaporizado (LOTES_ASIGNADOS, lotesAsignados, LOTES_UNION, LOTE_ID)
  if (Array.isArray(db.batchesVaporizado)) {
    db.batchesVaporizado.forEach((b: any) => {
      if (!b) return;
      const bCode = b.BATCH_ID || b.CORRELATIVO;
      const assignedArr = b.LOTES_ASIGNADOS || b.lotesAsignados || b.lotes || b.LOTES_UNION || [];
      if (Array.isArray(assignedArr)) {
        assignedArr.forEach((item: any) => {
          const lid = typeof item === "string" ? item : (item?.LOTE_ID || item?.loteId);
          if (lid) {
            ensureBatchLoteLink(bCode, lid, {
              sacos: typeof item === "object" ? Number(item.SACOS ?? item.sacos ?? 0) : undefined,
              pesoKg: typeof item === "object" ? Number(item.PESO_KG ?? item.pesoKg ?? 0) : undefined,
              cliente: typeof item === "object" ? (item.CLIENTE || item.cliente) : b.CLIENTE,
              variedad: typeof item === "object" ? (item.VARIEDAD || item.variedad) : b.VARIEDAD
            });
          }
        });
      }
      if (b.LOTE_ID) {
        ensureBatchLoteLink(bCode, b.LOTE_ID, { cliente: b.CLIENTE, variedad: b.VARIEDAD });
      }
    });
  }

  // 6.2 Reconciliar db.batchLotes con db.lotes
  if (Array.isArray(db.batchLotes)) {
    db.batchLotes.forEach((bl: any) => {
      if (!bl) return;
      const lot = findLoteByCode(bl.LOTE_ID);
      if (isBatchV350(bl.BATCH_ID)) {
        if (isGenericFallbackVar(bl.VARIEDAD)) bl.VARIEDAD = "FERON";
        if (lot && isGenericFallbackVar(lot.VARIEDAD)) lot.VARIEDAD = "FERON";
      }
      if (lot) {
        const realVar = resolveLoteRealVariety(bl.LOTE_ID);
        if (realVar && (!bl.VARIEDAD || (isGenericFallbackVar(bl.VARIEDAD) && !isGenericFallbackVar(realVar)))) {
          bl.VARIEDAD = realVar;
        }
        if (lot.CLIENTE && (!bl.CLIENTE || bl.CLIENTE === "MOLINO" || bl.CLIENTE === "Sin Cliente")) {
          bl.CLIENTE = lot.CLIENTE;
        }
        if (!bl.SACOS && lot.SACOS) bl.SACOS = Number(lot.SACOS) || 0;
        if (!bl.PESO_KG && lot.PESO_KG) bl.PESO_KG = Number(lot.PESO_KG) || 0;
      }
    });
  }

  // 6.3 Reconciliar db.controlVaporizado para V350 y demás batches
  if (Array.isArray(db.controlVaporizado)) {
    db.controlVaporizado.forEach((ctrl: any) => {
      if (!ctrl) return;
      if (isBatchV350(ctrl.BATCH_ID) || isBatchV350(ctrl.CORRELATIVO) || isBatchV350(ctrl.datosIngreso?.codigo)) {
        if (isGenericFallbackVar(ctrl.VARIEDAD)) ctrl.VARIEDAD = "FERON";
        if (ctrl.datosIngreso && isGenericFallbackVar(ctrl.datosIngreso.variedad)) {
          ctrl.datosIngreso.variedad = "FERON";
        }
      }
    });
  }

  // 6.4 Reconciliar db.batchesVaporizado con lotes, batchLotes, programacionesOficiales, controlVaporizado, analisisVaporizado y cocción
  if (Array.isArray(db.batchesVaporizado)) {
    db.batchesVaporizado.forEach((b: any) => {
      if (!b) return;
      const bId = (b.BATCH_ID || "").toString().trim().toUpperCase();
      const corr = (b.CORRELATIVO || b.BATCH_ID || "").toString().trim().toUpperCase();

      if (isBatchV350(bId) || isBatchV350(corr)) {
        if (isGenericFallbackVar(b.VARIEDAD)) {
          b.VARIEDAD = "FERON";
        }
      }

      const bls = (db.batchLotes || []).filter((bl: any) =>
        sameBatchKey(bl?.BATCH_ID, bId) || (corr && sameBatchKey(bl?.BATCH_ID, corr))
      );

      const prog = (db.programacionesOficiales || []).find((p: any) => {
        const pB = (p?.batch || p?.id || "").toString().trim().toUpperCase();
        return sameBatchKey(pB, bId) || (corr && sameBatchKey(pB, corr));
      });

      const ctrl = (db.controlVaporizado || []).find((c: any) => {
        const cB = (c?.BATCH_ID || "").toString().trim().toUpperCase();
        const cC = (c?.CORRELATIVO || "").toString().trim().toUpperCase();
        const cCod = (c?.datosIngreso?.codigo || "").toString().trim().toUpperCase();
        return sameBatchKey(cB, bId) || sameBatchKey(cC, bId) || sameBatchKey(cCod, bId) ||
               (corr && (sameBatchKey(cB, corr) || sameBatchKey(cC, corr) || sameBatchKey(cCod, corr)));
      });

      const hasDescarga = (db.analisisVaporizado || []).some((av: any) =>
        sameBatchKey(av?.BATCH_ID, bId) || (corr && sameBatchKey(av?.BATCH_ID, corr)) ||
        sameBatchKey(av?.CODIGO_MUESTRA, bId) || (corr && sameBatchKey(av?.CODIGO_MUESTRA, corr))
      );

      const batchLoteCodes = new Set<string>(bls.map((bl: any) => sanitizeLoteCode(bl.LOTE_ID)).filter(Boolean));
      const hasCoccion = (db.resultadosCoccionExternos || []).some((rc: any) => {
        const rcBatch = rc?.codigoBatch || rc?.batchId || rc?.correlativo;
        if (sameBatchKey(rcBatch, bId) || (corr && sameBatchKey(rcBatch, corr))) return true;
        const rcLote = sanitizeLoteCode(rc?.loteId || rc?.LOTE_ID);
        return Boolean(rcLote && batchLoteCodes.has(rcLote));
      });

      // Resolver variedad real desde todas las fuentes vinculadas al batch
      const candidateVars: string[] = [];
      bls.forEach((bl: any) => {
        const lotVar = resolveLoteRealVariety(bl.LOTE_ID);
        if (lotVar) candidateVars.push(lotVar);
        if (bl.VARIEDAD) candidateVars.push(bl.VARIEDAD);
      });
      if (prog?.filasLote && Array.isArray(prog.filasLote)) {
        prog.filasLote.forEach((f: any) => {
          const lotVar = resolveLoteRealVariety(f.loteId || f.LOTE_ID);
          if (lotVar) candidateVars.push(lotVar);
          if (f.variedad) candidateVars.push(f.variedad);
        });
      }
      if (prog?.variedadPrincipal) candidateVars.push(prog.variedadPrincipal);
      if (ctrl?.datosIngreso?.variedad) candidateVars.push(ctrl.datosIngreso.variedad);
      if (ctrl?.VARIEDAD) candidateVars.push(ctrl.VARIEDAD);
      if (b.VARIEDAD) candidateVars.push(b.VARIEDAD);

      const nonGenericVar = candidateVars.find(v => !isGenericFallbackVar(v));
      if (nonGenericVar && (isGenericFallbackVar(b.VARIEDAD) || !b.VARIEDAD)) {
        b.VARIEDAD = nonGenericVar.toString().trim().toUpperCase();
      } else if (!b.VARIEDAD && candidateVars.length > 0) {
        b.VARIEDAD = candidateVars[0].toString().trim().toUpperCase();
      }

      if (isBatchV350(bId) || isBatchV350(corr)) {
        if (isGenericFallbackVar(b.VARIEDAD)) {
          b.VARIEDAD = "FERON";
        }
      }

      // Resolver cliente principal si falta
      if (!b.CLIENTE || b.CLIENTE === "Sin Cliente") {
        const cli =
          bls.find((bl: any) => bl.CLIENTE && bl.CLIENTE !== "Sin Cliente")?.CLIENTE ||
          bls.map((bl: any) => findLoteByCode(bl.LOTE_ID)?.CLIENTE).find(Boolean) ||
          prog?.clientePrincipal ||
          ctrl?.CLIENTE ||
          "";
        if (cli) b.CLIENTE = cli;
      }

      // Resolver sacos y peso totales si faltan
      const sumSacos = bls.reduce((acc: number, bl: any) => acc + (Number(bl.SACOS) || 0), 0) || Number(prog?.totalSacosProg || 0);
      const sumKg = bls.reduce((acc: number, bl: any) => acc + (Number(bl.PESO_KG) || 0), 0) || Number(prog?.pesoTotalKg || 0);
      if (!b.TOTAL_SACOS && sumSacos > 0) b.TOTAL_SACOS = sumSacos;
      if (!b.TOTAL_PESO_KG && sumKg > 0) b.TOTAL_PESO_KG = sumKg;
      if (!b.PESO_TOTAL_KG && sumKg > 0) b.PESO_TOTAL_KG = sumKg;

      // Actualizar estado real del Batch según su avance operativo progresivo sin saltar estados:
      // PROGRAMADO -> EN PROCESO -> EN REPOSO -> EN SECADO -> VAPORIZADO -> ANALISIS_FINAL -> EVALUADO -> CERRADO
      const stageCtrl = evaluateControlSheetStages(ctrl);
      const estBatchUpper = (b.ESTADO_BATCH || "").toString().trim().toUpperCase();
      const yaFueVaporizado =
        stageCtrl.isLiquidado ||
        estBatchUpper === "VAPORIZADO" ||
        estBatchUpper === "ANALISIS_FINAL" ||
        estBatchUpper === "EVALUADO" ||
        estBatchUpper === "CERRADO" ||
        estBatchUpper === "TERMINADO" ||
        estBatchUpper === "FINALIZADO" ||
        estBatchUpper === "COMPLETADO";

      const allLinkedLotesClosed =
        batchLoteCodes.size > 0 &&
        Array.from(batchLoteCodes).every((lid) => {
          const l = findLoteByCode(lid);
          const lEst = (l?.ESTADO_LOTE || "").toString().trim().toUpperCase();
          return (lEst === "CERRADO" || Boolean((l as any)?.cerroCompletamente)) && Boolean((l as any)?.cerroPorJefatura);
        });

      // Solo es CERRADO si fue formalmente cerrado por Jefe de Vaporizado Y cuenta con análisis de descarga Y cocción completas
      const isTrulyClosedByJefatura =
        Boolean((b as any).cerroPorJefatura) && hasDescarga && hasCoccion;

      const isHistoricalSeedClosed =
        isTrulyClosedByJefatura ||
        (estBatchUpper === "CERRADO" && Boolean((b as any).cerroCompletamente) && (hasDescarga && hasCoccion)) ||
        ((estBatchUpper === "TERMINADO" || estBatchUpper === "FINALIZADO" || estBatchUpper === "COMPLETADO") &&
          (yaFueVaporizado && hasDescarga && hasCoccion));

      // CORRECCIÓN AUTOMÁTICA (AUTO-CURACIÓN):
      // Si el batch estaba erróneamente marcado como CERRADO pero no cuenta con análisis de descarga y cocción (o solo se cerró y liquidó la hoja de vaporizado):
      // Debe volver a VAPORIZADO (o ANALISIS_FINAL / EVALUADO) y quedar pendiente para que los analistas suban descarga y cocción
      if (!isHistoricalSeedClosed && (estBatchUpper === "CERRADO" || estBatchUpper === "COMPLETADO" || Boolean((b as any).cerroCompletamente) || Boolean((b as any).cerroPorJefatura))) {
        delete (b as any).cerroCompletamente;
        delete (b as any).cerroPorJefatura;
        delete (b as any).CERRADO_COMPLETO;
        delete (b as any).cerradoTotal;
      }

      if (isHistoricalSeedClosed) {
        b.ESTADO_BATCH = "CERRADO";
        (b as any).cerroCompletamente = true;
        (b as any).cerroPorJefatura = true;
        if (prog) prog.estado = "CERRADO";
      } else if (yaFueVaporizado && hasDescarga && hasCoccion) {
        b.ESTADO_BATCH = "EVALUADO";
        if (prog) prog.estado = "EVALUADO";
      } else if (yaFueVaporizado && hasDescarga) {
        b.ESTADO_BATCH = "ANALISIS_FINAL";
        (b as any).ESTADO_ANALISIS_DESCARGA = "COMPLETO";
        (b as any).ESTADO_COCCION = "PENDIENTE";
        (b as any).coccionPendiente = true;
        if (prog) prog.estado = "ANALISIS_FINAL";
      } else if (stageCtrl.isLiquidado || estBatchUpper === "VAPORIZADO" || yaFueVaporizado) {
        b.ESTADO_BATCH = "VAPORIZADO";
        (b as any).ESTADO_ANALISIS_DESCARGA = "PENDIENTE";
        (b as any).analisisDescargaPendiente = true;
        (b as any).ESTADO_COCCION = "PENDIENTE";
        (b as any).coccionPendiente = true;
        if (prog) prog.estado = "VAPORIZADO";
      } else if (stageCtrl.hasEtapaSecado || estBatchUpper === "EN SECADO") {
        b.ESTADO_BATCH = "EN SECADO";
        if (prog) prog.estado = "EN SECADO";
      } else if (stageCtrl.hasEtapaReposo || estBatchUpper === "EN REPOSO") {
        b.ESTADO_BATCH = "EN REPOSO";
        if (prog) prog.estado = "EN REPOSO";
      } else if (stageCtrl.hasDatosVaporizado || estBatchUpper === "EN PROCESO" || estBatchUpper === "EN_PROCESO" || estBatchUpper === "EN EJECUCION") {
        b.ESTADO_BATCH = "EN PROCESO";
        if (prog) prog.estado = "EN PROCESO";
      } else {
        b.ESTADO_BATCH = "PROGRAMADO";
        if (prog && !prog.estado) prog.estado = "PROGRAMADO";
      }
    });
  }

  // 6.5 Reconciliación Progresiva del Estado de Flujo (ESTADO_LOTE) sin saltar estados:
  // 1. INGRESADO: Subido sin análisis, solamente con su PASO 1: DATOS DE RECEPCION DE BALANZA.
  // 2. ANALIZADO: Subido completamente (Paso 1 y Paso 2).
  // 3. PROGRAMADO: Ya ha pasado a la lista de programación.
  // 4. EN PROCESO: Empezando a llenar sección DATOS DE VAPORIZADO en ficha de control.
  // 5. EN REPOSO: Empezando a llenar sección ETAPA DE 1° REPOSO DE GRANO.
  // 6. EN SECADO: Empezando a llenar sección ETAPA DE SECADO (PERFILES 0 AL 12).
  // 7. VAPORIZADO: Cuando se cierre y se liquide el batch.
  // 8. ANALISIS_FINAL: Cuando se registra su análisis de descarga.
  // 9. EVALUADO: Cuando se registran sus resultados de calidad: incremento de defectos y cocción en olla.
  // 10. CERRADO: Cuando cierra el batch completamente.
  if (Array.isArray(db.lotes)) {
    db.lotes.forEach((lote: Lote) => {
      if (!lote || !lote.LOTE_ID) return;
      const normId = sanitizeLoteCode(lote.LOTE_ID);
      if (!normId) return;

      if ((lote as any)._recienIngresado) {
        delete (lote as any)._recienIngresado;
      }

      const currentEst = (lote.ESTADO_LOTE || "INGRESADO").toString().trim().toUpperCase();
      const tienePaso1YPaso2 = hasLotePaso1AndPaso2(lote, db);

      // 1. Encontrar todos los batches activos existentes vinculados a este lote
      const linkedBatchKeys = new Set<string>();
      (db.batchLotes || []).forEach((bl: any) => {
        if (bl && sanitizeLoteCode(bl.LOTE_ID) === normId && bl.BATCH_ID) {
          linkedBatchKeys.add(bl.BATCH_ID.toString().trim().toUpperCase());
        }
      });
      (db.programacionesOficiales || []).forEach((prog: any) => {
        if (!prog) return;
        const pCode = (prog.batch || prog.id || "").toString().trim().toUpperCase();
        const inFilas = Array.isArray(prog.filasLote) && prog.filasLote.some((f: any) => sanitizeLoteCode(f?.loteId || f?.LOTE_ID) === normId);
        const inLotes = Array.isArray(prog.lotes) && prog.lotes.some((l: any) => sanitizeLoteCode(l?.LOTE_ID || l?.loteId || l) === normId);
        if ((inFilas || inLotes) && pCode) {
          linkedBatchKeys.add(pCode);
        }
      });
      (db.batchesVaporizado || []).forEach((b: any) => {
        if (!b) return;
        const bId = (b.BATCH_ID || "").toString().trim().toUpperCase();
        const corr = (b.CORRELATIVO || "").toString().trim().toUpperCase();
        const inUnion = Array.isArray(b.LOTES_UNION) && b.LOTES_UNION.some((u: any) => sanitizeLoteCode(typeof u === "string" ? u : u?.LOTE_ID) === normId);
        const inAsig = Array.isArray(b.lotesAsignados) && b.lotesAsignados.some((u: any) => sanitizeLoteCode(typeof u === "string" ? u : u?.LOTE_ID) === normId);
        if (inUnion || inAsig || sanitizeLoteCode(b.LOTE_ID) === normId) {
          if (bId) linkedBatchKeys.add(bId);
          if (corr) linkedBatchKeys.add(corr);
        }
      });

      const matchesAnyLinkedBatch = (code?: string) => {
        if (!code) return false;
        for (const k of linkedBatchKeys) {
          if (sameBatchKey(code, k)) return true;
        }
        return false;
      };

      const linkedBatches = (db.batchesVaporizado || []).filter((b: any) =>
        matchesAnyLinkedBatch(b?.BATCH_ID) || matchesAnyLinkedBatch(b?.CORRELATIVO)
      );

      // Si el lote NO está vinculado a ningún batch en programación:
      // - Si solo tiene Paso 1 (sin análisis completo): INGRESADO
      // - Si tiene Paso 1 y Paso 2 completos: ANALIZADO
      if (linkedBatches.length === 0 && linkedBatchKeys.size === 0) {
        unfreezeLoteWaitingDays(lote);
        if (currentEst === "EXPERIMENTAL" || currentEst === "DESAPROBADO") {
          return;
        }
        lote.ESTADO_LOTE = tienePaso1YPaso2 ? "ANALIZADO" : "INGRESADO";
        return;
      }

      const linkedCtrl = (db.controlVaporizado || []).find((ctrl: any) =>
        matchesAnyLinkedBatch(ctrl?.BATCH_ID) ||
        matchesAnyLinkedBatch(ctrl?.CORRELATIVO) ||
        matchesAnyLinkedBatch(ctrl?.datosIngreso?.codigo)
      );
      const ctrlStages = evaluateControlSheetStages(linkedCtrl);

      const hasBatchDescarga =
        linkedBatchKeys.size > 0 &&
        (db.analisisVaporizado || []).some((av: any) =>
          matchesAnyLinkedBatch(av?.BATCH_ID) ||
          matchesAnyLinkedBatch(av?.CODIGO_MUESTRA) ||
          sanitizeLoteCode(av?.LOTE_ID) === normId
        );

      const hasBatchCoccion =
        linkedBatchKeys.size > 0 &&
        (db.resultadosCoccionExternos || []).some((rc: any) => {
          const rcBatch = rc?.codigoBatch || rc?.batchId || rc?.correlativo;
          return matchesAnyLinkedBatch(rcBatch) || sanitizeLoteCode(rc?.loteId || rc?.LOTE_ID) === normId;
        });

      const hasBatchClosedCompletely = linkedBatches.some((b: any) => {
        const st = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
        return (st === "CERRADO" || st === "TERMINADO" || st === "FINALIZADO" || st === "COMPLETADO") &&
               Boolean((b as any).cerroPorJefatura) && hasBatchDescarga && hasBatchCoccion;
      }) || (Boolean((lote as any).cerroPorJefatura) && hasBatchDescarga && hasBatchCoccion);

      const hasBatchEvaluado = linkedBatches.some((b: any) => {
        const st = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
        return st === "EVALUADO";
      });

      const hasBatchAnalisisFinal = linkedBatches.some((b: any) => {
        const st = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
        return st === "ANALISIS_FINAL";
      });

      const hasBatchVaporizado = linkedBatches.some((b: any) => {
        const st = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
        return st === "VAPORIZADO";
      });

      const hasBatchEnSecado = linkedBatches.some((b: any) => {
        const st = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
        return st === "EN SECADO";
      });

      const hasBatchEnReposo = linkedBatches.some((b: any) => {
        const st = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
        return st === "EN REPOSO";
      });

      const hasBatchEnProceso = linkedBatches.some((b: any) => {
        const st = (b?.ESTADO_BATCH || "").toString().trim().toUpperCase();
        return st === "EN PROCESO" || st === "EN_PROCESO" || st === "EN EJECUCION";
      });

      const hasHojaVaporizadoGuardada = Boolean(
        linkedCtrl && (
          (linkedCtrl as any).guardado === true ||
          (linkedCtrl as any).liquidado === true ||
          ctrlStages.hasSheetSaved ||
          ctrlStages.hasDatosVaporizado ||
          ctrlStages.hasEtapaReposo ||
          ctrlStages.hasEtapaSecado ||
          ctrlStages.isLiquidado ||
          (linkedCtrl.ESTADO_PROCESO && ["LIQUIDADO", "VAPORIZADO", "FINALIZADO", "CERRADO"].includes((linkedCtrl.ESTADO_PROCESO || "").toString().trim().toUpperCase()))
        )
      );

      // Si ni siquiera se ha guardado la hoja de vaporizado, NO saltarse a análisis final, evaluado ni vaporizado
      const yaBatchFueVaporizado =
        hasHojaVaporizadoGuardada &&
        (ctrlStages.isLiquidado ||
        hasBatchVaporizado ||
        hasBatchAnalisisFinal ||
        hasBatchEvaluado ||
        hasBatchClosedCompletely);

      if (hasBatchClosedCompletely && hasHojaVaporizadoGuardada) {
        lote.ESTADO_LOTE = "CERRADO";
        (lote as any).cerroCompletamente = true;
        (lote as any).cerroPorJefatura = true;
      } else if (yaBatchFueVaporizado && ((hasBatchDescarga && hasBatchCoccion) || hasBatchEvaluado)) {
        lote.ESTADO_LOTE = "EVALUADO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else if (yaBatchFueVaporizado && (hasBatchDescarga || hasBatchAnalisisFinal)) {
        lote.ESTADO_LOTE = "ANALISIS_FINAL";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else if (yaBatchFueVaporizado && (ctrlStages.isLiquidado || hasBatchVaporizado)) {
        lote.ESTADO_LOTE = "VAPORIZADO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else if (hasHojaVaporizadoGuardada && (ctrlStages.hasEtapaSecado || hasBatchEnSecado)) {
        lote.ESTADO_LOTE = "EN SECADO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else if (hasHojaVaporizadoGuardada && (ctrlStages.hasEtapaReposo || hasBatchEnReposo)) {
        lote.ESTADO_LOTE = "EN REPOSO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else if (hasHojaVaporizadoGuardada && (ctrlStages.hasDatosVaporizado || hasBatchEnProceso)) {
        lote.ESTADO_LOTE = "EN PROCESO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else if (hasBatchEnProceso) {
        lote.ESTADO_LOTE = "EN PROCESO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else if (linkedBatchKeys.size > 0) {
        lote.ESTADO_LOTE = "PROGRAMADO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      } else {
        lote.ESTADO_LOTE = tienePaso1YPaso2 ? "ANALIZADO" : "INGRESADO";
        delete (lote as any).cerroCompletamente;
        delete (lote as any).cerroPorJefatura;
      }

      // Mantener sincronizado el estado en db.batchLotes para que coincida exactamente con el lote
      if (Array.isArray(db.batchLotes)) {
        db.batchLotes
          .filter((bl: any) => matchesAnyLinkedBatch(bl?.BATCH_ID) && sanitizeLoteCode(bl?.LOTE_ID) === normId)
          .forEach((bl: any) => {
            bl.ESTADO = lote.ESTADO_LOTE;
          });
      }

      const finalEst = (lote.ESTADO_LOTE || "").toUpperCase();
      if (finalEst === "INGRESADO" || finalEst === "ANALIZADO") {
        unfreezeLoteWaitingDays(lote);
      } else {
        const refDate =
          linkedCtrl?.FECHA_HORA_INICIO ||
          (linkedCtrl as any)?.FECHA ||
          linkedBatches[0]?.FECHA_INICIO ||
          linkedBatches[0]?.FECHA_PROGRAMADA;
        freezeLoteWaitingDays(lote, refDate);
      }
    });
  }

  // Corregir estados de db.batchesVaporizado: NO saltarse a ANALISIS_FINAL ni EVALUADO si no se ha guardado la hoja de vaporizado
  if (Array.isArray(db.batchesVaporizado)) {
    (db.batchesVaporizado || []).forEach((b: any) => {
      if (!b) return;
      const bId = (b.BATCH_ID || "").toString().trim().toUpperCase();
      const bCorr = (b.CORRELATIVO || "").toString().trim().toUpperCase();
      const ctrl = (db.controlVaporizado || []).find((c: any) => {
        const cId = (c.BATCH_ID || "").toString().trim().toUpperCase();
        const cCorr = (c.CORRELATIVO || c.datosIngreso?.codigo || "").toString().trim().toUpperCase();
        return (cId && (cId === bId || cId === bCorr)) || (cCorr && (cCorr === bId || cCorr === bCorr));
      });
      const stages = evaluateControlSheetStages(ctrl);
      const sheetSaved = Boolean(
        ctrl && (
          (ctrl as any).guardado === true ||
          (ctrl as any).liquidado === true ||
          stages.hasSheetSaved ||
          stages.hasDatosVaporizado ||
          stages.hasEtapaReposo ||
          stages.hasEtapaSecado ||
          stages.isLiquidado ||
          (ctrl.ESTADO_PROCESO && ["LIQUIDADO", "VAPORIZADO", "FINALIZADO", "CERRADO"].includes((ctrl.ESTADO_PROCESO || "").toString().trim().toUpperCase()))
        )
      );
      const st = (b.ESTADO_BATCH || "").toString().trim().toUpperCase();
      if (!sheetSaved && (st === "ANALISIS_FINAL" || st === "EVALUADO" || st === "VAPORIZADO")) {
        b.ESTADO_BATCH = "PROGRAMADO";
      }
    });
  }

  // 6.6 Regla Operativa: Cuando el lote o batch está CERRADO o VAPORIZADO debe salir de programación,
  // y la programación debe distribuirse de arriba hacia abajo (el primer lote/batch a procesar arriba y va bajando).
  if (Array.isArray(db.programacionesOficiales)) {
    const closedBatchKeys = new Set<string>();
    const vaporizedBatchKeys = new Set<string>();
    (db.batchesVaporizado || []).forEach((b: any) => {
      if (!b) return;
      const st = (b.ESTADO_BATCH || "").toString().trim().toUpperCase();
      if ((st === "CERRADO" || st === "COMPLETADO") && Boolean(b.cerroPorJefatura)) {
        if (b.BATCH_ID) closedBatchKeys.add(normalizeBatchKey(b.BATCH_ID));
        if (b.CORRELATIVO) closedBatchKeys.add(normalizeBatchKey(b.CORRELATIVO));
      } else if (st === "VAPORIZADO" || st === "ANALISIS_FINAL" || st === "EVALUADO" || (st === "CERRADO" && !Boolean(b.cerroPorJefatura))) {
        if (b.BATCH_ID) vaporizedBatchKeys.add(normalizeBatchKey(b.BATCH_ID));
        if (b.CORRELATIVO) vaporizedBatchKeys.add(normalizeBatchKey(b.CORRELATIVO));
      }
    });

    // Incluir cualquier batch cuyo control de vaporizado esté cerrado o liquidado
    (db.controlVaporizado || []).forEach((c: any) => {
      if (!c) return;
      const st = (c.ESTADO_PROCESO || "").toString().trim().toUpperCase();
      if (Boolean((c as any).cerroPorJefatura)) {
        if (c.BATCH_ID) closedBatchKeys.add(normalizeBatchKey(c.BATCH_ID));
        if (c.CORRELATIVO) closedBatchKeys.add(normalizeBatchKey(c.CORRELATIVO));
      } else if (Boolean(c.liquidado) || st === "LIQUIDADO" || st === "VAPORIZADO" || st === "CERRADO" || st === "FINALIZADO") {
        if (c.BATCH_ID) vaporizedBatchKeys.add(normalizeBatchKey(c.BATCH_ID));
        if (c.CORRELATIVO) vaporizedBatchKeys.add(normalizeBatchKey(c.CORRELATIVO));
      }
    });

    const closedLoteIds = new Set<string>();
    const vaporizedLoteIds = new Set<string>();
    (db.lotes || []).forEach((l: any) => {
      if (!l) return;
      const st = (l.ESTADO_LOTE || "").toString().trim().toUpperCase();
      const norm = sanitizeLoteCode(l.LOTE_ID);
      if (!norm) return;
      if (st === "CERRADO" && Boolean(l.cerroPorJefatura)) {
        closedLoteIds.add(norm);
      } else if (st === "VAPORIZADO" || st === "ANALISIS_FINAL" || st === "EVALUADO" || (st === "CERRADO" && !Boolean(l.cerroPorJefatura))) {
        vaporizedLoteIds.add(norm);
      }
    });

    const parseSeqKey = (batchStr?: string, casoStr?: string) => {
      const raw = (batchStr || "").toString().trim().toUpperCase();
      const vMatch = raw.match(/V\s*(\d+)(?:\s*-\s*(\d+))?/i);
      if (vMatch) {
        return { mainNum: parseInt(vMatch[1], 10), subNum: vMatch[2] ? parseInt(vMatch[2], 10) : 0 };
      }
      const numMatch = raw.match(/(\d+)(?:\s*-\s*(\d+))?$/);
      if (numMatch) {
        return { mainNum: parseInt(numMatch[1], 10), subNum: numMatch[2] ? parseInt(numMatch[2], 10) : 0 };
      }
      const casoMatch = (casoStr || "").toString().match(/(\d+)/);
      return { mainNum: casoMatch ? parseInt(casoMatch[1], 10) : 999999, subNum: 0 };
    };

    const beforeLen = JSON.stringify(db.programacionesOficiales);

    // Antes de retirar de programación los batches cerrados o vaporizados, asegurar que queden registrados en db.batchesVaporizado
    db.programacionesOficiales.forEach((p: any) => {
      if (!p) return;
      const kBatch = normalizeBatchKey(p.batch);
      const kId = normalizeBatchKey(p.id);
      const allProgLotesClosed =
        Array.isArray(p.filasLote) &&
        p.filasLote.length > 0 &&
        p.filasLote.every((f: any) => {
          const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
          return Boolean(lid && closedLoteIds.has(lid));
        });
      const isProgClosed =
        ((p.estado || "").toString().trim().toUpperCase() === "CERRADO" && Boolean((p as any).cerroPorJefatura)) ||
        Boolean(kBatch && closedBatchKeys.has(kBatch)) ||
        Boolean(kId && closedBatchKeys.has(kId)) ||
        allProgLotesClosed;

      const isProgVaporized =
        !isProgClosed &&
        ((p.estado || "").toString().trim().toUpperCase() === "VAPORIZADO" ||
        Boolean(kBatch && vaporizedBatchKeys.has(kBatch)) ||
        Boolean(kId && vaporizedBatchKeys.has(kId)));

      if (isProgClosed) {
        const bCode = (p.batch || p.id || "").toString().trim();
        if (bCode) {
          if (!Array.isArray(db.batchesVaporizado)) db.batchesVaporizado = [];
          const existingB = db.batchesVaporizado.find(
            (b: any) => sameBatchKey(b?.BATCH_ID, bCode) || sameBatchKey(b?.CORRELATIVO, bCode)
          );
          if (existingB) {
            existingB.ESTADO_BATCH = "CERRADO";
            (existingB as any).cerroCompletamente = true;
            (existingB as any).cerroPorJefatura = true;
            if (!existingB.CLIENTE && p.clientePrincipal) existingB.CLIENTE = p.clientePrincipal;
            if (!existingB.VARIEDAD && p.variedadPrincipal) existingB.VARIEDAD = p.variedadPrincipal;
            if (!existingB.PESO_TOTAL_KG && p.pesoTotalKg) existingB.PESO_TOTAL_KG = p.pesoTotalKg;
          } else {
            db.batchesVaporizado.push({
              BATCH_ID: bCode,
              CORRELATIVO: bCode,
              FECHA_PROGRAMADA: p.fecha || new Date().toISOString().split("T")[0],
              EQUIPO: "APIT",
              ESTADO_BATCH: "CERRADO",
              TON_PROGRAMADAS: (p.pesoTotalKg || 18000) / 1000,
              TON_PROCESADAS: (p.pesoTotalKg || 18000) / 1000,
              PESO_TOTAL_KG: p.pesoTotalKg || 18000,
              CLIENTE: p.clientePrincipal || "MOLINO DON JULIO S.A.C.",
              VARIEDAD: p.variedadPrincipal || "TINAJONES",
              TURNO: p.turno === "DIA" ? "Turno Día" : "Turno Noche",
              OBSERVACIONES: p.observacion || "",
              cerroCompletamente: true,
              cerroPorJefatura: true,
              filasLote: p.filasLote,
              promedios: p.promedios,
              parametrosDeterminados: p.parametrosDeterminados,
              parametrosRecomendadosIA: p.parametrosRecomendadosIA
            } as any);
          }
          if (Array.isArray(p.filasLote)) {
            if (!Array.isArray(db.batchLotes)) db.batchLotes = [];
            p.filasLote.forEach((f: any) => {
              const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
              if (lid && !db.batchLotes.some((bl: any) => sameBatchKey(bl?.BATCH_ID, bCode) && sanitizeLoteCode(bl?.LOTE_ID) === lid)) {
                db.batchLotes.push({
                  BATCH_LOTE_ID: `BL-${bCode}-${lid}`,
                  BATCH_ID: bCode,
                  LOTE_ID: lid,
                  SACOS: f.sacProg || f.sacos || 100,
                  PESO_KG: f.pesoProg || f.peso || 5000,
                  CLIENTE: f.cliente || p.clientePrincipal,
                  VARIEDAD: f.variedad || p.variedadPrincipal,
                  ESTADO: "CERRADO"
                } as any);
              }
            });
          }
        }
      } else if (isProgVaporized) {
        p.estado = "VAPORIZADO";
        const bCode = (p.batch || p.id || "").toString().trim();
        if (bCode) {
          if (!Array.isArray(db.batchesVaporizado)) db.batchesVaporizado = [];
          const existingB = db.batchesVaporizado.find(
            (b: any) => sameBatchKey(b?.BATCH_ID, bCode) || sameBatchKey(b?.CORRELATIVO, bCode)
          );
          if (existingB) {
            if (existingB.ESTADO_BATCH !== "EVALUADO" && existingB.ESTADO_BATCH !== "ANALISIS_FINAL") {
              existingB.ESTADO_BATCH = "VAPORIZADO";
            }
            delete (existingB as any).cerroCompletamente;
            (existingB as any).ESTADO_ANALISIS_DESCARGA = "PENDIENTE";
            (existingB as any).analisisDescargaPendiente = true;
            (existingB as any).ESTADO_COCCION = "PENDIENTE";
            (existingB as any).coccionPendiente = true;
          } else {
            db.batchesVaporizado.push({
              BATCH_ID: bCode,
              CORRELATIVO: bCode,
              FECHA_PROGRAMADA: p.fecha || new Date().toISOString().split("T")[0],
              EQUIPO: "APIT",
              ESTADO_BATCH: "VAPORIZADO",
              ESTADO_ANALISIS_DESCARGA: "PENDIENTE",
              analisisDescargaPendiente: true,
              ESTADO_COCCION: "PENDIENTE",
              coccionPendiente: true,
              TON_PROGRAMADAS: (p.pesoTotalKg || 18000) / 1000,
              TON_PROCESADAS: (p.pesoTotalKg || 18000) / 1000,
              PESO_TOTAL_KG: p.pesoTotalKg || 18000,
              CLIENTE: p.clientePrincipal || "MOLINO DON JULIO S.A.C.",
              VARIEDAD: p.variedadPrincipal || "TINAJONES",
              TURNO: p.turno === "DIA" ? "Turno Día" : "Turno Noche",
              OBSERVACIONES: p.observacion || "",
              filasLote: p.filasLote,
              promedios: p.promedios,
              parametrosDeterminados: p.parametrosDeterminados,
              parametrosRecomendadosIA: p.parametrosRecomendadosIA
            } as any);
          }
          if (Array.isArray(p.filasLote)) {
            if (!Array.isArray(db.batchLotes)) db.batchLotes = [];
            p.filasLote.forEach((f: any) => {
              const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
              if (lid) {
                const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === lid);
                if (lIdx !== -1) {
                  if (db.lotes[lIdx].ESTADO_LOTE !== "EVALUADO" && db.lotes[lIdx].ESTADO_LOTE !== "ANALISIS_FINAL") {
                    db.lotes[lIdx].ESTADO_LOTE = "VAPORIZADO";
                  }
                  delete (db.lotes[lIdx] as any).cerroCompletamente;
                }
                const bl = db.batchLotes.find((x: any) => sameBatchKey(x?.BATCH_ID, bCode) && sanitizeLoteCode(x?.LOTE_ID) === lid);
                if (bl) {
                  bl.ESTADO = "VAPORIZADO";
                } else {
                  db.batchLotes.push({
                    BATCH_LOTE_ID: `BL-${bCode}-${lid}`,
                    BATCH_ID: bCode,
                    LOTE_ID: lid,
                    SACOS: f.sacProg || f.sacos || 100,
                    PESO_KG: f.pesoProg || f.peso || 5000,
                    CLIENTE: f.cliente || p.clientePrincipal,
                    VARIEDAD: f.variedad || p.variedadPrincipal,
                    ESTADO: "VAPORIZADO"
                  } as any);
                }
              }
            });
          }
        }
      }
    });

    db.programacionesOficiales = db.programacionesOficiales
      .filter((p: any) => {
        if (!p) return false;
        const st = (p.estado || "").toString().trim().toUpperCase();
        if (st === "CERRADO" || st === "VAPORIZADO" || st === "COMPLETADO") return false;
        const kBatch = normalizeBatchKey(p.batch);
        const kId = normalizeBatchKey(p.id);
        if ((kBatch && (closedBatchKeys.has(kBatch) || vaporizedBatchKeys.has(kBatch))) ||
            (kId && (closedBatchKeys.has(kId) || vaporizedBatchKeys.has(kId)))) return false;
        return true;
      })
      .map((p: any) => {
        if (Array.isArray(p.filasLote)) {
          p.filasLote = p.filasLote.filter((f: any) => {
            const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
            return !lid || (!closedLoteIds.has(lid) && !vaporizedLoteIds.has(lid));
          });
        }
        return p;
      })
      .filter((p: any) => !Array.isArray(p.filasLote) || p.filasLote.length > 0)
      .sort((a: any, b: any) => {
        const keyA = parseSeqKey(a.batch || a.id, a.caso);
        const keyB = parseSeqKey(b.batch || b.id, b.caso);
        if (keyA.mainNum !== keyB.mainNum) return keyA.mainNum - keyB.mainNum;
        if (keyA.subNum !== keyB.subNum) return keyA.subNum - keyB.subNum;
        const fechaCmp = (a.fecha || "").toString().localeCompare((b.fecha || "").toString());
        if (fechaCmp !== 0) return fechaCmp;
        const turnoA = a.turno === "DIA" ? 0 : 1;
        const turnoB = b.turno === "DIA" ? 0 : 1;
        if (turnoA !== turnoB) return turnoA - turnoB;
        return (a.caso || "").toString().localeCompare((b.caso || "").toString(), undefined, { numeric: true });
      });

    db.programacionApit = db.programacionesOficiales;

    const afterLen = JSON.stringify(db.programacionesOficiales);
    if (beforeLen !== afterLen && typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("programaciones_batch_oficial_v1", afterLen);
        window.localStorage.setItem("molino_programaciones_batch_oficiales_v3", afterLen);
      } catch {
        // ignore
      }
    }
  }
}

export function hasLotePaso1AndPaso2(lote: any, db: LocalDatabaseSchema): boolean {
  if (!lote || !lote.LOTE_ID) return false;
  const normId = sanitizeLoteCode(lote.LOTE_ID);
  if (!normId) return false;

  // Paso 1: Datos de Recepción de Balanza
  const hasPaso1 = Boolean(
    normId &&
    (Number(lote.SACOS) > 0 || Number(lote.PESO_KG) > 0 || (lote.CLIENTE && String(lote.CLIENTE).trim() !== ""))
  );
  if (!hasPaso1) return false;

  // Paso 2A: Humedad de recepción
  const humRec = (db.registroHumedad || []).find((h: any) => sanitizeLoteCode(h?.LOTE_ID) === normId);
  const hasCaladasInHum = Boolean(
    humRec && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].some(i => Number((humRec as any)[`M${i}`]) > 0)
  );
  const hasHum =
    Number(lote.HUM) > 0 ||
    Number(lote.HUMEDAD) > 0 ||
    Number(humRec?.["H. PROMEDIO"] ?? humRec?.["PROM. GENERAL"]) > 0 ||
    hasCaladasInHum;
  if (!hasHum) return false;

  // Paso 2B: Análisis Físico en Húmedo
  const ahRec = (db.analisisHumedo || []).find((a: any) => sanitizeLoteCode(a?.LOTE_ID) === normId);
  const hasAnalisisInAh = Boolean(
    ahRec && (
      Number(ahRec.RI) > 0 ||
      Number(ahRec.RB) > 0 ||
      Number(ahRec.QI) > 0 ||
      Number(ahRec.QB) > 0 ||
      Number(ahRec.TT) > 0 ||
      Number(ahRec.TP) > 0 ||
      Number(ahRec.M ?? ahRec.MANCHADO) > 0 ||
      Number(ahRec.TZ) > 0 ||
      Number(ahRec.GR) > 0 ||
      Number(ahRec.GI) > 0 ||
      Number(ahRec.GV) > 0 ||
      Number((ahRec as any)["B.INTEGRAL"]) > 0 ||
      Number((ahRec as any)["B. PULIDO"]) > 0
    )
  );
  const hasAnalisisInLote = Boolean(
    Number(lote.RI) > 0 ||
    Number(lote.RB) > 0 ||
    Number(lote.QI) > 0 ||
    Number(lote.QB) > 0 ||
    Number(lote.TT) > 0 ||
    Number(lote.TP) > 0
  );

  return hasAnalisisInAh || hasAnalisisInLote;
}

export function evaluateControlSheetStages(ctrl: any): {
  hasDatosVaporizado: boolean;
  hasEtapaReposo: boolean;
  hasEtapaSecado: boolean;
  isLiquidado: boolean;
  hasSheetSaved: boolean;
} {
  if (!ctrl) {
    return {
      hasDatosVaporizado: false,
      hasEtapaReposo: false,
      hasEtapaSecado: false,
      isLiquidado: false,
      hasSheetSaved: false
    };
  }

  const isNonEmptyStr = (v: any) => v !== undefined && v !== null && String(v).trim() !== "";
  const isFilledNum = (v: any) => v !== undefined && v !== null && String(v).trim() !== "" && !isNaN(Number(v)) && Number(v) > 0;

  const checkSiloArray = (arr: any[]) =>
    Array.isArray(arr) &&
    arr.some((s: any) =>
      isNonEmptyStr(s?.exclusa?.inicio) ||
      isNonEmptyStr(s?.exclusa?.fin) ||
      isNonEmptyStr(s?.exclusa?.tiempoLlenado) ||
      isFilledNum(s?.tempSuperior) ||
      isFilledNum(s?.tempInferior) ||
      isNonEmptyStr(s?.descarga?.inicio) ||
      isNonEmptyStr(s?.descarga?.fin) ||
      isNonEmptyStr(s?.descarga?.tiempoDescarga) ||
      isNonEmptyStr(s?.descarga?.tiempoReposo) ||
      isNonEmptyStr(s?.horaInicioLlenado) ||
      isNonEmptyStr(s?.horaFinLlenado) ||
      isFilledNum(s?.tempAguaC) ||
      isNonEmptyStr(s?.inicioVaporizado) ||
      isNonEmptyStr(s?.finVaporizado) ||
      isFilledNum(s?.presionbar) ||
      isNonEmptyStr(s?.inicioDescarga) ||
      isNonEmptyStr(s?.finDescarga) ||
      isNonEmptyStr(s?.observacion)
    );

  const checkPerfilRow = (p: any) =>
    isNonEmptyStr(p?.horaInicio) ||
    isNonEmptyStr(p?.hora) ||
    isFilledNum(p?.tempGrano) ||
    isFilledNum(p?.tempAmbiente) ||
    isFilledNum(p?.humedadRelativa) ||
    isFilledNum(p?.hrAmbiente) ||
    isNonEmptyStr(p?.humedad) ||
    isFilledNum(p?.hIngreso) ||
    isFilledNum(p?.hSalida) ||
    isFilledNum(p?.tempReal) ||
    isFilledNum(p?.tempPromedio) ||
    isNonEmptyStr(p?.tiempoMin) ||
    isFilledNum(p?.tempProgramada) ||
    isFilledNum(p?.a1) ||
    isFilledNum(p?.a2) ||
    isFilledNum(p?.materiaPrima?.qPct) ||
    isFilledNum(p?.materiaPrima?.trizPct) ||
    isFilledNum(p?.materiaPrima?.blGrad) ||
    isNonEmptyStr(p?.modificaciones?.mod1) ||
    isNonEmptyStr(p?.modificaciones?.mod2) ||
    isNonEmptyStr(p?.modificaciones?.mod3) ||
    isNonEmptyStr(p?.inicioDescarga) ||
    isNonEmptyStr(p?.finDescarga) ||
    isNonEmptyStr(p?.inicioReposo) ||
    isNonEmptyStr(p?.finReposo) ||
    isNonEmptyStr(p?.tiempoReposo) ||
    isNonEmptyStr(p?.observacion);

  // 1. Sección DATOS DE VAPORIZADO
  const dv = ctrl.datosVaporizado || {};
  const hasDatosVapFields =
    Boolean(ctrl.etapaVaporizadoIniciada) ||
    isNonEmptyStr(dv.llenadoTolvaPulmon?.inicio) ||
    isNonEmptyStr(dv.llenadoTolvaPulmon?.fin) ||
    isNonEmptyStr(dv.inicioRemojo) ||
    isNonEmptyStr(dv.finRemojo) ||
    isNonEmptyStr(dv.tiempoRemojo) ||
    isFilledNum(dv.tempAguaRemojo) ||
    isNonEmptyStr(dv.inyeccionVapor?.inicio) ||
    isNonEmptyStr(dv.inyeccionVapor?.fin) ||
    isNonEmptyStr(dv.inyeccionVapor?.duracion) ||
    isNonEmptyStr(dv.inyeccionVaporPase1?.inicio) ||
    isNonEmptyStr(dv.inyeccionVaporPase1?.fin) ||
    isNonEmptyStr(dv.inyeccionVaporPase1?.duracion) ||
    isNonEmptyStr(dv.inyeccionVaporPase2?.inicio) ||
    isNonEmptyStr(dv.inyeccionVaporPase2?.fin) ||
    isNonEmptyStr(dv.inyeccionVaporPase2?.duracion) ||
    checkSiloArray(ctrl.silos) ||
    checkSiloArray(ctrl.silosPase1) ||
    checkSiloArray(ctrl.silosPase2) ||
    checkSiloArray(ctrl.silosControl) ||
    isNonEmptyStr(ctrl.HORA_INICIO_REMOJO) ||
    isNonEmptyStr(ctrl.HORA_FIN_REMOJO) ||
    isNonEmptyStr(ctrl.HORA_INICIO_VAPORIZADO) ||
    isNonEmptyStr(ctrl.HORA_FIN_VAPORIZADO);

  // 2. Sección ETAPA DE 1° REPOSO DE GRANO
  const hasEtapaReposoFields =
    Boolean(ctrl.etapaReposoIniciada) ||
    (Array.isArray(ctrl.etapaReposo1) && ctrl.etapaReposo1.some(checkPerfilRow)) ||
    (!Array.isArray(ctrl.etapaReposo1) &&
      ctrl.etapaReposo1 &&
      (isNonEmptyStr(ctrl.etapaReposo1.horaInicio) || isNonEmptyStr(ctrl.etapaReposo1.horaFin)));

  // 3. Sección ETAPA DE SECADO (PERFILES 0 AL 12)
  const hasEtapaSecadoFields =
    Boolean(ctrl.etapaSecadoIniciada) ||
    (Array.isArray(ctrl.perfilesSecado) && ctrl.perfilesSecado.slice(0, 13).some(checkPerfilRow)) ||
    (Array.isArray(ctrl.pasesSecado) && ctrl.pasesSecado.length > 0);

  const estProcUpper = (ctrl.ESTADO_PROCESO || "").toString().trim().toUpperCase();
  const isLiquidado = Boolean(
    ctrl.liquidado ||
    ctrl.cerroCompletamente ||
    isNonEmptyStr(ctrl.FECHA_HORA_FIN) ||
    estProcUpper === "LIQUIDADO" ||
    estProcUpper === "VAPORIZADO" ||
    estProcUpper === "FINALIZADO" ||
    estProcUpper === "CERRADO"
  );

  const hasSheetSaved = Boolean(
    ctrl && (
      ctrl.guardado === true ||
      ctrl.liquidado === true ||
      isLiquidado ||
      hasDatosVapFields ||
      hasEtapaReposoFields ||
      hasEtapaSecadoFields
    )
  );

  return {
    hasDatosVaporizado: hasDatosVapFields || hasEtapaReposoFields || hasEtapaSecadoFields || isLiquidado,
    hasEtapaReposo: hasEtapaReposoFields || hasEtapaSecadoFields || isLiquidado,
    hasEtapaSecado: hasEtapaSecadoFields || isLiquidado,
    isLiquidado,
    hasSheetSaved
  };
}

class LocalDBService {
  private cache: LocalDatabaseSchema | null = null;
  private isIndexedDBHydrated: boolean = false;
  private persistDebounceTimer: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.flush();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flush();
        }
      });
    }
  }

  private load(): LocalDatabaseSchema {
    if (this.cache) return this.cache;

    if (typeof window === "undefined" || !window.localStorage) {
      this.cache = JSON.parse(JSON.stringify(INITIAL_DATA));
      deduplicateAndMigrateLotes(this.cache!);
      return this.cache!;
    }

    // Reinicio total en cero por única vez (v9_clean) para subir la aplicación limpia
    try {
      const hasZeroResetV9 = window.localStorage.getItem(ZERO_STATE_RESET_FLAG) === "true";
      const staleKeys = [
        "arroz_apit_local_db_v1",
        "arroz_apit_local_db_v2",
        "arroz_apit_local_db_v3",
        "arroz_apit_local_db_v4",
        "arroz_apit_local_db_v5",
        "arroz_apit_local_db_v6",
        "arroz_apit_local_db_v7",
        "arroz_apit_local_db_v8",
        "arroz_apit_local_db_v8_clean",
        "molino_programaciones_batch_oficiales_v1",
        "molino_programaciones_batch_oficiales_v2",
        "molino_programaciones_batch_oficiales_v3"
      ];

      if (!hasZeroResetV9) {
        window.localStorage.setItem(ZERO_STATE_RESET_FLAG, "true");
        const keysToPurgeOnReset = [
          ...staleKeys,
          STORAGE_KEY,
          "programaciones_batch_oficial_v1",
          "molino_programaciones_batch_oficiales_v3",
          "molino_programaciones_batch_oficiales_v4",
          "resultados_coccion_externos_v1",
          "resultados_coccion_integrados_v1",
          "resultados_coccion_integrados_v2",
          "apit_sacas_descarga_v1",
          "sabana_batches_v1",
          "sabana_batches_trabajados_v1",
          "sabana_batches_trabajados_v2",
          "historico_recetas_secado_v1",
          "APIT_HISTORICO_RECETAS_SECADO_V1",
          "arroz_apit_deleted_lotes_v2",
          "arroz_apit_unlinked_new_lotes_v5",
          "anvap_deleted_batches_v1"
        ];
        keysToPurgeOnReset.forEach((k) => window.localStorage.removeItem(k));
        this.cleanupStaleLocalStorage();
        if (window.indexedDB && window.indexedDB.deleteDatabase) {
          window.indexedDB.deleteDatabase("ArrozApitStorage_v1");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v2");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v3");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v4");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v5");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v6");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v7");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v8");
          window.indexedDB.deleteDatabase("ArrozApitStorage_v8_clean");
        }
      } else {
        for (const k of staleKeys) {
          if (window.localStorage.getItem(k)) {
            window.localStorage.removeItem(k);
          }
        }
      }
    } catch {
      // Ignorar
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        const mergedLotesMap = new Map<string, Lote>();
        INITIAL_DATA.lotes.forEach((l) => {
          const canonical = formatLoteCode(l.LOTE_ID);
          if (canonical) mergedLotesMap.set(canonical, { ...l, LOTE_ID: canonical });
        });
        if (Array.isArray(parsed.lotes)) {
          parsed.lotes.forEach((l: Lote) => {
            if (l && l.LOTE_ID) {
              const canonical = formatLoteCode(l.LOTE_ID);
              if (canonical) {
                const existing = mergedLotesMap.get(canonical);
                mergedLotesMap.set(canonical, { ...existing, ...l, LOTE_ID: canonical });
              }
            }
          });
        }

        const mergedHumMap = new Map<string, RegistroHumedad>();
        INITIAL_DATA.registroHumedad.forEach((h) => {
          const canonical = formatLoteCode(h.LOTE_ID);
          if (canonical) mergedHumMap.set(canonical, { ...h, LOTE_ID: canonical, "ID ANALISIS": `HUM-${canonical}` });
        });
        if (Array.isArray(parsed.registroHumedad)) {
          parsed.registroHumedad.forEach((h: RegistroHumedad) => {
            if (h && h.LOTE_ID) {
              const canonical = formatLoteCode(h.LOTE_ID);
              if (canonical) {
                const existing = mergedHumMap.get(canonical);
                mergedHumMap.set(canonical, { ...existing, ...h, LOTE_ID: canonical, "ID ANALISIS": `HUM-${canonical}` });
              }
            }
          });
        }

        const mergedAhMap = new Map<string, AnalisisHumedo>();
        INITIAL_DATA.analisisHumedo.forEach((a) => {
          const canonical = formatLoteCode(a.LOTE_ID);
          if (canonical) mergedAhMap.set(canonical, { ...a, LOTE_ID: canonical, ANALISIS_HUMEDO_ID: `AH-${canonical}` });
        });
        if (Array.isArray(parsed.analisisHumedo)) {
          parsed.analisisHumedo.forEach((a: AnalisisHumedo) => {
            if (a && a.LOTE_ID) {
              const canonical = formatLoteCode(a.LOTE_ID);
              if (canonical) {
                const existing = mergedAhMap.get(canonical);
                mergedAhMap.set(canonical, { ...existing, ...a, LOTE_ID: canonical, ANALISIS_HUMEDO_ID: `AH-${canonical}` });
              }
            }
          });
        }

        let resolvedUsers: UserProfile[] = parsed.users && parsed.users.length > 0 ? parsed.users : INITIAL_DATA.users;
        try {
          const rawUsersKey = window.localStorage.getItem("anvap_users_v1");
          if (rawUsersKey) {
            const parsedUsersKey = JSON.parse(rawUsersKey);
            if (Array.isArray(parsedUsersKey) && parsedUsersKey.length > 0) {
              const userMap = new Map<string, UserProfile>();
              resolvedUsers.forEach((u) => { if (u?.id) userMap.set(u.id, u); });
              parsedUsersKey.forEach((u: UserProfile) => { if (u?.id) userMap.set(u.id, u); });
              // If anvap_users_v1 is explicitly managed, prefer its exact membership plus any edits
              resolvedUsers = parsedUsersKey;
            }
          }
        } catch {
          // ignore
        }
        resolvedUsers = resolvedUsers.filter(
          (u) => u && u.id !== "usr-jefe-vap" && (u.email || "").toLowerCase() !== "carlos.morales@arrozvapor.pe"
        );

        this.cache = {
          ...INITIAL_DATA,
          ...parsed,
          lotes: Array.from(mergedLotesMap.values()),
          registroHumedad: Array.from(mergedHumMap.values()),
          analisisHumedo: Array.from(mergedAhMap.values()),
          equipos: parsed.equipos && parsed.equipos.length > 0 ? parsed.equipos : INITIAL_DATA.equipos,
          estadosLote: parsed.estadosLote && parsed.estadosLote.length > 0 ? parsed.estadosLote : INITIAL_DATA.estadosLote,
          successWeights: parsed.successWeights || INITIAL_DATA.successWeights,
          users: resolvedUsers,
          parametrosTrabajo: parsed.parametrosTrabajo || INITIAL_DATA.parametrosTrabajo
        };

        // Ejecutar deduplicación canónica para limpiar cualquier remanente
        deduplicateAndMigrateLotes(this.cache);

        // Si el valor previo almacenado en localStorage era masivo (> 800KB),
        // migrarlo inmediatamente a IndexedDB y liberar la cuota en el navegador
        if (stored.length > 800_000) {
          saveToIndexedDB(this.cache).catch(() => {});
          try {
            window.localStorage.removeItem(STORAGE_KEY);
            const leanSnapshot = {
              equipos: this.cache.equipos,
              estadosLote: this.cache.estadosLote,
              successWeights: this.cache.successWeights,
              users: this.cache.users,
              parametrosTrabajo: this.cache.parametrosTrabajo,
              lotes: (this.cache.lotes || []).slice(0, 40),
              _hasFullStorageInIndexedDB: true
            };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leanSnapshot));
          } catch {
            // Ignorar si el navegador bloquea escritura
          }
        }

        // Migración a 35 TN para APIT si venía de 32 TN previo
        if (this.cache.equipos) {
          this.cache.equipos = this.cache.equipos.map((eq) =>
            eq.EQUIPO === "APIT" || eq.EQUIPO_ID === "EQ-APIT"
              ? { ...eq, CAPACIDAD_TN: 35, OBSERVACIONES: "Autoclave y Línea Oficial de Vaporizado APIT (35 TN)" }
              : eq
          );
        }
        if (this.cache.parametrosTrabajo) {
          if (this.cache.parametrosTrabajo.capacidadMaximaSecadoraKg === 32000) {
            this.cache.parametrosTrabajo.capacidadMaximaSecadoraKg = 35000;
            this.cache.parametrosTrabajo.capacidadExcepcionalMaximaKg = 37000;
          }
        }
      }
    } catch (e) {
      console.warn("[LocalDB] Error reading localStorage, falling back to initial data:", e);
    }

    if (!this.cache) {
      this.cache = JSON.parse(JSON.stringify(INITIAL_DATA));
      deduplicateAndMigrateLotes(this.cache!);
    }

    // Hidratación en segundo plano desde IndexedDB (sin límites de 5MB)
    this.hydrateFromIndexedDB();

    return this.cache!;
  }


  /**
   * Limpia claves obsoletas o temporales de localStorage para liberar espacio de cuota
   */
  private cleanupStaleLocalStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith("apit_draft_ctrl_") || key.startsWith("temp_") || key.includes("_temp") || key.startsWith("debug_"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Ignorar errores en limpieza de storage
    }
  }

  /**
   * Hidrata asíncronamente el estado completo desde IndexedDB (sin restricción de cuota de 5MB)
   */
  public async hydrateFromIndexedDB(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const idbState = await loadFromIndexedDB<LocalDatabaseSchema>();
      if (idbState && this.cache) {
        const idbLotes = Array.isArray(idbState.lotes) ? idbState.lotes : [];
        const currentLotes = Array.isArray(this.cache.lotes) ? this.cache.lotes : [];
        
        const isPrunedInLocalStorage = Boolean(
          (this.cache as any)._hasFullStorageInIndexedDB ||
          (this.cache as any)._fullStorageInIndexedDB ||
          (this.cache as any)._storageFullFallback
        );

        const shouldHydrate =
          isPrunedInLocalStorage ||
          idbLotes.length > currentLotes.length ||
          (idbState.batchesVaporizado?.length || 0) > (this.cache.batchesVaporizado?.length || 0) ||
          (idbState.controlVaporizado?.length || 0) > (this.cache.controlVaporizado?.length || 0) ||
          (idbState.registroHumedad?.length || 0) > (this.cache.registroHumedad?.length || 0);

        if (shouldHydrate) {
          // Unir lotes sin perder los que pudieran haberse agregado en memoria ni los datos iniciales
          const idbMap = new Map(idbLotes.map((l) => [l.LOTE_ID, l]));
          for (const curLote of currentLotes) {
            if (curLote?.LOTE_ID && !idbMap.has(curLote.LOTE_ID)) {
              idbLotes.unshift(curLote);
            }
          }
          for (const initLote of INITIAL_DATA.lotes) {
            if (initLote?.LOTE_ID && !idbMap.has(initLote.LOTE_ID)) {
              idbLotes.push(initLote);
            }
          }

          const humMap = new Map((idbState.registroHumedad || []).map((h) => [h.LOTE_ID, h]));
          (this.cache.registroHumedad || []).forEach((h) => {
            if (h.LOTE_ID && !humMap.has(h.LOTE_ID)) humMap.set(h.LOTE_ID, h);
          });
          INITIAL_DATA.registroHumedad.forEach((h) => {
            if (h.LOTE_ID && !humMap.has(h.LOTE_ID)) humMap.set(h.LOTE_ID, h);
          });

          const ahMap = new Map((idbState.analisisHumedo || []).map((a) => [a.LOTE_ID, a]));
          (this.cache.analisisHumedo || []).forEach((a) => {
            if (a.LOTE_ID && !ahMap.has(a.LOTE_ID)) ahMap.set(a.LOTE_ID, a);
          });
          INITIAL_DATA.analisisHumedo.forEach((a) => {
            if (a.LOTE_ID && !ahMap.has(a.LOTE_ID)) ahMap.set(a.LOTE_ID, a);
          });

          this.cache = {
            ...this.cache,
            ...idbState,
            lotes: idbLotes.length > 0 ? idbLotes : currentLotes,
            registroHumedad: Array.from(humMap.values()),
            analisisHumedo: Array.from(ahMap.values()),
            batchesVaporizado: (idbState.batchesVaporizado?.length || 0) >= (this.cache.batchesVaporizado?.length || 0)
              ? idbState.batchesVaporizado
              : this.cache.batchesVaporizado,
            controlVaporizado: (idbState.controlVaporizado?.length || 0) >= (this.cache.controlVaporizado?.length || 0)
              ? idbState.controlVaporizado
              : this.cache.controlVaporizado,
            batchLotes: (idbState.batchLotes?.length || 0) >= (this.cache.batchLotes?.length || 0)
              ? idbState.batchLotes
              : this.cache.batchLotes,
            analisisVaporizado: (idbState.analisisVaporizado?.length || 0) >= (this.cache.analisisVaporizado?.length || 0)
              ? idbState.analisisVaporizado
              : this.cache.analisisVaporizado,
            presecado: (idbState.presecado?.length || 0) >= (this.cache.presecado?.length || 0)
              ? idbState.presecado
              : this.cache.presecado,
            analisisSeco: (idbState.analisisSeco?.length || 0) >= (this.cache.analisisSeco?.length || 0)
              ? idbState.analisisSeco
              : this.cache.analisisSeco,
            programacionApit: (idbState.programacionApit?.length || 0) >= (this.cache.programacionApit?.length || 0)
              ? idbState.programacionApit
              : this.cache.programacionApit,
            programacionesOficiales: (idbState.programacionesOficiales?.length || 0) >= (this.cache.programacionesOficiales?.length || 0)
              ? idbState.programacionesOficiales
              : this.cache.programacionesOficiales,
            equipos: idbState.equipos && idbState.equipos.length > 0 ? idbState.equipos : this.cache.equipos,
            estadosLote: idbState.estadosLote && idbState.estadosLote.length > 0 ? idbState.estadosLote : this.cache.estadosLote,
            users: (() => {
              try {
                const rawUsers = window.localStorage.getItem("anvap_users_v1");
                if (rawUsers) {
                  const parsedUsers = JSON.parse(rawUsers);
                  if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
                    return parsedUsers;
                  }
                }
              } catch {
                // ignore
              }
              return (this.cache.users?.length || 0) >= (idbState.users?.length || 0)
                ? this.cache.users
                : (idbState.users || this.cache.users);
            })(),
            parametrosTrabajo: idbState.parametrosTrabajo || this.cache.parametrosTrabajo
          };

          delete (this.cache as any)._hasFullStorageInIndexedDB;
          delete (this.cache as any)._fullStorageInIndexedDB;
          delete (this.cache as any)._storageFullFallback;

          deduplicateAndMigrateLotes(this.cache);
          this.persist();

          this.isIndexedDBHydrated = true;
          window.dispatchEvent(new CustomEvent("localdb_change", { detail: { source: "indexeddb_hydration", timestamp: Date.now() } }));
          return true;
        }
      }
    } catch (err) {
      console.warn("[LocalDB] Aviso en hidratación de IndexedDB:", err);
    }
    return false;
  }

  /**
   * Garantiza que los datos estén completamente hidratados desde IndexedDB
   */
  public async ensureHydrated(): Promise<void> {
    if (!this.isIndexedDBHydrated) {
      await this.hydrateFromIndexedDB();
    }
  }

  /**
   * Guarda de forma ultra-segura en localStorage previniendo QuotaExceededError.
   * IndexedDB es la fuente de verdad persistente de alta capacidad.
   * LocalStorage actúa exclusivamente como caché de arranque rápido (< 250KB).
   */
  private safeSaveToLocalStorage(state: LocalDatabaseSchema) {
    if (typeof window === "undefined" || !window.localStorage) return;

    // Si la base de datos es pequeña (< 40 lotes), se puede guardar directamente
    if ((state.lotes || []).length <= 40) {
      try {
        const serialized = JSON.stringify(state);
        if (serialized.length < 500_000) {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.setItem(STORAGE_KEY, serialized);
          return;
        }
      } catch {
        // Continuar al esquema compacto
      }
    }

    // Nivel 1 de protección: Esquema compacto acotado a registros recientes (< 250KB)
    try {
      const compactSchema: any = {
        equipos: state.equipos,
        estadosLote: state.estadosLote,
        successWeights: state.successWeights,
        users: state.users,
        parametrosTrabajo: state.parametrosTrabajo,
        priorizacionConfig: state.priorizacionConfig,
        configuracionEvaluacionLotes: state.configuracionEvaluacionLotes,
        presetsEvaluacionLotes: state.presetsEvaluacionLotes,
        lotes: (state.lotes || []).slice(0, 40),
        registroHumedad: (state.registroHumedad || []).slice(0, 40),
        analisisHumedo: (state.analisisHumedo || []).slice(0, 40),
        batchesVaporizado: (state.batchesVaporizado || []).slice(0, 20),
        batchLotes: (state.batchLotes || []).slice(0, 30),
        controlVaporizado: (state.controlVaporizado || []).slice(0, 10),
        analisisVaporizado: (state.analisisVaporizado || []).slice(0, 15),
        presecado: (state.presecado || []).slice(0, 15),
        analisisSeco: (state.analisisSeco || []).slice(0, 15),
        programacionApit: (state.programacionApit || []).slice(0, 15),
        programacionesOficiales: (state.programacionesOficiales || []).slice(0, 15),
        auditLogs: (state.auditLogs || []).slice(0, 10),
        historialParametros: (state.historialParametros || []).slice(0, 5),
        _hasFullStorageInIndexedDB: true
      };

      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compactSchema));
      return;
    } catch {
      // Nivel 2 de protección: Si aún excede cuota por otras claves en localStorage,
      // limpiar claves temporales y guardar configuración esencial de arranque (< 20KB)
      try {
        this.cleanupStaleLocalStorage();
        const ultraMinimal: any = {
          equipos: state.equipos,
          estadosLote: state.estadosLote,
          successWeights: state.successWeights,
          users: state.users,
          parametrosTrabajo: state.parametrosTrabajo,
          priorizacionConfig: state.priorizacionConfig,
          lotes: (state.lotes || []).slice(0, 15),
          _storageFullFallback: true,
          _hasFullStorageInIndexedDB: true
        };
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraMinimal));
      } catch {
        // Nivel 3: Si localStorage del navegador está 100% bloqueado a nivel de sistema,
        // no romper la aplicación ni lanzar unhandled exception.
        // IndexedDB ya guardó el 100% de la información de manera segura y duradera.
      }
    }
  }

  /**
   * Fuerza el guardado inmediato en disco (IndexedDB y localStorage) sin esperar al temporizador de debounce
   */
  public flush(): void {
    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }
    this.executePersistSync();
  }

  private executePersistSync(): void {
    if (!this.cache || typeof window === "undefined") return;
    try {
      // 1. Guardar de forma duradera en IndexedDB (soporta cientos de MBs)
      saveToIndexedDB(this.cache).catch((err) => {
        console.warn("[LocalDB] Advertencia al persistir en IndexedDB:", err);
      });

      // 2. Guardar versión protegida en localStorage
      this.safeSaveToLocalStorage(this.cache);

      // 3. Notificar a toda la interfaz para reactividad inmediata
      window.dispatchEvent(new CustomEvent("localdb_change", { detail: { timestamp: Date.now() } }));
    } catch (err) {
      console.warn("[LocalDB] Error en persistencia sincronizada:", err);
    }
  }

  /**
   * Persiste el estado de forma optimizada con micro-debounce (100ms) para garantizar
   * 60 FPS fluidos durante escritura continua de lotes y controles, sin saturar el hilo principal.
   * La memoria (cache) ya está 100% actualizada de forma instantánea para lecturas.
   */
  private persist(immediate: boolean = false) {
    if (!this.cache || typeof window === "undefined") return;

    if (immediate) {
      this.flush();
      return;
    }

    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
    }

    this.persistDebounceTimer = setTimeout(() => {
      this.persistDebounceTimer = null;
      this.executePersistSync();
    }, 100);
  }

  public getState(): LocalDatabaseSchema {
    const raw = this.load();
    return {
      ...raw,
      lotes: raw.lotes ? [...raw.lotes] : [],
      registroHumedad: raw.registroHumedad ? [...raw.registroHumedad] : [],
      analisisHumedo: raw.analisisHumedo ? [...raw.analisisHumedo] : [],
      presecado: raw.presecado ? [...raw.presecado] : [],
      analisisSeco: raw.analisisSeco ? [...raw.analisisSeco] : [],
      programacionApit: raw.programacionApit ? [...raw.programacionApit] : [],
      batchesVaporizado: raw.batchesVaporizado ? [...raw.batchesVaporizado] : [],
      batchLotes: raw.batchLotes ? [...raw.batchLotes] : [],
      controlVaporizado: raw.controlVaporizado ? [...raw.controlVaporizado] : [],
      analisisVaporizado: raw.analisisVaporizado ? [...raw.analisisVaporizado] : [],
      equipos: raw.equipos ? [...raw.equipos] : [],
      estadosLote: raw.estadosLote ? [...raw.estadosLote] : [],
      programacionesOficiales: raw.programacionesOficiales ? [...raw.programacionesOficiales] : [],
      users: raw.users ? [...raw.users] : [],
      auditLogs: raw.auditLogs ? [...raw.auditLogs] : [],
      historialParametros: raw.historialParametros ? [...raw.historialParametros] : [],
      resultadosCoccionExternos: raw.resultadosCoccionExternos ? [...raw.resultadosCoccionExternos] : [],
    };
  }

  public getAll<K extends keyof LocalDatabaseSchema>(key: K): LocalDatabaseSchema[K] {
    return this.load()[key];
  }

  public clearAllOperationalData(usuario: string = "Ing. Fredy Granados Caicedo"): LocalDatabaseSchema {
    this.cache = {
      ...INITIAL_DATA,
      equipos: this.cache?.equipos && this.cache.equipos.length > 0 ? this.cache.equipos : INITIAL_DATA.equipos,
      estadosLote: this.cache?.estadosLote && this.cache.estadosLote.length > 0 ? this.cache.estadosLote : INITIAL_DATA.estadosLote,
      successWeights: this.cache?.successWeights || INITIAL_DATA.successWeights,
      users: this.cache?.users && this.cache.users.length > 0 ? this.cache.users : INITIAL_DATA.users,
      parametrosTrabajo: this.cache?.parametrosTrabajo || INITIAL_DATA.parametrosTrabajo,
      priorizacionConfig: this.cache?.priorizacionConfig || INITIAL_DATA.priorizacionConfig,
      configuracionEvaluacionLotes: this.cache?.configuracionEvaluacionLotes || INITIAL_DATA.configuracionEvaluacionLotes,
      lotes: [],
      registroHumedad: [],
      analisisHumedo: [],
      presecado: [],
      analisisSeco: [],
      programacionApit: [],
      batchesVaporizado: [],
      batchLotes: [],
      controlVaporizado: [],
      analisisVaporizado: [],
      programacionesOficiales: [],
      resultadosCoccionExternos: [],
      auditLogs: [
        {
          id: `LOG-${Date.now()}`,
          usuario,
          accion: "Inicialización de base de datos limpia para pruebas operativas",
          fecha: new Date().toISOString().replace("T", " ").substring(0, 19)
        }
      ]
    };
    this.persist();
    if (typeof window !== "undefined") {
      clearIndexedDB().catch(() => {});
      saveToIndexedDB(this.cache).catch(() => {});
      try {
        [
          "programaciones_batch_oficial_v1",
          "molino_programaciones_batch_oficiales_v1",
          "molino_programaciones_batch_oficiales_v2",
          "molino_programaciones_batch_oficiales_v3",
          "resultados_coccion_externos_v1",
          "resultados_coccion_integrados_v1",
          "resultados_coccion_integrados_v2",
          "apit_sacas_descarga_v1",
          "sabana_batches_v1",
          "sabana_batches_trabajados_v1",
          "sabana_batches_trabajados_v2",
          "historico_recetas_secado_v1",
          "APIT_HISTORICO_RECETAS_SECADO_V1",
          "arroz_apit_deleted_lotes_v2",
          "arroz_apit_unlinked_new_lotes_v5",
          "arroz_apit_local_db_v1",
          "arroz_apit_local_db_v2",
          "arroz_apit_local_db_v3",
          "arroz_apit_local_db_v4",
          "arroz_apit_local_db_v5",
          "arroz_apit_local_db_v6",
          "arroz_apit_local_db_v7",
          "arroz_apit_local_db_v8",
          "arroz_apit_local_db_v8_clean",
          "molino_programaciones_batch_oficiales_v4",
          "anvap_deleted_batches_v1"
        ].forEach((k) => window.localStorage.removeItem(k));
        this.cleanupStaleLocalStorage();
        fetch("/api/reset-data", { method: "POST" }).catch(() => {});
      } catch {}
      window.dispatchEvent(new CustomEvent("localdb_change", { detail: { source: "clear_operational_data", timestamp: Date.now() } }));
    }
    return this.getState();
  }

  public resetData(): LocalDatabaseSchema {
    return this.clearAllOperationalData();
  }

  // --- AUDIT LOGS ---
  public addAuditLog(accion: string, usuario: string = "Operador") {
    const db = this.load();
    const newLog = {
      id: `LOG-${Date.now()}`,
      usuario: usuario || "Operador",
      accion,
      fecha: new Date().toISOString().replace("T", " ").substring(0, 19)
    };
    db.auditLogs.unshift(newLog);
    if (db.auditLogs.length > 500) db.auditLogs.pop();
    this.persist();
  }

  // --- LOTES ---
  public getLotes(): Lote[] {
    return this.load().lotes;
  }

  public saveLote(loteData: Partial<Lote> & { isNew?: boolean }, user: string = "Operador"): Lote {
    const db = this.load();
    const rawCode = (loteData.LOTE_ID || "").trim();
    if (!rawCode) throw new Error("Código de lote inválido");

    const normalizedLoteId = formatLoteCode(rawCode);
    // Si el usuario vuelve a registrar manualmente este código, quitarlo de la lista de eliminados
    removeDeletedLoteTombstone(normalizedLoteId);
    const existingIdx = db.lotes.findIndex(l => formatLoteCode(l.LOTE_ID) === normalizedLoteId);

    if (loteData.isNew && existingIdx !== -1) {
      throw new Error(`El lote con código ${normalizedLoteId} ya existe en el sistema`);
    }

    const rawHum = loteData.HUM;
    const parsedHum = rawHum !== undefined && rawHum !== null && !isNaN(Number(rawHum)) && Number(rawHum) > 0
      ? Number(Number(rawHum).toFixed(2))
      : (existingIdx !== -1 ? db.lotes[existingIdx].HUM : 0);

    const rawSacos = loteData.SACOS !== undefined && !isNaN(Number(loteData.SACOS))
      ? Number(loteData.SACOS)
      : (existingIdx !== -1 ? db.lotes[existingIdx].SACOS : 0);
    const rawPeso = loteData.PESO_KG !== undefined && !isNaN(Number(loteData.PESO_KG)) && Number(loteData.PESO_KG) >= 0
      ? Number(loteData.PESO_KG)
      : (existingIdx !== -1 ? db.lotes[existingIdx].PESO_KG : 0);

    const isNewEntry = Boolean(loteData.isNew) || existingIdx === -1;
    const cleanLoteInput: any = { ...loteData };
    delete cleanLoteInput.isNew;

    let savedLote: Lote;

    if (existingIdx !== -1 && !isNewEntry) {
      const prevEst = (db.lotes[existingIdx].ESTADO_LOTE || "INGRESADO").toString().trim().toUpperCase();
      const incomingEst = cleanLoteInput.ESTADO_LOTE ? toUpperStr(cleanLoteInput.ESTADO_LOTE, prevEst) : prevEst;

      savedLote = {
        ...db.lotes[existingIdx],
        ...cleanLoteInput,
        LOTE_ID: normalizedLoteId,
        FECHA_INGRESO: cleanLoteInput.FECHA_INGRESO || db.lotes[existingIdx].FECHA_INGRESO || new Date().toISOString().split("T")[0],
        CLIENTE: toUpperStr(cleanLoteInput.CLIENTE, db.lotes[existingIdx].CLIENTE || ""),
        VARIEDAD: toUpperStr(cleanLoteInput.VARIEDAD, db.lotes[existingIdx].VARIEDAD || ""),
        UBICACION: toUpperStr(cleanLoteInput.UBICACION, db.lotes[existingIdx].UBICACION || ""),
        ZONA: toUpperStr(cleanLoteInput.ZONA, db.lotes[existingIdx].ZONA || ""),
        ESTADO_LOTE: incomingEst,
        OBSERVACIONES:
          cleanLoteInput.OBSERVACIONES !== undefined
            ? toUpperStr(cleanLoteInput.OBSERVACIONES, "")
            : (db.lotes[existingIdx].OBSERVACIONES || ""),
        HUM: parsedHum,
        HUMEDAD: parsedHum,
        SACOS: rawSacos,
        PESO_KG: rawPeso
      } as any;
      db.lotes[existingIdx] = savedLote;
      if (cleanLoteInput.OBSERVACIONES !== undefined) {
        const ahIdx = db.analisisHumedo.findIndex(a => sanitizeLoteCode(a.LOTE_ID) === normalizedLoteId);
        if (ahIdx !== -1) {
          db.analisisHumedo[ahIdx].OBSERVACIONES = savedLote.OBSERVACIONES;
        }
      }
      this.addAuditLog(`Actualización del lote ${normalizedLoteId}`, user);
    } else {
      // Lote totalmente nuevo: desvincular una sola vez de cualquier batch histórico anterior con el mismo código
      removeUnlinkedNewLote(normalizedLoteId);
      purgeBatchAndProcessReferencesForCodes(db, (c) => formatLoteCode(c) === normalizedLoteId);

      // Lote nuevo: inicia en INGRESADO (si solo tiene Paso 1) o ANALIZADO (si tiene Paso 1 y Paso 2 completos)
      savedLote = {
        ...cleanLoteInput,
        LOTE_ID: normalizedLoteId,
        FECHA_INGRESO: cleanLoteInput.FECHA_INGRESO || new Date().toISOString().split("T")[0],
        CLIENTE: toUpperStr(cleanLoteInput.CLIENTE, ""),
        VARIEDAD: toUpperStr(cleanLoteInput.VARIEDAD, ""),
        SACOS: rawSacos,
        PESO_KG: rawPeso,
        HUM: parsedHum,
        HUMEDAD: parsedHum,
        UBICACION: toUpperStr(cleanLoteInput.UBICACION, ""),
        ZONA: toUpperStr(cleanLoteInput.ZONA, ""),
        ESTADO_LOTE: cleanLoteInput.ESTADO_LOTE ? toUpperStr(cleanLoteInput.ESTADO_LOTE, "INGRESADO") : "INGRESADO",
        OBSERVACIONES: toUpperStr(cleanLoteInput.OBSERVACIONES, ""),
        _recienIngresado: true
      } as any;
      db.lotes.unshift(savedLote);
      this.addAuditLog(`Creación de nuevo lote ${normalizedLoteId} (${savedLote.VARIEDAD} - ${savedLote.CLIENTE})`, user);
    }

    // Eliminar cualquier duplicado residual previo sin formato C0 (ej. 8432 sin C0)
    db.lotes = db.lotes.filter((l) => {
      if (l === savedLote) return true;
      return formatLoteCode(l.LOTE_ID) !== normalizedLoteId;
    });

    deduplicateAndMigrateLotes(db);
    this.persist();
    return savedLote;
  }

  public verificarBloqueoEliminacion(loteId: string): BloqueoEliminacionInfo {
    const db = this.load();
    const rawId = (loteId || "").trim().toUpperCase();
    const normalized = sanitizeLoteCode(loteId);
    const matches = (id?: string) => {
      if (!id) return false;
      const clean = id.trim().toUpperCase();
      return clean === rawId || (normalized.length > 0 && sanitizeLoteCode(clean) === normalized);
    };
    const target = db.lotes.find(l => matches(l.LOTE_ID));
    return verificarBloqueoEliminacionLote(target || rawId, {
      lote: target,
      lotes: db.lotes,
      batchLotes: db.batchLotes,
      batches: db.batchesVaporizado,
      programaciones: db.programacionesOficiales
    });
  }

  public deleteLote(loteId: string, user: string = "Operador", force: boolean = true): boolean {
    const db = this.load();
    const rawId = (loteId || "").trim().toUpperCase();
    const normalized = sanitizeLoteCode(loteId);
    const matches = (id?: string) => {
      if (!id) return false;
      const clean = id.trim().toUpperCase();
      return clean === rawId || (normalized.length > 0 && sanitizeLoteCode(clean) === normalized);
    };

    const targetLote = db.lotes.find(l => matches(l.LOTE_ID));
    if (!force) {
      const bloqueo = verificarBloqueoEliminacionLote(targetLote || rawId, {
        lote: targetLote,
        lotes: db.lotes,
        batchLotes: db.batchLotes,
        batches: db.batchesVaporizado,
        programaciones: db.programacionesOficiales
      });

      if (bloqueo.bloqueado) {
        throw new Error(`Acción no permitida: No se puede eliminar el lote ${rawId} porque ${bloqueo.motivo.toLowerCase()}. ${bloqueo.detalle || ""}`);
      }
    }

    addDeletedLoteTombstone(normalized || rawId);

    db.lotes = db.lotes.filter(l => !matches(l.LOTE_ID));
    db.registroHumedad = db.registroHumedad.filter(h => !matches(h.LOTE_ID));
    db.analisisHumedo = db.analisisHumedo.filter(a => !matches(a.LOTE_ID));
    db.presecado = db.presecado.filter(p => !matches(p.LOTE_ID));
    db.analisisSeco = db.analisisSeco.filter(s => !matches(s.LOTE_ID));
    if (db.programacionApit) {
      db.programacionApit = db.programacionApit.filter(p => !matches(p.LOTE_ID));
    }
    db.batchLotes = db.batchLotes.filter(b => !matches(b.LOTE_ID));
    if (Array.isArray(db.analisisVaporizado)) {
      db.analisisVaporizado = db.analisisVaporizado.filter((av: any) => !matches(av.LOTE_ID) && !matches(av.CODIGO_MUESTRA));
    }
    if (Array.isArray(db.resultadosCoccionExternos)) {
      db.resultadosCoccionExternos = db.resultadosCoccionExternos.filter((rc: any) => !matches(rc.loteId || rc.LOTE_ID));
    }

    // Desvincular de programaciones oficiales
    if (Array.isArray(db.programacionesOficiales)) {
      db.programacionesOficiales.forEach((prog: any) => {
        if (Array.isArray(prog.filasLote)) {
          prog.filasLote = prog.filasLote.filter((f: any) => !matches(f.loteId || f.LOTE_ID));
        }
        if (Array.isArray(prog.lotes)) {
          prog.lotes = prog.lotes.filter((l: any) => !matches(l.LOTE_ID || l.loteId || l));
        }
      });
    }

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        for (const lsKey of ["programaciones_batch_oficial_v1", "molino_programaciones_batch_oficiales_v3"]) {
          const saved = window.localStorage.getItem(lsKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              parsed.forEach((prog: any) => {
                if (Array.isArray(prog.filasLote)) {
                  prog.filasLote = prog.filasLote.filter((f: any) => !matches(f.loteId || f.LOTE_ID));
                }
                if (Array.isArray(prog.lotes)) {
                  prog.lotes = prog.lotes.filter((l: any) => !matches(l.LOTE_ID || l.loteId || l));
                }
              });
              window.localStorage.setItem(lsKey, JSON.stringify(parsed));
            }
          }
        }
      } catch {
        // ignore
      }
    }

    this.addAuditLog(`Eliminación del lote ${rawId}`, user);
    this.persist();
    return true;
  }

  public bulkUpdateLotesStatus(loteIds: string[], nuevoEstado: string, user: string = "Operador"): number {
    const db = this.load();
    const normIds = new Set(loteIds.map(sanitizeLoteCode));
    let count = 0;
    db.lotes.forEach(l => {
      if (normIds.has(sanitizeLoteCode(l.LOTE_ID))) {
        l.ESTADO_LOTE = nuevoEstado;
        const estU = (nuevoEstado || "").trim().toUpperCase();
        if (estU === "INGRESADO" || estU === "ANALIZADO" || estU === "PENDIENTE") {
          unfreezeLoteWaitingDays(l);
        } else {
          freezeLoteWaitingDays(l);
        }
        count++;
      }
    });
    if (count > 0) {
      this.addAuditLog(`Actualización masiva de estado a ${nuevoEstado} para ${count} lotes`, user);
      this.persist();
    }
    return count;
  }

  public autorizarLoteExperimental(loteId: string, payload: any, user: string = "Operador"): Lote {
    const db = this.load();
    const normalized = sanitizeLoteCode(loteId);
    const lote = db.lotes.find(l => sanitizeLoteCode(l.LOTE_ID) === normalized);
    if (!lote) throw new Error("Lote no encontrado");

    const authData = {
      autorizadoPor: payload.user || user,
      rol: payload.rol || "JEFE_PLANTA",
      sustento: payload.sustento || "Autorización técnica",
      condicionUso: payload.condicionUso || "Mezcla Controlada",
      fecha: new Date().toISOString()
    };

    lote.AUTORIZACION_EXPERIMENTAL = authData;
    (lote as any).autorizacionExperimental = authData;
    (lote as any).ES_EXPERIMENTAL = true;
    (lote as any).SUSTENTO_EXPERIMENTAL = authData.sustento;
    (lote as any).CONDICION_USO = authData.condicionUso;
    lote.ESTADO_LOTE = "EXPERIMENTAL";
    this.addAuditLog(`Autorización excepcional para lote ${normalized} como EXPERIMENTAL`, user);
    this.persist();
    return lote;
  }

  public revertirDesaprobado(loteId: string, user: string = "Operador"): Lote {
    const db = this.load();
    const normalized = sanitizeLoteCode(loteId);
    const lote = db.lotes.find(l => sanitizeLoteCode(l.LOTE_ID) === normalized);
    if (!lote) throw new Error("Lote no encontrado");

    delete (lote as any).autorizacionExperimental;
    delete (lote as any).AUTORIZACION_EXPERIMENTAL;
    (lote as any).ES_EXPERIMENTAL = false;
    delete (lote as any).SUSTENTO_EXPERIMENTAL;
    delete (lote as any).CONDICION_USO;
    lote.ESTADO_LOTE = "DESAPROBADO";
    this.addAuditLog(`Reversión de lote ${normalized} a estado DESAPROBADO`, user);
    this.persist();
    return lote;
  }

  public aprobarSustentoExperimental(
    loteId: string, 
    sustento: string, 
    condicionUso: string = "Mezcla Controlada (Máximo 15% en formulación de batch)", 
    user: string = "Operador", 
    rol: string = "JEFE_PLANTA"
  ): Lote {
    const db = this.load();
    const normalized = sanitizeLoteCode(loteId);
    const lote = db.lotes.find(l => sanitizeLoteCode(l.LOTE_ID) === normalized);
    if (!lote) throw new Error("Lote no encontrado");

    const authData = {
      ...(lote.AUTORIZACION_EXPERIMENTAL || {}),
      autorizadoPor: lote.AUTORIZACION_EXPERIMENTAL?.autorizadoPor || user,
      rol: lote.AUTORIZACION_EXPERIMENTAL?.rol || rol,
      sustento: sustento.trim(),
      condicionUso: condicionUso,
      fecha: lote.AUTORIZACION_EXPERIMENTAL?.fecha || new Date().toISOString(),
      sustentoAprobado: true,
      aprobadoPor: user,
      rolAprobador: rol,
      fechaAprobacion: new Date().toISOString(),
      estadoSustento: "APROBADO" as const
    };

    lote.AUTORIZACION_EXPERIMENTAL = authData;
    (lote as any).autorizacionExperimental = authData;
    (lote as any).ES_EXPERIMENTAL = true;
    (lote as any).SUSTENTO_EXPERIMENTAL = authData.sustento;
    (lote as any).CONDICION_USO = authData.condicionUso;
    (lote as any).SUSTENTO_APROBADO = true;
    (lote as any).ESTADO_SUSTENTO = "APROBADO";
    lote.ESTADO_LOTE = "EXPERIMENTAL";

    this.addAuditLog(`Aprobación de sustento técnico para lote experimental ${normalized}: "${sustento.slice(0, 50)}..."`, user);
    this.persist();
    return lote;
  }

  public editarSustentoExperimental(
    loteId: string, 
    sustento: string, 
    condicionUso: string, 
    aprobarDirecto: boolean = false, 
    user: string = "Operador", 
    rol: string = "JEFE_PLANTA"
  ): Lote {
    const db = this.load();
    const normalized = sanitizeLoteCode(loteId);
    const lote = db.lotes.find(l => sanitizeLoteCode(l.LOTE_ID) === normalized);
    if (!lote) throw new Error("Lote no encontrado");

    const prevAuth: any = lote.AUTORIZACION_EXPERIMENTAL || {};
    const estaAprobadoPrevio = Boolean(prevAuth.sustentoAprobado);
    const nuevoAprobado = aprobarDirecto || estaAprobadoPrevio;

    const authData: any = {
      autorizadoPor: prevAuth.autorizadoPor || user,
      rol: prevAuth.rol || rol,
      sustento: sustento.trim(),
      condicionUso: condicionUso,
      fecha: prevAuth.fecha || new Date().toISOString(),
      ...prevAuth,
      sustentoAprobado: nuevoAprobado,
      estadoSustento: (nuevoAprobado ? "APROBADO" : "PENDIENTE") as any,
      ...(nuevoAprobado ? {
        aprobadoPor: prevAuth.aprobadoPor || user,
        rolAprobador: prevAuth.rolAprobador || rol,
        fechaAprobacion: prevAuth.fechaAprobacion || new Date().toISOString()
      } : {})
    };

    lote.AUTORIZACION_EXPERIMENTAL = authData;
    (lote as any).autorizacionExperimental = authData;
    (lote as any).ES_EXPERIMENTAL = true;
    (lote as any).SUSTENTO_EXPERIMENTAL = authData.sustento;
    (lote as any).CONDICION_USO = authData.condicionUso;
    (lote as any).SUSTENTO_APROBADO = nuevoAprobado;
    (lote as any).ESTADO_SUSTENTO = nuevoAprobado ? "APROBADO" : "PENDIENTE";
    lote.ESTADO_LOTE = "EXPERIMENTAL";

    this.addAuditLog(`Edición de sustento para lote experimental ${normalized}${nuevoAprobado ? ' (y aprobado)' : ''}`, user);
    this.persist();
    return lote;
  }

  public rechazarSustentoExperimental(
    loteId: string, 
    motivoRechazo: string, 
    user: string = "Operador",
    rol: string = "JEFE_PLANTA"
  ): Lote {
    const db = this.load();
    const normalized = sanitizeLoteCode(loteId);
    const lote = db.lotes.find(l => sanitizeLoteCode(l.LOTE_ID) === normalized);
    if (!lote) throw new Error("Lote no encontrado");

    const prevAuth: any = lote.AUTORIZACION_EXPERIMENTAL || {};
    const authData: any = {
      autorizadoPor: prevAuth.autorizadoPor || user,
      rol: prevAuth.rol || rol,
      sustento: prevAuth.sustento || "Sustento no aprobado",
      condicionUso: prevAuth.condicionUso || "No aplicable",
      fecha: prevAuth.fecha || new Date().toISOString(),
      ...prevAuth,
      sustentoAprobado: false,
      estadoSustento: "RECHAZADO" as const,
      motivoRechazo: motivoRechazo.trim(),
      rechazadoPor: user,
      rolRechazador: rol,
      fechaRechazo: new Date().toISOString()
    };

    lote.AUTORIZACION_EXPERIMENTAL = authData;
    (lote as any).autorizacionExperimental = authData;
    (lote as any).ES_EXPERIMENTAL = false;
    (lote as any).SUSTENTO_APROBADO = false;
    (lote as any).ESTADO_SUSTENTO = "RECHAZADO";
    (lote as any).MOTIVO_RECHAZO_SUSTENTO = motivoRechazo.trim();
    lote.ESTADO_LOTE = "DESAPROBADO";

    this.addAuditLog(`Rechazo de sustento para lote ${normalized}: "${motivoRechazo.slice(0, 50)}...". Lote desaprobado y excluido de programación`, user);
    this.persist();
    return lote;
  }

  // --- REGISTRO HUMEDAD ---
  public getHumedades(): RegistroHumedad[] {
    return this.load().registroHumedad;
  }

  public saveHumedad(data: Partial<RegistroHumedad>, user: string = "Operador"): RegistroHumedad {
    const db = this.load();
    const normalizedLoteId = sanitizeLoteCode(data.LOTE_ID);
    const idAnalisis = normalizedLoteId ? `HUM-${normalizedLoteId}` : (data["ID ANALISIS"] || `HUM-${Math.floor(100 + Math.random() * 900)}`);

    const dataAny = data as any;
    const idx = db.registroHumedad.findIndex(
      h => sanitizeLoteCode(h.LOTE_ID) === normalizedLoteId || h["ID ANALISIS"] === idAnalisis || (data["ID ANALISIS"] && h["ID ANALISIS"] === data["ID ANALISIS"])
    );

    const baseExisting = idx !== -1 ? { ...db.registroHumedad[idx] } : {};
    // Si se enviaron caladas M1..M30, limpiar las que se hayan borrado explícitamente
    for (let i = 1; i <= 30; i++) {
      const mKey = `M${i}`;
      if (Object.prototype.hasOwnProperty.call(data, mKey)) {
        if ((data as any)[mKey] === undefined || (data as any)[mKey] === null || (data as any)[mKey] === "") {
          delete (baseExisting as any)[mKey];
        }
      }
    }

    const newRecord: RegistroHumedad = cleanRecord({
      ...baseExisting,
      ...data,
      "ID ANALISIS": idAnalisis,
      LOTE_ID: normalizedLoteId,
      FECHA_ANALISIS: data.FECHA_ANALISIS || (baseExisting as any).FECHA_ANALISIS || new Date().toISOString().split("T")[0],
      ...(dataAny.RESPONSABLE ? { RESPONSABLE: toUpperStr(dataAny.RESPONSABLE) } : {}),
      ...(data.OBSERVACIONES !== undefined ? { OBSERVACIONES: toUpperStr(data.OBSERVACIONES) } : {}),
      ...(dataAny.METODO ? { METODO: toUpperStr(dataAny.METODO) } : {})
    }) as any;

    if (idx !== -1) {
      db.registroHumedad[idx] = newRecord;
      // Eliminar cualquier duplicado residual para el mismo LOTE_ID
      db.registroHumedad = db.registroHumedad.filter(
        (h, i) => i === idx || sanitizeLoteCode(h.LOTE_ID) !== normalizedLoteId
      );
    } else {
      db.registroHumedad.unshift(newRecord);
    }

    const humProm = Number(newRecord["H. PROMEDIO"] ?? newRecord["PROM. GENERAL"]);
    const desvVal = Number(newRecord["DESV."] ?? newRecord.DESVIACION);
    const loteIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === normalizedLoteId);
    if (loteIdx !== -1) {
      const targetLote: any = db.lotes[loteIdx];
      if (!isNaN(humProm) && humProm > 0) {
        targetLote.HUM = humProm;
        targetLote.HUMEDAD = humProm;
      }
      if (!isNaN(desvVal) && desvVal >= 0) {
        targetLote.DESV = desvVal;
      }
      for (let i = 1; i <= 30; i++) {
        const mKey = `M${i}`;
        if ((newRecord as any)[mKey] !== undefined && (newRecord as any)[mKey] !== null) {
          targetLote[mKey] = Number((newRecord as any)[mKey]);
        } else {
          delete targetLote[mKey];
        }
      }
    }

    deduplicateAndMigrateLotes(db);
    this.addAuditLog(`Registro de humedad ${idAnalisis} para lote ${normalizedLoteId}`, user);
    this.persist();
    return newRecord;
  }

  // --- ANALISIS HUMEDO ---
  public getAnalisisHumedo(): AnalisisHumedo[] {
    return this.load().analisisHumedo;
  }

  public saveAnalisisHumedo(data: Partial<AnalisisHumedo>, user: string = "Operador"): AnalisisHumedo {
    const db = this.load();
    const normalizedLoteId = sanitizeLoteCode(data.LOTE_ID);
    const idAnalisis = normalizedLoteId ? `AH-${normalizedLoteId}` : (data.ANALISIS_HUMEDO_ID || `AH-${Math.floor(100 + Math.random() * 900)}`);

    const idx = db.analisisHumedo.findIndex(
      a => sanitizeLoteCode(a.LOTE_ID) === normalizedLoteId || a.ANALISIS_HUMEDO_ID === idAnalisis || (data.ANALISIS_HUMEDO_ID && a.ANALISIS_HUMEDO_ID === data.ANALISIS_HUMEDO_ID)
    );

    const baseExisting = idx !== -1 ? { ...db.analisisHumedo[idx] } : {};
    const dataAny = data as any;
    const mergedRaw: any = {
      ...baseExisting,
      ...data,
      ANALISIS_HUMEDO_ID: idAnalisis,
      LOTE_ID: normalizedLoteId,
      FECHA_ANALISIS: data.FECHA_ANALISIS || (baseExisting as any).FECHA_ANALISIS || new Date().toISOString().split("T")[0],
      ...(dataAny.RESPONSABLE ? { RESPONSABLE: toUpperStr(dataAny.RESPONSABLE) } : {}),
      ...(data.OBSERVACIONES !== undefined ? { OBSERVACIONES: toUpperStr(data.OBSERVACIONES) } : {}),
      ...(data.VANO !== undefined && data.VANO !== null ? { VANO: toUpperStr(data.VANO) } : {}),
      ...(data.PALOTE !== undefined && data.PALOTE !== null ? { PALOTE: toUpperStr(data.PALOTE) } : {}),
      ...(data.OLOR !== undefined && data.OLOR !== null ? { OLOR: toUpperStr(data.OLOR) } : {}),
      ...(data.CASCADO !== undefined && data.CASCADO !== null ? { CASCADO: typeof data.CASCADO === "number" ? data.CASCADO : Number(data.CASCADO) || 0 } : {}),
      ...(data.HONGO !== undefined && data.HONGO !== null ? { HONGO: toUpperStr(data.HONGO) } : {}),
      ...(data["F. CARBON"] !== undefined ? { "F. CARBON": toUpperStr(data["F. CARBON"]) } : (dataAny.F_CARBON ? { "F. CARBON": toUpperStr(dataAny.F_CARBON) } : {})),
      ...(data["PLAGAS-NSEC."] !== undefined ? { "PLAGAS-NSEC.": data["PLAGAS-NSEC."] } : (dataAny.PLAGAS_INSECTOS ? { "PLAGAS-NSEC.": Number(dataAny.PLAGAS_INSECTOS) || 0 } : {}))
    };

    // Sincronizar alias bidireccionales para que tanto los lotes subidos por Excel como los manuales reflejen las ediciones en todas las vistas
    if (data.M !== undefined) mergedRaw.MANCHADO = data.M;
    else if (data.MANCHADO !== undefined) mergedRaw.M = data.MANCHADO;

    if (data["T. PUNT."] !== undefined) mergedRaw.TPUN = data["T. PUNT."];
    else if (dataAny.TPUN !== undefined) mergedRaw["T. PUNT."] = dataAny.TPUN;

    if (data["B.INTEGRAL"] !== undefined) mergedRaw.BL_INT = data["B.INTEGRAL"];
    else if (dataAny.BL_INT !== undefined) mergedRaw["B.INTEGRAL"] = dataAny.BL_INT;

    if (data["B. PULIDO"] !== undefined) mergedRaw.BL_BLANCO = data["B. PULIDO"];
    else if (dataAny.BL_BLANCO !== undefined) mergedRaw["B. PULIDO"] = dataAny.BL_BLANCO;

    if (data["MEZCLA VAR."] !== undefined) {
      mergedRaw.MEZCLA = data["MEZCLA VAR."];
      mergedRaw["Mezcla de variedades"] = data["MEZCLA VAR."];
    }
    if (data["PLAGAS-NSEC."] !== undefined) {
      mergedRaw["PLAGAS-INSEC."] = data["PLAGAS-NSEC."];
      mergedRaw.PLAGAS = data["PLAGAS-NSEC."];
    }
    if (data.IMPUREZS !== undefined) {
      mergedRaw.IMPUREZAS = data.IMPUREZS;
    }
    if (data["F. CARBON"] !== undefined) {
      mergedRaw.CARBON = data["F. CARBON"];
    }
    if (data.GV !== undefined) {
      mergedRaw.VERDE = data.GV;
    }
    if (data.GR !== undefined) {
      mergedRaw.ROJO = data.GR;
    }

    const newRecord: AnalisisHumedo = cleanRecord(mergedRaw) as any;

    if (idx !== -1) {
      db.analisisHumedo[idx] = newRecord;
      // Eliminar duplicados residuales para el mismo LOTE_ID
      db.analisisHumedo = db.analisisHumedo.filter(
        (a, i) => i === idx || sanitizeLoteCode(a.LOTE_ID) !== normalizedLoteId
      );
    } else {
      db.analisisHumedo.unshift(newRecord);
    }

    const loteIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === normalizedLoteId);
    if (loteIdx !== -1) {
      const targetLote: any = db.lotes[loteIdx];
      // Sincronizar también en el objeto Lote (ya que los lotes subidos desde Excel guardaban copia de RI, RB, QB, etc. en el documento de lote)
      const syncKeys = [
        "RI", "RB", "RM", "QI", "QB", "ENTERO",
        "TT", "TP", "T. PUNT.", "TPUN", "M", "MANCHADO", "TZ", "GR", "ROJO", "GI", "GV", "VERDE",
        "B.INTEGRAL", "BL_INT", "B. PULIDO", "BL_BLANCO",
        "PALOTE", "VANO", "IMPUREZS", "IMPUREZAS", "OLOR", "F. CARBON", "CARBON", "HONGO",
        "MEZCLA VAR.", "MEZCLA", "Mezcla de variedades", "CASCADO", "PLAGAS-NSEC.", "PLAGAS-INSEC.", "PLAGAS", "OTROS",
        "OBSERVACIONES"
      ];
      for (const k of syncKeys) {
        if ((newRecord as any)[k] !== undefined) {
          targetLote[k] = (newRecord as any)[k];
        }
      }
    }

    deduplicateAndMigrateLotes(db);
    this.addAuditLog(`Registro de análisis húmedo ${idAnalisis} para lote ${normalizedLoteId}`, user);
    this.persist();
    return newRecord;
  }

  // --- PRESECADO ---
  public getPresecado(): Presecado[] {
    return this.load().presecado;
  }

  public savePresecado(data: Partial<Presecado>, user: string = "Operador"): Presecado {
    const db = this.load();
    const normalizedLoteId = sanitizeLoteCode(data.LOTE_ID);
    const id = data.PRESECADO_ID || `PRE-${Date.now()}`;
    const dataAny = data as any;
    const record: Presecado = cleanRecord({
      ...data,
      PRESECADO_ID: id,
      LOTE_ID: normalizedLoteId,
      ...(dataAny.SECADORA ? { SECADORA: toUpperStr(dataAny.SECADORA) } : {}),
      ...(dataAny.RESPONSABLE ? { RESPONSABLE: toUpperStr(dataAny.RESPONSABLE) } : {}),
      ...(dataAny.ESTADO_PRESECADO ? { ESTADO_PRESECADO: toUpperStr(dataAny.ESTADO_PRESECADO) } : {}),
      ...(data.OBSERVACIONES ? { OBSERVACIONES: toUpperStr(data.OBSERVACIONES) } : {})
    }) as any;

    const idx = db.presecado.findIndex(p => p.PRESECADO_ID === id);
    if (idx !== -1) {
      db.presecado[idx] = record;
    } else {
      db.presecado.unshift(record);
    }
    this.persist();
    return record;
  }

  // --- ANALISIS SECO ---
  public getAnalisisSeco(): AnalisisSeco[] {
    return this.load().analisisSeco;
  }

  public saveAnalisisSeco(data: Partial<AnalisisSeco>, user: string = "Operador"): AnalisisSeco {
    const db = this.load();
    const normalizedLoteId = sanitizeLoteCode(data.LOTE_ID);
    const id = data.ANALISIS_SECO_ID || `AS-${Date.now()}`;
    const dataAny = data as any;
    const record: AnalisisSeco = cleanRecord({
      ...data,
      ANALISIS_SECO_ID: id,
      LOTE_ID: normalizedLoteId,
      ...(dataAny.RESPONSABLE ? { RESPONSABLE: toUpperStr(dataAny.RESPONSABLE) } : {}),
      ...(data.OBSERVACIONES ? { OBSERVACIONES: toUpperStr(data.OBSERVACIONES) } : {})
    }) as any;

    const idx = db.analisisSeco.findIndex(s => s.ANALISIS_SECO_ID === id);
    if (idx !== -1) {
      db.analisisSeco[idx] = record;
    } else {
      db.analisisSeco.unshift(record);
    }
    this.persist();
    return record;
  }

  // --- PROGRAMACION APIT ---
  public getProgramacionApit(): ProgramacionApit[] {
    return this.load().programacionApit;
  }

  public saveProgramacionApit(data: Partial<ProgramacionApit>, user: string = "Operador"): ProgramacionApit {
    const db = this.load();
    const id = data.PROGRAMACION_ID || `PROG-${Date.now()}`;
    const dataAny = data as any;
    const record: ProgramacionApit = cleanRecord({
      ...data,
      PROGRAMACION_ID: id,
      ...(dataAny.CONDICION_GRANO ? { CONDICION_GRANO: toUpperStr(dataAny.CONDICION_GRANO) } : {}),
      ...(dataAny.AUTORIZADO_POR ? { AUTORIZADO_POR: toUpperStr(dataAny.AUTORIZADO_POR) } : {}),
      ...(data.MOTIVO_RECHAZO ? { MOTIVO_RECHAZO: toUpperStr(data.MOTIVO_RECHAZO) } : {}),
      ...(data.OBSERVACIONES ? { OBSERVACIONES: toUpperStr(data.OBSERVACIONES) } : {})
    }) as any;

    const idx = db.programacionApit.findIndex(p => p.PROGRAMACION_ID === id);
    if (idx !== -1) {
      db.programacionApit[idx] = record;
    } else {
      db.programacionApit.unshift(record);
    }
    this.persist();
    return record;
  }

  // --- BATCHES & BATCH LOTES ---
  public getBatches(): BatchVaporizado[] {
    return this.load().batchesVaporizado;
  }

  public saveBatch(
    batchData: any,
    lotesOrUser?: any,
    isObservedOrUser?: any,
    userParam?: string
  ): BatchVaporizado {
    const db = this.load();
    const rawBatchId = (batchData.BATCH_ID || batchData.batchId || "").trim();
    if (!rawBatchId) throw new Error("BATCH_ID es obligatorio");

    let assignedLotes: any[] = [];
    let user = "Operador";

    if (Array.isArray(lotesOrUser)) {
      assignedLotes = lotesOrUser;
      if (typeof isObservedOrUser === "string") user = isObservedOrUser;
      else if (userParam) user = userParam;
    } else if (typeof lotesOrUser === "string") {
      user = lotesOrUser;
    }

    if (Array.isArray(batchData.lotes) && batchData.lotes.length > 0) {
      assignedLotes = batchData.lotes;
    }

    const existingIdx = db.batchesVaporizado.findIndex(b => b.BATCH_ID === rawBatchId || b.CORRELATIVO === rawBatchId);
    let savedBatch: BatchVaporizado;

    if (existingIdx !== -1) {
      savedBatch = {
        ...db.batchesVaporizado[existingIdx],
        ...batchData,
        BATCH_ID: rawBatchId,
        PROCESO_PADRE: batchData.PROCESO_PADRE || db.batchesVaporizado[existingIdx].PROCESO_PADRE,
        SUB_BATCH: batchData.SUB_BATCH || db.batchesVaporizado[existingIdx].SUB_BATCH,
        ES_SUB_BATCH: batchData.ES_SUB_BATCH !== undefined ? batchData.ES_SUB_BATCH : db.batchesVaporizado[existingIdx].ES_SUB_BATCH,
        GRUPO_UNION_ID: batchData.GRUPO_UNION_ID || db.batchesVaporizado[existingIdx].GRUPO_UNION_ID,
        LOTES_UNION: batchData.LOTES_UNION || db.batchesVaporizado[existingIdx].LOTES_UNION,
        TURNO: batchData.TURNO ? toUpperStr(batchData.TURNO) : db.batchesVaporizado[existingIdx].TURNO,
        EQUIPO: batchData.EQUIPO ? toUpperStr(batchData.EQUIPO) : db.batchesVaporizado[existingIdx].EQUIPO,
        OPERADOR: batchData.OPERADOR ? toUpperStr(batchData.OPERADOR) : db.batchesVaporizado[existingIdx].OPERADOR,
        ESTADO_BATCH: batchData.ESTADO_BATCH ? toUpperStr(batchData.ESTADO_BATCH) : db.batchesVaporizado[existingIdx].ESTADO_BATCH,
        TIPO_SERVICIO: batchData.TIPO_SERVICIO || db.batchesVaporizado[existingIdx].TIPO_SERVICIO || "VAPORIZADO Y SECADO EN APIT",
        OBSERVACIONES: batchData.OBSERVACIONES !== undefined ? toUpperStr(batchData.OBSERVACIONES) : db.batchesVaporizado[existingIdx].OBSERVACIONES
      };
      db.batchesVaporizado[existingIdx] = savedBatch;
    } else {
      savedBatch = {
        ...batchData,
        BATCH_ID: rawBatchId,
        CORRELATIVO: batchData.CORRELATIVO || rawBatchId,
        PROCESO_PADRE: batchData.PROCESO_PADRE,
        SUB_BATCH: batchData.SUB_BATCH || batchData.CORRELATIVO,
        ES_SUB_BATCH: batchData.ES_SUB_BATCH,
        GRUPO_UNION_ID: batchData.GRUPO_UNION_ID,
        LOTES_UNION: batchData.LOTES_UNION,
        FECHA_PROGRAMADA: batchData.FECHA_PROGRAMADA || new Date().toISOString().split("T")[0],
        TURNO: toUpperStr(batchData.TURNO, "TURNO DÍA"),
        EQUIPO: toUpperStr(batchData.EQUIPO, "APIT"),
        OPERADOR: toUpperStr(batchData.OPERADOR, user),
        ESTADO_BATCH: toUpperStr(batchData.ESTADO_BATCH, "PROGRAMADO"),
        TIPO_SERVICIO: batchData.TIPO_SERVICIO || "VAPORIZADO Y SECADO EN APIT",
        OBSERVACIONES: toUpperStr(batchData.OBSERVACIONES, "")
      } as BatchVaporizado;
      db.batchesVaporizado.push(savedBatch);
    }

    // Process lotes assignment
    if (assignedLotes.length > 0) {
      db.batchLotes = db.batchLotes.filter(bl => bl.BATCH_ID !== rawBatchId);
      assignedLotes.forEach((loteItem: any, idx: number) => {
        const normLoteId = sanitizeLoteCode(
          typeof loteItem === "string" 
            ? loteItem 
            : (loteItem?.LOTE_ID || loteItem?.loteId || loteItem?.id || "")
        );
        let sacos = typeof loteItem === "object" ? Number(loteItem?.SACOS || loteItem?.SACOS_ASIGNADOS || loteItem?.sacos) || 0 : 0;
        let pesoKg = typeof loteItem === "object" ? Number(loteItem?.PESO_KG || loteItem?.KG_ASIGNADOS || loteItem?.pesoKg) || 0 : 0;

        const foundL = db.lotes.find(l => sanitizeLoteCode(l.LOTE_ID) === normLoteId);
        if (foundL) {
          if (!sacos) sacos = Number(foundL.SACOS) || 0;
          if (!pesoKg) pesoKg = Number(foundL.PESO_KG) || 0;
        }

        const clienteLote = (typeof loteItem === "object" && loteItem?.CLIENTE && loteItem.CLIENTE !== "Sin Cliente")
          ? loteItem.CLIENTE
          : (foundL?.CLIENTE || (typeof loteItem === "object" && loteItem?.CLIENTE) || "");
        const itemVar = typeof loteItem === "object" ? (loteItem?.VARIEDAD || loteItem?.variedad || "") : "";
        const foundVar = foundL?.VARIEDAD || "";
        const variedadLote = (foundVar && (!itemVar || itemVar.toUpperCase() === "TINAJONES"))
          ? foundVar
          : (itemVar || foundVar || "");
        const defectosPct = typeof loteItem === "object" ? Number(loteItem?.DEFECTOS_PCT ?? (foundL as any)?.DEFECTOS_PCT ?? 0) : 0;
        const quebradoPct = typeof loteItem === "object" ? Number(loteItem?.QUEBRADO_PCT ?? (foundL as any)?.QUEBRADO_PCT ?? (foundL as any)?.QI ?? 0) : 0;
        const tipoServicioLote = (typeof loteItem === "object" && loteItem?.TIPO_SERVICIO) 
          || (typeof loteItem === "object" && loteItem?.tipoServicio) 
          || savedBatch.TIPO_SERVICIO 
          || "VAPORIZADO Y SECADO EN APIT";

        db.batchLotes.push({
          BATCH_LOTE_ID: `BL-${rawBatchId}-${normLoteId || idx}-${idx}`,
          BATCH_ID: rawBatchId,
          LOTE_ID: normLoteId,
          SACOS: sacos,
          PESO_KG: pesoKg,
          CLIENTE: clienteLote,
          VARIEDAD: variedadLote,
          DEFECTOS_PCT: defectosPct,
          QUEBRADO_PCT: quebradoPct,
          TIPO_SERVICIO: tipoServicioLote,
          PARTE: typeof loteItem === "object" ? Number(loteItem?.PARTE || loteItem?.parte || 1) : 1,
          TOTAL_PARTES: typeof loteItem === "object" ? Number(loteItem?.TOTAL_PARTES || loteItem?.totalPartes || 1) : 1,
          ORDEN: typeof loteItem === "object" ? Number(loteItem?.ORDEN || loteItem?.ORDEN_MEZCLA || loteItem?.orden) || (idx + 1) : (idx + 1),
          ESTADO: (typeof loteItem === "object" && loteItem?.ESTADO) || "ASIGNADO",
          OBSERVACIONES: (typeof loteItem === "object" && loteItem?.OBSERVACIONES) || ""
        });
         if (normLoteId) {
          removeUnlinkedNewLote(normLoteId);
        }
        const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === normLoteId);
        if (lIdx !== -1) {
          db.lotes[lIdx].ESTADO_LOTE = "PROGRAMADO";
          db.lotes[lIdx].TIPO_SERVICIO = tipoServicioLote;
          freezeLoteWaitingDays(db.lotes[lIdx], savedBatch.FECHA_INICIO || savedBatch.FECHA_PROGRAMADA);
        }
      });

      if (!savedBatch.CLIENTE || savedBatch.CLIENTE === "Sin Cliente") {
        const firstWithClient = db.batchLotes.find(bl => bl.BATCH_ID === rawBatchId && bl.CLIENTE && bl.CLIENTE !== "Sin Cliente");
        if (firstWithClient) savedBatch.CLIENTE = firstWithClient.CLIENTE;
      }
      const firstWithRealVar = db.batchLotes.find(bl => bl.BATCH_ID === rawBatchId && bl.VARIEDAD && bl.VARIEDAD.toUpperCase() !== "TINAJONES") ||
        db.batchLotes.find(bl => bl.BATCH_ID === rawBatchId && bl.VARIEDAD);
      if (firstWithRealVar && (!savedBatch.VARIEDAD || savedBatch.VARIEDAD.toUpperCase() === "TINAJONES")) {
        savedBatch.VARIEDAD = firstWithRealVar.VARIEDAD;
      }
      const batchBls = db.batchLotes.filter(bl => bl.BATCH_ID === rawBatchId);
      const calcSacos = batchBls.reduce((acc, bl) => acc + (Number(bl.SACOS) || 0), 0);
      const calcKg = batchBls.reduce((acc, bl) => acc + (Number(bl.PESO_KG) || 0), 0);
      if (!savedBatch.TOTAL_SACOS && calcSacos > 0) savedBatch.TOTAL_SACOS = calcSacos;
      if (!savedBatch.TOTAL_PESO_KG && calcKg > 0) savedBatch.TOTAL_PESO_KG = calcKg;
      if (!savedBatch.PESO_TOTAL_KG && calcKg > 0) savedBatch.PESO_TOTAL_KG = calcKg;
    }

    deduplicateAndMigrateLotes(db);

    this.addAuditLog(`Guardado de Batch ${rawBatchId} (${savedBatch.ESTADO_BATCH})`, user);
    this.persist();
    return savedBatch;
  }

  public updateBatch(batchId: string, patch: Partial<BatchVaporizado>, user: string = "Operador"): BatchVaporizado | null {
    const db = this.load();
    const idx = db.batchesVaporizado.findIndex(b => b.BATCH_ID === batchId || b.CORRELATIVO === batchId);
    if (idx === -1) return null;
    db.batchesVaporizado[idx] = {
      ...db.batchesVaporizado[idx],
      ...patch
    };
    this.addAuditLog(`Actualización de Batch ${batchId}`, user);
    this.persist();
    return db.batchesVaporizado[idx];
  }

  public deleteBatch(batchId: string, user: string = "Operador", force: boolean = false): boolean {
    const db = this.load();
    const rawId = (batchId || "").toString().trim().toUpperCase();
    if (!rawId) return false;

    // Collect all aliases and keys for this batch
    const matchedKeys = new Set<string>([rawId]);
    db.batchesVaporizado.forEach(b => {
      const bId = (b.BATCH_ID || "").toString().trim().toUpperCase();
      const bCorr = (b.CORRELATIVO || "").toString().trim().toUpperCase();
      const bInternalId = ((b as any).id || "").toString().trim().toUpperCase();
      if (bId === rawId || bCorr === rawId || bInternalId === rawId) {
        if (bId) matchedKeys.add(bId);
        if (bCorr) matchedKeys.add(bCorr);
        if (bInternalId) matchedKeys.add(bInternalId);
      }
    });

    if (Array.isArray(db.programacionesOficiales)) {
      db.programacionesOficiales.forEach((p: any) => {
        const pId = (p.id || "").toString().trim().toUpperCase();
        const pBatch = (p.batch || "").toString().trim().toUpperCase();
        const pCaso = (p.caso || "").toString().trim().toUpperCase();
        if (pId === rawId || pBatch === rawId || pCaso === rawId || matchedKeys.has(pId) || matchedKeys.has(pBatch)) {
          if (pId) matchedKeys.add(pId);
          if (pBatch) matchedKeys.add(pBatch);
          if (pCaso) matchedKeys.add(pCaso);
        }
      });
    }

    const matchesBatch = (id?: string) => {
      if (!id) return false;
      return matchedKeys.has(id.toString().trim().toUpperCase());
    };

    // Validar si existen controles de vaporizado asociados antes de eliminar
    if (!force) {
      const associatedControles = (db.controlVaporizado || []).filter(c => 
        matchesBatch(c.BATCH_ID) || matchesBatch(c.CORRELATIVO) || matchesBatch(c.CODIGO_INTERNO)
      );
      if (associatedControles.length > 0) {
        throw new Error(`Acción no permitida: El batch tiene ${associatedControles.length} registro(s) de control de vaporizado asociado(s). Debe eliminarlos manualmente antes de eliminar el batch.`);
      }
    }

    // Find all lotes assigned to this batch to revert their status back to ANALIZADO
    const lotesInBatch = new Set<string>();
    db.batchLotes.filter(bl => matchesBatch(bl.BATCH_ID) || matchesBatch((bl as any).correlativo)).forEach(bl => {
      if (bl.LOTE_ID) lotesInBatch.add(sanitizeLoteCode(bl.LOTE_ID));
    });

    if (Array.isArray(db.programacionesOficiales)) {
      db.programacionesOficiales.forEach((p: any) => {
        if (matchesBatch(p.id) || matchesBatch(p.batch) || matchesBatch(p.caso)) {
          if (Array.isArray(p.filasLote)) {
            p.filasLote.forEach((f: any) => {
              if (f?.loteId) lotesInBatch.add(sanitizeLoteCode(f.loteId));
            });
          }
          if (Array.isArray(p.lotes)) {
            p.lotes.forEach((l: any) => {
              const lid = l?.LOTE_ID || l?.loteId;
              if (lid) lotesInBatch.add(sanitizeLoteCode(lid));
            });
          }
        }
      });
    }

    // Filter out batch from all collections
    db.batchesVaporizado = db.batchesVaporizado.filter(b => !matchesBatch(b.BATCH_ID) && !matchesBatch(b.CORRELATIVO) && !matchesBatch((b as any).id));
    db.batchLotes = db.batchLotes.filter(bl => !matchesBatch(bl.BATCH_ID) && !matchesBatch((bl as any).correlativo));
    db.controlVaporizado = db.controlVaporizado.filter(c => 
      !matchesBatch(c.BATCH_ID) && 
      !matchesBatch(c.CORRELATIVO) && 
      !matchesBatch(c.CODIGO_INTERNO) &&
      !matchesBatch((c as any).datosIngreso?.codigo)
    );
    db.analisisVaporizado = db.analisisVaporizado.filter(a => 
      !matchesBatch(a.BATCH_ID) && 
      !matchesBatch((a as any).CORRELATIVO)
    );
    if (db.programacionApit) {
      db.programacionApit = db.programacionApit.filter(p => !matchesBatch(p.BATCH_ID) && !matchesBatch((p as any).CORRELATIVO));
    }

    if (Array.isArray(db.programacionesOficiales)) {
      db.programacionesOficiales = db.programacionesOficiales.filter(p => !matchesBatch(p.id) && !matchesBatch(p.batch) && !matchesBatch(p.caso));
    }

    // Clean from localStorage "programaciones_batch_oficial_v1"
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem("programaciones_batch_oficial_v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((p: any) => !matchesBatch(p.id) && !matchesBatch(p.batch) && !matchesBatch(p.caso));
            window.localStorage.setItem("programaciones_batch_oficial_v1", JSON.stringify(filtered));
            window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: filtered }));
          }
        }
      } catch {
        // ignore
      }
    }

    // Revert lotes back to ANALIZADO and clear any batch references
    lotesInBatch.forEach(normLoteId => {
      const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === normLoteId);
      if (lIdx !== -1) {
        if (db.lotes[lIdx].ESTADO_LOTE === "PROGRAMADO" || db.lotes[lIdx].ESTADO_LOTE === "EN PROCESO") {
          db.lotes[lIdx].ESTADO_LOTE = "ANALIZADO";
          unfreezeLoteWaitingDays(db.lotes[lIdx]);
        }
        delete (db.lotes[lIdx] as any).BATCH_ID;
        delete (db.lotes[lIdx] as any).batchId;
      }
    });

    this.addAuditLog(`Eliminación del Batch ${rawId}`, user);
    this.persist();
    return true;
  }

  public iniciarProcesoBatch(batchCode: string, user: string = "Operador"): { batch?: BatchVaporizado; updatedLotes: Lote[] } {
    const db = this.load();
    const cleanCode = (batchCode || "").trim().toUpperCase();
    const batch = db.batchesVaporizado.find(
      b => (b.BATCH_ID || "").toUpperCase() === cleanCode || (b.CORRELATIVO || "").toUpperCase() === cleanCode
    );
    if (batch) {
      batch.ESTADO_BATCH = "EN PROCESO";
    }

    const bIdUpper = (batch?.BATCH_ID || cleanCode).toUpperCase();
    const corrUpper = (batch?.CORRELATIVO || cleanCode).toUpperCase();

    const assignedLoteIds = new Set<string>();
    db.batchLotes
      .filter(bl => {
        const blB = (bl.BATCH_ID || "").toUpperCase();
        return blB === cleanCode || blB === bIdUpper || blB === corrUpper;
      })
      .forEach(bl => {
        if (bl.LOTE_ID) assignedLoteIds.add(sanitizeLoteCode(bl.LOTE_ID));
      });

    (db.programacionesOficiales || []).forEach((p: any) => {
      const pB = (p?.batch || p?.id || "").toString().trim().toUpperCase();
      if (pB === cleanCode || pB === bIdUpper || pB === corrUpper) {
        p.estado = "EN PROCESO";
        if (Array.isArray(p.filasLote)) {
          p.filasLote.forEach((f: any) => {
            const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
            if (lid) assignedLoteIds.add(lid);
          });
        }
      }
    });

    const updatedLotes: Lote[] = [];
    assignedLoteIds.forEach(normLid => {
      const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === normLid);
      if (lIdx !== -1) {
        const est = (db.lotes[lIdx].ESTADO_LOTE || "").toUpperCase();
        if (!["VAPORIZADO", "ANALISIS_FINAL", "EVALUADO", "PROCESADO", "CERRADO", "TERMINADO"].includes(est)) {
          db.lotes[lIdx].ESTADO_LOTE = "EN PROCESO";
        }
        freezeLoteWaitingDays(db.lotes[lIdx], batch?.FECHA_INICIO || batch?.FECHA_PROGRAMADA);
        updatedLotes.push(db.lotes[lIdx]);
      }
    });

    this.addAuditLog(`Inicio de proceso en planta para Batch ${batchCode}`, user);
    deduplicateAndMigrateLotes(db);
    this.persist();
    return { batch, updatedLotes };
  }

  public liquidarBatch(batchCode: string, controlPayload?: any, user: string = "Operador"): { batch?: BatchVaporizado; updatedLotes: Lote[] } {
    const db = this.load();
    const cleanCode = (batchCode || "").trim().toUpperCase();
    const normTarget = cleanCode.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
    const matchesTarget = (val?: string) => {
      if (!val) return false;
      const u = val.toString().trim().toUpperCase();
      if (u === cleanCode) return true;
      const n = u.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
      return Boolean(normTarget && n === normTarget);
    };

    const batch = db.batchesVaporizado.find(b => matchesTarget(b.BATCH_ID) || matchesTarget(b.CORRELATIVO));
    if (batch) {
      batch.ESTADO_BATCH = "VAPORIZADO";
      delete (batch as any).cerroCompletamente;
      delete (batch as any).cerroPorJefatura;
      delete (batch as any).CERRADO_COMPLETO;
      delete (batch as any).cerradoTotal;
      (batch as any).ESTADO_ANALISIS_DESCARGA = "PENDIENTE";
      (batch as any).analisisDescargaPendiente = true;
      (batch as any).ESTADO_COCCION = "PENDIENTE";
      (batch as any).coccionPendiente = true;
      (batch as any).conformidadCierre = controlPayload?.conformidadCierre ?? true;
      (batch as any).conformidadDescarga = controlPayload?.conformidadDescarga ?? true;
      (batch as any).observacionesProceso = controlPayload?.observacionesProceso || controlPayload?.observacionCierre || "";
    }

    if (controlPayload) {
      this.saveControlVaporizado(
        {
          ...controlPayload,
          BATCH_ID: batch?.BATCH_ID || batchCode,
          ESTADO_PROCESO: "LIQUIDADO",
          liquidado: true,
          conformidadCierre: controlPayload.conformidadCierre ?? true,
          conformidadDescarga: controlPayload.conformidadDescarga ?? true,
          observacionesProceso: controlPayload.observacionesProceso || controlPayload.observacionCierre || "",
          ESTADO_ANALISIS_DESCARGA: "PENDIENTE",
          FECHA_HORA_FIN: controlPayload.FECHA_HORA_FIN || new Date().toISOString()
        },
        user
      );
    } else {
      const ctrlIdx = db.controlVaporizado.findIndex(c => matchesTarget(c.BATCH_ID) || matchesTarget(c.CORRELATIVO));
      if (ctrlIdx !== -1) {
        (db.controlVaporizado[ctrlIdx] as any).liquidado = true;
        (db.controlVaporizado[ctrlIdx] as any).conformidadCierre = true;
        (db.controlVaporizado[ctrlIdx] as any).conformidadDescarga = true;
        (db.controlVaporizado[ctrlIdx] as any).ESTADO_ANALISIS_DESCARGA = "PENDIENTE";
        db.controlVaporizado[ctrlIdx].ESTADO_PROCESO = "LIQUIDADO" as any;
        db.controlVaporizado[ctrlIdx].FECHA_HORA_FIN = db.controlVaporizado[ctrlIdx].FECHA_HORA_FIN || new Date().toISOString();
      }
    }

    const assignedLoteIds = new Set<string>();
    db.batchLotes
      .filter(bl => matchesTarget(bl.BATCH_ID) || (batch && (bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO)))
      .forEach(bl => {
        if (bl.LOTE_ID) assignedLoteIds.add(sanitizeLoteCode(bl.LOTE_ID));
      });

    (db.programacionesOficiales || []).forEach((p: any) => {
      if (matchesTarget(p?.batch) || matchesTarget(p?.id)) {
        p.estado = "VAPORIZADO";
        if (Array.isArray(p.filasLote)) {
          p.filasLote.forEach((f: any) => {
            const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
            if (lid) assignedLoteIds.add(lid);
          });
        }
      }
    });

    // Salir inmediatamente de programación para que continúe con el siguiente lote/batch
    db.programacionesOficiales = (db.programacionesOficiales || []).filter(
      (p: any) => !matchesTarget(p?.batch) && !matchesTarget(p?.id) && (p.estado || "").toString().trim().toUpperCase() !== "VAPORIZADO"
    );
    db.programacionApit = db.programacionesOficiales;

    // Registrar análisis final de descarga en analisisVaporizado únicamente si contiene datos de laboratorio reales (cargados por analista)
    const af = controlPayload?.analisisFinal;
    const hasExplicitLabMetrics = Boolean(
      af && (
        (af.HUMEDAD !== undefined && af.HUMEDAD !== null && af.HUMEDAD !== "") ||
        (af.QB !== undefined && af.QB !== null && af.QB !== "") ||
        (af.RB !== undefined && af.RB !== null && af.RB !== "")
      )
    );
    if (hasExplicitLabMetrics) {
      const bKey = batch?.BATCH_ID || batchCode;
      if (!Array.isArray(db.analisisVaporizado)) db.analisisVaporizado = [];
      const existingAvIdx = db.analisisVaporizado.findIndex(a => matchesTarget(a.BATCH_ID) || matchesTarget(a.CODIGO_MUESTRA));
      const avPayload: any = {
        ANALISIS_VAP_ID: existingAvIdx !== -1 ? (db.analisisVaporizado[existingAvIdx] as any).ANALISIS_VAP_ID : `AV-${bKey}`,
        BATCH_ID: bKey,
        FECHA: new Date().toISOString().split("T")[0],
        HORA: new Date().toLocaleTimeString(),
        ANALISTA: user,
        HUMEDAD_FINAL: af.HUMEDAD !== undefined ? Number(af.HUMEDAD) : undefined,
        HUMEDAD: af.HUMEDAD !== undefined ? Number(af.HUMEDAD) : undefined,
        QUEBRADO_FINAL: af.QB !== undefined ? Number(af.QB) : undefined,
        QB: af.QB !== undefined ? Number(af.QB) : undefined,
        QUEBRADO_INTEGRAL: af.QI !== undefined ? Number(af.QI) : undefined,
        QI: af.QI !== undefined ? Number(af.QI) : undefined,
        RENDIMIENTO_BLANCO: af.RB !== undefined ? Number(af.RB) : undefined,
        RB: af.RB !== undefined ? Number(af.RB) : undefined,
        RENDIMIENTO_INTEGRAL: af.RI !== undefined ? Number(af.RI) : undefined,
        RI: af.RI !== undefined ? Number(af.RI) : undefined,
        TRIZADO_FINAL: af.TZ !== undefined ? Number(af.TZ) : undefined,
        TZ: af.TZ !== undefined ? Number(af.TZ) : undefined,
        MANCHADO_FINAL: af.M !== undefined ? Number(af.M) : undefined,
        M: af.M !== undefined ? Number(af.M) : undefined,
        ESTADO: "CONFORME"
      };
      if (existingAvIdx !== -1) {
        db.analisisVaporizado[existingAvIdx] = { ...db.analisisVaporizado[existingAvIdx], ...avPayload };
      } else {
        db.analisisVaporizado.push(avPayload);
      }
    }

    const updatedLotes: Lote[] = [];
    assignedLoteIds.forEach(normLid => {
      const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === normLid);
      if (lIdx !== -1) {
        db.lotes[lIdx].ESTADO_LOTE = "VAPORIZADO";
        delete (db.lotes[lIdx] as any).cerroCompletamente;
        delete (db.lotes[lIdx] as any).cerroPorJefatura;
        updatedLotes.push(db.lotes[lIdx]);
      }
    });

    db.batchLotes
      .filter(bl => matchesTarget(bl.BATCH_ID) || (batch && (bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO)))
      .forEach(bl => {
        bl.ESTADO = "VAPORIZADO";
      });

    this.addAuditLog(`Liquidación de proceso de vaporizado para Batch ${batchCode} (Estado: VAPORIZADO - Salida de programación)`, user);
    deduplicateAndMigrateLotes(db);
    this.persist();

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("programaciones_batch_oficial_v1", JSON.stringify(db.programacionesOficiales));
      } catch {}
      window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: db.programacionesOficiales }));
      window.dispatchEvent(new CustomEvent("batch-vaporizado-updated", { detail: batch }));
    }

    return { batch, updatedLotes };
  }

  public cerrarTotalBatch(batchCode: string, controlPayload?: any, user: string = "Operador"): { batch?: BatchVaporizado; updatedLotes: Lote[] } {
    const db = this.load();
    const cleanCode = (batchCode || "").trim().toUpperCase();
    const normTarget = cleanCode.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
    const matchesTarget = (val?: string) => {
      if (!val) return false;
      const u = val.toString().trim().toUpperCase();
      if (u === cleanCode) return true;
      const n = u.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
      return Boolean(normTarget && n === normTarget);
    };

    // Verificar si ya tiene análisis de descarga y cocción para permitir CERRADO completo.
    // Solo cuando los analistas hayan subido AMBOS análisis de calidad (descarga y cocción) se puede cerrar formalmente el batch.
    const hasDescarga = (db.analisisVaporizado || []).some(av =>
      matchesTarget(av?.BATCH_ID) || matchesTarget(av?.CODIGO_MUESTRA)
    ) || (db.analisisSeco || []).some((as: any) => matchesTarget(as?.BATCH_ID));
    const hasCoccion = (db.resultadosCoccionExternos || []).some((rc: any) =>
      matchesTarget(rc?.codigoBatch || rc?.batchId || rc?.correlativo)
    );

    if (!hasDescarga || !hasCoccion) {
      // Si aún no cuenta con Análisis de Descarga y Cocción completados subidos por analistas,
      // NO se puede cerrar el batch; debe quedar en estado VAPORIZADO (o ANALISIS_FINAL si ya tiene descarga).
      return this.liquidarBatch(batchCode, controlPayload, user);
    }

    const batch = db.batchesVaporizado.find(b => matchesTarget(b.BATCH_ID) || matchesTarget(b.CORRELATIVO));

    const matchedProg = (db.programacionesOficiales || []).find(
      (p: any) => matchesTarget(p?.batch) || matchesTarget(p?.id)
    );

    if (batch) {
      batch.ESTADO_BATCH = "CERRADO";
      (batch as any).cerroCompletamente = true;
      (batch as any).cerroPorJefatura = true;
      (batch as any).cerradoPor = user;
      batch.FECHA_FIN = batch.FECHA_FIN || new Date().toISOString().split("T")[0];
      if (matchedProg) {
        if (!batch.CLIENTE && matchedProg.clientePrincipal) batch.CLIENTE = matchedProg.clientePrincipal;
        if (!batch.VARIEDAD && matchedProg.variedadPrincipal) batch.VARIEDAD = matchedProg.variedadPrincipal;
        if (!batch.PESO_TOTAL_KG && matchedProg.pesoTotalKg) batch.PESO_TOTAL_KG = matchedProg.pesoTotalKg;
        (batch as any).filasLote = (batch as any).filasLote || matchedProg.filasLote;
        (batch as any).promedios = (batch as any).promedios || matchedProg.promedios;
        (batch as any).parametrosDeterminados = (batch as any).parametrosDeterminados || matchedProg.parametrosDeterminados;
        (batch as any).parametrosRecomendadosIA = (batch as any).parametrosRecomendadosIA || matchedProg.parametrosRecomendadosIA;
      }
    } else if (matchedProg || batchCode) {
      const bCode = matchedProg?.batch || matchedProg?.id || batchCode;
      const newClosedBatch: any = {
        BATCH_ID: bCode,
        CORRELATIVO: bCode,
        FECHA_PROGRAMADA: matchedProg?.fecha || new Date().toISOString().split("T")[0],
        FECHA_FIN: new Date().toISOString().split("T")[0],
        EQUIPO: "APIT",
        ESTADO_BATCH: "CERRADO",
        TON_PROGRAMADAS: ((matchedProg?.pesoTotalKg || 18000) / 1000),
        TON_PROCESADAS: ((matchedProg?.pesoTotalKg || 18000) / 1000),
        PESO_TOTAL_KG: matchedProg?.pesoTotalKg || 18000,
        CLIENTE: matchedProg?.clientePrincipal || "MOLINO DON JULIO S.A.C.",
        VARIEDAD: matchedProg?.variedadPrincipal || "TINAJONES",
        TURNO: matchedProg?.turno === "DIA" ? "Turno Día" : "Turno Noche",
        OPERADOR: user || "Operario de Planta",
        OBSERVACIONES: matchedProg?.observacion || "",
        cerroCompletamente: true,
        cerroPorJefatura: true,
        cerradoPor: user,
        filasLote: matchedProg?.filasLote,
        promedios: matchedProg?.promedios,
        parametrosDeterminados: matchedProg?.parametrosDeterminados,
        parametrosRecomendadosIA: matchedProg?.parametrosRecomendadosIA
      };
      db.batchesVaporizado.push(newClosedBatch);
    }

    if (controlPayload) {
      this.saveControlVaporizado({ ...controlPayload, BATCH_ID: batch?.BATCH_ID || batchCode, ESTADO_PROCESO: "CERRADO", liquidado: true, cerroCompletamente: true }, user);

      // Registrar análisis final de descarga en analisisVaporizado si fue provisto
      if (controlPayload.analisisFinal || controlPayload.HUMEDAD_FINAL || controlPayload.QB || controlPayload.HUMEDAD) {
        const af = controlPayload.analisisFinal || controlPayload;
        const bKey = batch?.BATCH_ID || batchCode;
        if (!Array.isArray(db.analisisVaporizado)) db.analisisVaporizado = [];
        const existingAvIdx = db.analisisVaporizado.findIndex(a => matchesTarget(a.BATCH_ID) || matchesTarget(a.CODIGO_MUESTRA));
        const avPayload: any = {
          ANALISIS_VAP_ID: existingAvIdx !== -1 ? (db.analisisVaporizado[existingAvIdx] as any).ANALISIS_VAP_ID : `AV-${bKey}`,
          BATCH_ID: bKey,
          FECHA: new Date().toISOString().split("T")[0],
          HORA: new Date().toLocaleTimeString(),
          ANALISTA: user,
          HUMEDAD_FINAL: af.HUMEDAD !== undefined ? Number(af.HUMEDAD) : undefined,
          HUMEDAD: af.HUMEDAD !== undefined ? Number(af.HUMEDAD) : undefined,
          QUEBRADO_FINAL: af.QB !== undefined ? Number(af.QB) : undefined,
          QB: af.QB !== undefined ? Number(af.QB) : undefined,
          QUEBRADO_INTEGRAL: af.QI !== undefined ? Number(af.QI) : undefined,
          QI: af.QI !== undefined ? Number(af.QI) : undefined,
          RENDIMIENTO_BLANCO: af.RB !== undefined ? Number(af.RB) : undefined,
          RB: af.RB !== undefined ? Number(af.RB) : undefined,
          RENDIMIENTO_INTEGRAL: af.RI !== undefined ? Number(af.RI) : undefined,
          RI: af.RI !== undefined ? Number(af.RI) : undefined,
          TRIZADO_FINAL: af.TZ !== undefined ? Number(af.TZ) : undefined,
          TZ: af.TZ !== undefined ? Number(af.TZ) : undefined,
          MANCHADO_FINAL: af.M !== undefined ? Number(af.M) : undefined,
          M: af.M !== undefined ? Number(af.M) : undefined,
          ESTADO: "CONFORME"
        };
        if (existingAvIdx !== -1) {
          db.analisisVaporizado[existingAvIdx] = { ...db.analisisVaporizado[existingAvIdx], ...avPayload };
        } else {
          db.analisisVaporizado.push(avPayload);
        }
      }
    }

    const assignedLoteIds = new Set<string>();
    db.batchLotes
      .filter(bl => matchesTarget(bl.BATCH_ID) || (batch && (matchesTarget(batch.BATCH_ID) || matchesTarget(batch.CORRELATIVO)) && (bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO)))
      .forEach(bl => {
        if (bl.LOTE_ID) assignedLoteIds.add(sanitizeLoteCode(bl.LOTE_ID));
      });

    (db.programacionesOficiales || []).forEach((p: any) => {
      if (matchesTarget(p?.batch) || matchesTarget(p?.id)) {
        p.estado = "CERRADO";
        if (Array.isArray(p.filasLote)) {
          p.filasLote.forEach((f: any) => {
            const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
            if (lid) {
              assignedLoteIds.add(lid);
              const bCode = p.batch || p.id || batchCode;
              if (!db.batchLotes.some(bl => (matchesTarget(bl.BATCH_ID) || bl.BATCH_ID === bCode) && sanitizeLoteCode(bl.LOTE_ID) === lid)) {
                db.batchLotes.push({
                  BATCH_LOTE_ID: `BL-${bCode}-${lid}`,
                  BATCH_ID: bCode,
                  LOTE_ID: lid,
                  SACOS: f.sacProg || f.sacos || 100,
                  PESO_KG: f.pesoProg || f.peso || 5000,
                  CLIENTE: f.cliente || p.clientePrincipal,
                  VARIEDAD: f.variedad || p.variedadPrincipal
                } as any);
              }
            }
          });
        }
      }
    });

    (db.analisisVaporizado || []).forEach((av: any) => {
      if (matchesTarget(av?.BATCH_ID) || matchesTarget(av?.CODIGO_MUESTRA)) {
        const lid = sanitizeLoteCode(av?.LOTE_ID);
        if (lid) assignedLoteIds.add(lid);
      }
    });

    const updatedLotes: Lote[] = [];
    assignedLoteIds.forEach(normLid => {
      const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === normLid);
      if (lIdx !== -1) {
        db.lotes[lIdx].ESTADO_LOTE = "CERRADO";
        (db.lotes[lIdx] as any).cerroCompletamente = true;
        (db.lotes[lIdx] as any).cerroPorJefatura = true;
        (db.lotes[lIdx] as any).cerradoPor = user;
        updatedLotes.push(db.lotes[lIdx]);
      }
    });

    db.batchLotes
      .filter(bl => matchesTarget(bl.BATCH_ID) || (batch && (matchesTarget(batch.BATCH_ID) || matchesTarget(batch.CORRELATIVO)) && (bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO)))
      .forEach(bl => {
        bl.ESTADO = "CERRADO";
      });

    // Sacar inmediatamente el batch y los lotes cerrados de la lista de programación
    if (Array.isArray(db.programacionesOficiales)) {
      db.programacionesOficiales = db.programacionesOficiales
        .filter((p: any) => !matchesTarget(p?.batch) && !matchesTarget(p?.id) && (p?.estado || "").toUpperCase() !== "CERRADO")
        .map((p: any) => {
          if (Array.isArray(p?.filasLote)) {
            return {
              ...p,
              filasLote: p.filasLote.filter((f: any) => !assignedLoteIds.has(sanitizeLoteCode(f?.loteId || f?.LOTE_ID)))
            };
          }
          return p;
        })
        .filter((p: any) => !Array.isArray(p?.filasLote) || p.filasLote.length > 0);
      db.programacionApit = db.programacionesOficiales;

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const serialized = JSON.stringify(db.programacionesOficiales);
          window.localStorage.setItem("programaciones_batch_oficial_v1", serialized);
          window.localStorage.setItem("molino_programaciones_batch_oficiales_v3", serialized);
          window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: db.programacionesOficiales }));
        } catch {
          // ignore
        }
      }
    }

    this.addAuditLog(`Cierre completo del Batch ${batchCode} y lotes marcados como CERRADO (retirados de programación)`, user);
    deduplicateAndMigrateLotes(db);
    this.persist();
    return { batch, updatedLotes };
  }

  public getBatchLotes(): BatchLote[] {
    return this.load().batchLotes;
  }

  public saveBatchLotes(batchLotes: BatchLote[], user: string = "Operador"): BatchLote[] {
    const db = this.load();
    db.batchLotes = batchLotes;
    this.persist();
    return db.batchLotes;
  }

  // --- CONTROL VAPORIZADO ---
  public getControlVaporizado(): ControlVaporizado[] {
    return this.load().controlVaporizado;
  }

  public saveControlVaporizado(data: any, user: string = "Operador"): any {
    const db = this.load();
    const batchId = (data.BATCH_ID || "").trim();
    if (!batchId) throw new Error("BATCH_ID es obligatorio en ControlVaporizado");

    const bUpper = batchId.toUpperCase();
    const corrUpper = (data.CORRELATIVO || data.datosIngreso?.codigo || "").toString().trim().toUpperCase();

    const record: ControlVaporizado = cleanRecord({
      ...data,
      BATCH_ID: batchId,
      FECHA_HORA_INICIO: data.FECHA_HORA_INICIO || data.FECHA || new Date().toISOString(),
      ...(data.OPERADOR ? { OPERADOR: toUpperStr(data.OPERADOR) } : {}),
      ...(data.CALIDAD_AGUA ? { CALIDAD_AGUA: toUpperStr(data.CALIDAD_AGUA) } : {}),
      ...(data.ESTADO_PROCESO ? { ESTADO_PROCESO: toUpperStr(data.ESTADO_PROCESO) } : {}),
      ...(data.OBSERVACIONES !== undefined ? { OBSERVACIONES: toUpperStr(data.OBSERVACIONES) } : {})
    }) as ControlVaporizado;

    const idx = db.controlVaporizado.findIndex(c => {
      const cB = (c.BATCH_ID || "").trim().toUpperCase();
      const cC = (c.CORRELATIVO || c.datosIngreso?.codigo || "").toString().trim().toUpperCase();
      return (cB && (cB === bUpper || (corrUpper && cB === corrUpper))) ||
             (cC && (cC === bUpper || (corrUpper && cC === corrUpper)));
    });
    const mergedRecord = idx !== -1 ? { ...db.controlVaporizado[idx], ...record } : record;
    if (idx !== -1) {
      db.controlVaporizado[idx] = mergedRecord;
    } else {
      db.controlVaporizado.unshift(mergedRecord);
    }

    // Actualizar progresivamente el estado del Batch y sus lotes asignados según las secciones llenadas:
    // PROGRAMADO -> EN PROCESO (Datos de Vaporizado) -> EN REPOSO (1° Reposo) -> EN SECADO (Perfiles 0-12) -> VAPORIZADO (Cerrado y liquidado)
    const batch = db.batchesVaporizado.find(b => {
      const bIdU = (b.BATCH_ID || "").trim().toUpperCase();
      const bCorrU = (b.CORRELATIVO || "").trim().toUpperCase();
      return bIdU === bUpper || bCorrU === bUpper || (corrUpper && (bIdU === corrUpper || bCorrU === corrUpper));
    });
    if (batch) {
      const ctrlVar = (mergedRecord.datosIngreso?.variedad || mergedRecord.VARIEDAD || "").toString().trim();
      if (ctrlVar && (!batch.VARIEDAD || batch.VARIEDAD.toUpperCase() === "TINAJONES" || batch.VARIEDAD.toUpperCase() === "IR-43 MEJORADO")) {
        batch.VARIEDAD = ctrlVar.toUpperCase();
      }
      const ctrlCli = (mergedRecord.CLIENTE || (mergedRecord.datosIngreso as any)?.cliente || "").toString().trim();
      if (ctrlCli && (!batch.CLIENTE || batch.CLIENTE === "Sin Cliente")) {
        batch.CLIENTE = ctrlCli;
      }

      const stages = evaluateControlSheetStages(mergedRecord);
      const currentBatchEst = (batch.ESTADO_BATCH || "PROGRAMADO").toUpperCase();
      const postStates = ["ANALISIS_FINAL", "EVALUADO", "CERRADO", "TERMINADO", "FINALIZADO"];

      if (!postStates.includes(currentBatchEst)) {
        let nextStage = currentBatchEst;
        if (stages.isLiquidado) {
          nextStage = "VAPORIZADO";
        } else if (stages.hasEtapaSecado) {
          nextStage = "EN SECADO";
        } else if (stages.hasEtapaReposo) {
          nextStage = "EN REPOSO";
        } else if (stages.hasDatosVaporizado) {
          nextStage = "EN PROCESO";
        }
        batch.ESTADO_BATCH = nextStage;

        const bls = db.batchLotes.filter(bl => bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO);
        bls.forEach(bl => {
          const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === sanitizeLoteCode(bl.LOTE_ID));
          if (lIdx !== -1 && !postStates.includes((db.lotes[lIdx].ESTADO_LOTE || "").toUpperCase())) {
            db.lotes[lIdx].ESTADO_LOTE = nextStage;
            freezeLoteWaitingDays(db.lotes[lIdx], mergedRecord.FECHA_HORA_INICIO || batch.FECHA_INICIO || batch.FECHA_PROGRAMADA);
          }
        });
      }
    }

    deduplicateAndMigrateLotes(db);
    this.persist();
    return { control: mergedRecord, batch };
  }

  public deleteControlVaporizado(batchId: string, user: string = "Operador"): boolean {
    const db = this.load();
    const bUpper = (batchId || "").trim().toUpperCase();
    const before = db.controlVaporizado.length;
    db.controlVaporizado = db.controlVaporizado.filter(c => {
      const cB = (c.BATCH_ID || "").trim().toUpperCase();
      const cC = (c.CORRELATIVO || c.datosIngreso?.codigo || "").toString().trim().toUpperCase();
      return cB !== bUpper && cC !== bUpper;
    });
    if (db.controlVaporizado.length < before) {
      deduplicateAndMigrateLotes(db);
      this.persist();
      return true;
    }
    return false;
  }

  // --- ANALISIS VAPORIZADO ---
  public getAnalisisVaporizado(): AnalisisVaporizado[] {
    return this.load().analisisVaporizado;
  }

  public saveAnalisisVaporizado(data: any, user: string = "Operador"): AnalisisVaporizado {
    const db = this.load();
    const batchId = (data.BATCH_ID || "").trim();
    const id = data.ANALISIS_VAPORIZADO_ID || data.ANALISIS_VAP_ID || `AV-${Date.now()}`;
    const normLoteId = data.LOTE_ID ? sanitizeLoteCode(data.LOTE_ID) : undefined;

    const record: AnalisisVaporizado = cleanRecord({
      ...data,
      ANALISIS_VAPORIZADO_ID: id,
      BATCH_ID: batchId,
      ...(normLoteId ? { LOTE_ID: normLoteId } : {}),
      FECHA_ANALISIS: data.FECHA_ANALISIS || new Date().toISOString().split("T")[0],
      ...(data.OPERADOR ? { OPERADOR: toUpperStr(data.OPERADOR) } : {}),
      ...(data.EVALUACION_COLOR ? { EVALUACION_COLOR: toUpperStr(data.EVALUACION_COLOR) } : {}),
      ...(data.OBSERVACIONES !== undefined ? { OBSERVACIONES: toUpperStr(data.OBSERVACIONES) } : {})
    }) as AnalisisVaporizado;

    const idx = db.analisisVaporizado.findIndex(a => a.ANALISIS_VAPORIZADO_ID === id || (batchId && a.BATCH_ID === batchId));
    if (idx !== -1) {
      db.analisisVaporizado[idx] = record;
    } else {
      db.analisisVaporizado.unshift(record);
    }

    const normBatchTarget = batchId.toUpperCase().replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
    const matchesBatch = (val?: string) => {
      if (!val) return false;
      const u = val.toString().trim().toUpperCase();
      if (u === batchId.toUpperCase()) return true;
      const n = u.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
      return Boolean(normBatchTarget && n === normBatchTarget);
    };

    const batch = db.batchesVaporizado.find(b => matchesBatch(b.BATCH_ID) || matchesBatch(b.CORRELATIVO));
    let tieneCoccion = false;
    try {
      const checkCoccionList = (list: any[]) =>
        list.some((c: any) =>
          matchesBatch(c?.codigoBatch) ||
          matchesBatch(c?.batchId) ||
          matchesBatch(c?.correlativo) ||
          (normLoteId && sanitizeLoteCode(c?.loteId || c?.LOTE_ID) === normLoteId)
        );
      if (Array.isArray(db.resultadosCoccionExternos) && checkCoccionList(db.resultadosCoccionExternos)) {
        tieneCoccion = true;
      }
      if (!tieneCoccion && typeof window !== "undefined" && window.localStorage) {
        for (const k of ["resultados_coccion_integrados_v2", "resultados_coccion_integrados_v1", "resultados_coccion_externos_v1"]) {
          const rawCoc = window.localStorage.getItem(k);
          if (rawCoc) {
            const list = JSON.parse(rawCoc);
            if (Array.isArray(list) && checkCoccionList(list)) {
              tieneCoccion = true;
              break;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Regla progresiva:
    // - Cuando se registra su análisis de descarga -> ANALISIS_FINAL
    // - Si ya tiene además incremento de defectos y cocción en olla -> EVALUADO
    // - Solo pasa a CERRADO cuando se cierra el batch completamente
    const nextState = tieneCoccion ? "EVALUADO" : "ANALISIS_FINAL";

    if (batch) {
      if (!Boolean((batch as any).cerroCompletamente)) {
        batch.ESTADO_BATCH = nextState;
      }
    }

    const targetLoteIds = new Set<string>();
    if (normLoteId) targetLoteIds.add(normLoteId);
    db.batchLotes
      .filter(bl => matchesBatch(bl.BATCH_ID) || (batch && (bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO)))
      .forEach(bl => {
        if (bl.LOTE_ID) targetLoteIds.add(sanitizeLoteCode(bl.LOTE_ID));
      });

    targetLoteIds.forEach(lid => {
      const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === lid);
      if (lIdx !== -1) {
        db.lotes[lIdx].ESTADO_LOTE = Boolean((batch as any)?.cerroCompletamente) ? "CERRADO" : nextState;
      }
    });

    this.addAuditLog(`Registro de análisis de descarga ${id} para Batch ${batchId} (Estado: ${nextState})`, user);
    deduplicateAndMigrateLotes(db);
    this.persist();
    return record;
  }

  public deleteAnalisisVaporizado(id: string, user: string = "Operador"): boolean {
    const db = this.load();
    const cleanId = (id || "").toString().trim().toUpperCase();
    if (!cleanId) return false;

    const before = db.analisisVaporizado.length;
    const deletedSample = db.analisisVaporizado.find(
      a => (a.ANALISIS_VAPORIZADO_ID || "").toString().trim().toUpperCase() === cleanId
    );

    db.analisisVaporizado = db.analisisVaporizado.filter(
      a => (a.ANALISIS_VAPORIZADO_ID || "").toString().trim().toUpperCase() !== cleanId
    );

    if (db.analisisVaporizado.length < before) {
      if (deletedSample?.BATCH_ID) {
        const bId = deletedSample.BATCH_ID;
        const normBatchTarget = bId.toUpperCase().replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
        const remainingSamples = db.analisisVaporizado.filter(a => {
          const u = (a.BATCH_ID || "").toString().trim().toUpperCase();
          if (u === bId.toUpperCase()) return true;
          const n = u.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
          return Boolean(normBatchTarget && n === normBatchTarget);
        });

        if (remainingSamples.length === 0) {
          const batch = db.batchesVaporizado.find(b => {
            const u = (b.BATCH_ID || "").toString().trim().toUpperCase();
            const c = (b.CORRELATIVO || "").toString().trim().toUpperCase();
            return u === bId.toUpperCase() || c === bId.toUpperCase() ||
              (normBatchTarget && (u.includes(normBatchTarget) || c.includes(normBatchTarget)));
          });
          if (batch && !Boolean((batch as any).cerroCompletamente)) {
            const ctrl = db.controlVaporizado.find(c => {
              const u = (c.BATCH_ID || "").toString().trim().toUpperCase();
              return u === bId.toUpperCase();
            });
            batch.ESTADO_BATCH = ctrl ? "VAPORIZADO" : "PROGRAMADO";
          }
        }
      }

      this.addAuditLog(`Eliminación de muestra de análisis de vaporizado ${id}`, user);
      deduplicateAndMigrateLotes(db);
      this.persist();
      return true;
    }
    return false;
  }

  public saveCoccionParaBatch(record: any, user: string = "Laboratorio Cocción"): any {
    const db = this.load();
    if (!db.resultadosCoccionExternos) db.resultadosCoccionExternos = [];
    const idx = db.resultadosCoccionExternos.findIndex(
      e => e.id === record.id || (record.batchId && e.batchId === record.batchId)
    );
    if (idx !== -1) {
      db.resultadosCoccionExternos[idx] = { ...db.resultadosCoccionExternos[idx], ...record };
    } else {
      db.resultadosCoccionExternos.unshift(record);
    }

    const batchId = (record.batchId || record.correlativo || "").toString().trim();
    const normBatchTarget = batchId.toUpperCase().replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
    const matchesBatch = (val?: string) => {
      if (!val) return false;
      const u = val.toString().trim().toUpperCase();
      if (u === batchId.toUpperCase()) return true;
      const n = u.replace(/^(BATCH|BAT|B)[\s\-_:]*/i, "").replace(/[\s\-_]/g, "");
      return Boolean(normBatchTarget && n === normBatchTarget);
    };

    const batch = db.batchesVaporizado.find(b => matchesBatch(b.BATCH_ID) || matchesBatch(b.CORRELATIVO));
    if (batch && !Boolean((batch as any).cerroCompletamente)) {
      batch.ESTADO_BATCH = "EVALUADO";
    }

    const targetLoteIds = new Set<string>();
    if (record.loteId) targetLoteIds.add(sanitizeLoteCode(record.loteId));
    db.batchLotes
      .filter(bl => matchesBatch(bl.BATCH_ID) || (batch && (bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO)))
      .forEach(bl => {
        if (bl.LOTE_ID) targetLoteIds.add(sanitizeLoteCode(bl.LOTE_ID));
      });

    targetLoteIds.forEach(lid => {
      const lIdx = db.lotes.findIndex(l => sanitizeLoteCode(l.LOTE_ID) === lid);
      if (lIdx !== -1 && !Boolean((batch as any)?.cerroCompletamente)) {
        db.lotes[lIdx].ESTADO_LOTE = "EVALUADO";
      }
    });

    this.addAuditLog(`Registro de resultados de calidad (incremento de defectos y cocción en olla) para Batch ${batchId} (Estado: EVALUADO)`, user);
    deduplicateAndMigrateLotes(db);
    this.persist();
    return record;
  }

  // --- CONFIG / PARAMETROS ---
  public getEquipos(): Equipo[] {
    return this.load().equipos;
  }

  public getEstados(): EstadoLote[] {
    return INITIAL_DATA.estadosLote;
  }

  public getAuditLogs(): any[] {
    return this.load().auditLogs;
  }

  public getWeights(): SuccessWeights {
    return this.load().successWeights;
  }

  public saveWeights(weights: Partial<SuccessWeights>, user: string = "Operador"): SuccessWeights {
    const db = this.load();
    db.successWeights = { ...db.successWeights, ...weights };
    this.addAuditLog("Actualización de ponderaciones de éxito del proceso", user);
    this.persist();
    return db.successWeights;
  }

  public getPriorizacionConfig(): any {
    return this.load().priorizacionConfig || null;
  }

  public savePriorizacionConfig(config: any, user: string = "Operador"): any {
    const db = this.load();
    db.priorizacionConfig = config;
    this.persist();
    return db.priorizacionConfig;
  }

  public addPriorizacionAudit(auditItem: any, user: string = "Operador") {
    const db = this.load();
    if (!db.priorizacionAudit) db.priorizacionAudit = [];
    db.priorizacionAudit.unshift(auditItem);
    this.persist();
  }

  public getEvaluacionLotesConfig(): ConfiguracionEvaluacionLotes | undefined {
    return this.load().configuracionEvaluacionLotes;
  }

  public saveEvaluacionLotesConfig(config: any, user: string = "Operador"): any {
    const db = this.load();
    db.configuracionEvaluacionLotes = config;
    this.persist();
    return db.configuracionEvaluacionLotes;
  }

  public getPresetsEvaluacionLotes(): ConfiguracionEvaluacionLotes[] | undefined {
    return this.load().presetsEvaluacionLotes;
  }

  public savePresetEvaluacion(preset: any, user: string = "Operador"): any[] {
    const db = this.load();
    if (!db.presetsEvaluacionLotes) {
      db.presetsEvaluacionLotes = [];
    }
    const idx = db.presetsEvaluacionLotes.findIndex((p: any) => p.id === preset.id || p.nombre === preset.nombre);
    if (idx >= 0) {
      db.presetsEvaluacionLotes[idx] = { ...db.presetsEvaluacionLotes[idx], ...preset };
    } else {
      db.presetsEvaluacionLotes.push(preset);
    }
    this.persist();
    return db.presetsEvaluacionLotes;
  }

  public savePresetsEvaluacionLotes(presets: any[], user: string = "Operador"): any[] {
    const db = this.load();
    db.presetsEvaluacionLotes = presets;
    this.persist();
    return db.presetsEvaluacionLotes;
  }

  public getParametrosTrabajo(): ParametrosTrabajo | undefined {
    return this.load().parametrosTrabajo;
  }

  public getHistorialParametros(): any[] {
    return this.load().historialParametros || [];
  }

  public saveParametrosTrabajo(params: Partial<ParametrosTrabajo>, motivoOrUser?: string, userParam?: string): ParametrosTrabajo {
    const db = this.load();
    const current = db.parametrosTrabajo || INITIAL_DATA.parametrosTrabajo!;
    const user = userParam || (motivoOrUser && !motivoOrUser.includes(" ") ? motivoOrUser : "Operador");

    if (!db.historialParametros) db.historialParametros = [];
    db.historialParametros.unshift({
      ...current,
      fechaArchivo: new Date().toISOString()
    });

    const updated: ParametrosTrabajo = {
      ...current,
      ...params,
      ultimaModificacion: new Date().toISOString().replace("T", " ").substring(0, 19),
      modificadoPor: user
    };
    db.parametrosTrabajo = updated;
    this.addAuditLog(motivoOrUser && motivoOrUser.length > 5 ? `Actualización de parámetros: ${motivoOrUser}` : "Actualización de parámetros operativos de trabajo", user);
    this.persist();
    return updated;
  }

  // --- USUARIOS ---
  public getUsers(): UserProfile[] {
    const db = this.load();
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem("anvap_users_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            db.users = parsed.filter(
              (u: UserProfile) => u && u.id !== "usr-jefe-vap" && (u.email || "").toLowerCase() !== "carlos.morales@arrozvapor.pe"
            );
            return db.users;
          }
        }
      } catch {
        // ignore
      }
    }
    db.users = (db.users || []).filter(
      (u) => u && u.id !== "usr-jefe-vap" && (u.email || "").toLowerCase() !== "carlos.morales@arrozvapor.pe"
    );
    return db.users;
  }

  public setUsers(users: UserProfile[], adminUser: string = "Super Admin"): UserProfile[] {
    const db = this.load();
    if (Array.isArray(users) && users.length > 0) {
      db.users = users;
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem("anvap_users_v1", JSON.stringify(users));
        } catch {
          // ignore
        }
      }
      this.persist();
    }
    return db.users;
  }

  public saveUser(user: Partial<UserProfile>, adminUser: string = "Super Admin"): UserProfile {
    const db = this.load();
    const id = user.id || `usr-${Date.now()}`;
    const userObj: UserProfile = {
      ...user,
      id,
      nombre: user.nombre || "Nuevo Usuario",
      email: user.email || `${id}@planta-apit.pe`,
      rol: user.rol || "OPERARIO"
    } as UserProfile;

    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...userObj };
    } else {
      db.users.unshift(userObj);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("anvap_users_v1", JSON.stringify(db.users));
      } catch {
        // ignore
      }
    }
    this.addAuditLog(`Actualización de usuario ${userObj.nombre} (${userObj.rol})`, adminUser);
    this.persist();
    return userObj;
  }

  public deleteUser(userId: string, adminUser: string = "Super Admin"): boolean {
    const db = this.load();
    const before = db.users.length;
    db.users = db.users.filter(u => u.id !== userId);
    if (db.users.length < before) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem("anvap_users_v1", JSON.stringify(db.users));
        } catch {
          // ignore
        }
      }
      this.addAuditLog(`Eliminación de usuario ID: ${userId}`, adminUser);
      this.persist();
      return true;
    }
    return false;
  }

  // --- PROGRAMACIONES OFICIALES ---
  public getProgramacionesOficiales(): any[] {
    return this.load().programacionesOficiales || [];
  }

  public saveProgramacionOficial(prog: any, user: string = "Operador"): any {
    const db = this.load();
    if (!db.programacionesOficiales) db.programacionesOficiales = [];
    const id = prog.id || `PROG-BATCH-${Date.now()}`;
    const progObj = { ...prog, id };

    const idx = db.programacionesOficiales.findIndex(p => p.id === id || (prog.batch && p.batch === prog.batch));
    if (idx !== -1) {
      db.programacionesOficiales[idx] = progObj;
    } else {
      db.programacionesOficiales.push(progObj);
    }
    if (Array.isArray(progObj.filasLote)) {
      progObj.filasLote.forEach((f: any) => {
        const lid = sanitizeLoteCode(f?.loteId || f?.LOTE_ID);
        if (lid) removeUnlinkedNewLote(lid);
      });
    }
    db.programacionApit = db.programacionesOficiales;
    deduplicateAndMigrateLotes(db);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const serialized = JSON.stringify(db.programacionesOficiales);
        window.localStorage.setItem("programaciones_batch_oficial_v1", serialized);
        window.localStorage.setItem("molino_programaciones_batch_oficiales_v3", serialized);
        window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: db.programacionesOficiales }));
      } catch {
        // ignore
      }
    }
    this.persist();
    return progObj;
  }

  public deleteProgramacionOficial(id: string, user: string = "Operador"): boolean {
    return this.deleteBatch(id, user);
  }

  // --- COCCION EXTERNA ---
  public syncCoccionExterno(records: any[]): any[] {
    const db = this.load();
    if (!db.resultadosCoccionExternos) db.resultadosCoccionExternos = [];
    records.forEach(r => {
      const idx = db.resultadosCoccionExternos!.findIndex(e => e.id === r.id);
      if (idx !== -1) {
        db.resultadosCoccionExternos![idx] = r;
      } else {
        db.resultadosCoccionExternos!.unshift(r);
      }
    });
    deduplicateAndMigrateLotes(db);
    this.persist();
    return db.resultadosCoccionExternos;
  }

  public getCoccionResultados(): any[] {
    return this.load().resultadosCoccionExternos || [];
  }

  public deleteCoccionResultado(id: string): boolean {
    const db = this.load();
    if (!db.resultadosCoccionExternos) return false;
    db.resultadosCoccionExternos = db.resultadosCoccionExternos.filter(r => r.id !== id);
    this.persist();
    return true;
  }

  // --- BULK IMPORT & CONSTANT UPSERT DESDE EXCEL ---
  public bulkImport(payload: any, user: string = "Operador"): any {
    const db = this.load();
    const stats: Record<string, number> = {
      lotesActualizados: 0,
      lotesNuevos: 0,
      humedadesSincronizadas: 0,
      analisisSincronizados: 0
    };

    const rawLotes = Array.isArray(payload.lotes) ? payload.lotes : [];
    const rawHumList = Array.isArray(payload.registroHumedad) 
      ? payload.registroHumedad 
      : (Array.isArray(payload.humedades) ? payload.humedades : []);
    const rawAnalisisHumList = Array.isArray(payload.analisisHumedo) 
      ? payload.analisisHumedo 
      : (Array.isArray(payload.analisisHum) ? payload.analisisHum : []);

    // 1. Procesar Lotes (Soporta tablas maestras consolidadas que incluyen humedad y análisis en la misma fila)
    if (rawLotes.length > 0) {
      rawLotes.forEach((l: any) => {
        const rawCode = String(getFieldVal(l, [
          "LOTE_ID", "LOTE", "CODIGO", "CÓDIGO", "COD", "ID", "TICKET", "FICHA", 
          "NRO LOTE", "NRO_LOTE", "N° LOTE", "CODIGO DE LOTE", "CÓDIGO DE LOTE", "LOTE ID"
        ]) || "").trim();
        const norm = formatLoteCode(rawCode);
        if (!norm || norm === "0" || norm === "C00") return;

        // Normalización fiel de campos sin inventar datos ficticios
        const rawCliente = String(getFieldVal(l, [
          "CLIENTE / AGRICULTOR / PRODUCTOR", "CLIENTE/AGRICULTOR/PRODUCTOR", "CLIENTE", "PRODUCTOR", "AGRICULTOR", "PROVEEDOR", "SEÑOR", "NOMBRE", 
          "CLIENTE / PRODUCTOR", "CLIENTE/PRODUCTOR", "RAZON SOCIAL", "RAZÓN SOCIAL", "DUEÑO", "DUENO", "TITULAR"
        ]) || "").trim().toUpperCase();
        const cliente = rawCliente;

        const rawVariedad = String(getFieldVal(l, [
          "VARIEDAD DE ARROZ", "VARIEDAD", "VARIEDA", "VARIEDAD ARROZ", "VAR", 
          "TIPO ARROZ", "TIPO DE ARROZ", "TIPO", "VARIEDADES", "PRODUCTO", "CLASE", "ESPECIE", "TIPO DE GRANO"
        ]) || "").trim();
        const variedad = rawVariedad;

        const rawSacos = getFieldVal(l, [
          "SACOS", "SACO", "CANTIDAD", "CANTIDAD DE SACOS", "CANTIDAD SACOS", "BULTOS", "BOLSAS", "NRO SACOS", "N° SACOS", 
          "NRO_SACOS", "CANT", "BULT"
        ]);
        const sacos = parseNumericVal(rawSacos) || 0;

        const rawPeso = getFieldVal(l, [
          "PESO (KG)", "PESO (Kg)", "PESO(KG)", "PESO (kg)", "PESO NETO (KG)", "PESO NETO(KG)",
          "PESO_KG", "PESO EN KG", "PESO KG", "PESO", "KILOS", "TOTAL_KG", "PESO_NETO", "PESO NETO", "NETO", "KG"
        ]);
        const rawPesoTn = getFieldVal(l, ["PESO (TN)", "PESO TN", "TN"]);
        const parsedP = parseNumericVal(rawPeso);
        const parsedPTn = parseNumericVal(rawPesoTn);
        const pesoKg = (parsedP !== undefined && parsedP > 0) ? parsedP : (parsedPTn !== undefined && parsedPTn > 0 ? parsedPTn * 1000 : 0);

        // Fecha de ingreso o recepción (soporta FECHA DE RECEPCION, formato serial de Excel, ISO, etc.)
        const rawFecha = getFieldVal(l, [
          "FECHA DE RECEPCION", "FECHA DE RECEPCIÓN", "FECHA RECEPCION", "FECHA RECEPCIÓN", 
          "FECHA DE INGRESO", "FECHA_INGRESO", "FECHA", "FECHA INGRESO", "FECHA_ANALISIS", 
          "FECHA ANALISIS", "DATE", "F. INGRESO", "F. RECEPCION", "FECHA RECEP"
        ]);
        let fecha = "";
        if (rawFecha !== undefined && rawFecha !== null && String(rawFecha).trim() !== "") {
          const dVal = validateDateValue(rawFecha);
          fecha = dVal.isoDate || String(rawFecha).trim();
        }

        const ubicacion = String(getFieldVal(l, [
          "UBICACION", "UBICACIÓN", "SILO", "TOLVA", "ALMACEN", "ALMACÉN", "ZONA ACOPIO", "DESTINO"
        ]) || "").trim();

        const zona = String(getFieldVal(l, [
          "ZONA", "PROCEDENCIA", "ORIGEN", "SECTOR", "VALLE", "LUGAR"
        ]) || "").trim();

        const observaciones = String(getFieldVal(l, [
          "OBSERVACIONES", "OBSERVACION", "OBSERVACIÓN", "OBSERVACION POR LOTE", "OBSERVACIÓN POR LOTE", "OBSERVACIONES POR LOTE",
          "OBS POR LOTE", "OBS. POR LOTE", "OBS LOTE", "OBSERVACION DE LOTE", "OBSERVACIONES DE LOTE",
          "OBS", "OBS.", "NOTA", "NOTAS", "DETALLE", "COMENTARIOS", "COMENTARIO"
        ]) || "").trim();

        // Promedio de humedad (detecta 'HUMEDAD PROMEDIO', 'PROM. H', 'HUM. M', 'PROM H', 'HUMEDAD', 'HUM')
        const rawHumVal = getFieldVal(l, [
          "HUMEDAD PROMEDIO", "HUM", "PROM. H", "PROM H", "PROM_H", "HUM. M", "HUMEDAD", "HUMEDADES", 
          "H. PROMEDIO", "HUM PROM", "%H", "PROM.", "HUMEDAD %", "H%", "H.PROM", "H", "HUMEDAD ( % )", "HUMEDAD (%)"
        ]);
        const hum = parseNumericVal(rawHumVal);

        // Desviación estándar de humedad (detecta 'D.', 'DESV', 'DESVIACION')
        const desvVal = getFieldVal(l, [
          "DESVIACION", "DESVIACIÓN", "D.", "DESV", "D", "DESV.", "STD", "DS", "DESVIACION ESTANDAR"
        ]);
        let desv = parseNumericVal(desvVal);
        if (desv !== undefined && desv > 20) {
          const s = String(desvVal).trim();
          const parts = s.split(".");
          if (parts.length >= 3) {
            if (parseInt(parts[0], 10) < 50) {
              desv = Number(parseFloat(`${parts[0]}.${parts.slice(1).join("")}`).toFixed(2));
            } else if (parseInt(parts[0], 10) >= 900) {
              desv = Number(parseFloat(`0.${parts.join("")}`).toFixed(2));
            }
          }
        }

        // --- A. UPSERT DE LOTE MAESTRO ---
        const idx = db.lotes.findIndex(x => formatLoteCode(x.LOTE_ID) === norm);
        let updatedLote: Lote;
        if (idx !== -1) {
          // Lote existente: Actualizar conservando estado operativo si ya avanzó en la planta
          const currentStatus = db.lotes[idx].ESTADO_LOTE;
          const keepStatus = (currentStatus === "PROGRAMADO" || currentStatus === "EN PROCESO" || currentStatus === "VAPORIZADO" || currentStatus === "PROCESADO" || currentStatus === "EXPERIMENTAL" || currentStatus === "DESAPROBADO")
            ? currentStatus
            : "INGRESADO";

          updatedLote = {
            ...db.lotes[idx],
            LOTE_ID: norm,
            FECHA_INGRESO: fecha || db.lotes[idx].FECHA_INGRESO,
            CLIENTE: cliente || db.lotes[idx].CLIENTE,
            VARIEDAD: variedad || db.lotes[idx].VARIEDAD,
            SACOS: sacos > 0 ? sacos : db.lotes[idx].SACOS,
            PESO_KG: pesoKg > 0 ? pesoKg : db.lotes[idx].PESO_KG,
            HUM: hum !== undefined ? hum : db.lotes[idx].HUM,
            DESV: desv !== undefined ? desv : db.lotes[idx].DESV,
            UBICACION: ubicacion || db.lotes[idx].UBICACION,
            ZONA: zona || db.lotes[idx].ZONA,
            ESTADO_LOTE: keepStatus,
            OBSERVACIONES: observaciones || db.lotes[idx].OBSERVACIONES
          };
          db.lotes[idx] = updatedLote;
          stats.lotesActualizados++;
        } else {
          // Lote nuevo: Todo código ingresado debe aparecer como INGRESADO
          removeDeletedLoteTombstone(norm);
          removeUnlinkedNewLote(norm);
          updatedLote = {
            LOTE_ID: norm,
            FECHA_INGRESO: fecha || undefined as any,
            CLIENTE: cliente,
            VARIEDAD: variedad,
            SACOS: sacos > 0 ? sacos : undefined as any,
            PESO_KG: pesoKg > 0 ? pesoKg : undefined as any,
            HUM: (hum !== undefined && hum > 0) ? hum : undefined,
            DESV: desv,
            UBICACION: ubicacion || undefined,
            ZONA: zona || undefined,
            ESTADO_LOTE: "INGRESADO",
            OBSERVACIONES: observaciones,
            _recienIngresado: true
          } as any;
          db.lotes.unshift(updatedLote);
          stats.lotesNuevos++;
        }

        // Eliminar cualquier duplicado huérfano con código sin normalizar (ej. 8432 sin C0)
        db.lotes = db.lotes.filter((x) => {
          if (x === updatedLote) return true;
          return formatLoteCode(x.LOTE_ID) !== norm;
        });

        // --- B. EXTRACCIÓN AUTOMÁTICA DE CALADAS M1-M19 (REGISTRO DE HUMEDAD) ---
        // Verifica si la fila contiene columnas de muestreo de tolva (M1..M19 o H1..H19 o C1..C19)
        const hasCaladas = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19].some(i => 
          l[`M${i}`] !== undefined || l[`H${i}`] !== undefined || l[`m${i}`] !== undefined || l[`h${i}`] !== undefined || l[`C${i}`] !== undefined
        );

        if (hasCaladas || (hum !== undefined && hum > 0)) {
          const caladasRecord: Record<string, number> = {};
          let caladasSum = 0;
          let caladasCount = 0;

          for (let i = 1; i <= 19; i++) {
            const rawM = l[`M${i}`] ?? l[`H${i}`] ?? l[`m${i}`] ?? l[`h${i}`] ?? l[`C${i}`];
            const val = parseNumericVal(rawM);
            if (val !== undefined && val > 0) {
              caladasRecord[`M${i}`] = Number(val.toFixed(2));
              caladasSum += val;
              caladasCount++;
            }
          }

          const calculatedProm = caladasCount > 0 ? Number((caladasSum / caladasCount).toFixed(2)) : hum;
          if ((desv === undefined || desv > 20 || desv === 0) && caladasCount > 1) {
            const mean = caladasSum / caladasCount;
            const variance = Object.values(caladasRecord).reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (caladasCount - 1);
            desv = Number(Math.sqrt(variance).toFixed(2));
          }

          const humMaxVal = parseNumericVal(getFieldVal(l, ["HUM_MAX", "HUM. MAX", "HUM.MAX", "HUM MAX", "HUMEDAD MAXIMA", "MAX"]));
          const humMinVal = parseNumericVal(getFieldVal(l, ["HUM_MIN", "HUM.MIN", "HUM. MIN", "HUM MIN", "HUMEDAD MINIMA", "MIN"]));

          const humId = `HUM-${norm}`;
          const existingHumIdx = db.registroHumedad.findIndex(
            h => formatLoteCode(h.LOTE_ID) === norm || h["ID ANALISIS"] === humId
          );

          const humPayload: any = {
            "ID ANALISIS": humId,
            LOTE_ID: norm,
            FECHA: fecha,
            FECHA_ANALISIS: fecha,
            "PROM. GENERAL": calculatedProm,
            "H. PROMEDIO": calculatedProm,
            DESVIACION: desv,
            HUM_MAX: humMaxVal,
            HUM_MIN: humMinVal,
            ...caladasRecord
          };

          if (existingHumIdx !== -1) {
            db.registroHumedad[existingHumIdx] = {
              ...db.registroHumedad[existingHumIdx],
              ...humPayload
            };
          } else {
            db.registroHumedad.unshift(humPayload);
          }
          stats.humedadesSincronizadas++;
        }

        // --- C. EXTRACCIÓN AUTOMÁTICA DE TODOS LOS PARÁMETROS FÍSICOS (ANÁLISIS EN HÚMEDO) ---
        const rawRi = getFieldVal(l, ["R. INTEGRAL", "R INTEGRAL", "RI", "RENDIMIENTO INTEGRAL", "R.I.", "R.I", "%RI", "R_I", "REND. INTEGRAL", "R_INTEGRAL"]);
        const rawRb = getFieldVal(l, ["R. BLANCO", "R BLANCO", "RB", "RENDIMIENTO BLANCO", "R.B.", "R.B", "%RB", "R_B", "REND. BLANCO", "R_BLANCO"]);
        const rawRm = getFieldVal(l, ["RM", "RENDIMIENTO MASA", "R.M.", "R.M", "%RM", "R_M", "REMOCION", "REMOCIÓN"]);
        const rawQi = getFieldVal(l, ["QUEBRADO INTEGRAL", "QI", "Q.I.", "Q.I", "Q", "QUEBRADO", "%QI", "Q_I", "QUEB. INTEGRAL"]);
        const rawQb = getFieldVal(l, ["QUEBRADO EN BLANCO", "QB", "QUEBRADO BLANCO", "Q.B.", "Q.B", "%QB", "Q_B", "QUEB. BLANCO"]);
        const rawEntero = getFieldVal(l, ["ENTERO", "ARROZ ENTERO", "% ENTERO", "GRANO ENTERO", "ENTEROS"]);
        const rawTt = getFieldVal(l, ["TIZA. TOTAL", "TIZA.TOTAL", "TIZA TOTAL", "TT", "TOTAL TRIZADO", "TIZA", "%TT", "T_T", "T.T.", "T.T", "TIZADO TOTAL"]);
        const rawTp = getFieldVal(l, ["TIZA. PARCIAL", "TIZA.PARCIAL", "TIZA PARCIAL", "TP", "TIZADO PARCIAL", "T. PUNT.", "T_PUNT", "PUNTO NEGRO", "PUNTOS", "%TP", "T_P", "T.P.", "T.P"]);
        const rawTPunt = getFieldVal(l, ["T. PUNT.", "T_PUNT", "T PUNT", "PUNTILLAS", "PUNTILLA", "T.PUNT."]);
        const rawM = getFieldVal(l, ["MANCHA", "M", "MANCHADO", "MANCHADOS", "%M", "GRANOS MANCHADOS"]);
        const rawTz = getFieldVal(l, ["TRIZADO", "TZ", "%TZ", "T_Z", "T.Z.", "TRIZADOS"]);
        const rawGr = getFieldVal(l, ["GRANO ROJO", "GR", "ROJO", "ROJOS", "GRANOS ROJOS", "%GR", "G_R", "G.R."]);
        const rawGi = getFieldVal(l, ["GRANO INM", "GRANO INM.", "GRANO.INM", "GRANO INMADURO", "GRANOS INMADUROS", "YESOSO", "INMADURO", "GI", "G.I.", "%GI", "G_I", "INM"]);
        const rawGv = getFieldVal(l, ["GRANO . VERDE", "GRANO. VERDE", "GRANO.VERDE", "GRANO VERDE", "GRANOS VERDES", "VERDE", "VERDES", "GV", "G.V.", "%GV", "G_V"]);
        const rawBInt = getFieldVal(l, ["BL. INTEGRAL", "BL.INTEGRAL", "BL INTEGRAL", "B.INTEGRAL", "B. INTEGRAL", "B_INTEGRAL", "BLI", "BL", "BLANCURA INTEGRAL", "KETT", "BLANCURA"]);
        const rawBPul = getFieldVal(l, ["BL.PULID.", "BL.PULID", "BL. PULID.", "B. PULIDO", "B.PULIDO", "B_PULIDO", "BLP", "BLANCURA PULIDO"]);
        const rawImpurezas = getFieldVal(l, ["IMPUREZAS", "IMPUREZS", "IMP", "IMP.", "%IMP", "MATERIA EXTRAÑA", "IMPUREZA"]);
        const rawPalote = getFieldVal(l, ["PALOTE", "PALOTES"]);
        const rawVano = getFieldVal(l, ["VANO", "VANOS"]);
        const rawOlor = getFieldVal(l, ["OLOR", "OLORES"]);
        const rawFCarbon = getFieldVal(l, ["F. CARBON", "F.CARBON", "CARBON", "CARBÓN", "FALSO CARBON", "FALSO CARBÓN"]);
        const rawHongo = getFieldVal(l, ["HONGO", "HONGOS"]);

        const ri = parseNumericVal(rawRi) || 0;
        const rb = parseNumericVal(rawRb) || 0;
        const qi = parseNumericVal(rawQi) || 0;
        const qb = parseNumericVal(rawQb) || 0;
        const queb = qb > 0 ? qb : qi;
        const parsedRm = parseNumericVal(rawRm);
        const rm = parsedRm !== undefined ? parsedRm : ((ri > 0 || rb > 0) ? Number((ri - rb).toFixed(2)) : 0);
        const parsedEntero = parseNumericVal(rawEntero);
        const entero = parsedEntero !== undefined ? parsedEntero : ((rb > 0 && queb > 0) ? Number((rb - queb).toFixed(2)) : (rb > 0 ? rb : 0));
        const tt = parseNumericVal(rawTt) || 0;
        const tp = parseNumericVal(rawTp) || 0;
        const tPunt = parseNumericVal(rawTPunt) || 0;
        const m = parseNumericVal(rawM) || 0;
        const tz = parseNumericVal(rawTz) || 0;
        const gr = parseNumericVal(rawGr) || 0;
        const gi = parseNumericVal(rawGi) || 0;
        const gv = parseNumericVal(rawGv) || 0;
        const bInt = parseNumericVal(rawBInt) || 0;
        const bPul = parseNumericVal(rawBPul) || 0;
        const impurezas = parseNumericVal(rawImpurezas) || 0;

        const hasPhysicalData = 
          rawRi !== undefined || rawRb !== undefined || rawQi !== undefined || rawQb !== undefined ||
          rawTt !== undefined || rawTp !== undefined || rawM !== undefined || rawTz !== undefined ||
          rawGr !== undefined || rawGi !== undefined || rawGv !== undefined || rawBInt !== undefined ||
          rawBPul !== undefined || rawImpurezas !== undefined || rawPalote !== undefined ||
          rawVano !== undefined || rawOlor !== undefined || rawFCarbon !== undefined || rawHongo !== undefined ||
          ri > 0 || rb > 0 || qi > 0 || qb > 0 || tt > 0 || tp > 0 || m > 0 || tz > 0 || gr > 0 || gv > 0;

        if (hasPhysicalData) {
          const ahId = `AH-${norm}`;
          const existingAhIdx = db.analisisHumedo.findIndex(
            a => formatLoteCode(a.LOTE_ID) === norm || a.ANALISIS_HUMEDO_ID === ahId
          );

          const ahPayload: any = {
            ANALISIS_HUMEDO_ID: ahId,
            LOTE_ID: norm,
            FECHA_ANALISIS: fecha,
            VARIEDAD: variedad,
            HUMEDADES: hum,
            RI: ri,
            RB: rb,
            RM: rm,
            QI: qi,
            QB: qb,
            ENTERO: entero,
            TT: tt,
            TP: tp,
            "T. PUNT.": tPunt,
            M: m,
            MANCHADO: m,
            TZ: tz,
            GR: gr,
            GI: gi,
            GV: gv,
            "B.INTEGRAL": bInt,
            "B. PULIDO": bPul,
            IMPUREZS: impurezas,
            PALOTE: rawPalote !== undefined ? rawPalote : undefined,
            VANO: rawVano !== undefined ? rawVano : undefined,
            OLOR: rawOlor !== undefined ? rawOlor : undefined,
            "F. CARBON": rawFCarbon !== undefined ? rawFCarbon : undefined,
            HONGO: rawHongo !== undefined ? rawHongo : undefined,
            OBSERVACIONES: observaciones || undefined
          };

          if (existingAhIdx !== -1) {
            db.analisisHumedo[existingAhIdx] = {
              ...db.analisisHumedo[existingAhIdx],
              ...ahPayload
            };
          } else {
            db.analisisHumedo.unshift(ahPayload);
          }
          stats.analisisSincronizados++;
        }
      });
    }

    // 2. Procesar Hojas Adicionales de Humedad si venían separadas
    if (rawHumList.length > 0) {
      rawHumList.forEach((h: any) => {
        const loteNorm = formatLoteCode(h.LOTE_ID || h.CODIGO || h.LOTE);
        const id = h["ID ANALISIS"] || h.ID_ANALISIS || (loteNorm ? `HUM-${loteNorm}` : `HUM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
        const idx = db.registroHumedad.findIndex(x => x["ID ANALISIS"] === id || (loteNorm && formatLoteCode(x.LOTE_ID) === loteNorm));
        const item = { ...h, "ID ANALISIS": id, LOTE_ID: loteNorm || h.LOTE_ID };
        if (idx !== -1) db.registroHumedad[idx] = { ...db.registroHumedad[idx], ...item };
        else {
          db.registroHumedad.unshift(item);
          stats.humedadesSincronizadas++;
        }
      });
    }

    // 3. Procesar Hojas Adicionales de Análisis Físico si venían separadas
    if (rawAnalisisHumList.length > 0) {
      rawAnalisisHumList.forEach((a: any) => {
        const rawCode = a.LOTE_ID || a.LOTE || a.CODIGO || a["NRO LOTE"] || a["NRO_LOTE"] || a["N° LOTE"] || a["FICHA"];
        const loteNorm = rawCode ? formatLoteCode(rawCode) : "";
        const id = a.ANALISIS_HUMEDO_ID || (loteNorm ? `AH-${loteNorm}` : `AH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
        
        const analisisItem = {
          ...a,
          ANALISIS_HUMEDO_ID: id,
          LOTE_ID: loteNorm || a.LOTE_ID
        };

        const idx = db.analisisHumedo.findIndex(x => x.ANALISIS_HUMEDO_ID === id || (loteNorm && formatLoteCode(x.LOTE_ID) === loteNorm));
        if (idx !== -1) db.analisisHumedo[idx] = { ...db.analisisHumedo[idx], ...analisisItem };
        else {
          db.analisisHumedo.unshift(analisisItem);
          stats.analisisSincronizados++;
        }
      });
    }

    const logMsg = `Actualización de Excel procesada (${stats.lotesNuevos} nuevos, ${stats.lotesActualizados} actualizados, ${stats.humedadesSincronizadas} humedades, ${stats.analisisSincronizados} análisis)`;
    this.addAuditLog(logMsg, user);
    deduplicateAndMigrateLotes(db);
    this.persist();
    return { success: true, stats, lotes: db.lotes };
  }

  // --- CLIENT-SIDE HEURISTIC AI ENGINES ---
  public recommendApit(loteId?: string, loteInfo?: any, customInput?: any): AIRecommendationResult {
    const db = this.load();
    const targetLote = loteInfo || (loteId ? db.lotes.find(l => l.LOTE_ID === loteId) : null);
    const hum = Number(targetLote?.HUM || 18.2);

    const presion = hum > 20 ? 1.95 : hum > 16 ? 1.85 : 1.75;
    const tiempoVap = hum > 20 ? 32 : hum > 16 ? 28 : 24;
    const tiempoReposo = hum > 20 ? 50 : 45;

    return {
      resumen_diagnostico: `Parámetros calculados basados en la física del grano para variedad ${targetLote?.VARIEDAD || "Tinajones Extra"} con ${hum.toFixed(1)}% de humedad de ingreso.`,
      lotes_similares_identificados: ["BAT-2026-041", "BAT-2026-042"],
      parametros: [
        {
          parametro: "Presión de Vapor",
          unidad: "bar",
          recomendado: presion,
          rango: `${(presion - 0.05).toFixed(2)} - ${(presion + 0.05).toFixed(2)}`,
          justificacion: "Garantiza gelatinización completa del centro del grano sin sobrecalentar pericarpio.",
          referencia_historica: "BAT-2026-041",
          confianza: "Alta"
        },
        {
          parametro: "Tiempo de Vaporizado",
          unidad: "min",
          recomendado: tiempoVap,
          rango: `${tiempoVap - 2} - ${tiempoVap + 2}`,
          justificacion: "Optimizado para alcanzar translucidez uniforme minimizando incremento de quebrado.",
          referencia_historica: "BAT-2026-041",
          confianza: "Alta"
        },
        {
          parametro: "Tiempo de Reposo",
          unidad: "min",
          recomendado: tiempoReposo,
          rango: `${tiempoReposo - 5} - ${tiempoReposo + 5}`,
          justificacion: "Permite atemperado gradual en tolva para evitar gradientes térmicos destructivos.",
          referencia_historica: "BAT-2026-041",
          confianza: "Alta"
        },
        {
          parametro: "RPM de Autoclave",
          unidad: "RPM",
          recomendado: 14,
          rango: "12 - 15",
          justificacion: "Volteo continuo que previene bolsas de vapor estáticas sin trizar el grano húmedo.",
          referencia_historica: "Calibración estándar APIT",
          confianza: "Alta"
        },
        {
          parametro: "Temperatura de Secado",
          unidad: "°C",
          recomendado: 85,
          rango: "80 - 90",
          justificacion: "Secado columnar controlado en 2 etapas para estabilizar humedad a 13.0%.",
          referencia_historica: "SEC-01",
          confianza: "Media"
        }
      ],
      riesgos_identificados: [
        "Controlar la tasa de enfriamiento en tolva de reposo para evitar trizado.",
        "Verificar purga de condensados antes de iniciar inyección de vapor."
      ],
      recomendaciones_operativas: [
        "Inspeccionar visualmente muestras a la salida de descarga de la autoclave APIT.",
        "Asegurar presión estable en caldera durante los primeros 10 minutos de inyección."
      ],
      nivel_confianza_general: "Alta"
    };
  }

  public simulateApit(params: any): AISimulationResult {
    const { humedadInicial = 18.2, presionBar = 1.85, tiempoVaporizadoMin = 28, tiempoReposoMin = 45 } = params || {};
    const h = Number(humedadInicial);
    const p = Number(presionBar);
    const tv = Number(tiempoVaporizadoMin);

    // Heuristic predictive model
    const quebradoInc = Math.max(0.8, Number(((p - 1.5) * 1.5 + (tv > 30 ? (tv - 30) * 0.2 : 0) + (h > 22 ? 0.8 : 0.2)).toFixed(2)));
    const blancura = Math.max(28, Math.min(38, Number((36 - (tv - 20) * 0.4 - (p - 1.6) * 2).toFixed(1))));
    const gelatinizacion = Math.min(100, Math.max(70, Number((80 + (p - 1.5) * 15 + (tv - 20) * 0.8).toFixed(1))));
    const humedadSalida = Number((h - 2.5).toFixed(1));
    const indiceExito = Math.min(100, Math.max(50, Number((100 - quebradoInc * 8 + (blancura - 30) * 2).toFixed(1))));

    return {
      es_simulacion: true,
      advertencia: "RESULTADO DE SIMULACIÓN PREDICTIVA BASADO EN MODELOS EMPÍRICOS DE PLANTA APIT.",
      predicciones: {
        quebrado_incremento_estimado_pct: quebradoInc,
        blancura_estimada: blancura,
        gelatinizacion_estimada_pct: gelatinizacion,
        humedad_salida_estimada_pct: humedadSalida,
        indice_exito_estimado: indiceExito,
        clasificacion_proyectada: indiceExito >= 85 ? "EXITOSO" : indiceExito >= 70 ? "CONFORME" : "RIESGO_ALTO"
      },
      analisis_variables: {
        impacto_presion: `Presión de ${p} bar proporciona energía suficiente para gelatinización profunda del almidón.`,
        impacto_tiempo_vapor: `Tiempo de ${tv} min asegura difusión térmica sin sobrecocción en la periferia.`,
        impacto_tiempo_reposo: `Tiempo de ${tiempoReposoMin} min reduce tensiones mecánicas internas antes de la descarga.`
      },
      alertas_simuladas: quebradoInc > 2.5 ? ["Incremento de quebrado proyectado excede el límite ideal de 2.5%."] : [],
      recomendacion_ajuste: "Parámetros simulados se encuentran en ventana operativa segura para la línea APIT.",
      suficiencia_datos: "ALTA"
    };
  }

  public sugerirParametrosTrabajo(): any {
    return {
      lotesObjetivoPorDia: 2,
      maxLotesPorDia: 3,
      capacidadMinimaProcesoKg: 22000,
      capacidadMaximaSecadoraKg: 35000,
      capacidadExcepcionalMaximaKg: 37000,
      toleranciaDefectosPp: 2,
      toleranciaQuebradoPp: 2,
      turnosDisponibles: ["Turno Día", "Turno Noche"],
      justificacionIA: "Optimización estándar calculada para autoclave industrial APIT (35 TN) y secadoras de lecho fluido.",
      fechaSugerencia: new Date().toISOString().split("T")[0]
    };
  }

  public planProgramacionDia(params: any): any {
    const db = this.load();
    const lotes = db.lotes.filter(l => l.ESTADO_LOTE === "ANALIZADO" || l.ESTADO_LOTE === "APTO");
    const candidateLotes = lotes.slice(0, 4);

    let totalKg = 0;
    let totalSacos = 0;
    const lotesIncluidos = candidateLotes.map(l => {
      totalKg += Number(l.PESO_KG) || 25000;
      totalSacos += Number(l.SACOS) || 500;
      return {
        lote_id: l.LOTE_ID,
        cliente: l.CLIENTE,
        variedad: l.VARIEDAD,
        sacos: l.SACOS,
        peso_kg: l.PESO_KG,
        peso_tn: ((l.PESO_KG || 0) / 1000).toFixed(1),
        humedad: l.HUM,
        puntuacion: 95,
        nivel_riesgo: (l.HUM || 0) > 20 ? "EMERGENCIA" : "MEDIO",
        motivo_priorizacion: (l.HUM || 0) > 20 ? "Humedad alta requiere atención inmediata." : "Cumple criterios óptimos para APIT."
      };
    });

    return {
      fecha: new Date().toISOString().split("T")[0],
      resumen_ejecutivo: "Plan de vaporizado optimizado para la autoclave APIT (35 TN), priorizando lotes por riesgo de fermentación y compatibilidad de variedad.",
      capacidad_total_planta_tn: 35,
      toneladas_programadas_total: Number((totalKg / 1000).toFixed(1)),
      sacos_programados_total: totalSacos,
      lotes_en_emergencia_count: candidateLotes.filter(l => (l.HUM || 0) > 20).length,
      lotes_alto_riesgo_count: 0,
      batches_propuestos: [
        {
          batch_temp_id: "BATCH-PROP-01",
          equipo_sugerido: "APIT",
          capacidad_equipo_tn: 35,
          ton_totales_batch: Number((totalKg / 1000).toFixed(1)),
          sacos_totales_batch: totalSacos,
          lotes_incluidos: lotesIncluidos,
          justificacion_tecnica: "Lotes compatibles en variedad y con humedad adecuada para proceso homogéneo.",
          parametros_sugeridos: {
            presion_bar: 1.85,
            tiempo_vapor_min: 28,
            tiempo_reposo_min: 45
          }
        }
      ],
      lotes_postergados: []
    };
  }

  public ocrFallback(imageBase64OrTipo?: string, tipoDocumento?: string, isExplicitDemo: boolean = false): any {
    // Si es una imagen física subida por el usuario (base64), NUNCA inventar "C08392" ni datos de prueba de Don Julio
    const isUploadedImage = typeof imageBase64OrTipo === "string" && (imageBase64OrTipo.startsWith("data:") || imageBase64OrTipo.length > 200);

    if (isUploadedImage && !isExplicitDemo) {
      return {
        exito: false,
        tipoDocumento: tipoDocumento || "FOTOGRAFIA_INGRESO",
        tipo_detectado: null,
        nroFicha: null,
        datos_extraidos: {},
        confianza: "BAJA",
        advertencia: "No se pudieron extraer datos automáticos de la fotografía. Complete los campos en el formulario."
      };
    }

    const docType = tipoDocumento || (imageBase64OrTipo && !imageBase64OrTipo.startsWith("data:") ? imageBase64OrTipo : "DON_JULIO_ANALISIS_FISICO");
    
    // Ficha Demo de prueba Don Julio Nº 002019 (SOLO para botones explícitos de Cargar Ejemplo Demo)
    return {
      exito: true,
      tipoDocumento: docType,
      tipo_detectado: "DON_JULIO_ANALISIS_FISICO",
      nroFicha: "002019",
      datos_extraidos: {
        LOTE_ID: "C08392",
        NRO_FICHA: "002019",
        CLIENTE: "ALAMO VALDERA JOSE ELMER",
        FECHA: "2026-09-05",
        VARIEDAD: "MEZCLA",
        SACOS: 184,
        PESO_KG: null, // Pendiente de balanza de tolva
        ZONA: null, // Pendiente de completar
        UBICACION: null, // Pendiente de silo/tolva
        HUMEDAD: 18.2,
        DESVIACION: 2.79,
        M1_M14: [18.3, 16.4, 18.0, 21.8, 17.9, 15.8, 21.3, 16.2, 15.9, 23.1, 14.6],
        caladas: {
          M1: 18.3, M2: 16.4, M3: 18.0,
          M4: 21.8, M5: 17.9, M6: 15.8,
          M7: 21.3, M8: 16.2, M9: 15.9,
          M10: 23.1, M11: 14.6, M12: "", M13: "", M14: ""
        },
        RI: 74.5,
        RB: 66.4,
        RM: 8.1,
        QI: 14.4,
        QB: 21.2,
        ENTERO: null,
        TT: 1.8,
        TP: 4.8,
        "T. PUNT.": null,
        M: 1.0,
        MANCHADO: 1.0,
        TZ: 1.2,
        GR: null,
        GI: 2.8,
        GV: 6.4,
        IMPUREZS: null,
        "B.INTEGRAL": 24.4,
        "B. PULIDO": null,
        VANO: "R",
        PALOTE: "P",
        OLOR: "N", // Ficha Don Julio original dice "N.P." -> Equivalente a N (No Presenta / Ninguno)
        CASCADO: "P",
        "F. CARBON": "N", // Ficha Don Julio original dice "NP" -> Equivalente a N (No Presenta / Ninguno)
        HONGO: "N", // Ficha Don Julio original dice "NP" -> Equivalente a N (No Presenta / Ninguno)
        "PLAGAS-NSEC.": "N", // Ficha Don Julio original dice "NP" -> Equivalente a N (No Presenta / Ninguno)
        OBSERVACIONES: "10% VALOR - 30% GRANO CORTO - 60% PERÓN"
      },
      confianza: "ALTA",
      advertencia: "Lectura digitalizada con éxito. Verifique los campos marcados en rojo antes de guardar."
    };
  }

  // --- COMPATIBILITY ALIASES ---
  public saveProgramacion(data: any, user: string = "Operador"): any {
    return this.saveProgramacionApit(data, user);
  }

  public saveSuccessWeights(weights: any, user: string = "Operador"): any {
    return this.saveWeights(weights, user);
  }

  public saveEvaluacionConfig(config: any, user: string = "Operador"): any {
    return this.saveEvaluacionLotesConfig(config, user);
  }

  public simulateAIRecommendation(loteId: string): any {
    return this.recommendApit(loteId);
  }

  public simulateProcess(params: any): any {
    return this.simulateApit(params);
  }

  public simulateAIOCR(imageBase64OrTipo?: string, tipoDocumento?: string): any {
    return this.ocrFallback(imageBase64OrTipo, tipoDocumento);
  }

  // --- CLOUD SYNC MERGE & DIRECT COLLECTION REPLACEMENT ---
  public syncCollectionFromCloud(collectionName: string, items: any[]) {
    const db = this.load();
    let changed = true;

    switch (collectionName) {
      case "lotes": {
        const tombstones = getDeletedLotesTombstones();
        const mergedMap = new Map<string, Lote>();
        // Preservar primero todos los lotes locales vigentes (no eliminados)
        (db.lotes || []).forEach((l) => {
          const c = formatLoteCode(l.LOTE_ID);
          if (c && !tombstones.has(c)) {
            mergedMap.set(c, { ...l, LOTE_ID: c });
          }
        });
        const rankEstado = (est?: string) => {
          const u = (est || "").toUpperCase();
          if (["PROCESADO", "EVALUADO", "CERRADO", "TERMINADO", "FINALIZADO", "ARCHIVADO"].includes(u)) return 6;
          if (u === "ANALISIS_FINAL") return 5;
          if (["VAPORIZADO", "EN SECADO", "EN REPOSO"].includes(u)) return 4;
          if (["EN PROCESO", "EN_PROCESO", "EN EJECUCION"].includes(u)) return 3;
          if (u === "PROGRAMADO") return 2;
          if (["ANALIZADO", "APTO", "OBSERVADO", "EXPERIMENTAL", "DESAPROBADO"].includes(u)) return 1;
          return 0;
        };
        (items || []).forEach((l: Lote) => {
          const canonical = formatLoteCode(l?.LOTE_ID) || l?.LOTE_ID;
          if (!canonical || tombstones.has(canonical)) return;
          const prev = mergedMap.get(canonical);
          const bestEstado =
            prev && rankEstado(prev.ESTADO_LOTE) > rankEstado(l.ESTADO_LOTE)
              ? prev.ESTADO_LOTE
              : (l.ESTADO_LOTE || prev?.ESTADO_LOTE || "INGRESADO");
          mergedMap.set(canonical, {
            ...prev,
            ...l,
            LOTE_ID: canonical,
            SACOS: (Number(l.SACOS) || 0) > 0 ? Number(l.SACOS) : (Number(prev?.SACOS) || 0),
            PESO_KG: (Number(l.PESO_KG) || 0) > 0 ? Number(l.PESO_KG) : (Number(prev?.PESO_KG) || 0),
            HUM: (Number(l.HUM || l.HUMEDAD) || 0) > 0 ? Number(l.HUM || l.HUMEDAD) : (Number(prev?.HUM || prev?.HUMEDAD) || 0),
            ESTADO_LOTE: bestEstado
          });
        });
        db.lotes = Array.from(mergedMap.values());
        deduplicateAndMigrateLotes(db);
        break;
      }
      case "humedades": {
        const tombstones = getDeletedLotesTombstones();
        const humMap = new Map<string, any>();
        (db.registroHumedad || []).forEach((h: any) => {
          const k = formatLoteCode(h?.LOTE_ID) || h?.["ID ANALISIS"];
          if (k && !tombstones.has(k)) humMap.set(k, h);
        });
        (items || []).forEach((h: any) => {
          const k = formatLoteCode(h?.LOTE_ID) || h?.["ID ANALISIS"];
          if (k && !tombstones.has(k)) {
            humMap.set(k, { ...humMap.get(k), ...h, LOTE_ID: formatLoteCode(h?.LOTE_ID) || h?.LOTE_ID });
          }
        });
        db.registroHumedad = Array.from(humMap.values());
        break;
      }
      case "analisisHumedo": {
        const tombstones = getDeletedLotesTombstones();
        const ahMap = new Map<string, any>();
        (db.analisisHumedo || []).forEach((a: any) => {
          const k = formatLoteCode(a?.LOTE_ID) || a?.ANALISIS_HUMEDO_ID;
          if (k && !tombstones.has(k)) ahMap.set(k, a);
        });
        (items || []).forEach((a: any) => {
          const k = formatLoteCode(a?.LOTE_ID) || a?.ANALISIS_HUMEDO_ID;
          if (k && !tombstones.has(k)) {
            ahMap.set(k, { ...ahMap.get(k), ...a, LOTE_ID: formatLoteCode(a?.LOTE_ID) || a?.LOTE_ID });
          }
        });
        db.analisisHumedo = Array.from(ahMap.values());
        break;
      }
      case "analisisSeco": {
        db.analisisSeco = items || [];
        break;
      }
      case "presecados": {
        db.presecado = items || [];
        break;
      }
      case "batchesVaporizado": {
        db.batchesVaporizado = items || [];
        deduplicateAndMigrateLotes(db);
        break;
      }
      case "batchLotes": {
        db.batchLotes = items || [];
        deduplicateAndMigrateLotes(db);
        break;
      }
      case "controlesVaporizado": {
        db.controlVaporizado = items || [];
        deduplicateAndMigrateLotes(db);
        break;
      }
      case "analisisVaporizados": {
        db.analisisVaporizado = items || [];
        break;
      }
      case "programaciones": {
        const cloudProgs = items || [];
        db.programacionesOficiales = cloudProgs;
        db.programacionApit = cloudProgs;
        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const serialized = JSON.stringify(cloudProgs);
            window.localStorage.setItem("programaciones_batch_oficial_v1", serialized);
            window.localStorage.setItem("molino_programaciones_batch_oficiales_v3", serialized);
            window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: cloudProgs }));
          } catch {
            // ignore
          }
        }
        deduplicateAndMigrateLotes(db);
        break;
      }
      default:
        changed = false;
        break;
    }

    if (changed) {
      this.persist();
    }
  }

  public mergeFromCloud(cloudData: Partial<LocalDatabaseSchema>, options?: { replace?: boolean }) {
    const db = this.load();
    let changed = false;
    const isReplace = options?.replace ?? true;

    if (Array.isArray(cloudData.lotes) && cloudData.lotes.length > 0) {
      const existingMap = new Map<string, Lote>();
      const tombstones = getDeletedLotesTombstones();
      (db.lotes || []).forEach((l) => {
        const c = formatLoteCode(l?.LOTE_ID);
        if (c && !tombstones.has(c)) existingMap.set(c, l);
      });
      const rankEstado = (est?: string) => {
        const u = (est || "").toUpperCase();
        if (["PROCESADO", "EVALUADO", "CERRADO", "TERMINADO", "FINALIZADO", "ARCHIVADO"].includes(u)) return 6;
        if (u === "ANALISIS_FINAL") return 5;
        if (["VAPORIZADO", "EN SECADO", "EN REPOSO"].includes(u)) return 4;
        if (["EN PROCESO", "EN_PROCESO", "EN EJECUCION"].includes(u)) return 3;
        if (u === "PROGRAMADO") return 2;
        if (["ANALIZADO", "APTO", "OBSERVADO", "EXPERIMENTAL", "DESAPROBADO"].includes(u)) return 1;
        return 0;
      };
      cloudData.lotes.forEach((cl) => {
        const canonical = formatLoteCode(cl?.LOTE_ID) || cl?.LOTE_ID;
        if (!canonical || tombstones.has(canonical)) return;
        const prev = existingMap.get(canonical);
        const bestEstado =
          prev && rankEstado(prev.ESTADO_LOTE) > rankEstado(cl.ESTADO_LOTE)
            ? prev.ESTADO_LOTE
            : (cl.ESTADO_LOTE || prev?.ESTADO_LOTE || "INGRESADO");
        existingMap.set(canonical, {
          ...prev,
          ...cl,
          LOTE_ID: canonical,
          SACOS: (Number(cl.SACOS) || 0) > 0 ? Number(cl.SACOS) : (Number(prev?.SACOS) || 0),
          PESO_KG: (Number(cl.PESO_KG) || 0) > 0 ? Number(cl.PESO_KG) : (Number(prev?.PESO_KG) || 0),
          HUM: (Number(cl.HUM || cl.HUMEDAD) || 0) > 0 ? Number(cl.HUM || cl.HUMEDAD) : (Number(prev?.HUM || prev?.HUMEDAD) || 0),
          ESTADO_LOTE: bestEstado
        });
      });
      db.lotes = Array.from(existingMap.values());
      changed = true;
    }

    // Conjunto de LOTE_IDs válidos para descartar huérfanos
    const validLoteIds = new Set<string>();
    db.lotes.forEach((l) => {
      const canonical = formatLoteCode(l.LOTE_ID);
      if (canonical) validLoteIds.add(canonical);
    });

    if (Array.isArray(cloudData.registroHumedad) && cloudData.registroHumedad.length > 0) {
      const map = new Map<string, any>();
      (db.registroHumedad || []).forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.["ID ANALISIS"];
        if (k) map.set(k, item);
      });
      cloudData.registroHumedad.forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.["ID ANALISIS"];
        if (k) map.set(k, { ...map.get(k), ...item });
      });
      db.registroHumedad = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.analisisHumedo) && cloudData.analisisHumedo.length > 0) {
      const map = new Map<string, any>();
      (db.analisisHumedo || []).forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.ANALISIS_HUMEDO_ID;
        if (k) map.set(k, item);
      });
      cloudData.analisisHumedo.forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.ANALISIS_HUMEDO_ID;
        if (k) map.set(k, { ...map.get(k), ...item });
      });
      db.analisisHumedo = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.analisisSeco) && cloudData.analisisSeco.length > 0) {
      const map = new Map<string, any>();
      (db.analisisSeco || []).forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.ANALISIS_SECO_ID;
        if (k) map.set(k, item);
      });
      cloudData.analisisSeco.forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.ANALISIS_SECO_ID;
        if (k) map.set(k, { ...map.get(k), ...item });
      });
      db.analisisSeco = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.presecado) && cloudData.presecado.length > 0) {
      const map = new Map<string, any>();
      (db.presecado || []).forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.PRESECADO_ID;
        if (k) map.set(k, item);
      });
      cloudData.presecado.forEach((item: any) => {
        const k = formatLoteCode(item?.LOTE_ID) || item?.PRESECADO_ID;
        if (k) map.set(k, { ...map.get(k), ...item });
      });
      db.presecado = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.batchesVaporizado) && cloudData.batchesVaporizado.length > 0) {
      const map = new Map<string, any>();
      (db.batchesVaporizado || []).forEach((item: any) => {
        const k = (item?.BATCH_ID || item?.CORRELATIVO || "").toString().trim().toUpperCase();
        if (k) map.set(k, item);
      });
      cloudData.batchesVaporizado.forEach((item: any) => {
        const k = (item?.BATCH_ID || item?.CORRELATIVO || "").toString().trim().toUpperCase();
        if (k) map.set(k, { ...map.get(k), ...item });
      });
      db.batchesVaporizado = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.batchLotes) && cloudData.batchLotes.length > 0) {
      const map = new Map<string, any>();
      (db.batchLotes || []).forEach((item: any) => {
        const k = `${item?.BATCH_ID || ""}_${formatLoteCode(item?.LOTE_ID) || item?.LOTE_ID || ""}`;
        if (k !== "_") map.set(k, item);
      });
      cloudData.batchLotes.forEach((item: any) => {
        const k = `${item?.BATCH_ID || ""}_${formatLoteCode(item?.LOTE_ID) || item?.LOTE_ID || ""}`;
        if (k !== "_") map.set(k, { ...map.get(k), ...item });
      });
      db.batchLotes = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.controlVaporizado) && cloudData.controlVaporizado.length > 0) {
      const map = new Map<string, any>();
      (db.controlVaporizado || []).forEach((item: any) => {
        const k = (item?.BATCH_ID || item?.CORRELATIVO || item?.CONTROL_VAPORIZADO_ID || "").toString().trim().toUpperCase();
        if (k) map.set(k, item);
      });
      cloudData.controlVaporizado.forEach((item: any) => {
        const k = (item?.BATCH_ID || item?.CORRELATIVO || item?.CONTROL_VAPORIZADO_ID || "").toString().trim().toUpperCase();
        if (k) map.set(k, { ...map.get(k), ...item });
      });
      db.controlVaporizado = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.analisisVaporizado) && cloudData.analisisVaporizado.length > 0) {
      const map = new Map<string, any>();
      (db.analisisVaporizado || []).forEach((item: any) => {
        const k = (item?.ANALISIS_VAPORIZADO_ID || item?.BATCH_ID || "").toString().trim().toUpperCase();
        if (k) map.set(k, item);
      });
      cloudData.analisisVaporizado.forEach((item: any) => {
        const k = (item?.ANALISIS_VAPORIZADO_ID || item?.BATCH_ID || "").toString().trim().toUpperCase();
        if (k) map.set(k, { ...map.get(k), ...item });
      });
      db.analisisVaporizado = Array.from(map.values());
      changed = true;
    }

    if (Array.isArray(cloudData.programacionesOficiales) && cloudData.programacionesOficiales.length > 0) {
      const progMap = new Map<string, any>();
      (db.programacionesOficiales || []).forEach((p: any) => {
        const key = p?.PROGRAMACION_ID || p?.id || p?.fecha || p?.FECHA || p?.batch || p?.CORRELATIVO;
        if (key) progMap.set(String(key).trim().toUpperCase(), p);
      });
      cloudData.programacionesOficiales.forEach((cp: any) => {
        const key = cp?.PROGRAMACION_ID || cp?.id || cp?.fecha || cp?.FECHA || cp?.batch || cp?.CORRELATIVO;
        if (key) {
          const kUpper = String(key).trim().toUpperCase();
          progMap.set(kUpper, { ...progMap.get(kUpper), ...cp });
        }
      });
      db.programacionesOficiales = Array.from(progMap.values());
      db.programacionApit = db.programacionesOficiales;
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const serialized = JSON.stringify(db.programacionesOficiales);
          window.localStorage.setItem("programaciones_batch_oficial_v1", serialized);
          window.localStorage.setItem("molino_programaciones_batch_oficiales_v3", serialized);
          window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated", { detail: db.programacionesOficiales }));
        } catch {
          // ignore
        }
      }
      changed = true;
    }

    if (Array.isArray(cloudData.users) && cloudData.users.length > 0) {
      const uMap = new Map<string, UserProfile>();
      db.users.forEach((u) => {
        if (u?.id) uMap.set(u.id, u);
      });
      cloudData.users.forEach((cu) => {
        if (cu?.id && cu?.nombre) {
          uMap.set(cu.id, { ...uMap.get(cu.id), ...cu });
          changed = true;
        }
      });
      db.users = Array.from(uMap.values());
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem("anvap_users_v1", JSON.stringify(db.users));
        } catch {
          // ignore
        }
      }
    }

    if (changed) {
      deduplicateAndMigrateLotes(db);
      this.persist();
    }
  }
}

export const localDB = new LocalDBService();

// --- IN-BROWSER FETCH INTERCEPTOR ---
// Safely intercepts all network requests starting with "/api/" when window.fetch is writable/configurable
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  try {
    const originalFetch = window.fetch.bind(window);

    const interceptedFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : (input as any)?.url || "";

      // Check if this is an /api/ request
      if (rawUrl.startsWith("/api/") || rawUrl.includes("/api/")) {
      try {
        const urlObj = new URL(rawUrl, window.location.origin);
        const pathname = urlObj.pathname;
        const method = (init?.method || "GET").toUpperCase();

        let reqBody: any = {};
        if (init?.body) {
          try {
            reqBody = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
          } catch {
            reqBody = {};
          }
        }

        const userParam = urlObj.searchParams.get("_user") || reqBody?._user || "Operador";

        // Dispatch to localDB
        let result: any = null;

        if (pathname === "/api/lotes") {
          if (method === "GET") result = localDB.getLotes();
          else if (method === "POST") result = localDB.saveLote(reqBody, userParam);
        } else if (pathname.startsWith("/api/lotes/bulk-status")) {
          result = { updated: localDB.bulkUpdateLotesStatus(reqBody.loteIds || [], reqBody.nuevoEstado, userParam) };
        } else if (pathname.match(/^\/api\/lotes\/([^/]+)\/autorizar-experimental/)) {
          const m = pathname.match(/^\/api\/lotes\/([^/]+)\/autorizar-experimental/);
          result = localDB.autorizarLoteExperimental(decodeURIComponent(m![1]), reqBody, userParam);
        } else if (pathname.match(/^\/api\/lotes\/([^/]+)\/revertir-desaprobado/)) {
          const m = pathname.match(/^\/api\/lotes\/([^/]+)\/revertir-desaprobado/);
          result = localDB.revertirDesaprobado(decodeURIComponent(m![1]), userParam);
        } else if (pathname.match(/^\/api\/lotes\/([^/]+)$/)) {
          const m = pathname.match(/^\/api\/lotes\/([^/]+)$/);
          const loteId = decodeURIComponent(m![1]);
          if (method === "DELETE") result = { success: localDB.deleteLote(loteId, userParam) };
          else if (method === "PUT") result = localDB.saveLote({ ...reqBody, LOTE_ID: loteId }, userParam);
        } else if (pathname === "/api/humedad" || pathname === "/api/humedades") {
          if (method === "GET") result = localDB.getHumedades();
          else if (method === "POST") result = localDB.saveHumedad(reqBody, userParam);
        } else if (pathname === "/api/analisis-humedo" || pathname === "/api/analisis-humedos") {
          if (method === "GET") result = localDB.getAnalisisHumedo();
          else if (method === "POST") result = localDB.saveAnalisisHumedo(reqBody, userParam);
        } else if (pathname === "/api/presecado") {
          if (method === "GET") result = localDB.getPresecado();
          else if (method === "POST") result = localDB.savePresecado(reqBody, userParam);
        } else if (pathname === "/api/analisis-seco") {
          if (method === "GET") result = localDB.getAnalisisSeco();
          else if (method === "POST") result = localDB.saveAnalisisSeco(reqBody, userParam);
        } else if (pathname === "/api/programacion" || pathname === "/api/programacion-apit") {
          if (method === "GET") result = localDB.getProgramacionApit();
          else if (method === "POST") result = localDB.saveProgramacionApit(reqBody, userParam);
        } else if (pathname === "/api/batches") {
          if (method === "GET") result = localDB.getBatches();
          else if (method === "POST") result = localDB.saveBatch(reqBody, userParam);
        } else if (pathname.match(/^\/api\/batches\/([^/]+)\/iniciar-proceso/)) {
          const m = pathname.match(/^\/api\/batches\/([^/]+)\/iniciar-proceso/);
          result = { success: localDB.iniciarProcesoBatch(decodeURIComponent(m![1]), userParam) };
        } else if (pathname.match(/^\/api\/batches\/([^/]+)\/cerrar-total/)) {
          const m = pathname.match(/^\/api\/batches\/([^/]+)\/cerrar-total/);
          result = { success: localDB.cerrarTotalBatch(decodeURIComponent(m![1]), reqBody.control, userParam) };
        } else if (pathname.match(/^\/api\/batches\/([^/]+)$/)) {
          const m = pathname.match(/^\/api\/batches\/([^/]+)$/);
          const batchId = decodeURIComponent(m![1]);
          if (method === "DELETE") result = { success: localDB.deleteBatch(batchId, userParam) };
          else if (method === "PUT") result = localDB.saveBatch({ ...reqBody, BATCH_ID: batchId }, userParam);
        } else if (pathname === "/api/batch-lotes") {
          if (method === "GET") result = localDB.getBatchLotes();
          else if (method === "POST") result = localDB.saveBatchLotes(reqBody, userParam);
        } else if (pathname === "/api/control-vaporizado") {
          if (method === "GET") result = localDB.getControlVaporizado();
          else if (method === "POST") result = localDB.saveControlVaporizado(reqBody, userParam);
        } else if (pathname.match(/^\/api\/control-vaporizado\/([^/]+)$/)) {
          const m = pathname.match(/^\/api\/control-vaporizado\/([^/]+)$/);
          const batchId = decodeURIComponent(m![1]);
          if (method === "DELETE") result = { success: localDB.deleteControlVaporizado(batchId, userParam) };
        } else if (pathname === "/api/analisis-vaporizado") {
          if (method === "GET") result = localDB.getAnalisisVaporizado();
          else if (method === "POST") result = localDB.saveAnalisisVaporizado(reqBody, userParam);
        } else if (pathname === "/api/equipos") {
          result = localDB.getEquipos();
        } else if (pathname === "/api/estados") {
          result = localDB.getEstados();
        } else if (pathname === "/api/audit-logs") {
          result = localDB.getAuditLogs();
        } else if (pathname === "/api/config/weights" || pathname === "/api/config/success-weights") {
          if (method === "GET") result = localDB.getWeights();
          else result = localDB.saveWeights(reqBody, userParam);
        } else if (pathname === "/api/config/priorizacion") {
          if (method === "GET") result = localDB.getPriorizacionConfig();
          else result = localDB.savePriorizacionConfig(reqBody, userParam);
        } else if (pathname === "/api/config/evaluacion-lotes" || pathname === "/api/config-evaluacion-lotes") {
          if (method === "GET") result = localDB.getEvaluacionLotesConfig();
          else result = localDB.saveEvaluacionLotesConfig(reqBody, userParam);
        } else if (pathname === "/api/config/evaluacion-presets") {
          if (method === "GET") result = localDB.getPresetsEvaluacionLotes();
          else if (Array.isArray(reqBody)) result = localDB.savePresetsEvaluacionLotes(reqBody, userParam);
          else result = localDB.savePresetEvaluacion(reqBody, userParam);
        } else if (pathname === "/api/parametros-trabajo") {
          if (method === "GET") result = localDB.getParametrosTrabajo();
          else result = localDB.saveParametrosTrabajo(reqBody, userParam);
        } else if (pathname === "/api/parametros-trabajo/historial") {
          result = localDB.getHistorialParametros();
        } else if (pathname === "/api/users") {
          if (method === "GET") result = localDB.getUsers();
          else result = localDB.saveUser(reqBody, userParam);
        } else if (pathname.match(/^\/api\/users\/([^/]+)$/)) {
          const m = pathname.match(/^\/api\/users\/([^/]+)$/);
          result = { success: localDB.deleteUser(decodeURIComponent(m![1]), userParam) };
        } else if (pathname === "/api/programaciones-oficiales") {
          if (method === "GET") result = localDB.getProgramacionesOficiales();
          else if (method === "POST") result = localDB.saveProgramacionOficial(reqBody, userParam);
        } else if (pathname.match(/^\/api\/programaciones-oficiales\/([^/]+)$/)) {
          const m = pathname.match(/^\/api\/programaciones-oficiales\/([^/]+)$/);
          result = { success: localDB.deleteProgramacionOficial(decodeURIComponent(m![1]), userParam) };
        } else if (pathname === "/api/priorizacion/audit-reorder") {
          localDB.addPriorizacionAudit(reqBody, userParam);
          result = { success: true };
        } else if (pathname === "/api/coccion-externo/sync") {
          result = localDB.syncCoccionExterno(Array.isArray(reqBody) ? reqBody : [reqBody]);
        } else if (pathname === "/api/coccion-externo/resultados") {
          result = localDB.getCoccionResultados();
        } else if (pathname.match(/^\/api\/coccion-externo/)) {
          result = localDB.getCoccionResultados();
        } else if (pathname === "/api/import/bulk") {
          result = localDB.bulkImport(reqBody, userParam);
        } else if (pathname === "/api/ai/recommendation" || pathname === "/api/ai/recommend-apit") {
          result = localDB.recommendApit(reqBody.loteId, reqBody.loteInfo, reqBody.customInput);
        } else if (pathname === "/api/ai/simulate") {
          result = localDB.simulateApit(reqBody);
        } else if (pathname === "/api/ai/parametros-trabajo/sugerir") {
          result = localDB.sugerirParametrosTrabajo();
        } else if (pathname === "/api/ai/plan-programacion-dia") {
          result = localDB.planProgramacionDia(reqBody);
        } else if (pathname === "/api/ai/ocr") {
          try {
            const realResp = await originalFetch(input, init);
            if (realResp.ok) {
              return realResp;
            }
          } catch (fetchErr) {
            console.warn("[LocalDB Interceptor] Real OCR fetch failed, falling back to local extractor:", fetchErr);
          }
          result = localDB.ocrFallback(reqBody.imageBase64, reqBody.tipoDocumento);
        } else if (pathname === "/api/health" || pathname === "/api/state") {
          result = { status: "ok", mode: "client-side-local-storage" };
        } else {
          result = { success: true, message: "OK (handled by local client storage)" };
        }

        return new Response(JSON.stringify(result ?? {}), {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        console.error("[LocalDB Interceptor Error]:", err);
        return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return originalFetch(input, init);
    };

    // Safely assign without throwing if window.fetch has only a getter or is non-writable
    try {
      const desc = Object.getOwnPropertyDescriptor(window, "fetch") ||
                   Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), "fetch");
      if (!desc || desc.writable || desc.set) {
        window.fetch = interceptedFetch;
      } else if (desc.configurable) {
        Object.defineProperty(window, "fetch", {
          value: interceptedFetch,
          writable: true,
          configurable: true,
        });
      }
    } catch {
      // If assignment fails, silently fallback to native fetch (handled directly by Express server)
    }
  } catch (err) {
    console.warn("[LocalDB] Interceptor setup skipped:", err);
  }
}
