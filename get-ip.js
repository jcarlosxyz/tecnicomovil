/**
 * Robust utility script to find the computer's current physical local IP address.
 * Filters out virtual network adapters (VirtualBox, VMware, WSL, Hyper-V, Docker).
 * 
 * Usage:
 *   node get-ip.js
 */

const os = require('os');

const interfaces = os.networkInterfaces();
const ipv4Addresses = [];

// Filter list for virtual interface names and IP ranges
const virtualKeywords = [
  'virtual', 'vbox', 'virtualbox', 'vmware', 'host-only', 
  'vethernet', 'loopback', 'software', 'teredo', 'wsl', 'hyper-v'
];

const virtualSubnets = [
  '192.168.56.',  // VirtualBox Host-Only
  '192.168.99.',  // Docker Machine
  '192.168.232.', // VMware
  '192.168.174.', // VMware
  '169.254.'      // Link-local (no internet/DHCP failed)
];

for (const name of Object.keys(interfaces)) {
  const isVirtualInterface = virtualKeywords.some(keyword => 
    name.toLowerCase().includes(keyword)
  );

  for (const net of interfaces[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      const isVirtualIP = virtualSubnets.some(subnet => 
        net.address.startsWith(subnet)
      );

      ipv4Addresses.push({
        interface: name,
        ip: net.address,
        isVirtual: isVirtualInterface || isVirtualIP
      });
    }
  }
}

console.log('\n======================================================');
console.log('            CMMS Local Network IP Finder              ');
console.log('======================================================\n');

// Separate physical and virtual IP addresses
const physicalIPs = ipv4Addresses.filter(item => !item.isVirtual);
const virtualIPs = ipv4Addresses.filter(item => item.isVirtual);

if (physicalIPs.length === 0 && virtualIPs.length === 0) {
  console.log('❌ No active local IPv4 interfaces found.');
  console.log('Please ensure your computer is connected to a local Wi-Fi or Ethernet network.');
  process.exit(1);
}

if (physicalIPs.length > 0) {
  console.log('✨ Found the following PHYSICAL local IP addresses:');
  physicalIPs.forEach((item, index) => {
    console.log(`  [${index + 1}] Interface: "${item.interface}" => IP: ${item.ip}`);
  });
}

if (virtualIPs.length > 0) {
  console.log('\n⚠️ Found the following VIRTUAL/HOST-ONLY IP addresses (Avoid these):');
  virtualIPs.forEach((item, index) => {
    console.log(`  [-] Interface: "${item.interface}" => IP: ${item.ip}`);
  });
}

console.log('\n------------------------------------------------------');

if (physicalIPs.length > 0) {
  // Recommend the physical IPs
  const primaryIP = physicalIPs[0].ip;
  console.log(`💡 Recommended IP to use: ${primaryIP}`);
  
  if (physicalIPs.length > 1) {
    console.log(`\nNote: You have multiple physical adapters active.`);
    console.log(`If your phone is on Wi-Fi, try:`);
    physicalIPs.forEach(item => {
      console.log(`   EXPO_PUBLIC_API_URL=http://${item.ip}:3000/api`);
    });
  } else {
    console.log(`\nTo update your mobile app configuration, open:`);
    console.log(`   AppTecnicos/.env`);
    console.log(`\nAnd change the line starting with EXPO_PUBLIC_API_URL to:`);
    console.log(`   EXPO_PUBLIC_API_URL=http://${primaryIP}:3000/api`);
  }
} else {
  console.log('⚠️ Only virtual network interfaces were found. External physical phones won\'t be able to connect.');
  console.log(`If testing on an emulator on the same PC, you can use: http://${virtualIPs[0].ip}:3000/api`);
}

console.log('\n======================================================\n');
