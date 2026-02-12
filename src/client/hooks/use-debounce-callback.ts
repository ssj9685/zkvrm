import { useCallback, useEffect, useRef } from "react";

type DebouncedCallback<T extends (...args: any[]) => any> = ((
	...args: Parameters<T>
) => void) & {
	cancel: () => void;
};

export function useDebounceCallback<T extends (...args: any[]) => any>(
	callback: T,
	delay: number,
): DebouncedCallback<T> {
	const callbackRef = useRef(callback);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(
		() => () => {
			if (!timeoutRef.current) {
				return;
			}

			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		},
		[],
	);

	const cancel = useCallback(() => {
		if (!timeoutRef.current) {
			return;
		}

		clearTimeout(timeoutRef.current);
		timeoutRef.current = null;
	}, []);

	const debouncedCallback = useCallback(
		(...args: Parameters<T>) => {
			cancel();

			timeoutRef.current = setTimeout(() => {
				callbackRef.current(...args);
				timeoutRef.current = null;
			}, delay);
		},
		[cancel, delay],
	);

	return Object.assign(debouncedCallback, { cancel });
}
