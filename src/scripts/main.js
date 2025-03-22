import { propagatePoison, resetGraph } from "./graph/index.js";
import {
  addAddress,
  updateAddressesList,
  addPoisoned,
  updatePoisonedList,
} from "./menu/index.js";
import { fetchAllAddressesTransactions } from "./api/index.js";
import { addresses } from "./state.js";

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Add address button
  document
    .getElementById("add-address-btn")
    .addEventListener("click", addAddress);

  // Address input field - add on Enter key
  document
    .getElementById("address-input")
    .addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        addAddress();
      }
    });

  // Fetch data button
  document
    .getElementById("fetch-data-btn")
    .addEventListener("click", fetchAllAddressesTransactions);

  // Add poison button
  document
    .getElementById("add-poison-btn")
    .addEventListener("click", addPoisoned);

  // Poison input field - add on Enter key
  document.getElementById("poison-input").addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      addPoisoned();
    }
  });

  // Propagate poison button
  document
    .getElementById("propagate-poison-btn")
    .addEventListener("click", propagatePoison);

  // Reset graph button
  document
    .getElementById("reset-graph-btn")
    .addEventListener("click", resetGraph);

  // Initialize the display
  updateAddressesList();
  updatePoisonedList();

  const testAddresses = ["bc1qz6d43pyldv82zrj0cusfdmsp3k3d542zl43t0y"];

  testAddresses.forEach((addr) => {
    addresses.add(addr);
  });
  updateAddressesList();
});
