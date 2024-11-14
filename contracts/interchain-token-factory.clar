
;; title: interchain-token-factory
;; version:
;; summary:
;; description:
;; This contract is responsible for deploying new interchain tokens and managing their token managers.

;; traits
;;
(use-trait sip-010-trait .traits.sip-010-trait)
(use-trait token-manager-trait .traits.token-manager-trait)
(use-trait native-interchain-token-trait .traits.native-interchain-token-trait)
(use-trait gateway-trait .traits.gateway-trait)
(use-trait itf-trait .traits.interchain-token-factory-trait)
(use-trait its-trait .traits.interchain-token-service-trait)
(impl-trait .traits.proxy-trait)
;; token definitions
;;

(define-constant ERR-INVALID-IMPL (err u210211))
(define-constant ERR-NOT-AUTHORIZED (err u210212))

(define-private (is-correct-impl (interchain-token-factory-impl <itf-trait>)) 
    (is-eq 
        (contract-call? .interchain-token-service-storage get-factory-impl) 
        (contract-of interchain-token-factory-impl)))

;; Registers a canonical token as an interchain token and deploys its token manager.
;; @param tokenAddress The address of the canonical token.
;; @return tokenId The tokenId corresponding to the registered canonical token.
(define-public (register-canonical-interchain-token
        (itf-impl <itf-trait>)
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token-address <sip-010-trait>)
        (token-manager-address <token-manager-trait>)
        (gas-value uint)
    )
    (begin
        (asserts! (is-correct-impl itf-impl) ERR-INVALID-IMPL)
        (contract-call?
            itf-impl
                register-canonical-interchain-token
                gateway-impl
                its-impl
                token-address
                token-manager-address
                gas-value
                contract-caller)
    ))


;; Deploys a canonical interchain token on a remote chain.
;; @param originalTokenAddress The address of the original token on the original chain.
;; @param destinationChain The name of the chain where the token will be deployed.
;; @param gasValue The gas amount to be sent for deployment.
;; @return tokenId The tokenId corresponding to the deployed InterchainToken.
;; #[allow(unchecked_data)]
(define-public (deploy-remote-canonical-interchain-token
        (itf-impl <itf-trait>)
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token <sip-010-trait>)
        (destination-chain (string-ascii 20))
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl itf-impl) ERR-INVALID-IMPL)
        (contract-call? itf-impl deploy-remote-canonical-interchain-token 
            gateway-impl
            its-impl
            token
            destination-chain
            gas-value
            contract-caller)
    )
)

(define-public (deploy-interchain-token
        (itf-impl <itf-trait>)
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt_ (buff 32))
        (token <native-interchain-token-trait>)
        (initial-supply uint)
        (minter principal)
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl itf-impl) ERR-INVALID-IMPL)
        (contract-call? itf-impl deploy-interchain-token
            gateway-impl
            its-impl
            salt_
            token
            initial-supply
            minter
            gas-value
            contract-caller)))

;; This will only be a risk if the user deploying the token remotely
;; is deploying an existing malicious token on stacks
;; basically getting themself rekt
;; #[allow(unchecked_data)]

;; TODO: add destination minter https://github.com/axelarnetwork/interchain-token-service/pull/301/files
(define-public (deploy-remote-interchain-token
        (itf-impl <itf-trait>)
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt_ (buff 32))
        (minter_ (buff 128))
        (destination-chain (string-ascii 20))
        (gas-value uint)
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>)
)
    (begin
        (asserts! (is-correct-impl itf-impl) ERR-INVALID-IMPL)
        (contract-call? itf-impl deploy-remote-interchain-token
            gateway-impl
            its-impl
            salt_
            minter_
            destination-chain
            gas-value
            token
            token-manager
            contract-caller)))


;; ######################
;; ######################
;; ### Upgradability ####
;; ######################
;; ######################

(define-public (set-impl (itf-impl principal))
    (let
        (
            (governance-impl (contract-call? .gateway-storage get-governance))
            (prev (contract-call? .interchain-token-service-storage get-factory-impl))
        ) 
        (asserts! (is-eq contract-caller governance-impl) ERR-NOT-AUTHORIZED)
        (try! (contract-call? .interchain-token-service-storage set-factory-impl itf-impl))
        (print {
            type: "interchain-token-factory-impl-updgraded",
            prev: prev,
            new: itf-impl
        })
        (ok true)
    )
)

(define-public (set-governance (governance principal))
    (ok true))

;; General purose proxy call 
(define-public (call (itf-impl <itf-trait>) (fn (string-ascii 32)) (data (buff 65000))) 
    (begin 
        (asserts! (is-eq (is-correct-impl itf-impl) true) ERR-INVALID-IMPL)
        (contract-call? itf-impl dispatch fn data contract-caller)
    )
)
