"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { prefetchCompanyData } from "@/src/lib/prefetch/company";

interface Company {
  companyName: string;
  companyNr: string;
  address1: string;
  address2: string;
  address3: string;
}

export default function CompanySelectPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch("/api/companies");
        const result = await response.json();

        if (result.success) {
          setCompanies(
            [...result.data.companies].sort(
              (a: Company, b: Company) =>
                parseInt(a.companyNr, 10) - parseInt(b.companyNr, 10),
            ),
          );
        } else {
          setError("Failed to load companies");
        }
      } catch (err) {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const handleSelectCompany = (company: Company) => {
    const cleanedCompany = {
      ...company,
      companyNr: String(parseInt(company.companyNr, 10)),
    };
    localStorage.setItem("selectedCompany", JSON.stringify(cleanedCompany));
    // Warm the Finance module's per-company data (customers, stock,
    // dashboard totals) in the background while the user is on /home.
    prefetchCompanyData(cleanedCompany.companyNr);
    router.push("/home");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#1B3D35] px-4">
      {/* Branding */}
      <div className="flex flex-col items-center mb-8 gap-2">
        <div className="w-16 h-16 rounded-full bg-[#c8dbd6] flex items-center justify-center mb-2">
          <span className="text-[#1B3D35] font-semibold text-sm tracking-widest">
            GEN
          </span>
        </div>
        <h1 className="text-white text-3xl font-semibold tracking-widest">
          GENESIS
        </h1>
        <p className="text-[#7aada0] text-xs tracking-[0.25em] uppercase">
          Select a company to continue
        </p>
      </div>

      {/* Company Cards */}
      <div className="w-full max-w-lg">
        {loading && (
          <p className="text-center text-[#7aada0]">Loading companies...</p>
        )}

        {error && <p className="text-center text-red-400">{error}</p>}

        {!loading && !error && (
          <div className="flex flex-col gap-3">
            {companies.map((company) => (
              <button
                key={company.companyNr}
                onClick={() => handleSelectCompany(company)}
                className="bg-white hover:bg-[#eaf2f0] rounded-2xl px-6 py-4 text-left transition duration-200 shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[#1B3D35] font-semibold text-sm">
                    {company.companyName}
                  </p>
                  <span className="text-[10px] font-sans text-gray-400 shrink-0">
                    {company.companyNr}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-1">
                  {company.address2} {company.address3}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-8 text-[#5a8a80] text-xs">
        © 2026 Revelation. All rights reserved.
      </p>
    </main>
  );
}
