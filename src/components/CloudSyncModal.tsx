import React, { useState, useEffect } from "react";
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Server, 
  X,
  Laptop,
  Trash2
} from "lucide-react";
import { cloudSyncService, CloudSyncStatus } from "../services/cloudSyncService";
import { localDB } from "../utils/localDB";

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete
}) => {
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(cloudSyncService.status);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localLotesCount, setLocalLotesCount] = useState(0);
  const [showConfirmPurge, setShowConfirmPurge] = useState(false);

  useEffect(() => {
    const unsub = cloudSyncService.subscribeStatus((newStatus) => {
      setSyncStatus(newStatus);
    });
    setLocalLotesCount(localDB.getLotes().length);

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePull = async () => {
    setIsProcessing(true);
    setSuccessMessage(null);
    try {
      const ok = await cloudSyncService.pullAllFromCloud();
      if (ok) {
        setSuccessMessage("¡Datos descargados y actualizados con éxito desde la nube!");
        setLocalLotesCount(localDB.getLotes().length);
        if (onSyncComplete) onSyncComplete();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePush = async () => {
    setIsProcessing(true);
    setSuccessMessage(null);
    try {
      const ok = await cloudSyncService.pushAllLocalToCloud();
      if (ok) {
        setSuccessMessage("¡Todos los datos locales han sido subidos a la nube! Ahora estarán disponibles en todas las demás computadoras.");
        setLocalLotesCount(localDB.getLotes().length);
        if (onSyncComplete) onSyncComplete();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurge = async () => {
    setIsProcessing(true);
    setSuccessMessage(null);
    try {
      await cloudSyncService.purgeAllOperationalData();
      setSuccessMessage("¡Información registrada eliminada exitosamente! El sistema está limpio y listo para iniciar las pruebas.");
      setLocalLotesCount(0);
      setShowConfirmPurge(false);
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        id="cloud-sync-modal"
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <Cloud className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Sincronización en la Nube
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  Firebase Activo
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Base de datos centralizada multi-dispositivo en tiempo real
              </p>
            </div>
          </div>
          <button
            id="close-cloud-sync-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Explanation Alert */}
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-slate-300 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Sincronización 100% Automática</span>
            </div>
            <p>
              <strong>NO necesitas presionar ningún botón.</strong> Todo lote, humedad, batch o análisis que registres o edites se envía a la nube en tiempo real de forma automática.
            </p>
            <p className="text-slate-400">
              Cualquier otra computadora con el sistema abierto recibe los cambios al instante sin necesidad de recargar la página. Los botones de abajo solo son útiles si deseas forzar una actualización manual.
            </p>
          </div>

          {/* Metric Status Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
                Conexión
              </span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-sm font-semibold text-emerald-400">
                  En Tiempo Real
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
                Lotes en la Nube
              </span>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">
                  {syncStatus.totalCloudLotes > 0 ? `${syncStatus.totalCloudLotes} Lotes` : `${localLotesCount} Lotes`}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl col-span-2 sm:col-span-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
                Esta Máquina
              </span>
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">
                  {localLotesCount} Locales
                </span>
              </div>
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs animate-fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {syncStatus.error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{syncStatus.error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              id="btn-pull-cloud-data"
              onClick={handlePull}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <DownloadCloud className={`w-4 h-4 ${isProcessing ? 'animate-bounce' : ''}`} />
              {isProcessing ? "Procesando..." : "Descargar y Actualizar de la Nube"}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Trae inmediatamente a esta máquina cualquier dato que hayas ingresado en otra computadora.
            </p>

            <div className="relative py-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <span className="relative px-3 bg-slate-900 text-slate-400 text-[11px] uppercase tracking-wider">O también</span>
            </div>

            <button
              id="btn-push-cloud-data"
              onClick={handlePush}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-xl font-medium text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              Subir Todos los Datos Locales a la Nube
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Sube todos los datos que tengas guardados en esta máquina para que queden centralizados en el servidor.
            </p>

            {/* Zona de Peligro: Reiniciar base de datos para pruebas */}
            <div className="pt-3 mt-2 border-t border-slate-800/80">
              {!showConfirmPurge ? (
                <button
                  id="btn-open-confirm-purge"
                  type="button"
                  onClick={() => setShowConfirmPurge(true)}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 bg-rose-950/20 hover:bg-rose-950/50 text-rose-300 border border-rose-900/40 hover:border-rose-700/60 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Eliminar Información Registrada para Iniciar Pruebas
                </button>
              ) : (
                <div className="p-3.5 bg-rose-950/50 border border-rose-700/60 rounded-xl space-y-2.5 animate-fade-in">
                  <div className="text-xs text-rose-200 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ¿Confirmas eliminar toda la información para pruebas?
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Se eliminarán de forma definitiva todos los lotes, registros de humedad, análisis y batches registrados en la nube (Firestore) y en esta máquina local, dejándote el sistema totalmente limpio desde cero.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      id="btn-confirm-purge-execute"
                      type="button"
                      onClick={handlePurge}
                      disabled={isProcessing}
                      className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-900/50"
                    >
                      {isProcessing ? "Eliminando..." : "Sí, Eliminar Toda la Información"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPurge(false)}
                      disabled={isProcessing}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            id="btn-close-cloud-sync"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
