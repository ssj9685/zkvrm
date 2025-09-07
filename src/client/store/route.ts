import { Store } from "@ga-ut/store-core";

type Route = "/" | "/memo" | "/sign-in" | "/sign-up" | "/icon-preview";

export const routeStore = new Store({
	current: window.location.pathname as Route,
	goto(route: Route) {
		this.current = route;
		window.history.pushState(null, "", route);
	},
});
