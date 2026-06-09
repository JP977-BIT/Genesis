import { Suspense } from "react";
import FinanceClient from "./components/FinanceClient";

export const dynamic = "force-dynamic";

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen text-sm text-gray-400">
          Loading...
        </div>
      }
    >
      <FinanceClient />
    </Suspense>
  );
}
