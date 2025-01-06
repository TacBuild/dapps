import { ethers } from "hardhat";
import fs from 'fs';
import { BaseContract, Signer, TransactionReceipt } from "ethers";
import { ERC20, ERC20__factory } from "tac-l2-ccl/dist/typechain-types";
import assert from "assert";

export function loadContractFromFile<T>(addressesFilePath: string, entryName: string, contractAbi: any[], signer: Signer): T {
    const addresses: {
        [entryName: string]: string;
    } = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));
    assert(addresses[entryName] !== undefined, `Contract address for ${entryName} not found in ${addressesFilePath}`);
    return new ethers.Contract(addresses[entryName], contractAbi, signer) as unknown as T;
}

export function loadERC20FromFile(addressesFilePath: string, entryName: string, signer: Signer): ERC20 {
    const addresses: {
        [entryName: string]: string;
    } = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));
    assert(addresses[entryName] !== undefined, `Token address for ${entryName} not found in ${addressesFilePath}`);
    
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