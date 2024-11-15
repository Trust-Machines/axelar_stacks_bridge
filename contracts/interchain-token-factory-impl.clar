
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
;; The token will be locked/unlocked at the token manager.
(define-constant TOKEN-TYPE-LOCK-UNLOCK u2)

(define-constant ERR-TOKEN-NOT-ENABLED (err u211051))
(define-constant ERR-INVALID-MINTER (err u211052))
(define-constant ERR-NOT-MINTER (err u211053))
(define-constant ERR-SERVICE-NOT-DEPLOYED (err u211054))

(define-constant ERR-TOKEN-NOT-DEPLOYED (err u211056))
(define-constant ERR-MANAGER-NOT-DEPLOYED (err u211057))
(define-constant ERR-NOT-PROXY (err u211058))
(define-constant ERR-TOKEN-NOT-FOUND (err u211059))
(define-constant ERR-TOKEN-MISMATCH (err u211060))
(define-constant ERR-INVALID-CHAIN-NAME (err u211061))
(define-constant ERR-REMOTE-DEPLOYMENT-NOT-APPROVED (err u211062))




(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-factory"))))
(define-constant PREFIX-CANONICAL-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "canonical-token-salt"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-salt"))))
(define-constant NULL-BYTES 0x0000000000000000000000000000000000000000)
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) NULL-BYTES)))
(define-constant TOKEN-FACTORY-DEPLOYER NULL-ADDRESS)
(define-constant CHAIN-NAME "stacks")
(define-constant CHAIN-NAME-HASH (keccak256 (unwrap-panic (to-consensus-buff? CHAIN-NAME))))
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
        (its-impl <its-trait>)
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
                its-impl
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
        (its-impl <its-trait>)
        (token <sip-010-trait>)
        (destination-chain (string-ascii 20))
        (gas-value uint)
        (caller principal))
    (let
        (
            (salt (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token)))
            (token-id (unwrap! (get-canonical-interchain-token-id its-impl (contract-of token)) ERR-SERVICE-NOT-DEPLOYED))
            (name (unwrap! (contract-call? token get-name) ERR-TOKEN-NOT-DEPLOYED))
            (symbol (unwrap! (contract-call? token get-symbol) ERR-TOKEN-NOT-DEPLOYED))
            (decimals (unwrap! (contract-call? token get-decimals) ERR-TOKEN-NOT-DEPLOYED))
            ;; This ensures that the token manager has been deployed by this address, so it's safe to trust it.
            (token_ (try! (contract-call? its-impl valid-token-address token-id)))
        )
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (contract-call? .interchain-token-service
            deploy-remote-interchain-token
            gateway-impl
            its-impl
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
        (its-impl <its-trait>)
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
        its-impl
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
(define-public (deploy-remote-interchain-token 
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt_ (buff 32))
        (minter_ principal)
        (destination-chain (string-ascii 20))
        (gas-value uint)
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>)
        (caller principal))
    (deploy-remote-interchain-token-with-minter 
        gateway-impl
        its-impl
        salt_
        minter_
        destination-chain
        none
        gas-value
        token
        token-manager
        caller)
)

;; Deploys a remote interchain token on a specified destination chain.
;; @param salt The unique salt for deploying the token.
;; @param minter The address to receive the minter and operator role of the token, in addition to ITS. If the address is `address(0)`,
;; no additional minter is set on the token. Reverts if the minter does not have mint permission for the token.
;; @param destination-chain The name of the destination chain.
;; @param destination-minter The minter address to set on the deployed token on the destination chain. This can be arbitrary bytes
;; since the encoding of the account is dependent on the destination chain. If this is empty, then the `minter` of the token on the current chain
;; is used as the destination minter, which makes it convenient when deploying to other EVM chains.
;; @param gas-value The amount of gas to send for the deployment.
(define-public (deploy-remote-interchain-token-with-minter
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt_ (buff 32))
        (minter_ principal)
        (destination-chain (string-ascii 20))
        (destination-minter (optional (buff 128)))
        (gas-value uint)
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>)
        (caller principal)
)
    (let (
        (salt (get-interchain-token-salt CHAIN-NAME-HASH caller salt_))
        ;; #[allow(unchecked_data)]
        (token-id (unwrap-panic (get-interchain-token-id its-impl TOKEN-FACTORY-DEPLOYER salt)))
        ;; #[allow(unchecked_data)]
        (name (unwrap! (contract-call? token get-name) ERR-TOKEN-NOT-DEPLOYED))
        ;; #[allow(unchecked_data)]
        (symbol (unwrap! (contract-call? token get-symbol) ERR-TOKEN-NOT-DEPLOYED))
        ;; #[allow(unchecked_data)]
        (decimals (unwrap!  (contract-call? token get-decimals) ERR-TOKEN-NOT-DEPLOYED))
        (minter
            (if
                (not (is-eq NULL-ADDRESS minter_))
                (begin
                    (asserts! (unwrap!
                                (contract-call? token-manager is-minter minter_)
                            ERR-MANAGER-NOT-DEPLOYED)
                        ERR-NOT-MINTER)
                    (asserts! (not (is-eq minter_ (contract-of its-impl))) ERR-INVALID-MINTER)
                        (match 
                            destination-minter 
                            d-minter
                            (begin
                                (try! (use-deploy-approval {
                                        minter: minter_,
                                        token-id: token-id,
                                        destination-chain: destination-chain,
                                    } d-minter))
                                d-minter
                            )
                            ;; TODO: ask rares about the inconsistency here minter in EVM chains is considered an ETH address
                            ;; in this instance this is not EVM chain something is lost in translation here
                            (unwrap! (as-max-len? (unwrap-panic (to-consensus-buff? minter_)) u128) ERR-INVALID-MINTER)))
                (begin
                    (asserts! (is-none destination-minter) ERR-INVALID-MINTER)
                    NULL-BYTES)
        ))
    )
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (contract-call? .interchain-token-service deploy-remote-interchain-token
            gateway-impl
            its-impl
            salt
            destination-chain
            name
            symbol
            decimals
            minter
            gas-value
        )))

