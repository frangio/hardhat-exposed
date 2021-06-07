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

Note: After setting up for the first time, you may need to recompile with `hardhat compile --force` once.

## Usage

The plugin will create "exposed" versions of your contracts that will be prefixed with an `X`, and its internal functions will be exposed as external functions with an `x` prefix.

These exposed contracts will be created in a `contracts-exposed` directory. We strongly suggest adding this directory to `.gitignore`.

If you have a contract called `Foo`, with an internal function called `_get`:

```javascript
const Foo = ethers.getContractFactory('XFoo');
// or const Foo = artifacts.require('XFoo');

const foo = Foo.deploy();
await foo.x_get();
```

The plugin will also generate a constructor to initialize your abstract contracts.

For example, with this set of contracts:

```solidity
contract A {
    constructor(uint a) {}
}
contract B {
    constructor(uint b) {}
}
contract C is A, B {
    constructor(uint c) A(0) {}
}
```

The plugin generates the following exposed version of `C`. Notice how a parameter for `B` was added.

```solidity
contract XC is C {
    constructor(uint256 c, uint256 b) C(c) B(b) {}
}
```

Note that if a contract is abstract because it's missing an implementation for a virtual function, the exposed contract will remain abstract too.
