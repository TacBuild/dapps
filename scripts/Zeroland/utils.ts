import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from "fs";

export const getDeploymentAddress = (
    hre: HardhatRuntimeEnvironment,
    key: string
) => {
    const outputFile = load(hre.network.name);
    if (!outputFile[key]) return;
    return outputFile[key].address;
};

export const getDeploymentContract = (
    hre: HardhatRuntimeEnvironment,
    key: string
) => {
    const outputFile = load(hre.network.name);
    if (!outputFile[key]) return;
    return outputFile[key].contract;
};

export const load = (network: string) => {
    const filename = `./deployments/${network}.json`;

    let out: any = {};
    if (fs.existsSync(filename)) {
        const data = fs.readFileSync(filename).toString();
        out = data === "" ? {} : JSON.parse(data);
    }

    return out;
};

export const save = (
    network: string,
    key: string,
    contract: string,
    address: string,
    verified: boolean = false,
    args: any[] = []
) => {
    if (network === "hardhat") return;
    const filename = `./deployments/${network}.json`;

    let out: any = {};
    if (fs.existsSync(filename)) {
        const data = fs.readFileSync(filename).toString();
        out = data === "" ? {} : JSON.parse(data);
    }

    out[key] = {
        contract,
        verified,
        address,
        args,
    };

    fs.writeFileSync(filename, JSON.stringify(out, null, 2));
    console.log(`saved ${key}:${address} into ${network}.json`);
};