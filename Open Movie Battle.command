#!/bin/bash
# Double-click to open Movie Battle in your browser.
# JavaScript modules don't run when index.html is opened straight from a file, so this
# starts a tiny local web server with Python 3 (part of Apple's free Command Line Tools,
# which come with Git). Close this window to stop it.
cd "$(dirname "$0")"
if ! python3 -c "import http.server" >/dev/null 2>&1; then
    echo "Movie Battle needs Python 3, which comes with Apple's Command Line Tools."
    echo "If macOS offered to install them, choose Install, then double-click start.command again."
    echo "(You can also install them by running:  xcode-select --install)"
    read -n 1 -s -r -p "Press any key to close."
    exit 1
fi
PORT=8123
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done   # find a free port
echo "Movie Battle is running at http://localhost:$PORT"
echo "Close this window to stop it."
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server $PORT --bind 127.0.0.1
