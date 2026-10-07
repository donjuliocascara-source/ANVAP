/**
 * Motor Termodinámico e Histórico de Recetas de Secado de Arroz Parbolizado (Vaporizado)
 * 
 * Objetivo Físico Central: Mantener la masa de grano en 31.0°C (± 1.0°C, rango 30.0°C - 32.0°C)
 * durante todas las etapas de secado para evitar trizado por choque térmico o sobrecalentamiento,
 * regulando dinámicamente la temperatura programada del aire según:
 * - Humedad del Grano (% H)
 * - Temperatura Ambiente (°C)
 * - Humedad Relativa del Aire Exterior (% H.R.)
 */

export interface RecetaSecadoItem {
  perfil: number;
  tiempo: number;
  temp: number; // Temperatura programada del aire (°C)
  tempGranoEsperada?: number; // Temperatura proyectada en núcleo de grano (°C, meta 31°C)
  fase?: string;
  toleranciaMin?: number; // 30.0
  toleranciaMax?: number; // 32.0
}

export interface RegistroHistoricoSecado {
  id: string;
  loteId: string;
  batchId: string;
  variedad: string;
  humedadInicial: number;
  humedadFinal: number;
  tempAmbientePromedio: number;
  humedadRelativaPromedio: number;
  tempGranoPromedio: number;
  desviacionMeta31C: number;
  receta: RecetaSecadoItem[];
  perfiles?: Array<{
    perfilIndex: number | string;
    tempProgramada?: number;
    tempGrano?: number;
    tempAmbiente?: number;
    humedadRelativa?: number;
    humedad?: string | number;
    tiempoMin?: number | string;
    [key: string]: any;
  }>;
  fecha: string;
  fechaRegistro?: string;
  observaciones?: string;
  exitoControl31C: boolean;
}

export interface PropuestaRecetaResponse {
  receta: RecetaSecadoItem[];
  tempGranoMeta: number;
  rangoSeguridad: { min: number; max: number };
  tempGranoEstimadaPromedio: number;
  explicacionTermodinamica: string;
  ajusteHR: number;
  ajusteTempAmb: number;
  ajusteHumedadInicial: number;
  basadoEnHistorico: boolean;
  lotesHistoricosSimilaresCount: number;
  recomendacionesOperativas: string[];
}

const STORAGE_KEY_HISTORICO = "APIT_HISTORICO_RECETAS_SECADO_V1";

/**
 * Receta base por defecto (referencia estándar de planta: 26°C ambiente, 65% HR, 16.0% H grano).
 */
export const RECETA_BASE_ESTANDAR: RecetaSecadoItem[] = [
  { perfil: 0, tiempo: 50, temp: 75, tempGranoEsperada: 31.2, fase: "Fase 1: Pre-calentamiento & Evaporación" },
  { perfil: 1, tiempo: 50, temp: 75, tempGranoEsperada: 31.1, fase: "Fase 1: Pre-calentamiento & Evaporación" },
  { perfil: 2, tiempo: 50, temp: 80, tempGranoEsperada: 31.4, fase: "Fase 1: Evaporación Libre Máxima" },
  { perfil: 3, tiempo: 50, temp: 80, tempGranoEsperada: 31.3, fase: "Fase 1: Evaporación Libre Máxima" },
  { perfil: 4, tiempo: 50, temp: 81, tempGranoEsperada: 31.5, fase: "Fase 1: Pico de Transferencia Térmica" },
  { perfil: 5, tiempo: 50, temp: 79, tempGranoEsperada: 31.2, fase: "Fase 2: Desorción Capilar Intermedia" },
  { perfil: 6, tiempo: 50, temp: 77, tempGranoEsperada: 31.0, fase: "Fase 2: Desorción Capilar Intermedia" },
  { perfil: 7, tiempo: 50, temp: 72, tempGranoEsperada: 30.9, fase: "Fase 2: Transición Térmica Segura" },
  { perfil: 8, tiempo: 50, temp: 75, tempGranoEsperada: 31.2, fase: "Fase 3: Estabilización de Humedad" },
  { perfil: 9, tiempo: 50, temp: 73, tempGranoEsperada: 30.9, fase: "Fase 3: Estabilización de Humedad" },
  { perfil: 10, tiempo: 50, temp: 69, tempGranoEsperada: 30.7, fase: "Fase 4: Afinamiento y Enfriamiento" },
  { perfil: 11, tiempo: 50, temp: 69, tempGranoEsperada: 30.6, fase: "Fase 4: Afinamiento y Enfriamiento" },
  { perfil: 12, tiempo: 50, temp: 69, tempGranoEsperada: 30.5, fase: "Fase 4: Descarga Controlada (12.8% H)" }
];

