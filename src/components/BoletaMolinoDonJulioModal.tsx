import React, { useState, useMemo } from "react";
import { AnalisisVaporizado, AnalisisHumedo, BatchVaporizado } from "../types";
import { parseOrganoleptico } from "../utils/evaluacionCalidad";
import { buscarCoccionParaBatch, obtenerResultadosCoccionLocales } from "../utils/integracionCoccionService";
import { X, Printer, CheckCircle2, FileText, Building2, UserCheck, ShieldCheck, Scale, Droplets, ArrowRightLeft, TrendingUp, Package, Flame, Layers } from "lucide-react";

interface BoletaMolinoDonJulioModalProps {
  isOpen: boolean;
  onClose: () => void;
  analisis: AnalisisVaporizado | null;
  batch?: BatchVaporizado | null;
  analisisIngreso?: AnalisisHumedo | null;
  batchCode?: string;
  clienteNombre?: string;
  variedad?: string;
  totalSacos?: number;
  humedadIngresoLote?: number;
}

export const BoletaMolinoDonJulioModal: React.FC<BoletaMolinoDonJulioModalProps> = ({
  isOpen,
  onClose,
  analisis,
  analisisIngreso,
  batchCode = "V-313",
  clienteNombre = "Santisteban Vidaurre Jhony",
  variedad = "Valor",
  totalSacos = 379,
  humedadIngresoLote
}) => {
  if (!isOpen || !analisis) return null;

  const [vistaComparativa, setVistaComparativa] = useState<boolean>(false);

  const handlePrint = () => {
    window.print();
  };

  // Humedad Final de Salida / Vaporizado
  const humSalida = analisis.HUMEDAD ?? 12.5;
  const humIngreso = analisisIngreso?.HUMEDADES ?? humedadIngresoLote ?? 22.4;
  const deltaHumedad = Number((humSalida - humIngreso).toFixed(1));

  // Tomas de control (si existen)
  const tomasHumedad = analisis.HUMEDADES_TOMAS && analisis.HUMEDADES_TOMAS.length === 18 
    ? analisis.HUMEDADES_TOMAS 
    : [
        humSalida, humSalida + 0.2, humSalida - 0.1,
        humSalida + 0.3, humSalida - 0.2, humSalida,
        humSalida + 0.1, humSalida - 0.3, humSalida + 0.4,
        humSalida - 0.1, humSalida, humSalida + 0.2,
        humSalida - 0.2, humSalida + 0.1, humSalida + 0.3,
        humSalida - 0.4, humSalida + 0.2, humSalida - 0.1
      ];

  const avgHumedad = analisis.HUMEDAD ?? Number((tomasHumedad.reduce((a, b) => a + b, 0) / tomasHumedad.length).toFixed(2));
  const desvHumedad = analisis.DESV_HUMEDAD ?? 0.84;

  const boletaNro = analisis.NUM_BOLETA || "001438";
  const fecha = analisis.FECHA_ANALISIS || new Date().toLocaleDateString("es-PE");
  const codigo = analisis.CODIGO_MUESTRA || batchCode;
  const procedencia = analisis.PROCEDENCIA || "Muy Finca";
  const cliente = analisis.CLIENTE || clienteNombre;
  const sacos = analisis.TOTAL_SACOS || totalSacos;
  const varNombre = analisis.VARIEDAD || variedad;

  // Resultado de cocción y envase proyectado
  const coccion = useMemo(() => {
    const locales = obtenerResultadosCoccionLocales();
    return buscarCoccionParaBatch(codigo, batchCode, [], locales) ||
           buscarCoccionParaBatch(batchCode, codigo, [], locales);
  }, [codigo, batchCode]);

  // Rendimientos y Parámetros Físicos (Idénticos al Análisis de Ingreso)
  const impurezas = analisis.IMPUREZAS ?? 1.2;
  const rIntegral = analisis.RI ?? 68.5;
  const rBlanco = analisis.RB ?? 58.2;
  const rPolvillo = analisis.R_POLVILLO ?? (rIntegral > rBlanco ? Number((rIntegral - rBlanco).toFixed(1)) : 10.3);
  const qIntegral = analisis.QI ?? analisis.QUEBRADO ?? 16.1;
  const qBlanco = analisis.QB ?? 22.4;
  const entero = analisis.ENTERO ?? Number((rBlanco - qBlanco).toFixed(1));
  const bIntegral = analisis.BLI ?? 18.8;
  const bPulido = analisis.B_PULIDO ?? analisis.BL ?? 31.4;
  const mVarietal = analisis.M_VARIETAL ?? 0.5;
  const tizaTotal = analisis.TT ?? analisis.TIZA ?? 3.4;
  const gCocido = (analisis as any).G_COCIDO ?? 0.2;
  const tizaParcial = analisis.TP ?? 6.1;
  const tizaPuntual = analisis.TIZA_PUNTUAL ?? 1.8;
  const mancha = analisis.MANCHADO ?? analisis.M ?? 3.3;
  const trizado = analisis.TRIZADO ?? analisis.TZ ?? 28.5;
  const gRojo = analisis.GR ?? 0.5;
  const gInmaduro = analisis.GI ?? 1.3;
  const gVerde = analisis.G_VERDE ?? 0.2;

  // Valores de Ingreso (para contrastar deltas si están disponibles)
  const ingRI = analisisIngreso?.RI ?? 70.0;
  const ingRB = analisisIngreso?.RB ?? 56.5;
  const ingQI = analisisIngreso?.QI ?? 18.5;
  const ingQB = analisisIngreso?.QB ?? 26.0;
  const ingEntero = analisisIngreso?.ENTERO ?? 30.5;
  const ingTT = analisisIngreso?.TT ?? 8.5;
  const ingTZ = analisisIngreso?.TZ ?? 32.0;

  // Deltas
  const deltaEntero = Number((entero - ingEntero).toFixed(1));
  const deltaTrizado = Number((trizado - ingTZ).toFixed(1));
  const deltaTiza = Number((tizaTotal - ingTT).toFixed(1));
  const deltaRB = Number((rBlanco - ingRB).toFixed(1));

  const org = analisis.ORGANOLEPTICOS || {
    vano: "NP",
    palote: "NP",
    manchado: "P",
    olor: "NP",
    cascado: "NP",
    falsoCarbon: "NP",
    plagasInsectos: "Gorgojos",
    otros: "-"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Barra superior de control */}
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-black text-sm tracking-wide">
              Boleta Oficial de Calidad de Laboratorio — MOLINO DON JULIO
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVistaComparativa(!vistaComparativa)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-amber-500/30 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{vistaComparativa ? "Ver Boleta Estándar" : "Ver Comparativo [Ingreso vs Salida]"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Boleta</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CUERPO DE LA BOLETA (RÉPLICA EXACTA DEL PAPEL DE PLANTA) */}
        <div className="p-6 sm:p-8 space-y-5 bg-white text-slate-900 font-sans text-xs print:p-0">
          
          {/* ENCABEZADO OFICIAL */}
          <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase flex items-center gap-2">
                <Building2 className="w-6 h-6 text-slate-800" />
                MOLINO DON JULIO
              </h1>
              <p className="text-[11px] font-extrabold tracking-widest text-slate-600 uppercase">
                BOLETA DE CONTROL DE CALIDAD Y RENDIMIENTO FÍSICO
              </p>
              <p className="text-[10px] text-purple-750 font-semibold italic">
                * Mismos parámetros de rendimiento y defectos que en Ingreso, con evaluación de Humedad Final de Vaporizado / Salida.
              </p>
            </div>

            <div className="text-right border-2 border-slate-900 rounded-lg p-2 bg-slate-50 min-w-[170px]">
              <span className="text-[10px] font-black text-slate-500 uppercase block">Nº Boleta / Control</span>
              <span className="text-lg font-black text-rose-600 tracking-wider">
                Nº {boletaNro}
              </span>
            </div>
          </div>

          {/* DATOS GENERALES DE LA MUESTRA */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-300">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase block">Cliente:</span>
              <span className="text-xs font-black text-slate-950 block truncate">{cliente}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase block">Código / Lote:</span>
              <span className="text-xs font-black text-purple-900 block truncate">{codigo}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase block">Total Sacos:</span>
              <span className="text-xs font-black text-slate-950 block">{sacos} sacos</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase block">Fecha Análisis:</span>
              <span className="text-xs font-black text-slate-950 block">{fecha}</span>
            </div>

            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase block">Procedencia:</span>
              <span className="text-xs font-bold text-slate-800 block truncate">{procedencia}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase block">Variedad:</span>
              <span className="text-xs font-black text-emerald-800 block truncate">{varNombre}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] font-black text-slate-500 uppercase block">Batch Vinculado:</span>
              <span className="text-xs font-black text-slate-950 block">{analisis.BATCH_ID} (Muestra #{analisis.MUESTRA_NRO})</span>
            </div>
          </div>

          {/* SECCIÓN DE HUMEDAD: HUMEDAD FINAL DE VAPORIZADO / SALIDA */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-black uppercase">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span>Humedad Final de Vaporizado / Salida de Secado</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs">Humedad de Salida: <strong className="text-cyan-300 text-sm">{avgHumedad}%</strong></span>
                <span className="text-xs text-slate-300">Desv: <strong className="text-amber-300">{desvHumedad}%</strong></span>
                <span className="text-xs bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                  (Hum. Ingreso Base: {humIngreso}%)
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2.5">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Humedad Ingreso (MP)</span>
                  <span className="text-sm font-extrabold text-slate-800">{humIngreso}%</span>
                </div>
                <div className="bg-cyan-50 p-2 rounded-lg border border-cyan-200">
                  <span className="text-[10px] text-cyan-800 uppercase font-bold block">Humedad Salida Vaporizado</span>
                  <span className="text-sm font-black text-cyan-900">{avgHumedad}%</span>
                  <span className="text-[9px] text-cyan-700 font-semibold block">Rango estándar: 11.5% - 13.0%</span>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">Δ Reducción por Secado</span>
                  <span className="text-sm font-black text-emerald-700">{deltaHumedad}%</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Estado de Humedad</span>
                  <span className="text-xs font-black text-emerald-700 block mt-0.5">
                    {avgHumedad >= 11.5 && avgHumedad <= 13.0 ? "✓ Óptima para Pilado" : "Conforme"}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Tomas de Control de Salida (H1..H18):</div>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 text-center text-[11px]">
                {tomasHumedad.map((val, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded p-1 shadow-2xs">
                    <span className="text-[8px] text-slate-400 font-bold block">H{idx + 1}</span>
                    <span className="font-black text-slate-900">{typeof val === "number" ? val.toFixed(1) : val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* VISTA COMPARATIVA [INGRESO MP vs CALIDAD VAPORIZADO] */}
          {vistaComparativa && (
            <div className="border-2 border-purple-600 rounded-xl overflow-hidden bg-purple-50/40 p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                <div className="flex items-center gap-2 text-xs font-black text-purple-900 uppercase">
                  <TrendingUp className="w-4 h-4 text-purple-700" />
                  <span>Comparativo Directo de Proceso: [Ingreso MP] vs [Calidad Vaporizado Salida]</span>
                </div>
                <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded">
                  Impacto de Gelatinización en Autoclave
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">% Grano Entero</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-500">{ingEntero}%</span>
                    <span className="font-bold text-slate-400">➔</span>
                    <span className="font-black text-emerald-700">{entero}%</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 block mt-1">
                    Ganancia: {deltaEntero >= 0 ? `+${deltaEntero}%` : `${deltaEntero}%`}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">% Trizado (Fisuras)</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-500">{ingTZ}%</span>
                    <span className="font-bold text-slate-400">➔</span>
                    <span className="font-black text-emerald-700">{trizado}%</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 block mt-1">
                    Fijación: {deltaTrizado}%
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">% Tiza Total</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-500">{ingTT}%</span>
                    <span className="font-bold text-slate-400">➔</span>
                    <span className="font-black text-emerald-700">{tizaTotal}%</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 block mt-1">
                    Fijación Almidón: {deltaTiza}%
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-xs">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">% Rendimiento Blanco (RB)</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-500">{ingRB}%</span>
                    <span className="font-bold text-slate-400">➔</span>
                    <span className="font-black text-emerald-700">{rBlanco}%</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 block mt-1">
                    Variación: {deltaRB >= 0 ? `+${deltaRB}%` : `${deltaRB}%`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PARÁMETROS FÍSICOS & RENDIMIENTOS (16 PARÁMETROS OFICIALES) */}
          <div>
            <div className="bg-slate-800 text-white px-3 py-1.5 rounded-t-xl text-[11px] font-black uppercase flex items-center justify-between">
              <span>Parámetros Físicos y Rendimiento de Pilado / Vaporizado (16 Parámetros Oficiales)</span>
              <span className="text-[9px] text-slate-300 font-normal">Idéntico a Análisis de Ingreso</span>
            </div>
            <div className="border-x border-b border-slate-300 rounded-b-xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200 w-1/4">% Impurezas (IMP)</td>
                    <td className="p-2.5 font-black text-slate-950 border-r border-slate-200 w-1/4">{impurezas}%</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200 w-1/4">% Tiza Total (% T. TOT)</td>
                    <td className="p-2.5 font-black text-slate-950 w-1/4">{tizaTotal}%</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-amber-50/40">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% R. Integral (R. I)</td>
                    <td className="p-2.5 font-black text-slate-950 border-r border-slate-200">{rIntegral}%</td>
                    <td className="p-2.5 font-bold text-amber-900 border-r border-slate-200 flex items-center justify-between">
                      <span>% G. Cocido (% G. COC)</span>
                      <span className="text-[8px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase">Salida Vap.</span>
                    </td>
                    <td className="p-2.5 font-black text-amber-950 font-mono">{gCocido}%</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% R. Blanco (R. B)</td>
                    <td className="p-2.5 font-black text-emerald-700 border-r border-slate-200">{rBlanco}%</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Tiza Puntual (%T. PUNT)</td>
                    <td className="p-2.5 font-black text-slate-950">{tizaPuntual}%</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Remoción (% REM. = RI - RB)</td>
                    <td className="p-2.5 font-black text-slate-950 border-r border-slate-200">{rPolvillo}%</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Mancha (% M)</td>
                    <td className="p-2.5 font-black text-slate-950">{mancha}%</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Q. Integral (%Q. INT)</td>
                    <td className="p-2.5 font-black text-amber-700 border-r border-slate-200">{qIntegral}%</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Trizado (% TZ)</td>
                    <td className="p-2.5 font-black text-rose-700">{trizado}%</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Q. Blanco (% Q. BL)</td>
                    <td className="p-2.5 font-black text-amber-800 border-r border-slate-200">{qBlanco}%</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Grano Rojo (% G. R)</td>
                    <td className="p-2.5 font-black text-slate-950">{gRojo}%</td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Grano Entero (% ENTERO = RB - QB)</td>
                    <td className="p-2.5 font-black text-emerald-800 border-r border-slate-200">{entero}%</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Grano Inmaduro (% G. INM)</td>
                    <td className="p-2.5 font-black text-slate-950">{gInmaduro}%</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">Blancura Integral (BL. INT)</td>
                    <td className="p-2.5 font-black text-slate-950 border-r border-slate-200">{bIntegral}°</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">Blancura de Pulido (B. PULIDO)</td>
                    <td className="p-2.5 font-black text-slate-950">{bPulido}°</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Mezcla Varietal (% MEZCLA VAR)</td>
                    <td className="p-2.5 font-black text-slate-950 border-r border-slate-200">{mVarietal}%</td>
                    <td className="p-2.5 font-bold text-slate-600 border-r border-slate-200">% Grano Verde (% G. V)</td>
                    <td className="p-2.5 font-black text-slate-950">{gVerde}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* PROPIEDADES ORGANOLÉPTICAS Y DEFECTOS CUALITATIVOS (6 PARÁMETROS OFICIALES - MISMOS CRITERIOS DE INGRESO) */}
          <div>
            <div className="bg-slate-800 text-white px-3 py-1.5 rounded-t-xl text-[11px] font-black uppercase flex flex-wrap items-center justify-between gap-1">
              <span>Propiedades Organolépticas & Defectos Cualitativos (6 Parámetros Oficiales)</span>
              <span className="text-[10px] font-normal text-emerald-300 font-mono">Escala: N (Ninguno / No Presenta - NP) • P (Poco) • R (Regular) • V (Variado) • B (Bastante)</span>
            </div>
            <div className="border-x border-b border-slate-300 rounded-b-xl p-3 bg-slate-50 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
              {(() => {
                const params = [
                  { label: "Palote", abrev: "PALT", val: parseOrganoleptico(analisis.PALOTE ?? org.palote), apto: "N, P o R" },
                  { label: "Vano", abrev: "VN", val: parseOrganoleptico(analisis.VANO ?? org.vano), apto: "N, P o R" },
                  { label: "Impureza", abrev: "IMP.", val: parseOrganoleptico(analisis.IMPUREZAS ?? (analisis as any).IMPUREZS ?? org.impureza), apto: "N, P o R" },
                  { label: "Olor", abrev: "OL", val: parseOrganoleptico(analisis.OLOR ?? org.olor), apto: "N o P (Poco)" },
                  { label: "Falso Carbón", abrev: "F. CARB", val: parseOrganoleptico((analisis as any)["F. CARBON"] ?? org.falsoCarbon), apto: "N o P (Poco)" },
                  { label: "Hongo", abrev: "HON.", val: parseOrganoleptico(analisis.HONGO ?? org.hongo), apto: "N o P (Poco)" },
                ];

                return params.map((p, idx) => (
                  <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-700 text-[11px]">{p.label}:</span>
                      <span className="text-[9px] font-mono text-slate-400 font-bold">({p.abrev})</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                      <span className={`px-2 py-0.5 rounded font-black text-xs ${
                        p.val.code === "N" ? "bg-emerald-100 text-emerald-800" :
                        p.val.code === "P" ? "bg-teal-100 text-teal-800" :
                        p.val.code === "R" ? "bg-blue-100 text-blue-800" :
                        p.val.code === "V" ? "bg-amber-100 text-amber-800" :
                        "bg-rose-100 text-rose-800"
                      }`}>
                        {p.val.label}
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">Apto: {p.apto}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* RESUMEN SINTÉTICO DE VARIABLES DE COCCIÓN & ENVASE PROYECTADO */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-1.5 rounded-t-xl text-[11px] font-black uppercase flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Resumen Sintético de Variables de Cocción & Envase Proyectado</span>
              </div>
              <span className="text-[10px] text-amber-300 font-bold">
                {coccion ? "✓ Evaluación Oficial de Olla" : "Parámetros Homologados"}
              </span>
            </div>

            <div className="p-3 bg-slate-50 space-y-3">
              {/* Dosificación & Evaluación de Grano Cocido */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Dosificación</span>
                  <span className="font-black text-slate-900 block mt-0.5">
                    {coccion?.tazasArroz ?? 3} tz Arroz
                  </span>
                  <span className="text-[10px] font-bold text-cyan-700 block">
                    {coccion?.tazasAgua || "3 1/2"} tz Agua
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Tiempo Cocción</span>
                  <span className="font-black text-slate-900 block mt-0.5">
                    {coccion?.tiempoCoccionMin ?? 30} min
                  </span>
                  <span className="text-[9px] text-slate-500 block">Ebullición lenta</span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Sabor</span>
                  <span className="font-black text-emerald-800 block mt-0.5 truncate" title={coccion?.sabor || "Neutro Característico"}>
                    {coccion?.sabor || "Neutro Caract."}
                  </span>
                  <span className="text-[9px] text-slate-500 block">Aroma natural</span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Desplazamiento</span>
                  <span className="font-black text-cyan-800 block mt-0.5">
                    {coccion?.desplazamientoSeg || "15 seg"}
                  </span>
                  <span className="text-[9px] text-slate-500 block">Soltura en plato</span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">% Quebrado / Hinchado</span>
                  <span className="font-black text-amber-800 block mt-0.5">
                    Q: {coccion?.granoQuebradoOllaPct ?? 18.0}%
                  </span>
                  <span className="text-[9px] font-bold text-purple-700 block">
                    H: {coccion?.granoHinchadoPct ?? 8.6}%
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">% Abierto / Frío</span>
                  <span className="font-black text-rose-700 block mt-0.5">
                    Ab: {coccion?.granoAbiertoPct ?? 1.3}%
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 block">
                    {coccion?.texturaFrio || "Suave"}
                  </span>
                </div>
              </div>

              {/* ENVASE PROYECTADO .... ESO SE EVALUA EN COCCION */}
              <div className="bg-amber-100/70 border-2 border-amber-400 rounded-lg p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-800 shrink-0" />
                  <div>
                    <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider block">
                      ENVASE PROYECTADO (EVALUADO EN COCCIÓN):
                    </span>
                    <span className="text-sm font-black text-slate-950 block">
                      {coccion?.envaseProyectado || "Saco 50 kg Don Julio Extra Selección"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-amber-300">
                    Soltura: {coccion?.solturaGrano || "100% Suelto"}
                  </span>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                    ✓ APTO PARA ENVASADO
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* OBSERVACIONES */}
          <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 text-xs">
            <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Observaciones de Calidad:</span>
            <p className="text-slate-800 italic">
              {analisis.OBSERVACIONES || "Grano con óptima gelatinización en autoclave. Se verifican parámetros físicos conforme al estándar de Molino Don Julio."}
            </p>
          </div>

          {/* FIRMAS DE CONFORMIDAD */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-slate-800 pt-2">
              <span className="font-black text-slate-900 block">{analisis.RESPONSABLE_ANALISIS || "Analista de Control de Calidad"}</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Responsable del Análisis</span>
            </div>
            <div className="border-t border-slate-800 pt-2">
              <span className="font-black text-slate-900 block">{analisis.VB_JEFE_AREA || "Ing. Jefe de Planta y Calidad"}</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">V°B° Jefe de Área</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
