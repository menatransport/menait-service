'use client';
import React, { memo } from 'react';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { BadgeCheck } from 'lucide-react';
import { ProfileForm } from '@/components/profile-form';
import type { UserData } from '@/components/profile-form';

interface UserDetailSheetProps {
    user: UserData | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-red-100 text-red-700',
    probation: 'bg-amber-100 text-amber-700',
};

const getStatusColor = (s: string | null) =>
    STATUS_COLORS[(s || '').toLowerCase()] || 'bg-gray-100 text-gray-600';

export const UserDetailSheet = memo(({ user, open, onOpenChange }: UserDetailSheetProps) => {
    if (!user) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">

                {/* ── Header ── */}
                <SheetHeader className="bg-linear-to-br from-[#026a75] to-[#037a86] px-5 pt-6 pb-5 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0">
                            {user.email?.charAt(0).toUpperCase()}{user.email?.charAt(user.email.indexOf('@') - 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <SheetTitle className="text-white text-base font-bold truncate">
                                {user.firstname} {user.lastname}
                            </SheetTitle>
                            <SheetDescription className="text-white/60 text-xs truncate mt-0.5">
                                {user.email}
                            </SheetDescription>
                        </div>
                    </div>

                    {/* Quick info pills */}
                    <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[11px] font-medium">
                            <BadgeCheck className="w-3 h-3" />
                            {user.employee_id}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${getStatusColor(user.employee_status)}`}>
                            {user.employee_status || '-'}
                        </span>
                    </div>
                </SheetHeader>

                {/* ── Body — shared ProfileForm (compact, read-only) ── */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    <ProfileForm
                        data={user}
                        editable={false}
                        variant="compact"
                    />
                </div>

                {/* ── Footer ── */}
                <SheetFooter className="border-t border-gray-100 px-5 py-3">
                    <p className="text-[10px] text-gray-400 text-center w-full">
                        ID: {user.id} · Username: {user.username}
                    </p>
                </SheetFooter>

            </SheetContent>
        </Sheet>
    );
});
UserDetailSheet.displayName = 'UserDetailSheet';
