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
  Check
} from "lucide-react";
import { HojaControlVaporizadoOficial } from "./HojaControlVaporizadoOficial";
import { GraficaSecadoMonitoreo } from "./GraficaSecadoMonitoreo";
import { DEFAULT_PERFILES_SECADO, getBlankPlantControlRecord, createEmptyParametrosPaddy } from "../utils/plantSheetDefaults";
import { useAutoSaveControlVaporizado } from "../hooks/useAutoSaveControlVaporizado";
import { tienePermiso, obtenerMensajeRestriccion } from "../utils/permisosService";
import { localDB } from "../utils/localDB";
import { 
  cargarProgramacionesOficiales, 
  guardarProgramacionesOficiales, 
  ProgramacionBatchOficial 
} from "../utils/programacionBatchOficialService";
import { safeNumVal, parseNumberOrZero, safeNumber } from "../utils/numberUtils";

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
    const list = localDB.getProgramacionesOficiales();
    return list.length > 0 ? list : cargarProgramacionesOficiales();
  });

  useEffect(() => {
    const data = localDB.getProgramacionesOficiales();
    if (Array.isArray(data) && data.length > 0) {
      setProgsOficialesList(data);
      guardarProgramacionesOficiales(data);
    }

    const handleUpdate = () => {
      const updated = localDB.getProgramacionesOficiales();
      setProgsOficialesList(updated.length > 0 ? updated : cargarProgramacionesOficiales());
    };
    window.addEventListener("programaciones-oficiales-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("programaciones-oficiales-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Lista consolidada de Batches incluyendo las Programaciones Oficiales (V200, V201, etc.)
  const allBatches = useMemo<BatchVaporizado[]>(() => {
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const map = new Map<string, BatchVaporizado>();

    // 1. Agregar programaciones oficiales primero (V200, V201, V202-1, V202-2...)
    progs.forEach((p, idx) => {
      const bCode = p.batch || p.id || `V${200 + idx}`;
      map.set(bCode.toUpperCase(), {
        BATCH_ID: bCode,
        CORRELATIVO: bCode,
        FECHA_PROGRAMADA: p.fecha || "2026-08-18",
        EQUIPO: "APIT",
        ESTADO_BATCH: (p.estado as any) || "PROGRAMADO",
        TON_PROGRAMADAS: (p.pesoTotalKg || 18000) / 1000,
        TON_PROCESADAS: (p.pesoTotalKg || 18000) / 1000,
        PESO_TOTAL_KG: p.pesoTotalKg || 18000,
        CLIENTE: p.clientePrincipal || "MOLINO SAN PEDRO S.A.C.",
        VARIEDAD: p.variedadPrincipal || "IR-43 MEJORADO",
        TURNO: p.turno === "DIA" ? "Turno Día" : "Turno Noche",
        OPERADOR: "Pedro Huamán",
        OBSERVACIONES: p.observacion || "LOTE CN HUMEDAD BAJA"
      });
    });

    // 2. Fusionar con batches reales guardados en backend (con prioridad de estado procesado/terminado)
    batches.forEach(b => {
      const key1 = (b.CORRELATIVO || "").toUpperCase();
      const key2 = (b.BATCH_ID || "").toUpperCase();
      const existing = (key1 && map.get(key1)) || (key2 && map.get(key2));
      if (existing) {
        map.set(existing.BATCH_ID.toUpperCase(), {
          ...existing,
          ...b,
          ESTADO_BATCH: b.ESTADO_BATCH || existing.ESTADO_BATCH
        });
      } else {
        map.set(key2 || key1, b);
      }
    });

    return Array.from(map.values());
  }, [batches, progsOficialesList]);

  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || allBatches[0]?.BATCH_ID || "V200");
  const selectedBatch = allBatches.find((b) => 
    b.BATCH_ID.toUpperCase() === selectedBatchId.toUpperCase() || 
    (b.CORRELATIVO && b.CORRELATIVO.toUpperCase() === selectedBatchId.toUpperCase())
  ) || allBatches[0];
  
  const existingControl = useMemo(() => {
    const targetId = (selectedBatchId || "").toUpperCase();
    const targetBatchId = (selectedBatch?.BATCH_ID || "").toUpperCase();
    const targetCorr = (selectedBatch?.CORRELATIVO || "").toUpperCase();

    return controles.find((c) => {
      const cId = (c.BATCH_ID || "").toUpperCase();
      const cCorr = (c.CORRELATIVO || "").toUpperCase();
      const cCod = (c.datosIngreso?.codigo || "").toUpperCase();
      return (
        (targetId && (cId === targetId || cCorr === targetId || cCod === targetId)) ||
        (targetBatchId && (cId === targetBatchId || cCorr === targetBatchId || cCod === targetBatchId)) ||
        (targetCorr && (cId === targetCorr || cCorr === targetCorr || cCod === targetCorr))
      );
    });
  }, [controles, selectedBatchId, selectedBatch]);

  // Associated batch lotes and client resolution across Programaciones Oficiales, BatchLotes, and Raw Batches
  const associatedBatchLotes = useMemo(() => {
    const targetId = (selectedBatch?.BATCH_ID || selectedBatchId || "").toUpperCase();
    const targetCorr = (selectedBatch?.CORRELATIVO || "").toUpperCase();

    // 1. Check in Programaciones Oficiales (donde filasLote contiene los lotes exactos asignados y sus parámetros)
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const progMatch = progs.find(p => 
      (p.batch && p.batch.toUpperCase() === targetId) || 
      (p.id && p.id.toUpperCase() === targetId) ||
      (targetCorr && p.batch && p.batch.toUpperCase() === targetCorr)
    );

    if (progMatch && progMatch.filasLote && progMatch.filasLote.length > 0) {
      return progMatch.filasLote.map(f => {
        const foundLote = lotes.find(l => l.LOTE_ID === f.loteId);
        return {
          BATCH_ID: progMatch.batch || targetId,
          LOTE_ID: f.loteId,
          SACOS: f.sacProg || f.sacos || foundLote?.SACOS || 100,
          PESO_KG: f.pesoProg || f.peso || foundLote?.PESO_KG || 9000,
          CLIENTE: f.cliente || progMatch.clientePrincipal || foundLote?.CLIENTE,
          VARIEDAD: f.variedad || progMatch.variedadPrincipal || foundLote?.VARIEDAD,
          UBICACION: foundLote?.UBICACION || foundLote?.PROCEDENCIA || foundLote?.ZONA || (f as any).ubicacion,
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
        };
      });
    }

    // 2. Check in batchLotes table from backend
    const fromBatchLotes = batchLotes.filter((bl) => {
      const bId = (bl.BATCH_ID || "").toUpperCase();
      return bId === targetId || (targetCorr && bId === targetCorr);
    });

    if (fromBatchLotes.length > 0) {
      return fromBatchLotes;
    }

    // 3. Check if selectedBatch has assigned lotes array
    if ((selectedBatch as any)?.lotesAsignados && Array.isArray((selectedBatch as any).lotesAsignados)) {
      return (selectedBatch as any).lotesAsignados.map((l: any) => ({
        BATCH_ID: targetId,
        LOTE_ID: typeof l === "string" ? l : (l.LOTE_ID || l.loteId),
        SACOS: typeof l === "object" ? (l.SACOS || l.sacos || 100) : 100,
        PESO_KG: typeof l === "object" ? (l.PESO_KG || l.pesoKg || 9000) : 9000,
        CLIENTE: typeof l === "object" ? (l.CLIENTE || l.cliente) : selectedBatch?.CLIENTE,
        VARIEDAD: typeof l === "object" ? (l.VARIEDAD || l.variedad) : selectedBatch?.VARIEDAD
      }));
    }

    return [];
  }, [batchLotes, selectedBatchId, selectedBatch, progsOficialesList, lotes]);

  const batchClientName = useMemo(() => {
    const targetId = (selectedBatch?.BATCH_ID || selectedBatchId || "").toUpperCase();
    const targetCorr = (selectedBatch?.CORRELATIVO || "").toUpperCase();
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const progMatch = progs.find(p => 
      (p.batch && p.batch.toUpperCase() === targetId) || 
      (p.id && p.id.toUpperCase() === targetId) ||
      (targetCorr && p.batch && p.batch.toUpperCase() === targetCorr)
    );
    if (progMatch?.clientePrincipal) return progMatch.clientePrincipal;

    if (associatedBatchLotes.length > 0) {
      const loteObj = lotes.find((l) => l.LOTE_ID === associatedBatchLotes[0].LOTE_ID);
      return loteObj?.CLIENTE || associatedBatchLotes[0].CLIENTE || selectedBatch?.CLIENTE || "MOLINO SAN PEDRO S.A.C.";
    }
    return selectedBatch?.CLIENTE || "MOLINO SAN PEDRO S.A.C.";
  }, [associatedBatchLotes, lotes, selectedBatch, progsOficialesList, selectedBatchId]);

  const batchVariedad = useMemo(() => {
    const targetId = (selectedBatch?.BATCH_ID || selectedBatchId || "").toUpperCase();
    const targetCorr = (selectedBatch?.CORRELATIVO || "").toUpperCase();
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const progMatch = progs.find(p => 
      (p.batch && p.batch.toUpperCase() === targetId) || 
      (p.id && p.id.toUpperCase() === targetId) ||
      (targetCorr && p.batch && p.batch.toUpperCase() === targetCorr)
    );
    if (progMatch?.variedadPrincipal) return progMatch.variedadPrincipal;

    if (associatedBatchLotes.length > 0) {
      const loteObj = lotes.find((l) => l.LOTE_ID === associatedBatchLotes[0].LOTE_ID);
      return loteObj?.VARIEDAD || associatedBatchLotes[0].VARIEDAD || selectedBatch?.VARIEDAD || "IR-43 MEJORADO";
    }
    return selectedBatch?.VARIEDAD || "IR-43 MEJORADO";
  }, [associatedBatchLotes, lotes, selectedBatch, progsOficialesList, selectedBatchId]);

  // Compute reception data and initial paddy averages from assigned lotes & programacion oficial
  const batchPaddyReceptionData = useMemo(() => {
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const targetId = (selectedBatch?.BATCH_ID || selectedBatchId || "").toUpperCase();
    const targetCorr = (selectedBatch?.CORRELATIVO || "").toUpperCase();
    const progMatch = progs.find(p => 
      (p.batch && p.batch.toUpperCase() === targetId) || 
      (p.id && p.id.toUpperCase() === targetId) ||
      (targetCorr && p.batch && p.batch.toUpperCase() === targetCorr)
    );

    const rawLotes = (associatedBatchLotes.length > 0 ? associatedBatchLotes : (progMatch?.filasLote || []).map(f => ({
      BATCH_ID: progMatch?.batch || targetId,
      LOTE_ID: f.loteId,
      SACOS: f.sacProg || (f as any).sacos || 100,
      PESO_KG: f.pesoProg || (f as any).peso || 9000,
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
      const found = lotes.find(l => l.LOTE_ID === bl.LOTE_ID);
      const anHum = (analisisHumList || []).find(a => a.LOTE_ID === bl.LOTE_ID);
      const pre = (presecados || []).find(p => p.LOTE_ID === bl.LOTE_ID);
      const humReg = (humedades || []).find(h => h.LOTE_ID === bl.LOTE_ID);
      const anSec = (analisisSecList || []).find(s => s.LOTE_ID === bl.LOTE_ID);

      const peso = bl.PESO_KG || found?.PESO_KG || (found?.SACOS ? found.SACOS * 90 : 9000);
      const numSacos = bl.SACOS || found?.SACOS || (peso ? Math.round(peso / 90) : 100);

      // Extract specific quality parameters prioritized from Programacion -> Presecado -> Analisis Humedo -> Lote / Defaults
      const hum = (bl as any).ph ?? anHum?.HUMEDADES ?? pre?.Humedad ?? humReg?.["H. PROMEDIO"] ?? found?.HUM ?? (found as any)?.HUMEDAD ?? 14.4;
      const ri = anHum?.RI ?? pre?.RI ?? (found as any)?.RI ?? (found as any)?.RENDIMIENTO_INTEGRAL ?? (found as any)?.RENDIMIENTO_PILADO ?? 78.4;
      const rb = anHum?.RB ?? pre?.RB ?? (found as any)?.RB ?? (found as any)?.RENDIMIENTO_BLANCO ?? (found as any)?.RENDIMIENTO_ENTERO ?? 71.4;
      const q = (bl as any).qb ?? (bl as any).qi ?? anHum?.QB ?? anHum?.QI ?? pre?.QB ?? pre?.QI ?? (found as any)?.GRANO_QUEBRADO ?? 8.7;
      const tt = (bl as any).tt ?? anHum?.TT ?? pre?.TT ?? (found as any)?.TOTAL_DANADOS ?? (found as any)?.DANADO_TOTAL ?? 1.6;
      const tp = (bl as any).tp ?? anHum?.TP ?? pre?.TP ?? (found as any)?.GRANO_PICADO ?? 2.0;
      const m = (bl as any).m ?? anHum?.M ?? pre?.M ?? (found as any)?.MANCHADOS ?? (found as any)?.GRANO_MANCHADO ?? 0.5;
      const tz = (bl as any).triz ?? anHum?.TZ ?? pre?.TZ ?? (found as any)?.TRIZADO ?? (found as any)?.GRANO_YESOSO ?? 1.4;
      const gi = (bl as any).gi ?? anHum?.GI ?? pre?.GI ?? (found as any)?.GRANO_INMADURO ?? 0.3;
      const gr = (bl as any).gr ?? anHum?.GR ?? pre?.GR ?? (found as any)?.GRANO_ROJO ?? 0.2;
      const blVal = (bl as any).blInt ?? anHum?.["B.INTEGRAL"] ?? pre?.["B.INTEGRAL"] ?? (found as any)?.BLANCURA_INTEGRAL ?? (found as any)?.BLANCURA ?? 21.9;
      const blpVal = (bl as any).blBlanco ?? anHum?.["B. PULIDO"] ?? pre?.["B. PULIDO"] ?? anSec?.Blancura_Final ?? 40.5;
      const remVal = (bl as any).rem ?? anHum?.RM ?? pre?.RM ?? 7.0;

      const ubicacionLote = (bl as any).UBICACION || found?.UBICACION || (found as any)?.PROCEDENCIA || found?.ZONA || "Tolva Planta";

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

    const totalWeight = progMatch?.pesoTotalKg || rawLotes.reduce((sum, l) => sum + (l.pesoKg || 0), 0) || (selectedBatch?.PESO_TOTAL_KG || 18000);
    const sumSacosNum = progMatch?.totalSacosProg || rawLotes.reduce((sum, l) => sum + (l.sacos || 0), 0) || (totalWeight ? Math.round(totalWeight / 50) : 360);
    const sumSacos = `${sumSacosNum} SACOS`;
    
    // Procedencia extraída de los silos/ubicaciones reales de los lotes asignados o de la programación
    const procedenciasList = Array.from(new Set(rawLotes.map(l => l.procedencia).filter(Boolean)));
    const procedencias = procedenciasList.length > 0 ? procedenciasList.join(", ") : "Silo B-01, Silo B-03";

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

    const humFinal = progProm?.ph !== undefined ? progProm.ph : calcWeighted(l => l.hum, selectedBatch?.HUMEDAD_PROMEDIO || 14.4);
    // El tiempo de reposo en datos de ingreso es el reposo en cáscara que tiene el arroz al ingresar (debe aparecer vacío para que el operador lo llene)
    const tiempoReposoInicial = "";

    return {
      procedencia: procedencias,
      totalWeight,
      sumSacos,
      tiempoReposo: tiempoReposoInicial,
      initialPaddy: {
        humedad: humFinal,
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
  }, [associatedBatchLotes, lotes, selectedBatch, selectedBatchId, analisisHumList, presecados, humedades, analisisSecList, progsOficialesList]);

  // Mode: 1. Official Plant Sheet (Excel match), 2. Drying Trend Graphs
  const [vistaModo, setVistaModo] = useState<"hoja_oficial" | "graficas_tendencias">("hoja_oficial");

  // Form State for Physical Control
  const [formData, setFormData] = useState<Partial<ControlVaporizado>>(() => {
    return getBlankPlantControlRecord(initialBatchId || batches[0]?.BATCH_ID || "V200", {
      operador: currentUser?.nombre || "Operario de Planta"
    });
  });

  // Form State for Final Quality Analysis in Lab
  const [analisisFinal, setAnalisisFinal] = useState<Partial<AnalisisVaporizado>>({
    HUMEDAD: 12.8,
    RI: 78.5,
    RB: 71.5,
    RM: 7.0,
    QI: 6.5,
    QB: 14.0,
    TT: 1.2,
    TP: 2.0,
    M: 0.6,
    TZ: 1.5,
    GR: 0.2,
    GI: 98.0,
    BLI: 22.5,
    BL: 40.5,
    OBSERVACIONES: "Batch cumple parámetros de gelatinización y rendimiento de entero especificados por planta."
  });

  const [dictamenCalidad, setDictamenCalidad] = useState<"CONFORME" | "APROBADO_OBSERVADO" | "NO_CONFORME">("CONFORME");
  const [observacionCierre, setObservacionCierre] = useState<string>("Batch procesado conforme, parámetros térmicos estables y análisis final aprobado.");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isClosingBatch, setIsClosingBatch] = useState(false);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [showActaModal, setShowActaModal] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Permisos según rol
  const userRole = (currentUser?.rol || "OPERARIO") as UserRole;
  const canCerrarBatch = tienePermiso(userRole, "cerrar_aprobar_batch");
  const canOperarPiso = tienePermiso(userRole, "operar_autoclave_piso");

  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
    }
  }, [initialBatchId]);

  // Sincronización automática en tiempo real de Datos de Ingreso y Parámetros del Paddy (promedios del batch)
  // Se actualiza automáticamente cada vez que se modifica la programación, el batch o los lotes asignados.
  useEffect(() => {
    const currentTargetBatchId = selectedBatch?.BATCH_ID || selectedBatchId || "V200";
    const currentCorrelativo = selectedBatch?.CORRELATIVO || currentTargetBatchId;
    const progs = progsOficialesList.length > 0 ? progsOficialesList : cargarProgramacionesOficiales();
    const progMatch = progs.find(p => 
      (p.batch && p.batch.toUpperCase() === currentTargetBatchId.toUpperCase()) || 
      (p.id && p.id.toUpperCase() === currentTargetBatchId.toUpperCase()) ||
      (p.batch && p.batch.toUpperCase() === currentCorrelativo.toUpperCase())
    );

    setFormData((prev) => {
      const isSwitchingBatch = !prev.BATCH_ID || 
                               (prev.BATCH_ID.toUpperCase() !== currentTargetBatchId.toUpperCase()) ||
                               (prev.CORRELATIVO && prev.CORRELATIVO.toUpperCase() !== currentCorrelativo.toUpperCase());

      const newDatosIngreso = {
        procedencia: batchPaddyReceptionData.procedencia,
        codigo: currentCorrelativo,
        numSacos: batchPaddyReceptionData.sumSacos,
        pesoKg: batchPaddyReceptionData.totalWeight,
        pesoTotalKg: batchPaddyReceptionData.totalWeight,
        variedad: batchVariedad || prev.datosIngreso?.variedad || "IR-43 MEJORADO",
        humedadPct: batchPaddyReceptionData.initialPaddy.humedad,
        tiempoReposo: batchPaddyReceptionData.tiempoReposo
      };

      const emptyPaddy = createEmptyParametrosPaddy(batchPaddyReceptionData.initialPaddy);

      const isMatchExisting = Boolean(existingControl && (
        (existingControl.BATCH_ID && (existingControl.BATCH_ID.toUpperCase() === currentTargetBatchId.toUpperCase() || existingControl.BATCH_ID.toUpperCase() === currentCorrelativo.toUpperCase())) ||
        (existingControl.CORRELATIVO && (existingControl.CORRELATIVO.toUpperCase() === currentCorrelativo.toUpperCase() || existingControl.CORRELATIVO.toUpperCase() === currentTargetBatchId.toUpperCase())) ||
        (existingControl.datosIngreso?.codigo && (existingControl.datosIngreso.codigo.toUpperCase() === currentCorrelativo.toUpperCase() || existingControl.datosIngreso.codigo.toUpperCase() === currentTargetBatchId.toUpperCase()))
      ));

      if (isSwitchingBatch) {
        if (isMatchExisting && existingControl) {
          const mergedPaddy = emptyPaddy.map((emptyRow) => {
            const found = existingControl.parametrosPaddy?.find((p) => p.parametro === emptyRow.parametro);
            if (found) {
              const ing = emptyRow.ingresoVaporizado !== undefined ? emptyRow.ingresoVaporizado : found.ingresoVaporizado;
              const sal = found.salidaSecadora;
              const newVar = (sal !== undefined && ing !== undefined && !isNaN(sal) && !isNaN(ing)) ? Number((sal - ing).toFixed(1)) : found.variacion;
              return {
                ...found,
                ingresoVaporizado: ing,
                variacion: newVar
              };
            }
            return emptyRow;
          });

          return {
            ...existingControl,
            BATCH_ID: currentTargetBatchId,
            CORRELATIVO: currentCorrelativo,
            CLIENTE: batchClientName || existingControl.CLIENTE,
            VARIEDAD: batchVariedad || existingControl.VARIEDAD,
            TON_PROCESADAS: Number((batchPaddyReceptionData.totalWeight / 1000).toFixed(1)),
            HUMEDAD_INGRESO: batchPaddyReceptionData.initialPaddy.humedad,
            parametrosDeterminados: progMatch?.parametrosDeterminados || (existingControl as any)?.parametrosDeterminados || (selectedBatch as any)?.parametrosDeterminados,
            parametrosRecomendadosIA: progMatch?.parametrosRecomendadosIA || (existingControl as any)?.parametrosRecomendadosIA || (selectedBatch as any)?.parametrosRecomendadosIA,
            datosIngreso: {
              ...existingControl.datosIngreso,
              ...newDatosIngreso
            },
            parametrosPaddy: mergedPaddy
          };
        } else {
          // Registro limpio inicializado reactivamente con los promedios del nuevo batch
          return getBlankPlantControlRecord(currentTargetBatchId, {
            batchCorrelativo: currentCorrelativo,
            cliente: batchClientName,
            variedad: batchVariedad,
            procedencia: batchPaddyReceptionData.procedencia,
            pesoKg: batchPaddyReceptionData.totalWeight,
            numSacos: batchPaddyReceptionData.sumSacos,
            operador: currentUser?.nombre || selectedBatch?.OPERADOR || "Operario de Planta",
            supervisor: "Jefe de Planta",
            parametrosDeterminados: progMatch?.parametrosDeterminados || (selectedBatch as any)?.parametrosDeterminados,
            parametrosRecomendadosIA: progMatch?.parametrosRecomendadosIA || (selectedBatch as any)?.parametrosRecomendadosIA,
            initialPaddy: batchPaddyReceptionData.initialPaddy
          });
        }
      }

      // Si es el mismo batch activo, actualizamos reactivamente los promedios de INGRESO y Datos de Ingreso
      // preservando los datos de proceso ingresados en piso (salida vaporizado, reposo secadora, salida secadora)
      const currentParamRows = (prev.parametrosPaddy && prev.parametrosPaddy.length > 0) ? prev.parametrosPaddy : emptyPaddy;
      const updatedPaddy = emptyPaddy.map((emptyRow) => {
        const found = currentParamRows.find((p) => p.parametro === emptyRow.parametro);
        if (found) {
          const newIngreso = emptyRow.ingresoVaporizado;
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

      return {
        ...prev,
        BATCH_ID: currentTargetBatchId,
        CORRELATIVO: currentCorrelativo,
        CLIENTE: batchClientName || prev.CLIENTE,
        VARIEDAD: batchVariedad || prev.VARIEDAD,
        TON_PROCESADAS: Number((batchPaddyReceptionData.totalWeight / 1000).toFixed(1)),
        HUMEDAD_INGRESO: batchPaddyReceptionData.initialPaddy.humedad,
        datosIngreso: {
          ...prev.datosIngreso,
          ...newDatosIngreso
        },
        parametrosPaddy: updatedPaddy
      };
    });
  }, [
    selectedBatchId,
    selectedBatch,
    batchClientName,
    batchVariedad,
    batchPaddyReceptionData,
    existingControl,
    currentUser
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
        procedencia: batchPaddyReceptionData.procedencia,
        codigo: selectedBatch?.CORRELATIVO || selectedBatch?.BATCH_ID || prev.datosIngreso?.codigo || "",
        numSacos: batchPaddyReceptionData.sumSacos,
        pesoKg: selectedBatch?.PESO_TOTAL_KG || batchPaddyReceptionData.totalWeight,
        pesoTotalKg: selectedBatch?.PESO_TOTAL_KG || batchPaddyReceptionData.totalWeight,
        variedad: batchVariedad,
        humedadPct: batchPaddyReceptionData.initialPaddy.humedad ?? 14.0,
        tiempoReposo: prev.datosIngreso?.tiempoReposo || ""
      };

      return {
        ...prev,
        HUMEDAD_INGRESO: batchPaddyReceptionData.initialPaddy.humedad ?? 14.0,
        TON_PROCESADAS: Number(((selectedBatch?.PESO_TOTAL_KG || batchPaddyReceptionData.totalWeight) / 1000).toFixed(1)),
        CLIENTE: prev.CLIENTE || batchClientName,
        datosIngreso: updatedDatosIngreso,
        parametrosPaddy: updatedPaddy
      };
    });

    setBannerNotice({
      type: "success",
      msg: `¡Datos de Ingreso y Parámetros del Paddy sincronizados con los promedios ponderados del Batch (${associatedBatchLotes.length} lotes)!`
    });
  }, [batchPaddyReceptionData, selectedBatch, batchVariedad, batchClientName, associatedBatchLotes.length]);

  // Handler: Eliminar datos guardados y resetear ficha en blanco para volver a cargar
  const handleResetearBatchData = useCallback(async () => {
    const currentBatchKey = selectedBatch?.BATCH_ID || selectedBatchId || "V200";
    const currentCorrelativo = selectedBatch?.CORRELATIVO || selectedBatch?.BATCH_ID || "V200";

    // 1. Limpiar localStorage drafts
    try {
      localStorage.removeItem(`apit_draft_ctrl_${currentBatchKey}`);
      localStorage.removeItem(`apit_draft_ctrl_V200`);
      localStorage.removeItem(`apit_draft_ctrl_${currentCorrelativo}`);
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
      cliente: batchClientName || "MOLINO SAN PEDRO S.A.C.",
      variedad: batchVariedad || "TINAJONES",
      procedencia: batchPaddyReceptionData.procedencia || "Tolvas de Recepción",
      pesoKg: selectedBatch?.PESO_TOTAL_KG || batchPaddyReceptionData.totalWeight || 27000,
      numSacos: batchPaddyReceptionData.sumSacos || "300 SACOS",
      operador: currentUser?.nombre || selectedBatch?.OPERADOR || "Operario de Planta",
      supervisor: "Jefe de Planta",
      initialPaddy: batchPaddyReceptionData.initialPaddy
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
    debounceMs: 650,
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
      const targetBatchToSave = formData.BATCH_ID || activeBatchId || "V200";
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

  // Handler: Cierre Total del Batch (Liquidación y Análisis de Calidad Completo)
  const handleConfirmarCierreTotal = async () => {
    if (!selectedBatch) return;

    if (!canCerrarBatch) {
      setBannerNotice({
        type: "error",
        msg: obtenerMensajeRestriccion("cerrar_aprobar_batch")
      });
      return;
    }

    setIsClosingBatch(true);
    try {
      const controlPayload = {
        ...formData,
        BATCH_ID: selectedBatch.BATCH_ID,
        FECHA_HORA_FIN: new Date().toISOString().replace("T", " ").substring(0, 16),
        OPERADOR: currentUser.nombre
      };

      const analisisPayload = {
        ...analisisFinal,
        BATCH_ID: selectedBatch.BATCH_ID,
        FECHA_ANALISIS: new Date().toISOString().replace("T", " ").substring(0, 16),
        OBSERVACIONES: `${dictamenCalidad}: ${observacionCierre}`
      };

      localDB.saveAnalisisVaporizado(analisisPayload, currentUser.nombre);
      localDB.cerrarTotalBatch(selectedBatch.BATCH_ID, controlPayload, currentUser.nombre);

      if (onRefreshData) onRefreshData();
      setShowCierreModal(false);
      setShowActaModal(true);
      setBannerNotice({
        type: "success",
        msg: `¡Batch ${selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID} cerrado y liquidado exitosamente!`
      });
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

  const isBatchCerrado = selectedBatch?.ESTADO_BATCH === "TERMINADO" || selectedBatch?.ESTADO_BATCH === "CERRADO";
  const isBatchEnProceso = selectedBatch?.ESTADO_BATCH === "EN PROCESO";
  const isBatchProgramado = selectedBatch?.ESTADO_BATCH === "PROGRAMADO";

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
                    BATCH CERRADO & LIQUIDADO
                  </span>
                )}
                {isBatchEnProceso && (
                  <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-1 animate-pulse">
                    <Zap className="w-3.5 h-3.5" />
                    EN EJECUCIÓN EN PLANTA
                  </span>
                )}
                {isBatchProgramado && (
                  <span className="px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold">
                    PROGRAMADO (PENDIENTE INICIO)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Formato industrial oficial de planta: Parámetros Paddy, Silos 1 al 6, Control de Secado 0-14, Autoclave y Liquidación Técnica.
              </p>
            </div>
          </div>
        </div>

        {/* Batch Selector and Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl shadow-inner">
            <label className="text-xs text-slate-400 font-medium">Batch Activo:</label>
            <select
              id="select-batch-control"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-black cursor-pointer"
            >
              {allBatches.map((b) => (
                <option key={b.BATCH_ID} value={b.BATCH_ID}>
                  {b.CORRELATIVO || b.BATCH_ID} - {b.CLIENTE ? `${b.CLIENTE.substring(0, 18)}...` : (b.ESTADO_BATCH || "PROGRAMADO")} ({b.VARIEDAD || "TINAJONES"})
                </option>
              ))}
            </select>
          </div>

          {isBatchProgramado && (
            <button
              id="btn-iniciar-vaporizado-planta"
              onClick={handleIniciarProcesoEnPlanta}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer animate-bounce"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar Vaporizado en Planta</span>
            </button>
          )}

          {!isBatchCerrado && (
            <button
              id="btn-abrir-cierre-batch"
              onClick={() => {
                if (!canCerrarBatch) {
                  setBannerNotice({
                    type: "error",
                    msg: obtenerMensajeRestriccion("cerrar_aprobar_batch")
                  });
                  return;
                }
                setShowCierreModal(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-white font-black text-xs shadow-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                canCerrarBatch
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95"
                  : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750"
              }`}
              title={canCerrarBatch ? "Cerrar y Liquidar Batch con Acta Oficial" : "Permiso exclusivo de Jefatura y Supervisión"}
            >
              <Lock className={`w-4 h-4 ${canCerrarBatch ? "text-white" : "text-amber-400"}`} />
              <span>Cerrar & Liquidar Batch</span>
            </button>
          )}

          {isBatchCerrado && (
            <button
              id="btn-ver-acta-cierre"
              onClick={() => setShowActaModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-300 border border-emerald-500/40 font-bold text-xs shadow flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Ver Acta de Cierre</span>
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


      {/* View Mode Selector: Hoja Oficial (Excel exacto) / Monitoreo Gráfico */}
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

      {/* RENDER VIEW ACCORDING TO SELECTED MODE */}
      {vistaModo === "hoja_oficial" && (
        <HojaControlVaporizadoOficial
          formData={formData}
          setFormData={setFormData}
          batchId={selectedBatch?.BATCH_ID || selectedBatchId}
          batchCorrelativo={selectedBatch?.CORRELATIVO || selectedBatch?.BATCH_ID || "V200"}
          batchClient={batchClientName}
          batchVariedad={batchVariedad}
          onSyncBatchAverages={handleReaplicarPromediosBatch}
          onResetBatchData={handleResetearBatchData}
          onSave={() => handleSubmitControl()}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
          autoSaveStatus={autoSaveStatus}
          lastSavedTime={lastSavedTime}
          onNavigate={onNavigate}
        />
      )}

      {vistaModo === "graficas_tendencias" && (
        <GraficaSecadoMonitoreo
          perfiles={formData.perfilesSecado || DEFAULT_PERFILES_SECADO}
          batchCorrelativo={selectedBatch?.CORRELATIVO || selectedBatch?.BATCH_ID || "V200"}
          variedad={batchVariedad}
        />
      )}

      {/* MODAL: CIERRE Y LIQUIDACIÓN DEFINITIVA DEL BATCH */}
      {showCierreModal && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Cierre & Liquidación de Batch</h3>
                  <p className="text-xs text-slate-400">
                    Batch: <span className="text-amber-400 font-bold">{selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}</span> — {batchClientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCierreModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                <span>Resultados de Calidad Post-Vaporizado (Laboratorio APIT)</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Humedad Final (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(analisisFinal.HUMEDAD, 12.8)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, HUMEDAD: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-300"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Blancura Kett (BL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(analisisFinal.BL, 39.5)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, BL: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Gelatinización (G %)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={safeNumVal(analisisFinal.GI, 98.0)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, GI: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-black text-cyan-300"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rend. Blanco (RB %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(analisisFinal.RB, 70.8)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, RB: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Quebrado Blanco (QB %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(analisisFinal.QB, 14.0)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, QB: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-300"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rend. Integral (RI %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(analisisFinal.RI, 77.5)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, RI: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Trizado (TZ %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(analisisFinal.TZ, 1.5)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, TZ: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Manchados (M %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(analisisFinal.M, 0.6)}
                    onChange={(e) => setAnalisisFinal(p => ({ ...p, M: parseNumberOrZero(e.target.value) }))}
                    className="w-full bg-slate-850 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                </div>
              </div>

              {/* Dictamen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Dictamen Técnico</label>
                  <select
                    value={dictamenCalidad}
                    onChange={(e) => setDictamenCalidad(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs font-black text-emerald-300 cursor-pointer"
                  >
                    <option value="CONFORME">✅ CONFORME (APROBADO)</option>
                    <option value="APROBADO_OBSERVADO">⚠️ APROBADO CON OBSERVACIÓN</option>
                    <option value="NO_CONFORME">⛔ NO CONFORME / REPROCESO</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Observaciones Finales de Cierre</label>
                  <input
                    type="text"
                    value={observacionCierre}
                    onChange={(e) => setObservacionCierre(e.target.value)}
                    placeholder="Conclusiones operativas..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-medium"
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-1 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Impacto Operativo</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  El Batch {selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID} pasará a estado <strong>"TERMINADO"</strong> y sus lotes asociados pasarán a <strong>"PROCESADO"</strong>, saliendo definitivamente de las listas de programación pendiente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCierreModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isClosingBatch}
                onClick={handleConfirmarCierreTotal}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{isClosingBatch ? "Cerrando..." : "Confirmar Cierre & Liquidar Batch"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ACTA Y CERTIFICADO OFICIAL DE CIERRE DE BATCH */}
      {showActaModal && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 text-white max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 font-black tracking-widest uppercase">MOLINOS & PROCESOS APIT</span>
                  <h3 className="text-lg font-black text-white">Acta Oficial de Cierre & Liquidación de Batch</h3>
                  <span className="text-xs text-slate-300 font-mono">Registro N° ACTA-{selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-black">
                  ESTADO: CERRADO & LIQUIDADO
                </span>
              </div>
            </div>

            {/* Grid of Results */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Correlativo Batch:</span>
                <span className="font-black text-amber-400 text-sm">{selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}</span>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Cliente:</span>
                <span className="font-bold text-white truncate block">{batchClientName}</span>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Variedad:</span>
                <span className="font-bold text-cyan-300">{batchVariedad}</span>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Kilos Liquidados:</span>
                <span className="font-black text-emerald-400 text-sm">{(selectedBatch.PESO_TOTAL_KG || 35000).toLocaleString()} kg</span>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Humedad Final:</span>
                <span className="font-bold text-emerald-300">{analisisFinal.HUMEDAD}%</span>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Gelatinización:</span>
                <span className="font-bold text-cyan-300">{analisisFinal.GI}%</span>
              </div>
            </div>

            {/* Traceability of Associated Lots */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-750 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block">Lotes de Origen Procesados & Archivados:</span>
              <div className="flex flex-wrap gap-2">
                {associatedBatchLotes.map(bl => (
                  <span key={bl.LOTE_ID} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-mono text-cyan-300 text-xs">
                    {bl.LOTE_ID} ({bl.PESO_KG?.toLocaleString()} kg - PROCESADO)
                  </span>
                ))}
              </div>
            </div>

            {/* Dictamen */}
            <div className="bg-emerald-950/30 border border-emerald-500/40 p-4 rounded-xl space-y-1.5 text-xs">
              <span className="text-emerald-400 font-black block">Dictamen de Calidad: {dictamenCalidad}</span>
              <p className="text-slate-300 italic">"{observacionCierre}"</p>
              <div className="pt-2 text-[11px] text-slate-400 flex justify-between">
                <span>Responsable de Planta: <strong>{currentUser.nombre}</strong></span>
                <span>Fecha de Cierre: <strong>{new Date().toLocaleDateString()}</strong></span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Imprimir Acta Oficial</span>
              </button>

              <div className="flex items-center gap-2">
                {onNavigate && (
                  <button
                    onClick={() => {
                      setShowActaModal(false);
                      onNavigate("programacion");
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span>Ir a Programación de Batches</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowActaModal(false)}
                  className="px-4 py-2.5 bg-slate-750 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
