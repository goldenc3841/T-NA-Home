import { Suspense } from "react";
import SessionPageClient from "./SessionPageClient";

export default async function Page({
  params,
}: {
  params: Promise<{ companyId: string; productId: string; sessionId: string }>;
}) {
  const { companyId, productId, sessionId } = await params;

  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-slate-400 text-xs animate-pulse">Loading evaluation transcripts...</div>
        </div>
      }
    >
      <SessionPageClient companyId={companyId} productId={productId} sessionId={sessionId} />
    </Suspense>
  );
}
