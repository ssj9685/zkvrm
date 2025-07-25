import { FetcherError } from "@ga-ut/fetcher";
import { useStore } from "@ga-ut/store";
import { useState } from "react";
import { authStore } from "@/domains/auth";
import { FormButton } from "@/shared/components/form-button";
import { Input } from "@/shared/components/input";
import { toast } from "@/shared/components/toast/toast-overlay";

export function LoginPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const { login, checkAuth } = useStore(authStore);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			await login({ username, password });
			await checkAuth();
		} catch (error) {
			if (error instanceof FetcherError) {
				if (error.statusCode === 401) {
					toast.open("Invalid username or password");
				}
			}
		}
	};

	return (
		<div className="max-w-md w-full bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
			<h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
				Login
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

				<FormButton>Sign In</FormButton>
			</form>
		</div>
	);
}
