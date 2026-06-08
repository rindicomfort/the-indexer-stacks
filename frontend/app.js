// Stacks Dashboard Interactivity & Simulation

// Mock Initial State
let isWalletConnected = false;
let userAddress = "";
let totalIndexersCount = 3;
let activeQueriesCount = 4;
let totalStxLocked = 210;

let indexersList = [
  { address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", endpoint: "https://indexer-stacks-1.rindicomfort.io", stake: 100, rating: 100, active: true },
  { address: "ST2CY5V39NHDPGPVE3YFEE5RT6Z5FFZTSV7185596", endpoint: "https://stacks-main-node.indexer.net", stake: 120, rating: 98, active: true },
  { address: "ST3AM1A56AK2C1XAFJ4115ZSV26Y439NZ46V410DE", endpoint: "https://eu-query.theindexer.org", stake: 100, rating: 95, active: false }
];

let queriesList = [
  { id: 1, requester: "ST2CY5V39NHDPGPVE3YFEE5RT6Z5FFZTSV7185596", reward: 10, hash: "0x3ab8...12c9", status: "pending", responder: null },
  { id: 2, requester: "ST3AM1A56AK2C1XAFJ4115ZSV26Y439NZ46V410DE", reward: 5, hash: "0xe29d...5f21", status: "responded", responder: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" },
  { id: 3, requester: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", reward: 25, hash: "0xab12...c098", status: "completed", responder: "ST2CY5V39NHDPGPVE3YFEE5RT6Z5FFZTSV7185596" },
  { id: 4, requester: "ST2J7B1...8F9D", reward: 15, hash: "0x5f2b...cc43", status: "disputed", responder: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" }
];

// DOM Elements
const connectBtn = document.getElementById("connect-wallet");
const addressSpan = document.getElementById("wallet-address");
const totalIndexersEl = document.getElementById("total-indexers");
const activeQueriesEl = document.getElementById("active-queries");
const totalStxLockedEl = document.getElementById("total-stx-locked");

const registerForm = document.getElementById("register-form");
const queryForm = document.getElementById("query-form");
const slashForm = document.getElementById("slash-form");

const indexersTableBody = document.getElementById("indexers-table-body");
const queriesTableBody = document.getElementById("queries-table-body");

// Initialize Render
function renderDashboard() {
  // Stats
  totalIndexersEl.textContent = totalIndexersCount;
  activeQueriesEl.textContent = queriesList.filter(q => q.status === "pending" || q.status === "responded").length;
  totalStxLockedEl.textContent = `${totalStxLocked} STX`;

  // Render Indexers
  indexersTableBody.innerHTML = "";
  indexersList.forEach(ind => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="wallet-address">${shortenAddress(ind.address)}</span></td>
      <td><code>${ind.endpoint}</code></td>
      <td>${ind.stake} STX</td>
      <td>${ind.rating}/100</td>
      <td><span class="${ind.active ? 'text-active' : 'text-inactive'}">${ind.active ? 'Active' : 'Inactive'}</span></td>
    `;
    indexersTableBody.appendChild(tr);
  });

  // Render Queries
  queriesTableBody.innerHTML = "";
  queriesList.forEach(q => {
    const tr = document.createElement("tr");
    
    // Determine dynamic actions button based on status
    let actionBtnHTML = "";
    if (q.status === "pending") {
      actionBtnHTML = `<button onclick="simulateResponse(${q.id})" class="btn btn-secondary btn-sm">Process & Respond</button>`;
    } else if (q.status === "responded") {
      actionBtnHTML = `
        <div class="action-buttons-cell">
          <button onclick="finalizeQuery(${q.id}, true)" class="btn btn-accent btn-sm">Approve</button>
          <button onclick="finalizeQuery(${q.id}, false)" class="btn btn-danger btn-sm">Dispute</button>
        </div>
      `;
    } else {
      actionBtnHTML = `<span class="text-inactive">Archived</span>`;
    }

    tr.innerHTML = `
      <td>#${q.id}</td>
      <td><span class="wallet-address">${shortenAddress(q.requester)}</span></td>
      <td>${q.reward} STX</td>
      <td><span class="status-pill status-${q.status}">${q.status}</span></td>
      <td>${actionBtnHTML}</td>
    `;
    queriesTableBody.appendChild(tr);
  });
}

// Helper: Shorten Address
function shortenAddress(addr) {
  if (addr.length <= 12) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 6)}`;
}

// Wallet Connection simulation
connectBtn.addEventListener("click", () => {
  if (!isWalletConnected) {
    // Connect Wallet simulation
    isWalletConnected = true;
    userAddress = "ST2J7B14A9DE1828BF9D4AC408A296E857410ABCD";
    connectBtn.textContent = "Disconnect";
    addressSpan.textContent = shortenAddress(userAddress);
    addressSpan.classList.remove("hidden");
    console.log("Stacks wallet connection request triggered (Simulated). Connected as " + userAddress);
  } else {
    isWalletConnected = false;
    userAddress = "";
    connectBtn.textContent = "Connect Stacks Wallet";
    addressSpan.textContent = "";
    addressSpan.classList.add("hidden");
    console.log("Stacks wallet disconnected.");
  }
});

// Register Indexer
registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  
  if (!isWalletConnected) {
    alert("Please connect your Stacks wallet first.");
    return;
  }

  const endpoint = document.getElementById("endpoint").value;
  const stake = parseInt(document.getElementById("stake-amount").value);

  // Simulation Update
  indexersList.push({
    address: userAddress,
    endpoint: endpoint,
    stake: stake,
    rating: 100,
    active: true
  });

  totalIndexersCount++;
  totalStxLocked += stake;

  console.log(`[Transaction] Broadcasted 'register-indexer' function call.\n  Args: endpoint="${endpoint}", stake=${stake} STX`);
  
  registerForm.reset();
  renderDashboard();
});

// Request Query
queryForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!isWalletConnected) {
    alert("Please connect your Stacks wallet first.");
    return;
  }

  const hash = document.getElementById("query-target").value;
  const reward = parseInt(document.getElementById("query-reward").value);

  const nextId = queriesList.length + 1;
  queriesList.push({
    id: nextId,
    requester: userAddress,
    reward: reward,
    hash: hash.substring(0, 10) + "...",
    status: "pending",
    responder: null
  });

  totalStxLocked += reward;

  console.log(`[Transaction] Broadcasted 'request-query' function call.\n  Args: query-hash="${hash}", reward=${reward} STX`);

  queryForm.reset();
  renderDashboard();
});

