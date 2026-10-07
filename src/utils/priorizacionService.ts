import { 
  Lote, 
  AnalisisHumedo, 
  PriorizacionMasterConfig, 
  PriorizacionLote, 
  NivelRiesgoLote, 
  ParametroDetallePrioridad,
  RangoHumedadPrioridad,
  HistorialPuntuacionLote
} from "../types";
import { parseOrganoleptico, verificarAptitudProgramacionLote } from "./evaluacionCalidad";
import { esLotePendiente } from "./loteClassification";

// ==========================================
// CONFIGURACIÓN MAESTRA PREDETERMINADA
// (Valores oficiales estipulados por el usuario)
// ==========================================

export const CONFIG_PRIORIZACION_DEFAULT: PriorizacionMasterConfig = {
  rangosHumedad: [
    { id: "R-1", etiqueta: "Menos de 14%", minHum: 0, maxHum: 14.0, prioridadPct: 62, diasResistencia: 30, descripcion: "Humedad de almacenamiento segura (≥30 días)" },
    { id: "R-2", etiqueta: "15–16%", minHum: 14.01, maxHum: 16.99, prioridadPct: 65, diasResistencia: 30, descripcion: "Humedad moderada, resistencia hasta 30 días" },
    { id: "R-3", etiqueta: "17–18%", minHum: 17.0, maxHum: 18.99, prioridadPct: 68, diasResistencia: 20, descripcion: "Humedad media-alta, resistencia hasta 20 días" },
    { id: "R-4", etiqueta: "19–20%", minHum: 19.0, maxHum: 20.99, prioridadPct: 71, diasResistencia: 12, descripcion: "Humedad alta, resistencia hasta 12 días" },
    { id: "R-5", etiqueta: "21–23%", minHum: 21.0, maxHum: 23.99, prioridadPct: 76, diasResistencia: 5, descripcion: "Humedad crítica, resistencia hasta 5 días" },
    { id: "R-6", etiqueta: "24–26%", minHum: 24.0, maxHum: 26.99, prioridadPct: 81, diasResistencia: 2, descripcion: "Humedad muy crítica, resistencia hasta 2 días" },
    { id: "R-7", etiqueta: "27% o más", minHum: 27.0, maxHum: 100.0, prioridadPct: 86, diasResistencia: 1, descripcion: "Humedad extrema, resistencia máxima 1 día" }
  ],
  organolepticos: {
    palote: { poco: 1, regularVarBast: 2 },
    vano: { poco: 1, regularVarBast: 2 },
    impureza: { poco: 1, regularVarBast: 2 },
    plaga: { poco: 4, regularVarBast: 3 },
    olor: { poco: 3, regularVarBast: 3 },
    falsoCarbon: { poco: 2, regularVarBast: 3 },
    hongo: { poco: 2, regularVarBast: 3 }
  },
  rangosRiesgo: {
    bajoMax: 84, // < 84
    medioMin: 85,
    medioMax: 89,
    altoMin: 90,
    altoMax: 95,
    emergenciaMin: 96 // >= 96
  },
  formula: "HUMEDAD_BASE + SUMA_ORGANOLEPTICOS"
};

const STORAGE_KEY_CONFIG = "molino_priorizacion_master_config_v1";
const STORAGE_KEY_OVERRIDES = "molino_priorizacion_manual_overrides_v1";
const STORAGE_KEY_HISTORY = "molino_priorizacion_history_v1";

// Carga configuración persistente o usa default
export function cargarConfiguracionPriorizacion(): PriorizacionMasterConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.rangosHumedad && parsed.organolepticos && parsed.rangosRiesgo) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error cargando config de priorización desde storage, usando default", e);
  }
  return CONFIG_PRIORIZACION_DEFAULT;
}

export function guardarConfiguracionPriorizacion(cfg: PriorizacionMasterConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
  } catch (e) {
    console.error("Error guardando config de priorización", e);
  }
}

