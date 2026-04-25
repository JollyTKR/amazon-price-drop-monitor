import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface DemoDropConfig {
  label: string;
  productId: string;
  fixturePath: string;
}

const demoDrops: Record<string, DemoDropConfig> = {
  keyboard: {
    label: "Compact Mechanical Keyboard",
    productId: "example-1",
    fixturePath: "fixtures/demo/keyboard-drop.html",
  },
};

const statePath = "data/demo-fixture-state.json";
const requestedProduct = process.argv[2] ?? "keyboard";
const demoDrop = demoDrops[requestedProduct];

if (demoDrop === undefined) {
  console.error(
    `Unknown demo product "${requestedProduct}". Available demo products: ${Object.keys(demoDrops).join(", ")}`,
  );
  process.exit(1);
}

await mkdir(dirname(statePath), { recursive: true });
await writeFile(
  statePath,
  `${JSON.stringify(
    {
      overrides: {
        [demoDrop.productId]: demoDrop.fixturePath,
      },
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Demo drop enabled for ${demoDrop.label}.`);
console.log(`Product id: ${demoDrop.productId}`);
console.log(`Override fixture: ${demoDrop.fixturePath}`);
console.log(`State file: ${statePath}`);
console.log("Run npm run demo:reset before recording a new baseline.");
