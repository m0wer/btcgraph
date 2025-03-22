import {
  poisonedAddresses,
  poisonedTransactions,
  taggedAddresses,
  taggedTransactions,
} from "../state.js";

import { showNotification } from "../utils/index.js";

import { showNodeInfo } from "./node.js";
import { showEdgeInfo } from "./edge.js";

import { updateTaggedElementsList } from "../menu/index.js";
import { fetchAddressTxs } from "../api/mempool.js";

const graph = new graphology.Graph();

var sigmaInstance = null;

const nodeSizeFactor = 1 / 1000000;
const edgeSizeFactor = nodeSizeFactor / 10;

const paintTransactions = (transactions) => {
  transactions.forEach((tx) => {
    // Process inputs
    tx.vin.forEach((input) => {
      if (input.prevout && input.prevout.scriptpubkey_address) {
        const inputAddress = input.prevout.scriptpubkey_address;
        // Add input address if it doesn't exist
        if (!graph.hasNode(inputAddress)) {
          graph.addNode(inputAddress, {
            label: inputAddress.substring(0, 8) + "...",
            x: Math.random(),
            y: Math.random(),
            size: input.prevout.value * nodeSizeFactor,
            color: "#4CAF50",
            isPoisoned: false,
            balance: input.prevout.value,
          });
        }
      }
    });

    // Process outputs
    tx.vout.forEach((output) => {
      if (output.scriptpubkey_address) {
        const outputAddress = output.scriptpubkey_address;
        // Add output address if it doesn't exist
        if (!graph.hasNode(outputAddress)) {
          graph.addNode(outputAddress, {
            label: outputAddress.substring(0, 8) + "...",
            x: Math.random(),
            y: Math.random(),
            size: output.value * nodeSizeFactor,
            color: "#4CAF50",
            isPoisoned: false,
            balance: output.value,
          });
        }
      }
    });

    // Add edges from inputs to outputs
    tx.vin.forEach((input) => {
      if (input.prevout && input.prevout.scriptpubkey_address) {
        const inputAddress = input.prevout.scriptpubkey_address;
        tx.vout.forEach((output) => {
          if (output.scriptpubkey_address) {
            const outputAddress = output.scriptpubkey_address;
            // Add the transaction edge - check if it doesn't exist first
            if (
              !graph.hasEdge(tx.txid) &&
              graph.hasNode(inputAddress) &&
              graph.hasNode(outputAddress)
            ) {
              graph.addEdgeWithKey(tx.txid, inputAddress, outputAddress, {
                size: output.value * edgeSizeFactor,
                color: "#888",
                isPoisoned: false,
                amount: output.value,
                date: new Date(tx.status.block_time * 1000)
                  .toISOString()
                  .split("T")[0],
              });
            }
          }
        });
      }
    });
  });

  // Apply layout and update rendering
  if (sigmaInstance) {
    sigmaInstance.refresh();
  } else {
    renderGraph();
  }

  // Check for poisoned elements
  propagatePoison();
};

const resetGraph = () => {
  // Clear the graph and reset all data structures
  graph.clear();

  if (sigmaInstance) {
    sigmaInstance.kill();
    sigmaInstance = null;
  }

  // Don't clear addresses or poisoned items as user might want to reuse them

  // Reset the node and edge info panels
  document.getElementById("node-info").style.display = "none";
  document.getElementById("edge-info").style.display = "none";

  // Clear tagged elements
  taggedAddresses.clear();
  taggedTransactions.clear();
  updateTaggedElementsList();

  showNotification("Graph reset");
};

const renderGraph = () => {
  // Initialize sigma
  const container = document.getElementById("graph");
  if (sigmaInstance) {
    sigmaInstance.kill();
  }

  // Initialize layout
  const settings = graphologyLibrary.layoutForceAtlas2.inferSettings(graph);
  graphologyLibrary.layoutForceAtlas2.assign(graph, {
    iterations: 50,
    settings: settings,
  });

  sigmaInstance = new Sigma(graph, container);

  // Apply poison status to initial marked elements
  propagatePoison();
  // Add event listeners for node and edge clicks
  sigmaInstance.on("clickNode", async ({ node }) => {
    showNodeInfo(node);
    let transactions = await fetchAddressTxs(node);
    paintTransactions(transactions);
  });
  sigmaInstance.on("clickEdge", ({ edge }) => {
    showEdgeInfo(edge);
  });
  // Update the tagged elements section
  updateTaggedElementsList();
};

