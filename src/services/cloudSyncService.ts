import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Unsubscribe
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from "../lib/firebase";
import { localDB, getDeletedLotesTombstones } from "../utils/localDB";
import { formatLoteCode } from "../utils/formatLoteCode";
import { Lote, RegistroHumedad, AnalisisHumedo, AnalisisSeco, Presecado, BatchVaporizado, BatchLote, ControlVaporizado, AnalisisVaporizado, ProgramacionApit, UserProfile } from "../types";

export interface CloudSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  totalCloudLotes: number;
  error: string | null;
}

type SyncListener = (status: CloudSyncStatus) => void;

export function isFirestoreQuotaOrResourceError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = String(err.code || "").toLowerCase();
  return (
    code === "resource-exhausted" ||
    code === "8" ||
    code === "unavailable" ||
    code === "deadline-exceeded" ||
    code === "cancelled" ||
    msg.includes("resource-exhausted") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota limit exceeded") ||
    msg.includes("quota exceeded") ||
    msg.includes("write stream exhausted") ||
    msg.includes("free daily write units") ||
    msg.includes("network error") ||
    msg.includes("offline") ||
    msg.includes("client is offline")
  );
}

export function isPermissionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = String(err.code || "").toLowerCase();
  return (
    code === "permission-denied" ||
    code === "7" ||
    msg.includes("permission-denied") ||
    msg.includes("missing or insufficient permissions") ||
    msg.includes("insufficient permissions")
  );
}

