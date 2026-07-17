import { generateAllOgImages } from "./scripts/generate-og-images.mjs";

const restaurants = Array.from({ length: 1500 }, (_, i) => ({
  slug: `test-${i}`,
  n: `Test Restaurant ${i}`,
  nb: "Loop",
  g: ["PASS", "CONDITIONAL", "FAIL"][i % 3],
}));

const start = Date.now();
const count = await generateAllOgImages(restaurants, "/tmp/og-scale-test");
console.log(`Generated ${count} images in ${((Date.now() - start) / 1000).toFixed(1)}s`);
