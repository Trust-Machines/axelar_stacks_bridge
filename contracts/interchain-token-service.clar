
;; title: interchain-token-service
;; version:
;; summary:
;; description:

;; traits
;;
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(use-trait token-manager-trait .token-manager-trait.token-manager-trait)

;; token definitions
;;

;; constants
;;

(define-constant ERR-NOT-AUTHORIZED (err u1051))
(define-constant ERR-PAUSED (err u1052))

(define-constant ERR-UNTRUSTED-CHAIN (err u3051))
(define-constant ERR-TOKEN-NOT-FOUND (err u3052))
(define-constant ERR-TOKEN-NOT-ENABLED (err u3053))
(define-constant ERR-TOKEN-EXISTS (err u3054))
(define-constant ERR-GAS-NOT-PAID (err u3055))
(define-constant ERR-TOKEN-NOT-DEPLOYED (err u3056))
(define-constant ERR-TOKEN-MANAGER-NOT-DEPLOYED (err u3057))
(define-constant ERR-TOKEN-MANAGER-MISMATCH (err u3058))
(define-constant ERR-UNSUPPORTED-TOKEN-TYPE (err u3059))
(define-constant ERR-UNSUPPORTED (err u3060))
(define-constant ERR-INVALID-PAYLOAD (err u3061))
(define-constant ERR-INVALID-DESTINATION-CHAIN (err u3062))
(define-constant ERR-INVALID-SOURCE-CHAIN (err u3063))
(define-constant ERR-INVALID-SOURCE-ADDRESS (err u3064))

;; This type is reserved for interchain tokens deployed by ITS, and can't be used by custom token managers.
;; @notice rares: same as mint burn in functionality will be custom tokens made by us
;; that are deployed outside of the contracts but registered by the ITS contract
;; (define-constant TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN u0)
;; The token will be locked/unlocked at the token manager.
(define-constant TOKEN-TYPE-LOCK-UNLOCK u2)


(define-constant OWNER tx-sender)
(define-constant GATEWAY .gateway)
(define-constant GAS-SERVICE .gas-service)
(define-constant CHAIN-NAME "stacks")
(define-constant CHAIN-NAME-HASH (keccak256 (unwrap-panic (to-consensus-buff? CHAIN-NAME))))
;; (define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-service"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-ID (keccak256 (unwrap-panic (to-consensus-buff? "its-interchain-token-id"))))


;;  * @dev Chain name where ITS Hub exists. This is used for routing ITS calls via ITS hub.
;;  * This is set as a constant, since the ITS Hub will exist on Axelar.
(define-data-var its-hub-chain (string-ascii 18) "")

;;  * @dev Special identifier that the trusted address for a chain should be set to, which indicates if the ITS call
;;  * for that chain should be routed via the ITS hub.
;; (define-constant ITS-HUB-ROUTING-IDENTIFIER "hub")
;; (define-constant ITS-HUB-ROUTING-IDENTIFIER-HASH (keccak256 (unwrap-panic (to-consensus-buff? "hub"))))

;; (define-constant MESSAGE-TYPE-INTERCHAIN-TRANSFER u0)
(define-constant MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN u1)
;; (define-constant MESSAGE-TYPE-DEPLOY-TOKEN-MANAGER u2)
(define-constant MESSAGE-TYPE-SEND-TO-HUB u3)
;; (define-constant MESSAGE-TYPE-RECEIVE-FROM-HUB u4)
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) 0x0000000000000000000000000000000000000000)))
;; (define-constant ITS .interchain-token-service)

(define-data-var is-paused bool false)

(define-map token-managers (buff 32) 
    {
        token-address: principal,
        manager-address: principal,
        token-type: uint,
        ;; operator: principal,
    })

(define-public (set-paused (status bool))
    (begin 
        (asserts! (is-eq contract-caller OWNER) ERR-NOT-AUTHORIZED)
        (ok (var-set is-paused status))))

(define-read-only (get-is-paused) 
    (ok (var-get is-paused)))

