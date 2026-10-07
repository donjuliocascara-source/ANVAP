import { ControlVaporizado, SiloControlPlant, PerfilSecadoPlant, ParametroPaddyRow } from "../types";

/**
 * Genera la matriz de Parámetros del Paddy.
 * Los datos de INGRESO VAPORIZADO se toman de los análisis iniciales de recepción de lotes.
 * Las columnas de SALIDA VAPORIZADO, REPOSO, SALIDA SECADORA y VARIACIÓN se inicializan VACÍAS para llenarse durante el proceso.
 */
export function createEmptyParametrosPaddy(initialValues?: {
  humedad?: number;
  ri?: number;
  rb?: number;
  q?: number;
  tt?: number;
  tp?: number;
  m?: number;
  tz?: number;
  gi?: number;
  gr?: number;
  bl?: number;
  blp?: number;
  rem?: number;
}): ParametroPaddyRow[] {
  return [
    { 
      parametro: "H_I", 
      label: "% H.I", 
      ingresoVaporizado: initialValues?.humedad !== undefined ? Number(initialValues.humedad.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined, 
      isHighlighted: true 
    },
    { 
      parametro: "R_I", 
      label: "% R.I.", 
      ingresoVaporizado: initialValues?.ri !== undefined ? Number(initialValues.ri.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "R_B", 
      label: "% R.B", 
      ingresoVaporizado: initialValues?.rb !== undefined ? Number(initialValues.rb.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "Q", 
      label: "% Q", 
      ingresoVaporizado: initialValues?.q !== undefined ? Number(initialValues.q.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined, 
      isHighlighted: true 
    },
    { 
      parametro: "T_T", 
      label: "% T.T.", 
      ingresoVaporizado: initialValues?.tt !== undefined ? Number(initialValues.tt.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "T_P", 
      label: "% T.P.", 
      ingresoVaporizado: initialValues?.tp !== undefined ? Number(initialValues.tp.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "M", 
      label: "% M.", 
      ingresoVaporizado: initialValues?.m !== undefined ? Number(initialValues.m.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "TZ", 
      label: "% TZ", 
      ingresoVaporizado: initialValues?.tz !== undefined ? Number(initialValues.tz.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined, 
      isHighlighted: true 
    },
    { 
      parametro: "G_I", 
      label: "% G.I", 
      ingresoVaporizado: initialValues?.gi !== undefined ? Number(initialValues.gi.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "G_R", 
      label: "% G.R.", 
      ingresoVaporizado: initialValues?.gr !== undefined ? Number(initialValues.gr.toFixed(1)) : 0.0, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "BL_I", 
      label: "% BL. I", 
      ingresoVaporizado: initialValues?.bl !== undefined ? Number(initialValues.bl.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined, 
      isHighlighted: true 
    },
    { 
      parametro: "BL_P", 
      label: "% BL.P", 
      ingresoVaporizado: initialValues?.blp !== undefined ? Number(initialValues.blp.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    },
    { 
      parametro: "REM", 
      label: "%REM", 
      ingresoVaporizado: initialValues?.rem !== undefined ? Number(initialValues.rem.toFixed(1)) : undefined, 
      salidaVaporizado: undefined, 
      reposoSecadora: undefined, 
      salidaSecadora: undefined, 
      variacion: undefined 
    }
  ];
}

/**
 * Matriz vacía para la batería de Silos 1 al 5.
 * Todo listo para que el operador registre los datos de campo durante la operación.
 */
export function createEmptySilosPlant(): SiloControlPlant[] {
  return Array.from({ length: 5 }, (_, i) => ({
    siloNumber: i + 1,
    exclusa: {
      inicio: "",
      fin: "",
      tiempoLlenado: "",
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      presion: 0.45,
      exclusa: ""
    },
    tempSuperior: undefined as any,
    tempInferior: undefined as any,
    descarga: {
      inicio: "",
      fin: "",
      tiempo: undefined as any,
      tiempoDescarga: "",
      tiempoReposo: undefined as any,
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      blIntegral: undefined as any,
      blp: undefined as any,
      amarillo: undefined as any,
      quebradoPct: undefined as any,
      trizado: undefined as any,
      humedad: undefined as any
    }
  }));
}

/**
 * Etapas de Reposo 1, Enfriamiento y Reposo 2 previo al Secado
 */
export function createEmptyEtapaReposo1(fechaStr?: string): PerfilSecadoPlant[] {
  const currentDate = fechaStr || new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  return [
    {
      perfilIndex: "1° REPOSO (1)",
      etapa: "REPOSO_1",
      fecha: currentDate,
      horaInicio: "",
      tempGrano: undefined as any,
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      humedad: "",
      tempReal: undefined as any,
      tiempoMin: "",
      tempProgramada: undefined as any,
      a1: undefined as any,
      a2: undefined as any,
      materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
      modificaciones: { mod1: "", mod2: "", mod3: "" }
    },
    {
      perfilIndex: "1° REPOSO (2)",
      etapa: "REPOSO_1",
      fecha: currentDate,
      horaInicio: "",
      tempGrano: undefined as any,
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      humedad: "",
      tempReal: undefined as any,
      tiempoMin: "",
      tempProgramada: undefined as any,
      a1: undefined as any,
      a2: undefined as any,
      materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
      modificaciones: { mod1: "", mod2: "", mod3: "" }
    }
  ];
}

export function createEmptyEtapaEnfriamiento(fechaStr?: string): PerfilSecadoPlant[] {
  const currentDate = fechaStr || new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  return [
    {
      perfilIndex: "ENFRIAMIENTO (1)",
      etapa: "ENFRIAMIENTO",
      fecha: currentDate,
      horaInicio: "",
      tempGrano: undefined as any,
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      humedad: "",
      tempReal: undefined as any,
      tiempoMin: "",
      tempProgramada: undefined as any,
      a1: undefined as any,
      a2: undefined as any,
      materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
      modificaciones: { mod1: "", mod2: "", mod3: "" }
    },
    {
      perfilIndex: "ENFRIAMIENTO (2)",
      etapa: "ENFRIAMIENTO",
      fecha: currentDate,
      horaInicio: "",
      tempGrano: undefined as any,
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      humedad: "",
      tempReal: undefined as any,
      tiempoMin: "",
      tempProgramada: undefined as any,
      a1: undefined as any,
      a2: undefined as any,
      materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
      modificaciones: { mod1: "", mod2: "", mod3: "" }
    }
  ];
}

export function createEmptyEtapaReposo2(fechaStr?: string): PerfilSecadoPlant[] {
  const currentDate = fechaStr || new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  return [
    {
      perfilIndex: "2° REPOSO (1)",
      etapa: "REPOSO_2",
      fecha: currentDate,
      horaInicio: "",
      tempGrano: undefined as any,
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      humedad: "",
      tempReal: undefined as any,
      tiempoMin: "",
      tempProgramada: undefined as any,
      a1: undefined as any,
      a2: undefined as any,
      materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
      modificaciones: { mod1: "", mod2: "", mod3: "" }
    },
    {
      perfilIndex: "2° REPOSO (2)",
      etapa: "REPOSO_2",
      fecha: currentDate,
      horaInicio: "",
      tempGrano: undefined as any,
      tempAmbiente: undefined as any,
      humedadRelativa: undefined as any,
      humedad: "",
      tempReal: undefined as any,
      tiempoMin: "",
      tempProgramada: undefined as any,
      a1: undefined as any,
      a2: undefined as any,
      materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
      modificaciones: { mod1: "", mod2: "", mod3: "" }
    }
  ];
}

/**
 * Perfiles de secado vacíos (filas 0 a 14) listos para registro horario en planta.
 */
export function createEmptyPerfilesSecado(fechaStr?: string): PerfilSecadoPlant[] {
  const currentDate = fechaStr || new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return Array.from({ length: 15 }, (_, i) => ({
    perfilIndex: i,
    etapa: "SECADO",
    fecha: currentDate,
    horaInicio: "",
    tempGrano: undefined as any,
    tempAmbiente: undefined as any,
    humedadRelativa: undefined as any,
    humedad: "",
    tempReal: undefined as any,
    tiempoMin: undefined as any,
    tempProgramada: undefined as any,
    a1: undefined as any,
    a2: undefined as any,
    materiaPrima: { qPct: undefined, trizPct: undefined, blGrad: undefined },
    modificaciones: { mod1: "", mod2: "", mod3: "" }
  }));
}

export const DEFAULT_RECETA_SECADO = Array.from({ length: 13 }, (_, i) => ({
  perfil: i,
  tiempo: undefined as any,
  temp: undefined as any
}));

export const DEFAULT_PARAMETROS_PADDY: ParametroPaddyRow[] = createEmptyParametrosPaddy();
export const DEFAULT_SILOS_PLANT: SiloControlPlant[] = createEmptySilosPlant();
export const DEFAULT_ETAPA_REPOSO_1: PerfilSecadoPlant[] = createEmptyEtapaReposo1();
export const DEFAULT_ETAPA_ENFRIAMIENTO: PerfilSecadoPlant[] = createEmptyEtapaEnfriamiento();
export const DEFAULT_ETAPA_REPOSO_2: PerfilSecadoPlant[] = createEmptyEtapaReposo2();
export const DEFAULT_PERFILES_SECADO: PerfilSecadoPlant[] = createEmptyPerfilesSecado();

/**
 * Devuelve un registro LIMPIO para un batch que inicia o está en proceso:
 * Los datos que ya se conocen (Procedencia, Código, Peso, Humedad inicial, Variedad, Receta) aparecen llenos.
 * Los datos de campo y salida (Silos, Perfiles horarios, Horas finales, Salida secadora) aparecen VACÍOS.
 */
export function getBlankPlantControlRecord(
  batchId: string = "B001",
  options?: {
    batchCorrelativo?: string;
    cliente?: string;
    variedad?: string;
    procedencia?: string;
    pesoKg?: number;
    numSacos?: string;
    operador?: string;
    supervisor?: string;
    parametrosDeterminados?: {
      presionBar?: number;
      velExclusa?: number;
      tiempoReposoMin?: number;
      tempSecadoC?: number;
    };
    parametrosRecomendadosIA?: {
      presionBar?: number;
      velExclusa?: number;
      tiempoReposoMin?: number;
      tempSecadoC?: number;
    };
    initialPaddy?: {
      humedad?: number;
      ri?: number;
      rb?: number;
      q?: number;
      tt?: number;
      tp?: number;
      m?: number;
      tz?: number;
      gi?: number;
      gr?: number;
      bl?: number;
      blp?: number;
      rem?: number;
    };
  }
): Partial<ControlVaporizado> {
  const currentDate = new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const pesoKg = options?.pesoKg || 27000;
  const initialHumedad = options?.initialPaddy?.humedad !== undefined ? Number(options.initialPaddy.humedad.toFixed(1)) : 14.1;

  const chosenPresion = options?.parametrosDeterminados?.presionBar 
    ?? options?.parametrosRecomendadosIA?.presionBar 
    ?? 0.45;
  const chosenVelExclusa = options?.parametrosDeterminados?.velExclusa 
    ?? options?.parametrosRecomendadosIA?.velExclusa 
    ?? 4;
  const chosenTiempoReposo = options?.parametrosDeterminados?.tiempoReposoMin 
    ?? options?.parametrosRecomendadosIA?.tiempoReposoMin 
    ?? (initialHumedad < 14 ? 60 : 45);

  return {
    CONTROL_VAPORIZADO_ID: `CTRL-${batchId}`,
    BATCH_ID: batchId,
    FECHA_HORA_INICIO: new Date().toISOString().replace("T", " ").substring(0, 16),
    FECHA_HORA_FIN: "",
    HUMEDAD_INGRESO: initialHumedad,
    PRESION_BAR: chosenPresion,
    PRESION_MAX_BAR: chosenPresion,
    PRESION_PROM_BAR: chosenPresion,
    RPM: 18,
    TIEMPO_VAPORIZADO_MIN: 30,
    TIEMPO_REPOSO_MIN: chosenTiempoReposo,
    TEMPERATURA_INGRESO_C: 22.0,
    TEMPERATURA_SALIDA_C: 0,
    TEMP_SUPERIOR_C: 0,
    TEMP_INFERIOR_C: 0,
    HUMEDAD_SALIDA: undefined as any,
    TON_PROCESADAS: Number((pesoKg / 1000).toFixed(1)),
    OPERADOR: options?.operador || "Operario de Planta",
    SUPERVISOR: options?.supervisor || "Jefe de Planta",
    CLIENTE: options?.cliente || "MOLINO SAN PEDRO S.A.C.",
    DESVIACION: "",
    parametrosDeterminados: options?.parametrosDeterminados,
    parametrosRecomendadosIA: options?.parametrosRecomendadosIA,
    datosIngreso: {
      procedencia: options?.procedencia || "Tolvas de Recepción",
      codigo: options?.batchCorrelativo || batchId,
      numSacos: options?.numSacos || "300 SACOS",
      pesoKg: pesoKg,
      pesoTotalKg: pesoKg,
      variedad: options?.variedad || "TINAJONES",
      humedadPct: initialHumedad,
      tiempoReposo: `${chosenTiempoReposo} min`
    },
    datosVaporizado: {
      modalidadPases: initialHumedad < 14 ? "2_PASES" : "1_PASE",
      motivoPases: initialHumedad < 14 
        ? "Lote Seco (<14% Humedad): Dos pases de inyección de vapor recomendados para mitigar choque térmico y evitar trizado." 
        : "Lote Húmedo (≥14% Humedad): Un solo paso de inyección directa estándar.",
      llenadoTolvaPulmon: { inicio: "", fin: "", duracion: "" },
      inyeccionVapor: { 
        inicio: "", 
        fin: "", 
        duracion: "",
        presion: chosenPresion,
        velExclusa: String(chosenVelExclusa),
        tiempoReposo: `${chosenTiempoReposo} min`,
        rpm: 18,
        obs: "Inyección estándar directa"
      },
      inyeccionVaporPase1: { 
        paseNumero: 1, 
        nombre: "1° Pase (Acondicionamiento / Pre-calor)",
        inicio: "", 
        fin: "", 
        duracion: "", 
        presion: chosenPresion, 
        presionMax: chosenPresion + 0.1,
        rpm: 18, 
        vExcl: String(chosenVelExclusa),
        temperatura: 125,
        perfil: "Acondicionamiento",
        tiempoReposo: `${Math.round(chosenTiempoReposo / 2)} min`,
        obs: "Pre-calentamiento gradual para evitar choque térmico" 
      },
      inyeccionVaporPase2: { 
        paseNumero: 2, 
        nombre: "2° Pase (Cocción / Gelatinización Principal)",
        inicio: "", 
        fin: "", 
        duracion: "", 
        presion: chosenPresion, 
        presionMax: chosenPresion + 0.1,
        rpm: 18, 
        vExcl: String(chosenVelExclusa),
        temperatura: 130,
        perfil: "Cocción Profunda",
        tiempoReposo: `${Math.round(chosenTiempoReposo / 2)} min`,
        obs: "Gelatinización uniforme del almidón sin trizado" 
      },
      tiempoReposoInterPases: `${chosenTiempoReposo} min`,
      tiempoTotalInyeccionMin: "",
      presionVapor: chosenPresion,
      rpm: 18,
      tempTrabajo: chosenPresion <= 0.38 ? "122 / 125" : (chosenPresion >= 0.50 ? "130 / 132" : "128 / 130")
    },
    silos: createEmptySilosPlant(),
    silosPase1: createEmptySilosPlant(),
    silosPase2: createEmptySilosPlant(),
    parametrosPaddy: createEmptyParametrosPaddy(options?.initialPaddy),
    etapaReposo1: createEmptyEtapaReposo1(currentDate),
    etapaEnfriamiento: createEmptyEtapaEnfriamiento(currentDate),
    etapaReposo2: createEmptyEtapaReposo2(currentDate),
    perfilesSecado: createEmptyPerfilesSecado(currentDate),
    resumenEtapas: {
      tiempoReposo1: "",
      tiempoEnfriamiento: "",
      tiempoReposo2: "",
      tiempoSecadoTotal: ""
    },
    recetaSecado: DEFAULT_RECETA_SECADO,
    carga: {
      inicio: "",
      fin: "",
      equipo: "APIT",
      cantidad_tn: Number((pesoKg / 1000).toFixed(1))
    },
    inyeccion: {
      inicio: "",
      fin: "",
      presion_bar: 0.45,
      presion_max: 0.45,
      presion_prom: 0.45,
      rpm: 18,
      temp_c: 0,
      obs: ""
    },
    reposo: {
      inicio: "",
      fin: "",
      tiempo_min: 0,
      temp_sup_c: 0,
      temp_inf_c: 0
    },
    descarga: {
      inicio: "",
      fin: "",
      temp_c: 0,
      humedad_pct: 0,
      obs: ""
    },
    secado: {
      ingreso: "",
      humedad_inicial: initialHumedad,
      temp_entrada_c: 0,
      temp_salida_c: 0,
      humedad_final: 0,
      tiempo_min: 0,
      obs: ""
    },
    OBSERVACIONES: ""
  };
}

/**
 * Plantilla de ejemplo histórico (Batch 425 de muestra completa)
 * Únicamente para el botón demostrativo.
 */
export function getSampleBatch425Record(): Partial<ControlVaporizado> {
  return {
    CONTROL_VAPORIZADO_ID: `CTRL-425`,
    BATCH_ID: "425",
    FECHA_HORA_INICIO: "2026-06-14 03:08",
    FECHA_HORA_FIN: "2026-06-14 18:05",
    HUMEDAD_INGRESO: 20.9,
    PRESION_BAR: 0.45,
    PRESION_MAX_BAR: 0.45,
    PRESION_PROM_BAR: 0.45,
    RPM: 18,
    TIEMPO_VAPORIZADO_MIN: 30,
    TIEMPO_REPOSO_MIN: 45,
    TEMPERATURA_INGRESO_C: 23.1,
    TEMPERATURA_SALIDA_C: 88,
    TEMP_SUPERIOR_C: 90,
    TEMP_INFERIOR_C: 71,
    HUMEDAD_SALIDA: 12.0,
    TON_PROCESADAS: 32.5,
    OPERADOR: "PAUL",
    SUPERVISOR: "AARON",
    DESVIACION: "",
    datosIngreso: {
      procedencia: "JAEN",
      codigo: "8138",
      numSacos: "315 DE 420",
      pesoKg: 32500,
      pesoTotalKg: 32500,
      variedad: "VALOR",
      humedadPct: 20.9,
      tiempoReposo: "45 min"
    },
    datosVaporizado: {
      modalidadPases: "1_PASE",
      motivoPases: "Lote Húmedo (20.9% Humedad): Proceso estándar de 1 solo pase de inyección.",
      llenadoTolvaPulmon: { inicio: "02:45", fin: "03:08", duracion: "23 min" },
      inyeccionVapor: { 
        inicio: "03:08", 
        fin: "03:38", 
        duracion: "30 min",
        presion: 0.45,
        rpm: 18,
        temperatura: 128,
        perfil: "Estándar",
        tiempoReposo: "45 min",
        obs: "Inyección estándar directa"
      },
      inyeccionVaporPase1: { 
        paseNumero: 1, 
        nombre: "1° Pase (Acondicionamiento / Pre-calor)",
        inicio: "03:08", 
        fin: "03:38", 
        duracion: "30 min", 
        presion: 0.4, 
        presionMax: 0.55,
        rpm: 18, 
        vExcl: "",
        temperatura: 125,
        perfil: "Acondicionamiento",
        tiempoReposo: "10 min",
        obs: "Pre-calentamiento gradual para evitar choque térmico" 
      },
      inyeccionVaporPase2: { 
        paseNumero: 2, 
        nombre: "2° Pase (Cocción / Gelatinización Principal)",
        inicio: "", 
        fin: "", 
        duracion: "", 
        presion: 0.4, 
        presionMax: 0.55,
        rpm: 18, 
        vExcl: "",
        temperatura: 130,
        perfil: "Cocción Profunda",
        tiempoReposo: "10 min",
        obs: "Gelatinización uniforme del almidón sin trizado" 
      },
      tiempoReposoInterPases: "",
      tiempoTotalInyeccionMin: 30,
      presionVapor: 0.45,
      rpm: 18,
      tempTrabajo: "128 / 130"
    },
    silos: [
      {
        siloNumber: 1,
        exclusa: { inicio: "03:18", fin: "03:59", tiempoLlenado: "41 min", tempAmbiente: 23.1, humedadRelativa: 73, presion: 0.45, exclusa: "1" },
        tempSuperior: 90,
        tempInferior: 71,
        descarga: { inicio: "04:30", fin: "04:50", tiempoDescarga: "20 min", tiempoReposo: "45 min", tempAmbiente: 22.7, humedadRelativa: 78, blIntegral: 17.8, blp: 24.7, quebradoPct: 14.2, trizado: 8.8, humedad: 20.8 }
      },
      {
        siloNumber: 2,
        exclusa: { inicio: "04:02", fin: "04:46", tiempoLlenado: "44 min", tempAmbiente: 22.8, humedadRelativa: 77.0, presion: 0.45, exclusa: "2" },
        tempSuperior: 92,
        tempInferior: 85,
        descarga: { inicio: "05:13", fin: "05:36", tiempoDescarga: "23 min", tiempoReposo: "45 min", tempAmbiente: 22.4, humedadRelativa: 80, blIntegral: 18.5, blp: 23.6, quebradoPct: 15.1, trizado: 0, humedad: 20.0 }
      },
      {
        siloNumber: 3,
        exclusa: { inicio: "04:51", fin: "05:33", tiempoLlenado: "42 min", tempAmbiente: 22.3, humedadRelativa: 80, presion: 0.45, exclusa: "3" },
        tempSuperior: 93,
        tempInferior: 76,
        descarga: { inicio: "05:57", fin: "06:20", tiempoDescarga: "23 min", tiempoReposo: "45 min", tempAmbiente: 22.4, humedadRelativa: 81, blIntegral: 18.4, blp: 25.2, quebradoPct: 13.8, trizado: 0, humedad: 19.8 }
      },
      {
        siloNumber: 4,
        exclusa: { inicio: "05:37", fin: "06:13", tiempoLlenado: "36 min", tempAmbiente: 22.5, humedadRelativa: 81, presion: 0.45, exclusa: "4" },
        tempSuperior: 93,
        tempInferior: 77,
        descarga: { inicio: "06:40", fin: "07:00", tiempoDescarga: "20 min", tiempoReposo: "45 min", tempAmbiente: 24.0, humedadRelativa: 78, blIntegral: 0, blp: 19.8, quebradoPct: 14.5, trizado: 0, humedad: 0 }
      },
      {
        siloNumber: 5,
        exclusa: { inicio: "06:13", fin: "06:30", tiempoLlenado: "17 min", tempAmbiente: 22.4, humedadRelativa: 82, presion: 0.45, exclusa: "5" },
        tempSuperior: 85,
        tempInferior: 66,
        descarga: { inicio: "07:02", fin: "07:13", tiempoDescarga: "11 min", tiempoReposo: "45 min", tempAmbiente: 26.5, humedadRelativa: 71, blIntegral: 18.7, blp: 24.9, quebradoPct: 14.0, trizado: 0, humedad: 19.5 }
      }
    ],
    parametrosPaddy: [
      { parametro: "H_I", label: "% H.I", ingresoVaporizado: 20.9, salidaSecadora: 12.2, variacion: -8.7, isHighlighted: true },
      { parametro: "R_I", label: "% R.I.", ingresoVaporizado: 78.6, salidaSecadora: 79.9, variacion: 1.3 },
      { parametro: "R_B", label: "% R.B", ingresoVaporizado: 70.6, salidaSecadora: 73.6, variacion: 3.0 },
      { parametro: "Q", label: "% Q", ingresoVaporizado: 14.2, salidaSecadora: 16.3, variacion: 2.1, isHighlighted: true },
      { parametro: "T_T", label: "% T.T.", ingresoVaporizado: 4.0, salidaSecadora: 5.6, variacion: 1.6 },
      { parametro: "T_P", label: "% T.P.", ingresoVaporizado: 16.7, salidaSecadora: 16.0, variacion: -0.7 },
      { parametro: "M", label: "% M.", ingresoVaporizado: 1.3, salidaSecadora: 3.0, variacion: 1.7 },
      { parametro: "TZ", label: "% TZ", ingresoVaporizado: 3.0, salidaSecadora: 10.3, variacion: 7.3, isHighlighted: true },
      { parametro: "G_I", label: "% G.I", ingresoVaporizado: 3.1, salidaSecadora: 1.5, variacion: -1.6 },
      { parametro: "G_R", label: "% G.R.", ingresoVaporizado: 0.0, salidaSecadora: 0.0, variacion: 0.0 },
      { parametro: "BL_I", label: "% BL. I", ingresoVaporizado: 21.5, salidaSecadora: 18.1, variacion: -3.4, isHighlighted: true },
      { parametro: "BL_P", label: "% BL.P", ingresoVaporizado: undefined, salidaSecadora: 28.3, variacion: undefined },
      { parametro: "REM", label: "%REM", ingresoVaporizado: undefined, salidaSecadora: undefined, variacion: undefined }
    ],
    etapaReposo1: [
      { perfilIndex: "1° REPOSO (1)", etapa: "REPOSO_1", fecha: "14/06/2026", horaInicio: "07:15", tempGrano: 58, tempAmbiente: 24.5, humedadRelativa: 76, humedad: "20.5", tempReal: 56, tiempoMin: "45 min", tempProgramada: 0, a1: 0, a2: 0, materiaPrima: { qPct: 14.1, trizPct: 0, blGrad: 24.5 }, modificaciones: { mod1: "", mod2: "", mod3: "" } },
      { perfilIndex: "1° REPOSO (2)", etapa: "REPOSO_1", fecha: "14/06/2026", horaInicio: "07:45", tempGrano: 54, tempAmbiente: 25.0, humedadRelativa: 72, humedad: "20.2", tempReal: 52, tiempoMin: "15 min", tempProgramada: 0, a1: 0, a2: 0, materiaPrima: { qPct: 14.1, trizPct: 0, blGrad: 24.6 }, modificaciones: { mod1: "", mod2: "", mod3: "" } }
    ],
    etapaEnfriamiento: [
      { perfilIndex: "ENFRIAMIENTO (1)", etapa: "ENFRIAMIENTO", fecha: "14/06/2026", horaInicio: "08:00", tempGrano: 42, tempAmbiente: 26.0, humedadRelativa: 68, humedad: "19.8", tempReal: 40, tiempoMin: "32 min", tempProgramada: 0, a1: 0, a2: 0, materiaPrima: { qPct: 14.2, trizPct: 0, blGrad: 24.8 }, modificaciones: { mod1: "", mod2: "", mod3: "" } },
      { perfilIndex: "ENFRIAMIENTO (2)", etapa: "ENFRIAMIENTO", fecha: "14/06/2026", horaInicio: "08:20", tempGrano: 36, tempAmbiente: 28.0, humedadRelativa: 62, humedad: "19.2", tempReal: 35, tiempoMin: "12 min", tempProgramada: 0, a1: 0, a2: 0, materiaPrima: { qPct: 14.2, trizPct: 0, blGrad: 24.8 }, modificaciones: { mod1: "", mod2: "", mod3: "" } }
    ],
    etapaReposo2: [
      { perfilIndex: "2° REPOSO (1)", etapa: "REPOSO_2", fecha: "14/06/2026", horaInicio: "08:32", tempGrano: 32, tempAmbiente: 30.0, humedadRelativa: 55, humedad: "18.8", tempReal: 30, tiempoMin: "40 min", tempProgramada: 0, a1: 0, a2: 0, materiaPrima: { qPct: 14.2, trizPct: 0, blGrad: 24.8 }, modificaciones: { mod1: "", mod2: "", mod3: "" } },
      { perfilIndex: "2° REPOSO (2)", etapa: "REPOSO_2", fecha: "14/06/2026", horaInicio: "09:00", tempGrano: 30, tempAmbiente: 32.0, humedadRelativa: 50, humedad: "18.4", tempReal: 29, tiempoMin: "10 min", tempProgramada: 0, a1: 0, a2: 0, materiaPrima: { qPct: 14.2, trizPct: 0, blGrad: 24.8 }, modificaciones: { mod1: "", mod2: "", mod3: "" } }
    ],
    resumenEtapas: {
      tiempoReposo1: "45 min",
      tiempoEnfriamiento: "32 min",
      tiempoReposo2: "40 min",
      tiempoSecadoTotal: "650 min"
    },
    perfilesSecado: [
      { perfilIndex: 0, fecha: "14/06/2026", horaInicio: "8:32AM", tempGrano: 30, tempAmbiente: 34.4, humedadRelativa: 44, humedad: "18.0", tempReal: 28.4, tiempoMin: 50, tempProgramada: 75, a1: 65, a2: 75 },
      { perfilIndex: 1, fecha: "14/06/2026", horaInicio: "8:32AM", tempGrano: 30, tempAmbiente: 34.4, humedadRelativa: 44, humedad: "17.2", tempReal: 29.0, tiempoMin: 50, tempProgramada: 75, a1: 65, a2: 75 },
      { perfilIndex: 2, fecha: "14/06/2026", horaInicio: "9:22AM", tempGrano: 30, tempAmbiente: 39.7, humedadRelativa: 35, humedad: "16.4", tempReal: 30.0, tiempoMin: 50, tempProgramada: 80, a1: 70, a2: 80 },
      { perfilIndex: 3, fecha: "14/06/2026", horaInicio: "10:12AM", tempGrano: 31, tempAmbiente: 39.7, humedadRelativa: 35, humedad: "15.6", tempReal: 30.9, tiempoMin: 50, tempProgramada: 80, a1: 70, a2: 80 },
      { perfilIndex: 4, fecha: "14/06/2026", horaInicio: "11:10AM", tempGrano: 31, tempAmbiente: 35.5, humedadRelativa: 38, humedad: "15.0", tempReal: 31.8, tiempoMin: 50, tempProgramada: 81, a1: 71, a2: 81 },
      { perfilIndex: 5, fecha: "14/06/2026", horaInicio: "12:00PM", tempGrano: 31, tempAmbiente: 32.6, humedadRelativa: 43, humedad: "14.6", tempReal: 32.0, tiempoMin: 50, tempProgramada: 79, a1: 69, a2: 79 },
      { perfilIndex: 6, fecha: "14/06/2026", horaInicio: "12:54PM", tempGrano: 32, tempAmbiente: 31.2, humedadRelativa: 45, humedad: "14.4", tempReal: 31.0, tiempoMin: 50, tempProgramada: 77, a1: 67, a2: 77 },
      { perfilIndex: 7, fecha: "14/06/2026", horaInicio: "1:46PM", tempGrano: 32, tempAmbiente: 31.0, humedadRelativa: 49, humedad: "13.5", tempReal: 31.0, tiempoMin: 50, tempProgramada: 72, a1: 62, a2: 72 },
      { perfilIndex: 8, fecha: "14/06/2026", horaInicio: "2:38PM", tempGrano: 32, tempAmbiente: 30.1, humedadRelativa: 49, humedad: "13.1", tempReal: 31.0, tiempoMin: 50, tempProgramada: 75, a1: 65, a2: 75 },
      { perfilIndex: 9, fecha: "14/06/2026", horaInicio: "3:30PM", tempGrano: 32, tempAmbiente: 30.0, humedadRelativa: 79, humedad: "12.8", tempReal: 31.0, tiempoMin: 50, tempProgramada: 73, a1: 63, a2: 73 },
      { perfilIndex: 10, fecha: "14/06/2026", horaInicio: "", tempGrano: 32, tempAmbiente: 27.8, humedadRelativa: 58, humedad: "12.5", tempReal: 31.0, tiempoMin: 50, tempProgramada: 69, a1: 59, a2: 69 },
      { perfilIndex: 11, fecha: "14/06/2026", horaInicio: "5:13PM", tempGrano: 32, tempAmbiente: 27.7, humedadRelativa: 58, humedad: "12.3", tempReal: 31.0, tiempoMin: 50, tempProgramada: 69, a1: 59, a2: 69 },
      { perfilIndex: 12, fecha: "14/06/2026", horaInicio: "6:05PM", tempGrano: 32, tempAmbiente: 25.9, humedadRelativa: 66, humedad: "12.0", tempReal: 31.0, tiempoMin: 50, tempProgramada: 69, a1: 59, a2: 69 },
      { perfilIndex: 13, fecha: "14/06/2026", horaInicio: "", tempGrano: 0, tempAmbiente: 0, humedadRelativa: 0, humedad: "FIN", tempReal: 0, tiempoMin: 0, tempProgramada: 0, a1: 0, a2: 0 },
      { perfilIndex: 14, fecha: "14/06/2026", horaInicio: "", tempGrano: 0, tempAmbiente: 0, humedadRelativa: 0, humedad: "", tempReal: 0, tiempoMin: 0, tempProgramada: 0, a1: 0, a2: 0 }
    ],
    recetaSecado: DEFAULT_RECETA_SECADO,
    OBSERVACIONES: "Proceso completado según parámetros de hoja de control oficial de planta."
  };
}

export function getFullPlantControlRecord(batchId: string = "425"): Partial<ControlVaporizado> {
  return getBlankPlantControlRecord(batchId);
}
