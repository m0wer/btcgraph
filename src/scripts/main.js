import { propagatePoison, resetGraph } from "./graph/index.js";
import { fetchAllAddressesTransactions } from "./api/index.js";
import { addresses } from "./state.js";

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Fetch data button
  document.getElementById("fetch-data-btn").addEventListener("click", () => {
    // Parse addresses from textarea
    const addressesText = document.getElementById("addresses-textarea").value;
    const addressLines = addressesText
      .split("\n")
      .filter((line) => line.trim());

    // Clear existing addresses
    addresses.clear();

    // Add each address
    addressLines.forEach((line) => {
      const parts = line.split(":");
      const address = parts[0].trim();
      const label = parts.length > 1 ? parts[1].trim() : "";

      if (address) {
        addresses.add(address);
        // If you need to store labels, you can modify your data structure here
      }
    });

    fetchAllAddressesTransactions();
  });

  // Propagate poison button
  document
    .getElementById("propagate-poison-btn")
    .addEventListener("click", () => {
      // Parse poisoned transactions
      const poisonedText = document.getElementById("poisoned-textarea").value;
      const poisonedTxIds = poisonedText
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.trim());

      // Update your poisoned transactions state here
      // This depends on how your propagatePoison function works
      // For example:
      const poisonedElements = {
        transactions: new Set(poisonedTxIds),
        addresses: new Set(), // empty since we only accept transactions now
      };

      propagatePoison(poisonedElements);
    });

  // Reset graph button
  document
    .getElementById("reset-graph-btn")
    .addEventListener("click", resetGraph);

  // Initialize with test address
  document.getElementById("addresses-textarea").value =
    "bc1qz6d43pyldv82zrj0cusfdmsp3k3d542zl43t0y";
});
