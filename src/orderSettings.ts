import fs from "fs";
import path from "path";

export interface OrderSettings {
  discountPercent: number;
  deliveryFee: number;
  closeAt: string | null;
}

// Конфиг лежит рядом с этим файлом: backend/src/order-settings.json
const CONFIG_PATH = path.join(__dirname, "order-settings.json");

const defaultSettings: OrderSettings = {
  discountPercent: 0,
  deliveryFee: 0,
  closeAt: null
};

export const readOrderSettings = (): OrderSettings => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return defaultSettings;
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      discountPercent:
        typeof parsed.discountPercent === "number"
          ? parsed.discountPercent
          : defaultSettings.discountPercent,
      deliveryFee:
        typeof parsed.deliveryFee === "number"
          ? parsed.deliveryFee
          : defaultSettings.deliveryFee,
      closeAt:
        typeof parsed.closeAt === "string" || parsed.closeAt === null
          ? parsed.closeAt
          : defaultSettings.closeAt
    };
  } catch {
    return defaultSettings;
  }
};

export const writeOrderSettings = (settings: OrderSettings): void => {
  const toSave: OrderSettings = {
    discountPercent:
      typeof settings.discountPercent === "number" &&
      !Number.isNaN(settings.discountPercent)
        ? settings.discountPercent
        : defaultSettings.discountPercent,
    deliveryFee:
      typeof settings.deliveryFee === "number" &&
      !Number.isNaN(settings.deliveryFee)
        ? settings.deliveryFee
        : defaultSettings.deliveryFee,
    closeAt:
      typeof settings.closeAt === "string" || settings.closeAt === null
        ? settings.closeAt
        : defaultSettings.closeAt
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2), "utf-8");
};


