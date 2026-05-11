import {
	WINDOW_MS,
	MILESTONES,
	nextCombo,
	isMilestone,
	decayProgress,
} from '../../../../../plugins/power-mode/src/lib/combo';

describe('Power Mode combo math', () => {
	describe('nextCombo', () => {
		it('starts at 1 when there is no prior combo', () => {
			expect(nextCombo(0, 0, 1000)).toBe(1);
		});

		it('increments while keystrokes arrive inside the window', () => {
			const t = 1000;
			expect(nextCombo(5, t, t + WINDOW_MS - 1)).toBe(6);
		});

		it('resets to 1 once the typing window has lapsed', () => {
			const t = 1000;
			expect(nextCombo(42, t, t + WINDOW_MS + 1)).toBe(1);
		});

		it('treats an exact-window keystroke as still inside (>, not >=)', () => {
			const t = 1000;
			expect(nextCombo(3, t, t + WINDOW_MS)).toBe(4);
		});
	});

	describe('isMilestone', () => {
		it('matches each documented milestone exactly', () => {
			MILESTONES.forEach((m) => expect(isMilestone(m)).toBe(true));
		});

		it('returns false for off-by-one values', () => {
			MILESTONES.forEach((m) => {
				expect(isMilestone(m - 1)).toBe(false);
				expect(isMilestone(m + 1)).toBe(false);
			});
		});
	});

	describe('decayProgress', () => {
		it('returns 1 when there is no last keystroke yet', () => {
			expect(decayProgress(1000, null)).toBe(1);
		});

		it('returns 0 immediately after a keystroke', () => {
			expect(decayProgress(1000, 1000)).toBe(0);
		});

		it('returns 1 once the full window has elapsed', () => {
			expect(decayProgress(1000 + WINDOW_MS, 1000)).toBe(1);
			expect(decayProgress(1000 + WINDOW_MS * 2, 1000)).toBe(1);
		});

		it('reports a linear half-elapsed ratio', () => {
			expect(decayProgress(1000 + WINDOW_MS / 2, 1000)).toBeCloseTo(
				0.5,
				5
			);
		});
	});
});
