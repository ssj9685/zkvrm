import { AuthShell } from "@client/components/auth/auth-shell";
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
					toast.open("이미 쓰고 있는 아이디입니다");
					return;
				}
				toast.open(apiError.message);
				return;
			}
			toast.open("작업실을 만들지 못했습니다");
		}
	};

	return (
		<AuthShell
			badge="새 작업실"
			title="스크랩북 작업실 만들기"
			subtitle="손으로 붙여 둔 듯한 메모판을 만들고, 바로 기록을 시작합니다."
			footer={
				<p className="text-center">
					이미 작업실이 있다면
					<button
						type="button"
						onClick={() => router.goto("/sign-in")}
						className="ml-1 rounded font-semibold text-[var(--accent-strong)] transition hover:text-[var(--accent)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
					>
						들어가기
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
				<FormButton>작업실 만들기</FormButton>
			</form>
		</AuthShell>
	);
}
