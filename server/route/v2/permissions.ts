import { Hono } from 'hono';
import { getEffectiveCapabilitiesForUser } from '../../authz/capabilityService';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import { createResponse } from '../../utils/main';

const permissionsRouter = new Hono<{ Variables: HonoVariables }>();

permissionsRouter.get('/me', authenticateJWT, async (c: HonoContext) => {
  const user = c.get('user')!;
  const data = await getEffectiveCapabilitiesForUser(user.id);
  return c.json(createResponse(data), 200);
});

export default permissionsRouter;
