import { getEffectiveCapabilitiesForUser } from '../authz/capabilityService';
import type { UiConfig } from '../types/config';
import { getConfig } from '../utils/config';
import { DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB } from '../utils/fileValidation';

export type AttachmentUploadPolicy = {
  attachmentsEnabled: boolean;
  canUploadAttachments: boolean;
  canUploadVideo: boolean;
  maxVideoUploadSizeMB: number;
};

export async function getAttachmentUploadPolicy(userId: string): Promise<AttachmentUploadPolicy> {
  const [uiConfig, effective] = await Promise.all([
    getConfig<UiConfig>('ui'),
    getEffectiveCapabilitiesForUser(userId),
  ]);
  const attachmentsEnabled = uiConfig?.allowUploadFile !== false;
  const canUploadAttachments =
    attachmentsEnabled && effective.capabilities['attachment.upload'].allowed;
  const canUploadVideo =
    canUploadAttachments && effective.capabilities['attachment.video.upload'].allowed;
  const configuredLimit = uiConfig?.maxVideoUploadSizeMB;

  return {
    attachmentsEnabled,
    canUploadAttachments,
    canUploadVideo,
    maxVideoUploadSizeMB:
      typeof configuredLimit === 'number' && configuredLimit > 0
        ? configuredLimit
        : DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB,
  };
}
