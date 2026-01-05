// WiFi Configuration App
let selectedNetwork = null;

// DOM Elements
const scanButton = document.getElementById('scanButton');
const networksList = document.getElementById('networksList');
const passwordSection = document.getElementById('passwordSection');
const passwordInput = document.getElementById('password');
const connectButton = document.getElementById('connectButton');
const messageDiv = document.getElementById('message');
const statusDiv = document.getElementById('status');

// Check current connection status on load
checkConnectionStatus();

// Event Listeners
scanButton.addEventListener('click', scanNetworks);
connectButton.addEventListener('click', connectToNetwork);

function showMessage(text, type = 'info') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

function checkConnectionStatus() {
    fetch('/api/wifi/status')
        .then(res => res.json())
        .then(data => {
            if (data.connected && data.ssid) {
                statusDiv.textContent = `✓ Currently connected to: ${data.ssid}`;
                statusDiv.style.display = 'block';
            }
        })
        .catch(err => {
            console.error('Failed to check status:', err);
        });
}

function scanNetworks() {
    scanButton.disabled = true;
    scanButton.textContent = '⏳ Scanning...';
    networksList.innerHTML = '<div class="loading">Scanning for WiFi networks...</div>';
    passwordSection.style.display = 'none';
    connectButton.style.display = 'none';
    selectedNetwork = null;
    
    fetch('/api/wifi/scan')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                displayNetworks(data.networks);
                showMessage(`Found ${data.networks.length} networks`, 'success');
            } else {
                networksList.innerHTML = '<div class="loading">No networks found</div>';
                showMessage(data.error || 'Scan failed', 'error');
            }
        })
        .catch(err => {
            networksList.innerHTML = '<div class="loading">Error scanning networks</div>';
            showMessage('Failed to scan: ' + err.message, 'error');
        })
        .finally(() => {
            scanButton.disabled = false;
            scanButton.textContent = '🔍 Scan for Networks';
        });
}

function displayNetworks(networks) {
    if (networks.length === 0) {
        networksList.innerHTML = '<div class="loading">No networks found</div>';
        return;
    }
    
    networksList.innerHTML = '';
    
    networks.forEach(network => {
        const networkItem = document.createElement('div');
        networkItem.className = 'network-item';
        
        const leftSide = document.createElement('div');
        const networkName = document.createElement('div');
        networkName.className = 'network-name';
        networkName.textContent = network.ssid;
        leftSide.appendChild(networkName);
        
        const rightSide = document.createElement('div');
        rightSide.className = 'network-info';
        
        // Signal strength indicator
        const signalDiv = document.createElement('div');
        signalDiv.className = 'signal-strength';
        const bars = 4;
        const activeBars = Math.ceil((network.signal / 100) * bars);
        for (let i = 0; i < bars; i++) {
            const bar = document.createElement('div');
            bar.className = 'signal-bar';
            bar.style.height = `${(i + 1) * 4}px`;
            if (i < activeBars) {
                bar.classList.add('active');
            }
            signalDiv.appendChild(bar);
        }
        rightSide.appendChild(signalDiv);
        
        // Security badge
        if (network.security && network.security !== 'Open') {
            const securityBadge = document.createElement('div');
            securityBadge.className = 'security-badge';
            securityBadge.textContent = '🔒';
            rightSide.appendChild(securityBadge);
        }
        
        networkItem.appendChild(leftSide);
        networkItem.appendChild(rightSide);
        
        networkItem.addEventListener('click', () => selectNetwork(network, networkItem));
        
        networksList.appendChild(networkItem);
    });
}

function selectNetwork(network, element) {
    // Remove previous selection
    document.querySelectorAll('.network-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Select this network
    element.classList.add('selected');
    selectedNetwork = network;
    
    // Show password input if network is secured
    if (network.security && network.security !== 'Open' && network.security !== '--') {
        passwordSection.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    } else {
        passwordSection.style.display = 'none';
        passwordInput.value = '';
    }
    
    connectButton.style.display = 'block';
    messageDiv.style.display = 'none';
}

function connectToNetwork() {
    if (!selectedNetwork) {
        showMessage('Please select a network first', 'error');
        return;
    }
    
    const password = passwordInput.value;
    const requiresPassword = selectedNetwork.security && 
                           selectedNetwork.security !== 'Open' && 
                           selectedNetwork.security !== '--';
    
    if (requiresPassword && !password) {
        showMessage('Please enter the password', 'error');
        return;
    }
    
    connectButton.disabled = true;
    connectButton.textContent = '⏳ Connecting...';
    showMessage(`Connecting to ${selectedNetwork.ssid}...`, 'info');
    
    fetch('/api/wifi/connect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ssid: selectedNetwork.ssid,
            password: password
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showMessage(`✓ ${data.message}`, 'success');
            if (data.note) {
                showMessage(`${data.message}\n\n${data.note}`, 'success');
            }
            // Refresh status
            setTimeout(checkConnectionStatus, 2000);
            // Clear selection
            selectedNetwork = null;
            passwordInput.value = '';
            passwordSection.style.display = 'none';
            document.querySelectorAll('.network-item').forEach(item => {
                item.classList.remove('selected');
            });
        } else {
            showMessage(`✗ ${data.error}`, 'error');
        }
    })
    .catch(err => {
        showMessage('Connection failed: ' + err.message, 'error');
    })
    .finally(() => {
        connectButton.disabled = false;
        connectButton.textContent = 'Connect';
    });
}
