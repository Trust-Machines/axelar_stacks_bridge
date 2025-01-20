import { BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { gasImplContract, gatewayImplCV, getSigners } from "./util";
import { getTokenId, setupService, setupTokenManager } from "./its-utils";
import { MessageType, MetadataVersion, TokenType } from "./constants";
import { getNITMockCv, getTokenManagerMockCv } from "./verification-util";

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
    const verificationParams = getTokenManagerMockCv();
    setupTokenManager({
      contract: `${address1}.token-man`,
      sender: address1,
    });
    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "deploy-token-manager",
        [
          gatewayImplCV,
          gasImplContract,
          Cl.buffer(salt),
          Cl.stringAscii("ethereum"),
          Cl.uint(TokenType.LOCK_UNLOCK),
          Cl.bufferFromHex("0x"),
          Cl.address(`${address1}.token-man`),
          verificationParams,
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ERR_NOT_PROXY);
    const proofSigners = getSigners(0, 10, 1, 10, "1");
    const tokenId = getTokenId(salt).result as BufferCV;
    setupService(proofSigners);
    setupTokenManager({});

    expect(
      simnet.callPublicFn(
        "interchain-token-service-impl",
        "deploy-remote-interchain-token",
        [
          gatewayImplCV,
          gasImplContract,
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
          gasImplContract,
          Cl.buffer(salt),
          Cl.address(`${address1}.nit`),
          Cl.uint(10),
          Cl.none(),
          getNITMockCv(),
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
          gasImplContract,
          Cl.address(`${address1}.nit`),
          Cl.address(`${address1}.nit`),
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
          gasImplContract,
          Cl.address(`${address1}.nit`),
          Cl.address(`${address1}.nit`),
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
        "execute-deploy-interchain-token",
        [
          gatewayImplCV,
          gasImplContract,
          Cl.stringAscii("ethereum"),
          Cl.stringAscii("0x00"),
          Cl.stringAscii("0x00"),
          Cl.address(`${address1}.nit`),
          Cl.bufferFromHex("0x"),
          getNITMockCv(),
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
