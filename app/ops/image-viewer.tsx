'use client';

import { useCallback, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OpsAttachment } from './types';

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const STEP = 1.4;

const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

const ToolButton = ({ label, onClick, disabled, children }: {
    label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
    >
        {children}
    </button>
);

/**
 * Full-screen image viewer: wheel / buttons / double-click to zoom, drag to pan,
 * ← → (keys or arrows) between the images of one list.
 */
export function ImageViewer({ images, index, onIndexChange, onClose }: {
    images: OpsAttachment[];
    /** null = closed */
    index: number | null;
    onIndexChange: (i: number) => void;
    onClose: () => void;
}) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
    const current = index === null ? null : images[index];
    const many = images.length > 1;

    const reset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);
    // every picture starts fitted to the screen
    const close = () => { reset(); onClose(); };

    const zoomTo = (z: number) => {
        const next = clamp(z);
        setZoom(next);
        if (next === 1) setPan({ x: 0, y: 0 });
    };

    const go = useCallback((delta: number) => {
        if (index === null || !many) return;
        reset();
        onIndexChange((index + delta + images.length) % images.length);
    }, [index, many, images.length, onIndexChange, reset]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === '+' || e.key === '=') zoomTo(zoom * STEP);
        else if (e.key === '-') zoomTo(zoom / STEP);
        else if (e.key === '0') reset();
    };

    return (
        <DialogPrimitive.Root open={current !== null} onOpenChange={(open) => { if (!open) close(); }}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/90 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    onKeyDown={onKeyDown}
                    className="fixed inset-0 z-[60] flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
                >
                    {current && (
                        <>
                            <div className="relative z-10 flex items-center gap-2 px-4 py-3 text-white bg-black/60">
                                <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {current.file_name}
                                </DialogPrimitive.Title>
                                <DialogPrimitive.Description className="sr-only">ดูรูปแนบ ซูมด้วยล้อเมาส์หรือปุ่ม + −</DialogPrimitive.Description>
                                {many && <span className="text-xs text-white/60 tabular-nums">{index! + 1} / {images.length}</span>}
                                <ToolButton label="ซูมออก" onClick={() => zoomTo(zoom / STEP)} disabled={zoom <= MIN_ZOOM}><ZoomOut className="w-5 h-5" /></ToolButton>
                                <span className="w-12 text-center text-xs tabular-nums text-white/80">{Math.round(zoom * 100)}%</span>
                                <ToolButton label="ซูมเข้า" onClick={() => zoomTo(zoom * STEP)} disabled={zoom >= MAX_ZOOM}><ZoomIn className="w-5 h-5" /></ToolButton>
                                <ToolButton label="ขนาดพอดีจอ" onClick={reset} disabled={zoom === 1}><RotateCcw className="w-4.5 h-4.5" /></ToolButton>
                                <a
                                    href={current.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="เปิดในแท็บใหม่"
                                    title="เปิดในแท็บใหม่"
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/15"
                                >
                                    <ExternalLink className="w-4.5 h-4.5" />
                                </a>
                                <DialogPrimitive.Close
                                    aria-label="ปิด"
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/15 cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </DialogPrimitive.Close>
                            </div>

                            <div
                                className={cn(
                                    'relative flex-1 overflow-hidden flex items-center justify-center touch-none select-none',
                                    zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
                                )}
                                onWheel={(e) => zoomTo(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
                                onDoubleClick={() => (zoom > 1 ? reset() : zoomTo(2.5))}
                                onPointerDown={(e) => {
                                    // the ← → buttons sit on top of the stage and must keep their clicks
                                    if (zoom <= 1 || (e.target as HTMLElement).closest('button')) return;
                                    e.currentTarget.setPointerCapture(e.pointerId);
                                    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
                                }}
                                onPointerMove={(e) => {
                                    const d = drag.current;
                                    if (!d) return;
                                    setPan({ x: d.px + (e.clientX - d.x) / zoom, y: d.py + (e.clientY - d.y) / zoom });
                                }}
                                onPointerUp={() => { drag.current = null; }}
                                onPointerCancel={() => { drag.current = null; }}
                                // a click on the dark area (not the picture) closes, like most viewers
                                onClick={(e) => { if (e.target === e.currentTarget && zoom === 1) close(); }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element -- S3 URL, shown as-is */}
                                <img
                                    src={current.url}
                                    alt={current.file_name}
                                    draggable={false}
                                    className="max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-5rem)] object-contain transition-transform duration-100 ease-out"
                                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                                />
                                {many && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => go(-1)}
                                            aria-label="รูปก่อนหน้า"
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 cursor-pointer"
                                        >
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => go(1)}
                                            aria-label="รูปถัดไป"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 cursor-pointer"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
