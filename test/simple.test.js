/**
 * @fileoverview Simple test to verify Jest setup
 * 
 * @author tiaan.swart@sleeq.global
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect } from 'vitest';

describe('Simple Test', () => {
  test('should work with ES modules', () => {
    expect(1 + 1).toBe(2);
  });

  test('should have vitest available', () => {
    expect(typeof expect).toBe('function');
  });
});
