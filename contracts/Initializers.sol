// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

contract AU {
    uint $a;
    function __A_init(uint a) internal {}
    function __A_init_unchained(uint a) internal {
        $a = a;
    }
}

contract BU is AU {
    function __B_init(uint b) internal {
        __A_init_unchained(b);
    }
    function __B_init_unchained(uint b) internal {}
}

contract CU is BU {
    function __C_init() internal {}
    function __C_init_unchained() internal {}
}
