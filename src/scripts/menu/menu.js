import {
  addresses,
  poisonedAddresses,
  poisonedTransactions,
  taggedAddresses,
  taggedTransactions,
} from "../state.js";

// ADDRESSES

const addAddress = () => {
  const addressInput = document.getElementById("address-input");
  const address = addressInput.value.trim();

  if (!address) {
    showNotification("Please enter a valid address");
    return;
  }

  if (addresses.has(address)) {
    showNotification("Address already added");
    return;
  }

  if (address && !addresses.has(address)) {
    addresses.add(address);
    updateAddressesList();
    addressInput.value = "";
  }
};

const removeAddress = (address) => {
  addresses.delete(address);
  updateAddressesList();
};

const updateAddressesList = () => {
  const addressesList = document.getElementById("addresses-list");
  addressesList.innerHTML = "";

  addresses.forEach((address) => {
    const item = document.createElement("div");
    item.className = "address-item";

    const addressText = document.createElement("span");
    addressText.textContent = address.substring(0, 15) + "...";
    addressText.title = address;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "X";
    removeBtn.onclick = () => removeAddress(address);

    item.appendChild(addressText);
    item.appendChild(removeBtn);
    addressesList.appendChild(item);
  });
};

// POISONED

const addPoisoned = () => {
  const typeSelect = document.getElementById("poison-type");
  const poisonInput = document.getElementById("poison-input");
  const type = typeSelect.value;
  const id = poisonInput.value.trim();

  if (!id) return;

  if (type === "address") {
    poisonedAddresses.add(id);
  } else {
    poisonedTransactions.add(id);
  }

  updatePoisonedList();
  poisonInput.value = "";

  // If the element exists in the graph, mark it as poisoned
  if (!graph) return;
  if (graph.hasNode(id) || graph.hasEdge(id)) {
    propagatePoison();
  }
};

const removePoisoned = (type, id) => {
  if (type === "address") {
    poisonedAddresses.delete(id);
  } else {
    poisonedTransactions.delete(id);
  }
  updatePoisonedList();

  // Update graph to reflect changes
  resetPoisonStatus();
  propagatePoison();
};

const updatePoisonedList = () => {
  const poisonedList = document.getElementById("poisoned-list");
  poisonedList.innerHTML = "";

  poisonedAddresses.forEach((address) => {
    const item = document.createElement("div");
    item.className = "poisoned-item";

    const addressText = document.createElement("span");
    addressText.textContent = "Address: " + address.substring(0, 10) + "...";
    addressText.title = address;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "X";
    removeBtn.onclick = () => removePoisoned("address", address);

    item.appendChild(addressText);
    item.appendChild(removeBtn);
    poisonedList.appendChild(item);
  });

  poisonedTransactions.forEach((txid) => {
    const item = document.createElement("div");
    item.className = "poisoned-item";

    const txText = document.createElement("span");
    txText.textContent = "Tx: " + txid.substring(0, 10) + "...";
    txText.title = txid;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "X";
    removeBtn.onclick = () => removePoisoned("transaction", txid);

    item.appendChild(txText);
    item.appendChild(removeBtn);
    poisonedList.appendChild(item);
  });
};

const updateTaggedElementsList = () => {
  const taggedAddressesList = document.getElementById("tagged-addresses");
  const taggedTransactionsList = document.getElementById("tagged-transactions");

  taggedAddressesList.innerHTML = "";
  taggedTransactionsList.innerHTML = "";

  taggedAddresses.forEach((tag, address) => {
    const item = document.createElement("div");
    item.className = "address-item";

    const text = document.createElement("span");
    text.textContent = `${tag} (${address.substring(0, 8)}...)`;
    text.title = address;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "X";
    removeBtn.onclick = () => {
      taggedAddresses.delete(address);
      graph.setNodeAttribute(address, "label", address.substring(0, 8) + "...");
      updateTaggedElementsList();
      sigmaInstance.refresh();
    };

    item.appendChild(text);
    item.appendChild(removeBtn);
    taggedAddressesList.appendChild(item);
  });

  taggedTransactions.forEach((tag, txid) => {
    const item = document.createElement("div");
    item.className = "address-item";

    const text = document.createElement("span");
    text.textContent = `${tag} (${txid.substring(0, 8)}...)`;
    text.title = txid;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "X";
    removeBtn.onclick = () => {
      taggedTransactions.delete(txid);
      updateTaggedElementsList();
    };

    item.appendChild(text);
    item.appendChild(removeBtn);
    taggedTransactionsList.appendChild(item);
  });
};

export {
  addAddress,
  removeAddress,
  updateAddressesList,
  addPoisoned,
  removePoisoned,
  updatePoisonedList,
  updateTaggedElementsList,
};
