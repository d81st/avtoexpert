#!/usr/bin/env bash
#
# check-sql-raw.sh
#
# Fails (exits non-zero) if any file under backend/src/** calls `sql.raw(`
# with a non-literal-string argument.
#
# Policy: Requirement 6.2 / design §3.6.1 — repository code must rely on
# Drizzle's parametrized helpers. The only permitted argument to `sql.raw(`
# is a static string literal:
#   * single-quoted   sql.raw('SELECT 1')
#   * double-quoted   sql.raw("SELECT 2")
#   * a backtick template WITHOUT ${} interpolation   sql.raw(`SELECT 3`)
#
# Everything else is a violation, including:
#   * interpolated backtick templates  sql.raw(`... ${userInput}`)
#   * bare identifiers                 sql.raw(someQuery)
#   * function calls                   sql.raw(build())
#   * an argument that begins on the next line   sql.raw(\n  '...'\n)
#
# Usage: scripts/check-sql-raw.sh [search-dir]
#   search-dir defaults to <repo-root>/backend/src
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEARCH_DIR="${1:-$REPO_ROOT/backend/src}"

# Resolve the ripgrep binary (named `rg` on Linux/macOS, `rg.exe` under WSL).
RG=""
for candidate in rg rg.exe; do
  if command -v "$candidate" >/dev/null 2>&1; then
    RG="$candidate"
    break
  fi
done
if [[ -z "$RG" ]]; then
  echo "error: ripgrep (rg) is required but was not found on PATH" >&2
  exit 2
fi

if [[ ! -d "$SEARCH_DIR" ]]; then
  echo "error: search directory does not exist: $SEARCH_DIR" >&2
  exit 2
fi

# When running under WSL the only available ripgrep may be the Windows binary
# (rg.exe), which cannot read POSIX paths such as /mnt/c/... . Translate the
# search path to a Windows path in that case. This is a no-op on Linux/macOS
# CI runners where a native `rg` is used.
RG_TARGET="$SEARCH_DIR"
if [[ "$RG" == *.exe && -x "$(command -v wslpath 2>/dev/null)" ]]; then
  RG_TARGET="$(wslpath -w "$SEARCH_DIR")"
fi

# PCRE2 pattern. A match is a VIOLATION.
#
# sql\.raw\(          literal "sql.raw("
# \s*                 optional whitespace after the open paren
# (?! ... )           negative lookahead: NOT immediately followed by a
#                     permitted literal argument, where a permitted argument is
#   ['"]                  the start of a single- or double-quoted string, OR
#   `(?:[^`$]|\$(?!\{))*` a complete backtick template with no ${} interpolation
#                         (a `$` is only allowed when it is not followed by `{`)
#
# The embedded single quote is written as '\'' to escape it within the
# surrounding single-quoted shell string.
PATTERN='sql\.raw\(\s*(?!['\''"]|`(?:[^`$]|\$(?!\{))*`)'

matches="$("$RG" --pcre2 --line-number --no-heading --color never \
  --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.mjs' --glob '*.cjs' \
  -e "$PATTERN" "$RG_TARGET" 2>/dev/null || true)"

if [[ -n "$matches" ]]; then
  echo "ERROR: sql.raw() called with a non-literal-string argument (R6.2, design §3.6.1):" >&2
  echo "$matches" >&2
  echo >&2
  echo "Only static string literals are permitted as the argument to sql.raw()." >&2
  exit 1
fi

echo "OK: no sql.raw() calls with non-literal-string arguments under $SEARCH_DIR"
exit 0
