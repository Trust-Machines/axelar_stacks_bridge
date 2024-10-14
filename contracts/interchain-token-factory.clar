
;; title: interchain-token-factory
;; version:
;; summary:
;; description:
;; This contract is responsible for deploying new interchain tokens and managing their token managers.

;; traits
;;
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
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

;; data vars
;;

;; data maps
;;

;; public functions
;;

;; read only functions
;;

;; private functions
;;


(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-factory"))))
(define-constant PREFIX-CANONICAL-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "canonical-token-salt"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-salt"))))
(define-constant PREFIX-GATEWAY-TOKEN-SALT (keccak256 (unwrap-panic (to-consensus-buff? "gateway-token-salt"))))
(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) 0x0000000000000000000000000000000000000000)))
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

;;     /**
;;      * @notice Computes the ID for an interchain token based on the deployer and a salt.
;;      * @param deployer The address that deployed the interchain token.
;;      * @param salt A unique identifier used in the deployment process.
;;      * @return tokenId The ID of the interchain token.
;;      */
;;     function interchainTokenId(address deployer, bytes32 salt) public view returns (bytes32 tokenId) {
;;         tokenId = interchainTokenService.interchainTokenId(TOKEN_FACTORY_DEPLOYER, interchainTokenSalt(chainNameHash, deployer, salt));
;;     }

(define-private (interchain-token-id (deployer principal) (salt (buff 32)))
    (ok (contract-call? .interchain-token-service interchain-token-id TOKEN-FACTORY-DEPLOYER 
        (get-interchain-token-salt CHAIN-NAME-HASH deployer salt))))

;;     /**
;;      * @notice Computes the ID for a canonical interchain token based on its address.
;;      * @param tokenAddress The address of the canonical interchain token.
;;      * @return tokenId The ID of the canonical interchain token.
;;      */
;;     function canonicalInterchainTokenId(address tokenAddress) public view returns (bytes32 tokenId) {
;;         tokenId = interchainTokenService.interchainTokenId(
;;             TOKEN_FACTORY_DEPLOYER,
;;             canonicalInterchainTokenSalt(chainNameHash, tokenAddress)
;;         );
;;     }

(define-private (canonical-interchain-token-id (token-address principal))
    (ok (contract-call? .interchain-token-service interchain-token-id TOKEN-FACTORY-DEPLOYER (get-canonical-interchain-token-salt CHAIN-NAME-HASH token-address))))

;;     /**
;;      * @notice Retrieves the address of an interchain token based on the deployer and a salt.
;;      * @param deployer The address that deployed the interchain token.
;;      * @param salt A unique identifier used in the deployment process.
;;      * @return tokenAddress The address of the interchain token.
;;      */
;;     function interchainTokenAddress(address deployer, bytes32 salt) public view returns (address tokenAddress) {
;;         tokenAddress = interchainTokenService.interchainTokenAddress(interchainTokenId(deployer, salt));
;;     }

;; (define-private (interchain-token-address (deployer principal) (salt (buff 32)))
;;     (ok (contract-call? .interchain-token-service interchain-token-address (unwrap! (interchain-token-id deployer salt)))))

;;     /**
;;      * @notice Deploys a new interchain token with specified parameters.
;;      * @dev Creates a new token and optionally mints an initial amount to a specified minter.
;;      * @param salt The unique salt for deploying the token.
;;      * @param name The name of the token.
;;      * @param symbol The symbol of the token.
;;      * @param decimals The number of decimals for the token.
;;      * @param initialSupply The amount of tokens to mint initially (can be zero), allocated to the msg.sender.
;;      * @param minter The address to receive the minter and operator role of the token, in addition to ITS. If it is set to `address(0)`,
;;      * the additional minter isn't set, and can't be added later. This allows creating tokens that are managed only by ITS, reducing trust assumptions.
;;      * Reverts if the minter is the ITS address since it's already added as a minter.
;;      * @return tokenId The tokenId corresponding to the deployed InterchainToken.
;;      */
;;     function deployInterchainToken(
;;         bytes32 salt,
;;         string calldata name,
;;         string calldata symbol,
;;         uint8 decimals,
;;         uint256 initialSupply,
;;         address minter
;;     ) external payable returns (bytes32 tokenId) {
;;         address sender = msg.sender;
;;         salt = interchainTokenSalt(chainNameHash, sender, salt);
;;         bytes memory minterBytes = new bytes(0);

;;         if (initialSupply > 0) {
;;             minterBytes = address(this).toBytes();
;;         } else if (minter != address(0)) {
;;             if (minter == address(interchainTokenService)) revert InvalidMinter(minter);

;;             minterBytes = minter.toBytes();
;;         }

;;         tokenId = _deployInterchainToken(salt, '', name, symbol, decimals, minterBytes, 0);

;;         if (initialSupply > 0) {
;;             IInterchainToken token = IInterchainToken(interchainTokenService.interchainTokenAddress(tokenId));
;;             ITokenManager tokenManager = ITokenManager(interchainTokenService.tokenManagerAddress(tokenId));

;;             token.mint(sender, initialSupply);

;;             token.transferMintership(minter);
;;             tokenManager.removeFlowLimiter(address(this));

;;             // If minter == address(0), we still set it as a flow limiter for consistency with the remote token manager.
;;             tokenManager.addFlowLimiter(minter);

;;             tokenManager.transferOperatorship(minter);
;;         }
;;     }

