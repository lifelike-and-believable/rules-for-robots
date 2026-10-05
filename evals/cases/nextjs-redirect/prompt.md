Old links use /shop and /shop/<slug>. Permanently redirect those requests to /products and /products/<slug>, handled before routing so no page renders for the old URLs. Keep the build passing.
