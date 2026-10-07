import React, { useState, useEffect, useMemo } from "react";
import { ControlVaporizado, SiloControlPlant, PerfilSecadoPlant, ParametroPaddyRow } from "../types";
import { 
  Printer, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Flame, 
  Wind, 
  Thermometer, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Download,
  AlertCircle,
  Camera,
  Check,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  History,
  Info,
  Gauge,
  Zap,
  Target,
  BookOpen,
  BrainCircuit,
  Play,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  LayoutGrid,
  Columns,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Trash2,
  FileSpreadsheet
} from "lucide-react";
import { 
  DEFAULT_PARAMETROS_PADDY, 
  DEFAULT_SILOS_PLANT, 
  DEFAULT_ETAPA_REPOSO_1,
  DEFAULT_ETAPA_ENFRIAMIENTO,
  DEFAULT_ETAPA_REPOSO_2,
  DEFAULT_PERFILES_SECADO, 
  DEFAULT_RECETA_SECADO,
  createEmptyParametrosPaddy
} from "../utils/plantSheetDefaults";
import { 
  cargarProgramacionesOficiales,
  guardarProgramacionesOficiales,
  ProgramacionBatchOficial
} from "../utils/programacionBatchOficialService";
import { 
  proponerRecetaSecadoOptima,
  guardarRegistroHistoricoSecado,
  sincronizarRecetaDesdePerfiles,
  getHistoricoSecado,
  RecetaSecadoItem,
  PropuestaRecetaResponse,
  RegistroHistoricoSecado
} from "../utils/secadoRecetaEngine";
import { PlantSheetOCRModal, SeccionOCR, SECCIONES_OCR_INFO } from "./PlantSheetOCRModal";
import { safeNumVal, parseOptionalNumber } from "../utils/numberUtils";

interface HojaControlVaporizadoOficialProps {
  formData: Partial<ControlVaporizado>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ControlVaporizado>>>;
  batchId?: string;
  batchCorrelativo?: string;
  batchClient?: string;
  batchVariedad?: string;
  onSyncBatchAverages?: () => void;
  onResetBatchData?: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  autoSaveStatus?: "idle" | "saving" | "saved" | "error";
  lastSavedTime?: string;
  onNavigate?: (tab: string, filterId?: string) => void;
}

