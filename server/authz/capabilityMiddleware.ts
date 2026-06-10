import type { HonoContext } from '../types/hono';
import { createResponse } from '../utils/main';
import type { CapabilityKey } from './capabilities';
import { hasCapability } from './capabilityService';

export function requireCapability(capability: CapabilityKey) {
  return async (c: HonoContext, next: () => Promise<void>) => {
    const user = c.get('user');
    if (!user) {
      return c.json(createResponse(null, 'authentication_required'), 401);
    }
    if (!(await hasCapability(user.id, capability))) {
      return c.json(createResponse(null, `capability_required:${capability}`), 403);
    }
    await next();
  };
}
