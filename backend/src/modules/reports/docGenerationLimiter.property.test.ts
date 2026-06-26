// Feature: doc-gen-limiter-ipv6-keygen
//
// This file hosts two complementary property test suites for the
// `docGenerationLimiter`:
//
//   1. Property 1 — Bug Condition (exploration test, MUST FAIL on the
//      unfixed code; passing failure confirms the IPv6 fallback bug exists).
//   2. Property 2 — Preservation (regression baseline that MUST stay green
//      both before and after the fix).
//
// Properties covered (see design.md → Correctness Properties):
//   • P1 — Bug Condition. Three variants:
//        A. Init-time validator silence: importing the module must not log a
//           ValidationError with code `ERR_ERL_KEY_GEN_IPV6`.
//        B. Runtime IPv6 /56 aggregation: addresses sharing a /56 prefix must
//           produce the same key.
//        C. Runtime IPv6 /56 separation: addresses in distinct /56 prefixes
//           must produce distinct keys (already true today; included to pin
//           that the eventual fix does not over-aggregate).
//   • P2 — Authenticated path: keyGenerator returns `creator.id` verbatim.
//   • P5 — IPv4 per-address determinism: same IPv4 → same key; different
//          IPv4 → different keys.
//   • P6 — 429 handler invariants: status 429, `Retry-After: 60`, exact JSON
//          body.
//   • P7 — Config export invariants: DOC_GEN_LIMITER_CONFIG.windowMs === 60_000
//          and .limit === 5.
//
// Implementation notes
// --------------------
// Access to the wired `keyGenerator` / `handler` without touching production
// code: the limiter middleware exposes neither callback. To observe them
// directly we wrap `express-rate-limit`'s `rateLimit` factory with a thin
// pass-through mock that captures `opts.keyGenerator` and `opts.handler` at
// module-init time and then defers to the real factory. The real factory
// still runs its validators (including the IPv6 fallback validator) on every
// invocation — this is what Property 1 Variant A relies on to observe the
// `ERR_ERL_KEY_GEN_IPV6` log on the unfixed code.
//
// Property 1 Variants B and C exercise the production `buildKey` export
// directly (no mock involvement), which is pure with respect to the
// rate-limit middleware.
//
// Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4,
//            3.5, 3.6

import type { Request } from 'express';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthRequest } from '../../common/middleware/auth.js';

type KeyGeneratorFn = (req: unknown, res?: unknown) => string | Promise<string>;
type HandlerFn = (req: unknown, res: unknown, next: unknown, options: unknown) => void;

// Hoisted capture slot, populated by the mock factory below at module load.
const captured = vi.hoisted(() => ({
  keyGenerator: undefined as KeyGeneratorFn | undefined,
  handler: undefined as HandlerFn | undefined,
}));

// Pass-through wrap of `rateLimit` that records the two callbacks we want to
// exercise directly. All other behaviour (validators, store init, the returned
// middleware) is identical to the real factory.
vi.mock('express-rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('express-rate-limit')>();
  const wrap: typeof actual.rateLimit = (opts) => {
    if (opts && typeof opts === 'object') {
      if (typeof opts.keyGenerator === 'function') {
        captured.keyGenerator = opts.keyGenerator as KeyGeneratorFn;
      }
      if (typeof opts.handler === 'function') {
        captured.handler = opts.handler as unknown as HandlerFn;
      }
    }
    return actual.rateLimit(opts);
  };
  return {
    ...actual,
    default: wrap,
    rateLimit: wrap,
  };
});

// Importing the module under test runs the wrapped `rateLimit` factory, which
// populates `captured.keyGenerator` and `captured.handler`. We also pull in
// the production `buildKey` export for direct use by Property 1 Variants B/C.
const {
  buildKey,
  docGenerationLimiter: _docGenerationLimiter,
  DOC_GEN_LIMITER_CONFIG,
} = await import('./docGenerationLimiter.js');
void _docGenerationLimiter; // keep import alive for side effects

// Synchronous wrapper around the captured keyGenerator. The production
// callback is synchronous; we assert that here and avoid awaiting in property
// bodies so fast-check can shrink cleanly. Used by Property 2 preservation
// tests, which intentionally exercise the wired callback (not the export).
const runCapturedKeyGen = (req: { creator?: { id: string }; ip?: string }): string => {
  if (!captured.keyGenerator) {
    throw new Error('keyGenerator was not captured — module did not load');
  }
  const out = captured.keyGenerator(req as unknown);
  if (out instanceof Promise) {
    throw new Error('docGenerationLimiter keyGenerator unexpectedly returned a Promise');
  }
  return out;
};

