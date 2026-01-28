import { SendMessageOutput, TacLocalTestSdk } from "@tonappchain/evm-ccl";
import { ethers } from "hardhat";

export const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export async function sendMessage(
  testSdk: TacLocalTestSdk,
  tvmCaller: string,
  target: string,
  methodName: string,
  encodedArguments: string,
  amount: bigint
): Promise<SendMessageOutput> {
  const shardsKey = BigInt(randInt(0, 10000));
  const operationId = ethers.encodeBytes32String(`operation-${shardsKey}`);

  return await testSdk.sendMessage(
    shardsKey,
    target,
    methodName,
    encodedArguments,
    tvmCaller,
    [],
    [],
    amount,
    "0x",
    operationId
  );
}
