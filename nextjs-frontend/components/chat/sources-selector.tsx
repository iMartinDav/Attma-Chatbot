'use client';

/**
 * The Sources menu: which knowledge bases, compute and models the agent may
 * connect to in this chat. Sources that need server setup (an API key, the
 * sandbox snapshot) are listed but locked until the deployment has them.
 */

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  CONNECTORS,
  DEFAULT_CONNECTORS,
  type ConnectorGroup,
  type ConnectorId,
} from '@/lib/ai/connectors/catalog';
import { cn, fetcher } from '@/lib/utils';
import {
  BookOpenIcon,
  BoxesIcon,
  ChevronDownIcon,
  DnaIcon,
  FileSearchIcon,
  GlobeIcon,
  LockIcon,
  NetworkIcon,
  PlugIcon,
  StethoscopeIcon,
  TerminalSquareIcon,
  Dna,
} from 'lucide-react';
import useSWR from 'swr';
import { useLocalStorage } from 'usehooks-ts';

const ICONS: Record<ConnectorId, typeof DnaIcon> = {
  phenotypes: StethoscopeIcon,
  variants: DnaIcon,
  proteins: BoxesIcon,
  literature: BookOpenIcon,
  pathways: NetworkIcon,
  web: GlobeIcon,
  python: TerminalSquareIcon,
  documents: FileSearchIcon,
  alphagenome: Dna,
};

const GROUPS: ConnectorGroup[] = ['Knowledge', 'Compute', 'Models'];

/** The user's source selection, shared by the menu and the chat transport. */
export function useSources() {
  const [selected, setSelected] = useLocalStorage<ConnectorId[]>(
    'attma-sources',
    DEFAULT_CONNECTORS,
    { initializeWithValue: false },
  );
  const { data: status } = useSWR<{ id: ConnectorId; available: boolean }[]>(
    '/api/connectors',
    fetcher,
    { revalidateOnFocus: false },
  );
  const available = new Set(
    status?.filter((s) => s.available).map((s) => s.id) ?? [],
  );
  const toggle = (id: ConnectorId) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  return {
    selected,
    available,
    loaded: Boolean(status),
    enabled: selected.filter((id) => !status || available.has(id)),
    toggle,
  };
}

export function SourcesSelector() {
  const { selected, available, loaded, enabled, toggle } = useSources();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <PlugIcon className="size-3.5" />
          <span>Sources</span>
          <span className="rounded-full bg-muted px-1.5 tabular-nums">
            {enabled.length}
          </span>
          <ChevronDownIcon className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        collisionPadding={12}
        className="w-[22rem] max-h-[min(32rem,var(--radix-popover-content-available-height))] overflow-y-auto p-2"
      >
        {GROUPS.map((group) => (
          <div key={group} className="py-1">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {group}
            </div>
            {CONNECTORS.filter((c) => c.group === group).map((connector) => {
              const Icon = ICONS[connector.id];
              const locked = loaded && !available.has(connector.id);
              const on = !locked && selected.includes(connector.id);
              return (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  key={connector.id}
                  disabled={locked}
                  onClick={() => toggle(connector.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                    locked
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {connector.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {connector.provider}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {locked
                        ? `Needs ${connector.requires} on the server`
                        : connector.description}
                    </span>
                  </span>
                  {locked ? (
                    <LockIcon className="mt-1 size-3.5 text-muted-foreground" />
                  ) : (
                    <span
                      className={cn(
                        'mt-1 inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors',
                        on ? 'bg-primary' : 'bg-muted-foreground/30',
                      )}
                    >
                      <span
                        className={cn(
                          'size-3 rounded-full bg-background transition-transform',
                          on && 'translate-x-3',
                        )}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
