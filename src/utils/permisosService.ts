import { UserRole } from "../types";
import { TabType } from "../components/Navigation";

export type PermisoAccion =
  | "ver_dashboard"
  | "ver_lotes"
  | "editar_lotes"
  | "registrar_analisis_calidad"
  | "dictamen_aprobacion_calidad"
  | "crear_programacion_batch"
  | "editar_receta_autoclave"
  | "operar_autoclave_piso"
  | "control_secadoras_piso"
  | "cerrar_aprobar_batch"
  | "registrar_prueba_coccion"
  | "modificar_pesos_algoritmo"
  | "modificar_criterios_evaluacion"
  | "sincronizar_excel"
  | "usar_ocr_documentos"
  | "acceder_simulador_ia"
  | "gestionar_usuarios";

export interface PermisosRol {
  rol: UserRole;
  titulo: string;
  descripcion: string;
  esSuperAdmin: boolean;
  modulosPermitidos: TabType[];
  acciones: Record<PermisoAccion, boolean>;
  restriccionesClave: string[];
  vistasPrincipales: string[];
}

export const MATRIZ_PERMISOS: Record<UserRole, PermisosRol> = {
  PROGRAMADOR: {
    rol: "PROGRAMADOR",
    titulo: "Ingeniería / Programador (Fredy)",
    descripcion: "Super Admin del sistema con control total, calibración de IA, fórmulas matemáticas y base de datos.",
    esSuperAdmin: true,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "priorizacion-programacion",
      "control-vaporizado",
      "batches",
      "analisis-vaporizado",
      "comparador",
      "simulador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: true,
      dictamen_aprobacion_calidad: true,
      crear_programacion_batch: true,
      editar_receta_autoclave: true,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: true,
      registrar_prueba_coccion: true,
      modificar_pesos_algoritmo: true,
      modificar_criterios_evaluacion: true,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: true,
      gestionar_usuarios: true
    },
    restriccionesClave: [
      "Ninguna. Acceso total a código, algoritmos, calibración de IA y auditoría de datos."
    ],
    vistasPrincipales: ["Todas las 8 Vistas y Paneles de Configuración Avanzada"]
  },

  INGENIERO_PROGRAMADOR: {
    rol: "INGENIERO_PROGRAMADOR",
    titulo: "Ingeniería / Programador",
    descripcion: "Super Admin del sistema con control total.",
    esSuperAdmin: true,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "priorizacion-programacion",
      "control-vaporizado",
      "batches",
      "analisis-vaporizado",
      "comparador",
      "simulador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: true,
      dictamen_aprobacion_calidad: true,
      crear_programacion_batch: true,
      editar_receta_autoclave: true,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: true,
      registrar_prueba_coccion: true,
      modificar_pesos_algoritmo: true,
      modificar_criterios_evaluacion: true,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: true,
      gestionar_usuarios: true
    },
    restriccionesClave: ["Acceso ilimitado a nivel de ingeniería."],
    vistasPrincipales: ["Todas las 8 Vistas"]
  },

  ADMINISTRADOR: {
    rol: "ADMINISTRADOR",
    titulo: "Administración General",
    descripcion: "Control administrativo general de la planta.",
    esSuperAdmin: true,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "priorizacion-programacion",
      "control-vaporizado",
      "batches",
      "analisis-vaporizado",
      "comparador",
      "simulador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: true,
      dictamen_aprobacion_calidad: true,
      crear_programacion_batch: true,
      editar_receta_autoclave: true,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: true,
      registrar_prueba_coccion: true,
      modificar_pesos_algoritmo: true,
      modificar_criterios_evaluacion: true,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: true,
      gestionar_usuarios: true
    },
    restriccionesClave: ["Acceso administrativo integral."],
    vistasPrincipales: ["Todas las 8 Vistas"]
  },

  ADMIN: {
    rol: "ADMIN",
    titulo: "Administración",
    descripcion: "Perfil de administración general.",
    esSuperAdmin: true,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "priorizacion-programacion",
      "control-vaporizado",
      "batches",
      "analisis-vaporizado",
      "comparador",
      "simulador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: true,
      dictamen_aprobacion_calidad: true,
      crear_programacion_batch: true,
      editar_receta_autoclave: true,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: true,
      registrar_prueba_coccion: true,
      modificar_pesos_algoritmo: true,
      modificar_criterios_evaluacion: true,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: true,
      gestionar_usuarios: true
    },
    restriccionesClave: ["Acceso administrativo integral."],
    vistasPrincipales: ["Todas las 8 Vistas"]
  },

  JEFE_VAPORIZADO: {
    rol: "JEFE_VAPORIZADO",
    titulo: "Jefe de Planta y Vaporizado",
    descripcion: "Aprobación ejecutiva de recetas, programación diaria de producción y cierre formal de batches.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "priorizacion-programacion",
      "control-vaporizado",
      "batches",
      "analisis-vaporizado",
      "comparador",
      "simulador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: false,
      dictamen_aprobacion_calidad: false,
      crear_programacion_batch: true,
      editar_receta_autoclave: true,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: true,
      registrar_prueba_coccion: false,
      modificar_pesos_algoritmo: false, // Solo Programador
      modificar_criterios_evaluacion: true,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: true,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Modificación de pesos matemáticos base del algoritmo (exclusivo Programación/Ingeniería).",
      "Restringido: Dictamen técnico de laboratorio de control de calidad (exclusivo Analista de Calidad)."
    ],
    vistasPrincipales: [
      "Paso 2: Programación & Recetas",
      "Paso 3: Proceso Vaporizado",
      "Paso 4: Batches Guardados & Cierre",
      "Paso 6: Benchmarking & Cocción"
    ]
  },

  JEFE_PLANTA: {
    rol: "JEFE_PLANTA",
    titulo: "Jefe de Planta",
    descripcion: "Jefatura de planta de producción.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "priorizacion-programacion",
      "control-vaporizado",
      "batches",
      "analisis-vaporizado",
      "comparador",
      "simulador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: false,
      dictamen_aprobacion_calidad: false,
      crear_programacion_batch: true,
      editar_receta_autoclave: true,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: true,
      registrar_prueba_coccion: false,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: true,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: true,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Modificación de pesos matemáticos IA.",
      "Restringido: Firma de laboratorio de control de calidad."
    ],
    vistasPrincipales: [
      "Programación de Batches",
      "Monitoreo de Proceso",
      "Batches & Rendimientos"
    ]
  },

  SUPERVISOR: {
    rol: "SUPERVISOR",
    titulo: "Supervisor de Turno & Operaciones",
    descripcion: "Control en tiempo real de autoclaves, secadoras, registro de incidencias y cumplimiento de recetas.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "priorizacion-programacion",
      "control-vaporizado",
      "batches",
      "analisis-vaporizado",
      "simulador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: false,
      registrar_analisis_calidad: false,
      dictamen_aprobacion_calidad: false,
      crear_programacion_batch: true,
      editar_receta_autoclave: false, // Solo Jefe o Programador
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: false, // Solo Jefe de Planta
      registrar_prueba_coccion: false,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: false,
      usar_ocr_documentos: true,
      acceder_simulador_ia: true,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Cierre formal y aprobación ejecutiva de batches (requiere Jefe de Vaporizado).",
      "Restringido: Modificación de fórmulas, pesos o configuración del sistema.",
      "Restringido: Emisión de dictámenes de calidad de laboratorio de materia prima."
    ],
    vistasPrincipales: [
      "Paso 3: Proceso Vaporizado (Piso)",
      "Paso 2: Programación & Asignación de Turno",
      "Paso 4: Batches en Ejecución"
    ]
  },

  ANALISTA_CALIDAD: {
    rol: "ANALISTA_CALIDAD",
    titulo: "Analista de Calidad & Laboratorio",
    descripcion: "Evaluación física de materia prima (14 caladas), dictámenes de aptitud, análisis de descarga y pruebas de cocción.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "analisis-vaporizado",
      "comparador",
      "batches"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: true,
      dictamen_aprobacion_calidad: true,
      crear_programacion_batch: false, // Producción
      editar_receta_autoclave: false,
      operar_autoclave_piso: false,
      control_secadoras_piso: false,
      cerrar_aprobar_batch: false,
      registrar_prueba_coccion: true,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: false,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Operación mecánica de autoclaves y secadoras en piso de planta.",
      "Restringido: Creación y alteración de órdenes de producción/batches de vaporizado.",
      "Restringido: Configuración técnica del algoritmo y servidor."
    ],
    vistasPrincipales: [
      "Paso 1: Ingreso Lotes & 14 Caladas de Humedad",
      "Paso 5: Análisis de Calidad (Descarga, Kett, Trizado)",
      "Paso 6: Cocción & Benchmarking (Prueba de Olla Oficial)"
    ]
  },

  CONTROL_CALIDAD: {
    rol: "CONTROL_CALIDAD",
    titulo: "Control de Calidad",
    descripcion: "Laboratorio y control de calidad físico-químico.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "analisis-vaporizado",
      "comparador",
      "batches"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: true,
      dictamen_aprobacion_calidad: true,
      crear_programacion_batch: false,
      editar_receta_autoclave: false,
      operar_autoclave_piso: false,
      control_secadoras_piso: false,
      cerrar_aprobar_batch: false,
      registrar_prueba_coccion: true,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: false,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Operación de autoclaves y configuración de recetas de planta."
    ],
    vistasPrincipales: [
      "Ingreso Lotes",
      "Análisis Calidad",
      "Cocción & Benchmarking"
    ]
  },

  CALIDAD: {
    rol: "CALIDAD",
    titulo: "Calidad",
    descripcion: "Perfil de calidad.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "analisis-vaporizado",
      "comparador",
      "batches"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: true,
      registrar_analisis_calidad: true,
      dictamen_aprobacion_calidad: true,
      crear_programacion_batch: false,
      editar_receta_autoclave: false,
      operar_autoclave_piso: false,
      control_secadoras_piso: false,
      cerrar_aprobar_batch: false,
      registrar_prueba_coccion: true,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: true,
      usar_ocr_documentos: true,
      acceder_simulador_ia: false,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Operación de maquinaria de planta."
    ],
    vistasPrincipales: [
      "Ingreso Lotes",
      "Análisis Calidad",
      "Cocción & Benchmarking"
    ]
  },

  OPERARIO: {
    rol: "OPERARIO",
    titulo: "Operario de Vaporizado & Secado",
    descripcion: "Registro operativo directo en piso: presiones de autoclave, RPM, tiempos de inyección y muestreo en tolvas.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "control-vaporizado",
      "batches",
      "dashboard"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: false,
      editar_lotes: false,
      registrar_analisis_calidad: false,
      dictamen_aprobacion_calidad: false,
      crear_programacion_batch: false,
      editar_receta_autoclave: false,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: false,
      registrar_prueba_coccion: false,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: false,
      usar_ocr_documentos: true,
      acceder_simulador_ia: false,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Modificación de recetas maestras y tolerancias térmicas (fijadas por Jefatura).",
      "Restringido: Dictámenes de laboratorio y aprobación/rechazo de materia prima.",
      "Restringido: Configuración del sistema, algoritmos y sincronización externa."
    ],
    vistasPrincipales: [
      "Paso 3: Proceso Vaporizado (Piso de Autoclaves)",
      "Paso 4: Batches en Ejecución (Consulta de Tanda Activa)"
    ]
  },

  OPERADOR: {
    rol: "OPERADOR",
    titulo: "Operario de Planta",
    descripcion: "Operador de planta.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "control-vaporizado",
      "batches",
      "dashboard"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: false,
      editar_lotes: false,
      registrar_analisis_calidad: false,
      dictamen_aprobacion_calidad: false,
      crear_programacion_batch: false,
      editar_receta_autoclave: false,
      operar_autoclave_piso: true,
      control_secadoras_piso: true,
      cerrar_aprobar_batch: false,
      registrar_prueba_coccion: false,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: false,
      usar_ocr_documentos: true,
      acceder_simulador_ia: false,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Restringido: Dictámenes de calidad y ajustes administrativos."
    ],
    vistasPrincipales: [
      "Proceso Vaporizado",
      "Batches"
    ]
  },

  GERENCIA: {
    rol: "GERENCIA",
    titulo: "Gerencia General",
    descripcion: "Supervisión estratégica de indicadores, benchmarking y rendimientos globales.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "batches",
      "analisis-vaporizado",
      "comparador",
      "lotes"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: false,
      registrar_analisis_calidad: false,
      dictamen_aprobacion_calidad: false,
      crear_programacion_batch: false,
      editar_receta_autoclave: false,
      operar_autoclave_piso: false,
      control_secadoras_piso: false,
      cerrar_aprobar_batch: false,
      registrar_prueba_coccion: false,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: true,
      usar_ocr_documentos: false,
      acceder_simulador_ia: true,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Modo ejecutivo y auditoría: lectura y análisis de KPIs sin alteración operativa directa."
    ],
    vistasPrincipales: [
      "Dashboard Global",
      "Batches & Rendimientos",
      "Cocción & Benchmarking"
    ]
  },

  AUDITOR: {
    rol: "AUDITOR",
    titulo: "Auditor de Calidad y Procesos",
    descripcion: "Auditoría de trazabilidad y cumplimiento de normas.",
    esSuperAdmin: false,
    modulosPermitidos: [
      "dashboard",
      "lotes",
      "batches",
      "analisis-vaporizado",
      "comparador"
    ],
    acciones: {
      ver_dashboard: true,
      ver_lotes: true,
      editar_lotes: false,
      registrar_analisis_calidad: false,
      dictamen_aprobacion_calidad: false,
      crear_programacion_batch: false,
      editar_receta_autoclave: false,
      operar_autoclave_piso: false,
      control_secadoras_piso: false,
      cerrar_aprobar_batch: false,
      registrar_prueba_coccion: false,
      modificar_pesos_algoritmo: false,
      modificar_criterios_evaluacion: false,
      sincronizar_excel: true,
      usar_ocr_documentos: false,
      acceder_simulador_ia: false,
      gestionar_usuarios: false
    },
    restriccionesClave: [
      "Modo Auditoría: Acceso de solo lectura para verificación de trazabilidad."
    ],
    vistasPrincipales: [
      "Dashboard",
      "Trazabilidad y Batches",
      "Análisis de Calidad"
    ]
  }
};

