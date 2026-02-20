"use client"

import { CircleIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SelectStatusProps {
    status: string;
    onChange?: (newStatus: string) => void;
}

export const SelectStatus = ({ status, onChange }: SelectStatusProps) => {
    return (
        <div className='w-30 max-w-xs'>
            <Select value={status} onValueChange={onChange}>
                <SelectTrigger
                    className='w-full [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span_svg]:shrink-0'
                >
                    <SelectValue placeholder='Select status' />
                </SelectTrigger>
                <SelectContent className='[&_*[role=option]>span>svg]:text-muted-foreground/80 [&_*[role=option]]:pr-8 [&_*[role=option]]:pl-2 [&_*[role=option]>span]:right-2 [&_*[role=option]>span]:left-auto [&_*[role=option]>span]:flex [&_*[role=option]>span]:items-center [&_*[role=option]>span]:gap-2 [&_*[role=option]>span>svg]:shrink-0'>
                    <SelectItem value='Backlog'>
                        <span className='flex items-center gap-2'>
                            <CircleIcon className='size-2 fill-violet-500 text-violet-500' />
                            <span className='truncate'>Backlog</span>
                        </span>
                    </SelectItem>
                    <SelectItem value='In-Progress'>
                        <span className='flex items-center gap-2'>
                            <CircleIcon className='size-2 fill-amber-500 text-amber-500' />
                            <span className='truncate'>In Progress</span>
                        </span>
                    </SelectItem>
                    <SelectItem value='Done'>
                        <span className='flex items-center gap-2'>
                            <CircleIcon className='size-2 fill-emerald-600 text-emerald-600' />
                            <span className='truncate'>Done</span>
                        </span>
                    </SelectItem>
                    <SelectItem value='Open'>
                        <span className='flex items-center gap-2'>
                            <CircleIcon className='size-2 fill-blue-500 text-blue-500' />
                            <span className='truncate'>Open</span>
                        </span>
                    </SelectItem>
                    <SelectItem value='Rejected'>
                        <span className='flex items-center gap-2'>
                            <CircleIcon className='size-2 fill-red-500 text-red-500' />
                            <span className='truncate'>Rejected</span>
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}