// Simulate Indexer Node responding to pending query
window.simulateResponse = function(queryId) {
  const query = queriesList.find(q => q.id === queryId);
  if (!query) return;

  // Pick an active indexer to respond
  const activeIndexer = indexersList.find(ind => ind.active) || indexersList[0];
  
  query.status = "responded";
  query.responder = activeIndexer.address;

  console.log(`[Event] Indexer ${activeIndexer.address} submitted response for Query ID #${queryId}`);

  renderDashboard();
};

// Finalize Query (Approve / Dispute)
window.finalizeQuery = function(queryId, approved) {
  const query = queriesList.find(q => q.id === queryId);
  if (!query) return;

  if (approved) {
    query.status = "completed";
    totalStxLocked -= query.reward; // payout to indexer
    console.log(`[Transaction] Broadcasted 'finalize-query' with approved=true. Reward ${query.reward} STX transferred to responder: ${query.responder}`);
  } else {
    query.status = "disputed";
    totalStxLocked -= query.reward; // refund to requester
    console.log(`[Transaction] Broadcasted 'finalize-query' with approved=false. Reward ${query.reward} STX refunded to requester: ${query.requester}`);
  }

  renderDashboard();
};

// Owner Slash
slashForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const target = document.getElementById("slash-target").value;
  const indexer = indexersList.find(ind => ind.address.toLowerCase() === target.toLowerCase());

  if (!indexer) {
    alert("Indexer principal not found in registry.");
    return;
  }

  if (!indexer.active) {
    alert("Indexer is already inactive.");
    return;
  }

  indexer.active = false;
  const slashedAmount = indexer.stake >= 50 ? 50 : indexer.stake;
  indexer.stake -= slashedAmount;
  totalStxLocked -= slashedAmount;
  totalIndexersCount--;

  console.log(`[Owner Transaction] Broadcasted 'slash-indexer' call on ${target}. Slashed ${slashedAmount} STX.`);

  slashForm.reset();
  renderDashboard();
});

// Initial Render
renderDashboard();
