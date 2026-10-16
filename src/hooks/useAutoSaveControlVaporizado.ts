import { useState, useEffect, useRef, useCallback } from "react";
import { ControlVaporizado } from "../types";
import { localDB } from "../utils/localDB";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseAutoSaveControlVaporizadoOptions {
  batchId?: string;
  currentUser?: { nombre?: string };
  debounceMs?: number;
  onSave?: (data: Partial<ControlVaporizado>) => Promise<any> | void;
  enabled?: boolean;
}

export interface UseAutoSaveControlVaporizadoReturn {
  autoSaveStatus: AutoSaveStatus;
  lastSavedTime: string;
  saveNow: (overrideData?: Partial<ControlVaporizado>) => Promise<boolean>;
  isSaving: boolean;
  errorMessage: string | null;
  resetStatus: () => void;
}

/**
 * Custom Hook: useAutoSaveControlVaporizado
 * 
 * Sincroniza automáticamente los datos de Control de Vaporizado en tiempo real con la base de datos
 * aplicando debounce (anti-rebote) cuando se modifican campos de temperatura, humedad, tiempos,
 * perfiles de secado o silos.
 * 
 * También mantiene un respaldo local instantáneo (localStorage) para máxima fiabilidad.
 */
export function useAutoSaveControlVaporizado(
  formData: Partial<ControlVaporizado>,
  options: UseAutoSaveControlVaporizadoOptions = {}
): UseAutoSaveControlVaporizadoReturn {
  const {
    batchId,
    currentUser,
    debounceMs = 400,
    onSave,
    enabled = true
  } = options;

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References to handle debounce, initial mount, and latest values
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  const prevBatchIdRef = useRef<string | undefined>(batchId);
  const formDataRef = useRef<Partial<ControlVaporizado>>(formData);
  const lastSerializedSavedRef = useRef<string>("");
  const hasPendingChangesRef = useRef<boolean>(false);
  const onSaveRef = useRef(onSave);
  const currentUserRef = useRef(currentUser);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Helper to persist draft synchronously to localStorage under both BATCH_ID and CORRELATIVO
  const saveLocalDraftSync = useCallback((dataToDraft: Partial<ControlVaporizado>, fallbackBatchId?: string) => {
    const targetBatchId = (dataToDraft.BATCH_ID || fallbackBatchId || "").trim();
    if (!targetBatchId) return;
    try {
      const payload: Partial<ControlVaporizado> = {
        ...dataToDraft,
        BATCH_ID: targetBatchId,
        OPERADOR: dataToDraft.OPERADOR || currentUserRef.current?.nombre || "Operador de Planta"
      };
      const serialized = JSON.stringify(payload);
      localStorage.setItem(`apit_draft_ctrl_${targetBatchId}`, serialized);
      localStorage.setItem(`apit_draft_ctrl_${targetBatchId.toUpperCase()}`, serialized);
      const corr = (dataToDraft.CORRELATIVO || dataToDraft.datosIngreso?.codigo || "").toString().trim();
      if (corr && corr.toUpperCase() !== targetBatchId.toUpperCase()) {
        localStorage.setItem(`apit_draft_ctrl_${corr}`, serialized);
        localStorage.setItem(`apit_draft_ctrl_${corr.toUpperCase()}`, serialized);
      }
    } catch (storageErr) {
      console.warn("[AutoSave] Error en respaldo localStorage:", storageErr);
    }
  }, []);

  // Keep latest formData in ref
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Execute database save
  const performSave = useCallback(
    async (dataToSave: Partial<ControlVaporizado>, overrideBatchId?: string): Promise<boolean> => {
      const targetBatchId = (dataToSave.BATCH_ID || overrideBatchId || batchId || "").trim();
      if (!targetBatchId || !enabledRef.current) return false;

      setAutoSaveStatus("saving");
      setErrorMessage(null);

      try {
        const payload: Partial<ControlVaporizado> = {
          ...dataToSave,
          BATCH_ID: targetBatchId,
          OPERADOR: dataToSave.OPERADOR || currentUserRef.current?.nombre || "Operador de Planta"
        };

        // 1. Instant local persistence (safe offline fallback)
        saveLocalDraftSync(payload, targetBatchId);

        // 2. Always persist in localDB immediately so switching tabs has the latest state synchronously
        localDB.saveControlVaporizado(payload, currentUserRef.current?.nombre || "Operador");

        // 3. Parent / Cloud Synchronization
        if (onSaveRef.current) {
          await onSaveRef.current(payload);
        }

        lastSerializedSavedRef.current = JSON.stringify(dataToSave);
        hasPendingChangesRef.current = false;
        setAutoSaveStatus("saved");
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
        setLastSavedTime(timeStr);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("control_vaporizado_saved", {
              detail: { batchId: targetBatchId, timestamp: timeStr }
            })
          );
        }

        return true;
      } catch (err: any) {
        console.error("[AutoSave] Error sincronizando con BD:", err);
        setAutoSaveStatus("error");
        setErrorMessage(err?.message || "Error al sincronizar con el servidor");
        return false;
      }
    },
    [batchId, saveLocalDraftSync]
  );

  // Track batch changes and flush any pending changes for the previous batch before switching
  useEffect(() => {
    if (batchId !== prevBatchIdRef.current) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (hasPendingChangesRef.current && prevBatchIdRef.current && formDataRef.current) {
        const prevData = formDataRef.current;
        const prevId = prevBatchIdRef.current;
        if ((prevData.BATCH_ID || "").toUpperCase() === prevId.toUpperCase()) {
          saveLocalDraftSync(prevData, prevId);
          localDB.saveControlVaporizado(
            { ...prevData, BATCH_ID: prevId, OPERADOR: prevData.OPERADOR || currentUserRef.current?.nombre || "Operador de Planta" },
            currentUserRef.current?.nombre || "Operador"
          );
          if (onSaveRef.current) {
            Promise.resolve(onSaveRef.current({ ...prevData, BATCH_ID: prevId })).catch(() => {});
          }
        }
        hasPendingChangesRef.current = false;
      }
      prevBatchIdRef.current = batchId;
      isMountedRef.current = false;
      setAutoSaveStatus("saved");
      setErrorMessage(null);
    }
  }, [batchId, saveLocalDraftSync]);

  // Flush pending changes on component unmount (when switching app tabs), visibility change or beforeunload
  useEffect(() => {
    const handleFlush = () => {
      if (hasPendingChangesRef.current && formDataRef.current) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        performSave(formDataRef.current, prevBatchIdRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleFlush();
      }
    };

    const handleBeforeUnload = () => {
      if (hasPendingChangesRef.current && formDataRef.current) {
        const targetId = formDataRef.current.BATCH_ID || prevBatchIdRef.current;
        if (targetId) {
          saveLocalDraftSync(formDataRef.current, targetId);
          try {
            localDB.saveControlVaporizado(
              {
                ...formDataRef.current,
                BATCH_ID: targetId,
                OPERADOR: formDataRef.current.OPERADOR || currentUserRef.current?.nombre || "Operador de Planta"
              },
              currentUserRef.current?.nombre || "Operador"
            );
          } catch {
            // ignore
          }
        }
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (hasPendingChangesRef.current && formDataRef.current) {
        const targetId = formDataRef.current.BATCH_ID || prevBatchIdRef.current;
        if (targetId && enabledRef.current) {
          const payload: Partial<ControlVaporizado> = {
            ...formDataRef.current,
            BATCH_ID: targetId,
            OPERADOR: formDataRef.current.OPERADOR || currentUserRef.current?.nombre || "Operador de Planta"
          };
          saveLocalDraftSync(payload, targetId);
          localDB.saveControlVaporizado(payload, currentUserRef.current?.nombre || "Operador");
          if (onSaveRef.current) {
            Promise.resolve(onSaveRef.current(payload)).catch(() => {});
          }
          hasPendingChangesRef.current = false;
        }
      }
    };
  }, [performSave, saveLocalDraftSync]);

  // Manual immediate save function
  const saveNow = useCallback(
    async (overrideData?: Partial<ControlVaporizado>): Promise<boolean> => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const data = overrideData || formDataRef.current;
      return await performSave(data);
    },
    [performSave]
  );

  // Reset status
  const resetStatus = useCallback(() => {
    setAutoSaveStatus("saved");
    setErrorMessage(null);
  }, []);

  // Main Debounced Effect when form data (temperatures, moisture, times, etc.) changes
  useEffect(() => {
    // Skip first mount or if no batchId/data
    if (!batchId || !enabled) return;

    if (!isMountedRef.current) {
      isMountedRef.current = true;
      lastSerializedSavedRef.current = JSON.stringify(formData);
      return;
    }

    const serializedCurrent = JSON.stringify(formData);
    // Don't trigger if nothing actually changed
    if (serializedCurrent === lastSerializedSavedRef.current) {
      return;
    }

    // Immediately persist draft to localStorage & localDB so switching tabs even 1ms later never loses data
    hasPendingChangesRef.current = true;
    saveLocalDraftSync(formData, batchId);
    try {
      const targetId = (formData.BATCH_ID || batchId || "").trim();
      if (targetId) {
        localDB.saveControlVaporizado(
          {
            ...formData,
            BATCH_ID: targetId,
            OPERADOR: formData.OPERADOR || currentUserRef.current?.nombre || "Operador de Planta"
          },
          currentUserRef.current?.nombre || "Operador"
        );
      }
    } catch (e) {
      console.warn("[AutoSave] Error guardando instantáneamente en localDB:", e);
    }

    // Set status to pending/saving indicator
    setAutoSaveStatus("saving");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      await performSave(formData);
    }, debounceMs);
  }, [formData, batchId, enabled, debounceMs, performSave, saveLocalDraftSync]);

  return {
    autoSaveStatus,
    lastSavedTime,
    saveNow,
    isSaving: autoSaveStatus === "saving",
    errorMessage,
    resetStatus
  };
}
