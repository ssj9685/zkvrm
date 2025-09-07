import { Icon } from "@client/components/icons/icon";
import { LoginPage } from "@client/pages/auth/login-page";
import { RegisterPage } from "@client/pages/auth/register-page";
import { IconPreviewPage } from "@client/pages/icon-preview/icon-preview-page";
import { Page } from "@client/pages/index";
import { MemoPage } from "@client/pages/memo";
import { authStore } from "@client/store/auth";
import { routeStore } from "@client/store/route";
import { useStore } from "@ga-ut/store-react";
import { useEffect } from "react";

export function Router() {
	const router = useStore(routeStore);
	const auth = useStore(authStore);

	useEffect(() => {
		authStore.getState().checkAuth();
	}, []);

	useEffect(() => {
		if (!auth.isLoading && router.current === "/memo" && !auth.isLoggedIn) {
			router.goto("/sign-in");
		}
	}, [auth.isLoading, auth.isLoggedIn, router.current, router.goto]);

	if (auth.isLoading) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center text-gray-500">
				<Icon
					className="w-8 h-8 animate-spin text-gray-600"
					name="spinner"
					title="Loading"
				/>
			</div>
		);
	}

	switch (router.current) {
		case "/memo":
			return <MemoPage />;
		case "/sign-in":
			return <LoginPage />;
		case "/sign-up":
			return <RegisterPage />;
		case "/icon-preview":
			return <IconPreviewPage />;
		default:
			return <Page />;
	}
}
