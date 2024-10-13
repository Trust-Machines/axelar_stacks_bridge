
;; title: token-manager-trait
;; version:
;; summary:
;; description:

;; traits
;;
(define-trait token-manager-trait (
    (add-flow-limiter (principal) (response bool uint))
    (remove-flow-limiter ( principal) (response bool uint))
    (is-flow-limiter (principal) (response bool uint))
    (get-flow-limit () (response uint uint))
    (set-flow-limit (uint) (response bool uint))
    (get-flow-out-amount () (response uint uint))
    (get-flow-in-amount ()  (response uint uint))
))
;; token definitions
;;

;; constants
;;

;; data vars
;;

;; data maps
;;

;; public functions
;;

;; read only functions
;;

;; private functions
;;

