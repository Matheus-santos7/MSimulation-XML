import assert from "node:assert/strict";
import test from "node:test";
import { paginate, parsePageParam } from "./paginate";

const items = Array.from({ length: 53 }, (_, i) => i);

test("paginate returns the requested slice and totals", () => {
  const page = paginate(items, 2, 25);
  assert.equal(page.items.length, 25);
  assert.equal(page.items[0], 25);
  assert.equal(page.totalItems, 53);
  assert.equal(page.totalPages, 3);
  assert.equal(page.page, 2);
});

test("paginate clamps a page beyond the last one", () => {
  const page = paginate(items, 99, 25);
  assert.equal(page.page, 3);
  assert.equal(page.items.length, 3);
});

test("paginate on an empty list has one page and no items", () => {
  const page = paginate([], 1, 25);
  assert.equal(page.totalPages, 1);
  assert.deepEqual(page.items, []);
});

test("parsePageParam falls back to 1 for invalid values", () => {
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam("abc"), 1);
  assert.equal(parsePageParam("0"), 1);
  assert.equal(parsePageParam("-3"), 1);
  assert.equal(parsePageParam("2.5"), 1);
  assert.equal(parsePageParam(["4", "5"]), 4);
  assert.equal(parsePageParam("4"), 4);
});
