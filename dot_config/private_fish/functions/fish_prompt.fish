function fish_prompt --description 'Write out the prompt'
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

    set -l last_pipestatus $pipestatus
    set -lx __fish_last_status $status # Export for __fish_print_pipestatus.
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

    set -l bunny_eyes (random choice '•᷅•᷄' '˃˂' 'ˊˋ' '-•' '--' '..' '••' 'ᵔᵔ' '◕◕' "''" '•᷄•᷅' '◟◞' '˘˘' '°°' '╹╹' '≖≖')
    set -l bunny_color (random choice brblue brcyan brpurple brgreen)

    echo -s    (set_color $bunny_color) "" (set_color $color_cwd) (prompt_pwd) $normal (fish_vcs_prompt) $normal " "$prompt_status
    echo -n -s (set_color $bunny_color) "" $normal (set_color -b $bunny_color brwhite) $bunny_eyes $normal (set_color $bunny_color) ""  $normal $suffix " "
end
