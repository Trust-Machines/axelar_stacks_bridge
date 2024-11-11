import { Cl } from "@stacks/transactions";

export const ITS_ERROR_CODES = {
  "ERR-INVALID-IMPL": Cl.uint(20211),
  "ERR-NOT-AUTHORIZED": Cl.uint(21051),
  "ERR-PAUSED": Cl.uint(21052),
  "ERR-UNTRUSTED-CHAIN": Cl.uint(22051),
  "ERR-TOKEN-NOT-FOUND": Cl.uint(22052),
  "ERR-TOKEN-NOT-ENABLED": Cl.uint(22053),
  "ERR-TOKEN-EXISTS": Cl.uint(22054),
  "ERR-GAS-NOT-PAID": Cl.uint(22055),
  "ERR-TOKEN-NOT-DEPLOYED": Cl.uint(22056),
  "ERR-TOKEN-MANAGER-NOT-DEPLOYED": Cl.uint(22057),
  "ERR-TOKEN-MANAGER-MISMATCH": Cl.uint(22058),
  "ERR-UNSUPPORTED-TOKEN-TYPE": Cl.uint(22059),
  "ERR-UNSUPPORTED": Cl.uint(22060),
  "ERR-INVALID-PAYLOAD": Cl.uint(22061),
  "ERR-INVALID-DESTINATION-CHAIN": Cl.uint(22062),
  "ERR-INVALID-SOURCE-CHAIN": Cl.uint(22063),
  "ERR-INVALID-SOURCE-ADDRESS": Cl.uint(22064),
  "ERR-ZERO-AMOUNT": Cl.uint(22065),
  "ERR-INVALID-METADATA-VERSION": Cl.uint(22066),
  "ERR-INVALID-SALT": Cl.uint(22067),
  "ERR-INVALID-DESTINATION-ADDRESS": Cl.uint(22068),
  "ERR-EMPTY-DATA": Cl.uint(22069),
  "ERR-TOKEN-DEPLOYMENT-NOT-APPROVED": Cl.uint(22070),
  "ERR-INVALID-MESSAGE-TYPE": Cl.uint(22071),
  "ERR-CANNOT-DEPLOY-REMOTELY-TO-SELF": Cl.uint(22072),
  "ERR-TOKEN-REQUIRED": Cl.uint(22073),
  "ERR-TOKEN-MANAGER-REQUIRED": Cl.uint(22074),
  "ERR-NOT-REMOTE-SERVICE": Cl.uint(22075),
  "ERR-TOKEN-METADATA-NAME-INVALID": Cl.uint(22076),
  "ERR-TOKEN-METADATA-SYMBOL-INVALID": Cl.uint(22077),
  "ERR-TOKEN-METADATA-DECIMALS-INVALID": Cl.uint(22078),
  "ERR-TOKEN-METADATA-OPERATOR-INVALID": Cl.uint(22079),
  "ERR-TOKEN-METADATA-OPERATOR-ITS-INVALID": Cl.uint(22080),
  "ERR-TOKEN-METADATA-FLOW-LIMITER-ITS-INVALID": Cl.uint(22081),
  "ERR-TOKEN-METADATA-MINTER-ITS-INVALID": Cl.uint(22082),
  "ERR-TOKEN-METADATA-TOKEN-ID-INVALID": Cl.uint(22083),
  "ERR-TOKEN-METADATA-SUPPLY-INVALID": Cl.uint(22084),
  "ERR-TOKEN-METADATA-PASSED-MINTER-INVALID": Cl.uint(22085),
  "ERR-TOKEN-METADATA-PASSED-MINTER-NOT-NULL": Cl.uint(22086),
  "ERR-ONLY-OPERATOR": Cl.uint(25051),
  "ERR-STARTED": Cl.uint(24051),
  "ERR-NOT-STARTED": Cl.uint(24052),
};

export const TRUSTED_CHAIN = "axelarnet";
export const TRUSTED_ADDRESS =
  "axelar10jzzmv5m7da7dn2xsfac0yqe7zamy34uedx3e28laq0p6f3f8dzqp649fp";
export const ITS_HUB_ROUTING_IDENTIFIER = "hub";

export enum MessageType {
  INTERCHAIN_TRANSFER,
  DEPLOY_INTERCHAIN_TOKEN,
  DEPLOY_TOKEN_MANAGER,
  SEND_TO_HUB,
  RECEIVE_FROM_HUB,
}
export enum TokenType {
  NATIVE_INTERCHAIN_TOKEN, // This type is reserved for interchain tokens deployed by ITS, and can't be used by custom token managers.
  MINT_BURN_FROM, // The token will be minted/burned on transfers. The token needs to give mint permission to the token manager, but burning happens via an approval.
  LOCK_UNLOCK, // The token will be locked/unlocked at the token manager.
  LOCK_UNLOCK_FEE, // The token will be locked/unlocked at the token manager, which will account for any fee-on-transfer behaviour.
  MINT_BURN, // The token will be minted/burned on transfers. The token needs to give mint and burn permission to the token manager.
  GATEWAY, // The token will be sent through the gateway via callContractWithToken
}

export enum MetadataVersion {
  ContractCall,
  ExpressCall,
}

export const TOKEN_MANAGER_ERRORS = {
  "ERR-NOT-AUTHORIZED": Cl.uint(1051),
  "ERR-FLOW-LIMIT-EXCEEDED": Cl.uint(2051),
  "ERR-NOT-MANAGED-TOKEN": Cl.uint(3051),
  "ERR-ZERO-AMOUNT": Cl.uint(3052),
  "ERR-STARTED": Cl.uint(4051),
  "ERR-NOT-STARTED": Cl.uint(4052),
  "ERR-UNSUPPORTED-TOKEN-TYPE": Cl.uint(4053),
  "ERR-INVALID-PARAMS": Cl.uint(4054),
  "ERR-ONLY-OPERATOR": Cl.uint(5051),
};

export const NIT_ERRORS = {
  "ERR-NOT-AUTHORIZED": Cl.uint(1051),
  "ERR-INSUFFICIENT-BALANCE": Cl.uint(2051),
  "ERR-INVALID-PARAMS": Cl.uint(2052),
  "ERR-ZERO-AMOUNT": Cl.uint(2053),
  "ERR-NOT-MANAGED-TOKEN": Cl.uint(2053),
  "ERR-FLOW-LIMIT-EXCEEDED": Cl.uint(3051),
  "ERR-STARTED": Cl.uint(4051),
  "ERR-NOT-STARTED": Cl.uint(4052),
  "ERR-UNSUPPORTED-TOKEN-TYPE": Cl.uint(4053),
  "ERR-ONLY-OPERATOR": Cl.uint(5051),
};

export const ITF_ERRORS = {
  "ERR-TOKEN-NOT-ENABLED": Cl.uint(211051),
  "ERR-INVALID-MINTER": Cl.uint(211052),
  "ERR-NOT-MINTER": Cl.uint(211053),
};

export const BURN_ADDRESS = "ST000000000000000000002AMW42H";
