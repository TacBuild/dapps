import fs from 'fs';
import { BaseContract, Signer, TransactionReceipt } from "ethers";
import { ERC20, ERC20__factory } from "tac-l2-ccl/dist/typechain-types";
import hre, { ethers, upgrades } from "hardhat";
import { Artifact, Libraries } from "hardhat/types";




export function loadContractFromFile<T>(addressesFilePath: string, entryName: string, contractAbi: any[], signer: Signer): T {
    const addresses: {
        [entryName: string]: string;
    } = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));
    if (addresses[entryName] === undefined) {
        throw new Error(`Contract address for ${entryName} not found in ${addressesFilePath}`);
    }
    return new ethers.Contract(addresses[entryName], contractAbi, signer) as unknown as T;
}

export function loadERC20FromFile(addressesFilePath: string, entryName: string, signer: Signer): ERC20 {
    const addresses: {
        [entryName: string]: string;
    } = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));
    if (addresses[entryName] === undefined) {
        throw new Error(`Token contract address for ${entryName} not found in ${addressesFilePath}`);
    }
    return ERC20__factory.connect(addresses[entryName], signer);
}

export function printEvents<T extends BaseContract>(txReciept: TransactionReceipt, contract: T) {
    for (let log of txReciept.logs) {
        const event = contract.interface.parseLog(log);
        if (event) {
            console.log(`Event: ${event.name}\nArgs: ${JSON.stringify(event.args.toObject(true), (k, v) => { return typeof v === 'bigint' ? v.toString() : v }, 2)}`);
        }
    }
}

export async function printBalances(printString: string, tokens: { contract: ERC20, name?: string}[], entities: { name: string, address: string }[]) {
    console.log(`----------${printString}----------`);
    for (let entity of entities) {
        console.log(`-----${entity.name}-----`);
        for (let token of tokens) {
            const balance = await token.contract.balanceOf(entity.address);
            console.log(`${ token.name ? token.name : await token.contract.symbol() }: ${ethers.formatEther(balance)}`);
        }
    }
}




export async function deployUpgradableLocal<T>(deployer: Signer, contractArtifact: Artifact, args: any[], libs: Libraries | undefined = undefined, verbose: boolean = false): Promise<T> {
    const factory = (await ethers.getContractFactoryFromArtifact(contractArtifact, { libraries: libs })).connect(deployer);

    // deploy without consctructor params
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    // init contract
    const tx = await contract.initialize(...args);
    await tx.wait();

    if (verbose) {
        console.log(`[${contractArtifact.contractName} : ${contractArtifact.contractName}] Deployment upgradable in local node successfull:`, await contract.getAddress());
    }

    return contract as unknown as T;
}

export async function deployUpgradable<T>(deployer: Signer, contractArtifact: Artifact, args: any[], libs: Libraries | undefined = undefined, verbose: boolean = false): Promise<T> {
    const factory = (await ethers.getContractFactoryFromArtifact(contractArtifact, { libraries: libs })).connect(deployer);

    const contract = await upgrades.deployProxy(factory, args, { kind: "uups" });
    await contract.waitForDeployment();

    if (verbose) {
        console.log(`[${contractArtifact.contractName} : ${contractArtifact.contractName}] Deployment upgradable successfull:`, await contract.getAddress());
    }

    return contract as unknown as T;
}