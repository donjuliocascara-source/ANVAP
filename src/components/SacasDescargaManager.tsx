import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BatchVaporizado,
  BatchLote,
  Lote,
  AnalisisHumedo,
  Presecado,
  RegistroHumedad,
  ControlVaporizado,
  SacaBigBagItem,
  RegistroSacasDescarga
} from "../types";
import {
  PORCENTAJE_TOLERANCIA_DESCARGA,
  evaluarBalanceSacasDescarga,
  resolverDatosIngresoBatchParaDescarga,
  obtenerRegistroSacasDescargaBatch,
  guardarRegistroSacasDescargaBatch,
  parsearCantidadSacasEntrada,
  ParsedCantidadSacas
} from "../utils/sacasDescargaService";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Package,
  Calculator,
  Save,
  Info,
  X,
  Lock,
  Hash,
  Check,
  Camera,
  Upload,
  Eye,
  Trash2,
  Sparkles,
  Loader2,
  FileImage,
  BellRing,
  ShieldCheck,
  Edit3
} from "lucide-react";

interface SacasDescargaManagerProps {
  batchId: string;
  correlativo?: string;
  cliente?: string;
  variedad?: string;
  batch?: BatchVaporizado | null;
  controlData?: Partial<ControlVaporizado> | null;
  batchLotes?: BatchLote[];
  lotes?: Lote[];
  analisisHumList?: AnalisisHumedo[];
  humedades?: RegistroHumedad[];
  presecados?: Presecado[];
  controles?: ControlVaporizado[];
  programaciones?: any[];
  currentUserNombre?: string;
  variant?: "dark" | "light_sheet";
  onChangeRegistro?: (registro: RegistroSacasDescarga) => void;
  onSaved?: (registro: RegistroSacasDescarga) => void;
}

