'use client';

import { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, User } from 'lucide-react';
import Loading from '@/components/loading';
import { ProfileForm } from '@/components/profile-form';
export type { UserData } from '@/components/profile-form';
import type { UserData } from '@/components/profile-form';

interface SettingComponentProps {
    formData: UserData | null;
    role: string | null;
    isLoading: boolean;
    error?: string | null;
    onRetry?: () => void;
}

export const SettingComponent: React.FC<SettingComponentProps> = ({
    formData, role, isLoading, error, onRetry
}) => {
    const isAdmin = role === 'a';

    const handleSave = useCallback(async (merged: UserData): Promise<boolean> => {
        try {
            const res = await fetch(`/api/setting-api`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(merged),
            });
            return res.ok;
        } catch (err) {
            console.error('Save failed:', err);
            return false;
        }
    }, []);

    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* Loading */}
                {isLoading ? (
                    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-gray-500/60">
                        <Loading />
                    </div>

                ) : error ? (
                    /* Error State */
                    <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                        <CardContent className="p-8 sm:p-12">
                            <div className="flex flex-col items-center gap-4 text-center max-w-sm mx-auto">
                                <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center">
                                    <AlertCircle className="h-8 w-8 text-red-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-gray-700">เกิดข้อผิดพลาด</p>
                                    <p className="text-xs text-gray-500">{error}</p>
                                </div>
                                {onRetry && (
                                    <Button
                                        onClick={onRetry}
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 gap-2"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        ลองใหม่อีกครั้ง
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                ) : !formData ? (
                    /* Empty State */
                    <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                        <CardContent className="p-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-4">
                                <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                                    <User className="h-8 w-8 text-gray-300" />
                                </div>
                                <p className="text-sm">ไม่พบข้อมูลผู้ใช้งาน</p>
                            </div>
                        </CardContent>
                    </Card>

                ) : (
                    /* Main Content — shared ProfileForm */
                    <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                        <CardContent className="p-4 sm:p-6 lg:p-8">
                            <ProfileForm
                                data={formData}
                                editable={isAdmin}
                                role={role}
                                variant="full"
                                onSave={isAdmin ? handleSave : undefined}
                            />
                        </CardContent>
                    </Card>
                )}

            </div>
        </main>
    );
};