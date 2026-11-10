import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Select from "../../../components/ui/Select";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
  Unlink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  isFullscreen?: boolean;
  className?: string;
}

interface ToolbarButtonProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none ${active ? "bg-primary-light text-primary" : "text-text-secondary hover:text-text-primary"}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEditorValue(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return "<p><br></p>";
  }

  if (/<\/?[a-z][\s\S]*>/i.test(trimmedValue)) {
    return value;
  }

  const escapedValue = escapeHtml(value).replace(/\r?\n/g, "<br />");
  return `<p>${escapedValue}</p>`;
}

export default function RichTextEditor({
  id,
  value,
  onChange,
  readOnly = false,
  isFullscreen = false,
  className = "",
}: RichTextEditorProps) {
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const editorValue = useMemo(() => normalizeEditorValue(value), [value]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Superscript,
      Subscript,
    ],
    content: editorValue,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: `${isFullscreen ? "min-h-[calc(100vh-23rem)]" : "min-h-[240px] sm:min-h-[280px]"} px-4 py-4 text-sm leading-6 text-text-primary focus:outline-none prose max-w-none prose-p:my-0 prose-ul:my-2 prose-ol:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-headings:font-semibold prose-a:text-primary prose-a:underline prose-code:rounded prose-code:bg-bg-secondary prose-code:px-1 prose-code:py-0.5 sm:px-5 sm:py-5 sm:text-[15px]` ,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentHtml = editor.getHTML();
    if (currentHtml !== editorValue) {
      editor.commands.setContent(editorValue, false);
    }
  }, [editor, editorValue]);

  const applyBlockType = useCallback(
    (blockType: string) => {
      if (!editor || readOnly) return;
      if (blockType === "paragraph") {
        editor.chain().focus().setParagraph().run();
      } else if (blockType === "h1") {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      } else if (blockType === "h2") {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      } else {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      }
    },
    [editor, readOnly],
  );

  const setLink = useCallback(() => {
    if (!editor || readOnly) return;
    const url = linkUrl.trim();
    if (!url) return;

    const normalizedUrl = /^(https?:|mailto:|\/)/i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
    setIsLinkEditorOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl, readOnly]);

  const openLinkEditor = useCallback(() => {
    if (!editor || readOnly) return;
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setIsLinkEditorOpen((open) => !open);
  }, [editor, readOnly]);

  const activeBlock = editor?.isActive("heading", { level: 1 })
    ? "h1"
    : editor?.isActive("heading", { level: 2 })
      ? "h2"
      : editor?.isActive("heading", { level: 3 })
        ? "h3"
        : "paragraph";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-surface-white transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 ${className}`}
    >
      <div
        role="toolbar"
        aria-label="Answer text formatting"
        aria-orientation="horizontal"
        className={`flex min-h-11 flex-wrap items-center gap-0.5 border-b border-border bg-bg-primary/45 px-2.5 py-1.5 ${readOnly ? "pointer-events-none opacity-60" : ""}`}
      >
        <Select
          aria-label="Text style"
          value={activeBlock}
          disabled={readOnly}
          onChange={(event) => applyBlockType(event.target.value)}
          options={[
            { value: "paragraph", label: "Paragraph" },
            { value: "h1", label: "Heading 1" },
            { value: "h2", label: "Heading 2" },
            { value: "h3", label: "Heading 3" },
          ]}
          containerClassName="w-[132px]"
          className="h-8 rounded-md border-transparent bg-transparent px-2 text-xs font-medium text-text-secondary shadow-none hover:border-transparent focus-visible:ring-2"
          menuClassName="max-h-52"
        />

        <ToolbarDivider />
        <ToolbarButton label="Bold" icon={Bold} active={editor?.isActive("bold")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <ToolbarButton label="Italic" icon={Italic} active={editor?.isActive("italic")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="Underline" icon={UnderlineIcon} active={editor?.isActive("underline")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
        <ToolbarButton label="Strikethrough" icon={Strikethrough} active={editor?.isActive("strike")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleStrike().run()} />

        <ToolbarDivider />
        <ToolbarButton label="Bullet list" icon={List} active={editor?.isActive("bulletList")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="Numbered list" icon={ListOrdered} active={editor?.isActive("orderedList")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />

        <ToolbarDivider />
        <ToolbarButton label="Add or edit link" icon={LinkIcon} active={editor?.isActive("link") || isLinkEditorOpen} disabled={readOnly} onClick={openLinkEditor} />
        {editor?.isActive("link") && (
          <ToolbarButton label="Remove link" icon={Unlink} disabled={readOnly} onClick={() => editor.chain().focus().unsetLink().run()} />
        )}
        <ToolbarButton label="Inline code" icon={Code2} active={editor?.isActive("code")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleCode().run()} />

        <ToolbarDivider />
        <ToolbarButton label="Superscript" icon={SuperscriptIcon} active={editor?.isActive("superscript")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleSuperscript().run()} />
        <ToolbarButton label="Subscript" icon={SubscriptIcon} active={editor?.isActive("subscript")} disabled={readOnly} onClick={() => editor?.chain().focus().toggleSubscript().run()} />

        <ToolbarDivider />
        <ToolbarButton label="Align left" icon={AlignLeft} active={editor?.isActive({ textAlign: "left" })} disabled={readOnly} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
        <ToolbarButton label="Align center" icon={AlignCenter} active={editor?.isActive({ textAlign: "center" })} disabled={readOnly} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
        <ToolbarButton label="Align right" icon={AlignRight} active={editor?.isActive({ textAlign: "right" })} disabled={readOnly} onClick={() => editor?.chain().focus().setTextAlign("right").run()} />
        <ToolbarButton label="Justify" icon={AlignJustify} active={editor?.isActive({ textAlign: "justify" })} disabled={readOnly} onClick={() => editor?.chain().focus().setTextAlign("justify").run()} />
      </div>

      {isLinkEditorOpen && !readOnly && (
        <form
          className="absolute left-3 top-12 z-10 flex w-[min(24rem,calc(100%-1.5rem))] items-center gap-2 rounded-lg border border-border bg-surface-white p-2 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault();
            setLink();
          }}
        >
          <LinkIcon className="ml-1 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            inputMode="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            aria-label="Link URL"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface-white px-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <button type="submit" disabled={!linkUrl.trim()} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">Apply</button>
          <button type="button" onClick={() => setIsLinkEditorOpen(false)} className="h-9 rounded-md px-2 text-sm text-text-secondary hover:bg-bg-secondary">Cancel</button>
        </form>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