export const LOCAL_STORAGE_PERMISOS_KEY = "anvap_matriz_permisos_v1";

export interface AccionInfo {
  key: PermisoAccion;
  label: string;
  desc: string;
  modulo: string;
  categoria: "GENERAL" | "LOTES" | "RECETAS" | "PLANTA" | "CALIDAD" | "SISTEMA";
}

export const LISTA_ACCIONES_CATALOGO: AccionInfo[] = [
  { key: "ver_dashboard", label: "Visualización de Dashboard Global", desc: "Indicadores, alertas y métricas generales de planta", modulo: "General", categoria: "GENERAL" },
  { key: "ver_lotes", label: "Consulta de Lotes Recibidos", desc: "Ver listado y estado de materia prima", modulo: "Paso 1: Lotes", categoria: "LOTES" },
  { key: "editar_lotes", label: "Registro y Edición de Lotes", desc: "Ingresar cliente, variedad, sacos y peso en tolva", modulo: "Paso 1: Lotes", categoria: "LOTES" },
  { key: "registrar_analisis_calidad", label: "Registro de 14 Caladas de Humedad", desc: "Medición M1-M14, desvío estándar y calidad", modulo: "Paso 1 & 5", categoria: "CALIDAD" },
  { key: "dictamen_aprobacion_calidad", label: "Dictamen Calidad (Aprobado/Rechazado)", desc: "Aprobación oficial de materia prima", modulo: "Paso 1: Calidad", categoria: "CALIDAD" },
  { key: "crear_programacion_batch", label: "Programación y Creación de Batches", desc: "Asignación de tandas, tolvas y autoclaves", modulo: "Paso 2: Programación", categoria: "RECETAS" },
  { key: "editar_receta_autoclave", label: "Modificación de Recetas de Vaporizado", desc: "Tiempos, presiones de vapor y perfiles térmicos", modulo: "Paso 2 & 3", categoria: "RECETAS" },
  { key: "operar_autoclave_piso", label: "Operación de Autoclaves en Piso", desc: "Control manual/automático, RPM, purgas", modulo: "Paso 3: Proceso", categoria: "PLANTA" },
  { key: "control_secadoras_piso", label: "Control de Secado en Cascada y Columnar", desc: "Temperaturas y curvas de secado continuo", modulo: "Paso 3: Proceso", categoria: "PLANTA" },
  { key: "cerrar_aprobar_batch", label: "Cierre Formal y Aprobación de Batch", desc: "Validación de rendimientos y firma de entrega", modulo: "Paso 4: Batches", categoria: "PLANTA" },
  { key: "registrar_prueba_coccion", label: "Registro de Prueba de Olla & Organoléptico", desc: "Evaluación de textura, rendimiento y blancura", modulo: "Paso 6: Cocción", categoria: "CALIDAD" },
  { key: "modificar_pesos_algoritmo", label: "Calibración de Fórmulas y Pesos IA", desc: "Pesos matemáticos de éxito y priorización", modulo: "Configuración", categoria: "SISTEMA" },
  { key: "modificar_criterios_evaluacion", label: "Configuración de 24 Criterios de Calidad", desc: "Límites, umbrales y reglas de veto", modulo: "Configuración", categoria: "SISTEMA" },
  { key: "sincronizar_excel", label: "Sincronización de Hojas Excel (12)", desc: "Importación y exportación masiva de datos", modulo: "Herramientas", categoria: "SISTEMA" },
  { key: "usar_ocr_documentos", label: "Escaneo OCR IA de Formatos", desc: "Digitalización de boletas y reportes físicos", modulo: "Herramientas", categoria: "SISTEMA" },
  { key: "acceder_simulador_ia", label: "Simulador de Escenarios IA", desc: "Proyecciones térmicas y de quebrado", modulo: "Simulador", categoria: "SISTEMA" },
  { key: "gestionar_usuarios", label: "Administración de Usuarios y Roles", desc: "Asignación de credenciales y permisos RBAC", modulo: "Seguridad", categoria: "SISTEMA" }
];

