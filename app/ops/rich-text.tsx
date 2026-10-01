'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { AArrowDown, AArrowUp, Bold, Check, Highlighter, Link2, Unlink, Underline, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Rich text for long-form fields (e.g. Requirement). Stored as HTML; formatting is applied
 * from a bubble toolbar that appears when text is selected with the mouse.
 * Rendering goes back through the same Tiptap schema, so unknown tags/attributes and
 * javascript: links are dropped rather than injected.
 */

const extensions = (placeholder = '') => [
    StarterKit.configure({
        heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } },
    }),
    Highlight,
    TextStyle,
    FontSize,
    Placeholder.configure({ placeholder }),
];

/** null = default body size */
const FONT_SIZES = ['12px', null, '16px', '18px', '22px'] as const;

const CONTENT_CLASS = cn(
    'text-sm leading-relaxed text-gray-800',
    '[&_p]:my-0 [&_p+p]:mt-1.5',
    '[&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_li]:my-0.5',
    '[&_mark]:bg-yellow-200 [&_mark]:rounded-sm [&_mark]:px-0.5',
    '[&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2',
);

const PLACEHOLDER_CLASS = cn(
    '[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
    '[&_p.is-editor-empty:first-child]:before:text-gray-400 [&_p.is-editor-empty:first-child]:before:float-left',
    '[&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:pointer-events-none',
    '[&_p.is-editor-empty:first-child]:before:whitespace-pre-line',
);

/** Plain-text values from before the editor existed. */
export const isRichText = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

export function RichTextEditor({ id, value, onChange, placeholder, invalid, className }: {
    id: string; value: string; onChange: (html: string) => void;
    placeholder?: string; invalid?: boolean; className?: string;
}) {
    const editor = useEditor({
        extensions: extensions(placeholder),
        content: value,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                id,
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-invalid': String(Boolean(invalid)),
                class: cn(CONTENT_CLASS, PLACEHOLDER_CLASS, 'min-h-32 px-4 py-3 focus:outline-none'),
            },
        },
        onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    });

    // external changes (form reset) — skip when the value came from typing
    useEffect(() => {
        if (!editor) return;
        const current = editor.isEmpty ? '' : editor.getHTML();
        if (value !== current) editor.commands.setContent(value, { emitUpdate: false });
    }, [editor, value]);

    return (
        <div className={cn(
            'rounded-xl border bg-white transition-all duration-200 hover:border-brand-600/40',
            'focus-within:ring-2 focus-within:ring-brand-600/20 focus-within:border-brand-600',
            className,
        )}>
            {editor && <SelectionToolbar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}

function SelectionToolbar({ editor }: { editor: Editor }) {
    const [linkMode, setLinkMode] = useState(false);
    const [url, setUrl] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            bold: e.isActive('bold'),
            underline: e.isActive('underline'),
            highlight: e.isActive('highlight'),
            link: e.isActive('link'),
            href: (e.getAttributes('link').href as string | undefined) ?? '',
            fontSize: (e.getAttributes('textStyle').fontSize as string | undefined) ?? null,
        }),
    });

    const sizeIndex = FONT_SIZES.indexOf(s.fontSize as (typeof FONT_SIZES)[number]);
    const stepSize = (dir: 1 | -1) => {
        const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, (sizeIndex < 0 ? 1 : sizeIndex) + dir))];
        const chain = editor.chain().focus();
        (next ? chain.setFontSize(next) : chain.unsetFontSize()).run();
    };

    const openLink = () => {
        setUrl(s.href);
        setLinkMode(true);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const closeLink = () => {
        setLinkMode(false);
        editor.commands.focus();
    };

    const applyLink = () => {
        const href = url.trim();
        const chain = editor.chain().focus().extendMarkRange('link');
        (href ? chain.setLink({ href }) : chain.unsetLink()).run();
        setLinkMode(false);
    };

    return (
        <BubbleMenu
            editor={editor}
            options={{ placement: 'top', offset: 8 }}
            className="z-50 flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-lg shadow-gray-900/10"
        >
            {linkMode ? (
                // not a <form>: React bubbles submit through the portal and would submit the page form
                <div
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); applyLink(); }
                        if (e.key === 'Escape') { e.preventDefault(); closeLink(); }
                    }}
                    className="flex items-center gap-1"
                >
                    <Link2 className="ml-1.5 size-4 text-gray-400" />
                    <input
                        ref={inputRef}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="วางลิงก์ เช่น https://…"
                        aria-label="ลิงก์"
                        className="h-8 w-56 rounded-lg px-2 text-sm focus:outline-none"
                    />
                    <ToolButton icon={Check} label="ใส่ลิงก์" onClick={applyLink} />
                    <ToolButton icon={X} label="ยกเลิก" onClick={closeLink} />
                </div>
            ) : (
                <>
                    <ToolButton icon={Bold} label="ตัวหนา" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
                    <ToolButton icon={Underline} label="ขีดเส้นใต้" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
                    <ToolButton icon={Highlighter} label="ไฮไลต์" active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()} />
                    <Divider />
                    <ToolButton icon={AArrowDown} label="ลดขนาดตัวอักษร" disabled={sizeIndex === 0} onClick={() => stepSize(-1)} />
                    <ToolButton icon={AArrowUp} label="เพิ่มขนาดตัวอักษร" disabled={sizeIndex === FONT_SIZES.length - 1} onClick={() => stepSize(1)} />
                    <Divider />
                    <ToolButton icon={Link2} label={s.link ? 'แก้ไขลิงก์' : 'แนบลิงก์'} active={s.link} onClick={openLink} />
                    {s.link && <ToolButton icon={Unlink} label="เอาลิงก์ออก" onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} />}
                </>
            )}
        </BubbleMenu>
    );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-gray-200" />;

function ToolButton({ icon: Icon, label, active, ...props }: {
    icon: LucideIcon; label: string; active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            // keep the text selection while clicking
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
                'grid size-8 place-items-center rounded-lg text-gray-600 transition-colors cursor-pointer',
                'hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-35',
                active && 'bg-brand-100 text-brand-700 hover:bg-brand-100 hover:text-brand-700',
            )}
            {...props}
        >
            <Icon className="size-4" strokeWidth={2.25} />
        </button>
    );
}

/** Read-only render of stored HTML through the editor schema (sanitising by construction). */
export function RichTextView({ html, className }: { html: string; className?: string }) {
    const editor = useEditor({
        extensions: extensions(),
        content: html,
        editable: false,
        immediatelyRender: false,
        editorProps: { attributes: { class: CONTENT_CLASS } },
    }, [html]);

    return <EditorContent editor={editor} className={className} />;
}
