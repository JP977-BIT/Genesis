"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  ShieldCheck,
  GitBranch,
  Grid2X2,
  ChevronLeft,
  ChevronRight,
  User,
  MessageCircle,
  Plus,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, hasPlus: false },
  { label: "Clients", icon: Users, hasPlus: true },
  { label: "Suppliers", icon: Truck, hasPlus: true },
  { label: "Inventory", icon: Package, hasPlus: true },
  { label: "Admin", icon: ShieldCheck, hasPlus: true },
  { label: "Subsidiary", icon: GitBranch, hasPlus: false },
  { label: "Modules", icon: Grid2X2, hasPlus: true },
];

const SIDEBAR_BG = "#1e2d45";
const SIDEBAR_ACTIVE = "#2a3d5e";
const SIDEBAR_HOVER = "#263653";
const SIDEBAR_BORDER = "#2c3f5c";

interface Customer {
  accNo: string;
  name: string;
  phone: string;
  contact: string;
  balance: number;
  activeYN: boolean;
}

export default function FinancePage() {
  const router = useRouter();
  const [activeItem, setActiveItem] = useState("Dashboard");
  const [isExpanded, setIsExpanded] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("selectedCompany");
    console.log("Stored company:", stored);

    if (!stored) {
      console.log("No company found in localStorage");
      return;
    }

    let company;
    try {
      company = JSON.parse(stored);
      console.log("Parsed company:", company);
    } catch (err) {
      console.error("Failed to parse company from localStorage:", err);
      return;
    }

    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const response = await fetch(
          `/api/customers?companyNr=${company.companyNr}`,
        );
        console.log("Response status:", response.status);
        const result = await response.json();
        console.log("Result:", result);
        if (result.success) {
          setCustomers(result.data.customers);
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <div className="flex flex-1 overflow-hidden">
        <aside
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
          style={{
            width: isExpanded ? "192px" : "56px",
            backgroundColor: SIDEBAR_BG,
          }}
          className="transition-[width] duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden z-10"
        >
          <div
            className="flex items-center gap-1 px-3 py-2.5 shrink-0"
            style={{ borderBottom: `1px solid ${SIDEBAR_BORDER}` }}
          >
            <button
              onClick={() => router.push("/home")}
              className="text-slate-400 hover:text-white transition"
              title="Back to Home"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="text-slate-400 hover:text-white transition"
              style={{
                opacity: isExpanded ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div
            className="flex items-center gap-3 px-3 py-3 shrink-0"
            style={{ borderBottom: `1px solid ${SIDEBAR_BORDER}` }}
          >
            <div className="w-8 h-8 rounded-full bg-[#1B3D35] flex items-center justify-center shrink-0">
              <span className="text-white text-[9px] font-semibold tracking-widest">
                GEN
              </span>
            </div>
            <div
              className="leading-tight overflow-hidden whitespace-nowrap"
              style={{
                opacity: isExpanded ? 1 : 0,
                transition: "opacity 200ms ease 100ms",
              }}
            >
              <p className="text-[10px] text-slate-400">Revelation Suite</p>
              <p className="text-sm font-bold text-white tracking-wide">
                FINANCE
              </p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">
            {navItems.map(({ label, icon: Icon, hasPlus }) => {
              const isActive = activeItem === label;
              return (
                <button
                  key={label}
                  onClick={() => setActiveItem(label)}
                  className="w-full flex items-center px-4 py-2 text-sm whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: isActive ? SIDEBAR_ACTIVE : "transparent",
                    color: isActive ? "#ffffff" : "#94a3b8",
                    borderLeft: isActive
                      ? "2px solid #5b8dee"
                      : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.backgroundColor = SIDEBAR_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (
                        e.currentTarget as HTMLButtonElement
                      ).style.backgroundColor = "transparent";
                  }}
                >
                  <Icon size={15} className="shrink-0" />
                  <span
                    className="ml-3 flex-1 text-left overflow-hidden whitespace-nowrap"
                    style={{
                      opacity: isExpanded ? 1 : 0,
                      transition: "opacity 150ms ease",
                    }}
                  >
                    {label}
                  </span>
                  {hasPlus && isExpanded && (
                    <Plus size={13} className="shrink-0 opacity-50" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1B3D35] flex items-center justify-center">
                <span className="text-white text-[9px] font-semibold tracking-widest">
                  GEN
                </span>
              </div>
              <p className="text-sm text-gray-400">
                Revelation Suite —{" "}
                <span className="font-bold text-gray-800 tracking-wide">
                  FINANCE
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-gray-500 hover:text-[#1B3D35] transition">
                <User size={18} />
              </button>
              <button className="text-gray-500 hover:text-[#1B3D35] transition">
                <MessageCircle size={18} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4">
            {activeItem === "Clients" && (
              <div className="bg-white rounded-md shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Clients</p>
                </div>
                {loadingCustomers ? (
                  <p className="text-sm text-gray-400 px-5 py-4">
                    Loading customers...
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-5 py-3 text-left">Acc No</th>
                        <th className="px-5 py-3 text-left">Name</th>
                        <th className="px-5 py-3 text-left">Contact</th>
                        <th className="px-5 py-3 text-left">Phone</th>
                        <th className="px-5 py-3 text-right">Balance</th>
                        <th className="px-5 py-3 text-center">Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customers.map((customer) => (
                        <tr
                          key={customer.accNo}
                          className="hover:bg-gray-50 transition"
                        >
                          <td className="px-5 py-3 font-mono text-xs text-[#1B3D35]">
                            {customer.accNo}
                          </td>
                          <td className="px-5 py-3 font-medium text-gray-800">
                            {customer.name}
                          </td>
                          <td className="px-5 py-3 text-gray-500">
                            {customer.contact}
                          </td>
                          <td className="px-5 py-3 text-gray-500">
                            {customer.phone}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-gray-700">
                            R{" "}
                            {customer.balance.toLocaleString("en-ZA", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                customer.activeYN
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {customer.activeYN ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeItem !== "Clients" && (
              <div className="bg-white rounded-md shadow-sm px-5 py-3">
                <p className="text-sm text-gray-400">Finance — {activeItem}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
