'use client';

import React from 'react';
import { 
  LayoutGrid, 
  List as ListIcon 
} from 'lucide-react';

// ─── Sub Components ─────────────────────────────────────────────

export function TabButton({ active, icon: IconComponent, label, onClick }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg select-none border-0 no-outline transition-colors duration-150 ease-out ${
        active 
          ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' 
          : 'text-ink-2 hover:text-ink'
      }`}
    >
      {React.cloneElement(IconComponent, { size: 16, strokeWidth: 1.5 } as React.SVGAttributes<SVGElement>)}
      {label}
    </button>
  );
}

export function FilterButton({ active, icon: IconComponent, label, onClick, isFavorite }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void, isFavorite?: boolean }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm border-0 transition-colors duration-150 ease-out no-outline ${
        active 
          ? 'bg-raised text-ink font-medium' 
          : 'text-ink-2 hover:bg-raised hover:text-ink'
      }`}
    >
      {React.cloneElement(IconComponent, { 
        size: 16, 
        strokeWidth: 1.5,
        className: `transition-colors ${active && isFavorite ? 'fill-current' : ''}` 
      } as React.SVGAttributes<SVGElement>)}
      {label}
    </button>
  );
}

export function SectionTitle({ label }: { label: string }) {
  return <h3 className="text-sm font-semibold text-ink px-3 mb-2">{label}</h3>;
}

export function TagBadge({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`text-xs px-2 py-0.5 rounded-md transition-colors duration-150 ease-out no-outline border-0 ${
        active 
          ? 'bg-accent-soft text-accent' 
          : 'bg-raised text-ink-2 hover:text-ink'
      }`}
    >
      #{label}
    </button>
  );
}

export function ViewSelector({ current, onChange }: { current: 'grid' | 'list', onChange: (mode: 'grid' | 'list') => void }) {
  return (
    <div className="flex p-1 bg-raised rounded-[10px] no-outline border-0">
      <button 
        onClick={() => onChange('grid')} 
        className={`p-2 rounded-lg transition-colors duration-150 ease-out border-0 no-outline ${current === 'grid' ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-ink-2 hover:text-ink'}`}
      >
        <LayoutGrid size={16} strokeWidth={1.5} />
      </button>
      <button 
        onClick={() => onChange('list')} 
        className={`p-2 rounded-lg transition-colors duration-150 ease-out border-0 no-outline ${current === 'list' ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-ink-2 hover:text-ink'}`}
      >
        <ListIcon size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function EmptyState({ icon: Icon, text }: { icon: React.ReactElement, text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
        {React.cloneElement(Icon, { size: 18, strokeWidth: 1.5, className: 'text-ink-3' } as React.SVGAttributes<SVGElement>)}
      </div>
      <p className="text-sm font-medium text-ink">{text}</p>
      <p className="text-sm text-ink-3 mt-1">첫 활동을 시작해 보세요</p>
    </div>
  );
}