/**
 * Obtiene la matriz de permisos activa (desde localStorage o matriz por defecto)
 */
export function obtenerMatrizPermisos(): Record<UserRole, PermisosRol> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PERMISOS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // Combinar con los valores por defecto para asegurar integridad si hay nuevos campos
        const merged: Record<UserRole, PermisosRol> = { ...MATRIZ_PERMISOS };
        for (const [r, cfg] of Object.entries(parsed)) {
          if (merged[r as UserRole]) {
            merged[r as UserRole] = {
              ...merged[r as UserRole],
              ...(cfg as PermisosRol),
              acciones: {
                ...merged[r as UserRole].acciones,
                ...((cfg as PermisosRol).acciones || {})
              }
            };
          }
        }
        return merged;
      }
    }
  } catch (e) {
    console.warn("Error leyendo matriz de permisos de localStorage:", e);
  }
  return MATRIZ_PERMISOS;
}

/**
 * Guarda la matriz de permisos personalizada en localStorage
 */
export function guardarMatrizPermisos(matriz: Record<UserRole, PermisosRol>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PERMISOS_KEY, JSON.stringify(matriz));
  } catch (e) {
    console.warn("Error guardando matriz de permisos:", e);
  }
}

/**
 * Restablece la matriz de permisos a los valores originales de fábrica
 */