;; (define-public (deploy-interchain-token (salt (buff 32)) (name (string-ascii 32)) (symbol (string-ascii 32)) (decimals uint) (initial-supply uint) (minter principal))
;;     (let
;;         (
;;             (sender tx-sender)
;;             (salt (unwrap! (get-interchain-token-salt CHAIN-NAME-HASH sender salt)))
;;         )
;;         (begin
;;             (if (> initial-supply u0)
;;                 (let ((minter-bytes (unwrap-panic (to-consensus-buff? sender))))
;;                     (ok true)
;;                 )
;;                 (if (is-eq minter NULL-ADDRESS)
;;                     (ok true)
;;                     (if (is-eq minter ITS)
;;                         (err u1007) ;; InvalidMinter
;;                         (let ((minter-bytes (unwrap-panic (to-consensus-buff? minter))))
;;                             (ok true)
;;                         )
;;                     )
;;                 )
;;             )
;;             (let ((token-id (unwrap! (deploy-interchain-token_ salt "" name symbol decimals minter-bytes u0))))
;;                 (if (> initial-supply u0)
;;                     (let
;;                         (
;;                             (token (contract-call? ITS interchain-token-address token-id))
;;                             (token-manager (contract-call? ITS token-manager-address token-id))
;;                         )
;;                         (begin
;;                             (contract-call? token mint sender initial-supply)
;;                             (contract-call? token transfer-mintership minter)
;;                             (contract-call? token-manager remove-flow-limiter sender)
;;                             (contract-call? token-manager add-flow-limiter minter)
;;                             (contract-call? token-manager transfer-operatorship minter)
;;                             (ok token-id)
;;                         )
;;                     )
;;                     (ok token-id)
;;                 )
;;             )
;;         )
;;     )
;; )

;;     /**
;;      * @notice Deploys a remote interchain token on a specified destination chain.
;;      * @param salt The unique salt for deploying the token.
;;      * @param minter The address to receive the minter and operator role of the token, in addition to ITS. If the address is `address(0)`,
;;      * no additional minter is set on the token. Reverts if the minter does not have mint permission for the token.
;;      * @param destinationChain The name of the destination chain.
;;      * @param gasValue The amount of gas to send for the deployment.
;;      * @return tokenId The tokenId corresponding to the deployed InterchainToken.
;;      */
;;     function deployRemoteInterchainToken(
;;         bytes32 salt,
;;         address minter,
;;         string memory destinationChain,
;;         uint256 gasValue
;;     ) public payable returns (bytes32 tokenId) {
;;         string memory tokenName;
;;         string memory tokenSymbol;
;;         uint8 tokenDecimals;
;;         bytes memory minter_ = new bytes(0);

;;         salt = interchainTokenSalt(chainNameHash, msg.sender, salt);
;;         tokenId = interchainTokenService.interchainTokenId(TOKEN_FACTORY_DEPLOYER, salt);

;;         IInterchainToken token = IInterchainToken(interchainTokenService.interchainTokenAddress(tokenId));

;;         tokenName = token.name();
;;         tokenSymbol = token.symbol();
;;         tokenDecimals = token.decimals();

;;         if (minter != address(0)) {
;;             if (!token.isMinter(minter)) revert NotMinter(minter);
;;             if (minter == address(interchainTokenService)) revert InvalidMinter(minter);

;;             minter_ = minter.toBytes();
;;         }

;;         tokenId = _deployInterchainToken(salt, destinationChain, tokenName, tokenSymbol, tokenDecimals, minter_, gasValue);
;;     }

;; (define-public (deploy-remote-interchain-token (salt (buff 32)) (minter principal) (destination-chain (string-ascii 32)) (gas-value uint))
;;     (let
;;         (
;;             (salt (unwrap! (get-interchain-token-salt CHAIN-NAME-HASH tx-sender salt)))
;;             (token-id (unwrap! (contract-call? ITS interchain-token-id TOKEN-FACTORY-DEPLOYER salt)))
;;             (token (contract-call? ITS interchain-token-address token-id))
;;             (token-name (contract-call? token name))
;;             (token-symbol (contract-call? token symbol))
;;             (token-decimals (contract-call? token decimals))
;;         )
;;         (begin
;;             (let
;;                 (
                    
;;                 )
;;                 (if (is-eq minter NULL-ADDRESS)
;;                     (ok true)
;;                     (if (is-eq minter ITS)
;;                         (err u1007) ;; InvalidMinter
;;                         (if (is-eq (contract-call? token is-minter minter) true)
;;                             (let ((minter-bytes (unwrap-panic (to-consensus-buff? minter))))
;;                                 (ok true)
;;                             )
;;                             (err u1008) ;; NotMinter
;;                         )
;;                     )
;;                 )
;;             )
;;             (ok (unwrap! (deploy-interchain-token_ salt destination-chain token-name token-symbol token-decimals minter-bytes gas-value)))
;;         )
;;     )
;; )

