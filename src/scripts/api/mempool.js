import { showNotification } from "../utils/index.js";
import { graph, paintTransactions } from "../graph/index.js";
import { addresses } from "../state.js";

const mempoolApiBaseURL = "https://mempool.sgn.space/api";

const fetchAddressTxs = async (address) => {
  const url = `${mempoolApiBaseURL}/address/${address}/txs`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  const data = await response.json();
  return data;
};

const fetchAllAddressesTransactions = async () => {
  if (addresses.size === 0) {
    showNotification("Please add at least one address");
    return;
  }
  showNotification("Fetching transaction history...");

  // Initialize a new graph
  graph.clear();

  try {
    // Process each address
    const fetchPromises = Array.from(addresses).map(async (address) => {
      try {
        // Fetch transaction history using the REST API instead of WebSocket
        const transactions = await fetchAddressTxs(address);

        // Process the historical transactions
        paintTransactions(transactions);

        return transactions;
      } catch (error) {
        console.error(`Error fetching data for address ${address}:`, error);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);

    // Check if we got any valid results
    const successfulResults = results.filter((result) => result !== null);

    if (successfulResults.length === 0) {
      showNotification("Failed to fetch transaction data");
    } else {
      showNotification(
        `Successfully fetched transaction history for ${successfulResults.length} address(es)`,
      );
    }
  } catch (error) {
    console.error("Failed to fetch transaction history:", error);
    showNotification("Failed to fetch transaction data");
  }
};

export { fetchAddressTxs, fetchAllAddressesTransactions };
