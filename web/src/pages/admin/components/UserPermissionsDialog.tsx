import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CAPABILITY_KEYS,
  type CapabilityKey,
  type CapabilityOverride,
  type UserCapabilityPermissions,
} from '@/types/permissions';
import { get, put } from '@/utils/api';
import { getErrorMessage } from '@/utils/error';
import { Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import useSWR from 'swr';
import PermissionSettingRow from './PermissionSettingRow';

type PermissionUser = {
  id: string;
  username: string;
  role: string;
};

type UserPermissionsDialogProps = {
  user: PermissionUser | null;
  onClose: () => void;
  canManage: boolean;
};

export default function UserPermissionsDialog({
  user,
  onClose,
  canManage,
}: UserPermissionsDialogProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.permissions' });
  const [overrides, setOverrides] = useState<Partial<Record<CapabilityKey, CapabilityOverride>>>(
    {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const { data, isLoading, mutate } = useSWR<UserCapabilityPermissions>(
    user ? `/admin/permissions/users/${user.id}` : null,
    async (url: string) => {
      const response = await get(url);
      return response.data as UserCapabilityPermissions;
    }
  );

  useEffect(() => {
    if (data) setOverrides(data.overrides);
  }, [data]);

  const save = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await put(`/admin/permissions/users/${user.id}`, { capabilities: overrides });
      await mutate();
      toast.success(t('userDialog.saveSuccess'));
      onClose();
    } catch (error) {
      toast.error(
        t('userDialog.saveFailed', { error: getErrorMessage(error) || t('unknownError') })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('userDialog.title', { username: user?.username })}</DialogTitle>
          <DialogDescription>{t('userDialog.description')}</DialogDescription>
        </DialogHeader>
        {!canManage && <p className="text-muted-foreground text-sm">{t('readOnlyDescription')}</p>}
        {isLoading || !data ? (
          <div className="flex justify-center py-10">
            <Loader className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="border px-4">
            {CAPABILITY_KEYS.map((capability) => (
              <PermissionSettingRow
                key={capability}
                capability={capability}
                value={overrides[capability] || 'inherit'}
                options={['inherit', 'allow', 'deny']}
                disabled={!canManage}
                effective={data.capabilities[capability]}
                onChange={(effect) =>
                  setOverrides((current) => ({
                    ...current,
                    [capability]: effect as CapabilityOverride,
                  }))
                }
              />
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t('userDialog.close')}
          </Button>
          {canManage && (
            <Button onClick={save} disabled={isLoading || isSaving}>
              {isSaving && <Loader className="size-4 animate-spin" />}
              {t('userDialog.save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
