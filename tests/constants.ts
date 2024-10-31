import { Cl } from "@stacks/transactions";

export const ITS_ERROR_CODES = {
  "ERR-NOT-AUTHORIZED": Cl.uint(1051),
  "ERR-PAUSED": Cl.uint(1052),
  "ERR-UNTRUSTED-CHAIN": Cl.uint(2051),
  "ERR-TOKEN-NOT-FOUND": Cl.uint(2052),
  "ERR-TOKEN-NOT-ENABLED": Cl.uint(2053),
  "ERR-TOKEN-EXISTS": Cl.uint(2054),
  "ERR-GAS-NOT-PAID": Cl.uint(2055),
  "ERR-TOKEN-NOT-DEPLOYED": Cl.uint(2056),
  "ERR-TOKEN-MANAGER-NOT-DEPLOYED": Cl.uint(2057),
  "ERR-TOKEN-MANAGER-MISMATCH": Cl.uint(2058),
  "ERR-UNSUPPORTED-TOKEN-TYPE": Cl.uint(2059),
  "ERR-UNSUPPORTED": Cl.uint(2060),
  "ERR-INVALID-PAYLOAD": Cl.uint(2061),
  "ERR-INVALID-DESTINATION-CHAIN": Cl.uint(2062),
  "ERR-INVALID-SOURCE-CHAIN": Cl.uint(2063),
  "ERR-INVALID-SOURCE-ADDRESS": Cl.uint(2064),
  "ERR-ZERO-AMOUNT": Cl.uint(2065),
  "ERR-INVALID-METADATA-VERSION": Cl.uint(2066),
  "ERR-INVALID-SALT": Cl.uint(2067),
  "ERR-INVALID-DESTINATION-ADDRESS": Cl.uint(2068),
  "ERR-EMPTY-DATA": Cl.uint(2069),
  "ERR-TOKEN-DEPLOYMENT-NOT-APPROVED": Cl.uint(2070),
  "ERR-INVALID-MESSAGE-TYPE": Cl.uint(2071),
  "ERR-CANNOT-DEPLOY-REMOTELY-TO-SELF": Cl.uint(2072),
  "ERR-TOKEN-REQUIRED": Cl.uint(2073),
  "ERR-TOKEN-MANAGER-REQUIRED": Cl.uint(2074),
  "ERR-NOT-REMOTE-SERVICE": Cl.uint(2075),
  "ERR-TOKEN-METADATA-NAME-INVALID": Cl.uint(2076),
  "ERR-TOKEN-METADATA-SYMBOL-INVALID": Cl.uint(2077),
  "ERR-TOKEN-METADATA-DECIMALS-INVALID": Cl.uint(2078),
  "ERR-TOKEN-METADATA-OPERATOR-INVALID": Cl.uint(2079),
  "ERR-TOKEN-METADATA-OPERATOR-ITS-INVALID": Cl.uint(2080),
  "ERR-TOKEN-METADATA-FLOW-LIMITER-ITS-INVALID": Cl.uint(2081),
  "ERR-TOKEN-METADATA-MINTER-ITS-INVALID": Cl.uint(2082),
  "ERR-TOKEN-METADATA-TOKEN-ID-INVALID": Cl.uint(2083),
  "ERR-TOKEN-METADATA-SUPPLY-INVALID": Cl.uint(2084),
  "ERR-TOKEN-METADATA-PASSED-MINTER-INVALID": Cl.uint(2085),
  "ERR-TOKEN-METADATA-PASSED-MINTER-NOT-NULL": Cl.uint(2086),
  "ERR-ONLY-OPERATOR": Cl.uint(3051),
  "ERR-STARTED": Cl.uint(4051),
  "ERR-NOT-STARTED": Cl.uint(4052),
};

export const TRUSTED_CHAIN = "axelarnet";
export const TRUSTED_ADDRESS = "cosmwasm";

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
