// 12 Tablas del Excel Maestro + Modelos de Proceso

export type UserRole = 
  | "PROGRAMADOR"
  | "INGENIERO_PROGRAMADOR"
  | "JEFE_VAPORIZADO"
  | "JEFE_PLANTA"
  | "SUPERVISOR"
  | "ANALISTA_CALIDAD"
  | "CONTROL_CALIDAD"
  | "CALIDAD"
  | "OPERARIO"
  | "OPERADOR"
  | "ADMINISTRADOR"
  | "ADMIN"
  | "GERENCIA"
  | "AUDITOR";

export type CategoriaLote = "PENDIENTE" | "EN_PROCESO" | "PROCESADO";

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  cargo?: string;
  departamento?: string;
  avatarColor?: string;
  iniciales?: string;
  nivelAcceso?: string;
  permisos?: string[];
  permisosPersonalizados?: Record<string, boolean>;
  telefono?: string;
  activo?: boolean;
  pin?: string;
  fechaCreacion?: string;
}

export interface AutorizacionExperimental {
  autorizadoPor: string;
  rol: string;
  sustento: string;
  condicionUso?: string;
  fecha: string;
  estadoPrevio?: string;
}

export interface Lote {
  LOTE_ID: string;
  FECHA_INGRESO: string;
  CLIENTE: string;
  UBICACION?: string;
  SACOS: number;
  PESO_KG: number;
  HUM?: number;
  HUMEDAD?: number;
  DESV?: number;
  VARIEDAD: string;
  ZONA?: string;
  ESTADO_LOTE: string;
  OBSERVACIONES?: string;
  PROCEDENCIA?: string;
  INDICE_EXITO?: number;
  ES_EXPERIMENTAL?: boolean;
  ESTADO_CALIDAD?: "APROBADO" | "OBSERVADO" | "EXPERIMENTAL" | "DESAPROBADO" | string;
  AUTORIZACION_EXPERIMENTAL?: AutorizacionExperimental;
  SUSTENTO_EXPERIMENTAL?: string;
}

export interface RegistroHumedad {
  "ID ANALISIS": string;
  LOTE_ID: string;
  FECHA_ANALISIS: string;
  FECHA?: string;
  "PROM. GENERAL"?: number;
  "H. PROMEDIO": number;
  "DESV."?: number;
  DESVIACION?: number;
  "H.MIN."?: number;
  "H.MAX"?: number;
  HUM_MAX?: number;
  HUM_MIN?: number;
  M1?: number;
  M2?: number;
  M3?: number;
  M4?: number;
  M5?: number;
  M6?: number;
  M7?: number;
  M8?: number;
  M9?: number;
  M10?: number;
  M11?: number;
  M12?: number;
  M13?: number;
  M14?: number;
  M15?: number;
  M16?: number;
  M17?: number;
  M18?: number;
  M19?: number;
  OBSERVACIONES?: string;
  RESPONSABLE?: string;
  METODO?: string;
  [key: string]: any;
}

export type CalificacionOrganoleptica = "P" | "R" | "V" | "B" | string;

export interface AnalisisHumedo {
  ANALISIS_HUMEDO_ID: string;
  LOTE_ID: string;
  FECHA_ANALISIS: string;
  HUMEDADES?: number;
  VARIEDAD?: string;
  IMPUREZS?: number | string; // IMPUREZA (IMP.)
  RI?: number; // R. INTEGRAL (R. I)
  RB?: number; // R. BLANCO (R. B)
  RM?: number; // %REMOCION (% REM.)
  QI?: number; // QUEBRADO INTEGRAL (%Q. INT.)
  QB?: number; // QUEBRADO BLANCO (% Q. BL.)
  ENTERO?: number; // % DE GRANO ENTERO (% ENTERO)
  "B.INTEGRAL"?: number; // BLANCURA INTEGRAL (BL. INT.)
  BLI?: number; // BLANCURA INTEGRAL alias
  BLP?: number; // BLANCURA PULIDO alias
  "MEZCLA VAR."?: number;
  TT?: number; // TIZA TOTAL (% T. TOT.)
  TP?: number; // TIZA PARCIAL (%T. PARC.)
  "T. PUNT."?: number; // TIZA PUNTUAL (%T. PUNT.)
  M?: number; // MANCHA (% M)
  TZ?: number; // TRIZADO (% TZ)
  GR?: number; // GRANO ROJO (% G. R)
  GI?: number; // GRANO INMADURO (% G. INM.)
  GV?: number; // GRANO VERDE (% G. V)
  G_VERDE?: number; // Alias GRANO VERDE
  "B. PULIDO"?: number; // BLANCURA DE PULIDO (B. PULIDO)
  VANO?: number | string; // VANO (VN) - POCO (P), REGULAR (R), VARIADO (V), BASTANTE (B)
  PALOTE?: number | string; // PALOTE (PALT) - POCO (P), REGULAR (R), VARIADO (V), BASTANTE (B)
  MANCHADO?: number; // Alias MANCHA
  OLOR?: string; // OLOR (OL) - POCO (P), REGULAR (R), VARIADO (V), BASTANTE (B)
  CASCADO?: number;
  "F. CARBON"?: number | string; // FALSO CARBON (F. CARB.) - POCO (P), REGULAR (R), VARIADO (V), BASTANTE (B)
  HONGO?: number | string; // HONGO (HON.) - POCO (P), REGULAR (R), VARIADO (V), BASTANTE (B)
  "PLAGAS-NSEC."?: number;
  OTROS?: number;
  OBSERVACIONES?: string;
  FOTO_URL?: string;
  [key: string]: any;
}

export interface Presecado {
  PRESECADO_ID: string;
  LOTE_ID: string;
  BATCH_ID?: string;
  TEMP_SECADO_C?: number;
  TIEMPO_SECADO_MIN?: number;
  FECHA_ANALISIS: string;
  Humedad?: number;
  Impurezas?: number;
  RI?: number;
  RB?: number;
  RM?: number;
  QI?: number;
  QB?: number;
  Entero?: number;
  "B.INTEGRAL"?: number;
  "Mezcla de variedades"?: number;
  TT?: number;
  TP?: number;
  "T. PUNT."?: number;
  M?: number;
  TZ?: number;
  GR?: number;
  GI?: number;
  GV?: number;
  "B. PULIDO"?: number;
  VANO?: number;
  PALOTE?: number;
  MANCHADO?: number;
  OLOR?: string;
  CASCADO?: number;
  "F. CARBON"?: number;
  HONGO?: number;
  "PLAGAS-INSEC."?: number;
  OTROS?: number;
  OBSERVACIONES?: string;
}

export interface AnalisisSeco {
  ANALISIS_SECO_ID: string;
  LOTE_ID: string;
  BATCH_ID?: string;
  FECHA_ANALISIS: string;
  Humedad_Final: number;
  HUMEDAD_FINAL?: number;
  QI_Final: number;
  QB_Final: number;
  PORC_QUEBRADO?: number;
  Entero_Final: number;
  Blancura_Final: number;
  Trizado_Final: number;
  Tiza_Final: number;
  Manchado_Final: number;
  Coccion_Score?: number;
  OBSERVACIONES: string;
}

