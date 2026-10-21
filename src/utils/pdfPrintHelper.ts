import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

const colorConversionCache = new Map<string, string>();
let sharedColorCanvasCtx: CanvasRenderingContext2D | null = null;
let sharedVarResolverEl: HTMLDivElement | null = null;

function getColorCanvasCtx(): CanvasRenderingContext2D | null {
  if (!sharedColorCanvasCtx && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    sharedColorCanvasCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  return sharedColorCanvasCtx;
}

/**
/**
 * Conversor matemático de OKLCH a RGB/RGBA
 */
function parseOklchToRgb(str: string): string | null {
  const match = str.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([-\d.]+)(?:\s*(?:\/|\s)\s*([\d.]+%?))?\s*\)/i);
  if (!match) return null;
  const L = match[1].endsWith("%") ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  const C = parseFloat(match[2]);
  const H = parseFloat(match[3]) * (Math.PI / 180);
  const A = match[4] ? (match[4].endsWith("%") ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767434770 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(0, u), 1 / 2.4) - 0.055);
  const clamp = (val: number) => Math.min(255, Math.max(0, Math.round(val)));

  const r = clamp(gamma(rLin) * 255);
  const g = clamp(gamma(gLin) * 255);
  const b_ = clamp(gamma(bLin) * 255);

  return A < 1 ? `rgba(${r}, ${g}, ${b_}, ${Number(A.toFixed(3))})` : `rgb(${r}, ${g}, ${b_})`;
}

/**
 * Conversor matemático de OKLab a RGB/RGBA
 */
function parseOklabToRgb(str: string): string | null {
  const match = str.match(/oklab\(\s*([\d.]+%?)\s+([-\d.]+)\s+([-\d.]+)(?:\s*(?:\/|\s)\s*([\d.]+%?))?\s*\)/i);
  if (!match) return null;
  const L = match[1].endsWith("%") ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  const a = parseFloat(match[2]);
  const b = parseFloat(match[3]);
  const A = match[4] ? (match[4].endsWith("%") ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767434770 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(0, u), 1 / 2.4) - 0.055);
  const clamp = (val: number) => Math.min(255, Math.max(0, Math.round(val)));

  const r = clamp(gamma(rLin) * 255);
  const g = clamp(gamma(gLin) * 255);
  const b_ = clamp(gamma(bLin) * 255);

  return A < 1 ? `rgba(${r}, ${g}, ${b_}, ${Number(A.toFixed(3))})` : `rgb(${r}, ${g}, ${b_})`;
}

/**
 * Convierte cualquier función de color CSS moderna (oklch, oklab, color-mix, lab, lch, hwb, color)
 * a formato rgb() / rgba() compatible con el parser de html2canvas.
 */
function convertColorFnToRgb(
  fnCall: string,
  nativeGetComputedStyle: typeof window.getComputedStyle
): string {
  const trimmed = fnCall.trim();
  const cached = colorConversionCache.get(trimmed);
  if (cached) return cached;

  // 1. Detección matemática rápida para OKLCH y OKLab
  const oklchResult = parseOklchToRgb(trimmed);
  if (oklchResult) {
    colorConversionCache.set(trimmed, oklchResult);
    return oklchResult;
  }
  const oklabResult = parseOklabToRgb(trimmed);
  if (oklabResult) {
    colorConversionCache.set(trimmed, oklabResult);
    return oklabResult;
  }

  try {
    let resolvedStr = trimmed;
    if (resolvedStr.includes("var(") && typeof document !== "undefined" && document.body) {
      if (!sharedVarResolverEl) {
        sharedVarResolverEl = document.createElement("div");
        sharedVarResolverEl.style.position = "fixed";
        sharedVarResolverEl.style.left = "-9999px";
        sharedVarResolverEl.style.top = "-9999px";
        sharedVarResolverEl.style.pointerEvents = "none";
        sharedVarResolverEl.style.visibility = "hidden";
      }
      if (!sharedVarResolverEl.parentNode) {
        document.body.appendChild(sharedVarResolverEl);
      }
      sharedVarResolverEl.style.color = "rgb(0, 0, 0)";
      sharedVarResolverEl.style.color = resolvedStr;
      resolvedStr = nativeGetComputedStyle(sharedVarResolverEl).color || resolvedStr;

      // Volver a probar conversión matemática si la variable se resolvió a oklch
      const resolvedOklch = parseOklchToRgb(resolvedStr);
      if (resolvedOklch) {
        colorConversionCache.set(trimmed, resolvedOklch);
        return resolvedOklch;
      }
    }

    const ctx = getColorCanvasCtx();
    if (!ctx) return "rgb(15, 23, 42)";

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillStyle = resolvedStr;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = data[3];

    const rgbResult =
      a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : a === 0
        ? "rgba(0, 0, 0, 0)"
        : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;

    colorConversionCache.set(trimmed, rgbResult);
    return rgbResult;
  } catch {
    return "rgb(15, 23, 42)";
  }
}

/**
 * Reemplaza todas las ocurrencias de oklch(), oklab(), color-mix(), lab(), lch(), hwb(), color()
 * y elimina interpolaciones de espacio de color en gradientes ("in oklab", "in oklch") que html2canvas no soporta.
 */
