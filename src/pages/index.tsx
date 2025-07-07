import { useEffect } from "react";
import { useStore } from "@ga-ut/store";
import { authStore } from "@/domains/auth";
import "../assets/index.css";
import { MemoPage } from "./memo";
import { AuthPage } from "./auth";

export function Index() {
	const { isLoggedIn, checkAuth } = useStore(authStore);

	useEffect(() => {
		checkAuth();
	}, []);

	if (isLoggedIn) {
		return <MemoPage />;
	}

	return <AuthPage onLoginSuccess={checkAuth} />;
}

export default Index;
