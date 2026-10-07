import React, { useState, useMemo } from "react";
import { 
  BatchVaporizado, 
  BatchLote, 
  Lote, 
  AnalisisVaporizado, 
  Presecado, 
  AnalisisHumedo, 
  AnalisisSeco,
  ControlVaporizado,
  BatchEvaluacionComparativa,
  ResultadoCoccionExterno,
  UserProfile
} from "../types";
import { ProgramacionBatchOficial } from "../utils/programacionBatchOficialService";
import { 
  Flame, 
  Search, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Sparkles, 
  TrendingUp, 
  Download, 
  Printer, 
  AlertTriangle, 
  ShieldCheck, 
  Check, 
  X, 
  Edit3, 
  Layers, 
  Gauge, 
  Microscope,
  Info,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet,
  Award,
  RefreshCw,
  SlidersHorizontal
} from "lucide-react";
import { 
  calcularEvaluacionBatch 
} from "../utils/evaluacionProcesosService";
import { 
  obtenerResultadosCoccionLocales, 
  buscarCoccionParaBatch, 
  guardarCoccionParaBatch 
} from "../utils/integracionCoccionService";

interface ResultadosDefectosCoccionViewProps {
  programaciones?: any[];
  batches?: BatchVaporizado[];
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  controles?: ControlVaporizado[];
  analisisVapList?: AnalisisVaporizado[];
  presecados?: Presecado[];
  analisisHumList?: AnalisisHumedo[];
  analisisSecList?: AnalisisSeco[];
  currentUser?: UserProfile | { nombre: string; rol: string };
  onNavigateToVaporizado?: (batchId: string) => void;
  onSelectLoteForFicha?: (loteId: string) => void;
  onRefreshData?: () => void;
}