export interface ProgramacionApit {
  PROGRAMACION_ID: string;
  BATCH_ID: string;
  LOTE_ID: string;
  FECHA_PROGRAMACION: string;
  PRIORIDAD: "ALTA" | "MEDIA" | "BAJA";
  SACOS_PROGRAMADOS: number;
  PESO_PROGRAMADO_KG: number;
  HUMEDAD_REFERENCIA: number;
  ESTADO_PROGRAMACION: string;
  APTO_APIT: "SI" | "NO" | "OBSERVADO";
  MOTIVO_RECHAZO: string;
  OBSERVACIONES: string;
}

export interface BatchVaporizado {
  BATCH_ID: string;
  CORRELATIVO?: string; // e.g. "V200", "V200-1", "V200-2"
  PROCESO_PADRE?: string; // e.g. "V200"
  SUB_BATCH?: string; // e.g. "V200-1"
  ES_SUB_BATCH?: boolean;
  GRUPO_UNION_ID?: string;
  LOTES_UNION?: string[];
  CLIENTE?: string;
  VARIEDAD?: string;
  FECHA_PROGRAMADA: string;
  FECHA_INICIO?: string;
  FECHA_FIN?: string;
  FECHA_REGISTRO?: string;
  EQUIPO: string;
  EQUIPO_ASIGNADO?: string;
  TOTAL_SACOS?: number;
  HUMEDAD_PROMEDIO?: number;
  TURNO?: "Turno Día" | "Turno Noche" | string;
  CAPACIDAD_PROGRAMADA_TN?: number;
  TON_PROGRAMADAS: number;
  TON_PROCESADAS: number;
  PESO_TOTAL_KG?: number;
  TOTAL_PESO_KG?: number;
  CAPACIDAD_MAX_KG?: number;
  CAPACIDAD_UTILIZADA_PCT?: number;
  CAPACIDAD_DISPONIBLE_KG?: number;
  ES_EXCEPCIONAL_PAMPA?: boolean;
  ESTADO_COMPATIBILIDAD?: "COMPATIBLE" | "OBSERVADO" | "INCOMPATIBLE";
  ESTADO_BATCH: "PROGRAMADO" | "EN PROCESO" | "TERMINADO" | "OBSERVADO" | "CERRADO" | string;
  OPERADOR: string;
  OBSERVACIONES: string;
}

export interface BatchLote {
  BATCH_LOTE_ID: string;
  BATCH_ID: string;
  LOTE_ID: string;
  PARTE?: number; // 1, 2, 3 para lotes divididos
  TOTAL_PARTES?: number;
  SACOS: number;
  PESO_KG: number;
  PORCENTAJE_LOTE?: number; // % que representa este corte del lote original
  ORDEN: number;
  ESTADO: string;
  CLIENTE?: string;
  VARIEDAD?: string;
  DEFECTOS_PCT?: number;
  QUEBRADO_PCT?: number;
  OBSERVACIONES: string;
}

export type SiloEstado = "DISPONIBLE" | "LLENADO" | "REPOSO" | "DESCARGA" | "COMPLETADO" | string;

export interface SiloControlPlant {
  siloNumber: number;
  nombreSilo?: string;
  estado?: SiloEstado;
  estadoTimestamp?: string;
  tiempoLlenadoInicio?: string;
  tiempoLlenadoFin?: string;
  tiempoReposoInicio?: string;
  tiempoReposoFin?: string;
  tiempoDescargaInicio?: string;
  tiempoDescargaFin?: string;
  exclusa: {
    inicio: string;
    fin: string;
    tiempoLlenado?: string | number;
    tempAmbiente?: number;
    humedadRelativa?: number;
    presion?: number;
    vacio?: string | number;
    v?: string | number;
    exclusa?: number | string;
    excluso?: number | string;
  };
  tempSuperior?: number;
  tempInferior?: number;
  descarga: {
    inicio: string;
    fin: string;
    tiempo?: number | string;
    tiempoDescarga?: string | number;
    tiempoReposo?: string | number;
    reposo?: string | number;
    tempAmbiente?: number;
    humedadRelativa?: number;
    blIntegral?: number;
    blp?: number;
    amarillo?: number;
    quebradoPct?: number;
    trizado?: number;
    humedad?: number;
    // Legacy fields for backward compatibility
    humedadDescarga?: number;
    blancura?: number;
    minutos?: number;
    esclusa?: number;
  };
}

export interface PerfilSecadoPlant {
  perfilIndex: number | string;
  etapa?: "REPOSO_1" | "ENFRIAMIENTO" | "REPOSO_2" | "SECADO" | string;
  fecha: string;
  horaInicio: string;
  tempGrano?: number;
  tempAmbiente?: number;
  humedadRelativa?: number;
  humedad?: number | string;
  tempReal?: number;
  tiempoMin?: number | string;
  tempProgramada?: number;
  a1?: number;
  a2?: number;
  materiaPrima?: {
    qPct?: number;
    trizPct?: number;
    blGrad?: number;
  };
  modificaciones?: {
    mod1Tiemp?: string;
    mod1?: string;
    mod2Tiemp?: string;
    mod2?: string;
    mod3?: string;
  };
}

export interface ParametroPaddyRow {
  parametro: string;
  label: string;
  ingresoVaporizado?: number;
  salidaVaporizado?: number;
  reposoSecadora?: number;
  salidaSecadora?: number;
  variacion?: number;
  isHighlighted?: boolean;
}

export interface PaseVaporizadoDetalle {
  paseNumero?: 1 | 2 | number;
  nombre?: string; // ej: "1° Pase (Acondicionamiento / Pre-calor)" o "2° Pase (Cocción / Gelatinización)"
  inicio: string;
  fin: string;
  duracion?: string;
  tiempoMin?: number;
  presion?: number; // Presión de vapor en bar (ej. 0.40, 0.45)
  presionMax?: number; // Presión máxima en bar (ej. 0.55)
  presionProm?: number; // Presión promedio en bar
  vacio?: string | number; // "V" - Vacío de autoclave (ej. -0.6 bar / 22 inHg) o Válvula
  v?: string | number; // Alias "V"
  excluso?: string | number; // Excluso / Exclusa rotativa N°
  vExcl?: string | number; // V.EXCL. (Velocidad de Exclusa o N° Exclusa)
  rpm?: number; // RPM de autoclave (ej. 18, 14)
  temperatura?: number | string; // Temperatura °C (ej. 125, 130)
  perfil?: string; // ej. "Pre-calor Suave", "Cocción Profunda", "Estándar"
  tiempoReposo?: string; // Tiempo de reposo posterior/inter-pase (ej. "10 min", "45 min")
  valvulaVaporPct?: number; // Porcentaje de inyección de vapor
  obs?: string; // Observaciones del pase
}

