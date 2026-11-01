function fish_prompt --description 'Write out the prompt'
    set -l last_pipestatus $pipestatus
    set -lx __fish_last_status $status # Export for __fish_print_pipestatus.

    set -q __fish_git_prompt_show_informative_status
    or set -g __fish_git_prompt_show_informative_status 1
    set -q __fish_git_prompt_showdirtystate
    or set -g __fish_git_prompt_showdirtystate 1
    set -q __fish_git_prompt_hide_untrackedfiles
    or set -g __fish_git_prompt_hide_untrackedfiles 1
    set -q __fish_git_prompt_showupstream
    or set -g __fish_git_prompt_showupstream informative
    set -q __fish_git_prompt_showcolorhints
    or set -g __fish_git_prompt_showcolorhints 1

    set -l normal (set_color --reset)

    # Color the prompt differently when we're root
    set -l color_cwd $fish_color_cwd
    set -l suffix ''
    if functions -q fish_is_root_user; and fish_is_root_user
        if set -q fish_color_cwd_root
            set color_cwd $fish_color_cwd_root
        end
        set suffix '#'
    end

    # Write pipestatus
    # If the status was carried over (if no command is issued or if `set` leaves the status untouched), don't bold it.
    set -l bold_flag --bold
    set -q __fish_prompt_status_generation; or set -g __fish_prompt_status_generation $status_generation
    if test $__fish_prompt_status_generation = $status_generation
        set bold_flag
    end
    set __fish_prompt_status_generation $status_generation
    set -l status_color (set_color $fish_color_status)
    set -l statusb_color (set_color $bold_flag $fish_color_status)
    set -l prompt_status (__fish_print_pipestatus "[" "]" "|" "$status_color" "$statusb_color" $last_pipestatus)

    set -l board (fish_prompt_invader)

    echo -s $board[1] $normal (set_color $color_cwd) (prompt_pwd) $normal (fish_vcs_prompt) $normal " "$prompt_status
    echo -n -s $board[2] $normal $suffix
end

function fish_prompt_invader --description 'Display a random colored pixel alien'
    # Reference sprites run left to right, top to bottom; each is an 8x8 bitmap.
    # Octants use U+1CD00–U+1CDE5 plus existing Unicode equivalents for omitted fills.
    set -l sprites

    set -a sprites '▚𜷙𜷈▞𜵣𜴣𜴔𜶝'
    set -a sprites '𜺠𜶩𜵯𜺣𜶐𜴗𜴦𜵆'
    set -a sprites '𜷡𜶩𜵯𜷞▞𜴪𜴪▚'
    set -a sprites '𜶆𜶜𜵡𜵚𜵓𜵏𜶛𜶁'
    set -a sprites '𜵺𜷞𜷡𜴺𜶕𜴔𜴣𜵍'
    set -a sprites '𜷍𜶨𜵭𜶼𜵍𜴏𜴢𜶕'
    set -a sprites '𜷋𜶪𜵮𜶻𜶐𜴓𜴟𜵆'
    set -a sprites '𜴄𜷄𜷑𜴁𜶪𜵬𜶣𜵮'
    set -a sprites '▝𜶄𜵙▘𜶤𜵬𜶣𜵥'
    set -a sprites '𜷡𜶫𜵰𜷞𜷍𜶫𜵰𜶼'
    set -a sprites '𜵳𜶩𜵯𜴸𜴚𜵍𜶕𜴊'
    set -a sprites '𜶘𜵼𜵁𜵊𜴡𜵝𜶌𜴍'
    set -a sprites '𜷋𜶪𜵮𜶻𜵔𜵰𜶫𜶃'
    set -a sprites '𜷡██𜷞𜵺𜶧𜵨𜴺'
    set -a sprites '𜵸𜶼𜷍𜴹𜵞𜵐𜶚𜶎'
    set -a sprites '𜶢𜶜𜵡𜵪▐𜴕𜴥▌'

    # Four color stops run from brighter left to darker right on both rows.
    set -l gradients a61b3c:901734:7b142d:651025 806000:6f5300:5e4600:4d3900 008577:007266:005e54:004b43 0077bb:0066a1:005688:00456e b85b00:a04f00:894400:713800 b52d69:9e275c:87224e:701c41 536780:47596e:3c4a5d:303c4b
    set -l sprite (random choice $sprites)
    set -l gradient (string split : -- (random choice $gradients))
    set -l rows (string sub -s 1 -l 4 -- $sprite) (string sub -s 5 -l 4 -- $sprite)
    set -l normal (set_color --reset)

    for row in $rows
        printf ' '
        for column in 1 2 3 4
            set -l color (set_color --bold $gradient[$column])
            printf '%s%s' "$color" (string sub -s $column -l 1 -- "$row")
        end
        printf '%s \n' "$normal"
    end
end

