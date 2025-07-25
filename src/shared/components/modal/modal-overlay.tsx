"use client";

import { createOverlayStore, OverlaySpace } from "@/shared/utils/overlay";

const store = createOverlayStore();
export const modal = {
	open,
};

export function ModalSpace() {
	return <OverlaySpace store={store} />;
}
