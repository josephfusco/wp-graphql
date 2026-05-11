import { useEffect, useState } from 'react';
import { decayProgress, WINDOW_MS } from '../lib/combo';

// Re-render the HUD ~10×/s while the combo is alive so the decay ring
// drains smoothly. When the combo is zero the interval is idle (no
// re-renders) since there's nothing to animate.
export function ComboCounter({ combo, lastAt, bestCombo, beat }) {
	const [, force] = useState(0);

	useEffect(() => {
		if (!combo || !lastAt) {
			return undefined;
		}
		const id = window.setInterval(() => force((n) => n + 1), 100);
		return () => window.clearInterval(id);
	}, [combo, lastAt]);

	if (!combo) {
		return null;
	}

	const drain = decayProgress(Date.now(), lastAt);
	// SVG ring uses a stroke-dashoffset trick: full circumference at
	// drain=0, zero at drain=1.
	const circ = 2 * Math.PI * 28;
	const dash = circ * (1 - drain);

	return (
		<div
			className={`wpgraphql-ide-power-mode-hud${beat ? ' just-beat' : ''}`}
			aria-live="polite"
		>
			<svg
				className="wpgraphql-ide-power-mode-ring"
				viewBox="0 0 64 64"
				aria-hidden="true"
			>
				<circle
					cx="32"
					cy="32"
					r="28"
					className="wpgraphql-ide-power-mode-ring-track"
				/>
				<circle
					cx="32"
					cy="32"
					r="28"
					className="wpgraphql-ide-power-mode-ring-fill"
					style={{ strokeDasharray: circ, strokeDashoffset: dash }}
				/>
			</svg>
			<div className="wpgraphql-ide-power-mode-hud-text">
				<div className="wpgraphql-ide-power-mode-combo">{combo}</div>
				<div className="wpgraphql-ide-power-mode-label">combo</div>
			</div>
			{bestCombo > 0 && (
				<div className="wpgraphql-ide-power-mode-best">
					best <strong>{bestCombo}</strong>
				</div>
			)}
		</div>
	);
}

// Exported so tests can hit the same constant the HUD uses for ring math.
export const RING_WINDOW_MS = WINDOW_MS;
