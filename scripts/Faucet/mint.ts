import hre, { ethers } from 'hardhat';
import { printEvents, printBalances } from '../utils';
import { ERC20 } from 'tac-l2-ccl/dist/typechain-types';
import { loadTacContracts } from "tac-l2-ccl";
import { loadContractFromFile } from "../utils";
import path from 'path';
import { FaucetProxy } from '../../typechain-types';

async function main() {

    const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const faucetProxy = loadContractFromFile<FaucetProxy>(addressesFilePath, 'faucetProxy', hre.artifacts.readArtifactSync('FaucetProxy').abi, signer);

    const tx = await faucetProxy.connect(signer).mint(
        await faucetProxy.getAddress(),
        { value: ethers.parseEther("1") }
    );
    await tx.wait();
}

main();
