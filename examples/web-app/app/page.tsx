import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>RFR Shop</h1>
      <p>A small catalogue of outdoor gear. Browse everything or search by name.</p>
      <Link href="/products">Browse products</Link>
    </main>
  );
}
