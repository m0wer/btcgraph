// Initialize graph
const graph = new graphology.Graph();
let sigmaInstance = null;

// Store addresses and poisoned elements
const addresses = new Set();
const poisonedAddresses = new Set();
const poisonedTransactions = new Set();
const taggedAddresses = new Map(); // For custom labels
const taggedTransactions = new Map(); // For custom labels

// Mempool connection (will be initialized later)
let ws = null;

// Helper functions
function showNotification(message) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.style.display = 'block';
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

function addAddress() {
  const addressInput = document.getElementById('address-input');
  const address = addressInput.value.trim();
  
  if (address && !addresses.has(address)) {
    addresses.add(address);
    updateAddressesList();
    addressInput.value = '';
  }
}

function removeAddress(address) {
  addresses.delete(address);
  updateAddressesList();
}

function updateAddressesList() {
  const addressesList = document.getElementById('addresses-list');
  addressesList.innerHTML = '';
  
  addresses.forEach(address => {
    const item = document.createElement('div');
    item.className = 'address-item';
    
    const addressText = document.createElement('span');
    addressText.textContent = address.substring(0, 15) + '...';
    addressText.title = address;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'X';
    removeBtn.onclick = () => removeAddress(address);
    
    item.appendChild(addressText);
    item.appendChild(removeBtn);
    addressesList.appendChild(item);
  });
}

function addPoisoned() {
  const typeSelect = document.getElementById('poison-type');
  const poisonInput = document.getElementById('poison-input');
  const type = typeSelect.value;
  const id = poisonInput.value.trim();
  
  if (!id) return;
  
  if (type === 'address') {
    poisonedAddresses.add(id);
  } else {
    poisonedTransactions.add(id);
  }
  
  updatePoisonedList();
  poisonInput.value = '';
  
  // If the element exists in the graph, mark it as poisoned
  if (graph.hasNode(id) || graph.hasEdge(id)) {
    propagatePoison();
  }
}

function removePoisoned(type, id) {
  if (type === 'address') {
    poisonedAddresses.delete(id);
  } else {
    poisonedTransactions.delete(id);
  }
  updatePoisonedList();
  
  // Update graph to reflect changes
  resetPoisonStatus();
  propagatePoison();
}

function updatePoisonedList() {
  const poisonedList = document.getElementById('poisoned-list');
  poisonedList.innerHTML = '';
  
  poisonedAddresses.forEach(address => {
    const item = document.createElement('div');
    item.className = 'poisoned-item';
    
    const addressText = document.createElement('span');
    addressText.textContent = 'Address: ' + address.substring(0, 10) + '...';
    addressText.title = address;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'X';
    removeBtn.onclick = () => removePoisoned('address', address);
    
    item.appendChild(addressText);
    item.appendChild(removeBtn);
    poisonedList.appendChild(item);
  });
  
  poisonedTransactions.forEach(txid => {
    const item = document.createElement('div');
    item.className = 'poisoned-item';
    
    const txText = document.createElement('span');
    txText.textContent = 'Tx: ' + txid.substring(0, 10) + '...';
    txText.title = txid;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'X';
    removeBtn.onclick = () => removePoisoned('transaction', txid);
    
    item.appendChild(txText);
    item.appendChild(removeBtn);
    poisonedList.appendChild(item);
  });
}

function resetPoisonStatus() {
  // Reset all nodes and edges to clean
  graph.forEachNode((node, attributes) => {
    graph.setNodeAttribute(node, 'isPoisoned', false);
    graph.setNodeAttribute(node, 'color', '#4CAF50');
  });
  
  graph.forEachEdge((edge, attributes) => {
    graph.setEdgeAttribute(edge, 'isPoisoned', false);
    graph.setEdgeAttribute(edge, 'color', '#888');
  });
}

