/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ModalSpace } from "./components/modal/modal-overlay";
import { Router } from "./components/router/router";
import { ToastSpace } from "./components/toast/toast-overlay";

const elem = document.getElementById("root");
if (!elem) throw new Error("Root element not found");
const app = (
	<StrictMode>
		<Router />
		<ToastSpace />
		<ModalSpace />
	</StrictMode>
);

if (import.meta.hot) {
	// With hot module reloading, `import.meta.hot.data` is persisted.
	let root = import.meta.hot.data.root;
	if (!root) {
		root = createRoot(elem);
		import.meta.hot.data.root = root;
	}
	root.render(app);
} else {
	// The hot module reloading API is not available in production.
	createRoot(elem).render(app);
}

if (!import.meta.hot && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("/service-worker.js", { type: "module" })
			.catch((error) => {
				console.error("Service worker registration failed", error);
			});
	});
} else if (import.meta.hot && "serviceWorker" in navigator) {
	// Avoid stale service workers during local development with HMR.
	navigator.serviceWorker.getRegistrations().then((registrations) => {
		for (const registration of registrations) {
			registration.unregister().catch(() => {});
		}
	});
}
