import { BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { gatewayImplCV, getSigners } from "./util";
import {
  enableTokenManager,
  getTokenId,
  itsProxy,
  setupService,
  setupTokenManager,
} from "./its-utils";
import { MessageType, MetadataVersion, TokenType } from "./constants";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

describe("Interchain Token Service impl", () => {
  it("should only be called by proxy", () => {
    const ERR_NOT_PROXY = Cl.uint(21053);
    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "set-paused",
        [Cl.bool(true), Cl.address(address1)],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "transfer-operatorship",
        [Cl.address(address1), Cl.address(address1)],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "set-trusted-address",
        [
          Cl.stringAscii("ethereum"),
          Cl.stringAscii("0x0000000000000000000000000000000000000000"),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "remove-trusted-address",
        [Cl.stringAscii("ethereum"), Cl.address(address1)],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);
    const salt = randomBytes(32);
    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "deploy-token-manager",
        [
          gatewayImplCV,
          itsProxy,
          Cl.buffer(salt),
          Cl.stringAscii("ethereum"),
          Cl.uint(TokenType.LOCK_UNLOCK),
          Cl.bufferFromHex("0x"),
          Cl.address(`${deployer}.token-manager`),
          Cl.uint(0),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);
    const proofSigners = getSigners(0, 10, 1, 10, "1");
    const tokenId = getTokenId(salt).result as BufferCV;
    setupService(proofSigners);
    setupTokenManager({});
    enableTokenManager({
      proofSigners,
      tokenId,
    });

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "process-deploy-token-manager-from-external-chain",
        [
          gatewayImplCV,
          itsProxy,
          Cl.address(`${deployer}.token-manager`),
          Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                "source-chain": Cl.stringAscii("ethereum"),
                type: Cl.uint(MessageType.DEPLOY_TOKEN_MANAGER),
                "token-id": Cl.buffer(salt),
                "token-manager-type": Cl.uint(TokenType.LOCK_UNLOCK),
                params: Cl.buffer(
                  Cl.serialize(
                    Cl.tuple({
                      operator: Cl.none(),
                      "token-address": Cl.address(`${deployer}.sample-sip-010`),
                    }),
                  ),
                ),
              }),
            ),
          ),
          Cl.none(),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "process-deploy-token-manager-from-stacks",
        [
          gatewayImplCV,
          itsProxy,
          Cl.stringAscii(""),
          Cl.stringAscii("ethereum"),
          Cl.stringAscii("0x0000000000000000000000000000000000000000"),
          Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.stringAscii(""),
                "token-manager-address": Cl.address(
                  `${deployer}.token-manager`,
                ),
                "token-id": tokenId,
                "token-type": Cl.uint(TokenType.LOCK_UNLOCK),
                "wrapped-payload": Cl.none(),
              }),
            ),
          ),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "deploy-remote-interchain-token",
        [
          gatewayImplCV,
          itsProxy,
          Cl.buffer(salt),
          Cl.stringAscii("ethereum"),
          Cl.stringAscii("NIT"),
          Cl.stringAscii("NIT"),
          Cl.uint(6),
          Cl.bufferFromHex("0x"),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "deploy-interchain-token",
        [
          gatewayImplCV,
          itsProxy,
          Cl.buffer(salt),
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.uint(10),
          Cl.none(),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);
    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "interchain-transfer",
        [
          gatewayImplCV,
          itsProxy,
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.address(`${deployer}.native-interchain-token`),
          tokenId,
          Cl.stringAscii("ethereum"),
          Cl.bufferFromHex("0x00"),
          Cl.uint(100),
          Cl.tuple({
            version: Cl.uint(MetadataVersion.ContractCall),
            data: Cl.bufferFromHex("0x"),
          }),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);
    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "call-contract-with-interchain-token",
        [
          gatewayImplCV,
          itsProxy,
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.address(`${deployer}.native-interchain-token`),
          tokenId,
          Cl.stringAscii("ethereum"),
          Cl.bufferFromHex("0x00"),
          Cl.uint(100),
          Cl.tuple({
            version: Cl.uint(MetadataVersion.ContractCall),
            data: Cl.bufferFromHex("0x"),
          }),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "execute-deploy-token-manager",
        [
          gatewayImplCV,
          itsProxy,
          Cl.stringAscii("ethereum"),
          Cl.stringAscii("0x00"),
          Cl.stringAscii(""),
          Cl.bufferFromHex("0x"),
          Cl.address(`${deployer}.sample-sip-010`),
          Cl.address(`${deployer}.token-manager`),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "execute-deploy-interchain-token",
        [
          gatewayImplCV,
          itsProxy,
          Cl.stringAscii("ethereum"),
          Cl.stringAscii("0x00"),
          Cl.stringAscii("0x00"),
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.bufferFromHex("0x"),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "execute-receive-interchain-token",
        [
          gatewayImplCV,
          itsProxy,
          Cl.stringAscii("ethereum"),
          Cl.stringAscii("0x00"),
          Cl.stringAscii("0x00"),
          Cl.address(`${deployer}.token-manager`),
          Cl.address(`${deployer}.token`),
          Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(MessageType.INTERCHAIN_TRANSFER),
                "source-chain": Cl.stringAscii("ethereum"),
                "token-id": tokenId,
                "source-address": Cl.bufferFromHex("0x00"),
                "destination-address": Cl.buffer(
                  Cl.serialize(Cl.address(address1)),
                ),
                amount: Cl.uint(1000),
                data: Cl.bufferFromHex("0x"),
              }),
            ),
          ),
          Cl.none(),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "set-flow-limit",
        [
          tokenId,
          Cl.address(`${deployer}.token-manager`),
          Cl.uint(0),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);
    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "dispatch",
        [Cl.stringAscii("fn"), Cl.bufferFromHex("0x"), Cl.address(address1)],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);
  });
});
