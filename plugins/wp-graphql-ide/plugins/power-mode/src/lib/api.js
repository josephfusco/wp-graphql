// Talks to the same `/graphql` endpoint the IDE itself queries. The
// point of Power Mode is to exercise that surface: every session
// submits a `recordIdePowerCombo` mutation, and the HUD's "best:" line
// is hydrated from a `viewer.idePowerStats` query on mount.

const READ_QUERY = `
	query IdePowerModeStats {
		viewer {
			idePowerStats {
				maxCombo
				totalKeystrokes
				lastSessionAt
			}
		}
	}
`;

const WRITE_MUTATION = `
	mutation IdePowerModeRecord($combo: Int!, $keystrokes: Int!) {
		recordIdePowerCombo(input: { combo: $combo, keystrokes: $keystrokes }) {
			beatPrevious
			stats {
				maxCombo
				totalKeystrokes
				lastSessionAt
			}
		}
	}
`;

function endpoint() {
	return window.WPGRAPHQL_IDE_DATA?.graphqlEndpoint || '/graphql';
}

function nonce() {
	return window.WPGRAPHQL_IDE_DATA?.nonce || '';
}

async function post(query, variables) {
	const headers = { 'Content-Type': 'application/json' };
	const n = nonce();
	if (n) {
		headers['X-WP-Nonce'] = n;
	}
	const res = await fetch(endpoint(), {
		method: 'POST',
		credentials: 'same-origin',
		headers,
		body: JSON.stringify({ query, variables }),
	});
	if (!res.ok) {
		throw new Error(`Power Mode API ${res.status}`);
	}
	const body = await res.json();
	if (body.errors?.length) {
		throw new Error(body.errors[0].message);
	}
	return body.data;
}

export async function fetchStats() {
	const data = await post(READ_QUERY, {});
	return data?.viewer?.idePowerStats ?? null;
}

export async function submitSession({ combo, keystrokes }) {
	const data = await post(WRITE_MUTATION, {
		combo: Math.max(0, Math.floor(combo)),
		keystrokes: Math.max(0, Math.floor(keystrokes)),
	});
	return data?.recordIdePowerCombo ?? null;
}
