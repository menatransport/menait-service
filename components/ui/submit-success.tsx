'use client';

import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from './card';
import { Button } from './button';

interface SubmitSuccessProps {
    title?: string;
    description?: string;
    buttonText?: string;
    onButtonClick?: () => void;
    showButton?: boolean;
}

export const SubmitSuccess = ({
    title = 'ส่งสำเร็จ!',
    description = 'ขอบคุณสำหรับข้อมูลของท่าน',
    buttonText = 'ทำรายการใหม่',
    onButtonClick,
    showButton = true,
}: SubmitSuccessProps) => {
    return (
        <main className="flex-1 min-h-0 bg-[#f0fafa] rounded-t-[1.5rem] sm:rounded-t-[2rem] lg:rounded-t-[3rem] shadow-2xl overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <Card className="border-0 shadow-xl rounded-2xl sm:rounded-3xl overflow-hidden">
                    <CardContent className="p-8 sm:p-12 text-center">
                        <div className="w-20 h-20 bg-linear-to-br from-[#026a75] to-[#8ce4cb] rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-[#026a75] mb-3">{title}</h2>
                        <p className="text-gray-600 mb-6">{description}</p>
                        {showButton && onButtonClick && (
                            <Button
                                onClick={onButtonClick}
                                className="h-12 sm:h-14 px-8 bg-linear-to-r from-[#026a75] to-[#037a86] hover:from-[#025f68] hover:to-[#026a75] text-white font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                            >
                                {buttonText}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
};
