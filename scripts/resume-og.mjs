import fs from "node:fs";
import path from "node:path";
import { generateAllOgImages } from "./generate-og-images.mjs";

const restaurants = JSON.parse(fs.readFileSync(path.resolve("scripts/.data/restaurants.json"), "utf8"));
const outDir = path.resolve("public/og");
const before = fs.existsSync(outDir) ? fs.readdirSync(outDir).length : 0;

const start = Date.now();
const count = await generateAllOgImages(restaurants, outDir, { skipExisting: true });
const after = fs.readdirSync(outDir).length;

console.log(
  `Ran on ${count} restaurants in ${((Date.now() - start) / 1000).toFixed(1)}s. ` +
    `Files on disk: ${before} -> ${after} (target ${restaurants.length})`
);
