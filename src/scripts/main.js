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
  const addressesText = addressInput.value.trim();
  if (!addressesText) return;
  
  const lines = addressesText.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      let address, label;
      if (line.includes(':')) {
        [address, label] = line.split(':', 2).map(part => part.trim());
      } else {
        address = line.trim();
        label = address;
      }
      if (address) {
        addresses.add(address);
        if (label) {
          taggedAddresses.set(address, label);
        }
      }
    }
  });
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
    // Show full address
    addressText.textContent = address + (taggedAddresses.has(address) ? ` (${taggedAddresses.get(address)})` : '');
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

function processTransactions(transactions) {
  transactions.forEach(tx => {
    // Process inputs
    tx.vin.forEach(input => {
      if (input.prevout && input.prevout.scriptpubkey_address) {
        const inputAddress = input.prevout.scriptpubkey_address;
        // Add input address if it doesn't exist
        if (!graph.hasNode(inputAddress)) {
          graph.addNode(inputAddress, {
            label: taggedAddresses.has(inputAddress) ? taggedAddresses.get(inputAddress) : inputAddress,
            x: Math.random(),
            y: Math.random(),
            size: 6 + input.prevout.value / 100000000, // Size based on BTC value, made 2x bigger
            color: '#4CAF50',
            isPoisoned: false,
            balance: input.prevout.value / 100000000,
            shape: 'square' // Square shape for input addresses
          });
        } else if (!graph.getNodeAttribute(inputAddress, 'shape')) {
          // If node exists but shape not set, set it now
          graph.setNodeAttribute(inputAddress, 'shape', 'square');
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
            label: taggedAddresses.has(outputAddress) ? taggedAddresses.get(outputAddress) : outputAddress,
            x: Math.random(),
            y: Math.random(),
            size: 6 + output.value / 100000000, // Size based on BTC value, made 2x bigger
            color: '#4CAF50',
            isPoisoned: false,
            balance: output.value / 100000000,
            shape: 'circle' // Circle shape for output addresses (default)
          });
        }
      }
    });
    
    // Create edges for each input-output pair
    tx.vin.forEach(input => {
      if (input.prevout && input.prevout.scriptpubkey_address) {
        const inputAddress = input.prevout.scriptpubkey_address;
        tx.vout.forEach(output => {
          if (output.scriptpubkey_address) {
            const outputAddress = output.scriptpubkey_address;
            const edgeId = `${tx.txid}_${inputAddress}_${outputAddress}`;
            if (!graph.hasEdge(edgeId) && graph.hasNode(inputAddress) && graph.hasNode(outputAddress)) {
              const sats = Math.round(output.value);
              graph.addEdgeWithKey(edgeId, inputAddress, outputAddress, {
                size: 2 + output.value / 50000000,
                color: '#888',
                isPoisoned: false,
                amount: output.value / 100000000,
                sats: sats,
                date: new Date(tx.status.block_time * 1000).toISOString().split('T')[0],
                label: `${sats.toLocaleString()} sats`, // Format with commas
                txid: tx.txid
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

function addPoisoned() {
  const poisonInput = document.getElementById('poison-input');
  const poisonedText = poisonInput.value.trim();
  if (!poisonedText) return;
  
  const lines = poisonedText.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      let txid, label;
      if (line.includes(':')) {
        [txid, label] = line.split(':', 2).map(part => part.trim());
      } else {
        txid = line.trim();
        label = txid;
      }
      if (txid) {
        poisonedTransactions.add(txid);
        if (label && label !== txid) {
          taggedTransactions.set(txid, label);
        }
      }
    }
  });
  
  // If any poisoned transaction exists in the graph, propagate poison
  if ([...poisonedTransactions].some(txid => graph.hasEdge(txid))) {
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
  
  // Mark initial poisoned transactions
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
      // Propagate from poisoned transactions to output addresses
      graph.forEachEdge((edge, attributes, source, target) => {
        if (attributes.isPoisoned) {
          if (!graph.getNodeAttribute(target, 'isPoisoned')) {
            graph.setNodeAttribute(target, 'isPoisoned', true);
            graph.setNodeAttribute(target, 'color', '#f44336');
            changed = true;
          }
          
          // Propagate from poisoned addresses to outgoing transactions
          graph.forEachOutEdge(target, (outEdge, outAttr) => {
            if (!graph.getEdgeAttribute(outEdge, 'isPoisoned')) {
              graph.setEdgeAttribute(outEdge, 'isPoisoned', true);
              graph.setEdgeAttribute(outEdge, 'color', '#f44336');
              changed = true;
            }
          });
        }
      });
    }
    
    // Backward propagation (from outputs to inputs)
    if (direction === 'backward' || direction === 'both') {
      // Propagate from poisoned transactions to input addresses
      graph.forEachEdge((edge, attributes, source, target) => {
        if (attributes.isPoisoned) {
          if (!graph.getNodeAttribute(source, 'isPoisoned')) {
            graph.setNodeAttribute(source, 'isPoisoned', true);
            graph.setNodeAttribute(source, 'color', '#f44336');
            changed = true;
          }
          
          // Propagate from poisoned addresses to incoming transactions
          graph.forEachInEdge(source, (inEdge, inAttr) => {
            if (!graph.getEdgeAttribute(inEdge, 'isPoisoned')) {
              graph.setEdgeAttribute(inEdge, 'isPoisoned', true);
              graph.setEdgeAttribute(inEdge, 'color', '#f44336');
              changed = true;
            }
          });
        }
      });
    }
  }
  
  // Refresh the rendering
  if (sigmaInstance) {
    sigmaInstance.refresh();
  }
}

function updatePoisonedList() {
  const poisonedList = document.getElementById('poisoned-list');
  poisonedList.innerHTML = '';
  
  poisonedTransactions.forEach(txid => {
    const item = document.createElement('div');
    item.className = 'poisoned-item';
    const txText = document.createElement('span');
    // Show full transaction ID
    txText.textContent = 'Tx: ' + txid + (taggedTransactions.has(txid) ? ` (${taggedTransactions.get(txid)})` : '');
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

function renderGraph() {
  // Initialize sigma
  const container = document.getElementById('graph');
  if (sigmaInstance) {
    sigmaInstance.kill();
  }

  const settings = graphologyLibrary.layoutForceAtlas2.inferSettings(graph);
  graphologyLibrary.layoutForceAtlas2.assign(graph, {
    iterations: 50,
    settings: settings
  });
  
  // Improved settings for better visualization
  sigmaInstance = new Sigma(graph, container, {
    renderEdgeLabels: true,
    defaultEdgeType: 'arrow',
    labelDensity: 0.07,
    labelGridCellSize: 60,
    labelRenderedSizeThreshold: 6,
    minCameraRatio: 0.1,
    maxCameraRatio: 10,
    // Improved defaults for node and edge rendering
    defaultNodeColor: '#4CAF50',
    defaultEdgeColor: '#888',
    defaultNodeSize: 8, // Increased from 5 to 8 for better visibility
    defaultEdgeSize: 2,
    // Enable edge hovering
    enableEdgeHovering: true,
    edgeHoverPrecision: 5,
    // Adjust node and edge sizes for better visibility
    nodeReducer: (node, data) => {
      const size = Math.max(5, Math.min(20, data.size * 1.5));
      const shape = data.shape || 'circle';
      
      // Only show labels for input nodes (square shape) or tagged nodes
      if (shape !== 'square' && !taggedAddresses.has(node)) {
        return {
          ...data,
          size,
          label: '' // Remove label for non-input nodes that aren't tagged
        };
      }
      
      return {
        ...data,
        size
      };
    },
    edgeReducer: (edge, data) => {
      // Ensure edge sizes are not too small or too large
      const size = Math.max(1, Math.min(5, data.size));
      
      // Format the sats with commas if available
      if (data.sats) {
        data.label = `${data.sats.toLocaleString()} sats`;
      }
      
      return {
        ...data,
        size
      };
    },
  });

  // Add a button to start/stop the layout
  const layoutControlBtn = document.createElement('button');
  layoutControlBtn.textContent = 'Stop Layout';
  layoutControlBtn.style.position = 'absolute';
  layoutControlBtn.style.top = '10px';
  layoutControlBtn.style.right = '10px';
  layoutControlBtn.style.zIndex = '1000';
  container.appendChild(layoutControlBtn);
  
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
  
  // Add hover interactions for better UX
  sigmaInstance.on('enterNode', ({ node }) => {
    highlightConnections(node);
  });
  
  sigmaInstance.on('leaveNode', () => {
    resetHighlighting();
  });
  
  sigmaInstance.on('enterEdge', ({ edge }) => {
    highlightTransaction(edge);
  });
  
  sigmaInstance.on('leaveEdge', () => {
    resetHighlighting();
  });
  
  // Update the tagged elements section
  updateTaggedElementsList();
}

function showEdgeInfo(edgeId) {
  const edgeInfo = document.getElementById('edge-info');
  const edgeDetails = document.getElementById('edge-details');
  if (graph.hasEdge(edgeId)) {
    const attributes = graph.getEdgeAttributes(edgeId);
    const [source, target] = graph.extremities(edgeId);
    
    // Format sats with commas
    const formattedSats = attributes.sats ? attributes.sats.toLocaleString() : 'N/A';
    
    edgeDetails.innerHTML = `
      <p><strong>Transaction ID:</strong> ${attributes.txid || edgeId}</p>
      <p><strong>From:</strong> ${source}</p>
      <p><strong>To:</strong> ${target}</p>
      <p><strong>Amount:</strong> ${attributes.amount ? attributes.amount.toFixed(8) : 'N/A'} BTC</p>
      <p><strong>Amount in Satoshis:</strong> ${formattedSats}</p>
      <p><strong>Date:</strong> ${attributes.date || 'N/A'}</p>
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
        taggedTransactions.set(attributes.txid || edgeId, tag);
        updateTaggedElementsList();
        tagInput.value = '';
      }
    });
    edgeInfo.style.display = 'block';
  }
}

// Add highlighting functions for better UX
function highlightConnections(nodeId) {
  if (!sigmaInstance || !graph) return;
  
  graph.setNodeAttribute(nodeId, 'highlighted', true);
  
  // Highlight edges connected to this node
  graph.forEachEdge((edge, attributes, source, target) => {
    if (source === nodeId || target === nodeId) {
      graph.setEdgeAttribute(edge, 'highlighted', true);
    }
  });
  
  sigmaInstance.refresh();
}

function highlightTransaction(edgeId) {
  if (!sigmaInstance || !graph) return;
  
  graph.setEdgeAttribute(edgeId, 'highlighted', true);
  
  // Highlight nodes connected to this edge
  const [source, target] = graph.extremities(edgeId);
  graph.setNodeAttribute(source, 'highlighted', true);
  graph.setNodeAttribute(target, 'highlighted', true);
  
  sigmaInstance.refresh();
}

function resetHighlighting() {
  if (!sigmaInstance || !graph) return;
  
  // Reset all node and edge highlights
  graph.forEachNode((node) => {
    graph.setNodeAttribute(node, 'highlighted', false);
  });
  
  graph.forEachEdge((edge) => {
    graph.setEdgeAttribute(edge, 'highlighted', false);
  });
  
  sigmaInstance.refresh();
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

// Set default number of neighbors to fetch
const DEFAULT_NEIGHBORS = 2;

async function fetchNeighborNodes(nodeId) {
  showNotification('Fetching neighbor nodes...');
  
  try {
    // Get the address for the node
    const address = nodeId;
    
    // Fetch transaction history using the REST API
    const response = await fetch(`https://mempool.sgn.space/api/address/${address}/txs`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const transactions = await response.json();
    console.log(`Fetched ${transactions.length} transactions for ${address}`);
    
    // Find unique neighboring addresses (both inputs and outputs)
    const neighbors = new Set();
    
    transactions.forEach(tx => {
      // Find input addresses (other than the current one)
      tx.vin.forEach(input => {
        if (input.prevout && input.prevout.scriptpubkey_address && input.prevout.scriptpubkey_address !== address) {
          neighbors.add(input.prevout.scriptpubkey_address);
        }
      });
      
      // Find output addresses (other than the current one)
      tx.vout.forEach(output => {
        if (output.scriptpubkey_address && output.scriptpubkey_address !== address) {
          neighbors.add(output.scriptpubkey_address);
        }
      });
    });
    
    console.log(`Found ${neighbors.size} unique neighboring addresses`);
    
    // Select the DEFAULT_NEIGHBORS closest neighbors
    const neighborArray = Array.from(neighbors);
    const selectedNeighbors = neighborArray.slice(0, DEFAULT_NEIGHBORS);
    
    // Process all transactions involving the selected neighbors
    // Instead of filtering, we'll include all transactions
    processTransactions(transactions);
    
    showNotification(`Added ${selectedNeighbors.length} neighbor nodes and their transactions`);
  } catch (error) {
    console.error('Error fetching neighbor nodes:', error);
    showNotification('Failed to fetch neighbor nodes');
    
    // Fallback to simulated neighbors if the API call fails
    simulateNeighborNodes(nodeId, DEFAULT_NEIGHBORS);
  }
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

function updateInputFields() {
  // Update HTML for address input
  const addressInputGroup = document.querySelector('.input-group:first-of-type');
  addressInputGroup.innerHTML = `
    <label for="address-input">Bitcoin Addresses (one per line, format: address: label):</label>
    <textarea id="address-input" rows="6" style="width: 100%; min-height: 100px;" placeholder="Enter Bitcoin addresses, one per line
Format: address: label (label is optional)"></textarea>
    <button id="add-address-btn">Add Addresses</button>
    <div id="addresses-list"></div>
  `;

  // Update HTML for poisoned transactions input
  const poisonInputGroup = document.querySelector('.input-group:nth-of-type(3)');
  poisonInputGroup.innerHTML = `
    <label>Mark as Poisoned Transactions (one per line, format: txid: label):</label>
    <textarea id="poison-input" rows="6" style="width: 100%; min-height: 100px;" placeholder="Enter transaction IDs, one per line
Format: txid: label (label is optional)"></textarea>
    <button id="add-poison-btn">Add Poisoned Transactions</button>
    <div id="poisoned-list"></div>
  `;
}

function updateAddressItemsStyle() {
  const addressItems = document.querySelectorAll('.address-item span');
  addressItems.forEach(item => {
    const address = item.title;
    if (graph.hasNode(address)) {
      const type = graph.getNodeAttribute(address, 'type');
      if (type === 'input') {
        item.classList.add('input-address');
        item.classList.remove('output-address');
      } else if (type === 'output') {
        item.classList.add('output-address');
        item.classList.remove('input-address');
      }
    }
  });
}

function simulateNeighborNodes(nodeId, count) {
  // Add 'count' new nodes as neighbors
  for (let i = 0; i < count; i++) {
    const newAddr = Math.random().toString(36).substring(2, 15);
    // Only add if it doesn't already exist
    if (!graph.hasNode(newAddr)) {
      const isInput = Math.random() > 0.5;
      
      graph.addNode(newAddr, {
        label: newAddr,  // Full address as label
        x: graph.getNodeAttribute(nodeId, 'x') + (Math.random() - 0.5) * 0.5,
        y: graph.getNodeAttribute(nodeId, 'y') + (Math.random() - 0.5) * 0.5,
        size: 4 + Math.random() * 6, // 2x bigger
        color: '#4CAF50',
        isPoisoned: false,
        balance: Math.random() * 3,
        shape: isInput ? 'square' : 'circle'
      });
      
      const txid = Math.random().toString(36).substring(2, 15);
      const sats = Math.round(Math.random() * 10000000);
      
      if (isInput) {
        graph.addEdgeWithKey(txid, newAddr, nodeId, {
          size: 2 + Math.random() * 2, // 2x bigger
          color: '#888',
          isPoisoned: false,
          amount: sats / 100000000,
          sats: sats,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          txid: txid,
          label: `${sats} sats` // Show sats on edge
        });
      } else {
        graph.addEdgeWithKey(txid, nodeId, newAddr, {
          size: 2 + Math.random() * 2, // 2x bigger
          color: '#888',
          isPoisoned: false,
          amount: sats / 100000000,
          sats: sats,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          txid: txid,
          label: `${sats} sats` // Show sats on edge
        });
      }
    }
  }
  // Apply poison status to new elements
  propagatePoison();
  sigmaInstance.refresh();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-address-btn').addEventListener('click', addAddress);
  document.getElementById('fetch-data-btn').addEventListener('click', fetchTransactionData);
  document.getElementById('add-poison-btn').addEventListener('click', addPoisoned);
  document.getElementById('propagate-poison-btn').addEventListener('click', propagatePoison);
  document.getElementById('reset-graph-btn').addEventListener('click', resetGraph);
  
  // Update tagged elements list
  updateTaggedElementsList();
  
  // Set propagation direction to 'both' by default
  const propagationDirectionSelect = document.getElementById('propagation-direction');
  if (propagationDirectionSelect) {
    propagationDirectionSelect.value = 'both';
  }
});
