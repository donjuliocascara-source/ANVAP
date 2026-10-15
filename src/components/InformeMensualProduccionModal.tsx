import React, { useMemo, useState } from "react";
import {
  Lote,
  BatchVaporizado,
  ControlVaporizado,
  AnalisisVaporizado,
  AnalisisHumedo,
  AnalisisSeco,
  BatchLote,
  RegistroHumedad,
  Presecado,
  UserProfile
} from "../types";
import { ProgramacionBatchOficial } from "../utils/programacionBatchOficialService";
import { puedeExportarInformeMensual } from "../utils/permisosService";
import { obtenerUsuariosSistema } from "../utils/usuariosService";
import { calcularEvaluacionBatch, formatearModalidadVaporizado } from "../utils/evaluacionProcesosService";
import { obtenerRegistroSacasDescargaBatch } from "../utils/sacasDescargaService";
import {
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  Lock,
  ShieldCheck,
  Calendar,
  Filter,
  Package,
  Layers,
  Droplets,
  Flame,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Wheat,
  Scale,
  KeyRound,
  UserCheck,
  Gauge,
  Thermometer,
  BarChart3,
  BookOpen,
  Award,
  Activity
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface InformeMensualProduccionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectUser?: (user: UserProfile) => void;
  lotes: Lote[];
  batches: BatchVaporizado[];
  batchLotes: BatchLote[];
  controles: ControlVaporizado[];
  analisisVap: AnalisisVaporizado[];
  analisisHum: AnalisisHumedo[];
  analisisSec: AnalisisSeco[];
  humedades: RegistroHumedad[];
  presecados?: Presecado[];
  programaciones?: ProgramacionBatchOficial[];
}

const MESES_NOMBRES = [
  { value: "TODOS", label: "Consolidado General (Todos los Meses)" },
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" }
];

function extractYearMonth(dateStr?: string): { year: string; month: string } | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    return { year: isoMatch[1], month: isoMatch[2].padStart(2, "0") };
  }
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return { year: dmyMatch[3], month: dmyMatch[2].padStart(2, "0") };
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, "0")
    };
  }
  return null;
}

