import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  ControlVaporizado, 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  UserProfile, 
  UserRole, 
  AnalisisVaporizado,
  AnalisisHumedo,
  Presecado,
  AnalisisSeco,
  RegistroHumedad
} from "../types";
import { 
  Gauge, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  Award,
  FileCheck,
  Printer,
  Zap,
  Lock,
  ArrowLeft,
  FileSpreadsheet,
  LineChart,
  Save,
  RefreshCw,
  Check,
  History,
  Scale,
  Clock,
  Microscope,
  AlertCircle
} from "lucide-react";
import { HojaControlVaporizadoOficial } from "./HojaControlVaporizadoOficial";
import { GraficaSecadoMonitoreo } from "./GraficaSecadoMonitoreo";
import { SacasDescargaManager } from "./SacasDescargaManager";
import { DEFAULT_PERFILES_SECADO, getBlankPlantControlRecord, createEmptyParametrosPaddy } from "../utils/plantSheetDefaults";
import { useAutoSaveControlVaporizado } from "../hooks/useAutoSaveControlVaporizado";
import { tienePermiso, obtenerMensajeRestriccion } from "../utils/permisosService";
import { localDB } from "../utils/localDB";
import { 
  cargarProgramacionesOficiales, 
  guardarProgramacionesOficiales, 
  parseBatchSequenceKey,
  ProgramacionBatchOficial 
} from "../utils/programacionBatchOficialService";
import { safeNumVal, parseNumberOrZero, safeNumber } from "../utils/numberUtils";
import { obtenerValoresIngresoBatchDesdeLotes } from "../utils/batchCalculator";
import { compareLoteCodes } from "../utils/formatLoteCode";

interface ControlVaporizadoViewProps {
  controles?: ControlVaporizado[];
  batches?: BatchVaporizado[];
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  analisisHumList?: AnalisisHumedo[];
  presecados?: Presecado[];
  analisisSecList?: AnalisisSeco[];
  humedades?: RegistroHumedad[];
  initialBatchId?: string;
  currentUser?: UserProfile;
  onSaveControl: (ctrl: Partial<ControlVaporizado>) => Promise<void>;
  onNavigate?: (tab: string, filterId?: string) => void;
  onRefreshData?: () => void;
}

