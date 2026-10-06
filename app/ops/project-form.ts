import type { OpsPriority, Project, ProjectRequestInput } from './types';

/** Project request fields as the form holds them — shared by /ops/request and the edit form on /ops/status. */
export type ProjectFormState = Omit<ProjectRequestInput, 'estimated_users' | 'priority'> & {
    estimated_users: string;
    priority: OpsPriority | '';
};

export const EMPTY_PROJECT_FORM: ProjectFormState = {
    title: '', objective: '', requirement: '', expected_benefit: '',
    estimated_users: '', user_groups: '', priority: '', target_date: '',
};

const REQUIRED: Partial<Record<keyof ProjectFormState, string>> = {
    title: 'กรุณาระบุชื่อโปรเจค',
    objective: 'กรุณาอธิบายปัญหาและวัตถุประสงค์',
    requirement: 'กรุณาระบุรายละเอียดความต้องการ',
    expected_benefit: 'กรุณาระบุประโยชน์และความคุ้มค่า',
    priority: 'กรุณาเลือกระดับความสำคัญ',
};

export const validateProjectForm = (f: ProjectFormState) => {
    const errors: Record<string, string> = {};
    for (const [key, msg] of Object.entries(REQUIRED)) {
        if (!String(f[key as keyof ProjectFormState] ?? '').trim()) errors[key] = msg;
    }
    if (!errors.title && f.title.trim().length < 3) errors.title = 'ชื่อโปรเจคต้องมีอย่างน้อย 3 ตัวอักษร';
    const users = Number(f.estimated_users);
    if (!Number.isInteger(users) || users < 1) errors.estimated_users = 'กรุณาระบุจำนวนผู้ใช้งาน (ตัวเลขตั้งแต่ 1)';
    return errors;
};

export const toProjectInput = (f: ProjectFormState): ProjectRequestInput => ({
    title: f.title.trim(),
    objective: f.objective.trim(),
    requirement: f.requirement.trim(),
    expected_benefit: f.expected_benefit.trim(),
    estimated_users: Number(f.estimated_users),
    user_groups: f.user_groups?.trim() || null,
    priority: f.priority as OpsPriority,
    target_date: f.target_date || null,
});

export const projectToForm = (p: Project): ProjectFormState => ({
    title: p.title,
    objective: p.objective,
    requirement: p.requirement,
    expected_benefit: p.expected_benefit,
    estimated_users: String(p.estimated_users),
    user_groups: p.user_groups ?? '',
    priority: p.priority,
    target_date: p.target_date ?? '',
});
