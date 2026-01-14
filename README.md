# PlebTap

**Nostr, Lightning & Ecash in a Single Svelte Component**

Stop reinventing the wheel for every Nostr app. PlebTap gives you a complete authentication and payment solution with both a ready-to-use UI component and a comprehensive programmatic API - drop it in your Svelte app and you're done.

Follow me on [Nostr](https://njump.me/npub1strjxxh7fzhrvgkraew4fpt6ppu973sc3p9cm2mehl0naq22hars007wsf) to see me build this library and other stuff live on stream.
[![NPM Version](https://img.shields.io/npm/v/plebtap)](https://www.npmjs.com/package/plebtap)
[![License](https://img.shields.io/npm/l/plebtap)](https://github.com/cypherflow/plebtap/blob/main/LICENSE)

> **⚠️ EXPERIMENTAL SOFTWARE**: PlebTap is in beta and experimental. Private keys from newly created accounts or nsec imports are currently stored **unencrypted** in browser localStorage. Use at your own risk and never store more sats than you're willing to lose. Only use new keypairs or import your nsec if you understand the security implications.


## 🚀 [Live Demo](https://cypherflow.github.io/plebtap/)  

## Overview

PlebTap is a **drop-in Svelte component** that gives your application:

- 🔐 **Nostr Authentication** - Multiple login methods (NIP-07 extensions, private keys, device linking)
- ⚡ **Lightning Payments** - Send and receive Lightning payments via NIP-60 Cashu wallets
- 💰 **Ecash Tokens** - Generate and receive Cashu ecash tokens
- 🔄 **Multi-mint Support** - Manage multiple Cashu mints with automatic token consolidation
- 📱 **Responsive UI** - Works seamlessly on desktop (popover) and mobile (drawer)
- 🎨 **Customizable** - Built with shadcn-svelte components and Tailwind CSS

## Quick Start

### Installation

```bash
npm install plebtap
# or
pnpm add plebtap
# or
yarn add plebtap
```

### Basic Usage

#### 1. Component API (Simplest)

Just drop the component into your app:

```svelte
<script lang="ts">
  import { plebtap } from 'plebtap';
</script>

<Plebtap />
```

That's it! The button handles everything - login, wallet management, sending/receiving payments.

#### 2. Programmatic API (Advanced)

For more control, use the programmatic API with Svelte 5 runes:

```svelte
<script lang="ts">
  import { Plebtap, plebtap } from 'plebtap';
  
  async function sendPayment() {
    // Generate a Lightning invoice
    const { bolt11 } = await plebtap.createLightningInvoice(1000, 'Coffee');
    
    // Or generate an ecash token
    const { token } = await plebtap.generateEcashToken(100, 'Tip');
    
    // Or publish a Nostr note
    await plebtap.publishTextNote('Hello Nostr!');
  }
</script>

<Plebtap />

{#if plebtap.isLoggedIn}
  <p>Balance: {plebtap.balance} sats</p>
  <p>User: {plebtap.npub}</p>
  <button onclick={sendPayment}>Send Payment</button>
{/if}
```

## Features

### Authentication Methods

PlebTap supports multiple ways for users to authenticate:

- **🔑 Create New Account** - Generates a new Nostr keypair and stores it in the browser's localStorage. **⚠️ Note**: In the current beta version, keys are stored unencrypted. Future versions will implement encrypted storage. Only use new keypairs for testing or if you understand the security risks.
- **📱 Link from Another Device** - Secure QR code + PIN based device linking using NIP-49 encryption
- **🔌 Browser Extension** - NIP-07 compatible extensions (Alby, nos2x, etc.) - most secure option as private keys never leave the extension
- **🗝️ Private Key** - Direct nsec import. **⚠️ Warning**: Keys are stored unencrypted in localStorage. Only import throwaway keys or keys you're comfortable with this security model.

### Lightning Operations

```javascript
// Create an invoice to receive sats
const { bolt11 } = await plebtap.createLightningInvoice(
  1000,  // amount in sats
  'Payment for services'  // description
);

// Pay a Lightning invoice
const result = await plebtap.sendLightningPayment(bolt11);
```

### Ecash Operations

```javascript
// Generate an ecash token to send
const { token, mint } = await plebtap.generateEcashToken(
  500,  // amount in sats
  'Here you go!'  // memo
);

// Receive an ecash token
const result = await plebtap.receiveEcashToken(token);
console.log(`Received ${result.amount} sats`);
```

### Nostr Operations

```javascript
// Publish a text note
const event = await plebtap.publishTextNote('Hello Nostr!');

// Publish any event
const event = await plebtap.publishEvent({
  kind: 1,
  content: 'Custom event',
  tags: [['t', 'plebtap']]
});

// Sign an event without publishing
const signed = await plebtap.signEvent({
  kind: 1,
  content: 'This will be signed but not published'
});

// Subscribe to events
const unsubscribe = plebtap.subscribe(
  { kinds: [1], authors: [userPubkey] },
  (event) => console.log('New event:', event)
);

// Encrypt/decrypt messages (NIP-04)
const encrypted = await plebtap.encrypt('Secret message', recipientPubkey);
const decrypted = await plebtap.decrypt(encrypted, senderPubkey);
```

### User Information

```javascript
// Get user's npub
const npub = plebtap.getUserNpub();

// Get user's hex pubkey
const hex = plebtap.getUserHex();

// Check connection status
const { connected, total } = plebtap.getConnectionStatus();
console.log(`${connected}/${total} relays connected`);
```

## Reactive State

PlebTap provides reactive state using Svelte 5 runes that automatically updates your UI:

```svelte
<script lang="ts">
  import { Plebtap, plebtap } from 'plebtap';
  
  // Use $state and $derived for reactive state
  let userStatus = $derived({
    isLoggedIn: plebtap.isLoggedIn,
    isReady: plebtap.isReady,
    balance: plebtap.balance,
    npub: plebtap.npub
  });
  
  // Or use $effect for side effects
  $effect(() => {
    console.log('Balance changed:', plebtap.balance);
  });
</script>

{#if plebtap.isLoggedIn}
  {#if plebtap.isReady}
    <p>Balance: {plebtap.balance} sats</p>
    <p>NPub: {plebtap.npub}</p>
  {:else}
    <p>Loading wallet...</p>
  {/if}
{:else}
  <p>Please log in</p>
{/if}
```

### Reactive Properties

The `plebtap` API object exposes the following reactive properties:

- `plebtap.isLoggedIn` - `boolean` - User authentication status
- `plebtap.isReady` - `boolean` - Wallet initialization status
- `plebtap.balance` - `number` - Current balance in sats
- `plebtap.npub` - `string | null` - User's npub

These values update automatically and trigger Svelte's reactivity system.

## Component Features

### Built-in Views

The PlebTap button component includes:

- **Login Flow** - Multiple authentication methods with smooth UX
- **Main Wallet** - Balance display, quick send/receive actions
- **Send** - Lightning invoices and ecash tokens with QR codes
- **Receive** - Generate invoices or scan ecash tokens
- **Transaction History** - View all wallet transactions with details
- **Settings** - Manage mints, relays, keys, and device linking
- **QR Scanner** - Built-in camera scanner for payments

### Responsive Design

- **Desktop**: Opens as a popover
- **Mobile**: Opens as a bottom drawer
- Automatically adapts based on screen size

## Advanced Configuration

### Default Mints

By default, PlebTap uses `https://mint.cypherflow.ai`. Users can add additional mints through the settings interface. Mint selection view will be added to the onboarding process soon.

### Relay Configuration

Users can manage their relay list directly from the settings. The component publishes relay lists as NIP-65 events.

### Styling

PlebTap uses Tailwind CSS and shadcn-svelte components. You can customize the appearance by:

1. Using your own Tailwind theme
2. Overriding CSS custom properties
3. Extending the component styles

## NIP Support

PlebTap implements several Nostr Improvement Proposals (NIPs):

- **NIP-01**: Basic protocol
- **NIP-04**: Encrypted Direct Messages
- **NIP-07**: Browser extension signing
- **NIP-49**: Private key encryption for device linking
- **NIP-60**: Cashu wallet events
- **NIP-61**: Nutzaps (ecash zaps), Full support comming soon.
- **NIP-65**: Relay list metadata

## Security Considerations

> **⚠️ IMPORTANT SECURITY INFORMATION**

### Current Beta Limitations

- **Unencrypted Storage**: Private keys from newly created accounts or nsec imports are currently stored **unencrypted** in browser localStorage
- **Production Use**: This beta version is **not recommended for production** use with keys that hold significant value
- **Recommended Usage**: 
  - Use only for testing and development
  - Create new throwaway keypairs specifically for testing
  - Only import nsec keys if you fully understand the risks
  - Never use keys that manage significant funds or identity

### Secure Alternatives

- 🔌 **Browser Extensions** (Recommended): Use NIP-07 compatible extensions like Alby or nos2x - private keys never leave the extension
- 📱 **Device Linking**: Link from another device or app running Plebtap with NIP-49 encrypted QR codes + PIN

### Future Improvements

- Improve wallet and Nostr sync with [Negentropy](https://github.com/hoytech/negentropy)
- Encrypted key storage using browser-native encryption APIs
- Optional password protection for locally stored keys
- Ecash Spending conditions views and userflows (NUT-10, NUT-11, NUT-12, NUT-14)
- Partial multi-path payments (MPP) (NUT-15) 
- HTTP 402 Payment Required (NUT-24)
- Nostr remote signing device integration.

### Other Security Features

- 📱 Device linking uses NIP-49 encryption with random one-time-use PINs
- ⚠️ The component displays appropriate warnings for different security levels
- 🗄️ Users can choose to clear local database on logout

## Browser Support

PlebTap requires a modern browser with support for:

- IndexedDB (for local caching)
- Web Crypto API (for encryption)
- Camera API (for QR scanning, optional)

## Development

### Project Structure

```
plebtap/
├── src/lib/
│   ├── components/
│   │   ├── plebtap/          # Main component
│   │   │   ├── views/          # Different UI views
│   │   │   ├── wallet/         # Wallet-specific components
│   │   │   └── settings/       # Settings components
│   │   └── ui/                 # shadcn-svelte components
│   ├── stores/
│   │   ├── nostr.ts           # Nostr state management
│   │   ├── wallet.ts          # Wallet state management
│   │   └── navigation.ts      # View navigation
│   ├── services/
│   │   ├── init.svelte.ts     # App initialization
│   │   └── logout.ts          # Logout handling
│   └── utils/                  # Utility functions
├── src/routes/                 # Demo application
└── package.json
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/cypherflow/plebtap.git
cd plebtap

# Install dependencies
npm install

# Run the development server
npm run dev

# Run tests
npm test

# Build the library
npm run build
```

## API Reference

### Component

```svelte
<Plebtap />
```

No props required - the component manages all state internally.

### Programmatic API

#### Properties (Reactive)

- `plebtap.isLoggedIn: boolean` - User authentication status
- `plebtap.isReady: boolean` - Wallet initialization status
- `plebtap.balance: number` - Current balance in sats
- `plebtap.npub: string | null` - User's npub

#### Methods

**User Info**
- `getUserNpub(): string | null`
- `getUserHex(): string | null`
- `getConnectionStatus(): { connected: number; total: number }`

**Lightning**
- `createLightningInvoice(amount: number, description?: string): Promise<{ bolt11: string }>`
- `sendLightningPayment(bolt11: string): Promise<{ success: boolean; preimage?: string }>`

**Ecash**
- `generateEcashToken(amount: number, memo?: string): Promise<{ token: string; mint?: string }>`
- `receiveEcashToken(token: string): Promise<{ success: boolean; amount: number }>`

**Nostr**
- `publishTextNote(content: string): Promise<{ id: string; pubkey: string }>`
- `publishEvent(event: Partial<NDKRawEvent>): Promise<{ id: string; pubkey: string }>`
- `signEvent(event: Partial<NDKRawEvent>): Promise<{ id: string; pubkey: string; signature: string }>`
- `subscribe(filter: NDKFilter, callback: Function): () => void`
- `encrypt(content: string, recipientPubkey: string): Promise<string>`
- `decrypt(encryptedContent: string, senderPubkey: string): Promise<string>`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License 

## Links

- 🚀 [Live Demo](https://plebtap.cypherflow.ai)
- [GitHub Repository](https://github.com/cypherflow/plebtap)
- [NPM Package](https://www.npmjs.com/package/plebtap)
- [CypherFlow](https://cypherflow.ai)

## Acknowledgments

Built with:
- [NDK](https://github.com/nostr-dev-kit/ndk) - Nostr Development Kit
- [Cashu](https://cashu.space/) - Ecash protocol
- [Svelte 5](https://svelte.dev/) - UI framework
- [shadcn-svelte](https://www.shadcn-svelte.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com/) - Styling
