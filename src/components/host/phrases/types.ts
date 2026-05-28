export type PhraseItem = {
  id: string;
  categoryId: string;
  englishText: string;
  translatedText: string;
  pronunciation: string | null;
  notes: string | null;
  source: "default" | "ai" | "host";
  sortOrder: number;
};

export type PhraseCategory = {
  id: string;
  name: string;
  sortOrder: number;
  phrases: PhraseItem[];
};

export type PhraseTree = { categories: PhraseCategory[] };