// ==========================================
// CÁLCULO DE DÍAS TRANSCURRIDOS
// ==========================================
export function calcularDiasTranscurridos(fechaIngresoStr: string, fechaActualStr?: string): number {
  if (!fechaIngresoStr) return 0;
  
  try {
    const fechaIngreso = new Date(fechaIngresoStr + "T00:00:00");
    const fechaRef = fechaActualStr ? new Date(fechaActualStr + "T00:00:00") : new Date();
    
    // Diferencia en milisegundos convertida a días enteros
    const diffTime = fechaRef.getTime() - fechaIngreso.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

// ==========================================
// EVALUACIÓN DE PARÁMETRO ORGANOLÉPTICO INDIVIDUAL
// ==========================================
export function evaluarParametroOrganoleptico(
  nombre: string,
  abreviatura: string,
  valor: unknown,
  configPuntos: { poco: number; regularVarBast: number }
): ParametroDetallePrioridad {
  const parsed = parseOrganoleptico(valor);
  const code = parsed.code;
  
  let clasificacion: "POCO" | "REGULAR_VAR_BASTANTE" | "OTRO" = "POCO";
  let puntos = configPuntos.poco;

  if (code === "N" || code === "P") {
    clasificacion = "POCO";
    puntos = configPuntos.poco;
  } else if (code === "R" || code === "V" || code === "B") {
    clasificacion = "REGULAR_VAR_BASTANTE";
    puntos = configPuntos.regularVarBast;
  } else {
    // Si viene como número
    const num = parsed.num;
    if (num !== undefined && num > 0.5) {
      clasificacion = "REGULAR_VAR_BASTANTE";
      puntos = configPuntos.regularVarBast;
    } else {
      clasificacion = "POCO";
      puntos = configPuntos.poco;
    }
  }

  return {
    parametro: nombre,
    abreviatura,
    valorOriginal: parsed.label || String(valor ?? "P"),
    clasificacion,
    puntos
  };
}

// ==========================================
// CÁLCULO DE PRIORIDAD PARA UN LOTE
// ==========================================
export function calcularPrioridadLote(
  lote: Lote,
  analisis?: AnalisisHumedo,
  config: PriorizacionMasterConfig = CONFIG_PRIORIZACION_DEFAULT,
  fechaReferencia?: string
): PriorizacionLote {
  // 1. Humedad real (preferir del análisis húmedo si existe, o del lote)
  const humedad = analisis?.HUMEDADES !== undefined && Number(analisis.HUMEDADES) > 0 
    ? Number(analisis.HUMEDADES) 
    : Number(lote.HUM || 14.0);

  // 2. Buscar rango de humedad y días de resistencia
  let rangoEncontrado: RangoHumedadPrioridad | undefined;
  for (const r of config.rangosHumedad) {
    if (humedad >= r.minHum && humedad <= r.maxHum) {
      rangoEncontrado = r;
      break;
    }
  }
  if (!rangoEncontrado) {
    if (humedad < 14) rangoEncontrado = config.rangosHumedad[0];
    else rangoEncontrado = config.rangosHumedad[config.rangosHumedad.length - 1];
  }

  const prioridadBaseHumedad = rangoEncontrado.prioridadPct;
  const diasResistencia = rangoEncontrado.diasResistencia;

  // 3. Días transcurridos y restantes
  const diasTranscurridos = calcularDiasTranscurridos(lote.FECHA_INGRESO, fechaReferencia);
  const diasRestantes = diasResistencia - diasTranscurridos;

  // 4. Parámetros organolépticos con sus puntos
  const palote = evaluarParametroOrganoleptico("PALOTE", "PALT", analisis?.PALOTE, config.organolepticos.palote);
  const vano = evaluarParametroOrganoleptico("VANO", "VN", analisis?.VANO, config.organolepticos.vano);
  const impureza = evaluarParametroOrganoleptico("IMPUREZA", "IMP.", analisis?.IMPUREZS, config.organolepticos.impureza);
  const plaga = evaluarParametroOrganoleptico("PLAGA", "PLAG.", analisis?.["PLAGAS-NSEC."] || analisis?.["PLAGAS-INSEC."], config.organolepticos.plaga);
  const olor = evaluarParametroOrganoleptico("OLOR", "OL", analisis?.OLOR, config.organolepticos.olor);
  const falsoCarbon = evaluarParametroOrganoleptico("FALSO CARBÓN", "F. CARB.", analisis?.["F. CARBON"], config.organolepticos.falsoCarbon);
  const hongo = evaluarParametroOrganoleptico("HONGO", "HON.", analisis?.HONGO, config.organolepticos.hongo);

  const sumaOrganolepticos = 
    palote.puntos + 
    vano.puntos + 
    impureza.puntos + 
    plaga.puntos + 
    olor.puntos + 
    falsoCarbon.puntos + 
    hongo.puntos;

  // 5. Puntuación Final
  const puntuacionFinal = prioridadBaseHumedad + sumaOrganolepticos;

  // 6. Regla de Emergencia y Clasificación de Riesgo
  // REGLA CRÍTICA: Si un lote cumple o supera sus días máximos de resistencia (diasTranscurridos >= diasResistencia o diasRestantes <= 0)
  // pasa automáticamente a EMERGENCIA con máxima prioridad.
  let esEmergencia = false;
  let motivoEmergencia: string | undefined = undefined;
  let nivelRiesgo: NivelRiesgoLote = "BAJO";

  if (diasRestantes <= 0 || diasTranscurridos >= diasResistencia) {
    esEmergencia = true;
    nivelRiesgo = "EMERGENCIA";
    motivoEmergencia = `Límite de resistencia alcanzado o superado (${diasTranscurridos} días transcurridos vs ${diasResistencia} días permitidos para ${humedad}% humedad).`;
  } else if (puntuacionFinal >= config.rangosRiesgo.emergenciaMin) {
    esEmergencia = true;
    nivelRiesgo = "EMERGENCIA";
    motivoEmergencia = `Puntuación de riesgo extrema (${puntuacionFinal} pts ≥ ${config.rangosRiesgo.emergenciaMin}).`;
  } else if (puntuacionFinal >= config.rangosRiesgo.altoMin) {
    nivelRiesgo = "ALTO";
  } else if (puntuacionFinal >= config.rangosRiesgo.medioMin) {
    nivelRiesgo = "MEDIO";
  } else {
    nivelRiesgo = "BAJO";
  }

  // 7. Generar recomendación explicativa automática
  let recomendacion = "";
  if (esEmergencia) {
    recomendacion = `⚠️ LOTE EN EMERGENCIA: ${motivoEmergencia} Debe programarse de inmediato para evitar fermentación y pérdida de rendimiento en vaporizado.`;
  } else if (nivelRiesgo === "ALTO") {
    recomendacion = `Este lote debe ser priorizado urgentemente debido a que presenta ${diasRestantes} día(s) restante(s) de resistencia y una puntuación de riesgo de ${puntuacionFinal} pts.`;
  } else if (nivelRiesgo === "MEDIO") {
    recomendacion = `Este lote presenta riesgo medio con ${diasRestantes} días restantes de resistencia y ${puntuacionFinal} pts. Monitorear tolva y programar en los siguientes turnos.`;
  } else {
    recomendacion = `Lote en condición estable. Tiene ${diasRestantes} días restantes de resistencia (puntuación: ${puntuacionFinal} pts) y no requiere atención inmediata.`;
  }

  const desgloseFormula = `Prioridad Humedad (${rangoEncontrado.etiqueta}: ${prioridadBaseHumedad} pts) + Palote (+${palote.puntos}) + Vano (+${vano.puntos}) + Impureza (+${impureza.puntos}) + Plaga (+${plaga.puntos}) + Olor (+${olor.puntos}) + Falso Carbón (+${falsoCarbon.puntos}) + Hongo (+${hongo.puntos}) = ${puntuacionFinal} pts`;

  const pesoKg = lote.PESO_KG || (lote.SACOS ? lote.SACOS * 50 : 25000);
  const sacos = lote.SACOS || Math.round(pesoKg / 50);
  const pesoTn = Number((pesoKg / 1000).toFixed(2));

  // Obtener aptitud de calidad del lote
  const aptitud = verificarAptitudProgramacionLote(lote, analisis);
  const estadoCalidad = (aptitud.estadoMacro === "APROBADO" || aptitud.estadoMacro === "OBSERVADO" || aptitud.estadoMacro === "EXPERIMENTAL")
    ? aptitud.estadoMacro
    : undefined;

  return {
    posicion: 0,
    posicionOriginal: 0,
    loteId: lote.LOTE_ID,
    lote,
    cliente: lote.CLIENTE || "Sin Cliente",
    zona: lote.ZONA || "Sin Zona",
    variedad: lote.VARIEDAD || "Sin Variedad",
    sacos,
    pesoKg,
    pesoTn,
    humedad,
    fechaIngreso: lote.FECHA_INGRESO || new Date().toISOString().split("T")[0],
    diasTranscurridos,
    diasResistencia,
    diasRestantes,
    palote,
    vano,
    impureza,
    plaga,
    olor,
    falsoCarbon,
    hongo,
    prioridadBaseHumedad,
    rangoHumedadEtiqueta: rangoEncontrado.etiqueta,
    puntosOrganolepticos: sumaOrganolepticos,
    puntuacionFinal,
    nivelRiesgo,
    esEmergencia,
    motivoEmergencia,
    estadoLote: lote.ESTADO_LOTE || "INGRESADO",
    estadoCalidad,
    porcentajeCalidad: aptitud.porcentajeAprobacion,
    badgeCalidadClass: aptitud.badgeClass,
    labelCalidad: aptitud.label,
    recomendacion,
    desgloseFormula
  };
}

// ==========================================
// ORDENAMIENTO AUTOMÁTICO DE PROGRAMACIÓN
// (1. EMERGENCIA, 2. ALTO, 3. MEDIO, 4. BAJO)
// Dentro de categoría: Puntuación desc -> Días restantes asc -> Fecha ingreso asc
// ==========================================
export function ordenarLotesPorPrioridad(items: PriorizacionLote[]): PriorizacionLote[] {
  const jerarquiaRiesgo: Record<NivelRiesgoLote, number> = {
    EMERGENCIA: 4,
    ALTO: 3,
    MEDIO: 2,
    BAJO: 1
  };

  return [...items].sort((a, b) => {
    // 1. Nivel de Riesgo (EMERGENCIA > ALTO > MEDIO > BAJO)
    const riesgoDiff = jerarquiaRiesgo[b.nivelRiesgo] - jerarquiaRiesgo[a.nivelRiesgo];
    if (riesgoDiff !== 0) return riesgoDiff;

    // 2. Puntuación de mayor a menor
    const scoreDiff = b.puntuacionFinal - a.puntuacionFinal;
    if (scoreDiff !== 0) return scoreDiff;

    // 3. Menor cantidad de días restantes de resistencia (más urgente primero)
    const diasDiff = a.diasRestantes - b.diasRestantes;
    if (diasDiff !== 0) return diasDiff;

    // 4. Fecha de ingreso más antigua primero
    return (a.fechaIngreso || "").localeCompare(b.fechaIngreso || "");
  }).map((item, idx) => ({
    ...item,
    posicion: idx + 1,
    posicionOriginal: idx + 1
  }));
}

// ==========================================
// CÁLCULO MASIVO PARA LOTES PENDIENTES DE PROCESO
// (Priorización exclusiva sobre lotes APROBADOS, OBSERVADOS o EXPERIMENTALES)
// ==========================================
export function calcularPrioridadesLotes(
  lotes: Lote[],
  analisisHumedos: AnalisisHumedo[] = [],
  config: PriorizacionMasterConfig = CONFIG_PRIORIZACION_DEFAULT,
  fechaReferencia?: string,
  soloPendientes: boolean = true,
  soloAptosCalidad: boolean = true
): PriorizacionLote[] {
  // 1. Filtrar exclusivamente lotes pendientes si soloPendientes es true
  let lotesAProcesar = soloPendientes ? lotes.filter(l => esLotePendiente(l)) : lotes;

  // 2. REGLA ESTRICTA: Solo deben aparecer lotes APROBADOS (APTOS), OBSERVADOS y EXPERIMENTALES.
  // Los lotes DESAPROBADOS, RECHAZADOS o NO APTOS no ingresan a la priorización ni a la programación.
  if (soloAptosCalidad) {
    lotesAProcesar = lotesAProcesar.filter((lote) => {
      const ah = analisisHumedos.find((a) => a.LOTE_ID === lote.LOTE_ID);
      const aptitud = verificarAptitudProgramacionLote(lote, ah);
      return (
        aptitud.esProgramable &&
        (aptitud.estadoMacro === "APROBADO" ||
          aptitud.estadoMacro === "OBSERVADO" ||
          aptitud.estadoMacro === "EXPERIMENTAL")
      );
    });
  }

  const calculados = lotesAProcesar.map((lote) => {
    const ah = analisisHumedos.find((a) => a.LOTE_ID === lote.LOTE_ID);
    return calcularPrioridadLote(lote, ah, config, fechaReferencia);
  });

  return ordenarLotesPorPrioridad(calculados);
}
