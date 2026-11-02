// The host serves today's chores already resolved per person (rotation and
// frequency rules applied), so this file only reads that answer defensively,
// groups it for display, and applies a tick optimistically.
//
//   GET  /api/chores/today   -> { date, members: [{ id, name, chores: [...] }], bonus?: [...] }
//   GET  /api/family         -> { members: [{ id, name, color, emoji? }], groups? }
//   POST /api/chores         -> { choreId, memberId, date, direction }

export interface ChoreRow {
  id: string;
  name: string;
  points: number;
  timeOfDay: string;
  completed: boolean;
  emoji?: string;
}

export interface ChoreMember {
  id: string;
  name: string;
  chores: ChoreRow[];
}

export interface BonusChore {
  id: string;
  name: string;
  points: number;
  kind: string;
  /** Who finished it, when the host says so. */
  doneBy: string[];
  state: string;
}

export interface ChoresToday {
  date: string;
  members: ChoreMember[];
  bonus: BonusChore[];
}

export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  emoji?: string;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function parseChoresToday(json: unknown): ChoresToday | null {
  const root = rec(json);
  if (!root || !Array.isArray(root.members)) return null;
  const members: ChoreMember[] = [];
  for (const m of root.members) {
    const member = rec(m);
    if (!member || typeof member.id !== 'string') continue;
    const chores: ChoreRow[] = [];
    for (const c of Array.isArray(member.chores) ? member.chores : []) {
      const chore = rec(c);
      if (!chore || typeof chore.id !== 'string') continue;
      chores.push({
        id: chore.id,
        name: str(chore.name, 'Chore'),
        points: num(chore.points),
        timeOfDay: str(chore.timeOfDay, 'anytime'),
        completed: chore.completed === true,
        emoji: typeof chore.emoji === 'string' && chore.emoji ? chore.emoji : undefined,
      });
    }
    members.push({ id: member.id, name: str(member.name, 'Someone'), chores });
  }
  const bonus: BonusChore[] = [];
  for (const b of Array.isArray(root.bonus) ? root.bonus : []) {
    const item = rec(b);
    if (!item || typeof item.id !== 'string') continue;
    const state = rec(item.state);
    bonus.push({
      id: item.id,
      name: str(item.name, 'Bonus chore'),
      points: num(item.points),
      kind: str(item.kind),
      doneBy: Array.isArray(item.doneBy) ? item.doneBy.filter((x): x is string => typeof x === 'string') : [],
      state: state ? str(state.status) : '',
    });
  }
  return { date: str(root.date), members, bonus };
}

export function parseFamily(json: unknown): FamilyMember[] {
  const root = rec(json);
  const list = Array.isArray(json) ? json : root && Array.isArray(root.members) ? root.members : [];
  const out: FamilyMember[] = [];
  for (const m of list) {
    const member = rec(m);
    if (!member || typeof member.id !== 'string') continue;
    out.push({
      id: member.id,
      name: str(member.name, 'Someone'),
      color: str(member.color, '#2f6fed'),
      emoji: typeof member.emoji === 'string' && member.emoji ? member.emoji : undefined,
    });
  }
  return out;
}

export interface Progress {
  done: number;
  total: number;
  points: number;
  earned: number;
  complete: boolean;
}

export function progress(member: ChoreMember): Progress {
  const total = member.chores.length;
  const done = member.chores.filter((c) => c.completed).length;
  const points = member.chores.reduce((sum, c) => sum + c.points, 0);
  const earned = member.chores.reduce((sum, c) => sum + (c.completed ? c.points : 0), 0);
  return { done, total, points, earned, complete: total > 0 && done === total };
}

const ORDER = ['morning', 'afternoon', 'evening', 'anytime'];

export interface ChoreGroup {
  key: string;
  chores: ChoreRow[];
}

/** Morning, afternoon, evening, then anytime. Unknown labels sort last. */
export function groupByTimeOfDay(chores: readonly ChoreRow[]): ChoreGroup[] {
  const groups = new Map<string, ChoreRow[]>();
  for (const c of chores) {
    const key = ORDER.includes(c.timeOfDay) ? c.timeOfDay : 'anytime';
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return ORDER.filter((k) => groups.has(k)).map((key) => ({ key, chores: groups.get(key)! }));
}

/** The answer as it will be once a tick lands, so the tap feels instant. */
export function applyToggle(data: ChoresToday, memberId: string, choreId: string, completed: boolean): ChoresToday {
  return {
    ...data,
    members: data.members.map((m) =>
      m.id !== memberId
        ? m
        : { ...m, chores: m.chores.map((c) => (c.id === choreId ? { ...c, completed } : c)) },
    ),
  };
}