export function sanitizeModernCssValue(
  input: string,
  nativeGetComputedStyle: typeof window.getComputedStyle = window.getComputedStyle.bind(window)
): string {
  if (
    !input ||
    typeof input !== "string" ||
    !/oklch|oklab|color-mix|lch\(|lab\(|hwb\(|color\(|in\s+(?:oklab|oklch|srgb|display-p3|hsl|hwb|lab|lch)/i.test(input)
  ) {
    return input;
  }

  // 1. Limpiar sintaxis de interpolación de gradientes CSS Color 4 (ej. "linear-gradient(in oklab, ...)" o "to right in oklab,")
  let cleaned = input
    .replace(
      /(\b(?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\(\s*)in\s+(?:oklab|oklch|srgb(?:-linear)?|display-p3|hsl|hwb|lab|lch)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\s*,\s*/gi,
      "$1"
    )
    .replace(
      /\bin\s+(?:oklab|oklch|srgb(?:-linear)?|display-p3|hsl|hwb|lab|lch)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\s+(?=to\b)/gi,
      ""
    )
    .replace(
      /\s+in\s+(?:oklab|oklch|srgb(?:-linear)?|display-p3|hsl|hwb|lab|lch)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?/gi,
      ""
    );

  // 2. Reemplazar funciones de color modernas respetando paréntesis anidados
  const fnRegex = /\b(?:color-mix|oklch|oklab|lch|lab|hwb|color)\s*\(/gi;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fnRegex.exec(cleaned)) !== null) {
    const startIdx = match.index;
    if (startIdx < lastIndex) continue;
    result += cleaned.slice(lastIndex, startIdx);

    const openParenIdx = startIdx + match[0].length - 1;
    let depth = 1;
    let i = openParenIdx + 1;
    while (i < cleaned.length && depth > 0) {
      const ch = cleaned[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }

    const fullFnCall = cleaned.slice(startIdx, i);
    result += convertColorFnToRgb(fullFnCall, nativeGetComputedStyle);
    lastIndex = i;
    fnRegex.lastIndex = i;
  }

  result += cleaned.slice(lastIndex);
  return result;
}

export function createSanitizedComputedStyleProxy(
  rawStyle: CSSStyleDeclaration,
  nativeGetComputedStyle: typeof window.getComputedStyle
): CSSStyleDeclaration {
  return new Proxy(rawStyle, {
    get(target, prop) {
      if (prop === "getPropertyValue") {
        return (propName: string) => {
          const val = target.getPropertyValue(propName);
          return typeof val === "string" ? sanitizeModernCssValue(val, nativeGetComputedStyle) : val;
        };
      }
      const val = Reflect.get(target, prop, target);
      if (typeof val === "function") {
        return val.bind(target);
      }
      if (typeof val === "string") {
        return sanitizeModernCssValue(val, nativeGetComputedStyle);
      }
      return val;
    }
  });
}

export interface CaptureCanvasOptions {
  scale?: number;
  backgroundColor?: string;
  width?: number;
  height?: number;
}

/**
 * Renderiza de forma segura un elemento DOM a un HTMLCanvasElement soportando
 * las funciones de color modernas de CSS como oklch(), oklab(), color-mix()
 * generadas por Tailwind CSS v4.
 */
export async function captureElementToCanvasSafe(
  element: HTMLElement,
  options?: CaptureCanvasOptions
): Promise<HTMLCanvasElement> {
  const bgColor = options?.backgroundColor || "#ffffff";
  const scale = options?.scale || 2;

  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  // Estrategia 1: html-to-image (soporte nativo de SVG/CSS, sin errores de parser oklch)
  try {
    const htmlToImage = await import("html-to-image");
    const toCanvasFn = (htmlToImage as any).toCanvas || htmlToImage;
    if (typeof toCanvasFn === "function") {
      const canvas = await toCanvasFn(element, {
        backgroundColor: bgColor,
        pixelRatio: scale,
        cacheBust: true,
        skipFonts: true,
        fontEmbedCSS: '',
      });
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return canvas;
      }
    }
  } catch (htmlToImageErr) {
    console.warn("Aviso: html-to-image falló, usando html2canvas con sanitización oklch:", htmlToImageErr);
  }

  // Estrategia 2: html2canvas con proxy para getComputedStyle y sanitización profunda de CSS
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((el: Element, pseudoElt?: string | null) => {
    const raw = nativeGetComputedStyle(el, pseudoElt);
    return createSanitizedComputedStyleProxy(raw, nativeGetComputedStyle);
  }) as typeof window.getComputedStyle;

  try {
    const html2canvasModule = await import("html2canvas");
    const html2canvas = (html2canvasModule as any).default || html2canvasModule;
    return await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: bgColor,
      scrollX: 0,
      scrollY: 0,
      windowWidth: options?.width || element.scrollWidth || undefined,
      windowHeight: options?.height || element.scrollHeight || undefined,
      onclone: (clonedDoc: Document) => {
        try {
          // Eliminar cualquier logo de documentos PDF
          const logosInClone = clonedDoc.querySelectorAll('[data-pdf-logo="true"], .molino-logo, .pdf-no-logo, img[alt*="logo" i], svg[aria-label*="logo" i], img[src*="logo" i]');
          logosInClone.forEach((l) => (l as HTMLElement).remove());

          const styleNodes = clonedDoc.querySelectorAll("style");
          styleNodes.forEach((styleEl) => {
            if (styleEl.textContent) {
              styleEl.textContent = sanitizeModernCssValue(styleEl.textContent, nativeGetComputedStyle);
            }
          });

          const allElements = clonedDoc.querySelectorAll("*");
          allElements.forEach((node) => {
            const htmlEl = node as HTMLElement;
            if (htmlEl.style) {
              const inlineStyle = htmlEl.getAttribute("style");
              if (inlineStyle) {
                const sanitized = sanitizeModernCssValue(inlineStyle, nativeGetComputedStyle);
                if (sanitized !== inlineStyle) {
                  htmlEl.setAttribute("style", sanitized);
                }
              }
            }
          });

          if (clonedDoc.defaultView) {
            const iframeNativeGetCS = clonedDoc.defaultView.getComputedStyle.bind(clonedDoc.defaultView);
            clonedDoc.defaultView.getComputedStyle = ((el: Element, pseudoElt?: string | null) => {
              const raw = iframeNativeGetCS(el, pseudoElt);
              return createSanitizedComputedStyleProxy(raw, nativeGetComputedStyle);
            }) as typeof window.getComputedStyle;
          }
        } catch (cloneErr) {
          console.warn("Aviso sanitizando clon en captureElementToCanvasSafe:", cloneErr);
        }
      }
    });
  } finally {
    window.getComputedStyle = nativeGetComputedStyle;
  }
}

/**
 * Descarga un elemento DOM como PDF (usando html2canvas + jsPDF) y además intenta disparar window.print()
 * preparando las clases de impresión para que funcione tanto dentro del iframe de AI Studio como en ventana completa.
 */
export async function printOrExportElementToPdf(
  element: HTMLElement | null,
  filename: string = "FICHA_OFICIAL_BATCH.pdf",
  options?: {
    orientation?: "portrait" | "landscape";
    title?: string;
    backgroundColor?: string;
  }
): Promise<boolean> {
  if (!element) {
    try {
      window.print();
    } catch (e) {
      console.warn("window.print blocked:", e);
    }
    return false;
  }

  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  const savedScrollX = window.scrollX;
  const savedScrollY = window.scrollY;
  let captureHost: HTMLDivElement | null = null;

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const bgColor = options?.backgroundColor || "#ffffff";
    const targetCaptureWidth = options?.orientation === "landscape" ? 1240 : 1060;

    // 1. Crear contenedor de captura a ancho completo de escritorio sin restricciones de modal ni scroll
    captureHost = document.createElement("div");
    captureHost.setAttribute("data-pdf-capture-host", "true");
    captureHost.style.position = "absolute";
    captureHost.style.left = "0px";
    captureHost.style.top = "0px";
    captureHost.style.width = `${targetCaptureWidth}px`;
    captureHost.style.height = "auto";
    captureHost.style.maxHeight = "none";
    captureHost.style.overflow = "visible";
    captureHost.style.backgroundColor = bgColor;
    captureHost.style.zIndex = "-9999";
    captureHost.style.pointerEvents = "none";

    const clonedTarget = element.cloneNode(true) as HTMLElement;
    clonedTarget.style.width = `${targetCaptureWidth}px`;
    clonedTarget.style.maxWidth = "none";
    clonedTarget.style.height = "auto";
    clonedTarget.style.maxHeight = "none";
    clonedTarget.style.overflow = "visible";
    clonedTarget.style.flex = "none";
    clonedTarget.style.margin = "0";
    clonedTarget.style.backgroundColor = bgColor;

    // Quitar logos de cualquier documento PDF exportado
    const logoNodes = clonedTarget.querySelectorAll('[data-pdf-logo="true"], .molino-logo, .pdf-no-logo, img[alt*="logo" i], svg[aria-label*="logo" i], img[src*="logo" i]');
    logoNodes.forEach((node) => {
      node.remove();
    });

    // 2. Preparar todos los nodos del clon ANTES de medir y capturar con html2canvas
    const allClonedNodes = clonedTarget.querySelectorAll("*");
    allClonedNodes.forEach((node) => {
      const htmlEl = node as HTMLElement;
      if (!htmlEl.style) return;

      if (
        htmlEl.getAttribute("data-pdf-logo") === "true" ||
        htmlEl.classList.contains("molino-logo") ||
        htmlEl.classList.contains("pdf-no-logo")
      ) {
        htmlEl.remove();
        return;
      }

      if (htmlEl.classList) {
        if (htmlEl.classList.contains("print:hidden")) {
          htmlEl.remove();
          return;
        }
        if (htmlEl.classList.contains("truncate")) {
          htmlEl.classList.remove("truncate");
          htmlEl.style.whiteSpace = "normal";
          htmlEl.style.overflow = "visible";
          htmlEl.style.textOverflow = "clip";
          htmlEl.style.wordBreak = "break-word";
        }
        if (
          htmlEl.classList.contains("overflow-hidden") ||
          htmlEl.classList.contains("overflow-x-auto") ||
          htmlEl.classList.contains("overflow-y-auto")
        ) {
          htmlEl.style.overflow = "visible";
          htmlEl.style.maxHeight = "none";
        }
      }

      // Evitar bug de html2canvas con letter-spacing != 0 que mide carácter por carácter y pierde/solapa letras
      htmlEl.style.letterSpacing = "0px";

      // Si un <td> o <th> tiene display:flex directo, envolver su contenido para no romper la celda en html2canvas
      if (
        (htmlEl.tagName === "TD" || htmlEl.tagName === "TH") &&
        htmlEl.classList &&
        htmlEl.classList.contains("flex")
      ) {
        const innerFlex = document.createElement("div");
        innerFlex.style.display = "flex";
        innerFlex.style.alignItems = "center";
        innerFlex.style.justifyContent = "space-between";
        innerFlex.style.width = "100%";
        while (htmlEl.firstChild) {
          innerFlex.appendChild(htmlEl.firstChild);
        }
        htmlEl.classList.remove("flex", "items-center", "justify-between");
        htmlEl.appendChild(innerFlex);
      }

      const inlineStyle = htmlEl.getAttribute("style");
      if (inlineStyle) {
        const sanitizedInline = sanitizeModernCssValue(inlineStyle, nativeGetComputedStyle);
        if (sanitizedInline !== inlineStyle) {
          htmlEl.setAttribute("style", sanitizedInline);
        }
      }
    });

    captureHost.appendChild(clonedTarget);
    document.body.appendChild(captureHost);
    window.scrollTo(0, 0);

    // 3. Medir coordenadas exactas de secciones y bloques en el DOM ya expandido para saltos de página limpios
    const hostRect = clonedTarget.getBoundingClientRect();
    const totalCssWidth = Math.ceil(hostRect.width) || targetCaptureWidth;
    const totalCssHeight = Math.ceil(hostRect.height) || element.scrollHeight;

    // Nivel 1: Espacios en blanco entre las secciones principales de la ficha
    const sectionNodes = Array.from(
      clonedTarget.querySelectorAll(":scope > [data-pdf-section], :scope > div")
    ) as HTMLElement[];
    const sectionGapCutsCss: number[] = [];
    for (let i = 0; i < sectionNodes.length - 1; i++) {
      const rectA = sectionNodes[i].getBoundingClientRect();
      const rectB = sectionNodes[i + 1].getBoundingClientRect();
      const bottomA = rectA.bottom - hostRect.top;
      const topB = rectB.top - hostRect.top;
      if (topB >= bottomA - 2) {
        sectionGapCutsCss.push((bottomA + topB) / 2);
      }
    }

    // Nivel 2: Bloques atómicos (filas de tabla, tarjetas de grilla, subtítulos) que no deben partirse a la mitad
    const atomicNodes = Array.from(
      clonedTarget.querySelectorAll(
        "[data-pdf-block], tr, thead, .grid > div, h1, h2, h3, h4, p"
      )
    ) as HTMLElement[];
    const atomicSpansCss: Array<{ top: number; bottom: number }> = [];
    atomicNodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      const top = r.top - hostRect.top;
      const bottom = r.bottom - hostRect.top;
      // Solo registrar bloques de altura razonable (< 260px) para evitar bloquear secciones enteras
      if (bottom > top && bottom - top < 260) {
        atomicSpansCss.push({ top: top + 1, bottom: bottom - 1 });
      }
    });

    // 4. Interceptar temporalmente window.getComputedStyle para que html2canvas nunca reciba oklch/oklab/color-mix
    window.getComputedStyle = ((el: Element, pseudoElt?: string | null) => {
      const raw = nativeGetComputedStyle(el, pseudoElt);
      return createSanitizedComputedStyleProxy(raw, nativeGetComputedStyle);
    }) as typeof window.getComputedStyle;

    const canvas = await html2canvas(clonedTarget, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: bgColor,
      width: totalCssWidth,
      height: totalCssHeight,
      windowWidth: totalCssWidth,
      windowHeight: totalCssHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        try {
          const styleNodes = clonedDoc.querySelectorAll("style");
          styleNodes.forEach((styleEl) => {
            if (styleEl.textContent) {
              styleEl.textContent = sanitizeModernCssValue(styleEl.textContent, nativeGetComputedStyle);
            }
          });

          if (clonedDoc.defaultView) {
            const iframeNativeGetCS = clonedDoc.defaultView.getComputedStyle.bind(clonedDoc.defaultView);
            clonedDoc.defaultView.getComputedStyle = ((el: Element, pseudoElt?: string | null) => {
              const raw = iframeNativeGetCS(el, pseudoElt);
              return createSanitizedComputedStyleProxy(raw, nativeGetComputedStyle);
            }) as typeof window.getComputedStyle;
          }
        } catch (cloneErr) {
          console.warn("Aviso sanitizando estilos en clon de html2canvas:", cloneErr);
        }
      }
    });

    window.getComputedStyle = nativeGetComputedStyle;
    if (captureHost && captureHost.parentNode) {
      captureHost.parentNode.removeChild(captureHost);
      captureHost = null;
    }
    window.scrollTo(savedScrollX, savedScrollY);

    const orientation =
      options?.orientation || (canvas.width > canvas.height * 1.15 ? "landscape" : "portrait");

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 7;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= usableHeight) {
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight, undefined, "FAST");
    } else if (imgHeight <= usableHeight * 1.16) {
      // Si supera por muy poco 1 hoja A4, ajustar proporcionalmente en una sola página sin recortar nada
      const imgData = canvas.toDataURL("image/png");
      const scaledHeight = usableHeight;
      const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
      const xOffset = margin + Math.max(0, (usableWidth - scaledWidth) / 2);
      pdf.addImage(imgData, "PNG", xOffset, margin, scaledWidth, scaledHeight, undefined, "FAST");
    } else {
      // Paginación inteligente guiada por las secciones y bloques del DOM + derivada vertical de píxeles
      const pxPerMm = canvas.width / usableWidth;
      const maxPageHeightPx = Math.floor(usableHeight * pxPerMm);
      const scaleFactor = canvas.height / totalCssHeight;
      const ctx = canvas.getContext("2d");

      let currentYPx = 0;
      let pageIndex = 0;

      while (currentYPx < canvas.height - 4) {
        const remainingPx = canvas.height - currentYPx;
        let sliceHeightPx = Math.min(maxPageHeightPx, remainingPx);

        // Si lo que queda cabe casi por completo en esta página, incluirlo entero
        if (remainingPx <= maxPageHeightPx * 1.05) {
          sliceHeightPx = remainingPx;
        } else {
          const targetCutPx = currentYPx + sliceHeightPx;
          const minAllowedCutPx = currentYPx + Math.floor(maxPageHeightPx * 0.52);
          let chosenCutPx: number | null = null;

          // Prioridad 1: Cortar exactamente en el espacio en blanco entre dos secciones principales
          const validSectionCuts = sectionGapCutsCss
            .map((cssY) => Math.round(cssY * scaleFactor))
            .filter((pxY) => pxY >= minAllowedCutPx && pxY <= targetCutPx);

          if (validSectionCuts.length > 0) {
            chosenCutPx = Math.max(...validSectionCuts);
          }

          // Prioridad 2: Buscar una coordenada Y que no atraviese ningún bloque atómico (fila de tabla, tarjeta, texto)
          if (chosenCutPx === null) {
            const subSearchMinPx = currentYPx + Math.floor(maxPageHeightPx * 0.65);
            for (let candPx = targetCutPx; candPx >= subSearchMinPx; candPx -= 2) {
              const candCss = candPx / scaleFactor;
              const hitsAtomic = atomicSpansCss.some(
                (span) => candCss > span.top && candCss < span.bottom
              );
              if (!hitsAtomic) {
                chosenCutPx = candPx;
                break;
              }
            }
          }

          // Prioridad 3: Refinar con derivada vertical de píxeles (ignora bordes verticales y fondos continuos)
          if (ctx) {
            const baseCutPx = chosenCutPx ?? targetCutPx;
            const refineRadius = chosenCutPx !== null ? 14 : Math.min(160, Math.floor(maxPageHeightPx * 0.22));
            const searchTop = Math.max(currentYPx + 100, baseCutPx - refineRadius);
            const searchBottom = Math.min(targetCutPx, baseCutPx + (chosenCutPx !== null ? 10 : 0));

            let bestRowY = baseCutPx;
            let minVerticalDiff = Number.POSITIVE_INFINITY;

            for (let y = searchBottom; y >= searchTop; y -= 2) {
              const rowPair = ctx.getImageData(0, y - 1, canvas.width, 2).data;
              const stride = canvas.width * 4;
              let verticalDiffCount = 0;

              // Comparar fila y con fila y-1: los bordes verticales tienen diferencia 0; las letras tienen diferencia alta
              for (let x = 24; x < stride - 24; x += 12) {
                const dr = Math.abs(rowPair[x] - rowPair[x + stride]);
                const dg = Math.abs(rowPair[x + 1] - rowPair[x + 1 + stride]);
                const db = Math.abs(rowPair[x + 2] - rowPair[x + 2 + stride]);
                if (dr + dg + db > 18) {
                  verticalDiffCount++;
                }
              }

              if (verticalDiffCount === 0) {
                bestRowY = y;
                break;
              }
              if (verticalDiffCount < minVerticalDiff) {
                minVerticalDiff = verticalDiffCount;
                bestRowY = y;
              }
            }

            chosenCutPx = bestRowY;
          }

          if (chosenCutPx !== null && chosenCutPx > currentYPx + 80) {
            sliceHeightPx = chosenCutPx - currentYPx;
          }
        }

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const pageCtx = pageCanvas.getContext("2d");
        if (pageCtx) {
          pageCtx.fillStyle = bgColor;
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0,
            currentYPx,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
          );
        }

        if (pageIndex > 0) {
          pdf.addPage();
        }
        const sliceMmHeight = sliceHeightPx / pxPerMm;
        const sliceImgData = pageCanvas.toDataURL("image/png");
        pdf.addImage(sliceImgData, "PNG", margin, margin, usableWidth, sliceMmHeight, undefined, "FAST");

        currentYPx += sliceHeightPx;
        pageIndex++;
      }
    }

    const cleanFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);

    // También intentar abrir el diálogo nativo de impresión con CSS aislado por si el navegador lo permite
    triggerCleanBrowserPrint(element);
    return true;
  } catch (err) {
    window.getComputedStyle = nativeGetComputedStyle;
    if (captureHost && captureHost.parentNode) {
      captureHost.parentNode.removeChild(captureHost);
    }
    window.scrollTo(savedScrollX, savedScrollY);
    if (sharedVarResolverEl && sharedVarResolverEl.parentNode) {
      sharedVarResolverEl.parentNode.removeChild(sharedVarResolverEl);
    }
    console.error("Error exportando elemento a PDF:", err);
    triggerCleanBrowserPrint(element);
    return false;
  } finally {
    window.getComputedStyle = nativeGetComputedStyle;
    if (captureHost && captureHost.parentNode) {
      captureHost.parentNode.removeChild(captureHost);
    }
    if (sharedVarResolverEl && sharedVarResolverEl.parentNode) {
      sharedVarResolverEl.parentNode.removeChild(sharedVarResolverEl);
    }
  }
}

