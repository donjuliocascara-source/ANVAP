import React, { useState, useEffect } from "react";
import { 
  GitCommit, 
  X, 
  Layers, 
  Scale, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  Search, 
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { Lote, BatchVaporizado, BatchLote, ParametrosTrabajo } from "../types";

interface TrazabilidadModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "batch" | "lote";
  targetId: string;
  lotes: Lote[];
  batches: BatchVaporizado[];
  batchLotes: BatchLote[];
  parametros?: ParametrosTrabajo;
}

export const TrazabilidadModal: React.FC<TrazabilidadModalProps> = ({
  isOpen,
  onClose,
  targetType: initialTargetType,
  targetId: initialTargetId,
  lotes,
  batches,
  batchLotes,
  parametros
}) => {
  const [targetType, setTargetType] = useState<"batch" | "lote">(initialTargetType);
  const [currentId, setCurrentId] = useState<string>(initialTargetId);

  useEffect(() => {
    setTargetType(initialTargetType);
    setCurrentId(initialTargetId);
  }, [initialTargetType, initialTargetId, isOpen]);

  if (!isOpen) return null;

  // If viewing a Batch
  const selectedBatch = batches.find(b => b.BATCH_ID === currentId || b.CORRELATIVO === currentId);
  const lotesInBatch = selectedBatch 
    ? batchLotes.filter(bl => bl.BATCH_ID === selectedBatch.BATCH_ID)
    : [];

  // If viewing a Lote
  const selectedLote = lotes.find(l => l.LOTE_ID === currentId);
  const batchesOfLote = selectedLote
    ? batchLotes.filter(bl => bl.LOTE_ID === selectedLote.LOTE_ID)
    : [];

  const totalProcesadoLote = batchesOfLote.reduce((acc, bl) => acc + (Number(bl.PESO_KG) || 0), 0);
  const pesoOriginalLote = Number(selectedLote?.PESO_KG) || 0;
  const saldoPendienteLote = Math.max(0, pesoOriginalLote - totalProcesadoLote);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div 
        id="modal-trazabilidad"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <GitCommit className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Trazabilidad Ininterrumpida
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 font-mono">
                  {targetType === "batch" ? (selectedBatch?.CORRELATIVO || currentId) : currentId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Conservación estricta de la relación: BATCH ↔ LOTES ↔ CANTIDAD UTILIZADA
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {targetType === "batch" && selectedBatch ? (
            /* TRAZABILIDAD DESDE EL BATCH */
            <div className="space-y-6">
              {/* Batch Summary Card */}
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-bold text-amber-400 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      {selectedBatch.CORRELATIVO || selectedBatch.BATCH_ID}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white">{selectedBatch.EQUIPO}</h3>
                      <p className="text-xs text-slate-400">
                        {selectedBatch.FECHA_PROGRAMADA} • {selectedBatch.TURNO || "Turno Día"} • Op: {selectedBatch.OPERADOR || "Pedro Huamán"}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    {selectedBatch.ESTADO_BATCH}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">PESO TOTAL:</span>
                    <strong className="text-white text-sm">{(selectedBatch.PESO_TOTAL_KG || 0).toLocaleString()} kg</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">TONELADAS:</span>
                    <strong className="text-amber-300 text-sm">{(selectedBatch.TON_PROGRAMADAS || 0).toFixed(2)} TN</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">USO SECADORA:</span>
                    <strong className="text-emerald-400 text-sm">{selectedBatch.CAPACIDAD_UTILIZADA_PCT || 100}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">COMPATIBILIDAD:</span>
                    <strong className="text-white text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {selectedBatch.ESTADO_COMPATIBILIDAD || "COMPATIBLE"}
                    </strong>
                  </div>
                </div>

                {selectedBatch.ES_EXCEPCIONAL_PAMPA && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2">
                    <span>⚡ <strong>Capacidad Excepcional:</strong> El excedente debe secarse en pampa.</span>
                  </div>
                )}
              </div>

              {/* Lotes que componen este Batch */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Lotes que integran este Batch ({lotesInBatch.length})
                </h4>

                <div className="border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-900/40">
                  {lotesInBatch.map((bl, idx) => {
                    const lObj = lotes.find(l => l.LOTE_ID === bl.LOTE_ID);

                    return (
                      <div key={bl.BATCH_LOTE_ID || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setTargetType("lote");
                                  setCurrentId(bl.LOTE_ID);
                                }}
                                className="text-sm font-bold text-white font-mono hover:text-amber-400 transition-colors flex items-center gap-1 group"
                              >
                                {bl.LOTE_ID}
                                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400" />
                              </button>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                                {bl.CLIENTE || lObj?.CLIENTE}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-medium">
                                {bl.VARIEDAD || lObj?.VARIEDAD}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 mt-1">
                              Defectos: <strong>{bl.DEFECTOS_PCT || 0}%</strong> • Quebrado: <strong>{bl.QUEBRADO_PCT || 0}%</strong> • Humedad Inicial: <strong>{lObj?.HUM || 0}%</strong>
                            </p>
                          </div>
                        </div>

                        {/* Used weight & contribution */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-xs text-slate-500 block">Cantidad Utilizada:</span>
                            <span className="text-sm font-mono font-bold text-emerald-400">
                              {(bl.PESO_KG || 0).toLocaleString()} kg
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1">({bl.SACOS} sacos)</span>
                          </div>

                          <div className="pl-4 border-l border-slate-700 text-left">
                            <span className="text-[10px] text-slate-500 block">% del Lote:</span>
                            <span className="text-xs font-mono font-semibold text-slate-300">
                              {bl.PORCENTAJE_LOTE || 100}%
                            </span>
                            {bl.TOTAL_PARTES && bl.TOTAL_PARTES > 1 && (
                              <span className="block text-[10px] text-blue-400 font-bold">
                                Parte {bl.PARTE}/{bl.TOTAL_PARTES}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : targetType === "lote" && selectedLote ? (
            /* TRAZABILIDAD DESDE EL LOTE */
            <div className="space-y-6">
              {/* Lote Summary Card */}
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-bold text-amber-400 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      {selectedLote.LOTE_ID}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white">{selectedLote.CLIENTE}</h3>
                      <p className="text-xs text-slate-400">
                        {selectedLote.VARIEDAD} • {selectedLote.ZONA} • Humedad: {selectedLote.HUM}%
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                    saldoPendienteLote <= 0.01
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : totalProcesadoLote > 0
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                  }`}>
                    {saldoPendienteLote <= 0.01 ? "PROCESADO / COMPLETO" : totalProcesadoLote > 0 ? "PARCIALMENTE PROCESADO" : "PENDIENTE"}
                  </span>
                </div>

                {/* Saldos Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">PESO TOTAL ORIGINAL:</span>
                    <strong className="text-white text-sm">{pesoOriginalLote.toLocaleString()} kg</strong>
                    <span className="text-[11px] text-slate-400 ml-1">({selectedLote.SACOS} sacos)</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">PROCESADO ACUMULADO:</span>
                    <strong className="text-emerald-400 text-sm">{totalProcesadoLote.toLocaleString()} kg</strong>
                    <span className="text-[11px] text-slate-400 ml-1">
                      ({pesoOriginalLote > 0 ? ((totalProcesadoLote / pesoOriginalLote) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">SALDO PENDIENTE:</span>
                    <strong className="text-amber-400 text-sm">{saldoPendienteLote.toLocaleString()} kg</strong>
                    <span className="text-[11px] text-slate-400 ml-1">({Math.round(saldoPendienteLote / 50)} sacos)</span>
                  </div>
                </div>
              </div>

              {/* Batches en los que participó este Lote */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <GitCommit className="w-4 h-4 text-amber-400" />
                  Batches donde fue procesado este Lote ({batchesOfLote.length})
                </h4>

                {batchesOfLote.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-700 rounded-xl text-slate-400 text-xs">
                    Este lote aún no ha sido asignado a ningún Batch de vaporizado.
                  </div>
                ) : (
                  <div className="border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-900/40">
                    {batchesOfLote.map((bl, idx) => {
                      const bObj = batches.find(b => b.BATCH_ID === bl.BATCH_ID);
                      const corr = bObj?.CORRELATIVO || bl.BATCH_ID;

                      return (
                        <div key={bl.BATCH_LOTE_ID || idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setTargetType("batch");
                                    setCurrentId(bl.BATCH_ID);
                                  }}
                                  className="text-sm font-bold text-amber-400 font-mono hover:underline flex items-center gap-1 group"
                                >
                                  BATCH {corr}
                                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400" />
                                </button>
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {bObj?.EQUIPO || "Autoclave"}
                                </span>
                              </div>

                              <p className="text-xs text-slate-400 mt-1">
                                {bObj?.FECHA_PROGRAMADA} • {bObj?.TURNO || "Turno Día"} • {bl.TOTAL_PARTES && bl.TOTAL_PARTES > 1 ? `Parte ${bl.PARTE} de ${bl.TOTAL_PARTES}` : "Carga Única"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-xs text-slate-500 block">Cantidad Asignada a este Batch:</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {(bl.PESO_KG || 0).toLocaleString()} kg
                            </span>
                            <span className="text-xs text-slate-400 ml-1">({bl.SACOS} sacos)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">
              Elemento no encontrado.
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cerrar Trazabilidad
          </button>
        </div>
      </div>
    </div>
  );
};