export interface DatosVaporizadoPlant {
  modalidadPases?: "1_PASE" | "2_PASES"; // "1_PASE" para lotes húmedos (≥14% H), "2_PASES" para lotes secos (<14% H - Anti-Trizado)
  motivoPases?: string;
  vacio?: string | number; // Vacío general o V
  v?: string | number;
  excluso?: string | number;
  llenadoTolvaPulmon: { inicio: string; fin: string; duracion?: string; exclusa?: string | number; excluso?: string | number };
  inyeccionVapor: { 
    inicio: string; 
    fin: string; 
    duracion?: string; 
    presion?: number; 
    vacio?: string | number;
    v?: string | number;
    velExclusa?: string | number;
    vExcl?: string | number;
    exclusa?: string | number;
    excluso?: string | number;
    rpm?: number; 
    temperatura?: number | string;
    perfil?: string;
    tiempoReposo?: string;
    tReposo?: string;
    obs?: string;
  };
  inyeccionVaporPase1?: PaseVaporizadoDetalle;
  inyeccionVaporPase2?: PaseVaporizadoDetalle;
  pases?: PaseVaporizadoDetalle[];
  tiempoReposoInterPases?: string;
  tiempoTotalInyeccionMin?: number | string;
  presionVapor: number;
  rpm: number;
  tempTrabajo: string;
}

export interface ParametrosOperativosBatch {
  presionVaporBar?: number;
  temperaturaVaporC?: number;
  tiempoInyeccionMin?: number;
  tiempoReposoMin?: number;
  rpm?: number;
  temperaturaSecadoC?: number;
  tiempoSecadoMin?: number;
  observaciones?: string;
  definidoPor?: string;
  fechaDefinicion?: string;
}

export interface ControlVaporizado {
  CONTROL_VAPORIZADO_ID: string;
  BATCH_ID: string;
  CORRELATIVO?: string;
  CODIGO_INTERNO?: string;
  VARIEDAD?: string;
  LOTE_ID?: string;
  CLIENTE?: string;
  FECHA_HORA_INICIO: string;
  FECHA_HORA_FIN: string;
  HUMEDAD_INGRESO: number;
  PRESION_BAR: number;
  PRESION_MAX_BAR: number;
  PRESION_PROM_BAR: number;
  PRESION_VAPOR_BAR?: number;
  MODALIDAD_PASES?: string;
  TEMP_VAPOR_C?: number;
  RPM: number;
  RPM_AUTOCLAVE?: number;
  TIEMPO_VAPORIZADO_MIN: number;
  TIEMPO_REPOSO_MIN: number;
  TEMPERATURA_INGRESO_C: number;
  TEMPERATURA_SALIDA_C: number;
  TEMP_SUPERIOR_C: number;
  TEMP_INFERIOR_C: number;
  HUMEDAD_SALIDA: number;
  TON_PROCESADAS: number;
  OPERADOR: string;
  DESVIACION: string;
  DESVIACIONES?: string;
  SUPERVISOR?: string;
  EQUIPO_ID?: string;
  parametrosDeterminados?: ParametrosOperativosBatch;
  parametrosRecomendadosIA?: ParametrosOperativosBatch;
  // Official Plant Sheet Fields (Excel de Planta)
  datosIngreso?: {
    procedencia: string;
    codigo: string;
    numSacos: string;
    pesoKg: number;
    pesoTotalKg: number;
    variedad: string;
    humedadPct: number;
    tiempoReposo: string;
  };
  datosVaporizado?: DatosVaporizadoPlant;
  silos?: SiloControlPlant[];
  silosPase1?: SiloControlPlant[];
  silosPase2?: SiloControlPlant[];
  parametrosPaddy?: ParametroPaddyRow[];
  etapaReposo1?: PerfilSecadoPlant[];
  etapaEnfriamiento?: PerfilSecadoPlant[];
  etapaReposo2?: PerfilSecadoPlant[];
  perfilesSecado?: PerfilSecadoPlant[];
  resumenEtapas?: {
    tiempoReposo1?: string | number;
    tiempoEnfriamiento?: string | number;
    tiempoReposo2?: string | number;
    tiempoSecadoTotal?: string | number;
  };
  recetaSecado?: Array<{ perfil: number; tiempo: number; temp: number }>;
  carga: {
    inicio: string;
    fin: string;
    equipo: string;
    cantidad_tn: number;
  };
  inyeccion: {
    inicio: string;
    fin: string;
    presion_bar: number;
    presion_max: number;
    presion_prom: number;
    rpm: number;
    temp_c: number;
    obs: string;
  };
  reposo: {
    inicio: string;
    fin: string;
    tiempo_min: number;
    temp_sup_c: number;
    temp_inf_c: number;
  };
  descarga: {
    inicio: string;
    fin: string;
    temp_c: number;
    humedad_pct: number;
    obs: string;
  };
  secado: {
    ingreso: string;
    humedad_inicial: number;
    temp_entrada_c: number;
    temp_salida_c: number;
    humedad_final: number;
    tiempo_min: number;
    obs: string;
  };
  OBSERVACIONES: string;
}

export interface AnalisisVaporizado {
  ANALISIS_VAPORIZADO_ID: string;
  BATCH_ID: string;
  LOTE_ID: string;
  FECHA_ANALISIS: string;
  MUESTRA_NRO: number;
  HUMEDAD: number;
  HUMEDAD_FINAL?: number;
  QUEBRADO_FINAL?: number;
  TRIZADO_FINAL?: number;
  TIZA_FINAL?: number;
  BLANCURA_KETT?: number;
  MANCHADO_FINAL?: number;
  RI: number;
  RB: number;
  RM: number;
  QI: number;
  QB: number;
  TT: number;
  G_COCIDO?: number; // GRANO COCIDO (% G. COCIDO) - Evaluación exclusiva de la salida de arroz vaporizado
  TP: number;
  M: number;
  TZ: number;
  GR: number;
  GI: number;
  BLI: number;
  BL: number;
  VANO: number;
  QUEBRADO: number;
  TRIZADO: number;
  TIZA: number;
  MANCHADO: number;
  OBSERVACIONES: string;
  FOTO_URL?: string;

  // Campos adicionales Formato Oficial Molino Don Julio (Boleta N° 001438)
  NUM_BOLETA?: string;
  CLIENTE?: string;
  CODIGO_MUESTRA?: string;
  TOTAL_SACOS?: number;
  PROCEDENCIA?: string;
  VARIEDAD?: string;
  HUMEDADES_TOMAS?: number[]; // Matriz de 18 tomas (H1 .. H18)
  DESV_HUMEDAD?: number;
  IMPUREZAS?: number;
  R_POLVILLO?: number;
  ENTERO?: number;
  M_VARIETAL?: number;
  TIZA_PUNTUAL?: number;
  G_VERDE?: number;
  B_PULIDO?: number;
  PALOTE?: string;
  OLOR?: string;
  HONGO?: number | string;
  "F. CARBON"?: number | string;
  ORGANOLEPTICOS?: {
    vano?: string; // P / R / V / B / NP
    palote?: string; // P / R / V / B / NP
    impureza?: string; // P / R / V / B / NP
    olor?: string; // P / R / V / B / NP
    cascado?: string; // P / R / V / B / NP
    falsoCarbon?: string; // P / R / V / B / NP
    hongo?: string; // P / R / V / B / NP
    manchado?: string; // P / R / V / B / NP
    plagasInsectos?: string; // e.g. "Gorgojos" o P / NP
    otros?: string;
  };
  RESPONSABLE_ANALISIS?: string;
  VB_JEFE_AREA?: string;
}