;;     /**
;;      * @notice Deploys a new interchain token with specified parameters.
;;      * @param salt The unique salt for deploying the token.
;;      * @param destinationChain The name of the destination chain.
;;      * @param tokenName The name of the token.
;;      * @param tokenSymbol The symbol of the token.
;;      * @param tokenDecimals The number of decimals for the token.
;;      * @param minter The address to receive the initially minted tokens.
;;      * @param gasValue The amount of gas to send for the transfer.
;;      * @return tokenId The tokenId corresponding to the deployed InterchainToken.
;;      */
;;     function _deployInterchainToken(
;;         bytes32 salt,
;;         string memory destinationChain,
;;         string memory tokenName,
;;         string memory tokenSymbol,
;;         uint8 tokenDecimals,
;;         bytes memory minter,
;;         uint256 gasValue
;;     ) internal returns (bytes32 tokenId) {
;;         // slither-disable-next-line arbitrary-send-eth
;;         tokenId = interchainTokenService.deployInterchainToken{ value: gasValue }(
;;             salt,
;;             destinationChain,
;;             tokenName,
;;             tokenSymbol,
;;             tokenDecimals,
;;             minter,
;;             gasValue
;;         );
;;     }


;; (define-private (deploy-interchain-token_ (salt (buff 32)) 
;;     (destination-chain (string-ascii 32)) 
;;     (token-name (string-ascii 32)) 
;;     (token-symbol (string-ascii 32)) 
;;     (token-decimals uint) 
;;     (minter (buff 32)) 
;;     (gas-value uint))
;;     (ok (contract-call? .interchain-token-service deploy-interchain-token
;;             salt destination-chain token-name token-symbol token-decimals minter gas-value)))


;; Registers a canonical token as an interchain token and deploys its token manager.
;; @param tokenAddress The address of the canonical token.
;; @return tokenId The tokenId corresponding to the registered canonical token.
(define-public (register-canonical-interchain-token (token-address <sip-010-trait>) (token-manager-address principal))
    (contract-call? 
        .interchain-token-service deploy-canonical-token-manager
            (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token-address)) 
            "" 
            TOKEN-TYPE-LOCK-UNLOCK 
            token-address 
            token-manager-address 
            u0)
)

;; (define-public (register-canonical-interchain-token (token-address principal))
;;     (ok true))

;;     /**
;;      * @notice Deploys a canonical interchain token on a remote chain.
;;      * @param originalTokenAddress The address of the original token on the original chain.
;;      * @param destinationChain The name of the chain where the token will be deployed.
;;      * @param gasValue The gas amount to be sent for deployment.
;;      * @return tokenId The tokenId corresponding to the deployed InterchainToken.
;;      */
;;     function deployRemoteCanonicalInterchainToken(
;;         address originalTokenAddress,
;;         string calldata destinationChain,
;;         uint256 gasValue
;;     ) public payable returns (bytes32 tokenId) {
;;         bytes32 salt;
;;         IInterchainToken token;

;;         // This ensures that the token manager has been deployed by this address, so it's safe to trust it.
;;         salt = canonicalInterchainTokenSalt(chainNameHash, originalTokenAddress);
;;         tokenId = interchainTokenService.interchainTokenId(TOKEN_FACTORY_DEPLOYER, salt);
;;         token = IInterchainToken(interchainTokenService.validTokenAddress(tokenId));

;;         // The 3 lines below will revert if the token does not exist.
;;         string memory tokenName = token.name();
;;         string memory tokenSymbol = token.symbol();
;;         uint8 tokenDecimals = token.decimals();

;;         tokenId = _deployInterchainToken(salt, destinationChain, tokenName, tokenSymbol, tokenDecimals, '', gasValue);
;;     }
(define-constant ERR-TOKEN-NOT-ENABLED (err u1051))
(define-public (deploy-remote-canonical-interchain-token (token <sip-010-trait>) (destination-chain (string-ascii 32)) (gas-value uint))
    (let
        (
            (salt (get-canonical-interchain-token-salt CHAIN-NAME-HASH (contract-of token)))
            (token-id (unwrap-panic (interchain-token-id TOKEN-FACTORY-DEPLOYER salt)))
            (token-name (unwrap-panic (contract-call? token get-name)))
            (token-symbol (unwrap-panic (contract-call? token get-symbol)))
            (token-decimals (unwrap-panic (contract-call? token get-decimals)))
        )
        (asserts! (unwrap-panic (contract-call? .interchain-token-service valid-token-address token-id)) ERR-TOKEN-NOT-ENABLED)
        ;; (tokenId (deploy-interchain-token! salt destination-chain token-id tokenName tokenSymbol tokenDecimals gasValue))
        ;; (ok (deploy-interchain-token_ salt destination-chain token-name token-symbol token-decimals (buff 0) gas-value))
        ;; (ok true)
        ;; "pay gas not implemented"
        (err u0)
    )
)
