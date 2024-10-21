
;; title: interchain-token-service
;; version:
;; summary:
;; description:

;; traits
;;
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(use-trait token-manager-trait .token-manager-trait.token-manager-trait)
(use-trait interchain-token-executable-trait .interchain-token-executable-trait.interchain-token-executable-trait)

;; token definitions
;;

;; constants
;;

(define-constant ERR-NOT-AUTHORIZED (err u1051))
(define-constant ERR-PAUSED (err u1052))

(define-constant ERR-UNTRUSTED-CHAIN (err u2051))
(define-constant ERR-TOKEN-NOT-FOUND (err u2052))
(define-constant ERR-TOKEN-NOT-ENABLED (err u2053))
(define-constant ERR-TOKEN-EXISTS (err u2054))
(define-constant ERR-GAS-NOT-PAID (err u2055))
(define-constant ERR-TOKEN-NOT-DEPLOYED (err u2056))
(define-constant ERR-TOKEN-MANAGER-NOT-DEPLOYED (err u2057))
(define-constant ERR-TOKEN-MANAGER-MISMATCH (err u2058))
(define-constant ERR-UNSUPPORTED-TOKEN-TYPE (err u2059))
(define-constant ERR-UNSUPPORTED (err u2060))
(define-constant ERR-INVALID-PAYLOAD (err u2061))
(define-constant ERR-INVALID-DESTINATION-CHAIN (err u2062))
(define-constant ERR-INVALID-SOURCE-CHAIN (err u2063))
(define-constant ERR-INVALID-SOURCE-ADDRESS (err u2064))
(define-constant ERR-ZERO-AMOUNT (err u2065))
(define-constant ERR-INVALID-METADATA-VERSION (err u2066))
(define-constant ERR-INVALID-SALT (err u2067))
(define-constant ERR-INVALID-DESTINATION-ADDRESS (err u2068))
(define-constant ERR-EMPTY-DATA (err u2069))
(define-constant ERR-TOKEN-DEPLOYMENT-NOT-APPROVED (err u2070))
(define-constant ERR-INVALID-MESSAGE-TYPE (err u2071))
(define-constant ERR-CANNOT-DEPLOY-REMOTELY-TO-SELF (err u2072))
(define-constant ERR-TOKEN-REQUIRED (err u2073))
(define-constant ERR-TOKEN-MANAGER-REQUIRED (err u2074))



;; This type is reserved for interchain tokens deployed by ITS, and can't be used by custom token managers.
;; @notice rares: same as mint burn in functionality will be custom tokens made by us
;; that are deployed outside of the contracts but registered by the ITS contract
(define-constant TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN u0)
;; The token will be locked/unlocked at the token manager.
(define-constant TOKEN-TYPE-LOCK-UNLOCK u2)


(define-constant OWNER tx-sender)
(define-constant CHAIN-NAME "stacks")
(define-constant CHAIN-NAME-HASH (keccak256 (unwrap-panic (to-consensus-buff? CHAIN-NAME))))
;; (define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-service"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-ID (keccak256 (unwrap-panic (to-consensus-buff? "its-interchain-token-id"))))


(define-constant METADATA-VERSION {
    contract-call: u0,
    express-call: u1
})

(define-constant LATEST-METADATA-VERSION u1)

(define-constant EMPTY-32-BYTES 0x0000000000000000000000000000000000000000000000000000000000000000)

;; @dev Chain name where ITS Hub exists. This is used for routing ITS calls via ITS hub.
;; This is set as a constant, since the ITS Hub will exist on Axelar.
(define-data-var its-hub-chain (string-ascii 18) "axelar")

;; @dev Special identifier that the trusted address for a chain should be set to, which indicates if the ITS call
;; for that chain should be routed via the ITS hub.
;; (define-constant ITS-HUB-ROUTING-IDENTIFIER "hub")
;; (define-constant ITS-HUB-ROUTING-IDENTIFIER-HASH (keccak256 (unwrap-panic (to-consensus-buff? "hub"))))

(define-constant MESSAGE-TYPE-INTERCHAIN-TRANSFER u0)
(define-constant MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN u1)
(define-constant MESSAGE-TYPE-DEPLOY-TOKEN-MANAGER u2)
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
    })

