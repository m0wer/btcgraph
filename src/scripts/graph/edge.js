import { updateTaggedElementsList } from "../menu/index.js";

const showEdgeInfo = (edgeId) => {
  const edgeInfo = document.getElementById("edge-info");
  const edgeDetails = document.getElementById("edge-details");

  if (graph.hasEdge(edgeId)) {
    const attributes = graph.getEdgeAttributes(edgeId);
    const [source, target] = graph.extremities(edgeId);

    edgeDetails.innerHTML = `
      <p><strong>Transaction ID:</strong> ${edgeId}</p>
      <p><strong>From:</strong> ${source}</p>
      <p><strong>To:</strong> ${target}</p>
      <p><strong>Amount:</strong> ${attributes.amount.toFixed(8)} BTC</p>
      <p><strong>Date:</strong> ${attributes.date}</p>
      <p><strong>Status:</strong> ${
        attributes.isPoisoned ? "Poisoned" : "Clean"
      }</p>
      <div>
        <input type="text" id="edge-tag-input" placeholder="Add a label for this transaction">
        <button id="add-edge-tag-btn">Add Label</button>
      </div>
    `;

    // Add event listener for tagging
    document
      .getElementById("add-edge-tag-btn")
      .addEventListener("click", () => {
        const tagInput = document.getElementById("edge-tag-input");
        const tag = tagInput.value.trim();

        if (tag) {
          taggedTransactions.set(edgeId, tag);
          updateTaggedElementsList();
          tagInput.value = "";
        }
      });

    edgeInfo.style.display = "block";
  }
};

export { showEdgeInfo };
