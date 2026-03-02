'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { Upload, X, ImageIcon, Eye } from 'lucide-react';

export interface FileDropzoneProps {
    files: File[];
    onChange: (files: File[]) => void;
    maxSizeMB?: number;
    disabled?: boolean;
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileDropzone = memo(({
    files,
    onChange,
    maxSizeMB = 10,
    disabled = false,
}: FileDropzoneProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const setFile = useCallback((file: File) => {
        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) {
            alert(`ไฟล์มีขนาดเกิน ${maxSizeMB} MB`);
            return;
        }
        if (!file.type.match(/^image\/(png|jpeg)$/)) {
            alert('รองรับเฉพาะไฟล์ PNG และ JPEG เท่านั้น');
            return;
        }
        // Revoke old preview
        if (preview) URL.revokeObjectURL(preview);
        const url = URL.createObjectURL(file);
        setPreview(url);
        onChange([file]);
    }, [maxSizeMB, preview, onChange]);

    const removeFile = useCallback(() => {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        onChange([]);
    }, [preview, onChange]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    }, [disabled, setFile]);

    const handleClick = useCallback(() => {
        if (!disabled) inputRef.current?.click();
    }, [disabled]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            e.target.value = '';
        }
    }, [setFile]);

    const file = files[0] ?? null;

    return (
        <div className="space-y-3">
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 overflow-hidden
                    ${file && preview ? 'p-0' : 'p-6'}
                    ${disabled
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                        : isDragging
                            ? 'border-[#026a75] bg-[#026a75]/5 scale-[1.01]'
                            : 'border-gray-300 bg-white hover:border-[#026a75]/40 hover:bg-[#026a75]/2'
                    }
                `}
            >
                {file && preview ? (
                    /* Preview inside dropzone */
                    <div className="relative w-full">
                        <div className="relative group/preview">
                            <img
                                src={preview}
                                alt={file.name}
                                className="w-full max-h-64 object-contain bg-gray-50"
                            />
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxOpen(true);
                                }}
                                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/preview:bg-black/30 transition-all duration-200"
                            >
                                <div className="w-10 h-10 cursor-pointer rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200 shadow-md">
                                    <Eye className="w-5 h-5 text-gray-700" />
                                </div>
                            </button>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-gray-100">
                            <div className="flex items-center gap-2 min-w-0">
                                <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-xs text-gray-600 truncate">{file.name}</span>
                                <span className="text-[10px] text-gray-400 shrink-0">({formatSize(file.size)})</span>
                            </div>
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFile();
                                    }}
                                    className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer text-red-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Empty state */
                    <>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-[#026a75]/10' : 'bg-gray-100'}`}>
                            <Upload className={`w-5 h-5 ${isDragging ? 'text-[#026a75]' : 'text-gray-400'}`} />
                        </div>
                        <div className="text-center">
                            <p className={`text-sm font-medium ${isDragging ? 'text-[#026a75]' : 'text-gray-600'}`}>
                                ลากรูปมาวางที่นี่ หรือ <span className="text-[#026a75] underline underline-offset-2">เลือกรูป</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                PNG, JPEG · ไม่เกิน {maxSizeMB} MB
                            </p>
                        </div>
                    </>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleInputChange}
                    className="hidden"
                />
            </div>

            {/* Lightbox */}
            {lightboxOpen && preview && (
                <div
                    className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={() => setLightboxOpen(false)}
                >
                    <button
                        type="button"
                        onClick={() => setLightboxOpen(false)}
                        className="absolute top-4 right-4 w-9 h-9 cursor-pointer rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
                    >
                        <X className="w-12 h-12 text-white" />
                    </button>
                    <img
                        src={preview}
                        alt={file?.name || ''}
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
});
FileDropzone.displayName = 'FileDropzone';
