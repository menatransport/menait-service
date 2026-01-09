'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { ArrowLeft, TriangleAlert, Send, ChevronDown, FileText, AlertCircle, User, Shield, Lightbulb } from 'lucide-react';
import { NavElse } from '@/components/navbar';
import { IssueForm } from '@/components/formissue';



export default function IssuePage() {
    
  

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">
            
            {/* Navbar */}
            <NavElse title="แจ้งปัญหาการใช้งานระบบ อุปกรณ์ หรือโปรแกรม" />

            {/* Main Content */}
            <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                    {/* Tips Banner */}
                    <div className=" mb-6 p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                            <Lightbulb className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800 text-sm">เคล็ดลับการแจ้งปัญหา</h3>
                            <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                                ระบุรายละเอียดให้ชัดเจน เช่น ปัญหาที่พบ, เหตุกาณ์ที่เกิด (ถ้ามี) เพื่อให้ทีม IT ช่วยเหลือได้รวดเร็วขึ้น
                            </p>
                        </div>
                    </div>

                    <IssueForm />
            

                    {/* Footer Info */}
                    <div className="mt-6 text-center text-gray-500 text-xs sm:text-sm">
                        <p>หากมีปัญหาเร่งด่วน กรุณาติดต่อ IT Support <span className="font-semibold text-[#026a75]">xxxx</span></p>
                    </div>
                </div>
            </main>
        </div>
    );
}