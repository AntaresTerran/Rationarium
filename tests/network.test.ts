import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NetworkInterfaceInfo } from 'node:os';
import { lanAddresses } from '../src/server/network';

function address(value: string, internal = false, family: 'IPv4' | 'IPv6' = 'IPv4'): NetworkInterfaceInfo {
  const base = { address: value, netmask: '255.255.255.0', mac: '', internal, cidr: null };
  return family === 'IPv6' ? { ...base, family, scopeid: 0 } : { ...base, family };
}

test('tablet URLs use only usable local IPv4 addresses', () => {
  const result = lanAddresses(53117, {
    WiFi: [address('192.168.1.42'), address('fe80::1', false, 'IPv6')],
    Loopback: [address('127.0.0.1', true)],
    Virtual: [address('169.254.10.2'), address('192.168.1.42')],
  });
  assert.deepEqual(result, [{ name: 'WiFi', address: '192.168.1.42', url: 'http://192.168.1.42:53117' }]);
});

test('physical adapters appear before virtual adapters in the widget', () => {
  const result = lanAddresses(53117, {
    vEthernet: [address('172.22.1.1')],
    Ethernet: [address('192.168.1.5')],
  });
  assert.deepEqual(result.map((item) => item.name), ['Ethernet', 'vEthernet']);
});