(define-read-only (get-token-info (token-id (buff 32))) 
    (ok (map-get? token-managers token-id)))

(define-public (set-paused (status bool))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (asserts! (is-eq contract-caller OWNER) ERR-NOT-AUTHORIZED)
        (ok (var-set is-paused status))))

(define-read-only (get-is-paused)
    (ok (var-get is-paused)))

(define-private (require-not-paused)
    (ok (asserts! (not (var-get is-paused)) ERR-PAUSED)))



(define-read-only (get-chain-name-hash)
    (ok CHAIN-NAME-HASH))

(define-read-only (get-gateway)
    (ok (var-get gatway)))

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

(define-constant ERR-ONLY-OPERATOR (err u3051))

(define-data-var operator principal NULL-ADDRESS)
(define-read-only (get-operator) (var-get operator))

;; Transfers operatorship to a new account
(define-public (transfer-operatorship (new-operator principal))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
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
;; #[allow(unchecked_data)]
(define-public (set-trusted-address (chain-name (string-ascii 18)) (address (string-ascii 48)))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
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
;; #[allow(unchecked_data)]
(define-public (remove-trusted-address  (chain-name  (string-ascii 18)))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (try! (require-not-paused))
        (asserts!  (is-eq tx-sender OWNER) ERR-NOT-AUTHORIZED)
        (print {
            type: "trusted-address-removed",
            chain: chain-name
        })
        (ok (map-delete trusted-chain-address chain-name))))


(define-private (get-call-params (destination-chain (string-ascii 18)) (payload (buff 4096)))
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

(define-private (pay-native-gas-for-contract-call
        (amount uint)
        (refund-address principal)
        (destination-chain (string-ascii 32))
        (destination-address (string-ascii 48))
        (payload (buff 10240)))
    ;; FIXME: GAS service not implemented
    (if
        (> amount u0)
            ;; ERR-GAS-NOT-PAID
            (ok true)
        (if false ERR-GAS-NOT-PAID (ok true))))

(define-private (pay-native-gas-for-express-call
        (amount uint)
        (refund-address principal)
        (destination-chain (string-ascii 32))
        (destination-address (string-ascii 48))
        (payload (buff 10240)))
    ;; FIXME: GAS service not implemented
    (if
        (> amount u0)
            ;; ERR-GAS-NOT-PAID
            (ok true)
        (if false ERR-GAS-NOT-PAID (ok true))))

;; @notice Calls a contract on a specific destination chain with the given payload
;; @dev This method also determines whether the ITS call should be routed via the ITS Hub.
;; If the `trustedAddress(destinationChain) == 'hub'`, then the call is wrapped and routed to the ITS Hub destination.
;; @param destinationChain The target chain where the contract will be called.
;; @param payload The data payload for the transaction.
;; @param gasValue The amount of gas to be paid for the transaction.
(define-private (call-contract (destination-chain (string-ascii 18)) (payload (buff 4096)) (metadata-version uint) (gas-value uint))
    (let
        (
            (params (try! (get-call-params destination-chain payload)))
            (destination-chain_ (get destination-chain params))
            (destination-address_ (get destination-address params))
            (payload_ (get payload params))
        )
        (try!
            (if (is-eq (get express-call METADATA-VERSION) metadata-version)
                (pay-native-gas-for-express-call gas-value tx-sender destination-chain_ destination-address_ payload_)
                (pay-native-gas-for-contract-call gas-value tx-sender destination-chain_ destination-address_ payload_)
            ))
        (as-contract (contract-call? .gateway call-contract destination-chain_ destination-address_ payload_))
    )
)

(define-public (deploy-token-manager
        (salt (buff 32))
        (destination-chain (string-ascii 18))
        (token-manager-type uint)
        (gas-value uint)
        (params (buff 1024))
        (token (optional <sip-010-trait>))
        (token-manager (optional <token-manager-trait>))
    )
    (let (
            (deployer (if (is-eq contract-caller (var-get interchain-token-factory)) NULL-ADDRESS contract-caller))
            (token-id (interchain-token-id deployer salt))
        )
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (try! (require-not-paused))
        (asserts! (is-valid-token-type token-manager-type) ERR-UNSUPPORTED-TOKEN-TYPE)
        (asserts! (is-eq u32 (len salt)) ERR-INVALID-SALT)
        (print {
            type: "interchain-token-id-claimed",
            token-id: token-id,
            deployer: deployer,
            salt: salt,
        })
        (if (is-eq (len destination-chain) u0) 
            (process-deploy-token-manager-from-external-chain 
                token-id
                destination-chain
                token-manager-type
                ;; #[filter(token, token-manager, params)]
                params
                (unwrap! token ERR-TOKEN-REQUIRED)
                (unwrap! token-manager ERR-TOKEN-MANAGER-REQUIRED))
            ;; #[filter(token, token-manager, params, gas-value)]
            (process-deploy-remote-token-manager token-id destination-chain token-manager-type params gas-value)
        )))

(define-private (process-deploy-remote-token-manager
        (token-id (buff 32))
        (destination-chain (string-ascii 18))
        (token-manager-type uint)
        (params (buff 1024))
        (gas-value uint))
        (let (
            (payload (unwrap-panic (to-consensus-buff? {
                type: MESSAGE-TYPE-DEPLOY-TOKEN-MANAGER,
                token-id: token-id,
                token-manager-type: token-manager-type,
                params: params,
            })))
        )
            (asserts! (not (is-eq destination-chain CHAIN-NAME)) ERR-CANNOT-DEPLOY-REMOTELY-TO-SELF)
            (print {
                type: "token-manager-deployment-started",
                token-id: token-id,
                destination-chain: destination-chain,
                token-manager-type: token-manager-type,
                params: params,
            })
            (call-contract destination-chain payload (get contract-call METADATA-VERSION) gas-value)))
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
        (token-id (buff 32))
        (destination-chain (string-ascii 18))
        (token-manager-type uint)
        (params (buff 1024))
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>))
    (let (
        (managed-token (unwrap! (contract-call? token-manager get-token-address) ERR-TOKEN-MANAGER-NOT-DEPLOYED))
    )
    
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


(define-public (process-deploy-token-manager-from-stacks
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
    )
        (asserts! (var-get is-started) ERR-NOT-STARTED)
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
            token-type: token-type,
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
(define-public (deploy-remote-interchain-token
        (salt (buff 32))
        (destination-chain (string-ascii 18))
        (name (string-ascii 32))
        (symbol (string-ascii 32))
        (decimals uint)
        (minter (buff 200))
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
    (asserts! (var-get is-started) ERR-NOT-STARTED)
    (try! (require-not-paused))
    (asserts! (or 
            (is-eq destination-chain CHAIN-NAME)
            (> (len destination-chain) u0)) 
        ERR-INVALID-DESTINATION-CHAIN)
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
    (call-contract destination-chain payload (get contract-call METADATA-VERSION) gas-value)))

(define-public (deploy-interchain-token
        (salt (buff 32))
        (token <token-manager-trait>)
        (minter (optional principal)))
    (let (
            (token-id (interchain-token-id contract-caller salt)))
        (asserts! (is-none (map-get? token-managers token-id)) ERR-TOKEN-EXISTS)
        (contract-call? .gateway call-contract
            CHAIN-NAME
            (var-get its-contract-name)
            (unwrap-panic (to-consensus-buff? {
                type: "verify-interchain-token",
                token-address: (contract-of token),
                token-manager-address: (contract-of token),
                token-id: token-id,
                token-type: TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN,
                minter: (default-to NULL-ADDRESS minter),
            })))))


(define-read-only (valid-token-address (token-id (buff 32)))
    (ok (unwrap! (map-get? token-managers token-id) ERR-TOKEN-NOT-FOUND)))


;; Initiates an interchain transfer of a specified token to a destination chain.
;; @dev The function retrieves the TokenManager associated with the tokenId.
;; @param tokenId The unique identifier of the token to be transferred.
;; @param destinationChain The destination chain to send the tokens to.
;; @param destinationAddress The address on the destination chain to send the tokens to.
;; @param amount The amount of tokens to be transferred.
;; @param metadata Optional metadata for the call for additional effects (such as calling a destination contract).
(define-public (interchain-transfer
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 18))
        (destination-address (buff 100))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 1024)
        })
        (gas-value uint)
    )
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (try! (require-not-paused))
        ;; #[filter(token-manager,token,token-id,destination-chain,destination-address,amount,metadata,gas-value)]
        (try! (check-interchain-transfer-params token-manager token token-id destination-chain destination-address amount metadata gas-value))
        (try! (contract-call? token-manager take-token token contract-caller amount))
        (transmit-interchain-transfer
            token-id
            contract-caller
            destination-chain
            destination-address
            amount
            (get version metadata)
            (get data metadata)
            gas-value)))

