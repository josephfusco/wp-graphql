import { useEffect, useRef, useState } from 'react';
import { isMilestone, nextCombo, WINDOW_MS } from '../lib/combo';
import { EVENT_TOGGLE, isEnabled } from '../lib/storage';
import { fetchStats, submitSession } from '../lib/api';
import { ParticleCanvas } from './ParticleCanvas';
import { ComboCounter } from './ComboCounter';
import './styles.css';

// Submit a session at most every N ms while typing, plus on disable
// and on tab-hide so a long session always lands eventually.
const SUBMIT_INTERVAL_MS = 30_000;

// Keys that shouldn't count as "typing" for combo purposes. Without
// this filter, arrow-key cursor moves and modifier holds would inflate
// the counter and dilute the milestone moments.
const NON_TYPING_KEYS = new Set([
	'Shift',
	'Control',
	'Alt',
	'Meta',
	'CapsLock',
	'Tab',
	'Escape',
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'Home',
	'End',
	'PageUp',
	'PageDown',
	'Insert',
]);

function isInsideEditor(target) {
	if (!target || typeof target.closest !== 'function') {
		return false;
	}
	if (target.closest('.cm-editor')) {
		return true;
	}
	const tag = target.tagName;
	return tag === 'TEXTAREA' || tag === 'INPUT';
}

// Caret position is read from the live selection range. Works for
// CM6's contenteditable surface AND ordinary `<textarea>`/`<input>`
// elements where the selection API still returns a rect.
function caretPoint(target) {
	const doc = target?.ownerDocument || document;
	const view = doc.defaultView || window;
	const sel = view.getSelection?.();
	if (sel && sel.rangeCount > 0) {
		const range = sel.getRangeAt(0).cloneRange();
		range.collapse(true);
		const rect = range.getClientRects()[0] || range.getBoundingClientRect();
		if (rect && rect.left + rect.top > 0) {
			return { x: rect.left, y: rect.top + rect.height / 2 };
		}
	}
	const el = doc.activeElement;
	if (el && el.getBoundingClientRect) {
		const r = el.getBoundingClientRect();
		return { x: r.left + 20, y: r.top + r.height / 2 };
	}
	return { x: view.innerWidth / 2, y: view.innerHeight / 2 };
}

export function PowerMode() {
	const [enabled, setEnabledState] = useState(() => isEnabled());
	const [combo, setCombo] = useState(0);
	const [lastAt, setLastAt] = useState(null);
	const [bestCombo, setBestCombo] = useState(0);
	const [beat, setBeat] = useState(false);

	// Mutable accumulators for the API submission. Refs so the keydown
	// handler can update them without triggering re-renders per keystroke.
	const sessionComboRef = useRef(0);
	const sessionKeystrokesRef = useRef(0);
	const lastSubmitAtRef = useRef(0);
	const canvasRef = useRef(null);

	// Listen for the topbar toggle event (fired from power-mode.js).
	useEffect(() => {
		function onToggle(event) {
			setEnabledState(!!event.detail?.enabled);
		}
		window.addEventListener(EVENT_TOGGLE, onToggle);
		return () => window.removeEventListener(EVENT_TOGGLE, onToggle);
	}, []);

	// Hydrate the personal best when Power Mode flips on. The fetch is
	// fire-and-forget — a network error just leaves the HUD without a
	// "best" line, which is the same fallback as a fresh user.
	useEffect(() => {
		if (!enabled) {
			return;
		}
		let cancelled = false;
		fetchStats()
			.then((stats) => {
				if (cancelled || !stats) {
					return;
				}
				setBestCombo(stats.maxCombo || 0);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [enabled]);

	// Submit accumulated session stats and reset the session counters.
	const flushSession = useRef(null);
	flushSession.current = async () => {
		const c = sessionComboRef.current;
		const k = sessionKeystrokesRef.current;
		if (k === 0) {
			return;
		}
		sessionComboRef.current = 0;
		sessionKeystrokesRef.current = 0;
		lastSubmitAtRef.current = Date.now();
		try {
			const result = await submitSession({ combo: c, keystrokes: k });
			if (
				result?.stats?.maxCombo !== null &&
				result?.stats?.maxCombo !== undefined
			) {
				setBestCombo(result.stats.maxCombo);
			}
		} catch {
			// Swallow — Power Mode is a gimmick; failed submission
			// shouldn't pollute the editor's notice surface.
		}
	};

	useEffect(() => {
		if (!enabled) {
			return undefined;
		}

		function onKeyDown(event) {
			if (NON_TYPING_KEYS.has(event.key)) {
				return;
			}
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			if (!isInsideEditor(event.target)) {
				return;
			}

			const now = Date.now();
			setCombo((prev) => {
				const next = nextCombo(prev, lastAt || 0, now);
				sessionComboRef.current = Math.max(
					sessionComboRef.current,
					next
				);
				if (isMilestone(next)) {
					document.documentElement.classList.add(
						'wpgraphql-ide-power-mode-shake'
					);
					window.setTimeout(() => {
						document.documentElement.classList.remove(
							'wpgraphql-ide-power-mode-shake'
						);
					}, 400);
					setBeat(true);
					window.setTimeout(() => setBeat(false), 600);
				}
				return next;
			});
			setLastAt(now);
			sessionKeystrokesRef.current += 1;

			const point = caretPoint(event.target);
			canvasRef.current?.burst(
				point.x,
				point.y,
				Math.min(1 + sessionComboRef.current / 50, 3)
			);

			if (
				now - lastSubmitAtRef.current >= SUBMIT_INTERVAL_MS &&
				lastSubmitAtRef.current > 0
			) {
				flushSession.current();
			} else if (lastSubmitAtRef.current === 0) {
				lastSubmitAtRef.current = now;
			}
		}

		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
		// `lastAt` is read inside the handler; including it would
		// re-bind on every keystroke. We accept the staleness — the
		// combo math reads the latest value via the setState callback.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled]);

	// Decay the combo back to 0 when the typing window lapses. Polled
	// (vs. setTimeout-per-keystroke) so a long pause doesn't accumulate
	// a stack of pending resets.
	useEffect(() => {
		if (!combo || !lastAt) {
			return undefined;
		}
		const id = window.setInterval(() => {
			if (Date.now() - lastAt > WINDOW_MS) {
				setCombo(0);
			}
		}, 250);
		return () => window.clearInterval(id);
	}, [combo, lastAt]);

	// On disable, on tab-hide, and on unmount — flush.
	useEffect(() => {
		if (!enabled) {
			return undefined;
		}
		function onHide() {
			if (document.visibilityState === 'hidden') {
				flushSession.current?.();
			}
		}
		document.addEventListener('visibilitychange', onHide);
		return () => {
			document.removeEventListener('visibilitychange', onHide);
			flushSession.current?.();
		};
	}, [enabled]);

	if (!enabled) {
		return null;
	}

	return (
		<>
			<ParticleCanvas ref={canvasRef} />
			<ComboCounter
				combo={combo}
				lastAt={lastAt}
				bestCombo={bestCombo}
				beat={beat}
			/>
		</>
	);
}
