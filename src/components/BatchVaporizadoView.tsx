import React, { useState, useMemo, useEffect } from "react";
import { 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  Equipo, 
  UserProfile,
  UserRole,
  ParametrosTrabajo, 
  HistorialParametro,
  AnalisisHumedo,
  AnalisisSeco,
  AnalisisVaporizado,
  ControlVaporizado,
  Presecado
} from "../types";
import { 
  Layers, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Package, 
  Scale, 
  ChevronRight, 
  ChevronDown,
  ChevronUp, 
  AlertTriangle, 
  Trash2, 
  Edit3,
  ShieldCheck, 
  Settings, 
  GitCommit,
  GitMerge, 
  Search, 
  Filter, 
  Calendar, 
  Activity,
  Play,
  FileCheck,
  X,
  List,
  Grid,
  TrendingUp,
  Eye,
  ArrowUpDown,
  FileSpreadsheet,
  Droplets,
  Tag,
  RotateCcw,
  Sparkles,
  Flame,
  Award,
  CheckCheck,
  Sliders,
  Gauge,
  Thermometer,
  Lock,
  Printer,
  BellRing
} from "lucide-react";
import { 
  calcularSaldosLotes, 
  PARAMETROS_TRABAJO_DEFAULT 
} from "../utils/batchEngine";
import { generateHojaControlVaporizadoPDF } from "../utils/pdfPrintHelper";
import { tienePermiso, obtenerMensajeRestriccion } from "../utils/permisosService";
import { ParametrosTrabajoModal } from "./ParametrosTrabajoModal";
import { NuevoBatchModal } from "./NuevoBatchModal";
import { ModalUnirCodigos } from "./ModalUnirCodigos";
import { TrazabilidadModal } from "./TrazabilidadModal";
import { BatchResumenProcesoModal, BatchReportData } from "./BatchResumenProcesoModal";
import { ComparadorEvaluacionProcesos } from "./ComparadorEvaluacionProcesos";
import { ResumenParametrosCoccionSection } from "./ResumenParametrosCoccionSection";
import { ResumenRendimientoProcesoSection } from "./ResumenRendimientoProcesoSection";
import { IntegracionCoccionModal } from "./IntegracionCoccionModal";
import { FormatoRegistroVaporizadoModal } from "./FormatoRegistroVaporizadoModal";
import { obtenerResultadosCoccionLocales, buscarCoccionParaBatch } from "../utils/integracionCoccionService";
import { localDB, evaluateControlSheetStages } from "../utils/localDB";
import { compareLoteCodes, formatLoteCode } from "../utils/formatLoteCode";
import {
  calcularPesoProyectadoDescarga,
  obtenerRegistroSacasDescargaBatch,
  evaluarBalanceSacasDescarga,
  sustentarYAceptarAlarmaSacasDescarga,
  TOLERANCIA_DESCARGA_KG
} from "../utils/sacasDescargaService";
import { SacasDescargaModal, SacasDescargaManager } from "./SacasDescargaManager";
import { FichaFinalBatchCerradoModal } from "./FichaFinalBatchCerradoModal";

interface BatchVaporizadoViewProps {
  batches?: BatchVaporizado[];
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  analisisHumedos?: AnalisisHumedo[];
  analisisSecos?: AnalisisSeco[];
  analisisVapList?: AnalisisVaporizado[];
  controles?: ControlVaporizado[];
  presecados?: Presecado[];
  equipos?: Equipo[];
  currentUser?: UserProfile;
  parametros?: ParametrosTrabajo;
  historialParametros?: HistorialParametro[];
  onSaveBatch: (batch: Partial<BatchVaporizado>, selectedLotes: any[]) => Promise<void>;
  onDeleteBatch?: (batchId: string, force?: boolean) => Promise<boolean | void>;
  onUpdateBatchState?: (batchId: string, newState: string) => Promise<void>;
  onSaveParametros?: (newParams: Partial<ParametrosTrabajo>, motivo?: string) => Promise<void>;
  onRefreshData?: () => void;
  onNavigate: (tab: string, filterId?: string) => void;
}

