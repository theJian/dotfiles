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
    # Each color:bitmap entry packs an 8x8 sprite into two rows of Braille.
    # Dark shades keep the sprites readable on light terminal backgrounds.
    set -l sprites

    # Crimson
    set -a sprites 'a61b3c:⣵⢶⢶⡅⠹⠛⠻⠁'

    # Ochre
    set -a sprites '806000:⡬⣶⡮⡄⠩⠏⠯⠁'

    # Teal
    set -a sprites '006b60:⢈⣆⣎⠀⠽⠚⠺⠅'

    # Blue
    set -a sprites '005a9c:⣨⣦⣮⡀⠽⠞⠾⠅'

    # Burnt orange
    set -a sprites '994500:⣴⣳⣳⡄⠨⠋⠫⠀'

    # Raspberry
    set -a sprites '9d2459:⢈⣖⣎⠀⠻⠺⠺⠃'

    # Slate
    set -a sprites '334155:⣵⢶⢶⡅⠙⠟⠟⠁'

    set -l sprite (string split : -- (random choice $sprites))
    set -l color (set_color $sprite[1])
    set -l normal (set_color --reset)

    for row in (string sub -s 1 -l 4 -- $sprite[2]) (string sub -s 5 -l 4 -- $sprite[2])
        printf '⠀%s%s%s⠀\n' "$color" "$row" "$normal"
    end
end
