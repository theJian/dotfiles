function vi --wraps=nvim --description 'alias vi=nvim'
    if test -e /usr/local/bin/nvim
        /usr/local/bin/nvim $argv
    else
        nvim $argv
    end
end
