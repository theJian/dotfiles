# Load Homebrew environment variables (PATH, MANPATH, etc.) into fish
eval (/opt/homebrew/bin/brew shellenv)

# Added by OrbStack: command-line tools and integration
# This won't be added again if you remove it.
source ~/.orbstack/shell/init2.fish 2>/dev/null || :

if status is-interactive
	# Disable the default welcome message when starting a fish shell
	set -g fish_greeting

	function last_history_item; echo $history[1]; end
	abbr -a !! --position anywhere --function last_history_item

	function last_history_arg; echo $history[1] | string match -r '[^ ]+$'; end
	abbr -a !\$ --position anywhere --function last_history_arg
end
