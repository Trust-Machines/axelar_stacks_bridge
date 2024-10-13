
;; title: interchain-address-tracker
;; version:
;; summary:
;; description: Tracks the trusted address for each chain for the ITS

(define-constant CHAIN-NAME "Stacks")
(define-constant ITS .interchain-token-service)
(define-constant ERR-NOT-AUTHORIZED (err u1151))
(define-map trusted-chain-address (string-ascii 18) (string-ascii 48))

;; Gets the name of the chain this is deployed at
(define-read-only (get-chain-name) 
    (ok CHAIN-NAME))


;; Gets the trusted address at a remote chain
;; @param chain Chain name of the remote chain
;; @return trustedAddress_ The trusted address for the chain. Returns '' if the chain is untrusted
(define-read-only (get-trusted-address (chain (string-ascii 18))) 
    (ok (map-get? trusted-chain-address chain)))

;; Gets the trusted address hash for a chain
;; @param chain Chain name
;; @return trustedAddressHash_ the hash of the trusted address for that chain
(define-read-only (get-trusted-address-hash (chain (string-ascii 18))) 
    (ok (match (map-get? trusted-chain-address chain) 
            trusted-address (some (keccak256 (unwrap-panic (to-consensus-buff? trusted-address)))) 
            none)))

;; Checks whether the interchain sender is a trusted address
;; @param chain Chain name of the sender
;; @param address_ Address of the sender
;; @return bool true if the sender chain/address are trusted, false otherwise

(define-read-only (is-trusted-address (chain-name (string-ascii 18)) (address (string-ascii 48))) 
    (ok (is-eq address (default-to "" (map-get? trusted-chain-address chain-name)))))

;; Sets the trusted address and its hash for a remote chain
;; @param chain Chain name of the remote chain
;; @param address_ the string representation of the trusted address
(define-public (set-trusted-address (chain-name (string-ascii 18)) (address (string-ascii 48)))
    (begin
        (asserts! (is-eq tx-sender ITS) ERR-NOT-AUTHORIZED)
        (print {
            type: "trusted-address-set",
            chain: chain-name,
            address: address
        })
        (ok (map-set trusted-chain-address chain-name address))))

;; Remove the trusted address of the chain.
;; @param chain Chain name that should be made untrusted
(define-public (remove-trusted-address  (chain-name  (string-ascii 18)))
    (begin
        (asserts!  (is-eq tx-sender ITS) ERR-NOT-AUTHORIZED)
        (print {
            type: "trusted-address-removed",
            chain: chain-name
            })
            (ok (map-delete trusted-chain-address chain-name))))