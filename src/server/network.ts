import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

export interface LanAddress {
  name: string;
  address: string;
  url: string;
}

export function lanAddresses(
  port: number,
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): LanAddress[] {
  const result: LanAddress[] = [];
  const seen = new Set<string>();
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== 'IPv4' ||
          entry.address.startsWith('169.254.') || seen.has(entry.address)) continue;
      seen.add(entry.address);
      result.push({ name, address: entry.address, url: `http://${entry.address}:${port}` });
    }
  }
  const rank = (name: string): number =>
    /virtual|vethernet|hyper-v|wsl|docker|vmware|vpn|zerotier|tap|tun/i.test(name) ? 2 :
    /ethernet|wi-?fi|wlan|wireless/i.test(name) ? 0 : 1;
  return result.sort((a, b) => rank(a.name) - rank(b.name) ||
    a.name.localeCompare(b.name) || a.address.localeCompare(b.address));
}
