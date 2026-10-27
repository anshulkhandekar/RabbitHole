import { Preferences, type Prefs } from "../../../packages/contracts/src/index";
export type PracticePreferences = {
  roundSize?: 5 | 8 | 12;
  confidence?: boolean;
  harderOffers?: boolean;
};
export type GoCompletion = "notify" | "open" | "quiet";
export const practiceDefaults = {
  roundSize: 8,
  confidence: true,
  harderOffers: true,
} as const;
export function practicePreferences(value: PracticePreferences = {}) {
  return {
    roundSize: ([5, 8, 12].includes(value.roundSize ?? 8)
      ? (value.roundSize ?? 8)
      : 8) as 5 | 8 | 12,
    confidence: value.confidence ?? true,
    harderOffers: value.harderOffers ?? true,
  };
}
export const sessionDefaults = (value?: Partial<Prefs>) =>
  Preferences.parse(value ?? {});
export function sectionAt(
  positions: { id: string; top: number }[],
  scrollTop: number,
) {
  return (
    [...positions].reverse().find((s) => s.top <= scrollTop + 32)?.id ??
    positions[0]?.id ??
    "Appearance"
  );
}
