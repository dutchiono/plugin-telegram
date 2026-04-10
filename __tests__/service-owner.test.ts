import {
  createUniqueUuid,
  EventType,
  type IAgentRuntime,
  Role,
  type UUID,
} from "@elizaos/core";
import type { Context } from "telegraf";
import { describe, expect, it, vi } from "vitest";
import { TelegramService } from "../src/service";
import { TelegramEventTypes } from "../src/types";

type RuntimeMock = IAgentRuntime & {
  getWorld: ReturnType<typeof vi.fn>;
  ensureWorldExists: ReturnType<typeof vi.fn>;
  ensureRoomExists: ReturnType<typeof vi.fn>;
  emitEvent: ReturnType<typeof vi.fn>;
  getSetting: ReturnType<typeof vi.fn>;
};

function createRuntimeMock(
  settings: Record<string, string | null> = {},
): RuntimeMock {
  return {
    agentId: "agent-1" as UUID,
    getSetting: vi.fn((key: string) => {
      if (key === "TELEGRAM_BOT_TOKEN") {
        return "";
      }
      return settings[key] ?? null;
    }),
    getWorld: vi.fn().mockResolvedValue(null),
    ensureWorldExists: vi.fn().mockResolvedValue(undefined),
    ensureRoomExists: vi.fn().mockResolvedValue(undefined),
    emitEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as RuntimeMock;
}

function createContextMock(): Context {
  return {
    chat: {
      id: -1001234567890,
      type: "supergroup",
      title: "Shaw Squad",
      is_forum: false,
    },
    from: {
      id: 111,
      is_bot: false,
      first_name: "Sender",
      username: "sender",
    },
    getChatAdministrators: vi.fn().mockResolvedValue([
      {
        status: "creator",
        user: {
          id: 999,
          is_bot: false,
          first_name: "Guild Creator",
          username: "group_creator",
        },
      },
    ]),
  } as unknown as Context;
}

type TelegramServiceInternals = TelegramService & {
  handleNewChat(ctx: Context): Promise<void>;
  buildStandardizedEntities: (chat: Context["chat"]) => Promise<unknown[]>;
  batchProcessEntities: (
    entities: unknown[],
    roomId: UUID,
    channelId: string,
    roomType: unknown,
    worldId: UUID,
  ) => Promise<void>;
};

describe("TelegramService owner mapping", () => {
  it("binds new Telegram worlds to the configured canonical owner instead of the chat creator", async () => {
    const runtime = createRuntimeMock({
      ELIZA_ADMIN_ENTITY_ID: "owner-app",
    });
    const service = new TelegramService(runtime) as TelegramServiceInternals;
    service.buildStandardizedEntities = vi.fn().mockResolvedValue([]);
    service.batchProcessEntities = vi.fn().mockResolvedValue(undefined);

    await service.handleNewChat(createContextMock());

    expect(runtime.ensureWorldExists).toHaveBeenCalledTimes(1);
    const world = runtime.ensureWorldExists.mock.calls[0][0];
    expect(world.metadata.ownership).toEqual({ ownerId: "owner-app" });
    expect(world.metadata.roles).toEqual({ "owner-app": Role.OWNER });
    expect(world.metadata.roles).not.toHaveProperty(
      createUniqueUuid(runtime, "999"),
    );
    expect(runtime.emitEvent).toHaveBeenCalledWith(
      TelegramEventTypes.WORLD_JOINED,
      expect.any(Object),
    );
    expect(runtime.emitEvent).toHaveBeenCalledWith(
      EventType.WORLD_JOINED,
      expect.any(Object),
    );
  });

  it("still honors the legacy Milady owner setting", async () => {
    const runtime = createRuntimeMock({
      MILADY_ADMIN_ENTITY_ID: "owner-app",
    });
    const service = new TelegramService(runtime) as TelegramServiceInternals;
    service.buildStandardizedEntities = vi.fn().mockResolvedValue([]);
    service.batchProcessEntities = vi.fn().mockResolvedValue(undefined);

    await service.handleNewChat(createContextMock());

    expect(runtime.ensureWorldExists).toHaveBeenCalledTimes(1);
    const world = runtime.ensureWorldExists.mock.calls[0][0];
    expect(world.metadata.ownership).toEqual({ ownerId: "owner-app" });
    expect(world.metadata.roles).toEqual({ "owner-app": Role.OWNER });
  });

  it("falls back to the Telegram chat creator when no canonical owner is configured", async () => {
    const runtime = createRuntimeMock();
    const service = new TelegramService(runtime) as TelegramServiceInternals;
    service.buildStandardizedEntities = vi.fn().mockResolvedValue([]);
    service.batchProcessEntities = vi.fn().mockResolvedValue(undefined);

    await service.handleNewChat(createContextMock());

    expect(runtime.ensureWorldExists).toHaveBeenCalledTimes(1);
    const world = runtime.ensureWorldExists.mock.calls[0][0];
    const creatorOwnerId = createUniqueUuid(runtime, "999");
    expect(world.metadata.ownership).toEqual({ ownerId: creatorOwnerId });
    expect(world.metadata.roles).toEqual({ [creatorOwnerId]: Role.OWNER });
  });
});
