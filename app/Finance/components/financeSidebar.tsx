import { memo, useState } from "react";
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
  Pin,
  PinOff,
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

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
  activeItem: string;
  setActiveItem: (val: string) => void;
}

const FinanceSidebar = memo(function FinanceSidebar({
  isExpanded,
  setIsExpanded,
  activeItem,
  setActiveItem,
}: SidebarProps) {
  const router = useRouter();
  const [isPinned, setIsPinned] = useState(
    () => localStorage.getItem("sidebar-pinned") === "true"
  );

  const togglePin = () => {
    const next = !isPinned;
    localStorage.setItem("sidebar-pinned", String(next));
    if (next) setIsExpanded(true);
    setIsPinned(next);
  };

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => { if (!isPinned) setIsExpanded(false); }}
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
          onClick={togglePin}
          className="ml-auto text-slate-400 hover:text-white transition"
          title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
          style={{
            opacity: isExpanded ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
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
          <p className="text-sm font-bold text-white tracking-wide">FINANCE</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {navItems.map(({ label, icon: Icon, hasPlus }) => {
          const isActive = activeItem === label;
          return (
            <button
              key={label}
              onClick={() => {
                if (label === "Dashboard") router.push("/Finance");
                setActiveItem(label);
              }}
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
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    SIDEBAR_HOVER;
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "transparent";
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
  );
});

export default FinanceSidebar;