function propagatePoison() {
  resetPoisonStatus();
  
  // Mark initial poisoned nodes and edges
  poisonedAddresses.forEach(address => {
    if (graph.hasNode(address)) {
      graph.setNodeAttribute(address, 'isPoisoned', true);
      graph.setNodeAttribute(address, 'color', '#f44336');
    }
  });
  
  poisonedTransactions.forEach(txid => {
    if (graph.hasEdge(txid)) {
      graph.setEdgeAttribute(txid, 'isPoisoned', true);
      graph.setEdgeAttribute(txid, 'color', '#f44336');
    }
  });
  
  const direction = document.getElementById('propagation-direction').value;
  let changed = true;
  
  // Propagate poison until no more changes
  while (changed) {
    changed = false;
    
    // Forward propagation (from inputs to outputs)
    if (direction === 'forward' || direction === 'both') {
      graph.forEachNode((node, attributes) => {
        if (attributes.isPoisoned) {
          // Find outgoing transactions (edges where this node is the source)
          graph.forEachOutEdge(node, (edge, edgeAttributes, target) => {
            if (!edgeAttributes.isPoisoned) {
              graph.setEdgeAttribute(edge, 'isPoisoned', true);
              graph.setEdgeAttribute(edge, 'color', '#f44336');
              changed = true;
            }
            
            // Poison the target node
            if (!graph.getNodeAttribute(target, 'isPoisoned')) {
              graph.setNodeAttribute(target, 'isPoisoned', true);
              graph.setNodeAttribute(target, 'color', '#f44336');
              changed = true;
            }
          });
        }
      });
      
      // Also propagate from poisoned transactions to output addresses
      graph.forEachEdge((edge, attributes, source, target) => {
        if (attributes.isPoisoned) {
          if (!graph.getNodeAttribute(target, 'isPoisoned')) {
            graph.setNodeAttribute(target, 'isPoisoned', true);
            graph.setNodeAttribute(target, 'color', '#f44336');
            changed = true;
          }
        }
      });
    }
    
    // Backward propagation (from outputs to inputs)
    if (direction === 'backward' || direction === 'both') {
      graph.forEachNode((node, attributes) => {
        if (attributes.isPoisoned) {
          // Find incoming transactions (edges where this node is the target)
          graph.forEachInEdge(node, (edge, edgeAttributes, source) => {
            if (!edgeAttributes.isPoisoned) {
              graph.setEdgeAttribute(edge, 'isPoisoned', true);
              graph.setEdgeAttribute(edge, 'color', '#f44336');
              changed = true;
            }
            
            // Poison the source node
            if (!graph.getNodeAttribute(source, 'isPoisoned')) {
              graph.setNodeAttribute(source, 'isPoisoned', true);
              graph.setNodeAttribute(source, 'color', '#f44336');
              changed = true;
            }
          });
        }
      });
      
      // Also propagate from poisoned transactions to input addresses
      graph.forEachEdge((edge, attributes, source, target) => {
        if (attributes.isPoisoned) {
          if (!graph.getNodeAttribute(source, 'isPoisoned')) {
            graph.setNodeAttribute(source, 'isPoisoned', true);
            graph.setNodeAttribute(source, 'color', '#f44336');
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
}

async function fetchTransactionData() {
  if (addresses.size === 0) {
    showNotification('Please add at least one address');
    return;
  }
  showNotification('Fetching transaction history...');
  
  // Initialize a new graph
  graph.clear();
  
  // Close any existing WebSocket connection
  if (ws) {
    ws.close();
  }
  
  try {
    // Process each address
    const fetchPromises = Array.from(addresses).map(async (address) => {
      try {
        // Fetch transaction history using the REST API instead of WebSocket
        const response = await fetch(`https://mempool.sgn.space/api/address/${address}/txs`);
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const transactions = await response.json();
        console.log(`Fetched ${transactions.length} transactions for ${address}`);
        
        // Process the historical transactions
        processTransactions(transactions);
        
        return transactions;
      } catch (error) {
        console.error(`Error fetching data for address ${address}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Check if we got any valid results
    const successfulResults = results.filter(result => result !== null);
    
    if (successfulResults.length === 0) {
      showNotification('Failed to fetch transaction data');
    } else {
      showNotification(`Successfully fetched transaction history for ${successfulResults.length} address(es)`);
    }
    
  } catch (error) {
    console.error('Failed to fetch transaction history:', error);
    showNotification('Failed to fetch transaction data');
  }
}

function processTransactions(transactions) {
  transactions.forEach(tx => {
    // Process inputs
    tx.vin.forEach(input => {
      if (input.prevout && input.prevout.scriptpubkey_address) {
        const inputAddress = input.prevout.scriptpubkey_address;
        // Add input address if it doesn't exist
        if (!graph.hasNode(inputAddress)) {
          graph.addNode(inputAddress, {
            label: inputAddress.substring(0, 8) + '...',
            x: Math.random(),
            y: Math.random(),
            size: 3 + input.prevout.value / 100000000, // Size based on BTC value
            color: '#4CAF50',
            isPoisoned: false,
            balance: input.prevout.value / 100000000
          });
        }
      }
    });
    
    // Process outputs
    tx.vout.forEach(output => {
      if (output.scriptpubkey_address) {
        const outputAddress = output.scriptpubkey_address;
        // Add output address if it doesn't exist
        if (!graph.hasNode(outputAddress)) {
          graph.addNode(outputAddress, {
            label: outputAddress.substring(0, 8) + '...',
            x: Math.random(),
            y: Math.random(),
            size: 3 + output.value / 100000000, // Size based on BTC value
            color: '#4CAF50',
            isPoisoned: false,
            balance: output.value / 100000000
          });
        }
      }
    });
    
    // Add edges from inputs to outputs
    tx.vin.forEach(input => {
      if (input.prevout && input.prevout.scriptpubkey_address) {
        const inputAddress = input.prevout.scriptpubkey_address;
        tx.vout.forEach(output => {
          if (output.scriptpubkey_address) {
            const outputAddress = output.scriptpubkey_address;
            // Add the transaction edge - check if it doesn't exist first
            if (!graph.hasEdge(tx.txid) && graph.hasNode(inputAddress) && graph.hasNode(outputAddress)) {
              graph.addEdgeWithKey(tx.txid, inputAddress, outputAddress, {
                size: 1 + output.value / 50000000, // Size based on BTC value
                color: '#888',
                isPoisoned: false,
                amount: output.value / 100000000,
                date: new Date(tx.status.block_time * 1000).toISOString().split('T')[0]
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
}

function renderGraph() {
  // Initialize sigma
  const container = document.getElementById('graph');
  if (sigmaInstance) {
    sigmaInstance.kill();
  }

  const graph2 = new graphology.Graph();
  graph2.addNode("1", { label: "Node 1", x: 0, y: 0, size: 10, color: "blue" });
  graph2.addNode("2", { label: "Node 2", x: 1, y: 1, size: 20, color: "red" });
  graph2.addEdge("1", "2", { size: 5, color: "purple" });

  // This is the fix - remove 'defaultNodeType' and use settings that Sigma can understand
  sigmaInstance = new Sigma(graph, container, {
    renderEdgeLabels: false,
    defaultEdgeType: 'arrow',
    // Remove defaultNodeType: 'circle' as it's causing the issue
    labelDensity: 0.07,
    labelGridCellSize: 60,
    labelRenderedSizeThreshold: 6,
    minCameraRatio: 0.1,
    maxCameraRatio: 10
  });

  // Apply poison status to initial marked elements
  propagatePoison();
  // Add event listeners for node and edge clicks
  sigmaInstance.on('clickNode', ({ node }) => {
    showNodeInfo(node);
    fetchNeighborNodes(node);
  });
  sigmaInstance.on('clickEdge', ({ edge }) => {
    showEdgeInfo(edge);
  });
  // Update the tagged elements section
  updateTaggedElementsList();
}

function showNodeInfo(nodeId) {
  const nodeInfo = document.getElementById('node-info');
  const nodeDetails = document.getElementById('node-details');
  
  if (graph.hasNode(nodeId)) {
    const attributes = graph.getNodeAttributes(nodeId);
    
    nodeDetails.innerHTML = `
      <p><strong>Address:</strong> ${nodeId}</p>
      <p><strong>Balance:</strong> ${attributes.balance.toFixed(8)} BTC</p>
      <p><strong>Status:</strong> ${attributes.isPoisoned ? 'Poisoned' : 'Clean'}</p>
      <div>
        <input type="text" id="node-tag-input" placeholder="Add a label for this address">
        <button id="add-node-tag-btn">Add Label</button>
      </div>
    `;
    
    // Add event listener for tagging
    document.getElementById('add-node-tag-btn').addEventListener('click', () => {
      const tagInput = document.getElementById('node-tag-input');
      const tag = tagInput.value.trim();
      
      if (tag) {
        taggedAddresses.set(nodeId, tag);
        graph.setNodeAttribute(nodeId, 'label', tag);
        sigmaInstance.refresh();
        updateTaggedElementsList();
        tagInput.value = '';
      }
    });
    
    nodeInfo.style.display = 'block';
  }
}

function showEdgeInfo(edgeId) {
  const edgeInfo = document.getElementById('edge-info');
  const edgeDetails = document.getElementById('edge-details');
  
  if (graph.hasEdge(edgeId)) {
    const attributes = graph.getEdgeAttributes(edgeId);
    const [source, target] = graph.extremities(edgeId);
    
    edgeDetails.innerHTML = `
      <p><strong>Transaction ID:</strong> ${edgeId}</p>
      <p><strong>From:</strong> ${source}</p>
      <p><strong>To:</strong> ${target}</p>
      <p><strong>Amount:</strong> ${attributes.amount.toFixed(8)} BTC</p>
      <p><strong>Date:</strong> ${attributes.date}</p>
      <p><strong>Status:</strong> ${attributes.isPoisoned ? 'Poisoned' : 'Clean'}</p>
      <div>
        <input type="text" id="edge-tag-input" placeholder="Add a label for this transaction">
        <button id="add-edge-tag-btn">Add Label</button>
      </div>
    `;
    
    // Add event listener for tagging
    document.getElementById('add-edge-tag-btn').addEventListener('click', () => {
      const tagInput = document.getElementById('edge-tag-input');
      const tag = tagInput.value.trim();
      
      if (tag) {
        taggedTransactions.set(edgeId, tag);
        updateTaggedElementsList();
        tagInput.value = '';
      }
    });
    
    edgeInfo.style.display = 'block';
  }
}

function fetchNeighborNodes(nodeId) {
  // In a real implementation, this would fetch data from the mempool API
  // For demo purposes, we'll simulate adding new nodes
  showNotification('Fetching neighbor nodes...');
  
  // Check if we already have a significant number of neighbors
  const neighbors = [
    ...graph.inNeighbors(nodeId),
    ...graph.outNeighbors(nodeId)
  ];
  
  if (neighbors.length > 5) {
    // Already have enough neighbors
    showNotification('Neighbors already loaded');
    return;
  }
  
  // Add 2-3 new nodes as neighbors
  const numNewNeighbors = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numNewNeighbors; i++) {
    const newAddr = 'addr_' + Math.random().toString(36).substring(2, 15);
    
    // Only add if it doesn't already exist
    if (!graph.hasNode(newAddr)) {
      graph.addNode(newAddr, {
        label: newAddr.substring(0, 8) + '...',
        x: graph.getNodeAttribute(nodeId, 'x') + (Math.random() - 0.5) * 0.5,
        y: graph.getNodeAttribute(nodeId, 'y') + (Math.random() - 0.5) * 0.5,
        size: 2 + Math.random() * 6,
        color: '#4CAF50',
        isPoisoned: false,
        balance: Math.random() * 3
      });
      
      // Randomly make this an input or output
      const isInput = Math.random() > 0.5;
      const txid = 'tx_' + Math.random().toString(36).substring(2, 15);
      
      if (isInput) {
        graph.addEdgeWithKey(txid, newAddr, nodeId, {
          size: 1 + Math.random() * 2,
          color: '#888',
          isPoisoned: false,
          amount: Math.random() * 1.5,
          // Fix date calculation
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      } else {
        graph.addEdgeWithKey(txid, nodeId, newAddr, {
          size: 1 + Math.random() * 2,
          color: '#888',
          isPoisoned: false,
          amount: Math.random() * 1.5,
          // Fix date calculation
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
      }
    }
  }
  
  // Apply poison status to new elements
  propagatePoison();
  showNotification('Neighbor nodes loaded');
}

function updateTaggedElementsList() {
  const taggedAddressesList = document.getElementById('tagged-addresses');
  const taggedTransactionsList = document.getElementById('tagged-transactions');
  
  taggedAddressesList.innerHTML = '';
  taggedTransactionsList.innerHTML = '';
  
  taggedAddresses.forEach((tag, address) => {
    const item = document.createElement('div');
    item.className = 'address-item';
    
    const text = document.createElement('span');
    text.textContent = `${tag} (${address.substring(0, 8)}...)`;
    text.title = address;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'X';
    removeBtn.onclick = () => {
      taggedAddresses.delete(address);
      graph.setNodeAttribute(address, 'label', address.substring(0, 8) + '...');
      updateTaggedElementsList();
      sigmaInstance.refresh();
    };
    
    item.appendChild(text);
    item.appendChild(removeBtn);
    taggedAddressesList.appendChild(item);
  });
  
  taggedTransactions.forEach((tag, txid) => {
    const item = document.createElement('div');
    item.className = 'address-item';
    
    const text = document.createElement('span');
    text.textContent = `${tag} (${txid.substring(0, 8)}...)`;
    text.title = txid;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'X';
    removeBtn.onclick = () => {
      taggedTransactions.delete(txid);
      updateTaggedElementsList();
    };
    
    item.appendChild(text);
    item.appendChild(removeBtn);
    taggedTransactionsList.appendChild(item);
  });
}

function resetGraph() {
  // Clear the graph and reset all data structures
  graph.clear();
  
  if (sigmaInstance) {
    sigmaInstance.kill();
    sigmaInstance = null;
  }
  
  // Don't clear addresses or poisoned items as user might want to reuse them
  
  // Reset the node and edge info panels
  document.getElementById('node-info').style.display = 'none';
  document.getElementById('edge-info').style.display = 'none';
  
  // Clear tagged elements
  taggedAddresses.clear();
  taggedTransactions.clear();
  updateTaggedElementsList();
  
  showNotification('Graph reset');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Add address button
  document.getElementById('add-address-btn').addEventListener('click', addAddress);
  
  // Address input field - add on Enter key
  document.getElementById('address-input').addEventListener('keyup', event => {
    if (event.key === 'Enter') {
      addAddress();
    }
  });
  
  // Fetch data button
  document.getElementById('fetch-data-btn').addEventListener('click', fetchTransactionData);
  
  // Add poison button
  document.getElementById('add-poison-btn').addEventListener('click', addPoisoned);
  
  // Poison input field - add on Enter key
  document.getElementById('poison-input').addEventListener('keyup', event => {
    if (event.key === 'Enter') {
      addPoisoned();
    }
  });
  
  // Propagate poison button
  document.getElementById('propagate-poison-btn').addEventListener('click', propagatePoison);
  
  // Reset graph button
  document.getElementById('reset-graph-btn').addEventListener('click', resetGraph);
  
  // Initialize the display
  updateAddressesList();
  updatePoisonedList();
  
  // Example addresses for testing (Bitcoin testnet addresses)
  const testAddresses = [
    'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7'
  ];
  
  // Uncomment to add test addresses by default
  /*
  testAddresses.forEach(addr => {
    addresses.add(addr);
  });
  updateAddressesList();
  */
});
