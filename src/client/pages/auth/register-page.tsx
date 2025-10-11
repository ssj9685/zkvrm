import { FormButton } from "@client/components/form-button";
import { Input } from "@client/components/input";
import { toast } from "@client/components/toast/toast-overlay";
import { ApiErrorCode, getApiError } from "@client/lib/api/errors";
import { authStore } from "@client/store/auth";
import { routeStore } from "@client/store/route";
import { useStore } from "@ga-ut/store-react";
import { useState } from "react";

export function RegisterPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const router = useStore(routeStore);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			await authStore.getState().register({ username, password });
			router.goto("/sign-in");
		} catch (error) {
			const apiError = getApiError(error);
			if (apiError) {
				if (apiError.code === ApiErrorCode.AUTH_USERNAME_TAKEN) {
					toast.open("Username already taken");
					return;
				}
				toast.open(apiError.message);
				return;
			}
			toast.open("Failed to register");
		}
	};

	return (
		<div className="min-h-screen w-full flex items-center justify-center px-4">
			<div className="max-w-md w-full bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
				<h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
					Register
				</h2>
				<form onSubmit={handleSubmit} className="space-y-6">
					<Input
						label="Username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
					/>
					<Input
						label="Password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>

					<FormButton>Create Account</FormButton>
				</form>
			</div>
		</div>
	);
}
