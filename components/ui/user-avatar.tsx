'use client';

import { memo, useState } from 'react';

/**
 * Build initials for the avatar fallback.
 * - Prefer the display name ("สมชาย ใจดี" → "สใ")
 * - Fall back to the email local-part ("somchai.j@mena.co.th" → "SJ")
 */
export const getAvatarInitials = (name?: string | null, email?: string | null): string => {
    const cleaned = (name ?? '').trim();
    if (cleaned) {
        const parts = cleaned.split(/\s+/).filter(Boolean);
        const first = parts[0]?.charAt(0) ?? '';
        const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
        return (first + last).toUpperCase();
    }
    if (email?.includes('@')) {
        const atIndex = email.indexOf('@');
        return (email.charAt(0) + email.charAt(atIndex - 1)).toUpperCase();
    }
    return email?.charAt(0).toUpperCase() || '?';
};

export interface UserAvatarProps {
    /** users.image_url — the source of truth for every avatar in the app */
    imageUrl?: string | null;
    /** Display name used for the initials fallback + alt text */
    name?: string | null;
    /** Email used for the initials fallback when no name is available */
    email?: string | null;
    /** Sizing / ring / shadow classes for the outer box */
    className?: string;
    /** Corner radius — full circle by default */
    rounded?: string;
    /** Background + text colour of the initials fallback */
    fallbackClassName?: string;
    /** Font size / weight of the initials */
    textClassName?: string;
}

export const UserAvatar = memo(({
    imageUrl,
    name,
    email,
    className = 'w-10 h-10',
    rounded = 'rounded-full',
    fallbackClassName = 'bg-linear-to-br from-[#026a75] to-[#034d54] text-white',
    textClassName = 'text-sm font-semibold',
}: UserAvatarProps) => {
    // Track the src that failed rather than a boolean, so a new image_url
    // (e.g. after a profile update) is retried without needing an effect.
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    const showImage = Boolean(imageUrl) && failedSrc !== imageUrl;
    const label = (name ?? '').trim() || email || 'avatar';

    return (
        <div className={`relative shrink-0 overflow-hidden ${rounded} ${className}`}>
            {showImage ? (
                <img
                    src={imageUrl as string}
                    alt={label}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={() => setFailedSrc(imageUrl ?? null)}
                />
            ) : (
                <div className={`w-full h-full flex items-center justify-center select-none ${fallbackClassName} ${textClassName}`}>
                    {getAvatarInitials(name, email)}
                </div>
            )}
        </div>
    );
});
UserAvatar.displayName = 'UserAvatar';