export interface Equipo {
  EQUIPO_ID: string;
  EQUIPO: string;
  PROCESO: string;
  CAPACIDAD_TN: number;
  ESTADO: string;
  OBSERVACIONES: string;
}

export interface EstadoLote {
  ESTADO_ID: string;
  ESTADO: string;
  ORDEN: number;
  DESCRIPCION: string;
}

export interface SuccessWeights {
  incrementoQuebrado: number; // e.g. 35
  controlDefectos: number; // e.g. 25
  resultadoCoccion: number; // e.g. 20
  blancura: number; // e.g. 10
  cumplimientoProceso: number; // e.g. 10
  maxIncrementoQuebradoAceptable?: number;
  targetQuebradoMaxInc?: number;
  targetBlancuraMin?: number;
  targetHumedadFinal?: number;
}

export interface AuditLog {
  id: string;
  usuario: string;
  accion: string;
  fecha: string;
}

export interface EvaluacionLote {
  loteId: string;
  lote: Lote;
  antes: {
    QI: number;
    QB: number;
    Quebrado: number;
    Trizado: number;
    Tiza: number;
    Manchado: number;
    Blancura: number;
    Humedad: number;
    Entero: number;
  };
  despues: {
    QI: number;
    QB: number;
    Quebrado: number;
    Trizado: number;
    Tiza: number;
    Manchado: number;
    Blancura: number;
    Humedad: number;
    Entero: number;
    CoccionScore: number;
  };
  deltas: {
    deltaQuebrado: number;
    deltaTrizado: number;
    deltaTiza: number;
    deltaManchado: number;
    deltaBlancura: number;
    deltaHumedad: number;
  };
  scores: {
    scoreQuebrado: number;
    scoreDefectos: number;
    scoreCoccion: number;
    scoreBlancura: number;
    scoreCumplimiento: number;
  };
  weights: SuccessWeights;
  indiceExito: number;
  clasificacion: "LOTE EXITOSO" | "LOTE CONFORME" | "LOTE OBSERVADO";
}

export interface AIRecommendation {
  resumen_diagnostico: string;
  lotes_similares_identificados: string[];
  parametros: {
    parametro: string;
    unidad: string;
    recomendado: number;
    rango: string;
    justificacion: string;
    referencia_historica: string;
    confianza: "Alta" | "Media" | "Baja";
  }[];
  riesgos_identificados: string[];
  recomendaciones_operativas: string[];
  nivel_confianza_general: "Alta" | "Media" | "Baja";
}

export type AIRecommendationResult = AIRecommendation;

export interface AISimulationResult {
  es_simulacion: boolean;
  advertencia: string;
  predicciones: {
    quebrado_incremento_estimado_pct: number;
    blancura_estimada: number;
    gelatinizacion_estimada_pct: number;
    humedad_salida_estimada_pct: number;
    indice_exito_estimado: number;
    clasificacion_proyectada: "EXITOSO" | "CONFORME" | "RIESGO_ALTO";
  };
  analisis_variables: {
    impacto_presion: string;
    impacto_tiempo_vapor: string;
    impacto_tiempo_reposo: string;
  };
  alertas_simuladas: string[];
  recomendacion_ajuste: string;
  suficiencia_datos: "ALTA" | "MEDIA" | "LIMITADA";
}

// ==========================================
// MÓDULO: PRIORIZACIÓN INTELIGENTE DE LOTES
// ==========================================

export type NivelRiesgoLote = "BAJO" | "MEDIO" | "ALTO" | "EMERGENCIA";

export interface RangoHumedadPrioridad {
  id: string;
  etiqueta: string; // ej: "Menos de 14%", "15–16%", etc.
  minHum: number;
  maxHum: number;
  prioridadPct: number; // 62, 65, 68, 71, 76, 81, 86
  diasResistencia: number; // 30, 30, 20, 12, 5, 2, 1
  descripcion?: string;
}

export interface PuntosOrganolepticosConfig {
  palote: { poco: number; regularVarBast: number };
  vano: { poco: number; regularVarBast: number };
  impureza: { poco: number; regularVarBast: number };
  plaga: { poco: number; regularVarBast: number };
  olor: { poco: number; regularVarBast: number };
  falsoCarbon: { poco: number; regularVarBast: number };
  hongo: { poco: number; regularVarBast: number };
}

export interface RangosRiesgoConfig {
  bajoMax: number; // < 84
  medioMin: number; // 85
  medioMax: number; // 89
  altoMin: number; // 90
  altoMax: number; // 95
  emergenciaMin: number; // 96
}

export interface PriorizacionMasterConfig {
  rangosHumedad: RangoHumedadPrioridad[];
  organolepticos: PuntosOrganolepticosConfig;
  rangosRiesgo: RangosRiesgoConfig;
  formula: string; // "HUMEDAD_BASE + SUMA_ORGANOLEPTICOS"
}

export interface ParametroDetallePrioridad {
  parametro: string;
  abreviatura: string;
  valorOriginal: string | number;
  clasificacion: "POCO" | "REGULAR_VAR_BASTANTE" | "OTRO";
  puntos: number;
}

export interface PriorizacionLote {
  posicion: number;
  posicionOriginal: number;
  loteId: string;
  lote: Lote;
  cliente: string;
  zona: string;
  variedad: string;
  sacos: number;
  pesoKg: number;
  pesoTn: number;
  humedad: number;
  fechaIngreso: string;
  diasTranscurridos: number;
  diasResistencia: number;
  diasRestantes: number;
  
  // Parámetros evaluados
  palote: ParametroDetallePrioridad;
  vano: ParametroDetallePrioridad;
  impureza: ParametroDetallePrioridad;
  plaga: ParametroDetallePrioridad;
  olor: ParametroDetallePrioridad;
  falsoCarbon: ParametroDetallePrioridad;
  hongo: ParametroDetallePrioridad;
  
  // Puntuaciones
  prioridadBaseHumedad: number;
  rangoHumedadEtiqueta: string;
  puntosOrganolepticos: number;
  puntuacionFinal: number;
  
  // Clasificación y Riesgo
  nivelRiesgo: NivelRiesgoLote;
  esEmergencia: boolean;
  motivoEmergencia?: string;
  estadoLote: string;
  
  // Calidad y Aptitud de Proceso
  estadoCalidad?: "APROBADO" | "OBSERVADO" | "EXPERIMENTAL";
  porcentajeCalidad?: number;
  badgeCalidadClass?: string;
  labelCalidad?: string;
  
  // Recomendación
  recomendacion: string;
  desgloseFormula: string;
  
  // Cambio manual registrado
  cambioManual?: {
    ordenOriginal: number;
    ordenManual: number;
    usuario: string;
    fechaHora: string;
    motivo: string;
  };
}

export interface HistorialPuntuacionLote {
  id: string;
  loteId: string;
  fecha: string;
  diasTranscurridos: number;
  puntuacion: number;
  nivelRiesgo: NivelRiesgoLote;
  esEmergencia: boolean;
  motivo: string;
}

export interface CambioOrdenAuditoria {
  id: string;
  loteId: string;
  posicionAnterior: number;
  posicionNueva: number;
  usuario: string;
  fechaHora: string;
  motivo: string;
}

