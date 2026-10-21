import React, { useState, useRef, useEffect } from "react";
import { 
  X, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  FileText, 
  Image as ImageIcon, 
  Printer, 
  Sparkles, 
  Loader2,
  Calendar,
  Layers,
  Building,
  Flame,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { ProgramacionBatchOficial, LoteProgramacionFila } from "../utils/programacionBatchOficialService";
import { captureElementToCanvasSafe } from "../utils/pdfPrintHelper";

const getPdfGenerators = async () => {
  const jspdfModule = await import("jspdf");
  const jsPDFClass = (jspdfModule as any).jsPDF || (jspdfModule as any).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTableFn = (autoTableModule as any).default || autoTableModule;
  return { jsPDFClass, autoTableFn };
};

interface ExportarProgramacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  programacionSeleccionada?: ProgramacionBatchOficial | null;
  todasLasProgramaciones?: ProgramacionBatchOficial[];
  capacidadMaximaKg?: number;
  filtroTurno?: string;
  filtroFecha?: string;
  initialModo?: "batch_individual" | "sabana_completa";
}

export const ExportarProgramacionModal: React.FC<ExportarProgramacionModalProps> = ({
  isOpen,
  onClose,
  programacionSeleccionada,
  todasLasProgramaciones = [],
  capacidadMaximaKg = 16000,
  filtroTurno = "TODOS",
  filtroFecha = "",
  initialModo
}) => {
  const [modoExportacion, setModoExportacion] = useState<"batch_individual" | "sabana_completa">(
    initialModo || (programacionSeleccionada ? "batch_individual" : "sabana_completa")
  );
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>(
    programacionSeleccionada?.id || programacionSeleccionada?.batch || todasLasProgramaciones[0]?.id || todasLasProgramaciones[0]?.batch || ""
  );
  const [temaExportacion, setTemaExportacion] = useState<"claro" | "oscuro">("claro");
  const [isGenerating, setIsGenerating] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);
  const [copiadoExito, setCopiadoExito] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialModo) {
        setModoExportacion(initialModo);
      } else {
        setModoExportacion(programacionSeleccionada ? "batch_individual" : "sabana_completa");
      }
      if (programacionSeleccionada) {
        setSelectedBatchKey(programacionSeleccionada.id || programacionSeleccionada.batch || "");
      } else if (todasLasProgramaciones.length > 0) {
        setSelectedBatchKey(todasLasProgramaciones[0].id || todasLasProgramaciones[0].batch || "");
      }
      setTemaExportacion("claro");
    }
  }, [isOpen, programacionSeleccionada, initialModo, todasLasProgramaciones]);

  if (!isOpen) return null;

  const batchActual =
    (programacionSeleccionada && (programacionSeleccionada.id === selectedBatchKey || programacionSeleccionada.batch === selectedBatchKey)
      ? programacionSeleccionada
      : todasLasProgramaciones.find(p => p.id === selectedBatchKey || p.batch === selectedBatchKey)) ||
    programacionSeleccionada ||
    todasLasProgramaciones[0] ||
    null;

  // Notificación temporal
  const mostrarNotif = (msg: string) => {
    setMensajeEstado(msg);
    setTimeout(() => setMensajeEstado(null), 4500);
  };

  // Helper para renderizar canvas de forma segura
  const capturarPreviewCanvas = async (elem: HTMLElement, tema: "claro" | "oscuro") => {
    return await captureElementToCanvasSafe(elem, {
      scale: 2,
      backgroundColor: tema === "claro" ? "#ffffff" : "#0f172a",
      width: elem.scrollWidth || undefined
    });
  };

  const canvasToBlobPromise = (canvas: HTMLCanvasElement): Promise<Blob | null> => {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
  };

  const descargarBlob = (blob: Blob, nombreArchivo: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 2000);
  };

  // Genera el texto resumen para WhatsApp
  const obtenerTextoResumenWhatsApp = () => {
    if (modoExportacion === "batch_individual" && batchActual) {
      return (
        `🌾 *MOLINO DON JULIO S.A.C.* 🌾\n` +
        `📋 *FICHA DE PROGRAMACIÓN DE BATCH OFICIAL*\n\n` +
        `🔹 *BATCH:* ${batchActual.batch} (${batchActual.caso || "Batch"})\n` +
        `📅 *Fecha:* ${batchActual.fecha} | *Turno:* ${batchActual.turno}\n` +
        `👤 *Cliente:* ${batchActual.clientePrincipal}\n` +
        `🌾 *Variedad:* ${batchActual.variedadPrincipal}\n` +
        `📦 *Carga Programada:* ${batchActual.totalSacosProg} sacos (${((batchActual.pesoTotalKg || 0) / 1000).toFixed(1)} TN)\n` +
        `💧 *P(H) Promedio:* ${batchActual.promedios?.ph || 14.0}% (Desv: ${batchActual.promedios?.desv || 1.2})\n\n` +
        `⚙️ *PARÁMETROS OPERATIVOS DE PLANTA:*\n` +
        `• Modalidad: ${batchActual.parametrosDeterminados?.modalidadPases || "1_PASE"}\n` +
        `• Presión Vapor: ${batchActual.parametrosDeterminados?.presionBar ?? 0.40} bar\n` +
        `• Vel. Esclusa: ${batchActual.parametrosDeterminados?.velExclusa ?? 6}\n` +
        `• Tiempo Reposo: ${batchActual.parametrosDeterminados?.tiempoReposoMin ?? 40} min\n` +
        `• Temp. Secado: ${batchActual.parametrosDeterminados?.tempSecadoC ?? 80} °C\n` +
        (batchActual.observacion ? `📝 *Observación:* ${batchActual.observacion}\n` : "") +
        `\n🏭 *PLANTA DE VAPORIZADO APIT*`
      );
    } else {
      const totalSacos = todasLasProgramaciones.reduce((acc, p) => acc + (p.totalSacosProg || 0), 0);
      const totalTn = (todasLasProgramaciones.reduce((acc, p) => acc + (p.pesoTotalKg || 0), 0) / 1000).toFixed(1);
      const listaBatches = todasLasProgramaciones.map(p => `• Batch ${p.batch}: ${p.clientePrincipal} (${p.totalSacosProg} sacos)`).join("\n");
      return (
        `🌾 *MOLINO DON JULIO S.A.C.* 🌾\n` +
        `📋 *SÁBANA DE PROGRAMACIÓN VAPORIZADO APIT*\n` +
        `📅 *Fecha:* ${filtroFecha || new Date().toISOString().split("T")[0]} | *Turno:* ${filtroTurno}\n\n` +
        `📊 *Total Batches:* ${todasLasProgramaciones.length}\n` +
        `📦 *Total Volumen:* ${totalSacos} sacos (${totalTn} TN)\n\n` +
        `📝 *Detalle de Batches:*\n${listaBatches}\n\n` +
        `🏭 *PLANTA DE VAPORIZADO APIT*`
      );
    }
  };

  // -------------------------------------------------------------
  // 1. EXPORTAR COMO IMAGEN (PNG DE ALTA RESOLUCIÓN)
  // -------------------------------------------------------------
  const handleExportarImagen = async () => {
    if (!previewRef.current) return;
    try {
      setIsGenerating(true);
      mostrarNotif("Generando imagen PNG de alta resolución...");

      const canvas = await capturarPreviewCanvas(previewRef.current, temaExportacion);
      const filename = modoExportacion === "batch_individual" && batchActual
        ? `PROGRAMACION_${(batchActual.batch || "BATCH").toUpperCase()}_${batchActual.fecha || "FECHA"}.png`
        : `SABANA_PROGRAMACION_VAPORIZADO_${filtroTurno}_${new Date().toISOString().split("T")[0]}.png`;

      const blob = await canvasToBlobPromise(canvas);
      if (blob) {
        descargarBlob(blob, filename);
        mostrarNotif("✅ Imagen PNG descargada exitosamente.");
      } else {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        mostrarNotif("✅ Imagen PNG descargada exitosamente.");
      }
    } catch (err) {
      console.error("Error generando imagen PNG:", err);
      mostrarNotif("❌ Error al generar imagen PNG.");
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // 2. COPIAR IMAGEN AL PORTAPAPELES (PARA PEGAR DIRECTO EN WHATSAPP)
  // -------------------------------------------------------------
  const handleCopiarImagenPortapapeles = async () => {
    if (!previewRef.current) return;
    try {
      setIsGenerating(true);
      mostrarNotif("Renderizando para copiar imagen al portapapeles...");

      const canvas = await capturarPreviewCanvas(previewRef.current, temaExportacion);
      const blob = await canvasToBlobPromise(canvas);

      if (!blob) {
        mostrarNotif("❌ No se pudo crear el archivo de la imagen.");
        setIsGenerating(false);
        return;
      }

      let copiado = false;
      if (navigator.clipboard && typeof (window as any).ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ "image/png": blob })
          ]);
          copiado = true;
          setCopiadoExito(true);
          mostrarNotif("📋 ¡Imagen copiada al portapapeles! Puedes pegarla con Ctrl+V en WhatsApp Web o chat.");
          setTimeout(() => setCopiadoExito(false), 4500);
        } catch (clipErr) {
          console.warn("Fallo clipboard image write directo:", clipErr);
        }
      }

      // Si el navegador no permite escribir imágenes al portapapeles (por políticas de iframe o browser)
      if (!copiado) {
        const textoResumen = obtenerTextoResumenWhatsApp();
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(textoResumen);
            setCopiadoExito(true);
            setTimeout(() => setCopiadoExito(false), 3000);
          } catch {
            // ignore
          }
        }
        const filename = modoExportacion === "batch_individual" && batchActual
          ? `PROGRAMACION_${(batchActual.batch || "BATCH").toUpperCase()}.png`
          : `SABANA_PROGRAMACION_VAPORIZADO.png`;
        descargarBlob(blob, filename);
        mostrarNotif("📋 Resumen copiado e imagen PNG descargada lista para adjuntar en WhatsApp.");
      }
    } catch (err) {
      console.error("Error copiando al portapapeles:", err);
      mostrarNotif("📥 Descargando imagen PNG como alternativa...");
      handleExportarImagen();
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // 3. COMPARTIR VIA WEB SHARE API (MÓVIL O WHATSAPP)
  // -------------------------------------------------------------
  const handleCompartir = async () => {
    if (!previewRef.current) return;
    try {
      setIsGenerating(true);
      mostrarNotif("Preparando archivo para compartir en WhatsApp...");

      const textoResumen = obtenerTextoResumenWhatsApp();
      const canvas = await capturarPreviewCanvas(previewRef.current, temaExportacion);
      const blob = await canvasToBlobPromise(canvas);

      const fileName = modoExportacion === "batch_individual" && batchActual
        ? `PROGRAMACION_${(batchActual.batch || "BATCH").toUpperCase()}.png`
        : `SABANA_PROGRAMACION_VAPORIZADO.png`;

      let compartido = false;

      // 1. Intentar Web Share API con archivo adjunto (en móviles Android / iOS)
      if (blob && navigator.canShare) {
        try {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: "Programación de Batch - Vaporizado APIT",
              text: textoResumen,
              files: [file]
            });
            compartido = true;
            mostrarNotif("✅ Compartido exitosamente en WhatsApp.");
          }
        } catch (shareErr) {
          console.log("Web Share cancelado o no admitido:", shareErr);
        }
      }

      // 2. Si no se compartió con Web Share nativo (escritorio, navegador web, etc.)
      if (!compartido) {
        // Copiar texto formateado al portapapeles
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(textoResumen);
            setCopiadoExito(true);
            setTimeout(() => setCopiadoExito(false), 3000);
          } catch {
            // ignore
          }
        }

        // Descargar la imagen PNG para que el usuario pueda arrastrarla o adjuntarla
        if (blob) {
          descargarBlob(blob, fileName);
        }

        // Abrir WhatsApp con el texto ya redactado
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoResumen)}`;
        const a = document.createElement("a");
        a.href = waUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 1000);

        mostrarNotif("📲 WhatsApp abierto con ficha redactada e imagen PNG descargada.");
      }
    } catch (err) {
      console.error("Error al compartir:", err);
      // Fallback seguro: abrir WhatsApp directamente con el texto
      const textoResumen = obtenerTextoResumenWhatsApp();
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoResumen)}`;
      const a = document.createElement("a");
      a.href = waUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 1000);
      mostrarNotif("📲 Abriendo WhatsApp...");
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // 4. EXPORTAR COMO DOCUMENTO PDF OFICIAL
  // -------------------------------------------------------------
  const handleExportarPDF = async () => {
    try {
      setIsGenerating(true);
      mostrarNotif("Generando documento PDF oficial...");

      const { jsPDFClass, autoTableFn } = await getPdfGenerators();

      const doc = new jsPDFClass({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      // Encabezado
      doc.setFillColor(250, 204, 21); // Amber / Yellow banner
      doc.rect(10, 10, 277, 12, "F");
      doc.setTextColor(15, 23, 42); // Slate 950
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMEN DE PROGRAMACION DE BATCH - VAPORIZADO APIT", 148.5, 17.5, { align: "center" });

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("MOLINO DON JULIO S.A.C. | SISTEMA INTEGRAL DE CONTROL DE CALIDAD Y PRODUCCIÓN", 10, 26);
      doc.text(`EMITIDO: ${new Date().toLocaleDateString("es-PE")} ${new Date().toLocaleTimeString("es-PE")} | USUARIO: PLANTA APIT`, 287, 26, { align: "right" });

      if (modoExportacion === "batch_individual" && batchActual) {
        // TABLA DEL BATCH INDIVIDUAL
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(10, 30, 277, 20, 2, 2, "F");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text(`BATCH: ${batchActual.batch} (${batchActual.caso || "CASO"})`, 14, 36);
        doc.text(`FECHA: ${batchActual.fecha} | TURNO: ${batchActual.turno}`, 14, 42);
        doc.text(`CLIENTE: ${batchActual.clientePrincipal}`, 100, 36);
        doc.text(`VARIEDAD: ${batchActual.variedadPrincipal}`, 100, 42);
        doc.text(`CARGA TOTAL: ${batchActual.totalSacosProg} SACOS (${((batchActual.pesoTotalKg || 0) / 1000).toFixed(2)} TN)`, 190, 36);
        doc.text(`ESTADO: ${batchActual.estado || "PROGRAMADO"}`, 190, 42);

        // Filas del lote
        const headRows = [
          [
            "LOTE ID",
            "CLIENTE",
            "VARIEDAD",
            "SAC. ING",
            "PESO ING (KG)",
            "SAC. PROG",
            "PESO PROG (KG)",
            "P(H)%",
            "DESV",
            "BL. INT",
            "BL. PUL",
            "Q.I%",
            "Q.B%",
            "T.T%",
            "T.P%",
            "T.PUN%",
            "M%",
            "TZ%",
            "COND"
          ]
        ];

        const bodyRows = (batchActual.filasLote || []).map(f => [
          f.loteId,
          f.cliente,
          f.variedad,
          f.sacos,
          (f.peso || 0).toLocaleString(),
          f.sacProg,
          (f.pesoProg || 0).toLocaleString(),
          `${f.ph}%`,
          f.desv,
          f.blInt,
          f.blBlanco > 0 ? f.blBlanco : "-",
          `${f.qi}%`,
          `${f.qb}%`,
          `${f.tt}%`,
          `${f.tp}%`,
          `${f.tpun}%`,
          `${f.m}%`,
          `${f.triz}%`,
          f.condicion
        ]);

        autoTableFn(doc, {
          head: headRows,
          body: bodyRows,
          startY: 54,
          theme: "grid",
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: "bold",
            halign: "center"
          },
          bodyStyles: {
            fontSize: 7,
            textColor: [15, 23, 42],
            halign: "center"
          },
          columnStyles: {
            0: { fontStyle: "bold", halign: "left" },
            1: { halign: "left" },
            2: { halign: "left" },
            5: { fontStyle: "bold", fillColor: [248, 250, 252] },
            6: { fontStyle: "bold", fillColor: [248, 250, 252] }
          },
          margin: { left: 10, right: 10 }
        });

        // Parámetros Operativos
        const finalY = (doc as any).lastAutoTable?.finalY || 100;
        doc.setFillColor(254, 243, 199); // Amber 100
        doc.roundedRect(10, finalY + 6, 277, 24, 2, 2, "F");

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(146, 64, 14); // Amber 800
        doc.text("PARÁMETROS OPERATIVOS DETERMINADOS DE PLANTA:", 14, finalY + 12);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        const p = batchActual.parametrosDeterminados;
        doc.text(`• Presión de Caldera / Vapor: ${p.presionBar} bar`, 14, finalY + 18);
        doc.text(`• Velocidad de Esclusa: Nivel ${p.velExclusa}`, 85, finalY + 18);
        doc.text(`• Tiempo de Reposo: ${p.tiempoReposoMin} minutos`, 150, finalY + 18);
        doc.text(`• Temperatura de Secado: ${p.tempSecadoC} °C`, 215, finalY + 18);

        if (batchActual.observacion) {
          doc.text(`Observación: ${batchActual.observacion}`, 14, finalY + 25);
        }

        // Bloque de Firmas
        const sigY = Math.min(finalY + 38, 180);
        doc.setDrawColor(148, 163, 184);
        doc.line(20, sigY, 80, sigY);
        doc.line(110, sigY, 170, sigY);
        doc.line(200, sigY, 260, sigY);

        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text("CONTROL DE CALIDAD", 50, sigY + 4, { align: "center" });
        doc.text("JEFE DE PLANTA", 140, sigY + 4, { align: "center" });
        doc.text("OPERADOR APIT (RECIBE CONFORME)", 230, sigY + 4, { align: "center" });

        doc.save(`PROGRAMACION_${batchActual.batch.toUpperCase()}_OFICIAL.pdf`);
      } else {
        // SÁBANA COMPLETA DE PROGRAMACIONES
        const headRows = [
          [
            "FECHA",
            "TURNO",
            "BATCH",
            "LOTE",
            "CLIENTE",
            "VARIEDAD",
            "SAC. PROG",
            "T.S. PROG",
            "PESO TOT",
            "P(H)%",
            "BL. INT",
            "Q.I%",
            "Q.B%",
            "T.T%",
            "COND",
            "PRESIÓN",
            "ESCLUSA",
            "REPOSO",
            "SECADO"
          ]
        ];

        const bodyRows: any[] = [];
        for (const prog of todasLasProgramaciones) {
          const filas = prog.filasLote && prog.filasLote.length > 0 ? prog.filasLote : [{
            loteId: prog.batch,
            cliente: prog.clientePrincipal,
            variedad: prog.variedadPrincipal,
            sacos: prog.totalSacosProg,
            peso: prog.pesoTotalKg,
            sacProg: prog.totalSacosProg,
            pesoProg: prog.pesoTotalKg,
            ph: prog.promedios?.ph || 14,
            desv: 1.2,
            blInt: 21.5,
            blBlanco: 39,
            qi: 7.5,
            qb: 15.5,
            tt: 1.5,
            tp: 2.5,
            tpun: 4.5,
            m: 0.8,
            triz: 1.8,
            condicion: "APTO" as const
          }];

          filas.forEach((f, idx) => {
            bodyRows.push([
              idx === 0 ? prog.fecha : "",
              idx === 0 ? prog.turno : "",
              idx === 0 ? prog.batch : "",
              f.loteId,
              f.cliente,
              f.variedad,
              f.sacProg,
              idx === 0 ? prog.totalSacosProg : "",
              idx === 0 ? (prog.pesoTotalKg || 0).toLocaleString() : "",
              idx === 0 ? `${prog.promedios?.ph ?? f.ph}%` : "",
              idx === 0 ? `${prog.promedios?.blInt ?? f.blInt}` : "",
              idx === 0 ? `${prog.promedios?.qi ?? f.qi}%` : "",
              idx === 0 ? `${prog.promedios?.qb ?? f.qb}%` : "",
              idx === 0 ? `${prog.promedios?.tt ?? f.tt}%` : "",
              idx === 0 ? (prog.promedios?.condicion ?? "APTO") : "",
              idx === 0 ? `${prog.parametrosDeterminados?.presionBar ?? 0.40} bar` : "",
              idx === 0 ? `${prog.parametrosDeterminados?.velExclusa ?? 6}` : "",
              idx === 0 ? `${prog.parametrosDeterminados?.tiempoReposoMin ?? 40}m` : "",
              idx === 0 ? `${prog.parametrosDeterminados?.tempSecadoC ?? 80}°C` : ""
            ]);
          });
        }

        autoTableFn(doc, {
          head: headRows,
          body: bodyRows,
          startY: 32,
          theme: "grid",
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: "bold",
            halign: "center"
          },
          bodyStyles: {
            fontSize: 6.5,
            textColor: [15, 23, 42],
            halign: "center"
          },
          margin: { left: 8, right: 8 }
        });

        doc.save(`SABANA_PROGRAMACION_VAPORIZADO_${new Date().toISOString().split("T")[0]}.pdf`);
      }

      mostrarNotif("✅ Documento PDF descargado exitosamente.");
    } catch (err) {
      console.error("Error exportando PDF:", err);
      mostrarNotif("❌ Error al exportar PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // 5. IMPRIMIR FICHA OFICIAL (CON SOPORTE PARA ENTORNOS SANDBOX / IFRAME)
  // -------------------------------------------------------------
  const handleImprimirFicha = async () => {
    if (!previewRef.current) return;
    try {
      setIsGenerating(true);
      mostrarNotif("Preparando Ficha Oficial para impresión...");

      const canvas = await capturarPreviewCanvas(previewRef.current, "claro");
      const imgDataUrl = canvas.toDataURL("image/png");

      const printIframe = document.createElement("iframe");
      printIframe.style.position = "fixed";
      printIframe.style.right = "0";
      printIframe.style.bottom = "0";
      printIframe.style.width = "0";
      printIframe.style.height = "0";
      printIframe.style.border = "0";
      document.body.appendChild(printIframe);

      const doc = printIframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Imprimir Ficha - ${batchActual ? batchActual.batch : "Programación"}</title>
              <style>
                @page { size: landscape; margin: 10mm; }
                body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: flex-start; background: #fff; }
                img { max-width: 100%; height: auto; }
              </style>
            </head>
            <body>
              <img src="${imgDataUrl}" onload="setTimeout(function() { window.focus(); window.print(); }, 150);" />
            </body>
          </html>
        `);
        doc.close();
        mostrarNotif("🖨️ Ventana de impresión abierta. También puede descargar el PDF oficial.");
        setTimeout(() => {
          if (document.body.contains(printIframe)) {
            document.body.removeChild(printIframe);
          }
        }, 15000);
      } else {
        await handleExportarPDF();
      }
    } catch (err) {
      console.warn("Fallback a descarga PDF para imprimir:", err);
      await handleExportarPDF();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:px-6 bg-slate-850 border-b border-slate-750 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                Exportar y Compartir Programación
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {modoExportacion === "batch_individual" ? (batchActual?.batch || "Batch") : "Sábana Completa"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Genera imágenes PNG de alta nitidez o documentos PDF oficiales para compartir por WhatsApp o imprimir.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Toggles Bar */}
        <div className="p-3 sm:px-6 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Selector de Modo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400">Alcance:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-700 bg-slate-800 p-0.5">
              {batchActual && (
                <button
                  type="button"
                  onClick={() => setModoExportacion("batch_individual")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    modoExportacion === "batch_individual"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Ficha Batch ({batchActual.batch})
                </button>
              )}
              <button
                type="button"
                onClick={() => setModoExportacion("sabana_completa")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  modoExportacion === "sabana_completa"
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Sábana Completa ({todasLasProgramaciones.length} Batches)
              </button>
            </div>

            {modoExportacion === "batch_individual" && todasLasProgramaciones.length > 1 && (
              <select
                value={batchActual?.id || batchActual?.batch || ""}
                onChange={(e) => setSelectedBatchKey(e.target.value)}
                className="bg-slate-800 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
                title="Seleccionar Batch para imprimir su ficha"
              >
                {todasLasProgramaciones.map((p, idx) => (
                  <option key={p.id || p.batch || idx} value={p.id || p.batch}>
                    Batch {p.batch} — {p.clientePrincipal} ({p.fecha})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selector de Tema */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Estilo Visual:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-700 bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setTemaExportacion("claro")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  temaExportacion === "claro"
                    ? "bg-white text-slate-950 shadow font-black"
                    : "text-slate-300 hover:text-white"
                }`}
                title="Recomendado para imprimir y compartir por WhatsApp (fondo blanco)"
              >
                Papel Oficial (Blanco)
              </button>
              <button
                type="button"
                onClick={() => setTemaExportacion("oscuro")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  temaExportacion === "oscuro"
                    ? "bg-slate-950 text-amber-400 border border-slate-700 shadow font-black"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Dark Planta
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-modal-imprimir-ficha-ahora"
              type="button"
              onClick={handleImprimirFicha}
              disabled={isGenerating}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              title="Imprimir Ficha Oficial en formato horizontal"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Imprimir Ficha</span>
            </button>

            <button
              type="button"
              onClick={handleExportarPDF}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              title="Descargar documento PDF oficial con membrete y firmas listo para imprimir"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportarImagen}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              title="Descargar imagen PNG para enviar"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Descargar PNG</span>
            </button>

            <button
              type="button"
              onClick={handleCopiarImagenPortapapeles}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              title="Copiar imagen al portapapeles para pegar directo con Ctrl+V en WhatsApp Web"
            >
              {copiadoExito ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiadoExito ? "¡Copiado!" : "Copiar Imagen (Ctrl+V)"}</span>
            </button>

            <button
              type="button"
              onClick={handleCompartir}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
              title="Compartir por WhatsApp o aplicaciones del dispositivo"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartir en WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Notification message toast if active */}
        {mensajeEstado && (
          <div className="p-2.5 px-6 bg-slate-800 border-b border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-between">
            <span>{mensajeEstado}</span>
            <button onClick={() => setMensajeEstado(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* PREVIEW CONTAINER (This is what gets captured by html2canvas) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950">
          <div 
            ref={previewRef}
            className={`p-6 rounded-xl border shadow-2xl transition-all mx-auto ${
              temaExportacion === "claro" 
                ? "bg-white text-slate-900 border-slate-300" 
                : "bg-slate-900 text-slate-100 border-slate-750"
            }`}
            style={{ maxWidth: "1050px" }}
          >
            {/* Header Oficial Molino Don Julio S.A.C. */}
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5">
                <h1 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  MOLINO DON JULIO S.A.C.
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sistema Oficial de Programación & Control de Vaporizado APIT
                </p>
              </div>

              <div className="text-right text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <div>FECHA EMISIÓN: {new Date().toLocaleDateString("es-PE")}</div>
                <div>HORA: {new Date().toLocaleTimeString("es-PE")}</div>
                <div className="font-bold text-amber-600 dark:text-amber-400">PLANTA DE VAPORIZADO</div>
              </div>
            </div>

            {/* Banner Amarillo idéntico a la Hoja de Planta */}
            <div className="bg-yellow-400 text-slate-950 py-2 px-4 rounded-lg font-black text-xs sm:text-sm uppercase tracking-widest text-center shadow-inner mb-4">
              RESUMEN DE PROGRAMACION DE BATCH - VAPORIZADO APIT
            </div>

            {/* MODO 1: FICHA BATCH INDIVIDUAL */}
            {modoExportacion === "batch_individual" && batchActual && (
              <div className="space-y-4">
                {/* Meta Banner del Batch */}
                <div className={`p-4 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs ${
                  temaExportacion === "claro" ? "bg-slate-50 border-slate-200" : "bg-slate-850 border-slate-700"
                }`}>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Batch:</span>
                    <span className="font-black text-amber-600 dark:text-amber-400 text-base">{batchActual.batch}</span>
                    <span className="text-[10px] text-slate-500 block">{batchActual.caso || "Caso"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha & Turno:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{batchActual.fecha}</span>
                    <span className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400">TURNO {batchActual.turno}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente Principal:</span>
                    <span className="font-bold text-slate-800 dark:text-white truncate block">{batchActual.clientePrincipal}</span>
                    <span className="text-[10px] text-slate-500">Var: {batchActual.variedadPrincipal}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Carga Programada:</span>
                    <span className="font-black text-slate-900 dark:text-white text-base">
                      {batchActual.totalSacosProg} Sacos
                    </span>
                    <span className="block text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      {((batchActual.pesoTotalKg || 0) / 1000).toFixed(1)} TN
                    </span>
                  </div>
                </div>

                {/* Tabla de Lotes que Componen el Batch */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className={`border-b text-[10px] uppercase font-bold ${
                        temaExportacion === "claro" ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}>
                        <th className="py-2 px-2">Lote ID</th>
                        <th className="py-2 px-2">Cliente</th>
                        <th className="py-2 px-2">Variedad</th>
                        <th className="py-2 px-2 text-center">Sacos Ingreso</th>
                        <th className="py-2 px-2 text-center font-black text-amber-700 dark:text-amber-300">Sacos Prog.</th>
                        <th className="py-2 px-2 text-right">Peso Prog. (kg)</th>
                        <th className="py-2 px-1 text-center">P(H)%</th>
                        <th className="py-2 px-1 text-center">Desv</th>
                        <th className="py-2 px-1 text-center">BL. Int</th>
                        <th className="py-2 px-1 text-center">Q.I%</th>
                        <th className="py-2 px-1 text-center">Q.B%</th>
                        <th className="py-2 px-1 text-center">T.T%</th>
                        <th className="py-2 px-2 text-center">Condición</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(batchActual.filasLote || []).map((f: LoteProgramacionFila, i: number) => (
                        <tr key={i} className="font-mono">
                          <td className="py-2 px-2 font-black text-cyan-600 dark:text-cyan-400">{f.loteId}</td>
                          <td className="py-2 px-2 font-sans">{f.cliente}</td>
                          <td className="py-2 px-2 font-sans">{f.variedad}</td>
                          <td className="py-2 px-2 text-center text-slate-500">{f.sacos}</td>
                          <td className={`py-2 px-2 text-center font-black ${
                            temaExportacion === "claro" ? "bg-amber-50 text-amber-900" : "bg-amber-950/30 text-amber-300"
                          }`}>
                            {f.sacProg}
                          </td>
                          <td className="py-2 px-2 text-right font-bold">{(f.pesoProg || 0).toLocaleString()}</td>
                          <td className="py-2 px-1 text-center font-bold text-cyan-600 dark:text-cyan-300">{f.ph}%</td>
                          <td className="py-2 px-1 text-center">{f.desv}</td>
                          <td className="py-2 px-1 text-center">{f.blInt}</td>
                          <td className="py-2 px-1 text-center">{f.qi}%</td>
                          <td className="py-2 px-1 text-center">{f.qb}%</td>
                          <td className="py-2 px-1 text-center">{f.tt}%</td>
                          <td className="py-2 px-2 text-center font-sans font-bold">
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {f.condicion}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t-2 font-bold font-mono text-xs ${
                        temaExportacion === "claro" ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-slate-850 border-slate-700 text-white"
                      }`}>
                        <td colSpan={3} className="py-2 px-2 font-sans uppercase">TOTALES & PROMEDIOS PONDERADOS:</td>
                        <td className="py-2 px-2 text-center">
                          {(batchActual.filasLote || []).reduce((sum, f) => sum + (f.sacos || 0), 0)}
                        </td>
                        <td className="py-2 px-2 text-center font-black text-amber-600 dark:text-amber-400">
                          {batchActual.totalSacosProg}
                        </td>
                        <td className="py-2 px-2 text-right font-black">
                          {(batchActual.pesoTotalKg || 0).toLocaleString()} kg
                        </td>
                        <td className="py-2 px-1 text-center font-black text-cyan-600 dark:text-cyan-400">
                          {batchActual.promedios?.ph || 14.0}%
                        </td>
                        <td className="py-2 px-1 text-center">{batchActual.promedios?.desv || 1.2}</td>
                        <td className="py-2 px-1 text-center">{batchActual.promedios?.blInt || 21.5}</td>
                        <td className="py-2 px-1 text-center">{batchActual.promedios?.qi || 7.5}%</td>
                        <td className="py-2 px-1 text-center">{batchActual.promedios?.qb || 15.5}%</td>
                        <td className="py-2 px-1 text-center">{batchActual.promedios?.tt || 1.5}%</td>
                        <td className="py-2 px-2 text-center font-sans">
                          {batchActual.promedios?.condicion || "APTO"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Parámetros Operativos de Planta */}
                <div className={`p-4 rounded-xl border ${
                  temaExportacion === "claro" ? "bg-amber-50/70 border-amber-300" : "bg-amber-950/20 border-amber-500/40"
                }`}>
                  <div className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    Parámetros Operativos de Vaporizado Determinados:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className={`p-2.5 rounded-lg border ${temaExportacion === "claro" ? "bg-white border-amber-200" : "bg-slate-900 border-slate-750"}`}>
                      <span className="text-[10px] text-slate-500 uppercase block">Presión de Vapor:</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {batchActual.parametrosDeterminados?.presionBar ?? 0.40} bar
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${temaExportacion === "claro" ? "bg-white border-amber-200" : "bg-slate-900 border-slate-750"}`}>
                      <span className="text-[10px] text-slate-500 uppercase block">Velocidad de Esclusa:</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        Nivel {batchActual.parametrosDeterminados?.velExclusa ?? 6}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${temaExportacion === "claro" ? "bg-white border-amber-200" : "bg-slate-900 border-slate-750"}`}>
                      <span className="text-[10px] text-slate-500 uppercase block">Tiempo en Reposo:</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {batchActual.parametrosDeterminados?.tiempoReposoMin ?? 40} min
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${temaExportacion === "claro" ? "bg-white border-amber-200" : "bg-slate-900 border-slate-750"}`}>
                      <span className="text-[10px] text-slate-500 uppercase block">Temperatura de Secado:</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {batchActual.parametrosDeterminados?.tempSecadoC ?? 80} °C
                      </span>
                    </div>
                  </div>

                  {batchActual.observacion && (
                    <div className="mt-3 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      <span className="font-bold">Observación: </span> {batchActual.observacion}
                    </div>
                  )}
                </div>

                {/* Bloque de Firmas de Planta */}
                <div className="grid grid-cols-3 gap-6 pt-8 pb-2 text-center text-[10px] text-slate-500 dark:text-slate-400">
                  <div className="border-t border-slate-300 dark:border-slate-700 pt-1">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">CONTROL DE CALIDAD</span>
                    <span>V°B° Parámetros & Desviaciones</span>
                  </div>
                  <div className="border-t border-slate-300 dark:border-slate-700 pt-1">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">JEFE DE PLANTA</span>
                    <span>Aprobación de Programación</span>
                  </div>
                  <div className="border-t border-slate-300 dark:border-slate-700 pt-1">
                    <span className="font-bold block text-slate-700 dark:text-slate-300">OPERADOR APIT</span>
                    <span>Recepción de Orden de Proceso</span>
                  </div>
                </div>
              </div>
            )}

            {/* MODO 2: SÁBANA COMPLETA DE PROGRAMACIÓN */}
            {modoExportacion === "sabana_completa" && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className={`border-b uppercase font-bold text-[9px] ${
                        temaExportacion === "claro" ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}>
                        <th className="py-2 px-1 text-center">FECHA</th>
                        <th className="py-2 px-1 text-center">TURNO</th>
                        <th className="py-2 px-1.5 text-center font-black text-amber-600">BATCH</th>
                        <th className="py-2 px-1.5">LOTE</th>
                        <th className="py-2 px-2">CLIENTE</th>
                        <th className="py-2 px-1.5">VARIEDAD</th>
                        <th className="py-2 px-1 text-center font-bold">SAC. PROG</th>
                        <th className="py-2 px-1 text-center font-black">T.S. PROG</th>
                        <th className="py-2 px-1.5 text-center font-black text-amber-600">PESO TOT</th>
                        <th className="py-2 px-1 text-center font-black text-cyan-600">P(H)%</th>
                        <th className="py-2 px-1 text-center">BL. INT</th>
                        <th className="py-2 px-1 text-center">Q.I%</th>
                        <th className="py-2 px-1 text-center">Q.B%</th>
                        <th className="py-2 px-1 text-center">T.T%</th>
                        <th className="py-2 px-1 text-center">COND</th>
                        <th className="py-2 px-1 text-center">PRESIÓN</th>
                        <th className="py-2 px-1 text-center">ESCLUSA</th>
                        <th className="py-2 px-1 text-center">REPOSO</th>
                        <th className="py-2 px-1 text-center">SECADO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                      {todasLasProgramaciones.map((prog, pIdx) => {
                        const filas = prog.filasLote && prog.filasLote.length > 0 ? prog.filasLote : [{
                          loteId: prog.batch,
                          cliente: prog.clientePrincipal,
                          variedad: prog.variedadPrincipal,
                          sacos: prog.totalSacosProg,
                          peso: prog.pesoTotalKg,
                          sacProg: prog.totalSacosProg,
                          pesoProg: prog.pesoTotalKg,
                          ph: prog.promedios?.ph || 14,
                          desv: 1.2,
                          blInt: 21.5,
                          blBlanco: 39,
                          qi: 7.5,
                          qb: 15.5,
                          tt: 1.5,
                          tp: 2.5,
                          tpun: 4.5,
                          m: 0.8,
                          triz: 1.8,
                          condicion: "APTO" as const
                        }];

                        return (
                          <React.Fragment key={pIdx}>
                            {filas.map((f, fIdx) => (
                              <tr key={`${pIdx}-${fIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                {fIdx === 0 && (
                                  <>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle font-sans border-r border-slate-200 dark:border-slate-800">
                                      {prog.fecha}
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle font-sans font-bold border-r border-slate-200 dark:border-slate-800">
                                      {prog.turno}
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1.5 text-center align-middle font-black text-amber-600 dark:text-amber-400 border-r border-slate-200 dark:border-slate-800">
                                      {prog.batch}
                                    </td>
                                  </>
                                )}
                                <td className="py-1 px-1.5 font-black text-cyan-600 dark:text-cyan-400 border-r border-slate-200 dark:border-slate-800">
                                  {f.loteId}
                                </td>
                                <td className="py-1 px-2 font-sans truncate max-w-[120px] border-r border-slate-200 dark:border-slate-800">
                                  {f.cliente}
                                </td>
                                <td className="py-1 px-1.5 font-sans border-r border-slate-200 dark:border-slate-800">
                                  {f.variedad}
                                </td>
                                <td className="py-1 px-1 text-center border-r border-slate-200 dark:border-slate-800">
                                  {f.sacProg}
                                </td>
                                {fIdx === 0 && (
                                  <>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle font-black border-r border-slate-200 dark:border-slate-800">
                                      {prog.totalSacosProg}
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1.5 text-center align-middle font-black text-amber-700 dark:text-amber-300 border-r border-slate-200 dark:border-slate-800">
                                      {(prog.pesoTotalKg || 0).toLocaleString()}
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle font-black text-cyan-600 dark:text-cyan-400 border-r border-slate-200 dark:border-slate-800">
                                      {prog.promedios?.ph || 14}%
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle border-r border-slate-200 dark:border-slate-800">
                                      {prog.promedios?.blInt || 21.5}
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle border-r border-slate-200 dark:border-slate-800">
                                      {prog.promedios?.qi || 7.5}%
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle border-r border-slate-200 dark:border-slate-800">
                                      {prog.promedios?.qb || 15.5}%
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle border-r border-slate-200 dark:border-slate-800">
                                      {prog.promedios?.tt || 1.5}%
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle font-sans font-bold border-r border-slate-200 dark:border-slate-800">
                                      {prog.promedios?.condicion || "APTO"}
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle border-r border-slate-200 dark:border-slate-800">
                                      {prog.parametrosDeterminados?.presionBar ?? 0.40} bar
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle border-r border-slate-200 dark:border-slate-800">
                                      {prog.parametrosDeterminados?.velExclusa ?? 6}
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle border-r border-slate-200 dark:border-slate-800">
                                      {prog.parametrosDeterminados?.tiempoReposoMin ?? 40}m
                                    </td>
                                    <td rowSpan={filas.length} className="py-1 px-1 text-center align-middle">
                                      {prog.parametrosDeterminados?.tempSecadoC ?? 80}°C
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Resumen al pie de la sábana */}
                <div className="flex items-center justify-between pt-3 border-t text-xs border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-slate-700 dark:text-slate-300">
                    Total de Batches Programados: {todasLasProgramaciones.length}
                  </div>
                  <div className="font-black text-amber-600 dark:text-amber-400">
                    Total Sacos: {todasLasProgramaciones.reduce((sum, p) => sum + (p.totalSacosProg || 0), 0)} Sacos ({((todasLasProgramaciones.reduce((sum, p) => sum + (p.pesoTotalKg || 0), 0)) / 1000).toFixed(1)} TN)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3 sm:px-6 bg-slate-850 border-t border-slate-750 flex items-center justify-between text-xs text-slate-400">
          <span>
            💡 <strong>Consejo:</strong> Haz clic en <em>"Copiar Imagen"</em> para pegarla de inmediato en cualquier chat de WhatsApp Web con Ctrl+V.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
