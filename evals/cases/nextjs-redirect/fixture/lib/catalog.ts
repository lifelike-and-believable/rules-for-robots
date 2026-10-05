export type Product = {
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  description: string;
};

export const products: Product[] = [
  { slug: "trail-backpack", name: "Trail Backpack", category: "Bags", priceCents: 8999, description: "A 28 litre daypack with a padded back panel and rain cover." },
  { slug: "canvas-tote", name: "Canvas Tote", category: "Bags", priceCents: 2400, description: "A sturdy cotton tote that holds a week of groceries." },
  { slug: "insulated-bottle", name: "Insulated Bottle", category: "Drinkware", priceCents: 3299, description: "Keeps drinks cold for 24 hours or hot for 12." },
  { slug: "enamel-mug", name: "Enamel Mug", category: "Drinkware", priceCents: 1599, description: "A lightweight camp mug with a rolled steel rim." },
  { slug: "wool-toque", name: "Wool Toque", category: "Apparel", priceCents: 2800, description: "A warm merino wool hat with a fleece-lined band." },
  { slug: "rain-shell", name: "Rain Shell", category: "Apparel", priceCents: 14900, description: "A packable waterproof jacket with taped seams." },
  { slug: "hiking-socks", name: "Hiking Socks", category: "Apparel", priceCents: 1850, description: "Cushioned merino blend socks that resist blisters." },
  { slug: "headlamp", name: "Headlamp", category: "Lighting", priceCents: 4500, description: "A 400 lumen rechargeable headlamp with a red night mode." },
  { slug: "camp-lantern", name: "Camp Lantern", category: "Lighting", priceCents: 3800, description: "A dimmable LED lantern that runs for 40 hours." },
  { slug: "field-notebook", name: "Field Notebook", category: "Stationery", priceCents: 1200, description: "A weatherproof pocket notebook with dot-grid pages." },
  { slug: "pocket-knife", name: "Pocket Knife", category: "Tools", priceCents: 5600, description: "A compact folding knife with a locking stainless blade." },
  { slug: "first-aid-kit", name: "First Aid Kit", category: "Safety", priceCents: 2999, description: "A 60 piece kit in a water-resistant pouch." },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

const priceFormat = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

export function formatPrice(cents: number): string {
  return priceFormat.format(cents / 100);
}

export function filterProducts(list: Product[], query: string): Product[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return list;
  return list.filter((product) => product.name.toLowerCase().includes(needle));
}