export interface AIPlanProgramacionDia {
  fecha: string;
  resumen_ejecutivo: string;
  capacidad_total_planta_tn: number;
  toneladas_programadas_total: number;
  sacos_programados_total: number;
  lotes_en_emergencia_count: number;
  lotes_alto_riesgo_count: number;
  batches_propuestos: {
    batch_temp_id: string;
    equipo_sugerido: string;
    capacidad_equipo_tn: number;
    ton_totales_batch: number;
    sacos_totales_batch: number;
    lotes_incluidos: {
      lote_id: string;
      cliente: string;
      variedad: string;
      sacos: number;
      peso_kg: number;
      peso_tn: number;
      humedad: number;
      puntuacion: number;
      nivel_riesgo: NivelRiesgoLote;
      motivo_priorizacion: string;
    }[];
    justificacion_tecnica: string;
    parametros_sugeridos: {
      presion_bar: number;
      tiempo_vapor_min: number;
      tiempo_reposo_min: number;
    };
  }[];
  lotes_postergados: {
    lote_id: string;
    motivo_postergacion: string;
    dias_restantes: number;
    accion_preventiva_sugerida: string;
  }[];
  advertencias_operativas: string[];
}

// -------------------------------------------------------------
// CONFIGURACIÓN MAESTRA DE EVALUACIÓN Y APROBACIÓN DE LOTES
// -------------------------------------------------------------
export type CategoriaCriterioEvaluacion = 
  | "HUMEDAD"
  | "FISICO_RENDIMIENTO"
  | "DEFECTOS_CALIDAD"
  | "ORGANOLEPTICO";

export type TipoOperadorCriterio = 
  | "MAYOR_A" 
  | "MAYOR_IGUAL" 
  | "MENOR_A" 
  | "MENOR_IGUAL" 
  | "RANGO" 
  | "ORGANOLEPTICO_MAX";

export interface CriterioEvaluacionConfig {
  id: string;
  nombre: string;
  abreviatura: string;
  categoria: CategoriaCriterioEvaluacion;
  tipoOperador: TipoOperadorCriterio;
  valorMin?: number;
  valorMax?: number;
  codigoOrganolepticoMax?: "N" | "P" | "R" | "V" | "B";
  condicion: string;
  peso: number; // Porcentaje asignado al parámetro (0 a 100)
  activo: boolean;
  descripcionTecnica?: string;
  unidad?: string;
}

export type EstadoAprobacionLote = 
  | "APROBADO" 
  | "OBSERVADO" 
  | "OBSERVADOS"
  | "EN OBSERVACION" 
  | "EXPERIMENTAL" 
  | "CON RIESGO" 
  | "DESAPROBADO" 
  | "RECHAZADO";

export interface UmbralesAprobacionLote {
  umbralAprobado: number;      // e.g. 96.0 -> APROBADO (> 96 %)
  umbralObservacion: number;   // e.g. 91.0 -> OBSERVADOS (91 A MAS / 91 a 96%)
  umbralExperimental?: number; // e.g. 86.0 -> EXPERIMENTAL (86 A MAS / 86 a 90.9%)
  umbralRiesgo: number;        // e.g. 86.0 -> EXPERIMENTAL / RIESGO (86 A MAS)
  // < 86.0 -> DESAPROBADO / RECHAZADO
}

export interface ReglasVetoCriticoConfig {
  maxGranoVerde: number;          // Máx % GV (defecto: 10.0%) -> Si GV > 10% desaprueba automáticamente (Rechazado)
  maxGranoVerdeRiesgo?: number;   // Límite GV para Riesgo (defecto: 8.0%) -> Si GV > 8% pasa a CON RIESGO
  maxGranoVerdeObservado?: number;// Límite GV para Observado (defecto: 6.0%) -> Si GV > 6% pasa a EN OBSERVACION
  maxGranoInmaduro: number;       // Máx % GI (defecto: 5.0%) -> Si > 5% desaprueba automáticamente
  minRendimientoIntegral: number; // Mín % RI (defecto: 75.0%) -> Si < 75% desaprueba automáticamente
  bloquearBastanteOlor: boolean;  // true -> Si Olor es "B" o "Bastante" desaprueba automáticamente
  bloquearBastantePlaga: boolean; // true -> Si Plaga/Hongo/Insecto es "B" o "Bastante" desaprueba automáticamente
  maxPctMuestrasHumedadBaja?: number; // Máx % de muestras con humedad <= 10% (defecto: 20.0%)
  umbralHumedadBajaCritica?: number;  // Valor de corte para humedad baja crítica (defecto: 10.0%)
  bloquearHumedadesBajas10?: boolean; // true -> Si muestras <= 10% superan el 20% del total tomado, desaprueba automáticamente
  activarVetosCriticos: boolean;  // true por defecto
}

export type OperadorAlerta = "MAYOR_A" | "MENOR_A" | "FUERA_RANGO";
export type SeveridadAlerta = "CRITICO" | "ADVERTENCIA" | "INFORMATIVO";

export type ParametroAlertaCalidad = 
  | "SCORE_TOTAL"
  | "HUMEDAD"
  | "DESV_HUMEDAD"
  | "GRANO_VERDE"
  | "GRANO_INMADURO"
  | "RENDIMIENTO_INTEGRAL"
  | "QUEBRADO_TOTAL"
  | "MUESTRAS_HUMEDAD_BAJA"
  | "DANADO_CALOR"
  | "YESADO"
  | "GRANOS_ROJOS"
  | "PLAGAS";

export interface ReglaAlertaCriticaDashboard {
  id: string;
  parametro: ParametroAlertaCalidad;
  nombre: string;
  descripcion: string;
  unidad: string; // ej: "%"
  operador: OperadorAlerta;
  umbralCritico: number;       // ej: 85.0 (%)
  umbralAdvertencia?: number;  // ej: 90.0 (%)
  umbralMax?: number;          // Usado si operador es FUERA_RANGO (ej: 16.0%)
  umbralMaxAdvertencia?: number; // Usado si operador es FUERA_RANGO (ej: 15.0%)
  severidadPorDefecto: SeveridadAlerta;
  activo: boolean;
  mostrarEnDashboard: boolean;
  colorHex?: string;
  icono?: string;
}

export interface ConfiguracionAlertasDashboard {
  activarAlertasDashboard: boolean;
  soloLotesActivos: boolean; // Si true, alerta solo sobre lotes disponibles/en proceso/programados (no cerrados)
  sonidoAlerta?: boolean;
  maxAlertasVisibles?: number;
  mostrarSoloCriticos?: boolean;
  reglas: ReglaAlertaCriticaDashboard[];
}

export interface AlertaCriticaLote {
  id: string;
  reglaId: string;
  loteId: string;
  cliente: string;
  variedad: string;
  estadoLote: string;
  parametro: ParametroAlertaCalidad;
  nombreAlerta: string;
  unidad: string;
  valorActual: number;
  valorFormateado: string;
  umbralConfigurado: number;
  umbralTexto: string;
  severidad: SeveridadAlerta;
  operador: OperadorAlerta;
  mensaje: string;
  fechaDeteccion?: string;
}

