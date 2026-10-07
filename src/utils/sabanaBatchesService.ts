import { HistorialBatchTrabajado, RecomendacionRecetaIngreso } from "../types";

const SABANA_BATCHES_STORAGE_KEY = "sabana_batches_trabajados_v1";

/**
 * Datos históricos oficiales transcritos directamente de la sábana operativa de planta (Batches 313 al 336)
 */
export const HISTORIAL_BATCHES_DEFAULT: HistorialBatchTrabajado[] = [
  {
    id: "313",
    tipoProceso: "PRESECADO",
    batch: 313,
    variedad: "VALOR",
    hi: 14.0,
    riPct: 79.0,
    rbPct: 71.8,
    qPct: 4.2,
    ttPct: 1.7,
    pPct: 5.5,
    mPct: 1.5,
    tzPct: 2.8,
    giPct: 1.0,
    gVerdePct: null,
    blIPct: 22.0,
    blPPct: null,
    remPct: null,
    // Pase 1
    pres1Bar: 0.05,
    rpm1: 4,
    tReposo1Min: 45,
    tk1_1: "55/56/57",
    tk1_2: null,
    tk1_3: null,
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    // Pase 2
    pres2Bar: 0.70,
    rpm2: 4,
    tReposo2Min: 100,
    tk2_1: "84/78/73",
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: 12.6,
    incQ2: 12.4,
    triz2: null,
    // Cocción
    pesoCoccion: null,
    quebradoCoccionPct: 11.0,
    abiertoCoccionPct: 4.6,
    hinchadoCoccionPct: 20.0,
    desplazamientoCoccionSeg: null,
    notasExito: "Presecado a 0.05 bar en pase 1 con reposo de 45m. En 2do pase 0.70 bar / 100m reposo."
  },
  {
    id: "314",
    tipoProceso: "HUMEDO",
    batch: 314,
    variedad: "FERON",
    hi: 18.3,
    riPct: 77.0,
    rbPct: 69.0,
    qPct: 18.1,
    ttPct: 6.1,
    pPct: 8.0,
    mPct: 1.4,
    tzPct: 1.0,
    giPct: 2.0,
    gVerdePct: null,
    blIPct: 22.4,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.35,
    rpm1: 6,
    tReposo1Min: 40,
    tk1_1: "93/86/79",
    tk1_2: "96/88/81",
    tk1_3: "97/89/81",
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null
  },
  {
    id: "315",
    tipoProceso: "PRESECADO",
    batch: 315,
    variedad: "VALOR",
    hi: 13.3,
    riPct: 79.0,
    rbPct: 71.5,
    qPct: 9.83,
    ttPct: 2.2,
    pPct: 8.06,
    mPct: 2.4,
    tzPct: 4.76,
    giPct: 1.06,
    gVerdePct: null,
    blIPct: 21.83,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.05,
    rpm1: 4,
    tReposo1Min: 50,
    tk1_1: "36/45/55",
    tk1_2: "36/49/62",
    tk1_3: "80/77/75",
    tk1_4: "47/59/71",
    gHum1: 2.97,
    incQ1: null,
    triz1: 10.5,
    pres2Bar: 0.07,
    rpm2: null,
    tReposo2Min: 120,
    tk2_1: "36/45/55",
    tk2_2: "36/49/62",
    tk2_3: "80/77/75",
    tk2_4: "47-59-71",
    gHum2: 1.0,
    incQ2: 10.0,
    triz2: null,
    pesoCoccion: "1.290",
    quebradoCoccionPct: 14.1,
    abiertoCoccionPct: 0.04,
    hinchadoCoccionPct: 4.1,
    desplazamientoCoccionSeg: 13.7,
    notasExito: "Grano abierto excepcionalmente bajo (0.04%) con desplazamiento de 13.7 seg."
  },
  {
    id: "316",
    tipoProceso: "HUMEDO",
    batch: 316,
    variedad: "VALOR",
    hi: 17.5,
    riPct: 78.9,
    rbPct: 71.5,
    qPct: 15.6,
    ttPct: 2.7,
    pPct: 7.1,
    mPct: 1.8,
    tzPct: 2.1,
    giPct: 2.6,
    gVerdePct: null,
    blIPct: 22.7,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.05,
    rpm1: 4,
    tReposo1Min: 45,
    tk1_1: "46/48/50",
    tk1_2: "42/46/50",
    tk1_3: "75/73/72",
    tk1_4: "74/72/71",
    gHum1: -0.92,
    incQ1: null,
    triz1: 10.5,
    pres2Bar: 0.05,
    rpm2: 4,
    tReposo2Min: 120,
    tk2_1: "46/48/50",
    tk2_2: "42/46/50",
    tk2_3: "75/73/72",
    tk2_4: "74-72-71",
    gHum2: 0.08,
    incQ2: 6.4,
    triz2: null,
    pesoCoccion: "0.446",
    quebradoCoccionPct: 11.2,
    abiertoCoccionPct: 1.6,
    hinchadoCoccionPct: 10.3,
    desplazamientoCoccionSeg: 28.0,
    notasExito: "Incremento de quebrado muy controlado (+6.4%) para lote húmedo (17.5% HI)."
  },
  {
    id: "317",
    tipoProceso: "PRESECADO",
    batch: 317,
    variedad: "VALOR",
    hi: 14.1,
    riPct: 78.8,
    rbPct: 71.46,
    qPct: 11.48,
    ttPct: 1.0,
    pPct: 4.14,
    mPct: 1.18,
    tzPct: 2.12,
    giPct: 1.2,
    gVerdePct: null,
    blIPct: 22.3,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.05,
    rpm1: 4,
    tReposo1Min: 45,
    tk1_1: "46/48/50",
    tk1_2: "65/53/41",
    tk1_3: "56/57/58",
    tk1_4: "50/53/57",
    gHum1: 4.32,
    incQ1: null,
    triz1: 18.6,
    pres2Bar: 0.08,
    rpm2: 4,
    tReposo2Min: null,
    tk2_1: "79/77/75",
    tk2_2: "84/82/80",
    tk2_3: "90/86/82",
    tk2_4: "86-82-78",
    gHum2: 1.3,
    incQ2: 18.2,
    triz2: null,
    pesoCoccion: "0.437",
    quebradoCoccionPct: 17.6,
    abiertoCoccionPct: 0.8,
    hinchadoCoccionPct: 4.7,
    desplazamientoCoccionSeg: 21.6
  },
  {
    id: "318",
    tipoProceso: "HUMEDO",
    batch: 318,
    variedad: "FERON",
    hi: 21.96,
    riPct: 77.0,
    rbPct: 69.5,
    qPct: 15.4,
    ttPct: 4.1,
    pPct: 6.0,
    mPct: 1.2,
    tzPct: 2.4,
    giPct: 2.8,
    gVerdePct: 2.8,
    blIPct: 21.8,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.40,
    rpm1: 6,
    tReposo1Min: 30,
    tk1_1: "99/92/86",
    tk1_2: "99/93/88",
    tk1_3: "99/93/87",
    tk1_4: "88/87/86",
    gHum1: -6.8,
    incQ1: null,
    triz1: 1.0,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: "0.426",
    quebradoCoccionPct: 3.4,
    abiertoCoccionPct: 1.2,
    hinchadoCoccionPct: 4.0,
    desplazamientoCoccionSeg: 2.3,
    esMasExitoso: true,
    notasExito: "★ GOLDEN BATCH FERON: Humedad 21.96%, vaporizado a 0.40 bar / 6 rpm exclusa / 30m reposo. En olla dio solo 3.4% quebrado y desplazamiento récord de 2.3 seg."
  },
  {
    id: "319",
    tipoProceso: "PRESECADO",
    batch: 319,
    variedad: "SANTA CRUZ",
    hi: 12.5,
    riPct: 78.0,
    rbPct: 70.0,
    qPct: 14.6,
    ttPct: 4.0,
    pPct: 14.6,
    mPct: 1.0,
    tzPct: 1.7,
    giPct: 0.8,
    gVerdePct: null,
    blIPct: 23.3,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.05,
    rpm1: 4,
    tReposo1Min: 47,
    tk1_1: "59/63/68",
    tk1_2: "60/61/62",
    tk1_3: "58/61/65",
    tk1_4: null,
    gHum1: 3.93,
    incQ1: null,
    triz1: 7.03,
    pres2Bar: 0.08,
    rpm2: 4,
    tReposo2Min: 120,
    tk2_1: "91/86/91",
    tk2_2: "7/79/80",
    tk2_3: null,
    tk2_4: null,
    gHum2: 0.17,
    incQ2: 12.73,
    triz2: null,
    pesoCoccion: "0.432",
    quebradoCoccionPct: 19.8,
    abiertoCoccionPct: 1.2,
    hinchadoCoccionPct: 6.6,
    desplazamientoCoccionSeg: 17.2
  },
  {
    id: "320",
    tipoProceso: "SECO",
    batch: 320,
    variedad: "PAKAMURO",
    hi: null,
    riPct: null,
    rbPct: null,
    qPct: null,
    ttPct: null,
    pPct: null,
    mPct: null,
    tzPct: null,
    giPct: null,
    gVerdePct: null,
    blIPct: null,
    blPPct: null,
    remPct: null,
    pres1Bar: null,
    rpm1: null,
    tReposo1Min: null,
    tk1_1: null,
    tk1_2: null,
    tk1_3: null,
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null
  },
  {
    id: "321",
    tipoProceso: "PRESECADO",
    batch: 321,
    variedad: "VALOR",
    hi: 13.5,
    riPct: 78.1,
    rbPct: 70.87,
    qPct: 12.06,
    ttPct: 2.33,
    pPct: 6.6,
    mPct: 2.06,
    tzPct: 2.7,
    giPct: 1.5,
    gVerdePct: 1.4,
    blIPct: 22.03,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 6,
    tReposo1Min: 30,
    tk1_1: "51/57/63",
    tk1_2: "58/61/65",
    tk1_3: "52/56/60",
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 60,
    tk2_1: "51/57/63",
    tk2_2: "58/61/65",
    tk2_3: "52/56/60",
    tk2_4: null,
    gHum2: 2.94,
    incQ2: 7.7,
    triz2: null,
    pesoCoccion: "0.413",
    quebradoCoccionPct: 16.6,
    abiertoCoccionPct: 1.1,
    hinchadoCoccionPct: 12.6,
    desplazamientoCoccionSeg: 26.0,
    notasExito: "Buen balance de reposo (30m / 60m) con 6 rpm exclusa y presiones bajas de 0.08 / 0.07 bar."
  },
  {
    id: "322",
    tipoProceso: "HUMEDO",
    batch: 322,
    variedad: "MEZCLA/PAKAMURO",
    hi: 14.8,
    riPct: 78.5,
    rbPct: 13.8,
    qPct: 19.5,
    ttPct: 7.05,
    pPct: 10.9,
    mPct: 1.45,
    tzPct: 5.15,
    giPct: 1.15,
    gVerdePct: null,
    blIPct: 23.35,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 6,
    tReposo1Min: 35,
    tk1_1: "50/52/55",
    tk1_2: "52/54/56",
    tk1_3: null,
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 90,
    tk2_1: "50/52/55",
    tk2_2: "52/54/56",
    tk2_3: null,
    tk2_4: null,
    gHum2: 9.7,
    incQ2: 26.5,
    triz2: null,
    pesoCoccion: "0.436",
    quebradoCoccionPct: 33.2,
    abiertoCoccionPct: 8.2,
    hinchadoCoccionPct: 15.2,
    desplazamientoCoccionSeg: 35.8
  },
  {
    id: "323",
    tipoProceso: "HUMEDO",
    batch: 323,
    variedad: "FERON",
    hi: 15.0,
    riPct: 76.9,
    rbPct: 69.0,
    qPct: 23.0,
    ttPct: 5.0,
    pPct: 8.3,
    mPct: 1.2,
    tzPct: 1.0,
    giPct: 2.0,
    gVerdePct: null,
    blIPct: 23.1,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.35,
    rpm1: 7,
    tReposo1Min: 40,
    tk1_1: "68/68/71",
    tk1_2: null,
    tk1_3: "79/80/82",
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: "0.448/1.280",
    quebradoCoccionPct: 0.4,
    abiertoCoccionPct: 5.8,
    hinchadoCoccionPct: 7.6,
    desplazamientoCoccionSeg: 1.0,
    esMasExitoso: true,
    notasExito: "★ QUEBRADO MÍNIMO EN OLLA: 0.4% con desplazamiento ultra-rápido de 1 seg. Presión 0.35 bar, exclusa 7 rpm, reposo 40 min."
  },
  {
    id: "324",
    tipoProceso: "PRESECADO",
    batch: 324,
    variedad: "FERON",
    hi: 13.43,
    riPct: 77.93,
    rbPct: 71.0,
    qPct: 13.0,
    ttPct: 3.2,
    pPct: 5.2,
    mPct: 3.13,
    tzPct: 2.03,
    giPct: 0.9,
    gVerdePct: null,
    blIPct: 22.53,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 6,
    tReposo1Min: 42,
    tk1_1: "51/58/65",
    tk1_2: "65/64/63",
    tk1_3: "59/64/70",
    tk1_4: null,
    gHum1: 8.1,
    incQ1: null,
    triz1: 9.85,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 80,
    tk2_1: "51/58/65",
    tk2_2: "65/64/63",
    tk2_3: "59/64/70",
    tk2_4: null,
    gHum2: -2.8,
    incQ2: 11.0,
    triz2: null,
    pesoCoccion: "0.448/1.256",
    quebradoCoccionPct: 19.5,
    abiertoCoccionPct: 1.0,
    hinchadoCoccionPct: 4.3,
    desplazamientoCoccionSeg: 27.0
  },
  {
    id: "325",
    tipoProceso: "HUMEDO",
    batch: 325,
    variedad: "FERON",
    hi: 20.8,
    riPct: 74.7,
    rbPct: 66.4,
    qPct: 18.1,
    ttPct: 2.1,
    pPct: 5.85,
    mPct: 1.85,
    tzPct: 2.2,
    giPct: 2.4,
    gVerdePct: 7.8,
    blIPct: 22.25,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.40,
    rpm1: 7,
    tReposo1Min: 40,
    tk1_1: "94/88/87",
    tk1_2: "94/86/78",
    tk1_3: null,
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: "0.414/1.267",
    quebradoCoccionPct: 4.9,
    abiertoCoccionPct: 1.5,
    hinchadoCoccionPct: 1.4,
    desplazamientoCoccionSeg: 1.0,
    esMasExitoso: true,
    notasExito: "★ EXCELENTE COCCIÓN: 4.9% quebrado en olla y 1.0 seg desplazamiento. Para grano húmedo (>20%), 0.40 bar y 40m reposo funciona de forma magistral."
  },
  {
    id: "326",
    tipoProceso: "PRESECADO",
    batch: 326,
    variedad: "VALOR",
    hi: 12.5,
    riPct: 77.9,
    rbPct: 70.6,
    qPct: 14.35,
    ttPct: 1.85,
    pPct: 7.4,
    mPct: 1.3,
    tzPct: 1.6,
    giPct: 1.1,
    gVerdePct: 1.5,
    blIPct: 22.2,
    blPPct: null,
    remPct: null,
    pres1Bar: null,
    rpm1: 4,
    tReposo1Min: 44,
    tk1_1: "69/71/71",
    tk1_2: "53/62/70",
    tk1_3: null,
    tk1_4: null,
    gHum1: 6.15,
    incQ1: null,
    triz1: 5.4,
    pres2Bar: 0.08,
    rpm2: 4,
    tReposo2Min: 60,
    tk2_1: "69/71/71",
    tk2_2: "53/62/70",
    tk2_3: null,
    tk2_4: null,
    gHum2: -2.2,
    incQ2: 5.0,
    triz2: null,
    pesoCoccion: "0.456/1.260",
    quebradoCoccionPct: 14.1,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: 36.5,
    desplazamientoCoccionSeg: 31.0,
    esMasExitoso: true,
    notasExito: "★ MÍNIMO INCREMENTO DE QUEBRADO (+5.0%): Exclusa lenta a 4 rpm y reposos de 44m y 60m para grano seco/presecado (12.5% HI)."
  },
  {
    id: "327",
    tipoProceso: "PRESECADO",
    batch: 327,
    variedad: "VALOR/PAKAMURO",
    hi: 14.3,
    riPct: null,
    rbPct: null,
    qPct: null,
    ttPct: null,
    pPct: null,
    mPct: null,
    tzPct: null,
    giPct: null,
    gVerdePct: null,
    blIPct: null,
    blPPct: null,
    remPct: null,
    ausenciaAnalisis: true,
    pres1Bar: 0.08,
    rpm1: 7,
    tReposo1Min: 35,
    tk1_1: "50/52/55",
    tk1_2: "53/54/56",
    tk1_3: "70/67/64",
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: 0.07,
    rpm2: 7,
    tReposo2Min: 70,
    tk2_1: "77/73/69",
    tk2_2: "70/67/64",
    tk2_3: "73/71/70",
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: 25.1,
    abiertoCoccionPct: 4.3,
    hinchadoCoccionPct: 16.1,
    desplazamientoCoccionSeg: 38.2
  },
  {
    id: "328",
    tipoProceso: "HUMEDO",
    batch: 328,
    variedad: "VALOR",
    hi: 14.4,
    riPct: 78.1,
    rbPct: 70.8,
    qPct: 10.65,
    ttPct: 1.35,
    pPct: 4.9,
    mPct: 1.7,
    tzPct: 2.85,
    giPct: 1.0,
    gVerdePct: null,
    blIPct: 22.9,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 7,
    tReposo1Min: 60,
    tk1_1: "48/52/56",
    tk1_2: "56/57/58",
    tk1_3: "70/70/71",
    tk1_4: null,
    gHum1: 2.95,
    incQ1: null,
    triz1: 3.42,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 70,
    tk2_1: "70/70/71",
    tk2_2: "76/73/69",
    tk2_3: null,
    tk2_4: null,
    gHum2: -0.7,
    incQ2: 9.8,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null
  },
  {
    id: "329",
    tipoProceso: "PRESECADO",
    batch: 329,
    variedad: "VALOR/PAKAMURO",
    hi: null,
    riPct: null,
    rbPct: null,
    qPct: null,
    ttPct: null,
    pPct: null,
    mPct: null,
    tzPct: null,
    giPct: null,
    gVerdePct: null,
    blIPct: null,
    blPPct: null,
    remPct: null,
    ausenciaAnalisis: true,
    pres1Bar: 0.08,
    rpm1: 7,
    tReposo1Min: 35,
    tk1_1: "46/50/54",
    tk1_2: "49/58/68",
    tk1_3: "75/73/72",
    tk1_4: null,
    gHum1: null,
    incQ1: null,
    triz1: null,
    pres2Bar: 0.08,
    rpm2: 6,
    tReposo2Min: 60,
    tk2_1: "46/50/54",
    tk2_2: "49/58/68",
    tk2_3: "75/73/72",
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: "0.440",
    quebradoCoccionPct: 12.7,
    abiertoCoccionPct: 6.1,
    hinchadoCoccionPct: 23.4,
    desplazamientoCoccionSeg: 33.2
  },
  {
    id: "330",
    tipoProceso: "PRESECADO",
    batch: 330,
    variedad: "TINAJONES",
    hi: 21.6,
    riPct: 76.9,
    rbPct: 69.67,
    qPct: 15.2,
    ttPct: 1.53,
    pPct: 7.3,
    mPct: 1.8,
    tzPct: 2.0,
    giPct: 1.06,
    gVerdePct: null,
    blIPct: null,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 7,
    tReposo1Min: 35,
    tk1_1: "56/52/49",
    tk1_2: "54/51/49",
    tk1_3: "76/73/70",
    tk1_4: null,
    gHum1: 0.9,
    incQ1: null,
    triz1: 2.9,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 65,
    tk2_1: "56/52/49",
    tk2_2: "54/51/49",
    tk2_3: "76/73/70",
    tk2_4: null,
    gHum2: -1.375,
    incQ2: 3.5,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null,
    esMasExitoso: true,
    notasExito: "★ GOLDEN BATCH TINAJONES: Humedad 21.6%, incremento de quebrado extraordinario de solo +3.5%! PRES-1: 0.08 bar / RPM: 7 / Reposo 1: 35m; PRES-2: 0.07 bar / RPM: 6 / Reposo 2: 65m."
  },
  {
    id: "331",
    tipoProceso: "HUMEDO",
    batch: 331,
    variedad: "FERON",
    hi: 18.1,
    riPct: 74.5,
    rbPct: 66.4,
    qPct: 21.2,
    ttPct: 1.8,
    pPct: 4.8,
    mPct: 1.0,
    tzPct: 1.2,
    giPct: 2.8,
    gVerdePct: 6.4,
    blIPct: 24.4,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.40,
    rpm1: 7,
    tReposo1Min: 40,
    tk1_1: "99/91/84",
    tk1_2: "99/93/87",
    tk1_3: "88/89/90",
    tk1_4: null,
    gHum1: -5.1,
    incQ1: null,
    triz1: 0.8,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null
  },
  {
    id: "332",
    tipoProceso: "PRESECADO",
    batch: 332,
    variedad: "VALOR",
    hi: 14.0,
    riPct: 79.35,
    rbPct: 71.8,
    qPct: 11.9,
    ttPct: 1.6,
    pPct: 6.35,
    mPct: 3.1,
    tzPct: 2.1,
    giPct: 1.0,
    gVerdePct: null,
    blIPct: 21.6,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 7,
    tReposo1Min: 30,
    tk1_1: "49/52/55",
    tk1_2: "54/55/56",
    tk1_3: "79/76/74",
    tk1_4: null,
    gHum1: 5.05,
    incQ1: null,
    triz1: 2.75,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 80,
    tk2_1: "49/52/55",
    tk2_2: "54/55/56",
    tk2_3: "79/76/74",
    tk2_4: null,
    gHum2: 0.0,
    incQ2: 3.45,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null,
    esMasExitoso: true,
    notasExito: "★ GOLDEN BATCH VALOR: Humedad 14.0%, récord de menor quebrado: solo +3.45% de incremento! PRES-1: 0.08 bar / RPM: 7 / Reposo 1: 30m; PRES-2: 0.07 bar / RPM: 6 / Reposo 2: 80m."
  },
  {
    id: "333",
    tipoProceso: "SECO",
    batch: 333,
    variedad: "VALOR",
    hi: 11.75,
    riPct: 78.93,
    rbPct: 71.78,
    qPct: 15.2,
    ttPct: 1.45,
    pPct: 3.85,
    mPct: 2.18,
    tzPct: 2.85,
    giPct: 1.28,
    gVerdePct: null,
    blIPct: 22.4,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 7,
    tReposo1Min: 30,
    tk1_1: "57/56/56",
    tk1_2: "53/55/58",
    tk1_3: "80/77/74",
    tk1_4: null,
    gHum1: 7.1,
    incQ1: null,
    triz1: 5.12,
    pres2Bar: 0.07,
    rpm2: 6,
    tReposo2Min: 90,
    tk2_1: "57/56/56",
    tk2_2: "53/55/58",
    tk2_3: "80/77/74",
    tk2_4: null,
    gHum2: 0.2,
    incQ2: 5.8,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null,
    notasExito: "Excelente para lote seco (11.75% HI): solo +5.8% incremento de quebrado con 90m reposo en pase 2."
  },
  {
    id: "334",
    tipoProceso: "HUMEDO",
    batch: 334,
    variedad: "FERON",
    hi: 20.7,
    riPct: 75.8,
    rbPct: 68.0,
    qPct: 20.1,
    ttPct: 5.2,
    pPct: 8.6,
    mPct: 1.0,
    tzPct: 1.0,
    giPct: 3.4,
    gVerdePct: null,
    blIPct: 22.2,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.45,
    rpm1: 7,
    tReposo1Min: 30,
    tk1_1: "98/91/87",
    tk1_2: "98/91/84",
    tk1_3: "97/91/87",
    tk1_4: null,
    gHum1: -5.3,
    incQ1: null,
    triz1: 0.8,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null
  },
  {
    id: "335",
    tipoProceso: "PRESECADO",
    batch: 335,
    variedad: "SANTA CRUZ",
    hi: 11.38,
    riPct: 75.35,
    rbPct: 72.4,
    qPct: 11.13,
    ttPct: 4.2,
    pPct: 8.93,
    mPct: 1.6,
    tzPct: 2.4,
    giPct: 1.2,
    gVerdePct: null,
    blIPct: 24.3,
    blPPct: 41.38,
    remPct: null,
    pres1Bar: 0.08,
    rpm1: 6,
    tReposo1Min: 37,
    tk1_1: "51/56/61",
    tk1_2: "54/55/57",
    tk1_3: "61/63/65",
    tk1_4: null,
    gHum1: 2.1,
    incQ1: null,
    triz1: 4.84,
    pres2Bar: 0.10,
    rpm2: 7,
    tReposo2Min: 90,
    tk2_1: "77/77/78",
    tk2_2: "70/76/82",
    tk2_3: "83/82/82",
    tk2_4: null,
    gHum2: -2.13,
    incQ2: 6.68,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null,
    esMasExitoso: true,
    notasExito: "★ GOLDEN BATCH SANTA CRUZ: Incremento de quebrado de solo +6.68% en grano seco (11.38% HI). PRES-1: 0.08 bar / RPM: 6 / Reposo 1: 37m; PRES-2: 0.10 bar / RPM: 7 / Reposo 2: 90m."
  },
  {
    id: "336",
    tipoProceso: "HUMEDO",
    batch: 336,
    variedad: "FERON",
    hi: 22.5,
    riPct: 76.0,
    rbPct: 68.2,
    qPct: 13.1,
    ttPct: 4.4,
    pPct: 6.6,
    mPct: 0.8,
    tzPct: 1.0,
    giPct: 2.0,
    gVerdePct: null,
    blIPct: 21.5,
    blPPct: null,
    remPct: null,
    pres1Bar: 0.35,
    rpm1: 7,
    tReposo1Min: 40,
    tk1_1: "98/91/85",
    tk1_2: "99/92/86",
    tk1_3: "98/92/86",
    tk1_4: null,
    gHum1: -7.5,
    incQ1: null,
    triz1: 0.6,
    pres2Bar: null,
    rpm2: null,
    tReposo2Min: null,
    tk2_1: null,
    tk2_2: null,
    tk2_3: null,
    tk2_4: null,
    gHum2: null,
    incQ2: null,
    triz2: null,
    pesoCoccion: null,
    quebradoCoccionPct: null,
    abiertoCoccionPct: null,
    hinchadoCoccionPct: null,
    desplazamientoCoccionSeg: null,
    notasExito: "Humedad alta (22.5%): trizado resultante mínimo de 0.6% gracias a 0.35 bar y 40m de reposo."
  }
];