describe('docGenerationLimiter — preservation property tests (Property 2)', () => {
  beforeEach(() => {
    // Sanity: the wrap captured both callbacks at module load.
    expect(captured.keyGenerator).toBeTypeOf('function');
    expect(captured.handler).toBeTypeOf('function');
  });

  // P2 — Authenticated path. For any non-empty creator id and any (possibly
  // undefined) ip, the key MUST be exactly the creator id, with no `ip:`
  // prefix and no IPv6 normalisation applied. Validates: Requirements 3.1.
  it('P2: returns creator.id verbatim regardless of ip when auth.creator is present', () => {
    const ipArb = fc.option(fc.oneof(fc.ipV4(), fc.ipV6()), { nil: undefined });
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), ipArb, (creatorId, ip) => {
        const key = runCapturedKeyGen({ creator: { id: creatorId }, ip });
        return key === creatorId;
      }),
    );
  });

  // P5a — IPv4 determinism: calling twice on the same IPv4 yields the same
  // key. Validates: Requirements 3.2.
  it('P5a: identical IPv4 inputs produce identical keys', () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        return runCapturedKeyGen({ ip }) === runCapturedKeyGen({ ip });
      }),
    );
  });

  // P5b — IPv4 separation: distinct IPv4 addresses produce distinct keys, so
  // per-IPv4 accounting is preserved. Validates: Requirements 3.2.
  it('P5b: distinct IPv4 inputs produce distinct keys', () => {
    fc.assert(
      fc.property(fc.ipV4(), fc.ipV4(), (a, b) => {
        fc.pre(a !== b);
        return runCapturedKeyGen({ ip: a }) !== runCapturedKeyGen({ ip: b });
      }),
    );
  });

  // P6 — 429 handler invariants. Direct invocation of the captured handler
  // against an in-memory response stub asserts the exact status, header, and
  // body the existing implementation emits. Validates: Requirements 3.3.
  it('P6: handler sets status=429, Retry-After=60, and the exact JSON body', () => {
    const setHeader = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { setHeader, status, json } as unknown;
    const next = vi.fn();

    captured.handler!({}, res, next, { windowMs: 60_000, limit: 5 });

    expect(setHeader).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith({
      error: 'Too many generation requests',
      retry_after_seconds: 60,
    });
    // Handler must not forward the request: response is terminal.
    expect(next).not.toHaveBeenCalled();
  });

  // P7 — Config export invariants. Direct, non-property assertions on the
  // public `as const` export. Validates: Requirements 3.4.
  it('P7: DOC_GEN_LIMITER_CONFIG exposes windowMs=60_000 and limit=5', () => {
    expect(DOC_GEN_LIMITER_CONFIG.windowMs).toBe(60_000);
    expect(DOC_GEN_LIMITER_CONFIG.limit).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Property 1 — Bug Condition (exploration tests; expected to FAIL on unfixed
// code for Variants A and B; Variant C is expected to PASS already today).
// ---------------------------------------------------------------------------

function makeReq(opts: {
  ip?: string;
  creator?: { id: string; fullName: string; role: string };
}): Request {
  return { ip: opts.ip, creator: opts.creator } as unknown as AuthRequest;
}

function groupsToIPv6(groups: number[]): string {
  return groups.map((g) => g.toString(16)).join(':');
}

const group16 = fc.integer({ min: 0, max: 0xffff });
const byte8 = fc.integer({ min: 0, max: 0xff });

// Generator: pair of IPv6 addresses guaranteed to share the same /56 prefix
// (first 56 bits = first three 16-bit groups + high byte of the fourth group
// are identical; remaining low byte of group 4 and groups 5–8 vary freely).
// The leading group is constrained to the global-unicast range (2000::/3) so
// the addresses look like real, routable IPv6.
const sameSubnetIPv6Pair = fc
  .record({
    g1: fc.integer({ min: 0x2000, max: 0x3fff }),
    g2: group16,
    g3: group16,
    g4Hi: byte8,
    aG4Lo: byte8,
    aG5: group16,
    aG6: group16,
    aG7: group16,
    aG8: group16,
    bG4Lo: byte8,
    bG5: group16,
    bG6: group16,
    bG7: group16,
    bG8: group16,
  })
  .map((p) => {
    const aGroups = [p.g1, p.g2, p.g3, (p.g4Hi << 8) | p.aG4Lo, p.aG5, p.aG6, p.aG7, p.aG8];
    const bGroups = [p.g1, p.g2, p.g3, (p.g4Hi << 8) | p.bG4Lo, p.bG5, p.bG6, p.bG7, p.bG8];
    return [groupsToIPv6(aGroups), groupsToIPv6(bGroups)] as [string, string];
  });

// Generator: pair of IPv6 addresses plus a flag indicating whether they
// happen to share a /56 prefix. Variant C uses `fc.pre(!sameSubnet)` to
// discard the sub-cases that land in the same subnet.
const differentSubnetIPv6Pair = fc
  .record({
    aG1: fc.integer({ min: 0x2000, max: 0x3fff }),
    aG2: group16,
    aG3: group16,
    aG4Hi: byte8,
    aG4Lo: byte8,
    aG5: group16,
    aG6: group16,
    aG7: group16,
    aG8: group16,
    bG1: fc.integer({ min: 0x2000, max: 0x3fff }),
    bG2: group16,
    bG3: group16,
    bG4Hi: byte8,
    bG4Lo: byte8,
    bG5: group16,
    bG6: group16,
    bG7: group16,
    bG8: group16,
  })
  .map((p) => {
    const aGroups = [p.aG1, p.aG2, p.aG3, (p.aG4Hi << 8) | p.aG4Lo, p.aG5, p.aG6, p.aG7, p.aG8];
    const bGroups = [p.bG1, p.bG2, p.bG3, (p.bG4Hi << 8) | p.bG4Lo, p.bG5, p.bG6, p.bG7, p.bG8];
    const sameSubnet =
      p.aG1 === p.bG1 && p.aG2 === p.bG2 && p.aG3 === p.bG3 && p.aG4Hi === p.bG4Hi;
    return { a: groupsToIPv6(aGroups), b: groupsToIPv6(bGroups), sameSubnet };
  });

describe('Property 1: Bug Condition — docGenerationLimiter IPv6 keyGenerator', () => {
  // Variant A — Init-time validator silence. On the unfixed code,
  // express-rate-limit's `keyGeneratorIpFallback` validator detects that
  // `buildKey` falls back to the raw IP (no IPv6 normalisation) and emits a
  // ValidationError with `code === 'ERR_ERL_KEY_GEN_IPV6'` via console.error.
  // Validates: Requirements 1.1, 2.1.
  describe('Variant A — Init-time validator silence (R2.1)', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.resetModules();
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('does not log ERR_ERL_KEY_GEN_IPV6 ValidationError on module import', async () => {
      await import('./docGenerationLimiter.js');
      const validationErrorCalls = errorSpy.mock.calls.filter((args) =>
        args.some((arg) => {
          if (!(arg instanceof Error)) return false;
          const code = (arg as Error & { code?: string }).code;
          if (code === 'ERR_ERL_KEY_GEN_IPV6') return true;
          return typeof arg.message === 'string' && arg.message.includes('ERR_ERL_KEY_GEN_IPV6');
        }),
      );
      expect(validationErrorCalls).toEqual([]);
    });
  });

  // Variant B — IPv6 /56 aggregation. On the unfixed code, `buildKey` returns
  // `ip:${req.ip}` for unauthenticated IPv6 requests, so two addresses in the
  // same /56 produce DIFFERENT keys (the bug). The fix MUST normalise IPv6
  // addresses down to their /56 prefix so this property holds.
  // Validates: Requirements 1.2, 1.3, 2.2, 2.3.
  describe('Variant B — IPv6 same-/56 aggregation (R2.2, R2.3)', () => {
    it('returns the same key for any two IPv6 addresses sharing the same /56 prefix', () => {
      fc.assert(
        fc.property(sameSubnetIPv6Pair, ([ipA, ipB]) => {
          fc.pre(ipA !== ipB);
          const keyA = buildKey(makeReq({ ip: ipA }));
          const keyB = buildKey(makeReq({ ip: ipB }));
          expect(keyA).toBe(keyB);
        }),
        { numRuns: 200 },
      );
    });
  });

  // Variant C — IPv6 /56 separation. Already holds on the unfixed code (raw
  // ips that differ at all produce different keys). Pinned here to ensure the
  // fix does NOT over-aggregate beyond /56. Validates: Requirements 2.2.
  describe('Variant C — IPv6 different-/56 separation (R2.2)', () => {
    it('returns distinct keys for any two IPv6 addresses in distinct /56 prefixes', () => {
      fc.assert(
        fc.property(differentSubnetIPv6Pair, ({ a, b, sameSubnet }) => {
          fc.pre(!sameSubnet);
          const keyA = buildKey(makeReq({ ip: a }));
          const keyB = buildKey(makeReq({ ip: b }));
          expect(keyA).not.toBe(keyB);
        }),
        { numRuns: 200 },
      );
    });
  });
});
