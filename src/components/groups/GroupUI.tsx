'use client';

import React from 'react';
import { 
  ChevronDown, 
  Archive, 
  User as UserIcon, 
  Star, 
  LayoutGrid, 
  List as ListIcon 
} from 'lucide-react';

// ─── Sub Components ─────────────────────────────────────────────

export function TabButton({ active, icon: IconComponent, label, onClick }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2.5 px-6 py-3.5 text-sm font-black rounded-2xl select-none border-0 no-outline transition-all duration-300 ${
        active 
          ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
          : 'text-gray-400 hover:text-indigo-600 hover:bg-white/50'
      }`}
    >
      {React.cloneElement(IconComponent, { size: 16, className: active ? 'stroke-[2.5]' : 'stroke-2' } as React.SVGAttributes<SVGElement>)}
      {label}
    </button>
  );
}

export function FilterButton({ active, icon: IconComponent, label, onClick, isFavorite }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void, isFavorite?: boolean }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-black border-0 transition-all duration-300 no-outline ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
          : 'text-gray-400 hover:bg-white hover:text-indigo-600'
      }`}
    >
      {React.cloneElement(IconComponent, { 
        size: 16, 
        className: `transition-colors ${active && isFavorite ? 'fill-white stroke-white' : ''}` 
      } as React.SVGAttributes<SVGElement>)}
      {label}
    </button>
  );
}

export function SectionTitle({ label }: { label: string }) {
  return <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-4 flex items-center gap-2"><ChevronDown className="w-3 h-3" /> {label}</h3>;
}

export function TagBadge({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`text-[10px] font-black px-3.5 py-2 rounded-xl transition-all duration-300 no-outline border-0 ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-50' 
          : 'bg-white text-gray-400 hover:text-indigo-600 hover:shadow-sm'
      }`}
    >
      #{label}
    </button>
  );
}

export function ViewSelector({ current, onChange }: { current: 'grid' | 'list', onChange: (mode: 'grid' | 'list') => void }) {
  return (
    <div className="flex p-1.5 bg-gray-200/50 rounded-2xl no-outline border-0">
      <button 
        onClick={() => onChange('grid')} 
        className={`p-2.5 rounded-xl transition-all border-0 no-outline ${current === 'grid' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button 
        onClick={() => onChange('list')} 
        className={`p-2.5 rounded-xl transition-all border-0 no-outline ${current === 'list' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <ListIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export function EmptyState({ icon: Icon, text }: { icon: React.ReactElement, text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center bg-white/30 backdrop-blur-sm border-2 border-dashed border-gray-200 rounded-[3rem]">
      {React.cloneElement(Icon, { size: 64, className: 'text-gray-200 mb-6 stroke-[1.5]' } as React.SVGAttributes<SVGElement>)}
      <p className="text-gray-500 font-black text-lg">{text}</p>
      <p className="text-sm text-gray-400 mt-2 font-bold tracking-tight">새로운 활동을 시작해보세요!</p>
    </div>
  );
}
