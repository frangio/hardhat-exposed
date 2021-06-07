# hardhat-exposed

[![NPM Package](https://img.shields.io/npm/v/hardhat-exposed.svg)](https://www.npmjs.org/package/hardhat-exposed)

A Hardhat plugin to automatically expose internal functions for smart contract testing.

## Installation

```
npm install -D hardhat-exposed
```

Add to `hardhat.config.js`:

```javascript
require('hardhat-exposed');
```

## Usage

The plugin will create "exposed" versions of your contracts that will be prefixed with an `X`, and its internal functions will be exposed as external functions with an `x` prefix.

If you have a contract called `Foo`, with an internal function called `_get`:

```javascript
const Foo = ethers.getContractFactory('XFoo');
// or const Foo = artifacts.require('XFoo');

const foo = Foo.deploy();
await foo.x_get();
```

These exposed contracts will be created in a `contracts-exposed` directory. We strongly suggest adding this directory to `.gitignore`.
