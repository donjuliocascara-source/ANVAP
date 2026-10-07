import React, { useState, useMemo, useEffect } from "react";
import { 
  AnalisisVaporizado, 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  ControlVaporizado,
  Presecado,
  AnalisisHumedo,
  AnalisisSeco,
  UserProfile, 
  UserRole,
  ResultadoCoccionExterno,
  BatchEvaluacionComparativa
} from "../types";
import { 
  Microscope, 
  Plus, 
  Camera, 
  Save, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  Scale,
  RotateCcw,
  Flame,
  Award,
  BarChart2,
  TrendingUp,
  Sliders,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Droplets,
  Search,
  Lock,
  ArrowRight,
  ArrowRightLeft,
  ExternalLink,
  Edit3,
  Check,
  Zap,
  Info,
  FileText,
  Printer,
  BookOpen,
  Building2,
  Package
} from "lucide-react";
import { tienePermiso, obtenerMensajeRestriccion } from "../utils/permisosService";
import { 
  obtenerResultadosCoccionLocales, 
  buscarCoccionParaBatch, 
  guardarCoccionParaBatch 
} from "../utils/integracionCoccionService";
import { calcularEvaluacionBatch, evaluarYRankearBatches } from "../utils/evaluacionProcesosService";
import { IntegracionCoccionModal } from "./IntegracionCoccionModal";
import { BoletaMolinoDonJulioModal } from "./BoletaMolinoDonJulioModal";
import { FichaControlBatchModal } from "./FichaControlBatchModal";
import { OrganolepticoInput } from "./OrganolepticoInput";
import { ResumenSinteticoCoccionCard } from "./ResumenSinteticoCoccionCard";
import { parseOrganoleptico } from "../utils/evaluacionCalidad";
import { safeNumVal, parseOptionalNumber, parseNumberOrZero, safeNumber } from "../utils/numberUtils";

interface AnalisisVaporizadoViewProps {
  analisisVapList?: AnalisisVaporizado[];
  batches?: BatchVaporizado[];
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  controles?: ControlVaporizado[];
  presecados?: Presecado[];
  analisisHumList?: AnalisisHumedo[];
  analisisSecList?: AnalisisSeco[];
  initialBatchId?: string;
  initialSubTab?: "calidad_salida" | "coccion_batch" | "benchmarking_batch";
  currentUser?: UserProfile;
  onSaveAnalisisVap: (rec: Partial<AnalisisVaporizado>) => Promise<void>;
  onOpenOCR?: () => void;
  onNavigate?: (tab: string, filterId?: string) => void;
  onRefreshData?: () => void;
}

const getInitialVapState = (batchId: string = "", loteId: string = "", extraData?: Partial<AnalisisVaporizado>): Partial<AnalisisVaporizado> => ({
  ANALISIS_VAPORIZADO_ID: "",
  BATCH_ID: batchId,
  LOTE_ID: loteId,
  FECHA_ANALISIS: new Date().toISOString().split("T")[0],
  MUESTRA_NRO: 1,
  HUMEDAD: undefined,
  RI: undefined,
  RB: undefined,
  RM: undefined,
  QI: undefined,
  QB: undefined,
  TT: undefined,
  G_COCIDO: undefined, // G. Cocido evaluado exclusivamente en salida de vaporizado después de Tiza Total
  TP: undefined,
  M: undefined,
  TZ: undefined,
  GR: undefined,
  GI: undefined,
  BLI: undefined,
  BL: undefined,
  QUEBRADO: undefined,
  TRIZADO: undefined,
  TIZA: undefined,
  MANCHADO: undefined,
  OBSERVACIONES: "",
  NUM_BOLETA: "",
  CLIENTE: extraData?.CLIENTE || "",
  CODIGO_MUESTRA: extraData?.CODIGO_MUESTRA || "",
  TOTAL_SACOS: extraData?.TOTAL_SACOS || undefined,
  PROCEDENCIA: extraData?.PROCEDENCIA || "",
  VARIEDAD: extraData?.VARIEDAD || "",
  HUMEDADES_TOMAS: [],
  DESV_HUMEDAD: undefined,
  IMPUREZAS: undefined,
  R_POLVILLO: undefined,
  ENTERO: undefined,
  M_VARIETAL: undefined,
  TIZA_PUNTUAL: undefined,
  G_VERDE: undefined,
  B_PULIDO: undefined,
  PALOTE: "",
  VANO: "" as any,
  OLOR: "",
  "F. CARBON": "" as any,
  HONGO: "" as any,
  ORGANOLEPTICOS: {
    palote: "",
    vano: "",
    impureza: "",
    olor: "",
    falsoCarbon: "",
    hongo: "",
    manchado: "",
    cascado: "",
    plagasInsectos: "",
    otros: ""
  },
  RESPONSABLE_ANALISIS: "Analista de Control de Calidad",
  VB_JEFE_AREA: "Ing. Jefe de Planta y Calidad"
});

