import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyModelAsset } from '../src/lib/voice/model-cache.ts';

describe('ASA Moonshine model cache', () => {
  it('accepts an asset only when both byte length and SHA-256 match', async () => {
    const bytes = new TextEncoder().encode('setara moonshine cache').buffer;
    const asset = {
      file: 'fixture.onnx',
      url: 'https://example.test/fixture.onnx',
      sizeBytes: 22,
      sha256: 'bd0c13f96f59cb979c7dea393f5e7eff34c223d1d6418f231a854813a6a3f707',
    };

    await assert.doesNotReject(verifyModelAsset(bytes, asset));
    await assert.rejects(verifyModelAsset(bytes.slice(0, -1), asset), /size mismatch/);
    await assert.rejects(
      verifyModelAsset(bytes, { ...asset, sha256: '0'.repeat(64) }),
      /checksum mismatch/
    );
  });
});
