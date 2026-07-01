"use client";

import { GripHorizontal, GripVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SectionNavProps {
  orderedItems: NavItem[];
  onReorder: (newItems: NavItem[]) => void;
  activeSection: string | null;
  onNav: (id: string) => void;
  dockPosition: "left" | "right" | "top" | "bottom";
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
}

function SortableNavItem({
  item,
  isActive,
  isHorizontal,
  onNav,
}: {
  item: NavItem;
  isActive: boolean;
  isHorizontal: boolean;
  onNav: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const { icon: Icon, label, id } = item;

  if (isHorizontal) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} className="relative">
        {/* Whole button is the drag handle in horizontal mode */}
        <button
          onClick={() => onNav(id)}
          {...listeners}
          className={`flex items-center gap-2 px-3 py-2 rounded text-[13px] font-medium transition-colors whitespace-nowrap cursor-grab active:cursor-grabbing touch-none ${
            isActive
              ? "bg-[#eff4ff] text-[#006398]"
              : "text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
          }`}
        >
          <Icon size={14} className="shrink-0" />
          {label}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="border-b border-[#c6c6cd]/50 last:border-b-0"
    >
      <button
        onClick={() => onNav(id)}
        className={`w-full text-left px-4 py-3 text-[13px] font-medium transition-colors flex items-center gap-2.5 ${
          isActive
            ? "bg-[#eff4ff] text-[#006398]"
            : "text-[#45464d] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
        }`}
      >
        {/* Grip icon is the drag handle in vertical mode */}
        <span
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={12} className="text-[#c6c6cd]" />
        </span>
        <Icon size={14} className="shrink-0" />
        {label}
      </button>
    </div>
  );
}

export function SectionNav({
  orderedItems,
  onReorder,
  activeSection,
  onNav,
  dockPosition,
  isDragging,
  onDragStart,
}: SectionNavProps) {
  const isHorizontal = dockPosition === "top" || dockPosition === "bottom";
  const ids = orderedItems.map((i) => i.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = orderedItems.findIndex((i) => i.id === active.id);
    const to = orderedItems.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(orderedItems, from, to));
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
      {/* Dock drag handle — moves the whole nav panel, not individual items */}
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={ids}
          strategy={
            isHorizontal
              ? horizontalListSortingStrategy
              : verticalListSortingStrategy
          }
        >
          {isHorizontal ? (
            <div className="flex items-center gap-0.5">
              {orderedItems.map((item) => (
                <SortableNavItem
                  key={item.id}
                  item={item}
                  isActive={activeSection === item.id}
                  isHorizontal
                  onNav={onNav}
                />
              ))}
            </div>
          ) : (
            <nav className="flex flex-col w-52">
              {orderedItems.map((item) => (
                <SortableNavItem
                  key={item.id}
                  item={item}
                  isActive={activeSection === item.id}
                  isHorizontal={false}
                  onNav={onNav}
                />
              ))}
            </nav>
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
