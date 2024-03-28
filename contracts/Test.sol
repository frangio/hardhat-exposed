// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

struct S {
    uint x;
}

contract Foo {
    function _testFoo() internal pure returns (uint) {
        return 0xf00;
    }

    function _testString() internal pure returns (string memory) {
        return "foo";
    }

    S s;

    function _testStruct() internal pure returns (S memory) {
        return S(42);
    }

    function _testStructStorageOutput() internal view returns (S storage) {
        return s;
    }

    function _testStructStorageInput(S storage t)
        internal
        pure
        returns (S storage)
    {
        return t;
    }

    mapping (uint => uint) m;

    function _testReturnMapping() internal view returns (mapping (uint => uint) storage) {
        return m;
    }

    struct SM {
        mapping (uint => uint) m;
    }

    SM internal sm;

    function _testReturnStructMapping() internal view returns (SM storage) {
        return sm;
    }

    struct Z {
        bool z;
    }

    function _testClash(S storage t) internal {}
    function _testClash(Z storage t) internal {}

    uint internal _x1;
    uint constant internal _x2 = 42;
    uint immutable internal _x3 = 42;
    uint immutable internal _x4;
    uint private _x5;

    constructor() {
        _x4 = 42;
    }

    type Integer is int;

    Integer internal z;

    function _testUDVT(Integer i) internal {}
}

contract Bar is Foo {
    function _testBar() internal pure returns (uint) {
        return 0xba2;
    }
}

library Lib {
    bytes32 private constant PRIVATE_VAR = 0x00;
    bytes32 internal constant INTERNAL_VAR = 0x00;
    bytes32 public constant PUBLIC_VAR = 0x00;

    function _testLib() internal pure returns (uint) {
        return 0x11b;
    }

    function _testExt() external pure returns (uint) {
        return 0x11b;
    }

    function _testStructStorageInput(S storage t)
        internal
        view
        returns (uint)
    {
        return t.x;
    }

    function _testNonView() internal returns (uint value) {
        return msg.value;
    }

    function _notExposable() private {}
}

interface Iface {
    function _abstract() external pure returns (uint);
}

abstract contract Abs {
    function abs() external view virtual returns (uint);
}

contract Concrete1 is Abs {
    function abs() public pure override returns (uint) {
        return 42;
    }
}

contract Concrete2 is Abs {
    uint public override abs = 42;
}

contract Types {
    enum Enum {
        A
    }

    function _testEnumType(Enum e) internal {}

    function _testContractType(Types t) internal {}

    function _testMappingType(mapping(uint => uint) storage m) internal {}

    function _testFunctionType(function(uint256, uint256) view returns (uint256) f) internal {}
}

contract ConstructorStorageLocation {
    constructor(string memory name) {}
}

contract ImplicitConstructor is ConstructorStorageLocation("") {}

contract Chained0 {
    function _chained() internal virtual {}
}

contract Chained1 is Chained0 {
    function _chained() internal virtual override {}
}

contract Chained2 is Chained1 {
    function _chained() internal virtual override {}
}

contract WithVars {
    uint internal var1 = 55;
    uint[] internal var2;
    mapping(uint => uint8) internal var3;

    struct Struct {
        uint a;
    }
    Struct internal var4 = Struct({a: 1});
    Struct[] internal var5;
    mapping(uint => Struct) internal var6;

    mapping(uint => mapping(bool => Struct)) internal var7;
    mapping(uint => mapping(bool => Struct[])) internal var8;

    struct StructWithNestedMapping {
        uint a;
        bytes3 b;
        mapping(uint => uint) map;
    }

    // TODO: TypeError: Types containing (nested) mappings can only be parameters or return variables of internal or library functions.
    // StructWithNestedMapping internal var9;
    // StructWithNestedMapping[] internal var10;
    // mapping(uint => StructWithNestedMapping) internal var11;

    constructor() {
        var2.push(1);
        var2.push(2);
        var2.push(3);

        var3[0] = 1;
        var3[1] = 2;
        var3[2] = 3;

        var5.push(Struct({a: 1}));
        var5.push(Struct({a: 2}));
        var5.push(Struct({a: 3}));

        var6[0] = Struct({a: 1});
        var6[1] = Struct({a: 2});
        var6[2] = Struct({a: 3});

        var7[1][true] = Struct({a: 10});
        var8[1][true].push(Struct({a: 11}));
    }
}

contract WithInternalReturns {
    uint256 private counter = 0;

    function incrementInternal() internal returns (uint256) {
        return counter++;
    }

    function someOverloaded(uint256) internal returns (bool) {
        counter++;
        return true;
    }

    function someOverloaded(bytes32) internal returns (bool) {
        counter++;
        return true;
    }

    function dynamicReturnType() internal returns (string memory) {
        counter++;
        return "a";
    }

    function multipleReturns(uint256 x) internal returns (uint256, bytes32) {
        counter++;
        return (x, keccak256(abi.encode(x)));
    }
}

contract HasReceiveFunction {
    receive() external payable {}
}

import { Imported } from './Imported.sol';

contract ImportedChild is Imported {}

contract HasEnum {
    enum InheritedEnum {
        X
    }
}

contract ParentHasEnum is HasEnum {
    function _getValue(InheritedEnum foo) internal pure returns (uint8) {
        return uint8(foo);
    }

    function _getY(Types.Enum e) internal pure returns (uint8) {
        return uint8(e);
    }
}

library LibraryHasStruct {
    struct Inner {
        uint x;
    }

    function foo() internal returns (Inner memory) {}
}

library UdvtConflict {
    type myFirstType is bytes32;
    type mySecondType is bytes32;

    function unwrap(myFirstType t) internal pure returns (bytes32) {
        return myFirstType.unwrap(t);
    }

    function unwrap(mySecondType t) internal pure returns (bytes32) {
        return mySecondType.unwrap(t);
    }
}

library UdvtNoConflict {
    type myFirstType is bytes32;
    type mySecondType is uint256;

    function unwrap(myFirstType t) internal pure returns (bytes32) {
        return myFirstType.unwrap(t);
    }

    function unwrap(mySecondType t) internal pure returns (uint256) {
        return mySecondType.unwrap(t);
    }
}
