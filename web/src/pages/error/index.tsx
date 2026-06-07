import { Button } from '@/components/ui/button';
import NotFoundPage from '@/pages/404';
import { getErrorMessage, getHttpStatus } from '@/utils/error';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

export default function RouteErrorPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.error' });
  const navigate = useNavigate();
  const error = useRouteError();
  const status = getHttpStatus(error) ?? 500;
  const message = getErrorMessage(error);

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <main className="bg-background flex h-dvh items-center justify-center px-6">
      <div className="flex max-w-lg flex-col gap-2">
        <p className="text-primary font-mono text-[100px] font-semibold lg:text-[200px]">
          {status}
        </p>
        <h1 className="text-primary/90 text-base font-bold tracking-tight lg:text-2xl">
          {t('pageError')}
        </h1>
        <p className="text-muted-foreground text-xs font-light">{t('pageErrorDesc')}</p>
        {message && (
          <div className="bg-muted text-muted-foreground mt-2 max-w-lg rounded-md border px-3 py-2 font-mono text-xs break-words">
            {message}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t('retry')}
          </Button>
          <Button onClick={() => navigate('/')}>{t('goHome')}</Button>
        </div>
      </div>
    </main>
  );
}