(define-private (require-not-paused) 
    (ok (asserts! (not (var-get is-paused)) ERR-PAUSED)))



(define-read-only (get-chain-name-hash) 
    (ok CHAIN-NAME-HASH))

(define-read-only (get-gateway) 
    (ok GATEWAY))

(define-read-only (is-valid-token-type (token-type uint)) 
    (or 
        ;; (is-eq token-type TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN)
        (is-eq token-type TOKEN-TYPE-LOCK-UNLOCK)))

;; ;; data vars
;;
(define-data-var its-contract-name (string-ascii 48) "")
;; data maps
;;

;; public functions
;;

;; read only functions
;;
;;  Calculates the tokenId that would correspond to a link for a given deployer with a specified salt.
;;  @param sender The address of the TokenManager deployer.
;;  @param salt The salt that the deployer uses for the deployment.
;;  @return tokenId The tokenId that the custom TokenManager would get (or has gotten).
(define-read-only (interchain-token-id (sender principal) (salt (buff 32))) 
    (keccak256 (concat 
        (concat PREFIX-INTERCHAIN-TOKEN-ID (unwrap-panic (to-consensus-buff? sender)))
    salt)))

;; ####################
;; ####################
;; ### Operatorship ###
;; ####################
;; ####################

(define-constant ERR-ONLY-OPERATOR (err u2051))

(define-data-var operator principal tx-sender)
(define-read-only (get-operator) (var-get operator))

;; Transfers operatorship to a new account
(define-public (transfer-operatorship (new-operator principal)) 
    (begin
        (try! (require-not-paused))
        (asserts! (is-eq contract-caller (var-get operator)) ERR-ONLY-OPERATOR)
        ;; #[allow(unchecked_data)]
        (var-set operator new-operator)
        (print {action: "transfer-operatorship", new-operator: new-operator})
        (ok u1)
    )
)

;; ####################
;; ####################
;; ### address tracking ###
;; ####################
;; ####################

(define-map trusted-chain-address (string-ascii 18) (string-ascii 48))

;; Gets the name of the chain this is deployed at
(define-read-only (get-chain-name) 
    (ok CHAIN-NAME))


;; Gets the trusted address at a remote chain
;; @param chain Chain name of the remote chain
;; @return trustedAddress_ The trusted address for the chain. Returns '' if the chain is untrusted
(define-read-only (get-trusted-address (chain (string-ascii 18))) 
    (map-get? trusted-chain-address chain))

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
        (try! (require-not-paused))
        (asserts!  (is-eq contract-caller OWNER) ERR-NOT-AUTHORIZED)
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
        (try! (require-not-paused))
        (asserts!  (is-eq tx-sender OWNER) ERR-NOT-AUTHORIZED)
        (print {
            type: "trusted-address-removed",
            chain: chain-name
        })
        (ok (map-delete trusted-chain-address chain-name))))


(define-private (get-call-params (destination-chain (string-ascii 18)) (payload (buff 1024)))
    (let (
            (destination-address (unwrap! (get-trusted-address destination-chain) ERR-UNTRUSTED-CHAIN))
            (destination-address-hash (keccak256 (unwrap-panic (to-consensus-buff? destination-address)))))
        ;; Prevent sending directly to the ITS Hub chain. This is not supported yet, 
        ;; so fail early to prevent the user from having their funds stuck.
        (asserts! (not (is-eq destination-chain (var-get its-hub-chain))) ERR-UNTRUSTED-CHAIN)
        (ok 
            {
                ;; Wrap ITS message in an ITS Hub message
                destination-address: destination-address,
                destination-chain: (var-get its-hub-chain),
                payload: (unwrap-panic (to-consensus-buff? {
                    type: MESSAGE-TYPE-SEND-TO-HUB,
                    destination-chain: destination-chain,
                    payload: payload,
                })),
            })))

(define-private (pay-gas 
        (amount uint)
        (refund-address principal)
        (destination-chain (string-ascii 32))
        (destination-address (string-ascii 48))
        (payload (buff 1024))) 
    ;; FIXME: GAS service not implemented
    (if 
        (> amount u0)
            ERR-GAS-NOT-PAID 
        (ok true)))

