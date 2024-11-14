
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
(use-trait its-trait .traits.interchain-token-service-trait)
(impl-trait .traits.interchain-token-factory-trait)
;; token definitions
;;

;; constants
;;


(define-constant PROXY .interchain-token-factory)

(define-private (is-proxy) (is-eq contract-caller PROXY))
;; This type is reserved for interchain tokens deployed by ITS, and can't be used by custom token managers.
;; @notice rares: same as mint burn in functionality will be custom tokens made by us
;; that are deployed outside of the contracts but registered by the ITS contract
(define-constant TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN u0)
;; The token will be minted/burned on transfers. The token needs to give mint permission to the token manager, but burning happens via an approval.
;; @notice rares: maybe will not be used
(define-constant TOKEN-TYPE-MINT-BURN-FROM u1)
;; The token will be locked/unlocked at the token manager.
(define-constant TOKEN-TYPE-LOCK-UNLOCK u2)
;; The token will be locked/unlocked at the token manager, which will account for any fee-on-transfer behaviour.
;; @notice rares: will not be used
(define-constant TOKEN-TYPE-LOCK-UNLOCK-FEE u3)
;; The token will be minted/burned on transfers. The token needs to give mint and burn permission to the token manager.
;; @notice rares: maybe will not be used
(define-constant TOKEN-TYPE-MINT-BURN u4)

(define-constant ERR-TOKEN-NOT-ENABLED (err u211051))
(define-constant ERR-INVALID-MINTER (err u211052))
(define-constant ERR-NOT-MINTER (err u211053))
(define-constant ERR-SERVICE-NOT-DEPLOYED (err u211054))
(define-constant ERR-GATEWAY-NOT-DEPLOYED (err u211055))
(define-constant ERR-TOKEN-NOT-DEPLOYED (err u211056))
(define-constant ERR-MANAGER-NOT-DEPLOYED (err u211057))
(define-constant ERR-NOT-PROXY (err u211058))




(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-factory"))))
(define-constant PREFIX-CANONICAL-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "canonical-token-salt"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-salt"))))
(define-constant PREFIX-GATEWAY-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "gateway-token-salt"))))
(define-constant NULL-BYTES 0x0000000000000000000000000000000000000000)
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) NULL-BYTES)))
(define-constant TOKEN-FACTORY-DEPLOYER NULL-ADDRESS)
(define-constant CHAIN-NAME "stacks")
(define-constant CHAIN-NAME-HASH (keccak256 (unwrap-panic (to-consensus-buff? CHAIN-NAME))))
(define-constant GATEWAY (contract-call? .interchain-token-service-storage get-gateway))
;; The address of the interchain token service.

;; Getter for the contract id.
;; @return bytes32 The contract id of this contract.
(define-read-only (get-contract-id)
    (ok CONTRACT-ID))

;; Calculates the salt for an interchain token.
;; @param chainNameHash_ The hash of the chain name.
;; @param deployer The address of the deployer.
;; @param salt A unique identifier to generate the salt.
;; @return tokenSalt The calculated salt for the interchain token.
(define-read-only (get-interchain-token-salt (chain-name-hash_ (buff 32)) (deployer principal) (salt (buff 32)))
        (keccak256
            (concat
                (concat PREFIX-INTERCHAIN-TOKEN-SALT chain-name-hash_)
                (concat
                    (unwrap-panic (to-consensus-buff? deployer))
                    salt))))

;; Calculates the salt for a canonical interchain token.
;; @param chain-name-hash The hash of the chain name.
;; @param token-address The address of the token.
;; @return salt The calculated salt for the interchain token.
(define-read-only (get-canonical-interchain-token-salt (chain-name-hash_ (buff 32)) (token-address principal))
        (keccak256
            (concat
                (concat PREFIX-CANONICAL-TOKEN-SALT chain-name-hash_)
                (unwrap-panic (to-consensus-buff? token-address)))))

;; Computes the ID for an interchain token based on the deployer and a salt.
;; @param deployer The address that deployed the interchain token.
;; @param salt A unique identifier used in the deployment process.
;; @return tokenId The ID of the interchain token.
(define-private (get-interchain-token-id (its-impl <its-trait>) (deployer principal) (salt (buff 32)))
    (contract-call? its-impl interchain-token-id TOKEN-FACTORY-DEPLOYER salt))


;; Computes the ID for a canonical interchain token based on its address.
;; @param tokenAddress The address of the canonical interchain token.
;; @return tokenId The ID of the canonical interchain token.
(define-private (get-canonical-interchain-token-id (its-impl <its-trait>) (token-address principal))
    (contract-call? its-impl interchain-token-id TOKEN-FACTORY-DEPLOYER (get-canonical-interchain-token-salt CHAIN-NAME-HASH token-address)))


