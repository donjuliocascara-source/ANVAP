import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { 
  Lote, 
  RegistroHumedad, 
  AnalisisHumedo, 
  Presecado, 
  AnalisisSeco, 
  ProgramacionApit, 
  BatchVaporizado, 
  BatchLote, 
  ControlVaporizado, 
  AnalisisVaporizado, 
  Equipo, 
  EstadoLote, 
  SuccessWeights, 
  UserProfile, 
  UserRole,
  AIRecommendationResult,
  AISimulationResult
} from "./types";

import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";

// Lazy-loaded Views for optimized initial bundle, faster FCP/TTI, and smooth Vercel deployments
const DashboardView = lazy(() => import("./components/DashboardView").then(m => ({ default: m.DashboardView })));
const RecepcionLotesView = lazy(() => import("./components/RecepcionLotesView").then(m => ({ default: m.RecepcionLotesView })));
const PresecadoSecoView = lazy(() => import("./components/PresecadoSecoView").then(m => ({ default: m.PresecadoSecoView })));
const PriorizacionProgramacionView = lazy(() => import("./components/PriorizacionProgramacionView").then(m => ({ default: m.PriorizacionProgramacionView })));
const BatchVaporizadoView = lazy(() => import("./components/BatchVaporizadoView").then(m => ({ default: m.BatchVaporizadoView })));
const ControlVaporizadoView = lazy(() => import("./components/ControlVaporizadoView").then(m => ({ default: m.ControlVaporizadoView })));
const AnalisisVaporizadoView = lazy(() => import("./components/AnalisisVaporizadoView").then(m => ({ default: m.AnalisisVaporizadoView })));
const AnalisisDescargaView = lazy(() => import("./components/AnalisisDescargaView").then(m => ({ default: m.AnalisisDescargaView })));
const ResultadosCoccionView = lazy(() => import("./components/ResultadosCoccionView").then(m => ({ default: m.ResultadosCoccionView })));
const ComparadorEvaluacionProcesos = lazy(() => import("./components/ComparadorEvaluacionProcesos").then(m => ({ default: m.ComparadorEvaluacionProcesos })));
const SimuladorView = lazy(() => import("./components/SimuladorView").then(m => ({ default: m.SimuladorView })));
const LoginView = lazy(() => import("./components/LoginView").then(m => ({ default: m.LoginView })));

// Lazy-loaded Modals
const OCRScannerModal = lazy(() => import("./components/OCRScannerModal").then(m => ({ default: m.OCRScannerModal })));
const InformeLoteModal = lazy(() => import("./components/InformeLoteModal").then(m => ({ default: m.InformeLoteModal })));
const ConfigWeightsModal = lazy(() => import("./components/ConfigWeightsModal").then(m => ({ default: m.ConfigWeightsModal })));
const ExcelSyncModal = lazy(() => import("./components/ExcelSyncModal").then(m => ({ default: m.ExcelSyncModal })));
const CloudSyncModal = lazy(() => import("./components/CloudSyncModal").then(m => ({ default: m.CloudSyncModal })));
const ConfigEvaluacionLotesModal = lazy(() => import("./components/ConfigEvaluacionLotesModal").then(m => ({ default: m.ConfigEvaluacionLotesModal })));
const UsuariosModal = lazy(() => import("./components/UsuariosModal").then(m => ({ default: m.UsuariosModal })));

import { obtenerResultadosCoccionLocales, buscarCoccionParaBatch } from "./utils/integracionCoccionService";

import { 
  PriorizacionMasterConfig, 
  AIPlanProgramacionDia,
  ConfiguracionEvaluacionLotes,
  ParametrosTrabajo,
  HistorialParametro
} from "./types";
import { AlertTriangle, X, ExternalLink, Trash2, RotateCcw, CheckCircle2 } from "lucide-react";
import { 
  CONFIG_PRIORIZACION_DEFAULT, 
  calcularPrioridadesLotes 
} from "./utils/priorizacionService";
import { CONFIG_EVALUACION_LOTES_DEFAULT, calcularEvaluacionLote } from "./utils/evaluacionCalidad";
import { 
  PARAMETROS_TRABAJO_DEFAULT, 
  obtenerParametrosTrabajoGuardados, 
  guardarParametrosTrabajoLocal 
} from "./utils/batchEngine";
import { localDB } from "./utils/localDB";
import { cloudSyncService } from "./services/cloudSyncService";
import { 
  obtenerUsuarioActivoInicial, 
  guardarUsuarioActivo, 
  obtenerUsuariosSistema,
  guardarUsuariosSistema,
  USUARIOS_DEL_SISTEMA,
  haySesionIniciada,
  iniciarSesionUsuario,
  cerrarSesionUsuario,
  obtenerUsuarioActivoGuardado
} from "./utils/usuariosService";
import { guardarProgramacionesOficiales } from "./utils/programacionBatchOficialService";

