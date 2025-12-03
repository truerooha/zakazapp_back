// Runtime-версия мок-данных для использования в Node (без типов TS из frontend)
export type CategoryId = "soups" | "salads" | "pasta" | "hot" | "grill";

export interface Dish {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: CategoryId;
}

export const categories: { id: CategoryId; name: string }[] = [
  { id: "soups", name: "Супы" },
  { id: "salads", name: "Салаты" },
  { id: "pasta", name: "Паста" },
  { id: "hot", name: "Горячие блюда" },
  { id: "grill", name: "Блюда на гриле" }
];

export const dishes: Dish[] = [
  {
    id: "soup-1",
    name: "Минестроне",
    description: "Лёгкий овощной суп в итальянском стиле.",
    price: 420,
    categoryId: "soups"
  },
  {
    id: "soup-2",
    name: "Томатный суп с базиликом",
    description: "Насыщенный томатный крем-суп с ароматным базиликом.",
    price: 390,
    categoryId: "soups"
  },
  {
    id: "salad-1",
    name: "Салат Капрезе",
    description: "Моцарелла, томаты, базилик, оливковое масло.",
    price: 520,
    categoryId: "salads"
  },
  {
    id: "salad-2",
    name: "Цезарь с курицей",
    description: "Классический салат с курицей-гриль и пармезаном.",
    price: 560,
    categoryId: "salads"
  },
  {
    id: "pasta-1",
    name: "Спагетти Карбонара",
    description: "Гуанчале, пармезан, сливочный соус.",
    price: 640,
    categoryId: "pasta"
  },
  {
    id: "pasta-2",
    name: "Паста Болоньезе",
    description: "Тальятелле с томатно-мясным соусом.",
    price: 620,
    categoryId: "pasta"
  },
  {
    id: "hot-1",
    name: "Куриное филе в сливочном соусе",
    description: "Подаётся с картофельным пюре.",
    price: 690,
    categoryId: "hot"
  },
  {
    id: "hot-2",
    name: "Лазанья Лимончелло",
    description: "Фирменная мясная лазанья ресторана.",
    price: 720,
    categoryId: "hot"
  },
  {
    id: "grill-1",
    name: "Стейк Рибай",
    description: "Говяжий стейк средней прожарки, соус демиглас.",
    price: 1450,
    categoryId: "grill"
  },
  {
    id: "grill-2",
    name: "Овощи гриль",
    description: "Сезонные овощи на мангале.",
    price: 480,
    categoryId: "grill"
  }
];

export const allowedUsersMock: string[] = [
  "demo_user",
  "limonchello_staff",
  "admin_telegram_username"
];


