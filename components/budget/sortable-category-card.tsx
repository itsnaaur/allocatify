"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { CategoryCard } from "./category-card";
import type { CategorySchema } from "@/lib/schema-validator";
import { cn } from "@/lib/utils";

interface SortableCategoryCardProps {
  category: CategorySchema;
  totalCents: number;
}

export function SortableCategoryCard({ category, totalCents }: SortableCategoryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="p-1 -ml-1 rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50 touch-none shrink-0"
      aria-label={`Drag to reorder ${category.name}`}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-50 z-50")}
    >
      <CategoryCard
        category={category}
        totalCents={totalCents}
        dragHandle={dragHandle}
      />
    </div>
  );
}
