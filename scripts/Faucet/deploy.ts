import hre, { ethers } from 'hardhat';
import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import { FaucetProxy } from '../../typechain-types/';

async function main() {

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const faucetTreasuryAddress = ethers.getAddress("0x4674788Ed1068E7dabd4207E4D09e0F564E7EDf3")
    console.log(await tacContracts.settings.getAddress())
    const faucetProxy = await deploy<FaucetProxy>(deployer, hre.artifacts.readArtifactSync('FaucetProxy'), [faucetTreasuryAddress, await tacContracts.settings.getAddress()], undefined, true);
    saveContractAddress(addressesFilePath, 'faucetProxy', await faucetProxy.getAddress());
}

main();
