export class ApiError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(
		message: string,
		code: string,
		status = 400,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.code = code;
		this.status = status;
		this.name = new.target.name;
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

export class ValidationError extends ApiError {
	constructor(message: string, code = "VALIDATION_ERROR") {
		super(message, code, 400);
	}
}

export class UsernameTakenError extends ApiError {
	constructor() {
		super("Username already taken", "AUTH_USERNAME_TAKEN", 409);
	}
}

export class InvalidCredentialsError extends ApiError {
	constructor() {
		super("Invalid username or password", "AUTH_INVALID_CREDENTIALS", 401);
	}
}

export class UnauthorizedError extends ApiError {
	constructor(message = "Unauthorized") {
		super(message, "AUTH_UNAUTHORIZED", 401);
	}
}

export function toRpcError(error: ApiError): Error {
	return Object.assign(
		new Error(
			JSON.stringify({
				code: error.code,
				message: error.message,
				status: error.status,
				name: error.name,
			}),
		),
		{
			name: error.name,
			code: error.code,
			status: error.status,
		},
	);
}