;; @notice Calls a contract on a specific destination chain with the given payload
;; @dev This method also determines whether the ITS call should be routed via the ITS Hub.
;; If the `trustedAddress(destinationChain) == 'hub'`, then the call is wrapped and routed to the ITS Hub destination.
;; @param destinationChain The target chain where the contract will be called.
;; @param payload The data payload for the transaction.
;; @param gasValue The amount of gas to be paid for the transaction.
(define-private (call-contract (destination-chain (string-ascii 18)) (payload (buff 1024)) (gas-value uint))
    (let
        (
            (params (unwrap-panic (get-call-params destination-chain payload)))
            (destination-chain_ (get destination-chain params))
            (destination-address_ (get destination-address params))
            (payload_ (get payload params))
        )
        (try! (pay-gas gas-value tx-sender destination-chain_ destination-address_ payload))
        (as-contract (contract-call? .gateway call-contract destination-chain_ destination-address_ payload))
    )
)
(define-public (deploy-token-manager
            (salt (buff 32))
            (destination-chain (string-ascii 18))
            (token-manager-type uint)
            (token <sip-010-trait>)
            (token-manager <token-manager-trait>)
            (gas-value uint))
        (begin
            (try! (require-not-paused))
            (asserts! (is-eq (len destination-chain) u0) ERR-UNSUPPORTED)
            (deploy-canonical-token-manager salt destination-chain token-manager-type token token-manager)
        )
    )
;; Used to deploy remote custom TokenManagers.
;; @dev At least the `gasValue` amount of native token must be passed to the function call. `gasValue` exists because this function can be
;; part of a multicall involving multiple functions that could make remote contract calls.
;; @param salt The salt to be used during deployment.
;; @param destinationChain The name of the chain to deploy the TokenManager and standardized token to.
;; @param tokenManagerType The type of token manager to be deployed. Cannot be NATIVE_INTERCHAIN_TOKEN.
;; @param params The params that will be used to initialize the TokenManager.
;; @param gasValue The amount of native tokens to be used to pay for gas for the remote deployment.
;; @return tokenId The tokenId corresponding to the deployed TokenManager.
(define-private (deploy-canonical-token-manager
        (salt (buff 32))
        (destination-chain (string-ascii 18))
        (token-manager-type uint)
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>))
    (let (
        (deployer (if (is-eq contract-caller (var-get interchain-token-factory)) NULL-ADDRESS contract-caller))
        (token-id (interchain-token-id deployer salt))
        (managed-token (unwrap! (contract-call? token-manager get-token-address) ERR-TOKEN-MANAGER-NOT-DEPLOYED))
    )
    (print {
        type: "interchain-token-id-claimed",
        token-id: token-id,
        deployer: deployer,
        salt: salt,
    })
    (asserts! (is-eq 
        (unwrap! (contract-call? token-manager get-token-type) ERR-TOKEN-MANAGER-NOT-DEPLOYED)
        token-manager-type
    ) ERR-TOKEN-MANAGER-MISMATCH)
    (asserts! (is-ok (contract-call? token get-name)) ERR-TOKEN-NOT-DEPLOYED)
    (asserts! (is-eq managed-token (contract-of token)) ERR-TOKEN-MANAGER-MISMATCH)
    (asserts! (is-valid-token-type token-manager-type) ERR-UNSUPPORTED-TOKEN-TYPE)
    (asserts! (is-none (map-get? token-managers token-id)) ERR-TOKEN-EXISTS)
    (as-contract 
        (contract-call? .gateway call-contract
            CHAIN-NAME 
            (var-get its-contract-name) 
            (unwrap-panic (to-consensus-buff? {
                type: "verify-token-manager",
                token-address: (contract-of token),
                token-manager-address: (contract-of token-manager),
                token-id: token-id,
                token-type: token-manager-type,
            }))))))

