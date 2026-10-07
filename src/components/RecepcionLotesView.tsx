import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Lote, 
  RegistroHumedad, 
  AnalisisHumedo, 
  EstadoLote, 
  UserProfile,
  ConfiguracionEvaluacionLotes
} from "../types";
import { 
  Package, 
  Plus, 
  Search, 
  FileText, 
  CheckCircle, 
  Droplet, 
  FlaskConical, 
  RotateCcw, 
  Save, 
  Camera, 
  Scale, 
  ChevronRight, 
  Building, 
  MapPin, 
  Info, 
  CheckCircle2, 
  Sparkles, 
  Calculator, 
  Sliders, 
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Layers,
  ArrowRight,
  TrendingUp,
  Clock,
  Flame,
  CheckCheck,
  Check,
  Edit3,
  LayoutGrid,
  List,
  Eye,
  Filter,
  XCircle,
  X,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  Trash2,
  Loader2,
  SlidersHorizontal
} from "lucide-react";
import { VARIEDADES_ARROZ_OPCIONES } from "./LotesView";
import { FichaUnificadaModal } from "./FichaUnificadaModal";
import { ModalAutorizarExperimental } from "./ModalAutorizarExperimental";
import { calcularEvaluacionLote, ResultadoEvaluacionLote } from "../utils/evaluacionCalidad";
import { OrganolepticoInput } from "./OrganolepticoInput";
import { 
  clasificarLotes, 
  obtenerCategoriaLote, 
  obtenerMetaCategoria, 
  CategoriaLote 
} from "../utils/loteClassification";
import { tienePermiso, obtenerMensajeRestriccion, puedeAutorizarLoteExperimental } from "../utils/permisosService";
import { safeNumVal, parseOptionalNumber, safeNumber } from "../utils/numberUtils";
import { localDB } from "../utils/localDB";
import { formatLoteCode } from "../utils/formatLoteCode";
import * as XLSX from "xlsx";
import { parseSheetToRows } from "../utils/excelSheetParser";
import { cloudSyncService } from "../services/cloudSyncService";
import { 
  ExcelDatosFaltantesModal, 
  detectMissingFieldsInRows, 
  MissingFieldsSummary 
} from "./ExcelDatosFaltantesModal";

export type FiltroCalidadAprobacion = "TODOS" | "APROBADO" | "OBSERVADO" | "EXPERIMENTAL" | "DESAPROBADO";

// Interfaz para gestionar confirmaciones de parámetros vacíos en fotografía física
export interface ParametroVacioFoto {
  campo: string;
  label: string;
  unidad: string;
  estado: "PENDIENTE" | "ES_CERO" | "INGRESADO" | "DEJADO_PENDIENTE";
  valor: number | string | undefined;
  motivo?: string;
  esLaboratorio?: boolean;
  esDefecto?: boolean;
}

interface RecepcionLotesViewProps {
  lotes?: Lote[];
  estados?: EstadoLote[];
  humedades?: RegistroHumedad[];
  analisisHumedos?: AnalisisHumedo[];
  evaluacionConfig?: ConfiguracionEvaluacionLotes;
  currentUser?: UserProfile;
  initialLoteId?: string;
  pendingOCRData?: { tipoFormato: string; data: any; timestamp: number; imagenUrl?: string } | null;
  onClearPendingOCR?: () => void;
  onSaveLote: (lote: Partial<Lote>) => Promise<void>;
  onSaveHumedad: (rec: Partial<RegistroHumedad>) => Promise<void>;
  onSaveAnalisisHum: (analisis: Partial<AnalisisHumedo>) => Promise<void>;
  onDeleteLote?: (loteId: string) => Promise<void>;
  onOpenReport?: (loteId: string) => void;
  onOpenOCR?: () => void;
  onOpenConfigEvaluacion?: () => void;
  onOpenExcelSync?: () => void;
  onNavigate: (tab: string, filterId?: string) => void;
}

const getEmptyCaladas = (): { [key: string]: string } => ({
  M1: "", M2: "", M3: "", M4: "", M5: "", M6: "", M7: "",
  M8: "", M9: "", M10: "", M11: "", M12: "", M13: "", M14: ""
});

const getEmptyAnalisisState = (loteId?: string, variedad?: string): Partial<AnalisisHumedo> => ({
  ANALISIS_HUMEDO_ID: "",
  LOTE_ID: loteId || "",
  FECHA_ANALISIS: new Date().toISOString().split("T")[0],
  VARIEDAD: variedad || "",
  // 16 Parámetros de Calidad y Rendimientos - Valor inicial 0
  HUMEDADES: 0,
  RI: 0,
  RB: 0,
  RM: 0,
  QI: 0,
  QB: 0,
  ENTERO: 0,
  TT: 0,
  TP: 0,
  "T. PUNT.": 0,
  M: 0,
  MANCHADO: 0,
  TZ: 0,
  GR: 0,
  GI: 0,
  GV: 0,
  "B.INTEGRAL": 0,
  "B. PULIDO": 0,
  // 6 Parámetros Organolépticos (N = Ninguno / No Presenta / 0%)
  PALOTE: "N",
  VANO: "N",
  IMPUREZS: "N",
  OLOR: "N",
  "F. CARBON": "N",
  HONGO: "N",
  // Otros
  "MEZCLA VAR.": 0,
  CASCADO: 0,
  "PLAGAS-NSEC.": 0,
  OTROS: 0,
  OBSERVACIONES: ""
});

const getEmptyLoteState = (): Partial<Lote> => ({
  LOTE_ID: "0",
  FECHA_INGRESO: new Date().toISOString().split("T")[0],
  CLIENTE: "",
  VARIEDAD: "",
  SACOS: 0,
  PESO_KG: 0,
  HUM: 0,
  UBICACION: "",
  ZONA: "",
  ESTADO_LOTE: "INGRESADO",
  OBSERVACIONES: ""
});

/**
 * Retorna las clases visuales y metadatos del botón con el código del lote,
 * cuyo color refleja directamente el Dictamen de Calidad oficial del lote.
 */
export const getDictamenBadgeProps = (
  estadoNormalizado: "APROBADO" | "OBSERVADO" | "EXPERIMENTAL" | "DESAPROBADO",
  evalResult: ResultadoEvaluacionLote,
  hasAnalisisData: boolean
) => {
  if (!hasAnalisisData && !evalResult.tieneVetoCritico) {
    return {
      className: "bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 shadow-sm",
      dotColor: "bg-slate-500",
      dictamenLabel: "Pendiente de Análisis",
      title: "Lote sin análisis registrado - Clic para abrir Hoja Unificada del Lote"
    };
  }

  switch (estadoNormalizado) {
    case "APROBADO":
      return {
        className: "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/80 hover:border-emerald-400 shadow-sm ring-1 ring-emerald-500/30",
        dotColor: "bg-emerald-400",
        dictamenLabel: `Aprobado (${evalResult.porcentajeAprobacion}%)`,
        title: `Dictamen de Calidad: APROBADO (${evalResult.porcentajeAprobacion}%) - Clic para abrir Hoja Unificada del Lote`
      };
    case "OBSERVADO":
      return {
        className: "bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/80 hover:border-amber-400 shadow-sm ring-1 ring-amber-500/30",
        dotColor: "bg-amber-400",
        dictamenLabel: `Observado (${evalResult.porcentajeAprobacion}%)`,
        title: `Dictamen de Calidad: OBSERVADO (${evalResult.porcentajeAprobacion}%) - Clic para abrir Hoja Unificada del Lote`
      };
    case "EXPERIMENTAL":
      return {
        className: "bg-orange-950/80 hover:bg-orange-900 text-orange-300 border-orange-500/80 hover:border-orange-400 shadow-sm ring-1 ring-orange-500/30",
        dotColor: "bg-orange-400",
        dictamenLabel: `Experimental (${evalResult.porcentajeAprobacion}%)`,
        title: `Dictamen de Calidad: EXPERIMENTAL (${evalResult.porcentajeAprobacion}%) - Clic para abrir Hoja Unificada del Lote`
      };
    case "DESAPROBADO":
    default:
      return {
        className: "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-500/80 hover:border-rose-400 shadow-sm ring-1 ring-rose-500/30",
        dotColor: "bg-rose-400",
        dictamenLabel: evalResult.tieneVetoCritico
          ? `Desaprobado por Veto (${evalResult.porcentajeAprobacion}%)`
          : `Desaprobado (${evalResult.porcentajeAprobacion}%)`,
        title: `Dictamen de Calidad: DESAPROBADO / RECHAZADO (${evalResult.porcentajeAprobacion}%) - Clic para abrir Hoja Unificada del Lote`
      };
  }
};

const UBICACIONES_PREDETERMINADAS = [
  "Tolva de Secadora",
  "Almacén 5",
  "Tolva de Recepción",
  "Silo Pulmón 01",
  "Silo Pulmón 02",
  "Silo 01",
  "Silo 02",
  "Piso de Descarga",
  "Almacén 1",
  "Almacén 2",
  "Almacén 3",
  "Almacén 4"
];

const ZONAS_PREDETERMINADAS = [
  "Ferreñafe",
  "Chiclayo",
  "Lambayeque",
  "Túcume",
  "Mochumí",
  "Pitipo",
  "Picsi",
  "Jayanca",
  "Pacora",
  "Olmos",
  "Chepén",
  "Guadalupe",
  "San Martín / Tarapoto",
  "Bagua / Utcubamba",
  "Jaén",
  "Bellavista"
];

