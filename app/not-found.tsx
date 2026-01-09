'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
    const router = useRouter();

    useEffect(() => {
        // เมื่อไม่พบหน้า ให้ redirect ไปหน้า issue
        router.replace('/404notfound');
    }, [router]);

    return null;
}
