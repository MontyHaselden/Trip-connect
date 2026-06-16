"use client";

import { StudentBottomSheet } from "@/components/student/StudentBottomSheet";
import { PhraseCategoryPicker } from "@/components/student/my-trip/PhraseCategoryPicker";

export function PhraseCategoriesSheet(props: {
  open: boolean;
  onClose: () => void;
  categories: Array<{ id: string; name: string; sortOrder: number }>;
  phrases: Array<{ categoryId: string }>;
  onSelectCategory: (categoryId: string) => void;
}) {
  const { open, onClose, categories, phrases, onSelectCategory } = props;

  return (
    <StudentBottomSheet open={open} onClose={onClose} title="Emergency phrases">
      <div className="pb-2">
        <PhraseCategoryPicker
          categories={categories}
          phrases={phrases}
          onSelectCategory={(id) => {
            onSelectCategory(id);
            onClose();
          }}
        />
      </div>
    </StudentBottomSheet>
  );
}
