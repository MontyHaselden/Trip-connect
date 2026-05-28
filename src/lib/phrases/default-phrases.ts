export type DefaultPhraseCategory = {
  name: string;
  phrases: Array<{
    english: string;
    translated: string;
    pronunciation?: string;
  }>;
};

export const DEFAULT_PHRASE_CATEGORIES: DefaultPhraseCategory[] = [
  {
    name: "Help",
    phrases: [
      {
        english: "I am lost.",
        translated: "道に迷いました。",
        pronunciation: "Michi ni mayoimashita.",
      },
      {
        english: "Please help me call my teacher.",
        translated: "先生に電話するのを手伝ってください。",
        pronunciation: "Sensei ni denwa suru no o tetsudatte kudasai.",
      },
      {
        english: "Can you help me?",
        translated: "手伝ってもらえますか？",
        pronunciation: "Tetsudatte moraemasu ka?",
      },
    ],
  },
  {
    name: "Travel",
    phrases: [
      {
        english: "Where is the station?",
        translated: "駅はどこですか？",
        pronunciation: "Eki wa doko desu ka?",
      },
      {
        english: "Which platform?",
        translated: "何番ホームですか？",
        pronunciation: "Nanban hoomu desu ka?",
      },
      {
        english: "I need to go to this address.",
        translated: "この住所に行きたいです。",
        pronunciation: "Kono juusho ni ikitai desu.",
      },
    ],
  },
  {
    name: "Food",
    phrases: [
      {
        english: "Do you have an English menu?",
        translated: "英語のメニューはありますか？",
        pronunciation: "Eigo no menyuu wa arimasu ka?",
      },
      {
        english: "No meat, please.",
        translated: "お肉なしでお願いします。",
        pronunciation: "Oniku nashi de onegaishimasu.",
      },
      {
        english: "Can I please have some fried chicken?",
        translated: "フライドチキンをください。",
        pronunciation: "Furaido chikin o kudasai.",
      },
    ],
  },
  {
    name: "Medical",
    phrases: [
      {
        english: "I feel sick.",
        translated: "気分が悪いです。",
        pronunciation: "Kibun ga warui desu.",
      },
      {
        english: "I need a doctor.",
        translated: "医者が必要です。",
        pronunciation: "Isha ga hitsuyou desu.",
      },
      {
        english: "I have an allergy.",
        translated: "アレルギーがあります。",
        pronunciation: "Arerugii ga arimasu.",
      },
    ],
  },
  {
    name: "Hotel",
    phrases: [
      {
        english: "I have a reservation.",
        translated: "予約しています。",
        pronunciation: "Yoyaku shiteimasu.",
      },
      {
        english: "What time is breakfast?",
        translated: "朝食は何時ですか？",
        pronunciation: "Choushoku wa nanji desu ka?",
      },
    ],
  },
  {
    name: "Money",
    phrases: [
      {
        english: "How much is this?",
        translated: "これはいくらですか？",
        pronunciation: "Kore wa ikura desu ka?",
      },
      {
        english: "Do you accept credit cards?",
        translated: "クレジットカードは使えますか？",
        pronunciation: "Kurejitto kaado wa tsukaemasu ka?",
      },
    ],
  },
  {
    name: "Polite / Thank you",
    phrases: [
      {
        english: "Thank you.",
        translated: "ありがとうございます。",
        pronunciation: "Arigatou gozaimasu.",
      },
      {
        english: "Excuse me / Sorry.",
        translated: "すみません。",
        pronunciation: "Sumimasen.",
      },
      {
        english: "Please.",
        translated: "お願いします。",
        pronunciation: "Onegaishimasu.",
      },
    ],
  },
];
