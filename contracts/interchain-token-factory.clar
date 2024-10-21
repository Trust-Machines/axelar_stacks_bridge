
;; title: interchain-token-factory
;; version:
;; summary:
;; description:
;; This contract is responsible for deploying new interchain tokens and managing their token managers.

;; traits
;;
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(use-trait token-manager-trait .token-manager-trait.token-manager-trait)
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


(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-factory"))))
(define-constant PREFIX-CANONICAL-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "canonical-token-salt"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-salt"))))
(define-constant PREFIX-GATEWAY-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "gateway-token-salt"))))
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) 0x0000000000000000000000000000000000000000)))
(define-constant NULL-BYTES 0x0000000000000000000000000000000000000000)
(define-constant TOKEN-FACTORY-DEPLOYER NULL-ADDRESS)
(define-constant CHAIN-NAME-HASH (unwrap-panic (contract-call? .interchain-token-service get-chain-name-hash)))
(define-constant GATEWAY (unwrap-panic (contract-call? .interchain-token-service get-gateway)))
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
    (ok (contract-call? .interchain-token-service interchain-token-id TOKEN-FACTORY-DEPLOYER 
        (get-interchain-token-salt CHAIN-NAME-HASH deployer salt))))


;; Computes the ID for a canonical interchain token based on its address.
;; @param tokenAddress The address of the canonical interchain token.
;; @return tokenId The ID of the canonical interchain token.
(define-read-only (get-canonical-interchain-token-id (token-address principal))
    (ok (contract-call? .interchain-token-service interchain-token-id TOKEN-FACTORY-DEPLOYER (get-canonical-interchain-token-salt CHAIN-NAME-HASH token-address))))


;; Registers a canonical token as an interchain token and deploys its token manager.
;; @param tokenAddress The address of the canonical token.
;; @return tokenId The tokenId corresponding to the registered canonical token.
(define-public (register-canonical-interchain-token (token-address <sip-010-trait>) (token-manager-address <token-manager-trait>))
    (begin
        (asserts! (is-ok (contract-call? .token-manager contract-id)) ERR-TOKEN-NOT-ENABLED)
        (contract-call? 
            .interchain-token-service deploy-token-manager
                (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token-address)) 
                "" 
                TOKEN-TYPE-LOCK-UNLOCK 
                u0
                0x
                (some token-address)
                (some token-manager-address))
    ))


;; Deploys a canonical interchain token on a remote chain.
;; @param originalTokenAddress The address of the original token on the original chain.
;; @param destinationChain The name of the chain where the token will be deployed.
;; @param gasValue The gas amount to be sent for deployment.
;; @return tokenId The tokenId corresponding to the deployed InterchainToken.
;; #[allow(unchecked_data)]
(define-public (deploy-remote-canonical-interchain-token (token <sip-010-trait>) (destination-chain (string-ascii 18)) (gas-value uint))
    (let
        (
            (salt (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token)))
            (token-id (unwrap-panic (get-interchain-token-id TOKEN-FACTORY-DEPLOYER salt)))
            (name (unwrap-panic (contract-call? token get-name)))
            (symbol (unwrap-panic (contract-call? token get-symbol)))
            (decimals (unwrap-panic (contract-call? token get-decimals)))
            ;; This ensures that the token manager has been deployed by this address, so it's safe to trust it.
            (token (try! (contract-call? .interchain-token-service valid-token-address token-id)))
        )
        (contract-call? .interchain-token-service deploy-remote-interchain-token salt destination-chain name symbol decimals NULL-BYTES gas-value)
    )
)


(define-public (deploy-interchain-token
    (salt_ (buff 32)) 
    (token <token-manager-trait>)
    (initial-supply uint)
    (minter_ principal))
(let
        (
            (sender contract-caller)
            (salt (get-interchain-token-salt CHAIN-NAME-HASH sender salt_))
            (minter
                (if 
                    (> initial-supply u0)
                    (as-contract tx-sender)
                    (if 
                        (not (is-eq NULL-ADDRESS minter_))
                            minter_
                            NULL-ADDRESS)))
            (token-id (unwrap-panic (get-interchain-token-id TOKEN-FACTORY-DEPLOYER salt)))
        )
        (asserts! (not (is-eq ITS minter)) ERR-INVALID-MINTER)
    (contract-call? .interchain-token-service deploy-interchain-token salt token (some minter))))

;; deployRemoteInterchainToken
(define-public (deploy-remote-interchain-token 
    (salt (buff 32))
    (destination-chain (string-ascii 18))
    (name (string-ascii 32))
    (symbol (string-ascii 32))
    (decimals uint)
    (minter (buff 64))
    (gas-value uint)
)
    (contract-call? .interchain-token-service deploy-remote-interchain-token 
        salt
        destination-chain
        name
        symbol
        decimals
        minter
        gas-value
    ))