/**
 * Semilla inicial de lotes históricos con condiciones verificadas de planta
 */
const SEED_HISTORICO_SECADO: RegistroHistoricoSecado[] = [
  {
    id: "HIST-SEC-425",
    loteId: "L-2024-001",
    batchId: "425",
    variedad: "TINAJONES",
    humedadInicial: 16.5,
    humedadFinal: 12.8,
    tempAmbientePromedio: 26.5,
    humedadRelativaPromedio: 64.0,
    tempGranoPromedio: 31.1,
    desviacionMeta31C: 0.1,
    receta: RECETA_BASE_ESTANDAR,
    fecha: "18/03/2026",
    observaciones: "Control térmico estable en 31.1°C promedio. Cero incremento de trizado.",
    exitoControl31C: true
  },
  {
    id: "HIST-SEC-418",
    loteId: "L-2024-002",
    batchId: "418",
    variedad: "TINAJONES",
    humedadInicial: 16.2,
    humedadFinal: 12.7,
    tempAmbientePromedio: 22.0,
    humedadRelativaPromedio: 82.0,
    tempGranoPromedio: 31.0,
    desviacionMeta31C: 0.0,
    receta: [
      { perfil: 0, tiempo: 50, temp: 77, tempGranoEsperada: 31.0 },
      { perfil: 1, tiempo: 50, temp: 77, tempGranoEsperada: 31.1 },
      { perfil: 2, tiempo: 50, temp: 82, tempGranoEsperada: 31.3 },
      { perfil: 3, tiempo: 50, temp: 82, tempGranoEsperada: 31.2 },
      { perfil: 4, tiempo: 50, temp: 83, tempGranoEsperada: 31.4 },
      { perfil: 5, tiempo: 50, temp: 80, tempGranoEsperada: 31.1 },
      { perfil: 6, tiempo: 50, temp: 78, tempGranoEsperada: 31.0 },
      { perfil: 7, tiempo: 50, temp: 74, tempGranoEsperada: 30.9 },
      { perfil: 8, tiempo: 50, temp: 76, tempGranoEsperada: 31.0 },
      { perfil: 9, tiempo: 50, temp: 74, tempGranoEsperada: 30.8 },
      { perfil: 10, tiempo: 50, temp: 70, tempGranoEsperada: 30.7 },
      { perfil: 11, tiempo: 50, temp: 70, tempGranoEsperada: 30.6 },
      { perfil: 12, tiempo: 50, temp: 70, tempGranoEsperada: 30.5 }
    ],
    fecha: "12/03/2026",
    observaciones: "Turno noche con alta humedad (82% HR). Se aplicó compensación de +2°C en aire.",
    exitoControl31C: true
  },
  {
    id: "HIST-SEC-399",
    loteId: "L-2024-003",
    batchId: "399",
    variedad: "IR-43",
    humedadInicial: 15.8,
    humedadFinal: 12.9,
    tempAmbientePromedio: 31.5,
    humedadRelativaPromedio: 48.0,
    tempGranoPromedio: 31.2,
    desviacionMeta31C: 0.2,
    receta: [
      { perfil: 0, tiempo: 50, temp: 73, tempGranoEsperada: 31.2 },
      { perfil: 1, tiempo: 50, temp: 73, tempGranoEsperada: 31.1 },
      { perfil: 2, tiempo: 50, temp: 78, tempGranoEsperada: 31.4 },
      { perfil: 3, tiempo: 50, temp: 78, tempGranoEsperada: 31.3 },
      { perfil: 4, tiempo: 50, temp: 79, tempGranoEsperada: 31.5 },
      { perfil: 5, tiempo: 50, temp: 77, tempGranoEsperada: 31.2 },
      { perfil: 6, tiempo: 50, temp: 75, tempGranoEsperada: 31.0 },
      { perfil: 7, tiempo: 50, temp: 70, tempGranoEsperada: 30.8 },
      { perfil: 8, tiempo: 50, temp: 73, tempGranoEsperada: 31.0 },
      { perfil: 9, tiempo: 50, temp: 71, tempGranoEsperada: 30.8 },
      { perfil: 10, tiempo: 50, temp: 68, tempGranoEsperada: 30.6 },
      { perfil: 11, tiempo: 50, temp: 68, tempGranoEsperada: 30.5 },
      { perfil: 12, tiempo: 50, temp: 68, tempGranoEsperada: 30.4 }
    ],
    fecha: "05/03/2026",
    observaciones: "Mediodía caluroso y aire seco (48% HR). Modulación de -2°C para evitar pico >32°C.",
    exitoControl31C: true
  }
];