/**
 * Calcula el puntaje de éxito industrial (0 a 100) para un batch de la sábana
 */
export function calcularPuntajeExitoBatch(b: HistorialBatchTrabajado): number {
  let score = 80;

  // 1. Incremento de quebrado (el factor más crítico para el rendimiento industrial)
  const incQ = b.incQ2 ?? b.incQ1;
  if (incQ !== null && incQ !== undefined) {
    if (incQ <= 4.0) score += 15;
    else if (incQ <= 7.0) score += 10;
    else if (incQ <= 12.0) score += 2;
    else if (incQ > 20.0) score -= 20;
    else if (incQ > 15.0) score -= 10;
  }

  // 2. Trizado resultante
  const triz = b.triz1 ?? b.triz2;
  if (triz !== null && triz !== undefined) {
    if (triz <= 1.5) score += 8;
    else if (triz <= 3.5) score += 4;
    else if (triz > 10) score -= 8;
  }

  // 3. Resultado de Cocción (si existe)
  if (b.quebradoCoccionPct !== null && b.quebradoCoccionPct !== undefined) {
    if (b.quebradoCoccionPct <= 5.0) score += 12;
    else if (b.quebradoCoccionPct <= 12.0) score += 6;
    else if (b.quebradoCoccionPct > 20.0) score -= 10;
  }

  if (b.abiertoCoccionPct !== null && b.abiertoCoccionPct !== undefined) {
    if (b.abiertoCoccionPct <= 1.5) score += 6;
    else if (b.abiertoCoccionPct > 5.0) score -= 6;
  }

  if (b.desplazamientoCoccionSeg !== null && b.desplazamientoCoccionSeg !== undefined) {
    if (b.desplazamientoCoccionSeg <= 5.0) score += 8; // súper suelto
    else if (b.desplazamientoCoccionSeg <= 20.0) score += 4;
  }

  return Math.min(100, Math.max(40, Math.round(score)));
}