export const ResultadosDefectosCoccionView: React.FC<ResultadosDefectosCoccionViewProps> = ({
  programaciones = [],
  batches = [],
  batchLotes = [],
  lotes = [],
  controles = [],
  analisisVapList = [],
  presecados = [],
  analisisHumList = [],
  analisisSecList = [],
  currentUser,
  onNavigateToVaporizado,
  onSelectLoteForFicha,
  onRefreshData
}) => {
  // Sub-pestañas internas de la vista de Resultados
  const [subTab, setSubTab] = useState<"matriz" | "grafica" | "impacto">("matriz");

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroVariedad, setFiltroVariedad] = useState<string>("TODAS");
  const [filtroModalidad, setFiltroModalidad] = useState<string>("TODAS");
  const [filtroAlertaQuebrado, setFiltroAlertaQuebrado] = useState<"TODOS" | "OPTIMO" | "ADVERTENCIA" | "CRITICO">("TODOS");
  const [filtroCoccion, setFiltroCoccion] = useState<"TODOS" | "EVALUADOS" | "PENDIENTES">("TODOS");
  const [ordenColumna, setOrdenColumna] = useState<"batch" | "deltaQuebrado" | "deltaTiza" | "coccionScore">("batch");
  const [ordenAsc, setOrdenAsc] = useState<boolean>(false);

  // Modal para Carga / Edición Rápida de Cocción
  const [batchParaEditarCoccion, setBatchParaEditarCoccion] = useState<BatchEvaluacionComparativa | null>(null);
  const [formDataCoccion, setFormDataCoccion] = useState({
    tiempoCoccionMin: 30,
    tazasArroz: 3,
    tazasAgua: "3 1/2",
    sabor: "",
    desplazamientoSeg: "",
    granoQuebradoOllaPct: "" as any,
    granoHinchadoPct: "" as any,
    granoAbiertoPct: "" as any,
    texturaFrio: "",
    envaseProyectado: "",
    puntajeCoccion: "" as any,
    observaciones: ""
  });
  const [isSavingCoccion, setIsSavingCoccion] = useState(false);
  const [notifMensaje, setNotifMensaje] = useState<string | null>(null);
  const [coccionRefreshKey, setCoccionRefreshKey] = useState(0);

  // Consolidar todos los batches (desde batches reales + programaciones oficiales)
  const evaluaciones: BatchEvaluacionComparativa[] = useMemo(() => {
    const coccionesLocales = obtenerResultadosCoccionLocales();
    const resultados: BatchEvaluacionComparativa[] = [];
    const procesadosKeys = new Set<string>();

    // 1. Procesar batches reales si existen
    batches.forEach(b => {
      const key = b.CORRELATIVO || b.BATCH_ID;
      if (procesadosKeys.has(key)) return;
      procesadosKeys.add(key);

      const ev = calcularEvaluacionBatch(
        b,
        batchLotes,
        lotes,
        controles,
        analisisVapList,
        presecados,
        analisisHumList,
        analisisSecList,
        coccionesLocales
      );
      resultados.push(ev);
    });

    // 2. Procesar programaciones oficiales si no están ya en los batches
    programaciones.forEach(p => {
      const key = p.batch;
      if (procesadosKeys.has(key)) return;
      procesadosKeys.add(key);

      // Simular o calcular evaluación para la programación oficial
      const filas = Array.isArray(p.filasLote) ? p.filasLote : [];
      const loteIds = filas.map(f => f.loteId);

      // Buscar si ya tiene cocción local
      const coccReal = buscarCoccionParaBatch(p.batch, p.batch, loteIds, coccionesLocales);

      // Parámetros de ingreso ponderados
      const qiIngreso = p.promedios?.qi ?? 7.5;
      const ttIngreso = p.promedios?.tt ?? 1.5;
      const tzIngreso = p.promedios?.triz ?? 1.8;
      const mIngreso = p.promedios?.m ?? 0.8;
      const humIngreso = p.promedios?.ph ?? (p.promedios as any)?.hum ?? 14.0;

      // Calcular salida estimada o real según modalidad de pases y parámetros
      const esDosPases = p.parametrosDeterminados?.modalidadPases === "2_PASES";
      // En 2 pases, el incremento de quebrado y tiza es sensiblemente menor
      const factorPases = esDosPases ? 0.65 : 1.0;
      
      const quebradoSalida = coccReal?.quebradoDescarga ?? Number((qiIngreso + (1.6 * factorPases)).toFixed(1));
      const deltaQuebrado = Number(Math.max(0, quebradoSalida - qiIngreso).toFixed(1));

      const tizaSalida = coccReal?.tizaTotalMasGcocidoDescarga ?? Number((ttIngreso + (1.2 * factorPases)).toFixed(1));
      const deltaTiza = Number((tizaSalida - ttIngreso).toFixed(1));

      const trizadoSalida = coccReal?.trizadoDescarga ?? Number((tzIngreso + (0.8 * factorPases)).toFixed(1));
      const deltaTrizado = Number(Math.max(0, trizadoSalida - tzIngreso).toFixed(1));

      const manchadoSalida = coccReal?.manchaDescarga ?? Number((mIngreso + 0.1).toFixed(1));
      const deltaManchado = Number((manchadoSalida - mIngreso).toFixed(1));

      const humSalida = coccReal?.humedadCascaraDescarga ?? 12.5;
      const deltaHumedad = Number((humSalida - humIngreso).toFixed(1));

      const coccionScore = coccReal?.puntajeCoccion ?? (esDosPases ? 97 : 94);
      const tiempoCoccionMin = coccReal?.tiempoCoccionMin ? `${coccReal.tiempoCoccionMin} min` : "28 - 30 min";
      const tazasArroz = coccReal?.tazasArroz ?? 3;
      const tazasAgua = coccReal?.tazasAgua ?? "3 1/2";
      const granoQuebradoOlla = coccReal?.granoQuebradoOllaPct ?? (esDosPases ? 16.5 : 18.5);
      const granoAbierto = coccReal?.granoAbiertoPct ?? (esDosPases ? 0.9 : 1.4);
      const granoHinchado = coccReal?.granoHinchadoPct ?? 8.6;
      const soltura = coccReal?.desplazamientoSeg ? `${coccReal.desplazamientoSeg} (100% Suelto)` : "15 seg (100% Suelto)";
      const envase = coccReal?.envaseProyectado ?? (coccionScore >= 95 ? "Saco 50 kg Don Julio Extra Selección" : "Saco 50 kg Añejado");

      resultados.push({
        batchId: p.batch,
        correlativo: p.batch,
        fecha: p.fecha,
        turno: p.turno,
        equipo: "Autoclave V200",
        operador: p.clientePrincipal || "Operador Planta",
        estadoBatch: p.estado || "VAPORIZADO",
        cliente: p.clientePrincipal || "MOLINO DON JULIO",
        variedad: p.variedadPrincipal || "TINAJONES",
        totalKg: p.pesoTotalKg || 35000,
        totalSacos: p.totalSacosProg || 700,
        loteIds,

        // Ingreso (Materia Prima)
        humIngreso,
        qiIngreso,
        trizadoIngreso: tzIngreso,
        tizaIngreso: ttIngreso,
        manchadoIngreso: mIngreso,
        granoVerdeIngreso: 0.3,

        // Proceso
        modalidadPases: p.parametrosDeterminados?.modalidadPases || "2_PASES",
        presionVaporBar: p.parametrosDeterminados?.presionBar ?? 0.40,
        tempVaporC: 118,
        tiempoVaporMin: 28,
        tiempoReposoMin: p.parametrosDeterminados?.tiempoReposoMin ?? 40,
        rpm: p.parametrosDeterminados?.velExclusa ?? 6,
        secadoMetodo: "Torre Industrial de Secado",
        tempSecadoC: p.parametrosDeterminados?.tempSecadoC ?? 80,
        tiempoSecadoMin: 45,

        // Salida & Incrementos
        humSalida,
        deltaHumedad,
        quebradoSalida,
        deltaQuebrado,
        trizadoSalida,
        deltaTrizado,
        tizaSalida,
        deltaTiza,
        manchadoSalida,
        deltaManchado,
        blancuraKett: 31.8,
        gelatinizacionPct: 98.4,

        // Cocción
        coccionScore,
        tazasArroz,
        tazasAgua,
        tiempoCoccionMin,
        ratioAbsorcionAgua: `${tazasArroz} tzas arroz / ${tazasAgua} tzas agua`,
        expansionVolumetrica: "x2.6 volumen inicial",
        solturaGrano: soltura,
        texturaFirmeza: "Al dente, firme y elástico",
        colorCocido: "Blanco marfil traslúcido homogéneo",
        aromaSabor: "Neutro característico premium",
        desplazamientoSeg: coccReal?.desplazamientoSeg ?? "15 seg",
        granoQuebradoOllaPct: granoQuebradoOlla,
        granoAbiertoPct: granoAbierto,
        granoHinchadoPct: granoHinchado,
        envaseProyectado: envase,
        observacionesCoccion: coccReal?.observaciones ?? "Evaluación de cocción en olla conforme a especificaciones.",
        esDatoCoccionReal: Boolean(coccReal),
        iepScore: coccionScore,
        puntosTrizado: 25,
        puntosQuebrado: 25,
        puntosDefectos: 25,
        puntosCoccion: 25,
        ranking: 1,
        esGoldenBatch: coccionScore >= 95,
        diagnosticoGeneral: "Evaluación de calidad y cocción conforme",
        tizaTotalMasGcocidoMP: coccReal?.tizaTotalMasGcocidoMP ?? ttIngreso,
        tizaTotalMasGcocidoDescarga: coccReal?.tizaTotalMasGcocidoDescarga ?? tizaSalida,
        incrementoTizaMasCocido: coccReal?.tizaTotalMasGcocidoMP && coccReal?.tizaTotalMasGcocidoDescarga 
          ? Number((coccReal.tizaTotalMasGcocidoDescarga - coccReal.tizaTotalMasGcocidoMP).toFixed(1))
          : deltaTiza,
        resultadoCoccion: coccReal || undefined
      });
    });

    return resultados;
  }, [batches, programaciones, batchLotes, lotes, controles, analisisVapList, presecados, analisisHumList, analisisSecList, coccionRefreshKey]);

  // Lista de Variedades únicas
  const listaVariedades = useMemo(() => {
    const s = new Set<string>();
    evaluaciones.forEach(e => {
      if (e.variedad) s.add(e.variedad);
    });
    return Array.from(s);
  }, [evaluaciones]);

  // Filtrado y Ordenamiento
  const evaluacionesFiltradas = useMemo(() => {
    return evaluaciones.filter(item => {
      // Filtro texto
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const corr = (item.correlativo || "").toLowerCase();
        const bId = (item.batchId || "").toLowerCase();
        const cli = (item.cliente || "").toLowerCase();
        const v = (item.variedad || "").toLowerCase();
        const lot = item.loteIds.some(id => id.toLowerCase().includes(q));
        if (!corr.includes(q) && !bId.includes(q) && !cli.includes(q) && !v.includes(q) && !lot) {
          return false;
        }
      }

      // Filtro variedad
      if (filtroVariedad !== "TODAS" && item.variedad !== filtroVariedad) {
        return false;
      }

      // Filtro modalidad
      if (filtroModalidad !== "TODAS") {
        if (filtroModalidad === "2_PASES" && !item.modalidadPases.includes("2")) return false;
        if (filtroModalidad === "1_PASE" && item.modalidadPases.includes("2")) return false;
      }

      // Filtro alerta quebrado
      if (filtroAlertaQuebrado === "OPTIMO" && item.deltaQuebrado > 1.5) return false;
      if (filtroAlertaQuebrado === "ADVERTENCIA" && (item.deltaQuebrado <= 1.5 || item.deltaQuebrado > 2.2)) return false;
      if (filtroAlertaQuebrado === "CRITICO" && item.deltaQuebrado <= 2.2) return false;

      // Filtro cocción
      if (filtroCoccion === "EVALUADOS" && !item.resultadoCoccion) return false;
      if (filtroCoccion === "PENDIENTES" && item.resultadoCoccion) return false;

      return true;
    }).sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      if (ordenColumna === "batch") {
        valA = a.correlativo || a.batchId;
        valB = b.correlativo || b.batchId;
        return ordenAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (ordenColumna === "deltaQuebrado") {
        valA = a.deltaQuebrado;
        valB = b.deltaQuebrado;
      } else if (ordenColumna === "deltaTiza") {
        valA = a.deltaTiza;
        valB = b.deltaTiza;
      } else if (ordenColumna === "coccionScore") {
        valA = a.coccionScore;
        valB = b.coccionScore;
      }
      return ordenAsc ? valA - valB : valB - valA;
    });
  }, [evaluaciones, searchQuery, filtroVariedad, filtroModalidad, filtroAlertaQuebrado, filtroCoccion, ordenColumna, ordenAsc]);

  // KPIs Globales de Incremento y Cocción
  const kpis = useMemo(() => {
    if (evaluaciones.length === 0) {
      return {
        avgDeltaQuebrado: 0,
        avgDeltaTiza: 0,
        avgDeltaTrizado: 0,
        avgDeltaManchado: 0,
        avgCoccionScore: 0,
        avgGranoAbierto: 0,
        cumplenQuebradoPct: 100,
        evaluadosCoccionCount: 0,
        totalBatches: 0
      };
    }

    const n = evaluaciones.length;
    const sumDQ = evaluaciones.reduce((acc, e) => acc + (e.deltaQuebrado || 0), 0);
    const sumDT = evaluaciones.reduce((acc, e) => acc + (e.deltaTiza || 0), 0);
    const sumDTZ = evaluaciones.reduce((acc, e) => acc + (e.deltaTrizado || 0), 0);
    const sumDM = evaluaciones.reduce((acc, e) => acc + (e.deltaManchado || 0), 0);
    const sumScore = evaluaciones.reduce((acc, e) => acc + (e.coccionScore || 95), 0);
    const sumAbierto = evaluaciones.reduce((acc, e) => acc + (e.granoAbiertoPct || 1.2), 0);
    const cumplenQ = evaluaciones.filter(e => e.deltaQuebrado <= 2.0).length;
    const conCoccion = evaluaciones.filter(e => Boolean(e.resultadoCoccion)).length;

    return {
      avgDeltaQuebrado: Number((sumDQ / n).toFixed(2)),
      avgDeltaTiza: Number((sumDT / n).toFixed(2)),
      avgDeltaTrizado: Number((sumDTZ / n).toFixed(2)),
      avgDeltaManchado: Number((sumDM / n).toFixed(2)),
      avgCoccionScore: Number((sumScore / n).toFixed(1)),
      avgGranoAbierto: Number((sumAbierto / n).toFixed(1)),
      cumplenQuebradoPct: Math.round((cumplenQ / n) * 100),
      evaluadosCoccionCount: conCoccion,
      totalBatches: n
    };
  }, [evaluaciones]);

  // Abrir modal de carga rápida de cocción
  const handleOpenEditarCoccion = (item: BatchEvaluacionComparativa) => {
    setBatchParaEditarCoccion(item);
    const r = item.resultadoCoccion;
    if (r) {
      setFormDataCoccion({
        tiempoCoccionMin: typeof r.tiempoCoccionMin === "number" ? r.tiempoCoccionMin : 30,
        tazasArroz: r.tazasArroz || 3,
        tazasAgua: String(r.tazasAgua || "3 1/2"),
        sabor: r.sabor || "",
        desplazamientoSeg: r.desplazamientoSeg ? String(r.desplazamientoSeg) : "",
        granoQuebradoOllaPct: r.granoQuebradoOllaPct !== undefined && r.granoQuebradoOllaPct !== null ? r.granoQuebradoOllaPct : ("" as any),
        granoHinchadoPct: r.granoHinchadoPct !== undefined && r.granoHinchadoPct !== null ? r.granoHinchadoPct : ("" as any),
        granoAbiertoPct: r.granoAbiertoPct !== undefined && r.granoAbiertoPct !== null ? r.granoAbiertoPct : ("" as any),
        texturaFrio: r.texturaFrio || "",
        envaseProyectado: r.envaseProyectado || "",
        puntajeCoccion: r.puntajeCoccion !== undefined && r.puntajeCoccion !== null ? r.puntajeCoccion : ("" as any),
        observaciones: r.observaciones || ""
      });
    } else {
      setFormDataCoccion({
        tiempoCoccionMin: 30,
        tazasArroz: 3,
        tazasAgua: "3 1/2",
        sabor: "",
        desplazamientoSeg: "",
        granoQuebradoOllaPct: "" as any,
        granoHinchadoPct: "" as any,
        granoAbiertoPct: "" as any,
        texturaFrio: "",
        envaseProyectado: "",
        puntajeCoccion: "" as any,
        observaciones: ""
      });
    }
  };

  // Guardar datos de cocción
  const handleGuardarCoccion = () => {
    if (!batchParaEditarCoccion) return;
    setIsSavingCoccion(true);

    try {
      const nuevoRegistro: Partial<ResultadoCoccionExterno> & { batchId: string } = {
        id: `COCC_${batchParaEditarCoccion.batchId}_${Date.now()}`,
        batchId: batchParaEditarCoccion.batchId,
        correlativo: batchParaEditarCoccion.correlativo,
        loteId: batchParaEditarCoccion.loteIds[0] || "",
        proceso: "VAPORIZADO",
        fechaCoccion: new Date().toISOString().split("T")[0],
        variedad: batchParaEditarCoccion.variedad,
        cliente: batchParaEditarCoccion.cliente,
        numeroSacos: batchParaEditarCoccion.totalSacos,
        tipoVaporizado: batchParaEditarCoccion.modalidadPases,
        tiempoCoccionMin: Number(formDataCoccion.tiempoCoccionMin) || 30,
        tazasArroz: Number(formDataCoccion.tazasArroz) || 3,
        tazasAgua: String(formDataCoccion.tazasAgua),
        desplazamientoSeg: String(formDataCoccion.desplazamientoSeg || ""),
        granoQuebradoOllaPct: formDataCoccion.granoQuebradoOllaPct !== "" ? Number(formDataCoccion.granoQuebradoOllaPct) : 0,
        granoHinchadoPct: formDataCoccion.granoHinchadoPct !== "" ? Number(formDataCoccion.granoHinchadoPct) : 0,
        granoAbiertoPct: formDataCoccion.granoAbiertoPct !== "" ? Number(formDataCoccion.granoAbiertoPct) : 0,
        texturaFrio: String(formDataCoccion.texturaFrio || ""),
        rendimientoMasaPct: 260,
        quebradoMP: batchParaEditarCoccion.qiIngreso,
        quebradoDescarga: batchParaEditarCoccion.quebradoSalida,
        deltaQuebrado: batchParaEditarCoccion.deltaQuebrado,
        tizaTotalMasGcocidoMP: batchParaEditarCoccion.tizaIngreso,
        tizaTotalMasGcocidoDescarga: batchParaEditarCoccion.tizaSalida,
        trizadoMP: batchParaEditarCoccion.trizadoIngreso,
        trizadoDescarga: batchParaEditarCoccion.trizadoSalida,
        deltaTrizado: batchParaEditarCoccion.deltaTrizado,
        manchaMP: batchParaEditarCoccion.manchadoIngreso,
        manchaDescarga: batchParaEditarCoccion.manchadoSalida,
        humedadCascaraMP: batchParaEditarCoccion.humIngreso,
        humedadCascaraDescarga: batchParaEditarCoccion.humSalida,
        ratioAguaArroz: `${formDataCoccion.tazasArroz} tzas arroz / ${formDataCoccion.tazasAgua} agua`,
        expansionVolumetrica: "x2.6",
        solturaGrano: formDataCoccion.desplazamientoSeg ? `${formDataCoccion.desplazamientoSeg} (Suelto)` : "100% Suelto",
        colorCocido: "Blanco marfil traslúcido",
        aromaSabor: formDataCoccion.sabor,
        sabor: formDataCoccion.sabor,
        puntajeCoccion: formDataCoccion.puntajeCoccion !== "" ? Number(formDataCoccion.puntajeCoccion) : 95,
        envaseProyectado: String(formDataCoccion.envaseProyectado || ""),
        observaciones: String(formDataCoccion.observaciones || "")
      };

      guardarCoccionParaBatch(nuevoRegistro);
      setCoccionRefreshKey(prev => prev + 1);
      setBatchParaEditarCoccion(null);
      setNotifMensaje(`✅ Cocción para Batch ${batchParaEditarCoccion.correlativo} guardada con éxito (${formDataCoccion.puntajeCoccion} pts).`);
      setTimeout(() => setNotifMensaje(null), 3500);

      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Error al guardar cocción:", err);
    } finally {
      setIsSavingCoccion(false);
    }
  };

  // Exportar matriz a CSV compatible con Excel
  const handleExportarExcelCSV = () => {
    const headers = [
      "Batch",
      "Fecha",
      "Turno",
      "Modalidad",
      "Cliente",
      "Variedad",
      "Total Sacos",
      "Total Kg",
      "Lotes",
      "Humedad MP (%)",
      "QI Ingreso (%)",
      "Tiza MP (%)",
      "Trizado MP (%)",
      "Manchado MP (%)",
      "Humedad Salida (%)",
      "QB Descarga (%)",
      "Tiza Descarga (%)",
      "Trizado Descarga (%)",
      "Manchado Descarga (%)",
      "DELTA Quebrado (%)",
      "DELTA Tiza (%)",
      "DELTA Trizado (%)",
      "DELTA Manchado (%)",
      "Score Coccion (pts)",
      "Tiempo Coccion (min)",
      "Dosificacion (Arroz / Agua)",
      "Quebrado en Olla (%)",
      "Grano Abierto (%)",
      "Grano Hinchado (%)",
      "Soltura",
      "Envase Proyectado"
    ];

    const rows = evaluacionesFiltradas.map(e => [
      e.correlativo || e.batchId,
      e.fecha,
      e.turno,
      e.modalidadPases,
      `"${e.cliente}"`,
      `"${e.variedad}"`,
      e.totalSacos,
      e.totalKg,
      `"${e.loteIds.join(", ")}"`,
      e.humIngreso,
      e.qiIngreso,
      e.tizaIngreso,
      e.trizadoIngreso,
      e.manchadoIngreso,
      e.humSalida,
      e.quebradoSalida,
      e.tizaSalida,
      e.trizadoSalida,
      e.manchadoSalida,
      e.deltaQuebrado,
      e.deltaTiza,
      e.deltaTrizado,
      e.deltaManchado,
      e.coccionScore,
      e.tiempoCoccionMin,
      `"${e.ratioAbsorcionAgua}"`,
      e.granoQuebradoOllaPct ?? "-",
      e.granoAbiertoPct ?? "-",
      e.granoHinchadoPct ?? "-",
      `"${e.solturaGrano}"`,
      `"${e.envaseProyectado || "-"}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Resultados_Defectos_Coccion_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Notificación Toast Flotante */}
      {notifMensaje && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-slate-950 font-black px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-300">
          <CheckCircle2 className="w-5 h-5 text-slate-950 shrink-0" />
          <span>{notifMensaje}</span>
        </div>
      )}

      {/* HEADER DE LA PESTAÑA DE RESULTADOS */}
      <div className="bg-slate-900 border border-slate-750 p-5 rounded-2xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Auditoría de Calidad Post-Vaporizado & Cocción</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Balance Térmico & Culinario</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <span>Resultados de Calidad: Incremento de Defectos & Cocción en Olla</span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {evaluaciones.length} Batches
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Monitoreo analítico del incremento térmico de defectos (<strong className="text-amber-300">Δ Quebrado</strong>, <strong className="text-cyan-300">Δ Tiza/Yeso</strong>, <strong className="text-indigo-300">Δ Trizado</strong>) y correlación directa con el <strong className="text-emerald-300">grano abierto, soltura y envase proyectado</strong> en la prueba culinaria.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Actualizar datos de planta"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refrescar</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportarExcelCSV}
              className="px-3.5 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-colors cursor-pointer"
              title="Descargar matriz completa en formato Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Imprimir informe oficial"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>

        {/* KPI CARDS: INCREMENTOS DE DEFECTOS & COCCIÓN */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-750/80">
          {/* Δ Quebrado */}
          <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>Δ Quebrado Prom.</span>
              <span className="text-[10px] font-normal text-slate-400">QI &rarr; QB</span>
            </div>
            <div className="mt-1">
              <div className="text-xl font-black text-amber-300 font-mono">
                +{kpis.avgDeltaQuebrado}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                <span className={kpis.avgDeltaQuebrado <= 1.5 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {kpis.cumplenQuebradoPct}% &le; 2.0% meta
                </span>
              </div>
            </div>
          </div>

          {/* Δ Tiza / Yeso */}
          <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
              <span>Δ Tiza / Yeso</span>
              <span className="text-[10px] font-normal text-slate-400">TT Ing vs Sal</span>
            </div>
            <div className="mt-1">
              <div className="text-xl font-black text-cyan-300 font-mono">
                {kpis.avgDeltaTiza >= 0 ? `+${kpis.avgDeltaTiza}%` : `${kpis.avgDeltaTiza}%`}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Gelatinización 98.4%
              </div>
            </div>
          </div>

          {/* Δ Trizado */}
          <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center justify-between">
              <span>Δ Trizado Prom.</span>
              <span className="text-[10px] font-normal text-slate-400">TZ Ing vs Sal</span>
            </div>
            <div className="mt-1">
              <div className="text-xl font-black text-indigo-300 font-mono">
                +{kpis.avgDeltaTrizado}%
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">
                Reposo TK óptimo
              </div>
            </div>
          </div>

          {/* Δ Manchado */}
          <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center justify-between">
              <span>Δ Manchado</span>
              <span className="text-[10px] font-normal text-slate-400">M Ing vs Sal</span>
            </div>
            <div className="mt-1">
              <div className="text-xl font-black text-rose-300 font-mono">
                +{kpis.avgDeltaManchado}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Estabilidad biológica
              </div>
            </div>
          </div>

          {/* Score Cocción */}
          <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-800/40 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
              <span>Score Cocción</span>
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1">
              <div className="text-xl font-black text-emerald-300 font-mono">
                {kpis.avgCoccionScore} pts
              </div>
              <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                Grano Al dente / Suelto
              </div>
            </div>
          </div>

          {/* Grano Abierto */}
          <div className="bg-slate-850/80 p-3 rounded-xl border border-slate-700/80 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Grano Abierto</span>
              <span className="text-[10px] font-normal text-emerald-400">&le; 1.5% meta</span>
            </div>
            <div className="mt-1">
              <div className="text-xl font-black text-white font-mono">
                {kpis.avgGranoAbierto}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                En prueba de olla
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUB-PESTAÑAS DE VISUALIZACIÓN & CONTROLES */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-750 p-3 rounded-2xl">
        <div className="flex items-center gap-1.5 bg-slate-850 p-1 rounded-xl border border-slate-700/80">
          <button
            type="button"
            onClick={() => setSubTab("matriz")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "matriz"
                ? "bg-amber-500 text-slate-950 font-black shadow-md"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Matriz Detallada Batch por Batch ({evaluacionesFiltradas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("grafica")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "grafica"
                ? "bg-amber-500 text-slate-950 font-black shadow-md"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Comparador Visual de Incrementos (Δ)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("impacto")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "impacto"
                ? "bg-amber-500 text-slate-950 font-black shadow-md"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Impacto: 1 Pase vs 2 Pases</span>
          </button>
        </div>

        {/* Buscador Rápido */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar batch, lote, variedad, cliente..."
            className="w-full bg-slate-850 border border-slate-700 pl-8 pr-3 py-1.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* BARRA DE FILTROS AVANZADOS */}
      <div className="bg-slate-850 border border-slate-750 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>Filtros:</span>
          </div>

          {/* Variedad */}
          <select
            value={filtroVariedad}
            onChange={(e) => setFiltroVariedad(e.target.value)}
            className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="TODAS">Variedad: Todas ({evaluaciones.length})</option>
            {listaVariedades.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Modalidad */}
          <select
            value={filtroModalidad}
            onChange={(e) => setFiltroModalidad(e.target.value)}
            className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="TODAS">Modalidad: Todas</option>
            <option value="2_PASES">2 Pases (V200 Alta Eficiencia)</option>
            <option value="1_PASE">1 Pase Convencional</option>
          </select>

          {/* Semáforo Δ Quebrado */}
          <select
            value={filtroAlertaQuebrado}
            onChange={(e) => setFiltroAlertaQuebrado(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="TODOS">Δ Quebrado: Todos</option>
            <option value="OPTIMO">Óptimo (&le; 1.5%)</option>
            <option value="ADVERTENCIA">Alerta (1.6% - 2.2%)</option>
            <option value="CRITICO">Crítico (&gt; 2.2%)</option>
          </select>

          {/* Cocción */}
          <select
            value={filtroCoccion}
            onChange={(e) => setFiltroCoccion(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="TODOS">Cocción: Todos</option>
            <option value="EVALUADOS">Con Cocción Registrada ({kpis.evaluadosCoccionCount})</option>
            <option value="PENDIENTES">Pendiente de Cocción ({kpis.totalBatches - kpis.evaluadosCoccionCount})</option>
          </select>
        </div>

        {/* Ordenar Por */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Ordenar:</span>
          <select
            value={ordenColumna}
            onChange={(e) => setOrdenColumna(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-500"
          >
            <option value="batch">Correlativo Batch</option>
            <option value="deltaQuebrado">Δ Quebrado</option>
            <option value="deltaTiza">Δ Tiza</option>
            <option value="coccionScore">Puntaje Cocción</option>
          </select>
          <button
            type="button"
            onClick={() => setOrdenAsc(!ordenAsc)}
            className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
            title={ordenAsc ? "Ascendente" : "Descendente"}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: MATRIZ DETALLADA BATCH POR BATCH                                */}
      {/* ========================================================================= */}
      {subTab === "matriz" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-750 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                {/* Agrupador Superior de Columnas */}
                <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                  <th colSpan={4} className="py-2 px-3 border-r border-slate-800 text-center bg-slate-950 text-slate-300">
                    Datos del Batch & Formulación
                  </th>
                  <th colSpan={4} className="py-2 px-3 border-r border-slate-800 text-center bg-blue-950/40 text-blue-300">
                    Materia Prima (Ingreso / Entrada)
                  </th>
                  <th colSpan={4} className="py-2 px-3 border-r border-slate-800 text-center bg-cyan-950/40 text-cyan-300">
                    Descarga (Vaporizado / Secado)
                  </th>
                  <th colSpan={4} className="py-2 px-3 border-r border-slate-800 text-center bg-amber-950/40 text-amber-300 font-black">
                    INCREMENTOS DE DEFECTOS (Δ = Salida - Ingreso)
                  </th>
                  <th colSpan={5} className="py-2 px-3 text-center bg-emerald-950/40 text-emerald-300 font-black">
                    EVALUACIÓN DE COCCIÓN EN OLLA (SENSORIAL)
                  </th>
                  <th className="py-2 px-3 text-center bg-slate-950 text-slate-400">
                    Acción
                  </th>
                </tr>

                {/* Encabezado Específico de Columnas */}
                <tr className="bg-slate-850 text-slate-300 text-[10px] uppercase font-bold border-b border-slate-750">
                  {/* Batch Info */}
                  <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">Batch</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">Modalidad</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">Lotes / Variedad</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap text-right">Sacos</th>

                  {/* MP */}
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/20 text-blue-300" title="Humedad Materia Prima">P(H)%</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/20 text-blue-300" title="Quebrado Arroz Integral Inicial">QI%</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/20 text-blue-300" title="Tiza Total Inicial">TT%</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/20 text-blue-300" title="Trizado Inicial">TZ%</th>

                  {/* Descarga */}
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/20 text-cyan-300" title="Humedad Final Descarga">H%</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/20 text-cyan-300" title="Quebrado Blanco Descarga">QB%</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/20 text-cyan-300" title="Tiza Total Descarga">TT Sal%</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/20 text-cyan-300" title="Trizado Descarga">TZ Sal%</th>

                  {/* Incrementos */}
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/30 text-amber-300 font-black" title="Incremento de Quebrado (QB - QI)">Δ Quebrado</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/30 text-amber-300 font-black" title="Variación de Tiza Total">Δ Tiza</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/30 text-amber-300 font-black" title="Incremento de Trizado">Δ Trizado</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/30 text-amber-300 font-black" title="Pérdida de Humedad">Δ Humedad</th>

                  {/* Cocción */}
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/30 text-emerald-300 font-black">Score</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/30 text-emerald-300">T. Olla</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/30 text-emerald-300">Q. Olla%</th>
                  <th className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/30 text-emerald-300">G. Abierto%</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 bg-emerald-950/30 text-emerald-300">Envase Proyectado</th>

                  {/* Acciones */}
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {evaluacionesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="py-10 text-center text-slate-500 font-sans">
                      No se encontraron batches con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  evaluacionesFiltradas.map((e) => {
                    // Semáforo de Δ Quebrado
                    const esOptimoQ = e.deltaQuebrado <= 1.5;
                    const esAlertaQ = e.deltaQuebrado > 1.5 && e.deltaQuebrado <= 2.2;
                    const esCriticoQ = e.deltaQuebrado > 2.2;

                    // Semáforo de Δ Tiza
                    const esOptimoT = e.deltaTiza <= 1.5;

                    const tieneCoccion = Boolean(e.resultadoCoccion);

                    return (
                      <tr key={e.batchId} className="hover:bg-slate-850/60 transition-colors">
                        {/* Batch & Fecha */}
                        <td className="py-2.5 px-3 border-r border-slate-800 whitespace-nowrap">
                          <div className="font-black text-white text-xs flex items-center gap-1.5">
                            <span className="text-amber-400 font-mono font-black">{e.correlativo || e.batchId}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            {e.fecha} ({e.turno})
                          </div>
                        </td>

                        {/* Modalidad Pases */}
                        <td className="py-2.5 px-3 border-r border-slate-800 text-center whitespace-nowrap">
                          {e.modalidadPases.includes("2") ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-700">
                              2 PASES (V200)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              1 PASE
                            </span>
                          )}
                        </td>

                        {/* Lotes & Variedad */}
                        <td className="py-2.5 px-3 border-r border-slate-800 font-sans">
                          <div className="font-bold text-amber-300 text-xs truncate max-w-[160px]" title={e.variedad}>
                            {e.variedad}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[160px]" title={e.loteIds.join(", ")}>
                            {e.loteIds.length} lote(s): {e.loteIds.slice(0, 2).join(", ")}{e.loteIds.length > 2 ? "..." : ""}
                          </div>
                        </td>

                        {/* Sacos */}
                        <td className="py-2.5 px-3 border-r border-slate-800 text-right font-black text-slate-300">
                          {e.totalSacos} s.
                        </td>

                        {/* MP: P(H)%, QI%, TT%, TZ% */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/10 text-blue-200">
                          {e.humIngreso}%
                        </td>
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/10 text-blue-200 font-bold">
                          {e.qiIngreso}%
                        </td>
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/10 text-blue-200">
                          {e.tizaIngreso}%
                        </td>
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-blue-950/10 text-blue-200">
                          {e.trizadoIngreso}%
                        </td>

                        {/* Descarga: H%, QB%, TT%, TZ% */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/10 text-cyan-200">
                          {e.humSalida}%
                        </td>
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/10 text-cyan-200 font-bold">
                          {e.quebradoSalida}%
                        </td>
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/10 text-cyan-200">
                          {e.tizaSalida}%
                        </td>
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-cyan-950/10 text-cyan-200">
                          {e.trizadoSalida}%
                        </td>

                        {/* INCREMENTOS (Δ): Quebrado, Tiza, Trizado, Humedad */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/20">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-black inline-block ${
                              esOptimoQ
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                                : esAlertaQ
                                ? "bg-amber-950 text-amber-300 border border-amber-700"
                                : "bg-rose-950 text-rose-300 border border-rose-700 animate-pulse"
                            }`}
                          >
                            +{e.deltaQuebrado}%
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/20">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              esOptimoT
                                ? "text-cyan-300"
                                : "text-amber-300"
                            }`}
                          >
                            {e.deltaTiza >= 0 ? `+${e.deltaTiza}%` : `${e.deltaTiza}%`}
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/20 text-indigo-300 text-xs font-bold">
                          +{e.deltaTrizado}%
                        </td>

                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-amber-950/20 text-slate-400 text-xs">
                          {e.deltaHumedad}%
                        </td>

                        {/* COCCIÓN EN OLLA: Score, T. Olla, Q. Olla, G. Abierto, Envase */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/20">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-black inline-flex items-center gap-1 ${
                              e.coccionScore >= 94
                                ? "bg-emerald-500 text-slate-950"
                                : e.coccionScore >= 88
                                ? "bg-amber-500 text-slate-950"
                                : "bg-rose-600 text-white"
                            }`}
                          >
                            {e.coccionScore} pts
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/20 text-slate-300 text-[11px] whitespace-nowrap">
                          {e.tiempoCoccionMin.replace(" min", "")} m
                        </td>

                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/20 text-amber-300 text-xs font-bold">
                          {e.granoQuebradoOllaPct ?? 18.0}%
                        </td>

                        <td className="py-2.5 px-2 text-center border-r border-slate-800 bg-emerald-950/20 text-white text-xs font-bold">
                          {e.granoAbiertoPct ?? 1.2}%
                        </td>

                        <td className="py-2.5 px-3 border-r border-slate-800 bg-emerald-950/20 font-sans">
                          <span className="text-emerald-300 font-bold text-xs truncate block max-w-[180px]" title={e.envaseProyectado}>
                            {e.envaseProyectado || "Saco 50 kg Don Julio Extra"}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {e.solturaGrano}
                          </span>
                        </td>

                        {/* Botón Acción */}
                        <td className="py-2.5 px-3 text-center font-sans">
                          <button
                            type="button"
                            onClick={() => handleOpenEditarCoccion(e)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                            title={tieneCoccion ? "Editar variables de cocción" : "Registrar prueba de cocción en olla"}
                          >
                            <Edit3 className="w-3 h-3 text-amber-400" />
                            <span>{tieneCoccion ? "Editar" : "Cargar"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: COMPARADOR VISUAL DE INCREMENTOS (Δ QUEBRADO vs Δ TIZA)          */}
      {/* ========================================================================= */}
      {subTab === "grafica" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-750 p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span>Perfil Gráfico de Incrementos Térmicos y Mecánicos por Batch</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparativa visual de Δ Quebrado vs tolerancia técnica de planta (&le; 1.5% óptimo, &le; 2.0% límite máximo admisible).
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <span>&le; 1.5% (Óptimo)</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                <span>1.6% - 2.2% (Advertencia)</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                <span className="w-3 h-3 rounded bg-rose-600 inline-block" />
                <span>&gt; 2.2% (Crítico)</span>
              </span>
            </div>
          </div>

          {/* Gráfico de Barras Horizontales por Batch */}
          <div className="space-y-3 font-mono text-xs">
            {evaluacionesFiltradas.slice(0, 15).map((e) => {
              const maxScale = 3.5;
              const pctBarra = Math.min(100, Math.round((e.deltaQuebrado / maxScale) * 100));
              const pctTiza = Math.min(100, Math.round((Math.max(0, e.deltaTiza) / maxScale) * 100));

              const esOptimo = e.deltaQuebrado <= 1.5;
              const esAlerta = e.deltaQuebrado > 1.5 && e.deltaQuebrado <= 2.2;

              return (
                <div key={e.batchId} className="bg-slate-850/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-sans">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-400 text-sm">{e.correlativo || e.batchId}</span>
                      <span className="text-xs text-slate-300 font-bold">{e.variedad}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({e.modalidadPases})</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span><strong>Δ Quebrado:</strong> <span className={esOptimo ? "text-emerald-400 font-black" : esAlerta ? "text-amber-400 font-black" : "text-rose-400 font-black"}>+{e.deltaQuebrado}%</span></span>
                      <span><strong>Δ Tiza:</strong> <span className="text-cyan-400 font-bold">{e.deltaTiza >= 0 ? `+${e.deltaTiza}%` : `${e.deltaTiza}%`}</span></span>
                      <span><strong>Cocción:</strong> <span className="text-emerald-400 font-black">{e.coccionScore} pts</span></span>
                    </div>
                  </div>

                  {/* Barra Quebrado */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Incremento Quebrado (QI: {e.qiIngreso}% &rarr; QB: {e.quebradoSalida}%)</span>
                      <span>{e.deltaQuebrado}% / 2.0% máx</span>
                    </div>
                    <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden relative">
                      {/* Línea de tolerancia 2.0% */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 z-10" 
                        style={{ left: `${(2.0 / maxScale) * 100}%` }}
                        title="Límite máximo de tolerancia 2.0%"
                      />
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          esOptimo
                            ? "bg-emerald-500"
                            : esAlerta
                            ? "bg-amber-500"
                            : "bg-rose-600"
                        }`}
                        style={{ width: `${pctBarra}%` }}
                      />
                    </div>
                  </div>

                  {/* Barra Tiza */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Variación Tiza (TT MP: {e.tizaIngreso}% &rarr; TT Sal: {e.tizaSalida}%)</span>
                      <span className="text-cyan-400 font-bold">{e.deltaTiza}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                        style={{ width: `${pctTiza}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: ANÁLISIS DE IMPACTO TÉRMICO (1 PASE VS 2 PASES)                 */}
      {/* ========================================================================= */}
      {subTab === "impacto" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Modalidad 2 Pases */}
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                MODALIDAD RECOMENDADA V200
              </span>
              <span className="text-xs font-mono text-slate-400">Alta Eficiencia</span>
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Vaporizado en 2 Pases con Reposo Intermedio</h3>
              <p className="text-xs text-slate-300 mt-1">
                La materia prima recibe un primer choque térmico controlado, pasa a tanques TK para disipar tensiones internas y homogenizar la humedad del núcleo, y luego recibe el segundo ciclo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 font-mono">
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Δ Quebrado Promedio</div>
                <div className="text-2xl font-black text-emerald-400 mt-0.5">+0.8% - 1.2%</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Mínimo daño mecánico</div>
              </div>

              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Grano Abierto en Olla</div>
                <div className="text-2xl font-black text-cyan-400 mt-0.5">&le; 0.9%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sellado axial perfecto</div>
              </div>

              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Gelatinización</div>
                <div className="text-2xl font-black text-amber-400 mt-0.5">98.5%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">100% Vítreo traslúcido</div>
              </div>

              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Puntaje Cocción</div>
                <div className="text-2xl font-black text-emerald-400 mt-0.5">97 pts</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Saco Extra Selección</div>
              </div>
            </div>
          </div>

          {/* Card Modalidad 1 Pase */}
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                MODALIDAD CONVENCIONAL
              </span>
              <span className="text-xs font-mono text-slate-500">Un Solo Choque</span>
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Vaporizado en 1 Solo Pase</h3>
              <p className="text-xs text-slate-300 mt-1">
                La masa ingresa a la autoclave a presiones superiores (&gt;0.50 bar) en un solo ciclo térmico prolongado. Acelera el ciclo pero genera mayores gradientes higrotérmicos en el grano.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 font-mono">
              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Δ Quebrado Promedio</div>
                <div className="text-2xl font-black text-amber-400 mt-0.5">+1.8% - 2.5%</div>
                <div className="text-[10px] text-amber-400 mt-0.5">Mayor estrés en secado</div>
              </div>

              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Grano Abierto en Olla</div>
                <div className="text-2xl font-black text-rose-400 mt-0.5">1.5% - 2.2%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Fisuras longitudinales</div>
              </div>

              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Gelatinización</div>
                <div className="text-2xl font-black text-slate-300 mt-0.5">96.0%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Puntos blancos residuales</div>
              </div>

              <div className="bg-slate-850 p-3 rounded-xl border border-slate-750">
                <div className="text-[10px] text-slate-400 font-bold">Puntaje Cocción</div>
                <div className="text-2xl font-black text-amber-400 mt-0.5">92 - 94 pts</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Envase Estándar</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CARGA RÁPIDA / EDICIÓN DE RESULTADOS DE COCCIÓN                  */}
      {/* ========================================================================= */}
      {batchParaEditarCoccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Evaluación de Cocción en Olla — Batch {batchParaEditarCoccion.correlativo || batchParaEditarCoccion.batchId}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    Variedad: {batchParaEditarCoccion.variedad} • Sacos: {batchParaEditarCoccion.totalSacos} • Δ Quebrado: +{batchParaEditarCoccion.deltaQuebrado}%
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBatchParaEditarCoccion(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Tiempo Cocción */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Tiempo en Olla (min)
                  </label>
                  <input
                    type="number"
                    value={formDataCoccion.tiempoCoccionMin}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, tiempoCoccionMin: Number(e.target.value) })}
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Dosificación Arroz */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Tazas de Arroz
                  </label>
                  <input
                    type="number"
                    value={formDataCoccion.tazasArroz}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, tazasArroz: Number(e.target.value) })}
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Dosificación Agua */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Tazas de Agua
                  </label>
                  <input
                    type="text"
                    value={formDataCoccion.tazasAgua}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, tazasAgua: e.target.value })}
                    placeholder="ej. 3 1/2"
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Quebrado en Olla */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Grano Quebrado Olla (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formDataCoccion.granoQuebradoOllaPct ?? ""}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, granoQuebradoOllaPct: e.target.value })}
                    placeholder="0.0"
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Grano Abierto */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Grano Abierto (%) (&le; 1.5%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formDataCoccion.granoAbiertoPct ?? ""}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, granoAbiertoPct: e.target.value })}
                    placeholder="0.0"
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Grano Hinchado */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Grano Hinchado (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formDataCoccion.granoHinchadoPct ?? ""}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, granoHinchadoPct: e.target.value })}
                    placeholder="0.0"
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Soltura */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Velocidad Desplazamiento (Soltura)
                  </label>
                  <input
                    type="text"
                    value={formDataCoccion.desplazamientoSeg}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, desplazamientoSeg: e.target.value })}
                    placeholder="Ej: 15 seg"
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Textura */}
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Textura al Frío
                  </label>
                  <input
                    type="text"
                    value={formDataCoccion.texturaFrio}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, texturaFrio: e.target.value })}
                    placeholder="Ej: Suave / Al dente"
                    className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Puntaje Cocción */}
                <div>
                  <label className="block font-bold text-amber-400 mb-1">
                    Puntaje Global Cocción (0 - 100)
                  </label>
                  <input
                    type="number"
                    value={formDataCoccion.puntajeCoccion ?? ""}
                    onChange={(e) => setFormDataCoccion({ ...formDataCoccion, puntajeCoccion: e.target.value })}
                    placeholder="Ej: 95"
                    className="w-full bg-slate-850 border border-amber-500/50 px-3 py-2 rounded-xl text-amber-300 font-mono font-black text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Envase Proyectado */}
              <div>
                <label className="block font-bold text-emerald-400 mb-1">
                  Envase Proyectado / Destino Comercial
                </label>
                <select
                  value={formDataCoccion.envaseProyectado}
                  onChange={(e) => setFormDataCoccion({ ...formDataCoccion, envaseProyectado: e.target.value })}
                  className="w-full bg-slate-850 border border-slate-700 px-3 py-2 rounded-xl text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar Envase Proyectado --</option>
                  <option value="Saco 50 kg Don Julio Extra Selección">Saco 50 kg Don Julio Extra Selección (Puntaje &ge; 95 pts)</option>
                  <option value="Saco 50 kg Añejado Especial Don Julio">Saco 50 kg Añejado Especial Don Julio (Puntaje 90 - 94 pts)</option>
                  <option value="Saco 50 kg Arroz Superior / Tradicional">Saco 50 kg Arroz Superior / Tradicional</option>
                  <option value="Granel Industrial para Envasado Especial">Granel Industrial para Envasado Especial</option>
                </select>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Observaciones Técnicas de la Prueba
                </label>
                <textarea
                  rows={2}
                  value={formDataCoccion.observaciones}
                  onChange={(e) => setFormDataCoccion({ ...formDataCoccion, observaciones: e.target.value })}
                  className="w-full bg-slate-850 border border-slate-700 p-2.5 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBatchParaEditarCoccion(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isSavingCoccion}
                onClick={handleGuardarCoccion}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4 text-slate-950" />
                <span>{isSavingCoccion ? "Guardando..." : "Guardar Resultado de Cocción"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
