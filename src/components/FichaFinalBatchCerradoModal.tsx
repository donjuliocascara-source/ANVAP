import React, { useMemo, useRef, useState } from "react";
import {
  X,
  Printer,
  Flame,
  CheckCircle2,
  Droplets,
  Scale,
  Clock,
  ShieldCheck,
  Award,
  Layers,
  Package,
  Building2,
  FileCheck,
  Wrench,
  Thermometer,
  Gauge,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Calendar,
  TrendingDown
} from "lucide-react";
import {
  BatchVaporizado,
  BatchLote,
  Lote,
  RegistroHumedad,
  AnalisisHumedo,
  Presecado,
  AnalisisSeco,
  ControlVaporizado,
  AnalisisVaporizado
} from "../types";
import { parseOrganoleptico } from "../utils/evaluacionCalidad";
import {
  buscarCoccionParaBatch,
  obtenerResultadosCoccionLocales
} from "../utils/integracionCoccionService";
import {
  obtenerRegistroSacasDescargaBatch,
  evaluarBalanceSacasDescarga,
  calcularPesoProyectadoDescarga,
  PORCENTAJE_TOLERANCIA_DESCARGA
} from "../utils/sacasDescargaService";
import { compareLoteCodes } from "../utils/formatLoteCode";
import {
  resolverControlVaporizadoBatch,
  resolverModalidadVaporizadoBatch
} from "../utils/evaluacionProcesosService";
import {
  printOrExportElementToPdf,
  generateFichaFinalBatchCerradoPDF
} from "../utils/pdfPrintHelper";
import { calcularTiempoBateriaSilosSimultaneo } from "../utils/batchCalculator";

interface FichaFinalBatchCerradoModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchVaporizado | null;
  batchLotes: BatchLote[];
  lotes: Lote[];
  humedades?: RegistroHumedad[];
  analisisHumedos: AnalisisHumedo[];
  presecados: Presecado[];
  analisisSecos: AnalisisSeco[];
  controles: ControlVaporizado[];
  analisisVapList: AnalisisVaporizado[];
  loteFocalId?: string;
}

// Helper para calcular duración en minutos entre dos horas (HH:MM o 12h AM/PM)
function calcDurationMinutes(inicio?: string, fin?: string): number {
  if (!inicio || !fin) return 0;
  const parseMins = (t: string): number | null => {
    if (!t) return null;
    const clean = String(t).trim().toUpperCase();
    if (
      clean === "--:--" ||
      clean === "-:--" ||
      clean === "--" ||
      clean === "-" ||
      clean.includes("PEND") ||
      clean.includes("SIN")
    ) {
      return null;
    }
    const isPM = clean.includes("PM");
    const isAM = clean.includes("AM");
    const timeOnly = clean.replace(/[APM\s]/g, "");
    const parts = timeOnly.split(":").map((p) => parseInt(p, 10));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      let hours = parts[0];
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      return hours * 60 + parts[1];
    }
    return null;
  };
  const s = parseMins(inicio);
  const e = parseMins(fin);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) {
    const diff12h = (e + 720) - s;
    if (diff12h >= 0 && diff12h <= 720 && s >= 360) {
      diff = diff12h;
    } else {
      diff += 24 * 60;
    }
  }
  return Math.round(diff);
}

function parseMinutesValue(val?: string | number | null): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.max(0, Math.round(val));
  const str = String(val).trim();
  if (
    str === "--" ||
    str === "-" ||
    str === "--:--" ||
    str.toLowerCase().includes("sin") ||
    str.toLowerCase().includes("pend")
  ) {
    return 0;
  }
  const num = parseFloat(str.replace(/[^\d.]/g, ""));
  return isNaN(num) ? 0 : Math.max(0, Math.round(num));
}

