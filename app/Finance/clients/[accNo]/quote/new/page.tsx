"use client";

import { useParams } from "next/navigation";
import QuoteEditor from "../components/QuoteEditor";

export default function NewQuotePage() {
  const params = useParams();
  const accNo = params.accNo as string;

  return <QuoteEditor accNo={accNo} />;
}
