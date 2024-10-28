

(define-trait interchain-token-service-trait (

(get-chain-name-hash () (response (buff 32) uint))
(interchain-transfer ((buff 32) (string-ascii 32) (string-ascii 128) uint (buff 32) uint) (response bool uint))
;;     /**
;;      * @notice Initiates an interchain call contract with interchain token to a destination chain.
;;      * @param tokenId The unique identifier of the token to be transferred.
;;      * @param destinationChain The destination chain to send the tokens to.
;;      * @param destinationAddress The address on the destination chain to send the tokens to.
;;      * @param amount The amount of tokens to be transferred.
;;      * @param data Additional data to be passed along with the transfer.
;;      */
(call-contract-with-interchain-token ((buff 32) (string-ascii 32) (string-ascii 128) uint (buff 32) uint) (response bool uint))
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