export const InformeMensualProduccionModal: React.FC<InformeMensualProduccionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
  lotes = [],
  batches = [],
  batchLotes = [],
  controles = [],
  analisisVap = [],
  analisisHum = [],
  analisisSec = [],
  humedades = [],
  presecados = [],
  programaciones = []
}) => {
  const [selectedMes, setSelectedMes] = useState<string>("TODOS");
  const [selectedAnio, setSelectedAnio] = useState<string>("2026");
  const [filtroVariedad, setFiltroVariedad] = useState<string>("TODAS");
  const [filtroEstadoBatch, setFiltroEstadoBatch] = useState<string>("TODOS");
  const [activeTabPreview, setActiveTabPreview] = useState<"resumen" | "graficos" | "explicacion" | "batches" | "lotes" | "variedades">("resumen");

  // Autorización por PIN en caso de que el usuario actual no tenga el rol activo de Jefe de Vaporizado
  const [authorizedByPin, setAuthorizedByPin] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const isJefeVaporizado = useMemo(() => {
    return puedeExportarInformeMensual(currentUser) || authorizedByPin;
  }, [currentUser, authorizedByPin]);

  // Busca únicamente si el propio Jefe de Vaporizado ya creó su usuario en el sistema
  const jefeVaporizadoCreado = useMemo(() => {
    if (puedeExportarInformeMensual(currentUser)) return currentUser;
    const all = obtenerUsuariosSistema();
    return all.find(u => u.rol === "JEFE_VAPORIZADO" || u.rol === "JEFE_PLANTA") || null;
  }, [currentUser, isOpen]);

  const nombreAutorizador = useMemo(() => {
    if (puedeExportarInformeMensual(currentUser)) return currentUser.nombre;
    if (jefeVaporizadoCreado) return jefeVaporizadoCreado.nombre;
    return "Jefe de Vaporizado";
  }, [currentUser, jefeVaporizadoCreado]);

  const handleUnlockWithPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    if (!jefeVaporizadoCreado) {
      setPinError("Aún no se ha registrado un usuario con el rol de Jefe de Vaporizado. El Jefe de Vaporizado debe crear primero su usuario en Gestión de Usuarios.");
      return;
    }
    const expectedPin = (jefeVaporizadoCreado.pin || "").trim();
    if (expectedPin && cleanPin === expectedPin) {
      setAuthorizedByPin(true);
      setPinError(null);
      if (onSelectUser) {
        onSelectUser(jefeVaporizadoCreado);
      }
    } else {
      setPinError("PIN incorrecto. Ingrese el PIN configurado por el Jefe de Vaporizado.");
    }
  };

  // Procesamiento integral de todos los Batches con sus métricas de ingreso, proceso y salida
  const batchesEnriquecidos = useMemo(() => {
    return batches.map(b => {
      const evalData = calcularEvaluacionBatch(
        b,
        batchLotes,
        lotes,
        controles,
        analisisVap,
        presecados,
        analisisHum,
        analisisSec
      );

      const correlativo = b.CORRELATIVO || b.BATCH_ID || "";
      const ctrl = controles.find(
        c =>
          c.BATCH_ID === b.BATCH_ID ||
          (b.CORRELATIVO && (c.CORRELATIVO === b.CORRELATIVO || c.BATCH_ID === b.CORRELATIVO))
      );

      const sacasReg = obtenerRegistroSacasDescargaBatch(b.BATCH_ID, correlativo, undefined, b, ctrl);
      const sacasConPeso = (sacasReg?.sacas || []).filter(s => Number(s.pesoKg) > 0);
      const totalSacasSalida = sacasConPeso.length;
      const pesoTotalSacasKg = Number(sacasReg?.pesoRealDescargaKg || 0);

      const estadoRaw = (b.ESTADO_BATCH || "PROGRAMADO").toUpperCase();
      const esCerrado = estadoRaw === "CERRADO" || estadoRaw === "TERMINADO" || estadoRaw === "FINALIZADO" || Boolean((b as any).cerroCompletamente);
      const esEnProceso = estadoRaw === "EN PROCESO" || estadoRaw === "VAPORIZADO" || estadoRaw === "EN REPOSO" || estadoRaw === "EN SECADO";
      const estadoNormalizado = esCerrado ? "CERRADO" : esEnProceso ? "EN PROCESO" : "PROGRAMADO";

      const fechaRef = b.FECHA_CIERRE || b.FECHA_PROGRAMADA || b.FECHA_INICIO || evalData.fecha || "";
      const ym = extractYearMonth(fechaRef);

      const modalidadLabel = formatearModalidadVaporizado(
        ctrl?.datosVaporizado?.modalidadPases || (ctrl as any)?.MODALIDAD_PASES || evalData.modalidadPases
      );

      const pesoIngresoKg = Number(evalData.pesoTotalKg || b.PESO_TOTAL_KG || (b.TON_PROGRAMADAS ? b.TON_PROGRAMADAS * 1000 : 0));
      const pesoSalidaKg = totalSacasSalida > 0 ? pesoTotalSacasKg : Number(b.TON_PROCESADAS ? b.TON_PROCESADAS * 1000 : pesoIngresoKg);
      const difPesoPct = pesoIngresoKg > 0 ? Number((((pesoSalidaKg - pesoIngresoKg) / pesoIngresoKg) * 100).toFixed(2)) : 0;

      return {
        batchId: b.BATCH_ID,
        correlativo: correlativo || b.BATCH_ID,
        fecha: evalData.fecha || fechaRef || "-",
        year: ym?.year || "2026",
        month: ym?.month || "10",
        turno: b.TURNO || evalData.turno || "DIA",
        equipo: b.EQUIPO || evalData.equipo || "APIT",
        modalidad: modalidadLabel,
        cliente: evalData.cliente || b.CLIENTE || "Cliente General",
        variedad: (evalData.variedad || b.VARIEDAD || "TINAJONES").toUpperCase(),
        lotesCodigos: evalData.loteIds.length > 0 ? evalData.loteIds.join(", ") : (b.LOTE_ID || "-"),
        cantidadLotes: evalData.loteIds.length || (b.LOTE_ID ? 1 : 0),
        sacosIngreso: Number(evalData.totalSacos || b.TOTAL_SACOS || Math.round(pesoIngresoKg / 50)),
        pesoIngresoKg,
        pesoIngresoTn: Number((pesoIngresoKg / 1000).toFixed(2)),
        totalSacasSalida,
        pesoSalidaKg,
        pesoSalidaTn: Number((pesoSalidaKg / 1000).toFixed(2)),
        difPesoPct,
        humIngreso: Number(evalData.humIngreso || 0),
        humSalida: Number(evalData.humSalida || 0),
        deltaHumedad: Number(evalData.deltaHumedad || 0),
        qiIngreso: Number(evalData.qiIngreso || 0),
        qbIngreso: Number(evalData.qbIngreso || 0),
        qbSalida: Number(evalData.qbSalida || 0),
        deltaQuebrado: Number(evalData.deltaQuebrado || 0),
        tizaIngreso: Number(evalData.tizaIngreso || 0),
        tizaSalida: Number(evalData.tizaSalida || 0),
        deltaTiza: Number(evalData.deltaTiza || 0),
        trizadoIngreso: Number(evalData.trizadoIngreso || 0),
        trizadoSalida: Number(evalData.trizadoSalida || 0),
        deltaTrizado: Number(evalData.deltaTrizado || 0),
        blancuraIngreso: Number(evalData.blancuraIngreso || 0),
        blancuraSalida: Number(evalData.blancuraSalida || 0),
        presionBar: Number(evalData.presionVaporBar || ctrl?.PRESION_BAR || 0),
        tiempoVaporMin: Number(evalData.tiempoVaporMin || ctrl?.TIEMPO_VAPORIZADO_MIN || 0),
        tiempoReposoMin: Number(evalData.tiempoReposoMin || ctrl?.TIEMPO_REPOSO_MIN || 0),
        tempSecadoC: Number(evalData.tempSecadoC || 0),
        tiempoSecadoMin: Number(evalData.tiempoSecadoMin || 0),
        iepScore: Number(evalData.iepScore || 0),
        operador: ctrl?.OPERADOR || b.OPERADOR || "Operador Planta",
        supervisor: ctrl?.SUPERVISOR || "Jefe de Vaporizado",
        estado: estadoNormalizado,
        esCerrado,
        esEnProceso
      };
    });
  }, [batches, batchLotes, lotes, controles, analisisVap, analisisHum, analisisSec, programaciones]);

  // Procesamiento integral de todos los Lotes con sus humedades de ingreso, salida, pesos procesados y batches
  const lotesEnriquecidos = useMemo(() => {
    return lotes.map(l => {
      const lid = (l.LOTE_ID || "").trim();
      const ah = analisisHum.find(a => (a.LOTE_ID || "").trim().toUpperCase() === lid.toUpperCase());
      const rh = humedades.find(h => (h.LOTE_ID || "").trim().toUpperCase() === lid.toUpperCase());
      const as = analisisSec.find(s => (s.LOTE_ID || "").trim().toUpperCase() === lid.toUpperCase());
      const ps = presecados.find(p => (p.LOTE_ID || "").trim().toUpperCase() === lid.toUpperCase());
      const av = analisisVap.find(v => (v.LOTE_ID || "").trim().toUpperCase() === lid.toUpperCase());

      // Cruce con batchLotes y programaciones para calcular peso procesado y batches vinculados
      const blLinks = batchLotes.filter(bl => (bl.LOTE_ID || "").trim().toUpperCase() === lid.toUpperCase());
      const batchesCodigosSet = new Set<string>();
      let pesoAsignadoKg = 0;
      let sacosAsignados = 0;

      blLinks.forEach(bl => {
        if (bl.BATCH_ID) {
          const bMatch = batches.find(b => b.BATCH_ID === bl.BATCH_ID || b.CORRELATIVO === bl.BATCH_ID);
          batchesCodigosSet.add(bMatch?.CORRELATIVO || bl.BATCH_ID);
        }
        pesoAsignadoKg += Number(bl.PESO_KG || 0);
        sacosAsignados += Number(bl.SACOS || 0);
      });

      programaciones.forEach(prog => {
        if (Array.isArray(prog.filasLote)) {
          prog.filasLote.forEach(f => {
            if ((f.loteId || "").trim().toUpperCase() === lid.toUpperCase()) {
              if (prog.batch) batchesCodigosSet.add(prog.batch);
              if (blLinks.length === 0) {
                pesoAsignadoKg += Number(f.pesoProg || f.peso || 0);
                sacosAsignados += Number(f.sacProg || f.sacos || 0);
              }
            }
          });
        }
      });

      const pesoIngresoKg = Number(l.PESO_KG || (l.SACOS ? l.SACOS * 50 : 0));
      const sacosIngreso = Number(l.SACOS || Math.round(pesoIngresoKg / 50));

      const estadoLoteUpper = (l.ESTADO_LOTE || "INGRESADO").toUpperCase();
      const esProcesado = estadoLoteUpper === "CERRADO" || estadoLoteUpper === "EVALUADO" || estadoLoteUpper === "TERMINADO";
      const esEnProceso = ["EN PROCESO", "VAPORIZADO", "EN REPOSO", "EN SECADO"].includes(estadoLoteUpper);
      const esProgramado = estadoLoteUpper === "PROGRAMADO" || batchesCodigosSet.size > 0;

      const pesoProcesadoRealKg = esProcesado
        ? Math.max(pesoAsignadoKg, pesoIngresoKg)
        : Math.min(pesoIngresoKg, pesoAsignadoKg);
      const saldoPendienteKg = Math.max(0, pesoIngresoKg - pesoProcesadoRealKg);

      // Humedad ingreso promedio y desviación
      const humIngreso = Number(rh?.["H. PROMEDIO"] ?? ah?.HUMEDADES ?? l.HUM ?? 0);
      const desvHumedad = Number(rh?.["DESV."] ?? l.DESV ?? 0);

      // Humedad salida (desde análisis vaporizado del lote o del batch vinculado, o análisis seco)
      let humSalida = Number(av?.HUMEDAD ?? as?.Humedad_Final ?? ps?.HUM_FINAL ?? 0);
      if (!humSalida && batchesCodigosSet.size > 0) {
        const firstBatchCode = Array.from(batchesCodigosSet)[0];
        const bEnr = batchesEnriquecidos.find(
          be => be.correlativo.toUpperCase() === firstBatchCode.toUpperCase() || be.batchId.toUpperCase() === firstBatchCode.toUpperCase()
        );
        if (bEnr && bEnr.humSalida > 0) {
          humSalida = bEnr.humSalida;
        }
      }

      const ri = Number(ah?.["R.I"] ?? (l as any).RI ?? 0);
      const rb = Number(ah?.["R.B"] ?? (l as any).RB ?? 0);
      const qi = Number(ah?.QI ?? (l as any).QI ?? 0);
      const qb = Number(ah?.QB ?? (l as any).QB ?? 0);
      const tt = Number(ah?.TT ?? (l as any).TT ?? 0);
      const tz = Number(ah?.TZ ?? (l as any).TZ ?? 0);
      const blp = Number(ah?.BLP ?? ah?.["B. PULIDO"] ?? (l as any).BLP ?? 0);

      const fechaRef = l.FECHA_INGRESO || ah?.FECHA || "";
      const ym = extractYearMonth(fechaRef);

      let categoriaOperativa: "PROCESADO" | "EN PROCESO" | "PROGRAMADO" | "PENDIENTE" | "OBSERVADO" = "PENDIENTE";
      if (estadoLoteUpper === "OBSERVADO" || (l.ESTADO_CALIDAD || "").toUpperCase() === "OBSERVADO") {
        categoriaOperativa = "OBSERVADO";
      } else if (esProcesado) {
        categoriaOperativa = "PROCESADO";
      } else if (esEnProceso) {
        categoriaOperativa = "EN PROCESO";
      } else if (esProgramado) {
        categoriaOperativa = "PROGRAMADO";
      }

      return {
        loteId: lid,
        fechaIngreso: fechaRef || "-",
        year: ym?.year || "2026",
        month: ym?.month || "10",
        cliente: l.CLIENTE || "Sin Cliente",
        zona: l.ZONA || "Valle Norte",
        variedad: (l.VARIEDAD || "SIN VARIEDAD").toUpperCase(),
        ubicacion: l.UBICACION || "Patio / Tolva",
        sacosIngreso,
        pesoIngresoKg,
        pesoIngresoTn: Number((pesoIngresoKg / 1000).toFixed(2)),
        pesoProcesadoKg: pesoProcesadoRealKg,
        pesoProcesadoTn: Number((pesoProcesadoRealKg / 1000).toFixed(2)),
        saldoPendienteKg,
        saldoPendienteTn: Number((saldoPendienteKg / 1000).toFixed(2)),
        humIngreso: Number(humIngreso.toFixed(2)),
        desvHumedad: Number(desvHumedad.toFixed(2)),
        humSalida: humSalida > 0 ? Number(humSalida.toFixed(2)) : 0,
        ri: Number(ri.toFixed(2)),
        rb: Number(rb.toFixed(2)),
        qi: Number(qi.toFixed(2)),
        qb: Number(qb.toFixed(2)),
        tt: Number(tt.toFixed(2)),
        tz: Number(tz.toFixed(2)),
        blp: Number(blp.toFixed(1)),
        batchesAsignados: batchesCodigosSet.size > 0 ? Array.from(batchesCodigosSet).join(", ") : "Sin asignar",
        estadoCalidad: l.ESTADO_CALIDAD || "APROBADO",
        estadoLote: l.ESTADO_LOTE || "INGRESADO",
        categoriaOperativa
      };
    });
  }, [lotes, analisisHum, humedades, analisisSec, presecados, analisisVap, batchLotes, batches, programaciones, batchesEnriquecidos]);

  // Variedades únicas para filtro
  const variedadesDisponibles = useMemo(() => {
    const set = new Set<string>();
    lotesEnriquecidos.forEach(l => {
      if (l.variedad) set.add(l.variedad);
    });
    batchesEnriquecidos.forEach(b => {
      if (b.variedad) set.add(b.variedad);
    });
    return Array.from(set).sort();
  }, [lotesEnriquecidos, batchesEnriquecidos]);

  // Filtrado por periodo y variedad
  const lotesFiltrados = useMemo(() => {
    return lotesEnriquecidos.filter(l => {
      if (selectedMes !== "TODOS") {
        if (l.month !== selectedMes || l.year !== selectedAnio) return false;
      }
      if (filtroVariedad !== "TODAS" && l.variedad !== filtroVariedad) return false;
      return true;
    });
  }, [lotesEnriquecidos, selectedMes, selectedAnio, filtroVariedad]);

  const batchesFiltrados = useMemo(() => {
    return batchesEnriquecidos.filter(b => {
      if (selectedMes !== "TODOS") {
        if (b.month !== selectedMes || b.year !== selectedAnio) return false;
      }
      if (filtroVariedad !== "TODAS" && b.variedad !== filtroVariedad) return false;
      if (filtroEstadoBatch !== "TODOS" && b.estado !== filtroEstadoBatch) return false;
      return true;
    });
  }, [batchesEnriquecidos, selectedMes, selectedAnio, filtroVariedad, filtroEstadoBatch]);

  // KPIs consolidados, Parámetros Promedios y Estadísticas de Humedad/Calidad del Informe Mensual
  const kpis = useMemo(() => {
    const totalLotes = lotesFiltrados.length;
    const lotesProcesados = lotesFiltrados.filter(l => l.categoriaOperativa === "PROCESADO").length;
    const lotesEnProceso = lotesFiltrados.filter(l => l.categoriaOperativa === "EN PROCESO" || l.categoriaOperativa === "PROGRAMADO").length;
    const lotesPendientes = lotesFiltrados.filter(l => l.categoriaOperativa === "PENDIENTE").length;
    const lotesObservados = lotesFiltrados.filter(l => l.categoriaOperativa === "OBSERVADO").length;

    const pesoTotalLotesKg = lotesFiltrados.reduce((acc, l) => acc + l.pesoIngresoKg, 0);
    const sacosTotalLotes = lotesFiltrados.reduce((acc, l) => acc + l.sacosIngreso, 0);
    const pesoTotalProcesadoLotesKg = lotesFiltrados.reduce((acc, l) => acc + l.pesoProcesadoKg, 0);
    const saldoPendienteTotalKg = lotesFiltrados.reduce((acc, l) => acc + l.saldoPendienteKg, 0);
    const pctAvanceProcesado = pesoTotalLotesKg > 0 ? Number(((pesoTotalProcesadoLotesKg / pesoTotalLotesKg) * 100).toFixed(1)) : 0;

    // Humedades de Lotes (ponderada, simple, min, max, desviación y salida)
    let sumHumPesoLote = 0;
    let sumPesoConHumLote = 0;
    let sumHumSimpleLote = 0;
    let countHumLote = 0;
    let sumDesvLote = 0;
    let countDesvLote = 0;
    let minHumIngLote = 999;
    let maxHumIngLote = 0;
    let sumHumSalLote = 0;
    let countHumSalLote = 0;
    let sumRiLote = 0;
    let sumRbLote = 0;
    let countRendLote = 0;

    lotesFiltrados.forEach(l => {
      if (l.humIngreso > 0) {
        const w = l.pesoIngresoKg > 0 ? l.pesoIngresoKg : 1;
        sumHumPesoLote += l.humIngreso * w;
        sumPesoConHumLote += w;
        sumHumSimpleLote += l.humIngreso;
        countHumLote++;
        if (l.humIngreso < minHumIngLote) minHumIngLote = l.humIngreso;
        if (l.humIngreso > maxHumIngLote) maxHumIngLote = l.humIngreso;
      }
      if (l.desvHumedad > 0) {
        sumDesvLote += l.desvHumedad;
        countDesvLote++;
      }
      if (l.humSalida > 0) {
        sumHumSalLote += l.humSalida;
        countHumSalLote++;
      }
      if (l.ri > 0 || l.rb > 0) {
        sumRiLote += l.ri;
        sumRbLote += l.rb;
        countRendLote++;
      }
    });

    const humIngresoPromLotes = sumPesoConHumLote > 0 ? Number((sumHumPesoLote / sumPesoConHumLote).toFixed(2)) : 0;
    const humIngresoSimpleLotes = countHumLote > 0 ? Number((sumHumSimpleLote / countHumLote).toFixed(2)) : 0;
    const desvHumedadPromLotes = countDesvLote > 0 ? Number((sumDesvLote / countDesvLote).toFixed(2)) : 0;
    const humIngresoMin = minHumIngLote < 999 ? Number(minHumIngLote.toFixed(2)) : 0;
    const humIngresoMax = maxHumIngLote > 0 ? Number(maxHumIngLote.toFixed(2)) : 0;
    const riIngresoProm = countRendLote > 0 ? Number((sumRiLote / countRendLote).toFixed(2)) : 0;
    const rbIngresoProm = countRendLote > 0 ? Number((sumRbLote / countRendLote).toFixed(2)) : 0;

    // Batches KPIs y Parámetros Térmicos Promedios
    const totalBatches = batchesFiltrados.length;
    const batchesCerrados = batchesFiltrados.filter(b => b.estado === "CERRADO").length;
    const batchesEnProceso = batchesFiltrados.filter(b => b.estado === "EN PROCESO").length;
    const batchesProgramados = batchesFiltrados.filter(b => b.estado === "PROGRAMADO").length;

    const pesoTotalBatchesIngresoKg = batchesFiltrados.reduce((acc, b) => acc + b.pesoIngresoKg, 0);
    const pesoTotalBatchesSalidaKg = batchesFiltrados.reduce((acc, b) => acc + b.pesoSalidaKg, 0);
    const totalSacosBatches = batchesFiltrados.reduce((acc, b) => acc + b.sacosIngreso, 0);
    const totalSacasDescarga = batchesFiltrados.reduce((acc, b) => acc + b.totalSacasSalida, 0);

    let sumHumIngB = 0;
    let countHumIngB = 0;
    let sumHumSalB = 0;
    let countHumSalB = 0;
    let minHumSalB = 999;
    let maxHumSalB = 0;

    let sumQiIngB = 0;
    let sumQbSalB = 0;
    let countCalB = 0;

    let sumTizaIng = 0;
    let sumTizaSal = 0;
    let countTiza = 0;

    let sumTrizIng = 0;
    let sumTrizSal = 0;
    let countTriz = 0;

    let sumBlpIng = 0;
    let sumBlpSal = 0;
    let countBlp = 0;

    let sumPresion = 0;
    let countPresion = 0;
    let minPresion = 999;
    let maxPresion = 0;

    let sumTiempoVap = 0;
    let countTiempoVap = 0;

    let sumTiempoRep = 0;
    let countTiempoRep = 0;

    let sumTempSec = 0;
    let countTempSec = 0;

    let sumTiempoSec = 0;
    let countTiempoSec = 0;

    let sumIep = 0;
    let countIep = 0;

    let batchesUnPase = 0;
    let batchesDosPases = 0;

    batchesFiltrados.forEach(b => {
      if (b.modalidad.includes("2")) {
        batchesDosPases++;
      } else {
        batchesUnPase++;
      }

      if (b.humIngreso > 0) {
        sumHumIngB += b.humIngreso;
        countHumIngB++;
      }
      if (b.humSalida > 0) {
        sumHumSalB += b.humSalida;
        countHumSalB++;
        if (b.humSalida < minHumSalB) minHumSalB = b.humSalida;
        if (b.humSalida > maxHumSalB) maxHumSalB = b.humSalida;
      }
      if (b.qiIngreso > 0 || b.qbSalida > 0) {
        sumQiIngB += b.qiIngreso;
        sumQbSalB += b.qbSalida;
        countCalB++;
      }
      if (b.tizaIngreso > 0 || b.tizaSalida > 0) {
        sumTizaIng += b.tizaIngreso;
        sumTizaSal += b.tizaSalida;
        countTiza++;
      }
      if (b.trizadoIngreso > 0 || b.trizadoSalida > 0) {
        sumTrizIng += b.trizadoIngreso;
        sumTrizSal += b.trizadoSalida;
        countTriz++;
      }
      if (b.blancuraIngreso > 0 || b.blancuraSalida > 0) {
        sumBlpIng += b.blancuraIngreso;
        sumBlpSal += b.blancuraSalida;
        countBlp++;
      }
      if (b.presionBar > 0) {
        sumPresion += b.presionBar;
        countPresion++;
        if (b.presionBar < minPresion) minPresion = b.presionBar;
        if (b.presionBar > maxPresion) maxPresion = b.presionBar;
      }
      if (b.tiempoVaporMin > 0) {
        sumTiempoVap += b.tiempoVaporMin;
        countTiempoVap++;
      }
      if (b.tiempoReposoMin > 0) {
        sumTiempoRep += b.tiempoReposoMin;
        countTiempoRep++;
      }
      if (b.tempSecadoC > 0) {
        sumTempSec += b.tempSecadoC;
        countTempSec++;
      }
      if (b.tiempoSecadoMin > 0) {
        sumTiempoSec += b.tiempoSecadoMin;
        countTiempoSec++;
      }
      if (b.iepScore > 0) {
        sumIep += b.iepScore;
        countIep++;
      }
    });

    const humIngresoPromBatches = countHumIngB > 0 ? Number((sumHumIngB / countHumIngB).toFixed(2)) : humIngresoPromLotes;
    const humSalidaPromBatches = countHumSalB > 0
      ? Number((sumHumSalB / countHumSalB).toFixed(2))
      : countHumSalLote > 0
      ? Number((sumHumSalLote / countHumSalLote).toFixed(2))
      : 0;
    const humSalidaMin = minHumSalB < 999 ? Number(minHumSalB.toFixed(2)) : humSalidaPromBatches;
    const humSalidaMax = maxHumSalB > 0 ? Number(maxHumSalB.toFixed(2)) : humSalidaPromBatches;

    const reduccionHumedadProm = humIngresoPromBatches > 0 && humSalidaPromBatches > 0
      ? Number((humIngresoPromBatches - humSalidaPromBatches).toFixed(2))
      : 0;

    const qiIngresoProm = countCalB > 0 ? Number((sumQiIngB / countCalB).toFixed(2)) : 0;
    const qbSalidaProm = countCalB > 0 ? Number((sumQbSalB / countCalB).toFixed(2)) : 0;
    const deltaQuebradoProm = Number((qbSalidaProm - qiIngresoProm).toFixed(2));

    const tizaIngresoProm = countTiza > 0 ? Number((sumTizaIng / countTiza).toFixed(2)) : 0;
    const tizaSalidaProm = countTiza > 0 ? Number((sumTizaSal / countTiza).toFixed(2)) : 0;
    const deltaTizaProm = Number((tizaSalidaProm - tizaIngresoProm).toFixed(2));

    const trizadoIngresoProm = countTriz > 0 ? Number((sumTrizIng / countTriz).toFixed(2)) : 0;
    const trizadoSalidaProm = countTriz > 0 ? Number((sumTrizSal / countTriz).toFixed(2)) : 0;
    const deltaTrizadoProm = Number((trizadoSalidaProm - trizadoIngresoProm).toFixed(2));

    const blancuraIngresoProm = countBlp > 0 ? Number((sumBlpIng / countBlp).toFixed(1)) : 0;
    const blancuraSalidaProm = countBlp > 0 ? Number((sumBlpSal / countBlp).toFixed(1)) : 0;

    const presionPromBar = countPresion > 0 ? Number((sumPresion / countPresion).toFixed(2)) : 0;
    const presionMinBar = minPresion < 999 ? Number(minPresion.toFixed(2)) : 0;
    const presionMaxBar = maxPresion > 0 ? Number(maxPresion.toFixed(2)) : 0;
    const tiempoVaporPromMin = countTiempoVap > 0 ? Number((sumTiempoVap / countTiempoVap).toFixed(1)) : 0;
    const tiempoReposoPromMin = countTiempoRep > 0 ? Number((sumTiempoRep / countTiempoRep).toFixed(1)) : 0;
    const tempSecadoPromC = countTempSec > 0 ? Number((sumTempSec / countTempSec).toFixed(1)) : 0;
    const tiempoSecadoPromMin = countTiempoSec > 0 ? Number((sumTiempoSec / countTiempoSec).toFixed(0)) : 0;
    const iepProm = countIep > 0 ? Number((sumIep / countIep).toFixed(1)) : 0;

    const pctUnPase = totalBatches > 0 ? Number(((batchesUnPase / totalBatches) * 100).toFixed(1)) : 0;
    const pctDosPases = totalBatches > 0 ? Number(((batchesDosPases / totalBatches) * 100).toFixed(1)) : 0;

    return {
      totalLotes,
      lotesProcesados,
      lotesEnProceso,
      lotesPendientes,
      lotesObservados,
      pesoTotalLotesKg,
      pesoTotalLotesTn: Number((pesoTotalLotesKg / 1000).toFixed(2)),
      sacosTotalLotes,
      pesoTotalProcesadoLotesKg,
      pesoTotalProcesadoLotesTn: Number((pesoTotalProcesadoLotesKg / 1000).toFixed(2)),
      saldoPendienteTotalKg,
      saldoPendienteTotalTn: Number((saldoPendienteTotalKg / 1000).toFixed(2)),
      pctAvanceProcesado,
      humIngresoPromLotes,
      humIngresoSimpleLotes,
      desvHumedadPromLotes,
      humIngresoMin,
      humIngresoMax,
      riIngresoProm,
      rbIngresoProm,
      totalBatches,
      batchesCerrados,
      batchesEnProceso,
      batchesProgramados,
      pesoTotalBatchesIngresoKg,
      pesoTotalBatchesIngresoTn: Number((pesoTotalBatchesIngresoKg / 1000).toFixed(2)),
      pesoTotalBatchesSalidaKg,
      pesoTotalBatchesSalidaTn: Number((pesoTotalBatchesSalidaKg / 1000).toFixed(2)),
      totalSacosBatches,
      totalSacasDescarga,
      humIngresoPromBatches,
      humSalidaPromBatches,
      humSalidaMin,
      humSalidaMax,
      reduccionHumedadProm,
      qiIngresoProm,
      qbSalidaProm,
      deltaQuebradoProm,
      tizaIngresoProm,
      tizaSalidaProm,
      deltaTizaProm,
      trizadoIngresoProm,
      trizadoSalidaProm,
      deltaTrizadoProm,
      blancuraIngresoProm,
      blancuraSalidaProm,
      presionPromBar,
      presionMinBar,
      presionMaxBar,
      tiempoVaporPromMin,
      tiempoReposoPromMin,
      tempSecadoPromC,
      tiempoSecadoPromMin,
      iepProm,
      batchesUnPase,
      batchesDosPases,
      pctUnPase,
      pctDosPases
    };
  }, [lotesFiltrados, batchesFiltrados]);

  // Agrupación por Variedad
  const resumenPorVariedad = useMemo(() => {
    const map = new Map<
      string,
      {
        variedad: string;
        cantidadLotes: number;
        cantidadBatches: number;
        sacosIngreso: number;
        pesoIngresoKg: number;
        pesoProcesadoKg: number;
        saldoPendienteKg: number;
        sumHumIngreso: number;
        countHumIngreso: number;
        sumHumSalida: number;
        countHumSalida: number;
        sumQi: number;
        countQi: number;
        sumQbSalida: number;
        countQbSalida: number;
      }
    >();

    lotesFiltrados.forEach(l => {
      const v = l.variedad || "SIN VARIEDAD";
      const cur = map.get(v) || {
        variedad: v,
        cantidadLotes: 0,
        cantidadBatches: 0,
        sacosIngreso: 0,
        pesoIngresoKg: 0,
        pesoProcesadoKg: 0,
        saldoPendienteKg: 0,
        sumHumIngreso: 0,
        countHumIngreso: 0,
        sumHumSalida: 0,
        countHumSalida: 0,
        sumQi: 0,
        countQi: 0,
        sumQbSalida: 0,
        countQbSalida: 0
      };
      cur.cantidadLotes++;
      cur.sacosIngreso += l.sacosIngreso;
      cur.pesoIngresoKg += l.pesoIngresoKg;
      cur.pesoProcesadoKg += l.pesoProcesadoKg;
      cur.saldoPendienteKg += l.saldoPendienteKg;
      if (l.humIngreso > 0) {
        cur.sumHumIngreso += l.humIngreso;
        cur.countHumIngreso++;
      }
      if (l.humSalida > 0) {
        cur.sumHumSalida += l.humSalida;
        cur.countHumSalida++;
      }
      if (l.qi > 0) {
        cur.sumQi += l.qi;
        cur.countQi++;
      }
      map.set(v, cur);
    });

    batchesFiltrados.forEach(b => {
      const v = b.variedad || "SIN VARIEDAD";
      const cur = map.get(v) || {
        variedad: v,
        cantidadLotes: 0,
        cantidadBatches: 0,
        sacosIngreso: 0,
        pesoIngresoKg: 0,
        pesoProcesadoKg: 0,
        saldoPendienteKg: 0,
        sumHumIngreso: 0,
        countHumIngreso: 0,
        sumHumSalida: 0,
        countHumSalida: 0,
        sumQi: 0,
        countQi: 0,
        sumQbSalida: 0,
        countQbSalida: 0
      };
      cur.cantidadBatches++;
      if (b.humSalida > 0) {
        cur.sumHumSalida += b.humSalida;
        cur.countHumSalida++;
      }
      if (b.qbSalida > 0) {
        cur.sumQbSalida += b.qbSalida;
        cur.countQbSalida++;
      }
      map.set(v, cur);
    });

    const totalKgGlobal = kpis.pesoTotalLotesKg || 1;

    return Array.from(map.values())
      .map(item => ({
        variedad: item.variedad,
        cantidadLotes: item.cantidadLotes,
        cantidadBatches: item.cantidadBatches,
        sacosIngreso: item.sacosIngreso,
        pesoIngresoKg: item.pesoIngresoKg,
        pesoIngresoTn: Number((item.pesoIngresoKg / 1000).toFixed(2)),
        pesoProcesadoKg: item.pesoProcesadoKg,
        pesoProcesadoTn: Number((item.pesoProcesadoKg / 1000).toFixed(2)),
        saldoPendienteKg: item.saldoPendienteKg,
        participacionPct: Number(((item.pesoIngresoKg / totalKgGlobal) * 100).toFixed(1)),
        humIngresoProm: item.countHumIngreso > 0 ? Number((item.sumHumIngreso / item.countHumIngreso).toFixed(2)) : 0,
        humSalidaProm: item.countHumSalida > 0 ? Number((item.sumHumSalida / item.countHumSalida).toFixed(2)) : 0,
        qiProm: item.countQi > 0 ? Number((item.sumQi / item.countQi).toFixed(2)) : 0,
        qbSalidaProm: item.countQbSalida > 0 ? Number((item.sumQbSalida / item.countQbSalida).toFixed(2)) : 0
      }))
      .sort((a, b) => b.pesoIngresoKg - a.pesoIngresoKg);
  }, [lotesFiltrados, batchesFiltrados, kpis.pesoTotalLotesKg]);

  // Agrupación por Cliente
  const resumenPorCliente = useMemo(() => {
    const map = new Map<
      string,
      {
        cliente: string;
        lotes: number;
        sacos: number;
        pesoIngresoKg: number;
        pesoProcesadoKg: number;
        variedades: Set<string>;
      }
    >();

    lotesFiltrados.forEach(l => {
      const cli = l.cliente || "Sin Cliente";
      const cur = map.get(cli) || {
        cliente: cli,
        lotes: 0,
        sacos: 0,
        pesoIngresoKg: 0,
        pesoProcesadoKg: 0,
        variedades: new Set<string>()
      };
      cur.lotes++;
      cur.sacos += l.sacosIngreso;
      cur.pesoIngresoKg += l.pesoIngresoKg;
      cur.pesoProcesadoKg += l.pesoProcesadoKg;
      if (l.variedad) cur.variedades.add(l.variedad);
      map.set(cli, cur);
    });

    return Array.from(map.values())
      .map(c => ({
        cliente: c.cliente,
        lotes: c.lotes,
        sacos: c.sacos,
        pesoIngresoKg: c.pesoIngresoKg,
        pesoIngresoTn: Number((c.pesoIngresoKg / 1000).toFixed(2)),
        pesoProcesadoKg: c.pesoProcesadoKg,
        pesoProcesadoTn: Number((c.pesoProcesadoKg / 1000).toFixed(2)),
        variedades: Array.from(c.variedades).join(", ")
      }))
      .sort((a, b) => b.pesoIngresoKg - a.pesoIngresoKg);
  }, [lotesFiltrados]);

  const periodoTexto = useMemo(() => {
    const mObj = MESES_NOMBRES.find(m => m.value === selectedMes);
    return selectedMes === "TODOS"
      ? `CONSOLIDADO GENERAL DE PLANTA (${selectedAnio})`
      : `${(mObj?.label || selectedMes).toUpperCase()} ${selectedAnio}`;
  }, [selectedMes, selectedAnio]);

  // Datos para los gráficos estadísticos del informe
  const chartHumedadesPorBatch = useMemo(() => {
    return batchesFiltrados.map(b => ({
      batch: b.correlativo,
      variedad: b.variedad,
      humIngreso: Number(b.humIngreso || 0),
      humSalida: Number(b.humSalida > 0 ? b.humSalida : kpis.humSalidaPromBatches || 12.6),
      reduccion: Number(
        (
          (b.humIngreso || 0) -
          (b.humSalida > 0 ? b.humSalida : kpis.humSalidaPromBatches || 12.6)
        ).toFixed(2)
      ),
      presionBar: b.presionBar,
      tiempoVap: b.tiempoVaporMin
    }));
  }, [batchesFiltrados, kpis.humSalidaPromBatches]);

  const chartCalidadComparativa = useMemo(() => {
    return [
      {
        indicador: "Humedad (%)",
        ingreso: kpis.humIngresoPromBatches,
        salida: kpis.humSalidaPromBatches,
        meta: 12.5
      },
      {
        indicador: "Quebrado (%)",
        ingreso: kpis.qiIngresoProm,
        salida: kpis.qbSalidaProm,
        meta: 3.5
      },
      {
        indicador: "Tiza Total (%)",
        ingreso: kpis.tizaIngresoProm,
        salida: kpis.tizaSalidaProm,
        meta: 0.5
      },
      {
        indicador: "Trizado (%)",
        ingreso: kpis.trizadoIngresoProm,
        salida: kpis.trizadoSalidaProm,
        meta: 1.5
      }
    ];
  }, [kpis]);

  // Capítulos de Explicación Técnica Integral ("Explicando Todo")
  const capitulosExplicacion = useMemo(() => {
    const varPrincipal = resumenPorVariedad[0];
    const evalHumSalida =
      kpis.humSalidaPromBatches === 0
        ? "en proceso de estabilización y registro final de secado"
        : kpis.humSalidaPromBatches >= 11.8 && kpis.humSalidaPromBatches <= 13.2
        ? "dentro del rango óptimo de conservación industrial (12.0% – 13.0%), garantizando estabilidad de almacenamiento y pilado"
        : kpis.humSalidaPromBatches > 13.2
        ? "ligeramente por encima del objetivo de 13.0%, recomendándose ajustar el tiempo de residencia en secadora en +10 a +15 minutos"
        : "por debajo de 11.8% (sobre-secado leve), recomendándose moderar la temperatura en el último pase de secado";

    return [
      {
        numero: "01",
        titulo: "Diagnóstico de Recepción, Lotes y Balance de Pesos del Periodo",
        resumen: `${kpis.totalLotes} lotes recepcionados (${kpis.pesoTotalLotesTn} TN) • ${kpis.pesoTotalProcesadoLotesTn} TN procesadas (${kpis.pctAvanceProcesado}%)`,
        explicacion: `Durante el periodo evaluado (${periodoTexto}), la planta registró un ingreso total de ${kpis.totalLotes} lotes de materia prima equivalentes a ${kpis.sacosTotalLotes.toLocaleString()} sacos y un peso bruto de recepción de ${kpis.pesoTotalLotesKg.toLocaleString()} kg (${kpis.pesoTotalLotesTn} TN). De este volumen, se han procesado efectivamente ${kpis.pesoTotalProcesadoLotesKg.toLocaleString()} kg (${kpis.pesoTotalProcesadoLotesTn} TN, representando un avance operativo del ${kpis.pctAvanceProcesado}%), quedando un saldo disponible en tolvas/silos de ${kpis.saldoPendienteTotalKg.toLocaleString()} kg (${kpis.saldoPendienteTotalTn} TN) distribuido en ${kpis.lotesPendientes} lote(s) pendientes. ${
          varPrincipal
            ? `La variedad predominante del mes fue ${varPrincipal.variedad} con ${varPrincipal.cantidadLotes} lote(s) y ${varPrincipal.pesoIngresoTn} TN (${varPrincipal.participacionPct}% de participación total).`
            : ""
        }`
      },
      {
        numero: "02",
        titulo: "Análisis del Porcentaje Promedio de Humedad de Ingreso vs. Humedad de Salida",
        resumen: `Humedad Ingreso Promedio: ${kpis.humIngresoPromBatches}% (Lotes: ${kpis.humIngresoPromLotes}% ±${kpis.desvHumedadPromLotes}) → Humedad Salida Promedio: ${kpis.humSalidaPromBatches > 0 ? `${kpis.humSalidaPromBatches}%` : "En proc."}`,
        explicacion: `El porcentaje promedio ponderado de humedad de ingreso en los lotes recepcionados fue de ${kpis.humIngresoPromLotes}% (promedio simple de ${kpis.humIngresoSimpleLotes}%, con rango entre ${kpis.humIngresoMin}% y ${kpis.humIngresoMax}% y una desviación estándar promedio entre las 14 caladas de ±${kpis.desvHumedadPromLotes}%). En los batches ingresados a vaporizado, la humedad promedio de entrada se ubicó en ${kpis.humIngresoPromBatches}%. Tras las etapas de vaporizado, reposo y secado, el porcentaje promedio de humedad de salida alcanzado fue de ${
          kpis.humSalidaPromBatches > 0 ? `${kpis.humSalidaPromBatches}%` : "en registro"
        } (rango ${kpis.humSalidaMin}% – ${kpis.humSalidaMax}%), logrando una extracción hídrica neta promedio (Δ Humedad) de -${kpis.reduccionHumedadProm} puntos porcentuales. El nivel de humedad de salida se encuentra ${evalHumSalida}.`
      },
      {
        numero: "03",
        titulo: "Evaluación de Parámetros Térmicos e Hidrotermales Promedios (Vaporizado, Reposo y Secado)",
        resumen: `Presión Prom: ${kpis.presionPromBar} bar • Vaporizado: ${kpis.tiempoVaporPromMin} min • Reposo: ${kpis.tiempoReposoPromMin} min • Secado: ${kpis.tempSecadoPromC}°C (${kpis.tiempoSecadoPromMin} min)`,
        explicacion: `En los ${kpis.totalBatches} batches gestionados (${kpis.batchesCerrados} cerrados, ${kpis.batchesEnProceso} en proceso y ${kpis.batchesProgramados} programados), el régimen hidrotermal operó con una presión de vapor promedio en autoclave de ${kpis.presionPromBar} bar (rango operativo de ${kpis.presionMinBar} a ${kpis.presionMaxBar} bar), un tiempo de vaporizado promedio de ${kpis.tiempoVaporPromMin} minutos y un tiempo de reposo/temperado promedio de ${kpis.tiempoReposoPromMin} minutos. En el área de secado, la temperatura promedio de trabajo fue de ${kpis.tempSecadoPromC} °C con un tiempo medio de residencia de ${kpis.tiempoSecadoPromMin} minutos. Respecto a la modalidad de proceso registrada en el Control de Vaporizado, ${kpis.batchesUnPase} batch(es) (${kpis.pctUnPase}%) operaron bajo "1 Solo Pase (Húmedo)" y ${kpis.batchesDosPases} batch(es) (${kpis.pctDosPases}%) se procesaron bajo "2 Pases (Seco - Anti - Trizado)" para proteger los lotes con menor humedad inicial o susceptibilidad a fisuras.`
      },
      {
        numero: "04",
        titulo: "Comportamiento de Calidad Físico-Molinería (Quebrado, Tiza, Trizado y Blancura)",
        resumen: `Quebrado: ${kpis.qiIngresoProm}% → ${kpis.qbSalidaProm}% (${kpis.deltaQuebradoProm >= 0 ? "+" : ""}${kpis.deltaQuebradoProm}%) • Tiza: ${kpis.tizaIngresoProm}% → ${kpis.tizaSalidaProm}% • Trizado: ${kpis.trizadoIngresoProm}% → ${kpis.trizadoSalidaProm}%`,
        explicacion: `La gelatinización del almidón durante el vaporizado permitió reducir la tiza total promedio desde ${kpis.tizaIngresoProm}% en recepción hasta ${kpis.tizaSalidaProm}% en salida (variación de ${kpis.deltaTizaProm}%), compactando el endospermo del grano. El grano trizado pasó de un promedio de ${kpis.trizadoIngresoProm}% en ingreso a ${kpis.trizadoSalidaProm}% en salida (${kpis.deltaTrizadoProm >= 0 ? "+" : ""}${kpis.deltaTrizadoProm}%), mientras que el porcentaje de grano quebrado evolucionó desde Q.I ${kpis.qiIngresoProm}% en recepción a Q.B ${kpis.qbSalidaProm}% post-proceso (Δ Quebrado de ${kpis.deltaQuebradoProm >= 0 ? "+" : ""}${kpis.deltaQuebradoProm}%). La blancura promedio varió de ${kpis.blancuraIngresoProm} a ${kpis.blancuraSalidaProm} grados Kett, alcanzando un Índice de Éxito de Proceso (IEP) promedio de ${kpis.iepProm} puntos.`
      },
      {
        numero: "05",
        titulo: "Balance de Masa en Descarga (Sacas Big Bag) y Conclusión de Jefatura",
        resumen: `Ingreso a Batches: ${kpis.pesoTotalBatchesIngresoTn} TN (${kpis.totalSacosBatches} sacos) → Descarga: ${kpis.pesoTotalBatchesSalidaTn} TN (${kpis.totalSacasDescarga} sacas)`,
        explicacion: `El peso total alimentado a los batches fue de ${kpis.pesoTotalBatchesIngresoKg.toLocaleString()} kg (${kpis.pesoTotalBatchesIngresoTn} TN en ${kpis.totalSacosBatches.toLocaleString()} sacos), obteniéndose en la descarga de sacas un peso acumulado de ${kpis.pesoTotalBatchesSalidaKg.toLocaleString()} kg (${kpis.pesoTotalBatchesSalidaTn} TN y ${kpis.totalSacasDescarga} sacas registradas). La diferencia de peso responde de manera coherente a la merma natural por evaporación de humedad (-${kpis.reduccionHumedadProm}% de reducción hídrica hacia la base de 12% de humedad comercial). Se recomienda mantener la asignación de 2 Pases (Seco - Anti - Trizado) en lotes con humedad de recepción inferior a 14.5% y sostener la presión de vapor entre 1.80 y 1.95 bar para maximizar el sellado de centro blanco.`
      }
    ];
  }, [kpis, resumenPorVariedad, periodoTexto]);

  // Exportación a Excel (.xlsx) Multicapa con Parámetros Promedios y Explicación Técnica
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const resumenRows = [
        ["INFORME MENSUAL COMPLETO DE PRODUCCIÓN — PLANTA DE VAPORIZADO Y SECADO ANVAP"],
        ["PERIODO:", periodoTexto, "AUTORIZADO POR:", nombreAutorizador],
        ["FECHA DE EMISIÓN:", new Date().toLocaleString("es-PE"), "CARGO:", "JEFE DE VAPORIZADO"],
        [],
        ["1. INDICADORES GENERALES Y PARÁMETROS PROMEDIOS DEL MES"],
        ["Parámetro / Indicador", "Valor Promedio / Total", "Rango / Detalle Técnico", "Interpretación Operativa"],
        [
          "Total de Lotes Recepcionados",
          `${kpis.totalLotes} lotes`,
          `${kpis.sacosTotalLotes.toLocaleString()} sacos | ${kpis.pesoTotalLotesTn} TN (${kpis.pesoTotalLotesKg.toLocaleString()} kg)`,
          `Procesados: ${kpis.lotesProcesados} | En Proceso: ${kpis.lotesEnProceso} | Pendientes: ${kpis.lotesPendientes} | Observados: ${kpis.lotesObservados}`
        ],
        [
          "Peso Procesado vs Saldo Pendiente",
          `${kpis.pesoTotalProcesadoLotesTn} TN procesadas (${kpis.pctAvanceProcesado}%)`,
          `Procesado: ${kpis.pesoTotalProcesadoLotesKg.toLocaleString()} kg | Saldo: ${kpis.saldoPendienteTotalKg.toLocaleString()} kg (${kpis.saldoPendienteTotalTn} TN)`,
          "Avance físico de transformación de materia prima en el mes"
        ],
        [
          "Total de Batches de Vaporizado",
          `${kpis.totalBatches} batches`,
          `Cerrados: ${kpis.batchesCerrados} | En Proceso: ${kpis.batchesEnProceso} | Programados: ${kpis.batchesProgramados}`,
          `Peso Ingreso Batches: ${kpis.pesoTotalBatchesIngresoTn} TN | Peso Salida Descarga: ${kpis.pesoTotalBatchesSalidaTn} TN (${kpis.totalSacasDescarga} sacas)`
        ],
        [
          "Porcentaje Promedio de Humedad de Ingreso (Lotes MP)",
          `${kpis.humIngresoPromLotes}% (Ponderado)`,
          `Simple: ${kpis.humIngresoSimpleLotes}% | Rango: ${kpis.humIngresoMin}% - ${kpis.humIngresoMax}% | Desv. Prom: ±${kpis.desvHumedadPromLotes}%`,
          "Humedad inicial medida en recepción sobre las 14 caladas por lote"
        ],
        [
          "Porcentaje Promedio de Humedad de Ingreso (Batches)",
          `${kpis.humIngresoPromBatches}%`,
          `Evaluado sobre ${kpis.totalBatches} batches activos/cerrados`,
          "Humedad promedio de alimentación a tolva de carga de autoclave"
        ],
        [
          "Porcentaje Promedio de Humedad de Salida (Post-Secado)",
          kpis.humSalidaPromBatches > 0 ? `${kpis.humSalidaPromBatches}%` : "En proceso",
          `Rango salida: ${kpis.humSalidaMin}% - ${kpis.humSalidaMax}% | Reducción Hídrica Promedio: -${kpis.reduccionHumedadProm}%`,
          "Meta industrial de estabilización: 12.0% - 13.0% de humedad final"
        ],
        [
          "Presión de Vapor Promedio en Autoclave",
          `${kpis.presionPromBar} bar`,
          `Rango operativo: ${kpis.presionMinBar} bar - ${kpis.presionMaxBar} bar`,
          "Presión manométrica de gelatinización hidrotermal"
        ],
        [
          "Tiempo de Vaporizado Promedio",
          `${kpis.tiempoVaporPromMin} min`,
          "Exposición térmica efectiva en autoclave",
          "Garantiza difusión térmica y sellado de grano yesoso"
        ],
        [
          "Tiempo de Reposo / Temperado Promedio",
          `${kpis.tiempoReposoPromMin} min`,
          "Equilibrio higroscópico antes de secado",
          "Evita tensiones internas y fisuras térmicas"
        ],
        [
          "Temperatura y Tiempo Promedio de Secado",
          `${kpis.tempSecadoPromC} °C / ${kpis.tiempoSecadoPromMin} min`,
          "Secado continuo controlado",
          "Extracción gradual de humedad hasta punto de equilibrio"
        ],
        [
          "Distribución por Modalidad de Vaporizado",
          `1 Pase: ${kpis.batchesUnPase} (${kpis.pctUnPase}%) | 2 Pases: ${kpis.batchesDosPases} (${kpis.pctDosPases}%)`,
          "1 Solo Pase (Húmedo) vs 2 Pases (Seco - Anti - Trizado)",
          "Modalidad registrada en el Control de Proceso de Vaporizado"
        ],
        [
          "Evolución de Quebrado Promedio (Q.I → Q.B)",
          `${kpis.qiIngresoProm}% → ${kpis.qbSalidaProm}%`,
          `Δ Variación Quebrado: ${kpis.deltaQuebradoProm >= 0 ? "+" : ""}${kpis.deltaQuebradoProm}%`,
          "Resistencia mecánica del grano durante el pilado"
        ],
        [
          "Reducción de Tiza Total Promedio (Ingreso → Salida)",
          `${kpis.tizaIngresoProm}% → ${kpis.tizaSalidaProm}%`,
          `Δ Reducción Tiza: ${kpis.deltaTizaProm}%`,
          "Efectividad de transluscencia por gelatinización"
        ],
        [
          "Control de Trizado Promedio (Ingreso → Salida)",
          `${kpis.trizadoIngresoProm}% → ${kpis.trizadoSalidaProm}%`,
          `Δ Variación Trizado: ${kpis.deltaTrizadoProm >= 0 ? "+" : ""}${kpis.deltaTrizadoProm}%`,
          "Control de fisuras internas post-secado"
        ],
        [
          "Blancura Promedio (Ingreso → Salida) & Índice IEP",
          `${kpis.blancuraIngresoProm} → ${kpis.blancuraSalidaProm} Kett | IEP: ${kpis.iepProm} pts`,
          `R.I Recepción Prom: ${kpis.riIngresoProm}% | R.B Recepción Prom: ${kpis.rbIngresoProm}%`,
          "Calidad óptica y calificación global de proceso"
        ],
        [],
        ["2. EXPLICACIÓN TÉCNICA INTEGRAL DEL INFORME MENSUAL"],
        ["Capítulo", "Título del Análisis", "Resumen de Indicadores", "Explicación Técnica Detallada"],
        ...capitulosExplicacion.map(cap => [
          `Capítulo ${cap.numero}`,
          cap.titulo,
          cap.resumen,
          cap.explicacion
        ]),
        [],
        ["3. BALANCE DE PRODUCCIÓN POR VARIEDAD DE ARROZ"],
        [
          "Variedad",
          "N° Lotes",
          "N° Batches",
          "Total Sacos",
          "Peso Ingreso (kg)",
          "Peso Ingreso (TN)",
          "Peso Procesado (kg)",
          "Saldo Pendiente (kg)",
          "% Participación",
          "Humedad Ingreso Prom (%)",
          "Humedad Salida Prom (%)",
          "Q.I Ingreso Prom (%)",
          "Q.B Salida Prom (%)"
        ],
        ...resumenPorVariedad.map(v => [
          v.variedad,
          v.cantidadLotes,
          v.cantidadBatches,
          v.sacosIngreso,
          v.pesoIngresoKg,
          v.pesoIngresoTn,
          v.pesoProcesadoKg,
          v.saldoPendienteKg,
          `${v.participacionPct}%`,
          `${v.humIngresoProm}%`,
          v.humSalidaProm > 0 ? `${v.humSalidaProm}%` : "-",
          `${v.qiProm}%`,
          v.qbSalidaProm > 0 ? `${v.qbSalidaProm}%` : "-"
        ]),
        [],
        ["4. BALANCE DE PRODUCCIÓN POR CLIENTE / PRODUCTOR"],
        ["Cliente / Productor", "N° Lotes", "Total Sacos", "Peso Ingreso (kg)", "Peso Ingreso (TN)", "Peso Procesado (kg)", "Variedades"],
        ...resumenPorCliente.map(c => [
          c.cliente,
          c.lotes,
          c.sacos,
          c.pesoIngresoKg,
          c.pesoIngresoTn,
          c.pesoProcesadoKg,
          c.variedades
        ])
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
      XLSX.utils.book_append_sheet(wb, wsResumen, "1_Resumen_Y_Explicacion");

      // Hoja 2: Registro Completo de Batches
      const batchesHeader = [
        "Batch / Correlativo",
        "Fecha",
        "Turno",
        "Equipo",
        "Modalidad de Vaporizado",
        "Cliente",
        "Variedad",
        "Lotes Vinculados",
        "N° Lotes",
        "Sacos Ingreso",
        "Peso Ingreso (kg)",
        "Peso Ingreso (TN)",
        "Sacas Descarga",
        "Peso Salida Descarga (kg)",
        "Peso Salida (TN)",
        "Variación Peso (%)",
        "Humedad Ingreso Prom (%)",
        "Humedad Salida Final (%)",
        "Δ Humedad (%)",
        "Q.I Ingreso (%)",
        "Q.B Salida (%)",
        "Δ Quebrado (%)",
        "Tiza Ingreso (%)",
        "Tiza Salida (%)",
        "Trizado Ingreso (%)",
        "Trizado Salida (%)",
        "Blancura Ingreso",
        "Blancura Salida",
        "Presión Vapor (bar)",
        "Tiempo Vapor (min)",
        "Tiempo Reposo (min)",
        "Temp. Secado (°C)",
        "Tiempo Secado (min)",
        "IEP (pts)",
        "Operador",
        "Estado Batch"
      ];
      const batchesData = batchesFiltrados.map(b => [
        b.correlativo,
        b.fecha,
        b.turno,
        b.equipo,
        b.modalidad,
        b.cliente,
        b.variedad,
        b.lotesCodigos,
        b.cantidadLotes,
        b.sacosIngreso,
        b.pesoIngresoKg,
        b.pesoIngresoTn,
        b.totalSacasSalida,
        b.pesoSalidaKg,
        b.pesoSalidaTn,
        `${b.difPesoPct}%`,
        `${b.humIngreso}%`,
        b.humSalida > 0 ? `${b.humSalida}%` : "-",
        `${b.deltaHumedad}%`,
        `${b.qiIngreso}%`,
        b.qbSalida > 0 ? `${b.qbSalida}%` : "-",
        `${b.deltaQuebrado}%`,
        `${b.tizaIngreso}%`,
        `${b.tizaSalida}%`,
        `${b.trizadoIngreso}%`,
        `${b.trizadoSalida}%`,
        b.blancuraIngreso,
        b.blancuraSalida,
        b.presionBar,
        b.tiempoVaporMin,
        b.tiempoReposoMin,
        b.tempSecadoC,
        b.tiempoSecadoMin,
        b.iepScore,
        b.operador,
        b.estado
      ]);
      const wsBatches = XLSX.utils.aoa_to_sheet([batchesHeader, ...batchesData]);
      XLSX.utils.book_append_sheet(wb, wsBatches, "2_Batches_Produccion");

      // Hoja 3: Registro Completo de Lotes
      const lotesHeader = [
        "Código Lote",
        "Fecha Ingreso",
        "Cliente / Productor",
        "Procedencia / Zona",
        "Variedad",
        "Ubicación (Silo/Tolva)",
        "Sacos Iniciales",
        "Peso Ingreso (kg)",
        "Peso Ingreso (TN)",
        "Peso Procesado (kg)",
        "Peso Procesado (TN)",
        "Saldo Pendiente (kg)",
        "Humedad Ingreso Prom (%)",
        "Desviación Humedad",
        "Humedad Salida (%)",
        "R.I (%)",
        "R.B (%)",
        "Q.I (%)",
        "Q.B (%)",
        "Tiza Total (%)",
        "Trizado (%)",
        "Blancura Pulido",
        "Batch(es) Asignado(s)",
        "Dictamen Calidad",
        "Estado Operativo"
      ];
      const lotesData = lotesFiltrados.map(l => [
        l.loteId,
        l.fechaIngreso,
        l.cliente,
        l.zona,
        l.variedad,
        l.ubicacion,
        l.sacosIngreso,
        l.pesoIngresoKg,
        l.pesoIngresoTn,
        l.pesoProcesadoKg,
        l.pesoProcesadoTn,
        l.saldoPendienteKg,
        `${l.humIngreso}%`,
        l.desvHumedad,
        l.humSalida > 0 ? `${l.humSalida}%` : "-",
        `${l.ri}%`,
        `${l.rb}%`,
        `${l.qi}%`,
        `${l.qb}%`,
        `${l.tt}%`,
        `${l.tz}%`,
        l.blp,
        l.batchesAsignados,
        l.estadoCalidad,
        l.categoriaOperativa
      ]);
      const wsLotes = XLSX.utils.aoa_to_sheet([lotesHeader, ...lotesData]);
      XLSX.utils.book_append_sheet(wb, wsLotes, "3_Lotes_Materia_Prima");

      const fileName = `INFORME_MENSUAL_PRODUCCION_ANVAP_${selectedMes}_${selectedAnio}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setExportToast(`📊 Archivo Excel "${fileName}" descargado con éxito (incluye Parámetros Promedios y Explicación Técnica).`);
      setTimeout(() => setExportToast(null), 5000);
    } catch (err) {
      console.error("Error exportando Excel mensual:", err);
    }
  };

  // Exportación a PDF Oficial (Con Gráficos Vectoriales, Humedades Promedios, Parámetros Promedios y Explicación Completa)
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;

      const drawHeader = (subtituloPagina: string) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 23, "F");
        doc.setFillColor(245, 158, 11);
        doc.rect(0, 23, pageWidth, 1.2, "F");

        doc.setTextColor(251, 191, 36);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.text("ANVAP — PLANTA INDUSTRIAL DE VAPORIZADO Y SECADO", margin, 8.5);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9.5);
        doc.text(
          `INFORME MENSUAL DE PRODUCCIÓN, HUMEDADES, PARÁMETROS PROMEDIOS Y GRÁFICOS (${periodoTexto})`,
          margin,
          14.5
        );

        doc.setTextColor(203, 213, 225);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        doc.text(
          `${subtituloPagina} | Autorizado por: ${nombreAutorizador} (Jefe de Vaporizado) | Emisión: ${new Date().toLocaleString("es-PE")}`,
          margin,
          20
        );
      };

      // ================= PÁGINA 1: KPIs, PARÁMETROS PROMEDIOS Y GRÁFICOS ESTADÍSTICOS =================
      drawHeader("PÁG. 1: PARÁMETROS PROMEDIOS, HUMEDADES DEL MES Y GRÁFICOS COMPARATIVOS");
      let currentY = 28;

      // 1. Tabla de Humedades Promedio y Parámetros Térmicos Promedios del Mes
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            {
              content: "1. CONSOLIDADO DE PORCENTAJES PROMEDIO DE HUMEDAD (INGRESO vs SALIDA), PARÁMETROS TÉRMICOS Y CALIDAD DEL MES",
              colSpan: 6,
              styles: { fillColor: [15, 23, 42], textColor: [251, 191, 36], fontStyle: "bold", halign: "left", fontSize: 7.5 }
            }
          ],
          [
            "BALANCE DE LOTES Y PESOS",
            "% HUMEDAD INGRESO PROM. DEL MES",
            "% HUMEDAD SALIDA PROM. DEL MES",
            "PARÁMETROS TÉRMICOS PROMEDIOS",
            "MODALIDAD DE PROCESO (PASES)",
            "CALIDAD PROMEDIO (INGRESO → SALIDA)"
          ]
        ],
        body: [
          [
            `Total Lotes: ${kpis.totalLotes} (${kpis.sacosTotalLotes.toLocaleString()} sacos)\nIngreso Total: ${kpis.pesoTotalLotesTn} TN (${kpis.pesoTotalLotesKg.toLocaleString()} kg)\nProcesado: ${kpis.pesoTotalProcesadoLotesTn} TN (${kpis.pctAvanceProcesado}%)\nSaldo Pendiente: ${kpis.saldoPendienteTotalTn} TN`,
            `Lotes MP (Pond.): ${kpis.humIngresoPromLotes}%\nLotes MP (Simple): ${kpis.humIngresoSimpleLotes}%\nEn Batches: ${kpis.humIngresoPromBatches}%\nRango: ${kpis.humIngresoMin}% a ${kpis.humIngresoMax}% (±${kpis.desvHumedadPromLotes}%)`,
            `Humedad Salida Prom: ${kpis.humSalidaPromBatches > 0 ? `${kpis.humSalidaPromBatches}%` : "En proc."}\nRango Salida: ${kpis.humSalidaMin}% a ${kpis.humSalidaMax}%\nReducción Hídrica: -${kpis.reduccionHumedadProm}%\nMeta Planta: 12.0% - 13.0%`,
            `Presión Vapor Prom: ${kpis.presionPromBar} bar (${kpis.presionMinBar}-${kpis.presionMaxBar})\nTiempo Vaporizado: ${kpis.tiempoVaporPromMin} min\nTiempo Reposo: ${kpis.tiempoReposoPromMin} min\nSecado: ${kpis.tempSecadoPromC}°C / ${kpis.tiempoSecadoPromMin} min`,
            `Total Batches: ${kpis.totalBatches}\n• 1 Solo Pase (Húmedo): ${kpis.batchesUnPase} (${kpis.pctUnPase}%)\n• 2 Pases (Seco-Anti-Triz): ${kpis.batchesDosPases} (${kpis.pctDosPases}%)\nCerrados: ${kpis.batchesCerrados} | Activos: ${kpis.batchesEnProceso}`,
            `Quebrado: ${kpis.qiIngresoProm}% → ${kpis.qbSalidaProm}% (${kpis.deltaQuebradoProm >= 0 ? "+" : ""}${kpis.deltaQuebradoProm}%)\nTiza: ${kpis.tizaIngresoProm}% → ${kpis.tizaSalidaProm}%\nTrizado: ${kpis.trizadoIngresoProm}% → ${kpis.trizadoSalidaProm}%\nBlancura: ${kpis.blancuraIngresoProm} → ${kpis.blancuraSalidaProm} | IEP: ${kpis.iepProm}`
          ]
        ],
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 6.8, halign: "center" },
        styles: { fontSize: 6.6, cellPadding: 2, halign: "left", textColor: [15, 23, 42] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // 2. GRÁFICOS VECTORIALES DIBUJADOS EN EL PDF (Lado a Lado)
      const chartBoxWidth = (contentWidth - 6) / 2;
      const chartBoxHeight = 64;
      const leftChartX = margin;
      const rightChartX = margin + chartBoxWidth + 6;

      // --- GRÁFICO IZQUIERDO: HUMEDAD DE INGRESO (%) vs HUMEDAD DE SALIDA (%) POR BATCH ---
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(leftChartX, currentY, chartBoxWidth, chartBoxHeight, 2, 2, "FD");

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(leftChartX, currentY, chartBoxWidth, 7, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(56, 189, 248);
      doc.text(
        `GRÁFICO 1: HUMEDAD DE INGRESO (${kpis.humIngresoPromBatches}%) vs SALIDA (${kpis.humSalidaPromBatches}%) POR BATCH`,
        leftChartX + 3,
        currentY + 4.8
      );

      // Leyenda Gráfico 1
      doc.setFillColor(14, 165, 233);
      doc.rect(leftChartX + chartBoxWidth - 54, currentY + 2, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5.8);
      doc.text("Hum. Ingreso", leftChartX + chartBoxWidth - 50, currentY + 4.5);

      doc.setFillColor(16, 185, 129);
      doc.rect(leftChartX + chartBoxWidth - 28, currentY + 2, 3, 3, "F");
      doc.text("Hum. Salida", leftChartX + chartBoxWidth - 24, currentY + 4.5);

      const plot1X = leftChartX + 10;
      const plot1Y = currentY + 12;
      const plot1W = chartBoxWidth - 15;
      const plot1H = chartBoxHeight - 22;
      const maxHumScale = 22;

      // Líneas guía horizontales
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      [0, 5, 10, 12.5, 15, 20].forEach(val => {
        const yLine = plot1Y + plot1H - (val / maxHumScale) * plot1H;
        if (val === 12.5) {
          doc.setDrawColor(245, 158, 11);
          doc.setLineWidth(0.35);
        } else {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.15);
        }
        doc.line(plot1X, yLine, plot1X + plot1W, yLine);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.2);
        doc.setTextColor(100, 116, 139);
        doc.text(`${val}%`, leftChartX + 2, yLine + 1);
      });

      const itemsBatchChart = chartHumedadesPorBatch.slice(0, 8);
      if (itemsBatchChart.length > 0) {
        const slotW = plot1W / itemsBatchChart.length;
        const barW = Math.min(5.5, slotW * 0.34);

        itemsBatchChart.forEach((item, idx) => {
          const centerX = plot1X + idx * slotW + slotW / 2;
          const hIng = Math.min(maxHumScale, Math.max(0, item.humIngreso));
          const hSal = Math.min(maxHumScale, Math.max(0, item.humSalida));

          const ingBarH = (hIng / maxHumScale) * plot1H;
          const salBarH = (hSal / maxHumScale) * plot1H;

          // Barra Ingreso (Celeste)
          doc.setFillColor(14, 165, 233);
          doc.rect(centerX - barW - 0.5, plot1Y + plot1H - ingBarH, barW, ingBarH, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5);
          doc.setTextColor(3, 105, 161);
          doc.text(`${item.humIngreso.toFixed(1)}%`, centerX - barW / 2 - 0.5, plot1Y + plot1H - ingBarH - 1, {
            align: "center"
          });

          // Barra Salida (Esmeralda)
          doc.setFillColor(16, 185, 129);
          doc.rect(centerX + 0.5, plot1Y + plot1H - salBarH, barW, salBarH, "F");
          doc.setTextColor(6, 95, 70);
          doc.text(`${item.humSalida.toFixed(1)}%`, centerX + barW / 2 + 0.5, plot1Y + plot1H - salBarH - 1, {
            align: "center"
          });

          // Etiqueta Batch X
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.5);
          doc.setTextColor(15, 23, 42);
          doc.text(item.batch.substring(0, 8), centerX, plot1Y + plot1H + 4, { align: "center" });
        });
      }

      doc.setFont("helvetica", "italic");
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Explicación: La línea ámbar marca la meta de secado (12.5%). Reducción promedio del mes: -${kpis.reduccionHumedadProm}% de humedad.`,
        leftChartX + 3,
        currentY + chartBoxHeight - 2
      );

      // --- GRÁFICO DERECHO: VOLUMEN DE PRODUCCIÓN (TN INGRESO vs PROCESADO) POR VARIEDAD ---
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(rightChartX, currentY, chartBoxWidth, chartBoxHeight, 2, 2, "FD");

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(rightChartX, currentY, chartBoxWidth, 7, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(251, 191, 36);
      doc.text(
        "GRÁFICO 2: VOLUMEN INGRESADO vs PROCESADO (TN) Y HUMEDAD POR VARIEDAD",
        rightChartX + 3,
        currentY + 4.8
      );

      // Leyenda Gráfico 2
      doc.setFillColor(245, 158, 11);
      doc.rect(rightChartX + chartBoxWidth - 52, currentY + 2, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5.8);
      doc.text("Ingreso TN", rightChartX + chartBoxWidth - 48, currentY + 4.5);

      doc.setFillColor(16, 185, 129);
      doc.rect(rightChartX + chartBoxWidth - 26, currentY + 2, 3, 3, "F");
      doc.text("Procesado TN", rightChartX + chartBoxWidth - 22, currentY + 4.5);

      const plot2X = rightChartX + 10;
      const plot2Y = currentY + 12;
      const plot2W = chartBoxWidth - 15;
      const plot2H = chartBoxHeight - 22;
      const itemsVarChart = resumenPorVariedad.slice(0, 6);
      const maxTnScale = Math.max(10, ...itemsVarChart.map(v => v.pesoIngresoTn * 1.18));

      [0, 0.25, 0.5, 0.75, 1].forEach(ratio => {
        const val = Number((maxTnScale * ratio).toFixed(0));
        const yLine = plot2Y + plot2H - ratio * plot2H;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(plot2X, yLine, plot2X + plot2W, yLine);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.2);
        doc.setTextColor(100, 116, 139);
        doc.text(`${val}t`, rightChartX + 2, yLine + 1);
      });

      if (itemsVarChart.length > 0) {
        const slotW = plot2W / itemsVarChart.length;
        const barW = Math.min(6.5, slotW * 0.34);

        itemsVarChart.forEach((v, idx) => {
          const centerX = plot2X + idx * slotW + slotW / 2;
          const ingH = (v.pesoIngresoTn / maxTnScale) * plot2H;
          const procH = (v.pesoProcesadoTn / maxTnScale) * plot2H;

          // Barra Ingreso TN (Ámbar)
          doc.setFillColor(245, 158, 11);
          doc.rect(centerX - barW - 0.5, plot2Y + plot2H - ingH, barW, ingH, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5);
          doc.setTextColor(180, 83, 9);
          doc.text(`${v.pesoIngresoTn}t`, centerX - barW / 2 - 0.5, plot2Y + plot2H - ingH - 1, { align: "center" });

          // Barra Procesado TN (Esmeralda)
          doc.setFillColor(16, 185, 129);
          doc.rect(centerX + 0.5, plot2Y + plot2H - procH, barW, procH, "F");
          doc.setTextColor(6, 95, 70);
          doc.text(`${v.pesoProcesadoTn}t`, centerX + barW / 2 + 0.5, plot2Y + plot2H - procH - 1, { align: "center" });

          // Etiqueta Variedad
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.3);
          doc.setTextColor(15, 23, 42);
          doc.text(v.variedad.substring(0, 10), centerX, plot2Y + plot2H + 3.8, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(4.8);
          doc.setTextColor(71, 85, 105);
          doc.text(`H:${v.humIngresoProm}%→${v.humSalidaProm > 0 ? `${v.humSalidaProm}%` : "-"}`, centerX, plot2Y + plot2H + 6.8, {
            align: "center"
          });
        });
      }

      currentY += chartBoxHeight + 5;

      // 3. EXPLICACIÓN TÉCNICA INTEGRAL DEL MES EN EL PDF ("EXPLICANDO TODO")
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            {
              content: "2. INTERPRETACIÓN Y EXPLICACIÓN TÉCNICA INTEGRAL DEL PROCESO MENSUAL (HUMEDADES, PARÁMETROS Y CALIDAD)",
              colSpan: 3,
              styles: { fillColor: [6, 95, 70], textColor: [255, 255, 255], fontStyle: "bold", halign: "left", fontSize: 7.5 }
            }
          ],
          ["CAPÍTULO / ÁREA EVALUADA", "INDICADORES PROMEDIOS CLAVE", "EXPLICACIÓN TÉCNICA Y DIAGNÓSTICO OPERATIVO"]
        ],
        body: capitulosExplicacion.map(cap => [
          { content: `${cap.numero}. ${cap.titulo}`, styles: { fontStyle: "bold", cellWidth: 52 } },
          { content: cap.resumen, styles: { fontStyle: "bold", textColor: [30, 58, 138], cellWidth: 64 } },
          { content: cap.explicacion, styles: { halign: "left" } }
        ]),
        theme: "grid",
        headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontSize: 6.6, halign: "center" },
        styles: { fontSize: 6.2, cellPadding: 1.6, valign: "middle", textColor: [15, 23, 42] }
      });

      // ================= NUEVA PÁGINA: BALANCE POR VARIEDAD Y REGISTRO DE BATCHES =================
      doc.addPage();
      drawHeader("PÁG. 2: BALANCE POR VARIEDAD Y REGISTRO DETALLADO DE BATCHES DE VAPORIZADO");
      currentY = 28;

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            {
              content: "3. CONSOLIDADO DE PRODUCCIÓN, HUMEDADES Y CALIDAD POR VARIEDAD DE ARROZ",
              colSpan: 11,
              styles: { fillColor: [30, 41, 59], textColor: [251, 191, 36], fontStyle: "bold", halign: "left" }
            }
          ],
          [
            "VARIEDAD",
            "LOTES",
            "BATCHES",
            "SACOS",
            "PESO INGRESO (KG / TN)",
            "PESO PROCESADO (KG)",
            "SALDO PEND. (KG)",
            "% PART.",
            "HUM. INGRESO PROM",
            "HUM. SALIDA PROM",
            "Q.I ING → Q.B SAL"
          ]
        ],
        body: resumenPorVariedad.map(v => [
          { content: v.variedad, styles: { fontStyle: "bold" } },
          v.cantidadLotes,
          v.cantidadBatches,
          v.sacosIngreso.toLocaleString(),
          `${v.pesoIngresoKg.toLocaleString()} kg (${v.pesoIngresoTn} TN)`,
          `${v.pesoProcesadoKg.toLocaleString()} kg`,
          `${v.saldoPendienteKg.toLocaleString()} kg`,
          `${v.participacionPct}%`,
          `${v.humIngresoProm}%`,
          v.humSalidaProm > 0 ? `${v.humSalidaProm}%` : "-",
          `${v.qiProm}% → ${v.qbSalidaProm > 0 ? `${v.qbSalidaProm}%` : "-"}`
        ]),
        theme: "grid",
        headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontSize: 6.8, halign: "center" },
        styles: { fontSize: 6.6, cellPadding: 1.5, halign: "center", textColor: [15, 23, 42] }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // 4. Tabla Detallada de Batches de Vaporizado
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            {
              content: `4. REGISTRO DETALLADO DE BATCHES DE VAPORIZADO, PARÁMETROS Y HUMEDADES (${batchesFiltrados.length} BATCHES)`,
              colSpan: 16,
              styles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
            }
          ],
          [
            "BATCH",
            "FECHA / TURNO",
            "MODALIDAD",
            "CLIENTE",
            "VARIEDAD",
            "LOTES VINCULADOS",
            "SACOS",
            "PESO ING. (KG)",
            "SACAS / SALIDA",
            "HUM. ING.",
            "HUM. SAL.",
            "PRESIÓN / VAP / REP",
            "Q.I → Q.B",
            "TIZA I→S",
            "TRIZ. I→S",
            "ESTADO"
          ]
        ],
        body: batchesFiltrados.map(b => [
          { content: b.correlativo, styles: { fontStyle: "bold", textColor: [180, 83, 9] } },
          `${b.fecha}\n(${b.turno})`,
          b.modalidad,
          b.cliente,
          { content: b.variedad, styles: { fontStyle: "bold" } },
          b.lotesCodigos,
          b.sacosIngreso.toLocaleString(),
          `${b.pesoIngresoKg.toLocaleString()} kg\n(${b.pesoIngresoTn} TN)`,
          b.totalSacasSalida > 0
            ? `${b.totalSacasSalida} sacas\n${b.pesoSalidaKg.toLocaleString()} kg`
            : `${b.pesoSalidaKg.toLocaleString()} kg`,
          `${b.humIngreso}%`,
          b.humSalida > 0 ? `${b.humSalida}%` : "-",
          `${b.presionBar} bar\n${b.tiempoVaporMin}m / ${b.tiempoReposoMin}m`,
          `${b.qiIngreso}% → ${b.qbSalida > 0 ? `${b.qbSalida}%` : "-"}`,
          `${b.tizaIngreso}% → ${b.tizaSalida}%`,
          `${b.trizadoIngreso}% → ${b.trizadoSalida}%`,
          {
            content: b.estado,
            styles: {
              fontStyle: "bold",
              textColor:
                b.estado === "CERRADO"
                  ? [6, 95, 70]
                  : b.estado === "EN PROCESO"
                  ? [180, 83, 9]
                  : [30, 58, 138]
            }
          }
        ]),
        theme: "grid",
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 6.2, halign: "center" },
        styles: { fontSize: 6.0, cellPadding: 1.2, halign: "center", textColor: [15, 23, 42] }
      });

      // ================= NUEVA PÁGINA: REGISTRO MAESTRO DE TODOS LOS LOTES =================
      doc.addPage();
      drawHeader("PÁG. 3: REGISTRO MAESTRO DE LOTES DE MATERIA PRIMA, HUMEDADES Y PROCESAMIENTO");
      currentY = 28;

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            {
              content: `5. REGISTRO MAESTRO DE LOTES DE MATERIA PRIMA, HUMEDADES DE INGRESO Y SALIDA (${lotesFiltrados.length} LOTES)`,
              colSpan: 15,
              styles: { fillColor: [15, 23, 42], textColor: [56, 189, 248], fontStyle: "bold", halign: "left" }
            }
          ],
          [
            "LOTE ID",
            "F. INGRESO",
            "CLIENTE / PRODUCTOR",
            "VARIEDAD",
            "UBICACIÓN",
            "SACOS",
            "PESO ING. (KG / TN)",
            "PROCESADO (KG)",
            "SALDO (KG)",
            "HUM. ING % (±DESV)",
            "HUM. SAL %",
            "Q.I% / Q.B%",
            "TT% / TZ%",
            "BATCH(ES)",
            "ESTADO"
          ]
        ],
        body: lotesFiltrados.map(l => [
          { content: l.loteId, styles: { fontStyle: "bold" } },
          l.fechaIngreso,
          l.cliente,
          { content: l.variedad, styles: { fontStyle: "bold", textColor: [8, 145, 178] } },
          l.ubicacion,
          l.sacosIngreso.toLocaleString(),
          `${l.pesoIngresoKg.toLocaleString()} kg (${l.pesoIngresoTn} TN)`,
          `${l.pesoProcesadoKg.toLocaleString()} kg`,
          `${l.saldoPendienteKg.toLocaleString()} kg`,
          `${l.humIngreso}% (±${l.desvHumedad})`,
          l.humSalida > 0 ? `${l.humSalida}%` : "-",
          `${l.qi}% / ${l.qb}%`,
          `${l.tt}% / ${l.tz}%`,
          l.batchesAsignados,
          {
            content: l.categoriaOperativa,
            styles: {
              fontStyle: "bold",
              textColor:
                l.categoriaOperativa === "PROCESADO"
                  ? [6, 95, 70]
                  : l.categoriaOperativa === "OBSERVADO"
                  ? [185, 28, 28]
                  : [30, 41, 59]
            }
          }
        ]),
        theme: "grid",
        headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontSize: 6.4, halign: "center" },
        styles: { fontSize: 6.1, cellPadding: 1.2, halign: "center", textColor: [15, 23, 42] }
      });

      // Firma del Jefe de Vaporizado al final del documento
      let finalY = (doc as any).lastAutoTable.finalY + 14;
      if (finalY > 190) {
        doc.addPage();
        finalY = 30;
      }

      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.4);
      doc.line(pageWidth / 2 - 45, finalY, pageWidth / 2 + 45, finalY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(nombreAutorizador.toUpperCase(), pageWidth / 2, finalY + 5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("FIRMA Y SELLO — JEFE DE VAPORIZADO Y PLANTA INDUSTRIAL", pageWidth / 2, finalY + 9.5, { align: "center" });

      const pdfName = `INFORME_MENSUAL_PRODUCCION_${selectedMes}_${selectedAnio}.pdf`;
      doc.save(pdfName);
      setExportToast(`📄 Informe Mensual PDF "${pdfName}" generado con Gráficos, Parámetros Promedios y Explicación Técnica.`);
      setTimeout(() => setExportToast(null), 5000);
    } catch (err) {
      console.error("Error generando PDF mensual:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl max-w-7xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  Informe Mensual Completo de Producción
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  ACCESO EXCLUSIVO: JEFE DE VAPORIZADO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidado integral de lotes, batches, pesos, variedades, humedades de ingreso promedio y salida, rendimientos y estado operativo.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Restricción de Acceso si no es Jefe de Vaporizado */}
        {!isJefeVaporizado ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-5 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 text-[11px] font-black uppercase tracking-wider">
                Módulo Protegido por Rol de Jefatura
              </span>
              <h3 className="text-xl font-black text-white">
                Acceso Exclusivo para el Jefe de Vaporizado
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tu sesión actual está activa como <strong className="text-amber-300">{currentUser.nombre}</strong> ({currentUser.rol}).
                Por disposición de planta, únicamente el <strong>Jefe de Vaporizado</strong> está autorizado para visualizar y exportar el Informe Mensual Completo de Producción.
              </p>
            </div>

            {jefeVaporizadoCreado ? (
              <form onSubmit={handleUnlockWithPin} className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Autorización con PIN — Jefe de Vaporizado</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {jefeVaporizadoCreado.nombre}
                  </span>
                </div>

                {pinError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                    Ingrese el PIN del usuario Jefe de Vaporizado
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value)}
                      placeholder="••••"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Desbloquear Informe</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="w-full bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Sin usuario Jefe de Vaporizado registrado aún</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  El propio <strong>Jefe de Vaporizado</strong> debe crear su usuario con el rol <strong>Jefe de Vaporizado</strong> desde el menú de <strong>Usuarios & Roles</strong> e iniciar sesión con su PIN personal para acceder y exportar este informe.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Barra de Filtros y Botones de Exportación */}
            <div className="px-5 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Selector de Mes */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Mes:</span>
                  <select
                    value={selectedMes}
                    onChange={e => setSelectedMes(e.target.value)}
                    className="bg-slate-950 text-white text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {MESES_NOMBRES.map(m => (
                      <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector de Año */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Año:</span>
                  <select
                    value={selectedAnio}
                    onChange={e => setSelectedAnio(e.target.value)}
                    className="bg-slate-950 text-amber-400 font-mono text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="2026" className="bg-slate-900">2026</option>
                    <option value="2025" className="bg-slate-900">2025</option>
                  </select>
                </div>

                {/* Filtro por Variedad */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Wheat className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Variedad:</span>
                  <select
                    value={filtroVariedad}
                    onChange={e => setFiltroVariedad(e.target.value)}
                    className="bg-slate-950 text-white text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="TODAS" className="bg-slate-900">Todas ({variedadesDisponibles.length})</option>
                    {variedadesDisponibles.map(v => (
                      <option key={v} value={v} className="bg-slate-900">
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Estado de Batch */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Filter className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Batches:</span>
                  <select
                    value={filtroEstadoBatch}
                    onChange={e => setFiltroEstadoBatch(e.target.value)}
                    className="bg-slate-950 text-white text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="TODOS" className="bg-slate-900">Todos los Estados</option>
                    <option value="CERRADO" className="bg-slate-900">Cerrados / Procesados</option>
                    <option value="EN PROCESO" className="bg-slate-900">En Proceso</option>
                    <option value="PROGRAMADO" className="bg-slate-900">Programados</option>
                  </select>
                </div>
              </div>

              {/* Botones de Descarga Oficial */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Excel Completo (.xlsx)</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
                >
                  <FileText className="w-4 h-4" />
                  <span>Descargar Informe PDF Oficial</span>
                </button>
              </div>
            </div>

            {exportToast && (
              <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-950 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-between">
                <span>{exportToast}</span>
                <button onClick={() => setExportToast(null)} className="text-emerald-400 hover:text-white">✕</button>
              </div>
            )}

            {/* Sub-pestañas de vista previa */}
            <div className="px-5 pt-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
              {[
                { id: "resumen", label: "1. Informe General, Gráficos & Explicación", icon: Scale },
                { id: "graficos", label: "2. Gráficos de Humedad & Parámetros", icon: BarChart3 },
                { id: "explicacion", label: "3. Explicación Técnica Detallada", icon: BookOpen },
                { id: "variedades", label: `4. Por Variedad y Cliente (${resumenPorVariedad.length})`, icon: Wheat },
                { id: "batches", label: `5. Registro de Batches (${batchesFiltrados.length})`, icon: Layers },
                { id: "lotes", label: `6. Registro de Lotes (${lotesFiltrados.length})`, icon: Package }
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeTabPreview === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabPreview(tab.id as any)}
                    className={`px-3.5 py-2 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? "bg-slate-800 text-amber-400 border-amber-400"
                        : "text-slate-400 hover:text-white border-transparent hover:bg-slate-850"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cuerpo del Informe */}
            <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-slate-950/60">
              {/* Fila 1: KPIs Principales de Lotes, Pesos y Humedades Promedio del Mes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                    <span>Total Lotes MP</span>
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-white font-mono mt-1">{kpis.totalLotes}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Proc: <strong className="text-emerald-400">{kpis.lotesProcesados}</strong> · Pend: <strong className="text-amber-300">{kpis.lotesPendientes}</strong>
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                    <span>Peso Lotes Ingreso</span>
                    <Scale className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-xl font-black text-cyan-300 font-mono mt-1">{kpis.pesoTotalLotesTn} TN</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {kpis.pesoTotalLotesKg.toLocaleString()} kg ({kpis.sacosTotalLotes.toLocaleString()} s.)
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                    <span>Peso Procesado ({kpis.pctAvanceProcesado}%)</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">{kpis.pesoTotalProcesadoLotesTn} TN</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Saldo: <strong className="text-amber-300">{kpis.saldoPendienteTotalTn} TN</strong>
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                    <span>Total Batches</span>
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-amber-400 font-mono mt-1">{kpis.totalBatches}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Cerrados: <strong className="text-emerald-400">{kpis.batchesCerrados}</strong> · Proc: <strong className="text-orange-400">{kpis.batchesEnProceso}</strong>
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-sky-500/40">
                  <div className="text-[10px] font-bold text-sky-300 uppercase flex items-center justify-between">
                    <span>% Hum. Ingreso Prom</span>
                    <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="text-xl font-black text-sky-300 font-mono mt-1">{kpis.humIngresoPromBatches}%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Lotes: {kpis.humIngresoPromLotes}% (±{kpis.desvHumedadPromLotes}%)
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-xl border border-emerald-500/40">
                  <div className="text-[10px] font-bold text-emerald-300 uppercase flex items-center justify-between">
                    <span>% Hum. Salida Prom</span>
                    <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xl font-black text-emerald-300 font-mono mt-1">
                    {kpis.humSalidaPromBatches > 0 ? `${kpis.humSalidaPromBatches}%` : "En proc."}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Reducción: <strong className="text-amber-300">-{kpis.reduccionHumedadProm}%</strong> (Meta 12.5%)
                  </div>
                </div>
              </div>

              {/* Fila 2: Panel de Parámetros Térmicos e Hidrotermales Promedios del Mes */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Parámetros Operativos, Térmicos y de Calidad Promedios del Mes ({periodoTexto})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    1 Pase (Húmedo): <strong className="text-cyan-300">{kpis.batchesUnPase} ({kpis.pctUnPase}%)</strong> · 2 Pases (Seco-Anti-Trizado): <strong className="text-amber-300">{kpis.batchesDosPases} ({kpis.pctDosPases}%)</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Presión Vapor Prom.</span>
                      <Gauge className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-base font-black text-blue-300 font-mono mt-1">{kpis.presionPromBar} bar</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Rango: {kpis.presionMinBar} – {kpis.presionMaxBar} bar
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Tiempo Vaporizado</span>
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-base font-black text-amber-300 font-mono mt-1">{kpis.tiempoVaporPromMin} min</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Reposo prom: <strong className="text-slate-200">{kpis.tiempoReposoPromMin} min</strong>
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Secado Promedio</span>
                      <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <div className="text-base font-black text-orange-300 font-mono mt-1">{kpis.tempSecadoPromC} °C</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Duración prom: <strong className="text-slate-200">{kpis.tiempoSecadoPromMin} min</strong>
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Quebrado (Q.I → Q.B)</span>
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-base font-black text-white font-mono mt-1">
                      {kpis.qiIngresoProm}% → <span className="text-emerald-300">{kpis.qbSalidaProm}%</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Δ Variación: <strong className={kpis.deltaQuebradoProm <= 2 ? "text-emerald-400" : "text-amber-300"}>{kpis.deltaQuebradoProm >= 0 ? "+" : ""}{kpis.deltaQuebradoProm}%</strong>
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Tiza y Trizado Prom.</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xs font-black text-emerald-300 font-mono mt-1">
                      Tiza: {kpis.tizaIngresoProm}% → {kpis.tizaSalidaProm}%
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Triz: {kpis.trizadoIngresoProm}% → {kpis.trizadoSalidaProm}%
                    </div>
                  </div>

                  <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
                      <span>Blancura & Éxito IEP</span>
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-base font-black text-amber-300 font-mono mt-1">
                      IEP: {kpis.iepProm} pts
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Blancura: {kpis.blancuraIngresoProm} → {kpis.blancuraSalidaProm}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN DE GRÁFICOS ESTADÍSTICOS (Visible en "resumen" y en "graficos") */}
              {(activeTabPreview === "resumen" || activeTabPreview === "graficos") && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Gráfico 1: Humedad Promedio de Ingreso vs Humedad de Salida por Batch */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="text-xs font-black text-sky-300 uppercase flex items-center gap-2">
                            <Droplets className="w-4 h-4 text-sky-400" />
                            Gráfico 1: % Humedad de Ingreso vs. % Humedad de Salida por Batch
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Promedio Ingreso: <strong className="text-sky-300">{kpis.humIngresoPromBatches}%</strong> · Promedio Salida: <strong className="text-emerald-300">{kpis.humSalidaPromBatches}%</strong> · Reducción: <strong className="text-amber-300">-{kpis.reduccionHumedadProm}%</strong>
                          </p>
                        </div>
                      </div>

                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartHumedadesPorBatch} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="batch" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 22]} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderColor: "#334155",
                                borderRadius: "0.75rem",
                                fontSize: "12px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <ReferenceLine y={12.5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Meta 12.5%", fill: "#fbbf24", fontSize: 10 }} />
                            <Bar dataKey="humIngreso" name="Humedad Ingreso (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="humSalida" name="Humedad Salida (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="reduccion" name="Δ Reducción (%)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-sky-300">Explicación del Gráfico:</strong> Muestra la humedad inicial de cada batch al entrar al autoclave (barras celestes, promedio <strong>{kpis.humIngresoPromBatches}%</strong>) frente a la humedad final estabilizada tras el secado (barras verdes, promedio <strong>{kpis.humSalidaPromBatches}%</strong>). La línea punteada ámbar señala la meta comercial de secado (<strong>12.5%</strong>).
                      </div>
                    </div>

                    {/* Gráfico 2: Volumen Ingresado vs Procesado (TN) y Humedad por Variedad */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="text-xs font-black text-amber-300 uppercase flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-amber-400" />
                            Gráfico 2: Toneladas Ingresadas vs. Procesadas y Humedad por Variedad
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Total Ingreso: <strong className="text-amber-300">{kpis.pesoTotalLotesTn} TN</strong> · Total Procesado: <strong className="text-emerald-300">{kpis.pesoTotalProcesadoLotesTn} TN</strong> ({kpis.pctAvanceProcesado}%)
                          </p>
                        </div>
                      </div>

                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={resumenPorVariedad} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="variedad" stroke="#94a3b8" fontSize={11} />
                            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} unit=" TN" />
                            <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" fontSize={11} domain={[0, 22]} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderColor: "#334155",
                                borderRadius: "0.75rem",
                                fontSize: "12px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <Bar yAxisId="left" dataKey="pesoIngresoTn" name="Peso Ingreso (TN)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="pesoProcesadoTn" name="Peso Procesado (TN)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="humIngresoProm" name="Hum. Ingreso Prom (%)" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-amber-300">Explicación del Gráfico:</strong> Compara el tonelaje recepcionado por cada variedad de arroz (barras ámbar) con el tonelaje efectivamente procesado en planta (barras esmeralda), superponiendo la curva del porcentaje promedio de humedad de recepción de cada variedad.
                      </div>
                    </div>
                  </div>

                  {/* Gráfico 3: Evolución de Parámetros de Calidad Promedio (Ingreso vs Salida) */}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-black text-emerald-300 uppercase flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          Gráfico 3: Comparativa Promedio de Calidad y Humedad (Ingreso vs. Salida Post-Proceso)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Evaluación del impacto hidrotermal en Humedad, Quebrado (Q.I → Q.B), Tiza Total y Grano Trizado
                        </p>
                      </div>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartCalidadComparativa} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="indicador" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} unit="%" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderColor: "#334155",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                              color: "#f8fafc"
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar dataKey="ingreso" name="Promedio Ingreso (%)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="salida" name="Promedio Salida (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN DE EXPLICACIÓN TÉCNICA INTEGRAL ("EXPLICANDO TODO") — Visible en "resumen" y "explicacion" */}
              {(activeTabPreview === "resumen" || activeTabPreview === "explicacion") && (
                <div className="bg-slate-900 rounded-2xl border border-amber-500/30 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      Interpretación y Explicación Técnica Detallada del Informe Mensual
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Incluido en exportación PDF y Excel
                    </span>
                  </div>

                  <div className="p-4 grid grid-cols-1 gap-3">
                    {capitulosExplicacion.map(cap => (
                      <div key={cap.numero} className="bg-slate-950/90 rounded-xl border border-slate-800 p-3.5 space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-1.5">
                          <span className="text-xs font-black text-white">
                            {cap.numero}. {cap.titulo}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-amber-300">
                            {cap.resumen}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {cap.explicacion}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TABLA DE VARIEDADES Y VISTA RÁPIDA EN RESUMEN EJECUTIVO */}
              {activeTabPreview === "resumen" && (
                <div className="space-y-6">
                  {/* Tabla Resumen por Variedad */}
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                      <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <Wheat className="w-4 h-4" />
                        Balance Mensual por Variedad (Pesos, Humedades de Ingreso/Salida y Rendimientos)
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">{resumenPorVariedad.length} variedades</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-200 border-collapse">
                        <thead className="bg-slate-950/90 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Variedad</th>
                            <th className="py-2.5 px-3 text-center">Lotes</th>
                            <th className="py-2.5 px-3 text-center">Batches</th>
                            <th className="py-2.5 px-3 text-right">Sacos</th>
                            <th className="py-2.5 px-3 text-right">Peso Ingreso</th>
                            <th className="py-2.5 px-3 text-right">Peso Procesado</th>
                            <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                            <th className="py-2.5 px-3 text-center">% Part.</th>
                            <th className="py-2.5 px-3 text-center bg-sky-950/20 text-sky-300">Hum. Ingreso Prom</th>
                            <th className="py-2.5 px-3 text-center bg-emerald-950/20 text-emerald-300">Hum. Salida Prom</th>
                            <th className="py-2.5 px-3 text-center">Q.I Ingreso → Q.B Salida</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                          {resumenPorVariedad.map(v => (
                            <tr key={v.variedad} className="hover:bg-slate-850/60">
                              <td className="py-2.5 px-3 font-sans font-black text-amber-300">{v.variedad}</td>
                              <td className="py-2.5 px-3 text-center font-bold">{v.cantidadLotes}</td>
                              <td className="py-2.5 px-3 text-center text-cyan-300 font-bold">{v.cantidadBatches}</td>
                              <td className="py-2.5 px-3 text-right">{v.sacosIngreso.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-white">
                                {v.pesoIngresoKg.toLocaleString()} kg <span className="text-slate-400">({v.pesoIngresoTn} TN)</span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                                {v.pesoProcesadoKg.toLocaleString()} kg
                              </td>
                              <td className="py-2.5 px-3 text-right text-amber-300">
                                {v.saldoPendienteKg.toLocaleString()} kg
                              </td>
                              <td className="py-2.5 px-3 text-center">{v.participacionPct}%</td>
                              <td className="py-2.5 px-3 text-center bg-sky-950/10 text-sky-300 font-bold">{v.humIngresoProm}%</td>
                              <td className="py-2.5 px-3 text-center bg-emerald-950/10 text-emerald-300 font-bold">
                                {v.humSalidaProm > 0 ? `${v.humSalidaProm}%` : "-"}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {v.qiProm}% → {v.qbSalidaProm > 0 ? `${v.qbSalidaProm}%` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Vista rápida de Batches y Lotes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-black text-white uppercase flex items-center gap-2">
                          <Layers className="w-4 h-4 text-amber-400" />
                          Resumen de Batches ({batchesFiltrados.length})
                        </h4>
                        <button
                          onClick={() => setActiveTabPreview("batches")}
                          className="text-[11px] text-amber-400 hover:underline font-bold cursor-pointer"
                        >
                          Ver tabla completa →
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800 text-xs">
                        {batchesFiltrados.map(b => (
                          <div key={b.batchId} className="py-2 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-mono font-black text-amber-400">{b.correlativo}</span>
                              <span className="text-slate-300 font-semibold ml-2">{b.variedad}</span>
                              <span className="text-[11px] text-slate-400 ml-2">({b.cliente})</span>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Lotes: {b.lotesCodigos} · {b.modalidad} · {b.presionBar} bar / {b.tiempoVaporMin}m
                              </div>
                            </div>
                            <div className="text-right font-mono text-[11px]">
                              <div className="font-bold text-white">{b.pesoIngresoKg.toLocaleString()} kg</div>
                              <div className="text-sky-300">
                                H: {b.humIngreso}% → <span className="text-emerald-400">{b.humSalida > 0 ? `${b.humSalida}%` : "-"}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-black text-white uppercase flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-400" />
                          Producción por Cliente ({resumenPorCliente.length})
                        </h4>
                        <button
                          onClick={() => setActiveTabPreview("lotes")}
                          className="text-[11px] text-cyan-400 hover:underline font-bold cursor-pointer"
                        >
                          Ver todos los lotes →
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800 text-xs">
                        {resumenPorCliente.map(c => (
                          <div key={c.cliente} className="py-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="font-bold text-white">{c.cliente}</div>
                              <div className="text-[10px] text-slate-400">
                                {c.lotes} lote(s) · {c.sacos.toLocaleString()} sacos · {c.variedades}
                              </div>
                            </div>
                            <div className="text-right font-mono text-[11px]">
                              <div className="font-bold text-cyan-300">{c.pesoIngresoTn} TN</div>
                              <div className="text-[10px] text-emerald-400">Proc: {c.pesoProcesadoTn} TN</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VISTA 2: POR VARIEDAD Y CLIENTE */}
              {activeTabPreview === "variedades" && (
                <div className="space-y-6">
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
                      <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                        Consolidado por Variedad de Arroz
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-200 border-collapse">
                        <thead className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Variedad</th>
                            <th className="py-2.5 px-3 text-center">N° Lotes</th>
                            <th className="py-2.5 px-3 text-center">N° Batches</th>
                            <th className="py-2.5 px-3 text-right">Total Sacos</th>
                            <th className="py-2.5 px-3 text-right">Peso Ingreso (kg / TN)</th>
                            <th className="py-2.5 px-3 text-right">Peso Procesado (kg)</th>
                            <th className="py-2.5 px-3 text-right">Saldo Pendiente (kg)</th>
                            <th className="py-2.5 px-3 text-center">Hum. Ingreso Prom</th>
                            <th className="py-2.5 px-3 text-center">Hum. Salida Prom</th>
                            <th className="py-2.5 px-3 text-center">Q.I Ingreso / Q.B Salida</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                          {resumenPorVariedad.map(v => (
                            <tr key={v.variedad} className="hover:bg-slate-850/60">
                              <td className="py-2.5 px-3 font-sans font-black text-amber-300">{v.variedad}</td>
                              <td className="py-2.5 px-3 text-center">{v.cantidadLotes}</td>
                              <td className="py-2.5 px-3 text-center text-cyan-300">{v.cantidadBatches}</td>
                              <td className="py-2.5 px-3 text-right">{v.sacosIngreso.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-white">
                                {v.pesoIngresoKg.toLocaleString()} kg ({v.pesoIngresoTn} TN)
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-400">{v.pesoProcesadoKg.toLocaleString()} kg</td>
                              <td className="py-2.5 px-3 text-right text-amber-300">{v.saldoPendienteKg.toLocaleString()} kg</td>
                              <td className="py-2.5 px-3 text-center text-sky-300 font-bold">{v.humIngresoProm}%</td>
                              <td className="py-2.5 px-3 text-center text-emerald-300 font-bold">
                                {v.humSalidaProm > 0 ? `${v.humSalidaProm}%` : "-"}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {v.qiProm}% → {v.qbSalidaProm > 0 ? `${v.qbSalidaProm}%` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
                      <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                        Consolidado por Cliente / Productor
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-200 border-collapse">
                        <thead className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Cliente / Agricultor</th>
                            <th className="py-2.5 px-3 text-center">N° Lotes</th>
                            <th className="py-2.5 px-3 text-right">Total Sacos</th>
                            <th className="py-2.5 px-3 text-right">Peso Ingreso (kg / TN)</th>
                            <th className="py-2.5 px-3 text-right">Peso Procesado (kg / TN)</th>
                            <th className="py-2.5 px-3">Variedades Recepcionadas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                          {resumenPorCliente.map(c => (
                            <tr key={c.cliente} className="hover:bg-slate-850/60">
                              <td className="py-2.5 px-3 font-sans font-bold text-white">{c.cliente}</td>
                              <td className="py-2.5 px-3 text-center">{c.lotes}</td>
                              <td className="py-2.5 px-3 text-right">{c.sacos.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                                {c.pesoIngresoKg.toLocaleString()} kg ({c.pesoIngresoTn} TN)
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-400">
                                {c.pesoProcesadoKg.toLocaleString()} kg ({c.pesoProcesadoTn} TN)
                              </td>
                              <td className="py-2.5 px-3 font-sans text-amber-300">{c.variedades}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VISTA 3: TABLA DETALLADA DE BATCHES */}
              {activeTabPreview === "batches" && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      Registro Completo de Batches de Vaporizado y Secado ({batchesFiltrados.length})
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Total Ingreso: {kpis.pesoTotalBatchesIngresoTn} TN | Salida: {kpis.pesoTotalBatchesSalidaTn} TN
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left text-slate-200 border-collapse">
                      <thead className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-2.5">Batch</th>
                          <th className="py-2.5 px-2.5">Fecha / Turno</th>
                          <th className="py-2.5 px-2.5">Modalidad</th>
                          <th className="py-2.5 px-2.5">Cliente</th>
                          <th className="py-2.5 px-2.5">Variedad</th>
                          <th className="py-2.5 px-2.5">Lotes</th>
                          <th className="py-2.5 px-2.5 text-right">Sacos</th>
                          <th className="py-2.5 px-2.5 text-right">Peso Ingreso</th>
                          <th className="py-2.5 px-2.5 text-right">Salida / Sacas</th>
                          <th className="py-2.5 px-2.5 text-center bg-sky-950/20 text-sky-300">Hum. Ing.</th>
                          <th className="py-2.5 px-2.5 text-center bg-emerald-950/20 text-emerald-300">Hum. Sal.</th>
                          <th className="py-2.5 px-2.5 text-center">Q.I → Q.B</th>
                          <th className="py-2.5 px-2.5 text-center">Tiza I→S</th>
                          <th className="py-2.5 px-2.5 text-center">Triz I→S</th>
                          <th className="py-2.5 px-2.5 text-center">Presión / Vap</th>
                          <th className="py-2.5 px-2.5 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {batchesFiltrados.map(b => (
                          <tr key={b.batchId} className="hover:bg-slate-850/60">
                            <td className="py-2 px-2.5 font-black text-amber-400 whitespace-nowrap">{b.correlativo}</td>
                            <td className="py-2 px-2.5 font-sans text-slate-300 whitespace-nowrap">
                              {b.fecha} <span className="text-[10px] text-slate-400">({b.turno})</span>
                            </td>
                            <td className="py-2 px-2.5 font-sans whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                b.modalidad.includes("2")
                                  ? "bg-amber-950/80 text-amber-300 border-amber-600/50"
                                  : "bg-cyan-950/80 text-cyan-300 border-cyan-600/50"
                              }`}>
                                {b.modalidad}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-sans text-slate-200 max-w-[140px] truncate" title={b.cliente}>{b.cliente}</td>
                            <td className="py-2 px-2.5 font-sans font-bold text-amber-300">{b.variedad}</td>
                            <td className="py-2 px-2.5 text-cyan-300 max-w-[140px] truncate" title={b.lotesCodigos}>{b.lotesCodigos}</td>
                            <td className="py-2 px-2.5 text-right">{b.sacosIngreso.toLocaleString()}</td>
                            <td className="py-2 px-2.5 text-right font-bold text-white whitespace-nowrap">
                              {b.pesoIngresoKg.toLocaleString()} kg
                            </td>
                            <td className="py-2 px-2.5 text-right text-emerald-300 whitespace-nowrap">
                              {b.totalSacasSalida > 0 ? `${b.totalSacasSalida} sacas (${b.pesoSalidaKg.toLocaleString()} kg)` : `${b.pesoSalidaKg.toLocaleString()} kg`}
                            </td>
                            <td className="py-2 px-2.5 text-center bg-sky-950/10 text-sky-300 font-bold">{b.humIngreso}%</td>
                            <td className="py-2 px-2.5 text-center bg-emerald-950/10 text-emerald-300 font-bold">
                              {b.humSalida > 0 ? `${b.humSalida}%` : "-"}
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              {b.qiIngreso}% → {b.qbSalida > 0 ? `${b.qbSalida}%` : "-"}
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              {b.tizaIngreso}% → {b.tizaSalida}%
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              {b.trizadoIngreso}% → {b.trizadoSalida}%
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              {b.presionBar} bar / {b.tiempoVaporMin}m
                            </td>
                            <td className="py-2 px-2.5 text-center font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                b.estado === "CERRADO"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60"
                                  : b.estado === "EN PROCESO"
                                  ? "bg-amber-950 text-amber-300 border border-amber-700/60"
                                  : "bg-slate-800 text-slate-300 border border-slate-700"
                              }`}>
                                {b.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VISTA 4: TABLA DETALLADA DE LOTES */}
              {activeTabPreview === "lotes" && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                      Registro Maestro de Lotes de Materia Prima ({lotesFiltrados.length})
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Ingreso: {kpis.pesoTotalLotesTn} TN | Procesado: {kpis.pesoTotalProcesadoLotesTn} TN | Saldo: {kpis.saldoPendienteTotalTn} TN
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left text-slate-200 border-collapse">
                      <thead className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-2.5">Lote ID</th>
                          <th className="py-2.5 px-2.5">Fecha Ingreso</th>
                          <th className="py-2.5 px-2.5">Cliente / Productor</th>
                          <th className="py-2.5 px-2.5">Variedad</th>
                          <th className="py-2.5 px-2.5">Ubicación</th>
                          <th className="py-2.5 px-2.5 text-right">Sacos</th>
                          <th className="py-2.5 px-2.5 text-right">Peso Ingreso</th>
                          <th className="py-2.5 px-2.5 text-right">Peso Procesado</th>
                          <th className="py-2.5 px-2.5 text-right">Saldo Pend.</th>
                          <th className="py-2.5 px-2.5 text-center bg-sky-950/20 text-sky-300">Hum. Ingreso (±Desv)</th>
                          <th className="py-2.5 px-2.5 text-center bg-emerald-950/20 text-emerald-300">Hum. Salida</th>
                          <th className="py-2.5 px-2.5 text-center">Q.I% / Q.B%</th>
                          <th className="py-2.5 px-2.5 text-center">TT% / TZ%</th>
                          <th className="py-2.5 px-2.5">Batch(es)</th>
                          <th className="py-2.5 px-2.5 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {lotesFiltrados.map(l => (
                          <tr key={l.loteId} className="hover:bg-slate-850/60">
                            <td className="py-2 px-2.5 font-black text-white">{l.loteId}</td>
                            <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap">{l.fechaIngreso}</td>
                            <td className="py-2 px-2.5 font-sans text-slate-200 max-w-[150px] truncate" title={l.cliente}>{l.cliente}</td>
                            <td className="py-2 px-2.5 font-sans font-bold text-amber-300">{l.variedad}</td>
                            <td className="py-2 px-2.5 font-sans text-slate-400">{l.ubicacion}</td>
                            <td className="py-2 px-2.5 text-right">{l.sacosIngreso.toLocaleString()}</td>
                            <td className="py-2 px-2.5 text-right font-bold text-white whitespace-nowrap">
                              {l.pesoIngresoKg.toLocaleString()} kg
                            </td>
                            <td className="py-2 px-2.5 text-right text-emerald-400 font-bold whitespace-nowrap">
                              {l.pesoProcesadoKg.toLocaleString()} kg
                            </td>
                            <td className="py-2 px-2.5 text-right text-amber-300 whitespace-nowrap">
                              {l.saldoPendienteKg.toLocaleString()} kg
                            </td>
                            <td className="py-2 px-2.5 text-center bg-sky-950/10 text-sky-300 font-bold whitespace-nowrap">
                              {l.humIngreso}% <span className="text-[10px] text-slate-400 font-normal">(±{l.desvHumedad})</span>
                            </td>
                            <td className="py-2 px-2.5 text-center bg-emerald-950/10 text-emerald-300 font-bold">
                              {l.humSalida > 0 ? `${l.humSalida}%` : "-"}
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              {l.qi}% / {l.qb}%
                            </td>
                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              {l.tt}% / {l.tz}%
                            </td>
                            <td className="py-2 px-2.5 text-amber-300 font-bold">{l.batchesAsignados}</td>
                            <td className="py-2 px-2.5 text-center font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                l.categoriaOperativa === "PROCESADO"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60"
                                  : l.categoriaOperativa === "OBSERVADO"
                                  ? "bg-rose-950 text-rose-300 border border-rose-700/60"
                                  : l.categoriaOperativa === "EN PROCESO" || l.categoriaOperativa === "PROGRAMADO"
                                  ? "bg-amber-950 text-amber-300 border border-amber-700/60"
                                  : "bg-slate-800 text-slate-300 border border-slate-700"
                              }`}>
                                {l.categoriaOperativa}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
