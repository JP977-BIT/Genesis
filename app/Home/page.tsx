"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  CheckSquare,
  MessageSquare,
  ListTodo,
  CalendarDays,
  TrendingUp,
  ShieldCheck,
  UserCheck,
  Monitor,
  Truck,
  Megaphone,
  Settings2,
  Building,
  Factory,
  BookOpen,
  BarChart2,
  HeartPulse,
  Settings,
  Building2,
  ChevronLeft,
  ChevronRight,
  User,
  MessageCircle,
} from "lucide-react";

const navItems = [
  { label: "Home", icon: Home },
  { label: "Task", icon: CheckSquare },
  { label: "Message", icon: MessageSquare },
  { label: "To Do List", icon: ListTodo },
  { label: "Meeting", icon: CalendarDays },
  { label: "Finance", icon: TrendingUp },
  { label: "Admin", icon: ShieldCheck },
  { label: "HR", icon: UserCheck },
  { label: "IT", icon: Monitor },
  { label: "Logistics", icon: Truck },
  { label: "Marketing", icon: Megaphone },
  { label: "Operations", icon: Settings2 },
  { label: "Premises", icon: Building },
  { label: "Production", icon: Factory },
  { label: "Training", icon: BookOpen },
  { label: "Sales", icon: BarChart2 },
  { label: "Health & Safety", icon: HeartPulse },
];

const bottomNavItems = [
  { label: "Settings", icon: Settings },
  { label: "Companies", icon: Building2 },
];

const statusBar = {
  version: "Version: 22.8.1.1555",
  userName: "JP Jacobs",
  companyCode: "AA000001",
  companyName: "Omega Online",
  email: "jp@revelation.co.za",
  date: "Sunday 19 Mar",
};

export default function HomePage() {
  const [activeItem, setActiveItem] = useState("Home");
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <div className="flex flex-1 overflow-hidden">
        {/* ════════════════════════════════
            SIDEBAR
        ════════════════════════════════ */}
        <aside
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
          style={{ width: isExpanded ? "192px" : "56px" }}
          className="transition-[width] duration-300 ease-in-out flex flex-col bg-white border-r border-gray-200 shrink-0 overflow-hidden z-10"
        >
          {/* Back / Forward arrows */}
          <div className="flex items-center gap-1 px-3 py-2.5 border-b border-gray-100 shrink-0">
            <button className="text-gray-400 hover:text-gray-600 transition">
              <ChevronLeft size={16} />
            </button>
            <button
              className="text-gray-400 hover:text-gray-600 transition"
              style={{
                opacity: isExpanded ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Logo / Branding */}
          <div className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 shrink-0">
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
              <p className="text-sm font-bold text-gray-900 tracking-wide">
                GENESIS
              </p>
              <p className="text-[10px] text-gray-400">— Revelation Suite</p>
            </div>
          </div>

          {/* Main nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() =>
                  label === "Finance"
                    ? router.push("/Finance")
                    : setActiveItem(label)
                }
                className={`w-full flex items-center px-4 py-2 text-sm transition-colors whitespace-nowrap
    ${
      activeItem === label
        ? "bg-[#eaf2f0] text-[#1B3D35] font-medium border-l-2 border-[#1B3D35]"
        : "text-gray-600 hover:bg-gray-50 hover:text-[#1B3D35] border-l-2 border-transparent"
    }`}
              >
                <Icon size={15} className="shrink-0" />
                <span
                  className="ml-3 overflow-hidden whitespace-nowrap"
                  style={{
                    opacity: isExpanded ? 1 : 0,
                    transition: "opacity 150ms ease",
                  }}
                >
                  {label}
                </span>
              </button>
            ))}
          </nav>

          {/* Bottom nav */}
          <div className="border-t border-gray-100 py-1 shrink-0">
            {bottomNavItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => setActiveItem(label)}
                className={`w-full flex items-center px-4 py-2 text-sm transition-colors whitespace-nowrap
                  ${
                    activeItem === label
                      ? "bg-[#eaf2f0] text-[#1B3D35] font-medium border-l-2 border-[#1B3D35]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-[#1B3D35] border-l-2 border-transparent"
                  }`}
              >
                <Icon size={15} className="shrink-0" />
                <span
                  className="ml-3 overflow-hidden whitespace-nowrap"
                  style={{
                    opacity: isExpanded ? 1 : 0,
                    transition: "opacity 150ms ease",
                  }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════ */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-end px-4 gap-3 shrink-0">
            <button className="text-gray-500 hover:text-[#1B3D35] transition">
              <User size={18} />
            </button>
            <button className="text-gray-500 hover:text-[#1B3D35] transition">
              <MessageCircle size={18} />
            </button>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4">
            <div className="bg-white rounded-md shadow-sm px-5 py-3 mb-4">
              <p className="text-sm text-gray-500">{activeItem}</p>
            </div>
          </main>
        </div>
      </div>

      {/* ════════════════════════════════
          STATUS BAR
      ════════════════════════════════ */}
      <footer className="bg-[#1B3D35] text-[#7aada0] text-[11px] flex items-center gap-6 px-4 py-1.5 shrink-0">
        <span>{statusBar.version}</span>
        <span>{statusBar.userName}</span>
        <span>{statusBar.companyCode}</span>
        <span>{statusBar.companyName}</span>
        <span>{statusBar.email}</span>
        <span className="ml-auto">{statusBar.date}</span>
      </footer>
    </div>
  );
}
