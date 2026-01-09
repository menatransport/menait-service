'use client'
import { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Label } from "./ui/label";
import { AlertCircle, ChevronDown, Send } from "lucide-react";
import { Button } from "./ui/button";
import { IssueDropdown } from "./ui/dropdown/issue";

export const IssueForm = () => {

    const mockupQuestions = [
        {
            question_name: "issue_name",
            question_label: "ประเภทงานซ่อม",
            question_type: "dropdown",
            is_required: true,
            sort_order: 1,
            options: [
                { option_value: "Hardware", option_label: "Hardware" },
                { option_value: "Software", option_label: "Software" },
                { option_value: "Internet", option_label: "Internet" },
                { option_value: "Other", option_label: "อื่นๆ" }
            ]
        },
        {
            question_name: "sub_name",
            question_label: "รายละเอียดงานย่อย",
            question_type: "dropdown",
            is_required: true,
            sort_order: 2,
            options: [
                { option_value: "it_equipment_request", option_label: "เบิกอุปกรณ์ด้าน IT" },
                { option_value: "it_equipment_damage", option_label: "อุปกรณ์ด้าน IT ชำรุดหรือเสียหาย" },
                { option_value: "request_mouse", option_label: "ขอเบิก Mouse" },
                { option_value: "request_keyboard", option_label: "ขอเบิก Keyboard" },
                { option_value: "request_printer_ink", option_label: "ขอเบิก หมึก Printer" },
                { option_value: "install_uninstall_program", option_label: "ขอติดตั้ง/ขอลบ โปรแกรม" },
                { option_value: "ms_office_issue", option_label: "ปัญหาการใช้งาน Microsoft Office" },
                { option_value: "vpn_issue", option_label: "ปัญหาการใช้งาน VPN" },
                { option_value: "grab_access", option_label: "ขอสิทธิ/ปัญหาการใช้งาน Grab" },
                { option_value: "atms_add_branch", option_label: "เพิ่มคลัง/สาขา ใน ATMS" },
                { option_value: "atms_add_data", option_label: "สร้าง/เพิ่ม ข้อมูล ใน ATMS" },
                { option_value: "line_issue", option_label: "ปัญหาการใช้งาน LINE" },
                { option_value: "google_meet_issue", option_label: "ปัญหาการใช้งาน Google Meet" },
                { option_value: "atms_issue", option_label: "ปัญหาการใช้งาน ATMS" },
                { option_value: "winspeed_issue", option_label: "ปัญหาการใช้งาน Winspeed" },
                { option_value: "google_drive_issue", option_label: "ปัญหาการใช้งาน Google Drive (G)" },
                { option_value: "internet_wifi_issue", option_label: "ปัญหาการใช้งาน Internet/WiFi" },
                { option_value: "wifi_guest_access", option_label: "ขอสิทธิใช้งาน WiFi Guest" },
                { option_value: "password_locked", option_label: "Password Locked / ลืมรหัสผ่าน" },
                { option_value: "print_scan_issue", option_label: "ปัญหาการใช้งาน Print/Scan" },
                { option_value: "website_update", option_label: "อัพเดท/แก้ไข Website" },
                { option_value: "group_mail_access", option_label: "ขอสิทธิ Group Mail" },
                { option_value: "install_print_scan", option_label: "ขอติดตั้ง Print/Scan" },
                { option_value: "meeting_room_setup", option_label: "จัดเตรียมห้องประชุม/อาคารสถานที่" },
                { option_value: "share_drive_issue", option_label: "ปัญหาการใช้งาน Share Drive" },
                { option_value: "ad_system_issue", option_label: "ระบบ AD ขัดข้อง" },
                { option_value: "other", option_label: "อื่นๆ" }
            ]
        },
        {
            question_name: "remark",
            question_label: "หมายเหตุเพิ่มเติม",
            question_type: "longtext",
            is_required: false,
            sort_order: 3
        }
    ];

    const [formData, setFormData] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleInputChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        const newErrors: Record<string, string> = {};
        mockupQuestions.forEach(q => {
            if (q.is_required && !formData[q.question_name]) {
                newErrors[q.question_name] = `กรุณาระบุ${q.question_label}`;
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Submit form
        console.log('Form submitted:', formData);
        alert('ส่งคำร้องสำเร็จ!');
    };


    const renderField = (question: typeof mockupQuestions[0]) => {
        switch (question.question_type) {
            case 'dropdown':
                return (
                    <div key={question.question_name} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#026a75] text-white text-xs font-bold">{question.sort_order}</div>
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                {question.question_label}
                                {question.is_required && <span className="text-rose-500">*</span>}
                            </Label>
                        </div>

                        <IssueDropdown
                            value={formData[question.question_name] || ''}
                            onChange={(value) => handleInputChange(question.question_name, value)}
                            options={question.options || []}
                            placeholder="-- กรุณาเลือก --"
                            searchPlaceholder="ค้นหา..."
                            error={!!errors[question.question_name]}
                        />
                        {errors[question.question_name] && (
                            <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors[question.question_name]}
                            </p>
                        )}
                    </div>
                );

            case 'longtext':
                return (
                    <div key={question.question_name} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#026a75] text-white text-xs font-bold">{question.sort_order}</div>
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                {question.question_label}
                                {question.is_required && <span className="text-rose-500">*</span>}
                            </Label>
                        </div>
                        <textarea
                            value={formData[question.question_name] || ''}
                            onChange={(e) => handleInputChange(question.question_name, e.target.value)}
                            placeholder="กรุณาระบุรายละเอียดเพิ่มเติม..."
                            rows={4}
                            className={`w-full px-4 py-3 bg-white border-2 rounded-xl text-sm resize-none transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#026a75]/20 focus:border-[#026a75] hover:border-[#026a75]/50 ${errors[question.question_name]
                                ? 'border-rose-300 bg-rose-50'
                                : 'border-gray-200'
                                }`}
                        />
                        {errors[question.question_name] && (
                            <p className="text-rose-500 text-xs flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {errors[question.question_name]}
                            </p>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
            <CardContent className="p-4 sm:p-6 lg:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Step indicator */}


                    {mockupQuestions
                        .filter(q => q.question_type === 'dropdown')
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(renderField)}

                    {/* Divider */}
                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Step 2 */}

                    {mockupQuestions
                        .filter(q => q.question_type === 'longtext')
                        .map(renderField)}

                    {/* Submit Button */}
                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                        <Button
                            type="submit"
                            className="flex-1 h-12 sm:h-14 bg-linear-to-r from-[#026a75] to-[#037a86] hover:from-[#025f68] hover:to-[#026a75] text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                        >
                            <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                            ส่งคำร้อง
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setFormData({})}
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
    )
}