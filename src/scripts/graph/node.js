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
      <p><strong>Balance:</strong> ${attributes.balance.toFixed(8)} sats</p>
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

export { showNodeInfo };
