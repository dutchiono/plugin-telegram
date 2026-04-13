import type { Plugin } from '@elizaos/core';
import {
  stopTelegramAccountAuthSession,
  telegramAccountRoutes,
} from './account-setup-routes';
import { TELEGRAM_SERVICE_NAME } from './constants';
import { MessageManager } from './messageManager';
import { TelegramService } from './service';
import { telegramSetupRoutes } from './setup-routes';
import { TelegramTestSuite } from './tests';

const telegramPlugin: Plugin = {
  name: TELEGRAM_SERVICE_NAME,
  description: 'Telegram client plugin',
  services: [TelegramService],
  routes: [...telegramSetupRoutes, ...telegramAccountRoutes],
  tests: [new TelegramTestSuite()],
  // Self-declared auto-enable: activate when the "telegram" connector is
  // configured in milady.json / eliza.json. The hardcoded CONNECTOR_PLUGINS
  // map in plugin-auto-enable.ts still serves as a fallback.
  autoEnable: {
    connectorKeys: ['telegram'],
  },
};

export { MessageManager, stopTelegramAccountAuthSession, TelegramService };
export default telegramPlugin;
