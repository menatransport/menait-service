// Builder Types - แยก Types ออกมาเพื่อ Reusability

export interface Option {
    option_value: string
    option_label: string
}

export interface Question {
    id: string
    question_name: string
    question_label: string
    is_required: boolean
    sort_order: number
    question_type: QuestionType
    options: Option[]
    placeholder?: string
    description?: string
}

export interface FormSetup {
    form_type: string
    form_code: string
    form_name: string
    form_description: string
    need_approval: boolean
    form_status: FormStatus
    question: Question[]
}

export type FormStatus = "Active" | "Inactive"

export type QuestionType = 
    | "shorttext" 
    | "longtext" 
    | "dropdown" 
    | "radio" 
    | "checkbox" 
    | "number" 
    | "date" 
    | "time" 
    | "file" 
    | "toggle"

export interface QuestionTypeConfig {
    value: QuestionType
    label: string
    icon: string
    hasOptions: boolean
    description: string
}

export interface FormTypeConfig {
    value: string
    label: string
    icon: string
    color: string
}

export type BuilderStep = 'settings' | 'questions' | 'preview'
