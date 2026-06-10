# Runs at shell startup; ADDS profile completions without owning claude.fish.
status is-interactive; or exit 0

function __claude_profiles --description "List claude env profiles"
    set -l cmd (commandline -opc)
    set -l profile_dir ""
    set -l i 1
    while test $i -le (count $cmd)
        switch $cmd[$i]
            case '--profile-dir'
                set i (math $i + 1)
                test $i -le (count $cmd); and set profile_dir $cmd[$i]
            case '--profile-dir=*'
                set profile_dir (string split -m1 '=' -- $cmd[$i])[2]
        end
        set i (math $i + 1)
    end
    test -z "$profile_dir"; and set profile_dir "$HOME/.claude/profiles"
    set profile_dir (string replace -r '^~' "$HOME" -- $profile_dir)
    test -d "$profile_dir"; or return 0
    for f in $profile_dir/*.env
        test -f "$f"; or continue
        string replace -r '\.env$' '' -- (basename "$f")
    end
end

complete -c claude -f -r -s e -l profile -d "Use the named env profile" -a "(__claude_profiles)"
complete -c claude -r -l profile-dir  -d "Directory holding <name>.env profiles" -a "(__fish_complete_directories)"
complete -c claude -f -l profile-list -d "List available profiles"
complete -c claude -f -l list-profiles -d "List available profiles (alias)"
complete -c claude -f -l profile-show -d "Show (redacted) env for the selected profile"
