'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SubmitSuccess } from '@/components/ui/submit-success';
import Loading from '@/components/loading';
import { Send, User, Building2, Briefcase, Monitor } from 'lucide-react';
import { useSessionContext, type UserInfo } from '@/app/context/SessionContext';



interface FormData {
    employee_id: string;
    form_id: string;
    point?: number;
    comment: string;
}

// Rating labels configuration
const RATING_LABELS = ['น้อยที่สุด', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด'] as const;

const RatingScale = ({
    value,
    onChange
}: {
    value: number;
    onChange: (rating: number) => void;
}) => {
    return (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5].map((rating) => {
                const isSelected = value === rating;
                return (
                    <div key={rating} className="flex flex-col items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onChange(rating)}
                            className={`
                                w-9 h-9 sm:w-11 sm:h-11 rounded-lg border-2 transition-all duration-200 
                                flex items-center justify-center text-sm font-bold cursor-pointer
                                ${isSelected
                                    ? 'bg-[#026a75] border-[#026a75] text-white shadow-md'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#026a75]/50 hover:bg-[#026a75]/5'
                                }
                            `}
                            aria-label={`ให้คะแนน ${rating} - ${RATING_LABELS[rating - 1]}`}
                        >
                            {rating}
                        </button>
                        <span className="hidden sm:block text-[10px] text-gray-400 text-center w-12">
                            {RATING_LABELS[rating - 1]}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const SectionHeader = ({
    title,
    description
}: {
    title: string;
    description: string;
}) => (
    <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-3 mb-2">
            <div>
                <h2 className="text-lg sm:text-xl font-semibold text-[#055058] mb-1">{title}</h2>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
        </div>
    </div>
);

export function SurveyITForm({ id }: { id?: string }) {
    const { user }: { user: UserInfo | null } = useSessionContext();
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<FormData>({
        employee_id: '',
        form_id: id || '',
        point: undefined,
        comment: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                employee_id: `${user.employee_id}`,
              
            }));
            setIsLoading(false);
        }
    }, [user]);

    const handleInputChange = useCallback((field: keyof FormData, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);


    const handleClearForm = useCallback(() => {
        setFormData(prev => ({
            ...prev,
            form_id: id || '',
            point: undefined,
            comment: '',
        }));
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/survey-it', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            if (!res.ok) {
                alert('เกิดข้อผิดพลาดในการส่งแบบประเมิน กรุณาลองใหม่อีกครั้ง');
                setIsSubmitting(false);
                return;
            }
            setIsSubmitting(false);
            setIsSubmitted(true);
        } catch {
            alert('เกิดข้อผิดพลาดในการส่งแบบประเมิน กรุณาลองใหม่อีกครั้ง');
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <SubmitSuccess
                title="ส่งแบบประเมินสำเร็จ!"
                description="ขอบคุณสำหรับความคิดเห็นของท่าน"
                showButton={false}
                buttonText="ทำแบบประเมินใหม่"
                onButtonClick={() => {
                    setIsSubmitted(false);
                    handleClearForm();
                }}
            />
        );
    }

    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* Form Content */}
                <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                    <CardContent className="p-4 sm:p-6 lg:p-8">
                        <form onSubmit={handleSubmit} className="space-y-8">

                            {/* Section 1: ข้อมูลทั่วไปของผู้ใช้งาน */}

                            <SectionHeader

                                title="ส่วนที่ 1 : ข้อมูลทั่วไปของผู้ใช้งาน"
                                description="ข้อมูลพื้นฐานของท่าน"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* คอลัมน์ 1: ข้อมูลผู้ใช้ */}
                                <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
                                    <div className="space-y-1">
                                        <Label className="text-gray-500 text-xs flex items-center gap-2">
                                            <User className="w-3 h-3 text-[#026a75]" />
                                            ชื่อ-สกุล
                                        </Label>
                                        <p className="text-gray-800 font-medium">{user?.firstname} {user?.lastname}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-gray-500 text-xs flex items-center gap-2">
                                            <Building2 className="w-3 h-3 text-[#026a75]" />
                                            ฝ่าย
                                        </Label>
                                        <p className="text-gray-800 font-medium">{user?.department || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-gray-500 text-xs flex items-center gap-2">
                                            <Briefcase className="w-3 h-3 text-[#026a75]" />
                                            ตำแหน่ง
                                        </Label>
                                        <p className="text-gray-800 font-medium">{user?.position || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-gray-500 text-xs flex items-center gap-2">
                                            <Briefcase className="w-3 h-3 text-[#026a75]" />
                                            เลขเคสที่ประเมิน
                                        </Label>
                                        <a href={`https://menait-service.vercel.app/mytickets/${formData.form_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-medium">{formData.form_id || '-'}</a>
                                    </div>
                                </div>

                            </div>


                            {/* Section 2: ความพึงพอใจการให้บริการ IT */}
                            <div>
                                <SectionHeader

                                    title="ส่วนที่ 2 : ความพึงพอใจการให้บริการ IT"
                                    description="โปรดให้คะแนนในระดับ 1 = น้อยที่สุด ถึง 5 = มากที่สุด"
                                />
                                <div className="space-y-3">
                
                                        <div
                                
                                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl transition-colors duration-200 ${formData.point ? 'bg-[#026a75]/10' : 'bg-gray-50'}`}
                                        >
                                            
                                            <RatingScale
                                                value={formData.point || 0}
                                                onChange={(value) => handleInputChange('point', value)}
                                            />
                                        </div>
                                 
                                </div>
                            </div>


                            {/* Section 3: ความคิดเห็นเพิ่มเติม */}
                            <div>
                                <SectionHeader

                                    title="ส่วนที่ 3 : ความคิดเห็นเพิ่มเติม"
                                    description="กรุณาระบุข้อเสนอแนะหรือความคิดเห็นเพิ่มเติม (ถ้ามี)"
                                />
                                <Textarea
                                    id="comment"
                                    placeholder=""
                                    value={formData.comment}
                                    onChange={(e) => handleInputChange('comment', e.target.value)}
                                    className="min-h-32 border-gray-300 focus:border-[#026a75] focus:ring-[#026a75]/20 resize-none"
                                    rows={5}
                                />
                            </div>

                            {/* Submit Buttons */}
                            <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                <Button
                                    type="submit"
                                    disabled={formData.point === undefined || isSubmitting}
                                    className="flex-1 h-12 sm:h-14 bg-linear-to-r from-[#026a75] to-[#037a86] hover:from-[#025f68] hover:to-[#026a75] text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            กำลังส่ง...
                                        </div>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                                            ส่งแบบประเมิน
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleClearForm}
                                    className="h-12 sm:h-14 px-6 sm:px-8 text-[#026a75] font-medium rounded-xl sm:rounded-2xl hover:bg-[#026a75]/10 hover:text-[#025f68] transition-all duration-300 group"
                                >
                                    <svg
                                        className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:rotate-180 transition-transform duration-500"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    ล้างฟอร์ม
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Loading Overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-gray-500/60">
                    <Loading />
                </div>
            )}

            {isLoading && (
                <div className="fixed inset-0 z-9999 flex items-center justify-center bg-gray-500/60">
                    <Loading />
                </div>
            )}
        </main>
    );
}
