#!/bin/bash
export HOME="${HOME:-/Users/mbk836}"
eval "$(~/.local/bin/mise activate bash)"
cd "$(dirname "$0")/.."
. .env
exec npm run --silent stdio "$@"