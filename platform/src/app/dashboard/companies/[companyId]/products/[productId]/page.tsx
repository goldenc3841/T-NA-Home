import { Suspense } from "react";
import ProductPageClient from "./ProductPageClient";

export default async function Page({
  params,
}: {
  params: Promise<{ companyId: string; productId: string }>;
}) {
  const { companyId, productId } = await params;

  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-slate-400 text-xs animate-pulse">Loading product evaluations...</div>
        </div>
      }
    >
      <ProductPageClient companyId={companyId} productId={productId} />
    </Suspense>
  );
}
