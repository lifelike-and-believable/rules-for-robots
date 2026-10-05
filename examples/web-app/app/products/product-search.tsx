"use client";

import Link from "next/link";
import { useState } from "react";
import { filterProducts, formatPrice, type Product } from "@/lib/catalog";
import styles from "./products.module.css";

function statusText(count: number) {
  if (count === 0) return "No products match";
  return count === 1 ? "1 product" : `${count} products`;
}

export function ProductSearch({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const visible = filterProducts(products, query);

  return (
    <>
      <div className={styles.search}>
        <label htmlFor="product-search">Search products</label>
        <input
          id="product-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p role="status" className={styles.status}>
        {statusText(visible.length)}
      </p>
      <ul className={styles.list}>
        {visible.map((product) => (
          <li key={product.slug} className={styles.item}>
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
            <span className={styles.muted}>{product.category}</span>
            <span>{formatPrice(product.priceCents)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
