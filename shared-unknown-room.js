// Unknown-room ("未知") resolution shared by both demos. Adapted from the idea of
// Slay the Spire's "?" rooms: a hidden room is usually an event, sometimes a
// fight, shop or treasure, and every type that failed to appear becomes a bit
// more likely next time. The probabilities below are this game's own tuning,
// not the original game's numbers.
export const UNKNOWN_BASE = { battle: 0.15, shop: 0.05, crate: 0.05 };
export const UNKNOWN_RISE = { battle: 0.05, shop: 0.03, crate: 0.02 };
export const UNKNOWN_KINDS = ['battle', 'shop', 'crate'];

export function freshUnknownOdds(act) {
  return { act, ...UNKNOWN_BASE };
}

// `roll` is one uniform [0,1) draw from the run RNG. `blocked` lists kinds that
// may not appear here (e.g. a shop right next to the fixed shop row); a roll
// that lands on a blocked kind becomes an event. Returns the room kind and the
// next odds: the kind that appeared resets to base, every other non-event kind
// rises. The leftover probability is always an event.
export function resolveUnknown(odds, roll, blocked = []) {
  let ticket = roll, kind = 'event';
  for (const k of UNKNOWN_KINDS) {
    if (ticket < odds[k]) { kind = k; break; }
    ticket -= odds[k];
  }
  if (blocked.includes(kind)) kind = 'event';
  const next = { ...odds };
  for (const k of UNKNOWN_KINDS) next[k] = k === kind ? UNKNOWN_BASE[k] : Math.min(0.5, +(odds[k] + UNKNOWN_RISE[k]).toFixed(4));
  return { kind, odds: next };
}

// Kinds that should not come out of an unknown room at this step, so the
// fixed shop / crate rows are not doubled back-to-back.
export function blockedUnknownKinds(step, shopStep, crateStep) {
  const blocked = [];
  if (Math.abs(step - shopStep) <= 1) blocked.push('shop');
  if (Math.abs(step - crateStep) <= 1) blocked.push('crate');
  return blocked;
}

// Crate sizes: small / medium / large, larger ones are rarer and better.
export const CRATE_SIZES = {
  small: { name: '小型补给箱', weight: 50 },
  medium: { name: '中型补给箱', weight: 33 },
  large: { name: '大型补给箱', weight: 17 }
};
export function rollCrateSize(roll) {
  let ticket = roll * 100;
  for (const [size, def] of Object.entries(CRATE_SIZES)) { if (ticket < def.weight) return size; ticket -= def.weight; }
  return 'small';
}
