// async-suspense-boundaries: Next.js automatic Suspense boundary for route
import Loading from "@/components/loading";

export default function MasterLoading() {
    return (
        <div className="h-screen flex items-center justify-center bg-linear-to-br from-[#026a75] via-[#037a86] to-[#025f68]">
            <Loading />
        </div>
    );
}
