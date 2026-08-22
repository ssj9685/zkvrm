#!/usr/bin/env bash
set -Eeuo pipefail

readonly SERVICE_ROOT=/home/ssj2648597/services/zkvrm
readonly RELEASE_ROOT="${SERVICE_ROOT}/releases"
readonly CURRENT_LINK="${SERVICE_ROOT}/current"
readonly PREVIOUS_LINK="${SERVICE_ROOT}/previous"

target="${1:-$(readlink -f "${PREVIOUS_LINK}" 2>/dev/null || true)}"
target="$(readlink -f "${target}" 2>/dev/null || true)"

case "${target}" in
	"${RELEASE_ROOT}"/*) ;;
	*)
		echo "Rollback target must be an existing release under ${RELEASE_ROOT}." >&2
		exit 2
		;;
esac

old_release="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
ln -sfn "${target}" "${CURRENT_LINK}.new"
mv -Tf "${CURRENT_LINK}.new" "${CURRENT_LINK}"
sudo systemctl restart zkvrm.service

if systemctl is-active --quiet zkvrm.service &&
	[[ "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/)" == "200" ]]; then
	if [[ -n "${old_release}" ]]; then
		ln -sfn "${old_release}" "${PREVIOUS_LINK}"
	fi
	echo "Rolled back to ${target}."
	exit 0
fi

echo "Rollback target did not become healthy." >&2
exit 1
