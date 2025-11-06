(function() {
	const statusEl = document.getElementById('status');
	const deviceListEl = document.getElementById('deviceList');
	const targetSelectEl = document.getElementById('targetSelect');
	const sendFormEl = document.getElementById('sendForm');
	const fileInputEl = document.getElementById('fileInput');

	let peers = [];

	function setStatus(text, type = 'info') {
		statusEl.textContent = text;
		statusEl.style.color = type === 'error' ? '#ef9a9a' : '#9aa4c7';
	}

	function renderPeers() {
		deviceListEl.innerHTML = '';
		targetSelectEl.innerHTML = '<option value="" disabled selected>Select a device</option>';
		if (!peers.length) {
			const div = document.createElement('div');
			div.className = 'empty';
			div.textContent = 'No devices found yet. Ensure FileShare is running on other devices on this network.';
			deviceListEl.appendChild(div);
			return;
		}

		peers.forEach(p => {
			const device = document.createElement('div');
			device.className = 'device';
			const left = document.createElement('div');
			left.innerHTML = `<div class="name">${escapeHtml(p.name)}</div><div class="meta">${escapeHtml(hostLabel(p))}</div>`;
			device.appendChild(left);
			deviceListEl.appendChild(device);

			const opt = document.createElement('option');
			opt.value = JSON.stringify(p);
			opt.textContent = `${p.name} (${hostLabel(p)})`;
			targetSelectEl.appendChild(opt);
		});
	}

	function hostLabel(p) {
		const addr = (p.addresses && p.addresses.find(a => a && a.indexOf(':') === -1)) || p.host || 'unknown';
		return `${addr}:${p.port}`;
	}

	function escapeHtml(s) {
		return String(s)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	async function fetchPeers() {
		try {
			const res = await fetch('/api/peers');
			const data = await res.json();
			peers = data.peers || [];
			renderPeers();
			setStatus('Ready');
		} catch (e) {
			setStatus('Unable to fetch peers', 'error');
		}
	}

	sendFormEl.addEventListener('submit', async (e) => {
		e.preventDefault();
		const selected = targetSelectEl.value ? JSON.parse(targetSelectEl.value) : null;
		const file = fileInputEl.files && fileInputEl.files[0];
		if (!selected || !file) return;

		const addr = (selected.addresses && selected.addresses.find(a => a && a.indexOf(':') === -1)) || selected.host;
		if (!addr) {
			setStatus('Selected device has no reachable address', 'error');
			return;
		}

		const targetUrl = `http://${addr}:${selected.port}/upload`;
		const fd = new FormData();
		fd.append('file', file);
		setStatus('Sending file...');
		try {
			const res = await fetch(targetUrl, { method: 'POST', body: fd });
			if (!res.ok) throw new Error('Upload failed');
			const json = await res.json();
			if (json && json.success) {
				setStatus('File sent successfully');
			} else {
				setStatus('Remote device rejected the file', 'error');
			}
		} catch (err) {
			setStatus('Failed to send file', 'error');
		}
	});

	// Poll peers every 3s
	fetchPeers();
	setInterval(fetchPeers, 3000);
})();


