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

The plugin will create "exposed" versions of your contracts that will be prefixed with the symbol `$`, and its internal functions will be exposed as external functions with a `$` prefix as well.

These exposed contracts will be created in a `contracts-exposed` directory. We strongly suggest adding this directory to `.gitignore`.

If you have a contract called `Foo`, with an internal function called `_get`:

```javascript
const Foo = ethers.getContractFactory('$Foo');
// or const Foo = artifacts.require('$Foo');

const foo = Foo.deploy();
await foo.$_get();
```

The plugin will also generate a constructor to initialize your abstract contracts.

For example, in this set of contracts notice that `C` is abstract because it doesn't call `B`'s constructor.

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

In the plugin-generated exposed version of `C`, there will be an additional parameter to initialize `B`.

```solidity
contract $C is C {
    constructor(uint256 b, uint256 c) B(b) C(c) {}
}
```

The order of parameters in this generated constructor will be according to the linearization of the parent contracts, starting with the most base contract and ending with the most derived one. This order can be unintuitive, so in these cases make sure you test the contract was initialized as desired.

Note that if a contract is abstract because it's missing an implementation for a virtual function, the exposed contract will remain abstract too.

### Storage Pointers

Some internal functions may contain storage pointers in arguments or return values.

Return values are converted to memory pointers (as long as they're not mappings, in this case it's not possible to expose the function), so a struct for example is copied to return data and readable from the tests.

Arguments that are storage pointers are replaced with an integer that is used as an index into a storage array. This allows to test function calls that act on storage such as data structures.

## Configuration

Include an `exposed` field in your Hardhat config.

```
exposed: {
  include?: string[] = ['**/*'],
  exclude?: string[] = [],
  outDir?: string = 'contracts-exposed',
  prefix?: string = '$',
},
```
