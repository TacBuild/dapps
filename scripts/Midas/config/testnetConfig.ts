export interface MidasTestnetConfig {
    depositVaultAddress: string;
    redemptionVaultAddress: string;
    dataFeed: string;
}

export const midasTestnetConfig: MidasTestnetConfig = {
    depositVaultAddress: "0xCFd53AABD43AD31a229194b60b90eF26dfEB5FCB",
    redemptionVaultAddress: "0x06A317991F2F479a6213278b32D17a126FcaB501",
    dataFeed: "0x7C32e4AfB7a86AE4D14Ab44D3a3E52EfDD562a23"
};