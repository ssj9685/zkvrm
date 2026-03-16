import { AuthShell } from "@client/components/auth/auth-shell";
import { FormButton } from "@client/components/form-button";
import { Input } from "@client/components/input";
import { toast } from "@client/components/toast/toast-overlay";
import { ApiErrorCode, getApiError } from "@client/lib/api/errors";
import { authStore } from "@client/store/auth";
import { routeStore } from "@client/store/route";
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
			const apiError = getApiError(error);
			if (apiError) {
				if (apiError.code === ApiErrorCode.AUTH_INVALID_CREDENTIALS) {
					toast.open("아이디 또는 비밀번호가 맞지 않습니다");
					return;
				}
				toast.open(apiError.message);
				return;
			}
			toast.open("작업실에 들어오지 못했습니다");
		}
	};

	return (
		<AuthShell
			badge="다시 이어쓰기"
			title="메모판으로 돌아오기"
			subtitle="기록의 흐름을 끊지 않고, 방금까지 이어 쓰던 보드로 바로 돌아갑니다."
			footer={
				<p className="text-center">
					아직 작업실이 없다면
					<button
						type="button"
						onClick={() => router.goto("/sign-up")}
						className="ml-1 rounded font-semibold text-[var(--accent-strong)] transition hover:text-[var(--accent)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
					>
						새로 만들기
					</button>
				</p>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-5">
				<div className="grid gap-4">
					<Input
						label="아이디"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
					/>
					<Input
						label="비밀번호"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>
				<FormButton>작업실 들어가기</FormButton>
			</form>
		</AuthShell>
	);
}
