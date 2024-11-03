
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
;; token definitions
;;

;; constants
;;
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

(define-constant ERR-TOKEN-NOT-ENABLED (err u1051))
(define-constant ERR-INVALID-MINTER (err u1052))
(define-constant ERR-NOT-MINTER (err u1053))
(define-constant ERR-SERVICE-NOT-DEPLOYED (err u1054))
(define-constant ERR-GATEWAY-NOT-DEPLOYED (err u1055))
(define-constant ERR-TOKEN-NOT-DEPLOYED (err u1056))
(define-constant ERR-MANAGER-NOT-DEPLOYED (err u1057))


(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-factory"))))
(define-constant PREFIX-CANONICAL-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "canonical-token-salt"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-salt"))))
(define-constant PREFIX-GATEWAY-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "gateway-token-salt"))))
(define-constant NULL-BYTES 0x0000000000000000000000000000000000000000)
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) NULL-BYTES)))
(define-constant TOKEN-FACTORY-DEPLOYER NULL-ADDRESS)
(define-constant CHAIN-NAME-HASH (unwrap! (contract-call? .interchain-token-service get-chain-name-hash) ERR-SERVICE-NOT-DEPLOYED))
(define-constant GATEWAY (unwrap! (contract-call? .interchain-token-service get-gateway) ERR-GATEWAY-NOT-DEPLOYED))
;; The address of the interchain token service.
(define-constant ITS .interchain-token-service)

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
(define-read-only (get-interchain-token-id (deployer principal) (salt (buff 32)))
    (ok (contract-call? .interchain-token-service interchain-token-id TOKEN-FACTORY-DEPLOYER salt)))


;; Computes the ID for a canonical interchain token based on its address.
;; @param tokenAddress The address of the canonical interchain token.
;; @return tokenId The ID of the canonical interchain token.
(define-read-only (get-canonical-interchain-token-id (token-address principal))
    (ok (contract-call? .interchain-token-service interchain-token-id TOKEN-FACTORY-DEPLOYER (get-canonical-interchain-token-salt CHAIN-NAME-HASH token-address))))


;; Registers a canonical token as an interchain token and deploys its token manager.
;; @param tokenAddress The address of the canonical token.
;; @return tokenId The tokenId corresponding to the registered canonical token.
(define-public (register-canonical-interchain-token
        (token-address <sip-010-trait>)
        (token-manager-address <token-manager-trait>)
        (gas-value uint)
    )
    (begin
        (asserts! (is-ok (contract-call? token-manager-address get-token-address)) ERR-TOKEN-NOT-ENABLED)
        (contract-call?
            .interchain-token-service deploy-token-manager
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
(define-public (deploy-remote-canonical-interchain-token (token <sip-010-trait>) (destination-chain (string-ascii 20)) (gas-value uint))
    (let
        (
            (salt (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token)))
            (token-id (unwrap! (get-canonical-interchain-token-id (contract-of token)) ERR-SERVICE-NOT-DEPLOYED))
            (name (unwrap! (contract-call? token get-name) ERR-TOKEN-NOT-DEPLOYED))
            (symbol (unwrap! (contract-call? token get-symbol) ERR-TOKEN-NOT-DEPLOYED))
            (decimals (unwrap! (contract-call? token get-decimals) ERR-TOKEN-NOT-DEPLOYED))
            ;; This ensures that the token manager has been deployed by this address, so it's safe to trust it.
            (token_ (try! (contract-call? .interchain-token-service valid-token-address token-id)))
        )
        (contract-call? .interchain-token-service deploy-remote-interchain-token salt destination-chain name symbol decimals NULL-BYTES gas-value)
    )
)


(define-public (deploy-interchain-token
        (salt_ (buff 32))
        (token <native-interchain-token-trait>)
        (initial-supply uint)
        (minter_ principal)
        (gas-value uint))
    (let
        (
            (salt (get-interchain-token-salt CHAIN-NAME-HASH contract-caller salt_))
            (minter
                (if
                    (> initial-supply u0)
                    (as-contract tx-sender)
                    (if
                        (not (is-eq NULL-ADDRESS minter_))
                            minter_
                            NULL-ADDRESS)))
            (token-id (unwrap! (get-interchain-token-id TOKEN-FACTORY-DEPLOYER salt) ERR-SERVICE-NOT-DEPLOYED))
        )
        (asserts! (not (is-eq ITS minter)) ERR-INVALID-MINTER)
    (contract-call? .interchain-token-service deploy-interchain-token salt token initial-supply (some minter) gas-value)))

;; This will only be a risk if the user deploying the token remotely
;; is deploying an existing malicious token on stacks
;; basically getting themself rekt
;; #[allow(unchecked_data)]
(define-public (deploy-remote-interchain-token
    (salt_ (buff 32))
    (minter_ (buff 128))
    (destination-chain (string-ascii 20))
    (gas-value uint)
    (token <sip-010-trait>)
    (token-manager <token-manager-trait>)
)
    (let (
        (salt (get-interchain-token-salt CHAIN-NAME-HASH contract-caller salt_))
        (name (unwrap! (contract-call? token get-name) ERR-TOKEN-NOT-DEPLOYED))
        (symbol (unwrap! (contract-call? token get-symbol) ERR-TOKEN-NOT-DEPLOYED))
        (decimals (unwrap!  (contract-call? token get-decimals) ERR-TOKEN-NOT-DEPLOYED))
        (token-id (unwrap! (get-interchain-token-id TOKEN-FACTORY-DEPLOYER salt) ERR-SERVICE-NOT-DEPLOYED))
        (minter
            (if
                (not (is-eq NULL-BYTES minter_))
                (begin
                    (asserts! (unwrap! 
                                (contract-call? token-manager is-minter contract-caller) 
                            ERR-MANAGER-NOT-DEPLOYED) 
                        ERR-NOT-MINTER)
                    minter_)
                NULL-BYTES
        ))
    )
        (contract-call? .interchain-token-service deploy-remote-interchain-token
            salt
            destination-chain
            name
            symbol
            decimals
            minter_
            gas-value
        )))
