"use client";

/**
 * StepTypeSelect is not directly used in the wizard flow since
 * type selection happens on /dashboard/new before the wizard loads.
 * This component is a placeholder that redirects back to /dashboard/new
 * if somehow reached at step 1.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StepTypeSelect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/new");
  }, [router]);

  return (
    <div className="text-center py-12 text-slate-light">
      Redirecting to type selection...
    </div>
  );
}
