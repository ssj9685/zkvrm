import { FormButton } from "@client/components/form-button";
import { Input } from "@client/components/input";
import { toast } from "@client/components/toast/toast-overlay";
import { authStore } from "@client/store/auth";
import { routeStore } from "@client/store/route";
import { FetcherError } from "@ga-ut/fetcher";
import { useStore } from "@ga-ut/store-react";
import { useState } from "react";

	export function LoginPage() {
		const [username, setUsername] = useState("");
		const [password, setPassword] = useState("");
		const { login, checkAuth } = useStore(authStore);
		const router = useStore(routeStore);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			await login({ username, password });
			await checkAuth();
			router.goto("/memo");
		} catch (error) {
			if (error instanceof FetcherError) {
				if (error.statusCode === 401) {
					toast.open("Invalid username or password");
				}
			}
		}
	};

		return (
			<div className="min-h-screen w-full flex items-center justify-center px-4">
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
			</div>
		);
	}
