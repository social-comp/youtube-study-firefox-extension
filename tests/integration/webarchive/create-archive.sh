#!/bin/bash
set -eo pipefail

# NOTE - to prevent being throttled, use `--wait` to wait a random number of seconds.
# You may also want to customize the user agent, and choose to honor robots.txt (--execute robots).
wget \
    --mirror \
    --warc-file=MOZILLA_DOT_ORG \
    --warc-cdx \
    --page-requisites \
    --html-extension \
    --convert-links \
    --execute-robots=on \
    --directory-prefix=. \
    --domains=mozilla.org,www.mozilla.org \
    --user-agent=Mozilla\
    --wait=0 \
    --random-wait \
    https://www.mozilla.org/en-US/