export interface ConfiguracionEvaluacionLotes {
  id: string;
  nombre: string;
  descripcion: string;
  version?: string;
  criterios: CriterioEvaluacionConfig[];
  umbrales: UmbralesAprobacionLote;
  reglasVeto?: ReglasVetoCriticoConfig;
  alertasDashboard?: ConfiguracionAlertasDashboard;
  normalizarAl100?: boolean;
  fechaActualizacion?: string;
  actualizadoPor?: string;
}

// ----------------------------------------------------
// PARÁMETROS DE TRABAJO & CONTROL DE BATCHES Y SALDOS
// ----------------------------------------------------

export interface ParametrosTrabajo {
  lotesObjetivoPorDia: number; // Por defecto: 2
  maxLotesPorDia: number; // Por defecto: 3
  capacidadMinimaProcesoKg: number; // Por defecto: 22,000 kg (22 TN)
  capacidadMaximaSecadoraKg: number; // Por defecto: 35,000 kg (35 TN)
  capacidadExcepcionalMaximaKg: number; // Por defecto: 37,000 kg (37 TN con alerta secado en pampa)
  toleranciaDefectosPp: number; // Por defecto: 2.0 puntos porcentuales
  toleranciaQuebradoPp: number; // Por defecto: 2.0 puntos porcentuales
  turnosDisponibles: string[]; // ["Turno Día", "Turno Noche"]
  sugeridoPorIA?: {
    lotesObjetivoPorDia?: number;
    maxLotesPorDia?: number;
    capacidadMinimaProcesoKg?: number;
    capacidadMaximaSecadoraKg?: number;
    capacidadExcepcionalMaximaKg?: number;
    toleranciaDefectosPp?: number;
    toleranciaQuebradoPp?: number;
    turnosDisponibles?: string[];
    justificacionIA?: string;
    fechaSugerencia?: string;
  };
  ultimaModificacion?: string;
  modificadoPor?: string;
}

export interface HistorialParametro {
  id: string;
  fecha: string;
  usuario: string;
  parametro: string;
  valorAnterior: any;
  nuevoValor: any;
  sugerenciaIA?: any;
  motivo?: string;
}

export type EstadoSaldoLote = "PENDIENTE" | "PARCIALMENTE PROCESADO" | "PROCESADO / COMPLETO";

export interface BatchParticipanteInfo {
  batchId: string;
  correlativo?: string;
  parte: number;
  totalPartes?: number;
  pesoSacos: number;
  pesoKg: number;
  fecha: string;
  turno?: string;
  estadoBatch: string;
}

export interface SaldoLoteInfo {
  loteId: string;
  cliente: string;
  variedad: string;
  humedad: number;
  pesoOriginalKg: number;
  sacosOriginales: number;
  pesoProcesadoKg: number;
  sacosProcesados: number;
  saldoPendienteKg: number;
  sacosPendientes: number;
  porcentajeProcesado: number;
  estadoSaldo: EstadoSaldoLote;
  defectosPct: number;
  quebradoPct: number;
  batchesParticipantes: BatchParticipanteInfo[];
  grupoUnionId?: string;
  grupoUnionProceso?: string;
  lotesPermitidosUnion?: string[];
  esSaldoReservadoUnion?: boolean;
}

export interface SubBatchDraft {
  id: string; // e.g. "SUB-1"
  subBatchCorrelativo: string; // "V200-1"
  procesoPadre: string; // "V200"
  turno: string;
  fecha: string;
  equipo: string;
  asignaciones: {
    loteId: string;
    pesoKg: number;
    sacos: number;
    parte: number;
    totalPartes: number;
    porcentajeSubBatch: number;
    sobranteLoteTrasSubBatchKg?: number;
  }[];
  pesoTotalKg: number;
  totalSacos: number;
  observaciones?: string;
}

export interface GrupoUnionLotes {
  id: string; // "UNION-V200"
  procesoPadre: string; // "V200"
  cliente: string;
  variedad: string;
  lotesSeleccionados: string[]; // ["C08432", "C08434", "C08428"]
  subBatches: string[]; // ["V200-1", "V200-2", "V200-3"]
  fechaCreacion: string;
  creadoPor: string;
  estado: "PROGRAMADO" | "EN_PROCESO" | "COMPLETADO";
  observaciones?: string;
}

export interface CompatibilidadLotesResult {
  esCompatible: boolean;
  motivosIncompatibilidad: string[];
  mismoCliente: boolean;
  clienteComun?: string;
  mismaVariedad: boolean;
  variedadComun?: string;
  diferenciaDefectos: number;
  toleranciaDefectos: number;
  diferenciaQuebrado: number;
  toleranciaQuebrado: number;
  advertencias: string[];
  detalles: {
    loteId: string;
    cliente: string;
    variedad: string;
    defectos: number;
    quebrado: number;
    saldoKg: number;
  }[];
}

export interface BatchEvaluacionComparativa {
  batchId: string;
  correlativo: string;
  fecha: string;
  turno: string;
  equipo: string;
  operador: string;
  estadoBatch: string;
  cliente: string;
  variedad: string;
  totalKg: number;
  totalSacos: number;
  loteIds: string[];

  // Ingreso (Materia Prima)
  humIngreso: number;
  qiIngreso: number;
  trizadoIngreso: number;
  tizaIngreso: number;
  manchadoIngreso: number;
  granoVerdeIngreso: number;

  // Proceso Térmico
  modalidadPases: string;
  presionVaporBar: number;
  tempVaporC: number;
  tiempoVaporMin: number;
  tiempoReposoMin: number;
  rpm: number;
  secadoMetodo: string;
  tempSecadoC: number;
  tiempoSecadoMin: number;

  // Salida Física & Defectos
  humSalida: number;
  deltaHumedad: number;
  quebradoSalida: number;
  deltaQuebrado: number;
  quebradoIntegralMP?: number;
  quebradoIntegralSalida?: number;
  trizadoSalida: number;
  deltaTrizado: number;
  tizaSalida: number;
  deltaTiza: number;
  tizaTotalMasGcocidoMP?: number;
  tizaTotalMasGcocidoDescarga?: number;
  incrementoTizaMasCocido?: number;
  tpMasTpuntualSalida?: number;
  manchadoSalida: number;
  deltaManchado: number;
  blancuraKett: number;
  gelatinizacionPct: number;
  reposoCascaraDias?: number;

  // Resultados de Cocción (Olla & Sensorial)
  coccionScore: number;
  tazasArroz?: number;
  tazasAgua?: string | number;
  tiempoCoccionMin: string;
  ratioAbsorcionAgua: string;
  expansionVolumetrica: string;
  solturaGrano: string;
  texturaFirmeza: string;
  colorCocido: string;
  aromaSabor: string;
  desplazamientoSeg?: string | number; // 15 seg
  granoQuebradoOllaPct?: number; // 18.0%
  granoHinchadoPct?: number; // 8.6%
  granoAbiertoPct?: number; // 1.3%
  sabor?: string; // Neutro Característico
  saborCocido?: string;
  texturaFrio?: string;
  envaseProyectado?: string;
  observacionesCoccion: string;
  esDatoCoccionReal?: boolean;