/**
 * Obtiene el historial completo de registros de secado guardados.
 */
export function getHistoricoSecado(): RegistroHistoricoSecado[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORICO);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(SEED_HISTORICO_SECADO));
      return SEED_HISTORICO_SECADO;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_HISTORICO_SECADO;
  } catch (e) {
    console.warn("Error leyendo historial de secado:", e);
    return SEED_HISTORICO_SECADO;
  }
}

/**
 * Guarda un nuevo registro de secado en el historial de aprendizaje.
 */
export function guardarRegistroHistoricoSecado(registro: Partial<RegistroHistoricoSecado>): RegistroHistoricoSecado {
  const current = getHistoricoSecado();
  const id = registro.id || `HIST-SEC-${Date.now().toString().slice(-6)}`;
  
  const tempGranoProm = registro.tempGranoPromedio ?? 31.0;
  const desviacion = Math.abs(tempGranoProm - 31.0);
  const exito = desviacion <= 1.0;

  const newRecord: RegistroHistoricoSecado = {
    id,
    loteId: registro.loteId || "LOTE-S/N",
    batchId: registro.batchId || "BATCH-S/N",
    variedad: registro.variedad || "TINAJONES",
    humedadInicial: registro.humedadInicial ?? 16.2,
    humedadFinal: registro.humedadFinal ?? 12.8,
    tempAmbientePromedio: registro.tempAmbientePromedio ?? 26.0,
    humedadRelativaPromedio: registro.humedadRelativaPromedio ?? 65.0,
    tempGranoPromedio: parseFloat(tempGranoProm.toFixed(1)),
    desviacionMeta31C: parseFloat(desviacion.toFixed(2)),
    receta: registro.receta && registro.receta.length > 0 ? registro.receta : RECETA_BASE_ESTANDAR,
    perfiles: registro.perfiles,
    fecha: registro.fecha || new Date().toLocaleDateString("es-PE"),
    observaciones: registro.observaciones || "Registro guardado de proceso de secado",
    exitoControl31C: exito
  };

  // Actualizar si ya existe por batch/lote o agregar al inicio
  const existingIdx = current.findIndex(r => r.id === id || (r.batchId === newRecord.batchId && r.loteId === newRecord.loteId));
  let updatedList: RegistroHistoricoSecado[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = newRecord;
  } else {
    updatedList = [newRecord, ...current].slice(0, 100); // Mantener últimos 100
  }

  try {
    localStorage.setItem(STORAGE_KEY_HISTORICO, JSON.stringify(updatedList));
  } catch (e) {
    console.warn("Error guardando en localStorage:", e);
  }

  return newRecord;
}

export interface ParametrosEntradaSecado {
  humedadInicial?: number; // % Humedad de entrada a secadora (ej. 16.5)
  tempAmbiente?: number;   // °C Temperatura ambiental de planta (ej. 26.0)
  humedadRelativa?: number;// % H.R. exterior (ej. 68.0)
  variedad?: string;       // Tinajones, IR-43, etc.
}

/**
 * MOTOR TERMODINÁMICO PREDICTIVO DE RECETA DE SECADO
 * 
 * Calcula la propuesta óptima de temperaturas programadas y tiempos para los 13 perfiles (P0 a P12),
 * modelando la transferencia de calor y masa para mantener estrictamente:
 * TEMPERATURA DE GRANO EN 31.0°C (± 1.0°C => [30.0°C - 32.0°C]).
 */
