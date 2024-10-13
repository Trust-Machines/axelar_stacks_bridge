
;; title: mintable-burnable-sip-010
;; version:
;; summary:
;; description:

;; traits
;;
(impl-trait .mintable-burnable-trait.mintable-burnable)
;;   (transfer (uint principal principal (optional (buff 34))) (response bool uint))

;; token definitions
;;

(define-fungible-token itscoin)
;; constants
;;
(define-constant MINTER .interchain-token-service)
(define-constant ERR-NOT-AUTHORIZED (err u1051))
(define-constant ERR-INVALID-PARAMS (err u1052))
(define-constant ERR-YOU-POOR (err u1053))
;; data vars
;;

;; data maps
;;

;; public functions
;;
(define-public (burn (from principal) (amount uint))
    (begin
        (asserts! (is-eq MINTER tx-sender) ERR-NOT-AUTHORIZED)
        (asserts! (> amount u0) ERR-INVALID-PARAMS)
        (ft-burn? itscoin amount from)
    )
)

(define-public (mint (from principal) (amount uint))
    (begin
        (asserts! (is-eq MINTER tx-sender) ERR-NOT-AUTHORIZED)
        (asserts! (> amount u0) ERR-INVALID-PARAMS)
        (ft-mint? itscoin amount from)
    )
)

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender) ERR-NOT-AUTHORIZED)
        (asserts! (not (is-eq to tx-sender)) ERR-INVALID-PARAMS)
        (asserts! (>= (ft-get-balance itscoin from) amount) ERR-YOU-POOR)
        (print (default-to 0x memo))
        (ft-transfer? itscoin amount from to)))
;; read only functions
;;
(define-read-only (get-balance (address principal)) 
    (ok (ft-get-balance itscoin address)))

(define-read-only (get-decimals)
    (ok u6)
)

(define-read-only (get-total-supply)
    (ok (ft-get-supply itscoin)))

(define-read-only (get-token-uri) 
    (ok none))

(define-read-only (get-name)
    (ok "itscoin"))

(define-read-only (get-symbol)
    (ok "ITS"))
;; private functions
;;

