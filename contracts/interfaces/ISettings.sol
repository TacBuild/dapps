// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;


/**
 * @title Settings interface
 * @dev A contract for storing Cross-Chain Layer configuration
 */
interface ISettings {
    /**
     * @dev Cross-Chain Layer configuration setting changed event
     * @param variable Name of the variable updated
     */
    event SettingsUpdated(bytes32 indexed variable);

    /**
     * @dev Update a uint64 setting.
     * @param key The setting key.
     * @param value The new value.
     */
    function setUintSetting(bytes32 key, uint64 value) external;

    /**
     * @dev Get a uint64 setting.
     * @param key The setting key.
     * @return The setting value.
     */
    function getUintSetting(bytes32 key) external view returns (uint64);

    /**
     * @dev Update an address setting.
     * @param key The setting key.
     * @param value The new address value.
     */
    function setAddressSetting(bytes32 key, address value) external;

    /**
     * @dev Get an address setting.
     * @param key The setting key.
     * @return The setting value.
     */
    function getAddressSetting(bytes32 key) external view returns (address);

    /**
     * @dev Update a bool setting.
     * @param key The setting key.
     * @param value The new bool value.
     */
    function setBoolSetting(bytes32 key, bool value) external;

    /**
     * @dev Get a bool setting.
     * @param key The setting key.
     * @return The setting value.
     */
    function getBoolSetting(bytes32 key) external view returns (bool);
}
