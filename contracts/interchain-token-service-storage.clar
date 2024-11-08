
;; title: interchain-token-service-storage
(define-constant OWNER tx-sender)
(define-constant PROXY .interchain-token-service)
(define-constant ITS-HUB-ROUTING-IDENTIFIER "hub")

(define-constant ERR-UNAUTHORIZED (err u20111))

(define-constant ERR-STARTED (err u24051))
(define-constant ERR-NOT-STARTED (err u24052))
(define-constant ERR-NOT-AUTHORIZED (err u21051))
(define-constant ERR-PAUSED (err u21052))
(define-constant ERR-INVALID-DESTINATION-ADDRESS (err u22068))
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) 0x0000000000000000000000000000000000000000)))

(define-private (is-proxy) (is-eq contract-caller PROXY))
(define-private (is-impl) (is-eq contract-caller (var-get impl)))

(define-private (is-proxy-or-impl) (or (is-proxy) (is-impl)))



;; ######################
;; ######################
;; ####### Storage ######
;; ######################
;; ######################

;; Constructor flag
(define-data-var is-started bool false)

(define-read-only (get-is-started) (var-get is-started))

(define-public (start) 
    (begin
        (asserts! (is-proxy) ERR-UNAUTHORIZED)
        (ok (var-set is-started true))
    )
)



;; ITS implementation contract address 
(define-data-var impl principal .interchain-token-service-impl)

(define-read-only (get-impl) (var-get impl))
(define-read-only (get-proxy) PROXY)


(define-public (set-impl (new-impl principal)) 
    (begin
        (asserts! (is-proxy) ERR-UNAUTHORIZED)
        (ok (var-set impl new-impl))
    )
)


;; ITS operator
(define-data-var operator principal contract-caller)

(define-read-only (get-operator) (var-get operator))

(define-public (set-operator (new-operator principal)) 
    (begin
        (asserts! (is-proxy-or-impl) ERR-UNAUTHORIZED)
        (ok (var-set operator new-operator))
    )
)

(define-data-var is-paused bool false)

(define-public (set-paused (status bool))
    (begin
        (asserts! (is-proxy-or-impl) ERR-UNAUTHORIZED)
        (ok (var-set is-paused status))))

(define-read-only (get-is-paused)
    (ok (var-get is-paused)))




;; ####################
;; ####################
;; ### address tracking ###
;; ####################
;; ####################

(define-map trusted-chain-address (string-ascii 20) (string-ascii 128))


;; Gets the trusted address at a remote chain
;; @param chain Chain name of the remote chain
;; @return trustedAddress_ The trusted address for the chain. Returns '' if the chain is untrusted
(define-read-only (get-trusted-address (chain (string-ascii 20)))
    (map-get? trusted-chain-address chain))

;; Gets the trusted address hash for a chain
;; @param chain Chain name
;; @return trustedAddressHash_ the hash of the trusted address for that chain
(define-read-only (get-trusted-address-hash (chain (string-ascii 20)))
    (ok (match (map-get? trusted-chain-address chain)
            trusted-address (some (keccak256 (unwrap-panic (to-consensus-buff? trusted-address))))
            none)))

;; Checks whether the interchain sender is a trusted address
;; @param chain Chain name of the sender
;; @param address_ Address of the sender
;; @return bool true if the sender chain/address are trusted, false otherwise

(define-read-only (is-trusted-address (chain-name (string-ascii 20)) (address (string-ascii 128)))
    (is-eq address (default-to "" (map-get? trusted-chain-address chain-name))))

(define-read-only (is-trusted-chain (chain-name (string-ascii 20)))
    (is-some (map-get? trusted-chain-address chain-name)))

;; Sets the trusted address and its hash for a remote chain
;; @param chain Chain name of the remote chain
;; @param address_ the string representation of the trusted address
;; #[allow(unchecked_data)]
(define-public (set-trusted-address (chain-name (string-ascii 20)) (address (string-ascii 128)))
    (begin
        (asserts! (is-proxy-or-impl) ERR-NOT-AUTHORIZED)
        (ok (map-set trusted-chain-address chain-name address))))

;; Remove the trusted address of the chain.
;; @param chain Chain name that should be made untrusted
;; #[allow(unchecked_data)]
(define-public (remove-trusted-address  (chain-name  (string-ascii 20)))
    (begin
        (asserts! (is-proxy-or-impl) ERR-NOT-AUTHORIZED)
        (ok (map-delete trusted-chain-address chain-name))))

(define-private (extract-and-set-trusted-address
    (entry {chain-name: (string-ascii 20), address: (string-ascii 128)}))
        (map-set trusted-chain-address (get chain-name entry) (get address entry)))

(define-public (set-trusted-addresses (trusted-chain-names-addresses (list 50 {chain-name: (string-ascii 20), address: (string-ascii 128)})))
    (begin 
        (asserts! (is-proxy) ERR-UNAUTHORIZED)
        (map extract-and-set-trusted-address trusted-chain-names-addresses)
        (ok true))
)


;; Token managers


(define-map token-managers (buff 32)
    {
        manager-address: principal,
        token-type: uint,
    })


(define-read-only (get-token-info (token-id (buff 32)))
    (map-get? token-managers token-id))

(define-public (insert-token-manager (token-id (buff 32)) (manager-address principal) (token-type uint))
    (begin
        (asserts! (is-proxy-or-impl) ERR-NOT-AUTHORIZED)
        (ok (map-insert token-managers token-id {
            manager-address: manager-address,
            token-type: token-type
        }))
    ))


(define-data-var interchain-token-factory principal NULL-ADDRESS)
(define-data-var gas-service principal NULL-ADDRESS)
(define-data-var its-contract-name (string-ascii 128) "")
(define-data-var its-hub-chain (string-ascii 20) "axelarnet")


(define-read-only (get-gateway)
    (contract-call? .gateway-storage get-impl)) 

(define-read-only (get-token-factory)
    (var-get interchain-token-factory))

(define-public (set-token-factory (factory principal)) 
    (begin 
        (asserts! (is-proxy-or-impl) ERR-NOT-AUTHORIZED)
        (var-set interchain-token-factory factory)
        (ok true)))

(define-read-only (get-gas-service)
    (var-get gas-service)) 

(define-public (set-gas-service (address principal)) 
    (begin 
        (asserts! (is-proxy-or-impl) ERR-NOT-AUTHORIZED)
        (var-set gas-service address)
        (ok true)))


(define-read-only (get-its-hub-chain)
    (var-get its-hub-chain)) 

(define-public (set-its-hub-chain (chain-name (string-ascii 20))) 
    (begin 
        (asserts! (is-proxy-or-impl) ERR-NOT-AUTHORIZED)
        (var-set its-hub-chain chain-name)
        (ok true)))

(define-read-only (get-its-contract-name)
    (var-get its-contract-name)) 

(define-public (set-its-contract-name (contract-name (string-ascii 128))) 
    (begin 
        (asserts! (is-proxy-or-impl) ERR-NOT-AUTHORIZED)
        (var-set its-contract-name contract-name)
        (ok true)))