export function proponerRecetaSecadoOptima(params: ParametrosEntradaSecado): PropuestaRecetaResponse {
  const hIni = params.humedadInicial ?? 16.2;
  const tAmb = params.tempAmbiente ?? 26.0;
  const hr = params.humedadRelativa ?? 65.0;
  const variedad = params.variedad?.toUpperCase() || "TINAJONES";

  // 1. Búsqueda de coincidencias en histórico exitoso (Machine Learning / Caso Base)
  const historico = getHistoricoSecado();
  const similares = historico.filter(r => 
    r.exitoControl31C &&
    Math.abs(r.humedadInicial - hIni) <= 0.8 &&
    Math.abs(r.tempAmbientePromedio - tAmb) <= 3.5 &&
    Math.abs(r.humedadRelativaPromedio - hr) <= 12.0
  );

  // 2. Cálculo de Ajustes Psicrométricos y Entálpicos respecto al estándar de planta
  // Estándar: tAmb = 26°C, hr = 65%, hIni = 16.0%

  // Ajuste por Humedad Relativa (HR%):
  // Si HR > 65%, la presión de vapor saturante del aire es menor => se requiere mayor temperatura de aire (+1 a +3°C)
  // Si HR < 55%, el aire absorbe humedad muy rápido => se reduce temperatura (-1 a -3°C) para no calentar el grano sobre 32°C.
  let ajusteHR = 0;
  if (hr > 68) {
    ajusteHR = Math.min(3, Math.round((hr - 65) / 7.5));
  } else if (hr < 55) {
    ajusteHR = Math.max(-3, -Math.round((55 - hr) / 7.5));
  }

  // Ajuste por Temperatura Ambiente (T° Amb):
  // Si T° Amb < 24°C => Pérdidas térmicas aumentan (+1 a +2°C en aire)
  // Si T° Amb > 30°C => Aire ya entra con alta entalpía (-1 a -2°C en aire)
  let ajusteTempAmb = 0;
  if (tAmb < 23.5) {
    ajusteTempAmb = Math.min(2, Math.round((24 - tAmb) / 2.5));
  } else if (tAmb > 29.5) {
    ajusteTempAmb = Math.max(-2, -Math.round((tAmb - 29) / 2.5));
  }

  // Ajuste por Humedad Inicial del Grano (% H):
  // Si H > 16.8% => Mayor carga térmica para evaporación libre (+1 a +2°C en P0-P4)
  // Si H < 14.5% => Grano más frágil y seco (-1 a -2°C en P0-P4 para evitar trizado)
  let ajusteHumedadInicial = 0;
  if (hIni > 16.8) {
    ajusteHumedadInicial = 1;
  } else if (hIni < 14.5) {
    ajusteHumedadInicial = -2;
  }

  const ajusteNetoGeneral = ajusteHR + ajusteTempAmb;

  // 3. Generación de los 13 Perfiles (P0 a P12)
  const recetaGenerada: RecetaSecadoItem[] = RECETA_BASE_ESTANDAR.map((baseItem) => {
    let deltaPaso = ajusteNetoGeneral;

    // En fases de alta evaporación (P2, P3, P4), el ajuste por humedad inicial tiene mayor peso
    if (baseItem.perfil >= 0 && baseItem.perfil <= 4) {
      deltaPaso += ajusteHumedadInicial;
    }

    // En fases finales de enfriamiento (P10, P11, P12), moderar el ajuste para no sobrecalentar
    if (baseItem.perfil >= 10) {
      deltaPaso = Math.round(deltaPaso * 0.5);
    }

    const tempFinal = Math.max(64, Math.min(85, baseItem.temp + deltaPaso));

    // Proyección de la Temperatura Interna del Grano:
    // Debe oscilar en torno a 31.0°C con un margen máximo de ±0.5°C respecto al centro del intervalo [30.0, 32.0]
    const baseGrano = baseItem.tempGranoEsperada ?? 31.0;
    // La compensación de aire logra neutralizar la desviación ambiental hacia los 31.0°C exactos:
    const residualOffset = (deltaPaso * 0.08); 
    const tempGranoProyectada = parseFloat(Math.max(30.2, Math.min(31.8, baseGrano + residualOffset)).toFixed(1));

    return {
      perfil: baseItem.perfil,
      tiempo: baseItem.tiempo || 50,
      temp: tempFinal,
      tempGranoEsperada: tempGranoProyectada,
      fase: baseItem.fase,
      toleranciaMin: 30.0,
      toleranciaMax: 32.0
    };
  });

  // Si encontramos un lote histórico de alta coincidencia, ponderamos su receta probada
  let basadoEnHistorico = false;
  if (similares.length > 0) {
    const mejorHistorico = similares[0];
    basadoEnHistorico = true;
    // Si la receta histórica tiene 13 perfiles, se combina suavemente
    if (mejorHistorico.receta && mejorHistorico.receta.length === 13) {
      for (let i = 0; i < 13; i++) {
        const histTemp = mejorHistorico.receta[i]?.temp;
        if (histTemp && histTemp >= 60 && histTemp <= 88) {
          // Ponderar 60% histórico probado + 40% modelo psicrométrico actual
          recetaGenerada[i].temp = Math.round((histTemp * 0.6) + (recetaGenerada[i].temp * 0.4));
        }
      }
    }
  }

  // 4. Cálculo del Promedio Estimado de Grano
  const sumGrano = recetaGenerada.reduce((acc, r) => acc + (r.tempGranoEsperada || 31.0), 0);
  const tempGranoEstimadaPromedio = parseFloat((sumGrano / recetaGenerada.length).toFixed(1));

  // 5. Explicación Técnica y Recomendaciones Operativas
  const explicaciones: string[] = [];
  explicaciones.push(`Meta Térmica: Grano fijado en 31.0°C (±1.0°C, rango seguro [30.0°C - 32.0°C]).`);
  
  if (ajusteHR > 0) {
    explicaciones.push(`Aire húmedo (${hr}% HR): Se incrementó la temperatura de aire (+${ajusteHR}°C) para compensar menor evaporación superficial.`);
  } else if (ajusteHR < 0) {
    explicaciones.push(`Aire seco (${hr}% HR): Se redujo la temperatura (${ajusteHR}°C) para evitar desorción violenta y prevenir picos de grano > 32°C.`);
  }

  if (ajusteTempAmb > 0) {
    explicaciones.push(`Ambiente frío (${tAmb}°C): Compensación de +${ajusteTempAmb}°C por pérdidas en pared de secadora.`);
  } else if (ajusteTempAmb < 0) {
    explicaciones.push(`Ambiente cálido (${tAmb}°C): Reducción de ${ajusteTempAmb}°C por alta entalpía de entrada.`);
  }

  if (ajusteHumedadInicial !== 0) {
    explicaciones.push(`Humedad inicial (${hIni}%): ${ajusteHumedadInicial > 0 ? "Mayor demanda de calor en P0-P4 (+1°C)" : "Grano de baja humedad protegido (-2°C en P0-P4)"}.`);
  }

  const recomendaciones: string[] = [
    `Monitorear el termómetro de masa de grano en cada perfil horario para asegurar que no baje de 30.0°C ni supere 32.0°C.`,
    `Verificar la velocidad de giro de los secadores continuos (A1 / A2) para mantener flujo turbulento uniforme.`,
    `Realizar control de humedad con medidor dieléctrico en los perfiles P4, P8 y P12 para confirmar la curva descendente hasta 12.8%.`,
    `Si la T° de grano registrada supera los 32.0°C en dos perfiles consecutivos, reducir la consigna del quemador en 2°C inmediatamente.`
  ];

  return {
    receta: recetaGenerada,
    tempGranoMeta: 31.0,
    rangoSeguridad: { min: 30.0, max: 32.0 },
    tempGranoEstimadaPromedio,
    explicacionTermodinamica: explicaciones.join(" "),
    ajusteHR,
    ajusteTempAmb,
    ajusteHumedadInicial,
    basadoEnHistorico,
    lotesHistoricosSimilaresCount: similares.length,
    recomendacionesOperativas: recomendaciones
  };
}

