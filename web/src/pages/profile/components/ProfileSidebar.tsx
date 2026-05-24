import { AppleIcon } from '@/components/icons/Apple';
import { profileAtom } from '@/state/profile';
import { API_URL } from '@/utils/api';
import { useAtomValue } from 'jotai';
import { Rss } from 'lucide-react';

export default function ProfileSidebar() {
  const profile = useAtomValue(profileAtom);
  return (
    <div className="grid grid-cols-4 divide-x border-b">
      <a
        href={`${API_URL}/rss/${profile?.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-foreground/3 flex cursor-pointer items-center justify-center gap-2 py-4"
      >
        <Rss className="size-5" />
        <div className="text-xl">RSS</div>
      </a>
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="text-xl">☝️</div>
      </div>
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="text-xl">🤓</div>
      </div>
      <a
        href="https://apps.apple.com/app/rote/id6755513897"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:bg-foreground/5 flex cursor-pointer items-center justify-center gap-2 py-4 duration-200"
      >
        <AppleIcon className="size-5" />
        <div className="text-xl">App</div>
      </a>
    </div>
  );
}