export function restablecerMatrizPermisos(): Record<UserRole, PermisosRol> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_PERMISOS_KEY);
  } catch (e) {
    console.warn("Error restableciendo matriz de permisos:", e);
  }
  return MATRIZ_PERMISOS;
}

/**
 * Actualiza un permiso específico para un rol y lo persiste
 */
export function actualizarPermisoRol(
  rol: UserRole,
  accion: PermisoAccion,
  valor: boolean
): Record<UserRole, PermisosRol> {
  const matriz = obtenerMatrizPermisos();
  if (matriz[rol]) {
    matriz[rol] = {
      ...matriz[rol],
      acciones: {
        ...matriz[rol].acciones,
        [accion]: valor
      }
    };
    guardarMatrizPermisos(matriz);
  }
  return matriz;
}

/**
 * Valida si un rol o usuario tiene un permiso determinado
 */
export function tienePermiso(
  userOrRol: UserRole | { rol: UserRole; permisosPersonalizados?: Record<string, boolean> },
  accion: PermisoAccion
): boolean {
  if (!userOrRol) return false;

  // 1. Si se pasa un perfil de usuario con permisos personalizados específicos
  if (typeof userOrRol === "object") {
    if (userOrRol.permisosPersonalizados && userOrRol.permisosPersonalizados[accion] !== undefined) {
      return Boolean(userOrRol.permisosPersonalizados[accion]);
    }
  }

  const rol: UserRole = typeof userOrRol === "object" ? userOrRol.rol : userOrRol;
  const matriz = obtenerMatrizPermisos();
  const cfg = matriz[rol] || MATRIZ_PERMISOS[rol] || MATRIZ_PERMISOS.OPERARIO;

  if (cfg.esSuperAdmin) return true;
  return Boolean(cfg.acciones[accion]);
}

