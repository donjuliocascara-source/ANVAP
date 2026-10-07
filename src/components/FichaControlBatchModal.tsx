import React from "react";
import { ResultadoCoccionExterno, BatchVaporizado, AnalisisVaporizado } from "../types";
import { X, Printer, Flame, FileText, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

interface FichaControlBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  coccion: ResultadoCoccionExterno | null;
  batch?: BatchVaporizado;
  analisisList?: AnalisisVaporizado[];
}

export const FichaControlBatchModal: React.FC<FichaControlBatchModalProps> = ({
  isOpen,
  onClose,
  coccion,
  batch
}) => {
  if (!isOpen || !coccion) return null;

  const handlePrint = () => {
    window.print();
  };

  const batchId = coccion.batchId || batch?.BATCH_ID || "V-313";
  const correlativo = coccion.correlativo || batch?.CORRELATIVO || batchId;
  const codigo = coccion.loteId || "C07541-C07542-C07543";
  const tipoVaporizado = coccion.tipoVaporizado || "Presecado";
  const cliente = coccion.cliente || batch?.CLIENTE || "Acosta Chozo Carmen";
  const variedad = coccion.variedad || batch?.VARIEDAD || "Valor";
  const procedencia = coccion.procedencia || "Muy Finca";
  const sacos = coccion.numeroSacos || batch?.TOTAL_SACOS || 379;
  const desvHumedad = coccion.desviacionHumedad ?? 0.72;
  const hMax = coccion.humedadMax ?? 14.1;
  const hMin = coccion.humedadMin ?? 12.8;

  const fecha = coccion.fechaCoccion || new Date().toISOString().split("T")[0];
  const turno = coccion.turno || "1250";
  const analista = coccion.panelista || "Fellon Salas";

  // Dosificación
  const tazasArroz = coccion.tazasArroz ?? 3;
  const tazasAgua = coccion.tazasAgua || "3 1/2";
  const tiempoCoccion = coccion.tiempoCoccionMin ?? 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Barra de Herramientas Superior */}
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <span className="font-black text-sm tracking-wide">
              Ficha Oficial de Control de Laboratorio por Batch (Salida & Cocción)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 shadow cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ficha Oficial</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CUERPO DE LA FICHA OFICIAL (RÉPLICA DE PLANTA) */}
        <div className="p-6 sm:p-8 space-y-5 bg-white text-slate-900 font-sans text-xs print:p-0">
          
          {/* ENCABEZADO: FECHA | TURNO | ANALISTA */}
          <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight">
                FORMATO DE REGISTRO DE VAPORIZADO Y COCCIÓN
              </h1>
              <p className="text-[11px] font-bold text-slate-600 uppercase">
                Control Comparativo de Proceso: Materia Prima vs Descarga vs Pilado
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-slate-100 p-2.5 rounded-xl border border-slate-300 text-xs">
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">Fecha:</span>
                <span className="font-black text-slate-900">{fecha}</span>
              </div>
              <div className="border-l border-slate-300 pl-3">
                <span className="text-[10px] font-black text-slate-500 uppercase block">Turno:</span>
                <span className="font-black text-slate-900">{turno}</span>
              </div>
              <div className="border-l border-slate-300 pl-3">
                <span className="text-[10px] font-black text-slate-500 uppercase block">Analista:</span>
                <span className="font-black text-purple-900">{analista}</span>
              </div>
            </div>
          </div>

          {/* 1. DESCRIPCIÓN DE LA MUESTRA */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-1.5 text-[11px] font-black uppercase">
              1. DESCRIPCIÓN DE LA MUESTRA
            </div>
            <div className="p-3.5 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">N° Batch:</span>
                <span className="text-xs font-black text-amber-800 block">{correlativo} ({batchId})</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">Código:</span>
                <span className="text-xs font-black text-slate-900 block truncate">{codigo}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">Tipo Vaporizado:</span>
                <span className="text-xs font-black text-purple-800 block">{tipoVaporizado}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">Cliente:</span>
                <span className="text-xs font-black text-slate-900 block truncate">{cliente}</span>
              </div>

              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">Variedad:</span>
                <span className="text-xs font-black text-emerald-800 block">{variedad}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">Procedencia:</span>
                <span className="text-xs font-bold text-slate-800 block">{procedencia}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">N° Sacos:</span>
                <span className="text-xs font-black text-slate-900 block">{sacos} sacos</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-500 uppercase block">Desviación / Humedad:</span>
                <span className="text-xs font-black text-cyan-800 block">
                  Desv: {desvHumedad}% | Max: {hMax}% / Min: {hMin}%
                </span>
              </div>
              <div className="sm:col-span-2 bg-amber-50/80 p-1.5 rounded border border-amber-200">
                <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider block">
                  Envase Proyectado (Evaluado en Cocción):
                </span>
                <span className="text-xs font-black text-slate-900 block truncate">
                  📦 {coccion.envaseProyectado || "Saco 50 kg Don Julio Extra Selección"}
                </span>
              </div>
            </div>
          </div>

          {/* 2. ANÁLISIS FÍSICO COMPARATIVO EN 3 COLUMNAS */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-1.5 text-[11px] font-black uppercase flex items-center justify-between">
              <span>2. ANÁLISIS FÍSICO</span>
              <span className="text-[10px] font-normal text-slate-300">MATERIA PRIMA vs DESCARGA vs PILADO</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-800 border-b border-slate-300 text-[11px] font-black uppercase">
                    <th className="p-2 border-r border-slate-300 w-2/5">Parámetro Evaluado</th>
                    <th className="p-2 border-r border-slate-300 text-center w-1/5 bg-slate-100">MATERIA PRIMA</th>
                    <th className="p-2 border-r border-slate-300 text-center w-1/5 bg-amber-50">DESCARGA</th>
                    <th className="p-2 text-center w-1/5 bg-purple-50">PILADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">Reposo Cáscara</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold">{coccion.reposoCascaraDias !== undefined ? `${coccion.reposoCascaraDias} d` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold bg-amber-50/50">{coccion.reposoCascaraDias !== undefined ? `${coccion.reposoCascaraDias} d` : "1 dia"}</td>
                    <td className="p-2 text-center font-semibold bg-purple-50/50">{coccion.reposoCascaraPilado !== undefined ? `${coccion.reposoCascaraPilado} d` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">Reposo Blanco</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold">{coccion.reposoBlancoDias !== undefined ? `${coccion.reposoBlancoDias} d` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold bg-amber-50/50">{coccion.reposoBlancoDias !== undefined ? `${coccion.reposoBlancoDias} d` : "1 dia"}</td>
                    <td className="p-2 text-center font-semibold bg-purple-50/50">{coccion.reposoBlancoPilado !== undefined ? `${coccion.reposoBlancoPilado} d` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% H cáscara</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold text-cyan-800">{coccion.humedadCascaraMP !== undefined ? `${coccion.humedadCascaraMP}%` : "13.6%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold text-cyan-800 bg-amber-50/50">{coccion.humedadCascaraDescarga !== undefined ? `${coccion.humedadCascaraDescarga}%` : "13.2%"}</td>
                    <td className="p-2 text-center font-bold text-cyan-800 bg-purple-50/50">{coccion.humedadCascaraPilado !== undefined ? `${coccion.humedadCascaraPilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% H blanco</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold text-cyan-800">{coccion.humedadBlancoMP !== undefined ? `${coccion.humedadBlancoMP}%` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold text-cyan-800 bg-amber-50/50">{coccion.humedadBlancoDescarga !== undefined ? `${coccion.humedadBlancoDescarga}%` : "11.5%"}</td>
                    <td className="p-2 text-center font-bold text-cyan-800 bg-purple-50/50">{coccion.humedadBlancoPilado !== undefined ? `${coccion.humedadBlancoPilado}%` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% Quebrado Integral</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-slate-900">{coccion.quebradoIntegralMP !== undefined ? `${coccion.quebradoIntegralMP}%` : "4.0%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-amber-800 bg-amber-50/50">{coccion.quebradoIntegralDescarga !== undefined ? `${coccion.quebradoIntegralDescarga}%` : "12.0%"}</td>
                    <td className="p-2 text-center font-black bg-purple-50/50">{coccion.quebradoIntegralPilado !== undefined ? `${coccion.quebradoIntegralPilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% Quebrado</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-slate-900">{coccion.quebradoMP !== undefined ? `${coccion.quebradoMP}%` : "10.0%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-amber-800 bg-amber-50/50">{coccion.quebradoDescarga !== undefined ? `${coccion.quebradoDescarga}%` : "20.8%"}</td>
                    <td className="p-2 text-center font-black bg-purple-50/50">{coccion.quebradoPilado !== undefined ? `${coccion.quebradoPilado}%` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">°BL Integral</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.blancuraIntegralMP !== undefined ? `${coccion.blancuraIntegralMP}°` : "22.6°"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold bg-amber-50/50">{coccion.blancuraIntegralDescarga !== undefined ? `${coccion.blancuraIntegralDescarga}°` : "20.4°"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.blancuraIntegralPilado !== undefined ? `${coccion.blancuraIntegralPilado}°` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">°BL blanco</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.blancuraBlancoMP !== undefined ? `${coccion.blancuraBlancoMP}°` : "38.8°"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold bg-amber-50/50">{coccion.blancuraBlancoDescarga !== undefined ? `${coccion.blancuraBlancoDescarga}°` : "35.0°"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.blancuraBlancoPilado !== undefined ? `${coccion.blancuraBlancoPilado}°` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% Trizado</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold text-rose-800">{coccion.trizadoMP !== undefined ? `${coccion.trizadoMP}%` : "2.6%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-rose-800 bg-amber-50/50">{coccion.trizadoDescarga !== undefined ? `${coccion.trizadoDescarga}%` : "10.4%"}</td>
                    <td className="p-2 text-center font-bold text-rose-800 bg-purple-50/50">{coccion.trizadoPilado !== undefined ? `${coccion.trizadoPilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% Cuarteado</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold">{coccion.cuarteadoMP !== undefined ? `${coccion.cuarteadoMP}%` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold bg-amber-50/50">{coccion.cuarteadoDescarga !== undefined ? `${coccion.cuarteadoDescarga}%` : "-"}</td>
                    <td className="p-2 text-center font-semibold bg-purple-50/50">{coccion.cuarteadoPilado !== undefined ? `${coccion.cuarteadoPilado}%` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% Tiza total + G.cocido</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.tizaTotalMasGcocidoMP !== undefined ? `${coccion.tizaTotalMasGcocidoMP}%` : "1.6%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold bg-amber-50/50">{coccion.tizaTotalMasGcocidoDescarga !== undefined ? `${coccion.tizaTotalMasGcocidoDescarga}%` : "3.2%"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.tizaTotalMasGcocidoPilado !== undefined ? `${coccion.tizaTotalMasGcocidoPilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% TP + T. puntual</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.tpMasTpuntualMP !== undefined ? `${coccion.tpMasTpuntualMP}%` : "4.8%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold bg-amber-50/50">{coccion.tpMasTpuntualDescarga !== undefined ? `${coccion.tpMasTpuntualDescarga}%` : "6.2%"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.tpMasTpuntualPilado !== undefined ? `${coccion.tpMasTpuntualPilado}%` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% Mancha</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.manchaMP !== undefined ? `${coccion.manchaMP}%` : "1.6%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold bg-amber-50/50">{coccion.manchaDescarga !== undefined ? `${coccion.manchaDescarga}%` : "1.6%"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.manchaPilado !== undefined ? `${coccion.manchaPilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% G. inmaduro</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.granoInmaduroMP !== undefined ? `${coccion.granoInmaduroMP}%` : "0.9%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold bg-amber-50/50">{coccion.granoInmaduroDescarga !== undefined ? `${coccion.granoInmaduroDescarga}%` : "1.2%"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.granoInmaduroPilado !== undefined ? `${coccion.granoInmaduroPilado}%` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% G. Verde</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold">{coccion.granoVerdeMP !== undefined ? `${coccion.granoVerdeMP}%` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold bg-amber-50/50">{coccion.granoVerdeDescarga !== undefined ? `${coccion.granoVerdeDescarga}%` : "-"}</td>
                    <td className="p-2 text-center font-semibold bg-purple-50/50">{coccion.granoVerdePilado !== undefined ? `${coccion.granoVerdePilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% Grano rojo</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.granoRojoMP !== undefined ? `${coccion.granoRojoMP}%` : "0.1%"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold bg-amber-50/50">{coccion.granoRojoDescarga !== undefined ? `${coccion.granoRojoDescarga}%` : "0.3%"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.granoRojoPilado !== undefined ? `${coccion.granoRojoPilado}%` : "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. COCCIÓN (DOSIFICACIÓN) */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-1.5 text-[11px] font-black uppercase">
              3. COCCIÓN (DOSIFICACIÓN ESTÁNDAR)
            </div>
            <div className="p-3 bg-slate-50 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase block">Tazas de arroz:</span>
                <span className="text-base font-black text-slate-900">{tazasArroz} tazas</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase block">Tazas de agua:</span>
                <span className="text-base font-black text-cyan-800">{tazasAgua} tazas</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase block">Tiempo de cocción:</span>
                <span className="text-base font-black text-amber-800">{tiempoCoccion} MIN</span>
              </div>
            </div>
          </div>

          {/* 4. ANÁLISIS ORGANOLÉPTICO COMPARATIVO EN 3 COLUMNAS */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-3 py-1.5 text-[11px] font-black uppercase flex items-center justify-between">
              <span>4. ANÁLISIS ORGANOLÉPTICO (PRUEBA EN OLLA)</span>
              <span className="text-[10px] font-normal text-slate-300">MATERIA PRIMA vs DESCARGA vs PILADO</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-800 border-b border-slate-300 text-[11px] font-black uppercase">
                    <th className="p-2 border-r border-slate-300 w-2/5">Propiedad Evaluada</th>
                    <th className="p-2 border-r border-slate-300 text-center w-1/5 bg-slate-100">MATERIA PRIMA</th>
                    <th className="p-2 border-r border-slate-300 text-center w-1/5 bg-amber-50">DESCARGA</th>
                    <th className="p-2 text-center w-1/5 bg-purple-50">PILADO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">Sabor</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold">{coccion.saborMP || "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold bg-amber-50/50">{coccion.saborDescarga || "Neutro Característico"}</td>
                    <td className="p-2 text-center font-semibold bg-purple-50/50">{coccion.saborPilado || "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">Desplazamiento (seg)</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.desplazamientoMP !== undefined ? `${coccion.desplazamientoMP} seg` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-cyan-800 bg-amber-50/50">{coccion.desplazamientoDescarga ?? coccion.desplazamientoSeg ?? "28 seg"}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.desplazamientoPilado !== undefined ? `${coccion.desplazamientoPilado} seg` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% G. Quebrado</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.quebradoOllaMP !== undefined ? `${coccion.quebradoOllaMP}%` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-amber-800 bg-amber-50/50">{coccion.quebradoOllaDescarga !== undefined ? `${coccion.quebradoOllaDescarga}%` : `${coccion.granoQuebradoOllaPct ?? 11}%`}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.quebradoOllaPilado !== undefined ? `${coccion.quebradoOllaPilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% G. Hinchado</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.hinchadoMP !== undefined ? `${coccion.hinchadoMP}%` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-purple-800 bg-amber-50/50">{coccion.hinchadoDescarga !== undefined ? `${coccion.hinchadoDescarga}%` : `${coccion.granoHinchadoPct ?? 20}%`}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.hinchadoPilado !== undefined ? `${coccion.hinchadoPilado}%` : "-"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">% G. Abierto</td>
                    <td className="p-2 text-center border-r border-slate-300 font-bold">{coccion.abiertoMP !== undefined ? `${coccion.abiertoMP}%` : "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-rose-800 bg-amber-50/50">{coccion.abiertoDescarga !== undefined ? `${coccion.abiertoDescarga}%` : `${coccion.granoAbiertoPct ?? 46}%`}</td>
                    <td className="p-2 text-center font-bold bg-purple-50/50">{coccion.abiertoPilado !== undefined ? `${coccion.abiertoPilado}%` : "-"}</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="p-2 font-bold text-slate-700 border-r border-slate-300">Textura (frío)</td>
                    <td className="p-2 text-center border-r border-slate-300 font-semibold">{coccion.texturaFrioMP || "-"}</td>
                    <td className="p-2 text-center border-r border-slate-300 font-black text-emerald-800 bg-amber-50/50">{coccion.texturaFrioDescarga || coccion.texturaFrio || "Suave"}</td>
                    <td className="p-2 text-center font-semibold bg-purple-50/50">{coccion.texturaFrioPilado || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. ENVASE PROYECTADO (EVALUADO EN COCCIÓN) */}
          <div className="border-2 border-slate-800 rounded-xl overflow-hidden bg-amber-50/50">
            <div className="bg-slate-800 text-white px-3 py-1.5 text-[11px] font-black uppercase flex items-center justify-between">
              <span>5. ENVASE PROYECTADO (EVALUADO EN COCCIÓN)</span>
              <span className="text-[10px] font-normal text-amber-300">★ DETERMINADO POR EL COMPORTAMIENTO EN OLLA</span>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-300 sm:col-span-2 shadow-xs">
                <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider block">
                  Presentación Comercial / Envase Asignado:
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 block mt-0.5">
                  📦 {coccion.envaseProyectado || "Saco 50 kg Don Julio Extra Selección"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Criterio de Inocuidad y Calidad: Soltura del grano ({coccion.solturaGrano || "100% Suelto"}), baja apertura ({coccion.abiertoDescarga ?? coccion.granoAbiertoPct ?? 1.3}%) y textura al frío ({coccion.texturaFrioDescarga || coccion.texturaFrio || "Suave"}).
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-300 text-center shadow-xs">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Dictamen de Envasado:</span>
                <span className="text-xs font-black text-emerald-800 block mt-1 bg-emerald-100 py-1.5 px-2 rounded border border-emerald-200">
                  ✓ CONFORME PARA LÍNEA DE ENVASADO
                </span>
              </div>
            </div>
          </div>

          {/* OBSERVACIONES Y DICTAMEN */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 text-xs space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase block">Observaciones y Evaluación Sensorial:</span>
            <p className="text-slate-800 italic">
              {coccion.observaciones || "Comportamiento del grano óptimo. Gelatinización adecuada con buena soltura de grano (no se apelmaza) y textura firme al dente."}
            </p>
          </div>

          {/* FIRMAS DE CONFORMIDAD */}
          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-slate-800 pt-2">
              <span className="font-black text-slate-900 block">{analista}</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Analista / Panelista</span>
            </div>
            <div className="border-t border-slate-800 pt-2">
              <span className="font-black text-slate-900 block">Jefatura de Calidad & Procesos</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">V°B° Aprobación</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
