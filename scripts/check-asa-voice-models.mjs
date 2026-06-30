import { readFile } from 'node:fs/promises';

const manifestUrl = new URL('../src/lib/voice/model-manifest.json', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const packageJson = JSON.parse(await readFile(packageUrl, 'utf8'));
const approvedLicenses = new Set(['Apache-2.0', 'ISC', 'MIT']);
const sha256 = /^[a-f0-9]{64}$/;

for (const dependency of manifest.dependencies) {
  if (!approvedLicenses.has(dependency.license)) {
    throw new Error(`Unapproved dependency license: ${dependency.package}`);
  }
  if (packageJson.dependencies[dependency.package] !== dependency.version) {
    throw new Error(`Voice dependency is not exactly pinned: ${dependency.package}@${dependency.version}`);
  }
}

for (const model of manifest.models) {
  if (!approvedLicenses.has(model.license)) throw new Error(`Unapproved model license: ${model.id}`);
  if (!model.version || !model.cacheKey?.includes(model.version.replace('moonshine-js-', ''))) {
    throw new Error(`Missing versioned cache key: ${model.id}`);
  }
  if (!Array.isArray(model.assets) || model.assets.length === 0) {
    throw new Error(`Model has no declared assets: ${model.id}`);
  }
  for (const asset of model.assets) {
    if (!asset.url.startsWith(model.baseUrl) || !asset.url.endsWith(`/${asset.file}`)) {
      throw new Error(`Model asset URL is outside its declared base: ${model.id}/${asset.file}`);
    }
    if (!sha256.test(asset.sha256)) throw new Error(`Invalid SHA-256: ${model.id}/${asset.file}`);
    if (!Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0) {
      throw new Error(`Invalid size: ${model.id}/${asset.file}`);
    }
  }
}

console.log(`Validated ${manifest.dependencies.length} voice dependencies and ${manifest.models.length} models.`);
