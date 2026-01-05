// WiFi Configuration App
let selectedNetwork = null;

// DOM Elements
const scanButton = document.getElementById('scanButton');
const networksList = document.getElementById('networksList');
const passwordSection = document.getElementById('passwordSection');
const passwordInput = document.getElementById('password');
const togglePasswordButton = document.getElementById('togglePassword');
const connectButton = document.getElementById('connectButton');
const messageDiv = document.getElementById('message');
const statusDiv = document.getElementById('status');

// Check current connection status on load
checkConnectionStatus();

// Event Listeners
scanButton.addEventListener('click', scanNetworks);
connectButton.addEventListener('click', connectToNetwork);
togglePasswordButton.addEventListener('click', togglePasswordVisibility);
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && selectedNetwork) {
        connectToNetwork();
    }
});

function togglePasswordVisibility() {
    const type = passwordInput.getAttribute('type');
    if (type === 'password') {
        passwordInput.setAttribute('type', 'text');
        togglePasswordButton.textContent = '🙈';
        togglePasswordButton.title = 'Hide password';
    } else {
        passwordInput.setAttribute('type', 'password');
        togglePasswordButton.textContent = '👁️';
        togglePasswordButton.title = 'Show password';
    }
}

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
        .then(res => {
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            if (data.success) {
                if (data.networks.length === 0) {
                    networksList.innerHTML = '<div class="loading">No networks found. Try scanning again.</div>';
                    showMessage('No networks found nearby', 'info');
                } else {
                    displayNetworks(data.networks);
                    showMessage(`Found ${data.networks.length} network${data.networks.length !== 1 ? 's' : ''}`, 'success');
                }
            } else {
                networksList.innerHTML = '<div class="loading">Scan failed</div>';
                const errorMsg = data.error || 'Unknown error occurred';
                showMessage('Scan failed: ' + errorMsg, 'error');
            }
        })
        .catch(err => {
            networksList.innerHTML = '<div class="loading">Error scanning networks</div>';
            console.error('Scan error:', err);
            showMessage('Failed to scan networks. Check if nmcli is available.', 'error');
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
    
    const password = passwordInput.value.trim();
    const requiresPassword = selectedNetwork.security && 
                           selectedNetwork.security !== 'Open' && 
                           selectedNetwork.security !== '--';
    
    if (requiresPassword && !password) {
        showMessage('Please enter the password', 'error');
        passwordInput.focus();
        return;
    }
    
    // Validate password length for WPA/WPA2
    if (requiresPassword && password.length < 8) {
        showMessage('WiFi password must be at least 8 characters', 'error');
        passwordInput.focus();
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
    .then(res => {
        if (!res.ok) {
            throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            showMessage(`✓ ${data.message}`, 'success');
            if (data.note) {
                setTimeout(() => {
                    showMessage(data.note, 'info');
                }, 2000);
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
            // Parse common error messages
            let errorMsg = data.error || 'Unknown error occurred';
            if (errorMsg.includes('Secrets were required')) {
                errorMsg = 'Incorrect password. Please try again.';
                passwordInput.value = '';
                passwordInput.focus();
            } else if (errorMsg.includes('not found')) {
                errorMsg = 'Network not found. Try scanning again.';
            } else if (errorMsg.includes('timeout')) {
                errorMsg = 'Connection timeout. Network may be out of range.';
            }
            showMessage(`✗ ${errorMsg}`, 'error');
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
        showMessage('Connection failed. Please check the password and try again.', 'error');
    })
    .finally(() => {
        connectButton.disabled = false;
        connectButton.textContent = 'Connect';
    });
}