export const ControlVaporizadoView: React.FC<ControlVaporizadoViewProps> = ({
  controles = [],
  batches = [],
  batchLotes = [],
  lotes = [],
  analisisHumList = [],
  presecados = [],
  analisisSecList = [],
  humedades = [],
  initialBatchId,
  currentUser = { id: "usr-01", nombre: "Ing. Carlos Morales", email: "carlos@arroz.pe", rol: "JEFE_PLANTA" },
  onSaveControl,
  onNavigate,
  onRefreshData
}) => {
  // Sincronización continua de programaciones oficiales desde el backend y eventos locales
  const [progsOficialesList, setProgsOficialesList] = useState<ProgramacionBatchOficial[]>(() => {
    return cargarProgramacionesOficiales();
  });

  useEffect(() => {
    const updated = cargarProgramacionesOficiales();
    setProgsOficialesList(updated);

    const handleUpdate = () => {
      setProgsOficialesList(cargarProgramacionesOficiales());
    };
    window.addEventListener("programaciones-oficiales-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("programaciones-oficiales-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [batches, lotes]);

  // Clasificación separada de Batches:
  // 1. batchesProgramadosActivos: SOLO los batches que han sido programados y están activos (NO cerrados), ordenados de arriba hacia abajo.
  // 2. batchesCerradosHistorial: Los batches que ya han sido cerrados (CERRADO / TERMINADO), para la lista "Historial de Batch".
  const { batchesProgramadosActivos, batchesCerradosHistorial, allBatches } = useMemo(() => {
    // 1. Cargar todas las programaciones oficiales (activas, archivadas y guardadas en localStorage)
    const progsMap = new Map<string, any>();
    if (Array.isArray(progsOficialesList) && progsOficialesList.length > 0) {
      progsOficialesList.forEach((p) => {
        const k = (p.batch || p.id || "").trim().toUpperCase();
        if (k) progsMap.set(k, p);
      });
    }
    try {
      const officialProgs = cargarProgramacionesOficiales();
      officialProgs.forEach((p) => {
        const k = (p.batch || p.id || "").trim().toUpperCase();
        if (k && !progsMap.has(k)) progsMap.set(k, p);
      });
    } catch {}

    if (typeof window !== "undefined" && window.localStorage) {
      for (const lsKey of ["molino_programaciones_batch_oficiales_v4", "molino_programaciones_batch_oficiales_v3", "programaciones_batch_oficial_v1"]) {
        try {
          const raw = window.localStorage.getItem(lsKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((p: any) => {
                const k = (p.batch || p.id || "").trim().toUpperCase();
                if (k && !progsMap.has(k)) progsMap.set(k, p);
              });
            }
          }
        } catch {}
      }
    }
    const allProgs = Array.from(progsMap.values());

    // 2. Batches en memoria y en base de datos local
    const dbBatches = localDB.getBatches() || [];
    const dbControles = localDB.getControlVaporizado() || [];
    const combinedRawBatches = [...batches];

    const addBatchIfMissing = (rawB: Partial<BatchVaporizado>, defaultState: string = "PROGRAMADO") => {
      const k1 = (rawB.CORRELATIVO || "").trim().toUpperCase();
      const k2 = (rawB.BATCH_ID || "").trim().toUpperCase();
      if (!k1 && !k2) return;
      const exists = combinedRawBatches.some((b) => {
        const b1 = (b.CORRELATIVO || "").trim().toUpperCase();
        const b2 = (b.BATCH_ID || "").trim().toUpperCase();
        return (k1 && (b1 === k1 || b2 === k1)) || (k2 && (b1 === k2 || b2 === k2));
      });
      if (!exists) {
        combinedRawBatches.push({
          BATCH_ID: rawB.BATCH_ID || rawB.CORRELATIVO || k1 || k2,
          CORRELATIVO: rawB.CORRELATIVO || rawB.BATCH_ID || k1 || k2,
          FECHA_PROGRAMADA: rawB.FECHA_PROGRAMADA || new Date().toISOString().split("T")[0],
          EQUIPO: rawB.EQUIPO || "APIT",
          ESTADO_BATCH: (rawB.ESTADO_BATCH as any) || defaultState,
          TON_PROGRAMADAS: rawB.TON_PROGRAMADAS || 18,
          TON_PROCESADAS: rawB.TON_PROCESADAS || 18,
          PESO_TOTAL_KG: rawB.PESO_TOTAL_KG || 18000,
          CLIENTE: rawB.CLIENTE || "MOLINO SAN PEDRO S.A.C.",
          VARIEDAD: rawB.VARIEDAD || "TINAJONES",
          TURNO: rawB.TURNO || "Turno Día",
          OPERADOR: rawB.OPERADOR || "Pedro Huamán",
          OBSERVACIONES: rawB.OBSERVACIONES || "",
          ...rawB
        } as BatchVaporizado);
      }
    };

    dbBatches.forEach((b) => addBatchIfMissing(b));

    // Agregar batches que ya tienen ficha guardada o liquidada en dbControles (ej: V366, V368)
    dbControles.forEach((c) => {
      const bCode = (c.BATCH_ID || c.CORRELATIVO || "").trim();
      if (bCode) {
        const isLiq = Boolean(c.liquidado) || c.ESTADO_PROCESO === "LIQUIDADO" || c.ESTADO_PROCESO === "VAPORIZADO";
        addBatchIfMissing({
          BATCH_ID: bCode,
          CORRELATIVO: c.CORRELATIVO || bCode,
          CLIENTE: c.CLIENTE || (c.datosIngreso as any)?.cliente,
          VARIEDAD: c.VARIEDAD || c.datosIngreso?.variedad,
          ESTADO_BATCH: isLiq ? "VAPORIZADO" : ((c.ESTADO_PROCESO as any) || "CERRADO"),
          cerroCompletamente: Boolean((c as any).cerroCompletamente || isLiq),
          liquidado: Boolean(isLiq),
          PESO_TOTAL_KG: c.datosIngreso?.pesoKg || (c.TON_PROCESADAS ? c.TON_PROCESADAS * 1000 : 18000)
        } as any, "VAPORIZADO");
      }
    });

    if (Array.isArray(controles)) {
      controles.forEach((c) => {
        const bCode = (c.BATCH_ID || c.CORRELATIVO || "").trim();
        if (bCode) {
          const isLiq = Boolean(c.liquidado) || c.ESTADO_PROCESO === "LIQUIDADO" || c.ESTADO_PROCESO === "VAPORIZADO";
          addBatchIfMissing({
            BATCH_ID: bCode,
            CORRELATIVO: c.CORRELATIVO || bCode,
            CLIENTE: c.CLIENTE || (c.datosIngreso as any)?.cliente,
            VARIEDAD: c.VARIEDAD || c.datosIngreso?.variedad,
            ESTADO_BATCH: isLiq ? "VAPORIZADO" : ((c.ESTADO_PROCESO as any) || "CERRADO"),
            cerroCompletamente: Boolean((c as any).cerroCompletamente || isLiq),
            liquidado: Boolean(isLiq),
            PESO_TOTAL_KG: c.datosIngreso?.pesoKg || (c.TON_PROCESADAS ? c.TON_PROCESADAS * 1000 : 18000)
          } as any, "VAPORIZADO");
        }
      });
    }

    // Escanear borradores en localStorage (ej: apit_draft_ctrl_V366, apit_draft_ctrl_V368)
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith("apit_draft_ctrl_")) {
            const rawCode = key.replace("apit_draft_ctrl_", "").trim();
            if (rawCode && rawCode !== "undefined" && rawCode !== "null") {
              let draftObj: any = null;
              try {
                draftObj = JSON.parse(window.localStorage.getItem(key) || "{}");
              } catch {}
              const isLiq = Boolean(draftObj?.liquidado) || draftObj?.ESTADO_PROCESO === "LIQUIDADO" || draftObj?.ESTADO_PROCESO === "VAPORIZADO";
              addBatchIfMissing({
                BATCH_ID: rawCode,
                CORRELATIVO: draftObj?.CORRELATIVO || rawCode,
                CLIENTE: draftObj?.CLIENTE || draftObj?.datosIngreso?.cliente,
                VARIEDAD: draftObj?.VARIEDAD || draftObj?.datosIngreso?.variedad,
                ESTADO_BATCH: isLiq ? "VAPORIZADO" : (draftObj?.ESTADO_PROCESO || "CERRADO"),
                cerroCompletamente: Boolean(draftObj?.cerroCompletamente || isLiq),
                liquidado: Boolean(isLiq)
              } as any, "CERRADO");
            }
          }
        }
      } catch {}
    }

    const isClosedState = (est?: string, cerroComp?: boolean, liquidado?: boolean) => {
      if (cerroComp || liquidado) return true;
      const s = (est || "").toString().trim().toUpperCase();
      return (
        s === "CERRADO" ||
        s === "TERMINADO" ||
        s === "FINALIZADO" ||
        s === "COMPLETADO" ||
        s === "VAPORIZADO" ||
        s === "LIQUIDADO" ||
        s === "ANALISIS_FINAL" ||
        s === "EVALUADO"
      );
    };

    const closedKeys = new Set<string>();
    combinedRawBatches.forEach((b) => {
      const k1 = (b.CORRELATIVO || "").trim().toUpperCase();
      const k2 = (b.BATCH_ID || "").trim().toUpperCase();
      const bLotes = batchLotes.filter((bl) => {
        const blId = (bl.BATCH_ID || "").trim().toUpperCase();
        return (k1 && blId === k1) || (k2 && blId === k2);
      });
      const allLotesClosed =
        bLotes.length > 0 &&
        bLotes.every((bl) => {
          const foundLote = lotes.find((l) => l.LOTE_ID === bl.LOTE_ID);
          const lEst = (foundLote?.ESTADO_LOTE || "").toString().trim().toUpperCase();
          return lEst === "CERRADO" || Boolean((foundLote as any)?.cerroCompletamente);
        });

      if (isClosedState(b.ESTADO_BATCH, (b as any).cerroCompletamente, (b as any).liquidado) || allLotesClosed) {
        if (k1) closedKeys.add(k1);
        if (k2) closedKeys.add(k2);
      }
    });

    [...dbControles, ...(controles || [])].forEach((c) => {
      const est = (c?.ESTADO_PROCESO || "").toString().trim().toUpperCase();
      if (c?.liquidado || (c as any)?.cerroCompletamente || isClosedState(est)) {
        if (c.BATCH_ID) closedKeys.add(c.BATCH_ID.trim().toUpperCase());
        if (c.CORRELATIVO) closedKeys.add(c.CORRELATIVO.trim().toUpperCase());
      }
    });

    const activeMap = new Map<string, BatchVaporizado>();
    const closedMap = new Map<string, BatchVaporizado>();

    // 1. Clasificar programaciones oficiales
    allProgs.forEach((p, idx) => {
      const bCode = (p.batch || p.id || `V${200 + idx}`).trim();
      const bKey = bCode.toUpperCase();
      const isProgClosed = isClosedState(p.estado, (p as any).cerroCompletamente, (p as any).liquidado) || closedKeys.has(bKey);
      const batchItem: BatchVaporizado = {
        BATCH_ID: bCode,
        CORRELATIVO: bCode,
        FECHA_PROGRAMADA: p.fecha || new Date().toISOString().split("T")[0],
        EQUIPO: "APIT",
        ESTADO_BATCH: isProgClosed ? ((p.estado as any) || "CERRADO") : ((p.estado as any) || "PROGRAMADO"),
        TON_PROGRAMADAS: (p.pesoTotalKg || 18000) / 1000,
        TON_PROCESADAS: (p.pesoTotalKg || 18000) / 1000,
        PESO_TOTAL_KG: p.pesoTotalKg || 18000,
        CLIENTE: p.clientePrincipal || "MOLINO SAN PEDRO S.A.C.",
        VARIEDAD: p.variedadPrincipal || "TINAJONES",
        TURNO: p.turno === "DIA" ? "Turno Día" : "Turno Noche",
        OPERADOR: "Pedro Huamán",
        OBSERVACIONES: p.observacion || "",
        ...(isProgClosed ? { cerroCompletamente: true } : {})
      };

      if (isProgClosed) {
        closedMap.set(bKey, batchItem);
      } else {
        activeMap.set(bKey, batchItem);
      }
    });

    // 2. Clasificar batches combinados en activos (programados) vs historial (cerrados/guardados)
    combinedRawBatches.forEach((b) => {
      const key1 = (b.CORRELATIVO || "").trim().toUpperCase();
      const key2 = (b.BATCH_ID || "").trim().toUpperCase();
      const primaryKey = key1 || key2;
      if (!primaryKey) return;

      const isClosed =
        isClosedState(b.ESTADO_BATCH, (b as any).cerroCompletamente, (b as any).liquidado) ||
        (key1 && closedKeys.has(key1)) ||
        (key2 && closedKeys.has(key2));

      if (isClosed) {
        // Asegurar que no quede en activos
        if (key1) activeMap.delete(key1);
        if (key2) activeMap.delete(key2);

        const bLotes = batchLotes.filter((bl) => {
          const blId = (bl.BATCH_ID || "").trim().toUpperCase();
          return (key1 && blId === key1) || (key2 && blId === key2);
        });
        const firstLoteObj = bLotes.length > 0 ? lotes.find((l) => l.LOTE_ID === bLotes[0].LOTE_ID) : undefined;
        const sumKg = bLotes.reduce((acc, bl) => acc + (Number(bl.PESO_KG) || 0), 0);

        const existingClosed = (key1 && closedMap.get(key1)) || (key2 && closedMap.get(key2));
        closedMap.set(primaryKey, {
          ...(existingClosed || {}),
          ...b,
          BATCH_ID: b.BATCH_ID || b.CORRELATIVO || primaryKey,
          CORRELATIVO: b.CORRELATIVO || b.BATCH_ID || primaryKey,
          ESTADO_BATCH: b.ESTADO_BATCH || "CERRADO",
          CLIENTE: b.CLIENTE || bLotes[0]?.CLIENTE || firstLoteObj?.CLIENTE || existingClosed?.CLIENTE || "MOLINO SAN PEDRO S.A.C.",
          VARIEDAD: b.VARIEDAD || bLotes[0]?.VARIEDAD || firstLoteObj?.VARIEDAD || existingClosed?.VARIEDAD || "TINAJONES",
          PESO_TOTAL_KG: b.PESO_TOTAL_KG || (b as any).TOTAL_PESO_KG || sumKg || existingClosed?.PESO_TOTAL_KG || 18000
        });
      } else {
        const existingActive = (key1 && activeMap.get(key1)) || (key2 && activeMap.get(key2));
        if (existingActive) {
          activeMap.set((existingActive.CORRELATIVO || existingActive.BATCH_ID).toUpperCase(), {
            ...existingActive,
            ...b,
            ESTADO_BATCH: b.ESTADO_BATCH || existingActive.ESTADO_BATCH
          });
        } else {
          activeMap.set(primaryKey, b);
        }
      }
    });

    const sortBySequenceTopDown = (list: BatchVaporizado[]) => {
      return [...list].sort((a, b) => {
        const seqA = parseBatchSequenceKey(a.CORRELATIVO || a.BATCH_ID);
        const seqB = parseBatchSequenceKey(b.CORRELATIVO || b.BATCH_ID);
        if (seqA.mainNum !== seqB.mainNum) return seqA.mainNum - seqB.mainNum;
        if (seqA.subNum !== seqB.subNum) return seqA.subNum - seqB.subNum;
        return (a.FECHA_PROGRAMADA || "").localeCompare(b.FECHA_PROGRAMADA || "");
      });
    };

    const sortedActivos = sortBySequenceTopDown(Array.from(activeMap.values()));
    const sortedCerrados = sortBySequenceTopDown(Array.from(closedMap.values()));

    return {
      batchesProgramadosActivos: sortedActivos,
      batchesCerradosHistorial: sortedCerrados,
      allBatches: [...sortedActivos, ...sortedCerrados]
    };
  }, [batches, progsOficialesList, batchLotes, lotes, controles]);

  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => {
    if (initialBatchId) return initialBatchId;
    try {
      const lastSavedBatch = localStorage.getItem("apit_last_selected_batch_ctrl");
      if (lastSavedBatch) {
        const lastUpper = lastSavedBatch.trim().toUpperCase();
        const matchActive = batchesProgramadosActivos.find(
          (b) =>
            b.BATCH_ID.toUpperCase() === lastUpper ||
            (b.CORRELATIVO && b.CORRELATIVO.toUpperCase() === lastUpper)
        );
        if (matchActive) return matchActive.BATCH_ID;

        const matchClosed = batchesCerradosHistorial.find(
          (b) =>
            b.BATCH_ID.toUpperCase() === lastUpper ||
            (b.CORRELATIVO && b.CORRELATIVO.toUpperCase() === lastUpper)
        );
        if (matchClosed) return matchClosed.BATCH_ID;
      }
    } catch {
      // ignore storage errors
    }
    return batchesProgramadosActivos[0]?.BATCH_ID || batchesCerradosHistorial[0]?.BATCH_ID || "";
  });

  // Si aún no hay ningún batch seleccionado, seleccionar el primero disponible
  useEffect(() => {
    if (!selectedBatchId) {
      if (batchesProgramadosActivos.length > 0) {
        setSelectedBatchId(batchesProgramadosActivos[0].BATCH_ID);
      } else if (batchesCerradosHistorial.length > 0) {
        setSelectedBatchId(batchesCerradosHistorial[0].BATCH_ID);
      }
    }
  }, [batchesProgramadosActivos, batchesCerradosHistorial, selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId) {
      try {
        localStorage.setItem("apit_last_selected_batch_ctrl", selectedBatchId);
      } catch {
        // ignore storage errors
      }
    }
  }, [selectedBatchId]);

  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) {
      return batchesProgramadosActivos[0] || batchesCerradosHistorial[0] || undefined;
    }
    const sIdUpper = selectedBatchId.trim().toUpperCase();
    const cleanSId = sIdUpper.replace(/[^A-Z0-9]/g, "");
    return (
      allBatches.find((b) => {
        const bId = (b.BATCH_ID || "").trim().toUpperCase();
        const bCorr = (b.CORRELATIVO || "").trim().toUpperCase();
        if (bId === sIdUpper || bCorr === sIdUpper) return true;
        const cleanBId = bId.replace(/[^A-Z0-9]/g, "");
        const cleanBCorr = bCorr.replace(/[^A-Z0-9]/g, "");
        return Boolean(cleanSId && (cleanBId === cleanSId || cleanBCorr === cleanSId));
      }) ||
      batchesProgramadosActivos[0] ||
      batchesCerradosHistorial[0] ||
      undefined
    );
  }, [allBatches, batchesProgramadosActivos, batchesCerradosHistorial, selectedBatchId]);

  const isSelectedFromActive = useMemo(() => {
    if (!selectedBatch) return false;
    const tId = (selectedBatch.BATCH_ID || "").toUpperCase();
    const tCorr = (selectedBatch.CORRELATIVO || "").toUpperCase();
    return batchesProgramadosActivos.some(
      (b) =>
        b.BATCH_ID.toUpperCase() === tId ||
        (b.CORRELATIVO && b.CORRELATIVO.toUpperCase() === tCorr)
    );
  }, [selectedBatch, batchesProgramadosActivos]);

  const isSelectedFromHistorial = useMemo(() => {
    if (!selectedBatch) return false;
    const tId = (selectedBatch.BATCH_ID || "").toUpperCase();
    const tCorr = (selectedBatch.CORRELATIVO || "").toUpperCase();
    return batchesCerradosHistorial.some(
      (b) =>
        b.BATCH_ID.toUpperCase() === tId ||
        (b.CORRELATIVO && b.CORRELATIVO.toUpperCase() === tCorr)
    );
  }, [selectedBatch, batchesCerradosHistorial]);

  const resolveSavedControl = useCallback((targetBatchIdStr?: string, targetCorrStr?: string): ControlVaporizado | undefined => {
    const tId = (targetBatchIdStr || selectedBatchId || "").trim().toUpperCase();
    const tBatch = (selectedBatch?.BATCH_ID || tId).trim().toUpperCase();
    const tCorr = (targetCorrStr || selectedBatch?.CORRELATIVO || tBatch).trim().toUpperCase();
    if (!tId && !tBatch && !tCorr) return undefined;

    const cleanAlpha = (s?: string) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cleanNum = (s?: string) => (s || "").toString().replace(/\D/g, "");

    const targets = [tId, tBatch, tCorr].filter(Boolean);

    const matchesCtrl = (c?: Partial<ControlVaporizado> | null) => {
      if (!c) return false;
      const cId = (c.BATCH_ID || "").trim().toUpperCase();
      const cCorr = (c.CORRELATIVO || "").trim().toUpperCase();
      const cCod = (c.datosIngreso?.codigo || "").trim().toUpperCase();
      const cInterno = ((c as any).CODIGO_INTERNO || "").trim().toUpperCase();

      const candidates = [cId, cCorr, cCod, cInterno].filter(Boolean);

      for (const t of targets) {
        if (candidates.includes(t)) return true;
        const cleanT = cleanAlpha(t);
        const numT = cleanNum(t);
        for (const cand of candidates) {
          const cleanC = cleanAlpha(cand);
          if (cleanT && cleanC && cleanT === cleanC) return true;
          const numC = cleanNum(cand);
          if (numT && numC && numT === numC && numT.length >= 2) return true;
        }
      }
      return false;
    };

    const fromProps = controles.find(matchesCtrl);
    const fromDb = (localDB.getControlVaporizado() || []).find(matchesCtrl);

    let fromDraft: Partial<ControlVaporizado> | undefined;
    try {
      const draftKeys = Array.from(new Set([
        `apit_draft_ctrl_${targetBatchIdStr || selectedBatchId || ""}`,
        `apit_draft_ctrl_${tId}`,
        `apit_draft_ctrl_${tBatch}`,
        `apit_draft_ctrl_${targetCorrStr || selectedBatch?.CORRELATIVO || ""}`,
        `apit_draft_ctrl_${tCorr}`,
        `apit_draft_ctrl_${cleanAlpha(tId)}`,
        `apit_draft_ctrl_${cleanAlpha(tBatch)}`
      ]));
      for (const key of draftKeys) {
        if (!key || key === "apit_draft_ctrl_") continue;
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && matchesCtrl(parsed)) {
              fromDraft = parsed;
              break;
            }
          } catch {}
        }
      }

      if (!fromDraft && typeof window !== "undefined" && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith("apit_draft_ctrl_")) {
            const raw = window.localStorage.getItem(k);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object" && matchesCtrl(parsed)) {
                  fromDraft = parsed;
                  break;
                }
              } catch {}
            }
          }
        }
      }
    } catch {
      // ignore parse errors
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
  }, [controles, selectedBatchId, selectedBatch]);

  const existingControl = useMemo(() => {
    return resolveSavedControl(selectedBatch?.BATCH_ID || selectedBatchId, selectedBatch?.CORRELATIVO);
  }, [resolveSavedControl, selectedBatch, selectedBatchId]);

  // Associated batch lotes and client resolution across Programaciones Oficiales, BatchLotes, and Raw Batches
  const associatedBatchLotes = useMemo(() => {
    const targetId = (selectedBatch?.BATCH_ID || selectedBatchId || "").toUpperCase();
    const targetCorr = (selectedBatch?.CORRELATIVO || "").toUpperCase();
    const cleanTargetId = targetId.replace(/[^A-Z0-9]/g, "");
    const cleanTargetCorr = targetCorr.replace(/[^A-Z0-9]/g, "");

    // 1. Check in Programaciones Oficiales (donde filasLote contiene los lotes exactos asignados y sus parámetros)
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const progMatch = progs.find(p => {
      const pB = (p.batch || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const pId = (p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      return (cleanTargetId && (pB === cleanTargetId || pId === cleanTargetId)) ||
             (cleanTargetCorr && (pB === cleanTargetCorr || pId === cleanTargetCorr));
    });

    if (progMatch && progMatch.filasLote && progMatch.filasLote.length > 0) {
      return progMatch.filasLote.map(f => {
        const foundLote = lotes.find(l => compareLoteCodes(l.LOTE_ID, f.loteId) || l.LOTE_ID === f.loteId);
        return {
          BATCH_ID: progMatch.batch || targetId,
          LOTE_ID: f.loteId,
          SACOS: f.sacProg || f.sacos || foundLote?.SACOS || 0,
          PESO_KG: f.pesoProg || f.peso || foundLote?.PESO_KG || 0,
          CLIENTE: f.cliente || progMatch.clientePrincipal || foundLote?.CLIENTE || "",
          VARIEDAD: f.variedad || progMatch.variedadPrincipal || foundLote?.VARIEDAD || "",
          UBICACION: foundLote?.PROCEDENCIA || foundLote?.UBICACION || foundLote?.ZONA || (f as any).ubicacion || "",
          ph: f.ph ?? foundLote?.HUM ?? foundLote?.HUMEDAD,
          blInt: f.blInt,
          blBlanco: f.blBlanco,
          qi: f.qi,
          qb: f.qb,
          tt: f.tt,
          tp: f.tp,
          tpun: f.tpun,
          m: f.m,
          triz: f.triz
        };
      });
    }

    // 2. Check if selectedBatch has filasLote preserved (from closed programación)
    if ((selectedBatch as any)?.filasLote && Array.isArray((selectedBatch as any).filasLote) && (selectedBatch as any).filasLote.length > 0) {
      return (selectedBatch as any).filasLote.map((f: any) => {
        const foundLote = lotes.find(l => compareLoteCodes(l.LOTE_ID, f.loteId) || l.LOTE_ID === f.loteId);
        return {
          BATCH_ID: selectedBatch?.BATCH_ID || targetId,
          LOTE_ID: f.loteId,
          SACOS: f.sacProg || f.sacos || foundLote?.SACOS || 0,
          PESO_KG: f.pesoProg || f.peso || foundLote?.PESO_KG || 0,
          CLIENTE: f.cliente || selectedBatch?.CLIENTE || foundLote?.CLIENTE || "",
          VARIEDAD: f.variedad || selectedBatch?.VARIEDAD || foundLote?.VARIEDAD || "",
          UBICACION: foundLote?.PROCEDENCIA || foundLote?.UBICACION || foundLote?.ZONA || (f as any).ubicacion || "",
          ph: f.ph ?? foundLote?.HUM ?? foundLote?.HUMEDAD,
          blInt: f.blInt,
          blBlanco: f.blBlanco,
          qi: f.qi,
          qb: f.qb,
          tt: f.tt,
          tp: f.tp,
          tpun: f.tpun,
          m: f.m,
          triz: f.triz
        };
      });
    }

    // 3. Check in batchLotes table from backend
    const fromBatchLotes = batchLotes.filter((bl) => {
      const bId = (bl.BATCH_ID || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      return (cleanTargetId && bId === cleanTargetId) || (cleanTargetCorr && bId === cleanTargetCorr);
    });

    if (fromBatchLotes.length > 0) {
      return fromBatchLotes.map(bl => {
        const foundLote = lotes.find(l => compareLoteCodes(l.LOTE_ID, bl.LOTE_ID) || l.LOTE_ID === bl.LOTE_ID);
        const unitWeight = (foundLote?.PESO_KG && foundLote?.SACOS && Number(foundLote.SACOS) > 0)
          ? (Number(foundLote.PESO_KG) / Number(foundLote.SACOS))
          : 50;
        const sacos = bl.SACOS || (bl.PESO_KG ? Math.round(bl.PESO_KG / unitWeight) : (foundLote?.SACOS || 0));
        const pesoKg = bl.PESO_KG || (sacos > 0 ? Math.round(sacos * unitWeight) : (foundLote?.PESO_KG || 0));
        return {
          ...bl,
          SACOS: sacos,
          PESO_KG: pesoKg,
          CLIENTE: foundLote?.CLIENTE || bl.CLIENTE || selectedBatch?.CLIENTE || "",
          VARIEDAD: foundLote?.VARIEDAD || bl.VARIEDAD || selectedBatch?.VARIEDAD || "",
          UBICACION: foundLote?.PROCEDENCIA || foundLote?.UBICACION || foundLote?.ZONA || (bl as any).UBICACION || ""
        };
      });
    }

    // 4. Check if selectedBatch has assigned lotes array
    if ((selectedBatch as any)?.lotesAsignados && Array.isArray((selectedBatch as any).lotesAsignados)) {
      return (selectedBatch as any).lotesAsignados.map((l: any) => {
        const lid = typeof l === "string" ? l : (l.LOTE_ID || l.loteId);
        const foundLote = lotes.find((lo) => compareLoteCodes(lo.LOTE_ID, lid) || lo.LOTE_ID === lid);
        return {
          BATCH_ID: targetId,
          LOTE_ID: lid,
          SACOS: typeof l === "object" ? (l.SACOS || l.sacos || foundLote?.SACOS || 0) : (foundLote?.SACOS || 0),
          PESO_KG: typeof l === "object" ? (l.PESO_KG || l.pesoKg || foundLote?.PESO_KG || 0) : (foundLote?.PESO_KG || 0),
          CLIENTE: typeof l === "object" ? (l.CLIENTE || l.cliente || foundLote?.CLIENTE || selectedBatch?.CLIENTE || "") : (foundLote?.CLIENTE || selectedBatch?.CLIENTE || ""),
          VARIEDAD: typeof l === "object" ? (l.VARIEDAD || l.variedad || foundLote?.VARIEDAD || selectedBatch?.VARIEDAD || "") : (foundLote?.VARIEDAD || selectedBatch?.VARIEDAD || ""),
          UBICACION: foundLote?.PROCEDENCIA || foundLote?.UBICACION || foundLote?.ZONA || ""
        };
      });
    }

    // 5. Check if selectedBatch has LOTES_UNION (array of lote IDs)
    if (selectedBatch?.LOTES_UNION && Array.isArray(selectedBatch.LOTES_UNION) && selectedBatch.LOTES_UNION.length > 0) {
      return selectedBatch.LOTES_UNION.map((loteId) => {
        const foundLote = lotes.find((l) => compareLoteCodes(l.LOTE_ID, loteId) || l.LOTE_ID === loteId);
        return {
          BATCH_ID: targetId,
          LOTE_ID: loteId,
          SACOS: foundLote?.SACOS || 0,
          PESO_KG: foundLote?.PESO_KG || 0,
          CLIENTE: foundLote?.CLIENTE || selectedBatch?.CLIENTE || "",
          VARIEDAD: foundLote?.VARIEDAD || selectedBatch?.VARIEDAD || "",
          UBICACION: foundLote?.PROCEDENCIA || foundLote?.UBICACION || foundLote?.ZONA || ""
        };
      });
    }

    // 6. Check if selectedBatch has single LOTE_ID
    if (selectedBatch?.LOTE_ID) {
      const foundLote = lotes.find((l) => compareLoteCodes(l.LOTE_ID, selectedBatch.LOTE_ID) || l.LOTE_ID === selectedBatch.LOTE_ID);
      return [{
        BATCH_ID: targetId,
        LOTE_ID: selectedBatch.LOTE_ID,
        SACOS: foundLote?.SACOS || selectedBatch.TOTAL_SACOS || 0,
        PESO_KG: foundLote?.PESO_KG || selectedBatch.PESO_TOTAL_KG || 0,
        CLIENTE: foundLote?.CLIENTE || selectedBatch?.CLIENTE || "",
        VARIEDAD: foundLote?.VARIEDAD || selectedBatch?.VARIEDAD || "",
        UBICACION: foundLote?.PROCEDENCIA || foundLote?.UBICACION || foundLote?.ZONA || ""
      }];
    }

    return [];
  }, [batchLotes, selectedBatchId, selectedBatch, progsOficialesList, lotes]);

  // Cálculo canónico y centralizado de los 7 valores oficiales del Batch y sus Lotes MP:
  // CLIENTE, PROCEDENCIA, PESO TOTAL, Nº SACOS, PESO, VARIEDAD, % HUMEDAD
  const valoresBatchCalculados = useMemo(() => {
    return obtenerValoresIngresoBatchDesdeLotes({
      targetBatch: selectedBatch,
      batchCode: selectedBatch?.BATCH_ID || selectedBatchId || "",
      allLotes: lotes,
      allBatchLotes: batchLotes,
      allHumedades: humedades,
      allAnalisisHumedo: analisisHumList,
      allProgramaciones: progsOficialesList
    });
  }, [selectedBatch, selectedBatchId, lotes, batchLotes, humedades, analisisHumList, progsOficialesList]);

  const batchClientName = useMemo(() => {
    return valoresBatchCalculados.cliente;
  }, [valoresBatchCalculados]);

  const batchVariedad = useMemo(() => {
    return valoresBatchCalculados.variedad;
  }, [valoresBatchCalculados]);

  // Compute reception data and initial paddy averages from assigned lotes & programacion oficial
  const batchPaddyReceptionData = useMemo(() => {
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const targetId = (selectedBatch?.BATCH_ID || selectedBatchId || "").toUpperCase();
    const targetCorr = (selectedBatch?.CORRELATIVO || "").toUpperCase();
    const cleanTargetId = targetId.replace(/[^A-Z0-9]/g, "");
    const cleanTargetCorr = targetCorr.replace(/[^A-Z0-9]/g, "");

    const progMatch = progs.find(p => {
      const pB = (p.batch || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const pId = (p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      return (cleanTargetId && (pB === cleanTargetId || pId === cleanTargetId)) ||
             (cleanTargetCorr && (pB === cleanTargetCorr || pId === cleanTargetCorr));
    });

    const rawLotes = (associatedBatchLotes.length > 0 ? associatedBatchLotes : (progMatch?.filasLote || []).map(f => ({
      BATCH_ID: progMatch?.batch || targetId,
      LOTE_ID: f.loteId,
      SACOS: f.sacProg || (f as any).sacos || 0,
      PESO_KG: f.pesoProg || (f as any).peso || 0,
      CLIENTE: f.cliente || progMatch?.clientePrincipal,
      VARIEDAD: f.variedad || progMatch?.variedadPrincipal,
      UBICACION: (f as any).ubicacion,
      ph: f.ph,
      blInt: f.blInt,
      blBlanco: f.blBlanco,
      qi: f.qi,
      qb: f.qb,
      tt: f.tt,
      tp: f.tp,
      tpun: f.tpun,
      m: f.m,
      triz: f.triz
    }))).map(bl => {
      const found = lotes.find(l => compareLoteCodes(l.LOTE_ID, bl.LOTE_ID) || l.LOTE_ID === bl.LOTE_ID);
      const anHum = (analisisHumList || []).find(a => compareLoteCodes(a.LOTE_ID, bl.LOTE_ID) || a.LOTE_ID === bl.LOTE_ID);
      const pre = (presecados || []).find(p => compareLoteCodes(p.LOTE_ID, bl.LOTE_ID) || p.LOTE_ID === bl.LOTE_ID);
      const humReg = (humedades || []).find(h => compareLoteCodes(h.LOTE_ID, bl.LOTE_ID) || h.LOTE_ID === bl.LOTE_ID);
      const anSec = (analisisSecList || []).find(s => compareLoteCodes(s.LOTE_ID, bl.LOTE_ID) || s.LOTE_ID === bl.LOTE_ID);

      const unitWeight = (found?.PESO_KG && found?.SACOS && Number(found.SACOS) > 0)
        ? (Number(found.PESO_KG) / Number(found.SACOS))
        : 50;
      const numSacos = bl.SACOS || (bl.PESO_KG ? Math.round(bl.PESO_KG / unitWeight) : (found?.SACOS || 0));
      const peso = bl.PESO_KG || (numSacos > 0 ? Math.round(numSacos * unitWeight) : (found?.PESO_KG || 0));

      const hum = (bl as any).ph ?? anHum?.HUMEDADES ?? pre?.Humedad ?? humReg?.["H. PROMEDIO"] ?? found?.HUM ?? (found as any)?.HUMEDAD ?? 14.0;
      const ri = anHum?.RI ?? pre?.RI ?? (found as any)?.RI ?? (found as any)?.RENDIMIENTO_INTEGRAL ?? 78.4;
      const rb = anHum?.RB ?? pre?.RB ?? (found as any)?.RB ?? (found as any)?.RENDIMIENTO_BLANCO ?? 71.4;
      const q = (bl as any).qb ?? (bl as any).qi ?? anHum?.QB ?? anHum?.QI ?? pre?.QB ?? pre?.QI ?? (found as any)?.GRANO_QUEBRADO ?? 8.7;
      const tt = (bl as any).tt ?? anHum?.TT ?? pre?.TT ?? (found as any)?.TOTAL_DANADOS ?? 1.6;
      const tp = (bl as any).tp ?? anHum?.TP ?? pre?.TP ?? (found as any)?.GRANO_PICADO ?? 2.0;
      const m = (bl as any).m ?? anHum?.M ?? pre?.M ?? (found as any)?.MANCHADOS ?? 0.5;
      const tz = (bl as any).triz ?? anHum?.TZ ?? pre?.TZ ?? (found as any)?.TRIZADO ?? 1.4;
      const gi = (bl as any).gi ?? anHum?.GI ?? pre?.GI ?? (found as any)?.GRANO_INMADURO ?? 0.3;
      const gr = (bl as any).gr ?? anHum?.GR ?? pre?.GR ?? (found as any)?.GRANO_ROJO ?? 0.2;
      const blVal = (bl as any).blInt ?? anHum?.["B.INTEGRAL"] ?? pre?.["B.INTEGRAL"] ?? (found as any)?.BLANCURA_INTEGRAL ?? 21.9;
      const blpVal = (bl as any).blBlanco ?? anHum?.["B. PULIDO"] ?? pre?.["B. PULIDO"] ?? anSec?.Blancura_Final ?? 40.5;
      const remVal = (bl as any).rem ?? anHum?.RM ?? pre?.RM ?? 7.0;

      const ubicacionLote = (bl as any).UBICACION || found?.PROCEDENCIA || found?.UBICACION || found?.ZONA || "";

      return {
        ...found,
        pesoKg: peso,
        sacos: numSacos,
        hum: Number(hum),
        ri: Number(ri),
        rb: Number(rb),
        q: Number(q),
        tt: Number(tt),
        tp: Number(tp),
        m: Number(m),
        tz: Number(tz),
        gi: Number(gi),
        gr: Number(gr),
        blVal: Number(blVal),
        blpVal: Number(blpVal),
        remVal: Number(remVal),
        procedencia: ubicacionLote,
        cliente: bl.CLIENTE || found?.CLIENTE,
        variedad: bl.VARIEDAD || found?.VARIEDAD
      };
    }).filter(Boolean);

    const calcWeighted = (getter: (l: any) => number | undefined, defaultVal: number): number => {
      let weightSum = 0;
      let valSum = 0;
      for (const l of rawLotes) {
        const val = getter(l);
        const w = l.pesoKg || 1;
        if (val !== undefined && !isNaN(val) && val !== null) {
          valSum += Number(val) * w;
          weightSum += w;
        }
      }
      if (weightSum > 0) return parseFloat((valSum / weightSum).toFixed(1));
      return defaultVal;
    };

    const progProm = progMatch?.promedios;
    const progAn = (progMatch as any)?.analisisPromedio;

    return {
      procedencia: valoresBatchCalculados.procedencia,
      totalWeight: valoresBatchCalculados.pesoTotalKg,
      sumSacos: valoresBatchCalculados.numSacos,
      tiempoReposo: "",
      initialPaddy: {
        humedad: valoresBatchCalculados.humedadPct ?? (progProm?.ph !== undefined ? progProm.ph : (selectedBatch?.HUMEDAD_PROMEDIO || 14.0)),
        ri: progAn?.ri !== undefined ? progAn.ri : (progProm as any)?.ri !== undefined ? (progProm as any).ri : calcWeighted(l => l.ri, 78.4),
        rb: progAn?.rb !== undefined ? progAn.rb : (progProm as any)?.rb !== undefined ? (progProm as any).rb : calcWeighted(l => l.rb, 71.4),
        q: progProm?.qb !== undefined ? progProm.qb : (progProm?.qi !== undefined ? progProm.qi : calcWeighted(l => l.q, 8.7)),
        tt: progProm?.tt !== undefined ? progProm.tt : calcWeighted(l => l.tt, 1.6),
        tp: progProm?.tp !== undefined ? progProm.tp : calcWeighted(l => l.tp, 2.0),
        m: progProm?.m !== undefined ? progProm.m : calcWeighted(l => l.m, 0.5),
        tz: progProm?.triz !== undefined ? progProm.triz : calcWeighted(l => l.tz, 1.4),
        gi: (progProm as any)?.gi !== undefined ? (progProm as any).gi : (progAn?.gi !== undefined ? progAn.gi : calcWeighted(l => l.gi, 0.3)),
        gr: (progProm as any)?.gr !== undefined ? (progProm as any).gr : (progAn?.gr !== undefined ? progAn.gr : calcWeighted(l => l.gr, 0.2)),
        bl: progProm?.blInt !== undefined ? progProm.blInt : calcWeighted(l => l.blVal, 21.9),
        blp: progProm?.blBlanco !== undefined ? progProm.blBlanco : calcWeighted(l => l.blpVal, 40.5),
        rem: (progProm as any)?.rem !== undefined ? (progProm as any).rem : (progAn?.rm !== undefined ? progAn.rm : calcWeighted(l => l.remVal, 7.0))
      }
    };
  }, [associatedBatchLotes, lotes, selectedBatch, selectedBatchId, analisisHumList, presecados, humedades, analisisSecList, progsOficialesList, valoresBatchCalculados]);

  // Mode: 1. Official Plant Sheet (Excel match), 2. Drying Trend Graphs, 3. Sacas de Descarga (Big Bag), 4. Historial de Batch (Batches Cerrados)
  const [vistaModo, setVistaModo] = useState<"hoja_oficial" | "graficas_tendencias" | "sacas_descarga" | "historial_batches">("hoja_oficial");

  // Form State for Physical Control (initialized from saved DB/draft record if available, never blanking out existing progress)
  const loadedBatchKeyRef = useRef<string | null>(null);
  const [formData, setFormData] = useState<Partial<ControlVaporizado>>(() => {
    const initTargetId = selectedBatch?.BATCH_ID || initialBatchId || batchesProgramadosActivos[0]?.BATCH_ID || "";
    const initCorr = selectedBatch?.CORRELATIVO || initTargetId;
    const initialBatchObj = selectedBatch || batchesProgramadosActivos[0];
    const initialValores = obtenerValoresIngresoBatchDesdeLotes({
      targetBatch: initialBatchObj,
      batchCode: initTargetId,
      allLotes: lotes,
      allBatchLotes: batchLotes,
      allHumedades: humedades,
      allAnalisisHumedo: analisisHumList,
      allProgramaciones: progsOficialesList
    });

    if (initTargetId) {
      const saved = resolveSavedControl(initTargetId, initCorr);
      if (saved) {
        return {
          ...saved,
          BATCH_ID: initTargetId,
          CORRELATIVO: initCorr,
          CLIENTE: (saved.CLIENTE && !["CLIENTE GENERAL", "MOLINO SAN PEDRO S.A.C.", "Cliente de Producción", "Sin cliente"].includes(saved.CLIENTE.trim())) ? saved.CLIENTE : initialValores.cliente,
          VARIEDAD: (saved.VARIEDAD && saved.VARIEDAD !== "IR-43 MEJORADO" && saved.VARIEDAD.trim() !== "") ? saved.VARIEDAD : initialValores.variedad,
          TON_PROCESADAS: initialValores.pesoTotalKg ? Number((initialValores.pesoTotalKg / 1000).toFixed(1)) : (saved.TON_PROCESADAS || 0),
          HUMEDAD_INGRESO: initialValores.humedadPct ?? saved.HUMEDAD_INGRESO,
          datosIngreso: {
            ...saved.datosIngreso,
            procedencia: (saved.datosIngreso?.procedencia && !["Tolva de Alimentación", "Tolvas de Recepción", "Silo B-01, Silo B-03"].includes(saved.datosIngreso.procedencia.trim())) ? saved.datosIngreso.procedencia : initialValores.procedencia,
            codigo: initCorr,
            numSacos: (saved.datosIngreso?.numSacos && !["300 SACOS", "360 SACOS", "0 SACOS"].includes(saved.datosIngreso.numSacos.trim())) ? saved.datosIngreso.numSacos : initialValores.numSacos,
            pesoKg: (saved.datosIngreso?.pesoKg && saved.datosIngreso.pesoKg > 0 && saved.datosIngreso.pesoKg !== 18000 && saved.datosIngreso.pesoKg !== 45750) ? saved.datosIngreso.pesoKg : initialValores.pesoKg,
            pesoTotalKg: (saved.datosIngreso?.pesoTotalKg && saved.datosIngreso.pesoTotalKg > 0 && saved.datosIngreso.pesoTotalKg !== 18000 && saved.datosIngreso.pesoTotalKg !== 45750) ? saved.datosIngreso.pesoTotalKg : initialValores.pesoTotalKg,
            variedad: (saved.datosIngreso?.variedad && saved.datosIngreso.variedad !== "IR-43 MEJORADO" && saved.datosIngreso.variedad.trim() !== "") ? saved.datosIngreso.variedad : initialValores.variedad,
            humedadPct: saved.datosIngreso?.humedadPct !== undefined ? saved.datosIngreso.humedadPct : initialValores.humedadPct,
            tiempoReposo: saved.datosIngreso?.tiempoReposo || ""
          }
        };
      }
    }
    return getBlankPlantControlRecord(initTargetId, {
      batchCorrelativo: initCorr,
      cliente: initialValores.cliente,
      variedad: initialValores.variedad,
      procedencia: initialValores.procedencia,
      pesoKg: initialValores.pesoKg,
      numSacos: initialValores.numSacos,
      operador: currentUser?.nombre || "Operario de Planta"
    });
  });

  // Form State for Cierre & Liquidación del Batch en Planta
  const [conformidadCierre, setConformidadCierre] = useState<boolean>(false);
  const [conformidadDescarga, setConformidadDescarga] = useState<boolean>(false);
  const [observacionesProceso, setObservacionesProceso] = useState<string>("");

  // Form State for Final Quality Analysis in Lab (retained for backward compatibility if pre-existing)
  const [analisisFinal, setAnalisisFinal] = useState<Partial<AnalisisVaporizado>>({});

  const [dictamenCalidad, setDictamenCalidad] = useState<"CONFORME" | "APROBADO_OBSERVADO" | "NO_CONFORME">("CONFORME");
  const [observacionCierre, setObservacionCierre] = useState<string>("Proceso de vaporizado y secado concluido conforme en planta.");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isClosingBatch, setIsClosingBatch] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Permisos: En Control Vaporizado, operarios de vaporizado, supervisores y jefes pueden Cerrar & Liquidar Batch sin restricción
  const userRole = (currentUser?.rol || "OPERARIO") as UserRole;
  const canCerrarBatch = true;
  const canOperarPiso = tienePermiso(userRole, "operar_autoclave_piso");

  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
    }
  }, [initialBatchId]);

  // Sincronización automática en tiempo real de Datos de Ingreso y Parámetros del Paddy (promedios del batch)
  // Se actualiza automáticamente al montar la vista o cambiar de batch, preservando todos los datos llenados en la ficha.
  useEffect(() => {
    const currentTargetBatchId = selectedBatch?.BATCH_ID || selectedBatchId || "";
    if (!currentTargetBatchId) return;
    const currentCorrelativo = selectedBatch?.CORRELATIVO || currentTargetBatchId;
    const batchKeyNorm = `${currentTargetBatchId.toUpperCase()}::${currentCorrelativo.toUpperCase()}`;
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const progMatch = progs.find(p => 
      (p.batch && p.batch.toUpperCase() === currentTargetBatchId.toUpperCase()) || 
      (p.id && p.id.toUpperCase() === currentTargetBatchId.toUpperCase()) ||
      (p.batch && p.batch.toUpperCase() === currentCorrelativo.toUpperCase())
    );

    const savedControl = resolveSavedControl(currentTargetBatchId, currentCorrelativo) || existingControl;

    setFormData((prev) => {
      const isInitialMountOrBatchSwitch =
        loadedBatchKeyRef.current !== batchKeyNorm ||
        !prev.BATCH_ID ||
        (prev.BATCH_ID.toUpperCase() !== currentTargetBatchId.toUpperCase() &&
          prev.BATCH_ID.toUpperCase() !== currentCorrelativo.toUpperCase());

      const emptyPaddy = createEmptyParametrosPaddy(batchPaddyReceptionData.initialPaddy);

      if (isInitialMountOrBatchSwitch) {
        loadedBatchKeyRef.current = batchKeyNorm;

        if (savedControl) {
          const mergedPaddy = emptyPaddy.map((emptyRow) => {
            const found = savedControl.parametrosPaddy?.find((p) => p.parametro === emptyRow.parametro);
            if (found) {
              const ing = found.ingresoVaporizado !== undefined ? found.ingresoVaporizado : emptyRow.ingresoVaporizado;
              const sal = found.salidaSecadora;
              const newVar = (sal !== undefined && ing !== undefined && !isNaN(sal) && !isNaN(ing))
                ? Number((sal - ing).toFixed(1))
                : found.variacion;
              return {
                ...found,
                ingresoVaporizado: ing,
                variacion: newVar
              };
            }
            return emptyRow;
          });

          const finalCliente = (savedControl.CLIENTE && !["CLIENTE GENERAL", "MOLINO SAN PEDRO S.A.C.", "Cliente de Producción", "Sin cliente"].includes(savedControl.CLIENTE.trim()))
            ? savedControl.CLIENTE
            : (valoresBatchCalculados.cliente || batchClientName || "CLIENTE GENERAL");

          const finalVariedad = (savedControl.VARIEDAD && savedControl.VARIEDAD !== "IR-43 MEJORADO" && savedControl.VARIEDAD.trim() !== "")
            ? savedControl.VARIEDAD
            : (valoresBatchCalculados.variedad || batchVariedad || "TINAJONES");

          const isV374 = Boolean(
            (currentTargetBatchId && currentTargetBatchId.includes("374")) ||
            (currentCorrelativo && currentCorrelativo.includes("374"))
          );

          const finalPesoKg = (isV374 && valoresBatchCalculados.pesoKg > 0)
            ? valoresBatchCalculados.pesoKg
            : ((savedControl.datosIngreso?.pesoKg && savedControl.datosIngreso.pesoKg > 0 && savedControl.datosIngreso.pesoKg !== 18000 && savedControl.datosIngreso.pesoKg !== 45750)
              ? savedControl.datosIngreso.pesoKg
              : (valoresBatchCalculados.pesoKg || batchPaddyReceptionData.totalWeight || (isV374 ? 32237 : 0)));

          const finalSacos = (isV374 && valoresBatchCalculados.numSacos)
            ? valoresBatchCalculados.numSacos
            : ((savedControl.datosIngreso?.numSacos && !["360 SACOS", "300 SACOS", "0 SACOS", ""].includes(savedControl.datosIngreso.numSacos.trim()))
              ? savedControl.datosIngreso.numSacos
              : (valoresBatchCalculados.numSacos || batchPaddyReceptionData.sumSacos || (isV374 ? "315 SACOS" : "")));

          const finalProcedencia = (savedControl.datosIngreso?.procedencia && !["Tolva de Alimentación", "Tolvas de Recepción", "Silo B-01, Silo B-03", ""].includes(savedControl.datosIngreso.procedencia.trim()))
            ? savedControl.datosIngreso.procedencia
            : (valoresBatchCalculados.procedencia || batchPaddyReceptionData.procedencia || "Tolva de Alimentación");

          const finalHumedad = savedControl.datosIngreso?.humedadPct 
            ?? valoresBatchCalculados.humedadPct
            ?? batchPaddyReceptionData.initialPaddy.humedad 
            ?? savedControl.HUMEDAD_INGRESO 
            ?? selectedBatch?.HUMEDAD_PROMEDIO;

          return {
            ...savedControl,
            BATCH_ID: currentTargetBatchId,
            CORRELATIVO: currentCorrelativo,
            CLIENTE: finalCliente,
            VARIEDAD: finalVariedad,
            TON_PROCESADAS: finalPesoKg ? Number((finalPesoKg / 1000).toFixed(1)) : (savedControl.TON_PROCESADAS || 0),
            HUMEDAD_INGRESO: finalHumedad,
            parametrosDeterminados: progMatch?.parametrosDeterminados || (savedControl as any)?.parametrosDeterminados || (selectedBatch as any)?.parametrosDeterminados,
            parametrosRecomendadosIA: progMatch?.parametrosRecomendadosIA || (savedControl as any)?.parametrosRecomendadosIA || (selectedBatch as any)?.parametrosRecomendadosIA,
            datosIngreso: {
              ...savedControl.datosIngreso,
              procedencia: finalProcedencia,
              codigo: currentCorrelativo,
              numSacos: finalSacos,
              pesoKg: finalPesoKg,
              pesoTotalKg: finalPesoKg,
              variedad: finalVariedad,
              humedadPct: finalHumedad,
              tiempoReposo: savedControl.datosIngreso?.tiempoReposo ?? batchPaddyReceptionData.tiempoReposo ?? ""
            },
            parametrosPaddy: mergedPaddy
          };
        } else {
          // Registro limpio inicializado reactivamente con los datos exactos del nuevo batch
          return getBlankPlantControlRecord(currentTargetBatchId, {
            batchCorrelativo: currentCorrelativo,
            cliente: valoresBatchCalculados.cliente || batchClientName,
            variedad: valoresBatchCalculados.variedad || batchVariedad,
            procedencia: valoresBatchCalculados.procedencia || batchPaddyReceptionData.procedencia,
            pesoKg: valoresBatchCalculados.pesoKg || batchPaddyReceptionData.totalWeight,
            numSacos: valoresBatchCalculados.numSacos || batchPaddyReceptionData.sumSacos,
            operador: currentUser?.nombre || selectedBatch?.OPERADOR || "Operario de Planta",
            supervisor: (selectedBatch as any)?.SUPERVISOR || "Jefe de Planta",
            parametrosDeterminados: progMatch?.parametrosDeterminados || (selectedBatch as any)?.parametrosDeterminados,
            parametrosRecomendadosIA: progMatch?.parametrosRecomendadosIA || (selectedBatch as any)?.parametrosRecomendadosIA,
            initialPaddy: {
              ...batchPaddyReceptionData.initialPaddy,
              humedad: valoresBatchCalculados.humedadPct !== undefined ? valoresBatchCalculados.humedadPct : batchPaddyReceptionData.initialPaddy.humedad
            }
          });
        }
      }

      // Si es el mismo batch activo, preservamos íntegramente todo lo que el usuario está llenando en prev
      const currentParamRows = (prev.parametrosPaddy && prev.parametrosPaddy.length > 0) ? prev.parametrosPaddy : emptyPaddy;
      const updatedPaddy = emptyPaddy.map((emptyRow) => {
        const found = currentParamRows.find((p) => p.parametro === emptyRow.parametro);
        if (found) {
          const newIngreso = found.ingresoVaporizado !== undefined ? found.ingresoVaporizado : emptyRow.ingresoVaporizado;
          const sal = found.salidaSecadora;
          const newVar = (sal !== undefined && newIngreso !== undefined && !isNaN(sal) && !isNaN(newIngreso))
            ? Number((sal - newIngreso).toFixed(1))
            : found.variacion;
          return {
            ...found,
            ingresoVaporizado: newIngreso,
            variacion: newVar
          };
        }
        return emptyRow;
      });

      const finalCliente = (prev.CLIENTE && !["CLIENTE GENERAL", "MOLINO SAN PEDRO S.A.C.", "Cliente de Producción", "Sin cliente"].includes(prev.CLIENTE.trim()))
        ? prev.CLIENTE
        : (valoresBatchCalculados.cliente || batchClientName || "CLIENTE GENERAL");

      const finalVariedad = (prev.VARIEDAD && prev.VARIEDAD !== "IR-43 MEJORADO" && prev.VARIEDAD.trim() !== "")
        ? prev.VARIEDAD
        : (valoresBatchCalculados.variedad || batchVariedad || "TINAJONES");

      const finalPesoKg = (prev.datosIngreso?.pesoKg && prev.datosIngreso.pesoKg > 0 && prev.datosIngreso.pesoKg !== 18000)
        ? prev.datosIngreso.pesoKg
        : (valoresBatchCalculados.pesoKg || batchPaddyReceptionData.totalWeight || 0);

      const finalSacos = (prev.datosIngreso?.numSacos && !["360 SACOS", "300 SACOS", "0 SACOS", ""].includes(prev.datosIngreso.numSacos.trim()))
        ? prev.datosIngreso.numSacos
        : (valoresBatchCalculados.numSacos || batchPaddyReceptionData.sumSacos || "");

      const finalProcedencia = (prev.datosIngreso?.procedencia && !["Tolva de Alimentación", "Tolvas de Recepción", "Silo B-01, Silo B-03", ""].includes(prev.datosIngreso.procedencia.trim()))
        ? prev.datosIngreso.procedencia
        : (valoresBatchCalculados.procedencia || batchPaddyReceptionData.procedencia || "Tolva de Alimentación");

      const finalHumedad = prev.datosIngreso?.humedadPct 
        ?? valoresBatchCalculados.humedadPct
        ?? batchPaddyReceptionData.initialPaddy.humedad 
        ?? prev.HUMEDAD_INGRESO 
        ?? selectedBatch?.HUMEDAD_PROMEDIO;

      return {
        ...prev,
        BATCH_ID: currentTargetBatchId,
        CORRELATIVO: currentCorrelativo,
        CLIENTE: finalCliente,
        VARIEDAD: finalVariedad,
        TON_PROCESADAS: finalPesoKg ? Number((finalPesoKg / 1000).toFixed(1)) : (prev.TON_PROCESADAS || 0),
        HUMEDAD_INGRESO: finalHumedad,
        datosIngreso: {
          ...prev.datosIngreso,
          procedencia: finalProcedencia,
          codigo: prev.datosIngreso?.codigo || currentCorrelativo,
          numSacos: finalSacos,
          pesoKg: finalPesoKg,
          pesoTotalKg: finalPesoKg,
          variedad: finalVariedad,
          humedadPct: finalHumedad,
          tiempoReposo: prev.datosIngreso?.tiempoReposo ?? ""
        },
        parametrosPaddy: updatedPaddy
      };
    });
  }, [
    selectedBatchId,
    selectedBatch,
    batchClientName,
    batchVariedad,
    valoresBatchCalculados,
    batchPaddyReceptionData,
    existingControl,
    resolveSavedControl,
    currentUser,
    progsOficialesList
  ]);

  // Handler: Re-sync / Auto-fill batch averages from assigned lotes
  const handleReaplicarPromediosBatch = useCallback(() => {
    setFormData((prev) => {
      const emptyPaddy = createEmptyParametrosPaddy(batchPaddyReceptionData.initialPaddy);
      const updatedPaddy = emptyPaddy.map((emptyRow) => {
        const found = prev.parametrosPaddy?.find((p) => p.parametro === emptyRow.parametro);
        if (found) {
          const newIngreso = emptyRow.ingresoVaporizado;
          const sal = found.salidaSecadora;
          const newVar = (sal !== undefined && newIngreso !== undefined) ? Number((sal - newIngreso).toFixed(1)) : undefined;
          return {
            ...found,
            ingresoVaporizado: newIngreso,
            variacion: newVar
          };
        }
        return emptyRow;
      });

      const updatedDatosIngreso = {
        ...(prev.datosIngreso || {}),
        procedencia: valoresBatchCalculados.procedencia,
        codigo: selectedBatch?.CORRELATIVO || selectedBatch?.BATCH_ID || prev.datosIngreso?.codigo || "",
        numSacos: valoresBatchCalculados.numSacos,
        pesoKg: valoresBatchCalculados.pesoKg,
        pesoTotalKg: valoresBatchCalculados.pesoTotalKg,
        variedad: valoresBatchCalculados.variedad,
        humedadPct: valoresBatchCalculados.humedadPct ?? batchPaddyReceptionData.initialPaddy.humedad ?? 14.0,
        tiempoReposo: prev.datosIngreso?.tiempoReposo || ""
      };

      return {
        ...prev,
        HUMEDAD_INGRESO: valoresBatchCalculados.humedadPct ?? batchPaddyReceptionData.initialPaddy.humedad ?? 14.0,
        TON_PROCESADAS: Number((valoresBatchCalculados.pesoTotalKg / 1000).toFixed(1)),
        CLIENTE: valoresBatchCalculados.cliente || prev.CLIENTE || "CLIENTE GENERAL",
        VARIEDAD: valoresBatchCalculados.variedad || prev.VARIEDAD || "TINAJONES",
        datosIngreso: updatedDatosIngreso,
        parametrosPaddy: updatedPaddy
      };
    });

    setBannerNotice({
      type: "success",
      msg: `¡Datos de Ingreso y Parámetros del Paddy sincronizados con los promedios ponderados del Batch (${associatedBatchLotes.length} lotes)!`
    });
  }, [batchPaddyReceptionData, selectedBatch, valoresBatchCalculados, associatedBatchLotes.length]);

  // Handler: Eliminar datos guardados y resetear ficha en blanco para volver a cargar
  const handleResetearBatchData = useCallback(async () => {
    const currentBatchKey = selectedBatch?.BATCH_ID || selectedBatchId || "";
    const currentCorrelativo = selectedBatch?.CORRELATIVO || selectedBatch?.BATCH_ID || "";

    // 1. Limpiar localStorage drafts
    try {
      localStorage.removeItem(`apit_draft_ctrl_${currentBatchKey}`);
      localStorage.removeItem(`apit_draft_ctrl_${currentBatchKey.toUpperCase()}`);
      localStorage.removeItem(`apit_draft_ctrl_${currentCorrelativo}`);
      localStorage.removeItem(`apit_draft_ctrl_${currentCorrelativo.toUpperCase()}`);
    } catch (e) {
      console.warn("Error limpiando draft de localStorage:", e);
    }

    // 2. Eliminar registro de localDB
    try {
      localDB.deleteControlVaporizado(currentBatchKey);
      if (currentCorrelativo !== currentBatchKey) {
        localDB.deleteControlVaporizado(currentCorrelativo);
      }
    } catch (e) {
      console.warn("Error eliminando control en localDB:", e);
    }

    // 3. Generar registro limpio en blanco con cabeceras de batch y promedios paddy autocompletados
    const blankRecord = getBlankPlantControlRecord(currentBatchKey, {
      batchCorrelativo: currentCorrelativo,
      cliente: valoresBatchCalculados.cliente || "CLIENTE GENERAL",
      variedad: valoresBatchCalculados.variedad || "TINAJONES",
      procedencia: valoresBatchCalculados.procedencia || "Tolva de Alimentación",
      pesoKg: valoresBatchCalculados.pesoKg,
      numSacos: valoresBatchCalculados.numSacos,
      operador: currentUser?.nombre || selectedBatch?.OPERADOR || "Operario de Planta",
      supervisor: "Jefe de Planta",
      initialPaddy: {
        ...batchPaddyReceptionData.initialPaddy,
        humedad: valoresBatchCalculados.humedadPct !== undefined ? valoresBatchCalculados.humedadPct : batchPaddyReceptionData.initialPaddy.humedad
      }
    });

    setFormData(blankRecord);

    if (onRefreshData) {
      onRefreshData();
    }

    setBannerNotice({
      type: "success",
      msg: `🗑️ Control del Batch ${currentCorrelativo} reseteado. Datos de ingreso y parámetros del paddy autocompletados; campos de proceso vacíos para nuevo registro u OCR.`
    });
  }, [selectedBatch, selectedBatchId, batchClientName, batchVariedad, batchPaddyReceptionData, currentUser, onRefreshData]);

  const activeBatchId = selectedBatch?.BATCH_ID || selectedBatchId;

  // Real-time Debounced Auto-Save Hook: triggers automatically when temperature, humidity, time or any field changes
  const {
    autoSaveStatus,
    lastSavedTime,
    saveNow,
    isSaving: isAutoSaving,
    errorMessage: autoSaveError
  } = useAutoSaveControlVaporizado(formData, {
    batchId: activeBatchId,
    currentUser,
    debounceMs: 400,
    onSave: onSaveControl,
    enabled: !!activeBatchId
  });

  // Handler: Iniciar proceso en planta si el Batch aún está solo "PROGRAMADO"
  const handleIniciarProcesoEnPlanta = async () => {
    if (!selectedBatch) return;
    try {
      localDB.iniciarProcesoBatch(selectedBatch.BATCH_ID, currentUser?.nombre);
      if (onRefreshData) onRefreshData();
      setBannerNotice({
        type: "success",
        msg: `Batch ${selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID} puesto EN PROCESO. Todos sus lotes asociados salieron de pendientes.`
      });
    } catch (e) {
      console.warn("Error al iniciar proceso:", e);
      setBannerNotice({
        type: "error",
        msg: "No se pudo iniciar el proceso del batch."
      });
    }
  };

  // Handler: Guardar Control Inmediatamente (Manual override)
  const handleSubmitControl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const targetBatchToSave = formData.BATCH_ID || activeBatchId || "";
      const targetCorrToSave = formData.CORRELATIVO || formData.datosIngreso?.codigo || targetBatchToSave;

      const ok = await saveNow({
        ...formData,
        BATCH_ID: targetBatchToSave,
        CORRELATIVO: targetCorrToSave,
        OPERADOR: formData.OPERADOR || currentUser.nombre,
        SUPERVISOR: formData.SUPERVISOR || "Jefe de Planta"
      });
      if (ok) {
        setSaveSuccess(true);
        setBannerNotice({
          type: "success",
          msg: `Control del Batch ${targetCorrToSave} guardado y sincronizado con base de datos exitosamente.`
        });
        setTimeout(() => setSaveSuccess(false), 3500);
        if (onRefreshData) onRefreshData();
      }
    } catch (error) {
      console.error("Error guardando control de vaporizado:", error);
      setBannerNotice({
        type: "error",
        msg: "Ocurrió un error al guardar el control de vaporizado."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAbrirCierreModal = () => {
    if (selectedBatch) {
      const ctrlExistente = controles.find(c => 
        c.BATCH_ID === selectedBatch.BATCH_ID || 
        c.BATCH_ID === selectedBatch.CORRELATIVO ||
        (c as any).CORRELATIVO === selectedBatch.CORRELATIVO
      );
      setConformidadCierre(Boolean((ctrlExistente as any)?.conformidadCierre));
      setConformidadDescarga(Boolean((ctrlExistente as any)?.conformidadDescarga));
      setObservacionesProceso(
        (ctrlExistente as any)?.observacionesProceso || 
        (ctrlExistente as any)?.observacionCierre || 
        formData.OBSERVACIONES || 
        ""
      );
    } else {
      setConformidadCierre(false);
      setConformidadDescarga(false);
      setObservacionesProceso("");
    }
    setShowCierreModal(true);
  };

  // Handler: Liquidación de Vaporizado en Planta (solo conformidades y observaciones - Análisis de Descarga Pendiente)
  const handleConfirmarCierreTotal = async () => {
    if (!selectedBatch) return;

    if (!conformidadCierre || !conformidadDescarga) {
      setBannerNotice({
        type: "error",
        msg: "Debe confirmar la Conformidad de Cierre de Proceso y la Conformidad de Descarga para liquidar el batch."
      });
      return;
    }

    setIsClosingBatch(true);
    try {
      const currentBatchId = selectedBatch.BATCH_ID;
      const currentBatchCorrelativo = selectedBatch.CORRELATIVO;
      const obsTexto = observacionesProceso.trim();

      const controlPayload = {
        ...formData,
        BATCH_ID: selectedBatch.BATCH_ID,
        FECHA_HORA_FIN: new Date().toISOString().replace("T", " ").substring(0, 16),
        OPERADOR: currentUser.nombre,
        liquidado: true,
        conformidadCierre: true,
        conformidadDescarga: true,
        observacionesProceso: obsTexto,
        observacionCierre: obsTexto,
        ESTADO_ANALISIS_DESCARGA: "PENDIENTE",
        dictamenCalidad: "CONFORME"
      };

      // Al cerrar y liquidar la Hoja de Vaporizado, el batch y sus lotes SIEMPRE pasan al estado VAPORIZADO.
      // Su Análisis de Descarga y Cocción quedan como PENDIENTES para que los suban los analistas de calidad.
      // Solo el Jefe de Vaporizado puede cerrar el Batch formalmente más adelante.
      localDB.liquidarBatch(selectedBatch.BATCH_ID, controlPayload, currentUser.nombre);
      if (onRefreshData) onRefreshData();
      setShowCierreModal(false);
      setBannerNotice({
        type: "success",
        msg: `¡Batch ${selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID} cerrado y liquidado en planta con éxito! Su estado ha pasado a VAPORIZADO. Sus análisis de Descarga y Cocción quedan pendientes para el laboratorio.`
      });

      // Avanzar automáticamente al siguiente batch programado activo en cola
      const nextBatch = batchesProgramadosActivos.find(
        (b) =>
          b.BATCH_ID.toUpperCase() !== currentBatchId.toUpperCase() &&
          (!currentBatchCorrelativo || b.BATCH_ID.toUpperCase() !== currentBatchCorrelativo.toUpperCase())
      );
      if (nextBatch) {
        setSelectedBatchId(nextBatch.BATCH_ID);
        try {
          localStorage.setItem("apit_last_selected_batch_ctrl", nextBatch.BATCH_ID);
        } catch {}
      }
    } catch (e: any) {
      console.error("Error cerrando batch:", e);
      setBannerNotice({
        type: "error",
        msg: "Ocurrió un inconveniente al cerrar el batch localmente."
      });
    } finally {
      setIsClosingBatch(false);
    }
  };

  const estBatchUpper = selectedBatch ? (selectedBatch.ESTADO_BATCH || "PROGRAMADO").toUpperCase() : "";
  const isBatchCerrado = estBatchUpper === "TERMINADO" || estBatchUpper === "CERRADO";
  const isBatchEvaluado = estBatchUpper === "EVALUADO";
  const isBatchAnalisisFinal = estBatchUpper === "ANALISIS_FINAL";
  const isBatchVaporizado = estBatchUpper === "VAPORIZADO";
  const isBatchEnSecado = estBatchUpper === "EN SECADO";
  const isBatchEnReposo = estBatchUpper === "EN REPOSO";
  const isBatchEnProceso = estBatchUpper === "EN PROCESO";
  const isBatchProgramado = estBatchUpper === "PROGRAMADO";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Batch Navigation Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900 border border-slate-750 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Hoja Oficial de Control de Vaporizado & Secado
                </h1>
                {isBatchCerrado && (
                  <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    10/10 · CERRADO (BATCH COMPLETO)
                  </span>
                )}
                {isBatchEvaluado && (
                  <span className="px-3 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    9/10 · EVALUADO (CALIDAD Y COCCIÓN)
                  </span>
                )}
                {isBatchAnalisisFinal && (
                  <span className="px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    8/10 · ANÁLISIS FINAL (DESCARGA)
                  </span>
                )}
                {isBatchVaporizado && (
                  <span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    7/10 · VAPORIZADO (BATCH LIQUIDADO)
                  </span>
                )}
                {isBatchEnSecado && (
                  <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-1 animate-pulse">
                    <Zap className="w-3.5 h-3.5" />
                    6/10 · EN SECADO (PERFILES 0 AL 12)
                  </span>
                )}
                {isBatchEnReposo && (
                  <span className="px-3 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-black flex items-center gap-1 animate-pulse">
                    <Zap className="w-3.5 h-3.5" />
                    5/10 · EN REPOSO (1° REPOSO DE GRANO)
                  </span>
                )}
                {isBatchEnProceso && (
                  <span className="px-3 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs font-black flex items-center gap-1 animate-pulse">
                    <Zap className="w-3.5 h-3.5" />
                    4/10 · EN PROCESO (DATOS DE VAPORIZADO)
                  </span>
                )}
                {isBatchProgramado && (
                  <span className="px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold">
                    3/10 · PROGRAMADO (PENDIENTE INICIO)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Formato industrial oficial de planta: Parámetros Paddy, Silos 1 al 6, Control de Secado 0-14, Autoclave y Liquidación Técnica.
              </p>
            </div>
          </div>
        </div>

        {/* Batch Activo & Historial de Batch Selectors + Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Opción 1: Batch Activo (SOLO salen los batches que han sido programados y no están cerrados) */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-inner border transition-all ${
              isSelectedFromActive
                ? "bg-slate-800 border-amber-500/60 ring-1 ring-amber-500/20"
                : "bg-slate-800/80 border-slate-700"
            }`}
          >
            <label htmlFor="select-batch-control" className="text-xs text-slate-300 font-bold whitespace-nowrap flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${batchesProgramadosActivos.length > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
              Batch Activo / Selector:
            </label>
            <select
              id="select-batch-control"
              value={selectedBatch ? selectedBatch.BATCH_ID : (selectedBatchId || "")}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setSelectedBatchId(val);
                  if (vistaModo === "historial_batches") {
                    setVistaModo("hoja_oficial");
                  }
                }
              }}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-black cursor-pointer min-w-[220px]"
            >
              {batchesProgramadosActivos.length > 0 && (
                <optgroup label="📋 Batches Activos (En Proceso / Pendientes)">
                  {batchesProgramadosActivos.map((b, idx) => (
                    <option key={`act-${b.BATCH_ID}`} value={b.BATCH_ID}>
                      {idx + 1}° · {b.CORRELATIVO || b.BATCH_ID} - {b.CLIENTE ? `${b.CLIENTE.substring(0, 18)}` : (b.ESTADO_BATCH || "PROGRAMADO")} ({b.VARIEDAD || "TINAJONES"})
                    </option>
                  ))}
                </optgroup>
              )}
              {batchesCerradosHistorial.length > 0 && (
                <optgroup label="🗂️ Batches Cerrados / Guardados (Historial)">
                  {batchesCerradosHistorial.map((b) => (
                    <option key={`cerr-${b.BATCH_ID}`} value={b.BATCH_ID}>
                      ✓ {b.CORRELATIVO || b.BATCH_ID} - {b.CLIENTE ? `${b.CLIENTE.substring(0, 18)}` : "CERRADO"} ({b.VARIEDAD || "TINAJONES"}) [{b.ESTADO_BATCH || "GUARDADO"}]
                    </option>
                  ))}
                </optgroup>
              )}
              {batchesProgramadosActivos.length === 0 && batchesCerradosHistorial.length === 0 && (
                <option value="">Sin batches registrados</option>
              )}
            </select>
          </div>

          {/* Opción 2: Historial de Batch (lista donde se encuentran todos los batches que ya han sido cerrados) */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-inner border transition-all ${
              isSelectedFromHistorial
                ? "bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30"
                : "bg-slate-800/80 border-slate-700"
            }`}
          >
            <label htmlFor="select-batch-historial" className="text-xs text-emerald-300 font-bold whitespace-nowrap flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-400" />
              Historial de Batch:
            </label>
            <select
              id="select-batch-historial"
              value={isSelectedFromHistorial && selectedBatch ? selectedBatch.BATCH_ID : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setSelectedBatchId(val);
                  if (vistaModo === "historial_batches") {
                    setVistaModo("hoja_oficial");
                  }
                }
              }}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-black cursor-pointer min-w-[200px]"
            >
              {batchesCerradosHistorial.length === 0 ? (
                <option value="">Sin batches cerrados (0)</option>
              ) : (
                <>
                  <option value="">
                    {isSelectedFromHistorial
                      ? "-- Cambiar batch del historial --"
                      : `-- Ver historial de batch (${batchesCerradosHistorial.length} cerrados/guardados) --`}
                  </option>
                  {batchesCerradosHistorial.map((b) => (
                    <option key={b.BATCH_ID} value={b.BATCH_ID}>
                      ✓ {b.CORRELATIVO || b.BATCH_ID} - {b.CLIENTE ? `${b.CLIENTE.substring(0, 18)}` : "CERRADO"} ({b.VARIEDAD || "TINAJONES"}) [{b.ESTADO_BATCH || "CERRADO"}]
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {selectedBatch && isBatchProgramado && (
            <button
              id="btn-iniciar-vaporizado-planta"
              onClick={handleIniciarProcesoEnPlanta}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer animate-bounce"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar Vaporizado en Planta</span>
            </button>
          )}

          {selectedBatch && !isBatchCerrado && !isBatchVaporizado && !isBatchAnalisisFinal && (
            <button
              id="btn-abrir-cierre-batch"
              onClick={handleAbrirCierreModal}
              className="px-3.5 py-2 rounded-xl text-white font-black text-xs shadow-lg flex items-center gap-1.5 transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-emerald-950/40 ring-1 ring-emerald-400/40"
              title={isBatchEvaluado ? "Cerrar el Batch Completamente (Estado: CERRADO)" : "Cerrar y Liquidar Batch en Planta (Estado: VAPORIZADO)"}
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{isBatchEvaluado ? "Cerrar Batch Completamente" : "Cerrar & Liquidar Batch"}</span>
            </button>
          )}

          {selectedBatch && (isBatchVaporizado || isBatchAnalisisFinal) && onNavigate && (
            <button
              id="btn-ir-analisis-descarga"
              onClick={() => onNavigate("analisis-vaporizado", selectedBatch?.BATCH_ID)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isBatchVaporizado ? "Ir a Registrar Análisis de Descarga" : "Ir a Registrar Cocción y Calidad"}</span>
            </button>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate("programacion")}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Programación</span>
            </button>
          )}
        </div>
      </div>

      {/* In-app Notification Banner */}
      {bannerNotice && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between text-xs transition-all border ${
            bannerNotice.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-300"
              : bannerNotice.type === "error"
              ? "bg-rose-950/80 border-rose-500/80 text-rose-300"
              : "bg-cyan-950/80 border-cyan-500/80 text-cyan-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : bannerNotice.type === "error" ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <span className="font-semibold">{bannerNotice.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerNotice(null)}
            className="px-2 py-0.5 rounded text-[11px] bg-slate-900/60 hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}


      {/* View Mode Selector: Hoja Oficial (Excel exacto) / Monitoreo Gráfico / Historial de Batch */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-750 p-2 rounded-2xl shadow-lg">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 flex-wrap">
          <button
            type="button"
            id="tab-modo-hoja-oficial"
            onClick={() => setVistaModo("hoja_oficial")}
            className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              vistaModo === "hoja_oficial"
                ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>📋 Ficha Oficial de Planta</span>
          </button>

          <button
            type="button"
            id="tab-modo-graficas"
            onClick={() => setVistaModo("graficas_tendencias")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              vistaModo === "graficas_tendencias"
                ? "bg-cyan-600 text-white font-black shadow-md ring-2 ring-cyan-400/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <LineChart className="w-4 h-4 text-cyan-300" />
            <span>📈 Curva de Secado</span>
          </button>

          <button
            type="button"
            id="tab-modo-sacas-descarga"
            onClick={() => setVistaModo("sacas_descarga")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              vistaModo === "sacas_descarga"
                ? "bg-purple-600 text-white font-black shadow-md ring-2 ring-purple-400/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Scale className="w-4 h-4 text-purple-300" />
            <span>⚖️ Registro de Sacas de Descarga (Big Bags) & Peso Proyectado</span>
          </button>

          <button
            type="button"
            id="tab-modo-historial-batches"
            onClick={() => setVistaModo("historial_batches")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              vistaModo === "historial_batches"
                ? "bg-amber-600 text-white font-black shadow-md ring-2 ring-amber-400/40"
                : "text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <History className="w-4 h-4 text-amber-300" />
            <span>🗂️ Historial de Batch ({batchesCerradosHistorial.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3 pr-2 text-xs">
          {/* Live Auto-Save Real-time Status Badge */}
          {autoSaveStatus === "saving" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 font-bold animate-pulse text-[11px]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Sincronizando con BD...</span>
            </div>
          ) : autoSaveStatus === "error" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Error sincronización BD</span>
              <button
                type="button"
                onClick={() => handleSubmitControl()}
                className="ml-1 underline hover:text-white cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Auto-guardado en BD {lastSavedTime ? `(${lastSavedTime})` : "Activo"}
              </span>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 font-mono text-[11px] border-l border-slate-700 pl-3">
            <span>Secado 0-14 Online</span>
          </div>
        </div>
      </div>

      {/* Aviso contextual si se está visualizando un Batch Cerrado desde el Historial */}
      {isSelectedFromHistorial && selectedBatch && vistaModo !== "historial_batches" && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <History className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Visualizando registro histórico del Batch cerrado{" "}
              <strong className="text-white font-black">{selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}</strong> ({batchClientName} — {batchVariedad}).
            </span>
          </div>
          <div className="flex items-center gap-2">
            {batchesProgramadosActivos.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedBatchId(batchesProgramadosActivos[0].BATCH_ID)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold cursor-pointer"
              >
                Volver a Batch Activo ({batchesProgramadosActivos[0].CORRELATIVO || batchesProgramadosActivos[0].BATCH_ID})
              </button>
            )}
            <button
              type="button"
              onClick={() => setVistaModo("historial_batches")}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold cursor-pointer"
            >
              Ver lista completa de Historial
            </button>
          </div>
        </div>
      )}

      {/* VISTA: LISTA DE HISTORIAL DE BATCHES CERRADOS */}
      {(vistaModo === "historial_batches" || (!selectedBatch && batchesProgramadosActivos.length === 0 && vistaModo !== "sacas_descarga")) && (
        <div className="bg-slate-900 border border-slate-750 rounded-2xl p-5 shadow-xl space-y-4">
          {!selectedBatch && batchesProgramadosActivos.length === 0 && vistaModo !== "historial_batches" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/80 border border-amber-500/30">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>No hay Batches Activos programados en cola</span>
                </h3>
                <p className="text-xs text-slate-400">
                  En la opción <strong>Batch Activo</strong> solo aparecen los batches que han sido programados y están pendientes o en proceso. Puedes programar un nuevo batch o consultar abajo el <strong>Historial de Batch</strong> con los batches ya cerrados.
                </p>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("programacion")}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>Ir a Programación de Batch</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">
                  Historial de Batch (Batches Cerrados)
                </h2>
                <p className="text-xs text-slate-400">
                  Registro histórico de todos los batches que ya han sido cerrados completamente ({batchesCerradosHistorial.length} registrados).
                </p>
              </div>
            </div>
          </div>

          {batchesCerradosHistorial.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800 text-xs">
              Aún no hay batches cerrados en el historial.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                    <th className="py-2.5 px-3 font-black">Batch</th>
                    <th className="py-2.5 px-3 font-black">Fecha</th>
                    <th className="py-2.5 px-3 font-black">Cliente</th>
                    <th className="py-2.5 px-3 font-black">Variedad</th>
                    <th className="py-2.5 px-3 font-black">Lotes Asociados</th>
                    <th className="py-2.5 px-3 font-black text-right">Peso Total</th>
                    <th className="py-2.5 px-3 font-black text-center">Estado</th>
                    <th className="py-2.5 px-3 font-black text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {batchesCerradosHistorial.map((b) => {
                    const bIdUpper = (b.BATCH_ID || "").toUpperCase();
                    const bCorrUpper = (b.CORRELATIVO || b.BATCH_ID || "").toUpperCase();
                    const bLotes = batchLotes.filter((bl) => {
                      const blId = (bl.BATCH_ID || "").toUpperCase();
                      return blId === bIdUpper || blId === bCorrUpper;
                    });
                    const lotesCodigos = bLotes.length > 0
                      ? bLotes.map((bl) => bl.LOTE_ID).join(", ")
                      : Array.isArray((b as any).filasLote)
                      ? (b as any).filasLote.map((f: any) => f.loteId).join(", ")
                      : "—";
                    const pesoKg = b.PESO_TOTAL_KG || (b as any).TOTAL_PESO_KG || 18000;

                    return (
                      <tr key={b.BATCH_ID} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 font-black text-amber-400 font-mono">
                          {b.CORRELATIVO || b.BATCH_ID}
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-mono">
                          {(b as any).FECHA_FIN || b.FECHA_PROGRAMADA || "—"}
                        </td>
                        <td className="py-3 px-3 font-bold text-white">
                          {b.CLIENTE || "MOLINO SAN PEDRO S.A.C."}
                        </td>
                        <td className="py-3 px-3 text-cyan-300 font-semibold">
                          {b.VARIEDAD || "TINAJONES"}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-300">
                          {lotesCodigos}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-200">
                          {pesoKg.toLocaleString()} kg
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black">
                            CERRADO
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBatchId(b.BATCH_ID);
                                setVistaModo("hoja_oficial");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Ver Hoja de Control</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBatchId(b.BATCH_ID);
                                setVistaModo("sacas_descarga");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Sacas Descarga</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RENDER VIEW ACCORDING TO SELECTED MODE */}
      {vistaModo === "hoja_oficial" && selectedBatch && (
        <HojaControlVaporizadoOficial
          formData={formData}
          setFormData={setFormData}
          batchId={selectedBatch.BATCH_ID || selectedBatchId}
          batchCorrelativo={selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}
          batchClient={batchClientName}
          batchVariedad={batchVariedad}
          selectedBatch={selectedBatch}
          valoresBatchCalculados={valoresBatchCalculados}
          batchPaddyReceptionData={batchPaddyReceptionData}
          associatedBatchLotes={associatedBatchLotes}
          onSyncBatchAverages={handleReaplicarPromediosBatch}
          onResetBatchData={handleResetearBatchData}
          onSave={() => handleSubmitControl()}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
          autoSaveStatus={autoSaveStatus}
          lastSavedTime={lastSavedTime}
          onNavigate={onNavigate}
          onCerrarLiquidarBatch={handleAbrirCierreModal}
          isBatchCerrado={isBatchCerrado}
        />
      )}

      {vistaModo === "graficas_tendencias" && selectedBatch && (
        <GraficaSecadoMonitoreo
          perfiles={formData.perfilesSecado || DEFAULT_PERFILES_SECADO}
          batchCorrelativo={selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}
          variedad={batchVariedad}
        />
      )}

      {vistaModo === "sacas_descarga" && (() => {
        const activeOrFallbackBatch = selectedBatch || batchesProgramadosActivos[0] || batchesCerradosHistorial[0] || batches[0];
        if (!activeOrFallbackBatch) {
          return (
            <div className="bg-slate-900 border border-slate-750 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No hay batches registrados aún para cargar Sacas de Descarga (Big Bags).
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {/* Selector de Batch para Sacas de Descarga (incluye Programados y Cerrados) */}
            <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wide">
                    Pestaña: Registro de Sacas de Descarga (Big Bags) por Balanza & Comparación con Peso Proyectado
                  </h3>
                  <p className="text-xs text-slate-400">
                    Selecciona el batch (activo o cerrado) para registrar los pesos individuales por balanza y validar el rango permitido de ±2% del peso ingresado.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-300 whitespace-nowrap">Batch:</span>
                <select
                  value={activeOrFallbackBatch.BATCH_ID}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="bg-slate-950 border border-purple-500/50 rounded-xl px-3 py-2 text-xs font-black text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                >
                  {batchesProgramadosActivos.length > 0 && (
                    <optgroup label="Batches Activos / Programados">
                      {batchesProgramadosActivos.map((b) => (
                        <option key={b.BATCH_ID} value={b.BATCH_ID}>
                          {b.CORRELATIVO || b.BATCH_ID} — {b.VARIEDAD || "TINAJONES"} ({b.ESTADO_BATCH || "PROGRAMADO"})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {batchesCerradosHistorial.length > 0 && (
                    <optgroup label="Historial de Batches Cerrados / Vaporizados">
                      {batchesCerradosHistorial.map((b) => (
                        <option key={b.BATCH_ID} value={b.BATCH_ID}>
                          {b.CORRELATIVO || b.BATCH_ID} — {b.VARIEDAD || "TINAJONES"} (CERRADO)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <SacasDescargaManager
              batchId={activeOrFallbackBatch.BATCH_ID}
              correlativo={activeOrFallbackBatch.CORRELATIVO || activeOrFallbackBatch.BATCH_ID}
              cliente={activeOrFallbackBatch.BATCH_ID === selectedBatch?.BATCH_ID ? batchClientName : activeOrFallbackBatch.CLIENTE}
              variedad={activeOrFallbackBatch.BATCH_ID === selectedBatch?.BATCH_ID ? batchVariedad : activeOrFallbackBatch.VARIEDAD}
              batch={activeOrFallbackBatch}
              controlData={activeOrFallbackBatch.BATCH_ID === selectedBatch?.BATCH_ID ? formData : controles.find((c) => c.BATCH_ID === activeOrFallbackBatch.BATCH_ID || c.BATCH_ID === activeOrFallbackBatch.CORRELATIVO)}
              batchLotes={batchLotes}
              lotes={lotes}
              analisisHumList={analisisHumList}
              humedades={humedades}
              presecados={presecados}
              controles={controles}
              programaciones={progsOficialesList}
              currentUserNombre={currentUser?.nombre || "Operador Balanza"}
              variant="dark"
              onChangeRegistro={(reg) => {
                if (activeOrFallbackBatch.BATCH_ID === selectedBatch?.BATCH_ID) {
                  setFormData((prev) => ({
                    ...prev,
                    sacasDescarga: reg.sacas,
                    registroSacasDescarga: reg
                  }));
                }
                if (onRefreshData) onRefreshData();
              }}
            />
          </div>
        );
      })()}

      {/* MODAL: CIERRE Y LIQUIDACIÓN DEFINITIVA DEL BATCH EN PLANTA */}
      {showCierreModal && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Cierre & Liquidación de Batch en Planta
                  </h3>
                  <p className="text-xs text-slate-400">
                    Hoja: <span className="text-slate-300 font-semibold">REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Batch: <span className="text-amber-400 font-bold">{selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}</span> — {batchClientName} ({batchVariedad})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCierreModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Sección 1: Conformidades Requeridas para Cierre y Liquidación */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Conformidades Obligatorias de Planta</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Operador: <strong className="text-white">{currentUser?.nombre || "Operador de Turno"}</strong>
                  </span>
                </div>

                {/* 1. Conformidad de Cierre */}
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  conformidadCierre
                    ? "bg-emerald-950/40 border-emerald-500/60 shadow-sm"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}>
                  <input
                    type="checkbox"
                    checked={conformidadCierre}
                    onChange={(e) => setConformidadCierre(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Conformidad de Cierre de Proceso
                      </span>
                      {conformidadCierre ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Aceptada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Requerida
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Doy conformidad al término de las etapas de vaporizado, secado y estabilización térmica del batch en planta conforme a parámetros operativos.
                    </p>
                  </div>
                </label>

                {/* 2. Conformidad de Descarga */}
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  conformidadDescarga
                    ? "bg-emerald-950/40 border-emerald-500/60 shadow-sm"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}>
                  <input
                    type="checkbox"
                    checked={conformidadDescarga}
                    onChange={(e) => setConformidadDescarga(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Conformidad de Descarga
                      </span>
                      {conformidadDescarga ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Aceptada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Requerida
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Doy conformidad a la descarga completa del producto procesado desde la secadora o silo hacia tolvas/sacas de despacho conforme a balance de masa.
                    </p>
                  </div>
                </label>
              </div>

              {/* Sección 2: Observaciones durante el proceso */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Observaciones durante el proceso
                </label>
                <textarea
                  rows={3}
                  value={observacionesProceso}
                  onChange={(e) => setObservacionesProceso(e.target.value)}
                  placeholder="Registre incidencias operativas, variaciones térmicas, notas de secado o detalles relevantes del turno durante el proceso..."
                  className="w-full bg-slate-950 border border-slate-750 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 resize-none outline-none transition-colors"
                />
              </div>

              {/* Sección 3: AVISO CLAVE - ANÁLISIS DE DESCARGA PENDIENTE (SOLO ANALISTAS) */}
              <div className="p-4 bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border-2 border-amber-500/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                      Análisis de Descarga: PENDIENTE
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                    <Microscope className="w-3 h-3 text-purple-400" />
                    Exclusivo Analistas de Laboratorio
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  El registro físico-químico de calidad post-secado (Humedad, Rendimiento Blanco/Integral, Quebrado, Trizado y Defectos) <strong>no se realiza en esta hoja de planta</strong>. Corresponde exclusivamente al equipo de <strong>Analistas de Laboratorio</strong> en el módulo <em>Análisis de Descarga</em>.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Al liquidar, el batch pasará a estado <strong>"VAPORIZADO"</strong> y aparecerá automáticamente en la lista de pendientes del laboratorio.</span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCierreModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isClosingBatch || !conformidadCierre || !conformidadDescarga}
                  onClick={handleConfirmarCierreTotal}
                  className={`px-6 py-2.5 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                    conformidadCierre && conformidadDescarga && !isClosingBatch
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 ring-1 ring-emerald-400"
                      : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                  }`}
                  title={
                    !conformidadCierre || !conformidadDescarga
                      ? "Debe marcar las conformidades de cierre y de descarga para liquidar"
                      : "Confirmar y liquidar batch en planta"
                  }
                >
                  <Lock className="w-4 h-4" />
                  <span>{isClosingBatch ? "Liquidando en Planta..." : "Confirmar Cierre & Liquidar Batch"}</span>
                </button>
              </div>
            </div>

            {(!conformidadCierre || !conformidadDescarga) && (
              <p className="text-[10.5px] text-amber-400/90 text-right font-medium">
                * Debe marcar la <strong>Conformidad de Cierre</strong> y la <strong>Conformidad de Descarga</strong> para habilitar la liquidación.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
