// async-suspense-boundaries: Next.js automatic Suspense boundary for route
import Loading from "@/components/loading";

export default function MasterLoading() {
    return (
        <div className="h-screen flex items-center justify-center v2-loader-screen">
            <Loading />
        </div>
    );
}
