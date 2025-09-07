import "@client/index.css";
import { authStore } from "@client/store/auth";
import { routeStore } from "@client/store/route";
import { useStore } from "@ga-ut/store-react";
import { useEffect } from "react";

export function Page() {
	const { isLoggedIn } = useStore(authStore);
	const router = useStore(routeStore);

	useEffect(() => {
		if (isLoggedIn) {
			router.goto("/memo");
		} else {
			router.goto("/sign-in");
		}
	}, [isLoggedIn, router.goto]);

	return null;
}

export default Page;
