import { useState, useCallback, useMemo } from 'react'
import type { FormSetup, Question, Option, QuestionType, BuilderStep } from '../types'
import { INITIAL_FORM_STATE, QUESTION_TYPES } from '../constants'

// Generate unique ID
const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export function useFormBuilder() {
    const [formData, setFormData] = useState<FormSetup>(INITIAL_FORM_STATE)
    const [currentStep, setCurrentStep] = useState<BuilderStep>('settings')
    const [expandedQuestions, setExpandedQuestions] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)

    // Update form field
    const updateFormField = useCallback(<K extends keyof FormSetup>(
        field: K, 
        value: FormSetup[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }, [])

    // Toggle question expansion
    const toggleQuestion = useCallback((id: string) => {
        setExpandedQuestions(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        )
    }, [])

    // Add new question
    const addQuestion = useCallback((type: QuestionType = 'shorttext') => {
        const typeConfig = QUESTION_TYPES.find(t => t.value === type)
        const newQuestion: Question = {
            id: generateId(),
            question_name: `question_${formData.question.length + 1}`,
            question_label: "",
            is_required: false,
            sort_order: formData.question.length + 1,
            question_type: type,
            options: typeConfig?.hasOptions ? [{ option_value: "", option_label: "" }] : [],
            placeholder: "",
            description: ""
        }
        setFormData(prev => ({
            ...prev,
            question: [...prev.question, newQuestion]
        }))
        setExpandedQuestions(prev => [...prev, newQuestion.id])
        return newQuestion.id
    }, [formData.question.length])

    // Remove question
    const removeQuestion = useCallback((id: string) => {
        setFormData(prev => ({
            ...prev,
            question: prev.question
                .filter(q => q.id !== id)
                .map((q, i) => ({ ...q, sort_order: i + 1 }))
        }))
        setExpandedQuestions(prev => prev.filter(i => i !== id))
    }, [])

    // Duplicate question
    const duplicateQuestion = useCallback((id: string) => {
        const question = formData.question.find(q => q.id === id)
        if (!question) return

        const newQuestion: Question = {
            ...question,
            id: generateId(),
            question_name: `${question.question_name}_copy`,
            question_label: `${question.question_label} (สำเนา)`,
            sort_order: formData.question.length + 1
        }
        setFormData(prev => ({
            ...prev,
            question: [...prev.question, newQuestion]
        }))
        setExpandedQuestions(prev => [...prev, newQuestion.id])
    }, [formData.question])

    // Update question
    const updateQuestion = useCallback((
        id: string, 
        field: keyof Question, 
        value: unknown
    ) => {
        setFormData(prev => ({
            ...prev,
            question: prev.question.map(q => {
                if (q.id !== id) return q
                
                const updated = { ...q, [field]: value }
                
                // Handle type change
                if (field === 'question_type') {
                    const typeConfig = QUESTION_TYPES.find(t => t.value === value)
                    if (!typeConfig?.hasOptions) {
                        updated.options = []
                    } else if (updated.options.length === 0) {
                        updated.options = [{ option_value: "", option_label: "" }]
                    }
                }
                
                return updated
            })
        }))
    }, [])

    // Add option to question
    const addOption = useCallback((questionId: string) => {
        setFormData(prev => ({
            ...prev,
            question: prev.question.map(q =>
                q.id === questionId
                    ? { ...q, options: [...q.options, { option_value: "", option_label: "" }] }
                    : q
            )
        }))
    }, [])

    // Remove option
    const removeOption = useCallback((questionId: string, optionIndex: number) => {
        setFormData(prev => ({
            ...prev,
            question: prev.question.map(q =>
                q.id === questionId
                    ? { ...q, options: q.options.filter((_, i) => i !== optionIndex) }
                    : q
            )
        }))
    }, [])

    // Update option
    const updateOption = useCallback((
        questionId: string, 
        optionIndex: number, 
        field: keyof Option, 
        value: string
    ) => {
        setFormData(prev => ({
            ...prev,
            question: prev.question.map(q =>
                q.id === questionId
                    ? {
                        ...q,
                        options: q.options.map((opt, i) =>
                            i === optionIndex ? { ...opt, [field]: value } : opt
                        )
                    }
                    : q
            )
        }))
    }, [])

    // Move question
    const moveQuestion = useCallback((id: string, direction: 'up' | 'down') => {
        setFormData(prev => {
            const index = prev.question.findIndex(q => q.id === id)
            const newIndex = direction === 'up' ? index - 1 : index + 1
            
            if (newIndex < 0 || newIndex >= prev.question.length) return prev

            const questions = [...prev.question]
            const temp = questions[index]
            questions[index] = questions[newIndex]
            questions[newIndex] = temp

            return {
                ...prev,
                question: questions.map((q, i) => ({ ...q, sort_order: i + 1 }))
            }
        })
    }, [])

    // Reorder questions (for drag & drop)
    const reorderQuestions = useCallback((startIndex: number, endIndex: number) => {
        setFormData(prev => {
            const questions = [...prev.question]
            const [removed] = questions.splice(startIndex, 1)
            questions.splice(endIndex, 0, removed)

            return {
                ...prev,
                question: questions.map((q, i) => ({ ...q, sort_order: i + 1 }))
            }
        })
    }, [])

    // Save form
    const saveForm = useCallback(async () => {
        setIsSaving(true)
        try {
            // TODO: Implement API call
            console.log("Saving form:", formData)
            await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API
            return true
        } catch (error) {
            console.error("Save error:", error)
            return false
        } finally {
            setIsSaving(false)
        }
    }, [formData])

    // Reset form
    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM_STATE)
        setExpandedQuestions([])
        setCurrentStep('settings')
    }, [])

    // Validation
    const validation = useMemo(() => {
        const errors: string[] = []
        
        if (!formData.form_type) errors.push('กรุณาเลือกประเภทฟอร์ม')
        if (!formData.form_code) errors.push('กรุณากรอกรหัสฟอร์ม')
        if (!formData.form_name) errors.push('กรุณากรอกชื่อฟอร์ม')
        if (formData.question.length === 0) errors.push('กรุณาเพิ่มอย่างน้อย 1 คำถาม')
        
        formData.question.forEach((q, i) => {
            if (!q.question_label) {
                errors.push(`คำถามที่ ${i + 1}: กรุณากรอกข้อความคำถาม`)
            }
            const typeConfig = QUESTION_TYPES.find(t => t.value === q.question_type)
            if (typeConfig?.hasOptions && q.options.length === 0) {
                errors.push(`คำถามที่ ${i + 1}: กรุณาเพิ่มตัวเลือก`)
            }
        })

        return {
            isValid: errors.length === 0,
            errors
        }
    }, [formData])

    // Step navigation
    const canGoNext = useMemo(() => {
        switch (currentStep) {
            case 'settings':
                return formData.form_type && formData.form_code && formData.form_name
            case 'questions':
                return formData.question.length > 0
            default:
                return true
        }
    }, [currentStep, formData])

    const goToStep = useCallback((step: BuilderStep) => {
        setCurrentStep(step)
    }, [])

    const nextStep = useCallback(() => {
        const steps: BuilderStep[] = ['settings', 'questions', 'preview']
        const currentIndex = steps.indexOf(currentStep)
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1])
        }
    }, [currentStep])

    const prevStep = useCallback(() => {
        const steps: BuilderStep[] = ['settings', 'questions', 'preview']
        const currentIndex = steps.indexOf(currentStep)
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1])
        }
    }, [currentStep])

    return {
        // State
        formData,
        currentStep,
        expandedQuestions,
        isSaving,
        validation,
        canGoNext,

        // Form actions
        updateFormField,
        resetForm,
        saveForm,

        // Question actions
        addQuestion,
        removeQuestion,
        duplicateQuestion,
        updateQuestion,
        moveQuestion,
        reorderQuestions,
        toggleQuestion,

        // Option actions
        addOption,
        removeOption,
        updateOption,

        // Navigation
        goToStep,
        nextStep,
        prevStep,
    }
}
