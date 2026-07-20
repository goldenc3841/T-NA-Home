import { Suspense } from "react";
import ClientDashboardClient from "./ClientDashboardClient";

export default async function Page({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-slate-400 text-xs animate-pulse">Loading workspace dashboard...</div>
        </div>
      }
    >
      <ClientDashboardClient companyId={companyId} />
    </Suspense>
  );
}
