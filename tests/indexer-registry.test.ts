import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const indexer1 = accounts.get("wallet_1")!;
const indexer2 = accounts.get("wallet_2")!;
const requester1 = accounts.get("wallet_3")!;

describe("Indexer Registry contract tests", () => {
  it("allows a node to register as an indexer with sufficient STX stake", () => {
    // Register indexer1 with 100 STX (100,000,000 micro-STX)
    const registerResponse = simnet.callPublicFn(
      "indexer-registry",
      "register-indexer",
      [
        Cl.stringUtf8("https://indexer-stacks-1.rindicomfort.io"),
        Cl.uint(100000000)
      ],
      indexer1
    );
    expect(registerResponse.result).toBeOk(Cl.bool(true));
    const regBlock = simnet.blockHeight;

    // Verify indexer info in read-only call
    const infoResponse = simnet.callReadOnlyFn(
      "indexer-registry",
      "get-indexer-info",
      [Cl.principal(indexer1)],
      deployer
    );
    
    expect(infoResponse.result).toBeSome(
      Cl.tuple({
        endpoint: Cl.stringUtf8("https://indexer-stacks-1.rindicomfort.io"),
        stake: Cl.uint(100000000),
        active: Cl.bool(true),
        rating: Cl.uint(100),
        "registered-at": Cl.uint(regBlock)
      })
    );
  });

  it("fails registration if the STX stake is below the minimum limit", () => {
    // Try registering indexer2 with 50 STX (50,000,000 micro-STX), which is less than 100 STX
    const registerResponse = simnet.callPublicFn(
      "indexer-registry",
      "register-indexer",
      [
        Cl.stringUtf8("https://indexer-stacks-2.rindicomfort.io"),
        Cl.uint(50000000)
      ],
      indexer2
    );
    // ERR-INSUFFICIENT-STAKE is (err u103)
    expect(registerResponse.result).toBeErr(Cl.uint(103));
  });

  it("allows updating the API endpoint URL", () => {
    // First register
    simnet.callPublicFn(
      "indexer-registry",
      "register-indexer",
      [
        Cl.stringUtf8("https://indexer-stacks-1.rindicomfort.io"),
        Cl.uint(100000000)
      ],
      indexer1
    );
    const regBlock = simnet.blockHeight;

    // Update endpoint
    const updateResponse = simnet.callPublicFn(
      "indexer-registry",
      "update-endpoint",
      [Cl.stringUtf8("https://new-endpoint.rindicomfort.io")],
      indexer1
    );
    expect(updateResponse.result).toBeOk(Cl.bool(true));

    // Verify update
    const infoResponse = simnet.callReadOnlyFn(
      "indexer-registry",
      "get-indexer-info",
      [Cl.principal(indexer1)],
      deployer
    );
    expect(infoResponse.result).toBeSome(
      Cl.tuple({
        endpoint: Cl.stringUtf8("https://new-endpoint.rindicomfort.io"),
        stake: Cl.uint(100000000),
        active: Cl.bool(true),
        rating: Cl.uint(100),
        "registered-at": Cl.uint(regBlock)
      })
    );
  });

  it("supports submitting query requests, responding, and transferring rewards", () => {
    // 1. Register Indexer
    simnet.callPublicFn(
      "indexer-registry",
      "register-indexer",
      [
        Cl.stringUtf8("https://indexer-stacks-1.rindicomfort.io"),
        Cl.uint(100000000)
      ],
      indexer1
    );

    // 2. Request a query with 10 STX reward (10,000,000 micro-STX)
    const queryHash = new Uint8Array(32);
    queryHash[0] = 1;
    const requestResponse = simnet.callPublicFn(
      "indexer-registry",
      "request-query",
      [Cl.buffer(queryHash), Cl.uint(10000000)],
      requester1
    );
    // Returns query-id (u1)
    expect(requestResponse.result).toBeOk(Cl.uint(1));

    // 3. Indexer responds to query
    const responseHash = new Uint8Array(32);
    responseHash[0] = 2;
    const submitResponse = simnet.callPublicFn(
      "indexer-registry",
      "submit-response",
      [Cl.uint(1), Cl.buffer(responseHash)],
      indexer1
    );
    expect(submitResponse.result).toBeOk(Cl.bool(true));

    // 4. Requester finalizes and approves response (releasing STX to indexer)
    const finalizeResponse = simnet.callPublicFn(
      "indexer-registry",
      "finalize-query",
      [Cl.uint(1), Cl.bool(true)],
      requester1
    );
    expect(finalizeResponse.result).toBeOk(Cl.bool(true));

    // Verify indexer score increased
    const scoreResponse = simnet.callReadOnlyFn(
      "indexer-registry",
      "get-indexer-score",
      [Cl.principal(indexer1)],
      deployer
    );
    expect(scoreResponse.result).toBeSome(
      Cl.tuple({
        "positive-votes": Cl.uint(1),
        "negative-votes": Cl.uint(0)
      })
    );
  });

  it("allows the owner to slash malicious or offline indexers", () => {
    // 1. Register Indexer
    simnet.callPublicFn(
      "indexer-registry",
      "register-indexer",
      [
        Cl.stringUtf8("https://indexer-stacks-1.rindicomfort.io"),
        Cl.uint(100000000)
      ],
      indexer1
    );
    const regBlock = simnet.blockHeight;

    // 2. Slash indexer1 (by owner / deployer)
    const slashResponse = simnet.callPublicFn(
      "indexer-registry",
      "slash-indexer",
      [Cl.principal(indexer1)],
      deployer
    );
    expect(slashResponse.result).toBeOk(Cl.bool(true));

    // Verify indexer is now inactive and has lost 50 STX stake
    const infoResponse = simnet.callReadOnlyFn(
      "indexer-registry",
      "get-indexer-info",
      [Cl.principal(indexer1)],
      deployer
    );
    expect(infoResponse.result).toBeSome(
      Cl.tuple({
        endpoint: Cl.stringUtf8("https://indexer-stacks-1.rindicomfort.io"),
        stake: Cl.uint(50000000), // Slashed by 50 STX (50,000,000 micro-STX)
        active: Cl.bool(false),
        rating: Cl.uint(100),
        "registered-at": Cl.uint(regBlock)
      })
    );
  });
});
