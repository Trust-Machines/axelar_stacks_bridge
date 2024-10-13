
;; title: interchain-token-factory
;; version:
;; summary:
;; description:
;; This contract is responsible for deploying new interchain tokens and managing their token managers.

;; traits
;;

;; token definitions
;;

;; constants
;;

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
    (ok
        (keccak256 
            (concat
                (concat PREFIX-INTERCHAIN-TOKEN-SALT chain-name-hash_)
                (concat 
                    (unwrap-panic (to-consensus-buff? deployer))
                    salt)))))

;; Calculates the salt for a canonical interchain token.
;; @param chain-name-hash The hash of the chain name.
;; @param token-address The address of the token.
;; @return salt The calculated salt for the interchain token.
(define-read-only (get-canonical-interchain-token-salt (chain-name-hash_ (buff 32)) (token-address principal))
    (ok 
        (keccak256 
            (concat 
                (concat PREFIX-CANONICAL-TOKEN-SALT chain-name-hash_) 
                (unwrap-panic (to-consensus-buff? token-address))))))

;;     /**
;;      * @notice Computes the ID for an interchain token based on the deployer and a salt.
;;      * @param deployer The address that deployed the interchain token.
;;      * @param salt A unique identifier used in the deployment process.
;;      * @return tokenId The ID of the interchain token.
;;      */
;;     function interchainTokenId(address deployer, bytes32 salt) public view returns (bytes32 tokenId) {
;;         tokenId = interchainTokenService.interchainTokenId(TOKEN_FACTORY_DEPLOYER, interchainTokenSalt(chainNameHash, deployer, salt));
;;     }

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

;;     /**
;;      * @notice Retrieves the address of an interchain token based on the deployer and a salt.
;;      * @param deployer The address that deployed the interchain token.
;;      * @param salt A unique identifier used in the deployment process.
;;      * @return tokenAddress The address of the interchain token.
;;      */
;;     function interchainTokenAddress(address deployer, bytes32 salt) public view returns (address tokenAddress) {
;;         tokenAddress = interchainTokenService.interchainTokenAddress(interchainTokenId(deployer, salt));
;;     }

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

;;     /**
;;      * @notice Registers a canonical token as an interchain token and deploys its token manager.
;;      * @param tokenAddress The address of the canonical token.
;;      * @return tokenId The tokenId corresponding to the registered canonical token.
;;      */
;;     function registerCanonicalInterchainToken(address tokenAddress) external payable returns (bytes32 tokenId) {
;;         bytes memory params = abi.encode('', tokenAddress);
;;         bytes32 salt = canonicalInterchainTokenSalt(chainNameHash, tokenAddress);

;;         tokenId = interchainTokenService.deployTokenManager(salt, '', TokenManagerType.LOCK_UNLOCK, params, 0);
;;     }
(define-public (register-canonical-interchain-token (token-address principal))
    (ok true))

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
