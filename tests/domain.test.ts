import { test } from 'node:test';
import assert from 'node:assert/strict';
import { age, code, validCpf } from '../src/lib/domain';
test('CPF rejects invalid checksums and repeated digits', () => {
  assert.equal(validCpf('52998224725'), true);
  assert.equal(validCpf('52998224724'), false);
  assert.equal(validCpf('11111111111'), false);
  assert.equal(validCpf(''), false);
});
test('age changes on birthday and numbering grows beyond three digits', () => {
  assert.equal(age('2000-09-18', '2026-09-17'), 25);
  assert.equal(age('2000-09-18', '2026-09-18'), 26);
  assert.equal(code('FAM', 1), 'FAM-001');
  assert.equal(code('FAM', 1000), 'FAM-1000');
});
