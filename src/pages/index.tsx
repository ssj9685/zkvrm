import "../assets/index.css";
import { useStore } from "@ga-ut/store";
import { useEffect } from "react";
import { authStore } from "@/domains/auth";
import { SpinnerIcon } from "@/shared/components/icons/spinner-icon";
import { ModalSpace } from "@/shared/components/modal/modal-overlay";
import { ToastSpace } from "@/shared/components/toast/toast-overlay";
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
				<SpinnerIcon
					className="w-8 h-8 animate-spin text-gray-600"
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
