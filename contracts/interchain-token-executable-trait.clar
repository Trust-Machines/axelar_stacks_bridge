
;; title: interchain-token-executable-trait
;; version:
;; summary:
;; description:

;; traits
;;
(define-trait interchain-token-executable-trait (
    (execute-with-interchain-token (
        ;; commandId,
        ;; sourceChain,
        ;; sourceAddress,
        ;; data,
        ;; tokenId,
        ;; tokenAddress,
        ;; amount
        (string-ascii 128)
        (string-ascii 32)
        (buff 200)
        (buff 1024)
        (buff 32)
        principal
        uint
        ;; must return keccak256('its-execute-success')
    ) (response (buff 32) uint))
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

