import { Store } from "@ga-ut/store";
import { LoginPage } from "@/pages/auth/login-page";
import { RegisterPage } from "@/pages/auth/register-page";

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
