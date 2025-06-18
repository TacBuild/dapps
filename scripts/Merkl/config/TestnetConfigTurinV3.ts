export interface MerklTestnetConfig {
    merklAddress: string;
}

export interface rEULTestnetConfig {
    rEULAddress: string;
    EULAddress: string;
}

export const rEULTestnetConfig: rEULTestnetConfig = {
    rEULAddress: "0xFd140871bABAe1176bA0E38f5813d56B6B53837F",
    EULAddress: "0x00bD3eFf25E6fB0A164026BD5f2916801bdf434E"
};

export const merklTestnetConfig: MerklTestnetConfig = {
    merklAddress: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae"
};