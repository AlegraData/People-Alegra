"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Check, Image as ImageIcon, Trash2, Info, GripVertical, AlignLeft, AlignCenter, AlignRight, AlignJustify, ChevronDown,
  Eye, FileText, Plus, ZoomIn, ZoomOut, Maximize2, Settings2, Type,
  Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Quote,
  IndentIncrease, IndentDecrease, Link2, X, Palette, Highlighter, RemoveFormatting,
} from "lucide-react";
import type { Evaluation360, CustomReportSection } from "@/types/evaluaciones360";
import { normalizeQuestions } from "@/types/evaluaciones360";
import type { ReportTemplateConfig, ReportTemplateDensity, CustomTextBox } from "@/lib/reportTemplateConfig";
import type { ReportBlockId } from "@/lib/reportTemplateConfig";
import { DEFAULT_TEMPLATE_CONFIG } from "@/lib/reportTemplateConfig";
import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";

interface Props {
  evaluation: Evaluation360;
}

interface EvaluateeOption {
  evaluateeEmail: string;
  evaluateeName: string;
}

const DENSITY_OPTIONS: { value: ReportTemplateDensity; label: string }[] = [
  { value: "compacto", label: "Compacto" },
  { value: "normal", label: "Normal" },
  { value: "amplio", label: "Amplio" },
];

const BLOCK_LABELS: Record<ReportBlockId, string> = {
  competencias: "Competencias analizadas",
  comparativos: "Comparativo de tus resultados",
  comportamientos: "Comportamientos evaluados (Fortalezas / Puntos de mejora)",
  ranking: "Resultados individuales por comportamiento",
  comentarios: "Comentarios",
};

const CATEGORY_ICON_OPTIONS: { value: string; label: string; file: string }[] = [
  { value: "compromiso", label: "Medalla", file: "compromiso.png" },
  { value: "conocimiento", label: "Herramientas", file: "conocimiento.png" },
  { value: "comunicacion", label: "Chat", file: "comunicacion.png" },
  { value: "trabajoEquipo", label: "Personas", file: "trabajo-equipo.png" },
];

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Utilidades genéricas de ruta sobre `config.copy`: en vez de una función
// "setXxxCopy" por cada campo (título/descripción/etiqueta de cada bloque —
// eran ~15 antes), un solo par get/set por ruta tipo "comparativos.team.desc".
// El shape de ReportCopyConfig es fijo y poco profundo, así que un `any`
// contenido acá es más simple y seguro que tipar un path genérico recursivo.
// "::" separa un prefijo de ruta normal de una clave dinámica (la única hoy:
// categoryDescriptions, indexado por el texto de la categoría, que puede
// traer espacios/tildes pero no “::”).
function getByPath(obj: unknown, segments: string[]): unknown {
  return segments.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}
function setByPath(obj: unknown, segments: string[], value: unknown): unknown {
  if (segments.length === 0) return value;
  const [head, ...rest] = segments;
  const record = (obj as Record<string, unknown> | undefined) ?? {};
  return { ...record, [head]: setByPath(record[head], rest, value) };
}

// ── Extensiones de Tiptap propias del reporte ───────────────────────────────
// Sangría e interlineado por párrafo — Tiptap no las trae de fábrica (a
// diferencia de negrita/color/listas). Ambas se guardan como `style` inline
// sobre el <p> (margin-left / line-height), así que el PDF real (Puppeteer)
// las respeta igual que la vista en vivo, sin CSS aparte. Se verificó con una
// prueba aislada que cuando las DOS aplican al mismo párrafo, Tiptap combina
// ambos `style` en uno solo (no se pisan entre sí), y que el HTML resultante
// se vuelve a leer correctamente (round-trip) al recargar la vista previa.
const INDENT_STEP = 24;
const MAX_INDENT = 6;

const IndentExtension = Extension.create({
  name: "reportIndent",
  addOptions() {
    return { types: ["paragraph"] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element: HTMLElement) => {
            const ml = parseFloat(element.style.marginLeft || "0");
            return ml > 0 ? Math.round(ml / INDENT_STEP) : 0;
          },
          renderHTML: (attributes: Record<string, unknown>) => {
            const level = attributes.indent as number;
            if (!level) return {};
            return { style: `margin-left: ${level * INDENT_STEP}px` };
          },
        },
      },
    }];
  },
});

const LineHeightExtension = Extension.create({
  name: "reportLineHeight",
  addOptions() {
    return { types: ["paragraph"] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
          renderHTML: (attributes: Record<string, unknown>) => {
            const lh = attributes.lineHeight as string | null;
            if (!lh) return {};
            return { style: `line-height: ${lh}` };
          },
        },
      },
    }];
  },
});

// Tamaño de letra: a diferencia de sangría/interlineado (atributos de todo
// el párrafo), el tamaño se aplica a la SELECCIÓN — por eso es un atributo
// de la marca "textStyle" (la misma que ya usa Color), no del nodo párrafo:
// permite agrandar solo una palabra dentro de una oración, y se combina con
// el color en el mismo <span> en vez de pisarlo (verificado en una prueba
// aislada: aplicar tamaño después de un color, o un color después de un
// tamaño, conserva ambos en el mismo elemento).
const FontSizeExtension = Extension.create({
  name: "reportFontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.fontSize || null,
          renderHTML: (attributes: Record<string, unknown>) => {
            const size = attributes.fontSize as string | null;
            if (!size) return {};
            return { style: `font-size: ${size}` };
          },
        },
      },
    }];
  },
});

const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40];

const RICH_EXTENSIONS = [
  StarterKit.configure({ heading: false, codeBlock: false }),
  UnderlineExtension,
  TextStyle,
  Color,
  FontSizeExtension,
  Highlight.configure({ multicolor: true }),
  LinkExtension.configure({ openOnClick: false }),
  IndentExtension,
  LineHeightExtension,
  TextAlign.configure({ types: ["paragraph"] }),
];

// ── Edición por arrastre sobre la vista previa en vivo ──────────────────────
// La vista previa en vivo carga el HTML real del reporte (mismo motor que el
// PDF final, ver `format:"html"` en el endpoint de preview) directamente en el
// iframe vía Blob URL — al ser mismo-origen, se puede alcanzar
// `iframe.contentDocument` sin postMessage. Las manijas se dibujan como divs
// superpuestos inyectados en ESE documento (no forman parte de la plantilla
// que se envía/descarga), y durante el arrastre solo se aplica un `transform`
// visual instantáneo; el valor real (que sí re-renderiza con el motor
// verdadero) se confirma al soltar el mouse.
function positionHandleAt(handle: HTMLElement, target: HTMLElement, corner: "top-right" | "bottom-right" | "top-left") {
  const doc = target.ownerDocument;
  const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;
  const rect = target.getBoundingClientRect();
  const top = (corner === "bottom-right" ? rect.bottom : rect.top) + scrollY - 10;
  const left = (corner === "top-left" ? rect.left : rect.right) - 10;
  handle.style.top = `${top}px`;
  handle.style.left = `${left}px`;
}

function createHandle(doc: Document, symbol: string, cursor: string): HTMLDivElement {
  const handle = doc.createElement("div");
  handle.textContent = symbol;
  handle.style.position = "absolute";
  handle.style.cursor = cursor;
  handle.style.fontSize = "11px";
  handle.style.lineHeight = "1";
  handle.style.width = "20px";
  handle.style.height = "20px";
  handle.style.display = "flex";
  handle.style.alignItems = "center";
  handle.style.justifyContent = "center";
  handle.style.background = "#00D6BC";
  handle.style.color = "#fff";
  handle.style.borderRadius = "9999px";
  handle.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
  handle.style.userSelect = "none";
  handle.style.zIndex = "9999";
  return handle;
}

// Arrastre libre (nudge x/y sobre la posición actual) — usado para el logo y,
// con baseX/baseY = x/y guardados, para reposicionar un cuadro de texto.
// `onDragStart`/`onDragEnd` marcan el intervalo de arrastre para que el
// refresco automático de la vista previa (debounce en el componente) no
// reemplace el iframe (y con él, los listeners de mousemove/mouseup ya
// atados al documento viejo) a mitad de un gesto en curso.
// `baseX`/`baseY` se guardan en variables locales (`curX`/`curY`), no solo
// como parámetros de la función, y se ACTUALIZAN en cada `onCommit` — si el
// admin arrastra, suelta, y vuelve a arrastrar de nuevo SIN que la vista
// previa llegue a recargar entre medio (recarga que sí trae un valor fresco
// desde `config`), un segundo arrastre que siguiera partiendo del valor de
// montaje original ignoraba por completo lo que el primer arrastre ya había
// movido — el segundo gesto "pisaba" al primero en vez de sumarse, y lo que
// quedaba guardado terminaba siendo el resultado de ESE cálculo equivocado
// (a veces cerca de 0 otra vez), no la posición donde se veía en pantalla.
function makeDraggable(target: HTMLElement, baseX: number, baseY: number, onCommit: (x: number, y: number) => void, corner: "top-right" | "top-left" = "top-right", onDragStart: () => void = () => {}, onDragEnd: () => void = () => {}) {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "✥", "grab");
  positionHandleAt(handle, target, corner);
  doc.body.appendChild(handle);

  let curX = baseX, curY = baseY;
  let startX = 0, startY = 0, dragging = false;
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const x = curX + (e.clientX - startX);
    const y = curY + (e.clientY - startY);
    target.style.transform = `translate(${x}px, ${y}px)`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    curX = Math.round(curX + (e.clientX - startX));
    curY = Math.round(curY + (e.clientY - startY));
    onDragEnd();
    onCommit(curX, curY);
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    onDragStart();
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

// Redimensionar arrastrando (feedback visual con `scale`, valor real confirmado al soltar).
// Mismo criterio que makeDraggable: `curValue` (no solo el parámetro
// `baseValue`) se actualiza en cada `onCommit` para que un segundo
// redimensionado sin recarga de por medio parta del valor real ya
// confirmado, no del de montaje.
function makeResizable(target: HTMLElement, baseValue: number, min: number, max: number, sensitivity: number, onCommit: (value: number) => void, onDragStart: () => void = () => {}, onDragEnd: () => void = () => {}) {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "⤡", "nwse-resize");
  positionHandleAt(handle, target, "bottom-right");
  doc.body.appendChild(handle);

  let curValue = baseValue;
  let startX = 0, dragging = false;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const delta = (e.clientX - startX) * sensitivity;
    const factor = clamp(curValue + delta) / curValue;
    target.style.transform = `scale(${factor})`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    target.style.transform = "";
    const delta = (e.clientX - startX) * sensitivity;
    curValue = Math.round(clamp(curValue + delta));
    onDragEnd();
    onCommit(curValue);
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    onDragStart();
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

