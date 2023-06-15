# Changelog

## 0.3.8

- Support custom `paths.root` in Hardhat config.

## 0.3.7

- Use a constant variable for the bytecode marker.

## 0.3.6

- Emit a payable constructor always.

## 0.3.5

- Emit a payable constructor if the contract requires it.

## 0.3.4

- Extend Hardhat's `clean` task to delete the directory of exposed contracts.

## 0.3.3

- Add optional support for OpenZeppelin Contracts-style initializers in upgradeable contracts.

## 0.3.2

- Fixed support for constructor arguments in inheritance list (`contract A is B(...)`).

## 0.3.1

- Added support for user defined value types.

## 0.3.0

- Changed events for return values:
  - Renamed from `$<function>_Returned` to `return$<function>`.
  - Renamed parameters from `arg0` and so on to `ret0` or the function's declared return value name if available.

## 0.2.17

- Remove unnecessary dependency.

## 0.2.16

- Minor refactor to internal structures.

## 0.2.15

- Make output directory configurable with `outDir`.

## 0.2.14

- Remove exposed functions for private variables.

## 0.2.13

- Detect and avoid exposing structs that contain mappings.

## 0.2.12

- Partially fix missing imports from inherited functions.

## 0.2.11

- Fix getters for library variables.

## 0.2.10

- Fix visibility of getters for immutable variables.

## 0.2.9

- Mark constant internal variables as pure.

## 0.2.8

- Add bytecode marker to fix Etherscan verification interference.

## 0.2.7

- Make non-view library functions payable.

## 0.2.6

- Add a receive function to the produced contracts for ether handling.

## 0.2.5

- **Breaking change**: Make storage arrays internal as some storage types cannot be returned.
- Use mapping instead of array to avoid out-of-bound checks for storage objects.
- Ignore functions with functional parameters.
- Emit event with the return parameters when mocking of "internal payable" and "internal nonpayable" functions.

## 0.2.4

- Fix handling of private functions.

## 0.2.3

- Add `include` and `exclude` config options.

## 0.2.2

- Fix clashes of overloaded function names with different storage pointer types.

## 0.2.1

- Expose internal functions with storage pointer arguments.

## 0.2.0

- **Breaking change**: Exposed contracts and functions now use a `$` prefix by default.

The previous prefix `x` can be restored by configuring the plugin as explained in the README.

## 0.1.11

- Expose internal variables.

## 0.1.10

- Add all libary functions in exposed contract.

## 0.1.9

- Fix contracts that override a function through a public variable.

## 0.1.8

- Fix import paths on Windows.

## 0.1.7

- Fix import paths on Windows.

## 0.1.6

- Improve performance a little by not requesting bytecode or optimizations for first compilation

## 0.1.5

- Remove duplicate functions in exposed contract when overriding.

## 0.1.4

- Fix storage location for constructor arguments.

## 0.1.3

- Fix functions with enum and contract arguments.

## 0.1.2

- Fix missing dependency.

## 0.1.1

- Add support for libraries.
- Add support for abstract contracts and interfaces.
- Generate a constructor that invokes all uninitialized parents.

## 0.1.0

First release.
