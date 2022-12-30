// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract Parent1 {
    constructor(uint x) {}

    function _testParent1() internal {}
}

abstract contract Parent2 {
    constructor(uint y) {}
}

abstract contract Parent3 {
    constructor(uint z) {}
}

abstract contract Child1 is Parent1 {}

abstract contract Child2 is Parent1, Parent2 {}

abstract contract Child3 is Parent1, Parent2, Child2 {}

abstract contract Child4 is Parent1, Parent2, Parent3 {
    constructor(uint c) {}
}
