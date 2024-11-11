
;; title: interchain-token-service
;; version:
;; summary:
;; description:
(use-trait its-trait .traits.interchain-token-service-trait)

;; ######################
;; ######################
;; ### Proxy Calls ######
;; ######################
;; ######################

(define-constant ERR-INVALID-IMPL (err u20211))

(define-private (is-correct-impl (interchain-token-service-impl <its-trait>)) 
    (is-eq 
        (contract-call? .interchain-token-service-storage get-service-impl) 
        (contract-of interchain-token-service-impl)))

;; traits
;;
(use-trait sip-010-trait .traits.sip-010-trait)
(use-trait token-manager-trait .traits.token-manager-trait)
(use-trait interchain-token-executable-trait .traits.interchain-token-executable-trait)
(use-trait native-interchain-token-trait .traits.native-interchain-token-trait)
(use-trait gateway-trait .traits.gateway-trait)

;; token definitions
;;

;; constants
;;
(define-constant ERR-NOT-AUTHORIZED (err u21051))

(define-constant OWNER tx-sender)

(define-public (set-paused (its-impl <its-trait>) (status bool))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl set-paused status contract-caller)))


;; ####################
;; ####################
;; ### Operatorship ###
;; ####################
;; ####################

;; Transfers operatorship to a new account
(define-public (transfer-operatorship (its-impl <its-trait>) (new-operator principal))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl transfer-operatorship new-operator contract-caller)
    )
)

;; ####################
;; ####################
;; ### address tracking ###
;; ####################
;; ####################

;; Sets the trusted address and its hash for a remote chain
;; @param chain Chain name of the remote chain
;; @param address_ the string representation of the trusted address
;; #[allow(unchecked_data)]
(define-public (set-trusted-address (its-impl <its-trait>) (chain-name (string-ascii 20)) (address (string-ascii 128)))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl set-trusted-address chain-name address contract-caller)))

;; Remove the trusted address of the chain.
;; @param chain Chain name that should be made untrusted
;; #[allow(unchecked_data)]
(define-public (remove-trusted-address (its-impl <its-trait>) (chain-name  (string-ascii 20)))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl remove-trusted-address chain-name contract-caller)))

(define-public (deploy-token-manager
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt (buff 32))
        (destination-chain (string-ascii 20))
        (token-manager-type uint)
        (params (buff 62000))
        (token-manager <token-manager-trait>)
        (gas-value uint)
    )
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl deploy-token-manager gateway-impl salt destination-chain token-manager-type params token-manager gas-value contract-caller)))
;; Used to deploy remote custom TokenManagers.
;; @dev At least the `gasValue` amount of native token must be passed to the function call. `gasValue` exists because this function can be
;; part of a multicall involving multiple functions that could make remote contract calls.
;; @param salt The salt to be used during deployment.
;; @param destinationChain The name of the chain to deploy the TokenManager and standardized token to.
;; @param tokenManagerType The type of token manager to be deployed. Cannot be NATIVE_INTERCHAIN_TOKEN.
;; @param params The params that will be used to initialize the TokenManager.
;; @param gasValue The amount of native tokens to be used to pay for gas for the remote deployment.
;; @return tokenId The tokenId corresponding to the deployed TokenManager.
(define-public (process-deploy-token-manager-from-external-chain
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token-manager <token-manager-trait>)
        (payload (buff 63000))
        (wrapped-payload  (optional {
            source-chain: (string-ascii 20),
            source-address: (string-ascii 128),
            message-id: (string-ascii 128),
            payload: (buff 63000),
        }))
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl process-deploy-token-manager-from-external-chain gateway-impl token-manager payload wrapped-payload gas-value contract-caller)))


(define-public (process-deploy-token-manager-from-stacks
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>) 
        (message-id (string-ascii 128))
        (source-chain (string-ascii 20))
        (source-address (string-ascii 128))
        (payload (buff 64000)))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl process-deploy-token-manager-from-stacks gateway-impl message-id source-chain source-address payload contract-caller)))

;; Deploys an interchain token on a destination chain.
;; @param salt The salt to be used during deployment.
;; @param name The name of the token.
;; @param symbol The symbol of the token.
;; @param decimals The number of decimals of the token.
;; @param minter The minter address for the token.
;; @param destinationChain The destination chain where the token will be deployed.
;; @param gasValue The amount of gas to be paid for the transaction.
(define-public (deploy-remote-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt (buff 32))
        (destination-chain (string-ascii 20))
        (name (string-ascii 32))
        (symbol (string-ascii 32))
        (decimals uint)
        (minter (buff 128))
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl deploy-remote-interchain-token gateway-impl salt destination-chain name symbol decimals minter gas-value contract-caller)))

