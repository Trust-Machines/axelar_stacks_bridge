
;; title: token-handler
;; version:
;; summary: 
;; description:
;; This interface is responsible for handling tokens before
;; initiating an interchain token transfer, or after receiving one.

;; traits
;;
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(use-trait token-manager-trait .token-manager-trait.token-manager-trait)
;; token definitions
;;

;; constants
;; ;;
;; This type is reserved for interchain tokens deployed by ITS, and can't be used by custom token managers.
(define-constant TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN u1)
;; The token will be minted/burned on transfers. The token needs to give mint permission to the token manager, but burning happens via an approval.
(define-constant TOKEN-TYPE-MINT-BURN-FROM u2)
;; The token will be locked/unlocked at the token manager.
(define-constant TOKEN-TYPE-LOCK-UNLOCK u3)
;; The token will be locked/unlocked at the token manager, which will account for any fee-on-transfer behaviour.
(define-constant TOKEN-TYPE-LOCK-UNLOCK-FEE u4)
;; The token will be minted/burned on transfers. The token needs to give mint and burn permission to the token manager.
(define-constant TOKEN-TYPE-MINT-BURN u5)
;; The token will be sent through the gateway via callContractWithToken
(define-constant TOKEN-TYPE-GATEWAY u6)

(define-constant GATEWAY .gateway)
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

;; // SPDX-License-Identifier: MIT

;; pragma solidity ^0.8.0;

;; import { ITokenHandler } from './interfaces/ITokenHandler.sol';
;; import { IERC20 } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IERC20.sol';
;; import { SafeTokenTransfer, SafeTokenTransferFrom, SafeTokenCall } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/libs/SafeTransfer.sol';
;; import { ReentrancyGuard } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/utils/ReentrancyGuard.sol';
;; import { Create3AddressFixed } from './utils/Create3AddressFixed.sol';

;; import { ITokenManagerType } from './interfaces/ITokenManagerType.sol';
;; import { ITokenManager } from './interfaces/ITokenManager.sol';
;; import { ITokenManagerProxy } from './interfaces/ITokenManagerProxy.sol';
;; import { IERC20MintableBurnable } from './interfaces/IERC20MintableBurnable.sol';
;; import { IERC20BurnableFrom } from './interfaces/IERC20BurnableFrom.sol';
;; import { IERC20Named } from './interfaces/IERC20Named.sol';

;; /**
;;  * @title TokenHandler
;;  * @notice 
;;  */

;; This function gives token to a specified address from the token manager.
;; @param token-address The sip-010 interface of the token.
;; @param token-manager The trait interface of the token manager
;; @param to The address to give tokens to.
;; @param amount The amount of tokens to give.
;; @return (response bool uint)
(define-public (give-token (token-address <sip-010-trait>) (token-manager <token-manager-trait>) (to principal) (amount uint)) 
    (begin 
        (try! (contract-call? token-manager add-flow-in amount))
        (transfer-token-from token-address (contract-of token-manager) to amount)))

;; This function takes token from a specified address to the token manager.
;; @param token-address The sip-010 interface of the token.
;; @param token-manager The trait interface of the token manager
;; @param from The address to take tokens from.
;; @param amount The amount of token to take.
;; @return (response bool uint)
(define-public (take-token (token-address <sip-010-trait>) (token-manager <token-manager-trait>) (from principal) (amount uint)) 
    (begin
        (try! (contract-call? token-manager add-flow-out amount))
        (transfer-token-from token-address from (contract-of token-manager) amount)))
;;     /**
;;      * @notice This function transfers token from and to a specified address.
;;      * @param tokenId The token id of the token manager.
;;      * @param from The address to transfer tokens from.
;;      * @param to The address to transfer tokens to.
;;      * @param amount The amount of token to transfer.
;;      * @return uint256 The amount of token actually transferred, which could be different for certain token type.
;;      * @return address The address of the token corresponding to the input tokenId.
;;      */
;;     // slither-disable-next-line locked-ether
;;     function transferTokenFrom(bytes32 tokenId, address from, address to, uint256 amount) external payable returns (uint256, address) {
;;         address tokenManager = _create3Address(tokenId);
;;         (uint256 tokenManagerType, address tokenAddress) = ITokenManagerProxy(tokenManager).getImplementationTypeAndTokenAddress();

;;         if (
;;             tokenManagerType == uint256(TokenManagerType.NATIVE_INTERCHAIN_TOKEN) ||
;;             tokenManagerType == uint256(TokenManagerType.LOCK_UNLOCK) ||
;;             tokenManagerType == uint256(TokenManagerType.MINT_BURN) ||
;;             tokenManagerType == uint256(TokenManagerType.MINT_BURN_FROM) ||
;;             tokenManagerType == uint256(TokenManagerType.GATEWAY)
;;         ) {
;;             _transferTokenFrom(tokenAddress, from, to, amount);
;;             return (amount, tokenAddress);
;;         }

;;         if (tokenManagerType == uint256(TokenManagerType.LOCK_UNLOCK_FEE)) {
;;             amount = _transferTokenFromWithFee(tokenAddress, from, to, amount);
;;             return (amount, tokenAddress);
;;         }

;;         revert UnsupportedTokenManagerType(tokenManagerType);
;;     }

