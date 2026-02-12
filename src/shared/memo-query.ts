export function normalizeMemoQuery(query?: string | null): string | undefined {
	if (query == null) {
		return undefined;
	}

	const trimmed = query.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
