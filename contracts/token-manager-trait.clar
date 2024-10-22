
;; title: token-manager-trait
;; version:
;; summary:
;; description:

;; traits
;;

(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-trait token-manager-trait (
    (add-flow-limiter (principal) (response bool uint))
    (remove-flow-limiter ( principal) (response bool uint))
    (is-flow-limiter (principal) (response bool uint))
    (get-flow-limit () (response uint uint))
    (set-flow-limit (uint) (response bool uint))
    (get-flow-out-amount () (response uint uint))
    (get-flow-in-amount ()  (response uint uint))
    (take-token (<sip-010-trait> principal uint) (response bool uint))
    (give-token (<sip-010-trait> principal uint) (response bool uint))
    (get-token-address () (response principal uint))
    (get-token-type () (response uint uint))
    (is-minter (principal) (response bool uint))
    (get-operators () (response (list 2 principal) principal))
    (is-operator (principal) (response bool uint))
))