const propagatePoison = () => {
  resetPoisonStatus();

  // Mark initial poisoned nodes and edges
  poisonedAddresses.forEach((address) => {
    if (graph.hasNode(address)) {
      graph.setNodeAttribute(address, "isPoisoned", true);
      graph.setNodeAttribute(address, "color", "#f44336");
    }
  });

  poisonedTransactions.forEach((txid) => {
    if (graph.hasEdge(txid)) {
      graph.setEdgeAttribute(txid, "isPoisoned", true);
      graph.setEdgeAttribute(txid, "color", "#f44336");
    }
  });

  const direction = document.getElementById("propagation-direction").value;
  let changed = true;

  // Propagate poison until no more changes
  while (changed) {
    changed = false;

    // Forward propagation (from inputs to outputs)
    if (direction === "forward" || direction === "both") {
      graph.forEachNode((node, attributes) => {
        if (attributes.isPoisoned) {
          // Find outgoing transactions (edges where this node is the source)
          graph.forEachOutEdge(node, (edge, edgeAttributes, target) => {
            if (!edgeAttributes.isPoisoned) {
              graph.setEdgeAttribute(edge, "isPoisoned", true);
              graph.setEdgeAttribute(edge, "color", "#f44336");
              changed = true;
            }

            // Poison the target node
            if (!graph.getNodeAttribute(target, "isPoisoned")) {
              graph.setNodeAttribute(target, "isPoisoned", true);
              graph.setNodeAttribute(target, "color", "#f44336");
              changed = true;
            }
          });
        }
      });

      // Also propagate from poisoned transactions to output addresses
      graph.forEachEdge((edge, attributes, source, target) => {
        if (attributes.isPoisoned) {
          if (!graph.getNodeAttribute(target, "isPoisoned")) {
            graph.setNodeAttribute(target, "isPoisoned", true);
            graph.setNodeAttribute(target, "color", "#f44336");
            changed = true;
          }
        }
      });
    }

    // Backward propagation (from outputs to inputs)
    if (direction === "backward" || direction === "both") {
      graph.forEachNode((node, attributes) => {
        if (attributes.isPoisoned) {
          // Find incoming transactions (edges where this node is the target)
          graph.forEachInEdge(node, (edge, edgeAttributes, source) => {
            if (!edgeAttributes.isPoisoned) {
              graph.setEdgeAttribute(edge, "isPoisoned", true);
              graph.setEdgeAttribute(edge, "color", "#f44336");
              changed = true;
            }

            // Poison the source node
            if (!graph.getNodeAttribute(source, "isPoisoned")) {
              graph.setNodeAttribute(source, "isPoisoned", true);
              graph.setNodeAttribute(source, "color", "#f44336");
              changed = true;
            }
          });
        }
      });

      // Also propagate from poisoned transactions to input addresses
      graph.forEachEdge((edge, attributes, source, target) => {
        if (attributes.isPoisoned) {
          if (!graph.getNodeAttribute(source, "isPoisoned")) {
            graph.setNodeAttribute(source, "isPoisoned", true);
            graph.setNodeAttribute(source, "color", "#f44336");
            changed = true;
          }
        }
      });
    }
  }

  // Refresh the rendering
  if (sigmaInstance) {
    sigmaInstance.refresh();
  }
};

const resetPoisonStatus = () => {
  // Reset all nodes and edges to clean
  graph.forEachNode((node, attributes) => {
    graph.setNodeAttribute(node, "isPoisoned", false);
    graph.setNodeAttribute(node, "color", "#4CAF50");
  });

  graph.forEachEdge((edge, attributes) => {
    graph.setEdgeAttribute(edge, "isPoisoned", false);
    graph.setEdgeAttribute(edge, "color", "#888");
  });
};

export {
  paintTransactions,
  graph,
  sigmaInstance,
  resetGraph,
  renderGraph,
  propagatePoison,
};