  // Calificación Integral de Eficiencia de Proceso (IEP)
  iepScore: number; // 0 - 100
  resultadoCoccion?: ResultadoCoccionExterno | any;
  puntosTrizado: number;
  puntosQuebrado: number;
  puntosDefectos: number;
  puntosCoccion: number;
  ranking: number;
  esGoldenBatch: boolean;
  diagnosticoGeneral: string;
}

export interface RecetaVaporizadoMaestra {
  id: string;
  nombreReceta: string;
  variedad: string;
  rangoHumedad: string;
  batchOrigenId: string;
  correlativoOrigen: string;
  iepScore: number;
  coccionScore: number;
  deltaTrizado: number;
  deltaQuebrado: number;
  parametros: {
    modalidadPases: string;
    presionVaporBar: number;
    tempVaporC: number;
    tiempoVaporMin: number;
    tiempoReposoMin: number;
    rpm: number;
    secadoMetodo: string;
    tempSecadoC: number;
    tiempoSecadoMin: number;
  };
  recomendacionesUso: string;
  fechaCreacion: string;
  creadoPor: string;
}

export interface FormatoRegistroVaporizado {
  id: string;
  fecha: string;
  turno: string;
  analista: string;

  // 1. DESCRIPCION DE LA MUESTRA
  batchNumero: string; // ej: 1664 o V272
  codigo: string; // ej: 7568-7579-7598-7684
  fechaMuestra?: string; // ej: 24/08
  anejadora?: string | number; // ej: 2
  maquila?: string; // ej: 2853 / 2963
  tipoVaporizado: string; // ej: Presecado / Añejamiento
  cliente: string; // ej: Chiroque Santamaria Felipe / Propio
  variedad: string; // ej: Santa Cruz o Valor
  procedencia: string; // ej: Mochumí o Punto 4
  numeroSacos: number; // ej: 372
  temperaturaGrano?: number; // ej: 28.1 °C
  temperaturaAmbiente?: number; // ej: 34.2 °C
  humedadRelativa?: number; // ej: 52 %
  desviacionHumedad?: { max?: number; min?: number };
  humedadMuestra?: { max?: number; min?: number };

  // 2. ANALISIS FISICO (MATERIA PRIMA / DESCARGA / PILADO / REPROCESO)
  reposoCascaraDias?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  reposoBlancoDias?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  humedadCascaraPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  humedadBlancoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  quebradoIntegralPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  quebradoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  blancuraIntegralKett?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  blancuraBlancoKett?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  trizadoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  cuarteadoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  tizaTotalMasGcocidoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  tpMasTpuntualPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  manchaPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  granoInmaduroPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  granoVerdePct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };
  granoRojoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };

  // 3. COCCION (DOSIFICACION) - MATERIA PRIMA vs DESCARGA vs REPROCESO
  tazasArroz: number; // ej: 3
  tazasAgua: string | number; // ej: 3 1/2
  tiempoCoccionMin: number; // ej: 30
  dosificacion?: {
    tazasArroz?: { materiaPrima?: number; descarga?: number; reproceso?: number };
    tazasAgua?: { materiaPrima?: string | number; descarga?: string | number; reproceso?: string | number };
    tiempoCoccionMin?: { materiaPrima?: number; descarga?: number; reproceso?: number };
  };

  // 4. ANALISIS ORGANOLEPTICO (MATERIA PRIMA / DESCARGA / PILADO / REPROCESO)
  sabor?: { materiaPrima?: string; descarga?: string; pilado?: string; reproceso?: string };
  desplazamientoSeg?: { materiaPrima?: string | number; descarga?: string | number; pilado?: string | number; reproceso?: string | number }; // ej: MP 44.6, Descarga 12.6
  granoQuebradoOllaPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number }; // ej: MP 9.1, Descarga 8.1
  granoHinchadoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number }; // ej: MP 9.5, Descarga 3.1
  granoAbiertoPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number }; // ej: MP 1.6, Descarga 1.4
  pegoteo?: { materiaPrima?: string; descarga?: string; pilado?: string; reproceso?: string }; // ej: Sin pegoteo
  texturaFrio?: { materiaPrima?: string; descarga?: string; pilado?: string; reproceso?: string }; // ej: Suave / Firme
  rendimientoMasaPct?: { materiaPrima?: number; descarga?: number; pilado?: number; reproceso?: number };

  // ENVASE PROYECTADO (SE EVALUA EN COCCION)
  envaseProyectado?: string; // ej: Saco 50 kg Don Julio Extra Selección
  dictamenEnvasado?: string; // ej: CONFORME PARA ENVASADO
  justificacionEnvase?: string;

  // 5. OBSERVACIONES
  observaciones?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResultadoCoccionExterno {
  id: string;
  batchId?: string;
  correlativo?: string;
  loteId?: string;
  proceso: "VAPORIZADO" | "AÑEJADO" | string;
  fechaCoccion: string;
  turno?: string;
  panelista?: string;
  cliente?: string;
  variedad?: string;
  procedencia?: string;
  numeroSacos?: number;
  tipoVaporizado?: string; // ej: Presecado
  anejadora?: string | number; // ej: 2
  maquila?: string; // ej: 2853 / 2963
  temperaturaGrano?: number; // ej: 28.1 °C
  temperaturaAmbiente?: number; // ej: 34.2 °C
  humedadRelativa?: number; // ej: 52 %
  desviacionHumedad?: number;
  humedadMax?: number;
  humedadMin?: number;

  // Resumen Sintético de Variables de Cocción:
  // 1. Dosificación
  tazasArroz?: number; // ej: 3
  tazasAgua?: string | number; // ej: "3 1/2"
  tiempoCoccionMin: number | string; // ej: 30 min
  tazasArrozMP?: number;
  tazasArrozDescarga?: number;
  tazasAguaMP?: string | number;
  tazasAguaDescarga?: string | number;
  tiempoCoccionMinMP?: number | string;
  tiempoCoccionMinDescarga?: number | string;

  // 2. Evaluación de Grano Cocido
  sabor?: string; // ej: "Neutro Característico"
  desplazamientoSeg?: string | number; // ej: 15 seg
  granoQuebradoOllaPct?: number; // % Grano Quebrado (ej: 18.0%)
  granoHinchadoPct?: number; // % Grano Hinchado (ej: 8.6%)
  granoAbiertoPct?: number; // % Grano Abierto (ej: 1.3%)
  texturaFrio?: string; // Textura al Frío (ej: "Suave", "Firme al dente")
  pegoteoMP?: string;
  pegoteoDescarga?: string;

  // 3. Envase Proyectado (se evalúa en cocción)
  envaseProyectado?: string; // ej: "Saco 50 kg Extra", "Bolsa 5 kg Superior"
  dictamenEnvasado?: string;
  justificacionEnvase?: string;

  ratioAguaArroz?: string;
  expansionVolumetrica?: string;
  solturaGrano?: string;
  texturaFirmeza?: string;
  colorCocido?: string;
  aromaSabor?: string;
  rendimientoMasaPct?: number;

  // Organoléptico en 3 Columnas (Materia Prima | Descarga | Pilado)
  saborMP?: string;
  saborDescarga?: string;
  saborPilado?: string;
  desplazamientoMP?: string | number;
  desplazamientoDescarga?: string | number;
  desplazamientoPilado?: string | number;
  quebradoOllaMP?: number;
  quebradoOllaDescarga?: number;
  quebradoOllaPilado?: number;
  hinchadoMP?: number;
  hinchadoDescarga?: number;
  hinchadoPilado?: number;
  abiertoMP?: number;
  abiertoDescarga?: number;
  abiertoPilado?: number;
  texturaFrioMP?: string;
  texturaFrioDescarga?: string;
  texturaFrioPilado?: string;

  // Físico MP vs Descarga vs Pilado
  reposoCascaraDias?: number;
  reposoBlancoDias?: number;
  reposoCascaraPilado?: number;
  reposoBlancoPilado?: number;

  humedadCascaraMP?: number;
  humedadCascaraDescarga?: number;
  humedadCascaraPilado?: number;
  humedadBlancoMP?: number;
  humedadBlancoDescarga?: number;
  humedadBlancoPilado?: number;

  trizadoMP?: number;
  trizadoDescarga?: number;
  trizadoPilado?: number;
  deltaTrizado?: number;

  cuarteadoMP?: number;
  cuarteadoDescarga?: number;
  cuarteadoPilado?: number;

  quebradoIntegralMP?: number;
  quebradoIntegralDescarga?: number;
  quebradoIntegralPilado?: number;

  quebradoMP?: number;
  quebradoDescarga?: number;
  quebradoPilado?: number;
  deltaQuebrado?: number;

  blancuraIntegralMP?: number;
  blancuraIntegralDescarga?: number;
  blancuraIntegralPilado?: number;

  blancuraBlancoMP?: number;
  blancuraBlancoDescarga?: number;
  blancuraBlancoPilado?: number;

  tizaTotalMasGcocidoMP?: number;
  tizaTotalMasGcocidoDescarga?: number;
  tizaTotalMasGcocidoPilado?: number;

  tpMasTpuntualMP?: number;
  tpMasTpuntualDescarga?: number;
  tpMasTpuntualPilado?: number;

  manchaMP?: number;
  manchaDescarga?: number;
  manchaPilado?: number;

  granoInmaduroMP?: number;
  granoInmaduroDescarga?: number;
  granoInmaduroPilado?: number;

  granoVerdeMP?: number;
  granoVerdeDescarga?: number;
  granoVerdePilado?: number;

  granoRojoMP?: number;
  granoRojoDescarga?: number;
  granoRojoPilado?: number;

  puntajeCoccion: number;
  observaciones?: string;
  fuenteExterna?: string;
  estadoIntegracion?: "INTEGRADO" | "DESCARTADO_POR_PROCESO" | "PENDIENTE";
  rawOriginal?: any;
}