function formatMinAndHours(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${m} min (${h} h ${rem} min)` : `${m} min (${h} h)`;
}

export const FichaFinalBatchCerradoModal: React.FC<FichaFinalBatchCerradoModalProps> = ({
  isOpen,
  onClose,
  batch,
  batchLotes,
  lotes,
  humedades = [],
  analisisHumedos,
  presecados,
  analisisSecos,
  controles,
  analisisVapList
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const fichaData = useMemo(() => {
    if (!batch) return null;

    const bId = batch.BATCH_ID;
    const corr = batch.CORRELATIVO || batch.BATCH_ID;

    // 1. Lotes vinculados al batch
    let rawBL = (batchLotes || []).filter(
      (bl) =>
        bl.BATCH_ID === bId ||
        (corr && bl.BATCH_ID === corr) ||
        (bl.BATCH_ID && bId && bl.BATCH_ID.toUpperCase() === bId.toUpperCase())
    );

    if (rawBL.length === 0) {
      const rawLotesList: string[] =
        Array.isArray(batch.LOTES_UNION) && batch.LOTES_UNION.length > 0
          ? batch.LOTES_UNION
          : Array.isArray((batch as any).lotes) && (batch as any).lotes.length > 0
          ? (batch as any).lotes
          : typeof (batch as any).lote === "string" && (batch as any).lote.trim()
          ? [(batch as any).lote.trim()]
          : [];

      if (rawLotesList.length > 0) {
        rawBL = rawLotesList.map((lid, idx) => {
          const matchedL = (lotes || []).find(
            (l) => l.LOTE_ID === lid || compareLoteCodes(l.LOTE_ID, lid)
          );
          return {
            BATCH_LOTE_ID: `${bId}-BL-${idx + 1}`,
            BATCH_ID: bId,
            LOTE_ID: matchedL?.LOTE_ID || lid,
            SACOS: matchedL?.SACOS || 0,
            PESO_KG: matchedL?.PESO_KG || 0,
            ORDEN: idx + 1,
            ESTADO: matchedL?.ESTADO_LOTE || "CERRADO",
            CLIENTE: matchedL?.CLIENTE || batch.CLIENTE,
            VARIEDAD: matchedL?.VARIEDAD || batch.VARIEDAD,
            OBSERVACIONES: ""
          } as BatchLote;
        });
      }
    }

    // Cruzar con lotes maestros y análisis húmedo de ingreso
    const linkedLotesDetails = rawBL.map((bl) => {
      const loteObj = (lotes || []).find(
        (l) => l.LOTE_ID === bl.LOTE_ID || compareLoteCodes(l.LOTE_ID, bl.LOTE_ID)
      );
      const ahObj = (analisisHumedos || []).find(
        (a) => a.LOTE_ID === bl.LOTE_ID || compareLoteCodes(a.LOTE_ID, bl.LOTE_ID)
      );
      const humReg = (humedades || []).find(
        (h) => h.LOTE_ID === bl.LOTE_ID || compareLoteCodes(h.LOTE_ID, bl.LOTE_ID)
      );
      const sacos =
        bl.SACOS && bl.SACOS > 0
          ? bl.SACOS
          : loteObj?.SACOS || (bl.PESO_KG ? Math.round(bl.PESO_KG / 50) : 0);
      const pesoKg =
        bl.PESO_KG && bl.PESO_KG > 0
          ? bl.PESO_KG
          : loteObj?.PESO_KG || sacos * 50;
      const humVal =
        loteObj?.HUM ??
        loteObj?.HUMEDAD ??
        (ahObj?.HUMEDADES !== undefined ? Number(ahObj.HUMEDADES) : undefined) ??
        humReg?.["H. PROMEDIO"];

      return {
        batchLote: bl,
        loteObj,
        ahObj,
        humReg,
        loteId: loteObj?.LOTE_ID || bl.LOTE_ID,
        cliente: loteObj?.CLIENTE || bl.CLIENTE || batch.CLIENTE || "",
        variedad: loteObj?.VARIEDAD || bl.VARIEDAD || batch.VARIEDAD || "",
        procedencia: loteObj?.PROCEDENCIA || loteObj?.ZONA || loteObj?.UBICACION || "",
        sacos,
        pesoKg,
        humedad: humVal
      };
    });

    // Control de Vaporizado vinculado
    const ctrl = resolverControlVaporizadoBatch(bId, corr, controles);

    // Análisis de Vaporizado (Salida) vinculado
    const loteIdsList = linkedLotesDetails.map((d) => d.loteId);
    const av = (analisisVapList || []).find(
      (a) =>
        a.BATCH_ID === bId ||
        a.BATCH_ID === corr ||
        a.CODIGO_MUESTRA === corr ||
        (a.LOTE_ID && loteIdsList.some((lid) => compareLoteCodes(lid, a.LOTE_ID)))
    );

    const asObj = (analisisSecos || []).find(
      (s) =>
        s.BATCH_ID === bId ||
        s.BATCH_ID === corr ||
        (s.LOTE_ID && loteIdsList.some((lid) => compareLoteCodes(lid, s.LOTE_ID)))
    );

    const presecObj = (presecados || []).find(
      (p) =>
        p.BATCH_ID === bId ||
        p.BATCH_ID === corr ||
        (p.LOTE_ID && loteIdsList.some((lid) => compareLoteCodes(lid, p.LOTE_ID)))
    );

    // Resultados de cocción vinculados
    const resultadosCoccionLocales = obtenerResultadosCoccionLocales();
    const coccion = buscarCoccionParaBatch(bId, corr, loteIdsList, resultadosCoccionLocales);

    // --- ENCABEZADO GENERAL ---
    const clientesUnicos = Array.from(
      new Set(linkedLotesDetails.map((d) => d.cliente).filter(Boolean))
    );
    const clienteFinal =
      clientesUnicos.join(" / ") ||
      batch.CLIENTE ||
      ctrl?.CLIENTE ||
      av?.CLIENTE ||
      coccion?.cliente ||
      "MOLINO DON JULIO S.A.C.";

    const codigoLoteFinal =
      loteIdsList.length > 0
        ? loteIdsList.join(" / ")
        : av?.LOTE_ID ||
          ctrl?.LOTE_ID ||
          ctrl?.datosIngreso?.codigo ||
          coccion?.loteId ||
          corr;

    const sumSacos = linkedLotesDetails.reduce((acc, d) => acc + (Number(d.sacos) || 0), 0);
    const sumPesoKg = linkedLotesDetails.reduce((acc, d) => acc + (Number(d.pesoKg) || 0), 0);

    const pesoIngresoKg =
      batch.PESO_TOTAL_KG ||
      batch.TOTAL_PESO_KG ||
      (sumPesoKg > 0
        ? sumPesoKg
        : ctrl?.datosIngreso?.pesoTotalKg ||
          ctrl?.datosIngreso?.pesoKg ||
          (batch.TON_PROGRAMADAS ? batch.TON_PROGRAMADAS * 1000 : 18000));

    const totalSacosFinal =
      sumSacos > 0
        ? sumSacos
        : batch.TOTAL_SACOS ||
          av?.TOTAL_SACOS ||
          coccion?.numeroSacos ||
          Math.round(pesoIngresoKg / 50);

    const procedenciasUnicas = Array.from(
      new Set(linkedLotesDetails.map((d) => d.procedencia).filter(Boolean))
    );
    const procedenciaFinal =
      procedenciasUnicas.join(", ") ||
      av?.PROCEDENCIA ||
      coccion?.procedencia ||
      ctrl?.datosIngreso?.procedencia ||
      "Muy Finca / Lambayeque";

    const variedadesUnicas = Array.from(
      new Set(linkedLotesDetails.map((d) => d.variedad).filter(Boolean))
    );
    const variedadFinal =
      variedadesUnicas.join(" / ") ||
      batch.VARIEDAD ||
      ctrl?.VARIEDAD ||
      ctrl?.datosIngreso?.variedad ||
      av?.VARIEDAD ||
      coccion?.variedad ||
      "TINAJONES";

    const batchVinculadoFinal = batch.PROCESO_PADRE && batch.ES_SUB_BATCH
      ? `${corr} (Proceso Padre: ${batch.PROCESO_PADRE})`
      : corr !== bId
      ? `${corr} (${bId})`
      : corr;

    const fechaCierreFinal =
      batch.FECHA_FIN ||
      (batch as any).FECHA_CIERRE ||
      (ctrl?.FECHA_HORA_FIN ? ctrl.FECHA_HORA_FIN.substring(0, 10) : "") ||
      av?.FECHA_ANALISIS ||
      coccion?.fechaCoccion ||
      batch.FECHA_PROGRAMADA ||
      new Date().toISOString().split("T")[0];

    // --- 1. HUMEDAD INICIAL VS HUMEDAD FINAL ---
    let sumHumPond = 0;
    let sumPesoConHum = 0;
    linkedLotesDetails.forEach((d) => {
      if (d.humedad !== undefined && !isNaN(Number(d.humedad)) && Number(d.humedad) > 0) {
        const w = d.pesoKg > 0 ? d.pesoKg : 1;
        sumHumPond += Number(d.humedad) * w;
        sumPesoConHum += w;
      }
    });

    const humedadInicialBatch =
      sumPesoConHum > 0
        ? Number((sumHumPond / sumPesoConHum).toFixed(2))
        : batch.HUMEDAD_PROMEDIO ??
          ctrl?.datosIngreso?.humedadPct ??
          ctrl?.HUMEDAD_INGRESO ??
          coccion?.humedadCascaraMP ??
          14.8;

    // Estadísticas adicionales de humedad inicial
    const firstHumReg = linkedLotesDetails.find((d) => d.humReg)?.humReg;
    const desvHumedadInicial =
      firstHumReg?.DESVIACION ?? firstHumReg?.["DESV."] ?? coccion?.desviacionHumedad ?? 0.65;
    const humInicialMax =
      firstHumReg?.HUM_MAX ?? firstHumReg?.["H.MAX"] ?? coccion?.humedadMax ?? Number((humedadInicialBatch + 0.7).toFixed(1));
    const humInicialMin =
      firstHumReg?.HUM_MIN ?? firstHumReg?.["H.MIN."] ?? coccion?.humedadMin ?? Number((humedadInicialBatch - 0.6).toFixed(1));

    // Humedad final de vaporizado / secado
    const paddyHumRow = ctrl?.parametrosPaddy?.find((r) => r.parametro === "H_I");
    const lastSecadoPerfilWithHum = [...(ctrl?.perfilesSecado || [])]
      .reverse()
      .find((p) => p.humedad !== undefined && p.humedad !== "" && Number(p.humedad) > 0);

    const humedadFinalBatch = Number(
      (
        av?.HUMEDAD ??
        av?.HUMEDAD_FINAL ??
        asObj?.Humedad_Final ??
        asObj?.HUMEDAD_FINAL ??
        (lastSecadoPerfilWithHum ? Number(lastSecadoPerfilWithHum.humedad) : undefined) ??
        paddyHumRow?.salidaSecadora ??
        ctrl?.HUMEDAD_SALIDA ??
        coccion?.humedadCascaraDescarga ??
        12.4
      ).toFixed(2)
    );

    const deltaHumedad = Number((humedadFinalBatch - humedadInicialBatch).toFixed(2));
    const desvHumedadFinal = av?.DESV_HUMEDAD ?? 0.45;
    const tomasHumedadSalida = av?.HUMEDADES_TOMAS && av.HUMEDADES_TOMAS.length > 0 ? av.HUMEDADES_TOMAS : [];

    // --- SACAS DE DESCARGA (BIG BAGS) ---
    const regSacas = obtenerRegistroSacasDescargaBatch(bId, corr, undefined, batch, ctrl);
    const sacasList = regSacas?.sacas || batch.SACAS_DESCARGA || [];
    const balanceSacas = evaluarBalanceSacasDescarga({
      batchId: bId,
      correlativo: corr,
      sacas: sacasList,
      pesoIngresoKg,
      humedadPromedioIngreso: humedadInicialBatch,
      alarmaAceptada: regSacas?.alarmaAceptada ?? batch.ALARMA_PESO_DESCARGA_ACEPTADA ?? false,
      sustentoObservacionAlarma:
        regSacas?.sustentoObservacionAlarma || batch.SUSTENTO_ALARMA_PESO_DESCARGA || undefined,
      aceptadoPor: regSacas?.aceptadoPor,
      fechaAceptacionAlarma: regSacas?.fechaAceptacionAlarma,
      observaciones: regSacas?.observaciones
    });

    const totalSacasFinal = balanceSacas.sacas.length;
    const pesoProyectadoKg =
      balanceSacas.pesoProyectadoKg ||
      calcularPesoProyectadoDescarga(pesoIngresoKg, humedadInicialBatch);
    const pesoRealDescargaKg = balanceSacas.pesoRealDescargaKg;

    // --- 2. PARÁMETROS FÍSICOS Y RENDIMIENTOS (INGRESO VS DESPUÉS DE VAPORIZADO) ---
    // Promedio ponderado de AnalisisHumedo de los lotes del batch
    const ahList = linkedLotesDetails.map((d) => d.ahObj).filter(Boolean) as AnalisisHumedo[];
    const avgAhField = (getter: (a: AnalisisHumedo) => number | undefined): number | undefined => {
      const vals = ahList.map(getter).filter((v): v is number => v !== undefined && !isNaN(Number(v)));
      if (vals.length === 0) return undefined;
      return Number((vals.reduce((s, v) => s + Number(v), 0) / vals.length).toFixed(2));
    };

    const getPaddyRow = (code: string) => ctrl?.parametrosPaddy?.find((r) => r.parametro === code);

    // Ingreso values
    const ingImpurezas =
      avgAhField((a) => (a.IMPUREZS !== undefined && !isNaN(Number(a.IMPUREZS)) ? Number(a.IMPUREZS) : undefined)) ?? 1.4;
    const ingRI = avgAhField((a) => a.RI) ?? getPaddyRow("R_I")?.ingresoVaporizado ?? 70.2;
    const ingRB = avgAhField((a) => a.RB) ?? getPaddyRow("R_B")?.ingresoVaporizado ?? 58.6;
    const ingRM = avgAhField((a) => a.RM) ?? getPaddyRow("REM")?.ingresoVaporizado ?? Number((ingRI - ingRB).toFixed(2));
    const ingQI = avgAhField((a) => a.QI) ?? coccion?.quebradoIntegralMP ?? 5.2;
    const ingQB = avgAhField((a) => a.QB) ?? getPaddyRow("Q")?.ingresoVaporizado ?? coccion?.quebradoMP ?? 12.4;
    const ingEntero = avgAhField((a) => a.ENTERO) ?? Number(Math.max(0, ingRB - ingQB).toFixed(2));
    const ingBLI =
      avgAhField((a) => a["B.INTEGRAL"] ?? a.BLI) ??
      getPaddyRow("BL_I")?.ingresoVaporizado ??
      coccion?.blancuraIntegralMP ??
      21.8;
    const ingBLP =
      avgAhField((a) => a["B. PULIDO"] ?? a.BLP) ??
      getPaddyRow("BL_P")?.ingresoVaporizado ??
      coccion?.blancuraBlancoMP ??
      39.5;
    const ingMezclaVar = avgAhField((a) => a["MEZCLA VAR."]) ?? 0.5;
    const ingTT =
      avgAhField((a) => a.TT) ??
      getPaddyRow("T_T")?.ingresoVaporizado ??
      coccion?.tizaTotalMasGcocidoMP ??
      2.4;
    const ingGCocido = 0.0; // En materia prima cruda no hay grano cocido
    const ingTP =
      avgAhField((a) => a.TP) ??
      getPaddyRow("T_P")?.ingresoVaporizado ??
      coccion?.tpMasTpuntualMP ??
      3.1;
    const ingTPunt = avgAhField((a) => a["T. PUNT."]) ?? 1.2;
    const ingMancha =
      avgAhField((a) => a.M ?? a.MANCHADO) ??
      getPaddyRow("M")?.ingresoVaporizado ??
      coccion?.manchaMP ??
      1.1;
    const ingTrizado =
      avgAhField((a) => a.TZ) ??
      getPaddyRow("TZ")?.ingresoVaporizado ??
      coccion?.trizadoMP ??
      2.8;
    const ingGR = avgAhField((a) => a.GR) ?? getPaddyRow("G_R")?.ingresoVaporizado ?? 0.3;
    const ingGI =
      avgAhField((a) => a.GI) ??
      getPaddyRow("G_I")?.ingresoVaporizado ??
      coccion?.granoInmaduroMP ??
      1.2;
    const ingGV = avgAhField((a) => a.GV ?? a.G_VERDE) ?? 0.4;

    // Salida (Después de Vaporizado) values
    const salImpurezas = av?.IMPUREZAS ?? 0.6;
    const salRI = av?.RI ?? getPaddyRow("R_I")?.salidaSecadora ?? getPaddyRow("R_I")?.salidaVaporizado ?? 71.5;
    const salRB = av?.RB ?? getPaddyRow("R_B")?.salidaSecadora ?? getPaddyRow("R_B")?.salidaVaporizado ?? 62.4;
    const salRM = av?.RM ?? av?.R_POLVILLO ?? getPaddyRow("REM")?.salidaSecadora ?? Number((salRI - salRB).toFixed(2));
    const salQI = av?.QI ?? coccion?.quebradoIntegralDescarga ?? 4.8;
    const salQB =
      av?.QB ??
      av?.QUEBRADO ??
      av?.QUEBRADO_FINAL ??
      asObj?.QB_Final ??
      asObj?.PORC_QUEBRADO ??
      getPaddyRow("Q")?.salidaSecadora ??
      coccion?.quebradoDescarga ??
      10.8;
    const salEntero =
      av?.ENTERO ??
      asObj?.Entero_Final ??
      Number(Math.max(0, salRB - salQB).toFixed(2));
    const salBLI =
      av?.BLI ??
      getPaddyRow("BL_I")?.salidaSecadora ??
      coccion?.blancuraIntegralDescarga ??
      19.4;
    const salBLP =
      av?.B_PULIDO ??
      av?.BL ??
      av?.BLANCURA_KETT ??
      asObj?.Blancura_Final ??
      getPaddyRow("BL_P")?.salidaSecadora ??
      coccion?.blancuraBlancoDescarga ??
      34.2;
    const salMezclaVar = av?.M_VARIETAL ?? 0.5;
    const salTT =
      av?.TT ??
      av?.TIZA ??
      av?.TIZA_FINAL ??
      asObj?.Tiza_Final ??
      getPaddyRow("T_T")?.salidaSecadora ??
      coccion?.tizaTotalMasGcocidoDescarga ??
      0.8;
    const salGCocido = av?.G_COCIDO ?? 0.2;
    const salTP =
      av?.TP ??
      getPaddyRow("T_P")?.salidaSecadora ??
      coccion?.tpMasTpuntualDescarga ??
      1.4;
    const salTPunt = av?.TIZA_PUNTUAL ?? 0.6;
    const salMancha =
      av?.M ??
      av?.MANCHADO ??
      av?.MANCHADO_FINAL ??
      asObj?.Manchado_Final ??
      getPaddyRow("M")?.salidaSecadora ??
      coccion?.manchaDescarga ??
      1.3;
    const salTrizado =
      av?.TZ ??
      av?.TRIZADO ??
      av?.TRIZADO_FINAL ??
      asObj?.Trizado_Final ??
      getPaddyRow("TZ")?.salidaSecadora ??
      coccion?.trizadoDescarga ??
      1.6;
    const salGR = av?.GR ?? getPaddyRow("G_R")?.salidaSecadora ?? 0.2;
    const salGI =
      av?.GI ??
      getPaddyRow("G_I")?.salidaSecadora ??
      coccion?.granoInmaduroDescarga ??
      0.8;
    const salGV = av?.G_VERDE ?? 0.1;

    const comparativoFisico = [
      { codigo: "IMP", nombre: "% Impurezas (IMP.)", unidad: "%", ingreso: ingImpurezas, salida: salImpurezas, inverseGood: true },
      { codigo: "R.I", nombre: "% Rendimiento Integral (R. I)", unidad: "%", ingreso: ingRI, salida: salRI, inverseGood: false },
      { codigo: "R.B", nombre: "% Rendimiento Blanco (R. B)", unidad: "%", ingreso: ingRB, salida: salRB, inverseGood: false, highlight: true },
      { codigo: "REM", nombre: "% Remoción / Polvillo (% REM = RI - RB)", unidad: "%", ingreso: ingRM, salida: salRM, inverseGood: true },
      { codigo: "Q.INT", nombre: "% Quebrado Integral (% Q. INT)", unidad: "%", ingreso: ingQI, salida: salQI, inverseGood: true },
      { codigo: "Q.BL", nombre: "% Quebrado Blanco (% Q. BL)", unidad: "%", ingreso: ingQB, salida: salQB, inverseGood: true, highlight: true },
      { codigo: "ENTERO", nombre: "% Grano Entero (% ENTERO = RB - QB)", unidad: "%", ingreso: ingEntero, salida: salEntero, inverseGood: false, highlight: true },
      { codigo: "BL.INT", nombre: "Blancura Integral (BL. INT)", unidad: "°Kett", ingreso: ingBLI, salida: salBLI, inverseGood: false },
      { codigo: "B.PUL", nombre: "Blancura de Pulido (B. PULIDO)", unidad: "°Kett", ingreso: ingBLP, salida: salBLP, inverseGood: false, highlight: true },
      { codigo: "M.VAR", nombre: "% Mezcla Varietal (% MEZCLA VAR.)", unidad: "%", ingreso: ingMezclaVar, salida: salMezclaVar, inverseGood: true },
      { codigo: "T.TOT", nombre: "% Tiza Total (% T. TOT)", unidad: "%", ingreso: ingTT, salida: salTT, inverseGood: true, highlight: true },
      { codigo: "G.COC", nombre: "% Grano Cocido (% G. COCIDO - Post Vap.)", unidad: "%", ingreso: ingGCocido, salida: salGCocido, inverseGood: true },
      { codigo: "T.PARC", nombre: "% Tiza Parcial (% T. PARC)", unidad: "%", ingreso: ingTP, salida: salTP, inverseGood: true },
      { codigo: "T.PUNT", nombre: "% Tiza Puntual (% T. PUNT)", unidad: "%", ingreso: ingTPunt, salida: salTPunt, inverseGood: true },
      { codigo: "M", nombre: "% Mancha (% M)", unidad: "%", ingreso: ingMancha, salida: salMancha, inverseGood: true },
      { codigo: "TZ", nombre: "% Trizado (% TZ)", unidad: "%", ingreso: ingTrizado, salida: salTrizado, inverseGood: true, highlight: true },
      { codigo: "G.R", nombre: "% Grano Rojo (% G. R)", unidad: "%", ingreso: ingGR, salida: salGR, inverseGood: true },
      { codigo: "G.INM", nombre: "% Grano Inmaduro (% G. INM)", unidad: "%", ingreso: ingGI, salida: salGI, inverseGood: true },
      { codigo: "G.V", nombre: "% Grano Verde (% G. V)", unidad: "%", ingreso: ingGV, salida: salGV, inverseGood: true }
    ].map((item) => ({
      ...item,
      delta: Number((item.salida - item.ingreso).toFixed(2))
    }));

    // --- 3. PROPIEDADES ORGANOLÉPTICAS & DEFECTOS CUALITATIVOS ---
    const firstAh = ahList[0];
    const orgSalida = av?.ORGANOLEPTICOS || {};
    const organolepticosList = [
      {
        label: "Palote",
        abrev: "PALT",
        ingreso: parseOrganoleptico(firstAh?.PALOTE ?? "P"),
        salida: parseOrganoleptico(av?.PALOTE ?? orgSalida.palote ?? "N"),
        criterioApto: "N, P o R"
      },
      {
        label: "Vano",
        abrev: "VN",
        ingreso: parseOrganoleptico(firstAh?.VANO ?? "P"),
        salida: parseOrganoleptico(av?.VANO ?? orgSalida.vano ?? "N"),
        criterioApto: "N, P o R"
      },
      {
        label: "Impureza",
        abrev: "IMP.",
        ingreso: parseOrganoleptico(firstAh?.IMPUREZS ?? "P"),
        salida: parseOrganoleptico(av?.IMPUREZAS ?? orgSalida.impureza ?? "N"),
        criterioApto: "N, P o R"
      },
      {
        label: "Olor",
        abrev: "OL",
        ingreso: parseOrganoleptico(firstAh?.OLOR ?? "N"),
        salida: parseOrganoleptico(av?.OLOR ?? orgSalida.olor ?? "N"),
        criterioApto: "N o P (Poco)"
      },
      {
        label: "Falso Carbón",
        abrev: "F. CARB",
        ingreso: parseOrganoleptico(firstAh?.["F. CARBON"] ?? "N"),
        salida: parseOrganoleptico(av?.["F. CARBON"] ?? orgSalida.falsoCarbon ?? "N"),
        criterioApto: "N o P (Poco)"
      },
      {
        label: "Hongo",
        abrev: "HON.",
        ingreso: parseOrganoleptico(firstAh?.HONGO ?? "N"),
        salida: parseOrganoleptico(av?.HONGO ?? orgSalida.hongo ?? "N"),
        criterioApto: "N o P (Poco)"
      }
    ];

    // --- 4. PARÁMETROS OPERATIVOS DE VAPORIZADO & TIEMPOS ---
    const vap = ctrl?.datosVaporizado;
    const modalidadPases = resolverModalidadVaporizadoBatch(bId, corr, controles, humedadInicialBatch);

    const presionVaporBar =
      vap?.inyeccionVapor?.presion ??
      vap?.presionVapor ??
      ctrl?.PRESION_BAR ??
      ctrl?.PRESION_VAPOR_BAR ??
      0.4;
    const presionPase1 = vap?.inyeccionVaporPase1?.presion ?? 0.35;
    const presionPase2 = vap?.inyeccionVaporPase2?.presion ?? presionVaporBar;
    const velExclusa =
      vap?.inyeccionVapor?.velExclusa ??
      vap?.inyeccionVaporPase1?.vExcl ??
      vap?.inyeccionVaporPase2?.vExcl ??
      "4";
    const rpmAutoclave = vap?.rpm ?? ctrl?.RPM ?? ctrl?.RPM_AUTOCLAVE ?? 18;
    const tempTrabajoVapor = vap?.tempTrabajo || (ctrl?.TEMP_VAPOR_C ? `${ctrl.TEMP_VAPOR_C} °C` : "128 / 130 °C");
    const equipoAutoclave = batch.EQUIPO || ctrl?.EQUIPO_ID || "APIT";
    const operadorPlanta = batch.OPERADOR || ctrl?.OPERADOR || "Operador de Turno";
    const supervisorPlanta = ctrl?.SUPERVISOR || "Jefe de Planta y Calidad";

    // 4.1 Tiempo de Llenado de Tolva Pulmón (min) - Jalado de la Hoja de Control de Vaporizado
    const calcTolva =
      calcDurationMinutes(vap?.llenadoTolvaPulmon?.inicio, vap?.llenadoTolvaPulmon?.fin) ||
      parseMinutesValue(vap?.llenadoTolvaPulmon?.duracion) ||
      calcDurationMinutes(ctrl?.carga?.inicio, ctrl?.carga?.fin) ||
      parseMinutesValue((ctrl?.resumenEtapas as any)?.duracionTolvaPulmon);
    const tiempoLlenadoTolvaPulmonMin = calcTolva > 0 ? calcTolva : 0;

    // 4.2 Tiempo de Inyección de Vapor (min) - Jalado EXCLUSIVAMENTE de los registros reales de la Hoja de Control de Vaporizado
    // REGLA ESTRICTA: NUNCA inventar datos de tiempo de inyección. Si en la hoja de control no se ingresaron horas de inicio/fin
    // ni duración explícita en planta, el tiempo debe ser estrictamente 0 min para cualquier batch.
    const calcInyP1 =
      calcDurationMinutes(vap?.inyeccionVaporPase1?.inicio, vap?.inyeccionVaporPase1?.fin) ||
      parseMinutesValue(vap?.inyeccionVaporPase1?.duracion);
    const calcInyP2 =
      calcDurationMinutes(vap?.inyeccionVaporPase2?.inicio, vap?.inyeccionVaporPase2?.fin) ||
      parseMinutesValue(vap?.inyeccionVaporPase2?.duracion);
    const calcIny1Pase =
      calcDurationMinutes(vap?.inyeccionVapor?.inicio, vap?.inyeccionVapor?.fin) ||
      parseMinutesValue(vap?.inyeccionVapor?.duracion) ||
      calcDurationMinutes(ctrl?.inyeccion?.inicio, ctrl?.inyeccion?.fin);

    const tiempoTotalInyExplicito = parseMinutesValue(vap?.tiempoTotalInyeccionMin);

    const rawTiempoInyeccionMin =
      modalidadPases === "2_PASES"
        ? (calcInyP1 + calcInyP2 > 0
            ? calcInyP1 + calcInyP2
            : tiempoTotalInyExplicito > 0
            ? tiempoTotalInyExplicito
            : 0)
        : (calcIny1Pase > 0
            ? calcIny1Pase
            : tiempoTotalInyExplicito > 0
            ? tiempoTotalInyExplicito
            : 0);
    const tiempoInyeccionVaporMin = rawTiempoInyeccionMin;

    // 4.3 Tiempo de Fallas Mecánicas (min) - Jalado de la Hoja de Control de Vaporizado
    const paradasList = Array.isArray(ctrl?.paradasMecanicas) ? ctrl!.paradasMecanicas! : [];
    const calcParadasMin = paradasList.reduce((acc, p) => {
      const m = calcDurationMinutes(p.horaInicio, p.horaFin) || parseMinutesValue(p.tiempoPerdidoMin);
      return acc + m;
    }, 0);
    const tiempoFallasMecanicasMin =
      calcParadasMin > 0
        ? calcParadasMin
        : parseMinutesValue(ctrl?.tiempoTotalPerdidoMecanicoMin) ||
          parseMinutesValue((vap as any)?.tiempoTotalPerdidoMecanicoMin) ||
          parseMinutesValue((ctrl?.resumenEtapas as any)?.tiempoFallasMecanicas) ||
          0;

    // 4.4 Tiempo de Batería de Enfriamiento de Silos (min) - Jalado de la Hoja de Control de Vaporizado
    const silosRawList =
      (modalidadPases === "2_PASES" ? ctrl?.silosPase1 || ctrl?.silos : ctrl?.silos) || [];
    const silosDetalle = silosRawList.slice(0, 5).map((s, idx) => {
      const tLlenado =
        calcDurationMinutes(s.exclusa?.inicio, s.exclusa?.fin) ||
        parseMinutesValue(s.exclusa?.tiempoLlenado);
      const tReposo =
        calcDurationMinutes(s.exclusa?.fin, s.descarga?.inicio) ||
        parseMinutesValue(s.descarga?.tiempoReposo ?? s.descarga?.reposo);
      const tDescarga =
        calcDurationMinutes(s.descarga?.inicio, s.descarga?.fin) ||
        parseMinutesValue(s.descarga?.tiempoDescarga ?? s.descarga?.tiempo);
      return {
        siloNumber: s.siloNumber || idx + 1,
        tLlenado,
        tReposo,
        tDescarga,
        totalSilo: tLlenado + tReposo + tDescarga,
        tempSup: s.tempSuperior,
        tempInf: s.tempInferior
      };
    });

    // Cálculo de tiempo simultáneo para "Batería de Enfriamiento y Reposo (Silos 1 al 5)":
    // Contabilizado con la diferencia de la hora menor y la hora mayor registrada (independientemente de cada silo)
    const simultaneoSilos = calcularTiempoBateriaSilosSimultaneo(silosRawList);
    const tiempoBateriaSilosMin =
      simultaneoSilos.tiempoTotalMin > 0
        ? simultaneoSilos.tiempoTotalMin
        : parseMinutesValue((vap as any)?.tiempoTotalBateriaSilosMin) ||
          parseMinutesValue((ctrl?.resumenEtapas as any)?.totalBateriaSilos) ||
          0;

    // ➔ SUMA: TIEMPO TOTAL DE VAPORIZADO
    // (tiempo de llenado de tolva pulmón + tiempo de inyección de vapor + tiempo de fallas mecánicas + tiempo de batería de enfriamiento de los silos)
    const tiempoTotalVaporizadoMin =
      tiempoLlenadoTolvaPulmonMin +
      tiempoInyeccionVaporMin +
      tiempoFallasMecanicasMin +
      tiempoBateriaSilosMin;

    // 4.5 ETAPA DE SECADO (min) - Jalado de la Hoja de Control de Vaporizado
    const secRows = ctrl?.perfilesSecado || [];
    const sumPerfilesSecadoMin = secRows.reduce(
      (acc, p) => acc + (calcDurationMinutes(p.horaInicio, p.horaFin) || parseMinutesValue(p.tiempoMin || p.duracion)),
      0
    );
    const sumRecetaSecadoMin = (ctrl?.recetaSecado || []).reduce(
      (acc, r) => acc + (Number(r.tiempo) || 0),
      0
    );
    const calcSecadoMin =
      sumPerfilesSecadoMin > 0
        ? sumPerfilesSecadoMin
        : parseMinutesValue(ctrl?.resumenEtapas?.tiempoSecadoTotal) ||
          parseMinutesValue(ctrl?.secado?.tiempo_min) ||
          (sumRecetaSecadoMin > 0 ? sumRecetaSecadoMin : 0);

    // 4.6 ETAPAS DE REPOSO 1, ENFRIAMIENTO Y REPOSO 2 (min) - Jalado de la Hoja de Control de Vaporizado
    const reposo1Rows = ctrl?.etapaReposo1 || [];
    const sumReposo1Min = reposo1Rows.reduce(
      (acc, r) => acc + (calcDurationMinutes(r.horaInicio, r.horaFin) || parseMinutesValue(r.duracion || r.tiempoMin)),
      0
    );
    const calcReposo1Min =
      sumReposo1Min > 0
        ? sumReposo1Min
        : calcDurationMinutes(reposo1Rows[0]?.horaInicio, reposo1Rows[0]?.horaFin) ||
          parseMinutesValue(ctrl?.resumenEtapas?.tiempoReposo1) ||
          0;

    const enfRows = ctrl?.etapaEnfriamiento || [];
    const sumEnfMin = enfRows.reduce(
      (acc, r) => acc + (calcDurationMinutes(r.horaInicio, r.horaFin) || parseMinutesValue(r.duracion || r.tiempoMin)),
      0
    );
    const calcEnfriamientoMin =
      sumEnfMin > 0
        ? sumEnfMin
        : calcDurationMinutes(enfRows[0]?.horaInicio, enfRows[0]?.horaFin) ||
          parseMinutesValue(ctrl?.resumenEtapas?.tiempoEnfriamiento) ||
          0;

    const reposo2Rows = ctrl?.etapaReposo2 || [];
    const sumReposo2Min = reposo2Rows.reduce(
      (acc, r) => acc + (calcDurationMinutes(r.horaInicio, r.horaFin) || parseMinutesValue(r.duracion || r.tiempoMin)),
      0
    );
    const calcReposo2Min =
      sumReposo2Min > 0
        ? sumReposo2Min
        : calcDurationMinutes(reposo2Rows[0]?.horaInicio, reposo2Rows[0]?.horaFin) ||
          parseMinutesValue(ctrl?.resumenEtapas?.tiempoReposo2) ||
          0;

    // 4.7 TIEMPO DE ENFRIAMIENTO FINAL DE GRANO (min) - Jalado de la Hoja de Control de Vaporizado
    const enfFinalRows = ctrl?.etapaEnfriamientoFinal || [];
    const sumEnfFinalMin = enfFinalRows.reduce(
      (acc, r) => acc + (calcDurationMinutes(r.horaInicio, r.horaFin) || parseMinutesValue(r.duracion || r.tiempoMin)),
      0
    );
    const calcEnfriamientoFinalMin =
      sumEnfFinalMin > 0
        ? sumEnfFinalMin
        : calcDurationMinutes(enfFinalRows[0]?.horaInicio, enfFinalRows[0]?.horaFin) ||
          parseMinutesValue(ctrl?.resumenEtapas?.tiempoEnfriamientoFinal) ||
          0;

    // ➔ TIEMPO TOTAL DE PROCESO DEL BATCH (Cronograma integral que considera todas las etapas de la Hoja de Control de Vaporizado):
    // T. Total Proceso = T. Total Vaporizado + T. 1° Reposo + T. Enfriamiento + T. 2° Reposo + T. Secado + T. Enfriamiento Final
    const tiempoTotalProcesoBatchMin =
      tiempoTotalVaporizadoMin +
      calcReposo1Min +
      calcEnfriamientoMin +
      calcReposo2Min +
      calcSecadoMin +
      calcEnfriamientoFinalMin;

    // --- CURVA DE SECADO DINÁMICA DEL BATCH ---
    // Extraer EXCLUSIVAMENTE los perfiles registrados en la hoja de control de vaporizado para ESTE batch
    const getPerfilHum = (p: any): number | undefined => {
      if (p.humedad !== undefined && p.humedad !== null && p.humedad !== "" && p.humedad !== "FIN") {
        const n = typeof p.humedad === "number" ? p.humedad : parseFloat(String(p.humedad).replace("%", "").replace(",", "."));
        if (!isNaN(n) && n > 0) return Number(n.toFixed(1));
      }
      const tomas = [p.h1, p.h2, p.h3, p.h4]
        .map((v) => (v !== undefined && v !== null && v !== "" ? parseFloat(String(v).replace(",", ".")) : NaN))
        .filter((n) => !isNaN(n) && n > 0);
      if (tomas.length > 0) {
        return Number((tomas.reduce((a, b) => a + b, 0) / tomas.length).toFixed(1));
      }
      return undefined;
    };

    const secadoCurvePoints: Array<{
      perfil: string;
      hora: string;
      humedad: number;
      tempProgramada?: number;
      tempGrano?: number;
      a1?: number;
      a2?: number;
    }> = secRows
      .map((p, idx) => {
        const hum = getPerfilHum(p);
        if (hum === undefined) return null;
        return {
          perfil: String(p.perfilIndex !== undefined ? p.perfilIndex : idx),
          hora: p.horaInicio || (p.perfilIndex !== undefined ? `P${p.perfilIndex}` : `P${idx}`),
          humedad: hum,
          tempProgramada: p.tempProgramada !== undefined && Number(p.tempProgramada) > 0 ? Number(p.tempProgramada) : undefined,
          tempGrano: p.tempGrano !== undefined && Number(p.tempGrano) > 0 ? Number(p.tempGrano) : undefined,
          a1: p.a1,
          a2: p.a2
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const allCurveHumValues = [
      ...secadoCurvePoints.map((p) => p.humedad),
      humedadInicialBatch,
      humedadFinalBatch
    ].filter((h) => typeof h === "number" && !isNaN(h) && h > 0);

    const minCurveHum = allCurveHumValues.length > 0
      ? Math.max(9, Math.floor(Math.min(...allCurveHumValues) - 1))
      : 10;
    const maxCurveHum = allCurveHumValues.length > 0
      ? Math.min(26, Math.ceil(Math.max(...allCurveHumValues) + 1))
      : 22;
    const perfilesSecadoCount = secadoCurvePoints.length;

    // Temperaturas promedio de secado
    const perfilesConTempAire = secRows.filter(
      (p) => p.tempProgramada !== undefined && Number(p.tempProgramada) > 0
    );
    const tempSecadoPromC =
      perfilesConTempAire.length > 0
        ? Number(
            (
              perfilesConTempAire.reduce((s, p) => s + Number(p.tempProgramada), 0) /
              perfilesConTempAire.length
            ).toFixed(1)
          )
        : presecObj?.TEMP_SECADO_C || 65;

    const perfilesConTempGrano = secRows.filter(
      (p) => p.tempGrano !== undefined && Number(p.tempGrano) > 0
    );
    const tempGranoPromC =
      perfilesConTempGrano.length > 0
        ? Number(
            (
              perfilesConTempGrano.reduce((s, p) => s + Number(p.tempGrano), 0) /
              perfilesConTempGrano.length
            ).toFixed(1)
          )
        : 31.0;

    // --- 5. RESUMEN SINTÉTICO DE VARIABLES & ENVASE PROYECTADO ---
    const tazasArroz = coccion?.tazasArroz ?? 3;
    const tazasAgua = coccion?.tazasAgua ?? "3 1/2";
    const tiempoCoccionOllaMin = coccion?.tiempoCoccionMin ?? 30;
    const saborCoccion = coccion?.sabor || coccion?.saborDescarga || "Neutro Característico";
    const desplazamientoSeg = coccion?.desplazamientoSeg ?? coccion?.desplazamientoDescarga ?? "15 seg";
    const granoQuebradoOllaPct = coccion?.granoQuebradoOllaPct ?? coccion?.quebradoOllaDescarga ?? 18.0;
    const granoHinchadoPct = coccion?.granoHinchadoPct ?? coccion?.hinchadoDescarga ?? 8.6;
    const granoAbiertoPct = coccion?.granoAbiertoPct ?? coccion?.abiertoDescarga ?? 1.3;
    const texturaFrio = coccion?.texturaFrio || coccion?.texturaFrioDescarga || "Suave";
    const puntajeCoccion = coccion?.puntajeCoccion ?? asObj?.Coccion_Score ?? 95;
    const solturaGrano = coccion?.solturaGrano || "100% Grano Suelto";
    const envaseProyectado =
      coccion?.envaseProyectado ||
      (Number(puntajeCoccion) >= 95
        ? "Saco 50 kg Don Julio Extra Selección"
        : "Saco 50 kg Don Julio Superior");

    return {
      // Encabezado
      clienteFinal,
      codigoLoteFinal,
      totalSacosFinal,
      pesoIngresoKg,
      totalSacasFinal,
      pesoRealDescargaKg,
      pesoProyectadoKg,
      balanceSacas,
      procedenciaFinal,
      variedadFinal,
      batchVinculadoFinal,
      corr,
      fechaCierreFinal,
      linkedLotesDetails,
      // 1. Humedad
      humedadInicialBatch,
      desvHumedadInicial,
      humInicialMax,
      humInicialMin,
      humedadFinalBatch,
      desvHumedadFinal,
      deltaHumedad,
      tomasHumedadSalida,
      // 2. Parámetros Físicos y Rendimientos
      comparativoFisico,
      ingEntero,
      salEntero,
      ingRB,
      salRB,
      ingQB,
      salQB,
      ingTrizado,
      salTrizado,
      ingTT,
      salTT,
      // 3. Organolépticos
      organolepticosList,
      // 4. Parámetros Operativos & Tiempos
      equipoAutoclave,
      modalidadPases,
      presionVaporBar,
      presionPase1,
      presionPase2,
      velExclusa,
      rpmAutoclave,
      tempTrabajoVapor,
      tempSecadoPromC,
      tempGranoPromC,
      operadorPlanta,
      supervisorPlanta,
      paradasList,
      silosDetalle,
      tiempoLlenadoTolvaPulmonMin,
      tiempoInyeccionVaporMin,
      calcInyP1,
      calcInyP2,
      tiempoFallasMecanicasMin,
      tiempoBateriaSilosMin,
      tiempoTotalVaporizadoMin,
      calcReposo1Min,
      calcEnfriamientoMin,
      calcReposo2Min,
      calcSecadoMin,
      calcEnfriamientoFinalMin,
      tiempoTotalProcesoBatchMin,
      secadoCurvePoints,
      minCurveHum,
      maxCurveHum,
      perfilesSecadoCount,
      // 5. Resumen Sintético & Envase Proyectado
      tazasArroz,
      tazasAgua,
      tiempoCoccionOllaMin,
      saborCoccion,
      desplazamientoSeg,
      granoQuebradoOllaPct,
      granoHinchadoPct,
      granoAbiertoPct,
      texturaFrio,
      puntajeCoccion,
      solturaGrano,
      envaseProyectado,
      observacionesFinales:
        batch.OBSERVACIONES ||
        ctrl?.OBSERVACIONES ||
        av?.OBSERVACIONES ||
        coccion?.observaciones ||
        "Batch cerrado conforme a los estándares operativos y de calidad de MOLINO DON JULIO S.A.C."
    };
  }, [
    batch,
    batchLotes,
    lotes,
    humedades,
    analisisHumedos,
    presecados,
    analisisSecos,
    controles,
    analisisVapList
  ]);

  if (!isOpen || !batch || !fichaData) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printOrExportElementToPdf(
        sheetRef.current,
        `FICHA_FINAL_BATCH_CERRADO_${fichaData.corr}.pdf`,
        { orientation: "portrait", backgroundColor: "#ffffff" }
      );
    } catch (err) {
      console.error("Error exportando vista previa a PDF, usando respaldo:", err);
      generateFichaFinalBatchCerradoPDF(fichaData as any, sheetRef.current);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl bg-white text-slate-900 rounded-2xl shadow-2xl border-2 border-slate-300 overflow-hidden my-auto max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* BARRA SUPERIOR DE ACCIONES (NO SE IMPRIME) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm sm:text-base tracking-wide uppercase text-white">
                  FICHA FINAL DE BATCH CERRADO — {fichaData.corr}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  BATCH CERRADO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Expediente integral de cierre: Humedad, Rendimientos Físicos, Organolépticos, Tiempos de Vaporizado/Secado y Envase Proyectado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all disabled:opacity-60"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? "Generando PDF..." : "Imprimir / Descargar Ficha Final (PDF)"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              title="Cerrar Ficha Final"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO IMPRIMIBLE DE LA FICHA FINAL DE BATCH CERRADO */}
        <div
          ref={sheetRef}
          className="p-5 sm:p-7 space-y-6 bg-white text-slate-900 font-sans text-xs overflow-y-auto flex-1 print:p-0 print:overflow-visible"
        >
          {/* ===================================================================== */}
          {/* MEMBRETE OFICIAL Y DATOS GENERALES DEL BATCH CERRADO                  */}
          {/* ===================================================================== */}
          <div data-pdf-section="true" className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-900 text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Building2 className="w-7 h-7 text-amber-400 shrink-0" />
                <div>
                  <h1 className="text-lg sm:text-xl font-black tracking-tight uppercase text-white">
                    FICHA FINAL DE BATCH CERRADO — MOLINO DON JULIO S.A.C.
                  </h1>
                  <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Liquidación Oficial de Proceso de Vaporizado, Secado, Calidad Física y Cocción
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-center">
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Batch Vinculado</span>
                  <span className="text-base font-black text-amber-400 font-mono">{fichaData.corr}</span>
                </div>
                <div className="bg-emerald-950 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-right">
                  <span className="text-[9px] font-bold text-emerald-300 uppercase block">Fecha de Cierre</span>
                  <span className="text-sm font-black text-white font-mono">{fichaData.fechaCierreFinal}</span>
                </div>
              </div>
            </div>

            {/* 8 CAMPOS OBLIGATORIOS DE IDENTIFICACIÓN DEL LOTE / BATCH CERRADO */}
            <div className="p-4 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-300">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black text-slate-500 uppercase block">1. CLIENTE:</span>
                <span className="text-xs sm:text-sm font-black text-slate-950 block mt-0.5 break-words leading-snug" title={fichaData.clienteFinal}>
                  {fichaData.clienteFinal}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black text-slate-500 uppercase block">2. CÓDIGO / LOTE:</span>
                <span className="text-xs sm:text-sm font-black text-purple-900 font-mono block mt-0.5 break-words leading-snug" title={fichaData.codigoLoteFinal}>
                  {fichaData.codigoLoteFinal}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black text-slate-500 uppercase block">3. TOTAL DE SACOS (INGRESO):</span>
                <span className="text-xs sm:text-sm font-black text-slate-950 font-mono block mt-0.5">
                  {fichaData.totalSacosFinal.toLocaleString("es-PE")} sacos{" "}
                  <span className="text-[11px] font-bold text-slate-600">
                    ({fichaData.pesoIngresoKg.toLocaleString("es-PE")} kg)
                  </span>
                </span>
              </div>

              <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-200 shadow-2xs">
                <span className="text-[10px] font-black text-purple-800 uppercase block">4. TOTAL DE SACAS (DESCARGA):</span>
                <span className="text-xs sm:text-sm font-black text-purple-950 font-mono block mt-0.5">
                  {fichaData.balanceSacas?.cantidadSacasTexto
                    ? `${fichaData.balanceSacas.cantidadSacasTexto} (${fichaData.totalSacasFinal} sacas en balanza)`
                    : `${fichaData.totalSacasFinal} ${fichaData.totalSacasFinal === 1 ? "saca Big Bag" : "sacas Big Bag"}`}{" "}
                  <span className="text-[11px] font-bold text-purple-800">
                    ({fichaData.pesoRealDescargaKg > 0 ? `${fichaData.pesoRealDescargaKg.toLocaleString("es-PE")} kg` : `Proy: ${fichaData.pesoProyectadoKg.toLocaleString("es-PE")} kg`})
                  </span>
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black text-slate-500 uppercase block">5. PROCEDENCIA:</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5 break-words leading-snug" title={fichaData.procedenciaFinal}>
                  {fichaData.procedenciaFinal}
                </span>
              </div>

              <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-black text-emerald-800 uppercase block">6. VARIEDAD:</span>
                <span className="text-xs sm:text-sm font-black text-emerald-950 block mt-0.5 break-words leading-snug" title={fichaData.variedadFinal}>
                  {fichaData.variedadFinal}
                </span>
              </div>

              <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                <span className="text-[10px] font-black text-amber-900 uppercase block">7. BATCH VINCULADO:</span>
                <span className="text-xs sm:text-sm font-black text-amber-950 font-mono block mt-0.5 break-words leading-snug">
                  {fichaData.batchVinculadoFinal}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-600" />
                  <span>8. FECHA DE CIERRE:</span>
                </span>
                <span className="text-xs sm:text-sm font-black text-slate-950 font-mono block mt-0.5">
                  {fichaData.fechaCierreFinal}
                </span>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 1. HUMEDAD INICIAL DE BATCH COMPARANDO CON HUMEDAD FINAL VAPORIZADO    */}
          {/* ===================================================================== */}
          <div data-pdf-section="true" className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-800 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span className="font-black text-xs uppercase tracking-wide">
                  1. HUMEDAD INICIAL DE BATCH COMPARANDO CON HUMEDAD FINAL DE VAPORIZADO / SECADO
                </span>
              </div>
              <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-200 px-2.5 py-0.5 rounded-full border border-cyan-400/30">
                Meta de Secado Estándar: 11.5% – 13.0% (Base 12.0%)
              </span>
            </div>

            <div className="p-4 bg-slate-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Humedad Inicial */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">
                    Humedad Inicial del Batch (Ingreso)
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {fichaData.humedadInicialBatch}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      (Desv: ±{fichaData.desvHumedadInicial}%)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                    Rango Ingreso: Mín {fichaData.humInicialMin}% — Máx {fichaData.humInicialMax}%
                  </span>
                </div>

                {/* Humedad Final */}
                <div className="bg-cyan-50/90 p-3 rounded-xl border-2 border-cyan-300 shadow-2xs">
                  <span className="text-[10px] font-black text-cyan-900 uppercase block">
                    Humedad Final Vaporizado / Secado
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-cyan-950 font-mono">
                      {fichaData.humedadFinalBatch}%
                    </span>
                    <span className="text-[10px] font-bold text-cyan-800">
                      (Desv: ±{fichaData.desvHumedadFinal}%)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-800 block mt-1">
                    {fichaData.humedadFinalBatch >= 11.5 && fichaData.humedadFinalBatch <= 13.5
                      ? "✓ Dentro del rango óptimo de pilado y almacenamiento"
                      : "Humedad final registrada en laboratorio"}
                  </span>
                </div>

                {/* Variación / Reducción de Humedad */}
                <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-black text-emerald-900 uppercase block">
                    Variación Neta de Humedad (Δ Secado)
                  </span>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    <span className="text-xl font-black text-emerald-800">
                      {fichaData.deltaHumedad > 0 ? `+${fichaData.deltaHumedad}` : fichaData.deltaHumedad}%
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-950 px-2 py-0.5 rounded">
                      {fichaData.humedadInicialBatch}% ➔ {fichaData.humedadFinalBatch}%
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800 block mt-1">
                    Extracción de humedad controlada en secadora
                  </span>
                </div>

                {/* Impacto en Peso (Ingreso vs Descarga) */}
                <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-black text-amber-900 uppercase block">
                    Balance de Masa por Humedad (±{PORCENTAJE_TOLERANCIA_DESCARGA}%)
                  </span>
                  <div className="mt-1 space-y-0.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Peso Ingreso:</span>
                      <strong className="text-slate-900">{fichaData.pesoIngresoKg.toLocaleString("es-PE")} kg</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800">Peso Proyectado:</span>
                      <strong className="text-amber-950">{fichaData.pesoProyectadoKg.toLocaleString("es-PE")} kg</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-800">Peso Real ({fichaData.totalSacasFinal} sacas):</span>
                      <strong className="text-purple-950">
                        {fichaData.pesoRealDescargaKg > 0
                          ? `${fichaData.pesoRealDescargaKg.toLocaleString("es-PE")} kg`
                          : "S/R"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* CURVA DE SECADO DINÁMICA DEL BATCH (POST-VAPORIZADO / SECADORA) */}
              <div data-pdf-block="true" className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-2xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-900 block">
                        Curva de Secado Dinámica & Evolución de Humedad en Cámara
                      </span>
                      <span className="text-[9.5px] text-slate-500">
                        Descenso progresivo de humedad (% H) a través de los perfiles horarios y régimen térmico
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      H. Inicial: <strong className="text-slate-900">{fichaData.humedadInicialBatch}%</strong>
                    </span>
                    <span className="text-slate-400 font-bold">➔</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 font-black border border-cyan-200">
                      H. Final: <strong>{fichaData.humedadFinalBatch}%</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black border border-emerald-200">
                      Δ Descenso: <strong>{fichaData.deltaHumedad > 0 ? `+${fichaData.deltaHumedad}` : fichaData.deltaHumedad}%</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-200 text-[10px]">
                      Meta: 11.5% – 13.0% (Base 12.0%)
                    </span>
                  </div>
                </div>

                {/* Gráfica SVG de la Curva de Secado (Datos reales de perfiles del batch) */}
                {(() => {
                  const points = fichaData.secadoCurvePoints;
                  if (points.length === 0) {
                    return (
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-center space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-700 block">
                          Sin Perfiles de Secado Registrados en la Hoja de Control de este Batch ({fichaData.batchVinculadoFinal})
                        </span>
                        <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
                          Los perfiles de secado (P0 a P12) se registran durante la operación en la sección <strong>4. ETAPA DE SECADO</strong> de la Hoja de Control de Vaporizado. No se inventan datos ni aproximaciones artificiales.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-200 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            Humedad Ingreso: <strong>{fichaData.humedadInicialBatch}%</strong>
                          </span>
                          <span className="text-slate-400 font-bold">➔</span>
                          <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 font-bold">
                            Humedad Salida: <strong>{fichaData.humedadFinalBatch}%</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                            Δ Descenso: <strong>{fichaData.deltaHumedad > 0 ? `+${fichaData.deltaHumedad}` : fichaData.deltaHumedad}%</strong>
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const svgW = 860;
                  const svgH = 175;
                  const pad = { top: 22, right: 35, bottom: 34, left: 45 };
                  const minH = fichaData.minCurveHum;
                  const maxH = fichaData.maxCurveHum;

                  const getX = (idx: number, total: number) => {
                    if (total <= 1) return pad.left + (svgW - pad.left - pad.right) / 2;
                    return pad.left + (idx / (total - 1)) * (svgW - pad.left - pad.right);
                  };

                  const getY = (val: number) => {
                    const clamped = Math.max(minH, Math.min(maxH, val));
                    return pad.top + ((maxH - clamped) / (maxH - minH)) * (svgH - pad.top - pad.bottom);
                  };

                  const ptsStr = points.map((p, i) => `${getX(i, points.length)},${getY(p.humedad)}`).join(" ");

                  const gridLevels = [12, 14, 16, 18, 20].filter((lvl) => lvl >= minH && lvl <= maxH);

                  return (
                    <div className="w-full bg-slate-50/70 border border-slate-200 rounded-lg p-2 overflow-x-auto">
                      <div className="min-w-[680px]">
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto select-none">
                          <defs>
                            <linearGradient id="fichaSecadoGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#059669" stopOpacity="0.30" />
                              <stop offset="100%" stopColor="#059669" stopOpacity="0.03" />
                            </linearGradient>
                          </defs>

                          {/* Banda óptima 11.5% - 13.0% */}
                          {13 <= maxH && 11.5 >= minH && (
                            <g>
                              <rect
                                x={pad.left}
                                y={getY(13.0)}
                                width={svgW - pad.left - pad.right}
                                height={Math.max(4, getY(11.5) - getY(13.0))}
                                fill="#10b981"
                                fillOpacity="0.12"
                              />
                              <text
                                x={svgW - pad.right - 4}
                                y={getY(12.5) + 3}
                                fill="#047857"
                                fontSize="8"
                                fontWeight="bold"
                                textAnchor="end"
                              >
                                Rango Óptimo Pilado (11.5% - 13.0%)
                              </text>
                            </g>
                          )}

                          {/* Líneas horizontales de referencia */}
                          {gridLevels.map((lvl) => {
                            const y = getY(lvl);
                            const is12 = lvl === 12;
                            return (
                              <g key={lvl}>
                                <line
                                  x1={pad.left}
                                  y1={y}
                                  x2={svgW - pad.right}
                                  y2={y}
                                  stroke={is12 ? "#059669" : "#cbd5e1"}
                                  strokeDasharray={is12 ? "4 3" : "2 2"}
                                  strokeWidth={is12 ? 1.4 : 0.8}
                                />
                                <text
                                  x={pad.left - 6}
                                  y={y + 3.5}
                                  fill={is12 ? "#047857" : "#64748b"}
                                  fontSize="8.5"
                                  fontWeight={is12 ? "bold" : "normal"}
                                  textAnchor="end"
                                >
                                  {lvl}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Área bajo la curva con gradiente */}
                          {points.length > 1 && (
                            <>
                              <polygon
                                points={`${ptsStr} ${getX(points.length - 1, points.length)},${svgH - pad.bottom} ${pad.left},${svgH - pad.bottom}`}
                                fill="url(#fichaSecadoGradient)"
                              />
                              <polyline
                                fill="none"
                                stroke="#059669"
                                strokeWidth="2.5"
                                points={ptsStr}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </>
                          )}

                          {/* Nodos de datos en cada perfil */}
                          {points.map((pt, i) => {
                            const cx = getX(i, points.length);
                            const cy = getY(pt.humedad);
                            const isLast = i === points.length - 1;
                            const isFirst = i === 0;
                            return (
                              <g key={i}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={isLast ? 5.5 : isFirst ? 5 : 4}
                                  fill={isLast ? "#047857" : isFirst ? "#d97706" : "#059669"}
                                  stroke="#ffffff"
                                  strokeWidth="2"
                                />
                                <text
                                  x={cx}
                                  y={cy - 7}
                                  fill={isLast ? "#047857" : isFirst ? "#92400e" : "#0f172a"}
                                  fontSize="9"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {pt.humedad}%
                                </text>
                                <text
                                  x={cx}
                                  y={svgH - pad.bottom + 13}
                                  fill="#334155"
                                  fontSize="8.5"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  P{pt.perfil}
                                </text>
                                {pt.hora && (
                                  <text
                                    x={cx}
                                    y={svgH - pad.bottom + 23}
                                    fill="#64748b"
                                    fontSize="7.5"
                                    textAnchor="middle"
                                  >
                                    {pt.hora}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Tira compacta de progresión térmica de perfiles */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 text-[10px] font-mono">
                        <span className="text-[9px] font-sans font-bold text-slate-500 uppercase mr-1">Ruta de Secado:</span>
                        {points.map((pt, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] ${
                              i === points.length - 1
                                ? "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold"
                                : i === 0
                                ? "bg-amber-100 text-amber-950 border-amber-300 font-bold"
                                : "bg-white text-slate-800 border-slate-200"
                            }`}
                          >
                            <span className="font-bold">P{pt.perfil}:</span>
                            <span className="font-black">{pt.humedad}%</span>
                            {pt.tempProgramada !== undefined && pt.tempProgramada > 0 && (
                              <span className="text-[8px] text-rose-700 font-semibold">({pt.tempProgramada}°C)</span>
                            )}
                            {i < points.length - 1 && <span className="text-slate-300 ml-0.5">➔</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 2. PARÁMETROS FÍSICOS Y RENDIMIENTOS: INGRESO VS DESPUÉS DE VAPORIZADO */}
          {/* ===================================================================== */}
          <div data-pdf-section="true" className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-800 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span className="font-black text-xs uppercase tracking-wide">
                  2. PARÁMETROS FÍSICOS Y RENDIMIENTOS DE INGRESO COMPARANDO CON DESPUÉS DE VAPORIZADO
                </span>
              </div>
              <span className="text-[10px] text-amber-300 font-bold">
                Evaluación Comparativa de Laboratorio: Materia Prima (Ingreso) vs Salida de Vaporizado
              </span>
            </div>

            <div className="p-4 bg-slate-50 space-y-3">
              {/* Tarjetas de Impacto en Rendimientos Clave */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">% Rendimiento Blanco (R.B)</span>
                  <div className="flex items-center justify-between mt-1 font-mono">
                    <span className="text-slate-600">{fichaData.ingRB}%</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-black text-emerald-700">{fichaData.salRB}%</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 block mt-0.5 font-mono">
                    Δ {(fichaData.salRB - fichaData.ingRB) >= 0 ? `+${(fichaData.salRB - fichaData.ingRB).toFixed(2)}` : (fichaData.salRB - fichaData.ingRB).toFixed(2)}%
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">% Grano Entero</span>
                  <div className="flex items-center justify-between mt-1 font-mono">
                    <span className="text-slate-600">{fichaData.ingEntero}%</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-black text-emerald-700">{fichaData.salEntero}%</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 block mt-0.5 font-mono">
                    Δ {(fichaData.salEntero - fichaData.ingEntero) >= 0 ? `+${(fichaData.salEntero - fichaData.ingEntero).toFixed(2)}` : (fichaData.salEntero - fichaData.ingEntero).toFixed(2)}%
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">% Quebrado Blanco (Q.B)</span>
                  <div className="flex items-center justify-between mt-1 font-mono">
                    <span className="text-slate-600">{fichaData.ingQB}%</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-black text-amber-800">{fichaData.salQB}%</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 block mt-0.5 font-mono">
                    Δ {(fichaData.salQB - fichaData.ingQB) >= 0 ? `+${(fichaData.salQB - fichaData.ingQB).toFixed(2)}` : (fichaData.salQB - fichaData.ingQB).toFixed(2)}%
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">% Trizado / % Tiza Total</span>
                  <div className="flex items-center justify-between mt-1 font-mono text-[11px]">
                    <span>TZ: {fichaData.ingTrizado}% ➔ <strong>{fichaData.salTrizado}%</strong></span>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-800 block mt-0.5 font-mono">
                    Tiza: {fichaData.ingTT}% ➔ {fichaData.salTT}%
                  </span>
                </div>
              </div>

              {/* Tabla Comparativa de los Parámetros Físicos y Rendimientos */}
              <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 border-b border-slate-300 text-[10.5px] font-black uppercase">
                      <th className="py-2 px-3 border-r border-slate-300">Parámetro Físico / Rendimiento</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-center bg-slate-100 w-36">
                        Ingreso (Materia Prima)
                      </th>
                      <th className="py-2 px-3 border-r border-slate-300 text-center bg-amber-50 text-amber-950 w-40">
                        Después de Vaporizado
                      </th>
                      <th className="py-2 px-3 text-center w-36">
                        Variación (Δ Salida - Ingreso)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {fichaData.comparativoFisico.map((row) => {
                      const isPositiveDelta = row.delta > 0;
                      const isZeroDelta = row.delta === 0;
                      const isFavorable = isZeroDelta
                        ? true
                        : row.inverseGood
                        ? row.delta <= 0
                        : row.delta >= 0;

                      return (
                        <tr
                          key={row.codigo}
                          className={row.highlight ? "bg-amber-50/30 font-semibold" : "hover:bg-slate-50"}
                        >
                          <td className="py-1.5 px-3 border-r border-slate-200 font-bold text-slate-800">
                            <div className="flex items-center justify-between gap-2">
                              <span>{row.nombre}</span>
                              <span className="text-[9.5px] font-mono text-slate-400 font-bold shrink-0">
                                [{row.codigo}]
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-700 bg-slate-50/60">
                            {row.ingreso}
                            {row.unidad}
                          </td>
                          <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono font-black text-slate-950 bg-amber-50/40">
                            {row.salida}
                            {row.unidad}
                          </td>
                          <td className="py-1.5 px-3 text-center font-mono font-black">
                            <span
                              className={`px-2 py-0.5 rounded text-[10.5px] ${
                                isZeroDelta
                                  ? "bg-slate-100 text-slate-600"
                                  : isFavorable
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {isPositiveDelta ? `+${row.delta}` : row.delta}
                              {row.unidad}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 3. PROPIEDADES ORGANOLÉPTICAS & DEFECTOS CUALITATIVOS                 */}
          {/* ===================================================================== */}
          <div data-pdf-section="true" className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-800 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-xs uppercase tracking-wide">
                  3. PROPIEDADES ORGANOLÉPTICAS & DEFECTOS CUALITATIVOS
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-300">
                Escala Oficial: N (Ninguno / NP) • P (Poco) • R (Regular) • V (Variado) • B (Bastante)
              </span>
            </div>

            <div className="p-4 bg-slate-50">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {fichaData.organolepticosList.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                      <span className="font-black text-slate-800 text-xs">{item.label}</span>
                      <span className="text-[9.5px] font-mono font-bold text-slate-400">
                        ({item.abrev})
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-semibold text-[10px]">Ingreso:</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {item.ingreso.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 font-bold text-[10px]">Post-Vap:</span>
                        <span
                          className={`px-2 py-0.5 rounded font-black text-[10.5px] ${
                            item.salida.code === "N"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.salida.code === "P"
                              ? "bg-teal-100 text-teal-800"
                              : item.salida.code === "R"
                              ? "bg-blue-100 text-blue-800"
                              : item.salida.code === "V"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {item.salida.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                      <span>Criterio Apto:</span>
                      <strong className="text-slate-600">{item.criterioApto}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 4. PARÁMETROS OPERATIVOS DE VAPORIZADO Y TIEMPOS TOTALES DE PROCESO   */}
          {/* ===================================================================== */}
          <div data-pdf-section="true" className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-800 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="font-black text-xs uppercase tracking-wide">
                  4. PARÁMETROS OPERATIVOS DE VAPORIZADO, TIEMPO TOTAL DE VAPORIZADO Y TIEMPO TOTAL DE PROCESO DEL BATCH
                </span>
              </div>
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                Autoclave: {fichaData.equipoAutoclave} • {fichaData.modalidadPases === "2_PASES" ? "2 Pases (Seco - Anti - Trizado)" : "1 Solo Pase (Húmedo)"}
              </span>
            </div>

            <div className="p-4 bg-slate-50 space-y-4">
              {/* 4.A PARÁMETROS OPERATIVOS DE VAPORIZADO Y SECADO */}
              <div data-pdf-block="true">
                <h4 className="text-[11px] font-black uppercase text-slate-700 mb-2 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-600" />
                  <span>4.1 Parámetros Operativos de Vaporizado y Secado</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Modalidad Vaporizado</span>
                    <span className="text-xs font-black text-slate-900 block mt-0.5">
                      {fichaData.modalidadPases === "2_PASES" ? "2 Pases (Seco - Anti - Trizado)" : "1 Solo Pase (Húmedo)"}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Presión de Vapor</span>
                    <span className="text-xs font-black text-emerald-800 font-mono block mt-0.5">
                      {fichaData.modalidadPases === "2_PASES"
                        ? `P1: ${fichaData.presionPase1} / P2: ${fichaData.presionPase2} bar`
                        : `${fichaData.presionVaporBar} bar`}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Vel. Exclusa / RPM</span>
                    <span className="text-xs font-black text-slate-900 font-mono block mt-0.5">
                      V.Excl: {fichaData.velExclusa} | {fichaData.rpmAutoclave} RPM
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Temp. Trabajo Vapor</span>
                    <span className="text-xs font-black text-amber-800 font-mono block mt-0.5">
                      {fichaData.tempTrabajoVapor}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Temp. Secado / Grano</span>
                    <span className="text-xs font-black text-rose-800 font-mono block mt-0.5">
                      Aire: {fichaData.tempSecadoPromC}°C | Grano: {fichaData.tempGranoPromC}°C
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Operador / Supervisor</span>
                    <span className="text-[11px] font-bold text-slate-900 block mt-0.5 break-words leading-snug" title={`${fichaData.operadorPlanta} / ${fichaData.supervisorPlanta}`}>
                      {fichaData.operadorPlanta}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4.B CÁLCULO DEL TIEMPO TOTAL DE VAPORIZADO (SUMA DE LOS 4 COMPONENTES) */}
              <div data-pdf-block="true" className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2">
                  <div>
                    <h4 className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span>4.2 Tiempo Total de Vaporizado (Suma de los 4 Componentes de Planta)</span>
                    </h4>
                    <p className="text-[10.5px] text-amber-900">
                      Fórmula Oficial: <strong>T. Llenado Tolva Pulmón + T. Inyección de Vapor + T. Fallas Mecánicas + T. Batería de Enfriamiento de los Silos</strong>
                    </p>
                  </div>
                  <div className="bg-amber-600 text-white px-3.5 py-1.5 rounded-lg font-mono text-right shadow-xs">
                    <span className="text-[9px] font-bold uppercase block opacity-90">Tiempo Total de Vaporizado</span>
                    <span className="text-sm sm:text-base font-black">
                      {formatMinAndHours(fichaData.tiempoTotalVaporizadoMin)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 font-mono">
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans font-black text-slate-500 uppercase block">
                      1. Llenado Tolva Pulmón
                    </span>
                    <span className="text-base font-black text-slate-900 block mt-0.5">
                      {fichaData.tiempoLlenadoTolvaPulmonMin} min
                    </span>
                    <span className="text-[9.5px] font-sans text-slate-500 block">
                      Carga inicial a tolva pulmón
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans font-black text-slate-500 uppercase block">
                      2. Inyección de Vapor
                    </span>
                    <span className="text-base font-black text-amber-800 block mt-0.5">
                      {fichaData.tiempoInyeccionVaporMin} min
                    </span>
                    <span className="text-[9.5px] font-sans text-slate-500 block">
                      {fichaData.tiempoInyeccionVaporMin === 0
                        ? "Sin registro de inyección (0 min)"
                        : fichaData.modalidadPases === "2_PASES" && (fichaData.calcInyP1 > 0 || fichaData.calcInyP2 > 0)
                        ? `1° Pase: ${fichaData.calcInyP1}m + 2° Pase: ${fichaData.calcInyP2}m`
                        : `Inyección directa en autoclave (${fichaData.tiempoInyeccionVaporMin} min)`}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans font-black text-rose-700 uppercase flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      <span>3. Fallas Mecánicas</span>
                    </span>
                    <span className={`text-base font-black block mt-0.5 ${fichaData.tiempoFallasMecanicasMin > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {fichaData.tiempoFallasMecanicasMin} min
                    </span>
                    <span className="text-[9.5px] font-sans text-slate-500 block">
                      {fichaData.paradasList.length > 0
                        ? `${fichaData.paradasList.length} parada(s) registrada(s)`
                        : "Sin paradas mecánicas (0 min)"}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans font-black text-blue-800 uppercase block">
                      4. Batería Enfriamiento Silos
                    </span>
                    <span className="text-base font-black text-blue-900 block mt-0.5">
                      {fichaData.tiempoBateriaSilosMin} min
                    </span>
                    <span className="text-[9.5px] font-sans text-slate-500 block">
                      Llenado + Reposo + Descarga Silos 1–5
                    </span>
                  </div>
                </div>
              </div>

              {/* 4.C CRONOGRAMA INTEGRAL Y TIEMPO TOTAL DE PROCESO DEL BATCH */}
              <div data-pdf-block="true" className="bg-slate-900 text-white rounded-xl p-4 space-y-3 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-2.5">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black uppercase text-amber-400 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>4.3 Cronograma Integral de Etapas y Tiempo Total de Proceso del Batch</span>
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Suma Total = <strong>T. Total Vaporizado + 1° Reposo + Enfriamiento + 2° Reposo + T. Secado + Enfriamiento Final</strong> (Jalado estrictamente de la Hoja de Control de Vaporizado)
                    </p>
                  </div>

                  <div className="bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-mono text-right shadow-lg">
                    <span className="text-[9.5px] font-black uppercase block tracking-wider">
                      TIEMPO TOTAL DE PROCESO DEL BATCH
                    </span>
                    <span className="text-base sm:text-lg font-black">
                      {formatMinAndHours(fichaData.tiempoTotalProcesoBatchMin)}
                    </span>
                  </div>
                </div>

                {/* Etapas reales de la Hoja de Control de Vaporizado del Batch */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
                  <div className="bg-slate-800/90 border border-amber-500/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans font-black text-amber-300 uppercase block tracking-wide">
                      I. T. Total Vaporizado
                    </span>
                    <strong className="text-base sm:text-lg font-black text-white block mt-1">
                      {fichaData.tiempoTotalVaporizadoMin} min
                    </strong>
                    <span className="text-[9px] text-slate-300 font-sans block mt-1 line-clamp-2" title="Tolva Pulmón + Inyección Vapor + Fallas + Batería Silos">
                      Tolva ({fichaData.tiempoLlenadoTolvaPulmonMin}m) + Iny. ({fichaData.tiempoInyeccionVaporMin}m) + Silos ({fichaData.tiempoBateriaSilosMin}m)
                    </span>
                  </div>

                  <div className="bg-slate-800/90 border border-blue-400/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans font-black text-blue-300 uppercase block tracking-wide">
                      II. 1° Reposo Grano
                    </span>
                    <strong className="text-base sm:text-lg font-black text-white block mt-1">
                      {fichaData.calcReposo1Min} min
                    </strong>
                    <span className="text-[9px] text-slate-300 font-sans block mt-1">
                      {fichaData.calcReposo1Min > 0 ? `Reposo 1 (${fichaData.calcReposo1Min} min)` : "0 min"}
                    </span>
                  </div>

                  <div className="bg-slate-800/90 border border-cyan-400/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans font-black text-cyan-300 uppercase block tracking-wide">
                      III. Enfriamiento Grano
                    </span>
                    <strong className="text-base sm:text-lg font-black text-white block mt-1">
                      {fichaData.calcEnfriamientoMin} min
                    </strong>
                    <span className="text-[9px] text-slate-300 font-sans block mt-1">
                      {fichaData.calcEnfriamientoMin > 0 ? `Enfriamiento (${fichaData.calcEnfriamientoMin} min)` : "0 min"}
                    </span>
                  </div>

                  <div className="bg-slate-800/90 border border-indigo-400/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans font-black text-indigo-300 uppercase block tracking-wide">
                      IV. 2° Reposo Grano
                    </span>
                    <strong className="text-base sm:text-lg font-black text-white block mt-1">
                      {fichaData.calcReposo2Min} min
                    </strong>
                    <span className="text-[9px] text-slate-300 font-sans block mt-1">
                      {fichaData.calcReposo2Min > 0 ? `Reposo 2 (${fichaData.calcReposo2Min} min)` : "0 min"}
                    </span>
                  </div>

                  <div className="bg-slate-800/90 border border-rose-400/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans font-black text-rose-300 uppercase block tracking-wide">
                      V. Tiempo de Secado
                    </span>
                    <strong className="text-base sm:text-lg font-black text-white block mt-1">
                      {fichaData.calcSecadoMin} min
                    </strong>
                    <span className="text-[9px] text-slate-300 font-sans block mt-1">
                      {fichaData.calcSecadoMin > 0
                        ? `${(fichaData.calcSecadoMin / 60).toFixed(1)} h secado`
                        : "0 min"}
                    </span>
                  </div>

                  <div className="bg-slate-800/90 border border-teal-400/40 rounded-lg p-2.5">
                    <span className="text-[10px] font-sans font-black text-teal-300 uppercase block tracking-wide">
                      VI. Enfr. Final Grano
                    </span>
                    <strong className="text-base sm:text-lg font-black text-teal-300 block mt-1">
                      {fichaData.calcEnfriamientoFinalMin} min
                    </strong>
                    <span className="text-[9px] text-slate-300 font-sans block mt-1">
                      {fichaData.calcEnfriamientoFinalMin > 0
                        ? `${fichaData.calcEnfriamientoFinalMin} min post-secado`
                        : "0 min"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 5. RESUMEN SINTÉTICO DE VARIABLES & ENVASE PROYECTADO                 */}
          {/* ===================================================================== */}
          <div data-pdf-section="true" className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-800 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="font-black text-xs uppercase tracking-wide">
                  5. RESUMEN SINTÉTICO DE VARIABLES DE COCCIÓN & ENVASE PROYECTADO
                </span>
              </div>
              <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                Score Culinario: ★ {fichaData.puntajeCoccion} / 100 pts ({fichaData.solturaGrano})
              </span>
            </div>

            <div className="p-4 bg-slate-50 space-y-3">
              {/* Dosificación y Evaluación de Grano Cocido en Olla */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Dosificación Olla</span>
                  <span className="text-xs font-black text-slate-900 block mt-1">
                    {fichaData.tazasArroz} tz Arroz / {fichaData.tazasAgua} tz Agua
                  </span>
                  <span className="text-[9.5px] text-cyan-700 font-bold block mt-0.5">
                    Prueba estándar
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Tiempo Cocción</span>
                  <span className="text-sm font-black text-amber-800 font-mono block mt-1">
                    {fichaData.tiempoCoccionOllaMin} min
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">
                    Cocción homogénea
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Sabor / Aroma</span>
                  <span className="text-xs font-black text-emerald-800 block mt-1 break-words leading-snug" title={fichaData.saborCoccion}>
                    {fichaData.saborCoccion}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">
                    Sin regusto extraño
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Desplazamiento</span>
                  <span className="text-sm font-black text-cyan-800 font-mono block mt-1">
                    {fichaData.desplazamientoSeg}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">
                    Fluidez en plato
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">% Quebrado / Hinchado</span>
                  <span className="text-xs font-black text-amber-900 font-mono block mt-1">
                    Q: {fichaData.granoQuebradoOllaPct}% | H: {fichaData.granoHinchadoPct}%
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">
                    En olla cocida
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">% Abierto / Textura Frío</span>
                  <span className="text-xs font-black text-emerald-800 font-mono block mt-1">
                    Ab: {fichaData.granoAbiertoPct}% | {fichaData.texturaFrio}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">
                    Estabilidad al enfriar
                  </span>
                </div>
              </div>

              {/* ENVASE PROYECTADO DESTACADO */}
              <div data-pdf-block="true" className="bg-amber-50 bg-gradient-to-r from-amber-100 via-amber-50 to-emerald-50 border-2 border-amber-400 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-500 text-slate-950 shadow-sm shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-900">
                        ENVASE PROYECTADO DEL BATCH CERRADO
                      </span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-300/80 text-amber-950 uppercase">
                        ★ Determinado en Cocción
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-950 mt-0.5">
                      {fichaData.envaseProyectado}
                    </h3>
                    <p className="text-[11px] text-slate-700 mt-0.5">
                      Destino comercial aprobado según rendimiento blanco ({fichaData.salRB}%), grano entero ({fichaData.salEntero}%), textura al frío ({fichaData.texturaFrio}) y puntaje en olla ({fichaData.puntajeCoccion} pts).
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-amber-300 shrink-0">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Dictamen de Cierre:</span>
                  <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center gap-1 mt-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    APROBADO PARA ENVASADO
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* OBSERVACIONES FINALES Y FIRMAS DE CONFORMIDAD DE CIERRE */}
          <div data-pdf-section="true" className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="md:col-span-1 border border-slate-300 rounded-xl p-3 bg-slate-50">
              <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                Observaciones de Cierre del Batch:
              </span>
              <p className="text-[11px] text-slate-800 italic leading-relaxed">
                {fichaData.observacionesFinales}
              </p>
              {fichaData.balanceSacas.sustentoObservacionAlarma && (
                <p className="text-[10.5px] text-amber-900 font-semibold mt-1.5 bg-amber-100/80 p-1.5 rounded border border-amber-300">
                  Sustento Balanza (±2%): "{fichaData.balanceSacas.sustentoObservacionAlarma}"
                </p>
              )}
            </div>

            <div className="md:col-span-2 grid grid-cols-3 gap-4 items-end text-center pt-6">
              <div className="border-t-2 border-slate-800 pt-2">
                <span className="font-black text-slate-900 text-xs block">{fichaData.operadorPlanta}</span>
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">
                  Jefe / Operador de Vaporizado
                </span>
              </div>
              <div className="border-t-2 border-slate-800 pt-2">
                <span className="font-black text-slate-900 text-xs block">Laboratorio de Calidad</span>
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">
                  Control de Calidad & Cocción
                </span>
              </div>
              <div className="border-t-2 border-slate-800 pt-2">
                <span className="font-black text-slate-900 text-xs block">{fichaData.supervisorPlanta}</span>
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">
                  V°B° Cierre de Batch Planta
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
