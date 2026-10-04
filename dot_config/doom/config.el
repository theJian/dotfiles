;;; config.el -*- lexical-binding: t; -*-

;; Fill the desktop's usable area without entering macOS full-screen mode.
(setf (alist-get 'fullscreen default-frame-alist) 'maximized)
(setf (alist-get 'undecorated default-frame-alist) t)
(defun j/maximize-frame-h ()
  (when (display-graphic-p)
    (set-frame-parameter nil 'undecorated t)
    (set-frame-parameter nil 'fullscreen 'maximized)))
(add-hook 'window-setup-hook #'j/maximize-frame-h t)

;; Match Alacritty's coding font (Nerd Font variant for icon glyphs).
(setq doom-font (font-spec :family "CommitMono Nerd Font Mono" :size 15))

;; Avoid a missing Symbols font falling back to icons wider than their cells.
(after! nerd-icons
  (setq nerd-icons-font-family "CommitMono Nerd Font Mono"))

(setq doom-theme 'moonwalk-light
      display-line-numbers-type 'relative
      org-directory "~/org/"
      scroll-margin 3)

;; Moonwalk's lualine uses a padded, colored block for the editing mode.
(after! doom-modeline
  (dolist (modeline doom-modeline--modelines)
    (let ((lhs (remq 'bar (cadr modeline))))
      (doom-modeline-def-modeline (car modeline) lhs (caddr modeline))))

  (doom-modeline-def-segment modals
    "Display the Evil state as a Moonwalk mode block."
    (when (and doom-modeline-modal (bound-and-true-p evil-local-mode))
      (let* ((terminal (and (memq evil-state '(emacs insert))
                            (derived-mode-p 'ghostel-mode 'term-mode 'vterm-mode
                                            'eshell-mode 'shell-mode)))
             (label (if terminal "TERMINAL" (upcase (symbol-name evil-state))))
             (face (if terminal 'j/modeline-terminal
                     (intern (format "doom-modeline-evil-%s-state" evil-state)))))
        (concat (propertize (format " %s " label)
                            'face (if (doom-modeline--active) face 'mode-line-inactive)
                            'help-echo "Evil editing state")
                (doom-modeline-spc))))))

(defun j/whitespace-h ()
  (if (derived-mode-p 'prog-mode 'text-mode)
      (when (and buffer-file-name (not buffer-read-only)
                 (not (bound-and-true-p so-long-mode))
                 (not (bound-and-true-p so-long-minor-mode)))
        (require 'whitespace)
        (setq-local whitespace-style '(face tabs tab-mark trailing))
        (whitespace-mode 1))
    (+whitespace-highlight-incorrect-indentation-h)))
;; Configure whitespace once, after the major mode has established indentation.
(remove-hook 'after-change-major-mode-hook #'+whitespace-highlight-incorrect-indentation-h)
(add-hook 'after-change-major-mode-hook #'j/whitespace-h t)

(after! evil
  (setq evil-ex-search-case 'smart evil-search-wrap nil
        evil-ex-complete-emacs-commands t)
  (evil-define-motion j/next-line (count)
    :type line
    (if count
        (progn (when (> count 1) (evil-set-jump)) (evil-next-line count))
      (evil-next-visual-line 1)))
  (evil-define-motion j/previous-line (count)
    :type line
    (if count
        (progn (when (> count 1) (evil-set-jump)) (evil-previous-line count))
      (evil-previous-visual-line 1)))

  (defun j/move-selection (count)
    "Move selected lines by COUNT, reindent, and retain a linewise selection."
    (let* ((beg (save-excursion (goto-char evil-visual-beginning) (line-beginning-position)))
           (end (save-excursion (goto-char (max beg (1- evil-visual-end)))
                               (min (point-max) (line-beginning-position 2))))
           (lines (count-lines beg end)))
      (evil-exit-visual-state)
      ;; Ensure a partial final line stays separate when moved upwards.
      (when (and (= end (point-max))
                 (not (save-excursion (goto-char end) (bolp))))
        (save-excursion (goto-char end) (insert "\n") (setq end (point))))
      (goto-char beg)
      (let ((text (delete-and-extract-region beg end)))
        (forward-line count)
        (unless (bolp) (insert "\n"))
        (setq beg (point))
        (insert text)
        (setq end (point))
        (indent-region beg end))
      (goto-char beg)
      (evil-visual-select beg (save-excursion (forward-line (1- lines))
                                             (line-end-position)) 'line)))
  (defun j/move-selection-down (count)
    (interactive "p") (j/move-selection count))
  (defun j/move-selection-up (count)
    (interactive "p") (j/move-selection (- count)))

  (map! :n "C-h" #'evil-window-left :n "C-j" #'evil-window-down
        :n "C-k" #'evil-window-up :n "C-l" #'evil-window-right
        :n "gh" #'evil-first-non-blank :n "gl" #'evil-last-non-blank
        :n "<backspace>" #'evil-ex-nohighlight :n "DEL" #'evil-ex-nohighlight
        :nv ";" #'evil-ex :nv ":" #'evil-repeat-find-char
        :n "j" #'j/next-line :n "k" #'j/previous-line
        :v "J" #'j/move-selection-down :v "K" #'j/move-selection-up)
  ;; Custom motions need the same button navigation remaps as Evil's motions.
  (map! :map +dashboard-mode-map
        [remap j/next-line] #'forward-button
        [remap j/previous-line] #'backward-button))

(map! :leader :desc "Toggle fold" "SPC" #'+fold/toggle)

;; Ex uses completion-at-point rather than Vertico's completing-read interface.
(defun j/ex-completion-h ()
  (when (and (boundp 'evil-ex-completion-map)
             (eq (current-local-map) evil-ex-completion-map))
    (setq-local corfu-auto t corfu-auto-prefix 1 corfu-auto-delay 0.2)
    (corfu-mode 1)))
(after! corfu
  ;; Run after Corfu's default minibuffer setup, which has depth 100.
  (add-hook 'minibuffer-setup-hook #'j/ex-completion-h 110))

;;; Automatic saving
(defvar-local j/save-timer nil)
(defvar-local j/save-failed nil)
(defun j/cancel-save-h ()
  (when (timerp j/save-timer) (cancel-timer j/save-timer))
  (setq j/save-timer nil))
(defun j/file-writable-p ()
  (if (file-exists-p buffer-file-name)
      (file-writable-p buffer-file-name)
    (let ((dir (file-name-directory buffer-file-name)))
      (while (and dir (not (file-exists-p dir)))
        (setq dir (file-name-directory (directory-file-name dir))))
      (and dir (file-directory-p dir) (file-writable-p dir)))))
(defun j/parser-error-p ()
  ;; Never create a parser or select a language just to save a file.
  (and (fboundp 'treesit-parser-list)
       (cl-some (lambda (parser)
                  (treesit-node-check (treesit-parser-root-node parser) 'has-error))
                (treesit-parser-list))))
(defun j/reset-save-failure-h ()
  (setq j/save-failed nil))
(defun j/save-buffer-h ()
  (j/cancel-save-h)
  (when (and buffer-file-name (buffer-modified-p)
             (not buffer-read-only) (not j/save-failed)
             (not (minibufferp)) (not (derived-mode-p 'special-mode 'dired-mode))
             (not (file-remote-p buffer-file-name)))
    (condition-case err
        (when (and (j/file-writable-p)
                   (verify-visited-file-modtime (current-buffer))
                   (not (j/parser-error-p)))
          (make-directory (file-name-directory buffer-file-name) t)
          ;; Keep Doom's hooks; defer interactive decisions to a manual save.
          (cl-letf (((symbol-function 'yes-or-no-p)
                     (lambda (&rest _) (error "Automatic save requires confirmation")))
                    ((symbol-function 'y-or-n-p)
                     (lambda (&rest _) (error "Automatic save requires confirmation"))))
            (save-buffer)))
      (error
       (setq j/save-failed t)
       (message "Automatic save paused for %s: %s; save manually to resume"
                (buffer-name) (error-message-string err))))))
(defun j/save-after-pause (buffer)
  (when (buffer-live-p buffer)
    (with-current-buffer buffer
      (setq j/save-timer nil)
      (when (and (bound-and-true-p evil-local-mode) (eq evil-state 'normal))
        (j/save-buffer-h)))))
(defun j/schedule-save-h (&rest _)
  (j/cancel-save-h)
  (when (and buffer-file-name (not j/save-failed)
             (not buffer-read-only) (not (minibufferp))
             (not (derived-mode-p 'special-mode 'dired-mode))
             (not (file-remote-p buffer-file-name))
             (bound-and-true-p evil-local-mode) (eq evil-state 'normal))
    (setq j/save-timer
          (run-with-idle-timer 0.5 nil #'j/save-after-pause (current-buffer)))))
;; Named hooks and one-shot buffer-local timers make reloading idempotent.
(dolist (buffer (buffer-list))
  (with-current-buffer buffer (j/cancel-save-h)))
(add-hook 'after-change-functions #'j/schedule-save-h)
(add-hook 'evil-insert-state-exit-hook #'j/save-buffer-h)
(add-hook 'after-save-hook #'j/reset-save-failure-h)
(add-hook 'kill-buffer-hook #'j/cancel-save-h)
