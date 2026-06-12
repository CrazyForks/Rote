import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CapabilityEffect,
  CapabilityKey,
  CapabilityOverride,
  EffectiveCapability,
} from '@/types/permissions';
import { useTranslation } from 'react-i18next';

type PermissionSettingRowProps = {
  capability: CapabilityKey;
  value: CapabilityEffect | CapabilityOverride;
  options: readonly (CapabilityEffect | CapabilityOverride)[];
  onChange: (value: CapabilityEffect | CapabilityOverride) => void;
  disabled?: boolean;
  effective?: EffectiveCapability;
};

export default function PermissionSettingRow({
  capability,
  value,
  options,
  onChange,
  disabled = false,
  effective,
}: PermissionSettingRowProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.admin.permissions' });

  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t(`capabilities.${capability}.label`)}</span>
          {effective && (
            <Badge variant={effective.allowed ? 'default' : 'outline'}>
              {t(effective.allowed ? 'effective.allowed' : 'effective.denied')}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {t(`capabilities.${capability}.description`)}
        </p>
        {effective?.source === 'dependency' && (
          <p className="text-destructive text-sm">{t('effective.dependencyDenied')}</p>
        )}
      </div>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as CapabilityEffect | CapabilityOverride)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full shrink-0 sm:w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`effects.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
