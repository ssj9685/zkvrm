import { useState } from "react";
import { FormButton } from "@/shared/components/form-button";
import { Input } from "@/shared/components/input";

export function RegisterPage({
	onRegisterSuccess,
}: {
	onRegisterSuccess: () => void;
}) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const response = await fetch("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password }),
		});

		if (response.ok) {
			onRegisterSuccess();
		} else {
			const errorMessage = await response.text();
			setError(errorMessage);
		}
	};

	return (
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

				{error && <p className="text-sm text-red-600">{error}</p>}

				<FormButton>Create Account</FormButton>
			</form>
		</div>
	);
}
