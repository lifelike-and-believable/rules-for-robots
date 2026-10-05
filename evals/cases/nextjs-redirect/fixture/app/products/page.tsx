import type { Metadata } from "next";
import { products } from "@/lib/catalog";
import { ProductSearch } from "./product-search";
import styles from "./products.module.css";

export const metadata: Metadata = {
  title: "Products | RFR Shop",
};

export default function ProductsPage() {
  return (
    <main className={styles.main}>
      <h1>Products</h1>
      <ProductSearch products={products} />
    </main>
  );
}