export const SacasDescargaManager: React.FC<SacasDescargaManagerProps> = ({
  batchId,
  correlativo,
  cliente,
  variedad,
  batch,
  controlData,
  batchLotes,
  lotes,
  analisisHumList,
  humedades,
  presecados,
  controles,
  programaciones,
  currentUserNombre = "Operador Balanza",
  variant = "dark",
  onChangeRegistro,
  onSaved
}) => {
  // Datos fijos del Batch solicitado (Peso de Ingreso y Humedad Promedio de Ingreso)
  const datosBase = useMemo(() => {
    return resolverDatosIngresoBatchParaDescarga({
      batchId,
      correlativo,
      batch,
      batchLotes,
      lotes,
      analisisHumList,
      humedades,
      presecados,
      controles,
      programaciones
    });
  }, [
    batchId,
    correlativo,
    batch,
    batchLotes,
    lotes,
    analisisHumList,
    humedades,
    presecados,
    controles,
    programaciones
  ]);

  // Valores fijos tomados directamente del batch solicitado (no editables)
  const pesoIngresoKg = datosBase.pesoIngresoKg;
  const humedadPromedioIngreso = datosBase.humedadPromedioIngreso;

  const [sacas, setSacas] = useState<SacaBigBagItem[]>([]);
  const [cantidadSacasInput, setCantidadSacasInput] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");
  const [alarmaAceptada, setAlarmaAceptada] = useState<boolean>(false);
  const [sustentoObservacionAlarma, setSustentoObservacionAlarma] = useState<string>("");
  const [aceptadoPor, setAceptadoPor] = useState<string | undefined>(undefined);
  const [fechaAceptacionAlarma, setFechaAceptacionAlarma] = useState<string | undefined>(undefined);
  const [isEditingSustento, setIsEditingSustento] = useState<boolean>(false);
  const [fotoFichaPesosUrl, setFotoFichaPesosUrl] = useState<string | undefined>(undefined);
  const [fotoFichaNombre, setFotoFichaNombre] = useState<string | undefined>(undefined);
  const [fotoFichaFecha, setFotoFichaFecha] = useState<string | undefined>(undefined);
  const [isExtractingFoto, setIsExtractingFoto] = useState<boolean>(false);
  const [fotoStatusMsg, setFotoStatusMsg] = useState<string | null>(null);
  const [showFotoZoomModal, setShowFotoZoomModal] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const pesoInputsRef = useRef<Record<number, HTMLInputElement | null>>({});
  const fotoFileInputRef = useRef<HTMLInputElement | null>(null);
  const fotoCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Cargar datos guardados cuando cambia el batchId
  useEffect(() => {
    const reg = obtenerRegistroSacasDescargaBatch(
      batchId,
      correlativo,
      datosBase,
      batch,
      controlData
    );
    const loadedSacas = reg.sacas || [];
    setSacas(loadedSacas);
    let textoInicial = reg.cantidadSacasTexto || "";
    if (!textoInicial && loadedSacas.length > 0) {
      const lastSaca = loadedSacas[loadedSacas.length - 1];
      if (lastSaca.esParcial && lastSaca.fraccionTexto) {
        textoInicial = `${loadedSacas.length - 1} ${lastSaca.fraccionTexto}`;
      } else {
        textoInicial = String(loadedSacas.length);
      }
    }
    setCantidadSacasInput(textoInicial);
    setObservaciones(reg.observaciones || "");
    setAlarmaAceptada(Boolean(reg.alarmaAceptada));
    setSustentoObservacionAlarma(reg.sustentoObservacionAlarma || reg.observaciones || "");
    setAceptadoPor(reg.aceptadoPor);
    setFechaAceptacionAlarma(reg.fechaAceptacionAlarma);
    setIsEditingSustento(false);
    setFotoFichaPesosUrl(reg.fotoFichaPesosUrl);
    setFotoFichaNombre(reg.fotoFichaNombre);
    setFotoFichaFecha(reg.fotoFichaFecha);
    setFotoStatusMsg(null);
  }, [batchId, correlativo, datosBase.batchId, datosBase.pesoIngresoKg, datosBase.humedadPromedioIngreso]);

  // Análisis reactivo de la expresión ingresada (admite 28, 28 1/4, 28 1/2, 28 3/4, 28.5, etc.)
  const parsedInput = useMemo(() => {
    return parsearCantidadSacasEntrada(cantidadSacasInput);
  }, [cantidadSacasInput]);

  // Evaluación reactiva en tiempo real usando siempre los valores fijos del batch
  const evaluacion = useMemo(() => {
    return evaluarBalanceSacasDescarga({
      batchId,
      correlativo: correlativo || batchId,
      cantidadSacasTexto: cantidadSacasInput.trim() || undefined,
      sacas,
      pesoIngresoKg,
      humedadPromedioIngreso,
      alarmaAceptada,
      sustentoObservacionAlarma,
      aceptadoPor,
      fechaAceptacionAlarma,
      observaciones,
      fotoFichaPesosUrl,
      fotoFichaNombre,
      fotoFichaFecha,
      actualizadoPor: currentUserNombre
    });
  }, [
    batchId,
    correlativo,
    cantidadSacasInput,
    sacas,
    pesoIngresoKg,
    humedadPromedioIngreso,
    alarmaAceptada,
    sustentoObservacionAlarma,
    aceptadoPor,
    fechaAceptacionAlarma,
    observaciones,
    fotoFichaPesosUrl,
    fotoFichaNombre,
    fotoFichaFecha,
    currentUserNombre
  ]);

  const toleranciaCalculadaKg = evaluacion.toleranciaKg;

  const rangoMinimoKg = useMemo(
    () => Number(Math.max(0, evaluacion.pesoProyectadoKg - toleranciaCalculadaKg).toFixed(2)),
    [evaluacion.pesoProyectadoKg, toleranciaCalculadaKg]
  );
  const rangoMaximoKg = useMemo(
    () => Number((evaluacion.pesoProyectadoKg + toleranciaCalculadaKg).toFixed(2)),
    [evaluacion.pesoProyectadoKg, toleranciaCalculadaKg]
  );

  const sacasConPesoCount = useMemo(
    () => sacas.filter((s) => Number(s.pesoKg) > 0).length,
    [sacas]
  );

  const persistirCambios = (
    nextSacas: SacaBigBagItem[],
    nextObs: string = observaciones,
    mostrarAviso: boolean = false,
    fotoMeta?: {
      url?: string;
      nombre?: string;
      fecha?: string;
    },
    alarmaMeta?: {
      aceptada: boolean;
      sustento: string;
      aceptadoPor?: string;
      fechaAceptacion?: string;
    },
    cantidadTextoOverride?: string
  ) => {
    const finalFotoUrl = fotoMeta !== undefined ? fotoMeta.url : fotoFichaPesosUrl;
    const finalFotoNombre = fotoMeta !== undefined ? fotoMeta.nombre : fotoFichaNombre;
    const finalFotoFecha = fotoMeta !== undefined ? fotoMeta.fecha : fotoFichaFecha;

    const finalAlarmaAceptada = alarmaMeta !== undefined ? alarmaMeta.aceptada : alarmaAceptada;
    const finalSustento = alarmaMeta !== undefined ? alarmaMeta.sustento : sustentoObservacionAlarma;
    const finalAceptadoPor = alarmaMeta !== undefined ? alarmaMeta.aceptadoPor : aceptadoPor;
    const finalFechaAceptacion = alarmaMeta !== undefined ? alarmaMeta.fechaAceptacion : fechaAceptacionAlarma;
    const finalCantidadTexto = cantidadTextoOverride !== undefined ? cantidadTextoOverride : cantidadSacasInput.trim() || undefined;

    const nuevoReg = evaluarBalanceSacasDescarga({
      batchId,
      correlativo: correlativo || batchId,
      cantidadSacasTexto: finalCantidadTexto,
      sacas: nextSacas,
      pesoIngresoKg,
      humedadPromedioIngreso,
      alarmaAceptada: finalAlarmaAceptada,
      sustentoObservacionAlarma: finalSustento,
      aceptadoPor: finalAceptadoPor,
      fechaAceptacionAlarma: finalFechaAceptacion,
      observaciones: nextObs,
      fotoFichaPesosUrl: finalFotoUrl,
      fotoFichaNombre: finalFotoNombre,
      fotoFichaFecha: finalFotoFecha,
      actualizadoPor: currentUserNombre
    });
    const guardado = guardarRegistroSacasDescargaBatch(nuevoReg, currentUserNombre);
    if (onChangeRegistro) onChangeRegistro(guardado);
    if (mostrarAviso) {
      if (onSaved) onSaved(guardado);
      setSaveMessage("Registro de Sacas Big Bag guardado y sincronizado.");
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleSustentarYAceptarAlarma = () => {
    const sustentoTrim = sustentoObservacionAlarma.trim();
    if (!sustentoTrim) return;

    const fechaStr = new Date().toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const usuarioAcepta = currentUserNombre || "Supervisor Planta";

    setAlarmaAceptada(true);
    setAceptadoPor(usuarioAcepta);
    setFechaAceptacionAlarma(fechaStr);
    setObservaciones(sustentoTrim);
    setIsEditingSustento(false);

    persistirCambios(
      sacas,
      sustentoTrim,
      false,
      undefined,
      {
        aceptada: true,
        sustento: sustentoTrim,
        aceptadoPor: usuarioAcepta,
        fechaAceptacion: fechaStr
      }
    );

    setSaveMessage(
      `Observación sustentada y aceptada. Se retiró la alarma de peso proyectado del Batch ${correlativo || batchId}.`
    );
    setTimeout(() => setSaveMessage(null), 4000);
  };

  const getHoraActual = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  // Comprimir imagen a base64 optimizado para almacenamiento local y en nube
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const rawDataUrl = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1400;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          resolve(compressed);
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
      reader.readAsDataURL(file);
    });
  };

  // Extraer los pesos de las sacas desde la foto de la ficha y aplicarlos a las sacas habilitadas
  const extraerPesosDesdeFotoFicha = async (
    b64Url: string,
    currentSacasList: SacaBigBagItem[],
    fotoMeta: { url?: string; nombre?: string; fecha?: string }
  ) => {
    if (!b64Url || currentSacasList.length === 0) return;
    setIsExtractingFoto(true);
    setFotoStatusMsg("Analizando foto de la ficha de pesos de las sacas...");

    try {
      const resp = await fetch("/api/ai/ocr-sacas-descarga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: b64Url,
          mimeType: "image/jpeg",
          cantidadSacasEsperadas: currentSacasList.length,
          batchCode: correlativo || batchId
        })
      });

      if (resp.ok) {
        const json = await resp.json();
        const pesosExtraidos: Array<{
          numero?: number;
          codigoSaca?: string;
          pesoKg?: number;
          horaPesaje?: string;
          observacion?: string;
        }> = Array.isArray(json?.pesos_sacas) ? json.pesos_sacas : [];

        const pesosValidos = pesosExtraidos.filter((p) => Number(p?.pesoKg) > 0);

        if (pesosValidos.length > 0) {
          const hora = getHoraActual();
          const nextSacas = currentSacasList.map((saca, idx) => {
            const matchByNum =
              pesosValidos.find((p) => Number(p.numero) === idx + 1) || pesosValidos[idx];
            if (matchByNum && Number(matchByNum.pesoKg) > 0) {
              return {
                ...saca,
                pesoKg: Number(Number(matchByNum.pesoKg).toFixed(2)),
                horaPesaje: matchByNum.horaPesaje || saca.horaPesaje || hora,
                observacion: matchByNum.observacion || saca.observacion || "Extraído de Ficha con Foto"
              };
            }
            return saca;
          });

          setSacas(nextSacas);
          persistirCambios(nextSacas, observaciones, false, fotoMeta);
          setFotoStatusMsg(
            `Foto de ficha guardada. Se detectaron y cargaron ${Math.min(
              pesosValidos.length,
              currentSacasList.length
            )} pesos de sacas en la tabla.`
          );
          return;
        }
      }

      setFotoStatusMsg(
        "Foto de la ficha de pesos adjuntada y guardada correctamente. Puede verificar o digitar los pesos en las filas habilitadas."
      );
    } catch {
      setFotoStatusMsg(
        "Foto de la ficha de pesos adjuntada y guardada correctamente."
      );
    } finally {
      setIsExtractingFoto(false);
    }
  };

  // Manejar subida o captura de foto de la ficha de pesos de las sacas
  const handleSubirFotoFichaPesos = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const b64 = await compressImageFile(file);
      const nowStr = new Date().toLocaleString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      const meta = {
        url: b64,
        nombre: file.name || `Ficha_Pesos_Batch_${correlativo || batchId}.jpg`,
        fecha: nowStr
      };

      setFotoFichaPesosUrl(meta.url);
      setFotoFichaNombre(meta.nombre);
      setFotoFichaFecha(meta.fecha);
      persistirCambios(sacas, observaciones, false, meta);

      await extraerPesosDesdeFotoFicha(b64, sacas, meta);
    } catch (err: any) {
      setFotoStatusMsg(err?.message || "No se pudo procesar la foto seleccionada.");
    }
  };

  const handleEliminarFotoFicha = () => {
    setFotoFichaPesosUrl(undefined);
    setFotoFichaNombre(undefined);
    setFotoFichaFecha(undefined);
    setFotoStatusMsg(null);
    persistirCambios(sacas, observaciones, false, {
      url: undefined,
      nombre: undefined,
      fecha: undefined
    });
  };

  // Habilitar la cantidad de Sacas de Descarga solicitada por el usuario (admite enteros y fracciones ej: 28 1/4, 28 1/2, 28 3/4 -> habilita 29)
  const handleHabilitarCantidadSacas = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parsearCantidadSacasEntrada(cantidadSacasInput);
    if (!parsed.cantidadValida || parsed.totalSacasHabilitar <= 0) return;
    const cantidadSegura = Math.min(200, Math.max(1, parsed.totalSacasHabilitar));

    const nuevasSacas: SacaBigBagItem[] = Array.from({ length: cantidadSegura }, (_, idx) => {
      const num = idx + 1;
      const existente = sacas[idx];
      const esUltimaParcial = parsed.esFraccionaria && num === cantidadSegura;

      let codigoSacaDefault = `SACA BIG BAG #${String(num).padStart(2, "0")}`;
      let observacionDefault = "";
      if (esUltimaParcial) {
        codigoSacaDefault = `SACA BIG BAG #${String(num).padStart(2, "0")} (PARCIAL ${parsed.fraccionStr})`;
        observacionDefault = `Saca parcial de ${parsed.fraccionStr} de capacidad`;
      }

      if (existente) {
        let codigoActualizado = existente.codigoSaca;
        // Si el código era estándar o ya contenía PARCIAL, sincronizar con la fracción actual
        if (!codigoActualizado || codigoActualizado.startsWith("SACA BIG BAG #") || codigoActualizado.startsWith("BIG BAG #")) {
          codigoActualizado = codigoSacaDefault;
        }
        return {
          ...existente,
          numero: num,
          codigoSaca: codigoActualizado,
          esParcial: esUltimaParcial,
          fraccionTexto: esUltimaParcial ? parsed.fraccionStr : undefined,
          observacion: existente.observacion || observacionDefault
        };
      }

      return {
        id: `SACA-${batchId}-${num}-${Date.now()}-${idx}`,
        numero: num,
        codigoSaca: codigoSacaDefault,
        pesoKg: 0,
        horaPesaje: "",
        observacion: observacionDefault,
        esParcial: esUltimaParcial,
        fraccionTexto: esUltimaParcial ? parsed.fraccionStr : undefined
      };
    });

    setSacas(nuevasSacas);
    persistirCambios(nuevasSacas, observaciones, false, undefined, undefined, cantidadSacasInput.trim());

    // Enfocar la primera saca sin peso (o la saca parcial si las anteriores ya tienen peso registrado)
    setTimeout(() => {
      const firstEmptyIdx = nuevasSacas.findIndex((s) => !s.pesoKg || s.pesoKg <= 0);
      const targetIdx = firstEmptyIdx >= 0 ? firstEmptyIdx : (parsed.esFraccionaria ? cantidadSegura - 1 : 0);
      pesoInputsRef.current[targetIdx]?.focus();
    }, 80);
  };

  // Botón rápido para alternar o agregar fracciones comunes (1/4, 1/2, 3/4)
  const handleAplicarFraccionRapida = (frac: "1/4" | "1/2" | "3/4" | "entero" | string) => {
    const cur = parsearCantidadSacasEntrada(cantidadSacasInput);
    let base = cur.cantidadValida && cur.enteras > 0 ? cur.enteras : 0;
    if (base === 0 && sacas.length > 0) {
      base = cur.esFraccionaria ? cur.enteras : sacas.length;
    }
    if (base === 0) base = 28;

    let nuevoTexto = "";
    if (frac === "entero") {
      nuevoTexto = String(base);
    } else {
      nuevoTexto = `${base} ${frac}`;
    }
    setCantidadSacasInput(nuevoTexto);
  };

  // Actualizar peso independiente en balanza o campo de una Saca Big Bag habilitada
  const handleActualizarSaca = (
    index: number,
    field: keyof SacaBigBagItem,
    value: string | number
  ) => {
    const nextSacas = sacas.map((item, idx) => {
      if (idx !== index) return item;
      if (field === "pesoKg") {
        const parsedPeso =
          value === "" ? 0 : Number(parseFloat(String(value)).toFixed(2)) || 0;
        return {
          ...item,
          pesoKg: parsedPeso,
          horaPesaje: parsedPeso > 0 ? item.horaPesaje || getHoraActual() : item.horaPesaje
        };
      }
      return {
        ...item,
        [field]: value
      };
    });
    setSacas(nextSacas);
    persistirCambios(nextSacas, observaciones, false);
  };

  const isLight = variant === "light_sheet";

  return (
    <div
      className={
        isLight
          ? "border-2 border-emerald-800 rounded-lg overflow-hidden bg-white text-slate-900 shadow-sm mt-4"
          : "bg-slate-900 border border-slate-750 rounded-2xl p-5 text-white shadow-xl space-y-5"
      }
    >
      {/* CABECERA DE LA SECCIÓN */}
      <div
        className={
          isLight
            ? "bg-[#1e4620] text-white font-bold py-2 px-3.5 text-xs tracking-wide uppercase flex flex-wrap items-center justify-between gap-2"
            : "flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4"
        }
      >
        <div className="flex items-center gap-2.5">
          <div
            className={
              isLight
                ? "p-1.5 rounded bg-amber-400/20 text-amber-300"
                : "p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400"
            }
          >
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={isLight ? "text-xs font-black text-white" : "text-base sm:text-lg font-black text-white"}>
                {isLight
                  ? `REGISTRO DE SACAS DE DESCARGA (BIG BAGS) POR BALANZA & COMPARACIÓN CON PESO PROYECTADO (± ${PORCENTAJE_TOLERANCIA_DESCARGA}% = ± ${toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} KG)`
                  : `Registro de Sacas de Descarga (Big Bags) — Batch ${correlativo || batchId}`}
              </h3>
              {evaluacion.estadoComparacion === "CONFORME" && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  CONFORME (± {PORCENTAJE_TOLERANCIA_DESCARGA}% = ± {toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg)
                </span>
              )}
              {evaluacion.alarmaActiva && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white flex items-center gap-1 animate-pulse shadow-lg shadow-rose-600/30">
                  <BellRing className="w-3 h-3" />
                  ALARMA ACTIVA: FUERA DE RANGO (± {PORCENTAJE_TOLERANCIA_DESCARGA}% = ± {toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg)
                </span>
              )}
              {evaluacion.alarmaAceptada && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  ACEPTADO CON SUSTENTO (ALARMA RETIRADA)
                </span>
              )}
            </div>
            {!isLight && (
              <p className="text-xs text-slate-400 mt-0.5">
                La <strong>Humedad Promedio</strong> y el <strong>Peso de Ingreso</strong> son valores fijos del batch solicitado. Indique el <strong>número de sacas de descarga</strong> para habilitar su pesaje o subir con foto la ficha de pesos.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => persistirCambios(sacas, observaciones, true)}
            className={
              isLight
                ? "px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10.5px] font-black flex items-center gap-1 shadow cursor-pointer"
                : "px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
            }
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Pesos Descarga</span>
          </button>
        </div>
      </div>

      <div className={isLight ? "p-3.5 space-y-4 bg-slate-50" : "space-y-5"}>
        {saveMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* BLOQUE 1: FÓRMULA OFICIAL DEL PESO PROYECTADO Y VALORES FIJOS DEL BATCH SOLICITADO */}
        <div
          className={
            isLight
              ? "bg-white border border-slate-300 rounded-xl p-3.5 shadow-2xs space-y-3"
              : "bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3"
          }
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Calculator className={isLight ? "w-4 h-4 text-emerald-700" : "w-4 h-4 text-amber-400"} />
              <span
                className={
                  isLight
                    ? "text-xs font-black uppercase text-slate-800"
                    : "text-xs font-black uppercase tracking-wider text-amber-300"
                }
              >
                Datos Fijos del Batch {correlativo || batchId} & Cálculo del Peso Proyectado (Base 12% Humedad)
              </span>
            </div>
            <div
              className={
                isLight
                  ? "text-[11px] font-mono bg-amber-50 border border-amber-300 text-amber-950 px-2.5 py-1 rounded-lg font-bold"
                  : "text-[11px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-200 px-3 py-1 rounded-lg font-bold"
              }
            >
              PESO PROYECTADO (kg) = ((100 - Hum. Prom. Ingreso) / (100 - 12)) × Peso de Ingreso
            </div>
          </div>

          {/* Desglose de lotes de ingreso y su humedad de análisis */}
          {datosBase.lotesDetalle.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={isLight ? "font-bold text-slate-600" : "font-bold text-slate-400"}>
                Lotes del Batch ({datosBase.lotesDetalle.length}{" "}
                {datosBase.lotesDetalle.length === 1 ? "lote" : "lotes"}):
              </span>
              {datosBase.lotesDetalle.map((l) => (
                <span
                  key={l.loteId}
                  className={
                    isLight
                      ? "px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 font-mono text-[10.5px]"
                      : "px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px]"
                  }
                  title={`Fuente: ${l.fuenteHumedad}`}
                >
                  <strong>{l.loteId}</strong>: {l.pesoKg.toLocaleString()} kg · Hum. Ingreso:{" "}
                  <strong className={isLight ? "text-emerald-700" : "text-cyan-300"}>
                    {l.humedadIngreso.toFixed(1)}%
                  </strong>
                </span>
              ))}
            </div>
          )}

          {/* Valores Fijos del Batch y Resultado de la Fórmula */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* 1. Humedad Promedio del Batch (Valor Fijo) */}
            <div
              className={
                isLight
                  ? "p-2.5 rounded-lg bg-slate-100 border border-slate-300"
                  : "p-3 rounded-xl bg-slate-900/90 border border-slate-800"
              }
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={
                    isLight
                      ? "text-[10px] font-black uppercase text-slate-600"
                      : "text-[10px] font-black uppercase text-slate-400"
                  }
                >
                  1. Humedad Promedio del Batch
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[9px] font-bold border border-slate-700">
                  <Lock className="w-2.5 h-2.5" /> Fijo Batch
                </span>
              </div>
              <div
                className={
                  isLight
                    ? "w-full bg-slate-200/70 border border-slate-300 rounded px-2.5 py-1.5 text-base font-black text-slate-900 font-mono flex items-center justify-between"
                    : "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-base font-black text-cyan-300 font-mono flex items-center justify-between"
                }
              >
                <span>{humedadPromedioIngreso.toFixed(1)}%</span>
                <span className="text-[10px] font-normal text-slate-500">Análisis Ingreso</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                100 - {humedadPromedioIngreso.toFixed(1)} = {(100 - humedadPromedioIngreso).toFixed(1)}
              </span>
            </div>

            {/* 2. Peso de Ingreso del Batch (Valor Fijo) */}
            <div
              className={
                isLight
                  ? "p-2.5 rounded-lg bg-slate-100 border border-slate-300"
                  : "p-3 rounded-xl bg-slate-900/90 border border-slate-800"
              }
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={
                    isLight
                      ? "text-[10px] font-black uppercase text-slate-600"
                      : "text-[10px] font-black uppercase text-slate-400"
                  }
                >
                  2. Peso de Ingreso del Batch
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[9px] font-bold border border-slate-700">
                  <Lock className="w-2.5 h-2.5" /> Fijo Batch
                </span>
              </div>
              <div
                className={
                  isLight
                    ? "w-full bg-slate-200/70 border border-slate-300 rounded px-2.5 py-1.5 text-base font-black text-slate-900 font-mono flex items-center justify-between"
                    : "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-base font-black text-white font-mono flex items-center justify-between"
                }
              >
                <span>{pesoIngresoKg.toLocaleString("en-US")} kg</span>
                <span className="text-[10px] font-normal text-emerald-400">
                  {(pesoIngresoKg / 1000).toFixed(2)} TN
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                Factor (100 - 12) = 88
              </span>
            </div>

            {/* 3. Peso Proyectado Calculado (kg) */}
            <div
              className={
                isLight
                  ? "p-2.5 rounded-lg bg-amber-50 border-2 border-amber-400"
                  : "p-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/40"
              }
            >
              <span
                className={
                  isLight
                    ? "block text-[10px] font-black uppercase text-amber-900"
                    : "block text-[10px] font-black uppercase text-amber-300"
                }
              >
                3. PESO PROYECTADO (kg)
              </span>
              <div
                className={
                  isLight
                    ? "text-lg font-black text-amber-950 font-mono mt-0.5"
                    : "text-xl font-black text-amber-300 font-mono mt-0.5"
                }
              >
                {evaluacion.pesoProyectadoKg.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{" "}
                kg
              </div>
              <span
                className={
                  isLight
                    ? "text-[10px] text-amber-800 font-mono block mt-0.5"
                    : "text-[10px] text-amber-200/80 font-mono block mt-0.5"
                }
              >
                = ((100 - {humedadPromedioIngreso.toFixed(1)}) / 88) ×{" "}
                {pesoIngresoKg.toLocaleString()}
              </span>
            </div>

            {/* 4. Rango de Tolerancia Permitido (± 1.5% del Peso de Ingreso) */}
            <div
              className={
                isLight
                  ? "p-2.5 rounded-lg bg-emerald-50 border border-emerald-300"
                  : "p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30"
              }
            >
              <span
                className={
                  isLight
                    ? "block text-[10px] font-black uppercase text-emerald-900"
                    : "block text-[10px] font-black uppercase text-emerald-300"
                }
              >
                4. Rango Permitido (± {PORCENTAJE_TOLERANCIA_DESCARGA}% Peso Ingreso)
              </span>
              <div
                className={
                  isLight
                    ? "text-sm font-black text-emerald-800 font-mono mt-0.5"
                    : "text-base font-black text-emerald-300 font-mono mt-0.5"
                }
              >
                Valor Rango: ±{" "}
                {toleranciaCalculadaKg.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{" "}
                kg
              </div>
              <span
                className={
                  isLight
                    ? "text-[9.5px] text-emerald-800 font-mono block"
                    : "text-[9.5px] text-emerald-400/90 font-mono block"
                }
              >
                ({PORCENTAJE_TOLERANCIA_DESCARGA}% × {pesoIngresoKg.toLocaleString("en-US")} kg = ±{" "}
                {toleranciaCalculadaKg.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{" "}
                kg)
              </span>
              <div
                className={
                  isLight
                    ? "text-[11px] font-black text-emerald-950 font-mono mt-1 pt-1 border-t border-emerald-200"
                    : "text-[11px] font-black text-emerald-200 font-mono mt-1 pt-1 border-t border-emerald-500/20"
                }
              >
                Mín (-{toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })}):{" "}
                {rangoMinimoKg.toLocaleString("en-US", { minimumFractionDigits: 2 })} kg
              </div>
              <div
                className={
                  isLight
                    ? "text-[11px] font-black text-emerald-950 font-mono"
                    : "text-[11px] font-black text-emerald-200 font-mono"
                }
              >
                Máx (+{toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })}):{" "}
                {rangoMaximoKg.toLocaleString("en-US", { minimumFractionDigits: 2 })} kg
              </div>
            </div>
          </div>
        </div>

        {/* BLOQUE 2: SOLICITAR N° DE SACAS DE DESCARGA, SUBIR FICHA CON FOTO Y REGISTRAR PESOS EN BALANZA */}
        <div
          className={
            isLight
              ? "bg-white border border-slate-300 rounded-xl p-3.5 space-y-3"
              : "bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4"
          }
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h4
                className={
                  isLight
                    ? "text-xs font-black uppercase text-slate-800 flex items-center gap-1.5"
                    : "text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5"
                }
              >
                <Package className="w-4 h-4 text-purple-400" />
                <span>Lista de Sacas de Descarga (Big Bags) — Pesaje Independiente por Balanza</span>
              </h4>
            </div>

            {sacas.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="px-3 py-1 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-200 font-mono text-xs font-black">
                  Habilitadas: {sacas.length} {sacas.length === 1 ? "Saca" : "Sacas"}
                </span>
                <span
                  className={`px-3 py-1 rounded-xl font-mono text-xs font-black border ${
                    sacasConPesoCount === sacas.length
                      ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                      : "bg-amber-950/80 border-amber-500/40 text-amber-300"
                  }`}
                >
                  Pesadas en Balanza: {sacasConPesoCount} / {sacas.length}
                </span>
              </div>
            )}
          </div>

          {/* PASO 1: SOLICITAR EL NÚMERO DE SACAS DE DESCARGA */}
          <form
            onSubmit={handleHabilitarCantidadSacas}
            className={
              isLight
                ? "flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-purple-50 border border-purple-300 p-3 rounded-xl print:hidden"
                : "flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-slate-900/95 border-2 border-purple-500/40 p-3.5 rounded-xl print:hidden"
            }
          >
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-black text-purple-300 flex items-center gap-1.5 uppercase tracking-wide">
                <Hash className="w-4 h-4 text-purple-400" />
                <span>Paso 1: ¿Cuántas Sacas de Descarga (Big Bags) tiene este Batch?</span>
              </label>

              {/* Botones rápidos de fracciones */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAplicarFraccionRapida("1/4")}
                  className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-[11px] font-bold text-purple-200 cursor-pointer transition-all active:scale-95"
                >
                  + ¼
                </button>
                <button
                  type="button"
                  onClick={() => handleAplicarFraccionRapida("1/2")}
                  className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-[11px] font-bold text-purple-200 cursor-pointer transition-all active:scale-95"
                >
                  + ½
                </button>
                <button
                  type="button"
                  onClick={() => handleAplicarFraccionRapida("3/4")}
                  className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-[11px] font-bold text-purple-200 cursor-pointer transition-all active:scale-95"
                >
                  + ¾
                </button>
                <button
                  type="button"
                  onClick={() => handleAplicarFraccionRapida("entero")}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-medium text-slate-300 cursor-pointer transition-all active:scale-95"
                >
                  Entero
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-36 sm:w-40">
                <input
                  type="text"
                  value={cantidadSacasInput}
                  onChange={(e) => setCantidadSacasInput(e.target.value)}
                  placeholder="Ej. 28 1/2"
                  className={
                    isLight
                      ? "w-full bg-white border-2 border-purple-500 rounded-lg px-3 py-1.5 text-sm font-black text-slate-900 font-mono text-center shadow-inner"
                      : "w-full bg-slate-950 border-2 border-purple-500/70 rounded-xl px-3 py-2 text-sm font-black text-white font-mono text-center focus:outline-none focus:border-purple-400 shadow-inner"
                  }
                />
              </div>

              <button
                type="submit"
                disabled={!parsedInput.cantidadValida || parsedInput.totalSacasHabilitar <= 0}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                <span>
                  {sacas.length > 0
                    ? `Actualizar a ${parsedInput.totalSacasHabilitar || cantidadSacasInput} Sacas`
                    : `Habilitar ${parsedInput.totalSacasHabilitar || cantidadSacasInput || ""} Sacas`}
                </span>
              </button>
            </div>
          </form>

          {/* PASO 2 (HABILITADO DESPUÉS DE REGISTRAR CUÁNTAS SACAS SON DE DESCARGA): SUBIR CON FOTO LA FICHA DE LOS PESOS DE LAS SACAS */}
          {sacas.length > 0 && (
            <div
              className={
                isLight
                  ? "bg-cyan-50/70 border-2 border-cyan-400 rounded-xl p-3.5 space-y-3"
                  : "bg-slate-900/95 border-2 border-cyan-500/40 rounded-xl p-4 space-y-3"
              }
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={
                          isLight
                            ? "text-xs font-black uppercase text-cyan-950"
                            : "text-xs sm:text-sm font-black uppercase tracking-wide text-cyan-300"
                        }
                      >
                        Paso 2: Subir con Foto la Ficha de los Pesos de las Sacas ({sacas.length}{" "}
                        {sacas.length === 1 ? "Saca" : "Sacas"})
                      </span>
                      {fotoFichaPesosUrl && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Ficha Fotográfica Adjunta
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tome una foto con la cámara o suba la imagen de la <strong>Ficha de Pesos de las Sacas de Descarga</strong> para respaldar y cargar los pesos de las {sacas.length} sacas habilitadas.
                    </p>
                  </div>
                </div>

                {/* Botones para Tomar Foto o Subir Imagen de la Ficha de Pesos */}
                <div className="flex items-center gap-2 flex-wrap print:hidden">
                  {/* Input oculto para Cámara */}
                  <input
                    ref={fotoCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSubirFotoFichaPesos(f);
                      e.target.value = "";
                    }}
                  />
                  {/* Input oculto para Subir Archivo de Imagen */}
                  <input
                    ref={fotoFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSubirFotoFichaPesos(f);
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fotoCameraInputRef.current?.click()}
                    disabled={isExtractingFoto}
                    className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 cursor-pointer transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Tomar Foto de Ficha</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fotoFileInputRef.current?.click()}
                    disabled={isExtractingFoto}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-cyan-200 border border-cyan-500/40 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{fotoFichaPesosUrl ? "Cambiar Foto de Ficha" : "Subir Foto de Ficha"}</span>
                  </button>
                </div>
              </div>

              {/* Estado de procesamiento OCR o confirmación de la foto */}
              {(isExtractingFoto || fotoStatusMsg) && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    isExtractingFoto
                      ? "bg-cyan-950/60 border-cyan-500/40 text-cyan-200"
                      : "bg-emerald-950/50 border-emerald-500/40 text-emerald-200"
                  }`}
                >
                  {isExtractingFoto ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span>{fotoStatusMsg}</span>
                </div>
              )}

              {/* Vista previa de la Foto de la Ficha de Pesos de las Sacas si ya fue subida */}
              {fotoFichaPesosUrl && (
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => setShowFotoZoomModal(true)}
                      className="w-20 h-20 rounded-lg overflow-hidden border-2 border-cyan-500/50 bg-slate-900 shrink-0 cursor-pointer relative group"
                      title="Clic para ampliar la foto de la ficha de pesos"
                    >
                      <img
                        src={fotoFichaPesosUrl}
                        alt="Ficha de Pesos de las Sacas"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-white">
                        <FileImage className="w-4 h-4 text-cyan-400" />
                        <span>{fotoFichaNombre || `Ficha de Pesos — Batch ${correlativo || batchId}`}</span>
                      </div>
                      {fotoFichaFecha && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          Fecha de carga: {fotoFichaFecha}
                        </div>
                      )}
                      <div className="text-[11px] text-cyan-300">
                        Respaldo fotográfico de las {sacas.length} sacas de descarga del Batch {correlativo || batchId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap print:hidden">
                    <button
                      type="button"
                      onClick={() => setShowFotoZoomModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Ver Ficha Completa</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExtractingFoto}
                      onClick={() =>
                        extraerPesosDesdeFotoFicha(fotoFichaPesosUrl, sacas, {
                          url: fotoFichaPesosUrl,
                          nombre: fotoFichaNombre,
                          fecha: fotoFichaFecha
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-bold border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Extraer Pesos de la Foto</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEliminarFotoFicha}
                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer"
                      title="Quitar foto de la ficha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 3: TABLA DE SACAS HABILITADAS PARA REGISTRAR PESO INDEPENDIENTE EN BALANZA */}
          {sacas.length === 0 ? (
            <div
              className={
                isLight
                  ? "p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500"
                  : "p-7 text-center bg-slate-900/50 border border-dashed border-slate-700 rounded-xl text-xs text-slate-400 space-y-1.5"
              }
            >
              <Scale className="w-8 h-8 mx-auto mb-1 text-purple-400 opacity-80" />
              <p className="font-black text-slate-200 text-sm">
                Indique arriba el Número de Sacas de Descarga del Batch {correlativo || batchId}
              </p>
              <p className="text-[11px] text-slate-400 max-w-lg mx-auto">
                Al ingresar cuántas sacas son de descarga y presionar <strong>Habilitar Sacas para Balanza</strong>, se habilitará la opción para <strong>subir con foto la ficha de los pesos de las sacas</strong> y la lista enumerada para el registro en balanza.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr
                    className={
                      isLight
                        ? "bg-slate-200 text-slate-800 border-b border-slate-400 text-[10.5px] uppercase font-black"
                        : "bg-slate-900 text-slate-300 border-b border-slate-700 text-[11px] uppercase font-black"
                    }
                  >
                    <th className="py-2.5 px-3 text-center w-16">N° Saca</th>
                    <th className="py-2.5 px-3 text-left">Identificador Saca Big Bag</th>
                    <th className="py-2.5 px-3 text-right w-52">Peso Independiente Balanza (kg)</th>
                    <th className="py-2.5 px-3 text-center w-32">Estado Balanza</th>
                    <th className="py-2.5 px-3 text-center w-24">% del Total</th>
                    <th className="py-2.5 px-3 text-center w-24">Hora</th>
                    <th className="py-2.5 px-3 text-left">Nota / Ticket Balanza</th>
                  </tr>
                </thead>
                <tbody
                  className={
                    isLight ? "divide-y divide-slate-200" : "divide-y divide-slate-800/80"
                  }
                >
                  {sacas.map((saca, idx) => {
                    const tienePeso = Number(saca.pesoKg) > 0;
                    const pct =
                      evaluacion.pesoRealDescargaKg > 0 && tienePeso
                        ? ((saca.pesoKg / evaluacion.pesoRealDescargaKg) * 100).toFixed(1)
                        : "0.0";
                    const isParcial = Boolean(
                      saca.esParcial ||
                      (parsedInput.esFraccionaria && idx === sacas.length - 1) ||
                      saca.codigoSaca?.includes("PARCIAL")
                    );
                    const fraccionEtiqueta =
                      saca.fraccionTexto ||
                      (isParcial ? (parsedInput.fraccionStr || "Fracción") : undefined);

                    return (
                      <tr
                        key={saca.id || idx}
                        className={
                          isLight
                            ? isParcial
                              ? "bg-amber-50/80 border-l-4 border-l-amber-500 hover:bg-amber-100/70 transition-colors"
                              : "hover:bg-slate-100/80 transition-colors"
                            : isParcial
                            ? "bg-amber-950/25 border-l-4 border-l-amber-500 hover:bg-amber-950/35 transition-colors"
                            : tienePeso
                            ? "bg-emerald-950/10 hover:bg-slate-900/60 transition-colors"
                            : "hover:bg-slate-900/60 transition-colors"
                        }
                      >
                        <td className="py-2 px-3 text-center font-mono font-black text-amber-400">
                          <div>#{idx + 1}</div>
                          {isParcial && (
                            <span className="text-[8.5px] font-black text-amber-300 uppercase tracking-tighter block">
                              PARCIAL
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-white">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{saca.codigoSaca || `SACA BIG BAG #${String(idx + 1).padStart(2, "0")}`}</span>
                            {isParcial && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/25 border border-amber-500/40 text-amber-300 font-sans flex items-center gap-1 shadow-xs">
                                <Sparkles className="w-2.5 h-2.5" />
                                Saca Parcial ({fraccionEtiqueta})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              ref={(el) => {
                                pesoInputsRef.current[idx] = el;
                              }}
                              type="number"
                              step="0.01"
                              min="0"
                              value={saca.pesoKg !== undefined && saca.pesoKg > 0 ? saca.pesoKg : ""}
                              placeholder={isParcial ? "Peso saca parcial (kg)" : "Ingrese peso (kg)"}
                              onChange={(e) =>
                                handleActualizarSaca(idx, "pesoKg", e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (idx + 1 < sacas.length) {
                                    pesoInputsRef.current[idx + 1]?.focus();
                                  }
                                }
                              }}
                              className={
                                isLight
                                  ? isParcial
                                    ? "w-36 text-right bg-amber-50 border-2 border-amber-500 rounded-lg px-2.5 py-1 font-mono font-black text-amber-950"
                                    : "w-36 text-right bg-emerald-50 border-2 border-emerald-500 rounded-lg px-2.5 py-1 font-mono font-black text-emerald-950"
                                  : `w-36 text-right rounded-lg px-2.5 py-1.5 font-mono font-black text-sm focus:outline-none ${
                                      isParcial
                                        ? tienePeso
                                          ? "bg-slate-900 border-2 border-amber-400 text-amber-200 focus:border-amber-300"
                                          : "bg-slate-950 border-2 border-amber-500/80 text-amber-200 placeholder-amber-500/60 focus:border-amber-400"
                                        : tienePeso
                                        ? "bg-slate-900 border-2 border-emerald-500/60 text-emerald-300 focus:border-emerald-400"
                                        : "bg-slate-950 border-2 border-amber-500/50 text-amber-200 placeholder-slate-500 focus:border-amber-400"
                                    }`
                              }
                            />
                            <span className="text-[11px] font-mono text-slate-400 font-bold">kg</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {tienePeso ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isParcial
                                ? "bg-amber-500/25 border border-amber-500/40 text-amber-300"
                                : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                            }`}>
                              <CheckCircle2 className="w-3 h-3" /> {isParcial ? "Pesada (Parcial)" : "Pesada"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-400">
                          {pct}%
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400">
                          {saca.horaPesaje || "--:--"}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={saca.observacion || ""}
                            placeholder={isParcial ? `Saca parcial de ${fraccionEtiqueta || "fracción"}...` : "Opcional (ej. ticket balanza)..."}
                            onChange={(e) =>
                              handleActualizarSaca(idx, "observacion", e.target.value)
                            }
                            className={
                              isLight
                                ? "w-full bg-transparent border-b border-transparent focus:border-slate-400 outline-none text-slate-700 text-xs"
                                : "w-full bg-transparent border-b border-slate-800 focus:border-slate-600 outline-none text-slate-300 text-xs py-0.5"
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr
                    className={
                      isLight
                        ? "bg-emerald-100 border-t-2 border-emerald-700 font-black text-emerald-950"
                        : "bg-emerald-950/60 border-t-2 border-emerald-500/50 font-black text-emerald-200"
                    }
                  >
                    <td className="py-2.5 px-3 text-center font-mono">{sacas.length}</td>
                    <td className="py-2.5 px-3 uppercase">
                      SUMA TOTAL ({sacasConPesoCount}/{sacas.length}{" "}
                      {sacas.length === 1 ? "SACA BIG BAG" : "SACAS BIG BAG"}
                      {parsedInput.esFraccionaria
                        ? ` • ${parsedInput.enteras} COMPLETAS + 1 PARCIAL DE ${parsedInput.fraccionStr}`
                        : ""}) = PESO REAL DE DESCARGA
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sm">
                      {evaluacion.pesoRealDescargaKg.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{" "}
                      kg
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                      {sacasConPesoCount === sacas.length ? "100% Pesadas" : `${sacas.length - sacasConPesoCount} pend.`}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">100%</td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] font-mono">
                      Prom. por Saca:{" "}
                      {sacasConPesoCount > 0
                        ? (evaluacion.pesoRealDescargaKg / sacasConPesoCount).toFixed(2)
                        : "0.00"}{" "}
                      kg
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* BLOQUE 3: COMPARACIÓN FINAL: PESO REAL DE DESCARGA VS PESO PROYECTADO (± 1.5% DEL PESO INGRESADO) */}
        <div
          className={`rounded-xl p-4 border-2 transition-all ${
            evaluacion.estadoComparacion === "CONFORME"
              ? isLight
                ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                : "bg-emerald-950/30 border-emerald-500/60 text-white"
              : evaluacion.alarmaAceptada
              ? isLight
                ? "bg-amber-50 border-amber-500 text-amber-950"
                : "bg-amber-950/30 border-amber-500/60 text-white"
              : evaluacion.estadoComparacion === "FALTANTE" ||
                evaluacion.estadoComparacion === "EXCESO"
              ? isLight
                ? "bg-rose-50 border-rose-500 text-rose-950"
                : "bg-rose-950/30 border-rose-500/60 text-white"
              : isLight
              ? "bg-slate-100 border-slate-300 text-slate-800"
              : "bg-slate-950/90 border-slate-800 text-slate-200"
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Suma Peso Real de Descarga */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75 block">
                PESO REAL DE DESCARGA (kg)
              </span>
              <div className="text-xl font-black font-mono mt-0.5">
                {evaluacion.pesoRealDescargaKg.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{" "}
                kg
              </div>
              <span className="text-[11px] opacity-80 block">
                Suma de {sacasConPesoCount} de {sacas.length}{" "}
                {sacas.length === 1 ? "Saca Big Bag" : "Sacas Big Bag"}
              </span>
            </div>

            {/* Peso Proyectado */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75 block">
                PESO PROYECTADO (kg)
              </span>
              <div className="text-xl font-black font-mono mt-0.5">
                {evaluacion.pesoProyectadoKg.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{" "}
                kg
              </div>
              <span className="text-[11px] opacity-80 block font-mono">
                Rango (±{PORCENTAJE_TOLERANCIA_DESCARGA}%): ±{" "}
                {toleranciaCalculadaKg.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}{" "}
                kg
              </span>
            </div>

            {/* Diferencia en kg */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75 block">
                DIFERENCIA (REAL - PROYECTADO)
              </span>
              <div
                className={`text-xl font-black font-mono mt-0.5 ${
                  evaluacion.estadoComparacion === "CONFORME"
                    ? isLight
                      ? "text-emerald-700"
                      : "text-emerald-400"
                    : evaluacion.alarmaAceptada
                    ? isLight
                      ? "text-amber-700"
                      : "text-amber-300"
                    : evaluacion.estadoComparacion === "SIN_REGISTRO"
                    ? ""
                    : isLight
                    ? "text-rose-700"
                    : "text-rose-400"
                }`}
              >
                {evaluacion.pesoRealDescargaKg > 0
                  ? `${evaluacion.diferenciaKg >= 0 ? "+" : ""}${evaluacion.diferenciaKg.toLocaleString(
                      "en-US",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }
                    )} kg`
                  : "—"}
              </div>
              <span className="text-[11px] opacity-80 block font-mono">
                Límite (±{PORCENTAJE_TOLERANCIA_DESCARGA}%): [-
                {toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg a +
                {toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg]
              </span>
            </div>

            {/* Dictamen de Tolerancia (±1.5% del Peso de Ingreso) */}
            <div className="flex flex-col justify-center">
              {evaluacion.estadoComparacion === "SIN_REGISTRO" && (
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Indique el número de sacas y registre sus pesos en balanza o suba la foto de la ficha para comparar con el Peso Proyectado.
                  </span>
                </div>
              )}

              {evaluacion.estadoComparacion === "CONFORME" && (
                <div
                  className={
                    isLight
                      ? "p-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-2 shadow"
                      : "p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-black flex items-center gap-2"
                  }
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="uppercase">
                      CUMPLE RANGO (± {PORCENTAJE_TOLERANCIA_DESCARGA}% = ±{" "}
                      {toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg)
                    </div>
                    <div className="text-[10.5px] font-normal opacity-90">
                      Peso Real dentro del rango permitido ({rangoMinimoKg.toLocaleString()} –{" "}
                      {rangoMaximoKg.toLocaleString()} kg).
                    </div>
                  </div>
                </div>
              )}

              {evaluacion.alarmaAceptada && (
                <div
                  className={
                    isLight
                      ? "p-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-2 shadow"
                      : "p-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-black flex items-center gap-2"
                  }
                >
                  <ShieldCheck className="w-5 h-5 shrink-0 text-amber-400" />
                  <div>
                    <div className="uppercase">
                      ALARMA RETIRADA — ACEPTADO CON SUSTENTO
                    </div>
                    <div className="text-[10.5px] font-normal opacity-90">
                      Lote / Batch aceptado por {evaluacion.aceptadoPor || "Supervisor"} con observación sustentada.
                    </div>
                  </div>
                </div>
              )}

              {evaluacion.alarmaActiva && evaluacion.estadoComparacion === "FALTANTE" && (
                <div
                  className={
                    isLight
                      ? "p-2.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-2 shadow animate-pulse"
                      : "p-3 rounded-xl bg-rose-500/25 border-2 border-rose-500 text-rose-200 text-xs font-black flex items-center gap-2 animate-pulse"
                  }
                >
                  <BellRing className="w-5 h-5 shrink-0 text-rose-400" />
                  <div>
                    <div className="uppercase">
                      ALARMA EN BATCH: FUERA DE RANGO (MENOR EN MÁS DE{" "}
                      {toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg)
                    </div>
                    <div className="text-[10.5px] font-normal opacity-90">
                      Faltan{" "}
                      <strong>
                        {Math.abs(evaluacion.diferenciaKg + toleranciaCalculadaKg).toFixed(2)} kg
                      </strong>{" "}
                      para alcanzar el mínimo permitido ({rangoMinimoKg.toLocaleString()} kg).
                    </div>
                  </div>
                </div>
              )}

              {evaluacion.alarmaActiva && evaluacion.estadoComparacion === "EXCESO" && (
                <div
                  className={
                    isLight
                      ? "p-2.5 rounded-xl bg-rose-600 text-white text-xs font-black flex items-center gap-2 shadow animate-pulse"
                      : "p-3 rounded-xl bg-rose-500/25 border-2 border-rose-500 text-rose-200 text-xs font-black flex items-center gap-2 animate-pulse"
                  }
                >
                  <BellRing className="w-5 h-5 shrink-0 text-rose-400" />
                  <div>
                    <div className="uppercase">
                      ALARMA EN BATCH: FUERA DE RANGO (SUPERA EN MÁS DE{" "}
                      {toleranciaCalculadaKg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg)
                    </div>
                    <div className="text-[10.5px] font-normal opacity-90">
                      Excede en{" "}
                      <strong>
                        {(evaluacion.diferenciaKg - toleranciaCalculadaKg).toFixed(2)} kg
                      </strong>{" "}
                      el máximo permitido ({rangoMaximoKg.toLocaleString()} kg).
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN DE ALARMA DEL BATCH Y SUSTENTO DE OBSERVACIÓN PARA ACEPTAR Y RETIRAR ALARMA */}
          {(evaluacion.estadoComparacion === "FALTANTE" ||
            evaluacion.estadoComparacion === "EXCESO") && (
            <div className="mt-4 pt-4 border-t border-rose-500/30">
              {evaluacion.alarmaActiva || isEditingSustento ? (
                <div
                  className={
                    isLight
                      ? "bg-white border-2 border-rose-600 rounded-xl p-4 space-y-3 shadow-md"
                      : "bg-slate-950/95 border-2 border-rose-500/80 rounded-xl p-4 space-y-3 shadow-xl shadow-rose-950/40"
                  }
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-600 text-white animate-bounce shrink-0 mt-0.5">
                        <BellRing className="w-5 h-5" />
                      </div>
                      <div>
                        <h4
                          className={
                            isLight
                              ? "text-xs sm:text-sm font-black uppercase text-rose-800"
                              : "text-xs sm:text-sm font-black uppercase text-rose-300"
                          }
                        >
                          Alarma Activa en Batch {correlativo || batchId}: Lote Fuera del Rango de Peso Proyectado (±{PORCENTAJE_TOLERANCIA_DESCARGA}%)
                        </h4>
                        <p
                          className={
                            isLight
                              ? "text-[11px] text-slate-600 mt-0.5"
                              : "text-[11px] text-slate-300 mt-0.5"
                          }
                        >
                          El Peso Real de Descarga (<strong>{evaluacion.pesoRealDescargaKg.toLocaleString()} kg</strong>) se encuentra fuera del rango permitido (
                          <strong>{rangoMinimoKg.toLocaleString()} kg – {rangoMaximoKg.toLocaleString()} kg</strong>). Ingrese el <strong>sustento de su observación</strong> y acéptelo para retirar la alarma del batch.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Motivos rápidos sugeridos para facilitar el sustento */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">
                      Motivos frecuentes:
                    </span>
                    {[
                      "Merma adicional por limpieza de impurezas / polvillo en pre-limpia",
                      "Mayor reducción de humedad final en secado respecto al 12% base",
                      "Retención operativa parcial en tolva pulmón / elevadores",
                      "Diferencia por humedad inicial en lotes húmedos de recepción"
                    ].map((motivo) => (
                      <button
                        key={motivo}
                        type="button"
                        onClick={() =>
                          setSustentoObservacionAlarma((prev) =>
                            prev.trim() ? `${prev.trim()}. ${motivo}` : motivo
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10.5px] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        + {motivo}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label
                      className={
                        isLight
                          ? "block text-[11px] font-black uppercase text-slate-800"
                          : "block text-[11px] font-black uppercase text-amber-300"
                      }
                    >
                      Sustento de Observación del Batch (Obligatorio para aceptar y retirar alarma):
                    </label>
                    <textarea
                      rows={2}
                      value={sustentoObservacionAlarma}
                      onChange={(e) => setSustentoObservacionAlarma(e.target.value)}
                      placeholder={`Describa el motivo técnico u operativo por el cual el peso de descarga salió del rango proyectado (±${PORCENTAJE_TOLERANCIA_DESCARGA}%)...`}
                      className={
                        isLight
                          ? "w-full rounded-lg border-2 border-slate-300 focus:border-emerald-600 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none"
                          : "w-full rounded-xl border-2 border-rose-500/40 focus:border-amber-400 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none"
                      }
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    {isEditingSustento && (
                      <button
                        type="button"
                        onClick={() => setIsEditingSustento(false)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!sustentoObservacionAlarma.trim()}
                      onClick={handleSustentarYAceptarAlarma}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sustentar Observación y Aceptar Batch (Retirar Alarma)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    isLight
                      ? "bg-white border-2 border-amber-500 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      : "bg-slate-950/90 border border-amber-500/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase text-emerald-400">
                          Alarma Retirada — Observación Sustentada y Aceptada
                        </span>
                        {evaluacion.fechaAceptacionAlarma && (
                          <span className="text-[10.5px] font-mono text-slate-400">
                            • {evaluacion.aceptadoPor || "Supervisor"} ({evaluacion.fechaAceptacionAlarma})
                          </span>
                        )}
                      </div>
                      <p
                        className={
                          isLight
                            ? "text-xs text-slate-800 font-medium bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200"
                            : "text-xs text-amber-200 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800"
                        }
                      >
                        <strong>Sustento registrado:</strong> "{evaluacion.sustentoObservacionAlarma}"
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditingSustento(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Sustento</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL PARA VER LA FOTO DE LA FICHA DE PESOS DE LAS SACAS EN PANTALLA COMPLETA */}
      {showFotoZoomModal && fotoFichaPesosUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowFotoZoomModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileImage className="w-5 h-5 text-cyan-400" />
                <div>
                  <h4 className="text-sm font-black text-white">
                    Ficha Fotográfica de Pesos de Sacas — Batch {correlativo || batchId}
                  </h4>
                  {fotoFichaFecha && (
                    <p className="text-[11px] text-slate-400 font-mono">
                      Registrada: {fotoFichaFecha}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFotoZoomModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-black/60">
              <img
                src={fotoFichaPesosUrl}
                alt="Ficha de Pesos de las Sacas"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SacasDescargaModalProps extends SacasDescargaManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SacasDescargaModal: React.FC<SacasDescargaModalProps> = ({
  isOpen,
  onClose,
  ...managerProps
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Control de Balanza: Sacas de Descarga (Big Bags) — Batch{" "}
                {managerProps.correlativo || managerProps.batchId}
              </h2>
              <p className="text-xs text-slate-400">
                {managerProps.cliente || "Cliente"} • Variedad: {managerProps.variedad || "General"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <SacasDescargaManager {...managerProps} variant="dark" />

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black border border-slate-700 cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
