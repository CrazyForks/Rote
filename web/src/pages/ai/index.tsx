import { AiMessageItem } from '@/components/ai/AiMessageItem';
import { AiSourceList } from '@/components/ai/AiSourceList';
import NavBar from '@/components/layout/navBar';
import { SoftBottom } from '@/components/others/SoftBottom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ContainerWithSideBar from '@/layout/ContainerWithSideBar';
import {
  aiChatMessagesAtom,
  aiRunStateAtom,
  getCurrentAiAssistantSources,
  sanitizeAiChatMessages,
} from '@/state/aiChat';
import {
  getAiStatus,
  testPersonalAiProvider,
  testSiteAiProvider,
  type AiAgentPhase,
  type AiAgentToolProgressStatus,
  type AiProviderTestProgressStep,
} from '@/utils/aiApi';
import {
  personalAiSettingsAtom,
  withPersonalAiDefaults,
  type PersonalAiMode,
} from '@/state/localAi';
import {
  clearAiRun,
  isAiRunActive,
  startAiRun,
  syncAiRunStateFromMessages,
} from '@/state/aiRunManager';
import { useAPIGet } from '@/utils/fetcher';
import { useAtom } from 'jotai';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUpRight,
  BrainCircuit,
  BrainCog,
  Cloud,
  Loader,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type PersonalAiTestStatus = 'idle' | 'testing' | 'success' | 'warning' | 'error';

type PersonalAiTestState = Record<
  PersonalAiMode,
  {
    status: PersonalAiTestStatus;
  }
>;