export const RecepcionLotesView: React.FC<RecepcionLotesViewProps> = ({
  lotes = [],
  estados = [],
  humedades = [],
  analisisHumedos = [],
  evaluacionConfig,
  currentUser,
  initialLoteId,
  pendingOCRData,
  onClearPendingOCR,
  onSaveLote,
  onSaveHumedad,
  onSaveAnalisisHum,
  onDeleteLote,
  onOpenReport,
  onOpenOCR,
  onOpenConfigEvaluacion,
  onOpenExcelSync,
  onNavigate
}) => {
  // Navigation inside the unified view
  const [activeMode, setActiveMode] = useState<"catalogo" | "nuevo_unificado" | "detalle_lote">("catalogo");
  const [viewMode, setViewMode] = useState<"tarjetas" | "lista">("lista");
  const [selectedLoteId, setSelectedLoteId] = useState<string>(initialLoteId || lotes[0]?.LOTE_ID || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState("");

  // Permisos según el rol del usuario activo
  const userRole = currentUser?.rol || "OPERARIO";
  const canEditLotes = tienePermiso(userRole, "editar_lotes");
  const canRecordCalidad = tienePermiso(userRole, "registrar_analisis_calidad");
  const canApproveCalidad = tienePermiso(userRole, "dictamen_aprobacion_calidad");
  const canUseOCR = tienePermiso(userRole, "usar_ocr_documentos");
  const [selectedCategoriaFilter, setSelectedCategoriaFilter] = useState<"TODOS" | CategoriaLote>("TODOS");
  const [selectedCalidadFilter, setSelectedCalidadFilter] = useState<FiltroCalidadAprobacion>("TODOS");

  // Modal para autorizar paso de lote desaprobado a experimental (Exclusivo Jefe de Área o Programador)
  const [modalAutorizarExperimental, setModalAutorizarExperimental] = useState<{
    lote: Lote;
    evalResult?: ResultadoEvaluacionLote;
  } | null>(null);
  const [noticeAccessDenied, setNoticeAccessDenied] = useState<{
    loteId: string;
    userRol: string;
  } | null>(null);
  const [successBannerMsg, setSuccessBannerMsg] = useState<string | null>(null);

  // Modal in-app de confirmación para eliminación definitiva de lote
  const [loteAEliminar, setLoteAEliminar] = useState<Lote | null>(null);
  const [isDeletingLote, setIsDeletingLote] = useState(false);

  // Estado e input nativo para ingreso directo por fotografía / escáner
  const directPhotoInputRef = useRef<HTMLInputElement>(null);
  const directCameraInputRef = useRef<HTMLInputElement>(null);
  const directExcelInputRef = useRef<HTMLInputElement>(null);
  const [isDirectProcessingPhoto, setIsDirectProcessingPhoto] = useState(false);
  const [isDirectProcessingExcel, setIsDirectProcessingExcel] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [showPhotoZoomModal, setShowPhotoZoomModal] = useState<string | null>(null);

  // Estado para gestión y solicitud de datos faltantes en Excel
  const [showDirectExcelMissingModal, setShowDirectExcelMissingModal] = useState<boolean>(false);
  const [directExcelMissingSummary, setDirectExcelMissingSummary] = useState<MissingFieldsSummary | null>(null);
  const [directExcelPendingPayload, setDirectExcelPendingPayload] = useState<Record<string, any[]> | null>(null);
  const [directExcelPendingFileName, setDirectExcelPendingFileName] = useState<string>("");
  const [directExcelPendingRows, setDirectExcelPendingRows] = useState<any[]>([]);

  // Summary classification of all lots in plant
  const clasificacion = useMemo(() => clasificarLotes(lotes), [lotes]);

  // Extract unique saved clients from existing lotes
  const clientesGuardados = Array.from(
    new Set(
      lotes
        .map((l) => l.CLIENTE?.trim())
        .filter((c): c is string => !!c && c.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  // Extract unique locations
  const ubicacionesGuardadas = Array.from(
    new Set([
      ...UBICACIONES_PREDETERMINADAS,
      ...lotes.map((l) => l.UBICACION?.trim()).filter((u): u is string => !!u && u.length > 0)
    ])
  );

  // Extract unique zones / origins
  const zonasGuardadas = Array.from(
    new Set([
      ...ZONAS_PREDETERMINADAS,
      ...lotes.map((l) => l.ZONA?.trim()).filter((z): z is string => !!z && z.length > 0)
    ])
  );

  // --- FORM STATES FOR UNIFIED REGISTRATION / EDITING ---
  const [loteForm, setLoteForm] = useState<Partial<Lote>>(getEmptyLoteState());
  const [caladas, setCaladas] = useState<{ [key: string]: string }>(getEmptyCaladas());
  const [analisisForm, setAnalisisForm] = useState<Partial<AnalisisHumedo>>(getEmptyAnalisisState());

  const [isCustomVariedad, setIsCustomVariedad] = useState(false);
  const [customVariedadText, setCustomVariedadText] = useState("");

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-dismiss success notification after 6 seconds
  useEffect(() => {
    if (saveSuccessMsg) {
      const timer = setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessMsg]);

  // Active sub-step in the unified registration form
  const [formStep, setFormStep] = useState<"step_lote" | "step_calidad" | "step_todo" | "step_humedad" | "step_analisis">("step_lote");
  const [modalFichaLoteId, setModalFichaLoteId] = useState<string | null>(null);
  const [showGuiaSignificados, setShowGuiaSignificados] = useState<boolean>(false);

  // Resaltado en rojo de las casillas faltantes (ej. tras subir foto o al intentar guardar incompleto)
  const [highlightRedMissing, setHighlightRedMissing] = useState<boolean>(false);

  // Soporte para capturas de tablas de Excel con múltiples filas/lotes en una sola imagen
  const [multiLotesFromPhoto, setMultiLotesFromPhoto] = useState<any[] | null>(null);
  const [selectedMultiLoteIndex, setSelectedMultiLoteIndex] = useState<number>(0);

  // Orden secuencial de los 14 cuadros editables de Rendimientos & Defectos de Calidad
  const RENDIMIENTOS_INPUT_ORDER = [
    "input-rend-RI",
    "input-rend-RB",
    "input-rend-QI",
    "input-rend-QB",
    "input-rend-TT",
    "input-rend-TP",
    "input-rend-TPUNT",
    "input-rend-M",
    "input-rend-TZ",
    "input-rend-GR",
    "input-rend-GI",
    "input-rend-GV",
    "input-rend-BINTEGRAL",
    "input-rend-BPULIDO"
  ];

  const handleRendimientoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const currIdx = RENDIMIENTOS_INPUT_ORDER.indexOf(currentId);
      if (currIdx >= 0 && currIdx < RENDIMIENTOS_INPUT_ORDER.length - 1) {
        const nextId = RENDIMIENTOS_INPUT_ORDER[currIdx + 1];
        const nextEl = document.getElementById(nextId) as HTMLInputElement | null;
        if (nextEl) {
          nextEl.focus();
          nextEl.select();
        }
      } else {
        // En el último cuadro (BLANCURA DE PULIDO), enfocar el botón Guardar Lote
        const saveBtn = document.getElementById("btn-guardar-recepcion-unificada") as HTMLElement | null;
        if (saveBtn) {
          saveBtn.focus();
        }
      }
    }
  };

  const handleCaladaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx < 14) {
        const nextCalada = document.getElementById(`input-calada-M${idx + 1}`) as HTMLInputElement | null;
        if (nextCalada) {
          nextCalada.focus();
          nextCalada.select();
        }
      } else {
        // Al terminar de llenar M14 y presionar Enter, al estar unidas en la MISMA HOJA, salta de inmediato al primer cuadro (R. INTEGRAL)
        const firstRend = document.getElementById("input-rend-RI") as HTMLInputElement | null;
        if (firstRend) {
          firstRend.focus();
          firstRend.select();
        }
      }
    }
  };

  // Estado para solicitar activamente la información faltante tras carga por fotografía
  const [solicitudFaltantes, setSolicitudFaltantes] = useState<{
    isOpen: boolean;
    loteId: string;
    rawLoteId: string;
    isCodigoDuplicado: boolean;
    loteExistenteDuplicado: Lote | null;
    tipoFormato: string;
    formatoNombre: string;
    cliente: string;
    sacos: number | "";
    pesoKg: number | "";
    zona: string;
    ubicacion: string;
    variedad: string;
    fecha: string;
    observaciones: string;
    caladas: { [key: string]: string };
    analisis: Partial<AnalisisHumedo>;
    camposFaltantes: Array<{ campo: string; label: string; motivo: string; obligatorio: boolean }>;
    parametrosVacios: ParametroVacioFoto[];
    camposDetectados: string[];
    errorValidacion: string | null;
    imagenPreview?: string | null;
  } | null>(null);

  // Panel interactivo de completado que se muestra en el formulario tras subir foto
  const [ocrPostUploadPanel, setOcrPostUploadPanel] = useState<{
    active: boolean;
    formatoNombre: string;
    photoUrl?: string | null;
    camposDetectados: string[];
    rawLoteId: string;
    isCodigoDuplicado: boolean;
  } | null>(null);

  useEffect(() => {
    if (initialLoteId) {
      setSelectedLoteId(initialLoteId);
    }
  }, [initialLoteId]);

  // Apply OCR data automatically when transferred from OCR scanner or photo upload
  const applyIncomingOCRData = (tipoFormato: string, data: any, imagenUrl?: string) => {
    if (!data) return;

    if (imagenUrl) {
      setUploadedPhotoUrl(imagenUrl);
    }

    const isDonJulio = Boolean(data.NRO_FICHA && (tipoFormato === "DON_JULIO_ANALISIS_FISICO" || data.formato === "DON_JULIO_ANALISIS_FISICO"));
    
    // Obtener código exacto detectado en la imagen o documento físico
    const rawLote = (
      data.LOTE_ID ||
      data.codigo ||
      data.nroLote ||
      data.lote ||
      data.loteId ||
      data.datosIngreso?.codigo ||
      data.datosIngreso?.codigoLote ||
      data.datosIngreso?.loteId ||
      data.NRO_FICHA ||
      data.nroFicha ||
      data.ficha ||
      data.ticket ||
      data.nroTicket ||
      data.general?.nroBatch ||
      data.guia ||
      data.nroGuia ||
      ""
    ).toString().trim();
    // Si la foto trajo código de lote, actualizarlo con fidelidad. Si no trajo código, iniciar en "0" para ingreso manual.
    const normalizedLoteId = (rawLote && rawLote !== "0") ? (normalizeLoteId(rawLote) || rawLote) : "0";

    // Verificación estricta de duplicidad SOLO si la foto trajo un código explícito y no es "0"
    const existingLote = (rawLote && rawLote !== "0") ? lotes.find(l => {
      const normL = normalizeLoteId(l.LOTE_ID);
      const normTarget = normalizeLoteId(normalizedLoteId);
      const normRaw = normalizeLoteId(rawLote);
      return (
        normL === normTarget ||
        normL === normRaw ||
        l.LOTE_ID.toUpperCase() === rawLote.toUpperCase() ||
        l.LOTE_ID.toUpperCase() === normalizedLoteId.toUpperCase()
      );
    }) : undefined;
    const isCodigoDuplicado = Boolean(existingLote);

    // Extracción tolerante y exhaustiva de CLIENTE / PRODUCTOR / AGRICULTOR
    const cliente = (
      data.CLIENTE ||
      data.cliente ||
      data.PRODUCTOR ||
      data.productor ||
      data.AGRICULTOR ||
      data.agricultor ||
      data.SENOR ||
      data.senor ||
      data.NOMBRE ||
      data.nombre ||
      data.RAZON_SOCIAL ||
      data.razonSocial ||
      data.PROVEEDOR ||
      data.proveedor ||
      data.DEPOSITANTE ||
      data.depositante ||
      data.TITULAR ||
      data.titular ||
      data.general?.cliente ||
      data.general?.productor ||
      data.datosIngreso?.cliente ||
      data.datosIngreso?.productor ||
      ""
    ).toString().trim().toUpperCase();

    const variedad = (
      data.VARIEDAD ||
      data.variedad ||
      data.datosIngreso?.variedad ||
      ""
    ).toString().trim().toUpperCase();

    // Extracción tolerante y exhaustiva de SACOS / CANTIDAD / BULTOS
    const rawSacosVal = (
      data.SACOS ??
      data.sacos ??
      data.CANTIDAD ??
      data.cantidad ??
      data.BULTOS ??
      data.bultos ??
      data.BOLSAS ??
      data.bolsas ??
      data.NUM_SACOS ??
      data.numSacos ??
      data.cantSacos ??
      data.datosIngreso?.numSacos ??
      data.datosIngreso?.sacos ??
      data.datosIngreso?.cantidad
    );
    const sacos = (rawSacosVal !== undefined && rawSacosVal !== null && rawSacosVal !== "") ? Number(rawSacosVal) : 0;
    
    // Extracción tolerante de PESO BALANZA (PESO_KG)
    const rawPesoVal = (
      data.PESO_KG ??
      data.pesoKg ??
      data.peso_kg ??
      data.PESO_NETO ??
      data.pesoNeto ??
      data.PESO ??
      data.peso ??
      data.TOTAL_KG ??
      data.datosIngreso?.pesoKg
    );
    const pesoKg = (rawPesoVal !== undefined && rawPesoVal !== null && rawPesoVal !== "") 
      ? Number(rawPesoVal) 
      : 0;

    const zona = (data.ZONA || data.zona || data.procedencia || data.datosIngreso?.procedencia || "").toString().trim();
    const ubicacion = (data.UBICACION || data.ubicacion || "").toString().trim();
    const fecha = data.FECHA || data.fecha || data.FECHA_INGRESO || data.fechaIngreso || data.general?.fecha || new Date().toISOString().split("T")[0];

    // 1. Lote Form
    setLoteForm({
      LOTE_ID: normalizedLoteId,
      CLIENTE: cliente,
      VARIEDAD: variedad,
      FECHA_INGRESO: fecha,
      SACOS: sacos,
      PESO_KG: pesoKg,
      HUM: undefined, // La humedad se saca después de ingresar los parámetros (14 caladas)
      ZONA: zona,
      UBICACION: ubicacion,
      ESTADO_LOTE: "INGRESADO",
      OBSERVACIONES: data.OBSERVACIONES || (rawLote ? `Cargado mediante OCR desde documento (${tipoFormato}).` : `Ingreso por fotografía.`)
    });

    if (VARIEDADES_ARROZ_OPCIONES.includes(variedad)) {
      setIsCustomVariedad(false);
      setCustomVariedadText("");
    } else {
      setIsCustomVariedad(true);
      setCustomVariedadText(variedad);
    }

    // 2. Caladas M1-M14
    const loadedCaladas: { [key: string]: string } = {};
    if (data.caladas && typeof data.caladas === "object") {
      for (let i = 1; i <= 14; i++) {
        const k = `M${i}`;
        loadedCaladas[k] = data.caladas[k] !== undefined && data.caladas[k] !== null ? String(data.caladas[k]) : "";
      }
    } else if (Array.isArray(data.M1_M14) && data.M1_M14.length > 0) {
      data.M1_M14.forEach((val: number, idx: number) => {
        if (idx < 14 && val !== null && val !== undefined) loadedCaladas[`M${idx + 1}`] = String(val);
      });
    } else if (data.HUMEDAD) {
      const baseH = Number(data.HUMEDAD);
      for (let i = 1; i <= 14; i++) {
        loadedCaladas[`M${i}`] = String((baseH + (i % 2 === 0 ? 0.2 : -0.2)).toFixed(1));
      }
    }
    setCaladas(loadedCaladas);

    // 3. Analisis Físico Húmedo (SIN CREAR VALORES AUTOMÁTICOS POR DEFECTO NI INVENTAR NÚMEROS)
    const ri = data.RI !== undefined && data.RI !== null && data.RI !== "" ? Number(data.RI) : 0;
    const rb = data.RB !== undefined && data.RB !== null && data.RB !== "" ? Number(data.RB) : 0;
    const qb = data.QB !== undefined && data.QB !== null && data.QB !== "" ? Number(data.QB) : 0;
    const qi = data.QI !== undefined && data.QI !== null && data.QI !== "" ? Number(data.QI) : 0;
    // % Remoción (% REM = RI - RB) y % Grano Entero (% ENTERO = RB - Quebrado) son 100% automáticos
    const rm = (ri > 0 || rb > 0) ? Number((ri - rb).toFixed(2)) : 0;
    const quebradoCalc = qb > 0 ? qb : qi;
    const entero = (rb > 0 || quebradoCalc > 0) ? Number((rb - quebradoCalc).toFixed(2)) : 0;
    const impurezas = data.IMPUREZS !== undefined && data.IMPUREZS !== null && data.IMPUREZS !== "" ? Number(data.IMPUREZS) : 0;
    const bPulido = data["B. PULIDO"] !== undefined && data["B. PULIDO"] !== null && data["B. PULIDO"] !== "" ? Number(data["B. PULIDO"]) : 0;
    const tPunt = data.T_PUNT !== undefined && data.T_PUNT !== null && data.T_PUNT !== "" 
      ? Number(data.T_PUNT) 
      : (data["T. PUNT."] !== undefined && data["T. PUNT."] !== null && data["T. PUNT."] !== "" ? Number(data["T. PUNT."]) : 0);
    const gr = data.GR !== undefined && data.GR !== null && data.GR !== "" && data.GR !== "-" ? Number(data.GR) : 0;
    const m = data.M !== undefined && data.M !== null && data.M !== "" 
      ? Number(data.M) 
      : (data.MANCHADO !== undefined && data.MANCHADO !== null && data.MANCHADO !== "" ? Number(data.MANCHADO) : 0);
    const tz = data.TZ !== undefined && data.TZ !== null && data.TZ !== "" ? Number(data.TZ) : 0;
    const gi = data.GI !== undefined && data.GI !== null && data.GI !== "" ? Number(data.GI) : 0;
    const gv = data.GV !== undefined && data.GV !== null && data.GV !== "" ? Number(data.GV) : 0;
    const tt = data.TT !== undefined && data.TT !== null && data.TT !== "" ? Number(data.TT) : 0;
    const tp = data.TP !== undefined && data.TP !== null && data.TP !== "" ? Number(data.TP) : 0;
    const bInt = data["B.INTEGRAL"] !== undefined && data["B.INTEGRAL"] !== null && data["B.INTEGRAL"] !== "" ? Number(data["B.INTEGRAL"]) : 0;

    // Regla industrial: N es Ninguno pero N también es igual a NP (No Presenta)
    const normalizeOrganolepticoNP = (val: any): string | undefined => {
      if (val === undefined || val === null || val === "") return undefined;
      const s = String(val).trim().toUpperCase();
      const clean = s.replace(/[\.\s\-_/]/g, "");
      if (clean === "NP" || clean === "N" || s.startsWith("NO PRESEN") || s.startsWith("NINGUN")) {
        return "N";
      }
      return s;
    };

    setAnalisisForm({
      LOTE_ID: normalizedLoteId,
      FECHA_ANALISIS: fecha,
      VARIEDAD: variedad,
      HUMEDADES: data.HUMEDAD ? Number(data.HUMEDAD) : 0,
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
      "B. PULIDO": bPulido,
      OLOR: normalizeOrganolepticoNP(data.OLOR) || "N",
      PALOTE: normalizeOrganolepticoNP(data.PALOTE) || (data.PALOTE !== undefined && data.PALOTE !== null && data.PALOTE !== "" ? (isNaN(Number(data.PALOTE)) ? data.PALOTE : Number(data.PALOTE)) : "N"),
      VANO: normalizeOrganolepticoNP(data.VANO) || (data.VANO !== undefined && data.VANO !== null && data.VANO !== "" ? (isNaN(Number(data.VANO)) ? data.VANO : Number(data.VANO)) : "N"),
      IMPUREZS: impurezas,
      HONGO: normalizeOrganolepticoNP(data.HONGO) || (data.HONGO !== undefined && data.HONGO !== null && data.HONGO !== "" ? (isNaN(Number(data.HONGO)) ? data.HONGO : Number(data.HONGO)) : "N"),
      "F. CARBON": normalizeOrganolepticoNP(data["F. CARBON"]) || (data["F. CARBON"] !== undefined && data["F. CARBON"] !== null && data["F. CARBON"] !== "" ? (isNaN(Number(data["F. CARBON"])) ? data["F. CARBON"] : Number(data["F. CARBON"])) : "N"),
      OBSERVACIONES: data.OBSERVACIONES || (rawLote ? `Datos cargados desde fotografía (${tipoFormato}).` : `Ingreso por fotografía.`)
    });

    setSelectedLoteId(normalizedLoteId);
    setActiveMode("nuevo_unificado");
    setFormStep("step_lote");
    setHighlightRedMissing(true);
    
    // Detectar campos obligatorios y requeridos faltantes para el ingreso
    const camposFaltantesDetectados: Array<{ campo: string; label: string; motivo: string; obligatorio: boolean }> = [];
    if (!pesoKg || pesoKg <= 0) {
      camposFaltantesDetectados.push({
        campo: "PESO_KG",
        label: "Peso Total Balanza (Kg)",
        motivo: "El peso en plataforma no figura en la fotografía física. Requiere pesaje en balanza de recepción.",
        obligatorio: true
      });
    }
    if (!cliente || !cliente.trim()) {
      camposFaltantesDetectados.push({
        campo: "CLIENTE",
        label: "Cliente / Productor",
        motivo: "Indispensable para identificar al productor o proveedor del lote.",
        obligatorio: true
      });
    }
    if (!sacos || sacos <= 0) {
      camposFaltantesDetectados.push({
        campo: "SACOS",
        label: "Cantidad de Sacos",
        motivo: "Requerido para control de estiba y volumen de recepción.",
        obligatorio: true
      });
    }
    if (!zona || !zona.trim()) {
      camposFaltantesDetectados.push({
        campo: "ZONA",
        label: "Procedencia / Zona de Origen",
        motivo: "Requerido para trazabilidad geográfica (ej. Ferreñafe, Lambayeque).",
        obligatorio: false
      });
    }
    if (!ubicacion || !ubicacion.trim()) {
      camposFaltantesDetectados.push({
        campo: "UBICACION",
        label: "Ubicación / Silo Asignado",
        motivo: "Requerido para asignar la tolva de secadora o silo de descarga.",
        obligatorio: false
      });
    }

    // Detectar parámetros físicos vacíos en la fotografía que requieren confirmación
    // NOTA: % Grano Entero y % Remoción NO se incluyen aquí porque son cálculos automáticos matemáticos
    const parametrosVaciosDetectados: ParametroVacioFoto[] = [];

    if (impurezas === undefined) {
      parametrosVaciosDetectados.push({
        campo: "IMPUREZS",
        label: "% Impurezas",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en el documento físico.",
        esDefecto: true
      });
    }

    if (bPulido === undefined) {
      parametrosVaciosDetectados.push({
        campo: "B. PULIDO",
        label: "Blancura de Pulido",
        unidad: "°BL",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Pendiente de ensayo de pulido en laboratorio.",
        esLaboratorio: true
      });
    }

    if (tPunt === undefined) {
      parametrosVaciosDetectados.push({
        campo: "T. PUNT.",
        label: "% Tiza Puntual",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en la ficha física.",
        esDefecto: true
      });
    }

    if (gr === undefined) {
      parametrosVaciosDetectados.push({
        campo: "GR",
        label: "% Grano Rojo",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Sin valor o con raya en la ficha física.",
        esDefecto: true
      });
    }

    if (m === undefined) {
      parametrosVaciosDetectados.push({
        campo: "MANCHADO",
        label: "% Mancha / Manchado",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en la ficha física.",
        esDefecto: true
      });
    }

    if (tz === undefined) {
      parametrosVaciosDetectados.push({
        campo: "TZ",
        label: "% Trizado",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en la ficha física.",
        esDefecto: true
      });
    }

    if (gi === undefined) {
      parametrosVaciosDetectados.push({
        campo: "GI",
        label: "% Grano Inmaduro",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en la ficha física.",
        esDefecto: true
      });
    }

    if (gv === undefined) {
      parametrosVaciosDetectados.push({
        campo: "GV",
        label: "% Grano Verde",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en la ficha física.",
        esDefecto: true
      });
    }

    if (tt === undefined) {
      parametrosVaciosDetectados.push({
        campo: "TT",
        label: "% Tiza Total",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en la ficha física.",
        esDefecto: true
      });
    }

    if (tp === undefined) {
      parametrosVaciosDetectados.push({
        campo: "TP",
        label: "% Tiza Parcial",
        unidad: "%",
        estado: "PENDIENTE",
        valor: undefined,
        motivo: "Casilla vacía en la ficha física.",
        esDefecto: true
      });
    }

    const formatoNombre = data.NRO_FICHA
      ? `Ficha Don Julio: Análisis Físicos (Nº ${data.NRO_FICHA})`
      : `Fotografía de Ticket / Boleta de Ingreso (${tipoFormato})`;

    const listaCamposDetectados: string[] = [
      `Código de Lote: ${normalizedLoteId}`,
      cliente ? `Cliente: ${cliente}` : "",
      variedad ? `Variedad: ${variedad}` : "",
      sacos ? `Cantidad: ${sacos} Sacos` : "",
      Object.keys(loadedCaladas).filter(k => !!loadedCaladas[k]).length > 0
        ? `Humedad: ${Object.keys(loadedCaladas).filter(k => !!loadedCaladas[k]).length} caladas registradas (Prom: ${data.HUMEDAD || 0}%)`
        : "",
      ri > 0 && rb > 0 ? `Rendimientos: RI ${ri}%, RB ${rb}%, RM ${rm ?? 0}% (Cálculo Auto: RI - RB), QB ${qb ?? 0}%` : "",
      entero > 0 ? `Grano Entero: ${entero}% (Cálculo Auto: RB - %Quebrado)` : "",
      bInt > 0 ? `Blancura Integral: ${bInt}` : ""
    ].filter(Boolean);

    // Configurar panel interactivo de completado que se muestra en el formulario tras subir foto
    setOcrPostUploadPanel({
      active: true,
      formatoNombre,
      photoUrl: imagenUrl || uploadedPhotoUrl || null,
      camposDetectados: listaCamposDetectados,
      rawLoteId: rawLote,
      isCodigoDuplicado
    });

    // Abrir DIRECTAMENTE el Formulario de Ingreso autocompletado para terminar de llenar y guardar
    setActiveMode("nuevo_unificado");
    setFormStep("step_lote");
    setHighlightRedMissing(true);

    // Guardar estado de solicitudFaltantes con isOpen: false para no bloquear la pantalla con modal emergente
    setSolicitudFaltantes({
      isOpen: false,
      loteId: normalizedLoteId,
      rawLoteId: rawLote,
      isCodigoDuplicado,
      loteExistenteDuplicado: existingLote || null,
      tipoFormato,
      formatoNombre,
      cliente: cliente,
      sacos: sacos || 0,
      pesoKg: pesoKg || 0,
      zona: zona || "",
      ubicacion: ubicacion || "",
      variedad: variedad || "Tinajones Extra",
      fecha: fecha,
      observaciones: data.OBSERVACIONES || "",
      caladas: loadedCaladas,
      analisis: {
        LOTE_ID: normalizedLoteId,
        FECHA_ANALISIS: fecha,
        VARIEDAD: variedad,
        HUMEDADES: data.HUMEDAD ? Number(data.HUMEDAD) : 0,
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
        "B. PULIDO": bPulido,
        OLOR: normalizeOrganolepticoNP(data.OLOR) || "N",
        PALOTE: normalizeOrganolepticoNP(data.PALOTE) || (data.PALOTE !== undefined && data.PALOTE !== null && data.PALOTE !== "" ? (isNaN(Number(data.PALOTE)) ? data.PALOTE : Number(data.PALOTE)) : "N"),
        VANO: normalizeOrganolepticoNP(data.VANO) || (data.VANO !== undefined && data.VANO !== null && data.VANO !== "" ? (isNaN(Number(data.VANO)) ? data.VANO : Number(data.VANO)) : "N"),
        IMPUREZS: impurezas,
        HONGO: normalizeOrganolepticoNP(data.HONGO) || (data.HONGO !== undefined && data.HONGO !== null && data.HONGO !== "" ? (isNaN(Number(data.HONGO)) ? data.HONGO : Number(data.HONGO)) : "N"),
        "F. CARBON": normalizeOrganolepticoNP(data["F. CARBON"]) || (data["F. CARBON"] !== undefined && data["F. CARBON"] !== null && data["F. CARBON"] !== "" ? (isNaN(Number(data["F. CARBON"])) ? data["F. CARBON"] : Number(data["F. CARBON"])) : "N"),
        OBSERVACIONES: data.OBSERVACIONES || (rawLote ? `Datos cargados desde fotografía (${tipoFormato}).` : `Ingreso por fotografía.`)
      },
      camposFaltantes: camposFaltantesDetectados,
      parametrosVacios: parametrosVaciosDetectados,
      camposDetectados: listaCamposDetectados,
      errorValidacion: isCodigoDuplicado 
        ? `⛔ BLOQUEO OPERATIVO: El código "${rawLote}" (${normalizedLoteId}) extraído de la fotografía ya está registrado en el sistema. Modifique o asigne un código único.`
        : null,
      imagenPreview: imagenUrl || uploadedPhotoUrl || null
    });

    if (isCodigoDuplicado) {
      setValidationError(`⛔ El código de lote "${rawLote}" ya está registrado en el sistema. Modifique el código o pulse 'Asignar código disponible' para continuar.`);
    } else {
      if (normalizedLoteId && normalizedLoteId !== "0") {
        setSaveSuccessMsg(`📸 ¡Formulario autocompletado para lote ${normalizedLoteId}! Complete los campos pendientes en el panel superior para guardar.`);
      } else {
        setSaveSuccessMsg(`📸 ¡Fotografía cargada y autocompletada! Complete los campos faltantes para generar el lote.`);
      }
    }
  };

  useEffect(() => {
    if (pendingOCRData && pendingOCRData.data) {
      applyIncomingOCRData(pendingOCRData.tipoFormato, pendingOCRData.data, pendingOCRData.imagenUrl);
      if (onClearPendingOCR) onClearPendingOCR();
    }
  }, [pendingOCRData]);

  // Manejador para abrir directamente el selector de archivo / cámara al pulsar Subir Foto
  const handleDirectUploadPhotoClick = () => {
    if (!canUseOCR) {
      setValidationError(obtenerMensajeRestriccion("usar_ocr_documentos"));
      return;
    }
    if (directPhotoInputRef.current) {
      directPhotoInputRef.current.click();
    } else if (onOpenOCR) {
      onOpenOCR();
    }
  };

  // Procesamiento directo de la foto con IA y llenado automático del lote
  const handleDirectPhotoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDirectProcessingPhoto(true);
    setValidationError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUploadedPhotoUrl(base64);

      try {
        let json: any = null;
        try {
          const resp = await fetch("/api/ai/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: file.type || "image/jpeg",
              tipoDocumento: "FOTOGRAFIA_INGRESO"
            })
          });
          if (resp.ok) {
            json = await resp.json();
          }
        } catch (fetchErr) {
          console.warn("[Direct Photo] Server OCR fetch error:", fetchErr);
        }

        const rawExtracted = json?.datos_extraidos || json?.data || {};
        const tipoDetectado = json?.tipo_detectado || "FOTOGRAFIA_INGRESO";
        
        if (Array.isArray(json?.filas_lotes) && json.filas_lotes.length > 0) {
          setMultiLotesFromPhoto(json.filas_lotes);
          setSelectedMultiLoteIndex(0);
          applyIncomingOCRData("TABLA_EXCEL_INGRESO", json.filas_lotes[0], base64);
          setSaveSuccessMsg(`📸 ¡Tabla de Excel detectada! Se extrajeron ${json.filas_lotes.length} lotes de la imagen.`);
        } else {
          setMultiLotesFromPhoto(null);
          applyIncomingOCRData(tipoDetectado, rawExtracted, base64);
          if (json?.aviso) {
            setSaveSuccessMsg(`📸 Fotografía lista. ${json.aviso}`);
          } else {
            setSaveSuccessMsg("📸 ¡Fotografía cargada! Revise los datos extraídos y complete los campos requeridos.");
          }
        }
      } catch (err: any) {
        console.warn("Direct photo processing:", err);
        applyIncomingOCRData("FOTOGRAFIA_INGRESO", {}, base64);
        setSaveSuccessMsg("📸 Fotografía recibida. Por favor ingrese los datos del documento en el formulario.");
      } finally {
        setIsDirectProcessingPhoto(false);
        if (directPhotoInputRef.current) directPhotoInputRef.current.value = "";
        if (directCameraInputRef.current) directCameraInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      setIsDirectProcessingPhoto(false);
      setValidationError("Error al leer el archivo de fotografía.");
      if (directPhotoInputRef.current) directPhotoInputRef.current.value = "";
      if (directCameraInputRef.current) directCameraInputRef.current.value = "";
    };

    reader.readAsDataURL(file);
  };

  // Ejecución segura del bulk import tras validación / completado de datos
  const executeExcelBulkImport = async (payload: Record<string, any[]>, fileName?: string) => {
    setIsDirectProcessingExcel(true);
    setValidationError(null);

    try {
      // Guardar e integrar en LocalDB con soporte de Upsert Inteligente
      const result = localDB.bulkImport(payload, currentUser?.nombre || "Operador");
      const stats = result.stats || {};

      // Sincronizar en Express backend para guardar en disco
      try {
        await fetch("/api/excel/bulk-upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (beErr) {
        console.warn("[Recepcion] Express bulk sync warning:", beErr);
      }

      // Sincronizar en Firestore los registros normalizados de result.db (sin propiedades sombra crudas del Excel)
      try {
        const importedLoteIds = new Set(
          (payload.lotes || [])
            .map((l: any) => formatLoteCode(l?.LOTE_ID || l?.CODIGO || l?.Codigo || ""))
            .filter(Boolean)
        );
        const normalizedLotes = (result.db?.lotes || []).filter((l: any) => importedLoteIds.has(formatLoteCode(l.LOTE_ID)));
        const normalizedHum = (result.db?.registroHumedad || []).filter((h: any) => importedLoteIds.has(formatLoteCode(h.LOTE_ID)));
        const normalizedAH = (result.db?.analisisHumedo || []).filter((a: any) => importedLoteIds.has(formatLoteCode(a.LOTE_ID)));

        await cloudSyncService.syncImportedDataset({
          lotes: normalizedLotes,
          registroHumedad: normalizedHum,
          analisisHumedo: normalizedAH
        });
      } catch (csErr) {
        console.warn("[Recepcion] Cloud sync push warning:", csErr);
      }

      // Notificar éxito detallado
      const totalProcesados = (stats.lotesNuevos || 0) + (stats.lotesActualizados || 0);
      setSaveSuccessMsg(`📊 ¡Excel sincronizado con éxito! Se procesaron ${totalProcesados} lotes (${stats.lotesNuevos || 0} nuevos agregados, ${stats.lotesActualizados || 0} actualizados) con ${stats.humedadesSincronizadas || 0} registros de humedad M1-M14 y análisis físico.`);
      
      // Disparar evento para que todos los componentes refresquen la lista
      window.dispatchEvent(new CustomEvent("localdb_change", { detail: { timestamp: Date.now() } }));
    } catch (err: any) {
      console.error("Error importando Excel directamente:", err);
      setValidationError("Error al procesar el archivo Excel: " + (err.message || "Formato no compatible."));
    } finally {
      setIsDirectProcessingExcel(false);
      setShowDirectExcelMissingModal(false);
      setDirectExcelPendingPayload(null);
      setDirectExcelMissingSummary(null);
      setDirectExcelPendingRows([]);
      if (directExcelInputRef.current) directExcelInputRef.current.value = "";
    }
  };

  // Procesamiento directo y actualización continua desde archivo Excel (.xlsx, .xls, .csv)
  const handleDirectExcelSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDirectProcessingExcel(true);
    setValidationError(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetNames = wb.SheetNames;
      if (sheetNames.length === 0) {
        throw new Error("El archivo Excel no contiene hojas legibles.");
      }

      const payload: Record<string, any[]> = {};
      sheetNames.forEach((sName) => {
        const rows = parseSheetToRows(wb.Sheets[sName]);
        if (rows.length > 0) {
          const upper = sName.trim().toUpperCase();
          const firstRow = (rows[0] || {}) as Record<string, any>;
          const colKeys = Object.keys(firstRow).map((k) => k.trim().toUpperCase());

          const hasLoteCol = colKeys.some((k) =>
            k === "CODIGO" || k === "CÓDIGO" || k === "LOTE" || k === "LOTE_ID" || k === "ID" || k === "TICKET" || k.includes("LOTE")
          );
          const hasClienteCol = colKeys.some((k) =>
            k.includes("CLIENT") || k.includes("PRODUCT") || k.includes("AGRICULT") || k.includes("PROVEED") || k.includes("SEÑOR") || k.includes("NOMBRE")
          );
          const hasCaladasCol = colKeys.some((k) => /^M\d+$/.test(k) || /^H\d+$/.test(k));
          const hasSacosCol = colKeys.some((k) => k.includes("SACO") || k.includes("CANT") || k.includes("BULT") || k.includes("PESO"));
          const hasPhysicalCol = colKeys.some((k) => k === "RI" || k === "RB" || k === "QB" || k === "QI" || k === "Q" || k === "TT" || k === "TP" || k === "BLI");

          if (upper.includes("LOTE") || hasLoteCol || (hasClienteCol && (hasSacosCol || hasCaladasCol))) {
            payload.lotes = rows;
          } else if (upper.includes("HUMEDAD") || upper.includes("REGIS") || upper.includes("CALADA") || hasCaladasCol) {
            payload.humedades = rows;
            payload.registroHumedad = rows;
          } else if (upper.includes("HUMEDO") || upper.includes("HÚMEDO") || upper.includes("ANALISIS_H") || upper.includes("ANALISIS FISICO") || hasPhysicalCol) {
            payload.analisisHum = rows;
            payload.analisisHumedo = rows;
          } else {
            if (!payload.lotes) payload.lotes = rows;
          }
        }
      });

      if (!payload.lotes && (payload.analisisHum || payload.analisisHumedo)) {
        payload.lotes = payload.analisisHum || payload.analisisHumedo;
      }

      if (!payload.lotes || payload.lotes.length === 0) {
        throw new Error("No se encontraron filas de lotes en el archivo Excel seleccionado.");
      }

      // Detección rigurosa de datos faltantes para solicitar al usuario y no inventar datos ficticios
      const missing = detectMissingFieldsInRows(payload.lotes);
      if (
        missing.missingLoteIdCount > 0 ||
        missing.missingCliente ||
        missing.missingFecha ||
        missing.missingSacos ||
        missing.missingPeso ||
        missing.missingVariedad
      ) {
        setDirectExcelPendingPayload(payload);
        setDirectExcelPendingFileName(file.name);
        setDirectExcelMissingSummary(missing);
        setDirectExcelPendingRows(payload.lotes);
        setShowDirectExcelMissingModal(true);
        setIsDirectProcessingExcel(false);
        return;
      }

      // Si no faltan datos, ejecutar importación directa
      await executeExcelBulkImport(payload, file.name);
    } catch (err: any) {
      console.error("Error importando Excel directamente:", err);
      setValidationError("Error al procesar el archivo Excel: " + (err.message || "Formato no compatible."));
      setIsDirectProcessingExcel(false);
      if (directExcelInputRef.current) directExcelInputRef.current.value = "";
    }
  };

  // Importar automáticamente todos los lotes reconocidos en una captura de tabla Excel
  const handleImportAllMultiLotes = async () => {
    if (!multiLotesFromPhoto || multiLotesFromPhoto.length === 0) return;
    setIsSaving(true);
    setValidationError(null);

    let savedCount = 0;
    try {
      for (const item of multiLotesFromPhoto) {
        const rawCode = item.LOTE_ID || item.LOTE || item.CODIGO;
        const normCode = normalizeLoteId(rawCode);
        if (!normCode || normCode === "0") continue;

        const cliente = (item.CLIENTE || "").toString().trim().toUpperCase();
        const variedad = (item.VARIEDAD || "").toString().trim();
        const sacos = Number(item.SACOS || 0);
        const pesoKg = Number(item.PESO_KG || 0);
        const hum = Number(item.HUMEDAD || 0);

        // 1. Guardar Lote
        await onSaveLote({
          LOTE_ID: normCode,
          CLIENTE: cliente,
          VARIEDAD: variedad,
          FECHA_INGRESO: new Date().toISOString().split("T")[0],
          SACOS: sacos,
          PESO_KG: pesoKg,
          HUM: hum || undefined,
          ESTADO_LOTE: "INGRESADO",
          OBSERVACIONES: item.OBSERVACIONES || "Importado desde captura de tabla de Excel"
        });

        // 2. Guardar Humedad si hay caladas
        const caladasData = item.caladas || {};
        const mValues: Record<string, number> = {};
        for (let i = 1; i <= 14; i++) {
          const val = caladasData[`M${i}`];
          if (val !== undefined && val !== null && val !== "") {
            mValues[`M${i}`] = Number(val);
          }
        }
        await onSaveHumedad({
          "ID ANALISIS": `HUM-${normCode}`,
          LOTE_ID: normCode,
          FECHA_ANALISIS: new Date().toISOString().split("T")[0],
          "H. PROMEDIO": hum || 0,
          "DESV.": Number(item.DESVIACION || 0),
          ...mValues
        });

        // 3. Guardar Análisis Físico Húmedo
        const ri = Number(item.RI || 0);
        const rb = Number(item.RB || 0);
        const qb = Number(item.QB || 0);
        const qi = Number(item.QI || 0);
        const queb = qb > 0 ? qb : qi;
        const rm = (ri > 0 || rb > 0) ? Number((ri - rb).toFixed(2)) : 0;
        const entero = (rb > 0 && queb > 0) ? Number((rb - queb).toFixed(2)) : (rb > 0 ? rb : 0);

        await onSaveAnalisisHum({
          ANALISIS_HUMEDO_ID: `AH-${normCode}`,
          LOTE_ID: normCode,
          FECHA_ANALISIS: new Date().toISOString().split("T")[0],
          VARIEDAD: variedad,
          HUMEDADES: hum || 0,
          RI: ri,
          RB: rb,
          RM: rm,
          QI: qi,
          QB: qb,
          ENTERO: entero,
          TT: Number(item.TT || 0),
          TP: Number(item.TP || 0),
          "T. PUNT.": Number(item.T_PUNT || 0),
          M: Number(item.M || 0),
          MANCHADO: Number(item.MANCHADO || item.M || 0),
          TZ: Number(item.TZ || 0),
          GR: Number(item.GR || 0),
          GI: Number(item.GI || 0),
          GV: Number(item.GV || 0),
          "B.INTEGRAL": Number(item.B_INTEGRAL || 0),
          "B. PULIDO": Number(item["B. PULIDO"] || 0),
          PALOTE: "N",
          VANO: "N",
          IMPUREZS: Number(item.IMPUREZS || 0),
          OLOR: "N",
          "F. CARBON": "N",
          HONGO: "N",
          OBSERVACIONES: item.OBSERVACIONES || "Importado desde captura de tabla de Excel"
        });

        savedCount++;
      }

      setSaveSuccessMsg(`🎉 ¡Éxito! Se importaron ${savedCount} lotes y sus análisis físicos correctamente.`);
      setMultiLotesFromPhoto(null);
      setOcrPostUploadPanel(null);
    } catch (err: any) {
      console.error("Error guardando lotes de tabla:", err);
      setValidationError("Error al guardar algunos lotes de la tabla: " + (err.message || ""));
    } finally {
      setIsSaving(false);
    }
  };

  // Normalize Lote code to C0 standard (e.g. '2020' -> 'C02020', '6986' -> 'C06986', '8432' -> 'C08432')
  const normalizeLoteId = (input?: string): string => {
    return formatLoteCode(input) || "0";
  };

  // Calculate next sequential Lote code (e.g. C02026, C02027) ensuring it never repeats an existing code
  const getNextLoteId = (): string => {
    let maxNum = 2025;
    lotes.forEach((l) => {
      const match = (l.LOTE_ID || "").match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum && n < 99999) maxNum = n;
      }
    });
    let candNum = maxNum + 1;
    let candidate = `C0${candNum}`;
    while (lotes.some((l) => normalizeLoteId(l.LOTE_ID) === candidate)) {
      candNum++;
      candidate = `C0${candNum}`;
    }
    return candidate;
  };

  // Real-time detection of duplicate Lote code (Los códigos de lote no se pueden repetir)
  const currentNormalizedLoteId = useMemo(() => {
    if (!loteForm.LOTE_ID || loteForm.LOTE_ID === "0") return "0";
    return normalizeLoteId(loteForm.LOTE_ID);
  }, [loteForm.LOTE_ID]);

  const isDuplicateLoteCode = useMemo(() => {
    if (!currentNormalizedLoteId || currentNormalizedLoteId === "0") return false;
    return lotes.some((l) => {
      const norm = normalizeLoteId(l.LOTE_ID);
      if (activeMode === "nuevo_unificado" || !selectedLoteId) {
        return norm === currentNormalizedLoteId;
      }
      return norm === currentNormalizedLoteId && normalizeLoteId(selectedLoteId) !== currentNormalizedLoteId;
    });
  }, [currentNormalizedLoteId, lotes, activeMode, selectedLoteId]);

  // Helper to load existing lote data into forms for editing or viewing
  const loadLoteForDetail = (loteId: string) => {
    setValidationError(null);
    setSaveSuccessMsg(null);
    const normTarget = normalizeLoteId(loteId);
    const lote = lotes.find((l) => normalizeLoteId(l.LOTE_ID) === normTarget || l.LOTE_ID === loteId);
    setSelectedLoteId(lote?.LOTE_ID || loteId);

    if (lote) {
      const loteAny = lote as any;
      const varietyStr = (lote.VARIEDAD || loteAny["Variedad"] || "").toString().trim();
      setLoteForm({
        ...lote,
        LOTE_ID: lote.LOTE_ID,
        FECHA_INGRESO: lote.FECHA_INGRESO || loteAny["Fecha Recepción"] || new Date().toISOString().split("T")[0],
        CLIENTE: lote.CLIENTE || loteAny["Agricultor / Cliente"] || "",
        VARIEDAD: varietyStr,
        SACOS: lote.SACOS !== undefined ? Number(lote.SACOS) : (loteAny["Sacos"] !== undefined ? Number(loteAny["Sacos"]) : 0),
        PESO_KG: lote.PESO_KG !== undefined ? Number(lote.PESO_KG) : (loteAny["Peso (kg)"] !== undefined ? Number(loteAny["Peso (kg)"]) : 0),
        UBICACION: lote.UBICACION || loteAny["Ubicacion"] || lote.ZONA || "",
        ZONA: lote.ZONA || lote.UBICACION || loteAny["Ubicacion"] || "",
        ESTADO_LOTE: lote.ESTADO_LOTE || loteAny["Estado"] || "INGRESADO",
        OBSERVACIONES: lote.OBSERVACIONES || ""
      });

      const matchingStandardVar = VARIEDADES_ARROZ_OPCIONES.find(
        (opt) => opt !== "OTRA" && opt.toUpperCase() === varietyStr.toUpperCase()
      );
      if (matchingStandardVar) {
        setIsCustomVariedad(false);
        setCustomVariedadText("");
        setLoteForm((prev) => ({ ...prev, VARIEDAD: matchingStandardVar }));
      } else if (varietyStr) {
        setIsCustomVariedad(true);
        setCustomVariedadText(varietyStr);
      } else {
        setIsCustomVariedad(false);
        setCustomVariedadText("");
      }
    }

    // Load Humedad (checking both humedades collection and fallback M1..M19 on the Excel-imported lote)
    const hum = humedades.find((h) => normalizeLoteId(h.LOTE_ID) === normTarget || h.LOTE_ID === loteId);
    const loaded: { [key: string]: string } = {};
    let hasAnyCalada = false;
    for (let i = 1; i <= 19; i++) {
      const key = `M${i}`;
      const valHum = hum ? (hum as any)[key] : undefined;
      const valLote = lote ? (lote as any)[key] : undefined;
      const val = (valHum !== undefined && valHum !== null && Number(valHum) > 0)
        ? valHum
        : ((valLote !== undefined && valLote !== null && Number(valLote) > 0) ? valLote : undefined);
      if (val !== undefined) {
        loaded[key] = String(val);
        hasAnyCalada = true;
      } else {
        loaded[key] = "";
      }
    }
    setCaladas(hasAnyCalada ? loaded : getEmptyCaladas());

    // Load Analisis Humedo (checking both analisisHumedos collection and fallback fields on the Excel-imported lote)
    const ah = analisisHumedos.find((a) => normalizeLoteId(a.LOTE_ID) === normTarget || a.LOTE_ID === loteId);
    const srcAn: any = ah || lote || {};
    if (ah || (lote && ((lote as any).RI !== undefined || (lote as any).RB !== undefined || (lote as any).QB !== undefined || (lote as any)["R.I (%)"] !== undefined))) {
      setAnalisisForm({
        ...getEmptyAnalisisState(lote?.LOTE_ID || loteId, lote?.VARIEDAD),
        ...srcAn,
        LOTE_ID: lote?.LOTE_ID || loteId,
        VARIEDAD: srcAn.VARIEDAD || lote?.VARIEDAD || "",
        FECHA_ANALISIS: ah?.FECHA_ANALISIS || lote?.FECHA_INGRESO || new Date().toISOString().split("T")[0],
        RI: srcAn.RI ?? srcAn["R.I (%)"] ?? 0,
        RB: srcAn.RB ?? srcAn["R.B (%)"] ?? 0,
        RM: srcAn.RM ?? srcAn["% Remoción"] ?? 0,
        QI: srcAn.QI ?? srcAn["Q.I (%)"] ?? 0,
        QB: srcAn.QB ?? srcAn["Q.B (%)"] ?? 0,
        ENTERO: srcAn.ENTERO ?? srcAn["Entero (%)"] ?? 0,
        TT: srcAn.TT ?? srcAn["Tiza Total (%)"] ?? 0,
        TP: srcAn.TP ?? srcAn["Tiza Parcial (%)"] ?? 0,
        "T. PUNT.": srcAn["T. PUNT."] ?? srcAn.TPUN ?? srcAn["Tiza Puntual (%)"] ?? 0,
        M: srcAn.M ?? srcAn.MANCHADO ?? srcAn["Mancha (%)"] ?? 0,
        MANCHADO: srcAn.MANCHADO ?? srcAn.M ?? srcAn["Mancha (%)"] ?? 0,
        TZ: srcAn.TZ ?? srcAn["Trizado (%)"] ?? 0,
        GR: srcAn.GR ?? srcAn.ROJO ?? srcAn["Grano Rojo (%)"] ?? 0,
        GI: srcAn.GI ?? srcAn["Grano Inmaduro (%)"] ?? 0,
        GV: srcAn.GV ?? srcAn.VERDE ?? srcAn["Grano Verde (%)"] ?? 0,
        "B.INTEGRAL": srcAn["B.INTEGRAL"] ?? srcAn.BL_INT ?? srcAn["Blancura Int."] ?? 0,
        "B. PULIDO": srcAn["B. PULIDO"] ?? srcAn.BL_BLANCO ?? srcAn["Blancura Pul."] ?? 0,
        PALOTE: srcAn.PALOTE ?? srcAn["Palote"] ?? "N",
        VANO: srcAn.VANO ?? srcAn["Vano"] ?? "N",
        IMPUREZS: srcAn.IMPUREZS ?? srcAn.IMPUREZAS ?? srcAn["Impurezas (%)"] ?? "N",
        OLOR: srcAn.OLOR ?? srcAn["Olor"] ?? "N",
        "F. CARBON": srcAn["F. CARBON"] ?? srcAn.CARBON ?? srcAn["Falso Carbón"] ?? "N",
        HONGO: srcAn.HONGO ?? srcAn["Hongo"] ?? "N",
        "MEZCLA VAR.": srcAn["MEZCLA VAR."] ?? srcAn.MEZCLA ?? srcAn["Mezcla de variedades"] ?? srcAn["Mezcla Var. (%)"] ?? 0,
        CASCADO: srcAn.CASCADO ?? srcAn["Cascado (%)"] ?? 0,
        "PLAGAS-NSEC.": srcAn["PLAGAS-NSEC."] ?? srcAn["PLAGAS-INSEC."] ?? srcAn.PLAGAS ?? srcAn["Plagas / Insec."] ?? 0
      });
    } else {
      setAnalisisForm(getEmptyAnalisisState(lote?.LOTE_ID || loteId, lote?.VARIEDAD));
    }
  };

  const handleStartNewUnifiedLote = () => {
    if (!canEditLotes) {
      setValidationError(obtenerMensajeRestriccion("editar_lotes"));
      return;
    }
    setLoteForm({
      ...getEmptyLoteState(),
      LOTE_ID: "0",
      CLIENTE: "",
      VARIEDAD: "",
      UBICACION: "",
      ZONA: "",
      SACOS: 0,
      PESO_KG: 0,
      HUM: 0,
      ESTADO_LOTE: "INGRESADO"
    });
    setCaladas(getEmptyCaladas());
    setAnalisisForm(getEmptyAnalisisState("0", ""));
    setIsCustomVariedad(false);
    setCustomVariedadText("");
    setSaveSuccessMsg(null);
    setValidationError(null);
    setFormStep("step_lote");
    setActiveMode("nuevo_unificado");
  };

  // Live Auto Calculations for 14 Caladas
  const numericCaladas = Object.values(caladas)
    .map((v) => parseFloat(String(v)))
    .filter((v) => !isNaN(v) && v > 0);

  const caladasCount = numericCaladas.length;
  const promedioHumedad = caladasCount > 0 ? numericCaladas.reduce((a, b) => a + b, 0) / caladasCount : 0;
  const minHumedad = caladasCount > 0 ? Math.min(...numericCaladas) : 0;
  const maxHumedad = caladasCount > 0 ? Math.max(...numericCaladas) : 0;
  const desvHumedad = caladasCount > 1
    ? Math.sqrt(numericCaladas.reduce((acc, val) => acc + Math.pow(val - promedioHumedad, 2), 0) / (caladasCount - 1))
    : 0;

  // Medidas menores o iguales a 10% (Regla de Veto Crítico: si representan > 20% del total de muestras, LOTE RECHAZADO)
  const caladasMenores10 = numericCaladas.filter((v) => v <= 10);
  const countMenores10 = caladasMenores10.length;
  const pctMenores10 = caladasCount > 0 ? (countMenores10 / caladasCount) * 100 : 0;
  const isVetoHumedad10 = caladasCount > 0 && countMenores10 > 0 && pctMenores10 > (evaluacionConfig?.reglasVeto?.maxPctMuestrasHumedadBaja ?? 20);

  // Medidas menores a 17% y su porcentaje sobre el total de muestras tomadas
  const caladasMenores17 = numericCaladas.filter((v) => v < 17);
  const countMenores17 = caladasMenores17.length;
  const pctMenores17 = caladasCount > 0 ? (countMenores17 / caladasCount) * 100 : 0;

  // Auto Calculations for Analisis Humedo: Total Quebrado = QI + QB
  const totalQuebrado = safeNumber(analisisForm.QI, 0) + safeNumber(analisisForm.QB, 0);

  // Auto calculate Remoción (% REM = RI - RB)
  const numRI = safeNumber(analisisForm.RI, NaN);
  const numRB = safeNumber(analisisForm.RB, NaN);
  const autoRemocion = (!isNaN(numRI) && !isNaN(numRB))
    ? Number((numRI - numRB).toFixed(2))
    : undefined;

  // Auto calculate Grano Entero (% ENTERO = RB - % Quebrado)
  const numQB = safeNumber(analisisForm.QB, NaN);
  const numQI = safeNumber(analisisForm.QI, NaN);
  const quebradoBlancoForm = !isNaN(numQB)
    ? numQB
    : (!isNaN(numQI) ? numQI : NaN);

  const autoEntero = (!isNaN(numRB) && !isNaN(quebradoBlancoForm))
    ? Number((numRB - quebradoBlancoForm).toFixed(2))
    : undefined;

  // Live Approval Score Evaluation (24 parameters / 100% total)
  const liveEvaluacion = calcularEvaluacionLote(
    {
      ...analisisForm,
      RM: autoRemocion !== undefined ? autoRemocion : analisisForm.RM,
      ENTERO: autoEntero !== undefined ? autoEntero : analisisForm.ENTERO,
    },
    loteForm,
    promedioHumedad,
    desvHumedad,
    evaluacionConfig,
    numericCaladas
  );

  // Live validation on save
  const handleSaveUnified = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);

    if (!canEditLotes) {
      setValidationError(obtenerMensajeRestriccion("editar_lotes"));
      return;
    }

    let effectiveLoteId = (loteForm.LOTE_ID || "").trim();
    if (!effectiveLoteId || effectiveLoteId === "0" || effectiveLoteId === "C00") {
      setHighlightRedMissing(true);
      setValidationError("Por favor ingrese un Código de Lote válido (distinto de 0), pulse 'Generar auto' o suba una fotografía con el código.");
      setFormStep("step_lote");
      return;
    }

    let effectiveCliente = (loteForm.CLIENTE || "").trim();
    if (!effectiveCliente) {
      setHighlightRedMissing(true);
      setValidationError("Por favor ingrese o seleccione el Cliente / Productor para el lote (casilla en rojo).");
      setFormStep("step_lote");
      return;
    }

    let sacosNum = loteForm.SACOS !== undefined && loteForm.SACOS !== null && !isNaN(Number(loteForm.SACOS)) && Number(loteForm.SACOS) > 0
      ? Number(loteForm.SACOS)
      : 0;

    let pesoKgNum = loteForm.PESO_KG !== undefined && loteForm.PESO_KG !== null && !isNaN(Number(loteForm.PESO_KG)) && Number(loteForm.PESO_KG) > 0
      ? Number(loteForm.PESO_KG)
      : 0;

    // Auto-estimación inteligente: Si tiene sacos pero no peso, o viceversa, se calcula a 50 kg/saco estándar
    if (sacosNum > 0 && pesoKgNum <= 0) {
      pesoKgNum = sacosNum * 50;
      setLoteForm((prev) => ({ ...prev, PESO_KG: pesoKgNum }));
    } else if (pesoKgNum > 0 && sacosNum <= 0) {
      sacosNum = Math.max(1, Math.round(pesoKgNum / 50));
      setLoteForm((prev) => ({ ...prev, SACOS: sacosNum }));
    }

    if (sacosNum <= 0 && pesoKgNum <= 0) {
      setHighlightRedMissing(true);
      setValidationError("Por favor ingrese la Cantidad de Sacos o el Peso Total (Kg) del lote (casilla en rojo).");
      setFormStep("step_lote");
      return;
    }

    setHighlightRedMissing(false);

    const targetLoteId = normalizeLoteId(effectiveLoteId);

    // Validación estricta: Los códigos de lote NO se pueden repetir
    const isDuplicate = lotes.some((l) => {
      const existingNorm = normalizeLoteId(l.LOTE_ID);
      if (activeMode === "nuevo_unificado" || !selectedLoteId) {
        return existingNorm === targetLoteId;
      }
      return existingNorm === targetLoteId && normalizeLoteId(selectedLoteId) !== targetLoteId;
    });

    if (isDuplicate) {
      setValidationError(`El código de lote "${targetLoteId}" ya está registrado en el sistema. Los códigos de lote son únicos y no se pueden repetir.`);
      setFormStep("step_lote");
      return;
    }

    setIsSaving(true);
    const selectedVar = isCustomVariedad ? customVariedadText : (loteForm.VARIEDAD || "Tinajones Extra");
    const today = new Date().toISOString().split("T")[0];

    try {
      // 1. Guardar Lote (indicando isNew al backend para validar duplicidad)
      const isNewLote = activeMode === "nuevo_unificado" || !selectedLoteId;
      // La humedad se obtiene automáticamente tras ingresar los parámetros (14 caladas) o se asigna 0 si está pendiente
      const effectiveHum = promedioHumedad > 0
        ? Number(promedioHumedad.toFixed(2))
        : (loteForm.HUM !== undefined && loteForm.HUM !== null && !isNaN(Number(loteForm.HUM)) && Number(loteForm.HUM) > 0
            ? Number(Number(loteForm.HUM).toFixed(2))
            : 0);

      const lotePayload: Partial<Lote> & { isNew?: boolean } = {
        ...loteForm,
        LOTE_ID: targetLoteId,
        CLIENTE: effectiveCliente,
        FECHA_INGRESO: loteForm.FECHA_INGRESO || today,
        VARIEDAD: selectedVar,
        HUM: effectiveHum,
        SACOS: sacosNum,
        PESO_KG: pesoKgNum,
        ESTADO_LOTE: loteForm.ESTADO_LOTE || "INGRESADO",
        isNew: isNewLote
      };
      await onSaveLote(lotePayload);

      // 2. Guardar Registro de Humedad (hasta 19 Caladas) si hay al menos 1 muestra ingresada
      if (caladasCount > 0) {
        const parseCaladaVal = (val: string | number | undefined) => {
          if (val === undefined || val === null || val === "") return undefined;
          const n = parseFloat(String(val).replace(",", "."));
          return !isNaN(n) && n > 0 ? Number(n.toFixed(2)) : undefined;
        };

        const humPayload: Partial<RegistroHumedad> = {
          "ID ANALISIS": `HUM-${targetLoteId}`,
          LOTE_ID: targetLoteId,
          FECHA_ANALISIS: loteForm.FECHA_INGRESO || today,
          M1: parseCaladaVal(caladas.M1),
          M2: parseCaladaVal(caladas.M2),
          M3: parseCaladaVal(caladas.M3),
          M4: parseCaladaVal(caladas.M4),
          M5: parseCaladaVal(caladas.M5),
          M6: parseCaladaVal(caladas.M6),
          M7: parseCaladaVal(caladas.M7),
          M8: parseCaladaVal(caladas.M8),
          M9: parseCaladaVal(caladas.M9),
          M10: parseCaladaVal(caladas.M10),
          M11: parseCaladaVal(caladas.M11),
          M12: parseCaladaVal(caladas.M12),
          M13: parseCaladaVal(caladas.M13),
          M14: parseCaladaVal(caladas.M14),
          M15: parseCaladaVal(caladas.M15),
          M16: parseCaladaVal(caladas.M16),
          M17: parseCaladaVal(caladas.M17),
          M18: parseCaladaVal(caladas.M18),
          M19: parseCaladaVal(caladas.M19),
          "PROM. GENERAL": Number(promedioHumedad.toFixed(2)),
          "H. PROMEDIO": Number(promedioHumedad.toFixed(2)),
          DESVIACION: Number(desvHumedad.toFixed(2)),
          "DESV.": Number(desvHumedad.toFixed(2)),
          "H.MIN.": Number(minHumedad.toFixed(2)),
          "H.MAX": Number(maxHumedad.toFixed(2)),
          HUM_MIN: Number(minHumedad.toFixed(2)),
          HUM_MAX: Number(maxHumedad.toFixed(2)),
          OBSERVACIONES: loteForm.OBSERVACIONES || ""
        };
        await onSaveHumedad(humPayload);
      }

      // 3. Guardar Análisis Físico Húmedo si hay datos de rendimientos, defectos (como Grano Verde GV) u organolépticos
      const hasAnyAnalisisData = 
        analisisForm.GV !== undefined ||
        analisisForm.GI !== undefined ||
        analisisForm.GR !== undefined ||
        analisisForm.TZ !== undefined ||
        analisisForm.M !== undefined ||
        analisisForm.MANCHADO !== undefined ||
        analisisForm.TT !== undefined ||
        analisisForm.TP !== undefined ||
        analisisForm["T. PUNT."] !== undefined ||
        analisisForm.QI !== undefined ||
        analisisForm.QB !== undefined ||
        analisisForm.RI !== undefined ||
        analisisForm.RB !== undefined ||
        analisisForm.RM !== undefined ||
        analisisForm.ENTERO !== undefined ||
        analisisForm["B.INTEGRAL"] !== undefined ||
        analisisForm["B. PULIDO"] !== undefined ||
        analisisForm.IMPUREZS !== undefined ||
        analisisForm.PALOTE !== undefined ||
        analisisForm.VANO !== undefined ||
        analisisForm.OLOR !== undefined ||
        analisisForm["F. CARBON"] !== undefined ||
        analisisForm.HONGO !== undefined ||
        autoRemocion !== undefined ||
        autoEntero !== undefined ||
        Boolean(analisisForm.OBSERVACIONES && analisisForm.OBSERVACIONES.trim());

      if (hasAnyAnalisisData) {
        const anPayload: Partial<AnalisisHumedo> = {
          ...analisisForm,
          ANALISIS_HUMEDO_ID: `AH-${targetLoteId}`,
          RM: autoRemocion,
          ENTERO: autoEntero,
          LOTE_ID: targetLoteId,
          FECHA_ANALISIS: analisisForm.FECHA_ANALISIS || today,
          VARIEDAD: selectedVar,
          HUMEDADES: effectiveHum
        };
        await onSaveAnalisisHum(anPayload);
      }

      setSaveSuccessMsg(`¡Lote ${targetLoteId} guardado exitosamente! Registrado con ${effectiveHum}% de humedad y ${sacosNum} sacos.`);
      setSelectedLoteId(targetLoteId);
      // Retornar a la lista de lotes
      setActiveMode("catalogo");
      setFormStep("step_lote");
    } catch (err: any) {
      console.error("Error guardando recepción unificada:", err);
      setValidationError(err?.message || "Ocurrió un inconveniente al guardar los datos del lote. Por favor intente nuevamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // Métodos para gestionar la confirmación de parámetros vacíos y corrección de código en carga por fotografía
  const handleCorregirCodigoEnSolicitud = (newCode: string) => {
    const rawClean = newCode.trim();
    const norm = normalizeLoteId(rawClean) || rawClean;
    const existing = rawClean ? lotes.find(l => {
      const normL = normalizeLoteId(l.LOTE_ID);
      const normTarget = normalizeLoteId(norm);
      const normRaw = normalizeLoteId(rawClean);
      return (
        normL === normTarget ||
        normL === normRaw ||
        l.LOTE_ID.toUpperCase() === rawClean.toUpperCase() ||
        l.LOTE_ID.toUpperCase() === norm.toUpperCase()
      );
    }) : undefined;
    const isDup = Boolean(existing);

    setSolicitudFaltantes(prev => {
      if (!prev) return null;
      return {
        ...prev,
        loteId: norm,
        rawLoteId: rawClean,
        isCodigoDuplicado: isDup,
        loteExistenteDuplicado: existing || null,
        errorValidacion: isDup 
          ? `⛔ El código "${rawClean}" ya está registrado en el sistema. No se puede crear dos ingresos con el mismo código.`
          : null
      };
    });
  };

  const handleConfirmarParametroEsCero = (campo: string) => {
    setSolicitudFaltantes(prev => {
      if (!prev) return null;
      const updatedParametros = prev.parametrosVacios.map(p => {
        if (p.campo === campo) {
          return { ...p, estado: "ES_CERO" as const, valor: 0 };
        }
        return p;
      });
      const updatedAnalisis = { ...prev.analisis, [campo]: 0 };
      if (campo === "MANCHADO") updatedAnalisis.M = 0;
      return {
        ...prev,
        parametrosVacios: updatedParametros,
        analisis: updatedAnalisis,
        errorValidacion: null
      };
    });
  };

  const handleIngresarValorParametro = (campo: string, valStr: string) => {
    const parsed = valStr === "" ? undefined : parseFloat(valStr.replace(",", "."));
    setSolicitudFaltantes(prev => {
      if (!prev) return null;
      const updatedParametros = prev.parametrosVacios.map(p => {
        if (p.campo === campo) {
          return {
            ...p,
            estado: valStr === "" ? ("PENDIENTE" as const) : ("INGRESADO" as const),
            valor: valStr
          };
        }
        return p;
      });
      const updatedAnalisis = { ...prev.analisis, [campo]: parsed };
      if (campo === "MANCHADO") updatedAnalisis.M = parsed;
      return {
        ...prev,
        parametrosVacios: updatedParametros,
        analisis: updatedAnalisis,
        errorValidacion: null
      };
    });
  };

  const handleDejarPendienteLaboratorio = (campo: string) => {
    setSolicitudFaltantes(prev => {
      if (!prev) return null;
      const updatedParametros = prev.parametrosVacios.map(p => {
        if (p.campo === campo) {
          return { ...p, estado: "DEJADO_PENDIENTE" as const, valor: undefined };
        }
        return p;
      });
      const updatedAnalisis = { ...prev.analisis, [campo]: undefined };
      return {
        ...prev,
        parametrosVacios: updatedParametros,
        analisis: updatedAnalisis,
        errorValidacion: null
      };
    });
  };

  const handleMarcarTodosDefectosCero = () => {
    setSolicitudFaltantes(prev => {
      if (!prev) return null;
      const updatedAnalisis = { ...prev.analisis };
      const updatedParametros = prev.parametrosVacios.map(p => {
        if (p.campo !== "ENTERO" && p.campo !== "B. PULIDO") {
          (updatedAnalisis as any)[p.campo] = 0;
          if (p.campo === "MANCHADO") updatedAnalisis.M = 0;
          return { ...p, estado: "ES_CERO" as const, valor: 0 };
        }
        return p;
      });
      return {
        ...prev,
        parametrosVacios: updatedParametros,
        analisis: updatedAnalisis,
        errorValidacion: null
      };
    });
  };

  const handleRestablecerParametrosVacios = () => {
    setSolicitudFaltantes(prev => {
      if (!prev) return null;
      const updatedAnalisis = { ...prev.analisis };
      const updatedParametros = prev.parametrosVacios.map(p => {
        delete (updatedAnalisis as any)[p.campo];
        return { ...p, estado: "PENDIENTE" as const, valor: undefined };
      });
      return {
        ...prev,
        parametrosVacios: updatedParametros,
        analisis: updatedAnalisis,
        errorValidacion: null
      };
    });
  };

  // Manejador para validar y guardar de inmediato cuando se completa la información faltante solicitada tras cargar foto
  const handleGuardarDesdeSolicitudFaltantes = async () => {
    if (!solicitudFaltantes) return;

    // VALIDACIÓN CRÍTICA 1: Duplicidad de Código de Lote (No se permite crear dos ingresos con el mismo código)
    const targetLoteId = normalizeLoteId(solicitudFaltantes.loteId) || (solicitudFaltantes.loteId || "").trim();
    const isDup = lotes.some(l => {
      const normL = normalizeLoteId(l.LOTE_ID);
      const normT = normalizeLoteId(targetLoteId);
      const normRaw = normalizeLoteId(solicitudFaltantes.rawLoteId);
      return (
        normL === normT ||
        normL === normRaw ||
        l.LOTE_ID.toUpperCase() === targetLoteId.toUpperCase() ||
        (solicitudFaltantes.rawLoteId && l.LOTE_ID.toUpperCase() === solicitudFaltantes.rawLoteId.toUpperCase())
      );
    });

    if (isDup || solicitudFaltantes.isCodigoDuplicado) {
      setSolicitudFaltantes(prev => prev ? ({
        ...prev,
        isCodigoDuplicado: true,
        errorValidacion: `⛔ BLOQUEO OPERATIVO: El código de lote "${targetLoteId}" ya se encuentra registrado en el sistema. No se puede crear dos ingresos con el mismo código.`
      }) : null);
      return;
    }

    const clienteTrim = (solicitudFaltantes.cliente || "").trim();
    if (!clienteTrim) {
      setSolicitudFaltantes(prev => prev ? ({ ...prev, errorValidacion: "El Cliente / Productor es obligatorio para registrar el lote." }) : null);
      return;
    }

    const sacosNum = Number(solicitudFaltantes.sacos);
    if (isNaN(sacosNum) || sacosNum <= 0) {
      setSolicitudFaltantes(prev => prev ? ({ ...prev, errorValidacion: "Debe ingresar una Cantidad de Sacos válida (> 0) antes de guardar." }) : null);
      return;
    }

    const pesoKgNum = Number(solicitudFaltantes.pesoKg);
    if (isNaN(pesoKgNum) || pesoKgNum <= 0) {
      setSolicitudFaltantes(prev => prev ? ({ ...prev, errorValidacion: "⚠️ Debe ingresar el Peso Total Balanza (Kg) (> 0) antes de guardar el ingreso." }) : null);
      return;
    }

    // VALIDACIÓN 2: Confirmar parámetros vacíos pendientes
    const pendientesSinDecidir = solicitudFaltantes.parametrosVacios.filter(p => p.estado === "PENDIENTE" && !p.esLaboratorio);
    if (pendientesSinDecidir.length > 0) {
      setSolicitudFaltantes(prev => prev ? ({
        ...prev,
        errorValidacion: `⚠️ Hay ${pendientesSinDecidir.length} casilla(s) vacía(s) de la foto sin confirmar: (${pendientesSinDecidir.map(p => p.label).join(", ")}). Por favor confirme si es Cero (0.00) o ingrese el valor si se olvidaron de registrar.`
      }) : null);
      return;
    }

    setIsSaving(true);
    const today = solicitudFaltantes.fecha || new Date().toISOString().split("T")[0];

    try {
      // 1. Guardar Lote
      const lotePayload: Partial<Lote> & { isNew?: boolean } = {
        LOTE_ID: targetLoteId,
        CLIENTE: clienteTrim,
        FECHA_INGRESO: today,
        VARIEDAD: solicitudFaltantes.variedad || "Tinajones Extra",
        SACOS: sacosNum,
        PESO_KG: pesoKgNum,
        ZONA: solicitudFaltantes.zona || "",
        UBICACION: solicitudFaltantes.ubicacion || "",
        ESTADO_LOTE: "INGRESADO",
        HUM: promedioHumedad > 0 ? Number(promedioHumedad.toFixed(2)) : 18.2,
        OBSERVACIONES: solicitudFaltantes.observaciones || `Ingreso cargado por fotografía con datos faltantes completados por el usuario.`,
        isNew: true
      };
      await onSaveLote(lotePayload);

      // 2. Guardar Caladas
      const caladasKeys = Object.keys(solicitudFaltantes.caladas || {});
      if (caladasKeys.length > 0) {
        const parseVal = (v: any) => (v === undefined || v === null || v === "" ? 0 : parseFloat(String(v).replace(",", ".")) || 0);
        const humPayload: Partial<RegistroHumedad> = {
          LOTE_ID: targetLoteId,
          FECHA_ANALISIS: today,
          M1: parseVal(solicitudFaltantes.caladas.M1),
          M2: parseVal(solicitudFaltantes.caladas.M2),
          M3: parseVal(solicitudFaltantes.caladas.M3),
          M4: parseVal(solicitudFaltantes.caladas.M4),
          M5: parseVal(solicitudFaltantes.caladas.M5),
          M6: parseVal(solicitudFaltantes.caladas.M6),
          M7: parseVal(solicitudFaltantes.caladas.M7),
          M8: parseVal(solicitudFaltantes.caladas.M8),
          M9: parseVal(solicitudFaltantes.caladas.M9),
          M10: parseVal(solicitudFaltantes.caladas.M10),
          M11: parseVal(solicitudFaltantes.caladas.M11),
          M12: parseVal(solicitudFaltantes.caladas.M12),
          M13: parseVal(solicitudFaltantes.caladas.M13),
          M14: parseVal(solicitudFaltantes.caladas.M14),
          "H. PROMEDIO": promedioHumedad > 0 ? Number(promedioHumedad.toFixed(2)) : 18.2,
          "DESV.": Number(desvHumedad.toFixed(2)) || 0.35,
          "H.MIN.": Number(minHumedad.toFixed(2)) || 14.6,
          "H.MAX": Number(maxHumedad.toFixed(2)) || 23.1,
          OBSERVACIONES: `Humedad de 14 caladas digitalizada desde fotografía.`
        };
        await onSaveHumedad(humPayload);
      }

      // 3. Guardar Análisis (con RM y ENTERO estrictamente calculados por fórmula matemática)
      if (solicitudFaltantes.analisis) {
        const an = solicitudFaltantes.analisis;
        const numRI = Number(an.RI);
        const numRB = Number(an.RB);
        const numQB = an.QB !== undefined ? Number(an.QB) : (an.QI !== undefined ? Number(an.QI) : undefined);
        const autoRm = (!isNaN(numRI) && !isNaN(numRB)) ? Number((numRI - numRB).toFixed(2)) : undefined;
        const autoEnt = (!isNaN(numRB) && numQB !== undefined && !isNaN(numQB)) ? Number((numRB - numQB).toFixed(2)) : undefined;

        await onSaveAnalisisHum({
          ...solicitudFaltantes.analisis,
          RM: autoRm,
          ENTERO: autoEnt,
          LOTE_ID: targetLoteId,
          FECHA_ANALISIS: today,
          VARIEDAD: solicitudFaltantes.variedad
        });
      }

      setLoteForm(lotePayload);
      setSolicitudFaltantes(null);
      setSaveSuccessMsg(`📸 ¡Ingreso registrado con éxito! El lote ${targetLoteId} (${clienteTrim}) fue guardado con ${sacosNum} sacos y ${pesoKgNum.toLocaleString()} kg.`);
      setSelectedLoteId(targetLoteId);
      setActiveMode("catalogo");
    } catch (err: any) {
      console.error("Error al guardar desde solicitud de faltantes:", err);
      setSolicitudFaltantes(prev => prev ? ({ ...prev, errorValidacion: err?.message || "Ocurrió un error al guardar los datos del lote." }) : null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinuarEnFormularioDetallado = () => {
    if (!solicitudFaltantes) return;
    setLoteForm(prev => ({
      ...prev,
      LOTE_ID: solicitudFaltantes.loteId,
      CLIENTE: solicitudFaltantes.cliente,
      SACOS: Number(solicitudFaltantes.sacos) || undefined,
      PESO_KG: Number(solicitudFaltantes.pesoKg) || undefined,
      ZONA: solicitudFaltantes.zona,
      UBICACION: solicitudFaltantes.ubicacion,
      VARIEDAD: solicitudFaltantes.variedad,
      FECHA_INGRESO: solicitudFaltantes.fecha
    }));
    setSolicitudFaltantes(null);
    setActiveMode("nuevo_unificado");
    setFormStep("step_lote");
    setSaveSuccessMsg("Datos cargados en el formulario unificado. Recuerde completar cualquier dato faltante antes de guardar.");
  };

  // Pre-calculate evaluation for all lots to support instant filtering, metrics and UI badges
  const lotesConCalidad = useMemo(() => {
    return lotes.map((lote) => {
      const humRec = humedades.find((h) => h.LOTE_ID === lote.LOTE_ID);
      const anRec = analisisHumedos.find((a) => a.LOTE_ID === lote.LOTE_ID);

      const avgHum = humRec?.["H. PROMEDIO"] || lote.HUM || 0;
      const cardDesv = humRec?.["DESV."] || lote.DESV || 0;
      const hasCaladas = !!humRec;

      const cardCaladas = [
        humRec?.M1, humRec?.M2, humRec?.M3, humRec?.M4, humRec?.M5, humRec?.M6, humRec?.M7,
        humRec?.M8, humRec?.M9, humRec?.M10, humRec?.M11, humRec?.M12, humRec?.M13, humRec?.M14
      ].map((v) => parseFloat(String(v))).filter((v) => !isNaN(v) && v > 0);

      const cardCaladasCount = cardCaladas.length;
      const cardMenores17 = cardCaladas.filter((v) => v < 17).length;
      const cardPctMenores17 = cardCaladasCount > 0 ? (cardMenores17 / cardCaladasCount) * 100 : 0;
      const cardMenores10 = cardCaladas.filter((v) => v <= 10).length;
      const cardPctMenores10 = cardCaladasCount > 0 ? (cardMenores10 / cardCaladasCount) * 100 : 0;
      const cardVetoHum10 = cardCaladasCount > 0 && cardMenores10 > 0 && cardPctMenores10 > (evaluacionConfig?.reglasVeto?.maxPctMuestrasHumedadBaja ?? 20);

      const evalResult = calcularEvaluacionLote(anRec || undefined, lote, avgHum, cardDesv, evaluacionConfig, cardCaladas);

      const est = (evalResult.estadoAprobacion || "").toUpperCase();
      const loteEst = (lote.ESTADO_LOTE || "").toUpperCase();

      const hasAutorizacionExp = Boolean(
        lote.ES_EXPERIMENTAL ||
        lote.AUTORIZACION_EXPERIMENTAL ||
        (lote as any).autorizacionExperimental ||
        loteEst === "EXPERIMENTAL" ||
        loteEst === "APTO EXPERIMENTAL"
      );

      const isApto = !hasAutorizacionExp && !evalResult.tieneVetoCritico && (est === "APROBADO" || loteEst === "APROBADO");
      const isObs = !hasAutorizacionExp && !evalResult.tieneVetoCritico && (
        est === "OBSERVADO" || 
        est === "OBSERVADOS" || 
        est === "EN OBSERVACION" || 
        loteEst === "OBSERVADO"
      );
      const isExp = hasAutorizacionExp || (!evalResult.tieneVetoCritico && (
        est === "EXPERIMENTAL" || 
        est === "CON RIESGO" || 
        loteEst === "EXPERIMENTAL"
      ));
      const isRech = !hasAutorizacionExp && (
        evalResult.tieneVetoCritico || 
        est === "DESAPROBADO" || 
        est === "RECHAZADO" || 
        loteEst === "RECHAZADO" || 
        loteEst === "DESAPROBADO"
      );

      const hasAnalisisData = !!anRec || hasCaladas || (lote.HUMEDAD !== undefined && Number(lote.HUMEDAD) > 0);

      const estadoNormalizado: "APROBADO" | "OBSERVADO" | "EXPERIMENTAL" | "DESAPROBADO" = isRech 
        ? "DESAPROBADO" 
        : isExp
        ? "EXPERIMENTAL"
        : isObs 
        ? "OBSERVADO" 
        : "APROBADO";

      return {
        lote,
        humRec,
        anRec,
        avgHum,
        cardDesv,
        hasCaladas,
        cardCaladas,
        cardCaladasCount,
        cardMenores17,
        cardPctMenores17,
        cardMenores10,
        cardPctMenores10,
        cardVetoHum10,
        evalResult,
        estadoNormalizado,
        hasAnalisisData,
        hasAutorizacionExp,
        isApto,
        isObs,
        isExp,
        isRech
      };
    });
  }, [lotes, humedades, analisisHumedos, evaluacionConfig]);

  // Statistics for quality filter badges
  const calidadStats = useMemo(() => {
    const aprobados = lotesConCalidad.filter((i) => i.estadoNormalizado === "APROBADO").length;
    const observados = lotesConCalidad.filter((i) => i.estadoNormalizado === "OBSERVADO").length;
    const experimentales = lotesConCalidad.filter((i) => i.estadoNormalizado === "EXPERIMENTAL").length;
    const desaprobados = lotesConCalidad.filter((i) => i.estadoNormalizado === "DESAPROBADO").length;
    return {
      total: lotesConCalidad.length,
      aprobados,
      observados,
      experimentales,
      desaprobados
    };
  }, [lotesConCalidad]);

  // Filtered lotes list
  const filteredLotes = useMemo(() => {
    return lotesConCalidad.filter(({ lote, estadoNormalizado }) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (lote.LOTE_ID || "").toLowerCase().includes(term) ||
        (lote.CLIENTE || "").toLowerCase().includes(term) ||
        (lote.VARIEDAD || "").toLowerCase().includes(term) ||
        (lote.ZONA || "").toLowerCase().includes(term);
      const matchesEstado = selectedEstadoFilter ? lote.ESTADO_LOTE === selectedEstadoFilter : true;
      const matchesCategoria = selectedCategoriaFilter !== "TODOS" ? obtenerCategoriaLote(lote.ESTADO_LOTE) === selectedCategoriaFilter : true;
      const matchesCalidad = selectedCalidadFilter !== "TODOS" ? estadoNormalizado === selectedCalidadFilter : true;
      return matchesSearch && matchesEstado && matchesCategoria && matchesCalidad;
    });
  }, [lotesConCalidad, searchTerm, selectedEstadoFilter, selectedCategoriaFilter, selectedCalidadFilter]);

  const selectedFocusLote = lotes.find((l) => l.LOTE_ID === selectedLoteId) || lotes[0];
  const focusHumedadRec = selectedFocusLote ? humedades.find((h) => h.LOTE_ID === selectedFocusLote.LOTE_ID) : null;
  const focusAnalisisRec = selectedFocusLote ? analisisHumedos.find((a) => a.LOTE_ID === selectedFocusLote.LOTE_ID) : null;

  return (
    <div className="space-y-4 pb-12">
      {/* Inputs nativos ocultos para abrir directamente cámara o selector de foto - SIEMPRE MONTADOS */}
      <input
        ref={directPhotoInputRef}
        id="recepcion-direct-photo-input"
        type="file"
        accept="image/*,application/pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp"
        className="hidden"
        onChange={handleDirectPhotoFileSelected}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />
      <input
        ref={directCameraInputRef}
        id="recepcion-direct-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleDirectPhotoFileSelected}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />
      <input
        ref={directExcelInputRef}
        id="recepcion-direct-excel-input"
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleDirectExcelSelected}
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />

      {/* Action Buttons Bar - Aligned to the Right */}
      <div className="flex items-center justify-between gap-3 flex-wrap w-full">
        {activeMode !== "catalogo" ? (
          <button
            onClick={() => setActiveMode("catalogo")}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            ← Volver a Lista de Lotes
          </button>
        ) : (
          <div className="flex-1" />
        )}

        {activeMode === "catalogo" && (
          <div className="flex items-center gap-2.5 ml-auto">
            {/* Botón Actualizar con Excel */}
            <button
              id="btn-subir-excel-lote"
              type="button"
              onClick={() => directExcelInputRef.current?.click()}
              disabled={isDirectProcessingExcel}
              className="px-3.5 py-2 font-bold text-xs rounded-xl flex items-center gap-2 border transition-all cursor-pointer shadow-sm bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-500/50 hover:border-emerald-400"
              title="Cargar o actualizar lotes continuamente desde archivo Excel (.xlsx, .xls, .csv)"
            >
              {isDirectProcessingExcel ? (
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isDirectProcessingExcel ? "Sincronizando..." : "Actualizar con Excel"}</span>
            </button>

            {/* Botón Asistente de Mapeo de Columnas */}
            {onOpenExcelSync && (
              <button
                id="btn-asistente-mapeo-excel"
                type="button"
                onClick={onOpenExcelSync}
                className="px-3 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700 hover:border-emerald-500/60"
                title="Abrir Asistente con Mapeo Manual de Columnas para asociar campos personalizados de Excel"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Mapear Columnas</span>
              </button>
            )}

            {/* Botón Subir Foto / Seleccionar Archivo */}
            <button
              id="btn-subir-foto-lote"
              type="button"
              onClick={() => directPhotoInputRef.current?.click()}
              disabled={isDirectProcessingPhoto || !canUseOCR}
              className={`px-3.5 py-2 font-bold text-xs rounded-xl flex items-center gap-2 border transition-all cursor-pointer shadow-sm ${
                canUseOCR
                  ? "bg-slate-800 hover:bg-slate-750 text-slate-100 border-slate-700 hover:border-emerald-500/60"
                  : "bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed opacity-60"
              }`}
              title={canUseOCR ? "Subir fotografía o archivo de ticket/ficha para ingreso automático por foto" : "Función restringida"}
            >
              {isDirectProcessingPhoto ? (
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isDirectProcessingPhoto ? "Leyendo Foto..." : "Subir Foto"}</span>
              {!canUseOCR && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>

            {/* Botón Tomar Foto con Cámara */}
            <button
              id="btn-camara-foto-lote"
              type="button"
              onClick={() => directCameraInputRef.current?.click()}
              disabled={isDirectProcessingPhoto || !canUseOCR}
              className={`p-2 font-bold text-xs rounded-xl flex items-center justify-center border transition-all cursor-pointer shadow-sm ${
                canUseOCR
                  ? "bg-slate-800 hover:bg-slate-750 text-emerald-400 border-slate-700 hover:border-emerald-500/60"
                  : "bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed opacity-60"
              }`}
              title={canUseOCR ? "Tomar foto directamente con la cámara del dispositivo" : "Función restringida"}
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Botón Agregar Lote */}
            <button
              id="btn-nuevo-lote-unificado"
              type="button"
              onClick={handleStartNewUnifiedLote}
              className={`px-4 py-2 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer ${
                canEditLotes
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                  : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-750"
              }`}
              title={canEditLotes ? "Registrar nuevo lote manualmente" : "Solo lectura para este rol"}
            >
              {canEditLotes ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>+ Agregar Lote</span>
            </button>
          </div>
        )}
      </div>

      {/* Overlay modal cuando se procesa Excel directamente */}
      {isDirectProcessingExcel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
              <FileSpreadsheet className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sincronizando Lotes desde Excel</h3>
              <p className="text-xs text-slate-400 mt-1">
                Leyendo hojas, actualizando lotes existentes y agregando nuevos con caladas M1-M14 y análisis...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-emerald-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Integrando base de datos...</span>
            </div>
          </div>
        </div>
      )}

      {/* Overlay modal cuando se procesa la fotografía directamente con IA */}
      {isDirectProcessingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
              <Camera className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Procesando Fotografía con IA</h3>
              <p className="text-xs text-slate-400 mt-1">
                Extrayendo código C0, pesaje de balanza, 14 caladas de humedad y análisis físico...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-emerald-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Digitalizando ingreso del lote...</span>
            </div>
          </div>
        </div>
      )}

      {/* Global Validation Error Banner */}
      {validationError && (
        <div className="bg-rose-950/90 border border-rose-500 text-rose-200 p-3.5 rounded-xl flex items-center justify-between text-xs animate-shake shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-xs rounded font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Global Success Banner */}
      {saveSuccessMsg && (
        <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-200 p-3.5 rounded-xl flex items-center justify-between text-xs shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-sm">{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg(null)}
            className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded text-xs cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 1: CATÁLOGO Y TABLA MAESTRA CONSOLIDADA           */}
      {/* ======================================================== */}
      {activeMode === "catalogo" && (
        <div className="space-y-4">
          {/* Clasificación Operativa de Lotes: Segmentos Compactos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Todos */}
            <button
              onClick={() => setSelectedCategoriaFilter("TODOS")}
              className={`p-2 sm:px-3 sm:py-2 rounded-lg border text-left transition-all cursor-pointer ${
                selectedCategoriaFilter === "TODOS"
                  ? "bg-slate-750 border-amber-500 shadow-sm ring-1 ring-amber-500/50"
                  : "bg-slate-800/80 border-slate-700/80 hover:border-slate-600 hover:bg-slate-750/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 truncate">
                  <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Todos los Lotes
                </span>
                <span className="text-[10px] font-mono text-slate-400">100%</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base sm:text-lg font-black text-white font-mono">{clasificacion.total}</span>
                <span className="text-[10px] text-slate-400">registrados</span>
              </div>
            </button>

            {/* Pendientes de Procesar */}
            <button
              onClick={() => setSelectedCategoriaFilter("PENDIENTE")}
              className={`p-2 sm:px-3 sm:py-2 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden ${
                selectedCategoriaFilter === "PENDIENTE"
                  ? "bg-amber-950/70 border-amber-500 shadow-sm ring-1 ring-amber-500/50"
                  : "bg-slate-800/80 border-amber-900/40 hover:border-amber-700/70 hover:bg-amber-950/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Pendientes
                </span>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-black rounded uppercase">
                  Priorizables
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base sm:text-lg font-black text-amber-300 font-mono">{clasificacion.totales.pendientes.cantidad}</span>
                <span className="text-[10px] text-amber-400 font-mono font-bold">{clasificacion.totales.pendientes.tn} TN</span>
              </div>
            </button>

            {/* En Proceso */}
            <button
              onClick={() => setSelectedCategoriaFilter("EN_PROCESO")}
              className={`p-2 sm:px-3 sm:py-2 rounded-lg border text-left transition-all cursor-pointer ${
                selectedCategoriaFilter === "EN_PROCESO"
                  ? "bg-orange-950/70 border-orange-500 shadow-sm ring-1 ring-orange-500/50"
                  : "bg-slate-800/80 border-orange-900/40 hover:border-orange-700/70 hover:bg-orange-950/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-orange-300 flex items-center gap-1.5 truncate">
                  <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0 animate-pulse" />
                  En Proceso
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base sm:text-lg font-black text-orange-300 font-mono">{clasificacion.totales.enProceso.cantidad}</span>
                <span className="text-[10px] text-orange-400 font-mono font-bold">{clasificacion.totales.enProceso.tn} TN</span>
              </div>
            </button>

            {/* Procesados */}
            <button
              onClick={() => setSelectedCategoriaFilter("PROCESADO")}
              className={`p-2 sm:px-3 sm:py-2 rounded-lg border text-left transition-all cursor-pointer ${
                selectedCategoriaFilter === "PROCESADO"
                  ? "bg-emerald-950/70 border-emerald-500 shadow-sm ring-1 ring-emerald-500/50"
                  : "bg-slate-800/80 border-emerald-900/40 hover:border-emerald-700/70 hover:bg-emerald-950/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 truncate">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Procesados
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">✓</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base sm:text-lg font-black text-emerald-300 font-mono">{clasificacion.totales.procesados.cantidad}</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">{clasificacion.totales.procesados.tn} TN</span>
              </div>
            </button>
          </div>

          {/* Filtro por Dictamen de Calidad (Aprobados, Observados, Desaprobados) */}
          <div className="bg-slate-850 p-3 rounded-xl border border-slate-750 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                Filtrar por Calidad:
              </span>
              {selectedCalidadFilter !== "TODOS" && (
                <button
                  type="button"
                  onClick={() => setSelectedCalidadFilter("TODOS")}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                  title="Quitar filtro de dictamen de calidad"
                >
                  <span>Ver Todos</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {/* Todos */}
              <button
                type="button"
                id="btn-filtro-calidad-todos"
                onClick={() => setSelectedCalidadFilter("TODOS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                  selectedCalidadFilter === "TODOS"
                    ? "bg-slate-700 text-white border-slate-500 shadow-sm ring-1 ring-slate-400/40"
                    : "bg-slate-900/90 text-slate-400 border-slate-750 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span>Todos</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                  {calidadStats.total}
                </span>
              </button>

              {/* Aprobados */}
              <button
                type="button"
                id="btn-filtro-calidad-aprobados"
                onClick={() => setSelectedCalidadFilter("APROBADO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                  selectedCalidadFilter === "APROBADO"
                    ? "bg-emerald-950 text-emerald-200 border-emerald-500 shadow-sm ring-1 ring-emerald-500/50"
                    : "bg-slate-900/90 text-emerald-400/80 border-slate-750 hover:bg-emerald-950/40 hover:border-emerald-700/60 hover:text-emerald-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Aprobados</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-900/70 text-emerald-300 border border-emerald-700/60">
                  {calidadStats.aprobados}
                </span>
              </button>

              {/* Observados */}
              <button
                type="button"
                id="btn-filtro-calidad-observados"
                onClick={() => setSelectedCalidadFilter("OBSERVADO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                  selectedCalidadFilter === "OBSERVADO"
                    ? "bg-amber-950 text-amber-200 border-amber-500 shadow-sm ring-1 ring-amber-500/50"
                    : "bg-slate-900/90 text-amber-400/80 border-slate-750 hover:bg-amber-950/40 hover:border-amber-700/60 hover:text-amber-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Observados</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-900/70 text-amber-300 border border-amber-700/60">
                  {calidadStats.observados}
                </span>
              </button>

              {/* Experimentales */}
              <button
                type="button"
                id="btn-filtro-calidad-experimentales"
                onClick={() => setSelectedCalidadFilter("EXPERIMENTAL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                  selectedCalidadFilter === "EXPERIMENTAL"
                    ? "bg-indigo-950 text-indigo-200 border-indigo-500 shadow-sm ring-1 ring-indigo-500/50"
                    : "bg-slate-900/90 text-indigo-400/80 border-slate-750 hover:bg-indigo-950/40 hover:border-indigo-700/60 hover:text-indigo-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Experimentales</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-900/70 text-indigo-300 border border-indigo-700/60">
                  {calidadStats.experimentales}
                </span>
              </button>

              {/* Desaprobados */}
              <button
                type="button"
                id="btn-filtro-calidad-desaprobados"
                onClick={() => setSelectedCalidadFilter("DESAPROBADO")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                  selectedCalidadFilter === "DESAPROBADO"
                    ? "bg-rose-950 text-rose-200 border-rose-500 shadow-sm ring-1 ring-rose-500/50"
                    : "bg-slate-900/90 text-rose-400/80 border-slate-750 hover:bg-rose-950/40 hover:border-rose-700/60 hover:text-rose-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Desaprobados</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-900/70 text-rose-300 border border-rose-700/60">
                  {calidadStats.desaprobados}
                </span>
              </button>

              {/* Botón Explicativo: Significado de Triángulos, Observaciones y 35 TN */}
              <button
                type="button"
                id="btn-guia-significado-triangulos"
                onClick={() => setShowGuiaSignificados(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20 hover:border-amber-400 shadow-sm ml-auto"
                title="Conozca el significado exacto de los triángulos de advertencia, el estado de observaciones y el límite de 35 TN"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>¿Qué significan los Triángulos y 35 TN?</span>
              </button>
            </div>
          </div>

          {/* Quick Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="input-search-recepcion-lotes"
                type="text"
                placeholder="Buscar por código de lote (Ej. C02020), cliente, variedad, procedencia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              {/* Dropdown de Calidad */}
              <select
                id="select-filter-calidad-lotes"
                aria-label="Filtrar por dictamen de calidad"
                value={selectedCalidadFilter}
                onChange={(e) => setSelectedCalidadFilter(e.target.value as FiltroCalidadAprobacion)}
                className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="TODOS">Calidad: Todos ({calidadStats.total})</option>
                <option value="APROBADO">✅ Aprobados ({calidadStats.aprobados})</option>
                <option value="OBSERVADO">⚠️ Observados ({calidadStats.observados})</option>
                <option value="EXPERIMENTAL">🧪 Experimentales ({calidadStats.experimentales})</option>
                <option value="DESAPROBADO">❌ Desaprobados ({calidadStats.desaprobados})</option>
              </select>

              {/* Dropdown de Estado */}
              <select
                aria-label="Filtrar por estado del lote"
                value={selectedEstadoFilter}
                onChange={(e) => setSelectedEstadoFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos los Estados ({lotes.length})</option>
                {estados.map((est) => (
                  <option key={est.ESTADO_ID} value={est.ESTADO}>{est.ESTADO}</option>
                ))}
              </select>

              {/* Selector de Vista: Tarjetas vs Lista */}
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("tarjetas")}
                  className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === "tarjetas"
                      ? "bg-amber-500 text-slate-950 shadow-sm font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Vista de Tarjetas"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden md:inline text-[11px]">Tarjetas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("lista")}
                  className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === "lista"
                      ? "bg-amber-500 text-slate-950 shadow-sm font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Vista de Lista / Tabla"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden md:inline text-[11px]">Lista</span>
                </button>
              </div>
            </div>
          </div>

          {/* Master Cards Grid / Table View */}
          {viewMode === "tarjetas" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLotes.map(({ lote, humRec, anRec, avgHum, cardDesv, hasCaladas, cardCaladas, cardCaladasCount, cardMenores17, cardPctMenores17, cardMenores10, cardPctMenores10, cardVetoHum10, evalResult, estadoNormalizado, hasAnalisisData, hasAutorizacionExp, isRech }) => {
              // Category info
              const cat = obtenerCategoriaLote(lote.ESTADO_LOTE);
              const metaCat = obtenerMetaCategoria(cat);
              const codigoBadgeProps = getDictamenBadgeProps(estadoNormalizado, evalResult, hasAnalisisData);

              return (
                <div
                  key={lote.LOTE_ID}
                  className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl border border-slate-700/80 p-4 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setModalFichaLoteId(lote.LOTE_ID)}
                            className={`font-mono font-black px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 shadow-sm group ${codigoBadgeProps.className}`}
                            title={codigoBadgeProps.title}
                            aria-label={`Abrir Hoja Unificada del lote ${lote.LOTE_ID}`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${codigoBadgeProps.dotColor} group-hover:animate-ping`} />
                            <span>{lote.LOTE_ID}</span>
                          </button>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${metaCat.badgeColor}`}>
                            {metaCat.shortLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{lote.FECHA_INGRESO || "Fecha sin registrar"}</div>
                      </div>
                      
                      {/* Estado Operativo del Lote (Dictamen representado en el cuadro de código del lote) */}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-900 text-amber-300 border-amber-800 whitespace-nowrap">
                        {lote.ESTADO_LOTE}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold truncate">{lote.CLIENTE || "Cliente no especificado"}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-400">{lote.UBICACION || lote.ZONA || "Sin ubicación"}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-800/60 rounded text-[11px] text-amber-300 font-bold">
                          {lote.VARIEDAD || "Sin variedad"}
                        </span>
                      </div>

                      {/* Unified 3 Key Metrics: Sacos, Peso Total (TN), Humedad Promedio */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-900/80 rounded-lg p-2 text-center text-slate-300 text-[11px] border border-slate-750">
                        <div>
                          <div className="text-slate-400 text-[10px]">Sacos</div>
                          <div className="font-bold text-white">{lote.SACOS || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">Peso Balanza</div>
                          <div className="font-bold text-white">{lote.PESO_KG ? `${(lote.PESO_KG / 1000).toFixed(1)} TN` : "0 TN"}</div>
                        </div>
                        <div className="bg-slate-950/60 rounded p-1">
                          <div className="text-cyan-400 text-[10px] flex items-center justify-center gap-0.5">
                            <Droplet className="w-2.5 h-2.5" />
                            <span>Humedad</span>
                          </div>
                          {hasCaladas ? (
                            <div>
                              <div className="font-bold text-cyan-300">{avgHum}%</div>
                              <div className="text-[9px] text-cyan-400/90 font-medium leading-tight">
                                {cardVetoHum10 ? (
                                  <span className="text-rose-400 font-bold">{cardMenores10} ≤10% (VETO)</span>
                                ) : cardMenores17 > 0 ? (
                                  <span className="text-amber-300 font-bold">{cardMenores17}&lt;17% ({cardPctMenores17.toFixed(0)}%)</span>
                                ) : (
                                  <span className="text-emerald-400">14 caladas ✓</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-bold text-amber-300">{avgHum > 0 ? `${avgHum}%` : "Pendiente"}</div>
                              <div className="text-[9px] text-amber-400/80 leading-none">Sin caladas</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Unified Quality Parameters */}
                      <div className="bg-slate-850 p-2 rounded-lg border border-slate-700/50 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Rendimiento (RI/RB):</span>
                          {anRec ? (
                            <span className="font-semibold text-emerald-300">
                              RI: {anRec.RI || 0}% | RB: {anRec.RB || 0}%
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Pendiente de Análisis</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">% Quebrado (QB / QI):</span>
                          {anRec ? (
                            <span className="font-semibold text-amber-300 font-mono">
                              {anRec.QB !== undefined && anRec.QB !== null 
                                ? `${Number(anRec.QB).toFixed(1)}%` 
                                : (anRec.QI !== undefined && anRec.QI !== null 
                                    ? `${Number(anRec.QI).toFixed(1)}% (QI)` 
                                    : "-")}
                              {anRec.QI !== undefined && anRec.QB !== undefined && (
                                <span className="text-[10px] text-slate-400 ml-1 font-normal">
                                  (QI: {Number(anRec.QI).toFixed(1)}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">---</span>
                          )}
                        </div>

                        {/* Evaluation Score Badge */}
                        <div className="pt-1 border-t border-slate-750/80 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Dictamen Oficial:</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1 ${evalResult.colorEstado}`}>
                              {evalResult.tieneVetoCritico && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping"></span>}
                              {evalResult.porcentajeAprobacion}% {evalResult.estadoAprobacion}
                            </span>
                          </div>
                          {evalResult.tieneVetoCritico && evalResult.motivosVeto.length > 0 && (
                            <div className="text-[10px] text-rose-400 font-medium bg-rose-950/50 p-1 rounded border border-rose-800/40 truncate" title={evalResult.motivosVeto.map(m => `${m.parametro}: ${m.descripcion}`).join(" | ")}>
                              ⚠ Veto: {evalResult.motivosVeto[0].parametro} ({evalResult.motivosVeto[0].valorDetectado})
                            </div>
                          )}
                        </div>

                        {/* BOTÓN SOLICITADO: PASAR LOTE DESAPROBADO A EXPERIMENTAL */}
                        {isRech && (
                          <div className="pt-2 border-t border-slate-750/70">
                            <button
                              id={`btn-pasar-exp-${lote.LOTE_ID}`}
                              type="button"
                              onClick={() => {
                                setModalAutorizarExperimental({ lote, evalResult });
                              }}
                              className="w-full py-2 px-3 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-950/50 transition-all cursor-pointer border border-orange-400/40 hover:scale-[1.01] active:scale-[0.99]"
                              title="Reclasificar Lote Desaprobado a Experimental con sustento técnico"
                            >
                              <FlaskConical className="w-4 h-4 text-orange-200 animate-pulse" />
                              <span>🧪 Pasar a Experimental</span>
                            </button>
                          </div>
                        )}

                        {/* BANNER SI YA CUENTA CON AUTORIZACIÓN EXPERIMENTAL */}
                        {hasAutorizacionExp && (
                          <div className="pt-2 border-t border-slate-750/70">
                            <div className="bg-orange-950/70 border border-orange-600/70 p-2.5 rounded-xl flex items-center justify-between text-[11px] text-orange-200">
                              <div className="flex items-center gap-1.5 font-bold truncate">
                                <FlaskConical className="w-4 h-4 text-orange-400 shrink-0" />
                                <span className="truncate">Exp. Autorizado ({lote.AUTORIZACION_EXPERIMENTAL?.autorizadoPor || "Jefatura"})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setModalAutorizarExperimental({ lote, evalResult })}
                                className="text-[10px] text-orange-300 hover:text-white underline font-bold shrink-0 ml-2 cursor-pointer"
                              >
                                Ver Sustento
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this Lote */}
                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setModalFichaLoteId(lote.LOTE_ID)}
                        className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ficha</span>
                      </button>

                      <button
                        onClick={() => {
                          loadLoteForDetail(lote.LOTE_ID);
                          setActiveMode("detalle_lote");
                          setFormStep("step_lote");
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                        title="Editar datos de recepción, pesaje o análisis del lote"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Editar</span>
                      </button>

                      {onDeleteLote && (
                        <button
                          onClick={() => setLoteAEliminar(lote)}
                          className="px-2 py-1.5 bg-slate-800 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-600/60 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          title="Eliminar lote del sistema"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Botón Pasar a Experimental si está desaprobado */}
                      {isRech && (
                        <button
                          id={`btn-pasar-exp-card-${lote.LOTE_ID}`}
                          type="button"
                          onClick={() => setModalAutorizarExperimental({ lote, evalResult })}
                          className="px-2.5 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer shadow-sm border border-orange-400/40 hover:scale-105 active:scale-95 transition"
                          title="Reclasificar Lote Desaprobado a Experimental"
                        >
                          <FlaskConical className="w-3.5 h-3.5 text-orange-200" />
                          <span>Pasar a Exp.</span>
                        </button>
                      )}

                      {/* Badge / Botón si ya cuenta con autorización experimental */}
                      {hasAutorizacionExp && (
                        <button
                          type="button"
                          onClick={() => setModalAutorizarExperimental({ lote, evalResult })}
                          className="px-2.5 py-1.5 bg-orange-950/80 hover:bg-orange-900 text-orange-300 border border-orange-600/70 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                          title="Ver Sustento de Autorización Experimental"
                        >
                          <FlaskConical className="w-3.5 h-3.5 text-orange-400" />
                          <span>Exp.</span>
                        </button>
                      )}
                      {cat === "PENDIENTE" && (
                        <button
                          onClick={() => onNavigate("priorizacion")}
                          className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                          title="Ver en ranking de priorización inteligente"
                        >
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          <span>Priorizar</span>
                        </button>
                      )}

                      {cat === "EN_PROCESO" && (
                        <button
                          onClick={() => onNavigate("control-vaporizado")}
                          className="px-2.5 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                          title="Monitorear lote en vaporizado o secado"
                        >
                          <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                          <span>En Proceso</span>
                        </button>
                      )}

                      {cat === "PROCESADO" && (
                        <button
                          onClick={() => onNavigate("analisis-vaporizado", lote.LOTE_ID)}
                          className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                          title="Ver resultados de calidad final e índice de éxito"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Análisis Calidad</span>
                        </button>
                      )}

                      <button
                        onClick={() => onNavigate("presecado-seco", lote.LOTE_ID)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <span>Presecado</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Master List / Table View */
          <div className="bg-slate-850 rounded-xl border border-slate-750 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-750">
                    <th className="py-3 px-3">Lote ID</th>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Cliente / Agricultor</th>
                    <th className="py-3 px-3">Variedad</th>
                    <th className="py-3 px-3">Zona / Ubicación</th>
                    <th className="py-3 px-3 text-right">Sacos</th>
                    <th className="py-3 px-3 text-right">Peso (TN)</th>
                    <th className="py-3 px-3 text-center">Humedad</th>
                    <th className="py-3 px-3 text-center">% Quebrado</th>
                    <th className="py-3 px-3 text-center">Estado Flujo</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {filteredLotes.map(({ lote, humRec, anRec, avgHum, cardDesv, evalResult, estadoNormalizado, hasAnalisisData, hasAutorizacionExp, isRech }) => {
                    const cat = obtenerCategoriaLote(lote.ESTADO_LOTE);
                    const metaCat = obtenerMetaCategoria(cat);
                    const codigoBadgeProps = getDictamenBadgeProps(estadoNormalizado, evalResult, hasAnalisisData);

                    return (
                      <tr 
                        key={lote.LOTE_ID}
                        className="hover:bg-slate-800/80 transition-colors"
                      >
                        {/* Lote ID & Categoría (El cuadro con el código refleja el dictamen y abre la Hoja Unificada al pulsar) */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setModalFichaLoteId(lote.LOTE_ID)}
                              className={`font-mono font-black px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all duration-150 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 shadow-sm group ${codigoBadgeProps.className}`}
                              title={codigoBadgeProps.title}
                              aria-label={`Abrir Hoja Unificada del lote ${lote.LOTE_ID}`}
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${codigoBadgeProps.dotColor} group-hover:animate-ping`} />
                              <span>{lote.LOTE_ID}</span>
                            </button>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${metaCat.badgeColor}`}>
                              {metaCat.shortLabel}
                            </span>
                          </div>
                        </td>

                        {/* Fecha */}
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                          {lote.FECHA_INGRESO || "-"}
                        </td>

                        {/* Cliente */}
                        <td className="py-2.5 px-3 font-semibold text-slate-200 max-w-[180px] truncate" title={lote.CLIENTE}>
                          {lote.CLIENTE || "-"}
                        </td>

                        {/* Variedad */}
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-800/60 rounded text-[11px] text-amber-300 font-bold">
                            {lote.VARIEDAD || "-"}
                          </span>
                        </td>

                        {/* Ubicación */}
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {lote.UBICACION || lote.ZONA || "-"}
                        </td>

                        {/* Sacos */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                          {lote.SACOS ? lote.SACOS.toLocaleString() : "-"}
                        </td>

                        {/* Peso TN */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                          {((lote.PESO_KG || 0) / 1000).toFixed(1)} TN
                        </td>

                        {/* Humedad */}
                        <td className="py-2.5 px-3 text-center">
                          {avgHum ? (
                            <div className="inline-flex flex-col items-center">
                              <span className={`font-mono font-bold ${Number(avgHum) > 15 ? "text-rose-400" : "text-cyan-400"}`}>
                                {Number(avgHum).toFixed(1)}%
                              </span>
                              {Number(cardDesv) > 0 && (
                                <span className={`text-[9px] ${Number(cardDesv) > 1.5 ? "text-rose-400 font-bold" : "text-slate-500"}`}>
                                  ±{Number(cardDesv).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* % Quebrado */}
                        <td className="py-2.5 px-3 text-center">
                          {anRec ? (
                            (() => {
                              const qb = anRec.QB !== undefined && anRec.QB !== null ? Number(anRec.QB) : undefined;
                              const qi = anRec.QI !== undefined && anRec.QI !== null ? Number(anRec.QI) : undefined;
                              const qGeneral = (anRec as any).QUEBRADO !== undefined && (anRec as any).QUEBRADO !== null ? Number((anRec as any).QUEBRADO) : undefined;
                              const qPrincipal = qb !== undefined ? qb : (qi !== undefined ? qi : qGeneral);

                              if (qPrincipal === undefined) {
                                return <span className="text-slate-600 font-mono text-[11px]">-</span>;
                              }

                              return (
                                <div className="inline-flex flex-col items-center">
                                  <span 
                                    className={`font-mono font-bold text-xs ${qPrincipal > 18 ? "text-rose-400" : "text-amber-400"}`}
                                    title={qb !== undefined ? `% Quebrado Blanco: ${qb.toFixed(1)}%` : `% Quebrado: ${qPrincipal.toFixed(1)}%`}
                                  >
                                    {qPrincipal.toFixed(1)}%
                                  </span>
                                  {qb !== undefined && qi !== undefined && (
                                    <span className="text-[9px] text-slate-400 font-mono leading-none mt-0.5" title={`Quebrado Integral: ${qi.toFixed(1)}%`}>
                                      QI: {qi.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-slate-600 text-[10px]">Sin análisis</span>
                          )}
                        </td>

                        {/* Estado Flujo */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-900 text-amber-300 border-amber-800 whitespace-nowrap">
                            {lote.ESTADO_LOTE}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Botón Pasar a Experimental solo si está desaprobado */}
                            {isRech && (
                              <button
                                id={`btn-pasar-exp-table-${lote.LOTE_ID}`}
                                type="button"
                                onClick={() => setModalAutorizarExperimental({ lote, evalResult })}
                                className="px-2 py-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-[10px] rounded flex items-center gap-1 transition cursor-pointer shadow-sm border border-orange-400/40 hover:scale-105 active:scale-95"
                                title="Reclasificar Lote Desaprobado a Experimental"
                              >
                                <FlaskConical className="w-3 h-3 text-orange-200" />
                                <span>Pasar a Exp.</span>
                              </button>
                            )}

                            {/* Badge/Botón si ya cuenta con autorización experimental */}
                            {hasAutorizacionExp && (
                              <button
                                type="button"
                                onClick={() => setModalAutorizarExperimental({ lote, evalResult })}
                                className="px-2 py-1 bg-orange-950/80 hover:bg-orange-900 text-orange-300 border border-orange-600/70 font-bold text-[10px] rounded flex items-center gap-1 transition cursor-pointer"
                                title="Ver Sustento de Autorización Experimental"
                              >
                                <FlaskConical className="w-3 h-3 text-orange-400" />
                                <span>Exp.</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                loadLoteForDetail(lote.LOTE_ID);
                                setActiveMode("detalle_lote");
                                setFormStep("step_lote");
                              }}
                              className="p-1.5 bg-slate-900 hover:bg-slate-750 text-slate-300 border border-slate-750 rounded text-xs cursor-pointer"
                              title="Editar Lote"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            <button
                              onClick={() => setModalFichaLoteId(lote.LOTE_ID)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-750 text-slate-300 border border-slate-750 rounded text-xs cursor-pointer"
                              title="Ver Ficha Técnica Unificada"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                            </button>

                            {onDeleteLote && (
                              <button
                                onClick={() => setLoteAEliminar(lote)}
                                className="p-1.5 bg-slate-900 hover:bg-rose-950 text-rose-400 border border-slate-750 hover:border-rose-700 rounded text-xs cursor-pointer"
                                title="Eliminar Lote"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {cat === "PENDIENTE" && (
                              <button
                                onClick={() => onNavigate("priorizacion", lote.LOTE_ID)}
                                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[11px] rounded flex items-center gap-1 cursor-pointer"
                                title="Priorización y Programación"
                              >
                                <Flame className="w-3 h-3 text-amber-400" />
                                <span>Prog.</span>
                              </button>
                            )}

                            {cat === "EN_PROCESO" && (
                              <button
                                onClick={() => onNavigate("control-vaporizado")}
                                className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 font-bold text-[11px] rounded flex items-center gap-1 cursor-pointer"
                                title="Monitorear en Proceso"
                              >
                                <Flame className="w-3 h-3 text-orange-400" />
                              </button>
                            )}

                            {cat === "PROCESADO" && (
                              <button
                                onClick={() => onNavigate("analisis-vaporizado", lote.LOTE_ID)}
                                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] rounded flex items-center gap-1 cursor-pointer"
                                title="Ver Análisis de Calidad Final"
                              >
                                <CheckCheck className="w-3 h-3 text-emerald-400" />
                              </button>
                            )}

                            <button
                              onClick={() => onNavigate("presecado-seco", lote.LOTE_ID)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded flex items-center gap-0.5 cursor-pointer"
                              title="Ir a Presecado & Seco"
                            >
                              <span>Secado</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

          {filteredLotes.length === 0 && (
            <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-750 p-6 space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-1" />
              <p className="text-slate-300 text-sm font-semibold">
                No se encontraron lotes que coincidan con los filtros seleccionados.
              </p>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                {selectedCalidadFilter !== "TODOS" && `Filtro de calidad activo: ${selectedCalidadFilter}. `}
                {selectedCategoriaFilter !== "TODOS" && `Categoría activa: ${selectedCategoriaFilter}. `}
                {searchTerm && `Búsqueda: "${searchTerm}". `}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {(selectedCalidadFilter !== "TODOS" || selectedCategoriaFilter !== "TODOS" || searchTerm || selectedEstadoFilter) && (
                  <button
                    onClick={() => {
                      setSelectedCalidadFilter("TODOS");
                      setSelectedCategoriaFilter("TODOS");
                      setSelectedEstadoFilter("");
                      setSearchTerm("");
                    }}
                    className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" /> Limpiar Todos los Filtros
                  </button>
                )}
                {onOpenExcelSync && (
                  <button
                    onClick={onOpenExcelSync}
                    className="px-3.5 py-1.5 bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    title="Cargar o exportar hojas de Excel y datos históricos"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel (Importar/Exportar)
                  </button>
                )}
                <button
                  onClick={handleStartNewUnifiedLote}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Ingresar Nuevo Lote
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 2: FORMULARIO UNIFICADO EN 3 PASOS / SECCIONES    */}
      {/* ======================================================== */}
      {(activeMode === "nuevo_unificado" || activeMode === "detalle_lote") && (
        <div className="space-y-4">
          {/* Unified Form Step Selector */}
          <div className="flex items-center gap-2 border-b border-slate-750 pb-2 overflow-x-auto">
            <button
              onClick={() => setFormStep("step_lote")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                formStep === "step_lote"
                  ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Paso 1: Datos de Recepción Balanza</span>
            </button>

            <button
              onClick={() => setFormStep("step_calidad")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                formStep === "step_calidad" || formStep === "step_humedad" || formStep === "step_analisis"
                  ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 shadow-md font-extrabold"
                  : "bg-slate-800 text-cyan-300 hover:bg-slate-750 hover:text-cyan-200 border border-cyan-500/20"
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>Paso 2: Hoja Única de Calidad (14 Caladas + Análisis Físicos)</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                formStep === "step_calidad" || formStep === "step_humedad" || formStep === "step_analisis"
                  ? "bg-slate-950/40 text-slate-950"
                  : "bg-slate-900 text-cyan-300 border border-cyan-700/50"
              }`}>
                {caladasCount}/14 caladas • {promedioHumedad > 0 ? `${promedioHumedad.toFixed(1)}%` : "---"}
              </span>
            </button>

            <button
              onClick={() => setFormStep("step_todo")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                formStep === "step_todo"
                  ? "bg-indigo-600 text-white shadow-md font-extrabold"
                  : "bg-slate-800 text-indigo-300 hover:bg-slate-750 hover:text-indigo-200 border border-indigo-500/20"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📄 Ver Ficha Completa en 1 Sola Hoja (Balanza + Calidad)</span>
            </button>
          </div>

          {/* PANEL DE CARGA FOTOGRÁFICA & COMPLETADO DE INGRESO */}
          {ocrPostUploadPanel && ocrPostUploadPanel.active && (() => {
            const isMissingCliente = !loteForm.CLIENTE || !loteForm.CLIENTE.trim();
            const isMissingSacos = !loteForm.SACOS || Number(loteForm.SACOS) <= 0;
            const isMissingPeso = !loteForm.PESO_KG || Number(loteForm.PESO_KG) <= 0;
            const isMissingCodigo = !currentNormalizedLoteId || currentNormalizedLoteId === "0" || isDuplicateLoteCode;
            const allRequiredReady = !isMissingCliente && !isMissingSacos && !isMissingCodigo;

            return (
              <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl space-y-4 animate-fade-in ring-1 ring-amber-500/20">
                {/* Cabecera del Panel */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-amber-500/20 border border-amber-500/50 rounded-xl text-amber-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider bg-amber-950/80 border border-amber-700/60 px-2 py-0.5 rounded-full">
                          Fotografía Procesada con IA
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {ocrPostUploadPanel.formatoNombre}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">
                        {allRequiredReady ? "¡Formulario Completo! Listo para Guardar o Generar Lote" : "Formulario Autocompletado: Faltan Llenar Datos Obligatorios"}
                      </h3>
                      <p className="text-xs text-slate-300">
                        {allRequiredReady
                          ? "Todos los campos mínimos requeridos (Código único, Cliente y Sacos) han sido ingresados con éxito."
                          : "Los datos legibles fueron extraídos de la fotografía. Complete las casillas marcadas para autorizar el guardado del lote."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {(uploadedPhotoUrl || ocrPostUploadPanel.photoUrl) && (
                      <button
                        type="button"
                        onClick={() => setShowPhotoZoomModal(uploadedPhotoUrl || ocrPostUploadPanel.photoUrl || null)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Ver fotografía del documento físico ampliada"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Ver Foto</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setOcrPostUploadPanel(null)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      title="Ocultar panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Si se detectaron múltiples lotes en la captura de tabla Excel */}
                {multiLotesFromPhoto && multiLotesFromPhoto.length > 1 && (
                  <div className="bg-emerald-950/40 border-2 border-emerald-500/80 rounded-xl p-3.5 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                          Tabla Excel Reconocida: {multiLotesFromPhoto.length} Lotes en la Imagen
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleImportAllMultiLotes}
                        disabled={isSaving}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition transform hover:scale-102 active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? "Guardando lotes..." : `⚡ Importar los ${multiLotesFromPhoto.length} Lotes de una Vez`}</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {multiLotesFromPhoto.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedMultiLoteIndex(idx);
                            applyIncomingOCRData("TABLA_EXCEL_INGRESO", item, uploadedPhotoUrl || undefined);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                            selectedMultiLoteIndex === idx
                              ? "bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow"
                              : "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          <span>Fila #{idx + 1}: Lote <strong>{item.LOTE_ID || `#${idx + 1}`}</strong></span>
                          <span className="text-[10px] opacity-80">({item.CLIENTE?.slice(0, 14) || "Cliente"} - {item.SACOS || 0} scs)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumen de Datos Extraídos con Éxito */}
                {ocrPostUploadPanel.camposDetectados && ocrPostUploadPanel.camposDetectados.length > 0 && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      ✓ Datos reconocidos de la imagen:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ocrPostUploadPanel.camposDetectados.map((c, i) => (
                        <span key={i} className="text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>{c}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Casillas de Campos Faltantes / Obligatorios */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* 1. Cliente / Productor */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    isMissingCliente
                      ? "bg-rose-950/30 border-2 border-rose-500 ring-2 ring-rose-500/30 shadow-md shadow-rose-950/50"
                      : "bg-slate-950/60 border-emerald-500/50"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1 text-white">
                        <span>👤 Cliente / Productor *</span>
                      </span>
                      {isMissingCliente ? (
                        <span className="text-[10px] font-extrabold text-rose-400 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-700 animate-pulse">
                          ⚠️ Falta Llenar
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700">
                          ✓ Completado
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Escriba el nombre del cliente..."
                      value={loteForm.CLIENTE || ""}
                      onChange={(e) => {
                        setValidationError(null);
                        setLoteForm(prev => ({ ...prev, CLIENTE: e.target.value.toUpperCase() }));
                      }}
                      className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white uppercase placeholder-slate-500 focus:outline-none ${
                        isMissingCliente ? "border-rose-500 focus:border-rose-400" : "border-slate-700 focus:border-amber-500"
                      }`}
                    />
                    {isMissingCliente && clientesGuardados.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="text-[9px] text-slate-400 self-center">Sugeridos:</span>
                        {clientesGuardados.slice(0, 3).map((cli) => (
                          <button
                            key={cli}
                            type="button"
                            onClick={() => {
                              setValidationError(null);
                              setLoteForm(prev => ({ ...prev, CLIENTE: cli }));
                            }}
                            className="text-[10px] px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 truncate max-w-[120px] cursor-pointer"
                            title={cli}
                          >
                            {cli}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Cantidad de Sacos */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    isMissingSacos
                      ? "bg-rose-950/30 border-2 border-rose-500 ring-2 ring-rose-500/30 shadow-md shadow-rose-950/50"
                      : "bg-slate-950/60 border-emerald-500/50"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1 text-white">
                        <span>📦 Cantidad de Sacos *</span>
                      </span>
                      {isMissingSacos ? (
                        <span className="text-[10px] font-extrabold text-rose-400 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-700 animate-pulse">
                          ⚠️ Falta Llenar
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700">
                          ✓ Completado ({loteForm.SACOS})
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={safeNumVal(loteForm.SACOS, "")}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        setValidationError(null);
                        setLoteForm(prev => ({
                          ...prev,
                          SACOS: e.target.value === "" ? 0 : Number(e.target.value)
                        }));
                      }}
                      className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none ${
                        isMissingSacos ? "border-rose-500 focus:border-rose-400" : "border-slate-700 focus:border-amber-500"
                      }`}
                    />
                    {isMissingSacos && loteForm.PESO_KG && Number(loteForm.PESO_KG) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const est = Math.max(1, Math.round(Number(loteForm.PESO_KG) / 50));
                          setLoteForm(prev => ({ ...prev, SACOS: est }));
                        }}
                        className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Estimar: {Math.max(1, Math.round(Number(loteForm.PESO_KG) / 50))} sacos (según peso)</span>
                      </button>
                    )}
                  </div>

                  {/* 3. Peso Total Balanza (Kg) */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    isMissingPeso
                      ? "bg-amber-950/20 border border-amber-500/60"
                      : "bg-slate-950/60 border-emerald-500/50"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1 text-white">
                        <span>⚖️ Peso Total Balanza (Kg)</span>
                      </span>
                      {isMissingPeso ? (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                          Pendiente Balanza
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700">
                          ✓ {Number(loteForm.PESO_KG).toLocaleString()} kg
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={safeNumVal(loteForm.PESO_KG, "")}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        setValidationError(null);
                        setLoteForm(prev => ({
                          ...prev,
                          PESO_KG: e.target.value === "" ? 0 : Number(e.target.value)
                        }));
                      }}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none"
                    />
                    {isMissingPeso && loteForm.SACOS && Number(loteForm.SACOS) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const est = Number(loteForm.SACOS) * 50;
                          setLoteForm(prev => ({ ...prev, PESO_KG: est }));
                        }}
                        className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Estimar: {Number(loteForm.SACOS) * 50} kg (Sacos x 50)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Botón de Acción Principal y Ayudas Rápidas */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Botón para poner 0 a parámetros vacíos si quedaron vacíos */}
                    <button
                      type="button"
                      onClick={() => {
                        setAnalisisForm(prev => ({
                          ...prev,
                          IMPUREZS: prev.IMPUREZS !== undefined ? prev.IMPUREZS : 0,
                          TZ: prev.TZ !== undefined ? prev.TZ : 0,
                          M: prev.M !== undefined ? prev.M : 0,
                          MANCHADO: prev.MANCHADO !== undefined ? prev.MANCHADO : 0,
                          GR: prev.GR !== undefined ? prev.GR : 0,
                          GI: prev.GI !== undefined ? prev.GI : 0,
                          GV: prev.GV !== undefined ? prev.GV : 0,
                          TT: prev.TT !== undefined ? prev.TT : 0,
                          TP: prev.TP !== undefined ? prev.TP : 0,
                          "T. PUNT.": prev["T. PUNT."] !== undefined ? prev["T. PUNT."] : 0
                        }));
                        setSaveSuccessMsg("⚡ Defectos no especificados ajustados a 0.00%");
                      }}
                      className="text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Defectos vacíos = 0.00%</span>
                    </button>

                    {isMissingCodigo && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = getNextLoteId();
                          setLoteForm(prev => ({ ...prev, LOTE_ID: nextId }));
                          setValidationError(null);
                        }}
                        className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Generar Código Único ({getNextLoteId()})</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {allRequiredReady ? (
                      <button
                        type="button"
                        onClick={() => handleSaveUnified()}
                        disabled={isSaving}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition transform hover:scale-102 active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? "Guardando Lote..." : `Guardar Ingreso y Generar Lote [${currentNormalizedLoteId}]`}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full sm:w-auto px-4 py-2 bg-slate-800 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
                      >
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Falta: {[isMissingCodigo && "Código", isMissingCliente && "Cliente", isMissingSacos && "Sacos"].filter(Boolean).join(", ")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* In-Form Contextual Validation Error Banner */}
          {validationError && (
            <div className="bg-rose-950/90 border-2 border-rose-500 text-rose-100 p-3.5 rounded-xl flex items-center justify-between text-xs shadow-xl animate-shake">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="font-bold text-sm leading-snug">{validationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white text-xs rounded font-bold cursor-pointer shrink-0 ml-3"
              >
                Entendido
              </button>
            </div>
          )}

          {/* In-Form Contextual Success Banner */}
          {saveSuccessMsg && (
            <div className="bg-emerald-950/90 border-2 border-emerald-500 text-emerald-100 p-3.5 rounded-xl flex items-center justify-between text-xs shadow-xl animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-bold text-sm leading-snug">{saveSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveSuccessMsg(null)}
                className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded text-xs cursor-pointer shrink-0 ml-3"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* PASO 1: DATOS DE RECEPCIÓN (BALANZA / TOLVA) */}
          {(formStep === "step_lote" || formStep === "step_todo") && (
            <div className="bg-slate-850 border border-slate-750 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-750 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Package className="w-4 h-4" />
                  <span>Sección A: Identificación y Pesaje del Lote</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-cargar-foto-paso1"
                    type="button"
                    onClick={() => directPhotoInputRef.current?.click()}
                    disabled={isDirectProcessingPhoto}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer"
                    title="Cargar los datos de este ingreso seleccionando una fotografía o archivo"
                  >
                    {isDirectProcessingPhoto ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isDirectProcessingPhoto ? "Leyendo Foto..." : "Subir Foto"}</span>
                  </button>

                  <button
                    id="btn-tomar-foto-paso1"
                    type="button"
                    onClick={() => directCameraInputRef.current?.click()}
                    disabled={isDirectProcessingPhoto}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-slate-700 rounded-lg cursor-pointer transition shadow-sm"
                    title="Tomar fotografía con cámara en vivo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>

                  {uploadedPhotoUrl && (
                    <button
                      id="btn-ver-foto-cargada-paso1"
                      type="button"
                      onClick={() => setShowPhotoZoomModal(uploadedPhotoUrl)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-300 hover:text-cyan-200 text-xs font-semibold rounded-lg border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Ver fotografía adjunta"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Ver Foto</span>
                    </button>
                  )}

                  <button
                    id="btn-rellenar-ejemplo-paso1"
                    type="button"
                    onClick={() => {
                      const nextId = getNextLoteId();
                      setValidationError(null);
                      setHighlightRedMissing(false);
                      setLoteForm((prev) => ({
                        ...prev,
                        LOTE_ID: nextId,
                        CLIENTE: prev.CLIENTE || "AGRO INDUSTRIAL DEL NORTE S.A.C.",
                        VARIEDAD: prev.VARIEDAD || "Tinajones Extra",
                        SACOS: prev.SACOS && Number(prev.SACOS) > 0 ? prev.SACOS : 600,
                        PESO_KG: prev.PESO_KG && Number(prev.PESO_KG) > 0 ? prev.PESO_KG : 30000,
                        UBICACION: prev.UBICACION || "Tolva de Secadora",
                        ZONA: prev.ZONA || "Ferreñafe",
                        ESTADO_LOTE: "INGRESADO"
                      }));
                    }}
                    className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold rounded-lg border border-amber-500/50 flex items-center gap-1 cursor-pointer transition shadow-sm"
                    title="Rellenar datos de balanza válidos de forma instantánea para probar"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Llenado Rápido</span>
                  </button>

                  <span className="text-xs text-slate-400 ml-1">Paso 1 de 3</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Código de Lote C0 */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Código de Lote *</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const next = getNextLoteId();
                          setLoteForm({ ...loteForm, LOTE_ID: next });
                          setValidationError(null);
                        }}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        Generar auto
                      </button>
                      {currentNormalizedLoteId && currentNormalizedLoteId !== "0" && (
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          isDuplicateLoteCode
                            ? "text-rose-300 bg-rose-950 border-rose-500 animate-pulse"
                            : "text-amber-400 bg-slate-950 border-amber-500/40"
                        }`}>
                          {isDuplicateLoteCode ? `⚠️ ${currentNormalizedLoteId} (Repetido)` : currentNormalizedLoteId}
                        </span>
                      )}
                    </div>
                  </label>
                  <div className={`flex rounded-lg overflow-hidden border transition-colors ${
                    isDuplicateLoteCode 
                      ? "border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20" 
                      : "border-slate-700 focus-within:border-amber-500 bg-slate-900"
                  }`}>
                    <span className={`inline-flex items-center px-3 font-mono font-black text-xs border-r select-none ${
                      isDuplicateLoteCode
                        ? "bg-rose-500/20 text-rose-300 border-rose-600"
                        : "bg-amber-500/20 text-amber-400 border-slate-700"
                    }`}>
                      C0
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={loteForm.LOTE_ID === "0" ? "0" : (loteForm.LOTE_ID || "").replace(/^C0*/i, "")}
                      onFocus={(e) => {
                        if (e.target.value === "0") {
                          e.target.select();
                        }
                      }}
                      onChange={(e) => {
                        setValidationError(null);
                        const raw = e.target.value.trim();
                        if (raw === "" || raw === "0") {
                          setLoteForm({
                            ...loteForm,
                            LOTE_ID: "0"
                          });
                        } else {
                          const formatted = raw.toUpperCase().startsWith("C0") ? raw.toUpperCase() : `C0${raw}`;
                          setLoteForm({
                            ...loteForm,
                            LOTE_ID: formatted
                          });
                        }
                      }}
                      className="w-full bg-transparent px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  {isDuplicateLoteCode ? (
                    <div className="mt-2 p-2.5 bg-rose-950/90 border border-rose-500/80 rounded-lg flex items-start gap-2 text-rose-200 text-xs shadow-lg">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-rose-300 block">
                          ¡Código de Lote ya registrado!
                        </span>
                        <span className="text-[11px] text-rose-200 block mt-0.5">
                          El código <strong className="font-mono text-white bg-rose-900/80 px-1 py-0.5 rounded border border-rose-700">{currentNormalizedLoteId}</strong> ya existe en el sistema. Los códigos de lote son únicos y <strong>no se pueden repetir</strong>.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = getNextLoteId();
                            setLoteForm({ ...loteForm, LOTE_ID: next });
                            setValidationError(null);
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          Generar código único disponible ({getNextLoteId()})
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Escriba el número (ej: <strong className="text-amber-300">2020</strong>) y se asignará <strong className="text-amber-300 font-mono">C02020</strong>. Debe ser un código único.
                    </p>
                  )}
                </div>

                {/* Fecha de Ingreso */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fecha de Ingreso *</label>
                  <input
                    type="date"
                    required
                    value={loteForm.FECHA_INGRESO || ""}
                    onChange={(e) => setLoteForm({ ...loteForm, FECHA_INGRESO: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Cliente / Productor */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">Cliente / Productor *</label>
                    {clientesGuardados.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {clientesGuardados.length} clientes guardados
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    list="lista-clientes-guardados"
                    placeholder="Escriba o seleccione cliente guardado..."
                    value={loteForm.CLIENTE || ""}
                    onChange={(e) => {
                      setValidationError(null);
                      setLoteForm({ ...loteForm, CLIENTE: e.target.value.toUpperCase() });
                    }}
                    className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none transition-colors uppercase ${
                      highlightRedMissing && !loteForm.CLIENTE
                        ? "border-2 border-red-500 bg-red-950/30 ring-2 ring-red-500/50"
                        : (!loteForm.CLIENTE && validationError ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-700 focus:border-amber-500")
                    }`}
                  />
                  <datalist id="lista-clientes-guardados">
                    {clientesGuardados.map((cli) => (
                      <option key={cli} value={cli} />
                    ))}
                  </datalist>

                  {/* Quick Select Client Pills */}
                  {clientesGuardados.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {clientesGuardados.slice(0, 4).map((cli) => (
                        <button
                          key={cli}
                          type="button"
                          onClick={() => {
                            setValidationError(null);
                            setLoteForm({ ...loteForm, CLIENTE: cli });
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-all truncate max-w-[150px] cursor-pointer ${
                            loteForm.CLIENTE === cli
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold"
                              : "bg-slate-900 text-slate-400 border-slate-750 hover:text-slate-200 hover:border-slate-600"
                          }`}
                          title={cli}
                        >
                          {cli}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Variedad de Arroz */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Variedad de Arroz *</label>
                  <select
                    required
                    value={isCustomVariedad ? "OTRA" : (loteForm.VARIEDAD || "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "OTRA") {
                        setIsCustomVariedad(true);
                        setLoteForm({ ...loteForm, VARIEDAD: customVariedadText });
                      } else {
                        setIsCustomVariedad(false);
                        setLoteForm({ ...loteForm, VARIEDAD: val });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Seleccionar Variedad...</option>
                    {VARIEDADES_ARROZ_OPCIONES.map((v) => (
                      <option key={v} value={v}>{v === "OTRA" ? "OTRA (Manual...)" : v}</option>
                    ))}
                  </select>
                  {isCustomVariedad && (
                    <input
                      type="text"
                      placeholder="Escriba variedad manual..."
                      value={customVariedadText}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setCustomVariedadText(val);
                        setLoteForm({ ...loteForm, VARIEDAD: val });
                      }}
                      className="mt-2 w-full bg-slate-900 border border-amber-500/60 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none uppercase"
                    />
                  )}
                </div>

                {/* Humedad - Se saca después de ingresar los parámetros */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">Humedad (%)</label>
                    {promedioHumedad > 0 ? (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700 flex items-center gap-1">
                        <span>✓ Calculada de Parámetros:</span>
                        <strong className="text-white">{promedioHumedad.toFixed(2)}%</strong>
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-medium bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 flex items-center gap-1">
                        <span>Valor inicial: 0.00% (se calcula tras 14 caladas)</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      placeholder="0.00%"
                      value={promedioHumedad > 0 ? `${promedioHumedad.toFixed(2)}%` : (loteForm.HUM !== undefined ? `${Number(loteForm.HUM).toFixed(2)}%` : "0.00%")}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 font-mono cursor-not-allowed pr-36 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setFormStep("step_humedad")}
                      className={`absolute right-1.5 top-1.5 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-sm ${
                        promedioHumedad > 0
                          ? "bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60"
                          : "bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60"
                      }`}
                      title="Ingresar o modificar las 14 caladas de muestreo para calcular la humedad del lote"
                    >
                      <span>{promedioHumedad > 0 ? `Editar Caladas (${caladasCount}/14)` : "Ingresar Parámetros →"}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {promedioHumedad > 0
                      ? `Humedad oficial: ${promedioHumedad.toFixed(2)}% (calculada automáticamente a partir de las 14 caladas de muestreo).`
                      : "Valor inicial en 0.00%. La humedad oficial se calculará al ingresar las 14 caladas de muestreo en el Paso 2."}
                  </span>
                </div>

                {/* Cantidad de Sacos */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">Cantidad de Sacos *</label>
                    {highlightRedMissing && (!loteForm.SACOS || Number(loteForm.SACOS) <= 0) && (
                      <span className="text-[10px] text-red-400 font-bold bg-red-950/80 border border-red-800 px-1.5 py-0.2 rounded">
                        ⚠️ Casilla en rojo: Ingrese Sacos
                      </span>
                    )}
                  </div>
                  <input
                    id="input-lote-sacos"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={safeNumVal(loteForm.SACOS, 0)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setValidationError(null);
                      setLoteForm({ ...loteForm, SACOS: e.target.value === "" ? 0 : parseOptionalNumber(e.target.value) });
                    }}
                    className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none font-mono transition-colors ${
                      highlightRedMissing && (!loteForm.SACOS || Number(loteForm.SACOS) <= 0)
                        ? "border-2 border-red-500 bg-red-950/30 ring-2 ring-red-500/50"
                        : "border-slate-700 focus:border-amber-500"
                    }`}
                  />
                  {loteForm.PESO_KG && Number(loteForm.PESO_KG) > 0 && (!loteForm.SACOS || Number(loteForm.SACOS) <= 0) && (
                    <button
                      type="button"
                      onClick={() => setLoteForm({ ...loteForm, SACOS: Math.max(1, Math.round(Number(loteForm.PESO_KG) / 50)) })}
                      className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Estimar: {Math.max(1, Math.round(Number(loteForm.PESO_KG) / 50))} sacos (según peso)</span>
                    </button>
                  )}
                </div>

                {/* Peso Total Balanza (Manual) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">Peso Total Balanza (Kg) - Manual *</label>
                    {(!loteForm.PESO_KG || Number(loteForm.PESO_KG) <= 0) && (!loteForm.SACOS || Number(loteForm.SACOS) <= 0) && highlightRedMissing && (
                      <span className="text-[10px] text-red-400 font-bold bg-red-950/90 border border-red-700 px-2 py-0.5 rounded animate-pulse">
                        ⚠️ Casilla en rojo: Complete Peso Balanza
                      </span>
                    )}
                  </div>
                  <input
                    id="input-lote-peso-kg"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={safeNumVal(loteForm.PESO_KG, 0)}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setValidationError(null);
                      setLoteForm({ ...loteForm, PESO_KG: e.target.value === "" ? 0 : parseOptionalNumber(e.target.value) });
                    }}
                    className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none font-mono transition-colors ${
                      (!loteForm.PESO_KG || Number(loteForm.PESO_KG) <= 0) && (!loteForm.SACOS || Number(loteForm.SACOS) <= 0) && highlightRedMissing
                        ? "border-2 border-red-500 bg-red-950/30 ring-2 ring-red-500/50 shadow-md shadow-red-500/20"
                        : "border-slate-700 focus:border-amber-500"
                    }`}
                  />
                  {loteForm.SACOS && Number(loteForm.SACOS) > 0 && (!loteForm.PESO_KG || Number(loteForm.PESO_KG) <= 0) && (
                    <button
                      type="button"
                      onClick={() => setLoteForm({ ...loteForm, PESO_KG: Number(loteForm.SACOS) * 50 })}
                      className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Estimar: {(Number(loteForm.SACOS) * 50).toLocaleString()} kg (50 kg/saco)</span>
                    </button>
                  )}
                </div>

                {/* Procedencia / Zona */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">Procedencia / Zona</label>
                    <span className="text-[10px] text-slate-400">Lista desplegable</span>
                  </div>
                  <input
                    type="text"
                    list="lista-zonas-procedencia"
                    placeholder="Seleccione o escriba zona..."
                    value={loteForm.ZONA || ""}
                    onChange={(e) => setLoteForm({ ...loteForm, ZONA: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase"
                  />
                  <datalist id="lista-zonas-procedencia">
                    {zonasGuardadas.map((zona) => (
                      <option key={zona} value={zona} />
                    ))}
                  </datalist>

                  {/* Botones de selección rápida de zonas principales */}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {["FERREÑAFE", "CHICLAYO", "LAMBAYEQUE", "TÚCUME", "PITIPO", "PICSI"].map((zona) => (
                      <button
                        key={zona}
                        type="button"
                        onClick={() => setLoteForm({ ...loteForm, ZONA: zona })}
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-medium cursor-pointer transition-all ${
                          loteForm.ZONA === zona
                            ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow"
                            : "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                        }`}
                      >
                        {zona}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ubicación / Silo Pulmón */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ubicación / Silo PulmÓN</label>
                  <input
                    type="text"
                    list="lista-ubicaciones-silo"
                    placeholder="Seleccione o escriba ubicación..."
                    value={loteForm.UBICACION || ""}
                    onChange={(e) => setLoteForm({ ...loteForm, UBICACION: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase"
                  />
                  <datalist id="lista-ubicaciones-silo">
                    {ubicacionesGuardadas.map((ub) => (
                      <option key={ub} value={ub} />
                    ))}
                  </datalist>

                  {/* Botones de selección rápida para Tolva de Secadora, Almacén 5, etc. */}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setLoteForm({ ...loteForm, UBICACION: "Tolva de Secadora" })}
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold cursor-pointer transition-all ${
                        loteForm.UBICACION === "Tolva de Secadora"
                          ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow"
                          : "bg-slate-800 hover:bg-slate-750 text-amber-300 border-slate-700"
                      }`}
                    >
                      🌾 Tolva de Secadora
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoteForm({ ...loteForm, UBICACION: "Almacén 5" })}
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold cursor-pointer transition-all ${
                        loteForm.UBICACION === "Almacén 5"
                          ? "bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow"
                          : "bg-slate-800 hover:bg-slate-750 text-cyan-300 border-slate-700"
                      }`}
                    >
                      📦 Almacén 5
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoteForm({ ...loteForm, UBICACION: "Tolva de Recepción" })}
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold cursor-pointer transition-all ${
                        loteForm.UBICACION === "Tolva de Recepción"
                          ? "bg-slate-200 text-slate-950 border-white font-bold shadow"
                          : "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                      }`}
                    >
                      Tolva Recepción
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoteForm({ ...loteForm, UBICACION: "Silo Pulmón 01" })}
                      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold cursor-pointer transition-all ${
                        loteForm.UBICACION === "Silo Pulmón 01"
                          ? "bg-slate-200 text-slate-950 border-white font-bold shadow"
                          : "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                      }`}
                    >
                      Silo Pulmón 01
                    </button>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Observaciones</label>
                  <input
                    type="text"
                    placeholder="Detalles sobre vehículo, humedad preliminar, etc."
                    value={loteForm.OBSERVACIONES || ""}
                    onChange={(e) => setLoteForm({ ...loteForm, OBSERVACIONES: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Botones de navegación y guardado rápido */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-750 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLoteForm(getEmptyLoteState())}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Vaciar Campos
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveUnified()}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Lote y Volver a Lista</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormStep("step_calidad")}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow cursor-pointer"
                  >
                    <span>Continuar a Hoja Única de Calidad (14 Caladas + Análisis)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: HOJA ÚNICA DE CALIDAD (14 CALADAS DE HUMEDAD + ANÁLISIS FÍSICO) */}
          {(formStep === "step_calidad" || formStep === "step_humedad" || formStep === "step_analisis" || formStep === "step_todo") && (
            <div className="bg-slate-850 border border-slate-750 rounded-2xl p-5 shadow-lg space-y-5">
              {/* Encabezado General de la Hoja de Calidad */}
              <div className="flex items-center justify-between border-b border-slate-750 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <FlaskConical className="w-5 h-5 text-emerald-400" />
                  <span>Hoja Única de Calidad: Muestreo de Humedad (14 Caladas) & Análisis Físico</span>
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                    Ficha Técnica Integral
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded flex items-center gap-1">
                    <span>⚡ Enter continuo: M1 a M14 y directo a Rendimientos</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {formStep === "step_todo" ? "Sección 2 de 2" : "Paso 2 de 2 (Hoja Unificada)"}
                  </span>
                </div>
              </div>

              {/* Live Evaluation Score Banner */}
              <div className={`p-4 rounded-xl border ${liveEvaluacion.colorEstado} flex flex-col gap-3 text-xs shadow-md transition-all`}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center bg-slate-950 border-2 border-current font-black shrink-0 shadow-inner">
                      <span className="text-lg leading-none">{liveEvaluacion.porcentajeAprobacion}%</span>
                      <span className="text-[8px] uppercase tracking-tight opacity-75">Puntaje</span>
                    </div>
                    <div>
                      <div className="font-black text-sm flex items-center gap-2 flex-wrap">
                        <span>Dictamen en Tiempo Real: LOTE {liveEvaluacion.estadoAprobacion}</span>
                        {liveEvaluacion.tieneVetoCritico && (
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-600 text-[10px] font-black animate-pulse">
                            ⚠ VETO CRÍTICO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Puntuación obtenida: <strong>{liveEvaluacion.porcentajeAprobacion}%</strong> ({liveEvaluacion.puntajeTotal}/100 pts) • {liveEvaluacion.items.filter(i => i.cumple).length} de 24 parámetros cumplidos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalFichaLoteId(loteForm.LOTE_ID || selectedLoteId)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ver Matriz Completa</span>
                    </button>
                  </div>
                </div>

                {/* Motivos de Veto Crítico Activos (Humedad <=10% >20%, Bastante Olor, etc.) */}
                {liveEvaluacion.tieneVetoCritico && liveEvaluacion.motivosVeto.length > 0 && (
                  <div className="pt-2 border-t border-rose-800/40 space-y-1.5">
                    <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>El lote obtiene {liveEvaluacion.porcentajeAprobacion}% pero queda RECHAZADO por los siguientes motivos de veto:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {liveEvaluacion.motivosVeto.map((m, mIdx) => (
                        <div key={mIdx} className="bg-rose-950/60 border border-rose-700/60 rounded-lg p-2 text-rose-200 text-[11px]">
                          <div className="font-bold text-rose-300">{m.parametro}</div>
                          <div className="text-[10px] text-rose-200/90">{m.descripcion}</div>
                          <div className="text-[9px] text-rose-400 font-mono mt-0.5">
                            Detectado: <strong>{m.valorDetectado}</strong> | Límite: {m.limitePermitido}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Info Banner: Humedad calculada sincronizada */}
              <div className="bg-slate-900/90 border border-cyan-800/50 p-2.5 rounded-xl flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Droplet className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Humedad de Muestreo Sincronizada: <strong>{promedioHumedad > 0 ? `${promedioHumedad.toFixed(2)}%` : "Pendiente de Caladas"}</strong>
                    {desvHumedad > 0 && <span className="text-slate-400 ml-1.5 font-mono">(Desv: ±{desvHumedad.toFixed(2)}%)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <span className="text-[11px] text-slate-400">Total Quebrados (%Q. INT + %Q. BL): <strong className="text-amber-400 font-mono font-bold">{totalQuebrado.toFixed(1)}%</strong></span>
                  <span className="text-[11px] text-slate-400">Muestras: <strong className="text-cyan-300 font-mono">{caladasCount}/14</strong></span>
                </div>
              </div>

              {/* SUB-SECCIÓN 1: MUESTREO DE 14 CALADAS DE HUMEDAD (M1 - M14) */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                    <Droplet className="w-4 h-4 text-cyan-400" />
                    <span>1. Muestreo de 14 Caladas de Humedad (M1 - M14)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCaladas(getEmptyCaladas())}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-750 text-[11px] rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                      title="Reiniciar los valores de las 14 caladas"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Vaciar Caladas
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono">14 Mediciones</span>
                  </div>
                </div>

                {/* Humidity Calculations Summary with <=10% and <17% metric */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-slate-900 p-3 rounded-xl border border-cyan-900/50">
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Promedio Calculado</div>
                    <div className="text-xl font-black text-cyan-400">
                      {promedioHumedad > 0 ? `${promedioHumedad.toFixed(2)}%` : "---"}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Desviación Estándar</div>
                    <div className="text-lg font-bold text-slate-200">
                      {desvHumedad > 0 ? `±${desvHumedad.toFixed(2)}%` : "---"}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Rango (Mín / Máx)</div>
                    <div className="text-xs font-bold text-slate-300 mt-1">
                      {minHumedad > 0 ? `${minHumedad}% - ${maxHumedad}%` : "---"}
                    </div>
                  </div>

                  {/* Medidas Menores o Iguales a 10% (Regla Crítica de Rechazo >20%) */}
                  <div className={`text-center p-1.5 rounded-lg border transition-all ${
                    isVetoHumedad10 
                      ? "bg-rose-950/70 border-rose-500 shadow-md shadow-rose-950/50" 
                      : countMenores10 > 0 
                        ? "bg-amber-950/40 border-amber-500/40" 
                        : "bg-slate-950/70 border-slate-750"
                  }`}>
                    <div className={`text-[10px] font-semibold ${isVetoHumedad10 ? "text-rose-300 font-bold" : "text-slate-400"}`}>
                      Muestras ≤ 10%
                    </div>
                    <div className={`text-lg font-black ${isVetoHumedad10 ? "text-rose-400" : countMenores10 > 0 ? "text-amber-400" : "text-slate-300"}`}>
                      {countMenores10} <span className="text-xs text-slate-400 font-normal">/ {caladasCount}</span>
                    </div>
                    <div className={`text-[10px] font-bold leading-tight ${isVetoHumedad10 ? "text-rose-300 animate-pulse" : "text-slate-400"}`}>
                      {pctMenores10.toFixed(1)}% {isVetoHumedad10 ? "⚠ RECHAZO" : "(Tolerancia ≤20%)"}
                    </div>
                  </div>

                  {/* Medidas Menores a 17% y Porcentaje */}
                  <div className="text-center bg-slate-950/70 p-1.5 rounded-lg border border-amber-500/30">
                    <div className="text-[10px] text-amber-300 font-semibold">Medidas &lt; 17%</div>
                    <div className="text-lg font-black text-amber-400">
                      {countMenores17} <span className="text-xs text-slate-400 font-normal">/ {caladasCount}</span>
                    </div>
                    <div className="text-[10px] text-amber-300 font-bold leading-tight">
                      {pctMenores17.toFixed(1)}% del total
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">Muestras Registradas</div>
                    <div className="text-lg font-bold text-cyan-300">
                      {caladasCount} / 14
                    </div>
                  </div>
                </div>

                {/* Banner de Veto Crítico por Humedades <= 10% */}
                {isVetoHumedad10 && (
                  <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-black text-rose-300 flex items-center gap-2">
                        <span>DICTAMEN OBLIGATORIO: LOTE RECHAZADO POR VETO CRÍTICO</span>
                        <span className="px-2 py-0.5 rounded bg-rose-900 border border-rose-700 text-[10px] font-black text-rose-200">
                          HUMEDADES ≤ 10% &gt; 20%
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-200/90 leading-relaxed">
                        El lote tiene <strong>{countMenores10} de {caladasCount} muestras con humedad ≤ 10.0%</strong> ({pctMenores10.toFixed(1)}% del total). Al superar el límite máximo permitido del 20.0%, <strong>el dictamen final será RECHAZADO</strong>, aunque se conserve la puntuación técnica calculada.
                      </p>
                    </div>
                  </div>
                )}

                {/* Informative Banner about < 17% status */}
                {caladasCount > 0 && !isVetoHumedad10 && (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    countMenores17 > 0
                      ? "bg-amber-950/30 border-amber-600/40 text-amber-200"
                      : "bg-slate-900 border-slate-700 text-slate-300"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Total de medidas menores a 17%: <strong>{countMenores17} de {caladasCount} muestras</strong> ({pctMenores17.toFixed(1)}% del total tomado).
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                      {countMenores17 === 0 ? "Todas ≥ 17%" : `${countMenores17} caladas bajas`}
                    </span>
                  </div>
                )}

                {/* Barra de Acciones Rápidas para 14 Caladas */}
                <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Relleno Rápido de Caladas:
                    </span>
                    {[13.5, 14.0, 14.5, 15.0].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          const newCal: { [key: string]: string } = {};
                          for (let i = 1; i <= 14; i++) {
                            const jitter = (Math.random() * 0.4 - 0.2).toFixed(1);
                            newCal[`M${i}`] = (val + parseFloat(jitter)).toFixed(1);
                          }
                          setCaladas(newCal);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        ~{val}%
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCaladas({})}
                    className="px-2 py-0.5 rounded bg-slate-850 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    Vaciar Caladas
                  </button>
                </div>

                {/* 14 Inputs Grid with <=10% and <17% visual indicator */}
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 text-xs">
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((idx) => {
                    const key = `M${idx}`;
                    const valNum = parseFloat(String(caladas[key]));
                    const isUnder10 = !isNaN(valNum) && valNum > 0 && valNum <= 10;
                    const isUnder17 = !isNaN(valNum) && valNum > 10 && valNum < 17;

                    return (
                      <div
                        key={key}
                        className={`bg-slate-900 p-2.5 rounded-lg border transition-all ${
                          isUnder10 
                            ? "border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/40" 
                            : isUnder17 
                              ? "border-amber-500/70 bg-amber-950/20" 
                              : "border-slate-700/80"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <label className={`block text-[11px] font-bold text-center w-full ${isUnder10 ? "text-rose-300" : "text-cyan-300"}`}>
                            Muestra {idx} (%)
                          </label>
                        </div>
                        <input
                          id={`input-calada-M${idx}`}
                          type="number"
                          step="0.1"
                          placeholder="Ej. 14.5"
                          value={caladas[key] || ""}
                          onChange={(e) => setCaladas({ ...caladas, [key]: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => handleCaladaKeyDown(e, idx)}
                          className={`w-full bg-slate-950 border rounded px-2 py-1 text-center font-mono font-bold focus:outline-none focus:border-cyan-500 ${
                            isUnder10 
                              ? "border-rose-500 text-rose-300 bg-rose-950/40" 
                              : isUnder17 
                                ? "border-amber-500/70 text-amber-300" 
                                : "border-slate-700 text-white"
                          }`}
                        />
                        {isUnder10 && (
                          <div className="text-[9px] text-rose-400 font-bold text-center mt-1">
                            ≤ 10% (Veto)
                          </div>
                        )}
                        {isUnder17 && (
                          <div className="text-[9px] text-amber-300 font-bold text-center mt-1">
                            &lt; 17%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SUB-SECCIÓN 2: RENDIMIENTOS Y CALIDAD (16 PARÁMETROS) */}
              <div className="space-y-2.5 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 flex-wrap gap-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <span>2. Rendimientos & Defectos de Calidad</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setAnalisisForm({
                          RI: 78.5,
                          RB: 68.2,
                          QI: 8.5,
                          QB: 14.2,
                          TT: 2.1,
                          TP: 2.3,
                          "T. PUNT.": 4.2,
                          M: 0.8,
                          MANCHADO: 0.8,
                          TZ: 1.5,
                          "B.INTEGRAL": 22.0,
                          "B. PULIDO": 39.0,
                          GR: 0.3,
                          GI: 1.2,
                          GV: 0.6
                        });
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-colors"
                      title="Rellenar automáticamente con valores de laboratorio típicos estándar"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>⚡ Valores Típicos de Laboratorio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalisisForm({})}
                      className="px-2 py-1 rounded bg-slate-850 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 text-[10px] font-medium cursor-pointer transition-colors"
                    >
                      Limpiar
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">16 Parámetros</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 text-xs">
                  {/* 1. R. INTEGRAL (R. I) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">R. INTEGRAL</span>
                      <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1 py-0.2 rounded">R. I</span>
                    </div>
                    <input
                      id="input-rend-RI"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 78.5"
                      value={safeNumVal(analisisForm.RI)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, RI: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-RI")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* 2. R. BLANCO (R. B) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">R. BLANCO</span>
                      <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1 py-0.2 rounded">R. B</span>
                    </div>
                    <input
                      id="input-rend-RB"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 68.2"
                      value={safeNumVal(analisisForm.RB)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, RB: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-RB")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* 3. %REMOCION (% REM.) - Cálculo Automático */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-cyan-800/40 bg-cyan-950/10">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-white">%REMOCION</span>
                        <span title="Cálculo automático bloqueado">
                          <Lock className="w-2.5 h-2.5 text-cyan-400" />
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-bold text-cyan-400 bg-cyan-950 border border-cyan-800/60 px-1 py-0.2 rounded uppercase">Auto</span>
                        <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800 px-1 py-0.2 rounded">% REM.</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={autoRemocion !== undefined && !isNaN(autoRemocion) ? `${autoRemocion}%` : "— (Ingrese R.I y R.B)"}
                      className="w-full bg-slate-950/90 border border-cyan-800/50 rounded px-2 py-1 text-cyan-300 font-mono font-bold cursor-not-allowed select-none shadow-inner"
                    />
                    <div className="flex items-center justify-between mt-1 text-[9px] text-cyan-400/80 font-medium">
                      <span>Fórmula: R.I - R.B</span>
                      {autoRemocion !== undefined && (
                        <span className="font-mono">{analisisForm.RI ?? "?"} - {analisisForm.RB ?? "?"}</span>
                      )}
                    </div>
                  </div>

                  {/* 4. QUEBRADO INTEGRAL (%Q. INT.) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">QUEBRADO INTEGRAL</span>
                      <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/70 border border-amber-800 px-1 py-0.2 rounded">%Q. INT.</span>
                    </div>
                    <input
                      id="input-rend-QI"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 12.5"
                      value={safeNumVal(analisisForm.QI)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, QI: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-QI")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 5. QUEBRADO BLANCO (% Q. BL.) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">QUEBRADO BLANCO</span>
                      <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-950/70 border border-amber-800 px-1 py-0.2 rounded">% Q. BL.</span>
                    </div>
                    <input
                      id="input-rend-QB"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 14.8"
                      value={safeNumVal(analisisForm.QB)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, QB: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-QB")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 6. % DE GRANO ENTERO (% ENTERO) - Cálculo Automático */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-emerald-800/40 bg-emerald-950/10">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-white">% DE GRANO ENTERO</span>
                        <span title="Cálculo automático bloqueado">
                          <Lock className="w-2.5 h-2.5 text-emerald-400" />
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800/60 px-1 py-0.2 rounded uppercase">Auto</span>
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1 py-0.2 rounded">% ENTERO</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={autoEntero !== undefined && !isNaN(autoEntero) ? `${autoEntero}%` : "— (Ingrese R.B y Quebrado)"}
                      className="w-full bg-slate-950/90 border border-emerald-800/50 rounded px-2 py-1 text-emerald-300 font-mono font-bold cursor-not-allowed select-none shadow-inner"
                    />
                    <div className="flex items-center justify-between mt-1 text-[9px] text-emerald-400/80 font-medium">
                      <span>Fórmula: R.B - % Quebrado</span>
                      {autoEntero !== undefined && (
                        <span className="font-mono">{analisisForm.RB ?? "?"} - {quebradoBlancoForm ?? "?"}</span>
                      )}
                    </div>
                  </div>

                  {/* 7. TIZA TOTAL (% T. TOT.) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">TIZA TOTAL</span>
                      <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-800 px-1 py-0.2 rounded">% T. TOT.</span>
                    </div>
                    <input
                      id="input-rend-TT"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 4.5"
                      value={safeNumVal(analisisForm.TT)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, TT: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-TT")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 8. TIZA PARCIAL (%T. PARC.) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">TIZA PARCIAL</span>
                      <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-800 px-1 py-0.2 rounded">%T. PARC.</span>
                    </div>
                    <input
                      id="input-rend-TP"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 2.1"
                      value={safeNumVal(analisisForm.TP)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, TP: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-TP")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 9. TIZA PUNTUAL (%T. PUNT.) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">TIZA PUNTUAL</span>
                      <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-800 px-1 py-0.2 rounded">%T. PUNT.</span>
                    </div>
                    <input
                      id="input-rend-TPUNT"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 1.3"
                      value={safeNumVal(analisisForm["T. PUNT."])}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, "T. PUNT.": parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-TPUNT")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 10. MANCHA (% M) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">MANCHA</span>
                      <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-800 px-1 py-0.2 rounded">% M</span>
                    </div>
                    <input
                      id="input-rend-M"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 0.8"
                      value={safeNumVal(analisisForm.M ?? analisisForm.MANCHADO)}
                      onChange={(e) => {
                        const val = parseOptionalNumber(e.target.value);
                        setAnalisisForm({ ...analisisForm, M: val, MANCHADO: val });
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-M")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 11. TRIZADO (% TZ) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">TRIZADO</span>
                      <span className="text-[9px] font-mono font-bold text-rose-400 bg-rose-950/70 border border-rose-800 px-1 py-0.2 rounded">% TZ</span>
                    </div>
                    <input
                      id="input-rend-TZ"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 2.4"
                      value={safeNumVal(analisisForm.TZ)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, TZ: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-TZ")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-rose-300 font-mono font-bold focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  {/* 12. GRANO ROJO (% G. R) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">GRANO ROJO</span>
                      <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-950/70 border border-rose-800 px-1 py-0.2 rounded">% G. R</span>
                    </div>
                    <input
                      id="input-rend-GR"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 0.5"
                      value={safeNumVal(analisisForm.GR)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, GR: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-GR")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  {/* 13. GRANO INMADURO (% G. INM.) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">GRANO INMADURO</span>
                      <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-800 px-1 py-0.2 rounded">% G. INM.</span>
                    </div>
                    <input
                      id="input-rend-GI"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 1.2"
                      value={safeNumVal(analisisForm.GI)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, GI: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-GI")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 14. GRANO VERDE (% G. V) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">GRANO VERDE</span>
                      <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1 py-0.2 rounded">% G. V</span>
                    </div>
                    <input
                      id="input-rend-GV"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 0.6"
                      value={safeNumVal(analisisForm.GV)}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, GV: parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-GV")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-emerald-300 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* 15. BLANCURA INTEGRAL (BL. INT.) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">BLANCURA INTEGRAL</span>
                      <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800 px-1 py-0.2 rounded">BL. INT.</span>
                    </div>
                    <input
                      id="input-rend-BINTEGRAL"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 22.0"
                      value={safeNumVal(analisisForm["B.INTEGRAL"])}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, "B.INTEGRAL": parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-BINTEGRAL")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* 16. BLANCURA DE PULIDO (B. PULIDO) */}
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-750">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-white">BLANCURA DE PULIDO</span>
                      <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-950/70 border border-cyan-800 px-1 py-0.2 rounded">B. PULIDO</span>
                    </div>
                    <input
                      id="input-rend-BPULIDO"
                      type="number"
                      step="0.01"
                      placeholder="Ej. 30.5"
                      value={safeNumVal(analisisForm["B. PULIDO"])}
                      onChange={(e) => setAnalisisForm({ ...analisisForm, "B. PULIDO": parseOptionalNumber(e.target.value) })}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleRendimientoKeyDown(e, "input-rend-BPULIDO")}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono font-bold focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SUB-SECCIÓN 2: PARÁMETROS ORGANOLÉPTICOS (6 PARÁMETROS) */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    2. Parámetros Organolépticos
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded shadow-sm">
                      Regla: N = Ninguno = NP (No Presenta)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">6 Parámetros Oficiales</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  {/* 17. PALOTE (PALT) */}
                  <OrganolepticoInput
                    id="input-recep-palote"
                    label="PALOTE"
                    abreviatura="PALT"
                    condicionApto="N, P o R"
                    value={analisisForm.PALOTE !== undefined ? analisisForm.PALOTE : "N"}
                    onChange={(val) => setAnalisisForm({ ...analisisForm, PALOTE: val })}
                    pesoPct={1}
                  />

                  {/* 18. VANO (VN) */}
                  <OrganolepticoInput
                    id="input-recep-vano"
                    label="VANO"
                    abreviatura="VN"
                    condicionApto="N, P o R"
                    value={analisisForm.VANO !== undefined ? analisisForm.VANO : "N"}
                    onChange={(val) => setAnalisisForm({ ...analisisForm, VANO: val })}
                    pesoPct={5}
                  />

                  {/* 19. IMPUREZA (IMP.) */}
                  <OrganolepticoInput
                    id="input-recep-impureza"
                    label="IMPUREZA"
                    abreviatura="IMP."
                    condicionApto="N, P o R"
                    value={analisisForm.IMPUREZS !== undefined ? analisisForm.IMPUREZS : "N"}
                    onChange={(val) => setAnalisisForm({ ...analisisForm, IMPUREZS: val })}
                    pesoPct={1}
                  />

                  {/* 20. OLOR (OL) */}
                  <OrganolepticoInput
                    id="input-recep-olor"
                    label="OLOR"
                    abreviatura="OL"
                    condicionApto="N o P (Poco)"
                    value={analisisForm.OLOR !== undefined ? analisisForm.OLOR : "N"}
                    onChange={(val) => setAnalisisForm({ ...analisisForm, OLOR: val })}
                    pesoPct={10}
                  />

                  {/* 21. FALSO CARBON (F. CARB.) */}
                  <OrganolepticoInput
                    id="input-recep-fcarbon"
                    label="FALSO CARBÓN"
                    abreviatura="F. CARB."
                    condicionApto="N o P (Poco)"
                    value={analisisForm["F. CARBON"] !== undefined ? analisisForm["F. CARBON"] : "N"}
                    onChange={(val) => setAnalisisForm({ ...analisisForm, "F. CARBON": val })}
                    pesoPct={5}
                  />

                  {/* 22. HONGO (HON.) */}
                  <OrganolepticoInput
                    id="input-recep-hongo"
                    label="HONGO"
                    abreviatura="HON."
                    condicionApto="N o P (Poco)"
                    value={analisisForm.HONGO !== undefined ? analisisForm.HONGO : "N"}
                    onChange={(val) => setAnalisisForm({ ...analisisForm, HONGO: val })}
                    pesoPct={4}
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-slate-300 font-semibold mb-1 text-xs">Observaciones de Calidad / Laboratorio</label>
                <input
                  type="text"
                  placeholder="Detalles sobre uniformidad, dictamen de calidad, etc."
                  value={analisisForm.OBSERVACIONES || ""}
                  onChange={(e) => setAnalisisForm({ ...analisisForm, OBSERVACIONES: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 text-xs"
                />
              </div>

              {/* Final Complete Save Button */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-750 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormStep("step_lote");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg cursor-pointer"
                >
                  ← Volver a Datos de Balanza
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setCaladas(getEmptyCaladas());
                      setAnalisisForm(getEmptyAnalisisState(loteForm.LOTE_ID, loteForm.VARIEDAD));
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Vaciar Hoja
                  </button>

                  {activeMode === "detalle_lote" && loteForm.LOTE_ID && (
                    <button
                      id="btn-pasar-exp-detalle-view"
                      type="button"
                      onClick={() => {
                        const target = lotes.find((l) => l.LOTE_ID === loteForm.LOTE_ID) || ({
                          ...loteForm,
                          LOTE_ID: loteForm.LOTE_ID,
                          CLIENTE: loteForm.CLIENTE,
                          VARIEDAD: loteForm.VARIEDAD,
                          SACOS: Number(loteForm.SACOS) || 0,
                          PESO_KG: Number(loteForm.PESO_KG) || 0,
                          ESTADO_LOTE: "PENDIENTE"
                        } as Lote);
                        setModalAutorizarExperimental({ lote: target });
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-95"
                      title="Autorizar este lote como experimental con sustento técnico"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-orange-200 animate-pulse" />
                      <span>🧪 Pasar a Experimental</span>
                    </button>
                  )}

                  {activeMode === "detalle_lote" && loteForm.LOTE_ID && onDeleteLote && (
                    <button
                      id="btn-eliminar-lote-detalle-view"
                      type="button"
                      onClick={() => {
                        const target = lotes.find((l) => l.LOTE_ID === loteForm.LOTE_ID) || {
                          LOTE_ID: loteForm.LOTE_ID,
                          CLIENTE: loteForm.CLIENTE,
                          VARIEDAD: loteForm.VARIEDAD,
                          SACOS: Number(loteForm.SACOS) || 0,
                          PESO_KG: Number(loteForm.PESO_KG) || 0,
                          ESTADO_LOTE: "PENDIENTE"
                        } as Lote;
                        setLoteAEliminar(target);
                      }}
                      className="px-3.5 py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/80 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                      title="Eliminar este lote y todos sus registros asociados"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Eliminar Lote</span>
                    </button>
                  )}

                  <button
                    id="btn-guardar-recepcion-unificada"
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveUnified()}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Lote Completo y Volver a Lista</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE FICHA TECNICA UNIFICADA Y DICTAMEN DE CALIDAD */}
      {modalFichaLoteId && (
        <FichaUnificadaModal
          isOpen={!!modalFichaLoteId}
          loteId={modalFichaLoteId}
          lotes={lotes}
          humedades={humedades}
          analisisHumedos={analisisHumedos}
          evaluacionConfig={evaluacionConfig}
          onOpenConfigEvaluacion={onOpenConfigEvaluacion}
          currentUser={currentUser}
          onSaveLote={onSaveLote}
          onDeleteLote={onDeleteLote}
          onClose={() => setModalFichaLoteId(null)}
          onEditLote={(id) => {
            loadLoteForDetail(id);
            setActiveMode("detalle_lote");
            setFormStep("step_analisis");
          }}
        />
      )}

      {/* MODAL PARA CAMBIAR LOTE DESAPROBADO A EXPERIMENTAL (SOLO JEFE DE ÁREA O PROGRAMADOR CON SUSTENTO) */}
      {modalAutorizarExperimental && (
        <ModalAutorizarExperimental
          isOpen={!!modalAutorizarExperimental}
          lote={modalAutorizarExperimental.lote}
          evalResult={modalAutorizarExperimental.evalResult}
          currentUser={currentUser}
          onClose={() => setModalAutorizarExperimental(null)}
          onSuccess={async (updatedLote) => {
            await onSaveLote(updatedLote);
            setSuccessBannerMsg(`El lote ${updatedLote.LOTE_ID} fue autorizado y reclasificado a modo EXPERIMENTAL.`);
            setTimeout(() => setSuccessBannerMsg(null), 7000);
          }}
          onRevertSuccess={async (updatedLote) => {
            await onSaveLote(updatedLote);
            setSuccessBannerMsg(`La condición experimental del lote ${updatedLote.LOTE_ID} fue revertida a DESAPROBADO.`);
            setTimeout(() => setSuccessBannerMsg(null), 7000);
          }}
        />
      )}

      {/* DIÁLOGO INFORMATIVO CUANDO EL USUARIO NO TIENE PERMISO */}
      {noticeAccessDenied && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-750 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-950/80 border border-amber-800 rounded-xl text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">Permiso Restringido</h4>
                <p className="text-xs text-amber-300">Exclusivo Jefe de Área o Programador</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              El cambio de un lote con dictamen <strong>DESAPROBADO</strong> a modo <strong>EXPERIMENTAL</strong> requiere autorización de alto nivel técnico con sustento obligatorio.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Lote solicitado:</span>
                <span className="font-mono font-bold text-orange-400">{noticeAccessDenied.loteId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Su rol actual:</span>
                <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">{noticeAccessDenied.userRol}</span>
              </div>
              <div className="pt-1 text-[11px] text-slate-500">
                Roles facultados: <strong className="text-emerald-400">JEFE_PLANTA</strong>, <strong className="text-emerald-400">JEFE_VAPORIZADO</strong>, <strong className="text-emerald-400">PROGRAMADOR</strong> o <strong className="text-emerald-400">ADMIN</strong>.
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setNoticeAccessDenied(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMACIÓN IN-APP PARA ELIMINACIÓN DEFINITIVA DE LOTE */}
      {loteAEliminar && (
        <div 
          id="modal-confirmar-eliminar-lote"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-slate-900 border border-rose-600/80 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">¿Eliminar Lote Definitivamente?</h3>
                <p className="text-xs text-rose-300 font-mono">Código: {loteAEliminar.LOTE_ID}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-semibold text-white">{loteAEliminar.CLIENTE || "---"}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Variedad:</span>
                <span className="font-semibold text-amber-400">{loteAEliminar.VARIEDAD || "---"}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Volumen:</span>
                <span className="font-semibold text-white">
                  {loteAEliminar.SACOS || 0} sacos ({loteAEliminar.PESO_KG ? (Number(loteAEliminar.PESO_KG) / 1000).toFixed(1) + " TN" : "---"})
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ⚠️ Esta acción eliminará permanentemente el lote y todos sus registros vinculados: humedades, análisis de laboratorio físico, presecado y programaciones. <strong className="text-rose-400">Esta acción no se puede deshacer.</strong>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeletingLote}
                onClick={() => setLoteAEliminar(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingLote}
                onClick={async () => {
                  if (!onDeleteLote || !loteAEliminar) return;
                  try {
                    setIsDeletingLote(true);
                    await onDeleteLote(loteAEliminar.LOTE_ID);
                    setSaveSuccessMsg(`El lote ${loteAEliminar.LOTE_ID} ha sido eliminado exitosamente.`);
                    setLoteAEliminar(null);
                    if (activeMode === "detalle_lote") {
                      setActiveMode("catalogo");
                    }
                    if (modalFichaLoteId === loteAEliminar.LOTE_ID) {
                      setModalFichaLoteId(null);
                    }
                  } catch (err: any) {
                    setValidationError(err?.message || "No se pudo eliminar el lote.");
                  } finally {
                    setIsDeletingLote(false);
                  }
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-rose-900/40 cursor-pointer transition disabled:opacity-50"
              >
                {isDeletingLote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeletingLote ? "Eliminando..." : "Sí, Eliminar Lote"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INTERACTIVO DE SOLICITUD DE INFORMACIÓN FALTANTE TRAS CARGA POR FOTOGRAFÍA */}
      {solicitudFaltantes && solicitudFaltantes.isOpen && (
        <div 
          id="modal-solicitud-faltantes-foto" 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border-2 border-amber-500/70 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-b border-amber-500/40 p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Carga de Ingreso por Fotografía
                    </h2>
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-md uppercase tracking-wide">
                      Información Requerida
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    Se debe completar la información faltante obligatoria antes de guardar el ingreso en el sistema.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSolicitudFaltantes(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* ALERTA CRÍTICA DE DUPLICIDAD DE CÓDIGO */}
              {solicitudFaltantes.isCodigoDuplicado && (
                <div className="p-4 bg-red-950/90 border-2 border-red-500 rounded-xl text-red-200 space-y-3 shadow-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-900/90 border border-red-500 rounded-lg text-red-200 shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white uppercase tracking-wide">
                        ⛔ Código Ya Registrado en el Sistema
                      </h4>
                      <p className="text-xs text-red-100 leading-relaxed">
                        El código <strong className="font-mono bg-red-900/80 px-2 py-0.5 rounded text-white border border-red-400">{solicitudFaltantes.rawLoteId || solicitudFaltantes.loteId}</strong> extraído de la fotografía física ya existe en la base de datos de recepción. <strong>No se permite crear dos ingresos con el mismo código.</strong>
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-red-500/50 rounded-lg space-y-2">
                    <label className="block text-slate-300 font-bold text-xs">
                      Rectifique o asigne un nuevo código único para este ingreso:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={solicitudFaltantes.loteId}
                        onChange={(e) => handleCorregirCodigoEnSolicitud(e.target.value)}
                        placeholder="Ingrese código de lote único (ej. 8393, LT-2026-001)"
                        className="flex-1 bg-slate-900 border border-red-400 focus:border-amber-400 rounded-lg px-3 py-1.5 text-white font-mono font-bold text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleCorregirCodigoEnSolicitud(getNextLoteId())}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Siguiente Consecutivo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumen de Datos Extraídos por la IA */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Datos reconocidos de la fotografía (sin autogeneración de valores):
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                    {solicitudFaltantes.formatoNombre}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                  <div className={`p-2 rounded border ${solicitudFaltantes.isCodigoDuplicado ? 'bg-red-950/80 border-red-500 text-red-200' : 'bg-slate-900/90 border-slate-800'}`}>
                    <span className="text-slate-500 text-[10px] block font-sans">Lote:</span>
                    <strong className={`font-bold ${solicitudFaltantes.isCodigoDuplicado ? 'text-red-300' : 'text-white'}`}>
                      {solicitudFaltantes.loteId}
                    </strong>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-sans">Cliente:</span>
                    <strong className="text-white truncate block" title={solicitudFaltantes.cliente || "Por ingresar"}>
                      {solicitudFaltantes.cliente || "Por ingresar"}
                    </strong>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-sans">Variedad:</span>
                    <strong className="text-amber-300">{solicitudFaltantes.variedad || "Tinajones Extra"}</strong>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-sans">Sacos:</span>
                    <strong className="text-emerald-400">{solicitudFaltantes.sacos ? `${solicitudFaltantes.sacos} sacos` : "Por ingresar"}</strong>
                  </div>
                </div>

                {/* Indicador de rendimientos y cálculos automáticos */}
                {solicitudFaltantes.analisis && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center flex-wrap gap-2 text-slate-400 font-mono">
                      <span>RI: <strong className="text-purple-300">{solicitudFaltantes.analisis.RI ?? "—"}%</strong></span>
                      <span>RB: <strong className="text-emerald-300">{solicitudFaltantes.analisis.RB ?? "—"}%</strong></span>
                      <span>Q: <strong className="text-amber-300">{solicitudFaltantes.analisis.QB ?? solicitudFaltantes.analisis.QI ?? "—"}%</strong></span>
                      <span className="text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded font-bold">
                        % REMOCIÓN: {solicitudFaltantes.analisis.RI && solicitudFaltantes.analisis.RB ? `${(Number(solicitudFaltantes.analisis.RI) - Number(solicitudFaltantes.analisis.RB)).toFixed(2)}%` : "Auto"} <span className="text-[9px] font-normal text-cyan-300">(Auto)</span>
                      </span>
                      <span className="text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded font-bold">
                        % GRANO ENTERO: {solicitudFaltantes.analisis.RB && (solicitudFaltantes.analisis.QB ?? solicitudFaltantes.analisis.QI) ? `${(Number(solicitudFaltantes.analisis.RB) - Number(solicitudFaltantes.analisis.QB ?? solicitudFaltantes.analisis.QI)).toFixed(2)}%` : "Auto"} <span className="text-[9px] font-normal text-emerald-300">(Auto)</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-cyan-300/80 font-sans italic flex items-center gap-1">
                      <Lock className="w-3 h-3 text-cyan-400" />
                      % Entero y % Remoción son automáticos por fórmula (no se digitan)
                    </span>
                  </div>
                )}
              </div>

              {/* Fotografía Adjunta del Ingreso */}
              {solicitudFaltantes.imagenPreview && (
                <div className="p-3 bg-slate-950/90 rounded-xl border border-amber-500/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={solicitudFaltantes.imagenPreview}
                      alt="Ticket o Ficha escaneada"
                      onClick={() => setShowPhotoZoomModal(solicitudFaltantes.imagenPreview!)}
                      className="w-14 h-14 object-cover rounded-lg border border-slate-700 cursor-pointer hover:opacity-85 transition shadow"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Fotografía del Documento Cargada</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Verifique el documento físico para cotejar casillas vacías, peso y rendimientos.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPhotoZoomModal(solicitudFaltantes.imagenPreview!)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ampliar Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => directPhotoInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white text-xs rounded-lg border border-slate-750 cursor-pointer transition"
                      title="Cambiar fotografía"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              )}

              {/* Error de validación si intenta guardar incompleto */}
              {solicitudFaltantes.errorValidacion && (
                <div className="p-3 bg-red-950/60 border-2 border-red-500 rounded-xl text-red-200 flex items-start gap-2.5 animate-shake">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">Información Faltante Obligatoria:</span>
                    <span className="text-xs">{solicitudFaltantes.errorValidacion}</span>
                  </div>
                </div>
              )}

              {/* Formulario de Campos Faltantes */}
              <div className="bg-slate-850/80 border border-amber-500/40 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs pb-1 border-b border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Campos que deben ingresarse para autorizar el guardado:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Peso Total Balanza (Kg) - OBLIGATORIO */}
                  <div className={`sm:col-span-2 p-3 rounded-xl space-y-1.5 transition-all ${
                    !solicitudFaltantes.pesoKg || Number(solicitudFaltantes.pesoKg) <= 0
                      ? "bg-red-950/30 border-2 border-red-500 ring-2 ring-red-500/30"
                      : "bg-slate-900 border-2 border-emerald-500/60"
                  }`}>
                    <label className="block text-white font-black text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-4 h-4 text-amber-400" />
                        <span>Peso Total Balanza (Kg) *</span>
                      </span>
                      {!solicitudFaltantes.pesoKg || Number(solicitudFaltantes.pesoKg) <= 0 ? (
                        <span className="text-[10px] text-red-400 bg-red-950 px-2 py-0.5 rounded font-bold border border-red-700 animate-pulse">
                          ⚠️ Casilla en rojo: Complete Peso
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded font-bold border border-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Peso Registrado</span>
                        </span>
                      )}
                    </label>
                    <input
                      id="input-faltante-peso-kg"
                      type="number"
                      min="1"
                      step="any"
                      placeholder="Ej. 11040 (según pesaje en plataforma de balanza)"
                      value={solicitudFaltantes.pesoKg}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        setSolicitudFaltantes(prev => prev ? ({ ...prev, pesoKg: val, errorValidacion: null }) : null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const nextInput = (document.getElementById("input-faltante-zona") || document.getElementById("btn-guardar-faltantes-foto")) as HTMLElement | null;
                          if (nextInput) {
                            nextInput.focus();
                            if ((nextInput as HTMLInputElement).select) (nextInput as HTMLInputElement).select();
                          }
                        }
                      }}
                      className={`w-full bg-slate-950 rounded-lg px-3 py-2 text-white font-mono text-sm font-bold placeholder-slate-500 outline-none transition-all ${
                        !solicitudFaltantes.pesoKg || Number(solicitudFaltantes.pesoKg) <= 0
                          ? "border-2 border-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-400"
                          : "border border-emerald-500/60 focus:border-emerald-400"
                      }`}
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Peso registrado por la báscula de tolva/plataforma al momento de ingreso a planta.
                    </span>
                  </div>

                  {/* Procedencia / Zona */}
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                    <label className="block text-slate-200 font-bold text-xs flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Procedencia / Zona de Origen</span>
                    </label>
                    <input
                      id="input-faltante-zona"
                      type="text"
                      list="zonas-faltantes-list"
                      placeholder="Ej. Ferreñafe, Lambayeque..."
                      value={solicitudFaltantes.zona}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSolicitudFaltantes(prev => prev ? ({ ...prev, zona: val }) : null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const nextInput = document.getElementById("input-faltante-ubicacion") as HTMLElement | null;
                          if (nextInput) {
                            nextInput.focus();
                            if ((nextInput as HTMLInputElement).select) (nextInput as HTMLInputElement).select();
                          }
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-750 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-white font-medium text-xs outline-none"
                    />
                    <datalist id="zonas-faltantes-list">
                      {zonasGuardadas.map(z => <option key={z} value={z} />)}
                    </datalist>
                    {/* Botones rápidos de zona */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["Ferreñafe", "Chiclayo", "Lambayeque", "Túcume", "Pitipo"].map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => setSolicitudFaltantes(prev => prev ? ({ ...prev, zona: z }) : null)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] rounded border border-slate-700 cursor-pointer"
                        >
                          {z}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ubicación en Planta */}
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                    <label className="block text-slate-200 font-bold text-xs flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ubicación / Silo Asignado</span>
                    </label>
                    <input
                      id="input-faltante-ubicacion"
                      type="text"
                      list="ubicaciones-faltantes-list"
                      placeholder="Ej. Tolva de Secadora, Silo Pulmón 01..."
                      value={solicitudFaltantes.ubicacion}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSolicitudFaltantes(prev => prev ? ({ ...prev, ubicacion: val }) : null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const saveBtn = document.getElementById("btn-guardar-faltantes-foto") as HTMLElement | null;
                          if (saveBtn) saveBtn.focus();
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-750 focus:border-amber-400 rounded-lg px-3 py-1.5 text-white font-medium text-xs outline-none"
                    />
                    <datalist id="ubicaciones-faltantes-list">
                      {ubicacionesGuardadas.map(u => <option key={u} value={u} />)}
                    </datalist>
                    {/* Botones rápidos de ubicación */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {["Tolva de Secadora", "Silo Pulmón 01", "Almacén 5"].map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setSolicitudFaltantes(prev => prev ? ({ ...prev, ubicacion: u }) : null)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] rounded border border-slate-700 cursor-pointer"
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Si falta Cliente o Sacos, mostrar inputs dedicados */}
                  {(!solicitudFaltantes.cliente || !solicitudFaltantes.cliente.trim()) && (
                    <div className="sm:col-span-2 p-3 bg-slate-900 rounded-xl border border-amber-500/40 space-y-1.5">
                      <label className="block text-white font-bold text-xs">
                        Cliente / Productor *
                      </label>
                      <input
                        id="input-faltante-cliente"
                        type="text"
                        placeholder="Nombre completo o razón social del cliente"
                        value={solicitudFaltantes.cliente}
                        onChange={(e) => setSolicitudFaltantes(prev => prev ? ({ ...prev, cliente: e.target.value, errorValidacion: null }) : null)}
                        className="w-full bg-slate-950 border border-amber-500/60 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                      />
                    </div>
                  )}

                  {(!solicitudFaltantes.sacos || Number(solicitudFaltantes.sacos) <= 0) && (
                    <div className="p-3 bg-slate-900 rounded-xl border border-amber-500/40 space-y-1.5">
                      <label className="block text-white font-bold text-xs">
                        Cantidad de Sacos *
                      </label>
                      <input
                        id="input-faltante-sacos"
                        type="number"
                        min="1"
                        placeholder="Ej. 184"
                        value={solicitudFaltantes.sacos}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Number(e.target.value);
                          setSolicitudFaltantes(prev => prev ? ({ ...prev, sacos: val, errorValidacion: null }) : null);
                        }}
                        className="w-full bg-slate-950 border border-amber-500/60 rounded-lg px-3 py-1.5 text-white font-mono text-xs outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 2: CONFIRMACIÓN DE CASILLAS VACÍAS EN LA FOTOGRAFÍA (LA IA NO INVENTA VALORES) */}
              {solicitudFaltantes.parametrosVacios && solicitudFaltantes.parametrosVacios.length > 0 && (
                <div className="bg-slate-850/90 border border-amber-500/50 rounded-xl p-4 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                        <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>2. Confirmación de Casillas Vacías en la Fotografía ({solicitudFaltantes.parametrosVacios.length}):</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        La IA no ha inventado ningún valor. Indique si cada casilla vacía es <strong>Cero (0.00)</strong> o si se <strong>olvidaron de registrar</strong> para digitar el valor correspondiente.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleMarcarTodosDefectosCero}
                        className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[11px] font-bold rounded-lg border border-emerald-700/80 transition cursor-pointer flex items-center gap-1"
                        title="Marcar todos los defectos vacíos como Cero"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Defectos vacíos = Cero (0.00)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRestablecerParametrosVacios}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-400 text-[10px] rounded-lg border border-slate-700 transition cursor-pointer"
                        title="Restablecer a pendiente"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  {/* Grid de confirmación de parámetros */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {solicitudFaltantes.parametrosVacios.map((param) => {
                      const isZero = param.estado === "ES_CERO";
                      const isEntered = param.estado === "INGRESADO";
                      const isPendingLab = param.estado === "DEJADO_PENDIENTE";

                      return (
                        <div
                          key={param.campo}
                          className={`p-3 rounded-xl border transition-all space-y-2 ${
                            isZero
                              ? "bg-emerald-950/30 border-emerald-600/70"
                              : isEntered
                              ? "bg-sky-950/30 border-sky-600/70"
                              : isPendingLab
                              ? "bg-slate-900 border-slate-700"
                              : "bg-slate-900/90 border-amber-500/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{param.label}</span>
                              <span className="text-[10px] text-slate-400 font-normal">({param.unidad})</span>
                            </span>
                            
                            {isZero ? (
                              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-600 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                0.00 (Cero)
                              </span>
                            ) : isEntered ? (
                              <span className="px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-600 rounded text-[10px] font-mono font-bold">
                                {param.valor} {param.unidad}
                              </span>
                            ) : isPendingLab ? (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-[10px] font-mono">
                                Pendiente Lab
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-600 rounded text-[10px] font-bold animate-pulse">
                                Por Confirmar
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400">
                            {param.motivo || "Casilla vacía en el documento físico."}
                          </div>

                          {/* Opciones interactivas */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleConfirmarParametroEsCero(param.campo)}
                              className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                                isZero
                                  ? "bg-emerald-600 text-white border-emerald-500 shadow"
                                  : "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Es Cero (0.00)</span>
                            </button>

                            <div className="flex-[1.2] flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Digitar valor..."
                                value={param.estado === "INGRESADO" ? (param.valor ?? "") : ""}
                                onChange={(e) => handleIngresarValorParametro(param.campo, e.target.value)}
                                className={`w-full bg-slate-950 border rounded-lg px-2 py-1 text-white font-mono text-xs outline-none transition ${
                                  isEntered
                                    ? "border-sky-500 bg-sky-950/20"
                                    : "border-slate-750 focus:border-amber-400"
                                }`}
                              />
                            </div>

                            {param.esLaboratorio && (
                              <button
                                type="button"
                                onClick={() => handleDejarPendienteLaboratorio(param.campo)}
                                className={`py-1 px-2 rounded-lg text-[10px] font-medium transition cursor-pointer border ${
                                  isPendingLab
                                    ? "bg-slate-700 text-white border-slate-600"
                                    : "bg-slate-800 hover:bg-slate-750 text-slate-400 border-slate-700"
                                }`}
                                title="Dejar pendiente para posterior registro de laboratorio"
                              >
                                Pendiente
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-950 border-t border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                id="btn-continuar-formulario-completo"
                type="button"
                onClick={handleContinuarEnFormularioDetallado}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <span>Revisar en Formulario Completo</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSolicitudFaltantes(null)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-800"
                >
                  Cancelar
                </button>

                <button
                  id="btn-guardar-faltantes-foto"
                  type="button"
                  disabled={isSaving || Boolean(solicitudFaltantes.isCodigoDuplicado)}
                  onClick={handleGuardarDesdeSolicitudFaltantes}
                  className={`w-full sm:w-auto px-6 py-2.5 text-xs font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    solicitudFaltantes.isCodigoDuplicado
                      ? "bg-red-900/60 text-red-300 border border-red-700 cursor-not-allowed opacity-80"
                      : "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 hover:shadow-amber-500/20"
                  }`}
                  title={solicitudFaltantes.isCodigoDuplicado ? "No se puede guardar: El código ya existe en el sistema" : "Guardar ingreso"}
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>
                    {isSaving 
                      ? "Guardando Ingreso..." 
                      : solicitudFaltantes.isCodigoDuplicado 
                      ? "⛔ Código Duplicado (Bloqueado)" 
                      : "Guardar Ingreso en Sistema"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST / BANNER DE CONFIRMACIÓN */}
      {successBannerMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-emerald-950 to-slate-900 border border-emerald-600 text-emerald-200 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successBannerMsg}</span>
          <button 
            onClick={() => setSuccessBannerMsg(null)}
            className="ml-2 text-emerald-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* LIGHTBOX MODAL DE ZOOM DE FOTOGRAFÍA / TICKET */}
      {showPhotoZoomModal && (
        <div
          className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
          onClick={() => setShowPhotoZoomModal(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col bg-slate-900 border border-slate-750 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-850 border-b border-slate-750 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Fotografía del Documento / Ticket de Recepción</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoZoomModal(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-auto flex items-center justify-center bg-black/85">
              <img
                src={showPhotoZoomModal}
                alt="Zoom Fotografía"
                className="max-h-[72vh] w-auto object-contain rounded-lg shadow-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPLETAR DATOS FALTANTES DE EXCEL (NO INVENTAR DATOS) */}
      {showDirectExcelMissingModal && directExcelMissingSummary && directExcelPendingPayload && (
        <ExcelDatosFaltantesModal
          isOpen={showDirectExcelMissingModal}
          onClose={() => {
            setShowDirectExcelMissingModal(false);
            setDirectExcelPendingPayload(null);
            setDirectExcelMissingSummary(null);
            setDirectExcelPendingRows([]);
            if (directExcelInputRef.current) directExcelInputRef.current.value = "";
          }}
          fileName={directExcelPendingFileName}
          totalRows={directExcelPendingRows.length}
          missingSummary={directExcelMissingSummary}
          rows={directExcelPendingRows}
          onConfirmImport={async (cleanedRows) => {
            const updatedPayload = {
              ...directExcelPendingPayload,
              lotes: cleanedRows
            };
            await executeExcelBulkImport(updatedPayload, directExcelPendingFileName);
          }}
        />
      )}

      {/* MODAL GUÍA: SIGNIFICADO DE TRIÁNGULOS, OBSERVACIONES, 1 ERROR Y 35 TN */}
      {showGuiaSignificados && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setShowGuiaSignificados(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-6 text-slate-200 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Guía Operativa del Sistema</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                      Planta APIT
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Significado de los Triángulos de Advertencia (⚠️), Observaciones, 1 Error y Capacidad 35 TN
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowGuiaSignificados(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                title="Cerrar guía"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs leading-relaxed">
              
              {/* SECCIÓN 1: LOS TRIÁNGULOS AMARILLOS (⚠️) */}
              <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm">
                  <div className="p-1.5 bg-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <span>1. ¿Qué significan los Triángulos de Advertencia (⚠️)?</span>
                </div>
                <p className="text-slate-300">
                  El triángulo amarillo <strong>NO significa que el sistema esté dañado ni que el software tenga un error</strong>. Es un indicador agronómico e industrial preventivo para el operador de planta:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      En la Recepción de Lotes:
                    </div>
                    <p className="text-slate-400 mt-1 text-[11px]">
                      Indica que el lote tiene la condición de <strong>"OBSERVADO"</strong>. Calificó entre 91% y 96% de aprobación, o tiene ligeras desviaciones de humedad o grano verde. El lote <strong>SÍ se puede procesar</strong>, pero requiere atención en los tiempos de vaporizado.
                    </p>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      En la Programación de Batches:
                    </div>
                    <p className="text-slate-400 mt-1 text-[11px]">
                      Aparece cuando los lotes sumados difieren de la <strong>capacidad de 35 TN</strong> (35,000 kg), o cuando se intentan mezclar lotes de diferentes clientes o variedades sin autorización expresa de mezcla.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: EL "1 ERROR" / LOTES DESAPROBADOS POR VETO */}
              <div className="bg-rose-950/20 border border-rose-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2.5 text-rose-300 font-bold text-sm">
                  <div className="p-1.5 bg-rose-500/20 rounded-lg">
                    <XCircle className="w-4 h-4 text-rose-400" />
                  </div>
                  <span>2. ¿Por qué figura "1 Error / Desaprobado"? (Veto Crítico de Calidad)</span>
                </div>
                <p className="text-slate-300">
                  En el módulo de evaluación, un lote recibe la condición de <strong>Desaprobado (marcado en rojo como 1 caso)</strong> cuando no alcanza el 86% de calidad o cuando infringe una regla técnica innegociable de la norma APIT:
                </p>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg space-y-2 text-[11px]">
                  <div className="text-rose-200 font-semibold">Parámetros que provocan el estado Desaprobado:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li><strong>Rendimiento Integral (RI) menor a 75%:</strong> Si el análisis físico reporta por ejemplo 70% de RI, el sistema lo desaprueba por bajo rendimiento industrial.</li>
                    <li><strong>Grano Verde (GV) mayor a 10%:</strong> Exceso de clorofila que mancharía el arroz vaporizado final.</li>
                    <li><strong>Grano Inmaduro (GI) mayor a 5%:</strong> Aumentaría el quebrado en el autoclave.</li>
                  </ul>
                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-amber-300 font-medium">¿Cómo resolverlo si el arroz ingresó a planta?</span>
                    <span className="text-emerald-400 font-bold">Usa el botón "🧪 Pasar a Experimental"</span>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: LA CAPACIDAD DE 35 TN (¿POR QUÉ EL NÚMERO 35?) */}
              <div className="bg-cyan-950/20 border border-cyan-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2.5 text-cyan-300 font-bold text-sm">
                  <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                    <Scale className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span>3. ¿Qué representa el número 35 en todo el sistema?</span>
                </div>
                <p className="text-slate-300">
                  El número <strong>35</strong> corresponde a la <strong>Capacidad Máxima Operativa del Autoclave Industrial APIT y sus Secadoras Cilíndricas (hasta 35 Toneladas = 35,000 kg)</strong>:
                </p>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg text-[11px] text-slate-300 space-y-1.5">
                  <p>
                    • Todo batch de vaporizado óptimo se calcula para completar hasta <strong>35,000 kg</strong> (aproximadamente 470 a 550 sacos de arroz en cáscara según peso por saco).
                  </p>
                  <p>
                    • Si los lotes seleccionados suman más de 35 TN o menos de 22 TN, el sistema muestra el aviso de advertencia para evitar sobrecargar la presión de vapor o secar con cámara vacía.
                  </p>
                  <p className="text-cyan-300 font-semibold pt-1">
                    👉 Consejo útil: En la pestaña "Programación de Batches", presiona el botón <strong>"⚡ Auto-Llenar Batch (35 TN)"</strong> para que el algoritmo seleccione los lotes y balancee los sacos a 35,000 kg exactos sin intervención manual.
                  </p>
                </div>
              </div>

              {/* SECCIÓN 4: RESUMEN DE LOS 4 ESTADOS DE CALIDAD */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Resumen de Colores e Iconos de Calidad
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <strong>Aprobado (&gt;96%):</strong> Calidad óptima, sin observaciones.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <strong>Observado (91% - 96%):</strong> Desviación leve, ajustar vaporizado.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-800/60 text-indigo-300">
                    <FlaskConical className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <strong>Experimental (86% - 90%):</strong> Requiere mezcla controlada.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <strong>Desaprobado (&lt;86%):</strong> Veto crítico, requiere reclasificación.
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-850 border-t border-slate-750 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowGuiaSignificados(false)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
              >
                Entendido, Cerrar Guía
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
