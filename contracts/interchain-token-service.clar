
;; title: interchain-token-service
;; version:
;; summary:
;; description:

;; traits
;;
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; token definitions
;;

;; constants
;;

(define-constant ERR-NOT-AUTHORIZED (err u1051))
(define-constant ERR-PAUSED (err u1052))
(define-constant OWNER tx-sender)
(define-data-var is-paused bool false)

(define-map tokens-managers (buff 32) 
    {
        token-address: principal,
        manager-address: principal,
        token-type: uint,
        is-enabled: bool,
        ;; operator: principal,
    })

(define-public (set-paused (status bool))
    (begin 
        (asserts! (is-eq tx-sender OWNER) ERR-NOT-AUTHORIZED)
        (ok (var-set is-paused status))))

(define-read-only (get-is-paused) 
    (ok (var-get is-paused)))

(define-private (require-not-paused) 
    (ok (asserts! (not (var-get is-paused)) ERR-PAUSED)))

(define-constant GATEWAY .gateway)
(define-constant GAS-SERVICE .gas-service)
;; (define-constant TOKEN-MANAGER-DEPLOYER tx-sender)
;; (define-constant INTERCHAIN-TOKEN-DEPLOYER tx-sender)
;; (define-constant INTERCHAIN-TOKEN-FACTORY .interchain-token-factory)
(define-constant CHAIN-NAME "Stacks")
(define-constant CHAIN-NAME-HASH (keccak256 (unwrap-panic (to-consensus-buff? CHAIN-NAME))))
;; (define-constant TOKEN-MANAGER none)
(define-constant TOKEN-HANDLER none)
(define-constant GATEWAY-CALLER none)
(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-service"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-ID (keccak256 (unwrap-panic (to-consensus-buff? "its-interchain-token-id"))))


;;  * @dev Chain name where ITS Hub exists. This is used for routing ITS calls via ITS hub.
;;  * This is set as a constant, since the ITS Hub will exist on Axelar.
(define-constant ITS-HUB-CHAIN-NAME "axelarnet")
;; FIXME: This will probably be something else
(define-constant ITS-HUB-ADDRESS "axelarnet1xyz")
(define-constant ITS-HUB-CHAIN-NAME-HASH (keccak256 (unwrap-panic (to-consensus-buff? "axelarnet"))))

;;  * @dev Special identifier that the trusted address for a chain should be set to, which indicates if the ITS call
;;  * for that chain should be routed via the ITS hub.
(define-constant ITS-HUB-ROUTING-IDENTIFIER "hub")
(define-constant ITS-HUB-ROUTING-IDENTIFIER-HASH (keccak256 (unwrap-panic (to-consensus-buff? "hub"))))

(define-constant MESSAGE-TYPE-INTERCHAIN-TRANSFER u0)
(define-constant MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN u1)
(define-constant MESSAGE-TYPE-DEPLOY-TOKEN-MANAGER u2)
(define-constant MESSAGE-TYPE-SEND-TO-HUB u3)
(define-constant MESSAGE-TYPE-RECEIVE-FROM-HUB u4)


(define-read-only (get-chain-name-hash) 
    (ok CHAIN-NAME-HASH))

(define-read-only (get-gateway) 
    (ok GATEWAY))

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
        (asserts! (is-eq (var-get is-paused) false) ERR-PAUSED)
        (asserts! (is-eq tx-sender (var-get operator)) ERR-ONLY-OPERATOR)
        ;; #[allow(unchecked_data)]
        (var-set operator new-operator)
        (print {action: "transfer-operatorship", new-operator: new-operator})
        (ok u1)
    )
)
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) 0x0000000000000000000000000000000000000000)))

;; ####################
;; ####################
;; ### address tracking ###
;; ####################
;; ####################

(define-constant ITS .interchain-token-service)
(define-map trusted-chain-address (string-ascii 18) (string-ascii 48))

