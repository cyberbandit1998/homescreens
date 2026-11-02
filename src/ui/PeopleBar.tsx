import React from 'react';
import { S } from '../strings';
import type { Legend } from '../lib/people';
import type { RGB } from '../lib/colors';
import { Avatar, chipVars } from './common';

/** A row of family members (or calendars) to tap and filter by. */
export function PeopleBar({ legend, selected, onToggle, onClear, surface }: {
  legend: Legend;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  surface: RGB;
}) {
  if (legend.entries.length === 0) return null;
  return (
    <div className="fwc-people" role="group" aria-label={S.whoseEvents}>
      <button
        type="button"
        className="fwc-chip fwc-allpeople"
        aria-pressed={selected.size === 0}
        style={chipVars('#2f6fed', surface)}
        onClick={onClear}
      >
        {S.everyone}
      </button>
      {legend.entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="fwc-chip"
          aria-pressed={selected.has(entry.id)}
          style={chipVars(entry.color, surface)}
          onClick={() => onToggle(entry.id)}
        >
          <Avatar name={entry.name} color={entry.color} surface={surface} />
          {entry.name}
        </button>
      ))}
    </div>
  );
}
