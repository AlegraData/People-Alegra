"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEffect, useCallback, useRef, useState } from "react";

// ── Paletas de color ──────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: "Negro",     value: "#1e293b" },
  { label: "Gris",      value: "#64748b" },
  { label: "Rojo",      value: "#EF4444" },
  { label: "Naranja",   value: "#F97316" },
  { label: "Amarillo",  value: "#CA8A04" },
  { label: "Verde",     value: "#10B981" },
  { label: "Teal",      value: "#00D6BC" },
  { label: "Azul",      value: "#3B82F6" },
  { label: "Morado",    value: "#8B5CF6" },
  { label: "Rosa",      value: "#EC4899" },
];

const BG_COLORS = [
  { label: "Sin fondo",  value: null },
  { label: "Amarillo",   value: "#FEF08A" },
  { label: "Verde",      value: "#BBF7D0" },
  { label: "Azul",       value: "#BFDBFE" },
  { label: "Morado",     value: "#E9D5FF" },
  { label: "Rosa",       value: "#FBCFE8" },
  { label: "Naranja",    value: "#FED7AA" },
  { label: "Teal",       value: "#99F6E4" },
  { label: "Rojo",       value: "#FECACA" },
];

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolBtn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all ${
        active
          ? "bg-primary/15 text-primary"
          : "text-[#64748b] hover:bg-slate-100 hover:text-[#1e293b]"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5" />;
}