(map-set trusted-chain-address ITS-HUB-CHAIN-NAME ITS-HUB-ADDRESS)

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
(define-private (set-trusted-address (chain-name (string-ascii 18)) (address (string-ascii 48)))
    (begin
        ;; (asserts!  (is-eq tx-sender ITS) ERR-NOT-AUTHORIZED)
        (print {
            type: "trusted-address-set",
            chain: chain-name,
            address: address
        })
        (ok (map-set trusted-chain-address chain-name address))))

;; Remove the trusted address of the chain.
;; @param chain Chain name that should be made untrusted
(define-private (remove-trusted-address  (chain-name  (string-ascii 18)))
    (begin
        ;; (asserts!  (is-eq tx-sender ITS) ERR-NOT-AUTHORIZED)
        (print {
            type: "trusted-address-removed",
            chain: chain-name
        })
        (ok (map-delete trusted-chain-address chain-name))))

(define-constant ERR-UNTRUSTED-CHAIN (err u3051))
(define-constant ERR-TOKEN-NOT-FOUND (err u3052))

(define-private (get-call-params (destination-chain (string-ascii 18)) (payload (buff 1024)))
    (let (
            (destination-address (unwrap! (get-trusted-address destination-chain) ERR-UNTRUSTED-CHAIN))
            (destination-address-hash (keccak256 (unwrap-panic (to-consensus-buff? destination-address)))))
        ;; Prevent sending directly to the ITS Hub chain. This is not supported yet, 
        ;; so fail early to prevent the user from having their funds stuck.
        (asserts! (not (is-eq destination-chain ITS-HUB-CHAIN-NAME)) ERR-UNTRUSTED-CHAIN)
        (ok (if (is-eq destination-address-hash ITS-HUB-ROUTING-IDENTIFIER-HASH)
            {
                ;; Wrap ITS message in an ITS Hub message
                destination-address: (unwrap-panic (get-trusted-address ITS-HUB-CHAIN-NAME)),
                destination-chain: ITS-HUB-CHAIN-NAME,
                payload: (unwrap-panic (to-consensus-buff? {
                    type: MESSAGE-TYPE-SEND-TO-HUB,
                    destination-chain: destination-chain,
                    payload: payload,
                })),
            }
            {
                destination-address: destination-address,
                destination-chain: destination-chain,
                payload: payload,
            }))))

;; (define-public (deploy-interchain-token) )

;; @notice Calls a contract on a specific destination chain with the given payload
;; @dev This method also determines whether the ITS call should be routed via the ITS Hub.
;; If the `trustedAddress(destinationChain) == 'hub'`, then the call is wrapped and routed to the ITS Hub destination.
;; @param destinationChain The target chain where the contract will be called.
;; @param payload The data payload for the transaction.
;; @param gasValue The amount of gas to be paid for the transaction.
(define-private (call-contract (destination-chain (string-ascii 18)) (payload (buff 1024)) (metadata-version uint) (gas-value uint))
    (let
        (
            (params (unwrap-panic (get-call-params destination-chain payload)))
            (destination-chain_ (get destination-chain params))
            (destination-address_ (get destination-address params))
            (payload_ (get payload params))
        )
        (as-contract (contract-call? .gateway call-contract destination-chain destination-address_ payload))
    )
)

;; (define-private (register-canonical-token (token-address principal) (token-manager principal))
;;     )


