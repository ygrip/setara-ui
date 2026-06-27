import { readFile } from 'node:fs/promises';

const manifestUrl = new URL('../src/lib/voice/model-manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const approvedLicenses = new Set(['Apache-2.0', 'MIT']);
const sha256 = /^[a-f0-9]{64}$/;
const revision = /^[a-f0-9]{40}$/;

for (const model of manifest.models) {
  if (!approvedLicenses.has(model.license)) throw new Error(`Unapproved model license: ${model.id}`);
  if (!sha256.test(model.sha256)) throw new Error(`Invalid SHA-256: ${model.id}`);
  if (!revision.test(model.revision)) throw new Error(`Model revision is not immutable: ${model.id}`);
  if (!model.url.includes(`/resolve/${model.revision}/`)) throw new Error(`Model URL is not pinned: ${model.id}`);
  if (!Number.isSafeInteger(model.sizeBytes) || model.sizeBytes <= 0) throw new Error(`Invalid size: ${model.id}`);
}

console.log(`Validated ${manifest.models.length} ASA voice models.`);
