/// <reference types="@nomiclabs/hardhat-ethers" />

import test from 'ava';
import { BigNumber } from 'ethers';
import hre from 'hardhat';

test('ethers', async t => {
  const Foo = await hre.ethers.getContractFactory('$Foo');
  const foo = await Foo.deploy();
  t.is((await foo.$_testFoo()).toHexString(), '0x0f00');

  const WithVars = await hre.ethers.getContractFactory('$WithVars');
  const withVars = await WithVars.deploy();
  t.is((await withVars.$var1()).toNumber(), 55);
  t.deepEqual(await withVars.$var2(), [BigNumber.from(1), BigNumber.from(2), BigNumber.from(3)]);
  t.is((await withVars.$var3(1)), 2);
  t.like(await withVars.$var4(), { a: BigNumber.from(1) });
  t.like(await withVars.$var5(), {
    0: { a: BigNumber.from(1) },
    1: { a: BigNumber.from(2) },
    2: { a: BigNumber.from(3) },
  });
  t.like(await withVars.$var6(1), { a: BigNumber.from(2) });
  t.like(await withVars.$var7(1, true), { a: BigNumber.from(10) });
  t.like(await withVars.$var8(1, true), {
    0: { a: BigNumber.from(11) },
  });
});
