import { useState, useMemo, useRef } from 'react';
import { Search } from 'lucide-react';

export interface DropdownOption {
  label: string;       // Display text shown in the list
  sublabel?: string;   // Optional secondary info (e.g. "Page 3")
  value: string;       // Unique key / identifier
  range: [number, number]; // [startWordId, endWordId]
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  onSelect: (option: DropdownOption) => void;
  placeholder?: string;
  /** Controlled value — the currently selected option (if any) */
  selectedValue?: string | null;
  /** Extra class name for the container */
  className?: string;
  /** If provided, a "selected" visual state is shown */
  activeValue?: string | null;
}

export function SearchableDropdown({
  options,
  onSelect,
  placeholder = 'Search...',
  selectedValue,
  className = '',
  activeValue,
}: SearchableDropdownProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [isPristine, setIsPristine] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // When opened fresh (pristine), show all; once typing begins, filter
  const filtered = useMemo(() => {
    if (!open) return options;
    if (isPristine || !query) return options;
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    return options.filter(o => {
      const normalized = o.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalized.includes(q);
    });
  }, [query, options, open, isPristine]);

  // Display text — show selected label when closed, raw query when typing
  const displayValue = open ? query : (
    selectedValue
      ? (options.find(o => o.value === selectedValue)?.label ?? '')
      : ''
  );

  const handleSelect = (opt: DropdownOption) => {
    setQuery(opt.label);
    setOpen(false);
    onSelect(opt);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsPristine(true);
    setOpen(true);
    e.target.select();
    // Scroll active item into view after list renders
    setTimeout(() => {
      const active = listRef.current?.querySelector('.sdd-item--active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }, 10);
  };

  return (
    <div className={`sdd-container ${className}`}>
      <div className="sdd-input-wrap">
        <Search size={14} className="sdd-search-icon" />
        <input
          type="text"
          className="sdd-input"
          value={displayValue}
          placeholder={placeholder}
          onChange={e => {
            setIsPristine(false);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && (
        <div className="sdd-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="sdd-item sdd-item--empty">No results found.</div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt.value}
                className={`sdd-item ${opt.value === activeValue ? 'sdd-item--active' : ''}`}
                onMouseDown={e => { e.preventDefault(); handleSelect(opt); }}
              >
                <span className="sdd-item-label">{opt.label}</span>
                {opt.sublabel && <span className="sdd-item-sublabel">{opt.sublabel}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
