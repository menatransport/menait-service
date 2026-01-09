'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        // เมื่อเกิด Error ให้ redirect ไปหน้า issue
        router.replace('/404notfound');
    }, [router]);

    return null;
}