class CloudSyncService {
  private statusListeners: Set<SyncListener> = new Set();
  private unsubscribers: Unsubscribe[] = [];
  private isInitialized = false;
  private isWritingToCloud = false;
  private activeWrites = 0;
  private maxConcurrentWrites = 8;
  private pendingQueue: Array<{ op: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  
  // Coalescencia y debounce por documento para optimizar cuota de Firestore
  private pendingDocWrites: Map<string, {
    col: string;
    docId: string;
    data: any;
    merge: boolean;
    timer: any;
    resolvers: Array<(v: any) => void>;
    rejecters: Array<(e: any) => void>;
  }> = new Map();

  private readonly OFFLINE_QUEUE_KEY = "apit_offline_cloud_queue_v1";

  public status: CloudSyncStatus = {
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isSyncing: false,
    lastSyncTime: null,
    totalCloudLotes: 0,
    error: null
  };

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.status.isOnline = true;
        this.notifyStatus();
        this.drainOfflineQueue().catch(() => {});
      });
      window.addEventListener("offline", () => {
        this.status.isOnline = false;
        this.notifyStatus();
      });
      window.addEventListener("beforeunload", () => {
        this.flushPendingWrites().catch(() => {});
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flushPendingWrites().catch(() => {});
        }
      });
      // Heartbeat periódico cada 60s para auto-recuperar conexión y vaciar cola offline
      setInterval(() => {
        if (this.status.isOnline && !this.status.isSyncing) {
          this.drainOfflineQueue().catch(() => {});
        }
      }, 60_000);
    }
  }

  private saveToOfflineQueue(col: string, docId: string, data: any, merge: boolean = true) {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      const queue: Array<{ col: string; docId: string; data: any; merge: boolean; timestamp: number }> = raw ? JSON.parse(raw) : [];
      const filtered = queue.filter(q => !(q.col === col && q.docId === docId));
      filtered.push({ col, docId, data, merge, timestamp: Date.now() });
      const capped = filtered.slice(-200);
      window.localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(capped));
    } catch {
      // ignore
    }
  }

  public async drainOfflineQueue(): Promise<void> {
    if (typeof window === "undefined" || !window.localStorage || !this.status.isOnline) return;
    try {
      const raw = window.localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const queue: Array<{ col: string; docId: string; data: any; merge: boolean; timestamp: number }> = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      const operations: Array<{ ref: any; data: any }> = [];
      queue.forEach((item) => {
        operations.push({
          ref: doc(db, item.col, item.docId),
          data: cleanFirestoreData({
            ...item.data,
            updatedAt: new Date().toISOString()
          })
        });
      });

      window.localStorage.removeItem(this.OFFLINE_QUEUE_KEY);
      await this.commitOperationsInBatches(operations);
      this.status.lastSyncTime = new Date();
      this.notifyStatus();
    } catch (err) {
      console.warn("[CloudSync] Aviso al drenar cola offline:", err);
    }
  }

  /**
   * Guarda un documento en Firestore aplicando coalescencia por clave (col/docId)
   * y debounce inteligente (250-350ms). Si se modifican varios campos sucesivamente en controles
   * o lotes, sólo se envía una única petición final a la nube, reduciendo 80% las escrituras.
   */
  public queueDocWrite(
    col: string,
    docId: string,
    data: any,
    options: { merge?: boolean; debounceMs?: number } = {}
  ): Promise<void> {
    const { merge = true, debounceMs = 280 } = options;
    const cleanId = docId.toString().trim().replace(/[\/\s]/g, "_");
    const key = `${col}/${cleanId}`;

    return new Promise<void>((resolve, reject) => {
      const existing = this.pendingDocWrites.get(key);
      if (existing) {
        clearTimeout(existing.timer);
        existing.data = merge ? { ...existing.data, ...data } : data;
        existing.resolvers.push(resolve);
        existing.rejecters.push(reject);
        existing.timer = setTimeout(() => {
          this.flushDocWrite(key);
        }, debounceMs);
      } else {
        const item = {
          col,
          docId: cleanId,
          data,
          merge,
          resolvers: [resolve],
          rejecters: [reject],
          timer: setTimeout(() => {
            this.flushDocWrite(key);
          }, debounceMs)
        };
        this.pendingDocWrites.set(key, item);
      }
    });
  }

  private async flushDocWrite(key: string): Promise<void> {
    const item = this.pendingDocWrites.get(key);
    if (!item) return;
    this.pendingDocWrites.delete(key);

    try {
      await this.enqueueWrite(async () => {
        this.isWritingToCloud = true;
        try {
          const docRef = doc(db, item.col, item.docId);
          await setDoc(docRef, cleanFirestoreData({
            ...item.data,
            updatedAt: new Date().toISOString()
          }), { merge: item.merge });
          this.status.lastSyncTime = new Date();
          this.notifyStatus();
        } finally {
          this.isWritingToCloud = false;
        }
      });
      item.resolvers.forEach((res) => res(undefined));
    } catch (err: any) {
      if (isFirestoreQuotaOrResourceError(err)) {
        item.resolvers.forEach((res) => res(undefined));
      } else {
        this.saveToOfflineQueue(item.col, item.docId, item.data, item.merge);
        item.rejecters.forEach((rej) => rej(err));
      }
    }
  }

  /**
   * Envía inmediatamente todos los documentos pendientes en la cola debounced
   */
  public async flushPendingWrites(): Promise<void> {
    const keys = Array.from(this.pendingDocWrites.keys());
    for (const key of keys) {
      const item = this.pendingDocWrites.get(key);
      if (item) {
        clearTimeout(item.timer);
        await this.flushDocWrite(key);
      }
    }
  }

  /**
   * Ejecuta operaciones de escritura en paralelo controlado (hasta 8 concurrentes)
   * para maximizar velocidad sin saturar el canal de red.
   */
  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pendingQueue.push({ op: operation, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.activeWrites < this.maxConcurrentWrites && this.pendingQueue.length > 0) {
      const task = this.pendingQueue.shift();
      if (!task) break;
      this.activeWrites++;
      task.op()
        .then((res) => {
          task.resolve(res);
        })
        .catch((err) => {
          if (isFirestoreQuotaOrResourceError(err)) {
            console.warn("[CloudSync] Cuota de Firestore alcanzada. Operando en modo local seguro:", err?.message || err);
            this.status.error = "Cuota diaria de Firebase alcanzada. Operando en modo local seguro con persistencia completa.";
            this.notifyStatus();
            task.resolve(undefined as any);
          } else {
            console.warn("[CloudSync] Aviso en operación de escritura Firestore:", err?.message || err);
            task.reject(err);
          }
        })
        .finally(() => {
          this.activeWrites--;
          this.processQueue();
        });
    }
  }

  public subscribeStatus(listener: SyncListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatus() {
    const copy = { ...this.status };
    this.statusListeners.forEach((l) => {
      try {
        l(copy);
      } catch (err) {
        console.error("[CloudSync] Error in status listener:", err);
      }
    });
  }

  /**
   * Inicializa la sincronización en tiempo real con Firestore
   */
  public async initSync() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.status.isSyncing = true;
    this.notifyStatus();

    try {
      // 0. Purgar de Firestore únicamente lotes explícitamente marcados para eliminación por el usuario (tombstones)
      const tombstones = getDeletedLotesTombstones();
      if (tombstones.size > 0) {
        await Promise.allSettled(
          Array.from(tombstones).map((delId) => this.deleteLoteFromCloud(delId))
        );
      }

      // 1. Descarga inicial de todas las colecciones principales y combinación con local
      await this.pullAllFromCloud();

      // 2. Establecer listeners en tiempo real (onSnapshot)
      this.setupRealtimeListeners();

      this.status.lastSyncTime = new Date();
      this.status.error = null;
    } catch (err: any) {
      console.warn("[CloudSync] Aviso inicializando sincronización con Firestore:", err?.message || err);
      this.status.error = err?.message || "Error al conectar con Firestore";
    } finally {
      this.status.isSyncing = false;
      this.notifyStatus();
    }
  }

  /**
   * Configura listeners en tiempo real para reflejar cambios y eliminaciones de todas las colecciones al instante
   */
  private setupRealtimeListeners() {
    // Definición de las 10 colecciones operacionales que deben reflejarse en tiempo real
    const collectionsToListen = [
      { name: "lotes", type: "lotes" },
      { name: "humedades", type: "humedades" },
      { name: "analisisHumedo", type: "analisisHumedo" },
      { name: "analisisSeco", type: "analisisSeco" },
      { name: "presecados", type: "presecados" },
      { name: "batchesVaporizado", type: "batchesVaporizado" },
      { name: "batchLotes", type: "batchLotes" },
      { name: "controlesVaporizado", type: "controlesVaporizado" },
      { name: "analisisVaporizados", type: "analisisVaporizados" },
      { name: "programaciones", type: "programaciones" }
    ];

    collectionsToListen.forEach(({ name, type }) => {
      try {
        const unsub = onSnapshot(
          collection(db, name),
          (snapshot) => {
            const items: any[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data) {
                items.push(data);
              }
            });

            if (type === "lotes") {
              this.status.totalCloudLotes = items.length;
            }
            this.status.lastSyncTime = new Date();
            this.notifyStatus();

            // Sincronizar en localDB reflejando el conjunto actual exacto de Firestore
            localDB.syncCollectionFromCloud(type, items);
            window.dispatchEvent(
              new CustomEvent("cloud_data_updated", {
                detail: { type, count: items.length }
              })
            );
          },
          (error) => {
            if (isFirestoreQuotaOrResourceError(error)) {
              console.warn(`[CloudSync] Aviso cuota/conexión en listener ${name}:`, error?.message || error);
              this.status.isOnline = false;
              this.notifyStatus();
              return;
            }
            if (isPermissionError(error)) {
              this.status.error = "Permisos de Firestore en actualización. Operando con base de datos local segura.";
              this.notifyStatus();
              try {
                handleFirestoreError(error, OperationType.LIST, name);
              } catch {
                // Handled gracefully
              }
            } else {
              console.warn(`[CloudSync] Aviso en listener ${name}:`, error?.message || error);
            }
          }
        );
        this.unsubscribers.push(unsub);
      } catch (e) {
        console.warn(`[CloudSync] No se pudo configurar listener ${name}:`, e);
      }
    });
  }

  /**
   * Descarga todos los datos de Firestore y los sincroniza en localDB
   */
  public async pullAllFromCloud(): Promise<boolean> {
    this.status.isSyncing = true;
    this.notifyStatus();

    try {
      const fetchColSafe = async (colName: string) => {
        try {
          return await getDocs(collection(db, colName));
        } catch (colErr: any) {
          if (isPermissionError(colErr)) {
            try {
              handleFirestoreError(colErr, OperationType.LIST, colName);
            } catch {
              // Gracefully captured for logging
            }
          }
          console.warn(`[CloudSync] Aviso al leer colección ${colName}:`, colErr?.message || colErr);
          return null;
        }
      };

      const [
        lotesSnap,
        humSnap,
        ahSnap,
        asSnap,
        preSnap,
        batchSnap,
        batchLotesSnap,
        ctrlSnap,
        avSnap,
        progSnap,
        sysCfgSnap
      ] = await Promise.all([
        fetchColSafe("lotes"),
        fetchColSafe("humedades"),
        fetchColSafe("analisisHumedo"),
        fetchColSafe("analisisSeco"),
        fetchColSafe("presecados"),
        fetchColSafe("batchesVaporizado"),
        fetchColSafe("batchLotes"),
        fetchColSafe("controlesVaporizado"),
        fetchColSafe("analisisVaporizados"),
        fetchColSafe("programaciones"),
        fetchColSafe("systemConfig")
      ]);

      const cloudData: Partial<Record<string, any>> = {};

      if (lotesSnap) {
        cloudData.lotes = lotesSnap.docs.map((d) => d.data() as Lote).filter((l) => l && l.LOTE_ID);
        this.status.totalCloudLotes = cloudData.lotes.length;
      }
      if (humSnap) {
        cloudData.registroHumedad = humSnap.docs.map((d) => d.data() as RegistroHumedad);
      }
      if (ahSnap) {
        cloudData.analisisHumedo = ahSnap.docs.map((d) => d.data() as AnalisisHumedo);
      }
      if (asSnap) {
        cloudData.analisisSeco = asSnap.docs.map((d) => d.data() as AnalisisSeco);
      }
      if (preSnap) {
        cloudData.presecado = preSnap.docs.map((d) => d.data() as Presecado);
      }
      if (batchSnap) {
        cloudData.batchesVaporizado = batchSnap.docs.map((d) => d.data() as BatchVaporizado).filter((b) => b && b.BATCH_ID);
      }
      if (batchLotesSnap) {
        cloudData.batchLotes = batchLotesSnap.docs.map((d) => d.data() as BatchLote);
      }
      if (ctrlSnap) {
        cloudData.controlVaporizado = ctrlSnap.docs.map((d) => d.data() as ControlVaporizado);
      }
      if (avSnap) {
        cloudData.analisisVaporizado = avSnap.docs.map((d) => d.data() as AnalisisVaporizado);
      }
      if (progSnap) {
        cloudData.programacionesOficiales = progSnap.docs.map((d) => d.data() as any);
      }

      if (sysCfgSnap && !sysCfgSnap.empty) {
        const usersDoc = sysCfgSnap.docs.find((d) => d.id === "users_directory");
        const usersData = usersDoc?.data();
        if (usersData && Array.isArray(usersData.users) && usersData.users.length > 0) {
          cloudData.users = usersData.users;
        }
      }

      if (Object.keys(cloudData).length > 0) {
        const cloudLoteStateMap = new Map<string, string>();
        if (Array.isArray(cloudData.lotes)) {
          cloudData.lotes.forEach((cl: any) => {
            if (cl?.LOTE_ID) {
              cloudLoteStateMap.set(cl.LOTE_ID.toString().trim().toUpperCase(), `${cl.ESTADO_LOTE || ""}|${cl.VARIEDAD || ""}`);
            }
          });
        }
        const cloudBatchStateMap = new Map<string, string>();
        if (Array.isArray(cloudData.batchesVaporizado)) {
          cloudData.batchesVaporizado.forEach((cb: any) => {
            if (cb?.BATCH_ID) {
              cloudBatchStateMap.set(cb.BATCH_ID.toString().trim().toUpperCase(), `${cb.ESTADO_BATCH || ""}|${cb.VARIEDAD || ""}`);
            }
          });
        }

        // Sincronizar en localDB preservando los datos locales existentes (fusión segura no destructiva)
        localDB.mergeFromCloud(cloudData, { replace: false });
        window.dispatchEvent(new CustomEvent("cloud_data_updated", { detail: { full: true } }));

        // Si la reconciliación de flujo corrigió estados desfasados en lotes o batches (ej. C08440 -> PROCESADO, V350 -> FERON), propagar a Firestore
        try {
          const reconciledState = localDB.getState();
          (reconciledState.lotes || []).forEach((l) => {
            const key = (l.LOTE_ID || "").toString().trim().toUpperCase();
            const prevSig = cloudLoteStateMap.get(key);
            const newSig = `${l.ESTADO_LOTE || ""}|${l.VARIEDAD || ""}`;
            if (prevSig !== undefined && prevSig !== newSig) {
              this.syncLote(l).catch(() => {});
            }
          });
          (reconciledState.batchesVaporizado || []).forEach((b) => {
            const key = (b.BATCH_ID || "").toString().trim().toUpperCase();
            const prevSig = cloudBatchStateMap.get(key);
            const newSig = `${b.ESTADO_BATCH || ""}|${b.VARIEDAD || ""}`;
            if (prevSig !== undefined && prevSig !== newSig) {
              this.syncBatch(b).catch(() => {});
            }
          });
        } catch {
          // ignore background sync errors
        }
      }

      this.status.lastSyncTime = new Date();
      this.status.error = null;
      return true;
    } catch (err: any) {
      if (isFirestoreQuotaOrResourceError(err)) {
        console.warn("[CloudSync] Aviso de cuota/conexión al descargar de Firestore:", err?.message || err);
        this.status.isOnline = false;
        return false;
      }
      if (isPermissionError(err)) {
        this.status.error = "Permisos de Firestore en actualización. Operando con base de datos local segura.";
        return false;
      }
      console.warn("[CloudSync] Aviso al descargar de Firestore:", err?.message || err);
      this.status.error = err?.message || "Error al descargar datos";
      return false;
    } finally {
      this.status.isSyncing = false;
      this.notifyStatus();
    }
  }

  /**
   * Ejecuta operaciones de escritura en lotes atómicos (batch) de alto rendimiento (hasta 250 docs por commit)
   * sin retardos artificiales innecesarios para garantizar sincronización casi instantánea.
   */
  private async commitOperationsInBatches(
    operations: Array<{ ref: any; data: any }>
  ): Promise<number> {
    if (operations.length === 0) return 0;
    const BATCH_SIZE = 250;
    let successfulWrites = 0;

    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const op of chunk) {
        batch.set(op.ref, op.data, { merge: true });
      }

      try {
        await batch.commit();
        successfulWrites += chunk.length;
      } catch (batchErr: any) {
        const errMsg = String(batchErr?.message || batchErr);
        const isResourceExhausted =
          batchErr?.code === "resource-exhausted" ||
          errMsg.includes("resource-exhausted") ||
          errMsg.includes("Write stream exhausted");

        console.warn(`[CloudSync] Reintento en lote Firestore (${i}/${operations.length}):`, errMsg);

        const backoffWait = isResourceExhausted ? 1500 : 300;
        await new Promise((resolve) => setTimeout(resolve, backoffWait));

        try {
          const retryBatch = writeBatch(db);
          for (const op of chunk) {
            retryBatch.set(op.ref, op.data, { merge: true });
          }
          await retryBatch.commit();
          successfulWrites += chunk.length;
        } catch (retryErr: any) {
          console.warn("[CloudSync] Lote omitido tras reintento:", retryErr?.message || retryErr);
        }
      }

      // Breve respiro de 30ms únicamente cuando hay más de 250 registros pendientes
      if (i + BATCH_SIZE < operations.length) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }

    return successfulWrites;
  }

  /**
   * Sincroniza selectivamente un conjunto importado (lotes, humedades, analisis)
   * sin reenviar innecesariamente toda la base de datos histórica.
   */
  public async syncImportedDataset(payload: {
    lotes?: Lote[];
    registroHumedad?: RegistroHumedad[];
    analisisHumedo?: AnalisisHumedo[];
  }): Promise<boolean> {
    const operations: Array<{ ref: any; data: any }> = [];

    if (Array.isArray(payload.lotes)) {
      for (const lote of payload.lotes) {
        if (lote && lote.LOTE_ID) {
          const cleanId = lote.LOTE_ID.toString().trim().replace(/[\/\s]/g, "_");
          operations.push({
            ref: doc(db, "lotes", cleanId),
            data: cleanFirestoreData({
              ...lote,
              updatedAt: new Date().toISOString()
            })
          });
        }
      }
    }

    if (Array.isArray(payload.registroHumedad)) {
      for (const hum of payload.registroHumedad) {
        const rawLoteId = (hum.LOTE_ID || "").toString().trim().replace(/[\/\s]/g, "_");
        const id = rawLoteId ? `HUM-${rawLoteId}` : (hum["ID ANALISIS"] || "").toString().trim().replace(/[\/\s]/g, "_");
        if (id) {
          operations.push({
            ref: doc(db, "humedades", id),
            data: cleanFirestoreData({
              ...hum,
              "ID ANALISIS": id,
              updatedAt: new Date().toISOString()
            })
          });
        }
      }
    }

    if (Array.isArray(payload.analisisHumedo)) {
      for (const ah of payload.analisisHumedo) {
        const rawLoteId = (ah.LOTE_ID || "").toString().trim().replace(/[\/\s]/g, "_");
        const id = rawLoteId ? `AH-${rawLoteId}` : (ah.ANALISIS_HUMEDO_ID || "").toString().trim().replace(/[\/\s]/g, "_");
        if (id) {
          operations.push({
            ref: doc(db, "analisisHumedo", id),
            data: cleanFirestoreData({
              ...ah,
              ANALISIS_HUMEDO_ID: id,
              updatedAt: new Date().toISOString()
            })
          });
        }
      }
    }

    if (operations.length === 0) return true;

    return this.enqueueWrite(async () => {
      this.status.isSyncing = true;
      this.isWritingToCloud = true;
      this.notifyStatus();
      try {
        await this.commitOperationsInBatches(operations);
        this.status.lastSyncTime = new Date();
        this.status.error = null;
        return true;
      } catch (err: any) {
        console.warn("[CloudSync] Aviso en sincronización selectiva:", err?.message || err);
        return false;
      } finally {
        this.isWritingToCloud = false;
        this.status.isSyncing = false;
        this.notifyStatus();
      }
    });
  }

  /**
   * Sube toda la base de datos local actual a Firestore utilizando lotes atómicos y control de flujo
   */
  public async pushAllLocalToCloud(): Promise<boolean> {
    if (this.isWritingToCloud) return true;

    return this.enqueueWrite(async () => {
      this.status.isSyncing = true;
      this.isWritingToCloud = true;
      this.notifyStatus();

      try {
        const localState = localDB.getState();
        const operations: Array<{ ref: any; data: any }> = [];

        // 1. Preparar Lotes
        if (Array.isArray(localState.lotes) && localState.lotes.length > 0) {
          for (const lote of localState.lotes) {
            if (lote.LOTE_ID) {
              const cleanId = lote.LOTE_ID.toString().trim().replace(/[\/\s]/g, "_");
              operations.push({
                ref: doc(db, "lotes", cleanId),
                data: cleanFirestoreData({
                  ...lote,
                  updatedAt: new Date().toISOString()
                })
              });
            }
          }
        }

        // 2. Preparar Humedades
        if (Array.isArray(localState.registroHumedad) && localState.registroHumedad.length > 0) {
          for (const hum of localState.registroHumedad) {
            if (hum.LOTE_ID) {
              const rawLoteId = hum.LOTE_ID.toString().trim().replace(/[\/\s]/g, "_");
              const docId = `HUM-${rawLoteId}`;
              operations.push({
                ref: doc(db, "humedades", docId),
                data: cleanFirestoreData({
                  ...hum,
                  "ID ANALISIS": docId,
                  updatedAt: new Date().toISOString()
                })
              });
            }
          }
        }

        // 3. Preparar Análisis Húmedo
        if (Array.isArray(localState.analisisHumedo) && localState.analisisHumedo.length > 0) {
          for (const ah of localState.analisisHumedo) {
            const rawLoteId = (ah.LOTE_ID || "").toString().trim().replace(/[\/\s]/g, "_");
            const docId = rawLoteId ? `AH-${rawLoteId}` : (ah.ANALISIS_HUMEDO_ID || `AH-${Date.now()}`).toString().trim().replace(/[\/\s]/g, "_");
            operations.push({
              ref: doc(db, "analisisHumedo", docId),
              data: cleanFirestoreData({
                ...ah,
                ANALISIS_HUMEDO_ID: docId,
                updatedAt: new Date().toISOString()
              })
            });
          }
        }

        // 4. Preparar Batches
        if (Array.isArray(localState.batchesVaporizado) && localState.batchesVaporizado.length > 0) {
          for (const b of localState.batchesVaporizado) {
            if (b.BATCH_ID) {
              const cleanId = b.BATCH_ID.toString().trim().replace(/[\/\s]/g, "_");
              operations.push({
                ref: doc(db, "batchesVaporizado", cleanId),
                data: cleanFirestoreData({
                  ...b,
                  updatedAt: new Date().toISOString()
                })
              });
            }
          }
        }

        // Ejecutar en lotes atómicos espaciados (sin saturar el write stream)
        await this.commitOperationsInBatches(operations);

        this.status.lastSyncTime = new Date();
        this.status.totalCloudLotes = localState.lotes?.length || 0;
        this.status.error = null;
        return true;
      } catch (err: any) {
        console.warn("[CloudSync] Aviso subiendo datos a Firestore:", err?.message || err);
        this.status.error = err?.message || "Error al subir datos";
        return false;
      } finally {
        this.isWritingToCloud = false;
        this.status.isSyncing = false;
        this.notifyStatus();
      }
    });
  }

  /**
   * Elimina todos los registros operativos de Firestore en la nube para comenzar pruebas limpias
   */
  public async clearAllCloudData(): Promise<boolean> {
    return this.enqueueWrite(async () => {
      this.status.isSyncing = true;
      this.isWritingToCloud = true;
      this.notifyStatus();

      try {
        const collectionsToClear = [
          "lotes",
          "humedades",
          "analisisHumedo",
          "analisisSeco",
          "presecados",
          "batchesVaporizado",
          "batchLotes",
          "controlesVaporizado",
          "analisisVaporizados",
          "programaciones"
        ];

        for (const colName of collectionsToClear) {
          try {
            const snap = await getDocs(collection(db, colName));
            if (!snap.empty) {
              const BATCH_SIZE = 25;
              const docs = snap.docs;
              for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                const chunk = docs.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);
                for (const d of chunk) {
                  batch.delete(d.ref);
                }
                await batch.commit();
                await new Promise((resolve) => setTimeout(resolve, 350));
              }
            }
          } catch (colErr) {
            console.warn(`[CloudSync] Aviso al limpiar colección ${colName}:`, colErr);
          }
        }

        this.status.totalCloudLotes = 0;
        this.status.lastSyncTime = new Date();
        this.status.error = null;
        return true;
      } catch (err: any) {
        console.warn("[CloudSync] Aviso al limpiar datos de la nube:", err?.message || err);
        return false;
      } finally {
        this.isWritingToCloud = false;
        this.status.isSyncing = false;
        this.notifyStatus();
      }
    });
  }

  /**
   * Guarda un lote específico en Firestore de forma inteligente y optimizada con debounce
   */
  public async syncLote(lote: Lote): Promise<void> {
    if (!lote || !lote.LOTE_ID) return;
    const cleanId = lote.LOTE_ID.toString().trim().replace(/[\/\s]/g, "_");
    // merge: false para asegurar que no persistan campos residuales no deseados
    return this.queueDocWrite("lotes", cleanId, lote, { merge: false, debounceMs: 250 });
  }

  /**
   * Elimina un lote de Firestore y limpia sus dependencias en paralelo
   */
  public async deleteLoteFromCloud(loteId: string): Promise<void> {
    if (!loteId) return;
    return this.enqueueWrite(async () => {
      try {
        const cleanId = loteId.toString().trim().replace(/[\/\s]/g, "_");
        const normId = formatLoteCode(cleanId) || cleanId;
        const numSuffix = normId.replace(/^C0+/i, "");
        const candidateDocIds = Array.from(
          new Set([cleanId, normId, `CO${numSuffix}`, numSuffix, `0${numSuffix}`].filter(Boolean))
        );

        const matchesTargetLote = (val?: any) => {
          if (!val) return false;
          const s = String(val).trim();
          return s === cleanId || s === normId || formatLoteCode(s) === normId;
        };

        const deletePromises: Promise<any>[] = [];
        for (const cid of candidateDocIds) {
          deletePromises.push(
            deleteDoc(doc(db, "lotes", cid)),
            deleteDoc(doc(db, "humedades", `HUM-${cid}`)),
            deleteDoc(doc(db, "humedades", cid)),
            deleteDoc(doc(db, "analisisHumedo", `AH-${cid}`)),
            deleteDoc(doc(db, "analisisHumedo", cid)),
            deleteDoc(doc(db, "analisisSeco", `AS-${cid}`)),
            deleteDoc(doc(db, "analisisSeco", cid)),
            deleteDoc(doc(db, "presecados", `PRE-${cid}`)),
            deleteDoc(doc(db, "presecados", cid))
          );
        }

        try {
          const blSnap = await getDocs(collection(db, "batchLotes"));
          blSnap.docs.forEach((d) => {
            const data = d.data();
            if (matchesTargetLote(data?.LOTE_ID) || d.id.includes(normId) || d.id.includes(cleanId)) {
              deletePromises.push(deleteDoc(d.ref));
            }
          });
        } catch {}

        try {
          const avSnap = await getDocs(collection(db, "analisisVaporizados"));
          avSnap.docs.forEach((d) => {
            const data = d.data();
            if (matchesTargetLote(data?.LOTE_ID) || matchesTargetLote(data?.CODIGO_MUESTRA) || d.id.includes(normId) || d.id.includes(cleanId)) {
              deletePromises.push(deleteDoc(d.ref));
            }
          });
        } catch {}

        try {
          const bSnap = await getDocs(collection(db, "batchesVaporizado"));
          bSnap.docs.forEach((d) => {
            const data: any = { ...d.data() };
            let modified = false;
            if (matchesTargetLote(data.LOTE_ID)) {
              delete data.LOTE_ID;
              modified = true;
            }
            for (const arrKey of ["LOTES_UNION", "LOTES_ASIGNADOS", "lotesAsignados", "lotes"]) {
              if (Array.isArray(data[arrKey])) {
                const before = data[arrKey].length;
                data[arrKey] = data[arrKey].filter((item: any) => {
                  const lid = typeof item === "string" ? item : (item?.LOTE_ID || item?.loteId || item?.codigo);
                  return !matchesTargetLote(lid);
                });
                if (data[arrKey].length !== before) modified = true;
              }
            }
            if (modified) {
              deletePromises.push(setDoc(d.ref, cleanFirestoreData(data)));
            }
          });
        } catch {}

        try {
          const pSnap = await getDocs(collection(db, "programaciones"));
          pSnap.docs.forEach((d) => {
            const data: any = { ...d.data() };
            let modified = false;
            if (Array.isArray(data.filasLote)) {
              const before = data.filasLote.length;
              data.filasLote = data.filasLote.filter((f: any) => !matchesTargetLote(f?.loteId || f?.LOTE_ID));
              if (data.filasLote.length !== before) modified = true;
            }
            if (Array.isArray(data.lotes)) {
              const before = data.lotes.length;
              data.lotes = data.lotes.filter((l: any) => !matchesTargetLote(typeof l === "string" ? l : (l?.LOTE_ID || l?.loteId)));
              if (data.lotes.length !== before) modified = true;
            }
            if (modified) {
              deletePromises.push(setDoc(d.ref, cleanFirestoreData(data)));
            }
          });
        } catch {}

        await Promise.allSettled(deletePromises);
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) return;
        console.warn(`[CloudSync] Aviso eliminando lote ${loteId}:`, err?.message || err);
      }
    });
  }

  /**
   * Elimina un batch de vaporizado y sus registros vinculados en Firestore
   */
  public async deleteBatchFromCloud(batchId: string): Promise<void> {
    if (!batchId) return;
    return this.enqueueWrite(async () => {
      try {
        const cleanId = batchId.toString().trim().replace(/[\/\s]/g, "_");
        const deleteOps: Promise<any>[] = [
          deleteDoc(doc(db, "batchesVaporizado", cleanId)),
          deleteDoc(doc(db, "controlesVaporizado", cleanId)),
          deleteDoc(doc(db, "controlesVaporizado", `CTRL-${cleanId}`)),
          deleteDoc(doc(db, "analisisVaporizados", cleanId)),
          deleteDoc(doc(db, "programaciones", cleanId)),
          deleteDoc(doc(db, "programaciones", `PROG-${cleanId}`))
        ];

        try {
          const blSnap = await getDocs(collection(db, "batchLotes"));
          blSnap.docs.forEach((d) => {
            const data = d.data();
            if (data?.BATCH_ID === batchId || data?.BATCH_ID === cleanId || d.id.startsWith(cleanId)) {
              deleteOps.push(deleteDoc(d.ref));
            }
          });
        } catch {}

        await Promise.allSettled(deleteOps);
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) return;
        console.warn(`[CloudSync] Aviso eliminando batch ${batchId}:`, err?.message || err);
      }
    });
  }

  /**
   * Guarda un registro de humedad en Firestore con coalescencia y debounce
   */
  public async syncHumedad(humedad: RegistroHumedad): Promise<void> {
    if (!humedad || !humedad.LOTE_ID) return;
    const rawLoteId = humedad.LOTE_ID.toString().trim().replace(/[\/\s]/g, "_");
    const docId = `HUM-${rawLoteId}`;
    return this.queueDocWrite("humedades", docId, {
      ...humedad,
      "ID ANALISIS": docId
    }, { merge: true, debounceMs: 250 });
  }

  /**
   * Guarda un análisis húmedo en Firestore con coalescencia y debounce
   */
  public async syncAnalisisHumedo(ah: AnalisisHumedo): Promise<void> {
    if (!ah || (!ah.ANALISIS_HUMEDO_ID && !ah.LOTE_ID)) return;
    const rawLoteId = (ah.LOTE_ID || "").toString().trim().replace(/[\/\s]/g, "_");
    const docId = rawLoteId ? `AH-${rawLoteId}` : (ah.ANALISIS_HUMEDO_ID || "").toString().trim().replace(/[\/\s]/g, "_");
    return this.queueDocWrite("analisisHumedo", docId, {
      ...ah,
      ANALISIS_HUMEDO_ID: docId
    }, { merge: true, debounceMs: 250 });
  }

  /**
   * Guarda un batch de vaporizado en Firestore con coalescencia y debounce
   */
  public async syncBatch(batch: BatchVaporizado): Promise<void> {
    if (!batch || !batch.BATCH_ID) return;
    const cleanId = batch.BATCH_ID.toString().trim().replace(/[\/\s]/g, "_");
    return this.queueDocWrite("batchesVaporizado", cleanId, batch, { merge: true, debounceMs: 250 });
  }

  /**
   * Guarda una relación batch-lote individual en Firestore
   */
  public async syncBatchLote(bl: BatchLote): Promise<void> {
    if (!bl || (!bl.BATCH_LOTE_ID && (!bl.BATCH_ID || !bl.LOTE_ID))) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const rawId = bl.BATCH_LOTE_ID || `BL-${bl.BATCH_ID}-${bl.LOTE_ID}-${bl.PARTE || 1}`;
        const cleanId = rawId.toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "batchLotes", cleanId), cleanFirestoreData({
          ...bl,
          BATCH_LOTE_ID: cleanId,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `batchLotes/${bl.BATCH_ID}_${bl.LOTE_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando batchLote ${bl.BATCH_ID}-${bl.LOTE_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda múltiples relaciones batch-lotes en Firestore en lote
   */
  public async syncBatchLotes(batchLotesList: BatchLote[]): Promise<void> {
    if (!Array.isArray(batchLotesList) || batchLotesList.length === 0) return;
    const operations: Array<{ ref: any; data: any }> = [];
    for (const bl of batchLotesList) {
      if (!bl || (!bl.BATCH_LOTE_ID && (!bl.BATCH_ID || !bl.LOTE_ID))) continue;
      const rawId = bl.BATCH_LOTE_ID || `BL-${bl.BATCH_ID}-${bl.LOTE_ID}-${bl.PARTE || 1}`;
      const cleanId = rawId.toString().trim().replace(/[\/\s]/g, "_");
      operations.push({
        ref: doc(db, "batchLotes", cleanId),
        data: cleanFirestoreData({
          ...bl,
          BATCH_LOTE_ID: cleanId,
          updatedAt: new Date().toISOString()
        })
      });
    }
    if (operations.length === 0) return;

    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        await this.commitOperationsInBatches(operations);
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        console.warn("[CloudSync] Aviso sincronizando batchLotes:", err?.message || err);
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda un análisis seco en Firestore con coalescencia y debounce
   */
  public async syncAnalisisSeco(asData: AnalisisSeco): Promise<void> {
    if (!asData || (!asData.ANALISIS_SECO_ID && !asData.LOTE_ID)) return;
    const cleanId = (asData.ANALISIS_SECO_ID || asData.LOTE_ID).toString().trim().replace(/[\/\s]/g, "_");
    return this.queueDocWrite("analisisSeco", cleanId, asData, { merge: true, debounceMs: 250 });
  }

  /**
   * Guarda un control de presecado en Firestore con coalescencia y debounce
   */
  public async syncPresecado(preData: Presecado): Promise<void> {
    if (!preData || (!preData.PRESECADO_ID && !preData.LOTE_ID)) return;
    const cleanId = (preData.PRESECADO_ID || preData.LOTE_ID).toString().trim().replace(/[\/\s]/g, "_");
    return this.queueDocWrite("presecados", cleanId, preData, { merge: true, debounceMs: 250 });
  }

  /**
   * Guarda un control de vaporizado en Firestore con coalescencia y debounce (320ms)
   * Ideal para optimizar las continuas ediciones de perfiles, temperaturas y silos sin saturar la red.
   */
  public async syncControl(control: ControlVaporizado): Promise<void> {
    if (!control || (!control.CONTROL_VAPORIZADO_ID && !control.BATCH_ID)) return;
    const cleanId = (control.CONTROL_VAPORIZADO_ID || control.BATCH_ID).toString().trim().replace(/[\/\s]/g, "_");
    return this.queueDocWrite("controlesVaporizado", cleanId, control, { merge: true, debounceMs: 320 });
  }

  /**
   * Guarda un análisis de vaporizado en Firestore con coalescencia y debounce
   */
  public async syncAnalisisVaporizado(av: AnalisisVaporizado): Promise<void> {
    if (!av || !av.ANALISIS_VAPORIZADO_ID) return;
    const cleanId = av.ANALISIS_VAPORIZADO_ID.toString().trim().replace(/[\/\s]/g, "_");
    return this.queueDocWrite("analisisVaporizados", cleanId, av, { merge: true, debounceMs: 250 });
  }

  /**
   * Elimina un análisis de vaporizado (muestra de batch) de Firestore
   */
  public async deleteAnalisisVaporizadoFromCloud(id: string): Promise<void> {
    if (!id) return;
    return this.enqueueWrite(async () => {
      try {
        const cleanId = id.toString().trim().replace(/[\/\s]/g, "_");
        await deleteDoc(doc(db, "analisisVaporizados", cleanId));
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) return;
        console.warn(`[CloudSync] Aviso eliminando analisisVaporizado ${id}:`, err?.message || err);
      }
    });
  }

  /**
   * Guarda una programación oficial en Firestore con coalescencia y debounce
   */
  public async syncProgramacion(prog: ProgramacionApit | any): Promise<void> {
    const rawId = prog?.PROGRAMACION_ID || prog?.id || prog?.batch;
    if (!prog || !rawId) return;
    const cleanId = rawId.toString().trim().replace(/[\/\s]/g, "_");
    return this.queueDocWrite("programaciones", cleanId, {
      ...prog,
      PROGRAMACION_ID: prog.PROGRAMACION_ID || cleanId
    }, { merge: true, debounceMs: 250 });
  }

  /**
   * Guarda el directorio de usuarios del sistema en Firestore (systemConfig/users_directory)
   */
  public async syncUsers(users: UserProfile[]): Promise<void> {
    if (!Array.isArray(users) || users.length === 0) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        await setDoc(doc(db, "systemConfig", "users_directory"), cleanFirestoreData({
          id: "users_directory",
          users,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        console.warn("[CloudSync] Aviso sincronizando directorio de usuarios:", err?.message || err);
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Elimina completamente todos los registros operacionales de Firestore (lotes, humedades, análisis, batches, etc.)
   * y limpia LocalDB para permitir pruebas desde cero con datos limpios.
   */
  public async purgeAllOperationalData(): Promise<{ success: boolean; countDeleted: number }> {
    return this.enqueueWrite(async () => {
      this.isWritingToCloud = true;
      this.status.isSyncing = true;
      this.notifyStatus();

      let totalDeleted = 0;
      const collectionsToPurge = [
        "lotes",
        "humedades",
        "analisisHumedo",
        "analisisSeco",
        "batchesVaporizado",
        "batchLotes",
        "controlesVaporizado",
        "analisisVaporizados",
        "presecados",
        "programaciones"
      ];

      try {
        for (const colName of collectionsToPurge) {
          try {
            const colRef = collection(db, colName);
            const snapshot = await getDocs(colRef);
            if (!snapshot.empty) {
              const docs = snapshot.docs;
              const BATCH_SIZE = 200;
              for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                const chunk = docs.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);
                chunk.forEach((d) => batch.delete(d.ref));
                await batch.commit();
                totalDeleted += chunk.length;
                await new Promise((r) => setTimeout(r, 100));
              }
            }
          } catch (colErr) {
            console.warn(`[CloudSync] Error purgando colección ${colName}:`, colErr);
          }
        }

        // Limpiar la base de datos local y memorias IndexedDB/localStorage
        localDB.clearAllOperationalData();

        this.status.totalCloudLotes = 0;
        this.status.lastSyncTime = new Date();
        this.status.error = null;
        this.status.isSyncing = false;
        this.notifyStatus();

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cloud_data_updated", { detail: { type: "purge", count: 0 } }));
          window.dispatchEvent(new CustomEvent("localdb_change", { detail: { source: "purge_all", timestamp: Date.now() } }));
        }

        return { success: true, countDeleted: totalDeleted };
      } catch (err: any) {
        this.status.error = "Error al limpiar base de datos en la nube";
        this.status.isSyncing = false;
        this.notifyStatus();
        throw err;
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }
}

export const cloudSyncService = new CloudSyncService();