(define-public (call-contract-with-interchain-token
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 18))
        (destination-address (buff 100))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 1024)
        })
        (gas-value uint))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (try! (require-not-paused))
        ;; #[filter(token-manager,token,token-id,destination-chain,destination-address,amount,metadata,gas-value)]
        (try! (check-interchain-transfer-params token-manager token token-id destination-chain destination-address amount metadata gas-value))
        (asserts! (> u0 (len (get data metadata))) ERR-EMPTY-DATA)
        (try! (contract-call? token-manager take-token token contract-caller amount))
        (transmit-interchain-transfer
            token-id
            contract-caller
            destination-chain
            destination-address
            amount
            (get contract-call METADATA-VERSION)
            (get data metadata)
            gas-value)))

(define-private (check-interchain-transfer-params
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 18))
        (destination-address (buff 100))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 1024)
        })
        (gas-value uint)
)
    (let (
        (token-info (unwrap! (map-get? token-managers token-id) ERR-TOKEN-NOT-FOUND))
    )
        (asserts! (> amount u0) ERR-ZERO-AMOUNT)
        (asserts! (is-eq (contract-of token-manager) (get manager-address token-info)) ERR-TOKEN-MANAGER-MISMATCH)
        (asserts! (is-eq (contract-of token) (get token-address token-info)) ERR-TOKEN-MANAGER-MISMATCH)
        (asserts! (<= (get version metadata) LATEST-METADATA-VERSION) ERR-INVALID-METADATA-VERSION)
        (asserts! (> gas-value u0) ERR-ZERO-AMOUNT)
        (asserts! (> u0 (len destination-chain)) ERR-INVALID-DESTINATION-CHAIN)
        (asserts! (> u0 (len destination-address)) ERR-INVALID-DESTINATION-ADDRESS)
        (ok true)))