;;     /**
;;      * @notice This function prepares a token manager after it is deployed
;;      * @param tokenManagerType The token manager type.
;;      * @param tokenManager The address of the token manager.
;;      */
;;     // slither-disable-next-line locked-ether
;;     function postTokenManagerDeploy(uint256 tokenManagerType, address tokenManager) external payable {
;;         if (tokenManagerType == uint256(TokenManagerType.LOCK_UNLOCK) || tokenManagerType == uint256(TokenManagerType.LOCK_UNLOCK_FEE)) {
;;             ITokenManager(tokenManager).approveService();
;;         }

;;         // Approve the gateway here. One-time infinite approval works for gateway wrapped tokens, and for most origin tokens.
;;         // Approval can be refreshed in the future if needed for certain tokens via an upgrade, but realistically should never be exhausted.
;;         if (tokenManagerType == uint256(TokenManagerType.GATEWAY)) {
;;             address token = ITokenManager(tokenManager).tokenAddress();
;;             _approveGateway(token, UINT256_MAX);
;;         }
;;     }

;;     function _transferTokenFrom(address tokenAddress, address from, address to, uint256 amount) internal {
;;         // slither-disable-next-line arbitrary-send-erc20
;;         IERC20(tokenAddress).safeTransferFrom(from, to, amount);
;;     }
(define-private (transfer-token-from (token-address <sip-010-trait>) (from principal) (to principal) (amount uint))
    (contract-call? token-address transfer amount from to none))

;;     function _transferToken(address tokenAddress, address to, uint256 amount) internal {
;;         // slither-disable-next-line arbitrary-send-erc20
;;         IERC20(tokenAddress).safeTransfer(to, amount);
;;     }

;;     function _transferTokenFromWithFee(
;;         address tokenAddress,
;;         address from,
;;         address to,
;;         uint256 amount
;;     ) internal noReEntrancy returns (uint256) {
;;         uint256 balanceBefore = IERC20(tokenAddress).balanceOf(to);

;;         _transferTokenFrom(tokenAddress, from, to, amount);

;;         uint256 diff = IERC20(tokenAddress).balanceOf(to) - balanceBefore;
;;         if (diff < amount) {
;;             amount = diff;
;;         }

;;         return amount;
;;     }

;;     function _giveInterchainToken(address tokenAddress, address to, uint256 amount) internal {
;;         IERC20(tokenAddress).safeCall(abi.encodeWithSelector(IERC20MintableBurnable.mint.selector, to, amount));
;;     }

;;     function _takeInterchainToken(address tokenAddress, address from, uint256 amount) internal {
;;         IERC20(tokenAddress).safeCall(abi.encodeWithSelector(IERC20MintableBurnable.burn.selector, from, amount));
;;     }

;;     function _mintToken(address tokenManager, address tokenAddress, address to, uint256 amount) internal {
;;         ITokenManager(tokenManager).mintToken(tokenAddress, to, amount);
;;     }

;;     function _burnToken(address tokenManager, address tokenAddress, address from, uint256 amount) internal {
;;         ITokenManager(tokenManager).burnToken(tokenAddress, from, amount);
;;     }

;;     function _burnTokenFrom(address tokenAddress, address from, uint256 amount) internal {
;;         IERC20(tokenAddress).safeCall(abi.encodeWithSelector(IERC20BurnableFrom.burnFrom.selector, from, amount));
;;     }

;;     function _approveGateway(address tokenAddress, uint256 amount) internal {
;;         uint256 allowance = IERC20(tokenAddress).allowance(address(this), gateway);
;;         if (allowance == 0) {
;;             IERC20(tokenAddress).safeCall(abi.encodeWithSelector(IERC20.approve.selector, gateway, amount));
;;         }
;;     }
;; }
