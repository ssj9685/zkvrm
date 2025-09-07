/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { createRoot } from "react-dom/client";
import { Router } from "./components/router/router";

const elem = document.getElementById("root");
if (!elem) throw new Error("Root element not found");
const app = <Router />;

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
