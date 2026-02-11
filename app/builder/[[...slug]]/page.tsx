'use client'

import { useEffect, useState } from "react"
import { Navbar } from "@/components/navbar"
import {
    Plus,
    Trash2,
    GripVertical,
    ChevronDown,
    ChevronUp,
    Eye,
    Save,
    FileText,
    Settings,
    ListChecks,
    CheckSquare,
    Hash,
    Calendar,
    FileType,
    X,
    Type,
    RotateCcw,
    Pencil,
    SquareFunction
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownSearch } from "@/components/ui/dropdown/issue"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import Swal from 'sweetalert2'
import { useParams } from 'next/navigation'

interface Option {
    option_value: string
    option_label: string
    option_filter: string
}

interface Question {
    id: string
    question_name: string
    question_label: string
    is_required: boolean
    sort_order: number
    question_type: string
    options: Option[]
}

interface FormSetup {
    form_type: string
    form_code: string
    form_name: string
    need_approval: boolean | null
    form_status: "Active" | "Inactive" | "Draft" | ""
    questions: Question[]
}

interface RuleSetup {
    form_code: string
    level_no: number
    creator_min: number
    creator_max: number
    approve_by_type: string
    approve_by_min: number
    approve_by_max: number
    same_department: boolean
    is_active: boolean
}

interface PositionSetup {
    level_name: string
    position_level_id: number
}


const questionTypeConfig: Record<string, { label: string; icon: React.ElementType; hasOptions: boolean }> = {
    title: { label: "หัวข้อ (Title)", icon: Type, hasOptions: false },
    text: { label: "ข้อความสั้น (Short Text)", icon: FileType, hasOptions: false },
    longtext: { label: "ข้อความยาว (Long Text)", icon: FileText, hasOptions: false },
    number: { label: "ตัวเลข (Number)", icon: Hash, hasOptions: false },
    dropdown: { label: "ตัวเลือก (Dropdown)", icon: ListChecks, hasOptions: true },
    multiselect: { label: "หลายตัวเลือก (Multiselect)", icon: CheckSquare, hasOptions: true },
    datetime: { label: "วันที่และเวลา (Datetime)", icon: Calendar, hasOptions: false },
}

