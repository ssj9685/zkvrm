import { useState } from "react";
import { toast } from "@/shared/components/toast/toast-overlay";
import { LoginPage } from "./login-page";
import { RegisterPage } from "./register-page";

export function AuthPage() {
	const [isLogin, setIsLogin] = useState(true);

	const handleRegisterSuccess = () => {
		setIsLogin(true);
		toast.open("Registration successful! Please log in.");
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			{isLogin ? (
				<LoginPage />
			) : (
				<RegisterPage onRegisterSuccess={handleRegisterSuccess} />
			)}
			<p className="absolute bottom-8 text-center text-sm text-gray-600">
				{isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
				<button
					type="button"
					onClick={() => setIsLogin(!isLogin)}
					className="font-medium text-gray-800 hover:text-gray-600"
				>
					{isLogin ? "Register" : "Login"}
				</button>
			</p>
		</div>
	);
}
