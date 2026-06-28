import { loadAppConfig } from "../src/config/env.js";

const config = loadAppConfig();

console.log(
  JSON.stringify(
    {
      ...config,
      telegramBotToken: "[redacted]",
      shopeeAffiliateId: config.shopeeAffiliateId ? "[configured]" : "[missing]",
      adminUsernames: [...config.adminUsernames],
      adminUserIds: [...config.adminUserIds]
    },
    null,
    2
  )
);