(define-constant PREFIX-DEPLOY-APPROVAL (keccak256 (unwrap-panic (to-consensus-buff? "deploy-approval"))))

(define-private (get-deploy-approval-key (approval {
        minter: principal,
        token-id: (buff 32),
        destination-chain: (string-ascii 20),
    })) 
    (keccak256 (concat PREFIX-DEPLOY-APPROVAL
        (unwrap-panic (to-consensus-buff? approval))
    )))


;; Allow the minter to approve the deployer for a remote interchain token deployment that uses a custom destinationMinter address.
;; This ensures that a token deployer can't choose the destinationMinter itself, and requires the approval of the minter to reduce trust assumptions on the deployer.
(define-public (approve-deploy-remote-interchain-token
    (its-impl <its-trait>)
    (deployer principal)
    (salt_ (buff 32))
    (destination-chain (string-ascii 20))
    (destination-minter (buff 128))
    (token <native-interchain-token-trait>)
    (caller principal)
)
    (let (
        (minter caller)
        (salt (get-interchain-token-salt CHAIN-NAME-HASH deployer salt_))
        ;; #[allow(unchecked_data)]
        (token-id (unwrap-panic (get-interchain-token-id its-impl deployer salt)))
        (token-info (unwrap! (contract-call? .interchain-token-service-storage get-token-info token-id) ERR-TOKEN-NOT-FOUND))
        (approval {
            minter: minter,
            token-id: token-id,
            destination-chain: destination-chain,
        })
        (approval-key (get-deploy-approval-key approval))
    )
    (asserts! (is-proxy) ERR-NOT-PROXY)
    (asserts! (is-eq (contract-of token) (get manager-address token-info)) ERR-TOKEN-MISMATCH)
    (asserts! (unwrap! (contract-call? token is-minter minter) ERR-TOKEN-NOT-DEPLOYED) ERR-NOT-MINTER)
    (asserts! (is-some (contract-call? .interchain-token-service-storage get-trusted-address destination-chain)) ERR-INVALID-CHAIN-NAME)
    (try! (contract-call? .interchain-token-service-storage emit-deploy-remote-interchain-token-approval
        minter
        deployer
        token-id
        destination-chain
        destination-minter
    ))
    (print {
        type: "deploy-remote-interchain-token-approval",
        minter: minter,
        deployer: deployer,
        token-id: token-id,
        destination-chain: destination-chain,
        destination-minter: destination-minter,
    })
    (contract-call? .interchain-token-service-storage set-approved-destination-minter approval-key (keccak256 destination-minter))))


;; Allows the minter to revoke a deployer's approval for a remote interchain token deployment that uses a custom destinationMinter address.
(define-public (revoke-deploy-remote-interchain-token
        (its-impl <its-trait>)
        (deployer principal)
        (salt_ (buff 32))
        (destination-chain (string-ascii 20))
        (caller principal))
    (let (
        (minter caller)
        (salt (get-interchain-token-salt CHAIN-NAME-HASH deployer salt_))
        ;; #[allow(unchecked_data)]
        (token-id (unwrap-panic (get-interchain-token-id its-impl deployer salt)))
        (approval {
            minter: minter,
            token-id: token-id,
            destination-chain: destination-chain,
        })
        (key (get-deploy-approval-key approval))
    )
        (asserts! (is-proxy) ERR-NOT-PROXY)
        (print {
            type: "revoked-deploy-remote-interchain-token-approval",
            minter: minter,
            deployer: deployer,
            token-id: token-id,
            destination-chain: destination-chain,
        })
        (contract-call? .interchain-token-service-storage remove-approved-destination-minter key)))

;; react hooks in clarity already?! Nakamoto FTW!
(define-private (use-deploy-approval 
    (approval {
        minter: principal,
        token-id: (buff 32),
        destination-chain: (string-ascii 20),
    })
    (destination-minter (buff 128))
) 
    (let (
        (key (get-deploy-approval-key approval))
        (destination-minter-hash (keccak256 destination-minter))
        (approved-minter-hash (default-to NULL-BYTES (contract-call? .interchain-token-service-storage get-approved-destination-minter key)))
    )
    (asserts! 
        (is-eq approved-minter-hash destination-minter-hash)
    ERR-REMOTE-DEPLOYMENT-NOT-APPROVED)
    (contract-call? .interchain-token-service-storage remove-approved-destination-minter key)))

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
