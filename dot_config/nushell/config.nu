# Nushell Config File
#
# version = "0.101.0"
# Load custom completions
use completions/git-completions.nu *
use completions/adb-completions.nu *
use completions/gh-completions.nu *
use completions/npm-completions.nu *
use completions/rg-completions.nu *
use completions/ssh-completions.nu *
use themes/moonwalk.nu

$env.config.color_config = (moonwalk)

alias vi = nvim

$env.GPG_TTY = (tty | str trim)

# Ensure mise autoload directory exists and generate the activation script
mkdir ($nu.user-autoload-dirs | first)
^mise activate nu | save -f ($nu.user-autoload-dirs | first | path join "mise.nu")
