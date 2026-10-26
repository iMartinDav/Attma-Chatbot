'use client';

import {
  AgentAutoIcon,
  AgentBioinformaticsIcon,
  AgentGeneralIcon,
  AgentPathwayIcon,
  AgentSingleCellIcon,
  AgentVariantIcon,
  CheckmarkIcon,
  ChevronDownIcon,
} from '@/components/icons';
import { useEffect, useRef, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  description: string;
}

const AGENTS: Agent[] = [
  {
    id: 'auto',
    name: 'Agent: Auto',
    description: 'Chooses the best agent',
  },
  {
    id: 'general',
    name: 'General',
    description: 'All-purpose assistant',
  },
  {
    id: 'bioinformatics',
    name: 'Expert',
    description: 'Bioinformatics analysis',
  },
  {
    id: 'single-cell',
    name: 'Single-Cell',
    description: 'scRNA-seq specialist',
  },
  {
    id: 'variant-analysis',
    name: 'Variants',
    description: 'Genomic variant analysis',
  },
  {
    id: 'pathway-analysis',
    name: 'Pathways',
    description: 'Enrichment analysis',
  },
];

interface AgentSelectorProps {
  currentAgentId?: string;
  onAgentSelect: (agentId: string) => void;
}

export function AgentSelector({
  currentAgentId = 'auto',
  onAgentSelect,
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentAgent = AGENTS.find((a) => a.id === currentAgentId) || AGENTS[0];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = (agentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling which might close it prematurely or trigger form
    onAgentSelect(agentId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-muted/50 text-muted-foreground hover:text-foreground whitespace-nowrap cursor-pointer"
      >
        <AgentIcon id={currentAgent.id} />
        <span>{currentAgent.name}</span>
        <ChevronDownIcon size={10} className="opacity-50" />
      </button>

      {/* Dropdown - Opens above since input is at bottom of screen */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-56 py-1 bg-popover border border-border/50 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {AGENTS.map((agent) => {
            const isSelected = agent.id === currentAgentId;
            return (
              <button
                type="button"
                key={agent.id}
                onClick={(e) => handleSelect(agent.id, e)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors
                  ${isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'}
                `}
              >
                <div className="flex items-center gap-3">
                  <AgentIcon id={agent.id} />
                  <div>
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {agent.description}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <CheckmarkIcon className="h-4 w-4 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Icon selector using centralized icons
function AgentIcon({ id }: { id: string }) {
  const className = 'w-4 h-4 opacity-60';

  switch (id) {
    case 'auto':
      return <AgentAutoIcon className={className} />;
    case 'general':
      return <AgentGeneralIcon className={className} />;
    case 'bioinformatics':
      return <AgentBioinformaticsIcon className={className} />;
    case 'single-cell':
      return <AgentSingleCellIcon className={className} />;
    case 'variant-analysis':
      return <AgentVariantIcon className={className} />;
    case 'pathway-analysis':
      return <AgentPathwayIcon className={className} />;
    default:
      return <AgentAutoIcon className={className} />;
  }
}

// Compact inline button variant
export function AgentSelectorButton({
  currentAgentId = 'auto',
  onAgentSelect,
}: {
  currentAgentId?: string;
  onAgentSelect: (agentId: string) => void;
}) {
  return (
    <AgentSelector
      currentAgentId={currentAgentId}
      onAgentSelect={onAgentSelect}
    />
  );
}