;; Transmit a callContractWithInterchainToken for the given tokenId.
;; @param tokenId The tokenId of the TokenManager (which must be the msg.sender).
;; @param sourceAddress The address where the token is coming from, which will also be used for gas reimbursement.
;; @param destinationChain The name of the chain to send tokens to.
;; @param destinationAddress The destinationAddress for the interchainTransfer.
;; @param amount The amount of tokens to send.
;; @param metadataVersion The version of the metadata.
;; @param data The data to be passed with the token transfer.
(define-private (transmit-interchain-transfer
        (token-id (buff 32))
        (source-address principal)
        (destination-chain (string-ascii 18))
        (destination-address (buff 100))
        (amount uint)
        (metadata-version uint)
        (data (buff 1024))
        (gas-value uint))
    (let
        (
            (payload (unwrap-panic (to-consensus-buff? {
                type: MESSAGE-TYPE-INTERCHAIN-TRANSFER,
                token-id: token-id,
                source-address: source-address,
                destination-chain: destination-chain,
                destination-address: destination-address,
                amount: amount,
                data: data
            })))
        )
        (asserts! (> amount u0) ERR-ZERO-AMOUNT)
        (print {
            type: "interchain-transfer",
            token-id: token-id,
            source-address: source-address,
            destination-chain: destination-chain,
            destination-address: destination-address,
            amount: amount,
            data: (if (is-eq u0 (len data)) EMPTY-32-BYTES (keccak256 data))
        })
        (call-contract destination-chain payload metadata-version gas-value)
    ))