/**
 * Valida si el módulo está disponible/recomendado para el rol
 */
export function puedeAccederModulo(rol: UserRole, modulo: TabType): boolean {
  const matriz = obtenerMatrizPermisos();
  const cfg = matriz[rol] || MATRIZ_PERMISOS[rol] || MATRIZ_PERMISOS.OPERARIO;
  if (cfg.esSuperAdmin) return true;
  if (
    modulo === "analisis-descarga" || 
    modulo === "resultados-coccion" || 
    modulo === "evaluacion-batch" || 
    modulo === "comparador" ||
    modulo === "sabana-batches"
  ) {
    return true;
  }
  return cfg.modulosPermitidos.includes(modulo);
}

/**
 * Obtiene la configuración de permisos del rol
 */
export function obtenerConfiguracionRol(rol: UserRole): PermisosRol {
  const matriz = obtenerMatrizPermisos();
  return matriz[rol] || MATRIZ_PERMISOS[rol] || MATRIZ_PERMISOS.OPERARIO;
}

/**
 * Verifica si un rol tiene permiso para reclasificar un lote DESAPROBADO a EXPERIMENTAL.
 * REGLA ESTRICTA: Exclusivo para Programador, Supervisor o Jefe Autorizado (Jefe de Planta, Jefe de Vaporizado, Gerencia, Admin).
 */
