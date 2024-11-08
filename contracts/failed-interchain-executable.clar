
;; title: failed-interchain-executable
;; version:
;; summary:
;; description:

;; traits
;;
(impl-trait .traits.interchain-token-executable-trait)

(define-constant ERR-NOT-AUTHORIZED (err u1151))
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

(define-public (execute-with-interchain-token
        (source-chain (string-ascii 20))
        (message-id (string-ascii 128))
        (source-address (buff 128))
        (payload (buff 64000))
        (token-id (buff 32))
        (tokenAddress principal)
        (amount uint))
    (begin
        (asserts! (is-eq contract-caller .interchain-token-service-impl) ERR-NOT-AUTHORIZED)
        (try! (if true (err u8051) (ok u0)))
        (ok (keccak256 (unwrap-panic (to-consensus-buff? "its-execute-success"))))))
;; read only functions
;;

;; private functions
;;

