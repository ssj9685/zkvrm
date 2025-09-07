"use client";

import { Store } from "@ga-ut/store-core";
import { useStore } from "@ga-ut/store-react";
import type React from "react";

interface OverlayElement {
	element: (params: {
		isOpen: boolean;
		close: (value?: unknown) => void;
		unmount: () => void;
	}) => React.ReactNode;
	overlap?: boolean;
	isOpen: boolean;
	resolve?: (data: unknown) => void;
}

export function createOverlayStore() {
	const store = new Store({
		elements: [] as OverlayElement[],

		open(options: Omit<OverlayElement, "resolve" | "isOpen">) {
			return new Promise((resolve) => {
				const element: OverlayElement = {
					...options,
					isOpen: true,
					resolve,
				};
				this.elements = options.overlap
					? [element, ...this.elements]
					: [...this.elements, element];
			});
		},

		close(value: unknown) {
			const el = this.elements[0];

			if (el?.isOpen) {
				el.isOpen = false;
				el.resolve?.(value);
				this.elements = [...this.elements];
			}
		},

		unmount() {
			if (this.elements.length > 0) {
				this.elements.shift();
				this.elements = [...this.elements];
			}
		},

		clear() {
			this.elements = [];
		},
	});

	return store;
}

export function OverlaySpace({
	store,
}: {
	store: ReturnType<typeof createOverlayStore>;
}) {
	const { elements, close, unmount } = useStore(store);
	const el = elements[0];

	if (!el) {
		return null;
	}

	return el.element({ isOpen: el.isOpen, close, unmount });
}
