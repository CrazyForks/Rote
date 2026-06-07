import { Button } from '@/components/ui/button';
import { getErrorMessage, getHttpStatus } from '@/utils/error';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PageRequestErrorProps {
  error?: unknown;
  onRetry: () => void;
}

export default function PageRequestError({ error, onRetry }: PageRequestErrorProps) {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.error' });
  const status = getHttpStatus(error);
  const message = getErrorMessage(error);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold">{t('loadFailed')}</p>
        <p className="text-muted-foreground text-sm">{t('loadFailedDesc')}</p>
        {(status || message) && (
          <div className="bg-muted text-muted-foreground w-full rounded-md border px-3 py-2 text-left font-mono text-xs break-words">
            {status && <div className="text-foreground font-semibold">HTTP {status}</div>}
            {message && <div>{message}</div>}
          </div>
        )}
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4" />
          {t('retry')}
        </Button>
      </div>
    </div>
  );
}