;; Registers a canonical token as an interchain token and deploys its token manager.
;; @param tokenAddress The address of the canonical token.
;; @return tokenId The tokenId corresponding to the registered canonical token.
(define-public (register-canonical-interchain-token
        (gateway-impl <gateway-trait>)
        (interchain-token-service-impl <its-trait>)
        (token-address <sip-010-trait>)
        (token-manager-address <token-manager-trait>)
        (gas-value uint)
        (caller principal)
    )
    (begin
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (asserts! (is-ok (contract-call? token-manager-address get-token-address)) ERR-TOKEN-NOT-ENABLED)
        (contract-call?
            .interchain-token-service
                deploy-token-manager
                gateway-impl
                .interchain-token-service
                interchain-token-service-impl
                (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token-address))
                ""
                TOKEN-TYPE-LOCK-UNLOCK
                (unwrap-panic (to-consensus-buff? {
                    operator: none,
                    token-address: (contract-of token-address)
                }))
                token-manager-address
                gas-value)
    ))


;; Deploys a canonical interchain token on a remote chain.
;; @param originalTokenAddress The address of the original token on the original chain.
;; @param destinationChain The name of the chain where the token will be deployed.
;; @param gasValue The gas amount to be sent for deployment.
;; @return tokenId The tokenId corresponding to the deployed InterchainToken.
;; #[allow(unchecked_data)]
(define-public (deploy-remote-canonical-interchain-token
        (gateway-impl <gateway-trait>)
        (interchain-token-service-impl <its-trait>)
        (token <sip-010-trait>)
        (destination-chain (string-ascii 20))
        (gas-value uint)
        (caller principal))
    (let
        (
            (salt (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token)))
            (token-id (unwrap! (get-canonical-interchain-token-id interchain-token-service-impl (contract-of token)) ERR-SERVICE-NOT-DEPLOYED))
            (name (unwrap! (contract-call? token get-name) ERR-TOKEN-NOT-DEPLOYED))
            (symbol (unwrap! (contract-call? token get-symbol) ERR-TOKEN-NOT-DEPLOYED))
            (decimals (unwrap! (contract-call? token get-decimals) ERR-TOKEN-NOT-DEPLOYED))
            ;; This ensures that the token manager has been deployed by this address, so it's safe to trust it.
            (token_ (try! (contract-call? interchain-token-service-impl valid-token-address token-id)))
        )
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (contract-call? .interchain-token-service
            deploy-remote-interchain-token
            gateway-impl
            .interchain-token-service
            interchain-token-service-impl
            salt
            destination-chain
            name
            symbol
            decimals
            NULL-BYTES
            gas-value)
    )
)

(define-public (deploy-interchain-token
        (gateway-impl <gateway-trait>)
        (interchain-token-service-impl <its-trait>)
        (salt_ (buff 32))
        (token <native-interchain-token-trait>)
        (initial-supply uint)
        (minter principal)
        (gas-value uint)
        (caller principal))
    (let
        (
            (salt (get-interchain-token-salt CHAIN-NAME-HASH caller salt_))
        )
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (asserts! (not (is-eq (contract-call? .interchain-token-service-storage get-service-impl) minter)) ERR-INVALID-MINTER)
    (contract-call? .interchain-token-service deploy-interchain-token
        gateway-impl
        .interchain-token-service
        interchain-token-service-impl
        salt
        token
        initial-supply
        (some
        minter)
        gas-value)))

;; This will only be a risk if the user deploying the token remotely
;; is deploying an existing malicious token on stacks
;; basically getting themself rekt
;; #[allow(unchecked_data)]

;; TODO: add destination minter https://github.com/axelarnetwork/interchain-token-service/pull/301/files
(define-public (deploy-remote-interchain-token
        (gateway-impl <gateway-trait>)
        (interchain-token-service-impl <its-trait>)
        (salt_ (buff 32))
        (minter_ (buff 128))
        (destination-chain (string-ascii 20))
        (gas-value uint)
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>)
        (caller principal)
)
    (let (
        (salt (get-interchain-token-salt CHAIN-NAME-HASH caller salt_))
        (name (unwrap! (contract-call? token get-name) ERR-TOKEN-NOT-DEPLOYED))
        (symbol (unwrap! (contract-call? token get-symbol) ERR-TOKEN-NOT-DEPLOYED))
        (decimals (unwrap!  (contract-call? token get-decimals) ERR-TOKEN-NOT-DEPLOYED))
        (minter
            (if
                (not (is-eq NULL-BYTES minter_))
                (begin
                    (asserts! (unwrap!
                                (contract-call? token-manager is-minter caller)
                            ERR-MANAGER-NOT-DEPLOYED)
                        ERR-NOT-MINTER)
                    minter_)
                NULL-BYTES
        ))
    )
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (contract-call? .interchain-token-service deploy-remote-interchain-token
            gateway-impl
            .interchain-token-service
            interchain-token-service-impl
            salt
            destination-chain
            name
            symbol
            decimals
            minter
            gas-value
        )))



;; #########################
;; #########################
;; #### Dynamic Dispatch ###
;; #########################
;; #########################

(define-public (dispatch (fn (string-ascii 32)) (data (buff 65000)) (caller principal))
    (begin
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (ok true)
    )
)
