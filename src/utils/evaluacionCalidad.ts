import { 
  AnalisisHumedo, 
  Lote, 
  RegistroHumedad,
  ConfiguracionEvaluacionLotes, 
  CriterioEvaluacionConfig, 
  UmbralesAprobacionLote,
  ReglasVetoCriticoConfig,
  ConfiguracionAlertasDashboard,
  ReglaAlertaCriticaDashboard,
  AlertaCriticaLote,
  ParametroAlertaCalidad,
  SeveridadAlerta,
  OperadorAlerta
} from "../types";

export interface ItemEvaluacion {
  id?: string;
  nombre: string;
  abreviatura: string;
  condicion: string;
  peso: number;
  valorActual: string | number | undefined;
  cumple: boolean;
  puntos: number;
  categoria?: string;
  activo?: boolean;
}

export interface ItemVetoCritico {
  codigo: "GV_EXCESIVO" | "GI_EXCESIVO" | "RI_INSUFICIENTE" | "BASTANTE_OLOR" | "BASTANTE_PLAGA" | "HUMEDADES_BAJAS_EXCESIVAS" | string;
  parametro: string;
  descripcion: string;
  valorDetectado: string | number;
  limitePermitido: string | number;
}

export interface ResultadoEvaluacionLote {
  puntajeTotal: number;
  maxPuntaje: number;
  porcentajeAprobacion: number;
  estadoAprobacion: "APROBADO" | "OBSERVADO" | "OBSERVADOS" | "EN OBSERVACION" | "EXPERIMENTAL" | "CON RIESGO" | "DESAPROBADO" | "RECHAZADO";
  colorEstado: string;
  items: ItemEvaluacion[];
  umbralesAplicados?: UmbralesAprobacionLote;
  nombreConfiguracion?: string;
  tieneVetoCritico: boolean;
  motivosVeto: ItemVetoCritico[];
  ajusteGranoVerde?: {
    estadoForzado: "OBSERVADO" | "EN OBSERVACION" | "EXPERIMENTAL" | "CON RIESGO" | "DESAPROBADO" | "RECHAZADO";
    valorGV: number;
    motivo: string;
  };
  esExperimentalAutorizado?: boolean;
  autorizacionExperimental?: {
    autorizadoPor: string;
    rol: string;
    sustento: string;
    condicionUso?: string;
    fecha: string;
    estadoPrevio?: string;
  };
}

export type CodigoOrganoleptico = "N" | "P" | "R" | "V" | "B";

export interface OpcionOrganoleptica {
  value: CodigoOrganoleptico;
  label: string;
  nombreCompleto: string;
  badgeColor: string;
  colorTexto: string;
}

