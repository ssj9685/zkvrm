#!/usr/bin/env bash
set -Eeuo pipefail

readonly BUN=/home/ssj2648597/.local/opt/bun/1.4.0/bun
readonly SOURCE_REPO=/home/ssj2648597/zkvrm
readonly SERVICE_ROOT=/home/ssj2648597/services/zkvrm
readonly RELEASE_ROOT="${SERVICE_ROOT}/releases"
readonly CURRENT_LINK="${SERVICE_ROOT}/current"
readonly PREVIOUS_LINK="${SERVICE_ROOT}/previous"
readonly SHARED_ENV="${SOURCE_REPO}/.env"
readonly SQLITE_PATH="${SOURCE_REPO}/zkvrm.sqlite"
readonly LOG_FILE="${SOURCE_REPO}/logs/zkvrm.log"
readonly CANARY_PORT=3001

if [[ $# -ne 1 ]]; then
	echo "Usage: $0 <git-ref>" >&2
	exit 2
fi

git -C "${SOURCE_REPO}" fetch --prune origin
commit="$(git -C "${SOURCE_REPO}" rev-parse --verify "${1}^{commit}")"
release="${RELEASE_ROOT}/${commit}"

mkdir -p "${RELEASE_ROOT}"
if [[ ! -d "${release}" ]]; then
	git -C "${SOURCE_REPO}" worktree add --detach "${release}" "${commit}"
fi

ln -sfn "${SHARED_ENV}" "${release}/.env"
(
	cd "${release}"
	"${BUN}" install --frozen-lockfile
)

canary_pid=""
cleanup_canary() {
	if [[ -n "${canary_pid}" ]] && kill -0 "${canary_pid}" 2>/dev/null; then
		kill -INT "${canary_pid}" 2>/dev/null || true
		wait "${canary_pid}" 2>/dev/null || true
	fi
}
trap cleanup_canary EXIT

(
	cd "${release}"
	env \
		HOST=127.0.0.1 \
		PORT="${CANARY_PORT}" \
		SQLITE_PATH="${SQLITE_PATH}" \
		LOG_FILE=/tmp/zkvrm-deploy-canary.log \
		"${BUN}" src/server/index.ts >/tmp/zkvrm-deploy-canary.out 2>&1
) &
canary_pid=$!

for _ in {1..20}; do
	if [[ "$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${CANARY_PORT}/")" == "200" ]] &&
		[[ "$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${CANARY_PORT}/api")" == "405" ]]; then
		break
	fi
	sleep 0.5
done

if [[ "$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${CANARY_PORT}/")" != "200" ]]; then
	echo "Canary failed; current release was not changed." >&2
	tail -50 /tmp/zkvrm-deploy-canary.out >&2 || true
	exit 1
fi

cleanup_canary
canary_pid=""

old_release="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
if [[ -n "${old_release}" ]]; then
	ln -sfn "${old_release}" "${PREVIOUS_LINK}"
fi

ln -sfn "${release}" "${CURRENT_LINK}.new"
mv -Tf "${CURRENT_LINK}.new" "${CURRENT_LINK}"

if ! sudo systemctl restart zkvrm.service; then
	if [[ -n "${old_release}" ]]; then
		ln -sfn "${old_release}" "${CURRENT_LINK}.new"
		mv -Tf "${CURRENT_LINK}.new" "${CURRENT_LINK}"
		sudo systemctl restart zkvrm.service
	fi
	exit 1
fi

for _ in {1..20}; do
	if systemctl is-active --quiet zkvrm.service &&
		[[ "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/)" == "200" ]]; then
		echo "Deployed ${commit} with Bun $("${BUN}" --version)."
		exit 0
	fi
	sleep 0.5
done

if [[ -n "${old_release}" ]]; then
	ln -sfn "${old_release}" "${CURRENT_LINK}.new"
	mv -Tf "${CURRENT_LINK}.new" "${CURRENT_LINK}"
	sudo systemctl restart zkvrm.service
fi

echo "Health check failed; rolled back to ${old_release:-the original service}." >&2
exit 1
