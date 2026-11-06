import React, { useState, useEffect, useMemo } from "react";
import { 
  Lote, 
  EstadoLote, 
  UserProfile, 
  RegistroHumedad, 
  AnalisisHumedo,
  BatchVaporizado,
  BatchLote,
  ControlVaporizado,
  AnalisisVaporizado
} from "../types";
import { 
  Package, 
  Plus, 
  Search, 
  Eye, 
  Edit3, 
  FileText, 
  CheckCircle, 
  Clock, 
  Filter, 
  Building, 
  MapPin, 
  Scale, 
  Droplet,
  FlaskConical,
  ExternalLink,
  ChevronRight,
  Info,
  ArrowRight,
  Sparkles,
  CalendarCheck,
  Activity,
  Layers,
  AlertTriangle,
  Award,
  CheckCircle2,
  Sliders,
  BarChart3,
  Trash2,
  Calendar,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  X,
  Percent,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { HumedadView } from "./HumedadView";
import { AnalisisHumedoView } from "./AnalisisHumedoView";
import { formatLoteCode } from "../utils/formatLoteCode";
import { buscarCoccionParaBatch, obtenerResultadosCoccionLocales } from "../utils/integracionCoccionService";
import { localDB } from "../utils/localDB";
import { normalizeDateToISO, calcularDiasTranscurridos } from "../utils/priorizacionService";

export const VARIEDADES_ARROZ_OPCIONES = [
  "TINAJONES",
  "SANTACRUZ",
  "NIR",
  "MARAÑON",
  "PAKAMURO",
  "MAYARES",
  "PUNTILLA",
  "FERON",
  "NOPAL",
  "VALOR",
  "IR-43",
  "CHICLAYO",
  "OTRA"
];

interface LotesViewProps {
  lotes?: Lote[];
  estados?: EstadoLote[];
  humedades?: RegistroHumedad[];
  analisisHumedos?: AnalisisHumedo[];
  batches?: BatchVaporizado[];
  batchLotes?: BatchLote[];
  controles?: ControlVaporizado[];
  analisisVapList?: AnalisisVaporizado[];
  currentUser?: UserProfile;
  initialLoteId?: string;
  initialSubTab?: "lotes" | "humedad" | "analisis-humedo" | "analisis-lote";
  onSaveLote: (lote: Partial<Lote>) => Promise<void>;
  onSaveHumedad?: (rec: Partial<RegistroHumedad>) => Promise<void>;
  onSaveAnalisisHum?: (analisis: Partial<AnalisisHumedo>) => Promise<void>;
  onDeleteLote?: (loteId: string) => Promise<void>;
  onOpenReport?: (loteId: string) => void;
  onOpenNewLote?: () => void;
  onOpenOCR?: () => void;
  onNavigate: (tab: string, filterId?: string) => void;
}

export const LotesView: React.FC<LotesViewProps> = ({
  lotes = [],
  estados = [],
  humedades = [],
  analisisHumedos = [],
  batches = [],
  batchLotes = [],
  controles = [],
  analisisVapList = [],
  currentUser,
  initialLoteId,
  initialSubTab = "lotes",
  onSaveLote,
  onSaveHumedad = async () => {},
  onSaveAnalisisHum = async () => {},
  onDeleteLote,
  onOpenReport,
  onOpenNewLote,
  onOpenOCR,
  onNavigate
}) => {
  const [subTab, setSubTab] = useState<"lotes" | "humedad" | "analisis-humedo" | "analisis-lote">(initialSubTab);
  const [activeLoteFocusId, setActiveLoteFocusId] = useState<string>(initialLoteId || lotes[0]?.LOTE_ID || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("");
  // Filtros Específicos Solicitados
  const [filtroVariedad, setFiltroVariedad] = useState<string>("TODOS");
  const [filtroHumedadMin, setFiltroHumedadMin] = useState<string>("");
  const [filtroHumedadMax, setFiltroHumedadMax] = useState<string>("");
  const [filtroDiasEsperaMin, setFiltroDiasEsperaMin] = useState<string>("");
  const [filtroDiasEsperaMax, setFiltroDiasEsperaMax] = useState<string>("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>("");
  const [filtroQuebradoMin, setFiltroQuebradoMin] = useState<string>("");
  const [filtroQuebradoMax, setFiltroQuebradoMax] = useState<string>("");
  const [isFiltrosAvanzadosOpen, setIsFiltrosAvanzadosOpen] = useState<boolean>(false);

  // Ordenamiento Solicitado: Humedad, Días en Espera, Fecha de Ingreso, % Quebrado y Variedad (Mayor a Menor / Menor a Mayor)
  const [criterioOrden, setCriterioOrden] = useState<"ninguno" | "humedad" | "diasEspera" | "fechaIngreso" | "quebrado" | "variedad">("ninguno");
  const [direccionOrden, setDireccionOrden] = useState<"desc" | "asc">("desc");

  const handleToggleOrden = (criterio: "humedad" | "diasEspera" | "fechaIngreso" | "quebrado" | "variedad") => {
    if (criterioOrden === criterio) {
      if (direccionOrden === "desc") {
        setDireccionOrden("asc");
      } else {
        setCriterioOrden("ninguno");
        setDireccionOrden("desc");
      }
    } else {
      setCriterioOrden(criterio);
      setDireccionOrden(criterio === "variedad" ? "asc" : "desc");
    }
  };

  const handleSelectOrden = (valor: string) => {
    if (valor === "ninguno") {
      setCriterioOrden("ninguno");
      setDireccionOrden("desc");
      return;
    }
    const [crit, dir] = valor.split("_") as ["humedad" | "diasEspera" | "fechaIngreso" | "quebrado" | "variedad", "asc" | "desc"];
    setCriterioOrden(crit);
    setDireccionOrden(dir || "desc");
  };

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [savedSuccessLoteId, setSavedSuccessLoteId] = useState<string | null>(null);
  const [isCustomVariedad, setIsCustomVariedad] = useState(false);
  const [customVariedadText, setCustomVariedadText] = useState("");
  const [loteToDelete, setLoteToDelete] = useState<string | null>(null);
  const [isDeletingLote, setIsDeletingLote] = useState(false);
  const [deleteLoteError, setDeleteLoteError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLoteId) {
      setActiveLoteFocusId(initialLoteId);
    }
  }, [initialLoteId]);

  const [createError, setCreateError] = useState<string | null>(null);

  // Normalize Lote code to C0 standard (e.g. '2020' -> 'C02020', '8432' -> 'C08432', 'CO8432' -> 'C08432')
  const normalizeLoteId = (input?: string): string => {
    return formatLoteCode(input) || "0";
  };

  // Calculate next sequential Lote code (e.g. C02026) ensuring uniqueness
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

  // Clean empty form template without pre-filled mock/dummy data, with today's date and initial value 0
  const getInitialNewLoteState = (): Partial<Lote> => ({
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

  const [newLoteData, setNewLoteData] = useState<Partial<Lote>>(getInitialNewLoteState());

  const currentNormalizedNewLoteId = useMemo(() => {
    if (!newLoteData.LOTE_ID || newLoteData.LOTE_ID === "0") return "0";
    return normalizeLoteId(newLoteData.LOTE_ID);
  }, [newLoteData.LOTE_ID]);

  const isDuplicateNewLote = useMemo(() => {
    if (!currentNormalizedNewLoteId || currentNormalizedNewLoteId === "0") return false;
    return lotes.some((l) => normalizeLoteId(l.LOTE_ID) === currentNormalizedNewLoteId);
  }, [currentNormalizedNewLoteId, lotes]);

  const handleOpenCreateModal = () => {
    setNewLoteData(getInitialNewLoteState());
    setIsCustomVariedad(false);
    setCustomVariedadText("");
    setSavedSuccessLoteId(null);
    setIsNewModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setNewLoteData(getInitialNewLoteState());
    setIsCustomVariedad(false);
    setCustomVariedadText("");
    setSavedSuccessLoteId(null);
    setIsNewModalOpen(false);
  };

  // Helper to compute humidity from 14 caladas sampling
  const getLoteHumidityInfo = (loteId: string, fallbackHum: number = 0) => {
    const matchHum = humedades.filter((h) => h.LOTE_ID === loteId);
    if (matchHum.length > 0) {
      const latest = matchHum[matchHum.length - 1];
      const avg = latest["H. PROMEDIO"] || (
        [latest.M1, latest.M2, latest.M3, latest.M4, latest.M5, latest.M6, latest.M7,
         latest.M8, latest.M9, latest.M10, latest.M11, latest.M12, latest.M13, latest.M14]
        .filter((v) => typeof v === "number" && v > 0)
        .reduce((a, b, _, arr) => a + b / arr.length, 0)
      );
      if (avg > 0) {
        return {
          hum: Number(avg.toFixed(2)),
          hasRegisteredHum: true,
          caladasCount: 14,
          desv: latest["DESV."] || 0,
          record: latest
        };
      }
    }
    return {
      hum: fallbackHum || 0,
      hasRegisteredHum: false,
      caladasCount: 0,
      desv: 0,
      record: null
    };
  };

  // Helper to check if Lote has Analisis Humedo
  const getLoteAnalisisHumedo = (loteId: string) => {
    return analisisHumedos.find((ah) => matchLoteCode(ah.LOTE_ID, loteId));
  };

  // Flexible comparison for lote codes (supports C02020 vs 2020, casing, etc.)
  const matchLoteCode = (a?: string, b?: string): boolean => {
    if (!a || !b) return false;
    const cleanA = a.trim().toUpperCase();
    const cleanB = b.trim().toUpperCase();
    if (cleanA === cleanB) return true;
    const fA = formatLoteCode(cleanA);
    const fB = formatLoteCode(cleanB);
    return Boolean(fA && fB && fA === fB);
  };

  // Helper to dynamically calculate each lote's real-time state across the plant workflow
  const getComputedLoteStatus = (lote: Lote): {
    estado: string;
    isProcesado: boolean;
    batchAsociado?: BatchVaporizado;
  } => {
    const rawEstado = (lote.ESTADO_LOTE || "").toUpperCase();
    if (rawEstado === "PROCESADO" || rawEstado === "CERRADO" || rawEstado === "TERMINADO") {
      return { estado: "PROCESADO", isProcesado: true };
    }

    const effectiveBL = (batchLotes && batchLotes.length > 0) ? batchLotes : (localDB.getState().batchLotes || []);
    const effectiveBatches = (batches && batches.length > 0) ? batches : (localDB.getState().batchesVaporizado || []);
    const effectiveControles = (controles && controles.length > 0) ? controles : (localDB.getState().controlVaporizado || []);
    const effectiveAnalisisVap = (analisisVapList && analisisVapList.length > 0) ? analisisVapList : (localDB.getState().analisisVaporizado || []);
    const effectiveAnalisisSec = localDB.getState().analisisSeco || [];

    const assignedBL = effectiveBL.filter(bl => matchLoteCode(bl.LOTE_ID, lote.LOTE_ID));
    const batchIds = new Set(assignedBL.map(bl => (bl.BATCH_ID || "").trim().toUpperCase()));

    const matchingBatches = effectiveBatches.filter(b => 
      batchIds.has((b.BATCH_ID || "").trim().toUpperCase()) ||
      batchIds.has((b.CORRELATIVO || "").trim().toUpperCase()) ||
      (Array.isArray(b.LOTES_UNION) && b.LOTES_UNION.some(lid => matchLoteCode(lid, lote.LOTE_ID))) ||
      (Array.isArray((b as any).lotes) && (b as any).lotes.some((lid: string) => matchLoteCode(lid, lote.LOTE_ID))) ||
      (typeof (b as any).lote === "string" && matchLoteCode((b as any).lote, lote.LOTE_ID))
    );

    if (matchingBatches.length > 0) {
      const batch = matchingBatches[0];
      const bId = (batch.BATCH_ID || "").trim().toUpperCase();
      const bCorr = (batch.CORRELATIVO || "").trim().toUpperCase();

      // 1. Muestras de calidad de descarga
      const muestrasDescarga = effectiveAnalisisVap.filter(a => {
        const aB = (a.BATCH_ID || "").trim().toUpperCase();
        const aL = (a.LOTE_ID || "").trim().toUpperCase();
        return (aB && (aB === bId || aB === bCorr)) || (aL && matchLoteCode(aL, lote.LOTE_ID));
      });
      const muestrasSecas = effectiveAnalisisSec.filter(s => {
        const sB = (s.BATCH_ID || "").trim().toUpperCase();
        const sL = (s.LOTE_ID || "").trim().toUpperCase();
        return (sB && (sB === bId || sB === bCorr)) || (sL && matchLoteCode(sL, lote.LOTE_ID));
      });
      const tieneDescarga = muestrasDescarga.length > 0 || muestrasSecas.length > 0;

      // 2. Resultados de cocción
      const locales = obtenerResultadosCoccionLocales();
      const coccion = buscarCoccionParaBatch(batch.BATCH_ID, batch.CORRELATIVO, [lote.LOTE_ID], locales);
      const tieneCoccion = Boolean(coccion && (
        (coccion.puntajeCoccion !== undefined && Number(coccion.puntajeCoccion) > 0) ||
        coccion.tiempoCoccionMin || 
        coccion.tazasArroz || 
        (coccion as any).esDatoReal
      ));

      // Requisito: Si se subió todo (descarga + cocción) o si el batch está CERRADO: PROCESADO
      const batchEsCerrado = Boolean(
        batch.ESTADO_BATCH && (
          batch.ESTADO_BATCH.toUpperCase() === "CERRADO" ||
          batch.ESTADO_BATCH.toUpperCase() === "PROCESADO"
        )
      );

      if (batchEsCerrado || (tieneDescarga && tieneCoccion)) {
        return { estado: "PROCESADO", isProcesado: true, batchAsociado: batch };
      }

      // 3. Ficha de control de vaporizado guardada y liquidada: VAPORIZADO
      const ctrl = effectiveControles.find(c => {
        const cB = (c.BATCH_ID || "").trim().toUpperCase();
        const cC = (c.CORRELATIVO || "").trim().toUpperCase();
        const cCod = (c.CODIGO_INTERNO || "").trim().toUpperCase();
        return (cB && (cB === bId || cB === bCorr)) || (cC && (cC === bId || cC === bCorr)) || (cCod && (cCod === bId || cCod === bCorr));
      });

      const esLiquidado = Boolean(
        (ctrl && ((ctrl as any).liquidado || (ctrl as any).ESTADO_PROCESO === "CONFORME" || (ctrl as any).FECHA_HORA_FIN || ((ctrl as any).HORA_INICIO && (ctrl as any).HORA_INICIO.trim() !== "") || ctrl.FECHA_HORA_INICIO || ctrl.datosIngreso?.codigo)) ||
        (batch.ESTADO_BATCH && (
          batch.ESTADO_BATCH.toUpperCase() === "VAPORIZADO" ||
          batch.ESTADO_BATCH.toUpperCase() === "COMPLETADO" ||
          batch.ESTADO_BATCH.toUpperCase() === "TERMINADO"
        )) ||
        tieneDescarga
      );

      if (ctrl || esLiquidado) {
        return { estado: "VAPORIZADO", isProcesado: false, batchAsociado: batch };
      }

      if (batch.ESTADO_BATCH && (batch.ESTADO_BATCH.toUpperCase() === "EN PROCESO" || batch.ESTADO_BATCH.toUpperCase() === "EN_PROCESO")) {
        return { estado: "EN PROCESO", isProcesado: false, batchAsociado: batch };
      }

      return { estado: "PROGRAMADO", isProcesado: false, batchAsociado: batch };
    }

    // Si tiene programación APIT
    const effectiveProgs = localDB.getState().programacionApit || [];
    const tieneProg = effectiveProgs.some(p => matchLoteCode(p.LOTE_ID, lote.LOTE_ID));
    if (tieneProg) {
      return { estado: "PROGRAMADO", isProcesado: false };
    }

    if (rawEstado === "EXPERIMENTAL") return { estado: "EXPERIMENTAL", isProcesado: false };
    if (rawEstado === "OBSERVADO") return { estado: "OBSERVADO", isProcesado: false };
    if (rawEstado === "DESAPROBADO") return { estado: "DESAPROBADO", isProcesado: false };

    return { estado: "INGRESADO", isProcesado: false };
  };

  const handleConfirmDeleteLote = async () => {
    if (!loteToDelete) return;
    setIsDeletingLote(true);
    setDeleteLoteError(null);
    try {
      if (onDeleteLote) {
        await onDeleteLote(loteToDelete);
      } else {
        localDB.deleteLote(loteToDelete, currentUser?.nombre || "Operador", true);
      }
      setLoteToDelete(null);
    } catch (err: any) {
      console.error("Error eliminando lote:", err);
      setDeleteLoteError(err.message || "Error al eliminar lote");
    } finally {
      setIsDeletingLote(false);
    }
  };

  // Lista de variedades disponibles
  const variedadesDisponibles = useMemo(() => {
    const set = new Set<string>();
    VARIEDADES_ARROZ_OPCIONES.forEach((v) => {
      if (v && v !== "OTRA") set.add(v.trim().toUpperCase());
    });
    lotes.forEach((l) => {
      if (l.VARIEDAD) {
        const u = l.VARIEDAD.trim().toUpperCase();
        if (u) set.add(u);
      }
    });
    return Array.from(set).sort();
  }, [lotes]);

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (filtroVariedad && filtroVariedad !== "TODOS") count++;
    if (filtroHumedadMin !== "" || filtroHumedadMax !== "") count++;
    if (filtroDiasEsperaMin !== "" || filtroDiasEsperaMax !== "") count++;
    if (filtroFechaDesde !== "" || filtroFechaHasta !== "") count++;
    if (filtroQuebradoMin !== "" || filtroQuebradoMax !== "") count++;
    return count;
  }, [
    filtroVariedad,
    filtroHumedadMin,
    filtroHumedadMax,
    filtroDiasEsperaMin,
    filtroDiasEsperaMax,
    filtroFechaDesde,
    filtroFechaHasta,
    filtroQuebradoMin,
    filtroQuebradoMax
  ]);

  const handleLimpiarFiltrosAvanzados = () => {
    setFiltroVariedad("TODOS");
    setFiltroHumedadMin("");
    setFiltroHumedadMax("");
    setFiltroDiasEsperaMin("");
    setFiltroDiasEsperaMax("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroQuebradoMin("");
    setFiltroQuebradoMax("");
  };

  const handleLimpiarTodosLosFiltros = () => {
    setSearchTerm("");
    setSelectedEstado("");
    handleLimpiarFiltrosAvanzados();
  };

  // Filters
  const filteredLotes = lotes.filter((l) => {
    const comp = getComputedLoteStatus(l);
    const humInfo = getLoteHumidityInfo(l.LOTE_ID, l.HUM);
    const anHumedo = getLoteAnalisisHumedo(l.LOTE_ID);

    const matchesSearch = 
      (l.LOTE_ID || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.CLIENTE || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.VARIEDAD || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.ZONA || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = selectedEstado ? comp.estado === selectedEstado || l.ESTADO_LOTE === selectedEstado : true;

    // 1. Variedad
    let matchesVariedad = true;
    if (filtroVariedad && filtroVariedad !== "TODOS") {
      const vLote = (l.VARIEDAD || anHumedo?.VARIEDAD || "").toString().trim().toUpperCase();
      matchesVariedad = vLote === filtroVariedad.trim().toUpperCase();
    }

    // 2. Humedad
    let matchesHumedad = true;
    const humVal = Number(humInfo?.hum || l.HUM || l.HUMEDAD || anHumedo?.HUMEDADES || 0);
    if (filtroHumedadMin !== "" && !isNaN(Number(filtroHumedadMin))) {
      if (humVal < Number(filtroHumedadMin)) matchesHumedad = false;
    }
    if (filtroHumedadMax !== "" && !isNaN(Number(filtroHumedadMax))) {
      if (humVal > Number(filtroHumedadMax)) matchesHumedad = false;
    }

    // 3. Días en espera
    let matchesDiasEspera = true;
    const diasVal = l.FECHA_INGRESO ? calcularDiasTranscurridos(l.FECHA_INGRESO) : 0;
    if (filtroDiasEsperaMin !== "" && !isNaN(Number(filtroDiasEsperaMin))) {
      if (diasVal < Number(filtroDiasEsperaMin)) matchesDiasEspera = false;
    }
    if (filtroDiasEsperaMax !== "" && !isNaN(Number(filtroDiasEsperaMax))) {
      if (diasVal > Number(filtroDiasEsperaMax)) matchesDiasEspera = false;
    }

    // 4. Fecha de ingreso
    let matchesFecha = true;
    const fIngresoISO = l.FECHA_INGRESO ? normalizeDateToISO(l.FECHA_INGRESO) : "";
    if (filtroFechaDesde !== "") {
      if (!fIngresoISO || fIngresoISO < filtroFechaDesde) matchesFecha = false;
    }
    if (filtroFechaHasta !== "") {
      if (!fIngresoISO || fIngresoISO > filtroFechaHasta) matchesFecha = false;
    }

    // 5. Quebrado
    let matchesQuebrado = true;
    const qb = anHumedo?.QB !== undefined && anHumedo.QB !== null ? Number(anHumedo.QB) : undefined;
    const qi = anHumedo?.QI !== undefined && anHumedo.QI !== null ? Number(anHumedo.QI) : undefined;
    const quebradoVal = qb !== undefined ? qb : (qi !== undefined ? qi : undefined);
    if (filtroQuebradoMin !== "" && !isNaN(Number(filtroQuebradoMin))) {
      if (quebradoVal === undefined || quebradoVal < Number(filtroQuebradoMin)) matchesQuebrado = false;
    }
    if (filtroQuebradoMax !== "" && !isNaN(Number(filtroQuebradoMax))) {
      if (quebradoVal === undefined || quebradoVal > Number(filtroQuebradoMax)) matchesQuebrado = false;
    }

    return (
      matchesSearch && 
      matchesEstado && 
      matchesVariedad && 
      matchesHumedad && 
      matchesDiasEspera && 
      matchesFecha && 
      matchesQuebrado
    );
  });

  // Ordenamiento de Lotes (De Mayor a Menor / Menor a Mayor en Humedad, Días en Espera, Fecha de Ingreso, % Quebrado y Variedad)
  const sortedLotes = useMemo(() => {
    if (criterioOrden === "ninguno") return filteredLotes;

    const list = [...filteredLotes];
    return list.sort((a, b) => {
      const humA = getLoteHumidityInfo(a.LOTE_ID, a.HUM);
      const humB = getLoteHumidityInfo(b.LOTE_ID, b.HUM);
      const anA = getLoteAnalisisHumedo(a.LOTE_ID);
      const anB = getLoteAnalisisHumedo(b.LOTE_ID);

      if (criterioOrden === "humedad") {
        const valA = Number(humA?.hum || a.HUM || a.HUMEDAD || anA?.HUMEDADES || 0);
        const valB = Number(humB?.hum || b.HUM || b.HUMEDAD || anB?.HUMEDADES || 0);
        return direccionOrden === "desc" ? valB - valA : valA - valB;
      }

      if (criterioOrden === "diasEspera") {
        const valA = a.FECHA_INGRESO ? calcularDiasTranscurridos(a.FECHA_INGRESO) : 0;
        const valB = b.FECHA_INGRESO ? calcularDiasTranscurridos(b.FECHA_INGRESO) : 0;
        return direccionOrden === "desc" ? valB - valA : valA - valB;
      }

      if (criterioOrden === "fechaIngreso") {
        const isoA = a.FECHA_INGRESO ? normalizeDateToISO(a.FECHA_INGRESO) : "";
        const isoB = b.FECHA_INGRESO ? normalizeDateToISO(b.FECHA_INGRESO) : "";
        const timeA = isoA ? new Date(isoA).getTime() : 0;
        const timeB = isoB ? new Date(isoB).getTime() : 0;
        return direccionOrden === "desc" ? timeB - timeA : timeA - timeB;
      }

      if (criterioOrden === "quebrado") {
        const getQ = (item: Lote, an: AnalisisHumedo | undefined) => {
          const qb = an?.QB !== undefined && an.QB !== null ? Number(an.QB) : undefined;
          const qi = an?.QI !== undefined && an.QI !== null ? Number(an.QI) : undefined;
          return qb !== undefined ? qb : (qi !== undefined ? qi : -1);
        };
        const valA = getQ(a, anA);
        const valB = getQ(b, anB);
        return direccionOrden === "desc" ? valB - valA : valA - valB;
      }

      if (criterioOrden === "variedad") {
        const varA = (a.VARIEDAD || anA?.VARIEDAD || "").toString().trim().toUpperCase();
        const varB = (b.VARIEDAD || anB?.VARIEDAD || "").toString().trim().toUpperCase();
        return direccionOrden === "desc" ? varB.localeCompare(varA) : varA.localeCompare(varB);
      }

      return 0;
    });
  }, [filteredLotes, criterioOrden, direccionOrden, humedades, analisisHumedos]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PROCESADO":
      case "CERRADO":
      case "EVALUADO":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "VAPORIZADO":
        return "bg-purple-950 text-purple-300 border-purple-800";
      case "EN PROCESO":
      case "EN SECADO":
        return "bg-amber-950 text-amber-300 border-amber-800 animate-pulse";
      case "PROGRAMADO":
        return "bg-cyan-950 text-cyan-300 border-cyan-800";
      case "ANALIZADO":
      case "APTO":
        return "bg-blue-950 text-blue-300 border-blue-800";
      case "OBSERVADO":
      case "EXPERIMENTAL":
        return "bg-rose-950 text-rose-300 border-rose-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const selectedFocusLote = lotes.find((l) => l.LOTE_ID === activeLoteFocusId) || lotes[0];
  const focusHumInfo = selectedFocusLote ? getLoteHumidityInfo(selectedFocusLote.LOTE_ID, selectedFocusLote.HUM) : null;
  const focusAnalisis = selectedFocusLote ? getLoteAnalisisHumedo(selectedFocusLote.LOTE_ID) : null;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Main Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Módulo Integral de Lotes y Calidad Inicial
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestión completa de ingreso C0, muestreo de 14 caladas, análisis físico húmedo y evaluación integral.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-register-lote"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Nuevo Lote C0
          </button>
        </div>
      </div>

      {/* Internal Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-750 pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab("lotes")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "lotes"
              ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
              : "bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>1. Maestro de Lotes ({lotes.length})</span>
        </button>

        <button
          onClick={() => setSubTab("humedad")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "humedad"
              ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
              : "bg-slate-800 text-cyan-300 hover:bg-slate-750 hover:text-cyan-200 border border-cyan-500/20"
          }`}
        >
          <Droplet className="w-4 h-4" />
          <span>2. Registro de Humedad (14 Caladas)</span>
        </button>

        <button
          onClick={() => setSubTab("analisis-humedo")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "analisis-humedo"
              ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
              : "bg-slate-800 text-emerald-300 hover:bg-slate-750 hover:text-emerald-200 border border-emerald-500/20"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>3. Análisis Físico Húmedo</span>
        </button>

        <button
          onClick={() => setSubTab("analisis-lote")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            subTab === "analisis-lote"
              ? "bg-indigo-500 text-white shadow-md font-extrabold"
              : "bg-slate-800 text-indigo-300 hover:bg-slate-750 hover:text-indigo-200 border border-indigo-500/20"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>4. Análisis Integral del Lote</span>
        </button>
      </div>

      {/* SUBTAB 1: MAESTRO DE LOTES */}
      {subTab === "lotes" && (
        <div className="space-y-4">
          {/* Process Flow Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Flujo de Calidad Integrado:</strong> 1. Ingresar Lote (C0) → 2. Registrar 14 Caladas de Humedad (promedio automático) → 3. Análisis Físico Húmedo → 4. Análisis Integral / Programación.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSubTab("humedad")}
                className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Registrar Caladas <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Search & Filter bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="input-search-lotes"
                type="text"
                placeholder="Buscar por código de lote (Ej. C02020), cliente, variedad, zona..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                id="select-lote-filter-estado"
                aria-label="Filtrar por estado del lote"
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
                className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos los Estados</option>
                {estados.map((est) => (
                  <option key={est.ESTADO_ID} value={est.ESTADO}>{est.ESTADO}</option>
                ))}
              </select>

              <button
                type="button"
                id="btn-toggle-filtros-lotes-view"
                onClick={() => setIsFiltrosAvanzadosOpen(!isFiltrosAvanzadosOpen)}
                className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between sm:justify-start gap-1.5 cursor-pointer border ${
                  activeAdvancedFilterCount > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm ring-1 ring-amber-500/40"
                    : isFiltrosAvanzadosOpen
                    ? "bg-slate-700 text-white border-slate-500 shadow-sm"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
                }`}
                title="Filtrar por humedad, días en espera, fecha de ingreso, quebrado y variedad"
              >
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Filtros Específicos</span>
                </div>
                {activeAdvancedFilterCount > 0 ? (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-mono font-bold text-[10px] flex items-center justify-center">
                    {activeAdvancedFilterCount}
                  </span>
                ) : (
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFiltrosAvanzadosOpen ? "rotate-180" : ""}`} />
                )}
              </button>
            </div>
          </div>

          {/* Panel de Filtros Específicos Solicitados (Variedad, Humedad, Días en Espera, Fecha de Ingreso, Quebrado) */}
          {(isFiltrosAvanzadosOpen || activeAdvancedFilterCount > 0) && (
            <div className="bg-slate-850/95 border border-slate-700/80 rounded-xl p-3.5 space-y-3 shadow-md animate-fade-in backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Filtros de Parámetros de Lotes</span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    (Humedad, Días en Espera, Fecha de Ingreso, % Quebrado y Variedad)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeAdvancedFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleLimpiarFiltrosAvanzados}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors border border-amber-500/30"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restablecer Filtros ({activeAdvancedFilterCount})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFiltrosAvanzadosOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                    title="Ocultar panel de filtros"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Grid de 5 Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Variedad */}
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-850 space-y-1.5 flex flex-col justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-400" />
                      Variedad
                    </span>
                    {filtroVariedad !== "TODOS" && (
                      <button
                        type="button"
                        onClick={() => setFiltroVariedad("TODOS")}
                        className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Borrar
                      </button>
                    )}
                  </label>
                  <select
                    id="filtro-lote-variedad-lotesview"
                    aria-label="Filtrar por variedad de arroz"
                    value={filtroVariedad}
                    onChange={(e) => setFiltroVariedad(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="TODOS">Todas las Variedades</option>
                    {variedadesDisponibles.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-slate-500 truncate">
                    {filtroVariedad !== "TODOS" ? `Activo: ${filtroVariedad}` : `${variedadesDisponibles.length} variedades`}
                  </div>
                </div>

                {/* 2. Humedad */}
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-850 space-y-1.5 flex flex-col justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Droplet className="w-3.5 h-3.5 text-sky-400" />
                      Humedad (%)
                    </span>
                    {(filtroHumedadMin !== "" || filtroHumedadMax !== "") && (
                      <button
                        type="button"
                        onClick={() => { setFiltroHumedadMin(""); setFiltroHumedadMax(""); }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Borrar
                      </button>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="filtro-lote-humedad-min-lotesview"
                      type="number"
                      step="0.1"
                      placeholder="Min %"
                      value={filtroHumedadMin}
                      onChange={(e) => setFiltroHumedadMin(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-750 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <span className="text-slate-500 text-xs">-</span>
                    <input
                      id="filtro-lote-humedad-max-lotesview"
                      type="number"
                      step="0.1"
                      placeholder="Max %"
                      value={filtroHumedadMax}
                      onChange={(e) => setFiltroHumedadMax(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-750 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setFiltroHumedadMin(""); setFiltroHumedadMax("13.0"); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroHumedadMin === "" && filtroHumedadMax === "13.0"
                          ? "bg-sky-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      &lt;13%
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFiltroHumedadMin("13.0"); setFiltroHumedadMax("15.0"); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroHumedadMin === "13.0" && filtroHumedadMax === "15.0"
                          ? "bg-sky-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      13-15%
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFiltroHumedadMin("15.1"); setFiltroHumedadMax(""); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroHumedadMin === "15.1" && filtroHumedadMax === ""
                          ? "bg-sky-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      &gt;15%
                    </button>
                  </div>
                </div>

                {/* 3. Días en Espera */}
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-855 space-y-1.5 flex flex-col justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Días en Espera
                    </span>
                    {(filtroDiasEsperaMin !== "" || filtroDiasEsperaMax !== "") && (
                      <button
                        type="button"
                        onClick={() => { setFiltroDiasEsperaMin(""); setFiltroDiasEsperaMax(""); }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Borrar
                      </button>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="filtro-lote-dias-min-lotesview"
                      type="number"
                      min="0"
                      placeholder="Min d"
                      value={filtroDiasEsperaMin}
                      onChange={(e) => setFiltroDiasEsperaMin(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-750 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="text-slate-500 text-xs">-</span>
                    <input
                      id="filtro-lote-dias-max-lotesview"
                      type="number"
                      min="0"
                      placeholder="Max d"
                      value={filtroDiasEsperaMax}
                      onChange={(e) => setFiltroDiasEsperaMax(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-750 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setFiltroDiasEsperaMin("0"); setFiltroDiasEsperaMax("5"); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroDiasEsperaMin === "0" && filtroDiasEsperaMax === "5"
                          ? "bg-amber-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      0-5d
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFiltroDiasEsperaMin("6"); setFiltroDiasEsperaMax("15"); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroDiasEsperaMin === "6" && filtroDiasEsperaMax === "15"
                          ? "bg-amber-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      6-15d
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFiltroDiasEsperaMin("16"); setFiltroDiasEsperaMax(""); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroDiasEsperaMin === "16" && filtroDiasEsperaMax === ""
                          ? "bg-amber-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      &gt;15d
                    </button>
                  </div>
                </div>

                {/* 4. Fecha de Ingreso */}
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-850 space-y-1.5 flex flex-col justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      Fecha de Ingreso
                    </span>
                    {(filtroFechaDesde !== "" || filtroFechaHasta !== "") && (
                      <button
                        type="button"
                        onClick={() => { setFiltroFechaDesde(""); setFiltroFechaHasta(""); }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Borrar
                      </button>
                    )}
                  </label>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 w-10 shrink-0">Desde:</span>
                      <input
                        id="filtro-lote-fecha-desde-lotesview"
                        type="date"
                        value={filtroFechaDesde}
                        onChange={(e) => setFiltroFechaDesde(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-750 rounded-md px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 w-10 shrink-0">Hasta:</span>
                      <input
                        id="filtro-lote-fecha-hasta-lotesview"
                        type="date"
                        value={filtroFechaHasta}
                        onChange={(e) => setFiltroFechaHasta(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-750 rounded-md px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. % Quebrado */}
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-850 space-y-1.5 flex flex-col justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-rose-400" />
                      % Quebrado
                    </span>
                    {(filtroQuebradoMin !== "" || filtroQuebradoMax !== "") && (
                      <button
                        type="button"
                        onClick={() => { setFiltroQuebradoMin(""); setFiltroQuebradoMax(""); }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
                      >
                        Borrar
                      </button>
                    )}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="filtro-lote-quebrado-min-lotesview"
                      type="number"
                      step="0.1"
                      placeholder="Min %"
                      value={filtroQuebradoMin}
                      onChange={(e) => setFiltroQuebradoMin(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-750 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <span className="text-slate-500 text-xs">-</span>
                    <input
                      id="filtro-lote-quebrado-max-lotesview"
                      type="number"
                      step="0.1"
                      placeholder="Max %"
                      value={filtroQuebradoMax}
                      onChange={(e) => setFiltroQuebradoMax(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-750 rounded-md px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setFiltroQuebradoMin(""); setFiltroQuebradoMax("15.0"); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroQuebradoMin === "" && filtroQuebradoMax === "15.0"
                          ? "bg-rose-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      &lt;15%
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFiltroQuebradoMin("15.0"); setFiltroQuebradoMax("20.0"); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroQuebradoMin === "15.0" && filtroQuebradoMax === "20.0"
                          ? "bg-rose-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      15-20%
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFiltroQuebradoMin("20.1"); setFiltroQuebradoMax(""); }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        filtroQuebradoMin === "20.1" && filtroQuebradoMax === ""
                          ? "bg-rose-600 text-white font-bold"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white"
                      }`}
                    >
                      &gt;20%
                    </button>
                  </div>
                </div>
              </div>

              {/* Badges / Chips de Filtros Activos */}
              {activeAdvancedFilterCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400">Filtros aplicados:</span>
                  {filtroVariedad !== "TODOS" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <span>🌾 Variedad: {filtroVariedad}</span>
                      <button type="button" onClick={() => setFiltroVariedad("TODOS")} className="hover:text-white cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {(filtroHumedadMin !== "" || filtroHumedadMax !== "") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                      <span>💧 Humedad: {filtroHumedadMin || "0"}% - {filtroHumedadMax || "∞"}%</span>
                      <button type="button" onClick={() => { setFiltroHumedadMin(""); setFiltroHumedadMax(""); }} className="hover:text-white cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {(filtroDiasEsperaMin !== "" || filtroDiasEsperaMax !== "") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <span>⏱️ Espera: {filtroDiasEsperaMin || "0"}d - {filtroDiasEsperaMax || "∞"}d</span>
                      <button type="button" onClick={() => { setFiltroDiasEsperaMin(""); setFiltroDiasEsperaMax(""); }} className="hover:text-white cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {(filtroFechaDesde !== "" || filtroFechaHasta !== "") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      <span>📅 Fecha: {filtroFechaDesde || "Inicio"} a {filtroFechaHasta || "Hoy"}</span>
                      <button type="button" onClick={() => { setFiltroFechaDesde(""); setFiltroFechaHasta(""); }} className="hover:text-white cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {(filtroQuebradoMin !== "" || filtroQuebradoMax !== "") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      <span>📉 Quebrado: {filtroQuebradoMin || "0"}% - {filtroQuebradoMax || "∞"}%</span>
                      <button type="button" onClick={() => { setFiltroQuebradoMin(""); setFiltroQuebradoMax(""); }} className="hover:text-white cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 ml-auto font-mono">
                    {filteredLotes.length} lote{filteredLotes.length !== 1 ? "s" : ""} coincidente{filteredLotes.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* BARRA DE ORDENAMIENTO (De Mayor a Menor / Menor a Mayor) */}
          <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-750 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Ordenar Lotes:</span>
              </span>

              {/* Botón rápido Humedad */}
              <button
                type="button"
                id="btn-orden-humedad-lotesview"
                onClick={() => handleToggleOrden("humedad")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  criterioOrden === "humedad"
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
                }`}
                title="Ordenar por Humedad: Primero Mayor a Menor (↓), o Menor a Mayor (↑)"
              >
                <span>💧 Humedad</span>
                {criterioOrden === "humedad" ? (
                  <span className="bg-slate-950/20 px-1 rounded text-[10px] font-mono">
                    {direccionOrden === "desc" ? "Mayor a Menor ↓" : "Menor a Mayor ↑"}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-60">Mayor a Menor</span>
                )}
              </button>

              {/* Botón rápido Días en Espera */}
              <button
                type="button"
                id="btn-orden-dias-lotesview"
                onClick={() => handleToggleOrden("diasEspera")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  criterioOrden === "diasEspera"
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
                }`}
                title="Ordenar por Días en Espera: Primero Mayor a Menor (↓ Más crítico), o Menor a Mayor (↑)"
              >
                <span>⏳ Días en Espera</span>
                {criterioOrden === "diasEspera" ? (
                  <span className="bg-slate-950/20 px-1 rounded text-[10px] font-mono">
                    {direccionOrden === "desc" ? "Mayor a Menor ↓" : "Menor a Mayor ↑"}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-60">Mayor a Menor</span>
                )}
              </button>

              {/* Botón rápido Fecha de Ingreso */}
              <button
                type="button"
                id="btn-orden-fecha-lotesview"
                onClick={() => handleToggleOrden("fechaIngreso")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  criterioOrden === "fechaIngreso"
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
                }`}
                title="Ordenar por Fecha de Ingreso: Más reciente (↓) o más antiguo (↑)"
              >
                <span>📅 Fecha Ingreso</span>
                {criterioOrden === "fechaIngreso" ? (
                  <span className="bg-slate-950/20 px-1 rounded text-[10px] font-mono">
                    {direccionOrden === "desc" ? "Más Reciente ↓" : "Más Antiguo ↑"}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-60">Reciente</span>
                )}
              </button>

              {/* Botón rápido % Quebrado */}
              <button
                type="button"
                id="btn-orden-quebrado-lotesview"
                onClick={() => handleToggleOrden("quebrado")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  criterioOrden === "quebrado"
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
                }`}
                title="Ordenar por % Quebrado: Primero Mayor a Menor (↓), o Menor a Mayor (↑)"
              >
                <span>🌾 % Quebrado</span>
                {criterioOrden === "quebrado" ? (
                  <span className="bg-slate-950/20 px-1 rounded text-[10px] font-mono">
                    {direccionOrden === "desc" ? "Mayor a Menor ↓" : "Menor a Mayor ↑"}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-60">Mayor a Menor</span>
                )}
              </button>

              {/* Botón rápido Variedad */}
              <button
                type="button"
                id="btn-orden-variedad-lotesview"
                onClick={() => handleToggleOrden("variedad")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  criterioOrden === "variedad"
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white"
                }`}
                title="Ordenar por Variedad: Alfabético A → Z o Z → A"
              >
                <span>🔤 Variedad</span>
                {criterioOrden === "variedad" ? (
                  <span className="bg-slate-950/20 px-1 rounded text-[10px] font-mono">
                    {direccionOrden === "asc" ? "A → Z ↑" : "Z → A ↓"}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-60">A → Z</span>
                )}
              </button>
            </div>

            {/* Selector desplegable y botón restablecer orden */}
            <div className="flex items-center gap-2 ml-auto">
              <select
                aria-label="Seleccionar criterio de ordenamiento"
                value={criterioOrden === "ninguno" ? "ninguno" : `${criterioOrden}_${direccionOrden}`}
                onChange={(e) => handleSelectOrden(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
              >
                <option value="ninguno">Orden Original (Sin ordenar)</option>
                <option value="humedad_desc">💧 Humedad: Mayor a Menor (↓)</option>
                <option value="humedad_asc">💧 Humedad: Menor a Mayor (↑)</option>
                <option value="diasEspera_desc">⏳ Días en Espera: Mayor a Menor (↓ Más crítico)</option>
                <option value="diasEspera_asc">⏳ Días en Espera: Menor a Mayor (↑)</option>
                <option value="fechaIngreso_desc">📅 Fecha Ingreso: Más reciente a más antiguo (↓)</option>
                <option value="fechaIngreso_asc">📅 Fecha Ingreso: Más antiguo a más reciente (↑)</option>
                <option value="quebrado_desc">🌾 % Quebrado: Mayor a Menor (↓ Más quebrado)</option>
                <option value="quebrado_asc">🌾 % Quebrado: Menor a Mayor (↑ Menos quebrado)</option>
                <option value="variedad_asc">🔤 Variedad: A → Z (↑)</option>
                <option value="variedad_desc">🔤 Variedad: Z → A (↓)</option>
              </select>

              {criterioOrden !== "ninguno" && (
                <button
                  type="button"
                  onClick={() => {
                    setCriterioOrden("ninguno");
                    setDireccionOrden("desc");
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded text-xs flex items-center gap-1 border border-slate-700 cursor-pointer"
                  title="Restablecer orden predeterminado de los lotes"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span className="hidden sm:inline">Restablecer</span>
                </button>
              )}
            </div>
          </div>

          {/* Lotes Cards / Table View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedLotes.map((lote) => {
              const compStatus = getComputedLoteStatus(lote);
              const humInfo = getLoteHumidityInfo(lote.LOTE_ID, lote.HUM);
              const anHumedo = getLoteAnalisisHumedo(lote.LOTE_ID);

              return (
                <div
                  key={lote.LOTE_ID}
                  className="bg-slate-800 hover:bg-slate-750 transition-all rounded-xl border border-slate-700/80 p-4 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                      <div>
                        <span className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/30">
                          {lote.LOTE_ID}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-1">{lote.FECHA_INGRESO || "Fecha sin registrar"}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(compStatus.estado)}`}>
                        {compStatus.estado}
                      </span>
                    </div>

                    {/* Body Info */}
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold truncate">{lote.CLIENTE || "Cliente no especificado"}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-slate-400">{lote.ZONA || "Sin zona"}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-800/60 rounded text-[11px] text-amber-300 font-bold">
                          {lote.VARIEDAD || "Sin variedad"}
                        </span>
                      </div>

                      {/* Metrics: Sacos, Peso y Humedad Promedio Automática */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-900/80 rounded-lg p-2 text-center text-slate-300 text-[11px] border border-slate-750">
                        <div>
                          <div className="text-slate-400 text-[10px]">Sacos</div>
                          <div className="font-bold text-white">{lote.SACOS || 0}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">Peso Total</div>
                          <div className="font-bold text-white">{lote.PESO_KG ? `${(lote.PESO_KG / 1000).toFixed(1)} TN` : "0 TN"}</div>
                        </div>
                        <div className="bg-slate-950/60 rounded p-1">
                          <div className="text-cyan-400 text-[10px] flex items-center justify-center gap-0.5">
                            <Droplet className="w-2.5 h-2.5" />
                            <span>Humedad</span>
                          </div>
                          {humInfo.hasRegisteredHum ? (
                            <div>
                              <div className="font-bold text-cyan-300">{humInfo.hum}%</div>
                              <div className="text-[9px] text-emerald-400 font-medium leading-none">14 caladas ✓</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-bold text-amber-300">{humInfo.hum > 0 ? `${humInfo.hum}%` : "Pendiente"}</div>
                              <div className="text-[9px] text-amber-400/80 leading-none">Sin caladas</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Estado de Pruebas Físicas */}
                      <div className="flex items-center justify-between text-[11px] bg-slate-850 px-2 py-1.5 rounded border border-slate-700/50">
                        <span className="text-slate-400">Análisis Húmedo:</span>
                        {anHumedo ? (
                          <span className="text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            Rend. {anHumedo.RI || 0}% / Imp. {anHumedo.IMPUREZS || 0}%
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No registrado</span>
                        )}
                      </div>

                      {lote.UBICACION && (
                        <div className="text-[11px] text-slate-400">
                          Ubicación: <strong className="text-slate-200">{lote.UBICACION}</strong>
                        </div>
                      )}

                      {lote.OBSERVACIONES && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-2 mt-1">
                          "{lote.OBSERVACIONES}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Direct Access Quick Actions */}
                  {compStatus.isProcesado ? (
                    /* Cuando el lote está PROCESADO: se retiran todas las acciones, dejando únicamente eliminar */
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-col gap-2">
                      <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px] text-emerald-300">
                        <span className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Lote Procesado
                        </span>
                        {compStatus.batchAsociado && (
                          <span className="font-mono text-[10px] text-emerald-400/80">
                            Batch {compStatus.batchAsociado.CORRELATIVO || compStatus.batchAsociado.BATCH_ID}
                          </span>
                        )}
                      </div>

                      <button
                        id={`btn-delete-lote-${lote.LOTE_ID}`}
                        type="button"
                        onClick={() => setLoteToDelete(lote.LOTE_ID)}
                        className="w-full py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-800/80 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow active:scale-98"
                        title="Eliminar este lote"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Eliminar Lote</span>
                      </button>
                    </div>
                  ) : (
                    /* Lote aún no procesado: acciones regulares disponibles + botón de eliminar */
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-col gap-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          id={`btn-open-humedad-${lote.LOTE_ID}`}
                          onClick={() => {
                            setActiveLoteFocusId(lote.LOTE_ID);
                            setSubTab("humedad");
                          }}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Registrar Muestreo de Humedad M1-M14"
                        >
                          <Droplet className="w-3.5 h-3.5" />
                          <span>Humedad</span>
                        </button>

                        <button
                          id={`btn-open-analisis-${lote.LOTE_ID}`}
                          onClick={() => {
                            setActiveLoteFocusId(lote.LOTE_ID);
                            setSubTab("analisis-humedo");
                          }}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800 text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Registrar Análisis Físico en Húmedo"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                          <span>Análisis</span>
                        </button>

                        <button
                          id={`btn-open-diagnostico-${lote.LOTE_ID}`}
                          onClick={() => {
                            setActiveLoteFocusId(lote.LOTE_ID);
                            setSubTab("analisis-lote");
                          }}
                          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800 text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Ver Dossier y Diagnóstico Integral del Lote"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Dossier</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          id={`btn-view-lote-report-${lote.LOTE_ID}`}
                          onClick={() => onOpenReport?.(lote.LOTE_ID)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium cursor-pointer"
                          title="Generar informe completo de 25 puntos"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          Informe
                        </button>

                        <button
                          id={`btn-open-programar-${lote.LOTE_ID}`}
                          onClick={() => onNavigate("programacion-apit", lote.LOTE_ID)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Programar APIT</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          id={`btn-delete-lote-opt-${lote.LOTE_ID}`}
                          type="button"
                          onClick={() => setLoteToDelete(lote.LOTE_ID)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                          title="Eliminar lote"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredLotes.length === 0 && (
            <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/60 p-6">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">No se encontraron lotes con los filtros seleccionados.</p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-3 px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Ingresar Primer Lote C0
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: REGISTRO DE HUMEDAD INTEGRADO */}
      {subTab === "humedad" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-cyan-800/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-cyan-300">
              <Droplet className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Módulo de Humedad (14 Caladas):</strong> Registre las lecturas M1 a M14 para calcular el promedio y desviación estándar que sincronizará automáticamente el lote.
              </span>
            </div>
            <button
              onClick={() => setSubTab("lotes")}
              className="text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              ← Volver a Maestro de Lotes
            </button>
          </div>

          <HumedadView
            humedades={humedades}
            lotes={lotes}
            initialLoteId={activeLoteFocusId}
            currentUser={currentUser}
            onSaveHumedad={onSaveHumedad}
            onOpenOCR={onOpenOCR}
          />
        </div>
      )}

      {/* SUBTAB 3: ANÁLISIS FÍSICO HÚMEDO INTEGRADO */}
      {subTab === "analisis-humedo" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-emerald-800/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-300">
              <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Análisis Físico en Húmedo:</strong> Registro de rendimiento de pilado (RI, RB, RM), grano entero, quebrados, impurezas y defectos de calidad.
              </span>
            </div>
            <button
              onClick={() => setSubTab("lotes")}
              className="text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              ← Volver a Maestro de Lotes
            </button>
          </div>

          <AnalisisHumedoView
            analisisList={analisisHumedos}
            lotes={lotes}
            initialLoteId={activeLoteFocusId}
            currentUser={currentUser}
            onSaveAnalisisHum={onSaveAnalisisHum}
            onOpenOCR={onOpenOCR}
          />
        </div>
      )}

      {/* SUBTAB 4: ANÁLISIS INTEGRAL Y DIAGNÓSTICO DEL LOTE */}
      {subTab === "analisis-lote" && (
        <div className="space-y-4">
          {/* Lote Selector & Quick Summary */}
          <div className="bg-slate-850 border border-slate-750 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Dossier de Calidad y Trazabilidad</span>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2 mt-0.5">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Diagnóstico Completo del Lote
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-300 font-semibold">Seleccionar Lote:</label>
              <select
                value={selectedFocusLote?.LOTE_ID || ""}
                onChange={(e) => setActiveLoteFocusId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
              >
                {lotes.map((l) => (
                  <option key={l.LOTE_ID} value={l.LOTE_ID}>
                    {l.LOTE_ID} - {l.CLIENTE || "Sin cliente"} ({l.VARIEDAD || "Sin variedad"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedFocusLote ? (
            <div className="space-y-4">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Lote y Variedad</span>
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-amber-400 font-mono mt-1">{selectedFocusLote.LOTE_ID}</div>
                  <div className="text-xs text-slate-200 font-semibold">{selectedFocusLote.VARIEDAD || "Sin variedad"}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{selectedFocusLote.CLIENTE || "Cliente no registrado"}</div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-3.5">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Peso y Volumen</span>
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    {selectedFocusLote.PESO_KG ? `${(selectedFocusLote.PESO_KG / 1000).toFixed(1)} TN` : "0 TN"}
                  </div>
                  <div className="text-xs text-slate-300">{selectedFocusLote.SACOS || 0} sacos recibidos</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Ubicación: {selectedFocusLote.UBICACION || "Silo Pulmón"}</div>
                </div>

                <div className="bg-slate-800 border border-cyan-800/60 rounded-xl p-3.5">
                  <div className="text-[11px] text-cyan-400 flex items-center justify-between">
                    <span>Humedad Promedio</span>
                    <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-cyan-300 mt-1">
                    {focusHumInfo?.hum ? `${focusHumInfo.hum}%` : "Pendiente"}
                  </div>
                  <div className="text-xs text-cyan-200">
                    {focusHumInfo?.hasRegisteredHum ? "14 caladas promediadas ✓" : "Sin muestreo M1-M14"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {focusHumInfo?.desv ? `Desv. Estándar: ±${focusHumInfo.desv}` : "Desv. no calculada"}
                  </div>
                </div>

                <div className="bg-slate-800 border border-emerald-800/60 rounded-xl p-3.5">
                  <div className="text-[11px] text-emerald-400 flex items-center justify-between">
                    <span>Rendimiento Integral (RI)</span>
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-300 mt-1">
                    {focusAnalisis?.RI ? `${focusAnalisis.RI}%` : "Pendiente"}
                  </div>
                  <div className="text-xs text-emerald-200">
                    {focusAnalisis ? `Grano Entero: ${focusAnalisis.ENTERO || 0}%` : "Análisis no registrado"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {focusAnalisis ? `Impurezas: ${focusAnalisis.IMPUREZS || 0}%` : ""}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 14 Caladas Humedad Breakdown */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <Droplet className="w-4 h-4" />
                      <span>Muestreo de 14 Caladas ({selectedFocusLote.LOTE_ID})</span>
                    </div>
                    <button
                      onClick={() => setSubTab("humedad")}
                      className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Editar Caladas <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {focusHumInfo?.hasRegisteredHum && focusHumInfo.record ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => {
                          const val = (focusHumInfo.record as any)[`M${i}`];
                          return (
                            <div key={i} className="bg-slate-900 border border-slate-750 rounded p-1">
                              <div className="text-[9px] text-slate-500 font-sans">M{i}</div>
                              <div className="font-bold text-cyan-300">{val ? `${val}%` : "-"}</div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-900/60 text-xs flex items-center justify-between">
                        <div>
                          <span className="text-slate-400">Humedad Promedio Oficial:</span>
                          <strong className="text-cyan-300 ml-1 text-sm">{focusHumInfo.hum}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Desviación:</span>
                          <strong className="text-slate-200 ml-1">±{focusHumInfo.desv}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Condición:</span>
                          <span className="ml-1 text-emerald-400 font-bold">
                            {focusHumInfo.hum > 14.5 ? "Requiere Presecado" : "Humedad Óptima"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-900/60 rounded-lg p-4">
                      <Droplet className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Aún no se han registrado las 14 caladas para este lote.</p>
                      <button
                        onClick={() => setSubTab("humedad")}
                        className="mt-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar 14 Caladas
                      </button>
                    </div>
                  )}
                </div>

                {/* Análisis Físico Breakdown */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <FlaskConical className="w-4 h-4" />
                      <span>Parámetros Físicos de Calidad ({selectedFocusLote.LOTE_ID})</span>
                    </div>
                    <button
                      onClick={() => setSubTab("analisis-humedo")}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Editar Análisis <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {focusAnalisis ? (
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Rendimiento Integral (RI)</div>
                          <div className="font-bold text-emerald-300 text-sm">{focusAnalisis.RI || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Rendimiento Blanco (RB)</div>
                          <div className="font-bold text-white text-sm">{focusAnalisis.RB || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Rendimiento Masa (RM)</div>
                          <div className="font-bold text-white text-sm">{focusAnalisis.RM || 0}%</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Grano Entero</div>
                          <div className="font-bold text-cyan-300">{focusAnalisis.ENTERO || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Quebrado Integral (QI)</div>
                          <div className="font-bold text-amber-300">{focusAnalisis.QI || 0}%</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-750">
                          <div className="text-[10px] text-slate-400">Impurezas</div>
                          <div className="font-bold text-rose-300">{focusAnalisis.IMPUREZS || 0}%</div>
                        </div>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-750 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Olor / Estado Organoléptico:</span>
                        <strong className="text-slate-200">{focusAnalisis.OLOR || "Normal / Característico"}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-900/60 rounded-lg p-4">
                      <FlaskConical className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Aún no se ha realizado el análisis físico en húmedo para este lote.</p>
                      <button
                        onClick={() => setSubTab("analisis-humedo")}
                        className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar Análisis Físico
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar for Lote */}
              <div className="flex items-center justify-between bg-slate-850 p-4 rounded-xl border border-slate-750">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenReport?.(selectedFocusLote.LOTE_ID)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Ver Ficha Técnica Completa (25 Parámetros)</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate("presecado-seco", selectedFocusLote.LOTE_ID)}
                    className="px-3.5 py-2 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-bold text-xs rounded-lg border border-amber-500/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ir a Presecado</span>
                  </button>
                  <button
                    onClick={() => onNavigate("programacion-apit", selectedFocusLote.LOTE_ID)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <span>Programar Vaporizado APIT</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/60 p-6">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">No hay lotes disponibles para visualizar.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Registrar Nuevo Lote (Con Selección de Variedades + Peso Manual + Código C0) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Package className="w-5 h-5" />
                <span>Registrar Nuevo Lote de Arroz</span>
              </div>
              <button
                onClick={handleCloseCreateModal}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {savedSuccessLoteId ? (
              <div className="mt-4 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">¡Lote Registrado Exitosamente!</h3>
                  <p className="text-xs text-slate-300 mt-1 font-mono font-bold text-amber-400">
                    Código: {savedSuccessLoteId}
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setActiveLoteFocusId(savedSuccessLoteId);
                      setSubTab("humedad");
                      handleCloseCreateModal();
                    }}
                    className="w-full py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow cursor-pointer text-xs"
                  >
                    <Droplet className="w-4 h-4" />
                    <span>Registrar Muestreo de Humedad (14 Caladas)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveLoteFocusId(savedSuccessLoteId);
                      setSubTab("analisis-humedo");
                      handleCloseCreateModal();
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow cursor-pointer text-xs"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>Realizar Análisis Físico en Húmedo</span>
                  </button>

                  <button
                    onClick={handleCloseCreateModal}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <span>Ver Tabla de Lotes</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreateError(null);
                  let rawId = (newLoteData.LOTE_ID || "").trim();
                  if (!rawId || rawId === "0" || rawId === "C00") {
                    setCreateError("Debe ingresar un código de lote válido (distinto de 0) o pulsar 'Generar auto'.");
                    return;
                  }
                  const targetLoteId = normalizeLoteId(rawId);
                  if (lotes.some(l => normalizeLoteId(l.LOTE_ID) === targetLoteId)) {
                    setCreateError(`El código de lote "${targetLoteId}" ya existe en el sistema. Los códigos de lote son únicos y no se pueden repetir.`);
                    return;
                  }

                  let sacosFinal = newLoteData.SACOS && Number(newLoteData.SACOS) > 0 ? Number(newLoteData.SACOS) : 0;
                  let pesoFinal = newLoteData.PESO_KG && Number(newLoteData.PESO_KG) > 0 ? Number(newLoteData.PESO_KG) : 0;

                  if (sacosFinal > 0 && pesoFinal <= 0) {
                    pesoFinal = sacosFinal * 100;
                  } else if (pesoFinal > 0 && sacosFinal <= 0) {
                    sacosFinal = Math.max(1, Math.round(pesoFinal / 100));
                  }

                  if (sacosFinal <= 0 && pesoFinal <= 0) {
                    setCreateError("Por favor ingrese la cantidad de sacos o el peso total del lote.");
                    return;
                  }

                  const selectedVar = isCustomVariedad ? customVariedadText : (newLoteData.VARIEDAD || "");
                  try {
                    await onSaveLote({
                      ...newLoteData,
                      LOTE_ID: targetLoteId,
                      VARIEDAD: selectedVar,
                      SACOS: sacosFinal,
                      PESO_KG: pesoFinal,
                      FECHA_INGRESO: newLoteData.FECHA_INGRESO || new Date().toISOString().split("T")[0],
                      HUM: 0, // Moisture must be calculated through caladas sampling
                      ESTADO_LOTE: "INGRESADO",
                      isNew: true
                    } as any);
                    setSavedSuccessLoteId(targetLoteId);
                  } catch (err: any) {
                    setCreateError(err.message || "Error al registrar el lote en el sistema.");
                  }
                }}
                className="mt-4 space-y-4 text-xs"
              >
                {createError && (
                  <div className="p-3 bg-rose-950/90 border border-rose-500/80 rounded-xl flex items-start gap-2.5 text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold text-rose-300 block">Error de Validación</span>
                      <span className="text-rose-200 mt-0.5 block">{createError}</span>
                    </div>
                  </div>
                )}

                {/* Código de Lote C0 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Código de Lote *</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = getNextLoteId();
                            setNewLoteData({ ...newLoteData, LOTE_ID: next });
                            setCreateError(null);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                        >
                          Generar auto
                        </button>
                        {currentNormalizedNewLoteId && (
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isDuplicateNewLote
                              ? "text-rose-300 bg-rose-950 border-rose-500 animate-pulse"
                              : "text-amber-400 bg-slate-950 border-amber-500/40"
                          }`}>
                            {isDuplicateNewLote ? `⚠️ ${currentNormalizedNewLoteId} (Repetido)` : currentNormalizedNewLoteId}
                          </span>
                        )}
                      </div>
                    </label>
                    <div className={`flex rounded-lg overflow-hidden border transition-colors ${
                      isDuplicateNewLote
                        ? "border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20"
                        : "border-slate-700 focus-within:border-amber-500 bg-slate-800"
                    }`}>
                      <span className={`inline-flex items-center px-3 font-mono font-black text-xs border-r select-none ${
                        isDuplicateNewLote
                          ? "bg-rose-500/20 text-rose-300 border-rose-600"
                          : "bg-amber-500/20 text-amber-400 border-slate-700"
                      }`}>
                        C0
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="0"
                        value={newLoteData.LOTE_ID === "0" ? "0" : (newLoteData.LOTE_ID || "").replace(/^C0*/i, "")}
                        onFocus={(e) => {
                          if (e.target.value === "0") {
                            e.target.select();
                          }
                        }}
                        onChange={(e) => {
                          setCreateError(null);
                          const raw = e.target.value.trim();
                          if (raw === "" || raw === "0") {
                            setNewLoteData({ ...newLoteData, LOTE_ID: "0" });
                          } else {
                            const formatted = raw.toUpperCase().startsWith("C0") ? raw.toUpperCase() : `C0${raw}`;
                            setNewLoteData({ ...newLoteData, LOTE_ID: formatted });
                          }
                        }}
                        className="w-full bg-transparent px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                    {isDuplicateNewLote ? (
                      <div className="mt-2 p-2 bg-rose-950/90 border border-rose-500/70 rounded-lg flex items-start gap-1.5 text-rose-200 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-rose-300">¡Código ya existe!</span>
                          <p className="text-[10px] text-rose-200 mt-0.5">
                            Los códigos de lote no se pueden repetir. Use otro o genere uno automático.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const next = getNextLoteId();
                              setNewLoteData({ ...newLoteData, LOTE_ID: next });
                              setCreateError(null);
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            Asignar libre ({getNextLoteId()})
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">
                        💡 Puede escribir <strong className="text-amber-300">2020</strong> y el sistema guardará <strong className="text-amber-300 font-mono">C02020</strong>. Debe ser único.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Fecha de Ingreso *</label>
                    <input
                      type="date"
                      required
                      value={newLoteData.FECHA_INGRESO || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, FECHA_INGRESO: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Cliente / Productor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Agrícola del Norte S.A.C."
                      value={newLoteData.CLIENTE || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, CLIENTE: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  
                  {/* Lista Desplegable de Variedades de Arroz */}
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Variedad de Arroz *</label>
                    <select
                      required
                      value={isCustomVariedad ? "OTRA" : (newLoteData.VARIEDAD || "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "OTRA") {
                          setIsCustomVariedad(true);
                          setNewLoteData({ ...newLoteData, VARIEDAD: customVariedadText });
                        } else {
                          setIsCustomVariedad(false);
                          setNewLoteData({ ...newLoteData, VARIEDAD: val });
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Seleccionar Variedad...</option>
                      {VARIEDADES_ARROZ_OPCIONES.map((v) => (
                        <option key={v} value={v}>
                          {v === "OTRA" ? "OTRA (Ingresar manualmente...)" : v}
                        </option>
                      ))}
                    </select>

                    {isCustomVariedad && (
                      <input
                        type="text"
                        required
                        placeholder="Escriba el nombre de la variedad..."
                        value={customVariedadText}
                        onChange={(e) => {
                          setCustomVariedadText(e.target.value);
                          setNewLoteData({ ...newLoteData, VARIEDAD: e.target.value });
                        }}
                        className="mt-2 w-full bg-slate-800 border border-amber-500/60 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* Sacos y Peso Total (Ingreso Manual con Auto-estimación opcional) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Cantidad de Sacos *</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={newLoteData.SACOS !== undefined ? newLoteData.SACOS : 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setNewLoteData({ 
                          ...newLoteData, 
                          SACOS: val
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    {newLoteData.PESO_KG && Number(newLoteData.PESO_KG) > 0 && (!newLoteData.SACOS || Number(newLoteData.SACOS) <= 0) && (
                      <button
                        type="button"
                        onClick={() => setNewLoteData({ ...newLoteData, SACOS: Math.max(1, Math.round(Number(newLoteData.PESO_KG) / 100)) })}
                        className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Estimar: {Math.max(1, Math.round(Number(newLoteData.PESO_KG) / 100))} sacos (~100 kg/saco)</span>
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Peso Total (Kg) - Manual *</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={newLoteData.PESO_KG !== undefined ? newLoteData.PESO_KG : 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setNewLoteData({ ...newLoteData, PESO_KG: val });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    {newLoteData.SACOS && Number(newLoteData.SACOS) > 0 && (!newLoteData.PESO_KG || Number(newLoteData.PESO_KG) <= 0) && (
                      <button
                        type="button"
                        onClick={() => setNewLoteData({ ...newLoteData, PESO_KG: Number(newLoteData.SACOS) * 100 })}
                        className="mt-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Estimar: {(Number(newLoteData.SACOS) * 100).toLocaleString()} kg (~100 kg/saco)</span>
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Ingreso manual directo según boleta/pesaje de balanza (valor inicial en 0).
                    </p>
                  </div>
                </div>

                {/* Bloqueo Explicativo de Humedad: Cálculo Automático por 14 Caladas */}
                <div className="bg-slate-950/90 border border-cyan-800/60 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <Droplet className="w-4 h-4" />
                    <span>Humedad Inicial (%): Cálculo Automático por 14 Caladas</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Por norma de calidad, la humedad no se digita directamente aquí. Se calculará como el <strong>promedio exacto de las 14 caladas de muestreo</strong> en la pestaña <strong>"2. Registro de Humedad"</strong>.
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 font-mono bg-cyan-950/50 px-2 py-1 rounded">
                    <span>Estado: <strong>Pendiente de 14 Caladas (M1 - M14)</strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Zona de Origen</label>
                    <input
                      type="text"
                      placeholder="Ej. Chiclayo / Ferreñafe"
                      value={newLoteData.ZONA || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, ZONA: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Ubicación / Silo</label>
                    <input
                      type="text"
                      placeholder="Ej. Silo Pulmón 01"
                      value={newLoteData.UBICACION || ""}
                      onChange={(e) => setNewLoteData({ ...newLoteData, UBICACION: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Observaciones</label>
                  <textarea
                    rows={2}
                    placeholder="Detalles sobre estado del grano, impurezas visuales, transporte..."
                    value={newLoteData.OBSERVACIONES || ""}
                    onChange={(e) => setNewLoteData({ ...newLoteData, OBSERVACIONES: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseCreateModal}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isDuplicateNewLote}
                    title={isDuplicateNewLote ? "El código de lote ya existe en el sistema. Los códigos no se pueden repetir." : undefined}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Guardar Lote C0
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar Lote */}
      {loteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/30 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">¿Eliminar Lote {loteToDelete}?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Esta acción eliminará el lote y sus registros de muestreo y calidad de la base de datos de planta.
                </p>
                {deleteLoteError && (
                  <p className="text-xs text-rose-400 font-bold mt-1">⚠️ {deleteLoteError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isDeletingLote}
                onClick={() => {
                  setLoteToDelete(null);
                  setDeleteLoteError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingLote}
                onClick={handleConfirmDeleteLote}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/30 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingLote ? "Eliminando..." : "Sí, Eliminar Lote"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