export const OPCIONES_ORGANOLEPTICAS: OpcionOrganoleptica[] = [
  { value: "N", label: "N - Ninguno / No Presenta (NP)", nombreCompleto: "Ninguno / No Presenta (NP)", badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-700", colorTexto: "text-emerald-400" },
  { value: "P", label: "P - Poco", nombreCompleto: "Poco", badgeColor: "bg-teal-950/80 text-teal-300 border-teal-700", colorTexto: "text-teal-400" },
  { value: "R", label: "R - Regular", nombreCompleto: "Regular", badgeColor: "bg-amber-950/80 text-amber-300 border-amber-700", colorTexto: "text-amber-400" },
  { value: "V", label: "V - Variado", nombreCompleto: "Variado", badgeColor: "bg-orange-950/80 text-orange-300 border-orange-700", colorTexto: "text-orange-400" },
  { value: "B", label: "B - Bastante", nombreCompleto: "Bastante", badgeColor: "bg-rose-950/80 text-rose-300 border-rose-700", colorTexto: "text-rose-400" },
];

export function parseOrganoleptico(val: unknown): { raw: string; code: CodigoOrganoleptico | "OTRO"; label: string; num?: number } {
  if (val === undefined || val === null || val === "") {
    return { raw: "", code: "N", label: "N (Ninguno / No Presenta)", num: 0 };
  }
  if (typeof val === "number") {
    const code: CodigoOrganoleptico = val <= 0 ? "N" : val <= 0.5 ? "P" : val <= 1.5 ? "R" : val <= 3.0 ? "V" : "B";
    const opt = OPCIONES_ORGANOLEPTICAS.find(o => o.value === code);
    return { raw: String(val), code, label: `${code} (${opt?.nombreCompleto || ""}) - ${val}%`, num: val };
  }
  const str = String(val).trim().toUpperCase();
  const cleanStr = str.replace(/[\.\s\-_/]/g, ""); // "N.P." -> "NP", "N/P" -> "NP", "N-P" -> "NP"
  
  // Regla industrial: N es Ninguno pero N también es igual a NP (No Presenta)
  if (
    str === "N" ||
    str === "NP" ||
    cleanStr === "NP" ||
    str.startsWith("NO PRESEN") ||
    str.startsWith("NO-PRESEN") ||
    str.startsWith("NOPRESEN") ||
    str.startsWith("NINGUN") ||
    str === "NIN" ||
    str === "0" ||
    str === "CERO" ||
    str === "AUSENTE" ||
    str === "SIN DEFECTO" ||
    str === "SIN DEFECTOS"
  ) {
    return { raw: str, code: "N", label: "N (Ninguno / No Presenta)", num: 0 };
  }
  if (str === "P" || str.startsWith("POCO") || str === "POC") {
    return { raw: str, code: "P", label: "P (Poco)", num: 0.1 };
  }
  if (str === "R" || str.startsWith("REGULAR") || str === "REG") {
    return { raw: str, code: "R", label: "R (Regular)", num: 1.0 };
  }
  if (str === "V" || str.startsWith("VARIADO") || str === "VAR") {
    return { raw: str, code: "V", label: "V (Variado)", num: 2.5 };
  }
  if (str === "B" || str.startsWith("BASTANTE") || str === "BAS") {
    return { raw: str, code: "B", label: "B (Bastante)", num: 4.0 };
  }
  const num = parseFloat(str);
  if (!isNaN(num)) {
    const code: CodigoOrganoleptico = num <= 0 ? "N" : num <= 0.5 ? "P" : num <= 1.5 ? "R" : num <= 3.0 ? "V" : "B";
    const opt = OPCIONES_ORGANOLEPTICAS.find(o => o.value === code);
    return { raw: str, code, label: `${code} (${opt?.nombreCompleto || ""}) - ${num}%`, num };
  }
  if (str.includes("NORMAL") || str.includes("CARACTERISTICO")) {
    return { raw: str, code: "N", label: "N (Normal / Característico)", num: 0 };
  }
  return { raw: str, code: "OTRO", label: str };
}

// -------------------------------------------------------------
// LISTA MAESTRA OFICIAL DE LOS 24 CRITERIOS DE EVALUACIÓN
// -------------------------------------------------------------
export const CRITERIOS_EVALUACION_DEFAULT: CriterioEvaluacionConfig[] = [
  // 1-2 Humedad
  {
    id: "humedad_promedio",
    nombre: "HUMEDAD PROMEDIO",
    abreviatura: "H.PROM.",
    categoria: "HUMEDAD",
    tipoOperador: "MAYOR_A",
    valorMin: 12.0,
    condicion: "MAYOR A 12",
    peso: 7,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Garantiza que el arroz cáscara tenga humedad suficiente para el proceso térmico."
  },
  {
    id: "desviacion_humedad",
    nombre: "DESVIACION DE HUMEDAD",
    abreviatura: "DES. HUM",
    categoria: "HUMEDAD",
    tipoOperador: "MENOR_A",
    valorMax: 2.0,
    condicion: "MENOR A 2",
    peso: 2,
    activo: true,
    unidad: "±",
    descripcionTecnica: "Controla la homogeneidad entre las caladas del camión/lote."
  },

  // 3-5 Rendimientos
  {
    id: "ri",
    nombre: "R. INTEGRAL",
    abreviatura: "R. I",
    categoria: "FISICO_RENDIMIENTO",
    tipoOperador: "MAYOR_IGUAL",
    valorMin: 76.0,
    condicion: "MAYOR 76",
    peso: 1,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Rendimiento tras el descascarillado del grano."
  },
  {
    id: "rb",
    nombre: "R. BLANCO",
    abreviatura: "R. B",
    categoria: "FISICO_RENDIMIENTO",
    tipoOperador: "MAYOR_IGUAL",
    valorMin: 69.0,
    condicion: "MAYOR 69",
    peso: 1,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Rendimiento de arroz blanco tras pulido de laboratorio."
  },
  {
    id: "remocion",
    nombre: "%REMOCION",
    abreviatura: "% REM.",
    categoria: "FISICO_RENDIMIENTO",
    tipoOperador: "RANGO",
    valorMin: 5.0,
    valorMax: 8.0,
    condicion: "DE 5 A 8",
    peso: 1,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Diferencia RI - RB (capa de salvado/polvillo removida)."
  },

  // 6-8 Quebrado y Entero
  {
    id: "qi",
    nombre: "QUEBRADO INTEGRAL",
    abreviatura: "%Q. INT.",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "RANGO",
    valorMin: 0.0,
    valorMax: 10.0,
    condicion: "DE 0 A 10",
    peso: 1,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Porcentaje de grano quebrado en estado integral."
  },
  {
    id: "qb",
    nombre: "QUEBRADO BLANCO",
    abreviatura: "% Q. BL.",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "RANGO",
    valorMin: 5.0,
    valorMax: 18.0,
    condicion: "DE 5 A 18",
    peso: 8,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Quebrado en grano blanco; factor crítico para rendimiento APIT."
  },
  {
    id: "entero",
    nombre: "% DE GRANO ENTERO",
    abreviatura: "% ENTERO",
    categoria: "FISICO_RENDIMIENTO",
    tipoOperador: "MAYOR_IGUAL",
    valorMin: 60.0,
    condicion: "DE 60 A +",
    peso: 1,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Porcentaje de grano entero en muestra pulida."
  },

  // 9-11 Tizas
  {
    id: "tt",
    nombre: "TIZA TOTAL",
    abreviatura: "% T. TOT.",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 3.0,
    condicion: "MAX 3",
    peso: 5,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Granos con opacidad almidonosa total."
  },
  {
    id: "tp",
    nombre: "TIZA PARCIAL",
    abreviatura: "%T. PARC.",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 8.0,
    condicion: "MAX 8",
    peso: 3,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Granos con mancha blanca yesosa parcial."
  },
  {
    id: "tpunt",
    nombre: "TIZA PUNTUAL",
    abreviatura: "%T. PUNT.",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 3.0,
    condicion: "MAX 3",
    peso: 3,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Puntos yesosos localizados en el endospermo."
  },

  // 12-16 Defectos Físicos
  {
    id: "mancha",
    nombre: "MANCHA",
    abreviatura: "% M",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 1.5,
    condicion: "MAX 1.5",
    peso: 8,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Granos manchados o picados; alto impacto en calidad comercial."
  },
  {
    id: "trizado",
    nombre: "TRIZADO",
    abreviatura: "% TZ",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 3.0,
    condicion: "MAX 3",
    peso: 5,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Fisuras internas que predisponen al quebrado en autoclave."
  },
  {
    id: "gr",
    nombre: "GRANO ROJO",
    abreviatura: "% G. R",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 1.5,
    condicion: "MAX 1.5",
    peso: 3,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Contaminación con pericarpio rojo."
  },
  {
    id: "gi",
    nombre: "GRANO INMADURO",
    abreviatura: "% G. INM.",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 3.0,
    condicion: "MAX 3",
    peso: 3,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Granos cosechados antes de su madurez fisiológica."
  },
  {
    id: "gv",
    nombre: "GRANO VERDE",
    abreviatura: "% G. V",
    categoria: "DEFECTOS_CALIDAD",
    tipoOperador: "MENOR_IGUAL",
    valorMax: 4.0,
    condicion: "MAXIMO 4",
    peso: 6,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Granos con clorofila residual."
  },

  // 17-18 Blancuras
  {
    id: "bl_int",
    nombre: "BLANCURA INTEGRAL",
    abreviatura: "BL. INT.",
    categoria: "FISICO_RENDIMIENTO",
    tipoOperador: "MAYOR_IGUAL",
    valorMin: 18.5,
    condicion: "DE 18.5 A MAS",
    peso: 8,
    activo: true,
    unidad: "pt",
    descripcionTecnica: "Grado de blancura Kett en grano integral."
  },
  {
    id: "bl_blanc",
    nombre: "BLANCURA DE PULIDO",
    abreviatura: "B. PULIDO",
    categoria: "FISICO_RENDIMIENTO",
    tipoOperador: "MAYOR_IGUAL",
    valorMin: 37.0,
    condicion: "DE 37 A MAS",
    peso: 8,
    activo: true,
    unidad: "pt",
    descripcionTecnica: "Grado de blancura Kett en grano pulido."
  },

  // 19-24 Organolépticos
  {
    id: "palote",
    nombre: "PALOTE",
    abreviatura: "PALT",
    categoria: "ORGANOLEPTICO",
    tipoOperador: "ORGANOLEPTICO_MAX",
    codigoOrganolepticoMax: "R",
    condicion: "HASTA REGULAR (N, P, R)",
    peso: 1,
    activo: true,
    descripcionTecnica: "Presencia de restos de pedúnculos o tallos."
  },
  {
    id: "vano",
    nombre: "VANO",
    abreviatura: "VN",
    categoria: "ORGANOLEPTICO",
    tipoOperador: "ORGANOLEPTICO_MAX",
    codigoOrganolepticoMax: "R",
    condicion: "HASTA REGULAR (N, P, R)",
    peso: 5,
    activo: true,
    descripcionTecnica: "Granos vacíos sin endospermo desarrollado."
  },
  {
    id: "impureza",
    nombre: "IMPUREZA",
    abreviatura: "IMP.",
    categoria: "ORGANOLEPTICO",
    tipoOperador: "ORGANOLEPTICO_MAX",
    codigoOrganolepticoMax: "R",
    valorMax: 4.5,
    condicion: "HASTA REGULAR (N, P, R) / MAX 4.5",
    peso: 1,
    activo: true,
    unidad: "%",
    descripcionTecnica: "Materia extraña inerte (tierra, paja, piedras)."
  },
  {
    id: "olor",
    nombre: "OLOR",
    abreviatura: "OL",
    categoria: "ORGANOLEPTICO",
    tipoOperador: "ORGANOLEPTICO_MAX",
    codigoOrganolepticoMax: "P",
    condicion: "NINGUNO / NO PRESENTA (N/NP) O POCO (P)",
    peso: 10,
    activo: true,
    descripcionTecnica: "Olor característico sin fermentación, humedad ni químicos."
  },
  {
    id: "falso_carbon",
    nombre: "FALSO CARBON",
    abreviatura: "F. CARB.",
    categoria: "ORGANOLEPTICO",
    tipoOperador: "ORGANOLEPTICO_MAX",
    codigoOrganolepticoMax: "P",
    valorMax: 0.5,
    condicion: "NINGUNO / NO PRESENTA (N/NP) O POCO (P)",
    peso: 5,
    activo: true,
    descripcionTecnica: "Presencia del hongo Ustilaginoidea virens (falso carbón)."
  },
  {
    id: "hongo",
    nombre: "HONGO",
    abreviatura: "HON.",
    categoria: "ORGANOLEPTICO",
    tipoOperador: "ORGANOLEPTICO_MAX",
    codigoOrganolepticoMax: "P",
    valorMax: 0.5,
    condicion: "NINGUNO / NO PRESENTA (N/NP) O POCO (P)",
    peso: 4,
    activo: true,
    descripcionTecnica: "Moho, hongos de almacenamiento o proliferación fúngica."
  }
];

export const UMBRALES_APROBACION_DEFAULT: UmbralesAprobacionLote = {
  umbralAprobado: 96.0,
  umbralObservacion: 91.0,
  umbralExperimental: 86.0,
  umbralRiesgo: 86.0
};

export const REGLAS_VETO_DEFAULT: ReglasVetoCriticoConfig = {
  maxGranoVerde: 10.0,          // Desaprobación automática si GV > 10% (Rechazado)
  maxGranoVerdeRiesgo: 8.0,     // Pasa a CON RIESGO si GV > 8%
  maxGranoVerdeObservado: 6.0,  // Pasa a EN OBSERVACION si GV > 6%
  maxGranoInmaduro: 5.0,        // Desaprobación automática si GI > 5%
  minRendimientoIntegral: 75.0, // Desaprobación automática si RI < 75%
  bloquearBastanteOlor: true,   // Desaprobación automática si Olor es Bastante (B)
  bloquearBastantePlaga: true,  // Desaprobación automática si Plaga / Hongo es Bastante (B)
  maxPctMuestrasHumedadBaja: 20.0, // Desaprobación automática si muestras de humedad <= 10% superan el 20%
  umbralHumedadBajaCritica: 10.0,  // Umbral de humedad baja crítica (<= 10.0%)
  bloquearHumedadesBajas10: true,  // Bloqueo automático por muestras con humedad <= 10%
  activarVetosCriticos: true
};

export const REGLAS_ALERTAS_DASHBOARD_DEFAULT: ReglaAlertaCriticaDashboard[] = [
  {
    id: "alerta-score-total",
    parametro: "SCORE_TOTAL",
    nombre: "Puntaje Global de Evaluación",
    descripcion: "Alerta cuando el puntaje de aprobación global del lote cae por debajo del límite crítico de calidad.",
    unidad: "%",
    operador: "MENOR_A",
    umbralCritico: 85.0,
    umbralAdvertencia: 90.0,
    severidadPorDefecto: "CRITICO",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#ef4444",
    icono: "Award"
  },
  {
    id: "alerta-humedad",
    parametro: "HUMEDAD",
    nombre: "Humedad Fuera de Rango Operativo",
    descripcion: "Alerta cuando la humedad del lote es inferior al secado seguro o excesivamente húmeda para tolva.",
    unidad: "%",
    operador: "FUERA_RANGO",
    umbralCritico: 11.5,
    umbralMax: 16.0,
    umbralAdvertencia: 12.5,
    umbralMaxAdvertencia: 15.0,
    severidadPorDefecto: "CRITICO",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#38bdf8",
    icono: "Droplets"
  },
  {
    id: "alerta-desv-humedad",
    parametro: "DESV_HUMEDAD",
    nombre: "Heterogeneidad / Desviación de Humedad",
    descripcion: "Alerta cuando la desviación estándar entre caladas revela una dispersión excesiva en el lote.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 1.20,
    umbralAdvertencia: 0.80,
    severidadPorDefecto: "ADVERTENCIA",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#f59e0b",
    icono: "Activity"
  },
  {
    id: "alerta-grano-verde",
    parametro: "GRANO_VERDE",
    nombre: "Grano Verde (GV)",
    descripcion: "Alerta por alto contenido de grano verde que provoca manchas y desuniformidad de gelatinización.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 6.0,
    umbralAdvertencia: 4.0,
    severidadPorDefecto: "CRITICO",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#22c55e",
    icono: "Leaf"
  },
  {
    id: "alerta-grano-inmaduro",
    parametro: "GRANO_INMADURO",
    nombre: "Grano Inmaduro (GI)",
    descripcion: "Alerta por exceso de grano inmaduro propenso a fracturas y quebrado en autoclave.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 3.5,
    umbralAdvertencia: 2.0,
    severidadPorDefecto: "CRITICO",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#eab308",
    icono: "Sparkles"
  },
  {
    id: "alerta-rendimiento-integral",
    parametro: "RENDIMIENTO_INTEGRAL",
    nombre: "Rendimiento Integral (RI)",
    descripcion: "Alerta cuando el rendimiento integral molinero es inferior al mínimo industrial rentable.",
    unidad: "%",
    operador: "MENOR_A",
    umbralCritico: 72.0,
    umbralAdvertencia: 75.0,
    severidadPorDefecto: "CRITICO",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#f97316",
    icono: "BarChart3"
  },
  {
    id: "alerta-quebrado-total",
    parametro: "QUEBRADO_TOTAL",
    nombre: "Grano Quebrado Total (QB)",
    descripcion: "Alerta cuando el grano quebrado inicial blanco o integral excede los estándares comerciales.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 18.0,
    umbralAdvertencia: 14.0,
    severidadPorDefecto: "ADVERTENCIA",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#ec4899",
    icono: "Scissors"
  },
  {
    id: "alerta-humedad-baja",
    parametro: "MUESTRAS_HUMEDAD_BAJA",
    nombre: "Caladas con Humedad Crítica ≤ 10%",
    descripcion: "Alerta si el porcentaje de caladas tomadas con humedad extrema desecada (≤ 10%) supera el umbral.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 15.0,
    umbralAdvertencia: 10.0,
    severidadPorDefecto: "CRITICO",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#a855f7",
    icono: "AlertOctagon"
  },
  {
    id: "alerta-mancha-calor",
    parametro: "DANADO_CALOR",
    nombre: "Dañado por Calor / Mancha (M)",
    descripcion: "Alerta por grano fermentado, manchado o dañado por temperatura en campo o transporte.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 2.0,
    umbralAdvertencia: 1.0,
    severidadPorDefecto: "ADVERTENCIA",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#ef4444",
    icono: "Flame"
  },
  {
    id: "alerta-plagas",
    parametro: "PLAGAS",
    nombre: "Afectación por Plagas / Picados",
    descripcion: "Alerta por picaduras de insectos o presencia de plagas en la muestra analizada.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 1.0,
    umbralAdvertencia: 0.5,
    severidadPorDefecto: "CRITICO",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#b91c1c",
    icono: "Bug"
  },
  {
    id: "alerta-yesado",
    parametro: "YESADO",
    nombre: "Grano Yesado / Blanco Tiza (GY)",
    descripcion: "Alerta por porcentaje elevado de grano yesoso que disminuye la translucidez post-vaporizado.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 5.0,
    umbralAdvertencia: 3.0,
    severidadPorDefecto: "ADVERTENCIA",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#94a3b8",
    icono: "Layers"
  },
  {
    id: "alerta-granos-rojos",
    parametro: "GRANOS_ROJOS",
    nombre: "Granos Rojos (GR)",
    descripcion: "Alerta por presencia de grano rojo que descalifica el color y blancura comercial.",
    unidad: "%",
    operador: "MAYOR_A",
    umbralCritico: 3.0,
    umbralAdvertencia: 1.5,
    severidadPorDefecto: "ADVERTENCIA",
    activo: true,
    mostrarEnDashboard: true,
    colorHex: "#dc2626",
    icono: "Eye"
  }
];

export const CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT: ConfiguracionAlertasDashboard = {
  activarAlertasDashboard: true,
  soloLotesActivos: true,
  sonidoAlerta: false,
  maxAlertasVisibles: 12,
  mostrarSoloCriticos: false,
  reglas: REGLAS_ALERTAS_DASHBOARD_DEFAULT
};

export const CONFIG_EVALUACION_LOTES_DEFAULT: ConfiguracionEvaluacionLotes = {
  id: "CONFIG-EVAL-DEFAULT",
  nombre: "Estándar Oficial Molino / APIT",
  descripcion: "Configuración maestra estándar con 24 parámetros de calidad física, rendimientos y organolépticos con pesos que suman 100%, reglas de veto crítico y alertas visuales para Dashboard.",
  version: "1.2.0",
  criterios: CRITERIOS_EVALUACION_DEFAULT,
  umbrales: UMBRALES_APROBACION_DEFAULT,
  reglasVeto: REGLAS_VETO_DEFAULT,
  alertasDashboard: CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT,
  normalizarAl100: true,
  fechaActualizacion: new Date().toISOString().split("T")[0],
  actualizadoPor: "Ingeniería de Calidad"
};

export const PRESETS_EVALUACION_LOTES: ConfiguracionEvaluacionLotes[] = [
  CONFIG_EVALUACION_LOTES_DEFAULT,
  {
    id: "CONFIG-EVAL-EXPORTACION",
    nombre: "Criterio Exigente Exportación",
    descripcion: "Parámetros rigurosos para arroz grado exportación. Mayor exigencia en mancha (<=1.0%), trizado (<=2.0%), aprobación mínima del 96% y vetos estrictos.",
    version: "1.1.0",
    criterios: CRITERIOS_EVALUACION_DEFAULT.map(c => {
      if (c.id === "mancha") return { ...c, valorMax: 1.0, condicion: "MAX 1.0", peso: 10 };
      if (c.id === "trizado") return { ...c, valorMax: 2.0, condicion: "MAX 2.0", peso: 6 };
      if (c.id === "qb") return { ...c, valorMin: 4.0, valorMax: 15.0, condicion: "DE 4 A 15", peso: 10 };
      if (c.id === "olor") return { ...c, peso: 12 };
      if (c.id === "entero") return { ...c, valorMin: 65.0, condicion: "DE 65 A +", peso: 2 };
      return c;
    }),
    umbrales: {
      umbralAprobado: 96.0,
      umbralObservacion: 88.0,
      umbralRiesgo: 82.0
    },
    reglasVeto: {
      maxGranoVerde: 8.0,
      maxGranoInmaduro: 4.0,
      minRendimientoIntegral: 76.0,
      bloquearBastanteOlor: true,
      bloquearBastantePlaga: true,
      maxPctMuestrasHumedadBaja: 15.0,
      umbralHumedadBajaCritica: 10.0,
      bloquearHumedadesBajas10: true,
      activarVetosCriticos: true
    },
    normalizarAl100: true,
    fechaActualizacion: new Date().toISOString().split("T")[0],
    actualizadoPor: "Comité Técnico de Exportación"
  },
  {
    id: "CONFIG-EVAL-FLEXIBLE",
    nombre: "Criterio Flexible / Campaña Alta",
    descripcion: "Tolerancia ampliada para temporadas de alta humedad y cosecha masiva. Umbral de aprobación calibrado al 88%.",
    version: "1.0.5",
    criterios: CRITERIOS_EVALUACION_DEFAULT.map(c => {
      if (c.id === "mancha") return { ...c, valorMax: 2.0, condicion: "MAX 2.0" };
      if (c.id === "trizado") return { ...c, valorMax: 4.5, condicion: "MAX 4.5" };
      if (c.id === "qb") return { ...c, valorMin: 5.0, valorMax: 22.0, condicion: "DE 5 A 22" };
      if (c.id === "desviacion_humedad") return { ...c, valorMax: 2.5, condicion: "MENOR A 2.5" };
      return c;
    }),
    umbrales: {
      umbralAprobado: 88.0,
      umbralObservacion: 78.0,
      umbralRiesgo: 72.0
    },
    reglasVeto: {
      maxGranoVerde: 12.0,
      maxGranoInmaduro: 6.0,
      minRendimientoIntegral: 74.0,
      bloquearBastanteOlor: true,
      bloquearBastantePlaga: true,
      maxPctMuestrasHumedadBaja: 25.0,
      umbralHumedadBajaCritica: 10.0,
      bloquearHumedadesBajas10: true,
      activarVetosCriticos: true
    },
    normalizarAl100: true,
    fechaActualizacion: new Date().toISOString().split("T")[0],
    actualizadoPor: "Jefatura de Operaciones"
  }
];

// -------------------------------------------------------------
// MOTOR DE EVALUACIÓN DINÁMICO DE LOTES
// -------------------------------------------------------------
export function calcularEvaluacionLote(
  analisis?: Partial<AnalisisHumedo>,
  lote?: Partial<Lote>,
  promedioHumedadCaladas?: number,
  desvHumedadCaladas?: number,
  configuracion?: ConfiguracionEvaluacionLotes,
  muestrasHumedad?: number[] | RegistroHumedad | { [key: string]: string | number }
): ResultadoEvaluacionLote {
  const config = configuracion || CONFIG_EVALUACION_LOTES_DEFAULT;
  const criterios = config.criterios && config.criterios.length > 0 ? config.criterios : CRITERIOS_EVALUACION_DEFAULT;
  const umbrales = config.umbrales || UMBRALES_APROBACION_DEFAULT;

  // Extraer valores del lote y análisis
  const humProm = promedioHumedadCaladas !== undefined && promedioHumedadCaladas > 0
    ? promedioHumedadCaladas
    : (lote?.HUMEDAD !== undefined ? Number(lote.HUMEDAD) : (analisis?.HUMEDADES !== undefined ? Number(analisis.HUMEDADES) : undefined));

  const desvHum = desvHumedadCaladas !== undefined
    ? desvHumedadCaladas
    : (lote?.DESV !== undefined ? Number(lote.DESV) : undefined);

  const ri = analisis?.RI !== undefined ? Number(analisis.RI) : undefined;
  const rb = analisis?.RB !== undefined ? Number(analisis.RB) : undefined;
  // % Remoción = RI - RB
  const rem = analisis?.RM !== undefined 
    ? Number(analisis.RM) 
    : (ri !== undefined && rb !== undefined ? Number((ri - rb).toFixed(2)) : undefined);
  const qi = analisis?.QI !== undefined ? Number(analisis.QI) : undefined;
  const qb = analisis?.QB !== undefined ? Number(analisis.QB) : undefined;
  const quebradoEff = qb !== undefined ? qb : (qi !== undefined ? qi : undefined);
  // % Grano Entero = RB - % Quebrado
  const entero = analisis?.ENTERO !== undefined 
    ? Number(analisis.ENTERO) 
    : (rb !== undefined && quebradoEff !== undefined ? Number((rb - quebradoEff).toFixed(2)) : undefined);
  const tt = analisis?.TT !== undefined ? Number(analisis.TT) : undefined;
  const tp = analisis?.TP !== undefined ? Number(analisis.TP) : undefined;
  const tpunt = analisis?.["T. PUNT."] !== undefined ? Number(analisis["T. PUNT."]) : undefined;
  const mancha = analisis?.M !== undefined ? Number(analisis.M) : (analisis?.MANCHADO !== undefined ? Number(analisis.MANCHADO) : undefined);
  const tz = analisis?.TZ !== undefined ? Number(analisis.TZ) : undefined;
  const gr = analisis?.GR !== undefined ? Number(analisis.GR) : undefined;
  const gi = analisis?.GI !== undefined ? Number(analisis.GI) : undefined;
  const gv = analisis?.GV !== undefined ? Number(analisis.GV) : undefined;
  const blInt = analisis?.["B.INTEGRAL"] !== undefined ? Number(analisis["B.INTEGRAL"]) : undefined;
  const blBlanc = analisis?.["B. PULIDO"] !== undefined ? Number(analisis["B. PULIDO"]) : undefined;

  const pPalote = parseOrganoleptico(analisis?.PALOTE);
  const pVano = parseOrganoleptico(analisis?.VANO);
  const pImp = parseOrganoleptico(analisis?.IMPUREZS);
  const pOlor = parseOrganoleptico(analisis?.OLOR);
  const pFCarb = parseOrganoleptico(analisis?.["F. CARBON"]);
  const pHongo = parseOrganoleptico(analisis?.HONGO);

  const items: ItemEvaluacion[] = [];

  // Evaluar cada criterio configurado
  criterios.forEach((c) => {
    if (!c.activo) return;

    let valorActual: string | number | undefined = "-";
    let cumple = false;

    switch (c.id) {
      case "humedad_promedio": {
        valorActual = humProm !== undefined ? `${humProm.toFixed(1)}%` : "-";
        if (humProm !== undefined) {
          if (c.tipoOperador === "MAYOR_A") cumple = humProm > (c.valorMin ?? 12);
          else if (c.tipoOperador === "MAYOR_IGUAL") cumple = humProm >= (c.valorMin ?? 12);
          else if (c.tipoOperador === "RANGO") cumple = humProm >= (c.valorMin ?? 12) && humProm <= (c.valorMax ?? 15);
          else cumple = humProm > (c.valorMin ?? 12);
        }
        break;
      }
      case "desviacion_humedad": {
        valorActual = desvHum !== undefined ? `±${desvHum.toFixed(2)}` : "-";
        if (desvHum !== undefined) {
          if (c.tipoOperador === "MENOR_A") cumple = desvHum < (c.valorMax ?? 2);
          else if (c.tipoOperador === "MENOR_IGUAL") cumple = desvHum <= (c.valorMax ?? 2);
          else cumple = desvHum < (c.valorMax ?? 2);
        }
        break;
      }
      case "ri": {
        valorActual = ri !== undefined ? `${ri.toFixed(1)}%` : "-";
        if (ri !== undefined) {
          cumple = ri >= (c.valorMin ?? 76);
        }
        break;
      }
      case "rb": {
        valorActual = rb !== undefined ? `${rb.toFixed(1)}%` : "-";
        if (rb !== undefined) {
          cumple = rb >= (c.valorMin ?? 69);
        }
        break;
      }
      case "remocion": {
        valorActual = rem !== undefined ? `${rem.toFixed(1)}%` : "-";
        if (rem !== undefined) {
          const min = c.valorMin ?? 5;
          const max = c.valorMax ?? 8;
          cumple = rem >= min && rem <= max;
        }
        break;
      }
      case "qi": {
        valorActual = qi !== undefined ? `${qi.toFixed(1)}%` : "-";
        if (qi !== undefined) {
          const min = c.valorMin ?? 0;
          const max = c.valorMax ?? 10;
          cumple = qi >= min && qi <= max;
        }
        break;
      }
      case "qb": {
        valorActual = qb !== undefined ? `${qb.toFixed(1)}%` : "-";
        if (qb !== undefined) {
          const min = c.valorMin ?? 5;
          const max = c.valorMax ?? 18;
          cumple = qb >= min && qb <= max;
        }
        break;
      }
      case "entero": {
        valorActual = entero !== undefined ? `${entero.toFixed(1)}%` : "-";
        if (entero !== undefined) {
          cumple = entero >= (c.valorMin ?? 60);
        }
        break;
      }
      case "tt": {
        valorActual = tt !== undefined ? `${tt.toFixed(1)}%` : "-";
        if (tt !== undefined) {
          cumple = tt <= (c.valorMax ?? 3);
        }
        break;
      }
      case "tp": {
        valorActual = tp !== undefined ? `${tp.toFixed(1)}%` : "-";
        if (tp !== undefined) {
          cumple = tp <= (c.valorMax ?? 8);
        }
        break;
      }
      case "tpunt": {
        valorActual = tpunt !== undefined ? `${tpunt.toFixed(1)}%` : "-";
        if (tpunt !== undefined) {
          cumple = tpunt <= (c.valorMax ?? 3);
        }
        break;
      }
      case "mancha": {
        valorActual = mancha !== undefined ? `${mancha.toFixed(1)}%` : "-";
        if (mancha !== undefined) {
          cumple = mancha <= (c.valorMax ?? 1.5);
        }
        break;
      }
      case "trizado": {
        valorActual = tz !== undefined ? `${tz.toFixed(1)}%` : "-";
        if (tz !== undefined) {
          cumple = tz <= (c.valorMax ?? 3);
        }
        break;
      }
      case "gr": {
        valorActual = gr !== undefined ? `${gr.toFixed(1)}%` : "-";
        if (gr !== undefined) {
          cumple = gr <= (c.valorMax ?? 1.5);
        }
        break;
      }
      case "gi": {
        valorActual = gi !== undefined ? `${gi.toFixed(1)}%` : "-";
        if (gi !== undefined) {
          cumple = gi <= (c.valorMax ?? 3);
        }
        break;
      }
      case "gv": {
        valorActual = gv !== undefined ? `${gv.toFixed(1)}%` : "-";
        if (gv !== undefined) {
          cumple = gv <= (c.valorMax ?? 4);
        }
        break;
      }
      case "bl_int": {
        valorActual = blInt !== undefined ? `${blInt.toFixed(1)}` : "-";
        if (blInt !== undefined) {
          cumple = blInt >= (c.valorMin ?? 18.5);
        }
        break;
      }
      case "bl_blanc":
      case "bl_pulido": {
        valorActual = blBlanc !== undefined ? `${blBlanc.toFixed(1)}` : "-";
        if (blBlanc !== undefined) {
          cumple = blBlanc >= (c.valorMin ?? 37);
        }
        break;
      }
      case "palote": {
        valorActual = pPalote.raw ? pPalote.label : "N (Ninguno / No Presenta)";
        if (c.codigoOrganolepticoMax === "N") {
          cumple = pPalote.code === "N" || (pPalote.num !== undefined && pPalote.num <= 0);
        } else if (c.codigoOrganolepticoMax === "P") {
          cumple = pPalote.code === "N" || pPalote.code === "P" || (pPalote.num !== undefined && pPalote.num <= 0.5);
        } else {
          cumple = pPalote.code === "N" || pPalote.code === "P" || pPalote.code === "R" || (pPalote.num !== undefined && pPalote.num <= 1.5);
        }
        break;
      }
      case "vano": {
        valorActual = pVano.raw ? pVano.label : "N (Ninguno / No Presenta)";
        if (c.codigoOrganolepticoMax === "N") {
          cumple = pVano.code === "N" || (pVano.num !== undefined && pVano.num <= 0);
        } else if (c.codigoOrganolepticoMax === "P") {
          cumple = pVano.code === "N" || pVano.code === "P" || (pVano.num !== undefined && pVano.num <= 0.5);
        } else {
          cumple = pVano.code === "N" || pVano.code === "P" || pVano.code === "R" || (pVano.num !== undefined && pVano.num <= 1.5);
        }
        break;
      }
      case "impureza": {
        valorActual = pImp.raw ? pImp.label : "N (Ninguno / No Presenta)";
        if (pImp.num !== undefined && c.valorMax !== undefined) {
          cumple = pImp.num <= c.valorMax;
        } else if (c.codigoOrganolepticoMax === "N") {
          cumple = pImp.code === "N" || (pImp.num !== undefined && pImp.num <= 0);
        } else if (c.codigoOrganolepticoMax === "P") {
          cumple = pImp.code === "N" || pImp.code === "P";
        } else {
          cumple = pImp.code === "N" || pImp.code === "P" || pImp.code === "R" || (pImp.num !== undefined && pImp.num <= (c.valorMax ?? 4.5));
        }
        break;
      }
      case "olor": {
        valorActual = pOlor.raw ? pOlor.label : "N (Ninguno / No Presenta)";
        if (c.codigoOrganolepticoMax === "N") {
          cumple = pOlor.code === "N";
        } else {
          cumple = pOlor.code === "N" || pOlor.code === "P";
        }
        break;
      }
      case "falso_carbon": {
        valorActual = pFCarb.raw ? pFCarb.label : "N (Ninguno / No Presenta)";
        if (c.codigoOrganolepticoMax === "N") {
          cumple = pFCarb.code === "N" || (pFCarb.num !== undefined && pFCarb.num <= 0);
        } else {
          cumple = pFCarb.code === "N" || pFCarb.code === "P" || (pFCarb.num !== undefined && pFCarb.num <= (c.valorMax ?? 0.5));
        }
        break;
      }
      case "hongo": {
        valorActual = pHongo.raw ? pHongo.label : "N (Ninguno / No Presenta)";
        if (c.codigoOrganolepticoMax === "N") {
          cumple = pHongo.code === "N" || (pHongo.num !== undefined && pHongo.num <= 0);
        } else {
          cumple = pHongo.code === "N" || pHongo.code === "P" || (pHongo.num !== undefined && pHongo.num <= (c.valorMax ?? 0.5));
        }
        break;
      }
      default: {
        cumple = true;
        valorActual = "N/A";
      }
    }

    const peso = Number(c.peso) || 0;
    const puntos = cumple ? peso : 0;

    items.push({
      id: c.id,
      nombre: c.nombre,
      abreviatura: c.abreviatura,
      condicion: c.condicion,
      peso,
      valorActual,
      cumple,
      puntos,
      categoria: c.categoria,
      activo: c.activo
    });
  });

  const puntajeTotal = items.reduce((acc, curr) => acc + curr.puntos, 0);
  const totalPesoActivo = items.reduce((acc, curr) => acc + curr.peso, 0);
  const maxPuntaje = totalPesoActivo > 0 ? totalPesoActivo : 100;
  
  // Porcentaje de Aprobación
  const rawPct = totalPesoActivo > 0 ? (puntajeTotal / totalPesoActivo) * 100 : puntajeTotal;
  const porcentajeAprobacion = Number(rawPct.toFixed(1));

  // Clasificación dinámica según umbrales configurados
  // APROBADO > 96 | OBSERVADOS 91 A MAS | EXPERIMENTAL 86 A MAS | MENOR A 86 DESAPROBADO
  let estadoAprobacion: ResultadoEvaluacionLote["estadoAprobacion"] = "DESAPROBADO";
  let colorEstado = "text-rose-400 bg-rose-950/40 border-rose-800";

  const uAprobado = umbrales.umbralAprobado ?? 96.0;
  const uObservados = umbrales.umbralObservacion ?? 91.0;
  const uExperimental = umbrales.umbralExperimental ?? umbrales.umbralRiesgo ?? 86.0;

  if (porcentajeAprobacion > uAprobado) {
    // Mayor a 96% -> APROBADO
    estadoAprobacion = "APROBADO";
    colorEstado = "text-emerald-400 bg-emerald-950/50 border-emerald-500";
  } else if (porcentajeAprobacion >= uObservados) {
    // 91% a más (hasta 96%) -> OBSERVADOS
    estadoAprobacion = "OBSERVADO";
    colorEstado = "text-amber-400 bg-amber-950/50 border-amber-500";
  } else if (porcentajeAprobacion >= uExperimental) {
    // 86% a más (hasta < 91%) -> EXPERIMENTAL
    estadoAprobacion = "EXPERIMENTAL";
    colorEstado = "text-orange-400 bg-orange-950/50 border-orange-500";
  } else {
    // Menor a 86% -> DESAPROBADO
    estadoAprobacion = "DESAPROBADO";
    colorEstado = "text-rose-400 bg-rose-950/50 border-rose-500";
  }

  // -------------------------------------------------------------
  // REGLAS CRÍTICAS DE DESAPROBACIÓN / VETO AUTOMÁTICO Y ESCALAMIENTO
  // -------------------------------------------------------------
  const motivosVeto: ItemVetoCritico[] = [];
  const reglasVeto = config.reglasVeto || REGLAS_VETO_DEFAULT;
  let ajusteGranoVerde: ResultadoEvaluacionLote["ajusteGranoVerde"] = undefined;

  if (reglasVeto.activarVetosCriticos !== false) {
    // 1. Grano Verde (GV) - Escalamiento y Veto Crítico:
    // GV > 10% -> Desaprobación automática / DESAPROBADO
    // GV > 8% -> Pasa a EXPERIMENTAL
    // GV > 6% -> Pasa a OBSERVADO
    const maxGV = reglasVeto.maxGranoVerde ?? 10.0;
    const maxGVRiesgo = reglasVeto.maxGranoVerdeRiesgo ?? 8.0;
    const maxGVObservado = reglasVeto.maxGranoVerdeObservado ?? 6.0;

    if (gv !== undefined) {
      if (gv > maxGV) {
        // GV > 10% -> Veto crítico (Desaprobación inmediata)
        motivosVeto.push({
          codigo: "GV_EXCESIVO",
          parametro: "Grano Verde (GV)",
          descripcion: `Grano Verde (${gv.toFixed(1)}%) supera el límite crítico de desaprobación (${maxGV}%)`,
          valorDetectado: `${gv.toFixed(1)}%`,
          limitePermitido: `Máx. ${maxGV}%`
        });
        ajusteGranoVerde = {
          estadoForzado: "DESAPROBADO",
          valorGV: gv,
          motivo: `Grano Verde (${gv.toFixed(1)}%) > ${maxGV}% (Veto Crítico de Calidad)`
        };
      } else if (gv > maxGVRiesgo) {
        // GV > 8% -> Máximo estado permitido: EXPERIMENTAL
        if (estadoAprobacion === "APROBADO" || estadoAprobacion === "OBSERVADO") {
          estadoAprobacion = "EXPERIMENTAL";
          colorEstado = "text-orange-400 bg-orange-950/50 border-orange-500";
          ajusteGranoVerde = {
            estadoForzado: "EXPERIMENTAL",
            valorGV: gv,
            motivo: `Grano Verde (${gv.toFixed(1)}%) > ${maxGVRiesgo}% (Lote degradado a EXPERIMENTAL)`
          };
        }
      } else if (gv > maxGVObservado) {
        // GV > 6% -> Máximo estado permitido: OBSERVADO
        if (estadoAprobacion === "APROBADO") {
          estadoAprobacion = "OBSERVADO";
          colorEstado = "text-amber-400 bg-amber-950/50 border-amber-500";
          ajusteGranoVerde = {
            estadoForzado: "OBSERVADO",
            valorGV: gv,
            motivo: `Grano Verde (${gv.toFixed(1)}%) > ${maxGVObservado}% (Lote degradado a OBSERVADO)`
          };
        }
      }
    }

    // 2. Grano Inmaduro > 5% (o valor configurado)
    const maxGI = reglasVeto.maxGranoInmaduro ?? 5.0;
    if (gi !== undefined && gi > maxGI) {
      motivosVeto.push({
        codigo: "GI_EXCESIVO",
        parametro: "Grano Inmaduro (GI)",
        descripcion: `Grano Inmaduro (${gi.toFixed(1)}%) supera el límite crítico admisible del ${maxGI}%`,
        valorDetectado: `${gi.toFixed(1)}%`,
        limitePermitido: `Máx. ${maxGI}%`
      });
    }

    // 3. Rendimiento Integral < 75% (o valor configurado)
    const minRI = reglasVeto.minRendimientoIntegral ?? 75.0;
    if (ri !== undefined && ri < minRI) {
      motivosVeto.push({
        codigo: "RI_INSUFICIENTE",
        parametro: "Rendimiento Integral (RI)",
        descripcion: `Rendimiento Integral (${ri.toFixed(1)}%) está por debajo del estándar mínimo de ${minRI}%`,
        valorDetectado: `${ri.toFixed(1)}%`,
        limitePermitido: `Mín. ${minRI}%`
      });
    }

    // 4. Bastante Olor
    if (reglasVeto.bloquearBastanteOlor !== false) {
      const isBastanteOlor = 
        pOlor.code === "B" || 
        pOlor.raw.toUpperCase().includes("BASTANTE") || 
        pOlor.raw.toUpperCase() === "B" ||
        (pOlor.num !== undefined && pOlor.num >= 3.5);

      if (isBastanteOlor) {
        motivosVeto.push({
          codigo: "BASTANTE_OLOR",
          parametro: "Olor Organoléptico",
          descripcion: `Presencia severa de Bastante Olor en materia prima (${pOlor.label || "Bastante"})`,
          valorDetectado: pOlor.label || "Bastante (B)",
          limitePermitido: "Poco (P)"
        });
      }
    }

    // 5. Bastante Plaga / Hongo / Insectos
    if (reglasVeto.bloquearBastantePlaga !== false) {
      const plagasRaw = String(analisis?.["PLAGAS-NSEC."] || analisis?.["PLAGAS-INSEC."] || "").trim().toUpperCase();
      const isPlagaBastante = plagasRaw === "B" || plagasRaw.includes("BASTANTE") || (typeof analisis?.["PLAGAS-NSEC."] === "number" && Number(analisis?.["PLAGAS-NSEC."]) > 0.5);
      const isHongoBastante = pHongo.code === "B" || pHongo.raw.toUpperCase().includes("BASTANTE") || (pHongo.num !== undefined && pHongo.num >= 3.0);
      const isFCarbBastante = pFCarb.code === "B" || pFCarb.raw.toUpperCase().includes("BASTANTE") || (pFCarb.num !== undefined && pFCarb.num >= 3.0);

      if (isPlagaBastante || isHongoBastante || isFCarbBastante) {
        const detalle = isPlagaBastante ? `Plagas/Insectos (${plagasRaw || 'Bastante'})` : isHongoBastante ? `Hongo (${pHongo.label})` : `Falso Carbón (${pFCarb.label})`;
        motivosVeto.push({
          codigo: "BASTANTE_PLAGA",
          parametro: "Plaga / Hongo / Insectos",
          descripcion: `Contaminación por plaga, insectos u hongos en nivel crítico: ${detalle}`,
          valorDetectado: detalle,
          limitePermitido: "Poco (P) o Ausente"
        });
      }
    }

    // 6. Muestras con Humedad <= 10% que representan más del 20% del total de muestras tomadas
    if (reglasVeto.bloquearHumedadesBajas10 !== false) {
      const umbralBaja = reglasVeto.umbralHumedadBajaCritica ?? 10.0;
      const maxPctPermitido = reglasVeto.maxPctMuestrasHumedadBaja ?? 20.0;

      let caladasValidas: number[] = [];
      if (Array.isArray(muestrasHumedad)) {
        caladasValidas = muestrasHumedad.filter(v => typeof v === "number" && !isNaN(v) && v > 0);
      } else if (muestrasHumedad && typeof muestrasHumedad === "object") {
        for (let i = 1; i <= 14; i++) {
          const k = `M${i}` as keyof RegistroHumedad;
          const v = parseFloat(String((muestrasHumedad as any)[k]));
          if (!isNaN(v) && v > 0) caladasValidas.push(v);
        }
      }

      if (caladasValidas.length > 0) {
        const totalMuestras = caladasValidas.length;
        const muestrasBajas = caladasValidas.filter(m => m <= umbralBaja).length;
        const pctBajas = (muestrasBajas / totalMuestras) * 100;

        if (muestrasBajas > 0 && pctBajas > maxPctPermitido) {
          motivosVeto.push({
            codigo: "HUMEDADES_BAJAS_EXCESIVAS",
            parametro: `Humedades ≤ ${umbralBaja}% (> ${maxPctPermitido}% de Caladas)`,
            descripcion: `El lote tiene ${muestrasBajas} de ${totalMuestras} muestras (${pctBajas.toFixed(1)}%) con humedad ≤ ${umbralBaja}%, superando el límite máximo de ${maxPctPermitido}%. Desaprobación mandatoria.`,
            valorDetectado: `${muestrasBajas}/${totalMuestras} muestras (${pctBajas.toFixed(1)}%)`,
            limitePermitido: `Máx. ${maxPctPermitido}% de muestras`
          });
        }
      }
    }
  }

  const tieneVetoCritico = motivosVeto.length > 0;

  // Si hay al menos un veto crítico, el lote queda AUTOMÁTICAMENTE DESAPROBADO
  if (tieneVetoCritico) {
    estadoAprobacion = "DESAPROBADO";
    colorEstado = "text-rose-400 bg-rose-950/70 border-rose-600 ring-1 ring-rose-500/50";
  }

  // Si fue autorizado excepcionalmente a EXPERIMENTAL por Jefatura de Área o Programador
  const tieneAutorizacionExp = Boolean(
    lote?.ES_EXPERIMENTAL ||
    lote?.AUTORIZACION_EXPERIMENTAL ||
    (lote?.ESTADO_LOTE || "").trim().toUpperCase() === "APTO EXPERIMENTAL"
  );

  if (tieneAutorizacionExp) {
    estadoAprobacion = "EXPERIMENTAL";
    colorEstado = "text-orange-300 bg-orange-950/80 border-orange-500 ring-1 ring-orange-500/50";
  }

  return {
    puntajeTotal,
    maxPuntaje,
    porcentajeAprobacion,
    estadoAprobacion,
    colorEstado,
    items,
    umbralesAplicados: umbrales,
    nombreConfiguracion: config.nombre,
    tieneVetoCritico,
    motivosVeto,
    ajusteGranoVerde,
    esExperimentalAutorizado: tieneAutorizacionExp,
    autorizacionExperimental: lote?.AUTORIZACION_EXPERIMENTAL
  };
}

// -------------------------------------------------------------
// VERIFICADOR OFICIAL DE APTITUD PARA PROGRAMACIÓN DE BATCHES
// REGLA CRÍTICA: SOLO SE PUEDEN PROGRAMAR LOTES APROBADOS (APTOS)
// Y OBSERVADOS. CUALQUIER LOTE DESAPROBADO O RECHAZADO QUEDA BLOQUEADO,
// SALVO AUTORIZACIÓN EXCEPCIONAL CON SUSTENTO DE JEFE DE ÁREA O PROGRAMADOR.
// -------------------------------------------------------------
export interface AptitudProgramacionLote {
  esProgramable: boolean;
  estadoMacro: "APROBADO" | "OBSERVADO" | "EXPERIMENTAL" | "NO_APTO" | "SIN_ANALISIS";
  label: string;
  badgeClass: string;
  badgeBorder: string;
  badgeBg: string;
  badgeText: string;
  porcentajeAprobacion: number;
  motivoBloqueo?: string;
  motivosVeto: string[];
  detalles: string;
}

export function verificarAptitudProgramacionLote(
  lote?: Partial<Lote>,
  analisis?: Partial<AnalisisHumedo>,
  registroHum?: any,
  config?: ConfiguracionEvaluacionLotes
): AptitudProgramacionLote {
  if (!lote) {
    return {
      esProgramable: false,
      estadoMacro: "SIN_ANALISIS",
      label: "SIN DATOS",
      badgeClass: "bg-slate-800 text-slate-400 border-slate-750",
      badgeBorder: "border-slate-750",
      badgeBg: "bg-slate-800",
      badgeText: "text-slate-400",
      porcentajeAprobacion: 0,
      motivoBloqueo: "No se proporcionaron datos del lote.",
      motivosVeto: [],
      detalles: "Faltan datos para evaluar la aptitud."
    };
  }

  const estadoLoteStr = (lote?.ESTADO_LOTE || "").trim().toUpperCase();

  // 0. EXCEPCIÓN FORMAL: Lote Desaprobado Autorizado Excepcionalmente como EXPERIMENTAL
  // por Jefatura de Área (Jefe de Planta / Vaporizado) o Programador con Sustento Técnico Obligatorio
  const tieneAutorizacionExperimental = Boolean(
    lote?.ES_EXPERIMENTAL ||
    lote?.AUTORIZACION_EXPERIMENTAL ||
    estadoLoteStr === "APTO EXPERIMENTAL" ||
    estadoLoteStr === "EXPERIMENTAL"
  );

  if (tieneAutorizacionExperimental) {
    const evalRes = calcularEvaluacionLote(analisis as any, lote as any, undefined, undefined, config, registroHum);
    const autor = lote?.AUTORIZACION_EXPERIMENTAL?.autorizadoPor || "Jefatura de Área / Programación";
    const rolAutor = lote?.AUTORIZACION_EXPERIMENTAL?.rol || "JEFE_PLANTA";
    const sustento = lote?.AUTORIZACION_EXPERIMENTAL?.sustento || lote?.SUSTENTO_EXPERIMENTAL || "Autorizado excepcionalmente para pruebas piloto.";
    const condicion = lote?.AUTORIZACION_EXPERIMENTAL?.condicionUso || "Batch Piloto / Mezcla Controlada";

    return {
      esProgramable: true,
      estadoMacro: "EXPERIMENTAL",
      label: "EXPERIMENTAL (AUTORIZADO)",
      badgeClass: "bg-orange-950/90 text-orange-300 border-orange-500/80 ring-1 ring-orange-500/40 shadow-sm",
      badgeBorder: "border-orange-500",
      badgeBg: "bg-orange-950/90",
      badgeText: "text-orange-300",
      porcentajeAprobacion: evalRes.porcentajeAprobacion,
      motivoBloqueo: undefined,
      motivosVeto: evalRes.motivosVeto.map(m => m.descripcion),
      detalles: `Lote desaprobado (${evalRes.porcentajeAprobacion}%), autorizado como EXPERIMENTAL por ${autor} (${rolAutor}). Condición: ${condicion}. Sustento: "${sustento}".`
    };
  }

  // 1. Verificación por Estado Administrativo Explícito (si no cuenta con autorización formal)
  if (
    estadoLoteStr === "RECHAZADO" || 
    estadoLoteStr === "NO APTO" || 
    estadoLoteStr === "NO_APTO" || 
    estadoLoteStr === "DESAPROBADO"
  ) {
    return {
      esProgramable: false,
      estadoMacro: "NO_APTO",
      label: "NO APTO / RECHAZADO",
      badgeClass: "bg-rose-950/90 text-rose-300 border-rose-600 ring-1 ring-rose-500/30",
      badgeBorder: "border-rose-600",
      badgeBg: "bg-rose-950/90",
      badgeText: "text-rose-300",
      porcentajeAprobacion: 0,
      motivoBloqueo: "Lote catalogado formalmente como RECHAZADO / NO APTO por Control de Calidad.",
      motivosVeto: ["Estado administrativo RECHAZADO"],
      detalles: "Este lote tiene prohibido su ingreso a vaporizado/molienda por no cumplir las especificaciones técnicas mínimas."
    };
  }

  // 2. Si no hay análisis húmedo ni físico
  if (!analisis || (!analisis.ANALISIS_HUMEDO_ID && !analisis.RI && !analisis.RB && !analisis.HUMEDADES)) {
    // Si tampoco tiene humedad básica
    if (!lote.HUM && !lote.VARIEDAD) {
      return {
        esProgramable: false,
        estadoMacro: "SIN_ANALISIS",
        label: "SIN ANÁLISIS",
        badgeClass: "bg-slate-800 text-slate-400 border-slate-700",
        badgeBorder: "border-slate-700",
        badgeBg: "bg-slate-800",
        badgeText: "text-slate-400",
        porcentajeAprobacion: 0,
        motivoBloqueo: "El lote aún no cuenta con análisis de laboratorio físico ni organoléptico.",
        motivosVeto: [],
        detalles: "Requiere muestreo de caladas y análisis físico antes de programar."
      };
    }
  }

  // 3. Ejecutar Evaluación Completa de 24 Criterios y Vetos Críticos
  const evalRes = calcularEvaluacionLote(analisis, lote, undefined, undefined, config, registroHum);

  // 4. Si presenta Vetos Críticos o estado Desaprobado/Rechazado -> BLOQUEO TOTAL
  if (
    evalRes.tieneVetoCritico || 
    evalRes.estadoAprobacion === "DESAPROBADO" || 
    evalRes.estadoAprobacion === "RECHAZADO"
  ) {
    const motivos = evalRes.motivosVeto.map(m => m.descripcion);
    return {
      esProgramable: false,
      estadoMacro: "NO_APTO",
      label: "NO APTO (DESAPROBADO)",
      badgeClass: "bg-rose-950/90 text-rose-300 border-rose-600 ring-1 ring-rose-500/40",
      badgeBorder: "border-rose-600",
      badgeBg: "bg-rose-950/90",
      badgeText: "text-rose-300",
      porcentajeAprobacion: evalRes.porcentajeAprobacion,
      motivoBloqueo: motivos.length > 0
        ? `Veto crítico: ${motivos.join(" | ")}`
        : `Calidad insuficiente (${evalRes.porcentajeAprobacion}% < 86% mínimo requerido).`,
      motivosVeto: motivos,
      detalles: `Lote NO APTO para priorización ni programación (${evalRes.porcentajeAprobacion}%). Bloqueado por desaprobación técnica.`
    };
  }

  // 5. Si es APROBADO (> 96% o conforme) -> PROGRAMABLE
  if (evalRes.estadoAprobacion === "APROBADO") {
    return {
      esProgramable: true,
      estadoMacro: "APROBADO",
      label: "APROBADO (APTO)",
      badgeClass: "bg-emerald-950/80 text-emerald-300 border-emerald-500/80 ring-1 ring-emerald-500/30",
      badgeBorder: "border-emerald-500",
      badgeBg: "bg-emerald-950/80",
      badgeText: "text-emerald-300",
      porcentajeAprobacion: evalRes.porcentajeAprobacion,
      motivosVeto: [],
      detalles: `Lote en condiciones óptimas (${evalRes.porcentajeAprobacion}%). Apto directo para priorización y programación.`
    };
  }

  // 6. Si es EXPERIMENTAL / CON RIESGO (86% a 91%) -> PROGRAMABLE PARA BATCH PILOTO / MEZCLA
  if (evalRes.estadoAprobacion === "EXPERIMENTAL" || evalRes.estadoAprobacion === "CON RIESGO") {
    return {
      esProgramable: true,
      estadoMacro: "EXPERIMENTAL",
      label: "EXPERIMENTAL (APTO BATCH PILOTO)",
      badgeClass: "bg-orange-950/80 text-orange-300 border-orange-500/80 ring-1 ring-orange-500/30",
      badgeBorder: "border-orange-500",
      badgeBg: "bg-orange-950/80",
      badgeText: "text-orange-300",
      porcentajeAprobacion: evalRes.porcentajeAprobacion,
      motivosVeto: [],
      detalles: `Lote experimental (${evalRes.porcentajeAprobacion}%). Apto para priorización y programación especial o mezcla controlada.`
    };
  }

  // 7. Si es OBSERVADO (91% a 96%) -> PROGRAMABLE CON MONITOREO
  return {
    esProgramable: true,
    estadoMacro: "OBSERVADO",
    label: "OBSERVADO (APTO C/ MONITOREO)",
    badgeClass: "bg-amber-950/80 text-amber-300 border-amber-500/80 ring-1 ring-amber-500/30",
    badgeBorder: "border-amber-500",
    badgeBg: "bg-amber-950/80",
    badgeText: "text-amber-300",
    porcentajeAprobacion: evalRes.porcentajeAprobacion,
    motivosVeto: [],
    detalles: `Lote con observación controlada (${evalRes.porcentajeAprobacion}%). Apto para priorización y programación con vigilancia.`
  };
}

/**
 * Validador estricto: determina si un lote está autorizado para aparecer en Priorización y Programación.
 * Solo se admiten lotes APROBADOS (APTOS), OBSERVADOS y EXPERIMENTALES.
 */
export function esLoteAptoParaPriorizacionYProgramacion(
  lote?: Partial<Lote>,
  analisis?: Partial<AnalisisHumedo>,
  registroHum?: any,
  config?: ConfiguracionEvaluacionLotes
): boolean {
  const aptitud = verificarAptitudProgramacionLote(lote, analisis, registroHum, config);
  return (
    aptitud.esProgramable &&
    (aptitud.estadoMacro === "APROBADO" ||
      aptitud.estadoMacro === "OBSERVADO" ||
      aptitud.estadoMacro === "EXPERIMENTAL")
  );
}

// -------------------------------------------------------------
// MOTOR DE EVALUACIÓN DE ALERTAS VISUALES CRÍTICAS PARA DASHBOARD
// -------------------------------------------------------------

export function extraerMuestrasNumericasHumedad(reg?: RegistroHumedad | any): number[] {
  if (!reg) return [];
  const muestras: number[] = [];
  for (let i = 1; i <= 20; i++) {
    const val = reg[`M${i}`] ?? reg[`m${i}`] ?? reg[`MUESTRA_${i}`];
    if (val !== undefined && val !== null && val !== "" && !isNaN(Number(val))) {
      const num = Number(val);
      if (num > 0) muestras.push(num);
    }
  }
  return muestras;
}

export function evaluarAlertasCriticasLote(
  lote: Lote,
  analisis?: AnalisisHumedo,
  registroHum?: RegistroHumedad,
  config?: ConfiguracionEvaluacionLotes
): AlertaCriticaLote[] {
  const cfg = config || CONFIG_EVALUACION_LOTES_DEFAULT;
  const alertasConfig = cfg.alertasDashboard || CONFIGURACION_ALERTAS_DASHBOARD_DEFAULT;

  if (!alertasConfig.activarAlertasDashboard) {
    return [];
  }

  // Filtrado de lotes activos si está configurado
  if (alertasConfig.soloLotesActivos) {
    const estado = (lote.ESTADO_LOTE || "").toUpperCase().trim();
    if (estado === "CERRADO" || estado === "TERMINADO" || estado === "PROCESADO") {
      return [];
    }
  }

  const caladas = extraerMuestrasNumericasHumedad(registroHum);
  let humProm = lote.HUM || 0;
  let desvHum = lote.DESV || 0;

  if (caladas.length > 0) {
    const sum = caladas.reduce((a, b) => a + b, 0);
    humProm = Number((sum / caladas.length).toFixed(2));
    const variance = caladas.reduce((acc, val) => acc + Math.pow(val - humProm, 2), 0) / caladas.length;
    desvHum = Number(Math.sqrt(variance).toFixed(2));
  } else if (analisis?.HUMEDADES) {
    humProm = Number(analisis.HUMEDADES) || humProm;
  }

  // Muestras <= 10%
  let pctMuestrasBajas = 0;
  if (caladas.length > 0) {
    const bajas = caladas.filter(m => m <= 10.0).length;
    pctMuestrasBajas = Number(((bajas / caladas.length) * 100).toFixed(1));
  }

  // Score total de calidad
  const evalRes = calcularEvaluacionLote(analisis, lote, humProm, desvHum, cfg, registroHum);
  const scoreTotal = evalRes.porcentajeAprobacion;

  // Valores numéricos analizados
  const anAny = analisis as any;
  const ri = analisis?.RI !== undefined ? Number(analisis.RI) : 0;
  const qb = analisis?.QB !== undefined ? Number(analisis.QB) : (analisis?.QI !== undefined ? Number(analisis.QI) : 0);
  const gv = analisis?.GV !== undefined ? Number(analisis.GV) : 0;
  const gi = analisis?.GI !== undefined ? Number(analisis.GI) : 0;
  const mancha = analisis?.M !== undefined ? Number(analisis.M) : (analisis?.MANCHADO !== undefined ? Number(analisis.MANCHADO) : 0);
  const yesado = anAny?.YESADO !== undefined ? Number(anAny.YESADO) : (analisis?.TT !== undefined ? Number(analisis.TT) : 0);
  const rojos = analisis?.GR !== undefined ? Number(analisis.GR) : 0;

  let plagasVal = 0;
  if (anAny?.PLAGAS_INSECTOS !== undefined) {
    plagasVal = Number(anAny.PLAGAS_INSECTOS) || 0;
  } else if (analisis?.["PLAGAS-NSEC."] !== undefined) {
    plagasVal = Number(analisis["PLAGAS-NSEC."]) || 0;
  }

  const alertasLote: AlertaCriticaLote[] = [];
  const reglas = alertasConfig.reglas || REGLAS_ALERTAS_DASHBOARD_DEFAULT;

  for (const regla of reglas) {
    if (!regla.activo) continue;

    let valorActual: number | undefined;
    let formatVal = "";

    switch (regla.parametro) {
      case "SCORE_TOTAL":
        valorActual = scoreTotal;
        formatVal = `${scoreTotal.toFixed(1)}%`;
        break;
      case "HUMEDAD":
        if (humProm > 0) {
          valorActual = humProm;
          formatVal = `${humProm.toFixed(1)}%`;
        }
        break;
      case "DESV_HUMEDAD":
        if (caladas.length > 0 || desvHum > 0) {
          valorActual = desvHum;
          formatVal = `${desvHum.toFixed(2)}%`;
        }
        break;
      case "GRANO_VERDE":
        if (analisis && analisis.GV !== undefined) {
          valorActual = gv;
          formatVal = `${gv.toFixed(1)}%`;
        }
        break;
      case "GRANO_INMADURO":
        if (analisis && analisis.GI !== undefined) {
          valorActual = gi;
          formatVal = `${gi.toFixed(1)}%`;
        }
        break;
      case "RENDIMIENTO_INTEGRAL":
        if (analisis && analisis.RI !== undefined) {
          valorActual = ri;
          formatVal = `${ri.toFixed(1)}%`;
        }
        break;
      case "QUEBRADO_TOTAL":
        if (analisis && (analisis.QB !== undefined || analisis.QI !== undefined)) {
          valorActual = qb;
          formatVal = `${qb.toFixed(1)}%`;
        }
        break;
      case "MUESTRAS_HUMEDAD_BAJA":
        if (caladas.length > 0) {
          valorActual = pctMuestrasBajas;
          formatVal = `${pctMuestrasBajas.toFixed(1)}%`;
        }
        break;
      case "DANADO_CALOR":
        if (analisis && (analisis.M !== undefined || analisis.MANCHADO !== undefined)) {
          valorActual = mancha;
          formatVal = `${mancha.toFixed(1)}%`;
        }
        break;
      case "YESADO":
        if (analisis && (anAny?.YESADO !== undefined || analisis.TT !== undefined)) {
          valorActual = yesado;
          formatVal = `${yesado.toFixed(1)}%`;
        }
        break;
      case "GRANOS_ROJOS":
        if (analisis && analisis.GR !== undefined) {
          valorActual = rojos;
          formatVal = `${rojos.toFixed(1)}%`;
        }
        break;
      case "PLAGAS":
        if (analisis && (anAny?.PLAGAS_INSECTOS !== undefined || analisis["PLAGAS-NSEC."] !== undefined)) {
          valorActual = plagasVal;
          formatVal = `${plagasVal.toFixed(1)}%`;
        }
        break;
    }

    if (valorActual === undefined) continue;

    let disparaCritico = false;
    let disparaAdvertencia = false;
    let umbralTexto = "";
    let mensaje = "";

    if (regla.operador === "MAYOR_A") {
      umbralTexto = `> ${regla.umbralCritico}%`;
      if (valorActual > regla.umbralCritico) {
        disparaCritico = true;
        mensaje = `${regla.nombre} (${formatVal}) excede el umbral crítico permitido (> ${regla.umbralCritico}%).`;
      } else if (regla.umbralAdvertencia !== undefined && valorActual > regla.umbralAdvertencia) {
        disparaAdvertencia = true;
        mensaje = `${regla.nombre} (${formatVal}) en nivel de advertencia (> ${regla.umbralAdvertencia}%).`;
      }
    } else if (regla.operador === "MENOR_A") {
      umbralTexto = `< ${regla.umbralCritico}%`;
      if (valorActual < regla.umbralCritico) {
        disparaCritico = true;
        mensaje = `${regla.nombre} (${formatVal}) está por debajo del mínimo crítico admisible (< ${regla.umbralCritico}%).`;
      } else if (regla.umbralAdvertencia !== undefined && valorActual < regla.umbralAdvertencia) {
        disparaAdvertencia = true;
        mensaje = `${regla.nombre} (${formatVal}) en nivel de advertencia preventiva (< ${regla.umbralAdvertencia}%).`;
      }
    } else if (regla.operador === "FUERA_RANGO") {
      const minCrit = regla.umbralCritico;
      const maxCrit = regla.umbralMax ?? 16.0;
      const minAdv = regla.umbralAdvertencia ?? (minCrit + 1.0);
      const maxAdv = regla.umbralMaxAdvertencia ?? (maxCrit - 1.0);

      umbralTexto = `${minCrit}% - ${maxCrit}%`;
      if (valorActual < minCrit || valorActual > maxCrit) {
        disparaCritico = true;
        mensaje = `${regla.nombre} (${formatVal}) fuera del rango crítico operativo [${minCrit}% - ${maxCrit}%].`;
      } else if (valorActual < minAdv || valorActual > maxAdv) {
        disparaAdvertencia = true;
        mensaje = `${regla.nombre} (${formatVal}) fuera del rango preventivo [${minAdv}% - ${maxAdv}%].`;
      }
    }

    if (disparaCritico || disparaAdvertencia) {
      const severidad: SeveridadAlerta = disparaCritico ? "CRITICO" : "ADVERTENCIA";

      if (alertasConfig.mostrarSoloCriticos && severidad !== "CRITICO") {
        continue;
      }

      alertasLote.push({
        id: `alert-${lote.LOTE_ID}-${regla.id}`,
        reglaId: regla.id,
        loteId: lote.LOTE_ID,
        cliente: lote.CLIENTE || "Sin cliente",
        variedad: lote.VARIEDAD || "Estándar",
        estadoLote: lote.ESTADO_LOTE,
        parametro: regla.parametro,
        nombreAlerta: regla.nombre,
        unidad: regla.unidad,
        valorActual,
        valorFormateado: formatVal,
        umbralConfigurado: disparaCritico ? regla.umbralCritico : (regla.umbralAdvertencia ?? regla.umbralCritico),
        umbralTexto,
        severidad,
        operador: regla.operador,
        mensaje,
        fechaDeteccion: new Date().toISOString()
      });
    }
  }

  return alertasLote;
}

export function evaluarTodasAlertasCriticas(
  lotes: Lote[],
  analisisList: AnalisisHumedo[] = [],
  humedadesList: RegistroHumedad[] = [],
  config?: ConfiguracionEvaluacionLotes
): AlertaCriticaLote[] {
  const todasAlertas: AlertaCriticaLote[] = [];

  const anMap = new Map<string, AnalisisHumedo>();
  for (const an of analisisList) {
    if (an.LOTE_ID) {
      anMap.set(an.LOTE_ID.toString().trim().toUpperCase(), an);
    }
  }

  const humMap = new Map<string, RegistroHumedad>();
  for (const hum of humedadesList) {
    if (hum.LOTE_ID) {
      humMap.set(hum.LOTE_ID.toString().trim().toUpperCase(), hum);
    }
  }

  for (const lote of lotes) {
    const cleanId = (lote.LOTE_ID || "").toString().trim().toUpperCase();
    const an = anMap.get(cleanId);
    const hum = humMap.get(cleanId);
    const alertas = evaluarAlertasCriticasLote(lote, an, hum, config);
    todasAlertas.push(...alertas);
  }

  // Ordenar: primero CRÍTICO, luego ADVERTENCIA
  todasAlertas.sort((a, b) => {
    if (a.severidad === "CRITICO" && b.severidad !== "CRITICO") return -1;
    if (a.severidad !== "CRITICO" && b.severidad === "CRITICO") return 1;
    return a.loteId.localeCompare(b.loteId);
  });

  return todasAlertas;
}
