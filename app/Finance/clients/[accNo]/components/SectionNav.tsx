"use client";

import { useState } from "react";
import { GripHorizontal, GripVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SectionNavProps {
  items: readonly NavItem[];
  activeSection: string | null;
  onNav: (id: string) => void;
  dockPosition: "left" | "right" | "top" | "bottom";
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const ORDER_KEY = "genesis-client-nav-order";

function loadOrder(source: readonly NavItem[]): NavItem[] {
  try {
    const saved = localStorage.getItem(ORDER_KEY);
    if (saved) {
      const ids = JSON.parse(saved) as string[];
      const sorted = ids
        .map((id) => source.find((item) => item.id === id))
        .filter((item): item is NavItem => item !== undefined);
      // Append any items added since the order was last saved.
      const extra = source.filter((item) => !ids.includes(item.id));
      return [...sorted, ...extra];
    }
  } catch {}
  return [...source];
}

export function SectionNav({
  items,
  activeSection,
  onNav,
  dockPosition,
  isDragging,
  onDragStart,
}: SectionNavProps) {
  const isHorizontal = dockPosition === "top" || dockPosition === "bottom";

  const [orderedItems, setOrderedItems] = useState<NavItem[]>(() =>
    loadOrder(items),
  );

  // Both drag source and drop target are plain state so the visual feedback
  // (opacity, insertion line) re-renders reactively.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }

    setOrderedItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      try {
        localStorage.setItem(ORDER_KEY, JSON.stringify(next.map((i) => i.id)));
      } catch {}
      return next;
    });

    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div
      data-nav-panel="true"
      className={`shrink-0 transition-opacity ${
        isDragging ? "opacity-30 pointer-events-none" : "opacity-100"
      } ${
        isHorizontal
          ? `bg-white border-[#c6c6cd] flex items-center px-3 py-1 gap-1 ${
              dockPosition === "top" ? "border-b" : "border-t"
            }`
          : `flex flex-col bg-white ${
              dockPosition === "right" ? "border-l" : "border-r"
            } border-[#c6c6cd]`
      }`}
    >
      {/* Dock drag handle — moves the whole panel, not individual items */}
      <div
        onMouseDown={onDragStart}
        className={`flex items-center justify-center cursor-grab active:cursor-grabbing text-[#b0b1b8] hover:text-[#76777d] transition-colors select-none ${
          isHorizontal
            ? "px-1 mr-1"
            : "w-full py-2 border-b border-[#c6c6cd]/50"
        }`}
      >
        <GripHorizontal size={14} />
      </div>

      {isHorizontal ? (
        // ── Horizontal layout (top / bottom dock) ──────────────────────────
        <div className="flex items-center gap-0.5">
          {orderedItems.map(({ id, label, icon: Icon }, index) => (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className="relative"
              style={{
                opacity: dragIndex === index ? 0.35 : 1,
                // Left insertion line for horizontal reordering.
                borderLeft:
                  dropIndex === index && dragIndex !== index
                    ? "2px solid #006398"
                    : "2px solid transparent",
              }}
            >
              <button
                onClick={() => onNav(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-[13px] font-medium transition-colors whitespace-nowrap cursor-grab active:cursor-grabbing ${
                  activeSection === id
                    ? "bg-[#eff4ff] text-[#006398]"
                    : "text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
                }`}
              >
                <Icon size={14} className="shrink-0" />
                {label}
              </button>
            </div>
          ))}
        </div>
      ) : (
        // ── Vertical layout (left / right dock) ────────────────────────────
        <nav className="flex flex-col w-52">
          {orderedItems.map(({ id, label, icon: Icon }, index) => (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              // border-b acts as the item separator; border-t is the drop
              // insertion indicator and stays transparent unless this item is
              // the active drop target.
              className="border-b border-[#c6c6cd]/50 last:border-b-0"
              style={{
                opacity: dragIndex === index ? 0.35 : 1,
                borderTop:
                  dropIndex === index && dragIndex !== index
                    ? "2px solid #006398"
                    : "2px solid transparent",
              }}
            >
              <button
                onClick={() => onNav(id)}
                className={`w-full text-left px-4 py-3 text-[13px] font-medium transition-colors flex items-center gap-2.5 ${
                  activeSection === id
                    ? "bg-[#eff4ff] text-[#006398]"
                    : "text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
                }`}
              >
                {/* Per-item reorder handle */}
                <GripVertical
                  size={12}
                  className="shrink-0 text-[#c6c6cd] cursor-grab active:cursor-grabbing"
                />
                <Icon size={14} className="shrink-0" />
                {label}
              </button>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
