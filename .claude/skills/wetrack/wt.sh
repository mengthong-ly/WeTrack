#!/usr/bin/env bash
# Calls the WeTrack agent API with the key from the environment. Usage: wt.sh METHOD /api/agent/... ['<json body>']
# Prints the response body, then "HTTP <status>". Never prints the key; only sends it to $WETRACK_URL/api/agent/*.
set -euo pipefail

for name in WETRACK_URL WETRACK_API_KEY; do
  [ -n "${!name:-}" ] || { echo "missing $name" >&2; exit 2; }
done
[ $# -ge 2 ] && [ $# -le 3 ] || { echo "usage: wt.sh GET|POST|PATCH /api/agent/... ['<json body>']" >&2; exit 2; }

method=$1 path=$2 body=${3-}
case $method in GET | POST | PATCH) ;; *) echo "refused: method must be GET, POST or PATCH" >&2; exit 2 ;; esac
case $path in /api/agent/*) ;; *) echo "refused: path must start with /api/agent/" >&2; exit 2 ;; esac
case $path in *..* | *[[:space:]]*) echo "refused: bad path" >&2; exit 2 ;; esac
case $body in '' | '{'*) ;; *) echo "refused: body must be a JSON object" >&2; exit 2 ;; esac

args=(-sSg -X "$method" -H @- -w '\nHTTP %{http_code}\n')
[ -z "$body" ] || args+=(-H "Content-Type: application/json" --data-raw "$body")

# The header goes in on stdin, so the key never appears in a process list or error text.
printf 'Authorization: Bearer %s\n' "$WETRACK_API_KEY" | curl "${args[@]}" "${WETRACK_URL%/}$path"
