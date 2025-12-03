/**
 * Скрипт для пересидирования базы данных из menu.json
 * Использование: npx ts-node src/seedFromMenu.ts
 * 
 * Очищает таблицы dishes и categories, затем загружает данные из menu.json
 */

import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

// Используем DATA_DIR из переменных окружения для продакшена (Railway Volume)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..");
const DB_PATH = path.join(DATA_DIR, "data.sqlite");
const MENU_PATH = path.join(__dirname, "..", "menu.json");

interface MenuItemRaw {
  category: string;
  name: string;
  description: string;
  price: number;
}

// Транслитерация для генерации id
function transliterate(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };

  return text
    .toLowerCase()
    .split("")
    .map((char) => map[char] || char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateCategoryId(name: string): string {
  return `cat-${transliterate(name)}`;
}

function generateDishId(categoryId: string, name: string, index: number): string {
  return `${categoryId}-${transliterate(name).slice(0, 20)}-${index}`;
}

export async function seedFromMenu(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    // Читаем menu.json
    if (!fs.existsSync(MENU_PATH)) {
      reject(new Error(`Файл menu.json не найден: ${MENU_PATH}`));
      return;
    }

    const raw = fs.readFileSync(MENU_PATH, "utf-8");
    const menuItems: MenuItemRaw[] = JSON.parse(raw);

    // Извлекаем уникальные категории
    const categoryNames = [...new Set(menuItems.map((item) => item.category))];
    const categoryMap = new Map<string, string>();

    for (const name of categoryNames) {
      categoryMap.set(name, generateCategoryId(name));
    }

    // Генерируем данные для вставки
    const categories = categoryNames.map((name) => ({
      id: categoryMap.get(name)!,
      name,
    }));

    const dishCounters = new Map<string, number>();
    const dishes = menuItems.map((item) => {
      const categoryId = categoryMap.get(item.category)!;
      const counter = (dishCounters.get(categoryId) || 0) + 1;
      dishCounters.set(categoryId, counter);

      return {
        id: generateDishId(categoryId, item.name, counter),
        name: item.name,
        description: item.description,
        price: item.price,
        categoryId,
      };
    });

    console.log(`Найдено ${categories.length} категорий и ${dishes.length} блюд`);

    db.serialize(() => {
      // Удаляем старые данные (order_items ссылаются на dishes, поэтому сначала их)
      db.run("DELETE FROM order_items", (err) => {
        if (err) console.warn("Ошибка очистки order_items:", err.message);
      });

      db.run("DELETE FROM dishes", (err) => {
        if (err) {
          reject(new Error(`Ошибка очистки dishes: ${err.message}`));
          return;
        }
        console.log("Таблица dishes очищена");
      });

      db.run("DELETE FROM categories", (err) => {
        if (err) {
          reject(new Error(`Ошибка очистки categories: ${err.message}`));
          return;
        }
        console.log("Таблица categories очищена");
      });

      // Вставляем категории
      const insertCategory = db.prepare(
        "INSERT INTO categories (id, name) VALUES (?, ?)"
      );
      for (const c of categories) {
        insertCategory.run(c.id, c.name);
      }
      insertCategory.finalize((err) => {
        if (err) {
          reject(new Error(`Ошибка вставки категорий: ${err.message}`));
          return;
        }
        console.log(`Вставлено ${categories.length} категорий`);
      });

      // Вставляем блюда
      const insertDish = db.prepare(
        "INSERT INTO dishes (id, name, description, price, categoryId) VALUES (?, ?, ?, ?, ?)"
      );
      for (const d of dishes) {
        insertDish.run(d.id, d.name, d.description, d.price, d.categoryId);
      }
      insertDish.finalize((err) => {
        if (err) {
          reject(new Error(`Ошибка вставки блюд: ${err.message}`));
          return;
        }
        console.log(`Вставлено ${dishes.length} блюд`);
        resolve();
      });
    });
  });
}

// Если запущен напрямую (не импортирован)
if (require.main === module) {
  console.log(`Подключение к базе: ${DB_PATH}`);
  const db = new sqlite3.Database(DB_PATH);

  seedFromMenu(db)
    .then(() => {
      console.log("✅ База данных успешно пересидирована из menu.json");
      db.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Ошибка:", err.message);
      db.close();
      process.exit(1);
    });
}

