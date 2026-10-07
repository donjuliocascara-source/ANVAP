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
    debounceMs = 700,
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

  // Keep latest formData in ref
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Track batch changes
  useEffect(() => {
    if (batchId !== prevBatchIdRef.current) {
      prevBatchIdRef.current = batchId;
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setAutoSaveStatus("saved");
      setErrorMessage(null);
    }
  }, [batchId]);

  // Execute database save
  const performSave = useCallback(
    async (dataToSave: Partial<ControlVaporizado>): Promise<boolean> => {
      const targetBatchId = dataToSave.BATCH_ID || batchId;
      if (!targetBatchId || !enabled) return false;

      setAutoSaveStatus("saving");
      setErrorMessage(null);

      try {
        const payload: Partial<ControlVaporizado> = {
          ...dataToSave,
          BATCH_ID: targetBatchId,
          OPERADOR: dataToSave.OPERADOR || currentUser?.nombre || "Operador de Planta"
        };

        // 1. Instant local persistence (safe offline fallback)
        try {
          localStorage.setItem(`apit_draft_ctrl_${targetBatchId}`, JSON.stringify(payload));
        } catch (storageErr) {
          console.warn("[AutoSave] Error en respaldo localStorage:", storageErr);
        }

        // 2. Database Synchronization
        if (onSave) {
          await onSave(payload);
        } else {
          // Direct localDB persistence (offline / client-side)
          localDB.saveControlVaporizado(payload, currentUser?.nombre || "Operador");
        }

        lastSerializedSavedRef.current = JSON.stringify(payload);
        setAutoSaveStatus("saved");
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
        setLastSavedTime(timeStr);
        return true;
      } catch (err: any) {
        console.error("[AutoSave] Error sincronizando con BD:", err);
        setAutoSaveStatus("error");
        setErrorMessage(err?.message || "Error al sincronizar con el servidor");
        return false;
      }
    },
    [batchId, currentUser?.nombre, enabled, onSave]
  );

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

    // Set status to pending/saving indicator
    setAutoSaveStatus("saving");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      await performSave(formData);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData, batchId, enabled, debounceMs, performSave]);

  return {
    autoSaveStatus,
    lastSavedTime,
    saveNow,
    isSaving: autoSaveStatus === "saving",
    errorMessage,
    resetStatus
  };
}
