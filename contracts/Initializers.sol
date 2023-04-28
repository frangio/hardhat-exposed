// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

contract Initializable {
    modifier initializer() {
        _;
    }
}

contract AU is Initializable {
    uint $a;
    function __A_init(uint a) internal {
        __A_init_unchained(a);
    }
    function __A_init_unchained(uint a) internal {
        $a = a;
    }
}

contract BU is Initializable, AU {
    function __B_init(uint b) internal {
        __A_init_unchained(b);
        __B_init_unchained(b);
    }
    function __B_init_unchained(uint b) internal {}
}

contract CU is Initializable, BU {
    function __C_init() internal {}
    function __C_init_unchained() internal {}
}

contract XU is Initializable {
    uint $x;
    function __X_init(uint x) internal {
        __X_init_unchained(x);
    }
    function __X_init_unchained(uint x) internal {
        $x = x;
    }
}

contract YU is Initializable, XU {
    function __Y_init() internal {}
    function __Y_init_unchained() internal {}
}