// Redimensionar el ANCHO de un cuadro de texto: a diferencia de makeResizable
// (que aproxima con `scale` porque el valor real recalcula tamaños de fuente),
// el ancho es una propiedad de caja real — se aplica directo durante el
// arrastre (el texto reenvuelve en vivo con el ancho real, sin aproximación).
// Mismo criterio que makeDraggable/makeResizable sobre `curWidth`.
function makeWidthResizable(target: HTMLElement, baseWidth: number, min: number, max: number, onCommit: (width: number) => void, onDragStart: () => void = () => {}, onDragEnd: () => void = () => {}) {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "↔", "ew-resize");
  positionHandleAt(handle, target, "bottom-right");
  doc.body.appendChild(handle);

  let curWidth = baseWidth;
  let startX = 0, dragging = false;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    target.style.width = `${clamp(curWidth + (e.clientX - startX))}px`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    curWidth = Math.round(clamp(curWidth + (e.clientX - startX)));
    onDragEnd();
    onCommit(curWidth);
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    onDragStart();
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

// Margen horizontal de página (`layout.pageMarginX`) arrastrando una manija
// en el borde izquierdo de `.page` — mismo criterio que las demás manijas de
// arrastre (feedback visual instantáneo aplicando el padding real de `.page`,
// valor confirmado al soltar). El número del toolbar arriba sigue siendo la
// alternativa precisa; esto no lo reemplaza.
function makePageMarginXHandle(pageEl: HTMLElement, baseValue: number, min: number, max: number, onCommit: (value: number) => void, onDragStart: () => void, onDragEnd: () => void) {
  const doc = pageEl.ownerDocument;
  const handle = createHandle(doc, "↔", "ew-resize");
  const rect = pageEl.getBoundingClientRect();
  const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;
  handle.style.top = `${rect.top + scrollY + 40}px`;
  handle.style.left = `${rect.left - 10}px`;
  doc.body.appendChild(handle);

  let curValue = baseValue;
  let startX = 0, dragging = false;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const value = clamp(curValue + (e.clientX - startX));
    pageEl.style.paddingLeft = `${value}px`;
    pageEl.style.paddingRight = `${value}px`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    curValue = Math.round(clamp(curValue + (e.clientX - startX)));
    onDragEnd();
    onCommit(curValue);
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    onDragStart();
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

// Manija de color anclada junto a un elemento representativo que ya usa ese
// color en el documento (ej. la primera barra "Tú" del comparativo → primary,
// el borde de una tarjeta → cardBorder) — abre el mismo `<input type="color">`
// nativo que ya dispara `setColor()` desde el toolbar de arriba; ese swatch
// del toolbar se deja intacto como alternativa más precisa/visible.
function makeColorHandle(doc: Document, anchorEl: HTMLElement, corner: "top-right" | "top-left" | "bottom-right", currentColor: string, title: string, onCommit: (value: string) => void) {
  const input = doc.createElement("input");
  input.type = "color";
  input.value = currentColor;
  input.title = title;
  input.style.cssText = "position:absolute;width:20px;height:20px;padding:0;border:2px solid #fff;border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;z-index:9999;";
  positionHandleAt(input, anchorEl, corner);
  input.addEventListener("mousedown", (e) => e.stopPropagation());
  input.addEventListener("input", (e) => onCommit((e.target as HTMLInputElement).value));
  doc.body.appendChild(input);
}

// Manija de borrado (clic simple, no arrastre) para un cuadro de texto.
function makeDeletable(target: HTMLElement, onDelete: () => void) {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "✕", "pointer");
  handle.style.background = "#ef4444";
  positionHandleAt(handle, target, "top-right");
  doc.body.appendChild(handle);
  handle.addEventListener("mousedown", (e) => e.stopPropagation());
  handle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  });
}

// Párrafos completamente vacíos al principio/final de un texto (ej. Enter
// varias veces antes/después de un título, usado como truco para "agregar
// espacio") se recortan al confirmar la edición. Tiptap/ProseMirror
// serializa un párrafo vacío como `<p></p>` — pero ese mismo `<p></p>`, leído
// por Tiptap al remontar la vista en vivo, no necesariamente mide igual que
// el navegador normal que arma el PDF real (que nunca pasa por Tiptap, solo
// interpreta el HTML crudo tal cual): la técnica de "líneas en blanco para
// separar" nunca va a verse idéntica entre los dos paneles, así que ni
// siquiera se guarda.
function stripEmptyEdgeParagraphs(html: string): string {
  const emptyP = /^\s*(<p>(\s|<br\s*\/?>)*<\/p>\s*)+/i;
  const emptyPEnd = /(\s*<p>(\s|<br\s*\/?>)*<\/p>)+\s*$/i;
  return html.replace(emptyP, "").replace(emptyPEnd, "");
}

export interface ActiveRichField {
  kind: "copy" | "textbox";
  key: string;
  editor: Editor;
  initialHtml: string;
}

// Todo texto editable del reporte (títulos, párrafos, etiquetas de gráficas,
// cuadros de texto libre — nunca los datos ya renderizados: puntajes,
// comentarios de la encuesta, nombres) se edita en línea con Tiptap — pero
// SOLO mientras se está editando activamente. En reposo, `el` (el elemento
// real, tal cual lo armó el servidor) nunca se toca: ni se vacía, ni pasa
// por el motor de Tiptap/ProseMirror. Antes el editor se montaba una sola
// vez, apenas cargaba la página, y se quedaba viviendo ahí para siempre — lo
// que significaba que TODO campo de texto, se editara o no, quedaba
// re-armado por ProseMirror en vez de mostrarse tal cual vino del servidor.
// Se detectaron dos casos reales donde ese re-armado terminaba midiendo
// distinto que un navegador normal leyendo el mismo HTML sin pasar por
// Tiptap (que es exactamente lo que hace el PDF real): párrafos vacíos como
// truco de espaciado, y un `<span style="font-size:...">` con
// `text-align:justify` adentro. Cualquier otro caso similar que apareciera
// después iba a tener el mismo problema — por eso se cambió el mecanismo de
// raíz en vez de seguir parchando caso por caso.
// Al hacer clic, se monta Tiptap sobre un CLON hermano (mismas clases/estilo
// que `el`, para no alterar el layout mientras se edita) y `el` se oculta;
// al perder el foco, el clon se destruye y `el` reaparece — con su HTML
// crudo de siempre si no hubo cambios, o esperando el próximo commit/recarga
// si sí los hubo. El costo: el cursor no cae exactamente donde se hizo clic
// (arranca al final del texto) — antes sí, porque el campo ya era un editor
// activo todo el tiempo.
function mountRichEditor(
  el: HTMLElement,
  kind: "copy" | "textbox",
  key: string,
  onCommit: (html: string) => void,
  onFieldActivate: (field: ActiveRichField) => void,
  forceToolbarUpdate: () => void,
  onFieldDeactivate: (kind: "copy" | "textbox", key: string) => void,
  shouldSkipBlur: () => boolean
) {
  el.style.cursor = "text";
  el.style.minHeight = "1.3em";

  function onMouseDown(e: MouseEvent) {
    e.preventDefault();
    el.removeEventListener("mousedown", onMouseDown);
    activate();
  }

  function activate() {
    // Recién ahora, al entrar a editar — nunca antes — se lee `data-raw` (la
    // plantilla SIN interpolar, con sus {{placeholders}} intactos): si el
    // admin editaba, por ejemplo, el saludo mientras previsualizaba a
    // "María", partir del valor YA resuelto ("¡Hola, María!") guardaba eso
    // literal, matando el placeholder para siempre — el reporte de
    // cualquier otra persona pasaba a saludar también "María". "textbox" no
    // tiene interpolación (no hay data-raw), así que ahí es igual al HTML real.
    const rawHtml = kind === "copy" ? (el.getAttribute("data-raw") ?? el.innerHTML) : el.innerHTML;

    const editableEl = el.cloneNode(false) as HTMLElement;
    editableEl.removeAttribute("data-edit-copy");
    editableEl.removeAttribute("data-edit-textbox");
    editableEl.style.outline = "none";
    editableEl.style.cursor = "text";
    editableEl.style.minHeight = "1.3em";
    el.style.display = "none";
    el.parentElement?.insertBefore(editableEl, el);

    const editor = new Editor({
      element: editableEl,
      extensions: RICH_EXTENSIONS,
      content: rawHtml,
      // NO se usa la opción `autofocus`: Tiptap la corre adentro de un
      // `window.setTimeout(..., 0)` (ver mount() en @tiptap/core), es decir,
      // en una tarea aparte — DESPUÉS de que termine el gesto de clic
      // completo (mousedown→mouseup→click) que disparó `activate()`. El
      // resultado: justo al terminar de hacer clic, nada quedaba realmente
      // enfocado todavía, y la barra de herramientas nunca se activaba. Se
      // llama `.commands.focus()` directo más abajo, sincrónico, en el mismo
      // gesto.
      onFocus: () => {
        onFieldActivate({ kind, key, editor, initialHtml: rawHtml });
        forceToolbarUpdate();
      },
      onBlur: () => {
        // Un <select>/<input> de la barra de formato (Tamaño, Interlineado,
        // color) necesita tomar foco de verdad para poder abrirse — eso
        // dispara este blur igual que si el admin hubiera hecho clic afuera,
        // aunque en realidad sigue "editando" (va a volver con
        // `.chain().focus()...run()` en cuanto aplique el cambio). No
        // destruir nada en ese caso: se sigue mostrando el mismo editor tal
        // cual, a la espera de que la barra lo vuelva a enfocar.
        if (shouldSkipBlur()) return;
        const html = stripEmptyEdgeParagraphs(editor.getHTML());
        const changed = html !== rawHtml;
        editor.destroy();
        editableEl.remove();
        if (changed) {
          // `el` es lo único visible en reposo — sin esto, quedaba mostrando
          // el contenido VIEJO (de antes del cambio) hasta la próxima
          // recarga completa del iframe, dando la impresión de que la
          // edición "no se guardó" aunque sí había quedado aplicada en
          // `config`. Para "copy" también se actualiza `data-raw`: si el
          // admin vuelve a hacer clic en este mismo campo ANTES de que
          // llegue una recarga, debe partir de este edición recién hecha,
          // no de la original con la que cargó la página.
          el.innerHTML = html;
          if (kind === "copy") el.setAttribute("data-raw", html);
        }
        el.style.display = "";
        el.addEventListener("mousedown", onMouseDown);
        onFieldDeactivate(kind, key);
        // Sin esto, la barra de formato (RichToolbar) seguía "viendo" el
        // editor recién destruido hasta que algo MÁS disparara un re-render
        // — cualquier botón que se tocara mientras tanto (ej. Interlineado)
        // operaba sobre una instancia muerta y no hacía nada visible.
        forceToolbarUpdate();
        if (changed) onCommit(html);
      },
      onSelectionUpdate: () => forceToolbarUpdate(),
      onTransaction: () => forceToolbarUpdate(),
    });
    editor.commands.focus("end");
  }

  el.addEventListener("mousedown", onMouseDown);
}

// Bloques `[data-edit-block]` presentes en el documento, en orden visual
// (top a bottom), sin duplicados — un bloque puede repetir su wrapper más de
// una vez si el admin llegó a duplicar contenido a mano, se cuenta solo el
// primero. Reutilizado tanto por la manija de tamaño de letra como por la de
// reordenar arrastrando.
function getOrderedBlockEls(doc: Document): { id: ReportBlockId; el: HTMLElement }[] {
  const seen = new Set<ReportBlockId>();
  const result: { id: ReportBlockId; el: HTMLElement }[] = [];
  doc.querySelectorAll<HTMLElement>("[data-edit-block]").forEach((el) => {
    const id = el.getAttribute("data-edit-block") as ReportBlockId;
    if (seen.has(id)) return;
    seen.add(id);
    result.push({ id, el });
  });
  return result;
}