(define-public (execute-deploy-token-manager
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (payload (buff 1024))
        (token (optional <sip-010-trait>))
        (token-manager (optional <token-manager-trait>)))
    (let
        (
            (payload-decoded (unwrap! (from-consensus-buff? {
                type: uint,
                token-id: (buff 32),
                token-manager-type: uint,
                params: (buff 512)
            } payload) ERR-INVALID-PAYLOAD))
            (token-id (get token-id payload-decoded))
            (token-manager-type (get token-manager-type payload-decoded))
            (params (get params payload-decoded))
        )
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (try! (require-not-paused))
        (if (is-eq CHAIN-NAME source-chain)
            (process-deploy-token-manager-from-stacks message-id source-chain source-address payload)
            (process-deploy-token-manager-from-external-chain
                token-id
                CHAIN-NAME
                token-manager-type
                params
                (unwrap! token ERR-TOKEN-REQUIRED)
                (unwrap! token-manager ERR-TOKEN-MANAGER-REQUIRED)))))

(define-public (execute-deploy-interchain-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (token-address principal)
        (payload (buff 1024)))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (try! (require-not-paused))
        (if (is-eq CHAIN-NAME source-chain)
            ;; #[filter(message-id, source-chain, payload, source-address)]
            (process-deploy-interchain-from-stacks message-id source-chain source-address payload)
            ;; #[filter(message-id, source-chain, payload, token-address, source-address)]
            (process-deploy-interchain-from-external-chain message-id source-chain source-address token-address payload))))

(define-private (process-deploy-interchain-from-external-chain
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (token-address principal)
        (payload (buff 1024))
    )
    (let (
        (payload-decoded (unwrap! (from-consensus-buff? {
            type: uint,
            token-id: (buff 32),
            name: (string-ascii 32),
            symbol: (string-ascii 32),
            decimals: uint,
            minter-bytes: (buff 200),
        } payload) ERR-INVALID-PAYLOAD))
    )
    (asserts! (unwrap-panic (contract-call? .gateway is-message-approved
            source-chain message-id source-address (as-contract tx-sender) (keccak256 payload)))
        ERR-TOKEN-DEPLOYMENT-NOT-APPROVED)
    (asserts! (is-eq MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN (get type payload-decoded)) ERR-INVALID-MESSAGE-TYPE)
    (as-contract
        (contract-call? .gateway call-contract
            CHAIN-NAME
            (var-get its-contract-name)
            (unwrap-panic (to-consensus-buff? {
                type: "verify-interchain-token",
                source-chain: source-chain,
                source-address: source-address,
                message-id: message-id,
                payload: payload,
                token-address: token-address,
                token-id: (get token-id payload-decoded),
                token-type: TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN,
            }))))
    ))

;; A user deploys a native interchain token on their own on stacks
;; They want to register it on stacks
;; User calls the ITS to verify the contract through sending a gateway message


(define-private (process-deploy-interchain-from-stacks
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (payload (buff 1024)))
    (let (
        ;; #[filter(token-id)]
        (data (unwrap! (from-consensus-buff? {
                type: (string-ascii 100),
                source-chain: (string-ascii 18),
                source-address: (string-ascii 48),
                message-id: (string-ascii 71),
                payload: (buff 256),
                token-address: principal,
                token-id: (buff 32),
                token-type: uint,
            } payload) ERR-INVALID-PAYLOAD))
        (token-id (get token-id data))
        (token-type (get token-type data))
    )
        (try! (require-not-paused))
        (asserts! (is-eq source-chain CHAIN-NAME) ERR-INVALID-SOURCE-CHAIN)
        (asserts! (is-eq source-address (var-get its-contract-name)) ERR-INVALID-SOURCE-ADDRESS)
        (try!
            (as-contract (contract-call? .gateway validate-message CHAIN-NAME message-id
                (var-get its-contract-name)
                (keccak256 payload))))
        (try!
            (as-contract (contract-call? .gateway validate-message
                (get source-chain data)
                (get message-id data)
                (get source-address data)
                (keccak256 (get payload data)))))
        (asserts! (map-insert token-managers token-id {
            token-address: (get token-address data),
            manager-address: (get token-address data),
            token-type: token-type,
        }) ERR-TOKEN-EXISTS)
        (print {
            type: "token-manager-deployed",
            token-id: token-id,
            token-manager: (get token-address data),
            token-type: token-type,
        })
        (ok true)
    ))