export const AnalisisVaporizadoView: React.FC<AnalisisVaporizadoViewProps> = ({
  analisisVapList = [],
  batches = [],
  batchLotes = [],
  lotes = [],
  controles = [],
  presecados = [],
  analisisHumList = [],
  analisisSecList = [],
  initialBatchId,
  initialSubTab,
  currentUser,
  onSaveAnalisisVap,
  onOpenOCR,
  onNavigate,
  onRefreshData
}) => {
  // Permisos de usuario
  const userRole = (currentUser?.rol || "OPERARIO") as UserRole;
  const canEditCalidad = tienePermiso(userRole, "registrar_analisis_calidad");
  const canUseOCR = tienePermiso(userRole, "usar_ocr_documentos");

  // Selected Batch
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => {
    if (initialBatchId && batches.some(b => b.BATCH_ID === initialBatchId || b.CORRELATIVO === initialBatchId)) {
      return initialBatchId;
    }
    return batches[0]?.BATCH_ID || "";
  });

  // Batch search / filter
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>("");
  // Modo de filtrado para carga de datos de calidad y cocción
  const [calidadFilterMode, setCalidadFilterMode] = useState<"PENDIENTES" | "SIN_ANALISIS" | "SIN_COCCION" | "SIN_AMBOS" | "COMPLETOS" | "TODOS">("PENDIENTES");
  const [mostrarBandejaPendientes, setMostrarBandejaPendientes] = useState<boolean>(true);

  // Sub-tabs dentro de la vista de Calidad del Batch
  const [activeSubTab, setActiveSubTab] = useState<"calidad_salida" | "coccion_batch" | "benchmarking_batch">(() => {
    return initialSubTab || "calidad_salida";
  });

  // Si cambia el initialBatchId o initialSubTab desde navegación externa
  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
      setCalidadFilterMode("TODOS");
    }
  }, [initialBatchId]);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Resultados de Cocción del Batch y clave de actualización
  const [coccionUpdateKey, setCoccionUpdateKey] = useState<number>(0);
  const [isCoccionModalOpen, setIsCoccionModalOpen] = useState(false);
  const [isEditingCoccionForm, setIsEditingCoccionForm] = useState(false);
  const [isSavingCoccion, setIsSavingCoccion] = useState(false);
  const [coccionSaveSuccess, setCoccionSaveSuccess] = useState(false);

  // Mapeo detallado del estado de calidad y cocción de cada Batch
  const batchQualityStatusList = useMemo(() => {
    const locales = obtenerResultadosCoccionLocales();
    return batches.map((b) => {
      const bId = b.BATCH_ID;
      const corr = b.CORRELATIVO || b.BATCH_ID;
      
      // Muestras de calidad física de salida
      const samples = analisisVapList.filter(
        a => a.BATCH_ID === bId || a.BATCH_ID === corr
      );
      const hasAnalisis = samples.length > 0;

      // Lotes asociados
      const bLotes = batchLotes.filter(bl => bl.BATCH_ID === bId).map(bl => bl.LOTE_ID);
      const coccion = buscarCoccionParaBatch(bId, corr, bLotes, locales);
      const hasCoccion = Boolean(coccion);

      const isPendingAnalisis = !hasAnalisis;
      const isPendingCoccion = !hasCoccion;
      const isPendingBoth = isPendingAnalisis && isPendingCoccion;
      const isPendingAny = isPendingAnalisis || isPendingCoccion;
      const isComplete = hasAnalisis && hasCoccion;

      return {
        batch: b,
        batchId: bId,
        correlativo: corr,
        variedad: b.VARIEDAD || "Arroz General",
        cliente: b.CLIENTE || "",
        equipo: b.EQUIPO || "Autoclave",
        totalSacos: b.TOTAL_SACOS || 0,
        totalPesoKg: b.TOTAL_PESO_KG || 0,
        estadoBatch: b.ESTADO_BATCH || "REGISTRADO",
        samplesCount: samples.length,
        hasAnalisis,
        hasCoccion,
        coccion,
        coccionScore: coccion?.puntajeCoccion,
        isPendingAnalisis,
        isPendingCoccion,
        isPendingBoth,
        isPendingAny,
        isComplete
      };
    });
  }, [batches, analisisVapList, batchLotes, coccionUpdateKey]);

  // Contadores para métricas y filtros
  const filterCounts = useMemo(() => {
    let pendientes = 0;
    let sinAnalisis = 0;
    let sinCoccion = 0;
    let sinAmbos = 0;
    let completos = 0;

    batchQualityStatusList.forEach((item) => {
      if (item.isPendingAny) pendientes++;
      if (item.isPendingAnalisis) sinAnalisis++;
      if (item.isPendingCoccion) sinCoccion++;
      if (item.isPendingBoth) sinAmbos++;
      if (item.isComplete) completos++;
    });

    return {
      pendientes,
      sinAnalisis,
      sinCoccion,
      sinAmbos,
      completos,
      total: batchQualityStatusList.length
    };
  }, [batchQualityStatusList]);

  // Batches filtrados según el modo de completitud y búsqueda
  const filteredBatches = useMemo(() => {
    let list = batchQualityStatusList;

    switch (calidadFilterMode) {
      case "PENDIENTES":
        list = list.filter(item => item.isPendingAny);
        break;
      case "SIN_ANALISIS":
        list = list.filter(item => item.isPendingAnalisis);
        break;
      case "SIN_COCCION":
        list = list.filter(item => item.isPendingCoccion);
        break;
      case "SIN_AMBOS":
        list = list.filter(item => item.isPendingBoth);
        break;
      case "COMPLETOS":
        list = list.filter(item => item.isComplete);
        break;
      case "TODOS":
      default:
        // Todos los batches
        break;
    }

    if (batchSearchQuery.trim()) {
      const q = batchSearchQuery.toLowerCase();
      list = list.filter(item =>
        item.correlativo.toLowerCase().includes(q) ||
        item.batchId.toLowerCase().includes(q) ||
        item.variedad.toLowerCase().includes(q) ||
        item.cliente.toLowerCase().includes(q) ||
        item.equipo.toLowerCase().includes(q)
      );
    }

    return list.map(item => item.batch);
  }, [batchQualityStatusList, calidadFilterMode, batchSearchQuery]);

  // Mantener sincronizado el selectedBatchId con la lista filtrada
  useEffect(() => {
    if (filteredBatches.length > 0) {
      const exists = filteredBatches.some(b => b.BATCH_ID === selectedBatchId || b.CORRELATIVO === selectedBatchId);
      if (!exists) {
        setSelectedBatchId(filteredBatches[0].BATCH_ID);
      }
    }
  }, [filteredBatches, selectedBatchId]);

  // Batch actual seleccionado
  const currentBatch = useMemo(() => {
    return batches.find(b => b.BATCH_ID === selectedBatchId || b.CORRELATIVO === selectedBatchId) || filteredBatches[0] || batches[0];
  }, [batches, filteredBatches, selectedBatchId]);

  // Estado de calidad detallado del batch actual
  const currentBatchStatus = useMemo(() => {
    if (!currentBatch) return null;
    return batchQualityStatusList.find(item => item.batchId === currentBatch.BATCH_ID);
  }, [batchQualityStatusList, currentBatch]);

  // Lotes asociados al batch actual
  const currentBatchLotes = useMemo(() => {
    if (!currentBatch) return [];
    const bls = batchLotes.filter(bl => bl.BATCH_ID === currentBatch.BATCH_ID);
    const loteIds = bls.map(bl => bl.LOTE_ID);
    return lotes.filter(l => loteIds.includes(l.LOTE_ID));
  }, [currentBatch, batchLotes, lotes]);

  const defaultLoteId = currentBatchLotes[0]?.LOTE_ID || lotes[0]?.LOTE_ID || "";
  const [selectedLoteId, setSelectedLoteId] = useState<string>(defaultLoteId);

  useEffect(() => {
    if (currentBatchLotes.length > 0) {
      setSelectedLoteId(currentBatchLotes[0].LOTE_ID);
    }
  }, [currentBatchLotes]);

  // Muestras de calidad del batch seleccionado
  const currentBatchAnalisis = useMemo(() => {
    if (!currentBatch) return [];
    return analisisVapList.filter(a => a.BATCH_ID === currentBatch.BATCH_ID || a.BATCH_ID === currentBatch.CORRELATIVO);
  }, [analisisVapList, currentBatch]);

  // Número sugerido de muestra
  const [muestraNro, setMuestraNro] = useState<number>(() => {
    return (currentBatchAnalisis.length || 0) + 1;
  });

  useEffect(() => {
    setMuestraNro((currentBatchAnalisis.length || 0) + 1);
  }, [currentBatchAnalisis]);

  // Form State para Muestra de Calidad
  const [formData, setFormData] = useState<Partial<AnalisisVaporizado>>(
    getInitialVapState(currentBatch?.BATCH_ID || "", defaultLoteId, {
      CLIENTE: currentBatch?.CLIENTE,
      VARIEDAD: currentBatch?.VARIEDAD,
      TOTAL_SACOS: currentBatch?.TOTAL_SACOS,
      CODIGO_MUESTRA: currentBatch?.CORRELATIVO || currentBatch?.BATCH_ID
    })
  );

  // Estados para modales de visualización de formatos oficiales de planta
  const [selectedAnalisisForBoleta, setSelectedAnalisisForBoleta] = useState<AnalisisVaporizado | null>(null);
  const [showFichaControlModal, setShowFichaControlModal] = useState<boolean>(false);
  const [formModeCalidad, setFormModeCalidad] = useState<"BOLETA_DON_JULIO" | "ESTANDAR">("BOLETA_DON_JULIO");

  // Helper para actualizar toma individual de humedad H1..H18
  const handleActualizarTomaHumedad = (idx: number, valor: number) => {
    const currentTomas = [...(formData.HUMEDADES_TOMAS || Array(18).fill(12.5))];
    currentTomas[idx] = valor;
    const validNumbers = currentTomas.filter(n => typeof n === "number" && !isNaN(n));
    const avg = Number((validNumbers.reduce((a, b) => a + b, 0) / (validNumbers.length || 1)).toFixed(2));
    const variance = validNumbers.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (validNumbers.length || 1);
    const desv = Number(Math.sqrt(variance).toFixed(2));
    
    setFormData(prev => ({
      ...prev,
      HUMEDADES_TOMAS: currentTomas,
      HUMEDAD: avg,
      DESV_HUMEDAD: desv
    }));
  };

  // Helper para autocompletar 18 tomas con ligera variación natural
  const handleAutollenarTomasHumedad = (base: number = 12.5) => {
    const variations = [0, 0.2, -0.1, 0.3, -0.2, 0, 0.1, -0.3, 0.4, -0.1, 0, 0.2, -0.2, 0.1, 0.3, -0.4, 0.2, -0.1];
    const tomas = variations.map(v => Number((base + v).toFixed(1)));
    const avg = Number((tomas.reduce((a, b) => a + b, 0) / tomas.length).toFixed(2));
    const variance = tomas.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / tomas.length;
    const desv = Number(Math.sqrt(variance).toFixed(2));
    setFormData(prev => ({
      ...prev,
      HUMEDADES_TOMAS: tomas,
      HUMEDAD: avg,
      DESV_HUMEDAD: desv
    }));
  };

  // Helper para calcular Grano Entero automático = RB - QB
  const handleAutoCalcularEntero = () => {
    const rb = safeNumber(formData.RB, 58.2);
    const qb = safeNumber(formData.QB, 22.4);
    const entero = Math.max(0, Number((rb - qb).toFixed(1)));
    setFormData(prev => ({ ...prev, ENTERO: entero }));
  };

  // Helper para calcular Remoción automática = RI - RB
  const handleAutoCalcularRemocion = () => {
    const ri = safeNumber(formData.RI, 68.5);
    const rb = safeNumber(formData.RB, 58.2);
    const rem = Math.max(0, Number((ri - rb).toFixed(1)));
    setFormData(prev => ({ ...prev, RM: rem, R_POLVILLO: rem }));
  };

  // Lote y Análisis de Ingreso vinculados
  const matchingLote = useMemo(() => {
    return lotes.find(l => l.LOTE_ID === (selectedLoteId || formData.LOTE_ID));
  }, [lotes, selectedLoteId, formData.LOTE_ID]);

  const matchingAnalisisIngreso = useMemo(() => {
    const targetLoteId = selectedLoteId || formData.LOTE_ID;
    return analisisHumList.find(a => a.LOTE_ID === targetLoteId) || null;
  }, [analisisHumList, selectedLoteId, formData.LOTE_ID]);

  // Helper para importar datos del análisis de ingreso (misma estructura física, manteniendo la humedad de salida)
  const handleCopiarDatosIngreso = () => {
    if (!matchingAnalisisIngreso) return;
    const ing = matchingAnalisisIngreso;
    setFormData(prev => ({
      ...prev,
      RI: ing.RI ?? prev.RI,
      RB: ing.RB ?? prev.RB,
      RM: ing.RM ?? (ing.RI && ing.RB ? Number((ing.RI - ing.RB).toFixed(1)) : prev.RM),
      R_POLVILLO: ing.RM ?? (ing.RI && ing.RB ? Number((ing.RI - ing.RB).toFixed(1)) : prev.R_POLVILLO),
      QI: ing.QI ?? prev.QI,
      QUEBRADO: ing.QI ?? prev.QUEBRADO,
      QB: ing.QB ?? prev.QB,
      ENTERO: ing.ENTERO ?? (ing.RB && ing.QB ? Number((ing.RB - ing.QB).toFixed(1)) : prev.ENTERO),
      TT: ing.TT ?? prev.TT,
      TIZA: ing.TT ?? prev.TIZA,
      TP: ing.TP ?? prev.TP,
      TIZA_PUNTUAL: (ing as any)["T. PUNT."] ?? prev.TIZA_PUNTUAL,
      M: ing.M ?? ing.MANCHADO ?? prev.M,
      MANCHADO: ing.MANCHADO ?? ing.M ?? prev.MANCHADO,
      TZ: ing.TZ ?? prev.TZ,
      TRIZADO: ing.TZ ?? prev.TRIZADO,
      GR: ing.GR ?? prev.GR,
      GI: ing.GI ?? prev.GI,
      G_VERDE: (ing as any).GV ?? ing.G_VERDE ?? prev.G_VERDE,
      BLI: (ing as any)["B.INTEGRAL"] ?? prev.BLI,
      BL: (ing as any)["B. PULIDO"] ?? prev.BL,
      B_PULIDO: (ing as any)["B. PULIDO"] ?? prev.B_PULIDO,
      M_VARIETAL: (ing as any)["MEZCLA VAR."] ?? prev.M_VARIETAL,
      IMPUREZAS: typeof ing.IMPUREZS === "number" ? ing.IMPUREZS : (parseFloat(String(ing.IMPUREZS)) || prev.IMPUREZAS),
      PALOTE: ing.PALOTE !== undefined ? parseOrganoleptico(ing.PALOTE).code : prev.PALOTE,
      VANO: ing.VANO !== undefined ? parseOrganoleptico(ing.VANO).code as any : prev.VANO,
      OLOR: ing.OLOR !== undefined ? parseOrganoleptico(ing.OLOR).code : prev.OLOR,
      "F. CARBON": ing["F. CARBON"] !== undefined ? parseOrganoleptico(ing["F. CARBON"]).code as any : (prev as any)["F. CARBON"],
      HONGO: ing.HONGO !== undefined ? parseOrganoleptico(ing.HONGO).code as any : prev.HONGO,
      ORGANOLEPTICOS: {
        palote: ing.PALOTE !== undefined ? parseOrganoleptico(ing.PALOTE).code : (prev.ORGANOLEPTICOS?.palote || "P"),
        vano: ing.VANO !== undefined ? parseOrganoleptico(ing.VANO).code : (prev.ORGANOLEPTICOS?.vano || "P"),
        impureza: ing.IMPUREZS !== undefined ? parseOrganoleptico(ing.IMPUREZS).code : (prev.ORGANOLEPTICOS?.impureza || "P"),
        olor: ing.OLOR !== undefined ? parseOrganoleptico(ing.OLOR).code : (prev.ORGANOLEPTICOS?.olor || "P"),
        falsoCarbon: ing["F. CARBON"] !== undefined ? parseOrganoleptico(ing["F. CARBON"]).code : (prev.ORGANOLEPTICOS?.falsoCarbon || "P"),
        hongo: ing.HONGO !== undefined ? parseOrganoleptico(ing.HONGO).code : (prev.ORGANOLEPTICOS?.hongo || "P"),
        manchado: ing.MANCHADO || ing.M ? "P" : (prev.ORGANOLEPTICOS?.manchado || "P"),
        cascado: ing.CASCADO ? "P" : (prev.ORGANOLEPTICOS?.cascado || "P"),
        plagasInsectos: ing["PLAGAS-NSEC."] ? "Gorgojos" : (prev.ORGANOLEPTICOS?.plagasInsectos || "P"),
        otros: ing.OTROS ? String(ing.OTROS) : (prev.ORGANOLEPTICOS?.otros || "-")
      }
      // NOTA CLAVE: La HUMEDAD no se sobreescribe ya que en Calidad se evalúa la Humedad de Salida de Vaporizado (Secado)
    }));
  };

  // Deltas de mejora entre Ingreso Materia Prima y Salida de Calidad
  const deltaCalc = useMemo(() => {
    const humSalida = formData.HUMEDAD !== undefined && formData.HUMEDAD !== null ? formData.HUMEDAD : 0;
    const humIng = matchingAnalisisIngreso?.HUMEDADES ?? matchingLote?.HUMEDAD ?? 0;
    const entSalida = formData.ENTERO !== undefined && formData.ENTERO !== null ? formData.ENTERO : 0;
    const entIng = matchingAnalisisIngreso?.ENTERO ?? 0;
    const tzSalida = (formData.TRIZADO ?? formData.TZ) !== undefined && (formData.TRIZADO ?? formData.TZ) !== null ? (formData.TRIZADO ?? formData.TZ)! : 0;
    const tzIng = matchingAnalisisIngreso?.TZ ?? 0;
    const ttSalida = (formData.TT ?? formData.TIZA) !== undefined && (formData.TT ?? formData.TIZA) !== null ? (formData.TT ?? formData.TIZA)! : 0;
    const ttIng = matchingAnalisisIngreso?.TT ?? 0;
    const rbSalida = formData.RB !== undefined && formData.RB !== null ? formData.RB : 0;
    const rbIng = matchingAnalisisIngreso?.RB ?? 0;

    return {
      deltaHum: Number((humSalida - humIng).toFixed(1)),
      deltaEntero: Number((entSalida - entIng).toFixed(1)),
      deltaTrizado: Number((tzSalida - tzIng).toFixed(1)),
      deltaTiza: Number((ttSalida - ttIng).toFixed(1)),
      deltaRB: Number((rbSalida - rbIng).toFixed(1)),
      humIng,
      humSalida,
      entIng,
      entSalida,
      tzIng,
      tzSalida,
      ttIng,
      ttSalida,
      rbIng,
      rbSalida
    };
  }, [formData, matchingAnalisisIngreso, matchingLote]);

  useEffect(() => {
    if (currentBatch) {
      setFormData(prev => ({
        ...prev,
        BATCH_ID: currentBatch.BATCH_ID,
        LOTE_ID: selectedLoteId || defaultLoteId,
        CLIENTE: currentBatch.CLIENTE || prev.CLIENTE || "",
        VARIEDAD: currentBatch.VARIEDAD || prev.VARIEDAD || "",
        TOTAL_SACOS: currentBatch.TOTAL_SACOS || prev.TOTAL_SACOS || undefined,
        CODIGO_MUESTRA: currentBatch.CORRELATIVO || currentBatch.BATCH_ID || ""
      }));
    }
  }, [currentBatch, selectedLoteId, defaultLoteId]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Estadísticas promedio de las muestras de este Batch
  const batchStats = useMemo(() => {
    if (currentBatchAnalisis.length === 0) {
      return {
        count: 0,
        avgHumedad: null,
        avgQI: null,
        avgQB: null,
        avgRI: null,
        avgRB: null,
        avgBL: null,
        avgTT: null,
        avgTZ: null,
        avgManchado: null
      };
    }
    const n = currentBatchAnalisis.length;
    const sumH = currentBatchAnalisis.reduce((acc, a) => acc + (a.HUMEDAD || 0), 0);
    const sumQI = currentBatchAnalisis.reduce((acc, a) => acc + (a.QI || a.QUEBRADO || 0), 0);
    const sumQB = currentBatchAnalisis.reduce((acc, a) => acc + (a.QB || 0), 0);
    const sumRI = currentBatchAnalisis.reduce((acc, a) => acc + (a.RI || 0), 0);
    const sumRB = currentBatchAnalisis.reduce((acc, a) => acc + (a.RB || 0), 0);
    const sumBL = currentBatchAnalisis.reduce((acc, a) => acc + (a.BL || 0), 0);
    const sumTT = currentBatchAnalisis.reduce((acc, a) => acc + (a.TT || a.TIZA || 0), 0);
    const sumTZ = currentBatchAnalisis.reduce((acc, a) => acc + (a.TZ || a.TRIZADO || 0), 0);
    const sumM = currentBatchAnalisis.reduce((acc, a) => acc + (a.M || a.MANCHADO || 0), 0);

    return {
      count: n,
      avgHumedad: Number((sumH / n).toFixed(2)),
      avgQI: Number((sumQI / n).toFixed(2)),
      avgQB: Number((sumQB / n).toFixed(2)),
      avgRI: Number((sumRI / n).toFixed(2)),
      avgRB: Number((sumRB / n).toFixed(2)),
      avgBL: Number((sumBL / n).toFixed(1)),
      avgTT: Number((sumTT / n).toFixed(2)),
      avgTZ: Number((sumTZ / n).toFixed(2)),
      avgManchado: Number((sumM / n).toFixed(2))
    };
  }, [currentBatchAnalisis]);

  const batchLoteIds = useMemo(() => currentBatchLotes.map(l => l.LOTE_ID), [currentBatchLotes]);
  
  const coccionBatch = useMemo(() => {
    if (!currentBatch) return undefined;
    const locales = obtenerResultadosCoccionLocales();
    return buscarCoccionParaBatch(
      currentBatch.BATCH_ID,
      currentBatch.CORRELATIVO || currentBatch.BATCH_ID,
      batchLoteIds,
      locales
    );
  }, [currentBatch, batchLoteIds, coccionUpdateKey]);

  // Estado del formulario de cocción del batch
  const [coccionFormData, setCoccionFormData] = useState<Partial<ResultadoCoccionExterno>>({});

  useEffect(() => {
    if (coccionBatch) {
      setCoccionFormData(coccionBatch);
    } else if (currentBatch) {
      setCoccionFormData({
        batchId: currentBatch.BATCH_ID,
        correlativo: currentBatch.CORRELATIVO || currentBatch.BATCH_ID,
        loteId: batchLoteIds.join(", ") || "",
        variedad: currentBatch.VARIEDAD || "Variedad General",
        cliente: currentBatch.CLIENTE || "",
        fechaCoccion: new Date().toISOString().split("T")[0],
        panelista: currentUser?.nombre || "",
        // Punto 1: Dosificación estándar
        tiempoCoccionMin: 30,
        tazasArroz: 3,
        tazasAgua: "3 1/2",
        ratioAguaArroz: "3 tazas arroz / 3 1/2 tazas agua",
        // A partir del Punto 2: Vacíos para nuevo ingreso
        expansionVolumetrica: "",
        solturaGrano: "",
        texturaFirmeza: "",
        colorCocido: "",
        aromaSabor: "",
        puntajeCoccion: undefined,
        sabor: "",
        desplazamientoSeg: "",
        granoQuebradoOllaPct: undefined,
        granoHinchadoPct: undefined,
        granoAbiertoPct: undefined,
        texturaFrio: "",
        envaseProyectado: "",
        rendimientoMasaPct: undefined,
        observaciones: ""
      });
    }
  }, [coccionBatch, currentBatch, batchLoteIds, currentUser]);

  // Evaluación integral & Benchmarking de este batch
  const evaluacionBatch: BatchEvaluacionComparativa | null = useMemo(() => {
    if (!currentBatch) return null;
    const locales = obtenerResultadosCoccionLocales();
    return calcularEvaluacionBatch(
      currentBatch,
      batchLotes,
      lotes,
      controles,
      analisisVapList,
      presecados,
      analisisHumList,
      analisisSecList,
      locales
    );
  }, [currentBatch, batchLotes, lotes, controles, analisisVapList, presecados, analisisHumList, analisisSecList, coccionUpdateKey]);

  // Ranking general para contextualizar la posición del batch
  const rankingBatches = useMemo(() => {
    const locales = obtenerResultadosCoccionLocales();
    return evaluarYRankearBatches(
      batches,
      batchLotes,
      lotes,
      controles,
      analisisVapList,
      presecados,
      analisisHumList,
      analisisSecList,
      locales
    );
  }, [batches, batchLotes, lotes, controles, analisisVapList, presecados, analisisHumList, analisisSecList, coccionUpdateKey]);

  const batchRankPos = useMemo(() => {
    if (!currentBatch) return null;
    const idx = rankingBatches.findIndex(b => b.batchId === currentBatch.BATCH_ID);
    return idx >= 0 ? idx + 1 : null;
  }, [rankingBatches, currentBatch]);

  // Reset Form
  const handleResetForm = () => {
    if (!currentBatch) return;
    setFormData(getInitialVapState(currentBatch.BATCH_ID, selectedLoteId || defaultLoteId));
  };

  // Submit Muestra de Calidad
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!canEditCalidad) {
      setValidationError(obtenerMensajeRestriccion("registrar_analisis_calidad"));
      return;
    }

    if (!currentBatch) {
      setValidationError("Debe seleccionar un Batch de Vaporizado.");
      return;
    }

    setIsSaving(true);
    try {
      await onSaveAnalisisVap({
        ...formData,
        BATCH_ID: currentBatch.BATCH_ID,
        LOTE_ID: selectedLoteId || defaultLoteId,
        MUESTRA_NRO: muestraNro,
        FECHA_ANALISIS: formData.FECHA_ANALISIS || new Date().toISOString().split("T")[0]
      });
      setSaveSuccess(true);
      if (onRefreshData) onRefreshData();

      // Clean form for next sample
      setFormData(getInitialVapState(currentBatch.BATCH_ID, selectedLoteId || defaultLoteId));
      setMuestraNro((prev) => prev + 1);

      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setValidationError(err.message || "Error al guardar el análisis.");
    } finally {
      setIsSaving(false);
    }
  };

  // Guardar Cocción del Batch
  const handleSaveCoccionBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCalidad) {
      setValidationError(obtenerMensajeRestriccion("registrar_prueba_coccion"));
      return;
    }
    if (!currentBatch) return;

    setIsSavingCoccion(true);
    try {
      await guardarCoccionParaBatch({
        ...coccionFormData,
        batchId: currentBatch.BATCH_ID,
        correlativo: currentBatch.CORRELATIVO || currentBatch.BATCH_ID,
        loteId: batchLoteIds.join(", ") || "",
        variedad: currentBatch.VARIEDAD || "Variedad General",
        cliente: currentBatch.CLIENTE || ""
      });

      setCoccionUpdateKey(prev => prev + 1);
      setCoccionSaveSuccess(true);
      setIsEditingCoccionForm(false);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setCoccionSaveSuccess(false), 3500);
    } catch (err: any) {
      setValidationError(err.message || "Error al guardar los resultados de cocción.");
    } finally {
      setIsSavingCoccion(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner de Módulo */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-inner">
                <Microscope className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Análisis de Calidad, Cocción & Benchmarking por Batch</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Control de Muestras & Cocción
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  Cada Batch vaporizado debe contar con su análisis físico de salida y sus resultados de cocción. Use los filtros para ver solo los que faltan completar.
                </p>
              </div>
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setMostrarBandejaPendientes(!mostrarBandejaPendientes)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                mostrarBandejaPendientes
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Bandeja de Pendientes ({filterCounts.pendientes})</span>
            </button>

            <button
              id="btn-ocr-analisis-vap"
              onClick={canUseOCR ? onOpenOCR : () => setValidationError(obtenerMensajeRestriccion("usar_ocr_documentos"))}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                canUseOCR
                  ? "bg-slate-850 hover:bg-slate-800 text-emerald-300 border-emerald-500/30 shadow-sm"
                  : "bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed opacity-60"
              }`}
              title={canUseOCR ? "Digitalizar libreta/hoja con IA OCR" : "Función restringida para este rol"}
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Escanear Hoja con OCR</span>
              {!canUseOCR && <Lock className="w-3 h-3 text-slate-500" />}
            </button>

            <button
              onClick={() => setIsCoccionModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/40 hover:to-orange-600/40 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Sincronizar Cocción Externa</span>
            </button>

            {onNavigate && currentBatch && (
              <button
                onClick={() => onNavigate("comparador", currentBatch.BATCH_ID)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>Ver en Benchmarking</span>
              </button>
            )}
          </div>
        </div>

        {/* Notificación de validación */}
        {validationError && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button onClick={() => setValidationError(null)} className="text-slate-400 hover:text-white text-xs font-bold">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* BANDEJA INTERACTIVA DE BATCHES PENDIENTES DE DATOS */}
      {mostrarBandejaPendientes && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Bandeja de Batches en Espera de Carga de Datos</span>
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {filterCounts.pendientes} pendientes
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Haga clic en cualquier batch pendiente para cargarlo directamente en el formulario correspondiente.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-slate-400">Filtro rápido:</span>
              <button
                onClick={() => setCalidadFilterMode("PENDIENTES")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  calidadFilterMode === "PENDIENTES"
                    ? "bg-amber-500 text-slate-950 font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Todos Pendientes ({filterCounts.pendientes})
              </button>
              <button
                onClick={() => setCalidadFilterMode("SIN_ANALISIS")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  calidadFilterMode === "SIN_ANALISIS"
                    ? "bg-purple-600 text-white font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Sin Análisis ({filterCounts.sinAnalisis})
              </button>
              <button
                onClick={() => setCalidadFilterMode("SIN_COCCION")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  calidadFilterMode === "SIN_COCCION"
                    ? "bg-orange-600 text-white font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Sin Cocción ({filterCounts.sinCoccion})
              </button>
            </div>
          </div>

          {filterCounts.pendientes === 0 ? (
            <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-emerald-500/30 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-black text-emerald-300">¡Todos los Batches Tienen sus Datos Completos!</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No hay batches pendientes de análisis físico ni cocción. Puede cambiar el filtro a "Todos los Batches" para consultar o registrar muestras adicionales.
              </p>
              <button
                onClick={() => setCalidadFilterMode("TODOS")}
                className="mt-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
              >
                Ver Todos los Batches ({filterCounts.total})
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {batchQualityStatusList
                .filter(item => item.isPendingAny)
                .map((item) => {
                  const isSelected = item.batchId === currentBatch?.BATCH_ID;
                  return (
                    <div
                      key={item.batchId}
                      onClick={() => {
                        setSelectedBatchId(item.batchId);
                        if (item.isPendingAnalisis && !item.isPendingCoccion) {
                          setActiveSubTab("calidad_salida");
                        } else if (item.isPendingCoccion && !item.isPendingAnalisis) {
                          setActiveSubTab("coccion_batch");
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-2 ${
                        isSelected
                          ? "bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30 shadow-md"
                          : "bg-slate-950/50 hover:bg-slate-800/80 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-white">
                          {item.correlativo || item.batchId}
                        </span>
                        <span className="text-[10px] text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                          {item.equipo}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 truncate">
                        {item.variedad} {item.cliente ? `• ${item.cliente}` : ""}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                        {item.isPendingAnalisis ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBatchId(item.batchId);
                              setActiveSubTab("calidad_salida");
                            }}
                            className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Falta Análisis (0)</span>
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            ✓ {item.samplesCount} Muestra(s)
                          </span>
                        )}

                        {item.isPendingCoccion ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBatchId(item.batchId);
                              setActiveSubTab("coccion_batch");
                            }}
                            className="px-2 py-0.5 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Falta Cocción</span>
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            ✓ Cocción ({item.coccionScore ?? 95} pts)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* SELECTOR Y FILTRADO AVANZADO DEL BATCH ENLAZADO */}
      <div className="bg-slate-850 rounded-2xl border border-slate-750 p-5 shadow-lg space-y-4">
        {/* Barra de Filtros de Estado */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              Filtrar Lista de Batches:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                id="btn-filter-solo-pendientes"
                onClick={() => setCalidadFilterMode("PENDIENTES")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  calidadFilterMode === "PENDIENTES"
                    ? "bg-amber-500 text-slate-950 shadow-md font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Solo Pendientes de Datos ({filterCounts.pendientes})</span>
              </button>

              <button
                onClick={() => setCalidadFilterMode("SIN_ANALISIS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  calidadFilterMode === "SIN_ANALISIS"
                    ? "bg-purple-600 text-white shadow-md font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <Microscope className="w-3.5 h-3.5" />
                <span>Sin Análisis Salida ({filterCounts.sinAnalisis})</span>
              </button>

              <button
                onClick={() => setCalidadFilterMode("SIN_COCCION")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  calidadFilterMode === "SIN_COCCION"
                    ? "bg-orange-600 text-white shadow-md font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Sin Cocción ({filterCounts.sinCoccion})</span>
              </button>

              <button
                onClick={() => setCalidadFilterMode("COMPLETOS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  calidadFilterMode === "COMPLETOS"
                    ? "bg-emerald-600 text-white shadow-md font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completos ({filterCounts.completos})</span>
              </button>

              <button
                onClick={() => setCalidadFilterMode("TODOS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  calidadFilterMode === "TODOS"
                    ? "bg-slate-700 text-white font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <span>Todos ({filterCounts.total})</span>
              </button>
            </div>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar batch, variedad, autoclave..."
              value={batchSearchQuery}
              onChange={(e) => setBatchSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Fila del Selector Principal del Batch */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-750 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Batch Seleccionado:</span>
                {currentBatchStatus?.isPendingAny ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Pendiente de Datos
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Calidad & Cocción Completas
                  </span>
                )}
              </div>
              <h2 className="text-base font-black text-white">
                {currentBatch?.CORRELATIVO ? `${currentBatch.CORRELATIVO} - ` : ""}{currentBatch?.BATCH_ID || "Sin selección"}
              </h2>
            </div>
          </div>

          {/* Selector de Batches */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[280px] sm:min-w-[380px]">
              <select
                id="select-batch-calidad-enlace"
                aria-label="Seleccionar Batch de Vaporizado para Análisis de Calidad y Cocción"
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setValidationError(null);
                }}
                className="w-full bg-slate-900 border-2 border-purple-500/50 hover:border-purple-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-black shadow-inner focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer"
              >
                {filteredBatches.map((b) => {
                  const status = batchQualityStatusList.find(s => s.batchId === b.BATCH_ID);
                  let tag = "[✅ OK]";
                  if (status?.isPendingBoth) {
                    tag = "[⚠️ FALTA ANÁLISIS & COCCIÓN]";
                  } else if (status?.isPendingAnalisis) {
                    tag = "[⚠️ FALTA ANÁLISIS]";
                  } else if (status?.isPendingCoccion) {
                    tag = "[⚠️ FALTA COCCIÓN]";
                  }

                  return (
                    <option key={b.BATCH_ID} value={b.BATCH_ID}>
                      {tag} {b.CORRELATIVO ? `${b.CORRELATIVO} ` : ""}({b.BATCH_ID}) • {b.VARIEDAD || "Arroz"} • {b.EQUIPO || "Autoclave"}
                    </option>
                  );
                })}
              </select>
            </div>

            {onNavigate && currentBatch && (
              <button
                onClick={() => onNavigate("batch-vaporizado", currentBatch.BATCH_ID)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                title="Ver Ficha Operativa del Batch"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Ficha Batch</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumen de Estado del Batch Seleccionado */}
        {currentBatch && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Autoclave</span>
                <span className="text-xs font-black text-amber-300 flex items-center gap-1 mt-0.5">
                  <Flame className="w-3.5 h-3.5" />
                  {currentBatch.EQUIPO || "Sin autoclave"}
                </span>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Variedad</span>
                <span className="text-xs font-black text-white mt-0.5 block truncate" title={currentBatch.VARIEDAD}>
                  {currentBatch.VARIEDAD || "General"}
                </span>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cliente / Molino</span>
                <span className="text-xs font-black text-cyan-300 mt-0.5 block truncate" title={currentBatch.CLIENTE}>
                  {currentBatch.CLIENTE || "Cliente no especificado"}
                </span>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carga Total</span>
                <span className="text-xs font-black text-emerald-400 mt-0.5 block">
                  {currentBatch.TOTAL_SACOS ? `${currentBatch.TOTAL_SACOS} sacos` : ""}{" "}
                  {currentBatch.TOTAL_PESO_KG ? `(${(currentBatch.TOTAL_PESO_KG / 1000).toFixed(1)} Tn)` : ""}
                </span>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Análisis Salida</span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                  currentBatchStatus?.hasAnalisis
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                }`}>
                  {currentBatchStatus?.hasAnalisis ? `✓ ${currentBatchAnalisis.length} Muestras` : "⚠️ Faltan Datos"}
                </span>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prueba Cocción</span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                  currentBatchStatus?.hasCoccion
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                }`}>
                  {currentBatchStatus?.hasCoccion ? `★ ${currentBatchStatus.coccionScore ?? 95} pts` : "⚠️ Faltan Datos"}
                </span>
              </div>
            </div>

            {/* Aviso Informativo del Estado del Batch Seleccionado */}
            {currentBatchStatus?.isPendingAny && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Este batch tiene pendiente:{" "}
                    {currentBatchStatus.isPendingAnalisis && "🧪 Análisis Físico de Salida"}
                    {currentBatchStatus.isPendingBoth && " y "}
                    {currentBatchStatus.isPendingCoccion && "🍳 Prueba de Cocción en Olla"}.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentBatchStatus.isPendingAnalisis && (
                    <button
                      onClick={() => setActiveSubTab("calidad_salida")}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs cursor-pointer shadow-sm"
                    >
                      Ir a Registrar Análisis →
                    </button>
                  )}
                  {currentBatchStatus.isPendingCoccion && (
                    <button
                      onClick={() => setActiveSubTab("coccion_batch")}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-sm"
                    >
                      Ir a Registrar Cocción →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑAS PRINCIPALES DEL BATCH */}
        <div className="flex items-center gap-2 border-t border-slate-750 pt-3 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab("calidad_salida")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "calidad_salida"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700"
            }`}
          >
            <Microscope className="w-4 h-4" />
            <span>1. Muestras de Calidad Física ({currentBatchAnalisis.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("coccion_batch")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "coccion_batch"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700"
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>2. Evaluación de Cocción en Olla {coccionBatch ? "★" : ""}</span>
          </button>

          <button
            onClick={() => setActiveSubTab("benchmarking_batch")}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "benchmarking_batch"
                ? "bg-teal-600 text-white shadow-lg shadow-teal-600/20"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>3. Benchmarking & Rendimiento del Batch</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑA 1: MUESTRAS DE CALIDAD FÍSICA Y RENDIMIENTOS */}
      {activeSubTab === "calidad_salida" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Registro de Muestra */}
          <div className="lg:col-span-2 bg-slate-850 rounded-2xl border border-slate-750 p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-750 pb-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>Formato de Laboratorio: MOLINO DON JULIO</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Boleta Oficial de Análisis Físicos (Húmedo - Seco - Vaporizado)
                </p>
              </div>

              {/* Selector de Modo de Formulario */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormModeCalidad("BOLETA_DON_JULIO")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    formModeCalidad === "BOLETA_DON_JULIO"
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Boleta Molino Don Julio
                </button>
                <button
                  type="button"
                  onClick={() => setFormModeCalidad("ESTANDAR")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    formModeCalidad === "ESTANDAR"
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Modo Rápido
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ENCABEZADO DE LA BOLETA */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Datos Generales de la Boleta de Control
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Nº Boleta:</span>
                    <input
                      type="text"
                      value={formData.NUM_BOLETA || ""}
                      onChange={(e) => setFormData(p => ({ ...p, NUM_BOLETA: e.target.value }))}
                      className="bg-slate-950 border border-purple-500/50 rounded px-2 py-0.5 text-xs text-rose-400 font-black w-24 text-center"
                      placeholder="000000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cliente</label>
                    <input
                      type="text"
                      value={formData.CLIENTE || currentBatch?.CLIENTE || ""}
                      onChange={(e) => setFormData(p => ({ ...p, CLIENTE: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-bold"
                      placeholder="Nombre del cliente"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Código / Lote</label>
                    <input
                      type="text"
                      value={formData.CODIGO_MUESTRA || currentBatch?.CORRELATIVO || currentBatch?.BATCH_ID || ""}
                      onChange={(e) => setFormData(p => ({ ...p, CODIGO_MUESTRA: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-purple-300 font-black"
                      placeholder="Código muestra"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Sacos</label>
                    <input
                      type="number"
                      value={formData.TOTAL_SACOS || currentBatch?.TOTAL_SACOS || ""}
                      onChange={(e) => setFormData(p => ({ ...p, TOTAL_SACOS: Number(e.target.value) || undefined }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha</label>
                    <input
                      type="date"
                      value={formData.FECHA_ANALISIS || new Date().toISOString().split("T")[0]}
                      onChange={(e) => setFormData(p => ({ ...p, FECHA_ANALISIS: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Procedencia</label>
                    <input
                      type="text"
                      value={formData.PROCEDENCIA || ""}
                      onChange={(e) => setFormData(p => ({ ...p, PROCEDENCIA: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                      placeholder="Lugar / Finca"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Variedad</label>
                    <input
                      type="text"
                      value={formData.VARIEDAD || currentBatch?.VARIEDAD || ""}
                      onChange={(e) => setFormData(p => ({ ...p, VARIEDAD: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-emerald-400 font-bold"
                      placeholder="Variedad"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Muestra Nº</label>
                    <input
                      type="number"
                      min="1"
                      value={muestraNro}
                      onChange={(e) => setMuestraNro(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-purple-300 font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lote Origen</label>
                    <select
                      value={selectedLoteId}
                      onChange={(e) => setSelectedLoteId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-bold"
                    >
                      {currentBatchLotes.map((l) => (
                        <option key={l.LOTE_ID} value={l.LOTE_ID}>
                          {l.LOTE_ID} ({l.CLIENTE || l.VARIEDAD})
                        </option>
                      ))}
                      {currentBatchLotes.length === 0 && lotes.map((l) => (
                        <option key={l.LOTE_ID} value={l.LOTE_ID}>
                          {l.LOTE_ID} - {l.VARIEDAD}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* BANNER OFICIAL DE ALINEACIÓN: MISMA ESTRUCTURA FÍSICA QUE INGRESO */}
              <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 p-3 rounded-xl border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Módulo de Calidad: 16 Parámetros Físicos + Organolépticos Idénticos a Ingreso
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-200/90 leading-tight">
                    Se evalúan exactamente los mismos parámetros que en Ingreso. <strong className="text-cyan-300">A excepción de la Humedad</strong>, que aquí registra la <strong className="text-cyan-300">Humedad Final de Salida / Vaporizado (11.5% - 13.0%)</strong>.
                  </p>
                </div>

                {matchingAnalisisIngreso && (
                  <button
                    type="button"
                    onClick={handleCopiarDatosIngreso}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-600/30 shrink-0 cursor-pointer transition-all active:scale-95"
                    title="Importa los rendimientos base del análisis de materia prima para contrastar con el grano vaporizado"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Cargar Rendimientos Base de Ingreso ({selectedLoteId || formData.LOTE_ID})</span>
                  </button>
                )}
              </div>

              {/* TARJETA COMPARATIVA EN TIEMPO REAL: [INGRESO MP] vs [CALIDAD VAPORIZADO SALIDA] */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Impacto del Proceso: Materia Prima (Ingreso) ➔ Calidad Salida (Vaporizado)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Lote Base: <strong className="text-white">{selectedLoteId || formData.LOTE_ID || "LOTE-001"}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Humedad Secado</span>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span className="text-slate-400">{deltaCalc.humIng}%</span>
                      <span className="text-slate-600">➔</span>
                      <span className="font-black text-cyan-300">{deltaCalc.humSalida}%</span>
                    </div>
                    <span className="text-[9px] font-bold text-cyan-400 block mt-0.5">
                      Δ Secado: {deltaCalc.deltaHum}%
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">% Grano Entero</span>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span className="text-slate-400">{deltaCalc.entIng}%</span>
                      <span className="text-slate-600">➔</span>
                      <span className="font-black text-emerald-400">{deltaCalc.entSalida}%</span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 block mt-0.5">
                      Ganancia: {deltaCalc.deltaEntero >= 0 ? `+${deltaCalc.deltaEntero}%` : `${deltaCalc.deltaEntero}%`}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">% Trizado (Fisuras)</span>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span className="text-slate-400">{deltaCalc.tzIng}%</span>
                      <span className="text-slate-600">➔</span>
                      <span className="font-black text-rose-300">{deltaCalc.tzSalida}%</span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 block mt-0.5">
                      Fijación: {deltaCalc.deltaTrizado}%
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">% Tiza Total</span>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span className="text-slate-400">{deltaCalc.ttIng}%</span>
                      <span className="text-slate-600">➔</span>
                      <span className="font-black text-white">{deltaCalc.ttSalida}%</span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 block mt-0.5">
                      Fijación: {deltaCalc.deltaTiza}%
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-lg border border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-amber-300 uppercase font-bold block">% G. Cocido</span>
                      <span className="text-[8px] font-black text-amber-300 bg-amber-950 border border-amber-800 px-1 py-0.2 rounded">Salida</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span className="text-slate-500 text-[10px]">Entrada: N/A</span>
                      <span className="text-slate-600">➔</span>
                      <span className="font-black text-amber-300 font-mono">{formData.G_COCIDO !== undefined && formData.G_COCIDO !== null ? `${formData.G_COCIDO}%` : "-"}</span>
                    </div>
                    <span className="text-[9px] font-bold text-amber-400/90 block mt-0.5">
                      Gelatinización Salida
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">% Rend. Blanco (RB)</span>
                    <div className="flex items-center justify-between text-[11px] mt-0.5">
                      <span className="text-slate-400">{deltaCalc.rbIng}%</span>
                      <span className="text-slate-600">➔</span>
                      <span className="font-black text-emerald-400">{deltaCalc.rbSalida}%</span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 block mt-0.5">
                      Δ Rend.: {deltaCalc.deltaRB >= 0 ? `+${deltaCalc.deltaRB}%` : `${deltaCalc.deltaRB}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECCIÓN DE HUMEDAD: HUMEDAD FINAL DE SALIDA / VAPORIZADO (DIFERENCIADA DE INGRESO) */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-cyan-500/30 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider">
                      Humedad Final de Salida / Vaporizado (Salida de Secado: 11.5% - 13.0%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300">
                      Promedio Salida: <strong className="text-cyan-300 font-black text-sm">{formData.HUMEDAD !== undefined && formData.HUMEDAD !== null ? `${formData.HUMEDAD}%` : "Pendiente"}</strong>
                    </span>
                    <span className="text-xs text-slate-300">
                      Desv: <strong className="text-amber-300 font-black">{formData.DESV_HUMEDAD !== undefined && formData.DESV_HUMEDAD !== null ? `${formData.DESV_HUMEDAD}%` : "-"}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAutollenarTomasHumedad(formData.HUMEDAD || 12.5)}
                      className="px-2.5 py-1 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700/50 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      Autollenar 18 Tomas de Salida
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 text-center text-xs">
                  {Array.from({ length: 18 }).map((_, idx) => {
                    const val = formData.HUMEDADES_TOMAS?.[idx];
                    return (
                      <div key={idx} className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">H{idx + 1}</span>
                        <input
                          type="number"
                          step="0.1"
                          value={safeNumVal(val)}
                          placeholder="-"
                          onChange={(e) => handleActualizarTomaHumedad(idx, parseNumberOrZero(e.target.value))}
                          className="w-full bg-transparent text-center font-extrabold text-cyan-300 text-xs focus:outline-none focus:bg-slate-900 rounded"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PARÁMETROS FÍSICOS & RENDIMIENTOS (16 PARÁMETROS OFICIALES EXACTAMENTE IGUALES A INGRESO) */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    Parámetros Físicos y Rendimiento de Pilado / Vaporizado (16 Parámetros Oficiales + G. Cocido en Salida)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoCalcularRemocion}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-[10px] font-bold cursor-pointer"
                    >
                      Calcular %REM (RI - RB)
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoCalcularEntero}
                      className="px-2.5 py-0.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded text-[10px] font-bold cursor-pointer"
                    >
                      Calcular %Entero (RB - QB)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Impurezas (IMP)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.IMPUREZAS)}
                      onChange={(e) => setFormData(p => ({ ...p, IMPUREZAS: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% R. Integral (R. I)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.RI)}
                      onChange={(e) => setFormData(p => ({ ...p, RI: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-400 mb-1">% R. Blanco (R. B)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.RB)}
                      onChange={(e) => setFormData(p => ({ ...p, RB: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-emerald-400 font-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Remoción (% REM)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.RM ?? formData.R_POLVILLO)}
                      onChange={(e) => setFormData(p => {
                        const val = parseOptionalNumber(e.target.value);
                        return { ...p, RM: val, R_POLVILLO: val };
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-400 mb-1">% Q. Integral (%Q. INT)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.QI ?? formData.QUEBRADO)}
                      onChange={(e) => setFormData(p => {
                        const val = parseOptionalNumber(e.target.value);
                        return { ...p, QI: val, QUEBRADO: val };
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-amber-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-400 mb-1">% Q. Blanco (% Q. BL)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.QB)}
                      onChange={(e) => setFormData(p => ({ ...p, QB: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-amber-300 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-300 mb-1">% Grano Entero (% ENTERO)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.ENTERO)}
                      onChange={(e) => setFormData(p => ({ ...p, ENTERO: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-emerald-300 font-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Blancura Integral (BL. INT)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.BLI)}
                      onChange={(e) => setFormData(p => ({ ...p, BLI: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Blancura de Pulido (B. PULIDO)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.B_PULIDO ?? formData.BL)}
                      onChange={(e) => setFormData(p => {
                        const val = parseOptionalNumber(e.target.value);
                        return { ...p, B_PULIDO: val, BL: val };
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Mezcla Var. (% MEZCLA VAR)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.M_VARIETAL)}
                      onChange={(e) => setFormData(p => ({ ...p, M_VARIETAL: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Tiza Total (% T. TOT)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.TT ?? formData.TIZA)}
                      onChange={(e) => setFormData(p => {
                        const val = parseOptionalNumber(e.target.value);
                        return { ...p, TT: val, TIZA: val };
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  {/* G. COCIDO - EVALUACIÓN EXCLUSIVA DE LA SALIDA DE ARROZ VAPORIZADO (DESPUÉS DE TIZA TOTAL) */}
                  <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/40 relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-extrabold text-amber-300 truncate">
                        % G. Cocido (% G. COC)
                      </label>
                      <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded bg-amber-500 text-slate-950 shrink-0">
                        Salida Vap.
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.G_COCIDO)}
                      onChange={(e) => setFormData(p => ({ ...p, G_COCIDO: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-amber-500/50 rounded px-2 py-1.5 text-xs text-amber-200 font-black focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-[9px] text-amber-300/80 block mt-1 leading-tight font-medium">
                      Exclusivo salida arroz vaporizado
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Tiza Parcial (%T. PARC)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.TP)}
                      onChange={(e) => setFormData(p => ({ ...p, TP: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Tiza Puntual (%T. PUNT)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.TIZA_PUNTUAL)}
                      onChange={(e) => setFormData(p => ({ ...p, TIZA_PUNTUAL: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-400 mb-1">% Mancha (% M)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.MANCHADO ?? formData.M)}
                      onChange={(e) => setFormData(p => {
                        const val = parseOptionalNumber(e.target.value);
                        return { ...p, MANCHADO: val, M: val };
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-amber-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-rose-400 mb-1">% Trizado (% TZ)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.TRIZADO ?? formData.TZ)}
                      onChange={(e) => setFormData(p => {
                        const val = parseOptionalNumber(e.target.value);
                        return { ...p, TRIZADO: val, TZ: val };
                      })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-rose-400 font-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Grano Rojo (% G. R)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.GR)}
                      onChange={(e) => setFormData(p => ({ ...p, GR: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% G. Inmaduro (% G. INM)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.GI)}
                      onChange={(e) => setFormData(p => ({ ...p, GI: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">% Grano Verde (% G. V)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={safeNumVal(formData.G_VERDE)}
                      onChange={(e) => setFormData(p => ({ ...p, G_VERDE: parseOptionalNumber(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* DEFECTOS CUALITATIVOS / ORGANOLÉPTICOS (6 PARÁMETROS OFICIALES: PALOTE, VANO, IMPUREZA, OLOR, FALSO CARBÓN, HONGO - MISMOS CRITERIOS DE INGRESO) */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <span>Propiedades Organolépticas & Defectos Cualitativos</span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                    Escala Oficial: P (Poco) • R (Regular) • V (Variado) • B (Bastante)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {/* 1. PALOTE (PALT) */}
                  <OrganolepticoInput
                    id="input-av-palote"
                    label="PALOTE"
                    abreviatura="PALT"
                    condicionApto="P o R"
                    value={formData.PALOTE ?? formData.ORGANOLEPTICOS?.palote ?? "P"}
                    onChange={(val) => setFormData(p => ({
                      ...p,
                      PALOTE: val,
                      ORGANOLEPTICOS: { ...(p.ORGANOLEPTICOS || {}), palote: val }
                    }))}
                    pesoPct={1}
                  />

                  {/* 2. VANO (VN) */}
                  <OrganolepticoInput
                    id="input-av-vano"
                    label="VANO"
                    abreviatura="VN"
                    condicionApto="P o R"
                    value={formData.VANO ?? formData.ORGANOLEPTICOS?.vano ?? "P"}
                    onChange={(val) => setFormData(p => ({
                      ...p,
                      VANO: val as any,
                      ORGANOLEPTICOS: { ...(p.ORGANOLEPTICOS || {}), vano: val }
                    }))}
                    pesoPct={5}
                  />

                  {/* 3. IMPUREZA (IMP.) */}
                  <OrganolepticoInput
                    id="input-av-impureza"
                    label="IMPUREZA"
                    abreviatura="IMP."
                    condicionApto="P o R"
                    value={formData.IMPUREZAS ?? formData.ORGANOLEPTICOS?.impureza ?? "P"}
                    onChange={(val) => setFormData(p => ({
                      ...p,
                      IMPUREZAS: val as any,
                      ORGANOLEPTICOS: { ...(p.ORGANOLEPTICOS || {}), impureza: val }
                    }))}
                    pesoPct={1}
                  />

                  {/* 4. OLOR (OL) */}
                  <OrganolepticoInput
                    id="input-av-olor"
                    label="OLOR"
                    abreviatura="OL"
                    condicionApto="P (Poco)"
                    value={formData.OLOR ?? formData.ORGANOLEPTICOS?.olor ?? "P"}
                    onChange={(val) => setFormData(p => ({
                      ...p,
                      OLOR: val,
                      ORGANOLEPTICOS: { ...(p.ORGANOLEPTICOS || {}), olor: val }
                    }))}
                    pesoPct={10}
                  />

                  {/* 5. FALSO CARBÓN (F. CARB.) */}
                  <OrganolepticoInput
                    id="input-av-fcarbon"
                    label="FALSO CARBÓN"
                    abreviatura="F. CARB."
                    condicionApto="P (Poco)"
                    value={(formData as any)["F. CARBON"] ?? formData.ORGANOLEPTICOS?.falsoCarbon ?? "P"}
                    onChange={(val) => setFormData(p => ({
                      ...p,
                      "F. CARBON": val,
                      ORGANOLEPTICOS: { ...(p.ORGANOLEPTICOS || {}), falsoCarbon: val }
                    }))}
                    pesoPct={5}
                  />

                  {/* 6. HONGO (HON.) */}
                  <OrganolepticoInput
                    id="input-av-hongo"
                    label="HONGO"
                    abreviatura="HON."
                    condicionApto="P (Poco)"
                    value={formData.HONGO ?? formData.ORGANOLEPTICOS?.hongo ?? "P"}
                    onChange={(val) => setFormData(p => ({
                      ...p,
                      HONGO: val as any,
                      ORGANOLEPTICOS: { ...(p.ORGANOLEPTICOS || {}), hongo: val }
                    }))}
                    pesoPct={4}
                  />
                </div>
              </div>

              {/* OBSERVACIONES Y FIRMAS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Observaciones</label>
                  <textarea
                    id="textarea-av-obs"
                    rows={2}
                    value={formData.OBSERVACIONES || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, OBSERVACIONES: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
                    placeholder="Grano con óptima gelatinización en autoclave. Conforme al estándar de Molino Don Julio."
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Responsable Análisis</label>
                    <input
                      type="text"
                      value={formData.RESPONSABLE_ANALISIS || "Analista de Control de Calidad"}
                      onChange={(e) => setFormData(p => ({ ...p, RESPONSABLE_ANALISIS: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">V°B° Jefe de Área</label>
                    <input
                      type="text"
                      value={formData.VB_JEFE_AREA || "Ing. Jefe de Planta y Calidad"}
                      onChange={(e) => setFormData(p => ({ ...p, VB_JEFE_AREA: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-750">
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Muestra registrada correctamente con formato Molino Don Julio.
                  </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAnalisisForBoleta(formData as AnalisisVaporizado)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-purple-500/30 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>Previsualizar Boleta Oficial</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Vaciar
                  </button>
                  <button
                    id="btn-save-analisis-vap"
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Guardando..." : "Guardar Muestra en Batch"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Panel Lateral: Estadísticas y Muestras Registradas */}
          <div className="space-y-4">
            {/* Promedios del Batch */}
            <div className="bg-slate-850 rounded-2xl border border-slate-750 p-4 shadow-md space-y-3">
              <h4 className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-400" />
                <span>Promedios de Salida del Batch</span>
              </h4>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Humedad Media</span>
                  <span className="text-sm font-black text-cyan-300">
                    {batchStats.avgHumedad !== null ? `${batchStats.avgHumedad}%` : "--"}
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Quebrado (QI)</span>
                  <span className="text-sm font-black text-amber-300">
                    {batchStats.avgQI !== null ? `${batchStats.avgQI}%` : "--"}
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Blancura Kett</span>
                  <span className="text-sm font-black text-white">
                    {batchStats.avgBL !== null ? `${batchStats.avgBL}°` : "--"}
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Rend. Blanco (RB)</span>
                  <span className="text-sm font-black text-emerald-400">
                    {batchStats.avgRB !== null ? `${batchStats.avgRB}%` : "--"}
                  </span>
                </div>
              </div>
            </div>

            {/* Lista de Muestras Registradas */}
            <div className="bg-slate-850 rounded-2xl border border-slate-750 p-4 shadow-md space-y-3">
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Muestras del Batch ({currentBatchAnalisis.length})
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {currentBatch?.CORRELATIVO || currentBatch?.BATCH_ID}
                </span>
              </h4>

              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {currentBatchAnalisis.map((av) => (
                  <div key={av.ANALISIS_VAPORIZADO_ID} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex justify-between items-center font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-purple-300 font-black">Muestra #{av.MUESTRA_NRO}</span>
                        {av.NUM_BOLETA && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                            Nº {av.NUM_BOLETA}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 text-[10px]">{av.FECHA_ANALISIS}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-300">
                      <div>Hum: <strong className="text-cyan-300">{av.HUMEDAD ?? "--"}%</strong></div>
                      <div>QI: <strong className="text-amber-300">{av.QI ?? av.QUEBRADO ?? "--"}%</strong></div>
                      <div>BL: <strong className="text-white">{av.BL ?? "--"}</strong></div>
                      <div>RB: <strong className="text-emerald-400">{av.RB ?? "--"}%</strong></div>
                      <div>TT: <strong className="text-slate-200">{av.TT ?? "--"}%</strong></div>
                      <div>G.Coc: <strong className="text-amber-300 font-mono">{av.G_COCIDO !== undefined ? `${av.G_COCIDO}%` : "0.2%"}</strong></div>
                      <div>TZ: <strong className="text-rose-300">{av.TZ ?? "--"}%</strong></div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 italic truncate max-w-[140px]">
                        {av.OBSERVACIONES || "Conforme Molino Don Julio"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedAnalisisForBoleta(av)}
                        className="px-2 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800/60 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span>Ver Boleta Oficial</span>
                      </button>
                    </div>
                  </div>
                ))}
                {currentBatchAnalisis.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-xs italic bg-slate-900/50 rounded-xl border border-slate-800">
                    No hay muestras físicas registradas para este batch aún. Ingrese una muestra con el formulario.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 2: EVALUACIÓN DE COCCIÓN EN OLLA DEL BATCH */}
      {activeSubTab === "coccion_batch" && (
        <div className="space-y-6">
          {/* Componente Oficial: Resumen Sintético de Variables de Cocción */}
          <ResumenSinteticoCoccionCard 
            coccion={coccionBatch || coccionFormData}
            onEdit={() => setIsEditingCoccionForm(!isEditingCoccionForm)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                Batch Evaluado: <strong className="text-amber-400">{currentBatch?.CORRELATIVO || currentBatch?.BATCH_ID}</strong>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {coccionBatch ? "Dato Real Vinculado" : "Valores de Laboratorio Homologados"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFichaControlModal(true)}
                className="px-3.5 py-2 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Ver Ficha Control de Batch (Oficial)</span>
              </button>
              <button
                onClick={() => setIsEditingCoccionForm(!isEditingCoccionForm)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>{isEditingCoccionForm ? "Cerrar Editor" : "Editar / Registrar Cocción"}</span>
              </button>
            </div>
          </div>

          {/* Formulario de Edición de Cocción (si está activo) */}
          {isEditingCoccionForm && (
            <div className="bg-slate-850 rounded-2xl border-2 border-amber-500/50 p-5 shadow-2xl space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-750 pb-3">
                <div>
                  <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Registro Oficial de Variables de Cocción — Batch {currentBatch?.CORRELATIVO || currentBatch?.BATCH_ID}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure las variables sintéticas requeridas por el sistema para evaluación de grano y determinación del envase proyectado.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Panel Laboratorio
                </span>
              </div>

              <form onSubmit={handleSaveCoccionBatch} className="space-y-5">
                {/* 1. DOSIFICACIÓN */}
                <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Scale className="w-4 h-4" />
                      1. Dosificación
                    </span>
                    <span className="text-[10px] text-slate-400">Parámetros estándar de prueba</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Tazas Arroz</label>
                      <input
                        type="number"
                        step="0.5"
                        value={coccionFormData.tazasArroz ?? 3}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, tazasArroz: Number(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Tazas Agua</label>
                      <input
                        type="text"
                        value={coccionFormData.tazasAgua || "3 1/2"}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, tazasAgua: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Tiempo de Cocción (min)</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={typeof coccionFormData.tiempoCoccionMin === "number" ? coccionFormData.tiempoCoccionMin : 30}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, tiempoCoccionMin: Number(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-black"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 2. EVALUACIÓN DE GRANO COCIDO */}
                <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      2. Evaluación de Grano Cocido
                    </span>
                    <span className="text-[10px] text-slate-400">Métricas organolépticas en olla</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Sabor</label>
                      <input
                        type="text"
                        value={coccionFormData.sabor || ""}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, sabor: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold"
                        placeholder="Ej: Neutro Característico"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Desplazamiento (seg)</label>
                      <input
                        type="text"
                        value={coccionFormData.desplazamientoSeg || ""}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, desplazamientoSeg: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-bold"
                        placeholder="Ej: 15 seg"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">% Grano Quebrado</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={coccionFormData.granoQuebradoOllaPct ?? ""}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, granoQuebradoOllaPct: e.target.value === "" ? undefined : Number(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold"
                        placeholder="0.0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">% Grano Hinchado</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={coccionFormData.granoHinchadoPct ?? ""}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, granoHinchadoPct: e.target.value === "" ? undefined : Number(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-purple-300 font-bold"
                        placeholder="0.0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">% Grano Abierto</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={coccionFormData.granoAbiertoPct ?? ""}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, granoAbiertoPct: e.target.value === "" ? undefined : Number(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-rose-300 font-bold"
                        placeholder="0.0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Textura al Frío</label>
                      <input
                        type="text"
                        value={coccionFormData.texturaFrio || ""}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, texturaFrio: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-300 font-bold"
                        placeholder="Ej: Suave / Firme"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. ENVASE PROYECTADO .... ESO SE EVALUA EN COCCIÓN */}
                <div className="p-4 bg-gradient-to-r from-amber-500/10 via-slate-900/95 to-amber-500/10 rounded-xl border-2 border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Package className="w-4 h-4" />
                      3. ENVASE PROYECTADO (SE EVALÚA EN COCCIÓN)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      ★ Decisión Comercial basada en Olla
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        Presentación / Envase Proyectado Oficial
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={coccionFormData.envaseProyectado || ""}
                          onChange={(e) => setCoccionFormData(p => ({ ...p, envaseProyectado: e.target.value }))}
                          list="lista-envases-proyectados"
                          className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-white font-black"
                          placeholder="Ej: Saco 50 kg Don Julio Extra Selección"
                        />
                        <datalist id="lista-envases-proyectados">
                          <option value="Saco 50 kg Don Julio Extra Selección" />
                          <option value="Saco 50 kg Don Julio Superior" />
                          <option value="Bolsa 5 kg Don Julio Familiar" />
                          <option value="Bolsa 1 kg Don Julio Gourmet / Selección" />
                          <option value="Saco 25 kg Don Julio Especial" />
                          <option value="Saco 50 kg Corriente / Granel" />
                        </datalist>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Seleccione de la lista o ingrese la presentación comercial determinada por la prueba de cocción.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1">
                        Puntaje / Calificación Global de Cocción (0 - 100)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={coccionFormData.puntajeCoccion ?? ""}
                        onChange={(e) => setCoccionFormData(p => ({ ...p, puntajeCoccion: e.target.value === "" ? undefined : Number(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-black"
                        placeholder="Ej: 95"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Ponderación para el Índice de Eficiencia de Proceso (IEP).
                      </span>
                    </div>
                  </div>
                </div>

                {/* OBSERVACIONES Y PANELISTA */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1">Observaciones de Cocción</label>
                    <textarea
                      rows={2}
                      value={coccionFormData.observaciones || ""}
                      onChange={(e) => setCoccionFormData(p => ({ ...p, observaciones: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      placeholder="Comportamiento en olla, gelatinización, textura al frío..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Panelista / Evaluador</label>
                    <input
                      type="text"
                      value={coccionFormData.panelista || ""}
                      onChange={(e) => setCoccionFormData(p => ({ ...p, panelista: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold"
                      placeholder="Panelista / Evaluador"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-750">
                  {coccionSaveSuccess && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      Resultados y Envase Proyectado guardados y enlazados exitosamente al Batch.
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingCoccionForm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCoccion}
                      className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
                    >
                      {isSavingCoccion ? "Guardando..." : "Guardar Variables de Cocción"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA 3: BENCHMARKING & DESEMPEÑO COMPARATIVO */}
      {activeSubTab === "benchmarking_batch" && (
        <div className="space-y-6">
          {evaluacionBatch && (
            <div className="bg-slate-850 rounded-2xl border border-slate-750 p-5 shadow-lg space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-750 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-black text-white">
                      Índice de Éxito del Proceso (IEP) — Batch {evaluacionBatch.correlativo || evaluacionBatch.batchId}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluación multicriterio ponderada: Quebrado (35%), Defectos (25%), Cocción (20%), Blancura (10%) y Cumplimiento de Receta (10%).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Puntaje Global IEP</span>
                    <span className="text-xl font-black text-amber-400">
                      {evaluacionBatch.iepScore} <span className="text-xs text-slate-400 font-normal">/ 100 pts</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Desglose de Criterios IEP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">1. Control Quebrado</span>
                    <span className="text-xs font-black text-amber-400">{evaluacionBatch.puntosQuebrado} / 35</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-amber-400 h-full rounded-full transition-all" 
                      style={{ width: `${(evaluacionBatch.puntosQuebrado / 35) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Δ Quebrado: <strong className="text-white">+{evaluacionBatch.deltaQuebrado}%</strong>
                  </span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">2. Control Trizado</span>
                    <span className="text-xs font-black text-rose-400">{evaluacionBatch.puntosTrizado} / 25</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-rose-400 h-full rounded-full transition-all" 
                      style={{ width: `${(evaluacionBatch.puntosTrizado / 25) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Δ Trizado: <strong className="text-white">+{evaluacionBatch.deltaTrizado}%</strong>
                  </span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">3. Control Defectos</span>
                    <span className="text-xs font-black text-emerald-400">{evaluacionBatch.puntosDefectos} / 20</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-full rounded-full transition-all" 
                      style={{ width: `${(evaluacionBatch.puntosDefectos / 20) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Defectos salida: <strong className="text-white">{evaluacionBatch.tizaSalida + evaluacionBatch.manchadoSalida}%</strong>
                  </span>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">4. Cocción en Olla</span>
                    <span className="text-xs font-black text-purple-400">{evaluacionBatch.puntosCoccion} / 20</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-purple-400 h-full rounded-full transition-all" 
                      style={{ width: `${(evaluacionBatch.puntosCoccion / 20) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Score: <strong className="text-white">★ {evaluacionBatch.coccionScore} pts</strong>
                  </span>
                </div>
              </div>

              {/* Botón para saltar al comparador general */}
              {onNavigate && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => onNavigate("comparador", currentBatch?.BATCH_ID)}
                    className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95 cursor-pointer"
                  >
                    <span>Comparar este Batch Frente a Toda la Producción</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Integración de Cocción Externa */}
      <IntegracionCoccionModal
        isOpen={isCoccionModalOpen}
        onClose={() => {
          setIsCoccionModalOpen(false);
          setCoccionUpdateKey(prev => prev + 1);
          if (onRefreshData) onRefreshData();
        }}
        onResultadosImportados={() => {
          setCoccionUpdateKey(prev => prev + 1);
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Modal Boleta Molino Don Julio (Análisis Físicos de Salida) */}
      {selectedAnalisisForBoleta && (
        <BoletaMolinoDonJulioModal
          isOpen={!!selectedAnalisisForBoleta}
          onClose={() => setSelectedAnalisisForBoleta(null)}
          analisis={selectedAnalisisForBoleta}
          batch={currentBatch}
          analisisIngreso={matchingAnalisisIngreso}
          batchCode={currentBatch?.CORRELATIVO || currentBatch?.BATCH_ID}
          clienteNombre={currentBatch?.CLIENTE || "Santisteban Vidaurre Jhony"}
          variedad={currentBatch?.VARIEDAD || "Valor"}
          totalSacos={currentBatch?.TOTAL_SACOS || 379}
          humedadIngresoLote={matchingLote?.HUMEDAD}
        />
      )}

      {/* Modal Ficha Control Batch (Parámetros y Prueba de Cocción) */}
      {showFichaControlModal && currentBatch && (
        <FichaControlBatchModal
          isOpen={showFichaControlModal}
          onClose={() => setShowFichaControlModal(false)}
          batch={currentBatch}
          analisisList={currentBatchAnalisis}
          coccion={coccionBatch}
        />
      )}
    </div>
  );
};
