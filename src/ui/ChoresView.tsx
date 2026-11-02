import React from 'react';
import { S } from '../strings';
import { hostPost, useHostFetch } from '../sdk';
import {
  applyToggle,
  groupByTimeOfDay,
  parseChoresToday,
  parseFamily,
  progress,
  type ChoreMember,
  type ChoresToday,
  type FamilyMember,
} from '../lib/chores';
import { Avatar, chipVars, Icon, Skeleton, StateCard, type ViewCtx } from './common';

const FALLBACK_COLORS = ['#e91e63', '#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#00acc1', '#f4511e', '#6d4c41'];
const GROUP_LABEL: Record<string, string> = {
  morning: S.morning,
  afternoon: S.afternoon,
  evening: S.evening,
  anytime: S.anytime,
};

function Ring({ done, total, color }: { done: number; total: number; color: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const frac = total === 0 ? 0 : done / total;
  return (
    <span className="fwc-ring" role="img" aria-label={S.choresDone(done, total)}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--fwc-border)" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span aria-hidden="true">{done}/{total}</span>
    </span>
  );
}

function MemberCard({ member, family, index, ctx, tappable, onToggle }: {
  member: ChoreMember;
  family: FamilyMember | undefined;
  index: number;
  ctx: ViewCtx;
  tappable: boolean;
  onToggle: (member: ChoreMember, choreId: string, completed: boolean) => void;
}) {
  const color = family?.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  const p = progress(member);
  const groups = groupByTimeOfDay(member.chores);
  const labelled = groups.length > 1;
  return (
    <section className="fwc-ccard" style={chipVars(color, ctx.theme.surface)} aria-label={member.name}>
      <div className="fwc-chead">
        <Avatar name={member.name} color={color} emoji={family?.emoji} surface={ctx.theme.surface} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fwc-cname">{member.name}</div>
          <div className="fwc-csub">{p.total === 0 ? S.noChoresForPerson : S.choresDone(p.done, p.total)}</div>
          {p.points > 0 && (
            <div className="fwc-csub">
              {p.earned}/{p.points} {p.points === 1 ? 'pt' : 'pts'}
            </div>
          )}
        </div>
        {p.total > 0 && <Ring done={p.done} total={p.total} color="var(--ring)" />}
      </div>

      {groups.map((group) => (
        <div key={group.key}>
          {labelled && <h3 className="fwc-group">{GROUP_LABEL[group.key]}</h3>}
          {group.chores.map((chore) => {
            const body = (
              <>
                <span className="fwc-check" aria-hidden="true">
                  {chore.completed && <Icon.Check size="1.2em" />}
                </span>
                <span className="fwc-cn">
                  {chore.emoji ? `${chore.emoji} ` : ''}
                  {chore.name}
                </span>
                {chore.points > 0 && (
                  <span className="fwc-pts" aria-label={S.points(chore.points)}>
                    <Icon.Star size="1em" />
                    {chore.points}
                  </span>
                )}
              </>
            );
            return tappable ? (
              <button
                key={chore.id}
                type="button"
                role="checkbox"
                aria-checked={chore.completed}
                className="fwc-chore"
                onClick={() => onToggle(member, chore.id, !chore.completed)}
                aria-label={chore.completed ? S.markNotDone(chore.name) : S.markDone(chore.name)}
              >
                {body}
              </button>
            ) : (
              <div key={chore.id} role="checkbox" aria-checked={chore.completed} aria-readonly="true" className="fwc-chore">
                {body}
              </div>
            );
          })}
        </div>
      ))}

      {p.complete && (
        <div className="fwc-celebrate" role="status">
          <Icon.Check size="1.2em" />
          {S.allDone}
        </div>
      )}
    </section>
  );
}

/** Today's chores, one card per person, with big tap-to-tick rows. */
export function ChoresView({ ctx, tappable }: { ctx: ViewCtx; tappable: boolean }) {
  // A changing query string makes the host fetch again right after a tick.
  const [rev, setRev] = React.useState(0);
  const [raw, error] = useHostFetch<unknown>(`/api/chores/today?r=${rev}`, 20_000);
  const [familyRaw] = useHostFetch<unknown>('/api/family', 5 * 60_000);

  const fetched = React.useMemo(() => parseChoresToday(raw), [raw]);
  const lastGood = React.useRef<ChoresToday | null>(null);
  if (fetched) lastGood.current = fetched;
  const base = fetched ?? lastGood.current;
  const family = React.useMemo(() => parseFamily(familyRaw), [familyRaw]);

  // Ticks shown instantly, until the host's answer agrees (or a few seconds pass).
  const [over, setOver] = React.useState<Record<string, boolean>>({});
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!fetched) return;
    setOver((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, value] of Object.entries(prev)) {
        const [m, c] = key.split('|');
        const chore = fetched.members.find((x) => x.id === m)?.chores.find((x) => x.id === c);
        if (!chore || chore.completed === value) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fetched]);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const data = React.useMemo(() => {
    if (!base) return null;
    return Object.entries(over).reduce((acc, [key, value]) => {
      const [m, c] = key.split('|');
      return applyToggle(acc, m, c, value);
    }, base);
  }, [base, over]);

  const onToggle = React.useCallback(
    async (member: ChoreMember, choreId: string, completed: boolean) => {
      const key = `${member.id}|${choreId}`;
      setOver((prev) => ({ ...prev, [key]: completed }));
      const ok = await hostPost('/api/chores', {
        choreId,
        memberId: member.id,
        date: data?.date || ctx.today,
        direction: completed ? 'complete' : 'uncomplete',
      });
      if (ok) {
        setRev((n) => n + 1);
        setTimeout(() => setOver((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }), 15_000);
      } else {
        setOver((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setToast(S.saveFailed);
      }
    },
    [data?.date, ctx.today],
  );

  if (!data) {
    return error ? (
      <div className="fwc-body">
        <StateCard icon={<Icon.Clipboard size="1.6em" />} title={S.chores} body={S.choresFailed} />
      </div>
    ) : (
      <Skeleton />
    );
  }

  const anyChores = data.members.some((m) => m.chores.length > 0) || data.bonus.length > 0;
  if (!anyChores) {
    return (
      <div className="fwc-body">
        <StateCard icon={<Icon.Clipboard size="1.6em" />} title={S.choresEmptyTitle} body={S.choresEmptyBody} />
      </div>
    );
  }

  return (
    <div className="fwc-body fwc-scroll">
      <div className="fwc-chores">
        {data.members.map((member, i) => (
          <MemberCard
            key={member.id}
            member={member}
            family={family.find((f) => f.id === member.id)}
            index={i}
            ctx={ctx}
            tappable={tappable}
            onToggle={onToggle}
          />
        ))}
        {data.bonus.length > 0 && (
          <section className="fwc-ccard fwc-bonus" aria-label={S.bonus}>
            <h3 className="fwc-group" style={{ marginTop: 0 }}>{S.bonus}</h3>
            <ul className="fwc-list">
              {data.bonus.map((b) => (
                <li key={b.id} className="fwc-chore">
                  <span className="fwc-cn">{b.name}</span>
                  <span className="fwc-pts">
                    {b.state === 'open' ? `${S.bonusOpen} · ` : ''}
                    <Icon.Star size="1em" />
                    {b.points}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {toast && <div className="fwc-toast" role="alert">{toast}</div>}
    </div>
  );
}
