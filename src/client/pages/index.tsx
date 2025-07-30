import "@client/index.css";
import { Icon } from "@client/components/icons/icon";
import { ModalSpace } from "@client/components/modal/modal-overlay";
import { ToastSpace } from "@client/components/toast/toast-overlay";
import { authStore } from "@client/store/auth";
import { useStore } from "@ga-ut/store";
import { useEffect } from "react";
import { AuthPage } from "./auth";
import { MemoPage } from "./memo";

export function Index() {
	const { isLoggedIn, isLoading, checkAuth } = useStore(authStore);

	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center text-gray-500">
				<Icon
					className="w-8 h-8 animate-spin text-gray-600"
					name="spinner"
					title="Loading"
				/>
				<p className="mt-2">Loading...</p>
			</div>
		);
	}

	return (
		<>
			{isLoggedIn ? <MemoPage /> : <AuthPage />}
			<ModalSpace />
			<ToastSpace />
		</>
	);
}

export default Index;
