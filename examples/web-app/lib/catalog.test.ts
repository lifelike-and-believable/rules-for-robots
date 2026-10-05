import { describe, expect, it } from "vitest";
import { filterProducts, formatPrice, getProduct, products } from "./catalog";

describe("formatPrice", () => {
  it("formats cents as Canadian dollars", () => {
    expect(formatPrice(1299)).toBe("$12.99");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("keeps two decimals for whole dollars", () => {
    expect(formatPrice(2500)).toBe("$25.00");
  });

  it("uses a thousands separator", () => {
    expect(formatPrice(123456789)).toBe("$1,234,567.89");
  });
});

describe("filterProducts", () => {
  it("matches names case-insensitively", () => {
    const result = filterProducts(products, "TOQUE");
    expect(result.map((p) => p.slug)).toEqual(["wool-toque"]);
  });

  it("trims the query", () => {
    expect(filterProducts(products, "  toque  ")).toHaveLength(1);
  });

  it("returns everything for an empty or whitespace query", () => {
    expect(filterProducts(products, "")).toEqual(products);
    expect(filterProducts(products, "   ")).toEqual(products);
  });

  it("returns nothing when no name matches", () => {
    expect(filterProducts(products, "zzz-nothing")).toEqual([]);
  });
});

describe("catalogue", () => {
  it("has 12 products with unique slugs", () => {
    expect(products).toHaveLength(12);
    expect(new Set(products.map((p) => p.slug)).size).toBe(12);
  });

  it("finds products by slug", () => {
    expect(getProduct("headlamp")?.name).toBe("Headlamp");
    expect(getProduct("missing")).toBeUndefined();
  });

  it("stores prices as integer cents", () => {
    for (const p of products) expect(Number.isInteger(p.priceCents)).toBe(true);
  });
});