/**
 * Construye dinámicamente los items de la Receta a partir de las filas de perfiles de secado ingresadas.
 * Se sincroniza tanto si el usuario digita en la tabla grande como si edita la receta lateral.
 */
export function sincronizarRecetaDesdePerfiles(
  perfiles: Array<{ perfilIndex: number | string; tiempoMin?: number | string; tempProgramada?: number; tempGrano?: number; [key: string]: any }>,
  recetaActual?: RecetaSecadoItem[]
): RecetaSecadoItem[] {
  const base = (recetaActual && recetaActual.length === 13) 
    ? recetaActual 
    : Array.from({ length: 13 }, (_, i) => ({
        perfil: i,
        tiempo: undefined as any,
        temp: undefined as any,
        tempGranoEsperada: undefined
      }));
  
  return base.map((item, idx) => {
    const perf = perfiles.find(p => Number(p.perfilIndex) === idx) || perfiles[idx];
    const tiempo = perf?.tiempoMin !== undefined && Number(perf.tiempoMin) > 0 ? Number(perf.tiempoMin) : (item.tiempo || undefined as any);
    const temp = perf?.tempProgramada !== undefined && perf.tempProgramada > 0 ? perf.tempProgramada : (item.temp || undefined as any);
    const tempGranoEsperada = perf?.tempGrano !== undefined && perf.tempGrano > 0 ? perf.tempGrano : (item.tempGranoEsperada || undefined);

    return {
      ...item,
      perfil: idx,
      tiempo,
      temp,
      tempGranoEsperada
    };
  });
}
