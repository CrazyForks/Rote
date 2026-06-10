import { describe, expect, it } from 'bun:test';
import { UserRole } from '../types/main';
import { resolveEffectiveCapabilities } from '../authz/capabilities';

describe('capability resolution', () => {
  it('uses user overrides before role policies', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      rolePolicies: { 'ai.site.chat': 'deny' },
      userOverrides: { 'ai.site.chat': 'allow' },
    });

    expect(capabilities['ai.site.chat']).toEqual({
      allowed: true,
      source: 'user_override',
      role: UserRole.USER,
    });
  });

  it('denies video upload when attachment upload is denied', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.USER,
      userOverrides: {
        'attachment.upload': 'deny',
        'attachment.video.upload': 'allow',
      },
    });

    expect(capabilities['attachment.video.upload']).toEqual({
      allowed: false,
      source: 'dependency',
      role: UserRole.USER,
    });
  });

  it('does not allow policies or overrides to reduce super admin permissions', () => {
    const capabilities = resolveEffectiveCapabilities({
      role: UserRole.SUPER_ADMIN,
      rolePolicies: { 'ai.site.chat': 'deny' },
      userOverrides: { 'attachment.upload': 'deny' },
    });

    expect(Object.values(capabilities).every((capability) => capability.allowed)).toBe(true);
  });
});