export interface ConfigConexionCoccion {
  apiUrl?: string;
  apiKey?: string;
  tipoConexion: "webhook" | "api_rest" | "sheets" | "manual";
  autoSync: boolean;
  intervaloMinutos?: number;
  ultimaSincronizacion?: string;
  filtroProcesoExclusivo: string; // "VAPORIZADO"
}

// ==========================================
// BITÁCORA INDUSTRIAL: SÁBANA DE BATCHES TRABAJADOS (PARÁMETROS DE TRABAJO, SALIDA E INCREMENTOS)
// ==========================================
export interface HistorialBatchTrabajado {
  id: string; // ej: "313", "314", ...
  tipoProceso: "PRESECADO" | "HUMEDO" | "SECO" | string;
  batch: string | number; // 313, 314, ...
  variedad: string; // VALOR, FERON, SANTA CRUZ, PAKAMURO, etc.
  
  // PARÁMETROS DE INGRESO
  hi?: number | null; // Humedad de Ingreso (%)
  riPct?: number | null; // % Rendimiento Integral
  rbPct?: number | null; // % Rendimiento Blanco
  qPct?: number | null; // % Quebrado Ingreso
  ttPct?: number | null; // % Trizado Total
  pPct?: number | null; // % Panza Blanca / Puntas
  mPct?: number | null; // % Manchado
  tzPct?: number | null; // % Tiza
  giPct?: number | null; // % Grano Inmaduro
  gVerdePct?: number | null; // % Grano Verde
  blIPct?: number | null; // % Blancura Integral
  blPPct?: number | null; // % Blancura Pulido
  remPct?: number | null; // % Remanente
  ausenciaAnalisis?: boolean;

  // PRIMER PASE
  pres1Bar?: number | null; // Presión vapor pase 1 (bar)
  rpm1?: number | null; // Velocidad de exclusa pase 1 (rpm)
  tReposo1Min?: number | null; // Tiempo de reposo pase 1 (min)
  tk1_1?: string | null; // TK1 temperaturas (ej: 55/56/57)
  tk1_2?: string | null; // TK2 temperaturas
  tk1_3?: string | null; // TK3 temperaturas
  tk1_4?: string | null; // TK4 temperaturas
  gHum1?: number | null; // Gradiente de humedad pase 1
  incQ1?: number | null; // Incremento de quebrado pase 1 (%)
  triz1?: number | null; // Trizado pase 1 (%)

  // SEGUNDO PASE
  pres2Bar?: number | null; // Presión vapor pase 2 (bar)
  rpm2?: number | null; // Velocidad de exclusa pase 2 (rpm)
  tReposo2Min?: number | null; // Tiempo de reposo pase 2 (min)
  tk2_1?: string | null;
  tk2_2?: string | null;
  tk2_3?: string | null;
  tk2_4?: string | null;
  gHum2?: number | null;
  incQ2?: number | null; // Incremento acumulado de quebrado (%)
  triz2?: number | null;

  // RESULTADO DE COCCION
  pesoCoccion?: string | number | null; // Peso gramos (ej: 0.446, 1.290, 0.448/1.280)
  quebradoCoccionPct?: number | null; // Quebrado en olla (%)
  abiertoCoccionPct?: number | null; // Grano abierto (%)
  hinchadoCoccionPct?: number | null; // Grano hinchado (%)
  desplazamientoCoccionSeg?: number | null; // Segundos de desplazamiento (soltura)

  // Metadatos de desempeño
  puntajeExito?: number; // 0 a 100
  esMasExitoso?: boolean; // medalla dorada
  notasExito?: string;
}

export interface RecomendacionRecetaIngreso {
  variedadBuscada: string;
  humedadIngresoBuscada: number;
  tipoProcesoEstimado: "PRESECADO" | "HUMEDO" | "SECO";
  batchReferencia: HistorialBatchTrabajado;
  puntajeCoincidencia: number;
  
  // Parámetros Recomendados de Trabajo
  presionPase1Bar: number;
  rpmExclusaPase1: number;
  tiempoReposoPase1Min: number;
  requiereSegundoPase: boolean;
  presionPase2Bar?: number;
  rpmExclusaPase2?: number;
  tiempoReposoPase2Min?: number;

  // Justificación técnica industrial
  analisisPresion: string;
  analisisVelocidadExclusa: string;
  analisisTiempoReposo: string;
  prediccionIncrementoQuebrado: string;
  prediccionCoccion: string;
  consejosOperador: string[];
}