(define-public (deploy-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt (buff 32))
        (token <native-interchain-token-trait>)
        (supply uint)
        (minter (optional principal))
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl deploy-interchain-token gateway-impl salt token supply minter gas-value contract-caller)))

;; Initiates an interchain transfer of a specified token to a destination chain.
;; @dev The function retrieves the TokenManager associated with the tokenId.
;; @param tokenId The unique identifier of the token to be transferred.
;; @param destinationChain The destination chain to send the tokens to.
;; @param destinationAddress The address on the destination chain to send the tokens to.
;; @param amount The amount of tokens to be transferred.
;; @param metadata Optional metadata for the call for additional effects (such as calling a destination contract).
(define-public (interchain-transfer
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 20))
        (destination-address (buff 128))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 62000)
        })
        (gas-value uint)
    )
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl interchain-transfer gateway-impl token-manager token token-id destination-chain destination-address amount metadata gas-value contract-caller)))

(define-public (call-contract-with-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 20))
        (destination-address (buff 128))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 62000)
        })
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl call-contract-with-interchain-token gateway-impl token-manager token token-id destination-chain destination-address amount metadata gas-value contract-caller)))




(define-public (execute-deploy-token-manager
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (source-chain (string-ascii 20))
        (message-id (string-ascii 128))
        (source-address (string-ascii 128))
        (payload (buff 63000))
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>)
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl execute-deploy-token-manager gateway-impl source-chain message-id source-address payload token token-manager gas-value contract-caller)))

(define-public (execute-deploy-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (source-chain (string-ascii 20))
        (message-id (string-ascii 128))
        (source-address (string-ascii 128))
        (token-address <native-interchain-token-trait>)
        (payload (buff 62000))
        (gas-value uint))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl execute-deploy-interchain-token gateway-impl source-chain message-id source-address token-address payload gas-value contract-caller)))

(define-public (execute-receive-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (source-chain (string-ascii 20))
        (message-id (string-ascii 128))
        (source-address (string-ascii 128))
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (payload (buff 64000))
        (destination-contract (optional <interchain-token-executable-trait>))
    )
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl execute-receive-interchain-token gateway-impl source-chain message-id source-address token-manager token payload destination-contract contract-caller)))


(define-public (set-flow-limit 
    (its-impl <its-trait>)
    (token-id (buff 32))
    (token-manager <token-manager-trait>)
    (limit uint))
    (begin
        (asserts! (is-correct-impl its-impl) ERR-INVALID-IMPL)
        (contract-call? its-impl set-flow-limit token-id token-manager limit contract-caller)))

;; ######################
;; ######################
;; ### Upgradability ####
;; ######################
;; ######################

(define-constant GOVERNANCE .governance)

(define-public (updgrade-impl (its-impl <its-trait>))
    (let
        (
            (prev (contract-call? .interchain-token-service-storage get-service-impl))
            (new (contract-of its-impl))
        ) 
        (asserts! (is-eq contract-caller GOVERNANCE) ERR-NOT-AUTHORIZED)
        (try! (contract-call? .interchain-token-service-storage set-service-impl new))
        (print {
            type: "interchain-token-service-impl-updgraded",
            prev: prev,
            new: new
        })
        (ok true)
    )
)


;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

(define-constant ERR-STARTED (err u24051))
(define-constant ERR-NOT-STARTED (err u24052))


(define-read-only (get-is-started) 
    (contract-call? .interchain-token-service-storage get-is-started))


;; Constructor function
;; @returns (response true) or reverts
(define-public (setup
    (its-contract-address-name (string-ascii 128))
    (gas-service-address principal)
    (operator-address principal)
    (trusted-chain-names-addresses (list 50 {chain-name: (string-ascii 20), address: (string-ascii 128)}))
    (hub-chain (string-ascii 20))
    (its-impl (optional principal))
)
    (begin
        (asserts! (not (get-is-started)) ERR-STARTED)
        (asserts! (is-eq contract-caller OWNER) ERR-NOT-AUTHORIZED)
        (try! (contract-call? .interchain-token-service-storage set-its-contract-name its-contract-address-name))
        (try! (contract-call? .interchain-token-service-storage set-gas-service gas-service-address))
        (try! (contract-call? .interchain-token-service-storage set-operator operator-address))
        (try! (contract-call? .interchain-token-service-storage set-its-hub-chain hub-chain))
        (try! (contract-call? .interchain-token-service-storage set-trusted-addresses trusted-chain-names-addresses))
        (try! (match its-impl impl (contract-call? .interchain-token-service-storage set-service-impl impl) (ok true)))
        (try! (contract-call? .interchain-token-service-storage start))
        (ok true)
    )
)