// Loading indicator for Suspense boundaries
const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[420px] w-full p-8 text-center animate-in fade-in duration-300">
    <div className="relative w-14 h-14 mb-4">
      <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
      <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
    </div>
    <div className="text-sm font-semibold text-slate-200 tracking-wide">
      Cargando módulo operativo...
    </div>
    <div className="text-xs text-slate-400 mt-1">
      Optimización y carga diferida en progreso
    </div>
  </div>
);

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [targetFilterId, setTargetFilterId] = useState<string | undefined>(undefined);

  // Check URL parameters for direct role / user sharing (e.g. ?usuario=usr-operario or ?rol=operario)
  const urlParams = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  }, []);
  const targetUserFromUrl = urlParams.get("usuario") || undefined;
  const targetRoleFromUrl = urlParams.get("rol") || undefined;

  // User & Role State (Plant Users with Full RBAC)
  const [usersList, setUsersList] = useState<UserProfile[]>(() => obtenerUsuariosSistema());
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = obtenerUsuarioActivoGuardado();
    return saved || obtenerUsuarioActivoInicial();
  });
  const [isUsuariosModalOpen, setIsUsuariosModalOpen] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // If URL has specific user or role, force authentication prompt for that user
    if (targetUserFromUrl || targetRoleFromUrl) {
      return false;
    }
    return haySesionIniciada();
  });

  // Master Data State (12 Entities)
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [humedades, setHumedades] = useState<RegistroHumedad[]>([]);
  const [analisisHum, setAnalisisHum] = useState<AnalisisHumedo[]>([]);
  const [presecados, setPresecados] = useState<Presecado[]>([]);
  const [analisisSec, setAnalisisSec] = useState<AnalisisSeco[]>([]);
  const [programaciones, setProgramaciones] = useState<ProgramacionApit[]>([]);
  const [batches, setBatches] = useState<BatchVaporizado[]>([]);
  const [batchLotes, setBatchLotes] = useState<BatchLote[]>([]);
  const [controles, setControles] = useState<ControlVaporizado[]>([]);
  const [analisisVap, setAnalisisVap] = useState<AnalisisVaporizado[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [estados, setEstados] = useState<EstadoLote[]>([]);

  // Configurable Weights
  const [weights, setWeights] = useState<SuccessWeights>({
    incrementoQuebrado: 35,
    controlDefectos: 25,
    resultadoCoccion: 20,
    blancura: 10,
    cumplimientoProceso: 10,
    maxIncrementoQuebradoAceptable: 2.0,
    targetBlancuraMin: 30.0
  });

  // Configurable Priorizacion Master Config
  const [priorizacionConfig, setPriorizacionConfig] = useState<PriorizacionMasterConfig>(CONFIG_PRIORIZACION_DEFAULT);

  // Configuración Maestra de Evaluación de Lotes (24 Parámetros y Umbrales %)
  const [evaluacionConfig, setEvaluacionConfig] = useState<ConfiguracionEvaluacionLotes>(CONFIG_EVALUACION_LOTES_DEFAULT);

  // Parámetros de Trabajo de Planta (Capacidades de Secado, Turnos, Tolerancias)
  const [parametrosTrabajo, setParametrosTrabajo] = useState<ParametrosTrabajo>(() => obtenerParametrosTrabajoGuardados());
  const [historialParametros, setHistorialParametros] = useState<HistorialParametro[]>([]);

  // Modal States
  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const [pendingOCRData, setPendingOCRData] = useState<{ tipoFormato: string; data: any; imagenUrl?: string; timestamp: number } | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTargetLoteId, setReportTargetLoteId] = useState<string>("");
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [isConfigEvaluacionModalOpen, setIsConfigEvaluacionModalOpen] = useState(false);
  const [configEvaluacionInitialTab, setConfigEvaluacionInitialTab] = useState<"criterios" | "umbrales" | "vetos" | "alertas" | "simulador">("criterios");
  const [batchDeleteBlockedAlert, setBatchDeleteBlockedAlert] = useState<{
    batchCode: string;
    batchId: string;
    controlesCount: number;
    controles: { id: string; fecha?: string; operador?: string }[];
  } | null>(null);
  const [isResetTestingModalOpen, setIsResetTestingModalOpen] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Loading indicator
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  // Fetch initial data from local client database
  const fetchAllData = async () => {
    try {
      await localDB.ensureHydrated();
      const dbState = localDB.getState();
      const lotesRes = dbState.lotes || [];
      const humRes = dbState.registroHumedad || [];
      const anHumRes = dbState.analisisHumedo || [];
      const presecRes = dbState.presecado || [];
      const anSecRes = dbState.analisisSeco || [];
      const progRes = dbState.programacionApit || [];
      const batchRes = dbState.batchesVaporizado || [];
      const batchLotesRes = dbState.batchLotes || [];
      const ctrlRes = dbState.controlVaporizado || [];
      const anVapRes = dbState.analisisVaporizado || [];
      const eqRes = dbState.equipos || [];
      const estRes = dbState.estadosLote || [];
      const weightsRes = dbState.successWeights;
      const prioCfgRes = dbState.priorizacionConfig;
      const evalCfgRes = dbState.configuracionEvaluacionLotes;
      const paramsRes = dbState.parametrosTrabajo;
      const histParamsRes = dbState.historialParametros || [];
      const usersFromService = obtenerUsuariosSistema();
      const dbUsers = Array.isArray(dbState.users) ? dbState.users : [];
      const mergedUsersMap = new Map<string, UserProfile>();
      dbUsers.forEach((u: UserProfile) => { if (u?.id) mergedUsersMap.set(u.id, u); });
      usersFromService.forEach((u: UserProfile) => { if (u?.id) mergedUsersMap.set(u.id, u); });
      const usersRes = (usersFromService.length <= 1 && mergedUsersMap.size > 1)
        ? guardarUsuariosSistema(Array.from(mergedUsersMap.values()))
        : usersFromService;

      if (Array.isArray(lotesRes)) setLotes(lotesRes);
      if (Array.isArray(humRes)) setHumedades(humRes);
      if (Array.isArray(anHumRes)) setAnalisisHum(anHumRes);
      if (Array.isArray(presecRes)) setPresecados(presecRes);
      if (Array.isArray(anSecRes)) setAnalisisSec(anSecRes);
      if (Array.isArray(progRes)) setProgramaciones(progRes);
      if (Array.isArray(batchRes)) {
        const normBatches = batchRes.map((b: any) => ({
          ...b,
          EQUIPO: "APIT"
        }));
        setBatches(normBatches);
      }
      if (Array.isArray(batchLotesRes)) setBatchLotes(batchLotesRes);
      if (Array.isArray(ctrlRes)) setControles(ctrlRes);
      if (Array.isArray(anVapRes)) setAnalisisVap(anVapRes);
      if (Array.isArray(eqRes)) {
        const soloApit = eqRes.filter((e: any) => e.EQUIPO === "APIT").map((e: any) => ({
          ...e,
          CAPACIDAD_TN: 35,
          OBSERVACIONES: "Autoclave y Línea Oficial de Vaporizado APIT (35 TN)"
        }));
        setEquipos(soloApit.length > 0 ? soloApit : [
          { EQUIPO_ID: "EQ-APIT", EQUIPO: "APIT", PROCESO: "Vaporizado", CAPACIDAD_TN: 35, ESTADO: "OPERATIVO", OBSERVACIONES: "Autoclave y Línea Oficial de Vaporizado APIT (35 TN)" }
        ]);
      }
      if (Array.isArray(estRes)) setEstados(estRes);
      if (Array.isArray(usersRes) && usersRes.length > 0) {
        setUsersList(usersRes);
        setCurrentUser((prev) => {
          const found = usersRes.find((u: UserProfile) => u.id === prev.id);
          if (found) return found;
          guardarUsuarioActivo(usersRes[0]);
          return usersRes[0];
        });
      }
      if (weightsRes && weightsRes.incrementoQuebrado) setWeights(weightsRes);
      if (prioCfgRes && prioCfgRes.tablaHumedad) setPriorizacionConfig(prioCfgRes);
      if (evalCfgRes && evalCfgRes.criterios && Array.isArray(evalCfgRes.criterios)) setEvaluacionConfig(evalCfgRes);
      if (paramsRes && paramsRes.capacidadMaximaSecadoraKg) {
        setParametrosTrabajo(paramsRes);
        guardarParametrosTrabajoLocal(paramsRes);
      }
      if (Array.isArray(histParamsRes)) setHistorialParametros(histParamsRes);
    } catch (err) {
      console.warn("Error loading local database:", err);
    } finally {
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Iniciar sincronización centralizada en la nube con Firebase Firestore
    cloudSyncService.initSync().catch((err) => {
      console.warn("[App] Cloud sync init error:", err);
    });

    // Debounce de recarga de datos para evitar re-renderizados continuos ante ráfagas de eventos
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleDataReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        fetchAllData();
      }, 75);
    };

    // Sincronización en tiempo real desde Firestore (cambios de otras máquinas)
    const handleCloudUpdated = () => {
      scheduleDataReload();
    };
    window.addEventListener("cloud_data_updated", handleCloudUpdated);

    // Sincronización en tiempo real ante cualquier cambio local (bulk import, updates, hidratación IDB)
    const handleLocalDbChange = () => {
      scheduleDataReload();
    };
    window.addEventListener("localdb_change", handleLocalDbChange);

    // Sincronización en tiempo real ante cambios en el directorio de usuarios
    const handleUsersUpdated = (e: CustomEvent<UserProfile[]>) => {
      if (Array.isArray(e.detail) && e.detail.length > 0) {
        setUsersList(e.detail);
      }
    };
    window.addEventListener("usuarios_sistema_updated" as any, handleUsersUpdated);

    // Sincronización en tiempo real de cambios de parámetros entre componentes
    const handleParamsUpdated = (e: CustomEvent<ParametrosTrabajo>) => {
      if (e.detail && e.detail.capacidadMaximaSecadoraKg) {
        setParametrosTrabajo(e.detail);
      }
    };
    window.addEventListener("parametros-trabajo-updated" as any, handleParamsUpdated);
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      window.removeEventListener("cloud_data_updated", handleCloudUpdated);
      window.removeEventListener("localdb_change", handleLocalDbChange);
      window.removeEventListener("usuarios_sistema_updated" as any, handleUsersUpdated);
      window.removeEventListener("parametros-trabajo-updated" as any, handleParamsUpdated);
    };
  }, []);

  // Handlers for Navigation
  const [targetSubTab, setTargetSubTab] = useState<string | undefined>(undefined);

  const handleNavigate = (tab: string, filterId?: string, extraSubTab?: string) => {
    setActiveTab(tab);
    setTargetFilterId(filterId);
    setTargetSubTab(extraSubTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handlers for User & Role Selection
  const handleSelectUser = (user: UserProfile) => {
    setCurrentUser(user);
    guardarUsuarioActivo(user);
    iniciarSesionUsuario(user);
  };

  const handleLogout = () => {
    cerrarSesionUsuario();
    setIsAuthenticated(false);
  };

  const handleUpdateUsers = (newUsers: UserProfile[]) => {
    const savedUsers = guardarUsuariosSistema(newUsers);
    setUsersList(savedUsers);
    localDB.setUsers(savedUsers, currentUser?.nombre || "Super Admin");
    cloudSyncService.syncUsers(savedUsers).catch(() => {});
    const activeMatch = savedUsers.find((u) => u.id === currentUser.id);
    if (activeMatch) {
      setCurrentUser(activeMatch);
      guardarUsuarioActivo(activeMatch);
    } else if (savedUsers.length > 0) {
      setCurrentUser(savedUsers[0]);
      guardarUsuarioActivo(savedUsers[0]);
    }
  };

  const handleRoleChange = (role: UserRole) => {
    const matchingUser = usersList.find((u) => u.rol === role);
    if (matchingUser) {
      handleSelectUser(matchingUser);
    } else {
      setCurrentUser((prev) => {
        const updated: UserProfile = { ...prev, rol: role };
        guardarUsuarioActivo(updated);
        return updated;
      });
    }
  };

  // Handlers for Modals
  const handleOpenReport = (loteId: string) => {
    setReportTargetLoteId(loteId);
    setIsReportModalOpen(true);
  };

  const handleExecuteResetTesting = async () => {
    setIsResettingData(true);
    setResetSuccessMessage(null);
    try {
      await cloudSyncService.purgeAllOperationalData();
      await fetchAllData();
      setResetSuccessMessage("¡Toda la información registrada ha sido eliminada con éxito! La aplicación está limpia y lista para tus pruebas.");
      setTimeout(() => {
        setIsResetTestingModalOpen(false);
        setResetSuccessMessage(null);
      }, 1400);
    } catch (err) {
      console.warn("Aviso en purga en la nube, forzando limpieza local inmediata:", err);
      localDB.clearAllOperationalData();
      await fetchAllData();
      setResetSuccessMessage("Base de datos local y almacenamiento reiniciado con éxito.");
      setTimeout(() => {
        setIsResetTestingModalOpen(false);
        setResetSuccessMessage(null);
      }, 1400);
    } finally {
      setIsResettingData(false);
    }
  };

  // Helper to safely strip non-serializable DOM or SyntheticEvent objects before JSON.stringify
  const sanitizeJsonPayload = (data: any): any => {
    if (!data || typeof data !== "object") return data;
    if (Array.isArray(data)) return data.map(sanitizeJsonPayload);
    const clean: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || typeof v === "function") continue;
      // Skip React Fiber/DOM/Event references
      if (v && typeof v === "object" && ((v as any).nativeEvent || (v as any)._reactName || (v as any).target || v instanceof Element)) {
        continue;
      }
      if (typeof v === "object" && v !== null) {
        try {
          clean[k] = sanitizeJsonPayload(v);
        } catch {
          // Skip if circular
        }
      } else {
        clean[k] = v;
      }
    }
    return clean;
  };

  // --- CLIENT-SIDE LOCALDB HANDLERS ---
  const handleSaveLote = async (loteData: Partial<Lote>) => {
    try {
      if (!loteData || typeof loteData !== "object" || (loteData as any).nativeEvent) {
        console.warn("handleSaveLote llamado con argumento inválido:", loteData);
        return;
      }
      const payload = sanitizeJsonPayload(loteData);
      const saved = localDB.saveLote(payload, currentUser?.nombre || "Operador");
      if (saved && saved.LOTE_ID) {
        // Actualizar lotes tomando el estado unificado y canónicamente deduplicado de localDB
        const dbState = localDB.getState();
        setLotes(dbState.lotes || []);

        // Sincronizar en tiempo real con Firestore para todas las computadoras
        cloudSyncService.syncLote(saved).catch((err) => {
          console.warn("[App] Error sync lote to cloud:", err);
        });
      }
      return;
    } catch (e) {
      console.error("Error saving lote:", e);
      throw e;
    }
  };

  const handleSaveHumedad = async (humData: Partial<RegistroHumedad>): Promise<void> => {
    try {
      if (!humData || typeof humData !== "object" || (humData as any).nativeEvent) return;
      const payload = sanitizeJsonPayload(humData);
      const saved = localDB.saveHumedad(payload);
      if (saved && (saved["ID ANALISIS"] || saved.LOTE_ID)) {
        const dbState = localDB.getState();
        setHumedades(dbState.registroHumedad || []);
        setLotes(dbState.lotes || []);

        // Sincronizar en Firestore
        cloudSyncService.syncHumedad(saved).catch((err) => {
          console.warn("[App] Error sync humedad to cloud:", err);
        });
      }
      return;
    } catch (e) {
      console.error("Error saving humedad:", e);
      throw e;
    }
  };

  const handleSaveAnalisisHum = async (ahData: Partial<AnalisisHumedo>): Promise<void> => {
    try {
      if (!ahData || typeof ahData !== "object" || (ahData as any).nativeEvent) return;
      const payload = sanitizeJsonPayload(ahData);
      const saved = localDB.saveAnalisisHumedo(payload);
      if (saved && (saved.ANALISIS_HUMEDO_ID || saved.LOTE_ID)) {
        const dbState = localDB.getState();
        setAnalisisHum(dbState.analisisHumedo || []);
        setLotes(dbState.lotes || []);

        // Sincronizar en Firestore
        cloudSyncService.syncAnalisisHumedo(saved).catch((err) => {
          console.warn("[App] Error sync analisis humedo to cloud:", err);
        });
      }
      return;
    } catch (e) {
      console.error("Error saving analisis humedo:", e);
      throw e;
    }
  };

  const handleDeleteLote = async (loteId: string) => {
    try {
      const cleanId = (loteId || "").trim();
      localDB.deleteLote(cleanId, currentUser?.nombre || "Operador", true);

      // Backend API
      fetch(`/api/lotes/${encodeURIComponent(cleanId)}?_user=${encodeURIComponent(currentUser?.nombre || "Operador")}`, {
        method: "DELETE",
      }).catch((err) => console.warn("[App] Error calling DELETE /api/lotes:", err));

      // Eliminar de Firestore
      cloudSyncService.deleteLoteFromCloud(cleanId).catch((err) => {
        console.warn("[App] Error deleting lote from cloud:", err);
      });

      const dbState = localDB.getState();
      setLotes(dbState.lotes || []);
      setHumedades(dbState.registroHumedad || []);
      setAnalisisHum(dbState.analisisHumedo || []);
      setPresecados(dbState.presecado || []);
      setAnalisisSec(dbState.analisisSeco || []);
      setBatchLotes(dbState.batchLotes || []);
      setProgramaciones(dbState.programacionesOficiales || []);
    } catch (e) {
      console.error("Error deleting lote:", e);
      throw e;
    }
  };

  const handleSavePresecado = async (preData: Partial<Presecado>) => {
    try {
      if (!preData || typeof preData !== "object" || (preData as any).nativeEvent) return;
      const payload = sanitizeJsonPayload(preData);
      const saved = localDB.savePresecado(payload);
      if (saved) {
        setPresecados((prev) => {
          const idx = prev.findIndex(
            (p) =>
              (saved.PRESECADO_ID && p.PRESECADO_ID === saved.PRESECADO_ID) ||
              (saved.LOTE_ID && p.LOTE_ID === saved.LOTE_ID)
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });

        // Sincronizar en Firestore
        cloudSyncService.syncPresecado(saved).catch((err) => {
          console.warn("[App] Error sync presecado to cloud:", err);
        });
      }
    } catch (e) {
      console.error("Error saving presecado:", e);
    }
  };

  const handleSaveAnalisisSeco = async (asData: Partial<AnalisisSeco>) => {
    try {
      if (!asData || typeof asData !== "object" || (asData as any).nativeEvent) return;
      const payload = sanitizeJsonPayload(asData);
      const saved = localDB.saveAnalisisSeco(payload);
      if (saved) {
        setAnalisisSec((prev) => {
          const idx = prev.findIndex(
            (a) =>
              (saved.ANALISIS_SECO_ID && a.ANALISIS_SECO_ID === saved.ANALISIS_SECO_ID) ||
              (saved.LOTE_ID && a.LOTE_ID === saved.LOTE_ID)
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });

        // Sincronizar en Firestore
        cloudSyncService.syncAnalisisSeco(saved).catch((err) => {
          console.warn("[App] Error sync analisis seco to cloud:", err);
        });
      }
    } catch (e) {
      console.error("Error saving analisis seco:", e);
    }
  };

  const handleSaveProgramacion = async (progData: Partial<ProgramacionApit>) => {
    try {
      if (!progData || typeof progData !== "object" || (progData as any).nativeEvent) return;
      const payload = sanitizeJsonPayload(progData);
      const saved = localDB.saveProgramacion(payload);
      if (saved) {
        setProgramaciones((prev) => {
          const idx = prev.findIndex((p) => p.PROGRAMACION_ID === saved.PROGRAMACION_ID);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });

        // Sincronizar en Firestore
        cloudSyncService.syncProgramacion(saved).catch((err) => {
          console.warn("[App] Error sync programacion to cloud:", err);
        });
      }

      // Optimistically & securely update the lot's status so it immediately leaves the prioritization list
      if (progData.LOTE_ID) {
        setLotes((prev) =>
          prev.map((l) =>
            l.LOTE_ID === progData.LOTE_ID
              ? { ...l, ESTADO_LOTE: progData.APTO_APIT === "NO" ? "OBSERVADO" : "PROGRAMADO" }
              : l
          )
        );
      }

      // Refresh lotes from localDB
      setLotes(localDB.getLotes());
    } catch (e) {
      console.error("Error saving programacion:", e);
    }
  };

  const handleSaveBatch = async (batchData: Partial<BatchVaporizado>, assignedLotes: any[]): Promise<void> => {
    try {
      if (!batchData || typeof batchData !== "object" || (batchData as any).nativeEvent) {
        console.warn("handleSaveBatch llamado con argumento inválido:", batchData);
        return;
      }
      const cleanBatch = sanitizeJsonPayload(batchData);
      const cleanLotes = Array.isArray(assignedLotes) ? assignedLotes.map(sanitizeJsonPayload) : [];
      const isObserved = cleanBatch.ESTADO_BATCH === "OBSERVADO" || Boolean((cleanBatch as any)?.permitirDesviacion) || Boolean((cleanBatch as any)?.forzarGuardado);
      
      const saved = localDB.saveBatch(
        cleanBatch,
        cleanLotes,
        isObserved,
        currentUser?.nombre || "Operador"
      );

      if (saved && saved.BATCH_ID) {
        setBatches((prev) => {
          const idx = prev.findIndex((b) => b.BATCH_ID === saved.BATCH_ID);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });

        // Sincronizar batch con Firestore
        cloudSyncService.syncBatch(saved).catch((err) => {
          console.warn("[App] Error syncing batch to cloud:", err);
        });
      }

      // Refresh batchLotes, lotes, batches and programaciones from localDB
      const dbState = localDB.getState();
      setBatchLotes(dbState.batchLotes || []);
      setLotes(dbState.lotes || []);
      setBatches(dbState.batchesVaporizado || []);
      const progs = localDB.getProgramacionesOficiales();
      if (Array.isArray(progs) && progs.length > 0) {
        setProgramaciones(progs);
        guardarProgramacionesOficiales(progs);
        window.dispatchEvent(new CustomEvent("programaciones-oficiales-updated"));
      }
      return;
    } catch (e: any) {
      console.error("Error saving batch:", e);
      throw e;
    }
  };

  const handleSaveControl = async (ctrlData: Partial<ControlVaporizado>) => {
    try {
      const responseData = localDB.saveControlVaporizado(ctrlData, currentUser?.nombre || "Operador");
      const savedControl = responseData.control || responseData;
      const savedBatch = responseData.batch;

      if (savedControl) {
        setControles((prev) => {
          const idx = prev.findIndex((c) => 
            (c.CONTROL_VAPORIZADO_ID && savedControl.CONTROL_VAPORIZADO_ID && c.CONTROL_VAPORIZADO_ID === savedControl.CONTROL_VAPORIZADO_ID) ||
            (c.BATCH_ID && savedControl.BATCH_ID && c.BATCH_ID === savedControl.BATCH_ID)
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = savedControl;
            return next;
          }
          return [savedControl, ...prev];
        });

        // Sincronizar control en Firestore
        cloudSyncService.syncControl(savedControl).catch((err) => {
          console.warn("[App] Error sync control to cloud:", err);
        });
      }

      if (savedBatch && savedBatch.BATCH_ID) {
        setBatches((prev) => {
          const idx = prev.findIndex((b) => 
            b.BATCH_ID === savedBatch.BATCH_ID || 
            (savedBatch.CORRELATIVO && b.CORRELATIVO === savedBatch.CORRELATIVO)
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...savedBatch };
            return next;
          }
          return [savedBatch, ...prev];
        });

        // Sincronizar batch en Firestore
        cloudSyncService.syncBatch(savedBatch).catch((err) => {
          console.warn("[App] Error sync batch to cloud:", err);
        });
      }

      // Sincronizar batches, batch-lotes y lotes para reflejar el batch procesado y su estado en tiempo real
      const dbState = localDB.getState();
      setBatches(dbState.batchesVaporizado || []);
      setBatchLotes(dbState.batchLotes || []);
      setLotes(dbState.lotes || []);
    } catch (e) {
      console.error("Error saving control vaporizado:", e);
    }
  };

  const handleSaveAnalisisVap = async (avData: Partial<AnalisisVaporizado>) => {
    try {
      const saved = localDB.saveAnalisisVaporizado(avData);
      setAnalisisVap((prev) => {
        const idx = prev.findIndex((a) => a.ANALISIS_VAPORIZADO_ID === saved.ANALISIS_VAPORIZADO_ID);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      // Sincronizar en Firestore
      cloudSyncService.syncAnalisisVaporizado(saved).catch((err) => {
        console.warn("[App] Error sync analisis vaporizado to cloud:", err);
      });
    } catch (e) {
      console.error("Error saving analisis vaporizado:", e);
    }
  };

  const handleCloseLoteAsSuccessful = async (loteId: string, indiceExito: number) => {
    const estado = indiceExito >= 85 ? "CERRADO" : "OBSERVADO";
    await handleSaveLote({
      LOTE_ID: loteId,
      ESTADO_LOTE: estado,
      INDICE_EXITO: indiceExito
    });
  };

  const handleUpdateBatchState = async (batchId: string, newState: string) => {
    try {
      // Validación: Impedir pasar al estado 'Vaporizando' / 'EN PROCESO' si no se ha completado la etapa de 'Carga'
      const isTargetVaporizando =
        newState === "Vaporizando" ||
        newState === "VAPORIZANDO" ||
        newState === "EN_PROCESO" ||
        newState === "EN PROCESO";

      if (isTargetVaporizando) {
        const currentBatch = batches.find((b) => b.BATCH_ID === batchId || b.CORRELATIVO === batchId);
        const ctrl = controles.find((c) => c.BATCH_ID === batchId || c.BATCH_ID === currentBatch?.BATCH_ID);

        const cargaCompletada = Boolean(
          (currentBatch as any)?.cargaCompletada ||
          (currentBatch as any)?.CARGA_COMPLETADA ||
          (ctrl?.carga && (
            (ctrl.carga as any).completada ||
            (ctrl.carga.fin && ctrl.carga.fin.trim() !== "") ||
            (ctrl.carga.cantidad_tn > 0 && ctrl.carga.inicio && ctrl.carga.inicio.trim() !== "")
          ))
        );

        if (!cargaCompletada) {
          console.warn(`[Validación] No se puede pasar el Batch ${batchId} al estado '${newState}': La etapa de 'Carga' debe estar marcada como completada primero.`);
          return;
        }
      }

      const nowStr = new Date().toISOString().replace("T", " ").substring(0, 16);
      const updatePayload: any = { ESTADO_BATCH: newState };
      if (newState === "EN_PROCESO" || newState === "EN PROCESO" || newState === "Vaporizando" || newState === "VAPORIZANDO") {
        updatePayload.FECHA_INICIO = nowStr;
      } else if (newState === "COMPLETADO" || newState === "TERMINADO") {
        updatePayload.FECHA_FIN = nowStr;
      }
      
      const updated = localDB.updateBatch(batchId, updatePayload, currentUser?.nombre);
      if (updated) {
        setBatches(prev => prev.map(b => b.BATCH_ID === batchId ? { ...b, ...updated } : b));
      }
    } catch (err) {
      console.error("Error actualizando estado del batch:", err);
    }
  };

  const handleDeleteBatch = async (batchId: string, force: boolean = false): Promise<void> => {
    try {
      const rawId = (batchId || "").trim();
      if (!rawId) return;
      const cleanId = rawId.toUpperCase();

      // 1. Recopilar todas las claves e identificadores asociados al batch
      const targetKeys = new Set<string>([cleanId]);

      const foundBatch = batches.find((b) => 
        (b.BATCH_ID && b.BATCH_ID.trim().toUpperCase() === cleanId) ||
        (b.CORRELATIVO && b.CORRELATIVO.trim().toUpperCase() === cleanId) ||
        ((b as any).id && String((b as any).id).trim().toUpperCase() === cleanId)
      ) || (localDB.getState().batchesVaporizado || []).find((b) =>
        (b.BATCH_ID && b.BATCH_ID.trim().toUpperCase() === cleanId) ||
        (b.CORRELATIVO && b.CORRELATIVO.trim().toUpperCase() === cleanId) ||
        ((b as any).id && String((b as any).id).trim().toUpperCase() === cleanId)
      );

      if (foundBatch) {
        if (foundBatch.BATCH_ID) targetKeys.add(foundBatch.BATCH_ID.trim().toUpperCase());
        if (foundBatch.CORRELATIVO) targetKeys.add(foundBatch.CORRELATIVO.trim().toUpperCase());
        if ((foundBatch as any).id) targetKeys.add(String((foundBatch as any).id).trim().toUpperCase());
      }

      const progs = localDB.getState().programacionesOficiales || [];
      progs.forEach((p: any) => {
        const pId = (p.id || "").trim().toUpperCase();
        const pBatch = (p.batch || "").trim().toUpperCase();
        const pCaso = (p.caso || "").trim().toUpperCase();
        if (targetKeys.has(pId) || targetKeys.has(pBatch) || targetKeys.has(pCaso)) {
          if (pId) targetKeys.add(pId);
          if (pBatch) targetKeys.add(pBatch);
          if (pCaso) targetKeys.add(pCaso);
        }
      });

      // 2. Unificar controles desde el state de App y desde localDB para verificar dependencias
      const allControlesMap = new Map<string, ControlVaporizado>();
      (localDB.getState().controlVaporizado || []).forEach((c) => {
        if (c) {
          const key = c.CONTROL_VAPORIZADO_ID || `${c.BATCH_ID}-${c.FECHA_HORA_INICIO || Math.random()}`;
          allControlesMap.set(key, c);
        }
      });
      controles.forEach((c) => {
        if (c) {
          const key = c.CONTROL_VAPORIZADO_ID || `${c.BATCH_ID}-${c.FECHA_HORA_INICIO || Math.random()}`;
          allControlesMap.set(key, c);
        }
      });

      // 3. Filtrar los controles que pertenezcan a este batch
      const associatedControles = Array.from(allControlesMap.values()).filter((c) => {
        const cBatch = (c.BATCH_ID || "").trim().toUpperCase();
        const cCorr = (c.CORRELATIVO || "").trim().toUpperCase();
        const cCod = (c.CODIGO_INTERNO || (c as any).datosIngreso?.codigo || "").trim().toUpperCase();
        return (
          (cBatch && targetKeys.has(cBatch)) ||
          (cCorr && targetKeys.has(cCorr)) ||
          (cCod && targetKeys.has(cCod))
        );
      });

      // 4. Si existen controles asociados y NO es eliminación forzada en cascada:
      // Mostrar alerta interactiva que permite al usuario decidir eliminar en cascada o ir a la vista
      if (associatedControles.length > 0 && !force) {
        const displayCode = foundBatch?.CORRELATIVO || foundBatch?.BATCH_ID || rawId;

        // Mostrar alerta modal interactiva y contextual al usuario con opción de eliminación en cascada
        setBatchDeleteBlockedAlert({
          batchCode: displayCode,
          batchId: rawId,
          controlesCount: associatedControles.length,
          controles: associatedControles.map((c) => ({
            id: c.CONTROL_VAPORIZADO_ID || c.BATCH_ID,
            fecha: c.FECHA_HORA_INICIO || "Sin fecha registrada",
            operador: c.OPERADOR || "Operador no registrado",
          })),
        });

        console.warn(`[App] Eliminación con dependencias: Batch ${displayCode} tiene ${associatedControles.length} controles dependientes. Abriendo diálogo de confirmación.`);
        return;
      }

      // Si force === true o no existen controles, proceder con la eliminación segura
      localDB.deleteBatch(rawId, currentUser?.nombre || "Operador", true);

      // Backend API con force=true
      fetch(`/api/batches/${encodeURIComponent(rawId)}?_user=${encodeURIComponent(currentUser?.nombre || "Operador")}&force=true`, {
        method: "DELETE",
      }).catch((err) => console.warn("[App] Error calling DELETE /api/batches:", err));

      // Eliminar de Firestore
      cloudSyncService.deleteBatchFromCloud(rawId).catch((err) => {
        console.warn("[App] Error deleting batch from cloud:", err);
      });

      const dbState = localDB.getState();
      setLotes(dbState.lotes || []);
      setBatches(dbState.batchesVaporizado || []);
      setBatchLotes(dbState.batchLotes || []);
      setProgramaciones(dbState.programacionesOficiales || []);
      setControles(dbState.controlVaporizado || []);
      setBatchDeleteBlockedAlert(null);
    } catch (err) {
      console.error("Error en handleDeleteBatch:", err);
    }
  };

  // --- AI HANDLERS ---
  const handleRequestAIRecommendation = async (loteId: string): Promise<AIRecommendationResult> => {
    return localDB.simulateAIRecommendation(loteId);
  };

  const handleRequestSimulation = async (params: any): Promise<AISimulationResult> => {
    return localDB.simulateProcess(params);
  };

  const handleApplyOCRData = (tipoFormato: string, data: any, imagenUrl?: string) => {
    setPendingOCRData({ tipoFormato, data, imagenUrl, timestamp: Date.now() });
    if (tipoFormato === "ANALISIS_VAPORIZADO") {
      setActiveTab("analisis-vaporizado");
    } else {
      setActiveTab("lotes");
    }
  };

  const handleSaveWeights = async (newWeights: SuccessWeights) => {
    setWeights(newWeights);
    try {
      localDB.saveSuccessWeights(newWeights);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePriorizacionConfig = async (newCfg: PriorizacionMasterConfig) => {
    setPriorizacionConfig(newCfg);
    try {
      localDB.savePriorizacionConfig(newCfg);
    } catch (e) {
      console.error("Error guardando configuración de priorización:", e);
    }
  };

  const handleSaveEvaluacionConfig = async (newCfg: ConfiguracionEvaluacionLotes) => {
    setEvaluacionConfig(newCfg);
    try {
      localDB.saveEvaluacionConfig(newCfg);
    } catch (e) {
      console.error("Error guardando configuración maestra de evaluación de lotes:", e);
    }
  };

  const handleSaveParametros = async (newParams: Partial<ParametrosTrabajo>, motivo?: string) => {
    try {
      const merged = { ...parametrosTrabajo, ...newParams } as ParametrosTrabajo;
      setParametrosTrabajo(merged);
      guardarParametrosTrabajoLocal(merged);

      const saved = localDB.saveParametrosTrabajo(newParams, motivo, currentUser?.nombre);
      if (saved) {
        setParametrosTrabajo(saved);
        guardarParametrosTrabajoLocal(saved);
        const histRes = localDB.getState().historialParametros || [];
        setHistorialParametros(histRes);
      }
    } catch (e) {
      console.error("Error guardando parámetros de trabajo:", e);
    }
  };

  // Compute calculated lots priority for badges & navigation
  const lotesPriorizados = React.useMemo(() => {
    return calcularPrioridadesLotes(lotes, analisisHum, priorizacionConfig);
  }, [lotes, analisisHum, priorizacionConfig]);

  const emergenciasCount = React.useMemo(() => {
    return lotesPriorizados.filter(l => l.nivelRiesgo === "EMERGENCIA").length;
  }, [lotesPriorizados]);

  // Apply AI Daily Scheduling Plan into Batches and Programacion
  const handleApplyPlanToProgramacion = async (plan: AIPlanProgramacionDia) => {
    try {
      const fechaPlan = plan.fecha || new Date().toISOString().split("T")[0];
      for (const batchPropuesto of plan.batches_propuestos) {
        const batchId = batchPropuesto.batch_temp_id || `BAT-${Date.now()}`;
        // Save new batch
        const newBatchObj: Partial<BatchVaporizado> = {
          BATCH_ID: batchId,
          FECHA_PROGRAMADA: fechaPlan,
          EQUIPO: batchPropuesto.equipo_sugerido,
          CAPACIDAD_PROGRAMADA_TN: batchPropuesto.capacidad_equipo_tn,
          TON_PROGRAMADAS: batchPropuesto.ton_totales_batch,
          ESTADO_BATCH: "PROGRAMADO",
          OPERADOR: currentUser?.nombre || "Operador APIT"
        };

        const loteIds = batchPropuesto.lotes_incluidos.map(li => li.lote_id);
        await handleSaveBatch(newBatchObj, loteIds);

        // Also create programacion APIT for each lot
        for (const li of batchPropuesto.lotes_incluidos) {
          const progObj: Partial<ProgramacionApit> = {
            PROGRAMACION_ID: `PROG-${Date.now()}-${li.lote_id}`,
            BATCH_ID: batchId,
            LOTE_ID: li.lote_id,
            FECHA_PROGRAMACION: fechaPlan,
            PRIORIDAD: "ALTA",
            SACOS_PROGRAMADOS: li.sacos,
            PESO_PROGRAMADO_KG: li.peso_kg,
            HUMEDAD_REFERENCIA: li.humedad,
            ESTADO_PROGRAMACION: "PROGRAMADO",
            APTO_APIT: "SI",
            OBSERVACIONES: `Batch ${batchId} - ${batchPropuesto.justificacion_tecnica}`
          };
          await handleSaveProgramacion(progObj);
        }
      }

      await fetchAllData();
      setActiveTab("batches");
    } catch (err) {
      console.error("Error aplicando plan de programación:", err);
    }
  };

  const pendientesDescargaCount = useMemo(() => {
    const avBatchSet = new Set<string>();
    for (const a of analisisVap) {
      if (a.BATCH_ID) avBatchSet.add(a.BATCH_ID);
    }
    let count = 0;
    for (const b of batches) {
      const hasMuestra = avBatchSet.has(b.BATCH_ID) || (b.CORRELATIVO ? avBatchSet.has(b.CORRELATIVO) : false);
      if (!hasMuestra) count++;
    }
    return count;
  }, [batches, analisisVap]);

  const pendientesCoccionCount = useMemo(() => {
    const resCoccion = obtenerResultadosCoccionLocales();
    // Index batchLotes by BATCH_ID for O(1) retrieval instead of O(N) filter per batch
    const batchLotesMap = new Map<string, string[]>();
    for (const bl of batchLotes) {
      if (bl.BATCH_ID) {
        const arr = batchLotesMap.get(bl.BATCH_ID);
        if (arr) {
          arr.push(bl.LOTE_ID);
        } else {
          batchLotesMap.set(bl.BATCH_ID, [bl.LOTE_ID]);
        }
      }
    }

    return batches.filter(b => {
      const bLotes = batchLotesMap.get(b.BATCH_ID) || [];
      const c = buscarCoccionParaBatch(b.BATCH_ID, b.CORRELATIVO, bLotes, resCoccion);
      if (!c) return true;
      const tiempoFalta = c.tiempoCoccionMin === undefined || c.tiempoCoccionMin === null || String(c.tiempoCoccionMin).trim() === "";
      const dosifFalta = !c.tazasArroz || !c.tazasAgua;
      const granoCocidoFalta = !c.sabor && !c.desplazamientoSeg;
      const defectosFalta = c.granoQuebradoOllaPct === undefined && c.granoHinchadoPct === undefined && c.granoAbiertoPct === undefined;
      const texturaFalta = !c.texturaFrio && !c.texturaFrioDescarga;
      const puntajeFalta = c.puntajeCoccion === undefined || c.puntajeCoccion === null || c.puntajeCoccion <= 0;
      const envaseFalta = !c.envaseProyectado || c.envaseProyectado.trim() === "";
      return tiempoFalta || dosifFalta || granoCocidoFalta || defectosFalta || texturaFalta || puntajeFalta || envaseFalta;
    }).length;
  }, [batches, batchLotes]);

  // Memoized lotes aptos count with fast Map lookup (O(N) instead of O(N^2) on every render)
  const lotesAptosCount = useMemo(() => {
    const ahMap = new Map<string, AnalisisHumedo>();
    for (const a of analisisHum) {
      if (a.LOTE_ID) ahMap.set(a.LOTE_ID, a);
    }
    let count = 0;
    for (const l of lotes) {
      const ah = ahMap.get(l.LOTE_ID);
      const ev = calcularEvaluacionLote(ah, l, l.HUM, l.DESV, evaluacionConfig);
      if (ev.estadoAprobacion === "APROBADO") count++;
    }
    return count;
  }, [lotes, analisisHum, evaluacionConfig]);

  // Si no hay sesión autenticada, mostrar pantalla de Login con PIN
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <LoginView
          users={usersList}
          targetUserIdFromUrl={targetUserFromUrl}
          targetRoleFromUrl={targetRoleFromUrl}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsAuthenticated(true);
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Main Navigation Header */}
      <Header
        currentUser={currentUser}
        users={usersList}
        onSelectUser={handleSelectUser}
        onRoleChange={handleRoleChange}
        onLogout={handleLogout}
        onOpenOCR={() => setIsOCRModalOpen(true)}
        onOpenExcelSync={() => setIsExcelModalOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
        onOpenConfig={() => setIsWeightsModalOpen(true)}
        onOpenConfigEvaluacion={() => {
          setConfigEvaluacionInitialTab("criterios");
          setIsConfigEvaluacionModalOpen(true);
        }}
        onOpenSimulator={() => setActiveTab("simulador")}
        onOpenUsuariosModal={() => setIsUsuariosModalOpen(true)}
        onOpenResetTesting={() => setIsResetTestingModalOpen(true)}
      />

      {/* Master Operational Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setTargetFilterId(undefined);
          setTargetSubTab(undefined);
        }}
        lotesCount={lotes.length}
        batchesCount={batches.length}
        pendientesDescargaCount={pendientesDescargaCount}
        pendientesCoccionCount={pendientesCoccionCount}
        emergenciasCount={emergenciasCount}
        currentUserRole={currentUser.rol}
        onOpenOCR={() => setIsOCRModalOpen(true)}
        onOpenExcelSync={() => setIsExcelModalOpen(true)}
        onOpenConfig={() => setIsWeightsModalOpen(true)}
        lotesAptosCount={lotesAptosCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        <ViewErrorBoundary viewName={activeTab}>
          <Suspense fallback={<ViewLoadingFallback />}>
            {activeTab === "dashboard" && (
            <DashboardView
              lotes={lotes}
              batches={batches}
              controles={controles}
              analisisHum={analisisHum}
              analisisSec={analisisSec}
              analisisVap={analisisVap}
              equipos={equipos}
              batchLotes={batchLotes}
              humedades={humedades}
              evaluacionConfig={evaluacionConfig}
              onNavigate={handleNavigate}
              onOpenReport={handleOpenReport}
              onOpenConfigEvaluacion={() => {
                setConfigEvaluacionInitialTab("alertas");
                setIsConfigEvaluacionModalOpen(true);
              }}
            />
          )}

          {(activeTab === "lotes" || activeTab === "humedad" || activeTab === "analisis-humedo") && (
            <RecepcionLotesView
              lotes={lotes}
              estados={estados}
              humedades={humedades}
              analisisHumedos={analisisHum}
              evaluacionConfig={evaluacionConfig}
              currentUser={currentUser}
              initialLoteId={targetFilterId}
              pendingOCRData={pendingOCRData}
              onClearPendingOCR={() => setPendingOCRData(null)}
              onSaveLote={handleSaveLote}
              onSaveHumedad={handleSaveHumedad}
              onSaveAnalisisHum={handleSaveAnalisisHum}
              onDeleteLote={handleDeleteLote}
              onNavigate={handleNavigate}
              onOpenReport={handleOpenReport}
              onOpenOCR={() => setIsOCRModalOpen(true)}
              onOpenConfigEvaluacion={() => {
                setConfigEvaluacionInitialTab("criterios");
                setIsConfigEvaluacionModalOpen(true);
              }}
              onOpenExcelSync={() => setIsExcelModalOpen(true)}
            />
          )}

          {activeTab === "presecado-seco" && (
            <PresecadoSecoView
              presecados={presecados}
              analisisSecos={analisisSec}
              analisisHumedos={analisisHum}
              lotes={lotes}
              initialLoteId={targetFilterId}
              currentUser={currentUser}
              onSavePresecado={handleSavePresecado}
              onSaveAnalisisSeco={handleSaveAnalisisSeco}
            />
          )}

          {(activeTab === "priorizacion-programacion" || activeTab === "priorizacion" || activeTab === "programacion-apit" || activeTab === "programacion" || activeTab === "creacion-batch" || activeTab === "crear-batch" || activeTab === "programacion-batch" || activeTab === "programacion-oficial") && (
            <PriorizacionProgramacionView
              lotes={lotes}
              analisisHumedos={analisisHum}
              presecados={presecados}
              programaciones={programaciones}
              batches={batches}
              batchLotes={batchLotes}
              equipos={equipos}
              config={priorizacionConfig}
              initialLoteId={targetFilterId}
              currentUser={currentUser}
              onUpdateConfig={handleSavePriorizacionConfig}
              onSelectLoteForFicha={handleOpenReport}
              onSaveProgramacion={handleSaveProgramacion}
              onSaveBatch={handleSaveBatch}
              onDeleteBatch={handleDeleteBatch}
              onRefreshData={fetchAllData}
              onApplyPlanToProgramacion={handleApplyPlanToProgramacion}
              onRequestAIRecommendation={handleRequestAIRecommendation}
              onNavigate={handleNavigate}
              parametros={parametrosTrabajo}
              historialParametros={historialParametros}
              onSaveParametros={handleSaveParametros}
            />
          )}

          {activeTab === "batches" && (
            <BatchVaporizadoView
              batches={batches}
              lotes={lotes}
              batchLotes={batchLotes}
              analisisHumedos={analisisHum}
              analisisSecos={analisisSec}
              analisisVapList={analisisVap}
              controles={controles}
              presecados={presecados}
              equipos={equipos}
              currentUser={currentUser}
              parametros={parametrosTrabajo}
              historialParametros={historialParametros}
              onSaveBatch={handleSaveBatch}
              onDeleteBatch={handleDeleteBatch}
              onUpdateBatchState={handleUpdateBatchState}
              onSaveParametros={handleSaveParametros}
              onRefreshData={fetchAllData}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === "control-vaporizado" && (
            <ControlVaporizadoView
              controles={controles}
              batches={batches}
              batchLotes={batchLotes}
              lotes={lotes}
              analisisHumList={analisisHum}
              presecados={presecados}
              analisisSecList={analisisSec}
              humedades={humedades}
              initialBatchId={targetFilterId}
              currentUser={currentUser}
              onSaveControl={handleSaveControl}
              onNavigate={handleNavigate}
              onRefreshData={fetchAllData}
            />
          )}

          {activeTab === "analisis-vaporizado" && (
            <AnalisisVaporizadoView
              analisisVapList={analisisVap}
              batches={batches}
              batchLotes={batchLotes}
              lotes={lotes}
              controles={controles}
              presecados={presecados}
              analisisHumList={analisisHum}
              analisisSecList={analisisSec}
              initialBatchId={targetFilterId}
              initialSubTab={targetSubTab as any}
              currentUser={currentUser}
              onSaveAnalisisVap={handleSaveAnalisisVap}
              onOpenOCR={() => setIsOCRModalOpen(true)}
              onNavigate={handleNavigate}
              onRefreshData={fetchAllData}
            />
          )}

          {(activeTab === "analisis-descarga" || activeTab === "descarga" || activeTab === "analisis-descarga-pendientes") && (
            <AnalisisDescargaView
              batches={batches}
              batchLotes={batchLotes}
              lotes={lotes}
              analisisVapList={analisisVap}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onSaveAnalisisVap={handleSaveAnalisisVap}
              onOpenOCR={() => setIsOCRModalOpen(true)}
              onRefreshData={fetchAllData}
            />
          )}

          {(activeTab === "resultados-coccion" || activeTab === "evaluacion-coccion" || activeTab === "coccion" || activeTab === "carga-coccion" || activeTab === "cocciones-pendientes" || activeTab === "resultados-defectos" || activeTab === "resultados") && (
            <ResultadosCoccionView
              batches={batches}
              batchLotes={batchLotes}
              lotes={lotes}
              analisisVapList={analisisVap}
              programaciones={programaciones}
              presecados={presecados}
              analisisHumList={analisisHum}
              analisisSecList={analisisSec}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onRefreshData={fetchAllData}
            />
          )}

          {(activeTab === "evaluacion-batch" || activeTab === "comparador" || activeTab === "comparador-procesos" || activeTab === "evaluacion-procesos" || activeTab === "sabana-batches" || activeTab === "replicador-recetas") && (
            <ComparadorEvaluacionProcesos
              batches={batches}
              batchLotes={batchLotes}
              lotes={lotes}
              controles={controles}
              analisisVapList={analisisVap}
              presecados={presecados}
              analisisHumList={analisisHum}
              analisisSecList={analisisSec}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onProgramarConReceta={(receta, loteIds) => {
                if (loteIds && loteIds.length > 0) {
                  handleNavigate("priorizacion-programacion", loteIds[0]);
                } else {
                  handleNavigate("priorizacion-programacion");
                }
              }}
            />
          )}

          {activeTab === "simulador" && (
            <SimuladorView
              lotes={lotes}
              currentUser={currentUser}
              onRequestSimulation={handleRequestSimulation}
            />
          )}
        </Suspense>
      </ViewErrorBoundary>
    </main>

      {/* Global Modals loaded on-demand via Suspense */}
      <Suspense fallback={null}>
        {isOCRModalOpen && (
          <OCRScannerModal
            isOpen={isOCRModalOpen}
            onClose={() => setIsOCRModalOpen(false)}
            onApplyOCRData={handleApplyOCRData}
            onDirectSave={async (lote, humedad, analisis) => {
              await handleSaveLote(lote);
              if (humedad) await handleSaveHumedad(humedad);
              if (analisis) await handleSaveAnalisisHum(analisis);
            }}
          />
        )}

        {isReportModalOpen && (
          <InformeLoteModal
            isOpen={isReportModalOpen}
            loteId={reportTargetLoteId}
            lotes={lotes}
            analisisHumedos={analisisHum}
            analisisSecos={analisisSec}
            analisisVapList={analisisVap}
            controles={controles}
            programaciones={programaciones}
            batches={batches}
            humedades={humedades}
            weights={weights}
            onClose={() => setIsReportModalOpen(false)}
          />
        )}

        {isWeightsModalOpen && (
          <ConfigWeightsModal
            isOpen={isWeightsModalOpen}
            weights={weights}
            equipos={equipos}
            estados={estados}
            onSaveWeights={handleSaveWeights}
            onClose={() => setIsWeightsModalOpen(false)}
          />
        )}

        {isExcelModalOpen && (
          <ExcelSyncModal
            isOpen={isExcelModalOpen}
            onClose={() => setIsExcelModalOpen(false)}
            allData={{
              lotes,
              humedades,
              analisisHum,
              presecados,
              analisisSec,
              programaciones,
              batches,
              batchLotes,
              controles,
              analisisVap,
              equipos,
              estados
            }}
            onImportData={async (data) => {
              await fetchAllData();
            }}
          />
        )}

        {isCloudSyncModalOpen && (
          <CloudSyncModal
            isOpen={isCloudSyncModalOpen}
            onClose={() => setIsCloudSyncModalOpen(false)}
            onSyncComplete={fetchAllData}
          />
        )}

        {isConfigEvaluacionModalOpen && (
          <ConfigEvaluacionLotesModal
            isOpen={isConfigEvaluacionModalOpen}
            onClose={() => setIsConfigEvaluacionModalOpen(false)}
            config={evaluacionConfig}
            onSaveConfig={handleSaveEvaluacionConfig}
            currentUser={currentUser}
            lotes={lotes}
            analisisHumedos={analisisHum}
            humedades={humedades}
            initialTab={configEvaluacionInitialTab}
          />
        )}

        {isUsuariosModalOpen && (
          <UsuariosModal
            isOpen={isUsuariosModalOpen}
            onClose={() => setIsUsuariosModalOpen(false)}
            currentUser={currentUser}
            users={usersList}
            onSelectUser={(u) => {
              handleSelectUser(u);
              setIsUsuariosModalOpen(false);
            }}
            onUpdateUsers={handleUpdateUsers}
          />
        )}
      </Suspense>

      {/* Alerta de Batch Bloqueado por Controles de Vaporizado Asociados */}
      {batchDeleteBlockedAlert && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="blocked-batch-title"
        >
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-white relative overflow-hidden">
            {/* Ambient glow background */}
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="blocked-batch-title" className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Eliminación Bloqueada</span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    {batchDeleteBlockedAlert.batchCode}
                  </span>
                </h3>
                <p className="text-xs text-amber-400/90 font-medium mt-0.5">
                  El batch registra controles dependientes en el sistema
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchDeleteBlockedAlert(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-200/90 leading-relaxed">
                <p>
                  No se puede eliminar el batch <strong className="text-white font-semibold">{batchDeleteBlockedAlert.batchCode}</strong> porque tiene <strong className="text-amber-300 font-bold">{batchDeleteBlockedAlert.controlesCount} registro(s) de control de vaporizado</strong> vinculado(s).
                </p>
                <p className="mt-2 text-xs text-amber-300/80">
                  ⚠️ Por normas de trazabilidad e integridad de los datos de calidad, debe eliminar primero los registros de control de forma manual en la pestaña <span className="font-semibold text-white">Control de Vaporizado</span> antes de retirar este batch.
                </p>
              </div>

              {batchDeleteBlockedAlert.controles.length > 0 && (
                <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 max-h-36 overflow-y-auto custom-scrollbar">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Controles Dependientes Detectados:
                  </div>
                  <div className="space-y-1.5">
                    {batchDeleteBlockedAlert.controles.map((c, idx) => (
                      <div key={c.id || idx} className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded border border-slate-700/40">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="font-mono font-medium text-slate-200 truncate">{c.id}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 text-right shrink-0">
                          <span>{c.fecha}</span>
                          {c.operador && <span className="ml-2 text-slate-500">({c.operador})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBatchDeleteBlockedAlert(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetCode = batchDeleteBlockedAlert.batchCode;
                  setBatchDeleteBlockedAlert(null);
                  handleNavigate("control-vaporizado", targetCode);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-amber-200 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Revisar en Control</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = batchDeleteBlockedAlert.batchId;
                  await handleDeleteBatch(id, true);
                  setBatchDeleteBlockedAlert(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-lg transition-colors shadow-lg shadow-rose-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar en Cascada (Batch + Controles)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Eliminación de Información para Iniciar Pruebas */}
      {isResetTestingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div 
            id="reset-testing-modal"
            className="relative w-full max-w-lg bg-slate-900 border border-rose-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-gradient-to-r from-rose-950/50 via-slate-900 to-amber-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Iniciar Pruebas del Sistema
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                      Limpieza Total
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Eliminar registros existentes para comenzar pruebas desde cero
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isResettingData) setIsResetTestingModalOpen(false);
                }}
                disabled={isResettingData}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {resetSuccessMessage ? (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span className="font-medium">{resetSuccessMessage}</span>
                </div>
              ) : (
                <>
                  <div className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-rose-200 leading-relaxed space-y-1.5">
                      <p className="font-semibold text-rose-100">
                        ¿Estás seguro de que deseas eliminar toda la información registrada?
                      </p>
                      <p className="text-slate-300">
                        Esta acción borrará de manera inmediata todos los <strong>lotes, análisis húmedos, registros de humedad, controles y batches</strong> tanto en la nube de Firebase como en el almacenamiento local de este navegador.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Estado después de la limpieza:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                      <li>Base de datos vacía lista para registrar tus propios lotes y datos reales.</li>
                      <li>Catálogo de usuarios, equipos y configuraciones maestras se mantienen intactos.</li>
                      <li>Sincronización en la nube totalmente limpia y sin errores de cuota o saturación.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            {!resetSuccessMessage && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsResetTestingModalOpen(false)}
                  disabled={isResettingData}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirm-purge-modal"
                  type="button"
                  onClick={handleExecuteResetTesting}
                  disabled={isResettingData}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-xl transition-all shadow-lg shadow-rose-900/40 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  {isResettingData ? "Eliminando registros..." : "Sí, Eliminar Todo y Comenzar Pruebas"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
