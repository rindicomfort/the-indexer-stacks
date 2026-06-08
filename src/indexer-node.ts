import { 
  makeContractCall, 
  broadcastTransaction, 
  AnchorMode, 
  bufferCV, 
  uintCV 
} from "@stacks/transactions";

// Mock environment configuration
const STACKS_API_URL = process.env.STACKS_API_URL || "http://localhost:3999";
const INDEXER_PRIVATE_KEY = process.env.INDEXER_PRIVATE_KEY || "753f7620268912e6507856e76744400e408a296e857410020478051700000000"; // Mock key
const CONTRACT_ADDRESS = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const CONTRACT_NAME = "indexer-registry";

/**
 * Simulates a local indexer node checking for queries on Stacks blockchain,
 * resolving them by reading block data, and submitting the hashed response.
 */
async function runIndexerNode() {
  console.log("=========================================");
  console.log("       The Indexer - Stacks Node         ");
  console.log(`       Author: rindicomfort              `);
  console.log("=========================================");
  console.log(`Connecting to Stacks API: ${STACKS_API_URL}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
  console.log("Indexer Node started. Listening for query requests...");

  // Mock checking for new queries from block events / API
  setInterval(async () => {
    const mockQueryId = Math.floor(Math.random() * 100) + 1;
    console.log(`\n[${new Date().toISOString()}] New Query request detected: ID #${mockQueryId}`);
    
    // Simulate indexing task: reading Stacks blockchain block info
    console.log(`[ID #${mockQueryId}] Fetching blocks and calculating hash...`);
    const mockHash = Buffer.alloc(32);
    mockHash.write(`response-data-for-query-${mockQueryId}`);

    console.log(`[ID #${mockQueryId}] Calculated indexing response hash: ${mockHash.toString("hex")}`);

    // Submit the response to the smart contract
    try {
      console.log(`[ID #${mockQueryId}] Broadcasting submit-response transaction...`);
      const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "submit-response",
        functionArgs: [
          uintCV(mockQueryId),
          bufferCV(mockHash)
        ],
        senderKey: INDEXER_PRIVATE_KEY,
        validateWithAbi: true,
        network: {
          coreApiUrl: STACKS_API_URL,
          isMainnet: () => false
        },
        anchorMode: AnchorMode.Any,
      };

      console.log(`[ID #${mockQueryId}] Transaction successfully formatted.`);
      console.log(`[ID #${mockQueryId}] Mock Broadcast Success! (Response submitted)`);
    } catch (err) {
      console.error(`Error submitting response for query ${mockQueryId}:`, err);
    }
  }, 10000); // Check every 10 seconds
}

runIndexerNode().catch(console.error);
