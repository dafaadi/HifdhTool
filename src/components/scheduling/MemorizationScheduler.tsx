import { BookOpen, Search, ChevronDown } from 'lucide-react';
import type { ScriptStyle } from '../../utils/memorizationEngine';

const MEM_UNITS = ['Ayah', 'Page', "Rub'", 'Ruku', 'Surah'];

interface Props { scriptStyle: ScriptStyle; }

export function MemorizationScheduler({ scriptStyle }: Props) {
  return (
    <div className="sd-card sd-card--memorization" data-script={scriptStyle}>

      {/* Header */}
      <div className="sd-card-header">
        <div className="sd-card-icon sd-card-icon--memorization">
          <BookOpen size={20} />
        </div>
        <h3 className="sd-card-title">Memorization</h3>
        <span className="sd-badge sd-badge--progress">NEW<br />PROGRESS</span>
      </div>

      {/* Single-unit search (shell only) */}
      <div className="sd-search-wrap">
        <Search size={15} className="sd-search-icon" />
        <input
          type="text"
          className="sd-search-input"
          placeholder="Select Surah"
          readOnly
        />
      </div>

      {/* Unit type + quantity slider */}
      <div className="sd-field-row">
        <div className="sd-field-group">
          <span className="sd-field-label">Unit</span>
          <div className="sd-select-wrap">
            <select className="sd-select" defaultValue="Ayah">
              {MEM_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
            <ChevronDown size={11} className="sd-select-chevron" />
          </div>
        </div>

        <div className="sd-slider-group">
          <div className="sd-slider-label-row">
            <span className="sd-field-label">Quantity</span>
            <span className="sd-field-label">10</span>
          </div>
          <input
            type="range"
            className="sd-slider"
            min={1}
            max={50}
            defaultValue={10}
            readOnly
          />
        </div>
      </div>

      {/* Output figure */}
      <div className="sd-unit-output">10 Ayahs</div>

    </div>
  );
}
