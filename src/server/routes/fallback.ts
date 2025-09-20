import html from "@client/index.html";

const fallbackRoutes = {
	"/api/*": {
		async GET() {
			return new Response("Not Found", { status: 404 });
		},
		async POST() {
			return new Response("Not Found", { status: 404 });
		},
		async PUT() {
			return new Response("Not Found", { status: 404 });
		},
		async DELETE() {
			return new Response("Not Found", { status: 404 });
		},
	},
	"/*": html,
};

export default fallbackRoutes;