export const BatchVaporizadoView: React.FC<BatchVaporizadoViewProps> = ({
  batches = [],
  batchLotes = [],
  lotes = [],
  analisisHumedos = [],
  analisisSecos = [],
  analisisVapList = [],
  controles = [],
  presecados = [],
  equipos = [],
  currentUser,
  parametros = PARAMETROS_TRABAJO_DEFAULT,
  historialParametros = [],
  onSaveBatch,
  onDeleteBatch,
  onUpdateBatchState,
  onSaveParametros,
  onRefreshData,
  onNavigate
}) => {
  // Modal Visibility States
  const [isParametrosModalOpen, setIsParametrosModalOpen] = useState(false);
  const [isNuevoBatchModalOpen, setIsNuevoBatchModalOpen] = useState(false);
  const [isModalUnirCodigosOpen, setIsModalUnirCodigosOpen] = useState(false);
  const [isTrazabilidadModalOpen, setIsTrazabilidadModalOpen] = useState(false);
  const [trazabilidadTarget, setTrazabilidadTarget] = useState<{ type: "batch" | "lote"; id: string }>({ type: "batch", id: "" });
  const [initialLoteForNewBatch, setInitialLoteForNewBatch] = useState<string | undefined>(undefined);
  const [batchToEdit, setBatchToEdit] = useState<BatchVaporizado | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<BatchVaporizado | null>(null);
  const [deleteAssociatedControles, setDeleteAssociatedControles] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [selectedBatchForReport, setSelectedBatchForReport] = useState<BatchVaporizado | null>(null);
  const [selectedBatchForSacasModal, setSelectedBatchForSacasModal] = useState<BatchVaporizado | null>(null);
  const [batchForAlarmaSustentoModal, setBatchForAlarmaSustentoModal] = useState<BatchVaporizado | null>(null);
  const [sustentoAlarmaModalText, setSustentoAlarmaModalText] = useState<string>("");
  const [sacasRefreshTick, setSacasRefreshTick] = useState<number>(0);
  const [isCoccionModalOpen, setIsCoccionModalOpen] = useState<boolean>(false);
  const [isFormatoOficialOpen, setIsFormatoOficialOpen] = useState<boolean>(false);
  const [selectedBatchForFichaCerrado, setSelectedBatchForFichaCerrado] = useState<BatchVaporizado | null>(null);
  const [selectedLoteIdForFichaCerrado, setSelectedLoteIdForFichaCerrado] = useState<string | undefined>(undefined);

  const handleOpenFichaBatchCerrado = (batch: BatchVaporizado, loteId?: string) => {
    setSelectedBatchForFichaCerrado(batch);
    setSelectedLoteIdForFichaCerrado(loteId);
  };

  const handleOpenSustentoAlarmaModal = (batch: BatchVaporizado, sustentoInicial?: string) => {
    setBatchForAlarmaSustentoModal(batch);
    setSustentoAlarmaModalText(sustentoInicial || "");
  };

  const handleConfirmarSustentoAlarmaBatch = () => {
    if (!batchForAlarmaSustentoModal || !sustentoAlarmaModalText.trim()) return;
    const corr = batchForAlarmaSustentoModal.CORRELATIVO || batchForAlarmaSustentoModal.BATCH_ID;
    const ctrl = controles.find(
      (c) =>
        c.BATCH_ID === batchForAlarmaSustentoModal.BATCH_ID ||
        c.BATCH_ID === corr ||
        c.CORRELATIVO === corr
    );
    sustentarYAceptarAlarmaSacasDescarga({
      batchId: batchForAlarmaSustentoModal.BATCH_ID,
      correlativo: corr,
      sustento: sustentoAlarmaModalText.trim(),
      usuario: currentUser?.nombre || "Supervisor Planta",
      batch: batchForAlarmaSustentoModal,
      ctrl
    });
    setSacasRefreshTick((t) => t + 1);
    if (onRefreshData) onRefreshData();
    setNotifMessage(
      `✅ Observación sustentada y aceptada para el Batch ${corr}. Se retiró la alarma de peso proyectado.`
    );
    setTimeout(() => setNotifMessage(null), 5000);
    setBatchForAlarmaSustentoModal(null);
    setSustentoAlarmaModalText("");
  };

  useEffect(() => {
    const handleSacasUpdate = () => setSacasRefreshTick((t) => t + 1);
    window.addEventListener("sacas-descarga-updated", handleSacasUpdate);
    return () => window.removeEventListener("sacas-descarga-updated", handleSacasUpdate);
  }, []);

  // Notification message
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  // Filters & View Layout
  const [selectedTurnoFilter, setSelectedTurnoFilter] = useState<string>("TODOS");
  const [selectedSecadoFilter, setSelectedSecadoFilter] = useState<string>("TODOS");
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<string>("TODOS");
  const [selectedVariedadFilter, setSelectedVariedadFilter] = useState<string>("TODAS");
  const [selectedHumedadFilter, setSelectedHumedadFilter] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTabSubView, setActiveTabSubView] = useState<"batches" | "comparador" | "saldos">("batches");
  const [showExtraFilters, setShowExtraFilters] = useState<boolean>(false);
  const [viewLayout, setViewLayout] = useState<"lista" | "cuadricula">("lista");
  const [sortBy, setSortBy] = useState<"fecha_desc" | "fecha_asc" | "peso_desc" | "estado">("fecha_asc");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [expandedTabPerBatch, setExpandedTabPerBatch] = useState<Record<string, "resumen" | "proceso" | "salida" | "coccion" | "lotes" | "sacas">>({});

  const userRole = (currentUser?.rol || "OPERARIO") as UserRole;
  const canProgramarBatch = tienePermiso(userRole, "crear_programacion_batch");
  const canAjustarParametros = tienePermiso(userRole, "editar_receta_autoclave");
  const canCerrarBatch = tienePermiso(userRole, "cerrar_aprobar_batch");

  const todasLasVariedades = useMemo(() => {
    const setVar = new Set<string>();
    (lotes || []).forEach((l) => {
      if (l.VARIEDAD && l.VARIEDAD.trim()) setVar.add(l.VARIEDAD.trim());
    });
    (batchLotes || []).forEach((bl) => {
      if (bl.VARIEDAD && bl.VARIEDAD.trim()) setVar.add(bl.VARIEDAD.trim());
    });
    return Array.from(setVar).sort((a, b) => a.localeCompare(b));
  }, [lotes, batchLotes]);

  // Humidity classification helper
  const matchHumedadCategory = (hum: number | undefined, filtro: string): boolean => {
    if (filtro === "TODAS") return true;
    if (hum === undefined || isNaN(hum)) return false;
    if (filtro === "MENOR_14") return hum < 14.0;
    if (filtro === "14_18") return hum >= 14.0 && hum <= 18.0;
    if (filtro === "18_22") return hum > 18.0 && hum <= 22.0;
    if (filtro === "MAYOR_22") return hum > 22.0;
    return true;
  };

  // Toggle single batch expansion
  const toggleBatchExpand = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedBatches.size === filteredBatches.length) {
      setExpandedBatches(new Set());
    } else {
      setExpandedBatches(new Set(filteredBatches.map(b => b.BATCH_ID)));
    }
  };

  // Reset all filters
  const handleLimpiarFiltros = () => {
    setSelectedTurnoFilter("TODOS");
    setSelectedSecadoFilter("TODOS");
    setSelectedEstadoFilter("TODOS");
    setSelectedVariedadFilter("TODAS");
    setSelectedHumedadFilter("TODAS");
    setSearchQuery("");
  };

  const hasActiveFilters = 
    selectedTurnoFilter !== "TODOS" ||
    selectedSecadoFilter !== "TODOS" ||
    selectedEstadoFilter !== "TODOS" ||
    selectedVariedadFilter !== "TODAS" ||
    selectedHumedadFilter !== "TODAS" ||
    searchQuery.trim() !== "";

  // Controles asociados al batch seleccionado para eliminar
  const associatedControlesForBatchToDelete = useMemo(() => {
    if (!batchToDelete) return [];
    const bId = (batchToDelete.BATCH_ID || "").trim().toUpperCase();
    const bCorr = (batchToDelete.CORRELATIVO || "").trim().toUpperCase();
    return (controles || []).filter((c) => {
      const cB = (c.BATCH_ID || "").trim().toUpperCase();
      const cC = (c.CORRELATIVO || "").trim().toUpperCase();
      const cCod = (c.CODIGO_INTERNO || "").trim().toUpperCase();
      return (
        (cB && (cB === bId || cB === bCorr)) ||
        (cC && (cC === bId || cC === bCorr)) ||
        (cCod && (cCod === bId || cCod === bCorr))
      );
    });
  }, [batchToDelete, controles]);

  // Handler to request delete
  const handleDeleteBatch = (batch: BatchVaporizado) => {
    setBatchToDelete(batch);
    setDeleteAssociatedControles(true);
  };

  // Handler to execute confirmed delete
  const handleConfirmarEliminarBatch = async () => {
    if (!batchToDelete) return;
    const batch = batchToDelete;
    const code = batch.CORRELATIVO || batch.BATCH_ID;
    const assignedLotesForBatch = batchLotes
      .filter((bl) => bl.BATCH_ID === batch.BATCH_ID || bl.BATCH_ID === batch.CORRELATIVO)
      .map((bl) => bl.LOTE_ID);

    setIsDeleting(true);
    try {
      if (onDeleteBatch) {
        await onDeleteBatch(batch.BATCH_ID, deleteAssociatedControles);
      } else {
        localDB.deleteBatch(batch.BATCH_ID, currentUser?.nombre || "Operador", deleteAssociatedControles);
      }

      if (assignedLotesForBatch.length > 0) {
        localDB.bulkUpdateLotesStatus(assignedLotesForBatch, "ANALIZADO");
      }

      if (onRefreshData) {
        onRefreshData();
      }

      setNotifMessage(`🗑️ Batch ${code} eliminado con éxito.${deleteAssociatedControles && associatedControlesForBatchToDelete.length > 0 ? ` Se eliminaron ${associatedControlesForBatchToDelete.length} control(es) de vaporizado asociado(s).` : ""} Los ${assignedLotesForBatch.length} lote(s) han sido liberados.`);
      setTimeout(() => setNotifMessage(null), 4500);
      setBatchToDelete(null);
    } catch (e: any) {
      console.error("Error eliminando batch:", e);
      setNotifMessage(`⚠️ ${e?.message || e}`);
      setTimeout(() => setNotifMessage(null), 6000);
      setBatchToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler to edit batch
  const handleEditBatch = (batch: BatchVaporizado) => {
    setBatchToEdit(batch);
    setIsNuevoBatchModalOpen(true);
  };

  // Real-time calculation of saldos
  const saldosMap = useMemo(() => {
    return calcularSaldosLotes(lotes, batchLotes, batches, analisisHumedos);
  }, [lotes, batchLotes, batches, analisisHumedos]);

  // Helper to extract client, variety, lotes, sacks, and weighted moisture for a batch
  // Requisito: En la pestaña de batches en la lista el lote debe jalar la misma información exacta que se ingresó en el lote maestro
  const getBatchMetadata = (batch: BatchVaporizado) => {
    let rawBL = batchLotes.filter((bl) => 
      bl.BATCH_ID === batch.BATCH_ID || 
      (batch.CORRELATIVO && bl.BATCH_ID === batch.CORRELATIVO) ||
      (bl.BATCH_ID && batch.BATCH_ID && bl.BATCH_ID.toUpperCase() === batch.BATCH_ID.toUpperCase())
    );

    // Si batchLotes no contiene registros directos, reconstruir desde LOTES_UNION o lote asignado
    if (rawBL.length === 0) {
      const rawLotesList: string[] = Array.isArray(batch.LOTES_UNION) && batch.LOTES_UNION.length > 0
        ? batch.LOTES_UNION
        : Array.isArray((batch as any).lotes) && (batch as any).lotes.length > 0
        ? (batch as any).lotes
        : typeof (batch as any).lote === "string" && (batch as any).lote.trim()
        ? [(batch as any).lote.trim()]
        : [];
      
      if (rawLotesList.length > 0) {
        rawBL = rawLotesList.map((lid, idx) => {
          const matchedL = lotes.find(l => l.LOTE_ID === lid || compareLoteCodes(l.LOTE_ID, lid));
          return {
            BATCH_LOTE_ID: `${batch.BATCH_ID}-BL-${idx + 1}`,
            BATCH_ID: batch.BATCH_ID,
            LOTE_ID: matchedL?.LOTE_ID || lid,
            SACOS: matchedL?.SACOS || 0,
            PESO_KG: matchedL?.PESO_KG || 0,
            ORDEN: idx + 1,
            ESTADO: matchedL?.ESTADO_LOTE || "PROGRAMADO",
            CLIENTE: matchedL?.CLIENTE || batch.CLIENTE,
            VARIEDAD: matchedL?.VARIEDAD || batch.VARIEDAD,
            OBSERVACIONES: ""
          } as BatchLote;
        });
      }
    }

    // Jalar exactamente la misma información que se ingresó en el lote maestro
    const bLotes = rawBL.map((bl) => {
      const loteObj = lotes.find((l) => l.LOTE_ID === bl.LOTE_ID || compareLoteCodes(l.LOTE_ID, bl.LOTE_ID));
      const ahObj = analisisHumedos.find((a) => a.LOTE_ID === bl.LOTE_ID || compareLoteCodes(a.LOTE_ID, bl.LOTE_ID));
      const sacosIngresados = (bl.SACOS && bl.SACOS > 0) ? bl.SACOS : (loteObj?.SACOS || (bl.PESO_KG ? Math.round(bl.PESO_KG / 50) : 0));
      const pesoIngresado = (bl.PESO_KG && bl.PESO_KG > 0) ? bl.PESO_KG : (loteObj?.PESO_KG || (sacosIngresados * 50));
      const humVal = loteObj?.HUM ?? loteObj?.HUMEDAD ?? (ahObj?.HUMEDADES !== undefined ? Number(ahObj.HUMEDADES) : undefined);

      return {
        ...bl,
        LOTE_ID: loteObj?.LOTE_ID || bl.LOTE_ID,
        CLIENTE: loteObj?.CLIENTE || bl.CLIENTE || batch.CLIENTE || "Sin cliente",
        VARIEDAD: loteObj?.VARIEDAD || bl.VARIEDAD || batch.VARIEDAD || "Sin variedad",
        SACOS: sacosIngresados,
        PESO_KG: pesoIngresado,
        HUMEDAD: humVal,
        FECHA_INGRESO: loteObj?.FECHA_INGRESO,
        ESTADO_LOTE: loteObj?.ESTADO_LOTE || "PROGRAMADO"
      };
    });

    const clientesSet = new Set<string>();
    const variedadesSet = new Set<string>();
    let totalSacos = 0;
    let totalPesoKg = 0;
    let sumHumPond = 0;
    let lotesConHumCount = 0;

    bLotes.forEach((bl) => {
      if (bl.CLIENTE) clientesSet.add(bl.CLIENTE);
      if (bl.VARIEDAD) variedadesSet.add(bl.VARIEDAD);
      const peso = Number(bl.PESO_KG) || 0;
      totalSacos += Number(bl.SACOS) || (peso > 0 ? Math.round(peso / 50) : 0);
      totalPesoKg += peso;

      const hum = bl.HUMEDAD;
      if (hum !== undefined && !isNaN(Number(hum))) {
        sumHumPond += Number(hum) * (peso > 0 ? peso : 1);
        lotesConHumCount++;
      }
    });

    if (clientesSet.size === 0 && batch.CLIENTE) {
      clientesSet.add(batch.CLIENTE);
    }
    if (variedadesSet.size === 0 && batch.VARIEDAD) {
      variedadesSet.add(batch.VARIEDAD);
    }

    const clienteDisplay = Array.from(clientesSet).join(", ") || (batch.CLIENTE || "Cliente no especificado");
    const variedadDisplay = Array.from(variedadesSet).join(", ") || (batch.VARIEDAD || "Variedad no especificada");
    const variedadesList = Array.from(variedadesSet).length > 0 ? Array.from(variedadesSet) : [batch.VARIEDAD || "TINAJONES"];
    const isExcepcional = batch.ES_EXCEPCIONAL_PAMPA || (batch.PESO_TOTAL_KG && batch.PESO_TOTAL_KG > 35000) || (totalPesoKg > 35000);
    const pesoEfectivoKg = batch.PESO_TOTAL_KG || (batch.TON_PROCESADAS ? batch.TON_PROCESADAS * 1000 : (batch.TON_PROGRAMADAS ? batch.TON_PROGRAMADAS * 1000 : (totalPesoKg > 0 ? totalPesoKg : 18000)));
    const tonEfectivas = batch.TON_PROCESADAS || batch.TON_PROGRAMADAS || (pesoEfectivoKg / 1000);

    if (totalSacos === 0 && pesoEfectivoKg > 0) {
      totalSacos = Math.round(pesoEfectivoKg / 50);
    }

    const humedadPromedio = totalPesoKg > 0 && sumHumPond > 0
      ? Number((sumHumPond / totalPesoKg).toFixed(1))
      : lotesConHumCount > 0 
      ? Number((sumHumPond / lotesConHumCount).toFixed(1))
      : ((batch as any).HUMEDAD_PROMEDIO !== undefined ? Number((batch as any).HUMEDAD_PROMEDIO) : undefined);

    const corr = batch.CORRELATIVO || batch.BATCH_ID;
    const ctrl = controles.find((c) => c.BATCH_ID === batch.BATCH_ID || c.BATCH_ID === corr || c.CORRELATIVO === corr);
    const humEfectivaParaProyeccion = humedadPromedio !== undefined && humedadPromedio > 0 ? humedadPromedio : 14.5;
    const pesoProyectadoCalcKg = calcularPesoProyectadoDescarga(pesoEfectivoKg, humEfectivaParaProyeccion);

    const regSacas = obtenerRegistroSacasDescargaBatch(batch.BATCH_ID, corr, undefined, batch, ctrl);
    const sacasDescarga = regSacas?.sacas || [];
    const balanceSacas = evaluarBalanceSacasDescarga({
      batchId: batch.BATCH_ID,
      correlativo: corr,
      sacas: sacasDescarga,
      pesoIngresoKg: pesoEfectivoKg,
      humedadPromedioIngreso: humEfectivaParaProyeccion,
      alarmaAceptada: regSacas?.alarmaAceptada ?? batch.ALARMA_PESO_DESCARGA_ACEPTADA ?? false,
      sustentoObservacionAlarma:
        regSacas?.sustentoObservacionAlarma || batch.SUSTENTO_ALARMA_PESO_DESCARGA || undefined,
      aceptadoPor: regSacas?.aceptadoPor,
      fechaAceptacionAlarma: regSacas?.fechaAceptacionAlarma,
      observaciones: regSacas?.observaciones
    });

    const totalSacasDescarga = balanceSacas.sacas.length;
    const pesoProyectadoKg = balanceSacas.pesoProyectadoKg || pesoProyectadoCalcKg;
    const pesoRealDescargaKg = balanceSacas.pesoRealDescargaKg;
    const diferenciaDescargaKg = balanceSacas.diferenciaKg;
    const toleranciaDescargaKg = balanceSacas.toleranciaKg;
    const dentroToleranciaDescarga = balanceSacas.cumpleTolerancia;
    const estadoComparacionDescarga = balanceSacas.estadoComparacion;
    const alarmaPesoActiva = Boolean(balanceSacas.alarmaActiva);
    const alarmaPesoAceptada = Boolean(balanceSacas.alarmaAceptada);
    const sustentoAlarmaPeso = balanceSacas.sustentoObservacionAlarma || "";
    const aceptadoPorAlarmaPeso = balanceSacas.aceptadoPor || "";
    const fechaAceptacionAlarmaPeso = balanceSacas.fechaAceptacionAlarma || "";

    return {
      bLotes,
      clienteDisplay,
      variedadDisplay,
      variedadesList,
      totalSacos,
      pesoEfectivoKg,
      tonEfectivas,
      isExcepcional,
      humedadPromedio,
      sacasDescarga,
      totalSacasDescarga,
      pesoProyectadoKg,
      pesoRealDescargaKg,
      diferenciaDescargaKg,
      toleranciaDescargaKg,
      dentroToleranciaDescarga,
      estadoComparacionDescarga,
      alarmaPesoActiva,
      alarmaPesoAceptada,
      sustentoAlarmaPeso,
      aceptadoPorAlarmaPeso,
      fechaAceptacionAlarmaPeso
    };
  };

  // Helper dinámico para calcular el estado progresivo del batch en todo momento sin saltar estados:
  // PROGRAMADO -> EN PROCESO -> EN REPOSO -> EN SECADO -> VAPORIZADO -> ANALISIS_FINAL -> EVALUADO -> CERRADO
  const getComputedBatchStatus = (batch: BatchVaporizado): string => {
    const corr = batch.CORRELATIVO || batch.BATCH_ID;
    const bId = batch.BATCH_ID;
    const rawEstado = (batch.ESTADO_BATCH || "").toUpperCase().trim().replace("_", " ");

    if (rawEstado === "OBSERVADO") {
      return "OBSERVADO";
    }

    // 1. CERRADO: Cuando cierra el batch completamente o cuando el lote vinculado está cerrado
    const metaCheck = getBatchMetadata(batch);
    const hasClosedLinkedLote =
      metaCheck.bLotes.length > 0 &&
      metaCheck.bLotes.every((bl) => {
        const lObj = lotes.find((l) => compareLoteCodes(l.LOTE_ID, bl.LOTE_ID));
        const estBl = String(bl.ESTADO || "").toUpperCase().trim();
        const estLote = String(lObj?.ESTADO_LOTE || lObj?.ESTADO || "").toUpperCase().trim();
        return estBl === "CERRADO" || estLote === "CERRADO";
      });
    if (
      rawEstado === "CERRADO" ||
      (batch as any).CERRADO_COMPLETO === true ||
      hasClosedLinkedLote
    ) {
      return "CERRADO";
    }

    // Datos de descarga: análisis de vaporizado o seco asociado al batch
    const hasDescarga = analisisVapList.some(a => 
      (a.BATCH_ID && (a.BATCH_ID === bId || a.BATCH_ID === corr)) ||
      (a.LOTE_ID && batchLotes.some(bl => (bl.BATCH_ID === bId || bl.BATCH_ID === corr) && compareLoteCodes(bl.LOTE_ID, a.LOTE_ID)))
    ) || analisisSecos.some(s => s.BATCH_ID === bId || s.BATCH_ID === corr);

    // Datos de calidad (incremento de defectos y cocción en olla)
    const meta = getBatchMetadata(batch);
    const loteIds = meta.bLotes.map(bl => bl.LOTE_ID);
    const resultadosLocales = obtenerResultadosCoccionLocales();
    const coccionReal = buscarCoccionParaBatch(bId, corr, loteIds, resultadosLocales);
    const hasCoccion = Boolean(
      coccionReal && (
        (coccionReal.puntajeCoccion !== undefined && Number(coccionReal.puntajeCoccion) > 0) ||
        (coccionReal.tiempoCoccionMin !== undefined && String(coccionReal.tiempoCoccionMin).trim() !== "") ||
        coccionReal.esDatoReal === true ||
        coccionReal.tazasArroz !== undefined
      )
    );

    // 2. EVALUADO: Cuando se registran sus resultados de calidad: incremento de defectos y cocción en olla
    if (batch.ESTADO_BATCH === "EVALUADO" || (hasDescarga && hasCoccion)) {
      return "EVALUADO";
    }

    // 3. ANALISIS_FINAL: Cuando se registra su análisis de descarga
    if (batch.ESTADO_BATCH === "ANALISIS_FINAL" || hasDescarga) {
      return "ANALISIS_FINAL";
    }

    // Evaluar etapas de la ficha de REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO
    const ctrl = controles.find(c => c.BATCH_ID === bId || c.BATCH_ID === corr);
    const stages = evaluateControlSheetStages(ctrl);

    // 4. VAPORIZADO: Cuando se cierre y se liquide el batch
    if (
      batch.ESTADO_BATCH === "VAPORIZADO" ||
      batch.ESTADO_BATCH === "COMPLETADO" ||
      batch.ESTADO_BATCH === "TERMINADO" ||
      stages.isLiquidado
    ) {
      return "VAPORIZADO";
    }

    // 5. EN SECADO: Cuando se empieza a llenar la sección ETAPA DE SECADO (PERFILES 0 AL 12)
    if (rawEstado === "EN SECADO" || stages.hasEtapaSecado) {
      return "EN SECADO";
    }

    // 6. EN REPOSO: Cuando se empieza a llenar la sección de ETAPA DE 1° REPOSO DE GRANO
    if (rawEstado === "EN REPOSO" || stages.hasEtapaReposo) {
      return "EN REPOSO";
    }

    // 7. EN PROCESO: Cuando al lote le toca procesar y se empieza a llenar DATOS DE VAPORIZADO
    if (
      rawEstado === "EN PROCESO" ||
      rawEstado === "EN EJECUCION" ||
      rawEstado === "VAPORIZANDO" ||
      stages.hasDatosVaporizado
    ) {
      return "EN PROCESO";
    }

    // 8. PROGRAMADO: Cuando el lote ya ha pasado a la lista de programación
    return "PROGRAMADO";
  };

  // Helper to compile the 360° comprehensive report: Process, Output Parameters, and Cooking
  const getBatchFullReport = (batch: BatchVaporizado): BatchReportData => {
    const meta = getBatchMetadata(batch);
    const corr = batch.CORRELATIVO || batch.BATCH_ID;
    
    // Find matching records in available tables
    const ctrl = controles.find(c => c.BATCH_ID === batch.BATCH_ID || c.BATCH_ID === corr);
    const av = analisisVapList.find(a => a.BATCH_ID === batch.BATCH_ID || a.BATCH_ID === corr);
    const sec = presecados.find(p => p.BATCH_ID === batch.BATCH_ID || p.BATCH_ID === corr);
    const asObj = analisisSecos.find(s => s.BATCH_ID === batch.BATCH_ID || s.BATCH_ID === corr);

    // Incoming quality estimation
    const humIngreso = meta.humedadPromedio ?? 15.2;
    const qiIngreso = 14.5; // Default average incoming broken index

    // 1. Process Parameters
    const modalidadPases = ctrl?.MODALIDAD_PASES || "2_PASES";
    const presionVapor = ctrl?.PRESION_VAPOR_BAR || (modalidadPases === "2_PASES" ? 1.8 : 2.2);
    const presionMax = ctrl?.PRESION_MAX_BAR || 2.4;
    const tempVapor = ctrl?.TEMP_VAPOR_C || 118;
    const rpm = ctrl?.RPM_AUTOCLAVE || 14;
    const tiempoVaporMin = ctrl?.TIEMPO_VAPORIZADO_MIN || 18;
    const tiempoReposoMin = ctrl?.TIEMPO_REPOSO_MIN || 25;
    const secadoTemp = sec?.TEMP_SECADO_C || 52;
    const secadoTiempoMin = sec?.TIEMPO_SECADO_MIN || 45;
    const secadoMetodo = meta.isExcepcional ? "Secado Pampa + Torre" : "Torre Industrial de Secado";
    const equipo = batch.EQUIPO || ctrl?.EQUIPO_ID || "APIT";
    const operador = batch.OPERADOR || ctrl?.OPERADOR || "Pedro Huamán";
    const supervisor = ctrl?.SUPERVISOR || "Ing. Calidad Planta";
    const desviacion = ctrl?.DESVIACIONES || "Parámetros dentro de ventana operativa estándar";

    // 2. Output Quality Parameters
    const humSalida = av?.HUMEDAD_FINAL ?? asObj?.HUMEDAD_FINAL ?? 12.8;
    const deltaHumedad = Number((humSalida - humIngreso).toFixed(1));
    const quebradoSalida = av?.QUEBRADO_FINAL ?? asObj?.PORC_QUEBRADO ?? 16.8;
    const deltaQuebrado = Number(Math.max(0, quebradoSalida - qiIngreso).toFixed(1));
    const enteroSalida = Number((100 - quebradoSalida - 1.2).toFixed(1));
    const trizadoSalida = av?.TRIZADO_FINAL ?? 1.4;
    const tizaSalida = av?.TIZA_FINAL ?? 0.8;
    const blancuraSalida = av?.BLANCURA_KETT ?? 39.5;
    const manchadoSalida = av?.MANCHADO_FINAL ?? 0.6;
    const gelatinizacionPct = 98.2;
    const salidaAprobada = humSalida <= 13.5 && deltaQuebrado <= 3.5;

    // 3. Cooking Test & Culinary Evaluation from official sheets / integrated data
    const resultadosLocales = obtenerResultadosCoccionLocales();
    const loteIds = meta.bLotes.map(bl => bl.LOTE_ID);
    const coccionReal = buscarCoccionParaBatch(batch.BATCH_ID, corr, loteIds, resultadosLocales);

    const coccionScore = coccionReal?.puntajeCoccion ?? 94;
    const tiempoCoccionMin = coccionReal?.tiempoCoccionMin
      ? (typeof coccionReal.tiempoCoccionMin === "number" ? `${coccionReal.tiempoCoccionMin} min` : coccionReal.tiempoCoccionMin)
      : "18 - 20 min";
    const ratioAbsorcionAgua = coccionReal?.ratioAguaArroz || "1 : 2.4 (1 taza arroz : 2.4 tazas agua)";
    const expansionVolumetrica = coccionReal?.expansionVolumetrica || "x 2.6 volumen inicial (elongación axial óptima)";
    const texturaFirmeza = coccionReal?.texturaFrio || coccionReal?.texturaFirmeza || "Firme al dente, no gomoso, retención de elasticidad";
    const separacionGrano = coccionReal?.solturaGrano || "Grano 100% Suelto, no se apelmaza ni forma grumos";
    const aromaSabor = coccionReal?.aromaSabor || "Aroma característico agradable, sabor neutro suave";
    const colorCocido = coccionReal?.colorCocido || "Blanco marfil traslúcido homogéneo";
    const clasificacionCoccion = "PREMIUM EXTRA (Apto para Restaurantes y Retail)";
    const panelEvaluador = coccionReal?.panelista || "Laboratorio de Control de Calidad & Cocina Piloto";
    const observaciones = coccionReal?.observaciones || "Excelente desempeño en olla. Gelatinización homogénea en núcleo del grano sin fisuras periféricas. Rendimiento en porción superior a la media.";

    return {
      meta,
      proceso: {
        modalidadPases,
        presionVapor,
        presionMax,
        tempVapor,
        rpm,
        tiempoVaporMin,
        tiempoReposoMin,
        secadoTemp,
        secadoTiempoMin,
        secadoMetodo,
        equipo,
        operador,
        supervisor,
        desviacion
      },
      salida: {
        humIngreso,
        humSalida,
        deltaHumedad,
        enteroSalida,
        quebradoSalida,
        qiIngreso,
        deltaQuebrado,
        trizadoSalida,
        tizaSalida,
        blancuraSalida,
        manchadoSalida,
        gelatinizacionPct,
        salidaAprobada
      },
      coccion: {
        coccionScore,
        tazasArroz: coccionReal?.tazasArroz ?? 3,
        tazasAgua: coccionReal?.tazasAgua ?? "3 1/2",
        tiempoCoccionMin,
        ratioAbsorcionAgua,
        expansionVolumetrica,
        texturaFirmeza,
        separacionGrano,
        aromaSabor,
        colorCocido,
        clasificacionCoccion,
        panelEvaluador,
        observaciones,
        // Parámetros Organolépticos oficiales
        desplazamientoSeg: coccionReal?.desplazamientoSeg ?? "15 seg",
        granoQuebradoOllaPct: coccionReal?.granoQuebradoOllaPct ?? 18.0,
        granoHinchadoPct: coccionReal?.granoHinchadoPct ?? 8.6,
        granoAbiertoPct: coccionReal?.granoAbiertoPct ?? 1.3,
        texturaFrio: coccionReal?.texturaFrio ?? "Suave",
        rendimientoMasaPct: coccionReal?.rendimientoMasaPct ?? 260,
        // Comparativo Físico MP vs Descarga
        trizadoMP: coccionReal?.trizadoMP ?? 2.0,
        trizadoDescarga: coccionReal?.trizadoDescarga ?? 28.5,
        deltaTrizado: coccionReal?.deltaTrizado ?? 26.5,
        quebradoIntegralMP: coccionReal?.quebradoIntegralMP ?? 4.1,
        quebradoIntegralDescarga: coccionReal?.quebradoIntegralDescarga ?? 16.1,
        quebradoMP: coccionReal?.quebradoMP ?? 10.9,
        quebradoDescarga: coccionReal?.quebradoDescarga ?? 25.3,
        deltaQuebrado: coccionReal?.deltaQuebrado ?? 14.4,
        blancuraIntegralMP: coccionReal?.blancuraIntegralMP ?? 21.5,
        blancuraIntegralDescarga: coccionReal?.blancuraIntegralDescarga ?? 18.8,
        blancuraBlancoMP: coccionReal?.blancuraBlancoMP ?? 40.1,
        blancuraBlancoDescarga: coccionReal?.blancuraBlancoDescarga ?? 31.4,
        tizaTotalMasGcocidoMP: coccionReal?.tizaTotalMasGcocidoMP ?? 1.7,
        tizaTotalMasGcocidoDescarga: coccionReal?.tizaTotalMasGcocidoDescarga ?? 3.4,
        tpMasTpuntualMP: coccionReal?.tpMasTpuntualMP ?? 3.4,
        tpMasTpuntualDescarga: coccionReal?.tpMasTpuntualDescarga ?? 6.1,
        manchaMP: coccionReal?.manchaMP ?? 1.6,
        manchaDescarga: coccionReal?.manchaDescarga ?? 3.3,
        granoInmaduroMP: coccionReal?.granoInmaduroMP ?? 1.0,
        granoInmaduroDescarga: coccionReal?.granoInmaduroDescarga ?? 1.3,
        humedadCascaraMP: coccionReal?.humedadCascaraMP ?? 14.4,
        humedadCascaraDescarga: coccionReal?.humedadCascaraDescarga ?? 11.5,
        humedadBlancoDescarga: coccionReal?.humedadBlancoDescarga ?? 11.0,
        reposoCascaraDias: coccionReal?.reposoCascaraDias ?? 44,
        esDatoReal: Boolean(coccionReal),
        fuenteExterna: coccionReal?.fuenteExterna
      }
    };
  };

  // Filtered & Sorted Batches
  const filteredBatches = useMemo(() => {
    const result = batches.filter((b) => {
      const matchTurno = selectedTurnoFilter === "TODOS" || (b.TURNO || "Turno Día") === selectedTurnoFilter;
      const compEst = getComputedBatchStatus(b);
      const matchEstado = selectedEstadoFilter === "TODOS" || (() => {
        const bEst = compEst.toUpperCase().replace("_", " ");
        const fEst = selectedEstadoFilter.toUpperCase().replace("_", " ");
        if (bEst === fEst) return true;
        if (fEst === "EN PROCESO" && (bEst === "EN PROCESO" || bEst === "EN REPOSO" || bEst === "EN SECADO" || bEst === "VAPORIZANDO")) return true;
        if ((fEst === "COMPLETADO" || fEst === "TERMINADO" || fEst === "CERRADO") && (bEst === "COMPLETADO" || bEst === "TERMINADO" || bEst === "CERRADO")) return true;
        return false;
      })();
      const meta = getBatchMetadata(b);

      // Variedad filter
      const matchVariedad = selectedVariedadFilter === "TODAS" ||
        meta.variedadesList.some(v => v.toLowerCase() === selectedVariedadFilter.toLowerCase()) ||
        meta.variedadDisplay.toLowerCase().includes(selectedVariedadFilter.toLowerCase());

      // Humedad filter
      const matchHumedad = matchHumedadCategory(meta.humedadPromedio, selectedHumedadFilter);

      // Secado filter (Vaporizado siempre es en APIT; el secado es en APIT o GINSAC)
      const matchSecado = selectedSecadoFilter === "TODOS" || (() => {
        const eq = (b.EQUIPO || "").toUpperCase();
        if (selectedSecadoFilter === "APIT") return !eq.includes("GINSAC");
        if (selectedSecadoFilter === "GINSAC") return eq.includes("GINSAC");
        return true;
      })();

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchTurno && matchEstado && matchVariedad && matchHumedad && matchSecado;

      const matchSearch = 
        (b.CORRELATIVO && b.CORRELATIVO.toLowerCase().includes(q)) ||
        b.BATCH_ID.toLowerCase().includes(q) ||
        (b.EQUIPO && b.EQUIPO.toLowerCase().includes(q)) ||
        (b.OPERADOR && b.OPERADOR.toLowerCase().includes(q)) ||
        meta.clienteDisplay.toLowerCase().includes(q) ||
        meta.variedadDisplay.toLowerCase().includes(q) ||
        meta.bLotes.some(bl => bl.LOTE_ID.toLowerCase().includes(q));

      return matchTurno && matchEstado && matchVariedad && matchHumedad && matchSecado && matchSearch;
    });

    // Sorting (de arriba hacia abajo: el primer batch/lote a procesar arriba y va bajando)
    const parseSeq = (str?: string) => {
      const raw = (str || "").toString().trim().toUpperCase();
      const vMatch = raw.match(/V\s*(\d+)(?:\s*-\s*(\d+))?/i);
      if (vMatch) return { main: parseInt(vMatch[1], 10), sub: vMatch[2] ? parseInt(vMatch[2], 10) : 0 };
      const nMatch = raw.match(/(\d+)(?:\s*-\s*(\d+))?$/);
      if (nMatch) return { main: parseInt(nMatch[1], 10), sub: nMatch[2] ? parseInt(nMatch[2], 10) : 0 };
      return { main: 999999, sub: 0 };
    };

    return result.sort((a, b) => {
      if (sortBy === "fecha_desc") {
        const sA = parseSeq(a.CORRELATIVO || a.BATCH_ID);
        const sB = parseSeq(b.CORRELATIVO || b.BATCH_ID);
        if (sA.main !== sB.main) return sB.main - sA.main;
        if (sA.sub !== sB.sub) return sB.sub - sA.sub;
        return (b.FECHA_PROGRAMADA || b.FECHA_INICIO || "").localeCompare(a.FECHA_PROGRAMADA || a.FECHA_INICIO || "") ||
               (b.CORRELATIVO || b.BATCH_ID).localeCompare(a.CORRELATIVO || a.BATCH_ID, undefined, { numeric: true });
      }
      if (sortBy === "fecha_asc") {
        const sA = parseSeq(a.CORRELATIVO || a.BATCH_ID);
        const sB = parseSeq(b.CORRELATIVO || b.BATCH_ID);
        if (sA.main !== sB.main) return sA.main - sB.main;
        if (sA.sub !== sB.sub) return sA.sub - sB.sub;
        return (a.FECHA_PROGRAMADA || a.FECHA_INICIO || "").localeCompare(b.FECHA_PROGRAMADA || b.FECHA_INICIO || "") ||
               (a.CORRELATIVO || a.BATCH_ID).localeCompare(b.CORRELATIVO || b.BATCH_ID, undefined, { numeric: true });
      }
      if (sortBy === "peso_desc") {
        const pesoA = a.PESO_TOTAL_KG || (a.TON_PROGRAMADAS ? a.TON_PROGRAMADAS * 1000 : 0);
        const pesoB = b.PESO_TOTAL_KG || (b.TON_PROGRAMADAS ? b.TON_PROGRAMADAS * 1000 : 0);
        return pesoB - pesoA;
      }
      if (sortBy === "estado") {
        const order: Record<string, number> = { 
          "EN PROCESO": 1, 
          "EN REPOSO": 2,
          "EN SECADO": 3,
          "PROGRAMADO": 4, 
          "VAPORIZADO": 5, 
          "ANALISIS_FINAL": 6,
          "EVALUADO": 7,
          "CERRADO": 8, 
          "COMPLETADO": 8, 
          "TERMINADO": 8, 
          "OBSERVADO": 9 
        };
        const stA = getComputedBatchStatus(a);
        const stB = getComputedBatchStatus(b);
        return (order[stA] || 10) - (order[stB] || 10);
      }
      return 0;
    });
  }, [batches, batchLotes, lotes, analisisHumedos, controles, analisisVapList, analisisSecos, selectedTurnoFilter, selectedEstadoFilter, selectedVariedadFilter, selectedHumedadFilter, searchQuery, sortBy]);

  // Filtered Lotes with Pending Balance
  const lotesConSaldo = useMemo(() => {
    return lotes.filter((l) => {
      const s = saldosMap.get(l.LOTE_ID);
      const hasSaldo = s && s.saldoPendienteKg > 0;
      if (!hasSaldo) return false;

      // Variedad filter
      const varLote = (l.VARIEDAD || s?.variedad || "").trim();
      const matchVariedad = selectedVariedadFilter === "TODAS" ||
        varLote.toLowerCase() === selectedVariedadFilter.toLowerCase();

      // Humedad filter
      const ahObj = analisisHumedos.find(a => a.LOTE_ID === l.LOTE_ID);
      const humVal = Number(ahObj?.HUMEDADES ?? l.HUM ?? l.HUMEDAD ?? 0);
      const matchHumedad = matchHumedadCategory(humVal, selectedHumedadFilter);

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        l.LOTE_ID.toLowerCase().includes(q) ||
        (l.CLIENTE && l.CLIENTE.toLowerCase().includes(q)) ||
        (l.VARIEDAD && l.VARIEDAD.toLowerCase().includes(q));

      return matchVariedad && matchHumedad && matchSearch;
    });
  }, [lotes, saldosMap, analisisHumedos, selectedVariedadFilter, selectedHumedadFilter, searchQuery]);

  // General & Daily target statistics
  const todayStr = new Date().toISOString().split("T")[0];
  const batchesHoy = batches.filter((b) => (b.FECHA_PROGRAMADA || "").startsWith(todayStr));
  const batchesHoyCount = batchesHoy.length;
  const objetivoDia = parametros.lotesObjetivoPorDia || 2;
  const maxDia = parametros.maxLotesPorDia || 3;

  // Aggregate Batch KPIs computados en tiempo real
  const totalTnProgramadas = batches.reduce((acc, b) => acc + (b.TON_PROGRAMADAS || (b.PESO_TOTAL_KG ? b.PESO_TOTAL_KG / 1000 : 0)), 0);
  const totalBatchesProgramados = batches.filter(b => getComputedBatchStatus(b) === "PROGRAMADO").length;
  const totalBatchesEnProceso = batches.filter(b => getComputedBatchStatus(b) === "EN PROCESO").length;
  const totalBatchesVaporizados = batches.filter(b => getComputedBatchStatus(b) === "VAPORIZADO").length;
  const totalBatchesCompletados = batches.filter(b => getComputedBatchStatus(b) === "CERRADO" || getComputedBatchStatus(b) === "COMPLETADO").length;

  // Open Traceability Handler
  const handleOpenTrazabilidad = (type: "batch" | "lote", id: string) => {
    setTrazabilidadTarget({ type, id });
    setIsTrazabilidadModalOpen(true);
  };

  // Direct Official Sheet PDF Generator & Printer from Batches View
  const handlePrintOfficialBatchSheet = (batch: BatchVaporizado) => {
    try {
      const meta = getBatchMetadata(batch);
      const corr = batch.CORRELATIVO || batch.BATCH_ID;
      const ctrl = controles.find((c) => c.BATCH_ID === batch.BATCH_ID || c.BATCH_ID === corr);

      generateHojaControlVaporizadoPDF({
        batchCode: corr,
        fecha: batch.FECHA_PROGRAMADA || batch.FECHA_INICIO || ctrl?.FECHA_HORA_INICIO?.substring(0, 10) || new Date().toISOString().substring(0, 10),
        supervisor: ctrl?.SUPERVISOR || "Jefe de Turno",
        operario: batch.OPERADOR || ctrl?.OPERADOR || "Operador de Planta",
        cliente: meta.clienteDisplay || "Cliente de Producción",
        desviacion: ctrl?.DESVIACIONES || "Sin novedades / Parámetros conformes",
        datosIngreso: ctrl?.datosIngreso || {
          codigo: corr,
          variedad: meta.variedadDisplay,
          sacos: meta.totalSacos,
          kgTotales: meta.pesoEfectivoKg,
          humedadInicial: meta.humedadPromedio ?? 14.5,
          trizadoInicial: 2.0,
          quebradoInicial: 4.5,
          gYesosoInicial: 1.5,
          sublotes: meta.bLotes.map((bl) => ({
            codigo: bl.LOTE_ID,
            cliente: bl.CLIENTE,
            variedad: bl.VARIEDAD,
            sacos: bl.SACOS,
            kg: bl.PESO_KG
          }))
        },
        datosVaporizado: ctrl?.datosVaporizado || {
          llenadoTanqueHoraInicio: ctrl?.HORA_INICIO || "07:00",
          llenadoTanqueHoraFinal: "07:45",
          llenadoAguaHoraInicio: "07:45",
          llenadoAguaHoraFinal: "08:15",
          tempAguaInicial: 65,
          remojoHoraInicio: "08:15",
          remojoHoraFinal: "11:45",
          remojoTiempoMin: 210,
          evacuacionAguaHoraInicio: "11:45",
          evacuacionAguaHoraFinal: "12:05",
          inyeccionVaporHoraInicio: "12:05",
          inyeccionVaporHoraFinal: "12:25",
          presionVaporKgCm2: ctrl?.PRESION_VAPOR_BAR || 1.8,
          reposoVaporHoraInicio: "12:25",
          reposoVaporHoraFinal: "12:40",
          descargaVaporHoraInicio: "12:40",
          descargaVaporHoraFinal: "13:15",
          presecadoElevador4HoraInicio: "12:40",
          presecadoElevador4HoraFinal: "13:15"
        },
        parametrosPaddy: ctrl?.parametrosPaddy || {
          humedadPostVaporizado: 28.5,
          gelatinizacionSolidos: "98% Homogéneo",
          indiceQuebradoPostVap: 4.8,
          granoPartidosPostVap: 1.2,
          granoReventadoPostVap: 0.4
        },
        silos: ctrl?.silos || [],
        silosPase2: (ctrl as any)?.silosPase2 || [],
        etapaReposo1: ctrl?.etapaReposo1,
        etapaEnfriamiento: ctrl?.etapaEnfriamiento,
        etapaReposo2: ctrl?.etapaReposo2,
        perfilesSecado: ctrl?.perfilesSecado || [],
        recetaSecado: ctrl?.recetaSecado,
        observaciones: batch.OBSERVACIONES || ctrl?.OBSERVACIONES
      });

      setNotifMessage(`📄 Ficha Oficial del Batch ${corr} descargada en PDF y lista para imprimir.`);
      setTimeout(() => setNotifMessage(null), 5000);
    } catch (err) {
      console.error("Error al imprimir ficha oficial del batch:", err);
      window.print();
    }
  };

  // Open New Batch preloaded with a lot
  const handleOpenNewBatchWithLote = (loteId: string) => {
    setInitialLoteForNewBatch(loteId);
    setIsNuevoBatchModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      
      {/* Top Header Banner Notification */}
      {notifMessage && (
        <div className="p-4 bg-emerald-950/90 border-2 border-emerald-500 rounded-2xl text-emerald-200 text-xs font-bold flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notifMessage}</span>
          </div>
          <button 
            onClick={() => setNotifMessage(null)}
            className="text-emerald-400 hover:text-white px-2 py-0.5 rounded text-[11px]"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <Layers className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Batches Guardados de Vaporizado
              </h1>
              <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-300 font-mono font-bold rounded-lg border border-amber-500/30">
                {batches.length} {batches.length === 1 ? "Batch" : "Batches"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Registro histórico y en línea de batches programados, en ejecución y completados. Acceso directo a control de vaporizado, análisis de calidad y trazabilidad.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-abrir-unir-codigos-header"
              onClick={() => setIsModalUnirCodigosOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer"
              title="Unir códigos compatibles en un proceso macro y sub-batches"
            >
              <GitMerge className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>Unir Códigos / Sub-Batches</span>
            </button>

            <button
              id="btn-abrir-formato-coccion-oficial"
              onClick={() => setIsFormatoOficialOpen(true)}
              className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              title="Abrir Formato Físico de Registro de Vaporizado (Partes 1, 3, 4 y Envase Proyectado)"
            >
              <FileCheck className="w-4 h-4 text-amber-400" />
              <span>Ficha Cocción (Partes 1, 3, 4)</span>
            </button>

            <button
              id="btn-abrir-parametros-trabajo"
              onClick={() => {
                if (!canAjustarParametros) {
                  setNotifMessage(obtenerMensajeRestriccion("editar_receta_autoclave"));
                  return;
                }
                setIsParametrosModalOpen(true);
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 shadow-sm ${
                canAjustarParametros
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 cursor-pointer"
                  : "bg-slate-800/50 text-slate-400 border-slate-800 cursor-pointer hover:bg-slate-800"
              }`}
              title={canAjustarParametros ? "Ajustar parámetros y receta de vaporizado" : "Solo lectura para su rol"}
            >
              <Settings className={`w-4 h-4 ${canAjustarParametros ? "text-amber-400" : "text-slate-500"}`} />
              <span>Parámetros</span>
              {!canAjustarParametros && <Lock className="w-3 h-3 text-amber-400 ml-0.5" />}
            </button>
          </div>
        </div>

        {/* Operational KPI & Target Metrics Strip - Compacto y Directo */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-semibold">Estado:</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 font-mono">
              {totalBatchesProgramados} Prog.
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 font-mono">
              {totalBatchesEnProceso} En Proc.
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 font-mono">
              {totalBatchesVaporizados} Vap.
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 font-mono">
              {totalBatchesCompletados} Cerrados
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-slate-300">
              <span className="text-slate-500 mr-1.5">Volumen:</span>
              <strong className="text-white font-mono">{totalTnProgramadas.toFixed(1)} TN</strong>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-500 mr-1.5">Meta Hoy:</span>
              <strong className="text-amber-400 font-mono">{batchesHoyCount}/{objetivoDia}</strong>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-500 mr-1.5">Lotes con Saldo:</span>
              <strong className="text-emerald-400 font-mono">{lotesConSaldo.length} lotes</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation & Filters Bar - Limpio, Sin Aglomeración */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Sub-tabs Esenciales */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTabSubView("batches")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTabSubView === "batches"
                  ? "bg-amber-500 text-slate-950 shadow font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Batches ({filteredBatches.length})</span>
            </button>
            <button
              onClick={() => setActiveTabSubView("comparador")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTabSubView === "comparador"
                  ? "bg-amber-500 text-slate-950 shadow font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Cocción & Calidad</span>
            </button>
            <button
              onClick={() => setActiveTabSubView("saldos")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeTabSubView === "saldos"
                  ? "bg-amber-500 text-slate-950 shadow font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Saldos ({lotesConSaldo.length})</span>
            </button>
          </div>

          {/* Buscador & Controles Inmediatos */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Search Box */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar batch, lote, cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-medium"
              />
            </div>

            {/* Estado Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedEstadoFilter}
                onChange={(e) => setSelectedEstadoFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer"
              >
                <option value="TODOS" className="bg-slate-900">Todos los Estados</option>
                <option value="PROGRAMADO" className="bg-slate-900">3. Programado</option>
                <option value="EN PROCESO" className="bg-slate-900">4. En Proceso (Vaporizado)</option>
                <option value="EN REPOSO" className="bg-slate-900">5. En Reposo (1° Reposo)</option>
                <option value="EN SECADO" className="bg-slate-900">6. En Secado (Perfiles 0-12)</option>
                <option value="VAPORIZADO" className="bg-slate-900">7. Vaporizado (Liquidado)</option>
                <option value="ANALISIS_FINAL" className="bg-slate-900">8. Análisis Final (Descarga)</option>
                <option value="EVALUADO" className="bg-slate-900">9. Evaluado (Calidad & Cocción)</option>
                <option value="CERRADO" className="bg-slate-900">10. Cerrado Completamente</option>
              </select>
            </div>

            {/* Botón Filtros Adicionales */}
            <button
              type="button"
              onClick={() => setShowExtraFilters(!showExtraFilters)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                showExtraFilters || (selectedTurnoFilter !== "TODOS" || selectedVariedadFilter !== "TODAS" || selectedHumedadFilter !== "TODAS")
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
              }`}
              title="Mostrar u ocultar filtros avanzados (Turno, Variedad, Humedad, Orden)"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {(selectedTurnoFilter !== "TODOS" || selectedVariedadFilter !== "TODAS" || selectedHumedadFilter !== "TODAS") && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleLimpiarFiltros}
                className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow"
                title="Restablecer todos los filtros"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}

            {/* View Mode Toggle */}
            {activeTabSubView === "batches" && (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewLayout("lista")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewLayout === "lista"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista de Lista Detallada (Tabla)"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout("cuadricula")}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewLayout === "cuadricula"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Vista de Cuadrícula / Tarjetas"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fila Secundaria Desplegable para Filtros Avanzados */}
        {showExtraFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Secado Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedSecadoFilter}
                onChange={(e) => setSelectedSecadoFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer"
              >
                <option value="TODOS" className="bg-slate-900">Todo el Secado</option>
                <option value="APIT" className="bg-slate-900">Secado en APIT</option>
                <option value="GINSAC" className="bg-slate-900">Secado en GINSAC</option>
              </select>
            </div>

            {/* Turno Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedTurnoFilter}
                onChange={(e) => setSelectedTurnoFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer"
              >
                <option value="TODOS" className="bg-slate-900">Todos los Turnos</option>
                <option value="Turno Día" className="bg-slate-900">Turno Día</option>
                <option value="Turno Noche" className="bg-slate-900">Turno Noche</option>
              </select>
            </div>

            {/* Variedad Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedVariedadFilter}
                onChange={(e) => setSelectedVariedadFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer max-w-[140px]"
              >
                <option value="TODAS" className="bg-slate-900">Todas las Variedades</option>
                {todasLasVariedades.map((v) => (
                  <option key={v} value={v} className="bg-slate-900">{v}</option>
                ))}
              </select>
            </div>

            {/* Humedad Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedHumedadFilter}
                onChange={(e) => setSelectedHumedadFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer"
              >
                <option value="TODAS" className="bg-slate-900">Todas las Humedades</option>
                <option value="MENOR_14" className="bg-slate-900">&lt; 14.0% (Seco)</option>
                <option value="14_18" className="bg-slate-900">14.0% - 18.0% (Óptima)</option>
                <option value="18_22" className="bg-slate-900">18.1% - 22.0% (Húmedo Paddy)</option>
                <option value="MAYOR_22" className="bg-slate-900">&gt; 22.0% (Crítico)</option>
              </select>
            </div>

            {/* Sort Control */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer"
              >
                <option value="fecha_desc" className="bg-slate-900">Más recientes primero</option>
                <option value="fecha_asc" className="bg-slate-900">Más antiguos primero</option>
                <option value="peso_desc" className="bg-slate-900">Mayor peso (TN)</option>
                <option value="estado" className="bg-slate-900">Por Estado</option>
              </select>
            </div>
          </div>
        )}

      </div>

      {/* Active Filter Chips Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap text-xs px-1">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3 text-amber-400" />
            Filtros activos:
          </span>

          {selectedSecadoFilter !== "TODOS" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-bold">
              <Flame className="w-3 h-3" />
              {selectedSecadoFilter === "GINSAC" ? "Secado en GINSAC" : "Secado en APIT"}
              <button
                onClick={() => setSelectedSecadoFilter("TODOS")}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ×
              </button>
            </span>
          )}

          {selectedVariedadFilter !== "TODAS" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-bold">
              <Tag className="w-3 h-3" />
              Variedad: {selectedVariedadFilter}
              <button
                onClick={() => setSelectedVariedadFilter("TODAS")}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ×
              </button>
            </span>
          )}

          {selectedHumedadFilter !== "TODAS" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-bold">
              <Droplets className="w-3 h-3" />
              Humedad: {
                selectedHumedadFilter === "MENOR_14" ? "< 14.0%" :
                selectedHumedadFilter === "14_18" ? "14.0% - 18.0%" :
                selectedHumedadFilter === "18_22" ? "18.1% - 22.0%" : "> 22.0%"
              }
              <button
                onClick={() => setSelectedHumedadFilter("TODAS")}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ×
              </button>
            </span>
          )}

          {selectedTurnoFilter !== "TODOS" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold">
              <Clock className="w-3 h-3" />
              {selectedTurnoFilter}
              <button
                onClick={() => setSelectedTurnoFilter("TODOS")}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ×
              </button>
            </span>
          )}

          {selectedEstadoFilter !== "TODOS" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold">
              Estado: {selectedEstadoFilter}
              <button
                onClick={() => setSelectedEstadoFilter("TODOS")}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ×
              </button>
            </span>
          )}

          {searchQuery.trim() !== "" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold">
              <Search className="w-3 h-3" />
              "{searchQuery}"
              <button
                onClick={() => setSearchQuery("")}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* VIEW 1: BATCHES DE VAPORIZADO (LISTA DE BATCHES GUARDADOS) */}
      {activeTabSubView === "batches" && (
        <div className="space-y-4">

          {/* SECCIÓN DE RESUMEN: PROMEDIOS DE TRIZADO, CUARTEADO, DEFECTOS & RESULTADOS DE COCCIÓN */}
          <ResumenParametrosCoccionSection
            batches={batches}
            filteredBatches={filteredBatches}
            batchLotes={batchLotes}
            lotes={lotes}
            controles={controles}
            analisisVapList={analisisVapList}
            presecados={presecados}
            analisisHumList={analisisHumedos}
            analisisSecList={analisisSecos}
            onOpenComparador={() => setActiveTabSubView("comparador")}
            onOpenIntegracionCoccion={() => setIsCoccionModalOpen(true)}
            onOpenFormatoOficial={() => setIsFormatoOficialOpen(true)}
          />

          {/* BANNER DE ALARMAS ACTIVAS POR DESVIACIÓN DE PESO PROYECTADO (±2%) EN BATCHES */}
          {(() => {
            const batchesConAlarma = filteredBatches
              .map((b) => ({ batch: b, meta: getBatchMetadata(b) }))
              .filter((item) => item.meta.alarmaPesoActiva);

            if (batchesConAlarma.length === 0) return null;

            return (
              <div className="bg-rose-950/40 border-2 border-rose-500 rounded-2xl p-4 shadow-xl shadow-rose-950/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-600 text-white animate-bounce shrink-0">
                      <BellRing className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black uppercase text-rose-200 tracking-wide">
                        Alarma de Peso Proyectado en Batch ({batchesConAlarma.length}{" "}
                        {batchesConAlarma.length === 1 ? "Batch fuera de rango" : "Batches fuera de rango"})
                      </h3>
                      <p className="text-[11px] text-rose-300/90">
                        Los siguientes batches tienen un Peso Real de Descarga fuera del rango permitido (±2% del Peso de Ingreso). Sustente su observación y acéptelo para retirar la alarma.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {batchesConAlarma.map(({ batch: bAlarma, meta: mAlarma }) => {
                    const corrAlarma = bAlarma.CORRELATIVO || bAlarma.BATCH_ID;
                    const minPermitido = Number(
                      Math.max(0, mAlarma.pesoProyectadoKg - mAlarma.toleranciaDescargaKg).toFixed(2)
                    );
                    const maxPermitido = Number(
                      (mAlarma.pesoProyectadoKg + mAlarma.toleranciaDescargaKg).toFixed(2)
                    );
                    return (
                      <div
                        key={bAlarma.BATCH_ID}
                        className="bg-slate-950/90 border border-rose-500/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-black text-[11px]">
                              BATCH {corrAlarma}
                            </span>
                            <span className="font-bold text-slate-200">{mAlarma.clienteDisplay}</span>
                            <span className="text-[10px] text-amber-300 font-semibold">
                              ({mAlarma.variedadDisplay})
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>
                              Real: <strong className="text-rose-400">{mAlarma.pesoRealDescargaKg.toLocaleString("es-PE")} kg</strong>
                            </span>
                            <span>
                              Proyectado: <strong className="text-amber-300">{mAlarma.pesoProyectadoKg.toLocaleString("es-PE")} kg</strong>
                            </span>
                            <span>
                              Rango (±2%): <strong>{minPermitido.toLocaleString("es-PE")} – {maxPermitido.toLocaleString("es-PE")} kg</strong>
                            </span>
                            <span className="text-rose-400 font-black">
                              Δ {mAlarma.diferenciaDescargaKg > 0 ? `+${mAlarma.diferenciaDescargaKg.toLocaleString("es-PE")}` : mAlarma.diferenciaDescargaKg.toLocaleString("es-PE")} kg
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenSustentoAlarmaModal(bAlarma, mAlarma.sustentoAlarmaPeso)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Sustentar y Aceptar (Retirar Alarma)</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {filteredBatches.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No se encontraron Batches</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No hay batches de vaporizado guardados que coincidan con los filtros seleccionados.
              </p>
              <button
                onClick={() => onNavigate("priorizacion-programacion", "nuevo-batch")}
                className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Crear Primer Batch
              </button>
            </div>
          ) : viewLayout === "lista" ? (
            /* ========================================================================= */
            /* 1. LISTA ESTRUCTURADA / TABLA INDUSTRIAL (DEFAULT USER REQUEST)           */
            /* ========================================================================= */
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-xl">
              
              {/* Table Toolbar */}
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 font-semibold">
                  <span>Mostrando <strong className="text-white font-mono">{filteredBatches.length}</strong> batches guardados</span>
                  <span className="text-slate-600">•</span>
                  <span>Volumen: <strong className="text-amber-400 font-mono">{filteredBatches.reduce((sum, b) => sum + (b.TON_PROGRAMADAS || ((b.PESO_TOTAL_KG || 0)/1000)), 0).toFixed(2)} TN</strong></span>
                </div>

                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {expandedBatches.size === filteredBatches.length ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Contraer todos los lotes</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Expandir desglose de lotes</span>
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/90 text-slate-400 font-bold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3 w-10 text-center">#</th>
                      <th className="px-3 py-3">Batch / Autoclave</th>
                      <th className="px-3 py-3">Fecha & Turno</th>
                      <th className="px-3 py-3">Cliente & Variedad</th>
                      <th className="px-3 py-3 text-center">Humedad Prom.</th>
                      <th className="px-3 py-3 text-right">Peso Ingreso</th>
                      <th className="px-3 py-3 text-center">Sacas de Descarga</th>
                      <th className="px-3 py-3 text-right">Peso Real</th>
                      <th className="px-3 py-3 text-right">Proyectado</th>
                      <th className="px-3 py-3 text-center">Salida Calidad</th>
                      <th className="px-3 py-3 text-center">Cocción</th>
                      <th className="px-3 py-3 text-center">Estado</th>
                      <th className="px-3 py-3">Operador</th>
                      <th className="px-3 py-3 text-right">Resumen & Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-sans">
                    {filteredBatches.map((batch, index) => {
                      const meta = getBatchMetadata(batch);
                      const reportData = getBatchFullReport(batch);
                      const corr = batch.CORRELATIVO || batch.BATCH_ID;
                      const isExpanded = expandedBatches.has(batch.BATCH_ID);
                      const currentTab = expandedTabPerBatch[batch.BATCH_ID] || "resumen";

                      return (
                        <React.Fragment key={batch.BATCH_ID}>
                          <tr className={`hover:bg-slate-800/50 transition-colors ${isExpanded ? "bg-slate-850/60" : ""}`}>
                            {/* Expand toggle & Row Number */}
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleBatchExpand(batch.BATCH_ID)}
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                                title={isExpanded ? "Ocultar resumen del proceso" : "Ver resumen del proceso y cocción"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Batch Correlativo & Autoclave */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-amber-400 text-xs px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg whitespace-nowrap">
                                  BATCH {corr}
                                </span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-xs block leading-tight">
                                      APIT
                                    </span>
                                    {batch.ES_SUB_BATCH && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-orange-950/80 text-orange-300 border border-orange-700/50 inline-flex items-center gap-1">
                                        <GitMerge className="w-2.5 h-2.5 text-orange-400" />
                                        {batch.PROCESO_PADRE ? `Proceso ${batch.PROCESO_PADRE}` : "Sub-Batch"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    {batch.BATCH_ID}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Fecha & Turno */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-xs text-slate-200 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>{batch.FECHA_PROGRAMADA || batch.FECHA_INICIO || "Sin fecha"}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-amber-300/90 font-semibold mt-0.5">
                                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{batch.TURNO || "Turno Día"}</span>
                              </div>
                            </td>

                            {/* Cliente & Variedad */}
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-200 max-w-[170px] truncate" title={meta.clienteDisplay}>
                                {meta.clienteDisplay}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="px-2 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50 text-[10px] font-bold">
                                  {meta.variedadDisplay}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {meta.bLotes.length} {meta.bLotes.length === 1 ? "lote" : "lotes"}
                                </span>
                              </div>
                            </td>

                            {/* Humedad Promedio */}
                            <td className="px-3 py-3 text-center whitespace-nowrap font-mono">
                              {meta.humedadPromedio !== undefined ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                  meta.humedadPromedio < 14.0
                                    ? "bg-cyan-950/60 text-cyan-300 border-cyan-800/60"
                                    : meta.humedadPromedio <= 18.0
                                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                                    : meta.humedadPromedio <= 22.0
                                    ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                                    : "bg-rose-950/60 text-rose-300 border-rose-800/60"
                                }`}>
                                  <Droplets className="w-3 h-3" />
                                  {meta.humedadPromedio}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">-</span>
                              )}
                            </td>

                            {/* Peso Total Ingreso (TN / kg) */}
                            <td className="px-3 py-3 text-right whitespace-nowrap font-mono">
                              <strong className="text-emerald-400 text-sm block">
                                {meta.tonEfectivas.toFixed(2)} TN
                              </strong>
                              <span className="text-[10px] text-slate-400">
                                {meta.pesoEfectivoKg.toLocaleString()} kg ({meta.totalSacos} scs)
                              </span>
                            </td>

                            {/* SACAS DE DESCARGA (Big Bags) */}
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedBatchForSacasModal(batch)}
                                className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                  meta.totalSacasDescarga > 0
                                    ? "bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border-purple-500/40"
                                    : "bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700"
                                }`}
                                title="Click para subir o editar pesos de Sacas Big Bag por balanza"
                              >
                                <span className="font-mono font-black text-[11px] flex items-center gap-1">
                                  <Scale className="w-3 h-3 text-purple-400" />
                                  {meta.totalSacasDescarga > 0
                                    ? `${meta.totalSacasDescarga} ${meta.totalSacasDescarga === 1 ? "Saca" : "Sacas"}`
                                    : "0 Sacas"}
                                </span>
                                <span className="text-[9px] text-purple-300/90 font-semibold">
                                  {meta.totalSacasDescarga > 0 ? "Big Bag (Ver/Editar)" : "+ Subir Balanza"}
                                </span>
                              </button>
                            </td>

                            {/* PESO REAL DE DESCARGA (kg) & ESTADO DE ALARMA / SUSTENTO */}
                            <td className="px-3 py-3 text-right whitespace-nowrap font-mono">
                              {meta.pesoRealDescargaKg > 0 ? (
                                <div className="space-y-1">
                                  <strong className={`text-sm block font-black ${
                                    meta.dentroToleranciaDescarga
                                      ? "text-emerald-400"
                                      : meta.alarmaPesoAceptada
                                      ? "text-amber-300"
                                      : "text-rose-400"
                                  }`}>
                                    {meta.pesoRealDescargaKg.toLocaleString("es-PE")} kg
                                  </strong>
                                  <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded inline-block ${
                                    meta.dentroToleranciaDescarga
                                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                                      : meta.alarmaPesoAceptada
                                      ? "bg-amber-950/80 text-amber-300 border border-amber-600/60"
                                      : "bg-rose-600 text-white border border-rose-400 animate-pulse"
                                  }`}>
                                    {meta.dentroToleranciaDescarga
                                      ? "✓ OK"
                                      : meta.alarmaPesoAceptada
                                      ? "✓ Aceptado c/ Sustento"
                                      : "🚨 ALARMA"} Δ {meta.diferenciaDescargaKg > 0 ? `+${meta.diferenciaDescargaKg.toLocaleString("es-PE")}` : meta.diferenciaDescargaKg.toLocaleString("es-PE")} kg
                                  </span>
                                  {meta.alarmaPesoActiva && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSustentoAlarmaModal(batch, meta.sustentoAlarmaPeso)}
                                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-black text-[9.5px] inline-flex items-center gap-1 shadow cursor-pointer"
                                        title="Sustentar observación y aceptar para retirar la alarma del batch"
                                      >
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>Sustentar y Retirar Alarma</span>
                                      </button>
                                    </div>
                                  )}
                                  {meta.alarmaPesoAceptada && meta.sustentoAlarmaPeso && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSustentoAlarmaModal(batch, meta.sustentoAlarmaPeso)}
                                        className="text-[9.5px] text-amber-300 hover:text-amber-200 font-sans underline cursor-pointer max-w-[150px] truncate block ml-auto"
                                        title={`Sustento: ${meta.sustentoAlarmaPeso}`}
                                      >
                                        Ver sustento: "{meta.sustentoAlarmaPeso}"
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedBatchForSacasModal(batch)}
                                  className="text-[10px] text-amber-400 hover:text-amber-300 font-sans font-bold underline cursor-pointer"
                                >
                                  Pendiente balanza
                                </button>
                              )}
                            </td>

                            {/* PESO PROYECTADO (kg) */}
                            <td className="px-3 py-3 text-right whitespace-nowrap font-mono">
                              <strong className="text-amber-300 text-sm block font-black">
                                {meta.pesoProyectadoKg.toLocaleString("es-PE")} kg
                              </strong>
                              <span className="text-[9.5px] text-slate-400 block" title="Rango permitido: ±2% del Peso de Ingreso">
                                ±{meta.toleranciaDescargaKg.toLocaleString("es-PE")} kg (±2%)
                              </span>
                            </td>

                            {/* Salida Calidad */}
                            <td className="px-3 py-3 text-center whitespace-nowrap font-mono">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-[11px] font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                                  {reportData.salida.humSalida}% H
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  {reportData.salida.blancuraSalida}° Kett
                                </span>
                              </div>
                            </td>

                            {/* Cocción */}
                            <td className="px-3 py-3 text-center whitespace-nowrap font-mono">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/50 flex items-center gap-0.5">
                                  <Award className="w-3 h-3 text-amber-400" />
                                  <span>{reportData.coccion.coccionScore} pts</span>
                                </span>
                                <span className="text-[9px] text-emerald-400 font-semibold font-sans mt-0.5">
                                  100% Suelto
                                </span>
                              </div>
                            </td>

                            {/* Estado Batch */}
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {(() => {
                                const compEstado = getComputedBatchStatus(batch);
                                const isCerrado =
                                  compEstado === "CERRADO" ||
                                  compEstado === "COMPLETADO" ||
                                  batch.ESTADO_BATCH === "CERRADO" ||
                                  batch.ESTADO_BATCH === "COMPLETADO" ||
                                  meta.bLotes.some((bl) => {
                                    const lObj = lotes.find((l) => compareLoteCodes(l.LOTE_ID, bl.LOTE_ID));
                                    return (
                                      String(bl.ESTADO || "").toUpperCase().trim() === "CERRADO" ||
                                      String(lObj?.ESTADO_LOTE || lObj?.ESTADO || "").toUpperCase().trim() === "CERRADO"
                                    );
                                  });
                                return (
                                  <div className="inline-flex flex-col items-center gap-1">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                      compEstado === "CERRADO" || compEstado === "COMPLETADO"
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : compEstado === "EVALUADO"
                                        ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                                        : compEstado === "ANALISIS_FINAL"
                                        ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40"
                                        : compEstado === "VAPORIZADO"
                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                        : compEstado === "EN SECADO"
                                        ? "bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse"
                                        : compEstado === "EN REPOSO"
                                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse"
                                        : compEstado === "EN PROCESO"
                                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse"
                                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    }`}>
                                      {(compEstado === "EN PROCESO" || compEstado === "EN REPOSO" || compEstado === "EN SECADO") && <Activity className="w-3 h-3" />}
                                      {(compEstado === "CERRADO" || compEstado === "COMPLETADO" || compEstado === "EVALUADO") && <CheckCircle2 className="w-3 h-3" />}
                                      {compEstado === "VAPORIZADO" && <Flame className="w-3 h-3 text-purple-400" />}
                                      {compEstado}
                                    </span>
                                    {isCerrado && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenFichaBatchCerrado(batch)}
                                        className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[9.5px] inline-flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                                        title="Ver Ficha Final de Batch Cerrado"
                                      >
                                        <FileCheck className="w-2.5 h-2.5" />
                                        <span>Ficha Final Cerrado</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Operador */}
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="font-medium text-slate-300 text-xs block">
                                {batch.OPERADOR || "Pedro Huamán"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {reportData.proceso.secadoMetodo}
                              </span>
                            </td>

                            {/* Acciones Operativas */}
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                
                                {/* Resumen Completo & Cocción Modal Trigger */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedBatchForReport(batch)}
                                  className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                                  title="Ver Resumen Completo del Proceso, Salida y Cocción"
                                >
                                  <Flame className="w-3.5 h-3.5 fill-current text-slate-950" />
                                  <span>Resumen & Cocción</span>
                                </button>

                                {/* Imprimir Ficha Oficial PDF */}
                                <button
                                  type="button"
                                  onClick={() => handlePrintOfficialBatchSheet(batch)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                                  title="Imprimir / Descargar Ficha Oficial del Batch (PDF A4)"
                                >
                                  <Printer className="w-3.5 h-3.5 text-cyan-500" />
                                  <span className="hidden xl:inline">Imprimir Ficha</span>
                                </button>

                                {/* Primary Action: Basado en estado computado en tiempo real */}
                                {(() => {
                                  const compEstado = getComputedBatchStatus(batch);
                                  return (
                                    <>
                                      {compEstado === "PROGRAMADO" && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (onUpdateBatchState) {
                                              await onUpdateBatchState(batch.BATCH_ID, "EN_PROCESO");
                                            }
                                            onNavigate("control-vaporizado", batch.BATCH_ID);
                                          }}
                                          className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow cursor-pointer active:scale-95"
                                          title="Iniciar proceso y abrir Control de Vaporizado"
                                        >
                                          <Play className="w-3.5 h-3.5 fill-current" />
                                        </button>
                                      )}

                                      {(compEstado === "EN PROCESO" || compEstado === "EN REPOSO" || compEstado === "EN SECADO") && (
                                        <button
                                          type="button"
                                          onClick={() => onNavigate("control-vaporizado", batch.BATCH_ID)}
                                          className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow cursor-pointer active:scale-95 animate-pulse"
                                          title={`Continuar en Control de Vaporizado (${compEstado})`}
                                        >
                                          <Activity className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      {(compEstado === "VAPORIZADO" || compEstado === "ANALISIS_FINAL") && (
                                        <button
                                          type="button"
                                          onClick={() => onNavigate("analisis-vaporizado", batch.BATCH_ID)}
                                          className="p-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-purple-700 cursor-pointer"
                                          title={compEstado === "VAPORIZADO" ? "Batch Vaporizado: Registrar Análisis de Descarga" : "Análisis de Descarga registrado: Registrar Calidad y Cocción"}
                                        >
                                          <Flame className="w-3.5 h-3.5 text-purple-400" />
                                        </button>
                                      )}

                                      {(compEstado === "VAPORIZADO" || compEstado === "ANALISIS_FINAL" || compEstado === "EVALUADO") && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!canCerrarBatch) {
                                              setNotifMessage(`⚠️ ${obtenerMensajeRestriccion("cerrar_aprobar_batch")}`);
                                              setTimeout(() => setNotifMessage(null), 5000);
                                              return;
                                            }
                                            localDB.cerrarTotalBatch(batch.BATCH_ID);
                                            if (onRefreshData) onRefreshData();
                                            setNotifMessage(`🔒 Batch ${corr} cerrado completamente. Sus lotes han pasado al estado CERRADO.`);
                                            setTimeout(() => setNotifMessage(null), 5000);
                                            handleOpenFichaBatchCerrado(batch);
                                          }}
                                          className={`px-2.5 py-1.5 ${canCerrarBatch ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400 border border-slate-700"} rounded-lg text-[11px] font-black transition-all flex items-center gap-1 shadow cursor-pointer`}
                                          title={canCerrarBatch ? "Cerrar Batch Completamente y abrir Ficha Final de Batch Cerrado" : "Requiere permisos de Jefatura para cerrar batch"}
                                        >
                                          <Lock className="w-3.5 h-3.5" />
                                          <span className="hidden xl:inline">Cerrar Batch</span>
                                        </button>
                                      )}

                                      {(compEstado === "CERRADO" ||
                                        compEstado === "COMPLETADO" ||
                                        batch.ESTADO_BATCH === "CERRADO" ||
                                        batch.ESTADO_BATCH === "COMPLETADO" ||
                                        meta.bLotes.some((bl) => {
                                          const lObj = lotes.find((l) => compareLoteCodes(l.LOTE_ID, bl.LOTE_ID));
                                          return (
                                            String(bl.ESTADO || "").toUpperCase().trim() === "CERRADO" ||
                                            String(lObj?.ESTADO_LOTE || lObj?.ESTADO || "").toUpperCase().trim() === "CERRADO"
                                          );
                                        })) && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenFichaBatchCerrado(batch)}
                                            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
                                            title="Ver Ficha Final de Batch Cerrado (Humedades, Rendimientos, Organolépticos, Tiempos de Proceso y Envase Proyectado)"
                                          >
                                            <FileCheck className="w-3.5 h-3.5 text-slate-950" />
                                            <span>Ficha Final de Batch Cerrado</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => onNavigate("control-vaporizado", batch.BATCH_ID)}
                                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                                            title="Ver Ficha Oficial de Control de Vaporizado"
                                          >
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                                          </button>
                                        </>
                                      )}
                                    </>
                                  );
                                })()}

                                {/* Calidad Analysis CTA */}
                                <button
                                  type="button"
                                  onClick={() => onNavigate("analisis-vaporizado", batch.BATCH_ID)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                  title="Ir a Análisis de Calidad y Cocción del Batch"
                                >
                                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                                </button>

                                {/* Benchmarking CTA */}
                                <button
                                  type="button"
                                  onClick={() => onNavigate("comparador", batch.BATCH_ID)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-purple-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                  title="Ver Batch en Benchmarking Comparativo"
                                >
                                  <Award className="w-3.5 h-3.5 text-purple-400" />
                                </button>

                                {/* Trazabilidad CTA */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenTrazabilidad("batch", batch.BATCH_ID)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                  title="Ver Trazabilidad Completa"
                                >
                                  <GitCommit className="w-3.5 h-3.5 text-amber-400" />
                                </button>

                                {/* Editar Batch */}
                                <button
                                  type="button"
                                  onClick={() => handleEditBatch(batch)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                  title="Editar Batch"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                </button>

                                {/* Eliminar Batch */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBatch(batch)}
                                  className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition-colors border border-slate-700 cursor-pointer"
                                  title="Eliminar Batch y liberar lotes"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                </button>

                              </div>
                            </td>
                          </tr>

                          {/* ========================================================= */}
                          {/* EXPANDED INLINE DETAILS: PROCESS + OUTPUT + COOKING TABS  */}
                          {/* ========================================================= */}
                          {isExpanded && (
                            <tr className="bg-slate-950/90 border-b border-slate-800">
                              <td colSpan={14} className="p-4">
                                <div className="space-y-4 bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-xl">
                                  
                                  {/* Sub-header with Navigation Segmented Tabs */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-amber-400 text-xs px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                        BATCH {corr}
                                      </span>
                                      <span className="text-white font-bold text-xs">
                                        Resumen de Proceso, Sacas de Descarga, Calidad y Cocción
                                      </span>
                                    </div>

                                    {/* Segmented Control for tabs */}
                                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto text-[11px] font-semibold">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTabPerBatch(prev => ({ ...prev, [batch.BATCH_ID]: "resumen" }))}
                                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                          currentTab === "resumen"
                                            ? "bg-amber-500 text-slate-950 font-bold shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Resumen 360°</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setExpandedTabPerBatch(prev => ({ ...prev, [batch.BATCH_ID]: "sacas" }))}
                                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                          currentTab === "sacas"
                                            ? "bg-purple-600 text-white font-bold shadow"
                                            : "text-purple-300 hover:text-white"
                                        }`}
                                      >
                                        <Scale className="w-3.5 h-3.5" />
                                        <span>Sacas de Descarga ({meta.totalSacasDescarga})</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setExpandedTabPerBatch(prev => ({ ...prev, [batch.BATCH_ID]: "proceso" }))}
                                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                          currentTab === "proceso"
                                            ? "bg-amber-500 text-slate-950 font-bold shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        <Flame className="w-3.5 h-3.5" />
                                        <span>1. Proceso Térmico</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setExpandedTabPerBatch(prev => ({ ...prev, [batch.BATCH_ID]: "salida" }))}
                                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                          currentTab === "salida"
                                            ? "bg-amber-500 text-slate-950 font-bold shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        <Layers className="w-3.5 h-3.5" />
                                        <span>2. Parámetros Salida</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setExpandedTabPerBatch(prev => ({ ...prev, [batch.BATCH_ID]: "coccion" }))}
                                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                          currentTab === "coccion"
                                            ? "bg-amber-500 text-slate-950 font-bold shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        <Award className="w-3.5 h-3.5" />
                                        <span>3. Resultados Cocción</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setExpandedTabPerBatch(prev => ({ ...prev, [batch.BATCH_ID]: "lotes" }))}
                                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                          currentTab === "lotes"
                                            ? "bg-amber-500 text-slate-950 font-bold shadow"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        <Package className="w-3.5 h-3.5" />
                                        <span>4. Lotes ({meta.bLotes.length})</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* TAB SACAS DE DESCARGA INLINE */}
                                  {currentTab === "sacas" && (
                                    <SacasDescargaManager
                                      batchId={batch.BATCH_ID}
                                      correlativo={corr}
                                      cliente={meta.clienteDisplay}
                                      variedad={meta.variedadDisplay}
                                      batch={batch}
                                      batchLotes={batchLotes}
                                      lotes={lotes}
                                      analisisHumList={analisisHumedos}
                                      presecados={presecados}
                                      controles={controles}
                                      currentUserNombre={currentUser?.nombre || "Operador Balanza"}
                                      variant="dark"
                                      onChangeRegistro={() => {
                                        setSacasRefreshTick((t) => t + 1);
                                        if (onRefreshData) onRefreshData();
                                      }}
                                    />
                                  )}

                                  {/* TAB 1: RESUMEN 360° INTEGRAL */}
                                  {currentTab === "resumen" && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        
                                        {/* Box 1: Proceso */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs font-mono">
                                          <div className="flex items-center justify-between text-amber-400 font-bold font-sans">
                                            <span className="flex items-center gap-1.5">
                                              <Flame className="w-3.5 h-3.5" /> Proceso Vaporizado
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {reportData.proceso.modalidadPases === "2_PASES" ? "2 Pases" : "1 Pase"}
                                            </span>
                                          </div>
                                          <div className="space-y-1 text-slate-300">
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Presión / Temp:</span>
                                              <strong className="text-white">{reportData.proceso.presionVapor} bar / {reportData.proceso.tempVapor}°C</strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Tiempo Vapor / Rep:</span>
                                              <strong className="text-white">{reportData.proceso.tiempoVaporMin} min / {reportData.proceso.tiempoReposoMin} min</strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Secado Final:</span>
                                              <strong className="text-emerald-400">{reportData.proceso.secadoMetodo}</strong>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Box 2: Salida */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs font-mono">
                                          <div className="flex items-center justify-between text-cyan-400 font-bold font-sans">
                                            <span className="flex items-center gap-1.5">
                                              <Layers className="w-3.5 h-3.5" /> Calidad de Salida
                                            </span>
                                            <span className="text-[10px] text-emerald-400 font-bold">
                                              CONFORME
                                            </span>
                                          </div>
                                          <div className="space-y-1 text-slate-300">
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Humedad Salida:</span>
                                              <strong className="text-cyan-300">{reportData.salida.humSalida}% (Δ {reportData.salida.deltaHumedad}%)</strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Quebrado / Δ QB:</span>
                                              <strong className="text-amber-300">{reportData.salida.quebradoSalida}% (+{reportData.salida.deltaQuebrado}%)</strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Blancura / Gelat.:</span>
                                              <strong className="text-white">{reportData.salida.blancuraSalida}° / {reportData.salida.gelatinizacionPct}%</strong>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Box 3: Cocción */}
                                        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs font-mono">
                                          <div className="flex items-center justify-between text-amber-400 font-bold font-sans">
                                            <span className="flex items-center gap-1.5">
                                              <Award className="w-3.5 h-3.5" /> Prueba de Cocción
                                            </span>
                                            <span className="text-[10px] text-amber-400 font-bold">
                                              ★ {reportData.coccion.coccionScore} pts
                                            </span>
                                          </div>
                                          <div className="space-y-1 text-slate-300">
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Tiempo de Cocción:</span>
                                              <strong className="text-white">{reportData.coccion.tiempoCoccionMin}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Separación Grano:</span>
                                              <strong className="text-emerald-400">{reportData.coccion.separacionGrano}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Expansión Olla:</span>
                                              <strong className="text-amber-300">{reportData.coccion.expansionVolumetrica}</strong>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Box 4: Sacas de Descarga & Balance de Peso */}
                                        <div className={`p-3.5 rounded-xl bg-slate-950/70 border space-y-2 text-xs font-mono ${
                                          meta.alarmaPesoActiva
                                            ? "border-rose-500 shadow-lg shadow-rose-950/40"
                                            : meta.alarmaPesoAceptada
                                            ? "border-amber-500/60"
                                            : "border-purple-500/30"
                                        }`}>
                                          <div className="flex items-center justify-between text-purple-300 font-bold font-sans">
                                            <span className="flex items-center gap-1.5">
                                              <Scale className="w-3.5 h-3.5 text-purple-400" /> Sacas de Descarga
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setSelectedBatchForSacasModal(batch)}
                                              className="text-[10px] text-purple-300 hover:text-white underline cursor-pointer"
                                            >
                                              {meta.totalSacasDescarga} Sacas (Editar)
                                            </button>
                                          </div>
                                          <div className="space-y-1 text-slate-300">
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Peso Proyectado:</span>
                                              <strong className="text-amber-300">{meta.pesoProyectadoKg.toLocaleString("es-PE")} kg</strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Peso Real Descarga:</span>
                                              <strong className={meta.pesoRealDescargaKg > 0 ? (meta.dentroToleranciaDescarga ? "text-emerald-400" : meta.alarmaPesoAceptada ? "text-amber-300" : "text-rose-400") : "text-slate-500"}>
                                                {meta.pesoRealDescargaKg > 0 ? `${meta.pesoRealDescargaKg.toLocaleString("es-PE")} kg` : "Sin registrar"}
                                              </strong>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Dif. (±{meta.toleranciaDescargaKg.toLocaleString("es-PE")} kg / 2%):</span>
                                              <strong className={meta.pesoRealDescargaKg > 0 ? (meta.dentroToleranciaDescarga ? "text-emerald-400" : meta.alarmaPesoAceptada ? "text-amber-300" : "text-rose-400") : "text-slate-500"}>
                                                {meta.pesoRealDescargaKg > 0
                                                  ? `${meta.diferenciaDescargaKg > 0 ? "+" : ""}${meta.diferenciaDescargaKg.toLocaleString("es-PE")} kg (${meta.dentroToleranciaDescarga ? "OK" : meta.alarmaPesoAceptada ? "ACEPTADO" : "ALARMA"})`
                                                  : "Pendiente"}
                                              </strong>
                                            </div>
                                            {meta.alarmaPesoActiva && (
                                              <div className="pt-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenSustentoAlarmaModal(batch, meta.sustentoAlarmaPeso)}
                                                  className="w-full py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-sans font-black text-[10px] flex items-center justify-center gap-1 cursor-pointer animate-pulse"
                                                >
                                                  <BellRing className="w-3 h-3" />
                                                  <span>Sustentar Observación y Retirar Alarma</span>
                                                </button>
                                              </div>
                                            )}
                                            {meta.alarmaPesoAceptada && meta.sustentoAlarmaPeso && (
                                              <div className="pt-1 text-[10px] font-sans text-amber-200 bg-amber-950/40 border border-amber-500/30 rounded p-1.5">
                                                <span className="font-bold text-emerald-400 block">✓ Alarma Retirada:</span>
                                                "{meta.sustentoAlarmaPeso}"
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                      </div>

                                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                                        <div className="text-slate-300 italic truncate">
                                          "{reportData.coccion.observaciones}"
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {(getComputedBatchStatus(batch) === "CERRADO" ||
                                            getComputedBatchStatus(batch) === "COMPLETADO" ||
                                            batch.ESTADO_BATCH === "CERRADO" ||
                                            batch.ESTADO_BATCH === "COMPLETADO") && (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenFichaBatchCerrado(batch)}
                                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow"
                                            >
                                              <FileCheck className="w-3.5 h-3.5" />
                                              <span>Ver Ficha Final de Batch Cerrado</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => setSelectedBatchForReport(batch)}
                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                                          >
                                            Abrir Ficha 360°
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* TAB 2: PROCESO TÉRMICO */}
                                  {currentTab === "proceso" && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                        <span className="text-slate-500 block text-[10px]">PRESIÓN VAPOR:</span>
                                        <strong className="text-white text-sm">{reportData.proceso.presionVapor} bar</strong>
                                        <span className="text-[10px] text-slate-400 block">Máx: {reportData.proceso.presionMax} bar</span>
                                      </div>
                                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                        <span className="text-slate-500 block text-[10px]">TEMPERATURA & RPM:</span>
                                        <strong className="text-amber-300 text-sm">{reportData.proceso.tempVapor}°C</strong>
                                        <span className="text-[10px] text-slate-400 block">{reportData.proceso.rpm} RPM</span>
                                      </div>
                                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                        <span className="text-slate-500 block text-[10px]">TIEMPOS CICLO:</span>
                                        <strong className="text-cyan-300 text-sm">{reportData.proceso.tiempoVaporMin} min</strong>
                                        <span className="text-[10px] text-slate-400 block">Reposo: {reportData.proceso.tiempoReposoMin} min</span>
                                      </div>
                                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                        <span className="text-slate-500 block text-[10px]">SISTEMA SECADO:</span>
                                        <strong className="text-emerald-400 text-sm">{reportData.proceso.secadoMetodo}</strong>
                                        <span className="text-[10px] text-slate-400 block">{reportData.proceso.secadoTemp}°C • {reportData.proceso.secadoTiempoMin} min</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* TAB 3: PARÁMETROS DE SALIDA */}
                                  {currentTab === "salida" && (
                                    <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 p-3">
                                      <table className="w-full text-left text-xs font-mono">
                                        <thead className="text-slate-400 font-bold border-b border-slate-800 text-[10px] uppercase">
                                          <tr>
                                            <th className="px-2 py-1.5">Parámetro</th>
                                            <th className="px-2 py-1.5 text-right">Ingreso</th>
                                            <th className="px-2 py-1.5 text-right">Salida</th>
                                            <th className="px-2 py-1.5 text-right">Variación</th>
                                            <th className="px-2 py-1.5 text-center">Tolerancia</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                          <tr>
                                            <td className="px-2 py-1.5 text-slate-200">Humedad (%)</td>
                                            <td className="px-2 py-1.5 text-right text-slate-400">{reportData.salida.humIngreso}%</td>
                                            <td className="px-2 py-1.5 text-right text-cyan-300 font-bold">{reportData.salida.humSalida}%</td>
                                            <td className="px-2 py-1.5 text-right text-slate-300">{reportData.salida.deltaHumedad}%</td>
                                            <td className="px-2 py-1.5 text-center text-emerald-400 font-bold">≤ 13.0% (OK)</td>
                                          </tr>
                                          <tr>
                                            <td className="px-2 py-1.5 text-slate-200">Quebrado (%)</td>
                                            <td className="px-2 py-1.5 text-right text-slate-400">{reportData.salida.qiIngreso}%</td>
                                            <td className="px-2 py-1.5 text-right text-amber-300 font-bold">{reportData.salida.quebradoSalida}%</td>
                                            <td className="px-2 py-1.5 text-right text-emerald-400">+{reportData.salida.deltaQuebrado}%</td>
                                            <td className="px-2 py-1.5 text-center text-emerald-400 font-bold">Δ ≤ 3.5% (OK)</td>
                                          </tr>
                                          <tr>
                                            <td className="px-2 py-1.5 text-slate-200">Blancura Kett</td>
                                            <td className="px-2 py-1.5 text-right text-slate-400">~30.0°</td>
                                            <td className="px-2 py-1.5 text-right text-emerald-400 font-bold">{reportData.salida.blancuraSalida}°</td>
                                            <td className="px-2 py-1.5 text-right text-emerald-400">+9.5°</td>
                                            <td className="px-2 py-1.5 text-center text-emerald-400 font-bold">≥ 38.0° (OK)</td>
                                          </tr>
                                          <tr>
                                            <td className="px-2 py-1.5 text-slate-200">Gelatinización</td>
                                            <td className="px-2 py-1.5 text-right text-slate-400">0%</td>
                                            <td className="px-2 py-1.5 text-right text-amber-300 font-bold">{reportData.salida.gelatinizacionPct}%</td>
                                            <td className="px-2 py-1.5 text-right text-amber-300">+{reportData.salida.gelatinizacionPct}%</td>
                                            <td className="px-2 py-1.5 text-center text-emerald-400 font-bold">≥ 95% (OK)</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  )}

                                  {/* TAB 4: RESULTADOS DE COCCIÓN */}
                                  {currentTab === "coccion" && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                          <span className="text-slate-500 block text-[10px]">TIEMPO & ABSORCIÓN:</span>
                                          <strong className="text-white text-sm block">{reportData.coccion.tiempoCoccionMin}</strong>
                                          <span className="text-[10px] text-cyan-300 block">{reportData.coccion.ratioAbsorcionAgua}</span>
                                        </div>
                                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                          <span className="text-slate-500 block text-[10px]">TEXTURA & SOLTURA:</span>
                                          <strong className="text-emerald-400 text-sm block">{reportData.coccion.separacionGrano}</strong>
                                          <span className="text-[10px] text-slate-300 block">{reportData.coccion.texturaFirmeza}</span>
                                        </div>
                                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                          <span className="text-slate-500 block text-[10px]">CALIFICACIÓN GLOBAL:</span>
                                          <strong className="text-amber-400 text-sm block">★ {reportData.coccion.coccionScore} / 100 pts</strong>
                                          <span className="text-[10px] text-emerald-400 font-bold block">{reportData.coccion.clasificacionCoccion}</span>
                                        </div>
                                      </div>

                                      {/* Resumen de Parámetros Ficha Oficial */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                                        <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                                          <span className="text-[10px] text-slate-500 block">Desplazamiento:</span>
                                          <strong className="text-amber-300">{reportData.coccion.desplazamientoSeg ?? "15 seg"}</strong>
                                        </div>
                                        <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                                          <span className="text-[10px] text-slate-500 block">% Quebrado en Olla:</span>
                                          <strong className="text-amber-400">{reportData.coccion.granoQuebradoOllaPct ?? 18.0}%</strong>
                                        </div>
                                        <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                                          <span className="text-[10px] text-slate-500 block">% Grano Hinchado:</span>
                                          <strong className="text-emerald-400">{reportData.coccion.granoHinchadoPct ?? 8.6}%</strong>
                                        </div>
                                        <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                                          <span className="text-[10px] text-slate-500 block">% Grano Abierto:</span>
                                          <strong className="text-cyan-300">{reportData.coccion.granoAbiertoPct ?? 1.3}%</strong>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* TAB 5: LOTES BREAKDOWN TABLE */}
                                  {currentTab === "lotes" && (
                                    <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 p-3">
                                      <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="text-slate-400 font-bold border-b border-slate-800 text-[10px] uppercase">
                                          <tr>
                                            <th className="px-3 py-2">Lote ID</th>
                                            <th className="px-3 py-2">Corte / Parte</th>
                                            <th className="px-3 py-2">Cliente</th>
                                            <th className="px-3 py-2">Variedad</th>
                                            <th className="px-3 py-2 text-right">Sacos</th>
                                            <th className="px-3 py-2 text-right">Peso (kg)</th>
                                            <th className="px-3 py-2 text-right">% Aporte</th>
                                            <th className="px-3 py-2 text-right">Humedad %</th>
                                            <th className="px-3 py-2 text-center">Trazabilidad</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                          {meta.bLotes.map((bl, idx) => {
                                            const loteObj = lotes.find(l => l.LOTE_ID === bl.LOTE_ID);
                                            const humVal = loteObj?.HUM !== undefined ? loteObj.HUM : "--";
                                            const pctAporte = meta.pesoEfectivoKg > 0 ? ((Number(bl.PESO_KG) || 0) / meta.pesoEfectivoKg) * 100 : 0;

                                            return (
                                              <tr key={bl.BATCH_LOTE_ID || idx} className="hover:bg-slate-800/30">
                                                <td className="px-3 py-2 font-bold text-cyan-300">
                                                  {bl.LOTE_ID}
                                                </td>
                                                <td className="px-3 py-2 font-sans">
                                                  {bl.TOTAL_PARTES && bl.TOTAL_PARTES > 1 ? (
                                                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                                                      Parte {bl.PARTE} de {bl.TOTAL_PARTES}
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-500 text-[10px]">Lote Íntegro</span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 font-sans text-slate-200 font-medium">
                                                  {bl.CLIENTE || loteObj?.CLIENTE || "Sin cliente"}
                                                </td>
                                                <td className="px-3 py-2 font-sans text-amber-300">
                                                  {bl.VARIEDAD || loteObj?.VARIEDAD || "Sin variedad"}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-200">
                                                  {bl.SACOS}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-emerald-400">
                                                  {(Number(bl.PESO_KG) || 0).toLocaleString()} kg
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-400">
                                                  {pctAporte.toFixed(1)}%
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-300">
                                                  {humVal}%
                                                </td>
                                                <td className="px-3 py-2 text-center font-sans">
                                                  <div className="inline-flex items-center gap-1.5">
                                                    {(getComputedBatchStatus(batch) === "CERRADO" ||
                                                      getComputedBatchStatus(batch) === "COMPLETADO" ||
                                                      String(bl.ESTADO || "").toUpperCase().trim() === "CERRADO" ||
                                                      String(loteObj?.ESTADO_LOTE || loteObj?.ESTADO || "").toUpperCase().trim() === "CERRADO") && (
                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenFichaBatchCerrado(batch, bl.LOTE_ID)}
                                                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[10px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                        title="Ver Ficha Final de Batch Cerrado para este lote"
                                                      >
                                                        <FileCheck className="w-3 h-3" />
                                                        <span>Ficha Final Batch Cerrado</span>
                                                      </button>
                                                    )}
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenTrazabilidad("lote", bl.LOTE_ID)}
                                                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] inline-flex items-center gap-1 transition-colors"
                                                      title="Ver trazabilidad de este lote"
                                                    >
                                                      <GitCommit className="w-3 h-3" />
                                                      <span>Rastrear</span>
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
                              </td>
                            </tr>
                          )}

                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. CUADRÍCULA / TARJETAS DETALLADAS (OPCIONAL VIEW SWITCH)                 */
            /* ========================================================================= */
            <div className="grid grid-cols-1 gap-4">
              {filteredBatches.map((batch) => {
                const meta = getBatchMetadata(batch);
                const corr = batch.CORRELATIVO || batch.BATCH_ID;

                return (
                  <div
                    key={batch.BATCH_ID}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition-all space-y-4"
                  >
                    {/* Card Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-base sm:text-lg font-mono font-bold text-amber-400 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                          BATCH {corr}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>APIT</span>
                            <span className="text-[11px] font-normal text-slate-400 font-mono">({batch.BATCH_ID})</span>
                            {batch.ES_SUB_BATCH && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-orange-950 text-orange-300 border border-orange-700/50 inline-flex items-center gap-1">
                                <GitMerge className="w-2.5 h-2.5 text-orange-400" />
                                {batch.PROCESO_PADRE ? `Proceso ${batch.PROCESO_PADRE}` : "Sub-Batch"} ({batch.SUB_BATCH || corr})
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-blue-950/70 text-blue-300 border border-blue-800/60 text-[11px] font-bold">
                              {meta.clienteDisplay}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/60 text-[11px] font-bold">
                              {meta.variedadDisplay}
                            </span>
                            {meta.humedadPromedio !== undefined && (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 text-[11px] font-bold inline-flex items-center gap-1">
                                <Droplets className="w-3 h-3 text-cyan-400" />
                                {meta.humedadPromedio}%
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              {batch.FECHA_PROGRAMADA || batch.FECHA_INICIO || "Sin fecha"}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-semibold text-slate-300">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              {batch.TURNO || "Turno Día"}
                            </span>
                            <span>•</span>
                            <span>Op: {batch.OPERADOR || "Pedro Huamán"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const compEst = getComputedBatchStatus(batch);
                          return (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              compEst === "CERRADO" || compEst === "COMPLETADO"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : compEst === "EVALUADO"
                                ? "bg-teal-500/20 text-teal-300 border-teal-500/30"
                                : compEst === "ANALISIS_FINAL"
                                ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30"
                                : compEst === "VAPORIZADO"
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                : compEst === "EN SECADO"
                                ? "bg-orange-500/20 text-orange-300 border-orange-500/30 animate-pulse"
                                : compEst === "EN REPOSO"
                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse"
                                : compEst === "EN PROCESO"
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }`}>
                              {compEst}
                            </span>
                          );
                        })()}

                        <button
                          type="button"
                          onClick={() => handleEditBatch(batch)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                          title="Editar Batch"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBatch(batch)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                          title="Eliminar Batch y liberar lotes"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>

                        <button
                          onClick={() => handleOpenTrazabilidad("batch", batch.BATCH_ID)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                          title="Ver trazabilidad completa del Batch"
                        >
                          <GitCommit className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">Trazabilidad</span>
                        </button>
                      </div>
                    </div>

                    {/* Weight & Capacity Breakdown (incluye Sacas de Descarga, Peso Real y Proyectado) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-xs font-mono">
                      <div>
                        <span className="text-[11px] text-slate-500 block">PESO INGRESO:</span>
                        <strong className="text-white text-sm">
                          {meta.pesoEfectivoKg.toLocaleString()} kg
                        </strong>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block">TONELADAS:</span>
                        <strong className="text-amber-300 text-sm">
                          {meta.tonEfectivas.toFixed(2)} TN
                        </strong>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block">HUMEDAD PROM:</span>
                        <strong className={`text-sm flex items-center gap-1 font-bold ${
                          meta.humedadPromedio === undefined
                            ? "text-slate-400"
                            : meta.humedadPromedio < 14
                            ? "text-cyan-300"
                            : meta.humedadPromedio <= 18
                            ? "text-emerald-400"
                            : meta.humedadPromedio <= 22
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}>
                          <Droplets className="w-3.5 h-3.5" />
                          {meta.humedadPromedio !== undefined ? `${meta.humedadPromedio}%` : "N/D"}
                        </strong>
                      </div>

                      <div>
                        <span className="text-[11px] text-purple-300 font-bold block">SACAS DESCARGA:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedBatchForSacasModal(batch)}
                          className="text-sm font-black text-purple-300 hover:text-purple-200 underline flex items-center gap-1 cursor-pointer"
                        >
                          <Scale className="w-3.5 h-3.5 text-purple-400" />
                          {meta.totalSacasDescarga} Big Bags
                        </button>
                      </div>

                      <div>
                        <span className="text-[11px] text-emerald-300 font-bold block">PESO REAL:</span>
                        <strong className={`text-sm font-black block ${
                          meta.pesoRealDescargaKg > 0
                            ? meta.dentroToleranciaDescarga
                              ? "text-emerald-400"
                              : meta.alarmaPesoAceptada
                              ? "text-amber-300"
                              : "text-rose-400"
                            : "text-slate-500"
                        }`}>
                          {meta.pesoRealDescargaKg > 0 ? `${meta.pesoRealDescargaKg.toLocaleString("es-PE")} kg` : "Sin registrar"}
                        </strong>
                        {meta.pesoRealDescargaKg > 0 && (
                          <span className={`text-[9.5px] font-bold block ${
                            meta.dentroToleranciaDescarga
                              ? "text-emerald-400"
                              : meta.alarmaPesoAceptada
                              ? "text-amber-300"
                              : "text-rose-400"
                          }`}>
                            Δ {meta.diferenciaDescargaKg > 0 ? `+${meta.diferenciaDescargaKg}` : meta.diferenciaDescargaKg} kg{" "}
                            {meta.alarmaPesoActiva ? "(ALARMA)" : meta.alarmaPesoAceptada ? "(ACEPTADO)" : ""}
                          </span>
                        )}
                        {meta.alarmaPesoActiva && (
                          <button
                            type="button"
                            onClick={() => handleOpenSustentoAlarmaModal(batch, meta.sustentoAlarmaPeso)}
                            className="mt-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-sans font-black text-[9.5px] inline-flex items-center gap-1 cursor-pointer animate-pulse"
                          >
                            <BellRing className="w-2.5 h-2.5" />
                            <span>Sustentar / Retirar Alarma</span>
                          </button>
                        )}
                      </div>

                      <div>
                        <span className="text-[11px] text-amber-300 font-bold block">PROYECTADO:</span>
                        <strong className="text-amber-300 text-sm font-black block">
                          {meta.pesoProyectadoKg.toLocaleString("es-PE")} kg
                        </strong>
                        <span className="text-[9.5px] text-slate-400">±{meta.toleranciaDescargaKg.toLocaleString("es-PE")} kg (±2%)</span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block">USO SECADORA:</span>
                        <div className="flex items-center gap-2">
                          <strong className="text-emerald-400 text-sm">
                            {batch.CAPACIDAD_UTILIZADA_PCT || 100}%
                          </strong>
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${meta.isExcepcional ? "bg-amber-400" : "bg-emerald-400"}`}
                              style={{ width: `${Math.min(100, batch.CAPACIDAD_UTILIZADA_PCT || 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block">COMPATIBILIDAD:</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          {batch.ESTADO_COMPATIBILIDAD || "COMPATIBLE"}
                        </span>
                      </div>
                    </div>

                    {meta.isExcepcional && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          <strong>Capacidad Excepcional:</strong> Batch superior a 35 TN. El excedente debe bajarse y secarse en pampa.
                        </span>
                      </div>
                    )}

                    {/* Integrated Lotes List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span>Lotes asignados a este Batch ({meta.bLotes.length}):</span>
                        <span className="font-mono text-[11px]">
                          Total Sacos: {meta.totalSacos}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {meta.bLotes.map((bl, idx) => {
                          const lObj = lotes.find((l) => l.LOTE_ID === bl.LOTE_ID);

                          return (
                            <div 
                              key={bl.BATCH_LOTE_ID || idx}
                              className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => handleOpenTrazabilidad("lote", bl.LOTE_ID)}
                                  className="font-mono font-bold text-white hover:text-amber-400 transition-colors flex items-center gap-1"
                                >
                                  {bl.LOTE_ID}
                                  <ChevronRight className="w-3 h-3 text-slate-500" />
                                </button>
                                {bl.TOTAL_PARTES && bl.TOTAL_PARTES > 1 ? (
                                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold text-[10px]">
                                    Parte {bl.PARTE}/{bl.TOTAL_PARTES}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500">Lote Completo</span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-400 space-y-0.5">
                                <div className="truncate font-medium text-slate-300">
                                  {bl.CLIENTE || lObj?.CLIENTE || "Sin Cliente"}
                                </div>
                                <div className="text-amber-300/90 font-medium">
                                  {bl.VARIEDAD || lObj?.VARIEDAD || "Sin Variedad"}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                                <span className="text-slate-500">Cantidad:</span>
                                <strong className="text-emerald-400">
                                  {(bl.PESO_KG || 0).toLocaleString()} kg ({bl.SACOS} sacos)
                                </strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Operational Shortcuts & Process Flow Connection */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/80">
                      <span className="text-slate-500 italic text-[11px] max-w-xs truncate">
                        {batch.OBSERVACIONES || "Sin observaciones registradas"}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {batch.ESTADO_BATCH === "PROGRAMADO" && (
                          <button
                            onClick={async () => {
                              if (onUpdateBatchState) {
                                await onUpdateBatchState(batch.BATCH_ID, "EN_PROCESO");
                              }
                              onNavigate("control-vaporizado", batch.BATCH_ID);
                            }}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                            title="Comenzar ejecución industrial e ir al Control de Vaporizado"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Procesar Batch (Ir a Control)
                          </button>
                        )}

                        {batch.ESTADO_BATCH === "EN_PROCESO" && (
                          <>
                            <button
                              onClick={() => onNavigate("control-vaporizado", batch.BATCH_ID)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                              title="Continuar control en línea del proceso"
                            >
                              <Activity className="w-3.5 h-3.5 text-white animate-pulse" />
                              En Ejecución: Control de Proceso
                            </button>
                            <button
                              onClick={async () => {
                                if (onUpdateBatchState) {
                                  await onUpdateBatchState(batch.BATCH_ID, "COMPLETADO");
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-900/60 text-emerald-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-emerald-500/30"
                              title="Marcar batch como completado"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Finalizar
                            </button>
                          </>
                        )}

                        {batch.ESTADO_BATCH === "COMPLETADO" && (
                          <button
                            onClick={() => onNavigate("control-vaporizado", batch.BATCH_ID)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <Activity className="w-3.5 h-3.5 text-amber-400" />
                            Ver Registro Control
                          </button>
                        )}

                        {/* Resumen Completo & Cocción Trigger */}
                        <button
                          type="button"
                          onClick={() => setSelectedBatchForReport(batch)}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow shadow-amber-500/20 cursor-pointer"
                        >
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>Resumen & Cocción</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintOfficialBatchSheet(batch)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Imprimir / Descargar Ficha Oficial del Batch (PDF A4)"
                        >
                          <Printer className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Imprimir Ficha Oficial</span>
                        </button>

                        <button
                          onClick={() => onNavigate("analisis-vaporizado", batch.BATCH_ID)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                          Análisis Calidad
                        </button>

                        {(getComputedBatchStatus(batch) === "CERRADO" ||
                          getComputedBatchStatus(batch) === "COMPLETADO" ||
                          batch.ESTADO_BATCH === "CERRADO" ||
                          batch.ESTADO_BATCH === "COMPLETADO" ||
                          meta.bLotes.some((bl) => {
                            const lObj = lotes.find((l) => compareLoteCodes(l.LOTE_ID, bl.LOTE_ID));
                            return (
                              String(bl.ESTADO || "").toUpperCase().trim() === "CERRADO" ||
                              String(lObj?.ESTADO_LOTE || lObj?.ESTADO || "").toUpperCase().trim() === "CERRADO"
                            );
                          })) ? (
                          <button
                            type="button"
                            onClick={() => handleOpenFichaBatchCerrado(batch)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                            title="Ver Ficha Final de Batch Cerrado"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Ver Ficha Final de Batch Cerrado</span>
                          </button>
                        ) : (
                          (getComputedBatchStatus(batch) === "VAPORIZADO" ||
                            getComputedBatchStatus(batch) === "ANALISIS_FINAL" ||
                            getComputedBatchStatus(batch) === "EVALUADO") && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!canCerrarBatch) {
                                  setNotifMessage(`⚠️ ${obtenerMensajeRestriccion("cerrar_aprobar_batch")}`);
                                  setTimeout(() => setNotifMessage(null), 5000);
                                  return;
                                }
                                localDB.cerrarTotalBatch(batch.BATCH_ID);
                                if (onRefreshData) onRefreshData();
                                setNotifMessage(`🔒 Batch ${corr} cerrado completamente. Sus lotes han pasado al estado CERRADO.`);
                                setTimeout(() => setNotifMessage(null), 5000);
                                handleOpenFichaBatchCerrado(batch);
                              }}
                              className={`px-3 py-1.5 ${canCerrarBatch ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400 border border-slate-700"} font-black rounded-lg text-xs transition-all flex items-center gap-1.5 shadow cursor-pointer`}
                              title={canCerrarBatch ? "Cerrar Batch y Ver Ficha Final" : "Requiere permisos de Jefatura para cerrar batch"}
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Cerrar Batch y Ver Ficha Final</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* NUEVA SECCIÓN: RESUMEN DE RENDIMIENTO DEL PROCESO (GRÁFICAS DE BARRAS & FILTROS) */}
          <ResumenRendimientoProcesoSection
            batches={batches}
            batchLotes={batchLotes}
            lotes={lotes}
            controles={controles}
            analisisVapList={analisisVapList}
            presecados={presecados}
            analisisHumList={analisisHumedos}
            analisisSecList={analisisSecos}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {/* VIEW 2: EVALUACIÓN Y COMPARADOR DE PROCESOS (BENCHMARKING DE COCCIÓN & REPLICABILIDAD) */}
      {activeTabSubView === "comparador" && (
        <ComparadorEvaluacionProcesos
          batches={batches}
          batchLotes={batchLotes}
          lotes={lotes}
          controles={controles}
          analisisVapList={analisisVapList}
          presecados={presecados}
          analisisHumList={analisisHumedos}
          analisisSecList={analisisSecos}
          currentUser={currentUser}
          onNavigate={onNavigate}
          onProgramarConReceta={(receta, loteIds) => {
            if (loteIds && loteIds.length > 0) {
              onNavigate("priorizacion-programacion", loteIds[0]);
            } else {
              onNavigate("priorizacion-programacion");
            }
          }}
        />
      )}

      {/* VIEW 3: LOTES PENDIENTES Y CONTROL DE SALDOS */}
      {activeTabSubView === "saldos" && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                Control de Saldos de Lotes (Priorización Exclusiva de Lotes Pendientes)
              </h3>
              <p className="text-xs text-slate-400">
                Los lotes permanecen en esta lista hasta agotar el 100% de su saldo (Cantidad programable ≤ Saldo pendiente).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsModalUnirCodigosOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <GitMerge className="w-4 h-4 text-amber-400" /> Unir Códigos / Sub-Batches
              </button>

              <button
                onClick={() => setIsNuevoBatchModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Armar Batch
              </button>
            </div>
          </div>

          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Lote ID</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Variedad</th>
                    <th className="px-4 py-3">Humedad</th>
                    <th className="px-4 py-3">Defectos</th>
                    <th className="px-4 py-3">Quebrado</th>
                    <th className="px-4 py-3">Peso Original</th>
                    <th className="px-4 py-3">Procesado</th>
                    <th className="px-4 py-3">Saldo Pendiente</th>
                    <th className="px-4 py-3">Estado Saldo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {lotesConSaldo.map((lote) => {
                    const s = saldosMap.get(lote.LOTE_ID);
                    const isPartiallyProcessed = s?.estadoSaldo === "PARCIALMENTE PROCESADO";

                    return (
                      <tr key={lote.LOTE_ID} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-white">{lote.LOTE_ID}</td>
                        <td className="px-4 py-3 font-sans font-medium text-slate-300">{s?.cliente}</td>
                        <td className="px-4 py-3 font-sans text-amber-300">{s?.variedad}</td>
                        <td className="px-4 py-3">{lote.HUM}%</td>
                        <td className="px-4 py-3">{s?.defectosPct}%</td>
                        <td className="px-4 py-3">{s?.quebradoPct}%</td>
                        <td className="px-4 py-3 font-semibold text-slate-400">
                          {(s?.pesoOriginalKg || 0).toLocaleString()} kg
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {(s?.pesoProcesadoKg || 0).toLocaleString()} kg
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400 text-sm">
                          {(s?.saldoPendienteKg || 0).toLocaleString()} kg
                          <span className="text-[10px] text-slate-500 ml-1 font-normal font-sans">
                            ({s?.sacosPendientes} sacos)
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isPartiallyProcessed
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                          }`}>
                            {s?.estadoSaldo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenTrazabilidad("lote", lote.LOTE_ID)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="Ver Trazabilidad"
                            >
                              <GitCommit className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                            <button
                              onClick={() => handleOpenNewBatchWithLote(lote.LOTE_ID)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Armar Batch
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
        </div>
      )}

      {/* MODAL 1: PARÁMETROS DE TRABAJO */}
      <ParametrosTrabajoModal
        isOpen={isParametrosModalOpen}
        onClose={() => setIsParametrosModalOpen(false)}
        parametros={parametros}
        historial={historialParametros}
        onSaveParametros={async (newParams, motivo) => {
          if (onSaveParametros) {
            await onSaveParametros(newParams, motivo);
          }
        }}
        currentUser={currentUser}
      />

      {/* MODAL 2: NUEVO BATCH DE VAPORIZADO */}
      <NuevoBatchModal
        isOpen={isNuevoBatchModalOpen}
        onClose={() => {
          setIsNuevoBatchModalOpen(false);
          setInitialLoteForNewBatch(undefined);
          setBatchToEdit(null);
        }}
        lotes={lotes}
        analisisHumedos={analisisHumedos}
        presecados={presecados}
        batchesExistentes={batches}
        parametros={parametros}
        onSaveBatch={onSaveBatch}
        initialLoteId={initialLoteForNewBatch}
        batchToEdit={batchToEdit}
      />

      {/* MODAL 2.5: UNIÓN DE CÓDIGOS Y SUB-BATCHES */}
      <ModalUnirCodigos
        isOpen={isModalUnirCodigosOpen}
        onClose={() => setIsModalUnirCodigosOpen(false)}
        lotes={lotes}
        analisisHumedos={analisisHumedos}
        batchesExistentes={batches}
        batchLotes={batchLotes}
        parametros={parametros}
        onSaveBatch={onSaveBatch}
        onRefreshData={onRefreshData}
      />

      {/* MODAL 3: TRAZABILIDAD BIDIRECCIONAL */}
      <TrazabilidadModal
        isOpen={isTrazabilidadModalOpen}
        onClose={() => setIsTrazabilidadModalOpen(false)}
        targetType={trazabilidadTarget.type}
        targetId={trazabilidadTarget.id}
        lotes={lotes}
        batches={batches}
        batchLotes={batchLotes}
        parametros={parametros}
      />

      {/* MODAL 4: CONFIRMAR ELIMINACIÓN DE BATCH */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30">
                  <Trash2 className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">¿Confirmar Eliminación del Batch?</h3>
                  <p className="text-xs text-slate-400">Esta acción liberará los lotes asignados</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-400">Batch Correlativo:</span>
                <span className="font-black text-amber-300 text-sm">
                  {batchToDelete.CORRELATIVO || batchToDelete.BATCH_ID}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Fecha & Turno:</span>
                <span className="font-semibold text-slate-200">
                  {batchToDelete.FECHA_PROGRAMADA} ({batchToDelete.TURNO})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Equipo / Autoclave:</span>
                <span className="font-semibold text-cyan-300">{batchToDelete.EQUIPO || "Autoclave"}</span>
              </div>
              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-400">Peso Total:</span>
                <span className="font-bold text-emerald-400">
                  {(batchToDelete.PESO_TOTAL_KG || (batchToDelete.TON_PROGRAMADAS ? batchToDelete.TON_PROGRAMADAS * 1000 : 0)).toLocaleString()} kg
                </span>
              </div>
              {(() => {
                const assigned = batchLotes
                  .filter((bl) => bl.BATCH_ID === batchToDelete.BATCH_ID || bl.BATCH_ID === batchToDelete.CORRELATIVO)
                  .map((bl) => bl.LOTE_ID);
                return assigned.length > 0 ? (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400 block mb-1.5 font-bold text-amber-300">
                      Lotes que volverán a estar Disponibles / Pendientes ({assigned.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {assigned.map((lid, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-950/90 text-blue-200 border border-blue-700/60 text-[11px] font-mono font-bold">
                          {lid}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Alerta de controles dependientes asociados */}
            {associatedControlesForBatchToDelete.length > 0 && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-xs text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Controles Dependientes: {associatedControlesForBatchToDelete.length} registro(s) en Control de Vaporizado</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-snug">
                  Este batch tiene registros vinculados en la hoja de Control de Vaporizado. Activa la casilla para eliminarlos también en cascada.
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 pt-1">
                  <input
                    type="checkbox"
                    checked={deleteAssociatedControles}
                    onChange={(e) => setDeleteAssociatedControles(e.target.checked)}
                    className="rounded border-slate-700 text-rose-600 focus:ring-rose-500 bg-slate-900 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-[11px] text-white">
                    Eliminar también los {associatedControlesForBatchToDelete.length} control(es) asociados (en cascada)
                  </span>
                </label>
              </div>
            )}

            <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-[11px] text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>Al confirmar, el Batch será eliminado y sus lotes asociados saldrán del estado de proceso para volver a estar pendientes.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setBatchToDelete(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmarEliminarBatch}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? "Eliminando..." : "Sí, Eliminar Batch"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RESUMEN INTEGRAL DEL PROCESO, SALIDA Y COCCIÓN */}
      {selectedBatchForReport && (
        <BatchResumenProcesoModal
          isOpen={!!selectedBatchForReport}
          batch={selectedBatchForReport}
          onClose={() => setSelectedBatchForReport(null)}
          data={getBatchFullReport(selectedBatchForReport)}
          onNavigate={onNavigate}
        />
      )}

      {/* MODAL 6: INTEGRACIÓN Y ENLACE DE COCCIÓN EXTERNA */}
      <IntegracionCoccionModal
        isOpen={isCoccionModalOpen}
        onClose={() => setIsCoccionModalOpen(false)}
        currentUser={currentUser}
        onDatosActualizados={() => {
          if (onRefreshData) onRefreshData();
          setNotifMessage("✅ Resultados de cocción de Vaporizado sincronizados y actualizados.");
          setTimeout(() => setNotifMessage(null), 4000);
        }}
      />

      {/* MODAL 7: FORMATO DE REGISTRO DE VAPORIZADO (MODELO OFICIAL PLANTA & OLLA) */}
      <FormatoRegistroVaporizadoModal
        isOpen={isFormatoOficialOpen}
        onClose={() => setIsFormatoOficialOpen(false)}
        currentUser={currentUser}
        onGuardarExito={(formato) => {
          if (onRefreshData) onRefreshData();
          setNotifMessage(`✅ Formato oficial de Registro de Vaporizado (Batch ${formato.batchNumero || "V272"}) guardado.`);
          setTimeout(() => setNotifMessage(null), 4000);
        }}
      />

      {/* MODAL 8: REGISTRO DE SACAS DE DESCARGA (BIG BAGS) POR BALANZA & COMPARACIÓN CON PESO PROYECTADO */}
      {selectedBatchForSacasModal && (
        <SacasDescargaModal
          isOpen={!!selectedBatchForSacasModal}
          onClose={() => setSelectedBatchForSacasModal(null)}
          batchId={selectedBatchForSacasModal.BATCH_ID}
          correlativo={selectedBatchForSacasModal.CORRELATIVO || selectedBatchForSacasModal.BATCH_ID}
          cliente={getBatchMetadata(selectedBatchForSacasModal).clienteDisplay}
          variedad={getBatchMetadata(selectedBatchForSacasModal).variedadDisplay}
          batch={selectedBatchForSacasModal}
          batchLotes={batchLotes}
          lotes={lotes}
          analisisHumList={analisisHumedos}
          presecados={presecados}
          controles={controles}
          currentUserNombre={currentUser?.nombre || "Operador Balanza"}
          onChangeRegistro={() => {
            setSacasRefreshTick((t) => t + 1);
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* MODAL 9: SUSTENTAR OBSERVACIÓN Y ACEPTAR BATCH PARA RETIRAR ALARMA DE PESO PROYECTADO */}
      {batchForAlarmaSustentoModal && (() => {
        const metaModal = getBatchMetadata(batchForAlarmaSustentoModal);
        const corrModal = batchForAlarmaSustentoModal.CORRELATIVO || batchForAlarmaSustentoModal.BATCH_ID;
        const minPermitido = Number(
          Math.max(0, metaModal.pesoProyectadoKg - metaModal.toleranciaDescargaKg).toFixed(2)
        );
        const maxPermitido = Number(
          (metaModal.pesoProyectadoKg + metaModal.toleranciaDescargaKg).toFixed(2)
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-xl w-full shadow-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-600 text-white animate-bounce">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">
                      Alarma de Peso Proyectado — Batch {corrModal}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Sustente la observación de la desviación (±2%) y acéptela para retirar la alarma del batch.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBatchForAlarmaSustentoModal(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Resumen numérico de la desviación */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">PESO INGRESO:</span>
                  <strong className="text-white">{metaModal.pesoEfectivoKg.toLocaleString("es-PE")} kg</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PROYECTADO:</span>
                  <strong className="text-amber-300">{metaModal.pesoProyectadoKg.toLocaleString("es-PE")} kg</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PESO REAL:</span>
                  <strong className="text-rose-400">{metaModal.pesoRealDescargaKg.toLocaleString("es-PE")} kg</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">RANGO (±2%):</span>
                  <strong className="text-emerald-400">±{metaModal.toleranciaDescargaKg.toLocaleString("es-PE")} kg</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200">
                Rango permitido del Batch: <strong>{minPermitido.toLocaleString("es-PE")} kg – {maxPermitido.toLocaleString("es-PE")} kg</strong>. Diferencia registrada:{" "}
                <strong className="font-mono">
                  {metaModal.diferenciaDescargaKg > 0 ? `+${metaModal.diferenciaDescargaKg}` : metaModal.diferenciaDescargaKg} kg
                </strong>.
              </div>

              {/* Motivos rápidos sugeridos */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Motivos frecuentes (click para agregar):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Merma adicional por limpieza de impurezas / polvillo en pre-limpia",
                    "Mayor reducción de humedad final en secado respecto al 12% base",
                    "Retención operativa parcial en tolva pulmón / elevadores",
                    "Diferencia por humedad inicial en lotes húmedos de recepción"
                  ].map((motivo) => (
                    <button
                      key={motivo}
                      type="button"
                      onClick={() =>
                        setSustentoAlarmaModalText((prev) =>
                          prev.trim() ? `${prev.trim()}. ${motivo}` : motivo
                        )
                      }
                      className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[10.5px] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      + {motivo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-amber-300">
                  Sustento de la Observación del Batch:
                </label>
                <textarea
                  rows={3}
                  value={sustentoAlarmaModalText}
                  onChange={(e) => setSustentoAlarmaModalText(e.target.value)}
                  placeholder="Escriba el sustento técnico u operativo para aceptar el lote y retirar la alarma del batch..."
                  className="w-full rounded-xl border-2 border-slate-700 focus:border-amber-400 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const target = batchForAlarmaSustentoModal;
                    setBatchForAlarmaSustentoModal(null);
                    setSelectedBatchForSacasModal(target);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Ver / Editar Pesos de Sacas</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchForAlarmaSustentoModal(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!sustentoAlarmaModalText.trim()}
                    onClick={handleConfirmarSustentoAlarmaBatch}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sustentar y Aceptar (Retirar Alarma)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 10: FICHA FINAL DE BATCH CERRADO */}
      {selectedBatchForFichaCerrado && (
        <FichaFinalBatchCerradoModal
          isOpen={!!selectedBatchForFichaCerrado}
          onClose={() => {
            setSelectedBatchForFichaCerrado(null);
            setSelectedLoteIdForFichaCerrado(undefined);
          }}
          batch={selectedBatchForFichaCerrado}
          batchLotes={batchLotes}
          lotes={lotes}
          analisisHumedos={analisisHumedos}
          analisisSecos={analisisSecos}
          analisisVapList={analisisVapList}
          controles={controles}
          presecados={presecados}
          loteFocalId={selectedLoteIdForFichaCerrado}
        />
      )}

    </div>
  );
};