/**
 * Activa una clase temporal en body y el contenedor objetivo para que @media print
 * muestre únicamente la ficha solicitada sin recortes de modales o contenedores overflow.
 */
export function triggerCleanBrowserPrint(targetElement?: HTMLElement | null) {
  try {
    if (targetElement) {
      document.body.classList.add("printing-isolated-sheet");
      targetElement.classList.add("print-isolated-target");

      // Marcar ancestros directos para que no se oculten ni recorten el contenido
      let parent = targetElement.parentElement;
      const markedAncestors: HTMLElement[] = [];
      while (parent && parent !== document.body) {
        parent.classList.add("print-isolated-ancestor");
        markedAncestors.push(parent);
        parent = parent.parentElement;
      }

      const cleanup = () => {
        document.body.classList.remove("printing-isolated-sheet");
        targetElement.classList.remove("print-isolated-target");
        markedAncestors.forEach((a) => a.classList.remove("print-isolated-ancestor"));
        window.removeEventListener("afterprint", cleanup);
      };

      window.addEventListener("afterprint", cleanup);
      setTimeout(() => {
        try {
          window.print();
        } catch (e) {
          console.warn("Native print suppressed in iframe:", e);
        } finally {
          setTimeout(cleanup, 1200);
        }
      }, 100);
    } else {
      window.print();
    }
  } catch (e) {
    console.warn("triggerCleanBrowserPrint error:", e);
  }
}

/**
 * Genera el PDF Vectorial Oficial de Alta Precisión para la Hoja de Control de Vaporizado de un Batch
 * (Formato Oficial de Planta - Horizontal A4)
 */
