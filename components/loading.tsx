'use client';

import { Mascot } from '@/components/mascot';
import { cn } from '@/lib/utils';

interface MascotLoaderProps {
    text?: string;
    /** "screen" = on the full-page gradient, "inline" = on light surfaces */
    variant?: 'screen' | 'inline';
    size?: number;
}

export function MascotLoader({ text = 'กำลังโหลดข้อมูล', variant = 'inline', size = 96 }: MascotLoaderProps) {
    const onScreen = variant === 'screen';
    return (
        <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-8">
            <div className="relative" style={{ width: size, height: size }}>
                <div className={cn('v2-loader-ring', !onScreen && 'on-light')} />
                <Mascot size={size} motion="hop" />
            </div>
            <span
                className={cn(
                    'font-display text-base sm:text-lg font-medium tracking-wide flex items-center gap-1.5',
                    onScreen ? 'text-white' : 'text-brand-700'
                )}
            >
                {text}
                <span className="v2-loader-dots inline-flex items-center gap-1.5 ml-1" aria-hidden="true">
                    <i /><i /><i />
                </span>
            </span>
        </div>
    );
}

/**
 * Loader for dark/blue backdrops. Place inside `.v2-loader-screen` (route loading)
 * or `.v2-loader-overlay` (in-page blocking overlay).
 */
export default function Loading({ text }: { text?: string }) {
    return <MascotLoader text={text} variant="screen" size={120} />;
}
