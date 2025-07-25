import { useCallback, useEffect, useRef } from "react";

export function useDebounceCallback<T extends (...args: any[]) => any>(
	callback: T,
	delay: number,
): (...args: Parameters<T>) => void {
	const callbackRef = useRef(callback);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(
		() => () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		},
		[],
	);

	const debouncedCallback = useCallback(
		(...args: Parameters<T>) => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				callbackRef.current(...args);
			}, delay);
		},
		[delay],
	);

	return debouncedCallback;
}
