import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  registerPasskey as registerPasskeyUtil,
  authenticateWithPasskey as authenticateWithPasskeyUtil,
  listPasskeys as listPasskeysUtil,
  deletePasskey as deletePasskeyUtil,
} from '@/utils/passkey';
import { authService } from '@/utils/auth';

export function usePasskey() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const registerPasskey = useCallback(async () => {
    setIsRegistering(true);
    try {
      await registerPasskeyUtil();
      toast.success(t('login.passkey.registerSuccess'));
      // Refresh the list
      await fetchPasskeys();
      return true;
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        toast.info(t('login.passkey.cancelled'));
      } else {
        toast.error(error?.message || t('login.passkey.registerFailed'));
      }
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  const authenticateWithPasskey = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      const result = await authenticateWithPasskeyUtil();
      // Store tokens
      authService.setTokens(result.accessToken, result.refreshToken);
      toast.success(t('login.passkey.loginSuccess'));
      return result;
    } catch (error: any) {
      if (error?.name === 'NotAllowedError') {
        toast.info(t('login.passkey.cancelled'));
      } else {
        toast.error(error?.message || t('login.passkey.loginFailed'));
      }
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const fetchPasskeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listPasskeysUtil();
      setPasskeys(data || []);
    } catch (error: any) {
      toast.error(error?.message || t('login.passkey.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deletePasskey = useCallback(
    async (id: string) => {
      try {
        await deletePasskeyUtil(id);
        toast.success(t('profile.settings.passkey.deleteSuccess'));
        await fetchPasskeys();
      } catch (error: any) {
        toast.error(error?.message || t('profile.settings.passkey.deleteFailed'));
      }
    },
    [fetchPasskeys]
  );

  return {
    isRegistering,
    isAuthenticating,
    passkeys,
    isLoading,
    registerPasskey,
    authenticateWithPasskey,
    fetchPasskeys,
    deletePasskey,
  };
}
