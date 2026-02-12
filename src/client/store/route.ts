import { Store } from "@ga-ut/store-core";

type Route = "/" | "/memo" | "/sign-in" | "/sign-up" | "/icon-preview";

export const routeStore = new Store({
	current: window.location.pathname as Route,
	goto(route: Route) {
		this.current = route;
		window.history.pushState(null, "", route);
	},
	setFromLocation(route: Route) {
		this.current = route;
	},
});

// Ensure browser back/forward buttons update the router state
window.addEventListener("popstate", () => {
	routeStore.getState().setFromLocation(window.location.pathname as Route);
});
