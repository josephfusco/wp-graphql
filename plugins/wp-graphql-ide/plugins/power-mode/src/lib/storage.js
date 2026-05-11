const LS_KEY = 'wpgraphql-ide-power-mode-enabled';

export const EVENT_TOGGLE = 'wpgraphql-ide-power-mode-toggle';

export function isEnabled() {
	try {
		return window.localStorage.getItem(LS_KEY) === '1';
	} catch {
		return false;
	}
}

export function setEnabled(value) {
	try {
		if (value) {
			window.localStorage.setItem(LS_KEY, '1');
		} else {
			window.localStorage.removeItem(LS_KEY);
		}
	} catch {
		// Ignore — quota / disabled storage. Power Mode is non-essential.
	}
}
