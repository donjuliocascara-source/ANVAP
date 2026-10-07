import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Unsubscribe
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from "../lib/firebase";
import { localDB } from "../utils/localDB";
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
      });
      window.addEventListener("offline", () => {
        this.status.isOnline = false;
        this.notifyStatus();
      });
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
        getDocs(collection(db, "lotes")),
        getDocs(collection(db, "humedades")),
        getDocs(collection(db, "analisisHumedo")),
        getDocs(collection(db, "analisisSeco")),
        getDocs(collection(db, "presecados")),
        getDocs(collection(db, "batchesVaporizado")),
        getDocs(collection(db, "batchLotes")),
        getDocs(collection(db, "controlesVaporizado")),
        getDocs(collection(db, "analisisVaporizados")),
        getDocs(collection(db, "programaciones")),
        getDocs(collection(db, "systemConfig"))
      ]);

      const cloudData: any = {
        lotes: lotesSnap.docs.map((d) => d.data() as Lote).filter((l) => l && l.LOTE_ID),
        registroHumedad: humSnap.docs.map((d) => d.data() as RegistroHumedad),
        analisisHumedo: ahSnap.docs.map((d) => d.data() as AnalisisHumedo),
        analisisSeco: asSnap.docs.map((d) => d.data() as AnalisisSeco),
        presecados: preSnap.docs.map((d) => d.data() as Presecado),
        batchesVaporizado: batchSnap.docs.map((d) => d.data() as BatchVaporizado).filter((b) => b && b.BATCH_ID),
        batchLotes: batchLotesSnap.docs.map((d) => d.data() as BatchLote),
        controlesVaporizado: ctrlSnap.docs.map((d) => d.data() as ControlVaporizado),
        analisisVaporizado: avSnap.docs.map((d) => d.data() as AnalisisVaporizado),
        programacionesOficiales: progSnap.docs.map((d) => d.data() as any)
      };

      this.status.totalCloudLotes = cloudData.lotes.length;

      if (!sysCfgSnap.empty) {
        const usersDoc = sysCfgSnap.docs.find((d) => d.id === "users_directory");
        const usersData = usersDoc?.data();
        if (usersData && Array.isArray(usersData.users) && usersData.users.length > 0) {
          cloudData.users = usersData.users;
        }
      }

      // Sincronizar en localDB reflejando el estado real y exacto de Firestore
      localDB.mergeFromCloud(cloudData, { replace: true });
      window.dispatchEvent(new CustomEvent("cloud_data_updated", { detail: { full: true } }));

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
   * Guarda un lote específico en Firestore de forma inmediata
   */
  public async syncLote(lote: Lote): Promise<void> {
    if (!lote || !lote.LOTE_ID) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const cleanId = lote.LOTE_ID.toString().trim().replace(/[\/\s]/g, "_");
        // No usar merge: true para asegurar que al eliminar propiedades sombra de Excel (ej. "Peso (kg)"),
        // queden definitivamente eliminadas en el documento de Firestore.
        await setDoc(doc(db, "lotes", cleanId), cleanFirestoreData({
          ...lote,
          updatedAt: new Date().toISOString()
        }));
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          console.warn(`[CloudSync] Pausa por cuota/saturación en lote ${lote.LOTE_ID}`);
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `lotes/${lote.LOTE_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando lote ${lote.LOTE_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Elimina un lote de Firestore y limpia sus dependencias en paralelo
   */
  public async deleteLoteFromCloud(loteId: string): Promise<void> {
    if (!loteId) return;
    return this.enqueueWrite(async () => {
      try {
        const cleanId = loteId.toString().trim().replace(/[\/\s]/g, "_");
        await Promise.allSettled([
          deleteDoc(doc(db, "lotes", cleanId)),
          deleteDoc(doc(db, "humedades", `HUM-${cleanId}`)),
          deleteDoc(doc(db, "humedades", cleanId)),
          deleteDoc(doc(db, "analisisHumedo", `AH-${cleanId}`)),
          deleteDoc(doc(db, "analisisHumedo", cleanId)),
          deleteDoc(doc(db, "analisisSeco", `AS-${cleanId}`)),
          deleteDoc(doc(db, "analisisSeco", cleanId)),
          deleteDoc(doc(db, "presecados", `PRE-${cleanId}`)),
          deleteDoc(doc(db, "presecados", cleanId))
        ]);
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
   * Guarda un registro de humedad en Firestore
   */
  public async syncHumedad(humedad: RegistroHumedad): Promise<void> {
    if (!humedad || !humedad.LOTE_ID) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const rawLoteId = humedad.LOTE_ID.toString().trim().replace(/[\/\s]/g, "_");
        const docId = `HUM-${rawLoteId}`;
        await setDoc(doc(db, "humedades", docId), cleanFirestoreData({
          ...humedad,
          "ID ANALISIS": docId,
          updatedAt: new Date().toISOString()
        }));
        // Eliminar posible documento duplicado legado sin prefijo (ej. "C08434" en lugar de "HUM-C08434")
        if (rawLoteId && rawLoteId !== docId) {
          try {
            await deleteDoc(doc(db, "humedades", rawLoteId));
          } catch {
            // ignore
          }
        }
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `humedades/${humedad.LOTE_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando humedad ${humedad.LOTE_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda un análisis húmedo en Firestore
   */
  public async syncAnalisisHumedo(ah: AnalisisHumedo): Promise<void> {
    if (!ah || (!ah.ANALISIS_HUMEDO_ID && !ah.LOTE_ID)) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const rawLoteId = (ah.LOTE_ID || "").toString().trim().replace(/[\/\s]/g, "_");
        const docId = rawLoteId ? `AH-${rawLoteId}` : (ah.ANALISIS_HUMEDO_ID || "").toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "analisisHumedo", docId), cleanFirestoreData({
          ...ah,
          ANALISIS_HUMEDO_ID: docId,
          updatedAt: new Date().toISOString()
        }));
        // Eliminar posible documento duplicado legado sin prefijo
        if (rawLoteId && rawLoteId !== docId) {
          try {
            await deleteDoc(doc(db, "analisisHumedo", rawLoteId));
          } catch {
            // ignore
          }
        }
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `analisisHumedo/${ah.LOTE_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando analisisHumedo ${ah.LOTE_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda un batch de vaporizado en Firestore
   */
  public async syncBatch(batch: BatchVaporizado): Promise<void> {
    if (!batch || !batch.BATCH_ID) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const cleanId = batch.BATCH_ID.toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "batchesVaporizado", cleanId), cleanFirestoreData({
          ...batch,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `batchesVaporizado/${batch.BATCH_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando batch ${batch.BATCH_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda un análisis seco en Firestore
   */
  public async syncAnalisisSeco(asData: AnalisisSeco): Promise<void> {
    if (!asData || (!asData.ANALISIS_SECO_ID && !asData.LOTE_ID)) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const cleanId = (asData.ANALISIS_SECO_ID || asData.LOTE_ID).toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "analisisSeco", cleanId), cleanFirestoreData({
          ...asData,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `analisisSeco/${asData.LOTE_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando analisisSeco ${asData.LOTE_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda un control de presecado en Firestore
   */
  public async syncPresecado(preData: Presecado): Promise<void> {
    if (!preData || (!preData.PRESECADO_ID && !preData.LOTE_ID)) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const cleanId = (preData.PRESECADO_ID || preData.LOTE_ID).toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "presecados", cleanId), cleanFirestoreData({
          ...preData,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `presecados/${preData.LOTE_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando presecado ${preData.LOTE_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda un control de vaporizado en Firestore
   */
  public async syncControl(control: ControlVaporizado): Promise<void> {
    if (!control || (!control.CONTROL_VAPORIZADO_ID && !control.BATCH_ID)) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const cleanId = (control.CONTROL_VAPORIZADO_ID || control.BATCH_ID).toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "controlesVaporizado", cleanId), cleanFirestoreData({
          ...control,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `controlesVaporizado/${control.BATCH_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando control ${control.BATCH_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda un análisis de vaporizado en Firestore
   */
  public async syncAnalisisVaporizado(av: AnalisisVaporizado): Promise<void> {
    if (!av || !av.ANALISIS_VAPORIZADO_ID) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const cleanId = av.ANALISIS_VAPORIZADO_ID.toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "analisisVaporizados", cleanId), cleanFirestoreData({
          ...av,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `analisisVaporizados/${av.ANALISIS_VAPORIZADO_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando analisisVaporizado ${av.ANALISIS_VAPORIZADO_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
  }

  /**
   * Guarda una programación oficial en Firestore
   */
  public async syncProgramacion(prog: ProgramacionApit): Promise<void> {
    if (!prog || !prog.PROGRAMACION_ID) return;
    return this.enqueueWrite(async () => {
      try {
        this.isWritingToCloud = true;
        const cleanId = prog.PROGRAMACION_ID.toString().trim().replace(/[\/\s]/g, "_");
        await setDoc(doc(db, "programaciones", cleanId), cleanFirestoreData({
          ...prog,
          updatedAt: new Date().toISOString()
        }), { merge: true });
        this.status.lastSyncTime = new Date();
        this.notifyStatus();
      } catch (err: any) {
        if (isFirestoreQuotaOrResourceError(err)) {
          return;
        }
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `programaciones/${prog.PROGRAMACION_ID}`);
        } else {
          console.warn(`[CloudSync] Aviso sincronizando programacion ${prog.PROGRAMACION_ID}:`, err?.message || err);
        }
      } finally {
        this.isWritingToCloud = false;
      }
    });
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