// Reordenar un bloque arrastrándolo directo sobre la vista en vivo — misma
// idea que el panel "Orden y tamaños" (handleDrop en el componente), pero
// sobre el documento real: mientras se arrastra, se dibuja una línea de
// inserción entre los otros bloques a medida que el cursor cruza el punto
// medio de cada uno; al soltar, se calcula el nuevo orden y se confirma con
// `onCommitOrder` — el panel de arriba queda intacto como alternativa.
function makeBlockReorderable(
  doc: Document,
  handle: HTMLElement,
  blockId: ReportBlockId,
  onCommitOrder: (order: ReportBlockId[]) => void,
  onDragStart: () => void,
  onDragEnd: () => void
) {
  let dragging = false;
  let indicator: HTMLDivElement | null = null;
  let lastTarget: { id: ReportBlockId; before: boolean } | null = null;

  function clearIndicator() {
    indicator?.remove();
    indicator = null;
  }

  function showIndicatorAt(targetEl: HTMLElement, before: boolean) {
    clearIndicator();
    indicator = doc.createElement("div");
    indicator.setAttribute("data-page-guide", "1"); // reutiliza el mismo filtro de "no medible / no persistente" que las guías de paginación
    indicator.style.cssText = "height:3px;background:#00D6BC;border-radius:2px;margin:2px 0;pointer-events:none;";
    targetEl.parentElement?.insertBefore(indicator, before ? targetEl : targetEl.nextSibling);
  }

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const blocks = getOrderedBlockEls(doc).filter((b) => b.id !== blockId);
    const y = e.clientY;
    const hit = blocks.find((b) => y < b.el.getBoundingClientRect().top + b.el.getBoundingClientRect().height / 2);
    if (hit) {
      showIndicatorAt(hit.el, true);
      lastTarget = { id: hit.id, before: true };
    } else if (blocks.length > 0) {
      const last = blocks[blocks.length - 1];
      showIndicatorAt(last.el, false);
      lastTarget = { id: last.id, before: false };
    }
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    clearIndicator();
    onDragEnd();
    if (lastTarget) {
      const order = getOrderedBlockEls(doc).map((b) => b.id);
      const from = order.indexOf(blockId);
      if (from !== -1) {
        order.splice(from, 1);
        const to = order.indexOf(lastTarget.id);
        if (to !== -1) {
          order.splice(lastTarget.before ? to : to + 1, 0, blockId);
          onCommitOrder(order);
        }
      }
    }
    lastTarget = null;
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    onDragStart();
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

function attachEditHandles(
  doc: Document,
  config: ReportTemplateConfig,
  setLogoOffset: (x: number, y: number) => void,
  setCompetenciasIconSize: (px: number) => void,
  setBlockFontScalePct: (block: ReportBlockId, pct: number) => void,
  setBlocksOrder: (order: ReportBlockId[]) => void,
  setPageMarginX: (value: number) => void,
  setColorValue: (key: keyof ReportTemplateConfig["colors"], value: string) => void,
  updateTextBox: (id: string, patch: Partial<CustomTextBox>) => void,
  removeTextBox: (id: string) => void,
  updateCopyByPath: (path: string, value: string) => void,
  commitSectionField: (sectionId: string, field: "name" | "description", value: string) => void,
  onEditStart: () => void,
  onEditEnd: () => void,
  onFieldActivate: (field: ActiveRichField) => void,
  forceToolbarUpdate: () => void,
  onFieldDeactivate: (kind: "copy" | "textbox", key: string) => void,
  shouldSkipBlur: () => boolean
) {
  // Cada manija se instala en su propio try/catch: si UNA falla por algo
  // específico de estos datos (ej. un elemento inesperado), las demás —
  // incluida la más importante, montar Tiptap sobre el texto editable más
  // abajo — no deben quedar canceladas en cadena. Antes, un solo error acá
  // (todo corre sync, uno detrás de otro) abortaba silenciosamente TODO lo
  // que seguía en esta función, sin ningún aviso en pantalla.
  function safely(label: string, fn: () => void) {
    try {
      fn();
    } catch (err) {
      console.error(`[EvalReportTemplateEditor] fallo instalando "${label}":`, err);
    }
  }

  safely("logo", () => {
    const logoEl = doc.querySelector<HTMLElement>('[data-edit="logo"]');
    if (logoEl) makeDraggable(logoEl, config.logo.headerOffsetX, config.logo.headerOffsetY, setLogoOffset, "top-right", onEditStart, onEditEnd);
  });

  const pageEl = doc.querySelector<HTMLElement>(".page");
  safely("margen horizontal", () => {
    if (pageEl) makePageMarginXHandle(pageEl, config.layout.pageMarginX, 0, 80, setPageMarginX, onEditStart, onEditEnd);
  });

  // Manijas de color ancladas a un elemento representativo ya visible — no
  // requieren tocar `eval360ReportTemplate.ts`: se reutilizan selectores que
  // ya existen (la primera barra "Tú" de un gráfico, el saludo/subtítulo del
  // encabezado, la primera tarjeta). `primaryDark` no tiene un elemento
  // representativo estable (solo aparece en el wordmark de respaldo cuando no
  // hay logo subido) — se deja fuera, el swatch del toolbar sigue siendo la
  // única vía para ese color.
  safely("manijas de color", () => {
    const firstBarEl = doc.querySelector<HTMLElement>("svg rect");
    if (firstBarEl) makeColorHandle(doc, firstBarEl, "top-right", config.colors.primary, "Color primario (barras/acentos)", (v) => setColorValue("primary", v));
    const greetingEl = doc.querySelector<HTMLElement>('[data-edit-copy="header.greeting"]');
    if (greetingEl) makeColorHandle(doc, greetingEl, "top-right", config.colors.text, "Color de texto principal", (v) => setColorValue("text", v));
    const subtitleEl = doc.querySelector<HTMLElement>('[data-edit-copy="header.subtitle"]');
    if (subtitleEl) makeColorHandle(doc, subtitleEl, "top-right", config.colors.textSecondary, "Color de texto secundario", (v) => setColorValue("textSecondary", v));
    const firstCardEl = doc.querySelector<HTMLElement>(".card");
    if (firstCardEl) makeColorHandle(doc, firstCardEl, "top-left", config.colors.cardBorder, "Color de borde de tarjetas", (v) => setColorValue("cardBorder", v));
    if (pageEl) makeColorHandle(doc, pageEl, "top-right", config.colors.background, "Color de fondo de página", (v) => setColorValue("background", v));
  });

  safely("ícono de competencias", () => {
    const iconEl = doc.querySelector<HTMLElement>('[data-edit="icon"]');
    if (iconEl) makeResizable(iconEl, config.blocks.competencias.iconSize, 12, 40, 0.15, setCompetenciasIconSize, onEditStart, onEditEnd);
  });

  // Una manija por bloque (no por fragmento — ver getOrderedBlockEls): tamaño
  // de letra en la esquina inferior-derecha (ya existía) y arrastre para
  // reordenar en la superior-izquierda (nuevo, misma idea que el panel
  // "Orden y tamaños" pero directo sobre el documento). Cada bloque aparte,
  // para que uno con datos raros no tumbe la manija de los demás.
  getOrderedBlockEls(doc).forEach(({ id: blockId, el: blockEl }) => {
    safely(`bloque ${blockId}`, () => {
      const scaleConfig = config.blocks[blockId];
      const currentPct = Math.round((scaleConfig?.fontScale ?? 1) * 100);
      makeResizable(blockEl, currentPct, 70, 150, 0.3, (pct) => setBlockFontScalePct(blockId, pct), onEditStart, onEditEnd);

      const gripHandle = createHandle(doc, "✥", "grab");
      positionHandleAt(gripHandle, blockEl, "top-left");
      doc.body.appendChild(gripHandle);
      makeBlockReorderable(doc, gripHandle, blockId, setBlocksOrder, onEditStart, onEditEnd);
    });
  });

  doc.querySelectorAll<HTMLElement>("[data-edit-textbox]").forEach((boxEl) => {
    safely("cuadro de texto libre", () => {
      const id = boxEl.getAttribute("data-edit-textbox")!;
      const box = config.customTextBoxes.find((b) => b.id === id);
      if (!box) return;

      makeDraggable(boxEl, box.x, box.y, (x, y) => updateTextBox(id, { x, y }), "top-left", onEditStart, onEditEnd);
      makeWidthResizable(boxEl, box.width, 60, 700, (width) => updateTextBox(id, { width }), onEditStart, onEditEnd);
      makeDeletable(boxEl, () => removeTextBox(id));

      mountRichEditor(boxEl, "textbox", id, (html) => updateTextBox(id, { text: html }), onFieldActivate, forceToolbarUpdate, onFieldDeactivate, shouldSkipBlur);
    });
  });

  // Todo el texto "de copy" de la plantilla (títulos, descripciones,
  // etiquetas — no los datos ya renderizados como puntajes/nombres/gráficos)
  // se edita en línea con la misma mecánica, sin distinción entre títulos
  // cortos y párrafos largos — ambos usan Tiptap por igual, controlados
  // desde la misma barra superior. `data-raw` guarda la plantilla SIN
  // interpolar (con sus {{placeholders}} intactos, si tiene): es lo que se
  // carga en el editor, para poder tocar el placeholder en vez del valor ya
  // resuelto de esta preview puntual.
  doc.querySelectorAll<HTMLElement>("[data-edit-copy]").forEach((el) => {
    safely("texto editable", () => {
      const path = el.getAttribute("data-edit-copy");
      if (!path) return;
      // "section.<id>.<campo>" es dato por encuesta (secciones personalizadas
      // de análisis, ej. "Alineación Cultural"), no de la plantilla global —
      // se guarda aparte, contra `report-sections`, no contra `config.copy`.
      const sectionMatch = path.match(/^section\.([^.]+)\.(name|description)$/);
      const onCommit = sectionMatch
        ? (html: string) => commitSectionField(sectionMatch[1], sectionMatch[2] as "name" | "description", html)
        : (html: string) => updateCopyByPath(path, html);
      mountRichEditor(el, "copy", path, onCommit, onFieldActivate, forceToolbarUpdate, onFieldDeactivate, shouldSkipBlur);
    });
  });
}

// ── Barra de herramientas persistente ────────────────────────────────────
// Vive en el documento PADRE (no dentro del iframe) y siempre está visible
// arriba de la vista previa — no es un tooltip que aparece/desaparece por
// campo. Actúa sobre `activeField.editor`, que es el editor de Tiptap del
// último campo que tuvo el foco dentro del iframe (ver onFieldActivate);
// como Tiptap restaura foco Y selección con `.chain().focus()` incluso
// cruzando la frontera del iframe (verificado en una prueba aislada), un
// clic acá no necesita mantener el foco en el campo para funcionar.
function ToolBtn({ onClick, active, disabled, title, children }: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${active ? "bg-primary/10 text-primary" : "text-[#64748b] hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-slate-200 mx-1" />;
}

function RichToolbar({ activeField }: { activeField: ActiveRichField | null }) {
  const editor = activeField?.editor ?? null;
  const disabled = !editor;
  const isActive = (name: string, attrs?: Record<string, unknown>) => (editor ? editor.isActive(name, attrs) : false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const currentIndent = editor?.getAttributes("paragraph").indent ?? 0;
  const currentLineHeight = (editor?.getAttributes("paragraph").lineHeight as string | null) ?? "";
  const currentColor = (editor?.getAttributes("textStyle").color as string | undefined) ?? "#1e293b";
  const currentHighlight = (editor?.getAttributes("highlight").color as string | undefined) ?? "#ffffff";
  const currentFontSize = (editor?.getAttributes("textStyle").fontSize as string | null) ?? "";
  const currentAlign = (editor?.getAttributes("paragraph").textAlign as string | null) ?? "left";

  function openLink() {
    if (!editor) return;
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setShowLink(true);
  }
  function applyLink() {
    if (!editor) return;
    if (linkUrl.trim()) editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    else editor.chain().focus().unsetLink().run();
    setShowLink(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 py-2 flex flex-wrap items-center gap-1 relative">
      <ToolBtn title="Negrita" disabled={disabled} active={isActive("bold")} onClick={() => editor!.chain().focus().toggleBold().run()}><BoldIcon className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Cursiva" disabled={disabled} active={isActive("italic")} onClick={() => editor!.chain().focus().toggleItalic().run()}><ItalicIcon className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Subrayado" disabled={disabled} active={isActive("underline")} onClick={() => editor!.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Tachado" disabled={disabled} active={isActive("strike")} onClick={() => editor!.chain().focus().toggleStrike().run()}><Strikethrough className="w-3.5 h-3.5" /></ToolBtn>

      <ToolbarSep />

      <select
        title="Tamaño de letra — aplica a la selección (una palabra, una frase o todo el texto)"
        disabled={disabled}
        value={currentFontSize.replace("px", "")}
        onChange={(e) => editor?.chain().focus().setMark("textStyle", { fontSize: e.target.value ? `${e.target.value}px` : null }).run()}
        className="h-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-1.5 outline-none focus:border-primary cursor-pointer disabled:opacity-30"
      >
        <option value="">Tamaño</option>
        {FONT_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}px</option>)}
      </select>

      <ToolbarSep />

      <div className="relative flex items-center">
        <label className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-slate-100 ${disabled ? "opacity-30 pointer-events-none" : ""}`} title="Color de texto">
          <Palette className="w-3.5 h-3.5 text-[#64748b]" />
          <input
            type="color" value={currentColor} disabled={disabled}
            onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
      </div>
      <ToolBtn title="Quitar color de texto" disabled={disabled} onClick={() => editor!.chain().focus().unsetColor().run()}><X className="w-3 h-3" /></ToolBtn>

      <div className="relative flex items-center">
        <label className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-slate-100 ${disabled ? "opacity-30 pointer-events-none" : ""}`} title="Color de resaltado">
          <Highlighter className="w-3.5 h-3.5 text-[#64748b]" />
          <input
            type="color" value={currentHighlight} disabled={disabled}
            onChange={(e) => editor?.chain().focus().setHighlight({ color: e.target.value }).run()}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
      </div>
      <ToolBtn title="Quitar resaltado" disabled={disabled} onClick={() => editor!.chain().focus().unsetHighlight().run()}><X className="w-3 h-3" /></ToolBtn>

      <ToolbarSep />

      <ToolBtn title="Alinear a la izquierda" disabled={disabled} active={currentAlign === "left"} onClick={() => editor!.chain().focus().setTextAlign("left").run()}><AlignLeft className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Centrar" disabled={disabled} active={currentAlign === "center"} onClick={() => editor!.chain().focus().setTextAlign("center").run()}><AlignCenter className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Alinear a la derecha" disabled={disabled} active={currentAlign === "right"} onClick={() => editor!.chain().focus().setTextAlign("right").run()}><AlignRight className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Justificar" disabled={disabled} active={currentAlign === "justify"} onClick={() => editor!.chain().focus().setTextAlign("justify").run()}><AlignJustify className="w-3.5 h-3.5" /></ToolBtn>

      <ToolbarSep />

      <ToolBtn title="Lista con viñetas" disabled={disabled} active={isActive("bulletList")} onClick={() => editor!.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Lista numerada" disabled={disabled} active={isActive("orderedList")} onClick={() => editor!.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Cita" disabled={disabled} active={isActive("blockquote")} onClick={() => editor!.chain().focus().toggleBlockquote().run()}><Quote className="w-3.5 h-3.5" /></ToolBtn>

      <ToolbarSep />

      <ToolBtn
        title="Reducir sangría"
        disabled={disabled || currentIndent <= 0}
        onClick={() => editor!.chain().focus().updateAttributes("paragraph", { indent: Math.max(0, currentIndent - 1) }).run()}
      >
        <IndentDecrease className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        title="Aumentar sangría"
        disabled={disabled || currentIndent >= MAX_INDENT}
        onClick={() => editor!.chain().focus().updateAttributes("paragraph", { indent: Math.min(MAX_INDENT, currentIndent + 1) }).run()}
      >
        <IndentIncrease className="w-3.5 h-3.5" />
      </ToolBtn>

      <select
        title="Interlineado"
        disabled={disabled}
        value={currentLineHeight}
        onChange={(e) => editor?.chain().focus().updateAttributes("paragraph", { lineHeight: e.target.value || null }).run()}
        className="h-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-1.5 outline-none focus:border-primary cursor-pointer disabled:opacity-30"
      >
        <option value="">Interlineado</option>
        <option value="1">1.0</option>
        <option value="1.15">1.15</option>
        <option value="1.5">1.5</option>
        <option value="2">2.0</option>
      </select>

      <ToolbarSep />

      <ToolBtn title="Enlace" disabled={disabled} active={isActive("link")} onClick={openLink}><Link2 className="w-3.5 h-3.5" /></ToolBtn>
      <ToolBtn title="Limpiar formato" disabled={disabled} onClick={() => editor!.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="w-3.5 h-3.5" /></ToolBtn>

      {showLink && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-2 flex items-center gap-1.5">
          <input
            autoFocus type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..." onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setShowLink(false); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary w-56"
          />
          <button onClick={applyLink} className="text-xs font-bold text-primary px-2 py-1 hover:bg-primary/5 rounded-lg">Aplicar</button>
          <button onClick={() => setShowLink(false)} className="text-xs font-bold text-[#94a3b8] px-2 py-1 hover:bg-slate-50 rounded-lg">Cancelar</button>
        </div>
      )}

      {!editor && <span className="text-[11px] text-[#94a3b8] ml-1">Haz clic en cualquier texto de la vista previa para editarlo</span>}
    </div>
  );
}

export default function EvalReportTemplateEditor({ evaluation }: Props) {
  const [config, setConfig] = useState<ReportTemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [evaluatees, setEvaluatees] = useState<EvaluateeOption[]>([]);
  const [evaluateeEmail, setEvaluateeEmail] = useState("");

  // Secciones personalizadas de análisis (ej. "Alineación Cultural") — dato
  // por encuesta, no de la plantilla global (`config`), por eso viven en su
  // propio estado en vez de `config.copy`. Editar la descripción de una en
  // vivo (ver `commitSectionField`) guarda de inmediato contra el endpoint de
  // `report-sections`, no contra "Guardar plantilla".
  const [reportSections, setReportSections] = useState<CustomReportSection[]>(evaluation.reportSections);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Alto real del documento paginado (varias hojas A4 apiladas) — el iframe
  // se dimensiona a esto para que el contenedor de afuera pueda scrollear una
  // sola vez y se vean los bordes/gaps entre hojas, en vez de que el iframe
  // recorte todo a una ventana fija de 600px sin scroll visible.
  const [liveIframeHeight, setLiveIframeHeight] = useState(1200);
  // Ancho fijo de "una hoja" (px, ~A4) — la vista en vivo ya no pagina (ver
  // por qué en report-template/preview/route.ts), así que no hay nada que
  // medir: el iframe siempre se ve con este ancho, y el alto crece libre
  // según el contenido real (liveIframeHeight).
  const pageWidthPx = 794;
  const [zoom, setZoom] = useState(1);
  const hasAutoFitRef = useRef(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  // Posición de scroll del panel de vista previa, capturada justo antes de
  // que el iframe se recargue (nueva vista previa) y restaurada una vez la
  // nueva hoja termina de cargar — sin esto, cada edición (aunque el texto sí
  // se guardara bien) hacía que el scroll saltara al inicio del documento en
  // cuanto terminaba el "cargando", como si todo hubiera vuelto a como estaba.
  const savedScrollRef = useRef(0);

  // El PDF real (paginación exacta, mismo motor que el reporte final) se
  // muestra siempre lado a lado con la vista editable — antes solo se
  // generaba bajo demanda (un botón) porque cada render lanzaba un Chromium
  // nuevo; ahora que el browser se reutiliza entre requests (ver
  // pdfBrowser.ts), se refresca solo en cada pausa de edición (ver el efecto
  // de debounce más abajo), casi en tiempo real.
  const [realPdfUrl, setRealPdfUrl] = useState<string | null>(null);
  const [realPdfLoading, setRealPdfLoading] = useState(false);
  const realPdfUrlRef = useRef<string | null>(null);
  const realPdfRequestIdRef = useRef(0);

  const [openBlock, setOpenBlock] = useState<ReportBlockId | null>(null);
  const dragIdRef = useRef<ReportBlockId | null>(null);
  // Paneles expandibles de la franja superior (no son popovers flotantes:
  // simplemente empujan el contenido de abajo, más simple y sin necesitar
  // lógica de "click afuera para cerrar").
  const [showBlocksPanel, setShowBlocksPanel] = useState(false);
  const [showTextBoxPanel, setShowTextBoxPanel] = useState(false);

  // true mientras el admin está a mitad de un arrastre/resize dentro del
  // iframe (logo, cuadro de texto, tamaño de bloque) — el refresco automático
  // de la vista previa espera a que esto vuelva a false antes de recargar
  // (ver el efecto de debounce más abajo), para no reemplazar el iframe (y
  // perder lo que todavía no se confirmó con el mouseup) a mitad de un gesto.
  const isEditingRef = useRef(false);
  const onEditStart = useCallback(() => { isEditingRef.current = true; }, []);
  const onEditEnd = useCallback(() => { isEditingRef.current = false; }, []);

  // Campo con foco (o el último que lo tuvo) dentro de la vista previa — la
  // barra de herramientas persistente (RichToolbar) actúa sobre su editor.
  // Es una ref (no un estado) porque cambia en cada focus/selección, mucho
  // más seguido de lo que conviene disparar un re-render completo del
  // componente; `toolbarTick` es el único estado que fuerza a la barra a
  // releerla y refrescar sus botones "activos".
  const activeFieldRef = useRef<ActiveRichField | null>(null);
  const [toolbarTick, setToolbarTick] = useState(0);
  const forceToolbarUpdate = useCallback(() => setToolbarTick((t) => t + 1), []);
  const onFieldActivate = useCallback((field: ActiveRichField) => { activeFieldRef.current = field; }, []);
  // Tiptap ahora se destruye al perder el foco (ver mountRichEditor) — sin
  // esto, `activeFieldRef` seguía apuntando al editor ya destruido para
  // siempre (nunca se limpiaba), y `flushActiveField` podía intentar llamar
  // `.getHTML()` sobre una instancia muerta. Solo limpia si el campo que se
  // desactiva es efectivamente el que seguía activo (evita pisar un campo
  // B recién activado si el blur de A, por lo que sea, corre después).
  const onFieldDeactivate = useCallback((kind: "copy" | "textbox", key: string) => {
    if (activeFieldRef.current?.kind === kind && activeFieldRef.current?.key === key) {
      activeFieldRef.current = null;
    }
  }, []);
  // true mientras el foco está en algún control de la barra de formato (ej.
  // los <select> de "Tamaño"/"Interlineado", o el <input type=color>) — a
  // diferencia de los botones (ToolBtn), que evitan tomar foco con
  // preventDefault en mousedown, un <select>/<input> SÍ necesita el foco
  // para poder abrirse — eso dispara un blur real sobre el editor de Tiptap
  // dentro del iframe. Sin esto, ese blur lo destruía (ver mountRichEditor)
  // antes de que el propio control alcanzara a aplicar el cambio con
  // `editor.chain().focus()...run()` — la paleta quedaba deshabilitada justo
  // al intentar usarla. Se limpia solo cuando el foco sale de la barra por
  // completo (no al moverse de un control de la barra a otro).
  const isToolbarInteractionRef = useRef(false);
  const toolbarContainerRef = useRef<HTMLDivElement>(null);
  const shouldSkipBlur = useCallback(() => isToolbarInteractionRef.current, []);

  // Categorías reales de esta encuesta (para el mapeo de íconos del bloque "Competencias")
  const categories = useMemo(() => {
    const questionsMap = normalizeQuestions(evaluation.questions as unknown);
    const set = new Set<string>();
    (["ascendente", "descendente", "paralela"] as const).forEach((type) =>
      (questionsMap[type] ?? []).filter((q) => q.type === "rating").forEach((q) => { if (q.category) set.add(q.category); })
    );
    return [...set];
  }, [evaluation.questions]);

  // Cargar config guardada
  useEffect(() => {
    fetch("/api/evaluaciones360/report-template")
      .then((r) => r.json())
      .then((d) => setConfig({
        ...DEFAULT_TEMPLATE_CONFIG, ...d,
        colors: { ...DEFAULT_TEMPLATE_CONFIG.colors, ...d.colors },
        logo: { ...DEFAULT_TEMPLATE_CONFIG.logo, ...d.logo },
        layout: { ...DEFAULT_TEMPLATE_CONFIG.layout, ...d.layout },
        blocks: {
          order: d.blocks?.order?.length ? d.blocks.order : DEFAULT_TEMPLATE_CONFIG.blocks.order,
          competencias: { ...DEFAULT_TEMPLATE_CONFIG.blocks.competencias, ...d.blocks?.competencias, categoryIcons: { ...d.blocks?.competencias?.categoryIcons } },
          comparativos: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comparativos, ...d.blocks?.comparativos },
          comportamientos: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comportamientos, ...d.blocks?.comportamientos },
          ranking: { ...DEFAULT_TEMPLATE_CONFIG.blocks.ranking, ...d.blocks?.ranking },
          comentarios: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comentarios, ...d.blocks?.comentarios },
        },
        copy: {
          header: { ...DEFAULT_TEMPLATE_CONFIG.copy.header, ...d.copy?.header },
          competencias: { ...DEFAULT_TEMPLATE_CONFIG.copy.competencias, ...d.copy?.competencias, categoryDescriptions: { ...d.copy?.competencias?.categoryDescriptions } },
          comparativos: {
            ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos, ...d.copy?.comparativos,
            alegra: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.alegra, ...d.copy?.comparativos?.alegra },
            team: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.team, ...d.copy?.comparativos?.team },
            auto: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.auto, ...d.copy?.comparativos?.auto },
          },
          comportamientos: { ...DEFAULT_TEMPLATE_CONFIG.copy.comportamientos, ...d.copy?.comportamientos },
          ranking: { ...DEFAULT_TEMPLATE_CONFIG.copy.ranking, ...d.copy?.ranking },
          comentarios: { ...DEFAULT_TEMPLATE_CONFIG.copy.comentarios, ...d.copy?.comentarios },
          footer: { ...DEFAULT_TEMPLATE_CONFIG.copy.footer, ...d.copy?.footer },
        },
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Cargar evaluados elegibles de esta encuesta (para elegir a quién previsualizar)
  useEffect(() => {
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/results`)
      .then((r) => r.json())
      .then((d) => {
        const results = (d.results ?? []) as { evaluateeEmail: string; evaluateeName: string }[];
        setEvaluatees(results);
        if (results.length > 0) setEvaluateeEmail(results[0].evaluateeEmail);
      })
      .catch(() => {});
  }, [evaluation.id]);

  const runPreview = useCallback(async (cfg: ReportTemplateConfig, email: string) => {
    if (!email) return;
    const myRequestId = ++requestIdRef.current;
    // Capturar el scroll actual justo antes de pedir la nueva vista previa —
    // se restaura en handleIframeLoad una vez la hoja nueva termina de cargar.
    savedScrollRef.current = previewContainerRef.current?.scrollTop ?? 0;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/evaluaciones360/report-template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: evaluation.id, evaluateeEmail: email, config: cfg, format: "html" }),
      });
      if (myRequestId !== requestIdRef.current) return; // una vista previa más nueva ya está en curso
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPreviewError(err.error ?? "No se pudo generar la vista previa");
        return;
      }
      const blob = await res.blob();
      if (myRequestId !== requestIdRef.current) return;
      const url = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch {
      if (myRequestId === requestIdRef.current) setPreviewError("Error de red generando la vista previa");
    } finally {
      if (myRequestId === requestIdRef.current) setPreviewLoading(false);
    }
  }, [evaluation.id]);

  // Si lo ÚNICO que cambió entre un config y el siguiente es texto (copy o
  // el contenido de un cuadro libre), la vista en vivo YA lo está mostrando
  // correctamente — Tiptap edita el DOM real en el momento, sin pasar por el
  // servidor. Recargar el iframe para "confirmar" un cambio que ya se ve
  // bien no solo es innecesario: como el HTML de esta plantilla no pagina
  // (ver por qué en report-template/preview/route.ts), recargar de más no
  // rompe nada por sí solo, pero sí puede pisar por un instante texto que el
  // admin sigue escribiendo en OTRO campo si la recarga anterior (de un
  // cambio de color/margen, por ejemplo) todavía estaba en camino. Se
  // reserva la recarga real para cambios que Tiptap no puede reflejar por su
  // cuenta: colores, márgenes, logo, tamaño de bloque/ícono, íconos por
  // categoría, y los 4 campos con placeholder (ver stripCopyAndText).
  // Los 4 campos de copy con placeholder ({{nombre}}, {{equipo}}, {{total}},
  // {{pregunta}} — ver DEFAULT_TEMPLATE_CONFIG) son la excepción: a
  // diferencia del resto del texto, si se editan SÍ hace falta recargar el
  // iframe. En reposo muestran el valor ya interpolado para esta preview
  // puntual (ver mountRichEditor); Tiptap solo lo reemplaza por la plantilla
  // cruda mientras el campo tiene el foco, así que sin esta recarga el campo
  // se queda mostrando el placeholder sin resolver ("{{total}}") apenas se
  // confirma la edición, hasta el próximo cambio que sí recargue por otro motivo.
  function stripCopyAndText(cfg: ReportTemplateConfig) {
    return {
      ...cfg,
      copy: {
        header: { greeting: cfg.copy.header.greeting },
        comparativos: { team: { desc: cfg.copy.comparativos.team.desc } },
        comportamientos: { description: cfg.copy.comportamientos.description },
        comentarios: { questionIntro: cfg.copy.comentarios.questionIntro },
      },
      customTextBoxes: cfg.customTextBoxes.map(({ text, ...rest }) => rest),
    };
  }
  function isOnlyTextChange(prev: ReportTemplateConfig, next: ReportTemplateConfig): boolean {
    return JSON.stringify(stripCopyAndText(prev)) === JSON.stringify(stripCopyAndText(next));
  }
  const prevConfigForReloadRef = useRef(config);
  // true una vez que la vista en vivo ya pidió su primer HTML al menos una
  // vez. Antes de este fix, si el config recién cargado (o el default, si
  // todavía no se había guardado ninguna plantilla) no difería del anterior
  // en nada más que texto, `isOnlyTextChange` daba `true` en la PRIMERA
  // pasada también — y como todavía no existía ningún preview, el efecto se
  // salía sin llamar nunca a `runPreview`: el panel quedaba en "Generando
  // vista previa…" para siempre, hasta que el admin tocara un control que no
  // fuera texto (un color, un margen). Este ref fuerza que la primera pasada
  // real SIEMPRE dispare el request, sin importar qué tan parecido sea el
  // config al default.
  const hasRequestedPreviewRef = useRef(false);
  // Evaluado con el que se generó el último HTML en vivo — comparado aparte
  // de `config` porque cambiar de evaluado NO toca `config` para nada: sin
  // esto, `isOnlyTextChange` comparaba el mismo config contra sí mismo (da
  // "true" trivialmente) y el efecto se salía sin recargar nunca la vista en
  // vivo al cambiar de persona en el selector — se quedaba mostrando al
  // evaluado anterior indefinidamente (el PDF de la derecha sí se refrescaba,
  // porque el selector lo dispara aparte).
  const prevEvaluateeRef = useRef(evaluateeEmail);

  // Debounce: regenerar la vista previa en vivo ~700ms después del último
  // cambio que Tiptap no pueda reflejar por su cuenta (ver arriba de
  // isOnlyTextChange). `isEditingRef` pospone mientras el admin está a mitad
  // de un arrastre (logo/cuadro de texto/tamaño de bloque) — recargar
  // destruiría el iframe (y con él los listeners de mousemove/mouseup ya
  // atados al documento viejo) a mitad del gesto.
  useEffect(() => {
    if (loading || !evaluateeEmail) return;
    const prev = prevConfigForReloadRef.current;
    const prevEvaluatee = prevEvaluateeRef.current;
    prevConfigForReloadRef.current = config;
    prevEvaluateeRef.current = evaluateeEmail;
    const isFirst = !hasRequestedPreviewRef.current;
    const evaluateeChanged = prevEvaluatee !== evaluateeEmail;
    if (!isFirst && !evaluateeChanged && isOnlyTextChange(prev, config)) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (isEditingRef.current) { schedule(400); return; }
        hasRequestedPreviewRef.current = true;
        runPreview(config, evaluateeEmail);
      }, delay);
    };
    schedule(isFirst || evaluateeChanged ? 0 : 700);
    return () => clearTimeout(timer);
  }, [config, evaluateeEmail, loading, runPreview]);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);
  useEffect(() => () => { if (realPdfUrlRef.current) URL.revokeObjectURL(realPdfUrlRef.current); }, []);

  // Genera el PDF real (mismo motor que el reporte final, con paginación
  // exacta) para un config/evaluado dados. Antes esto solo corría al hacer
  // clic manual en "Ver PDF real", porque cada llamada lanzaba un Chromium
  // nuevo (costoso). Ahora que el browser se reutiliza entre requests (ver
  // pdfBrowser.ts), también se usa desde el efecto de auto-refresco de abajo
  // — así "Ver PDF real" deja de ser una foto bajo demanda y pasa a ser una
  // vista que se mantiene sola, casi en tiempo real, fiel al PDF final.
  const runRealPdf = useCallback(async (cfg: ReportTemplateConfig, email: string) => {
    if (!email) return;
    const myRequestId = ++realPdfRequestIdRef.current;
    setRealPdfLoading(true);
    try {
      const res = await fetch("/api/evaluaciones360/report-template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: evaluation.id, evaluateeEmail: email, config: cfg, format: "pdf" }),
      });
      if (myRequestId !== realPdfRequestIdRef.current) return; // un refresco más nuevo ya está en curso
      if (!res.ok) return;
      const blob = await res.blob();
      if (myRequestId !== realPdfRequestIdRef.current) return;
      const url = URL.createObjectURL(blob);
      if (realPdfUrlRef.current) URL.revokeObjectURL(realPdfUrlRef.current);
      realPdfUrlRef.current = url;
      setRealPdfUrl(url);
    } catch {
      // Silencioso: es un refresco automático de fondo, no debe interrumpir
      // la edición. El próximo cambio de config lo vuelve a intentar.
    } finally {
      if (myRequestId === realPdfRequestIdRef.current) setRealPdfLoading(false);
    }
  }, [evaluation.id]);

  // Auto-refresco del PDF real: a diferencia de la vista en vivo, acá SIEMPRE
  // hay que regenerar ante cualquier cambio (también texto) — no existe un
  // DOM editable que ya lo esté mostrando correctamente, como sí pasa con
  // Tiptap en la vista en vivo. Mismo debounce/pausa-durante-arrastre que el
  // efecto de arriba, pero sin el atajo de "solo cambió texto".
  useEffect(() => {
    if (loading || !evaluateeEmail) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (isEditingRef.current) { schedule(400); return; }
        runRealPdf(config, evaluateeEmail);
      }, delay);
    };
    schedule(700);
    return () => clearTimeout(timer);
  }, [config, evaluateeEmail, loading, runRealPdf]);

  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 2;
  function handleZoomOut() { setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.1).toFixed(2))); }
  function handleZoomIn() { setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.1).toFixed(2))); }
  function handleZoomFit() {
    const containerWidth = previewContainerRef.current?.clientWidth ?? 0;
    if (containerWidth > 40 && pageWidthPx > 0) {
      setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (containerWidth - 32) / pageWidthPx)));
    }
  }

  // Escribe en `config.copy` por ruta genérica (ver getByPath/setByPath) — la
  // única puerta de entrada para editar copy, ya sea desde la vista en vivo
  // (data-edit-copy) o, si hiciera falta en el futuro, desde un input normal.
  // Para "competencias.categoryDescriptions::<categoría>" (única ruta con
  // clave dinámica hoy), el valor vacío se guarda como `null` — mismo criterio
  // que ya usaba el formulario viejo de descripción por categoría.
  function applyCopyByPath(cfg: ReportTemplateConfig, path: string, value: string): ReportTemplateConfig {
    if (path.includes("::")) {
      const [prefix, dynKey] = path.split("::");
      const segs = prefix.split(".");
      const current = (getByPath(cfg.copy, segs) as Record<string, string | null> | undefined) ?? {};
      const updated = { ...current, [dynKey]: value || null };
      return { ...cfg, copy: setByPath(cfg.copy, segs, updated) as ReportTemplateConfig["copy"] };
    }
    return { ...cfg, copy: setByPath(cfg.copy, path.split("."), value) as ReportTemplateConfig["copy"] };
  }
  const updateCopyByPath = useCallback((path: string, value: string) => {
    setConfig((prev) => applyCopyByPath(prev, path, value));
  }, []);

  // Guarda la descripción editada de una sección personalizada — a
  // diferencia de `updateCopyByPath`, esto NO toca `config` (esta encuesta no
  // vive en la plantilla global) y persiste de inmediato contra
  // `report-sections`, en vez de esperar a "Guardar plantilla". Como
  // `config`/`evaluateeEmail` no cambian al editar esto, el efecto de
  // auto-refresco de los paneles no se dispara solo — por eso se llama a
  // `runPreview`/`runRealPdf` acá mismo tras guardar, igual que ya hace el
  // manejo de los 4 campos con placeholder (ver `stripCopyAndText`).
  const commitSectionField = useCallback((sectionId: string, field: "name" | "description", html: string) => {
    const updated = reportSections.map((s) => (s.id === sectionId ? { ...s, [field]: html } : s));
    setReportSections(updated);
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/report-sections`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportSections: updated }),
    }).then((res) => {
      if (!res.ok) return;
      const refresh = () => {
        if (isEditingRef.current) { setTimeout(refresh, 400); return; }
        runPreview(config, evaluateeEmail);
        runRealPdf(config, evaluateeEmail);
      };
      refresh();
    }).catch(() => {});
  }, [reportSections, evaluation.id, config, evaluateeEmail, runPreview, runRealPdf]);

  // Si hay un campo con foco (o recién enfocado) con cambios que Tiptap
  // todavía no confirmó por blur, los aplica directo sobre `config` — sin
  // esto, guardar o recargar la vista previa justo después de escribir (sin
  // haber hecho clic fuera del campo primero) usaba la versión vieja: el
  // admin veía "no se guardó" pese a haber escrito algo, o la recarga que
  // corrige el layout de pagedjs (ver el efecto de debounce) volvía a mostrar
  // el texto ANTERIOR en vez del que se acababa de escribir. Devuelve el
  // config ya al día para usar de inmediato (ej. como body de un fetch),
  // sin depender de que el re-render de React con el nuevo estado ya haya ocurrido.
  function flushActiveField(base: ReportTemplateConfig): ReportTemplateConfig {
    const active = activeFieldRef.current;
    // El editor se destruye al perder el foco (ver mountRichEditor) — en el
    // caso normal `onFieldDeactivate` ya limpió esta ref antes de que
    // cualquier llamador llegue hasta acá, pero por si alguna vez se corre
    // sin que el blur haya alcanzado a correr primero, nunca se llama a un
    // método sobre una instancia ya muerta.
    if (!active || active.editor.isDestroyed) return base;
    const html = active.editor.getHTML();
    if (html === active.initialHtml) return base;
    // Un campo "section.<id>.<campo>" no vive en `config` — se guarda aparte
    // (ver `commitSectionField`) y `base` vuelve intacto.
    if (active.kind === "copy" && active.key.startsWith("section.")) {
      const [, sectionId, field] = active.key.split(".");
      commitSectionField(sectionId, field as "name" | "description", html);
      activeFieldRef.current = { ...active, initialHtml: html };
      return base;
    }
    const flushed = active.kind === "copy"
      ? applyCopyByPath(base, active.key, html)
      : { ...base, customTextBoxes: base.customTextBoxes.map((b) => (b.id === active.key ? { ...b, text: html } : b)) };
    activeFieldRef.current = { ...active, initialHtml: html };
    setConfig(flushed);
    return flushed;
  }

  async function handleSave() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const toSave = flushActiveField(config);
      const res = await fetch("/api/evaluaciones360/report-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      setSavedMsg(res.ok ? "Guardado — aplica a todos los reportes 360° desde ahora" : "No se pudo guardar");
    } catch {
      setSavedMsg("Error de red al guardar");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 5000);
    }
  }

  async function handleImageUpload(kind: "logoDataUri" | "headerBgDataUri", file: File | undefined) {
    if (!file) return;
    const dataUri = await fileToDataUri(file);
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, [kind]: dataUri } }));
  }

  // Memoizado (a diferencia de setLayout/setLogoAlign/etc., que siguen igual)
  // porque además del swatch del toolbar, ahora también lo usan las manijas
  // de color ancladas directo en el documento — necesita ser una dependencia
  // estable de handleIframeLoad.
  const setColor = useCallback((key: keyof ReportTemplateConfig["colors"], value: string) =>
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } })), []);
  const setLayout = <K extends keyof ReportTemplateConfig["layout"]>(key: K, value: ReportTemplateConfig["layout"][K]) =>
    setConfig((prev) => ({ ...prev, layout: { ...prev.layout, [key]: value } }));
  const setLogoAlign = (align: ReportTemplateConfig["logo"]["align"]) =>
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, align } }));
  const setLogoSize = (size: number) =>
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, size } }));
  const setLogoOffset = useCallback((headerOffsetX: number, headerOffsetY: number) =>
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, headerOffsetX, headerOffsetY } })), []);
  const setBlockFontScalePct = useCallback((block: ReportBlockId, pct: number) =>
    setConfig((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [block]: { ...prev.blocks[block], fontScale: pct / 100 } } as ReportTemplateConfig["blocks"],
    })), []);
  // Espacio real (margin-bottom CSS) bajo el título del bloque — la
  // alternativa a usar párrafos vacíos como truco de espaciado, que se ve
  // distinto entre la vista en vivo y el PDF real (ver mountRichEditor /
  // stripEmptyEdgeParagraphs).
  const setBlockTitleGap = useCallback((block: ReportBlockId, px: number) =>
    setConfig((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [block]: { ...prev.blocks[block], titleGap: px } } as ReportTemplateConfig["blocks"],
    })), []);
  // Espacio real (margin-top CSS) ANTES del título — se ignora (siempre 0)
  // si el bloque queda primero en el orden, para no duplicar el espacio que
  // ya da el encabezado.
  const setBlockTitleGapBefore = useCallback((block: ReportBlockId, px: number) =>
    setConfig((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [block]: { ...prev.blocks[block], titleGapBefore: px } } as ReportTemplateConfig["blocks"],
    })), []);
  // Mismo cambio de estado que `handleDrop` (panel "Orden y tamaños") — acá
  // llamado desde la manija de arrastre directo sobre el documento.
  const setBlocksOrder = useCallback((order: ReportBlockId[]) =>
    setConfig((prev) => ({ ...prev, blocks: { ...prev.blocks, order } })), []);
  // Mismo cambio de estado que `setLayout("pageMarginX", ...)` (input del
  // toolbar) — memoizado aparte (setLayout no lo está) para poder listarlo
  // como dependencia estable de `handleIframeLoad`.
  const setPageMarginX = useCallback((value: number) =>
    setConfig((prev) => ({ ...prev, layout: { ...prev.layout, pageMarginX: value } })), []);
  const setCompetenciasIconSize = useCallback((px: number) =>
    setConfig((prev) => ({ ...prev, blocks: { ...prev.blocks, competencias: { ...prev.blocks.competencias, iconSize: px } } })), []);
  const setCategoryIcon = (category: string, iconKey: string) =>
    setConfig((prev) => {
      const next = { ...prev.blocks.competencias.categoryIcons };
      if (iconKey === "auto") delete next[category];
      else if (iconKey === "none") next[category] = null;
      else next[category] = iconKey;
      return { ...prev, blocks: { ...prev.blocks, competencias: { ...prev.blocks.competencias, categoryIcons: next } } };
    });

  const addTextBox = useCallback(() =>
    setConfig((prev) => ({
      ...prev,
      customTextBoxes: [
        ...prev.customTextBoxes,
        { id: crypto.randomUUID(), text: "Nuevo texto", x: 40, y: 40, width: 200, color: prev.colors.text, fontSize: 12 },
      ],
    })), []);
  const updateTextBox = useCallback((id: string, patch: Partial<CustomTextBox>) =>
    setConfig((prev) => ({
      ...prev,
      customTextBoxes: prev.customTextBoxes.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })), []);
  const removeTextBox = useCallback((id: string) =>
    setConfig((prev) => ({ ...prev, customTextBoxes: prev.customTextBoxes.filter((b) => b.id !== id) })), []);

  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    // Sin pagedjs de por medio, el DOM ya está completo y listo apenas
    // dispara "load" — no hace falta esperar ningún evento de repaginado.
    attachEditHandles(
      doc, config, setLogoOffset, setCompetenciasIconSize, setBlockFontScalePct, setBlocksOrder, setPageMarginX, setColor, updateTextBox, removeTextBox, updateCopyByPath, commitSectionField,
      onEditStart, onEditEnd, onFieldActivate, forceToolbarUpdate, onFieldDeactivate, shouldSkipBlur
    );
    const height = doc.documentElement.scrollHeight;
    if (height > 0) setLiveIframeHeight(height);
    // Solo la primera vez: ajusta el zoom al ancho del panel para que se vea
    // la hoja completa sin scroll horizontal. Después, el usuario controla
    // el zoom manualmente y no se lo pisamos en cada recarga.
    if (!hasAutoFitRef.current) {
      hasAutoFitRef.current = true;
      const containerWidth = previewContainerRef.current?.clientWidth ?? 0;
      if (containerWidth > 40) setZoom(Math.min(1, (containerWidth - 32) / pageWidthPx));
    }
    // Restaurar el scroll capturado antes de pedir esta vista previa (ver
    // runPreview) — en un frame aparte para que el contenedor ya haya
    // tomado el alto recién fijado arriba.
    requestAnimationFrame(() => {
      if (previewContainerRef.current) previewContainerRef.current.scrollTop = savedScrollRef.current;
    });
  }, [config, setLogoOffset, setCompetenciasIconSize, setBlockFontScalePct, setBlocksOrder, setPageMarginX, setColor, updateTextBox, removeTextBox, updateCopyByPath, commitSectionField, onEditStart, onEditEnd, onFieldActivate, forceToolbarUpdate, onFieldDeactivate, shouldSkipBlur]);

  function handleDragStart(id: ReportBlockId) { dragIdRef.current = id; }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(targetId: ReportBlockId) {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    setConfig((prev) => {
      const order = [...prev.blocks.order];
      const from = order.indexOf(draggedId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to > from ? to - 1 : to, 0, draggedId);
      return { ...prev, blocks: { ...prev.blocks, order } };
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Se referencia por su valor (no solo activeFieldRef) para que el render
  // de RichToolbar reaccione a toolbarTick — activeFieldRef por sí sola no
  // dispara re-render al cambiar.
  void toolbarTick;

  // Un bloque queda siempre pegado al borde físico de una hoja — y por lo
  // tanto su "espacio sobre el título" configurado se suma al margen de
  // página (~22px en cada hoja) en vez de reemplazarlo, viéndose
  // desproporcionado frente a un bloque que no arranca hoja nueva — en dos
  // casos: es el primero del documento, o queda justo después de
  // "comparativos" o "ranking" (los bloques con salto de página forzado
  // hoy). Mismo criterio que ya usa `titleMarginTop`/`FORCED_BREAK_AFTER` en
  // eval360ReportTemplate.ts.
  const FORCED_BREAK_AFTER: ReportBlockId[] = ["comparativos", "ranking"];
  const blocksAfterForcedBreak = new Set(
    FORCED_BREAK_AFTER.map((id) => {
      const idx = config.blocks.order.indexOf(id);
      return idx !== -1 ? config.blocks.order[idx + 1] : undefined;
    }).filter((id): id is ReportBlockId => id !== undefined)
  );
  const isBlockPinnedToPageTop = (blockId: ReportBlockId) => config.blocks.order[0] === blockId || blocksAfterForcedBreak.has(blockId);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Esta plantilla es <strong>global</strong>: aplica a todos los reportes 360° (de cualquier encuesta), no solo a esta.
          Estás previsualizando con datos reales de <strong>{evaluation.title}</strong>. Todo el texto (títulos, descripciones,
          etiquetas) se edita haciendo clic directamente sobre él en la vista en vivo — con la barra de formato de aquí abajo,
          igual que en un documento. No se puede editar lo que ya se calcula por evaluado (gráficas, puntajes, comentarios reales).
        </p>
      </div>

      {/* ── Franja superior compacta: solo ajustes que NO son texto ────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">

          {/* Colores */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Colores</p>
            <div className="flex items-center gap-1.5">
              {([
                ["primary", "Primario (barras/acentos)"],
                ["primaryDark", "Primario oscuro (wordmark)"],
                ["text", "Texto principal"],
                ["textSecondary", "Texto secundario"],
                ["background", "Fondo de página"],
                ["cardBorder", "Borde de tarjetas"],
              ] as const).map(([key, label]) => (
                <input
                  key={key} type="color" title={label} value={config.colors[key]}
                  onChange={(e) => setColor(key, e.target.value)}
                  className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer"
                />
              ))}
            </div>
          </div>

          <div className="w-px self-stretch bg-slate-100" />

          {/* Logo */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Logo</p>
            <div className="flex items-center gap-1.5">
              {config.logo.logoDataUri
                ? <img src={config.logo.logoDataUri} alt="" className="w-7 h-7 object-contain rounded-lg border border-slate-100 bg-slate-50" />
                : <div className="w-7 h-7 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300"><ImageIcon className="w-3.5 h-3.5" /></div>}
              <label className="text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 px-2 py-1.5 rounded-lg cursor-pointer transition-colors">
                Subir
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload("logoDataUri", e.target.files?.[0])} />
              </label>
              {config.logo.logoDataUri && (
                <button onClick={() => setConfig((prev) => ({ ...prev, logo: { ...prev.logo, logoDataUri: null } }))} className="p-1.5 text-[#94a3b8] hover:text-red-500 rounded-lg" title="Quitar logo">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 ml-1">
                {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([align, Icon]) => (
                  <button
                    key={align}
                    onClick={() => setLogoAlign(align)}
                    title={`Alinear ${align}`}
                    className={`p-1 rounded-md transition-colors ${config.logo.align === align ? "bg-white shadow-sm text-primary" : "text-[#94a3b8] hover:text-[#64748b]"}`}
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <input
                type="number" min={8} max={48} value={config.logo.size}
                onChange={(e) => setLogoSize(parseInt(e.target.value) || 16)}
                title="Tamaño del logo (px)"
                className="w-12 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="w-px self-stretch bg-slate-100" />

          {/* Fondo decorativo del encabezado */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Encabezado</p>
            <div className="flex items-center gap-1.5">
              {config.logo.headerBgDataUri
                ? <img src={config.logo.headerBgDataUri} alt="" className="w-7 h-7 object-contain rounded-lg border border-slate-100 bg-slate-50" />
                : <div className="w-7 h-7 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300"><ImageIcon className="w-3.5 h-3.5" /></div>}
              <label className="text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 px-2 py-1.5 rounded-lg cursor-pointer transition-colors">
                Subir fondo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload("headerBgDataUri", e.target.files?.[0])} />
              </label>
              {config.logo.headerBgDataUri && (
                <button onClick={() => setConfig((prev) => ({ ...prev, logo: { ...prev.logo, headerBgDataUri: null } }))} className="p-1.5 text-[#94a3b8] hover:text-red-500 rounded-lg" title="Quitar (usar el archivo por defecto)">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <input
                type="number" min={80} max={400} step={10} value={config.logo.headerBgHeight}
                onChange={(e) => setConfig((prev) => ({ ...prev, logo: { ...prev.logo, headerBgHeight: parseInt(e.target.value) || 190 } }))}
                title="Alto visible del fondo (px) — recorta la franja plana antes de que se funda con el color de página"
                className="w-14 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="w-px self-stretch bg-slate-100" />

          {/* Márgenes y densidad */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Márgenes y densidad</p>
            <div className="flex items-center gap-1.5">
              {([
                ["pageMarginX", "Margen horizontal (px)"],
                ["pageMarginY", "Margen vertical (px)"],
                ["cardPadding", "Padding de tarjetas (px)"],
                ["cardRadius", "Radio de tarjetas (px)"],
              ] as const).map(([key, label]) => (
                <input
                  key={key} type="number" min={0} max={80} value={config.layout[key]} title={label}
                  onChange={(e) => setLayout(key, parseInt(e.target.value) || 0)}
                  className="w-12 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 outline-none focus:border-primary"
                />
              ))}
              <select
                value={config.layout.density}
                onChange={(e) => setLayout("density", e.target.value as ReportTemplateDensity)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary cursor-pointer"
              >
                {DENSITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="w-px self-stretch bg-slate-100" />

          {/* Bloques y orden (panel expandible abajo) */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Bloques</p>
            <button
              onClick={() => setShowBlocksPanel((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${showBlocksPanel ? "bg-primary/10 text-primary" : "bg-slate-50 text-[#1e293b] hover:bg-slate-100"}`}
            >
              <Settings2 className="w-3.5 h-3.5" /> Orden y tamaños
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBlocksPanel ? "rotate-180" : ""}`} />
            </button>
          </div>

          <div className="w-px self-stretch bg-slate-100" />

          {/* Texto libre (panel expandible abajo) */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Texto libre</p>
            <div className="flex items-center gap-1.5">
              <button onClick={addTextBox} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-[#1e293b] hover:bg-slate-100 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
              {config.customTextBoxes.length > 0 && (
                <button
                  onClick={() => setShowTextBoxPanel((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${showTextBoxPanel ? "bg-primary/10 text-primary" : "bg-slate-50 text-[#1e293b] hover:bg-slate-100"}`}
                >
                  <Type className="w-3.5 h-3.5" /> {config.customTextBoxes.length}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTextBoxPanel ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>

          {/* Guardar */}
          <div className="ml-auto flex items-center gap-3 self-center">
            {savedMsg && <span className="text-xs font-semibold text-[#64748b]">{savedMsg}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1e293b] text-white rounded-xl text-xs font-bold hover:bg-primary transition-all disabled:opacity-40"
            >
              {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Guardar plantilla
            </button>
          </div>
        </div>

        {/* ── Panel: Bloques y orden (arrastrar, tamaño de letra, ícono por categoría) ── */}
        {showBlocksPanel && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[10px] text-[#94a3b8] mb-2">Arrastra para reordenar. Haz clic para ajustar el tamaño de letra de cada bloque. Los títulos/descripciones de cada bloque se editan directamente en la vista en vivo.</p>
            {config.blocks.order.map((blockId) => (
              <div
                key={blockId}
                draggable
                onDragStart={() => handleDragStart(blockId)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(blockId)}
                className="border border-slate-100 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
                  <span className="text-xs font-bold text-[#1e293b] flex-1 min-w-0 truncate">{BLOCK_LABELS[blockId]}</span>
                  <button onClick={() => setOpenBlock(openBlock === blockId ? null : blockId)} className="p-1 text-[#94a3b8] hover:text-[#64748b] shrink-0">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openBlock === blockId ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {openBlock === blockId && (
                  <div className="p-3 space-y-3 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-[#1e293b]">Tamaño de letra</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={70} max={150} step={5}
                          value={Math.round(config.blocks[blockId].fontScale * 100)}
                          onChange={(e) => setBlockFontScalePct(blockId, parseInt(e.target.value) || 100)}
                          className="w-16 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                        />
                        <span className="text-[10px] font-bold text-[#64748b]">%</span>
                      </div>
                    </div>

                    {blockId !== "comentarios" && (
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-[#1e293b]" title="Separación real (margen CSS) entre el título y las tarjetas/gráficas de abajo — a diferencia de agregar líneas en blanco al título, esto se ve idéntico en la vista en vivo y en el PDF real.">
                          Espacio bajo el título
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} max={80} step={2}
                            value={config.blocks[blockId].titleGap}
                            onChange={(e) => setBlockTitleGap(blockId, parseInt(e.target.value) || 0)}
                            className="w-16 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                          />
                          <span className="text-[10px] font-bold text-[#64748b]">px</span>
                        </div>
                      </div>
                    )}

                    {blockId !== "comentarios" && (
                      <div className="flex items-center justify-between gap-3">
                        <label
                          className="text-xs font-semibold text-[#1e293b]"
                          title={
                            isBlockPinnedToPageTop(blockId)
                              ? (config.blocks.order[0] === blockId
                                  ? "Este bloque es el primero del reporte — queda siempre pegado al encabezado, sin espacio arriba, sin importar este número."
                                  : "Este bloque arranca siempre una hoja nueva (justo después de un salto de página forzado) — ya tiene el margen físico de la hoja como aire arriba, sin importar este número.")
                              : "Separación real (margen CSS) antes del título, hacia el bloque anterior — igual que 'Espacio bajo el título', se ve idéntico en vivo y en el PDF."
                          }
                        >
                          Espacio sobre el título
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} max={100} step={2}
                            disabled={isBlockPinnedToPageTop(blockId)}
                            value={config.blocks[blockId].titleGapBefore}
                            onChange={(e) => setBlockTitleGapBefore(blockId, parseInt(e.target.value) || 0)}
                            className="w-16 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary disabled:opacity-40"
                          />
                          <span className="text-[10px] font-bold text-[#64748b]">px</span>
                        </div>
                      </div>
                    )}

                    {blockId === "competencias" && (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-semibold text-[#1e293b]">Tamaño de ícono</label>
                          <input
                            type="number" min={12} max={40}
                            value={config.blocks.competencias.iconSize}
                            onChange={(e) => setCompetenciasIconSize(parseInt(e.target.value) || 22)}
                            className="w-16 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                          />
                        </div>
                        {categories.length > 0 && (
                          <div className="space-y-2.5 pt-2 border-t border-slate-100">
                            <p className="text-[10px] font-bold uppercase text-[#94a3b8]">Ícono por categoría (la descripción se edita en la vista en vivo)</p>
                            {categories.map((cat) => {
                              const currentIcon = cat in config.blocks.competencias.categoryIcons
                                ? (config.blocks.competencias.categoryIcons[cat] ?? "none")
                                : "auto";
                              return (
                                <div key={cat} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg p-2">
                                  <span className="text-xs font-semibold text-[#1e293b] truncate">{cat}</span>
                                  <select
                                    value={currentIcon}
                                    onChange={(e) => setCategoryIcon(cat, e.target.value)}
                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-primary cursor-pointer shrink-0"
                                  >
                                    <option value="auto">Automático</option>
                                    <option value="none">Ninguno</option>
                                    {CATEGORY_ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Panel: Texto libre (color/tamaño/borrar — el texto se edita en vivo) ── */}
        {showTextBoxPanel && config.customTextBoxes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[10px] text-[#94a3b8] mb-2">El contenido de cada cuadro se edita haciendo clic sobre él en la vista en vivo. Aquí solo su color, tamaño y posición inicial.</p>
            {config.customTextBoxes.map((box) => (
              <div key={box.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                <input
                  type="color" value={box.color}
                  onChange={(e) => updateTextBox(box.id, { color: e.target.value })}
                  className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                />
                <input
                  type="number" min={8} max={40} value={box.fontSize}
                  onChange={(e) => updateTextBox(box.id, { fontSize: parseInt(e.target.value) || 12 })}
                  className="w-14 text-center text-xs font-bold bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                  title="Tamaño de letra (px)"
                />
                <span className="text-xs text-[#64748b] truncate flex-1 min-w-0">{box.text}</span>
                <button onClick={() => removeTextBox(box.id)} className="p-1.5 text-[#94a3b8] hover:text-red-500 rounded-lg shrink-0" title="Borrar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Barra de formato de texto — persistente, siempre visible arriba de la vista previa ── */}
      <div
        ref={toolbarContainerRef}
        onMouseDownCapture={() => { isToolbarInteractionRef.current = true; }}
        onBlurCapture={() => {
          // En el frame siguiente (no en el mismo tick): si el foco ya salió
          // de toda la barra (no se movió a OTRO control de la misma barra),
          // se cierra la ventana de "interacción con la barra" — recién ahí
          // un blur del editor de Tiptap se trata como un blur real.
          requestAnimationFrame(() => {
            if (!toolbarContainerRef.current?.contains(document.activeElement)) {
              isToolbarInteractionRef.current = false;
            }
          });
        }}
      >
        <RichToolbar activeField={activeFieldRef.current} />
      </div>

      {/* ── Vista previa: editable a la izquierda, PDF real a la derecha ──── */}
      {/* Ya no existe un algoritmo propio que intente adivinar los cortes de
          página en la vista en vivo — se intentó (ver commits anteriores) y
          resultó ser una fuente recurrente de bugs, porque reproducir a mano
          la fragmentación real de Chromium (colapso de márgenes, huérfanos,
          redondeo de subpíxeles...) es, en la práctica, una batalla que no se
          gana del todo. La paginación exacta SOLO se confía al PDF real de la
          derecha (Puppeteer, el mismo motor que genera el reporte final) —
          nunca se aproxima ni se dibuja a mano. */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[85vh]">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
          <span className="text-xs font-bold text-[#1e293b]">Vista previa —</span>
          <select
            value={evaluateeEmail}
            onChange={(e) => {
              const email = e.target.value;
              setEvaluateeEmail(email);
              // Refresco inmediato del PDF real al cambiar de persona — no
              // hace falta esperar los ~700ms del debounce pensado para
              // pausas de edición, esto es una acción discreta.
              runRealPdf(flushActiveField(config), email);
            }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-[#1e293b] outline-none focus:border-primary cursor-pointer flex-1 min-w-0"
          >
            {evaluatees.map((p) => (
              <option key={p.evaluateeEmail} value={p.evaluateeEmail}>{p.evaluateeName || p.evaluateeEmail}</option>
            ))}
          </select>
          {(previewLoading || realPdfLoading) && <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 shrink-0">
            <button onClick={handleZoomOut} disabled={zoom <= ZOOM_MIN} className="p-1 rounded-md text-[#64748b] hover:text-primary disabled:opacity-30" title="Alejar (panel izquierdo)">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold text-[#1e293b] w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} disabled={zoom >= ZOOM_MAX} className="p-1 rounded-md text-[#64748b] hover:text-primary disabled:opacity-30" title="Acercar (panel izquierdo)">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleZoomFit} className="p-1 rounded-md text-[#64748b] hover:text-primary" title="Ajustar la hoja al ancho del panel">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#94a3b8] px-4 py-1.5 bg-amber-50 border-b border-amber-100">
          Izquierda: haz clic sobre cualquier texto para editarlo — la barra de arriba controla el formato del campo activo. Arrastra el
          logo, los bloques y los márgenes para ajustar posición/tamaño — documento continuo, sin cortes de página, para que la edición
          sea instantánea. Derecha: el PDF real, con la paginación exacta — se actualiza solo, unos segundos después de tu última edición.
        </p>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 flex flex-col border-r border-slate-200 min-w-0">
            <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-[#94a3b8] flex items-center gap-1 shrink-0">
              <Eye className="w-3 h-3" /> Editar (vivo)
            </div>
            {/* overflow-y-auto vive aquí, no en el iframe: el iframe se
                dimensiona a la altura real del documento (ver
                liveIframeHeight) y este div hace el scroll — así se ve
                completo en vez de recortarse dentro de una ventana fija. */}
            <div ref={previewContainerRef} className="flex-1 relative overflow-y-auto bg-slate-100">
              {previewError ? (
                <div className="flex items-center justify-center h-full p-8 text-center">
                  <p className="text-sm text-red-500 font-semibold">{previewError}</p>
                </div>
              ) : previewUrl ? (
                // El zoom se aplica con transform:scale sobre el iframe (que
                // mantiene su tamaño real para medir bien), y este div
                // wrapper se dimensiona ya escalado para que el scroll del
                // contenedor refleje el tamaño visual, no el real.
                <div style={{ width: pageWidthPx * zoom, height: liveIframeHeight * zoom, margin: "0 auto" }}>
                  <iframe
                    key={previewUrl} ref={iframeRef} src={previewUrl} onLoad={handleIframeLoad}
                    title="Vista previa del reporte" className="border-none block origin-top-left"
                    style={{ width: pageWidthPx, height: liveIframeHeight, transform: `scale(${zoom})` }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-8 text-center text-sm text-[#94a3b8]">
                  {evaluatees.length === 0 ? "Esta encuesta todavía no tiene evaluaciones enviadas." : "Generando vista previa…"}
                </div>
              )}
            </div>
          </div>
          <div className="w-1/2 flex flex-col min-w-0">
            <div className="px-3 py-1 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-[#94a3b8] flex items-center gap-1 shrink-0">
              <FileText className="w-3 h-3" /> PDF real
            </div>
            <div className="flex-1 relative overflow-y-auto bg-slate-100">
              {realPdfUrl ? (
                <iframe key={realPdfUrl} src={realPdfUrl} title="PDF real del reporte" className="w-full h-full border-none absolute inset-0" style={{ minHeight: "600px" }} />
              ) : (
                <div className="flex items-center justify-center h-full p-8 text-center text-sm text-[#94a3b8]">Generando PDF…</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
