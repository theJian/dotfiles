(ros:quicklisp)
(ql:quickload '(:cl-ppcre :uiop) :silent t)

(defpackage :claude-profile
  (:use :cl)
  (:export :main))

(in-package :claude-profile)

;;; Constants
(defvar *env-key-re* "^[A-Za-z_][A-Za-z0-9_]*$")
(defvar *profile-re* "^[A-Za-z0-9._-]+$")
(defvar *sensitive-terms* '("KEY" "TOKEN" "SECRET" "PASSWORD" "CREDENTIAL" "AUTH"))

;;; Helpers
(defun die (message &optional (code 1))
  (format *error-output* "claude-profile: ~A~%" message)
  (sb-ext:exit :code code))

(defun env-key-p (key)
  (and (plusp (length key))
       (cl-ppcre:scan *env-key-re* key)))

;;; Shell-style argument parsing (like Python's shlex.split with posix=True)
(defun shell-split (string)
  "Split STRING into tokens respecting single/double quotes and backslash escapes."
  (when (zerop (length string))
    (return-from shell-split nil))
  (let ((tokens nil)
        (current (make-array 0 :element-type 'character :adjustable t :fill-pointer 0))
        (i 0)
        (len (length string))
        (in-single nil)
        (in-double nil))
    (loop while (< i len) do
      (let ((ch (char string i)))
        (cond
          ((and (eql ch #\\) (not in-single))
           (incf i)
           (when (< i len)
             (vector-push-extend (char string i) current)
             (incf i)))
          ((and (eql ch #\') (not in-double))
           (setf in-single (not in-single))
           (incf i))
          ((and (eql ch #\") (not in-single))
           (setf in-double (not in-double))
           (incf i))
          ((and (member ch '(#\Space #\Tab #\Newline #\Return))
                (not in-single) (not in-double))
           (when (plusp (length current))
             (push (copy-seq current) tokens)
             (setf (fill-pointer current) 0))
           (incf i))
          (t
           (vector-push-extend ch current)
           (incf i)))))
    (when (or in-single in-double)
      (die "unterminated quote in value"))
    (when (plusp (length current))
      (push (copy-seq current) tokens))
    (nreverse tokens)))

;;; Argument parsing
(defun parse-args (argv)
  "Parse command-line arguments. Returns (values profile profile-dir list-p show-p passthrough)."
  (let ((profile nil)
        (profile-dir nil)
        (list-p nil)
        (show-p nil)
        (passthrough nil))
    (loop with i = 0
          while (< i (length argv))
          do (let ((arg (elt argv i)))
               (cond
                 ((or (string= arg "-e") (string= arg "--profile"))
                  (incf i)
                  (when (>= i (length argv))
                    (die "--profile requires a profile name"))
                  (setf profile (elt argv i)))
                 ((uiop:string-prefix-p "--profile=" arg)
                  (setf profile (subseq arg (1+ (position #\= arg)))))
                 ((uiop:string-prefix-p "-e=" arg)
                  (setf profile (subseq arg (1+ (position #\= arg)))))
                 ((or (string= arg "--profile-list") (string= arg "--list-profiles"))
                  (setf list-p t))
                 ((string= arg "--profile-show")
                  (setf show-p t))
                 ((string= arg "--profile-dir")
                  (incf i)
                  (when (>= i (length argv))
                    (die "--profile-dir requires a path"))
                  (setf profile-dir (elt argv i)))
                 ((uiop:string-prefix-p "--profile-dir=" arg)
                  (setf profile-dir (subseq arg (1+ (position #\= arg)))))
                 (t (push arg passthrough)))
               (incf i)))
    (values profile profile-dir list-p show-p (nreverse passthrough))))

;;; Profile directory
(defun get-profile-dir (profile-dir-arg)
  "Resolve profile directory from argument or default."
  (if profile-dir-arg
      (uiop:ensure-absolute-pathname
       (uiop:ensure-directory-pathname
        (uiop:parse-native-namestring profile-dir-arg)))
      (merge-pathnames (make-pathname :directory '(:relative ".claude" "profiles"))
                       (user-homedir-pathname))))

(defun validate-profile-name (name)
  "Validate a profile name and die if invalid."
  (when (zerop (length name))
    (die "profile name cannot be empty"))
  (unless (cl-ppcre:scan *profile-re* name)
    (die "invalid profile name. Use only letters, numbers, dot, dash, or underscore."))
  (when (or (string= name ".") (string= name ".."))
    (die "invalid profile name")))

(defun profile-path (profile-dir profile)
  "Get the .env file path for a profile."
  (validate-profile-name profile)
  (merge-pathnames (make-pathname :name profile :type "env") profile-dir))

;;; Environment file parsing
(defun parse-env-file (path)
  "Parse a .env file and return an alist of (key . value). Value is NIL for __unset__."
  (unless (probe-file path)
    (die (format nil "profile does not exist: ~A" path)))
  (let ((lines (handler-case (uiop:read-file-lines path)
                 (error (e) (die (format nil "cannot read profile ~A: ~A" path e)))))
        (env nil))
    (loop for raw-line in lines
          for line-num from 1
          do (let ((line (string-trim '(#\Space #\Tab) raw-line)))
               (when (and (plusp (length line))
                          (not (char= (char line 0) #\#)))
                 (when (uiop:string-prefix-p "export " line)
                   (setf line (string-trim '(#\Space #\Tab) (subseq line 7))))
                 (let ((eq-pos (position #\= line)))
                   (unless eq-pos
                     (die (format nil "~A:~A: expected KEY=VALUE" path line-num)))
                   (let ((key (string-trim '(#\Space #\Tab) (subseq line 0 eq-pos)))
                         (value (string-trim '(#\Space #\Tab) (subseq line (1+ eq-pos)))))
                     (unless (env-key-p key)
                       (die (format nil "~A:~A: invalid env var name: ~A" path line-num key)))
                     (if (string= value "__unset__")
                         (push (cons key nil) env)
                         (let ((parsed (shell-split value)))
                           (cond
                             ((null parsed) (push (cons key "") env))
                             ((= (length parsed) 1) (push (cons key (first parsed)) env))
                             (t (die (format nil "~A:~A: value contains unquoted spaces" path line-num)))))))))))
    (nreverse env)))

;;; Profile listing
(defun list-profiles (profile-dir)
  "List available profiles in the directory."
  (unless (uiop:directory-exists-p profile-dir)
    (return-from list-profiles nil))
  (sort (mapcar #'(lambda (p) (pathname-name p))
                (directory (merge-pathnames (make-pathname :name :wild :type "env") profile-dir)))
        #'string<))

(defun find-real-claude ()
  "Find the real claude binary from CLAUDE_REAL_BIN env var."
  (let ((real-bin (ros:getenv "CLAUDE_REAL_BIN")))
    (unless real-bin
      (die "CLAUDE_REAL_BIN is not set."))
    (let ((path (probe-file real-bin)))
      (unless path
        (die (format nil "CLAUDE_REAL_BIN points to missing file: ~A" real-bin)))
      (namestring path))))

;;; Sensitive value redaction
(defun sensitive-key-p (key)
  (let ((upper (string-upcase key)))
    (some #'(lambda (term) (search term upper)) *sensitive-terms*)))

(defun redact-value (key value)
  (if (null value)
      "__unset__"
      (if (sensitive-key-p key)
          (if (<= (length value) 8)
              "********"
              (concatenate 'string (subseq value 0 4) "********" (subseq value (- (length value) 4))))
          value)))

;;; Main entry point
(defun main (&rest argv)
  (declare (ignore argv))
  (let ((args (if (and ros:*argv* (string= (first ros:*argv*) "--"))
                  (rest ros:*argv*)
                  ros:*argv*)))
    (multiple-value-bind (profile profile-dir-arg should-list should-show passthrough)
        (parse-args args)
      (let* ((real-claude (find-real-claude))
             (profile-dir (get-profile-dir profile-dir-arg)))
        (when should-list
          (let ((profiles (list-profiles profile-dir)))
            (if (null profiles)
                (progn
                  (format t "No profiles found.~%")
                  (format t "Create one like: ~A~%" (merge-pathnames (make-pathname :name "kimi" :type "env") profile-dir)))
                (dolist (name profiles)
                  (format t "~A~%" name))))
          (sb-ext:exit :code 0))
        (unless profile
          (ros:exec (cons real-claude passthrough)))
        (let* ((path (profile-path profile-dir profile))
               (profile-env (parse-env-file path)))
          (when should-show
            (dolist (entry (sort (copy-list profile-env) #'string< :key #'car))
              (format t "~A=~A~%" (car entry) (redact-value (car entry) (cdr entry))))
            (sb-ext:exit :code 0))
          (dolist (entry profile-env)
            (if (null (cdr entry))
                (sb-posix:unsetenv (car entry))
                (sb-posix:setenv (car entry) (cdr entry) 1)))
          (sb-posix:setenv "CLAUDE_PROFILE" profile 1)
          (ros:exec (cons real-claude passthrough)))))))
