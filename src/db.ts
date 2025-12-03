import sqlite3 from "sqlite3";
import path from "path";
import { categories, dishes, allowedUsersMock } from "./mockDataRuntime";

const DB_PATH = path.join(__dirname, "..", "data.sqlite");

sqlite3.verbose();

export const db = new sqlite3.Database(DB_PATH);

export const initDb = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("PRAGMA foreign_keys = ON");

      db.run(
        `CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS dishes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          price INTEGER NOT NULL,
          categoryId TEXT NOT NULL,
          FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS allowed_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL UNIQUE
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          createdAt TEXT NOT NULL,
          status TEXT NOT NULL
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          orderId TEXT NOT NULL,
          dishId TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (dishId) REFERENCES dishes(id)
        )`
      );

      // Таблица настроек общего заказа (одна строка с id = 1)
      // Лёгкая миграция схемы orders: добавляем userId и orderDate при отсутствии
      db.all("PRAGMA table_info(orders)", (ordersErr, rows: any[]) => {
        if (ordersErr) {
          reject(ordersErr);
          return;
        }

        const hasUserId = rows.some((r) => r.name === "userId");
        const hasOrderDate = rows.some((r) => r.name === "orderDate");

        if (!hasUserId) {
          db.run(`ALTER TABLE orders ADD COLUMN userId TEXT`, (alterErr) => {
            if (alterErr) {
              // Игнорируем ошибку, если колонка уже существует или другая некритичная проблема
              // eslint-disable-next-line no-console
              console.error("Ошибка миграции userId в таблице orders", alterErr);
            }
          });
        }

        if (!hasOrderDate) {
          db.run(
            `ALTER TABLE orders ADD COLUMN orderDate TEXT`,
            (alterErr) => {
              if (alterErr) {
                // eslint-disable-next-line no-console
                console.error(
                  "Ошибка миграции orderDate в таблице orders",
                  alterErr
                );
              }
            }
          );
        }
      });

      // Сидирование, если таблицы пустые
      db.get("SELECT COUNT(*) as count FROM categories", (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        const count = row?.count ?? 0;
        if (count > 0) {
          resolve();
          return;
        }

        const insertCategory = db.prepare(
          "INSERT INTO categories (id, name) VALUES (?, ?)"
        );
        for (const c of categories) {
          insertCategory.run(c.id, c.name);
        }
        insertCategory.finalize();

        const insertDish = db.prepare(
          "INSERT INTO dishes (id, name, description, price, categoryId) VALUES (?, ?, ?, ?, ?)"
        );
        for (const d of dishes) {
          insertDish.run(
            d.id,
            d.name,
            d.description,
            d.price,
            d.categoryId
          );
        }
        insertDish.finalize();

        const insertUser = db.prepare(
          "INSERT OR IGNORE INTO allowed_users (user_id) VALUES (?)"
        );
        for (const u of allowedUsersMock) {
          insertUser.run(u);
        }
        insertUser.finalize();

        resolve();
      });
    });
  });
};


