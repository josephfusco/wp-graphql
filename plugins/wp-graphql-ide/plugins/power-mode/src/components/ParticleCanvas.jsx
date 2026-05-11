import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

const MAX_PARTICLES = 600;
const PARTICLES_PER_BURST = 12;
const GRAVITY = 240; // px / s²
const FRICTION = 0.92;

// Hue palette — mirrors the IDE's syntax tokens loosely so the
// confetti reads as "GraphQL-shaped" rather than generic rainbow.
const COLORS = [
	'#3858e9', // admin blue
	'#1eaf6f', // operation-name green
	'#d63638', // error red
	'#f0b849', // string yellow
	'#9a55ff', // enum purple
];

function randomColor() {
	return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export const ParticleCanvas = forwardRef(function ParticleCanvas(_, ref) {
	const canvasRef = useRef(null);
	const particlesRef = useRef([]);
	const rafRef = useRef(null);
	const lastTickRef = useRef(0);

	useImperativeHandle(ref, () => ({
		burst(x, y, intensity = 1) {
			const count = Math.min(
				MAX_PARTICLES - particlesRef.current.length,
				Math.round(PARTICLES_PER_BURST * intensity)
			);
			for (let i = 0; i < count; i++) {
				const angle = Math.random() * Math.PI * 2;
				const speed = 80 + Math.random() * 220 * intensity;
				particlesRef.current.push({
					x,
					y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed - 80 * intensity,
					life: 0.6 + Math.random() * 0.5,
					age: 0,
					size: 2 + Math.random() * 3,
					color: randomColor(),
				});
			}
		},
		clear() {
			particlesRef.current = [];
		},
	}));

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return undefined;
		}
		const ctx = canvas.getContext('2d');

		function resize() {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = window.innerWidth * dpr;
			canvas.height = window.innerHeight * dpr;
			canvas.style.width = `${window.innerWidth}px`;
			canvas.style.height = `${window.innerHeight}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		resize();
		window.addEventListener('resize', resize);

		function tick(now) {
			const dt = lastTickRef.current
				? Math.min((now - lastTickRef.current) / 1000, 0.05)
				: 0;
			lastTickRef.current = now;
			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
			const next = [];
			for (const p of particlesRef.current) {
				p.age += dt;
				if (p.age >= p.life) {
					continue;
				}
				p.vy += GRAVITY * dt;
				p.vx *= FRICTION ** (dt * 60);
				p.vy *= FRICTION ** (dt * 60);
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				const alpha = 1 - p.age / p.life;
				ctx.globalAlpha = alpha;
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
				next.push(p);
			}
			ctx.globalAlpha = 1;
			particlesRef.current = next;
			rafRef.current = window.requestAnimationFrame(tick);
		}
		rafRef.current = window.requestAnimationFrame(tick);

		return () => {
			window.removeEventListener('resize', resize);
			if (rafRef.current) {
				window.cancelAnimationFrame(rafRef.current);
			}
			lastTickRef.current = 0;
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="wpgraphql-ide-power-mode-canvas"
			aria-hidden="true"
		/>
	);
});
