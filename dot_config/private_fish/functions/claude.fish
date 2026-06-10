function claude --description "Claude Code with env profiles"
    set -l wrapper "$HOME/.config/fish/functions/claude-profile.lisp"

    if not test -f "$wrapper"
        echo "claude fish function: wrapper not found: $wrapper" >&2
        return 127
    end

    if not test -r "$wrapper"
        echo "claude fish function: wrapper is not readable: $wrapper" >&2
        return 126
    end

    set -l roswell (command -s ros)

    if test -z "$roswell"
        echo "claude fish function: roswell (ros) not found" >&2
        return 127
    end

    set -l real_claude (command -s claude)

    if test -z "$real_claude"
        echo "claude fish function: claude executable not found" >&2
        return 127
    end

    env CLAUDE_REAL_BIN="$real_claude" "$roswell" -Q "$wrapper" -- $argv
end
