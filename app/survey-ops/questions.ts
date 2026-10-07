/** The OPS satisfaction survey — shared by the form (/survey-ops) and the results on the project sheet. */

export interface RatingQuestion {
    id: number;
    question: string;
}

export const SECTION_2_TITLE = 'ความพึงพอใจในการใช้งานระบบ';
export const SECTION_3_TITLE = 'การจัดการปัญหาและการสนับสนุน';

export const SECTION_2_QUESTIONS: RatingQuestion[] = [
    { id: 1, question: 'ความสะดวกในการเข้าใช้งานระบบ' },
    { id: 2, question: 'ความชัดเจนและใช้งานง่ายของหน้าจอ/เมนู' },
    { id: 3, question: 'ความถูกต้องของข้อมูลที่ระบบแสดง' },
    { id: 4, question: 'ความเร็วและเสถียรภาพของระบบ (ไม่ค้าง/ไม่ล่ม)' },
    { id: 5, question: 'ระบบช่วยให้ทำงานได้ง่ายและมีประสิทธิภาพ' },
];

export const SECTION_3_QUESTIONS: RatingQuestion[] = [
    { id: 1, question: 'ความรวดเร็วในการตอบรับเมื่อผู้ใช้แจ้งปัญหา' },
    { id: 2, question: 'ความชัดเจนในการให้คำแนะนำ/ขั้นตอนแก้ไขปัญหา' },
    { id: 3, question: 'ความเหมาะสมของเวลาในการแก้ไขปัญหา' },
    { id: 4, question: 'ความพึงพอใจต่อผลลัพธ์หลังการแก้ไขปัญหา' },
    { id: 5, question: 'การสื่อสารและการติดตามงานระหว่างการแก้ปัญหา' },
];

/** The link people answer from — fixed to that project */
export const surveyLink = (projectId: string, origin: string) => `${origin}/survey-ops/${encodeURIComponent(projectId)}`;