function AiMemoryPage() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.aiMemory' });
  const [messages, setMessages] = useAtom(aiChatMessagesAtom);
  const [runState] = useAtom(aiRunStateAtom);
  const [personalAiSettings, setPersonalAiSettings] = useAtom(personalAiSettingsAtom);
  const personalAi = useMemo(
    () => withPersonalAiDefaults(personalAiSettings),
    [personalAiSettings]
  );
  const [input, setInput] = useState('');
  const [isPromptsExpanded, setIsPromptsExpanded] = useState(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const [isPersonalAiDialogOpen, setIsPersonalAiDialogOpen] = useState(false);
  const [personalAiTestState, setPersonalAiTestState] = useState<PersonalAiTestState>({
    site: { status: 'idle' },
    personal: { status: 'idle' },
  });
  const messageEndRef = useRef<HTMLDivElement>(null);
  const isSending = runState.isSending;

  const {
    data: status,
    isLoading: isStatusLoading,
    isValidating: isStatusValidating,
    mutate: refreshStatus,
  } = useAPIGet('ai-status', getAiStatus, {
    revalidateOnFocus: false,
  });

  const quickPrompts = useMemo(
    () => [
      t('quick.theme'),
      t('quick.mbti'),
      t('quick.flags'),
      t('quick.timelineMonth'),
      t('quick.focus'),
      t('quick.mood'),
      t('quick.stress'),
    ],
    [t]
  );

  const visibleSources = useMemo(() => getCurrentAiAssistantSources(messages), [messages]);
  const pendingPlan = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.role === 'assistant' && lastMessage.pendingPlan
      ? lastMessage.pendingPlan
      : null;
  }, [messages]);

  const isPersonalModelMode = personalAi.mode === 'personal';
  const activePersonalConfig = personalAi.personal;
  const personalAiReady =
    activePersonalConfig.enabled &&
    Boolean(activePersonalConfig.baseUrl.trim()) &&
    Boolean(activePersonalConfig.model.trim());
  const unavailable =
    !isStatusLoading &&
    (isPersonalModelMode
      ? !personalAiReady
      : !status?.enabled || !status.vectorEnabled || !status.available);
  const unavailableText = isPersonalModelMode
    ? t('personal.personalUnavailable')
    : status?.eligible === false
      ? t('status.unverified')
      : status?.chatAvailable
        ? t('status.memoryUnavailable')
        : t('status.unavailable');
  const canSend = !isSending && !unavailable && input.trim().length > 0;
  const memoryStats = status?.memoryStats;
  const indexedRoteCount = memoryStats?.indexedRoteCount ?? 0;
  const roteCount = memoryStats?.roteCount ?? 0;
  const vectorProgress = roteCount > 0 ? Math.round((indexedRoteCount / roteCount) * 100) : 0;

  function getAgentPhaseLabel(phase: AiAgentPhase) {
    return t(`timeline.phases.${phase}`);
  }

  function getToolStartedLabel(toolName: string) {
    return t(`timeline.tools.${toolName}`, { defaultValue: toolName });
  }

  function getToolStatusLabel(status: AiAgentToolProgressStatus) {
    return t(`timeline.toolStatus.${status}`);
  }

  function getToolFinishedLabel(toolName: string) {
    return t(`timeline.toolDone.${toolName}`, {
      defaultValue: t('timeline.toolDone.default'),
    });
  }

  const scrollToMessageEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messageEndRef.current?.scrollIntoView({ block: 'end', behavior });
  }, []);

  const returnToBottom = useCallback(() => {
    setIsAutoScrollPaused(false);
    scrollToMessageEnd();
  }, [scrollToMessageEnd]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollRoot = document.documentElement;
      const distanceToBottom = scrollRoot.scrollHeight - window.innerHeight - window.scrollY;
      setIsAutoScrollPaused(distanceToBottom > 160);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    // Keep the chat pinned while the user has not intentionally scrolled away.
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (isAutoScrollPaused) return;
    scrollToMessageEnd('auto');
  }, [messages, isSending, scrollToMessageEnd]);

  useEffect(() => {
    if (isAiRunActive()) return;
    setMessages((prev) => sanitizeAiChatMessages(prev, t('messages.interrupted')));
  }, [setMessages, t]);

  useEffect(() => {
    // Keep the global run manager aligned with persisted chat history after reload.
    if (isSending) return;
    syncAiRunStateFromMessages(messages);
  }, [messages, isSending]);

  const clearChat = useCallback(() => {
    setIsAutoScrollPaused(false);
    clearAiRun();
  }, []);

  async function sendMessage(value: string, options: { ignorePendingPlan?: boolean } = {}) {
    const question = value.trim();
    if (!question) return;
    setInput('');
    setIsAutoScrollPaused(false);
    const started = await startAiRun({
      question,
      messages,
      pendingPlan: options.ignorePendingPlan ? null : pendingPlan,
      ignorePendingPlan: options.ignorePendingPlan,
      unavailable,
      mode: personalAi.mode,
      personalConfig: isPersonalModelMode ? activePersonalConfig : undefined,
      labels: {
        phase: getAgentPhaseLabel,
        toolStarted: getToolStartedLabel,
        toolStatus: getToolStatusLabel,
        toolFinished: getToolFinishedLabel,
        sourcesFound: (count) => t('timeline.sourcesFound', { count }),
        askFailed: t('messages.askFailed'),
        fallbackNoAnswerWithSources: t('messages.fallbackNoAnswerWithSources'),
        fallbackNoAnswerNoSources: t('messages.fallbackNoAnswerNoSources'),
      },
    });
    if (!started) {
      setInput(question);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function getModeProbe(mode: PersonalAiMode) {
    if (mode === 'site') {
      const ready = Boolean(status?.available);
      const partial = !ready && Boolean(status?.chatAvailable);
      return {
        ready,
        label: isStatusLoading
          ? t('personal.probeChecking')
          : ready
            ? t('personal.probeReady')
            : partial
              ? t('personal.probePartial')
              : t('personal.probeMissing'),
        detail: isStatusLoading
          ? t('personal.siteProbeChecking')
          : ready
            ? t('personal.siteProbeReady')
            : partial
              ? t('personal.siteProbePartial')
              : t('personal.siteProbeMissing'),
      };
    }

    const config = personalAi.personal;
    const configured = Boolean(config.baseUrl.trim()) && Boolean(config.model.trim());
    return {
      ready: configured,
      label: configured
        ? config.enabled
          ? t('personal.probeReady')
          : t('personal.probeConfigured')
        : t('personal.probeMissing'),
      detail: configured
        ? config.enabled
          ? t('personal.personalProbeReady')
          : t('personal.personalProbeDisabled')
        : t('personal.personalProbeMissing'),
    };
  }

  function getTestMessage(error: any) {
    return (
      error?.response?.data?.message ||
      error?.message ||
      error?.response?.data?.error ||
      t('personal.testFailed')
    );
  }

  function getTestProgressMessage(step: AiProviderTestProgressStep) {
    if (step === 'site') return t('personal.testToastSite');
    if (step === 'personal_remote') return t('personal.testToastRemoteProxy');
    if (step === 'tool_calling') return t('personal.testToastToolCalling');
    return t('personal.testToastLocalChat');
  }

  async function testPersonalAiMode(mode: PersonalAiMode) {
    const probe = getModeProbe(mode);
    if (!probe.ready && mode !== 'site') {
      toast.error(probe.detail);
      setPersonalAiTestState((prev) => ({
        ...prev,
        [mode]: { status: 'error' },
      }));
      return;
    }

    const toastId = toast.loading(t('personal.testToastStarting'));
    const updateTestToast = (step: AiProviderTestProgressStep) => {
      toast.loading(getTestProgressMessage(step), { id: toastId });
    };

    setPersonalAiTestState((prev) => ({
      ...prev,
      [mode]: { status: 'testing' },
    }));

    try {
      const response =
        mode === 'site'
          ? await testSiteAiProvider(updateTestToast)
          : await testPersonalAiProvider(personalAi.personal, updateTestToast);
      const latencyText =
        typeof response.data.latencyMs === 'number'
          ? t('personal.testLatency', { ms: response.data.latencyMs })
          : '';
      const toolCallingSupported = response.data.toolCalling?.supported === true;
      const toolCallingUnsupported = response.data.toolCalling?.supported === false;
      const toolCallingReason =
        response.data.toolCalling?.error ||
        response.data.toolCalling?.message ||
        t('personal.toolCallingUnknown');
      const message = toolCallingSupported
        ? t('personal.toolCallingSupported')
        : toolCallingUnsupported
          ? t('personal.toolCallingUnsupported', { reason: toolCallingReason })
          : latencyText || response.message || t('personal.testSuccess');
      setPersonalAiTestState((prev) => ({
        ...prev,
        [mode]: { status: toolCallingUnsupported ? 'warning' : 'success' },
      }));
      if (toolCallingUnsupported) {
        toast.warning(message, { id: toastId, duration: 6000 });
      } else {
        toast.success(message, { id: toastId });
      }
    } catch (error: any) {
      const message = getTestMessage(error);
      setPersonalAiTestState((prev) => ({
        ...prev,
        [mode]: { status: 'error' },
      }));
      toast.error(message, { id: toastId, duration: 8000 });
    }
  }

  const StatusBlock = () => {
    const statusText = isStatusLoading
      ? t('status.checking')
      : status?.available
        ? t('status.ready')
        : status?.chatAvailable
          ? t('status.chatReady')
          : unavailableText;
    const providerText =
      personalAi.mode === 'personal'
        ? t('model.personal')
        : status?.chatMode === 'local'
          ? t('model.local')
          : status?.chatMode === 'site'
            ? t('model.site')
            : t('model.disabled');
    const modelText = isPersonalModelMode
      ? activePersonalConfig.model || t('model.noModel')
      : status?.chatModel || t('model.noModel');

    return (
      <div className="px-4 py-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="text-md min-w-0 truncate">{t('status.title')}</div>
          <div className="text-info flex min-w-0 items-center justify-end gap-2 text-right text-xs font-light">
            {isStatusLoading || isStatusValidating ? (
              <Loader className="size-3 shrink-0 animate-spin" />
            ) : null}
            {!isStatusLoading && !status?.available ? (
              <button
                type="button"
                className="hover:text-foreground min-w-0 cursor-pointer truncate text-left duration-200 hover:opacity-60"
                onClick={() => refreshStatus()}
              >
                {statusText}
              </button>
            ) : (
              <span className="min-w-0 truncate">{statusText}</span>
            )}
          </div>
        </div>
        <div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-sm">
          <span className="text-info min-w-0 truncate font-light">{t('model.source')}</span>
          <span className="shrink-0 truncate text-right text-xs font-medium">{providerText}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-3 text-sm">
          <span className="text-info min-w-0 truncate font-light">{t('model.model')}</span>
          <span className="shrink-0 truncate text-right font-mono text-xs">
            {isStatusLoading ? '-' : modelText}
          </span>
        </div>
        <div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-sm">
          <span className="text-info min-w-0 truncate font-light">
            {t('memoryStats.roteCount')}
          </span>
          <span className="shrink-0 font-mono tabular-nums">
            {isStatusLoading ? '-' : roteCount.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center justify-between gap-3 text-sm">
          <span className="text-info min-w-0 truncate font-light">
            {t('memoryStats.vectorProgress')}
          </span>
          <span className="shrink-0 font-mono tabular-nums">
            {isStatusLoading
              ? '-'
              : t('memoryStats.vectorProgressValue', { percent: vectorProgress })}
          </span>
        </div>
        <div className="text-info mt-2 line-clamp-3 text-xs font-light">
          {personalAi.mode === 'personal'
            ? t('personal.personalPrivacy')
            : t('privacy.description')}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setIsPersonalAiDialogOpen(true)}
        >
          <Settings2 className="size-4" />
          {t('personal.openSettings')}
        </Button>
      </div>
    );
  };

  const PersonalAiDialog = () => {
    const setMode = (mode: PersonalAiMode) => {
      setPersonalAiSettings({ ...personalAi, mode });
    };
    const setProviderField = (patch: Partial<typeof personalAi.personal>) => {
      setPersonalAiSettings({
        ...personalAi,
        personal: { ...personalAi.personal, ...patch },
      });
    };
    const modeOptions: Array<{
      mode: PersonalAiMode;
      icon: ReactNode;
      title: string;
      description: string;
    }> = [
      {
        mode: 'site',
        icon: <Cloud className="size-4" />,
        title: t('personal.siteMode'),
        description: t('personal.siteModeDesc'),
      },
      {
        mode: 'personal',
        icon: <BrainCog className="size-4" />,
        title: t('personal.personalMode'),
        description: t('personal.personalModeDesc'),
      },
    ];
    const editableConfig = personalAi.personal;
    const activeProbe = getModeProbe(personalAi.mode);
    const activeTest = personalAiTestState[personalAi.mode];

    return (
      <Dialog open={isPersonalAiDialogOpen} onOpenChange={setIsPersonalAiDialogOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('personal.title')}</DialogTitle>
            <DialogDescription>{t('personal.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {modeOptions.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  className={`rounded-md border p-3 text-left duration-200 ${
                    personalAi.mode === option.mode
                      ? 'border-foreground bg-foreground text-background'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setMode(option.mode)}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {option.icon}
                    <span>{option.title}</span>
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        getModeProbe(option.mode).ready
                          ? personalAi.mode === option.mode
                            ? 'bg-background/20 text-background'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : personalAi.mode === option.mode
                            ? 'bg-background/15 text-background/80'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {getModeProbe(option.mode).label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs opacity-80">{option.description}</p>
                </button>
              ))}
            </div>

            <div className="rounded-md border p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 self-center">
                  <p className="text-sm font-medium">{t('personal.probeTitle')}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{activeProbe.detail}</p>
                </div>
                <div className="flex justify-start sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={activeTest.status === 'testing' || isStatusLoading}
                    onClick={() => testPersonalAiMode(personalAi.mode)}
                  >
                    {activeTest.status === 'testing' ? (
                      <Loader className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    {t('personal.testButton')}
                  </Button>
                </div>
              </div>
            </div>

            {personalAi.mode === 'site' ? (
              <div className="rounded-md border p-4">
                <div className="flex items-start gap-3">
                  <Cloud className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t('personal.siteTitle')}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{t('personal.siteDesc')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <Label>{t('personal.enablePersonal')}</Label>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t('personal.enablePersonalDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={editableConfig.enabled}
                    onCheckedChange={(enabled) => setProviderField({ enabled })}
                  />
                </div>

                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>{t('personal.baseUrl')}</Label>
                    <Input
                      value={editableConfig.baseUrl}
                      placeholder="http://127.0.0.1:8080/v1 or https://api.openai.com/v1"
                      onChange={(event) => setProviderField({ baseUrl: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('personal.model')}</Label>
                    <Input
                      value={editableConfig.model}
                      placeholder="gemma-4-12b-it or gpt-4.1-mini"
                      onChange={(event) => setProviderField({ model: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('personal.apiKey')}</Label>
                    <Input
                      type="password"
                      value={editableConfig.apiKey}
                      onChange={(event) => setProviderField({ apiKey: event.target.value })}
                    />
                  </div>
                </div>

                <p className="text-muted-foreground mt-3 text-xs">
                  {t('personal.personalProxyNote')}
                </p>
              </div>
            )}

            {personalAi.mode === 'personal' ? (
              <div className="bg-muted/20 rounded-md border p-3">
                <p className="text-sm font-medium">{t('personal.startGuideTitle')}</p>
                <code className="bg-background mt-2 block overflow-x-auto rounded-md border px-3 py-2 text-xs">
                  llama-server --hf-repo google/gemma-4-12B-it-qat-q4_0-gguf:Q4_0 --host 127.0.0.1
                  --port 8080 --alias gemma-4-12b-it --ctx-size 4096
                </code>
                <p className="text-muted-foreground mt-2 text-xs">{t('personal.startGuideDesc')}</p>
              </div>
            ) : null}

            <div className="bg-muted/20 rounded-md border p-3">
              <p className="text-sm font-medium">{t('personal.capabilityTitle')}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {personalAi.mode === 'site'
                  ? t('personal.siteCapability')
                  : t('personal.personalCapability')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const SideBar = () => (
    <div className="flex w-full flex-col divide-y">
      <StatusBlock />
      <div className="divide-border/50 flex flex-col divide-y">
        <div className="px-4 py-2">
          <div className="text-md">{t('quick.title')}</div>
          <div className="text-info text-xs font-light">{t('empty.desc')}</div>
        </div>
        <div className="grid w-4/5 gap-2 px-4 py-2">
          {(isPromptsExpanded ? quickPrompts : quickPrompts.slice(0, 4)).map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="hover:text-info min-w-0 cursor-pointer text-left text-sm duration-200 hover:opacity-60 disabled:pointer-events-none disabled:opacity-40"
              disabled={isSending || unavailable}
              onClick={() => sendMessage(prompt, { ignorePendingPlan: true })}
            >
              <span className="line-clamp-2 min-w-0">{prompt}</span>
            </button>
          ))}
          {!isPromptsExpanded && quickPrompts.length > 4 && (
            <button
              type="button"
              className="text-info hover:text-foreground flex cursor-pointer items-center gap-2 text-sm duration-200 hover:opacity-60"
              onClick={() => setIsPromptsExpanded(true)}
            >
              <ArrowDownLeft className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{t('quick.expand')}</span>
            </button>
          )}
          {isPromptsExpanded && quickPrompts.length > 4 && (
            <button
              type="button"
              className="text-info hover:text-foreground flex cursor-pointer items-center gap-2 text-sm duration-200 hover:opacity-60"
              onClick={() => setIsPromptsExpanded(false)}
            >
              <ArrowUpRight className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{t('quick.collapse')}</span>
            </button>
          )}
        </div>
      </div>
      <div className="divide-border/50 flex flex-col divide-y">
        <div className="px-4 py-2">
          <div className="text-md">{t('sources.title')}</div>
          {visibleSources.length === 0 && (
            <div className="text-info text-xs font-light">{t('sources.empty')}</div>
          )}
        </div>
        <AiSourceList sources={visibleSources} emptyLabel={t('sources.empty')} />
      </div>
    </div>
  );

  return (
    <ContainerWithSideBar
      sidebar={<SideBar />}
      sidebarHeader={
        <div className="flex min-w-0 items-center gap-2 p-3 text-lg font-semibold">
          <BrainCog className="size-5 shrink-0" />
          <span className="min-w-0 truncate">{t('sideBarTitle')}</span>
        </div>
      }
      hideSidebarToggleButton={true}
      hideFloatBtnsOnMobile={true}
    >
      <PersonalAiDialog />
      <NavBar title={t('title')} icon={<BrainCircuit className="size-5" />}>
        <div className="ml-auto flex items-center gap-2">
          {isSending && <Loader className="size-4 animate-spin" />}
          {messages.length > 0 && !isSending && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={clearChat}
              aria-label={t('clear')}
              title={t('clear')}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </NavBar>

      <div className="flex min-h-[calc(100dvh-var(--nav-height,56px))] flex-col">
        <div className="flex-1 divide-y">
          {messages.length === 0 ? (
            <div className="flex flex-col justify-center gap-4 p-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="inline size-5" />
                  {t('empty.title')}
                </div>
                <div className="text-info max-w-md text-sm">{t('empty.desc')}</div>
              </div>
              <div className="relative flex max-w-xl flex-wrap items-center gap-2 pb-6">
                {(isPromptsExpanded ? quickPrompts : quickPrompts.slice(0, 4)).map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="link"
                    className="h-auto cursor-pointer p-0 text-sm underline"
                    disabled={isSending || unavailable}
                    onClick={() => sendMessage(prompt, { ignorePendingPlan: true })}
                  >
                    {prompt}
                  </Button>
                ))}
                {!isPromptsExpanded && quickPrompts.length > 4 && (
                  <SoftBottom>
                    <div
                      className="text-info hover:text-foreground pointer-events-auto flex cursor-pointer items-center justify-center gap-1 text-sm duration-300"
                      onClick={() => setIsPromptsExpanded(true)}
                    >
                      <ArrowDownLeft className="size-4" /> {t('quick.expand')}
                    </div>
                  </SoftBottom>
                )}
                {isPromptsExpanded && quickPrompts.length > 4 && (
                  <div
                    className="text-info hover:text-foreground pointer-events-auto mt-1 flex w-full cursor-pointer items-center justify-center gap-1 text-sm duration-300"
                    onClick={() => setIsPromptsExpanded(false)}
                  >
                    <ArrowUpRight className="size-4" /> {t('quick.collapse')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            messages.map((message) => <AiMessageItem key={message.id} message={message} />)
          )}
          <div ref={messageEndRef} className="h-24 shrink-0" />
        </div>

        <form
          className="bg-background sticky bottom-16 z-10 border-t px-3 py-1 sm:bottom-0"
          onSubmit={handleSubmit}
        >
          {isAutoScrollPaused && messages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -top-12 left-1/2 z-20 size-8 -translate-x-1/2 rounded-full shadow-sm"
              onClick={returnToBottom}
              aria-label={t('backToBottom')}
              title={t('backToBottom')}
            >
              <ArrowDown className="size-4" />
            </Button>
          )}
          {unavailable && (
            <div className="text-info mb-2 px-1 text-sm font-light">{unavailableText}</div>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={input}
              className="inputOrTextAreaInit focus:bg-foreground/3 rounded-md p-0 text-sm shadow-none"
              placeholder={t('inputPlaceholder')}
              disabled={isSending || unavailable}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="shrink-0 rounded-md"
              disabled={!canSend}
              aria-label={t('send')}
              title={t('send')}
            >
              {isSending ? <Loader className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </form>
      </div>
    </ContainerWithSideBar>
  );
}

export default AiMemoryPage;
