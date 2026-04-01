'use client'
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { UserContent } from "@/app/u/[userid]/user-content";
import Loading from "@/app/settings/[[...slug]]/loading";
import type { UserData } from "@/app/master/mastertable";

export default function UserPage() {
    const router = useRouter();
    const params = useParams();
    const { userid } = params;
    const [data, setData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
    if (!userid) return router.back();

    const fetchUserData = async () => {
        try {
            console.log("Fetching user data for ID:", userid);
            const response = await fetch(`/api/organization/myuser/${userid}`);
            if (!response.ok) {
                throw new Error(`Error fetching user data: ${response.status}`);
            }
            const data = await response.json();
            // console.log("User Data:", data);
            setIsLoading(false);
            setData(data);
        } catch (error) {
            console.error("Failed to fetch user data:", error);
        }
    };
    fetchUserData();

    }, [userid, router]);

    // Dynamic browser tab title
    useEffect(() => {
        if (data) {
            const name = `${data.firstname ?? ''} ${data.lastname ?? ''}`.trim();
            document.title = name || 'โปรไฟล์พนักงาน';
        }
        return () => { document.title = 'MenaIT'; };
    }, [data]);
    
    return (
            <>
                <div className="h-screen flex flex-col overflow-hidden bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">
                    <UserContent user={data} />
                </div>
                {isLoading && (
                    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">
                        <Loading />
                    </div>
                )}
            </>
        );
}
    