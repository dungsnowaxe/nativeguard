#!/usr/bin/env bash
# Capture nativeguard doctor --json evidence for the verify-nativeguard skill.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
ARTIFACTS_ROOT="$REPO_ROOT/.cursor/skills/verify-nativeguard/artifacts"
CLI="$REPO_ROOT/packages/cli/dist/index.js"

usage() {
  cat <<'EOF'
Usage:
  verify-doctor.sh check
  verify-doctor.sh drive --run-id <id> --feature <id> [--cwd <dir>] -- [doctor args]
  verify-doctor.sh cleanup --scratch-dir <dir>

Run from the NativeGuard repo root (or any cwd; the script resolves the repo).
drive always passes --json to nativeguard doctor if you omit it.
drive records evidence and exits 0 even when doctor exits 1.
EOF
}

fail() {
  echo "verify-doctor: $*" >&2
  exit 1
}

cmd="${1:-}"
if [[ -z "$cmd" || "$cmd" == "-h" || "$cmd" == "--help" ]]; then
  usage
  exit 0
fi
shift

check() {
  local node_version node_major version_out version_code help_out help_code
  node_version=$(node -v)
  node_major=${node_version#v}
  node_major=${node_major%%.*}
  [[ "$node_major" == "24" ]] || fail "Node $node_version is not 24.x (engines: >=24 <25)"
  [[ -f "$CLI" ]] || fail "missing $CLI — run pnpm build"

  version_out=$(node "$CLI" --version)
  version_code=$?
  [[ "$version_code" -eq 0 ]] || fail "--version exited $version_code"
  [[ "$version_out" == "0.0.0" ]] || fail "--version printed ${version_out@Q}, expected 0.0.0"

  help_out=$(node "$CLI" --help)
  help_code=$?
  [[ "$help_code" -eq 0 ]] || fail "--help exited $help_code"
  [[ "$help_out" == *"nativeguard doctor"* ]] || fail "--help did not mention nativeguard doctor"

  cat <<EOF
verify-doctor check: ok
  node: $node_version
  cli: $CLI
  version: $version_out
EOF
}

drive() {
  local run_id="" feature="" drive_cwd="$REPO_ROOT"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --run-id)
        run_id="${2:-}"
        shift 2
        ;;
      --feature)
        feature="${2:-}"
        shift 2
        ;;
      --cwd)
        drive_cwd="${2:-}"
        shift 2
        ;;
      --)
        shift
        break
        ;;
      *)
        fail "unknown drive flag: $1"
        ;;
    esac
  done
  [[ -n "$run_id" ]] || fail "drive requires --run-id"
  [[ -n "$feature" ]] || fail "drive requires --feature"
  [[ "$run_id" != *"/"* ]] || fail "run-id must be a single path segment"
  [[ -f "$CLI" ]] || fail "missing $CLI — run pnpm build"

  if [[ "$drive_cwd" != /* ]]; then
    drive_cwd="$REPO_ROOT/$drive_cwd"
  fi
  [[ -d "$drive_cwd" ]] || fail "cwd does not exist: $drive_cwd"

  local doctor_args=("$@")
  local has_json=0
  local arg
  for arg in "${doctor_args[@]+"${doctor_args[@]}"}"; do
    if [[ "$arg" == "--json" ]]; then
      has_json=1
      break
    fi
  done
  if [[ "$has_json" -eq 0 ]]; then
    doctor_args=("--json" "${doctor_args[@]+"${doctor_args[@]}"}")
  fi

  local out_dir="$ARTIFACTS_ROOT/$run_id"
  mkdir -p "$out_dir"

  local started finished exit_code
  started=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  {
    printf 'node %s doctor' "$CLI"
    printf ' %q' "${doctor_args[@]}"
    printf '\n'
  } >"$out_dir/command.txt"

  set +e
  (
    cd "$drive_cwd"
    node "$CLI" doctor "${doctor_args[@]}"
  ) >"$out_dir/stdout.json" 2>"$out_dir/stderr.txt"
  exit_code=$?
  set -e
  finished=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  printf '%s\n' "$exit_code" >"$out_dir/exit-code.txt"

  python3 -c '
import json, sys
from pathlib import Path
feature, run_id, node, cli, cwd, exit_code, started, finished, out_dir = sys.argv[1:10]
doctor_args = json.loads(sys.argv[10])
Path(out_dir, "meta.json").write_text(
    json.dumps(
        {
            "feature": feature,
            "runId": run_id,
            "node": node,
            "cli": cli,
            "cwd": cwd,
            "command": ["node", cli, "doctor", *doctor_args],
            "exitCode": int(exit_code),
            "startedAt": started,
            "finishedAt": finished,
            "artifactsDir": str(Path(out_dir)),
        },
        indent=2,
    )
    + "\n"
)
' "$feature" "$run_id" "$(node -v)" "$CLI" "$drive_cwd" "$exit_code" "$started" "$finished" "$out_dir" "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "${doctor_args[@]+"${doctor_args[@]}"}")"

  echo "verify-doctor drive: exit $exit_code"
  echo "  feature: $feature"
  echo "  artifacts: $out_dir"
}

cleanup() {
  local scratch=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --scratch-dir)
        scratch="${2:-}"
        shift 2
        ;;
      *)
        fail "unknown cleanup flag: $1"
        ;;
    esac
  done
  [[ -n "$scratch" ]] || fail "cleanup requires --scratch-dir"
  [[ "$scratch" == /tmp/nativeguard-verify-* ]] || fail "refusing to delete $scratch (must be /tmp/nativeguard-verify-*)"
  rm -rf "$scratch"
  echo "verify-doctor cleanup: removed $scratch"
  echo "  evidence artifacts were not touched"
}

case "$cmd" in
  check)
    check "$@"
    ;;
  drive)
    drive "$@"
    ;;
  cleanup)
    cleanup "$@"
    ;;
  *)
    usage
    fail "unknown command: $cmd"
    ;;
esac
