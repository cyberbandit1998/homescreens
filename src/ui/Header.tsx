import React from 'react';
import type { ViewId } from '../types';
import { S } from '../strings';
import { Icon } from './common';

const LABELS: Record<ViewId, string> = {
  day: S.day,
  week: S.week,
  month: S.month,
  schedule: S.schedule,
  chores: S.chores,
};

export function Header({ title, view, views, onView, onPrev, onNext, onToday, atToday, showNav }: {
  title: string;
  view: ViewId;
  views: ViewId[];
  onView: (v: ViewId) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  atToday: boolean;
  showNav: boolean;
}) {
  return (
    <header className="fwc-head">
      {showNav && (
        <div className="fwc-nav">
          <button type="button" className="fwc-round" onClick={onPrev} aria-label={S.previous}>
            <Icon.Left />
          </button>
          <button type="button" className="fwc-round" onClick={onNext} aria-label={S.next}>
            <Icon.Right />
          </button>
        </div>
      )}
      <h1 className="fwc-title" aria-live="polite">{title}</h1>
      {showNav && (
        <button
          type="button"
          className="fwc-today"
          onClick={atToday ? undefined : onToday}
          aria-disabled={atToday}
          aria-label={S.goToToday}
        >
          {S.today}
        </button>
      )}
      <div className="fwc-tabs" role="tablist" aria-label={S.views}>
        {views.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            className="fwc-tab"
            aria-selected={v === view}
            onClick={() => onView(v)}
          >
            {v === 'chores' && <Icon.Clipboard size="1.1em" />}
            {LABELS[v]}
          </button>
        ))}
      </div>
    </header>
  );
}
