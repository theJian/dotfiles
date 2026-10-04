#!/bin/sh
set -eu
TEST_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
JIAN_TEST_DIR=$(mktemp -d "${TMPDIR:-/tmp}/jian-persistence.XXXXXX")
export JIAN_TEST_DIR
trap 'rm -rf "$JIAN_TEST_DIR"' EXIT HUP INT TERM
emacs -Q --batch -l "$TEST_DIR/workflow-test.el"
JIAN_TEST_STAGE=write emacs -Q --batch -l "$TEST_DIR/restart-test.el"
JIAN_TEST_STAGE=read emacs -Q --batch -l "$TEST_DIR/restart-test.el"