// ── Color popover ─────────────────────────────────────────────────────────────
function ColorPopover({
  colors, onSelect, onClose, activeColor, showNone,
}: {
  colors: { label: string; value: string | null }[];
  onSelect: (v: string | null) => void;
  onClose: () => void;
  activeColor?: string;
  showNone?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-52"
    >
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c.label}
            type="button"
            title={c.label}
            onMouseDown={(e) => { e.preventDefault(); onSelect(c.value); onClose(); }}
            className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${
              activeColor === c.value ? "border-primary shadow-md" : "border-slate-200"
            }`}
            style={{ background: c.value ?? "white" }}
          >
            {!c.value && (
              <span className="text-[10px] text-slate-400 leading-none">∅</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Editor principal ──────────────────────────────────────────────────────────
interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({
  value, onChange, placeholder = "Escribe aquí...", minHeight = 100,
}: Props) {
  const [linkOpen, setLinkOpen]         = useState(false);
  const [linkUrl, setLinkUrl]           = useState("");
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor]   = useState(false);
  const linkInputRef                    = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
          HTMLAttributes: {},
        },
        codeBlock:   { HTMLAttributes: { class: "bg-slate-100 rounded-lg p-3 text-sm font-mono" } },
        blockquote:  { HTMLAttributes: { class: "border-l-4 border-primary/40 pl-4 text-[#64748b] italic" } },
        bulletList:  { HTMLAttributes: { class: "list-disc pl-5" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-5" } },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer", rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "outline-none min-h-[inherit] prose prose-sm max-w-none text-[#1e293b]",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "");
  }, [value, editor]);

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href ?? "";
    setLinkUrl(prev);
    setLinkOpen(true);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  }, [editor]);

  const confirmLink = useCallback(() => {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const cancelLink = useCallback(() => {
    setLinkOpen(false);
    setLinkUrl("");
    editor?.commands.focus();
  }, [editor]);

  if (!editor) return null;

  const activeTextColor = editor.getAttributes("textStyle").color as string | undefined;
  const activeBgColor   = editor.getAttributes("highlight").color as string | undefined;

  return (
    <div className="relative border border-slate-200 rounded-xl overflow-visible focus-within:border-primary transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">

        {/* Tamaño de letra */}
        <ToolBtn
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          title="Texto normal"
        >
          <span className="text-xs font-bold">T</span>
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Título mediano"
        >
          <span className="text-xs font-bold">T<sup>+</sup></span>
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Título grande"
        >
          <span className="text-sm font-black">T<sup>++</sup></span>
        </ToolBtn>

        <Sep />

        {/* Formato básico */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursiva">
          <em>I</em>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Subrayado">
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Tachado">
          <span className="line-through">S</span>
        </ToolBtn>

        <Sep />

        {/* Color de texto */}
        <div className="relative">
          <button
            type="button"
            title="Color de texto"
            onMouseDown={(e) => { e.preventDefault(); setShowTextColor((v) => !v); setShowBgColor(false); }}
            className="w-8 h-8 flex flex-col items-center justify-center rounded-lg text-sm text-[#64748b] hover:bg-slate-100 transition-all"
          >
            <span className="font-black text-sm leading-none">A</span>
            <span
              className="w-4 h-1.5 rounded-sm mt-0.5"
              style={{ background: activeTextColor ?? "#1e293b" }}
            />
          </button>
          {showTextColor && (
            <ColorPopover
              colors={TEXT_COLORS}
              activeColor={activeTextColor}
              onSelect={(color) => {
                if (color) editor.chain().focus().setColor(color).run();
                else editor.chain().focus().unsetColor().run();
              }}
              onClose={() => setShowTextColor(false)}
            />
          )}
        </div>

        {/* Color de fondo */}
        <div className="relative">
          <button
            type="button"
            title="Color de fondo"
            onMouseDown={(e) => { e.preventDefault(); setShowBgColor((v) => !v); setShowTextColor(false); }}
            className="w-8 h-8 flex flex-col items-center justify-center rounded-lg text-sm text-[#64748b] hover:bg-slate-100 transition-all"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
              <rect x="1" y="1" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="1" y="13" width="14" height="2.5" rx="1" style={{ fill: activeBgColor ?? "#e2e8f0" }}/>
            </svg>
          </button>
          {showBgColor && (
            <ColorPopover
              colors={BG_COLORS}
              activeColor={activeBgColor}
              showNone
              onSelect={(color) => {
                if (color) editor.chain().focus().setHighlight({ color }).run();
                else editor.chain().focus().unsetHighlight().run();
              }}
              onClose={() => setShowBgColor(false)}
            />
          )}
        </div>

        <Sep />

        {/* Listas */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista con viñetas">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
            <circle cx="2" cy="4" r="1.5"/><rect x="5" y="3" width="9" height="2" rx="1"/>
            <circle cx="2" cy="8" r="1.5"/><rect x="5" y="7" width="9" height="2" rx="1"/>
            <circle cx="2" cy="12" r="1.5"/><rect x="5" y="11" width="9" height="2" rx="1"/>
          </svg>
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
            <text x="0" y="5" fontSize="5" fontFamily="sans-serif">1.</text>
            <text x="0" y="9" fontSize="5" fontFamily="sans-serif">2.</text>
            <text x="0" y="13" fontSize="5" fontFamily="sans-serif">3.</text>
            <rect x="6" y="3" width="9" height="2" rx="1"/>
            <rect x="6" y="7" width="9" height="2" rx="1"/>
            <rect x="6" y="11" width="9" height="2" rx="1"/>
          </svg>
        </ToolBtn>

        <Sep />

        {/* Cita */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Cita">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
            <path d="M3 3h3v4H4a2 2 0 000 4v2H2a2 2 0 01-2-2V5a2 2 0 012-2h1zm7 0h3v4h-2a2 2 0 000 4v2H9a2 2 0 01-2-2V5a2 2 0 012-2h1z"/>
          </svg>
        </ToolBtn>

        <Sep />

        {/* Enlace */}
        <ToolBtn onClick={openLinkModal} active={editor.isActive("link")} title="Insertar enlace">
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
            <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5"/>
            <path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5L8.5 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </ToolBtn>
      </div>

      {/* Área de edición */}
      <div style={{ minHeight }} className="relative px-4 py-3 bg-white cursor-text rounded-b-xl" onClick={() => editor.commands.focus()}>
        {!editor.getText() && (
          <p className="absolute inset-x-4 top-3 text-[#94a3b8] text-sm pointer-events-none select-none line-clamp-2">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>

      {/* Modal de enlace */}
      {linkOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 rounded-xl backdrop-blur-[2px]">
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 w-80 mx-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-[#1e293b] mb-1">Insertar enlace</p>
            <p className="text-xs text-[#64748b] mb-4">Pega o escribe la URL de destino</p>
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmLink();
                if (e.key === "Escape") cancelLink();
              }}
              placeholder="https://ejemplo.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={cancelLink}
                className="px-4 py-2 text-sm font-bold text-[#64748b] hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              {editor.isActive("link") && (
                <button type="button"
                  onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); setLinkUrl(""); }}
                  className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                  Quitar
                </button>
              )}
              <button type="button" onClick={confirmLink}
                className="px-4 py-2 text-sm font-bold bg-[#1e293b] text-white hover:bg-primary rounded-xl transition-colors">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
