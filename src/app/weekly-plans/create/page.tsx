"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeaderSkeleton, CardSkeleton } from "@/components/Skeleton";

export default function CreateWeeklyPlanPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/weekly-plans/create/input");
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
