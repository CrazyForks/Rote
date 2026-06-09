import { atomWithStorage } from 'jotai/utils';

export type AiModelMode = 'site' | 'local';

export type LocalAiConfig = {
  bridgeUrl: string;
  token: string;
  model: string;
};

export const aiModelModeAtom = atomWithStorage<AiModelMode>('aiModelMode', 'site');

export const localAiConfigAtom = atomWithStorage<LocalAiConfig>('localAiConfig', {
  bridgeUrl: 'http://127.0.0.1:11435',
  token: '',
  model: 'gemma-4-12b-it-local',
});
