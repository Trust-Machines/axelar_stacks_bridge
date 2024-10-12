
;; title: interchain-token-service
;; version:
;; summary:
;; description:

;; traits
;;

;; token definitions
;;

;; constants
;;
;;     error InvalidTokenManagerImplementationType(address implementation);
;;     error InvalidChainName();
;;     error NotRemoteService();
;;     error TokenManagerDoesNotExist(bytes32 tokenId);
;;     error ExecuteWithInterchainTokenFailed(address contractAddress);
;;     error ExpressExecuteWithInterchainTokenFailed(address contractAddress);
;;     error GatewayToken();
;;     error TokenManagerDeploymentFailed(bytes error);
;;     error InterchainTokenDeploymentFailed(bytes error);
;;     error InvalidMessageType(uint256 messageType);
;;     error InvalidMetadataVersion(uint32 version);
;;     error ExecuteWithTokenNotSupported();
;;     error InvalidExpressMessageType(uint256 messageType);
;;     error TakeTokenFailed(bytes data);
;;     error GiveTokenFailed(bytes data);
;;     error TokenHandlerFailed(bytes data);
;;     error EmptyData();
;;     error PostDeployFailed(bytes data);
;;     error ZeroAmount();
;;     error CannotDeploy(TokenManagerType);
;;     error CannotDeployRemotelyToSelf();
;;     error InvalidGatewayTokenTransfer(bytes32 tokenId, bytes payload, string tokenSymbol, uint256 amount);
;;     error InvalidPayload();
;;     error GatewayCallFailed(bytes data);

;;     event InterchainTransfer(
;;         bytes32 indexed tokenId,
;;         address indexed sourceAddress,
;;         string destinationChain,
;;         bytes destinationAddress,
;;         uint256 amount,
;;         bytes32 indexed dataHash
;;     );
;;     event InterchainTransferReceived(
;;         bytes32 indexed commandId,
;;         bytes32 indexed tokenId,
;;         string sourceChain,
;;         bytes sourceAddress,
;;         address indexed destinationAddress,
;;         uint256 amount,
;;         bytes32 dataHash
;;     );
;;     event TokenManagerDeploymentStarted(
;;         bytes32 indexed tokenId,
;;         string destinationChain,
;;         TokenManagerType indexed tokenManagerType,
;;         bytes params
;;     );
;;     event InterchainTokenDeploymentStarted(
;;         bytes32 indexed tokenId,
;;         string tokenName,
;;         string tokenSymbol,
;;         uint8 tokenDecimals,
;;         bytes minter,
;;         string destinationChain
;;     );
;;     event TokenManagerDeployed(bytes32 indexed tokenId, address tokenManager, TokenManagerType indexed tokenManagerType, bytes params);
;;     event InterchainTokenDeployed(
;;         bytes32 indexed tokenId,
;;         address tokenAddress,
;;         address indexed minter,
;;         string name,
;;         string symbol,
;;         uint8 decimals
;;     );
;;     event InterchainTokenIdClaimed(bytes32 indexed tokenId, address indexed deployer, bytes32 indexed salt);

(define-constant GATEWAY .gateway)
(define-constant GAS-SERVICE .gas-service)
;; (define-constant TOKEN-MANAGER-DEPLOYER tx-sender)
;; (define-constant INTERCHAIN-TOKEN-DEPLOYER tx-sender)
;; (define-constant INTERCHAIN-TOKEN-FACTORY .interchain-token-factory)
(define-constant CHAIN-NAME-HASH (keccak256 (unwrap-panic (to-consensus-buff? "Stacks"))))
;; (define-constant TOKEN-MANAGER none)
(define-constant TOKEN-HANDLER none)
(define-constant GATEWAY-CALLER none)
(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "interchain-token-service"))))
(define-constant PREFIX-INTERCHAIN-TOKEN-ID (keccak256 (unwrap-panic (to-consensus-buff? "its-interchain-token-id"))))
;;         if (bytes(chainName_).length == 0) revert InvalidChainName();
;;         chainNameHash = keccak256(bytes(chainName_));

;;         tokenManager = tokenManagerImplementation_;
;;         tokenHandler = tokenHandler_;
;;         gatewayCaller = gatewayCaller_;
;; ;; data vars
;;

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
;; private functions
;;

