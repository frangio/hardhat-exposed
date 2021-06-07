/// <reference types="@nomiclabs/hardhat-truffle5" />
/// <reference types="@nomiclabs/hardhat-ethers" />

import test from 'ava';
import hre from 'hardhat';

test('ethers', async t => {
  const Foo = await hre.ethers.getContractFactory('XFoo');
  const foo = await Foo.deploy();
  t.is((await foo.x_testFoo()).toHexString(), '0x0f00');
});

test('truffle', async t => {
  const XFoo = hre.artifacts.require('XFoo');
  const foo = await XFoo.new();
  t.is((await foo.x_testFoo()).toString('hex'), 'f00');
});
