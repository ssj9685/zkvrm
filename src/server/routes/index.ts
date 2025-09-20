import authRoutes from "@server/routes/auth";
import fallbackRoutes from "@server/routes/fallback";
import memoRoutes from "@server/routes/memo";

export const routes = {
	...authRoutes,
	...memoRoutes,
	...fallbackRoutes,
};