export default function BuilderPage() {
    const [formData, setFormData] = useState<FormSetup>({
        form_type: "",
        form_code: "",
        form_name: "",
        need_approval: null,
        form_status: "",
        questions: []
    })

    const [formRule, setFormRule] = useState<RuleSetup[]>([])
    const [position, setPosition] = useState<PositionSetup[]>([])

    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    const params = useParams();

    const [builderMode, setBuilderMode] = useState<"edit" | "create">("create")

    const form_type = [{ option_value: "Issue", option_label: "ฟอร์มแจ้งปัญหา" }, { option_value: "Service", option_label: "ฟอร์มขอใช้บริการ" }]

    const form_status_options = [
        { option_value: "Active", option_label: "เปิดใช้งาน" },
        { option_value: "Inactive", option_label: "ปิดใช้งาน" },
        { option_value: "Draft", option_label: "แบบร่าง" }
    ]

    const approval_options = [
        { option_value: "true", option_label: "ต้องอนุมัติ" },
        { option_value: "false", option_label: "ไม่ต้องอนุมัติ" }
    ]

    useEffect(() => {
        const getPosition = async () => {
            console.log('get position _1')
            const res = await fetch("/api/position", {
                method: "GET",
            });

            const data = await res.json();
            const sortedData = data.sort((a: PositionSetup, b: PositionSetup) => a.position_level_id - b.position_level_id);
            setPosition(sortedData)
        }
        getPosition();
    }, [])



    useEffect(() => {
        const fetchFormData = async () => {
            const formId = params?.slug?.[0];

            if (formId) {
                console.log('เจอ ID แก้ไข:', formId);

                try {
                    const res = await fetch(`/api/builder?form_code=${formId}`, {
                        method: "GET",
                    });

              
                    const data = await res.json();
                    console.log('Data fetched:', data);
                    if (data.form && data.rule) {
                        setFormData({
                            form_type: data.form.form_type || "",
                            form_code: data.form.form_code || "",
                            form_name: data.form.form_name || "",
                            need_approval: data.form.need_approval,
                            form_status: data.form.form_status || "",
                            questions: data.form.questions?.map((q: any, index: number) => ({
                                id: `q_${Date.now()}_${index}`,
                                question_name: q.name || "",
                                question_label: q.label || "",
                                is_required: q.required || false,
                                sort_order: index + 1,
                                question_type: q.type || "",
                                options: q.options?.map((opt: any) => ({
                                    option_value: opt.value || "",
                                    option_label: opt.label || "",
                                    option_filter: opt.filter || ""
                                })) || []
                            })) || []
                        });

                        setFormRule(data.rule.rules?.map((r: any) => ({
                            form_code: data.rule.form_code || data.form.form_code || "",
                            level_no: r.level_no || 1,
                            creator_min: r.creator_min || 0,
                            creator_max: r.creator_max || 0,
                            approve_by_type: r.approve_by_type || "position_level_range",
                            approve_by_min: r.approve_by_min || 0,
                            approve_by_max: r.approve_by_max || 0,
                            same_department: r.same_department ?? true,
                            is_active: r.is_active ?? true
                        })) || []);

                        setBuilderMode("edit");
                    }

                } catch (error) {
                    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
                }
            } else {
                console.log('ไม่มี ID (เป็นการสร้างใหม่)');
                setBuilderMode("create");
            }
        };

        fetchFormData();
    }, [params]);


    // เพิ่ม Rule ใหม่
    const addRule = () => {
        const newRule: RuleSetup = {
            form_code: formData.form_code,
            level_no: 1,
            creator_min: 0,
            creator_max: 0,
            approve_by_type: "position_level_range",
            approve_by_min: 0,
            approve_by_max: 0,
            same_department: true,
            is_active: true
        }
        setFormRule((prev) => [...prev, newRule])
    }

    // ลบ Rule
    const removeRule = (index: number) => {
        setFormRule((prev) =>
            prev.filter((_, i) => i !== index).map((rule, i) => ({ ...rule, level_no: i + 1 }))
        )
    }

    // อัปเดต Rule
    const updateRule = (index: number, field: keyof RuleSetup, value: any) => {
        setFormRule((prev) =>
            prev.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
        )
    }

    const handleonChange = (field: keyof FormSetup, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value
        }))
    }

    const addQuestion = (type: string) => {
        const newQuestion: any = {
            id: `q_${Date.now()}`,
            question_name: "",
            question_label: "",
            is_required: false,
            sort_order: formData.questions.length + 1,
            question_type: type,

            ...(type === "dropdown" || type === "multiselect"
                ? {
                    options: [
                        {
                            option_value: "",
                            option_label: "",
                            option_filter: "",
                        },
                    ],
                }
                : {}),
        };
        setFormData((prev) => ({
            ...prev,
            questions: [...prev.questions, newQuestion]
        }))
    }

    // ลบ Question
    const removeQuestion = (id: string) => {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.filter((q) => q.id !== id).map((q, index) => ({ ...q, sort_order: index + 1 }))
        }))
    }

    // อัปเดต Question
    const updateQuestion = (id: string, field: keyof Question, value: any) => {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) => {
                if (q.id === id) {
                    if (field === "question_label") {
                        return { ...q, question_label: value, question_name: value }
                    }
                    return { ...q, [field]: value }
                }
                return q
            })
        }))
    }

    // เพิ่ม Option ใน Question
    const addOption = (questionId: string) => {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) =>
                q.id === questionId
                    ? { ...q, options: [...q.options, { option_value: "", option_label: "", option_filter: "" }] }
                    : q
            )
        }))
    }

    // ลบ Option
    const removeOption = (questionId: string, optionIndex: number) => {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) =>
                q.id === questionId
                    ? { ...q, options: q.options.filter((_, index) => index !== optionIndex) }
                    : q
            )
        }))
    }

    // อัปเดต Option
    const updateOption = (questionId: string, optionIndex: number, field: keyof Option, value: string) => {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) =>
                q.id === questionId
                    ? {
                        ...q,
                        options: q.options.map((opt, index) => {
                            if (index === optionIndex) {
                                if (field === "option_label") {
                                    return { ...opt, option_label: value, option_value: value }
                                }
                                return { ...opt, [field]: value }
                            }
                            return opt
                        })
                    }
                    : q
            )
        }))
    }

    // ย้าย Question ขึ้น
    const moveQuestionUp = (index: number) => {
        if (index === 0) return
        setFormData((prev) => {
            const newQuestions = [...prev.questions]
            const temp = newQuestions[index]
            newQuestions[index] = newQuestions[index - 1]
            newQuestions[index - 1] = temp
            return {
                ...prev,
                questions: newQuestions.map((q, i) => ({ ...q, sort_order: i + 1 }))
            }
        })
    }

    // ย้าย Question ลง
    const moveQuestionDown = (index: number) => {
        if (index === formData.questions.length - 1) return
        setFormData((prev) => {
            const newQuestions = [...prev.questions]
            const temp = newQuestions[index]
            newQuestions[index] = newQuestions[index + 1]
            newQuestions[index + 1] = temp
            return {
                ...prev,
                questions: newQuestions.map((q, i) => ({ ...q, sort_order: i + 1 }))
            }
        })
    }


    const handleSaveForm = async () => {
        try {
            const saveData = {
                ...formData,
                questions: formData.questions.map(({ id, ...rest }) => rest),
            };

            const res = await fetch("/api/builder", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    formData: saveData,
                    formRule,
                }),
            });
            console.log('res: ', res)
            const responseData = await res.json();

            if (!res.ok) {
                throw new Error(responseData?.message || "ไม่สามารถบันทึกข้อมูลได้");
            }
            handleClear();
            Swal.fire({
                icon: "success",
                title: "สำเร็จ",
                text: responseData?.message || "บันทึกข้อมูลเรียบร้อยแล้ว",
                confirmButtonText: "ตกลง",
            });
        } catch (error: any) {
            console.error("Save form error:", error);

            Swal.fire({
                icon: "error",
                title: "เกิดข้อผิดพลาด",
                text: error.message || "เกิดข้อผิดพลาดบางอย่าง",
                confirmButtonText: "ปิด",
            });
        }
    };

    const handleClear = () => {
        setFormData({
            form_type: "",
            form_code: "",
            form_name: "",
            need_approval: null,
            form_status: "",
            questions: []
        })
        setFormRule([])
    }


    // ดูตัวอย่างฟอร์ม
    const handlePreview = () => {
        setIsPreviewOpen(true)
    }

    const renderPreviewField = (question: Question, index: number) => {
        const config = questionTypeConfig[question.question_type]

        switch (question.question_type) {
            case "text":
                return (
                    <div key={question.id} className="space-y-1 pt-2">
                        <Label className="text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#026a75] text-white text-xs font-md">
                                {index + 1}
                            </div>
                            {question.question_label || `คำถามที่ ${index + 1}`}
                            {question.is_required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input type="text" placeholder="กรอกข้อความ..." disabled className="bg-gray-50" />
                    </div>
                )
            case "longtext":
                return (
                    <div key={question.id} className="space-y-1 pt-2">
                        <Label className="text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#026a75] text-white text-xs font-md">
                                {index + 1}
                            </div>
                            {question.question_label || `คำถามที่ ${index + 1}`}
                            {question.is_required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <textarea
                            className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 resize-none"
                            placeholder="กรอกข้อความยาว..."
                            disabled
                        />
                    </div>
                )
            case "number":
                return (
                    <div key={question.id} className="space-y-1 pt-2">
                        <Label className="text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#026a75] text-white text-xs font-md">
                                {index + 1}
                            </div>
                            {question.question_label || `คำถามที่ ${index + 1}`}
                            {question.is_required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input type="number" placeholder="0" disabled className="bg-gray-50" />
                    </div>
                )
            case "dropdown":
                return (
                    <div key={question.id} className="space-y-1 pt-2">
                        <Label className="text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#026a75] text-white text-xs font-md">
                                {index + 1}
                            </div>
                            {question.question_label || `คำถามที่ ${index + 1}`}
                            {question.is_required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <select className="w-full h-10 px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50" >
                            <option value="">-- เลือก --</option>
                            {question.options.map((opt, i) => (
                                <option key={i} value={opt.option_value}>{opt.option_label || `ตัวเลือก ${i + 1}`}</option>
                            ))}
                        </select>
                    </div>
                )
            case "multiselect":
                return (
                    <div key={question.id} className="space-y-2 pt-2">
                        <Label className="text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#026a75] text-white text-xs font-md">
                                {index + 1}
                            </div>
                            {question.question_label || `คำถามที่ ${index + 1}`}
                            {question.is_required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <div className="space-y-2 pl-1">
                            {question.options.map((opt, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Checkbox />
                                    <span className="text-sm text-gray-600">{opt.option_label || `ตัวเลือก ${i + 1}`}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            case "datetime":
                return (
                    <div key={question.id} className="space-y-1 pt-2">
                        <Label className="text-sm font-medium text-gray-700">
                            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#026a75] text-white text-xs font-md">
                                {index + 1}
                            </div>
                            {question.question_label || `คำถามที่ ${index + 1}`}
                            {question.is_required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input type="datetime-local" disabled className="bg-gray-50" />
                    </div>
                )
            default:
                return null
        }
    }

    // Render Question Card
    const renderQuestionCard = (question: Question, index: number) => {
        const config = questionTypeConfig[question.question_type]
        const IconComponent = config?.icon || FileType

        return (
            <div key={question.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                    {/* Drag Handle & Number */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#026a75] text-white text-xs font-bold">
                            {index + 1}
                        </div>
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 space-y-3">
                        {/* Type Badge */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-[#026a75] font-medium">
                                <IconComponent className="w-4 h-4" />
                                {config?.label}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveQuestionUp(index)}
                                    disabled={index === 0}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveQuestionDown(index)}
                                    disabled={index === formData.questions.length - 1}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeQuestion(question.id)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>


                        {question.question_type === "title" ? (
                            <Input
                                type="text"
                                placeholder="กรอกหัวข้อ..."
                                value={question.question_label}
                                onChange={(e) => updateQuestion(question.id, "question_label", e.target.value)}
                                className="font-semibold text-lg border-dashed"
                            />
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* <div>
                                    <Label className="text-xs text-gray-500 mb-1">ชื่อฟิลด์ (Field Name)</Label>
                                    <Input
                                        type="text"
                                        value={question.question_name}
                                        onChange={(e) => updateQuestion(question.id, "question_name", e.target.value)}
                                    />
                                </div> */}
                                <div>
                                    <Input
                                        type="text"
                                        value={question.question_label}
                                        onChange={(e) => updateQuestion(question.id, "question_label", e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Options for Dropdown/Multiselect */}
                        {(question.question_type === "dropdown" || question.question_type === "multiselect") && (
                            <div className="space-y-2 py-2 pl-2 border-l-2 border-[#026a75]/20">
                                <Label className="text-xs text-gray-500">ตัวเลือก (Options)</Label>
                                {question.options.map((option, optIndex) => (
                                    <div key={optIndex} className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                                            {optIndex + 1}
                                        </div>
                                        <Input
                                            type="text"
                                            placeholder="label"
                                            value={option.option_label}
                                            onChange={(e) => updateOption(question.id, optIndex, "option_label", e.target.value)}
                                            className="flex-1 h-9 text-sm"
                                        />
                                        <Input
                                            type="text"
                                            placeholder="Filter"
                                            value={option.option_filter}
                                            onChange={(e) => updateOption(question.id, optIndex, "option_filter", e.target.value)}
                                            className="flex-1 h-9 text-sm"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeOption(question.id, optIndex)}
                                            disabled={question.options.length <= 1}
                                            className="h-8 w-8 p-0 cursor-pointer text-gray-400 hover:text-red-500"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOption(question.id)}
                                    className="h-8 text-xs cursor-pointer"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> เพิ่มตัวเลือก
                                </Button>
                            </div>
                        )}

                        {/* Required Checkbox */}
                        {question.question_type !== "title" && (
                            <div className="flex items-center gap-2 pt-2">
                                <Checkbox
                                    id={`required_${question.id}`}
                                    checked={question.is_required}
                                    onCheckedChange={(checked) => updateQuestion(question.id, "is_required", checked)}
                                />
                                <Label htmlFor={`required_${question.id}`} className="text-xs text-gray-500 cursor-pointer">
                                    Use required
                                </Label>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }


    return (
        <Navbar isHome={false} title={builderMode == "create" ? "สร้างฟอร์มแจ้งปัญหา และบริการ" : "แก้ไขฟอร์มแจ้งปัญหา และบริการ"}>
            {/* Main Content */}
            <main className="flex-1 min-h-0 rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto" style={{ background: 'radial-gradient(circle, #c3ddde 1.5px, #f0fafa 1.5px)', backgroundSize: '20px 20px' }}>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="flex flex-col gap-4">

                        <div className="flex flex-row">
                            <div className="bg-[#026a75] text-white w-auto h-auto p-4 text-xl">1</div>
                            <div className="bg-white w-full border border- p-4">
                                <h3 className="font-bold text-gray-800 text-md">{builderMode == "create" ? "สร้างฟอร์มใหม่" : "แก้ไขฟอร์ม"}</h3>

                            </div>
                        </div>

                        <Card>
                            <CardContent className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-700 mb-1">ประเภทฟอร์ม :</span>
                                        {builderMode === "create" ? <DropdownSearch options={form_type} value={formData.form_type} onChange={(value) => handleonChange("form_type", value)} />
                                            : <Input
                                                type="text"
                                                placeholder=""
                                                disabled
                                                value={formData.form_type}
                                            />}
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-700 mb-1">รหัสฟอร์ม :</span>
                                        <Input
                                            type="text"
                                            placeholder=""
                                            disabled={builderMode === "edit"}
                                            value={formData.form_code}
                                            onChange={(e) => handleonChange("form_code", e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-700 mb-1">ชื่อฟอร์ม :</span>
                                        <Input
                                            type="text"
                                            placeholder=""
                                            value={formData.form_name}
                                            onChange={(e) => handleonChange("form_name", e.target.value)}
                                        />
                                    </label>

                                    <label className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-700 mb-1">การอนุมัติฟอร์ม :</span>
                                        <DropdownSearch
                                            options={approval_options}
                                            value={formData.need_approval ? "true" : "false"}
                                            onChange={(value) => handleonChange("need_approval", value === "true")}
                                        />
                                    </label>
                                    <label className="flex flex-col">
                                        <span className="text-sm font-semibold text-gray-700 mb-1">สถานะฟอร์ม :</span>
                                        <DropdownSearch
                                            options={form_status_options}
                                            value={formData.form_status}
                                            onChange={(value) => handleonChange("form_status", value)}
                                        />
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Create Form Builder Element Can remove and add when click button */}
                        <div className="flex flex-row">
                            <div className="bg-[#026a75] text-white w-auto h-auto p-4 text-xl">2</div>
                            <div className="bg-white w-full border border- p-4">
                                <h3 className="font-bold text-gray-800 text-md">{builderMode == "create" ? "ออกแบบฟอร์มใหม่" : "ออกแบบฟอร์ม"}</h3>

                            </div>
                        </div>

                        <Card className="border rounded-2xl sm:rounded-3xl overflow-hidden">
                            <CardContent className="p-6 sm:p-6">
                                <div className="space-y-5">
                                    <div className="flex flex-row flex-wrap justify-center gap-2">
                                        {/* <Button type="button" className="cursor-pointer" variant={"outline"} onClick={() => addQuestion('title')}><Type className="w-4 h-4" /> Title</Button> */}
                                        <Button type="button" className="cursor-pointer" variant={"outline"} onClick={() => addQuestion('text')}><FileType className="w-4 h-4" /> Text</Button>
                                        <Button type="button" className="cursor-pointer" variant={"outline"} onClick={() => addQuestion('longtext')}><FileText className="w-4 h-4" /> Long Text</Button>
                                        <Button type="button" className="cursor-pointer" variant={"outline"} onClick={() => addQuestion('number')}><Hash className="w-4 h-4" /> Number</Button>
                                        <Button type="button" className="cursor-pointer" variant={"outline"} onClick={() => addQuestion('dropdown')}><ListChecks className="w-4 h-4" /> Dropdown</Button>
                                        <Button type="button" className="cursor-pointer" variant={"outline"} onClick={() => addQuestion('multiselect')}><CheckSquare className="w-4 h-4" /> Multiselect</Button>
                                        <Button type="button" className="cursor-pointer" variant={"outline"} onClick={() => addQuestion('datetime')}><Calendar className="w-4 h-4" /> Datetime</Button>
                                    </div>

                                    <div className="border border-gray-300"></div>

                                    {/* Render Questions */}
                                    {formData.questions.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400">
                                            <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p className="text-sm">คลิกปุ่มด้านบนเพื่อเพิ่ม องค์ประกอบ ในฟอร์ม</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4 sm:gap-6">
                                            {formData.questions.map((question, index) => renderQuestionCard(question, index))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex flex-row">
                            <div className="bg-[#026a75] text-white w-auto h-auto p-4 text-xl">3</div>
                            <div className="bg-white w-full border border- p-4 flex justify-between">
                                <h3 className="font-bold text-gray-800 text-md">เงื่อนไข และกฎเกณฑ์</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addRule}
                                    className="gap-1 cursor-pointer bg-white hover:bg-gray-50"
                                >
                                    <Plus className="w-4 h-4" /> เพิ่มกฎ
                                </Button>
                            </div>
                        </div>

                        <div className={`flex flex-col ${formRule.length === 0 ? 'gap-0' : 'gap-4'} `}>

                            {formRule.length === 0 ? (
                                <div className="bg-white border rounded-xl p-6 mt-2 mb-2">
                                    <div className="text-center py-8 text-gray-400">
                                        <SquareFunction className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-sm">คลิกปุ่ม "เพิ่มกฎ" เพื่อเพิ่มเงื่อนไขการอนุมัติ</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {formRule.map((rule, index) => (
                                        <Card key={index} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                            <CardContent className="p-0">
                                                {/* Header */}
                                                <div className="flex items-center justify-between px-4 py-3 border-b">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center justify-center h-6 text-sm font-semibold" style={{ borderBottomColor: "#026a75", borderBottomWidth: '3px' }}>
                                                            กฎลำดับที่ {index + 1}
                                                        </div>

                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeRule(index)}
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>

                                                {/* Body Rule */}
                                                <div className="flex flex-col gap-5 p-6 bg-linear-to-br from-white to-[#f8fdfd]">
                                                    {/* Row 1: Form Code */}
                                                    <div className="flex flex-row items-center gap-4 pb-3">
                                                        <Label className="text-sm font-semibold text-[#026a75] w-32 shrink-0">รหัสฟอร์ม :</Label>
                                                        <label className="flex-1 text-sm font-medium text-gray-700">{formData.form_code}</label>
                                                    </div>

                                                    {/* Row 2: approve_by_type */}
                                                    <div className="flex flex-row items-center gap-4 pb-3">
                                                        <Label className="text-sm font-semibold text-[#026a75] w-32 shrink-0">ประเภทอนุมัติ :</Label>
                                                        <label className="flex-1 text-sm font-medium text-gray-700">{rule.approve_by_type.toUpperCase()}</label>
                                                    </div>

                                                    {/* Row 3: Creator Range */}
                                                    <div className="flex items-start gap-4 pb-3 flex-col sm:flex-row">
                                                        <Label className="text-sm font-semibold text-[#026a75] w-32 shrink-0 pt-2">ระดับผู้สร้าง :</Label>
                                                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                                                            <DropdownSearch
                                                                options={position.map(p => ({
                                                                    option_value: p.position_level_id.toString(),
                                                                    option_label: `ระดับ ${p.position_level_id}: ${p.level_name}`
                                                                }))}
                                                                value={rule.creator_min.toString()}
                                                                onChange={(value) => updateRule(index, "creator_min", parseInt(value))}
                                                            />
                                                            <span className="text-[#026a75] text-md font-semibold ml-2">ถึง </span>
                                                            <DropdownSearch
                                                                options={position.map(p => ({
                                                                    option_value: p.position_level_id.toString(),
                                                                    option_label: `ระดับ ${p.position_level_id}: ${p.level_name}`
                                                                }))}
                                                                value={rule.creator_max.toString()}
                                                                onChange={(value) => updateRule(index, "creator_max", parseInt(value))}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Row 4: Approver Range */}
                                                    <div className="flex items-start gap-4 pb-3 flex-col sm:flex-row">
                                                        <Label className="text-sm font-semibold text-[#026a75] w-32 shrink-0 pt-2">ระดับผู้อนุมัติ :</Label>
                                                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                                                            <DropdownSearch
                                                                options={position.map(p => ({
                                                                    option_value: p.position_level_id.toString(),
                                                                    option_label: `ระดับ ${p.position_level_id}: ${p.level_name}`
                                                                }))}
                                                                value={rule.approve_by_min.toString()}
                                                                onChange={(value) => updateRule(index, "approve_by_min", parseInt(value))}
                                                            />
                                                            <span className="text-[#026a75] text-md font-semibold ml-2">ถึง </span>
                                                            <DropdownSearch
                                                                options={position.map(p => ({
                                                                    option_value: p.position_level_id.toString(),
                                                                    option_label: `ระดับ ${p.position_level_id}: ${p.level_name}`
                                                                }))}
                                                                value={rule.approve_by_max.toString()}
                                                                onChange={(value) => updateRule(index, "approve_by_max", parseInt(value))}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Row 5: Checkboxes */}
                                                    <div className="flex items-center gap-6 pt-2 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`same_dept_${index}`}
                                                                checked={rule.same_department}
                                                                onCheckedChange={(checked) => updateRule(index, "same_department", checked)}
                                                                className="border-[#026a75] data-[state=checked]:bg-[#026a75]"
                                                            />
                                                            <Label htmlFor={`same_dept_${index}`} className="text-sm font-medium text-[#026a75] cursor-pointer">
                                                                ต้องอยู่แผนกเดียวกัน
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`is_active_${index}`}
                                                                checked={rule.is_active}
                                                                onCheckedChange={(checked) => updateRule(index, "is_active", checked)}
                                                                className="border-[#026a75] data-[state=checked]:bg-[#026a75]"
                                                            />
                                                            <Label htmlFor={`is_active_${index}`} className="text-sm font-medium text-[#026a75] cursor-pointer">
                                                                เปิดใช้งาน
                                                            </Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                        </div>

                        {/* Submit Button */}
                        <div className="flex flex-row justify-end gap-3 pb-6">
                            {builderMode === "create" && (<Button type="button" variant="outline" className="gap-2 cursor-pointer" onClick={handleClear}>
                                <RotateCcw className="w-4 h-4" /> รีเซ็ต
                            </Button>
                            )}
                            <Button type="button" variant="outline" className="gap-2 cursor-pointer" onClick={handlePreview}>
                                <Eye className="w-4 h-4" /> ดูตัวอย่าง
                            </Button>
                            {/* <Button type="button" variant="outline" className="gap-2 cursor-pointer" onClick={()=>console.log('ทดสอบกฏ : ',formRule)}>
                                <Eye className="w-4 h-4" /> ทดสอบกฏ
                            </Button> */}
                            {/* {builderMode === "edit" && (
                                <Button type="button" className="gap-2 bg-[#026a75] hover:bg-[#025f68] cursor-pointer" onClick={handleSaveForm}>
                                    <Pencil className="w-4 h-4" /> แก้ไขฟอร์ม
                                </Button>
                            )} */}
                            {builderMode === "create" && (
                                <Button type="button" className="gap-2 bg-[#026a75] hover:bg-[#025f68] cursor-pointer" onClick={handleSaveForm}>
                                    <Save className="w-4 h-4" /> บันทึกฟอร์ม
                                </Button>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            {/* Preview Dialog */}
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#026a75]">
                            ตัวอย่างฟอร์ม: {formData.form_name || "ยังไม่ได้ตั้งชื่อ"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1 text-sm text-gray-500 border-b pb-4">
                        <p><span className="font-medium">ประเภท:</span> {formData.form_type === "Issue" ? "ฟอร์มแจ้งปัญหา" : formData.form_type === "Service" ? "ฟอร์มขอใช้บริการ" : "-"}</p>
                        <p><span className="font-medium">รหัสฟอร์ม:</span> {formData.form_code || "-"}</p>
                        <p><span className="font-medium">การอนุมัติฟอร์ม:</span> {formData.need_approval ? "ต้องอนุมัติ" : "ไม่ต้องอนุมัติ"}</p>
                        <p><span className="font-medium">สถานะฟอร์ม:</span> {formData.form_status || "-"}</p>
                    </div>
                    <div className="space-y-4 pt-2">
                        {formData.questions.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <p>ยังไม่มี องค์ประกอบ ในฟอร์ม</p>
                            </div>
                        ) : (
                            formData.questions.map((question, index) => renderPreviewField(question, index))
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t ">
                        <Button variant="default" onClick={() => setIsPreviewOpen(false)}>
                            ปิด
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Navbar>
    )
}