/**
 * Obtiene la lista completa de batches trabajados con puntajes de éxito calculados
 */
export function obtenerHistorialBatches(): HistorialBatchTrabajado[] {
  try {
    const raw = localStorage.getItem(SABANA_BATCHES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(b => ({
          ...b,
          puntajeExito: calcularPuntajeExitoBatch(b)
        }));
      }
    }
  } catch (err) {
    console.error("Error leyendo sábana de batches:", err);
  }

  // Base limpia para producción
  return [];
}

/**
 * Limpia la sábana de batches en localStorage
 */
export function limpiarHistorialBatches(): void {
  try {
    localStorage.setItem(SABANA_BATCHES_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error("Error limpiando sábana de batches:", err);
  }
}

/**
 * Guarda la sábana de batches en localStorage
 */
export function guardarHistorialBatches(items: HistorialBatchTrabajado[]): void {
  try {
    localStorage.setItem(SABANA_BATCHES_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("Error guardando sábana de batches:", err);
  }
}

/**
 * Agrega o actualiza un batch en la sábana
 */
export function guardarBatchEnSabana(batchData: Partial<HistorialBatchTrabajado>): HistorialBatchTrabajado[] {
  const actuales = obtenerHistorialBatches();
  const idStr = String(batchData.batch || batchData.id || Date.now());
  const idx = actuales.findIndex(b => String(b.batch) === idStr || b.id === idStr);

  const itemCompleto: HistorialBatchTrabajado = {
    id: idStr,
    batch: batchData.batch || idStr,
    tipoProceso: batchData.tipoProceso || "PRESECADO",
    variedad: batchData.variedad || "VALOR",
    hi: batchData.hi !== undefined ? batchData.hi : null,
    riPct: batchData.riPct !== undefined ? batchData.riPct : null,
    rbPct: batchData.rbPct !== undefined ? batchData.rbPct : null,
    qPct: batchData.qPct !== undefined ? batchData.qPct : null,
    ttPct: batchData.ttPct !== undefined ? batchData.ttPct : null,
    pPct: batchData.pPct !== undefined ? batchData.pPct : null,
    mPct: batchData.mPct !== undefined ? batchData.mPct : null,
    tzPct: batchData.tzPct !== undefined ? batchData.tzPct : null,
    giPct: batchData.giPct !== undefined ? batchData.giPct : null,
    gVerdePct: batchData.gVerdePct !== undefined ? batchData.gVerdePct : null,
    blIPct: batchData.blIPct !== undefined ? batchData.blIPct : null,
    blPPct: batchData.blPPct !== undefined ? batchData.blPPct : null,
    remPct: batchData.remPct !== undefined ? batchData.remPct : null,
    ausenciaAnalisis: batchData.ausenciaAnalisis || false,
    pres1Bar: batchData.pres1Bar !== undefined ? batchData.pres1Bar : null,
    rpm1: batchData.rpm1 !== undefined ? batchData.rpm1 : null,
    tReposo1Min: batchData.tReposo1Min !== undefined ? batchData.tReposo1Min : null,
    tk1_1: batchData.tk1_1 || null,
    tk1_2: batchData.tk1_2 || null,
    tk1_3: batchData.tk1_3 || null,
    tk1_4: batchData.tk1_4 || null,
    gHum1: batchData.gHum1 !== undefined ? batchData.gHum1 : null,
    incQ1: batchData.incQ1 !== undefined ? batchData.incQ1 : null,
    triz1: batchData.triz1 !== undefined ? batchData.triz1 : null,
    pres2Bar: batchData.pres2Bar !== undefined ? batchData.pres2Bar : null,
    rpm2: batchData.rpm2 !== undefined ? batchData.rpm2 : null,
    tReposo2Min: batchData.tReposo2Min !== undefined ? batchData.tReposo2Min : null,
    tk2_1: batchData.tk2_1 || null,
    tk2_2: batchData.tk2_2 || null,
    tk2_3: batchData.tk2_3 || null,
    tk2_4: batchData.tk2_4 || null,
    gHum2: batchData.gHum2 !== undefined ? batchData.gHum2 : null,
    incQ2: batchData.incQ2 !== undefined ? batchData.incQ2 : null,
    triz2: batchData.triz2 !== undefined ? batchData.triz2 : null,
    pesoCoccion: batchData.pesoCoccion !== undefined ? batchData.pesoCoccion : null,
    quebradoCoccionPct: batchData.quebradoCoccionPct !== undefined ? batchData.quebradoCoccionPct : null,
    abiertoCoccionPct: batchData.abiertoCoccionPct !== undefined ? batchData.abiertoCoccionPct : null,
    hinchadoCoccionPct: batchData.hinchadoCoccionPct !== undefined ? batchData.hinchadoCoccionPct : null,
    desplazamientoCoccionSeg: batchData.desplazamientoCoccionSeg !== undefined ? batchData.desplazamientoCoccionSeg : null,
    notasExito: batchData.notasExito
  };

  itemCompleto.puntajeExito = calcularPuntajeExitoBatch(itemCompleto);

  let nuevaLista: HistorialBatchTrabajado[];
  if (idx >= 0) {
    nuevaLista = [...actuales];
    nuevaLista[idx] = itemCompleto;
  } else {
    nuevaLista = [itemCompleto, ...actuales];
  }

  guardarHistorialBatches(nuevaLista);
  return nuevaLista;
}

/**
 * MOTOR DE RECOMENDACIÓN INTELIGENTE DE RECETAS BASADO EN PARÁMETROS DE INGRESO
 * Permite al usuario consultar: "Para una nueva variedad y humedad de ingreso dada,
 * ¿cuál fue el lote/batch más exitoso y qué parámetros de presión, velocidad de exclusa
 * y tiempo de reposo me conviene replicar?"
 */
export function recomendarRecetaPorPerfilIngreso(
  variedadBuscada: string,
  humedadIngreso: number = 14.0,
  quebradoIngreso?: number,
  tipoProcesoForzado?: "PRESECADO" | "HUMEDO" | "SECO"
): RecomendacionRecetaIngreso {
  const historial = obtenerHistorialBatches();
  const vNorm = variedadBuscada.trim().toUpperCase();

  // 1. Determinar el Tipo de Proceso según la Humedad de Ingreso si no viene forzado
  let tipoProceso: "PRESECADO" | "HUMEDO" | "SECO" = tipoProcesoForzado || "PRESECADO";
  if (!tipoProcesoForzado) {
    if (humedadIngreso >= 17.0) tipoProceso = "HUMEDO";
    else if (humedadIngreso <= 12.0) tipoProceso = "SECO";
    else tipoProceso = "PRESECADO";
  }

  // 2. Filtrar candidatos con prioridad:
  //    Nivel 1: Misma variedad y mismo tipo de proceso
  //    Nivel 2: Misma variedad
  //    Nivel 3: Mismo tipo de proceso (si es variedad nueva que no está en la sábana)
  let candidatos = historial.filter(b => 
    b.variedad.toUpperCase().includes(vNorm) || vNorm.includes(b.variedad.toUpperCase())
  );

  let esVariedadNueva = false;
  if (candidatos.length === 0) {
    esVariedadNueva = true;
    candidatos = historial.filter(b => b.tipoProceso === tipoProceso);
    if (candidatos.length === 0) candidatos = [...historial];
  }

  // 3. Rankear candidatos según cercanía de humedad y puntaje de éxito
  const candidatosEvaluados = candidatos.map(b => {
    let distanciaHum = 999;
    if (b.hi !== null && b.hi !== undefined) {
      distanciaHum = Math.abs(b.hi - humedadIngreso);
    }

    const exito = b.puntajeExito || calcularPuntajeExitoBatch(b);
    // Score combinado: 60% éxito histórico, 40% cercanía de humedad de ingreso
    const proximidadHum = Math.max(0, 100 - (distanciaHum * 12));
    const scoreTotal = (exito * 0.65) + (proximidadHum * 0.35);

    return {
      batch: b,
      scoreTotal,
      distanciaHum,
      exito
    };
  });

  candidatosEvaluados.sort((a, b) => b.scoreTotal - a.scoreTotal);

  const mejorCandidato = candidatosEvaluados[0]?.batch || historial[0];
  const requiereSegundoPase = mejorCandidato.pres2Bar !== null && mejorCandidato.pres2Bar !== undefined;

  // Extraer parámetros operativos
  const pres1 = mejorCandidato.pres1Bar ?? (tipoProceso === "HUMEDO" ? 0.35 : 0.08);
  const rpm1 = mejorCandidato.rpm1 ?? (tipoProceso === "HUMEDO" ? 7 : 6);
  const reposo1 = mejorCandidato.tReposo1Min ?? (tipoProceso === "HUMEDO" ? 40 : 35);

  const pres2 = mejorCandidato.pres2Bar ?? (requiereSegundoPase ? 0.07 : undefined);
  const rpm2 = mejorCandidato.rpm2 ?? (requiereSegundoPase ? 6 : undefined);
  const reposo2 = mejorCandidato.tReposo2Min ?? (requiereSegundoPase ? 70 : undefined);

  // Generar diagnósticos técnicos e industriales profundos para el operador
  let analisisPresion = "";
  if (tipoProceso === "HUMEDO") {
    analisisPresion = `Para condición HÚMEDA (${humedadIngreso.toFixed(1)}% HI), la evidencia de planta (Batch ${mejorCandidato.batch}) demuestra que conviene una presión constante de ${pres1.toFixed(2)} bar. Al tener grano con alta humedad, una presión moderada-alta gelatiniza el endospermo de manera uniforme sin necesidad de segundo pase.`;
  } else {
    analisisPresion = `Para condición ${tipoProceso} (${humedadIngreso.toFixed(1)}% HI), se debe trabajar con presión suave de ${pres1.toFixed(2)} bar en Primer Pase${requiereSegundoPase ? ` y ${pres2?.toFixed(2)} bar en Segundo Pase` : ""}. Esto evita el choque térmico brusco que genera cuarteado / trizado en granos con menor humedad.`;
  }

  let analisisVelocidadExclusa = "";
  if (rpm1 <= 4) {
    analisisVelocidadExclusa = `Velocidad de exclusa LENTA recomendada (${rpm1} RPM). Concede mayor tiempo de residencia por volumen y menor fricción mecánica, ideal para variedades con grano susceptible o presecados sensibles.`;
  } else if (rpm1 === 6) {
    analisisVelocidadExclusa = `Velocidad de exclusa ESTÁNDAR ÓPTIMA (${rpm1} RPM). Proporciona un caudal equilibrado de carga en el autoclave APIT, asegurando que cada capa de grano reciba el mismo caudal de vapor sin saturación de condensado.`;
  } else {
    analisisVelocidadExclusa = `Velocidad de exclusa ÁGIL (${rpm1} RPM). Maximiza la fluidez de entrada y evita sobrecalentamiento focal en tolva superior, logrando gelatinización homogénea.`;
  }

  let analisisTiempoReposo = "";
  if (requiereSegundoPase) {
    analisisTiempoReposo = `Régimen de 2 Pases con Reposo Escalonado: Primer reposo de ${reposo1} min (para redistribuir gradiente térmico de TK1 a TK3) y Segundo reposo de ${reposo2} min (esencial para templado y estabilización de humedad antes de la línea de secado). En el Batch ${mejorCandidato.batch} esta pauta logró ${mejorCandidato.incQ2 !== null ? `un incremento de quebrado mínimo de solo +${mejorCandidato.incQ2}%` : "excelente integridad física"}.`;
  } else {
    analisisTiempoReposo = `Régimen de 1 Pase con Reposo de ${reposo1} min. Tiempo suficiente para que el calor latente homogenice el núcleo del grano húmedo antes de enviar a secadora.`;
  }

  let prediccionIncrementoQuebrado = "";
  if (mejorCandidato.incQ2 !== null && mejorCandidato.incQ2 !== undefined) {
    prediccionIncrementoQuebrado = `Incremento estimado de quebrado: +${mejorCandidato.incQ2.toFixed(1)}% (Referencia histórica directa del Batch ${mejorCandidato.batch}).`;
  } else if (mejorCandidato.incQ1 !== null && mejorCandidato.incQ1 !== undefined) {
    prediccionIncrementoQuebrado = `Incremento estimado en pase 1: +${mejorCandidato.incQ1.toFixed(1)}%.`;
  } else {
    prediccionIncrementoQuebrado = `Rango previsto de incremento: +3.5% a +6.5% si se respeta la velocidad de exclusa y reposo.`;
  }

  let prediccionCoccion = "";
  if (mejorCandidato.quebradoCoccionPct !== null) {
    prediccionCoccion = `Resultado en Olla: ~${mejorCandidato.quebradoCoccionPct}% quebrado, ${mejorCandidato.abiertoCoccionPct || 1.2}% grano abierto y desplazamiento de ${mejorCandidato.desplazamientoCoccionSeg || 15} seg (100% grano suelto y entero).`;
  } else {
    prediccionCoccion = `Resultado en Olla esperado: Alto índice de soltura, grano entero sin apelmazamiento y excelente elongación axial.`;
  }

  const consejosOperador: string[] = [
    `Equipo: Procesar exclusivamente en Autoclave APIT (Capacidad 35 TN).`,
    `Verificar antes de iniciar: Calibrar manómetro a ${pres1} bar y regular variador de frecuencia de exclusa a ${rpm1} RPM.`,
    `Monitoreo de tanques: Controlar que las temperaturas en TK1 a TK3 sigan la rampa del Batch ${mejorCandidato.batch} (${mejorCandidato.tk1_1 || "50-75°C"}).`,
    `Respetar religiosamente el tiempo de reposo (${reposo1} min) antes de abrir compuertas o iniciar el 2do pase/secado para evitar estrés higrotérmico.`
  ];

  if (esVariedadNueva) {
    consejosOperador.unshift(`⚠️ Variedad Nueva (${vNorm}): Se toma como modelo base la receta del Batch ${mejorCandidato.batch} (${mejorCandidato.variedad}), que tiene un comportamiento higrotérmico y de grano análogo.`);
  }

  return {
    variedadBuscada: vNorm,
    humedadIngresoBuscada: humedadIngreso,
    tipoProcesoEstimado: tipoProceso,
    batchReferencia: mejorCandidato,
    puntajeCoincidencia: Math.round(candidatosEvaluados[0]?.scoreTotal || 90),
    presionPase1Bar: pres1,
    rpmExclusaPase1: rpm1,
    tiempoReposoPase1Min: reposo1,
    requiereSegundoPase,
    presionPase2Bar: pres2,
    rpmExclusaPase2: rpm2,
    tiempoReposoPase2Min: reposo2,
    analisisPresion,
    analisisVelocidadExclusa,
    analisisTiempoReposo,
    prediccionIncrementoQuebrado,
    prediccionCoccion,
    consejosOperador
  };
}
