import { LoginPage } from "@client/pages/auth/login-page";
import { RegisterPage } from "@client/pages/auth/register-page";
import { Store } from "@ga-ut/store";

const routes = {
	"/sign-in": LoginPage,
	"/sign-up": RegisterPage,
} as const;

type Route = keyof typeof routes;

export const routeStore = new Store({
	current: "" as Route,
	routes,
	goto(route: Route) {
		this.current = route;
	},
});
