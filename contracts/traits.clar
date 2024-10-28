(define-trait gateway-trait
	(
		(call-contract ((string-ascii 20) (string-ascii 128) (buff 64000)) (response bool uint))
        (approve-messages ((buff 4096) (buff 16384)) (response bool uint))
        (validate-message ((string-ascii 20) (string-ascii 128) (string-ascii 128) (buff 32)) (response bool uint))
        (is-message-approved  ((string-ascii 20) (string-ascii 128) (string-ascii 128) principal (buff 32)) (response bool uint))
        (is-message-executed  ((string-ascii 20) (string-ascii 128)) (response bool uint))
        (rotate-signers ((buff 8192) (buff 16384)) (response bool uint))
	)
)

(define-trait gas-service-trait
	(
		(pay-native-gas-for-contract-call (uint principal (string-ascii 20) (string-ascii 128) (buff 64000) principal) (response bool uint))
        (add-native-gas (uint (buff 32) uint principal) (response bool uint))
	)
)

(define-trait interchain-token-executable-trait (
    (execute-with-interchain-token (
        ;; sourceChain,
        ;; messageId,
        ;; sourceAddress,
        ;; data,
        ;; tokenId,
        ;; tokenAddress,
        ;; amount
        (string-ascii 20)
        (string-ascii 128)
        (buff 128)
        (buff 64000)
        (buff 32)
        principal
        uint
        ;; must return keccak256('its-execute-success')
    ) (response (buff 32) uint))
))

(define-trait interchain-token-service-trait (
    (get-chain-name-hash () (response (buff 32) uint))
    (interchain-transfer ((buff 32) (string-ascii 20) (string-ascii 128) uint (buff 32) uint) (response bool uint))
    ;;     /**
    ;;      * @notice Initiates an interchain call contract with interchain token to a destination chain.
    ;;      * @param tokenId The unique identifier of the token to be transferred.
    ;;      * @param destinationChain The destination chain to send the tokens to.
    ;;      * @param destinationAddress The address on the destination chain to send the tokens to.
    ;;      * @param amount The amount of tokens to be transferred.
    ;;      * @param data Additional data to be passed along with the transfer.
    ;;      */
    (call-contract-with-interchain-token ((buff 32) (string-ascii 20) (buff 128) uint (buff 32) uint) (response bool uint))
    ;;     /**
    ;;      * @notice Sets the flow limits for multiple tokens.
    ;;      * @param tokenIds An array of tokenIds.
    ;;      * @param flowLimits An array of flow limits corresponding to the tokenIds.
    ;;      */
    (set-flow-limits ((list 32  (buff 32)) (list 32 uint)) (response bool uint))
    ;;     /**
    ;;      * @notice Returns the flow limit for a specific token.
    ;;      * @param tokenId The tokenId of the token.
    ;;      * @return flowLimit_ The flow limit for the token.
    ;;      */
    (get-flow-limit ((buff 32)) (response uint uint))
    ;;     /**
    ;;      * @notice Returns the total amount of outgoing flow for a specific token.
    ;;      * @param tokenId The tokenId of the token.
    ;;      * @return flowOutAmount_ The total amount of outgoing flow for the token.
    ;;      */
    (get-flow-out-amount ((buff 32))  (response uint uint))
    ;;     /**
    ;;      * @notice Returns the total amount of incoming flow for a specific token.
    ;;      * @param tokenId The tokenId of the token.
    ;;      * @return flowInAmount_ The total amount of incoming flow for the token.
    ;;      */
    (get-flow-in-amount ((buff 32))  (response uint uint))
    ;;     /**
    ;;      * @notice Allows the owner to pause/unpause the token service.
    ;;      * @param paused whether to pause or unpause.
    ;;      */
    (set-pause-status (bool) (response bool uint))
))

(define-trait sip-010-trait
  (
    ;; Transfer from the caller to a new principal
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    ;; the human readable name of the token
    (get-name () (response (string-ascii 32) uint))
    ;; the ticker symbol, or empty if none
    (get-symbol () (response (string-ascii 32) uint))
    ;; the number of decimals used, e.g. 6 would mean 1_000_000 represents 1 token
    (get-decimals () (response uint uint))
    ;; the balance of the passed principal
    (get-balance (principal) (response uint uint))
    ;; the current total supply (which does not need to be a constant)
    (get-total-supply () (response uint uint))
    ;; an optional URI that represents metadata of this token
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

(define-trait native-interchain-token-trait
  (
    ;; Transfer from the caller to a new principal
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))

    ;; the human readable name of the token
    (get-name () (response (string-ascii 32) uint))

    ;; the ticker symbol, or empty if none
    (get-symbol () (response (string-ascii 32) uint))

    ;; the number of decimals used, e.g. 6 would mean 1_000_000 represents 1 token
    (get-decimals () (response uint uint))

    ;; the balance of the passed principal
    (get-balance (principal) (response uint uint))

    ;; the current total supply (which does not need to be a constant)
    (get-total-supply () (response uint uint))

    ;; an optional URI that represents metadata of this token

    (get-token-uri () (response (optional (string-utf8 256)) uint))
    (add-flow-limiter (principal) (response bool uint))
    (remove-flow-limiter ( principal) (response bool uint))
    (is-flow-limiter (principal) (response bool uint))
    (get-flow-limit () (response uint uint))
    (set-flow-limit (uint) (response bool uint))
    (get-flow-out-amount () (response uint uint))
    (get-flow-in-amount ()  (response uint uint))
    (take-token (<sip-010-trait> principal uint) (response bool uint))
    (give-token (<sip-010-trait> principal uint) (response bool uint))
    (get-token-address () (response principal uint))
    (get-token-type () (response uint uint))
    (is-minter (principal) (response bool uint))
    (get-operators () (response (list 2 principal) principal))
    (is-operator (principal) (response bool uint))
    (get-token-id () (response (buff 32) uint))
    (mint (principal uint) (response bool uint))
    (burn (principal uint) (response bool uint))
  )
)

(define-trait token-manager-trait (
    (add-flow-limiter (principal) (response bool uint))
    (remove-flow-limiter ( principal) (response bool uint))
    (is-flow-limiter (principal) (response bool uint))
    (get-flow-limit () (response uint uint))
    (set-flow-limit (uint) (response bool uint))
    (get-flow-out-amount () (response uint uint))
    (get-flow-in-amount ()  (response uint uint))
    (take-token (<sip-010-trait> principal uint) (response bool uint))
    (give-token (<sip-010-trait> principal uint) (response bool uint))
    (get-token-address () (response principal uint))
    (get-token-type () (response uint uint))
    (is-minter (principal) (response bool uint))
    (get-operators () (response (list 2 principal) principal))
    (is-operator (principal) (response bool uint))
))