;; /**
;;     * @notice Used to deploy remote custom TokenManagers.
;;     * @dev At least the `gasValue` amount of native token must be passed to the function call. `gasValue` exists because this function can be
;;     * part of a multicall involving multiple functions that could make remote contract calls.
;;     * @param salt The salt to be used during deployment.
;;     * @param destinationChain The name of the chain to deploy the TokenManager and standardized token to.
;;     * @param tokenManagerType The type of token manager to be deployed. Cannot be NATIVE_INTERCHAIN_TOKEN.
;;     * @param params The params that will be used to initialize the TokenManager.
;;     * @param gasValue The amount of native tokens to be used to pay for gas for the remote deployment.
;;     * @return tokenId The tokenId corresponding to the deployed TokenManager.
;;     * @notice 
;;     */
;; function deployTokenManager(
;;     bytes32 salt,
;;     string calldata destinationChain,
;;     TokenManagerType tokenManagerType,
;;     bytes calldata params,
;;     uint256 gasValue
;; ) external payable whenNotPaused returns (bytes32 tokenId) {
;;     // Custom token managers can't be deployed with native interchain token type, which is reserved for interchain tokens
;;     if (tokenManagerType == TokenManagerType.NATIVE_INTERCHAIN_TOKEN) revert CannotDeploy(tokenManagerType);

;;     address deployer = msg.sender;

;;     if (deployer == interchainTokenFactory) {
;;         // rares zero address (null address) is deployer
;;         deployer = TOKEN_FACTORY_DEPLOYER;
;;     }

;;     tokenId = interchainTokenId(deployer, salt);

;;     emit InterchainTokenIdClaimed(tokenId, deployer, salt);

;;     if (bytes(destinationChain).length == 0) {
;;         _deployTokenManager(tokenId, tokenManagerType, params);
;;     } else {
;;         if (chainNameHash == keccak256(bytes(destinationChain))) revert CannotDeployRemotelyToSelf();

;;         _deployRemoteTokenManager(tokenId, destinationChain, gasValue, tokenManagerType, params);
;;     }
;; }

(define-public (deploy-canonical-token-manager
        (salt (buff 32))
        (destination-chain (string-ascii 18))
        (token-manager-type uint)
        (token <sip-010-trait>)
        (token-manager-address principal)
        (gas-value uint))
    (let (
        (deployer (if (is-eq tx-sender (var-get interchain-token-factory)) NULL-ADDRESS tx-sender))
        (token-id (interchain-token-id deployer salt))
    )
    (print {
        type: "interchain-token-id-claimed",
        token-id: token-id,
        deployer: deployer,
        salt: salt,
    })
    (map-set tokens-managers token-id {
        token-address: (contract-of token),
        manager-address: token-manager-address,
        token-type: token-manager-type,
        is-enabled: false,
    })
    (as-contract 
        (contract-call? .gateway call-contract CHAIN-NAME (var-get its-contract-name) (unwrap-panic (to-consensus-buff? {
            token-address: (contract-of token),
            token-manager-address: token-manager-address,
            token-id: token-id,
    }))))))

(define-public (execute-enable-token
        (message-id (string-ascii 71)) 
        (token-id (buff 32))
        (token-address principal) 
        (token-manager-address principal))
    (let (
        ;; #[filter(token-id)]
        (token-info (unwrap! (map-get? tokens-managers token-id) ERR-TOKEN-NOT-FOUND))
    )
        (try!
            (as-contract (contract-call? .gateway validate-message CHAIN-NAME message-id 
                (var-get its-contract-name)
                (keccak256 (unwrap-panic (to-consensus-buff? {
                    token-address: token-address,
                    token-manager-address: token-manager-address,
            }))))))
        (map-set tokens-managers token-id (merge token-info {is-enabled: true}))
        ;; emit TokenManagerDeployed(tokenId, tokenManager_, tokenManagerType, params);
        (print {
            type: "token-manager-deployed",
            token-id: token-id,
            token-manager: token-manager-address,
            token-type: (get token-type token-info),
        })
        (ok true)
    ))

(define-read-only (valid-token-address (token-id (buff 32))) 
    (ok (default-to false (get is-enabled (map-get? tokens-managers token-id)))))

;; So this is what I have got so far the factory gets called with the 
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
        (asserts! (is-eq (var-get is-started) false) ERR-STARTED)
        (var-set is-started true)
        ;; FIXME: should there be any checks here
        ;; #[allow(unchecked_data)]
        (var-set its-contract-name its-contract-address-name)
        ;; #[allow(unchecked_data)]
        (var-set interchain-token-factory interchain-token-factory_)
        (ok true)
    )
)
