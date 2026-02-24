import type { QuestionTypeConfig, FormTypeConfig } from './types'

export const QUESTION_TYPES: QuestionTypeConfig[] = [
    { 
        value: "shorttext", 
        label: "ข้อความสั้น", 
        icon: "AlignLeft", 
        hasOptions: false,
        description: "สำหรับคำตอบสั้นๆ เช่น ชื่อ, หัวข้อ"
    },
    { 
        value: "longtext", 
        label: "ข้อความยาว", 
        icon: "FileText", 
        hasOptions: false,
        description: "สำหรับคำตอบยาว เช่น รายละเอียด, คำอธิบาย"
    },
    { 
        value: "dropdown", 
        label: "Dropdown", 
        icon: "ListChecks", 
        hasOptions: true,
        description: "เลือก 1 ตัวเลือกจากรายการ"
    },
    { 
        value: "radio", 
        label: "ตัวเลือกเดียว", 
        icon: "CircleDot", 
        hasOptions: true,
        description: "เลือกได้ 1 ตัวเลือกแบบแสดงทั้งหมด"
    },
    { 
        value: "checkbox", 
        label: "หลายตัวเลือก", 
        icon: "CheckSquare", 
        hasOptions: true,
        description: "เลือกได้หลายตัวเลือก"
    },
    { 
        value: "number", 
        label: "ตัวเลข", 
        icon: "Hash", 
        hasOptions: false,
        description: "รับเฉพาะตัวเลข"
    },
    { 
        value: "date", 
        label: "วันที่", 
        icon: "Calendar", 
        hasOptions: false,
        description: "เลือกวันที่"
    },
    { 
        value: "time", 
        label: "เวลา", 
        icon: "Clock", 
        hasOptions: false,
        description: "เลือกเวลา"
    },
    { 
        value: "file", 
        label: "อัพโหลดไฟล์", 
        icon: "Upload", 
        hasOptions: false,
        description: "แนบไฟล์เอกสารหรือรูปภาพ"
    },
    { 
        value: "toggle", 
        label: "เปิด/ปิด", 
        icon: "ToggleLeft", 
        hasOptions: false,
        description: "สวิตช์ ใช่/ไม่ใช่"
    },
]

export const FORM_TYPES: FormTypeConfig[] = [
    { value: "issue", label: "แจ้งปัญหา", icon: "AlertCircle", color: "bg-red-500" },
    { value: "service", label: "ขอบริการ", icon: "Wrench", color: "bg-blue-500" },
    { value: "request", label: "ขอเอกสาร", icon: "FileText", color: "bg-green-500" },
    { value: "feedback", label: "ข้อเสนอแนะ", icon: "MessageSquare", color: "bg-purple-500" },
]

export const INITIAL_FORM_STATE = {
    form_type: "",
    form_code: "",
    form_name: "",
    form_description: "",
    need_approval: false,
    form_status: "Active" as const,
    question: []
}

// Builder Steps Configuration
export const BUILDER_STEPS = [
    { id: 'settings', label: 'ตั้งค่าฟอร์ม', icon: 'Settings', description: 'กำหนดข้อมูลพื้นฐาน' },
    { id: 'questions', label: 'สร้างคำถาม', icon: 'ListChecks', description: 'เพิ่มและจัดการคำถาม' },
    { id: 'preview', label: 'ตรวจสอบ', icon: 'Eye', description: 'ดูตัวอย่างและบันทึก' },
]
