import type { CapabilityKey } from './capabilities';
import { getEffectiveCapabilitiesForUser } from './capabilityService';

export const AI_VERIFICATION_REQUIRED_MESSAGE = 'AI features require a verified account';

type AiAccessUser = {
  id: string;
  emailVerified: boolean;
};

export async function getUserAiAccess(user: AiAccessUser) {
  const effective = await getEffectiveCapabilitiesForUser(user.id);
  return {
    verified: user.emailVerified === true,
    siteChatAllowed: effective.capabilities['ai.site.chat'].allowed,
    memoryAllowed: effective.capabilities['ai.memory.search'].allowed,
  };
}

export async function getAiAccessError(
  user: AiAccessUser,
  capability: Extract<CapabilityKey, 'ai.site.chat' | 'ai.memory.search'>
): Promise<string | null> {
  const access = await getUserAiAccess(user);
  if (!access.verified) return AI_VERIFICATION_REQUIRED_MESSAGE;
  if (capability === 'ai.site.chat' && !access.siteChatAllowed) {
    return 'capability_required:ai.site.chat';
  }
  if (capability === 'ai.memory.search' && !access.memoryAllowed) {
    return 'capability_required:ai.memory.search';
  }
  return null;
}
