"use client";

import { MyTripMenuGroup } from "@/components/student/my-trip/MyTripMenuGroup";
import { MyTripMenuRow } from "@/components/student/my-trip/MyTripMenuRow";

export function PhraseCategoryPicker(props: {
  categories: Array<{ id: string; name: string; sortOrder: number }>;
  phrases: Array<{ categoryId: string }>;
  onSelectCategory: (categoryId: string) => void;
}) {
  const { categories, phrases, onSelectCategory } = props;

  const countByCategory = new Map<string, number>();
  for (const p of phrases) {
    countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);
  }

  const sorted = [...categories]
    .filter((c) => (countByCategory.get(c.id) ?? 0) > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!sorted.length) {
    return (
      <MyTripMenuGroup>
        <div className="px-4 py-3 text-sm text-[var(--student-text-muted)]">
          No phrases added yet.
        </div>
      </MyTripMenuGroup>
    );
  }

  return (
    <MyTripMenuGroup>
      {sorted.map((cat) => {
        const count = countByCategory.get(cat.id) ?? 0;
        return (
          <MyTripMenuRow
            key={cat.id}
            title={cat.name}
            subtitle={`${count} phrase${count === 1 ? "" : "s"}`}
            onClick={() => onSelectCategory(cat.id)}
          />
        );
      })}
    </MyTripMenuGroup>
  );
}
