

(define-trait interchain-token-service-trait (
    ;; // SPDX-License-Identifier: MIT

;; pragma solidity ^0.8.0;

;; import { IAxelarValuedExpressExecutable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarValuedExpressExecutable.sol';
;; import { IMulticall } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IMulticall.sol';
;; import { IPausable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IPausable.sol';
;; import { IUpgradable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IUpgradable.sol';

;; import { ITransmitInterchainToken } from './ITransmitInterchainToken.sol';
;; import { ITokenManagerType } from './ITokenManagerType.sol';
;; import { ITokenManagerImplementation } from './ITokenManagerImplementation.sol';
;; import { IOperator } from './IOperator.sol';
;; import { IAddressTracker } from './IAddressTracker.sol';

;; /**
;;  * @title IInterchainTokenService Interface
;;  * @notice Interface for the Interchain Token Service
;;  */
;; interface IInterchainTokenService is
;;     ITransmitInterchainToken,
;;     ITokenManagerType,
;;     ITokenManagerImplementation,
;;     IAxelarValuedExpressExecutable,
;;     IOperator,
;;     IPausable,
;;     IMulticall,
;;     IAddressTracker,
;;     IUpgradable
;; {

;;     /**
;;      * @notice Returns the address of the token manager deployer contract.
;;      * @return tokenManagerDeployerAddress The address of the token manager deployer contract.
;;      */
;;     function tokenManagerDeployer() external view returns (address tokenManagerDeployerAddress);

;;     /**
;;      * @notice Returns the address of the interchain token deployer contract.
;;      * @return interchainTokenDeployerAddress The address of the interchain token deployer contract.
;;      */
;;     function interchainTokenDeployer() external view returns (address interchainTokenDeployerAddress);

;;     /**
;;      * @notice Returns the address of TokenManager implementation.
;;      * @return tokenManagerAddress_ The address of the token manager contract.
;;      */
;;     function tokenManager() external view returns (address tokenManagerAddress_);

;;     /**
;;      * @notice Returns the address of TokenHandler implementation.
;;      * @return tokenHandlerAddress The address of the token handler contract.
;;      */
;;     function tokenHandler() external view returns (address tokenHandlerAddress);

;;     /**
;;      * @notice Returns the address of the interchain token factory.
;;      * @return address The address of the interchain token factory.
;;      */
;;     function interchainTokenFactory() external view returns (address);

;;     /**
;;      * @notice Returns the hash of the chain name.
;;      * @return bytes32 The hash of the chain name.
;;      */
;;     function chainNameHash() external view returns (bytes32);
(get-chain-name-hash () (response (buff 32) uint))
;;     /**
;;      * @notice Returns the address of the token manager associated with the given tokenId.
;;      * @param tokenId The tokenId of the token manager.
;;      * @return tokenManagerAddress_ The address of the token manager.
;;      */
;;     function tokenManagerAddress(bytes32 tokenId) external view returns (address tokenManagerAddress_);

;;     /**
;;      * @notice Returns the address of the valid token manager associated with the given tokenId.
;;      * @param tokenId The tokenId of the token manager.
;;      * @return tokenManagerAddress_ The address of the valid token manager.
;;      */
;;     function validTokenManagerAddress(bytes32 tokenId) external view returns (address tokenManagerAddress_);

;;     /**
;;      * @notice Returns the address of the token that an existing tokenManager points to.
;;      * @param tokenId The tokenId of the token manager.
;;      * @return tokenAddress The address of the token.
;;      */
;;     function validTokenAddress(bytes32 tokenId) external view returns (address tokenAddress);

;;     /**
;;      * @notice Returns the address of the interchain token associated with the given tokenId.
;;      * @param tokenId The tokenId of the interchain token.
;;      * @return tokenAddress The address of the interchain token.
;;      */
;;     function interchainTokenAddress(bytes32 tokenId) external view returns (address tokenAddress);

;;     /**
;;      * @notice Returns the custom tokenId associated with the given operator and salt.
;;      * @param operator_ The operator address.
;;      * @param salt The salt used for token id calculation.
;;      * @return tokenId The custom tokenId associated with the operator and salt.
;;      */
;;     function interchainTokenId(address operator_, bytes32 salt) external view returns (bytes32 tokenId);

;;     /**
;;      * @notice Deploys a custom token manager contract on a remote chain.
;;      * @param salt The salt used for token manager deployment.
;;      * @param destinationChain The name of the destination chain.
;;      * @param tokenManagerType The type of token manager. Cannot be NATIVE_INTERCHAIN_TOKEN.
;;      * @param params The deployment parameters.
;;      * @param gasValue The gas value for deployment.
;;      * @return tokenId The tokenId associated with the token manager.
;;      */
;;     function deployTokenManager(
;;         bytes32 salt,
;;         string calldata destinationChain,
;;         TokenManagerType tokenManagerType,
;;         bytes calldata params,
;;         uint256 gasValue
;;     ) external payable returns (bytes32 tokenId);

;;     /**
;;      * @notice Deploys and registers an interchain token on a remote chain.
;;      * @param salt The salt used for token deployment.
;;      * @param destinationChain The name of the destination chain. Use '' for this chain.
;;      * @param name The name of the interchain tokens.
;;      * @param symbol The symbol of the interchain tokens.
;;      * @param decimals The number of decimals for the interchain tokens.
;;      * @param minter The minter data for mint/burn operations.
;;      * @param gasValue The gas value for deployment.
;;      * @return tokenId The tokenId corresponding to the deployed InterchainToken.
;;      */
;;     function deployInterchainToken(
;;         bytes32 salt,
;;         string calldata destinationChain,
;;         string memory name,
;;         string memory symbol,
;;         uint8 decimals,
;;         bytes memory minter,
;;         uint256 gasValue
;;     ) external payable returns (bytes32 tokenId);

;;     /**
;;      * @notice Initiates an interchain transfer of a specified token to a destination chain.
;;      * @param tokenId The unique identifier of the token to be transferred.
;;      * @param destinationChain The destination chain to send the tokens to.
;;      * @param destinationAddress The address on the destination chain to send the tokens to.
;;      * @param amount The amount of tokens to be transferred.
;;      * @param metadata Optional metadata for the call for additional effects (such as calling a destination contract).
;;      */
;;     function interchainTransfer(
;;         bytes32 tokenId,
;;         string calldata destinationChain,
;;         bytes calldata destinationAddress,
;;         uint256 amount,
;;         bytes calldata metadata,
;;         uint256 gasValue
;;     ) external payable;
(interchain-transfer ((buff 32) (string-ascii 18) (string-ascii 48) uint (buff 32) uint) (response bool uint))
;;     /**
;;      * @notice Initiates an interchain call contract with interchain token to a destination chain.
;;      * @param tokenId The unique identifier of the token to be transferred.
;;      * @param destinationChain The destination chain to send the tokens to.
;;      * @param destinationAddress The address on the destination chain to send the tokens to.
;;      * @param amount The amount of tokens to be transferred.
;;      * @param data Additional data to be passed along with the transfer.
;;      */
;;     function callContractWithInterchainToken(
;;         bytes32 tokenId,
;;         string calldata destinationChain,
;;         bytes calldata destinationAddress,
;;         uint256 amount,
;;         bytes calldata data,
;;         uint256 gasValue
;;     ) external payable;
(call-contract-with-interchain-token ((buff 32) (string-ascii 18) (string-ascii 48) uint (buff 32) uint) (response bool uint))
;;     /**
;;      * @notice Sets the flow limits for multiple tokens.
;;      * @param tokenIds An array of tokenIds.
;;      * @param flowLimits An array of flow limits corresponding to the tokenIds.
;;      */
;;     function setFlowLimits(bytes32[] calldata tokenIds, uint256[] calldata flowLimits) external;
(set-flow-limits ((list 32  (buff 32)) (list 32 uint)) (response bool uint))
;;     /**
;;      * @notice Returns the flow limit for a specific token.
;;      * @param tokenId The tokenId of the token.
;;      * @return flowLimit_ The flow limit for the token.
;;      */
;;     function flowLimit(bytes32 tokenId) external view returns (uint256 flowLimit_);
(get-flow-limit ((buff 32)) (response uint uint))
;;     /**
;;      * @notice Returns the total amount of outgoing flow for a specific token.
;;      * @param tokenId The tokenId of the token.
;;      * @return flowOutAmount_ The total amount of outgoing flow for the token.
;;      */
;;     function flowOutAmount(bytes32 tokenId) external view returns (uint256 flowOutAmount_);
(get-flow-out-amount ((buff 32))  (response uint uint))
;;     /**
;;      * @notice Returns the total amount of incoming flow for a specific token.
;;      * @param tokenId The tokenId of the token.
;;      * @return flowInAmount_ The total amount of incoming flow for the token.
;;      */
;;     function flowInAmount(bytes32 tokenId) external view returns (uint256 flowInAmount_);
(get-flow-in-amount ((buff 32))  (response uint uint))
;;     /**
;;      * @notice Allows the owner to pause/unpause the token service.
;;      * @param paused whether to pause or unpause.
;;      */
;;     function setPauseStatus(bool paused) external;
;; }
(set-pause-status (bool) (response bool uint))
))