export const HojaControlVaporizadoOficial: React.FC<HojaControlVaporizadoOficialProps> = ({
  formData,
  setFormData,
  batchId = "",
  batchCorrelativo = "",
  batchClient = "",
  batchVariedad = "",
  onSyncBatchAverages,
  onResetBatchData,
  onSave,
  isSaving,
  saveSuccess,
  autoSaveStatus = "saved",
  lastSavedTime = "",
  onNavigate
}) => {
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [currentOCRSeccion, setCurrentOCRSeccion] = useState<SeccionOCR>("DATOS_INGRESO");
  const [ocrSuccessToast, setOcrSuccessToast] = useState<string | null>(null);
  const [siloActivePase, setSiloActivePase] = useState<1 | 2>(1);
  const [silo2PasesView, setSilo2PasesView] = useState<"tabs" | "comparativo">("tabs");
  const [progsVersion, setProgsVersion] = useState(0);
  const [progsList, setProgsList] = useState<ProgramacionBatchOficial[]>(() => cargarProgramacionesOficiales());

  // Escuchar eventos de actualización de programaciones para reflejar cambios inmediatamente
  useEffect(() => {
    const list = cargarProgramacionesOficiales();
    if (Array.isArray(list) && list.length > 0) {
      setProgsList(list);
    }

    const handleUpdate = () => {
      setProgsList(cargarProgramacionesOficiales());
      setProgsVersion(v => v + 1);
    };
    window.addEventListener("programaciones-oficiales-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("programaciones-oficiales-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [batchCorrelativo, batchId]);

  // Estados para desglosar/plegar las etapas de reposo (1° Reposo y 2° Reposo - No siempre se utilizan)
  const [isReposo1Desglosado, setIsReposo1Desglosado] = useState(false);
  const [isReposo2Desglosado, setIsReposo2Desglosado] = useState(false);

  // Estados para el Módulo Inteligente de Recetas de Secado (Meta Térmica de Grano: 31.0°C ± 1.0°C)
  const [recetaLayoutMode, setRecetaLayoutMode] = useState<"lateral_derecha" | "cinta_superior" | "lateral_izquierda" | "oculto">("lateral_derecha");
  const [isPanelRecetaOpen, setIsPanelRecetaOpen] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [humedadEntradaSecado, setHumedadEntradaSecado] = useState<number>(() => {
    const h = formData.datosIngreso?.humedadPct || formData.HUMEDAD_INGRESO;
    return typeof h === "number" && h > 0 ? h : 16.5;
  });
  const [tempAmbienteSecado, setTempAmbienteSecado] = useState<number>(26.0);
  const [humedadRelativaSecado, setHumedadRelativaSecado] = useState<number>(65.0);
  const [propuestaReceta, setPropuestaReceta] = useState<PropuestaRecetaResponse | null>(null);
  const [historicoRecetas, setHistoricoRecetas] = useState<RegistroHistoricoSecado[]>(() => getHistoricoSecado());

  // Auto-cálculo de la propuesta óptima cuando cambian las condiciones de entrada
  useEffect(() => {
    const prop = proponerRecetaSecadoOptima({
      humedadInicial: humedadEntradaSecado,
      tempAmbiente: tempAmbienteSecado,
      humedadRelativa: humedadRelativaSecado,
      variedad: batchVariedad || formData.datosIngreso?.variedad || "TINAJONES"
    });
    setPropuestaReceta(prop);
  }, [humedadEntradaSecado, tempAmbienteSecado, humedadRelativaSecado, batchVariedad, formData.datosIngreso?.variedad]);

  // Búsqueda de la Programación Oficial del Batch para autocargar sus parámetros evaluados
  const programacionOficialBatch = useMemo<ProgramacionBatchOficial | null>(() => {
    try {
      const progs = progsList.length > 0 ? progsList : cargarProgramacionesOficiales();
      if (!progs || progs.length === 0) return null;

      const rawTarget = (batchCorrelativo || batchId || formData.CODIGO_INTERNO || formData.datosIngreso?.codigo || "").trim().toUpperCase();

      // 1. Coincidencia por batchCorrelativo exacto
      if (batchCorrelativo) {
        const cCorr = batchCorrelativo.trim().toUpperCase();
        const found = progs.find(p => (p.batch || "").trim().toUpperCase() === cCorr || (p.id || "").trim().toUpperCase() === cCorr);
        if (found) return found;
      }

      // 2. Coincidencia por batchId exacto
      if (batchId) {
        const cId = batchId.trim().toUpperCase();
        const found = progs.find(p => (p.batch || "").trim().toUpperCase() === cId || (p.id || "").trim().toUpperCase() === cId);
        if (found) return found;
      }

      // 3. Coincidencia por rawTarget
      if (rawTarget) {
        const found = progs.find(p => (p.batch || "").trim().toUpperCase() === rawTarget || (p.id || "").trim().toUpperCase() === rawTarget);
        if (found) return found;
      }

      // 4. Coincidencia alfanumérica flexible (eliminando guiones, espacios, etc.)
      if (rawTarget) {
        const cleanTarget = rawTarget.replace(/[^A-Z0-9]/g, "");
        if (cleanTarget) {
          const found = progs.find(p => {
            const cleanPBatch = (p.batch || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            const cleanPId = (p.id || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            return cleanPBatch === cleanTarget || cleanPId === cleanTarget || cleanTarget.includes(cleanPBatch) || cleanPBatch.includes(cleanTarget);
          });
          if (found) return found;
        }
      }

      // 5. Coincidencia por cliente si existe
      if (batchClient) {
        const cClient = batchClient.trim().toUpperCase();
        const found = progs.find(p => (p.clientePrincipal || "").trim().toUpperCase() === cClient);
        if (found) return found;
      }

      // Si no hubo coincidencia y solo existe 1 programación registrada, usar esa
      if (progs.length === 1) return progs[0];

      return null;
    } catch {
      return null;
    }
  }, [batchCorrelativo, batchId, batchClient, formData.CODIGO_INTERNO, formData.datosIngreso?.codigo, progsVersion, progsList]);

  // Parámetros Determinados por el Supervisor (con MÁXIMA PRIORIDAD sobre recomendaciones IA y valores estándar)
  const parametrosSupervisor = programacionOficialBatch?.parametrosDeterminados 
    || (formData as any)?.parametrosDeterminados 
    || null;

  const parametrosRecomendadosIA = programacionOficialBatch?.parametrosRecomendadosIA
    || (formData as any)?.parametrosRecomendadosIA
    || null;

  const presionRecomendadaProg = parametrosSupervisor?.presionBar 
    ?? parametrosRecomendadosIA?.presionBar 
    ?? (formData.PRESION_BAR && formData.PRESION_BAR > 0 ? formData.PRESION_BAR : 0.35);
  
  const velExclusaRecomendadaProg = parametrosSupervisor?.velExclusa 
    ?? parametrosRecomendadosIA?.velExclusa 
    ?? 4;

  const tiempoReposoRecomendadoProgMin = parametrosSupervisor?.tiempoReposoMin 
    ?? parametrosRecomendadosIA?.tiempoReposoMin 
    ?? (formData.TIEMPO_REPOSO_MIN && formData.TIEMPO_REPOSO_MIN > 0 ? formData.TIEMPO_REPOSO_MIN : 45);

  const tempSecadoRecomendadaProg = parametrosSupervisor?.tempSecadoC 
    ?? parametrosRecomendadosIA?.tempSecadoC 
    ?? 75;

  const observacionProg = programacionOficialBatch?.observacion 
    ?? formData.DESVIACION 
    ?? "LOTE CON HUMEDAD CONTROLADA";

  const rpmRecomendadaProg = 18; // Estándar de velocidad de autoclave en diseño de planta

  const presionPase1Prog = (parametrosSupervisor as any)?.presionPase1 
    ?? (parametrosRecomendadosIA as any)?.presionPase1 
    ?? (presionRecomendadaProg <= 0.35 ? Number(presionRecomendadaProg.toFixed(2)) : Number((presionRecomendadaProg - 0.05).toFixed(2)));

  const presionPase2Prog = (parametrosSupervisor as any)?.presionPase2 
    ?? (parametrosRecomendadosIA as any)?.presionPase2 
    ?? presionRecomendadaProg;

  const tiempoReposoPase1Prog = (parametrosSupervisor as any)?.tiempoReposoPase1 
    ? `${(parametrosSupervisor as any).tiempoReposoPase1} min` 
    : "10 min";

  const tiempoReposoPase2Prog = `${tiempoReposoRecomendadoProgMin} min`;

  const tempTrabajoRecomendadaProg = presionRecomendadaProg <= 0.38 
    ? "122 / 125" 
    : presionRecomendadaProg >= 0.50 
      ? "130 / 132" 
      : "128 / 130";

  // Sincronización automática de Datos de Ingreso y Parámetros del Paddy (promedios de programación)
  // sin necesidad de presionar ningún botón, cada vez que cambia el batch o la programación oficial.
  useEffect(() => {
    if (!programacionOficialBatch) return;

    const prog = programacionOficialBatch;
    const initialPaddyValues = {
      humedad: prog.promedios?.ph,
      ri: (prog as any).analisisPromedio?.ri ?? (prog.promedios as any)?.ri ?? 78.4,
      rb: (prog as any).analisisPromedio?.rb ?? (prog.promedios as any)?.rb ?? 71.4,
      q: prog.promedios?.qb ?? prog.promedios?.qi ?? 8.7,
      tt: prog.promedios?.tt ?? 1.6,
      tp: prog.promedios?.tp ?? 2.0,
      m: prog.promedios?.m ?? 0.5,
      tz: prog.promedios?.triz ?? 1.4,
      gi: (prog as any).analisisPromedio?.gi ?? (prog.promedios as any)?.gi ?? 98.0,
      gr: (prog as any).analisisPromedio?.gr ?? (prog.promedios as any)?.gr ?? 0.2,
      bl: prog.promedios?.blInt ?? 21.9,
      blp: prog.promedios?.blBlanco ?? 40.5,
      rem: (prog as any).analisisPromedio?.rm ?? (prog.promedios as any)?.rem ?? 7.0
    };

    setFormData(prev => {
      const currentParamRows = (prev.parametrosPaddy && prev.parametrosPaddy.length > 0)
        ? prev.parametrosPaddy
        : DEFAULT_PARAMETROS_PADDY;

      const mapping: Record<string, number | undefined> = {
        "H_I": initialPaddyValues.humedad,
        "R_I": initialPaddyValues.ri,
        "R_B": initialPaddyValues.rb,
        "Q": initialPaddyValues.q,
        "T_T": initialPaddyValues.tt,
        "T_P": initialPaddyValues.tp,
        "M": initialPaddyValues.m,
        "TZ": initialPaddyValues.tz,
        "G_I": initialPaddyValues.gi,
        "G_R": initialPaddyValues.gr,
        "BL_I": initialPaddyValues.bl,
        "BL_P": initialPaddyValues.blp,
        "REM": initialPaddyValues.rem
      };

      const updatedPaddy = currentParamRows.map(row => {
        const newIng = mapping[row.parametro] !== undefined ? mapping[row.parametro] : row.ingresoVaporizado;
        const sal = row.salidaSecadora;
        const newVar = (sal !== undefined && newIng !== undefined && !isNaN(sal) && !isNaN(newIng))
          ? Number((sal - newIng).toFixed(1))
          : row.variacion;
        return {
          ...row,
          ingresoVaporizado: newIng,
          variacion: newVar
        };
      });

      const procedenciasList = Array.from(new Set((prog.filasLote || []).map(f => (f as any).ubicacion || (f as any).procedencia).filter(Boolean)));
      const procedenciaStr = procedenciasList.length > 0 ? procedenciasList.join(", ") : (prev.datosIngreso?.procedencia || "Silo B-01, Silo B-03");

      const progPresion = prog.parametrosDeterminados?.presionBar ?? prog.parametrosRecomendadosIA?.presionBar ?? 0.35;
      const progVelExcl = String(prog.parametrosDeterminados?.velExclusa ?? prog.parametrosRecomendadosIA?.velExclusa ?? 4);
      const progReposo = prog.parametrosDeterminados?.tiempoReposoMin ?? prog.parametrosRecomendadosIA?.tiempoReposoMin ?? 60;
      const progPresP1 = (prog.parametrosDeterminados as any)?.presionPase1 
        ?? (prog.parametrosRecomendadosIA as any)?.presionPase1 
        ?? (progPresion <= 0.35 ? Number(progPresion.toFixed(2)) : Number((progPresion - 0.05).toFixed(2)));
      const progPresP2 = (prog.parametrosDeterminados as any)?.presionPase2 
        ?? (prog.parametrosRecomendadosIA as any)?.presionPase2 
        ?? progPresion;
      const progRepP1 = (prog.parametrosDeterminados as any)?.tiempoReposoPase1 ? `${(prog.parametrosDeterminados as any).tiempoReposoPase1} min` : "10 min";
      const progRepP2 = `${progReposo} min`;

      const prevVap = (prev.datosVaporizado as any) || {};
      const progModalidad = (prog.parametrosDeterminados as any)?.modalidadPases 
        || (prog.parametrosRecomendadosIA as any)?.modalidadPases 
        || prevVap.modalidadPases 
        || "1_PASE";

      const updatedVaporizado: any = {
        ...prevVap,
        modalidadPases: progModalidad,
        presionVapor: progPresion,
        inyeccionVapor: {
          inicio: prevVap.inyeccionVapor?.inicio || "",
          fin: prevVap.inyeccionVapor?.fin || "",
          duracion: prevVap.inyeccionVapor?.duracion || "",
          presion: progPresion,
          velExclusa: progVelExcl,
          tiempoReposo: `${progReposo} min`,
          rpm: 18,
          obs: prevVap.inyeccionVapor?.obs || "Inyección estándar directa"
        },
        inyeccionVaporPase1: {
          paseNumero: 1,
          inicio: prevVap.inyeccionVaporPase1?.inicio || "",
          fin: prevVap.inyeccionVaporPase1?.fin || "",
          duracion: prevVap.inyeccionVaporPase1?.duracion || "",
          presion: progPresP1,
          rpm: 18,
          vExcl: progVelExcl,
          tiempoReposo: progRepP1,
          obs: prevVap.inyeccionVaporPase1?.obs || "Pre-calentamiento gradual para evitar choque térmico"
        },
        inyeccionVaporPase2: {
          paseNumero: 2,
          inicio: prevVap.inyeccionVaporPase2?.inicio || "",
          fin: prevVap.inyeccionVaporPase2?.fin || "",
          duracion: prevVap.inyeccionVaporPase2?.duracion || "",
          presion: progPresP2,
          rpm: 18,
          vExcl: progVelExcl,
          tiempoReposo: progRepP2,
          obs: prevVap.inyeccionVaporPase2?.obs || "Gelatinización uniforme del almidón sin trizado"
        }
      };

      return {
        ...prev,
        BATCH_ID: prog.batch || prev.BATCH_ID,
        CORRELATIVO: prog.batch || prev.CORRELATIVO,
        CLIENTE: prog.clientePrincipal || prev.CLIENTE,
        VARIEDAD: prog.variedadPrincipal || prev.VARIEDAD,
        TON_PROCESADAS: prog.pesoTotalKg ? Number((prog.pesoTotalKg / 1000).toFixed(1)) : prev.TON_PROCESADAS,
        HUMEDAD_INGRESO: prog.promedios?.ph ?? prev.HUMEDAD_INGRESO,
        PRESION_BAR: progPresion,
        TIEMPO_REPOSO_MIN: progReposo,
        datosIngreso: {
          procedencia: procedenciaStr,
          codigo: prog.batch || prev.datosIngreso?.codigo || "V200",
          numSacos: prog.totalSacosProg ? `${prog.totalSacosProg} SACOS` : (prev.datosIngreso?.numSacos || "360 SACOS"),
          pesoKg: prog.pesoTotalKg || prev.datosIngreso?.pesoKg || 18000,
          pesoTotalKg: prog.pesoTotalKg || prev.datosIngreso?.pesoTotalKg || 18000,
          variedad: prog.variedadPrincipal || prev.datosIngreso?.variedad || "IR-43 MEJORADO",
          humedadPct: prog.promedios?.ph !== undefined ? prog.promedios.ph : (prev.datosIngreso?.humedadPct ?? 14.4),
          tiempoReposo: prev.datosIngreso?.tiempoReposo || ""
        },
        datosVaporizado: updatedVaporizado as any,
        parametrosPaddy: updatedPaddy
      };
    });
  }, [programacionOficialBatch]);

  // Ensure default structures are present without hardcoding past mock values
  const datosIngreso = {
    procedencia: formData.datosIngreso?.procedencia || "Silo B-01, Silo B-03",
    codigo: formData.datosIngreso?.codigo || batchCorrelativo || batchId || programacionOficialBatch?.batch || "V200",
    numSacos: formData.datosIngreso?.numSacos || (programacionOficialBatch?.totalSacosProg ? `${programacionOficialBatch.totalSacosProg} SACOS` : "360 SACOS"),
    pesoKg: formData.datosIngreso?.pesoKg ?? programacionOficialBatch?.pesoTotalKg ?? (formData.TON_PROCESADAS ? formData.TON_PROCESADAS * 1000 : 18000),
    pesoTotalKg: formData.datosIngreso?.pesoTotalKg ?? programacionOficialBatch?.pesoTotalKg ?? (formData.TON_PROCESADAS ? formData.TON_PROCESADAS * 1000 : 18000),
    variedad: formData.datosIngreso?.variedad || programacionOficialBatch?.variedadPrincipal || batchVariedad || "IR-43 MEJORADO",
    humedadPct: formData.datosIngreso?.humedadPct !== undefined ? formData.datosIngreso.humedadPct : (programacionOficialBatch?.promedios?.ph ?? formData.HUMEDAD_INGRESO ?? 14.4),
    tiempoReposo: formData.datosIngreso?.tiempoReposo ?? ""
  };

  const isLoteSecoDetected = (datosIngreso.humedadPct !== undefined && datosIngreso.humedadPct < 14.0);
  const currentModalidadPases = formData.datosVaporizado?.modalidadPases || (isLoteSecoDetected ? "2_PASES" : "1_PASE");

  const datosVaporizado = {
    modalidadPases: currentModalidadPases,
    motivoPases: formData.datosVaporizado?.motivoPases || (isLoteSecoDetected 
      ? "Lote Seco (<14% Humedad): Se aplican 2 pases de inyección de vapor para evitar trizado y shock térmico" 
      : "Lote Húmedo (≥14% Humedad): Proceso estándar de 1 solo pase directo"),
    llenadoTolvaPulmon: formData.datosVaporizado?.llenadoTolvaPulmon || { inicio: "", fin: "", duracion: "" },
    inyeccionVapor: formData.datosVaporizado?.inyeccionVapor || { 
      inicio: "", 
      fin: "", 
      duracion: "",
      presion: presionRecomendadaProg,
      velExclusa: String(velExclusaRecomendadaProg),
      tiempoReposo: `${tiempoReposoRecomendadoProgMin} min`,
      rpm: 18,
      obs: "Inyección estándar directa"
    },
    inyeccionVaporPase1: formData.datosVaporizado?.inyeccionVaporPase1 || { 
      inicio: "", 
      fin: "", 
      duracion: "", 
      presion: presionPase1Prog, 
      rpm: rpmRecomendadaProg, 
      vExcl: String(velExclusaRecomendadaProg),
      obs: "Pre-calentamiento gradual para evitar choque térmico", 
      tiempoReposo: tiempoReposoPase1Prog 
    },
    inyeccionVaporPase2: formData.datosVaporizado?.inyeccionVaporPase2 || { 
      inicio: "", 
      fin: "", 
      duracion: "", 
      presion: presionPase2Prog, 
      rpm: rpmRecomendadaProg, 
      vExcl: String(velExclusaRecomendadaProg),
      obs: "Gelatinización uniforme del almidón sin trizado", 
      tiempoReposo: tiempoReposoPase2Prog 
    },
    tiempoReposoInterPases: formData.datosVaporizado?.tiempoReposoInterPases || `${tiempoReposoRecomendadoProgMin} min`,
    tiempoTotalInyeccionMin: formData.datosVaporizado?.tiempoTotalInyeccionMin || "",
    presionVapor: formData.datosVaporizado?.presionVapor !== undefined ? formData.datosVaporizado.presionVapor : presionRecomendadaProg,
    rpm: formData.datosVaporizado?.rpm !== undefined ? formData.datosVaporizado.rpm : rpmRecomendadaProg,
    tempTrabajo: formData.datosVaporizado?.tempTrabajo || tempTrabajoRecomendadaProg
  };

  const parametrosPaddy = formData.parametrosPaddy && formData.parametrosPaddy.length > 0 
    ? formData.parametrosPaddy 
    : DEFAULT_PARAMETROS_PADDY;

  const rawSilosPase1 = formData.silosPase1 && formData.silosPase1.length >= 5
    ? formData.silosPase1.slice(0, 5)
    : (formData.silos && formData.silos.length >= 5 ? formData.silos.slice(0, 5) : DEFAULT_SILOS_PLANT.slice(0, 5));

  const rawSilosPase2 = formData.silosPase2 && formData.silosPase2.length >= 5
    ? formData.silosPase2.slice(0, 5)
    : DEFAULT_SILOS_PLANT.slice(0, 5);

  const silos = datosVaporizado.modalidadPases === "2_PASES"
    ? (siloActivePase === 2 ? rawSilosPase2 : rawSilosPase1)
    : (formData.silos && formData.silos.length >= 5 ? formData.silos.slice(0, 5) : DEFAULT_SILOS_PLANT.slice(0, 5));

  // Helper para cálculo automático de tiempo transcurrido en minutos entre dos horas (HH:MM, HH:MM:SS, o formato 12h con AM/PM)
  const calculateDuration = (inicio?: string, fin?: string): string => {
    if (!inicio || !fin) return "";
    const parseMins = (t: string): number | null => {
      if (!t) return null;
      const clean = t.trim().toUpperCase();
      const isPM = clean.includes("PM");
      const isAM = clean.includes("AM");
      const timeOnly = clean.replace(/[APM\s]/g, "");
      const parts = timeOnly.split(":").map(p => parseInt(p, 10));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        let hours = parts[0];
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
        return hours * 60 + parts[1];
      }
      return null;
    };

    const start = parseMins(inicio);
    const end = parseMins(fin);
    if (start === null || end === null) return "";

    let diff = end - start;
    if (diff < 0) {
      diff += 24 * 60; // Cruce de medianoche
    }
    return `${Math.round(diff)} min`;
  };

  // Helper para obtener la hora actual en formato HH:MM
  const getHoraActual = (): string => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const etapaReposo1 = formData.etapaReposo1 && formData.etapaReposo1.length >= 2
    ? formData.etapaReposo1
    : (formData.etapaReposo1 && formData.etapaReposo1.length === 1
        ? [formData.etapaReposo1[0], { ...DEFAULT_ETAPA_REPOSO_1[1], fecha: formData.etapaReposo1[0].fecha || DEFAULT_ETAPA_REPOSO_1[1].fecha }]
        : DEFAULT_ETAPA_REPOSO_1);

  const etapaEnfriamiento = formData.etapaEnfriamiento && formData.etapaEnfriamiento.length >= 2
    ? formData.etapaEnfriamiento
    : (formData.etapaEnfriamiento && formData.etapaEnfriamiento.length === 1
        ? [formData.etapaEnfriamiento[0], { ...DEFAULT_ETAPA_ENFRIAMIENTO[1], fecha: formData.etapaEnfriamiento[0].fecha || DEFAULT_ETAPA_ENFRIAMIENTO[1].fecha }]
        : DEFAULT_ETAPA_ENFRIAMIENTO);

  const etapaReposo2 = formData.etapaReposo2 && formData.etapaReposo2.length >= 2
    ? formData.etapaReposo2
    : (formData.etapaReposo2 && formData.etapaReposo2.length === 1
        ? [formData.etapaReposo2[0], { ...DEFAULT_ETAPA_REPOSO_2[1], fecha: formData.etapaReposo2[0].fecha || DEFAULT_ETAPA_REPOSO_2[1].fecha }]
        : DEFAULT_ETAPA_REPOSO_2);

  // Detección de datos registrados en 1° y 2° Reposo (para saber si desglosar automáticamente o mostrar advertencia)
  const hasReposo1Data = useMemo(() => {
    return etapaReposo1.some(r => !!r.horaInicio || (r.tempGrano !== undefined && r.tempGrano > 0) || !!r.humedad);
  }, [etapaReposo1]);

  const hasReposo2Data = useMemo(() => {
    return etapaReposo2.some(r => !!r.horaInicio || (r.tempGrano !== undefined && r.tempGrano > 0) || !!r.humedad);
  }, [etapaReposo2]);

  // Si el lote cargado ya contenía datos en Reposo 1 o 2, mantenerlos desglosados; de lo contrario, listos para desglosar (plegados)
  useEffect(() => {
    if (hasReposo1Data) {
      setIsReposo1Desglosado(true);
    }
  }, [batchCorrelativo, batchId]);

  useEffect(() => {
    if (hasReposo2Data) {
      setIsReposo2Desglosado(true);
    }
  }, [batchCorrelativo, batchId]);

  const perfilesSecado = formData.perfilesSecado && formData.perfilesSecado.length > 0
    ? formData.perfilesSecado
    : DEFAULT_PERFILES_SECADO;

  const recetaSecado = formData.recetaSecado || DEFAULT_RECETA_SECADO;

  // Hora de fin definitiva de la inyección de vapor según modalidad
  const horaFinInyeccionVapor = datosVaporizado.modalidadPases === "2_PASES"
    ? (datosVaporizado.inyeccionVaporPase2?.fin || datosVaporizado.inyeccionVapor?.fin || "")
    : (datosVaporizado.inyeccionVapor?.fin || "");

  const horaInicioInyeccionVapor = datosVaporizado.modalidadPases === "2_PASES"
    ? (datosVaporizado.inyeccionVaporPase1?.inicio || datosVaporizado.inyeccionVapor?.inicio || "")
    : (datosVaporizado.inyeccionVapor?.inicio || "");

  // Cálculos automáticos de tiempo por etapa secuencialmente conectadas
  const duracionVaporTotalCalc = datosVaporizado.modalidadPases === "2_PASES"
    ? (parseNumMins(calculateDuration(datosVaporizado.inyeccionVaporPase1?.inicio, datosVaporizado.inyeccionVaporPase1?.fin)) +
       parseNumMins(calculateDuration(datosVaporizado.inyeccionVaporPase2?.inicio, datosVaporizado.inyeccionVaporPase2?.fin)))
    : parseNumMins(calculateDuration(datosVaporizado.inyeccionVapor?.inicio, datosVaporizado.inyeccionVapor?.fin));

  const duracionReposoInterPasesCalc = calculateDuration(
    datosVaporizado.inyeccionVaporPase1?.fin,
    datosVaporizado.inyeccionVaporPase2?.inicio
  );

  const duracionDescargaAReposo1Calc = calculateDuration(
    horaFinInyeccionVapor,
    etapaReposo1[0]?.horaInicio
  );

  const duracionReposo1Calc = calculateDuration(etapaReposo1[0]?.horaInicio, etapaEnfriamiento[0]?.horaInicio) || 
    (etapaReposo1[0]?.tiempoMin ? `${etapaReposo1[0].tiempoMin}` : "");

  const duracionEnfriamientoCalc = calculateDuration(etapaEnfriamiento[0]?.horaInicio, etapaReposo2[0]?.horaInicio) || 
    (etapaEnfriamiento[0]?.tiempoMin ? `${etapaEnfriamiento[0].tiempoMin}` : "");

  const duracionReposo2Calc = calculateDuration(etapaReposo2[0]?.horaInicio, perfilesSecado[0]?.horaInicio) || 
    (etapaReposo2[0]?.tiempoMin ? `${etapaReposo2[0].tiempoMin}` : "");

  // Suma total de minutos de secado
  const secadoTotalMins = perfilesSecado.reduce((acc, p) => {
    if (p.tiempoMin !== undefined && p.tiempoMin !== null && p.tiempoMin !== "") {
      const val = typeof p.tiempoMin === "number" ? p.tiempoMin : parseInt(String(p.tiempoMin).replace(/\D/g, ""), 10);
      return acc + (isNaN(val) ? 0 : val);
    }
    return acc;
  }, 0);

  // Helper para extraer minutos numéricos
  function parseNumMins(str?: string | number): number {
    if (!str) return 0;
    if (typeof str === "number") return str;
    const num = parseInt(str.replace(/\D/g, ""), 10);
    return isNaN(num) ? 0 : num;
  }

  const totalCicloTermicoMins = duracionVaporTotalCalc +
    parseNumMins(duracionReposo1Calc) + 
    parseNumMins(duracionEnfriamientoCalc) + 
    parseNumMins(duracionReposo2Calc) + 
    secadoTotalMins;

  const totalProcesoMins = totalCicloTermicoMins;

  const handleOpenOCR = (seccion: SeccionOCR) => {
    setCurrentOCRSeccion(seccion);
    setIsOCRModalOpen(true);
  };

  const handleApplyOCRData = (seccion: SeccionOCR, extracted: any) => {
    if (!extracted) return;

    setFormData((prev) => {
      const updated = { ...prev };

      // 1. General & Metadata
      if (extracted.general) {
        if (extracted.general.fecha) updated.FECHA_HORA_INICIO = extracted.general.fecha;
        if (extracted.general.supervisor) updated.SUPERVISOR = extracted.general.supervisor;
        if (extracted.general.operario) updated.OPERADOR = extracted.general.operario;
        if (extracted.general.desviacion) updated.DESVIACION = extracted.general.desviacion;
      }
      if (extracted.FECHA && !updated.FECHA_HORA_INICIO) updated.FECHA_HORA_INICIO = extracted.FECHA;

      // 2. Datos de Ingreso
      if (seccion === "DATOS_INGRESO" || seccion === "HOJA_PLANTA_COMPLETA" || extracted.datosIngreso) {
        const ing = extracted.datosIngreso || extracted;
        const prevIng = updated.datosIngreso || datosIngreso;
        const newIng = {
          ...prevIng,
          procedencia: ing.procedencia || prevIng.procedencia,
          codigo: ing.codigo || ing.LOTE_ID || prevIng.codigo,
          numSacos: ing.numSacos || prevIng.numSacos,
          pesoKg: ing.pesoKg || ing.pesoTotalKg || prevIng.pesoKg,
          pesoTotalKg: ing.pesoTotalKg || ing.pesoKg || prevIng.pesoTotalKg,
          variedad: ing.variedad || prevIng.variedad,
          humedadPct: ing.humedadPct ?? ing.HUMEDAD ?? prevIng.humedadPct,
          tiempoReposo: ing.tiempoReposo || prevIng.tiempoReposo
        };
        updated.datosIngreso = newIng;
        if (newIng.humedadPct !== undefined) updated.HUMEDAD_INGRESO = newIng.humedadPct;
        if (newIng.pesoKg !== undefined) updated.TON_PROCESADAS = Number((newIng.pesoKg / 1000).toFixed(1));
      }

      // 3. Parámetros del Paddy
      if (seccion === "PARAMETROS_PADDY" || seccion === "HOJA_PLANTA_COMPLETA" || extracted.parametrosPaddy || extracted.RI !== undefined) {
        const currentParamRows = [...(updated.parametrosPaddy || parametrosPaddy)];
        
        // If array given by OCR
        if (Array.isArray(extracted.parametrosPaddy)) {
          extracted.parametrosPaddy.forEach((pRow: any) => {
            const idx = currentParamRows.findIndex(r => r.parametro === pRow.parametro || r.label.toLowerCase().includes((pRow.label || "").toLowerCase()));
            if (idx >= 0) {
              currentParamRows[idx] = {
                ...currentParamRows[idx],
                ingresoVaporizado: pRow.ingresoVaporizado ?? currentParamRows[idx].ingresoVaporizado,
                salidaVaporizado: pRow.salidaVaporizado ?? currentParamRows[idx].salidaVaporizado,
                reposoSecadora: pRow.reposoSecadora ?? currentParamRows[idx].reposoSecadora,
                salidaSecadora: pRow.salidaSecadora ?? currentParamRows[idx].salidaSecadora,
                variacion: pRow.variacion ?? currentParamRows[idx].variacion
              };
            }
          });
        }

        // Map individual quality fields
        const mapField = (paramCode: string, val: any) => {
          if (val !== undefined && val !== null && !isNaN(val)) {
            const idx = currentParamRows.findIndex(r => r.parametro === paramCode);
            if (idx >= 0) {
              currentParamRows[idx] = {
                ...currentParamRows[idx],
                ingresoVaporizado: Number(parseFloat(val).toFixed(1))
              };
            }
          }
        };

        mapField("H_I", extracted.HUMEDAD ?? extracted.H_I);
        mapField("R_I", extracted.RI ?? extracted.R_I);
        mapField("R_B", extracted.RB ?? extracted.R_B);
        mapField("Q", extracted.QI ?? extracted.Q ?? extracted.QUEBRADO);
        mapField("T_T", extracted.TT ?? extracted.T_T);
        mapField("T_P", extracted.TP ?? extracted.T_P);
        mapField("M", extracted.M ?? extracted.MANCHADOS ?? extracted.MANCHADO);
        mapField("TZ", extracted.TZ ?? extracted.TRIZADO);
        mapField("G_I", extracted.GI ?? extracted.G_I ?? extracted.GELATINIZACION);
        mapField("G_R", extracted.GR ?? extracted.G_R ?? extracted.GRANO_ROJO);
        mapField("BL_I", extracted.BL ?? extracted.BL_I ?? extracted.BLANCO_PULIDO);

        updated.parametrosPaddy = currentParamRows;
      }

      // 4. Datos de Vaporizado
      if (seccion === "DATOS_VAPORIZADO" || seccion === "HOJA_PLANTA_COMPLETA" || extracted.datosVaporizado || extracted.PRESION_BAR !== undefined) {
        const vap = extracted.datosVaporizado || {};
        const prevVap = updated.datosVaporizado || datosVaporizado;
        
        const iniP1 = vap.inyeccionVaporPase1?.inicio || prevVap.inyeccionVaporPase1?.inicio || "";
        const finP1 = vap.inyeccionVaporPase1?.fin || prevVap.inyeccionVaporPase1?.fin || "";
        const iniP2 = vap.inyeccionVaporPase2?.inicio || prevVap.inyeccionVaporPase2?.inicio || "";
        const finP2 = vap.inyeccionVaporPase2?.fin || prevVap.inyeccionVaporPase2?.fin || "";
        
        const modPases = vap.modalidadPases || prevVap.modalidadPases || (vap.inyeccionVaporPase2?.inicio ? "2_PASES" : undefined);

        updated.datosVaporizado = {
          ...prevVap,
          modalidadPases: modPases,
          llenadoTolvaPulmon: {
            inicio: vap.llenadoTolvaPulmon?.inicio || prevVap.llenadoTolvaPulmon?.inicio || "",
            fin: vap.llenadoTolvaPulmon?.fin || prevVap.llenadoTolvaPulmon?.fin || "",
            duracion: calculateDuration(vap.llenadoTolvaPulmon?.inicio || prevVap.llenadoTolvaPulmon?.inicio, vap.llenadoTolvaPulmon?.fin || prevVap.llenadoTolvaPulmon?.fin)
          },
          inyeccionVapor: {
            inicio: vap.inyeccionVapor?.inicio || prevVap.inyeccionVapor?.inicio || "",
            fin: vap.inyeccionVapor?.fin || prevVap.inyeccionVapor?.fin || "",
            duracion: calculateDuration(vap.inyeccionVapor?.inicio || prevVap.inyeccionVapor?.inicio, vap.inyeccionVapor?.fin || prevVap.inyeccionVapor?.fin)
          },
          inyeccionVaporPase1: {
            paseNumero: 1,
            inicio: iniP1,
            fin: finP1,
            duracion: calculateDuration(iniP1, finP1) || vap.inyeccionVaporPase1?.duracion || prevVap.inyeccionVaporPase1?.duracion,
            presion: vap.inyeccionVaporPase1?.presion ?? prevVap.inyeccionVaporPase1?.presion ?? 0.45,
            rpm: vap.inyeccionVaporPase1?.rpm ?? prevVap.inyeccionVaporPase1?.rpm ?? 18,
            obs: vap.inyeccionVaporPase1?.obs || prevVap.inyeccionVaporPase1?.obs || "1° Pase (Acondicionamiento)",
            vExcl: vap.inyeccionVaporPase1?.vExcl ?? prevVap.inyeccionVaporPase1?.vExcl,
            excluso: vap.inyeccionVaporPase1?.excluso ?? (prevVap.inyeccionVaporPase1 as any)?.excluso,
            tiempoReposo: vap.inyeccionVaporPase1?.tiempoReposo || prevVap.inyeccionVaporPase1?.tiempoReposo
          },
          inyeccionVaporPase2: {
            paseNumero: 2,
            inicio: iniP2,
            fin: finP2,
            duracion: calculateDuration(iniP2, finP2) || vap.inyeccionVaporPase2?.duracion || prevVap.inyeccionVaporPase2?.duracion,
            presion: vap.inyeccionVaporPase2?.presion ?? prevVap.inyeccionVaporPase2?.presion ?? 0.45,
            rpm: vap.inyeccionVaporPase2?.rpm ?? prevVap.inyeccionVaporPase2?.rpm ?? 18,
            obs: vap.inyeccionVaporPase2?.obs || prevVap.inyeccionVaporPase2?.obs || "2° Pase (Cocción)",
            vExcl: vap.inyeccionVaporPase2?.vExcl ?? prevVap.inyeccionVaporPase2?.vExcl,
            excluso: vap.inyeccionVaporPase2?.excluso ?? (prevVap.inyeccionVaporPase2 as any)?.excluso,
            tiempoReposo: vap.inyeccionVaporPase2?.tiempoReposo || prevVap.inyeccionVaporPase2?.tiempoReposo
          },
          presionVapor: vap.presionVapor ?? extracted.PRESION_BAR ?? prevVap.presionVapor,
          rpm: vap.rpm ?? extracted.RPM ?? prevVap.rpm,
          tempTrabajo: vap.tempTrabajo || prevVap.tempTrabajo
        };
        if (updated.datosVaporizado.presionVapor !== undefined) {
          updated.PRESION_BAR = updated.datosVaporizado.presionVapor;
        }
        if (updated.datosVaporizado.rpm !== undefined) {
          updated.RPM = updated.datosVaporizado.rpm;
        }
      }

      // 5. Silos (1 al 5)
      if ((seccion === "SILOS" || seccion === "HOJA_PLANTA_COMPLETA") && Array.isArray(extracted.silos)) {
        const currentSilos = [...(updated.silos || silos)];
        extracted.silos.forEach((siloExt: any) => {
          const num = siloExt.siloNumber || 1;
          const targetIdx = num - 1;
          if (targetIdx >= 0 && targetIdx < 5) {
            const extExclusa = siloExt.exclusa || {};
            const extDescarga = siloExt.descarga || {};
            const iniExc = extExclusa.inicio || currentSilos[targetIdx]?.exclusa?.inicio;
            const finExc = extExclusa.fin || currentSilos[targetIdx]?.exclusa?.fin;
            const iniDesc = extDescarga.inicio || currentSilos[targetIdx]?.descarga?.inicio;
            const finDesc = extDescarga.fin || currentSilos[targetIdx]?.descarga?.fin;

            currentSilos[targetIdx] = {
              ...currentSilos[targetIdx],
              exclusa: {
                ...currentSilos[targetIdx].exclusa,
                ...extExclusa,
                tiempoLlenado: calculateDuration(iniExc, finExc) || extExclusa.tiempoLlenado || currentSilos[targetIdx]?.exclusa?.tiempoLlenado
              },
              tempSuperior: siloExt.tempSuperior ?? currentSilos[targetIdx].tempSuperior,
              tempInferior: siloExt.tempInferior ?? currentSilos[targetIdx].tempInferior,
              descarga: {
                ...currentSilos[targetIdx].descarga,
                ...extDescarga,
                tiempoDescarga: calculateDuration(iniDesc, finDesc) || extDescarga.tiempoDescarga || currentSilos[targetIdx]?.descarga?.tiempoDescarga || extDescarga.tiempo,
                tiempoReposo: calculateDuration(finExc, iniDesc) || extDescarga.tiempoReposo || currentSilos[targetIdx]?.descarga?.tiempoReposo
              }
            };
          }
        });
        if (datosVaporizado.modalidadPases === "2_PASES") {
          if (siloActivePase === 2) {
            updated.silosPase2 = currentSilos;
          } else {
            updated.silos = currentSilos;
            updated.silosPase1 = currentSilos;
          }
        } else {
          updated.silos = currentSilos;
          updated.silosPase1 = currentSilos;
        }
      }

      // 6. Etapas Previas y Perfiles de Secado
      if (seccion === "ETAPA_SECADO" || seccion === "HOJA_PLANTA_COMPLETA") {
        if (Array.isArray(extracted.etapaReposo1) && extracted.etapaReposo1.length > 0) {
          updated.etapaReposo1 = extracted.etapaReposo1;
        }
        if (Array.isArray(extracted.etapaEnfriamiento) && extracted.etapaEnfriamiento.length > 0) {
          updated.etapaEnfriamiento = extracted.etapaEnfriamiento;
        }
        if (Array.isArray(extracted.etapaReposo2) && extracted.etapaReposo2.length > 0) {
          updated.etapaReposo2 = extracted.etapaReposo2;
        }
        if (Array.isArray(extracted.perfilesSecado)) {
          const currentPerfiles = [...(updated.perfilesSecado || perfilesSecado)];
          extracted.perfilesSecado.forEach((perfExt: any) => {
            const pIdx = perfExt.perfilIndex !== undefined ? perfExt.perfilIndex : -1;
            if (pIdx >= 0 && pIdx < currentPerfiles.length) {
              currentPerfiles[pIdx] = {
                ...currentPerfiles[pIdx],
                ...perfExt
              };
            }
          });
          updated.perfilesSecado = currentPerfiles;
        }
      }

      return updated;
    });

    const sectionName = SECCIONES_OCR_INFO.find(s => s.id === seccion)?.label || seccion;
    setOcrSuccessToast(`Datos de fotografía aplicados correctamente a: ${sectionName}`);
    setTimeout(() => setOcrSuccessToast(null), 5000);
  };

  // Handlers for deep updates
  const handleStageRowChange = (
    stageKey: "etapaReposo1" | "etapaEnfriamiento" | "etapaReposo2",
    rowIdx: number,
    field: string,
    val: any
  ) => {
    const baseList = stageKey === "etapaReposo1" ? etapaReposo1 :
                     stageKey === "etapaEnfriamiento" ? etapaEnfriamiento :
                     etapaReposo2;
    const list = [...baseList];
    list[rowIdx] = {
      ...list[rowIdx],
      [field]: val
    };
    setFormData((prev) => ({
      ...prev,
      [stageKey]: list
    }));
  };

  const handleStageMateriaPrimaChange = (
    stageKey: "etapaReposo1" | "etapaEnfriamiento" | "etapaReposo2",
    rowIdx: number,
    field: "qPct" | "trizPct" | "blGrad",
    val: any
  ) => {
    const baseList = stageKey === "etapaReposo1" ? etapaReposo1 :
                     stageKey === "etapaEnfriamiento" ? etapaEnfriamiento :
                     etapaReposo2;
    const list = [...baseList];
    const prevMp = list[rowIdx]?.materiaPrima || {};
    list[rowIdx] = {
      ...list[rowIdx],
      materiaPrima: {
        ...prevMp,
        [field]: val
      }
    };
    setFormData((prev) => ({
      ...prev,
      [stageKey]: list
    }));
  };

  const handleStageModificacionesChange = (
    stageKey: "etapaReposo1" | "etapaEnfriamiento" | "etapaReposo2",
    rowIdx: number,
    field: "mod1" | "mod2" | "mod3",
    val: string
  ) => {
    const baseList = stageKey === "etapaReposo1" ? etapaReposo1 :
                     stageKey === "etapaEnfriamiento" ? etapaEnfriamiento :
                     etapaReposo2;
    const list = [...baseList];
    const prevMods = list[rowIdx]?.modificaciones || { mod1: "", mod2: "", mod3: "" };
    list[rowIdx] = {
      ...list[rowIdx],
      modificaciones: {
        ...prevMods,
        [field]: val
      }
    };
    setFormData((prev) => ({
      ...prev,
      [stageKey]: list
    }));
  };

  const handleRemoveStageRow = (
    stageKey: "etapaReposo1" | "etapaEnfriamiento" | "etapaReposo2",
    rowIdx: number
  ) => {
    const baseList = stageKey === "etapaReposo1" ? etapaReposo1 :
                     stageKey === "etapaEnfriamiento" ? etapaEnfriamiento :
                     etapaReposo2;
    if (baseList.length <= 1) return;
    const list = baseList.filter((_, idx) => idx !== rowIdx);
    setFormData((prev) => ({
      ...prev,
      [stageKey]: list
    }));
  };

  // Handlers for deep updates
  const handleIngresoChange = (field: string, val: any) => {
    if (field === "codigo") {
      const typed = String(val || "").trim().toUpperCase();
      const progs = cargarProgramacionesOficiales();
      const match = progs.find(p => (p.batch || "").trim().toUpperCase() === typed || (p.id || "").trim().toUpperCase() === typed) ||
                    progs.find(p => typed && ((p.batch || "").trim().toUpperCase().includes(typed) || typed.includes((p.batch || "").trim().toUpperCase())));
      
      if (match) {
        const initialPaddyValues = {
          humedad: match.promedios?.ph,
          ri: (match as any).analisisPromedio?.ri ?? (match.promedios as any)?.ri ?? 78.4,
          rb: (match as any).analisisPromedio?.rb ?? (match.promedios as any)?.rb ?? 71.4,
          q: match.promedios?.qb ?? match.promedios?.qi ?? 8.7,
          tt: match.promedios?.tt ?? 1.6,
          tp: match.promedios?.tp ?? 2.0,
          m: match.promedios?.m ?? 0.5,
          tz: match.promedios?.triz ?? 1.4,
          gi: (match as any).analisisPromedio?.gi ?? (match.promedios as any)?.gi ?? 98.0,
          gr: (match as any).analisisPromedio?.gr ?? (match.promedios as any)?.gr ?? 0.2,
          bl: match.promedios?.blInt ?? 21.9,
          blp: match.promedios?.blBlanco ?? 40.5,
          rem: (match as any).analisisPromedio?.rm ?? (match.promedios as any)?.rem ?? 7.0
        };
        const emptyPaddy = createEmptyParametrosPaddy(initialPaddyValues);

        setFormData((prev) => {
          const currentPaddy = (prev.parametrosPaddy && prev.parametrosPaddy.length > 0) ? prev.parametrosPaddy : emptyPaddy;
          const updatedPaddy = emptyPaddy.map((emp) => {
            const found = currentPaddy.find(p => p.parametro === emp.parametro);
            if (found) {
              const ing = emp.ingresoVaporizado !== undefined ? emp.ingresoVaporizado : found.ingresoVaporizado;
              const sal = found.salidaSecadora;
              const newVar = (sal !== undefined && ing !== undefined && !isNaN(sal) && !isNaN(ing)) ? Number((sal - ing).toFixed(1)) : found.variacion;
              return {
                ...found,
                ingresoVaporizado: ing,
                variacion: newVar
              };
            }
            return emp;
          });

          const procedenciasList = Array.from(new Set((match.filasLote || []).map(f => (f as any).ubicacion || (f as any).procedencia).filter(Boolean)));
          const procedenciaStr = procedenciasList.length > 0 ? procedenciasList.join(", ") : (prev.datosIngreso?.procedencia || "Silo B-01, Silo B-03");

          return {
            ...prev,
            BATCH_ID: match.batch || typed,
            CORRELATIVO: match.batch || typed,
            CLIENTE: match.clientePrincipal || prev.CLIENTE,
            VARIEDAD: match.variedadPrincipal || prev.VARIEDAD,
            TON_PROCESADAS: match.pesoTotalKg ? Number((match.pesoTotalKg / 1000).toFixed(1)) : prev.TON_PROCESADAS,
            HUMEDAD_INGRESO: match.promedios?.ph ?? prev.HUMEDAD_INGRESO,
            datosIngreso: {
              ...(prev.datosIngreso || datosIngreso),
              codigo: val,
              procedencia: procedenciaStr,
              numSacos: match.totalSacosProg ? `${match.totalSacosProg} SACOS` : (prev.datosIngreso?.numSacos || "360 SACOS"),
              pesoKg: match.pesoTotalKg || prev.datosIngreso?.pesoKg || 18000,
              pesoTotalKg: match.pesoTotalKg || prev.datosIngreso?.pesoTotalKg || 18000,
              variedad: match.variedadPrincipal || prev.datosIngreso?.variedad || "IR-43 MEJORADO",
              humedadPct: match.promedios?.ph !== undefined ? match.promedios.ph : (prev.datosIngreso?.humedadPct ?? 14.4),
              tiempoReposo: prev.datosIngreso?.tiempoReposo || ""
            },
            parametrosPaddy: updatedPaddy
          };
        });
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      ...(field === "codigo" ? { BATCH_ID: val, CORRELATIVO: val } : {}),
      datosIngreso: {
        ...(prev.datosIngreso || datosIngreso),
        [field]: val
      }
    }));
  };

  const aplicarParametrosProgramadosPaseUnico = () => {
    const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
    const updated = {
      ...cur,
      presion: presionRecomendadaProg,
      velExclusa: String(velExclusaRecomendadaProg),
      tiempoReposo: `${tiempoReposoRecomendadoProgMin} min`
    };
    handleVaporizadoHeaderChange("inyeccionVapor", updated);
    handleVaporizadoHeaderChange("presionVapor", presionRecomendadaProg);
    setFormData(prev => ({
      ...prev,
      PRESION_BAR: presionRecomendadaProg,
      TIEMPO_REPOSO_MIN: tiempoReposoRecomendadoProgMin,
      datosVaporizado: {
        ...(prev.datosVaporizado || {}),
        presionVapor: presionRecomendadaProg,
        inyeccionVapor: updated
      } as any
    }));
  };

  const aplicarParametrosProgramadosDoblePase = () => {
    handleVaporizadoPaseChange("inyeccionVaporPase1", "presion", presionPase1Prog);
    handleVaporizadoPaseChange("inyeccionVaporPase1", "vExcl", String(velExclusaRecomendadaProg));
    handleVaporizadoPaseChange("inyeccionVaporPase1", "tiempoReposo", tiempoReposoPase1Prog);

    handleVaporizadoPaseChange("inyeccionVaporPase2", "presion", presionPase2Prog);
    handleVaporizadoPaseChange("inyeccionVaporPase2", "vExcl", String(velExclusaRecomendadaProg));
    handleVaporizadoPaseChange("inyeccionVaporPase2", "tiempoReposo", tiempoReposoPase2Prog);

    handleVaporizadoHeaderChange("presionVapor", presionPase2Prog);

    setFormData(prev => ({
      ...prev,
      PRESION_BAR: presionPase2Prog,
      TIEMPO_REPOSO_MIN: tiempoReposoRecomendadoProgMin,
      datosVaporizado: {
        ...(prev.datosVaporizado || {}),
        presionVapor: presionPase2Prog,
        inyeccionVaporPase1: {
          ...(prev.datosVaporizado?.inyeccionVaporPase1 || {}),
          presion: presionPase1Prog,
          vExcl: String(velExclusaRecomendadaProg),
          tiempoReposo: tiempoReposoPase1Prog
        },
        inyeccionVaporPase2: {
          ...(prev.datosVaporizado?.inyeccionVaporPase2 || {}),
          presion: presionPase2Prog,
          vExcl: String(velExclusaRecomendadaProg),
          tiempoReposo: tiempoReposoPase2Prog
        }
      } as any
    }));
  };

  const handleVaporizadoHeaderChange = (field: string, val: any) => {
    setFormData((prev) => {
      const prevVap = prev.datosVaporizado || datosVaporizado;
      const updatedVap: any = {
        ...prevVap,
        [field]: val
      };
      if (field === "modalidadPases" && val === "2_PASES") {
        updatedVap.inyeccionVaporPase1 = {
          inicio: updatedVap.inyeccionVaporPase1?.inicio || "",
          fin: updatedVap.inyeccionVaporPase1?.fin || "",
          duracion: updatedVap.inyeccionVaporPase1?.duracion || "",
          presion: updatedVap.inyeccionVaporPase1?.presion !== undefined ? updatedVap.inyeccionVaporPase1.presion : presionPase1Prog,
          tiempoReposo: updatedVap.inyeccionVaporPase1?.tiempoReposo || tiempoReposoPase1Prog,
          vExcl: updatedVap.inyeccionVaporPase1?.vExcl || updatedVap.inyeccionVaporPase1?.excluso || String(velExclusaRecomendadaProg),
          rpm: updatedVap.inyeccionVaporPase1?.rpm || 18,
          obs: updatedVap.inyeccionVaporPase1?.obs || "Pre-calentamiento gradual para evitar choque térmico"
        };
        updatedVap.inyeccionVaporPase2 = {
          inicio: updatedVap.inyeccionVaporPase2?.inicio || "",
          fin: updatedVap.inyeccionVaporPase2?.fin || "",
          duracion: updatedVap.inyeccionVaporPase2?.duracion || "",
          presion: updatedVap.inyeccionVaporPase2?.presion !== undefined ? updatedVap.inyeccionVaporPase2.presion : presionPase2Prog,
          tiempoReposo: updatedVap.inyeccionVaporPase2?.tiempoReposo || tiempoReposoPase2Prog,
          vExcl: updatedVap.inyeccionVaporPase2?.vExcl || updatedVap.inyeccionVaporPase2?.excluso || String(velExclusaRecomendadaProg),
          rpm: updatedVap.inyeccionVaporPase2?.rpm || 18,
          obs: updatedVap.inyeccionVaporPase2?.obs || "Gelatinización uniforme del almidón sin trizado"
        };
      }
      return {
        ...prev,
        datosVaporizado: updatedVap
      };
    });
  };

  const handleVaporizadoPaseChange = (paseKey: "inyeccionVapor" | "inyeccionVaporPase1" | "inyeccionVaporPase2", field: string, val: any) => {
    setFormData((prev) => {
      const curVap = prev.datosVaporizado || datosVaporizado;
      const curPase = (curVap as any)[paseKey] || { inicio: "", fin: "" };
      const updatedPase = { ...curPase, [field]: val };
      if (field === "inicio" || field === "fin") {
        const dur = calculateDuration(updatedPase.inicio, updatedPase.fin);
        if (dur) updatedPase.duracion = dur;
      }
      return {
        ...prev,
        datosVaporizado: {
          ...curVap,
          [paseKey]: updatedPase
        } as any
      };
    });
  };

  const handleParamPaddyChange = (index: number, field: "ingresoVaporizado" | "salidaVaporizado" | "reposoSecadora" | "salidaSecadora", val: number | undefined) => {
    const updated = [...parametrosPaddy];
    const row = { ...updated[index], [field]: val };
    // Auto-calculate variation if both ingreso and salida exist
    const ing = field === "ingresoVaporizado" ? val : row.ingresoVaporizado;
    const sal = field === "salidaSecadora" ? val : row.salidaSecadora;
    if (ing !== undefined && sal !== undefined && !isNaN(ing) && !isNaN(sal)) {
      row.variacion = parseFloat((sal - ing).toFixed(1));
    } else {
      row.variacion = undefined;
    }
    updated[index] = row;
    setFormData((prev) => ({ ...prev, parametrosPaddy: updated }));
  };

  const updateSilosArray = (newSilos: SiloControlPlant[]) => {
    if (siloActivePase === 2) {
      setFormData((prev) => ({
        ...prev,
        silosPase2: newSilos
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        silos: newSilos,
        silosPase1: newSilos
      }));
    }
  };

  const handleSiloExclusaChange = (siloIdx: number, field: string, val: any) => {
    const currentBase = (siloActivePase === 2 ? rawSilosPase2 : rawSilosPase1);
    const updated = currentBase.map((s, i) => i === siloIdx ? { ...s, exclusa: { ...s.exclusa }, descarga: { ...s.descarga } } : s);
    const prevExclusa = updated[siloIdx]?.exclusa || { inicio: "", fin: "" };
    const newExclusa = {
      ...prevExclusa,
      [field]: val
    };
    if (field === "inicio" || field === "fin") {
      const calc = calculateDuration(newExclusa.inicio, newExclusa.fin);
      if (calc) {
        newExclusa.tiempoLlenado = calc;
      }
    }
    const prevDescarga = updated[siloIdx]?.descarga || { inicio: "", fin: "" };
    const newDescarga = { ...prevDescarga };
    if (field === "fin" || field === "inicio") {
      const reposoCalc = calculateDuration(newExclusa.fin, newDescarga.inicio);
      if (reposoCalc) {
        newDescarga.tiempoReposo = reposoCalc;
      }
    }
    updated[siloIdx] = {
      ...updated[siloIdx],
      siloNumber: updated[siloIdx]?.siloNumber || (siloIdx + 1),
      exclusa: newExclusa,
      descarga: newDescarga
    };
    updateSilosArray(updated);
  };

  const handleSiloTempChange = (siloIdx: number, field: "tempSuperior" | "tempInferior", val: any) => {
    const currentBase = (siloActivePase === 2 ? rawSilosPase2 : rawSilosPase1);
    const updated = currentBase.map((s, i) => i === siloIdx ? { ...s } : s);
    updated[siloIdx] = {
      ...updated[siloIdx],
      siloNumber: updated[siloIdx]?.siloNumber || (siloIdx + 1),
      [field]: val
    };
    updateSilosArray(updated);
  };

  const handleSiloDescargaChange = (siloIdx: number, field: string, val: any) => {
    const currentBase = (siloActivePase === 2 ? rawSilosPase2 : rawSilosPase1);
    const updated = currentBase.map((s, i) => i === siloIdx ? { ...s, exclusa: { ...s.exclusa }, descarga: { ...s.descarga } } : s);
    const prevDescarga = updated[siloIdx]?.descarga || { inicio: "", fin: "" };
    const newDescarga = {
      ...prevDescarga,
      [field]: val
    };
    if (field === "inicio" || field === "fin") {
      const calc = calculateDuration(newDescarga.inicio, newDescarga.fin);
      if (calc) {
        newDescarga.tiempoDescarga = calc;
        newDescarga.tiempo = calc;
      }
    }
    // T. REPOSO = H.INICIO Descarga - H.FINAL Llenado de Silos
    const currentExclusa = updated[siloIdx]?.exclusa || { inicio: "", fin: "" };
    if (field === "inicio") {
      const reposoCalc = calculateDuration(currentExclusa.fin, newDescarga.inicio);
      if (reposoCalc) {
        newDescarga.tiempoReposo = reposoCalc;
      }
    }
    updated[siloIdx] = {
      ...updated[siloIdx],
      siloNumber: updated[siloIdx]?.siloNumber || (siloIdx + 1),
      descarga: newDescarga
    };
    updateSilosArray(updated);
  };

  const handleSpecificPaseSiloExclusaChange = (paseNum: 1 | 2, siloIdx: number, field: string, val: any) => {
    const targetSilos = (paseNum === 2 ? [...rawSilosPase2] : [...rawSilosPase1]).map((s, i) => 
      i === siloIdx ? { ...s, exclusa: { ...s.exclusa }, descarga: { ...s.descarga } } : s
    );
    const prevExclusa = targetSilos[siloIdx]?.exclusa || { inicio: "", fin: "" };
    const newExclusa = {
      ...prevExclusa,
      [field]: val
    };
    if (field === "inicio" || field === "fin") {
      const calc = calculateDuration(newExclusa.inicio, newExclusa.fin);
      if (calc) {
        newExclusa.tiempoLlenado = calc;
      }
    }
    const prevDescarga = targetSilos[siloIdx]?.descarga || { inicio: "", fin: "" };
    const newDescarga = { ...prevDescarga };
    if (field === "fin" || field === "inicio") {
      const reposoCalc = calculateDuration(newExclusa.fin, newDescarga.inicio);
      if (reposoCalc) {
        newDescarga.tiempoReposo = reposoCalc;
      }
    }
    targetSilos[siloIdx] = {
      ...targetSilos[siloIdx],
      exclusa: newExclusa,
      descarga: newDescarga
    };
    if (paseNum === 2) {
      setFormData((prev) => ({ ...prev, silosPase2: targetSilos }));
    } else {
      setFormData((prev) => ({ ...prev, silos: targetSilos, silosPase1: targetSilos }));
    }
  };

  const handleSpecificPaseSiloTempChange = (paseNum: 1 | 2, siloIdx: number, field: "tempSuperior" | "tempInferior", val: any) => {
    const targetSilos = paseNum === 2 ? [...rawSilosPase2] : [...rawSilosPase1];
    targetSilos[siloIdx] = {
      ...targetSilos[siloIdx],
      [field]: val
    };
    if (paseNum === 2) {
      setFormData((prev) => ({ ...prev, silosPase2: targetSilos }));
    } else {
      setFormData((prev) => ({ ...prev, silos: targetSilos, silosPase1: targetSilos }));
    }
  };

  const handleSpecificPaseSiloDescargaChange = (paseNum: 1 | 2, siloIdx: number, field: string, val: any) => {
    const targetSilos = (paseNum === 2 ? [...rawSilosPase2] : [...rawSilosPase1]).map((s, i) => 
      i === siloIdx ? { ...s, exclusa: { ...s.exclusa }, descarga: { ...s.descarga } } : s
    );
    const prevDescarga = targetSilos[siloIdx]?.descarga || { inicio: "", fin: "" };
    const newDescarga = {
      ...prevDescarga,
      [field]: val
    };
    if (field === "inicio" || field === "fin") {
      const calc = calculateDuration(newDescarga.inicio, newDescarga.fin);
      if (calc) {
        newDescarga.tiempoDescarga = calc;
        newDescarga.tiempo = calc;
      }
    }
    const currentExclusa = targetSilos[siloIdx]?.exclusa || { inicio: "", fin: "" };
    if (field === "inicio") {
      const reposoCalc = calculateDuration(currentExclusa.fin, newDescarga.inicio);
      if (reposoCalc) {
        newDescarga.tiempoReposo = reposoCalc;
      }
    }
    targetSilos[siloIdx] = {
      ...targetSilos[siloIdx],
      descarga: newDescarga
    };
    if (paseNum === 2) {
      setFormData((prev) => ({ ...prev, silosPase2: targetSilos }));
    } else {
      setFormData((prev) => ({ ...prev, silos: targetSilos, silosPase1: targetSilos }));
    }
  };

  const handleCopiarSilosPase1APase2 = () => {
    setFormData((prev) => ({
      ...prev,
      silosPase2: JSON.parse(JSON.stringify(rawSilosPase1))
    }));
    setOcrSuccessToast("Datos de Silos del 1° Pase copiados al 2° Pase");
    setTimeout(() => setOcrSuccessToast(null), 3500);
  };

  const handlePerfilSecadoChange = (perfilIdx: number, field: string, val: any) => {
    const updated = [...perfilesSecado];
    updated[perfilIdx] = {
      ...updated[perfilIdx],
      [field]: val
    };
    // Sincronizar automáticamente la receta de la izquierda conforme se va ingresando la información (Perfil, Tiempo, Temp Programada, Temp Grano)
    const updatedReceta = sincronizarRecetaDesdePerfiles(updated, recetaSecado as any);
    setFormData((prev) => ({ 
      ...prev, 
      perfilesSecado: updated,
      recetaSecado: updatedReceta
    }));
  };

  const handleRecetaItemChange = (perfilIdx: number, field: "tiempo" | "temp", val: number) => {
    const currentReceta = [...recetaSecado];
    currentReceta[perfilIdx] = {
      ...currentReceta[perfilIdx],
      [field]: val
    };
    // Sincronizar hacia los perfiles de secado de la tabla principal
    const updatedPerfiles = [...perfilesSecado];
    if (updatedPerfiles[perfilIdx]) {
      if (field === "tiempo") updatedPerfiles[perfilIdx].tiempoMin = val;
      if (field === "temp") updatedPerfiles[perfilIdx].tempProgramada = val;
    }
    setFormData((prev) => ({
      ...prev,
      recetaSecado: currentReceta,
      perfilesSecado: updatedPerfiles
    }));
  };

  const handleAplicarPropuestaReceta = () => {
    const prop = propuestaReceta || proponerRecetaSecadoOptima({
      humedadInicial: humedadEntradaSecado,
      tempAmbiente: tempAmbienteSecado,
      humedadRelativa: humedadRelativaSecado,
      variedad: batchVariedad || formData.datosIngreso?.variedad || "TINAJONES"
    });
    if (!propuestaReceta) setPropuestaReceta(prop);

    const updatedPerfiles = [...perfilesSecado];
    prop.receta.forEach((item, idx) => {
      if (updatedPerfiles[idx]) {
        updatedPerfiles[idx] = {
          ...updatedPerfiles[idx],
          tiempoMin: item.tiempo,
          tempProgramada: item.temp
        };
      }
    });

    setFormData((prev) => ({
      ...prev,
      recetaSecado: prop.receta,
      perfilesSecado: updatedPerfiles
    }));

    // Guardar en la base de aprendizaje
    guardarRegistroHistoricoSecado({
      loteId: formData.LOTE_ID || formData.datosIngreso?.codigo || "LOTE-S/N",
      batchId: batchId || formData.BATCH_ID || "BATCH-S/N",
      variedad: batchVariedad || formData.datosIngreso?.variedad || "TINAJONES",
      humedadInicial: humedadEntradaSecado,
      tempAmbientePromedio: tempAmbienteSecado,
      humedadRelativaPromedio: humedadRelativaSecado,
      tempGranoPromedio: prop.tempGranoEstimadaPromedio,
      receta: prop.receta,
      observaciones: `Receta propuesta aplicada para mantener grano en 31.0°C (±1°C). ${prop.explicacionTermodinamica}`
    });

    setHistoricoRecetas(getHistoricoSecado());
    setOcrSuccessToast("¡Receta de trabajo inteligente aplicada a los 13 perfiles! T° Grano meta: 31.0°C (±1°C).");
    setTimeout(() => setOcrSuccessToast(null), 5000);
  };

  const handleGuardarHistoricoManual = () => {
    const perfilesConGrano = perfilesSecado.filter(p => p.tempGrano !== undefined && p.tempGrano > 0);
    const avgGrano = perfilesConGrano.length > 0 
      ? perfilesConGrano.reduce((acc, p) => acc + (p.tempGrano || 0), 0) / perfilesConGrano.length
      : 31.0;

    const perfilesConAmb = perfilesSecado.filter(p => p.tempAmbiente !== undefined && p.tempAmbiente > 0);
    const avgAmb = perfilesConAmb.length > 0
      ? perfilesConAmb.reduce((acc, p) => acc + (p.tempAmbiente || 0), 0) / perfilesConAmb.length
      : tempAmbienteSecado;

    const perfilesConHR = perfilesSecado.filter(p => p.humedadRelativa !== undefined && p.humedadRelativa > 0);
    const avgHR = perfilesConHR.length > 0
      ? perfilesConHR.reduce((acc, p) => acc + (p.humedadRelativa || 0), 0) / perfilesConHR.length
      : humedadRelativaSecado;

    guardarRegistroHistoricoSecado({
      loteId: formData.LOTE_ID || formData.datosIngreso?.codigo || "LOTE-S/N",
      batchId: batchId || formData.BATCH_ID || "BATCH-S/N",
      variedad: batchVariedad || formData.datosIngreso?.variedad || "TINAJONES",
      humedadInicial: humedadEntradaSecado,
      humedadFinal: 12.8,
      tempAmbientePromedio: parseFloat(avgAmb.toFixed(1)),
      humedadRelativaPromedio: parseFloat(avgHR.toFixed(1)),
      tempGranoPromedio: parseFloat(avgGrano.toFixed(1)),
      receta: recetaSecado,
      perfiles: perfilesSecado,
      observaciones: `Registro de secado guardado. Promedio Grano: ${avgGrano.toFixed(1)}°C (Meta 31.0°C ±1°C)`
    });

    setHistoricoRecetas(getHistoricoSecado());
    setOcrSuccessToast("Registro de secado guardado en la Base Histórica. Se usará para proponer recetas a futuros lotes.");
    setTimeout(() => setOcrSuccessToast(null), 5000);
  };

  const handleCargarRecetaHistorica = (hist: RegistroHistoricoSecado) => {
    const updatedPerfiles = [...perfilesSecado];
    hist.receta.forEach((item, idx) => {
      if (updatedPerfiles[idx]) {
        updatedPerfiles[idx] = {
          ...updatedPerfiles[idx],
          tiempoMin: item.tiempo,
          tempProgramada: item.temp
        };
      }
    });

    setFormData((prev) => ({
      ...prev,
      recetaSecado: hist.receta,
      perfilesSecado: updatedPerfiles
    }));

    setHumedadEntradaSecado(hist.humedadInicial);
    setTempAmbienteSecado(hist.tempAmbientePromedio);
    setHumedadRelativaSecado(hist.humedadRelativaPromedio);
    setShowHistoricoModal(false);

    setOcrSuccessToast(`Receta histórica del Batch ${hist.batchId} (${hist.variedad}) cargada exitosamente.`);
    setTimeout(() => setOcrSuccessToast(null), 5000);
  };

  const handleGuardarTodo = () => {
    handleGuardarHistoricoManual();
    onSave();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* OCR Success Notification Toast */}
      {ocrSuccessToast && (
        <div className="p-3.5 bg-emerald-950 border border-emerald-500/80 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check className="w-4 h-4" />
            </div>
            <span>{ocrSuccessToast}</span>
          </div>
          <button 
            onClick={() => setOcrSuccessToast(null)}
            className="text-emerald-400 hover:text-white px-2 py-1 rounded text-[11px] cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
            📄 Formato Oficial de Hoja de Planta (Excel de Producción)
          </span>

          {/* Auto-Save Live Status Indicator */}
          {autoSaveStatus === "saving" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Guardando automáticamente...</span>
            </div>
          ) : autoSaveStatus === "error" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Copia guardada localmente (reintentando red...)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Guardado automático {lastSavedTime ? `(último: ${lastSavedTime})` : "activo"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Main Photo OCR Digitalization Button */}
          <button
            id="btn-scan-full-plant-sheet"
            type="button"
            onClick={() => handleOpenOCR("HOJA_PLANTA_COMPLETA")}
            className="px-3.5 py-2 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/50 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ring-1 ring-emerald-500/30"
            title="Toma una foto de la hoja física de planta completa o de una sección específica para autocompletar"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Digitalizar con Foto / OCR (IA)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Imprimir Ficha Oficial</span>
          </button>

          <button
            type="button"
            onClick={handleGuardarTodo}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Guardando..." : "Guardar Ficha"}</span>
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("batches", batchCorrelativo || batchId || "V200")}
              className="px-3.5 py-2 bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/50 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-colors cursor-pointer"
              title="Ir a la lista de batches para visualizar y gestionar el batch"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              <span>Ver en Batches</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 shadow animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>Ficha oficial de control guardada y sincronizada exitosamente con el sistema central.</span>
        </div>
      )}

      {/* PLANTILLA OFICIAL ESTILO EXCEL DE PLANTA (A4 Printable Layout) */}
      <div 
        id="plant-control-official-sheet" 
        className="bg-white text-slate-900 border-2 border-slate-400 rounded-xl p-4 sm:p-6 shadow-2xl overflow-x-auto print:border-none print:shadow-none print:p-0 font-sans"
        style={{ minWidth: "1150px" }}
      >
        {/* 1. HEADER BANNER */}
        <div className="text-center py-2 px-4 rounded bg-[#366427] text-white font-black text-sm tracking-wider uppercase shadow-sm border border-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-900/80 px-2.5 py-0.5 rounded text-[10px] font-bold border border-emerald-400/40 text-emerald-200 print:hidden">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Auto-guardado activo</span>
            </span>
          </div>
          <span className="tracking-wide">REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO</span>
          <div className="w-24 print:hidden" />
        </div>

        {/* 2. GENERAL METADATA ROW */}
        <div className="grid grid-cols-12 gap-2 mt-3 text-xs">
          {/* FECHA */}
          <div className="col-span-3 flex border border-slate-400 rounded">
            <span className="bg-slate-100 font-bold px-2 py-1.5 border-r border-slate-300 text-slate-700 w-24 flex items-center">FECHA:</span>
            <input
              type="text"
              value={formData.FECHA_HORA_INICIO?.substring(0, 10) || new Date().toISOString().substring(0, 10)}
              onChange={(e) => setFormData((p) => ({ ...p, FECHA_HORA_INICIO: e.target.value }))}
              className="px-2 py-1 flex-1 font-bold text-slate-900 focus:bg-amber-50 outline-none"
            />
          </div>

          {/* N° BATCH */}
          <div className="col-span-3 flex border border-slate-400 rounded">
            <span className="bg-slate-100 font-bold px-2 py-1.5 border-r border-slate-300 text-slate-700 w-24 flex items-center">N° BATCH:</span>
            <input
              type="text"
              value={formData.BATCH_ID || formData.CORRELATIVO || batchCorrelativo || ""}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((p) => ({ ...p, BATCH_ID: val, CORRELATIVO: val }));
                handleIngresoChange("codigo", val);
              }}
              placeholder="B001"
              className="px-2 py-1 flex-1 font-black text-emerald-800 text-center text-sm focus:bg-amber-50 outline-none"
            />
          </div>

          {/* SUPERVISOR */}
          <div className="col-span-3 flex border border-slate-400 rounded">
            <span className="bg-slate-100 font-bold px-2 py-1.5 border-r border-slate-300 text-slate-700 w-24 flex items-center">SUPERVISOR:</span>
            <input
              type="text"
              value={formData.SUPERVISOR ?? ""}
              placeholder="Jefe de Turno"
              onChange={(e) => setFormData((p) => ({ ...p, SUPERVISOR: e.target.value }))}
              className="px-2 py-1 flex-1 font-bold text-slate-900 uppercase focus:bg-amber-50 outline-none"
            />
          </div>

          {/* OPERARIO */}
          <div className="col-span-3 flex border border-slate-400 rounded">
            <span className="bg-slate-100 font-bold px-2 py-1.5 border-r border-slate-300 text-slate-700 w-24 flex items-center">OPERARIO:</span>
            <input
              type="text"
              value={formData.OPERADOR ?? ""}
              placeholder="Operador de Planta"
              onChange={(e) => setFormData((p) => ({ ...p, OPERADOR: e.target.value }))}
              className="px-2 py-1 flex-1 font-bold text-slate-900 uppercase focus:bg-amber-50 outline-none"
            />
          </div>

          {/* CLIENTE */}
          <div className="col-span-6 flex border border-slate-400 rounded">
            <span className="bg-slate-100 font-bold px-2 py-1.5 border-r border-slate-300 text-slate-700 w-24 flex items-center">CLIENTE:</span>
            <input
              type="text"
              value={formData.CLIENTE !== undefined ? formData.CLIENTE : (batchClient || "Cliente de Producción")}
              onChange={(e) => setFormData((p) => ({ ...p, CLIENTE: e.target.value }))}
              placeholder="Cliente de Producción"
              className="px-2 py-1 flex-1 font-black text-slate-900 uppercase focus:bg-amber-50 outline-none"
            />
          </div>

          {/* DESVIACIÓN */}
          <div className="col-span-6 flex border border-slate-400 rounded">
            <span className="bg-slate-100 font-bold px-2 py-1.5 border-r border-slate-300 text-slate-700 w-24 flex items-center">DESVIACIÓN:</span>
            <input
              type="text"
              value={formData.DESVIACION || ""}
              placeholder="Sin novedades / Parámetros conformes"
              onChange={(e) => setFormData((p) => ({ ...p, DESVIACION: e.target.value }))}
              className="px-2 py-1 flex-1 text-slate-800 focus:bg-amber-50 outline-none"
            />
          </div>
        </div>

        {/* BANNER OFICIAL: PARÁMETROS OPERATIVOS DE PLANTA ESTABLECIDOS EN LA PROGRAMACIÓN */}
        <div id="banner-parametros-operativos-planta" className="mt-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-400 rounded-xl p-2.5 shadow-md text-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/30 pb-1.5 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-xs">
                PARÁMETROS OPERATIVOS DE PLANTA ESTABLECIDOS
              </span>
              <span className="font-mono text-amber-300 font-bold text-xs bg-slate-950/80 px-2 py-0.5 rounded border border-amber-400/40">
                BATCH {programacionOficialBatch?.batch || batchCorrelativo || batchId || "V200"}
              </span>
              {parametrosSupervisor ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40 tracking-wide uppercase">
                  DETERMINADOS POR EL SUPERVISOR
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold text-[10px] border border-sky-500/40 tracking-wide uppercase">
                  PROGRAMACIÓN OFICIAL
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-300 font-semibold flex items-center gap-1.5">
              <span className="text-amber-400 font-bold">{programacionOficialBatch?.caso || "PROGRAMACIÓN"}</span>
              <span>•</span>
              <span>{programacionOficialBatch?.clientePrincipal || batchClient || "PEDRO BANCES MARTINEZ"}</span>
              <span>•</span>
              <span className="text-emerald-300 font-bold">{programacionOficialBatch?.variedadPrincipal || batchVariedad || "TINAJONES"}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            <div className="bg-slate-950/90 border border-amber-400/30 rounded-lg p-1.5 shadow-inner">
              <span className="block text-[9.5px] font-bold text-amber-400 uppercase tracking-wider">DE. (BAR)</span>
              <span className="text-base font-black text-white font-mono tracking-tight">{presionRecomendadaProg}</span>
              <span className="block text-[8px] text-slate-400 mt-0.5">Presión Vapor</span>
            </div>
            <div className="bg-slate-950/90 border border-amber-400/30 rounded-lg p-1.5 shadow-inner">
              <span className="block text-[9.5px] font-bold text-amber-400 uppercase tracking-wider">V. EXCL.</span>
              <span className="text-base font-black text-white font-mono tracking-tight">{velExclusaRecomendadaProg}</span>
              <span className="block text-[8px] text-slate-400 mt-0.5">Velocidad Esclusa</span>
            </div>
            <div className="bg-slate-950/90 border border-amber-400/30 rounded-lg p-1.5 shadow-inner">
              <span className="block text-[9.5px] font-bold text-amber-400 uppercase tracking-wider">T. REPOSO</span>
              <span className="text-base font-black text-white font-mono tracking-tight">{tiempoReposoRecomendadoProgMin} MIN</span>
              <span className="block text-[8px] text-slate-400 mt-0.5">Reposo Vaporizado</span>
            </div>
            <div className="bg-slate-950/90 border border-amber-400/30 rounded-lg p-1.5 shadow-inner">
              <span className="block text-[9.5px] font-bold text-amber-400 uppercase tracking-wider">TEMP. SEC</span>
              <span className="text-base font-black text-white font-mono tracking-tight">{tempSecadoRecomendadaProg}°</span>
              <span className="block text-[8px] text-slate-400 mt-0.5">Secado Columna</span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-slate-950/90 border border-amber-400/30 rounded-lg p-1.5 shadow-inner flex flex-col justify-center">
              <span className="block text-[9.5px] font-bold text-amber-400 uppercase tracking-wider">OBSERVACIÓN</span>
              <span className="text-[11px] font-black text-emerald-400 tracking-wide uppercase line-clamp-2 mt-0.5">
                {observacionProg}
              </span>
            </div>
          </div>
        </div>

        {/* 3. MIDDLE DUAL SECTION: [DATOS DE INGRESO & PARAMETROS DEL PADDY] vs [DATOS DE VAPORIZADO & SILOS] */}
        <div className="grid grid-cols-12 gap-3 mt-3">
          {/* LEFT SIDE: DATOS DE INGRESO & PARAMETROS DEL PADDY */}
          <div className="col-span-4 space-y-3">
            {/* DATOS DE INGRESO */}
            <div className="border border-slate-400 rounded overflow-hidden shadow-xs">
              <div className="bg-[#366427] text-white font-bold py-1 px-2 text-xs tracking-wide uppercase flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>DATOS DE INGRESO</span>
                  <span className="text-[9px] font-bold text-emerald-100 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    Auto-Batch
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-photo-ingreso"
                    type="button"
                    onClick={() => handleOpenOCR("DATOS_INGRESO")}
                    className="px-1.5 py-0.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded text-[9.5px] font-black flex items-center gap-0.5 shadow transition-all cursor-pointer print:hidden"
                    title="Llenar datos de ingreso tomando una foto de la libreta, ticket o guía"
                  >
                    <Camera className="w-2.5 h-2.5" />
                    <span>Foto</span>
                  </button>
                </div>
              </div>
              <div className="text-[11px] divide-y divide-slate-300 bg-white">
                <div className="flex">
                  <span className="w-32 bg-slate-100 font-bold px-2 py-1 text-slate-700 border-r border-slate-300">PROCEDENCIA</span>
                  <input
                    type="text"
                    value={datosIngreso.procedencia ?? ""}
                    placeholder="Valle / Molino origen"
                    onChange={(e) => handleIngresoChange("procedencia", e.target.value)}
                    className="px-2 py-1 flex-1 font-semibold outline-none"
                  />
                </div>
                <div className="flex">
                  <span className="w-32 bg-slate-100 font-bold px-2 py-1 text-slate-700 border-r border-slate-300">CODIGO :</span>
                  <input
                    type="text"
                    value={datosIngreso.codigo ?? ""}
                    placeholder="Cod Lote / Batch"
                    onChange={(e) => handleIngresoChange("codigo", e.target.value)}
                    className="px-2 py-1 flex-1 font-mono font-bold text-slate-900 outline-none"
                  />
                  <span className="bg-slate-100 font-bold px-2 py-1 text-slate-700 border-l border-r border-slate-300">PESO TOTAL</span>
                  <span className="px-2 py-1 w-20 font-bold text-slate-900 flex items-center">
                    {`${(((datosIngreso.pesoTotalKg || datosIngreso.pesoKg || 18000)) / 1000).toFixed(1)} TN`}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-32 bg-slate-100 font-bold px-2 py-1 text-slate-700 border-r border-slate-300">N° SCOS / SCAS</span>
                  <input
                    type="text"
                    value={datosIngreso.numSacos ?? ""}
                    placeholder="Ej. 420 SACOS"
                    onChange={(e) => handleIngresoChange("numSacos", e.target.value)}
                    className="px-2 py-1 flex-1 font-semibold outline-none"
                  />
                </div>
                <div className="flex">
                  <span className="w-32 bg-slate-100 font-bold px-2 py-1 text-slate-700 border-r border-slate-300">PESO :</span>
                  <input
                    type="number"
                    value={safeNumVal(datosIngreso.pesoKg)}
                    placeholder="35000"
                    onChange={(e) => handleIngresoChange("pesoKg", parseOptionalNumber(e.target.value))}
                    className="px-2 py-1 flex-1 font-bold text-emerald-900 outline-none"
                  />
                </div>
                <div className="flex">
                  <span className="w-32 bg-slate-100 font-bold px-2 py-1 text-slate-700 border-r border-slate-300">VARIEDAD</span>
                  <input
                    type="text"
                    value={datosIngreso.variedad || batchVariedad || ""}
                    placeholder="Variedad"
                    onChange={(e) => handleIngresoChange("variedad", e.target.value)}
                    className="px-2 py-1 flex-1 font-bold text-cyan-900 outline-none"
                  />
                </div>
                <div className="flex">
                  <span className="w-32 bg-slate-100 font-bold px-2 py-1 text-slate-700 border-r border-slate-300">% HUMEDAD</span>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumVal(datosIngreso.humedadPct)}
                    placeholder="14.0"
                    onChange={(e) => handleIngresoChange("humedadPct", parseOptionalNumber(e.target.value))}
                    className="px-2 py-1 flex-1 font-bold text-slate-900 outline-none"
                  />
                </div>
                <div className="flex border-t border-amber-300/80 bg-amber-50/60 transition-colors">
                  <span className="w-36 bg-amber-200/90 font-black px-2.5 py-1.5 text-amber-950 border-r border-amber-300 flex flex-col justify-center leading-tight shadow-xs select-none">
                    <span className="text-[10px] uppercase font-black tracking-tight text-amber-950 flex items-center gap-1">
                      <span>TIEMPO - REPOSO</span>
                    </span>
                    <span className="text-[8px] text-amber-900 font-bold uppercase tracking-tight">
                      (Reposo en Cáscara)
                    </span>
                  </span>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      value={datosIngreso.tiempoReposo ?? ""}
                      placeholder="⚠️ Llenar reposo en cáscara (ej: 45 min, 15 días)..."
                      onChange={(e) => handleIngresoChange("tiempoReposo", e.target.value)}
                      className={`px-2.5 py-1.5 w-full font-black text-xs outline-none transition-all ${
                        !datosIngreso.tiempoReposo
                          ? "bg-amber-100/95 text-amber-950 placeholder:text-amber-800/80 placeholder:font-bold border-2 border-dashed border-amber-400 focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-400"
                          : "bg-amber-200/50 text-amber-950 font-black border border-amber-300 focus:bg-white focus:border-amber-500"
                      }`}
                      title="Reposo en cáscara que tiene el arroz al ingresar — Ingrese el tiempo"
                    />
                    {!datosIngreso.tiempoReposo ? (
                      <span className="absolute right-2 px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 font-black text-[9px] uppercase tracking-wider pointer-events-none border border-amber-500 shadow-xs animate-pulse">
                        Llenar
                      </span>
                    ) : (
                      <span className="absolute right-2 px-1.5 py-0.5 rounded bg-amber-300/80 text-amber-950 font-bold text-[9px] pointer-events-none border border-amber-400">
                        🌾 En cáscara
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PARAMETROS DEL PADDY */}
            <div className="border border-slate-400 rounded overflow-hidden shadow-xs">
              <div className="bg-[#366427] text-white font-bold py-1 px-2 text-xs tracking-wide uppercase flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>PARAMETROS DEL PADDY</span>
                  <span className="text-[9px] font-bold text-emerald-100 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    Ingreso = Prom. Lotes
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-photo-paddy"
                    type="button"
                    onClick={() => handleOpenOCR("PARAMETROS_PADDY")}
                    className="px-1.5 py-0.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded text-[9.5px] font-black flex items-center gap-0.5 shadow transition-all cursor-pointer print:hidden"
                    title="Escanear reporte de análisis de calidad de paddy con foto"
                  >
                    <Camera className="w-2.5 h-2.5" />
                    <span>Foto</span>
                  </button>
                </div>
              </div>
              <table className="w-full text-[10.5px] border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-400 font-bold text-slate-800 text-center">
                    <th className="border-r border-slate-300 py-1 px-1 w-16" rowSpan={2}>DATOS</th>
                    <th className="border-r border-slate-300 py-0.5 px-1" colSpan={2}>VAPORIZADO</th>
                    <th className="border-r border-slate-300 py-0.5 px-1" colSpan={2}>SECADORA</th>
                    <th className="py-1 px-1 w-14" rowSpan={2}>VARIACIÓN</th>
                  </tr>
                  <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-700 text-center text-[10px]">
                    <th className="border-r border-slate-300 py-0.5 px-1 bg-emerald-50 text-emerald-950 font-bold">INGRESO</th>
                    <th className="border-r border-slate-300 py-0.5 px-1">SALIDA</th>
                    <th className="border-r border-slate-300 py-0.5 px-1">REPOSO</th>
                    <th className="border-r border-slate-300 py-0.5 px-1 bg-amber-50 text-amber-950 font-bold">SALIDA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-center">
                  {parametrosPaddy.map((row, idx) => {
                    const isBgHighlight = row.isHighlighted;
                    return (
                      <tr key={row.parametro} className={`hover:bg-slate-50 ${isBgHighlight ? "bg-amber-50/40" : ""}`}>
                        <td className="border-r border-slate-300 py-0.5 px-1 font-bold text-slate-800 text-left bg-slate-50">
                          {row.label}
                        </td>
                        {/* INGRESO VAPORIZADO (DATOS DE RECEPCIÓN PREVIOS) */}
                        <td className="border-r border-slate-300 py-0.5 px-0.5 bg-emerald-50/30">
                          <input
                            type="number"
                            step="0.1"
                            value={safeNumVal(row.ingresoVaporizado)}
                            placeholder="-"
                            onChange={(e) => handleParamPaddyChange(idx, "ingresoVaporizado", parseOptionalNumber(e.target.value))}
                            className="w-full text-center font-bold text-emerald-950 bg-transparent outline-none"
                          />
                        </td>
                        {/* SALIDA VAPORIZADO (VACÍO PARA LLENAR EN PLANTA) */}
                        <td className="border-r border-slate-300 py-0.5 px-0.5 bg-slate-50/50">
                          <input
                            type="number"
                            step="0.1"
                            value={safeNumVal(row.salidaVaporizado)}
                            placeholder=""
                            onChange={(e) => handleParamPaddyChange(idx, "salidaVaporizado", parseOptionalNumber(e.target.value))}
                            className="w-full text-center bg-transparent outline-none font-semibold"
                          />
                        </td>
                        {/* REPOSO SECADORA (VACÍO PARA LLENAR EN PLANTA) */}
                        <td className="border-r border-slate-300 py-0.5 px-0.5 bg-slate-50/50">
                          <input
                            type="number"
                            step="0.1"
                            value={safeNumVal(row.reposoSecadora)}
                            placeholder=""
                            onChange={(e) => handleParamPaddyChange(idx, "reposoSecadora", parseOptionalNumber(e.target.value))}
                            className="w-full text-center bg-transparent outline-none font-semibold"
                          />
                        </td>
                        {/* SALIDA SECADORA (VACÍO PARA LLENAR AL FINAL) */}
                        <td className="border-r border-slate-300 py-0.5 px-0.5 font-bold text-emerald-900 bg-amber-50/30">
                          <input
                            type="number"
                            step="0.1"
                            value={safeNumVal(row.salidaSecadora)}
                            placeholder=""
                            onChange={(e) => handleParamPaddyChange(idx, "salidaSecadora", parseOptionalNumber(e.target.value))}
                            className="w-full text-center font-bold bg-transparent outline-none text-emerald-900"
                          />
                        </td>
                        {/* VARIACIÓN (SE CALCULA AUTOMÁTICO AL INGRESAR SALIDA) */}
                        <td className={`py-0.5 px-1 font-bold ${
                          row.variacion !== undefined
                            ? row.variacion > 0
                              ? "text-emerald-700 bg-emerald-50/60"
                              : row.variacion < 0
                              ? "text-blue-700 bg-blue-50/60"
                              : "text-slate-600"
                            : "text-slate-400"
                        }`}>
                          {row.variacion !== undefined ? (row.variacion > 0 ? `+${row.variacion}` : row.variacion) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="bg-amber-100/70 p-1.5 border-t border-slate-300 flex items-center justify-around text-[10px] font-bold text-slate-800">
                <span className="bg-yellow-300 px-2 py-0.5 rounded border border-yellow-400">%BI: Rend. Blanco</span>
                <span className="bg-yellow-300 px-2 py-0.5 rounded border border-yellow-400">%tz: Tizado</span>
                <span className="bg-yellow-300 px-2 py-0.5 rounded border border-yellow-400">%Q: Quebrado</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: DATOS DE VAPORIZADO & SILOS (1 to 6) */}
          <div className="col-span-8 space-y-3">
            {/* DATOS DE VAPORIZADO BANNER */}
            <div className="border border-slate-400 rounded overflow-hidden shadow-xs">
              <div className="bg-[#366427] text-white font-bold py-1.5 px-2.5 text-xs tracking-wide uppercase flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-black">DATOS DE VAPORIZADO</span>
                  {/* Mode badge indicator */}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    datosVaporizado.modalidadPases === "2_PASES"
                      ? "bg-amber-400 text-amber-950 border-amber-300 shadow-xs"
                      : "bg-emerald-800 text-emerald-100 border-emerald-600"
                  }`}>
                    {datosVaporizado.modalidadPases === "2_PASES" 
                      ? "⚙️ 2 Pases (Lote Seco - Anti-Trizado)" 
                      : "💧 1 Solo Pase (Lote Húmedo)"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Selector rápido de pases - BOTONES MÁS GRANDES */}
                  <div className="flex items-center bg-slate-900/80 rounded-lg p-1 border border-emerald-500/50 text-xs shadow-sm">
                    <button
                      type="button"
                      onClick={() => handleVaporizadoHeaderChange("modalidadPases", "1_PASE")}
                      className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer text-xs ${
                        datosVaporizado.modalidadPases !== "2_PASES"
                          ? "bg-emerald-500 text-slate-950 font-black shadow-md ring-1 ring-emerald-300"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                      }`}
                      title="Para lotes húmedos (≥14% H): inyección estándar en un solo paso"
                    >
                      💧 1 Solo Pase (Húmedo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVaporizadoHeaderChange("modalidadPases", "2_PASES")}
                      className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer text-xs ${
                        datosVaporizado.modalidadPases === "2_PASES"
                          ? "bg-amber-400 text-amber-950 font-black shadow-md ring-1 ring-amber-300"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                      }`}
                      title="Para lotes secos (<14% H): doble inyección para amortiguar choque térmico y evitar trizado"
                    >
                      ⚙️ 2 Pases (Seco - Anti-Trizado)
                    </button>
                  </div>

                  <button
                    id="btn-photo-vaporizado"
                    type="button"
                    onClick={() => handleOpenOCR("DATOS_VAPORIZADO")}
                    className="px-2.5 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 shadow transition-all cursor-pointer print:hidden"
                    title="Fotografiar display o registro de autoclave / vaporizado"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Foto Vaporizado</span>
                  </button>
                </div>
              </div>

              {/* Informative Guidance Banner based on Moisture */}
              <div className={`px-2.5 py-1 text-[11px] font-semibold flex items-center justify-between border-b ${
                datosVaporizado.modalidadPases === "2_PASES" || isLoteSecoDetected
                  ? "bg-amber-50 text-amber-900 border-amber-200"
                  : "bg-emerald-50/70 text-emerald-900 border-emerald-200"
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs">
                    {isLoteSecoDetected ? "⚠️ NOTA OPERATIVA (LOTE SECO):" : "💡 REGLA DE PROCESO:"}
                  </span>
                  <span>
                    {isLoteSecoDetected 
                      ? `Lote con Humedad Ingreso ${datosIngreso.humedadPct}% (<14%): Se recomienda procesar en 2 Pases de Inyección de Vapor para prevenir el choque térmico y evitar el trizado del grano.`
                      : `Lote con Humedad Ingreso ${datosIngreso.humedadPct}% (≥14%): La plasticidad del grano permite la inyección en 1 solo paso estándar sin riesgo de trizado.`}
                  </span>
                </div>
                {datosVaporizado.modalidadPases === "2_PASES" && (
                  <span className="text-[10px] bg-amber-200 text-amber-950 font-bold px-1.5 py-0.5 rounded border border-amber-300 shrink-0 ml-2">
                    Doble Inyección Activa
                  </span>
                )}
              </div>

              <div className="p-1.5 bg-slate-50 space-y-1.5 text-xs">
                {/* 1. Llenado Tolva Pulmón */}
                <div className="bg-white border border-slate-250 rounded-lg p-1.5 px-2.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-600 inline-block"></span>
                      <span className="font-black text-[11px] text-slate-800 uppercase tracking-wide">
                        1. LLENADO DE TOLVA PULMÓN:
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                      {/* H. INICIO */}
                      <div className="bg-slate-50 border border-slate-250 rounded px-2 py-0.5 flex items-center gap-1">
                        <span className="text-slate-600 text-[10px] font-bold">H. INICIO:</span>
                        <input
                          type="text"
                          value={datosVaporizado.llenadoTolvaPulmon?.inicio ?? ""}
                          placeholder="--:--"
                          onChange={(e) => {
                            const cur = datosVaporizado.llenadoTolvaPulmon || { inicio: "", fin: "" };
                            const dur = calculateDuration(e.target.value, cur.fin);
                            handleVaporizadoHeaderChange("llenadoTolvaPulmon", { ...cur, inicio: e.target.value, duracion: dur });
                          }}
                          className="w-13 text-center font-black text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const now = getHoraActual();
                            const cur = datosVaporizado.llenadoTolvaPulmon || { inicio: "", fin: "" };
                            const dur = calculateDuration(now, cur.fin);
                            handleVaporizadoHeaderChange("llenadoTolvaPulmon", { ...cur, inicio: now, duracion: dur });
                          }}
                          className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 rounded transition-colors cursor-pointer print:hidden"
                          title="Insertar hora actual (H.INICIO)"
                        >
                          <Clock className="w-3 h-3" />
                        </button>
                      </div>

                      {/* HR. FINAL */}
                      <div className="bg-slate-50 border border-slate-250 rounded px-2 py-0.5 flex items-center gap-1">
                        <span className="text-slate-600 text-[10px] font-bold">HR. FINAL:</span>
                        <input
                          type="text"
                          value={datosVaporizado.llenadoTolvaPulmon?.fin ?? ""}
                          placeholder="--:--"
                          onChange={(e) => {
                            const cur = datosVaporizado.llenadoTolvaPulmon || { inicio: "", fin: "" };
                            const dur = calculateDuration(cur.inicio, e.target.value);
                            handleVaporizadoHeaderChange("llenadoTolvaPulmon", { ...cur, fin: e.target.value, duracion: dur });
                          }}
                          className="w-13 text-center font-black text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const now = getHoraActual();
                            const cur = datosVaporizado.llenadoTolvaPulmon || { inicio: "", fin: "" };
                            const dur = calculateDuration(cur.inicio, now);
                            handleVaporizadoHeaderChange("llenadoTolvaPulmon", { ...cur, fin: now, duracion: dur });
                          }}
                          className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 rounded transition-colors cursor-pointer print:hidden"
                          title="Insertar hora actual (HR. FINAL)"
                        >
                          <Clock className="w-3 h-3" />
                        </button>
                      </div>

                      {/* DURACIÓN */}
                      <div className="bg-slate-100 border border-slate-250 rounded px-2 py-0.5 flex items-center gap-1.5">
                        <span className="text-slate-600 text-[10px] font-bold">DURACIÓN:</span>
                        <span className="font-mono font-black text-emerald-900 text-[11px] px-1.5 py-0.2 bg-white rounded border border-slate-200">
                          {calculateDuration(datosVaporizado.llenadoTolvaPulmon?.inicio, datosVaporizado.llenadoTolvaPulmon?.fin) || "--"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Single Pass Direct Mode if 1_PASE is active */}
                {datosVaporizado.modalidadPases !== "2_PASES" && (
                  <div className="border border-emerald-400 rounded-lg bg-white p-2 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-xs border-b border-emerald-100 pb-1 bg-emerald-50/70 -mx-2 -mt-2 p-1.5 px-2 rounded-t-lg">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        <span className="font-black text-emerald-950 uppercase text-[11px] tracking-wide">
                          2. INYECCIÓN DE VAPOR — PASE ÚNICO ESTÁNDAR (LOTE HÚMEDO ≥ 14% H)
                        </span>
                      </div>
                      {calculateDuration(datosVaporizado.inyeccionVapor?.inicio, datosVaporizado.inyeccionVapor?.fin) && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-950 font-black px-2 py-0.5 rounded border border-emerald-300">
                          ⏱️ {calculateDuration(datosVaporizado.inyeccionVapor?.inicio, datosVaporizado.inyeccionVapor?.fin)}
                        </span>
                      )}
                    </div>

                    {/* Barra de Parámetros Recomendados / Establecidos en Programación */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-400/40 rounded-lg text-[11px] text-white shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 font-extrabold text-[9px] border border-amber-400/40 uppercase tracking-wider">
                          {parametrosSupervisor ? "PARÁMETROS DEL SUPERVISOR" : "PARÁMETROS ESTABLECIDOS EN PROGRAMACIÓN"}
                        </span>
                        <span className="font-semibold text-slate-300 text-[10.5px]">Recomendación para Pase Único:</span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono text-[11px] flex-wrap">
                        <span className="text-amber-300 flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-[9px] text-slate-400 font-sans font-normal">PRESIÓN:</span>
                          <span className="text-xs font-black text-white">{presionRecomendadaProg}</span> bar
                        </span>
                        <span className="text-amber-300 flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-[9px] text-slate-400 font-sans font-normal">V.EXCL:</span>
                          <span className="text-xs font-black text-white">{velExclusaRecomendadaProg}</span>
                        </span>
                        <span className="text-amber-300 flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-[9px] text-slate-400 font-sans font-normal">REPOSO:</span>
                          <span className="text-xs font-black text-white">{tiempoReposoRecomendadoProgMin} min</span>
                        </span>
                        <button
                          type="button"
                          onClick={aplicarParametrosProgramadosPaseUnico}
                          className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer shadow-xs border border-emerald-400/50"
                          title="Cargar estos parámetros recomendados en las casillas"
                        >
                          <Check className="w-3 h-3" /> Aplicar Valores
                        </button>
                      </div>
                    </div>

                    {/* Fila 1: Horarios de Inicio y Fin */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* 1. H.INICIO */}
                      <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2 shadow-2xs">
                        <span className="text-slate-700 text-xs font-bold shrink-0">H. INICIO:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={datosVaporizado.inyeccionVapor?.inicio ?? ""}
                            placeholder="--:--"
                            onChange={(e) => {
                              const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
                              const dur = calculateDuration(e.target.value, cur.fin);
                              handleVaporizadoHeaderChange("inyeccionVapor", { ...cur, inicio: e.target.value, duracion: dur });
                            }}
                            className="w-16 text-center font-black text-amber-950 bg-white border border-slate-300 rounded-md px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const now = getHoraActual();
                              const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
                              const dur = calculateDuration(now, cur.fin);
                              handleVaporizadoHeaderChange("inyeccionVapor", { ...cur, inicio: now, duracion: dur });
                            }}
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors cursor-pointer print:hidden"
                            title="Insertar hora actual (H.INICIO)"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 2. HR. FINAL */}
                      <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2 shadow-2xs">
                        <span className="text-slate-700 text-xs font-bold shrink-0">HR. FINAL:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={datosVaporizado.inyeccionVapor?.fin ?? ""}
                            placeholder="--:--"
                            onChange={(e) => {
                              const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
                              const dur = calculateDuration(cur.inicio, e.target.value);
                              handleVaporizadoHeaderChange("inyeccionVapor", { ...cur, fin: e.target.value, duracion: dur });
                            }}
                            className="w-16 text-center font-black text-slate-900 bg-white border border-slate-300 rounded-md px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const now = getHoraActual();
                              const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
                              const dur = calculateDuration(cur.inicio, now);
                              handleVaporizadoHeaderChange("inyeccionVapor", { ...cur, fin: now, duracion: dur });
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer print:hidden"
                            title="Insertar hora actual (HR. FINAL)"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Fila 2: Parámetros del Proceso con Valores Recomendados Visibles */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {/* 3. PRESIÓN (bar) */}
                      <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2 flex flex-col justify-center shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">PRESIÓN</span>
                          <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded font-mono shadow-2xs" title="Presión establecida en la programación">
                            Prog: {presionRecomendadaProg} bar
                          </span>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            step="0.01"
                            value={datosVaporizado.inyeccionVapor?.presion !== undefined ? datosVaporizado.inyeccionVapor.presion : (datosVaporizado.presionVapor ?? presionRecomendadaProg)}
                            placeholder={String(presionRecomendadaProg || "0.35")}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : parseFloat(e.target.value);
                              const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
                              handleVaporizadoHeaderChange("inyeccionVapor", { ...cur, presion: v });
                            }}
                            className="w-full text-center font-black text-emerald-950 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 pr-7 shadow-2xs"
                          />
                          <span className="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">bar</span>
                        </div>
                      </div>

                      {/* 4. V.EXCL. */}
                      <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2 flex flex-col justify-center shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">V. EXCLUSA</span>
                          <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded font-mono shadow-2xs" title="Velocidad de exclusa establecida en la programación">
                            Prog: {velExclusaRecomendadaProg}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={datosVaporizado.inyeccionVapor?.velExclusa ?? String(velExclusaRecomendadaProg)}
                          placeholder={String(velExclusaRecomendadaProg || "4")}
                          onChange={(e) => {
                            const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
                            handleVaporizadoHeaderChange("inyeccionVapor", { ...cur, velExclusa: e.target.value });
                          }}
                          className="w-full text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                        />
                      </div>

                      {/* 5. T.REPOSO */}
                      <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-2 flex flex-col justify-center shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">T. REPOSO</span>
                          <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded font-mono shadow-2xs" title="Tiempo de reposo establecido en la programación">
                            Prog: {tiempoReposoRecomendadoProgMin} min
                          </span>
                        </div>
                        <input
                          type="text"
                          value={datosVaporizado.inyeccionVapor?.tiempoReposo ?? `${tiempoReposoRecomendadoProgMin} min`}
                          placeholder={`${tiempoReposoRecomendadoProgMin} min`}
                          onChange={(e) => {
                            const cur = datosVaporizado.inyeccionVapor || { inicio: "", fin: "" };
                            handleVaporizadoHeaderChange("inyeccionVapor", { ...cur, tiempoReposo: e.target.value });
                          }}
                          className="w-full text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2 PASES DE INYECCIÓN DE VAPOR (LOTES SECOS - ANTI-TRIZADO) */}
                {datosVaporizado.modalidadPases === "2_PASES" && (
                  <div className="border border-amber-400 rounded-xl bg-amber-50/40 p-2.5 space-y-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-amber-950 border-b border-amber-200/80 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                        <span className="uppercase tracking-wide font-black text-xs">
                          2. INYECCIÓN DE VAPOR — DOBLE PASE (CONTROL ANTI-TRIZADO)
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-900 font-bold bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300/80">
                        1° Acondiciona ➔ 2° Gelatiniza
                      </span>
                    </div>

                    {/* Barra de Parámetros Recomendados / Establecidos en Programación para Doble Pase */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-400/40 rounded-lg text-white shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 font-extrabold text-[9px] border border-amber-400/40 uppercase tracking-wider">
                          {parametrosSupervisor ? "PARÁMETROS DEL SUPERVISOR" : "PARÁMETROS ESTABLECIDOS EN PROGRAMACIÓN"}
                        </span>
                        <span className="font-semibold text-slate-300 text-[10.5px]">Guía para Doble Pase:</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs flex-wrap font-mono">
                        <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded">
                          <span className="text-amber-400 font-sans font-black text-[10px]">1° PASE:</span>
                          <span className="text-white font-black text-xs">{presionPase1Prog} bar</span>
                          <span className="text-slate-400 text-[10px]">|</span>
                          <span className="text-white text-[11px]">{tiempoReposoPase1Prog}</span>
                          <span className="text-slate-400 text-[10px]">|</span>
                          <span className="text-amber-200 text-[10.5px]">V.{velExclusaRecomendadaProg}</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                          <span className="text-emerald-400 font-sans font-black text-[10px]">2° PASE:</span>
                          <span className="text-white font-black text-xs">{presionPase2Prog} bar</span>
                          <span className="text-slate-400 text-[10px]">|</span>
                          <span className="text-white text-[11px]">{tiempoReposoPase2Prog}</span>
                          <span className="text-slate-400 text-[10px]">|</span>
                          <span className="text-emerald-200 text-[10.5px]">V.{velExclusaRecomendadaProg}</span>
                        </div>

                        <button
                          type="button"
                          onClick={aplicarParametrosProgramadosDoblePase}
                          className="text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-black px-2.5 py-1 rounded flex items-center gap-1 transition-all cursor-pointer shadow-xs border border-amber-400/50"
                          title="Cargar estos parámetros recomendados en ambos pases"
                        >
                          <Check className="w-3 h-3" /> Aplicar Valores en Ambos Pases
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      {/* 1° Pase de Inyección */}
                      <div className="border-2 border-amber-300/90 rounded-xl bg-white p-3 space-y-2.5 shadow-xs">
                        {/* Header */}
                        <div className="flex items-center justify-between text-xs border-b border-amber-200 pb-2 bg-amber-50/90 -mx-3 -mt-3 p-2.5 px-3 rounded-t-lg">
                          <span className="font-black text-amber-950 uppercase flex items-center gap-1.5 text-xs">
                            <span className="text-sm">🔥</span> 1° PASE (ACONDICIONAMIENTO / PRE-CALOR):
                          </span>
                          {calculateDuration(datosVaporizado.inyeccionVaporPase1?.inicio, datosVaporizado.inyeccionVaporPase1?.fin) && (
                            <span className="text-xs bg-amber-200 text-amber-950 font-black px-2.5 py-0.5 rounded-full border border-amber-400 shrink-0 shadow-2xs">
                              ⏱️ {calculateDuration(datosVaporizado.inyeccionVaporPase1?.inicio, datosVaporizado.inyeccionVaporPase1?.fin)}
                            </span>
                          )}
                        </div>

                        {/* Fila 1: Horarios de Inicio y Fin */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* H. INICIO */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex items-center justify-between gap-2 shadow-2xs">
                            <span className="text-slate-700 text-xs font-bold shrink-0">H. INICIO:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={datosVaporizado.inyeccionVaporPase1?.inicio ?? ""}
                                placeholder="--:--"
                                onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase1", "inicio", e.target.value)}
                                className="w-16 text-center font-black text-amber-950 bg-white border border-amber-300 rounded-md px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleVaporizadoPaseChange("inyeccionVaporPase1", "inicio", getHoraActual())}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors cursor-pointer print:hidden"
                                title="Insertar hora actual (Inicio)"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* HR. FINAL */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex items-center justify-between gap-2 shadow-2xs">
                            <span className="text-slate-700 text-xs font-bold shrink-0">HR. FINAL:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={datosVaporizado.inyeccionVaporPase1?.fin ?? ""}
                                placeholder="--:--"
                                onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase1", "fin", e.target.value)}
                                className="w-16 text-center font-black text-slate-900 bg-white border border-slate-300 rounded-md px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleVaporizadoPaseChange("inyeccionVaporPase1", "fin", getHoraActual())}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors cursor-pointer print:hidden"
                                title="Insertar hora actual (Fin)"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Fila 2: Parámetros Clave con Valores Recomendados Visibles */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* PRESIÓN */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex flex-col justify-center shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">PRESIÓN</span>
                              <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1 py-0.2 rounded font-mono shadow-2xs" title="Presión establecida para el 1° Pase">
                                Prog: {presionPase1Prog}
                              </span>
                            </div>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                step="0.01"
                                value={datosVaporizado.inyeccionVaporPase1?.presion !== undefined ? datosVaporizado.inyeccionVaporPase1.presion : presionPase1Prog}
                                placeholder={String(presionPase1Prog || "0.35")}
                                onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase1", "presion", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                className="w-full text-center font-black text-amber-950 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500 pr-7 shadow-2xs"
                              />
                              <span className="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">bar</span>
                            </div>
                          </div>

                          {/* T. REPOSO */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex flex-col justify-center shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">T. REPOSO</span>
                              <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1 py-0.2 rounded font-mono shadow-2xs" title="Reposo establecido para el 1° Pase">
                                Prog: {tiempoReposoPase1Prog}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={datosVaporizado.inyeccionVaporPase1?.tiempoReposo ?? tiempoReposoPase1Prog}
                              placeholder={tiempoReposoPase1Prog}
                              onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase1", "tiempoReposo", e.target.value)}
                              className="w-full text-center font-black text-slate-900 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                            />
                          </div>

                          {/* V. EXCLUSA */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex flex-col justify-center shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">V. EXCLUSA</span>
                              <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1 py-0.2 rounded font-mono shadow-2xs" title="Velocidad de exclusa programada">
                                Prog: {velExclusaRecomendadaProg}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={datosVaporizado.inyeccionVaporPase1?.vExcl ?? String(velExclusaRecomendadaProg)}
                              placeholder={String(velExclusaRecomendadaProg || "4")}
                              onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase1", "vExcl", e.target.value)}
                              className="w-full text-center font-bold text-slate-800 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* Fila 3: Observaciones */}
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-1.5 bg-slate-50/60 shadow-2xs">
                          <span className="text-slate-700 shrink-0 font-black text-[11px] px-1">OBS:</span>
                          <input
                            type="text"
                            value={datosVaporizado.inyeccionVaporPase1?.obs ?? "Pre-calentamiento gradual para evitar choque térmico"}
                            placeholder="Pre-calentamiento gradual para evitar choque térmico"
                            onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase1", "obs", e.target.value)}
                            className="w-full text-slate-800 font-medium bg-white border border-slate-300 rounded-md px-2 py-1 text-xs outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* 2° Pase de Inyección */}
                      <div className="border-2 border-emerald-400 rounded-xl bg-white p-3 space-y-2.5 shadow-xs">
                        {/* Header */}
                        <div className="flex items-center justify-between text-xs border-b border-emerald-200 pb-2 bg-emerald-50/90 -mx-3 -mt-3 p-2.5 px-3 rounded-t-lg">
                          <span className="font-black text-emerald-950 uppercase flex items-center gap-1.5 text-xs">
                            <span className="text-sm">🍲</span> 2° PASE (COCCIÓN / GELATINIZACIÓN PRINCIPAL):
                          </span>
                          {calculateDuration(datosVaporizado.inyeccionVaporPase2?.inicio, datosVaporizado.inyeccionVaporPase2?.fin) && (
                            <span className="text-xs bg-emerald-200 text-emerald-950 font-black px-2.5 py-0.5 rounded-full border border-emerald-400 shrink-0 shadow-2xs">
                              ⏱️ {calculateDuration(datosVaporizado.inyeccionVaporPase2?.inicio, datosVaporizado.inyeccionVaporPase2?.fin)}
                            </span>
                          )}
                        </div>

                        {/* Fila 1: Horarios de Inicio y Fin */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* H. INICIO */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex items-center justify-between gap-2 shadow-2xs">
                            <span className="text-slate-700 text-xs font-bold shrink-0">H. INICIO:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={datosVaporizado.inyeccionVaporPase2?.inicio ?? ""}
                                placeholder="--:--"
                                onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase2", "inicio", e.target.value)}
                                className="w-16 text-center font-black text-emerald-950 bg-white border border-emerald-300 rounded-md px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleVaporizadoPaseChange("inyeccionVaporPase2", "inicio", getHoraActual())}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer print:hidden"
                                title="Insertar hora actual (Inicio)"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* HR. FINAL */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex items-center justify-between gap-2 shadow-2xs">
                            <span className="text-slate-700 text-xs font-bold shrink-0">HR. FINAL:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={datosVaporizado.inyeccionVaporPase2?.fin ?? ""}
                                placeholder="--:--"
                                onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase2", "fin", e.target.value)}
                                className="w-16 text-center font-black text-slate-900 bg-white border border-slate-300 rounded-md px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleVaporizadoPaseChange("inyeccionVaporPase2", "fin", getHoraActual())}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer print:hidden"
                                title="Insertar hora actual (Fin)"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Fila 2: Parámetros Clave con Valores Recomendados Visibles */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* PRESIÓN */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex flex-col justify-center shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">PRESIÓN</span>
                              <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 py-0.2 rounded font-mono shadow-2xs" title="Presión establecida para el 2° Pase">
                                Prog: {presionPase2Prog}
                              </span>
                            </div>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                step="0.01"
                                value={datosVaporizado.inyeccionVaporPase2?.presion !== undefined ? datosVaporizado.inyeccionVaporPase2.presion : presionPase2Prog}
                                placeholder={String(presionPase2Prog || "0.40")}
                                onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase2", "presion", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                className="w-full text-center font-black text-emerald-950 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 pr-7 shadow-2xs"
                              />
                              <span className="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">bar</span>
                            </div>
                          </div>

                          {/* T. REPOSO */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex flex-col justify-center shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">T. REPOSO</span>
                              <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 py-0.2 rounded font-mono shadow-2xs" title="Reposo establecido para el 2° Pase">
                                Prog: {tiempoReposoPase2Prog}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={datosVaporizado.inyeccionVaporPase2?.tiempoReposo ?? tiempoReposoPase2Prog}
                              placeholder={tiempoReposoPase2Prog}
                              onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase2", "tiempoReposo", e.target.value)}
                              className="w-full text-center font-black text-slate-900 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                            />
                          </div>

                          {/* V. EXCLUSA */}
                          <div className="border border-slate-200 rounded-lg p-2 bg-slate-50/80 flex flex-col justify-center shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-600 text-[10px] font-black uppercase tracking-wider">V. EXCLUSA</span>
                              <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 py-0.2 rounded font-mono shadow-2xs" title="Velocidad de exclusa programada">
                                Prog: {velExclusaRecomendadaProg}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={datosVaporizado.inyeccionVaporPase2?.vExcl ?? String(velExclusaRecomendadaProg)}
                              placeholder={String(velExclusaRecomendadaProg || "4")}
                              onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase2", "vExcl", e.target.value)}
                              className="w-full text-center font-bold text-slate-800 bg-white border border-slate-300 rounded-md px-1 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* Fila 3: Observaciones */}
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-1.5 bg-slate-50/60 shadow-2xs">
                          <span className="text-slate-700 shrink-0 font-black text-[11px] px-1">OBS:</span>
                          <input
                            type="text"
                            value={datosVaporizado.inyeccionVaporPase2?.obs ?? "Gelatinización uniforme del almidón sin trizado"}
                            placeholder="Gelatinización uniforme del almidón sin trizado"
                            onChange={(e) => handleVaporizadoPaseChange("inyeccionVaporPase2", "obs", e.target.value)}
                            className="w-full text-slate-800 font-medium bg-white border border-slate-300 rounded-md px-2 py-1 text-xs outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Resumen de Doble Pase: Intervalo entre pases y Tiempo Total de Inyección */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-100/70 p-1.5 rounded border border-amber-300/80 text-[10.5px]">
                      <div className="flex items-center gap-1 text-amber-950 font-semibold">
                        <span>Pausa / Reposo Inter-Pases:</span>
                        <span className="font-bold font-mono text-amber-900">
                          {calculateDuration(datosVaporizado.inyeccionVaporPase1?.fin, datosVaporizado.inyeccionVaporPase2?.inicio) || "Sin intervalo registrado"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-amber-950 uppercase text-[10px]">Tiempo Total de Vapor Inyectado:</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-800 text-white font-black font-mono text-[11px] shadow-xs">
                          {(() => {
                            const p1 = parseNumMins(calculateDuration(datosVaporizado.inyeccionVaporPase1?.inicio, datosVaporizado.inyeccionVaporPase1?.fin));
                            const p2 = parseNumMins(calculateDuration(datosVaporizado.inyeccionVaporPase2?.inicio, datosVaporizado.inyeccionVaporPase2?.fin));
                            const total = p1 + p2;
                            return total > 0 ? `${total} min (${p1} min + ${p2} min)` : "Pendiente de registro";
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BATERÍA DE 5 SILOS (SILO 1 AL SILO 5) - CONTROL DE LLENADO, REPOSO Y DESCARGA */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 bg-slate-100 p-2 rounded-lg border border-slate-250">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                      Batería de Enfriamiento y Reposo (Silos 1 al 5)
                    </span>
                    {datosVaporizado.modalidadPases === "2_PASES" ? (
                      <span className="text-[9.5px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                        Modo 2 Pases Activo ({siloActivePase === 1 ? "1° Pase" : "2° Pase"})
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                        Pase Único
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600">
                    Control de las 3 fases críticas: <strong className="text-amber-900">1. Llenado (Exclusa)</strong> ➔ <strong className="text-slate-900">2. Reposo Térmico en Silo</strong> ➔ <strong className="text-blue-900">3. Descarga y Calidad</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {datosVaporizado.modalidadPases === "2_PASES" && (
                    <div className="flex items-center bg-white rounded-xl p-1 border-2 border-slate-300 shadow-md">
                      <button
                        type="button"
                        onClick={() => setSiloActivePase(1)}
                        className={`px-4 py-2 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                          siloActivePase === 1
                            ? "bg-amber-600 text-white shadow-lg ring-2 ring-amber-400 scale-[1.02]"
                            : "text-slate-700 bg-slate-100/80 hover:bg-slate-200"
                        }`}
                      >
                        <span>🔥 1° PASE</span>
                        <span className="text-[10.5px] opacity-90 hidden sm:inline font-semibold">(Pre-Calor)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSiloActivePase(2)}
                        className={`px-4 py-2 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ml-1 ${
                          siloActivePase === 2
                            ? "bg-emerald-700 text-white shadow-lg ring-2 ring-emerald-400 scale-[1.02]"
                            : "text-slate-700 bg-slate-100/80 hover:bg-slate-200"
                        }`}
                      >
                        <span>🍲 2° PASE</span>
                        <span className="text-[10.5px] opacity-90 hidden sm:inline font-semibold">(Cocción)</span>
                      </button>
                    </div>
                  )}

                  {datosVaporizado.modalidadPases === "2_PASES" && siloActivePase === 2 && (
                    <button
                      type="button"
                      onClick={handleCopiarSilosPase1APase2}
                      className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer print:hidden"
                      title="Copiar datos de Silos del 1° Pase como base para el 2° Pase"
                    >
                      <span className="text-sm">📋</span>
                      <span>Copiar 1° Pase</span>
                    </button>
                  )}

                  <button
                    id="btn-photo-silos"
                    type="button"
                    onClick={() => handleOpenOCR("SILOS")}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer print:hidden"
                    title="Capturar foto de pizarra de control de silos"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Foto Silos</span>
                  </button>
                </div>
              </div>

              {datosVaporizado.modalidadPases === "2_PASES" && (
                <div className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-950 flex items-center justify-between">
                  <span>
                    Mostrando control de silos para: <strong className="uppercase">{siloActivePase === 1 ? "1° Pase (Acondicionamiento / Pre-calentamiento)" : "2° Pase (Cocción / Gelatinización Principal)"}</strong>
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">
                    (Los datos de cada pase se almacenan de forma independiente)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-5 gap-2">
              {silos.map((silo, idx) => {
                const autoTLlenado = calculateDuration(silo.exclusa?.inicio, silo.exclusa?.fin) || silo.exclusa?.tiempoLlenado || "";
                const autoTDescarga = calculateDuration(silo.descarga?.inicio, silo.descarga?.fin) || silo.descarga?.tiempoDescarga || silo.descarga?.tiempo || "";
                const autoTReposo = calculateDuration(silo.exclusa?.fin, silo.descarga?.inicio) || silo.descarga?.tiempoReposo || silo.descarga?.reposo || "";

                return (
                <div key={`${silo.siloNumber}-${datosVaporizado.modalidadPases === "2_PASES" ? siloActivePase : 1}`} className="border border-slate-400 rounded-lg overflow-hidden flex flex-col bg-white shadow-xs">
                  {/* Silo Title */}
                  <div className={`text-white font-black text-center py-1 text-[11px] border-b uppercase tracking-wide flex items-center justify-between px-2 ${
                    datosVaporizado.modalidadPases === "2_PASES"
                      ? (siloActivePase === 1 ? "bg-amber-800 border-amber-900" : "bg-emerald-850 bg-emerald-900 border-emerald-950")
                      : "bg-slate-800 border-slate-900"
                  }`}>
                    <span>SILO {silo.siloNumber}</span>
                    {datosVaporizado.modalidadPases === "2_PASES" && (
                      <span className="text-[8.5px] bg-white/20 px-1 py-0.2 rounded font-mono">
                        {siloActivePase === 1 ? "PASE 1" : "PASE 2"}
                      </span>
                    )}
                  </div>

                  {/* 1. LLENADO Header */}
                  <div className="bg-amber-200/90 text-amber-950 font-black text-center py-0.5 text-[9.5px] border-b border-amber-300 uppercase tracking-tight flex items-center justify-center gap-1">
                    <span>1. LLENADO (EXCLUSA)</span>
                  </div>

                  {/* Llenado / Exclusa Fields */}
                  <div className="p-1 space-y-0.5 text-[9.5px] border-b border-slate-300 bg-amber-50/40">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">H.INICIO</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="text"
                          value={silo.exclusa?.inicio ?? ""}
                          placeholder="--:--"
                          onChange={(e) => handleSiloExclusaChange(idx, "inicio", e.target.value)}
                          className="w-12 text-right font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-0.5 outline-none text-[9px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSiloExclusaChange(idx, "inicio", getHoraActual())}
                          className="p-0.5 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors cursor-pointer print:hidden"
                          title="Insertar hora actual"
                        >
                          <Clock className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">H.FINAL</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="text"
                          value={silo.exclusa?.fin ?? ""}
                          placeholder="--:--"
                          onChange={(e) => handleSiloExclusaChange(idx, "fin", e.target.value)}
                          className="w-12 text-right font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-0.5 outline-none text-[9px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSiloExclusaChange(idx, "fin", getHoraActual())}
                          className="p-0.5 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors cursor-pointer print:hidden"
                          title="Insertar hora actual"
                        >
                          <Clock className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    {/* T. LLENADO Calculado Automático */}
                    <div className="flex justify-between items-center bg-amber-100/80 px-1 py-0.5 rounded border border-amber-300">
                      <span className="text-amber-950 font-bold text-[8.5px]">T. LLENADO</span>
                      <input
                        type="text"
                        value={autoTLlenado}
                        placeholder="Auto"
                        onChange={(e) => handleSiloExclusaChange(idx, "tiempoLlenado", e.target.value)}
                        className="w-14 text-right font-black text-amber-900 bg-white/90 border border-amber-300 rounded px-0.5 outline-none text-[8.5px]"
                        title="Tiempo calculado automáticamente entre H.INICIO y H.FINAL"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">T.A:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.exclusa?.tempAmbiente !== undefined ? silo.exclusa.tempAmbiente : ""}
                        placeholder="°C"
                        onChange={(e) => handleSiloExclusaChange(idx, "tempAmbiente", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-12 text-right font-semibold bg-white border border-slate-200 rounded px-1 outline-none text-[9px]"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">H.R:</span>
                      <input
                        type="number"
                        value={silo.exclusa?.humedadRelativa !== undefined ? silo.exclusa.humedadRelativa : ""}
                        placeholder="%"
                        onChange={(e) => handleSiloExclusaChange(idx, "humedadRelativa", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-12 text-right font-semibold bg-white border border-slate-200 rounded px-1 outline-none text-[9px]"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">PRESIÓN</span>
                      <input
                        type="number"
                        step="0.01"
                        value={silo.exclusa?.presion !== undefined ? silo.exclusa.presion : ""}
                        placeholder="bar"
                        onChange={(e) => handleSiloExclusaChange(idx, "presion", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-12 text-right font-bold text-emerald-800 bg-white border border-slate-200 rounded px-1 outline-none text-[9px]"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">EXCLUSA</span>
                      <input
                        type="text"
                        value={silo.exclusa?.exclusa ?? ""}
                        placeholder="N°"
                        onChange={(e) => handleSiloExclusaChange(idx, "exclusa", e.target.value)}
                        className="w-12 text-right font-bold text-slate-900 bg-white border border-slate-200 rounded px-1 outline-none text-[9px]"
                      />
                    </div>
                  </div>

                  {/* 2. REPOSO & CONTROL TÉRMICO Header */}
                  <div className="bg-slate-200 text-slate-800 font-black text-center py-0.5 text-[9px] border-b border-slate-300 uppercase tracking-tight">
                    2. REPOSO Y SENSOR TÉRMICO
                  </div>

                  {/* Silo Graphic Illustration with Upper/Lower Temperature Badges and Reposo Display */}
                  <div className="relative py-2 px-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 border-b border-slate-300 min-h-[120px]">
                    {/* SVG Silo Contour */}
                    <svg viewBox="0 0 100 130" className="w-16 h-24 text-slate-400 opacity-60">
                      {/* Roof / Cone Top */}
                      <path d="M 15 35 L 50 10 L 85 35 Z" fill="#cfd8dc" stroke="#78909c" strokeWidth="2" />
                      {/* Silo Body Cylindrical */}
                      <rect x="15" y="35" width="70" height="65" fill="#eceff1" stroke="#78909c" strokeWidth="2" rx="2" />
                      {/* Corrugation Lines */}
                      <line x1="15" y1="48" x2="85" y2="48" stroke="#b0bec5" strokeWidth="1" />
                      <line x1="15" y1="62" x2="85" y2="62" stroke="#b0bec5" strokeWidth="1" />
                      <line x1="15" y1="76" x2="85" y2="76" stroke="#b0bec5" strokeWidth="1" />
                      <line x1="15" y1="90" x2="85" y2="90" stroke="#b0bec5" strokeWidth="1" />
                      {/* Hopper / Cone Bottom */}
                      <path d="M 15 100 L 40 125 L 60 125 L 85 100 Z" fill="#cfd8dc" stroke="#78909c" strokeWidth="2" />
                    </svg>

                    {/* Sensor Display - Temp Superior */}
                    <div className="absolute top-2 bg-white/95 border-2 border-rose-500 rounded px-1.5 py-0.5 shadow-sm text-center">
                      <span className="text-[8px] block font-bold text-rose-700 -mb-0.5">T. SUP</span>
                      <input
                        type="number"
                        value={silo.tempSuperior !== undefined ? silo.tempSuperior : ""}
                        placeholder="--"
                        onChange={(e) => handleSiloTempChange(idx, "tempSuperior", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-10 text-center font-black text-xs text-rose-800 outline-none bg-transparent"
                      />
                      <span className="text-[8px] font-bold text-slate-600">°C</span>
                    </div>

                    {/* Center Reposo Badge in Graphic */}
                    {autoTReposo && (
                      <div 
                        className="absolute z-10 bg-amber-500 text-white font-mono font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm border border-amber-600 flex items-center gap-0.5"
                        title={`T. REPOSO = ${silo.descarga?.inicio || '--:--'} (H.Inicio Descarga) - ${silo.exclusa?.fin || '--:--'} (H.Final Llenado)`}
                      >
                        <span>⏱️ {autoTReposo}</span>
                      </div>
                    )}

                    {/* Sensor Display - Temp Inferior */}
                    <div className="absolute bottom-1.5 bg-white/95 border-2 border-cyan-600 rounded px-1.5 py-0.5 shadow-sm text-center">
                      <span className="text-[8px] block font-bold text-cyan-800 -mb-0.5">T. INF</span>
                      <input
                        type="number"
                        value={silo.tempInferior !== undefined ? silo.tempInferior : ""}
                        placeholder="--"
                        onChange={(e) => handleSiloTempChange(idx, "tempInferior", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-10 text-center font-black text-xs text-cyan-800 outline-none bg-transparent"
                      />
                      <span className="text-[8px] font-bold text-slate-600">°C</span>
                    </div>
                  </div>

                  {/* 3. DESCARGA Header */}
                  <div className="bg-blue-100 text-blue-950 font-black text-center py-0.5 text-[9.5px] border-b border-blue-200 uppercase tracking-tight">
                    3. DESCARGA Y CALIDAD
                  </div>

                  {/* Descarga Fields Ordered: H.INICIO, H. FINAL, T. DESCARGA (auto), T. REPOSO (auto), T.A., H.R., BL INT., BL.P., % Q, % TRIZ, HUMEDAD */}
                  <div className="p-1 space-y-0.5 text-[9px] bg-slate-50 flex-1">
                    {/* 1. H.INICIO */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">H.INICIO</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="text"
                          value={silo.descarga?.inicio ?? ""}
                          placeholder="--:--"
                          onChange={(e) => handleSiloDescargaChange(idx, "inicio", e.target.value)}
                          className="w-12 text-right font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-0.5 outline-none text-[8.5px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSiloDescargaChange(idx, "inicio", getHoraActual())}
                          className="p-0.5 text-slate-400 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors cursor-pointer print:hidden"
                          title="Insertar hora actual"
                        >
                          <Clock className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* 2. H. FINAL */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">H. FINAL</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="text"
                          value={silo.descarga?.fin ?? ""}
                          placeholder="--:--"
                          onChange={(e) => handleSiloDescargaChange(idx, "fin", e.target.value)}
                          className="w-12 text-right font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-0.5 outline-none text-[8.5px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSiloDescargaChange(idx, "fin", getHoraActual())}
                          className="p-0.5 text-slate-400 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors cursor-pointer print:hidden"
                          title="Insertar hora actual"
                        >
                          <Clock className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* 3. T. DESCARGA Calculado Automático */}
                    <div className="flex justify-between items-center bg-blue-50/90 px-1 py-0.5 rounded border border-blue-200">
                      <span className="text-blue-950 font-bold text-[8.5px]">T. DESCARGA</span>
                      <input
                        type="text"
                        value={autoTDescarga}
                        placeholder="Auto"
                        onChange={(e) => handleSiloDescargaChange(idx, "tiempoDescarga", e.target.value)}
                        className="w-14 text-right font-black text-blue-900 bg-white/90 border border-blue-200 rounded px-0.5 outline-none text-[8.5px]"
                        title="Tiempo de descarga calculado automáticamente entre H.INICIO y H.FINAL"
                      />
                    </div>

                    {/* 4. T. REPOSO EN SILO Calculado Automático: H.INICIO Descarga - H.FINAL Llenado */}
                    <div className="flex justify-between items-center bg-amber-100/80 px-1 py-0.5 rounded border border-amber-300" title="T. REPOSO = H.INICIO Descarga - H.FINAL Llenado de Silos">
                      <span className="text-amber-950 font-bold text-[8.5px]">T. REPOSO</span>
                      <input
                        type="text"
                        value={autoTReposo}
                        placeholder="Auto"
                        onChange={(e) => handleSiloDescargaChange(idx, "tiempoReposo", e.target.value)}
                        className="w-14 text-right font-black text-amber-900 bg-white/90 border border-amber-300 rounded px-0.5 outline-none text-[8.5px]"
                        title={`T. REPOSO = H.INICIO Descarga (${silo.descarga?.inicio || '--:--'}) menos H.FINAL Llenado (${silo.exclusa?.fin || '--:--'})`}
                      />
                    </div>

                    {/* 5. T.A. */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">T.A.</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.descarga?.tempAmbiente !== undefined ? silo.descarga.tempAmbiente : ""}
                        placeholder="°C"
                        onChange={(e) => handleSiloDescargaChange(idx, "tempAmbiente", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-11 text-right bg-white border border-slate-200 rounded px-0.5 outline-none text-[8.5px]"
                      />
                    </div>

                    {/* 6. H.R. */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">H.R.</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.descarga?.humedadRelativa !== undefined ? silo.descarga.humedadRelativa : (silo.descarga?.humedadDescarga !== undefined ? silo.descarga.humedadDescarga : "")}
                        placeholder="%"
                        onChange={(e) => handleSiloDescargaChange(idx, "humedadRelativa", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-11 text-right bg-white border border-slate-200 rounded px-0.5 outline-none text-[8.5px]"
                      />
                    </div>

                    {/* 7. BL INT. */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">BL INT.</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.descarga?.blIntegral !== undefined ? silo.descarga.blIntegral : (silo.descarga?.blancura !== undefined ? silo.descarga.blancura : "")}
                        placeholder="°"
                        onChange={(e) => handleSiloDescargaChange(idx, "blIntegral", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-11 text-right bg-white border border-slate-200 rounded px-0.5 outline-none text-[8.5px]"
                      />
                    </div>

                    {/* 8. BL.P. */}
                    <div className="flex justify-between items-center bg-[#fff9c4] px-1 py-0.5 rounded border border-amber-300">
                      <span className="font-bold text-slate-800 text-[8.5px]">BL.P.</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.descarga?.blp !== undefined ? silo.descarga.blp : ""}
                        placeholder="°"
                        onChange={(e) => handleSiloDescargaChange(idx, "blp", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-10 text-right font-black text-amber-950 bg-white/80 border border-amber-300 rounded px-0.5 outline-none text-[8.5px]"
                      />
                    </div>

                    {/* 9. % Q */}
                    <div className="flex justify-between items-center bg-[#fff9c4] px-1 py-0.5 rounded border border-amber-300">
                      <span className="font-bold text-slate-900 text-[8.5px] border-b-2 border-yellow-500">% Q</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.descarga?.quebradoPct !== undefined ? silo.descarga.quebradoPct : ""}
                        placeholder="%"
                        onChange={(e) => handleSiloDescargaChange(idx, "quebradoPct", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-11 text-right font-black text-slate-900 bg-white/90 border border-amber-300 rounded px-0.5 outline-none text-[8.5px]"
                      />
                    </div>

                    {/* 10. % TRIZ */}
                    <div className="flex justify-between items-center bg-[#fff9c4] px-1 py-0.5 rounded border border-amber-300">
                      <span className="font-bold text-slate-900 text-[8.5px] border-b-2 border-yellow-500">% TRIZ</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.descarga?.trizado !== undefined ? silo.descarga.trizado : ""}
                        placeholder="%"
                        onChange={(e) => handleSiloDescargaChange(idx, "trizado", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-11 text-right font-black text-slate-900 bg-white/90 border border-amber-300 rounded px-0.5 outline-none text-[8.5px]"
                      />
                    </div>

                    {/* 11. HUMEDAD */}
                    <div className="flex justify-between items-center bg-[#ffe082] px-1 py-0.5 rounded border border-amber-400">
                      <span className="font-bold text-slate-800 text-[8.5px]">HUMEDAD</span>
                      <input
                        type="number"
                        step="0.1"
                        value={silo.descarga?.humedad !== undefined ? silo.descarga.humedad : ""}
                        placeholder="%"
                        onChange={(e) => handleSiloDescargaChange(idx, "humedad", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        className="w-10 text-right font-black text-rose-950 bg-white/80 border border-amber-400 rounded px-0.5 outline-none text-[8.5px]"
                      />
                    </div>
                  </div>
                </div>
              );
              })}
              </div>
            </div>
          </div>
        </div>

        {/* 4. SECCIÓN DE CONTROL TÉRMICO CONTINUO: REPOSO 1, ENFRIAMIENTO, REPOSO 2 Y SECADO */}
        <div className="mt-4 space-y-3">
          {/* BANNER DE RESUMEN Y CÁLCULO DE TIEMPOS DE ETAPAS INTERCONECTADAS */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-lg p-3 text-white shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black tracking-wide uppercase text-slate-100">
                  Línea de Continuidad Térmica de Proceso (Cadena Completa)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                  datosVaporizado.modalidadPases === "2_PASES"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}>
                  {datosVaporizado.modalidadPases === "2_PASES" ? "Modo 2 Pases (Lote Seco)" : "Modo 1 Solo Pase (Lote Húmedo)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-300 font-medium">Ciclo Total Acumulado:</span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/40">
                  {totalCicloTermicoMins} min {totalCicloTermicoMins > 0 ? `(~${(totalCicloTermicoMins / 60).toFixed(1)} hrs)` : ""}
                </span>
              </div>
            </div>

            {/* DIAGRAMA DE CONTINUIDAD SECUENCIAL (FLUJO EN CADENA) */}
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-1 text-[10px]">
              {/* Etapa 1: Vaporizado */}
              {datosVaporizado.modalidadPases === "2_PASES" ? (
                <>
                  <div className="bg-amber-950/90 text-amber-200 border border-amber-500/40 px-2 py-1 rounded flex flex-col items-center">
                    <span className="font-bold text-[9px] uppercase text-amber-400">1° Pase Vapor</span>
                    <span className="font-black text-white">{calculateDuration(datosVaporizado.inyeccionVaporPase1?.inicio, datosVaporizado.inyeccionVaporPase1?.fin) || "--"}</span>
                    <span className="text-[8px] text-slate-400">{datosVaporizado.inyeccionVaporPase1?.inicio || "--:--"}</span>
                  </div>

                  <span className="text-slate-500 font-bold">➔</span>

                  <div className="bg-slate-900 text-slate-300 border border-slate-700 px-1.5 py-1 rounded flex flex-col items-center">
                    <span className="font-semibold text-[8.5px] uppercase text-slate-400">Pausa Inter-Pase</span>
                    <span className="font-mono text-amber-300">{duracionReposoInterPasesCalc || "--"}</span>
                  </div>

                  <span className="text-slate-500 font-bold">➔</span>

                  <div className="bg-amber-950/90 text-amber-200 border border-amber-500/40 px-2 py-1 rounded flex flex-col items-center">
                    <span className="font-bold text-[9px] uppercase text-amber-400">2° Pase Vapor</span>
                    <span className="font-black text-white">{calculateDuration(datosVaporizado.inyeccionVaporPase2?.inicio, datosVaporizado.inyeccionVaporPase2?.fin) || "--"}</span>
                    <span className="text-[8px] text-amber-300 font-bold">Fin: {horaFinInyeccionVapor || "--:--"}</span>
                  </div>
                </>
              ) : (
                <div className="bg-emerald-950/90 text-emerald-200 border border-emerald-500/40 px-2.5 py-1 rounded flex flex-col items-center">
                  <span className="font-bold text-[9px] uppercase text-emerald-400">Inyección Pase Único</span>
                  <span className="font-black text-white">{calculateDuration(datosVaporizado.inyeccionVapor?.inicio, datosVaporizado.inyeccionVapor?.fin) || "--"}</span>
                  <span className="text-[8px] text-emerald-300 font-bold">Fin: {horaFinInyeccionVapor || "--:--"}</span>
                </div>
              )}

              <span className="text-amber-400 font-black text-sm">➔</span>

              {/* Etapa 2: 1° Reposo */}
              <div className="bg-amber-900/60 text-amber-100 border border-amber-600/50 px-2 py-1 rounded flex flex-col items-center">
                <span className="font-bold text-[9px] uppercase text-amber-300">1° Reposo</span>
                <span className="font-black text-white">{duracionReposo1Calc || "--"}</span>
                <span className="text-[8px] text-slate-300">Ini: {etapaReposo1[0]?.horaInicio || "--:--"}</span>
              </div>

              <span className="text-slate-500 font-bold">➔</span>

              {/* Etapa 3: Enfriamiento */}
              <div className="bg-sky-950/80 text-sky-100 border border-sky-600/50 px-2 py-1 rounded flex flex-col items-center">
                <span className="font-bold text-[9px] uppercase text-sky-300">Enfriamiento</span>
                <span className="font-black text-white">{duracionEnfriamientoCalc || "--"}</span>
                <span className="text-[8px] text-slate-300">Ini: {etapaEnfriamiento[0]?.horaInicio || "--:--"}</span>
              </div>

              <span className="text-slate-500 font-bold">➔</span>

              {/* Etapa 4: 2° Reposo */}
              <div className="bg-amber-900/60 text-amber-100 border border-amber-600/50 px-2 py-1 rounded flex flex-col items-center">
                <span className="font-bold text-[9px] uppercase text-amber-300">2° Reposo</span>
                <span className="font-black text-white">{duracionReposo2Calc || "--"}</span>
                <span className="text-[8px] text-slate-300">Ini: {etapaReposo2[0]?.horaInicio || "--:--"}</span>
              </div>

              <span className="text-slate-500 font-bold">➔</span>

              {/* Etapa 5: Secado */}
              <div className="bg-rose-950/80 text-rose-100 border border-rose-600/50 px-2 py-1 rounded flex flex-col items-center">
                <span className="font-bold text-[9px] uppercase text-rose-300">Secado (13 Perf.)</span>
                <span className="font-black text-white">{secadoTotalMins > 0 ? `${secadoTotalMins} min` : "--"}</span>
                <span className="text-[8px] text-slate-300">Ini: {perfilesSecado[0]?.horaInicio || "--:--"}</span>
              </div>
            </div>

            {/* TABLA DE METAS Y DURACIONES POR ETAPA */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px]">
              <div className="bg-slate-950/60 rounded border border-amber-500/40 p-1.5">
                <span className="text-[10px] text-amber-300 block font-bold">
                  {datosVaporizado.modalidadPases === "2_PASES" ? "VAPORIZADO (2 PASES)" : "VAPORIZADO (1 PASE)"}
                </span>
                <span className="text-xs font-black text-white">{duracionVaporTotalCalc > 0 ? `${duracionVaporTotalCalc} min` : "0 min"}</span>
                <span className="text-[9px] text-amber-400/90 block mt-0.5 font-semibold">
                  {horaFinInyeccionVapor ? `Fin Iny: ${horaFinInyeccionVapor}` : "Sin fin reg."}
                </span>
              </div>

              <div className="bg-slate-950/60 rounded border border-amber-500/30 p-1.5">
                <span className="text-[10px] text-amber-300 block font-bold">1° REPOSO (Pre-Enfr.)</span>
                <span className="text-xs font-black text-white">{duracionReposo1Calc || "0 min"}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {etapaReposo1[0]?.horaInicio ? `Ini: ${etapaReposo1[0].horaInicio}` : "Sin hora"}
                </span>
              </div>

              <div className="bg-slate-950/60 rounded border border-sky-500/30 p-1.5">
                <span className="text-[10px] text-sky-300 block font-bold">ENFRIAMIENTO</span>
                <span className="text-xs font-black text-white">{duracionEnfriamientoCalc || "0 min"}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {etapaEnfriamiento[0]?.horaInicio ? `Ini: ${etapaEnfriamiento[0].horaInicio}` : "Sin hora"}
                </span>
              </div>

              <div className="bg-slate-950/60 rounded border border-amber-500/30 p-1.5">
                <span className="text-[10px] text-amber-300 block font-bold">2° REPOSO (Pre-Sec.)</span>
                <span className="text-xs font-black text-white">{duracionReposo2Calc || "0 min"}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {etapaReposo2[0]?.horaInicio ? `Ini: ${etapaReposo2[0].horaInicio}` : "Sin hora"}
                </span>
              </div>

              <div className="bg-slate-950/60 rounded border border-rose-500/30 p-1.5">
                <span className="text-[10px] text-rose-300 block font-bold">SECADO ACTIVO (13 Perf.)</span>
                <span className="text-xs font-black text-white">
                  {secadoTotalMins} min {secadoTotalMins > 0 ? `(~${(secadoTotalMins / 60).toFixed(1)} h)` : ""}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {perfilesSecado[0]?.horaInicio ? `Ini: ${perfilesSecado[0].horaInicio}` : "Sin hora"}
                </span>
              </div>
            </div>
          </div>

          {/* TABLA 1: ETAPA DE 1° REPOSO DEL GRANO (PASE ÚNICO / 2 PASES) — DESGLOSABLE / PLEGABLE */}
          <div className="border border-amber-600/60 rounded overflow-hidden shadow-xs">
            <div 
              onClick={() => setIsReposo1Desglosado(!isReposo1Desglosado)}
              className="bg-[#92400e] hover:bg-[#78350f] text-white font-bold py-1.5 px-3 text-xs tracking-wide uppercase flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors select-none"
              title="Haga clic para desglosar o plegar las casillas de 1° Reposo"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="p-0.5 rounded bg-amber-950/60 text-amber-200">
                  {isReposo1Desglosado ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
                <span>
                  1. ETAPA DE 1° REPOSO DEL GRANO {datosVaporizado.modalidadPases === "2_PASES" ? "(POST 2° PASE)" : "(PASE ÚNICO)"} — {etapaReposo1.length} CASILLAS
                </span>
                <span className="px-2 py-0.2 bg-amber-950/80 text-amber-200 rounded text-[10px] font-mono border border-amber-400/40" title="Tiempo de 1° Reposo calculado hasta inicio de enfriamiento">
                  ⏱️ T. 1° Reposo: {duracionReposo1Calc || "--"}
                </span>
                {duracionDescargaAReposo1Calc && (
                  <span className="px-2 py-0.2 bg-amber-800 text-amber-100 rounded text-[9.5px] font-mono border border-amber-500/40" title="Tiempo transcurrido entre fin de inyección de vapor y el inicio de reposo 1">
                    ⏳ Tránsito Iny ➔ Reposo: {duracionDescargaAReposo1Calc}
                  </span>
                )}
                <span className="px-1.5 py-0.2 bg-amber-700/80 text-amber-100 rounded text-[9.5px] font-bold">
                  {datosVaporizado.modalidadPases === "2_PASES" ? "2 Pases" : "1 Paso"}
                </span>

                {!isReposo1Desglosado && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40 lowercase first-letter:uppercase">
                    (opcional — desglosar si se utiliza)
                  </span>
                )}

                {hasReposo1Data && !isReposo1Desglosado && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                    Con datos registrados
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setIsReposo1Desglosado(!isReposo1Desglosado)}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 print:hidden ${
                    isReposo1Desglosado
                      ? "bg-amber-950 text-amber-200 hover:bg-slate-900 border border-amber-400/40"
                      : "bg-amber-300 hover:bg-white text-amber-950 font-black shadow-xs ring-1 ring-amber-400"
                  }`}
                  title={isReposo1Desglosado ? "Plegar casillas de 1° Reposo" : "Desglosar casillas de 1° Reposo"}
                >
                  {isReposo1Desglosado ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Plegar Casillas</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Desglosar (2 Casillas)</span>
                    </>
                  )}
                </button>

                {isReposo1Desglosado && (
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...etapaReposo1, {
                        ...etapaReposo1[0],
                        perfilIndex: `1° REPOSO (${etapaReposo1.length + 1})`,
                        horaInicio: "",
                        materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
                        modificaciones: { mod1: "", mod2: "", mod3: "" }
                      }];
                      setFormData(prev => ({ ...prev, etapaReposo1: list }));
                    }}
                    className="px-2 py-0.5 bg-amber-200 hover:bg-white text-amber-950 rounded text-[10px] font-bold transition-all cursor-pointer print:hidden"
                  >
                    + Añadir Casilla Reposo 1
                  </button>
                )}
              </div>
            </div>

            {/* Banner cuando está plegado (para desglosar a demanda) */}
            {!isReposo1Desglosado && (
              <div 
                onClick={() => setIsReposo1Desglosado(true)}
                className="bg-amber-950/20 hover:bg-amber-950/30 border-t border-amber-800/40 px-3 py-2 text-[11px] text-amber-200/90 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors print:hidden"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Etapa de 1° Reposo plegada (no siempre se utiliza en la operación diaria). Haga clic en <strong>Desglosar</strong> si este batch requiere registrar reposo térmico del grano antes del enfriamiento.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReposo1Desglosado(true);
                  }}
                  className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-[10px] cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Desglosar 1° Reposo ({etapaReposo1.length} Casillas)
                </button>
              </div>
            )}

            <div className={`${isReposo1Desglosado ? "block" : "hidden print:block"} overflow-x-auto`}>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-amber-100/70 border-b border-amber-300 font-bold text-slate-800 text-center">
                    <th className="border-r border-amber-200 py-1 px-1 w-20">FECHA</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-24">PERFIL / CASILLA</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">H INICIO</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-14">T° GRANO</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">T° AMBIENTE</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">H.RELATIVA</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16 bg-amber-200 font-black">HUMEDAD</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-14">GRAD.</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16 bg-yellow-100">TIEMPO</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">T° PROGRAM.</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-10">A1</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-10">A2</th>
                    <th className="border-r border-amber-200 py-0.5 px-1" colSpan={3}>CONTROL DE M.PRIMA</th>
                    <th className="py-0.5 px-1" colSpan={3}>MODIFICACIONES</th>
                    <th className="w-6 print:hidden"></th>
                  </tr>
                  <tr className="bg-amber-50 border-b border-amber-300 font-semibold text-slate-700 text-center text-[9px]">
                    <th colSpan={12} className="border-r border-amber-200"></th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-8">Q%</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-10">%TRIZ</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-8">BL°</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-12">01 TIEMP</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-12">02 TIEMP</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-14">03 MODIF</th>
                    <th className="print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200 text-center">
                  {etapaReposo1.map((row, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/50 bg-white">
                      <td className="border-r border-amber-200 py-0.5 px-1 font-mono text-slate-700">
                        <input
                          type="text"
                          value={row.fecha || ""}
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "fecha", e.target.value)}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-1 font-black text-amber-950 bg-amber-50/60">
                        {row.perfilIndex || (idx === 0 ? "1° REPOSO (1)" : idx === 1 ? "1° REPOSO (2)" : `1° REPOSO (${idx + 1})`)}
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 font-bold text-slate-900">
                        <div className="flex items-center justify-center gap-0.5">
                          <input
                            type="text"
                            value={row.horaInicio ?? ""}
                            placeholder="--:--"
                            onChange={(e) => handleStageRowChange("etapaReposo1", idx, "horaInicio", e.target.value)}
                            className="w-11 text-center font-bold outline-none bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => handleStageRowChange("etapaReposo1", idx, "horaInicio", getHoraActual())}
                            className="p-0.5 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors cursor-pointer print:hidden"
                            title="Insertar hora actual"
                          >
                            <Clock className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.tempGrano !== undefined ? row.tempGrano : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "tempGrano", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center font-semibold outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={row.tempAmbiente !== undefined ? row.tempAmbiente : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "tempAmbiente", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.humedadRelativa !== undefined ? row.humedadRelativa : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "humedadRelativa", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 font-black text-amber-950 bg-amber-100">
                        <input
                          type="text"
                          value={row.humedad ?? ""}
                          placeholder="%"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "humedad", e.target.value)}
                          className="w-full text-center font-black text-amber-950 outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={row.tempReal !== undefined ? row.tempReal : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "tempReal", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-yellow-50 font-bold text-amber-900">
                        <input
                          type="text"
                          value={row.tiempoMin !== undefined ? row.tiempoMin : ""}
                          placeholder={duracionReposo1Calc || "--"}
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "tiempoMin", e.target.value)}
                          className="w-full text-center font-bold text-amber-900 outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.tempProgramada !== undefined ? row.tempProgramada : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "tempProgramada", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.a1 !== undefined ? row.a1 : ""}
                          placeholder="-"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "a1", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.a2 !== undefined ? row.a2 : ""}
                          placeholder="-"
                          onChange={(e) => handleStageRowChange("etapaReposo1", idx, "a2", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      {/* Materia Prima */}
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-amber-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.qPct !== undefined ? row.materiaPrima.qPct : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaReposo1", idx, "qPct", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-amber-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.trizPct !== undefined ? row.materiaPrima.trizPct : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaReposo1", idx, "trizPct", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-amber-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.blGrad !== undefined ? row.materiaPrima.blGrad : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaReposo1", idx, "blGrad", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      {/* Modificaciones */}
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod1 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaReposo1", idx, "mod1", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod2 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaReposo1", idx, "mod2", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod3 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaReposo1", idx, "mod3", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="py-0.5 px-0.5 text-center print:hidden">
                        {etapaReposo1.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStageRow("etapaReposo1", idx)}
                            className="text-red-400 hover:text-red-700 font-bold text-xs cursor-pointer px-1"
                            title="Eliminar esta casilla"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA 2: ETAPA DE ENFRIAMIENTO DEL GRANO (2 CASILLAS) */}
          <div className="border border-sky-600/60 rounded overflow-hidden shadow-xs">
            <div className="bg-[#0369a1] text-white font-bold py-1 px-3 text-xs tracking-wide uppercase flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  2. ETAPA DE ENFRIAMIENTO DEL GRANO {datosVaporizado.modalidadPases === "2_PASES" ? "(SHOCK TÉRMICO CONTROLADO)" : "(PASE ÚNICO)"} — {etapaEnfriamiento.length} CASILLAS
                </span>
                <span className="px-2 py-0.2 bg-sky-950/80 text-sky-200 rounded text-[10px] font-mono border border-sky-400/40" title="Tiempo de enfriamiento calculado hasta inicio de 2° reposo o secado">
                  ⏱️ T. Enfriamiento: {duracionEnfriamientoCalc || "--"}
                </span>
                <span className="px-1.5 py-0.2 bg-sky-700/80 text-sky-100 rounded text-[9.5px] font-bold">
                  {datosVaporizado.modalidadPases === "2_PASES" ? "2 Pases" : "1 Paso"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const list = [...etapaEnfriamiento, {
                    ...etapaEnfriamiento[0],
                    perfilIndex: `ENFRIAM. (${etapaEnfriamiento.length + 1})`,
                    horaInicio: "",
                    materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
                    modificaciones: { mod1: "", mod2: "", mod3: "" }
                  }];
                  setFormData(prev => ({ ...prev, etapaEnfriamiento: list }));
                }}
                className="px-2 py-0.5 bg-sky-200 hover:bg-white text-sky-950 rounded text-[10px] font-bold transition-all cursor-pointer print:hidden"
              >
                + Añadir Casilla Enfriamiento
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-sky-100/70 border-b border-sky-300 font-bold text-slate-800 text-center">
                    <th className="border-r border-sky-200 py-1 px-1 w-20">FECHA</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-24">PERFIL / CASILLA</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-16">H INICIO</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-14">T° GRANO</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-16">T° AMBIENTE</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-16">H.RELATIVA</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-16 bg-sky-200 font-black">HUMEDAD</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-14">GRAD.</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-16 bg-cyan-100">TIEMPO</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-16">T° PROGRAM.</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-10">A1</th>
                    <th className="border-r border-sky-200 py-1 px-1 w-10">A2</th>
                    <th className="border-r border-sky-200 py-0.5 px-1" colSpan={3}>CONTROL DE M.PRIMA</th>
                    <th className="py-0.5 px-1" colSpan={3}>MODIFICACIONES</th>
                    <th className="w-6 print:hidden"></th>
                  </tr>
                  <tr className="bg-sky-50 border-b border-sky-300 font-semibold text-slate-700 text-center text-[9px]">
                    <th colSpan={12} className="border-r border-sky-200"></th>
                    <th className="border-r border-sky-200 py-0.5 px-0.5 w-8">Q%</th>
                    <th className="border-r border-sky-200 py-0.5 px-0.5 w-10">%TRIZ</th>
                    <th className="border-r border-sky-200 py-0.5 px-0.5 w-8">BL°</th>
                    <th className="border-r border-sky-200 py-0.5 px-0.5 w-12">01 TIEMP</th>
                    <th className="border-r border-sky-200 py-0.5 px-0.5 w-12">02 TIEMP</th>
                    <th className="border-r border-sky-200 py-0.5 px-0.5 w-14">03 MODIF</th>
                    <th className="print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-200 text-center">
                  {etapaEnfriamiento.map((row, idx) => (
                    <tr key={idx} className="hover:bg-sky-50/50 bg-white">
                      <td className="border-r border-sky-200 py-0.5 px-1 font-mono text-slate-700">
                        <input
                          type="text"
                          value={row.fecha || ""}
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "fecha", e.target.value)}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-1 font-black text-sky-950 bg-sky-50/60">
                        {row.perfilIndex || (idx === 0 ? "ENFRIAMIENTO (1)" : idx === 1 ? "ENFRIAMIENTO (2)" : `ENFRIAM. (${idx + 1})`)}
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5 font-bold text-slate-900">
                        <div className="flex items-center justify-center gap-0.5">
                          <input
                            type="text"
                            value={row.horaInicio ?? ""}
                            placeholder="--:--"
                            onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "horaInicio", e.target.value)}
                            className="w-11 text-center font-bold outline-none bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => handleStageRowChange("etapaEnfriamiento", idx, "horaInicio", getHoraActual())}
                            className="p-0.5 text-slate-400 hover:text-sky-700 hover:bg-sky-100 rounded transition-colors cursor-pointer print:hidden"
                            title="Insertar hora actual"
                          >
                            <Clock className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.tempGrano !== undefined ? row.tempGrano : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "tempGrano", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center font-semibold outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={row.tempAmbiente !== undefined ? row.tempAmbiente : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "tempAmbiente", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.humedadRelativa !== undefined ? row.humedadRelativa : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "humedadRelativa", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5 font-black text-sky-950 bg-sky-100">
                        <input
                          type="text"
                          value={row.humedad ?? ""}
                          placeholder="%"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "humedad", e.target.value)}
                          className="w-full text-center font-black text-sky-950 outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={row.tempReal !== undefined ? row.tempReal : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "tempReal", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5 bg-cyan-50 font-bold text-sky-900">
                        <input
                          type="text"
                          value={row.tiempoMin !== undefined ? row.tiempoMin : ""}
                          placeholder={duracionEnfriamientoCalc || "--"}
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "tiempoMin", e.target.value)}
                          className="w-full text-center font-bold text-sky-900 outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.tempProgramada !== undefined ? row.tempProgramada : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "tempProgramada", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.a1 !== undefined ? row.a1 : ""}
                          placeholder="-"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "a1", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.a2 !== undefined ? row.a2 : ""}
                          placeholder="-"
                          onChange={(e) => handleStageRowChange("etapaEnfriamiento", idx, "a2", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      {/* Materia Prima */}
                      <td className="border-r border-sky-200 py-0.5 px-0.5 bg-sky-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.qPct !== undefined ? row.materiaPrima.qPct : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaEnfriamiento", idx, "qPct", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5 bg-sky-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.trizPct !== undefined ? row.materiaPrima.trizPct : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaEnfriamiento", idx, "trizPct", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5 bg-sky-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.blGrad !== undefined ? row.materiaPrima.blGrad : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaEnfriamiento", idx, "blGrad", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      {/* Modificaciones */}
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod1 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaEnfriamiento", idx, "mod1", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod2 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaEnfriamiento", idx, "mod2", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-sky-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod3 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaEnfriamiento", idx, "mod3", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="py-0.5 px-0.5 text-center print:hidden">
                        {etapaEnfriamiento.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStageRow("etapaEnfriamiento", idx)}
                            className="text-red-400 hover:text-red-700 font-bold text-xs cursor-pointer px-1"
                            title="Eliminar esta casilla"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA 3: ETAPA DE 2° REPOSO DEL GRANO (2 CASILLAS) — DESGLOSABLE / PLEGABLE */}
          <div className="border border-amber-600/60 rounded overflow-hidden shadow-xs">
            <div 
              onClick={() => setIsReposo2Desglosado(!isReposo2Desglosado)}
              className="bg-[#92400e] hover:bg-[#78350f] text-white font-bold py-1.5 px-3 text-xs tracking-wide uppercase flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors select-none"
              title="Haga clic para desglosar o plegar las casillas de 2° Reposo"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="p-0.5 rounded bg-amber-950/60 text-amber-200">
                  {isReposo2Desglosado ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
                <span>
                  3. ETAPA DE 2° REPOSO DEL GRANO {datosVaporizado.modalidadPases === "2_PASES" ? "(HOMOGENEIZACIÓN PRE-SECADO)" : "(ESTABILIZACIÓN)"} — {etapaReposo2.length} CASILLAS
                </span>
                <span className="px-2 py-0.2 bg-amber-950/80 text-amber-200 rounded text-[10px] font-mono border border-amber-400/40" title="Tiempo de 2° reposo calculado hasta ingreso a secado">
                  ⏱️ T. 2° Reposo: {duracionReposo2Calc || "--"}
                </span>
                <span className="px-1.5 py-0.2 bg-amber-700/80 text-amber-100 rounded text-[9.5px] font-bold">
                  {datosVaporizado.modalidadPases === "2_PASES" ? "2 Pases" : "1 Paso"}
                </span>

                {!isReposo2Desglosado && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/40 lowercase first-letter:uppercase">
                    (opcional — desglosar si se utiliza)
                  </span>
                )}

                {hasReposo2Data && !isReposo2Desglosado && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                    Con datos registrados
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setIsReposo2Desglosado(!isReposo2Desglosado)}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 print:hidden ${
                    isReposo2Desglosado
                      ? "bg-amber-950 text-amber-200 hover:bg-slate-900 border border-amber-400/40"
                      : "bg-amber-300 hover:bg-white text-amber-950 font-black shadow-xs ring-1 ring-amber-400"
                  }`}
                  title={isReposo2Desglosado ? "Plegar casillas de 2° Reposo" : "Desglosar casillas de 2° Reposo"}
                >
                  {isReposo2Desglosado ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Plegar Casillas</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Desglosar (2 Casillas)</span>
                    </>
                  )}
                </button>

                {isReposo2Desglosado && (
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...etapaReposo2, {
                        ...etapaReposo2[0],
                        perfilIndex: `2° REPOSO (${etapaReposo2.length + 1})`,
                        horaInicio: "",
                        materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
                        modificaciones: { mod1: "", mod2: "", mod3: "" }
                      }];
                      setFormData(prev => ({ ...prev, etapaReposo2: list }));
                    }}
                    className="px-2 py-0.5 bg-amber-200 hover:bg-white text-amber-950 rounded text-[10px] font-bold transition-all cursor-pointer print:hidden"
                  >
                    + Añadir Casilla 2° Reposo
                  </button>
                )}
              </div>
            </div>

            {/* Banner cuando está plegado (para desglosar a demanda) */}
            {!isReposo2Desglosado && (
              <div 
                onClick={() => setIsReposo2Desglosado(true)}
                className="bg-amber-950/20 hover:bg-amber-950/30 border-t border-amber-800/40 px-3 py-2 text-[11px] text-amber-200/90 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors print:hidden"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Etapa de 2° Reposo plegada (no siempre se utiliza). Haga clic en <strong>Desglosar</strong> si este batch requiere homogeneización previa al secado.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReposo2Desglosado(true);
                  }}
                  className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-[10px] cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Desglosar 2° Reposo ({etapaReposo2.length} Casillas)
                </button>
              </div>
            )}

            <div className={`${isReposo2Desglosado ? "block" : "hidden print:block"} overflow-x-auto`}>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-amber-100/70 border-b border-amber-300 font-bold text-slate-800 text-center">
                    <th className="border-r border-amber-200 py-1 px-1 w-20">FECHA</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-24">PERFIL / CASILLA</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">H INICIO</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-14">T° GRANO</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">T° AMBIENTE</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">H.RELATIVA</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16 bg-amber-200 font-black">HUMEDAD</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-14">GRAD.</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16 bg-yellow-100">TIEMPO</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-16">T° PROGRAM.</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-10">A1</th>
                    <th className="border-r border-amber-200 py-1 px-1 w-10">A2</th>
                    <th className="border-r border-amber-200 py-0.5 px-1" colSpan={3}>CONTROL DE M.PRIMA</th>
                    <th className="py-0.5 px-1" colSpan={3}>MODIFICACIONES</th>
                    <th className="w-6 print:hidden"></th>
                  </tr>
                  <tr className="bg-amber-50 border-b border-amber-300 font-semibold text-slate-700 text-center text-[9px]">
                    <th colSpan={12} className="border-r border-amber-200"></th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-8">Q%</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-10">%TRIZ</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-8">BL°</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-12">01 TIEMP</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-12">02 TIEMP</th>
                    <th className="border-r border-amber-200 py-0.5 px-0.5 w-14">03 MODIF</th>
                    <th className="print:hidden"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200 text-center">
                  {etapaReposo2.map((row, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/50 bg-white">
                      <td className="border-r border-amber-200 py-0.5 px-1 font-mono text-slate-700">
                        <input
                          type="text"
                          value={row.fecha || ""}
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "fecha", e.target.value)}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-1 font-black text-amber-950 bg-amber-50/60">
                        {row.perfilIndex || (idx === 0 ? "2° REPOSO (1)" : idx === 1 ? "2° REPOSO (2)" : `2° REPOSO (${idx + 1})`)}
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 font-bold text-slate-900">
                        <div className="flex items-center justify-center gap-0.5">
                          <input
                            type="text"
                            value={row.horaInicio ?? ""}
                            placeholder="--:--"
                            onChange={(e) => handleStageRowChange("etapaReposo2", idx, "horaInicio", e.target.value)}
                            className="w-11 text-center font-bold outline-none bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => handleStageRowChange("etapaReposo2", idx, "horaInicio", getHoraActual())}
                            className="p-0.5 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors cursor-pointer print:hidden"
                            title="Insertar hora actual"
                          >
                            <Clock className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.tempGrano !== undefined ? row.tempGrano : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "tempGrano", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center font-semibold outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={row.tempAmbiente !== undefined ? row.tempAmbiente : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "tempAmbiente", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.humedadRelativa !== undefined ? row.humedadRelativa : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "humedadRelativa", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 font-black text-amber-950 bg-amber-100">
                        <input
                          type="text"
                          value={row.humedad ?? ""}
                          placeholder="%"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "humedad", e.target.value)}
                          className="w-full text-center font-black text-amber-950 outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          step="0.1"
                          value={row.tempReal !== undefined ? row.tempReal : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "tempReal", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-yellow-50 font-bold text-amber-900">
                        <input
                          type="text"
                          value={row.tiempoMin !== undefined ? row.tiempoMin : ""}
                          placeholder={duracionReposo2Calc || "--"}
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "tiempoMin", e.target.value)}
                          className="w-full text-center font-bold text-amber-900 outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.tempProgramada !== undefined ? row.tempProgramada : ""}
                          placeholder="--"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "tempProgramada", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.a1 !== undefined ? row.a1 : ""}
                          placeholder="-"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "a1", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="number"
                          value={row.a2 !== undefined ? row.a2 : ""}
                          placeholder="-"
                          onChange={(e) => handleStageRowChange("etapaReposo2", idx, "a2", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent"
                        />
                      </td>
                      {/* Materia Prima */}
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-amber-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.qPct !== undefined ? row.materiaPrima.qPct : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaReposo2", idx, "qPct", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-amber-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.trizPct !== undefined ? row.materiaPrima.trizPct : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaReposo2", idx, "trizPct", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5 bg-amber-50/40">
                        <input
                          type="number"
                          step="0.1"
                          value={row.materiaPrima?.blGrad !== undefined ? row.materiaPrima.blGrad : ""}
                          placeholder=""
                          onChange={(e) => handleStageMateriaPrimaChange("etapaReposo2", idx, "blGrad", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      {/* Modificaciones */}
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod1 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaReposo2", idx, "mod1", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod2 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaReposo2", idx, "mod2", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="border-r border-amber-200 py-0.5 px-0.5">
                        <input
                          type="text"
                          value={row.modificaciones?.mod3 ?? ""}
                          placeholder=""
                          onChange={(e) => handleStageModificacionesChange("etapaReposo2", idx, "mod3", e.target.value)}
                          className="w-full text-center outline-none bg-transparent text-[9px]"
                        />
                      </td>
                      <td className="py-0.5 px-0.5 text-center print:hidden">
                        {etapaReposo2.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStageRow("etapaReposo2", idx)}
                            className="text-red-400 hover:text-red-700 font-bold text-xs cursor-pointer px-1"
                            title="Eliminar esta casilla"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA 4: REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO - ETAPA DE SECADO (PERFILES 0 A 12) */}
          <div className="border border-slate-400 rounded overflow-hidden shadow-xs">
            {/* Header de la Sección 4 */}
            <div className="bg-[#7a1818] text-white font-bold py-1.5 px-3 text-xs tracking-wide uppercase flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>4. REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO — ETAPA DE SECADO (PERFILES 0 AL 12)</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {/* Selector de Disposición de Receta */}
                <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-slate-700 text-[10px]" title="Cambiar la posición de la Receta de Secado para optimizar el espacio en pantalla">
                  <button
                    type="button"
                    onClick={() => setRecetaLayoutMode("lateral_derecha")}
                    className={`px-2 py-1 rounded flex items-center gap-1 font-bold transition-all cursor-pointer ${
                      recetaLayoutMode === "lateral_derecha"
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="Mostrar Receta de Secado AL COSTADO del formato (alineada fila por fila P0-P12)"
                  >
                    <PanelRight className="w-3 h-3" />
                    <span>Al Costado (Formato)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecetaLayoutMode("cinta_superior")}
                    className={`px-2 py-1 rounded flex items-center gap-1 font-bold transition-all cursor-pointer ${
                      recetaLayoutMode === "cinta_superior"
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="Mostrar Receta en Barra Superior (Horizontal P0 a P12)"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>Barra Superior</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecetaLayoutMode("oculto")}
                    className={`px-2 py-1 rounded flex items-center gap-1 font-bold transition-all cursor-pointer ${
                      recetaLayoutMode === "oculto"
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="Ocultar Receta para ver únicamente las columnas del registro del operario"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>Ocultar</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPanelRecetaOpen(!isPanelRecetaOpen)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 border border-amber-400/40 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Abrir o cerrar el panel inteligente de propuesta termodinámica"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isPanelRecetaOpen ? "Ocultar Asistente" : "Asistente (Meta 31°C)"}</span>
                  {isPanelRecetaOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistoricoModal(true)}
                  className="px-2.5 py-1 bg-cyan-900/80 hover:bg-cyan-800 text-cyan-200 border border-cyan-500/40 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Ver las curvas y recetas de secado guardadas en el historial"
                >
                  <History className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Historial ({historicoRecetas.length})</span>
                </button>

                <button
                  id="btn-photo-secado"
                  type="button"
                  onClick={() => handleOpenOCR("ETAPA_SECADO")}
                  className="px-2.5 py-1 bg-rose-200 hover:bg-white text-rose-950 rounded text-[11px] font-black flex items-center gap-1 shadow transition-all cursor-pointer"
                  title="Tomar foto de la tabla de perfiles de secado o registro del operario"
                >
                  <Camera className="w-3.5 h-3.5 text-rose-900" />
                  <span>Foto OCR</span>
                </button>
              </div>
            </div>

            {/* PANEL INTELIGENTE DE PROPUESTA DE RECETA (META: 31°C ± 1°C) */}
            {isPanelRecetaOpen && (
              <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-slate-100 p-3.5 border-b border-slate-700 print:hidden space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-amber-300 uppercase tracking-wider">
                          Asistente Termodinámico de Receta de Secado
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          Meta Térmica Grano: 31.0°C (±1.0°C)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Calcula y ajusta la receta óptima de aire caliente por perfil según humedad del grano, temperatura ambiente y humedad relativa (psicrometría).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAplicarPropuestaReceta}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                      title="Rellena la receta y los 13 perfiles con la curva óptima para mantener grano en 31°C"
                    >
                      <Zap className="w-4 h-4 text-slate-950 fill-current" />
                      <span>✨ Aplicar Receta Sugerida (P0-P12)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGuardarHistoricoManual}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Guarda los perfiles y condiciones actuales en la memoria histórica del sistema"
                    >
                      <Save className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Guardar en Aprendizaje</span>
                    </button>
                  </div>
                </div>

                {/* Controles de Entrada Psicrométrica */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  {/* Humedad Inicial */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                      <span>💧 Humedad Inicial Grano (%)</span>
                    </label>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-1">
                      <input
                        type="number"
                        step="0.1"
                        min="10"
                        max="30"
                        value={humedadEntradaSecado}
                        onChange={(e) => setHumedadEntradaSecado(parseFloat(e.target.value) || 16.5)}
                        className="w-full bg-transparent font-bold text-white text-xs outline-none"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">%</span>
                    </div>
                  </div>

                  {/* Temp Ambiente */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
                      <Thermometer className="w-3 h-3" />
                      <span>T° Ambiente Actual (°C)</span>
                    </label>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-1">
                      <input
                        type="number"
                        step="0.5"
                        min="10"
                        max="45"
                        value={tempAmbienteSecado}
                        onChange={(e) => setTempAmbienteSecado(parseFloat(e.target.value) || 26.0)}
                        className="w-full bg-transparent font-bold text-white text-xs outline-none"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">°C</span>
                    </div>
                  </div>

                  {/* Humedad Relativa */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-sky-400 flex items-center gap-1">
                      <Wind className="w-3 h-3" />
                      <span>Humedad Relativa (% HR)</span>
                    </label>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-1">
                      <input
                        type="number"
                        step="1"
                        min="10"
                        max="100"
                        value={humedadRelativaSecado}
                        onChange={(e) => setHumedadRelativaSecado(parseFloat(e.target.value) || 65.0)}
                        className="w-full bg-transparent font-bold text-white text-xs outline-none"
                      />
                      <span className="text-[10px] text-slate-400 font-mono">%</span>
                    </div>
                  </div>

                  {/* Indicador de Grano Estimado */}
                  <div className="flex flex-col justify-center bg-emerald-950/60 border border-emerald-500/40 rounded px-3 py-1 text-center">
                    <span className="text-[9.5px] font-bold text-emerald-300 uppercase">T° Grano Estimada Promedio</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {propuestaReceta?.tempGranoEstimadaPromedio ? `${propuestaReceta.tempGranoEstimadaPromedio}°C` : "31.0°C"}
                    </span>
                    <span className="text-[9px] text-emerald-200/80">Rango ideal: 30.0°C – 32.0°C</span>
                  </div>
                </div>

                {/* Explicación Termodinámica y Diagnóstico */}
                {propuestaReceta && (
                  <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-200/90">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300">Fundamento Termodinámico: </span>
                      <span>{propuestaReceta.explicacionTermodinamica}</span>
                      {propuestaReceta.lotesHistoricosSimilaresCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                          🎯 Ajustado con {propuestaReceta.lotesHistoricosSimilaresCount} lotes históricos reales
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RECETA DE SECADO EN BARRA SUPERIOR (CINTA COMPACTA HORIZONTAL P0 A P12 - 0 ESPACIO LATERAL) */}
            {recetaLayoutMode === "cinta_superior" && (
              <div className="bg-slate-900 border-b border-slate-700 p-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-black flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      RECETA DE SECADO PROGRAMADA (PERFILES P0 AL P12)
                    </span>
                    <span className="text-[11px] text-slate-300 hidden sm:inline">
                      Meta Térmica Grano: <strong className="text-emerald-400 font-mono">31.0°C (±1.0°C)</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAplicarPropuestaReceta}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded text-[10.5px] flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Aplica los tiempos y temperaturas de la receta a los 13 perfiles de secado en la tabla inferior"
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>✨ Aplicar a los 13 Perfiles</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPanelRecetaOpen(true)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
                      title="Abrir asistente para recalcular según clima psicrométrico"
                    >
                      <BrainCircuit className="w-3 h-3 text-amber-400" />
                      <span>Ajustar Clima</span>
                    </button>
                  </div>
                </div>

                {/* Cinta Horizontal con los 13 Perfiles P0 a P12 */}
                <div className="overflow-x-auto pb-1">
                  <div className="grid grid-cols-13 min-w-[920px] gap-1.5 bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                    {recetaSecado.map((r, idx) => {
                      const perfilCorrespondiente = perfilesSecado[idx];
                      const tempGranoRegistrada = perfilCorrespondiente?.tempGrano;
                      
                      let estadoGrano = "bg-slate-800/80 text-slate-400 border-slate-700";
                      if (tempGranoRegistrada !== undefined && tempGranoRegistrada > 0) {
                        if (tempGranoRegistrada >= 30.0 && tempGranoRegistrada <= 32.0) {
                          estadoGrano = "bg-emerald-950/90 text-emerald-300 border-emerald-600/60 font-black";
                        } else if (tempGranoRegistrada > 32.0) {
                          estadoGrano = "bg-rose-950/90 text-rose-300 border-rose-600/60 font-black";
                        } else {
                          estadoGrano = "bg-amber-950/90 text-amber-300 border-amber-600/60 font-black";
                        }
                      }

                      return (
                        <div 
                          key={r.perfil} 
                          className="bg-slate-900 border border-slate-700/80 rounded-md p-1.5 flex flex-col items-center justify-between text-center gap-1 shadow-xs hover:border-amber-500/50 transition-colors"
                        >
                          <div className="w-full flex items-center justify-between border-b border-slate-700/60 pb-0.5">
                            <span className="text-[10px] font-black text-amber-400 font-mono">{r.perfil}</span>
                            <span className="text-[8px] text-slate-400">
                              {idx === 0 ? "Ini" : idx === 12 ? "Fin" : `#${idx}`}
                            </span>
                          </div>

                          {/* Tiempo */}
                          <div className="w-full flex items-center justify-between text-[9.5px] bg-slate-950/70 px-1 py-0.5 rounded border border-slate-800">
                            <span className="text-[8px] text-slate-400">Tiem:</span>
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="180"
                                value={r.tiempo !== undefined && r.tiempo > 0 ? r.tiempo : ""}
                                placeholder="--"
                                onChange={(e) => handleRecetaItemChange(idx, "tiempo", parseInt(e.target.value) || 0)}
                                className="w-5 text-right font-bold text-white outline-none bg-transparent hover:bg-amber-500/20 rounded"
                              />
                              <span className="text-[7.5px] text-slate-400 ml-0.5">m</span>
                            </div>
                          </div>

                          {/* T° Aire */}
                          <div className="w-full flex items-center justify-between text-[9.5px] bg-rose-950/40 px-1 py-0.5 rounded border border-rose-900/40">
                            <span className="text-[8px] text-rose-400">Aire:</span>
                            <div className="flex items-center">
                              <input
                                type="number"
                                step="0.5"
                                min="20"
                                max="90"
                                value={r.temp !== undefined && r.temp > 0 ? r.temp : ""}
                                placeholder="--"
                                onChange={(e) => handleRecetaItemChange(idx, "temp", parseFloat(e.target.value) || 0)}
                                className="w-5 text-right font-black text-rose-300 outline-none bg-transparent hover:bg-rose-500/20 rounded"
                              />
                              <span className="text-[7.5px] text-rose-400 ml-0.5">°</span>
                            </div>
                          </div>

                          {/* T° Grano (Meta / Real) */}
                          <div 
                            className={`w-full text-[8px] px-1 py-0.5 rounded border text-center font-mono ${estadoGrano}`}
                            title={tempGranoRegistrada ? `T° Grano real registrado: ${tempGranoRegistrada}°C (Meta: 31°C ±1°C)` : `Meta Térmica: ~31°C`}
                          >
                            {tempGranoRegistrada !== undefined && tempGranoRegistrada > 0 ? `${tempGranoRegistrada.toFixed(1)}°C` : "~31°C"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* AVISO CUANDO LA RECETA ESTÁ OCULTA */}
            {recetaLayoutMode === "oculto" && (
              <div className="bg-slate-900/90 border-b border-slate-700 px-3 py-1.5 text-xs flex items-center justify-between text-slate-300 print:hidden">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Receta de Secado oculta — Tabla de 13 perfiles con 100% de ancho útil</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRecetaLayoutMode("lateral_derecha")}
                  className="px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[11px] font-bold border border-slate-600 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Mostrar Receta en Lado Derecho</span>
                </button>
              </div>
            )}

            {/* TABLA PRINCIPAL DE PERFILES DE SECADO CON RECETA AL COSTADO */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-400 font-bold text-slate-800 text-center">
                      <th className="border-r border-slate-300 py-1 px-1 w-20">FECHA</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-12">PERFIL</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-16">H INICIO</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-14 bg-emerald-100 font-black text-emerald-950">T° GRANO</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-16">T° AMBIENTE</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-16">H.RELATIVA</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-16 bg-amber-100 font-black">HUMEDAD</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-14">GRAD.</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-12">TIEMPO</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-16">T° PROGRAM.</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-10">A1</th>
                      <th className="border-r border-slate-300 py-1 px-1 w-10">A2</th>
                      <th className="border-r border-slate-300 py-0.5 px-1" colSpan={3}>CONTROL DE M.PRIMA</th>
                      <th className={`${recetaLayoutMode === "lateral_derecha" ? "border-r border-slate-300" : ""} py-0.5 px-1`} colSpan={3}>MODIFICACIONES</th>
                      {recetaLayoutMode === "lateral_derecha" && (
                        <th colSpan={3} className="border-l-2 border-emerald-700 bg-[#28541e] text-white py-1 px-1.5 text-[9px] font-bold">
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1 font-black text-emerald-100">
                              <Sliders className="w-2.5 h-2.5 text-emerald-300" />
                              RECETA (31°C)
                            </span>
                            <button
                              type="button"
                              onClick={handleAplicarPropuestaReceta}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded text-[7.5px] cursor-pointer shadow-xs active:scale-95 transition-transform"
                              title="Copiar los 13 valores recomendados a las columnas de tiempo y temperatura de la tabla"
                            >
                              ✨ Aplicar
                            </button>
                          </div>
                        </th>
                      )}
                    </tr>
                    <tr className="bg-slate-100 border-b border-slate-400 font-semibold text-slate-700 text-center text-[9px]">
                      <th colSpan={12} className="border-r border-slate-300"></th>
                      <th className="border-r border-slate-300 py-0.5 px-0.5 w-8">Q%</th>
                      <th className="border-r border-slate-300 py-0.5 px-0.5 w-10">%TRIZ</th>
                      <th className="border-r border-slate-300 py-0.5 px-0.5 w-8">BL°</th>
                      <th className="border-r border-slate-300 py-0.5 px-0.5 w-12">01 TIEMP</th>
                      <th className="border-r border-slate-300 py-0.5 px-0.5 w-12">02 TIEMP</th>
                      <th className={`${recetaLayoutMode === "lateral_derecha" ? "border-r border-slate-300" : ""} py-0.5 px-0.5 w-14`}>03 MODIF</th>
                      {recetaLayoutMode === "lateral_derecha" && (
                        <>
                          <th className="border-l-2 border-emerald-700 border-r border-emerald-800/40 py-0.5 px-0.5 w-9 bg-emerald-950 text-emerald-200 font-bold text-[7.5px]">MIN</th>
                          <th className="border-r border-emerald-800/40 py-0.5 px-0.5 w-11 bg-emerald-950 text-emerald-200 font-bold text-[7.5px]">T°AIRE</th>
                          <th className="py-0.5 px-0.5 w-8 bg-emerald-950 text-emerald-300 font-bold text-[7.5px]" title="Meta térmica de grano">GRAN</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 text-center">
                    {perfilesSecado.map((perfil, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border-r border-slate-300 py-0.5 px-1 font-mono text-slate-700">
                          <input
                            type="text"
                            value={perfil.fecha || ""}
                            onChange={(e) => handlePerfilSecadoChange(idx, "fecha", e.target.value)}
                            className="w-full text-center outline-none bg-transparent"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-1 font-black text-slate-900 bg-slate-50">
                          {perfil.perfilIndex}
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5 font-bold text-slate-900">
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="text"
                              value={perfil.horaInicio ?? ""}
                              placeholder="--:--"
                              onChange={(e) => handlePerfilSecadoChange(idx, "horaInicio", e.target.value)}
                              className="w-11 text-center font-bold outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => handlePerfilSecadoChange(idx, "horaInicio", getHoraActual())}
                              className="p-0.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 rounded transition-colors cursor-pointer print:hidden"
                              title="Insertar hora actual"
                            >
                              <Clock className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5 bg-emerald-50/50">
                          <input
                            type="number"
                            step="0.1"
                            value={perfil.tempGrano !== undefined ? perfil.tempGrano : ""}
                            placeholder="--"
                            onChange={(e) => handlePerfilSecadoChange(idx, "tempGrano", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className={`w-full text-center font-bold outline-none bg-transparent ${
                              perfil.tempGrano !== undefined && perfil.tempGrano >= 30.0 && perfil.tempGrano <= 32.0
                                ? "text-emerald-700 font-black"
                                : perfil.tempGrano !== undefined && perfil.tempGrano > 32.0
                                ? "text-rose-700 font-black"
                                : "text-slate-800"
                            }`}
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="number"
                            step="0.1"
                            value={perfil.tempAmbiente !== undefined ? perfil.tempAmbiente : ""}
                            placeholder="--"
                            onChange={(e) => handlePerfilSecadoChange(idx, "tempAmbiente", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className="w-full text-center outline-none bg-transparent"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="number"
                            value={perfil.humedadRelativa !== undefined ? perfil.humedadRelativa : ""}
                            placeholder="--"
                            onChange={(e) => handlePerfilSecadoChange(idx, "humedadRelativa", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className="w-full text-center outline-none bg-transparent"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5 font-black text-emerald-900 bg-amber-100/70">
                          <input
                            type="text"
                            value={perfil.humedad ?? ""}
                            placeholder="%"
                            onChange={(e) => handlePerfilSecadoChange(idx, "humedad", e.target.value)}
                            className="w-full text-center font-black text-emerald-950 outline-none bg-transparent"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="number"
                            step="0.1"
                            value={perfil.tempReal !== undefined ? perfil.tempReal : ""}
                            placeholder="--"
                            onChange={(e) => handlePerfilSecadoChange(idx, "tempReal", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className="w-full text-center outline-none bg-transparent"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="number"
                            value={perfil.tiempoMin !== undefined ? perfil.tiempoMin : ""}
                            placeholder="--"
                            onChange={(e) => handlePerfilSecadoChange(idx, "tiempoMin", e.target.value === "" ? undefined : parseInt(e.target.value))}
                            className="w-full text-center outline-none bg-transparent font-bold"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5 font-bold text-rose-900 bg-rose-50/20">
                          <input
                            type="number"
                            value={perfil.tempProgramada !== undefined ? perfil.tempProgramada : ""}
                            placeholder="--"
                            onChange={(e) => handlePerfilSecadoChange(idx, "tempProgramada", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className="w-full text-center font-bold text-rose-900 outline-none bg-transparent"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="number"
                            value={perfil.a1 !== undefined ? perfil.a1 : ""}
                            placeholder="-"
                            onChange={(e) => handlePerfilSecadoChange(idx, "a1", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className="w-full text-center outline-none bg-transparent"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="number"
                            value={perfil.a2 !== undefined ? perfil.a2 : ""}
                            placeholder="-"
                            onChange={(e) => handlePerfilSecadoChange(idx, "a2", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className="w-full text-center outline-none bg-transparent"
                          />
                        </td>
                        {/* Materia Prima */}
                        <td className="border-r border-slate-300 py-0.5 px-0.5 bg-slate-50">
                          <input
                            type="number"
                            step="0.1"
                            value={perfil.materiaPrima?.qPct !== undefined ? perfil.materiaPrima.qPct : ""}
                            placeholder=""
                            onChange={(e) => {
                              const cur = perfil.materiaPrima || {};
                              handlePerfilSecadoChange(idx, "materiaPrima", { ...cur, qPct: e.target.value === "" ? undefined : parseFloat(e.target.value) });
                            }}
                            className="w-full text-center outline-none bg-transparent text-[9px]"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5 bg-slate-50">
                          <input
                            type="number"
                            step="0.1"
                            value={perfil.materiaPrima?.trizPct !== undefined ? perfil.materiaPrima.trizPct : ""}
                            placeholder=""
                            onChange={(e) => {
                              const cur = perfil.materiaPrima || {};
                              handlePerfilSecadoChange(idx, "materiaPrima", { ...cur, trizPct: e.target.value === "" ? undefined : parseFloat(e.target.value) });
                            }}
                            className="w-full text-center outline-none bg-transparent text-[9px]"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5 bg-slate-50">
                          <input
                            type="number"
                            step="0.1"
                            value={perfil.materiaPrima?.blGrad !== undefined ? perfil.materiaPrima.blGrad : ""}
                            placeholder=""
                            onChange={(e) => {
                              const cur = perfil.materiaPrima || {};
                              handlePerfilSecadoChange(idx, "materiaPrima", { ...cur, blGrad: e.target.value === "" ? undefined : parseFloat(e.target.value) });
                            }}
                            className="w-full text-center outline-none bg-transparent text-[9px]"
                          />
                        </td>
                        {/* Modificaciones */}
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="text"
                            value={perfil.modificaciones?.mod1 ?? ""}
                            placeholder=""
                            onChange={(e) => {
                              const cur = perfil.modificaciones || {};
                              handlePerfilSecadoChange(idx, "modificaciones", { ...cur, mod1: e.target.value });
                            }}
                            className="w-full text-center outline-none bg-transparent text-[9px]"
                          />
                        </td>
                        <td className="border-r border-slate-300 py-0.5 px-0.5">
                          <input
                            type="text"
                            value={perfil.modificaciones?.mod2 ?? ""}
                            placeholder=""
                            onChange={(e) => {
                              const cur = perfil.modificaciones || {};
                              handlePerfilSecadoChange(idx, "modificaciones", { ...cur, mod2: e.target.value });
                            }}
                            className="w-full text-center outline-none bg-transparent text-[9px]"
                          />
                        </td>
                        <td className={`${recetaLayoutMode === "lateral_derecha" ? "border-r border-slate-300" : ""} py-0.5 px-0.5`}>
                          <input
                            type="text"
                            value={perfil.modificaciones?.mod3 ?? ""}
                            placeholder=""
                            onChange={(e) => {
                              const cur = perfil.modificaciones || {};
                              handlePerfilSecadoChange(idx, "modificaciones", { ...cur, mod3: e.target.value });
                            }}
                            className="w-full text-center outline-none bg-transparent text-[9px]"
                          />
                        </td>
                        {recetaLayoutMode === "lateral_derecha" && (
                          <>
                            {/* RECETA: TIEMPO (MINUTOS) */}
                            <td className="border-l-2 border-emerald-700 border-r border-emerald-800/30 py-0 px-0.5 bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                max="180"
                                value={recetaSecado[idx]?.tiempo !== undefined && recetaSecado[idx]?.tiempo > 0 ? recetaSecado[idx]?.tiempo : ""}
                                placeholder="-"
                                onChange={(e) => handleRecetaItemChange(idx, "tiempo", parseInt(e.target.value) || 0)}
                                className="w-full text-center font-bold text-slate-800 outline-none bg-transparent hover:bg-amber-100/60 focus:bg-white text-[8px]"
                                title={`Tiempo programado receta para ${perfil.perfilIndex}`}
                              />
                            </td>
                            {/* RECETA: TEMPERATURA DE AIRE */}
                            <td className="border-r border-emerald-800/30 py-0 px-0.5 bg-rose-50/40 font-black text-rose-900">
                              <div className="flex items-center justify-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="20"
                                  max="90"
                                  value={recetaSecado[idx]?.temp !== undefined && recetaSecado[idx]?.temp > 0 ? recetaSecado[idx]?.temp : ""}
                                  placeholder="-"
                                  onChange={(e) => handleRecetaItemChange(idx, "temp", parseFloat(e.target.value) || 0)}
                                  className="w-5 text-center font-black text-rose-800 outline-none bg-transparent hover:bg-rose-100/60 focus:bg-white text-[8px]"
                                  title={`T° Aire recomendada para ${perfil.perfilIndex}`}
                                />
                                <span className="text-[6.5px] text-rose-500 font-bold">°</span>
                              </div>
                            </td>
                            {/* RECETA: META TÉRMICA DE GRANO O REAL */}
                            <td className={`py-0 px-0.5 text-center ${
                              perfil.tempGrano !== undefined && perfil.tempGrano > 0
                                ? perfil.tempGrano >= 30.0 && perfil.tempGrano <= 32.0
                                  ? "bg-emerald-50 text-emerald-800 font-black"
                                  : perfil.tempGrano > 32.0
                                  ? "bg-rose-50 text-rose-800 font-black"
                                  : "bg-amber-50 text-amber-800 font-black"
                                : "bg-emerald-50/60 text-slate-500"
                            }`}>
                              {perfil.tempGrano !== undefined && perfil.tempGrano > 0 ? (
                                <span className="font-mono text-[7px]" title={`Grano real: ${perfil.tempGrano.toFixed(1)}°C (Meta: 31°C)`}>
                                  {perfil.tempGrano.toFixed(0)}°
                                </span>
                              ) : (
                                <span className="text-[6.5px] text-emerald-700 font-mono font-bold" title="Meta estándar de proceso: 31°C">
                                  31°
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {/* PIE DE TABLA CON TOTALES Y PROMEDIOS */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t border-slate-300 font-bold text-[8.5px] text-slate-700 text-center">
                      <td colSpan={8} className="py-1 px-2 text-left text-slate-500 font-normal italic">
                        Control de Secado P0–P12 con Meta Térmica de Grano a 31°C
                      </td>
                      <td className="py-1 px-0.5 border-r border-slate-300 font-mono text-slate-900 font-black bg-slate-200/60">
                        {perfilesSecado.reduce((s, p) => s + (Number(p.tiempoMin) || 0), 0)}m
                      </td>
                      <td colSpan={5} className={`${recetaLayoutMode === "lateral_derecha" ? "border-r border-slate-300" : ""} py-1 px-1`}></td>
                      {recetaLayoutMode === "lateral_derecha" && (
                        <>
                          <td className="border-l-2 border-emerald-700 border-r border-emerald-800/30 py-1 px-0.5 bg-emerald-100 font-black text-emerald-950 font-mono text-[8px]">
                            {recetaSecado.reduce((s, r) => s + (r.tiempo || 0), 0)}m
                          </td>
                          <td className="border-r border-emerald-800/30 py-1 px-0.5 bg-rose-100 font-black text-rose-950 font-mono text-[8px]">
                            {recetaSecado.filter(r => r.temp && r.temp > 0).length > 0
                              ? (recetaSecado.reduce((s, r) => s + (r.temp || 0), 0) / recetaSecado.filter(r => r.temp && r.temp > 0).length).toFixed(0)
                              : "62"}°
                          </td>
                          <td className="py-1 px-0.5 bg-emerald-200/70 font-black text-emerald-950 text-[7.5px] font-mono">
                            31°
                          </td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

        {/* MODAL DE HISTORIAL DE RECETAS DE SECADO */}
        {showHistoricoModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 print:hidden animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-4 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Historial de Recetas de Secado Guardadas</h3>
                    <p className="text-xs text-slate-400">
                      Curvas de trabajo exitosas registradas en planta para aprendizaje termodinámico (Meta 31°C ±1°C).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistoricoModal(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 flex-1 text-slate-200">
                {historicoRecetas.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <History className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="font-bold">No hay recetas guardadas aún.</p>
                    <p className="text-xs">Guarda las condiciones de secado actuales para enriquecer el algoritmo de aprendizaje.</p>
                  </div>
                ) : (
                  historicoRecetas.map((hist, idx) => (
                    <div
                      key={hist.id || idx}
                      className="p-3.5 bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 rounded-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-black text-xs">
                            Lote: {hist.loteId} (Batch: {hist.batchId})
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs">
                            {hist.variedad}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                            Grano: {hist.tempGranoPromedio}°C (Meta 31°C)
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(hist.fechaRegistro || hist.fecha || Date.now()).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                          <span>💧 H. Inicial: <strong>{hist.humedadInicial}%</strong></span>
                          <span>🌡️ T° Amb: <strong>{hist.tempAmbientePromedio}°C</strong></span>
                          <span>💨 H.R: <strong>{hist.humedadRelativaPromedio}%</strong></span>
                          {hist.humedadFinal && <span>🏁 H. Final: <strong>{hist.humedadFinal}%</strong></span>}
                        </div>

                        {hist.observaciones && (
                          <p className="text-[11px] text-slate-400 italic">{hist.observaciones}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => handleCargarRecetaHistorica(hist)}
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Cargar Esta Receta</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3.5 bg-slate-850 border-t border-slate-700 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHistoricoModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. FOOTER NOTES & SIGNATURES */}
        <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <span className="font-bold block text-slate-800">OBSERVACIONES DE CONTROL:</span>
            <input
              type="text"
              value={formData.OBSERVACIONES ?? ""}
              placeholder="Registrar notas del turno o novedades de proceso..."
              onChange={(e) => setFormData((p) => ({ ...p, OBSERVACIONES: e.target.value }))}
              className="w-full text-[11px] text-slate-700 italic border-b border-slate-300 outline-none mt-1 py-0.5 focus:border-emerald-600"
            />
          </div>
          <div className="text-center pt-6 border-t border-slate-400">
            <span className="font-bold text-slate-800 block">{formData.OPERADOR || "OPERARIO DE TURNO"}</span>
            <span className="text-[10px] text-slate-500">FIRMA DEL OPERARIO DE TURNO</span>
          </div>
          <div className="text-center pt-6 border-t border-slate-400">
            <span className="font-bold text-slate-800 block">{formData.SUPERVISOR || "JEFE DE PLANTA"}</span>
            <span className="text-[10px] text-slate-500">SUPERVISOR / JEFE DE PLANTA</span>
          </div>
        </div>
      </div>

      {/* OCR Scanner Modal for Photos */}
      <PlantSheetOCRModal
        isOpen={isOCRModalOpen}
        onClose={() => setIsOCRModalOpen(false)}
        initialSeccion={currentOCRSeccion}
        onApplyOCRData={handleApplyOCRData}
      />

      {/* Confirmation Modal for Resetting / Clearing Batch Data */}
      {showResetConfirmModal && (
        <div id="modal-confirmar-reset-batch" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-950/80 border border-rose-500/30 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">¿Limpiar y Resetear Ficha?</h3>
                <p className="text-xs text-slate-400">Batch {batchCorrelativo || batchId || "V200"}</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
              <p className="font-semibold text-slate-200">Esta acción realizará lo siguiente:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>Eliminará del servidor y borrador local los registros de tiempos, presiones, temperaturas y silos.</li>
                <li>Restablecerá automáticamente los <strong>Datos de Ingreso</strong> y <strong>Parámetros del Paddy</strong> con los promedios del Batch.</li>
                <li>Dejará todos los campos operativos en blanco listos para nuevo registro o escaneo fotográfico (OCR).</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="btn-cancelar-reset-batch"
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-reset-batch"
                type="button"
                onClick={() => {
                  setShowResetConfirmModal(false);
                  if (onResetBatchData) {
                    onResetBatchData();
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-950 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Limpiar y Resetear</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};
