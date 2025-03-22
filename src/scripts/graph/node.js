import { graph, sigmaInstance, propagatePoison } from "./graph.js";
import { taggedAddresses } from "../state.js";
import { showNotification } from "../utils/index.js";
import { updateTaggedElementsList } from "../menu/index.js";

const showNodeInfo = (nodeId) => {
  const nodeInfo = document.getElementById("node-info");
  const nodeDetails = document.getElementById("node-details");

  if (graph.hasNode(nodeId)) {
    const attributes = graph.getNodeAttributes(nodeId);

    nodeDetails.innerHTML = `
      <p><strong>Address:</strong> ${nodeId}</p>
      <p><strong>Balance:</strong> ${attributes.balance.toFixed(8)} BTC</p>
      <p><strong>Status:</strong> ${
        attributes.isPoisoned ? "Poisoned" : "Clean"
      }</p>
      <div>
        <input type="text" id="node-tag-input" placeholder="Add a label for this address">
        <button id="add-node-tag-btn">Add Label</button>
      </div>
    `;

    // Add event listener for tagging
    document
      .getElementById("add-node-tag-btn")
      .addEventListener("click", () => {
        const tagInput = document.getElementById("node-tag-input");
        const tag = tagInput.value.trim();

        if (tag) {
          taggedAddresses.set(nodeId, tag);
          graph.setNodeAttribute(nodeId, "label", tag);
          sigmaInstance.refresh();
          updateTaggedElementsList();
          tagInput.value = "";
        }
      });

    nodeInfo.style.display = "block";
  }
};

const fetchNeighborNodes = (nodeId) => {
  // In a real implementation, this would fetch data from the mempool API
  // For demo purposes, we'll simulate adding new nodes
  showNotification("Fetching neighbor nodes...");

  // Check if we already have a significant number of neighbors
  const neighbors = [
    ...graph.inNeighbors(nodeId),
    ...graph.outNeighbors(nodeId),
  ];

  if (neighbors.length > 5) {
    // Already have enough neighbors
    showNotification("Neighbors already loaded");
    return;
  }

  // Add 2-3 new nodes as neighbors
  const numNewNeighbors = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numNewNeighbors; i++) {
    const newAddr = "addr_" + Math.random().toString(36).substring(2, 15);

    // Only add if it doesn't already exist
    if (!graph.hasNode(newAddr)) {
      graph.addNode(newAddr, {
        label: newAddr.substring(0, 8) + "...",
        x: graph.getNodeAttribute(nodeId, "x") + (Math.random() - 0.5) * 0.5,
        y: graph.getNodeAttribute(nodeId, "y") + (Math.random() - 0.5) * 0.5,
        size: 2 + Math.random() * 6,
        color: "#4CAF50",
        isPoisoned: false,
        balance: Math.random() * 3,
      });

      // Randomly make this an input or output
      const isInput = Math.random() > 0.5;
      const txid = "tx_" + Math.random().toString(36).substring(2, 15);

      if (isInput) {
        graph.addEdgeWithKey(txid, newAddr, nodeId, {
          size: 1 + Math.random() * 2,
          color: "#888",
          isPoisoned: false,
          amount: Math.random() * 1.5,
          // Fix date calculation
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        });
      } else {
        graph.addEdgeWithKey(txid, nodeId, newAddr, {
          size: 1 + Math.random() * 2,
          color: "#888",
          isPoisoned: false,
          amount: Math.random() * 1.5,
          // Fix date calculation
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
        });
      }
    }
  }
  // Apply poison status to new elements
  propagatePoison();
  showNotification("Neighbor nodes loaded");
};

export { showNodeInfo, fetchNeighborNodes };
