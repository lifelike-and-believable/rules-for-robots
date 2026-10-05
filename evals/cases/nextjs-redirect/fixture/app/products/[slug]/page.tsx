import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice, getProduct, products } from "@/lib/catalog";
import styles from "../products.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return { title: `${product.name} | RFR Shop`, description: product.description };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <main className={styles.main}>
      <h1>{product.name}</h1>
      <p className={styles.muted}>{product.category}</p>
      <p className={styles.price}>{formatPrice(product.priceCents)}</p>
      <p>{product.description}</p>
      <Link href="/products" className={styles.back}>
        Back to products
      </Link>
    </main>
  );
}
