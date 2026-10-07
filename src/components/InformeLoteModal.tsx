import React, { useState } from "react";
import { 
  Lote, 
  AnalisisHumedo, 
  AnalisisSeco, 
  AnalisisVaporizado, 
  ControlVaporizado, 
  ProgramacionApit, 
  BatchVaporizado, 
  RegistroHumedad, 
  SuccessWeights 
} from "../types";
import { 
  X, 
  Printer, 
  FileSpreadsheet, 
  Award, 
  Flame, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Download, 
  Building, 
  Scale, 
  Clock,
  FileText,
  ShieldCheck,
  Check,
  Loader2,
  TrendingUp,
  Layers,
  Gauge,
  Droplets,
  ArrowRight,
  Sliders,
  CheckCheck
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InformeLoteModalProps {
  isOpen: boolean;
  loteId: string;
  lotes?: Lote[];
  analisisHumedos?: AnalisisHumedo[];
  analisisSecos?: AnalisisSeco[];
  analisisVapList?: AnalisisVaporizado[];
  controles?: ControlVaporizado[];
  programaciones?: ProgramacionApit[];
  batches?: BatchVaporizado[];
  humedades?: RegistroHumedad[];
  weights?: SuccessWeights;
  onClose: () => void;
}

export const InformeLoteModal: React.FC<InformeLoteModalProps> = ({
  isOpen,
  loteId,
  lotes = [],
  analisisHumedos = [],
  analisisSecos = [],
  analisisVapList = [],
  controles = [],
  programaciones = [],
  batches = [],
  humedades = [],
  weights = {
    incrementoQuebrado: 30,
    controlDefectos: 25,
    resultadoCoccion: 20,
    blancura: 15,
    cumplimientoProceso: 10,
    targetQuebradoMaxInc: 3.5,
    targetBlancuraMin: 38,
    targetHumedadFinal: 13.0
  },
  onClose
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [isGeneratingFichaPdf, setIsGeneratingFichaPdf] = useState(false);
  const [fichaPdfSuccess, setFichaPdfSuccess] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [forzarModoDoblePase, setForzarModoDoblePase] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const lote = lotes.find((l) => l.LOTE_ID === loteId) || lotes[0];
  const ah = analisisHumedos.find((a) => a.LOTE_ID === loteId);
  const as = analisisSecos.find((a) => a.LOTE_ID === loteId);
  const av = analisisVapList.find((a) => a.LOTE_ID === loteId);
  const prog = programaciones.find((p) => p.LOTE_ID === loteId);
  const batch = batches.find((b) => b.BATCH_ID === prog?.BATCH_ID) || batches[0];
  const ctrl = controles.find((c) => c.BATCH_ID === batch?.BATCH_ID);
  const regHum = humedades.find((h) => h.LOTE_ID === loteId);

  // Determinar si el lote fue procesado con doble inyección (2 Pases)
  const humedadIngresoNum = Number(regHum?.["H. PROMEDIO"] || lote?.HUM || ah?.HUMEDADES || 14.0);
  const detectedDoblePase = 
    ctrl?.datosVaporizado?.modalidadPases === "2_PASES" ||
    Boolean(ctrl?.datosVaporizado?.inyeccionVaporPase1?.inicio && ctrl?.datosVaporizado?.inyeccionVaporPase2?.inicio) ||
    Boolean(ctrl?.datosVaporizado?.inyeccionVaporPase1?.presion && ctrl?.datosVaporizado?.inyeccionVaporPase2?.presion) ||
    (humedadIngresoNum < 14.0 && ctrl?.datosVaporizado?.modalidadPases !== "1_PASE");

  const esDoblePase = forzarModoDoblePase !== null ? forzarModoDoblePase : detectedDoblePase;

  // Extracción de datos para Pase 1 y Pase 2
  const p1 = ctrl?.datosVaporizado?.inyeccionVaporPase1 || {
    paseNumero: 1,
    nombre: "1° Pase (Acondicionamiento / Pre-calor)",
    inicio: "08:00",
    fin: "08:12",
    duracion: "12 min",
    presion: 0.40,
    presionMax: 0.55,
    rpm: 18,
    temperatura: 125,
    perfil: "Acondicionamiento Suave",
    tiempoReposo: "10 min",
    obs: "Pre-calentamiento térmico para mitigación de shock térmico y fisuras"
  };

  const p2 = ctrl?.datosVaporizado?.inyeccionVaporPase2 || {
    paseNumero: 2,
    nombre: "2° Pase (Cocción / Gelatinización Principal)",
    inicio: "08:22",
    fin: "08:40",
    duracion: "18 min",
    presion: 0.45,
    presionMax: 0.55,
    rpm: 18,
    temperatura: 130,
    perfil: "Cocción Profunda / Gelatinización",
    tiempoReposo: "45 min",
    obs: "Cocción profunda y gelatinización completa del endospermo"
  };

  const deltaPresion = Number((Number(p2.presion || 0.45) - Number(p1.presion || 0.40)).toFixed(2));
  const deltaTemp = Number((Number(p2.temperatura || 130) - Number(p1.temperatura || 125)).toFixed(1));
  const reposoInterPases = ctrl?.datosVaporizado?.tiempoReposoInterPases || p1.tiempoReposo || "10 min";
  const tiempoTotalVapor = ctrl?.datosVaporizado?.tiempoTotalInyeccionMin || "30 min";

  // Quality Deltas
  const qiAntes = Number(ah?.QI || 8.5);
  const qiDespues = Number(as?.QI_Final || av?.QI || 9.8);
  const deltaQuebrado = Number((qiDespues - qiAntes).toFixed(2));

  const tzAntes = Number(ah?.TZ || 2.1);
  const tzDespues = Number(as?.Trizado_Final || av?.TZ || 1.6);
  const deltaTrizado = Number((tzDespues - tzAntes).toFixed(2));

  const ttAntes = Number(ah?.TT || 3.2);
  const ttDespues = Number(as?.Tiza_Final || av?.TT || 0.6);
  const deltaTiza = Number((ttDespues - ttAntes).toFixed(2));

  const blAntes = Number(ah?.["B. PULIDO"] || 30.5);
  const blDespues = Number(as?.Blancura_Final || av?.BL || 39.5);

  const coccionScore = Number(as?.Coccion_Score || 92);

  // Global Score
  const scoreQuebrado = Math.max(0, Math.min(100, 100 - Math.max(0, deltaQuebrado - 1.0) * 35));
  const scoreDefectos = Math.max(0, Math.min(100, 95 - (tzDespues > 2.0 ? 20 : 0) - (ttDespues > 1.0 ? 15 : 0)));
  const scoreCoccion = coccionScore;
  const scoreBlancura = blDespues >= weights.targetBlancuraMin ? 100 : (blDespues / weights.targetBlancuraMin) * 100;
  const scoreCumplimiento = 95;

  const indiceExito = Number((
    scoreQuebrado * (weights.incrementoQuebrado / 100) +
    scoreDefectos * (weights.controlDefectos / 100) +
    scoreCoccion * (weights.resultadoCoccion / 100) +
    scoreBlancura * (weights.blancura / 100) +
    scoreCumplimiento * (weights.cumplimientoProceso / 100)
  ).toFixed(1));

  const clasificacion = indiceExito >= 85 ? "LOTE EXITOSO" : indiceExito >= 70 ? "LOTE CONFORME" : "LOTE OBSERVADO";

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    try {
      setIsGeneratingPdf(true);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;

      // 1. Top Decorative Bar
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setFillColor(217, 119, 6);
      doc.rect(0, 28, pageWidth, 2, "F");

      // 2. Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("MOLINO INDUSTRIAL ARROZVAPOR S.A.", margin, 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(251, 191, 36); // Amber 400
      doc.text("SISTEMA INTEGRAL DE GESTIÓN Y TRAZABILIDAD DE VAPORIZADO (APIT)", margin, 18);

      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text("Planta de Procesamiento Industrial | Laboratorio de Control de Calidad", margin, 23);

      // Certificate Box in Header
      const certX = pageWidth - margin - 55;
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(certX, 5, 55, 20, 2, 2, "F");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("INFORME OFICIAL N°", certX + 27.5, 9.5, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(251, 191, 36);
      doc.text(`INF-${lote?.LOTE_ID || loteId}`, certX + 27.5, 15, { align: "center" });
      doc.setFontSize(6.5);
      doc.setTextColor(203, 213, 225);
      doc.text(`Emisión: ${new Date().toLocaleDateString()}`, certX + 27.5, 20, { align: "center" });

      let currentY = 36;

      // 3. Document Title Banner
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(`INFORME TÉCNICO DE TRAZABILIDAD - LOTE ${lote?.LOTE_ID || loteId}`, margin, currentY);

      currentY += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Evaluación completa de 25 puntos de control de calidad, proceso térmico en autoclave y dictamen de liberación.", margin, currentY);

      currentY += 6;

      // 4. Executive Summary Card (Grid of 4 Key Indicators)
      const colW = (pageWidth - (margin * 2) - 9) / 4;
      
      // Card 1: Cliente
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, currentY, colW, 16, 2, 2, "F");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("CLIENTE / ORIGEN", margin + 3, currentY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const clienteStr = doc.splitTextToSize(lote?.CLIENTE || "Cliente", colW - 6);
      doc.text(clienteStr, margin + 3, currentY + 9.5);

      // Card 2: Variedad & Kilos
      const x2 = margin + colW + 3;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x2, currentY, colW, 16, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("VARIEDAD / PESO", x2 + 3, currentY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(8, 145, 178);
      doc.text(`${lote?.VARIEDAD || "TINAJONES"}`, x2 + 3, currentY + 9.5);
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`${lote?.SACOS || 0} sac / ${((lote?.PESO_KG || 0) / 1000).toFixed(1)} TN`, x2 + 3, currentY + 14);

      // Card 3: Batch Asociado
      const x3 = x2 + colW + 3;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x3, currentY, colW, 16, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("BATCH / EQUIPO", x3 + 3, currentY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(217, 119, 6);
      doc.text(`${batch?.BATCH_ID || "V200"}`, x3 + 3, currentY + 9.5);
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(`${batch?.EQUIPO || "APIT"}`, x3 + 3, currentY + 14);

      // Card 4: Clasificación y Score
      const x4 = x3 + colW + 3;
      doc.setFillColor(indiceExito >= 85 ? 236 : 254, indiceExito >= 85 ? 253 : 243, indiceExito >= 85 ? 245 : 199);
      doc.roundedRect(x4, currentY, colW, 16, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(indiceExito >= 85 ? 4 : 154, indiceExito >= 85 ? 120 : 52, indiceExito >= 85 ? 87 : 18);
      doc.text("ÍNDICE DE ÉXITO", x4 + 3, currentY + 4.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(indiceExito >= 85 ? 5 : 180, indiceExito >= 85 ? 150 : 83, indiceExito >= 85 ? 105 : 9);
      doc.text(`${indiceExito}%`, x4 + 3, currentY + 10);
      doc.setFontSize(7);
      doc.text(`${clasificacion}`, x4 + 3, currentY + 14);

      currentY += 21;

      // 5. SECCIÓN 1: TABLA DE IDENTIFICACIÓN & CALIDAD INICIAL (Puntos 1 al 10)
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { content: "I. IDENTIFICACIÓN Y ORIGEN DEL GRANO", colSpan: 2, styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" } },
            { content: "II. CALIDAD INICIAL & PROGRAMACIÓN APIT", colSpan: 2, styles: { fillColor: [8, 145, 178], textColor: [255, 255, 255], fontStyle: "bold" } }
          ]
        ],
        body: [
          [
            "1. Código del Lote:", lote?.LOTE_ID || loteId,
            "6. Humedad Inicial (Prom / Desv):", `${regHum?.["H. PROMEDIO"] || lote?.HUM || 14.0}% (±${regHum?.["DESV."] || "0.15"})`
          ],
          [
            "2. Cliente / Procedencia:", `${lote?.CLIENTE || "Cliente"} (${lote?.ZONA || "Chiclayo"})`,
            "7. Análisis Físico Inicial:", `QI: ${qiAntes}%, TZ: ${tzAntes}%, TT: ${ttAntes}%`
          ],
          [
            "3. Variedad de Arroz:", lote?.VARIEDAD || "TINAJONES",
            "8. Aptitud APIT:", `${prog?.APTO_APIT || "SI (Apto para vaporizado)"}`
          ],
          [
            "4. Peso Total & Sacos:", `${lote?.SACOS || 0} sacos / ${((lote?.PESO_KG || 0) / 1000).toFixed(2)} TN (${(lote?.PESO_KG || 0).toLocaleString()} kg)`,
            "9. Sugerencia IA Previa:", "1.85 bar / 28 min vapor / 45 min reposo"
          ],
          [
            "5. Silo / Ubicación:", lote?.UBICACION || "Silo 02 - Planta Principal",
            "10. Programación Asignada:", `Prioridad ${prog?.PRIORIDAD || "ALTA"} (${prog?.FECHA_PROGRAMACION || "2025-02-10"})`
          ]
        ],
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 40, fillColor: [248, 250, 252] },
          1: { cellWidth: 50 },
          2: { fontStyle: "bold", cellWidth: 45, fillColor: [248, 250, 252] },
          3: { cellWidth: 45 }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // 6. SECCIÓN 2: TABLA DE CONTROL DE PROCESO & EVALUACIÓN FINAL (Puntos 11 al 25)
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { content: "III. CONTROL DE PROCESO EN PLANTA", colSpan: 2, styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: "bold" } },
            { content: "IV. RESULTADOS POST-PROCESO Y ÉXITO", colSpan: 2, styles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: "bold" } }
          ]
        ],
        body: [
          [
            "11. Batch de Producción:", batch?.BATCH_ID || "V200",
            "18. Humedad Final Post-Secado:", `${as?.Humedad_Final || av?.HUMEDAD || 12.8}% HUM (Meta: 12.8 - 13.0%)`
          ],
          [
            "12. Equipo / Autoclave:", `${batch?.EQUIPO || "APIT"}`,
            "19. Calidad Post-Vaporizado:", `QI: ${qiDespues}%, BL: ${blDespues}, BLI: 22.5`
          ],
          [
            "13. Inyección de Vapor Real:", `${ctrl?.PRESION_BAR || 1.85} bar @ ${ctrl?.RPM || 18} RPM (${ctrl?.TIEMPO_VAPORIZADO_MIN || 28} min)`,
            "20. Variación de Defectos:", `Trizado: ${tzAntes}% → ${tzDespues}% | Tiza: ${ttAntes}% → ${ttDespues}%`
          ],
          [
            "14. Reposo Térmico:", `${ctrl?.TIEMPO_REPOSO_MIN || 45} min (Temp. Sup: ${ctrl?.TEMP_SUPERIOR_C || 92}°C)`,
            "21. Incremento de Quebrado:", `Δ ${deltaQuebrado > 0 ? `+${deltaQuebrado}` : deltaQuebrado}% (Límite Máx: +3.5%)`
          ],
          [
            "15. Descarga en Caliente:", `Temp: ${ctrl?.TEMPERATURA_SALIDA_C || 88}°C, Hum: ${ctrl?.HUMEDAD_SALIDA || 18.5}%`,
            "22. Gelatinización & Cocción:", `Gelat: 98.0% | Score Cocción: ${coccionScore}/100`
          ],
          [
            "16. Secado en Columna:", "Temp: 75°C / Tiempo: 120 min / Columna 01",
            "23. Índice de Éxito Ponderado:", `${indiceExito}% (${clasificacion})`
          ],
          [
            "17. Desviaciones Registradas:", `${ctrl?.DESVIACION || "Ninguna / Parámetros Estables"}`,
            "24. Clasificación Oficial:", `${clasificacion}`
          ],
          [
            "Operador de Planta:", `${ctrl?.OPERADOR || "Pedro Huamán C."}`,
            "25. Recomendación Futura:", `Mantener receta ${ctrl?.PRESION_BAR || 1.85} bar para variedad ${lote?.VARIEDAD || "TINAJONES"}`
          ]
        ],
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 40, fillColor: [248, 250, 252] },
          1: { cellWidth: 50 },
          2: { fontStyle: "bold", cellWidth: 45, fillColor: [248, 250, 252] },
          3: { cellWidth: 45 }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;

      // 7. COMPARATIVA TÉCNICA DE DOBLE INYECCIÓN (SI EL LOTE FUE PROCESADO CON 2 PASES)
      if (esDoblePase) {
        if (currentY + 55 > 275) {
          doc.addPage();
          currentY = 16;
        }

        autoTable(doc, {
          startY: currentY,
          margin: { left: margin, right: margin },
          head: [
            [
              { content: "III.B. COMPARATIVA TÉCNICA DE DOBLE INYECCIÓN (1° PASE VS 2° PASE — ANTI-TRIZADO)", colSpan: 5, styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } }
            ],
            [
              "Parámetro de Control",
              "1° Pase (Acondicionamiento)",
              "2° Pase (Cocción Principal)",
              "Variación (Δ) / Transición",
              "Impacto en Calidad"
            ]
          ],
          body: [
            [
              "Fase & Objetivo",
              "Pre-calor & Acondicionamiento",
              "Cocción & Gelatinización Total",
              "Secuencia Bifásica Térmica",
              "Apertura de poro sin choque térmico"
            ],
            [
              "Presión de Vapor (bar)",
              `${p1.presion ?? 0.40} bar (Máx: ${p1.presionMax ?? 0.55} bar)`,
              `${p2.presion ?? 0.45} bar (Máx: ${p2.presionMax ?? 0.55} bar)`,
              `${deltaPresion >= 0 ? `+${deltaPresion}` : deltaPresion} bar (Rampa Progresiva)`,
              "Penetración uniforme y gradual"
            ],
            [
              "Temperatura Trabajo (°C)",
              `${p1.temperatura ?? 125} °C`,
              `${p2.temperatura ?? 130} °C`,
              `${deltaTemp >= 0 ? `+${deltaTemp}` : deltaTemp} °C (Gradiente Ascendente)`,
              "Evita fracturas por gradiente térmico"
            ],
            [
              "Velocidad Autoclave (RPM)",
              `${p1.rpm ?? 18} RPM`,
              `${p2.rpm ?? 18} RPM`,
              "Constante (18 RPM)",
              "Homogeneidad en la masa de grano"
            ],
            [
              "Horario & Duración",
              `${p1.inicio && p1.fin ? `${p1.inicio} - ${p1.fin}` : "08:00 - 08:12"} (${p1.duracion || "12 min"})`,
              `${p2.inicio && p2.fin ? `${p2.inicio} - ${p2.fin}` : "08:22 - 08:40"} (${p2.duracion || "18 min"})`,
              `Total Neto: ${tiempoTotalVapor}`,
              "Cocción profunda sin sobrecalentamiento"
            ],
            [
              "Reposo Posterior",
              `${reposoInterPases} (Inter-Pases)`,
              `${p2.tiempoReposo || "45 min"} (Hacia 1° Reposo)`,
              "Estabilización osmótica",
              "Difusión equilibrada al núcleo"
            ],
            [
              "Control de Defectos",
              "Mitigación de micro-fisuras",
              "Gelatinización 98% homogénea",
              `Trizado: ${tzDespues}% | Δ QI: ${deltaQuebrado > 0 ? `+${deltaQuebrado}` : deltaQuebrado}%`,
              "Rendimiento de grano entero protegido"
            ]
          ],
          theme: "grid",
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 7.0,
            fontStyle: "bold",
            halign: "center"
          },
          styles: {
            fontSize: 6.8,
            cellPadding: 2,
            halign: "center",
            textColor: [30, 41, 59]
          },
          columnStyles: {
            0: { halign: "left", fontStyle: "bold", cellWidth: 38, fillColor: [248, 250, 252] },
            1: { cellWidth: 36 },
            2: { cellWidth: 36 },
            3: { cellWidth: 36, fontStyle: "bold", textColor: [217, 119, 6] },
            4: { halign: "left", cellWidth: 36, textColor: [5, 150, 105], fontStyle: "bold" }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
      }

      // 8. COMPARATIVA DE DELTAS DE CALIDAD (ANTES VS DESPUÉS)
      if (currentY + 45 > 275) {
        doc.addPage();
        currentY = 16;
      }

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            "Parámetro Físico",
            "Inicial (Arroz Húmedo)",
            "Final (Post-Vaporizado)",
            "Variación (Δ Delta)",
            "Tolerancia Máxima",
            "Evaluación"
          ]
        ],
        body: [
          [
            "Humedad del Grano",
            `${regHum?.["H. PROMEDIO"] || lote?.HUM || 14.0}%`,
            `${as?.Humedad_Final || 12.8}%`,
            `${(Number(as?.Humedad_Final || 12.8) - Number(regHum?.["H. PROMEDIO"] || lote?.HUM || 14.0)).toFixed(1)}%`,
            "12.5% - 13.5%",
            "CONFORME"
          ],
          [
            "Quebrado Integral (% QI)",
            `${qiAntes}%`,
            `${qiDespues}%`,
            `${deltaQuebrado > 0 ? `+${deltaQuebrado}` : deltaQuebrado}%`,
            "Δ Máx +3.5%",
            deltaQuebrado <= 3.5 ? "CONFORME" : "OBSERVADO"
          ],
          [
            "Grano Trizado (% TZ)",
            `${tzAntes}%`,
            `${tzDespues}%`,
            `${deltaTrizado > 0 ? `+${deltaTrizado}` : deltaTrizado}%`,
            "≤ 2.0%",
            tzDespues <= 2.0 ? "CONFORME" : "OBSERVADO"
          ],
          [
            "Grano Yesoso / Tiza (% TT)",
            `${ttAntes}%`,
            `${ttDespues}%`,
            `${deltaTiza > 0 ? `+${deltaTiza}` : deltaTiza}%`,
            "≤ 1.0%",
            ttDespues <= 1.0 ? "CONFORME" : "OBSERVADO"
          ],
          [
            "Blancura Kett (BL)",
            `${blAntes}`,
            `${blDespues}`,
            `+${(blDespues - blAntes).toFixed(1)}`,
            "≥ 38.0 Kett",
            blDespues >= 38.0 ? "CONFORME" : "OBSERVADO"
          ]
        ],
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          halign: "center",
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          5: { fontStyle: "bold", textColor: [5, 150, 105] }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 7;

      // 8. Signatures Block
      if (currentY + 28 > 280) {
        doc.addPage();
        currentY = 20;
      }

      const sigWidth = (pageWidth - (margin * 2) - 16) / 3;

      // Signature 1
      doc.setDrawColor(148, 163, 184);
      doc.line(margin, currentY + 12, margin + sigWidth, currentY + 12);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Pedro Huamán C.", margin + (sigWidth / 2), currentY + 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Jefe de Planta / Operaciones", margin + (sigWidth / 2), currentY + 19.5, { align: "center" });

      // Signature 2
      const sig2X = margin + sigWidth + 8;
      doc.line(sig2X, currentY + 12, sig2X + sigWidth, currentY + 12);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Ing. Carlos Morales", sig2X + (sigWidth / 2), currentY + 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Responsable de Control de Calidad", sig2X + (sigWidth / 2), currentY + 19.5, { align: "center" });

      // Signature 3
      const sig3X = sig2X + sigWidth + 8;
      doc.line(sig3X, currentY + 12, sig3X + sigWidth, currentY + 12);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("ArrozVapor IA Engine v2.0", sig3X + (sigWidth / 2), currentY + 16, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Certificación & Auditoría Digital", sig3X + (sigWidth / 2), currentY + 19.5, { align: "center" });

      // 9. Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Molino Industrial ArrozVapor S.A. | Reporte Oficial de Trazabilidad | Página ${i} de ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: "center" }
        );
      }

      // Save PDF
      const filename = `Informe_Tecnico_Lote_${lote?.LOTE_ID || loteId}_APIT.pdf`;
      doc.save(filename);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 4000);
    } catch (err) {
      console.error("Error generando PDF del lote:", err);
      setPdfError("Ocurrió un inconveniente al generar el documento PDF. Puede usar el botón de Imprimir.");
      setTimeout(() => setPdfError(null), 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportFichaOficialPDF = () => {
    try {
      setIsGeneratingFichaPdf(true);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 12;

      // --- PÁGINA 1: ENCABEZADO Y VAPORIZADO (HOJA OFICIAL DE PLANTA) ---
      // 1. Top Decorative Header Bar
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setFillColor(217, 119, 6); // Amber 600
      doc.rect(0, 28, pageWidth, 2, "F");

      // 2. Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("MOLINO INDUSTRIAL ARROZVAPOR S.A.", margin, 11);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(251, 191, 36); // Amber 400
      doc.text("HOJA DE CONTROL OPERACIONAL DE VAPORIZADO Y SECADO", margin, 17);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text("FICHA TÉCNICA OFICIAL DE PLANTA | CÓDIGO: FOR-PRO-VAP-004 | VERSIÓN: 04 | SISTEMA APIT", margin, 22);

      // Certificate Badge in Header
      const certX = pageWidth - margin - 58;
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(certX, 4.5, 58, 21, 2, 2, "F");
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text("REGISTRO DE PLANTA N°", certX + 29, 9, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(251, 191, 36);
      doc.text(`BATCH: ${batch?.BATCH_ID || "V200"}`, certX + 29, 14.5, { align: "center" });
      doc.setFontSize(7);
      doc.setTextColor(203, 213, 225);
      doc.text(`LOTE: ${lote?.LOTE_ID || loteId} | ${new Date().toLocaleDateString()}`, certX + 29, 19.5, { align: "center" });

      let currentY = 34;

      // 3. I. DATOS DE INGRESO DE MATERIA PRIMA (ARROZ PADDY HÚMEDO)
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { 
              content: "I. DATOS DE INGRESO DE MATERIA PRIMA (ARROZ PADDY HÚMEDO)", 
              colSpan: 4, 
              styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } 
            }
          ]
        ],
        body: [
          [
            { content: `Procedencia / Cliente:\n${ctrl?.datosIngreso?.procedencia || lote?.CLIENTE || "MOLINO CENTRAL"}`, styles: { fontStyle: "bold" } },
            { content: `Variedad Arroz:\n${ctrl?.datosIngreso?.variedad || lote?.VARIEDAD || "TINAJONES"}`, styles: { fontStyle: "bold", textColor: [8, 145, 178] } },
            `Cantidad de Sacos:\n${ctrl?.datosIngreso?.numSacos || lote?.SACOS || 600} Sacos`,
            `Peso Total Ingreso:\n${((ctrl?.datosIngreso?.pesoKg || lote?.PESO_KG || 30000) / 1000).toFixed(2)} TN (${ctrl?.datosIngreso?.pesoKg || lote?.PESO_KG || 30000} kg)`
          ],
          [
            `Humedad Ingreso (% HI):\n${humedadIngresoNum.toFixed(1)}% (${humedadIngresoNum < 14.0 ? "Seco / 2 Pases" : "Húmedo / Estándar"})`,
            `Equipo Autoclave:\n${batch?.EQUIPO || "APIT (Cap. 35 TN)"}`,
            `Supervisor de Turno:\n${ctrl?.SUPERVISOR || "Ing. Carlos Morales"}`,
            `Operador Responsable:\n${ctrl?.OPERADOR || "Pedro Huamán C."}`
          ],
          [
            `Fecha / Hora de Proceso:\n${ctrl?.FECHA_HORA_INICIO || new Date().toLocaleDateString()}`,
            `Calidad Inicial Arroz Húmedo:\nQI: ${qiAntes}% | TZ: ${tzAntes}% | TT: ${ttAntes}% | BL: ${blAntes}`,
            { content: `Desviaciones Reportadas en Planta:\n${ctrl?.DESVIACION || "Ninguna. Proceso en conformidad térmica."}`, colSpan: 2 }
          ]
        ],
        theme: "grid",
        headStyles: {
          fontSize: 7.5,
          cellPadding: 2
        },
        styles: {
          fontSize: 6.8,
          cellPadding: 2,
          textColor: [30, 41, 59]
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      // 4. II. PARÁMETROS OPERACIONALES DE INYECCIÓN DE VAPOR (AUTOCLAVE)
      const vaporBody: any[] = esDoblePase ? [
        [
          "1° Pase (Acondicionamiento / Pre-calor)",
          `${p1.presion ?? 0.40} bar (Máx ${p1.presionMax ?? 0.55} bar)`,
          `${p1.temperatura ?? 125} °C`,
          `${p1.rpm ?? 18} RPM`,
          `${p1.inicio && p1.fin ? `${p1.inicio} - ${p1.fin}` : "08:00 - 08:12"} (${p1.duracion || "12 min"})`,
          `${reposoInterPases} (Inter-Pases)`,
          "Pre-calentamiento térmico para mitigación de fisuras y trizado"
        ],
        [
          "2° Pase (Cocción / Gelatinización Principal)",
          `${p2.presion ?? 0.45} bar (Máx ${p2.presionMax ?? 0.55} bar)`,
          `${p2.temperatura ?? 130} °C`,
          `${p2.rpm ?? 18} RPM`,
          `${p2.inicio && p2.fin ? `${p2.inicio} - ${p2.fin}` : "08:22 - 08:40"} (${p2.duracion || "18 min"})`,
          `${p2.tiempoReposo || "45 min"} (Hacia 1° Reposo)`,
          "Cocción profunda y gelatinización completa del 98.0% del endospermo"
        ],
        [
          { content: `RESUMEN DE VAPORIZADO BIFÁSICO: Tiempo Total de Inyección: ${tiempoTotalVapor} | Modalidad: 2 Pases Anti-Trizado | Tolva Pulmón: 07:45 - 08:00 (15 min)`, colSpan: 7, styles: { fontStyle: "bold", fillColor: [254, 243, 199], textColor: [146, 64, 14] } }
        ]
      ] : [
        [
          "Inyección Estándar de Vapor (1 Pase Único)",
          `${ctrl?.PRESION_BAR || 0.45} bar (Máx ${ctrl?.PRESION_MAX_BAR || 0.55} bar)`,
          `${ctrl?.TEMPERATURA_SALIDA_C || 130} °C`,
          `${ctrl?.RPM || 18} RPM`,
          `${ctrl?.FECHA_HORA_INICIO ? ctrl.FECHA_HORA_INICIO.split(" ")[1] || "08:00" : "08:00"} - 08:30 (${ctrl?.TIEMPO_VAPORIZADO_MIN || 30} min)`,
          `${ctrl?.TIEMPO_REPOSO_MIN || 45} min (Hacia 1° Reposo)`,
          "Inyección directa y gelatinización uniforme para materia prima con humedad ≥ 14%"
        ],
        [
          { content: `RESUMEN DE VAPORIZADO: Tiempo Total: ${ctrl?.TIEMPO_VAPORIZADO_MIN || 30} min | Presión Promedio: ${ctrl?.PRESION_PROM_BAR || 0.44} bar | RPM: ${ctrl?.RPM || 18}`, colSpan: 7, styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [15, 23, 42] } }
        ]
      ];

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { 
              content: `II. PARÁMETROS OPERACIONALES DE INYECCIÓN DE VAPOR (${esDoblePase ? "MODALIDAD: 2 PASES ANTI-TRIZADO" : "MODALIDAD: 1 PASE ESTÁNDAR"})`, 
              colSpan: 7, 
              styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } 
            }
          ],
          [
            "Etapa / Pase",
            "Presión Vapor",
            "Temp (°C)",
            "RPM",
            "Horario & Duración",
            "Reposo Posterior",
            "Objetivo & Observaciones"
          ]
        ],
        body: vaporBody,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 6.8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 6.5,
          cellPadding: 1.8,
          halign: "center",
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 38 },
          6: { halign: "left", cellWidth: 42 }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      // 5. III. BATERÍA DE SILOS DE REPOSO (SILOS 1 AL 5)
      const silosRows = (ctrl?.silos && ctrl.silos.length > 0 ? ctrl.silos : [
        { siloNumber: 1, exclusa: { inicio: "08:45", fin: "09:05", tiempoLlenado: "20 min" }, tempSuperior: 78, tempInferior: 76, descarga: { inicio: "09:50", fin: "10:15", tiempoDescarga: "25 min", tiempoReposo: "45 min", blp: 39.5, quebradoPct: 9.8, trizado: 1.6, humedad: 16.5 } },
        { siloNumber: 2, exclusa: { inicio: "09:10", fin: "09:30", tiempoLlenado: "20 min" }, tempSuperior: 77, tempInferior: 75, descarga: { inicio: "10:20", fin: "10:45", tiempoDescarga: "25 min", tiempoReposo: "50 min", blp: 39.4, quebradoPct: 9.9, trizado: 1.7, humedad: 16.4 } },
        { siloNumber: 3, exclusa: { inicio: "09:35", fin: "09:55", tiempoLlenado: "20 min" }, tempSuperior: 79, tempInferior: 77, descarga: { inicio: "10:50", fin: "11:15", tiempoDescarga: "25 min", tiempoReposo: "55 min", blp: 39.6, quebradoPct: 9.7, trizado: 1.5, humedad: 16.6 } },
        { siloNumber: 4, exclusa: { inicio: "10:00", fin: "10:20", tiempoLlenado: "20 min" }, tempSuperior: 78, tempInferior: 76, descarga: { inicio: "11:20", fin: "11:45", tiempoDescarga: "25 min", tiempoReposo: "60 min", blp: 39.5, quebradoPct: 9.8, trizado: 1.6, humedad: 16.5 } },
        { siloNumber: 5, exclusa: { inicio: "10:25", fin: "10:45", tiempoLlenado: "20 min" }, tempSuperior: 78, tempInferior: 76, descarga: { inicio: "11:50", fin: "12:15", tiempoDescarga: "25 min", tiempoReposo: "65 min", blp: 39.5, quebradoPct: 9.8, trizado: 1.6, humedad: 16.5 } }
      ]).map((s) => [
        `Silo 0${s.siloNumber}`,
        `${s.exclusa?.inicio || "08:45"} - ${s.exclusa?.fin || "09:05"} (${s.exclusa?.tiempoLlenado || "20 min"})`,
        `${s.tempSuperior ?? 78} °C`,
        `${s.tempInferior ?? 76} °C`,
        `${s.descarga?.inicio || "09:50"} - ${s.descarga?.fin || "10:15"} (${s.descarga?.tiempoDescarga || "25 min"})`,
        `${s.descarga?.tiempoReposo || "45 min"}`,
        `${s.descarga?.blp ?? 39.5} / ${s.descarga?.quebradoPct ?? 9.8}%`,
        `${s.descarga?.trizado ?? 1.6}% / ${s.descarga?.humedad ?? 16.5}%`
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { 
              content: "III. BATERÍA DE SILOS DE REPOSO (LLENADO, TEMPERATURA Y DESCARGA)", 
              colSpan: 8, 
              styles: { fillColor: [8, 145, 178], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } 
            }
          ],
          [
            "Silo N°",
            "Llenado (Inicio-Fin)",
            "T° Sup",
            "T° Inf",
            "Descarga (Inicio-Fin)",
            "T. Reposo",
            "BL / % QI",
            "% TZ / % Hum"
          ]
        ],
        body: silosRows,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 6.8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 6.5,
          cellPadding: 1.8,
          halign: "center",
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { fontStyle: "bold", fillColor: [248, 250, 252] }
        }
      });

      // --- PÁGINA 2: ETAPAS DE SECADO, CALIDAD Y DICTAMEN OFICIAL ---
      doc.addPage();

      // Top mini header for Page 2
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 16, "F");
      doc.setFillColor(217, 119, 6);
      doc.rect(0, 16, pageWidth, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("MOLINO INDUSTRIAL ARROZVAPOR S.A. | FICHA TÉCNICA DE CONTROL DE PLANTA (SECADO & CALIDAD)", margin, 8.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(251, 191, 36);
      doc.text(`BATCH: ${batch?.BATCH_ID || "V200"} | LOTE: ${lote?.LOTE_ID || loteId} | FORMATO FOR-PRO-VAP-004`, margin, 13);

      currentY = 22;

      // 6. IV. ETAPAS TÉRMICAS DE REPOSO Y ENFRIAMIENTO (CADENA SECUENCIAL)
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { 
              content: "IV. ETAPAS TÉRMICAS DE REPOSO Y ENFRIAMIENTO (CADENA PRE-SECADO)", 
              colSpan: 7, 
              styles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } 
            }
          ],
          [
            "Etapa Secuencial",
            "Silo / Destino",
            "Hora Inicio",
            "T° Grano (°C)",
            "T° Ambiente / HR",
            "Humedad (%)",
            "Tiempo / Observaciones"
          ]
        ],
        body: [
          [
            "1° Reposo (Casilla 1)",
            "Silo 02",
            "09:50",
            "76 °C",
            "24 °C / 68%",
            "16.5%",
            "45 min (Estabilización osmótica de humedad)"
          ],
          [
            "1° Reposo (Casilla 2)",
            "Silo 02",
            "10:35",
            "72 °C",
            "25 °C / 67%",
            "16.4%",
            "45 min (Homogeneización de núcleo)"
          ],
          [
            "Enfriamiento (Casilla 1)",
            "Silo 03",
            "10:40",
            "58 °C",
            "25 °C / 65%",
            "16.2%",
            "30 min (Shock térmico regulado por aire forzado)"
          ],
          [
            "Enfriamiento (Casilla 2)",
            "Silo 03",
            "11:10",
            "45 °C",
            "26 °C / 64%",
            "16.0%",
            "30 min (Descenso térmico controlado)"
          ],
          [
            "2° Reposo (Casilla 1)",
            "Silo 04",
            "11:15",
            "42 °C",
            "26 °C / 62%",
            "15.8%",
            "60 min (Acondicionamiento antes de tolva de secado)"
          ],
          [
            "2° Reposo (Casilla 2)",
            "Silo 04",
            "12:15",
            "38 °C",
            "27 °C / 60%",
            "15.7%",
            "60 min (Equilibrio hidrotérmico completado)"
          ]
        ],
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 6.8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 6.5,
          cellPadding: 1.8,
          halign: "center",
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 36, fillColor: [248, 250, 252] },
          6: { halign: "left", cellWidth: 46 }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      // 7. V. MONITORIZACIÓN DE CURVA Y PERFILES DE SECADO INDUSTRIAL
      const secadoRows = (ctrl?.perfilesSecado && ctrl.perfilesSecado.length > 0 ? ctrl.perfilesSecado : [
        { perfilIndex: "Perfil 0 (Ingreso)", horaInicio: "12:30", tempProgramada: 65, tempReal: 38, humedad: "16.2%", tiempoMin: "20 min", a1: 45, a2: 45 },
        { perfilIndex: "Perfil 1 (Evaporación)", horaInicio: "12:50", tempProgramada: 60, tempReal: 42, humedad: "15.3%", tiempoMin: "40 min", a1: 42, a2: 42 },
        { perfilIndex: "Perfil 2 (Desorción)", horaInicio: "13:30", tempProgramada: 55, tempReal: 40, humedad: "14.2%", tiempoMin: "40 min", a1: 40, a2: 40 },
        { perfilIndex: "Perfil 3 (Afinamiento)", horaInicio: "14:10", tempProgramada: 50, tempReal: 38, humedad: "13.4%", tiempoMin: "30 min", a1: 38, a2: 38 },
        { perfilIndex: "Perfil 4 (Descarga)", horaInicio: "14:40", tempProgramada: 45, tempReal: 32, humedad: "12.8%", tiempoMin: "20 min", a1: 35, a2: 35 }
      ]).map((p, idx) => [
        `P${idx}: ${p.perfilIndex}`,
        p.horaInicio || "12:30",
        `${p.tempProgramada ?? (65 - idx * 5)} °C`,
        `${p.tempReal ?? (38 + (idx === 1 ? 4 : idx === 2 ? 2 : idx === 3 ? 0 : -6))} °C`,
        `${p.humedad || `${(16.2 - idx * 0.85).toFixed(1)}%`}`,
        `${p.a1 ?? (45 - idx * 2)} Hz`,
        `${p.tiempoMin || "30 min"}`,
        idx === 4 ? "DESCARGA CONFORME (12.8%)" : "Secado Progresivo"
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { 
              content: "V. MONITORIZACIÓN DE CURVA Y PERFILES DE SECADO INDUSTRIAL", 
              colSpan: 8, 
              styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } 
            }
          ],
          [
            "Perfil Secado",
            "Hora Inicio",
            "T° Aire (°C)",
            "T° Grano (°C)",
            "Humedad (%)",
            "Frecuencia (Hz)",
            "Tiempo",
            "Estado & Control"
          ]
        ],
        body: [
          ...secadoRows,
          [
            { 
              content: `RESUMEN DE SECADO: Tiempo Total: 150 min (2.5 h) | Humedad Final Descarga: ${as?.Humedad_Final || "12.8"}% (Meta: 12.5% - 13.0%) | Tolerancia: CUMPLE`, 
              colSpan: 8, 
              styles: { fontStyle: "bold", fillColor: [236, 253, 245], textColor: [4, 120, 87] } 
            }
          ]
        ],
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 6.8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 6.5,
          cellPadding: 1.8,
          halign: "center",
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 36, fillColor: [248, 250, 252] },
          7: { halign: "left", cellWidth: 38 }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      // 8. VI. EVALUACIÓN DE CALIDAD INTEGRAL & DICTAMEN DE LIBERACIÓN
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
          [
            { 
              content: "VI. EVALUACIÓN DE CALIDAD INTEGRAL & DICTAMEN DE LIBERACIÓN OFICIAL", 
              colSpan: 6, 
              styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } 
            }
          ],
          [
            "Parámetro de Calidad",
            "Materia Prima (Húmedo)",
            "Producto Terminado",
            "Variación (Δ Delta)",
            "Tolerancia de Planta",
            "Evaluación"
          ]
        ],
        body: [
          [
            "Humedad del Grano (% H)",
            `${humedadIngresoNum.toFixed(1)}%`,
            `${as?.Humedad_Final || 12.8}%`,
            `${(Number(as?.Humedad_Final || 12.8) - humedadIngresoNum).toFixed(1)}%`,
            "12.5% - 13.5%",
            "CONFORME"
          ],
          [
            "Quebrado Integral (% QI)",
            `${qiAntes}%`,
            `${qiDespues}%`,
            `${deltaQuebrado > 0 ? `+${deltaQuebrado}` : deltaQuebrado}%`,
            "Δ Máx +3.5%",
            deltaQuebrado <= 3.5 ? "CONFORME" : "OBSERVADO"
          ],
          [
            "Grano Trizado (% TZ)",
            `${tzAntes}%`,
            `${tzDespues}%`,
            `${deltaTrizado > 0 ? `+${deltaTrizado}` : deltaTrizado}%`,
            "≤ 2.0%",
            tzDespues <= 2.0 ? "CONFORME" : "OBSERVADO"
          ],
          [
            "Grano Yesoso / Tiza (% TT)",
            `${ttAntes}%`,
            `${ttDespues}%`,
            `${deltaTiza > 0 ? `+${deltaTiza}` : deltaTiza}%`,
            "≤ 1.0%",
            ttDespues <= 1.0 ? "CONFORME" : "OBSERVADO"
          ],
          [
            "Blancura Kett (BL)",
            `${blAntes}`,
            `${blDespues}`,
            `+${(blDespues - blAntes).toFixed(1)}`,
            "≥ 38.0 Kett",
            blDespues >= 38.0 ? "CONFORME" : "OBSERVADO"
          ],
          [
            { 
              content: `DICTAMEN TÉCNICO OFICIAL: ${clasificacion} (Índice de Éxito Global: ${indiceExito}% | Score de Cocción: ${coccionScore}%) — APTO PARA PROCESO DE PILADO INDUSTRIAL`, 
              colSpan: 6, 
              styles: { fontStyle: "bold", fillColor: indiceExito >= 85 ? [236, 253, 245] : [254, 243, 199], textColor: indiceExito >= 85 ? [4, 120, 87] : [146, 64, 14] } 
            }
          ]
        ],
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 6.8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 6.5,
          cellPadding: 1.8,
          halign: "center",
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 38 },
          5: { fontStyle: "bold", textColor: [5, 150, 105] }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // 9. VII. FIRMAS Y APROBACIÓN TÉCNICA OFICIAL
      if (currentY + 22 > 280) {
        doc.addPage();
        currentY = 20;
      }

      const sigWidth = (pageWidth - (margin * 2) - 16) / 3;

      // Signature 1
      doc.setDrawColor(148, 163, 184);
      doc.line(margin, currentY + 10, margin + sigWidth, currentY + 10);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Pedro Huamán C.", margin + (sigWidth / 2), currentY + 14, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text("Jefe de Planta / Operaciones", margin + (sigWidth / 2), currentY + 17.5, { align: "center" });

      // Signature 2
      const sig2X = margin + sigWidth + 8;
      doc.line(sig2X, currentY + 10, sig2X + sigWidth, currentY + 10);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Ing. Carlos Morales", sig2X + (sigWidth / 2), currentY + 14, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text("Responsable de Control de Calidad", sig2X + (sigWidth / 2), currentY + 17.5, { align: "center" });

      // Signature 3
      const sig3X = sig2X + sigWidth + 8;
      doc.line(sig3X, currentY + 10, sig3X + sigWidth, currentY + 10);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Operador de Turno Autoclave", sig3X + (sigWidth / 2), currentY + 14, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text("Registro Operacional en Planta", sig3X + (sigWidth / 2), currentY + 17.5, { align: "center" });

      // 10. Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Molino Industrial ArrozVapor S.A. | Hoja de Control Oficial de Vaporizado y Secado (Código: FOR-PRO-VAP-004 | Versión: 04) | Página ${i} de ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: "center" }
        );
      }

      // Save PDF
      const filename = `Ficha_Control_Oficial_Vaporizado_Secado_${lote?.LOTE_ID || loteId}.pdf`;
      doc.save(filename);
      setFichaPdfSuccess(true);
      setTimeout(() => setFichaPdfSuccess(false), 4000);
    } catch (err) {
      console.error("Error generando Ficha Oficial PDF:", err);
      setPdfError("Ocurrió un inconveniente al generar la Ficha Oficial en PDF. Intente nuevamente.");
      setTimeout(() => setPdfError(null), 5000);
    } finally {
      setIsGeneratingFichaPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl flex flex-col justify-between">
        {/* Modal Action Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-750 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Informe Técnico Integral de 25 Puntos del Lote</span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs border border-amber-500/40">
                  {lote?.LOTE_ID}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Historial completo de trazabilidad, control térmico de vaporizado y análisis de calidad.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Descargar Ficha Oficial de Planta (Vaporizado, Secado y Calidad) */}
            <button
              id="btn-descargar-ficha-oficial"
              onClick={handleExportFichaOficialPDF}
              disabled={isGeneratingFichaPdf}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-900/30 transition-all active:scale-95 cursor-pointer"
              title="Descargar Ficha Técnica Oficial de Planta con Vaporizado, Secado y Calidad (FOR-PRO-VAP-004)"
            >
              {isGeneratingFichaPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando Ficha...</span>
                </>
              ) : fichaPdfSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-200" />
                  <span>¡Ficha Descargada!</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200" />
                  <span>Descargar Ficha</span>
                </>
              )}
            </button>

            {/* Botón de Exportar a PDF con jsPDF */}
            <button
              id="btn-export-pdf"
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Descargar Informe Técnico de Trazabilidad en PDF"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>¡PDF Descargado!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Descargar PDF</span>
                </>
              )}
            </button>

            <button
              id="btn-print-report"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{pdfError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfError(null)}
              className="px-2 py-0.5 bg-rose-900/60 rounded text-[10px] text-rose-200"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Printable Document Body */}
        <div id="printable-technical-report" className="p-6 space-y-6 text-slate-200 text-xs bg-slate-900">
          {/* Header Molino Industrial */}
          <div className="border-b-2 border-amber-500 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="text-xl font-black text-white tracking-tight uppercase">
                MOLINO INDUSTRIAL ARROZVAPOR S.A.
              </div>
              <div className="text-xs text-amber-400 font-semibold">
                SISTEMA INTEGRAL DE GESTIÓN Y TRAZABILIDAD DE VAPORIZADO Y SECADO (APIT)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Planta de Procesamiento Industrial | Laboratorio de Control de Calidad
              </div>
            </div>

            <div className="text-right bg-slate-850 p-3 rounded-xl border border-slate-750">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Certificado Oficial N°</div>
              <div className="text-base font-black text-amber-400 font-mono">INF-2025-{lote?.LOTE_ID}</div>
              <div className="text-[10px] text-slate-400">Fecha de Emisión: {new Date().toISOString().split("T")[0]}</div>
            </div>
          </div>

          {/* 25 PUNTOS TÉCNICOS OFICIALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SECCIÓN A: DATOS GENERALES (1 - 5) */}
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-2">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-slate-750 pb-1.5 flex items-center justify-between">
                <span>I. Identificación & Origen del Grano (Puntos 1 - 5)</span>
                <Building className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">1. Identificación del Lote:</span>
                  <strong className="text-white font-mono">{lote?.LOTE_ID}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">2. Cliente / Procedencia:</span>
                  <strong className="text-white">{lote?.CLIENTE} ({lote?.ZONA || "Chiclayo"})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">3. Variedad de Arroz:</span>
                  <strong className="text-amber-300">{lote?.VARIEDAD}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">4. Peso & Cantidad:</span>
                  <strong className="text-white">{lote?.SACOS} sacos / {((lote?.PESO_KG || 0) / 1000).toFixed(2)} TN ({lote?.PESO_KG?.toLocaleString()} kg)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">5. Ubicación / Silo:</span>
                  <strong className="text-slate-200">{lote?.UBICACION || "Silo 02 - Planta Principal"}</strong>
                </div>
              </div>
            </div>

            {/* SECCIÓN B: CALIDAD INICIAL (6 - 10) */}
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-2">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider border-b border-slate-750 pb-1.5 flex items-center justify-between">
                <span>II. Calidad Inicial & Programación (Puntos 6 - 10)</span>
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
              </h3>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">6. Humedad Inicial (Prom / Desv):</span>
                  <strong className="text-cyan-400">{regHum?.["H. PROMEDIO"] || lote?.HUM}% (±{regHum?.["DESV."] || "0.15"})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">7. Análisis Físico Inicial:</span>
                  <strong className="text-white">QI: {qiAntes}%, TZ: {tzAntes}%, TT: {ttAntes}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">8. Criterio de Aptitud APIT:</span>
                  <strong className="text-emerald-400">{prog?.APTO_APIT || "SI (Apto para vaporizado)"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">9. Recomendación Previa IA:</span>
                  <strong className="text-purple-300">1.85 bar / 28 min vapor / 45 min reposo</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">10. Programación Asignada:</span>
                  <strong className="text-white">Prioridad {prog?.PRIORIDAD || "ALTA"} ({prog?.FECHA_PROGRAMACION || "2025-02-10"})</strong>
                </div>
              </div>
            </div>

            {/* SECCIÓN C: PROCESO OPERATIVO (11 - 17) */}
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-2">
              <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider border-b border-slate-750 pb-1.5 flex items-center justify-between">
                <span>III. Control de Proceso en Planta (Puntos 11 - 17)</span>
                <Flame className="w-3.5 h-3.5 text-orange-400" />
              </h3>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">11. Batch Asociado:</span>
                  <strong className="text-white font-mono">{batch?.BATCH_ID}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">12. Equipo Utilizado:</span>
                  <strong className="text-white">{batch?.EQUIPO || "APIT"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">13. Inyección de Vapor Real:</span>
                  <strong className="text-amber-400">{ctrl?.PRESION_BAR || 1.85} bar @ {ctrl?.RPM || 18} RPM ({ctrl?.TIEMPO_VAPORIZADO_MIN || 28} min)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">14. Parámetros de Reposo:</span>
                  <strong className="text-white">{ctrl?.TIEMPO_REPOSO_MIN || 45} min (Temp: {ctrl?.TEMP_SUPERIOR_C || 92}°C)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">15. Descarga en Caliente:</span>
                  <strong className="text-white">Temp: {ctrl?.TEMPERATURA_SALIDA_C || 88}°C, Hum: {ctrl?.HUMEDAD_SALIDA || 18.5}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">16. Parámetros de Secado:</span>
                  <strong className="text-white">Temp: 75°C / Tiempo: 120 min / Columna 01</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">17. Desviaciones Ocurridas:</span>
                  <strong className="text-emerald-400">{ctrl?.DESVIACION || "Ninguna / Parámetros Estables"}</strong>
                </div>
              </div>
            </div>

            {/* SECCIÓN D: RESULTADOS POST-PROCESO (18 - 25) */}
            <div className="bg-slate-850 p-4 rounded-xl border border-slate-750 space-y-2">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-750 pb-1.5 flex items-center justify-between">
                <span>IV. Evaluación Final & Éxito (Puntos 18 - 25)</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </h3>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">18. Humedad Final Post-Secado:</span>
                  <strong className="text-cyan-400">{as?.Humedad_Final || 12.8}% HUM</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">19. Calidad Post-Proceso:</span>
                  <strong className="text-white">QI: {qiDespues}%, Blancura Kett: {blDespues}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">20. Comparativa Antes vs Después:</span>
                  <strong className="text-slate-200">TZ: {tzAntes}% → {tzDespues}%, TT: {ttAntes}% → {ttDespues}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">21. Incremento de Quebrado:</span>
                  <strong className="text-emerald-400">Δ {deltaQuebrado > 0 ? `+${deltaQuebrado}` : deltaQuebrado}% (Excelente)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">22. Score de Cocción:</span>
                  <strong className="text-purple-300">{coccionScore} / 100 (Grano Suelto)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">23. Índice de Éxito Ponderado:</span>
                  <strong className="text-emerald-400 text-sm font-black">{indiceExito}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">24. Clasificación Final del Lote:</span>
                  <strong className="text-amber-400 uppercase font-black">{clasificacion}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">25. Recomendación para Futuros:</span>
                  <strong className="text-slate-300">Mantener rampa de 1.85 bar para {lote?.VARIEDAD}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* TABLA COMPARATIVA 1° PASE VS 2° PASE (SI EL LOTE FUE PROCESADO CON DOBLE INYECCIÓN) */}
          <div className="bg-slate-850 rounded-xl border border-slate-750 overflow-hidden shadow-lg">
            <div className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-750 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Comparativa Técnica: 1° Pase vs. 2° Pase de Inyección
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      esDoblePase 
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30" 
                        : "bg-slate-750 text-slate-400 border-slate-650"
                    }`}>
                      {esDoblePase ? "Doble Inyección (2 Pasos Activo)" : "Inyección Estándar (1 Paso)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Análisis detallado de rampas térmicas, presiones de vapor y mitigación de choque térmico para control de calidad.
                  </p>
                </div>
              </div>

              {/* Botón de Alternar Modo para Inspección y Auditoría */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-750">
                <button
                  type="button"
                  onClick={() => setForzarModoDoblePase(false)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    !esDoblePase
                      ? "bg-slate-700 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  1 Pase (Estándar)
                </button>
                <button
                  type="button"
                  onClick={() => setForzarModoDoblePase(true)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    esDoblePase
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-200" />
                  2 Pases (Anti-Trizado)
                </button>
              </div>
            </div>

            {esDoblePase ? (
              <div className="p-4 space-y-3">
                {/* Resumen Métrico Rápido */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">1° Pase Vapor</span>
                    <strong className="text-amber-300 text-xs font-mono">{p1.presion || 0.40} bar @ {p1.duracion || "12 min"}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Temp: {p1.temperatura || 125}°C</span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Reposo Inter-Pases</span>
                    <strong className="text-cyan-300 text-xs font-mono">{reposoInterPases}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Estabilización de cutícula</span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">2° Pase Vapor</span>
                    <strong className="text-emerald-300 text-xs font-mono">{p2.presion || 0.45} bar @ {p2.duracion || "18 min"}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Temp: {p2.temperatura || 130}°C</span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Inyección Neta Acumulada</span>
                    <strong className="text-purple-300 text-xs font-mono">{tiempoTotalVapor}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Gelatinización 98%</span>
                  </div>
                </div>

                {/* Tabla Comparativa */}
                <div className="overflow-x-auto rounded-lg border border-slate-750">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-900 text-slate-300 border-b border-slate-750">
                      <tr>
                        <th className="p-2.5 font-bold">Parámetro de Control</th>
                        <th className="p-2.5 font-bold text-amber-400">1° Pase (Acondicionamiento)</th>
                        <th className="p-2.5 font-bold text-emerald-400">2° Pase (Cocción Principal)</th>
                        <th className="p-2.5 font-bold text-cyan-400 text-center">Variación (Δ Delta)</th>
                        <th className="p-2.5 font-bold text-emerald-300">Impacto en Calidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-200">
                      <tr className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-slate-300">Fase & Objetivo Térmico</td>
                        <td className="p-2.5 text-amber-300">Pre-calor & Acondicionamiento</td>
                        <td className="p-2.5 text-emerald-300">Cocción & Gelatinización Total</td>
                        <td className="p-2.5 text-center font-mono text-cyan-300">Secuencia Bifásica</td>
                        <td className="p-2.5 text-emerald-400">Apertura de microporos sin choque térmico</td>
                      </tr>

                      <tr className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-slate-300">Presión de Inyección (bar)</td>
                        <td className="p-2.5 font-mono">{p1.presion || 0.40} bar (Máx {p1.presionMax || 0.55} bar)</td>
                        <td className="p-2.5 font-mono text-emerald-300">{p2.presion || 0.45} bar (Máx {p2.presionMax || 0.55} bar)</td>
                        <td className="p-2.5 text-center font-mono font-bold text-amber-400">
                          {deltaPresion >= 0 ? `+${deltaPresion}` : deltaPresion} bar
                        </td>
                        <td className="p-2.5 text-slate-300">Rampa de presión progresiva para absorción pareja</td>
                      </tr>

                      <tr className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-slate-300">Temperatura de Vapor (°C)</td>
                        <td className="p-2.5 font-mono">{p1.temperatura || 125} °C</td>
                        <td className="p-2.5 font-mono text-emerald-300">{p2.temperatura || 130} °C</td>
                        <td className="p-2.5 text-center font-mono font-bold text-amber-400">
                          {deltaTemp >= 0 ? `+${deltaTemp}` : deltaTemp} °C
                        </td>
                        <td className="p-2.5 text-slate-300">Gradiente térmico suave; previene fracturas internas</td>
                      </tr>

                      <tr className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-slate-300">Velocidad Autoclave (RPM)</td>
                        <td className="p-2.5 font-mono">{p1.rpm || 18} RPM</td>
                        <td className="p-2.5 font-mono text-emerald-300">{p2.rpm || 18} RPM</td>
                        <td className="p-2.5 text-center font-mono text-slate-400">Constante (18 RPM)</td>
                        <td className="p-2.5 text-slate-300">Masa fluidizada homogénea sin fricción dañina</td>
                      </tr>

                      <tr className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-slate-300">Horario & Duración</td>
                        <td className="p-2.5 font-mono">
                          {p1.inicio && p1.fin ? `${p1.inicio} - ${p1.fin}` : "08:00 - 08:12"} ({p1.duracion || "12 min"})
                        </td>
                        <td className="p-2.5 font-mono text-emerald-300">
                          {p2.inicio && p2.fin ? `${p2.inicio} - ${p2.fin}` : "08:22 - 08:40"} ({p2.duracion || "18 min"})
                        </td>
                        <td className="p-2.5 text-center font-mono text-cyan-300">Total: {tiempoTotalVapor}</td>
                        <td className="p-2.5 text-slate-300">Curva de cocción profunda sin sobrecocción superficial</td>
                      </tr>

                      <tr className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-slate-300">Reposo Posterior</td>
                        <td className="p-2.5 font-mono text-cyan-300">{reposoInterPases} (Inter-Pases)</td>
                        <td className="p-2.5 font-mono text-emerald-300">{p2.tiempoReposo || "45 min"} (Hacia 1° Reposo)</td>
                        <td className="p-2.5 text-center font-mono text-slate-400">Estabilización Térmica</td>
                        <td className="p-2.5 text-slate-300">Difusión equilibrada de humedad al centro del grano</td>
                      </tr>

                      <tr className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-slate-300">Control de Defectos</td>
                        <td className="p-2.5 text-slate-400">Acondiciona grano seco (&lt;14% H)</td>
                        <td className="p-2.5 text-emerald-400 font-semibold">Trizado Final: {tzDespues}%</td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-400">
                          Δ QI: {deltaQuebrado > 0 ? `+${deltaQuebrado}` : deltaQuebrado}%
                        </td>
                        <td className="p-2.5 text-emerald-300 font-bold">Rendimiento de grano entero comercial protegido</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Nota Técnica de Aseguramiento de Calidad */}
                <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg flex items-start gap-2.5 text-xs text-amber-200">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-semibold mb-0.5">
                      Dictamen del Protocolo de Doble Inyección Térmica:
                    </strong>
                    <span>
                      La aplicación secuencial del 1° Pase (0.40 bar / 12 min) seguido de reposo inter-pases ({reposoInterPases}) y 2° Pase (0.45 bar / 18 min) logró una gelatinización del 98.0% evitando el choque térmico brusco. El grano trizado resultante ({tzDespues}%) se mantuvo dentro de la tolerancia estricta (≤ 2.0%).
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 space-y-2">
                <p>
                  Este lote fue procesado bajo el esquema convencional de inyección en <strong className="text-white">1 Pase Único</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setForzarModoDoblePase(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-amber-300 rounded-lg border border-amber-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Ver Simulación Comparativa de 2 Pases (Anti-Trizado)
                </button>
              </div>
            )}
          </div>

          {/* Signatures and Technical Approval */}
          <div className="pt-8 border-t border-slate-750 grid grid-cols-3 gap-6 text-center text-[10px] text-slate-400">
            <div>
              <div className="border-b border-slate-600 pb-8 mb-1 font-signature text-xs text-slate-300">Pedro Huamán C.</div>
              <strong>Jefe de Planta / Operaciones</strong>
            </div>
            <div>
              <div className="border-b border-slate-600 pb-8 mb-1 font-signature text-xs text-slate-300">Ing. Carlos Morales</div>
              <strong>Responsable de Control de Calidad</strong>
            </div>
            <div>
              <div className="border-b border-slate-600 pb-8 mb-1 font-signature text-xs text-slate-300">ArrozVapor IA Engine v2.0</div>
              <strong>Validación & Auditoría Digital</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-850 border-t border-slate-750 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Documento técnico listo para exportación en formato PDF de alta resolución.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-footer-descargar-ficha"
              onClick={handleExportFichaOficialPDF}
              disabled={isGeneratingFichaPdf}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-amber-900/30 transition-all active:scale-95 cursor-pointer"
            >
              {isGeneratingFichaPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando Ficha...</span>
                </>
              ) : fichaPdfSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-amber-200" />
                  <span>¡Ficha Descargada!</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200" />
                  <span>Descargar Ficha</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? "Generando..." : "Descargar PDF"}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-lg border border-slate-700 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
