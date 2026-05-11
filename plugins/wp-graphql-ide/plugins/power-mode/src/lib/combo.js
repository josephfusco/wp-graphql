// Combo counter — increments per keystroke as long as keystrokes
// arrive within `WINDOW_MS` of each other. When the window lapses,
// the combo resets on the next keystroke. Milestones are the combo
// values at which the screen-shake / colour boost fires.

export const WINDOW_MS = 4000;
export const MILESTONES = [10, 25, 50, 100, 200, 500];

export function nextCombo(prev, prevAt, now) {
	if (now - prevAt > WINDOW_MS) {
		return 1;
	}
	return prev + 1;
}

export function isMilestone(combo) {
	return MILESTONES.includes(combo);
}

// Decay progress: 0 (fresh) → 1 (about to drop). Used by the HUD ring.
export function decayProgress(now, lastAt) {
	if (!lastAt) {
		return 1;
	}
	const elapsed = now - lastAt;
	if (elapsed <= 0) {
		return 0;
	}
	if (elapsed >= WINDOW_MS) {
		return 1;
	}
	return elapsed / WINDOW_MS;
}
