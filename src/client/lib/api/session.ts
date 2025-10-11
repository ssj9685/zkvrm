import type { RootApi } from "@server/api/root-api";
import { newHttpBatchRpcSession } from "capnweb";

function createSession() {
	return newHttpBatchRpcSession<RootApi>("/api");
}

export const api = () => createSession();
