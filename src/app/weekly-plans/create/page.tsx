"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateWeeklyPlanPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/weekly-plans/create/input");
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-[40vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );
}
