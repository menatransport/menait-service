'use client';

import { Mascot } from '@/components/mascot';

interface RobotProps {
    greeting?: string;
}

/** Legacy entry point — V.2 renders น้องมีนา instead of the old teal robot. */
export const Robot = ({ greeting }: RobotProps) => (
    <Mascot size={140} bubble={greeting ? `${greeting}! น้องมีนามาช่วยแล้ว` : undefined} />
);
