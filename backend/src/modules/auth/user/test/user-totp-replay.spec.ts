/**
 * S-4 no Postgres real: de duas verificações simultâneas com o mesmo código TOTP, só uma consome o
 * passo. Pulado sem `INTEGRATION_TEST_DATABASE_URL`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithDbContext } from "../../../../lib/db/tenant-rls.js";
import {
  integrationDatabaseUrl,
  setupIntegrationDb,
  type IntegrationDb,
} from "../../../../test/integration/postgres.js";
import { UserRepository } from "../user.repository.js";

const TIME_STEP = 59_000_000;

describe.skipIf(!integrationDatabaseUrl)(
  "UserRepository.consumeTotpTimeStep (Postgres real)",
  () => {
    let db: IntegrationDb;

    beforeAll(async () => {
      db = await setupIntegrationDb();
    }, 120_000);

    afterAll(async () => {
      await db?.close();
    });

    it("should accept a TOTP time step once under concurrent verifications", async () => {
      const user = await db.owner.user.create({
        data: { email: `totp-${randomUUID()}@example.test`, password: "x", failedLoginAttempts: 3 },
      });
      const repository = new UserRepository();

      const results = await Promise.all(
        [1, 2].map(() =>
          runWithDbContext(db.app, { userId: user.id }, () =>
            repository.consumeTotpTimeStep(user.id, TIME_STEP),
          ),
        ),
      );
      const replay = await runWithDbContext(db.app, { userId: user.id }, () =>
        repository.consumeTotpTimeStep(user.id, TIME_STEP),
      );

      const stored = await db.owner.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(replay).toBe(false);
      expect(stored.totpLastTimeStep).toBe(TIME_STEP);
      expect(stored.failedLoginAttempts).toBe(0);
    }, 60_000);
  },
);
