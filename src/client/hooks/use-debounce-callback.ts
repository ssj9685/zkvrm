import { useCallback, useEffect, useMemo, useRef } from "react";

export function useDebounceCallback<T extends (...args: any[]) => any>(
	callback: T,
	delay: number,
): {
	(...args: Parameters<T>): void;
	cancel: () => void;
} {
	const callbackRef = useRef(callback);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	const cancel = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	useEffect(
		() => () => {
			cancel();
		},
		[cancel],
	);

	const debouncedCallback = useCallback(
		(...args: Parameters<T>) => {
			cancel();

			timeoutRef.current = setTimeout(() => {
				timeoutRef.current = null;
				callbackRef.current(...args);
			}, delay);
		},
		[cancel, delay],
	);

	return useMemo(
		() => Object.assign(debouncedCallback, { cancel }),
		[cancel, debouncedCallback],
	);
}
