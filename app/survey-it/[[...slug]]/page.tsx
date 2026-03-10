'use client';

import { Navbar } from "@/components/navbar";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { SurveyITForm } from "./survey-it-form";

export default function SurveyITPage() {
    const params = useParams();
    const id = useMemo(() => params?.slug?.[0] as string | undefined, [params?.slug]);



    return (
        <>
            <Navbar isHome={false} title="แบบประเมินการใช้งานระบบของฝ่าย IT">
                <SurveyITForm id={id} />
            </Navbar>
            
        </>
    );
}

