# FileShare

Peer-to-peer style file sharing over local network using Node.js, Express, and mDNS.

## Run

```bash
npm start
```

Open `http://localhost:5050` in your browser. Keep the tab open to receive files.

To see peers, run this app on another device connected to the same Wi‑Fi/LAN.

## Features
- Discovers devices via mDNS (`_fileshare._tcp`)
- Upload endpoint saves files to your system Downloads folder
- Professional single-page UI to list devices and send files

## Notes
- Some networks block mDNS/Multicast. Ensure both devices are on the same subnet and mDNS allowed.
- On Windows, you may need to allow Node.js through the firewall on first run.

