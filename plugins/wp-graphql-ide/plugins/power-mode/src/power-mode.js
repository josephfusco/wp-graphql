import { createRoot } from '@wordpress/element';
import { Icon } from '@wordpress/icons';
import { lightning } from './lib/icons';
import { PowerMode } from './components/PowerMode';
import { isEnabled, setEnabled, EVENT_TOGGLE } from './lib/storage';

const TOPBAR_ICON = () => <Icon icon={lightning} />;
const PORTAL_ID = 'wpgraphql-ide-power-mode-root';

function mountOverlay() {
	if (document.getElementById(PORTAL_ID)) {
		return;
	}
	const root = document.createElement('div');
	root.id = PORTAL_ID;
	document.body.appendChild(root);
	createRoot(root).render(<PowerMode />);
}

window.addEventListener('WPGraphQLIDE_Window_Ready', () => {
	if (!window.WPGraphQLIDE) {
		return;
	}

	mountOverlay();

	const { registerTopbarAction } = window.WPGraphQLIDE;
	if (typeof registerTopbarAction !== 'function') {
		return;
	}

	registerTopbarAction(
		'power-mode-toggle',
		{
			title: 'Power Mode',
			icon: TOPBAR_ICON,
			onClick: () => {
				const next = !isEnabled();
				setEnabled(next);
				window.dispatchEvent(
					new CustomEvent(EVENT_TOGGLE, { detail: { enabled: next } })
				);
			},
			className: () => (isEnabled() ? 'is-power-mode-active' : ''),
		},
		// Sits near the right edge but before the close button. Lower
		// priority numbers render first, so 90 keeps it just after the
		// schema-refetch + settings actions registered by the core IDE.
		90
	);
});
