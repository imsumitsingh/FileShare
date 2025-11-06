const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bonjourFactory = require('bonjour');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5050;

app.use(cors());
app.use(express.json());

// Resolve default downloads folder
function getDownloadsFolder() {
	const home = os.homedir();
	const downloads = path.join(home, 'Downloads');
	try {
		if (!fs.existsSync(downloads)) {
			fs.mkdirSync(downloads, { recursive: true });
		}
	} catch (err) {
		console.error('Failed to ensure Downloads folder exists:', err);
	}
	return downloads;
}

const DOWNLOADS_DIR = getDownloadsFolder();

// Multer storage to Downloads
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, DOWNLOADS_DIR);
	},
	filename: function (req, file, cb) {
		// Preserve original filename
		cb(null, file.originalname);
	}
});

const upload = multer({ storage });

// Static files (UI)
app.use(express.static(path.join(__dirname, 'public')));

// In-memory peer list discovered via mDNS
const discoveredPeersById = new Map();

// Helper: get local hostname for display
function getLocalDisplayName() {
	const hostname = os.hostname();
	return hostname;
}

// mDNS advertise and browse
const bonjour = bonjourFactory();
let bonjourService;

function startBonjour(port) {
	const name = `${getLocalDisplayName()} - FileShare`;
	bonjourService = bonjour.publish({
		name,
		type: 'fileshare',
		protocol: 'tcp',
		port,
		txt: {
			device: getLocalDisplayName()
		}
	});

	// Browse peers
	const browser = bonjour.find({ type: 'fileshare', protocol: 'tcp' });
	browser.on('up', (service) => {
		const id = `${service.name}|${service.host}|${service.port}`;
		discoveredPeersById.set(id, {
			id,
			name: service.name,
			host: service.referer && service.referer.address ? service.referer.address : (service.host || ''),
			port: service.port,
			addresses: service.addresses || [],
			txt: service.txt || {}
		});
	});
	browser.on('down', (service) => {
		// remove entries matching host+port
		for (const [key, val] of discoveredPeersById.entries()) {
			if (val.port === service.port && (val.host === service.host || val.addresses.some(a => (service.addresses || []).includes(a)))) {
				discoveredPeersById.delete(key);
			}
		}
	});

	// Start browsing
	browser.start();
}

// API: list peers
app.get('/api/peers', (req, res) => {
	// Filter out ourselves by matching any address/port
	const peers = Array.from(discoveredPeersById.values()).filter(p => {
		// Heuristic: If any address is local addresses of this machine and port matches, skip
		return !(p.port === PORT && (p.name || '').includes(getLocalDisplayName()));
	});
	res.json({ peers });
});

// API: upload to this device
app.post('/upload', upload.single('file'), (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'No file provided' });
		}
		return res.json({ success: true, path: path.join(DOWNLOADS_DIR, req.file.originalname) });
	} catch (err) {
		console.error('Upload error:', err);
		return res.status(500).json({ success: false, message: 'Upload failed' });
	}
});

// Health
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok' });
});

// Fallback to index.html
app.use((req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
	console.log(`FileShare server listening on http://localhost:${PORT}`);
	startBonjour(PORT);
});

process.on('SIGINT', () => {
	try { bonjourService && bonjourService.stop(); } catch (_) {}
	try { bonjour && bonjour.destroy(); } catch (_) {}
	server.close(() => process.exit(0));
});


