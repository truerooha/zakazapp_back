import express from "express";
import cors from "cors";
import { db, initDb } from "./db";
import { readOrderSettings, writeOrderSettings } from "./orderSettings";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "*"
  })
);
app.use(express.json());

// Получить категории
app.get("/api/categories", (_req, res) => {
  db.all("SELECT * FROM categories", (err, rows) => {
    if (err) {
      res.status(500).json({ error: "DB error" });
      return;
    }
    res.json(rows);
  });
});

// Получить блюда
app.get("/api/dishes", (_req, res) => {
  db.all("SELECT * FROM dishes", (err, rows) => {
    if (err) {
      res.status(500).json({ error: "DB error" });
      return;
    }
    res.json(rows);
  });
});

// Получить список разрешённых пользователей
app.get("/api/allowed-users", (_req, res) => {
  db.all("SELECT user_id as userId FROM allowed_users", (err, rows) => {
    if (err) {
      res.status(500).json({ error: "DB error" });
      return;
    }
    res.json(rows.map((r: any) => r.userId));
  });
});

// Добавить разрешённого пользователя
app.post("/api/allowed-users", (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId || !userId.trim()) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  db.run(
    "INSERT OR IGNORE INTO allowed_users (user_id) VALUES (?)",
    [userId.trim()],
    function (err) {
      if (err) {
        res.status(500).json({ error: "DB error" });
        return;
      }
      res.status(201).json({ userId, created: this.changes > 0 });
    }
  );
});

// Создать заказ
app.post("/api/orders", (req, res) => {
  const { items, userId } = req.body as {
    items?: { dishId: string; quantity: number }[];
    userId?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items are required" });
    return;
  }

  if (!userId || !userId.trim()) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const id = `order-${new Date().toISOString()}`;
  const createdAt = new Date().toISOString();
  const orderDate = createdAt.slice(0, 10); // YYYY-MM-DD
  const status = "placed";

  db.serialize(() => {
    db.run(
      "INSERT INTO orders (id, createdAt, status, userId, orderDate) VALUES (?, ?, ?, ?, ?)",
      [id, createdAt, status, userId.trim(), orderDate],
      (err) => {
        if (err) {
          res.status(500).json({ error: "DB error" });
          return;
        }

        const stmt = db.prepare(
          "INSERT INTO order_items (orderId, dishId, quantity) VALUES (?, ?, ?)"
        );
        for (const it of items) {
          stmt.run(id, it.dishId, it.quantity);
        }
        stmt.finalize((finalizeErr) => {
          if (finalizeErr) {
            res.status(500).json({ error: "DB error" });
            return;
          }

          db.all(
            `SELECT d.id, d.name, d.description, d.price, d.categoryId, oi.quantity
             FROM order_items oi
             JOIN dishes d ON oi.dishId = d.id
             WHERE oi.orderId = ?`,
            [id],
            (itemsErr, rows) => {
              if (itemsErr) {
                res.status(500).json({ error: "DB error" });
                return;
              }

              const orderItems = rows.map((r: any) => ({
                dish: {
                  id: r.id,
                  name: r.name,
                  description: r.description,
                  price: r.price,
                  categoryId: r.categoryId
                },
                quantity: r.quantity
              }));

              res.status(201).json({
                id,
                createdAt,
                status,
                items: orderItems
              });
            }
          );
        });
      }
    );
  });
});

// Получить сводный заказ за сегодня (общий заказ)
app.get("/api/orders/summary-today", (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const summarySql = `
    SELECT d.id,
           d.name,
           d.description,
           d.price,
           d.categoryId,
           SUM(oi.quantity) as totalQuantity
    FROM orders o
    JOIN order_items oi ON oi.orderId = o.id
    JOIN dishes d ON oi.dishId = d.id
    WHERE o.orderDate = ?
    GROUP BY d.id, d.name, d.description, d.price, d.categoryId
  `;

  db.all(summarySql, [today], (err, rows) => {
    if (err) {
      res.status(500).json({ error: "DB error" });
      return;
    }

    const items = rows.map((r: any) => ({
      dish: {
        id: r.id,
        name: r.name,
        description: r.description,
        price: r.price,
        categoryId: r.categoryId
      },
      quantity: r.totalQuantity
    }));

    const baseTotal = items.reduce(
      (sum: number, it: any) => sum + it.dish.price * it.quantity,
      0
    );

    const settings = readOrderSettings();
    const discountAmount = Math.round(
      (baseTotal * Number(settings.discountPercent)) / 100
    );
    const finalTotal =
      baseTotal - discountAmount + Number(settings.deliveryFee);

    res.json({
      items,
      baseTotal,
      discountPercent: Number(settings.discountPercent),
      discountAmount,
      deliveryFee: Number(settings.deliveryFee),
      finalTotal,
      closeAt: settings.closeAt
    });
  });
});

// Получить настройки общего заказа
app.get("/api/order-settings", (_req, res) => {
  const settings = readOrderSettings();
  res.json(settings);
});

// Обновить настройки общего заказа
app.post("/api/order-settings", (req, res) => {
  const { discountPercent, deliveryFee, closeAt } = req.body as {
    discountPercent?: number;
    deliveryFee?: number;
    closeAt?: string | null;
  };

  const safeDiscount =
    typeof discountPercent === "number" && !Number.isNaN(discountPercent)
      ? discountPercent
      : 0;
  const safeDelivery =
    typeof deliveryFee === "number" && !Number.isNaN(deliveryFee)
      ? deliveryFee
      : 0;
  const safeCloseAt =
    typeof closeAt === "string" || closeAt === null ? closeAt : null;

  const settings = {
    discountPercent: safeDiscount,
    deliveryFee: safeDelivery,
    closeAt: safeCloseAt
  };

  try {
    writeOrderSettings(settings);
    res.json(settings);
  } catch {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// Удалить заказ (по id)
app.delete("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM orders WHERE id = ?", [id], function (err) {
    if (err) {
      res.status(500).json({ error: "DB error" });
      return;
    }
    res.json({ deleted: this.changes > 0 });
  });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("DB init error", err);
    process.exit(1);
  });


