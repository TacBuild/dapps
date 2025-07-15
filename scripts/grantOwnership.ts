import { Signer } from "ethers";
import { Ownable2StepUpgradeable } from "../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';


const multisigAddress = "0x592e0D5f382E83406eADC6532a559A457aae7d3b"

const targetAddress = "0x4619d0Ed01a66D25F7C83E70C8515897D502cDBF";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const proxy = await hre.ethers.getContractAt("Ownable2StepUpgradeable", targetAddress);
    let tx = await proxy.connect(deployer).transferOwnership(multisigAddress);
    await tx.wait();
    console.log(`Ownership of ${targetAddress} transferred to multisig`);
}

main();