(define-public (execute-receive-interchain-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (payload (buff 1024))
        (destination-contract (optional <interchain-token-executable-trait>))
    )
    (let (
        (payload-decoded (unwrap! (from-consensus-buff? {
            type: uint,
            token-id: (buff 32),
            source-address: (string-ascii 48),
            destination-address: (buff 200),
            amount: uint,
            data: (buff 256),
        } payload) ERR-INVALID-PAYLOAD))
        (token-id (get token-id payload-decoded))
        (source-address (get source-address payload-decoded))
        (recipient (unwrap-panic (from-consensus-buff? principal (get destination-address payload-decoded))))
        (amount (get amount payload-decoded))
        (data (get data payload-decoded))
        (token-info (unwrap! (map-get? token-managers token-id) ERR-TOKEN-NOT-FOUND))
        (data-is-empty (> (len data) u0))
    )
    (asserts! (var-get is-started) ERR-NOT-STARTED)
    (asserts! (is-eq (get manager-address token-info) (contract-of token-manager)) ERR-TOKEN-MANAGER-MISMATCH)
    (try! (as-contract
        (contract-call? .gateway validate-message source-chain message-id source-address (keccak256 payload))
    ))
    (try! (contract-call? token-manager give-token token recipient amount))
    (print {
        type: "interchain-transfer-received",
        token-id: token-id,
        source-chain: source-chain,
        source-address: source-address,
        destination-address: recipient,
        amount: amount,
        data: (if data-is-empty (keccak256 data) EMPTY-32-BYTES),
    })
    (if data-is-empty
        (ok 0x)
        (let (
            (destination-contract-unwrapped (unwrap! destination-contract ERR-INVALID-DESTINATION-ADDRESS))
        ) 
            (asserts! (is-eq (contract-of destination-contract-unwrapped) recipient) ERR-INVALID-DESTINATION-ADDRESS)
            (as-contract 
                (contract-call? destination-contract-unwrapped execute-with-interchain-token 
                    message-id source-chain source-address data token-id (contract-of token) amount))))))


;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

(define-constant ERR-STARTED (err u4051))
(define-constant ERR-NOT-STARTED (err u4052))

(define-data-var interchain-token-factory principal NULL-ADDRESS)
(define-data-var gas-service principal NULL-ADDRESS)
(define-data-var gatway principal NULL-ADDRESS)
(define-data-var is-started bool false)

(define-read-only (get-is-started) (var-get is-started))

(define-private (extract-and-set-trusted-address 
    (entry {chain-name: (string-ascii 18), address: (string-ascii 48)})) 
        (map-set trusted-chain-address (get chain-name entry) (get address entry)))
;; Constructor function
;; @returns (response true) or reverts
(define-public (setup
    (its-contract-address-name (string-ascii 48))
    (interchain-token-factory-address principal)
    (gateway-address principal)
    (gas-service-address principal)
    (operator-address principal)
    (trusted-chain-names-addresses (list 50 {chain-name: (string-ascii 18), address: (string-ascii 48)}))
)
    (begin
        (asserts! (not (var-get is-started)) ERR-STARTED)
        (asserts! (is-eq contract-caller OWNER) ERR-NOT-AUTHORIZED)
        (var-set is-started true)
        ;; #[allow(unchecked_data)]
        (var-set its-contract-name its-contract-address-name)
        ;; #[allow(unchecked_data)]
        (var-set interchain-token-factory interchain-token-factory-address)
        ;; #[allow(unchecked_data)]
        (var-set gatway gateway-address)
        ;; #[allow(unchecked_data)]
        (var-set gas-service gas-service-address)
        ;; #[allow(unchecked_data)]
        (var-set operator operator-address)
        (map extract-and-set-trusted-address trusted-chain-names-addresses)
        (ok true)
    )
)

(define-public (set-flow-limit (token-id (buff 32)) (token-manager <token-manager-trait>) (limit uint)) 
    (let
        (
            (token-info (unwrap! (map-get? token-managers token-id) ERR-TOKEN-NOT-FOUND))
        )
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (try! (require-not-paused))
        (asserts! (is-eq (get-operator) contract-caller) ERR-ONLY-OPERATOR)
        (asserts! (is-eq (get manager-address token-info) (contract-of token-manager)) ERR-TOKEN-MANAGER-MISMATCH)
        (contract-call? token-manager set-flow-limit limit)))