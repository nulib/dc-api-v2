#!/usr/bin/env bash
cd "$(dirname "$0")/.."
ASDF_DATA_DIR="${ASDF_DATA_DIR:-$HOME/.asdf}"
if [ -e $HOME/.local/bin/mise ]; then
  echo "Activating mise environment for bash" >&2
  eval "$($HOME/.local/bin/mise activate bash)"
elif [ -e ${ASDF_DATA_DIR}/shims ]; then
  echo "Activating asdf environment for bash" >&2
  export PATH="${ASDF_DATA_DIR}/shims:$PATH"
fi
echo $PATH >&2
exec npm run --silent stdio "$@"