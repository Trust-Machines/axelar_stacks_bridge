import { Cl } from "@stacks/transactions";

export const ITS_IMPL_ERROR_CODES = {
  "ERR-NOT-AUTHORIZED": Cl.uint(120001),
  "ERR-PAUSED": Cl.uint(120002),
  "ERR-NOT-PROXY": Cl.uint(120003),
  "ERR-UNTRUSTED-CHAIN": Cl.uint(120004),
  "ERR-TOKEN-NOT-FOUND": Cl.uint(120005),
  "ERR-TOKEN-EXISTS": Cl.uint(120006),
  "ERR-TOKEN-NOT-DEPLOYED": Cl.uint(120007),
  "ERR-TOKEN-MANAGER-NOT-DEPLOYED": Cl.uint(120008),
  "ERR-TOKEN-MANAGER-MISMATCH": Cl.uint(120009),
  "ERR-UNSUPPORTED-TOKEN-TYPE": Cl.uint(120010),
  "ERR-INVALID-PAYLOAD": Cl.uint(120011),
  "ERR-INVALID-DESTINATION-CHAIN": Cl.uint(120012),
  "ERR-INVALID-SOURCE-CHAIN": Cl.uint(120013),
  "ERR-INVALID-SOURCE-ADDRESS": Cl.uint(120014),
  "ERR-ZERO-AMOUNT": Cl.uint(120015),
  "ERR-INVALID-METADATA-VERSION": Cl.uint(120016),
  "ERR-INVALID-SALT": Cl.uint(120017),
  "ERR-INVALID-DESTINATION-ADDRESS": Cl.uint(120018),
  "ERR-EMPTY-DATA": Cl.uint(120019),
  "ERR-TOKEN-DEPLOYMENT-NOT-APPROVED": Cl.uint(120020),
  "ERR-INVALID-MESSAGE-TYPE": Cl.uint(120021),
  "ERR-CANNOT-DEPLOY-REMOTELY-TO-SELF": Cl.uint(120022),
  "ERR-NOT-REMOTE-SERVICE": Cl.uint(120023),
  "ERR-TOKEN-METADATA-NAME-INVALID": Cl.uint(120024),
  "ERR-TOKEN-METADATA-SYMBOL-INVALID": Cl.uint(120025),
  "ERR-TOKEN-METADATA-DECIMALS-INVALID": Cl.uint(120026),
  "ERR-TOKEN-METADATA-OPERATOR-INVALID": Cl.uint(120027),
  "ERR-TOKEN-METADATA-OPERATOR-ITS-INVALID": Cl.uint(120028),
  "ERR-TOKEN-METADATA-FLOW-LIMITER-ITS-INVALID": Cl.uint(120029),
  "ERR-TOKEN-METADATA-MINTER-ITS-INVALID": Cl.uint(120030),
  "ERR-TOKEN-METADATA-TOKEN-ID-INVALID": Cl.uint(120031),
  "ERR-TOKEN-METADATA-SUPPLY-INVALID": Cl.uint(120032),
  "ERR-TOKEN-METADATA-PASSED-MINTER-INVALID": Cl.uint(120033),
  "ERR-TOKEN-METADATA-PASSED-MINTER-NOT-NULL": Cl.uint(120034),
  "ERR-INVALID-PARAMS": Cl.uint(120035),
  "ERR-GATEWAY-NOT-DEPLOYED": Cl.uint(120036),
  "ERR-NOT-TOKEN-DEPLOYER": Cl.uint(120037),
  "ERR-NOT-IMPLEMENTED": Cl.uint(120038),
  "ERR-ONLY-OPERATOR": Cl.uint(120039),
  "ERR-ONLY-OWNER": Cl.uint(120040),
  "ERR-NOT-STARTED": Cl.uint(120040),
};
export const ITS_PROXY_ERROR_CODES = {
  "ERR-INVALID-IMPL": Cl.uint(140001),
  "ERR-UNTRUSTED-CHAIN": Cl.uint(140002),
  "ERR-HUB-TRUSTED-ADDRESS-MISSING": Cl.uint(140003),
  "ERR-ZERO-AMOUNT": Cl.uint(140004),
  "ERR-NOT-IMPLEMENTED": Cl.uint(140005),
  "ERR-STARTED": Cl.uint(140006),
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
  "ERR-NOT-OPERATOR": Cl.uint(170000),
  "ERR-NOT-AUTHORIZED": Cl.uint(170001),
  "ERR-NON-STANDARD-ADDRESS": Cl.uint(170002),
  "ERR-FLOW-LIMIT-EXCEEDED": Cl.uint(170003),
  "ERR-NOT-MANAGED-TOKEN": Cl.uint(170004),
  "ERR-ZERO-AMOUNT": Cl.uint(170005),
  "ERR-STARTED": Cl.uint(170006),
  "ERR-NOT-STARTED": Cl.uint(170007),
  "ERR-UNSUPPORTED-TOKEN-TYPE": Cl.uint(170008),
  "ERR-INVALID-PARAMS": Cl.uint(170009),
};

export const NIT_ERRORS = {
  "ERR-NOT-AUTHORIZED": Cl.uint(150000),
  "ERR-NON-STANDARD-ADDRESS": Cl.uint(150001),
  "ERR-INSUFFICIENT-BALANCE": Cl.uint(150002),
  "ERR-INVALID-PARAMS": Cl.uint(150003),
  "ERR-ZERO-AMOUNT": Cl.uint(150004),
  "ERR-NOT-MANAGED-TOKEN": Cl.uint(150005),
  "ERR-FLOW-LIMIT-EXCEEDED": Cl.uint(150006),
  "ERR-STARTED": Cl.uint(150007),
  "ERR-NOT-STARTED": Cl.uint(150008),
  "ERR-UNSUPPORTED-TOKEN-TYPE": Cl.uint(150009),
  "ERR-ONLY-OPERATOR": Cl.uint(150010),
};

export const ITF_IMPL_ERRORS = {
  "ERR-TOKEN-NOT-ENABLED": Cl.uint(100001),
  "ERR-INVALID-MINTER": Cl.uint(100002),
  "ERR-NOT-MINTER": Cl.uint(100003),
  "ERR-SERVICE-NOT-DEPLOYED": Cl.uint(100004),
  "ERR-TOKEN-NOT-DEPLOYED": Cl.uint(100005),
  "ERR-MANAGER-NOT-DEPLOYED": Cl.uint(100006),
  "ERR-NOT-PROXY": Cl.uint(100007),
  "ERR-TOKEN-NOT-FOUND": Cl.uint(100008),
  "ERR-TOKEN-MISMATCH": Cl.uint(100009),
  "ERR-INVALID-CHAIN-NAME": Cl.uint(100010),
  "ERR-REMOTE-DEPLOYMENT-NOT-APPROVED": Cl.uint(100011),
  "ERR-CANNOT-DELETE-DEPLOY-APPROVAL": Cl.uint(100012),
  "ERR-PAUSED": Cl.uint(100013),
  "ERR-INVALID-PARAMS": Cl.uint(100014),
  "ERR-NOT-TOKEN-DEPLOYER": Cl.uint(100015),
  "ERR-NOT-IMPLEMENTED": Cl.uint(100016),
};

export const ITF_PROXY_ERRORS = {
  "ERR-INVALID-IMPL": Cl.uint(110000),
  "ERR-NOT-AUTHORIZED": Cl.uint(110001),
  "ERR-NOT-IMPLEMENTED": Cl.uint(110002),
};

export const BURN_ADDRESS = "ST000000000000000000002AMW42H";
