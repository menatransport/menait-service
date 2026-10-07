'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownSearch } from '@/components/ui/dropdown/issue';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SubmitSuccess } from '@/components/ui/submit-success';
import Loading from '@/components/loading';
import { Send, User, Building2, Briefcase, Monitor, Lock, History } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSessionContext, type UserInfo } from '@/app/context/SessionContext';
import { getMySurvey, submitSurvey } from '@/app/ops/api';
import type { OpsSurveyResponse } from '@/app/ops/types';
import { SECTION_2_QUESTIONS, SECTION_3_QUESTIONS } from '../questions';

const SYSTEMS_OPTIONS = [
    'ระบบ ERP',
    'ระบบ CRM',
    'ระบบ HR',
    'ระบบ Inventory',
    'ระบบ POS',
    'ระบบ Accounting',
    'ระบบ BI/Dashboard',
    'ระบบ E-mail/Office365',
    'ระบบ Network/VPN',
    'อื่นๆ',
];

interface FormData {
    fullName: string;
    department: string;
    position: string;
    system: string;
    section2Ratings: Record<number, number>;
    section3Ratings: Record<number, number>;
    additionalComments: string;
}

// Rating labels configuration
const RATING_LABELS = ['น้อยที่สุด', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด'] as const;

const RatingScale = ({
    questionId,
    value,
    onChange
}: {
    questionId: number;
    value: number;
    onChange: (id: number, rating: number) => void;
}) => {
    return (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5].map((rating) => {
                const isSelected = value === rating;
                return (
                    <div key={rating} className="flex flex-col items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onChange(questionId, rating)}
                            className={`
                                w-9 h-9 sm:w-11 sm:h-11 rounded-lg border-2 transition-all duration-200 
                                flex items-center justify-center text-sm font-bold cursor-pointer
                                ${isSelected
                                    ? 'bg-brand-600 border-brand-600 text-white shadow-md'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-brand-600/50 hover:bg-brand-600/5'
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
            {/* <div className="w-10 h-10 bg-linear-to-br from-brand-600 to-brand-500 rounded-xl flex items-center justify-center shadow-md">
                <Icon className="w-5 h-5 text-white" />
            </div> */}
            <div>
                <h2 className="text-lg sm:text-xl font-semibold text-brand-800 mb-1">{title}</h2>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
        </div>
    </div>
);

export function SurveyOPSForm({ systems, locked = false, doneHref }: {
    systems: Array<{ system_id: string; system: string }>;
    /** Opened from an OPS review: the system is fixed to that project */
    locked?: boolean;
    /** Where the success screen sends the user (e.g. back to Project Status) */
    doneHref?: string;
}) {
    const router = useRouter();
    const { user } = useSessionContext();
    const [formData, setFormData] = useState<FormData>({
        fullName: '',
        department: '',
        position: '',
        system: '',
        section2Ratings: {},
        section3Ratings: {},
        additionalComments: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    /** The user's earlier answer for the chosen system — its scores are loaded into the form to edit */
    const [previous, setPrevious] = useState<OpsSurveyResponse | null>(null);
    const filledFromPrevious = useRef(false);

    // choosing a system brings back an earlier answer; moving off one clears what it filled in
    useEffect(() => {
        if (!user || !formData.system) { setPrevious(null); return; }
        let alive = true;
        const toRatings = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [Number(k), v]));
        getMySurvey(formData.system)
            .then(found => {
                if (!alive) return;
                if (found) {
                    setFormData(f => ({
                        ...f,
                        section2Ratings: toRatings(found.section2),
                        section3Ratings: toRatings(found.section3),
                        additionalComments: found.comment ?? '',
                    }));
                } else if (filledFromPrevious.current) {
                    setFormData(f => ({ ...f, section2Ratings: {}, section3Ratings: {}, additionalComments: '' }));
                }
                filledFromPrevious.current = Boolean(found);
                setPrevious(found);
            })
            .catch(err => console.error('Error loading the earlier survey answer:', err));
        return () => { alive = false; };
    }, [user, formData.system]);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                fullName: `${user.firstname} ${user.lastname}`,
                department: user.department,
                position: user.position,
            }));
        }
    }, [user]);

    useEffect(() => {
        if (systems.length === 1 && !formData.system) {
            setFormData(prev => ({
                ...prev,
                system: systems[0].system_id,
            }));
        }
    }, [systems, formData.system]);

    const handleInputChange = useCallback((field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSection2Rating = useCallback((questionId: number, rating: number) => {
        setFormData(prev => ({
            ...prev,
            section2Ratings: { ...prev.section2Ratings, [questionId]: rating }
        }));
    }, []);

    const handleSection3Rating = useCallback((questionId: number, rating: number) => {
        setFormData(prev => ({
            ...prev,
            section3Ratings: { ...prev.section3Ratings, [questionId]: rating }
        }));
    }, []);

    const handleClearForm = useCallback(() => {
        setFormData(prev => ({
            ...prev,
            system: locked ? prev.system : '',
            section2Ratings: {},
            section3Ratings: {},
            additionalComments: '',
        }));
    }, [locked]);

    const isFormValid = () => {
        const hasBasicInfo = formData.fullName && formData.department && formData.position && formData.system;
        const hasAllSection2 = SECTION_2_QUESTIONS.every(q => formData.section2Ratings[q.id]);
        const hasAllSection3 = SECTION_3_QUESTIONS.every(q => formData.section3Ratings[q.id]);
        return hasBasicInfo && hasAllSection2 && hasAllSection3;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid()) return;

        setIsSubmitting(true);

        try {
            // saved in MongoDB (ops.surveys) — the project sheet reads its results from there
            await submitSurvey({
                system_id: formData.system,
                system_name: systems.find(s => s.system_id === formData.system)?.system ?? null,
                section2: formData.section2Ratings,
                section3: formData.section3Ratings,
                comment: formData.additionalComments || null,
            });
            setIsSubmitted(true);
        } catch (err) {
            alert(err instanceof Error && err.message ? err.message : 'เกิดข้อผิดพลาดในการส่งแบบประเมิน กรุณาลองใหม่อีกครั้ง');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <SubmitSuccess
                title={previous ? 'บันทึกการแก้ไขแล้ว!' : 'ส่งแบบประเมินสำเร็จ!'}
                description="ขอบคุณสำหรับความคิดเห็นของท่าน"
                buttonText={doneHref ? 'กลับไปหน้า Project Status' : 'ทำแบบประเมินใหม่'}
                onButtonClick={() => {
                    if (doneHref) { router.push(doneHref); return; }
                    setIsSubmitted(false);
                    handleClearForm();
                }}
            />
        );
    }

    return (
        <main className="flex-1 min-h-0 v2-canvas rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
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
                                            <User className="w-3 h-3 text-brand-600" />
                                            ชื่อ-สกุล
                                        </Label>
                                        <p className="text-gray-800 font-medium">{formData.fullName || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-gray-500 text-xs flex items-center gap-2">
                                            <Building2 className="w-3 h-3 text-brand-600" />
                                            ฝ่าย
                                        </Label>
                                        <p className="text-gray-800 font-medium">{formData.department || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-gray-500 text-xs flex items-center gap-2">
                                            <Briefcase className="w-3 h-3 text-brand-600" />
                                            ตำแหน่ง
                                        </Label>
                                        <p className="text-gray-800 font-medium">{formData.position || '-'}</p>
                                    </div>
                                </div>

                                {/* คอลัมน์ 2: ระบบที่ทำการประเมิน */}
                                <div className="space-y-2">
                                    <Label htmlFor="system" className="text-gray-700 font-medium flex items-center gap-2">
                                        <Monitor className="w-4 h-4 text-brand-600" />
                                        ระบบที่ทำการประเมิน <span className="text-red-500">*</span>
                                    </Label>
                                    <DropdownSearch
                                        value={formData.system}
                                        onChange={(value) => handleInputChange('system', value)}
                                        options={systems.map(sys => ({
                                            option_value: sys.system_id,
                                            option_label: sys.system_id + " " + sys.system
                                        }))}
                                        placeholder="-- กรุณาเลือกระบบ --"
                                        disabled={locked}
                                    />
                                    {locked && (
                                        <p className="flex items-center gap-1.5 text-xs text-gray-500">
                                            <Lock className="w-3 h-3 text-brand-600" />
                                            ระบบนี้มาจากการตรวจรับงาน — กรุณาประเมินให้ครบเพื่อปิดขั้นตอน
                                        </p>
                                    )}
                                </div>
                            </div>


                            {previous && (
                                <div role="status" className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                                    <History className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-semibold text-brand-800">คุณเคยประเมินโปรเจกต์นี้แล้ว</p>
                                        <p className="text-gray-600">
                                            เมื่อ {new Date(previous.updated_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} — คะแนนเดิมถูกใส่ไว้ให้แล้ว แก้ไขแล้วกดบันทึกเพื่อบันทึกทับ
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Section 2: ความพึงพอใจในการใช้งานระบบ */}
                            <div>
                                <SectionHeader

                                    title="ส่วนที่ 2 : ความพึงพอใจในการใช้งานระบบ"
                                    description="โปรดให้คะแนนในระดับ 1 = น้อยที่สุด ถึง 5 = มากที่สุด"
                                />
                                <div className="space-y-3">
                                    {SECTION_2_QUESTIONS.map((q, index) => (
                                        <div
                                            key={q.id}
                                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-sm font-semibold shrink-0">
                                                    {q.id}
                                                </span>
                                                <span className="text-gray-700 font-medium">{q.question}</span>
                                            </div>
                                            <RatingScale
                                                questionId={q.id}
                                                value={formData.section2Ratings[q.id] || 0}
                                                onChange={handleSection2Rating}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3: การจัดการปัญหาและการสนับสนุน */}
                            <div>
                                <SectionHeader

                                    title="ส่วนที่ 3 : การจัดการปัญหาและการสนับสนุน"
                                    description="โปรดให้คะแนนในระดับ 1 = น้อยที่สุด ถึง 5 = มากที่สุด"
                                />
                                <div className="space-y-3">
                                    {SECTION_3_QUESTIONS.map((q, index) => (
                                        <div
                                            key={q.id}
                                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl transition-colors ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-sm font-semibold shrink-0">
                                                    {q.id}
                                                </span>
                                                <span className="text-gray-700 font-medium">{q.question}</span>
                                            </div>
                                            <RatingScale
                                                questionId={q.id}
                                                value={formData.section3Ratings[q.id] || 0}
                                                onChange={handleSection3Rating}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4: ความคิดเห็นเพิ่มเติม */}
                            <div>
                                <SectionHeader

                                    title="ส่วนที่ 4 : ความคิดเห็นเพิ่มเติม"
                                    description="กรุณาระบุข้อเสนอแนะหรือความคิดเห็นเพิ่มเติม (ถ้ามี)"
                                />
                                <Textarea
                                    id="additionalComments"
                                    placeholder=""
                                    value={formData.additionalComments}
                                    onChange={(e) => handleInputChange('additionalComments', e.target.value)}
                                    className="min-h-32 border-gray-300 focus:border-brand-600 focus:ring-brand-600/20 resize-none"
                                    rows={5}
                                />
                            </div>

                            {/* Submit Buttons */}
                            <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                <Button
                                    type="submit"
                                    disabled={!isFormValid() || isSubmitting}
                                    className="flex-1 h-12 sm:h-14 bg-linear-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            กำลังส่ง...
                                        </div>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                                            {previous ? 'บันทึกการแก้ไข' : 'ส่งแบบประเมิน'}
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleClearForm}
                                    className="h-12 sm:h-14 px-6 sm:px-8 text-brand-600 font-medium rounded-xl sm:rounded-2xl hover:bg-brand-600/10 hover:text-brand-700 transition-all duration-300 group"
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
                <div className="fixed inset-0 z-9999 flex items-center justify-center v2-loader-overlay">
                    <Loading />
                </div>
            )}
        </main>
    );
}