export function generateHojaControlVaporizadoPDF(params: {
  batchCode: string;
  fecha: string;
  supervisor: string;
  operario: string;
  cliente: string;
  desviacion: string;
  datosIngreso: any;
  datosVaporizado: any;
  parametrosPaddy?: any;
  silos?: any[];
  silosPase2?: any[];
  etapaReposo1?: any;
  etapaEnfriamiento?: any;
  etapaReposo2?: any;
  perfilesSecado?: any;
  recetaSecado?: any;
  etapaEnfriamientoFinal?: any;
  tieneParadasMecanicas?: boolean;
  paradasMecanicas?: any[];
  tiempoTotalPerdidoMecanicoMin?: number;
  observaciones?: string;
  elementForPrint?: HTMLElement | null;
}) {
  const {
    batchCode,
    fecha,
    supervisor,
    operario,
    cliente,
    desviacion,
    datosIngreso,
    datosVaporizado,
    parametrosPaddy,
    silos,
    etapaReposo1,
    etapaEnfriamiento,
    etapaReposo2,
    perfilesSecado,
    recetaSecado,
    etapaEnfriamientoFinal,
    tieneParadasMecanicas,
    paradasMecanicas,
    tiempoTotalPerdidoMecanicoMin,
    observaciones,
    elementForPrint
  } = params;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const margin = 8;

  // 1. ENCABEZADO OFICIAL VERDE PLANTA
  doc.setFillColor(54, 100, 39); // #366427
  doc.rect(margin, 6, pageWidth - margin * 2, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("MOLINO DON JULIO S.A.C. — REGISTRO OFICIAL DE CONTROL DE PROCESO DE VAPORIZADO Y SECADO", pageWidth / 2, 11.5, { align: "center" });

  // 2. METADATOS GENERALES DEL BATCH
  autoTable(doc, {
    startY: 15.5,
    margin: { left: margin, right: margin },
    body: [
      [
        { content: "FECHA:", styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [30, 41, 59] } },
        { content: fecha || new Date().toISOString().substring(0, 10), styles: { fontStyle: "bold" } },
        { content: "N° BATCH:", styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [30, 41, 59] } },
        { content: batchCode || "S/C", styles: { fontStyle: "bold", textColor: [6, 95, 70], fontSize: 9.5 } },
        { content: "SUPERVISOR:", styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [30, 41, 59] } },
        { content: (supervisor || "ING. CALIDAD PLANTA").toUpperCase(), styles: { fontStyle: "bold" } },
        { content: "OPERARIO:", styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [30, 41, 59] } },
        { content: (operario || "OPERADOR DE PLANTA").toUpperCase(), styles: { fontStyle: "bold" } }
      ],
      [
        { content: "CLIENTE:", styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [30, 41, 59] } },
        { content: (cliente || "MOLINO DON JULIO S.A.C.").toUpperCase(), colSpan: 3, styles: { fontStyle: "bold" } },
        { content: "DESVIACIÓN:", styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [30, 41, 59] } },
        { content: desviacion || "Sin novedades / Parámetros conformes", colSpan: 3 }
      ]
    ],
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.2 }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 3;

  // 3. SECCIÓN MEDIA: IZQUIERDA (DATOS DE INGRESO + PARÁMETROS PADDY) | DERECHA (VAPORIZADO + 5 SILOS)
  const leftColWidth = 92;
  const rightColStart = margin + leftColWidth + 4;
  const rightColWidth = pageWidth - rightColStart - margin;

  const pesoTn = (((datosIngreso.pesoTotalKg || datosIngreso.pesoKg || 18000)) / 1000).toFixed(1);

  // 3A. Tabla Datos de Ingreso (Izquierda Superior)
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: pageWidth - margin - leftColWidth },
    tableWidth: leftColWidth,
    head: [
      [{ content: "1. DATOS DE INGRESO DE LOTE / BATCH", colSpan: 4, styles: { fillColor: [54, 100, 39], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } }]
    ],
    body: [
      [
        { content: "PROCEDENCIA", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: datosIngreso.procedencia || "-", colSpan: 3 }
      ],
      [
        { content: "CÓDIGO", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: datosIngreso.codigo || batchCode, styles: { fontStyle: "bold" } },
        { content: "PESO TOTAL", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: `${pesoTn} TN`, styles: { fontStyle: "bold", textColor: [6, 95, 70] } }
      ],
      [
        { content: "N° SACOS", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: String(datosIngreso.numSacos || "-") },
        { content: "PESO (KG)", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: `${(datosIngreso.pesoKg || 18000).toLocaleString()} kg`, styles: { fontStyle: "bold" } }
      ],
      [
        { content: "VARIEDAD", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: datosIngreso.variedad || "-", styles: { fontStyle: "bold", textColor: [8, 145, 178] } },
        { content: "% HUMEDAD", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: `${datosIngreso.humedadPct ?? "-"}%`, styles: { fontStyle: "bold" } }
      ],
      [
        { content: "TIEMPO REPOSO", styles: { fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: datosIngreso.tiempoReposo || "Estándar en cáscara", colSpan: 3, styles: { fontStyle: "bold", fillColor: [255, 251, 235] } }
      ]
    ],
    theme: "grid",
    styles: { fontSize: 6.8, cellPadding: 1.1, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
  });

  const afterIngresoY = (doc as any).lastAutoTable.finalY + 2;

  // 3B. Tabla Parámetros del Paddy (Izquierda Inferior)
  autoTable(doc, {
    startY: afterIngresoY,
    margin: { left: margin, right: pageWidth - margin - leftColWidth },
    tableWidth: leftColWidth,
    head: [
      [{ content: "2. PARÁMETROS DEL PADDY (LABORATORIO)", colSpan: 6, styles: { fillColor: [54, 100, 39], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } }],
      [
        { content: "DATOS", rowSpan: 2, styles: { valign: "middle", halign: "center", fillColor: [226, 232, 240], textColor: [15, 23, 42] } },
        { content: "VAPORIZADO", colSpan: 2, styles: { halign: "center", fillColor: [226, 232, 240], textColor: [15, 23, 42] } },
        { content: "SECADORA", colSpan: 2, styles: { halign: "center", fillColor: [226, 232, 240], textColor: [15, 23, 42] } },
        { content: "VAR.", rowSpan: 2, styles: { valign: "middle", halign: "center", fillColor: [226, 232, 240], textColor: [15, 23, 42] } }
      ],
      [
        { content: "ING.", styles: { halign: "center", fillColor: [236, 253, 245], textColor: [6, 95, 70] } },
        { content: "SAL.", styles: { halign: "center", fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
        { content: "REP.", styles: { halign: "center", fillColor: [241, 245, 249], textColor: [15, 23, 42] } },
        { content: "SAL.", styles: { halign: "center", fillColor: [254, 243, 199], textColor: [146, 64, 14] } }
      ]
    ],
    body: (parametrosPaddy || []).map((row) => [
      { content: row.label || row.parametro, styles: { fontStyle: "bold", fillColor: [248, 250, 252] } },
      { content: row.ingresoVaporizado !== undefined && row.ingresoVaporizado !== "" ? String(row.ingresoVaporizado) : "-", styles: { halign: "center", fontStyle: "bold" } },
      { content: row.salidaVaporizado !== undefined && row.salidaVaporizado !== "" ? String(row.salidaVaporizado) : "-", styles: { halign: "center" } },
      { content: row.reposoSecadora !== undefined && row.reposoSecadora !== "" ? String(row.reposoSecadora) : "-", styles: { halign: "center" } },
      { content: row.salidaSecadora !== undefined && row.salidaSecadora !== "" ? String(row.salidaSecadora) : "-", styles: { halign: "center", fontStyle: "bold" } },
      {
        content: row.variacion !== undefined && row.variacion !== "" ? (Number(row.variacion) > 0 ? `+${row.variacion}` : String(row.variacion)) : "-",
        styles: { halign: "center", fontStyle: "bold" }
      }
    ]),
    theme: "grid",
    styles: { fontSize: 6.3, cellPadding: 0.85, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
  });

  const leftBottomY = (doc as any).lastAutoTable.finalY;

  // 3C. Tabla Datos de Vaporizado (Derecha Superior)
  const isDoblePase = datosVaporizado?.modalidadPases === "2_PASES";
  const tolva = datosVaporizado?.llenadoTolvaPulmon || {};
  const iny1 = isDoblePase ? datosVaporizado?.inyeccionVaporPase1 : datosVaporizado?.inyeccionVapor;
  const iny2 = datosVaporizado?.inyeccionVaporPase2;

  const vapBody: any[] = [
    [
      { content: "MODALIDAD:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
      { content: isDoblePase ? "2 PASES (LOTE SECO - ANTI-TRIZADO)" : "1 SOLO PASE DIRECTO (ESTÁNDAR)", colSpan: 2, styles: { fontStyle: "bold", textColor: isDoblePase ? [180, 83, 9] : [6, 95, 70] } },
      { content: "TOLVA PULMÓN:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
      { content: `Inicio: ${tolva.inicio || "--:--"} | Fin: ${tolva.fin || "--:--"} (${tolva.duracion || "--"})`, colSpan: 2 }
    ]
  ];

  const calcDur = (inicio?: string, fin?: string): string => {
    if (!inicio || !fin) return "";
    try {
      const parts1 = inicio.trim().split(":");
      const parts2 = fin.trim().split(":");
      if (parts1.length < 2 || parts2.length < 2) return "";
      const h1 = parseInt(parts1[0], 10), m1 = parseInt(parts1[1], 10);
      const h2 = parseInt(parts2[0], 10), m2 = parseInt(parts2[1], 10);
      if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "";
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m} min`;
    } catch {
      return "";
    }
  };

  if (!isDoblePase) {
    const durIny = calcDur(iny1?.inicio, iny1?.fin) || iny1?.duracion;
    vapBody.push([
      { content: "INYECCIÓN VAPOR:", styles: { fontStyle: "bold", fillColor: [236, 253, 245] } },
      { content: `Ini: ${iny1?.inicio || "--:--"}\nFin: ${iny1?.fin || "--:--"}${durIny ? `\nDur: ${durIny}` : ""}`, styles: { fontStyle: "bold" } },
      { content: `Presión: ${iny1?.presion ?? datosVaporizado?.presionVapor ?? 0.35} bar`, styles: { fontStyle: "bold" } },
      { content: `V.Excl: ${iny1?.velExclusa ?? "4"}` },
      { content: `Reposo: ${iny1?.tiempoReposo ?? "45 min"}` },
      { content: `Obs: ${iny1?.obs || "Inyección estándar"}` }
    ]);
  } else {
    const durPase1 = calcDur(iny1?.inicio, iny1?.fin) || iny1?.duracion;
    const durPase2 = calcDur(iny2?.inicio, iny2?.fin) || iny2?.duracion;
    vapBody.push(
      [
        { content: "1° PASE (PRE-CALOR):", styles: { fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: `Ini: ${iny1?.inicio || "--:--"}\nFin: ${iny1?.fin || "--:--"}${durPase1 ? `\nDur: ${durPase1}` : ""}`, styles: { fontStyle: "bold" } },
        { content: `Presión: ${iny1?.presion ?? 0.35} bar`, styles: { fontStyle: "bold" } },
        { content: `V.Excl: ${iny1?.vExcl ?? "4"}` },
        { content: `Reposo: ${iny1?.tiempoReposo ?? "10 min"}` },
        { content: `${iny1?.obs || "Pre-calentamiento"}` }
      ],
      [
        { content: "2° PASE (COCCIÓN):", styles: { fontStyle: "bold", fillColor: [236, 253, 245] } },
        { content: `Ini: ${iny2?.inicio || "--:--"}\nFin: ${iny2?.fin || "--:--"}${durPase2 ? `\nDur: ${durPase2}` : ""}`, styles: { fontStyle: "bold" } },
        { content: `Presión: ${iny2?.presion ?? 0.40} bar`, styles: { fontStyle: "bold" } },
        { content: `V.Excl: ${iny2?.vExcl ?? "4"}` },
        { content: `Reposo: ${iny2?.tiempoReposo ?? "45 min"}` },
        { content: `${iny2?.obs || "Gelatinización uniforme"}` }
      ]
    );
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: rightColStart, right: margin },
    tableWidth: rightColWidth,
    head: [
      [{ content: "3. DATOS DE VAPORIZADO EN AUTOCLAVE", colSpan: 6, styles: { fillColor: [54, 100, 39], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } }]
    ],
    body: vapBody,
    theme: "grid",
    styles: { fontSize: 6.6, cellPadding: 1.1, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
  });

  const afterVapY = (doc as any).lastAutoTable.finalY + 2;

  // 3D. Batería de 5 Silos (Derecha Inferior)
  const silosList = (silos || []).slice(0, 5);
  autoTable(doc, {
    startY: afterVapY,
    margin: { left: rightColStart, right: margin },
    tableWidth: rightColWidth,
    head: [
      [{ content: "4. BATERÍA DE ENFRIAMIENTO Y REPOSO (SILOS 1 AL 5)", colSpan: 6, styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } }],
      [
        { content: "PARÁMETRO / FASE", styles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" } },
        ...silosList.map((s: any, i: number) => ({
          content: `SILO ${s.siloNumber || i + 1}`,
          styles: { halign: "center" as const, fillColor: [226, 232, 240] as [number, number, number], textColor: [15, 23, 42] as [number, number, number], fontStyle: "bold" as const }
        }))
      ]
    ],
    body: [
      [
        { content: "Llenado (Inicio - Fin)", styles: { fontStyle: "bold", fillColor: [254, 243, 199] } },
        ...silosList.map((s: any) => ({ content: `${s.exclusa?.inicio || "--:--"} a ${s.exclusa?.fin || "--:--"}`, styles: { halign: "center" as const } }))
      ],
      [
        { content: "Presión / Exclusa N°", styles: { fontStyle: "bold", fillColor: [255, 251, 235] } },
        ...silosList.map((s: any) => ({ content: `${s.exclusa?.presion ?? "-"} bar | Excl: ${s.exclusa?.exclusa || "-"}`, styles: { halign: "center" as const } }))
      ],
      [
        { content: "Temp. Sup. / Temp. Inf.", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        ...silosList.map((s: any) => ({ content: `Sup: ${s.tempSuperior ?? "-"}°C | Inf: ${s.tempInferior ?? "-"}°C`, styles: { halign: "center" as const, fontStyle: "bold" as const } }))
      ],
      [
        { content: "Descarga (Inicio - Fin)", styles: { fontStyle: "bold", fillColor: [219, 234, 254] } },
        ...silosList.map((s: any) => ({ content: `${s.descarga?.inicio || "--:--"} a ${s.descarga?.fin || "--:--"}`, styles: { halign: "center" as const } }))
      ],
      [
        { content: "T. Reposo / T. Descarga", styles: { fontStyle: "bold", fillColor: [239, 246, 255] } },
        ...silosList.map((s: any) => ({ content: `Rep: ${s.descarga?.tiempoReposo || s.descarga?.reposo || "-"} | Desc: ${s.descarga?.tiempoDescarga || "-"}`, styles: { halign: "center" as const } }))
      ],
      [
        { content: "Calidad (%Q / %Triz / BL)", styles: { fontStyle: "bold", fillColor: [254, 249, 195] } },
        ...silosList.map((s: any) => ({
          content: `Q:${s.descarga?.quebradoPct ?? "-"}% | Tz:${s.descarga?.trizado ?? "-"}% | BL:${s.descarga?.blp ?? s.descarga?.blIntegral ?? "-"}°`,
          styles: { halign: "center" as const }
        }))
      ],
      [
        { content: "Rendimientos (RI% / RB%)", styles: { fontStyle: "bold", fillColor: [236, 253, 245] } },
        ...silosList.map((s: any) => ({
          content: `RI:${s.descarga?.rendimientoIntegral ?? s.descarga?.ri ?? "-"}% | RB:${s.descarga?.rendimientoBlanco ?? s.descarga?.rb ?? "-"}%`,
          styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: [6, 95, 70] as [number, number, number] }
        }))
      ],
      [
        { content: "Humedad Descarga (%)", styles: { fontStyle: "bold", fillColor: [254, 226, 226] } },
        ...silosList.map((s: any) => ({
          content: s.descarga?.humedad !== undefined ? `${s.descarga.humedad}%` : "-",
          styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: [153, 27, 27] as [number, number, number] }
        }))
      ]
    ],
    theme: "grid",
    styles: { fontSize: 6.4, cellPadding: 1.0, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
  });

  const rightBottomY = (doc as any).lastAutoTable.finalY;
  currentY = Math.max(leftBottomY, rightBottomY) + 3;

  // 4A. REGISTRO DE PARADAS POR FALLAS MECÁNICAS (SI EXISTEN)
  const paradasList = Array.isArray(paradasMecanicas) ? paradasMecanicas.filter(p => p && (p.horaInicio || p.horaFin || p.motivoFalla)) : [];
  if ((tieneParadasMecanicas || paradasList.length > 0) && paradasList.length > 0) {
    if (currentY > 155) {
      doc.addPage();
      currentY = 10;
    }

    const totalMinPerdidos = tiempoTotalPerdidoMecanicoMin ?? paradasList.reduce((acc, p) => acc + (Number(p.tiempoPerdidoMin) || 0), 0);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [
          {
            content: `REGISTRO DE PARADAS POR FALLAS MECÁNICAS DURANTE EL VAPORIZADO — TOTAL TIEMPO PERDIDO: ${totalMinPerdidos} MIN (${(totalMinPerdidos / 60).toFixed(1)} HRS)`,
            colSpan: 7,
            styles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
          }
        ],
        ["N°", "EQUIPO / ETAPA AFECTADA", "MOTIVO / DESCRIPCIÓN DE FALLA MECÁNICA", "H. INICIO", "H. FIN", "TIEMPO PERDIDO", "ACCIÓN CORRECTIVA / RESPONSABLE"]
      ],
      body: paradasList.map((p, idx) => [
        { content: `#${idx + 1}`, styles: { fontStyle: "bold", halign: "center" } },
        { content: p.etapaAfectada || p.equipoComponente || "Autoclave / Vaporizado", styles: { fontStyle: "bold" } },
        { content: p.motivoFalla || "Sin detalle" },
        { content: p.horaInicio || "--:--", styles: { halign: "center", fontStyle: "bold" } },
        { content: p.horaFin || "--:--", styles: { halign: "center", fontStyle: "bold" } },
        { content: p.tiempoPerdidoMin ? `${p.tiempoPerdidoMin} min` : (p.duracionTexto || "--"), styles: { halign: "center", fontStyle: "bold", fillColor: [254, 226, 226], textColor: [153, 27, 27] } },
        { content: p.accionCorrectiva || p.responsableMantenimiento || "-" }
      ]),
      theme: "grid",
      headStyles: { fillColor: [254, 226, 226], textColor: [127, 29, 29], fontSize: 6.5, halign: "center" },
      styles: { fontSize: 6.3, cellPadding: 1.0, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 3;
  }

  // Si falta espacio en la primera hoja, agregar segunda hoja o ajustar
  if (currentY > 135) {
    doc.addPage();
    currentY = 10;
  }

  // 4. ETAPAS DE ENFRIAMIENTO Y REPOSO + PERFILES DE SECADO (P0 A P12)
  const stagesRows: any[] = [];
  (etapaReposo1 || []).forEach((r: any, i: number) => {
    if (r.horaInicio || r.horaFin || r.tempGrano || r.humedad || i === 0) {
      const dur = calcDur(r.horaInicio, r.horaFin) || r.duracion || (r.tiempoMin !== undefined ? `${r.tiempoMin} min` : "-");
      stagesRows.push(["1° Reposo", r.fecha || fecha, `R1-${i + 1}`, r.horaInicio || "--:--", r.horaFin || "--:--", dur, r.tempGrano ?? "-", r.tempAmbiente ?? "-", r.humedadRelativa ?? "-", r.humedad ?? "-", r.tempProgramada ?? "-"]);
    }
  });
  (etapaEnfriamiento || []).forEach((r: any, i: number) => {
    if (r.horaInicio || r.horaFin || r.tempGrano || r.humedad || i === 0) {
      const dur = calcDur(r.horaInicio, r.horaFin) || r.duracion || (r.tiempoMin !== undefined ? `${r.tiempoMin} min` : "-");
      stagesRows.push(["Enfriamiento", r.fecha || fecha, `ENF-${i + 1}`, r.horaInicio || "--:--", r.horaFin || "--:--", dur, r.tempGrano ?? "-", r.tempAmbiente ?? "-", r.humedadRelativa ?? "-", r.humedad ?? "-", r.tempProgramada ?? "-"]);
    }
  });
  (etapaReposo2 || []).forEach((r: any, i: number) => {
    if (r.horaInicio || r.horaFin || r.tempGrano || r.humedad || i === 0) {
      const dur = calcDur(r.horaInicio, r.horaFin) || r.duracion || (r.tiempoMin !== undefined ? `${r.tiempoMin} min` : "-");
      stagesRows.push(["2° Reposo", r.fecha || fecha, `R2-${i + 1}`, r.horaInicio || "--:--", r.horaFin || "--:--", dur, r.tempGrano ?? "-", r.tempAmbiente ?? "-", r.humedadRelativa ?? "-", r.humedad ?? "-", r.tempProgramada ?? "-"]);
    }
  });

  if (stagesRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [{ content: "5. ETAPAS PREVIAS A SECADO: 1° REPOSO, ENFRIAMIENTO Y 2° REPOSO", colSpan: 11, styles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" } }],
        ["ETAPA", "FECHA", "FASE", "H. INICIO", "H. FINAL", "DURACIÓN", "T° GRANO", "T° AMB.", "H.R (%)", "HUMEDAD", "T° PROG."]
      ],
      body: stagesRows,
      theme: "grid",
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontSize: 6.5, halign: "center" },
      styles: { fontSize: 6.3, cellPadding: 0.9, halign: "center", textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 3;
  }

  // 5. TABLA DE PERFILES DE SECADO P0 AL P12 + RECETA
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [{ content: `6. REGISTRO DE CONTROL DE PROCESO DE VAPORIZADO — ETAPA DE SECADO (${(perfilesSecado || []).filter((p: any) => p.tipoRegistro !== "REPOSO").length} PERFILES)`, colSpan: 21, styles: { fillColor: [122, 24, 24], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } }],
      [
        "FECHA", "PERFIL", "H. INICIO", "T° GRANO", "T° TERM", "T° LASER", "T° AMB", "H.R%", "H1", "H2", "H3", "H4", "HUMEDAD", "GRAD.", "TIEMPO", "T° PROG", "Q%", "%TRIZ", "BL°", "RECETA MIN", "RECETA T°"
      ]
    ],
    body: (perfilesSecado || []).map((p: any, idx: number) => {
      if (p.tipoRegistro === "REPOSO") {
        const dur = p.duracion || (p.horaInicio && p.horaFin ? calcDur(p.horaInicio, p.horaFin) : "-");
        const grano = p.tempGrano !== undefined ? `${p.tempGrano}°C` : "-";
        const term = p.tempTermocupla !== undefined ? `${p.tempTermocupla}°C` : "-";
        const las = p.tempLaser !== undefined ? `${p.tempLaser}°C` : "-";
        const hum = p.humedad ? `${p.humedad}%` : "-";
        return [
          p.fecha || fecha,
          { content: "⏸️ REPOSO", styles: { fontStyle: "bold", fillColor: [254, 243, 199], textColor: [180, 83, 9] } },
          p.horaInicio || "--:--",
          { content: `Fin: ${p.horaFin || "--:--"} | Duración: ${dur} | T°Grano:${grano} (Term:${term}, Las:${las}) | H:${hum} | MOTIVO CALIDAD: ${p.motivoReposo || "Equilibrado de grano por calidad"}`, colSpan: 18, styles: { halign: "left", fontStyle: "italic", fillColor: [254, 252, 232], textColor: [120, 53, 15] } }
        ];
      }

      const rec = (recetaSecado || [])[idx] || {};
      const tomas = [p.h1, p.h2, p.h3, p.h4].filter((v: any) => v !== undefined && v !== null && !isNaN(Number(v)) && Number(v) > 0).map(Number);
      const avgHum = tomas.length > 0 ? (tomas.reduce((a, b) => a + b, 0) / tomas.length).toFixed(1) : (p.humedad || "-");
      const gradTomas = tomas.length >= 2 ? (Math.max(...tomas) - Math.min(...tomas)).toFixed(1) : undefined;
      const prevHum = idx > 0 ? (perfilesSecado[idx - 1]?.humedad ? Number(perfilesSecado[idx - 1].humedad) : undefined) : undefined;
      const currHumNum = !isNaN(Number(avgHum)) ? Number(avgHum) : undefined;
      const gradPerfil = (currHumNum !== undefined && prevHum !== undefined) ? (prevHum - currHumNum).toFixed(1) : undefined;
      const isPerfilCero = idx === 0 || p.perfilIndex === 0 || p.perfilIndex === "0" || p.perfilIndex === "P0";
      const displayGrad = gradTomas !== undefined 
        ? `${gradTomas}%` 
        : (isPerfilCero ? "--" : (gradPerfil !== undefined ? `${gradPerfil}%` : (p.gradiente !== undefined ? `${p.gradiente}%` : "--")));

      return [
        p.fecha || fecha,
        { content: p.perfilIndex !== undefined ? (typeof p.perfilIndex === "number" ? `P${p.perfilIndex}` : String(p.perfilIndex)) : `P${idx}`, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        p.horaInicio || "--:--",
        { content: p.tempGrano !== undefined ? `${p.tempGrano}°` : "-", styles: { fontStyle: "bold", textColor: [6, 95, 70] } },
        { content: p.tempTermocupla !== undefined ? `${p.tempTermocupla}°` : "-", styles: { fontStyle: "bold", textColor: [6, 95, 70] } },
        { content: p.tempLaser !== undefined ? `${p.tempLaser}°` : "-", styles: { fontStyle: "bold", textColor: [6, 95, 70] } },
        p.tempAmbiente ?? "-",
        p.humedadRelativa ?? "-",
        p.h1 !== undefined ? p.h1 : "-",
        p.h2 !== undefined ? p.h2 : "-",
        p.h3 !== undefined ? p.h3 : "-",
        p.h4 !== undefined ? p.h4 : "-",
        { content: avgHum !== undefined ? `${avgHum}%` : "-", styles: { fontStyle: "bold", fillColor: [254, 243, 199] } },
        { content: displayGrad, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        p.tiempoMin ?? "-",
        p.tempProgramada ?? "-",
        p.materiaPrima?.qPct ?? "-",
        p.materiaPrima?.trizPct ?? "-",
        p.materiaPrima?.blGrad ?? "-",
        { content: rec.tiempo ? `${rec.tiempo}m` : "-", styles: { fillColor: [236, 253, 245], fontStyle: "bold" } },
        { content: rec.temp ? `${rec.temp}°C` : "-", styles: { fillColor: [254, 242, 242], fontStyle: "bold", textColor: [153, 27, 27] } }
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontSize: 5.5, halign: "center" },
    styles: { fontSize: 5.3, cellPadding: 0.6, halign: "center", textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // 6. ETAPA FINAL DE ENFRIAMIENTO DEL GRANO (POST-SECADO)
  const finalStagesRows: any[] = [];
  (etapaEnfriamientoFinal || []).forEach((r: any, i: number) => {
    if (r.horaInicio || r.horaFin || r.tempGrano || r.humedad || i === 0) {
      const dur = calcDur(r.horaInicio, r.horaFin) || r.duracion || (r.tiempoMin !== undefined ? `${r.tiempoMin} min` : "-");
      finalStagesRows.push(["Enfriamiento Final", r.fecha || fecha, `ENF-FIN-${i + 1}`, r.horaInicio || "--:--", r.horaFin || "--:--", dur, r.tempGrano ?? "-", r.tempAmbiente ?? "-", r.humedadRelativa ?? "-", r.humedad ?? "-", r.tempProgramada ?? "-"]);
    }
  });

  if (finalStagesRows.length > 0) {
    if (currentY > 145) {
      doc.addPage();
      currentY = 10;
    }
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [
        [{ content: "7. ETAPA FINAL DE ENFRIAMIENTO DEL GRANO (POST-SECADO / ACONDICIONAMIENTO)", colSpan: 11, styles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" } }],
        ["ETAPA", "FECHA", "FASE", "H. INICIO", "H. FINAL", "DURACIÓN", "T° GRANO", "T° AMB.", "H.R (%)", "HUMEDAD", "T° PROG."]
      ],
      body: finalStagesRows,
      theme: "grid",
      headStyles: { fillColor: [204, 251, 241], textColor: [15, 23, 42], fontSize: 6.5, halign: "center" },
      styles: { fontSize: 6.3, cellPadding: 0.9, halign: "center", textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.15 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 4;
  }

  // 7. OBSERVACIONES Y FIRMAS DE CONFORMIDAD
  if (currentY > 192) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`OBSERVACIONES DE CONTROL: ${observaciones || "Parámetros operativos dentro de los estándares de planta."}`, margin, currentY);

  const sigY = currentY + 11;
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.3);
  doc.line(margin + 35, sigY, margin + 105, sigY);
  doc.line(pageWidth - margin - 105, sigY, pageWidth - margin - 35, sigY);

  doc.setFontSize(7.5);
  doc.text((operario || "OPERARIO DE TURNO").toUpperCase(), margin + 70, sigY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("FIRMA DEL OPERARIO DE TURNO", margin + 70, sigY + 7.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text((supervisor || "JEFE DE PLANTA").toUpperCase(), pageWidth - margin - 70, sigY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text("SUPERVISOR / JEFE DE PLANTA", pageWidth - margin - 70, sigY + 7.5, { align: "center" });

  const cleanCode = (batchCode || "BATCH").replace(/[^a-zA-Z0-9_-]/g, "");
  doc.save(`FICHA_OFICIAL_VAPORIZADO_BATCH_${cleanCode}.pdf`);

  // Además lanzar impresión aislada por si el usuario desea imprimir directamente en impresora física
  if (elementForPrint) {
    triggerCleanBrowserPrint(elementForPrint);
  }
}

/**
 * Genera el PDF Vectorial Oficial para el Acta y Certificado Oficial de Cierre & Liquidación de Batch
 * (Formato Oficial A4 Vertical)
 */
export function generateActaCierreBatchPDF(params: {
  batchCode: string;
  batchId?: string;
  cliente: string;
  variedad: string;
  pesoTotalKg: number;
  numSacos?: string | number;
  procedencia?: string;
  fechaCierre?: string;
  responsablePlanta: string;
  supervisor?: string;
  dictamenCalidad: string;
  observacionCierre: string;
  analisisFinal: {
    HUMEDAD?: number;
    BL?: number;
    BLI?: number;
    GI?: number;
    RB?: number;
    RI?: number;
    RM?: number;
    QB?: number;
    QI?: number;
    TZ?: number;
    TT?: number;
    TP?: number;
    M?: number;
    GR?: number;
  };
  lotesAsociados: Array<{
    LOTE_ID: string;
    PESO_KG?: number;
    SACOS?: number;
    VARIEDAD?: string;
    CLIENTE?: string;
  }>;
  elementForPrint?: HTMLElement | null;
}) {
  const {
    batchCode,
    batchId,
    cliente,
    variedad,
    pesoTotalKg,
    numSacos,
    procedencia,
    fechaCierre,
    responsablePlanta,
    supervisor,
    dictamenCalidad,
    observacionCierre,
    analisisFinal,
    lotesAsociados,
    elementForPrint
  } = params;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const margin = 14;
  const fechaStr = fechaCierre || new Date().toLocaleDateString("es-PE");
  const cleanCode = (batchCode || batchId || "BATCH").replace(/[^a-zA-Z0-9_-]/g, "");

  // 1. BANNER INSTITUCIONAL SUPERIOR
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setFillColor(16, 185, 129); // Emerald-500 accent line
  doc.rect(0, 32, pageWidth, 2, "F");

  doc.setTextColor(52, 211, 153); // Emerald-400
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("MOLINO DON JULIO S.A.C. — PROCESOS INDUSTRIALES APIT (LÍNEA 35 TN)", margin, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("ACTA OFICIAL DE CIERRE Y LIQUIDACIÓN DE BATCH", margin, 19.5);

  doc.setTextColor(203, 213, 225);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Registro Oficial N° ACTA-${cleanCode}   |   Fecha de Liquidación: ${fechaStr}`, margin, 26.5);

  // Badge Estado en esquina superior derecha
  doc.setFillColor(6, 78, 59);
  doc.roundedRect(pageWidth - margin - 52, 11, 52, 12, 2, 2, "F");
  doc.setTextColor(110, 231, 183);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ESTADO OFICIAL:", pageWidth - margin - 26, 15.8, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text("CERRADO & LIQUIDADO", pageWidth - margin - 26, 20.5, { align: "center" });

  let currentY = 42;

  // 2. SECCIÓN 1: DATOS GENERALES DE LIQUIDACIÓN DEL BATCH
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        {
          content: "1. DATOS GENERALES DEL BATCH PROCESADO Y LIQUIDADO",
          colSpan: 4,
          styles: { fillColor: [54, 100, 39], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ]
    ],
    body: [
      [
        { content: "CORRELATIVO BATCH:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: `${batchCode}${batchId && batchId !== batchCode ? ` (${batchId})` : ""}`, styles: { fontStyle: "bold", textColor: [180, 83, 9], fontSize: 10 } },
        { content: "FECHA DE CIERRE:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: fechaStr, styles: { fontStyle: "bold" } }
      ],
      [
        { content: "CLIENTE / PRODUCTOR:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: (cliente || "MOLINO PRODUCCIÓN").toUpperCase(), styles: { fontStyle: "bold" } },
        { content: "VARIEDAD DE ARROZ:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: (variedad || "ESTÁNDAR").toUpperCase(), styles: { fontStyle: "bold", textColor: [6, 95, 70] } }
      ],
      [
        { content: "KILOS LIQUIDADOS:", styles: { fontStyle: "bold", fillColor: [236, 253, 245] } },
        { content: `${(pesoTotalKg || 35000).toLocaleString()} kg (${((pesoTotalKg || 35000) / 1000).toFixed(2)} TN)`, styles: { fontStyle: "bold", textColor: [6, 95, 70], fillColor: [236, 253, 245] } },
        { content: "N° SACOS / PROCEDENCIA:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: `${numSacos ? `${numSacos} | ` : ""}${procedencia || "Tolvas Planta APIT"}`, styles: { fontStyle: "bold" } }
      ],
      [
        { content: "RESPONSABLE DE PLANTA:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: (responsablePlanta || "Jefe de Turno").toUpperCase(), styles: { fontStyle: "bold" } },
        { content: "SUPERVISIÓN CALIDAD:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: (supervisor || "Jefatura de Planta y Calidad").toUpperCase(), styles: { fontStyle: "bold" } }
      ]
    ],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 3. SECCIÓN 2: RESULTADOS DE CALIDAD POST-VAPORIZADO (LABORATORIO APIT) - Solo los que se registran
  const registeredQualityList: Array<{ label: string; value: string; isHighlight?: boolean }> = [];
  if (analisisFinal.HUMEDAD !== undefined && analisisFinal.HUMEDAD !== null && !isNaN(Number(analisisFinal.HUMEDAD))) {
    registeredQualityList.push({ label: "Humedad Final de Salida (%)", value: `${Number(analisisFinal.HUMEDAD).toFixed(1)}%`, isHighlight: true });
  }
  if (analisisFinal.RB !== undefined && analisisFinal.RB !== null && !isNaN(Number(analisisFinal.RB))) {
    registeredQualityList.push({ label: "Rendimiento Blanco (RB %)", value: `${Number(analisisFinal.RB).toFixed(1)}%` });
  }
  if (analisisFinal.RI !== undefined && analisisFinal.RI !== null && !isNaN(Number(analisisFinal.RI))) {
    registeredQualityList.push({ label: "Rendimiento Integral (RI %)", value: `${Number(analisisFinal.RI).toFixed(1)}%` });
  }
  if (analisisFinal.QB !== undefined && analisisFinal.QB !== null && !isNaN(Number(analisisFinal.QB))) {
    registeredQualityList.push({ label: "Quebrado Blanco (QB %)", value: `${Number(analisisFinal.QB).toFixed(1)}%` });
  }
  if (analisisFinal.QI !== undefined && analisisFinal.QI !== null && !isNaN(Number(analisisFinal.QI))) {
    registeredQualityList.push({ label: "Quebrado Integral (QI %)", value: `${Number(analisisFinal.QI).toFixed(1)}%` });
  }
  if (analisisFinal.TZ !== undefined && analisisFinal.TZ !== null && !isNaN(Number(analisisFinal.TZ))) {
    registeredQualityList.push({ label: "Trizado (TZ %)", value: `${Number(analisisFinal.TZ).toFixed(1)}%` });
  }
  if (analisisFinal.M !== undefined && analisisFinal.M !== null && !isNaN(Number(analisisFinal.M))) {
    registeredQualityList.push({ label: "Mancha (M %)", value: `${Number(analisisFinal.M).toFixed(1)}%` });
  }

  const qualityTableBody: any[] = [];
  for (let i = 0; i < registeredQualityList.length; i += 2) {
    const itemA = registeredQualityList[i];
    const itemB = registeredQualityList[i + 1];
    qualityTableBody.push([
      { content: itemA.label, styles: { fontStyle: "bold" } },
      { content: itemA.value, styles: { halign: "center", fontStyle: "bold", textColor: itemA.isHighlight ? [6, 95, 70] : [15, 23, 42], fillColor: itemA.isHighlight ? [236, 253, 245] : undefined } },
      itemB ? { content: itemB.label, styles: { fontStyle: "bold" } } : { content: "-", styles: { textColor: [148, 163, 184] } },
      itemB ? { content: itemB.value, styles: { halign: "center", fontStyle: "bold" } } : { content: "-", styles: { halign: "center", textColor: [148, 163, 184] } }
    ]);
  }

  if (qualityTableBody.length === 0) {
    qualityTableBody.push([
      { content: "Conformidad de Cierre de Proceso:", styles: { fontStyle: "bold" } },
      { content: "CONFORME", styles: { halign: "center", fontStyle: "bold", textColor: [6, 95, 70], fillColor: [236, 253, 245] } },
      { content: "Conformidad de Descarga:", styles: { fontStyle: "bold" } },
      { content: "CONFORME", styles: { halign: "center", fontStyle: "bold", textColor: [6, 95, 70], fillColor: [236, 253, 245] } }
    ]);
    qualityTableBody.push([
      { content: "Estado Análisis de Descarga:", styles: { fontStyle: "bold" } },
      { content: "PENDIENTE", styles: { halign: "center", fontStyle: "bold", textColor: [180, 83, 9], fillColor: [254, 243, 199] } },
      { content: "Responsable Calidad:", styles: { fontStyle: "bold" } },
      { content: "Analistas de Laboratorio", styles: { halign: "center", fontStyle: "bold" } }
    ]);
    qualityTableBody.push([
      { content: "Observaciones del Proceso:", styles: { fontStyle: "bold" } },
      { content: observacionCierre || "Proceso de vaporizado y secado concluido con normalidad en planta.", colSpan: 3, styles: { fontStyle: "italic", textColor: [51, 65, 85] } }
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        {
          content: "2. CONFORMIDAD OPERATIVA DE PLANTA Y ESTADO DE CALIDAD",
          colSpan: 4,
          styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ],
      [
        { content: "PARÁMETRO REGISTRADO", styles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" } },
        { content: "RESULTADO FINAL", styles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold", halign: "center" } },
        { content: "PARÁMETRO REGISTRADO", styles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" } },
        { content: "RESULTADO FINAL", styles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold", halign: "center" } }
      ]
    ],
    body: qualityTableBody,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.3, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 4. SECCIÓN 3: TRAZABILIDAD DE LOTES DE ORIGEN PROCESADOS Y ARCHIVADOS
  const lotesRows =
    lotesAsociados && lotesAsociados.length > 0
      ? lotesAsociados.map((bl, idx) => [
          String(idx + 1),
          { content: bl.LOTE_ID || "-", styles: { fontStyle: "bold" as const, textColor: [8, 145, 178] as [number, number, number] } },
          bl.CLIENTE || cliente || "MOLINO",
          bl.VARIEDAD || variedad || "-",
          bl.SACOS !== undefined ? `${bl.SACOS} sacos` : "-",
          { content: `${(bl.PESO_KG || 0).toLocaleString()} kg`, styles: { fontStyle: "bold" as const, halign: "right" as const } },
          { content: "PROCESADO & ARCHIVADO", styles: { fontStyle: "bold" as const, textColor: [6, 95, 70] as [number, number, number], halign: "center" as const } }
        ])
      : [
          [
            "1",
            { content: cleanCode, styles: { fontStyle: "bold" as const } },
            cliente || "MOLINO",
            variedad || "-",
            String(numSacos || "360 sacos"),
            { content: `${(pesoTotalKg || 35000).toLocaleString()} kg`, styles: { fontStyle: "bold" as const, halign: "right" as const } },
            { content: "PROCESADO & ARCHIVADO", styles: { fontStyle: "bold" as const, textColor: [6, 95, 70] as [number, number, number], halign: "center" as const } }
          ]
        ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        {
          content: `3. TRAZABILIDAD DE LOTES DE ORIGEN PROCESADOS Y LIQUIDADOS (${lotesRows.length})`,
          colSpan: 7,
          styles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ],
      ["#", "CÓDIGO LOTE", "CLIENTE / ORIGEN", "VARIEDAD", "SACOS", "PESO (KG)", "ESTADO FINAL"]
    ],
    body: lotesRows,
    theme: "grid",
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontSize: 7.8, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 5. SECCIÓN 4: DICTAMEN TÉCNICO Y OBSERVACIONES DE CIERRE
  const dictamenColor: [number, number, number] =
    dictamenCalidad === "CONFORME"
      ? [6, 95, 70]
      : dictamenCalidad === "APROBADO_OBSERVADO"
      ? [180, 83, 9]
      : [153, 27, 27];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        {
          content: "4. DICTAMEN TÉCNICO OFICIAL Y CONCLUSIONES DE LIQUIDACIÓN",
          colSpan: 2,
          styles: { fillColor: dictamenColor, textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ]
    ],
    body: [
      [
        { content: "DICTAMEN TÉCNICO DE CALIDAD:", styles: { fontStyle: "bold", fillColor: [241, 245, 249], cellWidth: 58 } },
        { content: dictamenCalidad || "CONFORME (APROBADO)", styles: { fontStyle: "bold", textColor: dictamenColor, fontSize: 10 } }
      ],
      [
        { content: "OBSERVACIONES DE CIERRE:", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        { content: observacionCierre || "Batch procesado conforme, parámetros térmicos estables y análisis final aprobado." }
      ]
    ],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [15, 23, 42], lineColor: [148, 163, 184], lineWidth: 0.2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 22;

  if (currentY > 265) {
    doc.addPage();
    currentY = 35;
  }

  // 6. FIRMAS Y SELLOS DE CONFORMIDAD
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.35);
  doc.line(margin + 10, currentY, margin + 78, currentY);
  doc.line(pageWidth - margin - 78, currentY, pageWidth - margin - 10, currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text((responsablePlanta || "RESPONSABLE DE PLANTA").toUpperCase(), margin + 44, currentY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("RESPONSABLE DE OPERACIÓN Y CIERRE", margin + 44, currentY + 9, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text((supervisor || "JEFATURA DE PLANTA Y CALIDAD").toUpperCase(), pageWidth - margin - 44, currentY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("V°B° SUPERINTENDENCIA / CALIDAD APIT", pageWidth - margin - 44, currentY + 9, { align: "center" });

  doc.save(`ACTA_OFICIAL_CIERRE_LIQUIDACION_BATCH_${cleanCode}.pdf`);

  if (elementForPrint) {
    triggerCleanBrowserPrint(elementForPrint);
  }
}

/**
 * Formatea minutos en formato legible "XX min (X h XX min)" para reportes PDF
 */
function formatMinToPdfText(mins: number): string {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${m} min (${h} h ${rem} min)` : `${m} min (${h} h)`;
}

/**
 * Limpia caracteres Unicode fuera de Latin-1 (como flechas ➔, Δ, ★, ✓) que la fuente Helvetica nativa de jsPDF
 * no soporta y que provocan pérdida de letras o desalineación de columnas en el PDF.
 */
function sanitizePdfLatinText(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return "";
  return String(text)
    .replace(/➔|➜|→|⟶/g, "->")
    .replace(/Δ|∆/g, "Dif.")
    .replace(/★|☆/g, "*")
    .replace(/✓|✔/g, "[OK]")
    .replace(/•/g, "-")
    .replace(/–|—/g, "-");
}

/**
 * Genera el PDF Vectorial Oficial de Alta Precisión para la FICHA FINAL DE BATCH CERRADO
 * garantizando que ningún texto se vea cortado ni se pierdan letras en ninguna página.
 */
export function generateFichaFinalBatchCerradoPDF(
  fichaData: {
    clienteFinal: string;
    codigoLoteFinal: string;
    totalSacosFinal: number;
    pesoIngresoKg: number;
    totalSacasFinal: number;
    pesoRealDescargaKg: number;
    pesoProyectadoKg: number;
    balanceSacas: {
      rangoMinPermitidoKg: number;
      rangoMaxPermitidoKg: number;
      diferenciaKg: number;
      diferenciaPorcentaje: number;
      fueraDeRango: boolean;
      alarmaActiva: boolean;
      alarmaAceptada: boolean;
      sustentoObservacionAlarma?: string;
    };
    procedenciaFinal: string;
    variedadFinal: string;
    batchVinculadoFinal: string;
    corr: string;
    fechaCierreFinal: string;
    humedadInicialBatch: number;
    desvHumedadInicial: number;
    humInicialMax: number;
    humInicialMin: number;
    humedadFinalBatch: number;
    desvHumedadFinal: number;
    deltaHumedad: number;
    tomasHumedadSalida: Array<number | string>;
    comparativoFisico: Array<{
      codigo: string;
      nombre: string;
      unidad: string;
      ingreso: number;
      salida: number;
      delta: number;
      inverseGood: boolean;
      highlight?: boolean;
    }>;
    ingEntero: number;
    salEntero: number;
    ingRB: number;
    salRB: number;
    ingQB: number;
    salQB: number;
    ingTrizado: number;
    salTrizado: number;
    ingTT: number;
    salTT: number;
    organolepticosList: Array<{
      label: string;
      abrev: string;
      ingreso: { code: string; label: string };
      salida: { code: string; label: string };
      criterioApto: string;
    }>;
    equipoAutoclave: string;
    modalidadPases: string;
    presionVaporBar: number | string;
    presionPase1: number | string;
    presionPase2: number | string;
    velExclusa: number | string;
    rpmAutoclave: number | string;
    tempTrabajoVapor: string;
    tempSecadoPromC: number | string;
    tempGranoPromC: number | string;
    operadorPlanta: string;
    supervisorPlanta: string;
    paradasList: any[];
    tiempoLlenadoTolvaPulmonMin: number;
    tiempoInyeccionVaporMin: number;
    calcInyP1: number;
    calcInyP2: number;
    tiempoFallasMecanicasMin: number;
    tiempoBateriaSilosMin: number;
    tiempoTotalVaporizadoMin: number;
    calcReposo1Min?: number;
    calcEnfriamientoMin?: number;
    calcReposo2Min?: number;
    calcSecadoMin: number;
    calcEnfriamientoFinalMin?: number;
    tieneRepososIntermedios?: boolean;
    secadoCurvePoints?: any[];
    tiempoTotalProcesoBatchMin: number;
    tazasArroz: number | string;
    tazasAgua: number | string;
    tiempoCoccionOllaMin: number | string;
    saborCoccion: string;
    desplazamientoSeg: number | string;
    granoQuebradoOllaPct: number | string;
    granoHinchadoPct: number | string;
    granoAbiertoPct: number | string;
    texturaFrio: string;
    puntajeCoccion: number | string;
    solturaGrano: string;
    envaseProyectado: string;
    observacionesFinales: string;
  },
  elementForPrint?: HTMLElement | null
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 9;
  const usableWidth = pageWidth - margin * 2; // 192 mm

  // =========================================================================
  // MEMBRETE OFICIAL DEL EXPEDIENTE DE CIERRE
  // =========================================================================
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(margin, 8, usableWidth, 16, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(
    "FICHA FINAL DE BATCH CERRADO — MOLINO DON JULIO S.A.C.",
    margin + 4,
    14.5
  );

  doc.setFontSize(7.8);
  doc.setTextColor(252, 211, 77); // Amber-300
  doc.text(
    "LIQUIDACION OFICIAL DE PROCESO DE VAPORIZADO, SECADO, CALIDAD FISICA Y COCCION",
    margin + 4,
    20.5
  );

  // Badge de Batch y Fecha a la derecha del membrete
  doc.setFillColor(6, 78, 59); // Emerald-900
  doc.roundedRect(pageWidth - margin - 54, 10, 51, 12, 1.5, 1.5, "F");
  doc.setTextColor(167, 243, 208);
  doc.setFontSize(6.8);
  doc.text("BATCH CERRADO / FECHA CIERRE", pageWidth - margin - 28.5, 14, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.8);
  doc.text(
    `${sanitizePdfLatinText(fichaData.corr)} | ${sanitizePdfLatinText(fichaData.fechaCierreFinal)}`,
    pageWidth - margin - 28.5,
    19.5,
    { align: "center" }
  );

  // =========================================================================
  // TABLA DE 8 CAMPOS OBLIGATORIOS DE IDENTIFICACIÓN DEL BATCH CERRADO
  // =========================================================================
  const pesoSacasDesc =
    fichaData.pesoRealDescargaKg > 0
      ? `${fichaData.pesoRealDescargaKg.toLocaleString("es-PE")} kg`
      : `Proy: ${fichaData.pesoProyectadoKg.toLocaleString("es-PE")} kg`;

  autoTable(doc, {
    startY: 26,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    body: [
      [
        {
          content: "1. CLIENTE:",
          styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [51, 65, 85], cellWidth: 34 }
        },
        {
          content: sanitizePdfLatinText(fichaData.clienteFinal),
          styles: { fontStyle: "bold", textColor: [15, 23, 42], cellWidth: 62 }
        },
        {
          content: "2. CODIGO / LOTE:",
          styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [51, 65, 85], cellWidth: 34 }
        },
        {
          content: sanitizePdfLatinText(fichaData.codigoLoteFinal),
          styles: { fontStyle: "bold", textColor: [88, 28, 135], cellWidth: 62 }
        }
      ],
      [
        {
          content: "3. TOTAL DE SACOS:",
          styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [51, 65, 85] }
        },
        {
          content: `${fichaData.totalSacosFinal.toLocaleString("es-PE")} sacos (${fichaData.pesoIngresoKg.toLocaleString("es-PE")} kg)`,
          styles: { fontStyle: "bold", textColor: [15, 23, 42] }
        },
        {
          content: "4. TOTAL DE SACAS:",
          styles: { fontStyle: "bold", fillColor: [243, 232, 255], textColor: [88, 28, 135] }
        },
        {
          content: `${fichaData.totalSacasFinal} ${fichaData.totalSacasFinal === 1 ? "saca Big Bag" : "sacas Big Bag"} (${pesoSacasDesc})`,
          styles: { fontStyle: "bold", fillColor: [250, 245, 255], textColor: [88, 28, 135] }
        }
      ],
      [
        {
          content: "5. PROCEDENCIA:",
          styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [51, 65, 85] }
        },
        {
          content: sanitizePdfLatinText(fichaData.procedenciaFinal),
          styles: { fontStyle: "bold", textColor: [15, 23, 42] }
        },
        {
          content: "6. VARIEDAD:",
          styles: { fontStyle: "bold", fillColor: [236, 253, 245], textColor: [6, 95, 70] }
        },
        {
          content: sanitizePdfLatinText(fichaData.variedadFinal),
          styles: { fontStyle: "bold", fillColor: [240, 253, 244], textColor: [6, 95, 70] }
        }
      ],
      [
        {
          content: "7. BATCH VINCULADO:",
          styles: { fontStyle: "bold", fillColor: [254, 243, 199], textColor: [146, 64, 14] }
        },
        {
          content: sanitizePdfLatinText(fichaData.batchVinculadoFinal),
          styles: { fontStyle: "bold", fillColor: [255, 251, 235], textColor: [146, 64, 14] }
        },
        {
          content: "8. FECHA DE CIERRE:",
          styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [51, 65, 85] }
        },
        {
          content: sanitizePdfLatinText(fichaData.fechaCierreFinal),
          styles: { fontStyle: "bold", textColor: [15, 23, 42] }
        }
      ]
    ],
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.8,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [148, 163, 184],
      lineWidth: 0.2
    }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // =========================================================================
  // 1. HUMEDAD INICIAL DE BATCH COMPARANDO CON HUMEDAD FINAL DE VAPORIZADO
  // =========================================================================
  const signDeltaHum = fichaData.deltaHumedad > 0 ? `+${fichaData.deltaHumedad}` : `${fichaData.deltaHumedad}`;
  const humedadBodyRows: any[] = [
    [
      {
        content: `HUMEDAD INICIAL DEL BATCH (INGRESO)\nPromedio: ${fichaData.humedadInicialBatch}% (Desv: +/-${fichaData.desvHumedadInicial}%)\nRango Ingreso: Min ${fichaData.humInicialMin}% - Max ${fichaData.humInicialMax}%`,
        styles: { fontStyle: "bold", fillColor: [255, 255, 255], textColor: [15, 23, 42], cellWidth: 48 }
      },
      {
        content: `HUMEDAD FINAL VAPORIZADO / SECADO\nFinal: ${fichaData.humedadFinalBatch}% (Desv: +/-${fichaData.desvHumedadFinal}%)\n${
          fichaData.humedadFinalBatch >= 11.5 && fichaData.humedadFinalBatch <= 13.5
            ? "[OK] Dentro del rango optimo (11.5% - 13.5%)"
            : "Humedad final registrada en laboratorio"
        }`,
        styles: { fontStyle: "bold", fillColor: [236, 254, 255], textColor: [14, 116, 144], cellWidth: 48 }
      },
      {
        content: `VARIACION NETA DE HUMEDAD (SECADO)\nDiferencia: ${signDeltaHum}% (${fichaData.humedadInicialBatch}% -> ${fichaData.humedadFinalBatch}%)\nExtraccion controlada en secadora`,
        styles: { fontStyle: "bold", fillColor: [236, 253, 245], textColor: [6, 95, 70], cellWidth: 48 }
      },
      {
        content: `BALANCE DE MASA POR HUMEDAD (+/-2%)\nIngreso: ${fichaData.pesoIngresoKg.toLocaleString("es-PE")} kg\nProyectado: ${fichaData.pesoProyectadoKg.toLocaleString("es-PE")} kg\nReal (${fichaData.totalSacasFinal} sacas): ${
          fichaData.pesoRealDescargaKg > 0 ? `${fichaData.pesoRealDescargaKg.toLocaleString("es-PE")} kg` : "S/R"
        }`,
        styles: { fontStyle: "bold", fillColor: [255, 251, 235], textColor: [146, 64, 14], cellWidth: 48 }
      }
    ]
  ];

  // Curva de Secado Dinámica (Perfiles reales registrados del batch)
  const curvaSecadoTexto = (fichaData.secadoCurvePoints && fichaData.secadoCurvePoints.length > 0)
    ? fichaData.secadoCurvePoints
        .map((pt: any) => `P${pt.perfil}: ${pt.humedad}%${pt.tempProgramada ? ` (${pt.tempProgramada}°C)` : ""}`)
        .join("  ➔  ")
    : "Sin perfiles horarios de secado registrados aún en la Hoja de Control de Vaporizado para este Batch";

  humedadBodyRows.push([
    {
      content: `CURVA DE SECADO DINAMICA (PERFILES REGISTRADOS):\n${sanitizePdfLatinText(curvaSecadoTexto)}\nH. Inicial: ${fichaData.humedadInicialBatch}%  ➔  H. Final: ${fichaData.humedadFinalBatch}%   |   Δ Descenso Total: ${signDeltaHum}%   |   Rango Meta: 11.5% - 13.0% (Base 12.0%)`,
      colSpan: 4,
      styles: { fontStyle: "bold", fillColor: [240, 253, 250], textColor: [15, 23, 42], fontSize: 7.2 }
    }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [
      [
        {
          content: "1. HUMEDAD INICIAL DE BATCH COMPARANDO CON HUMEDAD FINAL DE VAPORIZADO / SECADO",
          colSpan: 4,
          styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ]
    ],
    body: humedadBodyRows,
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      cellPadding: 2.2,
      overflow: "linebreak",
      lineColor: [148, 163, 184],
      lineWidth: 0.2
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // =========================================================================
  // 2. PARÁMETROS FÍSICOS Y RENDIMIENTOS: INGRESO VS DESPUÉS DE VAPORIZADO
  // =========================================================================
  const fisicoBodyRows = fichaData.comparativoFisico.map((row) => {
    const isZeroDelta = row.delta === 0;
    const isPositiveDelta = row.delta > 0;
    const isFavorable = isZeroDelta
      ? true
      : row.inverseGood
      ? row.delta <= 0
      : row.delta >= 0;

    const deltaStr = `${isPositiveDelta ? `+${row.delta}` : row.delta}${row.unidad}`;

    return [
      {
        content: sanitizePdfLatinText(row.codigo),
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          textColor: [71, 85, 105] as [number, number, number],
          fillColor: (row.highlight ? [254, 243, 199] : [248, 250, 252]) as [number, number, number]
        }
      },
      {
        content: sanitizePdfLatinText(row.nombre),
        styles: {
          fontStyle: (row.highlight ? "bold" : "normal") as "bold" | "normal",
          textColor: [15, 23, 42] as [number, number, number],
          fillColor: (row.highlight ? [255, 251, 235] : [255, 255, 255]) as [number, number, number]
        }
      },
      {
        content: `${row.ingreso}${row.unidad}`,
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          textColor: [51, 65, 85] as [number, number, number],
          fillColor: [248, 250, 252] as [number, number, number]
        }
      },
      {
        content: `${row.salida}${row.unidad}`,
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          textColor: [15, 23, 42] as [number, number, number],
          fillColor: [255, 251, 235] as [number, number, number]
        }
      },
      {
        content: deltaStr,
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          textColor: (isZeroDelta
            ? [71, 85, 105]
            : isFavorable
            ? [6, 95, 70]
            : [146, 64, 14]) as [number, number, number],
          fillColor: (isZeroDelta
            ? [241, 245, 249]
            : isFavorable
            ? [236, 253, 245]
            : [254, 243, 199]) as [number, number, number]
        }
      }
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [
      [
        {
          content: "2. PARAMETROS FISICOS Y RENDIMIENTOS DE INGRESO COMPARANDO CON DESPUES DE VAPORIZADO",
          colSpan: 5,
          styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ],
      [
        { content: "COD.", styles: { halign: "center", cellWidth: 16, fillColor: [226, 232, 240], textColor: [15, 23, 42] } },
        { content: "PARAMETRO FISICO / RENDIMIENTO", styles: { halign: "left", cellWidth: 80, fillColor: [226, 232, 240], textColor: [15, 23, 42] } },
        { content: "INGRESO (MP)", styles: { halign: "center", cellWidth: 32, fillColor: [226, 232, 240], textColor: [15, 23, 42] } },
        { content: "POST-VAPORIZADO", styles: { halign: "center", cellWidth: 32, fillColor: [254, 243, 199], textColor: [146, 64, 14] } },
        { content: "VARIACION (SAL - ING)", styles: { halign: "center", cellWidth: 32, fillColor: [226, 232, 240], textColor: [15, 23, 42] } }
      ]
    ],
    body: fisicoBodyRows,
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.1,
      cellPadding: 1.45,
      overflow: "linebreak",
      lineColor: [148, 163, 184],
      lineWidth: 0.2
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // =========================================================================
  // 3. PROPIEDADES ORGANOLÉPTICAS & DEFECTOS CUALITATIVOS
  // =========================================================================
  const orgCols = fichaData.organolepticosList;
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [
      [
        {
          content: "3. PROPIEDADES ORGANOLEPTICAS & DEFECTOS CUALITATIVOS (Escala: N=Ninguno, P=Poco, R=Regular, V=Variado, B=Bastante)",
          colSpan: 6,
          styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ],
      orgCols.map((o) => ({
        content: sanitizePdfLatinText(`${o.label.toUpperCase()} (${o.abrev})`),
        styles: { halign: "center" as const, fillColor: [226, 232, 240] as [number, number, number], textColor: [15, 23, 42] as [number, number, number], fontStyle: "bold" as const, cellWidth: 32 }
      }))
    ],
    body: [
      orgCols.map((o) => ({
        content: `Ingreso: ${sanitizePdfLatinText(o.ingreso.label)}\nPost-Vap: ${sanitizePdfLatinText(o.salida.label)}\nCriterio: ${sanitizePdfLatinText(o.criterioApto)}`,
        styles: {
          halign: "center" as const,
          fontStyle: "bold" as const,
          fillColor: (o.salida.code === "N" || o.salida.code === "P" ? [240, 253, 244] : [255, 251, 235]) as [number, number, number],
          textColor: [15, 23, 42] as [number, number, number]
        }
      }))
    ],
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [148, 163, 184],
      lineWidth: 0.2
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // Si queda poco espacio en la primera hoja, saltar limpiamente a la página 2 antes de la Sección 4
  if (currentY > pageHeight - 75) {
    doc.addPage();
    currentY = 12;
  }

  // =========================================================================
  // 4. PARÁMETROS OPERATIVOS DE VAPORIZADO Y TIEMPOS TOTALES DE PROCESO
  // =========================================================================
  const presionStr =
    fichaData.modalidadPases === "2_PASES"
      ? `P1: ${fichaData.presionPase1} / P2: ${fichaData.presionPase2} bar`
      : `${fichaData.presionVaporBar} bar`;

  const detalleInyStr =
    fichaData.tiempoInyeccionVaporMin === 0
      ? "0 min (Sin inyeccion registrada)"
      : fichaData.modalidadPases === "2_PASES" && (fichaData.calcInyP1 > 0 || fichaData.calcInyP2 > 0)
      ? `${fichaData.tiempoInyeccionVaporMin} min (1°P: ${fichaData.calcInyP1}m + 2°P: ${fichaData.calcInyP2}m)`
      : `${fichaData.tiempoInyeccionVaporMin} min`;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [
      [
        {
          content: `4. PARAMETROS OPERATIVOS DE VAPORIZADO, TIEMPO TOTAL DE VAPORIZADO Y TIEMPO TOTAL DE PROCESO (${sanitizePdfLatinText(fichaData.equipoAutoclave)})`,
          colSpan: 4,
          styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ],
      [
        {
          content: "4.1 PARAMETROS OPERATIVOS DE VAPORIZADO Y SECADO",
          colSpan: 4,
          styles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold", halign: "left" }
        }
      ]
    ],
    body: [
      [
        {
          content: `Modalidad Vaporizado:\n${fichaData.modalidadPases === "2_PASES" ? "2 Pases (Anti-Trizado)" : "1 Pase Directo"}`,
          styles: { fontStyle: "bold", cellWidth: 48 }
        },
        {
          content: `Presion de Vapor:\n${sanitizePdfLatinText(presionStr)}`,
          styles: { fontStyle: "bold", textColor: [6, 95, 70], cellWidth: 48 }
        },
        {
          content: `Vel. Exclusa / RPM Autoclave:\nV.Excl: ${sanitizePdfLatinText(fichaData.velExclusa)} | ${sanitizePdfLatinText(fichaData.rpmAutoclave)} RPM`,
          styles: { fontStyle: "bold", cellWidth: 48 }
        },
        {
          content: `Temp. Vapor / Temp. Secado:\nVapor: ${sanitizePdfLatinText(fichaData.tempTrabajoVapor)} | Aire: ${fichaData.tempSecadoPromC}°C (Grano: ${fichaData.tempGranoPromC}°C)`,
          styles: { fontStyle: "bold", textColor: [146, 64, 14], cellWidth: 48 }
        }
      ],
      [
        {
          content: "4.2 TIEMPO TOTAL DE VAPORIZADO (Suma = Llenado Tolva Pulmon + Inyeccion Vapor + Fallas Mecanicas + Bateria Enfriamiento Silos)",
          colSpan: 3,
          styles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: "bold" }
        },
        {
          content: `TOTAL VAPORIZADO: ${formatMinToPdfText(fichaData.tiempoTotalVaporizadoMin)}`,
          styles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" }
        }
      ],
      [
        {
          content: `1. Llenado Tolva Pulmon:\n${fichaData.tiempoLlenadoTolvaPulmonMin} min\n(Carga inicial a tolva)`,
          styles: { fontStyle: "bold", fillColor: [255, 251, 235] }
        },
        {
          content: `2. Inyeccion de Vapor:\n${sanitizePdfLatinText(detalleInyStr)}\n(Autoclave vaporizado)`,
          styles: { fontStyle: "bold", fillColor: [255, 251, 235], textColor: [146, 64, 14] }
        },
        {
          content: `3. Fallas Mecanicas:\n${fichaData.tiempoFallasMecanicasMin} min\n(${fichaData.paradasList.length > 0 ? `${fichaData.paradasList.length} parada(s)` : "Sin paradas mecanicas"})`,
          styles: { fontStyle: "bold", fillColor: [255, 251, 235], textColor: fichaData.tiempoFallasMecanicasMin > 0 ? [185, 28, 28] : [6, 95, 70] }
        },
        {
          content: `4. Bateria Enfriamiento Silos:\n${fichaData.tiempoBateriaSilosMin} min\n(Llenado + Reposo + Descarga Silos)`,
          styles: { fontStyle: "bold", fillColor: [255, 251, 235], textColor: [30, 58, 138] }
        }
      ]
    ],
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [148, 163, 184],
      lineWidth: 0.2
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  // Subtabla 4.3: Cronograma Integral de las Etapas reales de la Hoja de Control de Vaporizado
  const cronoCols = [
    {
      content: `I. T. TOTAL VAPORIZADO\n${fichaData.tiempoTotalVaporizadoMin} min (${(fichaData.tiempoTotalVaporizadoMin / 60).toFixed(1)} h)\nTolva Pulmon + Inyeccion Vapor + Fallas + Bateria Silos`,
      styles: { fontStyle: "bold", fillColor: [30, 41, 59], textColor: [255, 255, 255], halign: "center", cellWidth: 64 }
    },
    {
      content: `II. TIEMPO DE SECADO\n${fichaData.calcSecadoMin} min (${(fichaData.calcSecadoMin / 60).toFixed(1)} h)\nPerfiles Horarios Registrados en Secadora`,
      styles: { fontStyle: "bold", fillColor: [30, 41, 59], textColor: [254, 205, 211], halign: "center", cellWidth: 64 }
    },
    {
      content: `III. ENFRIAMIENTO FINAL DE GRANO\n${fichaData.calcEnfriamientoFinalMin || 0} min\nAtemperado de Grano Post-Secadora`,
      styles: { fontStyle: "bold", fillColor: [30, 41, 59], textColor: [204, 251, 241], halign: "center", cellWidth: 64 }
    }
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [
      [
        {
          content: "4.3 CRONOGRAMA INTEGRAL Y TIEMPO TOTAL DE PROCESO DEL BATCH (Suma = T. Vaporizado + T. Secado + Enfriamiento Final Grano)",
          colSpan: 2,
          styles: { fillColor: [15, 23, 42], textColor: [252, 211, 77], fontStyle: "bold", halign: "left" }
        },
        {
          content: `TOTAL PROCESO:\n${formatMinToPdfText(fichaData.tiempoTotalProcesoBatchMin)}`,
          styles: { fillColor: [16, 185, 129], textColor: [15, 23, 42], fontStyle: "bold", halign: "center", fontSize: 8 }
        }
      ]
    ],
    body: [cronoCols as any],
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      cellPadding: 2.2,
      overflow: "linebreak",
      lineColor: [71, 85, 105],
      lineWidth: 0.2
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  if (currentY > pageHeight - 75) {
    doc.addPage();
    currentY = 12;
  }

  // =========================================================================
  // 5. RESUMEN SINTÉTICO DE VARIABLES & ENVASE PROYECTADO
  // =========================================================================
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [
      [
        {
          content: `5. RESUMEN SINTETICO DE VARIABLES DE COCCION & ENVASE PROYECTADO   |   Score Culinario: ${sanitizePdfLatinText(fichaData.puntajeCoccion)} / 100 pts (${sanitizePdfLatinText(fichaData.solturaGrano)})`,
          colSpan: 6,
          styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" }
        }
      ]
    ],
    body: [
      [
        {
          content: `Dosificacion Olla:\n${sanitizePdfLatinText(fichaData.tazasArroz)} tz Arroz / ${sanitizePdfLatinText(fichaData.tazasAgua)} tz Agua`,
          styles: { fontStyle: "bold", halign: "center", cellWidth: 32 }
        },
        {
          content: `Tiempo Coccion:\n${sanitizePdfLatinText(fichaData.tiempoCoccionOllaMin)} min`,
          styles: { fontStyle: "bold", halign: "center", textColor: [146, 64, 14], cellWidth: 32 }
        },
        {
          content: `Sabor / Aroma:\n${sanitizePdfLatinText(fichaData.saborCoccion)}`,
          styles: { fontStyle: "bold", halign: "center", textColor: [6, 95, 70], cellWidth: 32 }
        },
        {
          content: `Desplazamiento:\n${sanitizePdfLatinText(fichaData.desplazamientoSeg)}`,
          styles: { fontStyle: "bold", halign: "center", textColor: [14, 116, 144], cellWidth: 32 }
        },
        {
          content: `% Quebrado / Hinchado:\nQ: ${fichaData.granoQuebradoOllaPct}% | H: ${fichaData.granoHinchadoPct}%`,
          styles: { fontStyle: "bold", halign: "center", textColor: [146, 64, 14], cellWidth: 32 }
        },
        {
          content: `% Abierto / Textura Frio:\nAb: ${fichaData.granoAbiertoPct}% | ${sanitizePdfLatinText(fichaData.texturaFrio)}`,
          styles: { fontStyle: "bold", halign: "center", textColor: [6, 95, 70], cellWidth: 32 }
        }
      ],
      [
        {
          content: `ENVASE PROYECTADO DEL BATCH CERRADO (Determinado en Coccion):\n${sanitizePdfLatinText(fichaData.envaseProyectado)}\nDestino comercial aprobado segun rendimiento blanco (${fichaData.salRB}%), grano entero (${fichaData.salEntero}%), textura al frio (${sanitizePdfLatinText(fichaData.texturaFrio)}) y puntaje en olla (${fichaData.puntajeCoccion} pts).`,
          colSpan: 4,
          styles: { fillColor: [254, 243, 199], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 7.8 }
        },
        {
          content: "DICTAMEN DE CIERRE:\n[OK] APROBADO PARA ENVASADO",
          colSpan: 2,
          styles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", valign: "middle", fontSize: 8.2 }
        }
      ]
    ],
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.3,
      cellPadding: 2.2,
      overflow: "linebreak",
      lineColor: [148, 163, 184],
      lineWidth: 0.2
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // =========================================================================
  // OBSERVACIONES DE CIERRE Y SUSTENTO DE BALANZA
  // =========================================================================
  const obsTextoCompleto = fichaData.balanceSacas.sustentoObservacionAlarma
    ? `${sanitizePdfLatinText(fichaData.observacionesFinales)}\nSustento Balanza (+/-2%): "${sanitizePdfLatinText(fichaData.balanceSacas.sustentoObservacionAlarma)}"`
    : sanitizePdfLatinText(fichaData.observacionesFinales);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    body: [
      [
        {
          content: "OBSERVACIONES DE CIERRE DEL BATCH:",
          styles: { fontStyle: "bold", fillColor: [241, 245, 249], textColor: [51, 65, 85], cellWidth: 48 }
        },
        {
          content: obsTextoCompleto,
          styles: { fontStyle: "normal", textColor: [15, 23, 42], cellWidth: 144 }
        }
      ]
    ],
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.2,
      overflow: "linebreak",
      lineColor: [148, 163, 184],
      lineWidth: 0.2
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 16;

  if (currentY > pageHeight - 25) {
    doc.addPage();
    currentY = 28;
  }

  // =========================================================================
  // BLOQUE DE 3 FIRMAS DE CONFORMIDAD DE CIERRE
  // =========================================================================
  const colW = usableWidth / 3;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.35);

  // Líneas de firma
  doc.line(margin + 6, currentY, margin + colW - 6, currentY);
  doc.line(margin + colW + 6, currentY, margin + colW * 2 - 6, currentY);
  doc.line(margin + colW * 2 + 6, currentY, margin + usableWidth - 6, currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfLatinText(fichaData.operadorPlanta), margin + colW * 0.5, currentY + 4.2, { align: "center" });
  doc.text("Laboratorio de Calidad", margin + colW * 1.5, currentY + 4.2, { align: "center" });
  doc.text(sanitizePdfLatinText(fichaData.supervisorPlanta), margin + colW * 2.5, currentY + 4.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text("JEFE / OPERADOR DE VAPORIZADO", margin + colW * 0.5, currentY + 7.8, { align: "center" });
  doc.text("CONTROL DE CALIDAD & COCCION", margin + colW * 1.5, currentY + 7.8, { align: "center" });
  doc.text("V°B° CIERRE DE BATCH PLANTA", margin + colW * 2.5, currentY + 7.8, { align: "center" });

  // Numeración de páginas en pie de página
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Ficha Final de Batch Cerrado - ${sanitizePdfLatinText(fichaData.corr)} | Molino Don Julio S.A.C. | Pagina ${p} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 4,
      { align: "center" }
    );
  }

  const cleanBatchFile = String(fichaData.corr || "BATCH").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`FICHA_FINAL_BATCH_CERRADO_${cleanBatchFile}.pdf`);

  if (elementForPrint) {
    triggerCleanBrowserPrint(elementForPrint);
  }
}

