import { describe, expect, test } from "@jest/globals";
import { ReadOnlySqlExecutor } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import { FakeSqlExecutor } from "../test-fixtures";

describe("ReadOnlySqlExecutor", () => {
  test("allows SELECT", async () => {
    const fake = new FakeSqlExecutor();
    fake.addResult("SELECT * FROM channel_connections WHERE id = ?", [{ id: "1" }], ["1"]);
    const guard = new ReadOnlySqlExecutor(fake);
    await expect(guard.execute("SELECT * FROM channel_connections WHERE id = ?", ["1"])).resolves.toEqual([{ id: "1" }]);
  });

  test("rejects INSERT", async () => {
    const fake = new FakeSqlExecutor();
    const guard = new ReadOnlySqlExecutor(fake);
    await expect(guard.execute("INSERT INTO channel_connections (id) VALUES (?)")).rejects.toMatchObject({
      code: "READ_ONLY_VIOLATION",
    });
  });

  test("rejects UPDATE", async () => {
    const fake = new FakeSqlExecutor();
    const guard = new ReadOnlySqlExecutor(fake);
    await expect(guard.execute("UPDATE channel_connections SET status = 'active'")).rejects.toMatchObject({
      code: "READ_ONLY_VIOLATION",
    });
  });

  test("rejects DELETE", async () => {
    const fake = new FakeSqlExecutor();
    const guard = new ReadOnlySqlExecutor(fake);
    await expect(guard.execute("DELETE FROM channel_connections WHERE id = ?")).rejects.toMatchObject({
      code: "READ_ONLY_VIOLATION",
    });
  });

  test("rejects multi-statement", async () => {
    const fake = new FakeSqlExecutor();
    const guard = new ReadOnlySqlExecutor(fake);
    await expect(guard.execute("SELECT 1; UPDATE channel_connections SET status = 'active'")).rejects.toMatchObject({
      code: "READ_ONLY_VIOLATION",
    });
  });

  test("is not fooled by comments", async () => {
    const fake = new FakeSqlExecutor();
    const guard = new ReadOnlySqlExecutor(fake);
    await expect(guard.execute("/* comment */ UPDATE channel_connections SET status = 'active'")).rejects.toMatchObject({
      code: "READ_ONLY_VIOLATION",
    });
    await expect(guard.execute("-- comment\nUPDATE channel_connections SET status = 'active'")).rejects.toMatchObject({
      code: "READ_ONLY_VIOLATION",
    });
  });
});
