import "dotenv/config";
import { Telegraf } from "telegraf";
import axios from "axios";

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

if (!BOT_TOKEN) {
  // eslint-disable-next-line no-console
  console.error(
    "BOT_TOKEN не задан. Установите переменную окружения BOT_TOKEN перед запуском бота."
  );
  process.exit(1);
}

// userId (как хранится в базе / фронте) -> telegram chatId
const userMap = new Map<string, number>();

// чтобы не отправлять уведомления несколько раз в один и тот же день
let lastNotifiedDate: string | null = null;

const bot = new Telegraf(BOT_TOKEN);

/**
 * /start — пользователь один раз пишет боту,
 * мы запоминаем соответствие userId (как в приложении) -> chatId
 */
bot.start((ctx) => {
  const from = ctx.from;
  const key = from.username ? `@${from.username}` : String(from.id);
  userMap.set(key, from.id);

  void ctx.reply(
    [
      "Привет! Я бот для расчёта суммы за обед из приложения Лимончелло.",
      "",
      "Как это работает:",
      "1️⃣ Заказ блюд ты делаешь внутри приложения (меню, корзина и общий заказ там).",
      "2️⃣ В приложении указываешь свой Telegram @username или id — по нему мы тебя узнаём.",
      "3️⃣ Когда админ закрывает общий заказ в приложении (по времени closeAt),",
      "   я автоматически считаю, сколько именно ты должен:",
      "   • твой личный заказ за сегодня",
      "   • минус часть общей скидки",
      "   • плюс твоя доля доставки.",
      "4️⃣ После закрытия заказа я пришлю тебе сюда личное сообщение с точной суммой к оплате.",
      "",
      "Ничего дополнительно нажимать не нужно — главное один раз написать мне /start,",
      "а заказы продолжать делать в приложении."
    ].join("\n")
  );
});

/**
 * Команда для ручной проверки/отправки итогов (например, для админа)
 */
bot.command("close_order", async (ctx) => {
  await notifyTodayUsers();
  await ctx.reply("Пытаюсь разослать суммы за сегодняшний заказ.");
});

/**
 * Основная функция авто-рассылки:
 * - смотрит настройки заказа (closeAt)
 * - если время прошло и ещё не слали сегодня — берёт персональные суммы
 *   и рассылает тем, у кого есть заказ.
 */
async function notifyTodayUsers(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // если уже отправляли сегодня — выходим
  if (lastNotifiedDate === today) {
    return;
  }

  try {
    // 1) читаем настройки (в т.ч. closeAt)
    const settingsResp = await axios.get(
      `${API_BASE_URL}/api/order-settings`
    );
    const { closeAt } = settingsResp.data as {
      closeAt: string | null;
    };

    if (!closeAt) {
      return;
    }

    const [hStr, mStr] = closeAt.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return;
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const closeMinutes = h * 60 + m;

    // если время закрытия ещё не наступило — ждём
    if (nowMinutes < closeMinutes) {
      return;
    }

    // 2) получаем персональные суммы за сегодня
    const personalResp = await axios.get(
      `${API_BASE_URL}/api/orders/personal-today`
    );
    const { users } = personalResp.data as {
      users: {
        userId: string;
        finalTotal: number;
      }[];
    };

    // нет ни одного заказывающего пользователя — выходим
    if (!users || users.length === 0) {
      return;
    }

    // 3) рассылаем только тем, кто есть в users
    for (const u of users) {
      const backendUserId = u.userId;
      let chatId: number | null = null;

      if (/^\d+$/.test(backendUserId)) {
        // userId — это уже telegram id
        chatId = Number(backendUserId);
      } else {
        // userId вида "@username" — ищем по карте, заполненной через /start
        chatId = userMap.get(backendUserId) ?? null;
      }

      if (chatId) {
        await bot.telegram.sendMessage(
          chatId,
          `Твоя сумма за сегодняшний обед: ${Math.round(
            u.finalTotal
          )} ₽`
        );
      }
    }

    // помечаем, что в этот день уже отправили
    lastNotifiedDate = today;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Ошибка при авто-рассылке телеграм-бота", err);
  }
}

// Периодическая проверка времени закрытия (каждые 30 секунд)
setInterval(() => {
  void notifyTodayUsers();
}, 30_000);

// Запуск бота
void bot.launch().then(() => {
  // eslint-disable-next-line no-console
  console.log("Telegram-бот запущен");
});