(define-public (execute-enable-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (payload (buff 1024)))
    (let (
        ;; #[filter(token-id)]
        (data (unwrap! (from-consensus-buff? {
                type: (string-ascii 100),
                token-address: principal,
                token-manager-address: principal,
                token-id: (buff 32),
                token-type: uint,
            } payload) ERR-INVALID-PAYLOAD))
        (token-id (get token-id data))
        (token-address (get token-address data))
        (token-manager-address (get token-manager-address data))
        (token-type (get token-type data))
        (token-info (unwrap! (map-get? token-managers token-id) ERR-TOKEN-NOT-FOUND))
    
    )
        (try! (require-not-paused))
        (asserts! (is-eq source-chain CHAIN-NAME) ERR-INVALID-SOURCE-CHAIN)
        (asserts! (is-eq source-address (var-get its-contract-name)) ERR-INVALID-SOURCE-ADDRESS)
        (try!
            (as-contract (contract-call? .gateway validate-message CHAIN-NAME message-id 
                (var-get its-contract-name)
                (keccak256 payload))))
        (asserts! (map-insert token-managers token-id {
            token-address: token-address,
            manager-address: token-manager-address,
            token-type: token-type,
        }) ERR-TOKEN-EXISTS)
        (print {
            type: "token-manager-deployed",
            token-id: token-id,
            token-manager: token-manager-address,
            token-type: (get token-type token-info),
        })
        (ok true)
    ))

;; Deploys an interchain token on a destination chain.
;; @param salt The salt to be used during deployment.
;; @param name The name of the token.
;; @param symbol The symbol of the token.
;; @param decimals The number of decimals of the token.
;; @param minter The minter address for the token.
;; @param destinationChain The destination chain where the token will be deployed.
;; @param gasValue The amount of gas to be paid for the transaction.
(define-public (deploy-interchain-token 
        (salt (buff 32))
        (destination-chain (string-ascii 18))
        (name (string-ascii 32))
        (symbol (string-ascii 32))
        (decimals uint)
        (minter (buff 32))
        (gas-value uint))
    (let (
        (deployer (if (is-eq contract-caller (var-get interchain-token-factory)) NULL-ADDRESS contract-caller))
        (token-id (interchain-token-id deployer salt))
        (payload (unwrap-panic (to-consensus-buff? {
            type: MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN,
            token-id: token-id,
            name: name,
            symbol: symbol,
            decimals: decimals,
            minter: minter
        })))
        (token-info (unwrap! (map-get? token-managers token-id) ERR-TOKEN-NOT-FOUND))
    )
    (try! (require-not-paused))
    (asserts! (> (len destination-chain) u0) ERR-INVALID-DESTINATION-CHAIN)
    (print {
        type:"interchain-token-deployment-started",
        token-id: token-id,
        name: name,
        symbol: symbol,
        decimals: decimals,
        minter: minter,
        destination-chain: destination-chain,
    })
    ;; #[allow(unchecked_data)]
    (call-contract destination-chain payload gas-value)))

(define-read-only (valid-token-address (token-id (buff 32))) 
    (ok (unwrap! (map-get? token-managers token-id) ERR-TOKEN-NOT-FOUND)))

;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

(define-constant ERR-STARTED (err u6051))
(define-constant ERR-NOT-STARTED (err u6052))

(define-data-var interchain-token-factory principal NULL-ADDRESS)
(define-data-var is-started bool false)
(define-read-only (get-is-started) (var-get is-started))

;; Constructor function
;; @returns (response true) or reverts
(define-public (setup 
    (its-contract-address-name (string-ascii 48))
    (interchain-token-factory_ principal)
) 
    (begin
        (asserts! (is-eq contract-caller OWNER) ERR-NOT-AUTHORIZED)
        (asserts! (is-eq (var-get is-started) false) ERR-STARTED)
        (var-set is-started true)
        ;; #[allow(unchecked_data)]
        (var-set its-contract-name its-contract-address-name)
        ;; #[allow(unchecked_data)]
        (var-set interchain-token-factory interchain-token-factory_)
        (ok true)
    )
)