export function puedeAutorizarLoteExperimental(rol?: string | UserRole): boolean {
  if (!rol) return true;
  const r = rol.toString().trim().toUpperCase();
  return (
    r === "PROGRAMADOR" ||
    r === "INGENIERO_PROGRAMADOR" ||
    r === "SUPERVISOR" ||
    r.includes("SUPERVISOR") ||
    r === "JEFE_PLANTA" ||
    r === "JEFE_VAPORIZADO" ||
    r.startsWith("JEFE_") ||
    r === "GERENCIA" ||
    r === "ADMIN" ||
    r === "ADMINISTRADOR" ||
    r === "CALIDAD" ||
    r.includes("CALIDAD") ||
    r === "CONTROL_CALIDAD" ||
    r === "ANALISTA_CALIDAD"
  );
}

/**
 * Retorna el mensaje de restricción claro para la UI
 */
export function obtenerMensajeRestriccion(accion: PermisoAccion): string {
  switch (accion) {
    case "modificar_pesos_algoritmo":
      return "Acción restringida: La calibración de pesos matemáticos e IA es exclusiva de Ingeniería / Programador (Fredy).";
    case "modificar_criterios_evaluacion":
      return "Acción restringida: Requiere perfil de Jefe de Vaporizado o Programador.";
    case "dictamen_aprobacion_calidad":
    case "registrar_analisis_calidad":
      return "Acción restringida: El dictamen y registro de 14 caladas es exclusivo del Analista de Calidad.";
    case "crear_programacion_batch":
    case "editar_receta_autoclave":
      return "Acción restringida: La creación y modificación de recetas es exclusiva de Jefatura de Vaporizado.";
    case "cerrar_aprobar_batch":
      return "Acción restringida: El cierre formal de batches requiere autorización del Jefe de Vaporizado.";
    case "registrar_prueba_coccion":
      return "Acción restringida: El registro de pruebas de cocción y organoléptico corresponde a Control de Calidad.";
    case "gestionar_usuarios":
      return "Acción restringida: La administración de usuarios está reservada a Ingeniería / Programador.";
    default:
      return "Acción no autorizada para su nivel de acceso actual.";
  }
}
